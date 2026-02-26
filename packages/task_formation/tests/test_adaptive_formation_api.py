from task_formation.adaptive_formation_api import AdaptiveFormationAPI
from task_formation.complementarity_analyzer import CapabilityDependency, ComplementarityAnalyzer
from task_formation.cooperative_context_model import CooperativeContextModel, DomainImpactType
from task_formation.cooperative_intelligence import CooperativeIntelligenceVector, TemporalImpactMemory
from task_formation.counterfactual_team_evaluator import CounterfactualTeamEvaluator
from task_formation.entropy_constraint_module import EntropyConstraintModule
from task_formation.synergy_forecast_simulator import HistoricalCoalitionRecord, SynergyForecastSimulator
from task_formation.team_optimizer import TeamOptimizer


def _build_agents():
    return [
        CooperativeIntelligenceVector(
            agent_id="A",
            predictive_calibration_reliability=0.90,
            marginal_cooperative_influence_consistency=0.92,
            cross_role_integration_depth=0.80,
            capability_profile={"coding": 0.95, "design": 0.35, "ops": 0.30},
            temporal_impact_memory=TemporalImpactMemory(0.70, 0.80, 2.0),
        ),
        CooperativeIntelligenceVector(
            agent_id="B",
            predictive_calibration_reliability=0.86,
            marginal_cooperative_influence_consistency=0.85,
            cross_role_integration_depth=0.75,
            capability_profile={"coding": 0.40, "design": 0.92, "ops": 0.45},
            temporal_impact_memory=TemporalImpactMemory(0.62, 0.72, 2.5),
        ),
        CooperativeIntelligenceVector(
            agent_id="C",
            predictive_calibration_reliability=0.82,
            marginal_cooperative_influence_consistency=0.78,
            cross_role_integration_depth=0.70,
            capability_profile={"coding": 0.65, "design": 0.60, "ops": 0.88},
            temporal_impact_memory=TemporalImpactMemory(0.58, 0.70, 3.1),
        ),
        CooperativeIntelligenceVector(
            agent_id="D",
            predictive_calibration_reliability=0.72,
            marginal_cooperative_influence_consistency=0.68,
            cross_role_integration_depth=0.60,
            capability_profile={"coding": 0.52, "design": 0.48, "ops": 0.50},
            temporal_impact_memory=TemporalImpactMemory(0.45, 0.52, 4.0),
        ),
    ]


def _build_history():
    return [
        HistoricalCoalitionRecord(("A", "B"), additive_expectation=1.6, realized_impact=2.3),
        HistoricalCoalitionRecord(("A", "C"), additive_expectation=1.7, realized_impact=2.2),
        HistoricalCoalitionRecord(("B", "C"), additive_expectation=1.5, realized_impact=2.0),
        HistoricalCoalitionRecord(("A", "B", "C"), additive_expectation=2.4, realized_impact=3.8),
    ]


def _build_api():
    analyzer = ComplementarityAnalyzer(
        dependencies=[
            CapabilityDependency("coding", "design", 0.55),
            CapabilityDependency("design", "ops", 0.45),
        ],
        historical_records=_build_history(),
    )
    entropy = EntropyConstraintModule()
    simulator = SynergyForecastSimulator(
        historical_records=_build_history(),
        simulation_draws=1000,
        random_seed=21,
    )
    evaluator = CounterfactualTeamEvaluator(simulator)
    optimizer = TeamOptimizer(evaluator, analyzer, entropy)
    return AdaptiveFormationAPI(
        context_model=CooperativeContextModel(),
        optimizer=optimizer,
        evaluator=evaluator,
        entropy_module=entropy,
    )


def test_adaptive_formation_api_returns_structured_configuration():
    api = _build_api()
    task = CooperativeContextModel.encode_task(
        impact_domain=DomainImpactType.TECHNICAL,
        capabilities={"coding": 0.45, "design": 0.30, "ops": 0.25},
        causal_depth=4,
        risk_threshold=0.35,
        horizon=8.0,
    )

    result = api.form_team(
        task,
        _build_agents(),
        min_team_size=2,
        max_team_size=3,
        population_size=14,
        generations=6,
        random_seed=7,
    )

    assert len(result.selected_agent_ids) >= 2
    assert len(result.selected_agent_ids) <= 3

    dist = result.projected_synergy_distribution
    assert dist.sample_count == 1000
    assert dist.p05 <= dist.p50 <= dist.p95
    assert 0.0 <= dist.probability_positive_amplification <= 1.0

    contribution_sum = sum(
        c.normalized_contribution_share
        for c in result.marginal_cooperative_influence_contributions
    )
    assert abs(contribution_sum - 1.0) < 1e-9

    trust_sum = sum(
        t.trust_weight
        for t in result.trust_weighted_propagation_factors
    )
    assert abs(trust_sum - 1.0) < 1e-9

    entropy = result.entropy_scores
    assert entropy.trust_weight_entropy >= 0.0
    assert 0.0 <= entropy.trust_weight_entropy_ratio <= 1.0
    assert entropy.influence_entropy >= 0.0
    assert 0.0 <= entropy.influence_entropy_ratio <= 1.0

    stability = result.stability_forecast
    assert 0.0 <= stability.stability_score <= 1.0
    assert 0.0 <= stability.instability_risk <= 1.0
    assert 0.0 <= stability.stability_penalty_factor <= 1.0

    traces = result.causal_explanation_traces
    selected_ids = set(result.selected_agent_ids)
    assert len(traces) == len(selected_ids)
    assert {t.agent_id for t in traces} == selected_ids
    assert all(len(t.causal_explanation) >= 3 for t in traces)


def test_adaptive_formation_api_exposes_marginal_deltas_per_agent():
    api = _build_api()
    task = CooperativeContextModel.encode_task(
        impact_domain=DomainImpactType.SYNERGETIC,
        capabilities={"coding": 0.40, "design": 0.40, "ops": 0.20},
        causal_depth=5,
        risk_threshold=0.25,
        horizon=10.0,
    )

    result = api.form_team(
        task,
        _build_agents(),
        min_team_size=3,
        max_team_size=3,
        population_size=10,
        generations=5,
        random_seed=9,
    )

    contributions = result.marginal_cooperative_influence_contributions
    assert len(contributions) == 3
    for item in contributions:
        assert item.agent_id in result.selected_agent_ids
        assert item.absolute_contribution >= 0.0
        # Removing a selected agent should not increase team impact in typical cases.
        assert item.removal_delta_total_impact <= 0.0
        assert item.structural_necessity_score >= 0.0

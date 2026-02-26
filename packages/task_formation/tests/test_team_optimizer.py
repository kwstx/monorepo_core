import pytest
from task_formation.cooperative_intelligence import CooperativeIntelligenceVector, TemporalImpactMemory
from task_formation.cooperative_context_model import CooperativeContextModel, DomainImpactType
from task_formation.complementarity_analyzer import ComplementarityAnalyzer, CapabilityDependency
from task_formation.entropy_constraint_module import EntropyConstraintModule
from task_formation.counterfactual_team_evaluator import CounterfactualTeamEvaluator
from task_formation.synergy_forecast_simulator import SynergyForecastSimulator, HistoricalCoalitionRecord
from task_formation.team_optimizer import TeamOptimizer, OptimizationWeights

def test_team_optimizer_execution():
    # 1. Setup Agents
    agents = [
        CooperativeIntelligenceVector(
            agent_id=f"agent_{i}",
            predictive_calibration_reliability=0.7 + (i * 0.05),
            marginal_cooperative_influence_consistency=0.6 + (i * 0.04),
            cross_role_integration_depth=0.5 + (i * 0.06),
            capability_profile={"coding": 0.8 if i % 2 == 0 else 0.2, "design": 0.2 if i % 2 == 0 else 0.8},
            temporal_impact_memory=TemporalImpactMemory(0.6, 0.7, 2.0)
        ) for i in range(10)
    ]

    # 2. Setup Task
    task = CooperativeContextModel.encode_task(
        impact_domain=DomainImpactType.TECHNICAL,
        capabilities={"coding": 0.6, "design": 0.4},
        causal_depth=3,
        risk_threshold=0.5,
        horizon=6.0
    )

    # 3. Setup Dependencies
    analyzer = ComplementarityAnalyzer(
        dependencies=[CapabilityDependency("coding", "design", 0.5)]
    )
    entropy_module = EntropyConstraintModule()
    simulator = SynergyForecastSimulator(historical_records=[])
    evaluator = CounterfactualTeamEvaluator(simulator)

    optimizer = TeamOptimizer(evaluator, analyzer, entropy_module)

    # 4. Run Optimization
    result = optimizer.optimize(
        task=task,
        available_agents=agents,
        min_team_size=2,
        max_team_size=4,
        population_size=10,
        generations=5
    )

    # 5. Assertions
    assert len(result.team) >= 2
    assert len(result.team) <= 4
    assert result.fitness > 0
    assert "norm_impact" in result.metrics
    assert "synergy_score" in result.metrics
    
    print(f"\nOptimal Team: {[a.agent_id for a in result.team]}")
    print(f"Metrics: {result.metrics}")

if __name__ == "__main__":
    test_team_optimizer_execution()

import math

from src.causal_impact_propagation import CausalImpactPropagationEngine, SynergyShiftAnalyzer
from src.models.cooperative_state_snapshot import (
    CooperativeIntelligenceDistribution,
    CooperativeStateSnapshot,
    PredictiveCalibrationCurve,
    PredictiveCalibrationPoint,
    SynergyDensityMatrix,
    TrustVector,
)
from src.models.policy import PolicySchema


def _baseline_snapshot() -> CooperativeStateSnapshot:
    return CooperativeStateSnapshot(
        simulation_id="sim-001",
        capture_step=0,
        trust_vectors=(
            TrustVector(entity_id="a", values=(0.8, 0.9)),
            TrustVector(entity_id="b", values=(0.7, 0.8)),
        ),
        cooperative_intelligence_distributions=(
            CooperativeIntelligenceDistribution(domain="planning", values=(0.6, 0.7, 0.8)),
        ),
        synergy_density_matrices=(
            SynergyDensityMatrix(
                matrix_id="m1",
                row_labels=("x", "y"),
                col_labels=("x", "y"),
                values=((0.4, 0.6), (0.5, 0.7)),
            ),
        ),
        predictive_calibration_curves=(
            PredictiveCalibrationCurve(
                curve_id="c1",
                points=(
                    PredictiveCalibrationPoint(predicted=0.7, observed=0.65),
                    PredictiveCalibrationPoint(predicted=0.6, observed=0.58),
                ),
            ),
        ),
    )


def _policy(persistence_mode: str = "sticky", duration_steps: int = 10) -> PolicySchema:
    return PolicySchema(
        policy_id="policy-1",
        name="Trust-Synergy Boost",
        scope={"agent_categories": ["all"], "task_domains": ["planning"]},
        constraints=[{"expression": "x > 0", "action": "log"}],
        transformations=[
            {
                "metric_source": "trust_coefficient",
                "operator": "multiply",
                "value": 1.2,
                "target_metric": "influence_weight",
            }
        ],
        affected_metrics=["synergy_density", "collective_iq"],
        entropy_adjustments={"target_entropy_delta": 0.03},
        impact_modifiers={"downstream_synergy": 1.15},
        temporal_rules={
            "duration_steps": duration_steps,
            "auto_decay_coefficient": 0.02,
            "persistence_mode": persistence_mode,
        },
    )


def test_impact_projection_across_horizons():
    engine = CausalImpactPropagationEngine()
    report = engine.simulate(_policy(), _baseline_snapshot(), horizons=[1, 5, 20])

    assert report.policy_id == "policy-1"
    assert len(report.horizons) == 3
    assert tuple(p.horizon for p in report.horizons) == (1, 5, 20)

    baseline = report.baseline.baseline_outcome_score
    assert baseline > 0.0

    for projection in report.horizons:
        assert projection.impact_delta_vs_baseline == (
            projection.projected_outcome_score - baseline
        )

    assert any(abs(p.impact_delta_vs_baseline) > 0.0 for p in report.horizons)


def test_transient_policy_stops_after_duration():
    engine = CausalImpactPropagationEngine()
    report = engine.simulate(
        _policy(persistence_mode="transient", duration_steps=2),
        _baseline_snapshot(),
        horizons=[1, 2, 5],
    )

    baseline = report.baseline.baseline_outcome_score
    h5 = next(p for p in report.horizons if p.horizon == 5)
    assert math.isclose(h5.projected_outcome_score, baseline, rel_tol=1e-9, abs_tol=1e-9)
    assert math.isclose(h5.impact_delta_vs_baseline, 0.0, rel_tol=1e-9, abs_tol=1e-9)


def test_synergy_shift_analyzer_outputs_tensor_deltas():
    analyzer = SynergyShiftAnalyzer()
    report = analyzer.analyze(_policy(), _baseline_snapshot(), horizons=[1, 5])

    assert report.policy_id == "policy-1"
    assert tuple(h.horizon for h in report.horizons) == (1, 5)

    for horizon in report.horizons:
        assert len(horizon.projected_synergy_distribution_delta_tensors) == 1
        assert len(horizon.complementarity_emergence_probability_delta_tensors) == 1
        assert len(horizon.marginal_cooperative_influence_variability_delta_tensors) == 1

        distribution_tensor = horizon.projected_synergy_distribution_delta_tensors[0]
        assert len(distribution_tensor.delta_values) == 2
        assert len(distribution_tensor.delta_values[0]) == 2

        projected_sum = sum(sum(row) for row in distribution_tensor.projected_values)
        baseline_sum = sum(sum(row) for row in distribution_tensor.baseline_values)
        assert math.isclose(projected_sum, 1.0, rel_tol=1e-9, abs_tol=1e-9)
        assert math.isclose(baseline_sum, 1.0, rel_tol=1e-9, abs_tol=1e-9)

        complementarity_tensor = horizon.complementarity_emergence_probability_delta_tensors[0]
        assert all(
            0.0 <= value <= 1.0
            for row in complementarity_tensor.projected_values
            for value in row
        )

        variability_tensor = horizon.marginal_cooperative_influence_variability_delta_tensors[0]
        assert len(variability_tensor.delta_values) == 2
        assert len(variability_tensor.delta_values[0]) == 2

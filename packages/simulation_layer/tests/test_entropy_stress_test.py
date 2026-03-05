from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
from simulation_layer.models.policy import PolicySchema
from simulation_layer.simulation.entropy_stress_test import EntropyStressTest


def _baseline_snapshot() -> CooperativeStateSnapshot:
    return CooperativeStateSnapshot(
        simulation_id="sim-entropy-001",
        capture_step=0,
        trust_vectors=(
            {"entity_id": "a1", "values": (0.92, 0.89)},
            {"entity_id": "a2", "values": (0.72, 0.70)},
            {"entity_id": "a3", "values": (0.56, 0.52)},
            {"entity_id": "a4", "values": (0.48, 0.44)},
        ),
    )


def _base_policy() -> dict:
    return {
        "policy_id": "pol-entropy-stress",
        "name": "Entropy Stress Candidate",
        "scope": {"agent_categories": ["all"], "task_domains": ["coordination"]},
        "affected_metrics": ["influence_distribution", "cooperative_diversity"],
        "temporal_rules": {"persistence_mode": "sticky"},
    }


def test_detects_structural_dominance_amplification():
    policy_data = _base_policy()
    policy_data.update(
        {
            "transformations": [
                {
                    "metric_source": "trust_core",
                    "operator": "multiply",
                    "value": 1.45,
                    "target_metric": "influence_weight",
                },
                {
                    "metric_source": "reward_pathway",
                    "operator": "add",
                    "value": 0.30,
                    "target_metric": "reward_scaling",
                },
            ],
            "entropy_adjustments": {"shannon_entropy_target": -0.08},
            "impact_modifiers": {"dominance_pressure": 1.10},
        }
    )

    report = EntropyStressTest().evaluate(PolicySchema(**policy_data), _baseline_snapshot(), cycles=16)

    assert report.dominance_amplification_detected is True
    assert report.entropy_delta < 0.0
    assert report.trajectory[-1].dominance_share > report.trajectory[0].dominance_share


def test_preserves_cooperative_diversity_under_balancing_policy():
    policy_data = _base_policy()
    policy_data.update(
        {
            "transformations": [
                {
                    "metric_source": "influence_cap",
                    "operator": "decay",
                    "value": 0.20,
                    "target_metric": "influence_weight",
                },
                {
                    "metric_source": "coordination_bonus",
                    "operator": "add",
                    "value": 0.25,
                    "target_metric": "negotiation_alignment",
                },
            ],
            "entropy_adjustments": {"shannon_entropy_target": 0.05},
            "impact_modifiers": {"cooperation_stability": 1.08},
        }
    )

    report = EntropyStressTest().evaluate(PolicySchema(**policy_data), _baseline_snapshot(), cycles=16)

    assert report.dominance_amplification_detected is False
    assert report.fragmentation_risk_detected is False
    assert report.cooperative_diversity_destabilized is False
    assert report.final_normalized_entropy >= report.baseline_normalized_entropy - 0.02


def test_detects_fragmentation_risk_with_divergence_policy():
    policy_data = _base_policy()
    policy_data.update(
        {
            "transformations": [
                {
                    "metric_source": "exploration_push",
                    "operator": "multiply",
                    "value": 1.60,
                    "target_metric": "task_formation_exploration",
                },
                {
                    "metric_source": "divergence_boost",
                    "operator": "add",
                    "value": 0.40,
                    "target_metric": "task_divergence",
                },
                {
                    "metric_source": "consensus_penalty",
                    "operator": "decay",
                    "value": 0.18,
                    "target_metric": "cooperation_alignment",
                },
            ],
            "entropy_adjustments": {"shannon_entropy_target": 0.10},
            "impact_modifiers": {"instability_risk": 1.25},
        }
    )

    report = EntropyStressTest().evaluate(PolicySchema(**policy_data), _baseline_snapshot(), cycles=20)

    assert report.fragmentation_risk_detected is True
    assert report.fragmentation_risk_score >= 0.12
    assert any(point.churn > 0.03 for point in report.trajectory[1:])


def test_sparse_snapshot_ingests_live_state():
    class StubStateIngestor:
        def load_current_state(self, simulation_id: str, capture_step: int) -> CooperativeStateSnapshot:
            return CooperativeStateSnapshot(
                simulation_id=simulation_id,
                capture_step=capture_step,
                trust_vectors=(
                    {"entity_id": "live-a", "values": (0.90,)},
                    {"entity_id": "live-b", "values": (0.10,)},
                ),
            )

    policy = PolicySchema(**_base_policy())
    sparse = CooperativeStateSnapshot(simulation_id="sim-live", capture_step=0)

    report = EntropyStressTest(state_ingestor=StubStateIngestor()).evaluate(
        policy,
        sparse,
        cycles=1,
    )

    assert report.trajectory[0].dominance_share > 0.80


def test_sparse_snapshot_without_ingestor_raises():
    policy = PolicySchema(**_base_policy())
    sparse = CooperativeStateSnapshot(simulation_id="sim-sparse", capture_step=0)

    try:
        EntropyStressTest().evaluate(policy, sparse, cycles=1)
        assert False, "Expected ValueError for sparse snapshot with no live ingestor."
    except ValueError as exc:
        assert "StateIngestor" in str(exc)

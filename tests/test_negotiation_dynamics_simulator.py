from src.models.cooperative_state_snapshot import CooperativeStateSnapshot
from src.models.policy import PolicySchema
from src.simulation.negotiation_dynamics_simulator import NegotiationDynamicsSimulator


def _snapshot() -> CooperativeStateSnapshot:
    return CooperativeStateSnapshot(
        simulation_id="sim-neg-001",
        capture_step=0,
        trust_vectors=(
            {"entity_id": "agent_a", "values": (0.88, 0.82)},
            {"entity_id": "agent_b", "values": (0.74, 0.71)},
            {"entity_id": "agent_c", "values": (0.60, 0.57)},
            {"entity_id": "agent_d", "values": (0.48, 0.50)},
        ),
    )


def _base_policy_data() -> dict:
    return {
        "policy_id": "pol-neg-base",
        "name": "Negotiation Dynamics Baseline",
        "scope": {"agent_categories": ["all"], "task_domains": ["bargaining"]},
        "affected_metrics": ["negotiation_velocity", "proposal_variance", "trust_alignment"],
        "temporal_rules": {"persistence_mode": "transient"},
    }


def test_balancing_policy_converges_with_low_risk():
    policy_data = _base_policy_data()
    policy_data.update(
        {
            "transformations": [
                {
                    "metric_source": "consensus_support",
                    "operator": "add",
                    "value": 0.18,
                    "target_metric": "negotiation_alignment",
                },
                {
                    "metric_source": "influence_cap",
                    "operator": "decay",
                    "value": 0.12,
                    "target_metric": "trust_weight",
                },
            ],
            "entropy_adjustments": {"shannon_entropy_target": -0.03},
            "impact_modifiers": {"coordination_uplift": 1.08},
        }
    )

    report = NegotiationDynamicsSimulator().simulate(
        policy=PolicySchema(**policy_data),
        baseline_snapshot=_snapshot(),
        max_steps=18,
    )

    assert report.converged is True
    assert report.convergence_time < 18
    assert report.instability_detected is False
    assert report.coordination_friction_detected is False
    assert report.trajectory[-1].agreement_progress > 0.75


def test_governance_rules_detect_instability_and_friction():
    policy_data = _base_policy_data()
    policy_data.update(
        {
            "transformations": [
                {
                    "metric_source": "influence_amplifier",
                    "operator": "multiply",
                    "value": 1.55,
                    "target_metric": "trust_weight",
                },
                {
                    "metric_source": "proposal_divergence_push",
                    "operator": "multiply",
                    "value": 1.45,
                    "target_metric": "proposal_exploration",
                },
                {
                    "metric_source": "strict_quorum",
                    "operator": "add",
                    "value": 0.30,
                    "target_metric": "alignment_threshold",
                },
            ],
            "entropy_adjustments": {"shannon_entropy_target": 0.12},
            "impact_modifiers": {"instability_risk": 1.28, "dominance_pressure": 1.20},
            "temporal_rules": {"persistence_mode": "permanent"},
        }
    )

    report = NegotiationDynamicsSimulator().simulate(
        policy=PolicySchema(**policy_data),
        baseline_snapshot=_snapshot(),
        max_steps=20,
    )

    assert report.instability_detected is True
    assert report.coordination_friction_detected is True
    assert report.proposal_variance_delta >= -0.005
    assert report.influence_shift_delta >= 0.0
    assert any(r.risk_type == "negotiation_instability" for r in report.governance_risks)
    assert any(r.risk_type == "coordination_friction" for r in report.governance_risks)
    assert any("transformations" in r.rule_reference for r in report.governance_risks)


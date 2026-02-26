import pytest
import numpy as np
from simulation_layer.models.policy import PolicySchema, TransformationOperator
from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
from simulation_layer.optimization.policy_optimizer import PolicyOptimizer

def test_policy_optimizer_pareto_frontier():
    # 1. Setup Initial State Snapshot
    snapshot_data = {
        "simulation_id": "sim-opt-001",
        "capture_step": 0,
        "trust_vectors": [
            {"entity_id": "agent_01", "values": (0.5, 0.5)},
            {"entity_id": "agent_02", "values": (0.6, 0.4)},
            {"entity_id": "agent_03", "values": (0.4, 0.6)}
        ],
        "synergy_density_matrices": [
            {
                "matrix_id": "global_synergy",
                "row_labels": ("agent_01", "agent_02", "agent_03"),
                "col_labels": ("agent_01", "agent_02", "agent_03"),
                "values": (
                    (1.0, 0.5, 0.3),
                    (0.5, 1.0, 0.4),
                    (0.3, 0.4, 1.0)
                )
            }
        ],
        "metadata": {"environment": "optimization_test"}
    }
    snapshot = CooperativeStateSnapshot(**snapshot_data)
    
    # 2. Define Candidate Policies
    
    # P1: Conservative / Baseline
    p1 = PolicySchema(
        policy_id="p1_conservative",
        name="Conservative Policy",
        scope={"agent_categories": ["standard"]},
        transformations=[],
        affected_metrics=["impact"],
        entropy_adjustments={},
        impact_modifiers={"projected_real_world_impact": 1.0},
        temporal_rules={"persistence_mode": "transient"}
    )
    
    # P2: High Impact, High Risk (Dominance)
    p2 = PolicySchema(
        policy_id="p2_aggressive_impact",
        name="Aggressive Impact Policy",
        scope={"agent_categories": ["all"]},
        transformations=[
            {
                "metric_source": "trust",
                "operator": "multiply",
                "value": 1.5,
                "target_metric": "influence_weight"
            }
        ],
        affected_metrics=["impact"],
        entropy_adjustments={"shannon_entropy_target": -0.2}, # High concentration risk
        impact_modifiers={"projected_real_world_impact": 1.5},
        temporal_rules={"persistence_mode": "sticky"}
    )
    
    # P3: Balanced Resilience
    p3 = PolicySchema(
        policy_id="p3_balanced_resilience",
        name="Balanced Resilience Policy",
        scope={"agent_categories": ["all"]},
        transformations=[
            {
                "metric_source": "trust",
                "operator": "multiply",
                "value": 1.1,
                "target_metric": "trust_weight"
            }
        ],
        affected_metrics=["synergy", "resilience"],
        entropy_adjustments={"shannon_entropy_target": +0.05}, # Encourage diversity
        impact_modifiers={"projected_real_world_impact": 1.1},
        temporal_rules={"persistence_mode": "permanent"}
    )
    
    # P4: Synergy Specialist
    p4 = PolicySchema(
        policy_id="p4_synergy_boost",
        name="Synergy Boost Policy",
        scope={"agent_categories": ["all"]},
        transformations=[
            {
                "metric_source": "synergy",
                "operator": "add",
                "value": 0.5,
                "target_metric": "cooperation_alignment"
            }
        ],
        affected_metrics=["synergy_density"],
        entropy_adjustments={"shannon_entropy_target": -0.05},
        impact_modifiers={"projected_real_world_impact": 1.2},
        temporal_rules={"persistence_mode": "sticky"}
    )

    candidates = [p1, p2, p3, p4]
    
    # 3. Run Optimizer
    optimizer = PolicyOptimizer(snapshot, simulation_steps=20, long_horizon_steps=100)
    result = optimizer.optimize(candidates)
    
    # 4. Assertions
    assert len(result.frontier) > 0
    assert len(result.scores) == len(result.frontier)
    
    for pid, scores in result.scores.items():
        assert scores.policy_id == pid
        assert isinstance(scores.downstream_impact, float)
        assert isinstance(scores.synergy_amplification, float)
        assert isinstance(scores.intelligence_growth, float)
        assert isinstance(scores.entropy_balance, float)
        assert isinstance(scores.long_horizon_resilience, float)

    # 5. Check Pareto Frontier Logic
    # Verify that no policy in the frontier is dominated by another in the total candidate list
    for f_pid in [p.policy_id for p in result.frontier]:
        f_scores = result.scores[f_pid]
        for c_pid in [p.policy_id for p in candidates]:
            c_scores = optimizer._evaluate_policy([p for p in candidates if p.policy_id == c_pid][0])
            # Check if any candidate dominates the frontier member
            # Note: _dominates(a, b) returns True if a dominates b
            assert not optimizer._dominates(c_scores, f_scores)

    print(f"\nOptimization results:")
    print(f"Candidate count: {result.metadata['candidate_count']}")
    print(f"Frontier size: {result.metadata['frontier_count']}")
    for pid, scores in result.scores.items():
        print(f"- {pid}: Impact={scores.downstream_impact:.2f}, Resilience={scores.long_horizon_resilience:.2f}, Entropy={scores.entropy_balance:.2f}")

def test_policy_optimizer_with_constraints():
    # Setup similar to above but with constraints
    snapshot_data = {
        "simulation_id": "sim-opt-002",
        "capture_step": 0,
        "trust_vectors": [{"entity_id": "a1", "values": (0.5, 0.5)}],
        "metadata": {}
    }
    snapshot = CooperativeStateSnapshot(**snapshot_data)
    
    p_low = PolicySchema(
        policy_id="low_impact",
        name="Low Impact",
        scope={"agent_categories": []},
        transformations=[],
        affected_metrics=[],
        impact_modifiers={"projected_real_world_impact": 0.5},
        temporal_rules={"persistence_mode": "transient"}
    )
    
    p_high = PolicySchema(
        policy_id="high_impact",
        name="High Impact",
        scope={"agent_categories": []},
        transformations=[],
        affected_metrics=[],
        impact_modifiers={"projected_real_world_impact": 2.0},
        temporal_rules={"persistence_mode": "transient"}
    )
    
    optimizer = PolicyOptimizer(snapshot, simulation_steps=5)
    
    # Apply constraint: impact must be > 1.0
    constraints = {"downstream_impact": 1.0}
    result = optimizer.optimize([p_low, p_high], constraints=constraints)
    
    assert result.metadata["candidate_count"] == 2
    assert result.metadata["after_constraints_count"] == 1
    assert result.frontier[0].policy_id == "high_impact"

if __name__ == "__main__":
    pytest.main([__file__])

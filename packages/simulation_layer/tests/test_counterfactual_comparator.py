import pytest
from simulation_layer.models.policy import PolicySchema, TransformationOperator
from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
from simulation_layer.simulation.counterfactual_policy_comparator import CounterfactualPolicyComparator

def test_counterfactual_policy_comparison():
    # 1. Setup Initial State Snapshot
    snapshot_data = {
        "simulation_id": "sim-cf-001",
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
        "predictive_calibration_curves": [
            {
                "curve_id": "calibration_v1",
                "points": (
                    {"predicted": 0.8, "observed": 0.75},
                    {"predicted": 0.4, "observed": 0.42}
                )
            }
        ],
        "metadata": {
            "environment": "test_sandbox"
        }
    }
    snapshot = CooperativeStateSnapshot(**snapshot_data)
    
    # 2. Define Baseline Policy (Limited effect)
    baseline_policy = PolicySchema(
        policy_id="pol-baseline",
        name="Baseline Strategy",
        scope={"agent_categories": ["standard"]},
        transformations=[
            {
                "metric_source": "trust",
                "operator": "multiply",
                "value": 1.01,
                "target_metric": "trust_weight"
            }
        ],
        affected_metrics=["impact"],
        entropy_adjustments={"global_entropy": 0.0},
        impact_modifiers={"projected_real_world_impact": 1.0},
        temporal_rules={"persistence_mode": "transient"}
    )
    
    # 3. Define Modified Policy (Aggressive synergy boost)
    modified_policy = PolicySchema(
        policy_id="pol-modified",
        name="Synergy Optimization Strategy",
        scope={"agent_categories": ["all"]},
        transformations=[
            {
                "metric_source": "trust",
                "operator": "multiply",
                "value": 1.15,
                "target_metric": "trust_weight"
            },
            {
                "metric_source": "synergy",
                "operator": "add",
                "value": 0.2, # Significant boost to coordination incentives
                "target_metric": "cooperation_alignment"
            }
        ],
        affected_metrics=["synergy_density", "collective_intelligence"],
        entropy_adjustments={"shannon_entropy_target": -0.05}, # Higher coordination focus
        impact_modifiers={"projected_real_world_impact": 1.25}, # Projected 25% boost
        temporal_rules={"persistence_mode": "sticky"} # Sticky policies reinforce better
    )
    
    # 4. Initialize Comparator and Run Parallel Simulations
    comparator = CounterfactualPolicyComparator(snapshot, steps=20)
    report = comparator.compare(baseline_policy, modified_policy)
    
    # 5. Assertions and Multi-Objective Validation
    assert report.baseline_id == "pol-baseline"
    assert report.modified_id == "pol-modified"
    
    metrics = report.metrics
    
    # Modified policy should have higher impact delta
    assert metrics.impact_delta > 0
    
    # Modified policy should have higher synergy delta
    assert metrics.synergy_delta > 0
    
    # Modified policy should have higher intelligence growth delta
    assert metrics.intelligence_growth_delta > 0
    
    # Modified policy stability might be slightly lower due to volatility of change, 
    # but based on the model, it might improve. 
    # In our case, the modified policy is clearly 'better' by design.
    assert metrics.calibration_stability_delta != 0
    
    # Entropy target was negative, so balance delta should be negative
    assert metrics.entropy_balance_delta < 0
    
    print("\nCounterfactual Policy Comparison successful:")
    print(f"Impact Delta: {metrics.impact_delta:.4f}")
    print(f"Synergy Delta: {metrics.synergy_delta:.4f}")
    print(f"Growth Delta: {metrics.intelligence_growth_delta:.4f}")
    print(f"Entropy Delta: {metrics.entropy_balance_delta:.4f}")

if __name__ == "__main__":
    pytest.main([__file__])

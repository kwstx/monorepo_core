import pytest
from simulation_layer.models.policy import PolicySchema, TransformationOperator
from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
from simulation_layer.models.intelligence_evolution_model import IntelligenceEvolutionModel, EvolutionMetrics

def test_intelligence_evolution_feedback_loop():
    # 1. Setup initial state with baseline synergy and calibration
    snapshot_data = {
        "simulation_id": "sim-evo-001",
        "capture_step": 0,
        "synergy_density_matrices": [
            {
                "matrix_id": "main_synergy",
                "row_labels": ("a1", "a2"),
                "col_labels": ("a1", "a2"),
                "values": ((1.0, 0.4), (0.4, 1.0))
            }
        ],
        "predictive_calibration_curves": [
            {
                "curve_id": "forecast_accuracy",
                "points": [
                    {"predicted": 0.8, "observed": 0.75},
                    {"predicted": 0.5, "observed": 0.45}
                ]
            }
        ]
    }
    snapshot = CooperativeStateSnapshot(**snapshot_data)
    
    # 2. Define a policy that incentivizes cooperation and stabilizes impact
    policy_data = {
        "policy_id": "pol-growth-001",
        "name": "Accelerated Intelligence Policy",
        "version": "1.0.0",
        "scope": {"agent_categories": ["learning_agents"]},
        "transformations": [
            {
                "metric_source": "capability",
                "operator": "multiply",
                "value": 1.25,
                "target_metric": "learning_incentive"
            }
        ],
        "affected_metrics": ["learning_velocity", "collective_iq"],
        "entropy_adjustments": {"shannon_entropy_target": -0.05}, # Decrease entropy to increase coordination
        "impact_modifiers": {"projected_real_world_impact": 1.1},
        "temporal_rules": {"persistence_mode": "sticky"}
    }
    policy = PolicySchema(**policy_data)
    
    # 3. Initialize Model
    model = IntelligenceEvolutionModel(snapshot, policy)
    
    # 4. Evolve for several steps
    steps = 10
    history = model.evolve(steps)
    
    assert len(history) == steps
    
    # Verify learning velocity growth
    last_step = history[-1]
    first_step = history[0]
    
    assert last_step.learning_velocity > 1.0
    assert last_step.learning_velocity > first_step.learning_velocity
    
    # Verify cooperative adaptation increases
    assert last_step.cooperative_adaptation > first_step.cooperative_adaptation
    
    # Verify projected impact scales with reinforced contributions
    assert last_step.projected_impact > first_step.projected_impact
    
    # Verify calibration stability trend
    assert last_step.calibration_stability >= first_step.calibration_stability

    print(f"\nEvolution Simulation Complete:")
    print(f"Final Learning Velocity: {last_step.learning_velocity:.4f}")
    print(f"Final Cooperative Adaptation: {last_step.cooperative_adaptation:.4f}")
    print(f"Final Projected Impact: {last_step.projected_impact:.4f}")

if __name__ == "__main__":
    test_intelligence_evolution_feedback_loop()

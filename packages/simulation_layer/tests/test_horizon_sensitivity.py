import pytest
from simulation_layer.simulation.horizon_sensitivity_engine import HorizonSensitivityEngine, HorizonType
from simulation_layer.models.policy import PolicySchema
from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot, TrustVector

def test_horizon_sensitivity_engine_evaluation():
    """
    Verifies that the HorizonSensitivityEngine correctly evaluates policy performance
    across short, mid, and long-term horizons, and computes composite resilience scores.
    """
    # 1. Setup a baseline cooperative state snapshot
    snapshot = CooperativeStateSnapshot(
        simulation_id="sim-horizon-001",
        capture_step=0,
        trust_vectors=(
            TrustVector(entity_id="node-alpha", values=(0.6, 0.4, 0.7)),
            TrustVector(entity_id="node-beta", values=(0.5, 0.5, 0.5)),
            TrustVector(entity_id="node-gamma", values=(0.3, 0.8, 0.2)),
            TrustVector(entity_id="node-delta", values=(0.7, 0.1, 0.9)),
        ),
        metadata={"environment": "production_simulation"}
    )
    
    # 2. Define a policy optimized for long-term cooperative growth (sticky persistence)
    long_term_policy = PolicySchema(
        policy_id="pol-sticky-growth-001",
        name="Cascading Downstream Synergy",
        scope={
            "agent_categories": ["core_cooperators"],
            "task_domains": ["strategic_alignment"]
        },
        transformations=[
            {
                "metric_source": "trust_coefficient",
                "operator": "multiply",
                "value": 1.05,
                "target_metric": "trust_weight"
            }
        ],
        affected_metrics=["synergy_density", "long_horizon_impact"],
        temporal_rules={
            "persistence_mode": "sticky",
            "auto_decay_coefficient": 0.01
        },
        impact_modifiers={
            "projected_real_world_impact": 1.2
        },
        entropy_adjustments={
            "shannon_entropy_target": -0.01 # Slight coordination pressure
        }
    )
    
    # 3. Initialize engine and execute analysis
    engine = HorizonSensitivityEngine(
        snapshot,
        short_horizon=10,
        mid_horizon=50,
        long_horizon=200
    )
    
    analysis = engine.evaluate_policy(long_term_policy)
    
    # 4. Assertions on the sensitivity analysis structure
    assert analysis.policy_id == long_term_policy.policy_id
    assert len(analysis.horizons) == 3
    
    # Check short-term
    short = analysis.horizons[HorizonType.SHORT_TERM]
    assert short.steps == 10
    assert short.avg_impact > 0
    
    # Check long-term
    long = analysis.horizons[HorizonType.LONG_TERM]
    assert long.steps == 200
    
    # Verify persistence and resilience calculation
    assert isinstance(analysis.impact_persistence_slope, float)
    assert 0.0 <= analysis.systemic_resilience_rating <= 1.0
    
    print(f"\nPolicy: {long_term_policy.name}")
    print(f"Impact Persistence Slope: {analysis.impact_persistence_slope:.4f}")
    print(f"Systemic Resilience Rating: {analysis.systemic_resilience_rating:.4f}")
    print(f"Long Horizon Viability: {analysis.long_horizon_viability}")
    
    for h_type, perf in analysis.horizons.items():
        print(f" - {h_type.value}: Impact={perf.avg_impact:.4f}, Resilience={perf.resilience_score:.4f}, Risks={perf.risk_factors}")

if __name__ == "__main__":
    test_horizon_sensitivity_engine_evaluation()
    print("\nTest completed successfully.")

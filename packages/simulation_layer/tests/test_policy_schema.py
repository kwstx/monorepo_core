import json
from simulation_layer.models.policy import PolicySchema, TransformationOperator

def test_policy_instantiation():
    policy_data = {
        "policy_id": "pol-exp-001",
        "name": "Entropy-Balanced Influence",
        "version": "1.0.1",
        "previous_version_id": "pol-exp-000",
        "scope": {
            "agent_categories": ["autonomous_agent"],
            "task_domains": ["resource_allocation"],
            "context_filters": {"region": "global"}
        },
        "constraints": [
            {
                "expression": "influence_variance < 0.2",
                "action": "scale"
            }
        ],
        "transformations": [
            {
                "metric_source": "centrality",
                "operator": "decay",
                "value": "exp(-0.1 * step)",
                "target_metric": "influence_cap"
            }
        ],
        "affected_metrics": ["influence_distribution", "system_stability"],
        "entropy_adjustments": {"target_entropy_delta": 0.05},
        "impact_modifiers": {"cooperative_efficiency": 0.95},
        "temporal_rules": {
            "duration_steps": 1000,
            "persistence_mode": "permanent"
        },
        "metadata": {
            "author_id": "evaluator_alpha",
            "rationale": "Prevent over-centralization of influence in early simulation phases."
        }
    }
    
    policy = PolicySchema(**policy_data)
    print(f"Successfully instantiated policy: {policy.name} (v{policy.version})")
    print(f"Traceability Check: Previous version was {policy.previous_version_id}")
    
    # Verify JSON serialization
    # print(policy.model_dump_json(indent=2))

if __name__ == "__main__":
    test_policy_instantiation()

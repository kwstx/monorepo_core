import sys
import os
import pytest
from fastapi.testclient import TestClient

# Setup path to include all modules
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.join(current_dir, '..')
sys.path.insert(0, root_dir)

# Add all sub-packages to path for discovery
sub_packages = [
    'autonomy_core',
    'autonomy_sdk',
    'autonomy_server',
    'packages/identity_system',
    'packages/enforcement_layer',
    'packages/economic_autonomy',
    'packages/a2a_coordination',
    'packages/scorring_module',
    'packages/simulation_layer',
    'packages/self_improvement_governance',
    'packages/actionable_logic',
    'packages/task_formation',
    'packages/shared_utils'
]

for pkg in sub_packages:
    sys.path.insert(0, os.path.join(root_dir, pkg))

def test_dependency_chain():
    """
    Verifies the full dependency chain:
    autonomy_server -> autonomy_sdk -> autonomy_core -> packages
    """
    from autonomy_server import app
    client = TestClient(app)
    
    # Check health
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
    
    # Check authorization (exercises full chain)
    payload = {
        "agent_id": "test_agent",
        "action": {"type": "test_action", "value": 100}
    }
    response = client.post("/authorize", json=payload)
    
    # We expect a 200 OK, result might be True or False depending on mock logic in packages
    # But the fact that it reaches here means the imports worked.
    assert response.status_code == 200
    assert "authorized" in response.json()
    print(f"Authorization result: {response.json()['authorized']}")

if __name__ == "__main__":
    test_dependency_chain()

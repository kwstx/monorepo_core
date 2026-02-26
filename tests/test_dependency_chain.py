import sys
import os
import pytest
from fastapi.testclient import TestClient

# The packages are now installed in editable mode via the root pyproject.toml,
# so we no longer need manual sys.path manipulation.


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
    assert response.json()["status"] == "healthy"

    # Register agent first
    reg_payload = {
        "agent_id": "test_agent",
        "attributes": {"test": True}
    }
    client.post("/register_agent", json=reg_payload)

    # Check authorization (exercises full chain)
    payload = {
        "agent_id": "test_agent",
        "action_id": "test_action_id_01",
        "action_type": "test_action",
        "payload": {"value": 100}
    }
    response = client.post("/authorize", json=payload)
    
    # We expect a 200 OK, result might be True or False depending on mock logic in packages
    # But the fact that it reaches here means the imports worked.
    if response.status_code != 200:
        print(f"Error {response.status_code}: {response.json()}")
    assert response.status_code == 200
    assert "authorized" in response.json()
    print(f"Authorization result: {response.json()['authorized']}")

if __name__ == "__main__":
    test_dependency_chain()

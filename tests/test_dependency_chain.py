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

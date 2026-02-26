from fastapi.testclient import TestClient
from autonomy_server.app import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_register_agent():
    response = client.post("/register_agent", json={"name": "test_agent", "metadata": {"role": "tester"}})
    assert response.status_code == 200
    assert "agent_id" in response.json()
    print(f"Registered agent ID: {response.json()['agent_id']}")

def test_authorize():
    # Registration
    reg_resp = client.post("/register_agent", json={"name": "test_agent"})
    agent_id = reg_resp.json()["agent_id"]
    
    # Authorization
    auth_resp = client.post("/authorize", json={
        "agent_id": agent_id,
        "action": {"type": "transfer", "amount": 100}
    })
    assert auth_resp.status_code == 200
    assert "authorized" in auth_resp.json()
    print(f"Authorization result: {auth_resp.json()['authorized']}")

if __name__ == "__main__":
    test_health()
    test_register_agent()
    test_authorize()
    print("All tests passed!")

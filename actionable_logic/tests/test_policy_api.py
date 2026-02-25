import pytest
import uuid
from fastapi.testclient import TestClient
from src.api.main import app
from src.models.policy_schema import StructuredPolicy, PolicyDomain, PolicyScope, LogicalCondition, ConditionOperator
@pytest.fixture
def client():
    return TestClient(app)

def test_api_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "PolicyAPI is live."

def test_push_and_query_policy(client):
    # 1. Push a policy
    policy_id = f"API-{uuid.uuid4()}"
    policy_data = {
        "policy_id": policy_id,
        "title": "API Managed Policy",
        "version": "1.0.0",
        "domain": "security",
        "scope": "global",
        "industry": "Tech",
        "raw_source": "All users must have MFA.",
        "rationale": "Base security",
        "instructions": ["Enable MFA"],
        "conditions": [
            {
                "parameter": "mfa_enabled",
                "operator": "==",
                "value": False
            }
        ]
    }
    response = client.post("/policies", json=policy_data)
    assert response.status_code == 201
    assert "policy_db_id" in response.json()

    # 2. Query policies
    response = client.get("/policies?industry=Tech")
    assert response.status_code == 200
    policies = response.json()
    assert len(policies) >= 1
    assert any(p["policy_id"] == policy_id for p in policies)

def test_simulation(client):
    policy_id = f"SIM-{uuid.uuid4()}"
    policy_data = {
        "policy_id": policy_id,
        "title": "High Trust Only",
        "version": "1.0.0",
        "domain": "cooperation",
        "scope": "global",
        "raw_source": "Trust must be above 0.8",
        "rationale": "High trust environments",
        "instructions": ["Allow interaction"],
        "conditions": [
            {
                "parameter": "trust_score",
                "operator": ">",
                "value": 0.8
            }
        ]
    }
    
    # Simulate with matching state
    sim_request = {
        "policy": policy_data,
        "test_state": {"trust_score": 0.95},
        "context": {"agent_id": "agent-A"}
    }
    response = client.post("/simulate", json=sim_request)
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is True
    assert "ACTIVATED" in data["causal_explanation"]
    assert data["impact_analysis"]["restricts_action"] is False

    # Simulate with non-matching state
    sim_request["test_state"] = {"trust_score": 0.5}
    response = client.post("/simulate", json=sim_request)
    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False
    assert "INACTIVE" in data["causal_explanation"]

def test_check_action(client):
    # This requires a policy to be in the repo for the mock seeder
    policy_id = f"GUARD-{uuid.uuid4()}"
    policy_data = {
        "policy_id": policy_id,
        "title": "Guardrail Test",
        "version": "1.0.0",
        "domain": "security",
        "scope": "global",
        "raw_source": "...",
        "rationale": "...",
        "instructions": ["Block high risk"],
        "conditions": [{"parameter": "risk_level", "operator": "==", "value": "high"}]
    }
    client.post("/policies", json=policy_data)

    action_request = {
        "agent_id": "agent-1",
        "action": {"risk_level": "high"},
        "context": {}
    }
    response = client.post("/check-action", json=action_request)
    assert response.status_code == 200
    data = response.json()
    # It should be escalated because it's a security domain violation
    assert data["action"] == "escalate"
    assert "security" in data["reason"].lower()

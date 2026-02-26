import uuid
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Query
from actionable_logic.models.policy_schema import StructuredPolicy
from actionable_logic.repository.policy_repository import PolicyRepository
from actionable_logic.version_control.engine import VersionControlEngine
from actionable_logic.enforcement.engine import PolicyEnforcer
from actionable_logic.enforcement.guardrails import AdaptiveGuardrailsEngine
from src.models import SimulationRequest, SimulationResponse, ActionCheckRequest, ComplianceTrace

app = FastAPI(
    title="PolicyAPI",
    description="External interface for querying, pushing, and simulating policies within the Actionable Logic framework.",
    version="1.0.0"
)

# Shared components
# In a real app, these would be managed via dependency injection or a global state
repo = PolicyRepository()
vc_engine = VersionControlEngine()
guardrails = AdaptiveGuardrailsEngine()

@app.get("/")
async def root():
    return {"message": "PolicyAPI is live.", "status": "running"}

# --- Policy Repository Endpoints ---

@app.get("/policies", response_model=List[StructuredPolicy])
async def list_policies(
    industry: Optional[str] = None,
    compliance_type: Optional[str] = None,
    functional_area: Optional[str] = None,
    is_template: Optional[bool] = None
):
    """Query the repository for policies."""
    try:
        policies = repo.list_policies(
            industry=industry,
            compliance_type=compliance_type,
            functional_area=functional_area,
            is_template=is_template
        )
        return policies
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/policies", status_code=201)
async def create_policy(policy: StructuredPolicy):
    """Push a new policy to the repository."""
    try:
        policy_id = repo.save_policy(policy)
        return {"policy_db_id": policy_id, "status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/policies/{policy_id}", response_model=StructuredPolicy)
async def get_policy(policy_id: str, version: Optional[str] = None):
    """Retrieve a specific policy version."""
    policy = repo.get_policy(policy_id, version)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy

# --- Compliance & Audit Endpoints ---

@app.get("/compliance/traces/{agent_id}", response_model=List[ComplianceTrace])
async def get_compliance_traces(agent_id: str):
    """Retrieve compliance traces for a specific agent."""
    try:
        traces = vc_engine.list_agent_policy_compliance(agent_id)
        return [ComplianceTrace(**t, agent_id=agent_id) for t in traces]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/audit/{policy_id}")
async def get_audit_trail(policy_id: str):
    """Get the complete historical audit trail of deployments for a policy."""
    try:
        return vc_engine.get_audit_trail(policy_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Simulation & Hypotheticals ---

@app.post("/simulate", response_model=SimulationResponse)
async def simulate_policy_change(request: SimulationRequest):
    """
    Simulates a hypothetical policy change against a provided system state.
    Provides structured logic evaluation and causal explanations.
    """
    enforcer = PolicyEnforcer([request.policy])
    results = enforcer.evaluate(request.test_state, request.context)
    
    if not results:
         raise HTTPException(status_code=500, detail="Simulation failed to produce results.")
    
    result = results[0]
    
    # Generate causal explanation
    status = result.metadata.get("status", "unknown")
    if status == "active":
        explanation = f"Policy '{request.policy.title}' was ACTIVATED because all conditions were met."
        if request.policy.conditions:
            conds = [f"{c.parameter} {c.operator.value} {c.value}" for c in request.policy.conditions]
            explanation += f" Matched conditions: {', '.join(conds)}."
    else:
        explanation = f"Policy '{request.policy.title}' remained INACTIVE because one or more conditions were not met."
    
    # Simple impact analysis
    impact = {
        "restricts_action": not result.is_allowed,
        "trigger_count": len(result.triggered_actions),
        "instruction_count": len(result.instructions),
        "domain_impact": request.policy.domain.value
    }
    
    return SimulationResponse(
        is_active=(status == "active"),
        triggered_actions=[t.model_dump() for t in result.triggered_actions],
        instructions=result.instructions,
        causal_explanation=explanation,
        impact_analysis=impact
    )

# --- Integration Hooks for Live Agents ---

@app.post("/check-action")
async def check_agent_action(request: ActionCheckRequest):
    """
    Integration hook for live agents to check if a proposed action adheres to active policies.
    Returns adaptive guardrail responses.
    """
    try:
        # Note: In a real distributed system, we would load active policies into guardrails
        # from the database or a cache. For this demo, we assume guardrails is initialized.
        # Let's ensure it has the latest production policies.
        # (This is a simplified sync for the demo)
        
        # We'll mock loading policies for the demo if guardrails is empty
        if not guardrails.list_active_policies():
            # Seed with some policies from repo
            all_policies = repo.list_policies()
            for p in all_policies:
                guardrails.apply_policy_update(p)

        response = guardrails.monitor_action(request.agent_id, request.action)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

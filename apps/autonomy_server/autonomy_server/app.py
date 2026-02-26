from fastapi import FastAPI, HTTPException
from typing import Optional, Dict, Any
from autonomy_core import AutonomyCore
from autonomy_core.schemas.models import (
    AgentRegistrationRequest, ActionAuthorizationRequest
)

app = FastAPI(
    title="Autonomy Server",
    description="HTTP interface for the Autonomy Core Engine",
    version="0.1.0"
)

# Instantiate AutonomyCore as requested
from identity_system import IdentitySystem
from enforcement_layer import EnforcementLayer
from economic_autonomy import EconomicAutonomy
from a2a_coordination import A2ACoordination
from scorring_module import ScoringModule
from simulation_layer import SimulationLayer
from self_improvement_governance import GovernanceModule

core = AutonomyCore(
    identity=IdentitySystem(),
    enforcement=EnforcementLayer(),
    economic=EconomicAutonomy(),
    coordination=A2ACoordination(),
    scoring=ScoringModule(),
    simulation=SimulationLayer(),
    governance=GovernanceModule()
)

@app.post("/authorize")
async def authorize(request: ActionAuthorizationRequest):
    """
    Authorizes an action for a specific agent by orchestrating via AutonomyCore.
    """
    try:
        response = await core.authorize_action(request)
        return {"authorized": response.is_authorized, "reason": response.reason}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/register_agent")
async def register_agent(request: AgentRegistrationRequest):
    """
    Registers a new agent in the system using AutonomyCore.
    """
    try:
        agent_id = await core.register_agent(request)
        return {"agent_id": agent_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    """
    Basic health check endpoint.
    """
    return {"status": "healthy", "version": "0.1.0"}

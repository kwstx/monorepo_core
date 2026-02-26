from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from autonomy_core import AutonomyCore

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

class AuthRequest(BaseModel):
    agent_id: str
    action: Dict[str, Any]

class RegisterRequest(BaseModel):
    name: str
    metadata: Optional[Dict[str, Any]] = None

@app.post("/authorize")
async def authorize(request: AuthRequest):
    """
    Authorizes an action for a specific agent by orchestrating via AutonomyCore.
    """
    try:
        is_authorized = await core.authorize_action(request.agent_id, request.action)
        return {"authorized": is_authorized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/register_agent")
async def register_agent(request: RegisterRequest):
    """
    Registers a new agent in the system using AutonomyCore.
    """
    try:
        agent_info = {"name": request.name, "metadata": request.metadata or {}}
        agent_id = await core.register_agent(agent_info)
        return {"agent_id": agent_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    """
    Basic health check endpoint.
    """
    return {"status": "healthy", "version": "0.1.0"}

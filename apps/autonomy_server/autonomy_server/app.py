from fastapi import FastAPI, HTTPException, Header, Request, Depends
from fastapi.routing import APIRouter
from autonomy_core import AutonomyConfig, AutonomyContainer
from autonomy_core.schemas.models import (
    AgentRegistrationRequest, ActionAuthorizationRequest
)
from typing import Optional

app = FastAPI(
    title="Autonomy Server",
    description="HTTP interface for the Autonomy Core Engine",
    version="0.1.0"
)

core = AutonomyContainer(AutonomyConfig()).build_core()

# Create a v1 router
v1_router = APIRouter(prefix="/v1")

async def process_authorize(request: ActionAuthorizationRequest, api_version: str):
    try:
        response = await core.authorize_action(request)
        return {"authorized": response.is_authorized, "reason": response.reason, "api_version": api_version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def process_register(request: AgentRegistrationRequest, api_version: str):
    try:
        agent_id = await core.register_agent(request)
        return {"agent_id": agent_id, "api_version": api_version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@v1_router.post("/authorize")
async def authorize_v1(request: ActionAuthorizationRequest):
    return await process_authorize(request, "v1")

@v1_router.post("/register_agent")
async def register_agent_v1(request: AgentRegistrationRequest):
    return await process_register(request, "v1")

# Backward compatible endpoints
@app.post("/authorize")
async def authorize(request: ActionAuthorizationRequest, x_api_version: Optional[str] = Header("v1")):
    """
    Authorizes an action for a specific agent by orchestrating via AutonomyCore.
    """
    return await process_authorize(request, x_api_version)

@app.post("/register_agent")
async def register_agent(request: AgentRegistrationRequest, x_api_version: Optional[str] = Header("v1")):
    """
    Registers a new agent in the system using AutonomyCore.
    """
    return await process_register(request, x_api_version)

@app.get("/health")
async def health(x_api_version: Optional[str] = Header("v1")):
    """
    Basic health check endpoint.
    """
    return {"status": "healthy", "version": "0.1.0", "api_version": x_api_version}

app.include_router(v1_router)

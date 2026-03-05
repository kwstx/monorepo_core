from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, Request

from autonomy_core.schemas.models import ActionAuthorizationRequest, SimulationRequest
from enforcement_layer import EnforcementLayer
from identity_system import IdentitySystem
from simulation_layer import SimulationLayer

from .models import ActionRequest, ActionResponse


SAFETY_TIMEOUT_SECONDS = 0.5
TIMEOUT_REASON = "Safety check timed out after 500ms"
HIGH_RISK_ACTION_TYPES = {
    "transfer",
    "transfer_funds",
    "wire_transfer",
    "execute_code",
    "resource_deletion",
    "policy_override",
}


def _timeout_decision(action_type: str) -> str:
    if action_type in HIGH_RISK_ACTION_TYPES:
        return "HUMAN_REQUIRED"
    return "SOFT_BLOCK"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.identity = IdentitySystem()
    app.state.enforcement = EnforcementLayer()
    app.state.simulation = SimulationLayer()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Gateway Service",
        description="Single entry point for external agents",
        version="0.1.0",
        lifespan=lifespan,
    )

    def get_identity(request: Request) -> IdentitySystem:
        return request.app.state.identity

    def get_enforcement(request: Request) -> EnforcementLayer:
        return request.app.state.enforcement

    def get_simulation(request: Request) -> SimulationLayer:
        return request.app.state.simulation

    async def process_action(
        request_model: ActionRequest,
        _api_version: str,
        identity: IdentitySystem,
        enforcement: EnforcementLayer,
        simulation: SimulationLayer,
    ) -> ActionResponse:
        identity_result = await identity.verify(request_model.agent_id)
        if not identity_result.is_valid:
            return ActionResponse(
                decision="DENIED",
                reason=identity_result.reason or "Identity verification failed",
                identity_valid=False,
            )

        auth_request = ActionAuthorizationRequest(
            agent_id=request_model.agent_id,
            action_id=request_model.action_id,
            action_type=request_model.action_type,
            payload=request_model.payload,
        )
        try:
            enforcement_result = await asyncio.wait_for(
                enforcement.validate(auth_request),
                timeout=SAFETY_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            return ActionResponse(
                decision=_timeout_decision(request_model.action_type),
                reason=TIMEOUT_REASON,
                identity_valid=True,
                enforcement_authorized=None,
            )

        if not enforcement_result.is_authorized:
            return ActionResponse(
                decision="SOFT_BLOCK",
                reason=enforcement_result.reason or "Action blocked by enforcement policy",
                identity_valid=True,
                enforcement_authorized=False,
            )

        sim_request = SimulationRequest(
            agent_id=request_model.agent_id,
            action_type=request_model.action_type,
            payload=request_model.payload,
        )
        simulation_result = await simulation.predict_impact(sim_request)
        return ActionResponse(
            decision="APPROVED",
            reason="Action approved",
            identity_valid=True,
            enforcement_authorized=True,
            impact_score=simulation_result.impact_score,
        )

    @app.post("/v1/action", response_model=ActionResponse)
    async def handle_action_v1(
        request_model: ActionRequest,
        identity: IdentitySystem = Depends(get_identity),
        enforcement: EnforcementLayer = Depends(get_enforcement),
        simulation: SimulationLayer = Depends(get_simulation),
    ):
        return await process_action(request_model, "v1", identity, enforcement, simulation)

    @app.post("/action", response_model=ActionResponse)
    async def handle_action(
        request_model: ActionRequest,
        x_api_version: Optional[str] = Header("v1"),
        identity: IdentitySystem = Depends(get_identity),
        enforcement: EnforcementLayer = Depends(get_enforcement),
        simulation: SimulationLayer = Depends(get_simulation),
    ):
        return await process_action(request_model, x_api_version or "v1", identity, enforcement, simulation)

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    return app


app = create_app()

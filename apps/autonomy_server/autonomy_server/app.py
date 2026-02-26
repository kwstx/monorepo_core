from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, Request
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter

from autonomy_core import AutonomyConfig, AutonomyContainer, AutonomyCore
from autonomy_core.exceptions import (
    AutonomyException,
    BudgetViolationError,
    EnforcementError,
    GovernanceRejectionError,
    IdentityError,
    SimulationFailure,
)
from autonomy_core.schemas.models import ActionAuthorizationRequest, AgentRegistrationRequest


logger = logging.getLogger("autonomy_server")


def _error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "request_id": request_id,
            }
        },
    )


def _exception_mapping(exc: AutonomyException) -> tuple[int, str]:
    if isinstance(exc, IdentityError):
        return 401, "identity_error"
    if isinstance(exc, EnforcementError):
        return 403, "enforcement_error"
    if isinstance(exc, BudgetViolationError):
        return 402, "budget_violation"
    if isinstance(exc, GovernanceRejectionError):
        return 422, "governance_rejection"
    if isinstance(exc, SimulationFailure):
        return 503, "simulation_failure"
    return 500, "autonomy_error"


@asynccontextmanager
async def lifespan(app: FastAPI):
    container = AutonomyContainer(AutonomyConfig())
    app.state.container = container
    app.state.core = container.build_core()
    logger.info("autonomy_server_started", extra={"event": "startup"})
    yield
    logger.info("autonomy_server_stopped", extra={"event": "shutdown"})


def get_core(request: Request) -> AutonomyCore:
    if not hasattr(request.app.state, "core"):
        container = AutonomyContainer(AutonomyConfig())
        request.app.state.container = container
        request.app.state.core = container.build_core()
    return request.app.state.core


def create_app() -> FastAPI:
    app = FastAPI(
        title="Autonomy Server",
        description="HTTP interface for the Autonomy Core Engine",
        version="0.1.0",
        lifespan=lifespan,
    )

    v1_router = APIRouter(prefix="/v1")

    @app.middleware("http")
    async def structured_logging(request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        request.state.request_id = request_id
        started = time.perf_counter()
        logger.info(
            "http_request_in",
            extra={
                "event": "request_in",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else None,
            },
        )
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["x-request-id"] = request_id
        logger.info(
            "http_request_out",
            extra={
                "event": "request_out",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    @app.exception_handler(AutonomyException)
    async def autonomy_exception_handler(request: Request, exc: AutonomyException):
        status_code, code = _exception_mapping(exc)
        return _error_response(request, status_code, code, str(exc))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("unhandled_exception", extra={"event": "unhandled_exception"})
        return _error_response(request, 500, "internal_server_error", "Internal server error")

    async def process_authorize(
        request_model: ActionAuthorizationRequest,
        api_version: str,
        core: AutonomyCore,
    ) -> dict[str, Any]:
        result = await core.authorize_action(request_model)
        return {
            "authorized": result.is_authorized,
            "reason": result.reason,
            "api_version": api_version,
        }

    async def process_register(
        request_model: AgentRegistrationRequest,
        api_version: str,
        core: AutonomyCore,
    ) -> dict[str, Any]:
        agent_id = await core.register_agent(request_model)
        return {"agent_id": agent_id, "api_version": api_version}

    @v1_router.post("/authorize")
    async def authorize_v1(
        request_model: ActionAuthorizationRequest,
        core: AutonomyCore = Depends(get_core),
    ):
        return await process_authorize(request_model, "v1", core)

    @v1_router.post("/register_agent")
    async def register_agent_v1(
        request_model: AgentRegistrationRequest,
        core: AutonomyCore = Depends(get_core),
    ):
        return await process_register(request_model, "v1", core)

    @app.post("/authorize")
    async def authorize(
        request_model: ActionAuthorizationRequest,
        x_api_version: Optional[str] = Header("v1"),
        core: AutonomyCore = Depends(get_core),
    ):
        return await process_authorize(request_model, x_api_version, core)

    @app.post("/register_agent")
    async def register_agent(
        request_model: AgentRegistrationRequest,
        x_api_version: Optional[str] = Header("v1"),
        core: AutonomyCore = Depends(get_core),
    ):
        return await process_register(request_model, x_api_version, core)

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    app.include_router(v1_router)
    return app


app = create_app()

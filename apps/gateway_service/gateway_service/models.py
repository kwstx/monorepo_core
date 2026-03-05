from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


GatewayDecision = Literal["APPROVED", "SOFT_BLOCK", "HUMAN_REQUIRED", "DENIED"]


class ActionRequest(BaseModel):
    agent_id: str
    action_id: str
    action_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class ActionResponse(BaseModel):
    decision: GatewayDecision
    reason: str
    identity_valid: bool
    enforcement_authorized: Optional[bool] = None
    impact_score: Optional[float] = None

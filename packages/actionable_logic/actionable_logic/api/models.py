from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from src.models.policy_schema import StructuredPolicy, PolicyDomain, PolicyScope

class SimulationRequest(BaseModel):
    policy: StructuredPolicy = Field(..., description="The policy to simulate.")
    test_state: Dict[str, Any] = Field(..., description="The system state to test against.")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional context for simulation.")

class SimulationResponse(BaseModel):
    is_active: bool
    triggered_actions: List[Dict[str, Any]]
    instructions: List[str]
    causal_explanation: str
    impact_analysis: Dict[str, Any]

class ActionCheckRequest(BaseModel):
    agent_id: str
    action: Dict[str, Any]
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ComplianceTrace(BaseModel):
    agent_id: str
    policy_id: str
    version: str
    adopted_at: str
    compliance_score: Optional[Dict[str, Any]]

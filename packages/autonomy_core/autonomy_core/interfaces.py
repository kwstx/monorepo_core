from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import Any, Dict, Optional, List

# ====== Models ====== #

class AgentIdentity(BaseModel):
    agent_id: str
    name: Optional[str] = None
    attributes: Dict[str, Any] = {}

class VerificationResult(BaseModel):
    is_valid: bool
    reason: Optional[str] = None

class ActionRequest(BaseModel):
    agent_id: str
    action_type: str
    payload: Dict[str, Any] = {}

class ValidationResult(BaseModel):
    is_allowed: bool
    reason: Optional[str] = None

class FundCheckResult(BaseModel):
    has_funds: bool
    balance: Optional[float] = None

class SimulationResult(BaseModel):
    impact_score: float
    details: Dict[str, Any] = {}

class ScoringResult(BaseModel):
    action_score: float
    threshold_met: bool

class CoordinationMessage(BaseModel):
    sender_id: str
    action: ActionRequest
    recipients: Optional[List[str]] = None

class CoordinationResult(BaseModel):
    success: bool
    nodes_notified: int

class GovernanceRecord(BaseModel):
    agent_id: str
    action: ActionRequest
    action_score: float
    timestamp: Optional[str] = None

class GovernanceResult(BaseModel):
    recorded: bool
    record_id: Optional[str] = None

class TaskProposal(BaseModel):
    task_id: str
    description: str
    required_capabilities: List[str] = []

class TaskFormationResult(BaseModel):
    formed: bool
    assigned_agents: List[str] = []

class RegistrationResult(BaseModel):
    agent_id: str
    success: bool

class ChangeProposal(BaseModel):
    proposer_id: str
    changes: Dict[str, Any]

class ProposalResult(BaseModel):
    accepted: bool
    proposal_id: Optional[str] = None

# ====== Interfaces ====== #

class IdentityProvider(ABC):
    @abstractmethod
    async def verify(self, agent_id: str) -> VerificationResult:
        pass
        
    @abstractmethod
    async def register(self, agent: AgentIdentity) -> RegistrationResult:
        pass


class EnforcementEngine(ABC):
    @abstractmethod
    async def validate(self, action: ActionRequest) -> ValidationResult:
        pass


class EconomicPolicyEngine(ABC):
    @abstractmethod
    async def has_funds(self, agent_id: str, action: ActionRequest) -> FundCheckResult:
        pass


class SimulationEngine(ABC):
    @abstractmethod
    async def predict_impact(self, agent_id: str, action: ActionRequest) -> SimulationResult:
        pass


class ScoringEngine(ABC):
    @abstractmethod
    async def calculate_score(self, action: ActionRequest, impact_score: float) -> ScoringResult:
        pass


class CoordinationEngine(ABC):
    @abstractmethod
    async def notify_peers(self, message: CoordinationMessage) -> CoordinationResult:
        pass


class GovernanceEngine(ABC):
    @abstractmethod
    async def record_action(self, record: GovernanceRecord) -> GovernanceResult:
        pass

    @abstractmethod
    async def submit_proposal(self, agent_id: str, proposal: ChangeProposal) -> ProposalResult:
        pass


class TaskFormationEngine(ABC):
    @abstractmethod
    async def form_task(self, proposal: TaskProposal) -> TaskFormationResult:
        pass

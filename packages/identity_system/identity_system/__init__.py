import logging
from autonomy_core.interfaces import IdentityProvider, VerificationResult, AgentRegistrationRequest, AgentRegistrationResponse
from autonomy_core.state import StateStore
from typing import Optional

class IdentitySystem(IdentityProvider):
    """Python bridge for the Identity System Node.js backend."""
    def __init__(self, state_store: Optional[StateStore] = None):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.state_store = state_store

    async def verify(self, agent_id: str) -> VerificationResult:
        self.logger.info(f"Verifying identity for {agent_id} via TS implementation.")
        if self.state_store:
            agent = await self.state_store.get_agent(agent_id)
            if not agent:
                return VerificationResult(is_valid=False)
        return VerificationResult(is_valid=True)

    async def register(self, request: AgentRegistrationRequest) -> AgentRegistrationResponse:
        self.logger.info(f"Registering {request.agent_id} via TS implementation.")
        if self.state_store:
            agent_data = getattr(request, "model_dump", lambda: request.__dict__)()
            await self.state_store.save_agent(request.agent_id, agent_data)
        return AgentRegistrationResponse(agent_id=request.agent_id, success=True)

__version__ = "0.1.0"

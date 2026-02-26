import logging
from autonomy_core.interfaces import GovernanceEngine, GovernanceRecord, GovernanceResult, GovernanceProposalRequest, GovernanceProposalResponse
from autonomy_core.state import StateStore
from typing import Optional

class GovernanceModule(GovernanceEngine):
    """Python bridge for Governance Node.js backend."""
    def __init__(self, state_store: Optional[StateStore] = None):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.state_store = state_store

    async def record_action(self, record: GovernanceRecord) -> GovernanceResult:
        self.logger.info(f"Recording systemic action for adaptive governance loop.")
        if self.state_store:
            rec_data = getattr(record, "model_dump", lambda: record.__dict__)()
            await self.state_store.save_decision(f"gov_action_{id(record)}", rec_data)
        return GovernanceResult(recorded=True, record_id="rec_1")

    async def submit_proposal(self, request: GovernanceProposalRequest) -> GovernanceProposalResponse:
        self.logger.info(f"Submitting proposal from {request.proposer_id} to governance loop.")
        if self.state_store:
            prop_data = getattr(request, "model_dump", lambda: request.__dict__)()
            await self.state_store.save_proposal(f"gov_prop_{id(request)}", prop_data)
        return GovernanceProposalResponse(accepted=True, proposal_id="prop_1")

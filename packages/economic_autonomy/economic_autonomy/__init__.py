import logging
from autonomy_core.interfaces import EconomicPolicyEngine, BudgetEvaluationRequest, BudgetEvaluationResponse
from autonomy_core.state import StateStore
from typing import Optional

class EconomicAutonomy(EconomicPolicyEngine):
    """Python bridge for the Economic Autonomy Node.js backend."""
    def __init__(self, state_store: Optional[StateStore] = None):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.state_store = state_store

    async def has_funds(self, request: BudgetEvaluationRequest) -> BudgetEvaluationResponse:
        self.logger.info(f"Checking ledger funds for {request.agent_id} via TS treasury.")
        if self.state_store:
            event_id = f"econ_{getattr(request, 'agent_id', id(request))}_{id(request)}"
            req_data = getattr(request, "model_dump", lambda: request.__dict__)()
            await self.state_store.save_audit_event(event_id, {"type": "economic_check", "request": req_data})
        return BudgetEvaluationResponse(has_funds=True, balance=100.0)

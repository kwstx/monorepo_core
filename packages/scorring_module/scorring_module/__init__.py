import logging
from autonomy_core.interfaces import ScoringEngine, ActionAuthorizationRequest, ScoringResult
from autonomy_core.state import StateStore
from typing import Optional

class ScoringModule(ScoringEngine):
    """Python bridge for the Scoring Module Node.js backend."""
    def __init__(self, state_store: Optional[StateStore] = None):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.state_store = state_store

    async def calculate_score(self, action: ActionAuthorizationRequest, impact_score: float) -> ScoringResult:
        action_score = 0.8 + impact_score
        self.logger.info(f"Calculating dynamic action score via TS implementation: {action_score}")
        if self.state_store:
            event_id = f"score_{id(action)}"
            req_data = getattr(action, "model_dump", lambda: action.__dict__)()
            await self.state_store.save_audit_event(event_id, {"type": "score_calculation", "score": action_score, "request": req_data})
        return ScoringResult(action_score=action_score, threshold_met=action_score >= 0.0)

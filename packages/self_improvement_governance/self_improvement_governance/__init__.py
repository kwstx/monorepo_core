import logging

class GovernanceModule:
    """Python bridge for the Governance Module Node.js backend."""
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    def record_action(self, agent_id: str, action: dict, score: float) -> None:
        self.logger.info(f"Recording final action {action} and score {score} for {agent_id}.")

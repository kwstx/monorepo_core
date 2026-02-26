import logging
from autonomy_core.interfaces import TaskFormationEngine, TaskProposal, TaskFormationResult
from autonomy_core.state import StateStore
from typing import Optional

class TaskFormation(TaskFormationEngine):
    """Python bridge for Task Formation."""
    def __init__(self, state_store: Optional[StateStore] = None):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.state_store = state_store

    async def form_task(self, proposal: TaskProposal) -> TaskFormationResult:
        self.logger.info(f"Forming task {proposal.task_id}")
        if self.state_store:
            prop_data = getattr(proposal, "model_dump", lambda: proposal.__dict__)()
            await self.state_store.save_proposal(proposal.task_id, prop_data)
        return TaskFormationResult(formed=True, assigned_agents=[])

__version__ = "0.1.0"

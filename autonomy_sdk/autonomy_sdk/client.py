from autonomy_core import AutonomyCore
from typing import Optional, Dict, Any

class AutonomyClient:
    """
    The main entry point for external developers to interact with the Autonomy System.
    Wraps AutonomyCore to hide internal complexity and expose high-level orchestration.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self._core = AutonomyCore()
        self.config = config or {}

    def authorize(self, agent_id: str, action: Dict[str, Any]) -> bool:
        """
        Check if an agent is authorized to perform a specific action.
        This triggers a full orchestration of identity, enforcement, economics, scoring, and simulation.
        """
        return self._core.authorize_action(agent_id, action)

    def register_agent(self, agent_name: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Register a new agent in the system.
        Returns the unique agent ID.
        """
        agent_info = {"name": agent_name, "metadata": metadata or {}}
        return self._core.register_agent(agent_info)

    def propose_change(self, agent_id: str, change_description: str, target: str) -> bool:
        """
        Propose a change to the system governance or configuration.
        """
        change_request = {
            "description": change_description,
            "target": target
        }
        return self._core.propose_change(agent_id, change_request)

    def get_system_status(self) -> Dict[str, Any]:
        """
        Returns a high-level status of the autonomy system.
        """
        return {
            "status": "active",
            "version": "1.0.0",
            "connected": True
        }

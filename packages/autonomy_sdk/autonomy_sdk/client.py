from autonomy_core import AutonomyCore
from typing import Optional, Dict, Any

class AutonomyClient:
    """
    The main entry point for external developers to interact with the Autonomy System.
    Wraps AutonomyCore to hide internal complexity and expose high-level orchestration.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        from identity_system import IdentitySystem
        from enforcement_layer import EnforcementLayer
        from economic_autonomy import EconomicAutonomy
        from a2a_coordination import A2ACoordination
        from scorring_module import ScoringModule
        from simulation_layer import SimulationLayer
        from self_improvement_governance import GovernanceModule
        
        self._core = AutonomyCore(
            identity=IdentitySystem(),
            enforcement=EnforcementLayer(),
            economic=EconomicAutonomy(),
            coordination=A2ACoordination(),
            scoring=ScoringModule(),
            simulation=SimulationLayer(),
            governance=GovernanceModule()
        )
        self.config = config or {}

    async def authorize(self, agent_id: str, action: Dict[str, Any]) -> bool:
        """
        Check if an agent is authorized to perform a specific action.
        This triggers a full orchestration of identity, enforcement, economics, scoring, and simulation.
        """
        return await self._core.authorize_action(agent_id, action)

    async def register_agent(self, agent_name: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Register a new agent in the system.
        Returns the unique agent ID.
        """
        agent_info = {"name": agent_name, "metadata": metadata or {}}
        return await self._core.register_agent(agent_info)

    async def propose_change(self, agent_id: str, change_description: str, target: str) -> bool:
        """
        Propose a change to the system governance or configuration.
        """
        change_request = {
            "description": change_description,
            "target": target
        }
        return await self._core.propose_change(agent_id, change_request)

    def get_system_status(self) -> Dict[str, Any]:
        """
        Returns a high-level status of the autonomy system.
        """
        return {
            "status": "active",
            "version": "1.0.0",
            "connected": True
        }

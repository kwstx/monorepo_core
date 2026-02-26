from autonomy_core import AutonomyConfig, AutonomyContainer, AutonomyCore
from autonomy_core.schemas.models import (
    AgentRegistrationRequest, ActionAuthorizationRequest, GovernanceProposalRequest
)
from typing import Optional, Dict, Any

class AutonomyClient:
    """
    The main entry point for external developers to interact with the Autonomy System.
    Wraps AutonomyCore to hide internal complexity and expose high-level orchestration.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        container = AutonomyContainer(_to_autonomy_config(self.config))
        self._core: AutonomyCore = container.build_core()

    async def authorize(self, request: ActionAuthorizationRequest) -> bool:
        """
        Check if an agent is authorized to perform a specific action.
        This triggers a full orchestration of identity, enforcement, economics, scoring, and simulation.
        """
        response = await self._core.authorize_action(request)
        return response.is_authorized

    def authorize_sync(self, request: ActionAuthorizationRequest) -> bool:
        """Synchronous wrapper for authorize."""
        import asyncio
        return asyncio.run(self.authorize(request))

    async def register_agent(self, request: AgentRegistrationRequest) -> str:
        """
        Register a new agent in the system.
        Returns the unique agent ID.
        """
        return await self._core.register_agent(request)

    def register_agent_sync(self, request: AgentRegistrationRequest) -> str:
        """Synchronous wrapper for register_agent."""
        import asyncio
        return asyncio.run(self.register_agent(request))

    async def propose_change(self, request: GovernanceProposalRequest) -> bool:
        """
        Propose a change to the system governance or configuration.
        """
        return await self._core.propose_change(request)

    def propose_change_sync(self, request: GovernanceProposalRequest) -> bool:
        """Synchronous wrapper for propose_change."""
        import asyncio
        return asyncio.run(self.propose_change(request))

    def get_system_status(self) -> Dict[str, Any]:
        """
        Returns a high-level status of the autonomy system.
        """
        return {
            "status": "active",
            "version": "1.0.0",
            "connected": True
        }


def _to_autonomy_config(config: Dict[str, Any]) -> AutonomyConfig:
    if not config:
        return AutonomyConfig()
    defaults = AutonomyConfig()
    return AutonomyConfig(
        risk_thresholds=config.get("risk_thresholds", defaults.risk_thresholds),
        budget_limits=config.get("budget_limits", defaults.budget_limits),
        governance_rules=config.get("governance_rules", defaults.governance_rules),
        enabled_modules=config.get("enabled_modules", defaults.enabled_modules),
        state_backend=config.get("state_backend", defaults.state_backend),
        implementations=config.get("implementations", defaults.implementations),
        module_options=config.get("module_options", defaults.module_options),
    )

"""
Autonomy Core Engine
Orchestrates the various subsystems using their defined interfaces.
"""

import logging
from .interfaces import (
    IdentityProvider, EnforcementEngine, EconomicPolicyEngine,
    CoordinationEngine, ScoringEngine, SimulationEngine, GovernanceEngine,
    TaskFormationEngine,
    ActionRequest, CoordinationMessage, GovernanceRecord, AgentIdentity, ChangeProposal
)

class AutonomyCore:
    def __init__(self,
                 identity: IdentityProvider,
                 enforcement: EnforcementEngine,
                 economic: EconomicPolicyEngine,
                 coordination: CoordinationEngine,
                 scoring: ScoringEngine,
                 simulation: SimulationEngine,
                 governance: GovernanceEngine,
                 task_formation: TaskFormationEngine = None):
        """
        Initializes the core with interface implementations.
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        
        self.identity = identity
        self.enforcement = enforcement
        self.economic = economic
        self.coordination = coordination
        self.scoring = scoring
        self.simulation = simulation
        self.governance = governance
        self.task_formation = task_formation

    async def authorize_action(self, agent_id: str, action: dict) -> bool:
        """
        Orchestrates multiple components to determine if an action should proceed.
        """
        self.logger.info(f"Authorizing action {action} for agent {agent_id}")
        
        action_req = ActionRequest(agent_id=agent_id, action_type=action.get("type", "unknown"), payload=action)

        # 1. Identity Check
        id_res = await self.identity.verify(agent_id)
        if not id_res.is_valid:
            self.logger.warning(f"Identity verification failed for {agent_id}.")
            return False

        # 2. Guardrails / Enforcement Check
        enf_res = await self.enforcement.validate(action_req)
        if not enf_res.is_allowed:
            self.logger.warning(f"Action validation failed for {agent_id}.")
            return False

        # 3. Economic capability
        eco_res = await self.economic.has_funds(agent_id, action_req)
        if not eco_res.has_funds:
            self.logger.warning(f"Insufficient funds for agent {agent_id} to perform action.")
            return False

        # 4. Simulation / Impact
        sim_res = await self.simulation.predict_impact(agent_id, action_req)

        # 5. Global Action Scoring
        score_res = await self.scoring.calculate_score(action_req, sim_res.impact_score)
        if not score_res.threshold_met:
            self.logger.warning(f"Action scoring below threshold for {agent_id}.")
            return False

        # 6. Coordination (inform other agents or update shared state)
        await self.coordination.notify_peers(CoordinationMessage(sender_id=agent_id, action=action_req))

        # 7. Governance / Logging / Self-Improvement
        await self.governance.record_action(GovernanceRecord(agent_id=agent_id, action=action_req, action_score=score_res.action_score))

        self.logger.info(f"Action successfully authorized for agent {agent_id}.")
        return True

    async def register_agent(self, agent_info: dict) -> str:
        """
        Registers a new agent into the system via IdentitySystem.
        """
        agent_id = agent_info.get("id") or agent_info.get("name") or "agent_" + str(hash(str(agent_info)))
        self.logger.info(f"Registering agent: {agent_id}")
        await self.identity.register(AgentIdentity(agent_id=agent_id, name=agent_info.get("name")))
        return agent_id

    async def propose_change(self, agent_id: str, change_request: dict) -> bool:
        """
        Proposes a system or configuration change via GovernanceModule.
        """
        self.logger.info(f"Agent {agent_id} proposing change: {change_request}")
        await self.governance.submit_proposal(agent_id, ChangeProposal(proposer_id=agent_id, changes=change_request))
        return True

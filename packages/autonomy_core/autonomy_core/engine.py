"""
Autonomy Core Engine
Orchestrates the various subsystems using their defined interfaces.
"""

import logging
from .interfaces import (
    IdentityProvider, EnforcementEngine, EconomicPolicyEngine,
    CoordinationEngine, ScoringEngine, SimulationEngine, GovernanceEngine,
    TaskFormationEngine
)
from .schemas.models import (
    AgentRegistrationRequest, ActionAuthorizationRequest, ActionAuthorizationResponse,
    GovernanceProposalRequest, BudgetEvaluationRequest, SimulationRequest,
    CoordinationMessage, GovernanceRecord
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

    async def authorize_action(self, request: ActionAuthorizationRequest) -> ActionAuthorizationResponse:
        """
        Orchestrates multiple components to determine if an action should proceed.
        """
        agent_id = request.agent_id
        self.logger.info(f"Authorizing action {request.action_type} for agent {agent_id}")

        # 1. Identity Check
        id_res = await self.identity.verify(agent_id)
        if not id_res.is_valid:
            self.logger.warning(f"Identity verification failed for {agent_id}.")
            return ActionAuthorizationResponse(is_authorized=False, reason="Identity verification failed")

        # 2. Guardrails / Enforcement Check
        enf_res = await self.enforcement.validate(request)
        if not enf_res.is_authorized:
            self.logger.warning(f"Action validation failed for {agent_id}.")
            return ActionAuthorizationResponse(is_authorized=False, reason="Action validation failed")

        # 3. Economic capability
        budget_req = BudgetEvaluationRequest(agent_id=agent_id, action_type=request.action_type, payload=request.payload)
        eco_res = await self.economic.has_funds(budget_req)
        if not eco_res.has_funds:
            self.logger.warning(f"Insufficient funds for agent {agent_id} to perform action.")
            return ActionAuthorizationResponse(is_authorized=False, reason="Insufficient funds")

        # 4. Simulation / Impact
        sim_req = SimulationRequest(agent_id=agent_id, action_type=request.action_type, payload=request.payload)
        sim_res = await self.simulation.predict_impact(sim_req)

        # 5. Global Action Scoring
        score_res = await self.scoring.calculate_score(request, sim_res.impact_score)
        if not score_res.threshold_met:
            self.logger.warning(f"Action scoring below threshold for {agent_id}.")
            return ActionAuthorizationResponse(is_authorized=False, reason="Action scoring below threshold")

        # 6. Coordination (inform other agents or update shared state)
        await self.coordination.notify_peers(CoordinationMessage(sender_id=agent_id, action=request))

        # 7. Governance / Logging / Self-Improvement
        await self.governance.record_action(GovernanceRecord(agent_id=agent_id, action=request, action_score=score_res.action_score))

        self.logger.info(f"Action successfully authorized for agent {agent_id}.")
        return ActionAuthorizationResponse(is_authorized=True, reason="Success")

    async def register_agent(self, request: AgentRegistrationRequest) -> str:
        """
        Registers a new agent into the system via IdentitySystem.
        """
        self.logger.info(f"Registering agent: {request.agent_id}")
        await self.identity.register(request)
        return request.agent_id

    async def propose_change(self, request: GovernanceProposalRequest) -> bool:
        """
        Proposes a system or configuration change via GovernanceModule.
        """
        self.logger.info(f"Agent {request.proposer_id} proposing change: {request.changes}")
        await self.governance.submit_proposal(request)
        return True

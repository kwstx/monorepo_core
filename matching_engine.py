from __future__ import annotations

from typing import List, Tuple
from cooperative_context_model import CooperativeContextTensor, CooperativeContextModel
from cooperative_intelligence import CooperativeIntelligenceVector


class MatchingEngine:
    """
    Evaluates the structural complementarity between agents and tasks.
    
    The engine prioritizes agents who maintain stable collaboration dynamics
    and possess high-fidelity impact projections, rather than those with high
    individual output but unstable synergetic signatures.
    """

    @staticmethod
    def score_agent_alignment(
        task: CooperativeContextTensor,
        agent: CooperativeIntelligenceVector
    ) -> float:
        """
        Computes a composite alignment score based on synergy projection.
        """
        # 1. Base Capability Alignment (Technical Fit)
        capability_fit = CooperativeContextModel.compute_alignment_score(
            task, agent.capability_profile
        )

        # 2. Predictive Calibration Multiplier
        # Tasks with low uncertainty tolerance require high calibration.
        # calibration_gap measures the deficit if agent reliability is lower than task requirements.
        calibration_weight = 1.0 - task.uncertainty_tolerance  # Higher if task is sensitive
        calibration_score = agent.predictive_calibration_reliability
        
        # 3. Marginal Influence Consistency
        # High causal depth implies the agent's influence propagates through many layers.
        # This requires consistent marginal utility.
        causal_multiplier = 1.0 + (task.expected_downstream_causal_depth * 0.1)
        consistency_effect = agent.marginal_cooperative_influence_consistency * causal_multiplier

        # 4. Cross-Role Integration Depth
        # Tasks with diverse capability requirements benefit from high integration depth.
        capability_breadth = len(task.required_capability_vectors)
        integration_bonus = (
            agent.cross_role_integration_depth * (capability_breadth * 0.05)
        )

        # Composite Scoring:
        # We start with capability fit but moderate it through the intelligence vectors.
        # An agent with a perfect skill match but zero consistency will be de-prioritized
        # for high-depth or low-tolerance tasks.
        
        composite_score = (
            (capability_fit * 0.4) +
            (calibration_score * calibration_weight * 0.3) +
            (consistency_effect * 0.2) +
            (integration_bonus * 0.1)
        )

        return round(max(0.0, composite_score), 6)

    def rank_agents(
        self,
        task: CooperativeContextTensor,
        agents: List[CooperativeIntelligenceVector]
    ) -> List[Tuple[str, float]]:
        """
        Ranks a pool of agents for a specific task based on synergetic alignment.
        Returns a sorted list of (agent_id, score).
        """
        scored_agents = []
        for agent in agents:
            score = self.score_agent_alignment(task, agent)
            scored_agents.append((agent.agent_id, score))
        
        # Sort by score descending
        return sorted(scored_agents, key=lambda x: x[1], reverse=True)

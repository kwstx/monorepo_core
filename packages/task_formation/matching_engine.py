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
    def _clamp01(value: float) -> float:
        return max(0.0, min(1.0, value))

    @classmethod
    def score_agent_alignment(
        cls,
        task: CooperativeContextTensor,
        agent: CooperativeIntelligenceVector
    ) -> float:
        """
        Computes a composite alignment score based on synergy projection.

        TemporalImpactMemory contributes increasingly on tasks with deeper
        downstream causal depth and longer horizons so delayed-impact agents
        are not systematically excluded.
        """
        # 1. Base Capability Alignment (Technical Fit)
        capability_fit = CooperativeContextModel.compute_alignment_score(
            task, agent.capability_profile
        )

        # 2. Predictive Calibration Multiplier
        # Tasks with low uncertainty tolerance require high calibration.
        calibration_weight = 1.0 - task.uncertainty_tolerance
        calibration_score = agent.predictive_calibration_reliability

        # 3. Marginal Influence Consistency
        # High causal depth implies the agent's influence propagates through many layers.
        causal_multiplier = 1.0 + (task.expected_downstream_causal_depth * 0.1)
        consistency_effect = agent.marginal_cooperative_influence_consistency * causal_multiplier

        # 4. Cross-Role Integration Depth
        capability_breadth = len(task.required_capability_vectors)
        integration_bonus = agent.cross_role_integration_depth * (capability_breadth * 0.05)

        # 5. Temporal Impact Memory
        depth_factor = cls._clamp01(task.expected_downstream_causal_depth / 8.0)
        horizon_factor = cls._clamp01(task.temporal_horizon / 12.0)
        deep_chain_factor = (0.6 * depth_factor) + (0.4 * horizon_factor)
        temporal_memory_score = agent.temporal_impact_memory.score_for_task(task)

        # Dynamic weights: deep-chain tasks shift signal away from short-term capability
        # and toward delayed causal contribution quality.
        capability_weight = 0.40 - (0.12 * deep_chain_factor)
        temporal_weight = 0.02 + (0.16 * deep_chain_factor)

        composite_score = (
            (capability_fit * capability_weight)
            + (calibration_score * calibration_weight * 0.30)
            + (consistency_effect * 0.20)
            + (integration_bonus * 0.10)
            + (temporal_memory_score * temporal_weight)
        )

        # Fairness floor for delayed-impact contributors on deep-chain tasks.
        delayed_floor = temporal_memory_score * deep_chain_factor * 0.08
        composite_score += delayed_floor

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

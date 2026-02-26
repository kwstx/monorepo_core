from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

from .cooperative_context_model import CooperativeContextTensor


@dataclass(frozen=True)
class TemporalImpactMemory:
    """
    Captures an agent's observed impact behavior over delayed and multi-hop horizons.

    Values are normalized to [0, 1] and intentionally default to neutral priors so
    existing agent profiles remain backward compatible.
    """

    delayed_outcome_realization_rate: float = 0.5
    long_horizon_causal_contribution: float = 0.5
    median_impact_latency: float = 1.0

    @staticmethod
    def _clamp01(value: float) -> float:
        return max(0.0, min(1.0, value))

    def score_for_task(self, task: CooperativeContextTensor) -> float:
        """
        Scores temporal contribution fit for a task.

        Deep causal chains and longer horizons amplify the value of delayed-impact
        contributors. Shallow tasks receive little to no temporal memory boost.
        """
        depth_factor = self._clamp01(task.expected_downstream_causal_depth / 8.0)
        horizon_factor = self._clamp01(task.temporal_horizon / 12.0)
        chain_relevance = (0.6 * depth_factor) + (0.4 * horizon_factor)

        delayed_strength = self._clamp01(self.delayed_outcome_realization_rate)
        causal_strength = self._clamp01(self.long_horizon_causal_contribution)

        latency_alignment = 1.0 - abs(self._clamp01(self.median_impact_latency / 12.0) - horizon_factor)
        latency_alignment = self._clamp01(latency_alignment)

        temporal_signal = (
            (0.45 * delayed_strength)
            + (0.45 * causal_strength)
            + (0.10 * latency_alignment)
        )

        return self._clamp01(temporal_signal * chain_relevance)


@dataclass(frozen=True)
class CooperativeIntelligenceVector:
    """
    Represents an agent's multidimensional intelligence profile for cooperation.

    Instead of tracking 'productivity', this vector captures the agent's ability
    to integrate into complex causal chains and maintain stable influence.
    """

    agent_id: str

    # [0, 1] How accurately the agent forecasts its own impact and synergy
    predictive_calibration_reliability: float

    # [0, 1] The stability of the agent's marginal value add across different teams
    marginal_cooperative_influence_consistency: float

    # [0, 1] Breadth and depth of the agent's ability to interface across different domains/roles
    cross_role_integration_depth: float

    # Mapping of capabilities to proficiency levels [0, 1]
    capability_profile: Dict[str, float] = field(default_factory=dict)

    # History of realized outcomes (simplified for this model)
    historical_synergy_slope: float = 0.0

    # Delayed and downstream impact signal for deep-causal task matching.
    temporal_impact_memory: TemporalImpactMemory = field(default_factory=TemporalImpactMemory)

    def as_dict(self) -> Dict[str, object]:
        return {
            "agent_id": self.agent_id,
            "calibration": self.predictive_calibration_reliability,
            "consistency": self.marginal_cooperative_influence_consistency,
            "integration": self.cross_role_integration_depth,
            "capabilities": self.capability_profile,
            "temporal_impact_memory": {
                "delayed_outcome_realization_rate": self.temporal_impact_memory.delayed_outcome_realization_rate,
                "long_horizon_causal_contribution": self.temporal_impact_memory.long_horizon_causal_contribution,
                "median_impact_latency": self.temporal_impact_memory.median_impact_latency,
            },
        }

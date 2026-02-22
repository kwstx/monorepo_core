from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


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
    
    def as_dict(self) -> Dict[str, object]:
        return {
            "agent_id": self.agent_id,
            "calibration": self.predictive_calibration_reliability,
            "consistency": self.marginal_cooperative_influence_consistency,
            "integration": self.cross_role_integration_depth,
            "capabilities": self.capability_profile,
        }

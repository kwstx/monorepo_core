from __future__ import annotations
import math
from dataclasses import dataclass
from typing import List, Dict, Tuple, Sequence


@dataclass(frozen=True)
class TeamCandidate:
    """
    Represents a potential team configuration being considered for selection.
    
    Contains the projected performance and the specific influence contribution 
    of each participating agent to facilitate concentration analysis.
    """
    team_id: str
    agent_ids: Tuple[str, ...]
    predicted_synergy_performance: float
    influence_projections: Dict[str, float]  # agent_id -> projected influence contribution


class EntropyConstraintModule:
    """
    Monitors influence concentration across a pool of candidate teams.
    
    If the distribution of influence across agents becomes too concentrated 
    (low entropy / high variance), the module dampens the selection 
    probabilities of candidates that reinforce this concentration, 
    promoting cooperative diversity while preserving predicted synergy performance.
    """

    def __init__(
        self, 
        variance_threshold: float = 0.01,
        entropy_weight: float = 0.5,
        min_diversity_ratio: float = 0.8
    ) -> None:
        """
        Initialize the constraint module.
        
        Args:
            variance_threshold: Threshold for influence variance before adjustment triggers.
            entropy_weight: Strength of the entropy-based probability damping.
            min_diversity_ratio: Target ratio of actual entropy vs maximum possible entropy.
        """
        self.variance_threshold = variance_threshold
        self.entropy_weight = entropy_weight
        self.min_diversity_ratio = min_diversity_ratio

    def measure_concentration(
        self, 
        candidates: Sequence[TeamCandidate], 
        base_probabilities: List[float]
    ) -> Dict[str, float]:
        """
        Calculates the expected influence per agent given selection probabilities.
        
        Returns:
            A mapping of agent_id to their expected influence across the candidate pool.
        """
        if not candidates or not base_probabilities:
            return {}

        # Normalize probabilities
        prob_sum = sum(base_probabilities)
        if prob_sum <= 0:
            probs = [1.0 / len(base_probabilities)] * len(base_probabilities)
        else:
            probs = [p / prob_sum for p in base_probabilities]

        agent_expected_influence: Dict[str, float] = {}
        
        for i, candidate in enumerate(candidates):
            p = probs[i]
            for agent_id, influence in candidate.influence_projections.items():
                agent_expected_influence[agent_id] = agent_expected_influence.get(agent_id, 0.0) + (p * influence)
        
        return agent_expected_influence

    def calculate_metrics(self, agent_expected_influence: Dict[str, float]) -> Dict[str, float]:
        """
        Computes variance and entropy for the given influence distribution.
        """
        if not agent_expected_influence:
            return {"variance": 0.0, "entropy": 0.0, "max_entropy": 0.0}
        
        values = list(agent_expected_influence.values())
        total = sum(values)
        if total < 1e-9:
            return {"variance": 0.0, "entropy": 0.0, "max_entropy": 0.0}

        mean_influence = total / len(values)
        variance = sum((x - mean_influence) ** 2 for x in values) / len(values)
        
        entropy = 0.0
        for val in values:
            p = val / total
            if p > 1e-12:
                entropy -= p * math.log2(p)
                
        max_entropy = math.log2(len(values)) if len(values) > 1 else 0.0
        
        return {
            "variance": variance,
            "entropy": entropy,
            "max_entropy": max_entropy,
            "diversity_ratio": entropy / max_entropy if max_entropy > 0 else 1.0
        }

    def adjust_candidate_probabilities(
        self, 
        candidates: Sequence[TeamCandidate], 
        base_probabilities: List[float]
    ) -> List[float]:
        """
        Automatically adjusts selection probabilities to maintain cooperative diversity.
        
        If projected influence concentration exceeds the threshold, this method 
        iteratively dampens the probabilities of teams containing over-concentrated agents.
        """
        if not candidates:
            return []
        
        if len(candidates) != len(base_probabilities):
            raise ValueError("Candidates and base_probabilities must have the same length.")

        # 1. Initial concentration analysis
        expected_influence = self.measure_concentration(candidates, base_probabilities)
        metrics = self.calculate_metrics(expected_influence)

        # Trigger adjustment if variance is too high or diversity ratio is too low
        if (metrics["variance"] <= self.variance_threshold and 
            metrics["diversity_ratio"] >= self.min_diversity_ratio):
            # Already balanced
            prob_sum = sum(base_probabilities)
            return [p / prob_sum for p in base_probabilities]

        # 2. Entropy-based adjustment
        total_influence = sum(expected_influence.values())
        if total_influence < 1e-9:
            return [p / sum(base_probabilities) for p in base_probabilities]

        num_agents = len(expected_influence)
        fair_share = 1.0 / num_agents if num_agents > 0 else 1.0

        adjusted_probs = []
        for i, candidate in enumerate(candidates):
            # Calculate a damping penalty based on the cumulative influence 
            # of the agents in this specific candidate.
            penalty = 0.0
            for agent_id in candidate.agent_ids:
                agent_share = expected_influence.get(agent_id, 0.0) / total_influence
                
                # If an agent is over-concentrated, increase the penalty
                if agent_share > fair_share:
                    # Penalty scales with the degree of over-concentration
                    penalty += (agent_share - fair_share) * self.entropy_weight

            # Dampen probabilities using an exponential decay based on penalty
            dampening_factor = math.exp(-penalty)
            adjusted_probs.append(base_probabilities[i] * dampening_factor)

        # 3. Final normalization and synergy preservation
        # We ensure that we don't zero out everything by adding a small floor 
        # based on original synergy performance if everything gets heavily penalized.
        total_adjusted = sum(adjusted_probs)
        if total_adjusted < 1e-12:
            return [p / sum(base_probabilities) for p in base_probabilities]

        return [p / total_adjusted for p in adjusted_probs]

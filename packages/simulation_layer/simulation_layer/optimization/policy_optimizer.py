from typing import Any, Dict, List, Optional, Tuple, Set
import numpy as np
from pydantic import BaseModel, Field

from src.models.policy import PolicySchema
from src.models.cooperative_state_snapshot import CooperativeStateSnapshot
from src.models.intelligence_evolution_model import IntelligenceEvolutionModel, EvolutionMetrics
from src.simulation.horizon_sensitivity_engine import HorizonSensitivityEngine, SensitivityAnalysis
from src.simulation.entropy_stress_test import EntropyStressTest, EntropyStressReport

class PolicyObjectiveScores(BaseModel):
    """Raw objective scores for a candidate policy."""
    policy_id: str
    downstream_impact: float
    synergy_amplification: float
    intelligence_growth: float
    entropy_balance: float
    long_horizon_resilience: float

class OptimizedPolicySet(BaseModel):
    """The resulting Pareto frontier of governance configurations."""
    frontier: List[PolicySchema]
    scores: Dict[str, PolicyObjectiveScores]
    metadata: Dict[str, Any] = Field(default_factory=dict)

class PolicyOptimizer:
    """
    Ranks candidate policies using a constrained multi-objective framework.
    Returns a Pareto frontier of non-dominated governance configurations.
    """

    def __init__(
        self, 
        initial_state: CooperativeStateSnapshot,
        simulation_steps: int = 60,
        long_horizon_steps: int = 300
    ):
        self.initial_state = initial_state
        self.simulation_steps = simulation_steps
        self.horizon_engine = HorizonSensitivityEngine(
            initial_state,
            short_horizon=12,
            mid_horizon=simulation_steps,
            long_horizon=long_horizon_steps
        )
        self.entropy_tester = EntropyStressTest()

    def optimize(
        self, 
        candidates: List[PolicySchema], 
        constraints: Optional[Dict[str, float]] = None
    ) -> OptimizedPolicySet:
        """
        Evaluates candidates and extracts the Pareto frontier.
        
        Args:
            candidates: List of candidate policies to evaluate.
            constraints: Optional dictionary of minimum required scores for each objective.
                         Keys: downstream_impact, synergy_amplification, intelligence_growth,
                               entropy_balance, long_horizon_resilience.
        """
        scored_candidates: Dict[str, PolicyObjectiveScores] = {}
        policy_map: Dict[str, PolicySchema] = {p.policy_id: p for p in candidates}

        for policy in candidates:
            scores = self._evaluate_policy(policy)
            
            # Apply hard constraints if provided
            if constraints:
                violated = False
                for metric, min_val in constraints.items():
                    if hasattr(scores, metric) and getattr(scores, metric) < min_val:
                        violated = True
                        break
                if violated:
                    continue
                    
            scored_candidates[policy.policy_id] = scores

        frontier_ids = self._find_pareto_frontier(list(scored_candidates.values()))
        
        return OptimizedPolicySet(
            frontier=[policy_map[pid] for pid in frontier_ids],
            scores={pid: scored_candidates[pid] for pid in frontier_ids},
            metadata={
                "candidate_count": len(candidates),
                "after_constraints_count": len(scored_candidates),
                "frontier_count": len(frontier_ids),
                "simulation_steps": self.simulation_steps,
                "constraints_applied": constraints
            }
        )

    def _evaluate_policy(self, policy: PolicySchema) -> PolicyObjectiveScores:
        """Computes the 5 key objectives for a single policy."""
        
        # 1. Run Intelligence Evolution for impact, synergy, and core growth
        evolution_model = IntelligenceEvolutionModel(self.initial_state, policy)
        trajectory = evolution_model.evolve(self.simulation_steps)
        
        # Objective 1: Downstream Impact (Average)
        avg_impact = np.mean([m.projected_impact for m in trajectory])
        
        # Objective 2: Synergy Amplification (Average Cooperative Adaptation)
        avg_synergy = np.mean([m.cooperative_adaptation for m in trajectory])
        
        # Objective 3: Cooperative Intelligence Growth Rate (Slope of learning velocity)
        # Using linear fit to find the growth rate
        x = np.arange(len(trajectory))
        y = np.array([m.learning_velocity for m in trajectory])
        growth_rate, _ = np.polyfit(x, y, 1) if len(x) > 1 else (0.0, 0.0)
        
        # 2. Run Horizon Sensitivity for Long-horizon Resilience
        sensitivity = self.horizon_engine.evaluate_policy(policy)
        resilience = sensitivity.systemic_resilience_rating
        
        # 3. Run Entropy Stress Test for Entropy Balance
        entropy_report = self.entropy_tester.evaluate(
            policy, 
            self.initial_state, 
            cycles=self.simulation_steps
        )
        entropy_balance = entropy_report.final_normalized_entropy

        return PolicyObjectiveScores(
            policy_id=policy.policy_id,
            downstream_impact=float(avg_impact),
            synergy_amplification=float(avg_synergy),
            intelligence_growth=float(growth_rate),
            entropy_balance=float(entropy_balance),
            long_horizon_resilience=float(resilience)
        )

    def _find_pareto_frontier(self, scores: List[PolicyObjectiveScores]) -> List[str]:
        """
        Identifies the indices of non-dominated solutions.
        A solution is non-dominated if no other solution is better in at least one 
        objective while being at least as good in all others.
        """
        frontier_ids = []
        
        for i, candidate in enumerate(scores):
            is_dominated = False
            for j, competitor in enumerate(scores):
                if i == j:
                    continue
                
                # Check if 'competitor' dominates 'candidate'
                if self._dominates(competitor, candidate):
                    is_dominated = True
                    break
            
            if not is_dominated:
                frontier_ids.append(candidate.policy_id)
                
        return frontier_ids

    def _dominates(self, a: PolicyObjectiveScores, b: PolicyObjectiveScores) -> bool:
        """Returns True if a dominates b (all objectives a >= b and at least one a > b)."""
        metrics = [
            'downstream_impact',
            'synergy_amplification',
            'intelligence_growth',
            'entropy_balance',
            'long_horizon_resilience'
        ]
        
        better_in_one = False
        for metric in metrics:
            val_a = getattr(a, metric)
            val_b = getattr(b, metric)
            
            if val_a < val_b:
                return False
            if val_a > val_b:
                better_in_one = True
                
        return better_in_one

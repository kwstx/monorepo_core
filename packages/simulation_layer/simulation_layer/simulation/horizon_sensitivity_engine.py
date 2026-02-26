from typing import Any, Dict, List, Optional, Tuple
from enum import Enum
from pydantic import BaseModel, Field
import numpy as np

from src.models.policy import PolicySchema
from src.models.cooperative_state_snapshot import CooperativeStateSnapshot
from src.models.intelligence_evolution_model import IntelligenceEvolutionModel, EvolutionMetrics
from src.simulation.entropy_stress_test import EntropyStressTest, EntropyStressReport

class HorizonType(str, Enum):
    SHORT_TERM = "short_term"
    MID_TERM = "mid_term"
    LONG_TERM = "long_term"

class HorizonPerformance(BaseModel):
    """Metrics captured for a specific time horizon."""
    horizon: HorizonType
    steps: int
    avg_impact: float
    avg_learning_velocity: float
    avg_cooperative_adaptation: float
    final_entropy: float
    resilience_score: float = Field(..., description="Measure of stability and persistence (0-1).")
    risk_factors: List[str] = Field(default_factory=list)

class SensitivityAnalysis(BaseModel):
    """Aggregate sensitivity analysis across multiple horizons."""
    policy_id: str
    horizons: Dict[HorizonType, HorizonPerformance]
    impact_persistence_slope: float = Field(..., description="Trend of impact across horizons.")
    systemic_resilience_rating: float = Field(..., description="Overall resilience rating (0-1).")
    long_horizon_viability: bool
    metadata: Dict[str, Any] = Field(default_factory=dict)

class HorizonSensitivityEngine:
    """
    Evaluates policy performance across short-term, mid-term, and long-term projections.
    
    Ensures policies are not optimized solely for immediate gains but are evaluated 
    for cascading downstream impact persistence and systemic resilience.
    """

    def __init__(
        self, 
        initial_state: CooperativeStateSnapshot,
        short_horizon: int = 12,
        mid_horizon: int = 60,
        long_horizon: int = 300
    ):
        self.initial_state = initial_state
        self.horizons = {
            HorizonType.SHORT_TERM: short_horizon,
            HorizonType.MID_TERM: mid_horizon,
            HorizonType.LONG_TERM: long_horizon
        }
        self.entropy_tester = EntropyStressTest()

    def evaluate_policy(self, policy: PolicySchema) -> SensitivityAnalysis:
        """
        Runs sensitivity analysis across all defined horizons.
        """
        results = {}
        
        # We run the longest simulation once and slice it for each horizon
        max_steps = max(self.horizons.values())
        evolution_model = IntelligenceEvolutionModel(self.initial_state, policy)
        full_trajectory = evolution_model.evolve(max_steps)
        
        # Run entropy stress tests for each horizon to get horizon-specific systemic risks
        for h_type, steps in self.horizons.items():
            # Get trajectory slice for this horizon
            horizon_traj = full_trajectory[:steps]
            
            # Evaluate entropy / systemic stress for this specific horizon
            entropy_report = self.entropy_tester.evaluate(policy, self.initial_state, cycles=steps)
            
            results[h_type] = self._calculate_horizon_performance(
                h_type, 
                steps, 
                horizon_traj, 
                entropy_report
            )
            
        # Calculate cross-horizon metrics
        persistence_slope = self._calculate_impact_persistence(results)
        resilience_rating = np.mean([h.resilience_score for h in results.values()])
        
        # Long horizon viability requires both impact growth/stability and low systemic risk
        long_term = results[HorizonType.LONG_TERM]
        viability = (
            long_term.avg_impact > 0.8 * results[HorizonType.SHORT_TERM].avg_impact and
            long_term.resilience_score > 0.6 and
            "fragmentation_risk" not in long_term.risk_factors
        )

        return SensitivityAnalysis(
            policy_id=policy.policy_id,
            horizons=results,
            impact_persistence_slope=float(persistence_slope),
            systemic_resilience_rating=float(resilience_rating),
            long_horizon_viability=viability,
            metadata={
                "horizons_defined": self.horizons,
                "engine_version": "1.0.0"
            }
        )

    def _calculate_horizon_performance(
        self, 
        horizon: HorizonType, 
        steps: int, 
        trajectory: List[EvolutionMetrics],
        entropy: EntropyStressReport
    ) -> HorizonPerformance:
        """Computes performance metrics for a specific horizon."""
        
        avg_impact = np.mean([m.projected_impact for m in trajectory])
        avg_learning = np.mean([m.learning_velocity for m in trajectory])
        avg_coop = np.mean([m.cooperative_adaptation for m in trajectory])
        
        # Resilience is inverse to entropy drop and volatility
        entropy_stability = 1.0 - abs(entropy.entropy_delta)
        # Check if impact is declining significantly at the end of the horizon
        recent_impacts = [m.projected_impact for m in trajectory[-5:]] if len(trajectory) >= 5 else [m.projected_impact for m in trajectory]
        impact_trend = (recent_impacts[-1] - recent_impacts[0]) / max(1, len(recent_impacts) - 1)
        
        resilience_score = (
            0.4 * entropy_stability + 
            0.3 * (1.0 - entropy.dominance_amplification_score) + 
            0.3 * (1.0 + min(0.5, max(-0.5, impact_trend))) # Small boost for positive trend, penalty for sharp decline
        )
        resilience_score = max(0.0, min(1.0, resilience_score))
        
        risk_factors = []
        if entropy.dominance_amplification_detected:
            risk_factors.append("influence_concentration")
        if entropy.fragmentation_risk_detected:
            risk_factors.append("fragmentation_risk")
        if entropy.cooperative_diversity_destabilized:
            risk_factors.append("diversity_destabilization")
        if impact_trend < -0.05:
            risk_factors.append("impact_decay")

        return HorizonPerformance(
            horizon=horizon,
            steps=steps,
            avg_impact=float(avg_impact),
            avg_learning_velocity=float(avg_learning),
            avg_cooperative_adaptation=float(avg_coop),
            final_entropy=entropy.final_normalized_entropy,
            resilience_score=float(resilience_score),
            risk_factors=risk_factors
        )

    def _calculate_impact_persistence(self, results: Dict[HorizonType, HorizonPerformance]) -> float:
        """
        Calculates the slope of average impact across horizons.
        A positive slope indicates cascading downstream impact growth.
        """
        x = np.array([
            self.horizons[HorizonType.SHORT_TERM],
            self.horizons[HorizonType.MID_TERM],
            self.horizons[HorizonType.LONG_TERM]
        ])
        y = np.array([
            results[HorizonType.SHORT_TERM].avg_impact,
            results[HorizonType.MID_TERM].avg_impact,
            results[HorizonType.LONG_TERM].avg_impact
        ])
        
        # Log-scale X to better represent the jump in horizons
        log_x = np.log(x)
        if len(set(log_x)) < 2:
            return 0.0
            
        slope, _ = np.polyfit(log_x, y, 1)
        return slope

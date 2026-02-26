from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
import numpy as np

from simulation_layer.models.policy import PolicySchema
from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
from simulation_layer.models.intelligence_evolution_model import IntelligenceEvolutionModel, EvolutionMetrics
from simulation_layer.simulation.entropy_stress_test import EntropyStressTest, EntropyStressReport

class ComparisonMetrics(BaseModel):
    """Multi-objective deltas between baseline and modified policies."""
    impact_delta: float = Field(..., description="Delta in projected downstream impact.")
    synergy_delta: float = Field(..., description="Delta in synergy amplification (cooperative adaptation).")
    intelligence_growth_delta: float = Field(..., description="Delta in cooperative intelligence growth rate.")
    calibration_stability_delta: float = Field(..., description="Delta in calibration accuracy stability.")
    entropy_balance_delta: float = Field(..., description="Delta in entropy distribution balance.")

class ComparisonReport(BaseModel):
    """Full report of the counterfactual policy comparison."""
    baseline_id: str
    modified_id: str
    metrics: ComparisonMetrics
    baseline_trajectory: List[EvolutionMetrics]
    modified_trajectory: List[EvolutionMetrics]
    baseline_entropy_report: EntropyStressReport
    modified_entropy_report: EntropyStressReport
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CounterfactualPolicyComparator:
    """
    Runs parallel simulations between baseline and modified governance structures
    to compute multi-objective deltas across several key intelligence metrics.
    """

    def __init__(self, initial_state: CooperativeStateSnapshot, steps: int = 50):
        self.initial_state = initial_state
        self.steps = steps
        self.entropy_tester = EntropyStressTest()

    def compare(self, baseline_policy: PolicySchema, modified_policy: PolicySchema) -> ComparisonReport:
        """
        Executes parallel simulations and computes deltas.
        """
        # 1. Run Intelligence Evolution Simulations
        baseline_model = IntelligenceEvolutionModel(self.initial_state, baseline_policy)
        modified_model = IntelligenceEvolutionModel(self.initial_state, modified_policy)

        baseline_trajectory = baseline_model.evolve(self.steps)
        modified_trajectory = modified_model.evolve(self.steps)

        # 2. Run Entropy Stress Tests
        baseline_entropy = self.entropy_tester.evaluate(baseline_policy, self.initial_state, cycles=self.steps)
        modified_entropy = self.entropy_tester.evaluate(modified_policy, self.initial_state, cycles=self.steps)

        # 3. Compute Deltas
        metrics = self._compute_deltas(
            baseline_trajectory, 
            modified_trajectory, 
            baseline_entropy, 
            modified_entropy
        )

        return ComparisonReport(
            baseline_id=baseline_policy.policy_id,
            modified_id=modified_policy.policy_id,
            metrics=metrics,
            baseline_trajectory=baseline_trajectory,
            modified_trajectory=modified_trajectory,
            baseline_entropy_report=baseline_entropy,
            modified_entropy_report=modified_entropy,
            metadata={
                "steps": self.steps,
                "comparison_engine_version": "1.0.0"
            }
        )

    def _compute_deltas(
        self, 
        base_traj: List[EvolutionMetrics], 
        mod_traj: List[EvolutionMetrics],
        base_entropy: EntropyStressReport,
        mod_entropy: EntropyStressReport
    ) -> ComparisonMetrics:
        """Calculates specific multi-objective deltas."""
        
        # A. Projected Downstream Impact (Average across trajectory)
        avg_base_impact = np.mean([m.projected_impact for m in base_traj])
        avg_mod_impact = np.mean([m.projected_impact for m in mod_traj])
        impact_delta = float(avg_mod_impact - avg_base_impact)

        # B. Synergy Amplification (Average cooperative adaptation)
        avg_base_synergy = np.mean([m.cooperative_adaptation for m in base_traj])
        avg_mod_synergy = np.mean([m.cooperative_adaptation for m in mod_traj])
        synergy_delta = float(avg_mod_synergy - avg_base_synergy)

        # C. Cooperative Intelligence Growth Rate
        # Calculated as the linear slope of learning velocity over the simulation steps
        base_growth = (base_traj[-1].learning_velocity - base_traj[0].learning_velocity) / len(base_traj)
        mod_growth = (mod_traj[-1].learning_velocity - mod_traj[0].learning_velocity) / len(mod_traj)
        intelligence_growth_delta = float(mod_growth - base_growth)

        # D. Calibration Accuracy Stability (Average stability)
        avg_base_stability = np.mean([m.calibration_stability for m in base_traj])
        avg_mod_stability = np.mean([m.calibration_stability for m in mod_traj])
        calibration_stability_delta = float(avg_mod_stability - avg_base_stability)

        # E. Entropy Distribution Balance (Final normalized entropy delta)
        entropy_balance_delta = float(mod_entropy.final_normalized_entropy - base_entropy.final_normalized_entropy)

        return ComparisonMetrics(
            impact_delta=impact_delta,
            synergy_delta=synergy_delta,
            intelligence_growth_delta=intelligence_growth_delta,
            calibration_stability_delta=calibration_stability_delta,
            entropy_balance_delta=entropy_balance_delta
        )

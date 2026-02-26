from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from src.models.policy import PolicySchema, TransformationOperator
from src.models.cooperative_state_snapshot import CooperativeStateSnapshot

class EvolutionMetrics(BaseModel):
    """Captures the state of intelligence evolution at a specific point in time."""
    step: int
    learning_velocity: float = Field(..., description="Rate of capability acquisition and refinement.")
    calibration_stability: float = Field(..., description="Consistency and accuracy of predictive models.")
    contribution_reinforcement: float = Field(..., description="Strength of feedback loops for long-horizon contributions.")
    cooperative_adaptation: float = Field(..., description="Degree of agent alignment with cooperative norms.")
    projected_impact: float = Field(..., description="Aggregated real-world impact forecast.")
    incentive_intensity: float = Field(..., description="Current strength of the incentive structure.")

class IntelligenceEvolutionModel:
    """
    Simulates how governance policies influence the trajectory of collective intelligence.
    
    This model implements feedback loops where policy transformations alter the 
    system's incentive structure, which subsequently drives changes in learning speed, 
    calibration, and cooperative dynamics, ultimately impacting real-world outcomes.
    """

    def __init__(
        self, 
        initial_state: CooperativeStateSnapshot, 
        policy: PolicySchema,
        base_learning_rate: float = 0.05,
        adaptation_inertia: float = 0.8
    ):
        self.state = initial_state
        self.policy = policy
        self.base_learning_rate = base_learning_rate
        self.adaptation_inertia = adaptation_inertia
        
        # Internal state variables influenced by policy
        self._current_learning_velocity = 1.0
        self._current_calibration_stability = 1.0
        self._current_contribution_reinforcement = 1.0
        self._current_cooperative_adaptation = 0.5
        self._current_projected_impact = 1.0
        
        # Initialize evolution history
        self.history: List[EvolutionMetrics] = []
        
        # Extract initial systemic values from state snapshot
        self._initialize_from_snapshot(initial_state)

    def _initialize_from_snapshot(self, snapshot: CooperativeStateSnapshot):
        """Extracts baseline metrics from the initial state snapshot."""
        # Calculate initial cooperative adaptation from synergy density if available
        if snapshot.synergy_density_matrices:
            matrix = snapshot.synergy_density_matrices[0].values
            avg_synergy = sum(sum(row) for row in matrix) / (len(matrix) * len(matrix[0]))
            self._current_cooperative_adaptation = min(1.0, avg_synergy)
            
        # Calculate initial calibration stability from calibration curves
        if snapshot.predictive_calibration_curves:
            curve = snapshot.predictive_calibration_curves[0]
            mae = sum(abs(p.predicted - p.observed) for p in curve.points) / len(curve.points)
            self._current_calibration_stability = max(0.0, 1.0 - mae)

    def evolve(self, steps: int) -> List[EvolutionMetrics]:
        """
        Runs the evolution simulation for a specified number of steps.
        
        Args:
            steps: Number of temporal steps to simulate.
            
        Returns:
            A list of EvolutionMetrics capturing the system trajectory.
        """
        for i in range(steps):
            metrics = self.step(i)
            self.history.append(metrics)
        return self.history

    def step(self, step_index: int) -> EvolutionMetrics:
        """
        Executes a single step of the evolution simulation.
        
        Implements the feedback loop:
        Policy -> Incentives -> Behavior (Learning/Coop) -> Impact -> (Future) Policy Context
        """
        # 1. Derive incentive structure from policy transformations
        incentive_intensity = self._calculate_incentive_intensity()
        
        # 2. Update learning velocity
        # Learning velocity is boosted by incentive intensity and cooperative adaptation
        learning_boost = (incentive_intensity * 0.4) + (self._current_cooperative_adaptation * 0.6)
        target_velocity = self._current_learning_velocity * (1.0 + self.base_learning_rate * learning_boost)
        self._current_learning_velocity = (
            self.adaptation_inertia * self._current_learning_velocity + 
            (1.0 - self.adaptation_inertia) * target_velocity
        )
        
        # 3. Update calibration stability
        # Stability improved by consistent learning but can be disrupted by high volatility
        volatility_penalty = abs(self._current_learning_velocity - 1.0) * 0.1
        self._current_calibration_stability = min(1.0, self._current_calibration_stability + 0.01 * (1.0 - volatility_penalty))
        
        # 4. Update long-horizon contribution reinforcement
        # Policies with 'sticky' or 'permanent' persistence modes reinforce long-term behavior
        persistence_bonus = 1.2 if self.policy.temporal_rules.persistence_mode in ["sticky", "permanent"] else 1.0
        self._current_contribution_reinforcement *= (1.0 + 0.02 * incentive_intensity * persistence_bonus)
        
        # 5. Update cooperative behavior adaptation
        # Adaptation converges towards the target defined by 'entropy_adjustments' and transformations
        coop_target = 0.5 + (0.5 * incentive_intensity)
        self._current_cooperative_adaptation = (
            0.95 * self._current_cooperative_adaptation + 
            0.05 * coop_target
        )
        
        # 6. Model real-world impact feedback loop
        # Impact is a function of capability (learning), stability, and cooperation
        impact_factor = (
            self._current_learning_velocity * 0.3 + 
            self._current_calibration_stability * 0.2 + 
            self._current_cooperative_adaptation * 0.5
        )
        # Apply policy-defined impact modifiers
        policy_multiplier = self.policy.impact_modifiers.get("projected_real_world_impact", 1.0)
        self._current_projected_impact = impact_factor * policy_multiplier * self._current_contribution_reinforcement

        return EvolutionMetrics(
            step=step_index,
            learning_velocity=self._current_learning_velocity,
            calibration_stability=self._current_calibration_stability,
            contribution_reinforcement=self._current_contribution_reinforcement,
            cooperative_adaptation=self._current_cooperative_adaptation,
            projected_impact=self._current_projected_impact,
            incentive_intensity=incentive_intensity
        )

    def _calculate_incentive_intensity(self) -> float:
        """
        Translates policy transformations and adjustments into a scalar incentive intensity.
        """
        intensity = 0.0
        
        # Sum effects of transformations targeting performance/trust metrics
        for trans in self.policy.transformations:
            if trans.operator == TransformationOperator.MULTIPLY:
                # Values > 1 increase intensity
                intensity += (float(trans.value) - 1.0)
            elif trans.operator == TransformationOperator.ADD:
                # Positive additions increase intensity
                intensity += float(trans.value) * 0.1
                
        # Incorporate entropy adjustments - lower entropy targets often mean higher coordination incentives
        entropy_adj = self.policy.entropy_adjustments.get("shannon_entropy_target", 0.0)
        intensity -= entropy_adj # Negative adjustment (decreasing entropy) increases incentive intensity
        
        return max(0.0, min(2.0, 1.0 + intensity))

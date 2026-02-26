from __future__ import annotations

import math
from statistics import mean, pvariance
from typing import Dict, List, Sequence

from pydantic import BaseModel, Field

from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
from simulation_layer.models.policy import PolicySchema, TransformationOperator


class NegotiationStepMetrics(BaseModel):
    step: int = Field(..., ge=0)
    mean_offer: float
    proposal_variance: float = Field(..., ge=0.0)
    consensus_distance: float = Field(..., ge=0.0)
    trust_weighted_influence_shift: float
    agreement_progress: float = Field(..., ge=0.0, le=1.0)


class GovernanceRuleRisk(BaseModel):
    rule_reference: str
    risk_type: str
    severity: float = Field(..., ge=0.0, le=1.0)
    signal: str


class NegotiationDynamicsReport(BaseModel):
    policy_id: str
    trajectory: tuple[NegotiationStepMetrics, ...]
    convergence_time: int = Field(..., ge=1)
    converged: bool
    baseline_proposal_variance: float = Field(..., ge=0.0)
    final_proposal_variance: float = Field(..., ge=0.0)
    proposal_variance_delta: float
    baseline_influence_dispersion: float = Field(..., ge=0.0)
    final_influence_dispersion: float = Field(..., ge=0.0)
    influence_shift_delta: float
    instability_score: float = Field(..., ge=0.0)
    coordination_friction_score: float = Field(..., ge=0.0)
    instability_detected: bool
    coordination_friction_detected: bool
    governance_risks: tuple[GovernanceRuleRisk, ...]


class NegotiationDynamicsSimulator:
    """
    Simulates how governance policy changes alter bargaining behavior:
    - convergence time
    - proposal variance
    - trust-weighted influence shifts
    and detects governance-rule-driven instability and coordination friction.
    """

    def simulate(
        self,
        policy: PolicySchema,
        baseline_snapshot: CooperativeStateSnapshot,
        max_steps: int = 20,
    ) -> NegotiationDynamicsReport:
        if max_steps < 1:
            raise ValueError("max_steps must be >= 1")

        proposals = self._initial_proposals(baseline_snapshot)
        trust_weights = self._trust_weights(baseline_snapshot, len(proposals))
        baseline_influence = self._normalize([p * w for p, w in zip(proposals, trust_weights)])

        pull, volatility, friction, influence_pressure = self._policy_pressures(policy)
        threshold = self._consensus_threshold(policy)

        trajectory: List[NegotiationStepMetrics] = []
        convergence_time = max_steps
        converged = False

        prior_influence = baseline_influence
        for step in range(1, max_steps + 1):
            proposals = self._step_proposals(proposals, trust_weights, pull, volatility, friction, step)
            current_influence = self._normalize([p * w for p, w in zip(proposals, trust_weights)])
            influence_shift = 0.5 * sum(abs(a - b) for a, b in zip(prior_influence, current_influence))
            prior_influence = current_influence

            consensus_distance = max(proposals) - min(proposals)
            agreement_progress = max(0.0, min(1.0, 1.0 - (consensus_distance / max(1e-6, threshold * 4.0))))

            point = NegotiationStepMetrics(
                step=step,
                mean_offer=mean(proposals),
                proposal_variance=pvariance(proposals) if len(proposals) > 1 else 0.0,
                consensus_distance=consensus_distance,
                trust_weighted_influence_shift=influence_shift,
                agreement_progress=agreement_progress,
            )
            trajectory.append(point)

            if consensus_distance <= threshold:
                convergence_time = step
                converged = True
                break

        if not trajectory:
            raise RuntimeError("simulation produced no trajectory")

        baseline_variance = pvariance(self._initial_proposals(baseline_snapshot))
        final_variance = trajectory[-1].proposal_variance
        final_influence = self._normalize([p * w for p, w in zip(proposals, trust_weights)])
        baseline_dispersion = self._dispersion(baseline_influence)
        final_dispersion = self._dispersion(final_influence)

        instability_score = self._instability_score(
            trajectory,
            policy_volatility=volatility,
            policy_influence_pressure=influence_pressure,
            converged=converged,
        )
        friction_score = self._coordination_friction_score(
            trajectory,
            policy_friction=friction,
            converged=converged,
            convergence_time=convergence_time,
            max_steps=max_steps,
        )

        risks = self._detect_governance_risks(
            policy=policy,
            instability_score=instability_score,
            friction_score=friction_score,
            convergence_time=convergence_time,
            max_steps=max_steps,
            converged=converged,
        )

        return NegotiationDynamicsReport(
            policy_id=policy.policy_id,
            trajectory=tuple(trajectory),
            convergence_time=convergence_time,
            converged=converged,
            baseline_proposal_variance=baseline_variance,
            final_proposal_variance=final_variance,
            proposal_variance_delta=final_variance - baseline_variance,
            baseline_influence_dispersion=baseline_dispersion,
            final_influence_dispersion=final_dispersion,
            influence_shift_delta=final_dispersion - baseline_dispersion,
            instability_score=instability_score,
            coordination_friction_score=friction_score,
            instability_detected=instability_score >= 0.12,
            coordination_friction_detected=friction_score >= 0.15,
            governance_risks=tuple(risks),
        )

    def _initial_proposals(self, snapshot: CooperativeStateSnapshot) -> List[float]:
        if snapshot.trust_vectors:
            proposals = []
            for idx, vector in enumerate(snapshot.trust_vectors):
                trust_mean = mean(vector.values) if vector.values else 0.5
                spread_offset = (idx - (len(snapshot.trust_vectors) - 1) / 2.0) * 0.06
                proposals.append(max(0.0, min(1.0, 0.45 + 0.4 * trust_mean + spread_offset)))
            return proposals
        return [0.35, 0.50, 0.65]

    def _trust_weights(self, snapshot: CooperativeStateSnapshot, n_agents: int) -> List[float]:
        if snapshot.trust_vectors:
            weights = [max(1e-6, mean(vector.values) if vector.values else 0.5) for vector in snapshot.trust_vectors]
            return self._normalize(weights)
        return self._normalize([1.0 for _ in range(n_agents)])

    def _step_proposals(
        self,
        proposals: Sequence[float],
        trust_weights: Sequence[float],
        pull: float,
        volatility: float,
        friction: float,
        step: int,
    ) -> List[float]:
        center = sum(p * w for p, w in zip(proposals, trust_weights))
        next_offers = []

        for idx, (proposal, weight) in enumerate(zip(proposals, trust_weights)):
            adaptation = pull * (1.0 - 0.45 * friction) * (0.65 + 0.7 * weight)
            deterministic_wave = math.sin((idx + 1) * (step * 0.9))
            turbulence = volatility * 0.09 * deterministic_wave
            updated = proposal + adaptation * (center - proposal) + turbulence
            next_offers.append(max(0.0, min(1.0, updated)))

        return next_offers

    def _policy_pressures(self, policy: PolicySchema) -> tuple[float, float, float, float]:
        pull = 0.28
        volatility = 0.0
        friction = 0.0
        influence_pressure = 0.0

        for transform in policy.transformations:
            numeric = self._coerce_numeric(transform.value)
            base = self._operator_effect(transform.operator, numeric)
            target = transform.target_metric.lower()

            if any(token in target for token in ("negotiation", "consensus", "alignment", "compromise")):
                pull += 0.65 * base
                friction -= 0.15 * base
            if any(token in target for token in ("proposal", "exploration", "divergence", "task")):
                volatility += abs(base) * 0.7
                friction += 0.35 * base
            if any(token in target for token in ("trust", "influence", "weight", "centrality")):
                influence_pressure += abs(base)
                if base > 0:
                    volatility += 0.25 * base
                else:
                    pull += 0.15 * abs(base)

        for key, value in policy.entropy_adjustments.items():
            if not isinstance(value, (int, float)):
                continue
            entropy_delta = float(value)
            if entropy_delta > 0:
                volatility += 0.6 * entropy_delta
                friction += 0.35 * entropy_delta
            else:
                pull += 0.4 * abs(entropy_delta)
                volatility += 0.15 * abs(entropy_delta)

            low_key = key.lower()
            if "target" in low_key:
                pull += 0.1 * abs(entropy_delta)

        for key, value in policy.impact_modifiers.items():
            if not isinstance(value, (int, float)):
                continue
            shift = float(value) - 1.0
            low_key = key.lower()
            if any(token in low_key for token in ("instability", "volatility", "fragment")):
                volatility += max(0.0, shift)
                friction += max(0.0, shift) * 0.5
            if any(token in low_key for token in ("coordination", "consensus", "cooperation")):
                pull += 0.25 * shift
                friction -= 0.2 * shift
            if any(token in low_key for token in ("dominance", "winner", "concentration")):
                influence_pressure += max(0.0, shift)
                volatility += 0.3 * max(0.0, shift)

        if policy.temporal_rules.persistence_mode == "sticky":
            friction += 0.03
        if policy.temporal_rules.persistence_mode == "permanent":
            friction += 0.06

        if policy.temporal_rules.auto_decay_coefficient > 0:
            pull += min(0.25, policy.temporal_rules.auto_decay_coefficient * 0.7)

        return (
            max(0.05, min(0.8, pull)),
            max(0.0, min(1.0, volatility)),
            max(0.0, min(1.0, friction)),
            max(0.0, influence_pressure),
        )

    def _consensus_threshold(self, policy: PolicySchema) -> float:
        threshold = 0.08
        for transform in policy.transformations:
            target = transform.target_metric.lower()
            numeric = abs(self._coerce_numeric(transform.value))
            if "alignment_threshold" in target:
                threshold += 0.18 * numeric
            if "consensus" in target and transform.operator == TransformationOperator.ADD:
                threshold -= 0.05 * numeric
        return max(0.03, min(0.35, threshold))

    def _instability_score(
        self,
        trajectory: Sequence[NegotiationStepMetrics],
        policy_volatility: float,
        policy_influence_pressure: float,
        converged: bool,
    ) -> float:
        if not trajectory:
            return 0.0

        variances = [point.proposal_variance for point in trajectory]
        mean_variance = mean(variances)
        variance_oscillation = math.sqrt(mean((v - mean_variance) ** 2 for v in variances))
        mean_shift = mean(point.trust_weighted_influence_shift for point in trajectory)
        max_shift = max(point.trust_weighted_influence_shift for point in trajectory)
        final_gap = trajectory[-1].consensus_distance

        score = (
            0.35 * mean_variance
            + 0.20 * variance_oscillation
            + 0.20 * mean_shift
            + 0.10 * max_shift
            + 0.10 * policy_volatility
            + 0.05 * policy_influence_pressure
            + (0.08 if not converged else 0.0)
            + 0.10 * max(0.0, final_gap - 0.10)
        )
        return max(0.0, score)

    def _coordination_friction_score(
        self,
        trajectory: Sequence[NegotiationStepMetrics],
        policy_friction: float,
        converged: bool,
        convergence_time: int,
        max_steps: int,
    ) -> float:
        if not trajectory:
            return 0.0

        progress_values = [point.agreement_progress for point in trajectory]
        final_progress = progress_values[-1]
        progress_drag = max(0.0, 1.0 - final_progress)
        slow_convergence = convergence_time / max(1, max_steps)
        early_progress = progress_values[min(len(progress_values) - 1, 2)]

        score = (
            0.30 * policy_friction
            + 0.25 * progress_drag
            + 0.20 * slow_convergence
            + 0.15 * max(0.0, 0.6 - early_progress)
            + 0.10 * mean(point.consensus_distance for point in trajectory)
            + (0.10 if not converged else 0.0)
        )
        return max(0.0, score)

    def _detect_governance_risks(
        self,
        policy: PolicySchema,
        instability_score: float,
        friction_score: float,
        convergence_time: int,
        max_steps: int,
        converged: bool,
    ) -> List[GovernanceRuleRisk]:
        risks: List[GovernanceRuleRisk] = []

        if not converged:
            risks.append(
                GovernanceRuleRisk(
                    rule_reference="temporal_rules.persistence_mode",
                    risk_type="coordination_friction",
                    severity=min(1.0, 0.55 + 0.4 * friction_score),
                    signal="Negotiation failed to converge within allocated steps.",
                )
            )

        if instability_score >= 0.18:
            risks.append(
                GovernanceRuleRisk(
                    rule_reference="transformations[*]",
                    risk_type="negotiation_instability",
                    severity=min(1.0, instability_score),
                    signal="Policy-induced proposal turbulence and influence shifts exceed stable bounds.",
                )
            )

        if convergence_time >= int(0.75 * max_steps):
            risks.append(
                GovernanceRuleRisk(
                    rule_reference="transformations[target_metric~=alignment_threshold]",
                    risk_type="coordination_friction",
                    severity=min(1.0, 0.35 + friction_score),
                    signal="Convergence latency indicates possible threshold over-constraint.",
                )
            )

        for idx, transform in enumerate(policy.transformations):
            target = transform.target_metric.lower()
            numeric = self._coerce_numeric(transform.value)
            operator = transform.operator

            if (
                any(token in target for token in ("alignment_threshold", "consensus_gate", "approval_quorum"))
                and operator == TransformationOperator.ADD
                and numeric > 0.2
            ):
                risks.append(
                    GovernanceRuleRisk(
                        rule_reference=f"transformations[{idx}]",
                        risk_type="coordination_friction",
                        severity=min(1.0, 0.45 + numeric),
                        signal="Governance gate increase is likely to slow agreement formation.",
                    )
                )

            if (
                any(token in target for token in ("trust", "influence", "weight"))
                and operator == TransformationOperator.MULTIPLY
                and numeric >= 1.35
            ):
                risks.append(
                    GovernanceRuleRisk(
                        rule_reference=f"transformations[{idx}]",
                        risk_type="negotiation_instability",
                        severity=min(1.0, 0.4 + 0.5 * (numeric - 1.0)),
                        signal="Large influence amplification may destabilize bargaining trajectories.",
                    )
                )

        return risks

    @staticmethod
    def _dispersion(values: Sequence[float]) -> float:
        if len(values) <= 1:
            return 0.0
        return pvariance(values)

    @staticmethod
    def _normalize(values: Sequence[float]) -> List[float]:
        total = sum(max(0.0, float(v)) for v in values)
        if total <= 0.0:
            if not values:
                return []
            uniform = 1.0 / len(values)
            return [uniform for _ in values]
        return [max(0.0, float(v)) / total for v in values]

    @staticmethod
    def _coerce_numeric(value: object) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return 0.0
        return 0.0

    @staticmethod
    def _operator_effect(operator: TransformationOperator, numeric_value: float) -> float:
        if operator == TransformationOperator.MULTIPLY:
            return numeric_value - 1.0
        if operator == TransformationOperator.ADD:
            return 0.6 * numeric_value
        if operator == TransformationOperator.DECAY:
            return -numeric_value
        if operator == TransformationOperator.CLAMP:
            return -0.08
        return 0.0

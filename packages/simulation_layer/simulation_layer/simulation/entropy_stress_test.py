from __future__ import annotations

import math
from statistics import mean
from typing import List, Sequence

from pydantic import BaseModel, Field

from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
from simulation_layer.models.policy import PolicySchema, TransformationOperator


class EntropyCycleMetrics(BaseModel):
    cycle: int = Field(..., ge=0)
    shannon_entropy: float = Field(..., ge=0.0)
    normalized_entropy: float = Field(..., ge=0.0, le=1.0)
    concentration_hhi: float = Field(..., ge=0.0, le=1.0)
    effective_diversity: float = Field(..., ge=1.0)
    dominance_share: float = Field(..., ge=0.0, le=1.0)
    churn: float = Field(..., ge=0.0, le=1.0)


class EntropyStressReport(BaseModel):
    policy_id: str
    trajectory: tuple[EntropyCycleMetrics, ...]
    baseline_normalized_entropy: float = Field(..., ge=0.0, le=1.0)
    final_normalized_entropy: float = Field(..., ge=0.0, le=1.0)
    entropy_delta: float
    average_churn: float = Field(..., ge=0.0, le=1.0)
    dominance_amplification_score: float = Field(..., ge=0.0)
    fragmentation_risk_score: float = Field(..., ge=0.0)
    dominance_amplification_detected: bool
    fragmentation_risk_detected: bool
    cooperative_diversity_destabilized: bool


class EntropyStressTest:
    """
    Simulates entropy trajectories over multiple cycles and flags structural risks:
    1) influence concentration amplification
    2) cooperative diversity fragmentation
    """

    def evaluate(
        self,
        policy: PolicySchema,
        baseline_snapshot: CooperativeStateSnapshot,
        cycles: int = 12,
    ) -> EntropyStressReport:
        if cycles < 1:
            raise ValueError("cycles must be >= 1")

        state = self._initial_distribution(baseline_snapshot)
        concentration_pressure, fragmentation_pressure = self._policy_pressures(policy)

        trajectory: List[EntropyCycleMetrics] = []
        previous = state
        trajectory.append(self._cycle_metrics(0, state, churn=0.0))

        for cycle in range(1, cycles + 1):
            state = self._simulate_cycle(
                previous,
                cycle=cycle,
                concentration_pressure=concentration_pressure,
                fragmentation_pressure=fragmentation_pressure,
            )
            churn = self._churn(previous, state)
            trajectory.append(self._cycle_metrics(cycle, state, churn=churn))
            previous = state

        baseline = trajectory[0]
        final = trajectory[-1]

        dominance_score = self._dominance_amplification_score(trajectory)
        fragmentation_score = self._fragmentation_risk_score(
            trajectory,
            policy_fragmentation_pressure=fragmentation_pressure,
        )

        dominance_detected = dominance_score >= 0.08 and final.dominance_share >= 0.34
        fragmentation_detected = fragmentation_score >= 0.12
        entropy_drop = baseline.normalized_entropy - final.normalized_entropy
        diversity_destabilized = (
            fragmentation_detected
            or dominance_detected
            or entropy_drop >= 0.15
        )

        return EntropyStressReport(
            policy_id=policy.policy_id,
            trajectory=tuple(trajectory),
            baseline_normalized_entropy=baseline.normalized_entropy,
            final_normalized_entropy=final.normalized_entropy,
            entropy_delta=final.normalized_entropy - baseline.normalized_entropy,
            average_churn=mean(point.churn for point in trajectory[1:]),
            dominance_amplification_score=dominance_score,
            fragmentation_risk_score=fragmentation_score,
            dominance_amplification_detected=dominance_detected,
            fragmentation_risk_detected=fragmentation_detected,
            cooperative_diversity_destabilized=diversity_destabilized,
        )

    def _simulate_cycle(
        self,
        distribution: List[float],
        cycle: int,
        concentration_pressure: float,
        fragmentation_pressure: float,
    ) -> List[float]:
        step_decay = math.exp(-0.08 * (cycle - 1))
        concentration_effect = concentration_pressure * step_decay
        exponent = max(0.35, 1.0 + concentration_effect)
        concentrated = [max(1e-9, value ** exponent) for value in distribution]
        normalized = self._normalize(concentrated)

        # Fragmentation introduces deterministic oscillatory pressure in coordination pathways.
        oscillation = 0.6 + 0.4 * math.sin(cycle * 0.8)
        fragment_scale = max(-1.0, min(1.0, fragmentation_pressure * oscillation))
        perturbed = []
        for i, value in enumerate(normalized):
            directional_wave = math.sin((i + 1) * (cycle + 0.5))
            perturb = 1.0 + (0.15 * fragment_scale * directional_wave)
            perturbed.append(max(1e-9, value * max(0.2, perturb)))
        return self._normalize(perturbed)

    def _cycle_metrics(
        self,
        cycle: int,
        distribution: Sequence[float],
        churn: float,
    ) -> EntropyCycleMetrics:
        shannon = -sum(p * math.log(p) for p in distribution if p > 0.0)
        n = len(distribution)
        max_entropy = math.log(n) if n > 1 else 1.0
        normalized_entropy = shannon / max_entropy if max_entropy > 0.0 else 0.0
        hhi = sum(p * p for p in distribution)
        effective_diversity = 1.0 / hhi if hhi > 0.0 else float(n)
        return EntropyCycleMetrics(
            cycle=cycle,
            shannon_entropy=shannon,
            normalized_entropy=max(0.0, min(1.0, normalized_entropy)),
            concentration_hhi=max(0.0, min(1.0, hhi)),
            effective_diversity=max(1.0, effective_diversity),
            dominance_share=max(distribution) if distribution else 0.0,
            churn=churn,
        )

    @staticmethod
    def _churn(previous: Sequence[float], current: Sequence[float]) -> float:
        return 0.5 * sum(abs(a - b) for a, b in zip(previous, current))

    @staticmethod
    def _normalize(values: Sequence[float]) -> List[float]:
        total = sum(max(0.0, float(v)) for v in values)
        if total <= 0.0:
            if not values:
                return []
            uniform = 1.0 / len(values)
            return [uniform for _ in values]
        return [max(0.0, float(v)) / total for v in values]

    def _initial_distribution(self, snapshot: CooperativeStateSnapshot) -> List[float]:
        if snapshot.trust_vectors:
            values = [
                mean(vector.values) if vector.values else 0.0
                for vector in snapshot.trust_vectors
            ]
            return self._normalize(values)

        if snapshot.entropy_concentration_levels:
            # Higher concentration levels imply larger initial influence share.
            concentrations = [max(0.0, level.value) for level in snapshot.entropy_concentration_levels]
            return self._normalize(concentrations)

        # Fallback for sparse snapshots.
        return [0.25, 0.25, 0.25, 0.25]

    def _policy_pressures(self, policy: PolicySchema) -> tuple[float, float]:
        concentration = 0.0
        fragmentation = 0.0

        for transform in policy.transformations:
            numeric_value = self._coerce_numeric(transform.value)
            base_effect = self._operator_effect(transform.operator, numeric_value)
            target = transform.target_metric.lower()

            if any(key in target for key in ("influence", "trust", "centrality", "reward")):
                concentration += 0.9 * base_effect
            if any(key in target for key in ("alignment", "consensus", "cooperation")):
                concentration -= 0.2 * base_effect
                fragmentation -= 0.5 * base_effect
            if any(key in target for key in ("task", "exploration", "divergence", "formation")):
                fragmentation += 0.9 * base_effect

        for key, value in policy.entropy_adjustments.items():
            if not isinstance(value, (int, float)):
                continue
            entropy_delta = float(value)
            concentration -= entropy_delta

            low_key = key.lower()
            if "target" in low_key or "shannon" in low_key:
                fragmentation += max(0.0, entropy_delta) * 0.5
                fragmentation += max(0.0, -entropy_delta) * 0.2

        for key, value in policy.impact_modifiers.items():
            if not isinstance(value, (int, float)):
                continue
            modifier_shift = float(value) - 1.0
            low_key = key.lower()
            if any(term in low_key for term in ("central", "dominance", "winner", "concentration")):
                concentration += modifier_shift
            if any(term in low_key for term in ("fragment", "volatility", "instability")):
                fragmentation += modifier_shift

        return concentration, fragmentation

    @staticmethod
    def _operator_effect(operator: TransformationOperator, numeric_value: float) -> float:
        if operator == TransformationOperator.MULTIPLY:
            return numeric_value - 1.0
        if operator == TransformationOperator.ADD:
            return 0.5 * numeric_value
        if operator == TransformationOperator.DECAY:
            return -numeric_value
        if operator == TransformationOperator.CLAMP:
            return -0.1
        return 0.0

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
    def _dominance_amplification_score(trajectory: Sequence[EntropyCycleMetrics]) -> float:
        baseline = trajectory[0]
        final = trajectory[-1]
        steps = max(1, len(trajectory) - 1)
        trend = (final.dominance_share - baseline.dominance_share) / steps

        entropy_drop = baseline.normalized_entropy - final.normalized_entropy
        hhi_increase = final.concentration_hhi - baseline.concentration_hhi
        dominance_increase = final.dominance_share - baseline.dominance_share

        score = (
            0.45 * max(0.0, dominance_increase)
            + 0.35 * max(0.0, hhi_increase)
            + 0.2 * max(0.0, entropy_drop)
            + 0.1 * max(0.0, trend)
        )
        return max(0.0, score)

    @staticmethod
    def _fragmentation_risk_score(
        trajectory: Sequence[EntropyCycleMetrics],
        policy_fragmentation_pressure: float,
    ) -> float:
        if len(trajectory) <= 1:
            return 0.0

        entropy_steps = [point.normalized_entropy for point in trajectory]
        deltas = [
            abs(entropy_steps[i] - entropy_steps[i - 1])
            for i in range(1, len(entropy_steps))
        ]
        mean_delta = mean(deltas) if deltas else 0.0
        entropy_volatility = (
            math.sqrt(mean((d - mean_delta) ** 2 for d in deltas))
            if deltas
            else 0.0
        )
        average_churn = mean(point.churn for point in trajectory[1:])
        max_churn = max(point.churn for point in trajectory[1:])

        baseline = trajectory[0]
        final = trajectory[-1]
        instability_drag = max(0.0, baseline.normalized_entropy - final.normalized_entropy)

        score = (
            0.35 * entropy_volatility
            + 0.25 * mean_delta
            + 0.25 * average_churn
            + 0.10 * max_churn
            + 0.15 * instability_drag
            + 0.10 * max(0.0, policy_fragmentation_pressure)
        )
        return max(0.0, score)

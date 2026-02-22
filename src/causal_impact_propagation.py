from __future__ import annotations

import math
from statistics import mean
from typing import Iterable, List, Sequence, Tuple

from pydantic import BaseModel, Field

from src.models.cooperative_state_snapshot import CooperativeStateSnapshot
from src.models.policy import PolicySchema, TransformationOperator


class BaselineSignals(BaseModel):
    predictive_synergy_density: float = Field(..., ge=0.0)
    cooperative_intelligence_amplification: float = Field(..., ge=0.0)
    trust_weighted_forecast_adjustment: float = Field(..., ge=0.0)
    baseline_outcome_score: float = Field(..., ge=0.0)


class HorizonImpactProjection(BaseModel):
    horizon: int = Field(..., ge=1)
    projected_predictive_synergy_density: float = Field(..., ge=0.0)
    projected_cooperative_intelligence_amplification: float = Field(..., ge=0.0)
    projected_trust_weighted_forecast_adjustment: float = Field(..., ge=0.0)
    projected_outcome_score: float = Field(..., ge=0.0)
    impact_delta_vs_baseline: float


class ImpactPropagationReport(BaseModel):
    policy_id: str
    baseline: BaselineSignals
    horizons: tuple[HorizonImpactProjection, ...]


class SynergyTensorDelta(BaseModel):
    matrix_id: str
    row_labels: tuple[str, ...]
    col_labels: tuple[str, ...]
    baseline_values: tuple[tuple[float, ...], ...]
    projected_values: tuple[tuple[float, ...], ...]
    delta_values: tuple[tuple[float, ...], ...]


class SynergyShiftHorizonProjection(BaseModel):
    horizon: int = Field(..., ge=1)
    policy_effect: float
    projected_synergy_distribution_delta_tensors: tuple[SynergyTensorDelta, ...]
    complementarity_emergence_probability_delta_tensors: tuple[SynergyTensorDelta, ...]
    marginal_cooperative_influence_variability_delta_tensors: tuple[SynergyTensorDelta, ...]


class SynergyShiftReport(BaseModel):
    policy_id: str
    horizons: tuple[SynergyShiftHorizonProjection, ...]


class CausalImpactPropagationEngine:
    """
    Simulates policy-induced parameter shifts and propagates their impact across
    multiple future horizons relative to a baseline cooperative state snapshot.
    """

    def simulate(
        self,
        policy: PolicySchema,
        baseline_snapshot: CooperativeStateSnapshot,
        horizons: Sequence[int],
    ) -> ImpactPropagationReport:
        if not horizons:
            raise ValueError("horizons must contain at least one horizon value")

        normalized_horizons = tuple(sorted(set(horizons)))
        if normalized_horizons[0] < 1:
            raise ValueError("all horizons must be >= 1")

        baseline = self._compute_baseline_signals(baseline_snapshot)
        shift = self._compute_policy_shift(policy)

        projections: List[HorizonImpactProjection] = []
        for horizon in normalized_horizons:
            policy_effect = self._effective_policy_shift(policy, shift, horizon)

            projected_psd = baseline.predictive_synergy_density * (
                1.0 + policy_effect * (0.6 + 0.4 * self._trust_signal(baseline_snapshot))
            )
            projected_cia = baseline.cooperative_intelligence_amplification * (
                1.0 + policy_effect * (0.5 + 0.5 * self._calibration_quality(baseline_snapshot))
            )
            projected_tfa = baseline.trust_weighted_forecast_adjustment * (
                1.0 + policy_effect * (0.4 + 0.6 * self._trust_signal(baseline_snapshot))
            )

            projected_outcome = self._compose_outcome(projected_psd, projected_cia, projected_tfa)

            projections.append(
                HorizonImpactProjection(
                    horizon=horizon,
                    projected_predictive_synergy_density=max(0.0, projected_psd),
                    projected_cooperative_intelligence_amplification=max(0.0, projected_cia),
                    projected_trust_weighted_forecast_adjustment=max(0.0, projected_tfa),
                    projected_outcome_score=max(0.0, projected_outcome),
                    impact_delta_vs_baseline=projected_outcome - baseline.baseline_outcome_score,
                )
            )

        return ImpactPropagationReport(
            policy_id=policy.policy_id,
            baseline=baseline,
            horizons=tuple(projections),
        )

    def _compute_baseline_signals(self, snapshot: CooperativeStateSnapshot) -> BaselineSignals:
        synergy_density = self._synergy_density(snapshot)
        intelligence_density = self._intelligence_density(snapshot)
        trust_signal = self._trust_signal(snapshot)
        calibration_quality = self._calibration_quality(snapshot)

        predictive_synergy_density = synergy_density * (0.5 + 0.5 * calibration_quality)
        cooperative_intelligence_amplification = intelligence_density * (1.0 + 0.25 * synergy_density)
        trust_weighted_forecast_adjustment = trust_signal * calibration_quality

        baseline_outcome = self._compose_outcome(
            predictive_synergy_density,
            cooperative_intelligence_amplification,
            trust_weighted_forecast_adjustment,
        )

        return BaselineSignals(
            predictive_synergy_density=max(0.0, predictive_synergy_density),
            cooperative_intelligence_amplification=max(0.0, cooperative_intelligence_amplification),
            trust_weighted_forecast_adjustment=max(0.0, trust_weighted_forecast_adjustment),
            baseline_outcome_score=max(0.0, baseline_outcome),
        )

    @staticmethod
    def _compose_outcome(psd: float, cia: float, tfa: float) -> float:
        return (0.5 * psd) + (0.3 * cia) + (0.2 * tfa)

    def _compute_policy_shift(self, policy: PolicySchema) -> float:
        modifier_values = [v for v in policy.impact_modifiers.values() if isinstance(v, (int, float))]
        modifier_term = (mean(modifier_values) - 1.0) if modifier_values else 0.0

        entropy_term = sum(
            float(v) for v in policy.entropy_adjustments.values() if isinstance(v, (int, float))
        )

        transform_term = 0.0
        for transform in policy.transformations:
            numeric_value = self._coerce_numeric(transform.value)
            operator_weight = {
                TransformationOperator.ADD: 0.02,
                TransformationOperator.MULTIPLY: 0.05,
                TransformationOperator.CLAMP: 0.01,
                TransformationOperator.DECAY: -0.03,
                TransformationOperator.CUSTOM: 0.0,
            }[transform.operator]
            transform_term += operator_weight * numeric_value

        if policy.transformations:
            transform_term /= len(policy.transformations)

        constraint_term = 0.005 * len(policy.constraints)
        return modifier_term + entropy_term + transform_term + constraint_term

    def _effective_policy_shift(self, policy: PolicySchema, shift: float, horizon: int) -> float:
        temporal = policy.temporal_rules
        decay = max(0.0, float(temporal.auto_decay_coefficient))
        attenuation = math.exp(-decay * horizon)

        if temporal.duration_steps is None or horizon <= temporal.duration_steps:
            lifecycle_weight = 1.0
        elif temporal.persistence_mode == "transient":
            lifecycle_weight = 0.0
        elif temporal.persistence_mode == "sticky":
            lifecycle_weight = 0.5
        else:
            lifecycle_weight = 1.0

        return shift * attenuation * lifecycle_weight

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
    def _flatten(values: Iterable[Iterable[float]]) -> List[float]:
        flat: List[float] = []
        for seq in values:
            flat.extend(float(v) for v in seq)
        return flat

    def _synergy_density(self, snapshot: CooperativeStateSnapshot) -> float:
        if not snapshot.synergy_density_matrices:
            return 0.0

        all_values: List[float] = []
        for matrix in snapshot.synergy_density_matrices:
            all_values.extend(self._flatten(matrix.values))
        return mean(all_values) if all_values else 0.0

    def _intelligence_density(self, snapshot: CooperativeStateSnapshot) -> float:
        if not snapshot.cooperative_intelligence_distributions:
            return 0.0

        values = self._flatten(d.values for d in snapshot.cooperative_intelligence_distributions)
        return mean(values) if values else 0.0

    def _trust_signal(self, snapshot: CooperativeStateSnapshot) -> float:
        if not snapshot.trust_vectors:
            return 0.5

        values = self._flatten(v.values for v in snapshot.trust_vectors)
        return mean(values) if values else 0.5

    def _calibration_quality(self, snapshot: CooperativeStateSnapshot) -> float:
        curves = snapshot.predictive_calibration_curves
        if not curves:
            return 0.5

        errors: List[float] = []
        for curve in curves:
            for point in curve.points:
                errors.append(abs(point.predicted - point.observed))

        if not errors:
            return 0.5

        return max(0.0, min(1.0, 1.0 - mean(errors)))


class SynergyShiftAnalyzer(CausalImpactPropagationEngine):
    """
    Produces horizon-indexed synergy delta tensors for agent-combination patterns.
    """

    def analyze(
        self,
        policy: PolicySchema,
        baseline_snapshot: CooperativeStateSnapshot,
        horizons: Sequence[int],
    ) -> SynergyShiftReport:
        if not horizons:
            raise ValueError("horizons must contain at least one horizon value")

        normalized_horizons = tuple(sorted(set(horizons)))
        if normalized_horizons[0] < 1:
            raise ValueError("all horizons must be >= 1")

        shift = self._compute_policy_shift(policy)
        trust_signal = self._trust_signal(baseline_snapshot)
        calibration_quality = self._calibration_quality(baseline_snapshot)
        trust_by_entity = self._mean_trust_by_entity(baseline_snapshot)

        horizon_tensors: List[SynergyShiftHorizonProjection] = []
        for horizon in normalized_horizons:
            policy_effect = self._effective_policy_shift(policy, shift, horizon)

            synergy_deltas: List[SynergyTensorDelta] = []
            complementarity_deltas: List[SynergyTensorDelta] = []
            variability_deltas: List[SynergyTensorDelta] = []

            for matrix in baseline_snapshot.synergy_density_matrices:
                baseline_matrix = matrix.values
                projected_matrix = self._project_synergy_matrix(
                    baseline_matrix=baseline_matrix,
                    row_labels=matrix.row_labels,
                    col_labels=matrix.col_labels,
                    policy_effect=policy_effect,
                    trust_signal=trust_signal,
                    calibration_quality=calibration_quality,
                    trust_by_entity=trust_by_entity,
                )

                baseline_distribution = self._normalize_matrix(baseline_matrix)
                projected_distribution = self._normalize_matrix(projected_matrix)
                distribution_delta = self._matrix_delta(projected_distribution, baseline_distribution)
                synergy_deltas.append(
                    SynergyTensorDelta(
                        matrix_id=matrix.matrix_id,
                        row_labels=matrix.row_labels,
                        col_labels=matrix.col_labels,
                        baseline_values=baseline_distribution,
                        projected_values=projected_distribution,
                        delta_values=distribution_delta,
                    )
                )

                baseline_complementarity = self._complementarity_probabilities(
                    baseline_distribution,
                    matrix.row_labels,
                    matrix.col_labels,
                    trust_by_entity,
                )
                projected_complementarity = self._complementarity_probabilities(
                    projected_distribution,
                    matrix.row_labels,
                    matrix.col_labels,
                    trust_by_entity,
                )
                complementarity_deltas.append(
                    SynergyTensorDelta(
                        matrix_id=matrix.matrix_id,
                        row_labels=matrix.row_labels,
                        col_labels=matrix.col_labels,
                        baseline_values=baseline_complementarity,
                        projected_values=projected_complementarity,
                        delta_values=self._matrix_delta(
                            projected_complementarity, baseline_complementarity
                        ),
                    )
                )

                baseline_variability = self._marginal_influence_variability(
                    baseline_distribution
                )
                projected_variability = self._marginal_influence_variability(
                    projected_distribution
                )
                variability_deltas.append(
                    SynergyTensorDelta(
                        matrix_id=matrix.matrix_id,
                        row_labels=matrix.row_labels,
                        col_labels=matrix.col_labels,
                        baseline_values=baseline_variability,
                        projected_values=projected_variability,
                        delta_values=self._matrix_delta(projected_variability, baseline_variability),
                    )
                )

            horizon_tensors.append(
                SynergyShiftHorizonProjection(
                    horizon=horizon,
                    policy_effect=policy_effect,
                    projected_synergy_distribution_delta_tensors=tuple(synergy_deltas),
                    complementarity_emergence_probability_delta_tensors=tuple(complementarity_deltas),
                    marginal_cooperative_influence_variability_delta_tensors=tuple(
                        variability_deltas
                    ),
                )
            )

        return SynergyShiftReport(policy_id=policy.policy_id, horizons=tuple(horizon_tensors))

    @staticmethod
    def _mean_trust_by_entity(snapshot: CooperativeStateSnapshot) -> dict[str, float]:
        trust_by_entity: dict[str, float] = {}
        for vector in snapshot.trust_vectors:
            trust_by_entity[vector.entity_id] = mean(vector.values) if vector.values else 0.5
        return trust_by_entity

    def _project_synergy_matrix(
        self,
        baseline_matrix: tuple[tuple[float, ...], ...],
        row_labels: tuple[str, ...],
        col_labels: tuple[str, ...],
        policy_effect: float,
        trust_signal: float,
        calibration_quality: float,
        trust_by_entity: dict[str, float],
    ) -> tuple[tuple[float, ...], ...]:
        projected: List[Tuple[float, ...]] = []
        for i, row in enumerate(baseline_matrix):
            out_row: List[float] = []
            for j, cell in enumerate(row):
                pair_signal = self._pair_signal(
                    row_labels[i], col_labels[j], trust_signal, calibration_quality, trust_by_entity
                )
                amplified = float(cell) * (1.0 + policy_effect * pair_signal)
                out_row.append(max(0.0, amplified))
            projected.append(tuple(out_row))
        return tuple(projected)

    @staticmethod
    def _pair_signal(
        row_label: str,
        col_label: str,
        trust_signal: float,
        calibration_quality: float,
        trust_by_entity: dict[str, float],
    ) -> float:
        row_trust = trust_by_entity.get(row_label, trust_signal)
        col_trust = trust_by_entity.get(col_label, trust_signal)
        pair_trust = 0.5 * (row_trust + col_trust)
        return max(0.0, min(1.5, 0.55 * pair_trust + 0.45 * calibration_quality))

    @staticmethod
    def _normalize_matrix(matrix: tuple[tuple[float, ...], ...]) -> tuple[tuple[float, ...], ...]:
        total = sum(sum(float(v) for v in row) for row in matrix)
        if total <= 0.0:
            rows = len(matrix)
            cols = len(matrix[0]) if rows else 0
            if rows == 0 or cols == 0:
                return tuple()
            uniform_value = 1.0 / (rows * cols)
            return tuple(tuple(uniform_value for _ in range(cols)) for _ in range(rows))

        return tuple(
            tuple(float(v) / total for v in row)
            for row in matrix
        )

    @staticmethod
    def _matrix_delta(
        projected: tuple[tuple[float, ...], ...],
        baseline: tuple[tuple[float, ...], ...],
    ) -> tuple[tuple[float, ...], ...]:
        return tuple(
            tuple(projected[i][j] - baseline[i][j] for j in range(len(projected[i])))
            for i in range(len(projected))
        )

    def _complementarity_probabilities(
        self,
        distribution: tuple[tuple[float, ...], ...],
        row_labels: tuple[str, ...],
        col_labels: tuple[str, ...],
        trust_by_entity: dict[str, float],
    ) -> tuple[tuple[float, ...], ...]:
        probs: List[Tuple[float, ...]] = []
        for i, row in enumerate(distribution):
            out_row: List[float] = []
            for j, value in enumerate(row):
                row_trust = trust_by_entity.get(row_labels[i], 0.5)
                col_trust = trust_by_entity.get(col_labels[j], 0.5)
                trust_gap = abs(row_trust - col_trust)
                # Higher joint synergy and heterogeneous trust profiles imply stronger complementarity emergence.
                score = (3.0 * float(value)) + (0.8 * trust_gap) - 1.0
                out_row.append(1.0 / (1.0 + math.exp(-score)))
            probs.append(tuple(out_row))
        return tuple(probs)

    @staticmethod
    def _marginal_influence_variability(
        distribution: tuple[tuple[float, ...], ...]
    ) -> tuple[tuple[float, ...], ...]:
        if not distribution:
            return tuple()

        row_marginals = [sum(row) for row in distribution]
        col_marginals = [sum(distribution[i][j] for i in range(len(distribution))) for j in range(len(distribution[0]))]

        pair_marginals: List[List[float]] = []
        flat_values: List[float] = []
        for i in range(len(distribution)):
            row_values: List[float] = []
            for j in range(len(distribution[i])):
                value = 0.5 * (row_marginals[i] + col_marginals[j])
                row_values.append(value)
                flat_values.append(value)
            pair_marginals.append(row_values)

        global_mean = mean(flat_values) if flat_values else 0.0
        return tuple(
            tuple(abs(value - global_mean) for value in row)
            for row in pair_marginals
        )

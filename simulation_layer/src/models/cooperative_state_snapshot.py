from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TrustVector(BaseModel):
    entity_id: str = Field(..., description="Unique identifier for the trust-bearing entity.")
    values: Tuple[float, ...] = Field(..., description="Ordered trust dimensions for the entity.")

    model_config = ConfigDict(frozen=True)


class CooperativeIntelligenceDistribution(BaseModel):
    domain: str = Field(..., description="Intelligence domain or slice.")
    values: Tuple[float, ...] = Field(..., description="Ordered distribution values.")

    model_config = ConfigDict(frozen=True)


class SynergyDensityMatrix(BaseModel):
    matrix_id: str = Field(..., description="Unique matrix identifier.")
    row_labels: Tuple[str, ...] = Field(..., description="Ordered row labels.")
    col_labels: Tuple[str, ...] = Field(..., description="Ordered column labels.")
    values: Tuple[Tuple[float, ...], ...] = Field(..., description="2D density matrix values.")

    @model_validator(mode="after")
    def validate_shape(self) -> "SynergyDensityMatrix":
        row_labels = self.row_labels
        col_labels = self.col_labels
        matrix = self.values

        if len(matrix) != len(row_labels):
            raise ValueError("Synergy matrix row count must match row_labels length.")
        for row in matrix:
            if len(row) != len(col_labels):
                raise ValueError("Each synergy matrix row must match col_labels length.")
        return self

    model_config = ConfigDict(frozen=True)


class EntropyConcentrationLevel(BaseModel):
    scope: str = Field(..., description="Subsystem scope for entropy concentration.")
    value: float = Field(..., description="Concentration value for the scoped subsystem.")

    model_config = ConfigDict(frozen=True)


class PredictiveCalibrationPoint(BaseModel):
    predicted: float = Field(..., description="Predicted probability or score.")
    observed: float = Field(..., description="Observed outcome rate.")
    support: Optional[int] = Field(None, description="Optional support count for the point.")

    model_config = ConfigDict(frozen=True)


class PredictiveCalibrationCurve(BaseModel):
    curve_id: str = Field(..., description="Identifier for the calibrated model or metric.")
    points: Tuple[PredictiveCalibrationPoint, ...] = Field(
        ..., description="Ordered calibration points."
    )

    model_config = ConfigDict(frozen=True)


class CausalNode(BaseModel):
    node_id: str = Field(..., description="Task node identifier.")
    attributes: Tuple[Tuple[str, Any], ...] = Field(
        default_factory=tuple, description="Immutable sorted key/value attributes."
    )

    @field_validator("attributes", mode="before")
    @classmethod
    def normalize_attributes(cls, v: Any) -> Tuple[Tuple[str, Any], ...]:
        if v is None:
            return tuple()
        if isinstance(v, Mapping):
            return tuple((k, v[k]) for k in sorted(v))
        if isinstance(v, Sequence):
            return tuple(v)
        raise ValueError("attributes must be a mapping or a sequence of key/value pairs.")

    model_config = ConfigDict(frozen=True)


class CausalEdge(BaseModel):
    source: str = Field(..., description="Source task node id.")
    target: str = Field(..., description="Target task node id.")
    weight: float = Field(..., description="Causal influence weight.")
    lag: Optional[int] = Field(None, description="Optional temporal lag in steps.")

    model_config = ConfigDict(frozen=True)


class ActiveTaskCausalGraph(BaseModel):
    graph_id: str = Field(..., description="Unique graph identifier.")
    nodes: Tuple[CausalNode, ...] = Field(..., description="Immutable ordered task nodes.")
    edges: Tuple[CausalEdge, ...] = Field(..., description="Immutable ordered causal edges.")

    model_config = ConfigDict(frozen=True)


def _canonicalize(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return _canonicalize(value.model_dump())
    if isinstance(value, Mapping):
        return {k: _canonicalize(value[k]) for k in sorted(value)}
    if isinstance(value, tuple):
        return [_canonicalize(v) for v in value]
    if isinstance(value, list):
        return [_canonicalize(v) for v in value]
    return value


class CooperativeStateSnapshot(BaseModel):
    """
    Immutable snapshot of the full pre-simulation cooperative system state.
    """

    schema_version: str = Field("1.0.0", description="Snapshot schema version.")
    simulation_id: str = Field(..., description="Simulation run identifier.")
    capture_step: int = Field(..., description="Step index at which state is captured.")
    random_seed: Optional[int] = Field(
        None, description="Optional deterministic seed for replay alignment."
    )

    trust_vectors: Tuple[TrustVector, ...] = Field(default_factory=tuple)
    cooperative_intelligence_distributions: Tuple[CooperativeIntelligenceDistribution, ...] = (
        Field(default_factory=tuple)
    )
    synergy_density_matrices: Tuple[SynergyDensityMatrix, ...] = Field(default_factory=tuple)
    entropy_concentration_levels: Tuple[EntropyConcentrationLevel, ...] = Field(
        default_factory=tuple
    )
    predictive_calibration_curves: Tuple[PredictiveCalibrationCurve, ...] = Field(
        default_factory=tuple
    )
    active_task_causal_graphs: Tuple[ActiveTaskCausalGraph, ...] = Field(default_factory=tuple)
    metadata: Tuple[Tuple[str, Any], ...] = Field(
        default_factory=tuple, description="Immutable sorted metadata key/value pairs."
    )
    state_digest: Optional[str] = Field(
        None, description="Canonical SHA-256 digest of this snapshot state."
    )

    @field_validator("metadata", mode="before")
    @classmethod
    def normalize_metadata(cls, v: Any) -> Tuple[Tuple[str, Any], ...]:
        if v is None:
            return tuple()
        if isinstance(v, Mapping):
            return tuple((k, v[k]) for k in sorted(v))
        if isinstance(v, Sequence):
            return tuple(v)
        raise ValueError("metadata must be a mapping or a sequence of key/value pairs.")

    @model_validator(mode="before")
    @classmethod
    def deterministic_ordering(cls, values: Any) -> Any:
        if not isinstance(values, dict):
            return values

        def get_key(item: Any, key_name: str) -> Any:
            if isinstance(item, dict):
                return item.get(key_name)
            return getattr(item, key_name, None)

        def sort_items(items: Any, key_name: str) -> Any:
            if items is None:
                return items
            return sorted(items, key=lambda item: get_key(item, key_name))

        values["trust_vectors"] = sort_items(values.get("trust_vectors", ()), "entity_id")
        values["cooperative_intelligence_distributions"] = sort_items(
            values.get("cooperative_intelligence_distributions", ()), "domain"
        )
        values["synergy_density_matrices"] = sort_items(
            values.get("synergy_density_matrices", ()), "matrix_id"
        )
        values["entropy_concentration_levels"] = sort_items(
            values.get("entropy_concentration_levels", ()), "scope"
        )
        values["predictive_calibration_curves"] = sort_items(
            values.get("predictive_calibration_curves", ()), "curve_id"
        )
        values["active_task_causal_graphs"] = sort_items(
            values.get("active_task_causal_graphs", ()), "graph_id"
        )
        return values

    @model_validator(mode="after")
    def ensure_digest(self) -> "CooperativeStateSnapshot":
        as_dict = self.model_dump()
        provided = as_dict.get("state_digest")
        calculated = self.calculate_digest(as_dict)
        if provided is None:
            object.__setattr__(self, "state_digest", calculated)
        elif provided != calculated:
            raise ValueError("state_digest does not match canonical snapshot content.")
        return self

    @classmethod
    def calculate_digest(cls, values: Dict[str, Any]) -> str:
        payload = {k: v for k, v in values.items() if k != "state_digest"}
        canonical = _canonicalize(payload)
        encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def to_canonical_json(self) -> str:
        canonical = _canonicalize(self.model_dump(exclude_none=True))
        return json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

    def verify_digest(self) -> bool:
        return self.state_digest == self.calculate_digest(self.model_dump())

    model_config = ConfigDict(frozen=True)

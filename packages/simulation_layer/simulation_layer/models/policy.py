from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

class TransformationOperator(str, Enum):
    ADD = "add"
    MULTIPLY = "multiply"
    CLAMP = "clamp"
    DECAY = "decay"
    CUSTOM = "custom"

class ExecutableConstraint(BaseModel):
    """Represents a logic-based constraint that can be evaluated during simulation."""
    expression: str = Field(..., description="A string-based logical expression or DSL component.")
    threshold: Optional[float] = None
    action: str = Field(..., description="Action to take if constraint is violated: 'block', 'scale', 'log'.")

class InfluenceTransformation(BaseModel):
    """Defines how agent influence is transformed by the policy."""
    metric_source: str = Field(..., description="The metric used as input for the transformation.")
    operator: TransformationOperator
    value: Union[float, str] = Field(..., description="Value or expression for the transformation.")
    target_metric: str = Field(..., description="The resulting influence metric after transformation.")

class ScopeBoundaries(BaseModel):
    """Defines where and to whom the policy applies."""
    agent_categories: List[str] = Field(default_factory=list, description="Categories of agents affected.")
    task_domains: List[str] = Field(default_factory=list, description="Domains of activity affected.")
    context_filters: Dict[str, Any] = Field(default_factory=dict, description="Key-value pairs for contextual application filters.")
    exclusion_logic: Optional[str] = Field(None, description="DSL expression to exclude specific entities from the policy scope.")

class TemporalRules(BaseModel):
    """Persistence and lifecycle rules for the policy."""
    activation_trigger: Optional[str] = Field(None, description="Expression defining when the policy activates.")
    duration_steps: Optional[int] = Field(None, description="Number of simulation steps the policy remains active.")
    auto_decay_coefficient: float = Field(0.0, description="Rate at which the policy's effect decays over time.")
    persistence_mode: str = Field("transient", description="Lifecycle behavior: transient, sticky, or permanent.")

class PolicySchema(BaseModel):
    """
    Represents a governance rule as executable constraints and influence transformations.
    Designed for the Policy Simulation Layer to evaluate cooperative impact and synergy.
    """
    # Versioning and Identity
    policy_id: str = Field(..., description="Unique identifier for the policy.")
    name: str = Field(..., description="Human-readable name of the policy.")
    version: str = Field("1.0.0", description="SemVer-compatible version string.")
    previous_version_id: Optional[str] = Field(None, description="ID of the policy this version succeeds for traceability.")
    
    # Execution Logic
    scope: ScopeBoundaries = Field(..., description="Defines the application boundaries of the policy.")
    constraints: List[ExecutableConstraint] = Field(
        default_factory=list, 
        description="Set of executable logical constraints."
    )
    transformations: List[InfluenceTransformation] = Field(
        default_factory=list, 
        description="Influence weight transformations applied to affected entities."
    )
    
    # Systemic Impact
    affected_metrics: List[str] = Field(
        ..., 
        description="List of cooperative metrics (e.g., 'synergy_density', 'collective_iq') affected by this policy."
    )
    entropy_adjustments: Dict[str, float] = Field(
        default_factory=dict, 
        description="Adjustments to system entropy to maintain or encourage diversity."
    )
    impact_modifiers: Dict[str, float] = Field(
        default_factory=dict, 
        description="Projected downstream impact multipliers or shifts."
    )
    
    # Temporal Dynamics
    temporal_rules: TemporalRules = Field(..., description="Rules governing the temporal persistence of the policy.")
    
    # Traceability and Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=lambda: {
            "created_at": datetime.utcnow().isoformat(),
            "origin_context": "simulation_init",
            "author_id": "system_admin",
            "rationale": "Base governance rule initialization."
        },
        description="Metadata for auditing, traceability, and historical analysis."
    )

    class Config:
        schema_extra = {
            "example": {
                "policy_id": "pol-882-synergy",
                "name": "Cooperative Synergy Amplification",
                "version": "1.0.0",
                "scope": {
                    "agent_categories": ["high_trust_nodes"],
                    "task_domains": ["strategic_planning"]
                },
                "transformations": [
                    {
                        "metric_source": "trust_coefficient",
                        "operator": "multiply",
                        "value": 1.2,
                        "target_metric": "influence_weight"
                    }
                ],
                "affected_metrics": ["synergy_density", "trust_alignment"],
                "entropy_adjustments": {"shannon_entropy_target": +0.02},
                "impact_modifiers": {"downstream_synergy": 1.15},
                "temporal_rules": {
                    "duration_steps": 500,
                    "persistence_mode": "sticky"
                },
                "metadata": {
                    "created_at": "2026-02-22T11:55:00Z",
                    "rationale": "Incentivize high-trust collaboration in strategic domains."
                }
            }
        }

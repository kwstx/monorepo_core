from __future__ import annotations

from dataclasses import dataclass
from importlib import import_module
from typing import Any, Callable, Dict, Mapping, MutableMapping, Optional, Protocol

from .config import AutonomyConfig
from .engine import AutonomyCore


class StateBackend(Protocol):
    name: str


@dataclass
class InMemoryStateBackend:
    name: str = "memory"


@dataclass
class SqliteStateBackend:
    name: str = "sqlite"


@dataclass
class RedisStateBackend:
    name: str = "redis"


Factory = Callable[[AutonomyConfig, "AutonomyContainer"], Any]


class AutonomyContainer:
    """Centralized dependency builder for Autonomy Core."""

    def __init__(
        self,
        config: Optional[AutonomyConfig] = None,
        overrides: Optional[Mapping[str, Mapping[str, Factory]]] = None,
    ) -> None:
        self.config = config or AutonomyConfig()
        self._instances: Dict[str, Any] = {}
        self._factories = self._build_factories(overrides or {})

    def build_core(self) -> AutonomyCore:
        return AutonomyCore(
            identity=self.resolve("identity"),
            enforcement=self.resolve("enforcement"),
            economic=self.resolve("economic"),
            coordination=self.resolve("coordination"),
            scoring=self.resolve("scoring"),
            simulation=self.resolve("simulation"),
            governance=self.resolve("governance"),
            task_formation=self.resolve_optional("task_formation"),
        )

    def resolve(self, dependency: str) -> Any:
        if dependency in self._instances:
            return self._instances[dependency]

        implementation = self.config.implementation_for(dependency)
        options = self._factories.get(dependency, {})
        if implementation not in options:
            available = ", ".join(sorted(options.keys())) or "<none>"
            raise ValueError(
                f"No factory found for '{dependency}' implementation "
                f"'{implementation}'. Available: {available}"
            )
        instance = options[implementation](self.config, self)
        self._instances[dependency] = instance
        return instance

    def resolve_optional(self, dependency: str) -> Any:
        if dependency == "task_formation" and not self.config.is_enabled("task_formation"):
            return None
        return self.resolve(dependency)

    def state_backend(self) -> StateBackend:
        backend = self.config.state_backend
        if backend == "memory":
            return InMemoryStateBackend()
        if backend == "sqlite":
            return SqliteStateBackend()
        if backend == "redis":
            return RedisStateBackend()
        raise ValueError(f"Unsupported state backend: {backend}")

    def _build_factories(
        self, overrides: Mapping[str, Mapping[str, Factory]]
    ) -> Dict[str, Dict[str, Factory]]:
        factories: Dict[str, Dict[str, Factory]] = {
            "identity": {"default": _constructor_factory("identity_system", "IdentitySystem")},
            "enforcement": {"default": _constructor_factory("enforcement_layer", "EnforcementLayer")},
            "economic": {"default": _constructor_factory("economic_autonomy", "EconomicAutonomy")},
            "coordination": {"default": _constructor_factory("a2a_coordination", "A2ACoordination")},
            "scoring": {"default": _constructor_factory("scorring_module", "ScoringModule")},
            "simulation": {"default": _constructor_factory("simulation_layer", "SimulationLayer")},
            "governance": {
                "default": _constructor_factory("self_improvement_governance", "GovernanceModule")
            },
            "task_formation": {"default": _constructor_factory("task_formation", "TaskFormation")},
            "state_backend": {
                "memory": lambda _cfg, _container: InMemoryStateBackend(),
                "sqlite": lambda _cfg, _container: SqliteStateBackend(),
                "redis": lambda _cfg, _container: RedisStateBackend(),
            },
        }

        merged: MutableMapping[str, Dict[str, Factory]] = {k: dict(v) for k, v in factories.items()}
        for dependency, implementations in overrides.items():
            merged.setdefault(dependency, {}).update(implementations)
        return dict(merged)


def _constructor_factory(module_name: str, class_name: str) -> Factory:
    def _factory(_cfg: AutonomyConfig, _container: AutonomyContainer) -> Any:
        module = import_module(module_name)
        constructor = getattr(module, class_name)
        return constructor()

    return _factory

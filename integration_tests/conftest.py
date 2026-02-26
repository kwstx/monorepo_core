import pytest

from autonomy_core import AutonomyConfig, AutonomyContainer
from autonomy_core.state import InMemoryStateStore


@pytest.fixture()
def container() -> AutonomyContainer:
    config = AutonomyConfig(state_backend="memory")
    return AutonomyContainer(config)


@pytest.fixture()
def state_store(container: AutonomyContainer) -> InMemoryStateStore:
    store = container.resolve("state_backend")
    assert isinstance(store, InMemoryStateStore)
    return store


@pytest.fixture()
def core(container: AutonomyContainer):
    return container.build_core()


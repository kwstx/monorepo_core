# The packages are now installed in editable mode via the root pyproject.toml
import logging
from autonomy_core import AutonomyCore
from autonomy_core.schemas.models import ActionAuthorizationRequest
import asyncio
from identity_system import IdentitySystem
from enforcement_layer import EnforcementLayer
from economic_autonomy import EconomicAutonomy
from a2a_coordination import A2ACoordination
from scorring_module import ScoringModule
from simulation_layer import SimulationLayer
from self_improvement_governance import GovernanceModule
from task_formation import TaskFormation

def get_core():
    return AutonomyCore(
        identity=IdentitySystem(),
        enforcement=EnforcementLayer(),
        economic=EconomicAutonomy(),
        coordination=A2ACoordination(),
        scoring=ScoringModule(),
        simulation=SimulationLayer(),
        governance=GovernanceModule(),
        task_formation=TaskFormation()
    )


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def main():
    print("--- Initializing AutonomyCore ---")
    core = get_core()
    
    agent_id = "agent_007"
    action = {"network": "ethereum", "gas_limit": 500000}
    request = ActionAuthorizationRequest(agent_id=agent_id, action_id="test_action_001", action_type="deploy_smart_contract", payload=action)
    
    print(f"\n--- Testing authorization for {agent_id} ---")
    print(f"Action Request: {request}\n")
    
    try:
        result = await core.authorize_action(request)
        print(f"\n--- Authorization Result ---")
        print(f"Status: {'GRANTED' if result.is_authorized else 'DENIED'}")
    except Exception as e:
        print(f"\n--- Authorization Failed with Exception ---")
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

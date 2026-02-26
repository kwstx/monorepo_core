# The packages are now installed in editable mode via the root pyproject.toml
import logging
from autonomy_core import AutonomyCore
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
    action = {"type": "deploy_smart_contract", "network": "ethereum", "gas_limit": 500000}
    
    print(f"\n--- Testing authorization for {agent_id} ---")
    print(f"Action Payload: {action}\n")
    
    result = await core.authorize_action(agent_id, action)
    
    print(f"\n--- Authorization Result ---")
    print(f"Status: {'GRANTED' if result else 'DENIED'}")

if __name__ == "__main__":
    asyncio.run(main())

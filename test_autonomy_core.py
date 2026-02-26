# The packages are now installed in editable mode via the root pyproject.toml
import logging
from autonomy_core import AutonomyConfig, AutonomyContainer
from autonomy_core.schemas.models import ActionAuthorizationRequest
import asyncio

def get_core():
    return AutonomyContainer(AutonomyConfig()).build_core()


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def main():
    print("--- Initializing AutonomyCore ---")
    core = get_core()
    
    agent_id = "agent_007"
    action = {"network": "ethereum", "gas_limit": 500000}
    request = ActionAuthorizationRequest(agent_id=agent_id, action_type="deploy_smart_contract", payload=action)
    
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

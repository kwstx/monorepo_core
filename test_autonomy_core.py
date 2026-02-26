# The packages are now installed in editable mode via the root pyproject.toml
import logging
from autonomy_core import AutonomyCore


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    print("--- Initializing AutonomyCore ---")
    core = AutonomyCore()
    
    agent_id = "agent_007"
    action = {"type": "deploy_smart_contract", "network": "ethereum", "gas_limit": 500000}
    
    print(f"\n--- Testing authorization for {agent_id} ---")
    print(f"Action Payload: {action}\n")
    
    result = core.authorize_action(agent_id, action)
    
    print(f"\n--- Authorization Result ---")
    print(f"Status: {'GRANTED' if result else 'DENIED'}")

if __name__ == "__main__":
    main()

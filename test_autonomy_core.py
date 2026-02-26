import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))

# Add the autonomy_core package
sys.path.insert(0, os.path.join(current_dir, 'autonomy_core'))

# Also add the individual packages so they can be imported
packages_dir = os.path.join(current_dir, 'packages')
if os.path.isdir(packages_dir):
    for d in os.listdir(packages_dir):
        pkg_path = os.path.join(packages_dir, d)
        if os.path.isdir(pkg_path):
            sys.path.insert(0, pkg_path)

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

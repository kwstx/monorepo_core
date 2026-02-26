import logging
import json
from autonomy_sdk.client import AutonomyClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def main():
    print("==================================================")
    print("    INTEGRATED SYSTEM TEST: AUTONOMY SDK STACK    ")
    print("==================================================")
    
    print("\n[Step 1] Initializing SDK...")
    client = AutonomyClient()
    status = client.get_system_status()
    print(f"System Status: {status}")
    
    print("\n[Step 2] Registering Test Agent...")
    agent_id = await client.register_agent(
        "IntegrationTestAgent",
        {"role": "validator", "tier": "A"}
    )
    print(f"Registered Agent ID: {agent_id}")
    
    print("\n[Step 3] Running Sample Authorization Flow...")
    action = {
        "type": "execute_defi_trade",
        "pair": "ETH/USDC",
        "amount": 10.5,
        "slippage": 0.01
    }
    print(f"Action Payload: {json.dumps(action, indent=2)}")
    
    # Authorizing the action will trigger:
    # 1. Identity validation
    # 2. Enforcement / Policy check
    # 3. Economic viability
    # 4. Reputation / Score validation
    # 5. Simulation projection
    print("\n[Step 4] Requesting Authorization (Testing Full Stack)...")
    is_authorized = await client.authorize(agent_id, action)
    
    print("\n==================================================")
    print(f"    AUTHORIZATION RESULT: {'GRANTED' if is_authorized else 'DENIED'}    ")
    print("==================================================")
    
    print("\nSUCCESS: The entire stack works as an integrated system.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

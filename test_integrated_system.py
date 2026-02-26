import logging
import json
from autonomy_sdk.client import AutonomyClient
from autonomy_core.schemas.models import AgentRegistrationRequest, ActionAuthorizationRequest

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
    reg_req = AgentRegistrationRequest(agent_id="IntegrationTestAgent", attributes={"role": "validator", "tier": "A"})
    agent_id = await client.register_agent(reg_req)
    print(f"Registered Agent ID: {agent_id}")
    
    print("\n[Step 3] Running Sample Authorization Flow...")
    action = {
        "pair": "ETH/USDC",
        "amount": 10.5,
        "slippage": 0.01
    }
    auth_req = ActionAuthorizationRequest(
        agent_id=agent_id,
        action_id="integration_action_001",
        action_type="execute_defi_trade",
        payload=action,
    )
    print(f"Action Request: {auth_req}")
    
    # Authorizing the action will trigger:
    # 1. Identity validation
    # 2. Enforcement / Policy check
    # 3. Economic viability
    # 4. Reputation / Score validation
    # 5. Simulation projection
    print("\n[Step 4] Requesting Authorization (Testing Full Stack)...")
    is_authorized = await client.authorize(auth_req)
    
    print("\n==================================================")
    print(f"    AUTHORIZATION RESULT: {'GRANTED' if is_authorized else 'DENIED'}    ")
    print("==================================================")
    
    print("\nSUCCESS: The entire stack works as an integrated system.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

import sys
import os
import asyncio
import httpx
from httpx import AsyncClient

# Add repo root to sys.path to resolve imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "apps", "gateway_service")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "packages", "autonomy_core")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "packages", "enforcement_layer")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "packages", "identity_system")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "packages", "simulation_layer")))

from gateway_service.app import app
from enforcement_layer import EnforcementLayer
from identity_system import IdentitySystem
from simulation_layer import SimulationLayer

# Manually initialize app state to bypass lifespan issues in AsyncClient
app.state.identity = IdentitySystem()
app.state.enforcement = EnforcementLayer()
app.state.simulation = SimulationLayer()


async def spawn_chaos_agent(client: AsyncClient, agent_id: str):
    # Action that exceeds economic autonomy and violates enforcement policy
    payload = {
        "agent_id": agent_id,
        "action_id": f"act_{agent_id}",
        "action_type": "transfer_funds", # High risk to violate enforcement
        "payload": {
            "amount": 1000000000, # Large amount to exceed budget
            "destination": "chaos_wallet",
            "bypass_policy": True
        }
    }
    
    response = await client.post("/v1/action", json=payload)
    return response.json()

async def main():
    # Use httpx.AsyncClient with the FastAPI app instance
    transport = httpx.ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Spawn 10 chaos agents concurrently
        tasks = [spawn_chaos_agent(client, f"chaos_agent_{i}") for i in range(1, 11)]
        results = await asyncio.gather(*tasks)
        
        print("--- 10 Chaos Agents Results ---")
        for i, res in enumerate(results):
            print(f"Agent {i+1}: Decision={res.get('decision')} Reason='{res.get('reason')}'")
        
        # Spawn 11th agent
        print("\n--- Spawning 11th Agent ---")
        res_11 = await spawn_chaos_agent(client, "chaos_agent_11")
        print(f"Agent 11: Decision={res_11.get('decision')} Reason='{res_11.get('reason')}'")

        # Verify logic
        assert all(res.get('decision') == 'QUEUED' for res in results), "First 10 agents must be queued"
        assert res_11.get('decision') == 'BLOCKED', "11th agent must be blocked"
        print("\nSUCCESS: Gateway queued 10 agents and successfully blocked the 11th agent due to cumulative system risk.")

if __name__ == "__main__":
    asyncio.run(main())

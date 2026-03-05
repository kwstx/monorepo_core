# Autonomy Infrastructure Documentation
**VERSION 0.1.0 (ALPHA)** | **LAST UPDATED: 2026-03-05**

## Getting Started
Welcome to the Autonomy Infrastructure. This guide provides the accurate technical implementation details for operating autonomous workloads securely using the current codebase.

### Installation
Currently, the SDK is available within the monorepo. To install in editable mode:
```bash
pip install -e .
```

## Minimal Example
Register an agent and authorize an action using the `AutonomyClient`. This demonstrates the core control loop using the actual SDK methods.

```python
import asyncio
from autonomy_sdk import AutonomyClient

async def main():
    # 1. Initialize the client
    # Leave server_url=None to use the local in-memory Core Engine
    client = AutonomyClient(config={}, server_url=None)

    # 2. Register an agent
    agent_id = await client.register_agent(
        agent_id="agent-01",
        name="DevOps Bot",
        attributes={"clearance": "level_2"}
    )
    print(f"Agent Registered: {agent_id}")

    # 3. Authorize an action
    # Triggers: Identity -> Enforcement -> Economic -> Simulation -> Scoring
    is_authorized = await client.authorize(
        agent_id=agent_id,
        action_id="tx_999",
        action_type="deploy_server",
        payload={"target": "production"}
    )

    if is_authorized:
        print("Action Permitted: Executing...")
    else:
        print("Action Denied.")

if __name__ == "__main__":
    asyncio.run(main())
```

## Core API Reference

### `AutonomyClient`
The primary entry point for developers.

#### `register_agent(agent_id, name=None, attributes=None) -> str`
Registers a new agent identity in the system.
- **agent_id**: Unique string identifier.
- **name**: Optional human-readable name.
- **attributes**: Optional dict of properties (e.g., roles, clearance).
- **Returns**: The `agent_id` if successful.

#### `authorize(agent_id, action_id, action_type, payload=None) -> bool`
Evaluates an action against all safety modules.
- **agent_id**: The ID of the executing agent.
- **action_id**: Unique ID for this specific execution attempt.
- **action_type**: The category of action (used for policy matching).
- **payload**: Data related to the action.
- **Returns**: `True` if approved, `False` if rejected.

#### `propose_change(proposer_id, changes) -> bool`
Submits a governance proposal to update system configuration.
- **proposer_id**: The ID of the agent/user making the proposal.
- **changes**: Dict of configuration updates.

#### `get_system_status() -> dict`
Returns the current health and version of the infrastructure.
- **Returns**: `{"status": "active", "version": "1.0.0", "connected": True}`

## Architecture Overview
The system follows a strict hierarchical orchestration:

**Agent Layer** → **SDK (`AutonomyClient`)** → **Core (`AutonomyCore`)** → **Specialized Modules**

Current Modules implemented in `packages/`:
1.  **Identity System**: Verifies agent cryptographic tokens and registry state.
2.  **Enforcement Layer**: Deterministic policy validation.
3.  **Economic Autonomy**: Monitors budgets and PnL constraints.
4.  **Simulation Layer**: Predicts impact of actions in a shadow state.
5.  **Scoring Module**: Calculates risk scores based on anomaly vectors.

## Error Handling
The SDK raises specialized exceptions located in `autonomy_sdk.exceptions`:
- `AgentRegistrationError`: Failed to create identity.
- `ActionAuthorizationError`: Denied due to policy, budget, or risk.
- `ProposalError`: Governance submission failed.
- `ClientConnectionError`: Could not reach remote Autonomy Server.

## Development vs Production
- **Local Mode**: Initialize `AutonomyClient()` without a `server_url`. It will boot a local `AutonomyCore` using local SQLite/Memory state.
- **Remote Mode**: Initialize `AutonomyClient(server_url="http://...")` to communicate with a centralized `Autonomy Server` (FastAPI).

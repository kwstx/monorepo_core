# Autonomy Gateway: Infrastructure for Reliable AI Agent Execution

The Autonomy Gateway is a single platform that prevents AI agents from making unauthorized, expensive, or dangerous mistakes. 

It acts as a mandatory safety barrier between an AI model (the brain) and your actual systems (databases, cloud accounts, or financial wallets). If an agent attempts an action that violates your rules, the Gateway physically blocks the command from executing.

[Technical Docs](file:///c:/Users/galan/agent-infra-monorepo/AUTONOMY_DOCS_VALID.md) · [Enforcement Guide](file:///c:/Users/galan/agent-infra-monorepo/ENFORCEMENT_GUIDE.md) · [Monitoring Setup](file:///c:/Users/galan/agent-infra-monorepo/MONITORING_DOCS_GUIDE.md) · [MCP Tool Guide](file:///c:/Users/galan/agent-infra-monorepo/MCP_DOCUMENTATION_GUIDE.md)

---

## Quick Start

### 1. Install the SDK
```bash
pip install -e .
```

### 2. Add an Enforcement Filter to your Code
The `@circuit_breaker` decorator pauses the function and checks with the Gateway before allowing the code to continue.
```python
from autonomy_sdk import AutonomyClient
from autonomy_sdk.middleware import circuit_breaker

client = AutonomyClient()

# Set a risk threshold (0.0 to 1.0). If risk exceeds 0.15, the function is blocked.
@circuit_breaker(client, threshold=0.15)
async def transfer_funds(amount: float):
    print(f"Transferring {amount}...")
```

### 3. Start the Monitoring Dashboard
Run the dashboard to see every blocked or permitted action in real-time.
```powershell
docker-compose -f docker-compose.monitoring.yml up -d
# Access at http://localhost:3000 (admin/admin)
```

---

## Core Product Capabilities
The Autonomy Gateway handles the entire lifecycle of an AI agent's actions through a unified set of tools:

### Security and Identity
*   **Identity Registry**: Assigns a verifiable ID to every agent so you know exactly which model is performing which action.
*   **Enforcement Engine**: A rules-engine that checks every command against your company policies before execution.
*   **Gateway Service**: A single entry point for all agent traffic, acting as a firewall for your API keys and credentials.

### Risk Management
*   **Predictive Simulation**: Runs every agent command in a "sandbox" (a copy of your system) first to see if it will break anything.
*   **Risk Scoring**: Analyzes agent behavior to detect anomalies, such as an agent suddenly trying to delete a database.
*   **Observability Stack**: Real-time graphs that show system risk levels and the total number of blocked actions.

### Economic and Team Coordination
*   **Budget Boundaries**: Hard limits on how much an agent can spend. Once the budget is hit, the agent is physically unable to make more payments.
*   **Agent-to-Agent Contracting**: Allows different agents to negotiate prices and settle payments with each other automatically.
*   **Team Optimization**: Automatically groups agents based on their skills to solve specific tasks efficiently.

### Governance and Self-Update
*   **Self-Correction Loop**: Allows the platform to test its own code updates in a safe environment and roll them back if they fail.
*   **Policy Parser**: Automatically reads your written business rules and translates them into code-level filters.
*   **MCP Guard Server**: A plug-and-play tool for AI assistants (like Claude) that adds these safety checks to their standard tools.

---

## How the Gateway Stops Failure

Every time an agent tries to perform an action, the Gateway performs these four checks in under 500 milliseconds:

1.  **Identity**: "Is this registered agent allowed to be active?"
2.  **Policy**: "Does this specific command violate any written rules?"
3.  **Economics**: "Does the agent have enough remaining budget for this?"
4.  **Simulation**: "When we ran this in the sandbox, did it break the system?"

If any check fails, the Gateway kills the process immediately.

---

## Deployment
*   **Local Mode**: Runs entirely on your machine for development.
*   **Remote Mode**: Runs as a centralized service for your entire company.
*   **Stress Testing**: Use the included `test_chaos.py` script to simulate agents trying to break rules and verify the Gateway blocks them.

# Autonomy Gateway: Security Middleware for AI Agents

Autonomy Gateway is a toolkit that prevents AI agents from making unauthorized or destructive mistakes. It sits between your AI models and your sensitive systems (like bank accounts, databases, or cloud servers). 

When an AI tries to do something, the Gateway checks it against your rules, runs a test-run (simulation), and checks the cost. If anything is wrong, the Gateway physically kills the process before any damage is done.

[Getting Started Guide](file:///c:/Users/galan/agent-infra-monorepo/AUTONOMY_DOCS_VALID.md) · [Enforcement Rules](file:///c:/Users/galan/agent-infra-monorepo/ENFORCEMENT_GUIDE.md) · [Monitoring Setup](file:///c:/Users/galan/agent-infra-monorepo/MONITORING_DOCS_GUIDE.md) · [MCP Tool Server](file:///c:/Users/galan/agent-infra-monorepo/MCP_DOCUMENTATION_GUIDE.md)

---

## Quick Start

### 1. Install via Pip
Install in editable mode so changes to the monorepo are reflected immediately.
```bash
pip install -e .
```

### 2. Protect a Python Function
Use the `@circuit_breaker` tool to add a security check to any sensitive code.
```python
from autonomy_sdk import AutonomyClient
from autonomy_sdk.middleware import circuit_breaker

client = AutonomyClient()

# Set a threshold (0.0 to 1.0). If the check is too risky, the function is blocked.
@circuit_breaker(client, threshold=0.15)
async def delete_database_entry(item_id: str):
    # This code only runs if the Gateway says it is safe.
    db.delete(item_id)
```

### 3. Launch the Monitoring Stack
Start the real-time dashboard to see exactly what your agents are doing.
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```
Access the dashboard at `http://localhost:3000` (User: `admin`, Pass: `admin`).

---

## Everything Built So Far

The platform is divided into specialized packages that handle different parts of the safety process.

### Core Systems
*   **autonomy_core**: The main engine that coordinates all safety modules.
*   **autonomy_sdk**: The library you use in your Python scripts to connect to the Gateway.
*   **gateway_service**: A FastAPI-based server that acts as a central firewall for multiple agents.
*   **identity_system**: Keeps a registry of all agents and uses cryptographic keys to verify who is making each request.

### Control and Enforcement
*   **enforcement_layer**: A rules-engine that compares an agent's intended action against a list of "Allow" and "Deny" policies.
*   **actionable_logic**: A parser that lets you write rules in plain text or JSON and turns them into code-level filters.
*   **scorring_module**: Calculates a "Risk Score" (0 to 100) for every action based on how unusual it looks compared to normal behavior.

### Testing and Forecasting
*   **simulation_layer**: Creates a "shadow" copy of your system state to run an agent's command as a test-run before letting it happen for real.
*   **entropy_stress_testing**: Checks if a group of agents working at the same time might cause a system-wide failure or large-scale risk spike.
*   **main_dashboard**: A pre-built Grafana setup with panels for Risk Pressure, Block Rates, and System Health.

### Money and Coordination
*   **economic_autonomy**: A budgeting tool that sets hard limits on how much an agent can spend. It tracks P&L and stops all actions if a budget is exceeded.
*   **a2a_coordination**: A set of protocols that allows agents to negotiate with each other, sign "digital contracts," and settle payments.
*   **reputation_tracker**: Scores agents based on their success rate and how often they follow coordination rules.

### Logistics and Teams
*   **task_formation**: An optimizer that analyzes a task and picks the best combination of agents to solve it.
*   **matching_engine**: Automatically routes incoming requests to the best available agent based on its skills and safety history.
*   **synergy_forecaster**: Predicts how well a team of agents will work together before they are assigned to a real project.

---

## How it Works: The Security Loop

When an agent wants to perform an action, the Gateway runs a four-step check in under 500 milliseconds:

1.  **Identity Check**: "Is this a registered agent we recognize?"
2.  **Policy Check**: "Is this specific action (e.g., 'delete_user') allowed by the rules?"
3.  **Money Check**: "Does this agent have enough remaining budget to pay for this?"
4.  **Test Run (Simulation)**: "If we do this in the test environment, does anything break?"

If any of these checks fail, the Gateway returns a **BLOCKED** status and the code stops immediately.

---

## Advanced Operations

### Stress Testing (Chaos Agents)
You can test the system's "Brakes" by running a simulation of multiple agents trying to break the rules at once:
```bash
python test_chaos.py
```
This script spawns 10 agents that intentionally attempt to overspend. The Gateway should successfully block them once the cumulative risk threshold is hit.

### Remote Access (Tailscale)
The Gateway can be configured to use **Tailscale** for secure remote access. This allows your agents to run on a central server while you monitor them from your laptop securely over an encrypted tunnel.

### MCP Integration
Use the **autonomy-guard-server** (apps/mcp_server) to add these safety features to AI assistants like Claude. It exposes the Gateway's checks as a tool that the AI can use to self-verify its actions.

---

## Security Model
*   **Default-Deny**: The system blocks every action by default. You must explicitly write a policy to allow something.
*   **Docker Sandboxing**: When running in a multi-user environment, the Gateway can run agent code inside temporary Docker containers to prevent it from accessing your local files.
*   **Correlation IDs**: Every action is assigned a unique tracking ID so you can trace a "Blocked" decision back through the logs to see exactly why it was stopped.

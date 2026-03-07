# Autonomy Gateway: Full-Stack Infrastructure for AI Agent Execution

The Autonomy Gateway is a complete infrastructure for deploying, coordinating, and securing AI agents. Most AI tools provide the "thinking" (the LLM); this project provides the **execution layer** that allows agents to take actions in the real world safely and legally.

It is a modular monorepo containing everything needed to move agents from simple "chat" interfaces to production-ready "autonomous services."

[Technical Roadmap](file:///c:/Users/galan/agent-infra-monorepo/prompts_to_build_the_hands.md) · [Technical Implementation Docs](file:///c:/Users/galan/agent-infra-monorepo/AUTONOMY_DOCS_VALID.md) · [Enforcement Guide](file:///c:/Users/galan/agent-infra-monorepo/ENFORCEMENT_GUIDE.md) · [Monitoring Setup](file:///c:/Users/galan/agent-infra-monorepo/MONITORING_DOCS_GUIDE.md) · [MCP Tool Server](file:///c:/Users/galan/agent-infra-monorepo/MCP_DOCUMENTATION_GUIDE.md)

---

## Quick Start

### 1. Install via Pip
Install in editable mode so changes to the monorepo are reflected immediately across all packages.
```bash
pip install -e .
```

### 2. Add an Execution Guard to your Python Code
The `@circuit_breaker` middleware pauses your code and runs a 500ms safety check through the Gateway before allowing sensitive operations to proceed.
```python
from autonomy_sdk import AutonomyClient
from autonomy_sdk.middleware import circuit_breaker

client = AutonomyClient()

# Set a safety threshold. If the action is too risky, the function is blocked.
@circuit_breaker(client, threshold=0.15)
async def perform_payment(amount: float, recipient: str):
    # This code only runs if the Gateway verifies it is safe and within budget.
    print(f"Executing transfer: {amount} to {recipient}")
```

### 3. Launch the Monitoring Stack
Start the real-time observability dashboards to watch agent behavior "live."
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```
Dashboard: `http://localhost:3000` (User: `admin`, Pass: `admin`).

---

## Detailed Feature Inventory (The Monorepo)

The platform is designed as an "Operating System" for agents, with specialized modules for every stage of the agent lifecycle.

### 1. Core Platform & SDK
*   **autonomy_core**: The central coordination kernel that handles the internal routing of all safety checks.
*   **autonomy_sdk**: The primary developer library. It includes the `AutonomyClient` and the middleware used to "wrap" your existing code.
*   **gateway_service**: A high-performance FastAPI server that acts as a centralized firewall for multi-agent swarms.
*   **identity_system**: Each agent gets a cryptographically verified ID. This module manages agent registration, role-based permissions, and trust tokens.

### 2. Runtime Enforcement (The "Brakes")
*   **enforcement_layer**: A deterministic engine that checks every agent command against non-negotiable business rules before letting it run.
*   **actionable_logic**: A universal parser that allows you to write legal or safety policies in plain English or JSON and automatically translates them into machine-enforceable code.
*   **scorring_module**: Analyzes agent behavior (like action frequency or API call types) to calculate a "Risk Score" (0 to 100) using 10+ anomaly detection vectors.

### 3. Economic Autonomy & Commerce
*   **economic_autonomy**: A hard-coded budgeting engine. It sets P&L limits, transaction caps, and spend boundaries that an agent physically cannot bypass.
*   **a2a_coordination**: A protocol for Agent-to-Agent business. It allows agents to negotiate terms, create digital contracts, and settle payments with each other automatically.
*   **reputation_tracker**: A system that scores agents based on how successfully they coordinate with others and how often they follow the rules.

### 4. Team Dynamics & Logistics
*   **task_formation**: A recursive optimizer that analyzes a complex task and determines the perfect combination of agents needed to solve it.
*   **matching_engine**: Automatically assigns incoming requests to the best available agent based on its skills, safety history, and current workload.
*   **synergy_forecaster**: A simulator that predicts how well a specific group of agents will perform together *before* they are assigned a real-world project.

### 5. Prediction & Simulation (The "Foresight")
*   **simulation_layer**: A tool that creates a "shadow" copy of your system state. It runs every agent command as a test-run and analyzes the outcome before the command is allowed in production.
*   **entropy_stress_testing**: Analyzes the "Cumulative Risk" of many agents working at once. It can block a perfectly safe agent if it determines that the *combination* of its work with others would destabilize the system.
*   **observability_dashboards**: Pre-built Grafana panels for monitoring "Risk Pressure," "Brake Sensitivity," and "Blocked Actions" in real-time.

### 6. Governance & Self-Evolution
*   **self_improvement_governance**: A framework for agents to propose, test, and deploy code or policy updates to themselves. It includes a democratic consensus loop where changes must be "voted" on and verified.
*   **rollback_engine**: Automatically reverts any system or code update if the simulation layer detects a spike in risk after the change.
*   **MCP Guard Server**: Full implementation of the Model Context Protocol. It exposes the Gateway's safety checks as "tools" for AI assistants like Claude, GPT, or Antigravity.

---

## How It Works: The 500ms Sovereign Check

Every time an agent tries to perform a "Write" or "Execute" action, the Gateway performs the following sequence:

1.  **Identity**: "Is this registered agent allowed to be active in this specific workspace?"
2.  **Policy**: "Does the `action_type` (e.g., 'delete_server') violate any written business policies?"
3.  **Economics**: "Does the agent have enough remaining budget for this action's cost?"
4.  **Simulation**: "When we ran this in the 'shadow sandbox', did it cause a risk spike or system failure?"

**Decision:**
*   **SUCCESS**: All checks pass. The Gateway permits the code to run.
*   **FAILURE**: Any check fails. The Gateway kills the process and logs a `SecurityViolation` event.

---

## Advanced Management

### Stress Testing (Chaos Agents)
Verify your "Brakes" by running a simulation of 10 "Chaos Agents" attempting to overspend and break policies simultaneously:
```bash
python test_chaos.py --agents 10 --stress-target budget
```
The Gateway should successfully queue and block these agents as the **Cumulative System Risk** threshold is reached.

### Remote Gateway Deployment
You can run the Gateway on a centralized Linux server while your agents run on many different Edge devices or laptops.
*   Use **Tailscale** for secure remote access over an encrypted tunnel.
*   Monitor everything through a single **Grafana** instance connected to the central Gateway.

---

## Security Model
*   **Default-Deny**: The system blocks every action by default. You must explicitly write a policy to allow a specific agent to do a specific thing.
*   **Docker Isolation**: For multi-user environments, the Gateway can run agent commands inside per-session Docker sandboxes to keep the rest of your files safe.
*   **Audit Trail**: Every request is assigned a `correlationId`. This ID is tracked through the simulation, the enforcement check, and the final decision, providing a complete audit log for regulators.

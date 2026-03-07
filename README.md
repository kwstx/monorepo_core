# 🛡️ Autonomy Gateway — The Sovereign Layer for AI
**THE NON-NEGOTIABLE BRAKES FOR AUTONOMOUS AGENTS.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/autonomy-infra/monorepo_core)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Safety](https://img.shields.io/badge/safety-hardened-red.svg)]()
[![Stack](https://img.shields.io/badge/stack-Python%20|%20Node-yellow.svg)]()

The **Autonomy Gateway** is the first integrated Operating System for the Machine Economy. It provides the single, unified control plane required to give AI agents "Write Access" and "Financial Autonomy" without human anxiety. 

While others build the *brains* (LLMs), we build the **Brakes, the Dashboard, and the Constitution.** The Gateway is the mandatory bridge between an agentic thought and a real-world action. If a command doesn't pass the Gateway, it is physically unable to execute.

[Website]() · [Docs](file:///c:/Users/galan/agent-infra-monorepo/AUTONOMY_DOCS_VALID.md) · [Enforcement Guide](file:///c:/Users/galan/agent-infra-monorepo/ENFORCEMENT_GUIDE.md) · [Monitoring](file:///c:/Users/galan/agent-infra-monorepo/MONITORING_DOCS_GUIDE.md) · [MCP Guide](file:///c:/Users/galan/agent-infra-monorepo/MCP_DOCUMENTATION_GUIDE.md) · [A2A Coordination](file:///c:/Users/galan/agent-infra-monorepo/packages/a2a_coordination/README.md) · [Task Formation](file:///c:/Users/galan/agent-infra-monorepo/packages/task_formation/README.md)

---

## 🚀 Quick Start (TL;DR)

**1. Install the SDK**
```bash
# Recommended: Install in editable mode from the monorepo root
pip install -e .
```

**2. Protect a Function (Local Mode)**
The `@circuit_breaker` decorator pauses the function and runs it through the Safety Brain.
```python
from autonomy_sdk import AutonomyClient
from autonomy_sdk.middleware import circuit_breaker

client = AutonomyClient()

@circuit_breaker(client, threshold=0.15)
async def transfer_funds(amount: float, recipient: str):
    # This code WILL NOT RUN if the risk score exceeds 0.15
    print(f"Transferring {amount} to {recipient}...")
```

**3. Launch the Monitoring Dashboard**
```powershell
docker-compose -f docker-compose.monitoring.yml up -d
# Access at http://localhost:3000 (admin/admin)
```

---

## 🔥 Highlights
*   **Deterministic Enforcement (The "Hands")** — Move from "reporting risk" to "physically stopping" actions at the bytecode level.
*   **Economic Guardrails (The "Capital")** — Hard-coded P&L constraints and budget boundaries that machines literally cannot exceed.
*   **Shadow Simulation (The "Foresight")** — Real-time entropy stress-testing that predicts the impact of agent actions before they hit production.
*   **Universal Policy Logic (The "Constitution")** — Translate complex human regulations into machine-enforceable filters automatically.
*   **Self-Evolving Governance** — Systems that upgrade their own logic through a democratic consensus loop with automatic sandboxed rollbacks.

---

## 🏗️ Everything we've built so far

### Core Platform
*   **Autonomy Core**: The central coordination kernel for agent states and loop evaluation.
*   **Autonomy SDK (`autonomy_sdk`)**: The primary developer entry point. Includes `AutonomyClient` and the Circuit Breaker middleware.
*   **Gateway Service**: High-performance FastAPI gateway for centralizing agent requests and cumulative risk evaluation.
*   **Identity System**: Verifiable agent identities, cryptographic registration, and role-based access control.

### Safety & Enforcement
*   **Enforcement Layer**: Deterministic policy validation engine for checking actions against non-negotiable rules.
*   **Scoring Module**: Risk pressure calculation using 10+ anomaly vectors.
*   **Actionable Logic**: Universal policy parser that translates human-readable JSON/Markdown rules into executable filters.

### Risk & Prediction
*   **Simulation Layer**: A dedicated "Parallel Reality" for testing agent commands.
*   **Entropy Stress Testing**: Predicts the "System Temperature" surge if a batch of agent actions is allowed to proceed.
*   **Main Autonomy Dashboard**: Pre-configured Grafana panels for real-time observability.

### Economic Autonomy
*   **Budgeting Engine**: Hard limits on spend, throughput, and P&L deviation.
*   **A2A Coordination**: Protocols for agent-to-agent negotiation, contracting, and mutual settlement.
*   **Reputation Demo**: Tracking agent reliability through successful/failed coordination cycles.

### Intelligence & Logistics
*   **Task Formation**: Recursive team optimization—automatically grouping agents based on skill complementarity.
*   **Matching Engine**: Intelligent assignment of incoming requests to the most capable (and safe) agents.
*   **Synergy Forecasting**: Predicting the success probability of a multi-agent team before they start.

### Governance & Evolution
*   **Self-Improvement Governance**: A safe loop for agents to propose and test their own code/policy updates.
*   **MCP Guard Server**: Full Model Context Protocol server exposing `authorize_action` and `register_agent` as tools for AI assistants (Claude/Antigravity).
*   **Rollback Engine**: Automatic reversion of system config if a governance change causes a risk spike.

---

## 🔍 How it Works (Technical Flow)

The Gateway evaluates the "System Temperature" across four vectors in under 500ms:

```text
    [ AI AGENT THOUGHT ]
             │
             ▼
┌───────────────────────────────┐
│       AUTONOMY GATEWAY        │
│       (control plane)         │
└──────────────┬────────────────┘
               │
      ┌────────┼────────┐
      │        │        │
      ▼        ▼        ▼
 [ IDENTITY ] [ POLICY ] [ ECONOMY ]
      │        │        │
      └────────┼────────┘
               │ 
               ▼
       [ SIMULATION LAYER ]
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
 [ PERMITTED ]     [ BLOCKED ]
 (Action runs)    (Process dies)
```

1.  **Identity Registry**: Verifies that the agent is registered and has the mandatory tokens.
2.  **Logical Enforcement**: Checks the `action_type` against the `actionable_logic` policy repository.
3.  **Economic Autonomy**: Confirms the action doesn't violate the agent's specific P&L or budget limits.
4.  **Shadow Simulation**: Models the "Post-Action" state. If it causes a risk spike, the Gateway returns `BLOCKED`.

---

## 🛠️ Advanced Operations

### Monitoring Stack Operations
Access the command center for real-time visibility into the "Machine Economy."
*   **Prometheus**: Raw metric storage and scraping (`localhost:9090`).
*   **Grafana**: Pre-built dashboards for Risk Pressure, Block Rates, and Latency (`localhost:3000`).
*   **Node Exporter**: Hardware health metrics for the host running the agents.
*   Details: [OPERATIONS.md](file:///c:/Users/galan/agent-infra-monorepo/OPERATIONS.md)

### Remote Gateway Setup
Deploy the Gateway on a performant Linux server while keeping your SDK clients on macOS/Windows.
*   Connect over **Tailscale Serve/Funnel** for secure, password-less internal access.
*   Use **SSH Tunnels** for direct point-to-point command execution.
*   Details: [REMOTE_SETUP.md]() (Coming Soon)

### Stress Testing the "Hands"
Run the Chaos Agent series to verify your safety thresholds.
```bash
python test_chaos.py --agents 10 --violation-target economic
```
This spawns 10 agents that intentionally try to break budgets, verifying that the 11th agent is blocked by the **Cumulative Risk** engine.

---

## 🛡️ Security Model
*   **Default Deny**: All actions are blocked unless explicitly permitted by a policy in the `actionable_logic` layer.
*   **Isolations**: Group and external-agent sessions run inside per-session Docker sandboxes.
*   **Correlation IDs**: Every request is assigned a `correlationId` that follows the action through logs, simulation, and the eventual decision audit.

---

## 📄 Docs & Resources
*   [Getting Started](file:///c:/Users/galan/agent-infra-monorepo/AUTONOMY_DOCS_VALID.md) — The technical implementation handbook.
*   [Enforcement Guide](file:///c:/Users/galan/agent-infra-monorepo/ENFORCEMENT_GUIDE.md) — How to move from reporting to physically stopping actions.
*   [Monitoring Docs](file:///c:/Users/galan/agent-infra-monorepo/MONITORING_DOCS_GUIDE.md) — Setting up the "Eyes" of the system.
*   [MCP Guard Server](file:///c:/Users/galan/agent-infra-monorepo/MCP_DOCUMENTATION_GUIDE.md) — Using the Gateway as a set of tools for AI models.
*   [Roadmap: The Hands](file:///c:/Users/galan/agent-infra-monorepo/prompts_to_build_the_hands.md) — Future integration prompts for production expansion.

---

## 🤝 Contributing
See `CONTRIBUTING.md` for guidelines. We value safety-first contributions and stress-test PRs.

---

**Built by the Autonomy Infrastructure Team and the community.**
Establishing a new benchmark for reliable AI execution.

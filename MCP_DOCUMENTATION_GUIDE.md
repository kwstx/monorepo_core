# Documentation Supplement: MCP Guard Server

To ensure the **Autonomy-Guard-Server** is effectively utilized, the following sections should be added to your core documentation (`AUTONOMY_DOCS_VALID.md`) or a new `MCP_GUIDE.md`.

---

## 🛡️ Autonomy Guard Server (MCP)

The **Autonomy-Guard-Server** is a Model Context Protocol (MCP) implementation that acts as a secure bridge between AI agents and the Autonomy Infrastructure. It exposes the core safety loops (Identity, Enforcement, Economics) as actionable tools for AI assistants.

### 🔌 AI Client Configuration

To enable these safety tools in your AI assistant (e.g., Claude Desktop, Antigravity), add the following to your configuration file:

```json
{
  "mcpServers": {
    "autonomy-guard": {
      "command": "python",
      "args": ["apps/mcp_server/main.py"],
      "env": {
          "PYTHONPATH": "packages/autonomy_sdk:packages/autonomy_core"
      }
    }
  }
}
```
*Note: Use the absolute path to the virtual environment's python executable for production stability.*

### 🛠️ Available MCP Tools

The Guard Server exposes the following specialized tools to the AI:

#### 1. `register_agent`
**Purpose**: Establishes a cryptographically verifiable identity.
- **Input**: `agent_id`, `name`, `attributes` (Optional).
- **Loop**: Triggers the **Identity Validation Loop**.

#### 2. `authorize_action`
**Purpose**: The mandatory safety barrier for all operations.
- **Input**: `agent_id`, `action_type`, `payload`.
- **Loop**: Triggers the full **Orchestrated Validation Loop** (Identity → Enforcement → Economics → Scoring → Simulation).
- **Output**: Returns a clear `PERMITTED` or `BLOCKED` status with a risk assessment summary.

#### 3. `propose_governance_change`
**Purpose**: Modifies system-wide safety or economic policies.
- **Input**: `proposer_id`, `changes`.
- **Loop**: Triggers the **Economic Validation and Voting Loop**.

#### 4. `get_system_status`
**Purpose**: Returns high-level health metrics of the autonomy stack.

### 🚀 Launching the Server
The server uses the **Standard I/O (stdio)** transport. It can be launched directly via:
```bash
cd apps/mcp_server
.\.venv\Scripts\python main.py
```

---

### 📝 Strategic Tips for Documentation
- **Highlight the "Mandatory" nature**: Emphasize that `authorize_action` must be called before any state-changing operation.
- **Explain Risk Scores**: Detail how the "Risk Assessment" in the tool output reflects the internal sentiment of the Scoring and Simulation modules.
- **Environment Isolation**: Mention that the MCP server runs in its own virtual environment to prevent dependency conflicts with the core services.

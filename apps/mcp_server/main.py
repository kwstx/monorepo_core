import os
import sys
import asyncio
from typing import Optional

# Setup path to internal packages
# This ensures that apps/mcp_server can import from packages/*
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PACKAGES_DIR = os.path.join(PROJECT_ROOT, "packages")

if PACKAGES_DIR not in sys.path:
    # Adding each package directory to sys.path
    # This allows direct imports of modules under packages/
    for package in os.listdir(PACKAGES_DIR):
        pkg_path = os.path.join(PACKAGES_DIR, package)
        if os.path.isdir(pkg_path) and pkg_path not in sys.path:
            sys.path.append(pkg_path)

# Now we should be able to import AutonomyClient
try:
    from autonomy_sdk import AutonomyClient
    print("Successfully imported AutonomyClient from autonomy_sdk")
except ImportError as e:
    print(f"Error importing AutonomyClient: {e}")
    sys.exit(1)

from mcp.server import Server
from mcp.server.stdio import stdio_server
import mcp.types as types

# Initialize the MCP Server
app = Server("Autonomy-Guard-Server")

# Basic MCP resources and tools will be implemented here
# For now, just establishing the connection to the Autonomy Client

@app.list_resources()
async def list_resources() -> list[types.Resource]:
    return []

@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="get_system_status",
            description="Get the current status of the Autonomy System",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        ),
        types.Tool(
            name="register_agent",
            description="Register a new agent with a secure identity in the Autonomy System. This creates a cryptographically verifiable identifier and sets up initial attributes for the agent.",
            inputSchema={
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "A unique identifier for the agent (e.g., 'Agent_001')"
                    },
                    "name": {
                        "type": "string",
                        "description": "A human-readable name for the agent"
                    },
                    "attributes": {
                        "type": "object",
                        "description": "Key-value pairs defining agent properties, clearance levels, or roles"
                    }
                },
                "required": ["agent_id"]
            }
        ),
        types.Tool(
            name="authorize_action",
            description="The mandatory safety barrier for all agent operations. This tool checks if an agent is authorized to perform a specific action, triggering a full orchestration of identity, enforcement, economics, and simulation safeguards.",
            inputSchema={
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The unique identifier of the agent attempting the action"
                    },
                    "action_id": {
                        "type": "string",
                        "description": "A unique identifier for this specific action attempt"
                    },
                    "action_type": {
                        "type": "string",
                        "description": "The type of action being requested (e.g., 'read_file', 'transfer_funds')"
                    },
                    "payload": {
                        "type": "object",
                        "description": "Additional context or data related to the action for deep inspection"
                    }
                },
                "required": ["agent_id", "action_type"]
            }
        ),
        types.Tool(
            name="propose_governance_change",
            description="Propose a change to the system governance or economic configuration. This triggers the economic validation and voting loops.",
            inputSchema={
                "type": "object",
                "properties": {
                    "proposer_id": {
                        "type": "string",
                        "description": "The ID of the agent proposing the change"
                    },
                    "changes": {
                        "type": "object",
                        "description": "A dictionary detailing the proposed changes (e.g., {'max_budget': 5000})"
                    }
                },
                "required": ["proposer_id", "changes"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    # Instantiate the AutonomyClient to trigger core validation loops
    client = AutonomyClient()
    
    if name == "get_system_status":
        status = client.get_system_status()
        return [types.TextContent(type="text", text=f"### 📊 Autonomy System Status\n\n{status}")]
    
    elif name == "register_agent":
        agent_id = arguments.get("agent_id")
        name_attr = arguments.get("name")
        attributes = arguments.get("attributes", {})
        
        # Triggers Identity validation loop
        try:
            result = client.register_agent_sync(
                agent_id=agent_id,
                name=name_attr,
                attributes=attributes
            )
            message = (
                f"### ✅ Agent Registration Successful\n\n"
                f"**Agent ID**: `{agent_id}`\n"
                f"**Name**: {name_attr or 'N/A'}\n"
                f"**Verification**: Identity verified and cryptographically secured.\n\n"
                f"**Loop Result**: {result}"
            )
            return [types.TextContent(type="text", text=message)]
        except Exception as e:
            message = (
                f"### ❌ Agent Registration Failed\n\n"
                f"**Agent ID**: `{agent_id}`\n"
                f"**Reason**: The Identity loop rejected the registration request.\n"
                f"**Error Details**: {str(e)}"
            )
            return [types.TextContent(type="text", text=message)]
    
    elif name == "authorize_action":
        agent_id = arguments.get("agent_id")
        action_type = arguments.get("action_type")
        action_id = arguments.get("action_id", "dynamic_mcp_call")
        payload = arguments.get("payload", {})
        
        # Triggers Orchestrated Validation (Identity, Enforcement, Economics, Simulation)
        try:
            authorized = client.authorize_sync(
                agent_id=agent_id,
                action_id=action_id,
                action_type=action_type,
                payload=payload
            )
            
            if authorized:
                message = (
                    f"### ✅ Authorization Permitted\n\n"
                    f"**Agent**: `{agent_id}`\n"
                    f"**Action**: `{action_type}`\n"
                    f"**Status**: PERMITTED\n\n"
                    f"**Risk Assessment**: The operation is compliant with all active policies. "
                    f"Risk score is within acceptable safety bounds."
                )
            else:
                message = (
                    f"### ❌ Authorization Denied\n\n"
                    f"**Agent**: `{agent_id}`\n"
                    f"**Action**: `{action_type}`\n"
                    f"**Status**: BLOCKED\n\n"
                    f"**Risk Assessment**: This action was flagged as high-risk or violating enforceable policies. "
                    f"Execution is prohibited by the Guard Server."
                )
            return [types.TextContent(type="text", text=message)]
        except Exception as e:
            message = (
                f"### ⚠️ Security Audit Error\n\n"
                f"**Agent**: `{agent_id}`\n"
                f"**Action**: `{action_type}`\n"
                f"**Error**: An internal failure occurred during the validation loop.\n"
                f"**Details**: {str(e)}"
            )
            return [types.TextContent(type="text", text=message)]

    elif name == "propose_governance_change":
        proposer_id = arguments.get("proposer_id")
        changes = arguments.get("changes")
        
        # Triggers Economic validation and Governance loop
        try:
            result = client.propose_change_sync(proposer_id, changes)
            message = (
                f"### ⚖️ Governance Proposal Submitted\n\n"
                f"**Proposer**: `{proposer_id}`\n"
                f"**Changes**: {changes}\n\n"
                f"**Status**: Governance loop triggered. Economic validation in progress.\n"
                f"**Result**: {result}"
            )
            return [types.TextContent(type="text", text=message)]
        except Exception as e:
            message = (
                f"### ❌ Governance Proposal Rejected\n\n"
                f"**Proposer**: `{proposer_id}`\n"
                f"**Reason**: Failed to process governance change request.\n"
                f"**Error Details**: {str(e)}"
            )
            return [types.TextContent(type="text", text=message)]
    
    raise ValueError(f"Tool not found: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test-import":
        # Just run the import check (which happened at top level)
        print("Import test passed.")
    else:
        # Run the server normally using standard I/O transport
        asyncio.run(main())

# Documentation Guide: Enforcement & Circuit Breakers

Integrating the "Hands" into your application requires understanding how the **Autonomy Infrastructure** moves from simply "reporting risk" to "physically enforcing safety." This guide explains the two primary ways to implement bytecode-level safety.

---

## 🛑 The "Circuit Breaker" Middleware (SDK)

The most powerful way to protect your system is to use the **Circuit Breaker** directly on your agent's sensitive functions. This ensures that even if an agent *attempts* a risky action, the SDK will physically prevent the command from executing.

### Usage Example

```python
from autonomy_sdk import AutonomyClient
from autonomy_sdk.middleware import circuit_breaker

client = AutonomyClient()

# This decorator intercepts the call and runs it through the Safety Brain
@circuit_breaker(client, agent_id="agent-01", action_type="transfer_funds", threshold=0.35)
async def perform_payment(amount: float, recipient: str):
    # This code will ONLY run if the risk score is below 0.35
    print(f"Transferring {amount} to {recipient}...")
    # ... actual network/database logic here ...
```

### How it Works
1.  **Intercept**: When `perform_payment` is called, the middleware pauses the execution.
2.  **Evaluate**: It sends a request to the **Safety Loop** (Identity -> Enforcement -> Simulation) with a unique `correlationId`.
3.  **Brake**: 
    *   If the risk score is **below** the threshold, the function resumes normally.
    *   If the risk score is **above** the threshold, it raises a `CircuitBreakerException`, physically preventing any network requests or database writes.

---

## 🛡️ The Unified Gateway (Enforcement)

For external agents, all traffic must pass through the **Gateway Service**. Unlike a standard API, this gateway evaluates **Cumulative System Risk**.

### Cumulative Risk Enforcement
The Gateway doesn't just look at one agent in isolation. It tracks the collective "Pressure" of all active agents.

| State | Meaning | Action Taken |
| :--- | :--- | :--- |
| **QUEUED** | Action passed simulation and is safe. | Request proceeds. |
| **BLOCKED** | Adding this single action would tip the entire system into "High Risk." | Request is denied immediately. |
| **HUMAN_REQUIRED** | The action is too complex or the safety check took too long (>500ms). | Action is "Frozen" awaiting an administrator signature. |

---

## 📊 Risk Metadata vs. Boolean Authorization

Previously, the SDK only returned `True` or `False`. With the new **Enforcement Layer**, you can now access deep metrics to make better decisions in your own agent logic.

### `client.authorize_action(...)`
Instead of a boolean, use this method to get a full "Security Audit" object:

```python
audit = await client.authorize_action(
    agent_id="agent-01",
    action_type="resource_deletion",
    payload={"id": "prod-db-01"}
)

print(f"Decision: {audit['decision']}")
print(f"Risk Pressure: {audit['impact_score']}") # 0.0 to 1.0 (Higher is riskier)
print(f"Enforcement Reason: {audit['reason']}")
```

---

## ⚠️ Strategic Implementation Tips
*   **Set Realistic Thresholds**: A threshold of `0.10` is "Paranoid" (useful for financial transactions), while `0.80` is "Permissive" (useful for read-only logs).
*   **Handle Timeouts**: In high-speed environments, ensure your agent logic can handle a `HUMAN_REQUIRED` state if a simulation takes longer than 500ms.
*   **Use Correlation IDs**: Always log the `correlationId` provided in the response to trace any "Blocked" actions back through the Identity, Enforcement, and Simulation logs.

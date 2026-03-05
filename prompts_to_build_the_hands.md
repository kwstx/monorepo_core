# Roadmap: Building the "Hands" (Integration Prompts)

This document contains targeted prompts to bridge the gap between our sophisticated **Simulation/Safety Brain** and a functional **Production Gateway**. Use these with an AI coding assistant (like Antigravity) to implement the "Hands."

---

## 🏗️ Phase 1: The Unified Message Bus (Connectivity)
*Currently, our services talk via fragile subprocesses and logic is split between Python/TS.*

### Prompt 1: Implementing a Shared Event Store
> "We need to replace our `subprocess.Popen` coordination in `orchestrate.py` with a robust event-driven architecture. Create a shared `event-bus` package (or use a lightweight Redis/NATS implementation) that allows the `enforcement_layer` (TS) to subscribe to action requests from the `autonomy_sdk` (Python) and publish `PERMITTED` or `BLOCKED` events. Ensure there is a unique `correlationId` for every request to track it through the full safety loop (Identity -> Enforcement -> Simulation)."

### Prompt 2: The Unified API Gateway
> "Create a new FastAPI service in `apps/gateway_service` that acts as the single entry point for all external agents. This gateway should accept an `ActionRequest`, validate the agent's identity using the `identity_system`, and then orchestrate the calls to the `enforcement_layer` and `simulation_layer`. It must handle timeouts gracefully—if the safety check takes longer than 500ms, it should default to a 'SOFT_BLOCK' or 'HUMAN_REQUIRED' state rather than hanging."

---

## 📊 Phase 2: Real-World Data Plumbing (The "Actual" State)
*Moving from [0.25, 0.25, 0.25, 0.25] to real agent metrics.*

### Prompt 3: Connecting Simulation to the Database
> "In `packages/simulation_layer/simulation_layer/simulation/entropy_stress_test.py`, the `_initial_distribution` method uses fallback dummy values. Modify this to ingest real historical data. Create a `StateIngestor` that queries our (PostgreSQL/TimescaleDB) record of agent actions and trust scores to build the `CooperativeStateSnapshot`. The simulation should now run against the *actual* current state of the network, not 0.25 fallbacks."

### Prompt 4: Real-Time Metric Feed
> "Implement a Prometheus/Grafana exporter in the `scorring_module`. Instead of just returning a `decisionScore` to the console, it should export our 'Risk Pressure' and 'Anomaly Sensitivity' metrics in real-time. This allows human operators to see when the 'Brakes' are being applied too heavily and adjust the `ThresholdAdaptationEngine` parameters via a dashboard."

---

## 🛡️ Phase 3: Runtime Enforcement (The "Grip")
*Moving from 'Calculated Risk' to 'Stopped Action'.*

### Prompt 5: The "Hard-Block" Interceptor
> "Develop a middleware for the `AutonomyClient` (Python SDK) that acts as a circuit breaker. If the `authorize_action` call returns a risk score above a configurable threshold (e.g., 85), the SDK should wrap the target function in an exception that physically prevents the network request or database write from executing. This moves us from 'reporting' risk to 'enforcing' safety at the bytecode/network level."

### Prompt 6: Human-in-the-Loop Override
> "Our `scorring_module` has a `HumanOverrideInterface.ts`. We need to build the 'Hands' for this. Create a CLI or simple Web UI that intercepts 'HIGH_RISK' actions and puts them in a 'PENDING_APPROVAL' queue. The agent should be 'Frozen' (awaiting a promise/event) until a human admin either signs the transaction or rejects it. Implement this async handshake between the Gateway and the Admin UI."

---

## 🧪 Phase 4: Stress Testing the "Hands"
### Prompt 7: The "Chaos Agent" Test
> "Write a test script that spawns 10 'Chaos Agents' that intentionally try to exceed their `economic_autonomy` budgets and violate the `enforcement_layer` policies simultaneously. Verify that our new Unified Gateway correctly queues these requests, runs the full `entropy_stress_test` on the combined impact of all 10 agents, and successfully blocks the 11th agent when the cumulative system risk exceeds the safety threshold."

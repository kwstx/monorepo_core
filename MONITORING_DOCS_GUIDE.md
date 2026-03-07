# Documentation Guide: Monitoring & Observability (The "Eyes")

Adding real-time monitoring transforms the Autonomy Infrastructure into a transparent, operations-ready platform. This guide outlines the sections you should add to your documentation to reflect the new **Prometheus & Grafana** integration.

---

## 📊 Operational Command Center

The Autonomy Platform provides a real-time "Command Center" using Prometheus and Grafana. This allows human operators to visualize agent behavior and the "Brakes" being applied by the Safety Brain.

### 🚀 Launching the Monitoring Stack

The monitoring stack is containerized for easy deployment. To start the dashboards alongside your services, run:

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

| Service | Access URL | Default Credentials |
| :--- | :--- | :--- |
| **Grafana** (Dashboards) | `http://localhost:3000` | `admin` / `admin` |
| **Prometheus** (Raw Data) | `http://localhost:9090` | N/A |
| **Metrics Exporter** | `http://localhost:8000/metrics` | N/A |

---

## 🔍 Key Performance Metrics (Glossary)

To effectively manage an autonomous network, operators must monitor three core categories of metrics:

### 1. Risk & Safety Metrics
*   **`risk_pressure` (Gauge)**: The real-time sentiment of the Simulation Layer. 
    *   *Green (0.0 - 0.3)*: Steady state.
    *   *Yellow (0.3 - 0.7)*: Moderate risk; system is carefully shadowing actions.
    *   *Red (0.7+)*: High risk; Automatic enforcement (Blocking) is likely active.
*   **`blocked_actions_total` (Counter)**: The cumulative number of actions stopped by the Circuit Breaker.

### 2. Operational Efficiency
*   **`simulation_latency` (Histogram)**: How long the safety check takes. If this exceeds 500ms consistently, the system will trigger `HUMAN_REQUIRED` (failsafe) states.
*   **`cumulative_system_risk`**: The risk score calculated by the Gateway when evaluating multiple agents as a single batch.

### 3. Identity & Health
*   **`active_agent_count`**: Number of cryptographically verified agents currently operating.
*   **`enforcement_violation_rate`**: Percentage of actions that attempted to bypass policies but were intercepted.

---

## 🛡️ Incident Response & Human-in-the-Loop

The dashboard is not just for viewing; it is for **decision-making**.

### When to Intervene
1.  **High Risk Plateau**: If the `risk_pressure` stays in the Red for more than 5 minutes, an operator should investigate the "Top Risky Agents" list on the dashboard.
2.  **Latency Spikes**: If simulation latency increases, agents may feel "laggy." This usually indicates that the Simulation Layer needs more resources (CPU/RAM).
3.  **Approval Queue Overflow**: If the count of `PENDING_APPROVAL` actions spikes, a human administrator is needed to review and sign off on "frozen" actions via the CLI or UI.

---

## 🏗️ Updated Architecture Flow

The system now operates in a closed observation loop:

`Agent Action` → `Safety Brain` → `Enforcement Decision` → **`Prometheus Metric`** → **`Grafana Alert/View`** → `Human Adjustment`

---

## 💡 Strategic Tips
*   **Set Data Retention**: Remind developers that the default Prometheus retention is 15 days. For long-term governance audits, consider external storage.
*   **Custom Alerts**: Encourage setting up Grafana Alerts to send a Slack or Email notification if the `risk_pressure` exceeds `0.85`.

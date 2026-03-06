# Monitoring Stack Operations

## 1) Launch the monitoring stack

From the repository root:

```powershell
docker compose -f docker-compose.monitoring.yml up -d
```

Check container status:

```powershell
docker compose -f docker-compose.monitoring.yml ps
```

Shut down the stack:

```powershell
docker compose -f docker-compose.monitoring.yml down
```

## 2) Access endpoints

- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090

Default Grafana credentials (fresh local volume):
- Username: `admin`
- Password: `admin`

Note: Grafana may force a password change on first login.

## 3) Confirm metric targets are up

Open Prometheus Targets page:
- http://localhost:9090/targets

Expected scrape jobs from `infra/monitoring/prometheus/prometheus.yml`:
- `gateway-service:8000` (`/metrics`)
- `scoring-engine:9464` (`/metrics`)
- `node-exporter:9100`

If `gateway-service` or `scoring-engine` show `DOWN`, Grafana enforcement panels will be empty or misleading until those services are reachable on the Docker network as those hostnames.

## 4) Brakes-too-heavy operator checklist

Watch these metrics/panels in the `Main Autonomy Dashboard`:

1. `rate(blocked_actions[5m])`
- Primary brake pressure signal.
- Warning sign: sustained increase without corresponding risk spike.

2. `rate(enforcement_success_total[5m])`
- Throughput of successful enforcement decisions.
- Warning sign: flat/declining while blocked rate rises.

3. `rate(enforcement_success_total[5m]) / clamp_min(rate(blocked_actions[5m]), 0.000001)`
- Enforcement efficiency ratio (success vs blocked).
- Warning sign: ratio persistently < `1.0` (more blocked than successful), especially if trending down.

4. `risk_pressure`
- Current system risk.
- Warning sign for over-braking: low/stable risk pressure while blocked rate remains high.

5. `risk_pressure_by_agent{agent_id=~".+"}`
- Per-agent concentration of risk.
- Warning sign for over-braking: widespread blocking across agents without clear high-risk outliers.

6. `simulation_latency`
- Safety-evaluation latency health.
- Warning sign: elevated tail latency can create operational pressure and should be investigated alongside high block rates.

## 5) Practical triage rule

Treat braking as potentially too heavy when all are true for 10-15 minutes:

- `rate(blocked_actions[5m])` is elevated and not decaying.
- Efficiency ratio stays below `1.0`.
- `risk_pressure` remains low or stable (no matching risk escalation).

This pattern usually indicates policy/enforcement sensitivity is too strict relative to observed risk.

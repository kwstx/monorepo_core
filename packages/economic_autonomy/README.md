# economic_autonomy

Modular, API-driven financial autonomy platform focused on:
- Budgeting and dynamic adjustment
- Tamper-evident PnL tracking
- Treasury pooling and cooperative project funding
- Predictive allocation with synergy-aware scoring

## Architecture

All functionality is exposed as independent API modules with no dependency on external agent orchestration layers.

```
src/
  platform/
    api/
      createApp.ts
      server.ts
      routes/
        budgetRoutes.ts
        predictiveRoutes.ts
        pnlRoutes.ts
        treasuryRoutes.ts
        recalibrationRoutes.ts
    context/
      PlatformContext.ts
    services/
      BudgetService.ts
      PredictiveAllocationService.ts
      PnLService.ts
      TreasuryService.ts
      RecalibrationService.ts
    state/
      InMemoryPlatformStore.ts
```

## Differentiation Layer

The platform is intentionally centered around three differentiator metrics in the allocation path:
- `predictiveSynergyIndex`
- `cooperativeIntelligenceWeight`
- `roiAwareAllocationIndex`

These are surfaced directly by `POST /predictive/score` and integrated into budget gating/priority decisions so downstream systems can consume allocation intelligence as API output instead of orchestration-side heuristics.

## Run

```bash
npm run start:api
```

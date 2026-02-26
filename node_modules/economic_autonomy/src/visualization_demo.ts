import type { AgentBudget } from './models/AgentBudget.js';
import { PnLTracker } from './PnLTracker.js';
import {
  BudgetPerformanceVisualizer,
  type AgentBudgetSnapshot,
  type AgentGroupDefinition
} from './BudgetPerformanceVisualizer.js';

function createBudget(agentId: string, totalBudget: number, spentBudget: number): AgentBudget {
  return {
    id: `budget-${agentId}`,
    agentId,
    allocations: [
      {
        resourceType: 'monetary',
        totalBudget,
        spentBudget,
        pendingAllocations: 0,
        unit: 'USD'
      },
      {
        resourceType: 'compute',
        totalBudget: 1000,
        spentBudget: Math.round(spentBudget * 0.08),
        pendingAllocations: 0,
        unit: 'vCPU-hours'
      }
    ],
    temporalConstraints: {
      startDate: new Date('2026-01-01T00:00:00Z'),
      renewalPeriod: 'monthly'
    },
    revisionHistory: [],
    status: 'active',
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date()
  };
}

function createHistoryPoint(
  budget: AgentBudget,
  timestamp: string,
  spentMonetary: number,
  spentCompute: number
): AgentBudgetSnapshot {
  return {
    timestamp: new Date(timestamp),
    agentId: budget.agentId,
    allocations: budget.allocations.map((allocation) => {
      if (allocation.resourceType === 'monetary') {
        return { ...allocation, spentBudget: spentMonetary };
      }
      if (allocation.resourceType === 'compute') {
        return { ...allocation, spentBudget: spentCompute };
      }
      return { ...allocation };
    })
  };
}

async function runVisualizationDemo(): Promise<void> {
  const tracker = new PnLTracker({ hmacSecret: 'visualization-demo-secret' });

  const alphaBudget = createBudget('agent-alpha', 10000, 7200);
  const betaBudget = createBudget('agent-beta', 7000, 4300);

  const actions = [
    { agentId: 'agent-alpha', actionId: 'a-1', revenue: 1500, directCosts: 700, coop: 80 },
    { agentId: 'agent-alpha', actionId: 'a-2', revenue: 800, directCosts: 900, coop: 30 },
    { agentId: 'agent-alpha', actionId: 'a-3', revenue: 1900, directCosts: 650, coop: 100 },
    { agentId: 'agent-beta', actionId: 'b-1', revenue: 900, directCosts: 500, coop: 40 },
    { agentId: 'agent-beta', actionId: 'b-2', revenue: 500, directCosts: 640, coop: 0 },
    { agentId: 'agent-beta', actionId: 'b-3', revenue: 1200, directCosts: 450, coop: 55 }
  ];

  actions.forEach((action, idx) => {
    tracker.recordExecutedAction({
      actionId: action.actionId,
      agentId: action.agentId,
      actionType: 'market_operation',
      executedAt: new Date(`2026-02-${10 + idx}T12:00:00Z`),
      status: 'executed',
      revenue: action.revenue,
      directCosts: action.directCosts,
      opportunityCosts: Math.round(action.directCosts * 0.08),
      cooperativeContributions: [
        {
          projectId: 'coop-growth',
          contributionValue: action.coop,
          notes: 'Cross-agent data sharing'
        }
      ],
      longTermStrategicImpact: Math.round(action.coop * 0.2)
    });
  });

  const history: AgentBudgetSnapshot[] = [
    createHistoryPoint(alphaBudget, '2026-02-01T00:00:00Z', 5000, 280),
    createHistoryPoint(alphaBudget, '2026-02-10T00:00:00Z', 6100, 400),
    createHistoryPoint(alphaBudget, '2026-02-20T00:00:00Z', 7200, 510),
    createHistoryPoint(betaBudget, '2026-02-01T00:00:00Z', 2800, 180),
    createHistoryPoint(betaBudget, '2026-02-10T00:00:00Z', 3600, 240),
    createHistoryPoint(betaBudget, '2026-02-20T00:00:00Z', 4300, 315)
  ];

  const groups: AgentGroupDefinition[] = [
    {
      id: 'g-market',
      name: 'Market Intelligence Guild',
      agentIds: ['agent-alpha', 'agent-beta']
    }
  ];

  const visualizer = new BudgetPerformanceVisualizer({
    lookbackActions: 8,
    deviationThreshold: 0.3
  });

  const result = visualizer.buildVisualizationModel({
    budgets: [alphaBudget, betaBudget],
    budgetHistory: history,
    ledger: tracker.getLedger(),
    groups
  });

  console.log(JSON.stringify(result, null, 2));
}

runVisualizationDemo().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

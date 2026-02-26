import type {
  AgentBudget,
  GateEvaluationResult,
  ProposedAgentAction,
  ActionPnLInput
} from 'economic_autonomy';
import { PreExecutionBudgetGate } from 'economic_autonomy';
import { InMemoryPlatformStore } from '../state/InMemoryPlatformStore.js';

export class BudgetService {
  constructor(private readonly store: InMemoryPlatformStore) { }

  public getOrCreateBudget(agentId: string): AgentBudget {
    const existing = this.store.budgets.get(agentId);
    if (existing) {
      return existing;
    }

    const budget: AgentBudget = {
      id: `budget-${agentId}`,
      agentId,
      allocations: [
        {
          resourceType: 'monetary',
          totalBudget: 10000,
          spentBudget: 0,
          pendingAllocations: 0,
          unit: 'USD'
        },
        {
          resourceType: 'compute',
          totalBudget: 1000,
          spentBudget: 0,
          pendingAllocations: 0,
          unit: 'vCPU-hours'
        }
      ],
      temporalConstraints: {
        startDate: new Date(),
        renewalPeriod: 'monthly'
      },
      revisionHistory: [],
      status: 'active',
      metadata: {
        source: 'platform-api'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.store.budgets.set(agentId, budget);
    return budget;
  }

  public evaluateAction(agentId: string, action: ProposedAgentAction): GateEvaluationResult {
    const budget = this.getOrCreateBudget(agentId);
    return PreExecutionBudgetGate(budget, action);
  }

  public reserveForAction(agentId: string, action: ProposedAgentAction): {
    budget: AgentBudget;
    evaluation: GateEvaluationResult;
  } {
    const budget = this.getOrCreateBudget(agentId);
    const evaluation = PreExecutionBudgetGate(budget, action);

    if (evaluation.decision === 'block') {
      return { budget, evaluation };
    }

    const allocation = budget.allocations.find((item) => item.resourceType === action.resourceType);
    if (!allocation) {
      return { budget, evaluation };
    }

    allocation.pendingAllocations += action.estimatedCost;
    budget.updatedAt = new Date();
    budget.revisionHistory.push({
      revisionId: `reserve-${Date.now()}`,
      timestamp: new Date(),
      actorId: 'BudgetService',
      reason: `Reserved budget for action ${action.actionId}`,
      changes: {
        pendingAllocations: {
          old: allocation.pendingAllocations - action.estimatedCost,
          new: allocation.pendingAllocations
        }
      }
    });

    return { budget, evaluation };
  }

  public reconcileExecutedAction(agentId: string, actionPnL: ActionPnLInput): AgentBudget {
    const budget = this.getOrCreateBudget(agentId);
    const resourceType = String(actionPnL.metadata?.['resourceType'] ?? 'monetary');
    const allocation = budget.allocations.find((item) => item.resourceType === resourceType);

    if (!allocation) {
      return budget;
    }

    const cost = actionPnL.directCosts;
    allocation.pendingAllocations = Math.max(0, allocation.pendingAllocations - cost);
    allocation.spentBudget += cost;
    budget.updatedAt = new Date();
    budget.revisionHistory.push({
      revisionId: `reconcile-${Date.now()}`,
      timestamp: new Date(),
      actorId: 'BudgetService',
      reason: `Reconciled execution ${actionPnL.actionId}`,
      changes: {
        spentBudget: {
          old: allocation.spentBudget - cost,
          new: allocation.spentBudget
        },
        pendingAllocations: {
          old: allocation.pendingAllocations + cost,
          new: allocation.pendingAllocations
        }
      }
    });

    return budget;
  }
}

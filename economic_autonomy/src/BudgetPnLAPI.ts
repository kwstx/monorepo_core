import express, { type Request, type Response } from 'express';
import type { AgentBudget } from './models/AgentBudget.js';
import { PnLTracker, type ActionPnLInput } from './PnLTracker.js';
import { TreasuryEngine } from './TreasuryEngine.js';
import { PreExecutionBudgetGate, type ProposedAgentAction } from './PreExecutionBudgetGate.js';
import {
    BudgetPerformanceVisualizer,
    type AgentBudgetSnapshot,
    type AgentGroupDefinition
} from './BudgetPerformanceVisualizer.js';

const app = express();
app.use(express.json());

/**
 * Standalone Budget & PnL API
 * Decoupled from any specific orchestration engine.
 */

// In-memory state for demonstration
const budgets = new Map<string, AgentBudget>();
const budgetHistory: AgentBudgetSnapshot[] = [];
const pnlTracker = new PnLTracker();
const treasuryEngine = new TreasuryEngine(pnlTracker);
const performanceVisualizer = new BudgetPerformanceVisualizer();

function cloneBudgetAllocations(budget: AgentBudget): AgentBudgetSnapshot['allocations'] {
    return budget.allocations.map(allocation => ({ ...allocation }));
}

function captureBudgetSnapshot(budget: AgentBudget): void {
    budgetHistory.push({
        timestamp: new Date(),
        agentId: budget.agentId,
        allocations: cloneBudgetAllocations(budget)
    });
}

/**
 * Helper to initialize a default budget if one doesn't exist for an agent.
 */
function getOrInitBudget(agentId: string): AgentBudget {
    if (!budgets.has(agentId)) {
        const newBudget: AgentBudget = {
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
                source: 'BudgetPnLAPI-AutoInit'
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
        budgets.set(agentId, newBudget);
        captureBudgetSnapshot(newBudget);
    }
    return budgets.get(agentId)!;
}

/**
 * Endpoint: getBudget(agent)
 * Retrieves the current budget state for a specific agent.
 */
app.get('/budget/:agentId', (req: Request, res: Response) => {
    const agentId = String(req.params['agentId']);
    const budget = getOrInitBudget(agentId);
    res.json({
        status: 'success',
        data: budget
    });
});

/**
 * Endpoint: allocateBudget(agent, action)
 * Validates and reserves budget for a proposed action.
 */
app.post('/budget/allocate', (req: Request, res: Response) => {
    const { agentId, action } = req.body as { agentId: string; action: ProposedAgentAction };

    if (!agentId || !action) {
        return res.status(400).json({ status: 'error', message: 'Missing agentId or action' });
    }

    const budget = getOrInitBudget(agentId);

    // Evaluate the action against the budget gate
    const evaluation = PreExecutionBudgetGate(budget, action);

    if (evaluation.decision === 'block') {
        return res.status(403).json({
            status: 'blocked',
            data: evaluation
        });
    }

    // If allowed or flagged, reserve the budget by incrementing pendingAllocations
    const allocation = budget.allocations.find(a => a.resourceType === action.resourceType);
    if (allocation) {
        allocation.pendingAllocations += action.estimatedCost;
        budget.updatedAt = new Date();
        budget.revisionHistory.push({
            revisionId: `alloc-${Date.now()}`,
            timestamp: new Date(),
            actorId: 'BudgetPnLAPI',
            reason: `Reserved budget for action: ${action.actionId}`,
            changes: {
                pendingAllocations: {
                    old: allocation.pendingAllocations - action.estimatedCost,
                    new: allocation.pendingAllocations
                }
            }
        });
        captureBudgetSnapshot(budget);
    }

    res.json({
        status: 'success',
        decision: evaluation.decision,
        data: evaluation
    });
});

/**
 * Endpoint: reportPnL(agent, action)
 * Finalizes budget consumption and logs profit/loss after action completion.
 */
app.post('/pnl/report', (req: Request, res: Response) => {
    const { agentId, actionPnL } = req.body as { agentId: string; actionPnL: ActionPnLInput };

    if (!agentId || !actionPnL) {
        return res.status(400).json({ status: 'error', message: 'Missing agentId or actionPnL' });
    }

    const budget = getOrInitBudget(agentId);

    // Record in the secure PnL ledger
    const entry = pnlTracker.recordExecutedAction(actionPnL);

    // Reconcile budget: move from pending to spent
    const resourceType = actionPnL.metadata?.resourceType as string || 'monetary';
    const allocation = budget.allocations.find(a => a.resourceType === resourceType);

    if (allocation) {
        const costToFinalize = actionPnL.directCosts;
        // In a more robust system, we would match the specific actionId's reserved amount
        allocation.pendingAllocations = Math.max(0, allocation.pendingAllocations - costToFinalize);
        allocation.spentBudget += costToFinalize;
        budget.updatedAt = new Date();

        budget.revisionHistory.push({
            revisionId: `pnl-reconcile-${Date.now()}`,
            timestamp: new Date(),
            actorId: 'BudgetPnLAPI',
            reason: `Finalized PnL for action: ${actionPnL.actionId}`,
            changes: {
                spentBudget: { old: allocation.spentBudget - costToFinalize, new: allocation.spentBudget },
                pendingAllocations: { old: allocation.pendingAllocations + costToFinalize, new: allocation.pendingAllocations }
            }
        });
        captureBudgetSnapshot(budget);
    }

    res.json({
        status: 'success',
        data: {
            pnlEntry: entry,
            updatedBudget: budget
        }
    });
});

/**
 * Endpoint: simulateBudgetImpact(action)
 * Runs a dry-run evaluation of a proposed action without mutating any state.
 */
app.post('/budget/simulate', (req: Request, res: Response) => {
    const action = req.body as ProposedAgentAction;

    if (!action || !action.agentId) {
        return res.status(400).json({ status: 'error', message: 'Missing action or agentId' });
    }

    const budget = getOrInitBudget(action.agentId);

    // Simulation is a passive evaluation
    const evaluation = PreExecutionBudgetGate(budget, action);

    res.json({
        status: 'success',
        data: {
            simulationResult: evaluation,
            recommendation: evaluation.decision === 'allow'
                ? 'Safe to execute.'
                : evaluation.decision === 'flag'
                    ? 'Execute with caution; high utilization.'
                    : 'Do not execute; exceeds budget limits.'
        }
    });
});

/**
 * Endpoint: poolFunds(agentGroup)
 * Pools unspent resources from a group of agents into a shared treasury.
 */
app.post('/treasury/pool', (req: Request, res: Response) => {
    const { agentGroup, poolName, resourceType, contributionPercentage } = req.body as {
        agentGroup: string[];
        poolName: string;
        resourceType: string;
        contributionPercentage: number;
    };

    if (!agentGroup || !poolName || !resourceType) {
        return res.status(400).json({ status: 'error', message: 'Missing required pooling parameters.' });
    }

    const poolId = `pool-${Date.now()}`;
    const pool = treasuryEngine.createPool(poolId, poolName, resourceType, 'USD');

    const contributions = agentGroup.map(agentId => {
        const budget = getOrInitBudget(agentId);
        const amount = treasuryEngine.contributeFromUnused(budget, poolId, contributionPercentage || 0.1);
        captureBudgetSnapshot(budget);
        return { agentId, amount };
    });

    res.json({
        status: 'success',
        data: {
            poolId,
            poolDetails: treasuryEngine.getPool(poolId),
            summary: contributions
        }
    });
});

/**
 * Endpoint: visualizeSystemHealth()
 * Builds agent and group budget/PnL visualization models with trends and deviation alerts.
 */
app.post('/visualization/health', (req: Request, res: Response) => {
    const { groups } = req.body as { groups?: AgentGroupDefinition[] };
    const currentBudgets = Array.from(budgets.values());

    if (currentBudgets.length === 0) {
        return res.status(400).json({
            status: 'error',
            message: 'No budgets available. Initialize at least one budget before requesting visualization.'
        });
    }

    const defaultGroup: AgentGroupDefinition = {
        id: 'group-all-agents',
        name: 'All Agents',
        agentIds: currentBudgets.map(b => b.agentId)
    };

    const visualization = performanceVisualizer.buildVisualizationModel({
        budgets: currentBudgets,
        budgetHistory,
        ledger: pnlTracker.getLedger(),
        groups: groups && groups.length > 0 ? groups : [defaultGroup]
    });

    res.json({
        status: 'success',
        data: visualization
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 BudgetPnLAPI listening on http://localhost:${PORT}`);
    console.log(`Endpoints available:`);
    console.log(` - GET  /budget/:agentId`);
    console.log(` - POST /budget/allocate`);
    console.log(` - POST /pnl/report`);
    console.log(` - POST /budget/simulate`);
    console.log(` - POST /treasury/pool`);
    console.log(` - POST /visualization/health`);
});

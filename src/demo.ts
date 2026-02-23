import type { AgentBudget } from './models/AgentBudget.js';
import { PreExecutionBudgetGate, type ProposedAgentAction } from './PreExecutionBudgetGate.js';
import { DynamicBudgetEngine, type RecalibrationInput } from './DynamicBudgetEngine.js';

/**
 * Example usage of the AgentBudget data model.
 */

const exampleAgentBudget: AgentBudget = {
    id: 'budget-001',
    agentId: 'agent-alpha',
    allocations: [
        {
            resourceType: 'monetary',
            totalBudget: 1000,
            spentBudget: 150.50,
            pendingAllocations: 50.00,
            unit: 'USD'
        },
        {
            resourceType: 'api_calls',
            totalBudget: 100000,
            spentBudget: 12000,
            pendingAllocations: 500,
            unit: 'tokens'
        },
        {
            resourceType: 'compute',
            totalBudget: 500,
            spentBudget: 45,
            pendingAllocations: 10,
            unit: 'vCPU-hours'
        },
        {
            resourceType: 'storage', // Future resource type supported by flexible schema
            totalBudget: 100,
            spentBudget: 20,
            pendingAllocations: 0,
            unit: 'GB'
        }
    ],
    temporalConstraints: {
        startDate: new Date('2026-01-01'),
        renewalPeriod: 'monthly'
    },
    revisionHistory: [
        {
            revisionId: 'rev-001',
            timestamp: new Date('2026-01-15T10:00:00Z'),
            actorId: 'treasury-admin',
            reason: 'Initial allocation increase',
            changes: {
                'allocations.monetary.totalBudget': { old: 500, new: 1000 }
            }
        }
    ],
    poolingId: 'coop-treasury-blue', // Cross-agent pooling support
    status: 'active',
    metadata: {
        priority: 'high',
        project: 'market-analysis-01'
    },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z')
};

const proposedActions: ProposedAgentAction[] = [
    {
        actionId: 'act-001',
        agentId: 'agent-alpha',
        actionType: 'market_scan',
        description: 'Run market scan for 3 regions',
        resourceType: 'monetary',
        estimatedCost: 120,
        projectedReturn: 250,
        cooperativeContributions: [
            { contributorAgentId: 'agent-beta', resourceType: 'monetary', amount: 50, confidence: 0.9, notes: 'Shared dataset license' }
        ],
        predictedDownstreamImpact: [
            { scenario: 'Need extra API enrichment', probability: 0.4, expectedAdditionalCost: 40, expectedBenefit: 90 }
        ]
    },
    {
        actionId: 'act-002',
        agentId: 'agent-alpha',
        actionType: 'partner_campaign',
        description: 'Launch expensive partner campaign',
        resourceType: 'monetary',
        estimatedCost: 900,
        projectedReturn: 1400,
        cooperativeContributions: [
            { contributorAgentId: 'agent-gamma', resourceType: 'monetary', amount: 200, confidence: 0.6 }
        ],
        predictedDownstreamImpact: [
            { scenario: 'Additional legal review', probability: 0.7, expectedAdditionalCost: 100, expectedBenefit: 120 },
            { scenario: 'Cross-sell upside', probability: 0.5, expectedAdditionalCost: 0, expectedBenefit: 300 }
        ]
    },
    {
        actionId: 'act-003',
        agentId: 'agent-alpha',
        actionType: 'heavy_compute',
        description: 'Long compute job close to budget edge',
        resourceType: 'compute',
        estimatedCost: 420,
        projectedReturn: 450,
        cooperativeContributions: [],
        predictedDownstreamImpact: [
            { scenario: 'Model retune needed', probability: 0.2, expectedAdditionalCost: 30, expectedBenefit: 60 }
        ]
    }
];

console.log('--- Agent Budget Model Demo ---');
console.log(`Agent ID: ${exampleAgentBudget.agentId}`);
console.log(`Pooling ID: ${exampleAgentBudget.poolingId || 'None'}`);
console.log('Allocations:');
exampleAgentBudget.allocations.forEach(alloc => {
    const remaining = alloc.totalBudget - alloc.spentBudget - alloc.pendingAllocations;
    console.log(` - ${alloc.resourceType}: ${alloc.spentBudget}/${alloc.totalBudget} ${alloc.unit} (Remaining: ${remaining})`);
});
console.log(`Revision History count: ${exampleAgentBudget.revisionHistory.length}`);
console.log('\n--- PreExecutionBudgetGate Demo ---');

for (const action of proposedActions) {
    const result = PreExecutionBudgetGate(exampleAgentBudget, action, {
        flagUtilizationThreshold: 0.9,
        logger: (entry) => {
            console.log(`[BLOCKED LOG] ${entry.action.actionId}: ${entry.decisionReason.join(' | ')}`);
            console.log(JSON.stringify(entry, null, 2));
        }
    });

    console.log(`${action.actionId} (${action.actionType}) => ${result.decision.toUpperCase()}`);
    console.log(` Reasons: ${result.reasons.join(' | ')}`);
}

console.log('-------------------------------');

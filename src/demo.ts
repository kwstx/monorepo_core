import { AgentBudget, ResourceAllocation } from './models/AgentBudget';

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

console.log('--- Agent Budget Model Demo ---');
console.log(`Agent ID: ${exampleAgentBudget.agentId}`);
console.log(`Pooling ID: ${exampleAgentBudget.poolingId || 'None'}`);
console.log('Allocations:');
exampleAgentBudget.allocations.forEach(alloc => {
    const remaining = alloc.totalBudget - alloc.spentBudget - alloc.pendingAllocations;
    console.log(` - ${alloc.resourceType}: ${alloc.spentBudget}/${alloc.totalBudget} ${alloc.unit} (Remaining: ${remaining})`);
});
console.log(`Revision History count: ${exampleAgentBudget.revisionHistory.length}`);
console.log('-------------------------------');

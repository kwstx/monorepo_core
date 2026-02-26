import type { AgentBudget } from './models/AgentBudget.js';
import { PreExecutionBudgetGate, type ProposedAgentAction } from './PreExecutionBudgetGate.js';
import { DynamicBudgetEngine, type RecalibrationInput } from './DynamicBudgetEngine.js';
import { PnLTracker } from './PnLTracker.js';

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
const pnlTracker = new PnLTracker({
    hmacSecret: 'demo-secret-shared-with-auditors'
});

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
    console.log(
        ` Predictive: ROI=${result.predictiveAssessment.expectedRoi.toFixed(2)}, ` +
        `Synergy=${(result.predictiveAssessment.cooperativeSynergy * 100).toFixed(1)}%, ` +
        `DownstreamScore=${(result.predictiveAssessment.downstreamImpactScore * 100).toFixed(1)}%, ` +
        `EffectiveBudget=${result.predictiveAssessment.effectiveAvailableBudget.toFixed(2)}`
    );

    if (result.decision === 'allow' || result.decision === 'flag') {
        const totalCooperativeSupport = (action.cooperativeContributions ?? []).reduce((sum, item) => sum + (item.amount * item.confidence), 0);
        const expectedDownstreamBenefit = (action.predictedDownstreamImpact ?? []).reduce(
            (sum, item) => sum + (item.expectedBenefit * item.probability),
            0
        );

        const logEntry = pnlTracker.recordExecutedAction({
            actionId: action.actionId,
            agentId: action.agentId,
            actionType: action.actionType,
            status: 'executed',
            revenue: (action.projectedReturn ?? 0) + expectedDownstreamBenefit,
            directCosts: action.estimatedCost,
            opportunityCosts: Math.max(0, (action.projectedReturn ?? 0) * 0.05),
            cooperativeContributions: (action.cooperativeContributions ?? []).map((c) => ({
                projectId: c.notes ?? `shared-${c.contributorAgentId}`,
                contributionValue: c.amount * c.confidence,
                notes: `Contributor: ${c.contributorAgentId}`
            })),
            longTermStrategicImpact: totalCooperativeSupport * 0.2,
            metadata: {
                gateDecision: result.decision,
                utilizationAfterAction: result.allocationSnapshot.utilizationAfterAction
            }
        });

        console.log(` PnL entry: ${logEntry.entryId}, hash=${logEntry.payloadHash.slice(0, 12)}...`);
    }
}

console.log('-------------------------------');
console.log('\n--- PnLTracker Verification Demo ---');
const ledgerVerification = pnlTracker.verifyLedger();
console.log(`Ledger valid: ${ledgerVerification.valid} (entries checked: ${ledgerVerification.checkedEntries})`);
for (const entry of pnlTracker.getLedger()) {
    console.log(
        ` - ${entry.entryId}: agent=${entry.agentId}, action=${entry.actionId}, revenue=${entry.revenue}, totalCosts=${entry.totalCosts}, netPnL=${entry.netPnL}`
    );
}

console.log('\n--- DynamicBudgetEngine Recalibration Demo ---');

const engine = new DynamicBudgetEngine({
    learningRate: 0.2, // Faster adaptation for demo purposes
    maxIncreasePercentage: 0.3,
    maxDecreasePercentage: 0.2
});

const highPerfInput: RecalibrationInput = {
    agentId: 'agent-alpha',
    metrics: {
        successRate: 0.95,
        efficiencyScore: 0.88,
        latencyMs: 120,
        reliabilityScore: 0.98
    },
    simulations: [
        { simulatedScenario: 'Market Expansion', successProbability: 0.85, projectedCost: 500, projectedBenefit: 1200, riskLevel: 'low' }
    ],
    roi: {
        actualRoi: 0.45,
        projectedRoi: 0.60,
        confidenceInterval: [0.4, 0.7]
    },
    feedback: {
        approvalRate: 1.0,
        sentimentScore: 0.9,
        notes: 'Excellent performance in recent quarters.'
    },
    cooperativeImpactFactor: 1.0 // Neutral
};

console.log('\nSCENARIO 1: High Performance Agent');
const result1 = engine.recalibrate(exampleAgentBudget, highPerfInput);
console.log(`Adjustment Reasons: ${result1.adjustmentReasons.join(' | ')}`);
result1.newAllocations.forEach(a => {
    const prev = result1.previousAllocations.find(p => p.resourceType === a.resourceType);
    console.log(` - ${a.resourceType}: ${prev?.totalBudget} -> ${a.totalBudget} ${a.unit}`);
});

// Create a copy of the budget for scenario 2
const underperfBudget: any = JSON.parse(JSON.stringify(exampleAgentBudget));
underperfBudget.id = 'budget-002';
underperfBudget.agentId = 'agent-underperf';

const lowPerfInput: RecalibrationInput = {
    agentId: 'agent-underperf',
    metrics: {
        successRate: 0.4,
        efficiencyScore: 0.3,
        latencyMs: 800,
        reliabilityScore: 0.5
    },
    simulations: [
        { simulatedScenario: 'Feature Backlog', successProbability: 0.2, projectedCost: 1000, projectedBenefit: 200, riskLevel: 'high' }
    ],
    roi: {
        actualRoi: -0.3,
        projectedRoi: -0.1,
        confidenceInterval: [-0.5, 0.1]
    },
    feedback: {
        approvalRate: 0.2,
        sentimentScore: -0.4,
        notes: 'Multiple failures and high cost.'
    },
    cooperativeImpactFactor: 1.0
};

console.log('\nSCENARIO 2: Underperforming Agent');
const result2 = engine.recalibrate(underperfBudget, lowPerfInput);
console.log(`Adjustment Reasons: ${result2.adjustmentReasons.join(' | ')}`);
result2.newAllocations.forEach(a => {
    const prev = result2.previousAllocations.find(p => p.resourceType === a.resourceType);
    console.log(` - ${a.resourceType}: ${prev?.totalBudget} -> ${a.totalBudget} ${a.unit}`);
});

// Scenario 3: Underperforming but highly cooperative agent
const cooperativeBudget: any = JSON.parse(JSON.stringify(underperfBudget));
cooperativeBudget.id = 'budget-003';
cooperativeBudget.agentId = 'agent-coop-underperf';

const coopLowPerfInput: RecalibrationInput = {
    ...lowPerfInput,
    agentId: 'agent-coop-underperf',
    cooperativeImpactFactor: 2.5 // Highly cooperative
};

console.log('\nSCENARIO 3: Underperforming but Highly Cooperative Agent');
const result3 = engine.recalibrate(cooperativeBudget, coopLowPerfInput);
console.log(`Adjustment Reasons: ${result3.adjustmentReasons.join(' | ')}`);
result3.newAllocations.forEach(a => {
    const prev = result3.previousAllocations.find(p => p.resourceType === a.resourceType);
    console.log(` - ${a.resourceType}: ${prev?.totalBudget} -> ${a.totalBudget} ${a.unit}`);
});

console.log('-------------------------------');

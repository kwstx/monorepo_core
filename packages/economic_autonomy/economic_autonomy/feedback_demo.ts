import type { AgentBudget } from './models/AgentBudget.js';
import { PnLTracker } from './PnLTracker.js';
import { DynamicBudgetEngine } from './DynamicBudgetEngine.js';
import { FeedbackIntegrationLayer } from './FeedbackIntegrationLayer.js';

async function runFeedbackDemo() {
    console.log('=== Feedback Integration Layer Demo ===\n');

    // 1. Initialize Components
    const pnlTracker = new PnLTracker({ hmacSecret: 'demo-secret' });
    const budgetEngine = new DynamicBudgetEngine({ learningRate: 0.15 });
    const feedbackLayer = new FeedbackIntegrationLayer(pnlTracker, budgetEngine);

    // 2. Setup initial agent budget
    const agentBudget: AgentBudget = {
        id: 'budget-beta-1',
        agentId: 'agent-beta',
        allocations: [
            { resourceType: 'monetary', totalBudget: 500, spentBudget: 480, pendingAllocations: 0, unit: 'USD' }, // Over-utilized
            { resourceType: 'api_calls', totalBudget: 10000, spentBudget: 500, pendingAllocations: 0, unit: 'tokens' } // Under-utilized
        ],
        temporalConstraints: { startDate: new Date(), renewalPeriod: 'monthly' },
        revisionHistory: [],
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };

    console.log('Initial Allocations for agent-beta:');
    agentBudget.allocations.forEach(a => console.log(` - ${a.resourceType}: ${a.spentBudget}/${a.totalBudget} ${a.unit}`));
    console.log('');

    // 3. Record some PnL history (Real-world results)
    console.log('Recording historical PnL outcomes...');

    // An efficient successful action
    pnlTracker.recordExecutedAction({
        actionId: 'act-101',
        agentId: 'agent-beta',
        actionType: 'data_mining',
        status: 'executed',
        revenue: 300,
        directCosts: 50,
        opportunityCosts: 10,
        cooperativeContributions: [],
        longTermStrategicImpact: 20
    });

    // An inefficient successful action
    pnlTracker.recordExecutedAction({
        actionId: 'act-102',
        agentId: 'agent-beta',
        actionType: 'expensive_query',
        status: 'executed',
        revenue: 50,
        directCosts: 120, // Costs more than it earned
        opportunityCosts: 20,
        cooperativeContributions: [],
        longTermStrategicImpact: 5
    });

    // A failed action (waste of resources)
    pnlTracker.recordExecutedAction({
        actionId: 'act-103',
        agentId: 'agent-beta',
        actionType: 'market_bet',
        status: 'failed',
        revenue: 0,
        directCosts: 100,
        opportunityCosts: 50,
        cooperativeContributions: [],
        longTermStrategicImpact: 0,
        metadata: { failureReason: 'market volatility' }
    });

    console.log('History recorded. Processing feedback...\n');

    // 4. Run the Feedback Integration Layer
    const { recalibrationResult, insights } = feedbackLayer.processFeedback(agentBudget);

    // 5. Display Results
    console.log('--- GENERATED INSIGHTS ---');
    console.log('Performance Summary:');
    console.log(` - Net PnL: ${insights.performanceSummary.netPnL.toFixed(2)}`);
    console.log(` - Success Rate: ${(insights.performanceSummary.successRate * 100).toFixed(1)}%`);
    console.log(` - Avg ROI: ${insights.performanceSummary.averageRoi.toFixed(2)}`);

    console.log('\nFlagged Inefficiencies:');
    insights.inefficiencies.forEach(i => console.log(` [!] ${i}`));

    console.log('\nUtilization Patterns:');
    insights.utilizationPatterns.forEach(u => console.log(` [i] ${u}`));

    console.log('\n--- BUDGET RECALIBRATION ---');
    console.log(`Reasons: ${recalibrationResult.adjustmentReasons.join(' | ')}`);
    recalibrationResult.newAllocations.forEach(a => {
        const prev = recalibrationResult.previousAllocations.find(p => p.resourceType === a.resourceType);
        console.log(` - ${a.resourceType}: ${prev?.totalBudget} ${a.unit} -> ${a.totalBudget} ${a.unit}`);
    });

    console.log('\nDemo complete.');
}

runFeedbackDemo().catch(console.error);

import { DynamicBudgetEngine } from './DynamicBudgetEngine.js';
import { OverrideLearningLayer } from './OverrideLearningLayer.js';
import { AgentBudget } from './models/AgentBudget.js';
async function runDemo() {
    console.log("=== Override Learning Layer Demo ===\n");
    const learningLayer = new OverrideLearningLayer(0.2); // Faster learning for demo
    const engine = new DynamicBudgetEngine({
        maxIncreasePercentage: 0.5,
        maxDecreasePercentage: 0.5,
        overrideLayer: learningLayer
    });
    const agentId = "agent-delta-9";
    const actionType = "market_analysis";
    // 1. Initial Budget
    const budget = {
        id: "b-001",
        agentId: agentId,
        allocations: [{
                resourceType: "api_calls",
                totalBudget: 1000,
                spentBudget: 950, // High utilization
                pendingAllocations: 0,
                unit: "calls"
            }],
        temporalConstraints: {
            startDate: new Date(),
            renewalPeriod: "monthly"
        },
        revisionHistory: [],
        status: "active",
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };
    // 2. Simulate Performance Data (Poor performance, but high utilization)
    const poorPerformanceInput = {
        agentId: agentId,
        actionType: actionType,
        metrics: {
            successRate: 0.3, // Failure!
            efficiencyScore: 0.2,
            latencyMs: 500,
            reliabilityScore: 0.3
        },
        simulations: [],
        roi: {
            actualRoi: -0.5, // Negative ROI
            projectedRoi: 0.1,
            confidenceInterval: [-0.6, 0.8]
        },
        feedback: {
            approvalRate: 0.2,
            sentimentScore: -0.8,
            notes: "Poor market predictions."
        },
        strategicImpact: 0.8, // But high strategic impact!
        cooperativeImpactFactor: 1.0
    };
    console.log("--- Initial Recalibration (Before Override Learning) ---");
    const result1 = engine.recalibrate(budget, poorPerformanceInput);
    console.log(`Proposed Adjustment Reasons: \n  ${result1.adjustmentReasons.join("\n  ")}`);
    // Calculate the percentage change proposed
    const oldBudget = result1.previousAllocations[0].totalBudget;
    const newBudget = result1.newAllocations[0].totalBudget;
    const proposedPct = (newBudget - oldBudget) / oldBudget;
    console.log(`Proposed Budget Change: ${(proposedPct * 100).toFixed(2)}%`);
    // 3. Human Expert Override
    console.log("\n--- Applying Expert Override ---");
    const overridePct = 0.25; // Human wants a 25% increase instead of a decrease
    const rationale = "Market analysis is highly strategic for long-term growth, despite recent failures. Need more capacity to recover.";
    const correction = {
        correctionId: `corr-${Date.now()}`,
        agentId: agentId,
        actionType: actionType,
        originalAdjustment: proposedPct,
        overrideAdjustment: overridePct,
        rationale: rationale,
        timestamp: new Date(),
        metadata: { expert: "senior_strategist_01" }
    };
    learningLayer.recordOverride(correction);
    console.log(`Recorded correction with rationale: "${rationale}"`);
    // 4. Second Recalibration (After learning)
    console.log("\n--- Second Recalibration (After Learning from Override) ---");
    // Use the same poor performance data
    const result2 = engine.recalibrate(budget, poorPerformanceInput);
    console.log(`Adjusted Reasons: \n  ${result2.adjustmentReasons.join("\n  ")}`);
    const finalBudget = result2.newAllocations[0].totalBudget;
    const postLearningPct = (finalBudget - newBudget) / newBudget;
    console.log(`New Proposed Budget Change: ${(postLearningPct * 100).toFixed(2)}%`);
    const rule = learningLayer.getEffectiveRule(actionType);
    console.log(`\nFinal Weights for "${actionType}":`);
    console.log(`  Performance: ${rule.weights.performance.toFixed(3)}`);
    console.log(`  ROI: ${rule.weights.roi.toFixed(3)}`);
    console.log(`  Strategic Impact: ${rule.weights.strategicImpact.toFixed(3)}`);
    console.log(`  Bias (Learned Adjustment): ${rule.bias.toFixed(3)}`);
    console.log("\n=== Demo Completed ===");
}
runDemo().catch(console.error);
//# sourceMappingURL=override_learning_demo.js.map
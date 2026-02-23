import { DecisionEvaluationFramework } from './DecisionEvaluationFramework.js';
import type { RawAgentAction } from './DecisionEvaluationFramework.js';
import { RiskScoringEngine } from './RiskScoringEngine.js';
import type { RiskScoringContext, CooperativeSystemState } from './RiskScoringEngine.js';

async function main() {
    const framework = new DecisionEvaluationFramework();
    const scoringEngine = new RiskScoringEngine();

    // Imagine an agent proposing to delete a sensitive log file
    const rawAction: RawAgentAction = {
        agentId: 'agent-alice-001',
        action: 'FILE_DELETE',
        params: {
            path: '/logs/audit.log',
            intent: 'Cleanup old audit records to save disk space'
        },
        context: {
            agentType: 'MAINTENANCE_BOT',
            id: 'ctx-12345',
            delegationChain: ['sys-admin', 'maintenance-service']
        }
    };

    console.log('--- Intercepting and Evaluating Action ---');
    const decisionObject = await framework.evaluateAction(rawAction);
    console.log(`Action ID: ${decisionObject.id}`);
    console.log(`Intent: ${decisionObject.intent}`);
    console.log(`Projected Opportunity Cost of Blocking: $${decisionObject.resourceAnalysis.projectedOpportunityCostOfBlockingUSD}`);

    // Scoring context
    const context: RiskScoringContext = {
        budgetPressure: 0.2,
        dataSensitivity: 0.8, // Sensitive log file!
        historicalComplianceRate: 0.95
    };

    // Current system state
    const systemState: CooperativeSystemState = {
        loadFactor: 0.1,
        incidentActive: false,
        regulatoryAlert: false,
        recoveryBacklogSeconds: 0
    };

    console.log('\n--- Scoring Decision via RiskScoringEngine ---');
    const scoreResult = scoringEngine.scoreDecision(decisionObject, context, systemState);

    console.log(`Final Decision Score: ${scoreResult.decisionScore}/100`);
    console.log(`Risk Pressure: ${(scoreResult.riskPressure * 100).toFixed(2)}%`);

    if (decisionObject.complianceForecast) {
        console.log('\n--- Probabilistic Compliance Lifecycle Forecast ---');
        console.log(`Overall Compliance Probability: ${(decisionObject.complianceForecast.overallProbability * 100).toFixed(2)}%`);
        console.log(`Lifecycle States: ${JSON.stringify(decisionObject.complianceForecast.lifecycleStageProbabilities, null, 2)}`);
        console.log(`Primary Risk Drivers: ${decisionObject.complianceForecast.primaryRiskDrivers.join(', ')}`);
        console.log(`Estimated Drift Impact: ${decisionObject.complianceForecast.estimatedDriftImpact.toFixed(4)}`);
    }

    console.log(`Opportunity Projection: ${(scoreResult.breakdown.dimensionScores.opportunityCostProjection * 100).toFixed(2)}%`);

    console.log('\nDimension Scores:');
    console.log(JSON.stringify(scoreResult.breakdown.dimensionScores, null, 2));

    if (scoreResult.decisionScore < 70) {
        if (scoreResult.breakdown.dimensionScores.opportunityCostProjection > 0.65) {
            console.log('\n[RESULT] ACTION FLAGGED FOR REVIEW (HIGH OPPORTUNITY COST IF BLOCKED)');
        } else {
            console.log('\n[RESULT] ACTION FLAGGED FOR REVIEW');
        }
    } else {
        console.log('\n[RESULT] ACTION ALLOWED');
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

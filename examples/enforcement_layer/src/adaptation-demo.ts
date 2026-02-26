import { ThresholdAdaptationEngine } from './core/threshold-adaptation-engine';
import { PredictiveRiskEngine } from './layers/pre-execution/predictive-risk-engine';
import { AnomalyDetectionEngine } from './layers/in-process/anomaly-detection-engine';
import { ActionContext, EnforcementState, ViolationSeverity, ViolationCategory } from './core/models';

async function runDemo() {
    console.log('--- Threshold Adaptation Engine Demo ---');

    const adaptationEngine = ThresholdAdaptationEngine.getInstance();
    const riskEngine = new PredictiveRiskEngine();
    const anomalyEngine = new AnomalyDetectionEngine();

    const mockContext: ActionContext = {
        actionId: 'act-123',
        agentId: 'agent-007',
        intent: 'Access sensitive financial records for audit',
        params: { privacySensitive: true },
        status: EnforcementState.PENDING,
        violations: [],
        interventions: []
    };

    // Initial Risk Evaluation
    console.log('\n[Phase 1] Initial State');
    const risk1 = await riskEngine.evaluate(mockContext);
    console.log(`Initial Risk Score: ${risk1.overallRiskScore.toFixed(2)}`);

    // Simulate 5 false positives (system was too strict)
    console.log('\n[Phase 2] Simulating 5 False Positives (System too strict)');
    for (let i = 0; i < 5; i++) {
        const report = adaptationEngine.recordOutcome({
            actionId: `fp-${i}`,
            timestamp: new Date(),
            violationsDetected: [],
            interventionsApplied: [],
            realWorldImpact: 0.05,
            isFalsePositive: true,
            wasUnderRestricted: false,
            wasOverRestricted: true
        });
        if (report) {
            console.log(`Adaptation Event: ${report.adaptationReason}`);
        }
    }

    // Risk Evaluation after relaxation
    console.log('\n[Phase 3] After False Positive Adaptation');
    const risk2 = await riskEngine.evaluate(mockContext);
    console.log(`Risk Score after relaxation: ${risk2.overallRiskScore.toFixed(2)} (Expect lower score / more tolerance)`);

    // Simulate 5 dangerous outcomes (system was too loose)
    console.log('\n[Phase 4] Simulating 5 Missed Violations (System too loose)');
    for (let i = 0; i < 5; i++) {
        const report = adaptationEngine.recordOutcome({
            actionId: `missed-${i}`,
            timestamp: new Date(),
            violationsDetected: [],
            interventionsApplied: [],
            realWorldImpact: 0.8, // High impact!
            isFalsePositive: false,
            wasUnderRestricted: true,
            wasOverRestricted: false
        });
        if (report) {
            console.log(`Adaptation Event: ${report.adaptationReason}`);
        }
    }

    // Risk Evaluation after tightening
    console.log('\n[Phase 5] After Safety Risk Adaptation');
    const risk3 = await riskEngine.evaluate(mockContext);
    console.log(`Risk Score after tightening: ${risk3.overallRiskScore.toFixed(2)} (Expect higher score / less tolerance)`);

    console.log('\n--- Demo Completed ---');
}

runDemo().catch(console.error);

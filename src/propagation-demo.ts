import { GuardrailOrchestrator } from './orchestrator/guardrail-orchestrator';
import { ViolationPropagationModule } from './core/violation-propagation';

async function runPropagationDemo() {
    const orchestrator = new GuardrailOrchestrator();
    const propagation = ViolationPropagationModule.getInstance();

    console.log('=== Violation Propagation Demo ===\n');

    console.log('--- Initial State ---');
    console.log(JSON.stringify(propagation.getPropagationParameters(), null, 2));

    console.log('\n--- Action 1: Triggers a Post-Execution Violation ---');
    // This action will pass pre-execution and in-process but fail at post-execution audit
    const result1 = await orchestrator.coordinate('agent-x', 'Standard operation', {
        invalidResult: true // Triggers audit failure in PostExecutionLayer
    });
    console.log(`Action 1 Status: ${result1.status}`);
    console.log(`Action 1 Violations: ${result1.violations.length}`);

    console.log('\n--- State After Action 1 ---');
    console.log(JSON.stringify(propagation.getPropagationParameters(), null, 2));

    console.log('\n--- Action 2: Observe tighter thresholds and higher risk ---');
    // This action has parameters that might be borderline, but now should be blocked or warned more easily
    const result2 = await orchestrator.coordinate('agent-x', 'Semi-sensitive operation', {
        networkAccess: true, // Increases risk score in PredictiveRiskEngine
        privacySensitive: true // Also increases risk score
    });
    console.log(`Action 2 Status: ${result2.status}`);
    console.log(`Action 2 Violations: ${result2.violations.map(v => v.description).join(', ')}`);
    console.log(`Action 2 Risk Score: ${result2.riskProfile?.overallRiskScore.toFixed(2)}`);

    console.log('\n--- Action 3: Triggering another violation ---');
    const result3 = await orchestrator.coordinate('agent-x', 'Another operation', {
        unauthorized: true
    });

    console.log('\n--- Final State ---');
    console.log(JSON.stringify(propagation.getPropagationParameters(), null, 2));

    console.log('\n--- Recalibrating (Cooling down) ---');
    propagation.recalibrate();
    console.log(JSON.stringify(propagation.getPropagationParameters(), null, 2));
}

runPropagationDemo().catch(console.error);

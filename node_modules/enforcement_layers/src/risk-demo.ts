import { GuardrailOrchestrator } from './orchestrator/guardrail-orchestrator';

async function runRiskDemo() {
    const orchestrator = new GuardrailOrchestrator();

    console.log('--- Case 1: Low Risk (Safe Action) ---');
    const result1 = await orchestrator.coordinate('trusted-agent-alpha', 'View Audit Logs', { path: '/logs/audit' });
    console.log('Result Status:', result1.status);
    console.log('Risk Recommendation:', result1.riskProfile?.recommendation);
    console.log('Consequences:', result1.riskProfile?.realWorldConsequences);

    console.log('\n--- Case 2: Elevated Risk (HOLD/Warning) ---');
    // Triggers networkAccess propagation and privacySensitive policy forecast
    const result2 = await orchestrator.coordinate('agent-beta', 'Sync User Data', {
        networkAccess: true,
        privacySensitive: true
    });
    console.log('Result Status:', result2.status);
    console.log('Overall Risk:', result2.riskProfile?.overallRiskScore.toFixed(2));
    console.log('Risk Recommendation:', result2.riskProfile?.recommendation);
    console.log('Violations:', result2.violations.map(v => v.description));

    console.log('\n--- Case 3: High Risk (BLOCK) ---');
    // Untrusted agent + Delete + Network Access = Very High Risk
    const result3 = await orchestrator.coordinate('untrusted-rogue-agent', 'Delete Production Cluster', {
        unauthorized: false, // Not a simple permission fail, but a risk fail
        networkAccess: true,
        deleteNodes: true // Triggers major synergy shift in my logic
    });
    console.log('Result Status:', result3.status);
    console.log('Overall Risk:', result3.riskProfile?.overallRiskScore.toFixed(2));
    console.log('Risk Recommendation:', result3.riskProfile?.recommendation);
    console.log('Violations:', result3.violations.map(v => v.description));

    if (result3.riskProfile) {
        console.log('\nSynergy Shifts:');
        result3.riskProfile.synergyShifts.forEach(s => console.log(` - ${s.component}: ${s.delta} (${s.reason})`));
        console.log('\nPropagation Effects:');
        result3.riskProfile.propagationEffects.forEach(e => console.log(` - ${e.targetSystem} (Prob: ${e.probability}): ${e.description}`));
    }
}

runRiskDemo().catch(console.error);

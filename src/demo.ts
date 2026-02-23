import { GuardrailOrchestrator } from './orchestrator/guardrail-orchestrator';

async function runDemo() {
    const orchestrator = new GuardrailOrchestrator();

    console.log('--- Case 1: Clean Action ---');
    const result1 = await orchestrator.coordinate('agent-007', 'Read documentation', { path: '/docs/api' });
    console.log('Result 1 status:', result1.status);
    console.log('Violations:', result1.violations.length);

    console.log('\n--- Case 2: Pre-execution Violation ---');
    const result2 = await orchestrator.coordinate('agent-007', 'Delete database', { unauthorized: true });
    console.log('Result 2 status:', result2.status);
    console.log('Violations:', result2.violations.map(v => v.description));

    console.log('\n--- Case 3: In-process & Post-execution Violation ---');
    const result3 = await orchestrator.coordinate('agent-007', 'Large Data Transfer', { resourceUsage: 150, invalidResult: true });
    console.log('Result 3 status:', result3.status);
    console.log('Violations:', result3.violations.map(v => v.description));
}

runDemo().catch(console.error);

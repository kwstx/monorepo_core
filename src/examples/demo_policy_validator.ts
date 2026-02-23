
import { AgentCoordinationMessage, MessageType } from '../schema/MessageSchema';
import { CoordinationPolicy, ViolationSeverity } from '../schema/PolicySchema';
import { CoordinationPolicyValidator } from '../engine/CoordinationPolicyValidator';

/**
 * Demo: Using CoordinationPolicyValidator to enforce business, legal, and compliance rules.
 */

const enterprisePolicy: CoordinationPolicy = {
    id: 'policy_ent_7712',
    name: 'Enterprise Coordination Policy v2',
    economic: {
        minRoi: 1.5,
        maxBudget: 1000,
        allowedCurrencies: ['USDT', 'USD']
    },
    compliance: {
        maxRiskScore: 0.4,
        prohibitedTaskKeywords: ['weapons', 'crypto-mining', 'illegal']
    },
    governance: {
        approvedAgents: ['agent:alpha-prime', 'agent:beta-core'],
        requiredMetadataFields: ['departmentId'],
        maxScopeTasks: 5
    }
};

const validator = new CoordinationPolicyValidator();

// 1. Fully Compliant Message
const compliantMessage: AgentCoordinationMessage = {
    version: '1.0.0',
    messageId: 'msg_001',
    timestamp: new Date().toISOString(),
    type: MessageType.OFFER,
    sender: { id: 'agent:alpha-prime', publicKey: 'pk1', algorithm: 'Ed25519' },
    recipient: { id: 'agent:beta-core', publicKey: 'pk2', algorithm: 'Ed25519' },
    content: {
        scope: {
            tasks: ['Cloud Infrastructure Audit', 'Compliance Mapping'],
            deliverables: ['Audit Report'],
            milestones: [{ description: 'Start', deadline: '2026-04-01T00:00:00Z' }],
            constraints: []
        },
        resources: {
            budget: { amount: 500, currency: 'USDT', limit: 600 }
        },
        deadline: '2026-05-01T00:00:00Z',
        risks: { riskScore: 0.1, identifiedRisks: [] },
        impact: { predictedRoi: 2.0, estimatedCost: 400, netValue: 800, synergyScore: 0.9 }
    },
    metadata: { departmentId: 'dept-fin-01' }
};

// 2. Message Violating Financial Rules (Budget Too High)
const highBudgetMessage: AgentCoordinationMessage = {
    ...compliantMessage,
    messageId: 'msg_002',
    content: {
        ...compliantMessage.content,
        resources: {
            ...compliantMessage.content.resources,
            budget: { amount: 2500, currency: 'USDT', limit: 3000 }
        }
    }
};

// 3. Message Violating Compliance (Prohibited Task)
const illegalTaskMessage: AgentCoordinationMessage = {
    ...compliantMessage,
    messageId: 'msg_003',
    content: {
        ...compliantMessage.content,
        scope: {
            ...compliantMessage.content.scope,
            tasks: ['Offshore crypto-mining operation']
        }
    }
};

// 4. Message Violating Governance (Unauthorized Agent)
const unauthorizedAgentMessage: AgentCoordinationMessage = {
    ...compliantMessage,
    messageId: 'msg_004',
    sender: { id: 'agent:rogue-x', publicKey: 'pk_err', algorithm: 'Ed25519' }
};

console.log('--- EVALUATING COMPLIANT MESSAGE ---');
const result1 = validator.evaluate(compliantMessage, enterprisePolicy);
console.log(`Is Valid: ${result1.isValid}`);
console.log(`Violations: ${result1.violations.length}`);

console.log('\n--- EVALUATING HIGH BUDGET MESSAGE (EXPECT MODIFICATION) ---');
const result2 = validator.evaluate(highBudgetMessage, enterprisePolicy);
console.log(`Is Valid: ${result2.isValid}`);
console.log(`Violations: ${result2.violations.map(v => `[${v.severity}] ${v.ruleId}: ${v.message}`).join(', ')}`);
if (result2.modifiedMessage) {
    console.log(`New Budget: ${result2.modifiedMessage.content.resources.budget.amount}`);
}

console.log('\n--- EVALUATING ILLEGAL TASK MESSAGE (EXPECT REJECTIONS) ---');
const result3 = validator.evaluate(illegalTaskMessage, enterprisePolicy);
console.log(`Is Valid: ${result3.isValid}`);
result3.violations.forEach(v => console.log(` - [${v.severity}] ${v.ruleId}: ${v.message}`));

console.log('\n--- EVALUATING UNAUTHORIZED AGENT MESSAGE ---');
const result4 = validator.evaluate(unauthorizedAgentMessage, enterprisePolicy);
console.log(`Is Valid: ${result4.isValid}`);
result4.violations.forEach(v => console.log(` - [${v.severity}] ${v.ruleId}: ${v.message}`));

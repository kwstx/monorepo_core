import { ContractFactory } from '../schema/ContractSchema';
import { AgentIdentity, AgentCoordinationMessage, MessageType } from '../schema/MessageSchema';
import { ImmutableAuditLog } from '../audit/ImmutableAuditLog';
import { CoordinationPolicyValidator } from '../engine/CoordinationPolicyValidator';
import { CoordinationPolicy } from '../schema/PolicySchema';
import { NegotiationEngine } from '../engine/NegotiationEngine';

/**
 * Demo: End-to-end traceability from initial offer to final task completion.
 */

const agentAlpha: AgentIdentity = {
    id: 'agent:alpha-prime',
    publicKey: 'pubkey-alpha',
    algorithm: 'Ed25519'
};

const agentBeta: AgentIdentity = {
    id: 'agent:beta-core',
    publicKey: 'pubkey-beta',
    algorithm: 'Ed25519'
};

const auditLog = new ImmutableAuditLog();
const validator = new CoordinationPolicyValidator(auditLog);
const negotiationEngine = new NegotiationEngine({
    identityVerifier: { verify: () => true },
    reputationProvider: { getScore: () => 0.9 },
    budgetProvider: { getAvailableBudget: () => 10_000 },
    authorityProvider: { hasPermission: () => true },
    minimumReputationScore: 0.6,
    auditSink: auditLog
});

const policy: CoordinationPolicy = {
    id: 'policy-governance-audit',
    name: 'Governance Policy',
    economic: { minRoi: 1.2, maxBudget: 2000, allowedCurrencies: ['USDT', 'USD'] },
    compliance: { maxRiskScore: 0.5 },
    governance: { approvedAgents: [agentAlpha.id, agentBeta.id], requiredMetadataFields: ['departmentId'] }
};

const baseContent = {
    scope: {
        tasks: ['Develop ML Pipeline', 'Validate Dataset'],
        deliverables: ['ML Model v1', 'Validation Report'],
        milestones: [
            { description: 'Data Ingestion', deadline: '2026-03-10T12:00:00Z' },
            { description: 'Model Training', deadline: '2026-03-15T18:00:00Z' }
        ],
        constraints: ['Max latency < 200ms']
    },
    resources: {
        budget: { amount: 1200, currency: 'USDT', limit: 1300 }
    },
    deadline: '2026-03-20T23:59:59Z',
    risks: { riskScore: 0.2, identifiedRisks: [] },
    impact: { predictedRoi: 1.8, estimatedCost: 900, netValue: 1300, synergyScore: 0.8 }
};

const offerMessage: AgentCoordinationMessage = {
    version: '1.0.0',
    messageId: 'msg-offer-001',
    correlationId: 'tx_550e8400',
    timestamp: new Date().toISOString(),
    type: MessageType.OFFER,
    sender: agentAlpha,
    recipient: agentBeta,
    content: baseContent,
    metadata: { departmentId: 'ai-research' }
};

const counterMessage: AgentCoordinationMessage = {
    ...offerMessage,
    messageId: 'msg-counter-002',
    type: MessageType.COUNTEROFFER
};

const acceptanceMessage: AgentCoordinationMessage = {
    ...offerMessage,
    messageId: 'msg-accept-003',
    type: MessageType.ACCEPTANCE
};

const commitmentMessage: AgentCoordinationMessage = {
    ...offerMessage,
    messageId: 'msg-commit-004',
    type: MessageType.COMMITMENT,
    metadata: {
        ...offerMessage.metadata,
        commitment: {
            isFormal: true,
            verificationToken: 'verify-001'
        }
    }
};

validator.evaluate(offerMessage, policy);
negotiationEngine.process(offerMessage);
validator.evaluate(counterMessage, policy);
negotiationEngine.process(counterMessage);
validator.evaluate(acceptanceMessage, policy);
negotiationEngine.process(acceptanceMessage);
validator.evaluate(commitmentMessage, policy);
negotiationEngine.process(commitmentMessage);

// 1. Initialize a contract draft, inheriting all prior negotiation/validation audit events.
const contractDraft = ContractFactory.createContract({
    contractId: 'cnt-99821-alpha-beta',
    correlationId: 'tx_550e8400',
    participatingAgents: [agentAlpha.id, agentBeta.id],
    scope: baseContent.scope,
    deliverables: [
        {
            name: 'ML Model v1',
            description: 'The trained model for sentiment analysis',
            metric: 'Accuracy',
            targetValue: 0.92,
            verificationMethod: 'Automated Test Suite'
        }
    ],
    deadlines: {
        overallCompletion: '2026-03-20T23:59:59Z',
        milestones: [
            { description: 'Beta Release', deadline: '2026-03-16T00:00:00Z' }
        ]
    },
    compensation: {
        budget: baseContent.resources.budget
    },
    penaltyClauses: [
        {
            violationType: 'DELAY',
            threshold: '24h',
            penaltyAmount: { amount: 100, currency: 'USDT' },
            escalationPath: 'Notify Governance Board'
        }
    ],
    rollbackConditions: [
        {
            trigger: 'ACCURACY_BELOW_THRESHOLD',
            scope: 'PARTIAL',
            procedure: 'Revert to last stable weights',
            retentionRequirements: 'Log all training parameters'
        }
    ],
    auditReferences: [
        {
            type: 'LOG_STREAM',
            uri: 's3://audit-logs/cnt-99821',
            checksum: 'sha256:abc123xyz',
            accessRequirements: ['admin', 'auditor']
        }
    ],
    immutableAuditLog: auditLog.toSnapshot()
});

console.log('--- Initial Contract Draft ---');
console.log(JSON.stringify(contractDraft, null, 2));

// 2. Agent Alpha signs
const alphaSigned = ContractFactory.signContract(contractDraft, agentAlpha, 'sig:alpha:valid');
console.log('\n--- After Agent Alpha Signs ---');
console.log(`Status: ${alphaSigned.status}`);
console.log(`Signatures: ${alphaSigned.signatures.length}`);

// 3. Agent Beta signs
const fullySigned = ContractFactory.signContract(alphaSigned, agentBeta, 'sig:beta:valid');
console.log('\n--- After Agent Beta Signs ---');
console.log(`Status: ${fullySigned.status}`);
console.log(`Signatures: ${fullySigned.signatures.length}`);

// 4. Commit the contract
const committedContract = ContractFactory.commit(fullySigned);
console.log('\n--- Committed Contract ---');
console.log(`Status: ${committedContract.status}`);
console.log(`Final ID: ${committedContract.contractId}`);

// 5. Record execution outcome
const completedContract = ContractFactory.complete(committedContract, 'agent:execution-runner', {
    success: true,
    summary: 'All deliverables met target accuracy and passed verification.',
    evidence: ['report://validation/2026-03-20', 'checksum:sha256:9f812ae']
});
console.log('\n--- Completed Contract ---');
console.log(`Status: ${completedContract.status}`);

// 6. Demonstrate Immutability
try {
    (completedContract as any).status = 'CANCELLED';
} catch (e: any) {
    console.log('\n--- Immutability Check ---');
    console.log(`Caught expected error: ${e.message}`);
}

// 7. Verify audit-chain integrity and print final trace stats
const integrity = ContractFactory.verifyAuditTrail(completedContract);
const auditTrail = ContractFactory.getAuditTrail(completedContract);
console.log('\n--- Immutable Audit Trail ---');
console.log(`Events: ${auditTrail.length}`);
console.log(`Head Hash: ${completedContract.immutableAuditLog.headHash}`);
console.log(`Integrity Valid: ${integrity.valid}`);

import {
    AgentCoordinationMessage,
    MessageType
} from '../schema/MessageSchema';
import {
    AuthorityProvider,
    BudgetProvider,
    IdentityVerifier,
    NegotiationEngine,
    ReputationProvider,
    TransitionPermission
} from '../engine/NegotiationEngine';

/**
 * Example usage: Creating a formal "OFFER" for a collaborative data analysis task.
 */
const collaborationOffer: AgentCoordinationMessage = {
    version: '1.0.0',
    messageId: 'msg_8842af11',
    correlationId: 'tx_550e8400', // Start of a new negotiation
    timestamp: new Date().toISOString(),
    type: MessageType.OFFER,

    sender: {
        id: 'agent:alpha-prime',
        publicKey: 'ed25519:6G7h8i9j...k1l2m3n4',
        algorithm: 'Ed25519'
    },

    recipient: {
        id: 'agent:beta-core',
        publicKey: 'ed25519:1A2b3c4d...e5f6g7h8',
        algorithm: 'Ed25519'
    },

    content: {
        scope: {
            tasks: ['Market Sentiment Analysis', 'Predictive Trend Mapping'],
            deliverables: ['JSON Report: Q1 Trends', 'Risk Heatmap'],
            milestones: [
                { description: 'Data Extraction', deadline: '2026-03-01T12:00:00Z' },
                { description: 'Final Report Delivery', deadline: '2026-03-05T18:00:00Z' }
            ],
            constraints: ['Data must be encrypted at rest', 'Access limited to verified sub-agents']
        },
        resources: {
            budget: {
                amount: 500.00,
                currency: 'USDT',
                limit: 550.00
            },
            compute: {
                type: 'A100 GPU Cluster',
                allocation: '4 Node-Hours'
            }
        },
        deadline: '2026-03-05T23:59:59Z',
        risks: {
            riskScore: 0.15,
            identifiedRisks: [
                {
                    type: 'API Rate Limiting',
                    probability: 0.3,
                    impact: 0.4,
                    mitigation: 'Implement exponential backoff and cache interim results.'
                }
            ]
        },
        impact: {
            predictedRoi: 2.5,
            estimatedCost: 450.00,
            netValue: 750.00,
            synergyScore: 0.85
        }
    },

    metadata: {
        priority: 'high',
        tags: ['market-analysis', 'urgent'],
        sourceEnvironment: 'Distributed-Hive-v2'
    }
};

const identityVerifier: IdentityVerifier = {
    verify(message: AgentCoordinationMessage): boolean {
        return Boolean(message.sender.signature ?? message.metadata?.verification?.identityVerified);
    }
};

const reputationProvider: ReputationProvider = {
    getScore(agentId: string): number {
        const reputationTable: Record<string, number> = {
            'agent:alpha-prime': 0.94,
            'agent:beta-core': 0.9
        };
        return reputationTable[agentId] ?? 0;
    }
};

const budgetProvider: BudgetProvider = {
    getAvailableBudget(agentId: string, currency: string): number {
        const budgetTable: Record<string, Record<string, number>> = {
            'agent:alpha-prime': { USDT: 1000 },
            'agent:beta-core': { USDT: 600 }
        };
        return budgetTable[agentId]?.[currency] ?? 0;
    }
};

const authorityProvider: AuthorityProvider = {
    hasPermission(agentId: string, permission: TransitionPermission): boolean {
        const authorityMap: Record<string, string[]> = {
            'agent:alpha-prime': [
                'NEGOTIATE_PROPOSAL',
                'NEGOTIATE_COUNTERPROPOSAL',
                'NEGOTIATE_TENTATIVE_AGREEMENT',
                'NEGOTIATE_FINAL_COMMITMENT'
            ],
            'agent:beta-core': [
                'NEGOTIATE_COUNTERPROPOSAL',
                'NEGOTIATE_TENTATIVE_AGREEMENT'
            ]
        };
        return authorityMap[agentId]?.includes(permission) ?? false;
    }
};

const engine = new NegotiationEngine({
    identityVerifier,
    reputationProvider,
    budgetProvider,
    authorityProvider,
    minimumReputationScore: 0.75
});

const proposal: AgentCoordinationMessage = {
    ...collaborationOffer,
    type: MessageType.OFFER,
    sender: {
        ...collaborationOffer.sender,
        signature: 'sig:proposal'
    }
};

const counterproposal: AgentCoordinationMessage = {
    ...collaborationOffer,
    messageId: 'msg_8842af12',
    type: MessageType.COUNTEROFFER,
    sender: {
        ...collaborationOffer.recipient,
        signature: 'sig:counter'
    },
    recipient: {
        ...collaborationOffer.sender
    }
};

const tentativeAgreement: AgentCoordinationMessage = {
    ...collaborationOffer,
    messageId: 'msg_8842af13',
    type: MessageType.ACCEPTANCE,
    sender: {
        ...collaborationOffer.sender,
        signature: 'sig:accept'
    }
};

const unverifiedCommitment: AgentCoordinationMessage = {
    ...collaborationOffer,
    messageId: 'msg_8842af14',
    type: MessageType.COMMITMENT,
    sender: {
        ...collaborationOffer.sender
    },
    metadata: {
        note: 'informal commitment'
    }
};

const verifiedFinalCommitment: AgentCoordinationMessage = {
    ...collaborationOffer,
    messageId: 'msg_8842af15',
    type: MessageType.COMMITMENT,
    sender: {
        ...collaborationOffer.sender,
        signature: 'sig:commitment'
    },
    metadata: {
        commitment: {
            isFormal: true,
            verificationToken: 'verify:txn:9382'
        }
    }
};

console.log('PROPOSAL =>', engine.process(proposal));
console.log('COUNTERPROPOSAL =>', engine.process(counterproposal));
console.log('TENTATIVE AGREEMENT =>', engine.process(tentativeAgreement));
console.log('UNVERIFIED FINAL COMMITMENT =>', engine.process(unverifiedCommitment));
console.log('VERIFIED FINAL COMMITMENT =>', engine.process(verifiedFinalCommitment));

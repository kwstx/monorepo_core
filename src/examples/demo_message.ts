import {
    AgentCoordinationMessage,
    MessageType
} from '../schema/MessageSchema';

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

console.log('--- Created Agent Coordination Message ---');
console.log(JSON.stringify(collaborationOffer, null, 2));

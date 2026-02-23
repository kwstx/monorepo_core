import {
    ConsensusScore,
    EconomicConstraints,
    GovernanceMetadata,
    ProposalStatus,
    ProposalType,
    SelfModificationProposal,
    SimulationResult
} from '../models/SelfModificationProposal';

export enum SubmissionFailureCode {
    INVALID_PROPOSAL = 'INVALID_PROPOSAL',
    INTEGRITY_CHECK_FAILED = 'INTEGRITY_CHECK_FAILED',
    UNKNOWN_AGENT_IDENTITY = 'UNKNOWN_AGENT_IDENTITY',
    INVALID_SIGNATURE = 'INVALID_SIGNATURE'
}

export class ProposalSubmissionError extends Error {
    readonly code: SubmissionFailureCode;

    constructor(code: SubmissionFailureCode, message: string) {
        super(message);
        this.name = 'ProposalSubmissionError';
        this.code = code;
    }
}

export interface SubmissionEnvelope {
    proposal: SelfModificationProposal;
    payloadDigest: string;
    signature: string;
}

export interface AgentIdentityRegistry {
    resolvePublicKey(agentIdentity: string): string | null;
}

export interface DigestProvider {
    computeDigest(payload: string): string;
}

export interface SignatureVerifier {
    verify(input: { payload: string; signature: string; publicKey: string }): boolean;
}

export interface ProposalQueueEntry {
    queueId: string;
    proposalId: string;
    agentIdentity: string;
    queuedAt: Date;
    payloadDigest: string;
    proposalSnapshot: Readonly<ProposalSnapshot>;
}

export type ProposalSnapshot = {
    id: string;
    type: ProposalType;
    status: ProposalStatus;
    proposedChange: string;
    targetModule: string;
    targetParameter: string | null;
    expectedImpact: string;
    predictedRisk: number;
    agentIdentity: string;
    timestamp: string;
    simulationResults: SimulationResult | null;
    economicConstraints: EconomicConstraints;
    governanceMetadata: GovernanceMetadata;
    consensusScores: ConsensusScore | null;
};

export class ProposalSubmissionEngine {
    private readonly queue: ProposalQueueEntry[] = [];
    private nextQueueSequence = 1;

    constructor(
        private readonly identities: AgentIdentityRegistry,
        private readonly digestProvider: DigestProvider,
        private readonly signatureVerifier: SignatureVerifier
    ) { }

    submit(envelope: SubmissionEnvelope): ProposalQueueEntry {
        const proposal = envelope.proposal;
        this.validateProposal(proposal);

        const canonicalPayload = this.serializeProposal(proposal);
        const computedDigest = this.digestProvider.computeDigest(canonicalPayload);

        if (computedDigest !== envelope.payloadDigest) {
            throw new ProposalSubmissionError(
                SubmissionFailureCode.INTEGRITY_CHECK_FAILED,
                `Proposal ${proposal.id} failed integrity validation.`
            );
        }

        const publicKey = this.identities.resolvePublicKey(proposal.agentIdentity);
        if (!publicKey) {
            throw new ProposalSubmissionError(
                SubmissionFailureCode.UNKNOWN_AGENT_IDENTITY,
                `No cryptographic identity found for agent ${proposal.agentIdentity}.`
            );
        }

        const validSignature = this.signatureVerifier.verify({
            payload: canonicalPayload,
            signature: envelope.signature,
            publicKey
        });

        if (!validSignature) {
            throw new ProposalSubmissionError(
                SubmissionFailureCode.INVALID_SIGNATURE,
                `Proposal ${proposal.id} has an invalid agent signature.`
            );
        }

        const queueEntry: ProposalQueueEntry = {
            queueId: this.buildQueueId(proposal.id),
            proposalId: proposal.id,
            agentIdentity: proposal.agentIdentity,
            queuedAt: new Date(),
            payloadDigest: envelope.payloadDigest,
            proposalSnapshot: this.createImmutableSnapshot(proposal)
        };

        this.queue.push(queueEntry);

        return queueEntry;
    }

    getQueueSnapshot(): readonly ProposalQueueEntry[] {
        return this.queue.map((entry) => ({
            ...entry,
            queuedAt: new Date(entry.queuedAt.getTime())
        }));
    }

    dequeueForEvaluation(): ProposalQueueEntry | null {
        const next = this.queue.shift();
        return next ?? null;
    }

    private buildQueueId(proposalId: string): string {
        const sequence = this.nextQueueSequence;
        this.nextQueueSequence += 1;
        return `queue-${proposalId}-${sequence}`;
    }

    private validateProposal(proposal: SelfModificationProposal): void {
        if (!proposal.id.trim()) {
            throw new ProposalSubmissionError(
                SubmissionFailureCode.INVALID_PROPOSAL,
                'Proposal id is required.'
            );
        }

        if (!proposal.agentIdentity.trim()) {
            throw new ProposalSubmissionError(
                SubmissionFailureCode.INVALID_PROPOSAL,
                'Agent identity is required.'
            );
        }

        if (proposal.predictedRisk < 0 || proposal.predictedRisk > 1) {
            throw new ProposalSubmissionError(
                SubmissionFailureCode.INVALID_PROPOSAL,
                'Predicted risk must be between 0.0 and 1.0.'
            );
        }

        if (proposal.economicConstraints.estimatedCost > proposal.economicConstraints.budgetLimit) {
            throw new ProposalSubmissionError(
                SubmissionFailureCode.INVALID_PROPOSAL,
                'Estimated cost exceeds proposal budget limit.'
            );
        }
    }

    private createImmutableSnapshot(proposal: SelfModificationProposal): Readonly<ProposalSnapshot> {
        const snapshot: ProposalSnapshot = {
            id: proposal.id,
            type: proposal.type,
            status: proposal.status,
            proposedChange: proposal.proposedChange,
            targetModule: proposal.targetModule,
            targetParameter: proposal.targetParameter ?? null,
            expectedImpact: proposal.expectedImpact,
            predictedRisk: proposal.predictedRisk,
            agentIdentity: proposal.agentIdentity,
            timestamp: proposal.timestamp.toISOString(),
            simulationResults: proposal.simulationResults
                ? {
                    ...proposal.simulationResults,
                    metrics: { ...proposal.simulationResults.metrics },
                    logs: [...proposal.simulationResults.logs]
                }
                : null,
            economicConstraints: { ...proposal.economicConstraints },
            governanceMetadata: {
                ...proposal.governanceMetadata,
                complianceProtocols: [...proposal.governanceMetadata.complianceProtocols]
            },
            consensusScores: proposal.consensusScores ? { ...proposal.consensusScores } : null
        };

        return deepFreeze(snapshot);
    }

    private serializeProposal(proposal: SelfModificationProposal): string {
        return JSON.stringify({
            id: proposal.id,
            type: proposal.type,
            status: proposal.status,
            proposedChange: proposal.proposedChange,
            targetModule: proposal.targetModule,
            targetParameter: proposal.targetParameter ?? null,
            expectedImpact: proposal.expectedImpact,
            predictedRisk: proposal.predictedRisk,
            agentIdentity: proposal.agentIdentity,
            timestamp: proposal.timestamp.toISOString(),
            simulationResults: proposal.simulationResults
                ? {
                    success: proposal.simulationResults.success,
                    performanceDelta: proposal.simulationResults.performanceDelta,
                    resourceUsageDelta: proposal.simulationResults.resourceUsageDelta,
                    stabilityScore: proposal.simulationResults.stabilityScore,
                    metrics: { ...proposal.simulationResults.metrics },
                    logs: [...proposal.simulationResults.logs]
                }
                : null,
            economicConstraints: {
                budgetLimit: proposal.economicConstraints.budgetLimit,
                estimatedCost: proposal.economicConstraints.estimatedCost,
                requiredMinROI: proposal.economicConstraints.requiredMinROI,
                projectedROI: proposal.economicConstraints.projectedROI
            },
            governanceMetadata: {
                complianceProtocols: [...proposal.governanceMetadata.complianceProtocols],
                strategicAlignmentScore: proposal.governanceMetadata.strategicAlignmentScore
            },
            consensusScores: proposal.consensusScores
                ? {
                    totalAgents: proposal.consensusScores.totalAgents,
                    approvals: proposal.consensusScores.approvals,
                    abstentions: proposal.consensusScores.abstentions,
                    disapprovals: proposal.consensusScores.disapprovals,
                    consensusReached: proposal.consensusScores.consensusReached
                }
                : null
        });
    }
}

function deepFreeze<T>(value: T): Readonly<T> {
    if (value && typeof value === 'object') {
        Object.freeze(value);

        for (const nestedValue of Object.values(value as Record<string, unknown>)) {
            if (nestedValue && typeof nestedValue === 'object' && !Object.isFrozen(nestedValue)) {
                deepFreeze(nestedValue);
            }
        }
    }

    return value;
}

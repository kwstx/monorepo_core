import { createHash, createSign, createVerify, generateKeyPairSync, KeyObject } from 'crypto';
import {
    ConsensusScore,
    ImpactAssessment,
    SelfModificationProposal,
    SimulationResult
} from '../models/SelfModificationProposal';

export interface PreExecutionMetrics {
    baselinePerformance: number;
    baselineResourceUsage: number;
    baselineStability: number;
    observedAt: Date;
}

export interface EconomicImpactRecord {
    approvedBudget: number;
    predictedEconomicCost: number;
    projectedROI: number;
    expectedPaybackCycles: number;
}

export type SandboxOutcomeRecord = Pick<
    SimulationResult,
    'success' | 'performanceDelta' | 'resourceUsageDelta' | 'stabilityScore' | 'metrics'
> & {
    evaluatedAt: Date;
};

export interface ConsensusOutcomeRecord extends Pick<
    ConsensusScore,
    'totalAgents' | 'approvals' | 'disapprovals' | 'abstentions' | 'weightedConsensusScore' | 'consensusReached'
> {
    decidedAt: Date;
}

export interface VersionRecordPayload {
    versionId: string;
    proposalId: string;
    createdAt: string;
    createdBy: string;
    approvalReference: string;
    proposalSnapshot: ProposalVersionSnapshot;
    preExecutionMetrics: FrozenPreExecutionMetrics;
    sandboxOutcome: FrozenSandboxOutcomeRecord;
    consensusResult: FrozenConsensusOutcomeRecord;
    economicImpact: FrozenEconomicImpactRecord;
    previousVersionHash: string | null;
    rollbackOfVersionId: string | null;
    rollbackReason: string | null;
}

export interface VersionRecord {
    readonly versionId: string;
    readonly proposalId: string;
    readonly createdAt: Date;
    readonly createdBy: string;
    readonly approvalReference: string;
    readonly proposalSnapshot: Readonly<ProposalVersionSnapshot>;
    readonly preExecutionMetrics: Readonly<FrozenPreExecutionMetrics>;
    readonly sandboxOutcome: Readonly<FrozenSandboxOutcomeRecord>;
    readonly consensusResult: Readonly<FrozenConsensusOutcomeRecord>;
    readonly economicImpact: Readonly<FrozenEconomicImpactRecord>;
    readonly previousVersionHash: string | null;
    readonly rollbackOfVersionId: string | null;
    readonly rollbackReason: string | null;
    readonly payloadHash: string;
    readonly signature: string;
    readonly signatureAlgorithm: string;
    readonly signerId: string;
}

export interface RecordApprovedVersionInput {
    proposal: SelfModificationProposal;
    createdBy: string;
    approvalReference: string;
    preExecutionMetrics: PreExecutionMetrics;
    sandboxOutcome: SandboxOutcomeRecord;
    consensusResult: ConsensusOutcomeRecord;
    economicImpact: EconomicImpactRecord;
}

export interface RollbackInput {
    proposalId: string;
    targetVersionId: string;
    initiatedBy: string;
    reason: string;
    approvalReference: string;
}

export interface VersionQuery {
    proposalId?: string;
    createdBy?: string;
    from?: Date;
    to?: Date;
    rollbackOnly?: boolean;
}

export interface RollbackPlan {
    readonly sourceVersionId: string;
    readonly targetVersion: VersionRecord;
    readonly rollbackRecord: VersionRecord;
}

export interface SignatureProvider {
    readonly signerId: string;
    readonly algorithm: string;
    sign(payload: string): string;
    verify(payload: string, signature: string): boolean;
}

type FrozenPreExecutionMetrics = {
    baselinePerformance: number;
    baselineResourceUsage: number;
    baselineStability: number;
    observedAt: string;
};

type FrozenEconomicImpactRecord = {
    approvedBudget: number;
    predictedEconomicCost: number;
    projectedROI: number;
    expectedPaybackCycles: number;
};

type FrozenSandboxOutcomeRecord = {
    success: boolean;
    performanceDelta: number;
    resourceUsageDelta: number;
    stabilityScore: number;
    metrics: {
        downstreamEffects: number;
        cooperationImpact: number;
        vocationalOutcome: number;
    };
    evaluatedAt: string;
};

type FrozenConsensusOutcomeRecord = {
    totalAgents: number;
    approvals: number;
    disapprovals: number;
    abstentions: number;
    weightedConsensusScore: number;
    consensusReached: boolean;
    decidedAt: string;
};

export type ProposalVersionSnapshot = {
    id: string;
    type: string;
    status: string;
    proposedChange: string;
    targetModule: string;
    targetParameter: string | null;
    expectedImpact: string;
    predictedRisk: number;
    agentIdentity: string;
    timestamp: string;
    impactAssessment: {
        predictedEconomicCost: number;
        projectedROI: number;
        riskScore: number;
        recommendation: string;
        timestamp: string;
    } | null;
};

interface InternalRecord {
    readonly record: VersionRecord;
    readonly canonicalPayload: string;
}

export class VersionControlEngine {
    private readonly byVersionId = new Map<string, InternalRecord>();
    private readonly byProposalId = new Map<string, InternalRecord[]>();
    private sequence = 1;

    constructor(private readonly signatureProvider: SignatureProvider) { }

    recordApprovedModification(input: RecordApprovedVersionInput): VersionRecord {
        if (!input.proposal.consensusScores?.consensusReached) {
            throw new Error(`Proposal ${input.proposal.id} cannot be versioned without consensus approval.`);
        }

        const versionId = this.buildVersionId(input.proposal.id);
        const previousVersionHash = this.getLatestPayloadHash(input.proposal.id);
        const payload = this.buildPayload({
            versionId,
            proposalId: input.proposal.id,
            createdAt: new Date().toISOString(),
            createdBy: input.createdBy,
            approvalReference: input.approvalReference,
            proposalSnapshot: this.snapshotProposal(input.proposal),
            preExecutionMetrics: this.freezePreExecutionMetrics(input.preExecutionMetrics),
            sandboxOutcome: this.freezeSandboxOutcome(input.sandboxOutcome),
            consensusResult: this.freezeConsensus(input.consensusResult),
            economicImpact: this.freezeEconomicImpact(input.economicImpact),
            previousVersionHash,
            rollbackOfVersionId: null,
            rollbackReason: null
        });

        return this.persistSignedRecord(payload);
    }

    rollbackToVersion(input: RollbackInput): RollbackPlan {
        const target = this.byVersionId.get(input.targetVersionId);
        if (!target) {
            throw new Error(`Unknown target version: ${input.targetVersionId}`);
        }

        if (target.record.proposalId !== input.proposalId) {
            throw new Error(
                `Version ${input.targetVersionId} belongs to ${target.record.proposalId}, not ${input.proposalId}.`
            );
        }

        const sourceVersion = this.findLatestForProposal(input.proposalId);
        const sourceHash = sourceVersion?.record.payloadHash ?? null;
        if (!sourceHash) {
            throw new Error(`No version history exists for proposal ${input.proposalId}.`);
        }

        const rollbackPayload = this.buildPayload({
            versionId: this.buildVersionId(input.proposalId),
            proposalId: input.proposalId,
            createdAt: new Date().toISOString(),
            createdBy: input.initiatedBy,
            approvalReference: input.approvalReference,
            proposalSnapshot: target.record.proposalSnapshot,
            preExecutionMetrics: target.record.preExecutionMetrics,
            sandboxOutcome: target.record.sandboxOutcome,
            consensusResult: target.record.consensusResult,
            economicImpact: target.record.economicImpact,
            previousVersionHash: sourceHash,
            rollbackOfVersionId: input.targetVersionId,
            rollbackReason: input.reason
        });

        const rollbackRecord = this.persistSignedRecord(rollbackPayload);

        return {
            sourceVersionId: sourceVersion!.record.versionId,
            targetVersion: this.cloneRecord(target.record),
            rollbackRecord
        };
    }

    queryVersions(query: VersionQuery = {}): readonly VersionRecord[] {
        const records = Array.from(this.byVersionId.values()).map((entry) => entry.record);
        return records
            .filter((record) => this.matchesQuery(record, query))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((record) => this.cloneRecord(record));
    }

    getVersion(versionId: string): VersionRecord | null {
        const stored = this.byVersionId.get(versionId);
        return stored ? this.cloneRecord(stored.record) : null;
    }

    verifyVersionIntegrity(versionId: string): boolean {
        const stored = this.byVersionId.get(versionId);
        if (!stored) {
            return false;
        }

        const payloadHash = hashString(stored.canonicalPayload);
        if (payloadHash !== stored.record.payloadHash) {
            return false;
        }

        return this.signatureProvider.verify(stored.canonicalPayload, stored.record.signature);
    }

    verifyLedgerIntegrity(): { valid: boolean; invalidVersionIds: string[] } {
        const invalid: string[] = [];

        for (const [versionId, stored] of this.byVersionId.entries()) {
            const expectedHash = hashString(stored.canonicalPayload);
            const signatureValid = this.signatureProvider.verify(stored.canonicalPayload, stored.record.signature);
            if (expectedHash !== stored.record.payloadHash || !signatureValid) {
                invalid.push(versionId);
            }
        }

        return {
            valid: invalid.length === 0,
            invalidVersionIds: invalid
        };
    }

    private persistSignedRecord(payload: VersionRecordPayload): VersionRecord {
        const canonicalPayload = canonicalize(payload);
        const payloadHash = hashString(canonicalPayload);
        const signature = this.signatureProvider.sign(canonicalPayload);
        const immutable = deepFreeze<VersionRecord>({
            versionId: payload.versionId,
            proposalId: payload.proposalId,
            createdAt: new Date(payload.createdAt),
            createdBy: payload.createdBy,
            approvalReference: payload.approvalReference,
            proposalSnapshot: payload.proposalSnapshot,
            preExecutionMetrics: payload.preExecutionMetrics,
            sandboxOutcome: payload.sandboxOutcome,
            consensusResult: payload.consensusResult,
            economicImpact: payload.economicImpact,
            previousVersionHash: payload.previousVersionHash,
            rollbackOfVersionId: payload.rollbackOfVersionId,
            rollbackReason: payload.rollbackReason,
            payloadHash,
            signature,
            signatureAlgorithm: this.signatureProvider.algorithm,
            signerId: this.signatureProvider.signerId
        });

        const internal: InternalRecord = {
            record: immutable,
            canonicalPayload
        };

        this.byVersionId.set(immutable.versionId, internal);
        const existing = this.byProposalId.get(immutable.proposalId) ?? [];
        existing.push(internal);
        this.byProposalId.set(immutable.proposalId, existing);

        return this.cloneRecord(immutable);
    }

    private buildVersionId(proposalId: string): string {
        const current = this.sequence;
        this.sequence += 1;
        return `ver-${proposalId}-${current}`;
    }

    private buildPayload(payload: VersionRecordPayload): VersionRecordPayload {
        return deepFreeze(payload);
    }

    private getLatestPayloadHash(proposalId: string): string | null {
        const latest = this.findLatestForProposal(proposalId);
        return latest ? latest.record.payloadHash : null;
    }

    private findLatestForProposal(proposalId: string): InternalRecord | null {
        const entries = this.byProposalId.get(proposalId);
        if (!entries || entries.length === 0) {
            return null;
        }

        return entries[entries.length - 1];
    }

    private matchesQuery(record: VersionRecord, query: VersionQuery): boolean {
        if (query.proposalId && record.proposalId !== query.proposalId) {
            return false;
        }

        if (query.createdBy && record.createdBy !== query.createdBy) {
            return false;
        }

        if (query.from && record.createdAt < query.from) {
            return false;
        }

        if (query.to && record.createdAt > query.to) {
            return false;
        }

        if (query.rollbackOnly && !record.rollbackOfVersionId) {
            return false;
        }

        return true;
    }

    private snapshotProposal(proposal: SelfModificationProposal): ProposalVersionSnapshot {
        const assessment: ImpactAssessment | undefined = proposal.impactAssessment;
        return deepFreeze({
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
            impactAssessment: assessment
                ? {
                    predictedEconomicCost: assessment.predictedEconomicCost,
                    projectedROI: assessment.projectedROI,
                    riskScore: assessment.riskScore,
                    recommendation: assessment.recommendation,
                    timestamp: assessment.timestamp.toISOString()
                }
                : null
        });
    }

    private freezePreExecutionMetrics(input: PreExecutionMetrics): FrozenPreExecutionMetrics {
        return deepFreeze({
            baselinePerformance: input.baselinePerformance,
            baselineResourceUsage: input.baselineResourceUsage,
            baselineStability: input.baselineStability,
            observedAt: input.observedAt.toISOString()
        });
    }

    private freezeEconomicImpact(input: EconomicImpactRecord): FrozenEconomicImpactRecord {
        return deepFreeze({
            approvedBudget: input.approvedBudget,
            predictedEconomicCost: input.predictedEconomicCost,
            projectedROI: input.projectedROI,
            expectedPaybackCycles: input.expectedPaybackCycles
        });
    }

    private freezeSandboxOutcome(input: SandboxOutcomeRecord): FrozenSandboxOutcomeRecord {
        return deepFreeze({
            success: input.success,
            performanceDelta: input.performanceDelta,
            resourceUsageDelta: input.resourceUsageDelta,
            stabilityScore: input.stabilityScore,
            metrics: {
                downstreamEffects: input.metrics.downstreamEffects,
                cooperationImpact: input.metrics.cooperationImpact,
                vocationalOutcome: input.metrics.vocationalOutcome
            },
            evaluatedAt: input.evaluatedAt.toISOString()
        });
    }

    private freezeConsensus(input: ConsensusOutcomeRecord): FrozenConsensusOutcomeRecord {
        return deepFreeze({
            totalAgents: input.totalAgents,
            approvals: input.approvals,
            disapprovals: input.disapprovals,
            abstentions: input.abstentions,
            weightedConsensusScore: input.weightedConsensusScore,
            consensusReached: input.consensusReached,
            decidedAt: input.decidedAt.toISOString()
        });
    }

    private cloneRecord(record: VersionRecord): VersionRecord {
        return deepFreeze({
            ...record,
            createdAt: new Date(record.createdAt.getTime())
        });
    }
}

export class RsaSignatureProvider implements SignatureProvider {
    readonly algorithm = 'RSA-SHA256';

    constructor(
        readonly signerId: string,
        private readonly privateKey: KeyObject,
        private readonly publicKey: KeyObject
    ) { }

    static generate(signerId: string): RsaSignatureProvider {
        const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
        return new RsaSignatureProvider(signerId, keys.privateKey, keys.publicKey);
    }

    sign(payload: string): string {
        const signer = createSign('RSA-SHA256');
        signer.update(payload);
        signer.end();
        return signer.sign(this.privateKey, 'base64');
    }

    verify(payload: string, signature: string): boolean {
        const verifier = createVerify('RSA-SHA256');
        verifier.update(payload);
        verifier.end();
        return verifier.verify(this.publicKey, signature, 'base64');
    }
}

function canonicalize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalize(item)).join(',')}]`;
    }

    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(objectValue[key])}`).join(',')}}`;
}

function hashString(value: string): string {
    return createHash('sha256').update(value).digest('hex');
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

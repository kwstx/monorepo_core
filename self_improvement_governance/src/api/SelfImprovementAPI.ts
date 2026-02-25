import { ComputeAllocationPlan } from '../engines/ProposalPrioritizationEngine';
import {
    ProposalQueueEntry,
    SubmissionEnvelope
} from '../engines/ProposalSubmissionEngine';
import {
    RollbackInput,
    RollbackPlan,
    VersionQuery,
    VersionRecord
} from '../engines/VersionControlEngine';
import {
    ImpactAssessment,
    SelfModificationProposal,
    SimulationResult
} from '../models/SelfModificationProposal';

export type EndpointName =
    | 'submitProposal'
    | 'evaluateProposal'
    | 'getVersionHistory'
    | 'rollbackVersion'
    | 'simulateImpact';

export type OrchestrationContext = Record<string, unknown>;

export interface OrchestrationBridge {
    beforeCall?(
        endpoint: EndpointName,
        payload: unknown,
        context?: OrchestrationContext
    ): Promise<void> | void;
    afterCall?(
        endpoint: EndpointName,
        payload: unknown,
        response: unknown,
        context?: OrchestrationContext
    ): Promise<void> | void;
    onError?(
        endpoint: EndpointName,
        payload: unknown,
        error: unknown,
        context?: OrchestrationContext
    ): Promise<void> | void;
}

export interface SubmissionPort {
    submit(envelope: SubmissionEnvelope): ProposalQueueEntry;
}

export interface EvaluationPort {
    evaluate(
        proposal: SelfModificationProposal,
        allocationPlan?: ComputeAllocationPlan
    ): Promise<SimulationResult>;
}

export interface VersionHistoryPort {
    queryVersions(query?: VersionQuery): readonly VersionRecord[];
}

export interface RollbackPort {
    rollbackToVersion(input: RollbackInput): RollbackPlan;
}

export interface ImpactSimulationPort {
    assess(proposal: SelfModificationProposal): ImpactAssessment;
}

export interface SelfImprovementAPIPorts {
    submission: SubmissionPort;
    evaluation: EvaluationPort;
    versionHistory: VersionHistoryPort;
    rollback: RollbackPort;
    impactSimulation: ImpactSimulationPort;
}

export interface SubmitProposalRequest {
    envelope: SubmissionEnvelope;
    context?: OrchestrationContext;
}

export interface EvaluateProposalRequest {
    proposal: SelfModificationProposal;
    allocationPlan?: ComputeAllocationPlan;
    context?: OrchestrationContext;
}

export interface GetVersionHistoryRequest {
    query?: VersionQuery;
    context?: OrchestrationContext;
}

export interface RollbackVersionRequest {
    input: RollbackInput;
    context?: OrchestrationContext;
}

export interface SimulateImpactRequest {
    proposal: SelfModificationProposal;
    context?: OrchestrationContext;
}

export class SelfImprovementAPI {
    constructor(
        private readonly ports: SelfImprovementAPIPorts,
        private readonly orchestrationBridge?: OrchestrationBridge
    ) { }

    async submitProposal(request: SubmitProposalRequest): Promise<ProposalQueueEntry> {
        return this.invoke('submitProposal', request, () =>
            this.ports.submission.submit(request.envelope)
        );
    }

    async evaluateProposal(request: EvaluateProposalRequest): Promise<SimulationResult> {
        return this.invoke('evaluateProposal', request, () =>
            this.ports.evaluation.evaluate(request.proposal, request.allocationPlan)
        );
    }

    async getVersionHistory(request: GetVersionHistoryRequest = {}): Promise<readonly VersionRecord[]> {
        return this.invoke('getVersionHistory', request, () =>
            this.ports.versionHistory.queryVersions(request.query)
        );
    }

    async rollbackVersion(request: RollbackVersionRequest): Promise<RollbackPlan> {
        return this.invoke('rollbackVersion', request, () =>
            this.ports.rollback.rollbackToVersion(request.input)
        );
    }

    async simulateImpact(request: SimulateImpactRequest): Promise<ImpactAssessment> {
        return this.invoke('simulateImpact', request, () => {
            const assessment = this.ports.impactSimulation.assess(request.proposal);
            request.proposal.updateImpactAssessment(assessment);
            return assessment;
        });
    }

    private async invoke<T>(
        endpoint: EndpointName,
        payload: unknown,
        handler: () => Promise<T> | T
    ): Promise<T> {
        try {
            await this.orchestrationBridge?.beforeCall?.(endpoint, payload, this.extractContext(payload));
            const response = await handler();
            await this.orchestrationBridge?.afterCall?.(
                endpoint,
                payload,
                response,
                this.extractContext(payload)
            );
            return response;
        } catch (error) {
            await this.orchestrationBridge?.onError?.(
                endpoint,
                payload,
                error,
                this.extractContext(payload)
            );
            throw error;
        }
    }

    private extractContext(payload: unknown): OrchestrationContext | undefined {
        if (!payload || typeof payload !== 'object') {
            return undefined;
        }

        const candidate = (payload as { context?: OrchestrationContext }).context;
        return candidate;
    }
}

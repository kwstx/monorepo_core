import { ConsensusEngine, VotingAgent } from './ConsensusEngine';
import { ImpactAssessmentEngine } from './ImpactAssessmentEngine';
import { PolicyValidationLayer } from './PolicyValidationLayer';
import { ProposalPrioritizationEngine } from './ProposalPrioritizationEngine';
import { RollbackEngine, RollbackOutcome } from './RollbackEngine';
import { SandboxEvaluationEngine } from './SandboxEvaluationEngine';
import {
    ConsensusOutcomeRecord,
    EconomicImpactRecord,
    PreExecutionMetrics,
    VersionControlEngine,
    VersionRecord
} from './VersionControlEngine';
import { ProposalStatus, SelfModificationProposal } from '../models/SelfModificationProposal';
import {
    assertUniqueCapabilityCombination,
    createDefensibilityProfile,
    DefensibilityProfile,
    UniqueCapability
} from './UniqueCapabilityProfile';

export interface AutonomousGovernanceDependencies {
    impactAssessmentEngine: ImpactAssessmentEngine;
    policyValidationLayer: PolicyValidationLayer;
    proposalPrioritizationEngine: ProposalPrioritizationEngine;
    sandboxEvaluationEngine: SandboxEvaluationEngine;
    consensusEngine: ConsensusEngine;
    versionControlEngine: VersionControlEngine;
    rollbackEngine: RollbackEngine;
}

export interface GovernanceApprovalInput {
    proposal: SelfModificationProposal;
    votingAgents: VotingAgent[];
    approvedBy: string;
    approvalReference: string;
    preExecutionMetrics: PreExecutionMetrics;
    expectedPaybackCycles: number;
}

export interface GovernanceApprovalDecision {
    approved: boolean;
    reasons: string[];
    versionRecord?: VersionRecord;
}

export interface PostExecutionObservation {
    proposal: SelfModificationProposal;
    riskScore: number;
    roi: number;
    cooperativeImpact: number;
    observedAt?: Date;
}

export interface AutonomousGovernanceResult {
    decision: GovernanceApprovalDecision;
    rollbackOutcome?: RollbackOutcome;
}

/**
 * Orchestrates the complete governance chain for self-modifying autonomous agents.
 * Every approval must pass all required stages to preserve the defensible product moat.
 */
export class AutonomousGovernanceModule {
    private readonly activeCapabilities: readonly UniqueCapability[] = [
        'SANDBOXED_PREDICTIVE_SIMULATION',
        'POLICY_AS_CODE_GOVERNANCE',
        'ECONOMIC_AND_RISK_AWARE_APPROVAL',
        'MULTI_AGENT_WEIGHTED_CONSENSUS',
        'CRYPTOGRAPHIC_VERSIONING',
        'AUTOMATED_SAFE_ROLLBACK'
    ];

    constructor(private readonly dependencies: AutonomousGovernanceDependencies) { }

    getDefensibilityProfile(): DefensibilityProfile {
        return createDefensibilityProfile();
    }

    getCapabilityStatus(): { unique: boolean; missing: UniqueCapability[] } {
        return assertUniqueCapabilityCombination(this.activeCapabilities);
    }

    async runApprovalFlow(input: GovernanceApprovalInput): Promise<GovernanceApprovalDecision> {
        const reasons: string[] = [];
        const proposal = input.proposal;

        const assessment = this.dependencies.impactAssessmentEngine.assess(proposal);
        proposal.updateImpactAssessment(assessment);

        const policyCheck = this.dependencies.policyValidationLayer.validate(proposal);
        if (!policyCheck.passed) {
            proposal.status = ProposalStatus.REJECTED;
            reasons.push(...policyCheck.violations.map((violation) => violation.message));
            return { approved: false, reasons };
        }

        const prioritization = this.dependencies.proposalPrioritizationEngine.rank(proposal);
        const simulation = await this.dependencies.sandboxEvaluationEngine.evaluate(
            proposal,
            prioritization.computeAllocationPlan
        );

        if (!simulation.success) {
            proposal.status = ProposalStatus.REJECTED;
            reasons.push('Sandbox simulation failed acceptance criteria.');
            return { approved: false, reasons };
        }

        const consensus = await this.dependencies.consensusEngine.collectConsensus(
            proposal,
            input.votingAgents
        );
        if (!consensus.consensusReached) {
            proposal.status = ProposalStatus.REJECTED;
            reasons.push('Weighted multi-agent consensus threshold was not met.');
            return { approved: false, reasons };
        }

        proposal.status = ProposalStatus.EXECUTED;
        const versionRecord = this.dependencies.versionControlEngine.recordApprovedModification({
            proposal,
            createdBy: input.approvedBy,
            approvalReference: input.approvalReference,
            preExecutionMetrics: input.preExecutionMetrics,
            sandboxOutcome: {
                ...simulation,
                evaluatedAt: new Date()
            },
            consensusResult: this.toConsensusOutcomeRecord(consensus),
            economicImpact: this.toEconomicImpactRecord(proposal, input.expectedPaybackCycles)
        });

        reasons.push('Proposal approved with full governance chain and immutable version record.');
        return {
            approved: true,
            reasons,
            versionRecord
        };
    }

    async evaluatePostExecution(
        observation: PostExecutionObservation
    ): Promise<RollbackOutcome> {
        return this.dependencies.rollbackEngine.evaluate(observation.proposal, {
            riskScore: observation.riskScore,
            roi: observation.roi,
            cooperativeImpact: observation.cooperativeImpact,
            evaluatedAt: observation.observedAt ?? new Date()
        });
    }

    async runApprovalAndMonitoring(
        input: GovernanceApprovalInput,
        observation?: Omit<PostExecutionObservation, 'proposal'>
    ): Promise<AutonomousGovernanceResult> {
        const decision = await this.runApprovalFlow(input);
        if (!decision.approved || !observation) {
            return { decision };
        }

        const rollbackOutcome = await this.evaluatePostExecution({
            proposal: input.proposal,
            ...observation
        });

        return { decision, rollbackOutcome };
    }

    private toConsensusOutcomeRecord(
        score: SelfModificationProposal['consensusScores']
    ): ConsensusOutcomeRecord {
        if (!score) {
            throw new Error('Consensus score is required for version recording.');
        }

        return {
            totalAgents: score.totalAgents,
            approvals: score.approvals,
            disapprovals: score.disapprovals,
            abstentions: score.abstentions,
            weightedConsensusScore: score.weightedConsensusScore,
            consensusReached: score.consensusReached,
            decidedAt: new Date()
        };
    }

    private toEconomicImpactRecord(
        proposal: SelfModificationProposal,
        expectedPaybackCycles: number
    ): EconomicImpactRecord {
        return {
            approvedBudget: proposal.economicConstraints.budgetLimit,
            predictedEconomicCost:
                proposal.impactAssessment?.predictedEconomicCost ??
                proposal.economicConstraints.estimatedCost,
            projectedROI:
                proposal.impactAssessment?.projectedROI ??
                proposal.economicConstraints.projectedROI,
            expectedPaybackCycles
        };
    }
}

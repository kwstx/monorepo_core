import { ProposalStatus, SelfModificationProposal } from '../models/SelfModificationProposal';
import { SelfImprovementFeedbackLoop } from './SelfImprovementFeedbackLoop';
import { RollbackPlan, VersionControlEngine } from './VersionControlEngine';

/**
 * PostExecutionMetrics
 * 
 * Represents the real-world performance data captured after a self-modification has been executed.
 */
export interface PostExecutionMetrics {
    riskScore: number;         // 0.0 to 1.0 (Realized risk, higher is worse)
    roi: number;               // Realized Return on Investment (Higher is better)
    cooperativeImpact: number; // -1.0 to 1.0 (Agent cooperation synergy, higher is better)
    evaluatedAt: Date;
}

/**
 * RollbackThresholds
 * 
 * Defines the safety boundaries for self-modifications. 
 * If metrics cross these thresholds, an automated rollback is triggered.
 */
export interface RollbackThresholds {
    maxRiskScore: number;
    minROI: number;
    minCooperativeImpact: number;
}

/**
 * RollbackOutcome
 * 
 * Record of an evaluation and any subsequent rollback action.
 */
export interface RollbackOutcome {
    proposalId: string;
    rollbackInitiated: boolean;
    reason?: string;
    metrics: PostExecutionMetrics;
    thresholds: RollbackThresholds;
    timestamp: Date;
    rollbackPlan?: RollbackPlan;
}

/**
 * RollbackEngine
 * 
 * Automatically monitors the performance of executed self-modifications.
 * If performance drops below defined safety thresholds (risk, ROI, cooperation),
 * it triggers a safe rollback via the VersionControlEngine while ensuring
 * system integrity and logging outcomes for future policy refinement.
 */
export class RollbackEngine {
    private readonly outcomes: RollbackOutcome[] = [];

    constructor(
        private readonly versionControl: VersionControlEngine,
        private readonly thresholds: RollbackThresholds = {
            maxRiskScore: 0.75,
            minROI: 0.05,
            minCooperativeImpact: -0.1
        },
        private readonly feedbackLoop?: SelfImprovementFeedbackLoop
    ) { }

    /**
     * Evaluates post-execution metrics and triggers an automated rollback if necessary.
     * 
     * @param proposal The proposal that was executed and is being monitored.
     * @param metrics The real-world metrics observed post-execution.
     * @returns A detailed outcome of the evaluation.
     */
    public async evaluate(
        proposal: SelfModificationProposal,
        metrics: PostExecutionMetrics
    ): Promise<RollbackOutcome> {
        const violations = this.checkThresholds(metrics);
        const shouldRollback = violations.length > 0;

        let rollbackPlan: RollbackPlan | undefined;
        let reason: string | undefined;

        if (shouldRollback) {
            reason = `Post-execution metrics failed safety thresholds: ${violations.join(', ')}`;

            try {
                rollbackPlan = this.executeRollback(proposal, reason);
                proposal.status = ProposalStatus.ROLLED_BACK;
            } catch (error: any) {
                reason = `Rollback failed: ${error.message}`;
            }
        } else {
            reason = 'Post-execution metrics remain within safety thresholds.';
        }

        const outcome: RollbackOutcome = {
            proposalId: proposal.id,
            rollbackInitiated: shouldRollback && !!rollbackPlan,
            reason,
            metrics: { ...metrics },
            thresholds: { ...this.thresholds },
            timestamp: new Date(),
            rollbackPlan
        };

        this.outcomes.push(outcome);
        this.feedbackLoop?.recordOutcome({
            proposal,
            sandboxPerformance: {
                performanceDelta: proposal.simulationResults?.performanceDelta ?? 0,
                resourceUsageDelta: proposal.simulationResults?.resourceUsageDelta ?? 0,
                stabilityScore: proposal.simulationResults?.stabilityScore ?? 0
            },
            realWorldTaskImpact: {
                taskCompletionDelta: clamp(metrics.roi, -1, 1),
                qualityDelta: 1 - (metrics.riskScore * 2),
                latencyDelta: proposal.simulationResults?.performanceDelta ?? 0
            },
            economic: {
                actualCost: proposal.economicConstraints.estimatedCost,
                actualROI: metrics.roi
            },
            cooperation: {
                coordinationQuality: normalize(metrics.cooperativeImpact),
                conflictRate: 1 - normalize(metrics.cooperativeImpact),
                sharedResourceEfficiency: proposal.consensusScores?.averageCooperation ?? 0.5
            },
            rolledBack: outcome.rollbackInitiated,
            observedAt: metrics.evaluatedAt
        });

        return outcome;
    }

    /**
     * Checks metrics against thresholds and returns a list of violations.
     */
    private checkThresholds(metrics: PostExecutionMetrics): string[] {
        const violations: string[] = [];

        if (metrics.riskScore > this.thresholds.maxRiskScore) {
            violations.push(`Risk Score (${metrics.riskScore.toFixed(2)}) > Max (${this.thresholds.maxRiskScore.toFixed(2)})`);
        }

        if (metrics.roi < this.thresholds.minROI) {
            violations.push(`ROI (${metrics.roi.toFixed(2)}) < Min (${this.thresholds.minROI.toFixed(2)})`);
        }

        if (metrics.cooperativeImpact < this.thresholds.minCooperativeImpact) {
            violations.push(`Cooperative Impact (${metrics.cooperativeImpact.toFixed(2)}) < Min (${this.thresholds.minCooperativeImpact.toFixed(2)})`);
        }

        return violations;
    }

    /**
     * Performs the rollback operation while ensuring it is safe and preserves dependent changes.
     */
    private executeRollback(proposal: SelfModificationProposal, reason: string): RollbackPlan {
        const proposalHistory = this.versionControl.queryVersions({ proposalId: proposal.id });

        if (proposalHistory.length === 0) {
            throw new Error(`Cannot rollback proposal ${proposal.id}: No version history found.`);
        }

        // Identify the target version for rollback.
        // If there are multiple versions (e.g. updates to the same proposal), rollback to the previous one.
        // If there's only one, we are rolling back to the 'null' state before this proposal.
        // For this implementation, we use the first version as the rollback target if only one exists,
        // which represents reverting to the state captured at the moment of approval but before impact.
        const targetVersion = proposalHistory.length > 1
            ? proposalHistory[proposalHistory.length - 2]
            : proposalHistory[0];

        // Preservation of dependent changes:
        // By using the VersionControlEngine's proposal-specific history, we ensure that
        // rolling back this proposal does not inadvertently revert unrelated modifications
        // to other modules that might have occurred in the meantime.

        const allVersions = this.versionControl.queryVersions();
        const latestForProposal = proposalHistory[proposalHistory.length - 1];
        const newerUnrelated = allVersions.filter(v =>
            v.createdAt > latestForProposal.createdAt && v.proposalId !== proposal.id
        );

        const enrichedReason = newerUnrelated.length > 0
            ? `${reason}. (Preserving ${newerUnrelated.length} subsequent unrelated modifications).`
            : reason;

        return this.versionControl.rollbackToVersion({
            proposalId: proposal.id,
            targetVersionId: targetVersion.versionId,
            initiatedBy: 'RollbackEngine-Auto',
            reason: enrichedReason,
            approvalReference: `auto-rollback-${proposal.id}-${Date.now()}`
        });
    }

    /**
     * Returns all logged outcomes for auditing and future learning.
     */
    public getOutcomes(): readonly RollbackOutcome[] {
        return [...this.outcomes];
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalize(value: number): number {
    return clamp((value + 1) / 2, 0, 1);
}

import { ProposalType, SelfModificationProposal } from '../models/SelfModificationProposal';

export type ComputeTier = 'LIGHT' | 'STANDARD' | 'INTENSIVE';

export interface ComputeAllocationPlan {
    tier: ComputeTier;
    cpuCores: number;
    memoryMb: number;
    maxRuntimeMs: number;
}

export interface ProposalPriorityBreakdown {
    expectedValueScore: number;
    riskPenalty: number;
    cooperativeContributionScore: number;
    performanceContributionScore: number;
    strategicAlignmentScore: number;
}

export interface ProposalPrioritizationRecord {
    priorityScore: number;
    breakdown: ProposalPriorityBreakdown;
    computeAllocationPlan: ComputeAllocationPlan;
    rankedAt: Date;
}

/**
 * ProposalPrioritizationEngine
 *
 * Ranks incoming proposals by expected value, risk, and cooperative contribution.
 * The score is then used to optimize evaluation order and assign sandbox compute.
 */
export class ProposalPrioritizationEngine {
    rank(proposal: SelfModificationProposal): ProposalPrioritizationRecord {
        const expectedValueScore = this.deriveExpectedValueScore(proposal);
        const riskPenalty = this.deriveRiskPenalty(proposal);
        const cooperativeContributionScore = this.deriveCooperationScore(proposal);
        const performanceContributionScore = this.derivePerformanceContributionScore(proposal);
        const strategicAlignmentScore = this.clamp01(proposal.governanceMetadata.strategicAlignmentScore);

        const priorityScore = this.clamp01(
            (expectedValueScore * 0.4) +
            (cooperativeContributionScore * 0.25) +
            (performanceContributionScore * 0.2) +
            (strategicAlignmentScore * 0.15) -
            (riskPenalty * 0.45)
        );

        return {
            priorityScore,
            breakdown: {
                expectedValueScore,
                riskPenalty,
                cooperativeContributionScore,
                performanceContributionScore,
                strategicAlignmentScore
            },
            computeAllocationPlan: this.buildComputePlan(proposal, priorityScore, riskPenalty),
            rankedAt: new Date()
        };
    }

    private deriveExpectedValueScore(proposal: SelfModificationProposal): number {
        const projectedRoi = proposal.impactAssessment?.projectedROI ?? proposal.economicConstraints.projectedROI;
        const minRoi = Math.max(0.01, proposal.economicConstraints.requiredMinROI);
        const roiEfficiencyRatio = projectedRoi / minRoi;
        const normalizedRoiScore = this.clamp01(roiEfficiencyRatio / 3);

        const estimatedCost = Math.max(1, proposal.economicConstraints.estimatedCost);
        const budgetHeadroom = this.clamp01(
            1 - (estimatedCost / Math.max(estimatedCost, proposal.economicConstraints.budgetLimit))
        );

        return this.clamp01((normalizedRoiScore * 0.75) + (budgetHeadroom * 0.25));
    }

    private deriveRiskPenalty(proposal: SelfModificationProposal): number {
        const baseRisk = proposal.impactAssessment?.riskScore ?? proposal.predictedRisk;
        const moduleComplexityPenalty = proposal.type === ProposalType.MAJOR ? 0.1 : 0;
        return this.clamp01(baseRisk + moduleComplexityPenalty);
    }

    private deriveCooperationScore(proposal: SelfModificationProposal): number {
        const synergy = proposal.impactAssessment?.synergyMetrics;
        const collaborationEfficiency = synergy?.agentCollaborationEfficiency ?? 0.5;
        const resourceSharingPotential = synergy?.resourceSharingPotential ?? 0.5;
        const consensusCooperation = proposal.consensusScores?.averageCooperation ?? 0.5;

        return this.clamp01(
            (collaborationEfficiency * 0.45) +
            (resourceSharingPotential * 0.35) +
            (consensusCooperation * 0.2)
        );
    }

    private derivePerformanceContributionScore(proposal: SelfModificationProposal): number {
        const simulationPerformance = proposal.simulationResults?.performanceDelta ?? 0;
        const impactSignal = proposal.impactAssessment?.synergyMetrics.crossModuleOptimization ?? 0.3;

        // Convert performance delta from [-1, 1] style values to [0, 1]
        const normalizedSimulationPerformance = this.clamp01((simulationPerformance + 1) / 2);
        return this.clamp01((normalizedSimulationPerformance * 0.6) + (impactSignal * 0.4));
    }

    private buildComputePlan(
        proposal: SelfModificationProposal,
        priorityScore: number,
        riskPenalty: number
    ): ComputeAllocationPlan {
        const complexityWeight = proposal.type === ProposalType.MAJOR ? 1 : 0.65;
        const budgetScale = this.clamp01(proposal.economicConstraints.estimatedCost / 5000);
        const intensity = this.clamp01(
            (priorityScore * 0.55) +
            (complexityWeight * 0.25) +
            (riskPenalty * 0.15) +
            (budgetScale * 0.05)
        );

        if (intensity >= 0.75) {
            return {
                tier: 'INTENSIVE',
                cpuCores: 8,
                memoryMb: 8192,
                maxRuntimeMs: 180_000
            };
        }

        if (intensity >= 0.45) {
            return {
                tier: 'STANDARD',
                cpuCores: 4,
                memoryMb: 4096,
                maxRuntimeMs: 90_000
            };
        }

        return {
            tier: 'LIGHT',
            cpuCores: 2,
            memoryMb: 2048,
            maxRuntimeMs: 45_000
        };
    }

    private clamp01(value: number): number {
        return Math.max(0, Math.min(1, value));
    }
}

import {
    ImpactAssessment,
    ProposalType,
    SelfModificationProposal,
    SynergyMetrics
} from '../models/SelfModificationProposal';
import { SelfImprovementFeedbackLoop } from './SelfImprovementFeedbackLoop';

/**
 * ImpactAssessmentEngine
 * 
 * Calculates predicted economic costs, ROI, risk scores, and synergy metrics for proposed modifications.
 * Provides recommendations for validation.
 */
export class ImpactAssessmentEngine {
    private readonly RISK_THRESHOLD = 0.75;
    private readonly BUDGET_THRESHOLD_FACTOR = 0.9; // Warning at 90% of budget
    constructor(private readonly feedbackLoop?: SelfImprovementFeedbackLoop) { }

    /**
     * Performs a comprehensive impact assessment on a proposal.
     * @param proposal The proposal to assess.
     * @returns The impact assessment result.
     */
    public assess(proposal: SelfModificationProposal): ImpactAssessment {
        const synergyMetrics = this.calculateSynergyMetrics(proposal);
        const predictedEconomicCost = this.calculatePredictedCost(proposal, synergyMetrics);
        const projectedROI = this.calculateProjectedROI(proposal, predictedEconomicCost, synergyMetrics);
        const riskScore = this.calculateRefinedRiskScore(proposal, synergyMetrics);
        const adjustments = this.feedbackLoop?.getPredictiveAdjustments(proposal);

        const calibratedRiskScore = adjustments
            ? this.clamp01(riskScore + (adjustments.riskBias * adjustments.confidence))
            : riskScore;
        const calibratedProjectedROI = adjustments
            ? projectedROI + (adjustments.roiBias * adjustments.confidence)
            : projectedROI;
        const calibratedSynergyMetrics = adjustments
            ? {
                ...synergyMetrics,
                agentCollaborationEfficiency: this.clamp01(
                    synergyMetrics.agentCollaborationEfficiency +
                    (adjustments.cooperationBias * 0.5 * adjustments.confidence)
                )
            }
            : synergyMetrics;

        const recommendation = this.determineRecommendation(
            calibratedRiskScore,
            predictedEconomicCost,
            proposal.economicConstraints.budgetLimit,
            calibratedProjectedROI,
            proposal.economicConstraints.requiredMinROI
        );

        return {
            predictedEconomicCost,
            projectedROI: calibratedProjectedROI,
            riskScore: calibratedRiskScore,
            synergyMetrics: calibratedSynergyMetrics,
            recommendation,
            timestamp: new Date()
        };
    }

    private calculateSynergyMetrics(proposal: SelfModificationProposal): SynergyMetrics {
        // Logic to simulate synergy calculation
        // In a real system, this might look at module dependencies and historical data
        const isCoreModule = ['kernel', 'consensus', 'security', 'treasury'].includes(proposal.targetModule.toLowerCase());

        return {
            crossModuleOptimization: isCoreModule ? 0.8 : 0.4,
            agentCollaborationEfficiency: proposal.type === ProposalType.MAJOR ? 0.7 : 0.3,
            resourceSharingPotential: Math.random() * 0.6 + 0.2
        };
    }

    private calculatePredictedCost(proposal: SelfModificationProposal, synergy: SynergyMetrics): number {
        const baseCost = proposal.type === ProposalType.MAJOR ? 5000 : 1000;
        const complexityFactor = proposal.targetParameter ? 1.2 : 1.0;

        // Synergy reduces cost via efficiency
        const synergyDiscount = 1.0 - (synergy.resourceSharingPotential * 0.2);

        return baseCost * complexityFactor * synergyDiscount;
    }

    private calculateProjectedROI(proposal: SelfModificationProposal, cost: number, synergy: SynergyMetrics): number {
        // ROI = (Gain - Cost) / Cost
        // Gain is simulated based on expected impact and synergies
        const estimatedGain = cost * (1.5 + synergy.crossModuleOptimization + synergy.agentCollaborationEfficiency);

        return (estimatedGain - cost) / cost;
    }

    private calculateRefinedRiskScore(proposal: SelfModificationProposal, synergy: SynergyMetrics): number {
        const baseRisk = proposal.predictedRisk;

        // High synergy in core modules might increase complexity risk
        const complexityRisk = (synergy.crossModuleOptimization > 0.7) ? 0.1 : 0.0;

        // Better collaboration efficiency might reduce risk
        const collaborationMitigation = synergy.agentCollaborationEfficiency * 0.05;

        return Math.max(0, Math.min(1, baseRisk + complexityRisk - collaborationMitigation));
    }

    private determineRecommendation(
        riskScore: number,
        cost: number,
        budgetLimit: number,
        roi: number,
        minROI: number
    ): 'ALLOW' | 'BLOCK' | 'FLAG' {
        if (riskScore > this.RISK_THRESHOLD) {
            return 'BLOCK';
        }

        if (cost > budgetLimit) {
            return 'BLOCK';
        }

        if (roi < minROI) {
            return 'FLAG'; // Flag for review if ROI is lower than desired but not necessarily fatal
        }

        if (cost > budgetLimit * this.BUDGET_THRESHOLD_FACTOR) {
            return 'FLAG'; // Flag if close to budget
        }

        if (riskScore > 0.6) {
            return 'FLAG'; // Flag moderate-high risk
        }

        return 'ALLOW';
    }

    private clamp01(value: number): number {
        return Math.max(0, Math.min(1, value));
    }
}

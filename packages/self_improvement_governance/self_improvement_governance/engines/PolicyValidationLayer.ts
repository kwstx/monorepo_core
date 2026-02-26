import {
    EconomicConstraints,
    GovernanceMetadata,
    ImpactAssessment
} from '../models/SelfModificationProposal';

export type GovernanceDomain = 'SAFETY' | 'COMPLIANCE' | 'ECONOMIC' | 'STRATEGIC_ALIGNMENT';

export interface PolicyViolation {
    domain: GovernanceDomain;
    ruleId: string;
    message: string;
}

export interface PolicyValidationResult {
    passed: boolean;
    violations: PolicyViolation[];
}

export interface GovernanceRuleSet {
    maxPredictedRisk: number;
    requiredComplianceProtocols: string[];
    maxBudgetUtilization: number;
    minimumStrategicAlignment: number;
}

export interface GovernancePolicySubject {
    id: string;
    predictedRisk: number;
    economicConstraints: EconomicConstraints;
    governanceMetadata: GovernanceMetadata;
    impactAssessment?: ImpactAssessment | null;
}

export class PolicyValidationLayer {
    private readonly rules: GovernanceRuleSet;

    constructor(rules?: Partial<GovernanceRuleSet>) {
        this.rules = {
            maxPredictedRisk: rules?.maxPredictedRisk ?? 0.7,
            requiredComplianceProtocols:
                rules?.requiredComplianceProtocols ?? ['SAFETY_BASELINE_V1', 'AUDIT_LOGGING_V1'],
            maxBudgetUtilization: rules?.maxBudgetUtilization ?? 1.0,
            minimumStrategicAlignment: rules?.minimumStrategicAlignment ?? 0.6
        };
    }

    validate(subject: GovernancePolicySubject): PolicyValidationResult {
        const violations: PolicyViolation[] = [];

        // Impact Assessment Check (Pre-execution validation)
        if (subject.impactAssessment) {
            if (subject.impactAssessment.recommendation === 'BLOCK') {
                violations.push({
                    domain: 'SAFETY',
                    ruleId: 'impact.assessment_blocked',
                    message: `Impact assessment recommendation is BLOCK. Risk Score: ${subject.impactAssessment.riskScore.toFixed(2)}, Predicted Cost: ${subject.impactAssessment.predictedEconomicCost.toFixed(2)}`
                });
            } else if (subject.impactAssessment.recommendation === 'FLAG') {
                violations.push({
                    domain: 'SAFETY',
                    ruleId: 'impact.assessment_flagged',
                    message: `Impact assessment recommendation is FLAG (Requires Review). Risk Score: ${subject.impactAssessment.riskScore.toFixed(2)}, ROI: ${subject.impactAssessment.projectedROI.toFixed(2)}`
                });
            }

            // Specific thresholds tie-in
            if (subject.impactAssessment.predictedEconomicCost > subject.economicConstraints.budgetLimit) {
                violations.push({
                    domain: 'ECONOMIC',
                    ruleId: 'economic.predicted_cost_limit',
                    message: `Predicted economic cost ${subject.impactAssessment.predictedEconomicCost.toFixed(2)} exceeds budget limit ${subject.economicConstraints.budgetLimit.toFixed(2)}.`
                });
            }
        }

        if (subject.predictedRisk > this.rules.maxPredictedRisk) {
            violations.push({
                domain: 'SAFETY',
                ruleId: 'safety.max_predicted_risk',
                message: `Predicted risk ${subject.predictedRisk.toFixed(2)} exceeds maximum ${this.rules.maxPredictedRisk.toFixed(2)}.`
            });
        }

        const proposalProtocols = new Set(subject.governanceMetadata.complianceProtocols);
        for (const requiredProtocol of this.rules.requiredComplianceProtocols) {
            if (!proposalProtocols.has(requiredProtocol)) {
                violations.push({
                    domain: 'COMPLIANCE',
                    ruleId: 'compliance.required_protocol',
                    message: `Missing required compliance protocol ${requiredProtocol}.`
                });
            }
        }

        const budgetUtilization =
            subject.economicConstraints.budgetLimit === 0
                ? Number.POSITIVE_INFINITY
                : subject.economicConstraints.estimatedCost / subject.economicConstraints.budgetLimit;

        if (budgetUtilization > this.rules.maxBudgetUtilization) {
            violations.push({
                domain: 'ECONOMIC',
                ruleId: 'economic.max_budget_utilization',
                message: `Budget utilization ${budgetUtilization.toFixed(2)} exceeds maximum ${this.rules.maxBudgetUtilization.toFixed(2)}.`
            });
        }

        if (
            subject.governanceMetadata.strategicAlignmentScore <
            this.rules.minimumStrategicAlignment
        ) {
            violations.push({
                domain: 'STRATEGIC_ALIGNMENT',
                ruleId: 'strategic.minimum_alignment',
                message: `Strategic alignment score ${subject.governanceMetadata.strategicAlignmentScore.toFixed(2)} is below minimum ${this.rules.minimumStrategicAlignment.toFixed(2)}.`
            });
        }

        return {
            passed: violations.length === 0,
            violations
        };
    }
}

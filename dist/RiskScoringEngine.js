/**
 * Computes a context-aware composite risk score across multiple dimensions.
 * Weighting is dynamically recalibrated on each call based on context + system state.
 */
export class RiskScoringEngine {
    baseWeights = {
        operationalRisk: 1.0,
        regulatoryExposure: 1.0,
        financialCost: 0.8,
        reputationalImpact: 0.9,
        cooperativeSystemStability: 1.0,
        predictedComplianceProbability: 1.1,
    };
    /**
     * Adaptive multipliers are nudged by feedback to gradually calibrate behavior over time.
     */
    adaptiveMultipliers = {
        operationalRisk: 1.0,
        regulatoryExposure: 1.0,
        financialCost: 1.0,
        reputationalImpact: 1.0,
        cooperativeSystemStability: 1.0,
        predictedComplianceProbability: 1.0,
    };
    scoreDecision(decision, context, systemState) {
        const dimensionScores = this.computeDimensionScores(decision, context, systemState);
        const weights = this.recalibrateWeights(decision, context, systemState);
        // Risk dimensions are all "higher means riskier".
        const riskDimensions = [
            'operationalRisk',
            'regulatoryExposure',
            'financialCost',
            'reputationalImpact',
            'cooperativeSystemStability',
        ];
        let weightedRiskSum = 0;
        let riskWeightSum = 0;
        for (const key of riskDimensions) {
            weightedRiskSum += dimensionScores[key] * weights[key];
            riskWeightSum += weights[key];
        }
        const weightedRisk = riskWeightSum > 0 ? weightedRiskSum / riskWeightSum : 0;
        const weightedCompliance = this.clamp01(dimensionScores.predictedComplianceProbability * weights.predictedComplianceProbability);
        // Decision score favors high compliance and low risk pressure.
        const riskPressure = this.clamp01((weightedRisk * 0.7) + ((1 - weightedCompliance) * 0.3));
        const decisionScore = this.clamp01(1 - riskPressure) * 100;
        return {
            decisionScore: Number(decisionScore.toFixed(2)),
            riskPressure: Number(riskPressure.toFixed(4)),
            breakdown: {
                dimensionScores,
                weights,
                weightedRisk: Number(weightedRisk.toFixed(4)),
                weightedCompliance: Number(weightedCompliance.toFixed(4)),
            }
        };
    }
    /**
     * Feedback loop for online recalibration. If real-world outcome diverges from prediction,
     * corresponding multipliers are adjusted to reduce future error.
     */
    updateCalibrationFromFeedback(predicted, actualOutcome, learningRate = 0.05) {
        const lr = this.clamp(learningRate, 0.005, 0.2);
        const observedCompliance = this.clamp01(actualOutcome.complianceObserved);
        const predictedCompliance = predicted.breakdown.dimensionScores.predictedComplianceProbability;
        const complianceError = observedCompliance - predictedCompliance;
        // If compliance was worse than predicted, increase emphasis on regulatory + operational signals.
        this.adaptiveMultipliers.regulatoryExposure = this.clamp(this.adaptiveMultipliers.regulatoryExposure + (-complianceError * lr), 0.5, 2.5);
        this.adaptiveMultipliers.operationalRisk = this.clamp(this.adaptiveMultipliers.operationalRisk + (-complianceError * lr * 0.7), 0.5, 2.5);
        if (actualOutcome.stabilityIncidentOccurred) {
            this.adaptiveMultipliers.cooperativeSystemStability = this.clamp(this.adaptiveMultipliers.cooperativeSystemStability + lr, 0.5, 2.5);
            this.adaptiveMultipliers.reputationalImpact = this.clamp(this.adaptiveMultipliers.reputationalImpact + (lr * 0.6), 0.5, 2.5);
        }
        if (actualOutcome.costOverrunRatio > 1) {
            const overrunPenalty = this.clamp((actualOutcome.costOverrunRatio - 1) * lr, 0, 0.25);
            this.adaptiveMultipliers.financialCost = this.clamp(this.adaptiveMultipliers.financialCost + overrunPenalty, 0.5, 2.5);
        }
        // If predictions were overly pessimistic and outcomes were good, relax compliance emphasis slightly.
        if (complianceError > 0.1 && !actualOutcome.stabilityIncidentOccurred) {
            this.adaptiveMultipliers.predictedComplianceProbability = this.clamp(this.adaptiveMultipliers.predictedComplianceProbability - (lr * 0.4), 0.5, 2.5);
        }
    }
    computeDimensionScores(decision, context, systemState) {
        const operationalRisk = this.computeOperationalRisk(decision, systemState);
        const regulatoryExposure = this.computeRegulatoryExposure(decision, context);
        const financialCost = this.computeFinancialCost(decision, context);
        const reputationalImpact = this.computeReputationalImpact(decision, systemState);
        const cooperativeSystemStability = this.computeCooperativeSystemStability(decision, systemState);
        const predictedComplianceProbability = this.computePredictedCompliance(decision, context, systemState);
        return {
            operationalRisk,
            regulatoryExposure,
            financialCost,
            reputationalImpact,
            cooperativeSystemStability,
            predictedComplianceProbability,
        };
    }
    recalibrateWeights(decision, context, systemState) {
        const weights = {
            operationalRisk: this.baseWeights.operationalRisk,
            regulatoryExposure: this.baseWeights.regulatoryExposure,
            financialCost: this.baseWeights.financialCost,
            reputationalImpact: this.baseWeights.reputationalImpact,
            cooperativeSystemStability: this.baseWeights.cooperativeSystemStability,
            predictedComplianceProbability: this.baseWeights.predictedComplianceProbability,
        };
        // System-state sensitivity.
        weights.cooperativeSystemStability *= 1 + (systemState.loadFactor * 0.8);
        weights.operationalRisk *= 1 + (systemState.loadFactor * 0.4);
        if (systemState.incidentActive) {
            weights.cooperativeSystemStability *= 1.35;
            weights.reputationalImpact *= 1.2;
        }
        if (systemState.regulatoryAlert) {
            weights.regulatoryExposure *= 1.4;
            weights.predictedComplianceProbability *= 1.25;
            weights.reputationalImpact *= 1.1;
        }
        // Decision-specific sensitivity.
        const sensitivePermission = decision.authorityScope.permissions.some((p) => ['WRITE', 'DELETE', 'ADMIN', 'EXECUTE'].includes(p.toUpperCase()));
        if (sensitivePermission) {
            weights.operationalRisk *= 1.15;
            weights.regulatoryExposure *= 1.1;
        }
        // Contextual multipliers.
        const budgetPressure = this.clamp01(context.budgetPressure ?? 0);
        weights.financialCost *= 1 + (budgetPressure * 0.9);
        const dataSensitivity = this.clamp01(context.dataSensitivity ?? 0);
        weights.regulatoryExposure *= 1 + (dataSensitivity * 0.7);
        weights.reputationalImpact *= 1 + (dataSensitivity * 0.5);
        // User-supplied strategic priorities.
        if (context.dimensionPriorities) {
            for (const key of Object.keys(context.dimensionPriorities)) {
                const boost = context.dimensionPriorities[key];
                if (typeof boost === 'number' && Number.isFinite(boost) && boost > 0) {
                    weights[key] *= boost;
                }
            }
        }
        // Learned adaptation.
        for (const key of Object.keys(weights)) {
            weights[key] *= this.adaptiveMultipliers[key];
        }
        return this.normalizeWeights(weights);
    }
    normalizeWeights(weights) {
        let sum = 0;
        for (const key of Object.keys(weights)) {
            weights[key] = Math.max(0, weights[key]);
            sum += weights[key];
        }
        if (sum <= 0) {
            const uniform = 1 / 6;
            return {
                operationalRisk: uniform,
                regulatoryExposure: uniform,
                financialCost: uniform,
                reputationalImpact: uniform,
                cooperativeSystemStability: uniform,
                predictedComplianceProbability: uniform,
            };
        }
        for (const key of Object.keys(weights)) {
            weights[key] = weights[key] / sum;
        }
        return weights;
    }
    computeOperationalRisk(decision, systemState) {
        let resourcePressure = 0;
        for (const resource of decision.requiredResources) {
            const criticalityFactor = resource.criticality === 'HIGH' ? 1.0 :
                resource.criticality === 'MEDIUM' ? 0.6 : 0.3;
            resourcePressure += criticalityFactor * Math.min(resource.amount / 1000, 1);
        }
        const permissionBreadth = Math.min(decision.authorityScope.permissions.length / 5, 1);
        const loadAmplifier = this.clamp01(systemState.loadFactor);
        return this.clamp01((resourcePressure * 0.5) + (permissionBreadth * 0.3) + (loadAmplifier * 0.2));
    }
    computeRegulatoryExposure(decision, context) {
        if (decision.policyExposure.length === 0) {
            return 0;
        }
        let exposureSum = 0;
        let violationCount = 0;
        for (const exposure of decision.policyExposure) {
            exposureSum += this.clamp01(exposure.exposureLevel);
            violationCount += exposure.potentialViolations.length;
        }
        const avgExposure = exposureSum / decision.policyExposure.length;
        const violationFactor = Math.min(violationCount / 10, 1);
        const sensitivityAmplifier = this.clamp01(context.dataSensitivity ?? 0);
        return this.clamp01((avgExposure * 0.7) + (violationFactor * 0.2) + (sensitivityAmplifier * 0.1));
    }
    computeFinancialCost(decision, context) {
        const unitCostMap = {
            CPU: 0.002,
            API_CALL: 0.01,
            NETWORK_EGRESS_MB: 0.0015,
            STORAGE_GB: 0.02,
            HUMAN_REVIEW_MINUTES: 0.4,
        };
        let estimatedCost = 0;
        for (const resource of decision.requiredResources) {
            const unitCost = unitCostMap[resource.type] ?? 0.005;
            estimatedCost += resource.amount * unitCost;
        }
        const normalizedCost = Math.min(estimatedCost / 100, 1);
        const budgetPressure = this.clamp01(context.budgetPressure ?? 0);
        return this.clamp01((normalizedCost * 0.75) + (budgetPressure * 0.25));
    }
    computeReputationalImpact(decision, systemState) {
        const policyViolationSignal = Math.min(decision.policyExposure.reduce((acc, p) => acc + p.potentialViolations.length, 0) / 8, 1);
        // Negative trust propagation values indicate harmful spread.
        const trustPropagation = this.clamp01(Math.max(0, -decision.projectedImpact.trustWeightedPropagation));
        const incidentAmplifier = systemState.incidentActive ? 0.2 : 0;
        return this.clamp01((policyViolationSignal * 0.5) + (trustPropagation * 0.3) + incidentAmplifier);
    }
    computeCooperativeSystemStability(decision, systemState) {
        const inverseProjectedStability = this.clamp01((1 - decision.projectedImpact.systemStabilityScore) / 2);
        const recoveryPenalty = Math.min(decision.projectedImpact.estimatedRecoveryTimeSeconds / 3600, 1);
        const backlogPenalty = Math.min(systemState.recoveryBacklogSeconds / 7200, 1);
        return this.clamp01((inverseProjectedStability * 0.5) + (recoveryPenalty * 0.3) + (backlogPenalty * 0.2));
    }
    computePredictedCompliance(decision, context, systemState) {
        const policyRisk = this.computeRegulatoryExposure(decision, context);
        const operationalRisk = this.computeOperationalRisk(decision, systemState);
        const historicalCompliance = this.clamp01(context.historicalComplianceRate ?? 0.5);
        // Higher policy/operational risk lowers predicted compliance probability.
        const predicted = (historicalCompliance * 0.6) + ((1 - policyRisk) * 0.25) + ((1 - operationalRisk) * 0.15);
        return this.clamp01(predicted);
    }
    clamp01(value) {
        return this.clamp(value, 0, 1);
    }
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}

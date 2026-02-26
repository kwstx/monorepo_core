import { ProposalType, SelfModificationProposal } from '../models/SelfModificationProposal';

export interface SandboxPerformanceOutcome {
    performanceDelta: number;
    resourceUsageDelta: number;
    stabilityScore: number;
}

export interface RealWorldTaskImpactOutcome {
    taskCompletionDelta: number; // -1.0 to 1.0
    qualityDelta: number; // -1.0 to 1.0
    latencyDelta: number; // -1.0 to 1.0 (positive means faster/better)
}

export interface EconomicOutcome {
    actualCost: number;
    actualROI: number;
}

export interface CooperationOutcome {
    coordinationQuality: number; // 0.0 to 1.0
    conflictRate: number; // 0.0 to 1.0
    sharedResourceEfficiency: number; // 0.0 to 1.0
}

export interface FeedbackOutcomeInput {
    proposal: SelfModificationProposal;
    sandboxPerformance: SandboxPerformanceOutcome;
    realWorldTaskImpact: RealWorldTaskImpactOutcome;
    economic: EconomicOutcome;
    cooperation: CooperationOutcome;
    rolledBack: boolean;
    observedAt?: Date;
}

export interface PredictiveModelAdjustments {
    riskBias: number;
    roiBias: number;
    performanceBias: number;
    cooperationBias: number;
    confidence: number;
}

export interface BudgetAllocationRule {
    adjustedBudgetLimit: number;
    allocationMultiplier: number;
    confidence: number;
}

type OutcomeDriftVector = {
    riskDrift: number;
    roiDrift: number;
    performanceDrift: number;
    cooperationDrift: number;
    costOverrunRatio: number;
    rolledBack: boolean;
};

export class SelfImprovementFeedbackLoop {
    private readonly outcomesByModule = new Map<string, OutcomeDriftVector[]>();
    private readonly outcomesByType = new Map<ProposalType, OutcomeDriftVector[]>();

    constructor(private readonly maxHistoryPerBucket = 50) { }

    recordOutcome(input: FeedbackOutcomeInput): void {
        const vector = this.toDriftVector(input);
        const moduleKey = this.moduleKey(input.proposal.targetModule);

        this.pushBounded(this.outcomesByModule, moduleKey, vector);
        this.pushBounded(this.outcomesByType, input.proposal.type, vector);
    }

    getPredictiveAdjustments(proposal: SelfModificationProposal): PredictiveModelAdjustments {
        const moduleHistory = this.outcomesByModule.get(this.moduleKey(proposal.targetModule)) ?? [];
        const typeHistory = this.outcomesByType.get(proposal.type) ?? [];
        const merged = [...moduleHistory, ...typeHistory];

        if (merged.length === 0) {
            return {
                riskBias: 0,
                roiBias: 0,
                performanceBias: 0,
                cooperationBias: 0,
                confidence: 0
            };
        }

        const avgRiskDrift = average(merged.map((v) => v.riskDrift));
        const avgRoiDrift = average(merged.map((v) => v.roiDrift));
        const avgPerformanceDrift = average(merged.map((v) => v.performanceDrift));
        const avgCooperationDrift = average(merged.map((v) => v.cooperationDrift));
        const confidence = Math.min(1, merged.length / 20);

        return {
            riskBias: clamp(avgRiskDrift, -0.4, 0.4),
            roiBias: clamp(avgRoiDrift, -0.8, 0.8),
            performanceBias: clamp(avgPerformanceDrift, -0.5, 0.5),
            cooperationBias: clamp(avgCooperationDrift, -0.5, 0.5),
            confidence
        };
    }

    getBudgetAllocationRule(proposal: SelfModificationProposal): BudgetAllocationRule {
        const moduleHistory = this.outcomesByModule.get(this.moduleKey(proposal.targetModule)) ?? [];
        const typeHistory = this.outcomesByType.get(proposal.type) ?? [];
        const merged = [...moduleHistory, ...typeHistory];

        if (merged.length === 0) {
            return {
                adjustedBudgetLimit: proposal.economicConstraints.budgetLimit,
                allocationMultiplier: 1,
                confidence: 0
            };
        }

        const avgCostOverrun = average(merged.map((v) => v.costOverrunRatio));
        const avgRoiDrift = average(merged.map((v) => v.roiDrift));
        const rollbackRate = average(merged.map((v) => (v.rolledBack ? 1 : 0)));

        const multiplier = clamp(
            1 - (avgCostOverrun * 0.35) + (avgRoiDrift * 0.2) - (rollbackRate * 0.3),
            0.6,
            1.35
        );

        return {
            adjustedBudgetLimit: proposal.economicConstraints.budgetLimit * multiplier,
            allocationMultiplier: multiplier,
            confidence: Math.min(1, merged.length / 20)
        };
    }

    private toDriftVector(input: FeedbackOutcomeInput): OutcomeDriftVector {
        const predictedRisk = input.proposal.impactAssessment?.riskScore ?? input.proposal.predictedRisk;
        const predictedROI = input.proposal.impactAssessment?.projectedROI ?? input.proposal.economicConstraints.projectedROI;
        const predictedCooperation =
            input.proposal.consensusScores?.averageCooperation ??
            input.proposal.simulationResults?.metrics.cooperationImpact ??
            0;

        const realizedRisk = this.estimateRealizedRisk(input);
        const realizedCooperation = this.estimateRealizedCooperation(input.cooperation);
        const realizedPerformance = this.estimateRealizedPerformance(input.sandboxPerformance, input.realWorldTaskImpact);

        const predictedCost = input.proposal.impactAssessment?.predictedEconomicCost ?? input.proposal.economicConstraints.estimatedCost;
        const safePredictedCost = Math.max(1, predictedCost);

        return {
            riskDrift: realizedRisk - predictedRisk,
            roiDrift: input.economic.actualROI - predictedROI,
            performanceDrift: realizedPerformance - input.sandboxPerformance.performanceDelta,
            cooperationDrift: realizedCooperation - predictedCooperation,
            costOverrunRatio: (input.economic.actualCost - predictedCost) / safePredictedCost,
            rolledBack: input.rolledBack
        };
    }

    private estimateRealizedRisk(input: FeedbackOutcomeInput): number {
        const instability = 1 - clamp(input.sandboxPerformance.stabilityScore, 0, 1);
        const lowTaskQuality = clamp(-input.realWorldTaskImpact.qualityDelta, 0, 1);
        const conflictPenalty = input.cooperation.conflictRate * 0.5;
        const rollbackPenalty = input.rolledBack ? 0.35 : 0;
        return clamp(instability * 0.5 + lowTaskQuality * 0.25 + conflictPenalty + rollbackPenalty, 0, 1);
    }

    private estimateRealizedCooperation(input: CooperationOutcome): number {
        const inverseConflict = 1 - clamp(input.conflictRate, 0, 1);
        return clamp(
            (clamp(input.coordinationQuality, 0, 1) * 0.45) +
            (inverseConflict * 0.3) +
            (clamp(input.sharedResourceEfficiency, 0, 1) * 0.25),
            0,
            1
        );
    }

    private estimateRealizedPerformance(
        sandbox: SandboxPerformanceOutcome,
        taskImpact: RealWorldTaskImpactOutcome
    ): number {
        return clamp(
            (taskImpact.taskCompletionDelta * 0.5) +
            (taskImpact.qualityDelta * 0.35) +
            (taskImpact.latencyDelta * 0.15) +
            (sandbox.performanceDelta * 0.2),
            -1,
            1
        );
    }

    private moduleKey(rawModuleName: string): string {
        return rawModuleName.trim().toLowerCase();
    }

    private pushBounded<K>(storage: Map<K, OutcomeDriftVector[]>, key: K, vector: OutcomeDriftVector): void {
        const existing = storage.get(key) ?? [];
        existing.push(vector);
        if (existing.length > this.maxHistoryPerBucket) {
            existing.splice(0, existing.length - this.maxHistoryPerBucket);
        }
        storage.set(key, existing);
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

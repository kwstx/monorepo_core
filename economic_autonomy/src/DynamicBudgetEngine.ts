import type { AgentBudget, ResourceAllocation, ResourceType } from './models/AgentBudget.js';
import type { OverrideLearningLayer, AllocationRule } from './OverrideLearningLayer.js';

/**
 * Performance metrics for an agent over a recalibration period.
 */
export interface AgentPerformanceMetrics {
    successRate: number; // 0..1
    efficiencyScore: number; // 0..1 (e.g., actual cost vs starting estimate)
    latencyMs: number;
    reliabilityScore: number; // 0..1
}

/**
 * Results from sandbox simulations for future projected actions.
 */
export interface SandboxSimulationResult {
    simulatedScenario: string;
    successProbability: number;
    projectedCost: number;
    projectedBenefit: number;
    riskLevel: 'low' | 'medium' | 'high';
}

/**
 * ROI Estimate for the agent's recent or projected activities.
 */
export interface RoiEstimate {
    actualRoi: number; // (Gain - Cost) / Cost
    projectedRoi: number;
    confidenceInterval: [number, number];
}

/**
 * Human feedback received via overrides or reviews.
 */
export interface HumanFeedback {
    approvalRate: number; // 0..1
    manualBudgetAdjustment?: number; // Optional explicit numeric adjustment
    sentimentScore: number; // Positive/Negative (-1 to 1)
    notes?: string;
}

/**
 * Aggregated input for the recalibration process.
 */
export interface RecalibrationInput {
    agentId: string;
    actionType?: string; // Optional context for rule selection
    metrics: AgentPerformanceMetrics;
    simulations: SandboxSimulationResult[];
    roi: RoiEstimate;
    feedback: HumanFeedback;
    strategicImpact?: number; // 0..1, long-term strategic value
    cooperativeImpactFactor: number; // 1.0 is neutral, >1.0 means high cooperative importance
}

/**
 * Result of a budget recalibration.
 */
export interface RecalibrationResult {
    agentId: string;
    budgetId: string;
    previousAllocations: ResourceAllocation[];
    newAllocations: ResourceAllocation[];
    adjustmentReasons: string[];
    recalibrationTimestamp: Date;
}

/**
 * Configuration options for the DynamicBudgetEngine.
 */
export interface EngineOptions {
    maxIncreasePercentage?: number; // e.g., 0.2 for 20%
    maxDecreasePercentage?: number; // e.g., 0.1 for 10%
    minBudgetFloor?: number;
    learningRate?: number; // 0..1
    overrideLayer?: OverrideLearningLayer; // Optional layer for learned rules
}

const DEFAULT_OPTIONS: Omit<Required<EngineOptions>, 'overrideLayer'> = {
    maxIncreasePercentage: 0.25,
    maxDecreasePercentage: 0.15,
    minBudgetFloor: 10,
    learningRate: 0.1
};

/**
 * DynamicBudgetEngine
 * Periodically recalibrates agent budgets based on multi-dimensional performance signals.
 */
export class DynamicBudgetEngine {
    private options: Required<Omit<EngineOptions, 'overrideLayer'>> & { overrideLayer?: OverrideLearningLayer };

    constructor(options: EngineOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options } as any;
    }

    /**
     * Retrieves the current rule set, either from the override layer or defaults.
     */
    private getEffectiveRule(actionType?: string): AllocationRule {
        if (this.options.overrideLayer) {
            return this.options.overrideLayer.getEffectiveRule(actionType);
        }

        // Return a default rule if no layer is provided
        return {
            contextId: 'default',
            weights: {
                performance: 0.4,
                roi: 0.3,
                simulation: 0.1,
                humanFeedback: 0.1,
                strategicImpact: 0.1
            },
            bias: 0,
            lastUpdated: new Date(),
            evidenceCount: 0
        };
    }

    /**
     * Recalibrates the budget for a single agent based on incoming performance and feedback data.
     */
    public recalibrate(
        budget: AgentBudget,
        input: RecalibrationInput
    ): RecalibrationResult {
        if (budget.agentId !== input.agentId) {
            throw new Error(`Agent ID mismatch: budget belongs to ${budget.agentId} but input is for ${input.agentId}`);
        }

        const previousAllocations = JSON.parse(JSON.stringify(budget.allocations));
        const newAllocations: ResourceAllocation[] = [];
        const adjustmentReasons: string[] = [];

        const rule = this.getEffectiveRule(input.actionType);
        adjustmentReasons.push(`Using allocation rule: ${rule.contextId} (Evidence: ${rule.evidenceCount} corrections).`);

        // 1. Calculate the Multi-Dimensional Signal (-1 to 1)
        const combinedSignal = this.calculatePerformanceSignal(input, rule);

        // 2. Cooperative Fairness Adjustment
        // High cooperative impact prevents heavy decreases and boosts increases.
        const cooperativeBoost = Math.max(0, input.cooperativeImpactFactor - 1.0);

        // Calculate the percentage change, incorporating the learned bias
        let changePercentage = (combinedSignal + rule.bias) * this.options.learningRate;

        // Apply cooperative boost to change percentage
        if (changePercentage < 0) {
            // Mitigate decrease for cooperative agents
            changePercentage *= (1 / input.cooperativeImpactFactor);
            adjustmentReasons.push(`Decrease mitigated by cooperative impact factor of ${input.cooperativeImpactFactor.toFixed(2)}.`);
        } else {
            // Amplify increase for cooperative agents
            changePercentage *= input.cooperativeImpactFactor;
            if (input.cooperativeImpactFactor > 1) {
                adjustmentReasons.push(`Increase amplified by cooperative impact factor of ${input.cooperativeImpactFactor.toFixed(2)}.`);
            }
        }

        // Clamp the change percentage based on engine limits
        const clampedChange = Math.max(
            -this.options.maxDecreasePercentage,
            Math.min(this.options.maxIncreasePercentage, changePercentage)
        );

        adjustmentReasons.push(`Signal-based adjustment calculated at ${(clampedChange * 100).toFixed(2)}%.`);

        // 5. Apply changes to allocations
        for (const alloc of budget.allocations) {
            const adjustment = input.feedback.manualBudgetAdjustment ?? (alloc.totalBudget * clampedChange);
            let newTotal = alloc.totalBudget + adjustment;

            // Ensure we don't drop below the floor
            if (newTotal < this.options.minBudgetFloor) {
                newTotal = this.options.minBudgetFloor;
                adjustmentReasons.push(`Resource "${alloc.resourceType}" hit minimum budget floor.`);
            }

            newAllocations.push({
                ...alloc,
                totalBudget: Number(newTotal.toFixed(2))
            });
        }

        // Update the budget record (in a real system, this would be a mutation or DB update)
        budget.allocations = newAllocations;
        budget.updatedAt = new Date();

        // Record the revision
        budget.revisionHistory.push({
            revisionId: `recal-${Date.now()}`,
            timestamp: new Date(),
            actorId: 'DynamicBudgetEngine',
            reason: adjustmentReasons.join(' | '),
            changes: {
                allocations: { old: previousAllocations, new: newAllocations }
            }
        });

        return {
            agentId: input.agentId,
            budgetId: budget.id,
            previousAllocations,
            newAllocations,
            adjustmentReasons,
            recalibrationTimestamp: new Date()
        };
    }

    /**
     * Combines multiple signals into a single score between -1 and 1 using rule weights.
     */
    private calculatePerformanceSignal(input: RecalibrationInput, rule: AllocationRule): number {
        const { metrics, roi, simulations, feedback, strategicImpact = 0 } = input;
        const { weights } = rule;

        // 1. Performance Signal (0..1 -> -1..1)
        const perfScore = (metrics.successRate * 0.6 + metrics.efficiencyScore * 0.4) * 2 - 1;

        // 2. ROI Signal
        const actualRoiSignal = roi.actualRoi / (1 + Math.abs(roi.actualRoi));
        const projectedRoiSignal = roi.projectedRoi / (1 + Math.abs(roi.projectedRoi));
        const roiScore = actualRoiSignal * 0.7 + projectedRoiSignal * 0.3;

        // 3. Simulation Signal
        const simSuccessAvg = simulations.length > 0
            ? simulations.reduce((acc, s) => acc + s.successProbability, 0) / simulations.length
            : 0.5;
        const simScore = simSuccessAvg * 2 - 1;

        // 4. Human Feedback Signal
        const feedbackScore = (feedback.approvalRate * 2 - 1) * 0.5 + (feedback.sentimentScore * 0.5);

        // 5. Strategic Impact Signal (0..1 -> -1..1)
        const strategicScore = strategicImpact * 2 - 1;

        // Weight the contributors using the learned rule
        const totalSignal =
            (perfScore * weights.performance) +
            (roiScore * weights.roi) +
            (simScore * weights.simulation) +
            (feedbackScore * weights.humanFeedback) +
            (strategicScore * weights.strategicImpact);

        return Math.max(-1, Math.min(1, totalSignal));
    }
}

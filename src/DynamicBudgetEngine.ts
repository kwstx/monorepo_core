import type { AgentBudget, ResourceAllocation, ResourceType } from './models/AgentBudget.js';

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
    metrics: AgentPerformanceMetrics;
    simulations: SandboxSimulationResult[];
    roi: RoiEstimate;
    feedback: HumanFeedback;
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
}

const DEFAULT_OPTIONS: Required<EngineOptions> = {
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
    private options: Required<EngineOptions>;

    constructor(options: EngineOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
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

        // 1. Calculate the Performance Signal (-1 to 1)
        const perfSignal = this.calculatePerformanceSignal(input);

        // 2. Incorporate Human Feedback
        const feedbackSignal = (input.feedback.approvalRate * 2 - 1) * 0.5 + (input.feedback.sentimentScore * 0.5);

        // 3. Aggregate Overall Scaling Factor
        // Combined signal: weights can be adjusted. 
        // Performance metrics (40%), ROI (30%), Feedback (20%), Simulations (10%)
        let combinedSignal = perfSignal;

        // 4. Cooperative Fairness Adjustment
        // High cooperative impact prevents heavy decreases and boosts increases.
        const cooperativeBoost = Math.max(0, input.cooperativeImpactFactor - 1.0);

        // Calculate the percentage change
        let changePercentage = combinedSignal * this.options.learningRate;

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
     * Combines success rate, efficiency, ROI, and simulations into a single signal between -1 and 1.
     */
    private calculatePerformanceSignal(input: RecalibrationInput): number {
        const { metrics, roi, simulations } = input;

        // Metrics signal: Success rate and efficiency (0..1 -> -1..1)
        const metricsSignal = (metrics.successRate * 0.6 + metrics.efficiencyScore * 0.4) * 2 - 1;

        // ROI signal: Positive ROI is good, negative is bad.
        // Normalized ROI: actualRoi / (1 + |actualRoi|) to keep it between -1 and 1
        const actualRoiSignal = roi.actualRoi / (1 + Math.abs(roi.actualRoi));
        const projectedRoiSignal = roi.projectedRoi / (1 + Math.abs(roi.projectedRoi));
        const roiSignal = actualRoiSignal * 0.7 + projectedRoiSignal * 0.3;

        // Simulation signal: Probability of success in future tasks
        const simSuccessAvg = simulations.length > 0
            ? simulations.reduce((acc, s) => acc + s.successProbability, 0) / simulations.length
            : 0.5;
        const simSignal = simSuccessAvg * 2 - 1;

        // Weight the contributors
        const totalSignal = (metricsSignal * 0.4) + (roiSignal * 0.4) + (simSignal * 0.2);

        return Math.max(-1, Math.min(1, totalSignal));
    }
}

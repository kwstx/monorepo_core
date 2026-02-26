import type { AgentBudget, ResourceAllocation } from './models/AgentBudget.js';
import type { OverrideLearningLayer } from './OverrideLearningLayer.js';
/**
 * Performance metrics for an agent over a recalibration period.
 */
export interface AgentPerformanceMetrics {
    successRate: number;
    efficiencyScore: number;
    latencyMs: number;
    reliabilityScore: number;
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
    actualRoi: number;
    projectedRoi: number;
    confidenceInterval: [number, number];
}
/**
 * Human feedback received via overrides or reviews.
 */
export interface HumanFeedback {
    approvalRate: number;
    manualBudgetAdjustment?: number;
    sentimentScore: number;
    notes?: string;
}
/**
 * Aggregated input for the recalibration process.
 */
export interface RecalibrationInput {
    agentId: string;
    actionType?: string;
    metrics: AgentPerformanceMetrics;
    simulations: SandboxSimulationResult[];
    roi: RoiEstimate;
    feedback: HumanFeedback;
    strategicImpact?: number;
    cooperativeImpactFactor: number;
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
    maxIncreasePercentage?: number;
    maxDecreasePercentage?: number;
    minBudgetFloor?: number;
    learningRate?: number;
    overrideLayer?: OverrideLearningLayer;
}
/**
 * DynamicBudgetEngine
 * Periodically recalibrates agent budgets based on multi-dimensional performance signals.
 */
export declare class DynamicBudgetEngine {
    private options;
    constructor(options?: EngineOptions);
    /**
     * Retrieves the current rule set, either from the override layer or defaults.
     */
    private getEffectiveRule;
    /**
     * Recalibrates the budget for a single agent based on incoming performance and feedback data.
     */
    recalibrate(budget: AgentBudget, input: RecalibrationInput): RecalibrationResult;
    /**
     * Combines multiple signals into a single score between -1 and 1 using rule weights.
     */
    private calculatePerformanceSignal;
}
//# sourceMappingURL=DynamicBudgetEngine.d.ts.map
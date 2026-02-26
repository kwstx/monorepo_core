/**
 * Represents weight distribution for different performance dimensions.
 */
export interface AllocationWeights {
    performance: number;
    roi: number;
    simulation: number;
    humanFeedback: number;
    strategicImpact: number;
}
/**
 * A rule set for a specific context (e.g., a specific task category or agent role).
 */
export interface AllocationRule {
    contextId: string;
    weights: AllocationWeights;
    bias: number;
    lastUpdated: Date;
    evidenceCount: number;
}
/**
 * An expert correction or human override record.
 */
export interface ExpertCorrection {
    correctionId: string;
    agentId: string;
    actionType: string;
    originalAdjustment: number;
    overrideAdjustment: number;
    rationale: string;
    timestamp: Date;
    metadata: Record<string, any>;
}
/**
 * OverrideLearningLayer
 * Refines budget allocation rules by learning from human overrides and expert corrections.
 * Bridges the gap between automated engine logic and human strategic intent.
 */
export declare class OverrideLearningLayer {
    private rules;
    private correctionLog;
    private learningRate;
    constructor(learningRate?: number);
    private initializeGlobalRule;
    /**
     * Records a human override and updates the relevant rules.
     */
    recordOverride(correction: ExpertCorrection): void;
    /**
     * Adapts a rule based on the difference between proposed and override values.
     */
    private adaptRule;
    /**
     * Heuristically adjusts weights based on keywords in the human rationale.
     */
    private tuneWeightsByRationale;
    private normalizeWeights;
    /**
     * Retrieves the most specific rule for a given context.
     */
    getEffectiveRule(actionType?: string): AllocationRule;
    getCorrectionLog(): ExpertCorrection[];
}
//# sourceMappingURL=OverrideLearningLayer.d.ts.map
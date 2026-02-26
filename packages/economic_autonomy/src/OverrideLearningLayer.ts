import type { AgentBudget, ResourceAllocation } from './models/AgentBudget.js';

/**
 * Represents weight distribution for different performance dimensions.
 */
export interface AllocationWeights {
    performance: number; // success rate, efficiency
    roi: number;         // actual vs projected ROI
    simulation: number;  // sandbox results
    humanFeedback: number; // historical sentiment/approval
    strategicImpact: number; // long-term value
}

/**
 * A rule set for a specific context (e.g., a specific task category or agent role).
 */
export interface AllocationRule {
    contextId: string; // 'global', 'data_analysis', 'trading', etc.
    weights: AllocationWeights;
    bias: number; // Constant adjustment factor
    lastUpdated: Date;
    evidenceCount: number; // Number of overrides/corrections that shaped this rule
}

/**
 * An expert correction or human override record.
 */
export interface ExpertCorrection {
    correctionId: string;
    agentId: string;
    actionType: string;
    originalAdjustment: number; // The adjustment the engine proposed (%)
    overrideAdjustment: number; // The adjustment the human applied (%)
    rationale: string;
    timestamp: Date;
    metadata: Record<string, any>;
}

/**
 * OverrideLearningLayer
 * Refines budget allocation rules by learning from human overrides and expert corrections.
 * Bridges the gap between automated engine logic and human strategic intent.
 */
export class OverrideLearningLayer {
    private rules: Map<string, AllocationRule> = new Map();
    private correctionLog: ExpertCorrection[] = [];
    private learningRate: number;

    constructor(learningRate: number = 0.1) {
        this.learningRate = learningRate;
        this.initializeGlobalRule();
    }

    private initializeGlobalRule() {
        this.rules.set('global', {
            contextId: 'global',
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
        });
    }

    /**
     * Records a human override and updates the relevant rules.
     */
    public recordOverride(correction: ExpertCorrection): void {
        this.correctionLog.push(correction);

        // 1. Update Global Rule
        this.adaptRule('global', correction);

        // 2. Update/Create Context-Specific Rule
        // This allows the system to learn patterns for "new or unknown task types" 
        // as they become known through corrections.
        this.adaptRule(correction.actionType, correction);
    }

    /**
     * Adapts a rule based on the difference between proposed and override values.
     */
    private adaptRule(contextId: string, correction: ExpertCorrection): void {
        let rule = this.rules.get(contextId);

        if (!rule) {
            // Inherit from global if creating a new specific rule
            const global = this.rules.get('global')!;
            rule = {
                ...global,
                contextId,
                lastUpdated: new Date(),
                evidenceCount: 0
            };
            this.rules.set(contextId, rule);
        }

        const delta = correction.overrideAdjustment - correction.originalAdjustment;

        // Simple learning mechanism: 
        // If the human increased the budget more than the engine, 
        // we slightly increase the 'bias' for this category.
        rule.bias += delta * this.learningRate;

        // In a more complex version, we could perform gradient descent on weights 
        // based on which input feature (ROI, Perf, etc.) was most prominent 
        // during the proposal vs the human rationale.

        // Update weights based on rationale keywords (primitive NLP logic)
        this.tuneWeightsByRationale(rule, correction.rationale);

        rule.evidenceCount++;
        rule.lastUpdated = new Date();
    }

    /**
     * Heuristically adjusts weights based on keywords in the human rationale.
     */
    private tuneWeightsByRationale(rule: AllocationRule, rationale: string): void {
        const text = rationale.toLowerCase();
        const lr = this.learningRate * 0.5;

        if (text.includes('roi') || text.includes('profit') || text.includes('money')) {
            rule.weights.roi += lr;
            this.normalizeWeights(rule.weights);
        }
        if (text.includes('strategic') || text.includes('long-term') || text.includes('future')) {
            rule.weights.strategicImpact += lr;
            this.normalizeWeights(rule.weights);
        }
        if (text.includes('performance') || text.includes('speed') || text.includes('success')) {
            rule.weights.performance += lr;
            this.normalizeWeights(rule.weights);
        }
    }

    private normalizeWeights(weights: AllocationWeights): void {
        const total = weights.performance + weights.roi + weights.simulation + weights.humanFeedback + weights.strategicImpact;
        weights.performance /= total;
        weights.roi /= total;
        weights.simulation /= total;
        weights.humanFeedback /= total;
        weights.strategicImpact /= total;
    }

    /**
     * Retrieves the most specific rule for a given context.
     */
    public getEffectiveRule(actionType?: string): AllocationRule {
        if (actionType && this.rules.has(actionType)) {
            return this.rules.get(actionType)!;
        }
        return this.rules.get('global')!;
    }

    public getCorrectionLog(): ExpertCorrection[] {
        return [...this.correctionLog];
    }
}

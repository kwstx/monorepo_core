const DEFAULT_OPTIONS = {
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
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    /**
     * Retrieves the current rule set, either from the override layer or defaults.
     */
    getEffectiveRule(actionType) {
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
    recalibrate(budget, input) {
        if (budget.agentId !== input.agentId) {
            throw new Error(`Agent ID mismatch: budget belongs to ${budget.agentId} but input is for ${input.agentId}`);
        }
        const previousAllocations = JSON.parse(JSON.stringify(budget.allocations));
        const newAllocations = [];
        const adjustmentReasons = [];
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
        }
        else {
            // Amplify increase for cooperative agents
            changePercentage *= input.cooperativeImpactFactor;
            if (input.cooperativeImpactFactor > 1) {
                adjustmentReasons.push(`Increase amplified by cooperative impact factor of ${input.cooperativeImpactFactor.toFixed(2)}.`);
            }
        }
        // Clamp the change percentage based on engine limits
        const clampedChange = Math.max(-this.options.maxDecreasePercentage, Math.min(this.options.maxIncreasePercentage, changePercentage));
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
    calculatePerformanceSignal(input, rule) {
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
        const totalSignal = (perfScore * weights.performance) +
            (roiScore * weights.roi) +
            (simScore * weights.simulation) +
            (feedbackScore * weights.humanFeedback) +
            (strategicScore * weights.strategicImpact);
        return Math.max(-1, Math.min(1, totalSignal));
    }
}
//# sourceMappingURL=DynamicBudgetEngine.js.map
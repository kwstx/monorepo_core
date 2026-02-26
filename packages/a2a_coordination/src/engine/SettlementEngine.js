"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementEngine = void 0;
/**
 * SettlementEngine
 *
 * Validates task outcomes against contract terms.
 * Automatically releases rewards, applies penalties, adjusts budgets,
 * and updates reputation scores based on performance metrics.
 */
class SettlementEngine {
    reputationModule;
    budgetManager;
    auditSink;
    constructor(reputationModule, budgetManager, auditSink) {
        this.reputationModule = reputationModule;
        this.budgetManager = budgetManager;
        this.auditSink = auditSink;
    }
    /**
     * Processes the settlement for a completed contract.
     */
    processSettlement(contract, outcomes) {
        this.auditSink?.record({
            domain: 'EXECUTION',
            action: 'SETTLEMENT_STARTED',
            outcome: 'INFO',
            contractId: contract.contractId,
            correlationId: contract.correlationId,
            details: {
                status: contract.status,
                submittedOutcomes: outcomes.length
            }
        });
        if (contract.status !== 'COMPLETED' && contract.status !== 'ROLLED_BACK') {
            this.auditSink?.record({
                domain: 'REJECTION',
                action: 'SETTLEMENT_REJECTED',
                outcome: 'FAILURE',
                contractId: contract.contractId,
                correlationId: contract.correlationId,
                details: {
                    reason: `Cannot settle contract in status: ${contract.status}`
                }
            });
            throw new Error(`Cannot settle contract in status: ${contract.status}`);
        }
        const deliverableResults = this.validateDeliverables(contract.deliverables, outcomes);
        const averageFulfillment = deliverableResults.reduce((acc, r) => acc + r.fulfillmentRate, 0) / deliverableResults.length;
        const penalties = this.calculatePenalties(contract.penaltyClauses, deliverableResults);
        const totalPenalty = penalties.reduce((acc, p) => acc + p.amount, 0);
        const baseCompensation = contract.compensation.budget.amount;
        // Release rewards: compensation minus penalties
        // Adjust budget logic: release the remaining balance to the agent
        const rewardsReleased = Math.max(0, baseCompensation - totalPenalty);
        this.auditSink?.record({
            domain: penalties.length > 0 ? 'REJECTION' : 'APPROVAL',
            action: 'SETTLEMENT_ECONOMIC_DECISION',
            outcome: penalties.length > 0 ? 'WARNING' : 'SUCCESS',
            contractId: contract.contractId,
            correlationId: contract.correlationId,
            details: {
                penalties,
                totalPenalty,
                rewardsReleased
            }
        });
        // Update economic tracking
        contract.participatingAgents.forEach(agentId => {
            // Apply rewards to each agent if they share the pot? 
            // In this simple model, we'll assume rewards go to all participants or split them.
            // Let's assume rewardsReleased is the total pot to be distributed.
            // For simplicity, we'll credit the lead agent or split among all.
            const share = rewardsReleased / contract.participatingAgents.length;
            const penaltyShare = totalPenalty / contract.participatingAgents.length;
            if (totalPenalty > 0) {
                this.budgetManager.applyPenalty(agentId, penaltyShare, contract.contractId);
            }
            if (rewardsReleased > 0) {
                this.budgetManager.releaseReward(agentId, share, contract.contractId);
            }
            // Finalize any pre-allocated budget
            this.budgetManager.finalizeAllocation(agentId, baseCompensation / contract.participatingAgents.length, baseCompensation / contract.participatingAgents.length, contract.contractId);
        });
        // Calculate metrics for Reputation
        const reliability = averageFulfillment;
        const economicPerformance = rewardsReleased / (baseCompensation || 1);
        const cooperativeImpact = contract.status === 'COMPLETED' ? 1.0 : 0.0;
        const timestamp = new Date().toISOString();
        // We pick the first agent as representative or record for each
        const reputationUpdates = contract.participatingAgents.map(agentId => ({
            agentId,
            correlationId: contract.correlationId,
            timestamp,
            outcome: contract.status === 'COMPLETED' ? (averageFulfillment > 0.8 ? 'SUCCESS' : 'PARTIAL') : 'FAILURE',
            reliability,
            economicPerformance,
            cooperativeImpact
        }));
        reputationUpdates.forEach(update => this.reputationModule.recordOutcome(update));
        const report = {
            contractId: contract.contractId,
            performanceScore: averageFulfillment,
            deliverableResults,
            penaltiesApplied: penalties,
            rewardsReleased,
            finalReputationUpdate: reputationUpdates[0], // Return the first one for the report
            timestamp
        };
        this.auditSink?.record({
            domain: 'EXECUTION',
            action: 'SETTLEMENT_COMPLETED',
            outcome: contract.status === 'COMPLETED' ? 'SUCCESS' : 'FAILURE',
            contractId: contract.contractId,
            correlationId: contract.correlationId,
            details: {
                performanceScore: averageFulfillment,
                penaltiesApplied: penalties.length,
                rewardsReleased
            }
        });
        return report;
    }
    validateDeliverables(targets, actuals) {
        return targets.map(target => {
            const actual = actuals.find(a => a.name === target.name);
            if (!actual) {
                return {
                    name: target.name,
                    target: target.targetValue,
                    actual: 'N/A',
                    status: 'FAILED',
                    fulfillmentRate: 0
                };
            }
            let fulfillmentRate = 0;
            if (typeof target.targetValue === 'number' && typeof actual.actualValue === 'number') {
                fulfillmentRate = Math.min(1, actual.actualValue / target.targetValue);
            }
            else if (target.targetValue === actual.actualValue) {
                fulfillmentRate = 1.0;
            }
            return {
                name: target.name,
                target: target.targetValue,
                actual: actual.actualValue,
                status: fulfillmentRate >= 1 ? 'MET' : (fulfillmentRate > 0 ? 'PARTIAL' : 'FAILED'),
                fulfillmentRate
            };
        });
    }
    calculatePenalties(clauses, results) {
        const penalties = [];
        results.forEach(res => {
            if (res.status !== 'MET') {
                // Check for applicable penalty clauses
                // This is a simplified matching; a real engine would match violationType to metric
                const applicableClause = clauses.find(c => c.violationType.toLowerCase().includes(res.name.toLowerCase()) ||
                    c.violationType === 'QUALITY_FAILURE');
                if (applicableClause) {
                    const penaltyImpact = (1 - res.fulfillmentRate) * applicableClause.penaltyAmount.amount;
                    if (penaltyImpact > 0) {
                        penalties.push({
                            violationType: applicableClause.violationType,
                            amount: penaltyImpact,
                            reason: `Fulfillment rate for ${res.name} was only ${Math.round(res.fulfillmentRate * 100)}%`
                        });
                    }
                }
            }
        });
        return penalties;
    }
}
exports.SettlementEngine = SettlementEngine;

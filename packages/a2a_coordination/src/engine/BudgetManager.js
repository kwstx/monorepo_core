"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetManager = void 0;
class BudgetManager {
    budgets = new Map();
    transactions = [];
    registerAgent(agentId, initialBalance, currency = 'STAKE') {
        if (!this.budgets.has(agentId)) {
            this.budgets.set(agentId, {
                agentId,
                balance: initialBalance,
                currency,
                allocated: 0,
                totalEarned: 0,
                totalSpent: 0
            });
        }
    }
    getBudget(agentId) {
        return this.budgets.get(agentId);
    }
    allocate(agentId, amount, referenceId) {
        const budget = this.budgets.get(agentId);
        if (!budget || budget.balance < amount)
            return false;
        budget.balance -= amount;
        budget.allocated += amount;
        this.recordTransaction(agentId, -amount, 'ALLOCATION', referenceId);
        return true;
    }
    releaseReward(agentId, amount, referenceId) {
        const budget = this.budgets.get(agentId);
        if (!budget)
            return;
        budget.balance += amount;
        budget.totalEarned += amount;
        this.recordTransaction(agentId, amount, 'REWARD', referenceId);
    }
    applyPenalty(agentId, amount, referenceId) {
        const budget = this.budgets.get(agentId);
        if (!budget)
            return;
        // Penalty can lead to negative balance if allowed, or just deduct
        budget.balance -= amount;
        budget.totalSpent += amount; // Penalties count as "spent" or loss
        this.recordTransaction(agentId, -amount, 'PENALTY', referenceId);
    }
    finalizeAllocation(agentId, amount, actualSpent, referenceId) {
        const budget = this.budgets.get(agentId);
        if (!budget)
            return;
        budget.allocated -= amount;
        const refund = amount - actualSpent;
        if (refund > 0) {
            budget.balance += refund;
            this.recordTransaction(agentId, refund, 'CREDIT', referenceId);
        }
        budget.totalSpent += actualSpent;
    }
    recordTransaction(agentId, amount, type, referenceId) {
        this.transactions.push({
            transactionId: `tx_${Math.random().toString(36).substr(2, 9)}`,
            agentId,
            amount,
            type,
            referenceId,
            timestamp: new Date().toISOString()
        });
    }
    getTransactionsForAgent(agentId) {
        return this.transactions.filter(tx => tx.agentId === agentId);
    }
    getProjectPnL(contractId) {
        return this.transactions
            .filter(tx => tx.referenceId === contractId)
            .reduce((sum, tx) => sum + tx.amount, 0);
    }
}
exports.BudgetManager = BudgetManager;

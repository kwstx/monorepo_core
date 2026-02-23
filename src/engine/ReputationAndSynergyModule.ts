
import { AgentCoordinationMessage } from '../schema/MessageSchema';
import {
    CollaborationRecord,
    ReputationScore,
    SynergyMetrics
} from '../schema/ReputationSchema';
import { ReputationProvider } from './NegotiationEngine';

/**
 * ReputationAndSynergyModule
 * 
 * Scores agents based on historical performance and cooperative impact.
 * Influences coordination priority and trust thresholds without central control.
 */
export class ReputationAndSynergyModule implements ReputationProvider {
    private history: CollaborationRecord[] = [];
    private agentScores: Map<string, ReputationScore> = new Map();
    private synergyLinks: Map<string, SynergyMetrics> = new Map();

    /**
     * Records a new collaboration outcome and recalculates scores.
     */
    public recordOutcome(record: CollaborationRecord): void {
        this.history.push(record);
        this.updateAgentScore(record.agentId);
    }

    /**
     * Implements ReputationProvider interface for NegotiationEngine.
     */
    public getScore(agentId: string): number {
        return this.agentScores.get(agentId)?.globalScore ?? 0.5; // Default to neutral
    }

    /**
     * Detailed reputation retrieval.
     */
    public getReputation(agentId: string): ReputationScore | undefined {
        return this.agentScores.get(agentId);
    }

    /**
     * Calculates a "Trust Threshold" for a specific transaction.
     * If the agent's reputation is low, they might need higher collateral or lower budget limits.
     */
    public getTrustThreshold(agentId: string, budgetRequested: number): number {
        const score = this.getScore(agentId);

        // Simple heuristic: agents with higher scores can handle larger budgets
        // Base threshold is 0.5. Higher score reduces the required "trust level"
        const requiredScore = Math.min(0.95, 0.4 + (budgetRequested / 1000000) * 0.1);

        return requiredScore;
    }

    /**
     * Influences negotiation weighting by providing a synergy multiplier.
     * High synergy between agents can justify lower ROI requirements.
     */
    public getSynergyMultiplier(agentA: string, agentB: string): number {
        const key = this.getSynergyKey(agentA, agentB);
        const metrics = this.synergyLinks.get(key);

        if (!metrics) return 1.0;

        // Boost synergy if they have worked well together before
        return 1.0 + (metrics.compatibilityScore * 0.2);
    }

    /**
     * Validates if a commitment should be prioritized or gated based on reputation.
     */
    public validateCommitmentPriority(message: AgentCoordinationMessage): {
        priority: 'HIGH' | 'NORMAL' | 'LOW';
        requiresEscrow: boolean;
    } {
        const score = this.getScore(message.sender.id);

        if (score > 0.8) {
            return { priority: 'HIGH', requiresEscrow: false };
        } else if (score < 0.4) {
            return { priority: 'LOW', requiresEscrow: true };
        }

        return { priority: 'NORMAL', requiresEscrow: false };
    }

    private updateAgentScore(agentId: string): void {
        const agentHistory = this.history.filter(r => r.agentId === agentId);
        if (agentHistory.length === 0) return;

        const successes = agentHistory.filter(r => r.outcome === 'SUCCESS').length;
        const historicalSuccessRate = successes / agentHistory.length;

        const averageReliability = agentHistory.reduce((acc, r) => acc + r.reliability, 0) / agentHistory.length;
        const economicEfficiency = agentHistory.reduce((acc, r) => acc + r.economicPerformance, 0) / agentHistory.length;
        const synergyBonus = agentHistory.reduce((acc, r) => acc + r.cooperativeImpact, 0) / agentHistory.length;

        // Weighted aggregation
        const globalScore = (
            historicalSuccessRate * 0.4 +
            averageReliability * 0.3 +
            economicEfficiency * 0.2 +
            synergyBonus * 0.1
        );

        this.agentScores.set(agentId, {
            agentId,
            globalScore,
            metrics: {
                historicalSuccessRate,
                averageReliability,
                economicEfficiency,
                synergyBonus
            },
            totalCollaborations: agentHistory.length,
            lastUpdated: new Date().toISOString()
        });
    }

    private getSynergyKey(a: string, b: string): string {
        return [a, b].sort().join(':');
    }

    /**
     * Manually record or update synergy metrics between two agents.
     */
    public updateSynergy(agentA: string, agentB: string, compatibility: number): void {
        const key = this.getSynergyKey(agentA, agentB);
        const existing = this.synergyLinks.get(key) ?? {
            agentA,
            agentB,
            sharedSuccessCount: 0,
            compatibilityScore: 0
        };

        existing.sharedSuccessCount++;
        existing.compatibilityScore = (existing.compatibilityScore + compatibility) / 2;
        this.synergyLinks.set(key, existing);
    }

    /**
     * Snapshot of historical records for downstream analytics modules.
     */
    public getHistorySnapshot(): CollaborationRecord[] {
        return [...this.history];
    }

    /**
     * Snapshot of known pairwise synergy links.
     */
    public getSynergySnapshot(): SynergyMetrics[] {
        return Array.from(this.synergyLinks.values()).map(link => ({ ...link }));
    }

    /**
     * Returns all known agents from history and synergy data.
     */
    public getKnownAgents(): string[] {
        const fromHistory = this.history.map(record => record.agentId);
        const fromSynergy = Array.from(this.synergyLinks.values()).flatMap(link => [link.agentA, link.agentB]);
        return Array.from(new Set([...fromHistory, ...fromSynergy]));
    }
}

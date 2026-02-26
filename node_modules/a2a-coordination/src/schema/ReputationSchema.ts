
/**
 * Reputation and Synergy Schema
 * Defines the metrics and records used to score agents.
 */

export interface CollaborationRecord {
    agentId: string;
    correlationId: string;
    timestamp: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    reliability: number;          // 0.0 to 1.0 (e.g., milestone fulfillment rate)
    economicPerformance: number;  // 0.0 to 1.0 (e.g., ROI target achievement)
    cooperativeImpact: number;    // 0.0 to 1.0 (e.g., synergy score contribution)
    feedback?: string;
}

export interface ReputationScore {
    agentId: string;
    globalScore: number;          // Aggregated score (0.0 to 1.0)
    metrics: {
        historicalSuccessRate: number;
        averageReliability: number;
        economicEfficiency: number;
        synergyBonus: number;
    };
    totalCollaborations: number;
    lastUpdated: string;
}

export interface SynergyMetrics {
    agentA: string;
    agentB: string;
    sharedSuccessCount: number;
    compatibilityScore: number;   // How well these two work together
}

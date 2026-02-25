import type { AgentBudget, ResourceType } from './models/AgentBudget.js';
import { PnLTracker } from './PnLTracker.js';
/**
 * Represents a shared financial pool for multiple agents.
 */
export interface TreasuryPool {
    id: string;
    name: string;
    totalAmount: number;
    resourceType: ResourceType;
    unit: string;
    participants: Set<string>;
    contributionWeight: Map<string, number>;
    metadata: Record<string, any>;
}
/**
 * Represents a project that multiple agents are cooperating on.
 */
export interface JointProject {
    id: string;
    name: string;
    description: string;
    estimatedROI: number;
    requiredFunding: number;
    currentFunding: number;
    involvedAgents: string[];
    cooperationFactor: number;
    status: 'funding' | 'active' | 'reconciled';
}
/**
 * TreasuryEngine configuration.
 */
export interface TreasuryOptions {
    minContributionThreshold: number;
    rewardScalingMultiplier: number;
}
/**
 * TreasuryEngine
 * Manages pooled resources, proportional contributions, and ROI-weighted project funding.
 */
export declare class TreasuryEngine {
    private pools;
    private projects;
    private pnlTracker;
    private options;
    constructor(pnlTracker: PnLTracker, options?: Partial<TreasuryOptions>);
    /**
     * Creates a new shared treasury pool.
     */
    createPool(id: string, name: string, resourceType: ResourceType, unit: string): TreasuryPool;
    /**
     * Facilitates a proportional contribution from an agent to a pool using their "unused" budget.
     * @param budget The agent's budget record to draw from.
     * @param poolId The ID of the pool receiving funds.
     * @param contributionPercentage Percentage of remaining/unused budget to contribute (0..1).
     */
    contributeFromUnused(budget: AgentBudget, poolId: string, contributionPercentage: number): number;
    /**
     * Proposes a joint project for funding.
     */
    proposeProject(project: JointProject): void;
    /**
     * Allocates funds from a pool to proposed projects using ROI-weighted logic.
     * Projects with higher estimated ROI and cooperation factors get priority and larger shares.
     */
    allocatePoolFunds(poolId: string): string[];
    /**
     * Reconciles a project once it completes, applying cooperative reward scaling.
     * Rewards are scaled by the cooperation factor and redistributed to participants.
     */
    reconcileProject(projectId: string, realizedGain: number): void;
    getPool(id: string): TreasuryPool | undefined;
}
//# sourceMappingURL=TreasuryEngine.d.ts.map
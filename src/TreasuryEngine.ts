import type { AgentBudget, ResourceAllocation, ResourceType } from './models/AgentBudget.js';
import { PnLTracker, type ActionPnLInput } from './PnLTracker.js';

/**
 * Represents a shared financial pool for multiple agents.
 */
export interface TreasuryPool {
    id: string;
    name: string;
    totalAmount: number;
    resourceType: ResourceType;
    unit: string;
    participants: Set<string>; // Agent IDs
    contributionWeight: Map<string, number>; // AgentID -> Proportion of contribution
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
    cooperationFactor: number; // 1.0 (low) to 5.0 (high) based on synergy
    status: 'funding' | 'active' | 'reconciled';
}

/**
 * TreasuryEngine configuration.
 */
export interface TreasuryOptions {
    minContributionThreshold: number;
    rewardScalingMultiplier: number; // Base factor for cooperative reward scaling
}

/**
 * TreasuryEngine
 * Manages pooled resources, proportional contributions, and ROI-weighted project funding.
 */
export class TreasuryEngine {
    private pools: Map<string, TreasuryPool> = new Map();
    private projects: Map<string, JointProject> = new Map();
    private pnlTracker: PnLTracker;
    private options: TreasuryOptions;

    constructor(pnlTracker: PnLTracker, options: Partial<TreasuryOptions> = {}) {
        this.pnlTracker = pnlTracker;
        this.options = {
            minContributionThreshold: options.minContributionThreshold ?? 1.0,
            rewardScalingMultiplier: options.rewardScalingMultiplier ?? 1.5
        };
    }

    /**
     * Creates a new shared treasury pool.
     */
    public createPool(id: string, name: string, resourceType: ResourceType, unit: string): TreasuryPool {
        const pool: TreasuryPool = {
            id,
            name,
            totalAmount: 0,
            resourceType,
            unit,
            participants: new Set(),
            contributionWeight: new Map(),
            metadata: {}
        };
        this.pools.set(id, pool);
        return pool;
    }

    /**
     * Facilitates a proportional contribution from an agent to a pool using their "unused" budget.
     * @param budget The agent's budget record to draw from.
     * @param poolId The ID of the pool receiving funds.
     * @param contributionPercentage Percentage of remaining/unused budget to contribute (0..1).
     */
    public contributeFromUnused(
        budget: AgentBudget,
        poolId: string,
        contributionPercentage: number
    ): number {
        const pool = this.pools.get(poolId);
        if (!pool) throw new Error(`Pool ${poolId} not found.`);

        const allocation = budget.allocations.find(a => a.resourceType === pool.resourceType);
        if (!allocation) throw new Error(`Agent ${budget.agentId} has no allocation for ${pool.resourceType}`);

        const unused = allocation.totalBudget - (allocation.spentBudget + allocation.pendingAllocations);
        if (unused <= this.options.minContributionThreshold) return 0;

        const amountToContribute = Number((unused * Math.min(1, Math.max(0, contributionPercentage))).toFixed(2));

        if (amountToContribute > 0) {
            // Deduct from agent (in-memory update)
            allocation.spentBudget += amountToContribute;

            // Add to pool
            pool.totalAmount += amountToContribute;
            pool.participants.add(budget.agentId);

            // Track proportional weight
            const currentWeight = pool.contributionWeight.get(budget.agentId) ?? 0;
            pool.contributionWeight.set(budget.agentId, currentWeight + amountToContribute);

            // Update budget record updatedAt
            budget.updatedAt = new Date();
            budget.revisionHistory.push({
                revisionId: `pool-contrib-${Date.now()}`,
                timestamp: new Date(),
                actorId: 'TreasuryEngine',
                reason: `Contributed to pool ${pool.name} from unused budget.`,
                changes: {
                    spentBudget: { old: allocation.spentBudget - amountToContribute, new: allocation.spentBudget }
                }
            });

            // Log pool contribution in PnLTracker for transparency
            this.pnlTracker.recordExecutedAction({
                actionId: `contrib-${Date.now()}`,
                agentId: budget.agentId,
                actionType: 'pool_contribution',
                status: 'executed',
                revenue: 0,
                directCosts: amountToContribute,
                opportunityCosts: 0,
                cooperativeContributions: [{
                    projectId: poolId,
                    contributionValue: amountToContribute,
                    notes: `Pool growth: ${pool.name}`
                }],
                longTermStrategicImpact: amountToContribute * 0.1, // Small strategic boost for cooperation
                metadata: { poolId, resourceType: pool.resourceType }
            });
        }

        return amountToContribute;
    }

    /**
     * Proposes a joint project for funding.
     */
    public proposeProject(project: JointProject): void {
        this.projects.set(project.id, project);
    }

    /**
     * Allocates funds from a pool to proposed projects using ROI-weighted logic.
     * Projects with higher estimated ROI and cooperation factors get priority and larger shares.
     */
    public allocatePoolFunds(poolId: string): string[] {
        const pool = this.pools.get(poolId);
        if (!pool || pool.totalAmount <= 0) return [];

        const pendingProjects = Array.from(this.projects.values())
            .filter(p => p.status === 'funding' && p.currentFunding < p.requiredFunding);

        if (pendingProjects.length === 0) return [];

        // Calculate project scores based on ROI and Cooperative Factor
        const scoredProjects = pendingProjects.map(p => ({
            id: p.id,
            score: p.estimatedROI * p.cooperationFactor,
            remaining: p.requiredFunding - p.currentFunding
        }));

        const totalScore = scoredProjects.reduce((sum, p) => sum + p.score, 0);
        const fundedProjectIds: string[] = [];

        // Sort by ROI descending for priority
        scoredProjects.sort((a, b) => b.score - a.score);

        for (const p of scoredProjects) {
            if (pool.totalAmount <= 0) break;

            // ROI-weighted share calculation
            const rawShare = (p.score / totalScore) * pool.totalAmount;
            const allocationAmount = Math.min(rawShare, p.remaining, pool.totalAmount);

            if (allocationAmount > 0) {
                const project = this.projects.get(p.id)!;
                project.currentFunding += allocationAmount;
                pool.totalAmount -= allocationAmount;

                if (project.currentFunding >= project.requiredFunding) {
                    project.status = 'active';
                }

                fundedProjectIds.push(project.id);

                // Log the pool allocation in PnLTracker
                this.pnlTracker.recordExecutedAction({
                    actionId: `pool-alloc-${Date.now()}`,
                    agentId: 'TreasurySystem',
                    actionType: 'pool_allocation',
                    status: 'executed',
                    revenue: 0,
                    directCosts: allocationAmount,
                    opportunityCosts: 0,
                    cooperativeContributions: project.involvedAgents.map(agentId => ({
                        projectId: project.id,
                        contributionValue: (allocationAmount / project.involvedAgents.length),
                        notes: `Joint allocation for ${project.name}`
                    })),
                    longTermStrategicImpact: allocationAmount * project.cooperationFactor * 0.2,
                    metadata: { poolId, projectId: project.id, roi: project.estimatedROI }
                });
            }
        }

        return fundedProjectIds;
    }

    /**
     * Reconciles a project once it completes, applying cooperative reward scaling.
     * Rewards are scaled by the cooperation factor and redistributed to participants.
     */
    public reconcileProject(projectId: string, realizedGain: number): void {
        const project = this.projects.get(projectId);
        if (!project || project.status !== 'active') return;

        // Apply cooperative reward scaling
        const scaledReward = realizedGain * (1 + (project.cooperationFactor - 1) * 0.5 * this.options.rewardScalingMultiplier);
        const rewardPerAgent = scaledReward / project.involvedAgents.length;

        project.status = 'reconciled';

        for (const agentId of project.involvedAgents) {
            // Record the scaled reward for each agent
            this.pnlTracker.recordExecutedAction({
                actionId: `project-reward-${Date.now()}-${agentId}`,
                agentId: agentId,
                actionType: 'joint_project_reward',
                status: 'executed',
                revenue: rewardPerAgent,
                directCosts: 0,
                opportunityCosts: 0,
                cooperativeContributions: [],
                longTermStrategicImpact: realizedGain * 0.1,
                metadata: {
                    projectId: project.id,
                    originalGain: realizedGain / project.involvedAgents.length,
                    scalingFactor: scaledReward / realizedGain
                }
            });
        }
    }

    public getPool(id: string): TreasuryPool | undefined {
        return this.pools.get(id);
    }
}

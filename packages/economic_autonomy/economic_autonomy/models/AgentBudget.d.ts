/**
 * Represents the types of resources that can be allocated to an agent.
 * Extending this with custom strings allows for future resource types.
 */
export type ResourceType = 'compute' | 'api_calls' | 'monetary' | string;
/**
 * Defines the period after which a budget resets.
 */
export type RenewalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';
/**
 * Temporal constraints for a budget allocation.
 */
export interface TemporalConstraints {
    startDate: Date;
    endDate?: Date;
    renewalPeriod: RenewalPeriod;
}
/**
 * Specific allocation for a single resource type.
 */
export interface ResourceAllocation {
    resourceType: ResourceType;
    totalBudget: number;
    spentBudget: number;
    pendingAllocations: number;
    unit: string;
}
/**
 * Delegation constraints for a child/sub-agent budget inherited from a parent budget.
 */
export interface DelegationConstraints {
    parentBudgetId: string;
    parentAgentId: string;
    inheritedResourceLimits: Record<ResourceType, number>;
}
/**
 * Record of a revision made to the agent's budget.
 */
export interface BudgetRevision {
    revisionId: string;
    timestamp: Date;
    actorId: string;
    reason: string;
    changes: Record<string, {
        old: any;
        new: any;
    }>;
}
/**
 * AgentBudget Data Model
 * Tracks and manages per-agent allocations, predictions, and cross-agent pooling.
 */
export interface AgentBudget {
    id: string;
    agentId: string;
    /**
     * List of resource allocations.
     * Array structure allows for multiple resource types and easy extensibility.
     */
    allocations: ResourceAllocation[];
    /**
     * Time-based rules for when the budget is valid and how it renews.
     */
    temporalConstraints: TemporalConstraints;
    /**
     * Audit trail of all modifications to this budget.
     */
    revisionHistory: BudgetRevision[];
    /**
     * ID of a shared treasury or pool.
     * If present, this agent draws from a collective resource pool.
     */
    poolingId?: string;
    /**
     * Present when this budget is delegated from a parent agent.
     * Inherited limits cap how much this budget can ever allocate per resource.
     */
    delegation?: DelegationConstraints;
    /**
     * Status of the budget (e.g., "active", "suspended", "exhausted")
     */
    status: 'active' | 'suspended' | 'exhausted' | 'pending_approval';
    /**
     * For additional extensible data without schema changes.
     */
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=AgentBudget.d.ts.map
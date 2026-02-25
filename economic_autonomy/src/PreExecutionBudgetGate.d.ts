import type { AgentBudget, ResourceType } from './models/AgentBudget.js';
export type GateDecision = 'allow' | 'flag' | 'block';
export interface CooperativeContribution {
    contributorAgentId: string;
    resourceType: ResourceType;
    amount: number;
    confidence: number;
    notes?: string;
}
export interface DownstreamImpactPrediction {
    scenario: string;
    probability: number;
    expectedAdditionalCost: number;
    expectedBenefit: number;
    notes?: string;
}
export interface ProposedAgentAction {
    actionId: string;
    agentId: string;
    actionType: string;
    description: string;
    resourceType: ResourceType;
    estimatedCost: number;
    projectedReturn?: number;
    cooperativeContributions?: CooperativeContribution[];
    predictedDownstreamImpact?: DownstreamImpactPrediction[];
    metadata?: Record<string, unknown>;
}
export interface AllocationSnapshot {
    resourceType: ResourceType;
    totalBudget: number;
    spentBudget: number;
    pendingAllocations: number;
    remainingBudget: number;
    estimatedCost: number;
    utilizationAfterAction: number;
    unit: string;
}
export interface PredictiveAssessment {
    expectedRoi: number;
    cooperativeSynergy: number;
    downstreamImpactScore: number;
    compositePriorityScore: number;
    dynamicBudgetMultiplier: number;
    baselineRemainingBudget: number;
    effectiveAvailableBudget: number;
    weightedCooperativeSupport: number;
}
export interface BlockedActionLog {
    timestamp: string;
    gate: 'PreExecutionBudgetGate';
    severity: 'error';
    budgetId: string;
    agentId: string;
    poolingId?: string | undefined;
    action: ProposedAgentAction;
    allocation: AllocationSnapshot;
    decisionReason: string[];
    predictedDownstreamImpact: {
        totalExpectedAdditionalCost: number;
        totalExpectedBenefit: number;
        scenarios: DownstreamImpactPrediction[];
    };
    cooperativeContributions: {
        weightedSupport: number;
        contributors: CooperativeContribution[];
    };
    predictiveAssessment: PredictiveAssessment;
    potentialRoiLost: number;
}
export interface GateEvaluationResult {
    decision: GateDecision;
    reasons: string[];
    allocationSnapshot: AllocationSnapshot;
    predictiveAssessment: PredictiveAssessment;
    blockedLog?: BlockedActionLog;
}
export interface GateOptions {
    flagUtilizationThreshold?: number;
    parentBudget?: AgentBudget;
    logger?: (entry: BlockedActionLog) => void;
}
export declare function PreExecutionBudgetGate(budget: AgentBudget, action: ProposedAgentAction, options?: GateOptions): GateEvaluationResult;
//# sourceMappingURL=PreExecutionBudgetGate.d.ts.map
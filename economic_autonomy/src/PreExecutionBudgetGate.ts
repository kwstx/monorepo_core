import { Logger } from '@shared/logger';
import type { AgentBudget, ResourceAllocation, ResourceType } from './models/AgentBudget.js';

export type GateDecision = 'allow' | 'flag' | 'block';

export interface CooperativeContribution {
  contributorAgentId: string;
  resourceType: ResourceType;
  amount: number;
  confidence: number; // 0..1
  notes?: string;
}

export interface DownstreamImpactPrediction {
  scenario: string;
  probability: number; // 0..1
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
  cooperativeSynergy: number; // 0..1
  downstreamImpactScore: number; // 0..1
  compositePriorityScore: number; // 0..1
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
  flagUtilizationThreshold?: number; // 0..1
  parentBudget?: AgentBudget;
  logger?: (entry: BlockedActionLog) => void;
}

const DEFAULT_FLAG_UTILIZATION_THRESHOLD = 0.8;

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getRemainingBudget(allocation: ResourceAllocation): number {
  return allocation.totalBudget - allocation.spentBudget - allocation.pendingAllocations;
}

function getDelegationCappedTotal(
  budget: AgentBudget,
  allocation: ResourceAllocation,
  parentBudget?: AgentBudget
): number {
  const inheritedLimit = budget.delegation?.inheritedResourceLimits[allocation.resourceType];
  if (inheritedLimit === undefined) {
    return allocation.totalBudget;
  }

  let cappedTotal = Math.min(allocation.totalBudget, inheritedLimit);
  if (parentBudget) {
    const parentAllocation = findAllocation(parentBudget, allocation.resourceType);
    if (parentAllocation) {
      cappedTotal = Math.min(cappedTotal, getRemainingBudget(parentAllocation));
    }
  }

  return cappedTotal;
}

function findAllocation(budget: AgentBudget, resourceType: ResourceType): ResourceAllocation | undefined {
  return budget.allocations.find((allocation) => allocation.resourceType === resourceType);
}

function aggregateDownstreamImpact(predictions: DownstreamImpactPrediction[] = []): {
  totalExpectedAdditionalCost: number;
  totalExpectedBenefit: number;
} {
  return predictions.reduce(
    (acc, item) => {
      const probability = clampProbability(item.probability);
      acc.totalExpectedAdditionalCost += item.expectedAdditionalCost * probability;
      acc.totalExpectedBenefit += item.expectedBenefit * probability;
      return acc;
    },
    { totalExpectedAdditionalCost: 0, totalExpectedBenefit: 0 }
  );
}

function computeWeightedSupport(contributions: CooperativeContribution[] = []): number {
  return contributions.reduce((total, contribution) => {
    const confidence = clampProbability(contribution.confidence);
    return total + contribution.amount * confidence;
  }, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildPredictiveAssessment(
  action: ProposedAgentAction,
  baselineRemainingBudget: number
): PredictiveAssessment {
  const impact = aggregateDownstreamImpact(action.predictedDownstreamImpact);
  const weightedCooperativeSupport = computeWeightedSupport(action.cooperativeContributions);
  const contributorCount = new Set((action.cooperativeContributions ?? []).map((item) => item.contributorAgentId)).size;

  const expectedDownstreamNet = impact.totalExpectedBenefit - impact.totalExpectedAdditionalCost;
  const directProjectedNet = (action.projectedReturn ?? 0) - action.estimatedCost;
  const expectedNetValue = directProjectedNet + expectedDownstreamNet;
  const expectedRoi = action.estimatedCost <= 0 ? 0 : expectedNetValue / action.estimatedCost;

  const normalizedSupport = action.estimatedCost <= 0 ? 0 : weightedCooperativeSupport / action.estimatedCost;
  const collaborationDiversity = clamp(contributorCount / 3, 0, 1);
  const cooperativeSynergy = clamp((normalizedSupport * 0.7) + (collaborationDiversity * 0.3), 0, 1);

  const impactDenominator = impact.totalExpectedBenefit + impact.totalExpectedAdditionalCost + Math.max(action.estimatedCost, 1);
  const downstreamImpactScore = impactDenominator <= 0 ? 0 : clamp(impact.totalExpectedBenefit / impactDenominator, 0, 1);

  const roiSignal = Math.tanh(expectedRoi);
  const positiveRoiBoost = Math.max(0, roiSignal) * 0.35;
  const negativeRoiPenalty = Math.max(0, -roiSignal) * 0.35;
  const synergyBoost = cooperativeSynergy * 0.2;
  const downstreamBoost = downstreamImpactScore * 0.15;

  const dynamicBudgetMultiplier = clamp(
    1 + positiveRoiBoost + synergyBoost + downstreamBoost - negativeRoiPenalty,
    0.7,
    1.6
  );

  const effectiveAvailableBudget = Math.max(
    0,
    (baselineRemainingBudget * dynamicBudgetMultiplier) + weightedCooperativeSupport
  );

  const normalizedRoiScore = (roiSignal + 1) / 2;
  const compositePriorityScore = clamp(
    (normalizedRoiScore * 0.55) + (cooperativeSynergy * 0.25) + (downstreamImpactScore * 0.2),
    0,
    1
  );

  return {
    expectedRoi,
    cooperativeSynergy,
    downstreamImpactScore,
    compositePriorityScore,
    dynamicBudgetMultiplier,
    baselineRemainingBudget,
    effectiveAvailableBudget,
    weightedCooperativeSupport
  };
}

export function PreExecutionBudgetGate(
  budget: AgentBudget,
  action: ProposedAgentAction,
  options: GateOptions = {}
): GateEvaluationResult {
  const threshold = options.flagUtilizationThreshold ?? DEFAULT_FLAG_UTILIZATION_THRESHOLD;
  const parentBudget = options.parentBudget;
  const logger = options.logger ?? ((entry: BlockedActionLog) => Logger.warn(`[PreExecutionBudgetGate] ${JSON.stringify(entry, null, 2)}`));

  const allocation = findAllocation(budget, action.resourceType);

  if (!allocation) {
    const snapshot: AllocationSnapshot = {
      resourceType: action.resourceType,
      totalBudget: 0,
      spentBudget: 0,
      pendingAllocations: 0,
      remainingBudget: 0,
      estimatedCost: action.estimatedCost,
      utilizationAfterAction: 1,
      unit: 'unknown'
    };

    const reason = `No allocation found for resource type "${action.resourceType}".`;
    const impact = aggregateDownstreamImpact(action.predictedDownstreamImpact);
    const predictiveAssessment = buildPredictiveAssessment(action, 0);
    const blockedLog: BlockedActionLog = {
      timestamp: new Date().toISOString(),
      gate: 'PreExecutionBudgetGate',
      severity: 'error',
      budgetId: budget.id,
      agentId: budget.agentId,
      poolingId: budget.poolingId,
      action,
      allocation: snapshot,
      decisionReason: [reason],
      predictedDownstreamImpact: {
        ...impact,
        scenarios: action.predictedDownstreamImpact ?? []
      },
      cooperativeContributions: {
        weightedSupport: predictiveAssessment.weightedCooperativeSupport,
        contributors: action.cooperativeContributions ?? []
      },
      predictiveAssessment,
      potentialRoiLost: Math.max(0, (action.projectedReturn ?? 0) - action.estimatedCost)
    };

    logger(blockedLog);

    return {
      decision: 'block',
      reasons: [reason],
      allocationSnapshot: snapshot,
      predictiveAssessment,
      blockedLog
    };
  }

  const cappedTotalBudget = getDelegationCappedTotal(budget, allocation, parentBudget);
  const remainingBudget = cappedTotalBudget - allocation.spentBudget - allocation.pendingAllocations;
  const predictiveAssessment = buildPredictiveAssessment(action, remainingBudget);
  const effectiveAvailableBudget = predictiveAssessment.effectiveAvailableBudget;
  const utilizationAfterAction = cappedTotalBudget <= 0
    ? 1
    : (allocation.spentBudget + allocation.pendingAllocations + action.estimatedCost) / cappedTotalBudget;

  const allocationSnapshot: AllocationSnapshot = {
    resourceType: allocation.resourceType,
    totalBudget: cappedTotalBudget,
    spentBudget: allocation.spentBudget,
    pendingAllocations: allocation.pendingAllocations,
    remainingBudget,
    estimatedCost: action.estimatedCost,
    utilizationAfterAction,
    unit: allocation.unit
  };

  const reasons: string[] = [];

  if (budget.status !== 'active') {
    reasons.push(`Budget status is "${budget.status}"; execution is blocked.`);
  }

  if (action.agentId !== budget.agentId) {
    reasons.push(`Action agentId "${action.agentId}" does not match budget agentId "${budget.agentId}".`);
  }

  if (budget.delegation) {
    if (parentBudget && parentBudget.id !== budget.delegation.parentBudgetId) {
      reasons.push(
        `Configured parent budget mismatch: expected "${budget.delegation.parentBudgetId}" but received "${parentBudget.id}".`
      );
    }

    const inheritedLimit = budget.delegation.inheritedResourceLimits[allocation.resourceType];
    if (inheritedLimit !== undefined && allocation.totalBudget > inheritedLimit) {
      reasons.push(
        `Delegated allocation (${allocation.totalBudget} ${allocation.unit}) exceeds inherited limit (${inheritedLimit} ${allocation.unit}) for ${allocation.resourceType}.`
      );
    }
  }

  if (action.estimatedCost > effectiveAvailableBudget) {
    reasons.push(
      `Estimated cost (${action.estimatedCost} ${allocation.unit}) exceeds dynamic effective budget (${effectiveAvailableBudget.toFixed(2)} ${allocation.unit}) for ${allocation.resourceType}.`
    );
  }

  if (reasons.length > 0) {
    const impact = aggregateDownstreamImpact(action.predictedDownstreamImpact);
    const potentialRoiLost = Math.max(0, (action.projectedReturn ?? 0) - action.estimatedCost) + impact.totalExpectedBenefit;

    const blockedLog: BlockedActionLog = {
      timestamp: new Date().toISOString(),
      gate: 'PreExecutionBudgetGate',
      severity: 'error',
      budgetId: budget.id,
      agentId: budget.agentId,
      poolingId: budget.poolingId,
      action,
      allocation: allocationSnapshot,
      decisionReason: reasons,
      predictedDownstreamImpact: {
        ...impact,
        scenarios: action.predictedDownstreamImpact ?? []
      },
      cooperativeContributions: {
        weightedSupport: predictiveAssessment.weightedCooperativeSupport,
        contributors: action.cooperativeContributions ?? []
      },
      predictiveAssessment,
      potentialRoiLost
    };

    logger(blockedLog);

    return {
      decision: 'block',
      reasons,
      allocationSnapshot,
      predictiveAssessment,
      blockedLog
    };
  }

  if (action.estimatedCost > remainingBudget) {
    return {
      decision: 'flag',
      reasons: [
        `Estimated cost exceeds baseline remaining budget (${remainingBudget} ${allocation.unit}) but is permitted by predictive adjustment (effective budget ${effectiveAvailableBudget.toFixed(2)} ${allocation.unit}, priority ${(predictiveAssessment.compositePriorityScore * 100).toFixed(1)}%).`
      ],
      allocationSnapshot,
      predictiveAssessment
    };
  }

  if (utilizationAfterAction >= threshold) {
    const highPriorityThreshold = 0.65;
    if (
      predictiveAssessment.compositePriorityScore >= highPriorityThreshold &&
      predictiveAssessment.cooperativeSynergy >= 0.35
    ) {
      return {
        decision: 'allow',
        reasons: [
          `High-priority collaborative action accepted near utilization limit (priority ${(predictiveAssessment.compositePriorityScore * 100).toFixed(1)}%, synergy ${(predictiveAssessment.cooperativeSynergy * 100).toFixed(1)}%).`
        ],
        allocationSnapshot,
        predictiveAssessment
      };
    }

    return {
      decision: 'flag',
      reasons: [
        `Action stays within budget but drives utilization to ${(utilizationAfterAction * 100).toFixed(2)}%, above threshold ${(threshold * 100).toFixed(2)}%.`
      ],
      allocationSnapshot,
      predictiveAssessment
    };
  }

  return {
    decision: 'allow',
    reasons: ['Action is within current allocation and budget status is active.'],
    allocationSnapshot,
    predictiveAssessment
  };
}

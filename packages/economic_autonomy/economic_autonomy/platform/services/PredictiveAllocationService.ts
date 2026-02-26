import type { ProposedAgentAction } from '../../PreExecutionBudgetGate.js';
import { BudgetService } from './BudgetService.js';

export interface PredictiveAllocationScore {
  actionId: string;
  decision: 'allow' | 'flag' | 'block';
  expectedRoi: number;
  predictiveSynergyIndex: number;
  cooperativeIntelligenceWeight: number;
  roiAwareAllocationIndex: number;
  recommendedBudgetShiftPct: number;
  reasons: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class PredictiveAllocationService {
  constructor(private readonly budgetService: BudgetService) {}

  public rankActions(agentId: string, actions: ProposedAgentAction[]): PredictiveAllocationScore[] {
    const ranked = actions.map((action) => {
      const evaluation = this.budgetService.evaluateAction(agentId, action);
      const predictive = evaluation.predictiveAssessment;

      const cooperativeIntelligenceWeight = clamp(
        (predictive.cooperativeSynergy * 0.65) +
          (Math.tanh(predictive.weightedCooperativeSupport / Math.max(1, action.estimatedCost)) * 0.35),
        0,
        1
      );

      const normalizedRoi = clamp((Math.tanh(predictive.expectedRoi) + 1) / 2, 0, 1);
      const predictiveSynergyIndex = clamp(
        (predictive.cooperativeSynergy * 0.5) + (predictive.downstreamImpactScore * 0.3) + (normalizedRoi * 0.2),
        0,
        1
      );

      const roiAwareAllocationIndex = clamp(
        (normalizedRoi * 0.55) + (predictiveSynergyIndex * 0.3) + (cooperativeIntelligenceWeight * 0.15),
        0,
        1
      );

      const recommendedBudgetShiftPct = Number((((roiAwareAllocationIndex - 0.5) * 0.4)).toFixed(4));

      return {
        actionId: action.actionId,
        decision: evaluation.decision,
        expectedRoi: predictive.expectedRoi,
        predictiveSynergyIndex,
        cooperativeIntelligenceWeight,
        roiAwareAllocationIndex,
        recommendedBudgetShiftPct,
        reasons: evaluation.reasons
      };
    });

    return ranked.sort((left, right) => right.roiAwareAllocationIndex - left.roiAwareAllocationIndex);
  }
}

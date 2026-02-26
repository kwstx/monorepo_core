import { FeedbackIntegrationLayer } from 'economic_autonomy';
import { BudgetService } from './BudgetService.js';

export class RecalibrationService {
  constructor(
    private readonly feedbackLayer: FeedbackIntegrationLayer,
    private readonly budgetService: BudgetService
  ) { }

  public recalibrateAgent(agentId: string) {
    const budget = this.budgetService.getOrCreateBudget(agentId);
    return this.feedbackLayer.processFeedback(budget);
  }
}

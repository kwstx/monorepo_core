import { PnLTracker, type ActionPnLInput } from '../../PnLTracker.js';
import { BudgetService } from './BudgetService.js';

export class PnLService {
  constructor(
    private readonly pnlTracker: PnLTracker,
    private readonly budgetService: BudgetService
  ) {}

  public report(agentId: string, actionPnL: ActionPnLInput) {
    const entry = this.pnlTracker.recordExecutedAction(actionPnL);
    const budget = this.budgetService.reconcileExecutedAction(agentId, actionPnL);
    return { entry, budget };
  }

  public getLedger() {
    return this.pnlTracker.getLedger();
  }

  public verifyLedger() {
    return this.pnlTracker.verifyLedger();
  }
}

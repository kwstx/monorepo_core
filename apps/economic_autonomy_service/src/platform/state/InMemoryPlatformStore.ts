import type { AgentBudget } from 'economic_autonomy';

export class InMemoryPlatformStore {
  public readonly budgets = new Map<string, AgentBudget>();
}

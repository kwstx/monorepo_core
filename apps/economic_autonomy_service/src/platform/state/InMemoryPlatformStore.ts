import type { AgentBudget } from '../../models/AgentBudget.js';

export class InMemoryPlatformStore {
  public readonly budgets = new Map<string, AgentBudget>();
}

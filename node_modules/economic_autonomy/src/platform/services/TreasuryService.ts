import type { ResourceType } from '../../models/AgentBudget.js';
import { TreasuryEngine, type JointProject } from '../../TreasuryEngine.js';
import { BudgetService } from './BudgetService.js';

export class TreasuryService {
  constructor(
    private readonly treasuryEngine: TreasuryEngine,
    private readonly budgetService: BudgetService
  ) {}

  public createPool(
    poolId: string,
    name: string,
    resourceType: ResourceType,
    unit: string
  ) {
    return this.treasuryEngine.createPool(poolId, name, resourceType, unit);
  }

  public contributeAgents(
    poolId: string,
    agentIds: string[],
    contributionPercentage: number
  ): Array<{ agentId: string; contributed: number }> {
    return agentIds.map((agentId) => {
      const budget = this.budgetService.getOrCreateBudget(agentId);
      const contributed = this.treasuryEngine.contributeFromUnused(budget, poolId, contributionPercentage);
      return { agentId, contributed };
    });
  }

  public proposeProject(project: JointProject): void {
    this.treasuryEngine.proposeProject(project);
  }

  public allocatePool(poolId: string): string[] {
    return this.treasuryEngine.allocatePoolFunds(poolId);
  }

  public reconcileProject(projectId: string, realizedGain: number): void {
    this.treasuryEngine.reconcileProject(projectId, realizedGain);
  }

  public getPool(poolId: string) {
    return this.treasuryEngine.getPool(poolId);
  }
}

import { createHmac, randomBytes } from 'node:crypto';

export type ExecutionStatus = 'executed' | 'failed';
export type PnLEntryType = 'action_execution' | 'delegation_reconciliation';

export interface CooperativeProjectContribution {
  projectId: string;
  contributionValue: number;
  notes?: string;
}

export interface ActionPnLInput {
  actionId: string;
  agentId: string;
  actionType: string;
  executedAt?: Date;
  status: ExecutionStatus;
  revenue: number;
  directCosts: number;
  opportunityCosts: number;
  cooperativeContributions: CooperativeProjectContribution[];
  longTermStrategicImpact: number;
  delegationContext?: {
    parentAgentId: string;
    parentBudgetId?: string;
    treasuryShareRatio: number; // 0..1 of child net PnL to treasury
    rewardShareRatio: number; // 0..1 of child net PnL to parent rewards
    delegationId?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface PnLLogEntry {
  entryId: string;
  entryType: PnLEntryType;
  actionId: string;
  agentId: string;
  actionType: string;
  executedAt: string;
  status: ExecutionStatus;
  revenue: number;
  directCosts: number;
  opportunityCosts: number;
  totalCosts: number;
  cooperativeContributions: CooperativeProjectContribution[];
  totalCooperativeContribution: number;
  longTermStrategicImpact: number;
  netPnL: number;
  treasuryDelta: number;
  rewardDelta: number;
  reconcilesToParentAgentId: string | null;
  reconcilesSourceEntryId: string | null;
  metadata: Record<string, unknown>;
  previousHash: string | null;
  payloadHash: string;
  signature: string;
}

export interface LedgerVerificationResult {
  valid: boolean;
  checkedEntries: number;
  failedEntryId?: string;
  reason?: string;
}

export interface PnLTrackerOptions {
  hmacSecret?: string;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    const sortedObject = keys.map((key) => `"${key}":${stableSerialize(objectValue[key])}`);
    return `{${sortedObject.join(',')}}`;
  }

  return JSON.stringify(value);
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue);
    }
  }

  return value;
}

export class PnLTracker {
  private readonly hmacSecret: string;
  private readonly ledger: PnLLogEntry[] = [];

  constructor(options: PnLTrackerOptions = {}) {
    this.hmacSecret = options.hmacSecret ?? randomBytes(32).toString('hex');
  }

  public recordExecutedAction(input: ActionPnLInput): Readonly<PnLLogEntry> {
    const executedAt = (input.executedAt ?? new Date()).toISOString();
    const totalCosts = input.directCosts + input.opportunityCosts;
    const totalCooperativeContribution = input.cooperativeContributions.reduce(
      (total, contribution) => total + contribution.contributionValue,
      0
    );
    const netPnL = input.revenue - totalCosts + input.longTermStrategicImpact + totalCooperativeContribution;
    const childEntry = this.createLedgerEntry({
      entryType: 'action_execution',
      actionId: input.actionId,
      agentId: input.agentId,
      actionType: input.actionType,
      executedAt,
      status: input.status,
      revenue: input.revenue,
      directCosts: input.directCosts,
      opportunityCosts: input.opportunityCosts,
      totalCosts,
      cooperativeContributions: input.cooperativeContributions,
      totalCooperativeContribution,
      longTermStrategicImpact: input.longTermStrategicImpact,
      netPnL,
      treasuryDelta: 0,
      rewardDelta: 0,
      reconcilesToParentAgentId: null,
      reconcilesSourceEntryId: null,
      metadata: input.metadata ?? {}
    });

    this.ledger.push(childEntry);

    const delegation = input.delegationContext;
    if (delegation) {
      const treasuryShareRatio = clampRatio(delegation.treasuryShareRatio);
      const rewardShareRatio = clampRatio(delegation.rewardShareRatio);
      const totalShareRatio = Math.min(1, treasuryShareRatio + rewardShareRatio);
      const treasuryDelta = Number((netPnL * treasuryShareRatio).toFixed(6));
      const rewardDelta = Number((netPnL * rewardShareRatio).toFixed(6));
      const reconciledNetPnL = Number((netPnL * totalShareRatio).toFixed(6));

      const reconciliationMetadata: Record<string, unknown> = {
        delegationId: delegation.delegationId,
        parentBudgetId: delegation.parentBudgetId,
        treasuryShareRatio,
        rewardShareRatio,
        sourceAgentId: input.agentId,
        sourceActionId: input.actionId
      };

      const parentEntry = this.createLedgerEntry({
        entryType: 'delegation_reconciliation',
        actionId: input.actionId,
        agentId: delegation.parentAgentId,
        actionType: 'delegated_action_reconciliation',
        executedAt,
        status: input.status,
        revenue: 0,
        directCosts: 0,
        opportunityCosts: 0,
        totalCosts: 0,
        cooperativeContributions: [],
        totalCooperativeContribution: 0,
        longTermStrategicImpact: 0,
        netPnL: reconciledNetPnL,
        treasuryDelta,
        rewardDelta,
        reconcilesToParentAgentId: delegation.parentAgentId,
        reconcilesSourceEntryId: childEntry.entryId,
        metadata: reconciliationMetadata
      });

      this.ledger.push(parentEntry);
    }

    return deepFreeze(structuredClone(childEntry));
  }

  public getLedger(): ReadonlyArray<Readonly<PnLLogEntry>> {
    return this.ledger.map((entry) => deepFreeze(structuredClone(entry)));
  }

  public verifyLedger(): LedgerVerificationResult {
    let previousHash: string | null = null;

    for (const entry of this.ledger) {
      const unsignedPayload = {
        entryId: entry.entryId,
        entryType: entry.entryType,
        actionId: entry.actionId,
        agentId: entry.agentId,
        actionType: entry.actionType,
        executedAt: entry.executedAt,
        status: entry.status,
        revenue: entry.revenue,
        directCosts: entry.directCosts,
        opportunityCosts: entry.opportunityCosts,
        totalCosts: entry.totalCosts,
        cooperativeContributions: entry.cooperativeContributions,
        totalCooperativeContribution: entry.totalCooperativeContribution,
        longTermStrategicImpact: entry.longTermStrategicImpact,
        netPnL: entry.netPnL,
        treasuryDelta: entry.treasuryDelta,
        rewardDelta: entry.rewardDelta,
        reconcilesToParentAgentId: entry.reconcilesToParentAgentId,
        reconcilesSourceEntryId: entry.reconcilesSourceEntryId,
        metadata: entry.metadata,
        previousHash: entry.previousHash
      };

      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          checkedEntries: this.ledger.length,
          failedEntryId: entry.entryId,
          reason: 'Broken hash chain.'
        };
      }

      const recomputedHash = this.sha256(stableSerialize(unsignedPayload));
      if (recomputedHash !== entry.payloadHash) {
        return {
          valid: false,
          checkedEntries: this.ledger.length,
          failedEntryId: entry.entryId,
          reason: 'Payload hash mismatch.'
        };
      }

      if (!this.verifySignature(entry.payloadHash, entry.signature)) {
        return {
          valid: false,
          checkedEntries: this.ledger.length,
          failedEntryId: entry.entryId,
          reason: 'Signature verification failed.'
        };
      }

      previousHash = entry.payloadHash;
    }

    return {
      valid: true,
      checkedEntries: this.ledger.length
    };
  }

  private sha256(payload: string): string {
    return createHmac('sha256', 'ledger-hash').update(payload).digest('hex');
  }

  private createLedgerEntry(input: {
    entryType: PnLEntryType;
    actionId: string;
    agentId: string;
    actionType: string;
    executedAt: string;
    status: ExecutionStatus;
    revenue: number;
    directCosts: number;
    opportunityCosts: number;
    totalCosts: number;
    cooperativeContributions: CooperativeProjectContribution[];
    totalCooperativeContribution: number;
    longTermStrategicImpact: number;
    netPnL: number;
    treasuryDelta: number;
    rewardDelta: number;
    reconcilesToParentAgentId?: string | null;
    reconcilesSourceEntryId?: string | null;
    metadata: Record<string, unknown>;
  }): PnLLogEntry {
    const entryId = `pnl-${Date.now()}-${this.ledger.length + 1}`;
    const lastEntry = this.ledger.at(-1);
    const previousHash = lastEntry ? lastEntry.payloadHash : null;

    const unsignedPayload = {
      entryId,
      entryType: input.entryType,
      actionId: input.actionId,
      agentId: input.agentId,
      actionType: input.actionType,
      executedAt: input.executedAt,
      status: input.status,
      revenue: input.revenue,
      directCosts: input.directCosts,
      opportunityCosts: input.opportunityCosts,
      totalCosts: input.totalCosts,
      cooperativeContributions: input.cooperativeContributions,
      totalCooperativeContribution: input.totalCooperativeContribution,
      longTermStrategicImpact: input.longTermStrategicImpact,
      netPnL: input.netPnL,
      treasuryDelta: input.treasuryDelta,
      rewardDelta: input.rewardDelta,
      reconcilesToParentAgentId: input.reconcilesToParentAgentId ?? null,
      reconcilesSourceEntryId: input.reconcilesSourceEntryId ?? null,
      metadata: input.metadata,
      previousHash
    };

    const payloadHash = this.sha256(stableSerialize(unsignedPayload));
    const signature = this.signPayload(payloadHash);

    return {
      ...unsignedPayload,
      payloadHash,
      signature
    };
  }

  private signPayload(payloadHash: string): string {
    return createHmac('sha256', this.hmacSecret).update(payloadHash).digest('hex');
  }

  private verifySignature(payloadHash: string, signature: string): boolean {
    const expectedSignature = this.signPayload(payloadHash);
    return expectedSignature === signature;
  }
}

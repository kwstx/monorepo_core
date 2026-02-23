import { createHmac, randomBytes } from 'node:crypto';

export type ExecutionStatus = 'executed' | 'failed';

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
  metadata?: Record<string, unknown>;
}

export interface PnLLogEntry {
  entryId: string;
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
    const entryId = `pnl-${Date.now()}-${this.ledger.length + 1}`;
    const executedAt = (input.executedAt ?? new Date()).toISOString();
    const lastEntry = this.ledger.at(-1);
    const previousHash = lastEntry ? lastEntry.payloadHash : null;
    const totalCosts = input.directCosts + input.opportunityCosts;
    const totalCooperativeContribution = input.cooperativeContributions.reduce(
      (total, contribution) => total + contribution.contributionValue,
      0
    );
    const netPnL = input.revenue - totalCosts + input.longTermStrategicImpact + totalCooperativeContribution;

    const unsignedPayload = {
      entryId,
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
      metadata: input.metadata ?? {},
      previousHash
    };

    const payloadHash = this.sha256(stableSerialize(unsignedPayload));
    const signature = this.signPayload(payloadHash);

    const entry: PnLLogEntry = {
      ...unsignedPayload,
      payloadHash,
      signature
    };

    this.ledger.push(entry);

    return deepFreeze(structuredClone(entry));
  }

  public getLedger(): ReadonlyArray<Readonly<PnLLogEntry>> {
    return this.ledger.map((entry) => deepFreeze(structuredClone(entry)));
  }

  public verifyLedger(): LedgerVerificationResult {
    let previousHash: string | null = null;

    for (const entry of this.ledger) {
      const unsignedPayload = {
        entryId: entry.entryId,
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

  private signPayload(payloadHash: string): string {
    return createHmac('sha256', this.hmacSecret).update(payloadHash).digest('hex');
  }

  private verifySignature(payloadHash: string, signature: string): boolean {
    const expectedSignature = this.signPayload(payloadHash);
    return expectedSignature === signature;
  }
}

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
        treasuryShareRatio: number;
        rewardShareRatio: number;
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
export declare class PnLTracker {
    private readonly hmacSecret;
    private readonly ledger;
    constructor(options?: PnLTrackerOptions);
    recordExecutedAction(input: ActionPnLInput): Readonly<PnLLogEntry>;
    getLedger(): ReadonlyArray<Readonly<PnLLogEntry>>;
    verifyLedger(): LedgerVerificationResult;
    private sha256;
    private createLedgerEntry;
    private signPayload;
    private verifySignature;
}
//# sourceMappingURL=PnLTracker.d.ts.map
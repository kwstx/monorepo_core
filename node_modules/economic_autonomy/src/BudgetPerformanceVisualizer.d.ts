import type { AgentBudget, ResourceAllocation, ResourceType } from './models/AgentBudget.js';
import type { PnLLogEntry } from './PnLTracker.js';
export type AlertSeverity = 'low' | 'medium' | 'high';
export interface AgentBudgetSnapshot {
    timestamp: Date;
    agentId: string;
    allocations: ResourceAllocation[];
}
export interface AgentGroupDefinition {
    id: string;
    name: string;
    agentIds: string[];
}
export interface TrendPoint {
    timestamp: string;
    value: number;
}
export interface AllocationTrend {
    resourceType: ResourceType;
    utilization: TrendPoint[];
    remainingBudget: TrendPoint[];
    spentBudget: TrendPoint[];
}
export interface DeviationAlert {
    id: string;
    timestamp: string;
    severity: AlertSeverity;
    category: 'utilization' | 'roi' | 'cooperation' | 'burn_rate';
    message: string;
    metricValue: number;
    baselineValue: number;
    deviationPercent: number;
}
export interface PredictiveRoiForecast {
    horizonActions: number;
    forecastRoi: number;
    confidence: number;
    trend: 'improving' | 'stable' | 'declining';
}
export interface AgentVisualizationReport {
    agentId: string;
    budgetId?: string;
    budgetEfficiencyScore: number;
    pnlSummary: {
        revenue: number;
        totalCosts: number;
        netPnL: number;
        successRate: number;
        cooperativeContributions: number;
    };
    predictiveRoi: PredictiveRoiForecast;
    historicalTrends: {
        allocations: AllocationTrend[];
        pnl: TrendPoint[];
        cooperativeContributions: TrendPoint[];
    };
    deviationAlerts: DeviationAlert[];
}
export interface GroupVisualizationReport {
    groupId: string;
    groupName: string;
    agentIds: string[];
    budgetEfficiencyScore: number;
    netPnL: number;
    cooperativeContributionTotal: number;
    predictiveRoi: PredictiveRoiForecast;
    historicalTrends: {
        netPnL: TrendPoint[];
        efficiency: TrendPoint[];
    };
    deviationAlerts: DeviationAlert[];
}
export interface VisualizationResult {
    generatedAt: string;
    agentReports: AgentVisualizationReport[];
    groupReports: GroupVisualizationReport[];
    globalAlerts: DeviationAlert[];
}
export interface BudgetPerformanceVisualizerOptions {
    lookbackActions: number;
    deviationThreshold: number;
    roiForecastHorizonActions: number;
}
export declare class BudgetPerformanceVisualizer {
    private readonly options;
    constructor(options?: Partial<BudgetPerformanceVisualizerOptions>);
    buildVisualizationModel(input: {
        budgets: AgentBudget[];
        budgetHistory: AgentBudgetSnapshot[];
        ledger: ReadonlyArray<PnLLogEntry>;
        groups: AgentGroupDefinition[];
    }): VisualizationResult;
    private buildAgentReport;
    private buildGroupReport;
    private buildPnLSummary;
    private predictRoi;
    private buildAgentTrends;
    private calculateBudgetEfficiencyScore;
    private buildDeviationAlerts;
    private buildBurnRateAlerts;
    private mergeTrendPoints;
    private pickGroupTrend;
}
//# sourceMappingURL=BudgetPerformanceVisualizer.d.ts.map
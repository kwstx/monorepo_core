const DEFAULT_OPTIONS = {
    lookbackActions: 12,
    deviationThreshold: 0.35,
    roiForecastHorizonActions: 6
};
function sortByTimestamp(items) {
    return [...items].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function toIsoTimestamp(date) {
    return date.toISOString();
}
function parseEntryTimestamp(entry) {
    return new Date(entry.executedAt);
}
function utilization(allocation) {
    if (allocation.totalBudget <= 0)
        return 1;
    return (allocation.spentBudget + allocation.pendingAllocations) / allocation.totalBudget;
}
function toPercentDeviation(metricValue, baselineValue) {
    if (baselineValue === 0) {
        return metricValue === 0 ? 0 : 1;
    }
    return (metricValue - baselineValue) / Math.abs(baselineValue);
}
export class BudgetPerformanceVisualizer {
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    buildVisualizationModel(input) {
        const agentReports = input.budgets.map((budget) => this.buildAgentReport(budget, input.budgetHistory, input.ledger));
        const groupReports = input.groups.map((group) => this.buildGroupReport(group, agentReports));
        const globalAlerts = [...agentReports.flatMap((report) => report.deviationAlerts)]
            .filter((alert) => alert.severity === 'high')
            .slice(0, 20);
        return {
            generatedAt: new Date().toISOString(),
            agentReports,
            groupReports,
            globalAlerts
        };
    }
    buildAgentReport(budget, budgetHistory, ledger) {
        const snapshots = sortByTimestamp(budgetHistory.filter((snapshot) => snapshot.agentId === budget.agentId));
        const entries = [...ledger]
            .filter((entry) => entry.agentId === budget.agentId)
            .sort((a, b) => parseEntryTimestamp(a).getTime() - parseEntryTimestamp(b).getTime());
        const pnlSummary = this.buildPnLSummary(entries);
        const predictiveRoi = this.predictRoi(entries);
        const historicalTrends = this.buildAgentTrends(snapshots, entries);
        const budgetEfficiencyScore = this.calculateBudgetEfficiencyScore(budget, entries, pnlSummary, predictiveRoi.forecastRoi);
        const deviationAlerts = this.buildDeviationAlerts(budget, snapshots, entries, predictiveRoi.forecastRoi);
        return {
            agentId: budget.agentId,
            budgetId: budget.id,
            budgetEfficiencyScore,
            pnlSummary,
            predictiveRoi,
            historicalTrends,
            deviationAlerts
        };
    }
    buildGroupReport(group, agentReports) {
        const members = agentReports.filter((report) => group.agentIds.includes(report.agentId));
        const efficiencySeries = members.map((report) => report.budgetEfficiencyScore);
        const netPnL = members.reduce((sum, report) => sum + report.pnlSummary.netPnL, 0);
        const cooperativeContributionTotal = members.reduce((sum, report) => sum + report.pnlSummary.cooperativeContributions, 0);
        const groupEfficiency = average(efficiencySeries);
        const groupRoi = members.length === 0
            ? 0
            : average(members.map((report) => report.predictiveRoi.forecastRoi));
        const groupTrendPoints = members.flatMap((report) => report.historicalTrends.pnl);
        groupTrendPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const mergedPnL = this.mergeTrendPoints(groupTrendPoints);
        const now = new Date().toISOString();
        const efficiencyTrend = [
            { timestamp: now, value: Number(groupEfficiency.toFixed(2)) }
        ];
        const deviationAlerts = members.flatMap((report) => report.deviationAlerts).filter((alert) => {
            return alert.severity === 'high' || alert.severity === 'medium';
        });
        return {
            groupId: group.id,
            groupName: group.name,
            agentIds: members.map((report) => report.agentId),
            budgetEfficiencyScore: Number(groupEfficiency.toFixed(2)),
            netPnL: Number(netPnL.toFixed(2)),
            cooperativeContributionTotal: Number(cooperativeContributionTotal.toFixed(2)),
            predictiveRoi: {
                horizonActions: this.options.roiForecastHorizonActions,
                forecastRoi: Number(groupRoi.toFixed(4)),
                confidence: Number((members.length === 0 ? 0 : average(members.map((report) => report.predictiveRoi.confidence))).toFixed(3)),
                trend: this.pickGroupTrend(members)
            },
            historicalTrends: {
                netPnL: mergedPnL,
                efficiency: efficiencyTrend
            },
            deviationAlerts
        };
    }
    buildPnLSummary(entries) {
        const revenue = entries.reduce((sum, entry) => sum + entry.revenue, 0);
        const totalCosts = entries.reduce((sum, entry) => sum + entry.totalCosts, 0);
        const netPnL = entries.reduce((sum, entry) => sum + entry.netPnL, 0);
        const successful = entries.filter((entry) => entry.status === 'executed').length;
        const cooperativeContributions = entries.reduce((sum, entry) => sum + entry.totalCooperativeContribution, 0);
        const successRate = entries.length === 0 ? 0 : successful / entries.length;
        return {
            revenue: Number(revenue.toFixed(2)),
            totalCosts: Number(totalCosts.toFixed(2)),
            netPnL: Number(netPnL.toFixed(2)),
            successRate: Number(successRate.toFixed(4)),
            cooperativeContributions: Number(cooperativeContributions.toFixed(2))
        };
    }
    predictRoi(entries) {
        const actionEntries = entries.filter((entry) => entry.entryType === 'action_execution');
        const lookback = actionEntries.slice(-this.options.lookbackActions);
        const roiSeries = lookback.map((entry) => {
            if (entry.totalCosts <= 0)
                return entry.netPnL >= 0 ? 1 : 0;
            return entry.netPnL / entry.totalCosts;
        });
        const baselineRoi = average(roiSeries);
        const half = Math.max(1, Math.floor(roiSeries.length / 2));
        const firstHalf = roiSeries.slice(0, half);
        const secondHalf = roiSeries.slice(half);
        const trendDelta = average(secondHalf) - average(firstHalf);
        const forecastRoi = baselineRoi + trendDelta * 0.5;
        const volatility = average(roiSeries.map((roi) => Math.abs(roi - baselineRoi)));
        const confidence = clamp(1 - volatility, 0.1, 0.99);
        const trend = trendDelta > 0.05 ? 'improving' : trendDelta < -0.05 ? 'declining' : 'stable';
        return {
            horizonActions: this.options.roiForecastHorizonActions,
            forecastRoi: Number(forecastRoi.toFixed(4)),
            confidence: Number(confidence.toFixed(3)),
            trend
        };
    }
    buildAgentTrends(snapshots, entries) {
        const resourceTypes = new Set();
        for (const snapshot of snapshots) {
            for (const allocation of snapshot.allocations) {
                resourceTypes.add(allocation.resourceType);
            }
        }
        const allocations = Array.from(resourceTypes).map((resourceType) => {
            const utilizationSeries = [];
            const remainingSeries = [];
            const spentSeries = [];
            for (const snapshot of snapshots) {
                const allocation = snapshot.allocations.find((item) => item.resourceType === resourceType);
                if (!allocation)
                    continue;
                const remaining = allocation.totalBudget - allocation.spentBudget - allocation.pendingAllocations;
                utilizationSeries.push({
                    timestamp: toIsoTimestamp(snapshot.timestamp),
                    value: Number(utilization(allocation).toFixed(4))
                });
                remainingSeries.push({
                    timestamp: toIsoTimestamp(snapshot.timestamp),
                    value: Number(remaining.toFixed(2))
                });
                spentSeries.push({
                    timestamp: toIsoTimestamp(snapshot.timestamp),
                    value: Number(allocation.spentBudget.toFixed(2))
                });
            }
            return {
                resourceType,
                utilization: utilizationSeries,
                remainingBudget: remainingSeries,
                spentBudget: spentSeries
            };
        });
        const pnl = [];
        const cooperativeContributions = [];
        let cumulativePnL = 0;
        let cumulativeCoop = 0;
        for (const entry of entries) {
            cumulativePnL += entry.netPnL;
            cumulativeCoop += entry.totalCooperativeContribution;
            pnl.push({
                timestamp: entry.executedAt,
                value: Number(cumulativePnL.toFixed(2))
            });
            cooperativeContributions.push({
                timestamp: entry.executedAt,
                value: Number(cumulativeCoop.toFixed(2))
            });
        }
        return {
            allocations,
            pnl,
            cooperativeContributions
        };
    }
    calculateBudgetEfficiencyScore(budget, entries, pnlSummary, forecastRoi) {
        const utilizationScores = budget.allocations.map((allocation) => {
            const ratio = utilization(allocation);
            const distance = Math.abs(0.75 - ratio);
            return clamp(1 - distance * 1.4, 0, 1);
        });
        const utilizationScore = average(utilizationScores);
        const roiScore = clamp((forecastRoi + 1) / 2, 0, 1);
        const successScore = pnlSummary.successRate;
        const coopScore = entries.length === 0
            ? 0
            : clamp(pnlSummary.cooperativeContributions / (entries.length * 100), 0, 1);
        const weighted = (utilizationScore * 0.35) + (roiScore * 0.35) + (successScore * 0.2) + (coopScore * 0.1);
        return Number((weighted * 100).toFixed(2));
    }
    buildDeviationAlerts(budget, snapshots, entries, forecastRoi) {
        const alerts = [];
        const nowIso = new Date().toISOString();
        for (const allocation of budget.allocations) {
            const ratio = utilization(allocation);
            if (ratio >= 0.95) {
                alerts.push({
                    id: `${budget.agentId}-util-high-${allocation.resourceType}`,
                    timestamp: nowIso,
                    severity: 'high',
                    category: 'utilization',
                    message: `Resource ${allocation.resourceType} is critically utilized.`,
                    metricValue: Number(ratio.toFixed(4)),
                    baselineValue: 0.8,
                    deviationPercent: Number(toPercentDeviation(ratio, 0.8).toFixed(4))
                });
            }
            else if (ratio >= 0.85) {
                alerts.push({
                    id: `${budget.agentId}-util-medium-${allocation.resourceType}`,
                    timestamp: nowIso,
                    severity: 'medium',
                    category: 'utilization',
                    message: `Resource ${allocation.resourceType} utilization is above warning threshold.`,
                    metricValue: Number(ratio.toFixed(4)),
                    baselineValue: 0.75,
                    deviationPercent: Number(toPercentDeviation(ratio, 0.75).toFixed(4))
                });
            }
        }
        const roiSeries = entries
            .filter((entry) => entry.entryType === 'action_execution')
            .map((entry) => (entry.totalCosts <= 0 ? 0 : entry.netPnL / entry.totalCosts));
        const baselineRoi = average(roiSeries);
        if (roiSeries.length >= 3) {
            const roiDeviation = toPercentDeviation(forecastRoi, baselineRoi);
            const absDeviation = Math.abs(roiDeviation);
            if (absDeviation >= this.options.deviationThreshold) {
                alerts.push({
                    id: `${budget.agentId}-roi-deviation`,
                    timestamp: nowIso,
                    severity: absDeviation >= this.options.deviationThreshold * 1.5 ? 'high' : 'medium',
                    category: 'roi',
                    message: `Forecast ROI deviates significantly from historical ROI.`,
                    metricValue: Number(forecastRoi.toFixed(4)),
                    baselineValue: Number(baselineRoi.toFixed(4)),
                    deviationPercent: Number(roiDeviation.toFixed(4))
                });
            }
        }
        const coopSeries = entries.map((entry) => entry.totalCooperativeContribution);
        if (coopSeries.length >= 4) {
            const recent = average(coopSeries.slice(-3));
            const historical = average(coopSeries.slice(0, Math.max(1, coopSeries.length - 3)));
            const coopDeviation = toPercentDeviation(recent, historical);
            if (Math.abs(coopDeviation) >= this.options.deviationThreshold) {
                alerts.push({
                    id: `${budget.agentId}-cooperation-deviation`,
                    timestamp: nowIso,
                    severity: Math.abs(coopDeviation) >= this.options.deviationThreshold * 1.5 ? 'high' : 'medium',
                    category: 'cooperation',
                    message: `Cooperative contribution level shifted from historical baseline.`,
                    metricValue: Number(recent.toFixed(2)),
                    baselineValue: Number(historical.toFixed(2)),
                    deviationPercent: Number(coopDeviation.toFixed(4))
                });
            }
        }
        const burnAlerts = this.buildBurnRateAlerts(budget.agentId, snapshots);
        alerts.push(...burnAlerts);
        return alerts;
    }
    buildBurnRateAlerts(agentId, snapshots) {
        if (snapshots.length < 3)
            return [];
        const sorted = sortByTimestamp(snapshots);
        const spendingDeltas = [];
        for (let i = 1; i < sorted.length; i += 1) {
            const previous = sorted[i - 1];
            const current = sorted[i];
            if (!previous || !current)
                continue;
            const prevSpent = previous.allocations.reduce((sum, allocation) => sum + allocation.spentBudget, 0);
            const currSpent = current.allocations.reduce((sum, allocation) => sum + allocation.spentBudget, 0);
            spendingDeltas.push(currSpent - prevSpent);
        }
        if (spendingDeltas.length < 2)
            return [];
        const baseline = average(spendingDeltas.slice(0, -1));
        const latest = spendingDeltas[spendingDeltas.length - 1] ?? 0;
        const deviation = toPercentDeviation(latest, baseline);
        const absDeviation = Math.abs(deviation);
        if (absDeviation < this.options.deviationThreshold)
            return [];
        const severity = absDeviation >= this.options.deviationThreshold * 1.5 ? 'high' : 'medium';
        return [
            {
                id: `${agentId}-burn-rate-deviation`,
                timestamp: new Date().toISOString(),
                severity,
                category: 'burn_rate',
                message: 'Latest budget burn rate diverges from historical pattern.',
                metricValue: Number(latest.toFixed(2)),
                baselineValue: Number(baseline.toFixed(2)),
                deviationPercent: Number(deviation.toFixed(4))
            }
        ];
    }
    mergeTrendPoints(points) {
        const merged = new Map();
        for (const point of points) {
            const current = merged.get(point.timestamp) ?? 0;
            merged.set(point.timestamp, current + point.value);
        }
        return Array.from(merged.entries())
            .map(([timestamp, value]) => ({ timestamp, value: Number(value.toFixed(2)) }))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    pickGroupTrend(members) {
        if (members.length === 0)
            return 'stable';
        const score = members.reduce((sum, member) => {
            if (member.predictiveRoi.trend === 'improving')
                return sum + 1;
            if (member.predictiveRoi.trend === 'declining')
                return sum - 1;
            return sum;
        }, 0);
        if (score > 0)
            return 'improving';
        if (score < 0)
            return 'declining';
        return 'stable';
    }
}
//# sourceMappingURL=BudgetPerformanceVisualizer.js.map
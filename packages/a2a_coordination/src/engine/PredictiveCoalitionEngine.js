"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictiveCoalitionEngine = void 0;
class PredictiveCoalitionEngine {
    recommend(request, history, synergyLinks) {
        const uniqueAgents = Array.from(new Set(request.candidateAgents)).filter(Boolean);
        const maxCoalitionSize = this.normalizeMaxCoalitionSize(request.maxCoalitionSize, uniqueAgents.length);
        const topK = request.topK ?? 5;
        if (uniqueAgents.length < 2) {
            return { generatedAt: new Date().toISOString(), recommendations: [] };
        }
        const aggregates = this.buildAgentAggregates(history);
        const synergyMap = this.buildSynergyMap(synergyLinks);
        const coalitions = this.generateCoalitions(uniqueAgents, maxCoalitionSize);
        const recommendations = coalitions.map((agents) => this.scoreCoalition(agents, aggregates, synergyMap));
        recommendations.sort((a, b) => b.predictedCollectiveImpact - a.predictedCollectiveImpact);
        return {
            generatedAt: new Date().toISOString(),
            recommendations: recommendations.slice(0, Math.max(1, topK))
        };
    }
    normalizeMaxCoalitionSize(size, availableAgents) {
        if (!size || size < 2) {
            return Math.min(3, availableAgents);
        }
        return Math.max(2, Math.min(size, availableAgents));
    }
    buildAgentAggregates(history) {
        const grouped = new Map();
        history.forEach((record) => {
            const list = grouped.get(record.agentId) ?? [];
            list.push(record);
            grouped.set(record.agentId, list);
        });
        const aggregates = new Map();
        grouped.forEach((records, agentId) => {
            const count = records.length;
            const successes = records.filter((r) => r.outcome === 'SUCCESS').length;
            const successRate = count === 0 ? 0.5 : successes / count;
            const reliability = this.average(records.map((r) => r.reliability), 0.5);
            const economicPerformance = this.average(records.map((r) => r.economicPerformance), 0.5);
            const cooperativeImpact = this.average(records.map((r) => r.cooperativeImpact), 0.5);
            aggregates.set(agentId, {
                count,
                successRate,
                reliability,
                economicPerformance,
                cooperativeImpact
            });
        });
        return aggregates;
    }
    buildSynergyMap(links) {
        const map = new Map();
        links.forEach((link) => {
            const key = this.getSynergyKey(link.agentA, link.agentB);
            map.set(key, link);
        });
        return map;
    }
    scoreCoalition(agents, aggregates, synergyMap) {
        const stats = agents.map((agentId) => aggregates.get(agentId) ?? this.defaultAggregate());
        const predictedSuccessScore = this.average(stats.map((s) => (s.successRate * 0.6) + (s.reliability * 0.4)), 0.5);
        const predictedEconomicScore = this.average(stats.map((s) => s.economicPerformance), 0.5);
        const pairSynergies = [];
        for (let i = 0; i < agents.length; i++) {
            for (let j = i + 1; j < agents.length; j++) {
                const key = this.getSynergyKey(agents[i], agents[j]);
                const link = synergyMap.get(key);
                pairSynergies.push(link?.compatibilityScore ?? 0.5);
            }
        }
        const predictedSynergyScore = this.average(pairSynergies, 0.5);
        const predictedCollectiveImpact = predictedSuccessScore * 0.35 +
            predictedEconomicScore * 0.35 +
            predictedSynergyScore * 0.30;
        const confidence = this.calculateConfidence(agents, stats, pairSynergies);
        const rationale = [
            `success=${predictedSuccessScore.toFixed(2)} from historical outcomes/reliability`,
            `economics=${predictedEconomicScore.toFixed(2)} from prior economic performance`,
            `synergy=${predictedSynergyScore.toFixed(2)} from pair compatibility network`,
            `confidence=${confidence.toFixed(2)} based on sample depth and pair coverage`
        ];
        return {
            agents,
            predictedSuccessScore,
            predictedEconomicScore,
            predictedSynergyScore,
            predictedCollectiveImpact,
            confidence,
            rationale
        };
    }
    calculateConfidence(agents, stats, pairSynergies) {
        const historyDepth = this.average(stats.map((s) => Math.min(1, s.count / 10)), 0.2);
        const synergyCoverage = this.average(pairSynergies.map((score) => (score > 0.5 ? 1 : 0.4)), 0.4);
        const breadthPenalty = agents.length > 2 ? 0.95 : 1;
        return Math.max(0, Math.min(1, ((historyDepth * 0.55) + (synergyCoverage * 0.45)) * breadthPenalty));
    }
    defaultAggregate() {
        return {
            count: 0,
            successRate: 0.5,
            reliability: 0.5,
            economicPerformance: 0.5,
            cooperativeImpact: 0.5
        };
    }
    generateCoalitions(agents, maxSize) {
        const output = [];
        for (let size = 2; size <= maxSize; size++) {
            this.combine(agents, size, 0, [], output);
        }
        return output;
    }
    combine(source, size, start, current, output) {
        if (current.length === size) {
            output.push([...current]);
            return;
        }
        for (let i = start; i < source.length; i++) {
            current.push(source[i]);
            this.combine(source, size, i + 1, current, output);
            current.pop();
        }
    }
    average(values, fallback) {
        if (values.length === 0)
            return fallback;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    getSynergyKey(a, b) {
        return [a, b].sort().join(':');
    }
}
exports.PredictiveCoalitionEngine = PredictiveCoalitionEngine;

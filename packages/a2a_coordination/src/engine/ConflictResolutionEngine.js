"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictResolutionEngine = exports.ConflictType = void 0;
var ConflictType;
(function (ConflictType) {
    ConflictType["OVERLAPPING_RESOURCE_ALLOCATION"] = "OVERLAPPING_RESOURCE_ALLOCATION";
    ConflictType["CONTRADICTORY_TASK_SCOPE"] = "CONTRADICTORY_TASK_SCOPE";
    ConflictType["INCOMPATIBLE_DEADLINE"] = "INCOMPATIBLE_DEADLINE";
})(ConflictType || (exports.ConflictType = ConflictType = {}));
class ConflictResolutionEngine {
    agreements = new Map();
    maxDeadlineSkewMs;
    contradictoryTaskPairs;
    constructor(config) {
        this.maxDeadlineSkewMs = (config?.maxDeadlineSkewHours ?? 24) * 60 * 60 * 1000;
        this.contradictoryTaskPairs = config?.contradictoryTaskPairs ?? [];
    }
    evaluate(message, sessionId) {
        const conflicts = [];
        const candidateWindow = this.getWindow(message);
        for (const agreement of this.agreements.values()) {
            if (agreement.sessionId === sessionId) {
                continue;
            }
            const current = agreement.message;
            const currentWindow = this.getWindow(current);
            const overlappingWindows = candidateWindow.start < currentWindow.end
                && currentWindow.start < candidateWindow.end;
            if (!overlappingWindows) {
                continue;
            }
            if (this.hasResourceOverlap(message, current)) {
                conflicts.push({
                    type: ConflictType.OVERLAPPING_RESOURCE_ALLOCATION,
                    message: 'Resource allocations overlap for the same active time window.',
                    relatedSessionId: agreement.sessionId,
                    relatedMessageId: current.messageId,
                    conflictingAgentIds: [message.sender.id, current.sender.id]
                });
            }
            if (this.hasContradictoryScope(message, current)) {
                conflicts.push({
                    type: ConflictType.CONTRADICTORY_TASK_SCOPE,
                    message: 'Task scopes contain contradictory directives.',
                    relatedSessionId: agreement.sessionId,
                    relatedMessageId: current.messageId,
                    conflictingAgentIds: [message.sender.id, current.sender.id]
                });
            }
            if (this.hasIncompatibleDeadlines(message, current)) {
                conflicts.push({
                    type: ConflictType.INCOMPATIBLE_DEADLINE,
                    message: 'Deadlines are incompatible for overlapping scope.',
                    relatedSessionId: agreement.sessionId,
                    relatedMessageId: current.messageId,
                    conflictingAgentIds: [message.sender.id, current.sender.id]
                });
            }
        }
        return { hasConflict: conflicts.length > 0, conflicts };
    }
    register(message, sessionId) {
        this.agreements.set(sessionId, { sessionId, message });
    }
    unregister(sessionId) {
        this.agreements.delete(sessionId);
    }
    hasResourceOverlap(a, b) {
        const aResourceKeys = this.resourceKeys(a);
        const bResourceKeys = this.resourceKeys(b);
        for (const key of aResourceKeys) {
            if (bResourceKeys.has(key)) {
                return true;
            }
        }
        return false;
    }
    hasContradictoryScope(a, b) {
        const aTasks = a.content.scope.tasks;
        const bTasks = b.content.scope.tasks;
        for (const taskA of aTasks) {
            for (const taskB of bTasks) {
                if (this.isContradictoryPair(taskA, taskB)) {
                    return true;
                }
            }
        }
        return false;
    }
    hasIncompatibleDeadlines(a, b) {
        if (!this.hasPotentialScopeOverlap(a, b)) {
            return false;
        }
        const deadlineA = Date.parse(a.content.deadline);
        const deadlineB = Date.parse(b.content.deadline);
        if (!Number.isFinite(deadlineA) || !Number.isFinite(deadlineB)) {
            return false;
        }
        return Math.abs(deadlineA - deadlineB) > this.maxDeadlineSkewMs;
    }
    hasPotentialScopeOverlap(a, b) {
        const normalizedA = new Set(a.content.scope.tasks.map(task => this.normalize(task)));
        for (const task of b.content.scope.tasks) {
            if (normalizedA.has(this.normalize(task))) {
                return true;
            }
        }
        return false;
    }
    resourceKeys(message) {
        const keys = new Set();
        const { budget, compute, storage } = message.content.resources;
        keys.add(`budget:${budget.currency.toUpperCase()}`);
        if (compute?.type) {
            keys.add(`compute:${this.normalize(compute.type)}`);
        }
        if (storage?.durability) {
            keys.add(`storage:${this.normalize(storage.durability)}`);
        }
        return keys;
    }
    isContradictoryPair(taskA, taskB) {
        const normalizedA = this.normalize(taskA);
        const normalizedB = this.normalize(taskB);
        for (const pair of this.contradictoryTaskPairs) {
            const left = this.normalize(pair.a);
            const right = this.normalize(pair.b);
            if ((normalizedA.includes(left) && normalizedB.includes(right))
                || (normalizedA.includes(right) && normalizedB.includes(left))) {
                return true;
            }
        }
        const aNegative = this.hasNegativeAction(normalizedA);
        const bNegative = this.hasNegativeAction(normalizedB);
        if (aNegative === bNegative) {
            return false;
        }
        const tokensA = this.contentTokens(normalizedA);
        const tokensB = this.contentTokens(normalizedB);
        for (const token of tokensA) {
            if (tokensB.has(token)) {
                return true;
            }
        }
        return false;
    }
    hasNegativeAction(text) {
        const negatives = ['disable', 'deny', 'decrease', 'reduce', 'remove', 'block', 'reject', 'cancel'];
        for (const token of negatives) {
            if (text.includes(token)) {
                return true;
            }
        }
        return false;
    }
    contentTokens(text) {
        const actionWords = new Set([
            'enable', 'disable', 'allow', 'deny', 'increase', 'decrease', 'reduce', 'remove', 'block',
            'reject', 'cancel', 'build', 'update', 'migrate', 'create', 'delete', 'expand'
        ]);
        const words = text.split(/\s+/).filter(word => word.length > 3 && !actionWords.has(word));
        return new Set(words);
    }
    normalize(value) {
        return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    getWindow(message) {
        const start = Date.parse(message.timestamp);
        const end = Date.parse(message.content.deadline);
        const safeStart = Number.isFinite(start) ? start : 0;
        const safeEnd = Number.isFinite(end) ? end : Number.MAX_SAFE_INTEGER;
        return { start: safeStart, end: safeEnd };
    }
}
exports.ConflictResolutionEngine = ConflictResolutionEngine;

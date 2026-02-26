"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmutableAuditLog = void 0;
const crypto_1 = require("crypto");
const GENESIS_HASH = 'GENESIS';
class ImmutableAuditLog {
    events;
    headHash;
    constructor(snapshot) {
        this.events = snapshot ? [...snapshot.events] : [];
        this.headHash = snapshot?.headHash ?? GENESIS_HASH;
    }
    record(event) {
        const sequence = this.events.length + 1;
        const timestamp = event.timestamp ?? new Date().toISOString();
        const previousHash = sequence === 1 ? GENESIS_HASH : this.events[this.events.length - 1].hash;
        const eventId = event.details?.['eventId']
            ?? `${timestamp}-${sequence}-${Math.random().toString(36).slice(2, 10)}`;
        const payload = {
            eventId,
            sequence,
            timestamp,
            domain: event.domain,
            action: event.action,
            outcome: event.outcome,
            contractId: event.contractId,
            correlationId: event.correlationId,
            sessionId: event.sessionId,
            messageId: event.messageId,
            actorId: event.actorId,
            details: event.details ?? {},
            previousHash
        };
        const hash = hashPayload(payload);
        const immutableEvent = Object.freeze({ ...payload, hash });
        this.events.push(immutableEvent);
        return immutableEvent;
    }
    getHeadHash() {
        if (this.events.length === 0) {
            return this.headHash;
        }
        return this.events[this.events.length - 1].hash;
    }
    toSnapshot() {
        return {
            events: this.events.map(event => Object.freeze({ ...event })),
            headHash: this.getHeadHash()
        };
    }
    verifyIntegrity() {
        let previousHash = GENESIS_HASH;
        for (let i = 0; i < this.events.length; i++) {
            const event = this.events[i];
            if (event.sequence !== i + 1) {
                return {
                    valid: false,
                    reason: `Sequence mismatch at index ${i}. Expected ${i + 1}, found ${event.sequence}.`
                };
            }
            if (event.previousHash !== previousHash) {
                return {
                    valid: false,
                    reason: `Hash link mismatch at sequence ${event.sequence}.`
                };
            }
            const recalculatedHash = hashPayload({
                eventId: event.eventId,
                sequence: event.sequence,
                timestamp: event.timestamp,
                domain: event.domain,
                action: event.action,
                outcome: event.outcome,
                contractId: event.contractId,
                correlationId: event.correlationId,
                sessionId: event.sessionId,
                messageId: event.messageId,
                actorId: event.actorId,
                details: event.details ?? {},
                previousHash: event.previousHash
            });
            if (event.hash !== recalculatedHash) {
                return {
                    valid: false,
                    reason: `Hash verification failed at sequence ${event.sequence}.`
                };
            }
            previousHash = event.hash;
        }
        return { valid: true };
    }
}
exports.ImmutableAuditLog = ImmutableAuditLog;
function hashPayload(payload) {
    return (0, crypto_1.createHash)('sha256').update(stableStringify(payload)).digest('hex');
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

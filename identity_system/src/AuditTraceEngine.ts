import { v4 as uuidv4 } from 'uuid';

export type AuditDomain =
    | 'authority_check'
    | 'delegation_event'
    | 'approval_path'
    | 'enforcement_decision';

export type AuditDecision =
    | 'allow'
    | 'deny'
    | 'requires_approval'
    | 'approved'
    | 'rejected'
    | 'none';

export interface AuditTraceEvent {
    eventId: string;
    traceId: string;
    timestamp: number;
    domain: AuditDomain;
    type: string;
    actorId?: string;
    subjectId?: string;
    entityId?: string;
    decision?: AuditDecision;
    complianceTags?: string[];
    details: Record<string, unknown>;
}

export interface AuditTraceRecord {
    traceId: string;
    createdAt: number;
    correlationRef?: string;
    metadata?: Record<string, unknown>;
}

export interface AuditTraceFilter {
    traceId?: string;
    domain?: AuditDomain;
    type?: string;
    actorId?: string;
    subjectId?: string;
    from?: number;
    to?: number;
}

export interface ComplianceValidationResult {
    compliant: boolean;
    violations: string[];
    checks: string[];
}

export interface DecisionChain {
    trace: AuditTraceRecord;
    authorityChecks: AuditTraceEvent[];
    delegationEvents: AuditTraceEvent[];
    approvalPath: AuditTraceEvent[];
    enforcementDecisions: AuditTraceEvent[];
    events: AuditTraceEvent[];
    compliance: ComplianceValidationResult;
}

export interface StartTraceInput {
    traceId?: string;
    correlationRef?: string;
    metadata?: Record<string, unknown>;
}

export interface RecordEventInput {
    traceId: string;
    domain: AuditDomain;
    type: string;
    timestamp?: number;
    actorId?: string;
    subjectId?: string;
    entityId?: string;
    decision?: AuditDecision;
    complianceTags?: string[];
    details?: Record<string, unknown>;
}

export interface AuditTraceEngineOptions {
    now?: () => number;
}

export class AuditTraceEngine {
    private readonly traces = new Map<string, AuditTraceRecord>();
    private readonly events: AuditTraceEvent[] = [];
    private readonly now: () => number;

    constructor(options: AuditTraceEngineOptions = {}) {
        this.now = options.now ?? (() => Date.now());
    }

    public startTrace(input: StartTraceInput = {}): AuditTraceRecord {
        const traceId = input.traceId ?? `trace_${uuidv4()}`;
        const existing = this.traces.get(traceId);
        if (existing) {
            return { ...existing, metadata: existing.metadata ? { ...existing.metadata } : undefined };
        }

        const created: AuditTraceRecord = {
            traceId,
            createdAt: this.now(),
            correlationRef: input.correlationRef,
            metadata: input.metadata ? { ...input.metadata } : undefined
        };
        this.traces.set(traceId, created);
        return { ...created, metadata: created.metadata ? { ...created.metadata } : undefined };
    }

    public recordEvent(input: RecordEventInput): AuditTraceEvent {
        this.startTrace({ traceId: input.traceId });

        const event: AuditTraceEvent = {
            eventId: `audit_evt_${uuidv4()}`,
            traceId: input.traceId,
            timestamp: input.timestamp ?? this.now(),
            domain: input.domain,
            type: input.type,
            actorId: input.actorId,
            subjectId: input.subjectId,
            entityId: input.entityId,
            decision: input.decision,
            complianceTags: input.complianceTags ? [...input.complianceTags] : undefined,
            details: input.details ? { ...input.details } : {}
        };

        this.events.push(event);
        return this.cloneEvent(event);
    }

    public getTrace(traceId: string): AuditTraceRecord | undefined {
        const trace = this.traces.get(traceId);
        return trace ? { ...trace, metadata: trace.metadata ? { ...trace.metadata } : undefined } : undefined;
    }

    public queryEvents(filter: AuditTraceFilter = {}): AuditTraceEvent[] {
        return this.events
            .filter((event) => {
                if (filter.traceId && event.traceId !== filter.traceId) {
                    return false;
                }
                if (filter.domain && event.domain !== filter.domain) {
                    return false;
                }
                if (filter.type && event.type !== filter.type) {
                    return false;
                }
                if (filter.actorId && event.actorId !== filter.actorId) {
                    return false;
                }
                if (filter.subjectId && event.subjectId !== filter.subjectId) {
                    return false;
                }
                if (filter.from && event.timestamp < filter.from) {
                    return false;
                }
                if (filter.to && event.timestamp > filter.to) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((event) => this.cloneEvent(event));
    }

    public reconstructDecisionChain(traceId: string): DecisionChain {
        const trace = this.getTrace(traceId) ?? this.startTrace({ traceId });
        const directEvents = this.queryEvents({ traceId });
        const authorityChecks = directEvents.filter((event) => event.domain === 'authority_check');
        const referencedDelegationIds = new Set<string>();
        for (const event of authorityChecks) {
            const rule = event.details.rule as { sources?: string[] } | undefined;
            for (const source of rule?.sources ?? []) {
                if (source.startsWith('delegation:')) {
                    referencedDelegationIds.add(source.slice('delegation:'.length));
                }
            }
        }
        const linkedDelegationEvents =
            referencedDelegationIds.size > 0
                ? this.queryEvents({ domain: 'delegation_event' }).filter((event) =>
                    event.entityId ? referencedDelegationIds.has(event.entityId) : false
                )
                : [];
        const events = [...directEvents, ...linkedDelegationEvents]
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((event) => this.cloneEvent(event));

        const delegationEvents = events.filter((event) => event.domain === 'delegation_event');
        const approvalPath = events.filter((event) => event.domain === 'approval_path');
        const enforcementDecisions = events.filter((event) => event.domain === 'enforcement_decision');

        return {
            trace,
            authorityChecks,
            delegationEvents,
            approvalPath,
            enforcementDecisions,
            events,
            compliance: this.validateCompliance(traceId)
        };
    }

    public validateCompliance(traceId: string): ComplianceValidationResult {
        const events = this.queryEvents({ traceId });
        const checks: string[] = [];
        const violations: string[] = [];

        const authorityResultEvents = events.filter(
            (event) => event.domain === 'authority_check' && event.type === 'authority_check_result'
        );
        checks.push(`authority_check_result_events=${authorityResultEvents.length}`);
        if (authorityResultEvents.length === 0) {
            violations.push('Missing authority check result event.');
        }

        const approvalRequired = authorityResultEvents.some(
            (event) => event.decision === 'requires_approval' || (event.details.requiredApprovals as unknown[] | undefined)?.length
        );
        const approvalSatisfied = events.some(
            (event) =>
                event.domain === 'approval_path' &&
                (event.type === 'route_approved' || event.type === 'step_approved')
        );
        checks.push(`approval_required=${approvalRequired}`);
        checks.push(`approval_satisfied=${approvalSatisfied}`);
        if (approvalRequired && !approvalSatisfied) {
            violations.push('Approval required but no approval completion event found.');
        }

        const allowedEnforcementEvents = events.filter(
            (event) => event.domain === 'enforcement_decision' && event.decision === 'allow'
        );
        checks.push(`allow_enforcement_events=${allowedEnforcementEvents.length}`);
        if (allowedEnforcementEvents.length > 0 && authorityResultEvents.every((event) => event.decision === 'deny')) {
            violations.push('Enforcement allowed despite deny-only authority check outcomes.');
        }

        return {
            compliant: violations.length === 0,
            violations,
            checks
        };
    }

    private cloneEvent(event: AuditTraceEvent): AuditTraceEvent {
        return {
            ...event,
            complianceTags: event.complianceTags ? [...event.complianceTags] : undefined,
            details: { ...event.details }
        };
    }
}

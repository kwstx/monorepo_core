import {
    AuthorityPolicyCondition,
    AuthorityPolicyEffect,
    DelegatedPermission
} from './AuthorityGraphBuilder';
import { AuditTraceEngine } from './AuditTraceEngine';

export interface DelegationScopeBoundary {
    resources: string[];
    actions: string[];
    constraints?: Record<string, unknown>;
}

export interface DelegationContextRestriction {
    environments?: Array<'production' | 'staging' | 'development'>;
    regions?: string[];
    requiredLabels?: Record<string, string>;
    roleIdsAny?: string[];
    departmentIdsAny?: string[];
}

export interface DelegationCapability {
    resources: string[];
    actions: string[];
}

export interface DelegationRequest {
    grantorAgentId: string;
    granteeAgentId: string;
    scope: DelegationScopeBoundary;
    effect?: AuthorityPolicyEffect;
    reason?: string;
    startsAt?: number;
    expiresAt?: number;
    ttlMs?: number;
    contextRestriction?: DelegationContextRestriction;
    parentDelegationId?: string;
    actorId?: string;
}

export interface DelegationRecord {
    delegationId: string;
    grantorAgentId: string;
    granteeAgentId: string;
    effect: AuthorityPolicyEffect;
    scope: DelegationScopeBoundary;
    reason?: string;
    startsAt: number;
    expiresAt?: number;
    contextRestriction?: DelegationContextRestriction;
    parentDelegationId?: string;
    chain: string[];
    status: 'scheduled' | 'active' | 'expired' | 'revoked';
    createdAt: number;
    revokedAt?: number;
}

export type DelegationAuditEventType =
    | 'delegation_created'
    | 'delegation_denied'
    | 'delegation_expired'
    | 'delegation_revoked'
    | 'delegation_evaluated';

export interface DelegationAuditEvent {
    eventId: string;
    timestamp: number;
    type: DelegationAuditEventType;
    delegationId?: string;
    actorId?: string;
    details: Record<string, unknown>;
}

export interface DelegationControlModuleOptions {
    now?: () => number;
    maxDelegationTtlMs?: number;
    maxDelegationChainDepth?: number;
    auditTraceEngine?: AuditTraceEngine;
}

interface DelegationQuery {
    granteeAgentId?: string;
    asOf?: number;
    context?: {
        environment?: 'production' | 'staging' | 'development';
        region?: string;
        labels?: Record<string, string>;
        roleIds?: string[];
        departmentIds?: string[];
    };
}

export class DelegationControlModule {
    private readonly delegations = new Map<string, DelegationRecord>();
    private readonly auditTrail: DelegationAuditEvent[] = [];
    private readonly now: () => number;
    private readonly maxDelegationTtlMs: number;
    private readonly maxDelegationChainDepth: number;
    private readonly auditTraceEngine?: AuditTraceEngine;

    constructor(options: DelegationControlModuleOptions = {}) {
        this.now = options.now ?? (() => Date.now());
        this.maxDelegationTtlMs = options.maxDelegationTtlMs ?? 30 * 24 * 60 * 60 * 1000;
        this.maxDelegationChainDepth = options.maxDelegationChainDepth ?? 8;
        this.auditTraceEngine = options.auditTraceEngine;
    }

    public createDelegation(
        request: DelegationRequest,
        grantorCapabilities: DelegationCapability[]
    ): DelegationRecord {
        this.expireDelegations(this.now());

        const validation = this.validateCreateRequest(request, grantorCapabilities);
        if (!validation.valid) {
            this.logEvent('delegation_denied', {
                actorId: request.actorId,
                details: {
                    reason: validation.reason,
                    grantorAgentId: request.grantorAgentId,
                    granteeAgentId: request.granteeAgentId
                }
            });
            throw new Error(validation.reason ?? 'Invalid delegation request');
        }

        const issuedAt = this.now();
        const startsAt = request.startsAt ?? issuedAt;
        const expiresAt = request.expiresAt ?? (request.ttlMs ? issuedAt + request.ttlMs : undefined);
        const delegationId = this.newId('dlg');
        const parent = request.parentDelegationId
            ? this.delegations.get(request.parentDelegationId)
            : undefined;
        const chain = [...(parent?.chain ?? []), delegationId];
        const status = startsAt > issuedAt ? 'scheduled' : 'active';

        const record: DelegationRecord = {
            delegationId,
            grantorAgentId: request.grantorAgentId,
            granteeAgentId: request.granteeAgentId,
            effect: request.effect ?? 'allow',
            scope: {
                resources: [...request.scope.resources],
                actions: [...request.scope.actions],
                constraints: request.scope.constraints ? { ...request.scope.constraints } : undefined
            },
            reason: request.reason,
            startsAt,
            expiresAt,
            contextRestriction: request.contextRestriction
                ? { ...request.contextRestriction }
                : undefined,
            parentDelegationId: request.parentDelegationId,
            chain,
            status,
            createdAt: issuedAt
        };

        this.delegations.set(record.delegationId, record);
        this.logEvent('delegation_created', {
            delegationId: record.delegationId,
            actorId: request.actorId,
            details: {
                grantorAgentId: record.grantorAgentId,
                granteeAgentId: record.granteeAgentId,
                chain: record.chain,
                startsAt: record.startsAt,
                expiresAt: record.expiresAt
            }
        });

        return { ...record, chain: [...record.chain] };
    }

    public revokeDelegation(delegationId: string, actorId?: string): boolean {
        this.expireDelegations(this.now());
        const existing = this.delegations.get(delegationId);
        if (!existing || existing.status === 'revoked' || existing.status === 'expired') {
            return false;
        }

        existing.status = 'revoked';
        existing.revokedAt = this.now();
        this.logEvent('delegation_revoked', {
            delegationId,
            actorId,
            details: {
                chain: existing.chain
            }
        });
        return true;
    }

    public getDelegation(delegationId: string): DelegationRecord | undefined {
        this.expireDelegations(this.now());
        const record = this.delegations.get(delegationId);
        return record ? { ...record, chain: [...record.chain] } : undefined;
    }

    public listDelegations(): DelegationRecord[] {
        this.expireDelegations(this.now());
        return [...this.delegations.values()].map((record) => ({ ...record, chain: [...record.chain] }));
    }

    public listActiveDelegatedPermissions(query: DelegationQuery = {}): DelegatedPermission[] {
        const asOf = query.asOf ?? this.now();
        this.expireDelegations(asOf);

        const result: DelegatedPermission[] = [];
        for (const delegation of this.delegations.values()) {
            if (!this.isDelegationActiveForContext(delegation, asOf, query.context)) {
                continue;
            }
            if (query.granteeAgentId && delegation.granteeAgentId !== query.granteeAgentId) {
                continue;
            }

            this.logEvent('delegation_evaluated', {
                delegationId: delegation.delegationId,
                details: {
                    asOf,
                    granteeAgentId: query.granteeAgentId ?? delegation.granteeAgentId
                }
            });

            for (const resource of delegation.scope.resources) {
                result.push({
                    delegationId: delegation.delegationId,
                    grantorId: delegation.grantorAgentId,
                    granteeAgentId: delegation.granteeAgentId,
                    issuedAt: delegation.createdAt,
                    expiresAt: delegation.expiresAt,
                    resource,
                    actions: delegation.scope.actions.length > 0 ? [...delegation.scope.actions] : ['*'],
                    effect: delegation.effect,
                    reason: delegation.reason,
                    constraints: {
                        ...(delegation.scope.constraints ?? {}),
                        delegationChain: [...delegation.chain]
                    },
                    condition: this.toAuthorityCondition(delegation.contextRestriction),
                    parentDelegationId: delegation.parentDelegationId,
                    delegationChain: [...delegation.chain]
                });
            }
        }

        return result;
    }

    public traceDelegationChain(delegationId: string): DelegationRecord[] {
        this.expireDelegations(this.now());
        const record = this.delegations.get(delegationId);
        if (!record) {
            return [];
        }

        return record.chain
            .map((id) => this.delegations.get(id))
            .filter((value): value is DelegationRecord => Boolean(value))
            .map((entry) => ({ ...entry, chain: [...entry.chain] }));
    }

    public getAuditTrail(filters?: {
        delegationId?: string;
        actorId?: string;
        type?: DelegationAuditEventType;
        from?: number;
        to?: number;
    }): DelegationAuditEvent[] {
        return this.auditTrail.filter((event) => {
            if (filters?.delegationId && event.delegationId !== filters.delegationId) {
                return false;
            }
            if (filters?.actorId && event.actorId !== filters.actorId) {
                return false;
            }
            if (filters?.type && event.type !== filters.type) {
                return false;
            }
            if (filters?.from && event.timestamp < filters.from) {
                return false;
            }
            if (filters?.to && event.timestamp > filters.to) {
                return false;
            }
            return true;
        });
    }

    public expireDelegations(asOf: number): void {
        for (const delegation of this.delegations.values()) {
            if (delegation.status === 'revoked' || delegation.status === 'expired') {
                continue;
            }
            if (delegation.startsAt > asOf) {
                delegation.status = 'scheduled';
                continue;
            }
            if (delegation.expiresAt !== undefined && delegation.expiresAt <= asOf) {
                delegation.status = 'expired';
                this.logEvent('delegation_expired', {
                    delegationId: delegation.delegationId,
                    details: {
                        expiredAt: asOf,
                        chain: delegation.chain
                    }
                });
                continue;
            }
            delegation.status = 'active';
        }
    }

    private validateCreateRequest(
        request: DelegationRequest,
        grantorCapabilities: DelegationCapability[]
    ): { valid: true } | { valid: false; reason: string } {
        if (!request.scope.resources.length || !request.scope.actions.length) {
            return { valid: false, reason: 'Delegation scope must include at least one resource and action' };
        }

        const issuedAt = this.now();
        const startsAt = request.startsAt ?? issuedAt;
        const expiresAt = request.expiresAt ?? (request.ttlMs ? issuedAt + request.ttlMs : undefined);

        if (expiresAt !== undefined && expiresAt <= startsAt) {
            return { valid: false, reason: 'Delegation expiration must be after start time' };
        }

        if (request.ttlMs !== undefined && request.ttlMs <= 0) {
            return { valid: false, reason: 'Delegation ttlMs must be positive' };
        }

        if (expiresAt !== undefined && expiresAt - issuedAt > this.maxDelegationTtlMs) {
            return { valid: false, reason: 'Delegation exceeds configured maximum TTL' };
        }

        const parent = request.parentDelegationId
            ? this.delegations.get(request.parentDelegationId)
            : undefined;
        if (request.parentDelegationId && !parent) {
            return { valid: false, reason: 'Parent delegation does not exist' };
        }
        if (parent) {
            if (parent.status !== 'active' && parent.status !== 'scheduled') {
                return { valid: false, reason: 'Parent delegation is not active' };
            }
            if (parent.granteeAgentId !== request.grantorAgentId) {
                return { valid: false, reason: 'Grantor must be the grantee of the parent delegation' };
            }
            const nextDepth = parent.chain.length + 1;
            if (nextDepth > this.maxDelegationChainDepth) {
                return { valid: false, reason: 'Delegation chain depth limit exceeded' };
            }
            if (parent.expiresAt !== undefined && (!expiresAt || expiresAt > parent.expiresAt)) {
                return { valid: false, reason: 'Child delegation cannot outlive parent delegation' };
            }
            for (const resource of request.scope.resources) {
                const resourceCovered = parent.scope.resources.some((pattern) =>
                    this.matchesPattern(resource, pattern)
                );
                if (!resourceCovered) {
                    return { valid: false, reason: `Child delegation resource exceeds parent scope: ${resource}` };
                }
            }
            for (const action of request.scope.actions) {
                const actionCovered = parent.scope.actions.some((pattern) =>
                    this.matchesPattern(action, pattern)
                );
                if (!actionCovered) {
                    return { valid: false, reason: `Child delegation action exceeds parent scope: ${action}` };
                }
            }
        }

        for (const resource of request.scope.resources) {
            for (const action of request.scope.actions) {
                const covered = grantorCapabilities.some(
                    (capability) =>
                        capability.resources.some((candidate) => this.matchesPattern(resource, candidate)) &&
                        capability.actions.some((candidate) => this.matchesPattern(action, candidate))
                );
                if (!covered) {
                    return {
                        valid: false,
                        reason: `Grantor lacks delegable authority for ${resource}:${action}`
                    };
                }
            }
        }

        return { valid: true };
    }

    private isDelegationActiveForContext(
        delegation: DelegationRecord,
        asOf: number,
        context: DelegationQuery['context']
    ): boolean {
        if (delegation.status !== 'active') {
            return false;
        }
        if (delegation.startsAt > asOf) {
            return false;
        }
        if (delegation.expiresAt !== undefined && delegation.expiresAt <= asOf) {
            return false;
        }

        const restriction = delegation.contextRestriction;
        if (!restriction) {
            return true;
        }

        if (restriction.environments && context?.environment) {
            if (!restriction.environments.includes(context.environment)) {
                return false;
            }
        } else if (restriction.environments && !context?.environment) {
            return false;
        }

        if (restriction.regions && context?.region) {
            if (!restriction.regions.includes(context.region)) {
                return false;
            }
        } else if (restriction.regions && !context?.region) {
            return false;
        }

        if (restriction.requiredLabels) {
            const labels = context?.labels ?? {};
            for (const [key, value] of Object.entries(restriction.requiredLabels)) {
                if (labels[key] !== value) {
                    return false;
                }
            }
        }

        if (restriction.roleIdsAny) {
            const roles = context?.roleIds ?? [];
            if (!restriction.roleIdsAny.some((roleId) => roles.includes(roleId))) {
                return false;
            }
        }

        if (restriction.departmentIdsAny) {
            const departments = context?.departmentIds ?? [];
            if (!restriction.departmentIdsAny.some((deptId) => departments.includes(deptId))) {
                return false;
            }
        }

        return true;
    }

    private toAuthorityCondition(
        restriction: DelegationContextRestriction | undefined
    ): AuthorityPolicyCondition | undefined {
        if (!restriction) {
            return undefined;
        }
        return {
            environments: restriction.environments,
            regions: restriction.regions,
            roleIdsAny: restriction.roleIdsAny,
            departmentIdsAny: restriction.departmentIdsAny
        };
    }

    private matchesPattern(value: string, pattern: string): boolean {
        if (pattern === '*') {
            return true;
        }
        if (!pattern.includes('*')) {
            return value === pattern;
        }
        const escaped = pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*');
        return new RegExp(`^${escaped}$`).test(value);
    }

    private logEvent(
        type: DelegationAuditEventType,
        input: {
            delegationId?: string;
            actorId?: string;
            details: Record<string, unknown>;
        }
    ): void {
        this.auditTrail.push({
            eventId: this.newId('audit'),
            timestamp: this.now(),
            type,
            delegationId: input.delegationId,
            actorId: input.actorId,
            details: input.details
        });

        if (this.auditTraceEngine) {
            const traceId =
                input.delegationId !== undefined
                    ? `delegation_${input.delegationId}`
                    : `delegation_actor_${input.actorId ?? 'system'}`;
            this.auditTraceEngine.startTrace({
                traceId,
                correlationRef: input.delegationId,
                metadata: {
                    delegationId: input.delegationId,
                    actorId: input.actorId
                }
            });
            this.auditTraceEngine.recordEvent({
                traceId,
                domain: 'delegation_event',
                type,
                actorId: input.actorId,
                subjectId: input.delegationId,
                entityId: input.delegationId,
                decision:
                    type === 'delegation_denied'
                        ? 'deny'
                        : type === 'delegation_created'
                            ? 'allow'
                            : type === 'delegation_revoked'
                                ? 'rejected'
                                : 'none',
                complianceTags: ['delegation'],
                details: { ...input.details }
            });
        }
    }

    private newId(prefix: string): string {
        return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${this.now()}`;
    }
}

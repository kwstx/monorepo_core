import {
    AuthorityGraph,
    AuthorityGraphBuildInput,
    AuthorityGraphBuilder,
    AuthorityPolicy,
    AuthorityRule
} from './AuthorityGraphBuilder';

export type ContextTriggerType =
    | 'project_assignment'
    | 'emergency_override'
    | 'compliance_flag'
    | 'regulatory_jurisdiction';

export interface EmergencyOverrideContext {
    active: boolean;
    authorizedBy: string;
    ticketId?: string;
    expiresAt?: number;
}

export interface ContextSignal {
    projectAssignments?: string[];
    emergencyOverride?: EmergencyOverrideContext;
    complianceFlags?: string[];
    regulatoryJurisdiction?: string;
    asOf?: number;
}

export interface ContextPolicyApplication {
    adaptationPolicyId: string;
    triggerType: ContextTriggerType;
    triggerValue: string;
    source: string;
    expiresAt: number;
    policy: AuthorityPolicy;
}

export interface AuthorityDecisionDelta {
    resource: string;
    action: string;
    baseDecision: AuthorityRule['decision'];
    adaptedDecision: AuthorityRule['decision'];
    reasons: string[];
    sources: string[];
}

export interface ContextAdaptationSession {
    adaptationId: string;
    createdAt: number;
    expiresAt: number;
    status: 'active' | 'expired' | 'reverted';
    context: ContextSignal;
    baseGraph: AuthorityGraph;
    adaptedGraph: AuthorityGraph;
    appliedPolicies: ContextPolicyApplication[];
    decisionDelta: AuthorityDecisionDelta[];
    revertedAt?: number;
}

export interface ContextAdaptationAuditEvent {
    adaptationId: string;
    at: number;
    type: 'applied' | 'expired' | 'reverted';
    details: string;
}

export interface ContextAdaptationResult {
    baseGraph: AuthorityGraph;
    adaptedGraph: AuthorityGraph;
    session?: ContextAdaptationSession;
}

export interface ContextAdaptationEngineOptions {
    defaultPolicyTtlMs?: number;
    projectPolicies?: Record<string, AuthorityPolicy[]>;
    compliancePolicies?: Record<string, AuthorityPolicy[]>;
    jurisdictionPolicies?: Record<string, AuthorityPolicy[]>;
    emergencyOverridePolicyFactory?: (context: EmergencyOverrideContext) => AuthorityPolicy[];
}

interface PolicyCollectionContext {
    asOf: number;
    context: ContextSignal;
}

const DEFAULT_POLICY_TTL_MS = 15 * 60 * 1000;

export class ContextAdaptationEngine {
    private readonly options: ContextAdaptationEngineOptions;
    private readonly activeSessions = new Map<string, ContextAdaptationSession>();
    private readonly allSessions = new Map<string, ContextAdaptationSession>();
    private readonly auditTrail: ContextAdaptationAuditEvent[] = [];
    private sequence = 0;

    constructor(
        private readonly graphBuilder: AuthorityGraphBuilder,
        options?: ContextAdaptationEngineOptions
    ) {
        this.options = options ?? {};
    }

    adapt(input: AuthorityGraphBuildInput, context: ContextSignal): ContextAdaptationResult {
        const asOf = context.asOf ?? input.asOf ?? Date.now();
        this.cleanupExpired(asOf);

        const baseInput: AuthorityGraphBuildInput = { ...input, asOf };
        const baseGraph = this.graphBuilder.build(baseInput);
        const appliedPolicies = this.collectContextPolicies({ asOf, context });

        if (appliedPolicies.length === 0) {
            return {
                baseGraph,
                adaptedGraph: baseGraph
            };
        }

        const orgPolicies = [
            ...(input.organizationalGraph.orgPolicies ?? []),
            ...appliedPolicies.map((entry) => entry.policy)
        ];

        const adaptedInput: AuthorityGraphBuildInput = {
            ...input,
            asOf,
            organizationalGraph: {
                ...input.organizationalGraph,
                orgPolicies
            }
        };

        const adaptedGraph = this.graphBuilder.build(adaptedInput);
        const adaptationId = this.nextAdaptationId();
        const expiresAt = Math.min(...appliedPolicies.map((entry) => entry.expiresAt));
        const decisionDelta = this.computeDecisionDelta(baseGraph, adaptedGraph);
        const session: ContextAdaptationSession = {
            adaptationId,
            createdAt: asOf,
            expiresAt,
            status: 'active',
            context: this.cloneContextSignal(context),
            baseGraph,
            adaptedGraph,
            appliedPolicies,
            decisionDelta
        };

        this.activeSessions.set(adaptationId, session);
        this.allSessions.set(adaptationId, session);
        this.auditTrail.push({
            adaptationId,
            at: asOf,
            type: 'applied',
            details: `Applied ${appliedPolicies.length} context policy/policies`
        });

        return {
            baseGraph,
            adaptedGraph,
            session
        };
    }

    revert(adaptationId: string, asOf?: number): AuthorityGraph {
        const session = this.activeSessions.get(adaptationId);
        if (!session) {
            throw new Error(`No active adaptation found for id "${adaptationId}".`);
        }

        const revertedAt = asOf ?? Date.now();
        session.status = 'reverted';
        session.revertedAt = revertedAt;
        this.activeSessions.delete(adaptationId);
        this.auditTrail.push({
            adaptationId,
            at: revertedAt,
            type: 'reverted',
            details: 'Reverted context adaptation to base authority graph'
        });
        return session.baseGraph;
    }

    cleanupExpired(referenceTime: number = Date.now()): string[] {
        const expired: string[] = [];

        for (const [adaptationId, session] of this.activeSessions.entries()) {
            if (session.expiresAt > referenceTime) {
                continue;
            }
            session.status = 'expired';
            this.activeSessions.delete(adaptationId);
            this.auditTrail.push({
                adaptationId,
                at: referenceTime,
                type: 'expired',
                details: 'Context adaptation expired and can no longer be used'
            });
            expired.push(adaptationId);
        }

        return expired;
    }

    getSession(adaptationId: string): ContextAdaptationSession | undefined {
        return this.allSessions.get(adaptationId);
    }

    listActiveSessions(): ContextAdaptationSession[] {
        return [...this.activeSessions.values()];
    }

    getAuditTrail(): ContextAdaptationAuditEvent[] {
        return [...this.auditTrail];
    }

    private collectContextPolicies(collection: PolicyCollectionContext): ContextPolicyApplication[] {
        const result: ContextPolicyApplication[] = [];
        const asOf = collection.asOf;
        const context = collection.context;

        for (const projectId of context.projectAssignments ?? []) {
            const templates = this.options.projectPolicies?.[projectId] ?? [];
            result.push(
                ...this.materializePolicies(
                    templates,
                    'project_assignment',
                    projectId,
                    `project:${projectId}`,
                    asOf,
                    this.defaultExpiry(asOf)
                )
            );
        }

        if (context.emergencyOverride?.active) {
            const override = context.emergencyOverride;
            const templates =
                this.options.emergencyOverridePolicyFactory?.(override) ??
                this.defaultEmergencyOverridePolicies(override);
            const expiry = override.expiresAt ?? this.defaultExpiry(asOf);
            result.push(
                ...this.materializePolicies(
                    templates,
                    'emergency_override',
                    override.ticketId ?? override.authorizedBy,
                    'emergency_override',
                    asOf,
                    expiry
                )
            );
        }

        for (const flag of context.complianceFlags ?? []) {
            const templates = this.options.compliancePolicies?.[flag] ?? [];
            result.push(
                ...this.materializePolicies(
                    templates,
                    'compliance_flag',
                    flag,
                    `compliance:${flag}`,
                    asOf,
                    this.defaultExpiry(asOf)
                )
            );
        }

        if (context.regulatoryJurisdiction) {
            const jurisdiction = context.regulatoryJurisdiction;
            const templates = this.options.jurisdictionPolicies?.[jurisdiction] ?? [];
            result.push(
                ...this.materializePolicies(
                    templates,
                    'regulatory_jurisdiction',
                    jurisdiction,
                    `jurisdiction:${jurisdiction}`,
                    asOf,
                    this.defaultExpiry(asOf)
                )
            );
        }

        return result;
    }

    private materializePolicies(
        policies: AuthorityPolicy[],
        triggerType: ContextTriggerType,
        triggerValue: string,
        source: string,
        asOf: number,
        expiresAt: number
    ): ContextPolicyApplication[] {
        return policies.map((policy, index) => ({
            adaptationPolicyId: `${source}:${index}`,
            triggerType,
            triggerValue,
            source,
            expiresAt,
            policy: {
                ...policy,
                reason: policy.reason ?? `Context adaptation applied (${triggerType}:${triggerValue})`
            }
        }));
    }

    private computeDecisionDelta(
        baseGraph: AuthorityGraph,
        adaptedGraph: AuthorityGraph
    ): AuthorityDecisionDelta[] {
        const baseRules = this.toRuleMap(baseGraph);
        const adaptedRules = this.toRuleMap(adaptedGraph);
        const keys = new Set<string>([...baseRules.keys(), ...adaptedRules.keys()]);
        const deltas: AuthorityDecisionDelta[] = [];

        for (const key of keys) {
            const [resource, action] = key.split('::');
            const base = baseRules.get(key) ?? this.defaultRule(resource, action);
            const adapted = adaptedRules.get(key) ?? this.defaultRule(resource, action);
            if (base.decision === adapted.decision) {
                continue;
            }

            deltas.push({
                resource,
                action,
                baseDecision: base.decision,
                adaptedDecision: adapted.decision,
                reasons: adapted.reasons,
                sources: adapted.sources
            });
        }

        return deltas.sort((a, b) =>
            `${a.resource}:${a.action}`.localeCompare(`${b.resource}:${b.action}`)
        );
    }

    private toRuleMap(graph: AuthorityGraph): Map<string, AuthorityRule> {
        const map = new Map<string, AuthorityRule>();
        const allRules = [...graph.canExecute, ...graph.requiresApproval, ...graph.prohibited];
        for (const rule of allRules) {
            map.set(`${rule.resource}::${rule.action}`, rule);
        }
        return map;
    }

    private defaultRule(resource: string, action: string): AuthorityRule {
        return {
            resource,
            action,
            decision: 'prohibited',
            reasons: ['Implicit deny: no matching allow rule'],
            sources: ['default']
        };
    }

    private defaultEmergencyOverridePolicies(context: EmergencyOverrideContext): AuthorityPolicy[] {
        return [
            {
                resource: '*',
                actions: ['*'],
                effect: 'require_approval',
                reason: `Emergency override active (authorized by ${context.authorizedBy})`,
                constraints: {
                    emergencyOverride: true,
                    ticketId: context.ticketId
                }
            }
        ];
    }

    private cloneContextSignal(context: ContextSignal): ContextSignal {
        return {
            ...context,
            projectAssignments: context.projectAssignments
                ? [...context.projectAssignments]
                : undefined,
            complianceFlags: context.complianceFlags ? [...context.complianceFlags] : undefined,
            emergencyOverride: context.emergencyOverride
                ? { ...context.emergencyOverride }
                : undefined
        };
    }

    private defaultExpiry(asOf: number): number {
        const ttl = this.options.defaultPolicyTtlMs ?? DEFAULT_POLICY_TTL_MS;
        return asOf + ttl;
    }

    private nextAdaptationId(): string {
        this.sequence += 1;
        return `ctx_adapt_${Date.now()}_${this.sequence}`;
    }
}

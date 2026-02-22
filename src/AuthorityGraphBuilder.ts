import { AgentIdentityPayload } from './types';
import { IdentityClaimSet, PermissionScope } from './IdentityIntegrationLayer';

export type AuthorityDecision = 'can_execute' | 'requires_approval' | 'prohibited';
export type AuthorityPolicyEffect = 'allow' | 'require_approval' | 'deny';

export interface AuthorityPolicyCondition {
    environments?: AgentIdentityPayload['context']['environment'][];
    regions?: string[];
    roleIdsAny?: string[];
    departmentIdsAny?: string[];
}

export interface AuthorityPolicy {
    resource: string;
    actions: string[];
    effect: AuthorityPolicyEffect;
    reason?: string;
    constraints?: Record<string, unknown>;
    condition?: AuthorityPolicyCondition;
}

export interface DelegatedPermission extends AuthorityPolicy {
    delegationId: string;
    grantorId: string;
    granteeAgentId: string;
    issuedAt: number;
    expiresAt?: number;
}

export interface OrganizationalGraphData {
    orgId: string;
    orgPolicies?: AuthorityPolicy[];
    rolePolicies?: Record<string, AuthorityPolicy[]>;
    departmentPolicies?: Record<string, AuthorityPolicy[]>;
}

export interface AuthorityGraphBuildInput {
    identity: AgentIdentityPayload;
    identityClaims: IdentityClaimSet;
    organizationalGraph: OrganizationalGraphData;
    delegatedPermissions?: DelegatedPermission[];
    asOf?: number;
}

export interface AuthorityRule {
    resource: string;
    action: string;
    decision: AuthorityDecision;
    reasons: string[];
    sources: string[];
    constraints?: Record<string, unknown>;
}

export interface AuthorityGraphNode {
    id: string;
    type: 'agent' | 'owner' | 'organization' | 'role' | 'department' | 'permission' | 'delegation';
    label: string;
}

export interface AuthorityGraphEdge {
    from: string;
    to: string;
    relation: string;
}

export interface AuthorityGraph {
    agentId: string;
    ownerId: string;
    orgId: string;
    generatedAt: number;
    canExecute: AuthorityRule[];
    requiresApproval: AuthorityRule[];
    prohibited: AuthorityRule[];
    defaultDecision: AuthorityDecision;
    nodes: AuthorityGraphNode[];
    edges: AuthorityGraphEdge[];
}

interface EffectivePolicy extends AuthorityPolicy {
    source: string;
}

export class AuthorityGraphBuilder {
    build(input: AuthorityGraphBuildInput): AuthorityGraph {
        const generatedAt = input.asOf ?? Date.now();
        const effectivePolicies = this.collectPolicies(input, generatedAt);
        const candidatePairs = this.collectCandidatePairs(input, effectivePolicies);
        const evaluated = candidatePairs.map((pair) =>
            this.evaluatePermission(pair.resource, pair.action, effectivePolicies)
        );

        return {
            agentId: input.identity.agentId,
            ownerId: input.identity.ownerId,
            orgId: input.identity.orgId,
            generatedAt,
            canExecute: evaluated.filter((rule) => rule.decision === 'can_execute'),
            requiresApproval: evaluated.filter((rule) => rule.decision === 'requires_approval'),
            prohibited: evaluated.filter((rule) => rule.decision === 'prohibited'),
            defaultDecision: 'prohibited',
            nodes: this.buildNodes(input, evaluated),
            edges: this.buildEdges(input, evaluated)
        };
    }

    resolveDecision(
        graph: AuthorityGraph,
        input: AuthorityGraphBuildInput,
        resource: string,
        action: string
    ): AuthorityRule {
        const match =
            graph.canExecute.find((rule) => rule.resource === resource && rule.action === action) ??
            graph.requiresApproval.find(
                (rule) => rule.resource === resource && rule.action === action
            ) ??
            graph.prohibited.find((rule) => rule.resource === resource && rule.action === action);

        if (match) {
            return match;
        }

        const asOf = input.asOf ?? Date.now();
        const effectivePolicies = this.collectPolicies(input, asOf);
        return this.evaluatePermission(resource, action, effectivePolicies);
    }

    private collectPolicies(input: AuthorityGraphBuildInput, asOf: number): EffectivePolicy[] {
        const result: EffectivePolicy[] = [];

        result.push(
            ...this.scopeToPolicies(input.identity.scope.resources, input.identity.scope.actions).map(
                (policy) => ({ ...policy, source: 'identity.scope' })
            )
        );

        result.push(
            ...this.permissionScopesToPolicies(input.identityClaims.permissionScopes).map((policy) => ({
                ...policy,
                source: 'identity.claims.permissionScopes'
            }))
        );

        if (input.organizationalGraph.orgId === input.identity.orgId) {
            result.push(
                ...(input.organizationalGraph.orgPolicies ?? []).map((policy) => ({
                    ...policy,
                    source: 'organizationalGraph.orgPolicies'
                }))
            );
        }

        for (const roleId of input.identityClaims.roles.resolved) {
            const policies = input.organizationalGraph.rolePolicies?.[roleId] ?? [];
            result.push(
                ...policies.map((policy) => ({
                    ...policy,
                    source: `organizationalGraph.rolePolicies:${roleId}`
                }))
            );
        }

        for (const departmentId of input.identityClaims.departments.lineage) {
            const policies = input.organizationalGraph.departmentPolicies?.[departmentId] ?? [];
            result.push(
                ...policies.map((policy) => ({
                    ...policy,
                    source: `organizationalGraph.departmentPolicies:${departmentId}`
                }))
            );
        }

        for (const delegation of input.delegatedPermissions ?? []) {
            if (delegation.granteeAgentId !== input.identity.agentId) {
                continue;
            }
            if (delegation.expiresAt && delegation.expiresAt < asOf) {
                continue;
            }
            if (delegation.issuedAt > asOf) {
                continue;
            }

            result.push({
                ...delegation,
                source: `delegation:${delegation.delegationId}`
            });
        }

        return result.filter((policy) => this.policyMatchesContext(policy, input.identityClaims, input.identity));
    }

    private collectCandidatePairs(
        input: AuthorityGraphBuildInput,
        policies: EffectivePolicy[]
    ): Array<{ resource: string; action: string }> {
        const resources = new Set<string>();
        const actions = new Set<string>();

        for (const resource of input.identity.scope.resources) {
            if (resource !== '*') {
                resources.add(resource);
            }
        }
        for (const action of input.identity.scope.actions) {
            if (action !== '*') {
                actions.add(action);
            }
        }

        for (const scope of input.identityClaims.permissionScopes) {
            if (scope.resource !== '*') {
                resources.add(scope.resource);
            }
            for (const action of scope.actions) {
                if (action !== '*') {
                    actions.add(action);
                }
            }
        }

        for (const policy of policies) {
            if (policy.resource !== '*') {
                resources.add(policy.resource);
            }
            for (const action of policy.actions) {
                if (action !== '*') {
                    actions.add(action);
                }
            }
        }

        if (resources.size === 0) {
            resources.add('*');
        }
        if (actions.size === 0) {
            actions.add('*');
        }

        const pairs = new Set<string>();
        for (const policy of policies) {
            const resourceTargets =
                policy.resource === '*' ? [...resources] : [policy.resource];
            const actionTargets = policy.actions.includes('*')
                ? [...actions]
                : [...policy.actions];

            for (const resource of resourceTargets) {
                for (const action of actionTargets) {
                    pairs.add(`${resource}::${action}`);
                }
            }
        }

        return [...pairs]
            .map((key) => {
                const [resource, action] = key.split('::');
                return { resource, action };
            })
            .sort((a, b) => `${a.resource}:${a.action}`.localeCompare(`${b.resource}:${b.action}`));
    }

    private evaluatePermission(
        resource: string,
        action: string,
        policies: EffectivePolicy[]
    ): AuthorityRule {
        const matches = policies.filter(
            (policy) =>
                this.valueMatchesPattern(resource, policy.resource) &&
                policy.actions.some((candidateAction) =>
                    this.valueMatchesPattern(action, candidateAction)
                )
        );

        const denyMatches = matches.filter((policy) => policy.effect === 'deny');
        if (denyMatches.length > 0) {
            return this.toRule(resource, action, 'prohibited', denyMatches, 'Denied by policy');
        }

        const approvalMatches = matches.filter((policy) => policy.effect === 'require_approval');
        if (approvalMatches.length > 0) {
            return this.toRule(
                resource,
                action,
                'requires_approval',
                approvalMatches,
                'Approval required by policy'
            );
        }

        const allowMatches = matches.filter((policy) => policy.effect === 'allow');
        if (allowMatches.length > 0) {
            return this.toRule(resource, action, 'can_execute', allowMatches, 'Allowed by policy');
        }

        return {
            resource,
            action,
            decision: 'prohibited',
            reasons: ['Implicit deny: no matching allow rule'],
            sources: ['default']
        };
    }

    private toRule(
        resource: string,
        action: string,
        decision: AuthorityDecision,
        policies: EffectivePolicy[],
        defaultReason: string
    ): AuthorityRule {
        const reasons = policies.map((policy) => policy.reason ?? defaultReason);
        const constraints = policies
            .map((policy) => policy.constraints)
            .filter((value): value is Record<string, unknown> => Boolean(value))
            .reduce<Record<string, unknown>>((acc, current) => ({ ...acc, ...current }), {});

        return {
            resource,
            action,
            decision,
            reasons,
            sources: policies.map((policy) => policy.source),
            constraints: Object.keys(constraints).length > 0 ? constraints : undefined
        };
    }

    private buildNodes(input: AuthorityGraphBuildInput, rules: AuthorityRule[]): AuthorityGraphNode[] {
        const nodes: AuthorityGraphNode[] = [
            { id: `agent:${input.identity.agentId}`, type: 'agent', label: input.identity.agentId },
            { id: `owner:${input.identity.ownerId}`, type: 'owner', label: input.identity.ownerId },
            { id: `org:${input.identity.orgId}`, type: 'organization', label: input.identity.orgId }
        ];

        for (const roleId of input.identityClaims.roles.resolved) {
            nodes.push({ id: `role:${roleId}`, type: 'role', label: roleId });
        }
        for (const departmentId of input.identityClaims.departments.lineage) {
            nodes.push({ id: `department:${departmentId}`, type: 'department', label: departmentId });
        }
        for (const rule of rules) {
            nodes.push({
                id: `permission:${rule.resource}:${rule.action}`,
                type: 'permission',
                label: `${rule.resource}:${rule.action}:${rule.decision}`
            });
        }
        for (const delegation of input.delegatedPermissions ?? []) {
            if (delegation.granteeAgentId !== input.identity.agentId) {
                continue;
            }
            nodes.push({
                id: `delegation:${delegation.delegationId}`,
                type: 'delegation',
                label: delegation.delegationId
            });
        }

        return this.uniqueBy(nodes, (node) => node.id);
    }

    private buildEdges(input: AuthorityGraphBuildInput, rules: AuthorityRule[]): AuthorityGraphEdge[] {
        const edges: AuthorityGraphEdge[] = [
            {
                from: `owner:${input.identity.ownerId}`,
                to: `agent:${input.identity.agentId}`,
                relation: 'owns'
            },
            {
                from: `agent:${input.identity.agentId}`,
                to: `org:${input.identity.orgId}`,
                relation: 'member_of'
            }
        ];

        for (const roleId of input.identityClaims.roles.resolved) {
            edges.push({
                from: `agent:${input.identity.agentId}`,
                to: `role:${roleId}`,
                relation: 'assigned_role'
            });
        }

        for (const departmentId of input.identityClaims.departments.lineage) {
            edges.push({
                from: `agent:${input.identity.agentId}`,
                to: `department:${departmentId}`,
                relation: 'in_department_lineage'
            });
        }

        for (const rule of rules) {
            edges.push({
                from: `agent:${input.identity.agentId}`,
                to: `permission:${rule.resource}:${rule.action}`,
                relation: rule.decision
            });
        }

        for (const delegation of input.delegatedPermissions ?? []) {
            if (delegation.granteeAgentId !== input.identity.agentId) {
                continue;
            }
            edges.push({
                from: `delegation:${delegation.delegationId}`,
                to: `agent:${input.identity.agentId}`,
                relation: 'delegated_to'
            });
        }

        return this.uniqueBy(
            edges,
            (edge) => `${edge.from}->${edge.to}:${edge.relation}`
        );
    }

    private scopeToPolicies(resources: string[], actions: string[]): AuthorityPolicy[] {
        return resources.map((resource) => ({
            resource,
            actions: [...actions],
            effect: 'allow' as const,
            reason: 'Allowed by identity scope'
        }));
    }

    private permissionScopesToPolicies(scopes: PermissionScope[]): AuthorityPolicy[] {
        return scopes.map((scope) => ({
            resource: scope.resource,
            actions: [...scope.actions],
            constraints: scope.constraints,
            effect: 'allow' as const,
            reason: 'Allowed by synchronized identity claim scope'
        }));
    }

    private policyMatchesContext(
        policy: AuthorityPolicy,
        claims: IdentityClaimSet,
        identity: AgentIdentityPayload
    ): boolean {
        const condition = policy.condition;
        if (!condition) {
            return true;
        }

        if (
            condition.environments &&
            !condition.environments.includes(identity.context.environment)
        ) {
            return false;
        }
        if (
            condition.regions &&
            (!identity.context.region || !condition.regions.includes(identity.context.region))
        ) {
            return false;
        }
        if (
            condition.roleIdsAny &&
            !condition.roleIdsAny.some((roleId) => claims.roles.resolved.includes(roleId))
        ) {
            return false;
        }
        if (
            condition.departmentIdsAny &&
            !condition.departmentIdsAny.some((departmentId) =>
                claims.departments.lineage.includes(departmentId)
            )
        ) {
            return false;
        }

        return true;
    }

    private valueMatchesPattern(value: string, pattern: string): boolean {
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

    private uniqueBy<T>(items: T[], keySelector: (item: T) => string): T[] {
        const byKey = new Map<string, T>();
        for (const item of items) {
            byKey.set(keySelector(item), item);
        }
        return [...byKey.values()];
    }
}

import { v4 as uuidv4 } from 'uuid';
import { AgentAction } from './ActionValidationTypes';
import { AuthorityGraph, AuthorityRule } from './AuthorityGraphBuilder';
import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import {
    ApprovalChainEvent,
    ApprovalDecisionPolicy,
    ApprovalDomain,
    ApprovalRoute,
    ApprovalRoutingResult,
    ApprovalRoutingRule,
    ApprovalStep,
    ApprovalWorkflowMode,
    ApprovalWorkflowStepDefinition,
    DomainApproverConfig
} from './ApprovalRoutingTypes';

interface ApprovalRoutingEngineOptions {
    orgGraph: OrganizationalGraphEngine;
    rules?: ApprovalRoutingRule[];
    domainApprovers?: Partial<Record<ApprovalDomain, DomainApproverConfig>>;
}

interface RouteRequestInput {
    action: AgentAction;
    authorityGraph: AuthorityGraph;
    traceId?: string;
}

interface SubmitApprovalDecisionInput {
    routeId: string;
    stepId: string;
    approverId: string;
    approved: boolean;
    timestamp?: number;
}

export class ApprovalRoutingEngine {
    private readonly orgGraph: OrganizationalGraphEngine;
    private readonly rules: ApprovalRoutingRule[];
    private readonly domainApprovers: Partial<Record<ApprovalDomain, DomainApproverConfig>>;
    private readonly routes = new Map<string, ApprovalRoute>();

    constructor(options: ApprovalRoutingEngineOptions) {
        this.orgGraph = options.orgGraph;
        this.rules = [...(options.rules ?? [])].sort(
            (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
        );
        this.domainApprovers = options.domainApprovers ?? {};
    }

    public routeRequest(input: RouteRequestInput): ApprovalRoutingResult {
        const { action, authorityGraph } = input;
        const rule = this.findMatchingRule(action, authorityGraph);
        const reasons: string[] = [];
        const domains = new Set<ApprovalDomain>();
        const crossDeptApprovers = this.getCrossDepartmentApprovers(action);

        if (rule?.decision === 'requires_approval') {
            domains.add('managerial');
            reasons.push(...rule.reasons);
        }

        if (crossDeptApprovers.length > 0) {
            domains.add('cross_departmental');
            reasons.push('Cross-department dependency requires target department approval.');
        }

        const matchedRoutingRules = this.rules.filter((candidate) =>
            this.matchesRoutingRule(candidate, action, crossDeptApprovers.length > 0)
        );

        let workflow: ApprovalWorkflowMode = 'sequential';
        let workflowSteps: ApprovalWorkflowStepDefinition[] | undefined;
        for (const matchedRule of matchedRoutingRules) {
            for (const domain of matchedRule.addDomains ?? []) {
                domains.add(domain);
            }
            if (matchedRule.workflow) {
                workflow = matchedRule.workflow;
            }
            if (matchedRule.workflowSteps) {
                workflowSteps = matchedRule.workflowSteps;
            }
            if (matchedRule.reason) {
                reasons.push(matchedRule.reason);
            }
        }

        if (domains.size === 0) {
            return { requiresApproval: false };
        }

        const routeId = uuidv4();
        const traceId = input.traceId ?? uuidv4();
        const requestedDomains = [...domains];
        const steps = this.buildSteps({
            action,
            requestedDomains,
            workflow,
            workflowSteps,
            crossDeptApprovers
        });
        const events: ApprovalChainEvent[] = [];

        for (const step of steps) {
            events.push(
                this.createEvent(routeId, {
                    stepId: step.stepId,
                    type: 'ROUTED',
                    message: `Approval step '${step.stepId}' routed with domains: ${step.domains.join(
                        ', '
                    )}.`
                })
            );
            if (step.status === 'pending') {
                events.push(
                    this.createEvent(routeId, {
                        stepId: step.stepId,
                        type: 'STEP_UNLOCKED',
                        message: `Approval step '${step.stepId}' is ready for validation.`
                    })
                );
            }
        }

        const route: ApprovalRoute = {
            routeId,
            traceId,
            requestRef: {
                agentId: action.agentId,
                action: action.action,
                resource: action.resource,
                resourceOwnerId: action.resourceOwnerId
            },
            domains: requestedDomains,
            status: 'pending',
            reasons: reasons.length > 0 ? reasons : ['Approval required by routing policy.'],
            steps,
            events
        };

        this.routes.set(routeId, route);
        return {
            requiresApproval: true,
            route: this.cloneRoute(route)
        };
    }

    public submitApprovalDecision(input: SubmitApprovalDecisionInput): ApprovalRoute {
        const route = this.routes.get(input.routeId);
        if (!route) {
            throw new Error(`Unknown routeId '${input.routeId}'.`);
        }
        if (route.status !== 'pending') {
            throw new Error(`Route '${input.routeId}' is already ${route.status}.`);
        }

        const step = route.steps.find((candidate) => candidate.stepId === input.stepId);
        if (!step) {
            throw new Error(`Unknown stepId '${input.stepId}' for route '${input.routeId}'.`);
        }
        if (step.status === 'locked') {
            throw new Error(`Step '${input.stepId}' is locked by sequential dependencies.`);
        }
        if (!step.approverIds.includes(input.approverId)) {
            throw new Error(
                `Approver '${input.approverId}' is not authorized for step '${input.stepId}'.`
            );
        }
        if (step.status === 'approved' || step.status === 'rejected') {
            throw new Error(`Step '${input.stepId}' is already ${step.status}.`);
        }

        if (input.approved) {
            if (!step.approvedBy.includes(input.approverId)) {
                step.approvedBy.push(input.approverId);
            }
            route.events.push(
                this.createEvent(route.routeId, {
                    stepId: step.stepId,
                    approverId: input.approverId,
                    type: 'APPROVED',
                    message: `Approver '${input.approverId}' approved step '${step.stepId}'.`,
                    timestamp: input.timestamp
                })
            );
        } else {
            if (!step.rejectedBy.includes(input.approverId)) {
                step.rejectedBy.push(input.approverId);
            }
            step.status = 'rejected';
            route.status = 'rejected';
            route.events.push(
                this.createEvent(route.routeId, {
                    stepId: step.stepId,
                    approverId: input.approverId,
                    type: 'REJECTED',
                    message: `Approver '${input.approverId}' rejected step '${step.stepId}'.`,
                    timestamp: input.timestamp
                })
            );
            route.events.push(
                this.createEvent(route.routeId, {
                    stepId: step.stepId,
                    type: 'STEP_REJECTED',
                    message: `Step '${step.stepId}' rejected. Route rejected.`
                })
            );
            return this.cloneRoute(route);
        }

        if (this.isStepSatisfied(step)) {
            step.status = 'approved';
            route.events.push(
                this.createEvent(route.routeId, {
                    stepId: step.stepId,
                    type: 'STEP_APPROVED',
                    message: `Step '${step.stepId}' fully approved.`
                })
            );
            this.unlockDependentSteps(route, step.stepId);
        }

        if (route.steps.every((candidate) => candidate.status === 'approved')) {
            route.status = 'approved';
        }

        return this.cloneRoute(route);
    }

    public getRoute(routeId: string): ApprovalRoute | undefined {
        const route = this.routes.get(routeId);
        return route ? this.cloneRoute(route) : undefined;
    }

    public getApprovalChains(): ApprovalRoute[] {
        return [...this.routes.values()].map((route) => this.cloneRoute(route));
    }

    private buildSteps(input: {
        action: AgentAction;
        requestedDomains: ApprovalDomain[];
        workflow: ApprovalWorkflowMode;
        workflowSteps?: ApprovalWorkflowStepDefinition[];
        crossDeptApprovers: string[];
    }): ApprovalStep[] {
        if (input.workflowSteps && input.workflowSteps.length > 0) {
            return this.materializeCustomSteps(input.workflowSteps, input.action, input.crossDeptApprovers);
        }

        if (input.workflow === 'parallel') {
            return input.requestedDomains.map((domain) =>
                this.createStep(
                    {
                        stepId: `parallel_${domain}`,
                        mode: 'parallel',
                        domains: [domain]
                    },
                    input.action,
                    input.crossDeptApprovers,
                    []
                )
            );
        }

        const orderedDomains: ApprovalDomain[] = [
            'managerial',
            'financial',
            'legal',
            'cross_departmental'
        ];

        const selected = orderedDomains.filter((domain) => input.requestedDomains.includes(domain));
        const steps: ApprovalStep[] = [];
        for (let index = 0; index < selected.length; index++) {
            const domain = selected[index];
            const prev = index > 0 ? [steps[index - 1].stepId] : [];
            steps.push(
                this.createStep(
                    {
                        stepId: `sequential_${index + 1}_${domain}`,
                        mode: 'sequential',
                        domains: [domain]
                    },
                    input.action,
                    input.crossDeptApprovers,
                    prev
                )
            );
        }
        return steps;
    }

    private materializeCustomSteps(
        definitions: ApprovalWorkflowStepDefinition[],
        action: AgentAction,
        crossDeptApprovers: string[]
    ): ApprovalStep[] {
        const result: ApprovalStep[] = [];

        for (let index = 0; index < definitions.length; index++) {
            const definition = definitions[index];
            const previousStep =
                definition.mode === 'sequential' && index > 0
                    ? [definitions[index - 1].stepId]
                    : [];
            result.push(this.createStep(definition, action, crossDeptApprovers, previousStep));
        }

        return result;
    }

    private createStep(
        definition: ApprovalWorkflowStepDefinition,
        action: AgentAction,
        crossDeptApprovers: string[],
        dependsOn: string[]
    ): ApprovalStep {
        const approverSet = new Set<string>();
        let decisionPolicy: ApprovalDecisionPolicy = definition.decisionPolicy ?? 'any';

        for (const domain of definition.domains) {
            const configured = this.getDomainApprovers(domain, action, crossDeptApprovers);
            for (const approverId of configured.approverIds ?? []) {
                approverSet.add(approverId);
            }
            if (configured.decisionPolicy === 'all') {
                decisionPolicy = 'all';
            }
        }

        return {
            stepId: definition.stepId,
            mode: definition.mode,
            domains: definition.domains,
            approverIds: [...approverSet],
            decisionPolicy,
            dependsOnStepIds: dependsOn,
            status: dependsOn.length > 0 ? 'locked' : 'pending',
            approvedBy: [],
            rejectedBy: []
        };
    }

    private getDomainApprovers(
        domain: ApprovalDomain,
        action: AgentAction,
        crossDeptApprovers: string[]
    ): DomainApproverConfig {
        if (domain === 'managerial') {
            const managerApprover = this.orgGraph.getReportingChain(action.agentId)[0];
            const configured = this.domainApprovers.managerial ?? {};
            const configuredApprovers = configured.approverIds ?? [];
            const managerApprovers = managerApprover ? [managerApprover] : [];
            return {
                approverIds: this.unique([...configuredApprovers, ...managerApprovers]),
                decisionPolicy: configured.decisionPolicy ?? 'any'
            };
        }

        if (domain === 'cross_departmental') {
            const configured = this.domainApprovers.cross_departmental ?? {};
            return {
                approverIds: this.unique([...(configured.approverIds ?? []), ...crossDeptApprovers]),
                decisionPolicy: configured.decisionPolicy ?? 'all'
            };
        }

        const configured = this.domainApprovers[domain] ?? {};
        return {
            approverIds: configured.approverIds ?? [],
            decisionPolicy: configured.decisionPolicy ?? 'any'
        };
    }

    private unlockDependentSteps(route: ApprovalRoute, completedStepId: string): void {
        for (const step of route.steps) {
            if (
                step.status === 'locked' &&
                step.dependsOnStepIds.includes(completedStepId) &&
                step.dependsOnStepIds.every((dependency) =>
                    route.steps.some(
                        (candidate) =>
                            candidate.stepId === dependency && candidate.status === 'approved'
                    )
                )
            ) {
                step.status = 'pending';
                route.events.push(
                    this.createEvent(route.routeId, {
                        stepId: step.stepId,
                        type: 'STEP_UNLOCKED',
                        message: `Step '${step.stepId}' unlocked after dependencies were approved.`
                    })
                );
            }
        }
    }

    private isStepSatisfied(step: ApprovalStep): boolean {
        if (step.decisionPolicy === 'all') {
            return step.approverIds.length > 0 && step.approvedBy.length >= step.approverIds.length;
        }
        return step.approvedBy.length > 0;
    }

    private getCrossDepartmentApprovers(action: AgentAction): string[] {
        if (!action.resourceOwnerId) {
            return [];
        }
        return this.orgGraph.getRequiredApprovers(action.agentId, action.resourceOwnerId);
    }

    private matchesRoutingRule(
        rule: ApprovalRoutingRule,
        action: AgentAction,
        isCrossDepartment: boolean
    ): boolean {
        if (rule.resourcePattern && !this.matchesPattern(action.resource, rule.resourcePattern)) {
            return false;
        }
        if (rule.actionPattern && !this.matchesPattern(action.action, rule.actionPattern)) {
            return false;
        }
        if (
            rule.environments &&
            !rule.environments.includes(action.context.environment)
        ) {
            return false;
        }
        if (rule.requiresCrossDepartment && !isCrossDepartment) {
            return false;
        }

        const amount = action.context.metadata?.amount;
        if (typeof rule.requiresAmountAtLeast === 'number') {
            if (typeof amount !== 'number' || amount < rule.requiresAmountAtLeast) {
                return false;
            }
        }

        return true;
    }

    private findMatchingRule(action: AgentAction, graph: AuthorityGraph): AuthorityRule | undefined {
        const exact =
            graph.requiresApproval.find(
                (candidate) =>
                    candidate.resource === action.resource && candidate.action === action.action
            ) ??
            graph.canExecute.find(
                (candidate) =>
                    candidate.resource === action.resource && candidate.action === action.action
            ) ??
            graph.prohibited.find(
                (candidate) =>
                    candidate.resource === action.resource && candidate.action === action.action
            );
        if (exact) {
            return exact;
        }

        return [...graph.requiresApproval, ...graph.canExecute, ...graph.prohibited].find(
            (candidate) =>
                this.matchesPattern(action.resource, candidate.resource) &&
                this.matchesPattern(action.action, candidate.action)
        );
    }

    private matchesPattern(value: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (!pattern.includes('*')) return value === pattern;
        const escaped = pattern
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*');
        return new RegExp(`^${escaped}$`).test(value);
    }

    private createEvent(
        routeId: string,
        input: {
            type: ApprovalChainEvent['type'];
            message: string;
            timestamp?: number;
            stepId?: string;
            approverId?: string;
        }
    ): ApprovalChainEvent {
        return {
            id: uuidv4(),
            routeId,
            stepId: input.stepId,
            approverId: input.approverId,
            type: input.type,
            message: input.message,
            timestamp: input.timestamp ?? Date.now()
        };
    }

    private cloneRoute(route: ApprovalRoute): ApprovalRoute {
        return JSON.parse(JSON.stringify(route)) as ApprovalRoute;
    }

    private unique(items: string[]): string[] {
        return [...new Set(items)];
    }
}

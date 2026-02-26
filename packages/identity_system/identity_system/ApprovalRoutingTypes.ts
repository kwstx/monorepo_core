export type ApprovalDomain =
    | 'managerial'
    | 'legal'
    | 'financial'
    | 'cross_departmental';

export type ApprovalWorkflowMode = 'sequential' | 'parallel';
export type ApprovalDecisionPolicy = 'any' | 'all';
export type ApprovalStepStatus = 'locked' | 'pending' | 'approved' | 'rejected';
export type ApprovalRouteStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalEventType =
    | 'ROUTED'
    | 'STEP_UNLOCKED'
    | 'APPROVED'
    | 'REJECTED'
    | 'STEP_APPROVED'
    | 'STEP_REJECTED';

export interface ApprovalWorkflowStepDefinition {
    stepId: string;
    mode: ApprovalWorkflowMode;
    domains: ApprovalDomain[];
    decisionPolicy?: ApprovalDecisionPolicy;
}

export interface DomainApproverConfig {
    approverIds?: string[];
    decisionPolicy?: ApprovalDecisionPolicy;
}

export interface ApprovalRoutingRule {
    id: string;
    resourcePattern?: string;
    actionPattern?: string;
    environments?: Array<'production' | 'staging' | 'development'>;
    requiresAmountAtLeast?: number;
    requiresCrossDepartment?: boolean;
    addDomains?: ApprovalDomain[];
    workflow?: ApprovalWorkflowMode;
    workflowSteps?: ApprovalWorkflowStepDefinition[];
    reason?: string;
    priority?: number;
}

export interface ApprovalChainEvent {
    id: string;
    routeId: string;
    stepId?: string;
    approverId?: string;
    type: ApprovalEventType;
    message: string;
    timestamp: number;
}

export interface ApprovalStep {
    stepId: string;
    mode: ApprovalWorkflowMode;
    domains: ApprovalDomain[];
    approverIds: string[];
    decisionPolicy: ApprovalDecisionPolicy;
    dependsOnStepIds: string[];
    status: ApprovalStepStatus;
    approvedBy: string[];
    rejectedBy: string[];
}

export interface ApprovalRoute {
    routeId: string;
    traceId: string;
    requestRef: {
        agentId: string;
        action: string;
        resource: string;
        resourceOwnerId?: string;
    };
    domains: ApprovalDomain[];
    status: ApprovalRouteStatus;
    reasons: string[];
    steps: ApprovalStep[];
    events: ApprovalChainEvent[];
}

export interface ApprovalRoutingResult {
    requiresApproval: boolean;
    route?: ApprovalRoute;
}

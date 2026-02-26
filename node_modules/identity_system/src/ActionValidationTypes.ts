export interface AgentAction {
    agentId: string;
    action: string;
    resource: string;
    resourceOwnerId?: string; // ID of the entity that owns the resource
    context: {
        environment: 'production' | 'staging' | 'development';
        region?: string;
        timestamp: number;
        metadata?: Record<string, any>;
    };
}

export interface ValidationViolation {
    code: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    authorized: boolean;
    violations: ValidationViolation[];
    requiredApprovals: string[];
    isDelegated: boolean;
    traceId: string;
}

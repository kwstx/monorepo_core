import { AgentAction, ValidationResult, ValidationViolation } from './ActionValidationTypes';
import { PortableAuthorityToken, VerificationResult } from './VerificationProtocolTypes';
import { ActionValidationEngine } from './ActionValidationEngine';
import { AuthorityVerificationProtocol } from './AuthorityVerificationProtocol';
import { AuthorityGraph } from './AuthorityGraphBuilder';
import { v4 as uuidv4 } from 'uuid';
import { AuditTraceEngine } from './AuditTraceEngine';

export interface EnforcementResult {
    allowed: boolean;
    anomalies: EnforcementAnomaly[];
    traceId: string;
    auditLogId: string;
    timestamp: number;
}

export interface EnforcementAnomaly {
    type: 'UNVERIFIED_TOKEN' | 'BYPASSED_APPROVAL' | 'SCOPE_ESCALATION' | 'UNAUTHORIZED_PATHWAY' | 'CONTEXT_VIOLATION';
    severity: 'critical' | 'high' | 'medium';
    message: string;
    details?: any;
}

export interface SecurityEnforcementOptions {
    validationEngine: ActionValidationEngine;
    trustedRootPublicKeys: string[];
    enableAuditLogging?: boolean;
    auditTraceEngine?: AuditTraceEngine;
}

export class SecurityEnforcementLayer {
    private validationEngine: ActionValidationEngine;
    private trustedRootPublicKeys: string[];
    private auditLogs: any[] = [];
    private enableAuditLogging: boolean;
    private readonly auditTraceEngine?: AuditTraceEngine;

    constructor(options: SecurityEnforcementOptions) {
        this.validationEngine = options.validationEngine;
        this.trustedRootPublicKeys = options.trustedRootPublicKeys;
        this.enableAuditLogging = options.enableAuditLogging ?? true;
        this.auditTraceEngine = options.auditTraceEngine;
    }

    /**
     * Enforces security policies on an incoming action.
     * This is the final gateway before execution.
     * @returns The outcome including whether execution is allowed.
     */
    public enforce(
        action: AgentAction,
        token: PortableAuthorityToken,
        authorityGraph: AuthorityGraph
    ): EnforcementResult {
        const traceId = uuidv4();
        const timestamp = Date.now();
        const anomalies: EnforcementAnomaly[] = [];
        this.auditTraceEngine?.startTrace({
            traceId,
            metadata: {
                agentId: action.agentId,
                action: action.action,
                resource: action.resource
            }
        });

        // 1. Verify Identity Token & Authority Pathway
        const verificationResult = AuthorityVerificationProtocol.verifyPortableToken(
            token,
            this.trustedRootPublicKeys
        );
        this.auditTraceEngine?.recordEvent({
            traceId,
            domain: 'enforcement_decision',
            type: 'token_verification',
            actorId: action.agentId,
            subjectId: action.agentId,
            decision: verificationResult.isValid ? 'allow' : 'deny',
            complianceTags: ['enforcement', 'token'],
            details: {
                isValid: verificationResult.isValid,
                reason: verificationResult.reason,
                trustChainStatus: verificationResult.trustChainStatus
            }
        });

        if (!verificationResult.isValid) {
            anomalies.push({
                type: 'UNVERIFIED_TOKEN',
                severity: 'critical',
                message: `Identity token verification failed: ${verificationResult.reason}`,
                details: { trustChainStatus: verificationResult.trustChainStatus }
            });
        }

        // 2. Validate Action against Authority Graph
        const validationResult = this.validationEngine.validateAction(action, authorityGraph, { traceId });

        // 3. Detect Anomalies
        this.detectAnomalies(action, token, validationResult, anomalies);

        // 4. Determine final allowance
        // Use a strict blocking policy: any critical or high anomaly blocks execution.
        const hasBlockingAnomaly = anomalies.some(a => a.severity === 'critical' || a.severity === 'high');
        const allowed = validationResult.authorized && verificationResult.isValid && !hasBlockingAnomaly;
        // 5. Audit Logging
        const auditLogId = this.logEvent(action, token, verificationResult, validationResult, anomalies, allowed);
        this.auditTraceEngine?.recordEvent({
            traceId,
            domain: 'enforcement_decision',
            type: 'enforcement_result',
            actorId: action.agentId,
            subjectId: action.agentId,
            entityId: auditLogId,
            decision: allowed ? 'allow' : 'deny',
            complianceTags: ['enforcement'],
            details: {
                auditLogId,
                anomalyCount: anomalies.length,
                anomalies: anomalies.map((anomaly) => ({
                    type: anomaly.type,
                    severity: anomaly.severity,
                    message: anomaly.message
                })),
                validationAuthorized: validationResult.authorized,
                tokenValid: verificationResult.isValid
            }
        });

        if (!allowed) {
            this.blockExecution(action, anomalies, auditLogId);
        }

        return {
            allowed,
            anomalies,
            traceId,
            auditLogId,
            timestamp
        };
    }

    /**
     * Explicitly blocks execution and records the blockage.
     */
    private blockExecution(action: AgentAction, anomalies: EnforcementAnomaly[], logId: string): void {
        const primaryAnomaly = anomalies.sort((a, b) => b.severity.localeCompare(a.severity))[0];
        const reason = primaryAnomaly ? primaryAnomaly.message : 'Unauthorized action';

        console.error(`[SECURITY BLOCK] Execution blocked for ${action.agentId} on ${action.resource}. Reason: ${reason}. (Log: ${logId})`);

        // In a real system, this might throw a specialized SecurityException
        // or signal a middleware to halt.
    }

    private detectAnomalies(
        action: AgentAction,
        token: PortableAuthorityToken,
        validation: ValidationResult,
        anomalies: EnforcementAnomaly[]
    ): void {
        // Detect Scope Escalation
        // If the action scope exceeds the identity's base scope, it might be an escalation if not justified by delegation.
        const identityScope = token.identity.scope;
        const isActionInScope = identityScope.resources.some(r => this.matchesPattern(action.resource, r)) &&
            identityScope.actions.some(a => this.matchesPattern(action.action, a));

        if (!isActionInScope && !validation.isDelegated) {
            anomalies.push({
                type: 'SCOPE_ESCALATION',
                severity: 'high',
                message: `Action '${action.action}' on '${action.resource}' is outside agent's assigned scope and no delegation proof exists.`,
            });
        }

        // Detect Bypassed Approvals
        // If the validation result says it's authorized but requires approvals that are missing in the action context
        // (Note: In this simple model, validation.authorized is false if approvals are required but missing)
        const approvalViolation = validation.violations.find(v => v.code === 'APPROVAL_REQUIRED');
        if (approvalViolation) {
            anomalies.push({
                type: 'BYPASSED_APPROVAL',
                severity: 'high',
                message: `Action requires approvals from: ${validation.requiredApprovals.join(', ')}.`,
                details: { requiredApprovals: validation.requiredApprovals }
            });
        }

        // Detect Unauthorized Pathway
        if (!validation.authorized && !approvalViolation) {
            anomalies.push({
                type: 'UNAUTHORIZED_PATHWAY',
                severity: 'critical',
                message: `Action attempted outside any validated authority pathway.`,
                details: { violations: validation.violations }
            });
        }

        // Context Violation (e.g. environment mismatch)
        const contextViolation = validation.violations.find(v => v.code === 'CONTEXT_MISMATCH');
        if (contextViolation) {
            anomalies.push({
                type: 'CONTEXT_VIOLATION',
                severity: 'critical',
                message: contextViolation.message
            });
        }
    }

    private logEvent(
        action: AgentAction,
        token: PortableAuthorityToken,
        verification: VerificationResult,
        validation: ValidationResult,
        anomalies: EnforcementAnomaly[],
        allowed: boolean
    ): string {
        const logId = `audit-${uuidv4()}`;
        const logEntry = {
            logId,
            timestamp: Date.now(),
            agentId: action.agentId,
            action: action.action,
            resource: action.resource,
            allowed,
            verification,
            validation,
            anomalies,
            metadata: action.context.metadata
        };

        if (this.enableAuditLogging) {
            this.auditLogs.push(logEntry);
            console.log(`[AUDIT] ${allowed ? 'ALLOWED' : 'BLOCKED'} - ${action.agentId} -> ${action.action} on ${action.resource} (${logId})`);
            if (anomalies.length > 0) {
                console.warn(`[ANOMALIES] ${anomalies.map(a => `${a.type}(${a.severity}): ${a.message}`).join(' | ')}`);
            }
        }

        return logId;
    }

    private matchesPattern(value: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (!pattern.includes('*')) return value === pattern;
        const escaped = pattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
        return new RegExp(`^${escaped}$`).test(value);
    }

    public getAuditLogs() {
        return this.auditLogs;
    }

    public getAuditTraceEngine(): AuditTraceEngine | undefined {
        return this.auditTraceEngine;
    }
}

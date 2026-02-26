import * as crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { AgentIdentityPayload, SignedAgentIdentity } from './types';
import { AgentIdentityCore } from './AgentIdentityCore';
import {
    AuthorityGraph,
    AuthorityGraphBuilder,
    AuthorityGraphBuildInput,
    AuthorityRule
} from './AuthorityGraphBuilder';
import { AuthorityVerificationProtocol } from './AuthorityVerificationProtocol';
import {
    ActionValidationEngine,
    ActionValidationEngineOptions
} from './ActionValidationEngine';
import {
    SecurityEnforcementLayer,
    SecurityEnforcementOptions,
    EnforcementResult
} from './SecurityEnforcementLayer';
import {
    DelegationControlModule,
    DelegationRecord,
    DelegationControlModuleOptions
} from './DelegationControlModule';
import {
    ApprovalRoutingEngine,
    ApprovalRoutingEngineOptions,
    RouteRequestInput
} from './ApprovalRoutingEngine';
import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import { AuditTraceEngine } from './AuditTraceEngine';
import { PortableAuthorityToken, VerificationResult } from './VerificationProtocolTypes';
import { AgentAction, ValidationResult } from './ActionValidationTypes';
import { IdentityClaimSet } from './IdentityIntegrationLayer';

import {
    CrossPlatformVerificationMetadata,
    StructuredAuthorityProof,
    AuthorityEvidenceItem,
    APIResponse,
    VerifyIdentityRequest,
    VerifyIdentityResponse,
    RetrieveAuthorityGraphRequest,
    RetrieveAuthorityGraphResponse,
    ValidateActionRequest,
    ValidateActionResponse,
    QueryDelegationChainRequest,
    QueryDelegationChainResponse,
    DelegationChainLink,
    SimulateApprovalRequest,
    SimulateApprovalResponse,
    SimulatedApprovalStep,
    BatchVerifyRequest,
    BatchVerifyResponse,
    BatchVerifyResultItem
} from './IdentityAuthorityAPITypes';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface IdentityAuthorityAPIOptions {
    /** Unique identifier for this API instance (used in verification metadata). */
    platformId?: string;
    /** Trusted root public keys accepted by this platform. */
    trustedRootPublicKeys?: string[];
    /** The core identity engine. */
    identityCore: AgentIdentityCore;
    /** Organizational graph engine for authority traversal. */
    orgGraph: OrganizationalGraphEngine;
    /** Delegation control module. */
    delegationModule: DelegationControlModule;
    /** Audit trace engine. */
    auditTraceEngine?: AuditTraceEngine;
    /** Optional custom approval routing engine. */
    approvalRoutingEngine?: ApprovalRoutingEngine;
    /** Compliance tags added to every response's metadata. */
    defaultComplianceTags?: string[];
    /** Clock function for testability. */
    now?: () => number;
}

// ---------------------------------------------------------------------------
// IdentityAuthorityAPI
// ---------------------------------------------------------------------------

/**
 * A unified, external-facing API that allows external systems to:
 *
 * 1. **Verify agent identity** -- cryptographic and revocation checks.
 * 2. **Retrieve authority graphs** -- the full permission model for an agent.
 * 3. **Validate proposed actions** -- scope, delegation, and context checks.
 * 4. **Query delegation chains** -- trace authority inheritance.
 * 5. **Simulate approval requirements** -- predict the approval workflow
 *    without creating real approval routes.
 *
 * Every response carries:
 * - A **StructuredAuthorityProof** detailing the evidence behind the decision.
 * - **CrossPlatformVerificationMetadata** for external audit and replay.
 */
export class IdentityAuthorityAPI {
    private readonly platformId: string;
    private readonly apiVersion = '1.0.0';
    private readonly trustedRootPublicKeys: string[];
    private readonly identityCore: AgentIdentityCore;
    private readonly orgGraph: OrganizationalGraphEngine;
    private readonly delegationModule: DelegationControlModule;
    private readonly auditTraceEngine: AuditTraceEngine;
    private readonly validationEngine: ActionValidationEngine;
    private readonly securityEnforcement: SecurityEnforcementLayer;
    private readonly approvalRoutingEngine?: ApprovalRoutingEngine;
    private readonly defaultComplianceTags: string[];
    private readonly now: () => number;

    constructor(options: IdentityAuthorityAPIOptions) {
        this.platformId = options.platformId ?? `identity-api-${uuidv4().slice(0, 8)}`;
        this.trustedRootPublicKeys = options.trustedRootPublicKeys ?? [];
        this.identityCore = options.identityCore;
        this.orgGraph = options.orgGraph;
        this.delegationModule = options.delegationModule;
        this.auditTraceEngine = options.auditTraceEngine ?? new AuditTraceEngine();
        this.defaultComplianceTags = options.defaultComplianceTags ?? [];
        this.now = options.now ?? (() => Date.now());

        this.validationEngine = new ActionValidationEngine({
            orgGraph: this.orgGraph,
            auditTraceEngine: this.auditTraceEngine
        });

        this.securityEnforcement = new SecurityEnforcementLayer({
            validationEngine: this.validationEngine,
            trustedRootPublicKeys: this.trustedRootPublicKeys,
            enableAuditLogging: true,
            auditTraceEngine: this.auditTraceEngine
        });

        this.approvalRoutingEngine = options.approvalRoutingEngine;
    }

    // -----------------------------------------------------------------------
    // 1. Verify Agent Identity
    // -----------------------------------------------------------------------

    /**
     * Verifies the cryptographic integrity, expiration status, and revocation
     * state of a signed agent identity. Optionally also verifies a portable
     * authority token against the configured trusted roots.
     */
    public verifyIdentity(
        request: VerifyIdentityRequest
    ): APIResponse<VerifyIdentityResponse> {
        const startMs = this.now();
        const traceId = uuidv4();

        try {
            const { signedIdentity, portableToken, trustedRootPublicKeys } = request;
            const payload = signedIdentity.payload;

            // Core identity validation
            const coreResult = this.identityCore.verifyIdentity(signedIdentity);
            const isRevoked = this.identityCore.isRevoked(payload.agentId);
            const remainingMs = Math.max(0, payload.expiresAt - this.now());

            // Optional portable token verification
            let tokenVerification: VerificationResult | undefined;
            if (portableToken) {
                const roots = trustedRootPublicKeys ?? this.trustedRootPublicKeys;
                tokenVerification = AuthorityVerificationProtocol.verifyPortableToken(
                    portableToken,
                    roots
                );
            }

            // Build evidence chain
            const evidence: AuthorityEvidenceItem[] = [];
            evidence.push({
                source: 'identity_core',
                claim: coreResult.valid
                    ? 'Cryptographic signature and expiration checks passed'
                    : `Identity verification failed: ${coreResult.reason}`,
                supports: coreResult.valid
            });

            if (isRevoked) {
                evidence.push({
                    source: 'identity_core',
                    claim: 'Identity has been revoked',
                    supports: false
                });
            }

            if (tokenVerification) {
                evidence.push({
                    source: 'authority_protocol',
                    claim: tokenVerification.isValid
                        ? `Portable token verified (trust chain: ${tokenVerification.trustChainStatus})`
                        : `Token verification failed: ${tokenVerification.reason}`,
                    supports: tokenVerification.isValid
                });
            }

            const identityValid = coreResult.valid && !isRevoked;
            const decision = identityValid ? 'authorized' : 'denied';

            const proof = this.buildProof(
                payload.agentId,
                decision,
                decision === 'authorized'
                    ? 'Agent identity is cryptographically valid and not revoked'
                    : `Identity rejected: ${coreResult.reason ?? 'revoked'}`,
                evidence,
                tokenVerification && portableToken
                    ? portableToken.authorityProof.assertions
                    : []
            );

            // Audit
            this.auditTraceEngine.startTrace({ traceId });
            this.auditTraceEngine.recordEvent({
                traceId,
                domain: 'authority_check',
                type: 'identity_verification',
                actorId: payload.agentId,
                subjectId: payload.agentId,
                decision: identityValid ? 'allow' : 'deny',
                complianceTags: ['identity', 'verification', ...this.defaultComplianceTags],
                details: {
                    valid: identityValid,
                    revoked: isRevoked,
                    remainingValidityMs: remainingMs,
                    tokenVerified: tokenVerification?.isValid ?? null
                }
            });

            const data: VerifyIdentityResponse = {
                identityValid,
                reason: coreResult.reason,
                agentId: payload.agentId,
                isRevoked,
                expiresAt: payload.expiresAt,
                remainingValidityMs: remainingMs,
                tokenVerification,
                proof
            };

            return this.envelope(true, data, startMs, traceId);
        } catch (err: any) {
            return this.errorEnvelope('IDENTITY_VERIFICATION_ERROR', err.message, startMs, traceId);
        }
    }

    // -----------------------------------------------------------------------
    // 2. Retrieve Authority Graph
    // -----------------------------------------------------------------------

    /**
     * Retrieves (or rebuilds) the full authority graph for an agent. The
     * response includes summary statistics, active delegations, and a
     * structured authority proof describing the graph composition.
     */
    public retrieveAuthorityGraph(
        request: RetrieveAuthorityGraphRequest,
        buildInput?: AuthorityGraphBuildInput
    ): APIResponse<RetrieveAuthorityGraphResponse> {
        const startMs = this.now();
        const traceId = uuidv4();

        try {
            let graph: AuthorityGraph;

            if (buildInput) {
                const builder = new AuthorityGraphBuilder();
                graph = builder.build(buildInput);
            } else {
                // Return a minimal graph shell when no build input is provided.
                graph = {
                    agentId: request.agentId,
                    ownerId: '',
                    orgId: '',
                    generatedAt: this.now(),
                    canExecute: [],
                    requiresApproval: [],
                    prohibited: [],
                    defaultDecision: 'prohibited',
                    nodes: [],
                    edges: []
                };
            }

            // Gather active delegations that contribute to this agent's authority
            const activeDelegations = this.delegationModule
                .listActiveDelegatedPermissions({ granteeAgentId: request.agentId })
                .map(perm => this.delegationModule.getDelegation(perm.delegationId))
                .filter((d): d is DelegationRecord => d !== undefined);

            // Build evidence chain from the graph
            const evidence: AuthorityEvidenceItem[] = [];
            for (const rule of graph.canExecute) {
                evidence.push({
                    source: rule.sources.join(', '),
                    claim: `Can execute ${rule.action} on ${rule.resource}`,
                    supports: true,
                    rule
                });
            }
            for (const rule of graph.requiresApproval) {
                evidence.push({
                    source: rule.sources.join(', '),
                    claim: `Requires approval for ${rule.action} on ${rule.resource}: ${rule.reasons.join('; ')}`,
                    supports: true,
                    rule
                });
            }
            for (const rule of graph.prohibited) {
                evidence.push({
                    source: rule.sources.join(', '),
                    claim: `Prohibited: ${rule.action} on ${rule.resource}: ${rule.reasons.join('; ')}`,
                    supports: false,
                    rule
                });
            }

            const delegationCount = activeDelegations.length;

            const proof = this.buildProof(
                request.agentId,
                graph.canExecute.length > 0 ? 'authorized' : 'unknown',
                `Authority graph generated with ${graph.canExecute.length} executable, ` +
                `${graph.requiresApproval.length} approval-required, and ` +
                `${graph.prohibited.length} prohibited rules. ` +
                `${delegationCount} active delegation(s).`,
                evidence,
                [],
                graph.nodes,
                graph.edges
            );

            // Audit
            this.auditTraceEngine.startTrace({ traceId });
            this.auditTraceEngine.recordEvent({
                traceId,
                domain: 'authority_check',
                type: 'authority_graph_retrieval',
                actorId: request.agentId,
                subjectId: request.agentId,
                complianceTags: ['authority_graph', ...this.defaultComplianceTags],
                details: {
                    canExecuteCount: graph.canExecute.length,
                    requiresApprovalCount: graph.requiresApproval.length,
                    prohibitedCount: graph.prohibited.length,
                    delegationCount
                }
            });

            const data: RetrieveAuthorityGraphResponse = {
                graph,
                stats: {
                    totalRules:
                        graph.canExecute.length +
                        graph.requiresApproval.length +
                        graph.prohibited.length,
                    canExecuteCount: graph.canExecute.length,
                    requiresApprovalCount: graph.requiresApproval.length,
                    prohibitedCount: graph.prohibited.length,
                    delegationCount,
                    nodeCount: graph.nodes.length,
                    edgeCount: graph.edges.length
                },
                activeDelegations,
                proof
            };

            return this.envelope(true, data, startMs, traceId);
        } catch (err: any) {
            return this.errorEnvelope('AUTHORITY_GRAPH_ERROR', err.message, startMs, traceId);
        }
    }

    // -----------------------------------------------------------------------
    // 3. Validate Proposed Action
    // -----------------------------------------------------------------------

    /**
     * Validates a proposed agent action against its authority graph. Optionally
     * runs security enforcement (if a portable token is supplied) and routes
     * the action for approval if the graph requires it.
     */
    public validateAction(
        request: ValidateActionRequest
    ): APIResponse<ValidateActionResponse> {
        const startMs = this.now();
        const traceId = uuidv4();

        try {
            const { action, authorityGraph, portableToken, trustedRootPublicKeys } = request;

            // Core validation
            const validation: ValidationResult = this.validationEngine.validateAction(
                action,
                authorityGraph,
                { traceId }
            );

            // Security enforcement (optional)
            let enforcement: { allowed: boolean; anomalies: EnforcementResult['anomalies'] } | undefined;
            if (portableToken) {
                const result: EnforcementResult = this.securityEnforcement.enforce(
                    action,
                    portableToken,
                    authorityGraph
                );
                enforcement = {
                    allowed: result.allowed,
                    anomalies: result.anomalies
                };
            }

            // Approval routing (if action requires approval)
            let approvalRoute = undefined;
            if (
                !validation.authorized &&
                validation.violations.some(v => v.code === 'APPROVAL_REQUIRED') &&
                this.approvalRoutingEngine
            ) {
                const routeResult = this.approvalRoutingEngine.routeRequest({
                    action,
                    authorityGraph,
                    traceId
                });
                approvalRoute = routeResult.route;
            }

            // Build evidence chain
            const evidence: AuthorityEvidenceItem[] = [];
            for (const v of validation.violations) {
                evidence.push({
                    source: 'action_validation',
                    claim: `[${v.code}] ${v.message}`,
                    supports: v.severity !== 'error'
                });
            }
            if (validation.isDelegated) {
                evidence.push({
                    source: 'delegation',
                    claim: 'Action authority is delegated',
                    supports: true
                });
            }
            if (enforcement) {
                for (const a of enforcement.anomalies) {
                    evidence.push({
                        source: 'security_enforcement',
                        claim: `[${a.type}] ${a.message}`,
                        supports: false
                    });
                }
                if (enforcement.anomalies.length === 0) {
                    evidence.push({
                        source: 'security_enforcement',
                        claim: 'No security anomalies detected',
                        supports: true
                    });
                }
            }

            const overallDecision = enforcement
                ? enforcement.allowed
                    ? 'authorized'
                    : 'denied'
                : validation.authorized
                    ? 'authorized'
                    : validation.violations.some(v => v.code === 'APPROVAL_REQUIRED')
                        ? 'requires_approval'
                        : 'denied';

            const proof = this.buildProof(
                action.agentId,
                overallDecision,
                `Action "${action.action}" on "${action.resource}": ${overallDecision}`,
                evidence,
                portableToken?.authorityProof.assertions ?? []
            );

            // Audit
            this.auditTraceEngine.startTrace({ traceId });
            this.auditTraceEngine.recordEvent({
                traceId,
                domain: 'authority_check',
                type: 'action_validation_api',
                actorId: action.agentId,
                subjectId: action.agentId,
                decision: overallDecision === 'authorized'
                    ? 'allow' : overallDecision === 'requires_approval'
                        ? 'requires_approval' : 'deny',
                complianceTags: ['action_validation', ...this.defaultComplianceTags],
                details: {
                    action: action.action,
                    resource: action.resource,
                    authorized: validation.authorized,
                    isDelegated: validation.isDelegated,
                    violationCount: validation.violations.length,
                    enforcementAllowed: enforcement?.allowed ?? null,
                    anomalyCount: enforcement?.anomalies.length ?? 0,
                    hasApprovalRoute: !!approvalRoute
                }
            });

            const data: ValidateActionResponse = {
                validation,
                enforcement,
                approvalRoute,
                proof
            };

            return this.envelope(true, data, startMs, traceId);
        } catch (err: any) {
            return this.errorEnvelope('ACTION_VALIDATION_ERROR', err.message, startMs, traceId);
        }
    }

    // -----------------------------------------------------------------------
    // 4. Query Delegation Chains
    // -----------------------------------------------------------------------

    /**
     * Traces delegation chains for a specific delegation ID or lists all
     * active delegations for a grantee agent. Returns a flattened chain
     * representation with depth information and a structured proof.
     */
    public queryDelegationChain(
        request: QueryDelegationChainRequest
    ): APIResponse<QueryDelegationChainResponse> {
        const startMs = this.now();
        const traceId = uuidv4();

        try {
            let records: DelegationRecord[] = [];
            const chainLinks: DelegationChainLink[] = [];

            if (request.delegationId) {
                // Trace a specific delegation chain
                records = this.delegationModule.traceDelegationChain(request.delegationId);
            } else if (request.granteeAgentId) {
                // List all active delegations for the grantee
                const permissions = this.delegationModule.listActiveDelegatedPermissions({
                    granteeAgentId: request.granteeAgentId,
                    asOf: request.asOf
                });
                for (const perm of permissions) {
                    const rec = this.delegationModule.getDelegation(perm.delegationId);
                    if (rec) records.push(rec);
                }
            } else {
                // Return all delegations
                records = this.delegationModule.listDelegations();
            }

            // Build flattened chain links
            for (let i = 0; i < records.length; i++) {
                const rec = records[i];
                chainLinks.push({
                    delegationId: rec.delegationId,
                    grantorAgentId: rec.grantorAgentId,
                    granteeAgentId: rec.granteeAgentId,
                    scope: {
                        resources: rec.scope.resources,
                        actions: rec.scope.actions
                    },
                    status: rec.status,
                    depth: i
                });
            }

            // Build evidence
            const evidence: AuthorityEvidenceItem[] = records.map(rec => ({
                source: `delegation:${rec.delegationId}`,
                claim: `${rec.grantorAgentId} -> ${rec.granteeAgentId} ` +
                    `[${rec.scope.resources.join(', ')}] ` +
                    `(${rec.status})`,
                supports: rec.status === 'active'
            }));

            const subjectId = request.granteeAgentId ?? request.delegationId ?? 'unknown';

            const proof = this.buildProof(
                subjectId,
                records.length > 0 ? 'authorized' : 'unknown',
                `Found ${records.length} delegation record(s) with chain depth ${chainLinks.length}`,
                evidence,
                []
            );

            // Audit
            this.auditTraceEngine.startTrace({ traceId });
            this.auditTraceEngine.recordEvent({
                traceId,
                domain: 'delegation_event',
                type: 'delegation_chain_query',
                actorId: subjectId,
                subjectId,
                complianceTags: ['delegation', 'query', ...this.defaultComplianceTags],
                details: {
                    delegationId: request.delegationId,
                    granteeAgentId: request.granteeAgentId,
                    recordCount: records.length,
                    chainDepth: chainLinks.length
                }
            });

            const data: QueryDelegationChainResponse = {
                chain: chainLinks,
                chainDepth: chainLinks.length,
                records,
                proof
            };

            return this.envelope(true, data, startMs, traceId);
        } catch (err: any) {
            return this.errorEnvelope('DELEGATION_QUERY_ERROR', err.message, startMs, traceId);
        }
    }

    // -----------------------------------------------------------------------
    // 5. Simulate Approval Requirements
    // -----------------------------------------------------------------------

    /**
     * Simulates the approval requirements for a hypothetical action without
     * persisting any state. Returns the predicted approval route, including
     * step definitions, approver lists, and decision policies.
     */
    public simulateApprovalRequirements(
        request: SimulateApprovalRequest
    ): APIResponse<SimulateApprovalResponse> {
        const startMs = this.now();
        const traceId = uuidv4();

        try {
            const { action, authorityGraph } = request;

            // First, validate the action to see if approval is even required
            const validation = this.validationEngine.validateAction(action, authorityGraph);

            const requiresApproval = validation.violations.some(
                v => v.code === 'APPROVAL_REQUIRED'
            );

            let simulatedRoute: SimulateApprovalResponse['simulatedRoute'] = undefined;

            if (requiresApproval && this.approvalRoutingEngine) {
                const routeResult = this.approvalRoutingEngine.routeRequest({
                    action,
                    authorityGraph,
                    traceId
                });

                if (routeResult.route) {
                    const steps: SimulatedApprovalStep[] = routeResult.route.steps.map(s => ({
                        stepId: s.stepId,
                        domains: s.domains,
                        approverIds: s.approverIds,
                        status: s.status,
                        decisionPolicy: s.decisionPolicy,
                        dependsOnStepIds: s.dependsOnStepIds
                    }));

                    const estimatedApproverCount = new Set(
                        routeResult.route.steps.flatMap(s => s.approverIds)
                    ).size;

                    simulatedRoute = {
                        routeId: routeResult.route.routeId,
                        domains: routeResult.route.domains,
                        steps,
                        reasons: routeResult.route.reasons,
                        estimatedApproverCount
                    };
                }
            }

            // Build evidence
            const evidence: AuthorityEvidenceItem[] = [];
            evidence.push({
                source: 'action_validation',
                claim: requiresApproval
                    ? 'Action requires approval based on authority graph and routing rules'
                    : 'Action does not require approval',
                supports: true
            });

            if (simulatedRoute) {
                for (const step of simulatedRoute.steps) {
                    evidence.push({
                        source: 'approval_routing',
                        claim: `Step "${step.stepId}" requires ${step.approverIds.length} approver(s) ` +
                            `across domains [${step.domains.join(', ')}] with "${step.decisionPolicy}" policy`,
                        supports: true
                    });
                }
            }

            const proof = this.buildProof(
                action.agentId,
                requiresApproval ? 'requires_approval' : 'authorized',
                requiresApproval
                    ? `Approval required: ${simulatedRoute?.reasons.join('; ') ?? 'unknown reason'}`
                    : 'No approval required for this action',
                evidence,
                []
            );

            // Audit
            this.auditTraceEngine.startTrace({ traceId });
            this.auditTraceEngine.recordEvent({
                traceId,
                domain: 'approval_path',
                type: 'approval_simulation',
                actorId: action.agentId,
                subjectId: action.agentId,
                complianceTags: ['approval', 'simulation', ...this.defaultComplianceTags],
                details: {
                    action: action.action,
                    resource: action.resource,
                    requiresApproval,
                    stepCount: simulatedRoute?.steps.length ?? 0,
                    estimatedApproverCount: simulatedRoute?.estimatedApproverCount ?? 0
                }
            });

            const data: SimulateApprovalResponse = {
                requiresApproval,
                simulatedRoute,
                proof
            };

            return this.envelope(true, data, startMs, traceId);
        } catch (err: any) {
            return this.errorEnvelope('APPROVAL_SIMULATION_ERROR', err.message, startMs, traceId);
        }
    }

    // -----------------------------------------------------------------------
    // 6. Batch Verify Identities
    // -----------------------------------------------------------------------

    /**
     * Verifies multiple signed identities in a single call. Returns per-agent
     * results with overall tallies.
     */
    public batchVerifyIdentities(
        request: BatchVerifyRequest
    ): APIResponse<BatchVerifyResponse> {
        const startMs = this.now();
        const traceId = uuidv4();

        try {
            const results: BatchVerifyResultItem[] = request.identities.map(identity => {
                const result = this.identityCore.verifyIdentity(identity);
                const revoked = this.identityCore.isRevoked(identity.payload.agentId);
                return {
                    agentId: identity.payload.agentId,
                    valid: result.valid && !revoked,
                    reason: revoked ? 'Identity has been revoked' : result.reason
                };
            });

            const validCount = results.filter(r => r.valid).length;
            const invalidCount = results.length - validCount;

            // Audit
            this.auditTraceEngine.startTrace({ traceId });
            this.auditTraceEngine.recordEvent({
                traceId,
                domain: 'authority_check',
                type: 'batch_identity_verification',
                complianceTags: ['identity', 'batch', ...this.defaultComplianceTags],
                details: {
                    totalCount: results.length,
                    validCount,
                    invalidCount
                }
            });

            const data: BatchVerifyResponse = {
                results,
                validCount,
                invalidCount
            };

            return this.envelope(true, data, startMs, traceId);
        } catch (err: any) {
            return this.errorEnvelope('BATCH_VERIFY_ERROR', err.message, startMs, traceId);
        }
    }

    // -----------------------------------------------------------------------
    // Accessors for underlying engines (for advanced integrations)
    // -----------------------------------------------------------------------

    public getAuditTraceEngine(): AuditTraceEngine {
        return this.auditTraceEngine;
    }

    public getDelegationModule(): DelegationControlModule {
        return this.delegationModule;
    }

    public getOrganizationalGraph(): OrganizationalGraphEngine {
        return this.orgGraph;
    }

    public getIdentityCore(): AgentIdentityCore {
        return this.identityCore;
    }

    public getPlatformId(): string {
        return this.platformId;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /**
     * Builds a StructuredAuthorityProof from the collected evidence.
     */
    private buildProof(
        subjectAgentId: string,
        decision: StructuredAuthorityProof['decision'],
        summary: string,
        evidence: AuthorityEvidenceItem[],
        assertions: import('./VerificationProtocolTypes').AuthorityAssertion[],
        graphNodes: import('./AuthorityGraphBuilder').AuthorityGraphNode[] = [],
        graphEdges: import('./AuthorityGraphBuilder').AuthorityGraphEdge[] = []
    ): StructuredAuthorityProof {
        // Merge constraints from rules in evidence
        const constraints: Record<string, unknown> = {};
        for (const item of evidence) {
            if (item.rule?.constraints) {
                Object.assign(constraints, item.rule.constraints);
            }
        }

        return {
            subjectAgentId,
            summary,
            decision,
            evidenceChain: evidence,
            cryptographicAssertions: assertions,
            graphFragment: {
                nodes: graphNodes,
                edges: graphEdges
            },
            constraints
        };
    }

    /**
     * Wraps a successful result in the standard API response envelope with
     * cross-platform verification metadata.
     */
    private envelope<T>(
        success: boolean,
        data: T,
        startMs: number,
        traceId: string
    ): APIResponse<T> {
        const nowMs = this.now();
        const processingTimeMs = nowMs - startMs;
        const responsePayload = JSON.stringify(data);
        const responseDigest = crypto
            .createHash('sha256')
            .update(responsePayload)
            .digest('hex');

        const metadata: CrossPlatformVerificationMetadata = {
            responseId: uuidv4(),
            timestamp: new Date(nowMs).toISOString(),
            timestampMs: nowMs,
            platformId: this.platformId,
            apiVersion: this.apiVersion,
            responseDigest,
            processingTimeMs,
            traceId,
            complianceTags: [...this.defaultComplianceTags]
        };

        return { success, data, metadata };
    }

    /**
     * Wraps an error in the standard API response envelope.
     */
    private errorEnvelope<T>(
        code: string,
        message: string,
        startMs: number,
        traceId: string
    ): APIResponse<T> {
        const nowMs = this.now();
        const processingTimeMs = nowMs - startMs;
        const responseDigest = crypto
            .createHash('sha256')
            .update(JSON.stringify({ code, message }))
            .digest('hex');

        const metadata: CrossPlatformVerificationMetadata = {
            responseId: uuidv4(),
            timestamp: new Date(nowMs).toISOString(),
            timestampMs: nowMs,
            platformId: this.platformId,
            apiVersion: this.apiVersion,
            responseDigest,
            processingTimeMs,
            traceId,
            complianceTags: [...this.defaultComplianceTags]
        };

        return {
            success: false,
            error: { code, message },
            metadata
        };
    }
}

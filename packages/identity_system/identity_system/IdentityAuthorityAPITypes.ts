import { AgentIdentityPayload, SignedAgentIdentity } from './types';
import { AuthorityGraph, AuthorityGraphNode, AuthorityGraphEdge, AuthorityRule } from './AuthorityGraphBuilder';
import { VerificationResult, PortableAuthorityToken, AuthorityAssertion } from './VerificationProtocolTypes';
import { ValidationResult, ValidationViolation, AgentAction } from './ActionValidationTypes';
import { ApprovalRoute, ApprovalDomain, ApprovalStep } from './ApprovalRoutingTypes';
import { DelegationRecord } from './DelegationControlModule';
import { EnforcementAnomaly } from './SecurityEnforcementLayer';

// ---------------------------------------------------------------------------
// Cross-Platform Verification Metadata
// ---------------------------------------------------------------------------

/**
 * Metadata attached to every API response proving provenance, timing,
 * and the cryptographic integrity of the result. External systems use this
 * to independently verify that a response has not been tampered with and
 * to correlate requests across distributed platforms.
 */
export interface CrossPlatformVerificationMetadata {
    /** Unique identifier for this API response. */
    responseId: string;
    /** ISO-8601 timestamp of when the response was generated. */
    timestamp: string;
    /** Monotonic clock value (ms since epoch) for ordering. */
    timestampMs: number;
    /** Identifier of the IdentityAuthorityAPI instance that produced the response. */
    platformId: string;
    /** Semantic version of the API that produced the response. */
    apiVersion: string;
    /** SHA-256 digest of the serialised response payload (hex). */
    responseDigest: string;
    /** Duration in milliseconds that the API spent processing the request. */
    processingTimeMs: number;
    /** Optional trace ID linking the response to an internal audit trail. */
    traceId?: string;
    /** Any compliance or regulatory tags associated with the operation. */
    complianceTags: string[];
}

// ---------------------------------------------------------------------------
// Structured Authority Proof
// ---------------------------------------------------------------------------

/**
 * Encapsulates the cryptographic and logical evidence that an agent holds
 * (or does not hold) authority for a given action. This proof is portable
 * and can be verified offline by external systems.
 */
export interface StructuredAuthorityProof {
    /** The agent identity that was evaluated. */
    subjectAgentId: string;
    /** Human-readable summary of the authority decision. */
    summary: string;
    /** High-level decision. */
    decision: 'authorized' | 'requires_approval' | 'denied' | 'unknown';
    /** Ordered list of evidence items that justify the decision. */
    evidenceChain: AuthorityEvidenceItem[];
    /** The cryptographic assertions backing this proof (if available). */
    cryptographicAssertions: AuthorityAssertion[];
    /** Graph fragment relevant to the decision. */
    graphFragment: {
        nodes: AuthorityGraphNode[];
        edges: AuthorityGraphEdge[];
    };
    /** Constraints or conditions attached to the grant. */
    constraints: Record<string, unknown>;
}

export interface AuthorityEvidenceItem {
    /** Source layer that produced this evidence (e.g. identity, delegation, policy). */
    source: string;
    /** What the evidence states. */
    claim: string;
    /** Whether this piece of evidence supports the decision. */
    supports: boolean;
    /** Original rule or policy that backs this evidence. */
    rule?: AuthorityRule;
}

// ---------------------------------------------------------------------------
// API Request / Response Envelopes
// ---------------------------------------------------------------------------

export interface APIResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    metadata: CrossPlatformVerificationMetadata;
}

// ---------------------------------------------------------------------------
// 1. Verify Agent Identity
// ---------------------------------------------------------------------------

export interface VerifyIdentityRequest {
    signedIdentity: SignedAgentIdentity;
    /** Trusted root public keys the caller accepts. */
    trustedRootPublicKeys?: string[];
    /** If provided, a portable token is also verified. */
    portableToken?: PortableAuthorityToken;
}

export interface VerifyIdentityResponse {
    identityValid: boolean;
    reason?: string;
    agentId: string;
    isRevoked: boolean;
    expiresAt: number;
    remainingValidityMs: number;
    tokenVerification?: VerificationResult;
    proof: StructuredAuthorityProof;
}

// ---------------------------------------------------------------------------
// 2. Retrieve Authority Graph
// ---------------------------------------------------------------------------

export interface RetrieveAuthorityGraphRequest {
    agentId: string;
    /** If provided the graph is built for this specific identity payload. */
    identityPayload?: AgentIdentityPayload;
}

export interface RetrieveAuthorityGraphResponse {
    graph: AuthorityGraph;
    /** Summary statistics. */
    stats: {
        totalRules: number;
        canExecuteCount: number;
        requiresApprovalCount: number;
        prohibitedCount: number;
        delegationCount: number;
        nodeCount: number;
        edgeCount: number;
    };
    /** Active delegations contributing to this graph. */
    activeDelegations: DelegationRecord[];
    proof: StructuredAuthorityProof;
}

// ---------------------------------------------------------------------------
// 3. Validate Proposed Action
// ---------------------------------------------------------------------------

export interface ValidateActionRequest {
    action: AgentAction;
    /** The pre-built authority graph to validate against. */
    authorityGraph: AuthorityGraph;
    /** Portable authority token for security enforcement. */
    portableToken?: PortableAuthorityToken;
    /** Trusted root public keys for token verification. */
    trustedRootPublicKeys?: string[];
}

export interface ValidateActionResponse {
    validation: ValidationResult;
    /** Security enforcement result (if token was provided). */
    enforcement?: {
        allowed: boolean;
        anomalies: EnforcementAnomaly[];
    };
    /** If approval is required, the routed approval chain. */
    approvalRoute?: ApprovalRoute;
    proof: StructuredAuthorityProof;
}

// ---------------------------------------------------------------------------
// 4. Query Delegation Chains
// ---------------------------------------------------------------------------

export interface QueryDelegationChainRequest {
    /** The delegation ID to trace. */
    delegationId?: string;
    /** If set, list all active delegations for this grantee. */
    granteeAgentId?: string;
    /** Point-in-time filter. */
    asOf?: number;
}

export interface DelegationChainLink {
    delegationId: string;
    grantorAgentId: string;
    granteeAgentId: string;
    scope: {
        resources: string[];
        actions: string[];
    };
    status: string;
    depth: number;
}

export interface QueryDelegationChainResponse {
    /** Flattened chain from root to leaf. */
    chain: DelegationChainLink[];
    /** Total depth of the chain. */
    chainDepth: number;
    /** All raw delegation records in the chain. */
    records: DelegationRecord[];
    proof: StructuredAuthorityProof;
}

// ---------------------------------------------------------------------------
// 5. Simulate Approval Requirements
// ---------------------------------------------------------------------------

export interface SimulateApprovalRequest {
    action: AgentAction;
    authorityGraph: AuthorityGraph;
}

export interface SimulatedApprovalStep {
    stepId: string;
    domains: ApprovalDomain[];
    approverIds: string[];
    status: string;
    decisionPolicy: string;
    dependsOnStepIds: string[];
}

export interface SimulateApprovalResponse {
    requiresApproval: boolean;
    /** The hypothetical approval route that would be created. */
    simulatedRoute?: {
        routeId: string;
        domains: ApprovalDomain[];
        steps: SimulatedApprovalStep[];
        reasons: string[];
        estimatedApproverCount: number;
    };
    proof: StructuredAuthorityProof;
}

// ---------------------------------------------------------------------------
// 6. Batch Verify (bulk identity checks)
// ---------------------------------------------------------------------------

export interface BatchVerifyRequest {
    identities: SignedAgentIdentity[];
}

export interface BatchVerifyResultItem {
    agentId: string;
    valid: boolean;
    reason?: string;
}

export interface BatchVerifyResponse {
    results: BatchVerifyResultItem[];
    validCount: number;
    invalidCount: number;
}

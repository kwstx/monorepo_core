/**
 * IdentityAuthorityAPI Demo
 *
 * Demonstrates all five core API endpoints plus batch verification:
 *  1. Verify Agent Identity
 *  2. Retrieve Authority Graph
 *  3. Validate Proposed Action
 *  4. Query Delegation Chains
 *  5. Simulate Approval Requirements
 *  6. Batch Verify Identities
 */

import { AgentIdentityCore } from './AgentIdentityCore';
import { CryptoUtils } from './crypto';
import {
    AuthorityGraphBuilder,
    AuthorityGraphBuildInput,
    OrganizationalGraphData,
    AuthorityPolicy
} from './AuthorityGraphBuilder';
import { AuthorityVerificationProtocol } from './AuthorityVerificationProtocol';
import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import { EntityType, RelationshipType } from './orgGraphTypes';
import {
    DelegationControlModule,
    DelegationCapability
} from './DelegationControlModule';
import { ApprovalRoutingEngine } from './ApprovalRoutingEngine';
import { AuditTraceEngine } from './AuditTraceEngine';
import { AssertionType } from './VerificationProtocolTypes';
import {
    IdentityIntegrationLayer,
    IdentityClaimSet
} from './IdentityIntegrationLayer';
import { IdentityAuthorityAPI } from './IdentityAuthorityAPI';

// ---------------------------------------------------------------------------
// Helper: section printer
// ---------------------------------------------------------------------------

function section(title: string): void {
    console.log('\n' + '='.repeat(72));
    console.log(`  ${title}`);
    console.log('='.repeat(72));
}

function subSection(title: string): void {
    console.log(`\n--- ${title} ---`);
}

// ---------------------------------------------------------------------------
// Setup: build the ecosystem
// ---------------------------------------------------------------------------

section('SETUP: Building Identity Ecosystem');

// 1. Identity core
const identityCore = new AgentIdentityCore();

const ownerKeyPair = CryptoUtils.generateKeyPair();

const { identity: agentIdentity, keyPair: agentKeyPair } = identityCore.createIdentity({
    ownerId: 'owner_alice',
    orgId: 'org_engineering',
    scope: {
        resources: ['db:users', 'service:payments', 'repo:*'],
        actions: ['read', 'write', 'deploy']
    },
    context: {
        environment: 'development',
        region: 'us-east-1',
        labels: { team: 'platform' }
    }
});

const { identity: secondIdentity, keyPair: secondKeyPair } = identityCore.createIdentity({
    ownerId: 'owner_bob',
    orgId: 'org_engineering',
    scope: {
        resources: ['service:analytics'],
        actions: ['read']
    },
    context: {
        environment: 'production',
        region: 'eu-west-1'
    }
});

console.log(`Created agent: ${agentIdentity.payload.agentId}`);
console.log(`Created agent: ${secondIdentity.payload.agentId}`);

// 2. Organizational graph
const orgGraph = new OrganizationalGraphEngine();

orgGraph.addNode({ id: 'cto', type: EntityType.USER, name: 'CTO' });
orgGraph.addNode({ id: 'owner_alice', type: EntityType.USER, name: 'Alice' });
orgGraph.addNode({ id: 'owner_bob', type: EntityType.USER, name: 'Bob' });
orgGraph.addNode({ id: 'dept_engineering', type: EntityType.DEPARTMENT, name: 'Engineering' });
orgGraph.addNode({ id: 'dept_finance', type: EntityType.DEPARTMENT, name: 'Finance' });
orgGraph.addNode({
    id: agentIdentity.payload.agentId,
    type: EntityType.AGENT,
    name: 'Agent Alpha',
    metadata: {
        scope: {
            resources: ['repo:*'],
            actions: ['read', 'write']
        }
    }
});
orgGraph.addNode({
    id: 'role_dev',
    type: EntityType.ROLE,
    name: 'Developer',
    metadata: {
        scope: {
            resources: ['repo:*', 'service:payments'],
            actions: ['read', 'write']
        }
    }
});

orgGraph.addRelationship({ fromId: 'owner_alice', toId: 'cto', type: RelationshipType.REPORTS_TO });
orgGraph.addRelationship({ fromId: 'owner_alice', toId: 'dept_engineering', type: RelationshipType.MEMBER_OF });
orgGraph.addRelationship({ fromId: 'owner_bob', toId: 'dept_finance', type: RelationshipType.MEMBER_OF });
orgGraph.addRelationship({ fromId: agentIdentity.payload.agentId, toId: 'owner_alice', type: RelationshipType.REPORTS_TO });
orgGraph.addRelationship({ fromId: agentIdentity.payload.agentId, toId: 'role_dev', type: RelationshipType.HAS_ROLE });
orgGraph.addRelationship({ fromId: 'cto', toId: 'dept_finance', type: RelationshipType.APPROVES_FOR });

console.log('Organizational graph built');

// 3. Delegation module
const delegationModule = new DelegationControlModule();

const delegation = delegationModule.createDelegation(
    {
        grantorAgentId: 'owner_alice',
        granteeAgentId: agentIdentity.payload.agentId,
        scope: {
            resources: ['service:payments'],
            actions: ['deploy']
        },
        reason: 'Delegated deploy authority for payments service',
        ttlMs: 24 * 60 * 60 * 1000
    },
    [{ resources: ['service:payments'], actions: ['deploy'] }]
);

console.log(`Delegation created: ${delegation.delegationId}`);

// 4. Audit trace engine
const auditTraceEngine = new AuditTraceEngine();

// 5. Approval routing engine
const approvalEngine = new ApprovalRoutingEngine({
    orgGraph,
    rules: [
        {
            id: 'prod-deploy-rule',
            actionPattern: 'deploy',
            environments: ['production'],
            addDomains: ['managerial', 'legal'],
            workflow: 'sequential',
            reason: 'Production deployments require managerial and legal approval',
            priority: 10
        },
        {
            id: 'cross-dept-rule',
            requiresCrossDepartment: true,
            addDomains: ['cross_departmental'],
            reason: 'Cross-departmental actions require target department sign-off',
            priority: 5
        }
    ],
    domainApprovers: {
        legal: { approverIds: ['legal_counsel_01'], decisionPolicy: 'any' }
    },
    auditTraceEngine
});

// 6. Build an authority graph for the agent
const orgPolicies: AuthorityPolicy[] = [
    {
        resource: 'repo:*',
        actions: ['read', 'write'],
        effect: 'allow',
        reason: 'Engineering has repo access'
    },
    {
        resource: 'service:payments',
        actions: ['read'],
        effect: 'allow',
        reason: 'Read access to payments'
    },
    {
        resource: 'service:payments',
        actions: ['deploy'],
        effect: 'require_approval',
        reason: 'Deployments require approval'
    },
    {
        resource: 'db:production',
        actions: ['write', 'delete'],
        effect: 'deny',
        reason: 'Direct production DB writes prohibited'
    }
];

const identityClaims: IdentityClaimSet = {
    subject: {
        id: 'owner_alice',
        email: 'alice@org.io',
        displayName: 'Alice'
    },
    roles: {
        assigned: ['role_dev'],
        resolved: ['role_dev']
    },
    departments: {
        activeDepartmentId: 'dept_engineering',
        lineage: ['dept_engineering']
    },
    permissionScopes: [
        { resource: 'repo:*', actions: ['read', 'write'] },
        { resource: 'service:payments', actions: ['read', 'write'] }
    ],
    source: {
        ssoProvider: 'okta',
        directoryProvider: 'azure_ad',
        rbacProvider: 'custom_rbac',
        synchronizedAt: Date.now()
    }
};

const buildInput: AuthorityGraphBuildInput = {
    identity: agentIdentity.payload,
    identityClaims,
    organizationalGraph: {
        orgId: 'org_engineering',
        orgPolicies,
        rolePolicies: {
            role_dev: [
                { resource: 'repo:*', actions: ['read', 'write'], effect: 'allow' },
                { resource: 'service:payments', actions: ['read'], effect: 'allow' }
            ]
        }
    },
    delegatedPermissions: delegationModule.listActiveDelegatedPermissions({
        granteeAgentId: agentIdentity.payload.agentId
    })
};

const graphBuilder = new AuthorityGraphBuilder();
const authorityGraph = graphBuilder.build(buildInput);

console.log(`Authority graph: ${authorityGraph.canExecute.length} can_execute, ${authorityGraph.requiresApproval.length} requires_approval, ${authorityGraph.prohibited.length} prohibited`);

// 7. Build a portable authority token
const rootAssertion = AuthorityVerificationProtocol.issueAssertion(
    'org_root',
    'owner_alice',
    AssertionType.MEMBERSHIP,
    { orgId: 'org_engineering', role: 'engineer' },
    ownerKeyPair.privateKey,
    ownerKeyPair.publicKey,
    7200
);

const delegationAssertion = AuthorityVerificationProtocol.issueAssertion(
    'owner_alice',
    agentIdentity.payload.agentId,
    AssertionType.DELEGATION,
    { delegationId: delegation.delegationId, scope: delegation.scope },
    agentKeyPair.privateKey,
    agentKeyPair.publicKey,
    3600
);

const portableToken = AuthorityVerificationProtocol.createPortableToken(
    agentIdentity.payload,
    agentIdentity.signature,
    {
        assertions: [rootAssertion, delegationAssertion],
        targetSubjectId: agentIdentity.payload.agentId
    }
);

console.log('Portable authority token created');

// ---------------------------------------------------------------------------
// Create the API
// ---------------------------------------------------------------------------

section('CREATING IdentityAuthorityAPI');

const api = new IdentityAuthorityAPI({
    platformId: 'demo-platform-001',
    trustedRootPublicKeys: [ownerKeyPair.publicKey],
    identityCore,
    orgGraph,
    delegationModule,
    auditTraceEngine,
    approvalRoutingEngine: approvalEngine,
    defaultComplianceTags: ['demo', 'identity_system']
});

console.log(`API created with platform ID: ${api.getPlatformId()}`);

// ---------------------------------------------------------------------------
// Demo 1: Verify Agent Identity
// ---------------------------------------------------------------------------

section('1. VERIFY AGENT IDENTITY');

const verifyResult = api.verifyIdentity({
    signedIdentity: agentIdentity,
    portableToken,
    trustedRootPublicKeys: [ownerKeyPair.publicKey]
});

console.log(`Success: ${verifyResult.success}`);
console.log(`Identity Valid: ${verifyResult.data?.identityValid}`);
console.log(`Agent ID: ${verifyResult.data?.agentId}`);
console.log(`Revoked: ${verifyResult.data?.isRevoked}`);
console.log(`Remaining Validity: ${Math.round((verifyResult.data?.remainingValidityMs ?? 0) / 86400000)} days`);
console.log(`Token Verification: ${verifyResult.data?.tokenVerification?.trustChainStatus ?? 'N/A'}`);

subSection('Authority Proof');
console.log(`Decision: ${verifyResult.data?.proof.decision}`);
console.log(`Summary: ${verifyResult.data?.proof.summary}`);
console.log(`Evidence Chain (${verifyResult.data?.proof.evidenceChain.length} items):`);
for (const item of verifyResult.data?.proof.evidenceChain ?? []) {
    console.log(`  [${item.source}] ${item.claim} (supports: ${item.supports})`);
}

subSection('Cross-Platform Metadata');
console.log(`Response ID: ${verifyResult.metadata.responseId}`);
console.log(`Platform: ${verifyResult.metadata.platformId}`);
console.log(`API Version: ${verifyResult.metadata.apiVersion}`);
console.log(`Digest: ${verifyResult.metadata.responseDigest.slice(0, 16)}...`);
console.log(`Processing Time: ${verifyResult.metadata.processingTimeMs}ms`);
console.log(`Trace ID: ${verifyResult.metadata.traceId}`);

// ---------------------------------------------------------------------------
// Demo 2: Retrieve Authority Graph
// ---------------------------------------------------------------------------

section('2. RETRIEVE AUTHORITY GRAPH');

const graphResult = api.retrieveAuthorityGraph(
    { agentId: agentIdentity.payload.agentId },
    buildInput
);

console.log(`Success: ${graphResult.success}`);

subSection('Graph Statistics');
const stats = graphResult.data?.stats;
console.log(`Total Rules: ${stats?.totalRules}`);
console.log(`Can Execute: ${stats?.canExecuteCount}`);
console.log(`Requires Approval: ${stats?.requiresApprovalCount}`);
console.log(`Prohibited: ${stats?.prohibitedCount}`);
console.log(`Delegations: ${stats?.delegationCount}`);
console.log(`Nodes: ${stats?.nodeCount}`);
console.log(`Edges: ${stats?.edgeCount}`);

subSection('Active Delegations');
for (const d of graphResult.data?.activeDelegations ?? []) {
    console.log(`  ${d.delegationId}: ${d.grantorAgentId} -> ${d.granteeAgentId} [${d.scope.resources.join(', ')}] (${d.status})`);
}

subSection('Authority Proof');
console.log(`Decision: ${graphResult.data?.proof.decision}`);
console.log(`Summary: ${graphResult.data?.proof.summary}`);

subSection('Cross-Platform Metadata');
console.log(`Digest: ${graphResult.metadata.responseDigest.slice(0, 16)}...`);
console.log(`Trace ID: ${graphResult.metadata.traceId}`);

// ---------------------------------------------------------------------------
// Demo 3: Validate Proposed Action
// ---------------------------------------------------------------------------

section('3. VALIDATE PROPOSED ACTION');

subSection('3a. Action that should succeed (repo read in dev)');

const readAction = {
    agentId: agentIdentity.payload.agentId,
    action: 'read',
    resource: 'repo:my-service',
    context: {
        environment: 'development' as const,
        region: 'us-east-1',
        timestamp: Date.now()
    }
};

const validateReadResult = api.validateAction({
    action: readAction,
    authorityGraph,
    portableToken,
    trustedRootPublicKeys: [ownerKeyPair.publicKey]
});

console.log(`Authorized: ${validateReadResult.data?.validation.authorized}`);
console.log(`Is Delegated: ${validateReadResult.data?.validation.isDelegated}`);
console.log(`Violations: ${validateReadResult.data?.validation.violations.length}`);
console.log(`Enforcement Allowed: ${validateReadResult.data?.enforcement?.allowed ?? 'N/A'}`);
console.log(`Anomalies: ${validateReadResult.data?.enforcement?.anomalies.length ?? 0}`);
console.log(`Proof Decision: ${validateReadResult.data?.proof.decision}`);

subSection('3b. Action requiring approval (deploy to payments)');

const deployAction = {
    agentId: agentIdentity.payload.agentId,
    action: 'deploy',
    resource: 'service:payments',
    resourceOwnerId: 'owner_bob',
    context: {
        environment: 'development' as const,
        region: 'us-east-1',
        timestamp: Date.now()
    }
};

const validateDeployResult = api.validateAction({
    action: deployAction,
    authorityGraph
});

console.log(`Authorized: ${validateDeployResult.data?.validation.authorized}`);
console.log(`Violations:`);
for (const v of validateDeployResult.data?.validation.violations ?? []) {
    console.log(`  [${v.severity}] ${v.code}: ${v.message}`);
}
console.log(`Approval Route Created: ${!!validateDeployResult.data?.approvalRoute}`);
if (validateDeployResult.data?.approvalRoute) {
    console.log(`  Route ID: ${validateDeployResult.data.approvalRoute.routeId}`);
    console.log(`  Domains: ${validateDeployResult.data.approvalRoute.domains.join(', ')}`);
    console.log(`  Steps: ${validateDeployResult.data.approvalRoute.steps.length}`);
}
console.log(`Proof Decision: ${validateDeployResult.data?.proof.decision}`);

subSection('3c. Prohibited action (production DB write)');

const prohibitedAction = {
    agentId: agentIdentity.payload.agentId,
    action: 'delete',
    resource: 'db:production',
    context: {
        environment: 'production' as const,
        timestamp: Date.now()
    }
};

const validateProhibitedResult = api.validateAction({
    action: prohibitedAction,
    authorityGraph
});

console.log(`Authorized: ${validateProhibitedResult.data?.validation.authorized}`);
console.log(`Violations:`);
for (const v of validateProhibitedResult.data?.validation.violations ?? []) {
    console.log(`  [${v.severity}] ${v.code}: ${v.message}`);
}
console.log(`Proof Decision: ${validateProhibitedResult.data?.proof.decision}`);

// ---------------------------------------------------------------------------
// Demo 4: Query Delegation Chains
// ---------------------------------------------------------------------------

section('4. QUERY DELEGATION CHAINS');

subSection('4a. Trace a specific delegation');

const chainResult = api.queryDelegationChain({
    delegationId: delegation.delegationId
});

console.log(`Chain Depth: ${chainResult.data?.chainDepth}`);
console.log(`Records:`);
for (const link of chainResult.data?.chain ?? []) {
    console.log(`  [depth ${link.depth}] ${link.grantorAgentId} -> ${link.granteeAgentId} ` +
        `[${link.scope.resources.join(', ')}] (${link.status})`);
}
console.log(`Proof Decision: ${chainResult.data?.proof.decision}`);

subSection('4b. List all delegations for the agent');

const agentDelegations = api.queryDelegationChain({
    granteeAgentId: agentIdentity.payload.agentId
});

console.log(`Found ${agentDelegations.data?.records.length} delegation(s) for agent`);
for (const rec of agentDelegations.data?.records ?? []) {
    console.log(`  ${rec.delegationId}: ${rec.grantorAgentId} granted [${rec.scope.resources.join(', ')}]`);
}

// ---------------------------------------------------------------------------
// Demo 5: Simulate Approval Requirements
// ---------------------------------------------------------------------------

section('5. SIMULATE APPROVAL REQUIREMENTS');

subSection('5a. Deploying to payments (should require approval)');

const simResult = api.simulateApprovalRequirements({
    action: deployAction,
    authorityGraph
});

console.log(`Requires Approval: ${simResult.data?.requiresApproval}`);
if (simResult.data?.simulatedRoute) {
    const sim = simResult.data.simulatedRoute;
    console.log(`Route ID: ${sim.routeId}`);
    console.log(`Domains: ${sim.domains.join(', ')}`);
    console.log(`Estimated Approver Count: ${sim.estimatedApproverCount}`);
    console.log(`Reasons: ${sim.reasons.join('; ')}`);
    console.log(`Steps:`);
    for (const step of sim.steps) {
        console.log(`  Step "${step.stepId}" | Domains: ${step.domains.join(', ')} | ` +
            `Approvers: ${step.approverIds.join(', ')} | Policy: ${step.decisionPolicy} | ` +
            `Status: ${step.status}`);
    }
}

subSection('Authority Proof');
console.log(`Decision: ${simResult.data?.proof.decision}`);
console.log(`Summary: ${simResult.data?.proof.summary}`);
console.log(`Evidence:`);
for (const item of simResult.data?.proof.evidenceChain ?? []) {
    console.log(`  [${item.source}] ${item.claim}`);
}

subSection('5b. Reading a repo (should NOT require approval)');

const simReadResult = api.simulateApprovalRequirements({
    action: readAction,
    authorityGraph
});

console.log(`Requires Approval: ${simReadResult.data?.requiresApproval}`);
console.log(`Proof Decision: ${simReadResult.data?.proof.decision}`);

// ---------------------------------------------------------------------------
// Demo 6: Batch Verify Identities
// ---------------------------------------------------------------------------

section('6. BATCH VERIFY IDENTITIES');

// Revoke the second identity to show mixed results
identityCore.revokeIdentity(secondIdentity.payload.agentId);

const batchResult = api.batchVerifyIdentities({
    identities: [agentIdentity, secondIdentity]
});

console.log(`Total: ${batchResult.data?.results.length}`);
console.log(`Valid: ${batchResult.data?.validCount}`);
console.log(`Invalid: ${batchResult.data?.invalidCount}`);
console.log(`Results:`);
for (const r of batchResult.data?.results ?? []) {
    console.log(`  ${r.agentId}: ${r.valid ? 'VALID' : `INVALID (${r.reason})`}`);
}

subSection('Cross-Platform Metadata');
console.log(`Digest: ${batchResult.metadata.responseDigest.slice(0, 16)}...`);
console.log(`Trace ID: ${batchResult.metadata.traceId}`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

section('DEMO COMPLETE');

console.log('\nThe IdentityAuthorityAPI provides:');
console.log('  1. verifyIdentity()              - Cryptographic identity + token verification');
console.log('  2. retrieveAuthorityGraph()       - Full permission model for an agent');
console.log('  3. validateAction()               - Scope, delegation, context, and enforcement checks');
console.log('  4. queryDelegationChain()          - Trace delegation inheritance');
console.log('  5. simulateApprovalRequirements()  - Predict approval workflows without side effects');
console.log('  6. batchVerifyIdentities()         - Bulk identity verification');
console.log('\nEvery response includes:');
console.log('  - StructuredAuthorityProof     (evidence chain, cryptographic assertions, graph fragment)');
console.log('  - CrossPlatformVerificationMetadata (digest, trace ID, platform ID, timing)');

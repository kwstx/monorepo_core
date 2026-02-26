import { AuthorityGraphBuilder, AuthorityGraphBuildInput } from './AuthorityGraphBuilder';
import { ApprovalRoutingEngine } from './ApprovalRoutingEngine';
import { AgentAction } from './ActionValidationTypes';
import { IdentityClaimSet } from './IdentityIntegrationLayer';
import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import { EntityType, RelationshipType } from './orgGraphTypes';
import { AgentIdentityPayload } from './types';

async function runApprovalRoutingDemo() {
    const orgGraph = new OrganizationalGraphEngine();

    orgGraph.addNode({ id: 'agent_01', type: EntityType.AGENT, name: 'Agent 01' });
    orgGraph.addNode({ id: 'user_mgr_01', type: EntityType.USER, name: 'Manager 01' });
    orgGraph.addNode({ id: 'user_legal_01', type: EntityType.USER, name: 'Legal Counsel' });
    orgGraph.addNode({ id: 'user_fin_01', type: EntityType.USER, name: 'Finance Controller' });
    orgGraph.addNode({ id: 'dept_engineering', type: EntityType.DEPARTMENT, name: 'Engineering' });
    orgGraph.addNode({ id: 'dept_finance', type: EntityType.DEPARTMENT, name: 'Finance' });

    orgGraph.addRelationship({
        fromId: 'agent_01',
        toId: 'user_mgr_01',
        type: RelationshipType.REPORTS_TO
    });
    orgGraph.addRelationship({
        fromId: 'agent_01',
        toId: 'dept_engineering',
        type: RelationshipType.MEMBER_OF
    });
    orgGraph.addRelationship({
        fromId: 'user_fin_01',
        toId: 'dept_finance',
        type: RelationshipType.APPROVES_FOR
    });

    const identity: AgentIdentityPayload = {
        agentId: 'agent_01',
        ownerId: 'owner_01',
        orgId: 'org_main',
        scope: { resources: ['finance.ledger'], actions: ['read'] },
        context: { environment: 'production' },
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        version: 1,
        publicKey: 'demo-public-key'
    };

    const claims: IdentityClaimSet = {
        subject: { id: 'owner_01' },
        roles: { assigned: ['role_engineer'], resolved: ['role_engineer'] },
        departments: { activeDepartmentId: 'dept_engineering', lineage: ['dept_engineering'] },
        permissionScopes: [{ resource: 'finance.ledger', actions: ['read'] }],
        source: { synchronizedAt: Date.now() }
    };

    const buildInput: AuthorityGraphBuildInput = {
        identity,
        identityClaims: claims,
        organizationalGraph: {
            orgId: 'org_main',
            rolePolicies: {
                role_engineer: [
                    {
                        resource: 'finance.ledger',
                        actions: ['read'],
                        effect: 'require_approval',
                        reason: 'Finance ledger requires explicit approval'
                    }
                ]
            }
        }
    };

    const authorityGraph = new AuthorityGraphBuilder().build(buildInput);
    const routing = new ApprovalRoutingEngine({
        orgGraph,
        domainApprovers: {
            legal: { approverIds: ['user_legal_01'] },
            financial: { approverIds: ['user_fin_01'] }
        },
        rules: [
            {
                id: 'large-finance-read',
                resourcePattern: 'finance.*',
                actionPattern: 'read',
                requiresAmountAtLeast: 10_000,
                addDomains: ['financial', 'legal'],
                workflow: 'sequential',
                reason: 'High-value finance operations require legal and financial validation'
            }
        ]
    });

    const action: AgentAction = {
        agentId: 'agent_01',
        action: 'read',
        resource: 'finance.ledger',
        resourceOwnerId: 'dept_finance',
        context: {
            environment: 'production',
            timestamp: Date.now(),
            metadata: { amount: 50_000 }
        }
    };

    const routed = routing.routeRequest({ action, authorityGraph, traceId: 'trace-demo-approval' });
    if (!routed.requiresApproval || !routed.route) {
        console.log('No approval required.');
        return;
    }

    console.log('Route status:', routed.route.status);
    console.log('Route domains:', routed.route.domains.join(', '));
    console.log('Route reasons:', routed.route.reasons.join(' | '));
    console.log('Steps:');
    for (const step of routed.route.steps) {
        console.log(` - ${step.stepId}: ${step.status} (${step.domains.join(', ')})`);
    }

    // Sequential flow example: manager -> finance -> legal -> cross-department
    const afterManager = routing.submitApprovalDecision({
        routeId: routed.route.routeId,
        stepId: routed.route.steps[0].stepId,
        approverId: 'user_mgr_01',
        approved: true
    });

    console.log('Status after manager approval:', afterManager.status);
    console.log('Final step statuses:');
    for (const step of afterManager.steps) {
        console.log(` - ${step.stepId}: ${step.status}`);
    }

    console.log('Approval chain events:');
    for (const event of afterManager.events) {
        console.log(
            ` - [${new Date(event.timestamp).toISOString()}] ${event.type} ${event.stepId ?? ''} ${event.message}`
        );
    }
}

runApprovalRoutingDemo().catch(console.error);


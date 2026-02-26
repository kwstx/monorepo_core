import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import { EntityType, RelationshipType } from './orgGraphTypes';
import { AuthorityGraphBuilder, AuthorityGraphBuildInput } from './AuthorityGraphBuilder';
import { ActionValidationEngine } from './ActionValidationEngine';
import { AgentIdentityPayload } from './types';
import { IdentityClaimSet } from './IdentityIntegrationLayer';

async function runValidationDemo() {
    const orgGraph = new OrganizationalGraphEngine();

    // 1. Setup Org Graph
    orgGraph.addNode({ id: 'dept_engineering', type: EntityType.DEPARTMENT, name: 'Engineering' });
    orgGraph.addNode({ id: 'dept_finance', type: EntityType.DEPARTMENT, name: 'Finance' });

    orgGraph.addNode({ id: 'agent_001', type: EntityType.AGENT, name: 'Agent 1' });
    orgGraph.addNode({ id: 'user_cfo', type: EntityType.USER, name: 'CFO' });
    orgGraph.addRelationship({ fromId: 'agent_001', toId: 'dept_engineering', type: RelationshipType.MEMBER_OF });

    orgGraph.addNode({ id: 'res_owner_finance', type: EntityType.USER, name: 'Finance Data Owner' });
    orgGraph.addRelationship({ fromId: 'res_owner_finance', toId: 'dept_finance', type: RelationshipType.MEMBER_OF });

    // CFO approves for Finance
    orgGraph.addRelationship({
        fromId: 'user_cfo',
        toId: 'dept_finance',
        type: RelationshipType.APPROVES_FOR
    });

    // 2. Setup Agent Identity
    const agentIdentity: AgentIdentityPayload = {
        agentId: 'agent_001',
        ownerId: 'user_dev_01',
        orgId: 'org_main',
        scope: {
            resources: ['system.logs', 'cloud.compute/*'],
            actions: ['read', 'write']
        },
        context: {
            environment: 'development'
        },
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        version: 1,
        publicKey: 'mock_key'
    };

    const identityClaims: IdentityClaimSet = {
        subject: { id: 'user_dev_01' },
        roles: { assigned: ['role_developer'], resolved: ['role_developer'] },
        departments: { activeDepartmentId: 'dept_engineering', lineage: ['dept_engineering'] },
        permissionScopes: [
            { resource: 'finance.records', actions: ['read'], constraints: { requireApproval: true } }
        ],
        source: { synchronizedAt: Date.now() }
    };

    // 3. Build Authority Graph
    const builder = new AuthorityGraphBuilder();
    const buildInput: AuthorityGraphBuildInput = {
        identity: agentIdentity,
        identityClaims: identityClaims,
        organizationalGraph: {
            orgId: 'org_main',
            rolePolicies: {
                'role_developer': [
                    { resource: 'finance.records', actions: ['read'], effect: 'require_approval', reason: 'Finance data access requires approval' }
                ]
            }
        }
    };
    const authorityGraph = builder.build(buildInput);

    // 4. Validate Actions
    const engine = new ActionValidationEngine({ orgGraph });

    console.log('--- Action Validation Demo ---');

    const actions = [
        {
            name: 'Allowed Action (Direct Scope)',
            action: {
                agentId: 'agent_001',
                action: 'read',
                resource: 'system.logs',
                context: { environment: 'development', timestamp: Date.now() }
            }
        },
        {
            name: 'Prohibited Action (Not in scope)',
            action: {
                agentId: 'agent_001',
                action: 'delete',
                resource: 'system.logs',
                context: { environment: 'development', timestamp: Date.now() }
            }
        },
        {
            name: 'Approval Required Action (Cross-unit Finance)',
            action: {
                agentId: 'agent_001',
                action: 'read',
                resource: 'finance.records',
                resourceOwnerId: 'res_owner_finance',
                context: { environment: 'development', timestamp: Date.now() }
            }
        },
        {
            name: 'Context Mismatch (Prod action with Dev authority)',
            action: {
                agentId: 'agent_001',
                action: 'read',
                resource: 'system.logs',
                context: { environment: 'production', timestamp: Date.now() }
            }
        }
    ];

    for (const test of actions) {
        console.log(`\nTesting: ${test.name}`);
        const result = engine.validateAction(test.action as any, authorityGraph);
        console.log(`Authorized: ${result.authorized}`);
        if (result.violations.length > 0) {
            console.log('Violations:');
            result.violations.forEach(v => console.log(` - [${v.code}] ${v.message} (${v.severity})`));
        }
        if (result.requiredApprovals.length > 0) {
            console.log(`Required Approvers: ${result.requiredApprovals.join(', ')}`);
        }
    }
}

runValidationDemo().catch(console.error);

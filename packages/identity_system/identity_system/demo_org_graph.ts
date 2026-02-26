import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import { EntityType, RelationshipType } from './orgGraphTypes';

async function runDemo() {
    const engine = new OrganizationalGraphEngine();

    // 1. Setup Departments
    engine.addNode({ id: 'dept_corp', type: EntityType.DEPARTMENT, name: 'Corporate' });
    engine.addNode({ id: 'dept_engineering', type: EntityType.DEPARTMENT, name: 'Engineering' });
    engine.addNode({ id: 'dept_finance', type: EntityType.DEPARTMENT, name: 'Finance' });

    engine.addRelationship({
        fromId: 'dept_engineering',
        toId: 'dept_corp',
        type: RelationshipType.PART_OF
    });
    engine.addRelationship({
        fromId: 'dept_finance',
        toId: 'dept_corp',
        type: RelationshipType.PART_OF
    });

    // 2. Setup Roles
    engine.addNode({
        id: 'role_admin',
        type: EntityType.ROLE,
        name: 'Administrator',
        metadata: { scope: { resources: ['*'], actions: ['*'] } }
    });
    engine.addNode({
        id: 'role_engineer',
        type: EntityType.ROLE,
        name: 'Engineer',
        metadata: { scope: { resources: ['repo', 'build_server'], actions: ['read', 'write'] } }
    });

    // 3. Setup Users
    engine.addNode({ id: 'user_cto', type: EntityType.USER, name: 'CTO' });
    engine.addNode({ id: 'user_lead', type: EntityType.USER, name: 'Tech Lead' });
    engine.addNode({ id: 'user_dev', type: EntityType.USER, name: 'Developer' });
    engine.addNode({ id: 'user_cfo', type: EntityType.USER, name: 'CFO' });

    // 4. Setup Relationships
    // Reporting
    engine.addRelationship({ fromId: 'user_dev', toId: 'user_lead', type: RelationshipType.REPORTS_TO });
    engine.addRelationship({ fromId: 'user_lead', toId: 'user_cto', type: RelationshipType.REPORTS_TO });

    // Membership
    engine.addRelationship({ fromId: 'user_dev', toId: 'dept_engineering', type: RelationshipType.MEMBER_OF });
    engine.addRelationship({ fromId: 'user_lead', toId: 'dept_engineering', type: RelationshipType.MEMBER_OF });
    engine.addRelationship({ fromId: 'user_cto', toId: 'dept_engineering', type: RelationshipType.MEMBER_OF });
    engine.addRelationship({ fromId: 'user_cfo', toId: 'dept_finance', type: RelationshipType.MEMBER_OF });

    // Roles
    engine.addRelationship({ fromId: 'user_cto', toId: 'role_admin', type: RelationshipType.HAS_ROLE });
    engine.addRelationship({ fromId: 'user_dev', toId: 'role_engineer', type: RelationshipType.HAS_ROLE });

    // Cross-functional Approval
    // Finance department needs approval from CFO for external actions
    engine.addRelationship({
        fromId: 'user_cfo',
        toId: 'dept_finance',
        type: RelationshipType.APPROVES_FOR,
        metadata: { category: 'budget' }
    });
    engine.addRelationship({
        fromId: 'user_cfo',
        toId: 'dept_engineering',
        type: RelationshipType.APPROVES_FOR,
        metadata: { category: 'budget' }
    });

    // 5. Test Queries
    console.log('--- Organizational Graph Analysis ---');

    console.log('\nReporting Chain for Developer:');
    console.log(engine.getReportingChain('user_dev').join(' -> '));

    console.log('\nDepartment Lineage for Developer:');
    console.log(engine.getDepartmentLineage('user_dev').join(' -> '));

    console.log('\nAuthority Check (Developer - Write Repo):');
    console.log(engine.isAuthorized('user_dev', 'write', 'repo') ? '✅ AUTHORIZED' : '❌ DENIED');

    console.log('\nAuthority Check (Developer - Purge Database):');
    console.log(engine.isAuthorized('user_dev', 'purge', 'database') ? '✅ AUTHORIZED' : '❌ DENIED');

    console.log('\nDelegation Validation: Can CTO delegate Admin to Developer?');
    const delegationReq = {
        sourceId: 'user_cto',
        targetId: 'user_dev',
        scope: { resources: ['*'], actions: ['*'] }
    };
    console.log(engine.validateDelegation(delegationReq) ? '✅ VALID' : '❌ INVALID');

    console.log('\nDelegation Validation: Can Developer delegate Admin to CTO?');
    const invalidDelegation = {
        sourceId: 'user_dev',
        targetId: 'user_cto',
        scope: { resources: ['*'], actions: ['*'] }
    };
    console.log(engine.validateDelegation(invalidDelegation) ? '✅ VALID' : '❌ INVALID');

    // Perform delegation
    engine.addRelationship({
        fromId: 'user_cto',
        toId: 'user_dev',
        type: RelationshipType.DELEGATED_TO,
        scope: { resources: ['server_maintenance'], actions: ['execute'] }
    });

    console.log('\nAuthority Check (Developer - Execute Server Maintenance) after delegation:');
    console.log(engine.isAuthorized('user_dev', 'execute', 'server_maintenance') ? '✅ AUTHORIZED' : '❌ DENIED');

    console.log('\nRequired Approvers for Developer (Eng) acting on Finance Resource:');
    // Simulate CFO as owner of a finance resource
    console.log(engine.getRequiredApprovers('user_dev', 'user_cfo'));
}

runDemo().catch(console.error);

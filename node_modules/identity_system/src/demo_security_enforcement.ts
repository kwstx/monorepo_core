import { SecurityEnforcementLayer } from './SecurityEnforcementLayer';
import { ActionValidationEngine } from './ActionValidationEngine';
import { OrganizationalGraphEngine } from './OrganizationalGraphEngine';
import { AuthorityVerificationProtocol } from './AuthorityVerificationProtocol';
import { AuthorityGraphBuilder } from './AuthorityGraphBuilder';
import { CryptoUtils } from './crypto';
import { AssertionType } from './VerificationProtocolTypes';
import { EntityType, RelationshipType } from './orgGraphTypes';

async function runSecurityDemo() {
    console.log('=== Security Enforcement Layer Demo ===\n');

    // 1. Setup Infrastructure
    const rootKeys = CryptoUtils.generateKeyPair();
    const agentKeys = CryptoUtils.generateKeyPair();
    const orgGraph = new OrganizationalGraphEngine();
    const validationEngine = new ActionValidationEngine({ orgGraph });
    const enforcementLayer = new SecurityEnforcementLayer({
        validationEngine,
        trustedRootPublicKeys: [rootKeys.publicKey]
    });

    // 2. Setup Org Structure
    orgGraph.addNode({ id: 'dept_it', type: EntityType.DEPARTMENT, name: 'IT' });
    orgGraph.addNode({ id: 'agent_007', type: EntityType.AGENT, name: 'James' });
    orgGraph.addRelationship({ fromId: 'agent_007', toId: 'dept_it', type: RelationshipType.MEMBER_OF });

    // 3. Create Identity and Token
    const agentIdentity = {
        agentId: 'agent_007',
        ownerId: 'user_m',
        orgId: 'mi6',
        scope: {
            resources: ['db.intelligence/*', 'server.command/*'],
            actions: ['read', 'execute']
        },
        context: { environment: 'production' as const },
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        version: 1,
        publicKey: agentKeys.publicKey
    };

    const identitySignature = CryptoUtils.sign(JSON.stringify(agentIdentity), agentKeys.privateKey);

    // Create a valid authority proof (chain of assertions)
    const assertion = AuthorityVerificationProtocol.issueAssertion(
        'root_ca',
        'agent_007',
        AssertionType.PERMISSION,
        { resource: 'db.intelligence/*', actions: ['read'] },
        rootKeys.privateKey,
        rootKeys.publicKey
    );

    const proof = {
        assertions: [assertion],
        targetSubjectId: 'agent_007'
    };

    const validToken = AuthorityVerificationProtocol.createPortableToken(agentIdentity, identitySignature, proof);

    // 4. Build Authority Graph for the agent
    const builder = new AuthorityGraphBuilder();
    const authorityGraph = builder.build({
        identity: agentIdentity,
        identityClaims: {
            subject: { id: 'user_m' },
            roles: { assigned: ['admin'], resolved: ['admin'] },
            departments: { activeDepartmentId: 'dept_it', lineage: ['dept_it'] },
            permissionScopes: [{ resource: 'db.intelligence/*', actions: ['read'] }],
            source: { synchronizedAt: Date.now() }
        },
        organizationalGraph: {
            orgId: 'mi6',
            rolePolicies: {
                'admin': [
                    { resource: 'db.intelligence/*', actions: ['read'], effect: 'allow' }
                ]
            }
        }
    });

    // Case 1: Valid Action
    console.log('--- TEST 1: Valid Authorized Action ---');
    const validAction = {
        agentId: 'agent_007',
        action: 'read',
        resource: 'db.intelligence/secret_files',
        context: { environment: 'production' as const, timestamp: Date.now() }
    };
    const result1 = enforcementLayer.enforce(validAction, validToken, authorityGraph);
    console.log(`Allowed: ${result1.allowed}\n`);

    // Case 2: Unverified Token (Tampered signature)
    console.log('--- TEST 2: Unverified Identity Token ---');
    const tamperedToken = { ...validToken, identitySignature: 'invalid_sig' };
    const result2 = enforcementLayer.enforce(validAction, tamperedToken, authorityGraph);
    console.log(`Allowed: ${result2.allowed}`);
    console.log(`Anomalies: ${result2.anomalies.map(a => `${a.type}: ${a.message}`).join(', ')}\n`);

    // Case 3: Scope Escalation (Action outside token scope)
    console.log('--- TEST 3: Unauthorized Scope Escalation ---');
    const escalationAction = {
        agentId: 'agent_007',
        action: 'delete',
        resource: 'db.intelligence/secret_files',
        context: { environment: 'production' as const, timestamp: Date.now() }
    };
    const result3 = enforcementLayer.enforce(escalationAction, validToken, authorityGraph);
    console.log(`Allowed: ${result3.allowed}`);
    console.log(`Anomalies: ${result3.anomalies.map(a => `${a.type}: ${a.message}`).join(', ')}\n`);

    // Case 4: Bypassed Approvals
    console.log('--- TEST 4: Bypassed Approvals ---');
    // First, update authority graph to require approval for this resource
    const restrictedGraph = {
        ...authorityGraph,
        canExecute: [],
        requiresApproval: [{
            resource: 'server.command/reboot',
            action: 'execute',
            decision: 'requires_approval' as const,
            reasons: ['Reboot requires peer approval'],
            sources: ['policy:strict']
        }],
        prohibited: []
    };
    const rebootAction = {
        agentId: 'agent_007',
        action: 'execute',
        resource: 'server.command/reboot',
        resourceOwnerId: 'admin_root',
        context: { environment: 'production' as const, timestamp: Date.now() }
    };
    const result4 = enforcementLayer.enforce(rebootAction, validToken, restrictedGraph as any);
    console.log(`Allowed: ${result4.allowed}`);
    console.log(`Anomalies: ${result4.anomalies.map(a => `${a.type}: ${a.message}`).join(', ')}\n`);

    console.log('--- Audit Log Summary ---');
    console.log(`Total events logged: ${enforcementLayer.getAuditLogs().length}`);
    const lastLog = enforcementLayer.getAuditLogs()[enforcementLayer.getAuditLogs().length - 1];
    console.log(`Last Trace ID: ${lastLog.logId}`);
}

runSecurityDemo().catch(console.error);

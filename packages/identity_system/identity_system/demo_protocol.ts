import { CryptoUtils } from './crypto';
import { AuthorityVerificationProtocol } from './AuthorityVerificationProtocol';
import { AssertionType, PortableAuthorityToken } from './VerificationProtocolTypes';
import { AgentIdentityPayload } from './types';

async function runProtocolDemo() {
    console.log("--- Starting Authority Verification Protocol Demo ---");

    // 1. Setup Entities and Keys
    const hrAdmin = { id: 'HR_ROOT_AUTH', ...CryptoUtils.generateKeyPair() };
    const managerAlice = { id: 'ALICE_ENG_MGR', ...CryptoUtils.generateKeyPair() };
    const agentBob = { id: 'BOB_DEPLOY_AGENT', ...CryptoUtils.generateKeyPair() };

    console.log("1. Entities created: HR Root, Manager Alice, Agent Bob.");

    // 2. HR Root issues assertion for Alice
    console.log("2. HR Root asserting Alice's role as Engineering Manager...");
    const aliceAssertion = AuthorityVerificationProtocol.issueAssertion(
        hrAdmin.id,
        managerAlice.id,
        AssertionType.ROLE_ASSIGNMENT,
        { role: 'ENGINEERING_MANAGER', department: 'ENGINEERING' },
        hrAdmin.privateKey,
        hrAdmin.publicKey
    );

    // 3. Manager Alice issues delegation for Agent Bob
    console.log("3. Manager Alice asserting Bob's delegated authority...");
    const bobDelegation = AuthorityVerificationProtocol.issueAssertion(
        managerAlice.id,
        agentBob.id,
        AssertionType.DELEGATION,
        {
            canActions: ['DEPLOY'],
            onResources: ['PROD-SERVER-01'],
            delegatedBy: 'ALICE_ENG_MGR'
        },
        managerAlice.privateKey,
        managerAlice.publicKey
    );

    // 4. Create Agent Bob's Identity Payload
    const bobIdentity: AgentIdentityPayload = {
        agentId: agentBob.id,
        ownerId: 'USER_123',
        orgId: 'ORG_ACME',
        scope: {
            resources: ['PROD-SERVER-01'],
            actions: ['DEPLOY']
        },
        context: {
            environment: 'production'
        },
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        version: 1,
        publicKey: agentBob.publicKey
    };

    const bobIdentitySignature = CryptoUtils.sign(JSON.stringify(bobIdentity), agentBob.privateKey);

    // 5. Bundle everything into a Portable Authority Token
    const proof = {
        assertions: [aliceAssertion, bobDelegation],
        targetSubjectId: agentBob.id
    };

    const portableToken: PortableAuthorityToken = AuthorityVerificationProtocol.createPortableToken(
        bobIdentity,
        bobIdentitySignature,
        proof
    );

    console.log("\n4. Portable Authority Token Generated for Agent Bob.");
    console.log("   (This token is serialized and sent to the remote API)");

    // 6. Remote System Verification (e.g., API Gateway)
    console.log("\n5. Remote API Gateway receiving and verifying token...");

    // The Gateway only knows the HR Root Public Key (Trust Anchor)
    const trustedKeys = [hrAdmin.publicKey];

    const result = AuthorityVerificationProtocol.verifyPortableToken(portableToken, trustedKeys);

    if (result.isValid) {
        console.log("✅ Verification SUCCESSFUL!");
        console.log("   Trust Chain Status:", result.trustChainStatus);
        console.log("   Verified Claims:", JSON.stringify(result.verifiedClaims, null, 2));
    } else {
        console.log("❌ Verification FAILED!");
        console.log("   Reason:", result.reason);
    }
}

runProtocolDemo().catch(console.error);

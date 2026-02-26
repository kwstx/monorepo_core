import { AgentIdentityCore } from './AgentIdentityCore';
import { AgentIdentityMetadata } from './types';

async function demo() {
    const core = new AgentIdentityCore();

    console.log('--- Creating Agent Identity ---');
    const metadata: AgentIdentityMetadata = {
        ownerId: 'user_123',
        orgId: 'deepmind_corp',
        scope: {
            resources: ['database_x', 'api_y'],
            actions: ['read', 'write']
        },
        context: {
            environment: 'production',
            region: 'us-east-1'
        }
    };

    const { identity, keyPair } = core.createIdentity(metadata);
    console.log('Agent ID:', identity.payload.agentId);
    console.log('Issued At:', new Date(identity.payload.issuedAt).toISOString());
    console.log('Expires At:', new Date(identity.payload.expiresAt).toISOString());

    console.log('\n--- Verifying Identity ---');
    const verificationResult = core.verifyIdentity(identity);
    console.log('Verification Status:', verificationResult.valid ? 'SUCCESS' : 'FAILED');
    if (verificationResult.reason) console.log('Reason:', verificationResult.reason);

    console.log('\n--- Rotating Keys ---');
    const { identity: rotatedIdentity } = core.rotateKeys(identity, keyPair.privateKey, metadata);
    console.log('New Version:', rotatedIdentity.payload.version);
    console.log('Rotation Verification:', core.verifyIdentity(rotatedIdentity).valid ? 'SUCCESS' : 'FAILED');

    console.log('\n--- Revoking Identity ---');
    core.revokeIdentity(identity.payload.agentId);
    const revocationCheck = core.verifyIdentity(rotatedIdentity);
    console.log('Post-Revocation Verification:', revocationCheck.valid ? 'SUCCESS' : 'FAILED');
    console.log('Reason:', revocationCheck.reason);
}

demo().catch(console.error);

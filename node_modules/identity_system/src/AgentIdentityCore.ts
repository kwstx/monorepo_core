import {
    AgentIdentityMetadata,
    AgentIdentityPayload,
    SignedAgentIdentity,
    KeyPair
} from './types';
import { CryptoUtils } from './crypto';
import { v4 as uuidv4 } from 'uuid';

export class AgentIdentityCore {
    private revokedIdentities: Set<string> = new Set();
    private identityKeyMap: Map<string, string> = new Map(); // agentId -> publicKey

    /**
     * Creates a new cryptographically verifiable identity for an agent.
     */
    public createIdentity(
        metadata: AgentIdentityMetadata,
        validityDays: number = 30
    ): { identity: SignedAgentIdentity; keyPair: KeyPair } {
        const agentId = `agent_${uuidv4()}`;
        const keyPair = CryptoUtils.generateKeyPair();

        const now = Date.now();
        const payload: AgentIdentityPayload = {
            agentId,
            ...metadata,
            issuedAt: now,
            expiresAt: now + (validityDays * 24 * 60 * 60 * 1000),
            version: 1,
            publicKey: keyPair.publicKey
        };

        const signature = CryptoUtils.sign(JSON.stringify(payload), keyPair.privateKey);

        const identity: SignedAgentIdentity = {
            payload,
            signature
        };

        this.identityKeyMap.set(agentId, keyPair.publicKey);

        return { identity, keyPair };
    }

    /**
     * Verifies the authenticity and validity of a signed identity.
     */
    public verifyIdentity(signedIdentity: SignedAgentIdentity): { valid: boolean; reason?: string } {
        const { payload, signature } = signedIdentity;

        // 1. Check revocation
        if (this.revokedIdentities.has(payload.agentId)) {
            return { valid: false, reason: 'Identity has been revoked' };
        }

        // 2. Check expiration
        if (Date.now() > payload.expiresAt) {
            return { valid: false, reason: 'Identity has expired' };
        }

        // 3. Cryptographic verification
        const data = JSON.stringify(payload);
        const isValidSignature = CryptoUtils.verify(data, signature, payload.publicKey);

        if (!isValidSignature) {
            return { valid: false, reason: 'Invalid cryptographic signature' };
        }

        return { valid: true };
    }

    /**
     * Rotates the keys for an agent identity.
     */
    public rotateKeys(
        oldIdentity: SignedAgentIdentity,
        oldPrivateKey: string,
        metadata: AgentIdentityMetadata,
        validityDays: number = 30
    ): { identity: SignedAgentIdentity; keyPair: KeyPair } {
        // In a real system, we might want to check if the oldPrivateKey matches the oldIdentity's publicKey
        const newKeyPair = CryptoUtils.generateKeyPair();
        const now = Date.now();

        const newPayload: AgentIdentityPayload = {
            agentId: oldIdentity.payload.agentId,
            ...metadata,
            issuedAt: now,
            expiresAt: now + (validityDays * 24 * 60 * 60 * 1000),
            version: oldIdentity.payload.version + 1,
            publicKey: newKeyPair.publicKey
        };

        const signature = CryptoUtils.sign(JSON.stringify(newPayload), newKeyPair.privateKey);

        const newIdentity: SignedAgentIdentity = {
            payload: newPayload,
            signature
        };

        this.identityKeyMap.set(newPayload.agentId, newKeyPair.publicKey);

        return { identity: newIdentity, keyPair: newKeyPair };
    }

    /**
     * Revokes an agent identity.
     */
    public revokeIdentity(agentId: string): void {
        this.revokedIdentities.add(agentId);
    }

    /**
     * Checks if an identity is revoked.
     */
    public isRevoked(agentId: string): boolean {
        return this.revokedIdentities.has(agentId);
    }
}

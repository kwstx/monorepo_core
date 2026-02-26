import { CryptoUtils } from './crypto';
import {
    AuthorityAssertion,
    AuthorityAssertionPayload,
    AssertionType,
    AuthorityGraphProof,
    PortableAuthorityToken,
    VerificationResult
} from './VerificationProtocolTypes';
import { AgentIdentityPayload } from './types';
import * as crypto from 'node:crypto';

export class AuthorityVerificationProtocol {
    /**
     * Issues a signed authority assertion.
     */
    static issueAssertion(
        issuerId: string,
        subjectId: string,
        type: AssertionType,
        claim: Record<string, any>,
        privateKey: string,
        publicKey: string,
        expiresInSeconds: number = 3600
    ): AuthorityAssertion {
        const payload: AuthorityAssertionPayload = {
            issuerId,
            subjectId,
            type,
            claim,
            issuedAt: Date.now(),
            expiresAt: Date.now() + (expiresInSeconds * 1000),
            nonce: crypto.randomBytes(16).toString('hex')
        };

        const signature = CryptoUtils.sign(JSON.stringify(payload), privateKey);

        return {
            payload,
            signature,
            issuerPublicKey: publicKey
        };
    }

    /**
     * Verifies a single authority assertion.
     */
    static verifyAssertion(assertion: AuthorityAssertion): boolean {
        const { payload, signature, issuerPublicKey } = assertion;

        // 1. Check expiration
        if (Date.now() > payload.expiresAt) {
            return false;
        }

        // 2. Verify signature
        return CryptoUtils.verify(JSON.stringify(payload), signature, issuerPublicKey);
    }

    /**
     * Verifies a portable authority token across systems.
     * This checks both the identity and the supporting authority proof.
     * 
     * This method ensures consistent enforcement by:
     * 1. Requiring a cryptographic proof of authority (not just a claim).
     * 2. Validating the proof against a shared "Trust Anchor" (Root Public Key).
     * 3. Ensuring the proof is linearly connected and terminates at the presenter.
     */
    static verifyPortableToken(
        token: PortableAuthorityToken,
        trustedRootPublicKeys: string[]
    ): VerificationResult {
        // 1. Verify Identity
        const identityValid = CryptoUtils.verify(
            JSON.stringify(token.identity),
            token.identitySignature,
            token.identity.publicKey
        );

        if (!identityValid) {
            return { isValid: false, reason: 'Invalid identity signature', trustChainStatus: 'broken' };
        }

        // 2. Verify individual assertions in the proof
        for (const assertion of token.authorityProof.assertions) {
            if (!this.verifyAssertion(assertion)) {
                return { isValid: false, reason: `Invalid assertion from ${assertion.payload.issuerId}`, trustChainStatus: 'broken' };
            }
        }

        // 3. Verify path continuity (Subject of A must be Issuer of B, or Target)
        // This ensures the chain of authority is unbroken.
        let currentSubject = ''; // Root
        const verifiedClaims: Record<string, any>[] = [];

        for (let i = 0; i < token.authorityProof.assertions.length; i++) {
            const assertion = token.authorityProof.assertions[i];

            // If it's the first assertion, it must be from a trusted root
            if (i === 0) {
                if (!trustedRootPublicKeys.includes(assertion.issuerPublicKey)) {
                    return { isValid: false, reason: 'Assertion chain does not start from a trusted root', trustChainStatus: 'unverified' };
                }
            } else {
                // Subsequent assertions must be linked
                const prevAssertion = token.authorityProof.assertions[i - 1];
                if (assertion.payload.issuerId !== prevAssertion.payload.subjectId) {
                    return { isValid: false, reason: 'Broken authority chain: issuer mismatch', trustChainStatus: 'broken' };
                }
            }
            verifiedClaims.push(assertion.payload.claim);
        }

        // 4. Verify the final subject is the identity being presented
        const lastAssertion = token.authorityProof.assertions[token.authorityProof.assertions.length - 1];
        if (lastAssertion.payload.subjectId !== token.identity.agentId) {
            return { isValid: false, reason: 'Authority proof does not target the presenter identity', trustChainStatus: 'broken' };
        }

        return {
            isValid: true,
            verifiedClaims,
            trustChainStatus: 'verified'
        };
    }

    /**
     * Bundles an identity and its proofs into a portable token.
     */
    static createPortableToken(
        identity: AgentIdentityPayload,
        identitySignature: string,
        proof: AuthorityGraphProof
    ): PortableAuthorityToken {
        return {
            identity,
            identitySignature,
            authorityProof: proof,
            version: '1.0.0'
        };
    }
}

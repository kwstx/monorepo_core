import { PermissionScope } from './orgGraphTypes';
import { AgentIdentityPayload } from './types';

export enum AssertionType {
    MEMBERSHIP = 'MEMBERSHIP',
    REPORTING = 'REPORTING',
    DELEGATION = 'DELEGATION',
    PERMISSION = 'PERMISSION',
    ROLE_ASSIGNMENT = 'ROLE_ASSIGNMENT'
}

export interface AuthorityAssertionPayload {
    issuerId: string;
    subjectId: string;
    type: AssertionType;
    claim: Record<string, any>;
    issuedAt: number;
    expiresAt: number;
    nonce: string;
}

export interface AuthorityAssertion {
    payload: AuthorityAssertionPayload;
    signature: string;
    issuerPublicKey: string; // The public key that can verify this assertion
}

export interface AuthorityGraphProof {
    assertions: AuthorityAssertion[];
    targetSubjectId: string;
    requiredScope?: PermissionScope;
}

export interface PortableAuthorityToken {
    identity: AgentIdentityPayload;
    identitySignature: string;
    authorityProof: AuthorityGraphProof;
    version: string;
}

export interface VerificationResult {
    isValid: boolean;
    reason?: string;
    verifiedClaims?: Record<string, any>[];
    trustChainStatus: 'verified' | 'unverified' | 'broken';
}

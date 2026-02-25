export interface AgentAuthorityScope {
    resources: string[];
    actions: string[];
    constraints?: Record<string, any>;
}

export interface AgentOperationalContext {
    environment: 'production' | 'staging' | 'development';
    region?: string;
    labels?: Record<string, string>;
}

export interface AgentIdentityMetadata {
    ownerId: string;
    orgId: string;
    scope: AgentAuthorityScope;
    context: AgentOperationalContext;
}

export interface AgentIdentityPayload extends AgentIdentityMetadata {
    agentId: string;
    issuedAt: number;
    expiresAt: number;
    version: number;
    publicKey: string; // PEM or JWK format
}

export interface SignedAgentIdentity {
    payload: AgentIdentityPayload;
    signature: string;
}

export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

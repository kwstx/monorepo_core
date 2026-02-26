# Authority Verification Protocol (AVP)

Standards-based protocol for verifying agent identities and authority graphs across heterogeneous systems.

## Core Concepts

### 1. Authority Assertion
An `AuthorityAssertion` is a cryptographically signed statement issued by an authority. It links a `Subject` to a `Claim`.
- **Issuer**: The entity making the assertion.
- **Subject**: The entity the assertion is about.
- **Claim**: The specific fact being asserted (e.g., membership, role, delegation).
- **Signature**: Ensures the assertion hasn't been tampered with and originated from the issuer.

### 2. Authority Graph Proof
A collection of assertions that form a chain of trust from a **Trust Anchor** (Root Authority) to the **Target Identity**.
- Each link in the chain is verified: `Assertion[i].Subject == Assertion[i+1].Issuer`.
- The first assertion must be signed by a key in the receiver's `TrustedRootPublicKeys` list.

### 3. Portable Authority Token (PAT)
A self-contained bundle containing:
- The Agent's Identity.
- The Agent's Public Key.
- The Authority Graph Proof.
- A signature from the Agent over their own identity payload.

## Cross-System Verification Flow

1. **Assertion Issuance**: Internal systems (HR, Org Chart, Delegation Engine) issue signed assertions as changes occur.
2. **Token Assembly**: When an agent needs to perform an action on an external system, it bundles the relevant assertions into a PAT.
3. **Verification**: The target system:
    - Verifies the Agent Identity signature using the provided Public Key.
    - Verifies each Assertion signature.
    - Validates the Chain of Trust starting from a known Root Public Key.
    - Validates that the chain terminates at the Presenting Agent ID.

## Security Features

- **Portability**: Tokens can be passed across tools, clouds, and APIs without requiring direct database access to the identity source.
- **Inconsistent Enforcement Prevention**: By packaging the *proof* of authority with the request, the receiving system doesn't rely on potentially stale local caches of the authority graph.
- **Cryptographic Integrity**: SHA256 with RSA/ECDSA ensures assertions cannot be forged.
- **Expiration & Nonces**: Prevents replay attacks and ensures assertions have a limited lifespan.

## Implementation Details

- **Types**: See `src/VerificationProtocolTypes.ts`
- **Logic**: See `src/AuthorityVerificationProtocol.ts`
- **Demo**: Run `npx ts-node src/demo_protocol.ts`

# Identity System

A TypeScript framework for managing autonomous agent identity, authority, and governance. It provides cryptographic identity verification, hierarchical authority modeling, delegation control, action validation, approval routing, and full audit tracing -- designed so that every agent action can be verified against a structured authority graph before execution.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Modules](#modules)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [License](#license)

## Overview

The Identity System answers a core question for autonomous agent deployments: **who is this agent, what is it allowed to do, and who approved it?**

It integrates with corporate identity infrastructure (SSO, RBAC, organizational directories) and builds a runtime authority graph for each agent. Actions are intercepted, validated against the graph, routed for approval when required, and logged with full decision traceability.

## Architecture

The system is composed of layered modules. Each layer builds on the one below it:

```
Identity Authority API (unified external interface)
        |
Security Enforcement Layer
        |
Approval Routing Engine
        |
Action Validation Engine
        |
Context Adaptation Engine
        |
Authority Graph Builder
        |
Delegation Control Module
        |
Organizational Graph Engine
        |
Identity Integration Layer
        |
Agent Identity Core (cryptographic foundation)
```

## Modules

### Agent Identity Core

Creates and manages cryptographically signed agent identities. Each identity contains ownership, organizational affiliation, authority scope, and operational context. Supports identity verification, key rotation, expiration, and revocation.

### Identity Integration Layer

Connects to corporate identity systems through pluggable adapters:

- **SSO Adapter** -- Fetches user profiles from single sign-on providers.
- **Directory Adapter** -- Resolves department structures and membership.
- **RBAC Adapter** -- Retrieves roles, role hierarchies, and permission scopes.

Produces a unified `IdentityClaimSet` that captures the agent's resolved roles, department lineage, and permission scopes from all configured providers.

### Authority Graph Builder

Constructs a per-agent authority graph from identity claims, organizational policies, role policies, department policies, and delegated permissions. The graph classifies every resource-action pair into one of three decisions:

- **can_execute** -- The agent may proceed without further approval.
- **requires_approval** -- The agent must obtain approval before proceeding.
- **prohibited** -- The agent is not allowed to perform the action.

### Organizational Graph Engine

Models the organizational structure as a directed graph of entities (people, agents, departments, roles) and relationships (reports_to, member_of, has_role, delegated_to, approves_for). Provides queries for reporting chains, department lineage, effective authority resolution, delegation validation, and cross-unit approval requirements.

### Delegation Control Module

Manages scoped, time-bound delegation of authority between agents. Features include:

- Scope boundary enforcement (resources, actions, constraints).
- Context restrictions (environments, regions, roles, departments).
- Chain depth limits to prevent unbounded re-delegation.
- TTL-based expiration with automatic lifecycle management.
- Full audit trail for every delegation event.

### Context Adaptation Engine

Dynamically modifies an agent's authority graph based on runtime context signals such as project assignments, compliance flags, regulatory jurisdictions, and emergency overrides. Produces a decision delta showing how the adapted graph differs from the baseline.

### Action Validation Engine

Intercepts proposed agent actions and validates them against the authority graph. Checks scope permissions, identifies required approvals, detects delegation-based authority, and evaluates environmental context alignment. Emits structured audit events for every validation decision.

### Approval Routing Engine

Routes actions that require approval through configurable multi-step workflows. Supports domain-based approval (security, compliance, finance, legal, data, infrastructure), sequential and parallel workflow modes, cross-department approver resolution, and custom workflow step definitions with configurable decision policies (unanimous, majority, any).

### Audit Trace Engine

Records every decision point across the system into correlated traces. Supports event querying by domain, actor, time range, and trace ID. Reconstructs full decision chains showing authority checks, delegation events, approval paths, and enforcement decisions. Validates compliance by checking for required audit domains within a trace.

### Authority Verification Protocol

Enables cross-system verification of agent identity and authority through:

- **Signed Authority Assertions** -- Cryptographically signed claims about an agent's authority.
- **Portable Authority Tokens** -- Self-contained bundles of identity, signature, and authority proof that can be verified by any system with the trusted root public keys.
- **Trust Chain Validation** -- Verifies that the assertion chain starts from a trusted root and terminates at the presenting agent.

### Security Enforcement Layer

The final gateway before action execution. Performs token verification, action validation, and anomaly detection. Detects and blocks:

- Unverified or expired identity tokens.
- Bypassed approval requirements.
- Unauthorized scope escalations.
- Context violations (e.g., production access without authorization).

### Identity Authority API

A unified external-facing API that exposes the full system to other services. Endpoints include:

- **verifyIdentity** -- Cryptographic integrity, expiration, and revocation checks.
- **retrieveAuthorityGraph** -- Fetches the full permission model for an agent.
- **validateAction** -- Validates a proposed action against the authority graph.
- **queryDelegationChain** -- Traces delegation chains and lists active delegations.
- **simulateApprovalRequirements** -- Predicts approval routes for hypothetical actions.
- **batchVerifyIdentities** -- Verifies multiple identities in a single call.

Every response includes a `StructuredAuthorityProof` and `CrossPlatformVerificationMetadata` for external audit and replay.

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm

### Installation

```bash
npm install
```

### Build

```bash
npx tsc
```

### Run Demos

```bash
npx ts-node src/demo.ts
npx ts-node src/demo_org_graph.ts
npx ts-node src/demo_validation.ts
npx ts-node src/demo_approval_routing.ts
npx ts-node src/demo_protocol.ts
npx ts-node src/demo_security_enforcement.ts
npx ts-node src/demo_identity_api.ts
```

## Usage

### Creating and Verifying an Agent Identity

```typescript
import { AgentIdentityCore } from './src/AgentIdentityCore';

const core = new AgentIdentityCore();

const { identity, keyPair } = core.createIdentity({
  ownerId: 'user_1',
  orgId: 'acme_corp',
  scope: { resources: ['*'], actions: ['read'] },
  context: { environment: 'production' }
});

const result = core.verifyIdentity(identity);
if (result.valid) {
  console.log('Identity verified');
}
```

### Building an Authority Graph

```typescript
import { AuthorityGraphBuilder } from './src/AuthorityGraphBuilder';
import { IdentityIntegrationLayer } from './src/IdentityIntegrationLayer';

const integrationLayer = new IdentityIntegrationLayer({ sso, directory, rbac });
const claims = await integrationLayer.synchronizeIdentityClaims('user_1');

const builder = new AuthorityGraphBuilder();
const graph = builder.build({
  identity: identity.payload,
  identityClaims: claims,
  organizationalGraph: { orgId: 'acme_corp', orgPolicies, rolePolicies }
});
```

### Validating an Action

```typescript
import { ActionValidationEngine } from './src/ActionValidationEngine';

const engine = new ActionValidationEngine({ orgGraph });
const result = engine.validateAction(
  {
    agentId: identity.payload.agentId,
    action: 'deploy',
    resource: 'service:payments',
    context: { environment: 'staging' }
  },
  graph
);

if (result.authorized) {
  console.log('Action is authorized');
} else {
  console.log('Violations:', result.violations);
}
```

## API Reference

All public types and classes are exported from `src/index.ts`. Key exports include:

| Export | Description |
|---|---|
| `AgentIdentityCore` | Identity creation, verification, rotation, and revocation |
| `IdentityIntegrationLayer` | SSO, directory, and RBAC integration |
| `AuthorityGraphBuilder` | Authority graph construction from policies and claims |
| `OrganizationalGraphEngine` | Organizational structure modeling and querying |
| `DelegationControlModule` | Scoped, time-bound delegation management |
| `ContextAdaptationEngine` | Runtime authority adaptation based on context signals |
| `ActionValidationEngine` | Action interception and authority validation |
| `ApprovalRoutingEngine` | Multi-step approval workflow routing |
| `AuditTraceEngine` | Decision tracing, compliance validation, and chain reconstruction |
| `AuthorityVerificationProtocol` | Cross-system authority verification with portable tokens |
| `SecurityEnforcementLayer` | Final-stage anomaly detection and action blocking |
| `IdentityAuthorityAPI` | Unified external API with structured proofs |

## Project Structure

```
identity_system/
  src/
    index.ts                          Main entry point and public exports
    types.ts                          Core identity type definitions
    crypto.ts                         Cryptographic utilities (sign, verify, key generation)
    AgentIdentityCore.ts              Agent identity lifecycle management
    IdentityIntegrationLayer.ts       Corporate identity system integration
    AuthorityGraphBuilder.ts          Authority graph construction
    orgGraphTypes.ts                  Organizational graph type definitions
    OrganizationalGraphEngine.ts      Organizational structure engine
    DelegationControlModule.ts        Delegation management
    ContextAdaptationEngine.ts        Runtime context adaptation
    ActionValidationEngine.ts         Action validation against authority graphs
    ActionValidationTypes.ts          Action and validation type definitions
    ApprovalRoutingEngine.ts          Approval workflow routing
    ApprovalRoutingTypes.ts           Approval routing type definitions
    AuditTraceEngine.ts               Audit tracing and compliance
    AuthorityVerificationProtocol.ts  Cross-system verification protocol
    VerificationProtocolTypes.ts      Verification protocol type definitions
    SecurityEnforcementLayer.ts       Security enforcement and anomaly detection
    IdentityAuthorityAPI.ts           Unified external API
    IdentityAuthorityAPITypes.ts      API request/response type definitions
    demo.ts                           Core identity demo
    demo_org_graph.ts                 Organizational graph demo
    demo_validation.ts                Action validation demo
    demo_approval_routing.ts          Approval routing demo
    demo_protocol.ts                  Verification protocol demo
    demo_security_enforcement.ts      Security enforcement demo
    demo_identity_api.ts              Full API demo
  package.json
  tsconfig.json
```

## License

ISC

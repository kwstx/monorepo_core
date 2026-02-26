export type UniqueCapability =
    | 'SANDBOXED_PREDICTIVE_SIMULATION'
    | 'POLICY_AS_CODE_GOVERNANCE'
    | 'ECONOMIC_AND_RISK_AWARE_APPROVAL'
    | 'MULTI_AGENT_WEIGHTED_CONSENSUS'
    | 'CRYPTOGRAPHIC_VERSIONING'
    | 'AUTOMATED_SAFE_ROLLBACK';

export interface CapabilityDefinition {
    capability: UniqueCapability;
    required: boolean;
    evidence: string;
}

export interface DefensibilityProfile {
    productCategory: string;
    combinationClaim: string;
    capabilityMatrix: CapabilityDefinition[];
    noSinglePlatformParityClaim: string;
    strategicDefensibility: readonly string[];
}

const REQUIRED_CAPABILITIES: readonly UniqueCapability[] = [
    'SANDBOXED_PREDICTIVE_SIMULATION',
    'POLICY_AS_CODE_GOVERNANCE',
    'ECONOMIC_AND_RISK_AWARE_APPROVAL',
    'MULTI_AGENT_WEIGHTED_CONSENSUS',
    'CRYPTOGRAPHIC_VERSIONING',
    'AUTOMATED_SAFE_ROLLBACK'
] as const;

export function createDefensibilityProfile(): DefensibilityProfile {
    return {
        productCategory: 'Self-Modifying Autonomous Agent Governance Runtime',
        combinationClaim:
            'The runtime requires six coordinated safeguards in one control loop rather than isolated controls.',
        capabilityMatrix: [
            {
                capability: 'SANDBOXED_PREDICTIVE_SIMULATION',
                required: true,
                evidence: 'Isolated simulation with pre-commit execution and telemetry.'
            },
            {
                capability: 'POLICY_AS_CODE_GOVERNANCE',
                required: true,
                evidence: 'Rule-based policy validation gates all proposals prior to execution.'
            },
            {
                capability: 'ECONOMIC_AND_RISK_AWARE_APPROVAL',
                required: true,
                evidence: 'Approval includes cost, ROI, budget utilization, and calibrated risk.'
            },
            {
                capability: 'MULTI_AGENT_WEIGHTED_CONSENSUS',
                required: true,
                evidence: 'Consensus weights agent votes by influence and approval quality.'
            },
            {
                capability: 'CRYPTOGRAPHIC_VERSIONING',
                required: true,
                evidence: 'Immutable version ledger with canonical payload hash and signatures.'
            },
            {
                capability: 'AUTOMATED_SAFE_ROLLBACK',
                required: true,
                evidence: 'Threshold-driven rollback preserving unrelated subsequent changes.'
            }
        ],
        noSinglePlatformParityClaim:
            'A deployment is non-parity by definition unless all six required capabilities are active in one end-to-end pipeline.',
        strategicDefensibility: [
            'Cross-domain coupling across safety, economics, and coordination controls.',
            'Cryptographic and policy auditability for governance-grade evidence.',
            'Feedback-calibrated approval and rollback loop that improves over time.'
        ]
    };
}

export function assertUniqueCapabilityCombination(
    capabilities: readonly UniqueCapability[]
): { unique: boolean; missing: UniqueCapability[] } {
    const active = new Set(capabilities);
    const missing = REQUIRED_CAPABILITIES.filter((capability) => !active.has(capability));

    return {
        unique: missing.length === 0,
        missing
    };
}


import { AgentCoordinationMessage } from './MessageSchema';

/**
 * Severity level for policy violations.
 */
export enum ViolationSeverity {
    REJECT = 'REJECT',   // Message must be rejected
    MODIFY = 'MODIFY',   // Message can be modified to become compliant
    ADVISE = 'ADVISE'    // Message is accepted but with a warning/advice
}

/**
 * Result of a policy validation check.
 */
export interface PolicyViolation {
    policyId: string;
    ruleId: string;
    severity: ViolationSeverity;
    message: string;
    suggestedValue?: any;
    path?: string; // JSON path to the violating field
}

/**
 * Business Rule definition for economic constraints.
 */
export interface EconomicRules {
    minRoi?: number;
    maxBudget?: number;
    allowedCurrencies?: string[];
    minSynergyScore?: number;
}

/**
 * Compliance standards for risk and durability.
 */
export interface ComplianceRules {
    maxRiskScore?: number;
    requiredDurability?: string[];
    prohibitedTaskKeywords?: string[];
}

/**
 * Internal governance and legal constraints.
 */
export interface GovernanceRules {
    approvedAgents?: string[];
    requiredMetadataFields?: string[];
    minMilestones?: number;
    maxScopeTasks?: number;
}

/**
 * Root policy object combining all rule types.
 */
export interface CoordinationPolicy {
    id: string;
    name: string;
    economic?: EconomicRules;
    compliance?: ComplianceRules;
    governance?: GovernanceRules;
}

/**
 * The output of the validator.
 */
export interface ValidationResponse {
    isValid: boolean;
    violations: PolicyViolation[];
    modifiedMessage?: AgentCoordinationMessage;
    timestamp: string;
}

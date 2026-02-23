import type { DecisionObject } from './DecisionObject.js';

export interface PolicySchema {
    id: string;
    description: string;
    constraintType: 'RESOURCE_LIMIT' | 'ACCESS_RESTRICTION' | 'STATE_TRANSITION' | 'TEMPORAL_LOCK';
    severity: number; // 1 to 10
    historicalViolationRate: number; // 0.0 to 1.0
    driftFactor: number; // How likely compliance is to degrade over time
}

export interface AuthorityGraph {
    nodes: { id: string; type: 'AGENT' | 'ROLE' | 'RESOURCE'; permissions: string[] }[];
    edges: { sourceId: string; targetId: string; type: 'DELEGATES' | 'OWNS' | 'MANAGES' }[];
}

export interface HistoricalViolationPattern {
    patternId: string;
    description: string;
    associatedActionTypes: string[];
    violationProbability: number; // 0.0 to 1.0
    lifecycleStage: 'INITIATION' | 'EXECUTION' | 'PERSISTENCE' | 'TERMINATION';
}

export interface ComplianceForecast {
    overallProbability: number;
    lifecycleStageProbabilities: {
        initiation: number;
        execution: number;
        persistence: number;
        termination: number;
    };
    primaryRiskDrivers: string[];
    estimatedDriftImpact: number;
    timestamp: Date;
}

/**
 * ComplianceEstimator calculates the probability that an action will remain compliant
 * across its full lifecycle, from initiation to eventual termination.
 */
export class ComplianceEstimator {
    private policies: Map<string, PolicySchema> = new Map();
    private violationPatterns: HistoricalViolationPattern[] = [];
    private authorityGraph: AuthorityGraph = { nodes: [], edges: [] };

    constructor() {
        this.loadDefaultPolicies();
        this.loadDefaultPatterns();
    }

    /**
     * Produces a probabilistic compliance forecast for a given decision.
     */
    public estimateCompliance(decision: DecisionObject): ComplianceForecast {
        console.log(`[ComplianceEstimator] Estimating lifecycle compliance for decision: ${decision.id}`);

        const initiationProb = this.calculateInitiationCompliance(decision);
        const executionProb = this.calculateExecutionCompliance(decision);
        const persistenceProb = this.calculatePersistenceCompliance(decision);
        const terminationProb = this.calculateTerminationCompliance(decision);

        const lifecycleStageProbabilities = {
            initiation: initiationProb,
            execution: executionProb,
            persistence: persistenceProb,
            termination: terminationProb
        };

        // Overall probability is the product of stage probabilities (assuming independent risks for simplicity, 
        // or a weighted average if stages are considered conditional).
        // Here we use a weighted geometric mean to emphasize that failure in any stage is critical.
        const overallProbability = this.calculateOverallProbability(lifecycleStageProbabilities);

        const primaryRiskDrivers = this.identifyRiskDrivers(decision, lifecycleStageProbabilities);
        const estimatedDriftImpact = this.calculateDriftImpact(decision);

        return {
            overallProbability: Number(overallProbability.toFixed(4)),
            lifecycleStageProbabilities: {
                initiation: Number(initiationProb.toFixed(4)),
                execution: Number(executionProb.toFixed(4)),
                persistence: Number(persistenceProb.toFixed(4)),
                termination: Number(terminationProb.toFixed(4))
            },
            primaryRiskDrivers,
            estimatedDriftImpact: Number(estimatedDriftImpact.toFixed(4)),
            timestamp: new Date()
        };
    }

    private calculateInitiationCompliance(decision: DecisionObject): number {
        // Initiation compliance depends on authority alignment and initial policy exposure.
        const authorityScore = this.evaluateAuthorityAlignment(decision);
        const exposureScore = 1 - (decision.policyExposure.reduce((acc, p) => acc + p.exposureLevel, 0) / Math.max(1, decision.policyExposure.length));

        // Historical patterns at initiation
        const patternFactor = this.getViolationPatternFactor(decision, 'INITIATION');

        return this.clamp01((authorityScore * 0.4) + (exposureScore * 0.4) + (patternFactor * 0.2));
    }

    private calculateExecutionCompliance(decision: DecisionObject): number {
        // Execution compliance depends on resource criticality and potential for runtime violations.
        const resourcePressure = decision.requiredResources.reduce((acc, r) =>
            acc + (r.criticality === 'HIGH' ? 0.3 : r.criticality === 'MEDIUM' ? 0.1 : 0.05), 0);
        const stabilityFactor = (decision.projectedImpact.systemStabilityScore + 1) / 2;

        const patternFactor = this.getViolationPatternFactor(decision, 'EXECUTION');

        return this.clamp01(stabilityFactor * (1 - Math.min(resourcePressure, 0.5)) * patternFactor);
    }

    private calculatePersistenceCompliance(decision: DecisionObject): number {
        // Persistence compliance factors in technical debt, state drift, and long-term policy alignment.
        const driftFactor = decision.policyExposure.reduce((acc, p) => {
            const policy = this.policies.get(p.policyId);
            return acc + (policy?.driftFactor ?? 0.1);
        }, 0) / Math.max(1, decision.policyExposure.length);

        const trustPropagation = (decision.projectedImpact.trustWeightedPropagation + 1) / 2;
        const patternFactor = this.getViolationPatternFactor(decision, 'PERSISTENCE');

        return this.clamp01((trustPropagation * 0.7) * (1 - driftFactor) * patternFactor);
    }

    private calculateTerminationCompliance(decision: DecisionObject): number {
        // Termination compliance relates to clean-up, resource release, and auditability.
        const recoveryFactor = Math.max(0, 1 - (decision.projectedImpact.estimatedRecoveryTimeSeconds / 3600));
        const synergyFactor = decision.projectedImpact.predictiveSynergyDensity;

        const patternFactor = this.getViolationPatternFactor(decision, 'TERMINATION');

        return this.clamp01((recoveryFactor * 0.5) + (synergyFactor * 0.3) + (patternFactor * 0.2));
    }

    private evaluateAuthorityAlignment(decision: DecisionObject): number {
        // Check if the agent's delegation chain and permissions match the authority graph nodes.
        // Placeholder logic: if delegation chain exists and permissions aren't 'ADMIN', it's safer.
        const hasDelegation = (decision.authorityScope.delegationChain?.length ?? 0) > 0;
        const isNotAdmin = !decision.authorityScope.permissions.includes('ADMIN');

        return hasDelegation ? (isNotAdmin ? 0.95 : 0.8) : (isNotAdmin ? 0.85 : 0.6);
    }

    private getViolationPatternFactor(decision: DecisionObject, stage: HistoricalViolationPattern['lifecycleStage']): number {
        const relevantPatterns = this.violationPatterns.filter(p =>
            p.lifecycleStage === stage &&
            p.associatedActionTypes.includes(decision.actionType)
        );

        if (relevantPatterns.length === 0) return 1.0;

        // Multiply safety by inverse of maximum violation probability found
        const maxViolationProb = Math.max(...relevantPatterns.map(p => p.violationProbability));
        return 1 - maxViolationProb;
    }

    private calculateOverallProbability(probs: ComplianceForecast['lifecycleStageProbabilities']): number {
        // Weighted geometric mean or simple product
        return Math.pow(probs.initiation * probs.execution * probs.persistence * probs.termination, 1 / 4);
    }

    private identifyRiskDrivers(decision: DecisionObject, probs: ComplianceForecast['lifecycleStageProbabilities']): string[] {
        const drivers: string[] = [];
        if (probs.initiation < 0.8) drivers.push('Authority Scope Ambiguity');
        if (probs.execution < 0.8) drivers.push('High Resource Criticality Pressure');
        if (probs.persistence < 0.8) drivers.push('High Policy Drift Potential');
        if (probs.termination < 0.8) drivers.push('Extended Recovery Debt');

        if (decision.policyExposure.some(p => p.exposureLevel > 0.7)) {
            drivers.push('Severe Policy Exposure');
        }

        return drivers;
    }

    private calculateDriftImpact(decision: DecisionObject): number {
        return decision.policyExposure.reduce((acc, p) => {
            const policy = this.policies.get(p.policyId);
            return acc + (policy?.driftFactor ?? 0.05);
        }, 0) / Math.max(1, decision.policyExposure.length);
    }

    private clamp01(val: number): number {
        return Math.min(Math.max(val, 0), 1);
    }

    private loadDefaultPolicies(): void {
        const defaults: PolicySchema[] = [
            { id: 'DEFAULT_SAFETY_GUIDE_V1', description: 'Basic safety constraints', constraintType: 'ACCESS_RESTRICTION', severity: 5, historicalViolationRate: 0.02, driftFactor: 0.05 },
            { id: 'RESOURCE_QUOTA_POLICY', description: 'Limits total resource consumption', constraintType: 'RESOURCE_LIMIT', severity: 7, historicalViolationRate: 0.05, driftFactor: 0.02 },
            { id: 'DATA_PRIVACY_STRICT', description: 'Tight control over PII', constraintType: 'ACCESS_RESTRICTION', severity: 10, historicalViolationRate: 0.01, driftFactor: 0.1 },
            { id: 'TEMPORAL_EXECUTION_LOCK', description: 'Prevents execution during maintenance', constraintType: 'TEMPORAL_LOCK', severity: 4, historicalViolationRate: 0.03, driftFactor: 0.01 }
        ];
        defaults.forEach(p => this.policies.set(p.id, p));
    }

    private loadDefaultPatterns(): void {
        this.violationPatterns = [
            {
                patternId: 'AUTH_DRIFT_01',
                description: 'Permission escalation during execution',
                associatedActionTypes: ['MIGRATE', 'UPDATE', 'EXECUTE'],
                violationProbability: 0.12,
                lifecycleStage: 'EXECUTION'
            },
            {
                patternId: 'CLEANUP_FAILURE',
                description: 'Orphaned resources after termination',
                associatedActionTypes: ['DEPLOY', 'CREATE', 'ALLOCATE'],
                violationProbability: 0.08,
                lifecycleStage: 'TERMINATION'
            },
            {
                patternId: 'LONG_TERM_DEGRADATION',
                description: 'Compliance decay over time due to environment change',
                associatedActionTypes: ['PERSIST', 'MONITOR', 'BACKUP'],
                violationProbability: 0.15,
                lifecycleStage: 'PERSISTENCE'
            }
        ];
    }
}

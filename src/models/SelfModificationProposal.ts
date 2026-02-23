export enum ProposalType {
    INCREMENTAL = 'INCREMENTAL',
    MAJOR = 'MAJOR'
}

export enum ProposalStatus {
    PROPOSED = 'PROPOSED',
    SIMULATING = 'SIMULATING',
    EVALUATING = 'EVALUATING',
    PENDING_CONSENSUS = 'PENDING_CONSENSUS',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    EXECUTED = 'EXECUTED',
    ROLLED_BACK = 'ROLLED_BACK'
}

export interface SimulationMetrics {
    downstreamEffects: number; // -1.0 to 1.0 (negative to positive impact)
    cooperationImpact: number; // -1.0 to 1.0
    vocationalOutcome: number; // -1.0 to 1.0
}

export interface SimulationResult {
    success: boolean;
    performanceDelta: number;
    resourceUsageDelta: number;
    stabilityScore: number;
    metrics: SimulationMetrics;
    logs: string[];
}

export interface EconomicConstraints {
    budgetLimit: number;
    estimatedCost: number;
    requiredMinROI: number;
    projectedROI: number;
}

export interface GovernanceMetadata {
    complianceProtocols: string[];
    strategicAlignmentScore: number; // 0.0 to 1.0
}

export interface ConsensusScore {
    totalAgents: number;
    approvals: number;
    abstentions: number;
    disapprovals: number;
    consensusReached: boolean;
}

export class SelfModificationProposal {
    id: string;
    type: ProposalType;
    status: ProposalStatus;
    proposedChange: string;
    targetModule: string;
    targetParameter?: string;
    expectedImpact: string;
    predictedRisk: number; // 0.0 to 1.0
    agentIdentity: string;
    timestamp: Date;

    // Detailed simulation results
    simulationResults?: SimulationResult;

    // Economic constraints & ROI
    economicConstraints: EconomicConstraints;

    // Governance metadata
    governanceMetadata: GovernanceMetadata;

    // Multi-agent consensus
    consensusScores?: ConsensusScore;

    constructor(data: {
        id: string;
        type: ProposalType;
        proposedChange: string;
        targetModule: string;
        targetParameter?: string;
        expectedImpact: string;
        predictedRisk: number;
        agentIdentity: string;
        economicConstraints: EconomicConstraints;
        governanceMetadata: GovernanceMetadata;
    }) {
        this.id = data.id;
        this.type = data.type;
        this.status = ProposalStatus.PROPOSED;
        this.proposedChange = data.proposedChange;
        this.targetModule = data.targetModule;
        this.targetParameter = data.targetParameter;
        this.expectedImpact = data.expectedImpact;
        this.predictedRisk = data.predictedRisk;
        this.agentIdentity = data.agentIdentity;
        this.timestamp = new Date();
        this.economicConstraints = data.economicConstraints;
        this.governanceMetadata = data.governanceMetadata;
    }

    public updateSimulationResults(results: SimulationResult) {
        this.simulationResults = results;
    }

    public updateConsensusScores(scores: ConsensusScore) {
        this.consensusScores = scores;
    }
}

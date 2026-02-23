import { SelfModificationProposal, ProposalType, ProposalStatus } from './models/SelfModificationProposal';

function demo() {
    console.log("--- Self-Improvement Governance: Proposal Demo ---\n");

    const incrementalProposal = new SelfModificationProposal({
        id: "PROP-001",
        type: ProposalType.INCREMENTAL,
        proposedChange: "Update learning rate from 0.001 to 0.0015 to accelerate convergence on task-specific heuristics.",
        targetModule: "OptimizerEngine",
        targetParameter: "learning_rate",
        expectedImpact: "Faster training completion (estimated 12% improvement) with negligible memory increase.",
        predictedRisk: 0.15,
        agentIdentity: "Agent-Alpha-01",
        economicConstraints: {
            budgetLimit: 500,
            estimatedCost: 50,
            requiredMinROI: 2.0,
            projectedROI: 4.5
        }
    });

    console.log("New Incremental Proposal Created:");
    console.log(JSON.stringify(incrementalProposal, null, 2));

    const majorUpdate = new SelfModificationProposal({
        id: "PROP-002",
        type: ProposalType.MAJOR,
        proposedChange: "Replace standard LSTM-based memory with a new Recursive Transformer Memory module for long-term context retention.",
        targetModule: "CognitiveArchitecture",
        expectedImpact: "Significant improvement in long-term reasoning capabilities and cross-session memory retrieval.",
        predictedRisk: 0.65,
        agentIdentity: "Agent-Delta-09",
        economicConstraints: {
            budgetLimit: 5000,
            estimatedCost: 1200,
            requiredMinROI: 3.5,
            projectedROI: 8.0
        }
    });

    console.log("\nNew Major Update Proposal Created:");
    console.log(JSON.stringify(majorUpdate, null, 2));

    // Simulate progress
    majorUpdate.updateSimulationResults({
        success: true,
        performanceDelta: 2.4,
        resourceUsageDelta: 0.45,
        stabilityScore: 0.88,
        logs: ["Sandbox initiated", "Kernel isolation active", "Recursive Transformer testing: PASS", "Memory leak test: PASS"]
    });

    majorUpdate.updateConsensusScores({
        totalAgents: 5,
        approvals: 4,
        abstentions: 1,
        disapprovals: 0,
        consensusReached: true
    });

    console.log("\nMajor Update After Simulation and Consensus:");
    console.log(JSON.stringify(majorUpdate, null, 2));
}

demo();

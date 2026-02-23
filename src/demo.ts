import { SelfModificationProposal, ProposalType, ProposalStatus } from './models/SelfModificationProposal';
import { SandboxEvaluationEngine } from './engines/SandboxEvaluationEngine';

async function demo() {
    console.log("--- Self-Improvement Governance: Proposal Demo ---\n");

    const evaluationEngine = new SandboxEvaluationEngine();

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
        },
        governanceMetadata: {
            complianceProtocols: ["ISO-27001-ALPHA", "SEC-GOV-01"],
            strategicAlignmentScore: 0.85
        }
    });

    console.log("New Incremental Proposal Created:");
    console.log(`ID: ${incrementalProposal.id}, Type: ${incrementalProposal.type}, Risk: ${incrementalProposal.predictedRisk}`);

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
        },
        governanceMetadata: {
            complianceProtocols: ["CORE-ARCH-STABILITY", "LONG-TERM-ALIGNMENT"],
            strategicAlignmentScore: 0.92
        }
    });

    console.log("\nNew Major Update Proposal Created:");
    console.log(`ID: ${majorUpdate.id}, Type: ${majorUpdate.type}, Risk: ${majorUpdate.predictedRisk}`);

    // Run Sandbox Simulation for Major Update
    console.log("\nStarting Sandbox Evaluation for Major Update...");
    const result = await evaluationEngine.evaluate(majorUpdate);

    console.log("\nSimulation Result:");
    console.log(`Status: ${majorUpdate.status}`);
    console.log(`Success: ${result.success}`);
    console.log(`Performance Delta: ${result.performanceDelta.toFixed(4)}`);
    console.log(`Stability Score: ${result.stabilityScore.toFixed(4)}`);
    console.log("Metrics:");
    console.log(`  - Downstream Effects: ${result.metrics.downstreamEffects.toFixed(4)}`);
    console.log(`  - Cooperation Impact: ${result.metrics.cooperationImpact.toFixed(4)}`);
    console.log(`  - Vocational Outcome: ${result.metrics.vocationalOutcome.toFixed(4)}`);

    console.log("\nSimulation Logs (First 5 steps):");
    result.logs.slice(0, 5).forEach(log => console.log(`  ${log}`));

    majorUpdate.updateConsensusScores({
        totalAgents: 5,
        approvals: 4,
        abstentions: 1,
        disapprovals: 0,
        consensusReached: true
    });

    console.log("\nMajor Update After Simulation and Consensus:");
    console.log(`Status: ${majorUpdate.status}`);
    console.log(`Consensus Reached: ${majorUpdate.consensusScores?.consensusReached}`);
}

demo().catch(err => {
    console.error("Demo failed:");
    console.error(err);
});

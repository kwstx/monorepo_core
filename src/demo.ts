import { SelfModificationProposal, ProposalType } from './models/SelfModificationProposal';
import { SandboxEvaluationEngine } from './engines/SandboxEvaluationEngine';
import { ProposalSubmissionEngine, SubmissionEnvelope, AgentIdentityRegistry, DigestProvider, SignatureVerifier } from './engines/ProposalSubmissionEngine';
import { ImpactAssessmentEngine } from './engines/ImpactAssessmentEngine';

// Mock implementations for the demo
class MockIdentityRegistry implements AgentIdentityRegistry {
    resolvePublicKey(agentIdentity: string): string | null {
        return `pub-key-${agentIdentity}`;
    }
}

class MockDigestProvider implements DigestProvider {
    computeDigest(payload: string): string {
        // Simple mock digest based on length
        return `digest-${payload.length}`;
    }
}

class MockSignatureVerifier implements SignatureVerifier {
    verify(input: { payload: string; signature: string; publicKey: string }): boolean {
        return true; // Always valid for demo
    }
}

async function demo() {
    console.log("--- Self-Improvement Governance: Impact Assessment Demo ---\n");

    const evaluationEngine = new SandboxEvaluationEngine();
    const assessmentEngine = new ImpactAssessmentEngine();
    const submissionEngine = new ProposalSubmissionEngine(
        new MockIdentityRegistry(),
        new MockDigestProvider(),
        new MockSignatureVerifier(),
        assessmentEngine
    );

    // 1. Create a safe incremental proposal
    const incrementalProposal = new SelfModificationProposal({
        id: "PROP-001",
        type: ProposalType.INCREMENTAL,
        proposedChange: "Optimize learning rate in OptimizerEngine.",
        targetModule: "OptimizerEngine",
        targetParameter: "learning_rate",
        expectedImpact: "Faster training completion.",
        predictedRisk: 0.15,
        agentIdentity: "Agent-Alpha-01",
        economicConstraints: {
            budgetLimit: 500,
            estimatedCost: 50,
            requiredMinROI: 2.0,
            projectedROI: 4.5
        },
        governanceMetadata: {
            complianceProtocols: ["SAFETY_BASELINE_V1", "AUDIT_LOGGING_V1"],
            strategicAlignmentScore: 0.85
        }
    });

    console.log(`[SUBMISSION] Submitting Proposal ${incrementalProposal.id}...`);
    // Mock envelope
    const envelope1: SubmissionEnvelope = {
        proposal: incrementalProposal,
        payloadDigest: `digest-${serializeForMock(incrementalProposal).length}`,
        signature: "sig-001"
    };

    submissionEngine.submit(envelope1);

    const assessment1 = incrementalProposal.impactAssessment!;
    console.log(`[ASSESSMENT] Impact Assessment for ${incrementalProposal.id}:`);
    console.log(`  - Risk Score: ${assessment1.riskScore.toFixed(2)}`);
    console.log(`  - Predicted Cost: $${assessment1.predictedEconomicCost.toFixed(2)}`);
    console.log(`  - ROI: ${(assessment1.projectedROI * 100).toFixed(1)}%`);
    console.log(`  - Synergy (Efficiency): ${assessment1.synergyMetrics.agentCollaborationEfficiency.toFixed(2)}`);
    console.log(`  - Recommendation: ${assessment1.recommendation}`);

    // 2. Create a high-risk major proposal that should be REJECTED
    const riskyProposal = new SelfModificationProposal({
        id: "PROP-002",
        type: ProposalType.MAJOR,
        proposedChange: "Bypass memory safety protocols for maximum speed.",
        targetModule: "KernelMemory",
        expectedImpact: "Extreme performance boost.",
        predictedRisk: 0.90, // VERY HIGH RISK
        agentIdentity: "Agent-Rogue-01",
        economicConstraints: {
            budgetLimit: 1000,
            estimatedCost: 200,
            requiredMinROI: 1.0,
            projectedROI: 2.5
        },
        governanceMetadata: {
            complianceProtocols: ["SAFETY_BASELINE_V1"],
            strategicAlignmentScore: 0.2
        }
    });

    console.log(`\n[SUBMISSION] Submitting Risky Proposal ${riskyProposal.id}...`);
    const envelope2: SubmissionEnvelope = {
        proposal: riskyProposal,
        payloadDigest: `digest-${serializeForMock(riskyProposal).length}`,
        signature: "sig-002"
    };

    submissionEngine.submit(envelope2);
    const assessment2 = riskyProposal.impactAssessment!;
    console.log(`[ASSESSMENT] Impact Assessment for ${riskyProposal.id}:`);
    console.log(`  - Risk Score: ${assessment2.riskScore.toFixed(2)}`);
    console.log(`  - Recommendation: ${assessment2.recommendation}`);

    // 3. Process the queue and see rejections
    console.log("\n[VALIDATION] Dequeuing and Validating Proposals...");

    let processed;
    while ((processed = submissionEngine.dequeueForEvaluation())) {
        console.log(`[VALIDATION] Proposal ${processed.proposalId} cleared for evaluation.`);

        // Simulate Sandbox Evaluation for cleared proposals
        console.log(`[SANDBOX] Running simulation for ${processed.proposalId}...`);
        const result = await evaluationEngine.evaluate(incrementalProposal); // Use actual proposal object in real case
        console.log(`[SANDBOX] Result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
    }

    const rejections = submissionEngine.getPolicyRejections();
    console.log(`\n[REJECTION] Detected ${rejections.length} policy rejections:`);
    rejections.forEach(r => {
        console.log(`  - Proposal ${r.proposalId} rejected at ${r.rejectedAt.toLocaleTimeString()}`);
        r.violations.forEach(v => console.log(`    [VIOLATION] [${v.domain}] ${v.message}`));
    });

    console.log("\n--- Demo Completed ---");
}

// Simple serializer to match expected mock digest
function serializeForMock(proposal: SelfModificationProposal): string {
    return JSON.stringify({
        id: proposal.id,
        type: proposal.type,
        status: proposal.status,
        proposedChange: proposal.proposedChange,
        targetModule: proposal.targetModule,
        targetParameter: proposal.targetParameter ?? null,
        expectedImpact: proposal.expectedImpact,
        predictedRisk: proposal.predictedRisk,
        agentIdentity: proposal.agentIdentity,
        timestamp: proposal.timestamp.toISOString(),
        simulationResults: proposal.simulationResults || null,
        economicConstraints: proposal.economicConstraints,
        governanceMetadata: proposal.governanceMetadata,
        consensusScores: proposal.consensusScores || null,
        impactAssessment: proposal.impactAssessment || null
    });
}

demo().catch(err => {
    console.error("Demo failed:");
    console.error(err);
});

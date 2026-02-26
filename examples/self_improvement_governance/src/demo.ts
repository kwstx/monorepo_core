import { SelfModificationProposal, ProposalType, ProposalStatus } from './models/SelfModificationProposal';
import { SandboxEvaluationEngine } from './engines/SandboxEvaluationEngine';
import { ProposalSubmissionEngine, SubmissionEnvelope, AgentIdentityRegistry, DigestProvider, SignatureVerifier } from './engines/ProposalSubmissionEngine';
import { ImpactAssessmentEngine } from './engines/ImpactAssessmentEngine';
import { ConsensusEngine, VotingAgent } from './engines/ConsensusEngine';
import { RsaSignatureProvider, VersionControlEngine } from './engines/VersionControlEngine';
import { RollbackEngine } from './engines/RollbackEngine';
import { SelfImprovementFeedbackLoop } from './engines/SelfImprovementFeedbackLoop';

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

class MockVotingAgent implements VotingAgent {
    constructor(
        public id: string,
        public weight: number,
        private decisionLogic: (p: SelfModificationProposal) => { approved: boolean; rationale: string }
    ) { }

    async evaluate(proposal: SelfModificationProposal) {
        const decision = this.decisionLogic(proposal);
        return {
            predictedImpact: 0.9,
            cooperationValue: 0.9,
            taskAlignment: 0.9,
            approved: decision.approved,
            rationale: decision.rationale
        };
    }
}

async function demo() {
    console.log("--- Self-Improvement Governance: Impact Assessment Demo ---\n");

    const evaluationEngine = new SandboxEvaluationEngine();
    const feedbackLoop = new SelfImprovementFeedbackLoop();
    const assessmentEngine = new ImpactAssessmentEngine(feedbackLoop);
    const submissionEngine = new ProposalSubmissionEngine(
        new MockIdentityRegistry(),
        new MockDigestProvider(),
        new MockSignatureVerifier(),
        assessmentEngine,
        undefined,
        feedbackLoop
    );

    const consensusEngine = new ConsensusEngine({ threshold: 0.5, requiredApprovals: 1 });
    const versionControlEngine = new VersionControlEngine(RsaSignatureProvider.generate('Governance-Signer-1'));
    const rollbackEngine = new RollbackEngine(versionControlEngine, undefined, feedbackLoop);

    const votingAgents: VotingAgent[] = [
        new MockVotingAgent("Agent-Observer-A", 1.0, (p) => ({
            approved: true,
            rationale: "Approved for demo."
        }))
    ];
    const proposalsById = new Map<string, SelfModificationProposal>();

    // 1. Create a safe incremental proposal
    const incrementalProposal = new SelfModificationProposal({
        id: "PROP-001",
        type: ProposalType.INCREMENTAL,
        proposedChange: "Optimize learning rate.",
        targetModule: "OptimizerEngine",
        expectedImpact: "Faster training.",
        predictedRisk: 0.01, // Minimal risk to ensure sandbox pass
        agentIdentity: "Agent-Alpha-01",
        economicConstraints: {
            budgetLimit: 5000,
            estimatedCost: 500,
            requiredMinROI: 0.1,
            projectedROI: 2.0
        },
        governanceMetadata: {
            complianceProtocols: ["SAFETY_BASELINE_V1", "AUDIT_LOGGING_V1"],
            strategicAlignmentScore: 0.9
        }
    });
    proposalsById.set(incrementalProposal.id, incrementalProposal);

    console.log(`[SUBMISSION] Submitting Proposal ${incrementalProposal.id}...`);
    submissionEngine.submit({
        proposal: incrementalProposal,
        payloadDigest: `digest-${serializeForMock(incrementalProposal).length}`,
        signature: "sig-001"
    });

    // 3. Process the queue
    console.log("\n[VALIDATION] Dequeuing and Validating Proposals...");

    let processed;
    while ((processed = submissionEngine.dequeueForEvaluation())) {
        console.log(`[VALIDATION] Proposal ${processed.proposalId} cleared for evaluation.`);
        console.log(
            `[PRIORITY] score=${processed.prioritization.priorityScore.toFixed(3)} tier=${processed.prioritization.computeAllocationPlan.tier}`
        );
        const targetProposal = proposalsById.get(processed.proposalId);
        if (!targetProposal) {
            continue;
        }
        const result = await evaluationEngine.evaluate(targetProposal, processed.prioritization.computeAllocationPlan);

        console.log(`[SANDBOX] Simulation Result success: ${result.success}`);
        if (result.success) {
            const consensus = await consensusEngine.collectConsensus(targetProposal, votingAgents);
            console.log(`[CONSENSUS] Reached: ${consensus.consensusReached}`);
            if (consensus.consensusReached) {
                targetProposal.status = ProposalStatus.EXECUTED;
                versionControlEngine.recordApprovedModification({
                    proposal: targetProposal,
                    createdBy: 'GovernanceController',
                    approvalReference: `approval-prop1`,
                    preExecutionMetrics: {
                        baselinePerformance: 1.0, baselineResourceUsage: 1.0, baselineStability: 1.0, observedAt: new Date()
                    },
                    sandboxOutcome: { ...result, evaluatedAt: new Date() },
                    consensusResult: { ...consensus, decidedAt: new Date() },
                    economicImpact: { approvedBudget: 5000, predictedEconomicCost: 1000, projectedROI: 1.2, expectedPaybackCycles: 3 }
                });
                console.log(`[GOVERNANCE] Proposal ${processed.proposalId} EXECUTED and VERSIONED.`);
            }
        }
    }

    // --- 4. Rollback Engine Demo ---
    console.log("\n--- 4. Rollback Engine Demo: Post-Execution Monitoring ---\n");

    const failingProposal = new SelfModificationProposal({
        id: "PROP-003",
        type: ProposalType.MAJOR,
        proposedChange: "Experimental JIT.",
        targetModule: "ExecutionEngine",
        expectedImpact: "Speed boost.",
        predictedRisk: 0.01,
        agentIdentity: "Agent-Beta-02",
        economicConstraints: {
            budgetLimit: 20000,
            estimatedCost: 2000,
            requiredMinROI: 0.1,
            projectedROI: 3.0
        },
        governanceMetadata: {
            complianceProtocols: ["SAFETY_BASELINE_V1", "AUDIT_LOGGING_V1"],
            strategicAlignmentScore: 0.8
        }
    });
    proposalsById.set(failingProposal.id, failingProposal);

    console.log(`[SUBMISSION] Submitting Proposal ${failingProposal.id}...`);
    submissionEngine.submit({
        proposal: failingProposal,
        payloadDigest: `digest-${serializeForMock(failingProposal).length}`,
        signature: "sig-003"
    });

    const entry = submissionEngine.dequeueForEvaluation();
    if (entry) {
        console.log(`[VALIDATION] Proposal ${entry.proposalId} cleared for evaluation.`);
        console.log(
            `[PRIORITY] score=${entry.prioritization.priorityScore.toFixed(3)} tier=${entry.prioritization.computeAllocationPlan.tier}`
        );
        const targetProposal = proposalsById.get(entry.proposalId);
        if (!targetProposal) {
            return;
        }
        const simResult = await evaluationEngine.evaluate(targetProposal, entry.prioritization.computeAllocationPlan);
        console.log(`[SANDBOX] Simulation Result success: ${simResult.success}`);

        if (simResult.success) {
            const consensus = await consensusEngine.collectConsensus(failingProposal, votingAgents);
            if (consensus.consensusReached) {
                failingProposal.status = ProposalStatus.EXECUTED;
                versionControlEngine.recordApprovedModification({
                    proposal: failingProposal,
                    createdBy: 'GovernanceController',
                    approvalReference: `approval-prop3`,
                    preExecutionMetrics: {
                        baselinePerformance: 1.0, baselineResourceUsage: 1.0, baselineStability: 1.0, observedAt: new Date()
                    },
                    sandboxOutcome: { ...simResult, evaluatedAt: new Date() },
                    consensusResult: { ...consensus, decidedAt: new Date() },
                    economicImpact: { approvedBudget: 20000, predictedEconomicCost: 5000, projectedROI: 1.6, expectedPaybackCycles: 5 }
                });
                console.log(`[GOVERNANCE] Proposal ${failingProposal.id} EXECUTED.`);

                const badMetrics = {
                    riskScore: 0.9, // TRIPPED
                    roi: -0.5,      // TRIPPED
                    cooperativeImpact: -0.8, // TRIPPED
                    evaluatedAt: new Date()
                };

                console.log(`[ROLLBACK-ENGINE] Evaluating ${failingProposal.id}...`);
                const outcome = await rollbackEngine.evaluate(failingProposal, badMetrics);

                if (outcome.rollbackInitiated) {
                    console.log(`[ROLLBACK-ENGINE] ROLLBACK TRIGGERED for ${failingProposal.id}!`);
                    console.log(`  - Reason: ${outcome.reason}`);
                    console.log(`  - New Log Entry: ${outcome.rollbackPlan?.rollbackRecord.versionId}`);
                }
            }
        }
    }

    const finalAudit = versionControlEngine.queryVersions();
    console.log(`\n[FINAL-AUDIT] Total version records: ${finalAudit.length}`);
    finalAudit.forEach((record) => {
        const rollbackMark = record.rollbackOfVersionId ? ` <-- ROLLBACK RECORD for ${record.rollbackOfVersionId}` : '';
        console.log(`  - ${record.versionId} [Proposal: ${record.proposalId}]${rollbackMark}`);
    });

    console.log("\n--- Demo Completed ---");
}

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
    console.error("Demo failed:", err);
});

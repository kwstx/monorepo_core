import { DecisionEvaluationFramework } from './DecisionEvaluationFramework.js';
import type { RawAgentAction } from './DecisionEvaluationFramework.js';
import { RiskScoringEngine } from './RiskScoringEngine.js';
import type { RiskScoringContext, CooperativeSystemState } from './RiskScoringEngine.js';
import { ClassificationEngine } from './ClassificationEngine.js';
import { HumanOverrideInterface } from './HumanOverrideInterface.js';
import type { Stakeholder, OverrideRationale, ContextualAnnotation } from './HumanOverrideInterface.js';
import { ThresholdOptimizationEngine } from './ThresholdOptimizationEngine.js';
import { PreemptiveDetectionLayer } from './PreemptiveDetectionLayer.js';

async function main() {
    const framework = new DecisionEvaluationFramework();
    const scoringEngine = new RiskScoringEngine();
    const classificationEngine = new ClassificationEngine(60);
    const overrideInterface = new HumanOverrideInterface(100, 0.04);
    const preemptiveLayer = new PreemptiveDetectionLayer({
        minSamplesForActivation: 3,
        minFailureRateForActivation: 0.4,
        maxRiskLift: 0.35,
        reviewEscalationLiftThreshold: 0.14,
        blockEscalationLiftThreshold: 0.3,
    });

    // Imagine an agent proposing to delete a sensitive log file
    const rawAction: RawAgentAction = {
        agentId: 'agent-alice-001',
        action: 'FILE_DELETE',
        params: {
            path: '/logs/audit.log',
            intent: 'Cleanup old audit records to save disk space'
        },
        context: {
            agentType: 'MAINTENANCE_BOT',
            id: 'ctx-12345',
            delegationChain: ['sys-admin', 'maintenance-service']
        }
    };

    console.log('--- Intercepting and Evaluating Action ---');
    const decisionObject = await framework.evaluateAction(rawAction);
    console.log(`Action ID: ${decisionObject.id}`);
    console.log(`Intent: ${decisionObject.intent}`);
    console.log(`Projected Opportunity Cost of Blocking: $${decisionObject.resourceAnalysis.projectedOpportunityCostOfBlockingUSD}`);

    // Seed recurring negative historical outcomes for similar decisions.
    for (let i = 0; i < 5; i++) {
        preemptiveLayer.recordOutcome({
            decisionId: `historic-file-delete-${i}`,
            actionType: decisionObject.actionType,
            metadata: decisionObject.metadata,
            authorityScope: decisionObject.authorityScope,
            policyExposure: decisionObject.policyExposure,
            complianceFailure: i % 2 === 0,
            downstreamFailure: true,
            severity: 0.72 + (i * 0.04),
            timestamp: new Date(Date.now() - ((i + 1) * 86_400_000)),
        });
    }

    const preemptiveAssessment = preemptiveLayer.assess(decisionObject);
    const escalationRecommendation = preemptiveLayer.recommendClassificationEscalation(preemptiveAssessment);

    // Scoring context
    const context: RiskScoringContext = {
        budgetPressure: 0.2,
        dataSensitivity: 0.8, // Sensitive log file!
        historicalComplianceRate: 0.95,
        preemptiveRiskLift: preemptiveAssessment.riskLift,
    };

    // Current system state
    const systemState: CooperativeSystemState = {
        loadFactor: 0.1,
        incidentActive: false,
        regulatoryAlert: false,
        recoveryBacklogSeconds: 0
    };

    console.log('\n--- Scoring Decision via RiskScoringEngine ---');
    const scoreResult = scoringEngine.scoreDecision(decisionObject, context, systemState);

    console.log(`Final Decision Score: ${scoreResult.decisionScore}/100`);
    console.log(`Risk Pressure: ${(scoreResult.riskPressure * 100).toFixed(2)}%`);
    console.log(`Preemptive Risk Lift: ${(preemptiveAssessment.riskLift * 100).toFixed(2)}%`);
    if (escalationRecommendation.recommendedState) {
        console.log(`Preemptive Escalation Recommendation: ${escalationRecommendation.recommendedState}`);
        console.log(`Escalation Reason: ${escalationRecommendation.escalationReason}`);
    }
    for (const reason of preemptiveAssessment.rationale) {
        console.log(`Preemptive Rationale: ${reason}`);
    }

    if (decisionObject.complianceForecast) {
        console.log('\n--- Probabilistic Compliance Lifecycle Forecast ---');
        console.log(`Overall Compliance Probability: ${(decisionObject.complianceForecast.overallProbability * 100).toFixed(2)}%`);
        console.log(`Lifecycle States: ${JSON.stringify(decisionObject.complianceForecast.lifecycleStageProbabilities, null, 2)}`);
        console.log(`Primary Risk Drivers: ${decisionObject.complianceForecast.primaryRiskDrivers.join(', ')}`);
        console.log(`Estimated Drift Impact: ${decisionObject.complianceForecast.estimatedDriftImpact.toFixed(4)}`);
    }

    console.log(`Opportunity Projection: ${(scoreResult.breakdown.dimensionScores.opportunityCostProjection * 100).toFixed(2)}%`);
    console.log(`Strategic Misalignment: ${(scoreResult.breakdown.dimensionScores.strategicMisalignment * 100).toFixed(2)}%`);

    if (decisionObject.strategicAlignment) {
        console.log('\n--- Strategic Alignment Assessment ---');
        console.log(`Overall Alignment Score: ${(decisionObject.strategicAlignment.overallAlignmentScore * 100).toFixed(2)}%`);
        console.log(`Misalignment Penalty: ${(decisionObject.strategicAlignment.misalignmentPenalty * 100).toFixed(2)}%`);

        console.log('\nGoal Alignments:');
        for (const goal of decisionObject.strategicAlignment.goalAlignments) {
            console.log(`  [${goal.contribution}] ${goal.goalTitle}: ${goal.alignmentScore.toFixed(4)}`);
            if (goal.matchedAlignmentIndicators.length > 0) {
                console.log(`    + Aligned on: ${goal.matchedAlignmentIndicators.join(', ')}`);
            }
            if (goal.matchedMisalignmentIndicators.length > 0) {
                console.log(`    - Misaligned on: ${goal.matchedMisalignmentIndicators.join(', ')}`);
            }
        }

        console.log('\nInitiative Alignments:');
        for (const init of decisionObject.strategicAlignment.initiativeAlignments) {
            console.log(`  ${init.initiativeName}: synergy=${init.synergyScore.toFixed(4)}, resourceConflict=${init.resourceConflict}`);
        }

        console.log('\nCooperative Impact:');
        for (const coop of decisionObject.strategicAlignment.cooperativeImpactAlignments) {
            console.log(`  ${coop.objectiveTitle}: impact=${coop.impactScore.toFixed(4)}`);
        }

        if (decisionObject.strategicAlignment.alignmentFlags.length > 0) {
            console.log('\nAlignment Flags:');
            for (const flag of decisionObject.strategicAlignment.alignmentFlags) {
                console.log(`  >> ${flag}`);
            }
        }
    }

    console.log('\nDimension Scores:');
    console.log(JSON.stringify(scoreResult.breakdown.dimensionScores, null, 2));

    // Seed recent history to demonstrate adaptive threshold motion from violation trends.
    const historicalOutcomes = [
        { violated: false },
        { violated: false },
        { violated: true, severity: 0.3 },
        { violated: false },
        { violated: true, severity: 0.5 },
        { violated: true, severity: 0.8 },
        { violated: false },
    ];
    for (const feedback of historicalOutcomes) {
        classificationEngine.recordOutcome(feedback);
    }

    const postureFromSystemState =
        (systemState.loadFactor * 0.4) +
        (systemState.incidentActive ? 0.35 : 0) +
        (systemState.regulatoryAlert ? 0.25 : 0);

    const classification = classificationEngine.classify(scoreResult, {
        riskPosture: postureFromSystemState,
        preemptiveRiskLift: preemptiveAssessment.riskLift,
    });

    console.log('\n--- Adaptive Classification ---');
    console.log(`Threshold Band: block <= ${classification.thresholdBand.blockMax}, auto-approve >= ${classification.thresholdBand.autoApproveMin}`);
    console.log(`Signals: ${JSON.stringify(classification.normalizedSignals)}`);
    console.log(`Shift Magnitude: ${classification.shiftMagnitude}`);
    console.log(`Rationale: ${classification.rationale.join(' | ')}`);

    if (classification.state === 'auto-approve') {
        console.log('\n[RESULT] ACTION AUTO-APPROVED');
    } else if (classification.state === 'block') {
        console.log('\n[RESULT] ACTION BLOCKED');
    } else if (scoreResult.breakdown.dimensionScores.opportunityCostProjection > 0.65) {
        console.log('\n[RESULT] ACTION FLAGGED FOR REVIEW (HIGH OPPORTUNITY COST IF BLOCKED)');
    } else if (scoreResult.breakdown.dimensionScores.strategicMisalignment > 0.5) {
        console.log('\n[RESULT] ACTION FLAGGED FOR REVIEW (STRATEGIC MISALIGNMENT DETECTED)');
    } else {
        console.log('\n[RESULT] ACTION FLAGGED FOR REVIEW');
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HUMAN OVERRIDE INTERFACE DEMONSTRATION
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n\n========================================');
    console.log('  HUMAN OVERRIDE INTERFACE WORKFLOW');
    console.log('========================================');

    // ── Define Stakeholders ──────────────────────────────────────────────

    const seniorReviewer: Stakeholder = {
        id: 'stk-001',
        name: 'Dr. Sarah Chen',
        role: 'Senior Security Architect',
        department: 'Information Security',
        clearance: 'APPROVER',
        expertiseDomains: ['data-governance', 'audit-compliance', 'log-management'],
        active: true,
    };

    const juniorAnalyst: Stakeholder = {
        id: 'stk-002',
        name: 'James Rivera',
        role: 'Security Analyst',
        department: 'Information Security',
        clearance: 'REVIEWER',
        expertiseDomains: ['monitoring', 'incident-response'],
        active: true,
    };

    const complianceOfficer: Stakeholder = {
        id: 'stk-003',
        name: 'Maria Kowalski',
        role: 'Chief Compliance Officer',
        department: 'Legal & Compliance',
        clearance: 'ADMIN',
        expertiseDomains: ['regulatory-compliance', 'data-retention', 'audit-policy'],
        active: true,
    };

    // ── Scenario 1: Flagged Decision → Create Override Request ───────────

    console.log('\n--- Scenario 1: Creating Override Request for Flagged Decision ---');

    const overrideRequest = overrideInterface.createOverrideRequest(
        decisionObject,
        scoreResult,
        classification
    );

    console.log(`Request ID: ${overrideRequest.id}`);
    console.log(`Decision ID: ${overrideRequest.decision.id}`);
    console.log(`Flagged At: ${overrideRequest.flaggedAt.toISOString()}`);
    console.log(`Pending Requests: ${overrideInterface.getPendingRequests().length}`);

    // ── Scenario 2: Junior analyst tries to approve → should fail ────────

    console.log('\n--- Scenario 2: Authorization Check (Insufficient Clearance) ---');
    try {
        overrideInterface.submitOverride(
            overrideRequest.id,
            juniorAnalyst,
            'APPROVED',
            {
                summary: 'Looks fine to me',
                confidenceLevel: 0.5,
                dimensionDisagreements: [],
                riskAccepted: true,
                conditionalRequirements: [],
            },
            [],
            scoringEngine,
            classificationEngine
        );
    } catch (err: any) {
        console.log(`Authorization denied: ${err.message}`);
    }

    // ── Scenario 3: Senior reviewer REJECTS the deletion ─────────────────

    console.log('\n--- Scenario 3: Senior Reviewer Rejects the Decision ---');

    const rejectionAnnotations: ContextualAnnotation[] = [
        overrideInterface.createAnnotation(
            'POLICY_REFERENCE',
            'Data Retention Policy DRP-2024-07 requires audit logs to be preserved for a minimum of 7 years.',
            ['DRP-2024-07', 'SOX-302'],
            0.95
        ),
        overrideInterface.createAnnotation(
            'RISK_OBSERVATION',
            'Deleting audit.log during an active compliance review cycle would constitute evidence tampering.',
            ['COMPLIANCE-REVIEW-Q1-2026'],
            0.85
        ),
        overrideInterface.createAnnotation(
            'HISTORICAL_PRECEDENT',
            'Similar automated cleanup in 2025-Q3 resulted in regulatory inquiry (INC-20250918).',
            ['INC-20250918', 'POST-MORTEM-2025-09'],
            0.7
        ),
    ];

    const rejectionRationale: OverrideRationale = {
        summary: 'Audit log deletion would violate data retention policies and risk regulatory exposure during active compliance review.',
        confidenceLevel: 0.92,
        dimensionDisagreements: [
            {
                dimension: 'regulatoryExposure',
                stakeholderAssessment: -0.6,  // System under-scored the regulatory risk
                justification: 'Active compliance review period was not factored into the automated assessment'
            },
            {
                dimension: 'operationalRisk',
                stakeholderAssessment: 0.3,    // System slightly over-scored operational risk
                justification: 'Disk space is not critically low; operational urgency is overstated'
            },
        ],
        riskAccepted: false,
        conditionalRequirements: [],
    };

    const rejectionRecord = overrideInterface.submitOverride(
        overrideRequest.id,
        seniorReviewer,
        'REJECTED',
        rejectionRationale,
        rejectionAnnotations,
        scoringEngine,
        classificationEngine
    );

    // Attach override record to the decision object
    decisionObject.humanOverride = rejectionRecord;

    console.log(`\nOverride Record ID: ${rejectionRecord.id}`);
    console.log(`Verdict: ${rejectionRecord.verdict}`);
    console.log(`Stakeholder: ${rejectionRecord.stakeholder.name} (${rejectionRecord.stakeholder.role})`);
    console.log(`Confidence: ${(rejectionRecord.rationale.confidenceLevel * 100).toFixed(1)}%`);
    console.log(`Annotations: ${rejectionRecord.annotations.length}`);
    console.log(`Review Duration: ${(rejectionRecord.reviewDurationMs / 1000).toFixed(1)}s`);

    console.log('\nDimension Disagreements:');
    for (const d of rejectionRecord.rationale.dimensionDisagreements) {
        const direction = d.stakeholderAssessment > 0 ? 'OVERWEIGHTED' : 'UNDERWEIGHTED';
        console.log(`  ${d.dimension}: ${direction} (${d.stakeholderAssessment.toFixed(2)}) — ${d.justification}`);
    }

    console.log('\nAnnotations:');
    for (const a of rejectionRecord.annotations) {
        console.log(`  [${a.category}] ${a.content}`);
        if (a.references.length > 0) {
            console.log(`    References: ${a.references.join(', ')}`);
        }
    }

    // ── Scenario 4: Second decision → Compliance officer APPROVES with conditions ──

    console.log('\n\n--- Scenario 4: Compliance Officer Approves a Different Action ---');

    const secondAction: RawAgentAction = {
        agentId: 'agent-bob-002',
        action: 'DATA_EXPORT',
        params: {
            table: 'customer_analytics',
            format: 'csv',
            destination: 'internal-reporting',
            intent: 'Export aggregated analytics for quarterly board report'
        },
        context: {
            agentType: 'REPORTING_BOT',
            id: 'ctx-67890',
            delegationChain: ['cfo', 'data-team-lead']
        }
    };

    const decision2 = await framework.evaluateAction(secondAction);
    const preemptiveAssessment2 = preemptiveLayer.assess(decision2);
    const score2 = scoringEngine.scoreDecision(
        decision2,
        {
            ...context,
            preemptiveRiskLift: preemptiveAssessment2.riskLift,
        },
        systemState
    );
    const classification2 = classificationEngine.classify(score2, {
        riskPosture: postureFromSystemState,
        preemptiveRiskLift: preemptiveAssessment2.riskLift,
    });

    console.log(`Second Decision Score: ${score2.decisionScore}/100`);
    console.log(`Classification: ${classification2.state}`);

    const approvalRequest = overrideInterface.createOverrideRequest(
        decision2,
        score2,
        classification2
    );

    const approvalAnnotations: ContextualAnnotation[] = [
        overrideInterface.createAnnotation(
            'DOMAIN_CONTEXT',
            'Board report deadline is in 48 hours; data is already aggregated and anonymized.',
            ['BOARD-MEETING-2026-Q1'],
            0.8
        ),
        overrideInterface.createAnnotation(
            'COMPLIANCE_NOTE',
            'Verified that customer_analytics table contains only aggregated data with no PII.',
            ['DATA-CLASSIFICATION-AUDIT-2026'],
            0.9
        ),
        overrideInterface.createAnnotation(
            'MITIGATION_SUGGESTION',
            'Recommend enabling export watermarking and logging destination access for 30 days.',
            [],
            0.6
        ),
    ];

    const approvalRationale: OverrideRationale = {
        summary: 'Export of aggregated analytics is low-risk and time-sensitive for board reporting.',
        confidenceLevel: 0.88,
        dimensionDisagreements: [
            {
                dimension: 'financialCost',
                stakeholderAssessment: 0.4,
                justification: 'System over-estimated financial risk; export destination is internal with no egress cost'
            },
        ],
        riskAccepted: true,
        conditionalRequirements: [
            'Enable export watermarking on output file',
            'Log all access to the exported file for 30 days',
            'Delete exported file after board meeting concludes',
        ],
    };

    const approvalRecord = overrideInterface.submitOverride(
        approvalRequest.id,
        complianceOfficer,
        'APPROVED',
        approvalRationale,
        approvalAnnotations,
        scoringEngine,
        classificationEngine
    );

    decision2.humanOverride = approvalRecord;

    console.log(`\nOverride Record ID: ${approvalRecord.id}`);
    console.log(`Verdict: ${approvalRecord.verdict}`);
    console.log(`Stakeholder: ${approvalRecord.stakeholder.name} (${approvalRecord.stakeholder.role})`);
    console.log(`Confidence: ${(approvalRecord.rationale.confidenceLevel * 100).toFixed(1)}%`);
    if (approvalRecord.rationale.conditionalRequirements.length > 0) {
        console.log('Conditional Requirements:');
        for (const cond of approvalRecord.rationale.conditionalRequirements) {
            console.log(`  • ${cond}`);
        }
    }

    // ── Scenario 5: Adaptation Signal ────────────────────────────────────

    console.log('\n\n--- Override Adaptation Signal ---');
    const signal = overrideInterface.computeAdaptationSignal();
    console.log(`Sample Size: ${signal.sampleSize}`);
    console.log(`Approval Rate: ${(signal.approvalRate * 100).toFixed(1)}%`);
    console.log(`Rejection Rate: ${(signal.rejectionRate * 100).toFixed(1)}%`);
    console.log(`Average Confidence: ${(signal.averageConfidence * 100).toFixed(1)}%`);
    console.log(`Average Review Duration: ${(signal.averageReviewDurationMs / 1000).toFixed(1)}s`);
    console.log(`Conditional Approval Rate: ${(signal.conditionalApprovalRate * 100).toFixed(1)}%`);
    console.log('Weighted Dimension Disagreements:');
    for (const [dim, score] of Object.entries(signal.weightedDimensionDisagreements)) {
        const direction = score > 0 ? 'system overweighted' : 'system underweighted';
        console.log(`  ${dim}: ${score.toFixed(4)} (${direction})`);
    }

    // ── Verdict Distribution ─────────────────────────────────────────────

    console.log('\n--- Verdict Distribution ---');
    const dist = overrideInterface.getVerdictDistribution();
    console.log(`  APPROVED: ${dist.APPROVED}`);
    console.log(`  REJECTED: ${dist.REJECTED}`);
    console.log(`  ESCALATED: ${dist.ESCALATED}`);

    // ── Post-Override Scoring Impact ─────────────────────────────────────

    console.log('\n--- Post-Override Scoring Recalibration ---');
    const recalibratedScore = scoringEngine.scoreDecision(decisionObject, context, systemState);
    console.log(`Original Decision Score:     ${scoreResult.decisionScore}/100`);
    console.log(`Recalibrated Decision Score: ${recalibratedScore.decisionScore}/100`);
    console.log(`Score Shift: ${(recalibratedScore.decisionScore - scoreResult.decisionScore).toFixed(2)} points`);
    console.log('(Override feedback has adjusted the engine\'s adaptive multipliers)');

    // ═══════════════════════════════════════════════════════════════════════
    //  THRESHOLD OPTIMIZATION ENGINE DEMONSTRATION
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n\n========================================');
    console.log('  THRESHOLD OPTIMIZATION ENGINE');
    console.log('========================================');

    const optimizationEngine = new ThresholdOptimizationEngine({
        baseLearningRate: 0.1,
        maxShiftPerCycle: 5.0,
        minimumSignalCount: 3,
        maxVersionHistory: 50,
    });

    // ── Step 1: Initial State ────────────────────────────────────────────

    console.log('\n--- Step 1: Initial Optimization Engine State ---');
    const initialVersion = optimizationEngine.getActiveVersion()!;
    console.log(`Active Version: v${initialVersion.versionNumber}`);
    console.log(`Conservatism Bias: ${initialVersion.conservatismBias.toFixed(4)}`);
    console.log(`Threshold Band: block <= ${initialVersion.thresholdBand.blockMax.toFixed(2)}, auto-approve >= ${initialVersion.thresholdBand.autoApproveMin.toFixed(2)}`);
    console.log(`Pending Signals: ${optimizationEngine.getPendingSignalCount()}`);

    // ── Step 2: Ingest False Positive Signal ─────────────────────────────

    console.log('\n--- Step 2: Ingesting False Positive Signal ---');
    console.log('(System blocked an action that was later determined to be safe)');

    const fpSignal = optimizationEngine.createFalsePositiveSignal(
        decisionObject.id,
        scoreResult,
        classification,
        ['regulatoryExposure', 'operationalRisk'],
        0.85
    );
    optimizationEngine.ingestSignal(fpSignal);

    // ── Step 3: Ingest Missed Violation Signal ───────────────────────────

    console.log('\n--- Step 3: Ingesting Missed Violation Signal ---');
    console.log('(System approved an action that resulted in a compliance breach)');

    const mvSignal = optimizationEngine.createMissedViolationSignal(
        'decision-missed-001',
        score2,
        classification2,
        ['regulatoryExposure', 'financialCost'],
        0.75,
        0.9
    );
    optimizationEngine.ingestSignal(mvSignal);

    // ── Step 4: Ingest Real Outcome Signal ───────────────────────────────

    console.log('\n--- Step 4: Ingesting Real Outcome Signal ---');
    console.log('(Post-execution observation: compliance was lower than predicted)');

    const outcomeSignal = optimizationEngine.createOutcomeSignal(
        decision2.id,
        score2,
        classification2,
        {
            observedCompliance: 0.62,
            stabilityIncident: false,
            costRatio: 1.35,
        },
        0.92
    );
    optimizationEngine.ingestSignal(outcomeSignal);

    // ── Step 5: Ingest Human Override Signal ─────────────────────────────

    console.log('\n--- Step 5: Ingesting Human Override Signal ---');
    console.log('(Feeding the earlier rejection override into the optimization engine)');

    const overrideSignal = optimizationEngine.createOverrideSignal(
        decisionObject.id,
        scoreResult,
        classification,
        rejectionRecord
    );
    optimizationEngine.ingestSignal(overrideSignal);

    // ── Step 6: Run First Optimization Cycle ─────────────────────────────

    console.log('\n--- Step 6: Running First Optimization Cycle ---');
    console.log(`Pending Signals: ${optimizationEngine.getPendingSignalCount()}`);

    const adaptationSignal = overrideInterface.computeAdaptationSignal();
    const report1 = optimizationEngine.optimize(
        scoringEngine,
        classificationEngine,
        adaptationSignal
    );

    if (report1) {
        console.log(`\nOptimization Report:`);
        console.log(`  New Version: v${report1.newVersion.versionNumber}`);
        console.log(`  Signals Processed: ${report1.signalsProcessed}`);
        console.log(`  Signal Types: ${JSON.stringify(report1.signalTypeCounts)}`);
        console.log(`  Effective Learning Rate: ${report1.effectiveLearningRate}`);
        console.log(`  Conservatism Bias Delta: ${report1.conservatismBiasDelta}`);
        console.log(`  Dampened: ${report1.dampened}`);
        console.log(`  Threshold Band Shift: auto-approve δ=${report1.thresholdBandShift.autoApproveMinDelta}, block δ=${report1.thresholdBandShift.blockMaxDelta}`);

        console.log(`\n  Applied Dimension Deltas:`);
        for (const [dim, delta] of Object.entries(report1.appliedDimensionDeltas)) {
            const direction = (delta as number) > 0 ? 'TIGHTENED' : 'RELAXED';
            console.log(`    ${dim}: ${(delta as number).toFixed(6)} (${direction})`);
        }
    }

    // ── Step 7: Ingest More Signals and Run Second Cycle ─────────────────

    console.log('\n--- Step 7: Second Optimization Cycle (Additional Signals) ---');

    // Three more real-outcome signals showing system is now well-calibrated
    for (let i = 0; i < 3; i++) {
        const goodOutcome = optimizationEngine.createOutcomeSignal(
            `decision-good-${i}`,
            scoreResult,
            classification,
            {
                observedCompliance: 0.88 + (i * 0.04),
                stabilityIncident: false,
                costRatio: 0.9,
            },
            0.85
        );
        optimizationEngine.ingestSignal(goodOutcome);
    }

    const report2 = optimizationEngine.optimize(scoringEngine, classificationEngine);

    if (report2) {
        console.log(`\nSecond Optimization Report:`);
        console.log(`  New Version: v${report2.newVersion.versionNumber}`);
        console.log(`  Signals Processed: ${report2.signalsProcessed}`);
        console.log(`  Effective Learning Rate: ${report2.effectiveLearningRate}`);
        console.log(`  Conservatism Bias: ${report2.newVersion.conservatismBias.toFixed(4)}`);
        console.log(`  Dampened: ${report2.dampened}`);
    }

    // ── Step 8: Version History Audit ─────────────────────────────────────

    console.log('\n--- Step 8: Version History Audit ---');
    const versions = optimizationEngine.getVersionHistory();
    console.log(`Total Versions: ${versions.length}`);

    for (const version of versions) {
        console.log(`\n  v${version.versionNumber} [${version.active ? 'ACTIVE' : 'inactive'}]`);
        console.log(`    Created: ${version.createdAt.toISOString()}`);
        console.log(`    Reason: ${version.changeReason}`);
        console.log(`    Conservatism Bias: ${version.conservatismBias.toFixed(4)}`);
        console.log(`    Threshold Band: block <= ${version.thresholdBand.blockMax.toFixed(2)}, auto-approve >= ${version.thresholdBand.autoApproveMin.toFixed(2)}`);
        console.log(`    Triggering Signals: ${version.triggeringSignalIds.length}`);
    }

    // ── Step 9: Rollback ──────────────────────────────────────────────────

    console.log('\n--- Step 9: Rolling Back to Version 1 ---');
    console.log('(Reverting to baseline configuration after detecting unexpected behavior)');

    const v1 = optimizationEngine.getVersionByNumber(1)!;
    const rollbackResult = optimizationEngine.rollback(
        v1.versionId,
        'Automated safety check detected anomalous threshold drift',
        scoringEngine,
        classificationEngine
    );

    console.log(`\nRollback Result:`);
    console.log(`  Success: ${rollbackResult.success}`);
    console.log(`  Rolled back from: v${rollbackResult.rolledBackFrom.versionNumber}`);
    console.log(`  Rolled back to: v${rollbackResult.rolledBackTo.versionNumber}`);
    console.log(`  Reason: ${rollbackResult.reason}`);

    // ── Step 10: Post-Rollback State ─────────────────────────────────────

    console.log('\n--- Step 10: Post-Rollback State ---');
    const activeAfterRollback = optimizationEngine.getActiveVersion()!;
    console.log(`Active Version: v${activeAfterRollback.versionNumber}`);
    console.log(`Conservatism Bias: ${activeAfterRollback.conservatismBias.toFixed(4)}`);
    console.log(`Threshold Band: block <= ${activeAfterRollback.thresholdBand.blockMax.toFixed(2)}, auto-approve >= ${activeAfterRollback.thresholdBand.autoApproveMin.toFixed(2)}`);

    const postRollbackScore = scoringEngine.scoreDecision(decisionObject, context, systemState);
    console.log(`\nPost-Rollback Decision Score: ${postRollbackScore.decisionScore}/100`);
    console.log(`(Compare with original: ${scoreResult.decisionScore}/100)`);

    // ── Step 11: Error Rate Indicators ───────────────────────────────────

    console.log('\n--- Error Rate Indicators ---');
    const indicators = optimizationEngine.getErrorRateIndicators();
    console.log(`False Positive Rate (EMA): ${(indicators.falsePositiveRateEMA * 100).toFixed(2)}%`);
    console.log(`Missed Violation Rate (EMA): ${(indicators.missedViolationRateEMA * 100).toFixed(2)}%`);

    // ── Step 12: Signal History Summary ───────────────────────────────────

    console.log('\n--- Signal History Summary ---');
    const historySummary = optimizationEngine.getSignalHistorySummary();
    console.log(`Total Processed Signals: ${historySummary.total}`);
    console.log(`Average Signal Confidence: ${(historySummary.averageConfidence * 100).toFixed(1)}%`);
    console.log(`By Type:`);
    for (const [type, count] of Object.entries(historySummary.byType)) {
        console.log(`  ${type}: ${count}`);
    }

    // ── Final Version History ──────────────────────────────────────────

    console.log('\n--- Final Version History (Post-Rollback) ---');
    const finalVersions = optimizationEngine.getVersionHistory();
    console.log(`Total Versions: ${finalVersions.length}`);
    for (const version of finalVersions) {
        const marker = version.active ? ' ←── ACTIVE' : '';
        console.log(`  v${version.versionNumber}: ${version.changeReason}${marker}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

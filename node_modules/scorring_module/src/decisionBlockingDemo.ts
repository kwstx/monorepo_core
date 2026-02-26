import { DecisionBlockingAPI, type EvaluateActionRequest } from './DecisionBlockingAPI.js';

async function runDecisionBlockingDemo(): Promise<void> {
    const api = new DecisionBlockingAPI();

    const request: EvaluateActionRequest = {
        rawAction: {
            agentId: 'agent-governance-007',
            action: 'FILE_DELETE',
            params: {
                path: '/secure/audit.log',
                intent: 'Delete obsolete audit logs to free storage'
            },
            context: {
                agentType: 'MAINTENANCE_BOT',
                id: 'ctx-governance-1',
                delegationChain: ['ops-admin', 'maintenance-service']
            }
        },
        riskContext: {
            budgetPressure: 0.25,
            dataSensitivity: 0.9,
            historicalComplianceRate: 0.93
        },
        systemState: {
            loadFactor: 0.2,
            incidentActive: false,
            regulatoryAlert: true,
            recoveryBacklogSeconds: 0
        },
        classificationContext: {
            riskPosture: 0.55
        },
        enforcement: {
            targetPlatforms: ['WINDOWS', 'LINUX', 'KUBERNETES'],
            actorId: 'governance-controller',
            policyPackVersion: 'policy-pack-2026.02',
            governanceMode: 'strict'
        }
    };

    const response = await api.evaluateAction(request);

    console.log('DecisionBlockingAPI response summary:');
    console.log(JSON.stringify({
        evaluationId: response.evaluationId,
        decisionId: response.action.decisionId,
        compositeRiskScore: response.compositeRiskScore,
        simulationResults: response.simulationResults,
        complianceProbability: response.complianceProbability,
        strategicAlignmentRating: response.strategicAlignmentRating,
        classificationState: response.classificationState,
        enforcement: response.enforcement,
        governanceAudit: response.governanceAudit,
        explanationTrace: response.explanationTrace
    }, null, 2));
}

runDecisionBlockingDemo().catch((err) => {
    console.error(err);
    process.exit(1);
});


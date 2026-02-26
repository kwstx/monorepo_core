import { ImpactAssessmentEngine } from '../engines/ImpactAssessmentEngine';
import { ProposalSubmissionEngine } from '../engines/ProposalSubmissionEngine';
import { SandboxEvaluationEngine } from '../engines/SandboxEvaluationEngine';
import { VersionControlEngine } from '../engines/VersionControlEngine';
import {
    OrchestrationBridge,
    SelfImprovementAPI,
    SelfImprovementAPIPorts
} from './SelfImprovementAPI';

export interface DefaultSelfImprovementAPIDependencies {
    submissionEngine: ProposalSubmissionEngine;
    evaluationEngine: SandboxEvaluationEngine;
    versionControlEngine: VersionControlEngine;
    impactAssessmentEngine: ImpactAssessmentEngine;
    orchestrationBridge?: OrchestrationBridge;
}

/**
 * Composes the API from swappable engines so orchestration/runtime concerns
 * remain outside the governance core.
 */
export function createSelfImprovementAPI(
    dependencies: DefaultSelfImprovementAPIDependencies
): SelfImprovementAPI {
    const ports: SelfImprovementAPIPorts = {
        submission: dependencies.submissionEngine,
        evaluation: dependencies.evaluationEngine,
        versionHistory: dependencies.versionControlEngine,
        rollback: dependencies.versionControlEngine,
        impactSimulation: dependencies.impactAssessmentEngine
    };

    return new SelfImprovementAPI(ports, dependencies.orchestrationBridge);
}

import { AutonomousGovernanceModule } from '../engines/AutonomousGovernanceModule';
import { ConsensusEngine } from '../engines/ConsensusEngine';
import { ImpactAssessmentEngine } from '../engines/ImpactAssessmentEngine';
import { PolicyValidationLayer } from '../engines/PolicyValidationLayer';
import { ProposalPrioritizationEngine } from '../engines/ProposalPrioritizationEngine';
import { RollbackEngine } from '../engines/RollbackEngine';
import { SandboxEvaluationEngine } from '../engines/SandboxEvaluationEngine';
import { VersionControlEngine } from '../engines/VersionControlEngine';

export interface AutonomousGovernanceModuleDependencies {
    impactAssessmentEngine: ImpactAssessmentEngine;
    policyValidationLayer?: PolicyValidationLayer;
    proposalPrioritizationEngine?: ProposalPrioritizationEngine;
    sandboxEvaluationEngine?: SandboxEvaluationEngine;
    consensusEngine?: ConsensusEngine;
    rollbackEngine?: RollbackEngine;
    versionControlEngine: VersionControlEngine;
}

export function createAutonomousGovernanceModule(
    dependencies: AutonomousGovernanceModuleDependencies
): AutonomousGovernanceModule {
    return new AutonomousGovernanceModule({
        impactAssessmentEngine: dependencies.impactAssessmentEngine,
        policyValidationLayer:
            dependencies.policyValidationLayer ?? new PolicyValidationLayer(),
        proposalPrioritizationEngine:
            dependencies.proposalPrioritizationEngine ??
            new ProposalPrioritizationEngine(),
        sandboxEvaluationEngine:
            dependencies.sandboxEvaluationEngine ??
            new SandboxEvaluationEngine(
                dependencies.policyValidationLayer ?? new PolicyValidationLayer()
            ),
        consensusEngine: dependencies.consensusEngine ?? new ConsensusEngine(),
        versionControlEngine: dependencies.versionControlEngine,
        rollbackEngine:
            dependencies.rollbackEngine ??
            new RollbackEngine(dependencies.versionControlEngine)
    });
}

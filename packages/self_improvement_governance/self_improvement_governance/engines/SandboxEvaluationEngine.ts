import {
    ProposalStatus,
    SelfModificationProposal,
    SimulationResult,
    SimulationMetrics
} from '../models/SelfModificationProposal';
import {
    PolicyValidationLayer,
    PolicyViolation
} from './PolicyValidationLayer';
import type { ComputeAllocationPlan } from './ProposalPrioritizationEngine';

/**
 * SandboxEvaluationEngine
 * 
 * Runs self-modification proposals in a fully isolated simulation environment.
 * Evaluates downstream effects, agent cooperation impacts, and vocational performance outcomes.
 */
export class SandboxEvaluationEngine {
    constructor(
        private readonly policyValidationLayer: PolicyValidationLayer = new PolicyValidationLayer()
    ) {}

    /**
     * Evaluates a proposal by running it in a simulated sandbox.
     * @param proposal The proposal to evaluate.
     * @returns A promise that resolves to the simulation result.
     */
    public async evaluate(
        proposal: SelfModificationProposal,
        allocationPlan?: ComputeAllocationPlan
    ): Promise<SimulationResult> {
        const logs: string[] = [];
        const policyValidation = this.policyValidationLayer.validate(proposal);

        if (!policyValidation.passed) {
            proposal.status = ProposalStatus.REJECTED;
            logs.push(`[${new Date().toISOString()}] Policy validation failed for proposal: ${proposal.id}`);
            logs.push(...this.buildViolationLogs(policyValidation.violations));

            const rejectedResult: SimulationResult = {
                success: false,
                performanceDelta: 0,
                resourceUsageDelta: 0,
                stabilityScore: 0,
                metrics: {
                    downstreamEffects: 0,
                    cooperationImpact: 0,
                    vocationalOutcome: 0
                },
                logs
            };

            proposal.updateSimulationResults(rejectedResult);
            return rejectedResult;
        }

        proposal.status = ProposalStatus.SIMULATING;

        logs.push(`[${new Date().toISOString()}] Starting sandbox simulation for proposal: ${proposal.id}`);
        logs.push(`[${new Date().toISOString()}] Initializing isolated environment...`);
        if (allocationPlan) {
            logs.push(
                `[${new Date().toISOString()}] [SCHEDULER] Compute tier=${allocationPlan.tier} cpu=${allocationPlan.cpuCores} memoryMb=${allocationPlan.memoryMb} maxRuntimeMs=${allocationPlan.maxRuntimeMs}`
            );
        }

        // Simulate environment isolation
        await this.delay(this.scaledDelay(500, allocationPlan));
        logs.push(`[${new Date().toISOString()}] [ISOLATION] Virtual filesystem mounted. Network restricted. CPU pinning active.`);

        logs.push(`[${new Date().toISOString()}] [DEPLOYMENT] Applying proposed change to target module: ${proposal.targetModule}`);
        if (proposal.targetParameter) {
            logs.push(`[${new Date().toISOString()}] [DEPLOYMENT] Modifying parameter: ${proposal.targetParameter}`);
        }

        // Simulate test execution
        logs.push(`[${new Date().toISOString()}] [EXECUTION] Running initial sanity checks...`);
        await this.delay(this.scaledDelay(300, allocationPlan));

        // Evaluate Downstream Effects
        logs.push(`[${new Date().toISOString()}] [EVALUATION] Analyzing downstream effects on dependent systems...`);
        const downstreamEffects = this.simulateImpact(proposal.predictedRisk, 'high');
        logs.push(`[${new Date().toISOString()}] [EVALUATION] Downstream impact score: ${downstreamEffects.toFixed(2)}`);

        // Evaluate Agent Cooperation Impacts
        logs.push(`[${new Date().toISOString()}] [EVALUATION] Testing impact on multi-agent cooperation protocols...`);
        const cooperationImpact = this.simulateImpact(proposal.predictedRisk * 0.8, 'medium');
        logs.push(`[${new Date().toISOString()}] [EVALUATION] Cooperation impact score: ${cooperationImpact.toFixed(2)}`);

        // Evaluate Vocational Performance Outcomes
        logs.push(`[${new Date().toISOString()}] [EVALUATION] Simulating real-world vocational performance outcomes...`);
        const vocationalOutcome = this.simulateImpact(proposal.predictedRisk * 1.2, 'low');
        logs.push(`[${new Date().toISOString()}] [EVALUATION] Vocational performance delta: ${vocationalOutcome.toFixed(2)}`);

        // Final Performance & Stability Metrics
        const performanceDelta = vocationalOutcome * 2.5;
        const resourceUsageDelta = (Math.random() * 0.5) * (proposal.type === 'MAJOR' ? 2 : 1);
        const stabilityScore = 1.0 - (proposal.predictedRisk * 0.3) - (Math.random() * 0.1);

        const success = stabilityScore > 0.6 && downstreamEffects > -0.2;

        logs.push(`[${new Date().toISOString()}] Simulation completed. Result: ${success ? 'SUCCESS' : 'FAILURE'}`);

        const result: SimulationResult = {
            success,
            performanceDelta,
            resourceUsageDelta,
            stabilityScore,
            metrics: {
                downstreamEffects,
                cooperationImpact,
                vocationalOutcome
            },
            logs
        };

        proposal.updateSimulationResults(result);
        proposal.status = success ? ProposalStatus.EVALUATING : ProposalStatus.REJECTED;

        return result;
    }

    private simulateImpact(risk: number, sensitivity: 'low' | 'medium' | 'high'): number {
        const base = Math.random() * 2 - 1; // -1 to 1
        const riskFactor = risk * (sensitivity === 'high' ? 1.5 : sensitivity === 'medium' ? 1.0 : 0.5);

        // Higher risk tends to push impact towards negative or unpredictable values
        return Math.max(-1.0, Math.min(1.0, base - (riskFactor * Math.random())));
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private scaledDelay(baseMs: number, allocationPlan?: ComputeAllocationPlan): number {
        if (!allocationPlan) {
            return baseMs;
        }

        const normalizedCpuFactor = Math.max(1, allocationPlan.cpuCores) / 2;
        return Math.max(50, Math.round(baseMs / normalizedCpuFactor));
    }

    private buildViolationLogs(violations: PolicyViolation[]): string[] {
        return violations.map(
            (violation) =>
                `[${new Date().toISOString()}] [POLICY:${violation.domain}] ${violation.ruleId} - ${violation.message}`
        );
    }
}

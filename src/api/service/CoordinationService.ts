
import { AgentCoordinationMessage } from '../../schema/MessageSchema';
import { NegotiationEngine, NegotiationState, TransitionResult } from '../../engine/NegotiationEngine';
import { SettlementEngine, ActualDeliverable, SettlementReport } from '../../engine/SettlementEngine';
import { ConflictResolutionEngine, ConflictCheckResult } from '../../engine/ConflictResolutionEngine';
import { CoordinationPolicyValidator } from '../../engine/CoordinationPolicyValidator';
import { SharedTaskContract, ContractFactory } from '../../schema/ContractSchema';
import { ReputationAndSynergyModule } from '../../engine/ReputationAndSynergyModule';
import { BudgetManager } from '../../engine/BudgetManager';
import { CoordinationPolicy, ValidationResponse } from '../../schema/PolicySchema';
import {
    CoalitionRecommendationRequest,
    CoalitionRecommendationResponse,
    PredictiveCoalitionEngine
} from '../../engine/PredictiveCoalitionEngine';

export interface CoordinationSession {
    sessionId: string;
    state: NegotiationState | null;
    history: AgentCoordinationMessage[];
    contract?: SharedTaskContract;
}

export interface RecommendationRequest {
    candidateAgents?: string[];
    maxCoalitionSize?: number;
    topK?: number;
}

export class CoordinationService {
    private sessions = new Map<string, CoordinationSession>();
    private contracts = new Map<string, SharedTaskContract>();

    private negotiationEngine: NegotiationEngine;
    private settlementEngine: SettlementEngine;
    private conflictEngine: ConflictResolutionEngine;
    private policyValidator: CoordinationPolicyValidator;
    private reputationModule: ReputationAndSynergyModule;
    private budgetManager: BudgetManager;
    private predictiveCoalitionEngine: PredictiveCoalitionEngine;

    private defaultPolicy: CoordinationPolicy = {
        id: 'default-policy',
        name: 'Standard Coordination Policy',
        economic: {
            minRoi: 0.1,
            maxBudget: 1000000
        },
        compliance: {
            maxRiskScore: 0.5
        }
    };

    constructor() {
        this.reputationModule = new ReputationAndSynergyModule();
        this.budgetManager = new BudgetManager();
        this.conflictEngine = new ConflictResolutionEngine();
        this.policyValidator = new CoordinationPolicyValidator();
        this.settlementEngine = new SettlementEngine(this.reputationModule, this.budgetManager);
        this.predictiveCoalitionEngine = new PredictiveCoalitionEngine();
        this.seedHistoricalSignals();

        const mockProviders = this.createMockProviders();
        this.negotiationEngine = new NegotiationEngine({
            ...mockProviders,
            minimumReputationScore: 0.5,
            conflictResolutionEngine: this.conflictEngine,
            auditSink: {
                record: (event) => {
                    console.log('[Audit]', JSON.stringify(event));
                    return {} as any;
                }
            }
        });
    }

    private createMockProviders() {
        return {
            identityVerifier: { verify: () => true },
            reputationProvider: this.reputationModule,
            budgetProvider: { getAvailableBudget: () => 1000000 },
            authorityProvider: { hasPermission: () => true }
        };
    }

    private seedHistoricalSignals(): void {
        const now = new Date().toISOString();
        this.reputationModule.recordOutcome({
            agentId: 'agent:alpha-prime',
            correlationId: 'seed-1',
            timestamp: now,
            outcome: 'SUCCESS',
            reliability: 0.95,
            economicPerformance: 0.92,
            cooperativeImpact: 0.9
        });
        this.reputationModule.recordOutcome({
            agentId: 'agent:beta-core',
            correlationId: 'seed-2',
            timestamp: now,
            outcome: 'SUCCESS',
            reliability: 0.89,
            economicPerformance: 0.86,
            cooperativeImpact: 0.84
        });
        this.reputationModule.recordOutcome({
            agentId: 'agent:gamma-ops',
            correlationId: 'seed-3',
            timestamp: now,
            outcome: 'PARTIAL',
            reliability: 0.72,
            economicPerformance: 0.68,
            cooperativeImpact: 0.7
        });
        this.reputationModule.recordOutcome({
            agentId: 'agent:delta-risk',
            correlationId: 'seed-4',
            timestamp: now,
            outcome: 'FAILURE',
            reliability: 0.45,
            economicPerformance: 0.4,
            cooperativeImpact: 0.35
        });

        this.reputationModule.updateSynergy('agent:alpha-prime', 'agent:beta-core', 0.94);
        this.reputationModule.updateSynergy('agent:alpha-prime', 'agent:gamma-ops', 0.78);
        this.reputationModule.updateSynergy('agent:beta-core', 'agent:gamma-ops', 0.82);
        this.reputationModule.updateSynergy('agent:beta-core', 'agent:delta-risk', 0.42);
    }

    public async negotiate(message: AgentCoordinationMessage, sessionId?: string): Promise<{ sessionId: string, result: TransitionResult }> {
        const result = this.negotiationEngine.process(message);
        const id = sessionId || message.correlationId || message.messageId;

        let session = this.sessions.get(id);
        if (!session) {
            session = { sessionId: id, state: result.state || null, history: [] };
            this.sessions.set(id, session);
        }

        if (result.accepted) {
            session.state = result.state || session.state;
            session.history.push(message);
        }

        return { sessionId: id, result };
    }

    public async validateMessage(message: AgentCoordinationMessage, policy?: CoordinationPolicy): Promise<ValidationResponse> {
        return this.policyValidator.evaluate(message, policy || this.defaultPolicy);
    }

    public async createContract(sessionId: string): Promise<SharedTaskContract> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        if (session.state !== NegotiationState.FINAL_COMMITMENT) {
            throw new Error(`Negotiation not finalized. Current state: ${session.state}`);
        }

        const lastMessage = session.history[session.history.length - 1];

        const contract = ContractFactory.createContract({
            correlationId: lastMessage.correlationId || lastMessage.messageId,
            participatingAgents: [lastMessage.sender.id, lastMessage.recipient.id],
            scope: lastMessage.content.scope,
            deliverables: lastMessage.content.scope.tasks.map(task => ({
                name: task,
                description: `Automated deliverable for task: ${task}`,
                metric: 'Completion',
                targetValue: 1,
                verificationMethod: 'Agent Confirmation'
            })),
            compensation: lastMessage.content.resources,
            deadlines: {
                overallCompletion: lastMessage.content.deadline,
                milestones: []
            },
            status: 'ACTIVE'
        });

        this.contracts.set(contract.contractId, contract);
        session.contract = contract;

        return contract;
    }

    public async confirmExecution(contractId: string, outcomes: ActualDeliverable[]): Promise<SettlementReport> {
        const contract = this.contracts.get(contractId);
        if (!contract) throw new Error('Contract not found');

        // Note: SettlementEngine.processSettlement handles status validation internally
        // But we need to make sure the contract status is set to something it expects
        // Here we update it via factory-like logic or just cast if needed, 
        // but SharedTaskContract in memory can be modified if not frozen, 
        // yet Factory returns a frozen object. 
        // For the sake of this service, we'll assume we can pass a "completed" version.

        const completedContract = { ...contract, status: 'COMPLETED' as const };
        const report = this.settlementEngine.processSettlement(completedContract, outcomes);

        this.contracts.set(contractId, completedContract);
        return report;
    }

    public async resolveDispute(sessionId: string, message: AgentCoordinationMessage): Promise<ConflictCheckResult> {
        return this.conflictEngine.evaluate(message, sessionId);
    }

    public async recommendCollaborations(input: RecommendationRequest): Promise<CoalitionRecommendationResponse> {
        const knownAgents = this.reputationModule.getKnownAgents();
        const candidateAgents = (input.candidateAgents && input.candidateAgents.length > 0)
            ? input.candidateAgents
            : knownAgents;

        const request: CoalitionRecommendationRequest = {
            candidateAgents,
            maxCoalitionSize: input.maxCoalitionSize,
            topK: input.topK
        };

        return this.predictiveCoalitionEngine.recommend(
            request,
            this.reputationModule.getHistorySnapshot(),
            this.reputationModule.getSynergySnapshot()
        );
    }

    public getSession(sessionId: string): CoordinationSession | undefined {
        return this.sessions.get(sessionId);
    }

    public getContract(contractId: string): SharedTaskContract | undefined {
        return this.contracts.get(contractId);
    }
}

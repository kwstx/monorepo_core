
import { AgentCoordinationMessage, MessageType } from '../../schema/MessageSchema';
import { NegotiationEngine, NegotiationState, TransitionResult } from '../../engine/NegotiationEngine';
import { SettlementEngine, ActualDeliverable, SettlementReport } from '../../engine/SettlementEngine';
import { ConflictResolutionEngine, ConflictCheckResult } from '../../engine/ConflictResolutionEngine';
import { CoordinationPolicyValidator } from '../../engine/CoordinationPolicyValidator';
import { SharedTaskContract } from '../../schema/ContractSchema';
import { ReputationAndSynergyModule } from '../../engine/ReputationAndSynergyModule';
import { BudgetManager } from '../../engine/BudgetManager';
import { v4 as uuidv4 } from 'uuid';

export interface CoordinationSession {
    sessionId: string;
    state: NegotiationState | null;
    history: AgentCoordinationMessage[];
    contract?: SharedTaskContract;
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

    constructor() {
        // Initialize engines with default or mock providers for now
        this.reputationModule = new ReputationAndSynergyModule();
        this.budgetManager = new BudgetManager();
        this.conflictEngine = new ConflictResolutionEngine();
        this.policyValidator = new CoordinationPolicyValidator();
        this.settlementEngine = new SettlementEngine(this.reputationModule, this.budgetManager);

        // NegotiationEngine needs providers
        const mockProviders = this.createMockProviders();
        this.negotiationEngine = new NegotiationEngine({
            ...mockProviders,
            minimumReputationScore: 0.5,
            conflictResolutionEngine: this.conflictEngine,
            auditSink: {
                record: (event: any) => {
                    console.log('[Audit]', JSON.stringify(event));
                    return {} as any;
                }
            }
        });
    }

    private createMockProviders() {
        return {
            identityVerifier: { verify: () => true },
            reputationProvider: {
                getScore: () => 0.8,
                getTrustThreshold: () => 0.5,
                getSynergyMultiplier: () => 1.1,
                validateCommitmentPriority: () => ({ priority: 'NORMAL' as const, requiresEscrow: false })
            },
            budgetProvider: { getAvailableBudget: () => 1000000 },
            authorityProvider: { hasPermission: () => true }
        };
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

    public async validateMessage(message: AgentCoordinationMessage): Promise<any> {
        return this.policyValidator.validate(message);
    }

    public async createContract(sessionId: string): Promise<SharedTaskContract> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error('Session not found');
        if (session.state !== NegotiationState.FINAL_COMMITMENT) {
            throw new Error('Negotiation not finalized');
        }

        const lastMessage = session.history[session.history.length - 1];

        const contract: SharedTaskContract = {
            contractId: uuidv4(),
            correlationId: lastMessage.correlationId,
            status: 'PROPOSED',
            participatingAgents: [lastMessage.sender.id, lastMessage.recipient.id],
            terms: {
                validUntil: lastMessage.content.deadline,
                governingLaw: 'Autonomous Agent Code v1',
                arbitrationVenue: 'Decentralized Coordination Service'
            },
            deliverables: lastMessage.content.scope.tasks.map(task => ({
                name: task,
                description: task,
                targetValue: 1, // Default
                unit: 'completion',
                weight: 1 / lastMessage.content.scope.tasks.length
            })),
            compensation: {
                budget: lastMessage.content.resources.budget,
                paymentTerms: 'On completion'
            },
            penaltyClauses: [],
            auditTrail: [],
            metadata: {},
            signatures: [],
            timestamp: new Date().toISOString()
        };

        contract.status = 'ACTIVE';
        this.contracts.set(contract.contractId, contract);
        session.contract = contract;

        return contract;
    }

    public async confirmExecution(contractId: string, outcomes: ActualDeliverable[]): Promise<SettlementReport> {
        const contract = this.contracts.get(contractId);
        if (!contract) throw new Error('Contract not found');

        contract.status = 'COMPLETED'; // Simplified transition
        const report = this.settlementEngine.processSettlement(contract, outcomes);

        return report;
    }

    public async resolveDispute(sessionId: string, message: AgentCoordinationMessage): Promise<ConflictCheckResult> {
        return this.conflictEngine.evaluate(message, sessionId);
    }

    public getSession(sessionId: string): CoordinationSession | undefined {
        return this.sessions.get(sessionId);
    }

    public getContract(contractId: string): SharedTaskContract | undefined {
        return this.contracts.get(contractId);
    }
}

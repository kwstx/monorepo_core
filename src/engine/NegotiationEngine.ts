import { AgentCoordinationMessage, MessageType } from '../schema/MessageSchema';

export enum NegotiationState {
  PROPOSAL = 'PROPOSAL',
  COUNTERPROPOSAL = 'COUNTERPROPOSAL',
  TENTATIVE_AGREEMENT = 'TENTATIVE_AGREEMENT',
  FINAL_COMMITMENT = 'FINAL_COMMITMENT'
}

export type TransitionPermission =
  | 'NEGOTIATE_PROPOSAL'
  | 'NEGOTIATE_COUNTERPROPOSAL'
  | 'NEGOTIATE_TENTATIVE_AGREEMENT'
  | 'NEGOTIATE_FINAL_COMMITMENT';

const STATE_FROM_MESSAGE_TYPE: Record<MessageType, NegotiationState | null> = {
  [MessageType.OFFER]: NegotiationState.PROPOSAL,
  [MessageType.COUNTEROFFER]: NegotiationState.COUNTERPROPOSAL,
  [MessageType.ACCEPTANCE]: NegotiationState.TENTATIVE_AGREEMENT,
  [MessageType.REJECTION]: null,
  [MessageType.COMMITMENT]: NegotiationState.FINAL_COMMITMENT
};

const REQUIRED_PREDECESSOR: Record<NegotiationState, NegotiationState | null> = {
  [NegotiationState.PROPOSAL]: null,
  [NegotiationState.COUNTERPROPOSAL]: NegotiationState.PROPOSAL,
  [NegotiationState.TENTATIVE_AGREEMENT]: NegotiationState.COUNTERPROPOSAL,
  [NegotiationState.FINAL_COMMITMENT]: NegotiationState.TENTATIVE_AGREEMENT
};

const REQUIRED_PERMISSION: Record<NegotiationState, TransitionPermission> = {
  [NegotiationState.PROPOSAL]: 'NEGOTIATE_PROPOSAL',
  [NegotiationState.COUNTERPROPOSAL]: 'NEGOTIATE_COUNTERPROPOSAL',
  [NegotiationState.TENTATIVE_AGREEMENT]: 'NEGOTIATE_TENTATIVE_AGREEMENT',
  [NegotiationState.FINAL_COMMITMENT]: 'NEGOTIATE_FINAL_COMMITMENT'
};

export interface IdentityVerifier {
  verify(message: AgentCoordinationMessage): boolean;
}

export interface ReputationProvider {
  getScore(agentId: string): number;
}

export interface BudgetProvider {
  getAvailableBudget(agentId: string, currency: string): number;
}

export interface AuthorityProvider {
  hasPermission(agentId: string, permission: TransitionPermission): boolean;
}

export interface NegotiationEngineConfig {
  identityVerifier: IdentityVerifier;
  reputationProvider: ReputationProvider;
  budgetProvider: BudgetProvider;
  authorityProvider: AuthorityProvider;
  minimumReputationScore: number;
}

interface NegotiationSession {
  id: string;
  state: NegotiationState | null;
}

export interface TransitionResult {
  accepted: boolean;
  state?: NegotiationState;
  reason?: string;
}

export class NegotiationEngine {
  private readonly sessions = new Map<string, NegotiationSession>();

  public constructor(private readonly config: NegotiationEngineConfig) {}

  public process(message: AgentCoordinationMessage): TransitionResult {
    const nextState = STATE_FROM_MESSAGE_TYPE[message.type];
    if (!nextState) {
      return {
        accepted: false,
        reason: `Message type "${message.type}" is not a valid negotiation transition.`
      };
    }

    const sessionId = message.correlationId ?? message.messageId;
    const session = this.sessions.get(sessionId) ?? { id: sessionId, state: null };

    const predecessor = REQUIRED_PREDECESSOR[nextState];
    if (session.state !== predecessor) {
      return {
        accepted: false,
        reason: `Invalid transition. Expected "${predecessor ?? 'NONE'}" before "${nextState}", found "${session.state ?? 'NONE'}".`
      };
    }

    const gateResult = this.validateGates(message, nextState);
    if (!gateResult.accepted) {
      return gateResult;
    }

    session.state = nextState;
    this.sessions.set(sessionId, session);
    return { accepted: true, state: nextState };
  }

  public getState(sessionId: string): NegotiationState | null {
    return this.sessions.get(sessionId)?.state ?? null;
  }

  private validateGates(
    message: AgentCoordinationMessage,
    nextState: NegotiationState
  ): TransitionResult {
    if (!this.config.identityVerifier.verify(message)) {
      return { accepted: false, reason: 'Identity verification failed.' };
    }

    const reputation = this.config.reputationProvider.getScore(message.sender.id);
    if (reputation < this.config.minimumReputationScore) {
      return {
        accepted: false,
        reason: `Reputation score ${reputation} is below required threshold ${this.config.minimumReputationScore}.`
      };
    }

    const budget = message.content.resources.budget;
    if (budget.amount > budget.limit) {
      return {
        accepted: false,
        reason: `Requested budget amount ${budget.amount} exceeds declared limit ${budget.limit}.`
      };
    }

    const availableBudget = this.config.budgetProvider.getAvailableBudget(
      message.sender.id,
      budget.currency
    );
    if (budget.amount > availableBudget) {
      return {
        accepted: false,
        reason: `Requested budget amount ${budget.amount} exceeds available budget ${availableBudget}.`
      };
    }

    const requiredPermission = REQUIRED_PERMISSION[nextState];
    if (!this.config.authorityProvider.hasPermission(message.sender.id, requiredPermission)) {
      return {
        accepted: false,
        reason: `Sender "${message.sender.id}" lacks authority "${requiredPermission}".`
      };
    }

    if (nextState === NegotiationState.FINAL_COMMITMENT) {
      const commitmentMetadata = message.metadata?.commitment as
        | { isFormal?: boolean; verificationToken?: string }
        | undefined;
      if (!commitmentMetadata?.isFormal || !commitmentMetadata?.verificationToken) {
        return {
          accepted: false,
          reason: 'Final commitment must be formal and include a verification token.'
        };
      }
    }

    return { accepted: true, state: nextState };
  }
}

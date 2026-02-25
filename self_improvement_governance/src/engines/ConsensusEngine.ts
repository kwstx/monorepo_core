import {
    ConsensusScore,
    ConsensusVote,
    SelfModificationProposal
} from '../models/SelfModificationProposal';

export interface VotingAgent {
    id: string;
    weight: number;
    evaluate(proposal: SelfModificationProposal): Promise<Omit<ConsensusVote, 'agentId' | 'weight'>>;
}

export interface ConsensusOptions {
    threshold: number; // minimum weightedConsensusScore to approve
    requiredApprovals?: number; // minimum number of agents who must approve
}

export class ConsensusEngine {
    constructor(private readonly options: ConsensusOptions = { threshold: 0.7 }) { }

    async collectConsensus(
        proposal: SelfModificationProposal,
        agents: VotingAgent[]
    ): Promise<ConsensusScore> {
        const votes: ConsensusVote[] = [];
        let totalApprovals = 0;
        let totalDisapprovals = 0;
        let totalAbstentions = 0;

        let totalWeightedScore = 0;
        let totalWeight = 0;

        let sumImpact = 0;
        let sumCooperation = 0;
        let sumAlignment = 0;

        for (const agent of agents) {
            const evaluation = await agent.evaluate(proposal);
            const weight = agent.weight;

            const vote: ConsensusVote = {
                agentId: agent.id,
                weight,
                ...evaluation
            };

            votes.push(vote);

            if (vote.approved) {
                totalApprovals++;
                const compositeScore = (vote.predictedImpact + vote.cooperationValue + vote.taskAlignment) / 3;
                totalWeightedScore += compositeScore * weight;
            } else {
                totalDisapprovals++;
            }

            totalWeight += weight;
            sumImpact += vote.predictedImpact;
            sumCooperation += vote.cooperationValue;
            sumAlignment += vote.taskAlignment;
        }

        const weightedConsensusScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
        const totalAgents = agents.length;

        const averageImpact = totalAgents > 0 ? sumImpact / totalAgents : 0;
        const averageCooperation = totalAgents > 0 ? sumCooperation / totalAgents : 0;
        const averageAlignment = totalAgents > 0 ? sumAlignment / totalAgents : 0;

        let consensusReached = weightedConsensusScore >= this.options.threshold;

        if (this.options.requiredApprovals && totalApprovals < this.options.requiredApprovals) {
            consensusReached = false;
        }

        const score: ConsensusScore = {
            totalAgents,
            approvals: totalApprovals,
            disapprovals: totalDisapprovals,
            abstentions: totalAbstentions, // Currently not implementing abstention logic explicitly
            weightedConsensusScore,
            averageImpact,
            averageCooperation,
            averageAlignment,
            consensusReached,
            votes
        };

        proposal.updateConsensusScores(score);
        return score;
    }
}

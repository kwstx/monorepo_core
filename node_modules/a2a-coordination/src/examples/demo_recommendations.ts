import { CoordinationService } from '../api/service/CoordinationService';

async function runRecommendationDemo() {
  const service = new CoordinationService();

  const recommendationReport = await service.recommendCollaborations({
    candidateAgents: [
      'agent:alpha-prime',
      'agent:beta-core',
      'agent:gamma-ops',
      'agent:delta-risk'
    ],
    maxCoalitionSize: 3,
    topK: 5
  });

  console.log('=== Pre-Negotiation Collaboration Recommendations ===');
  recommendationReport.recommendations.forEach((item, index) => {
    console.log(
      `${index + 1}. [${item.agents.join(', ')}] impact=${item.predictedCollectiveImpact.toFixed(3)} ` +
      `success=${item.predictedSuccessScore.toFixed(3)} economics=${item.predictedEconomicScore.toFixed(3)} ` +
      `synergy=${item.predictedSynergyScore.toFixed(3)} confidence=${item.confidence.toFixed(3)}`
    );
  });
}

runRecommendationDemo().catch(console.error);

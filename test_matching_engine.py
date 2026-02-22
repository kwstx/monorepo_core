import unittest
from cooperative_context_model import CooperativeContextModel, DomainImpactType
from cooperative_intelligence import CooperativeIntelligenceVector
from matching_engine import MatchingEngine

class TestMatchingEngine(unittest.TestCase):
    def setUp(self):
        self.engine = MatchingEngine()
        
        # Define a high-impact, low-tolerance task
        self.task_complex = CooperativeContextModel.encode_task(
            impact_domain=DomainImpactType.ECONOMIC,
            capabilities={"logic": 0.5, "strategy": 0.5},
            causal_depth=5,
            risk_threshold=0.1,  # Low uncertainty tolerance
            horizon=10.0
        )

    def test_alignment_scoring_prioritizes_reliability(self):
        # Agent A: Perfect skills but low reliability/consistency
        agent_a = CooperativeIntelligenceVector(
            agent_id="unreliable_expert",
            predictive_calibration_reliability=0.2,
            marginal_cooperative_influence_consistency=0.3,
            cross_role_integration_depth=0.5,
            capability_profile={"logic": 1.0, "strategy": 1.0}
        )
        
        # Agent B: Good skills and high reliability/consistency
        agent_b = CooperativeIntelligenceVector(
            agent_id="reliable_collaborator",
            predictive_calibration_reliability=0.9,
            marginal_cooperative_influence_consistency=0.9,
            cross_role_integration_depth=0.7,
            capability_profile={"logic": 0.7, "strategy": 0.7}
        )
        
        score_a = self.engine.score_agent_alignment(self.task_complex, agent_a)
        score_b = self.engine.score_agent_alignment(self.task_complex, agent_b)
        
        # Agent B should score higher despite slightly lower capability match
        # because the task is high depth and low tolerance.
        self.assertGreater(score_b, score_a)
        print(f"Agent A score: {score_a}, Agent B score: {score_b}")

    def test_ranking_logic(self):
        agent_list = [
            CooperativeIntelligenceVector("A", 0.5, 0.5, 0.5, {"logic": 0.5, "strategy": 0.5}),
            CooperativeIntelligenceVector("B", 0.9, 0.9, 0.9, {"logic": 0.9, "strategy": 0.9}),
            CooperativeIntelligenceVector("C", 0.1, 0.1, 0.1, {"logic": 1.0, "strategy": 1.0})
        ]
        
        rankings = self.engine.rank_agents(self.task_complex, agent_list)
        self.assertEqual(rankings[0][0], "B") # Best reliability + skills
        self.assertEqual(len(rankings), 3)

if __name__ == "__main__":
    unittest.main()

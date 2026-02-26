import unittest
from task_formation.cooperative_context_model import CooperativeContextModel, DomainImpactType
from task_formation.cooperative_intelligence import CooperativeIntelligenceVector, TemporalImpactMemory
from task_formation.matching_engine import MatchingEngine


class TestMatchingEngine(unittest.TestCase):
    def setUp(self):
        self.engine = MatchingEngine()

        # Define a high-impact, low-tolerance task
        self.task_complex = CooperativeContextModel.encode_task(
            impact_domain=DomainImpactType.ECONOMIC,
            capabilities={"logic": 0.5, "strategy": 0.5},
            causal_depth=5,
            risk_threshold=0.1,  # Low uncertainty tolerance
            horizon=10.0,
        )

    def test_alignment_scoring_prioritizes_reliability(self):
        # Agent A: Perfect skills but low reliability/consistency
        agent_a = CooperativeIntelligenceVector(
            agent_id="unreliable_expert",
            predictive_calibration_reliability=0.2,
            marginal_cooperative_influence_consistency=0.3,
            cross_role_integration_depth=0.5,
            capability_profile={"logic": 1.0, "strategy": 1.0},
        )

        # Agent B: Good skills and high reliability/consistency
        agent_b = CooperativeIntelligenceVector(
            agent_id="reliable_collaborator",
            predictive_calibration_reliability=0.9,
            marginal_cooperative_influence_consistency=0.9,
            cross_role_integration_depth=0.7,
            capability_profile={"logic": 0.7, "strategy": 0.7},
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
            CooperativeIntelligenceVector("C", 0.1, 0.1, 0.1, {"logic": 1.0, "strategy": 1.0}),
        ]

        rankings = self.engine.rank_agents(self.task_complex, agent_list)
        self.assertEqual(rankings[0][0], "B")  # Best reliability + skills
        self.assertEqual(len(rankings), 3)

    def test_temporal_memory_boosts_delayed_contributors_for_deep_chains(self):
        deep_chain_task = CooperativeContextModel.encode_task(
            impact_domain=DomainImpactType.SYNERGETIC,
            capabilities={"logic": 0.6, "strategy": 0.4},
            causal_depth=9,
            risk_threshold=0.2,
            horizon=14.0,
        )

        delayed_impact_agent = CooperativeIntelligenceVector(
            agent_id="delayed_impact",
            predictive_calibration_reliability=0.72,
            marginal_cooperative_influence_consistency=0.76,
            cross_role_integration_depth=0.68,
            capability_profile={"logic": 0.65, "strategy": 0.55},
            temporal_impact_memory=TemporalImpactMemory(
                delayed_outcome_realization_rate=0.98,
                long_horizon_causal_contribution=0.95,
                median_impact_latency=11.0,
            ),
        )

        short_term_agent = CooperativeIntelligenceVector(
            agent_id="short_term",
            predictive_calibration_reliability=0.74,
            marginal_cooperative_influence_consistency=0.75,
            cross_role_integration_depth=0.68,
            capability_profile={"logic": 0.67, "strategy": 0.58},
            temporal_impact_memory=TemporalImpactMemory(
                delayed_outcome_realization_rate=0.10,
                long_horizon_causal_contribution=0.08,
                median_impact_latency=1.0,
            ),
        )

        delayed_score = self.engine.score_agent_alignment(deep_chain_task, delayed_impact_agent)
        short_term_score = self.engine.score_agent_alignment(deep_chain_task, short_term_agent)

        self.assertGreater(delayed_score, short_term_score)

    def test_temporal_memory_has_limited_effect_on_shallow_tasks(self):
        shallow_task = CooperativeContextModel.encode_task(
            impact_domain=DomainImpactType.TECHNICAL,
            capabilities={"logic": 0.6, "strategy": 0.4},
            causal_depth=1,
            risk_threshold=0.2,
            horizon=1.5,
        )

        delayed_impact_agent = CooperativeIntelligenceVector(
            agent_id="delayed_impact",
            predictive_calibration_reliability=0.72,
            marginal_cooperative_influence_consistency=0.76,
            cross_role_integration_depth=0.68,
            capability_profile={"logic": 0.65, "strategy": 0.55},
            temporal_impact_memory=TemporalImpactMemory(
                delayed_outcome_realization_rate=0.98,
                long_horizon_causal_contribution=0.95,
                median_impact_latency=11.0,
            ),
        )

        short_term_agent = CooperativeIntelligenceVector(
            agent_id="short_term",
            predictive_calibration_reliability=0.74,
            marginal_cooperative_influence_consistency=0.75,
            cross_role_integration_depth=0.68,
            capability_profile={"logic": 0.67, "strategy": 0.58},
            temporal_impact_memory=TemporalImpactMemory(
                delayed_outcome_realization_rate=0.10,
                long_horizon_causal_contribution=0.08,
                median_impact_latency=1.0,
            ),
        )

        delayed_score = self.engine.score_agent_alignment(shallow_task, delayed_impact_agent)
        short_term_score = self.engine.score_agent_alignment(shallow_task, short_term_agent)

        # Shallow tasks should not strongly favor delayed-impact memory alone.
        self.assertLess(abs(delayed_score - short_term_score), 0.08)


if __name__ == "__main__":
    unittest.main()

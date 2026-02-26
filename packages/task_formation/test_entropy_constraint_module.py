import unittest
import math
from entropy_constraint_module import EntropyConstraintModule, TeamCandidate

class TestEntropyConstraintModule(unittest.TestCase):
    def setUp(self):
        # Initialize with low threshold to trigger adjustments easily in tests
        self.module = EntropyConstraintModule(
            variance_threshold=0.001, 
            entropy_weight=1.0, 
            min_diversity_ratio=0.95
        )

    def test_no_adjustment_if_balanced(self):
        # Two teams, disjoint agents, equal synergy
        candidates = [
            TeamCandidate("T1", ("A", "B"), 10.0, {"A": 5.0, "B": 5.0}),
            TeamCandidate("T2", ("C", "D"), 10.0, {"C": 5.0, "D": 5.0})
        ]
        base_probs = [0.5, 0.5]
        
        adjusted = self.module.adjust_candidate_probabilities(candidates, base_probs)
        
        # Should remain mostly the same (perfectly balanced)
        self.assertAlmostEqual(adjusted[0], 0.5, places=5)
        self.assertAlmostEqual(adjusted[1], 0.5, places=5)

    def test_adjustment_triggers_on_concentration(self):
        # Agent 'A' is in every team and has high influence.
        # Team 1 is Agent A + B
        # Team 2 is Agent A + C
        # Agent A will have very high aggregate influence.
        candidates = [
            TeamCandidate("T1", ("A", "B"), 10.0, {"A": 9.0, "B": 1.0}),
            TeamCandidate("T2", ("A", "C"), 10.0, {"A": 9.0, "C": 1.0})
        ]
        base_probs = [0.5, 0.5]
        
        # Initially, aggregate influence: A=9, B=0.5, C=0.5
        # Total = 10. Shares: A=0.9, B=0.05, C=0.05.
        # Fair share = 0.33. A is way over.
        
        # Let's add a more diverse team
        candidates.append(TeamCandidate("T3", ("B", "C"), 10.0, {"B": 5.0, "C": 5.0}))
        base_probs = [0.4, 0.4, 0.2]
        
        adjusted = self.module.adjust_candidate_probabilities(candidates, base_probs)
        
        # The probability of T3 should increase relative to T1 and T2 
        # because T3 helps balance the influence (reduces Agent A's dominance).
        # Note: in this specific implementation, it dampens T1 and T2.
        
        # Ratio after adjustment
        ratio_t1_t3_before = base_probs[0] / base_probs[2] # 0.4 / 0.2 = 2.0
        ratio_t1_t3_after = adjusted[0] / adjusted[2]
        
        self.assertLess(ratio_t1_t3_after, ratio_t1_t3_before)
        print(f"Original probs: {base_probs}")
        print(f"Adjusted probs: {adjusted}")

    def test_metrics_calculation(self):
        influence = {"A": 10.0, "B": 10.0}
        metrics = self.module.calculate_metrics(influence)
        
        # Variance of [10, 10] is 0
        self.assertEqual(metrics["variance"], 0.0)
        # Entropy of [0.5, 0.5] is 1.0 bit
        self.assertEqual(metrics["entropy"], 1.0)
        self.assertEqual(metrics["max_entropy"], 1.0)
        self.assertEqual(metrics["diversity_ratio"], 1.0)

    def test_high_variance_concentration(self):
        # One high influence agent, one low.
        influence = {"A": 100.0, "B": 1.0}
        metrics = self.module.calculate_metrics(influence)
        
        # Variance should be high
        self.assertGreater(metrics["variance"], 1000.0)
        # Diversity ratio should be low (far from uniform)
        self.assertLess(metrics["diversity_ratio"], 0.5)

if __name__ == "__main__":
    unittest.main()

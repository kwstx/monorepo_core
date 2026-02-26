import sys
import os
import unittest

# Load cross-module components
from shared_utils.logger import get_logger
from actionable_logic.enforcement.engine import PolicyEnforcer
from simulation_layer.simulation.policy_simulator import PolicyInjectionSimulator
from task_formation.team_optimizer import TeamOptimizer


logger = get_logger("IntegrationTest")

class TestSystemIntegrity(unittest.TestCase):
    def test_shared_utilities_availability(self):
        """Verify that shared Python utilities are importable and functional."""
        logger.info("Verifying shared utilities...")
        self.assertIsNotNone(logger)
        logger.debug("Debug log test")

    def test_actionable_logic_enforcement(self):
        """Verify the PolicyEnforcer from actionable_logic."""
        logger.info("Testing PolicyEnforcer...")
        enforcer = PolicyEnforcer([])
        self.assertEqual(len(enforcer.policies), 0)
        # Verify basic evaluation works
        res = enforcer.evaluate({"cpu": 50})
        self.assertTrue(isinstance(res, list))

    def test_simulation_layer_core(self):
        """Verify the PolicyInjectionSimulator from simulation_layer."""
        logger.info("Testing PolicyInjectionSimulator...")
        from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
        dummy_state = CooperativeStateSnapshot(simulation_id="test-sim", capture_step=0, trust_vectors=[], metadata=[])

        simulator = PolicyInjectionSimulator(dummy_state)
        self.assertIsNotNone(simulator)

    def test_cross_module_flow(self):
        """Verify a logical flow across different Python modules."""
        logger.info("Testing cross-module integrity flow...")
        # Step 1: Logic check
        enforcer = PolicyEnforcer([])
        # Step 2: Simulation setup
        from simulation_layer.models.cooperative_state_snapshot import CooperativeStateSnapshot
        dummy_state = CooperativeStateSnapshot(simulation_id="test-sim", capture_step=0, trust_vectors=[], metadata=[])

        simulator = PolicyInjectionSimulator(dummy_state)
        
        self.assertTrue(True, "Basic instantiation of modules succeeded")


if __name__ == "__main__":
    unittest.main()

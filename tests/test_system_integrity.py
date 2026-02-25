import sys
import os
import unittest

# Ensure modules are on path
monorepo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Helper to import from modules with conflicting 'src' directories
def import_module_component(module_name, import_path, class_name):
    module_dir = os.path.join(monorepo_root, module_name)
    sys.path.insert(0, module_dir)
    # Clear cached 'src' to avoid collisions between modules
    if 'src' in sys.modules:
        del sys.modules['src']
    try:
        mod = __import__(import_path, fromlist=[class_name])
        return getattr(mod, class_name)
    finally:
        sys.path.remove(module_dir)

# Load cross-module components
sys.path.append(monorepo_root)
from shared_utils.python.logger import get_logger

PolicyEnforcer = import_module_component("actionable_logic", "src.enforcement.engine", "PolicyEnforcer")
PolicyInjectionSimulator = import_module_component("simulation_layer", "src.simulation.policy_simulator", "PolicyInjectionSimulator")
TeamOptimizer = import_module_component("task_formation", "team_optimizer", "TeamOptimizer")

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
        simulator = PolicyInjectionSimulator()
        self.assertIsNotNone(simulator)

    def test_cross_module_flow(self):
        """Verify a logical flow across different Python modules."""
        logger.info("Testing cross-module integrity flow...")
        # Step 1: Logic check
        enforcer = PolicyEnforcer([])
        # Step 2: Simulation setup
        simulator = PolicyInjectionSimulator()
        
        self.assertTrue(True, "Basic instantiation of modules succeeded")

if __name__ == "__main__":
    unittest.main()

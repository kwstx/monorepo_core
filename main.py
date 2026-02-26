"""
Central Orchestration Script for the Agent Infrastructure Monorepo.

This script supports:
1. Importing and running Python logic (actionable_logic, simulation_layer, task_formation).
2. Launching TypeScript services as subprocesses (identity_system, economic_autonomy, etc.).
"""

import os
import sys
import subprocess
from shared_utils.logger import get_logger

logger = get_logger("Orchestrator")

def run_python_demo(module_name, script_path):
    """Runs a Python script within its own environment to preserve its internal imports."""
    logger.info(f"--- Running {module_name} Demo ---")
    # Point to the new location in packages/
    module_dir = os.path.abspath(os.path.join("packages", module_name))
    if not os.path.isdir(module_dir):
        logger.error(f"Module directory not found: {module_dir}")
        return
    
    # Many demos are in a 'tests' or subfolder
    full_script_path = os.path.join(module_dir, script_path)
    if not os.path.exists(full_script_path):
        # Try looking in 'tests'
        full_script_path = os.path.join(module_dir, "tests", script_path)
    
    if os.path.exists(full_script_path):
        subprocess.run([sys.executable, full_script_path], cwd=module_dir)
    else:
        logger.error(f"Script not found: {script_path} in {module_dir}")

def main():
    logger.info("Agent Infrastructure Monorepo - System Orchestration")
    
    # Option 1: Run Python Logic Demos
    # Now that we have editable installs, we could import them directly,
    # but some demos are designed to run as standalone scripts.
    run_python_demo("task_formation", "test_team_optimizer.py")

    
    # Option 2: Infrastructure Status (Mocked/Bridged)
    logger.info("Checking TypeScript Infrastructure Status...")
    logger.info("[Identity System] - Standby (Run 'npm install' in identity_system to activate)")
    logger.info("[Economic Autonomy] - Standby (Port 3000)")

    print("\nTo start all services simultaneously, run: python orchestrate.py")

if __name__ == "__main__":
    main()

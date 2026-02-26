import subprocess
import time
import requests
import unittest
import os
import signal

class TestSystemHealth(unittest.TestCase):
    """
    Integration test that starts the monorepo services and verifies they respond to health checks.
    """
    @classmethod
    def setUpClass(cls):
        print("\n[Setup] Starting orchestrator...")
        env = os.environ.copy()
        cls.orchestrator = subprocess.Popen(
            ["python", "orchestrate.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid if os.name != 'nt' else None,
            env=env
        )
        # Give services time to boot
        time.sleep(20)

    @classmethod
    def tearDownClass(cls):
        print("\n[Teardown] Stopping orchestrator...")
        if os.name == 'nt':
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(cls.orchestrator.pid)])
        else:
            os.killpg(os.getpgid(cls.orchestrator.pid), signal.SIGTERM)

    def test_python_api_health(self):
        """Verify Actionable Logic API is up on port 8000."""
        print("Checking Actionable Logic API...")
        try:
            response = requests.get("http://127.0.0.1:8000/")
            self.assertEqual(response.status_code, 200)
            self.assertIn("PolicyAPI", response.json()["message"])
        except Exception as e:
            # If failed, dump logs
            print(f"Error: {e}")
            for log_file in ["apps/actionable_logic_service.log", "apps/a2a_coordination_service.log", "apps/economic_autonomy_service.log"]:
                if os.path.exists(log_file):
                    print(f"\n--- {log_file} ---")
                    with open(log_file, "r") as f:
                        print(f.read())
            self.fail(f"Actionable Logic API failed: {e}")

    def test_ts_api_health(self):
        """Verify Economic Autonomy API is up on port 3000."""
        print("Checking Economic Autonomy API...")
        try:
            # We need to wait a bit longer for TS compilation if it's slow
            response = requests.get("http://127.0.0.1:3000/budget/test-agent")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "success")
        except Exception as e:
            # If failed, dump logs
            print(f"Error: {e}")
            for log_file in ["apps/actionable_logic_service.log", "apps/a2a_coordination_service.log", "apps/economic_autonomy_service.log"]:
                if os.path.exists(log_file):
                    print(f"\n--- {log_file} ---")
                    with open(log_file, "r") as f:
                        print(f.read())
            self.fail(f"Economic Autonomy API failed: {e}")

if __name__ == "__main__":
    unittest.main()

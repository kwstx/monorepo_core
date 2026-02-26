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
        cls.orchestrator = subprocess.Popen(
            ["python", "orchestrate.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid if os.name != 'nt' else None
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
            response = requests.get("http://localhost:8000/")
            self.assertEqual(response.status_code, 200)
            self.assertIn("PolicyAPI", response.json()["message"])
        except Exception as e:
            self.fail(f"Actionable Logic API failed: {e}")

    def test_ts_api_health(self):
        """Verify Economic Autonomy API is up on port 3000."""
        print("Checking Economic Autonomy API...")
        try:
            # We need to wait a bit longer for TS compilation if it's slow
            response = requests.get("http://localhost:3000/budget/test-agent")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "success")
        except Exception as e:
            self.fail(f"Economic Autonomy API failed: {e}")

if __name__ == "__main__":
    unittest.main()

import sys
import subprocess
import time
import os
from shared_utils.python.logger import get_logger

logger = get_logger("MonorepoOrchestrator")

def start_python_service(path, port):
    """Starts a FastAPI service using uvicorn."""
    logger.info(f"Starting Python service at {path} on port {port}...")
    return subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "src.api.main:app", "--port", str(port)],
        cwd=os.path.abspath(path),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

def start_ts_service(path, command, port=None):
    """Starts a TypeScript service using npm."""
    env = os.environ.copy()
    if port:
        env["PORT"] = str(port)
    
    logger.info(f"Starting TypeScript service at {path} with command '{command}' on port {port}...")
    return subprocess.Popen(
        ["npm", "run", command],
        cwd=os.path.abspath(path),
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env
    )

def main():
    logger.info("Initializing Agent Infrastructure Monorepo Stack...")
    
    services = []
    try:
        # Python Services (FastAPI)
        services.append(start_python_service("actionable_logic", 8000))
        # Note: simulation_layer and task_formation APIs would be started similarly
        
        # TypeScript Services (Express/Node)
        # Port assignments to avoid conflicts:
        # 3000: Economic Autonomy (Expected by health test)
        # 3001: A2A Coordination
        services.append(start_ts_service("a2a_coordination", "start", port=3001))
        services.append(start_ts_service("economic_autonomy", "start:api", port=3000))
        
        logger.info("All services are starting up. Press Ctrl+C to shut down.")
        
        while True:
            time.sleep(1)
            # Check if any service has died
            for proc in services:
                if proc.poll() is not None:
                    out, err = proc.communicate()
                    logger.error(f"Service died with exit code {proc.returncode}")
                    logger.error(f"STDOUT: {out}")
                    logger.error(f"STDERR: {err}")
                    return

    except KeyboardInterrupt:
        logger.info("Shutting down services...")
        for proc in services:
            proc.terminate()
        logger.info("System offline.")

if __name__ == "__main__":
    # Ensure dependencies are available
    # Run this from the root of the monorepo
    main()

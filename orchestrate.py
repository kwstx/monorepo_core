import sys
import subprocess
import time
import os
from shared_utils.logger import get_logger

logger = get_logger("MonorepoOrchestrator")

def start_python_service(path, port):
    """Starts a FastAPI service using uvicorn."""
    logger.info(f"Starting Python service at {path} on port {port}...")
    log_file = open(f"{path}.log", "w")
    env = os.environ.copy()
    cmd = f"{sys.executable} -m uvicorn src.main:app --port {port} --host 127.0.0.1"
    return subprocess.Popen(
        cmd,
        cwd=os.path.abspath(path),
        shell=True,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True,
        env=env
    ), log_file

def start_ts_service(path, command, port=None):
    """Starts a TypeScript service using npm."""
    env = os.environ.copy()
    if port:
        env["PORT"] = str(port)
    
    logger.info(f"Starting TypeScript service at {path} with command '{command}' on port {port}...")
    log_file = open(f"{path}.log", "w")
    
    # On Linux, shell=True with a list doesn't work as expected.
    # We use a string for the command when shell=True is used for cross-platform compatibility.
    cmd = f"npm run {command}"
    
    return subprocess.Popen(
        cmd,
        cwd=os.path.abspath(path),
        shell=True,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True,
        env=env
    ), log_file

def main():
    logger.info("Initializing Agent Infrastructure Monorepo Stack...")
    
    services = []
    log_files = []
    try:
        # --- New Event-Driven Service Mesh ---
        # Identity System Subscriber (TS)
        p4, f4 = start_ts_service("packages/identity_system", "start:subscriber")
        services.append(p4)
        log_files.append(f4)

        # Enforcement Layer Subscriber (TS)
        p5, f5 = start_ts_service("packages/enforcement_layer", "start:subscriber")
        services.append(p5)
        log_files.append(f5)

        # Simulation Layer Subscriber (Python)
        # We start it as a direct module run
        logger.info("Starting Simulation Layer Subscriber (Python)...")
        log_f6 = open("packages/simulation_layer/subscriber.log", "w")
        p6 = subprocess.Popen(
            [sys.executable, "-m", "simulation_layer.subscriber"],
            cwd=os.path.abspath("packages/simulation_layer"),
            stdout=log_f6,
            stderr=subprocess.STDOUT,
            text=True
        )
        services.append(p6)
        log_files.append(log_f6)

        logger.info("Event-driven Safety Loop Active (Identity -> Enforcement -> Simulation)")
        logger.info("All services are starting up. Press Ctrl+C to shut down.")
        
        while True:
            time.sleep(1)
            # Check if any service has died
            for i, proc in enumerate(services):
                if proc.poll() is not None:
                    logger.error(f"Service at index {i} died with exit code {proc.returncode}")
                    # Briefly read the end of the log file for this service
                    try:
                        with open(log_files[i].name, "r") as f:
                            lines = f.readlines()
                            logger.error(f"Last 10 lines of log ({log_files[i].name}):")
                            for line in lines[-10:]:
                                logger.error(f"  {line.strip()}")
                    except Exception:
                        pass
                    return

    except KeyboardInterrupt:
        logger.info("Shutting down services...")
    finally:
        for proc in services:
            proc.terminate()
        for f in log_files:
            f.close()
        logger.info("System offline.")

if __name__ == "__main__":
    # Ensure dependencies are available
    # Run this from the root of the monorepo
    main()

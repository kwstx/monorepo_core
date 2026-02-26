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
        # Python Services (FastAPI)
        p1, f1 = start_python_service("apps/actionable_logic_service", 8000)
        services.append(p1)
        log_files.append(f1)
        
        # TypeScript Services (Express/Node)
        # Port assignments to avoid conflicts:
        # 3000: Economic Autonomy (Expected by health test)
        # 3001: A2A Coordination
        p2, f2 = start_ts_service("apps/a2a_coordination_service", "start", port=3001)
        services.append(p2)
        log_files.append(f2)
        
        p3, f3 = start_ts_service("apps/economic_autonomy_service", "start", port=3000)
        services.append(p3)
        log_files.append(f3)
        
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

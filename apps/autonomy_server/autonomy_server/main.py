from __future__ import annotations

import os

import uvicorn


def run() -> None:
    host = os.getenv("AUTONOMY_SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("AUTONOMY_SERVER_PORT", "8001"))
    uvicorn.run("autonomy_server.app:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()

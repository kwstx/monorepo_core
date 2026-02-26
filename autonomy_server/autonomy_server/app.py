from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from autonomy_sdk import AutonomySDK

app = FastAPI(title="Autonomy Server")
sdk = AutonomySDK()

class AuthRequest(BaseModel):
    agent_id: str
    action: dict

@app.post("/authorize")
async def authorize(request: AuthRequest):
    """
    Endpoint to authorize an action for an agent.
    """
    try:
        is_authorized = sdk.check_authorization(request.agent_id, request.action)
        return {"authorized": is_authorized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "healthy"}

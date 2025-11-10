import json
import os
import uuid
from typing import Optional
from fastapi import FastAPI
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from dotenv import load_dotenv
import uvicorn
import logging

from agents.agent import build_root_agent
from models.schemas import AddressInput

load_dotenv() 
app = FastAPI(title="Solar Calculation API", version="1.0.0")
APP_NAME = "agents"
USER_ID = "user"


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

session_service = InMemorySessionService()

@app.api_route("/", methods=["POST", "GET"], summary="Run agent pipeline")
async def run_agents(input_data: Optional[AddressInput] = None):
    """Run the agent pipeline (POST with JSON body or GET fallback).

    - POST: pass an AddressInput JSON.
    - GET: no body; sample payload is used.
    - Each invocation uses a unique session id to avoid AlreadyExistsError.
    """
    SESSION_ID = str(uuid.uuid4()) 

    # Create a fresh session for this request
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=SESSION_ID,
    )
    
    # Use provided input or fallback sample
    payload = input_data.model_dump() if input_data else {
        "latitude": 10.809107,
        "longitude": 106.705638,
        "address": "122/46/11 bùi đình tý phường 12 quận bình thạnh tp hồ chí minh",
    }
    
    root_agent = build_root_agent(lat=payload.get("latitude"), lon=payload.get("longitude"))
    
    # Initialize Runner with the session service
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service,
    )
    
    content = types.Content(parts=[types.Part(text=json.dumps(payload))])
    
    session.state["latitude"] = payload.get("latitude")
    session.state["longitude"] = payload.get("longitude")
    session.state["address"] = payload.get("address")

    final_response_text = "Agent did not produce a final response."

    # Stream agent responses asynchronously
    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=SESSION_ID,
        new_message=content,
    ):
        if event.is_final_response():
            if getattr(event, "content", None) and event.content.parts:
                final_response_text = event.content.parts[0].text
            elif getattr(event, "actions", None) and event.actions.escalate:
                final_response_text = f"Agent escalated: {event.error_message or 'No specific message.'}"
            logger.info(f"<<< Final Agent Response: {final_response_text}")

    return {"message": "OK", "response": final_response_text}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 3001)))
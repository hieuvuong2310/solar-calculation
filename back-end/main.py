import json
from fastapi import FastAPI
from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types
from dotenv import load_dotenv

from agents.agent import root_agent

load_dotenv() 
app = FastAPI(title="Solar Calculation API", version="1.0.0")

session_service = InMemorySessionService()


@app.get("/")
async def root():
    APP_NAME = "agents"
    USER_ID = "user"
    SESSION_ID = "session"
    
    # Create a session
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
        session_id=SESSION_ID,
    )

    # Initialize Runner with the session, not the service
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service,
    )

    # Input for the agent
    input_data = {
        "latitude": 10.809107,
        "longitude": 106.705638,
        "address": "122/46/11 bùi đình tý phường 12 quận bình thạnh tp hồ chí minh"
    }
    content = types.Content(parts=[types.Part(text=json.dumps(input_data))])

    final_response_text = "Agent did not produce a final response."

    # Stream agent responses asynchronously
    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=SESSION_ID,
        new_message=content
    ):
        if event.is_final_response():
            if getattr(event, "content", None) and event.content.parts:
                final_response_text = event.content.parts[0].text
            elif getattr(event, "actions", None) and event.actions.escalate:
                final_response_text = f"Agent escalated: {event.error_message or 'No specific message.'}"
            print(f"<<< Final Agent Response: {final_response_text}")
    return {"message": "API is running", "response": final_response_text}

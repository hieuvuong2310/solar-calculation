from agent_kit import Agent
from tools import get_solar_potential_data # Import tool from the centralized tools/__init__.py
import agents.subagents.solar_data.prompt as prompts # Relative import for prompt
import google.generativeai as genai
from config import GOOGLE_API_KEY

genai.configure(api_key=GOOGLE_API_KEY)
llm = genai.GenerativeModel('gemini-1.5-flash')

@Agent(
    llm=llm,
    tools=[get_solar_potential_data],
    system_instruction=prompts.SYSTEM_INSTRUCTIONS
)
class SolarDataAgent:
    def run(self, latitude: float, longitude: float) -> dict:
        """Executes the task to fetch solar potential data."""
        # The agent's LLM will decide to call the tool based on the prompt.
        # For simplicity in this example, we'll directly call the tool here,
        # but in a full ADK execution, agent.run() would handle the tool orchestration.
        return get_solar_potential_data(latitude=latitude, longitude=longitude)
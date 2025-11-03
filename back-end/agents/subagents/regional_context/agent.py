from google.adk.agents import LlmAgent
from google.adk.tools import google_search, google_maps_grounding

from . import prompt

regional_context_agent = LlmAgent(
        name="regional_context_agent",
        description="Agent to determine regional identifiers from geographic coordinates.",
        model="gemini-2.0-flash",
        tools=[google_search, google_maps_grounding],
        instruction=prompt.TASK_PROMPT
)
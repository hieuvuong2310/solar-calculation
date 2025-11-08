from google.adk.agents import Agent, SequentialAgent
from google.adk.tools import google_search, google_maps_grounding

from . import prompt

regional_context_search_agent = Agent(
        name="regional_context_search_agent",
        description="Agent to determine regional identifiers from geographic coordinates.",
        model="gemini-2.0-flash",
        tools=[google_search, google_maps_grounding],
        instruction=prompt.TASK_PROMPT,
        output_key="regional_identifiers",
)

currency_code_setter = Agent(
        name="currency_code_setter",
        description="Agent to set currency code.",
        model="gemini-2.0-flash",
        instruction="Extract and return only the currency code as a string from {regional_identifiers}.",
        output_key="currency_code",
)

regional_context_agent = SequentialAgent(
    name="regional_context_agent",
    sub_agents=[regional_context_search_agent, currency_code_setter],
)
from google.adk import Agent
from google.adk.tools import google_search

from models.schemas import EnergyUsage
from . import prompt

typical_energy_usage_agent = Agent(
    name="typical_energy_usage_agent",
    description="Agent to find the average monthly electricity usage for a given region and building type.",
    model="gemini-2.0-flash",
    tools=[google_search],
    instruction=prompt.USAGE_SEARCH_PROMPT,
    output_key="typical_energy_usage",
)

energy_setter = Agent(
    name="energy_setter",
    description="Agent to set the energy usage value.",
    model="gemini-2.0-flash",
    instruction="Extract and return only the numerical energy usage in kWh/month from {typical_energy_usage}.",
    output_key="energy_kWh",
    output_schema=EnergyUsage,
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)
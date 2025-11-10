from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext
from google.adk.agents.readonly_context import ReadonlyContext
from . import solar_api
from . import prompt

def _find_insights_tool(tool_context: ToolContext):
	"""Fetch insights using latitude/longitude from session state."""

	state = tool_context.session.state
	lat = state.get("latitude")
	lon = state.get("longitude")
	return solar_api.get_solar_insights(lat, lon)


def _find_insights_and_exit_tool(tool_context: ToolContext):
	"""Fetch insights (session state) and escalate loop when a solarPotential object is present."""
	state = tool_context.session.state
	lat = state.get("latitude")
	lon = state.get("longitude")
	insights = solar_api.get_solar_insights(lat, lon)
	# Escalate when the response looks like buildingInsights with solarPotential
	if insights and isinstance(insights, dict) and insights.get("solarPotential"):
		tool_context.actions.escalate = True
	# Always return the tool output verbatim (or {} if None)
	return insights or {}

fetch_solar_insights_agent_1 = Agent(
	name="fetch_solar_insights_agent_1",
	description="Fetch solar potential for initial coordinates from session state",
	model="gemini-2.0-flash",
	instruction=prompt.FETCH_SOLAR_INSIGHTS_INSTRUCTIONS_1,
	output_key="solar_building_insights",
	tools=[_find_insights_tool],
)

fetch_solar_insights_agent_2 = Agent(
	name="fetch_solar_insights_agent_2",
	description="Iterative fetch; escalates loop when coverage is achieved",
	model="gemini-2.0-flash",
	instruction=prompt.FETCH_SOLAR_INSIGHTS_INSTRUCTIONS_2,
	output_key="solar_building_insights",
	tools=[_find_insights_and_exit_tool],
)

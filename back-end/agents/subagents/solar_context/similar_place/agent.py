from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext
from . import prompt
from models.schemas import ProxyLocation

solar_coverage_similarity_agent = Agent(
    name="solar_coverage_similarity_agent",
    description="Suggest nearby or climatologically similar locations likely covered by Google Solar API.",
    model="gemini-2.5-flash",
    instruction=prompt.FIND_SIMILAR_PLACES_INSTRUCTIONS,
    output_key="solar_proxy_location",
    output_schema=ProxyLocation,
)

def _apply_proxy_coordinates(tool_context: ToolContext):
    """Apply proxy lat/lon from session state to be used in next loop iteration."""
    state = tool_context.session.state
    proxy = state.get("solar_proxy_location") or {}
    state["latitude"] = float(proxy.get("proxy_latitude"))
    state["longitude"] = float(proxy.get("proxy_longitude"))

proxy_coordinate_setter_agent = Agent(
	name="proxy_coordinate_setter_agent",
	description="Apply proxy lat/lon to session state for next loop iteration.",
	model="gemini-2.0-flash-lite",
	tools=[_apply_proxy_coordinates],
	instruction="Call the tool (no arguments) to update session state with proxy coordinates if available",
)
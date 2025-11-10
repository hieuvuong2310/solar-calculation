import logging
from typing import AsyncGenerator
from google.adk.agents import BaseAgent, LoopAgent, Agent, SequentialAgent
from pydantic import PrivateAttr
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from typing_extensions import override

from agents.subagents.solar_context.solar_insights.agent import (
	fetch_solar_insights_agent_1,
	fetch_solar_insights_agent_2,
)
from agents.subagents.solar_context.similar_place.agent import (
	solar_coverage_similarity_agent,
    proxy_coordinate_setter_agent,
)

logger = logging.getLogger(__name__)


class SolarContextAgent(BaseAgent):
	"""Fetch raw buildingInsights JSON; if no solarPotential, find proxy and retry.

	Updated semantics (no synthetic coverage_status from API):
	1. Initial fetch (store raw JSON under solar_building_insights).
	2. If JSON contains solarPotential -> done.
	3. Else run similarity + proxy setter.
	4. Refetch; if solarPotential now present and proxy was used -> annotate FALLBACK info.
	5. Pass-through setter preserves raw JSON; only adds proxy_location/FALLBACK if applicable.
	"""

	model_config = {"arbitrary_types_allowed": True, "extra": "allow"}
	loop_agent: LoopAgent
	seq_agent: SequentialAgent
	_lat: float = PrivateAttr()
	_lon: float = PrivateAttr()

	def __init__(self, name: str, lat: float, lon: float):
		# Include a proxy coordinate setter inside the loop so subsequent iterations use proxy lat/lon
		seq_agent = SequentialAgent(
            name="solar_initial_sequence",
            sub_agents=[solar_coverage_similarity_agent, proxy_coordinate_setter_agent],
        )
		loop_agent = LoopAgent(
			name="solar_finalization_loop",
			sub_agents=[
                seq_agent,
				fetch_solar_insights_agent_2,
			],
			max_iterations=4,
		)
		super().__init__(name=name, loop_agent=loop_agent, seq_agent=seq_agent)
		# Store coordinates as private attrs (pydantic-safe)
		self._lat = lat
		self._lon = lon

	@override
	async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
		logger.info(f"[{self.name}] Starting solar coverage workflow")
		ctx.session.state["latitude"] = self._lat
		ctx.session.state["longitude"] = self._lon
		print(f"[{self.name}] Set initial lat={self._lat}, lon={self._lon}")

        # First attempt outside the loop
		async for event in fetch_solar_insights_agent_1.run_async(ctx):
			yield event
		first = ctx.session.state.get("solar_building_insights") or {}
		if isinstance(first, dict) and first.get("solarPotential"):
			logger.info(f"[{self.name}] solarPotential present on first attempt; normalizing.") 

			return

		# Loop until coverage is achieved 
		async for event in self.loop_agent.run_async(ctx):
			yield event
		insights = ctx.session.state.get("solar_building_insights") or {}
		proxy = ctx.session.state.get("solar_proxy_location")
		if isinstance(insights, dict) and insights.get("solarPotential"):
			# Annotate fallback metadata without altering core solarPotential payload
			insights["fallback_used"] = True
			ctx.session.state["solar_building_insights"] = insights




from google.adk.agents import SequentialAgent, ParallelAgent
from .subagents.regional_context.agent import regional_context_agent
from .subagents.financial_context.agent import energy_billing_agent
from .subagents.solar_context.agent import SolarContextAgent
from .subagents.solar_calculator.agent import solar_monthly_bill_calculator_agent, solar_potential_setter


def build_root_agent(lat: float, lon: float):
    """Factory to build a root agent graph with a SolarContextAgent seeded with lat/lon.

    This allows per-request dynamic coordinates instead of a static global instance.
    """
    solar_context_agent = SolarContextAgent(name="solar_context_agent", lat=lat, lon=lon)

    search_data_agent = ParallelAgent(
        name="search_data_agent",
        sub_agents=[
            energy_billing_agent,
            solar_context_agent,
        ]
    )
    return SequentialAgent(
        name='root_agent',
        sub_agents=[
            regional_context_agent,
            search_data_agent,
            solar_potential_setter,
            solar_monthly_bill_calculator_agent,
        ]
    )
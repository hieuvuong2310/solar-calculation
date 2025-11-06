from google.adk.agents import SequentialAgent
from .electricity_rate.agent import electricity_rate_agent, usd_converted_electricity_rates_agent, conversion_rate_agent

financial_context_agent = SequentialAgent(
    name="financial_context_agent",
    sub_agents=[electricity_rate_agent, conversion_rate_agent, usd_converted_electricity_rates_agent],
)
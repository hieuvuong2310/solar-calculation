from google.adk.agents import SequentialAgent
from .subagents.regional_context.agent import regional_context_agent

root_agent = SequentialAgent(
    name='root_agent',
    sub_agents=[
        regional_context_agent,
        # solar_data_agent,
        # financial_context_agent,
        # financial_calculator_agent,
        # report_synthesis_agent,
    ]
)
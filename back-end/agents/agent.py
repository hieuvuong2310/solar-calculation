from google.adk.agents import SequentialAgent
from .subagents.regional_context.agent import regional_context_agent
from .subagents.financial_context.agent import energy_billing_agent

root_agent = SequentialAgent(
    name='root_agent',
    sub_agents=[
        regional_context_agent,
        energy_billing_agent,
    ]
)
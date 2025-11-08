from google.adk.agents import Agent, BaseAgent, SequentialAgent, ParallelAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from typing import AsyncGenerator, override
import json
from .helper import total_monthly_cost
from .electricity_rate.agent import (
    electricity_rate_agent,
    conversion_rate_agent,
    usd_converted_electricity_rates_agent,
    usd_electricity_rates_setter
)
from .typical_usage.agent import (
    typical_energy_usage_agent,
    energy_setter,
)

class EnergyBillingAgent(BaseAgent):
    final_agent: ParallelAgent

    model_config = {"arbitrary_types_allowed": True}
    def __init__(
        self,
        name: str,
        electricity_rate_agent: Agent,
        conversion_rate_agent: Agent,
        usd_converted_electricity_rates_agent: Agent,
        usd_electricity_rates_setter: Agent,
        typical_energy_usage_agent: Agent,
        energy_setter: Agent
    ):
        sequential_agent = SequentialAgent(
            name="get_usd_converted_rates",
            sub_agents=[
                electricity_rate_agent,
                conversion_rate_agent,
                usd_converted_electricity_rates_agent,
                usd_electricity_rates_setter,
            ],
        )
        
        sequential_agent2 = SequentialAgent(
            name="set_typical_energy_usage",
            sub_agents=[typical_energy_usage_agent, energy_setter],
        )
        
        final_agent = ParallelAgent(
            name="gather_financial_data",
            sub_agents=[sequential_agent, sequential_agent2],
        )
        
        super().__init__(
            name=name,
            final_agent=final_agent,
        )

    @override
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        """
        Implements the custom orchestration logic.
        1. Runs the agents.
        2. Parses their JSON outputs from the session state.
        3. Calculates the average expense.
        4. Stores the result back in the session state.
        """
        print(f"[{self.name}] Starting financial context workflow.")
        
        async for event in self.final_agent.run_async(ctx):
            yield event
            
        usd_rates = ctx.session.state.get("usd_electricity_rates")
        typical_usage = ctx.session.state.get("energy_kWh")

        try:
            average_monthly_expense_usd = total_monthly_cost(usd_rates, typical_usage)

            ctx.session.state['average_monthly_expense_usd'] = round(average_monthly_expense_usd, 2)

        except (json.JSONDecodeError, TypeError, ValueError) as e:
            print(f"[{self.name}] Error processing financial data: {e}")
            ctx.session.state['error'] = "Failed to calculate average expense."
            ctx.session.state['average_monthly_expense_usd'] = 0.0
        print(f"[{self.name}] Calculated average monthly expense: {ctx.session.state.get('average_monthly_expense_usd')}")
       
energy_billing_agent = EnergyBillingAgent(
    name="energy_billing_agent",
    electricity_rate_agent=electricity_rate_agent,
    conversion_rate_agent=conversion_rate_agent,
    usd_converted_electricity_rates_agent=usd_converted_electricity_rates_agent,
    usd_electricity_rates_setter=usd_electricity_rates_setter,
    typical_energy_usage_agent=typical_energy_usage_agent,
    energy_setter=energy_setter,
)
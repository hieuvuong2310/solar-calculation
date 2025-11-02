from agent_kit import Agent
from tools import get_electricity_rate, get_average_usage, calculate_financials
import agents.subagents.financial_data.prompt as prompts
import google.generativeai as genai
from config import GOOGLE_API_KEY

genai.configure(api_key=GOOGLE_API_KEY)
llm = genai.GenerativeModel('gemini-1.5-flash')

@Agent(
    llm=llm,
    tools=[get_electricity_rate, get_average_usage, calculate_financials],
    system_instruction=prompts.SYSTEM_INSTRUCTIONS
)
class FinancialDataAgent:
    def run(self, city_state_zip: str, peak_power_kW: float, annual_solar_production_kWh: float) -> dict:
        """Executes the task to gather financial data and perform calculations."""
        # The agent's LLM would orchestrate these tool calls based on the prompt.
        # For demonstration, we'll manually call tools.
        electricity_rate = get_electricity_rate(city_state_zip=city_state_zip)
        city_state = " ".join(city_state_zip.split(", ")[:2]) # Basic extraction for usage tool
        monthly_usage = get_average_usage(city_state=city_state)

        financial_metrics = calculate_financials(
            peak_power_kW=peak_power_kW,
            annual_solar_production_kWh=annual_solar_production_kWh,
            electricity_rate_cents_per_kWh=electricity_rate,
            monthly_usage_kWh=monthly_usage
        )

        return {
            "electricity_rate_cents_per_kWh": electricity_rate,
            "monthly_usage_kWh": monthly_usage,
            "financial_analysis": financial_metrics
        }
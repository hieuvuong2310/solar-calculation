from agent_kit import Agent
import prompts.solar_report_manager_prompts as prompts # Use manager's own prompt file
import google.generativeai as genai
from config import GOOGLE_API_KEY
from models.schemas import SolarReportData

# Import sub-agents directly from their granular paths
from agents.subagents.solar_data.agent import SolarDataAgent
from agents.subagents.financial_data.agent import FinancialDataAgent
from agents.subagents.report_synthesis.agent import ReportSynthesisAgent

genai.configure(api_key=GOOGLE_API_KEY)
llm = genai.GenerativeModel('gemini-1.5-pro')

@Agent(
    llm=llm,
    tools=[], # No direct tools, it delegates
    system_instruction=prompts.SYSTEM_INSTRUCTIONS
)
class SolarReportManager:
    def __init__(self):
        self.solar_data_agent = SolarDataAgent()
        self.financial_data_agent = FinancialDataAgent()
        self.report_synthesis_agent = ReportSynthesisAgent()
        self.report_data = {}

    def run_analysis(self, address: str, latitude: float, longitude: float) -> SolarReportData:
        self.report_data["address"] = address
        self.report_data["coordinates"] = {"latitude": latitude, "longitude": longitude}

        # Extract city_state_zip for sub-agents (assuming address format still includes it)
        # This will need to be robust for various address formats.
        # For a simple example, let's assume "Street, City, State ZIP"
        address_parts = [part.strip() for part in address.split(',')]
        if len(address_parts) >= 3:
            city_state_zip = f"{address_parts[-2]}, {address_parts[-1]}"
            city_state = address_parts[-2] # For usage tool
        else: # Fallback if address format is too simple
            city_state_zip = "Unknown City, State ZIP"
            city_state = "Unknown City, State"


        # Step 1: Delegate to SolarDataAgent
        solar_potential_data = self.solar_data_agent.run(latitude=latitude, longitude=longitude)
        self.report_data["solar_potential"] = solar_potential_data

        # Step 2: Delegate to FinancialDataAgent
        financial_context_data = self.financial_data_agent.run(
            city_state_zip=city_state_zip,
            peak_power_kW=solar_potential_data['peak_power_kW'],
            # Annual solar production for financial calculation based on typical capacity factor
            annual_solar_production_kWh=solar_potential_data['peak_power_kW'] * 8760 * 0.15 # Using a simplified calc here, or pass sunlight_hours for more accuracy
        )
        self.report_data.update(financial_context_data)

        # Step 3: Delegate to ReportSynthesisAgent
        synthesis_output = self.report_synthesis_agent.run(report_data=self.report_data)
        self.report_data.update(synthesis_output)

        return SolarReportData(**self.report_data)

solar_report_manager = SolarReportManager()
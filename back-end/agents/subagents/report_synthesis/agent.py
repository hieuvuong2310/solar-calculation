from agent_kit import Agent
import agents.subagents.report_synthesis.prompt as prompts
import google.generativeai as genai
from config import GOOGLE_API_KEY

genai.configure(api_key=GOOGLE_API_KEY)
llm = genai.GenerativeModel('gemini-1.5-pro')

@Agent(
    llm=llm,
    system_instruction=prompts.SYSTEM_INSTRUCTIONS
)
class ReportSynthesisAgent:
    def run(self, report_data: dict) -> dict:
        """Generates a human-readable summary and recommendations."""
        formatted_prompt = prompts.TASK_PROMPT.format(
            address=report_data['address'],
            latitude=report_data['coordinates']['latitude'],
            longitude=report_data['coordinates']['longitude'],
            usable_roof_area_sq_m=report_data['solar_potential']['usable_roof_area_sq_m'],
            sunlight_hours_per_year=report_data['solar_potential']['sunlight_hours_per_year'],
            peak_power_kW=report_data['solar_potential']['peak_power_kW'],
            electricity_rate_cents_per_kWh=report_data['electricity_rate_cents_per_kWh'],
            monthly_usage_kWh=report_data['monthly_usage_kWh'],
            recommended_system_size_kW=report_data['financial_analysis']['recommended_system_size_kW'],
            annual_solar_production_kWh=report_data['financial_analysis']['annual_solar_production_kWh'],
            annual_savings_usd=report_data['financial_analysis']['annual_savings_usd'],
            payback_period_years=report_data['financial_analysis']['payback_period_years'],
            initial_investment_usd=report_data['financial_analysis']['initial_investment_usd'],
            roi_percentage=report_data['financial_analysis']['roi_percentage']
        )
        response = self.llm.generate_content(formatted_prompt)

        summary_text = response.text
        summary = summary_text.split("Recommendations:")[0].strip() if "Recommendations:" in summary_text else summary_text
        recommendations = summary_text.split("Recommendations:")[-1].strip() if "Recommendations:" in summary_text else "No specific recommendations provided."

        return {"summary": summary, "recommendations": recommendations}
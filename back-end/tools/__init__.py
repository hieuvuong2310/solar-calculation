from agent_kit import Tool
from tools.solar_api_client import SolarAPIClient
from tools.electricity_rate_tool import get_electricity_rate as get_elec_rate_func
from tools.usage_profile_tool import get_average_usage as get_avg_usage_func
from tools.financial_calculator import calculate_financial_metrics

# Initialize client instances
solar_api_client = SolarAPIClient()

@Tool
def get_solar_potential_data(latitude: float, longitude: float) -> dict:
    """Retrieves detailed solar potential data for a given latitude and longitude using Google Solar API."""
    return solar_api_client.get_solar_data(latitude, longitude).model_dump()

@Tool
def get_electricity_rate(city_state_zip: str) -> float:
    """Finds the average residential electricity price in cents per kWh for a given area."""
    return get_elec_rate_func(city_state_zip)

@Tool
def get_average_usage(city_state: str) -> float:
    """Estimates the average monthly electricity consumption in kWh for a single-family home."""
    return get_avg_usage_func(city_state)

@Tool
def calculate_financials(
    peak_power_kW: float,
    annual_solar_production_kWh: float,
    electricity_rate_cents_per_kWh: float,
    monthly_usage_kWh: float
) -> dict:
    """Calculates estimated financial savings, system size, and payback period."""
    return calculate_financial_metrics(
        peak_power_kW=peak_power_kW,
        annual_solar_production_kWh=annual_solar_production_kWh,
        electricity_rate_cents_per_kWh=electricity_rate_cents_per_kWh,
        monthly_usage_kWh=monthly_usage_kWh
    ).model_dump()
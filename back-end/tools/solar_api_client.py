import requests
from config import GOOGLE_API_KEY
from models.schema import SolarPotential

class SolarAPIClient:
    def __init__(self):
        self.api_key = GOOGLE_API_KEY
        self.base_url = "https://solar.googleapis.com/v1/buildingInsights:findClosest"

    def get_solar_data(self, latitude: float, longitude: float) -> SolarPotential:
        params = {
            "location.latitude": latitude,
            "location.longitude": longitude,
            "key": self.api_key
        }
        response = requests.get(self.base_url, params=params)
        response.raise_for_status()
        data = response.json()

        try:
            solar_info = data.get("solarPotential", {})
            return SolarPotential(
                usable_roof_area_sq_m=solar_info.get("roofAreaSqM", 0.0),
                sunlight_hours_per_year=solar_info.get("sunlightHoursAnnual", 0.0),
                carbon_offset_kg=solar_info.get("carbonOffsetKgAnnual", 0.0),
                peak_power_kW=solar_info.get("maxArraySizeKw", 0.0)
            )
        except KeyError as e:
            raise ValueError(f"Failed to parse Solar API response: Missing key {e}")
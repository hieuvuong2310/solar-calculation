import os
import requests
from typing import Optional
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SolarAPIClient:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv("GOOGLE_SOLAR_KEY", "")
        self.base_url = "https://solar.googleapis.com/v1/buildingInsights:findClosest"

    def call_api(self, latitude: float, longitude: float) -> Optional[dict]:
        params = {
            "location.latitude": latitude,
            "location.longitude": longitude,
            "key": self.api_key,
            "experiments": "EXPANDED_COVERAGE",
            "requiredQuality": "BASE",
        }
        try:
            resp = requests.get(self.base_url, params=params, timeout=15)
            
            # If outside coverage, API may return 4xx
            if not resp.ok:
                return None
            return resp.json()
        except requests.RequestException as e:
            return None

def get_solar_insights(latitude: float, longitude: float) -> dict:
    
    client = SolarAPIClient()
    return client.call_api(latitude, longitude)
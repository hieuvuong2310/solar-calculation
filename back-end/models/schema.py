from pydantic import BaseModel
from typing import Optional, Dict, Any

class AddressInput(BaseModel):
    address: str
    latitude: float
    longitude: float

class AnalysisRequestResponse(BaseModel):
    message: str
    report_id: str

class SolarPotential(BaseModel):
    usable_roof_area_sq_m: float
    sunlight_hours_per_year: float
    carbon_offset_kg: float
    peak_power_kW: float

class FinancialAnalysis(BaseModel):
    recommended_system_size_kW: float
    annual_solar_production_kWh: float
    annual_savings_usd: float
    payback_period_years: float
    initial_investment_usd: float # Assuming rough estimate
    roi_percentage: float

class SolarReportData(BaseModel):
    address: str
    coordinates: Dict[str, float]
    solar_potential: SolarPotential
    electricity_rate_cents_per_kWh: float
    monthly_usage_kWh: float
    financial_analysis: FinancialAnalysis
    summary: str
    recommendations: str

class ReportStatus(BaseModel):
    status: str # "in_progress", "completed", "failed"
    message: Optional[str] = None
    report_id: str
    data: Optional[SolarReportData] = None
    error_details: Optional[str] = None
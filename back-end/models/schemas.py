from pydantic import BaseModel
from typing import List, Literal, Optional, Dict, Any

class AddressInput(BaseModel):
    address: str
    latitude: float
    longitude: float

class RegionalIdentifiers(BaseModel):
    building_type: Optional[str] = None
    neighborhood: Optional[str] = None
    regional_level_1: Optional[str] = None
    regional_level_2: Optional[str] = None
    city: Optional[str] = None
    county_or_province: Optional[str] = None
    state_or_region: Optional[str] = None
    country: str
    country_code: str 
    currency_code: str
    currency_name: str
    
class Tier(BaseModel):
    start_kWh: float = None
    end_kWh: float = None
    price_per_kWh: float = None
    price_per_kWh_usd: float

class TOUPeriod(BaseModel):
    period_name: str
    start_hour: int
    end_hour: int
    price_per_kWh: float = None
    price_per_kWh_usd: float

class DemandCharge(BaseModel):
    name: str
    price_per_kW_usd: float

class AdditionalFee(BaseModel):
    name: str
    amount_usd: float
    unit: Literal["kWh", "month"]
    
class USDConvertedElectricityRatePlan(BaseModel):
    plan_type: Literal["flat", "tiered", "tou", "demand", "hybrid"]
    plan_name: Optional[str] = None
    utility_name: Optional[str] = None
    currency_code: Optional[str] = None 
    unit: Literal["kWh"] = "kWh"

    price_per_kWh_usd: Optional[float] = None
    tiers: Optional[List[Tier]] = None
    tou_periods: Optional[List[TOUPeriod]] = None
    demand_charges: Optional[List[DemandCharge]] = None
    fixed_monthly_fee_usd: Optional[float] = None
    additional_fees: Optional[List[AdditionalFee]] = None

    effective_date: Optional[str] = None 
    source_url: Optional[str] = None
    notes: Optional[str] = None
    
class EnergyUsage(BaseModel):
    energy_kWh: float
    source_url: str = None

class ProxyLocation(BaseModel):
    proxy_location_name: str
    proxy_latitude: float
    proxy_longitude: float
    reasoning: str
    
class SolarPanelConfig(BaseModel):
    panelsCount: Optional[int] = None
    yearlyEnergyDcKwh: Optional[float] = None

class SolarPotential(BaseModel):
    maxArrayPanelsCount: Optional[int] = None
    maxSunshineHoursPerYear: Optional[float] = None
    panelCapacityWatts: Optional[int] = None
    solarPanelConfigs: Optional[List[SolarPanelConfig]] = None

class FinalAnalysis(BaseModel):
    typical_energy_monthly_used_kWh: float
    monthly_bill_before_solar_usd: float
    monthly_bill_after_solar_usd: float
    monthly_savings_usd: float
    percentage_savings: float
    
    proxy_location: Optional[ProxyLocation] = None
    electricity_rate_plan: Optional[USDConvertedElectricityRatePlan] = None
    
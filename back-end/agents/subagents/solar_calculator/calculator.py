from typing import Dict, Any, Optional

DC_TO_AC_DERATE = 0.85  # minimal constant per guidance
DEFAULT_PANEL_WATTS = 400.0  # fallback if panelCapacityWatts absent
PERFORMANCE_RATIO = 0.75  # used only if synthesizing a config


def calculate_monthly_bill_with_solar(
	solar_potential: Dict[str, Any],
	*,
	monthly_bill_usd: Optional[float],
	monthly_kwh_energy_consumption: Optional[float],
) -> Dict[str, Any]:
	"""Compute minimal monthly bill impact of solar.

	Required inputs:
	  - solar_potential: dict with optional keys:
		  solarPanelConfigs: list[{panelsCount, yearlyEnergyDcKwh}]
		  maxArrayPanelsCount, maxSunshineHoursPerYear, panelCapacityWatts (optional)
	  - monthly_bill_usd (float)
	  - monthly_kwh_energy_consumption (float)

	Algorithm:
	  price_per_kWh = monthly_bill_usd / monthly_kwh_energy_consumption
	  annual_consumption = monthly_kwh_energy_consumption * 12
	  For each config:
		  initialAc = yearlyEnergyDcKwh * DC_TO_AC_DERATE
		  remainingAnnual = max(0, annual_consumption - initialAc)
		  annualBillAfterSolar = remainingAnnual * price_per_kWh
		  monthlyBillWithSolar = annualBillAfterSolar / 12
	  If no configs present, synthesize ONE using maxArrayPanelsCount * (panelCapacityWatts or default) * maxSunshineHoursPerYear / 1000 * PERFORMANCE_RATIO
	"""
	if monthly_bill_usd is None or not monthly_kwh_energy_consumption:
		return {
			"error": "Missing monthly bill or usage",
			"have_monthly_bill": monthly_bill_usd is not None,
			"have_monthly_kwh": monthly_kwh_energy_consumption is not None and monthly_kwh_energy_consumption > 0,
		}

	price_per_kwh = float(monthly_bill_usd) / float(monthly_kwh_energy_consumption)
	annual_consumption = float(monthly_kwh_energy_consumption) * 12.0

	configs = []
	raw_configs = solar_potential.get("solarPanelConfigs")
	if isinstance(raw_configs, list):
		for c in raw_configs:
			pc = c.get("panelsCount")
			yd = c.get("yearlyEnergyDcKwh")
			if pc is None or yd is None:
				continue
			configs.append({"panelsCount": pc, "yearlyEnergyDcKwh": yd})

	synthetic_used = False
	if not configs:
		max_panels = solar_potential.get("maxArrayPanelsCount")
		sunshine = solar_potential.get("maxSunshineHoursPerYear")
		if isinstance(max_panels, (int, float)) and isinstance(sunshine, (int, float)):
			panel_watts = solar_potential.get("panelCapacityWatts")
			if not isinstance(panel_watts, (int, float)):
				panel_watts = DEFAULT_PANEL_WATTS
			yearly_dc = float(max_panels) * float(panel_watts) * float(sunshine) / 1000.0 * PERFORMANCE_RATIO
			configs.append({
				"panelsCount": int(max_panels),
				"yearlyEnergyDcKwh": yearly_dc,
				"synthetic": True,
			})
			synthetic_used = True
		else:
			return {
				"error": "No usable configs and cannot synthesize",
				"have_maxArrayPanelsCount": isinstance(max_panels, (int, float)),
				"have_maxSunshineHoursPerYear": isinstance(sunshine, (int, float)),
			}

	per_config = []
	for c in configs:
		yearly_dc = float(c["yearlyEnergyDcKwh"])
		initial_ac = yearly_dc * DC_TO_AC_DERATE
		remaining_annual = max(0.0, annual_consumption - initial_ac)
		annual_bill_after = remaining_annual * price_per_kwh
		monthly_after = annual_bill_after / 12.0
		record = {
			"panelsCount": c["panelsCount"],
			"yearlyEnergyDcKwh": yearly_dc,
			"initialAcKwhPerYear": initial_ac,
			"monthlyBillWithSolarUsd": monthly_after,
		}
		if c.get("synthetic"):
			record["synthetic"] = True
		per_config.append(record)

	recommended = min(per_config, key=lambda r: r["monthlyBillWithSolarUsd"]) if per_config else None

	return {
		"monthly_bill_baseline_usd": float(monthly_bill_usd),
		"monthly_kwh_consumption": float(monthly_kwh_energy_consumption),
		"price_per_kWh_usd": price_per_kwh,
		"dc_to_ac_derate": DC_TO_AC_DERATE,
		"synthetic_config_used": synthetic_used,
		"per_config": per_config,
		"recommended": recommended,
	}


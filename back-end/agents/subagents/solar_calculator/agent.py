from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext

from models.schemas import SolarPotential
from .calculator import calculate_monthly_bill_with_solar

solar_potential_setter = Agent(
	name="solar_potential_setter",
	description="Extract only the minimal solar potential fields needed for billing calculations.",
	model="gemini-2.0-flash-lite",
	instruction=(
		"From {solar_building_insights}, extract the solarPotential object and return a JSON with ONLY these keys: "
		"maxArrayPanelsCount, maxSunshineHoursPerYear, panelCapacityWatts (if present), and solarPanelConfigs (array of objects each with panelsCount and yearlyEnergyDcKwh). "
		"If a key is missing, set it to null. Do not include any other fields. Return only the JSON object."
	),
	output_key="solar_potentials",
	output_schema=SolarPotential,
	disallow_transfer_to_parent=True,
	disallow_transfer_to_peers=True,
)

def _monthly_bill_with_solar_tool(
	solar_potential: dict,
    average_monthly_expense_usd: float,
    energy_kWh: float,
	tool_context: ToolContext):
	"""Simplified signature for automatic function calling.
	Parameters:
	  solarPotential: raw solarPotential object extracted by the model.
	  average_monthly_expense_usd: numeric monthly bill in USD.
	  energy_kWh: numeric monthly usage in kWh (already normalized; if not, we coerce below).
	"""
	monthly_bill = average_monthly_expense_usd
	usage = energy_kWh
	# Defensive coercion if accidentally passed as dict/string
	if isinstance(usage, dict):
		usage = usage.get("energy_kWh")
	elif isinstance(usage, str):
		try:
			usage = float(usage.strip())
		except ValueError:
			usage = 0.0
	if usage is None:
		usage = 0.0
	result = calculate_monthly_bill_with_solar(
		solar_potential,
		monthly_bill_usd=monthly_bill,
		monthly_kwh_energy_consumption=usage,
	)
	tool_context.session.state["solar_monthly_bill_analysis"] = result
	return result

solar_monthly_bill_calculator_agent = Agent(
	name="solar_monthly_bill_agent",
	description="Calculate monthly post-solar bill and generate a persuasive benefits paragraph.",
	model="gemini-2.5-flash",
	instruction=(
		"Call the tool with {solar_potentials}, {average_monthly_expense_usd}, and {energy_kWh} to compute the post-solar monthly bill. Then return ONLY a single persuasive paragraph (plain text, no JSON, no markdown) convincing a homeowner of the benefits of installing solar panels based on these figures: baseline monthly bill, post-solar monthly bill, monthly savings, percentage savings, and recommended panelsCount (if present). Keep it factual, optimistic, and end with a concise call to action. Return ONLY the paragraph."
	),
	output_key="solar_monthly_bill_analysis",
	tools=[_monthly_bill_with_solar_tool],
)


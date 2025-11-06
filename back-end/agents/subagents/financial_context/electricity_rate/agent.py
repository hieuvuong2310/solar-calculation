import json
from google.adk.agents import LlmAgent, Agent
from google.adk.tools import google_search

from . import prompt

electricity_rate_agent = LlmAgent(
    name="electricity_rate_agent",
    description="Agent to find electricity rates at various regional levels",
    model="gemini-2.0-flash",
    tools=[google_search],
    instruction=prompt.RATE_SEARCH_PROMPT,
    output_key="local_electricity_rates",
)

conversion_rate_agent = Agent(
    name="conversion_rate_agent",
    description="Agent to find currency conversion rates to USD.",
    model="gemini-2.0-flash",
    instruction=prompt.CONVERSION_RATE_SEARCH_PROMPT,
    output_key="conversion_rate",
)

def convert_plan_to_usd(plan: dict, conversion_rate: float) -> dict:
    out = json.loads(json.dumps(plan)) 
    def mul(x):
        try:
            return None if x is None else float(x) * float(conversion_rate)
        except Exception:
            return None

    if "price_per_kWh" in out:
        out["price_per_kWh_usd"] = mul(out.get("price_per_kWh"))

    for t in (out.get("tiers") or []):
        if isinstance(t, dict):
            t["price_per_kWh_usd"] = mul(t.get("price_per_kWh"))

    for p in (out.get("tou_periods") or []):
        if isinstance(p, dict):
            p["price_per_kWh_usd"] = mul(p.get("price_per_kWh"))

    for d in (out.get("demand_charges") or []):
        if isinstance(d, dict):
            d["price_per_kW_usd"] = mul(d.get("price_per_kW"))

    if "fixed_monthly_fee" in out:
        out["fixed_monthly_fee_usd"] = mul(out.get("fixed_monthly_fee"))

    for f in (out.get("additional_fees") or []):
        if isinstance(f, dict):
            f["amount_usd"] = mul(f.get("amount"))

    return out


usd_converted_electricity_rates_agent = Agent(
    name="usd_converted_electricity_rates_agent",
    description="Agent to convert electricity rates to USD.",
    model="gemini-2.0-flash",
    tools=[convert_plan_to_usd],
    instruction=prompt.CURRENCY_CONVERSION_PROMPT,
    output_key="usd_electricity_rates",
)


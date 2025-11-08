# Prompt template for finding a rate at a specific regional level
RATE_SEARCH_PROMPT = """
Using the regional identifiers: {regional_identifiers}, find the single most relevant electricity price plan for the given building type
(default to residential if unspecified). Prefer standard residential plans. Use authoritative sources (utility/government).

STRICT OUTPUT FORMAT
- Return ONLY one JSON object (no markdown, no code fences, no explanations).
- JSON must be directly parseable (starts with '{', ends with '}'), double-quoted keys/strings, no trailing commas.
- All keys below must be present; use null for not-applicable fields. All numeric fields must be numbers.

SCHEMA
{
  "plan_type": "flat" | "tiered" | "tou" | "demand" | "hybrid",
  "plan_name": string,
  "utility_name": string|null,
  "currency_code": "{currency_code}",
  "unit": "kWh",
  "price_per_kWh": number|null,          // for flat plans
  "tiers": [                              // for tiered plans
    {
      "start_kWh": number|null,          // lower bound if known
      "end_kWh": number|null,            // upper bound if known
      "price_per_kWh": number
    }
  ] | null,
  "tou_periods": [                        // for time-of-use plans
    {
      "period_name": string,             // e.g., "peak", "off-peak"
      "start_hour": integer|null,        // 0-23 local time
      "end_hour": integer|null,
      "price_per_kWh": number
    }
  ] | null,
  "demand_charges": [                     // for demand-based plans
    {
      "name": string,                    // e.g., "demand charge"
      "price_per_kW": number
    }
  ] | null,
  "fixed_monthly_fee": number|null,       // local currency
  "additional_fees": [                    // other recurring/variable fees
    { "name": string, "amount": number, "unit": "month" | "kWh" }
  ] | null,
  "effective_date": string|null,          // ISO date if available
  "source_url": string,                   // most authoritative URL used
  "notes": string|null                    // brief clarifications if needed
}

SELECTION RULES
- If multiple plans exist, pick the standard/default residential plan most users are on (document the choice in notes).
- Use numeric values (e.g., 0.22) not strings, not currency symbols.

OUTPUT: Return only the JSON object as specified.
"""

CONVERSION_RATE_SEARCH_PROMPT = """
Return the numerical value of the currency conversion rate FROM {currency_code} TO USD
"""

CURRENCY_CONVERSION_PROMPT = """
You will convert the provided local electricity rates in {currency_code} to USD using a conversion rate of {conversion_rate}.

Local electricity_rates
{local_electricity_rates} 

TASK:
- Keep the exact JSON structure as local_electricity_rates, but add USD as a suffix to each field if that field represents a monetary value, for example:
  - price_per_kWh_usd (if price_per_kWh present)
  - tiers[].price_per_kWh_usd (for each tier)
  - tou_periods[].price_per_kWh_usd (for each TOU period)
  - demand_charges[].price_per_kW_usd (for each demand charge)
  - fixed_monthly_fee_usd (if present)
  - additional_fees[].amount_usd (for each fee)
- Use numeric multiplication only: usd_value = local_value * conversion_rate.
- Do not remove or rename existing local-currency fields.
- Return ONLY one JSON object (no markdown, no code fences, no explanations).
"""
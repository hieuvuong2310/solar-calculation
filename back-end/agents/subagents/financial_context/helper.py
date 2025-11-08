
def compute_flat_plan(plan: dict, monthly_kwh: float) -> float:
    return monthly_kwh * float(plan["price_per_kWh_usd"]) + float(plan.get("fixed_monthly_fee_usd", 0.0))

def compute_tiered_plan(plan: dict, monthly_kwh: float) -> float:
    tiers = plan["tiers"]
    remaining = monthly_kwh
    total = 0.0
    for t in tiers:
        start = t.get("start_kWh")
        end = t.get("end_kWh")
        price = float(t["price_per_kWh_usd"])
        if start is None and end is None:
            energy_used = remaining
        elif start is None and end is not None:
            span = end
            energy_used = min(remaining, span)
        elif start is not None and end is None:
            energy_used = remaining
        else:
            span = end - start
            energy_used = min(remaining, span)
        total += energy_used * price
        remaining -= energy_used
        if remaining <= 0:
            break
    if remaining > 0:
        total += remaining * float(tiers[-1]["price_per_kWh_usd"])
    return total + float(plan.get("fixed_monthly_fee_usd", 0.0))

def compute_tou_plan(plan: dict, monthly_kwh: float) -> float:
    periods = plan["tou_periods"]
    if not periods:
        return 0.0
    # Check if ALL periods have start_hour and end_hour
    all_hours = all(
        p.get("start_hour") is not None and p.get("end_hour") is not None
        for p in periods
    )
    if not all_hours:
        # Simple average (your original logic)
        avg_price = sum(float(p["price_per_kWh_usd"]) for p in periods) / len(periods)
        return monthly_kwh * avg_price + float(plan.get("fixed_monthly_fee_usd", 0.0))

    total_hours = 0.0
    weighted_sum = 0.0
    for p in periods:
        price = float(p["price_per_kWh_usd"])
        sh = int(p["start_hour"])
        eh = int(p["end_hour"])
        span = (eh - sh) % 24
        span = 24.0 if span == 0 else float(span)  # treat same hour as full day
        total_hours += span
        weighted_sum += price * span

    effective_price = weighted_sum / total_hours if total_hours > 0 else 0.0
    return monthly_kwh * effective_price + float(plan.get("fixed_monthly_fee_usd", 0.0))

def compute_hybrid(plan: dict, monthly_kwh: float) -> float:
    if plan.get("tiers"):
        return compute_tiered_plan(plan, monthly_kwh)
    if plan.get("tou_periods"):
        return compute_tou_plan(plan, monthly_kwh)
    return compute_flat_plan(plan, monthly_kwh)

def apply_additional_fees(plan: dict, monthly_kwh: float) -> float:
    fees = plan.get("additional_fees") or []
    total = 0.0
    for f in fees:
        amt = float(f["amount_usd"])
        unit = (f.get("unit") or "").lower()
        total += amt * monthly_kwh if unit == "kwh" else amt
    return total

def total_monthly_cost(plan: dict, monthly_kwh: dict) -> float:
    pt = (plan.get("plan_type")).lower()
    value = monthly_kwh.get("energy_kWh", 0)
    if pt == "flat":
        base = compute_flat_plan(plan, value)
    elif pt == "tiered":
        base = compute_tiered_plan(plan, value)
    elif pt == "tou":
        base = compute_tou_plan(plan, value)
    elif pt == "hybrid":
        base = compute_hybrid(plan, value)
    else:
        base = compute_flat_plan(plan, value)
    return base + apply_additional_fees(plan, value)
# Solar Calculation – Multi-Agent Architecture

## Overview

This service orchestrates several small, focused agents to fetch solar insights, gather local electricity cost context, and compute the post-solar monthly bill for a given location. It exposes a FastAPI endpoint that runs the full pipeline per request with an isolated session.

- Entry point: `main.py` (FastAPI) → builds and runs the agent graph per request
- Agent graph: `agents/agent.py`
- Key sub-agents:
  - Regional context discovery
  - Financial context (rates + typical usage → average monthly bill in USD)
  - Solar context (Google Solar API → buildingInsights → minimal solarPotential)
  - Solar calculator (post-solar monthly bill and a persuasive summary paragraph)

## High-level flow

```text
root_agent (SequentialAgent)
├─ regional_context_agent (SequentialAgent)
│  ├─ regional_context_search_agent (Agent; tools: google_search, google_maps_grounding)
│  └─ currency_code_setter (Agent)
├─ search_data_agent (ParallelAgent)
│  ├─ energy_billing_agent (Custom BaseAgent; runs two sequences in parallel)
│  │  ├─ get_usd_converted_rates (SequentialAgent)
│  │  │  ├─ electricity_rate_agent (Agent; tools: google_search)
│  │  │  ├─ conversion_rate_agent (Agent)
│  │  │  ├─ usd_converted_electricity_rates_agent (Agent; tools: convert_plan_to_usd)
│  │  │  └─ usd_electricity_rates_setter (Agent)
│  │  └─ set_typical_energy_usage (SequentialAgent)
│  │     ├─ typical_energy_usage_agent (Agent; tools: google_search)
│  │     └─ energy_setter (Agent)
│  └─ solar_context_agent (Custom BaseAgent)
│     ├─ fetch_solar_insights_agent_1 (Agent; tool: fetch via lat/lon)
│     └─ solar_finalization_loop (LoopAgent; max_iterations=4)
│        ┌──────────────────────────────────────────────────────────────────────────┐
│        │ solar_initial_sequence (SequentialAgent)                                 │
│        │ ├─ solar_coverage_similarity_agent (Agent)                               │
│        │ └─ proxy_coordinate_setter_agent (Agent; tool: apply proxy lat/lon)      │
│        │                      │                                                   │
│        │                      ▼                                                   │
│        │ fetch_solar_insights_agent_2 (Agent; fetch + escalate on solarPotential) │
│        └───────────────────────────────◄───────────────────────────────────────────┘
└─ solar_potential_setter (Agent) — extracts minimal solarPotential subset
   └─ solar_monthly_bill_agent (Agent; tool: monthly bill calculator) — returns persuasive one-paragraph summary
```

### Flow explanation

The root agent runs sequentially: it first resolves regional context (including currency), then launches a parallel stage where financial and solar context are gathered at the same time. Financial context itself forks into two short sequences (rate plan → USD conversion and typical usage discovery). Once both complete, the orchestrator computes `average_monthly_expense_usd` and stores it in session. In parallel, the solar context attempts an initial Solar API fetch; if the payload lacks `solarPotential`, the loop region engages: each iteration proposes a proxy location, applies its coordinates, and refetches until `solarPotential` appears (escalation) or the iteration limit is reached. After the parallel stage, a minimal `solar_potentials` subset is extracted, the calculator tool computes post-solar monthly bill and savings using those fields plus the financial results, and the final agent returns a single persuasive paragraph as the user-facing summary.
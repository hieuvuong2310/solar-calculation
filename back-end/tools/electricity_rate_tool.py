import google.generativeai as genai
from config import GOOGLE_API_KEY

genai.configure(api_key=GOOGLE_API_KEY)

# This would ideally use Gemini's built-in googleSearch tool for grounding.
# The ADK framework for defining tools might integrate this more cleanly.
# For direct LLM call simulation:
def get_electricity_rate(city_state_zip: str) -> float:
    """
    Finds the average residential electricity price in cents per kWh for a given area.
    This function uses a Gemini model with a simulated Google Search.
    """
    model = genai.GenerativeModel('gemini-1.5-flash') # Or 'gemini-1.5-pro'
    # In a real ADK setup, you'd enable the googleSearch tool for this model
    # model = genai.GenerativeModel('gemini-1.5-flash', tools=[genai.tool(googleSearch)])
    
    # We're manually adding grounding instructions in the prompt for this simulation.
    prompt = f"""
    Find the average residential electricity price in cents per kWh for the area around "{city_state_zip}".
    Prioritize data from government sources like the EIA or local utility providers.
    Return ONLY the numerical value of the rate. If you cannot find a specific rate, estimate a reasonable average for the USA (e.g., 18 cents).
    """
    response = model.generate_content(prompt)
    try:
        # Attempt to parse the first number found in the response
        numeric_value = float(''.join(filter(str.isdigit or str == '.', response.text.strip())))
        # Basic check for reasonableness
        if 5 <= numeric_value <= 50: # Assuming rates are usually between 5 and 50 cents/kWh
            return numeric_value
        else:
            return 18.0 # Default fallback
    except (ValueError, AttributeError):
        print(f"Warning: Could not extract electricity rate from LLM response: '{response.text}'. Using default.")
        return 18.0 # Default fallback if parsing fails or LLM outputs non-numeric
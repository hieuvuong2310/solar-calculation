import google.generativeai as genai
from config import GOOGLE_API_KEY

genai.configure(api_key=GOOGLE_API_KEY)

def get_average_usage(city_state: str) -> float:
    """
    Estimates the average monthly electricity consumption in kWh for a single-family home in a given city and state.
    This function uses a Gemini model with a simulated Google Search.
    """
    model = genai.GenerativeModel('gemini-1.5-flash') # Or 'gemini-1.5-pro'
    # In a real ADK setup, you'd enable the googleSearch tool for this model
    # model = genai.GenerativeModel('gemini-1.5-flash', tools=[genai.tool(googleSearch)])

    prompt = f"""
    Estimate the average monthly electricity consumption in kWh for a single-family home in "{city_state}".
    Return ONLY the numerical value of the consumption. If you cannot find a specific estimate, use a reasonable national average (e.g., 890 kWh).
    """
    response = model.generate_content(prompt)
    try:
        # Attempt to parse the first number found in the response
        numeric_value = float(''.join(filter(str.isdigit or str == '.', response.text.strip())))
        # Basic check for reasonableness
        if 200 <= numeric_value <= 3000: # Assuming usage is usually between 200 and 3000 kWh
            return numeric_value
        else:
            return 890.0 # Default fallback
    except (ValueError, AttributeError):
        print(f"Warning: Could not extract average usage from LLM response: '{response.text}'. Using default.")
        return 890.0 # Default fallback
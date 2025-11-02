from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Solar Calculation API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class CalculationRequest(BaseModel):
    """Solar calculation request model"""
    latitude: float
    longitude: float
    panel_area: Optional[float] = None
    panel_efficiency: Optional[float] = None


class CalculationResponse(BaseModel):
    """Solar calculation response model"""
    result: dict
    message: str


# Health check endpoint
@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {"message": "Solar Calculation API is running", "status": "healthy"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "solar-calculation-backend"}


# Solar calculation endpoint
@app.post("/api/calculate", response_model=CalculationResponse)
async def calculate_solar(data: CalculationRequest):
    """
    Calculate solar energy based on location and panel specifications
    
    Args:
        data: CalculationRequest with location and optional panel specs
        
    Returns:
        CalculationResponse with calculation results
    """
    # Placeholder calculation logic
    # This can be expanded with actual solar calculation formulas
    
    result = {
        "latitude": data.latitude,
        "longitude": data.longitude,
        "panel_area": data.panel_area or 20.0,  # Default 20 m²
        "panel_efficiency": data.panel_efficiency or 0.20,  # Default 20%
    }
    
    # Simple placeholder calculation
    if data.panel_area and data.panel_efficiency:
        estimated_power = data.panel_area * data.panel_efficiency * 1000  # kW
        result["estimated_power_kw"] = round(estimated_power, 2)
    
    return CalculationResponse(
        result=result,
        message="Calculation completed successfully"
    )


@app.get("/api/locations/{location_id}")
async def get_location(location_id: int):
    """Get location-specific solar data"""
    return {
        "location_id": location_id,
        "message": "Location data endpoint - to be implemented"
    }


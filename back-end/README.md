# Solar Calculation Backend

Python backend for solar calculation services using FastAPI.

## Setup

### Local Development

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```

The API will be available at `http://localhost:3001`

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:3001/docs`
- ReDoc: `http://localhost:3001/redoc`

## Endpoints

- `GET /` - Health check
- `GET /health` - Health check endpoint
- `POST /api/calculate` - Calculate solar energy based on location and panel specs
- `GET /api/locations/{location_id}` - Get location-specific solar data

## Docker

The backend can be run using Docker:

```bash
docker-compose up back-end
```

Or build and run separately:

```bash
docker build -t solar-backend ./back-end
docker run -p 3001:3001 solar-backend
```


# Reaction Game — Backend

This is the **FastAPI backend** for the Reaction Game project.  
It generates a 3×3 "Latin square" colour grid and serves it to the frontend via a REST API.

---

## Project Structure

backend/
├─ main.py # FastAPI application entrypoint
├─ logic.py # Colour grid generation logic
└─ venv/ # Local Python virtual environment (do not edit under any circumstance)


---

## Getting Started

### 1. Create and activate a virtual environment

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Windows
# or
source venv/bin/activate  # On macOS

2. Install dependencies

pip install fastapi uvicorn

3. Run the backend server

uvicorn main:app --reload

By default, FastAPI will run at:

    http://127.0.0.1:8000

API Endpoints

GET /grid

Returns a 3×3 grid of colours (Latin square format).

Example response:

{
  "grid": [
    ["red", "green", "blue"],
    ["blue", "red", "green"],
    ["green", "blue", "red"]
  ]
}

(Optional) GET /

Simple health-check endpoint:

{"message": "Backend is running! Visit /grid to get the colour grid."}

CORS Configuration

CORS is enabled for all origins to allow local React development:

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

Tech Stack

    Python 3.12+

    FastAPI (web framework)

    Uvicorn (ASGI server)

Next Steps

    Add /score endpoint to record results

    Store high scores in a simple database (SQLite or JSON)

    Add unit tests for colour generation logic


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

Scores & Leaderboard

POST /score

Records a score attempt.

Body (JSON):

{
  "name": "Alice",
  "score": 7
}

Response:

{
  "ok": true,
  "entry": {"id": "...", "name": "Alice", "score": 7, "timestamp": "2025-01-01T12:00:00+00:00"}
}

GET /highscores?limit=5

Returns the top five scores sorted by score (descending), then by timestamp.
The backend stores at most the top 5 entries and always returns up to 5.
The response is a JSON array of entries:

[
  {"id": "...", "name": "Alice", "score": 9, "timestamp": "..."},
  {"id": "...", "name": "Bob",   "score": 7, "timestamp": "..."}
]

Notes

- Scores are stored in a local JSON file `backend/scores.json`.
- The store retains only the Top 5 entries at any time.
- This is suitable for local development and coursework submission.
- For concurrent multi-user scenarios, a database (e.g. SQLite) is recommended.

DELETE /score/{id}

Deletes a score entry by its id.

Response (on success):

{
  "ok": true,
  "id": "<id>"
}

If the id does not exist, returns 404.

Additional Endpoint

GET /round

Returns a full round payload that includes a grid, a randomly selected target cell, a unique roundId, and an expiresAt timestamp (ISO 8601, UTC). The default expiry is 60 seconds from the time of request.

Example response:

{
  "roundId": "b2a1c0d9e8f74f1a90e1a2b3c4d5e6f7",
  "expiresAt": "2025-01-01T12:00:00+00:00",
  "grid": [
    ["red", "green", "blue"],
    ["blue", "red", "green"],
    ["green", "blue", "red"]
  ],
  "target": {"row": 1, "col": 2, "colour": "green"}
}

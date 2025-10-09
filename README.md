# Reaction Game

A full-stack colour-based reaction game built with **React (frontend)** and **FastAPI (backend)**.  
The player must react quickly to colour prompts within a 3×3 grid — scoring points for each correct click within a time limit.

---

## Project Overview

### Frontend
The React.js frontend displays the interactive 3×3 colour grid, receives colour data from the backend, and tracks the player’s actions and score.

### Backend
The FastAPI backend generates valid 3×3 “Latin square” colour grids (ensuring each colour appears once per row and column) and exposes them via a REST API endpoint.

Together, they form a responsive, interactive game.

---

## Repo Structure

The Reaction Game/
├─ backend/ # FastAPI backend
│ ├─ main.py # API entry point
│ ├─ logic.py # Colour grid generator
│ ├─ venv/ # Local Python environment
│ └─ README.md # Backend-specific docs
│
├─ frontend/ # React frontend (Vite)
│ ├─ src/
│ │ ├─ App.jsx # Main game UI
│ │ ├─ App.css # Component styles
│ │ ├─ main.jsx # App entry point
│ │ └─ index.css # Global CSS reset
│ ├─ package.json
│ ├─ vite.config.js
│ └─ README.md # Frontend-specific docs
│
└─ README.md # This file


---

## Quick Start

### Clone the repository

```bash
git clone https://github.com/yourusername/reaction-game.git
cd "The Reaction Game"

Start the backend

cd backend
python -m venv venv
venv\Scripts\activate        # On Windows
# or
source venv/bin/activate     # On macOS/Linux
pip install fastapi uvicorn
uvicorn main:app --reload

The backend runs at http://127.0.0.1:8000

Test it by visiting:

http://127.0.0.1:8000/grid

Start the frontend

In a new terminal window:

cd frontend
npm install
npm run dev

The frontend runs at http://localhost:5173

It will automatically fetch grid data from the backend API.
 How It Works

    Backend generates a 3×3 Latin-square colour grid using three colours (e.g. red, green, blue).

    Frontend requests this grid via GET /grid and renders it dynamically.

    User interacts with the grid, clicking colours according to prompts.

    (Upcoming) Game timer and scoring system will record correct reactions and save results.

API Reference

GET /grid

Returns a JSON 3×3 colour grid.

Example Response:

{
  "grid": [
    ["red", "blue", "green"],
    ["green", "red", "blue"],
    ["blue", "green", "red"]
  ]
}

Tech Stack

Layer	Technology
Frontend	React.js (Vite)
Styling	CSS / Flexbox / Grid
Backend	FastAPI
Server	Uvicorn
Language	Python 3.12+, JavaScript (ES6+)

Next Development Goals

    Add target prompts (e.g. “Row 2 — Blue”)

    Implement countdown timer and scoring system

    Add /score endpoint and persistent high-score storage

    Refine UI with animations and feedback colours

Author

Freddie Yeo
A-Level Computer Science Coursework — OCR Mock Project
Built using React.js and FastAPI to demonstrate full-stack application design, API communication, and interactive frontend development.

⚠️ Notes

    This project is currently in development mode (allow_origins=["*"] for CORS).
    Restrict allowed origins before deployment.

    Compatible with Python ≥ 3.12 and Node ≥ 18.
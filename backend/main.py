from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from logic import generate_latin_square, create_round
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from score_store import add_score, load_scores, remove_score

app = FastAPI()

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Up to 9 distinct, CSS-safe colours for N×N boards (3 ≤ N ≤ 9)
PALETTE = [
    "red",
    "green",
    "blue",
    "yellow",
    "purple",
    "orange",
    "cyan",
    "magenta",
    "lime",
]


@app.get("/grid")
def get_grid(size: int = Query(3, ge=3, le=9)):
    """Return an N×N Latin-square colour grid (3 ≤ N ≤ 9)."""
    colours = PALETTE[:size]
    grid = generate_latin_square(colours)
    return {"grid": grid}


@app.get("/round")
def get_round(size: int = Query(3, ge=3, le=9)):
    """Return a round payload with grid, target, roundId, and expiresAt for given size."""
    # 60 seconds is a sensible default aligned with upcoming timer work
    colours = PALETTE[:size]
    return create_round(colours=colours, duration_s=60)


@app.get("/")
def home():
    return {"message": "Backend is running! Go to /grid to get the colour grid."}


# --- Scoring & Leaderboard ---

class ScoreSubmission(BaseModel):
    name: str = Field(..., min_length=1, max_length=20)
    score: int = Field(..., ge=0)


class ScoreEntry(BaseModel):
    id: str
    name: str
    score: int
    timestamp: str


@app.post("/score", response_model=Dict[str, Any])
def post_score(payload: ScoreSubmission):
    """Record a score attempt. Returns the stored entry.

    Body: { name: string (1..20), score: non-negative integer }
    """
    name = payload.name.strip()
    entry = add_score(name=name, score=payload.score)
    return {"ok": True, "entry": entry}


@app.get("/highscores", response_model=List[ScoreEntry])
def get_highscores(limit: int = Query(5, ge=1, le=5)):
    """Return the top scores sorted by score desc, then timestamp asc."""
    scores = load_scores()
    # scores are already stored sorted desc by score; enforce and slice defensively
    scores_sorted = sorted(scores, key=lambda e: (-int(e.get("score", 0)), e.get("timestamp", "")))
    return [ScoreEntry(**s) for s in scores_sorted[:limit]]


@app.delete("/score/{score_id}")
def delete_score(score_id: str):
    """Delete a score by id."""
    ok = remove_score(score_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Score not found")
    return {"ok": True, "id": score_id}


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from logic import generate_latin_square, create_round

app = FastAPI()

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

COLOURS = ["red", "green", "blue"]


@app.get("/grid")
def get_grid():
    """Return a 3×3 Latin-square colour grid."""
    grid = generate_latin_square(COLOURS)
    return {"grid": grid}


@app.get("/round")
def get_round():
    """Return a round payload with grid, target, roundId, and expiresAt."""
    # 60 seconds is a sensible default aligned with upcoming timer work
    return create_round(colours=COLOURS, duration_s=60)


@app.get("/")
def home():
    return {"message": "Backend is running! Go to /grid to get the colour grid."}


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random

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
    """Return a 3×3 Latin square colour grid."""
    base = COLOURS.copy()
    random.shuffle(base)
    grid = []
    for i in range(3):
        row = base[i:] + base[:i]   # simple cyclic shift
        grid.append(row)
    return {"grid": grid}

@app.get("/")
def home():
    return {"message": "Backend is running! Go to /grid to get the colour grid."}


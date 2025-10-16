"""Game logic helpers for The Reaction Game.

This module contains pure functions for:
- Generating an N×N Latin-square colour grid
- Selecting a target cell from a grid
- Creating a round payload with identifiers and expiry

It is intentionally free of FastAPI app setup so it can be
reused and tested independently.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any


def generate_latin_square(colours: List[str]) -> List[List[str]]:
    """Generate an N×N Latin-square grid from the given colours.

    - N is inferred from the number of colours provided.
    - Uses a shuffled base row and cyclic shifts to ensure each colour
      appears exactly once per row and once per column.
    """
    n = len(colours)
    if n == 0:
        return []

    base = colours[:]
    random.shuffle(base)

    grid: List[List[str]] = []
    for i in range(n):
        row = base[i:] + base[:i]
        grid.append(row)
    return grid


def choose_target(grid: List[List[str]]) -> Dict[str, Any]:
    """Pick a random cell from the grid and return its coordinates and colour.

    Returns a dict: { "row": int, "col": int, "colour": str }
    """
    if not grid or not grid[0]:
        return {"row": 0, "col": 0, "colour": None}

    rows = len(grid)
    cols = len(grid[0])
    r = random.randrange(rows)
    c = random.randrange(cols)
    return {"row": r, "col": c, "colour": grid[r][c]}


def create_round(*, colours: List[str], duration_s: int = 60) -> Dict[str, Any]:
    """Create a round payload with grid, target, roundId, and expiresAt.

    - colours: list of colour strings to include in the grid.
    - duration_s: seconds until the round expires (for future game logic).
    """
    grid = generate_latin_square(colours)
    target = choose_target(grid)
    round_id = uuid.uuid4().hex
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=duration_s)).isoformat()

    return {
        "roundId": round_id,
        "expiresAt": expires_at,
        "grid": grid,
        "target": target,
    }


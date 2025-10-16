"""Simple JSON-backed score storage for The Reaction Game.

Stores a list of score entries in scores.json located next to this file.
Each entry has: id, name, score, timestamp (ISO 8601, UTC).
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any


TOP_N = 5


_LOCK = threading.Lock()
_DIR = os.path.dirname(__file__)
_PATH = os.path.join(_DIR, "scores.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_file() -> None:
    if not os.path.exists(_PATH):
        with open(_PATH, "w", encoding="utf-8") as f:
            json.dump([], f)


def load_scores() -> List[Dict[str, Any]]:
    _ensure_file()
    with _LOCK:
        with open(_PATH, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                return []
            except json.JSONDecodeError:
                return []


def save_scores(scores: List[Dict[str, Any]]) -> None:
    with _LOCK:
        with open(_PATH, "w", encoding="utf-8") as f:
            json.dump(scores, f, ensure_ascii=False, indent=2)


def add_score(name: str, score: int) -> Dict[str, Any]:
    entry = {
        "id": uuid.uuid4().hex,
        "name": name,
        "score": int(score),
        "timestamp": _now_iso(),
    }
    scores = load_scores()
    scores.append(entry)
    # Keep file ordered (desc by score, then asc by timestamp) and trimmed to TOP_N
    scores.sort(key=lambda e: (-int(e.get("score", 0)), e.get("timestamp", "")))
    scores = scores[:TOP_N]
    save_scores(scores)
    return entry


def remove_score(score_id: str) -> bool:
    """Remove a score by id. Returns True if removed, False if not found."""
    scores = load_scores()
    before = len(scores)
    scores = [s for s in scores if s.get("id") != score_id]
    removed = len(scores) != before
    if removed:
        # Ensure ordering and trimming even after deletion
        scores.sort(key=lambda e: (-int(e.get("score", 0)), e.get("timestamp", "")))
        scores = scores[:TOP_N]
        save_scores(scores)
    return removed

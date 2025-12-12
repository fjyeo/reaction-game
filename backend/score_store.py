"""Simple JSON-backed score storage for The Reaction Game.

Stores a list of score entries in scores.json located next to this file.
Each entry has: id, name, score, size, timestamp (ISO 8601, UTC).
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


def _coerce_size(value: Any) -> int:
    """Clamp and sanitise grid size to the supported 3..9 range."""
    try:
        size = int(value)
    except (TypeError, ValueError):
        size = 3
    return max(3, min(9, size))


def _normalise_entry(raw: Dict[str, Any]) -> Dict[str, Any] | None:
    """Return a normalised score entry dict or None if input is invalid."""
    if not isinstance(raw, dict):
        return None
    try:
        score = int(raw.get("score", 0))
    except (TypeError, ValueError):
        score = 0
    name = str(raw.get("name", "")).strip()
    entry = {
        "id": raw.get("id") or uuid.uuid4().hex,
        "name": name,
        "score": score,
        "size": _coerce_size(raw.get("size", 3)),
        "timestamp": raw.get("timestamp") or _now_iso(),
    }
    return entry


def _trim_scores(scores: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep at most TOP_N scores per board size, sorted desc by score."""
    buckets: Dict[int, List[Dict[str, Any]]] = {}
    for raw in scores:
        entry = _normalise_entry(raw)
        if not entry:
            continue
        size = entry["size"]
        buckets.setdefault(size, []).append(entry)

    trimmed: List[Dict[str, Any]] = []
    for size, entries in buckets.items():
        entries.sort(key=lambda e: (-int(e.get("score", 0)), e.get("timestamp", "")))
        trimmed.extend(entries[:TOP_N])

    # Deterministic file ordering: smallest board sizes first, then by score
    trimmed.sort(
        key=lambda e: (int(e.get("size", 3)), -int(e.get("score", 0)), e.get("timestamp", ""))
    )
    return trimmed


def load_scores() -> List[Dict[str, Any]]:
    _ensure_file()
    with _LOCK:
        with open(_PATH, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if not isinstance(data, list):
                    return []
            except json.JSONDecodeError:
                return []
    normalised: List[Dict[str, Any]] = []
    for raw in data:
        entry = _normalise_entry(raw)
        if entry:
            normalised.append(entry)
    return normalised


def save_scores(scores: List[Dict[str, Any]]) -> None:
    with _LOCK:
        with open(_PATH, "w", encoding="utf-8") as f:
            json.dump(scores, f, ensure_ascii=False, indent=2)


def add_score(name: str, score: int, size: int) -> Dict[str, Any]:
    """Add or update a score for the given board size, keeping one entry per player+size.

    - If the player already has a score, only overwrite when the new score is higher.
    - Otherwise, insert a new entry.
    - Always keep the leaderboard sorted and trimmed to TOP_N per size.
    """
    clean_name = name.strip()
    new_score = int(score)
    board_size = _coerce_size(size)
    scores = load_scores()

    # Partition scores into matches (same name, case-insensitive) and others
    name_key = clean_name.lower()
    matches = [
        s
        for s in scores
        if str(s.get("name", "")).lower() == name_key and _coerce_size(s.get("size", 3)) == board_size
    ]
    others = [
        s
        for s in scores
        if not (str(s.get("name", "")).lower() == name_key and _coerce_size(s.get("size", 3)) == board_size)
    ]

    best_existing = None
    if matches:
        best_existing = max(matches, key=lambda s: int(s.get("score", 0)))

    if best_existing and new_score <= int(best_existing.get("score", 0)):
        # Keep the existing best; discard the new (lower) attempt
        entry = best_existing
    else:
        # Insert/replace with the new personal best
        entry = {
            "id": uuid.uuid4().hex if not best_existing else best_existing.get("id", uuid.uuid4().hex),
            "name": clean_name,
            "score": new_score if not best_existing else max(new_score, int(best_existing.get("score", 0))),
            "size": board_size,
            "timestamp": _now_iso(),
        }

    # Rebuild list with a single entry for this name
    scores = others + [entry]

    # Keep file ordered and trimmed per size
    scores = _trim_scores(scores)
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
        scores = _trim_scores(scores)
        save_scores(scores)
    return removed

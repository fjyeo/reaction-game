import { useState, useEffect, useMemo } from "react";
import "./App.css";

function App() {
  // store round data from backend
  const [grid, setGrid] = useState([]);
  const [target, setTarget] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);
  const [score, setScore] = useState(0);
  const [clicksByColour, setClicksByColour] = useState({});

  // fetch a round from backend
  const fetchRound = (preserveExpiry = true) => {
    fetch("http://127.0.0.1:8000/round")
      .then((res) => res.json())
      .then((data) => {
        console.log("Round from backend:", data);
        setGrid(data.grid || []);
        setTarget(data.target || null);
        setRoundId(data.roundId || null);
        // Preserve the original game expiry across rounds unless explicitly allowed to reset
        setExpiresAt((prev) => (preserveExpiry && prev ? prev : data.expiresAt || null));
      })
      .catch((err) => console.error("Failed to fetch round:", err));
  };

  // fetch on mount
  useEffect(() => {
    fetchRound();
  }, []);

  // countdown: derive remaining time from expiresAt
  useEffect(() => {
    if (!expiresAt) {
      setRemainingMs(null);
      return;
    }
    const endTs = Date.parse(expiresAt);
    if (Number.isNaN(endTs)) {
      setRemainingMs(null);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const ms = Math.max(0, endTs - now);
      setRemainingMs(ms);
    };

    // initial tick then interval
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  // format remaining time as mm:ss
  const remainingLabel = useMemo(() => {
    if (remainingMs == null) return null;
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [remainingMs]);

  // Capitalised colour for prompt (e.g., "Green")
  const targetColourLabel = useMemo(() => {
    if (!target || !target.colour) return null;
    const s = String(target.colour);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [target]);

  return (
    <main className="app">
      <h1>Reaction Game</h1>

      {/* Countdown timer */}
      {remainingLabel && <p className="timer">Time left: {remainingLabel}</p>}
      {remainingMs === 0 && <p className="timesup">Time's up!</p>}

      {/* Actions */}
      <p>
        <button className="new-round" onClick={() => fetchRound(true)} disabled={remainingMs === 0}>New Round</button>
      </p>

      {/* Prompt and metadata */}
      {target && (
        <p className="prompt">Target: click {targetColourLabel} {target.row + 1}</p>
      )}
      {/* Scoreboard */}
      <p className="score">Score: {score}</p>
      {Object.keys(clicksByColour).length > 0 && (
        <p className="clicks">
          Clicks by colour: {Object.entries(clicksByColour).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </p>
      )}
      {roundId && <p className="meta">Round ID: {roundId}</p>}

      {/* If grid is still empty, show a loading message */}
      {grid.length === 0 ? (
        <p>Loading round...</p>
      ) : (
        <div className="grid">
          {grid.map((row, r) =>
            row.map((colour, c) => (
              <button
                key={`${r}-${c}`}
                className="cell"
                style={{ backgroundColor: colour }}
                disabled={remainingMs === 0}
                onClick={() => {
                  // Track per-colour clicks
                  setClicksByColour((prev) => ({ ...prev, [colour]: (prev[colour] || 0) + 1 }));
                  console.log(`Clicked ${colour} at row ${r}, col ${c}`);
                  // If time remains and target matches, increment score and fetch next round
                  if (remainingMs > 0 && target && r === target.row && colour === target.colour) {
                    setScore((s) => s + 1);
                    fetchRound(true); // keep original expiry
                  }
                }}
              >
                {r + 1}
              </button>
            ))
          )}
        </div>
      )}
    </main>
  );
}

export default App;


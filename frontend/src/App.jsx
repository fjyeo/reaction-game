import { useState, useEffect, useMemo } from "react";
import "./App.css";

function App() {
  // store round data from backend
  const [grid, setGrid] = useState([]);
  const [target, setTarget] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);

  // fetch the round from backend on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/round")
      .then((res) => res.json())
      .then((data) => {
        console.log("Round from backend:", data);
        setGrid(data.grid || []);
        setTarget(data.target || null);
        setRoundId(data.roundId || null);
        setExpiresAt(data.expiresAt || null);
      })
      .catch((err) => console.error("Failed to fetch round:", err));
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

  return (
    <main className="app">
      <h1>Reaction Game</h1>

      {/* Countdown timer */}
      {remainingLabel && <p className="timer">Time left: {remainingLabel}</p>}

      {/* Prompt and metadata */}
      {target && (
        <p className="prompt">
          Target: click {target.colour} at row {target.row + 1}, col {target.col + 1}
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
                onClick={() =>
                  console.log(`Clicked ${colour} at row ${r}, col ${c}`)
                }
              >
                {colour}
              </button>
            ))
          )}
        </div>
      )}
    </main>
  );
}

export default App;


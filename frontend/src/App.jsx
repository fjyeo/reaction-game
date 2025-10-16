import { useState, useEffect } from "react";
import "./App.css";

function App() {
  // store round data from backend
  const [grid, setGrid] = useState([]);
  const [target, setTarget] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

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

  return (
    <main className="app">
      <h1>Reaction Game</h1>

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


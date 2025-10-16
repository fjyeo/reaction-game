import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";

function App() {
  // store round data from backend
  const [grid, setGrid] = useState([]);
  const [target, setTarget] = useState(null);
  const [roundId, setRoundId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [highscores, setHighscores] = useState([]);
  const hasTimeBeenPositiveRef = useRef(false);
  const [size, setSize] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [frozenRemainingMs, setFrozenRemainingMs] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [flash, setFlash] = useState(null);

  // fetch a round from backend
  const fetchRound = (preserveExpiry = true) => {
    fetch(`http://127.0.0.1:8000/round?size=${size}`)
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

  const fetchHighscores = () => {
    fetch("http://127.0.0.1:8000/highscores?limit=5")
      .then((res) => res.json())
      .then((hs) => setHighscores(Array.isArray(hs) ? hs : []))
      .catch((e) => console.error("Failed to fetch highscores:", e));
  };

  // fetch highscores on mount (do not auto-start game)
  useEffect(() => {
    fetchHighscores();
  }, []);

  // when size changes during an active game, start a fresh game with the new board size
  useEffect(() => {
    if (!gameStarted) return; // do not auto-start on first load
    setScore(0);
    setSubmitted(false);
    hasTimeBeenPositiveRef.current = false;
    fetchRound(false);
  }, [size, gameStarted]);

  // countdown: derive remaining time from expiresAt, freeze when paused, and stop when not started
  useEffect(() => {
    if (!gameStarted) {
      setRemainingMs(null);
      return;
    }
    if (!expiresAt) {
      setRemainingMs(null);
      return;
    }

    if (isPaused) {
      // keep showing frozen time while paused
      if (frozenRemainingMs != null) setRemainingMs(frozenRemainingMs);
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

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt, isPaused, frozenRemainingMs, gameStarted]);

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

  // Derive a readable font size for cell numbers based on board size
  const cellFontPx = useMemo(() => {
    // Larger font for smaller boards; clamp to keep within readable bounds
    return Math.max(12, Math.round(44 - size * 3)); // 3x3 ~35px, 9x9 ~17px
  }, [size]);

  // Submit final score exactly once when time transitions from >0 to 0
  useEffect(() => {
    if (remainingMs == null) return;

    if (remainingMs > 0) {
      hasTimeBeenPositiveRef.current = true;
      return;
    }

    const armed = hasTimeBeenPositiveRef.current;
    if (remainingMs === 0 && armed && !submitted) {
      hasTimeBeenPositiveRef.current = false; // disarm for this game

      const playerName = localStorage.getItem("rg_player_name") || "Player";

      (async () => {
        try {
          const res = await fetch("http://127.0.0.1:8000/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: playerName, score }),
          });
          await res.json();
        } catch (e) {
          console.error("Failed to submit score:", e);
        } finally {
          setSubmitted(true);
        }

      fetchHighscores();
      })();
    }
  }, [remainingMs, submitted, score]);

  return (
    <main className="app">
      <div className="layout">
        <section>
          <div className="header">
            <h1>Reaction Game</h1>
            <div className="controls">
              <label>
                Name:
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPlayerName(v);
                    localStorage.setItem("rg_player_name", v);
                  }}
                  placeholder="Player"
                />
              </label>
              <label>
                Size:
                <select
                  value={size}
                  onChange={(e) => setSize(parseInt(e.target.value, 10))}
                >
                  {[3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      {n}x{n}
                    </option>
                  ))}
                </select>
              </label>
              {!gameStarted ? (
                <button
                  className="new-round"
                  onClick={() => {
                    // Start a fresh game
                    setGameStarted(true);
                    setIsPaused(false);
                    setFrozenRemainingMs(null);
                    setScore(0);
                    setSubmitted(false);
                    hasTimeBeenPositiveRef.current = false;
                    fetchRound(false);
                    fetchHighscores();
                  }}
                >
                  Start
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (!isPaused) {
                        // Pause: freeze remaining time
                        setFrozenRemainingMs(remainingMs);
                        setIsPaused(true);
                      } else {
                        // Resume: recompute new deadline from frozen time
                        const ms = frozenRemainingMs ?? remainingMs ?? 0;
                        const newExpiry = new Date(Date.now() + ms).toISOString();
                        setIsPaused(false);
                        setFrozenRemainingMs(null);
                        // Set new expiry to continue countdown from where it left off
                        setExpiresAt(newExpiry);
                      }
                    }}
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    className="new-round"
                    onClick={() => {
                      // Restart a fresh game
                      setGameStarted(true);
                      setIsPaused(false);
                      setFrozenRemainingMs(null);
                      setScore(0);
                      setSubmitted(false);
                      hasTimeBeenPositiveRef.current = false;
                      fetchRound(false);
                      fetchHighscores();
                    }}
                  >
                    New Game
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Countdown + Score */}
          {remainingLabel && <p className="timer">Time left: {remainingLabel}</p>}
          {remainingMs === 0 && <p className="timesup">Time's up!</p>}

      

      {/* Prompt and metadata */}
      {target && (
        <p className="prompt">Target: click {targetColourLabel} {target.row + 1}</p>
      )}
      {/* Score */}
      <p className="score">Score: {score}</p>

      {/* Highscores moved to sidebar */}
      {roundId && <p className="meta">Round ID: {roundId}</p>}

      {/* If grid is still empty, show a loading message */}
          {grid.length === 0 || !gameStarted ? (
            <p>Loading round...</p>
          ) : (
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${size}, 1fr)`,
                "--cell-font-size": `${cellFontPx}px`,
              }}
            >
              {grid.map((row, r) =>
                row.map((colour, c) => {
                  const key = `${r}-${c}`;
                  const flashClass = (flash && flash.key === key) ? (flash.type === 'correct' ? 'flash-correct' : 'flash-wrong') : '';
                  return (
                    <button
                      key={key}
                      className={`cell ${flashClass}`}
                      style={{ backgroundColor: colour }}
                      disabled={remainingMs === 0 || isPaused}
                      onClick={() => {
                        console.log(`Clicked ${colour} at row ${r}, col ${c}`);
                        if (remainingMs > 0 && target && !isPaused) {
                          const isCorrect = r === target.row && colour === target.colour;
                          setFlash({ key, type: isCorrect ? 'correct' : 'wrong' });
                          setTimeout(() => setFlash(null), 200);
                          if (isCorrect) {
                            setScore((s) => s + 1);
                            fetchRound(true);
                          }
                        }
                      }}
                    >
                      {r + 1}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>
        <aside className="sidebar">
          <h2>High Scores</h2>
          {highscores.length === 0 ? (
            <p>No scores yet.</p>
          ) : (
            <ol>
              {highscores.map((e) => (
                <li key={e.id}>
                  {e.name} - {e.score}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  );
}

export default App;





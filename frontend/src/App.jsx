import { useState, useEffect } from "react";
import "./App.css";

function App() {
  // 🧠 store the grid from backend
  const [grid, setGrid] = useState([]);

  // 🧪 fetch the grid from backend on mount
  useEffect(() => {
    fetch("http://127.0.0.1:8000/grid")
      .then((res) => res.json())
      .then((data) => {
        console.log("Grid from backend:", data.grid);
        setGrid(data.grid);
      })
      .catch((err) => console.error("Failed to fetch grid:", err));
  }, []);

  return (
    <main className="app">
      <h1>Reaction Game</h1>

      {/* If grid is still empty, show a loading message */}
      {grid.length === 0 ? (
        <p>Loading grid...</p>
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

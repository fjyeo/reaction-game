import "./App.css";

function App() {
  return (
    <main className="app">
      <h1>Reaction Game</h1>

      <div className="grid">
        {Array.from({ length: 9 }, (_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;

          return (
            <button
              key={i}
              className="cell"
              onClick={() => console.log(`Clicked cell ${i} (row ${row}, col ${col})`)}
            >
              {i}
            </button>
          );
        })}
      </div>
    </main>
  );
}

export default App;

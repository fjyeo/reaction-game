function App() {
  return (
    <main style={styles.app}>
      <h1 style={{ margin: 0 }}>Reaction Game</h1>

      <div style={styles.grid}>
        <button style={styles.cell} onClick={() => console.log("Cell 0")}>0</button>
        <button style={styles.cell} onClick={() => console.log("Cell 1")}>1</button>
        <button style={styles.cell} onClick={() => console.log("Cell 2")}>2</button>
        <button style={styles.cell} onClick={() => console.log("Cell 3")}>3</button>
        <button style={styles.cell} onClick={() => console.log("Cell 4")}>4</button>
        <button style={styles.cell} onClick={() => console.log("Cell 5")}>5</button>
        <button style={styles.cell} onClick={() => console.log("Cell 6")}>6</button>
        <button style={styles.cell} onClick={() => console.log("Cell 7")}>7</button>
        <button style={styles.cell} onClick={() => console.log("Cell 8")}>8</button>
      </div>
    </main>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 100px)",
    gridTemplateRows: "repeat(3, 100px)",
    gap: 10,
  },
  cell: {
    border: "1px solid #ccc",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 18,
  },
};

export default App;

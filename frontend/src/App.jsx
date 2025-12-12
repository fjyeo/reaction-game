import { useState, useEffect, useMemo, useRef } from "react"; // pulls react hooks used throughout
import { useCallback } from "react";
import "./App.css"; // imports the CSS file for styling the app

// Map backend colour names to consistent hex values so we can calculate contrast reliably
const colourHexMap = {
  red: "#e11d48",
  green: "#15803d",
  blue: "#2563eb",
  yellow: "#f59e0b",
  purple: "#7c3aed",
  orange: "#ea580c",
  cyan: "#0891b2",
  magenta: "#d946ef",
  lime: "#65a30d",
};

// High-contrast variants with stronger separation between hues and backgrounds
const colourHexMapHigh = {
  red: "#d90429",
  green: "#16a34a",
  blue: "#1d4ed8",
  yellow: "#d97706",
  purple: "#7c3aed",
  orange: "#c2410c",
  cyan: "#0ea5e9",
  magenta: "#c026d3",
  lime: "#4d7c0f",
};

const colourIconMap = {
  red: "▲",
  green: "■",
  blue: "●",
  yellow: "◆",
  purple: "★",
  orange: "✚",
  cyan: "⬢",
  magenta: "🧙", // gnome emoji as easter egg
  lime: "⬤",
};

const getDisplayColour = (colour, useHighContrast = false) => {
  const key = String(colour || "").toLowerCase();
  const palette = useHighContrast ? colourHexMapHigh : colourHexMap;
  if (palette[key]) return palette[key];
  const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  if (hexPattern.test(key)) return key;
  // Fallback to a readable accent if we get an unexpected colour string
  return "#2563eb";
};

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const normalized = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return [255, 255, 255];
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
};

const relativeLuminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getAccessibleTextColour = (colour, useHighContrast = false) => {
  const hex = getDisplayColour(colour, useHighContrast);
  const lum = relativeLuminance(hexToRgb(hex));
  // Bright backgrounds get dark text, darker backgrounds get light text
  return lum > 0.6 ? "#0f172a" : "#f8fafc";
};

const ACCURACY_HISTORY_LIMIT = 32;

const createHeatmap = (boardSize) =>
  Array.from({ length: boardSize }, () => Array(boardSize).fill(0));

const appendHistory = (prev = [], value, limit) => {
  const sliceStart = Math.max(0, prev.length - (limit - 1));
  return [...prev.slice(sliceStart), value];
};

const computeStdDev = (values = []) => {
  if (!values.length) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

const REACTION_TIME_BUCKETS = [
  { label: "0-500", max: 500 },
  { label: "500-750", max: 750 },
  { label: "750-1000", max: 1000 },
  { label: "1000-1250", max: 1250 },
  { label: "1250+", max: Infinity },
];

const ensureAudioContext = (audioCtxRef) => {
  if (audioCtxRef.current) {
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  audioCtxRef.current = ctx;
  return ctx;
};

const playTone = (audioCtxRef, { freq = 440, duration = 0.18, type = "sine", volume = 0.2 }) => {
  try {
    const ctx = ensureAudioContext(audioCtxRef);
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (e) {
    console.error("Audio play failed:", e);
  }
};

const playHighscoreSound = (audioRef) => {
  try {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio("/highscore.mp3");
      audio.volume = 0.9;
      audioRef.current = audio;
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {
    console.error("Highscore audio play failed:", e);
  }
};

function App() {
  // store round data from backend
  const [grid, setGrid] = useState([]); // 2D array of colours from the backend
  const [target, setTarget] = useState(null); // Object containing the target cell's row, column, and colour
  const [expiresAt, setExpiresAt] = useState(null); // ISO 8601 string representing the round's expiry time
  const [remainingMs, setRemainingMs] = useState(null); // Countdown timer: Number of milliseconds remaining until the round expires
  const [score, setScore] = useState(0); // Player Score 
  const [submitted, setSubmitted] = useState(false); // Boolean indicating whether the player has submitted their score for the current round (guards against double-posting to/score)
  const [highscoresBySize, setHighscoresBySize] = useState({}); // Cache of highscores keyed by board size
  const [leaderboardSize, setLeaderboardSize] = useState(3); // Size used in the High Scores tab selector
  const hasTimeBeenPositiveRef = useRef(false); // Boolean reference to track if the player has positive time remaining during the current round
  const [size, setSize] = useState(3); // Size of the grid (3x3, 4x4, 5x5, 6x6, 7x7, 8x8, 9x9)
  const [isPaused, setIsPaused] = useState(false); // Boolean indicating whether the game is paused (time is frozen)
  const [gameStarted, setGameStarted] = useState(false); // Boolean indicating whether the game has started
  const [frozenRemainingMs, setFrozenRemainingMs] = useState(null); // When paused, stores the remaining time to resume from
  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem("rg_player_name") || "";
  }); // Player's name (stored in localStorage)
  const [flash, setFlash] = useState(null); // Object containing the key of the cell that was clicked and the type of feedback (correct or wrong)
  const [totalDurationMs, setTotalDurationMs] = useState(null); // Total duration of the round in milliseconds
  const [progressKey, setProgressKey] = useState(0); // Key for the progress bar animation
  const [edgeFlash, setEdgeFlash] = useState(null); // 'success' | 'error' border flash on click result
  const [soundOn, setSoundOn] = useState(true); // Toggle for sound effects
  const audioCtxRef = useRef(null); // Web Audio context (created on first interaction)
  const highscoreAudioRef = useRef(null); // Audio element for new highscore
  const [showConfetti, setShowConfetti] = useState(false); // Confetti overlay at game end
  const [confettiKey, setConfettiKey] = useState(0); // Rerender confetti with new random positions
  const confettiShownRef = useRef(false); // prevent repeated confetti triggers while timer is 0
  const [reactionTimes, setReactionTimes] = useState([]); // Recent reaction times (ms)
  const [targetShownAt, setTargetShownAt] = useState(null); // High-res timestamp when current target appeared
  const [wrongCount, setWrongCount] = useState(0); // Number of incorrect clicks this game
  const [currentStreak, setCurrentStreak] = useState(0); // Current correct streak
  const [bestStreak, setBestStreak] = useState(0); // Best streak this game
  const [totalClicks, setTotalClicks] = useState(0); // Total attempted clicks
  const [accuracyHistory, setAccuracyHistory] = useState([]);
  const [consistencyHistory, setConsistencyHistory] = useState([]);
  const [misclickHeatmap, setMisclickHeatmap] = useState(() => createHeatmap(size));
  const [theme, setTheme] = useState(() => localStorage.getItem("rg_theme") || "light"); // light | dark
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem("rg_contrast") === "high");
  const [colorBlindMode, setColorBlindMode] = useState(() => localStorage.getItem("rg_cb_mode") === "on");
  const [activeTab, setActiveTab] = useState("performance");
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);
  const countdownTimersRef = useRef([]);

  // fetch a round from backend
  const fetchRound = (preserveExpiry = true) => { 
    fetch(`http://127.0.0.1:8000/round?size=${size}`)
      .then((res) => res.json()) // parses the JSON response into a JavaScript object
      .then((data) => { // updates the state with the new round data
        console.log("Round from backend:", data); // logs the round data to the console for debugging
        setGrid(data.grid || []); // updates the grid state with the new grid data
        setTarget(data.target || null); // updates the target state with the new target data
        setExpiresAt((prev) => (preserveExpiry && prev ? prev : data.expiresAt || null)); // preserves the original game expiry across rounds unless explicitly allowed to reset
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        setTargetShownAt(now);
      })
      .catch((err) => console.error("Failed to fetch round:", err)); // logs any errors to the console for debugging
  };

  const fetchHighscores = useCallback(
    (targetSize) => { // fetches the top 5 highscores for a given board size
      const resolvedSize = typeof targetSize === "number" ? targetSize : leaderboardSize;
      fetch(`http://127.0.0.1:8000/highscores?size=${resolvedSize}&limit=5`)
        .then((res) => res.json()) // parses the JSON response into a JavaScript object
        .then((hs) => {
          const safeScores = Array.isArray(hs) ? hs : [];
          setHighscoresBySize((prev) => ({ ...prev, [resolvedSize]: safeScores })); // updates cache
        })
        .catch((e) => {
          console.error("Failed to fetch highscores:", e); // logs any errors to the console for debugging
          setHighscoresBySize((prev) => ({ ...prev, [resolvedSize]: [] }));
        });
    },
    [leaderboardSize]
  );

  const startCountdown = useCallback(() => {
    // Clear any existing countdown timers
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
    setCountdownActive(true);
    setCountdownValue(3);

    const schedule = (value, delay, isFinal = false) => {
      const id = setTimeout(() => {
        if (!isFinal) {
          setCountdownValue(value);
        } else {
          setCountdownActive(false);
          setCountdownValue(null);
          fetchRound(false);
        }
      }, delay);
      countdownTimersRef.current.push(id);
    };

    schedule(2, 850);
    schedule(1, 1700);
    schedule("GO!", 2550);
    schedule(null, 3200, true);
  }, [fetchRound]);

  useEffect(() => { // Apply saved theme on mount
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-contrast", highContrast ? "high" : "normal");
    document.documentElement.setAttribute("data-colorblind", colorBlindMode ? "on" : "off");
  }, []);

  // Persist and apply theme when it changes
  useEffect(() => {
    localStorage.setItem("rg_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Persist and apply contrast when it changes
  useEffect(() => {
    localStorage.setItem("rg_contrast", highContrast ? "high" : "normal");
    document.documentElement.setAttribute("data-contrast", highContrast ? "high" : "normal");
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem("rg_cb_mode", colorBlindMode ? "on" : "off");
    document.documentElement.setAttribute("data-colorblind", colorBlindMode ? "on" : "off");
  }, [colorBlindMode]);

  useEffect(() => {
    fetchHighscores(size);
  }, [size, fetchHighscores]);

  useEffect(() => {
    fetchHighscores(leaderboardSize);
  }, [fetchHighscores, leaderboardSize]);

  useEffect(() => {
    return () => {
      countdownTimersRef.current.forEach(clearTimeout);
      countdownTimersRef.current = [];
    };
  }, []);

  // when size changes during an active game, start a fresh game with the new board size
  useEffect(() => {
    if (!gameStarted) return; // only reset mid-game when size changes
    setScore(0); // resets the score to 0
    setSubmitted(false); // resets the submitted state to false
    hasTimeBeenPositiveRef.current = false; 
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
    setCountdownActive(false);
    setCountdownValue(null);
    setTotalDurationMs(60 * 1000);
    setProgressKey((k) => k + 1);
    setReactionTimes([]);
    setTargetShownAt(null);
    setWrongCount(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setTotalClicks(0);
    setAccuracyHistory([]);
    setConsistencyHistory([]);
    setMisclickHeatmap(createHeatmap(size));
    fetchRound(false);
  }, [size]);

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

  const isCriticalTime = useMemo(
    () => remainingMs != null && remainingMs > 0 && remainingMs <= 10_000,
    [remainingMs]
  );

  const isTimeUp = remainingMs === 0;

  const reactionStats = useMemo(() => {
    if (!reactionTimes.length) return null;
    const sorted = [...reactionTimes].sort((a, b) => a - b);
    const sum = reactionTimes.reduce((a, b) => a + b, 0);
    const avg = sum / reactionTimes.length;
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    const variance =
      reactionTimes.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) /
      reactionTimes.length;
    const stddev = Math.sqrt(variance);
    return { avg, best, worst, median, stddev };
  }, [reactionTimes]);

  const accuracyStats = useMemo(() => {
    const correct = score;
    const wrong = wrongCount;
    const total = totalClicks;
    if (total === 0) return { accuracy: null, correct, wrong, total };
    const accuracy = (correct / total) * 100;
    return { accuracy, correct, wrong, total };
  }, [score, wrongCount, totalClicks]);

  const displayedHighscores = useMemo(() => highscoresBySize[leaderboardSize] || [], [highscoresBySize, leaderboardSize]);

  const bestScoreForCurrentSize = useMemo(() => {
    const list = highscoresBySize[size] || [];
    if (!list.length) return 0;
    return list.reduce((max, entry) => Math.max(max, Number(entry.score) || 0), 0);
  }, [highscoresBySize, size]);

  const trimmedPlayerName = playerName.trim();
  const hasPlayerName = trimmedPlayerName.length > 0;

  const sparkline = useMemo(() => {
    if (!reactionTimes.length) return null;
    const w = 300;
    const h = 110;
    const min = Math.min(...reactionTimes);
    const max = Math.max(...reactionTimes);
    const span = Math.max(1, max - min);
    const step = reactionTimes.length > 1 ? w / (reactionTimes.length - 1) : 0;
    const points = reactionTimes.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { w, h, min, max, points: points.join(" ") };
  }, [reactionTimes]);

  const accuracySparkline = useMemo(() => {
    if (!accuracyHistory.length) return null;
    const w = 300;
    const h = 90;
    const min = 0;
    const max = 100;
    const span = Math.max(1, max - min);
    const step = accuracyHistory.length > 1 ? w / (accuracyHistory.length - 1) : 0;
    const points = accuracyHistory.map((value, i) => {
      const x = i * step;
      const y = h - ((Math.min(max, Math.max(min, value)) - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { w, h, points: points.join(" "), min, max };
  }, [accuracyHistory]);

  const consistencySparkline = useMemo(() => {
    if (!consistencyHistory.length) return null;
    const w = 280;
    const h = 70;
    const min = 0;
    const max = Math.max(1, ...consistencyHistory);
    const span = max - min;
    const step = consistencyHistory.length > 1 ? w / (consistencyHistory.length - 1) : 0;
    const points = consistencyHistory.map((value, i) => {
      const x = i * step;
      const y = h - ((value - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { w, h, points: points.join(" "), min, max };
  }, [consistencyHistory]);

  const reactionTimeDistribution = useMemo(() => {
    const base = REACTION_TIME_BUCKETS.map((bucket) => ({ ...bucket, count: 0, ratio: 0 }));
    if (!reactionTimes.length) return base;
    const counters = [...base];
    reactionTimes.forEach((value) => {
      const idx = REACTION_TIME_BUCKETS.findIndex((bucket) => value <= bucket.max);
      const bucketIndex = idx === -1 ? counters.length - 1 : idx;
      counters[bucketIndex].count += 1;
    });
    const total = reactionTimes.length;
    return counters.map((bucket) => ({
      ...bucket,
      ratio: total ? (bucket.count / total) * 100 : 0,
    }));
  }, [reactionTimes]);

  const misclickMax = useMemo(() => {
    return misclickHeatmap.reduce((max, row) => {
      if (!row.length) return max;
      return Math.max(max, ...row);
    }, 0);
  }, [misclickHeatmap]);

  const heatmapCells = useMemo(() => {
    return misclickHeatmap.flatMap((rowData, rowIndex) =>
      rowData.map((count, colIndex) => ({ rowIndex, colIndex, count }))
    );
  }, [misclickHeatmap]);

  const renderGrid = useMemo(() => {
    if (grid.length) return grid;
    return Array.from({ length: size }, () => Array(size).fill(null));
  }, [grid, size]);

  const confettiPieces = useMemo(() => {
    const colours = ["#0ea5e9", "#0f6ddf", "#22c55e", "#f59e0b", "#e11d48", "#8b5cf6"];
    return Array.from({ length: 45 }, (_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const duration = 2.6 + Math.random() * 0.9;
      const size = 6 + Math.random() * 6;
      const color = colours[i % colours.length];
      const rotate = Math.random() * 360;
      return { left, delay, duration, size, color, rotate };
    });
  }, [confettiKey]);

  // Capitalised colour for prompt (e.g., "Green")
  const activeTargetColour = countdownActive ? "blue" : target?.colour;

  const targetColourLabel = useMemo(() => {
    if (countdownActive) return "???";
    if (!target || !target.colour) return null;
    const s = String(target.colour);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [target, countdownActive]);

  const targetSymbol = useMemo(() => {
    if (!activeTargetColour) return null;
    const key = String(activeTargetColour).toLowerCase();
    return colourIconMap[key] || null;
  }, [target, activeTargetColour]);

  const targetBadgeColour = useMemo(
    () => (activeTargetColour ? getDisplayColour(activeTargetColour, highContrast) : null),
    [activeTargetColour, highContrast]
  );

  const targetBadgeTextColour = useMemo(
    () => (activeTargetColour ? getAccessibleTextColour(activeTargetColour, highContrast) : "#0f172a"),
    [activeTargetColour, highContrast]
  );

  // Derive a readable font size for cell numbers based on board size
  const cellFontPx = useMemo(() => {
    // Larger font for smaller boards; clamp to keep within readable bounds
    return Math.max(12, Math.round(44 - size * 3)); // 3x3 ~35px, 9x9 ~17px
  }, [size]);

  const restartGame = useCallback(() => {
    if (!hasPlayerName) {
      setEdgeFlash("error");
      return;
    }
    if (soundOn) playTone(audioCtxRef, { freq: 520, duration: 0.12, type: "triangle", volume: 0.12 });
    // Restart a fresh game with a short countdown so timing is consistent
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
    setCountdownActive(false);
    setCountdownValue(null);

    setGameStarted(true);
    setIsPaused(false);
    setFrozenRemainingMs(null);
    setExpiresAt(null);
    setRemainingMs(null);
    setGrid([]);
    setTarget(null);
    setScore(0);
    setSubmitted(false);
    hasTimeBeenPositiveRef.current = false;
    confettiShownRef.current = false;
    setShowConfetti(false);
    setEdgeFlash(null);
    setFlash(null);
    setReactionTimes([]);
    setTargetShownAt(null);
    setWrongCount(0);
    setCurrentStreak(0);
    setBestStreak(0);
    setTotalClicks(0);
    setAccuracyHistory([]);
    setConsistencyHistory([]);
    setMisclickHeatmap(createHeatmap(size));
    setTotalDurationMs(60 * 1000);
    setProgressKey((k) => k + 1);
    startCountdown();
    fetchHighscores(size);
  }, [hasPlayerName, soundOn, size, startCountdown, fetchHighscores]);

  // Submit final score exactly once when time transitions from >0 to 0
  useEffect(() => {
    if (remainingMs == null) return;

    if (remainingMs > 0) {
      hasTimeBeenPositiveRef.current = true;
      confettiShownRef.current = false;
      return;
    }

    const armed = hasTimeBeenPositiveRef.current;
    if (remainingMs === 0 && armed && !submitted) {
      hasTimeBeenPositiveRef.current = false; // disarm for this game
      confettiShownRef.current = true;
      setShowConfetti(true);
      setConfettiKey((k) => k + 1);
        setTimeout(() => setShowConfetti(false), 4000);
        if (soundOn) {
          playTone(audioCtxRef, { freq: 784, duration: 0.18, type: "triangle", volume: 0.16 });
          setTimeout(() => playTone(audioCtxRef, { freq: 988, duration: 0.18, type: "triangle", volume: 0.16 }), 120);
          setTimeout(() => playTone(audioCtxRef, { freq: 1175, duration: 0.22, type: "square", volume: 0.18 }), 240);
        const isNewHigh = score > bestScoreForCurrentSize;
        if (isNewHigh) {
          playHighscoreSound(highscoreAudioRef);
        }
      }

      const storedName = localStorage.getItem("rg_player_name") || "";
      const submissionName = (playerName || storedName || "").trim() || "Player";

      (async () => {
          try {
            const res = await fetch("http://127.0.0.1:8000/score", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: submissionName, score, size }),
            });
            await res.json();
          } catch (e) {
            console.error("Failed to submit score:", e);
          } finally {
          setSubmitted(true);
        }

        fetchHighscores(size);
      })();
    }
  }, [remainingMs, submitted, score, bestScoreForCurrentSize]);

  const hasReactions = reactionTimes.length > 0;
  const hasAccuracyHistory = accuracyHistory.length > 0;
  const hasConsistencyHistory = consistencyHistory.length > 0;

  return (
    <main className="app">
      <div
        className={`edge-flash-overlay ${edgeFlash ? "active" : ""} ${
          edgeFlash === "error" ? "error" : edgeFlash === "success" ? "success" : ""
        }`}
        aria-hidden="true"
      />
      <div className={`confetti-layer ${showConfetti ? "visible" : ""}`} aria-hidden="true">
        {showConfetti &&
          confettiPieces.map((p, idx) => (
            <span
              key={`${confettiKey}-${idx}`}
              className="confetti-piece"
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                width: `${p.size}px`,
                height: `${p.size * 3}px`,
                backgroundColor: p.color,
                transform: `rotate(${p.rotate}deg)`,
              }}
            />
          ))}
      </div>
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
                    localStorage.setItem("rg_player_name", v.trim());
                  }}
                  placeholder="Enter a name to start"
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
              <div className="control-actions">
                {!gameStarted ? (
                  <button
                    className="new-round"
                    disabled={!hasPlayerName}
                    title={hasPlayerName ? "Start a new game" : "Enter a name to start"}
                    onClick={restartGame}
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
                    {!isTimeUp && (
                      <button
                        className="new-round"
                        onClick={restartGame}
                        disabled={!hasPlayerName}
                        title={hasPlayerName ? "Restart the round" : "Enter a name to restart"}
                      >
                        Restart
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Countdown + Score + Progress */}
          <div className={`hud ${isCriticalTime ? "hud-critical" : ""}`}>
            <div className="hud-row">
              <p className="timer">Time left: {countdownActive ? "--:--" : (remainingLabel || "--:--")}</p>
              <p className="score-big">Score: {score}</p>
            </div>
            {gameStarted && totalDurationMs != null && (remainingMs != null || countdownActive) && (
              <div className="progress" aria-label="Time remaining">
                <div
                  key={progressKey}
                  className={`progress-fill ${isCriticalTime ? "progress-fill-critical" : ""}`}
                  style={{
                    animationName: 'progress-deplete',
                    animationDuration: `${totalDurationMs}ms`,
                    animationTimingFunction: 'linear',
                    animationFillMode: 'forwards',
                    animationPlayState: (isPaused || countdownActive) ? 'paused' : 'running',
                  }}
                />
              </div>
            )}
          </div>

        {/* Prompt and metadata */}
        {(target || countdownActive) && (
          <p className="prompt" aria-live="polite">
            Target: click{" "}
            <span
              className="target-badge"
              style={{
                backgroundColor: targetBadgeColour,
                color: targetBadgeTextColour,
              }}
            >
            {targetColourLabel}
              {colorBlindMode && targetSymbol && (
                <span className="cb-icon inline" aria-hidden="true">
                  {targetSymbol}
                </span>
              )}
            </span>
            <span className="row-badge">
              {countdownActive ? "Row --" : `Row ${target?.row + 1}`}
            </span>
          </p>
        )}

        {/* Grid + overlays */}
        {!gameStarted && !countdownActive ? (
          <p>Loading round...</p>
        ) : (
          <div className={`grid-panel ${isPaused ? "paused" : ""} ${isTimeUp ? "timeup" : ""} ${countdownActive ? "countdown-mode" : ""}`}>
            {isTimeUp && (
              <div className="grid-overlay" role="status" aria-live="assertive">
                <div className="grid-overlay-card">
                  <p className="overlay-title">Time's up!</p>
                  <p className="overlay-copy">Start a fresh round and beat your last score.</p>
                  <div className="overlay-actions">
                    <button
                      className="overlay-cta"
                      onClick={restartGame}
                      disabled={!hasPlayerName}
                      title={hasPlayerName ? "Play again" : "Enter a name to start"}
                    >
                      Play again
                    </button>
                  </div>
                </div>
              </div>
            )}
          {countdownActive && (
            <div className="grid-overlay countdown-overlay" role="status" aria-live="assertive">
              <p className={`overlay-title countdown-number ${countdownValue === "GO!" ? "go" : ""}`}>
                {countdownValue}
              </p>
            </div>
          )}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${size}, 1fr)`,
                "--cell-font-size": `${cellFontPx}px`,
                "--cb-icon-size": `${Math.max(12, Math.round(cellFontPx * 0.75))}px`,
              }}
            >
                {renderGrid.map((row, r) =>
                  row.map((colour, c) => {
                    const key = `${r}-${c}`;
                    const flashClass = (flash && flash.key === key) ? (flash.type === 'correct' ? 'flash-correct' : 'flash-wrong') : '';
                    const isPlaceholder = colour == null;
                    const displayColour = isPlaceholder ? "var(--panel-2)" : getDisplayColour(colour, highContrast);
                    const textColour = isPlaceholder ? "var(--fg)" : getAccessibleTextColour(colour, highContrast);
                    const iconDef = colourIconMap[String(colour).toLowerCase()] || null;
                    return (
                      <button
                        key={key}
                        className={`cell ${flashClass}`}
                        style={{ backgroundColor: displayColour, color: textColour }}
                        disabled={isPlaceholder || isTimeUp || isPaused || countdownActive}
                        aria-label={`Row ${r + 1}, Column ${c + 1}: ${colour ?? "empty"}`}
                        title={`Row ${r + 1}, Column ${c + 1}: ${colour ?? "empty"}`}
                        onClick={() => {
                          console.log(`Clicked ${colour} at row ${r}, col ${c}`);
                          if (!isTimeUp && target && !isPaused && !countdownActive) {
                            const prevScore = score;
                            const prevWrong = wrongCount;
                            const prevTotal = totalClicks;
                            const isCorrect = r === target.row && colour === target.colour;
                            const newScore = isCorrect ? prevScore + 1 : prevScore;
                            const newWrong = isCorrect ? prevWrong : prevWrong + 1;
                            const newTotal = prevTotal + 1;
                            const newAccuracy = (newScore / newTotal) * 100;
                            setAccuracyHistory((hist) =>
                              appendHistory(hist, newAccuracy, ACCURACY_HISTORY_LIMIT)
                            );
                            setTotalClicks((t) => t + 1);
                            setFlash({ key, type: isCorrect ? "correct" : "wrong" });
                            setTimeout(() => setFlash(null), 200);
                            if (isCorrect) {
                              setScore((s) => s + 1);
                              setCurrentStreak((s) => {
                                const next = s + 1;
                                setBestStreak((b) => Math.max(b, next));
                                return next;
                              });
                              fetchRound(true);
                              setEdgeFlash("success");
                              setTimeout(() => setEdgeFlash(null), 700);
                              if (soundOn) playTone(audioCtxRef, { freq: 880, duration: 0.16, type: "sine", volume: 0.18 });
                              const now = typeof performance !== "undefined" ? performance.now() : Date.now();
                              if (targetShownAt != null) {
                                const rt = Math.max(0, now - targetShownAt);
                                setReactionTimes((arr) => {
                                  const next = [...arr.slice(-29), rt];
                                  setConsistencyHistory((hist) =>
                                    appendHistory(hist, computeStdDev(next), ACCURACY_HISTORY_LIMIT)
                                  );
                                  return next;
                                });
                              }
                            } else {
                              setWrongCount((w) => w + 1);
                              setCurrentStreak(0);
                              setEdgeFlash("error");
                              setTimeout(() => setEdgeFlash(null), 700);
                              if (soundOn) {
                                playTone(audioCtxRef, { freq: 220, duration: 0.14, type: "sawtooth", volume: 0.14 });
                                playTone(audioCtxRef, { freq: 160, duration: 0.18, type: "sine", volume: 0.12 });
                              }
                              setMisclickHeatmap((grid) =>
                                grid.map((rowData, rowIndex) =>
                                  rowIndex === r
                                    ? rowData.map((count, colIndex) =>
                                        colIndex === c ? count + 1 : count
                                      )
                                    : rowData
                                )
                              );
                            }
                          }
                        }}
                      >
                        <span className="cell-label">{r + 1}</span>
                        {colorBlindMode && iconDef && (
                          <span className="cb-icon" aria-hidden="true">{iconDef}</span>
                        )}
                      </button>
                    );
                  })
                )}
            </div>
          </div>
        )}
        </section>
        <aside className="sidebar">
          <div className="tab-buttons">
            <button onClick={() => setActiveTab("performance")} className={activeTab === "performance" ? "active" : ""}>Performance</button>
            <button onClick={() => setActiveTab("highscores")} className={activeTab === "highscores" ? "active" : ""}>High Scores</button>
            <button onClick={() => setActiveTab("settings")} className={activeTab === "settings" ? "active" : ""}>Settings</button>
          </div>
          <div className="tab-content">
            {activeTab === "settings" && (
              <div className="card settings-card">
                <h2>Settings</h2>
                <div className="setting-row">
                  <div>
                    <p className="label">Theme</p>
                    <p className="muted small">Switch between light and dark</p>
                  </div>
                  <button
                    className="pill-toggle"
                    onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                    aria-pressed={theme === "dark"}
                  >
                    {theme === "dark" ? "Dark" : "Light"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <p className="label">High contrast</p>
                    <p className="muted small">Stronger outlines and visibility</p>
                  </div>
                  <button
                    className="pill-toggle"
                    onClick={() => setHighContrast((v) => !v)}
                    aria-pressed={highContrast}
                  >
                    {highContrast ? "On" : "Off"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <p className="label">Colour-blind assist</p>
                    <p className="muted small">Add icons on tiles</p>
                  </div>
                  <button
                    className="pill-toggle"
                    onClick={() => setColorBlindMode((v) => !v)}
                    aria-pressed={colorBlindMode}
                  >
                    {colorBlindMode ? "On" : "Off"}
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <p className="label">Sound</p>
                    <p className="muted small">Game effects</p>
                  </div>
                  <button
                    className="pill-toggle"
                    onClick={() => {
                      setSoundOn((v) => !v);
                      if (!soundOn) ensureAudioContext(audioCtxRef);
                    }}
                    aria-pressed={soundOn}
                  >
                    {soundOn ? "On" : "Off"}
                  </button>
                </div>
              </div>
            )}
            {activeTab === "performance" && (
              <div className="card stats-card">
                <h2>Performance</h2>
                <div className="stats-card-content">
                    <div className="sparkline-container">
                    <div className="sparkline primary-spark" aria-label="Recent reaction times">
                      <div className="section-heading">
                        <p className="label">Reaction-time trend</p>
                      </div>
                      {hasReactions && sparkline ? (
                        <svg viewBox={`0 0 ${sparkline.w} ${sparkline.h}`} role="img">
                          <defs>
                            <linearGradient id="rt-line-heat" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
                              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.9" />
                              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
                            </linearGradient>
                            <linearGradient id="rt-fill-heat" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="rgba(239,68,68,0.22)" />
                              <stop offset="50%" stopColor="rgba(245,158,11,0.18)" />
                              <stop offset="100%" stopColor="rgba(34,197,94,0.14)" />
                            </linearGradient>
                          </defs>
                          <polyline
                            className="sparkline-path"
                            points={sparkline.points}
                            fill="none"
                            stroke="url(#rt-line-heat)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <polygon
                            className="sparkline-fill"
                            points={`${sparkline.points} ${sparkline.w},${sparkline.h} 0,${sparkline.h}`}
                            fill="url(#rt-fill-heat)"
                          />
                        </svg>
                      ) : (
                        <div className="sparkline-placeholder" aria-hidden="true" />
                      )}
                    </div>
                    <div className="accuracy-sparkline">
                      <div className="accuracy-sparkline-header">
                        <p className="label">Accuracy over time</p>
                        <span className="value-md">
                          {accuracyStats.accuracy == null ? "-" : `${accuracyStats.accuracy.toFixed(1)}%`}
                        </span>
                      </div>
                      {hasAccuracyHistory && accuracySparkline ? (
                        <svg
                          viewBox={`0 0 ${accuracySparkline.w} ${accuracySparkline.h}`}
                          role="img"
                          aria-label="Accuracy trend line"
                        >
                          <defs>
                            <linearGradient id="accuracy-line-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#34d399" />
                              <stop offset="100%" stopColor="#0ea5e9" />
                            </linearGradient>
                            <linearGradient id="accuracy-area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="rgba(34,209,153,0.25)" />
                              <stop offset="100%" stopColor="rgba(14,165,233,0.1)" />
                            </linearGradient>
                          </defs>
                          <polyline
                            className="accuracy-trend-path"
                            points={accuracySparkline.points}
                            fill="none"
                            stroke="url(#accuracy-line-grad)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <polygon
                            className="accuracy-trend-fill"
                            points={`${accuracySparkline.points} ${accuracySparkline.w},${accuracySparkline.h} 0,${accuracySparkline.h}`}
                            fill="url(#accuracy-area-grad)"
                          />
                        </svg>
                      ) : (
                        <div className="sparkline-placeholder" aria-hidden="true" />
                      )}
                    </div>
                    <div className="consistency-sparkline">
                      <div className="accuracy-sparkline-header">
                        <p className="label">Consistency</p>
                        <span className="value-md">
                          {hasConsistencyHistory && consistencyHistory.length
                            ? `${consistencyHistory[consistencyHistory.length - 1].toFixed(1)} ms`
                            : "-"}
                        </span>
                      </div>
                      {hasConsistencyHistory && consistencySparkline ? (
                        <svg
                          viewBox={`0 0 ${consistencySparkline.w} ${consistencySparkline.h}`}
                          role="img"
                          aria-label="Reaction-time consistency over time"
                        >
                          <defs>
                            <linearGradient id="consistency-line-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#f97316" />
                              <stop offset="100%" stopColor="#ea580c" />
                            </linearGradient>
                            <linearGradient id="consistency-area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="rgba(249, 115, 22, 0.25)" />
                              <stop offset="100%" stopColor="rgba(234, 88, 12, 0.12)" />
                            </linearGradient>
                          </defs>
                          <polyline
                            className="consistency-trend-path"
                            points={consistencySparkline.points}
                            fill="none"
                            stroke="url(#consistency-line-grad)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <polygon
                            className="consistency-trend-fill"
                            points={`${consistencySparkline.points} ${consistencySparkline.w},${consistencySparkline.h} 0,${consistencySparkline.h}`}
                            fill="url(#consistency-area-grad)"
                          />
                        </svg>
                      ) : (
                        <div className="sparkline-placeholder" aria-hidden="true" />
                      )}
                    </div>
                  </div>

                  <div className="card mini-card uniform-card">
                    <div className="stats-grid">
                      <div>
                        <p className="label">Avg</p>
                        <p className="value-lg">{hasReactions && reactionStats ? `${Math.round(reactionStats.avg)} ms` : "--"}</p>
                      </div>
                      <div>
                        <p className="label">Best</p>
                        <p className="value-lg">{hasReactions && reactionStats ? `${Math.round(reactionStats.best)} ms` : "--"}</p>
                      </div>
                      <div>
                        <p className="label">Slowest</p>
                        <p className="value-lg">{hasReactions && reactionStats ? `${Math.round(reactionStats.worst)} ms` : "--"}</p>
                      </div>
                      <div>
                        <p className="label">Median</p>
                        <p className="value-lg">{hasReactions && reactionStats ? `${Math.round(reactionStats.median)} ms` : "--"}</p>
                      </div>
                      <div>
                        <p className="label">Consistency (std dev)</p>
                        <p className="value-lg">
                          {hasReactions && reactionStats ? `${reactionStats.stddev.toFixed(1)} ms` : "--"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="card mini-card metrics-card uniform-card">
                    <div className="metric-grid">
                      <div>
                        <p className="label">Correct</p>
                        <p className="value-md">{accuracyStats.correct}</p>
                      </div>
                      <div>
                        <p className="label">Wrong</p>
                        <p className="value-md">{accuracyStats.wrong}</p>
                      </div>
                      <div>
                        <p className="label">Best Streak</p>
                        <p className="value-md">{bestStreak}</p>
                      </div>
                      <div>
                        <p className="label">Total Clicks</p>
                        <p className="value-md">{accuracyStats.total}</p>
                      </div>
                    </div>
                      <div className="accuracy">
                        <div className="accuracy-top">
                          <span className="label">Accuracy</span>
                          <span className="value-md">
                            {accuracyStats.accuracy == null ? "-" : `${accuracyStats.accuracy.toFixed(1)}%`}
                          </span>
                        </div>
                        <div
                          className="accuracy-bar"
                          role="progressbar"
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={accuracyStats.accuracy || 0}
                          data-accuracy={
                            accuracyStats.accuracy == null
                              ? "low"
                              : accuracyStats.accuracy >= 66
                                ? "high"
                                : accuracyStats.accuracy >= 33
                                  ? "mid"
                                  : "low"
                          }
                        >
                          <div
                            className="accuracy-fill"
                            style={{ width: `${Math.min(100, Math.max(0, accuracyStats.accuracy || 0))}%` }}
                          />
                      </div>
                    </div>
                  </div>

                  <div className="card distribution-card uniform-card">
                    <div className="section-heading">
                      <p className="label">Reaction-time distribution</p>
                    </div>
                    <div className="distribution-list">
                      {reactionTimeDistribution.map((bucket) => (
                        <div className="distribution-row" key={bucket.label}>
                          <span className="distribution-label">{bucket.label} ms</span>
                          <div className="distribution-bar" aria-hidden="true">
                            <span
                              className="distribution-fill"
                              style={{ width: `${bucket.ratio}%` }}
                            />
                          </div>
                          <span className="distribution-count">{bucket.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card heatmap-card uniform-card">
                    <div className="heatmap-inner">
                      <div className="section-heading">
                        <p className="label">Heatmap of misclicks</p>
                      </div>
                      <div className="heatmap-grid-wrap">
                        <div
                          className="heatmap-grid"
                          role="img"
                          aria-label="Misclick counts by cell"
                          style={{ "--heatmap-size": misclickHeatmap[0]?.length || size }}
                        >
                          {heatmapCells.map(({ rowIndex, colIndex, count }) => {
                            const intensity = misclickMax ? count / misclickMax : 0;
                            const backgroundColor =
                              count === 0
                                ? "var(--panel-2)"
                                : `rgba(239, 68, 68, ${Math.min(0.85, 0.25 + intensity * 0.55)})`;
                            return (
                              <span
                                key={`heat-${rowIndex}-${colIndex}`}
                                className="heatmap-cell"
                                style={{ backgroundColor }}
                                aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}: ${count} misclicks`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
              {activeTab === "highscores" && (
                <div className="card highscores-card">
                <div className="highscores-header">
                  <h2>High Scores ({leaderboardSize}x{leaderboardSize})</h2>
                  <label className="leaderboard-size-select">
                    <span className="muted small">View leaderboard for:</span>
                    <select
                      value={leaderboardSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLeaderboardSize(val);
                        fetchHighscores(val);
                      }}
                    >
                      {[3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <option key={`lb-${n}`} value={n}>
                          {n}x{n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="muted small">Scores are tracked separately for each grid size.</p>
                  {displayedHighscores.length === 0 ? (
                    <p className="muted">No scores yet.</p>
                  ) : (
                  <ol className="highscore-list">
                    {displayedHighscores.map((e, idx) => (
                      <li key={e.id} className="score-row">
                        <span className="rank">#{idx + 1}</span>
                        <span className="player">{e.name}</span>
                        <span className="value">{e.score}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

export default App;

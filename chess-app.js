(() => {
  "use strict";

  const SAVE_KEY = "local-games.chess.state.v1";
  const LEVELS = { easy: "入门", standard: "标准", hard: "进阶" };
  const GLYPHS = {
    wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
    bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
  };
  const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 30 };
  const boardEl = document.querySelector("#chess-board");
  const status = document.querySelector("#chess-status");
  const stateLabel = document.querySelector("#chess-state");
  const movesEl = document.querySelector("#chess-moves");
  const turnEl = document.querySelector("#chess-turn");
  const capturedEl = document.querySelector("#chess-captured");
  const timerEl = document.querySelector("#chess-timer");
  const feedback = document.querySelector("#chess-feedback");
  const newButton = document.querySelector("#chess-new");
  const undoButton = document.querySelector("#chess-undo");
  const difficultyInputs = [...document.querySelectorAll('input[name="chess-difficulty"]')];
  let engine;
  let level = "easy";
  let selected = null;
  let legalTargets = [];
  let history = [];
  let waiting = false;
  let aiTimer = null;
  let timerId = null;
  let startedAt = 0;
  let finished = false;

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function elapsed() {
    return startedAt ? Date.now() - startedAt : 0;
  }

  function startTimer() {
    if (startedAt || finished) return;
    startedAt = Date.now();
    timerId = window.setInterval(() => {
      timerEl.textContent = formatTime(elapsed());
    }, 250);
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
    startedAt = 0;
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ fen: engine.fen(), level, finished }));
    } catch {
      // Storage is optional.
    }
  }

  function createEngine() {
    const saved = (() => {
      try {
        return JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null");
      } catch {
        return null;
      }
    })();
    const initial = saved && LEVELS[saved.level] ? saved.level : window.location.hash.slice(1);
    level = LEVELS[initial] ? initial : "easy";
    try {
      engine = new ChessJS.Chess(initial && initial !== level ? undefined : saved?.fen || undefined);
    } catch {
      engine = new ChessJS.Chess();
    }
    difficultyInputs.forEach((input) => {
      input.checked = input.value === level;
    });
  }

  function capturedCount() {
    const board = engine.board().flat().filter(Boolean);
    const value = board.reduce((sum, piece) => sum + VALUES[piece.type], 0);
    return Math.max(0, 78 - value);
  }

  function render() {
    const board = engine.board();
    boardEl.replaceChildren();
    const legal = engine.moves({ verbose: true });
    board.forEach((row, rowIndex) => {
      row.forEach((piece, colIndex) => {
        const square = piece?.square || `${"abcdefgh"[colIndex]}${8 - rowIndex}`;
        const cell = document.createElement("div");
        cell.className = `chess-square ${(rowIndex + colIndex) % 2 ? "is-dark" : "is-light"}`;
        cell.dataset.square = square;
        cell.setAttribute("role", "gridcell");
        cell.tabIndex = 0;
        cell.setAttribute("aria-label", `${square}${piece ? `，${piece.color === "w" ? "白方" : "黑方"}${piece.type}` : "，空"}`);
        if (piece) {
          const glyph = document.createElement("span");
          glyph.className = `chess-piece is-${piece.color}`;
          glyph.textContent = GLYPHS[`${piece.color}${piece.type}`];
          cell.append(glyph);
        }
        if (square === selected) cell.classList.add("is-selected");
        if (legalTargets.includes(square)) cell.classList.add("is-target");
        cell.addEventListener("click", () => clickSquare(square));
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            clickSquare(square);
          }
        });
        boardEl.append(cell);
      });
    });
    movesEl.textContent = String(engine.history().length);
    turnEl.textContent = engine.turn() === "w" ? "白方" : "黑方";
    capturedEl.textContent = String(capturedCount());
    undoButton.disabled = history.length === 0 || waiting;
    boardEl.dataset.state = finished ? "finished" : waiting ? "waiting" : "playing";
  }

  function clickSquare(square) {
    if (waiting || finished || engine.turn() !== "w") return;
    if (selected && legalTargets.includes(square)) {
      makeHumanMove(selected, square);
      return;
    }
    const piece = engine.get(square);
    if (piece?.color === "w") {
      selected = square;
      legalTargets = engine.moves({ verbose: true, square }).map((move) => move.to);
      feedback.textContent = "选择亮点标记的落点。";
    } else {
      selected = null;
      legalTargets = [];
    }
    render();
  }

  function makeHumanMove(from, to) {
    history.push(engine.fen());
    if (history.length > 20) history.shift();
    startTimer();
    try {
      engine.move({ from, to, promotion: "q" });
    } catch {
      feedback.textContent = "这一步不符合国际象棋规则。";
      return;
    }
    selected = null;
    legalTargets = [];
    save();
    render();
    if (evaluateGameEnd()) return;
    waiting = true;
    status.textContent = "电脑思考中";
    stateLabel.textContent = "黑方回合";
    render();
    aiTimer = window.setTimeout(aiMove, 320);
  }

  function evaluatePosition(position) {
    let score = 0;
    position.board().forEach((row, rowIndex) => {
      row.forEach((piece, colIndex) => {
        if (!piece) return;
        let value = VALUES[piece.type] * 100;
        const centerDistance = Math.abs(colIndex - 3.5) + Math.abs(rowIndex - 3.5);
        if (piece.type === "p") {
          value += piece.color === "w" ? (6 - rowIndex) * 7 : (rowIndex - 1) * 7;
        } else if (piece.type === "n" || piece.type === "b") {
          value += Math.max(0, 12 - centerDistance * 2);
        } else if (piece.type === "k") {
          value += Math.max(0, 8 - centerDistance);
        }
        score += piece.color === "w" ? value : -value;
      });
    });
    return position.turn() === "w" ? score : -score;
  }

  function orderedMoves(position) {
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
    return position.moves({ verbose: true }).sort((a, b) =>
      (values[b.captured] || 0) - (values[a.captured] || 0)
      || Number(b.san.includes("+")) - Number(a.san.includes("+")));
  }

  function searchPosition(position, depth, alpha, beta) {
    if (position.isCheckmate()) return -100000 - depth * 100;
    if (position.isDraw() || position.isStalemate()) return 0;
    if (depth === 0) return evaluatePosition(position);

    let best = -Infinity;
    for (const move of orderedMoves(position)) {
      position.move({ from: move.from, to: move.to, promotion: move.promotion });
      const score = -searchPosition(position, depth - 1, -beta, -alpha);
      position.undo();
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  function aiMove() {
    if (finished) return;
    const moves = engine.moves({ verbose: true });
    if (!moves.length) {
      waiting = false;
      evaluateGameEnd();
      return;
    }
    let move;
    if (level === "easy") {
      move = moves[Math.floor(Math.random() * moves.length)];
    } else {
      const search = new ChessJS.Chess(engine.fen());
      const depth = level === "hard" ? 3 : 2;
      let bestScore = -Infinity;
      const candidates = orderedMoves(search);
      for (const candidate of candidates) {
        search.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion });
        const score = -searchPosition(search, depth - 1, -Infinity, Infinity);
        search.undo();
        if (score > bestScore) {
          bestScore = score;
          move = candidate;
        }
      }
    }
    engine.move({ from: move.from, to: move.to, promotion: "q" });
    waiting = false;
    status.textContent = "轮到你落子";
    stateLabel.textContent = "进行中";
    save();
    render();
    evaluateGameEnd();
  }

  function evaluateGameEnd() {
    if (!engine.isGameOver()) return false;
    finished = true;
    stopTimer();
    let message = "本局结束";
    if (engine.isCheckmate()) message = engine.turn() === "w" ? "黑方将死白方" : "白方将死黑方";
    else if (engine.isStalemate()) message = "逼和";
    else if (engine.isThreefoldRepetition()) message = "三次重复，和棋";
    else if (engine.isDraw()) message = "和棋";
    status.textContent = message;
    stateLabel.textContent = "已结束";
    feedback.textContent = message;
    save();
    render();
    const levels = ["easy", "standard", "hard"];
    const playerWon = message === "白方将死黑方";
    const next = playerWon ? levels[levels.indexOf(level) + 1] : undefined;
    window.GameCompletion?.show({
      title: playerWon ? "国际象棋完成" : "国际象棋结束",
      message: `${message}${next ? `。下一档是${LEVELS[next]}。` : ""}`,
      primaryText: next ? `进入${LEVELS[next]}` : "再来一局",
      secondaryText: "留在这里",
      onPrimary: () => newGame(next || level),
    });
    return true;
  }

  function newGame(nextLevel = level) {
    if (aiTimer) window.clearTimeout(aiTimer);
    stopTimer();
    level = LEVELS[nextLevel] ? nextLevel : "easy";
    engine = new ChessJS.Chess();
    selected = null;
    legalTargets = [];
    history = [];
    waiting = false;
    finished = false;
    timerEl.textContent = "00:00";
    window.history.replaceState(null, "", `#${level}`);
    difficultyInputs.forEach((input) => {
      input.checked = input.value === level;
    });
    status.textContent = "白方先行";
    stateLabel.textContent = "进行中";
    feedback.textContent = "你执白棋，点击棋子后选择落点。";
    save();
    render();
  }

  function undo() {
    const fen = history.pop();
    if (!fen) return;
    if (aiTimer) window.clearTimeout(aiTimer);
    engine = new ChessJS.Chess(fen);
    selected = null;
    legalTargets = [];
    waiting = false;
    finished = false;
    status.textContent = "白方先行";
    stateLabel.textContent = "进行中";
    feedback.textContent = "已撤销上一回合。";
    save();
    render();
  }

  newButton.addEventListener("click", () => newGame());
  undoButton.addEventListener("click", undo);
  difficultyInputs.forEach((input) => {
    input.addEventListener("change", () => input.checked && newGame(input.value));
  });
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === "r") newGame();
    if (event.key.toLowerCase() === "u") undo();
  });

  createEngine();
  if (engine.isGameOver()) finished = true;
  render();
  if (!finished && engine.turn() === "b") {
    waiting = true;
    render();
    aiTimer = window.setTimeout(aiMove, 320);
  }
  if (new URLSearchParams(window.location.search).has("test")) {
    window.__chessTest = { getFen: () => engine.fen(), getLevel: () => level };
  }
})();

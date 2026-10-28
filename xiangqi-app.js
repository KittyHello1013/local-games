(() => {
  "use strict";

  const SAVE_KEY = "local-games.xiangqi.state.v1";
  const LEVELS = { easy: "入门", standard: "标准", hard: "进阶" };
  const NAMES = {
    wk: "帅", wa: "仕", wb: "相", wn: "马", wr: "车", wc: "炮", wp: "兵",
    bk: "将", ba: "士", bb: "象", bn: "马", br: "车", bc: "炮", bp: "卒",
  };
  const VALUES = { p: 1, n: 4, b: 2, a: 2, r: 9, c: 4.5, k: 30 };
  const boardEl = document.querySelector("#xiangqi-board");
  const gridEl = document.querySelector(".xiangqi-grid");
  const pointsEl = document.querySelector("#xiangqi-points");
  const status = document.querySelector("#xiangqi-status");
  const stateLabel = document.querySelector("#xiangqi-state");
  const movesEl = document.querySelector("#xiangqi-moves");
  const turnEl = document.querySelector("#xiangqi-turn");
  const timerEl = document.querySelector("#xiangqi-timer");
  const redEl = document.querySelector("#xiangqi-red");
  const blackEl = document.querySelector("#xiangqi-black");
  const feedback = document.querySelector("#xiangqi-feedback");
  const lead = document.querySelector("#xiangqi-lead");
  const historyEl = document.querySelector("#xiangqi-history");
  const boardShell = document.querySelector(".xiangqi-board-shell");
  const newButton = document.querySelector("#xiangqi-new");
  const undoButton = document.querySelector("#xiangqi-undo");
  const difficultyInputs = [...document.querySelectorAll('input[name="xiangqi-difficulty"]')];
  const modeInputs = [...document.querySelectorAll('input[name="xiangqi-mode"]')];
  let engine;
  let level = "easy";
  let mode = "ai";
  let selected = null;
  let targets = [];
  let history = [];
  let moveLog = [];
  let lastMove = null;
  let waiting = false;
  let finished = false;
  let aiTimer = null;
  let startedAt = 0;
  let timerId = null;

  function elapsed() {
    return startedAt ? Date.now() - startedAt : 0;
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
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
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        fen: engine.fen(),
        level,
        mode,
        finished,
        moveLog,
        lastMove,
      }));
    } catch {
      // Storage is optional.
    }
  }

  function init() {
    let saved = null;
    try {
      saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null");
    } catch {
      saved = null;
    }
    const hash = window.location.hash.slice(1);
    level = saved && LEVELS[saved.level] ? saved.level : LEVELS[hash] ? hash : "easy";
    mode = saved?.mode === "pvp" ? "pvp" : "ai";
    engine = new XiangqiJS.Chess(saved && LEVELS[saved.level] ? saved.fen : undefined);
    finished = Boolean(saved?.finished);
    moveLog = Array.isArray(saved?.moveLog) ? saved.moveLog.slice() : [];
    lastMove = saved?.lastMove || null;
    difficultyInputs.forEach((input) => {
      input.checked = input.value === level;
    });
    modeInputs.forEach((input) => {
      input.checked = input.value === mode;
    });
  }

  function buildGrid() {
    const lines = [];
    for (let col = 0; col < 9; col += 1) {
      lines.push(`<line x1="${col * 100}" y1="0" x2="${col * 100}" y2="900"/>`);
    }
    for (let row = 0; row < 10; row += 1) {
      lines.push(`<line x1="0" y1="${row * 100}" x2="800" y2="${row * 100}"/>`);
    }
    lines.push(
      '<path d="M300 0 500 200M500 0 300 200M300 700 500 900M500 700 300 900"/>',
    );
    const markers = [];
    const points = [
      [1, 2], [7, 2],
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
      [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
      [1, 7], [7, 7],
    ];
    for (const [col, row] of points) {
      const x = col * 100;
      const y = row * 100;
      const low = 18;
      const high = 34;
      if (x > 0) markers.push(`<path d="M${x - high} ${y - low}h${high - low}M${x - high} ${y + low}h${high - low}"/>`);
      if (x < 800) markers.push(`<path d="M${x + low} ${y - low}h${high - low}M${x + low} ${y + low}h${high - low}"/>`);
      markers.push(`<path d="M${x} ${y - high}v${high - low}M${x} ${y + low}v${high - low}"/>`);
    }
    gridEl.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="2">${lines.join("")}${markers.join("")}</g>`;
  }

  function render() {
    const board = engine.board();
    pointsEl.replaceChildren();
    board.forEach((row, rowIndex) => {
      row.forEach((piece, colIndex) => {
        const square = piece?.square || squareForPosition(rowIndex * 9 + colIndex);
        const cell = document.createElement("div");
        cell.className = "xiangqi-cell";
        cell.dataset.square = square;
        cell.style.setProperty("--row", String(rowIndex));
        cell.style.setProperty("--col", String(colIndex));
        cell.setAttribute("role", "gridcell");
        cell.tabIndex = 0;
        cell.setAttribute("aria-label", `${square}${piece ? `，${NAMES[`${piece.color}${piece.type}`]}` : "，空"}`);
        if (piece) {
          const token = document.createElement("span");
          token.className = `xiangqi-piece is-${piece.color}`;
          token.textContent = NAMES[`${piece.color}${piece.type}`] || piece.type;
          cell.append(token);
        }
        if (square === selected) cell.classList.add("is-selected");
        if (targets.includes(square)) cell.classList.add("is-target");
        if (lastMove?.from === square) cell.classList.add("is-last-from");
        if (lastMove?.to === square) cell.classList.add("is-last-to");
        cell.addEventListener("click", () => clickSquare(square));
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            clickSquare(square);
          }
        });
        pointsEl.append(cell);
      });
    });
    movesEl.textContent = String(engine.history().length);
    turnEl.textContent = engine.turn() === "w" ? "红方" : "黑方";
    const pieces = board.flat().filter(Boolean);
    redEl.textContent = String(pieces.filter((piece) => piece.color === "w").length);
    blackEl.textContent = String(pieces.filter((piece) => piece.color === "b").length);
    undoButton.disabled = history.length === 0 || waiting;
    boardEl.dataset.state = finished ? "finished" : waiting ? "waiting" : "playing";
    historyEl.replaceChildren();
    if (!moveLog.length) {
      const item = document.createElement("li");
      item.textContent = "尚未走棋";
      historyEl.append(item);
    } else {
      moveLog.forEach((entry, index) => {
        const item = document.createElement("li");
        item.textContent = `${index + 1}. ${entry}`;
        historyEl.append(item);
      });
      historyEl.scrollTop = historyEl.scrollHeight;
    }
    difficultyInputs.forEach((input) => {
      input.disabled = mode === "pvp";
    });
    lead.textContent = mode === "pvp"
      ? "红黑双方共用这台设备轮流走棋。"
      : "你执红棋，对阵黑方电脑。";
  }

  function squareForPosition(index) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    return `${"abcdefghi"[col]}${9 - row}`;
  }

  function clickSquare(square) {
    if (waiting || finished || (mode === "ai" && engine.turn() !== "w")) return;
    if (selected && targets.includes(square)) {
      makeHumanMove(selected, square);
      return;
    }
    const piece = engine.get(square);
    if (piece?.color === engine.turn()) {
      selected = square;
      targets = engine.moves({ verbose: true, square }).map((move) => move.to);
      feedback.textContent = "选择高亮位置移动。";
    } else {
      selected = null;
      targets = [];
    }
    render();
  }

  function animateMove(from, to, glyph, color) {
    const source = boardEl.querySelector(`[data-square="${from}"]`);
    const destination = boardEl.querySelector(`[data-square="${to}"]`);
    const arriving = destination?.querySelector(".xiangqi-piece");
    if (!source || !destination || !arriving || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return Promise.resolve();
    }
    const sourceRect = source.getBoundingClientRect();
    const destinationRect = destination.getBoundingClientRect();
    const shellRect = boardShell.getBoundingClientRect();
    const size = Math.min(sourceRect.width, sourceRect.height) * 0.82;
    const moving = document.createElement("span");
    moving.className = `xiangqi-moving-piece is-${color}`;
    moving.textContent = glyph;
    moving.style.width = `${size}px`;
    moving.style.height = `${size}px`;
    moving.style.left = `${sourceRect.left - shellRect.left + (sourceRect.width - size) / 2}px`;
    moving.style.top = `${sourceRect.top - shellRect.top + (sourceRect.height - size) / 2}px`;
    boardShell.append(moving);
    arriving.style.visibility = "hidden";
    const dx = destinationRect.left - sourceRect.left;
    const dy = destinationRect.top - sourceRect.top;
    const animation = moving.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${dx}px, ${dy}px)` },
      ],
      { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
    return animation.finished.catch(() => {}).finally(() => {
      moving.remove();
      arriving.style.visibility = "";
    });
  }

  function executeMove(from, to, recordHistory) {
    const piece = engine.get(from);
    if (!piece) return Promise.resolve(false);
    const before = engine.fen();
    let result;
    try {
      result = engine.move({ from, to });
    } catch {
      feedback.textContent = "这一步不符合中国象棋规则。";
      return Promise.resolve(false);
    }
    if (recordHistory) {
      history.push({ fen: before, moveLog: moveLog.slice(), lastMove });
      if (history.length > 20) history.shift();
    }
    startTimer();
    selected = null;
    targets = [];
    lastMove = { from, to };
    const side = piece.color === "w" ? "红方" : "黑方";
    const label = result.zh || `${NAMES[`${piece.color}${piece.type}`]} ${from} 到 ${to}`;
    moveLog.push(`${side} ${label}`);
    feedback.textContent = `${side}：${label}`;
    if (moveLog.length > 80) moveLog.shift();
    save();
    render();
    return animateMove(from, to, NAMES[`${piece.color}${piece.type}`], piece.color)
      .then(() => true);
  }

  function makeHumanMove(from, to) {
    waiting = true;
    executeMove(from, to, mode === "ai" || mode === "pvp").then((moved) => {
      if (!moved) {
        waiting = false;
        render();
        return;
      }
      if (evaluateEnd()) return;
      if (mode === "ai" && engine.turn() === "b") {
        status.textContent = "电脑思考中";
        stateLabel.textContent = "黑方回合";
        render();
        aiTimer = window.setTimeout(aiMove, 120);
      } else {
        waiting = false;
        status.textContent = engine.turn() === "w" ? "轮到红方" : "轮到黑方";
        stateLabel.textContent = "进行中";
        render();
      }
    });
  }

  function evaluatePosition(position) {
    let score = 0;
    position.board().forEach((row, rowIndex) => {
      row.forEach((piece, colIndex) => {
        if (!piece) return;
        let value = (VALUES[piece.type] || 0) * 100;
        const centerDistance = Math.abs(colIndex - 4);
        if (piece.type === "p") {
          value += piece.color === "w" ? (9 - rowIndex) * 6 : rowIndex * 6;
        } else if (piece.type === "n" || piece.type === "c") {
          value += Math.max(0, 14 - centerDistance * 2);
        } else if (piece.type === "k") {
          value += Math.max(0, 7 - centerDistance);
        }
        score += piece.color === "w" ? value : -value;
      });
    });
    return position.turn() === "w" ? score : -score;
  }

  function orderedMoves(position) {
    return position.moves({ verbose: true }).sort((a, b) =>
      (VALUES[b.captured] || 0) - (VALUES[a.captured] || 0)
      || Number(Boolean(b.isCheck)) - Number(Boolean(a.isCheck)));
  }

  function searchPosition(position, depth, alpha, beta) {
    if (position.isCheckmate()) return -100000 - depth * 100;
    if (position.isDraw() || position.isStalemate()) return 0;
    if (depth === 0) return evaluatePosition(position);

    let best = -Infinity;
    for (const move of orderedMoves(position)) {
      position.move({ from: move.from, to: move.to });
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
      evaluateEnd();
      return;
    }
    let move;
    if (level === "easy") {
      move = moves[Math.floor(Math.random() * moves.length)];
    } else {
      const search = new XiangqiJS.Chess(engine.fen());
      const depth = level === "hard" ? 3 : 2;
      let bestScore = -Infinity;
      const candidates = orderedMoves(search);
      for (const candidate of candidates) {
        search.move({ from: candidate.from, to: candidate.to });
        const score = -searchPosition(search, depth - 1, -Infinity, Infinity);
        search.undo();
        if (score > bestScore) {
          bestScore = score;
          move = candidate;
        }
      }
    }
    executeMove(move.from, move.to, false).then((moved) => {
      if (!moved) {
        waiting = false;
        render();
        return;
      }
      if (evaluateEnd()) return;
      waiting = false;
      status.textContent = "轮到你落子";
      stateLabel.textContent = "进行中";
      render();
    });
  }

  function evaluateEnd() {
    if (!engine.isGameOver()) return false;
    finished = true;
    stopTimer();
    let message = "本局结束";
    if (engine.isCheckmate()) {
      message = mode === "pvp"
        ? `${engine.turn() === "w" ? "黑方" : "红方"}获胜`
        : engine.turn() === "w" ? "红方被将死" : "黑方被将死，你获胜";
    }
    else if (engine.isStalemate()) message = "困毙";
    else if (engine.isDraw()) message = "和棋";
    status.textContent = message;
    stateLabel.textContent = "已结束";
    feedback.textContent = message;
    save();
    render();
    const levels = ["easy", "standard", "hard"];
    const playerWon = mode === "ai" && message === "黑方被将死，你获胜";
    const next = playerWon ? levels[levels.indexOf(level) + 1] : undefined;
    window.GameCompletion?.show({
      title: mode === "pvp" ? "双人对局结束" : playerWon ? "中国象棋完成" : "中国象棋结束",
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
    engine = new XiangqiJS.Chess();
    selected = null;
    targets = [];
    history = [];
    moveLog = [];
    lastMove = null;
    waiting = false;
    finished = false;
    timerEl.textContent = "00:00";
    window.history.replaceState(null, "", `#${level}`);
    difficultyInputs.forEach((input) => {
      input.checked = input.value === level;
    });
    modeInputs.forEach((input) => {
      input.checked = input.value === mode;
    });
    status.textContent = "红方先行";
    stateLabel.textContent = "进行中";
    feedback.textContent = mode === "ai"
      ? "你执红棋，点击棋子后选择落点。"
      : "双人模式：红方和黑方轮流在当前设备走棋。";
    save();
    render();
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    if (aiTimer) window.clearTimeout(aiTimer);
    engine = new XiangqiJS.Chess(previous.fen);
    moveLog = previous.moveLog;
    lastMove = previous.lastMove;
    selected = null;
    targets = [];
    waiting = false;
    finished = false;
    status.textContent = "红方先行";
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
  modeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      mode = input.value;
      newGame(level);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === "r") newGame();
    if (event.key.toLowerCase() === "u") undo();
  });

  buildGrid();
  init();
  render();
  if (!finished && mode === "ai" && engine.turn() === "b") {
    waiting = true;
    render();
    aiTimer = window.setTimeout(aiMove, 320);
  }
  if (new URLSearchParams(window.location.search).has("test")) {
    window.__xiangqiTest = {
      getFen: () => engine.fen(),
      getLevel: () => level,
      getMode: () => mode,
      setMode: (nextMode) => {
        mode = nextMode;
        newGame(level);
      },
    };
  }
})();

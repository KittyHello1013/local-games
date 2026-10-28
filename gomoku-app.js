(() => {
  "use strict";

  const SAVE_KEY = "local-games.gomoku.state.v1";
  const boardEl = document.querySelector("#gomoku-board");
  const status = document.querySelector("#gomoku-status");
  const stateLabel = document.querySelector("#gomoku-state");
  const movesEl = document.querySelector("#gomoku-moves");
  const blackEl = document.querySelector("#gomoku-black");
  const whiteEl = document.querySelector("#gomoku-white");
  const timerEl = document.querySelector("#gomoku-timer");
  const feedback = document.querySelector("#gomoku-feedback");
  const lead = document.querySelector("#gomoku-lead");
  const newButton = document.querySelector("#gomoku-new");
  const undoButton = document.querySelector("#gomoku-undo");
  const historyEl = document.querySelector("#gomoku-history");
  const difficultyInputs = [...document.querySelectorAll('input[name="gomoku-difficulty"]')];
  const modeInputs = [...document.querySelectorAll('input[name="gomoku-mode"]')];
  let history = [];
  let timerId = null;
  let aiTimer = null;
  let winIndices = [];
  let lastMove = null;
  let moveLog = [];

  const state = {
    level: "easy",
    size: 15,
    mode: "ai",
    board: [],
    moves: 0,
    elapsedMs: 0,
    startedAt: 0,
    finished: false,
    waitingAi: false,
  };

  function elapsed() {
    return state.startedAt ? Date.now() - state.startedAt : state.elapsedMs;
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function startTimer() {
    if (state.startedAt || state.finished) return;
    state.startedAt = Date.now();
    timerId = window.setInterval(() => {
      timerEl.textContent = formatTime(elapsed());
    }, 250);
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
    if (state.startedAt) {
      state.elapsedMs = Date.now() - state.startedAt;
      state.startedAt = 0;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        level: state.level,
        mode: state.mode,
        board: state.board,
        moves: state.moves,
        elapsedMs: elapsed(),
        finished: state.finished,
        lastMove,
        moveLog,
      }));
    } catch {
      // Storage is optional.
    }
  }

  function loadSave() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null");
      return saved && Gomoku.LEVELS[saved.level]
        && Array.isArray(saved.board)
        && saved.board.length === Gomoku.LEVELS[saved.level].size ** 2 ? saved : null;
    } catch {
      return null;
    }
  }

  function render() {
    boardEl.replaceChildren();
    boardEl.style.gridTemplateColumns = `repeat(${state.size}, minmax(0, 1fr))`;
    boardEl.setAttribute("aria-label", `${state.size} 路五子棋棋盘`);
    state.board.forEach((value, index) => {
      const cell = document.createElement("div");
      cell.className = "gomoku-cell";
      cell.dataset.index = String(index);
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = 0;
      if (value) cell.classList.add(value === 1 ? "is-black" : "is-white");
      if (winIndices.includes(index)) cell.classList.add("is-win");
      if (lastMove === index) cell.classList.add("is-last");
      cell.setAttribute("aria-label", `第 ${Math.floor(index / state.size) + 1} 行第 ${index % state.size + 1} 列，${value === 1 ? "黑棋" : value === 2 ? "白棋" : "空"}`);
      cell.addEventListener("click", () => playHuman(index));
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          playHuman(index);
        }
      });
      boardEl.append(cell);
    });
    movesEl.textContent = String(state.moves);
    blackEl.textContent = String(state.board.filter((value) => value === 1).length);
    whiteEl.textContent = String(state.board.filter((value) => value === 2).length);
    timerEl.textContent = formatTime(elapsed());
    undoButton.disabled = history.length === 0 || state.waitingAi;
    boardEl.dataset.state = state.finished ? "finished" : state.waitingAi ? "waiting" : "playing";
    historyEl.replaceChildren();
    if (!moveLog.length) {
      const item = document.createElement("li");
      item.textContent = "尚未落子";
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
      input.disabled = state.mode === "pvp";
    });
    lead.textContent = state.mode === "pvp"
      ? "黑白双方共用这台设备轮流落子。"
      : "你执黑棋，先连成五子。";
  }

  function finish(message, win) {
    state.finished = true;
    state.waitingAi = false;
    stopTimer();
    winIndices = win;
    status.textContent = message;
    stateLabel.textContent = message;
    feedback.textContent = message;
    save();
    render();

    const levels = ["easy", "standard", "hard"];
    const playerWon = state.mode === "ai" && message === "你赢了";
    const nextLevel = playerWon ? levels[levels.indexOf(state.level) + 1] : undefined;
    window.GameCompletion?.show({
      title: state.mode === "pvp" ? "双人对局结束" : playerWon ? "五子棋完成" : "五子棋结束",
      message: `${message}${nextLevel ? `。下一档是 ${Gomoku.LEVELS[nextLevel].label}。` : ""}`,
      primaryText: nextLevel ? `进入${Gomoku.LEVELS[nextLevel].label}` : "再来一局",
      secondaryText: "留在这里",
      onPrimary: () => newGame(nextLevel || state.level),
    });
  }

  function place(index, player) {
    if (state.finished || state.board[index]) return false;
    state.board[index] = player;
    state.moves += 1;
    lastMove = index;
    const row = Math.floor(index / state.size) + 1;
    const col = index % state.size + 1;
    moveLog.push(`${player === 1 ? "黑方" : "白方"} ${row}行${col}列`);
    if (moveLog.length > 100) moveLog.shift();
    startTimer();
    const win = Gomoku.winLine(state.board, state.size, index, player);
    if (win.length) {
      finish(
        state.mode === "pvp" ? `${player === 1 ? "黑方" : "白方"}获胜` : player === 1 ? "你赢了" : "电脑获胜",
        win,
      );
      return true;
    }
    if (!state.board.includes(0)) {
      finish("棋盘已满，本局平局", []);
      return true;
    }
    return false;
  }

  function playHuman(index) {
    if (state.waitingAi || state.finished || state.board[index]) return;
    history.push({
      board: state.board.slice(),
      moves: state.moves,
      elapsedMs: elapsed(),
      lastMove,
      moveLog: moveLog.slice(),
    });
    if (history.length > 20) history.shift();
    const player = state.mode === "pvp" && state.moves % 2 === 1 ? 2 : 1;
    if (place(index, player)) {
      save();
      render();
      return;
    }
    if (state.mode === "pvp") {
      state.waitingAi = false;
      status.textContent = player === 1 ? "轮到白方落子" : "轮到黑方落子";
      stateLabel.textContent = "进行中";
      save();
      render();
      return;
    }
    state.waitingAi = true;
    save();
    render();
    aiTimer = window.setTimeout(() => {
      const rank = Gomoku.LEVELS[state.level]?.rank || 9;
      const move = Gomoku.chooseMove(state.board, state.size, rank);
      if (move >= 0) place(move, 2);
      state.waitingAi = false;
      save();
      render();
    }, 220);
  }

  function newGame(level = state.level) {
    if (timerId) window.clearInterval(timerId);
    if (aiTimer) window.clearTimeout(aiTimer);
    const config = Gomoku.LEVELS[level] || Gomoku.LEVELS.easy;
    state.level = level;
    state.size = config.size;
    state.board = Gomoku.createBoard(state.size);
    state.moves = 0;
    state.elapsedMs = 0;
    state.startedAt = 0;
    state.finished = false;
    state.waitingAi = false;
    history = [];
    winIndices = [];
    lastMove = null;
    moveLog = [];
    window.history.replaceState(null, "", `#${level}`);
    status.textContent = state.mode === "pvp" ? "轮到你落子" : "轮到你落子";
    stateLabel.textContent = "进行中";
    feedback.textContent = state.mode === "pvp"
      ? "双人模式：黑白双方轮流落子。"
      : "你执黑先行，连成五子获胜。";
    save();
    render();
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    if (aiTimer) window.clearTimeout(aiTimer);
    state.board = previous.board;
    state.moves = previous.moves;
    state.elapsedMs = previous.elapsedMs;
    lastMove = previous.lastMove;
    moveLog = previous.moveLog;
    state.startedAt = 0;
    state.finished = false;
    state.waitingAi = false;
    winIndices = [];
    status.textContent = "轮到你落子";
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
      state.mode = input.value;
      newGame(state.level);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === "r") newGame();
    if (event.key.toLowerCase() === "u") undo();
  });

  const saved = loadSave();
  const hash = window.location.hash.slice(1);
  const initial = saved ? saved.level : Gomoku.LEVELS[hash] ? hash : "easy";
  state.level = initial;
  state.mode = saved?.mode === "pvp" ? "pvp" : "ai";
  difficultyInputs.forEach((input) => {
    input.checked = input.value === initial;
  });
  modeInputs.forEach((input) => {
    input.checked = input.value === state.mode;
  });
  if (saved) {
    state.level = saved.level;
    state.size = Gomoku.LEVELS[saved.level].size;
    state.board = saved.board;
    state.moves = Number(saved.moves) || 0;
    state.elapsedMs = Number(saved.elapsedMs) || 0;
    state.finished = Boolean(saved.finished);
    lastMove = Number.isInteger(saved.lastMove) ? saved.lastMove : null;
    moveLog = Array.isArray(saved.moveLog) ? saved.moveLog.slice() : [];
    status.textContent = state.finished ? "本局已结束" : "轮到你落子";
    stateLabel.textContent = state.finished ? "已结束" : "进行中";
    feedback.textContent = state.finished ? "开始新一局继续。" : "已恢复上次局面。";
    render();
  } else {
    newGame(initial);
  }
})();

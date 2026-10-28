(() => {
  "use strict";

  const LEVELS = {
    beginner: { rows: 9, cols: 9, mines: 10, label: "初级" },
    intermediate: { rows: 16, cols: 16, mines: 40, label: "中级" },
    expert: { rows: 16, cols: 30, mines: 99, label: "高级" },
  };

  const STORAGE_KEY = "local-games.minesweeper.best.v1";
  const board = document.querySelector("#board");
  const boardScroll = document.querySelector(".board-scroll");
  const boardStatus = document.querySelector("#board-status");
  const boardSize = document.querySelector("#board-size");
  const stateLabel = document.querySelector("#state-label");
  const minesLeft = document.querySelector("#mines-left");
  const timerEl = document.querySelector("#timer");
  const revealedCountEl = document.querySelector("#revealed-count");
  const bestTimeEl = document.querySelector("#best-time");
  const feedbackEl = document.querySelector("#feedback");
  const restartButton = document.querySelector("#restart");
  const flagModeButton = document.querySelector("#flag-mode");
  const difficultyInputs = [...document.querySelectorAll('input[name="difficulty"]')];

  let level = getInitialLevel();
  let cells = [];
  let currentFocus = 0;
  let timerId = null;
  let longPressTimer = null;
  let suppressClick = false;
  let flagMode = false;

  const state = {
    rows: 0,
    cols: 0,
    mineCount: 0,
    mines: [],
    counts: [],
    revealed: [],
    flagged: [],
    initialized: false,
    finished: false,
    result: "ready",
    explodedIndex: -1,
    revealedSafe: 0,
    startedAt: 0,
    elapsedMs: 0,
  };

  function getInitialLevel() {
    const hashLevel = window.location.hash.replace("#", "");
    if (LEVELS[hashLevel]) return hashLevel;

    try {
      const saved = window.localStorage.getItem("local-games.minesweeper.level");
      if (LEVELS[saved]) return saved;
    } catch {
      // The game still works when browser storage is unavailable.
    }

    return "beginner";
  }

  function readBestTimes() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeBestTimes(times) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
    } catch {
      // Best times are a convenience; the current game does not depend on them.
    }
  }

  function saveLevel(nextLevel) {
    try {
      window.localStorage.setItem("local-games.minesweeper.level", nextLevel);
    } catch {
      // URL state remains available if local storage is disabled.
    }

    try {
      window.history.replaceState(null, "", `#${nextLevel}`);
    } catch {
      window.location.hash = nextLevel;
    }
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getNeighbors(index) {
    const row = Math.floor(index / state.cols);
    const col = index % state.cols;
    const neighbors = [];

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (nextRow < 0 || nextRow >= state.rows || nextCol < 0 || nextCol >= state.cols) continue;
        neighbors.push(nextRow * state.cols + nextCol);
      }
    }

    return neighbors;
  }

  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
    }
    return values;
  }

  function initializeMines(safeIndex) {
    const safeArea = new Set([safeIndex, ...getNeighbors(safeIndex)]);
    let candidates = [];

    for (let index = 0; index < state.rows * state.cols; index += 1) {
      if (!safeArea.has(index)) candidates.push(index);
    }

    if (candidates.length < state.mineCount) {
      candidates = Array.from({ length: state.rows * state.cols }, (_, index) => index)
        .filter((index) => index !== safeIndex);
    }

    shuffle(candidates);
    state.mines = candidates.slice(0, state.mineCount);
    state.counts = Array(state.rows * state.cols).fill(0);

    for (const mineIndex of state.mines) {
      for (const neighborIndex of getNeighbors(mineIndex)) {
        state.counts[neighborIndex] += 1;
      }
    }

    state.initialized = true;
  }

  function startTimer() {
    if (state.startedAt || state.finished) return;
    state.startedAt = Date.now();
    timerId = window.setInterval(renderTimer, 250);
    renderTimer();
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
    state.elapsedMs = state.startedAt ? Date.now() - state.startedAt : state.elapsedMs;
  }

  function renderTimer() {
    const elapsed = state.startedAt && !state.finished
      ? Date.now() - state.startedAt
      : state.elapsedMs;
    timerEl.textContent = formatTime(elapsed);
  }

  function setFeedback(message) {
    feedbackEl.textContent = message;
  }

  function setStatus(text, label, result) {
    boardStatus.textContent = text;
    stateLabel.textContent = label;
    board.dataset.state = result;
  }

  function revealCell(index) {
    if (state.flagged[index] || state.revealed[index]) return false;

    if (state.mines.includes(index)) {
      state.revealed[index] = true;
      state.explodedIndex = index;
      loseGame();
      return false;
    }

    const queue = [index];

    while (queue.length) {
      const next = queue.pop();
      if (state.revealed[next] || state.flagged[next] || state.mines.includes(next)) continue;
      state.revealed[next] = true;
      state.revealedSafe += 1;
      if (state.counts[next] === 0) {
        for (const neighbor of getNeighbors(next)) {
          if (!state.revealed[neighbor] && !state.flagged[neighbor]) queue.push(neighbor);
        }
      }
    }

    return true;
  }

  function chordCell(index) {
    if (!state.revealed[index] || state.counts[index] === 0) return;
    const neighbors = getNeighbors(index);
    const flags = neighbors.filter((neighbor) => state.flagged[neighbor]).length;
    if (flags !== state.counts[index]) return;

    for (const neighbor of neighbors) {
      if (!state.revealed[neighbor] && !state.flagged[neighbor]) {
        revealCell(neighbor);
        if (state.finished) return;
      }
    }

    checkWin();
    render();
  }

  function revealAt(index) {
    if (state.finished) return;
    if (state.flagged[index]) return;

    if (!state.initialized) {
      initializeMines(index);
      setStatus("游戏进行中", "进行中", "playing");
      setFeedback("计时开始。数字表示相邻地雷数量。");
    }

    startTimer();

    if (state.revealed[index]) {
      chordCell(index);
      return;
    }

    revealCell(index);
    if (state.finished) return;
    checkWin();
    render();
  }

  function toggleFlag(index) {
    if (state.finished || state.revealed[index]) return;
    state.flagged[index] = !state.flagged[index];
    setFeedback(state.flagged[index] ? "已插旗。" : "已取消标记。");
    render();
  }

  function checkWin() {
    const safeTotal = state.rows * state.cols - state.mineCount;
    if (state.revealedSafe !== safeTotal) return;

    state.finished = true;
    state.result = "won";
    stopTimer();

    for (const mineIndex of state.mines) state.flagged[mineIndex] = true;

    const bestTimes = readBestTimes();
    const previous = Number(bestTimes[level]);
    const seconds = Math.max(1, Math.floor(state.elapsedMs / 1000));
    if (!previous || seconds < previous) {
      bestTimes[level] = seconds;
      writeBestTimes(bestTimes);
    }

    setStatus("全部安全格已翻开", "已胜利", "won");
    setFeedback(`胜利。用时 ${formatTime(state.elapsedMs)}。`);
    render();

    const levelOrder = Object.keys(LEVELS);
    const nextLevel = levelOrder[levelOrder.indexOf(level) + 1];
    window.GameCompletion?.show({
      title: "扫雷完成",
      message: `本局用时 ${formatTime(state.elapsedMs)}。${nextLevel ? `下一档是${LEVELS[nextLevel].label}。` : "已经是最高难度。"}`,
      primaryText: nextLevel ? `进入${LEVELS[nextLevel].label}` : "再来一局",
      secondaryText: "留在这里",
      onPrimary: () => {
        if (!nextLevel) {
          restartGame();
          return;
        }
        level = nextLevel;
        saveLevel(level);
        difficultyInputs.forEach((input) => {
          input.checked = input.value === level;
        });
        restartGame({ focusBoard: false });
      },
    });
  }

  function loseGame() {
    if (state.finished) return;
    state.finished = true;
    state.result = "lost";
    stopTimer();
    setStatus("踩到地雷", "本局结束", "lost");
    setFeedback("踩到地雷。按 R 或点击“新一局”重新开始。");
    render();
  }

  function cellLabel(index) {
    const row = Math.floor(index / state.cols) + 1;
    const col = (index % state.cols) + 1;
    const position = `第 ${row} 行第 ${col} 列`;

    if (state.flagged[index]) return `${position}，已插旗`;
    if (!state.revealed[index]) return `${position}，未翻开`;
    if (state.explodedIndex === index) return `${position}，踩中的地雷`;
    if (state.mines.includes(index)) return `${position}，地雷`;
    if (state.counts[index] === 0) return `${position}，已翻开，周围没有地雷`;
    return `${position}，已翻开，周围有 ${state.counts[index]} 颗地雷`;
  }

  function renderCell(index) {
    const cell = cells[index];
    if (!cell) return;

    cell.className = "cell";
    cell.textContent = "";
    cell.removeAttribute("aria-label");
    cell.removeAttribute("aria-disabled");
    cell.tabIndex = index === currentFocus ? 0 : -1;

    const isMine = state.mines.includes(index);
    const isWrong = state.result === "lost" && state.flagged[index] && !isMine;

    if (state.flagged[index] && !state.revealed[index]) cell.classList.add("is-flagged");
    if (state.revealed[index]) cell.classList.add("is-revealed");
    if (state.revealed[index] && state.counts[index] > 0 && !isMine) {
      cell.textContent = String(state.counts[index]);
    }

    if (state.result === "lost" && isMine) {
      cell.classList.add(state.explodedIndex === index ? "is-exploded" : "is-mine");
      cell.classList.add("is-revealed");
    }

    if (isWrong) cell.classList.add("is-wrong");
    if (state.result !== "ready" && !state.finished && index === currentFocus) {
      cell.classList.add("is-hint");
    }

    if (state.finished) cell.setAttribute("aria-disabled", "true");
    cell.setAttribute("aria-label", cellLabel(index));
  }

  function render() {
    for (let index = 0; index < cells.length; index += 1) renderCell(index);

    const flagCount = state.flagged.filter(Boolean).length;
    minesLeft.textContent = String(state.mineCount - flagCount);
    revealedCountEl.textContent = String(state.revealedSafe);

    const bestTimes = readBestTimes();
    bestTimeEl.textContent = bestTimes[level]
      ? formatTime(Number(bestTimes[level]) * 1000)
      : "暂无";

    flagModeButton.setAttribute("aria-pressed", String(flagMode));
    flagModeButton.textContent = `插旗模式：${flagMode ? "开" : "关"}`;
    renderTimer();
  }

  function buildBoard() {
    const settings = LEVELS[level];
    state.rows = settings.rows;
    state.cols = settings.cols;
    state.mineCount = settings.mines;
    state.mines = [];
    state.counts = Array(state.rows * state.cols).fill(0);
    state.revealed = Array(state.rows * state.cols).fill(false);
    state.flagged = Array(state.rows * state.cols).fill(false);
    state.initialized = false;
    state.finished = false;
    state.result = "ready";
    state.explodedIndex = -1;
    state.revealedSafe = 0;
    state.startedAt = 0;
    state.elapsedMs = 0;
    currentFocus = 0;
    cells = [];

    if (timerId) window.clearInterval(timerId);
    timerId = null;
    board.replaceChildren();
    board.style.setProperty("--cols", String(state.cols));
    board.style.setProperty("--rows", String(state.rows));
    boardScroll.style.setProperty("--board-max", `${state.cols * 48}px`);
    board.setAttribute("aria-colcount", String(state.cols));
    board.setAttribute("aria-rowcount", String(state.rows));
    board.setAttribute("aria-busy", "false");

    const fragment = document.createDocumentFragment();

    for (let row = 0; row < state.rows; row += 1) {
      const rowEl = document.createElement("div");
      rowEl.className = "board__row";
      rowEl.setAttribute("role", "row");

      for (let col = 0; col < state.cols; col += 1) {
        const index = row * state.cols + col;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.index = String(index);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-rowindex", String(row + 1));
        cell.setAttribute("aria-colindex", String(col + 1));
        cell.tabIndex = index === 0 ? 0 : -1;
        cells.push(cell);
        rowEl.append(cell);
      }

      fragment.append(rowEl);
    }

    board.append(fragment);
    boardSize.textContent = `${state.cols} × ${state.rows} / ${state.mineCount} 雷`;
    setStatus("准备开始", "待开始", "ready");
    setFeedback("先翻开任意一格，第一格一定安全。");
    flagMode = false;
    boardScroll.scrollLeft = 0;
    render();
  }

  function restartGame({ focusBoard = true } = {}) {
    buildBoard();
    if (focusBoard) {
      window.requestAnimationFrame(() => cells[0]?.focus());
    }
  }

  function focusCell(index) {
    if (index < 0 || index >= cells.length) return;
    cells[currentFocus].tabIndex = -1;
    currentFocus = index;
    const nextCell = cells[index];
    nextCell.tabIndex = 0;
    nextCell.focus({ preventScroll: true });
    nextCell.scrollIntoView({ block: "nearest", inline: "nearest" });
    renderCell(index);
  }

  function getCellFromEvent(event) {
    const cell = event.target.closest(".cell");
    if (!cell || !board.contains(cell)) return null;
    const index = Number(cell.dataset.index);
    return Number.isInteger(index) ? { cell, index } : null;
  }

  board.addEventListener("click", (event) => {
    const target = getCellFromEvent(event);
    if (!target) return;

    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }

    currentFocus = target.index;
    if (flagMode && !state.revealed[target.index]) {
      toggleFlag(target.index);
      return;
    }

    revealAt(target.index);
  });

  board.addEventListener("contextmenu", (event) => {
    const target = getCellFromEvent(event);
    if (!target) return;
    event.preventDefault();
    currentFocus = target.index;
    toggleFlag(target.index);
  });

  board.addEventListener("focusin", (event) => {
    const target = getCellFromEvent(event);
    if (!target) return;
    currentFocus = target.index;
    render();
  });

  board.addEventListener("keydown", (event) => {
    const target = getCellFromEvent(event);
    if (!target) return;

    const row = Math.floor(target.index / state.cols);
    const col = target.index % state.cols;
    let nextIndex = null;

    if (event.key === "ArrowUp") nextIndex = row > 0 ? target.index - state.cols : target.index;
    if (event.key === "ArrowDown") {
      nextIndex = row < state.rows - 1 ? target.index + state.cols : target.index;
    }
    if (event.key === "ArrowLeft") nextIndex = col > 0 ? target.index - 1 : target.index;
    if (event.key === "ArrowRight") {
      nextIndex = col < state.cols - 1 ? target.index + 1 : target.index;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      focusCell(nextIndex);
      return;
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFlag(target.index);
    }
  });

  board.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    const target = getCellFromEvent(event);
    if (!target) return;

    window.clearTimeout(longPressTimer);
    longPressTimer = window.setTimeout(() => {
      suppressClick = true;
      currentFocus = target.index;
      toggleFlag(target.index);
      navigator.vibrate?.(20);
    }, 450);
  });

  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    board.addEventListener(eventName, (event) => {
      if (event.pointerType === "mouse") return;
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    });
  }

  restartButton.addEventListener("click", () => restartGame());

  flagModeButton.addEventListener("click", () => {
    flagMode = !flagMode;
    setFeedback(flagMode ? "插旗模式已开启，单击格子即可插旗。" : "插旗模式已关闭，单击格子会翻开。");
    render();
  });

  for (const input of difficultyInputs) {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      level = input.value;
      saveLevel(level);
      restartGame({ focusBoard: false });
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement) return;

    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      restartGame();
    }

    if (event.key.toLowerCase() === "f" && !board.contains(event.target)) {
      event.preventDefault();
      toggleFlag(currentFocus);
    }
  });

  window.addEventListener("hashchange", () => {
    const nextLevel = window.location.hash.replace("#", "");
    if (!LEVELS[nextLevel] || nextLevel === level) return;
    level = nextLevel;
    difficultyInputs.forEach((input) => {
      input.checked = input.value === level;
    });
    restartGame({ focusBoard: false });
  });

  difficultyInputs.forEach((input) => {
    input.checked = input.value === level;
  });
  buildBoard();
})();

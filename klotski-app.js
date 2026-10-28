(() => {
  "use strict";

  const SAVE_KEY = "local-games.number-puzzle.state.v1";
  const BEST_KEY = "local-games.number-puzzle.best.v1";
  const board = document.querySelector("#number-puzzle-board");
  const status = document.querySelector("#number-puzzle-status");
  const stateLabel = document.querySelector("#number-puzzle-state");
  const movesEl = document.querySelector("#number-puzzle-moves");
  const timerEl = document.querySelector("#number-puzzle-timer");
  const bestEl = document.querySelector("#number-puzzle-best");
  const sizeEl = document.querySelector("#number-puzzle-size");
  const sizeCardEl = document.querySelector("#number-puzzle-size-card");
  const feedback = document.querySelector("#number-puzzle-feedback");
  const newButton = document.querySelector("#number-puzzle-new");
  const undoButton = document.querySelector("#number-puzzle-undo");
  const directionButtons = [...document.querySelectorAll("[data-direction]")];
  const difficultyInputs = [...document.querySelectorAll('input[name="number-puzzle-difficulty"]')];
  let history = [];
  let timerId = null;

  const state = {
    level: 3,
    size: 3,
    grid: [],
    moves: 0,
    elapsedMs: 0,
    startedAt: 0,
    finished: false,
  };

  function initialLevel() {
    const hash = Number(window.location.hash.slice(1));
    return NumberPuzzle.LEVELS[hash] ? hash : 3;
  }

  function readStorage(key, fallback) {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }

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
    writeStorage(SAVE_KEY, {
      level: state.level,
      grid: state.grid,
      moves: state.moves,
      elapsedMs: elapsed(),
      finished: state.finished,
    });
  }

  function bestForLevel() {
    const best = readStorage(BEST_KEY, {});
    return Object.hasOwn(best, state.level) ? best[state.level] : null;
  }

  function saveBest() {
    const best = readStorage(BEST_KEY, {});
    const previous = best[state.level];
    if (!previous || state.moves < previous.moves) {
      best[state.level] = { moves: state.moves, ms: elapsed() };
      writeStorage(BEST_KEY, best);
    }
  }

  function tileBand(value) {
    if (value <= 4) return "one";
    if (value <= 9) return "two";
    if (value <= 16) return "three";
    return "four";
  }

  function render() {
    board.replaceChildren();
    board.style.gridTemplateColumns = `repeat(${state.size}, minmax(0, 1fr))`;
    board.setAttribute("aria-label", `${state.size} 阶数字华容道，移动数字使顺序排列`);
    state.grid.forEach((value, index) => {
      if (!value) {
        const blank = document.createElement("span");
        blank.className = "number-puzzle-blank";
        blank.setAttribute("role", "gridcell");
        blank.setAttribute("aria-label", "空格");
        board.append(blank);
        return;
      }
      const tile = document.createElement("div");
      tile.className = `number-puzzle-tile number-puzzle-tile--${tileBand(value)}`;
      tile.dataset.number = String(value);
      tile.dataset.index = String(index);
      tile.textContent = String(value);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", `数字 ${value}`);
      tile.tabIndex = 0;
      tile.addEventListener("click", () => moveTile(index));
      tile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          moveTile(index);
        }
      });
      board.append(tile);
    });

    movesEl.textContent = String(state.moves);
    timerEl.textContent = formatTime(elapsed());
    sizeEl.textContent = `${state.size} × ${state.size}`;
    sizeCardEl.textContent = `${state.size} × ${state.size}`;
    const best = bestForLevel();
    bestEl.textContent = best ? `${best.moves} 步` : "暂无";
    undoButton.disabled = history.length === 0;
    directionButtons.forEach((button) => {
      button.disabled = state.finished;
    });
    board.dataset.state = state.finished ? "won" : "playing";
  }

  function snapshot() {
    return {
      grid: state.grid.slice(),
      moves: state.moves,
      elapsedMs: elapsed(),
      finished: state.finished,
    };
  }

  function finishIfSolved() {
    if (!NumberPuzzle.isSolved(state.grid, state.size)) return false;
    state.finished = true;
    stopTimer();
    saveBest();
    status.textContent = `${state.size} 阶数字已排好`;
    stateLabel.textContent = "已完成";
    feedback.textContent = `完成。共移动 ${state.moves} 步。`;
    save();
    render();

    const levels = [3, 4, 5];
    const nextLevel = levels[levels.indexOf(state.level) + 1];
    window.GameCompletion?.show({
      title: "数字华容道完成",
      message: `${state.size} 阶已经排好，共移动 ${state.moves} 步。${nextLevel ? `下一档是 ${nextLevel} 阶。` : "已经是最高难度。"}`,
      primaryText: nextLevel ? `挑战 ${nextLevel} 阶` : "再来一局",
      secondaryText: "留在这里",
      onPrimary: () => {
        if (nextLevel) {
          difficultyInputs.forEach((input) => {
            input.checked = Number(input.value) === nextLevel;
          });
          newGame(nextLevel);
        } else {
          newGame();
        }
      },
    });
    return true;
  }

  function applyMove(result) {
    if (!result.moved || state.finished) return;
    history.push(snapshot());
    if (history.length > 100) history.shift();
    state.grid = result.grid;
    state.moves += 1;
    startTimer();
    if (!finishIfSolved()) {
      status.textContent = "游戏进行中";
      stateLabel.textContent = "进行中";
      feedback.textContent = "继续移动，把数字从小到大排列。";
      save();
      render();
    }
  }

  function moveTile(index) {
    applyMove(NumberPuzzle.moveTile(state.grid, state.size, index));
  }

  function newGame(level = state.level) {
    stopTimer();
    const config = NumberPuzzle.LEVELS[level] || NumberPuzzle.LEVELS[3];
    state.level = level;
    state.size = config.size;
    state.grid = NumberPuzzle.shuffle(state.size);
    state.moves = 0;
    state.elapsedMs = 0;
    state.startedAt = 0;
    state.finished = false;
    history = [];
    window.history.replaceState(null, "", `#${level}`);
    status.textContent = "游戏进行中";
    stateLabel.textContent = "进行中";
    feedback.textContent = "移动空格旁边的数字，按顺序还原。";
    save();
    render();
    board.querySelector(".number-puzzle-tile")?.focus({ preventScroll: true });
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    stopTimer();
    state.grid = previous.grid;
    state.moves = previous.moves;
    state.elapsedMs = previous.elapsedMs;
    state.finished = previous.finished;
    status.textContent = "游戏进行中";
    stateLabel.textContent = "进行中";
    feedback.textContent = "已撤销上一步。";
    save();
    render();
  }

  directionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyMove(NumberPuzzle.moveBlank(state.grid, state.size, button.dataset.direction));
    });
  });

  board.addEventListener("keydown", (event) => {
    const directions = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    if (!directions[event.key]) return;
    event.preventDefault();
    applyMove(NumberPuzzle.moveBlank(state.grid, state.size, directions[event.key]));
  });

  newButton.addEventListener("click", () => newGame());
  undoButton.addEventListener("click", undo);
  difficultyInputs.forEach((input) => {
    input.addEventListener("change", () => input.checked && newGame(Number(input.value)));
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      newGame();
    }
    if (event.key.toLowerCase() === "u") {
      event.preventDefault();
      undo();
    }
  });

  const saved = readStorage(SAVE_KEY, null);
  const savedValid = saved
    && NumberPuzzle.LEVELS[saved.level]
    && NumberPuzzle.valid(saved.grid, NumberPuzzle.LEVELS[saved.level].size);
  const level = savedValid ? Number(saved.level) : initialLevel();
  difficultyInputs.forEach((input) => {
    input.checked = Number(input.value) === level;
  });

  if (savedValid) {
    state.level = Number(saved.level);
    state.size = NumberPuzzle.LEVELS[state.level].size;
    state.grid = saved.grid.slice();
    state.moves = Number(saved.moves) || 0;
    state.elapsedMs = Number(saved.elapsedMs) || 0;
    state.finished = Boolean(saved.finished);
    status.textContent = state.finished ? `${state.size} 阶数字已排好` : "游戏进行中";
    stateLabel.textContent = state.finished ? "已完成" : "进行中";
    feedback.textContent = state.finished ? "本局已经完成。" : "已恢复上次局面。";
    render();
  } else {
    newGame(level);
  }

  if (new URLSearchParams(window.location.search).has("test")) {
    window.__numberPuzzleTest = {
      getState() {
        return {
          level: state.level,
          size: state.size,
          grid: state.grid.slice(),
          moves: state.moves,
          finished: state.finished,
        };
      },
      setState(next) {
        state.level = Number(next.level);
        state.size = state.level;
        state.grid = next.grid.slice();
        state.moves = Number(next.moves) || 0;
        state.elapsedMs = 0;
        state.finished = false;
        history = [];
        render();
      },
    };
  }
})();

(() => {
  "use strict";

  const SAVE_KEY = "local-games.2048.state.v1";
  const LEVELS = {
    starter: { target: 512, label: "入门" },
    standard: { target: 1024, label: "标准" },
    expert: { target: 2048, label: "进阶" },
  };
  const core = window.Game2048;
  const board = document.querySelector("#board-2048");
  const status = document.querySelector("#board-2048-status");
  const stateLabel = document.querySelector("#game-2048-state");
  const scoreEl = document.querySelector("#score");
  const bestEl = document.querySelector("#best-score");
  const movesEl = document.querySelector("#moves");
  const maxTileEl = document.querySelector("#max-tile");
  const feedbackEl = document.querySelector("#game-2048-feedback");
  const newGameButton = document.querySelector("#new-game");
  const undoButton = document.querySelector("#undo-move");
  const continueButton = document.querySelector("#continue-game");
  const targetNumberEl = document.querySelector("#target-number");
  const difficultyInputs = [...document.querySelectorAll('input[name="2048-difficulty"]')];
  const cells = [];
  const numberEls = [];
  let history = [];
  let previousGrid = core.emptyGrid();
  let touchStart = null;

  const state = {
    level: "expert",
    target: 2048,
    grid: core.emptyGrid(),
    score: 0,
    best: 0,
    moves: 0,
    reachedTarget: false,
    pausedForWin: false,
    over: false,
  };

  function readSavedState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null");
      if (!saved || !core.validateGrid(saved.grid)) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        grid: state.grid,
        level: state.level,
        score: state.score,
        best: state.best,
        moves: state.moves,
        reachedTarget: state.reachedTarget,
        pausedForWin: state.pausedForWin,
        over: state.over,
      }));
    } catch {
      // The current game remains playable if browser storage is unavailable.
    }
  }

  function snapshot() {
    return {
      grid: state.grid.slice(),
      level: state.level,
      score: state.score,
      moves: state.moves,
      reachedTarget: state.reachedTarget,
      pausedForWin: state.pausedForWin,
      over: state.over,
    };
  }

  function setFeedback(message) {
    feedbackEl.textContent = message;
  }

  function createBoard() {
    for (let index = 0; index < core.SIZE * core.SIZE; index += 1) {
      const cell = document.createElement("div");
      cell.className = "tile-cell";
      cell.setAttribute("role", "gridcell");
      const number = document.createElement("span");
      number.className = "tile-number";
      number.hidden = true;
      cell.append(number);
      cells.push(cell);
      numberEls.push(number);
      board.append(cell);
    }
  }

  function tileClass(value) {
    if (value <= 4) return "tile-number--low";
    if (value <= 64) return "tile-number--mid";
    if (value <= 1024) return "tile-number--high";
    return "tile-number--max";
  }

  function render() {
    const changed = state.grid.map((value, index) => value !== previousGrid[index]);

    state.grid.forEach((value, index) => {
      const row = Math.floor(index / core.SIZE) + 1;
      const col = (index % core.SIZE) + 1;
      const number = numberEls[index];
      number.className = "tile-number";
      number.hidden = value === 0;
      number.textContent = value ? String(value) : "";
      cells[index].setAttribute(
        "aria-label",
        value ? `第 ${row} 行第 ${col} 列，数字 ${value}` : `第 ${row} 行第 ${col} 列，空`,
      );

      if (!value) return;
      number.classList.add(tileClass(value));
      number.dataset.value = String(value);
      number.dataset.digits = String(value).length;
      if (changed[index]) number.classList.add("is-changed");
    });

    const maxTile = core.maxValue(state.grid);
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(state.best);
    movesEl.textContent = String(state.moves);
    maxTileEl.textContent = String(maxTile);
    targetNumberEl.textContent = String(state.target);
    difficultyInputs.forEach((input) => {
      input.checked = input.value === state.level;
    });
    undoButton.disabled = history.length === 0;
    continueButton.hidden = !state.pausedForWin;
    board.dataset.state = state.pausedForWin ? "won" : state.over ? "over" : "playing";
    board.setAttribute("aria-disabled", String(state.pausedForWin || state.over));

    if (state.pausedForWin) {
      status.textContent = `已达成 ${state.target}`;
      stateLabel.textContent = "等待继续";
      setFeedback(`已达到 ${state.target}。可以继续挑战更大的数字。`);
    } else if (state.over) {
      status.textContent = "无可用移动";
      stateLabel.textContent = "本局结束";
      setFeedback("棋盘已满且无法合并。开始新一局继续。");
    } else {
      status.textContent = "游戏进行中";
      stateLabel.textContent = "进行中";
    }

    previousGrid = state.grid.slice();
  }

  function commitSpawn() {
    const alreadyReachedTarget = state.reachedTarget;
    const spawned = core.spawn(state.grid);
    state.grid = spawned.grid;
    state.reachedTarget = core.hasValue(state.grid, state.target);

    if (!alreadyReachedTarget && state.reachedTarget) {
      state.pausedForWin = true;
    } else if (!state.pausedForWin && !core.canMove(state.grid)) {
      state.over = true;
    }
    return !alreadyReachedTarget && state.reachedTarget;
  }

  function startNewGame(level = state.level) {
    const config = LEVELS[level] || LEVELS.expert;
    state.level = level;
    state.target = config.target;
    state.grid = core.emptyGrid();
    state.score = 0;
    state.moves = 0;
    state.reachedTarget = false;
    state.pausedForWin = false;
    state.over = false;
    history = [];
    previousGrid = core.emptyGrid();
    commitSpawn();
    commitSpawn();
    setFeedback("使用方向键或滑动棋盘开始游戏。");
    saveState();
    render();
    board.focus();
  }

  function chooseLevel(level) {
    const next = LEVELS[level] ? level : "expert";
    window.history.replaceState(null, "", `#${next}`);
    startNewGame(next);
  }

  function move(direction) {
    if (state.pausedForWin || state.over) {
      setFeedback(state.pausedForWin ? "先选择“继续挑战”，再继续移动。" : "本局已结束，请开始新一局。");
      return;
    }

    const result = core.move(state.grid, direction);
    if (!result.moved) {
      setFeedback("这个方向没有可移动的数字。");
      return;
    }

    history.push(snapshot());
    if (history.length > 10) history.shift();
    state.grid = result.grid;
    state.score += result.score;
    state.moves += 1;
    state.best = Math.max(state.best, state.score);
    const reachedTarget = commitSpawn();
    setFeedback(result.score ? `合并得分 ${result.score}。` : "移动完成。");
    saveState();
    render();

    if (reachedTarget) {
      const order = ["starter", "standard", "expert"];
      const nextLevel = order[order.indexOf(state.level) + 1];
      window.GameCompletion?.show({
        title: `目标 ${state.target} 达成`,
        message: nextLevel
          ? `本局得分 ${state.score}。下一档目标为 ${LEVELS[nextLevel].target}。`
          : "当前已经是最高目标。",
        primaryText: nextLevel ? `进入${LEVELS[nextLevel].label}` : "再来一局",
        secondaryText: "继续挑战",
        onPrimary: () => chooseLevel(nextLevel || state.level),
        onSecondary: continueGame,
      });
    }
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    state.grid = previous.grid.slice();
    state.score = previous.score;
    state.moves = previous.moves;
    state.reachedTarget = previous.reachedTarget;
    state.pausedForWin = previous.pausedForWin;
    state.over = previous.over;
    setFeedback("已撤销上一步。");
    saveState();
    render();
    board.focus();
  }

  function continueGame() {
    state.pausedForWin = false;
    if (!core.canMove(state.grid)) state.over = true;
    setFeedback("继续挑战更大的数字。");
    saveState();
    render();
  }

  function directionForSwipe(dx, dy) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  }

  board.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    touchStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    board.setPointerCapture?.(event.pointerId);
  });

  board.addEventListener("pointerup", (event) => {
    if (!touchStart || touchStart.pointerId !== event.pointerId) return;
    const direction = directionForSwipe(event.clientX - touchStart.x, event.clientY - touchStart.y);
    touchStart = null;
    if (direction) move(direction);
  });

  board.addEventListener("pointercancel", () => {
    touchStart = null;
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    const directions = {
      arrowleft: "left",
      arrowright: "right",
      arrowup: "up",
      arrowdown: "down",
      a: "left",
      d: "right",
      w: "up",
      s: "down",
    };

    if (directions[key]) {
      event.preventDefault();
      move(directions[key]);
    }

    if (key === "z") {
      event.preventDefault();
      undo();
    }

    if (key === "r") {
      event.preventDefault();
      startNewGame();
    }
  });

  newGameButton.addEventListener("click", () => startNewGame());
  undoButton.addEventListener("click", undo);
  continueButton.addEventListener("click", continueGame);
  difficultyInputs.forEach((input) => {
    input.addEventListener("change", () => input.checked && chooseLevel(input.value));
  });

  const saved = readSavedState();
  if (saved) {
    state.level = LEVELS[saved.level] ? saved.level : "expert";
    state.target = LEVELS[state.level].target;
    state.grid = saved.grid.slice();
    state.score = Number(saved.score) || 0;
    state.best = Number(saved.best) || state.score;
    state.moves = Number(saved.moves) || 0;
    state.reachedTarget = Boolean(saved.reachedTarget);
    state.pausedForWin = Boolean(saved.pausedForWin);
    state.over = Boolean(saved.over);
    setFeedback("已恢复上次进度。");
  } else {
    const hashLevel = window.location.hash.slice(1);
    state.level = LEVELS[hashLevel] ? hashLevel : "expert";
    state.target = LEVELS[state.level].target;
    state.grid = core.emptyGrid();
    for (let index = 0; index < 2; index += 1) {
      state.grid = core.spawn(state.grid).grid;
    }
    setFeedback("使用方向键或滑动棋盘开始游戏。");
  }

  createBoard();
  render();

  if (new URLSearchParams(window.location.search).has("test")) {
    window.__game2048Test = {
      getState() {
        return {
          ...snapshot(),
          target: state.target,
        };
      },
      setState(next) {
        if (!core.validateGrid(next.grid)) throw new TypeError("Invalid test grid.");
        state.level = LEVELS[next.level] ? next.level : state.level;
        state.target = LEVELS[state.level].target;
        state.grid = next.grid.slice();
        state.score = Number(next.score) || 0;
        state.best = Math.max(state.best, Number(next.best) || state.score);
        state.moves = Number(next.moves) || 0;
        state.reachedTarget = Boolean(next.reachedTarget);
        state.pausedForWin = Boolean(next.pausedForWin);
        state.over = Boolean(next.over);
        history = [];
        previousGrid = core.emptyGrid();
        render();
      },
    };
  }
})();

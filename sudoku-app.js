(() => {
  "use strict";

  const SAVE_KEY = "local-games.sudoku.state.v1";
  const BEST_KEY = "local-games.sudoku.best.v1";
  const board = document.querySelector("#sudoku-board");
  const status = document.querySelector("#sudoku-status");
  const stateLabel = document.querySelector("#sudoku-state");
  const filledEl = document.querySelector("#sudoku-filled");
  const mistakesEl = document.querySelector("#sudoku-mistakes");
  const timerEl = document.querySelector("#sudoku-timer");
  const bestEl = document.querySelector("#sudoku-best");
  const feedback = document.querySelector("#sudoku-feedback");
  const newButton = document.querySelector("#sudoku-new");
  const resetButton = document.querySelector("#sudoku-reset");
  const hintButton = document.querySelector("#sudoku-hint");
  const numberButtons = [...document.querySelectorAll("[data-number]")];
  const difficultyInputs = [...document.querySelectorAll('input[name="sudoku-difficulty"]')];
  const cells = [];
  let selectedIndex = null;
  let timerId = null;

  const state = {
    difficulty: "easy",
    puzzle: Array(81).fill(0),
    values: Array(81).fill(0),
    solution: Array(81).fill(0),
    mistakes: 0,
    elapsedMs: 0,
    startedAt: 0,
    finished: false,
  };

  function initialDifficulty() {
    const hash = window.location.hash.slice(1);
    return Sudoku.LEVELS[hash] ? hash : "easy";
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
      difficulty: state.difficulty,
      puzzle: state.puzzle,
      values: state.values,
      solution: state.solution,
      mistakes: state.mistakes,
      elapsedMs: elapsed(),
      finished: state.finished,
    });
  }

  function bestForDifficulty() {
    const best = readStorage(BEST_KEY, {});
    return Object.hasOwn(best, state.difficulty) ? best[state.difficulty] : null;
  }

  function saveBest() {
    const times = readStorage(BEST_KEY, {});
    const ms = elapsed();
    if (!times[state.difficulty] || ms < times[state.difficulty]) {
      times[state.difficulty] = ms;
      writeStorage(BEST_KEY, times);
    }
  }

  function createBoard() {
    for (let index = 0; index < 81; index += 1) {
      const cell = document.createElement("div");
      cell.className = "sudoku-cell";
      cell.dataset.index = String(index);
      cell.setAttribute("role", "gridcell");
      cell.tabIndex = index === 0 ? 0 : -1;
      cell.setAttribute("aria-rowindex", String(Math.floor(index / 9) + 1));
      cell.setAttribute("aria-colindex", String((index % 9) + 1));
      cell.addEventListener("click", () => {
        selectedIndex = index;
        render();
      });
      cells.push(cell);
      board.append(cell);
    }
  }

  function checkFinished() {
    return state.values.every((value, index) => value === state.solution[index]);
  }

  function completeIfSolved() {
    if (!checkFinished()) return false;
    state.finished = true;
    stopTimer();
    saveBest();
    status.textContent = "数独已完成";
    stateLabel.textContent = "已完成";
    feedback.textContent = `完成。用时 ${formatTime(state.elapsedMs)}。`;
    save();
    render();

    const levels = ["easy", "standard", "hard"];
    const nextDifficulty = levels[levels.indexOf(state.difficulty) + 1];
    window.GameCompletion?.show({
      title: "数独完成",
      message: nextDifficulty
        ? `本题已经完成。可以再来一题，或进入${Sudoku.LEVELS[nextDifficulty].label}难度。`
        : "本题已经完成，当前已是最高难度。",
      primaryText: "下一题",
      secondaryText: nextDifficulty ? "提升难度" : "留在这里",
      onPrimary: () => newPuzzle(state.difficulty),
      onSecondary: nextDifficulty
        ? () => {
          difficultyInputs.forEach((input) => {
            input.checked = input.value === nextDifficulty;
          });
          newPuzzle(nextDifficulty);
        }
        : null,
    });
    return true;
  }

  function render() {
    const selectedValue = selectedIndex === null ? 0 : state.values[selectedIndex];
    const selectedRow = selectedIndex === null ? -1 : Math.floor(selectedIndex / 9);
    const selectedCol = selectedIndex === null ? -1 : selectedIndex % 9;
    const selectedBox = selectedIndex === null
      ? -1
      : Math.floor(selectedRow / 3) * 3 + Math.floor(selectedCol / 3);

    state.values.forEach((value, index) => {
      const cell = cells[index];
      const row = Math.floor(index / 9);
      const col = index % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      const given = state.puzzle[index] !== 0;
      cell.textContent = value ? String(value) : "";
      cell.className = "sudoku-cell";
      if (given) cell.classList.add("is-given");
      if (value && value !== state.solution[index]) cell.classList.add("is-wrong");
      if (index === selectedIndex) cell.classList.add("is-selected");
      else if (row === selectedRow || col === selectedCol || box === selectedBox) cell.classList.add("is-peer");
      if (selectedValue && value === selectedValue && index !== selectedIndex) cell.classList.add("is-same");
      cell.setAttribute(
        "aria-label",
        `第 ${row + 1} 行第 ${col + 1} 列，${given ? "给定数字" : "可填写"}，${value || "空"}`,
      );
      cell.tabIndex = index === (selectedIndex ?? 0) ? 0 : -1;
    });

    const filled = state.values.filter(Boolean).length;
    filledEl.textContent = String(filled);
    mistakesEl.textContent = String(state.mistakes);
    timerEl.textContent = formatTime(elapsed());
    const best = bestForDifficulty();
    bestEl.textContent = best !== null ? formatTime(best) : "暂无";
    resetButton.disabled = state.puzzle.every((value, index) => value === state.values[index])
      && state.mistakes === 0;
    hintButton.disabled = state.finished || state.values.every((value, index) => value === state.solution[index]);
    const inputDisabled = selectedIndex === null
      || state.puzzle[selectedIndex] !== 0
      || state.finished;
    numberButtons.forEach((button) => {
      button.disabled = inputDisabled;
    });
  }

  function setCellValue(value) {
    if (selectedIndex === null || state.finished) return;
    if (state.puzzle[selectedIndex] !== 0) return;
    startTimer();
    state.values[selectedIndex] = value;
    if (value && value !== state.solution[selectedIndex]) {
      state.mistakes += 1;
      feedback.textContent = "这个数字不正确，可以继续修改。";
    } else if (value) {
      feedback.textContent = "已填入数字。";
    } else {
      feedback.textContent = "已清除这个格子。";
    }
    if (!completeIfSolved()) {
      status.textContent = "游戏进行中";
      stateLabel.textContent = "进行中";
    }
    save();
    render();
  }

  function useHint() {
    if (state.finished) return;
    let target = selectedIndex;
    if (target === null || state.puzzle[target] !== 0
      || state.values[target] === state.solution[target]) {
      target = state.values.findIndex((value, index) =>
        state.puzzle[index] === 0 && value !== state.solution[index]);
    }
    if (target < 0) return;
    startTimer();
    selectedIndex = target;
    state.values[target] = state.solution[target];
    feedback.textContent = "已填入一个正确数字。";
    if (!completeIfSolved()) {
      status.textContent = "游戏进行中";
      stateLabel.textContent = "进行中";
    }
    save();
    render();
    cells[target].focus();
  }

  function resetPuzzle() {
    stopTimer();
    state.values = state.puzzle.slice();
    state.mistakes = 0;
    state.elapsedMs = 0;
    state.finished = false;
    selectedIndex = state.puzzle.findIndex((value) => value === 0);
    status.textContent = "游戏进行中";
    stateLabel.textContent = "进行中";
    feedback.textContent = "已恢复本题的初始状态。";
    save();
    render();
  }

  function newPuzzle(difficulty = state.difficulty) {
    stopTimer();
    const generated = Sudoku.generatePuzzle(difficulty);
    state.difficulty = difficulty;
    state.puzzle = generated.puzzle;
    state.values = generated.puzzle.slice();
    state.solution = generated.solution;
    state.mistakes = 0;
    state.elapsedMs = 0;
    state.startedAt = 0;
    state.finished = false;
    selectedIndex = state.puzzle.findIndex((value) => value === 0);
    numberButtons.forEach((button) => {
      button.disabled = false;
    });
    window.history.replaceState(null, "", `#${difficulty}`);
    status.textContent = "游戏进行中";
    stateLabel.textContent = "进行中";
    feedback.textContent = `已生成${Sudoku.LEVELS[difficulty].label}题目。`;
    save();
    render();
  }

  function moveSelection(deltaRow, deltaCol) {
    const current = selectedIndex ?? 0;
    const row = Math.max(0, Math.min(8, Math.floor(current / 9) + deltaRow));
    const col = Math.max(0, Math.min(8, current % 9 + deltaCol));
    selectedIndex = row * 9 + col;
    render();
    cells[selectedIndex].focus();
  }

  board.addEventListener("keydown", (event) => {
    const index = Number(event.target.dataset?.index);
    if (!Number.isInteger(index)) return;
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      if (event.key === "ArrowUp") moveSelection(-1, 0);
      if (event.key === "ArrowDown") moveSelection(1, 0);
      if (event.key === "ArrowLeft") moveSelection(0, -1);
      if (event.key === "ArrowRight") moveSelection(0, 1);
    } else if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      setCellValue(Number(event.key));
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      setCellValue(0);
    }
  });

  numberButtons.forEach((button) => {
    button.addEventListener("click", () => setCellValue(Number(button.dataset.number)));
  });
  newButton.addEventListener("click", () => newPuzzle());
  resetButton.addEventListener("click", resetPuzzle);
  hintButton.addEventListener("click", useHint);
  difficultyInputs.forEach((input) => {
    input.addEventListener("change", () => input.checked && newPuzzle(input.value));
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === "h") {
      event.preventDefault();
      useHint();
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      resetPuzzle();
    }
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      newPuzzle();
    }
  });

  const saved = readStorage(SAVE_KEY, null);
  const savedValid = saved
    && Sudoku.LEVELS[saved.difficulty]
    && Array.isArray(saved.puzzle)
    && saved.puzzle.length === 81
    && Array.isArray(saved.values)
    && saved.values.length === 81
    && Sudoku.isValidSolution(saved.solution);
  const difficulty = savedValid ? saved.difficulty : initialDifficulty();
  difficultyInputs.forEach((input) => {
    input.checked = input.value === difficulty;
  });
  createBoard();

  if (savedValid) {
    state.difficulty = saved.difficulty;
    state.puzzle = saved.puzzle.slice();
    state.values = saved.values.slice();
    state.solution = saved.solution.slice();
    state.mistakes = Number(saved.mistakes) || 0;
    state.elapsedMs = Number(saved.elapsedMs) || 0;
    state.finished = Boolean(saved.finished);
    selectedIndex = state.puzzle.findIndex((value) => value === 0);
    status.textContent = state.finished ? "数独已完成" : "游戏进行中";
    stateLabel.textContent = state.finished ? "已完成" : "进行中";
    feedback.textContent = state.finished ? "这道题已经完成。" : "已恢复上次题目和进度。";
    render();
  } else {
    newPuzzle(difficulty);
  }

  if (new URLSearchParams(window.location.search).has("test")) {
    window.__sudokuTest = {
      getState() {
        return {
          difficulty: state.difficulty,
          puzzle: state.puzzle.slice(),
          values: state.values.slice(),
          solution: state.solution.slice(),
          mistakes: state.mistakes,
          finished: state.finished,
        };
      },
      fillProgress(ratio = 0.6) {
        const editable = state.puzzle
          .map((value, index) => value === 0 ? index : -1)
          .filter((index) => index >= 0);
        const count = Math.floor(editable.length * ratio);
        for (const index of editable.slice(0, count)) state.values[index] = state.solution[index];
        selectedIndex = editable[count] ?? editable.at(-1);
        render();
      },
      solveCurrent() {
        state.values = state.solution.slice();
        state.mistakes = 0;
        selectedIndex = null;
        completeIfSolved();
      },
    };
  }
})();

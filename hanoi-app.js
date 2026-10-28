(() => {
  "use strict";

  const SAVE_KEY = "local-games.hanoi.state.v1";
  const BEST_KEY = "local-games.hanoi.best.v1";
  const LEVELS = {
    3: { label: "入门", disks: 3 },
    5: { label: "标准", disks: 5 },
    7: { label: "进阶", disks: 7 },
  };
  const stage = document.querySelector("#hanoi-stage");
  const status = document.querySelector("#hanoi-status");
  const stateLabel = document.querySelector("#hanoi-state");
  const boardSize = document.querySelector("#hanoi-size");
  const movesEl = document.querySelector("#hanoi-moves");
  const optimalEl = document.querySelector("#hanoi-optimal");
  const timerEl = document.querySelector("#hanoi-timer");
  const bestEl = document.querySelector("#hanoi-best");
  const feedback = document.querySelector("#hanoi-feedback");
  const newButton = document.querySelector("#hanoi-new");
  const undoButton = document.querySelector("#hanoi-undo");
  const difficultyInputs = [...document.querySelectorAll('input[name="hanoi-difficulty"]')];
  const pegButtons = [];
  let history = [];
  let selectedPeg = null;
  let timerId = null;

  const state = {
    disks: 3,
    pegs: [],
    moves: 0,
    elapsedMs: 0,
    startedAt: 0,
    finished: false,
  };

  function initialDifficulty() {
    const hash = Number(window.location.hash.slice(1));
    return LEVELS[hash] ? hash : 3;
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
      // The active game does not depend on local storage.
    }
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function elapsed() {
    return state.startedAt ? Date.now() - state.startedAt : state.elapsedMs;
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

  function setStatus(text, label, nextFeedback) {
    status.textContent = text;
    stateLabel.textContent = label;
    if (nextFeedback) feedback.textContent = nextFeedback;
  }

  function snapshot() {
    return {
      disks: state.disks,
      pegs: Hanoi.clonePegs(state.pegs),
      moves: state.moves,
      elapsedMs: elapsed(),
      finished: state.finished,
    };
  }

  function save() {
    writeStorage(SAVE_KEY, snapshot());
  }

  function getBest() {
    const best = readStorage(BEST_KEY, {});
    return best[state.disks] || { moves: null, ms: null };
  }

  function saveBest() {
    const best = readStorage(BEST_KEY, {});
    const current = best[state.disks];
    const candidate = { moves: state.moves, ms: elapsed() };
    if (!current || candidate.moves < current.moves) best[state.disks] = candidate;
    writeStorage(BEST_KEY, best);
  }

  function buildPegs() {
    pegButtons.length = 0;
    stage.replaceChildren();
    for (let index = 0; index < 3; index += 1) {
      const peg = document.createElement("div");
      peg.className = "hanoi-peg";
      peg.dataset.peg = String(index);
      peg.setAttribute("role", "button");
      peg.tabIndex = 0;
      peg.addEventListener("click", () => selectOrMove(index));
      const rod = document.createElement("span");
      rod.className = "hanoi-peg__rod";
      rod.setAttribute("aria-hidden", "true");
      const stack = document.createElement("span");
      stack.className = "hanoi-peg__stack";
      peg.append(rod, stack);
      stage.append(peg);
      pegButtons.push(peg);
    }
  }

  function renderPegs() {
    state.pegs.forEach((pegs, pegIndex) => {
      const button = pegButtons[pegIndex];
      const stack = button.querySelector(".hanoi-peg__stack");
      stack.replaceChildren();
      button.classList.toggle("is-selected", selectedPeg === pegIndex);
      button.setAttribute("aria-pressed", String(selectedPeg === pegIndex));

      pegs.forEach((disk, index) => {
        const piece = document.createElement("span");
        piece.className = `hanoi-disk hanoi-disk--${(disk - 1) % 3}`;
        piece.style.width = `${30 + (disk / state.disks) * 58}%`;
        piece.textContent = String(disk);
        piece.setAttribute("aria-hidden", "true");
        if (index === pegs.length - 1) piece.classList.add("is-top");
        stack.append(piece);
      });

      const top = pegs[pegs.length - 1];
      button.setAttribute(
        "aria-label",
        pegs.length ? `第 ${pegIndex + 1} 根柱，共有 ${pegs.length} 个圆盘，顶部为 ${top} 号` : `第 ${pegIndex + 1} 根柱，空`,
      );
    });
  }

  function render() {
    renderPegs();
    movesEl.textContent = String(state.moves);
    optimalEl.textContent = String(Hanoi.optimalMoves(state.disks));
    timerEl.textContent = formatTime(elapsed());
    const best = getBest();
    bestEl.textContent = best.moves ? `${best.moves} 步` : "暂无";
    undoButton.disabled = history.length === 0;
    boardSize.textContent = `3 根柱 / ${state.disks} 个圆盘`;
  }

  function selectOrMove(pegIndex) {
    if (state.finished) return;
    if (selectedPeg === null) {
      if (!state.pegs[pegIndex].length) {
        setStatus("第 " + (pegIndex + 1) + " 根柱为空", "进行中", "请选择有圆盘的柱子。");
        render();
        return;
      }
      selectedPeg = pegIndex;
      setStatus("已选择起点", "进行中", "再选择一根目标柱。");
      render();
      return;
    }

    if (selectedPeg === pegIndex) {
      selectedPeg = null;
      setStatus("已取消选择", "进行中", "选择顶部圆盘所在的柱子开始移动。");
      render();
      return;
    }

    const previous = snapshot();
    const result = Hanoi.move(state.pegs, selectedPeg, pegIndex);
    if (!result.moved) {
      setStatus("不能这样移动", "进行中", "大圆盘不能放在小圆盘上。");
      render();
      return;
    }

    history.push(previous);
    if (history.length > 30) history.shift();
    state.pegs = result.pegs;
    state.moves += 1;
    selectedPeg = null;
    startTimer();
    feedback.textContent = `已移动 ${result.disk} 号圆盘。`;

    if (result.won) {
      state.finished = true;
      stopTimer();
      saveBest();
      setStatus("所有圆盘已到达目标柱", "已完成", `完成。用了 ${state.moves} 步，最少需要 ${Hanoi.optimalMoves(state.disks)} 步。`);
    } else {
      setStatus("游戏进行中", "进行中");
    }

    save();
    render();

    if (result.won) {
      const sizes = [3, 5, 7];
      const nextSize = sizes[sizes.indexOf(state.disks) + 1];
      window.GameCompletion?.show({
        title: "汉诺塔完成",
        message: `本局用了 ${state.moves} 步。${nextSize ? `下一档是 ${nextSize} 个圆盘。` : "已经是最高难度。"}`,
        primaryText: nextSize ? `挑战 ${nextSize} 层` : "再来一局",
        secondaryText: "留在这里",
        onPrimary: () => {
          if (nextSize) {
            difficultyInputs.forEach((input) => {
              input.checked = Number(input.value) === nextSize;
            });
            changeDifficulty(nextSize);
          } else {
            newGame();
          }
        },
      });
    }
  }

  function newGame(disks = state.disks) {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
    state.disks = disks;
    state.pegs = Hanoi.createPegs(disks);
    state.moves = 0;
    state.elapsedMs = 0;
    state.startedAt = 0;
    state.finished = false;
    history = [];
    selectedPeg = null;
    save();
    setStatus("准备开始", "待开始", "点击有圆盘的柱子，再点击目标柱。");
    render();
    pegButtons[0].focus();
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    stopTimer();
    state.pegs = previous.pegs;
    state.moves = previous.moves;
    state.elapsedMs = previous.elapsedMs;
    state.finished = previous.finished;
    selectedPeg = null;
    setStatus("已撤销一步", "进行中", "继续移动圆盘。");
    save();
    render();
  }

  function changeDifficulty(disks) {
    window.history.replaceState(null, "", `#${disks}`);
    newGame(disks);
  }

  stage.addEventListener("keydown", (event) => {
    const current = Number(event.target.dataset?.peg);
    if (!Number.isInteger(current)) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      pegButtons[(current + direction + 3) % 3].focus();
    }
  });

  newButton.addEventListener("click", () => newGame());
  undoButton.addEventListener("click", undo);
  difficultyInputs.forEach((input) => {
    input.addEventListener("change", () => input.checked && changeDifficulty(Number(input.value)));
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
  const savedDisks = Number(saved?.disks);
  const disks = LEVELS[savedDisks] ? savedDisks : initialDifficulty();
  difficultyInputs.forEach((input) => {
    input.checked = Number(input.value) === disks;
  });
  buildPegs();

  if (saved && savedDisks === disks && Array.isArray(saved.pegs) && saved.pegs.length === 3) {
    state.disks = disks;
    state.pegs = saved.pegs.map((peg) => peg.slice());
    state.moves = Number(saved.moves) || 0;
    state.elapsedMs = Number(saved.elapsedMs) || 0;
    state.finished = Boolean(saved.finished);
    setStatus(state.finished ? "所有圆盘已到达目标柱" : "游戏进行中", state.finished ? "已完成" : "进行中");
    render();
  } else {
    newGame(disks);
  }
})();

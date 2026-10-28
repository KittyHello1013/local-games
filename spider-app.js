(() => {
  "use strict";

  const SAVE_KEY = "local-games.spider.state.v1";
  const board = document.querySelector("#spider-board");
  const status = document.querySelector("#spider-status");
  const stateLabel = document.querySelector("#spider-state");
  const movesEl = document.querySelector("#spider-moves");
  const completedEl = document.querySelector("#spider-completed");
  const timerEl = document.querySelector("#spider-timer");
  const remainingEl = document.querySelector("#spider-remaining");
  const feedback = document.querySelector("#spider-feedback");
  const stockButton = document.querySelector("#spider-stock");
  const newButton = document.querySelector("#spider-new");
  const undoButton = document.querySelector("#spider-undo");
  const difficultyInputs = [...document.querySelectorAll('input[name="spider-difficulty"]')];
  let selected = null;
  let history = [];
  let timerId = null;

  const state = {
    level: 1,
    columns: [],
    stock: [],
    completed: 0,
    moves: 0,
    elapsedMs: 0,
    startedAt: 0,
    finished: false,
  };

  function cloneGame() {
    return JSON.parse(JSON.stringify({
      columns: state.columns,
      stock: state.stock,
      completed: state.completed,
      moves: state.moves,
      finished: state.finished,
      elapsedMs: elapsed(),
    }));
  }

  function restore(snapshot) {
    state.columns = snapshot.columns;
    state.stock = snapshot.stock;
    state.completed = snapshot.completed;
    state.moves = snapshot.moves;
    state.finished = snapshot.finished;
    state.elapsedMs = snapshot.elapsedMs;
    state.startedAt = 0;
    selected = null;
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
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        level: state.level,
        ...cloneGame(),
      }));
    } catch {
      // The current game is independent of storage.
    }
  }

  function readSave() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) || "null");
      return saved && Spider.LEVELS[saved.level] && Array.isArray(saved.columns) ? saved : null;
    } catch {
      return null;
    }
  }

  function rankText(rank) {
    return rank === 1 ? "A" : rank === 11 ? "J" : rank === 12 ? "Q" : rank === 13 ? "K" : String(rank);
  }

  function suitText(suit) {
    return { spade: "♠", heart: "♥", club: "♣", diamond: "♦" }[suit];
  }

  function render() {
    board.replaceChildren();
    state.columns.forEach((column, colIndex) => {
      const columnEl = document.createElement("div");
      columnEl.className = "spider-column";
      columnEl.dataset.column = String(colIndex);
      columnEl.setAttribute("role", "button");
      columnEl.tabIndex = 0;
      columnEl.setAttribute("aria-label", `第 ${colIndex + 1} 列，${column.length} 张牌`);
      columnEl.style.setProperty("--cards", String(column.length));
      const step = column.length > 1
        ? Math.min(5.8, 80 / (column.length - 1))
        : 0;
      columnEl.style.setProperty("--card-step", `${step}%`);
      column.forEach((card, cardIndex) => {
        const cardEl = document.createElement("span");
        cardEl.className = `spider-card ${card.faceUp ? "is-face-up" : "is-face-down"}`;
        cardEl.dataset.cardIndex = String(cardIndex);
        cardEl.style.setProperty("--card-index", String(cardIndex));
        if (card.faceUp) {
          cardEl.classList.add(`spider-card--${card.suit === "heart" || card.suit === "diamond" ? "red" : "black"}`);
          cardEl.innerHTML = `<b>${rankText(card.rank)}</b><span>${suitText(card.suit)}</span>`;
        }
        if (selected && selected.from === colIndex && cardIndex >= selected.start) {
          cardEl.classList.add("is-selected");
        }
        columnEl.append(cardEl);
      });
      columnEl.addEventListener("click", (event) => {
        const card = event.target.closest(".spider-card");
        const start = card ? Number(card.dataset.cardIndex) : column.length - 1;
        chooseColumn(colIndex, start);
      });
      columnEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          let start = column.length - 1;
          while (start > 0 && Spider.validRun(column, start - 1)
            && column[start - 1].rank === column[start].rank + 1) start -= 1;
          chooseColumn(colIndex, start);
        }
      });
      board.append(columnEl);
    });

    movesEl.textContent = String(state.moves);
    completedEl.textContent = `${state.completed} / 8`;
    remainingEl.textContent = String(state.stock.length);
    timerEl.textContent = formatTime(elapsed());
    stockButton.textContent = `发牌（${state.stock.length}）`;
    stockButton.disabled = state.stock.length < 10 || state.columns.some((column) => !column.length);
    undoButton.disabled = history.length === 0;
    board.dataset.state = state.finished ? "won" : "playing";

    const stuck = !state.finished && !selected && !Spider.hasAvailableMove(state);
    stockButton.classList.toggle("is-suggested", stuck && !stockButton.disabled);
    if (stuck) {
      if (!stockButton.disabled) {
        status.textContent = "当前没有可移动组合";
        feedback.textContent = "当前牌局无法继续移动，请点击“发牌”。";
      } else {
        status.textContent = "当前无法继续";
        feedback.textContent = "没有可用移动，也无法发牌，请开始新一局。";
      }
    }
  }

  function beginMove() {
    history.push(cloneGame());
    if (history.length > 30) history.shift();
    startTimer();
  }

  function chooseColumn(colIndex, start) {
    if (state.finished) return;
    const column = state.columns[colIndex];
    if (selected && selected.from === colIndex && selected.start === start) {
      selected = null;
      feedback.textContent = "已取消选择。";
      render();
      return;
    }
    if (selected && selected.from !== colIndex) {
      beginMove();
      const result = Spider.moveRun(state, selected.from, colIndex, selected.start);
      if (!result.moved) {
        history.pop();
        feedback.textContent = "移动顺序不对，只能接在比它大一位的牌上。";
        render();
        return;
      }
      selected = null;
      finishIfWon(result.collected);
      save();
      render();
      return;
    }

    if (!Spider.validRun(column, start)) {
      feedback.textContent = "请选择一张正面朝上的连续降序牌。";
      return;
    }
    selected = { from: colIndex, start };
    feedback.textContent = "已选牌，请点击目标列。";
    render();
  }

  function finishIfWon(collected) {
    if (collected) feedback.textContent = `已收走 ${collected} 组完整序列。`;
    if (!state.finished) return;
    stopTimer();
    status.textContent = "全部纸牌已收走";
    stateLabel.textContent = "已完成";
    const levels = [1, 2, 4];
    const nextLevel = levels[levels.indexOf(state.level) + 1];
    window.GameCompletion?.show({
      title: "蜘蛛纸牌完成",
      message: `已完成全部 8 组。${nextLevel ? `下一档是 ${Spider.LEVELS[nextLevel].label}。` : "已经是最高难度。"}`,
      primaryText: nextLevel ? `挑战${Spider.LEVELS[nextLevel].label}` : "再来一局",
      secondaryText: "留在这里",
      onPrimary: () => newGame(nextLevel || state.level),
    });
  }

  function newGame(level = state.level) {
    stopTimer();
    const config = Spider.LEVELS[level] || Spider.LEVELS[1];
    state.level = level;
    Object.assign(state, Spider.createGame(config.suits), {
      elapsedMs: 0,
      startedAt: 0,
    });
    selected = null;
    history = [];
    window.history.replaceState(null, "", `#${level}`);
    status.textContent = "游戏进行中";
    stateLabel.textContent = "进行中";
    feedback.textContent = "选择正面牌，移到合适的列。";
    save();
    render();
  }

  function deal() {
    if (stockButton.disabled || state.finished) return;
    beginMove();
    if (!Spider.dealStock(state)) {
      history.pop();
      feedback.textContent = "每列都必须有牌，且剩余牌至少 10 张。";
      return;
    }
    selected = null;
    finishIfWon(0);
    save();
    render();
  }

  function undo() {
    const previous = history.pop();
    if (!previous) return;
    stopTimer();
    restore(previous);
    status.textContent = "游戏进行中";
    stateLabel.textContent = "进行中";
    feedback.textContent = "已撤销上一步。";
    save();
    render();
  }

  stockButton.addEventListener("click", deal);
  newButton.addEventListener("click", () => newGame());
  undoButton.addEventListener("click", undo);
  difficultyInputs.forEach((input) => {
    input.addEventListener("change", () => input.checked && newGame(Number(input.value)));
  });
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === "r") newGame();
    if (event.key.toLowerCase() === "u") undo();
  });

  const saved = readSave();
  const level = saved ? Number(saved.level) : Number(window.location.hash.slice(1)) || 1;
  difficultyInputs.forEach((input) => {
    input.checked = Number(input.value) === (Spider.LEVELS[level] ? level : 1);
  });
  if (saved) {
    state.level = Number(saved.level);
    restore(saved);
    status.textContent = saved.finished ? "全部纸牌已收走" : "游戏进行中";
    stateLabel.textContent = saved.finished ? "已完成" : "进行中";
    render();
  } else {
    newGame(Spider.LEVELS[level] ? level : 1);
  }
})();

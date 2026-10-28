(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Spider = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SUITS = ["spade", "heart", "club", "diamond"];
  const LEVELS = {
    1: { suits: 1, label: "单花色" },
    2: { suits: 2, label: "双花色" },
    4: { suits: 4, label: "四花色" },
  };

  function shuffle(values, random = Math.random) {
    const copy = values.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(random() * (index + 1));
      [copy[index], copy[pick]] = [copy[pick], copy[index]];
    }
    return copy;
  }

  function buildDeck(suitCount) {
    const suits = SUITS.slice(0, suitCount);
    const passes = 8 / suitCount;
    const cards = [];
    let id = 0;
    for (const suit of suits) {
      for (let pass = 0; pass < passes; pass += 1) {
        for (let rank = 1; rank <= 13; rank += 1) {
          cards.push({ id: `${suit}-${pass}-${rank}`, suit, rank, faceUp: false });
          id += 1;
        }
      }
    }
    return cards;
  }

  function createGame(suitCount, random = Math.random) {
    const deck = shuffle(buildDeck(suitCount), random);
    const columns = Array.from({ length: 10 }, () => []);
    for (let col = 0; col < 10; col += 1) {
      const count = col < 4 ? 6 : 5;
      for (let card = 0; card < count; card += 1) columns[col].push(deck.pop());
      columns[col][columns[col].length - 1].faceUp = true;
    }
    return {
      columns,
      stock: deck,
      completed: 0,
      moves: 0,
      finished: false,
    };
  }

  function validRun(column, start) {
    if (start < 0 || start >= column.length || !column[start]?.faceUp) return false;
    for (let index = start; index < column.length; index += 1) {
      if (!column[index].faceUp) return false;
      if (index > start && column[index].rank !== column[index - 1].rank - 1) return false;
    }
    return true;
  }

  function moveRun(game, from, to, start) {
    if (game.finished || from === to) return { moved: false, collected: 0 };
    const source = game.columns[from];
    const target = game.columns[to];
    if (!validRun(source, start)) return { moved: false, collected: 0 };
    if (target.length && target[target.length - 1].rank !== source[start].rank + 1) {
      return { moved: false, collected: 0 };
    }
    const moving = source.splice(start);
    target.push(...moving);
    if (source.length) source[source.length - 1].faceUp = true;
    game.moves += 1;
    const collected = collectComplete(game);
    return { moved: true, collected };
  }

  function collectComplete(game) {
    let collected = 0;
    for (const column of game.columns) {
      for (let start = 0; start <= column.length - 13; start += 1) {
        const run = column.slice(start, start + 13);
        if (run.every((card, index) =>
          card.faceUp
          && card.suit === run[0].suit
          && card.rank === 13 - index)) {
          column.splice(start, 13);
          if (column.length) column[column.length - 1].faceUp = true;
          game.completed += 1;
          collected += 1;
          break;
        }
      }
    }
    game.finished = game.completed === 8;
    return collected;
  }

  function dealStock(game) {
    if (game.finished || game.stock.length < 10 || game.columns.some((column) => !column.length)) {
      return false;
    }
    for (const column of game.columns) {
      const card = game.stock.pop();
      card.faceUp = true;
      column.push(card);
    }
    game.moves += 1;
    collectComplete(game);
    return true;
  }

  function hasAvailableMove(game) {
    return game.columns.some((source, from) => {
      const top = source[source.length - 1];
      if (!top?.faceUp) return false;
      return game.columns.some((target, to) => {
        if (from === to) return false;
        const targetTop = target[target.length - 1];
        return !targetTop || targetTop.rank === top.rank + 1;
      });
    });
  }

  return {
    SUITS,
    LEVELS,
    buildDeck,
    createGame,
    validRun,
    moveRun,
    collectComplete,
    dealStock,
    hasAvailableMove,
  };
});

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Gomoku = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LEVELS = {
    easy: { size: 15, label: "入门", rank: 9 },
    standard: { size: 15, label: "标准", rank: 11 },
    hard: { size: 15, label: "进阶", rank: 13 },
  };
  const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function createBoard(size) {
    return Array(size * size).fill(0);
  }

  function winLine(board, size, index, player) {
    if (board[index] !== player) return [];
    const row = Math.floor(index / size);
    const col = index % size;

    for (const [dx, dy] of DIRECTIONS) {
      const line = [index];
      for (const sign of [-1, 1]) {
        let nextRow = row + dy * sign;
        let nextCol = col + dx * sign;
        while (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size
          && board[nextRow * size + nextCol] === player) {
          line.push(nextRow * size + nextCol);
          nextRow += dy * sign;
          nextCol += dx * sign;
        }
      }
      if (line.length >= 5) return line.sort((a, b) => a - b);
    }
    return [];
  }

  function pointScore(board, size, index, player) {
    if (board[index]) return -1;
    let score = 0;
    for (const [dx, dy] of DIRECTIONS) {
      let count = 1;
      let open = 0;
      const row = Math.floor(index / size);
      const col = index % size;
      for (const sign of [-1, 1]) {
        let nextRow = row + dy * sign;
        let nextCol = col + dx * sign;
        while (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size
          && board[nextRow * size + nextCol] === player) {
          count += 1;
          nextRow += dy * sign;
          nextCol += dx * sign;
        }
        if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size
          && board[nextRow * size + nextCol] === 0) open += 1;
      }
      score += (count ** 3) * (open ? 2 : 1);
    }
    return score;
  }

  function chooseMove(board, size, level = 9, random = Math.random) {
    const empties = [];
    board.forEach((value, index) => {
      if (value) return;
      const row = Math.floor(index / size);
      const col = index % size;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const r = row + dy;
          const c = col + dx;
          if (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c]) {
            near = true;
            break;
          }
        }
      }
      if (near) empties.push(index);
    });
    if (!empties.length) return -1;

    let best = -Infinity;
    const candidates = [];
    for (const index of empties) {
      const attack = pointScore(board, size, index, 1);
      const defense = pointScore(board, size, index, 2);
      const center = size / 2;
      const distance = Math.abs(Math.floor(index / size) - center) + Math.abs(index % size - center);
      const noise = level === 9 ? random() * 180 : level === 11 ? random() * 25 : 0;
      const score = attack * 1.08 + defense + noise - distance;
      if (score > best) {
        best = score;
        candidates.length = 0;
        candidates.push(index);
      } else if (score === best) {
        candidates.push(index);
      }
    }
    return candidates[Math.floor(random() * candidates.length)];
  }

  return { LEVELS, createBoard, winLine, pointScore, chooseMove };
});

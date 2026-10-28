(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NumberPuzzle = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LEVELS = {
    3: { size: 3, label: "入门" },
    4: { size: 4, label: "标准" },
    5: { size: 5, label: "进阶" },
  };

  const OFFSETS = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };

  function solved(size) {
    const total = size * size;
    return Array.from({ length: total }, (_, index) => index === total - 1 ? 0 : index + 1);
  }

  function valid(grid, size) {
    if (!Array.isArray(grid) || grid.length !== size * size) return false;
    const sorted = grid.slice().sort((a, b) => a - b);
    return sorted.every((value, index) => value === index);
  }

  function isSolved(grid, size) {
    return valid(grid, size) && grid.every((value, index) => value === (index === size * size - 1 ? 0 : index + 1));
  }

  function blankIndex(grid) {
    return grid.indexOf(0);
  }

  function swap(grid, first, second) {
    const next = grid.slice();
    [next[first], next[second]] = [next[second], next[first]];
    return next;
  }

  function moveBlank(grid, size, direction) {
    if (!valid(grid, size) || !OFFSETS[direction]) return { grid: grid.slice(), moved: false };
    const blank = blankIndex(grid);
    const row = Math.floor(blank / size);
    const col = blank % size;
    const [dx, dy] = OFFSETS[direction];
    const nextRow = row + dy;
    const nextCol = col + dx;
    if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
      return { grid: grid.slice(), moved: false };
    }
    return {
      grid: swap(grid, blank, nextRow * size + nextCol),
      moved: true,
    };
  }

  function moveTile(grid, size, index) {
    if (!valid(grid, size) || index < 0 || index >= grid.length) {
      return { grid: grid.slice(), moved: false };
    }
    const blank = blankIndex(grid);
    const row = Math.floor(index / size);
    const col = index % size;
    const blankRow = Math.floor(blank / size);
    const blankCol = blank % size;
    if (Math.abs(row - blankRow) + Math.abs(col - blankCol) !== 1) {
      return { grid: grid.slice(), moved: false };
    }
    return { grid: swap(grid, index, blank), moved: true };
  }

  function shuffle(size, random = Math.random, steps = size * size * 40) {
    let grid = solved(size);
    let previous = "";
    const directions = Object.keys(OFFSETS);
    const inverse = { up: "down", down: "up", left: "right", right: "left" };

    for (let count = 0; count < steps; count += 1) {
      const available = directions.filter((direction) => {
        if (direction === inverse[previous]) return false;
        return moveBlank(grid, size, direction).moved;
      });
      if (!available.length) {
        previous = "";
        continue;
      }
      const direction = available[Math.floor(random() * available.length)];
      grid = moveBlank(grid, size, direction).grid;
      previous = direction;
    }

    if (isSolved(grid, size)) return shuffle(size, random, steps + 10);
    return grid;
  }

  return { LEVELS, solved, valid, isSolved, blankIndex, moveBlank, moveTile, shuffle };
});

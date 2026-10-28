(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Game2048 = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SIZE = 4;

  function emptyGrid() {
    return Array(SIZE * SIZE).fill(0);
  }

  function isValidValue(value) {
    return Number.isInteger(value)
      && value >= 0
      && (value === 0 || Number.isInteger(Math.log2(value)));
  }

  function validateGrid(grid) {
    return Array.isArray(grid)
      && grid.length === SIZE * SIZE
      && grid.every(isValidValue);
  }

  function linesFor(direction) {
    const lines = [];

    for (let fixed = 0; fixed < SIZE; fixed += 1) {
      const line = [];
      for (let moving = 0; moving < SIZE; moving += 1) {
        if (direction === "left") line.push(fixed * SIZE + moving);
        if (direction === "right") line.push(fixed * SIZE + (SIZE - 1 - moving));
        if (direction === "up") line.push(moving * SIZE + fixed);
        if (direction === "down") line.push((SIZE - 1 - moving) * SIZE + fixed);
      }
      lines.push(line);
    }

    return lines;
  }

  function move(grid, direction) {
    if (!validateGrid(grid)) throw new TypeError("Invalid 2048 grid.");
    if (!["left", "right", "up", "down"].includes(direction)) {
      throw new RangeError("Unknown move direction.");
    }

    const next = emptyGrid();
    let score = 0;
    let moved = false;
    const mergedTargets = [];

    for (const line of linesFor(direction)) {
      const compact = line.map((index) => grid[index]).filter(Boolean);
      const output = [];
      let source = 0;
      let target = 0;

      while (source < compact.length) {
        const value = compact[source];
        if (value === compact[source + 1]) {
          const merged = value * 2;
          output.push(merged);
          score += merged;
          mergedTargets.push(line[target]);
          source += 2;
        } else {
          output.push(value);
          source += 1;
        }
        target += 1;
      }

      while (output.length < SIZE) output.push(0);

      line.forEach((index, position) => {
        next[index] = output[position];
        if (grid[index] !== output[position]) moved = true;
      });
    }

    return { grid: next, score, moved, mergedTargets };
  }

  function emptyIndices(grid) {
    const indices = [];
    grid.forEach((value, index) => {
      if (value === 0) indices.push(index);
    });
    return indices;
  }

  function spawn(grid, random = Math.random) {
    if (!validateGrid(grid)) throw new TypeError("Invalid 2048 grid.");
    const empties = emptyIndices(grid);
    if (!empties.length) return { grid: grid.slice(), index: -1, value: 0 };

    const randomIndex = Math.min(empties.length - 1, Math.floor(random() * empties.length));
    const index = empties[randomIndex];
    const value = random() < 0.9 ? 2 : 4;
    const next = grid.slice();
    next[index] = value;
    return { grid: next, index, value };
  }

  function canMove(grid) {
    if (!validateGrid(grid)) return false;
    if (grid.includes(0)) return true;

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const index = row * SIZE + col;
        if (col < SIZE - 1 && grid[index] === grid[index + 1]) return true;
        if (row < SIZE - 1 && grid[index] === grid[index + SIZE]) return true;
      }
    }

    return false;
  }

  function hasValue(grid, target) {
    return Array.isArray(grid) && grid.some((value) => value >= target);
  }

  function maxValue(grid) {
    return Array.isArray(grid) && grid.length ? Math.max(...grid) : 0;
  }

  return {
    SIZE,
    emptyGrid,
    validateGrid,
    move,
    spawn,
    canMove,
    hasValue,
    maxValue,
  };
});

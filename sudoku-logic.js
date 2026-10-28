(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Sudoku = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SIZE = 9;
  const ALL_DIGITS = 0x1ff;
  const LEVELS = {
    easy: { clues: 42, label: "入门" },
    standard: { clues: 35, label: "标准" },
    hard: { clues: 29, label: "挑战" },
  };

  function shuffle(values, random = Math.random) {
    const copy = values.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(random() * (index + 1));
      [copy[index], copy[pick]] = [copy[pick], copy[index]];
    }
    return copy;
  }

  function generateSolution(random = Math.random) {
    const base = [0, 1, 2];
    const rows = shuffle(base, random).flatMap((band) =>
      shuffle(base, random).map((row) => band * 3 + row));
    const cols = shuffle(base, random).flatMap((stack) =>
      shuffle(base, random).map((col) => stack * 3 + col));
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
    const grid = Array(SIZE * SIZE);

    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const pattern = (3 * (rows[row] % 3) + Math.floor(rows[row] / 3) + cols[col]) % 9;
        grid[row * SIZE + col] = digits[pattern];
      }
    }

    return grid;
  }

  function countSolutions(input, limit = 2) {
    const grid = input.slice();
    const rowMasks = Array(SIZE).fill(0);
    const colMasks = Array(SIZE).fill(0);
    const boxMasks = Array(SIZE).fill(0);

    for (let index = 0; index < grid.length; index += 1) {
      const value = grid[index];
      if (!value) continue;
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      const bit = 1 << (value - 1);
      if ((rowMasks[row] | colMasks[col] | boxMasks[box]) & bit) return 0;
      rowMasks[row] |= bit;
      colMasks[col] |= bit;
      boxMasks[box] |= bit;
    }

    let count = 0;

    function search() {
      if (count >= limit) return;
      let bestIndex = -1;
      let bestMask = 0;
      let bestCount = 10;

      for (let index = 0; index < 81; index += 1) {
        if (grid[index]) continue;
        const row = Math.floor(index / SIZE);
        const col = index % SIZE;
        const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
        const mask = ALL_DIGITS & ~(rowMasks[row] | colMasks[col] | boxMasks[box]);
        const candidates = mask.toString(2).replace(/0/g, "").length;
        if (candidates === 0) return;
        if (candidates < bestCount) {
          bestCount = candidates;
          bestIndex = index;
          bestMask = mask;
          if (candidates === 1) break;
        }
      }

      if (bestIndex === -1) {
        count += 1;
        return;
      }

      const row = Math.floor(bestIndex / SIZE);
      const col = bestIndex % SIZE;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      let mask = bestMask;

      while (mask && count < limit) {
        const bit = mask & -mask;
        mask ^= bit;
        const value = Math.log2(bit) + 1;
        grid[bestIndex] = value;
        rowMasks[row] |= bit;
        colMasks[col] |= bit;
        boxMasks[box] |= bit;
        search();
        grid[bestIndex] = 0;
        rowMasks[row] ^= bit;
        colMasks[col] ^= bit;
        boxMasks[box] ^= bit;
      }
    }

    search();
    return count;
  }

  function generatePuzzle(level = "easy", random = Math.random) {
    const config = LEVELS[level] || LEVELS.easy;
    const solution = generateSolution(random);
    const puzzle = solution.slice();
    let clues = 81;

    for (const index of shuffle(Array.from({ length: 81 }, (_, value) => value), random)) {
      if (clues <= config.clues) break;
      const backup = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[index] = backup;
      } else {
        clues -= 1;
      }
    }

    return { puzzle, solution, clues, level };
  }

  function isValidSolution(grid) {
    if (!Array.isArray(grid) || grid.length !== 81) return false;
    return grid.every((value) => Number.isInteger(value) && value >= 1 && value <= 9)
      && !grid.includes(0);
  }

  function sizeOfMask(mask) {
    let count = 0;
    while (mask) {
      mask &= mask - 1;
      count += 1;
    }
    return count;
  }

  return { SIZE, LEVELS, shuffle, generateSolution, countSolutions, generatePuzzle, isValidSolution, sizeOfMask };
});

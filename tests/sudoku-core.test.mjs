import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Sudoku = require("../sudoku-logic.js");

function seededRandom(seed = 928374) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

for (const [level, config] of Object.entries(Sudoku.LEVELS)) {
  const generated = Sudoku.generatePuzzle(level, seededRandom(928374));
  assert.equal(Sudoku.isValidSolution(generated.solution), true);
  assert.equal(Sudoku.countSolutions(generated.puzzle, 2), 1);
  assert(generated.clues >= config.clues);
  assert(generated.clues <= 45);
}

console.log(JSON.stringify({
  easy: "passed",
  standard: "passed",
  hard: "passed",
  uniqueSolutions: "passed",
}, null, 2));

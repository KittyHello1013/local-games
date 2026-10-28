import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const NumberPuzzle = require("../klotski-logic.js");

for (const size of [3, 4, 5]) {
  const start = NumberPuzzle.solved(size);
  assert.equal(NumberPuzzle.isSolved(start, size), true);
  let seed = 1234 + size;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const shuffled = NumberPuzzle.shuffle(size, random);
  assert.equal(NumberPuzzle.valid(shuffled, size), true);
  assert.equal(NumberPuzzle.isSolved(shuffled, size), false);
}

const nearSolved = [1, 2, 3, 4, 5, 6, 7, 0, 8];
const result = NumberPuzzle.moveTile(nearSolved, 3, 8);
assert.equal(result.moved, true);
assert.equal(NumberPuzzle.isSolved(result.grid, 3), true);

console.log(JSON.stringify({
  threeByThree: "passed",
  fourByFour: "passed",
  fiveByFive: "passed",
  tileMove: "passed",
}, null, 2));

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../2048-logic.js");

function moveLine(values, direction) {
  const grid = Array.from({ length: 16 }, (_, index) => values[index] || 0);
  return core.move(grid, direction);
}

let result = moveLine([2, 2, 4, 4], "left");
assert.deepEqual(result.grid.slice(0, 4), [4, 8, 0, 0]);
assert.equal(result.score, 12);

result = moveLine([2, 2, 2, 2], "left");
assert.deepEqual(result.grid.slice(0, 4), [4, 4, 0, 0]);
assert.equal(result.score, 8, "a tile must merge only once per move");

result = moveLine([4, 0, 4, 4], "right");
assert.deepEqual(result.grid.slice(0, 4), [0, 0, 4, 8]);
assert.equal(result.score, 8);

const vertical = Array(16).fill(0);
vertical[0] = 2;
vertical[4] = 2;
vertical[8] = 4;
result = core.move(vertical, "up");
assert.equal(result.grid[0], 4);
assert.equal(result.grid[4], 4);

const empty = core.emptyGrid();
const spawned = core.spawn(empty, () => 0);
assert.equal(spawned.index, 0);
assert.equal(spawned.value, 2);
assert.equal(spawned.grid.filter(Boolean).length, 1);

const blocked = [
  2, 4, 2, 4,
  4, 2, 4, 2,
  2, 4, 2, 4,
  4, 2, 4, 2,
];
assert.equal(core.canMove(blocked), false);
assert.equal(core.canMove([0, ...blocked.slice(1)]), true);
assert.equal(core.hasValue([2, 1024, 2048], 2048), true);
assert.equal(core.maxValue([2, 128, 16]), 128);

console.log(JSON.stringify({
  merges: "passed",
  score: "passed",
  vertical: "passed",
  spawn: "passed",
  blockedBoard: "passed",
}, null, 2));

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Hanoi = require("../hanoi-logic.js");

const initial = Hanoi.createPegs(3);
assert.deepEqual(initial, [[3, 2, 1], [], []]);
assert.equal(Hanoi.move(initial, 0, 1).moved, true);
assert.equal(Hanoi.move(initial, 0, 2).pegs[2][0], 1);
assert.equal(Hanoi.move(initial, 1, 2).moved, false);

let pegs = initial;
for (const [from, to] of Hanoi.solution(3)) {
  const result = Hanoi.move(pegs, from, to);
  assert.equal(result.moved, true);
  pegs = result.pegs;
}
assert.deepEqual(pegs[2], [3, 2, 1]);
assert.equal(Hanoi.optimalMoves(7), 127);

console.log(JSON.stringify({ legalMove: "passed", illegalMove: "passed", solved: "passed" }, null, 2));

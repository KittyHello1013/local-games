import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Spider = require("../spider-logic.js");

assert.equal(Spider.buildDeck(1).length, 104);
assert.equal(Spider.buildDeck(2).length, 104);
assert.equal(Spider.buildDeck(4).length, 104);

let seed = 4321;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const game = Spider.createGame(1, random);
assert.equal(game.columns.length, 10);
assert.deepEqual(game.columns.map((column) => column.length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
assert.equal(game.stock.length, 50);

const sequence = Array.from({ length: 13 }, (_, index) => ({
  id: `test-${index}`,
  rank: 13 - index,
  suit: "spade",
  faceUp: true,
}));
game.columns[0] = sequence.slice();
Spider.collectComplete(game);
assert.equal(game.completed, 1);
assert.equal(game.columns[0].length, 0);
const blocked = {
  columns: Array.from({ length: 10 }, () => [{ rank: 5, faceUp: true }]),
};
assert.equal(Spider.hasAvailableMove(blocked), false);

console.log(JSON.stringify({ decks: "passed", deal: "passed", completeRun: "passed", stuckDetection: "passed" }, null, 2));

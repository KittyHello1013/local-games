import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Gomoku = require("../gomoku-logic.js");
const board = Gomoku.createBoard(9);
for (let col = 0; col < 5; col += 1) board[4 * 9 + col] = 1;
assert.equal(Gomoku.winLine(board, 9, 40, 1).length, 5);
board[4 * 9 + 5] = 2;
assert.equal(Gomoku.winLine(board, 9, 40, 1).length, 5);
assert(Gomoku.chooseMove(board, 9, 13) >= 0);
console.log(JSON.stringify({ horizontalWin: "passed", aiMove: "passed" }, null, 2));

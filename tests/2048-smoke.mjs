import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/2048.html?test=1";

assert(executablePath, "CHROME_PATH must point to Edge or Chrome.");

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(gameUrl, { waitUntil: "networkidle0" });

  assert.equal(await page.$$eval(".tile-cell", (cells) => cells.length), 16);
  const initial = await page.evaluate(() => window.__game2048Test.getState());
  assert.equal(initial.grid.filter(Boolean).length, 2);
  assert.equal(initial.score, 0);
  assert.equal(initial.moves, 0);

  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
    await page.keyboard.press(key);
    const moves = await page.evaluate(() => window.__game2048Test.getState().moves);
    if (moves > 0) break;
  }
  const afterMove = await page.evaluate(() => window.__game2048Test.getState());
  assert(afterMove.moves > 0, "at least one direction must move the starting board");
  assert.equal(await page.$eval("#undo-move", (button) => button.disabled), false);

  await page.click("#undo-move");
  const afterUndo = await page.evaluate(() => window.__game2048Test.getState());
  assert.equal(afterUndo.moves, 0);
  assert.deepEqual(afterUndo.grid, initial.grid);

  await page.evaluate(() => {
    window.__game2048Test.setState({
      level: "starter",
      grid: [
        256, 256, 0, 0,
        2, 4, 0, 0,
        8, 16, 0, 0,
        32, 64, 0, 0,
      ],
      score: 8012,
      best: 16384,
      moves: 214,
      reachedTarget: false,
      pausedForWin: false,
      over: false,
    });
  });
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector("#board-2048")?.dataset.state === "won");
  assert.equal(await page.evaluate(() => window.__game2048Test.getState().reachedTarget), true);
  assert.equal(await page.evaluate(() => window.__game2048Test.getState().target), 512);
  assert.equal(await page.$eval("#continue-game", (button) => button.hidden), false);
  assert.equal(
    await page.$eval('[data-completion-action="primary"]', (button) => button.textContent),
    "进入标准",
  );

  await page.click('[data-completion-action="secondary"]');
  assert.equal(await page.$eval("#board-2048", (board) => board.dataset.state), "playing");

  await page.evaluate(() => {
    window.__game2048Test.setState({
      level: "expert",
      grid: [
        2, 4, 8, 0,
        16, 32, 64, 128,
        256, 512, 1024, 0,
        2, 4, 8, 2048,
      ],
      score: 18244,
      best: 24680,
      moves: 318,
      reachedTarget: true,
      pausedForWin: false,
      over: false,
    });
  });
  await page.screenshot({ path: "assets/2048-preview.png" });

  await page.click("#new-game");
  const restarted = await page.evaluate(() => window.__game2048Test.getState());
  assert.equal(restarted.moves, 0);
  assert.equal(restarted.score, 0);
  assert.equal(restarted.grid.filter(Boolean).length, 2);

  await page.evaluate(() => {
    window.__game2048Test.setState({
      grid: [
        0, 0, 0, 2,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ],
      score: 0,
      best: 0,
      moves: 0,
      reachedTarget: false,
      pausedForWin: false,
      over: false,
    });
  });
  const boardBox = await page.$eval("#board-2048", (board) => {
    const rect = board.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  await page.mouse.move(
    boardBox.x + boardBox.width * 0.75,
    boardBox.y + boardBox.height * 0.2,
  );
  await page.mouse.down();
  await page.mouse.move(
    boardBox.x + boardBox.width * 0.25,
    boardBox.y + boardBox.height * 0.2,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.waitForFunction(() => window.__game2048Test.getState().moves === 1);

  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(
    await page.evaluate(() => window.__game2048Test.getState().moves),
    1,
    "the current game must survive a reload",
  );

  await page.setViewport({ width: 375, height: 844, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0" });
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert(mobileOverflow <= 1, `2048 must not scroll horizontally: ${mobileOverflow}px`);
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    cells: 16,
    movement: "passed",
    undo: "passed",
    winAndContinue: "passed",
    newGame: "passed",
    swipe: "passed",
    reloadSave: "passed",
    mobileOverflow,
    pageErrors,
  }, null, 2));
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/minesweeper.html";

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

  assert.equal(await page.$$eval(".cell", (items) => items.length), 81);
  assert.equal(await page.$eval("#board", (element) => element.dataset.state), "ready");
  assert.equal(await page.$eval("#mines-left", (element) => element.textContent), "10");

  await page.evaluate(() => {
    const installRandom = () => {
      let seed = 123456789;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    };
    installRandom();
    window.__resetGameRandom = installRandom;
  });

  await page.click('[data-index="40"]');
  await page.waitForFunction(() => document.querySelector("#board")?.dataset.state === "playing");
  assert(
    await page.$eval('[data-index="40"]', (cell) => cell.classList.contains("is-revealed")),
    "the first clicked cell must be revealed",
  );

  let lost = false;
  for (let index = 0; index < 81; index += 1) {
    const currentState = await page.$eval("#board", (element) => element.dataset.state);
    if (currentState === "lost") {
      lost = true;
      break;
    }

    const isHidden = await page.$eval(
      `[data-index="${index}"]`,
      (cell) => !cell.classList.contains("is-revealed"),
    );
    if (isHidden) await page.click(`[data-index="${index}"]`);
  }
  assert(lost, "clicking the whole board must eventually hit a mine");

  const mineIndices = await page.$$eval(
    ".cell.is-mine, .cell.is-exploded",
    (items) => items.map((item) => Number(item.dataset.index)),
  );
  assert.equal(mineIndices.length, 10);

  await page.click("#restart");
  await page.evaluate(() => window.__resetGameRandom());
  await page.click('[data-index="40"]');
  await page.waitForFunction(() => document.querySelector("#board")?.dataset.state === "playing");

  for (let index = 0; index < 81; index += 1) {
    if (mineIndices.includes(index)) continue;
    const currentState = await page.$eval("#board", (element) => element.dataset.state);
    if (currentState === "won") break;
    const isHidden = await page.$eval(
      `[data-index="${index}"]`,
      (cell) => !cell.classList.contains("is-revealed"),
    );
    if (isHidden) await page.click(`[data-index="${index}"]`);
  }

  await page.waitForFunction(() => document.querySelector("#board")?.dataset.state === "won");
  assert.notEqual(await page.$eval("#best-time", (element) => element.textContent), "暂无");
  assert.equal(
    await page.$eval('[data-completion-action="primary"]', (button) => button.textContent),
    "进入中级",
  );
  await page.screenshot({ path: ".hallmark/shots/game-won.png" });
  await page.click('[data-completion-action="primary"]');
  assert.equal(await page.$$eval(".cell", (cells) => cells.length), 256);

  await page.click("#restart");
  const preRevealFlagIndex = 1;
  await page.click(`[data-index="${preRevealFlagIndex}"]`, { button: "right" });
  assert.equal(await page.$eval("#board", (element) => element.dataset.state), "ready");
  assert.equal(await page.$eval("#timer", (element) => element.textContent), "00:00");
  const hiddenIndex = await page.$$eval(
    ".cell",
    (cells) => Number(cells.find((cell) => !cell.classList.contains("is-revealed")).dataset.index),
  );
  await page.focus(`[data-index="${hiddenIndex}"]`);
  await page.keyboard.press("f");
  assert(
    await page.$eval(
      `[data-index="${hiddenIndex}"]`,
      (cell) => cell.classList.contains("is-flagged"),
    ),
    "the F key must flag the focused cell",
  );

  const beforeArrow = await page.evaluate(() => Number(document.activeElement.dataset.index));
  await page.keyboard.press("ArrowRight");
  const afterArrow = await page.evaluate(() => Number(document.activeElement.dataset.index));
  assert.equal(afterArrow, beforeArrow + 1, "the right arrow must move focus one column");

  await page.click("#flag-mode");
  const touchModeIndex = await page.$$eval(
    ".cell",
    (cells) => Number(cells.find((cell) => !cell.classList.contains("is-flagged")).dataset.index),
  );
  await page.click(`[data-index="${touchModeIndex}"]`);
  assert(
    await page.$eval(
      `[data-index="${touchModeIndex}"]`,
      (cell) => cell.classList.contains("is-flagged"),
    ),
    "flag mode must flag on a single click",
  );

  await page.click('label[for="level-expert"]');
  assert.equal(await page.$eval("#board", (element) => element.getAttribute("aria-colcount")), "30");
  assert.equal(await page.$$eval(".cell", (items) => items.length), 480);
  assert.equal(await page.$eval("#board", (element) => element.dataset.state), "ready");

  await page.setViewport({ width: 375, height: 844, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(await page.$eval("#board", (element) => element.dataset.state), "ready");
  assert.equal(await page.$eval("#board", (element) => element.getAttribute("aria-colcount")), "30");

  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - window.innerWidth,
    board: document.querySelector(".board-scroll").scrollWidth
      - document.querySelector(".board-scroll").clientWidth,
  }));
  assert(overflow.page <= 1, `the page must not scroll horizontally at 375px: ${overflow.page}px`);
  assert(overflow.board > 0, "the expert board must keep usable cell widths inside its own scroller");
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    cells: 81,
    loss: "passed",
    win: "passed",
    keyboard: "passed",
    flagMode: "passed",
    expertCells: 480,
    mobilePageOverflow: overflow.page,
    mobileBoardOverflow: overflow.board,
    pageErrors,
  }, null, 2));
} finally {
  await browser.close();
}

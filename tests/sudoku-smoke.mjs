import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/sudoku.html?test=1";

assert(executablePath, "CHROME_PATH must point to Edge or Chrome.");

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(gameUrl, { waitUntil: "networkidle0" });

  assert.equal(await page.$$eval(".sudoku-cell", (cells) => cells.length), 81);
  const initial = await page.evaluate(() => window.__sudokuTest.getState());
  assert(initial.puzzle.filter(Boolean).length > 0);
  assert.equal(initial.values.every((value, index) => value === initial.puzzle[index]), true);

  const emptyIndex = initial.puzzle.findIndex((value) => value === 0);
  await page.click(`[data-index="${emptyIndex}"]`);
  await page.keyboard.press(String(initial.solution[emptyIndex]));
  const afterEntry = await page.evaluate(() => window.__sudokuTest.getState());
  assert.equal(afterEntry.values[emptyIndex], initial.solution[emptyIndex]);

  await page.click('label[for="sudoku-hard"]');
  const hard = await page.evaluate(() => window.__sudokuTest.getState());
  assert.equal(hard.difficulty, "hard");
  assert(hard.puzzle.filter(Boolean).length <= 32);

  await page.evaluate(() => window.__sudokuTest.fillProgress(0.62));
  await page.screenshot({ path: "assets/sudoku-preview.png" });

  await page.evaluate(() => window.__sudokuTest.solveCurrent());
  await page.waitForFunction(() => document.querySelector("#sudoku-state")?.textContent === "已完成");
  assert.notEqual(await page.$eval("#sudoku-best", (element) => element.textContent), "暂无");
  assert.equal(await page.$eval(".completion-dialog", (dialog) => dialog.open), true);
  await page.click('[data-completion-action="secondary"]');

  await page.setViewport({ width: 375, height: 844, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    0,
  );
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({
    cells: 81,
    entry: "passed",
    difficulty: "passed",
    completion: "passed",
    mobile: "passed",
  }, null, 2));
} finally {
  await browser.close();
}

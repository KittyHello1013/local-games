import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/klotski.html?test=1";

assert(executablePath, "CHROME_PATH must point to Edge or Chrome.");

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(gameUrl, { waitUntil: "networkidle0" });

  assert.equal(await page.$$eval(".number-puzzle-tile", (tiles) => tiles.length), 8);
  await page.evaluate(() => {
    window.__numberPuzzleTest.setState({
      level: 3,
      grid: [1, 2, 3, 4, 5, 6, 7, 0, 8],
      moves: 12,
    });
  });
  await page.click('[data-number="8"]');
  await page.waitForFunction(() => document.querySelector("#number-puzzle-state")?.textContent === "已完成");
  assert.equal(await page.$eval("#number-puzzle-moves", (element) => element.textContent), "13");
  assert.equal(
    await page.$eval('[data-completion-action="primary"]', (button) => button.textContent),
    "挑战 4 阶",
  );
  await page.click('[data-completion-action="secondary"]');

  await page.click("#number-puzzle-undo");
  assert.equal(await page.$eval("#number-puzzle-state", (element) => element.textContent), "进行中");

  await page.click('label[for="puzzle-4"]');
  assert.equal(await page.$$eval(".number-puzzle-tile", (tiles) => tiles.length), 15);
  await page.click('label[for="puzzle-5"]');
  assert.equal(await page.$$eval(".number-puzzle-tile", (tiles) => tiles.length), 24);
  await page.evaluate(() => {
    window.__numberPuzzleTest.setState({
      level: 4,
      grid: [
        1, 2, 3, 4,
        5, 6, 0, 8,
        9, 10, 7, 11,
        13, 14, 15, 12,
      ],
      moves: 86,
    });
  });
  await page.screenshot({ path: "assets/klotski-preview.png" });

  await page.setViewport({ width: 375, height: 844, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    0,
  );
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({
    solved: "passed",
    undo: "passed",
    difficulty: "passed",
    mobile: "passed",
  }, null, 2));
} finally {
  await browser.close();
}

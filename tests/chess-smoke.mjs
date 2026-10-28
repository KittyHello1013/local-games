import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/chess.html?test=1";

assert(executablePath);
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(gameUrl, { waitUntil: "networkidle0" });
  assert.equal(await page.$$eval(".chess-square", (squares) => squares.length), 64);
  await page.click('[data-square="e2"]');
  await page.click('[data-square="e4"]');
  await page.waitForFunction(() => Number(document.querySelector("#chess-moves")?.textContent) >= 2);
  assert.notEqual(await page.evaluate(() => window.__chessTest.getFen()), undefined);
  await page.screenshot({ path: "assets/chess-preview.png" });
  await page.click('label[for="chess-hard"]');
  assert.equal(await page.evaluate(() => window.__chessTest.getLevel()), "hard");
  await page.click('[data-square="d2"]');
  await page.click('[data-square="d4"]');
  await page.waitForFunction(() => Number(document.querySelector("#chess-moves")?.textContent) >= 2);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ squares: 64, playerMove: "passed", aiReply: "passed", levels: "passed" }, null, 2));
} finally {
  await browser.close();
}

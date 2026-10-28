import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/gomoku.html";
assert(executablePath);

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(gameUrl, { waitUntil: "networkidle0" });
  assert.equal(await page.$$eval(".gomoku-cell", (cells) => cells.length), 225);
  await page.click('[data-index="112"]');
  await page.waitForFunction(() => Number(document.querySelector("#gomoku-white")?.textContent) === 1);
  assert.equal(await page.$$eval(".gomoku-cell.is-last", (cells) => cells.length), 1);
  assert((await page.$$eval("#gomoku-history li", (items) => items.length)) >= 2);
  await page.screenshot({ path: "assets/gomoku-preview.png" });
  await page.click("#gomoku-undo");
  assert.equal(await page.$eval("#gomoku-black", (element) => element.textContent), "0");
  await page.click('label[for="gomoku-hard"]');
  assert.equal(await page.$$eval(".gomoku-cell", (cells) => cells.length), 225);
  await page.click('label[for="gomoku-pvp"]');
  await page.click('[data-index="0"]');
  await page.click('[data-index="1"]');
  assert.equal(await page.$eval("#gomoku-black", (element) => element.textContent), "1");
  assert.equal(await page.$eval("#gomoku-white", (element) => element.textContent), "1");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ humanMove: "passed", aiReply: "passed", undo: "passed", pvp: "passed" }, null, 2));
} finally {
  await browser.close();
}

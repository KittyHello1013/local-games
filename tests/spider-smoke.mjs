import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/spider.html";
assert(executablePath);

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(gameUrl, { waitUntil: "networkidle0" });
  assert.equal(await page.$$eval(".spider-column", (columns) => columns.length), 10);
  assert.equal(await page.$$eval(".board-head", (heads) => heads.length), 0);
  assert.equal(await page.$eval("#spider-remaining", (element) => element.textContent), "50");
  const topCard = '[data-column="0"] .spider-card:last-child';
  await page.click(topCard);
  assert((await page.$$eval(".spider-card.is-selected", (cards) => cards.length)) > 0);
  await page.click(topCard);
  assert.equal(await page.$$eval(".spider-card.is-selected", (cards) => cards.length), 0);
  const beforeHeight = await page.$eval(".spider-board", (board) => board.getBoundingClientRect().height);
  await page.click("#spider-stock");
  assert.equal(await page.$eval("#spider-remaining", (element) => element.textContent), "40");
  const afterHeight = await page.$eval(".spider-board", (board) => board.getBoundingClientRect().height);
  assert.equal(afterHeight, beforeHeight, "the card board must keep a fixed height after dealing");
  await page.screenshot({ path: "assets/spider-preview.png" });
  await page.click('label[for="spider-2"]');
  assert.equal(await page.$eval("#spider-remaining", (element) => element.textContent), "50");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ columns: 10, deal: "passed", difficulty: "passed" }, null, 2));
} finally {
  await browser.close();
}

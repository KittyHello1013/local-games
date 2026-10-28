import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/xiangqi.html?test=1";

assert(executablePath);
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack || error.message));
  await page.goto(gameUrl, { waitUntil: "networkidle0" });
  assert.equal(await page.$$eval(".xiangqi-cell", (cells) => cells.length), 90);
  assert.equal(
    await page.$eval(".xiangqi-river", (river) => river.textContent.replace(/\s/g, "").includes("楚河")),
    true,
  );
  await page.click('[data-square="a0"]');
  await page.click('[data-square="a1"]');
  assert.notEqual(await page.$(".xiangqi-moving-piece"), null);
  await page.waitForFunction(() => Number(document.querySelector("#xiangqi-moves")?.textContent) >= 2);
  assert((await page.$$eval("#xiangqi-history li", (items) => items.length)) >= 2);
  assert.notEqual(await page.evaluate(() => window.__xiangqiTest.getFen()), undefined);
  await page.screenshot({ path: "assets/xiangqi-preview.png" });
  await page.click('label[for="xiangqi-hard"]');
  assert.equal(await page.evaluate(() => window.__xiangqiTest.getLevel()), "hard");
  await page.click('[data-square="a0"]');
  await page.click('[data-square="a1"]');
  await page.waitForFunction(() => Number(document.querySelector("#xiangqi-moves")?.textContent) >= 2);
  await page.click('label[for="xiangqi-pvp"]');
  assert.equal(await page.evaluate(() => window.__xiangqiTest.getMode()), "pvp");
  await page.click('[data-square="a0"]');
  await page.click('[data-square="a1"]');
  await page.waitForFunction(() => document.querySelector("#xiangqi-moves")?.textContent === "1");
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(await page.$eval("#xiangqi-moves", (element) => element.textContent), "1");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cells: 90, playerMove: "passed", aiReply: "passed", levels: "passed" }, null, 2));
} finally {
  await browser.close();
}

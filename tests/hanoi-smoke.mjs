import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const Hanoi = require("../hanoi-logic.js");
const executablePath = process.env.CHROME_PATH;
const gameUrl = process.env.GAME_URL || "http://127.0.0.1:3017/hanoi.html";

assert(executablePath, "CHROME_PATH must point to Edge or Chrome.");

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(gameUrl, { waitUntil: "networkidle0" });

  assert.equal(await page.$$eval(".hanoi-peg", (pegs) => pegs.length), 3);
  for (const [from, to] of Hanoi.solution(3)) {
    await page.click(`[data-peg="${from}"]`);
    await page.click(`[data-peg="${to}"]`);
  }
  await page.waitForFunction(() => document.querySelector("#hanoi-state")?.textContent === "已完成");
  assert.equal(await page.$eval("#hanoi-moves", (element) => element.textContent), "7");
  assert.equal(
    await page.$eval('[data-completion-action="primary"]', (button) => button.textContent),
    "挑战 5 层",
  );
  await page.click('[data-completion-action="secondary"]');

  await page.click("#hanoi-undo");
  assert.equal(await page.$eval("#hanoi-state", (element) => element.textContent), "进行中");

  await page.click('label[for="hanoi-7"]');
  assert.equal(await page.$$eval(".hanoi-disk", (disks) => disks.length), 7);
  assert.equal(await page.$eval("#hanoi-optimal", (element) => element.textContent), "127");
  await page.screenshot({ path: "assets/hanoi-preview.png" });

  await page.setViewport({ width: 375, height: 844, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0" });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    0,
  );
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ solved: "passed", undo: "passed", levels: "passed", mobile: "passed" }, null, 2));
} finally {
  await browser.close();
}

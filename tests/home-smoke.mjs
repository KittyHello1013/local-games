import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const executablePath = process.env.CHROME_PATH;
const homeUrl = process.env.HOME_URL || "http://127.0.0.1:3017/";

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
  await page.goto(homeUrl, { waitUntil: "networkidle0" });

  assert.equal(await page.$eval("#game-count", (element) => element.textContent), "9");
  assert.equal(await page.$$eval(".game-launcher", (cards) => cards.length), 9);
  assert.deepEqual(
    await page.$$eval(
      ".game-launcher",
      (links) => links.map((link) => link.getAttribute("href")),
    ),
    [
      "./minesweeper.html",
      "./2048.html",
      "./hanoi.html",
      "./sudoku.html",
      "./klotski.html",
      "./spider.html",
      "./chess.html",
      "./gomoku.html",
      "./xiangqi.html",
    ],
  );
  assert(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    "the home game wall must fit in one desktop screen",
  );
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  assert(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    "the home game wall must fit in one 1280x800 screen",
  );
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  assert.equal(
    await page.$eval(
      '[data-game-id="minesweeper"]',
      (link) => link.getAttribute("href"),
    ),
    "./minesweeper.html",
  );

  await page.click('[data-game-id="minesweeper"]');
  await page.waitForFunction(() => document.querySelector("#board")?.dataset.state === "ready");
  assert.equal(await page.$$eval(".cell", (cells) => cells.length), 81);

  await page.click(".brand");
  await page.waitForFunction(() => document.querySelector("#game-count")?.textContent === "9");
  assert.equal(
    await page.$eval(".game-launcher", (link) => link.dataset.gameId),
    "minesweeper",
    "the most recently played game must move to the first position",
  );

  const desktop = await page.$$eval(".game-launcher", (cards) => cards.map((card) => ({
    top: Math.round(card.getBoundingClientRect().top),
    width: Math.round(card.getBoundingClientRect().width),
  })));
  assert(desktop.every((card) => card.width < 260), "game launchers must stay compact");
  assert(
    await page.$$eval(
      ".game-launcher__tile",
      (tiles) => tiles.every((tile) => tile.getBoundingClientRect().width <= 181),
    ),
    "game icons must stay compact",
  );
  await page.screenshot({ path: ".hallmark/shots/home-two-games.png", fullPage: true });

  await page.setViewport({ width: 375, height: 844, deviceScaleFactor: 1 });
  const mobile = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".game-launcher")];
    return {
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      pageHeight: document.documentElement.scrollHeight - window.innerHeight,
      cardTops: cards.map((card) => Math.round(card.getBoundingClientRect().top)),
      cardWidths: cards.map((card) => Math.round(card.getBoundingClientRect().width)),
    };
  });
  assert(mobile.pageOverflow <= 1, `home page must not scroll horizontally: ${mobile.pageOverflow}px`);
  assert(mobile.pageHeight <= 1, `home page must fit one screen: ${mobile.pageHeight}px`);
  assert.equal(mobile.cardTops[0], mobile.cardTops[1], "phone launchers use the same first row");
  assert(mobile.cardTops[3] > mobile.cardTops[0], "phone launchers wrap to a second row");
  assert.deepEqual(pageErrors, []);

  console.log(JSON.stringify({
    initialGames: 9,
    navigation: "passed",
    twoGameLayout: desktop,
    mobileLayout: mobile,
    pageErrors,
  }, null, 2));
} finally {
  await browser.close();
}

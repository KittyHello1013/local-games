(() => {
  "use strict";

  const PLAY_HISTORY_KEY = "local-games.play-history.v1";
  const ICONS = {
    minesweeper: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 8h48v48H8zM24 8v48M40 8v48M8 24h48M8 40h48" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M31 19l7 7-5 2z" fill="currentColor"/>
        <path d="M33 21v18" fill="none" stroke="currentColor" stroke-width="3"/>
        <rect x="12" y="44" width="8" height="8" fill="currentColor"/>
      </svg>`,
    "2048": `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="6" y="6" width="24" height="24" fill="currentColor" opacity=".22"/>
        <rect x="34" y="6" width="24" height="24" fill="currentColor" opacity=".45"/>
        <rect x="6" y="34" width="24" height="24" fill="currentColor" opacity=".7"/>
        <rect x="34" y="34" width="24" height="24" fill="currentColor"/>
      </svg>`,
    hanoi: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 10v42M32 10v42M52 10v42M7 54h50" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M18 48h28v6H18zM22 40h20v6H22zM26 32h12v6H26z" fill="currentColor"/>
      </svg>`,
    sudoku: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 8h48v48H8zM24 8v48M40 8v48M8 24h48M8 40h48" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M13 18h6M29 18h6M45 34h6M13 50h6M29 50h6" fill="none" stroke="currentColor" stroke-width="4"/>
      </svg>`,
    klotski: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="7" y="7" width="14" height="14" fill="currentColor"/>
        <rect x="25" y="7" width="14" height="14" fill="currentColor" opacity=".55"/>
        <rect x="43" y="7" width="14" height="14" fill="currentColor"/>
        <rect x="7" y="25" width="14" height="14" fill="currentColor" opacity=".55"/>
        <rect x="25" y="25" width="14" height="14" fill="currentColor"/>
        <rect x="7" y="43" width="14" height="14" fill="currentColor"/>
        <rect x="25" y="43" width="14" height="14" fill="currentColor" opacity=".55"/>
        <rect x="43" y="43" width="14" height="14" fill="currentColor"/>
      </svg>`,
    spider: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="14" width="25" height="36" fill="none" stroke="currentColor" stroke-width="2"/>
        <rect x="20" y="8" width="25" height="36" fill="currentColor"/>
        <path d="M25 18h5M25 25h5M25 32h5M41 38h2M49 38h2M20 38l8 7M20 46l8-7M52 38l-8 7M52 46l-8-7" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>`,
    chess: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M15 48h34v8H15zM20 43h24l-4-18-8-8 4 13-8-6 3 9-9 3z" fill="currentColor"/>
      </svg>`,
    gomoku: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 12v40M24 12v40M36 12v40M48 12v40M12 12h40M12 24h40M12 36h40M12 48h40" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="24" cy="24" r="5" fill="currentColor"/>
        <circle cx="36" cy="36" r="5" fill="currentColor"/>
        <circle cx="36" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>`,
    xiangqi: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="3"/>
        <text x="32" y="42" text-anchor="middle" font-size="30" font-family="KaiTi, serif" font-weight="700" fill="currentColor">将</text>
      </svg>`,
  };

  const gameCatalog = [
    {
      id: "minesweeper",
      index: "01",
      title: "扫雷",
      tagline: "翻开安全格，避开全部地雷。",
      path: "./minesweeper.html",
      action: "开始扫雷",
      preview: "./assets/minesweeper-preview.png",
      previewAlt: "扫雷界面，包含方格棋盘、难度选择和局面面板",
      icon: "minesweeper",
      type: "逻辑解谜",
      players: "单人",
      network: "无需联网",
      description: "三档棋盘难度，支持鼠标、键盘和触屏操作。成绩保存在这台电脑的浏览器里。",
    },
    {
      id: "2048",
      index: "02",
      title: "2048",
      tagline: "合并数字，抵达 2048。",
      path: "./2048.html",
      action: "开始 2048",
      preview: "./assets/2048-preview.png",
      previewAlt: "2048 界面，包含 4×4 数字棋盘和得分面板",
      icon: "2048",
      type: "数字益智",
      players: "单人",
      network: "无需联网",
      description: "通过方向键或滑动合并相同数字。支持一步撤销、最高分和自动存档。",
    },
    {
      id: "hanoi",
      index: "03",
      title: "汉诺塔",
      tagline: "把所有圆盘移到最右柱。",
      path: "./hanoi.html",
      action: "开始汉诺塔",
      preview: "./assets/hanoi-preview.png",
      previewAlt: "汉诺塔界面，包含三根柱子、圆盘和步数面板",
      icon: "hanoi",
      type: "逻辑益智",
      players: "单人",
      network: "无需联网",
      description: "三档圆盘数量，遵守大小顺序完成转移。支持撤销、计时和最佳步数。",
    },
    {
      id: "sudoku",
      index: "04",
      title: "数独",
      tagline: "用 1 到 9 填满每一行、每一列与每一宫。",
      path: "./sudoku.html",
      action: "开始数独",
      preview: "./assets/sudoku-preview.png",
      previewAlt: "数独界面，包含九宫格棋盘、数字键盘和计时面板",
      icon: "sudoku",
      type: "数字逻辑",
      players: "单人",
      network: "无需联网",
      description: "三档难度，本地生成唯一解题目。支持提示、错误计数、键盘输入和自动存档。",
    },
    {
      id: "klotski",
      index: "05",
      title: "华容道",
      tagline: "滑动数字，按顺序还原。",
      path: "./klotski.html",
      action: "开始华容道",
      preview: "./assets/klotski-preview.png",
      previewAlt: "数字华容道界面，包含数字滑块棋盘、难度选择和步数面板",
      icon: "klotski",
      type: "数字拼图",
      players: "单人",
      network: "无需联网",
      description: "三阶、四阶和五阶数字排序，支持方向键、方向按钮、撤销、计时和最佳步数。",
    },
    {
      id: "spider",
      index: "06",
      title: "蜘蛛纸牌",
      tagline: "收走八组同花色序列。",
      path: "./spider.html",
      action: "开始蜘蛛纸牌",
      icon: "spider",
      type: "纸牌",
      players: "单人",
      network: "无需联网",
      description: "单花色、双花色和四花色三档难度，支持发牌与撤销。",
    },
    {
      id: "chess",
      index: "07",
      title: "国际象棋",
      tagline: "与电脑进行完整规则对弈。",
      path: "./chess.html",
      action: "开始国际象棋",
      icon: "chess",
      type: "棋类",
      players: "单人",
      network: "无需联网",
      description: "三档电脑强度，支持王车易位、吃过路兵、将军与将死。",
    },
    {
      id: "gomoku",
      index: "08",
      title: "五子棋",
      tagline: "执黑先行，连成五子。",
      path: "./gomoku.html",
      action: "开始五子棋",
      icon: "gomoku",
      type: "棋类",
      players: "单人",
      network: "无需联网",
      description: "标准 15 路棋盘，支持人机与本地双人、落子动画、记录和撤销。",
    },
    {
      id: "xiangqi",
      index: "09",
      title: "中国象棋",
      tagline: "执红对阵电脑。",
      path: "./xiangqi.html",
      action: "开始中国象棋",
      icon: "xiangqi",
      type: "棋类",
      players: "单人",
      network: "无需联网",
      description: "支持人机与本地双人模式、三层电脑搜索、楚河汉界和走棋动画。",
    },
  ];

  const grid = document.querySelector("#game-grid");
  const count = document.querySelector("#game-count");
  const status = document.querySelector("#catalog-status");
  const template = document.querySelector("#game-card-template");

  function readHistory() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PLAY_HISTORY_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function recentFirst(games) {
    const history = readHistory();
    return games
      .map((game, order) => ({ game, order }))
      .sort((a, b) => {
        const aHistory = history[a.game.id] || {};
        const bHistory = history[b.game.id] || {};
        return (Number(bHistory.lastPlayed) || 0) - (Number(aHistory.lastPlayed) || 0)
          || (Number(bHistory.plays) || 0) - (Number(aHistory.plays) || 0)
          || a.order - b.order;
      })
      .map(({ game }) => game);
  }

  function renderCatalog(games = gameCatalog) {
    if (!grid || !template) return;

    grid.replaceChildren();
    const fragment = document.createDocumentFragment();

    recentFirst(games).forEach((game) => {
      const launcher = template.content.firstElementChild.cloneNode(true);
      launcher.dataset.gameId = game.id;
      launcher.href = game.path;
      launcher.setAttribute("aria-label", `打开${game.title}`);
      launcher.querySelector(".game-launcher__name").textContent = game.title;
      launcher.querySelector(".game-launcher__tile").innerHTML = ICONS[game.icon] || "";
      fragment.append(launcher);
    });

    grid.append(fragment);
    count.textContent = String(games.length);
    status.textContent = `游戏目录已显示 ${games.length} 款游戏。`;
  }

  window.gameCatalog = gameCatalog;
  window.renderGameCatalog = renderCatalog;
  renderCatalog();
})();

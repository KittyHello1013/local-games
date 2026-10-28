# 本地游戏集

一个无需联网、无需账号的本地游戏集，当前包含九款游戏。首页以紧凑图标墙展示游戏，最近游玩的游戏排在前方。

## 运行

直接双击 `index.html`，进入游戏目录，再选择要玩的游戏。

也可以在本目录启动一个本地静态服务器：

```powershell
python -m http.server 3017
```

然后访问 `http://localhost:3017`，从游戏目录进入游戏。

## 功能

扫雷：

- 初级、中级、高级三种难度
- 第一格及其周围八格保证安全
- 左键翻开、右键插旗；触屏支持插旗模式与长按插旗
- 数字格快速展开
- 计时、剩余雷数、已翻格数和本地最佳成绩
- 方向键移动、Enter 翻开、F 插旗、R 开新局

2048：

- 方向键、WASD 和滑动操作
- 相同数字合并、计分、一步撤销
- 入门、标准、进阶分别以 512、1024、2048 为目标
- 每个数字使用独立色阶
- 达成 2048 后可继续挑战
- 自动保存棋盘、得分、步数和最高分

汉诺塔：

- 三、五、七层三档难度
- 点击柱子或键盘移动圆盘
- 撤销、计时和最佳步数

数独：

- 入门、标准、挑战三档难度
- 本地生成唯一解题目
- 数字键盘、键盘输入、提示、错误计数和最佳时间

数字华容道：

- 三阶、四阶、五阶三档数字排序
- 点击相邻数字、方向键或屏幕方向按钮移动
- 撤销、计时、最佳步数和自动存档

蜘蛛纸牌：

- 单花色、双花色和四花色三档难度
- 十列接牌、发牌、完整序列收牌和撤销
- 固定高度牌桌，无牌可接时提示发牌

国际象棋：

- 入门、标准、进阶三档电脑强度
- 完整王车易位、吃过路兵、升变、将军和将死规则

五子棋：

- 标准 15 路交叉点棋盘
- 人机与本地双人模式
- 落子动画、最后一步标记、落子记录和撤销

中国象棋：

- 入门、标准、进阶三档电脑强度
- 人机与本地双人模式
- 楚河汉界、棋子移动动画、最后一步标记和走棋记录
- 完整蹩马腿、塞象眼、将帅照面和将死规则

所有游戏通关后会弹出结果窗口，可直接进入下一关或提升到下一档难度。

所有游戏均支持桌面与触屏响应式布局，成绩和进度只保存在当前浏览器。

成绩只保存在当前浏览器的本地存储中，不会上传到网络。

## 添加游戏

首页目录由 `catalog.js` 中的 `gameCatalog` 数组驱动。添加新游戏时：

1. 创建游戏 HTML，沿用 `tokens.css`、`base.css` 和 `styles.css`。
2. 将游戏预览图放入 `assets/`。
3. 在 `catalog.js` 中添加一条目录配置。

目录会自动切换单卡和双列布局，手机端会自动堆叠，不需要修改首页 HTML。

## 自动测试

使用 Edge 或 Chrome 和全局安装的 `puppeteer-core`：

```powershell
python -m http.server 3017
node tests/home-smoke.mjs
node tests/smoke.mjs
node tests/2048-core.test.mjs
node tests/2048-smoke.mjs
node tests/hanoi-core.test.mjs
node tests/hanoi-smoke.mjs
node tests/sudoku-core.test.mjs
node tests/sudoku-smoke.mjs
node tests/klotski-core.test.mjs
node tests/klotski-smoke.mjs
node tests/spider-core.test.mjs
node tests/spider-smoke.mjs
node tests/gomoku-core.test.mjs
node tests/gomoku-smoke.mjs
node tests/chess-smoke.mjs
node tests/xiangqi-smoke.mjs
```

## 第三方规则库

国际象棋使用 `chess.js`，中国象棋使用 `@weshell/xiangqi.js`。浏览器打包文件位于 `vendor/`，两个项目均采用 BSD-2-Clause 许可证，许可证原文随项目本地保存。

(() => {
  "use strict";

  const gameId = document.body.dataset.gameId;
  if (!gameId) return;

  const key = "local-games.play-history.v1";
  let history = {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "{}");
    history = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    history = {};
  }

  const previous = history[gameId] || {};
  history[gameId] = {
    lastPlayed: Date.now(),
    plays: (Number(previous.plays) || 0) + 1,
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(history));
  } catch {
    // Play history is optional.
  }
})();

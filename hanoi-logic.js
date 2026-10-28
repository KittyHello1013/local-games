(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Hanoi = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createPegs(disks) {
    const first = [];
    for (let disk = disks; disk >= 1; disk -= 1) first.push(disk);
    return [first, [], []];
  }

  function clonePegs(pegs) {
    return pegs.map((peg) => peg.slice());
  }

  function move(pegs, from, to) {
    if (!Array.isArray(pegs) || pegs.length !== 3) throw new TypeError("Invalid pegs.");
    if (from === to || from < 0 || from > 2 || to < 0 || to > 2) {
      return { pegs: clonePegs(pegs), moved: false, disk: 0, won: false };
    }

    const source = pegs[from];
    const target = pegs[to];
    const sourceTop = source[source.length - 1];
    const targetTop = target[target.length - 1];
    if (!sourceTop || (targetTop && sourceTop > targetTop)) {
      return { pegs: clonePegs(pegs), moved: false, disk: 0, won: false };
    }

    const next = clonePegs(pegs);
    const disk = next[from].pop();
    next[to].push(disk);
    const total = pegs.reduce((sum, peg) => sum + peg.length, 0);
    return {
      pegs: next,
      moved: true,
      disk,
      won: next[2].length === total,
    };
  }

  function optimalMoves(disks) {
    return (2 ** disks) - 1;
  }

  function solution(disks, from = 0, to = 2, spare = 1) {
    if (disks === 0) return [];
    return [
      ...solution(disks - 1, from, spare, to),
      [from, to],
      ...solution(disks - 1, spare, to, from),
    ];
  }

  return { createPegs, clonePegs, move, optimalMoves, solution };
});

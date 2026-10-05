/* v2.14.0 · 奏报在前，长期经营按需展开。 */
(() => {
  "use strict";
  const panelIds = ["imperial-focus", "campaign-focus", "quarterly-agenda-panel", "causal-court-panel"];
  const positions = new Map();
  let drawer = null;
  let currentGame = null;
  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:display-mode-changed", arrange);
  document.addEventListener("xian:core-saved", () => setTimeout(refresh, 30));
  document.addEventListener("xian:quarterly-agenda-updated", () => setTimeout(refresh, 30));

  function init() {
    const main = document.querySelector("#game-shell .game-main");
    if (!main) return;
    drawer = document.createElement("details");
    drawer.id = "long-term-objectives";
    drawer.className = "long-term-objectives";
    drawer.innerHTML = '<summary>长期朝局 · 方略、御题与战役（可选）</summary><p class="objective-intro">先完成本月奏报。熟悉三步朝会后，再选择一项长期目标；折叠不会暂停结算。</p><div class="objective-content"></div>';
    main.appendChild(drawer);
    document.getElementById("start-short-challenge-btn")?.addEventListener("click", () => window.XianShortChallenges?.start?.("xudu_mutiny"));
    arrange();
    refresh();
  }

  function arrange() {
    if (!drawer) return;
    const simple = window.XianMonthlyFlow?.getMode?.() !== "full";
    panelIds.forEach(id => {
      const panel = document.getElementById(id);
      if (!panel) return;
      if (!positions.has(id)) {
        const marker = document.createComment(`${id}-position`);
        panel.before(marker);
        positions.set(id, marker);
      }
      if (simple) drawer.querySelector(".objective-content").appendChild(panel);
      else positions.get(id).after(panel);
    });
    drawer.hidden = !simple;
  }

  function refresh() {
    if (!drawer) return;
    const core = window.XianEmperorGame?.getState?.();
    if (core?.createdAt !== currentGame) { currentGame = core?.createdAt; drawer.open = false; }
    arrange();
    const agenda = window.XianQuarterlyAgenda?.getState?.();
    const definition = window.XianQuarterlyAgenda?.agendas?.find(item => item.id === agenda?.active?.id);
    drawer.querySelector("summary").textContent = definition
      ? `长期朝局 · ${definition.title} ${Math.round(window.XianQuarterlyAgenda.calculateProgress(core))}% · 展开经营`
      : "长期朝局 · 方略、御题与战役（可选）";
  }
})();

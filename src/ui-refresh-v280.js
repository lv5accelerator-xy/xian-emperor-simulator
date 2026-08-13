/* 天子蒙尘：献帝模拟器 v2.8.0 · 御前焕新 */
(function () {
  "use strict";

  const SECONDARY_PANELS = [
    [".faction-panel", "#faction-list"],
    [".people-panel", "#character-list"],
    [".reports-panel", "#report-list"],
    [".chronicle-panel", "#chronicle-preview"],
  ];

  function installSecondaryPanelToggles() {
    SECONDARY_PANELS.forEach(([panelSelector, bodySelector]) => {
      const panel = document.querySelector(panelSelector);
      const body = panel?.querySelector(bodySelector);
      const heading = panel?.querySelector(".panel-heading");
      if (!panel || !body || !heading || panel.dataset.collapseReady) return;

      panel.dataset.collapseReady = "true";
      panel.classList.add("secondary-panel", "is-collapsed");
      body.classList.add("secondary-panel-body");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "panel-collapse-toggle";
      button.textContent = "展开";
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("is-collapsed");
        button.textContent = collapsed ? "展开" : "收起";
        button.setAttribute("aria-expanded", String(!collapsed));
      });
      heading.appendChild(button);
    });
  }

  function clickUtilityButton(id, fallbackSelector) {
    const target = document.getElementById(id);
    if (target) {
      target.click();
      return;
    }
    document.querySelector(fallbackSelector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function installMobileNavigation() {
    const shell = document.getElementById("game-shell");
    if (!shell || document.getElementById("mobile-imperial-nav")) return;

    const nav = document.createElement("nav");
    nav.id = "mobile-imperial-nav";
    nav.className = "mobile-imperial-nav";
    nav.setAttribute("aria-label", "手机版御前捷径");
    nav.innerHTML = `
      <button type="button" data-mobile-destination="month"><i>奏</i><span>本月</span></button>
      <button type="button" data-mobile-destination="actions"><i>令</i><span>行动</span></button>
      <button type="button" data-mobile-destination="map"><i>图</i><span>舆图</span></button>
      <button type="button" data-mobile-destination="archive"><i>册</i><span>档案</span></button>`;

    nav.addEventListener("click", event => {
      const button = event.target.closest?.("[data-mobile-destination]");
      if (!button) return;
      nav.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
      const destination = button.dataset.mobileDestination;
      if (destination === "month") document.querySelector(".event-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (destination === "actions") document.querySelector(".action-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (destination === "map") clickUtilityButton("world-map-btn", ".event-panel");
      if (destination === "archive") clickUtilityButton("imperial-archive-btn", ".chronicle-panel");
    });

    shell.appendChild(nav);
  }

  function initialize() {
    installSecondaryPanelToggles();
    installMobileNavigation();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

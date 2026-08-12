/* 天子蒙尘：献帝模拟器 v1.5.1 · 御前界面整理 */
(() => {
  "use strict";

  const PRIMARY_IDS = [
    "save-btn",
    "month-report-btn",
    "imperial-archive-btn",
    "world-map-btn",
    "army-system-btn",
    "court-politics-btn",
    "imperial-command-btn",
  ];

  const ICONS = {
    "save-btn": "存", "month-report-btn": "奏", "imperial-archive-btn": "册",
    "world-map-btn": "图", "army-system-btn": "兵", "court-politics-btn": "议",
    "load-btn": "读", "export-btn": "出", "import-btn": "入", "help-btn": "问",
    "world-people-btn": "人", "world-timeline-btn": "年", "world-sources-btn": "史",
    "strategy-network-btn": "路", "imperial-guide-btn": "引", "imperial-view-btn": "景",
    "reset-btn": "重",
  };

  let rearranging = false;

  document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(upgradeUtilityNav);
    setTimeout(upgradeUtilityNav, 160);
  });

  function upgradeUtilityNav() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || rearranging) return;
    rearranging = true;

    let primary = nav.querySelector(":scope > .utility-primary");
    let popover = nav.querySelector(":scope > .utility-popover");
    let secondary = popover?.querySelector(".utility-secondary");

    if (!primary) {
      primary = document.createElement("div");
      primary.className = "utility-primary";
      nav.prepend(primary);
    }

    if (!popover) {
      popover = document.createElement("div");
      popover.className = "utility-popover";
      popover.hidden = true;
      popover.innerHTML = '<div class="utility-popover-head"><div><span>御前工具</span><strong>更多功能</strong></div><small>存档、史料与显示设置</small></div><div class="utility-secondary"></div>';
      nav.appendChild(popover);
      secondary = popover.querySelector(".utility-secondary");
    }

    PRIMARY_IDS.forEach(id => {
      const button = document.getElementById(id);
      if (button && button.parentElement !== primary) primary.appendChild(button);
    });

    [...nav.children].forEach(child => {
      if (child === primary || child === popover || child.id === "utility-more-toggle") return;
      secondary.appendChild(child);
    });

    [...nav.querySelectorAll("button[id]")].forEach(button => {
      if (button.id === "world-map-btn") button.textContent = "舆图";
      if (ICONS[button.id]) button.dataset.uiIcon = ICONS[button.id];
    });

    let toggle = document.getElementById("utility-more-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = "utility-more-toggle";
      toggle.type = "button";
      toggle.dataset.uiIcon = "···";
      toggle.textContent = "更多";
      toggle.setAttribute("aria-haspopup", "true");
      toggle.setAttribute("aria-expanded", "false");
      primary.appendChild(toggle);
      toggle.addEventListener("click", event => {
        event.stopPropagation();
        setPopover(nav, popover.hidden);
      });
      popover.addEventListener("click", event => {
        event.stopPropagation();
        if (event.target.closest("button")) requestAnimationFrame(() => setPopover(nav, false));
      });
      document.addEventListener("click", () => setPopover(nav, false));
      document.addEventListener("keydown", event => {
        if (event.key === "Escape") setPopover(nav, false);
      });
    } else if (toggle.parentElement !== primary) {
      primary.appendChild(toggle);
    }

    nav.classList.add("utility-nav-upgraded");
    nav.closest(".topbar")?.classList.add("topbar-v110");
    rearranging = false;
  }

  function setPopover(nav, open) {
    const popover = nav.querySelector(":scope > .utility-popover");
    const toggle = document.getElementById("utility-more-toggle");
    if (!popover || !toggle) return;
    popover.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("menu-open", open);
  }
})();

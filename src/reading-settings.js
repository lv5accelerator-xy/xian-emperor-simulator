/* 天子蒙尘 v2.23.0 · 阅读字号独立于字风、存档与随机进度。 */
(() => {
  "use strict";
  const KEY = "xian_reading_size_v1";
  const SIZES = ["standard", "large", "largest"];
  const LABELS = { standard: "标准", large: "大字", largest: "特大" };
  const normalize = value => SIZES.includes(value) ? value : "standard";
  let size = "standard";
  try { size = normalize(localStorage.getItem(KEY)); } catch (_) { /* The page remains readable without storage. */ }
  document.documentElement.dataset.readingSize = size;

  function render() {
    document.querySelectorAll("button[data-reading-size]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.readingSize === size));
    });
    const next = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
    document.querySelectorAll("[data-reading-toggle]").forEach(button => {
      button.textContent = `字号：${LABELS[size]}`;
      button.setAttribute("aria-label", `字号：${LABELS[size]}，切换为${LABELS[next]}`);
    });
  }

  function select(value, persist = true) {
    size = normalize(value);
    document.documentElement.dataset.readingSize = size;
    if (persist) {
      try { localStorage.setItem(KEY, size); } catch (_) { /* The current page can still change size. */ }
    }
    render();
  }

  function initialize() {
    document.querySelectorAll("button[data-reading-size]").forEach(button => {
      button.addEventListener("click", () => select(button.dataset.readingSize));
    });
    document.querySelectorAll("[data-reading-toggle]").forEach(button => {
      button.addEventListener("click", () => select(SIZES[(SIZES.indexOf(size) + 1) % SIZES.length]));
    });
    render();
  }

  window.addEventListener("storage", event => {
    if (event.key === KEY || event.key === null) select(event.newValue, false);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

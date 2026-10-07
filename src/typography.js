/* 天子蒙尘 v2.22.0 · 字体偏好独立于游戏存档。此脚本在 head 中恢复字风。 */
(() => {
  "use strict";

  const STORAGE_KEY = "xian_font_mode_v1";
  const root = document.documentElement;
  const normalize = value => value === "clear" ? "clear" : "classic";
  let mode = "classic";
  try { mode = normalize(localStorage.getItem(STORAGE_KEY)); } catch (_) { /* Private browsing may disable storage. */ }
  root.dataset.fontMode = mode;

  function renderControls() {
    document.querySelectorAll("[data-font-mode]").forEach(button => {
      if (button.tagName !== "BUTTON") return;
      button.setAttribute("aria-pressed", String(button.dataset.fontMode === mode));
    });
    document.querySelectorAll("[data-font-toggle]").forEach(button => {
      button.textContent = mode === "classic" ? "字体：古风" : "字体：清晰";
      button.setAttribute("aria-pressed", String(mode === "classic"));
      button.setAttribute("aria-label", mode === "classic"
        ? "字体：古风，切换为清晰阅读" : "字体：清晰，切换为古风楷书");
    });
    document.querySelectorAll("[data-font-description]").forEach(description => {
      description.textContent = mode === "classic"
        ? "楷书如手书，奏报更有古意。" : "黑体更醒目，适合清晰阅读。";
    });
  }

  function selectMode(value, persist = true) {
    mode = normalize(value);
    root.dataset.fontMode = mode;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (_) { /* The current page can still switch fonts. */ }
    }
    renderControls();
  }

  function initialize() {
    document.querySelectorAll("button[data-font-mode]").forEach(button => {
      button.addEventListener("click", () => selectMode(button.dataset.fontMode));
    });
    document.querySelectorAll("[data-font-toggle]").forEach(button => {
      button.addEventListener("click", () => selectMode(mode === "classic" ? "clear" : "classic"));
    });
    renderControls();
  }

  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY || event.key === null) selectMode(event.newValue, false);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

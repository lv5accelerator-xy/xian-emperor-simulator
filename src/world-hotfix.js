/* 天子蒙尘 v0.2.3.2：阻止人物列表观察器递归触发 */
(() => {
  "use strict";

  const NativeMutationObserver = window.MutationObserver;
  if (typeof NativeMutationObserver !== "function" || window.__xianWorldObserverHotfixInstalled) return;
  window.__xianWorldObserverHotfixInstalled = true;

  window.MutationObserver = class XianSafeMutationObserver extends NativeMutationObserver {
    observe(target, options = {}) {
      if (target?.id === "character-list" && options.childList && options.subtree) {
        return super.observe(target, { ...options, subtree: false });
      }
      return super.observe(target, options);
    }
  };
})();

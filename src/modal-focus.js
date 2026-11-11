/* Generic-dialog focus only: no gameplay, storage, clock or random dependency. */
(() => {
  "use strict";
  const SELECTOR = "button, [href], input, select, textarea, summary, [tabindex], [contenteditable]";
  let active = null, pendingReturn = null;

  function available(node) {
    return Boolean(node && typeof node.focus === "function" && node.isConnected && !node.disabled &&
      !node.matches(":disabled") && !node.closest("[hidden], [inert]") && node.getClientRects().length &&
      !["hidden", "collapse"].includes(getComputedStyle(node).visibility));
  }
  function controls(dialog) {
    const nodes = [...dialog.querySelectorAll(SELECTOR)].filter(node => available(node) &&
      (node.tabIndex >= 0 || (node.isContentEditable && !node.hasAttribute("tabindex"))));
    return nodes.filter(node => {
      if (node.type !== "radio" || !node.name) return true;
      const group = nodes.filter(other => other.type === "radio" && other.name === node.name && other.form === node.form);
      return node === (group.find(other => other.checked) || group[0]);
    }).sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
  }
  function focus(node, container = false) {
    if (!available(node)) return false;
    const temporary = container && !node.hasAttribute("tabindex") && node.tabIndex < 0;
    if (temporary) {
      node.setAttribute("tabindex", "-1");
      const cleanup = () => { if (node.getAttribute("tabindex") === "-1") node.removeAttribute("tabindex"); node.removeEventListener("blur", cleanup); };
      node.addEventListener("blur", cleanup, { once: true });
    }
    // Native focus scrolling keeps long-dialog fields and restored invokers visible.
    node.focus();
    return document.activeElement === node;
  }
  function open(session) { return session.backdrop.isConnected && !session.backdrop.classList.contains("hidden"); }
  function focusInside(session) {
    const initial = session.dialog.contains(session.initial) && session.initial;
    if (!focus(initial) && !focus(controls(session.dialog)[0])) focus(session.dialog, true);
  }
  function keydown(event) {
    if (!active || !open(active) || event.key !== "Tab") return;
    const items = controls(active.dialog), current = document.activeElement;
    if (!items.length) { event.preventDefault(); focus(active.dialog, true); return; }
    if (!items.includes(current) || (event.shiftKey ? current === items[0] : current === items[items.length - 1])) {
      event.preventDefault(); focus(event.shiftKey ? items[items.length - 1] : items[0]);
    }
  }
  function focusin(event) {
    if (active && open(active) && !active.dialog.contains(event.target)) focusInside(active);
  }
  function remember(node) {
    const groups = [];
    for (let parent = node?.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (parent.id && !["game-shell", "start-screen", "end-screen"].includes(parent.id)) groups.push(parent.id);
    }
    return { node, id: node?.id, action: node?.dataset?.actionId, groups,
      menu: node?.closest?.(".utility-popover") ? "utility-more-toggle" : null };
  }
  function restore(saved) {
    // Tool-menu entries are hidden after activation; their visible menu button is the return point.
    if (saved.menu && focus(document.getElementById(saved.menu))) return;
    if (saved.node !== document.body && focus(saved.node)) return;
    if (saved.id && focus(document.getElementById(saved.id))) return;
    if (saved.action) {
      const replacement = [...document.querySelectorAll("[data-action-id]")].find(node => node.dataset.actionId === saved.action && available(node));
      if (focus(replacement)) return;
    }
    for (const id of saved.groups) if (focus(document.getElementById(id), true)) return;
    for (const selector of ["#ending-restart", "#new-game-btn", "#end-turn-btn", "#event-choices button", "#mobile-save-tools", "#utility-more-toggle"]) {
      for (const node of document.querySelectorAll(selector)) if (focus(node)) return;
    }
  }
  function cancelReturn() {
    if (pendingReturn) clearTimeout(pendingReturn.timer);
    pendingReturn = null;
  }
  function activate(backdrop, initial, opener = document.activeElement) {
    const dialog = backdrop?.querySelector?.(".modal");
    if (!dialog || typeof dialog.getClientRects !== "function") return false;
    const saved = active?.saved || (pendingReturn && (!available(opener) || dialog.contains(opener)) ? pendingReturn.saved : remember(opener));
    cancelReturn();
    if (active?.backdrop === backdrop) {
      clearTimeout(active.timer); active.initial = initial;
    } else {
      if (active) deactivate(false);
      const inert = [];
      for (const node of document.body.children) {
        if (node === backdrop || ["SCRIPT", "STYLE", "LINK"].includes(node.tagName) || node.hasAttribute("aria-live") ||
          ["alert", "status"].includes(node.getAttribute("role")) || node.hasAttribute("inert")) continue;
        node.setAttribute("inert", ""); inert.push(node);
      }
      active = { backdrop, dialog, initial, saved, inert };
      document.addEventListener("keydown", keydown, true);
      document.addEventListener("focusin", focusin, true);
    }
    const session = active;
    session.timer = setTimeout(() => { if (active === session && open(session)) focusInside(session); }, 0);
    return true;
  }
  function deactivate(returnFocus = true) {
    if (!active) return false;
    const session = active; active = null;
    clearTimeout(session.timer);
    document.removeEventListener("keydown", keydown, true);
    document.removeEventListener("focusin", focusin, true);
    session.inert.forEach(node => node.removeAttribute("inert"));
    cancelReturn();
    if (returnFocus) {
      const planned = { saved: session.saved };
      pendingReturn = planned;
      // Let confirmation handlers finish redrawing/changing screens first.
      planned.timer = setTimeout(() => {
        if (active || pendingReturn !== planned) return;
        pendingReturn = null;
        if ([...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(available)) return;
        restore(planned.saved);
      }, 0);
    }
    return true;
  }
  window.XianModalFocus = Object.freeze({ activate, deactivate });
})();

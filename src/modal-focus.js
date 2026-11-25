/* Dialog focus only: no gameplay, storage, clock or random dependency.
 * 通用弹窗由 game.js 显式调用 activate/deactivate；v2.36 起，舆图、军团、御前档案等自建窗口
 * （role="dialog" aria-modal="true"）由下方的 MutationObserver 自动接管：打开时焦点移入、Tab 不出窗、
 * 背景不可聚焦，关闭时焦点回到打开它的按钮。窗口可以层叠（如舆图上再开通用弹窗），按栈管理。 */
(() => {
  "use strict";
  const SELECTOR = "button, [href], input, select, textarea, summary, [tabindex], [contenteditable]";
  // 自带焦点管理的弹窗不由观察器接管：通用弹窗（game.js 显式调用）与月报。
  const SELF_MANAGED = "#modal-backdrop, .monthly-addon-dialog";
  const stack = [];
  let pendingReturn = null, listening = false;
  const top = () => stack[stack.length - 1] || null;

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
  function open(session) {
    return session.backdrop.isConnected && !session.backdrop.classList.contains("hidden") && session.dialog.isConnected;
  }
  function focusInside(session) {
    const initial = session.dialog.contains(session.initial) && session.initial;
    if (!focus(initial) && !focus(controls(session.dialog)[0])) focus(session.dialog, true);
  }
  function keydown(event) {
    const active = top();
    if (!active || !open(active) || event.key !== "Tab") return;
    const items = controls(active.dialog), current = document.activeElement;
    if (!items.length) { event.preventDefault(); focus(active.dialog, true); return; }
    // 焦点在窗口外才拉回；窗口内用程序聚焦的标题（tabindex=-1）等不在 Tab 序列里，交给浏览器按文档顺序前进。
    if (!active.dialog.contains(current) || (items.includes(current) && (event.shiftKey ? current === items[0] : current === items[items.length - 1]))) {
      event.preventDefault(); focus(event.shiftKey ? items[items.length - 1] : items[0]);
    }
  }
  function focusin(event) {
    const active = top();
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
    const below = top();
    if (below && open(below)) { focusInside(below); return; }
    for (const selector of ["#ending-restart", "#new-game-btn", "#end-turn-btn", "#event-choices button", "#mobile-save-tools", "#utility-more-toggle"]) {
      for (const node of document.querySelectorAll(selector)) if (focus(node)) return;
    }
  }
  function cancelReturn() {
    if (pendingReturn) clearTimeout(pendingReturn.timer);
    pendingReturn = null;
  }
  // 只有最上层窗口的背景设为 inert：叠在上面的窗口自己不能被下层窗口设成 inert。每次开关窗口后按栈顶重算。
  const applied = new Set();
  function applyInert() {
    const wanted = new Set(top()?.inert || []);
    for (const node of applied) if (!wanted.has(node)) { node.removeAttribute("inert"); applied.delete(node); }
    for (const node of wanted) if (!applied.has(node)) { node.setAttribute("inert", ""); applied.add(node); }
  }
  function listen(on) {
    if (on === listening) return;
    listening = on;
    const method = on ? "addEventListener" : "removeEventListener";
    document[method]("keydown", keydown, true);
    document[method]("focusin", focusin, true);
  }
  function rootOf(node) {
    let root = node;
    while (root?.parentElement && root.parentElement !== document.body) root = root.parentElement;
    return root;
  }

  function activate(backdrop, initial, opener = document.activeElement, dialog = backdrop?.querySelector?.(".modal")) {
    if (!dialog || typeof dialog.getClientRects !== "function") return false;
    const existing = stack.find(session => session.backdrop === backdrop);
    if (existing) {
      clearTimeout(existing.timer); existing.initial = initial; existing.dialog = dialog;
    } else {
      const reuse = pendingReturn && (!available(opener) || dialog.contains(opener)) ? pendingReturn.saved : null;
      const saved = reuse || remember(available(opener) ? opener : document.activeElement);
      cancelReturn();
      const inert = [];
      const root = rootOf(backdrop);
      for (const node of document.body.children) {
        if (node === root || ["SCRIPT", "STYLE", "LINK"].includes(node.tagName) || node.hasAttribute("aria-live") ||
          ["alert", "status"].includes(node.getAttribute("role")) || (node.hasAttribute("inert") && !applied.has(node))) continue;
        inert.push(node);
      }
      stack.push({ backdrop, dialog, initial, saved, inert });
      applyInert();
      listen(true);
    }
    const session = stack.find(item => item.backdrop === backdrop);
    session.timer = setTimeout(() => { if (top() === session && open(session) && !session.dialog.contains(document.activeElement)) focusInside(session); }, 0);
    return true;
  }
  function deactivate(returnFocus = true, backdrop = null) {
    const index = backdrop ? stack.findIndex(session => session.backdrop === backdrop) : stack.length - 1;
    if (index < 0) return false;
    const [session] = stack.splice(index, 1);
    const wasTop = index === stack.length;
    clearTimeout(session.timer);
    applyInert();
    if (!stack.length) listen(false);
    cancelReturn();
    if (returnFocus && wasTop) {
      const planned = { saved: session.saved };
      pendingReturn = planned;
      // Let confirmation handlers finish redrawing/changing screens first.
      planned.timer = setTimeout(() => {
        if (pendingReturn !== planned) return;
        pendingReturn = null;
        // 关闭窗口的代码已主动把焦点放到页面上别处（如点选示范写法后聚焦圣旨输入框），就不再改回打开窗口前的位置。
        const current = document.activeElement;
        if (current && current !== document.body && !session.dialog.contains(current) && available(current) && !top()) return;
        const above = top();
        if (above && open(above) && above.dialog.contains(document.activeElement)) return;
        // 另有窗口（含月报等自管焦点的）已经打开并接手焦点时，不把焦点拉回背景。
        if (!stack.length && [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(available)) return;
        restore(planned.saved);
      }, 0);
    }
    return true;
  }

  // 自动接管自建窗口：每批 DOM 变化后核对哪些窗口打开、关闭或被整块重绘。
  // 重绘（窗口元素换成新的）时沿用原会话，保留“关闭后回到哪个按钮”；原焦点随旧元素消失时移入新窗口。
  let scanQueued = false;
  function scan() {
    scanQueued = false;
    // 判断窗口是否打开时不看 inert：上层窗口会把下层窗口设为 inert，下层仍是打开的。
    const shown = node => node.isConnected && !node.closest("[hidden]") && node.getClientRects().length > 0 && !["hidden", "collapse"].includes(getComputedStyle(node).visibility);
    const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
      .filter(node => !node.closest(SELF_MANAGED) && shown(node));
    const openRoots = new Map();
    for (const node of dialogs) { const root = rootOf(node); if (!openRoots.has(root)) openRoots.set(root, node); }
    for (const session of [...stack]) {
      if (!session.auto) continue;
      const dialog = openRoots.get(session.backdrop);
      if (!dialog) { deactivate(true, session.backdrop); continue; }
      if (dialog !== session.dialog) {
        session.dialog = dialog;
        if (top() === session && !dialog.contains(document.activeElement)) focusInside(session);
      }
      openRoots.delete(session.backdrop);
    }
    for (const [root, dialog] of openRoots) {
      if (stack.some(session => session.backdrop === root)) continue;
      if (activate(root, null, document.activeElement, dialog)) stack[stack.length - 1].auto = true;
    }
  }
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(scan);
  }
  if (typeof MutationObserver === "function" && typeof document !== "undefined" && document.body) {
    new MutationObserver(queueScan).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
  } else if (typeof document !== "undefined" && typeof MutationObserver === "function") {
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(queueScan).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "style"] }), { once: true });
  }

  window.XianModalFocus = Object.freeze({ activate, deactivate });
})();

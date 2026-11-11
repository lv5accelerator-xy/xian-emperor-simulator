"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { harness } = require("./helpers/game-harness");
const root = path.resolve(__dirname, ".."), message = "存储空间不足或被浏览器禁用,请先导出存档";
const source = fs.readFileSync(path.join(root, "src/storage-feedback.js"), "utf8");
function boot(disabled = false, loading = false) {
  const children = [], listeners = [], writes = [];
  const document = { readyState: loading ? "loading" : "complete", body: loading ? null : { appendChild: node => children.push(node) },
    createElement: () => ({ style: {}, setAttribute(name, value) { this[name] = value; } }),
    addEventListener: (name, callback) => listeners.push(callback) };
  const context = { window: {}, document, localStorage: { length: 0, setItem: (...args) => writes.push(args) } };
  if (disabled) Object.defineProperty(context, "localStorage", { get() { const e = new Error("disabled"); e.name = "SecurityError"; throw e; } });
  vm.runInNewContext(source, context);
  return { context, document, children, listeners, writes };
}
const normal = boot(); assert.equal(normal.children.length, 0); assert.equal(normal.writes.length, 0);
normal.context.window.XianStorageFeedback.report(new Error("quota"));
assert.equal(normal.children.length, 1); assert.equal(normal.children[0].textContent, message); assert.equal(normal.children[0].role, "alert");
normal.context.window.XianStorageFeedback.report(new Error("again")); assert.equal(normal.children.length, 1, "deduplicate the visible alert");
const privateMode = boot(true, true); assert.equal(privateMode.children.length, 0);
privateMode.document.body = { appendChild: node => privateMode.children.push(node) }; privateMode.listeners.forEach(fn => fn());
assert.equal(privateMode.children[0].textContent, message);
// Exercise actual core write, not an imitation of the adapter.
const h = harness(); h.api.startNewGame();
const set = h.localStorage.setItem, calls = [], quota = new Error("simulated quota"); quota.name = "QuotaExceededError";
h.localStorage.setItem = function(key, value) { calls.push(key); throw quota; };
assert.throws(() => h.api.commit("quota-test"), error => error === quota, "rethrow original failure for existing rollback/error handling");
assert.equal(calls.length, 1); assert.equal(h.window.XianStorageFeedback.getProblem(), message);
h.localStorage.setItem = function(...args) { calls.push(args[0]); return set.apply(this, args); };
assert.equal(h.api.commit("recovered"), true);
// Every production write/remove remains inside the local failure-reporting adapter.
for (const file of fs.readdirSync(path.join(root, "src")).filter(file => file.endsWith(".js"))) {
  const text = fs.readFileSync(path.join(root, "src", file), "utf8");
  assert.doesNotMatch(text, /localStorage\.(?:setItem|removeItem|clear)\s*\(/, `${file}: direct write bypasses error feedback`);
  if (/storageWrite\("/.test(text)) assert.match(text, /function storageWrite\(method, \.\.\.args\)[\s\S]*?try[\s\S]*?catch \(error\)[\s\S]*?XianStorageFeedback\?\.report\?\.\(error\)[\s\S]*?throw error/);
}
console.log("Storage quota/security failures are visible; normal writes, original errors and storage keys preserved.");

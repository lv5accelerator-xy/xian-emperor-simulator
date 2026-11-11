"use strict";
// Snapshot the real parser and non-mutating preview; never execute the edict.
function observe(h, text) {
  const parsed = h.window.XianEdictRules.analyze(text), preview = h.api.previewEdict(text);
  return JSON.parse(JSON.stringify({ categories: parsed.categories, targets: parsed.targets, targetDisposition: parsed.targetDisposition,
    effectiveText: parsed.effectiveText, hasEffectiveOrder: Boolean(parsed.effectiveText), ignoredClauses: parsed.ignoredClauses,
    warnings: parsed.warnings, blocked: parsed.blocked, cityOrder: h.window.XianStrategyNetwork.detectCityTargets(text),
    preview: { ok: preview.ok, reason: preview.reason, actionCost: preview.actionCost, treasuryCost: preview.treasuryCost } }));
}
function differences(observed, desired) {
  return Object.keys(desired).filter(key => JSON.stringify(observed[key]) !== JSON.stringify(desired[key]));
}
module.exports = { observe, differences };

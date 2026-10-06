/* v2.16.0 · 尚书台辅助拟旨：草稿、即时复核与续接。 */
(() => {
  "use strict";
  const POLICIES = [
    { id: "relief", name: "开仓赈济", text: target => `命${target}开仓赈济，安置流民。` },
    { id: "tax", name: "减轻赋役", text: target => `命${target}减轻赋役，以缓民困。` },
    { id: "investigation", name: "整顿吏治", text: target => `命${target}整顿吏治，彻查侵吞钱粮。` },
    { id: "military", name: "整顿宿卫", text: target => `命${target}整顿宿卫，加强武备。` },
    { id: "ritual", name: "修明礼制", text: target => `命${target}整饬朝仪，修明礼制。` },
    { id: "secret", name: "密令联络", people: true, text: target => `密令${target}联络忠汉之士，谨慎行事。` },
    { id: "appointment", name: "加授官职", people: true, text: target => `任命${target}为朝廷使者，奉诏办事。` },
    { id: "diplomacy", name: "遣使奉表", lords: true, text: target => `遣使${target}奉表归廷，三月内入贡。` },
    { id: "appease", name: "安抚修好", people: true, text: target => `安抚${target}，以礼相待。` },
  ];
  const GOALS = [
    { id: "steady", name: "稳住本月", text: "此令务求稳妥施行。" },
    { id: "legitimacy", name: "维护汉廷名分", text: "以维护汉廷名分。" },
    { id: "people", name: "安定地方人心", text: "以安定地方人心。" },
  ];
  let panel, input;
  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:core-saved", refresh);

  function targets(policyId) {
    const policy = POLICIES.find(item => item.id === policyId) || POLICIES[0];
    const characters = (window.GAME_DATA?.characters || []).filter(item => item.id !== "liu_xie");
    if (policy.lords) return characters.filter(item => item.faction === "regional_lords").map(item => ({ id: item.id, name: item.name }));
    if (policy.people) return characters.map(item => ({ id: item.id, name: item.name }));
    return [{ id: "court", name: "汉廷" }, ...(window.XIAN_STRATEGY_DATA?.cities || []).map(item => ({ id: `city:${item.id}`, name: item.name }))];
  }

  function buildDraft(policyId, targetId, goalId) {
    const policy = POLICIES.find(item => item.id === policyId);
    const target = targets(policyId).find(item => item.id === targetId);
    const goal = GOALS.find(item => item.id === goalId);
    return policy && target && goal ? policy.text(target.name) + goal.text : "";
  }

  function init() {
    panel = document.querySelector(".decree-panel"); input = document.getElementById("decree-input");
    if (!panel || !input) return;
    const policy = document.getElementById("decree-policy");
    policy.innerHTML = POLICIES.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
    document.getElementById("decree-goal").innerHTML = GOALS.map(item => `<option value="${item.id}">${item.name}</option>`).join("");
    policy.addEventListener("change", updateTargets);
    updateTargets();
    document.getElementById("decree-helper-open")?.addEventListener("click", open);
    document.getElementById("decree-helper-close")?.addEventListener("click", () => {
      window.XianEmperorGame?.setDecreeDraft?.(input.value, false); refresh();
    });
    document.getElementById("decree-generate")?.addEventListener("click", generate);
    input.addEventListener("input", () => {
      window.XianEmperorGame?.setDecreeDraft?.(input.value, true); refresh();
    });
    refresh();
  }

  function updateTargets() {
    const select = document.getElementById("decree-target");
    const previous = select.value;
    const options = targets(document.getElementById("decree-policy").value);
    select.innerHTML = options.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    if (options.some(item => item.id === previous)) select.value = previous;
  }

  function open() {
    if (!window.XianEmperorGame?.getState?.()) return;
    window.XianEmperorGame.setDecreeDraft(input.value, true); refresh();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function generate() {
    const draft = buildDraft(document.getElementById("decree-policy").value, document.getElementById("decree-target").value, document.getElementById("decree-goal").value);
    if (!draft) return;
    // Replacing handwritten text is always explicit; selectors never overwrite it.
    if (input.value.trim() && input.value.trim() !== draft && !window.confirm("替换当前草稿？此操作只改诏文，不会用玺。")) return;
    input.value = draft;
    window.XianEmperorGame?.setDecreeDraft?.(draft, true); refresh();
  }

  function buildPreviewHtml(text, core) {
    if (!String(text || "").trim()) return '<p class="decree-preview-empty">选择对象、政令与目标生成草稿，或直接输入诏文。生成草稿不消耗行动。</p>';
    const preview = window.XianEmperorGame?.previewEdict?.(text, core);
    if (!preview) return "";
    const interpretation = preview.interpretation;
    const people = (interpretation.targets || []).map(id => window.GAME_DATA.characters.find(item => item.id === id)?.name).filter(Boolean);
    const cities = window.XianStrategyNetwork?.detectCityTargets?.(interpretation.effectiveText || "") || [];
    const cityNames = cities.map(id => window.XIAN_STRATEGY_DATA?.cities.find(item => item.id === id)?.name).filter(Boolean);
    const warnings = [...(interpretation.warnings || [])];
    if (interpretation.categories.includes("generic")) warnings.push("尚未识别具体政令，将按中央一般政令办理。请核对原文。");
    return `<div class="decree-preview-head"><strong>${preview.ok ? "可以送交复核" : "暂不能用玺"}</strong><span>御前行动 ${preview.actionCost} 次${preview.treasuryCost != null ? ` · 国库支出 ${preview.treasuryCost}` : " · 成本待核"}</span></div>
      <p>识别政令：${escapeHtml(interpretation.labels.join("、"))} · 对象：${escapeHtml([...people, ...cityNames].join("、") || "汉廷中枢")}</p>
      ${preview.reason ? `<p class="decree-preview-reason">${escapeHtml(preview.reason)}</p>` : ""}
      ${warnings.map(item => `<p class="decree-preview-reason">${escapeHtml(item)}</p>`).join("")}`;
  }

  function refresh() {
    if (!panel || !input) return;
    const core = window.XianEmperorGame?.getState?.();
    panel.classList.toggle("is-drafting", Boolean(core && !core.ended && core.decreeWorkspaceOpen));
    const status = document.getElementById("decree-draft-preview");
    const html = buildPreviewHtml(input.value, core);
    if (status && status.innerHTML !== html) status.innerHTML = html;
    const openButton = document.getElementById("decree-helper-open");
    if (openButton) openButton.disabled = !core || core.ended;
  }

  function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  window.XianDecreeHelper = Object.freeze({ buildDraft, buildPreviewHtml, targets, refresh, open });
})();

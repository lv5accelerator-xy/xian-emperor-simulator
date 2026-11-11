(() => {
  "use strict";
  const MESSAGE = "存储空间不足或被浏览器禁用,请先导出存档";
  let problem = "", alertNode = null, waiting = false;
  function display() {
    if (!document.body) {
      if (!waiting) { waiting = true; document.addEventListener("DOMContentLoaded", display, { once: true }); }
      return;
    }
    if (alertNode) return;
    alertNode = document.createElement("div");
    alertNode.id = "storage-failure-alert";
    alertNode.setAttribute("role", "alert");
    alertNode.setAttribute("aria-live", "assertive");
    alertNode.textContent = MESSAGE;
    Object.assign(alertNode.style, { position: "fixed", left: "12px", right: "12px", bottom: "12px", zIndex: "2147483647",
      padding: "12px 16px", background: "#fff4d8", color: "#3a160c", border: "2px solid #7e301b", borderRadius: "6px", fontSize: "16px" });
    document.body.appendChild(alertNode);
  }
  function report() {
    problem = MESSAGE;
    // Feedback must never replace the original storage exception or rollback path.
    try { display(); } catch (_) { alertNode = null; }
  }
  window.XianStorageFeedback = Object.freeze({ report, getProblem: () => problem });
  // Read-only probe: no temporary key or extra storage mutation on successful boots.
  try { void localStorage.length; } catch (_) { report(); }
})();

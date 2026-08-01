/* 《天子蒙尘》人物立绘接入层 v0.2.1 */
(() => {
  "use strict";
  const portraits = window.XIAN_PORTRAITS || {};
  const positions = {
    liu_xie: "50% 28%", empress_fu: "50% 24%", dong_cheng: "50% 24%",
    yang_biao: "50% 25%", xun_yu: "50% 23%", cao_cao: "50% 23%",
    yuan_shao: "50% 23%", yuan_shu: "50% 25%", liu_biao: "50% 22%", sun_ce: "50% 24%"
  };
  let activeCharacterId = null;
  let queued = false;

  document.addEventListener("DOMContentLoaded", () => {
    installGlobalPortraits();
    applyPortraits();
    observeChanges();
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-character-id], [data-world-character]");
    if (target) activeCharacterId = target.dataset.characterId || target.dataset.worldCharacter || null;
    queueApply();
  }, true);

  function portraitImage(id, className = "") {
    const portrait = portraits[id];
    if (!portrait) return "";
    const pos = positions[id] || "50% 25%";
    return `<img class="xian-portrait ${className}" src="${portrait.src}" alt="${portrait.name}立绘" style="object-position:${pos}" draggable="false">`;
  }

  function installGlobalPortraits() {
    const start = document.querySelector(".start-emblem");
    if (start && portraits.liu_xie) {
      start.classList.add("has-character-portrait");
      start.innerHTML = portraitImage("liu_xie", "start-character-portrait");
      start.setAttribute("aria-label", "汉献帝刘协");
    }
    const mini = document.querySelector(".mini-seal");
    if (mini && portraits.liu_xie) {
      mini.classList.add("has-character-portrait");
      mini.innerHTML = portraitImage("liu_xie", "mini-character-portrait");
      mini.setAttribute("aria-label", "汉献帝刘协");
    }
  }

  function observeChanges() {
    const observer = new MutationObserver(queueApply);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function queueApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyPortraits();
    });
  }

  function applyPortraits() {
    document.querySelectorAll(".character-card[data-character-id]").forEach((card) => {
      const id = card.dataset.characterId;
      const mark = card.querySelector(".portrait-mark");
      if (!mark || !portraits[id] || mark.dataset.portraitReady === "1") return;
      mark.dataset.portraitReady = "1";
      mark.classList.add("has-character-portrait");
      mark.innerHTML = portraitImage(id, "character-list-portrait");
    });

    document.querySelectorAll(".political-character-card[data-world-character]").forEach((card) => {
      const id = card.dataset.worldCharacter;
      const mark = card.querySelector(".political-character-head > span");
      if (!mark || !portraits[id] || mark.dataset.portraitReady === "1") return;
      mark.dataset.portraitReady = "1";
      mark.classList.add("has-character-portrait");
      mark.innerHTML = portraitImage(id, "political-card-portrait");
    });

    const detail = document.querySelector("#modal-body .character-detail .detail-portrait");
    if (detail && activeCharacterId && portraits[activeCharacterId] && detail.dataset.portraitId !== activeCharacterId) {
      detail.dataset.portraitId = activeCharacterId;
      detail.classList.add("has-character-portrait");
      detail.innerHTML = portraitImage(activeCharacterId, "modal-character-portrait");
    }

    const worldDetail = document.querySelector("#xian-world-content .world-character-detail header > span");
    if (worldDetail && activeCharacterId && portraits[activeCharacterId] && worldDetail.dataset.portraitId !== activeCharacterId) {
      worldDetail.dataset.portraitId = activeCharacterId;
      worldDetail.classList.add("has-character-portrait");
      worldDetail.innerHTML = portraitImage(activeCharacterId, "world-detail-portrait");
    }
  }
})();

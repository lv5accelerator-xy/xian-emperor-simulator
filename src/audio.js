/* 天子蒙尘：献帝模拟器 v0.2.2 音效系统 */
(() => {
  "use strict";

  const STORAGE_KEY = "xian_emperor_audio_v022";
  const sources = window.XIAN_AUDIO_DATA || {};
  const defaults = { enabled: true, volume: 0.55 };
  let settings = loadSettings();
  let observer = null;
  let lastOverlaySignature = "";

  document.addEventListener("DOMContentLoaded", initAudioSystem);

  function initAudioSystem() {
    installControls();
    bindSoundTriggers();
    observeDynamicPanels();
    preloadSounds();
  }

  function loadSettings() {
    try {
      return { ...defaults, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")) };
    } catch (error) {
      return { ...defaults };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function installControls() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("audio-toggle-btn")) return;

    const wrapper = document.createElement("span");
    wrapper.className = "audio-controls";
    wrapper.innerHTML = `
      <button id="audio-toggle-btn" type="button" aria-pressed="${settings.enabled}">${settings.enabled ? "音效：开" : "音效：关"}</button>
      <label class="audio-volume-wrap" title="音效音量">
        <span>音量</span>
        <input id="audio-volume" type="range" min="0" max="1" step="0.05" value="${settings.volume}" aria-label="音效音量">
      </label>`;

    const help = document.getElementById("help-btn");
    nav.insertBefore(wrapper, help || null);

    wrapper.querySelector("#audio-toggle-btn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      settings.enabled = !settings.enabled;
      saveSettings();
      updateControls();
      if (settings.enabled) play("button", 0.8);
    });

    wrapper.querySelector("#audio-volume")?.addEventListener("input", (event) => {
      settings.volume = Number(event.target.value);
      saveSettings();
    });
    wrapper.querySelector("#audio-volume")?.addEventListener("change", () => play("button", 0.8));
  }

  function updateControls() {
    const toggle = document.getElementById("audio-toggle-btn");
    if (!toggle) return;
    toggle.textContent = settings.enabled ? "音效：开" : "音效：关";
    toggle.setAttribute("aria-pressed", String(settings.enabled));
    document.querySelector(".audio-controls")?.classList.toggle("muted", !settings.enabled);
  }

  function preloadSounds() {
    Object.values(sources).forEach((src) => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = src;
    });
  }

  function play(name, multiplier = 1) {
    if (!settings.enabled || !sources[name] || settings.volume <= 0) return;
    try {
      const audio = new Audio(sources[name]);
      audio.volume = Math.min(1, Math.max(0, settings.volume * multiplier));
      audio.play().catch(() => {});
    } catch (error) {
      console.warn("音效播放失败", name, error);
    }
  }

  function bindSoundTriggers() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button, [role='button']");
      if (!button || button.closest(".audio-controls")) return;

      const id = button.id || "";
      const text = (button.textContent || "").trim();

      if (id === "issue-decree-btn" || /用玺|颁诏|下诏/.test(text)) {
        play("seal", 1);
        return;
      }
      if (id === "end-turn-btn") {
        return;
      }
      if (
        id === "month-report-btn" ||
        button.matches("[data-character-id], [data-world-character], [data-region-id], [data-world-tab]") ||
        /月报|人物志|时间线|史料|天下|展开全文|查看|查阅/.test(text)
      ) {
        play("scroll", 0.9);
        return;
      }
      play("button", 0.65);
    }, true);
  }

  function observeDynamicPanels() {
    observer = new MutationObserver(() => {
      const monthly = document.querySelector(".monthly-addon-overlay");
      if (monthly && isVisible(monthly)) {
        const signature = `${monthly.className}|${monthly.textContent?.slice(0, 80)}`;
        if (signature !== lastOverlaySignature) {
          lastOverlaySignature = signature;
          play("monthEnd", 1);
        }
      }

      const reportList = document.getElementById("report-list");
      const firstReport = reportList?.querySelector(".report-item");
      if (firstReport && /本月奏报/.test(firstReport.textContent || "") && firstReport.dataset.audioAnnounced !== "1") {
        firstReport.dataset.audioAnnounced = "1";
        play("report", 0.85);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  function isVisible(element) {
    return !element.classList.contains("hidden") && element.getClientRects().length > 0;
  }

  window.XianAudio = { play, getSettings: () => ({ ...settings }) };
})();

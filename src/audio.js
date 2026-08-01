/* 天子蒙尘：献帝模拟器 v0.2.3 宫廷音画系统 */
(() => {
  "use strict";
  const KEY = "xian_emperor_audio_v023";
  const OLD_KEY = "xian_emperor_audio_v022";
  const SRC = window.XIAN_AUDIO_DATA || {};
  const DEFAULTS = { sfxEnabled: true, sfxVolume: 0.58, musicEnabled: true, musicVolume: 0.30 };
  const COOLDOWN = { button: 90, scroll: 260, seal: 500, report: 700, monthEnd: 1400, warning: 2600 };
  let settings = loadSettings();
  let bgm = null;
  let observer = null;
  let monthlySignature = "";
  let reportSignature = "";
  let warnings = new Set();
  let playedAt = new Map();
  let musicUnlocked = false;

  document.addEventListener("DOMContentLoaded", init);

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) return normalize(saved);
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
      if (old) return normalize({ sfxEnabled: old.enabled, sfxVolume: old.volume });
    } catch (_) {}
    return { ...DEFAULTS };
  }

  function normalize(value) {
    return {
      sfxEnabled: value.sfxEnabled ?? DEFAULTS.sfxEnabled,
      sfxVolume: clamp(value.sfxVolume, DEFAULTS.sfxVolume),
      musicEnabled: value.musicEnabled ?? DEFAULTS.musicEnabled,
      musicVolume: clamp(value.musicVolume, DEFAULTS.musicVolume),
    };
  }

  function clamp(value, fallback = 0) {
    value = Number(value);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  }

  function saveSettings() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function init() {
    installControls();
    createMusic();
    bindClicks();
    bindPageEvents();
    preloadSfx();
    observeUi();
    syncControls();
  }

  function installControls() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("sfx-toggle-btn")) return;
    const box = document.createElement("span");
    box.className = "audio-controls";
    box.innerHTML = `
      <span class="audio-control-group" data-audio-kind="sfx">
        <button id="sfx-toggle-btn" type="button" title="开启或关闭界面音效"></button>
        <label class="audio-volume-wrap" title="音效音量"><span>音效</span><input id="sfx-volume" type="range" min="0" max="1" step="0.05" value="${settings.sfxVolume}" aria-label="音效音量"></label>
      </span>
      <span class="audio-control-group" data-audio-kind="music">
        <button id="music-toggle-btn" type="button" title="开启或关闭朝堂背景音乐"></button>
        <label class="audio-volume-wrap" title="背景音乐音量"><span>音乐</span><input id="music-volume" type="range" min="0" max="1" step="0.05" value="${settings.musicVolume}" aria-label="背景音乐音量"></label>
      </span>`;
    nav.insertBefore(box, document.getElementById("help-btn") || null);

    box.querySelector("#sfx-toggle-btn")?.addEventListener("click", event => {
      event.stopPropagation();
      settings.sfxEnabled = !settings.sfxEnabled;
      saveSettings(); syncControls();
      if (settings.sfxEnabled) play("button", 0.85, true);
    });
    box.querySelector("#music-toggle-btn")?.addEventListener("click", event => {
      event.stopPropagation();
      settings.musicEnabled = !settings.musicEnabled;
      saveSettings(); syncControls();
      settings.musicEnabled ? startMusic() : pauseMusic();
    });
    box.querySelector("#sfx-volume")?.addEventListener("input", event => {
      settings.sfxVolume = clamp(event.target.value, DEFAULTS.sfxVolume); saveSettings();
    });
    box.querySelector("#sfx-volume")?.addEventListener("change", () => play("button", 0.9, true));
    box.querySelector("#music-volume")?.addEventListener("input", event => {
      settings.musicVolume = clamp(event.target.value, DEFAULTS.musicVolume); setMusicVolume(); saveSettings();
    });
  }

  function syncControls() {
    const sfx = document.getElementById("sfx-toggle-btn");
    const music = document.getElementById("music-toggle-btn");
    if (sfx) { sfx.textContent = `音效：${settings.sfxEnabled ? "开" : "关"}`; sfx.setAttribute("aria-pressed", String(settings.sfxEnabled)); }
    if (music) { music.textContent = `音乐：${settings.musicEnabled ? "开" : "关"}`; music.setAttribute("aria-pressed", String(settings.musicEnabled)); }
    document.querySelector('[data-audio-kind="sfx"]')?.classList.toggle("muted", !settings.sfxEnabled);
    document.querySelector('[data-audio-kind="music"]')?.classList.toggle("muted", !settings.musicEnabled);
  }

  function createMusic() {
    if (!SRC.bgm || bgm) return;
    try {
      bgm = new Audio(SRC.bgm);
      bgm.loop = true; bgm.preload = "metadata";
      bgm.setAttribute?.("data-audio-role", "court-bgm");
      setMusicVolume();
      bgm.addEventListener?.("error", () => console.warn("朝堂背景音乐加载失败。", SRC.bgm));
    } catch (error) { console.warn("无法初始化朝堂背景音乐。", error); bgm = null; }
  }

  function setMusicVolume() { if (bgm) bgm.volume = clamp(settings.musicVolume, DEFAULTS.musicVolume); }
  function gameActive() {
    const game = document.getElementById("game-shell");
    const ending = document.getElementById("end-screen");
    return !!game && !game.classList.contains("hidden") && (!ending || ending.classList.contains("hidden"));
  }
  function startMusic() {
    if (!settings.musicEnabled || settings.musicVolume <= 0 || !SRC.bgm || document.hidden || !gameActive()) return;
    if (!bgm) createMusic();
    if (!bgm || !bgm.paused) return;
    setMusicVolume(); musicUnlocked = true;
    bgm.play()?.catch?.(() => {});
  }
  function pauseMusic() { if (bgm && !bgm.paused) bgm.pause(); }
  function syncMusic() {
    if (document.hidden || !settings.musicEnabled || !gameActive()) pauseMusic();
    else if (musicUnlocked) startMusic();
  }

  function preloadSfx() {
    Object.entries(SRC).forEach(([name, src]) => {
      if (name === "bgm" || !src) return;
      try { const audio = new Audio(); audio.preload = "auto"; audio.src = src; } catch (_) {}
    });
  }

  function play(name, gain = 1, bypass = false) {
    if (!settings.sfxEnabled || settings.sfxVolume <= 0 || !SRC[name]) return false;
    const now = Date.now();
    if (!bypass && now - (playedAt.get(name) || 0) < (COOLDOWN[name] || 120)) return false;
    playedAt.set(name, now);
    try {
      const audio = new Audio(SRC[name]);
      audio.preload = "auto"; audio.volume = clamp(settings.sfxVolume * gain, settings.sfxVolume);
      audio.play()?.catch?.(() => {}); return true;
    } catch (_) { return false; }
  }

  function bindClicks() {
    document.addEventListener("click", event => {
      const button = event.target.closest?.("button, [role='button']");
      if (!button) return;
      const id = button.id || "";
      const text = (button.textContent || "").trim();
      if (id === "new-game-btn" || id === "continue-game-btn") {
        musicUnlocked = true; startMusic(); window.setTimeout(inspect, 0); play("report", 0.9); return;
      }
      if (button.closest?.(".audio-controls")) return;
      if (id === "ending-restart") { pauseMusic(); play("button", 0.7); return; }
      if (id === "issue-decree-btn" || /用玺|颁诏|下诏/.test(text)) { play("seal", 0.92); return; }
      if (id === "end-turn-btn") { play("monthEnd", 0.9); window.setTimeout(inspect, 0); return; }
      if (id === "month-report-btn" || button.matches?.("[data-character-id], [data-world-character], [data-region-id], [data-world-tab]") || /月报|人物志|时间线|史料|天下|展开全文|查看|查阅/.test(text)) { play("scroll"); return; }
      play("button", 0.72); window.setTimeout(syncMusic, 0);
    });
  }

  function bindPageEvents() {
    document.addEventListener("visibilitychange", syncMusic);
    window.addEventListener?.("pagehide", pauseMusic);
    window.addEventListener?.("pageshow", syncMusic);
  }

  function observeUi() {
    if (typeof MutationObserver !== "function" || !document.body) return;
    observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    inspect();
  }

  function inspect() {
    const monthly = document.querySelector(".monthly-addon-overlay");
    if (visible(monthly)) {
      const signature = `${monthly.className}|${(monthly.textContent || "").trim().slice(0, 140)}`;
      if (signature && signature !== monthlySignature) { monthlySignature = signature; play("monthEnd", 0.92); }
    } else monthlySignature = "";

    const report = document.querySelector("#report-list .report-item");
    if (report && /本月奏报/.test(report.textContent || "")) {
      const signature = (report.textContent || "").replace(/\s+/g, " ").trim().slice(0, 220);
      if (signature && signature !== reportSignature) { reportSignature = signature; play("report", 0.88); }
    }

    const banner = document.getElementById("danger-banner");
    if (visible(banner)) {
      const current = new Set((banner.textContent || "").replace(/^\s*警讯[:：]?\s*/, "").replace(/[。.\s]+$/, "").split(/[；;]/).map(x => x.trim()).filter(Boolean));
      if ([...current].some(item => !warnings.has(item))) play("warning", 0.92);
      warnings = current;
    } else warnings = new Set();
    syncMusic();
  }

  function visible(element) { return !!element && !element.classList.contains("hidden") && element.getClientRects().length > 0; }

  window.XianAudio = Object.freeze({
    play, startMusic, pauseMusic,
    getSettings: () => ({ ...settings }),
    getState: () => ({ musicPaused: bgm ? bgm.paused : true, dangerWarnings: [...warnings] }),
  });
})();

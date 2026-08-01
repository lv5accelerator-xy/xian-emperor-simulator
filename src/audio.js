/* 天子蒙尘：献帝模拟器 v0.2.3.3 稳定音频系统 */
(() => {
  "use strict";

  const KEY = "xian_emperor_audio_v023";
  const OLD_KEY = "xian_emperor_audio_v022";
  const SRC = window.XIAN_AUDIO_DATA || {};
  const DEFAULTS = {
    sfxEnabled: true,
    sfxVolume: 0.58,
    musicEnabled: true,
    musicVolume: 0.30,
  };
  const COOLDOWN = {
    button: 90,
    scroll: 260,
    seal: 500,
    report: 700,
    monthEnd: 1400,
    warning: 2600,
  };

  let settings = loadSettings();
  let bgm = null;
  let initialized = false;
  let musicUnlocked = false;
  let lastReportSignature = "";
  let lastWarningSignature = "";
  const playedAt = new Map();
  const effectPools = new Map();
  const observers = [];

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installControls();
    bindClicks();
    bindPageEvents();
    observeStableTargets();
    syncControls();
    inspectDanger();
    inspectLatestReport();
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) return normalize(saved);
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
      if (old) return normalize({
        sfxEnabled: old.enabled,
        sfxVolume: old.volume,
      });
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
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Math.min(1, Math.max(0, numeric))
      : fallback;
  }

  function saveSettings() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function installControls() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("sfx-toggle-btn")) return;

    const box = document.createElement("span");
    box.className = "audio-controls";
    box.innerHTML = `
      <span class="audio-control-group" data-audio-kind="sfx">
        <button id="sfx-toggle-btn" type="button" title="开启或关闭界面音效"></button>
        <label class="audio-volume-wrap" title="音效音量">
          <span>音效</span>
          <input id="sfx-volume" type="range" min="0" max="1" step="0.05" value="${settings.sfxVolume}" aria-label="音效音量">
        </label>
      </span>
      <span class="audio-control-group" data-audio-kind="music">
        <button id="music-toggle-btn" type="button" title="开启或关闭朝堂背景音乐"></button>
        <label class="audio-volume-wrap" title="背景音乐音量">
          <span>音乐</span>
          <input id="music-volume" type="range" min="0" max="1" step="0.05" value="${settings.musicVolume}" aria-label="背景音乐音量">
        </label>
      </span>`;

    nav.insertBefore(box, document.getElementById("help-btn") || null);

    box.querySelector("#sfx-toggle-btn")?.addEventListener("click", event => {
      event.stopPropagation();
      settings.sfxEnabled = !settings.sfxEnabled;
      saveSettings();
      syncControls();
      if (settings.sfxEnabled) play("button", 0.85, true);
    });

    box.querySelector("#music-toggle-btn")?.addEventListener("click", event => {
      event.stopPropagation();
      settings.musicEnabled = !settings.musicEnabled;
      saveSettings();
      syncControls();
      if (settings.musicEnabled) startMusic();
      else pauseMusic();
    });

    box.querySelector("#sfx-volume")?.addEventListener("input", event => {
      settings.sfxVolume = clamp(event.target.value, DEFAULTS.sfxVolume);
      saveSettings();
    });

    box.querySelector("#sfx-volume")?.addEventListener("change", () => {
      play("button", 0.9, true);
    });

    box.querySelector("#music-volume")?.addEventListener("input", event => {
      settings.musicVolume = clamp(event.target.value, DEFAULTS.musicVolume);
      setMusicVolume();
      saveSettings();
    });
  }

  function syncControls() {
    const sfxButton = document.getElementById("sfx-toggle-btn");
    const musicButton = document.getElementById("music-toggle-btn");

    if (sfxButton) {
      sfxButton.textContent = `音效：${settings.sfxEnabled ? "开" : "关"}`;
      sfxButton.setAttribute("aria-pressed", String(settings.sfxEnabled));
    }
    if (musicButton) {
      musicButton.textContent = `音乐：${settings.musicEnabled ? "开" : "关"}`;
      musicButton.setAttribute("aria-pressed", String(settings.musicEnabled));
    }

    document.querySelector('[data-audio-kind="sfx"]')
      ?.classList.toggle("muted", !settings.sfxEnabled);
    document.querySelector('[data-audio-kind="music"]')
      ?.classList.toggle("muted", !settings.musicEnabled);
  }

  function ensureMusic() {
    if (bgm || !SRC.bgm) return bgm;
    try {
      bgm = new Audio();
      bgm.loop = true;
      bgm.preload = "none";
      bgm.src = SRC.bgm;
      bgm.setAttribute?.("data-audio-role", "court-bgm");
      setMusicVolume();
      bgm.addEventListener?.("error", () => {
        console.warn("朝堂背景音乐加载失败。");
      });
    } catch (error) {
      console.warn("无法初始化朝堂背景音乐。", error);
      bgm = null;
    }
    return bgm;
  }

  function setMusicVolume() {
    if (bgm) bgm.volume = clamp(settings.musicVolume, DEFAULTS.musicVolume);
  }

  function gameActive() {
    const game = document.getElementById("game-shell");
    const ending = document.getElementById("end-screen");
    return Boolean(
      game
      && !game.classList.contains("hidden")
      && (!ending || ending.classList.contains("hidden"))
    );
  }

  function startMusic() {
    if (
      !settings.musicEnabled
      || settings.musicVolume <= 0
      || !SRC.bgm
      || document.hidden
      || !gameActive()
    ) return false;

    const music = ensureMusic();
    if (!music) return false;
    setMusicVolume();
    if (!music.paused) return true;

    try {
      const result = music.play();
      musicUnlocked = true;
      result?.catch?.(() => {
        musicUnlocked = false;
      });
      return true;
    } catch (_) {
      musicUnlocked = false;
      return false;
    }
  }

  function pauseMusic() {
    if (bgm && !bgm.paused) bgm.pause();
  }

  function syncMusic() {
    if (document.hidden || !settings.musicEnabled || !gameActive()) {
      pauseMusic();
      return;
    }
    if (musicUnlocked) startMusic();
  }

  function getEffectAudio(name) {
    const source = SRC[name];
    if (!source) return null;

    let pool = effectPools.get(name);
    if (!pool) {
      pool = [];
      effectPools.set(name, pool);
    }

    let audio = pool.find(item => item.paused || item.ended);
    if (!audio && pool.length < 2) {
      try {
        audio = new Audio();
        audio.preload = "none";
        audio.src = source;
        pool.push(audio);
      } catch (_) {
        return null;
      }
    }

    return audio || pool[0] || null;
  }

  function play(name, gain = 1, bypass = false) {
    if (!settings.sfxEnabled || settings.sfxVolume <= 0 || !SRC[name]) return false;

    const now = Date.now();
    if (!bypass && now - (playedAt.get(name) || 0) < (COOLDOWN[name] || 120)) {
      return false;
    }
    playedAt.set(name, now);

    const audio = getEffectAudio(name);
    if (!audio) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = clamp(settings.sfxVolume * gain, settings.sfxVolume);
      audio.play()?.catch?.(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function bindClicks() {
    document.addEventListener("click", event => {
      const button = event.target.closest?.("button, [role='button']");
      if (!button) return;
      if (button.closest?.(".audio-controls")) return;

      const id = button.id || "";
      const text = (button.textContent || "").trim();

      if (id === "new-game-btn" || id === "continue-game-btn") {
        play("report", 0.9);
        startMusic();
        return;
      }

      if (id === "ending-restart") {
        pauseMusic();
        play("button", 0.7);
        return;
      }

      if (id === "issue-decree-btn" || /用玺|颁诏|下诏/.test(text)) {
        play("seal", 0.92);
        startMusic();
        return;
      }

      if (id === "end-turn-btn") {
        play("monthEnd", 0.9);
        startMusic();
        return;
      }

      if (
        id === "month-report-btn"
        || button.matches?.("[data-character-id], [data-world-character], [data-region-id], [data-world-tab], [data-world-panel]")
        || /月报|人物志|时间线|史料|天下|展开全文|查看|查阅|舆图/.test(text)
      ) {
        play("scroll");
        startMusic();
        return;
      }

      play("button", 0.72);
      startMusic();
    });
  }

  function bindPageEvents() {
    document.addEventListener("visibilitychange", syncMusic);
    window.addEventListener?.("pagehide", pauseMusic);
    window.addEventListener?.("pageshow", syncMusic);
  }

  function observeStableTargets() {
    observeElement("danger-banner", inspectDanger, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    observeElement("report-list", inspectLatestReport, {
      childList: true,
      subtree: false,
    });

    observeElement("game-shell", syncMusic, {
      attributes: true,
      attributeFilter: ["class"],
    });

    observeElement("end-screen", syncMusic, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function observeElement(id, callback, options) {
    const target = document.getElementById(id);
    if (!target || typeof MutationObserver !== "function") return;
    const observer = new MutationObserver(callback);
    observer.observe(target, options);
    observers.push(observer);
  }

  function inspectDanger() {
    const banner = document.getElementById("danger-banner");
    if (!isVisible(banner)) {
      lastWarningSignature = "";
      return;
    }

    const signature = (banner.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    if (signature && signature !== lastWarningSignature) {
      lastWarningSignature = signature;
      play("warning", 0.92);
    }
  }

  function inspectLatestReport() {
    const report = document.querySelector("#report-list .report-item");
    if (!report) return;

    const signature = (report.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    if (!signature || signature === lastReportSignature) return;
    const hadPreviousReport = Boolean(lastReportSignature);
    lastReportSignature = signature;
    if (hadPreviousReport) play("report", 0.84);
  }

  function isVisible(element) {
    return Boolean(
      element
      && !element.classList.contains("hidden")
      && element.getClientRects().length > 0
    );
  }

  window.XianAudio = Object.freeze({
    play,
    startMusic,
    pauseMusic,
    getSettings: () => ({ ...settings }),
    getState: () => ({
      initialized,
      musicPaused: bgm ? bgm.paused : true,
      musicUnlocked,
      observedTargets: observers.length,
      audioKeys: Object.keys(SRC),
    }),
  });
})();

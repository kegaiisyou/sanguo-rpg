// 乱世烽火 · 音频系统（v20260909b）
// 优先播放 assets/audio/ 下的真实音频文件，加载失败时回退到 Web Audio 合成
(function (global) {
  'use strict';
  var enabled = true;
  var bgmVolume = 0.35;
  var sfxVolume = 0.6;
  var bgmAudio = null;
  var bgmPlaying = false;

  // 音频文件映射
  var AUDIO_FILES = {
    bgm: 'assets/audio/bgm_main.wav',
    click: 'assets/audio/sfx_click.wav',
    coin: 'assets/audio/sfx_coin.wav',
    attack: 'assets/audio/sfx_attack.wav'
  };
  var cache = {};
  var failed = {};

  function loadAudio(key) {
    if (cache[key]) return cache[key];
    if (failed[key]) return null;
    try {
      var a = new Audio(AUDIO_FILES[key]);
      a.preload = 'auto';
      a.addEventListener('error', function () { failed[key] = true; cache[key] = null; });
      cache[key] = a;
      return a;
    } catch (e) { failed[key] = true; return null; }
  }

  function playFile(key, vol) {
    if (!enabled) return;
    var src = loadAudio(key);
    if (!src) return false;
    try {
      var a = src.cloneNode();
      a.volume = (vol != null ? vol : sfxVolume);
      a.play().catch(function () { failed[key] = true; });
      return true;
    } catch (e) { return false; }
  }

  // ── Web Audio 合成 fallback ──
  var ctx = null;
  function ensureCtx() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol) {
    if (!enabled) return;
    var c = ensureCtx(); if (!c) return;
    var t = c.currentTime;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = type || 'sine'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq) {
    if (!enabled) return;
    var c = ensureCtx(); if (!c) return;
    var t = c.currentTime;
    var buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 800;
    var g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
  }

  // 解锁 AudioContext
  function unlock() { var c = ensureCtx(); if (c && c.state === 'suspended') c.resume(); }
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('click', unlock, { once: true });

  // ── 音效函数（优先文件，失败则合成）──
  function sfxClick() { if (!playFile('click')) tone(880, 0.05, 'square', 0.1); }
  function sfxCoin() { if (!playFile('coin')) { tone(988, 0.06, 'square', 0.1); setTimeout(function () { tone(1319, 0.1, 'square', 0.1); }, 50); } }
  function sfxConfirm() { tone(523, 0.08, 'triangle', 0.15); setTimeout(function () { tone(659, 0.1, 'triangle', 0.15); }, 60); setTimeout(function () { tone(784, 0.12, 'triangle', 0.15); }, 120); }
  function sfxCancel() { tone(440, 0.08, 'triangle', 0.12); setTimeout(function () { tone(330, 0.12, 'triangle', 0.12); }, 70); }
  function sfxOpen() { tone(392, 0.1, 'sine', 0.1); setTimeout(function () { tone(523, 0.12, 'sine', 0.1); }, 50); }
  function sfxClose() { tone(523, 0.08, 'sine', 0.08); setTimeout(function () { tone(392, 0.1, 'sine', 0.08); }, 50); }
  function sfxError() { tone(200, 0.15, 'sawtooth', 0.12); }
  function sfxLevelup() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.15, 'triangle', 0.15); }, i * 80); }); }
  function sfxAttack() { if (!playFile('attack')) { noise(0.15, 0.2, 800); tone(180, 0.1, 'sawtooth', 0.08); } }
  function sfxHit() { noise(0.12, 0.3, 400); tone(120, 0.08, 'sine', 0.2); }
  function sfxCrit() { noise(0.2, 0.35, 2000); tone(880, 0.15, 'square', 0.12); setTimeout(function () { tone(1200, 0.1, 'square', 0.08); }, 50); }
  function sfxMiss() { noise(0.2, 0.12, 3000); }
  function sfxDefend() { tone(300, 0.1, 'triangle', 0.15); noise(0.08, 0.08, 600); }
  function sfxHeal() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.2, 'sine', 0.1); }, i * 60); }); }
  function sfxSkill() { [440, 554, 659, 880].forEach(function (f, i) { setTimeout(function () { tone(f, 0.12, 'sawtooth', 0.1); }, i * 50); }); }
  function sfxVictory() { [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { tone(f, 0.2, 'triangle', 0.15); }, i * 100); }); }
  function sfxDefeat() { [440, 392, 349, 294, 262].forEach(function (f, i) { setTimeout(function () { tone(f, 0.25, 'sine', 0.12); }, i * 120); }); }

  // ── BGM ──
  function startBgm() {
    if (bgmPlaying) return;
    var src = loadAudio('bgm');
    if (src && !failed.bgm) {
      try {
        bgmAudio = src.cloneNode();
        bgmAudio.loop = true;
        bgmAudio.volume = bgmVolume;
        bgmAudio.play().then(function () { bgmPlaying = true; }).catch(function () { failed.bgm = true; bgmAudio = null; });
        return;
      } catch (e) { failed.bgm = true; }
    }
    // fallback: 不播放合成BGM（太奇怪），静默
  }
  function stopBgm() {
    bgmPlaying = false;
    if (bgmAudio) { try { bgmAudio.pause(); bgmAudio.currentTime = 0; } catch (e) { } bgmAudio = null; }
  }

  // ── 音量控制 ──
  function setBgmVolume(v) {
    bgmVolume = Math.max(0, Math.min(1, v));
    if (bgmAudio) { try { bgmAudio.volume = bgmVolume; } catch (e) { } }
    try { localStorage.setItem('sanguo_bgm_vol', bgmVolume); } catch (e) { }
  }
  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('sanguo_sfx_vol', sfxVolume); } catch (e) { }
  }
  function setEnabled(on) {
    enabled = on;
    if (!on) stopBgm();
    try { localStorage.setItem('sanguo_audio_on', on ? '1' : '0'); } catch (e) { }
  }
  function loadPrefs() {
    try {
      var b = localStorage.getItem('sanguo_bgm_vol');
      var s = localStorage.getItem('sanguo_sfx_vol');
      var e = localStorage.getItem('sanguo_audio_on');
      if (b != null) bgmVolume = parseFloat(b);
      if (s != null) sfxVolume = parseFloat(s);
      if (e != null) enabled = (e === '1');
    } catch (e2) { }
  }
  loadPrefs();

  // ── 全局桥接（兼容 engine.js 中的 SFX.swing/hit/crit/win/lose 调用）──
  global.SFX = {
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    swing: sfxAttack,
    hit: sfxHit,
    crit: sfxCrit,
    win: sfxVictory,
    lose: sfxDefeat,
    attack: sfxAttack,
    defend: sfxDefend,
    miss: sfxMiss,
    heal: sfxHeal,
    skill: sfxSkill,
    click: sfxClick,
    confirm: sfxConfirm,
    cancel: sfxCancel,
    open: sfxOpen,
    close: sfxClose,
    coin: sfxCoin,
    error: sfxError,
    levelup: sfxLevelup,
    play: function (name) {
      var fn = { click: sfxClick, coin: sfxCoin, confirm: sfxConfirm, cancel: sfxCancel, open: sfxOpen, close: sfxClose, error: sfxError, levelup: sfxLevelup, attack: sfxAttack, hit: sfxHit, crit: sfxCrit, miss: sfxMiss, defend: sfxDefend, heal: sfxHeal, skill: sfxSkill, victory: sfxVictory, defeat: sfxDefeat }[name];
      if (fn) fn();
    },
    startBgm: startBgm,
    stopBgm: stopBgm,
    setBgmVolume: setBgmVolume,
    setSfxVolume: setSfxVolume,
    isBgmPlaying: function () { return bgmPlaying; },
    unlock: unlock
  };
})(typeof window !== 'undefined' ? window : globalThis);

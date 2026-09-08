// 乱世烽火 · 音频系统（Web Audio API 合成，零外部资源）
// v20260909a — UI音效 + 战斗音效 + 五声音阶古风BGM循环
(function (global) {
  'use strict';
  var ctx = null;
  var masterGain = null;
  var bgmGain = null;
  var sfxGain = null;
  var bgmTimer = null;
  var bgmPlaying = false;
  var enabled = true;
  var bgmVolume = 0.35;
  var sfxVolume = 0.6;

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = bgmVolume;
      bgmGain.connect(masterGain);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = sfxVolume;
      sfxGain.connect(masterGain);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  // 用户首次交互后解锁 AudioContext（浏览器自动播放策略）
  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }
  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('click', unlock, { once: true });

  // ── 基础音色合成工具 ──
  function tone(freq, dur, type, vol, attack, release, dest) {
    if (!enabled) return;
    var c = ensureCtx(); if (!c) return;
    var t = c.currentTime;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    var a = attack || 0.005;
    var r = release || dur * 0.6;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.3, t + a);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest || sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, filterType, dest) {
    if (!enabled) return;
    var c = ensureCtx(); if (!c) return;
    var t = c.currentTime;
    var bufferSize = Math.floor(c.sampleRate * dur);
    var buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = filterFreq || 1000;
    var g = c.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest || sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  // ── UI 音效 ──
  var SFX = {
    click: function () { tone(880, 0.06, 'square', 0.12, 0.002, 0.04); },
    confirm: function () { tone(523, 0.08, 'triangle', 0.2); setTimeout(function () { tone(659, 0.1, 'triangle', 0.2); }, 60); setTimeout(function () { tone(784, 0.14, 'triangle', 0.2); }, 120); },
    cancel: function () { tone(440, 0.08, 'triangle', 0.18); setTimeout(function () { tone(330, 0.12, 'triangle', 0.18); }, 70); },
    open: function () { tone(392, 0.1, 'sine', 0.15); setTimeout(function () { tone(523, 0.12, 'sine', 0.15); }, 50); },
    close: function () { tone(523, 0.08, 'sine', 0.12); setTimeout(function () { tone(392, 0.1, 'sine', 0.12); }, 50); },
    coin: function () { tone(988, 0.06, 'square', 0.1); setTimeout(function () { tone(1319, 0.1, 'square', 0.1); }, 50); },
    error: function () { tone(200, 0.15, 'sawtooth', 0.15); },
    levelup: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.15, 'triangle', 0.2); }, i * 80); }); },
  };

  // ── 战斗音效 ──
  var COMBAT = {
    attack: function () { noise(0.15, 0.25, 800, 'bandpass'); tone(180, 0.1, 'sawtooth', 0.1); },
    hit: function () { noise(0.12, 0.35, 400, 'lowpass'); tone(120, 0.08, 'sine', 0.25); },
    crit: function () { noise(0.2, 0.4, 2000, 'highpass'); tone(880, 0.15, 'square', 0.15); setTimeout(function () { tone(1200, 0.1, 'square', 0.1); }, 50); },
    miss: function () { noise(0.2, 0.15, 3000, 'bandpass'); },
    heal: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.2, 'sine', 0.12); }, i * 60); }); },
    defend: function () { tone(300, 0.1, 'triangle', 0.2); noise(0.08, 0.1, 600, 'lowpass'); },
    skill: function () { [440, 554, 659, 880].forEach(function (f, i) { setTimeout(function () { tone(f, 0.12, 'sawtooth', 0.12); }, i * 50); }); },
    victory: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { tone(f, 0.2, 'triangle', 0.2); }, i * 100); }); },
    defeat: function () { [440, 392, 349, 294, 262].forEach(function (f, i) { setTimeout(function () { tone(f, 0.25, 'sine', 0.15); }, i * 120); }); },
  };

  // ── 古风 BGM（五声音阶循环）──
  // 宫商角徵羽 = C D E G A（五声音阶）
  var PENTA = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880];
  var melody = [
    0, 2, 4, 5, 4, 2, 0, -1,
    2, 4, 5, 7, 5, 4, 2, -1,
    4, 5, 7, 8, 7, 5, 4, 2,
    0, 2, 4, 2, 0, -1, -1, -1
  ];
  var bass = [0, 0, 3, 3, 4, 4, 0, 0];
  var melodyIdx = 0;
  var bassIdx = 0;
  var beat = 0;

  function playBgmNote() {
    if (!bgmPlaying || !enabled) return;
    var c = ensureCtx(); if (!c) return;
    var t = c.currentTime;

    // 主旋律（三角波模拟古琴/笛子）
    var mIdx = melody[melodyIdx % melody.length];
    if (mIdx >= 0) {
      var freq = PENTA[mIdx % PENTA.length];
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g);
      g.connect(bgmGain);
      osc.start(t);
      osc.stop(t + 0.5);
    }

    // 低音伴奏（每2拍一个）
    if (beat % 2 === 0) {
      var bIdx = bass[bassIdx % bass.length];
      var bassFreq = PENTA[bIdx % PENTA.length] / 2;
      var bosc = c.createOscillator();
      var bg = c.createGain();
      bosc.type = 'sine';
      bosc.frequency.value = bassFreq;
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(0.08, t + 0.05);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      bosc.connect(bg);
      bg.connect(bgmGain);
      bosc.start(t);
      bosc.stop(t + 1);
      bassIdx++;
    }

    melodyIdx++;
    beat++;
  }

  function startBgm() {
    if (bgmPlaying) return;
    ensureCtx();
    bgmPlaying = true;
    melodyIdx = 0; bassIdx = 0; beat = 0;
    bgmTimer = setInterval(playBgmNote, 380); // 约每分钟158拍
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  // ── 音量控制 ──
  function setBgmVolume(v) {
    bgmVolume = Math.max(0, Math.min(1, v));
    if (bgmGain) bgmGain.gain.value = bgmVolume;
    try { localStorage.setItem('sanguo_bgm_vol', bgmVolume); } catch (e) { }
  }
  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    if (sfxGain) sfxGain.gain.value = sfxVolume;
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
    swing: COMBAT.attack,
    hit: COMBAT.hit,
    crit: COMBAT.crit,
    win: COMBAT.victory,
    lose: COMBAT.defeat,
    attack: COMBAT.attack,
    defend: COMBAT.defend,
    miss: COMBAT.miss,
    heal: COMBAT.heal,
    skill: COMBAT.skill,
    click: SFX.click,
    confirm: SFX.confirm,
    cancel: SFX.cancel,
    open: SFX.open,
    close: SFX.close,
    coin: SFX.coin,
    error: SFX.error,
    levelup: SFX.levelup,
    play: function (name) {
      if (SFX[name]) SFX[name]();
      else if (COMBAT[name]) COMBAT[name]();
    },
    startBgm: startBgm,
    stopBgm: stopBgm,
    setBgmVolume: setBgmVolume,
    setSfxVolume: setSfxVolume,
    isBgmPlaying: function () { return bgmPlaying; },
    unlock: unlock
  };
})(typeof window !== 'undefined' ? window : globalThis);

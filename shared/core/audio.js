// 乱世烽火 · 音频系统（v20260909i）
// 多首BGM切换 + 播放-静默-重播模式 + Web Audio API预解码零延迟
(function (global) {
  'use strict';
  var enabled = true;
  var bgmVolume = 0.35;
  var sfxVolume = 0.6;
  var ctx = null;
  var sfxGain = null;
  var bgmGain = null;
  var bgmFadeGain = null;  // 淡入淡出用的gain节点
  var bgmSrc = null;
  var bgmSilenceTimer = null;
  var BGM_SILENCE = 2;     // 不循环曲目之间静默5秒
  var BGM_FADE = 1.5;      // 淡入淡出时长1.5秒
  var bgmPlaying = false;
  var currentBgmIdx = 0;

  // BGM列表：loop=true的直接循环播放，loop=false的淡入淡出+静默重播
  var BGM_TRACKS = [
    { id: 'main',  name: '柔情·江湖儿女', file: 'assets/audio/bgm_main.ogg',  loop: false },
    { id: 'xiao',  name: '苍凉·寒山孤影', file: 'assets/audio/bgm_xiao.ogg',  loop: true  },
    { id: 'dizi',  name: '明快·策马江湖', file: 'assets/audio/bgm_dizi.ogg',  loop: true  },
    { id: 'guqin', name: '沉静·夜泊枫桥', file: 'assets/audio/bgm_guqin.ogg', loop: true  },
    { id: 'battle', name: '激昂·金戈铁马', file: 'assets/audio/bgm_battle.ogg', loop: true }
  ];

  var SFX_FILES = {
    click: 'assets/audio/sfx_click.ogg',
    coin: 'assets/audio/sfx_coin.ogg',
    attack: 'assets/audio/sfx_attack.ogg'
  };

  var buffers = {};
  var loading = {};

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sfxGain = ctx.createGain();
      sfxGain.gain.value = sfxVolume;
      sfxGain.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = bgmVolume;
      bgmGain.connect(ctx.destination);
      bgmFadeGain = ctx.createGain();
      bgmFadeGain.gain.value = 1;
      bgmFadeGain.connect(bgmGain);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function altOf(u){ return u ? u.replace(/\.ogg$/i, '.mp3') : null; }   // 兼容兜底：不支持 OGG 的环境自动降级 MP3
  function loadBuffer(key, url) {
    if (buffers[key] !== undefined || loading[key]) return;
    var c = ensureCtx();
    if (!c) return;
    var altUrl = altOf(url);
    var tryOne = function (u) {
      return fetch(u).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
        .then(function (buf) { return c.decodeAudioData(buf); })
        .then(function (audioBuf) { buffers[key] = audioBuf; })
        .catch(function () {
          if (altUrl && u !== altUrl) return tryOne(altUrl);
          buffers[key] = null;
        });
    };
    loading[key] = tryOne(url).finally(function () { delete loading[key]; });
  }

  function preloadAll() {
    Object.keys(SFX_FILES).forEach(function (k) { loadBuffer(k, SFX_FILES[k]); });
    BGM_TRACKS.forEach(function (t) { loadBuffer(t.id, t.file); });
  }

  function playBuffer(key, gain) {
    if (!enabled) return false;
    var c = ensureCtx();
    if (!c || !buffers[key]) return false;
    try {
      var src = c.createBufferSource();
      src.buffer = buffers[key];
      var g = gain || sfxGain;
      src.connect(g);
      src.start(0);
      return src;
    } catch (e) { return false; }
  }

  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') { c.resume().catch(function(){}); }
    if (!buffers.main && !loading.main) preloadAll();
  }
  document.addEventListener('touchstart', unlock, { passive: true });
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  if (document.readyState === 'complete') preloadAll();
  else window.addEventListener('load', preloadAll);

  // ── 代码合成 fallback ──
  function tone(freq, dur, type, vol) {
    if (!enabled) return;
    var c = ensureCtx(); if (!c) return;
    var t = c.currentTime;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = type || 'sine'; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(sfxGain || c.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  // 生成一段随机噪声 buffer（供豹子锣声、赌坊氛围音共用）
  function makeNoiseBuf(c, dur) {
    var buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * (dur || 0.25))), c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
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
    src.connect(f); f.connect(g); g.connect(sfxGain || c.destination); src.start(t);
  }

  // ── 音效 ──
  function sfxClick() { if (!playBuffer('click')) tone(880, 0.05, 'square', 0.1); }
  function sfxCoin() { if (!playBuffer('coin')) { tone(988, 0.06, 'square', 0.1); setTimeout(function () { tone(1319, 0.1, 'square', 0.1); }, 50); } }
  function sfxConfirm() { tone(523, 0.08, 'triangle', 0.15); setTimeout(function () { tone(659, 0.1, 'triangle', 0.15); }, 60); setTimeout(function () { tone(784, 0.12, 'triangle', 0.15); }, 120); }
  function sfxCancel() { tone(440, 0.08, 'triangle', 0.12); setTimeout(function () { tone(330, 0.12, 'triangle', 0.12); }, 70); }
  function sfxOpen() { tone(392, 0.1, 'sine', 0.1); setTimeout(function () { tone(523, 0.12, 'sine', 0.1); }, 50); }
  function sfxClose() { tone(523, 0.08, 'sine', 0.08); setTimeout(function () { tone(392, 0.1, 'sine', 0.08); }, 50); }
  function sfxError() { tone(200, 0.15, 'sawtooth', 0.12); }
  function sfxLevelup() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.15, 'triangle', 0.15); }, i * 80); }); }
  function sfxAttack() { if (!playBuffer('attack')) { noise(0.15, 0.2, 800); tone(180, 0.1, 'sawtooth', 0.08); } }
  function sfxHit() { noise(0.12, 0.3, 400); tone(120, 0.08, 'sine', 0.2); }
  function sfxCrit() { noise(0.2, 0.35, 2000); tone(880, 0.15, 'square', 0.12); setTimeout(function () { tone(1200, 0.1, 'square', 0.08); }, 50); }
  function sfxMiss() { noise(0.2, 0.12, 3000); }
  function sfxDefend() { tone(300, 0.1, 'triangle', 0.15); noise(0.08, 0.08, 600); }
  function sfxHeal() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.2, 'sine', 0.1); }, i * 60); }); }
  function sfxSkill() { [440, 554, 659, 880].forEach(function (f, i) { setTimeout(function () { tone(f, 0.12, 'sawtooth', 0.1); }, i * 50); }); }
  function sfxVictory() { [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { tone(f, 0.2, 'triangle', 0.15); }, i * 100); }); }
  function sfxDefeat() { [440, 392, 349, 294, 262].forEach(function (f, i) { setTimeout(function () { tone(f, 0.25, 'sine', 0.12); }, i * 120); }); }

  // ── BGM（多首切换；循环曲目直接loop，非循环曲目淡入淡出+静默重播）──
  var BGM_DURATION = 20;   // 非循环曲目时长20秒
  var bgmState = 'stopped'; // 'playing' | 'silence' | 'stopped'
  var bgmPlayTimer = null;  // 非循环曲目：播放时长定时器
  var bgmFadeTimer = null;  // 非循环曲目：淡出定时器
  var bgmSilenceTimer = null; // 静默定时器

  function getCurrentBgm() { return BGM_TRACKS[currentBgmIdx]; }

  function clearBgmTimers() {
    if (bgmPlayTimer) { clearTimeout(bgmPlayTimer); bgmPlayTimer = null; }
    if (bgmFadeTimer) { clearTimeout(bgmFadeTimer); bgmFadeTimer = null; }
    if (bgmSilenceTimer) { clearTimeout(bgmSilenceTimer); bgmSilenceTimer = null; }
  }

  function startBgm() {
    if (bgmState === 'playing') return;
    var c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume().catch(function(){}); }
    var track = getCurrentBgm();
    if (!buffers[track.id]) {
      if (!loading[track.id]) loadBuffer(track.id, track.file);
      var check = setInterval(function () {
        if (buffers[track.id]) { clearInterval(check); if (bgmState !== 'playing') doStartBgm(); }
        else if (buffers[track.id] === null) clearInterval(check);
      }, 200);
      return;
    }
    doStartBgm();
  }

  function doStartBgm() {
    if (bgmState === 'playing' || !enabled) return;
    var c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume().catch(function(){}); }
    var track = getCurrentBgm();
    if (!buffers[track.id]) return;
    clearBgmTimers();
    try {
      // 停止旧的source
      if (bgmSrc) { try { bgmSrc.onended = null; bgmSrc.stop(); bgmSrc.disconnect(); } catch (e) { } bgmSrc = null; }
      // 重置淡入淡出gain
      if (bgmFadeGain) {
        bgmFadeGain.gain.cancelScheduledValues(c.currentTime);
        bgmFadeGain.gain.value = track.loop ? 1 : 0;
      }
      bgmSrc = c.createBufferSource();
      bgmSrc.buffer = buffers[track.id];
      bgmSrc.loop = !!track.loop;
      bgmSrc.onended = null;
      bgmSrc.connect(bgmFadeGain || bgmGain);
      bgmSrc.start(0);
      bgmState = 'playing';

      if (track.loop) {
        // 循环曲目：直接loop播放，不需要定时器
        // 淡入一下避免突兀
        if (bgmFadeGain) {
          bgmFadeGain.gain.setValueAtTime(0, c.currentTime);
          bgmFadeGain.gain.linearRampToValueAtTime(1, c.currentTime + BGM_FADE);
        }
      } else {
        // 非循环曲目（柔情）：淡入1.5秒 → 播放 → 结束前1.5秒淡出 → 静默5秒 → 重播
        var dur = BGM_DURATION;
        // 淡入
        if (bgmFadeGain) {
          bgmFadeGain.gain.setValueAtTime(0, c.currentTime);
          bgmFadeGain.gain.linearRampToValueAtTime(1, c.currentTime + BGM_FADE);
        }
        // 结束前1.5秒开始淡出
        bgmFadeTimer = setTimeout(function() {
          bgmFadeTimer = null;
          var cc = ensureCtx();
          if (cc && bgmFadeGain && bgmState === 'playing') {
            bgmFadeGain.gain.cancelScheduledValues(cc.currentTime);
            bgmFadeGain.gain.setValueAtTime(bgmFadeGain.gain.value, cc.currentTime);
            bgmFadeGain.gain.linearRampToValueAtTime(0, cc.currentTime + BGM_FADE);
          }
        }, (dur - BGM_FADE) * 1000);
        // 20秒后停止，进入静默
        bgmPlayTimer = setTimeout(function() {
          bgmPlayTimer = null;
          enterSilence();
        }, dur * 1000);
      }
    } catch (e) { bgmSrc = null; bgmState = 'stopped'; }
  }

  function enterSilence() {
    if (bgmState !== 'playing') return;
    if (bgmSrc) { try { bgmSrc.onended = null; bgmSrc.stop(); bgmSrc.disconnect(); } catch (e) { } bgmSrc = null; }
    bgmState = 'silence';
    // 静默5秒后重新播放
    bgmSilenceTimer = setTimeout(function() {
      bgmSilenceTimer = null;
      if (enabled && bgmState === 'silence') doStartBgm();
    }, BGM_SILENCE * 1000);
  }


  // ── 氛围层（P2）：环境音垫底，跟随房间/时辰切换，战斗时随 BGM 一起压低 ──
  var AMB_MAP = {
    birds:    { id: 'amb_birds',    file: 'assets/audio/amb_birds.ogg' },
    wind:     { id: 'amb_wind',     file: 'assets/audio/amb_wind.ogg' },
    market:   { id: 'amb_market',   file: 'assets/audio/amb_market.ogg' },
    night:    { id: 'amb_night',    file: 'assets/audio/amb_night.ogg' },
    rain:     { id: 'amb_rain',     file: 'assets/audio/amb_rain.ogg' },
    teahouse: { id: 'amb_teahouse', file: 'assets/audio/amb_teahouse.ogg' }
  };
  var ambSrc = null;
  var ambGainNode = null;
  var ambId = null;
  var AMB_VOL = 0.5;
  function ambIsNight(t){ var h=(t==null?8:t)%12; return h>=10 || h<=2; }
  function ambFor(roomId, t, weather){
    var r=String(roomId||'');
    // 茶馆（安静低语+茶具）优先于市声
    if(/cha|tea|chashi|mingcha/.test(r)) return 'teahouse';
    // 雨雪天气覆盖昼夜：雨夜要的是雨声（weather 为索引：3微雨 4大雨 5雪 7风）
    if(weather===3||weather===4) return 'rain';
    if(weather===5||weather===7) return 'wind';
    if(ambIsNight(t)) return 'night';
    if(/market|shiji|shu|jiuhua|jiulou/.test(r)) return 'market';
    if(/wild|road|field|forest|mountain|valley|camp|village|miao|shanzhai|yishou/.test(r)) return 'birds';
    return 'birds';
  }
  function startAmbient(id){
    var c=ensureCtx(); if(!c||!enabled) return;
    if(ambId===id) return;
    ambId=id;
    if(ambSrc){ try{ ambSrc.onended=null; ambSrc.stop(); ambSrc.disconnect(); }catch(e){} ambSrc=null; }
    var track=AMB_MAP[id]; if(!track) return;
    if(!buffers[track.id]){
      if(!loading[track.id]) loadBuffer(track.id, track.file);
      var chk=setInterval(function(){
        if(buffers[track.id]){ clearInterval(chk); if(ambId===id) doStartAmbient(track); }
        else if(buffers[track.id]===null) clearInterval(chk);
      },250);
      return;
    }
    doStartAmbient(track);
  }
  function doStartAmbient(track){
    if(ambId!==track.id||!enabled) return;
    var c=ensureCtx(); if(!c||!buffers[track.id]) return;
    if(ambSrc){ try{ ambSrc.stop(); ambSrc.disconnect(); }catch(e){} ambSrc=null; }
    if(!ambGainNode){
      ambGainNode=c.createGain();
      ambGainNode.gain.value=0;
      ambGainNode.connect(c.destination);
    }
    ambSrc=c.createBufferSource();
    ambSrc.buffer=buffers[track.id];
    ambSrc.loop=true;
    ambSrc.connect(ambGainNode);
    ambSrc.start(0);
    ambGainNode.gain.cancelScheduledValues(c.currentTime);
    ambGainNode.gain.setValueAtTime(0, c.currentTime);
    ambGainNode.gain.linearRampToValueAtTime(AMB_VOL, c.currentTime+BGM_FADE);
  }
  function stopAmbient(){
    ambId=null;
    var c=ensureCtx();
    if(c&&ambGainNode){
      ambGainNode.gain.cancelScheduledValues(c.currentTime);
      ambGainNode.gain.linearRampToValueAtTime(0, c.currentTime+0.7);
    }
    setTimeout(function(){ if(ambSrc){ try{ ambSrc.stop(); ambSrc.disconnect(); }catch(e){} ambSrc=null; } },800);
  }
  function syncAmbient(roomId, t, weather){
    if(!enabled) return;
    if(bgmState==='stopped'){ stopAmbient(); return; }
    startAmbient(ambFor(roomId, t, weather));
  }
  // 战斗时压低氛围层，并切换到战斗曲（v20260930a）：战斗开始 setCombatBgm(true)，结束调 false
  function duckBgm(on){
    var c=ensureCtx(); if(!c) return;
    if(ambGainNode){ ambGainNode.gain.cancelScheduledValues(c.currentTime); ambGainNode.gain.linearRampToValueAtTime(on?0.2:AMB_VOL, c.currentTime+0.3); }
  }
  var preCombatBgmIdx = -1;
  function switchBgmNoPersist(idx){
    if(idx<0||idx>=BGM_TRACKS.length) return;
    currentBgmIdx=idx;
    var c=ensureCtx();
    if(c&&c.state==='suspended'){ c.resume().catch(function(){}); }
    stopBgm();
    startBgm();
  }
  function setCombatBgm(on){
    var battleIdx=-1;
    for(var i=0;i<BGM_TRACKS.length;i++){ if(BGM_TRACKS[i].id==='battle'){ battleIdx=i; break; } }
    if(on){
      if(preCombatBgmIdx<0) preCombatBgmIdx=currentBgmIdx;
      if(battleIdx>=0 && battleIdx!==currentBgmIdx) switchBgmNoPersist(battleIdx);
      duckBgm(true);
    } else {
      duckBgm(false);
      if(preCombatBgmIdx>=0){ switchBgmNoPersist(preCombatBgmIdx); preCombatBgmIdx=-1; }
    }
  }

  function stopBgm() {
    bgmState = 'stopped';
    clearBgmTimers();
    if (bgmSrc) { try { bgmSrc.onended = null; bgmSrc.stop(); bgmSrc.disconnect(); } catch (e) { } bgmSrc = null; }
    if (bgmFadeGain) {
      var c = ensureCtx();
      if (c) bgmFadeGain.gain.cancelScheduledValues(c.currentTime);
    }
    stopAmbient();
  }

  function setBgmTrack(idx) {
    if (idx < 0 || idx >= BGM_TRACKS.length) return;
    currentBgmIdx = idx;
    try { localStorage.setItem('sanguo_bgm_track', idx); } catch (e) { }
    var c = ensureCtx();
    if (c && c.state === 'suspended') { c.resume().catch(function(){}); }
    stopBgm();
    startBgm();
  }

  // BGM健康监控（v20260909t）：每2秒检查状态一致性
  var bgmWatchTimer = setInterval(function() {
    if (!enabled) return;
    if (bgmState === 'stopped') return;
    var c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume().catch(function(){}); }
    var track = getCurrentBgm();
    // playing态但没有source → 意外中断，恢复
    if (bgmState === 'playing' && !bgmSrc) {
      doStartBgm();
    }
    // silence态但没有静默定时器 → 意外中断，恢复
    if (bgmState === 'silence' && !bgmSilenceTimer) {
      doStartBgm();
    }
  }, 2000);

  // 页面切回前台时主动恢复BGM
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      var c = ensureCtx();
      if (c && c.state === 'suspended') { c.resume().catch(function(){}); }
      if (enabled && bgmState !== 'stopped' && !bgmSrc && !bgmPlayTimer && !bgmSilenceTimer) {
        setTimeout(function(){ doStartBgm(); }, 100);
      }
    }
  });

  function getBgmTracks() { return BGM_TRACKS.map(function(t, i){ return {idx: i, id: t.id, name: t.name}; }); }
  function getCurrentBgmIdx() { return currentBgmIdx; }

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
      var t = localStorage.getItem('sanguo_bgm_track');
      if (b != null) bgmVolume = parseFloat(b);
      if (s != null) sfxVolume = parseFloat(s);
      if (e != null) enabled = (e === '1');
      if (t != null) currentBgmIdx = parseInt(t, 10) || 0;
    } catch (e2) { }
  }
  loadPrefs();

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

    startAmbient: startAmbient, stopAmbient: stopAmbient,
    play: function (name) {
      var fn = { click: sfxClick, coin: sfxCoin, confirm: sfxConfirm, cancel: sfxCancel, open: sfxOpen, close: sfxClose, error: sfxError, levelup: sfxLevelup, attack: sfxAttack, hit: sfxHit, crit: sfxCrit, miss: sfxMiss, defend: sfxDefend, heal: sfxHeal, skill: sfxSkill, victory: sfxVictory, defeat: sfxDefeat,
        diceShake: sfxDiceShake, diceLand: sfxDiceLand, diceTick: sfxDiceTick, win: sfxWin, lose: sfxLose, bao: sfxBao }[name];
      if (fn) fn();
    },
    startBgm: startBgm,
    stopBgm: stopBgm,
    syncAmbient: syncAmbient,
    duckBgm: duckBgm,
    setCombatBgm: setCombatBgm,
    setBgmVolume: setBgmVolume,
    setSfxVolume: setSfxVolume,
    setBgmTrack: setBgmTrack,
    getBgmTracks: getBgmTracks,
    getCurrentBgmIdx: getCurrentBgmIdx,
    isBgmPlaying: function () { return bgmState !== 'stopped'; },
    unlock: unlock
  };

  // ── 赌坊骰子音效（Web Audio 代码合成，统一走 sfxGain 音量）──
  function sfxDiceShake() {
    var c = ensureCtx(); if (!c || !enabled) return;
    var t = c.currentTime;
    for (var i = 0; i < 9; i++) {
      var t0 = t + i * (0.028 + Math.random() * 0.03);
      var len = Math.floor(c.sampleRate * 0.03);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
      var src = c.createBufferSource(); src.buffer = buf;
      var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 1600; f.Q.value = 2.2;
      var g = c.createGain(); g.gain.value = 0.4;
      src.connect(f); f.connect(g); g.connect(sfxGain);
      src.start(t0);
    }
  }
  function sfxDiceLand() {
    var c = ensureCtx(); if (!c || !enabled) return;
    var t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = 150 + Math.random() * 40;
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.13);
    var len = Math.floor(c.sampleRate * 0.018);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var dd = buf.getChannelData(0);
    for (var j = 0; j < len; j++) dd[j] = (Math.random() * 2 - 1) * (1 - j / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var g2 = c.createGain(); g2.gain.value = 0.35;
    src.connect(g2); g2.connect(sfxGain); src.start(t);
  }
  function sfxDiceTick() {
    var c = ensureCtx(); if (!c || !enabled) return;
    var t = c.currentTime;
    var len = Math.floor(c.sampleRate * 0.012);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2200;
    var g = c.createGain(); g.gain.value = 0.22;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }
    // 豹子通吃锣声（低鼓+铜锣，比普通胜利更响更戏剧）
  function sfxBao() {
    if (!ctxReady()) return;
    var t = c.currentTime;
    var g = c.createGain(); g.gain.value = 0.5; g.connect(sfxGain || c.destination);
    var osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(392, t); osc.frequency.exponentialRampToValueAtTime(196, t + 0.7); osc.connect(g); osc.start(t); osc.stop(t + 0.8);
    var o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(523, t); o2.frequency.exponentialRampToValueAtTime(262, t + 0.6); o2.connect(g); o2.start(t); o2.stop(t + 0.7);
    var n = c.createBufferSource(); n.buffer = makeNoiseBuf(c, 0.25); var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200; n.connect(hp); hp.connect(g); n.start(t);
    var o3 = c.createOscillator(); o3.type = 'square'; o3.frequency.value = 740; var g3 = c.createGain(); g3.gain.setValueAtTime(0.25, t); g3.gain.exponentialRampToValueAtTime(0.01, t + 0.35); o3.connect(g3); g3.connect(g); o3.start(t); o3.stop(t + 0.4);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + 1.1);
  }
  // ── 赌坊氛围音（进赌坊播放：低通人声低语 + 稀疏骰声/铜钱叮，关窗停止） ──
  var ambGain = null, ambTimer = null;
  function startAmbient() {
    stopAmbient();
    var c = ensureCtx(); if (!c || !enabled) return;
    ambGain = c.createGain(); ambGain.gain.value = 0;
    ambGain.connect(sfxGain || c.destination);
    // 人群低语层：低通白噪持续铺底（更明显）
    var n = c.createBufferSource(); n.buffer = makeNoiseBuf(c, 1.2); n.loop = true;
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 430; f.Q.value = 0.55;
    n.connect(f); f.connect(ambGain); n.start();
    // 低频酒馆嗡嗡（持续底噪，赌坊嘈杂感）
    var hum = c.createOscillator(); hum.type = 'sine'; hum.frequency.value = 105;
    var humG = c.createGain(); humG.gain.value = 0.16; humG.gain.setValueAtTime(0, c.currentTime); humG.gain.linearRampToValueAtTime(0.16, c.currentTime + 2.4);
    hum.connect(humG); humG.connect(ambGain); hum.start();
    ambGain.gain.setValueAtTime(0, c.currentTime);
    ambGain.gain.linearRampToValueAtTime(0.24, c.currentTime + 2);
    // 稀疏骰声/铜钱叮/杯盏碰响：2.6~3.4s 随机一枚（更密更响）
    ambTimer = setInterval(function () {
      if (!ambGain) return;
      var t = c.currentTime, r = Math.random();
      if (r < 0.62) { // 骰子轻响
        var s = c.createBufferSource(); s.buffer = makeNoiseBuf(c, 0.1);
        var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700 + Math.random() * 900; bp.Q.value = 1.6;
        var g = c.createGain(); g.gain.value = 0.09 + Math.random() * 0.06;
        s.connect(bp); bp.connect(g); g.connect(ambGain); s.start(t);
      } else if (r < 0.86) { // 铜钱叮
        var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 2300 + Math.random() * 600;
        var g2 = c.createGain(); g2.gain.setValueAtTime(0.055, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g2); g2.connect(ambGain); o.start(t); o.stop(t + 0.22);
      } else { // 杯盏碰响（短促噪声+泛音）
        var s2 = c.createBufferSource(); s2.buffer = makeNoiseBuf(c, 0.06);
        var bp2 = c.createBiquadFilter(); bp2.type = 'highpass'; bp2.frequency.value = 1800;
        var g3 = c.createGain(); g3.gain.value = 0.05;
        s2.connect(bp2); bp2.connect(g3); g3.connect(ambGain); s2.start(t);
      }
    }, 3000);
  }
  function stopAmbient() {
    if (ambTimer) { clearInterval(ambTimer); ambTimer = null; }
    var g = ambGain; ambGain = null;
    if (g && ctx) { try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); } catch (e) { } setTimeout(function () { try { g.disconnect(); } catch (e2) { } }, 550); }
  }
  function sfxWin() { try { sfxVictory(); sfxCoin(); } catch (e) {} }
  function sfxLose() { try { sfxDefeat(); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);

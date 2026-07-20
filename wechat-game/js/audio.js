// ==================== 乱世烽火 - 微信音频系统 ====================
// 使用 wx.createWebAudioContext 和 wx.createInnerAudioContext

var audioCtx = null;
var sfxGain = null;
var musicGain = null;
var sfxVol = 0.7;
var musicVol = 0.3;

// 外部BGM
var bgmAudio = null;

function initAudio() {
  try {
    audioCtx = wx.createWebAudioContext();
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(audioCtx.destination);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = musicVol;
    musicGain.connect(audioCtx.destination);
  } catch (e) {
    console.log('Audio init failed:', e);
  }
}

// ====== 基础音效合成 ======
function playTone(freq, type, duration, volume, endFreq) {
  if (!audioCtx) return;
  try {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(volume || 0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.02);
  } catch (e) {}
}

function playNoise(duration, volume, freq, q) {
  if (!audioCtx) return;
  try {
    var sr = audioCtx.sampleRate;
    var len = Math.floor(sr * duration);
    var buf = audioCtx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume || 0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    var filter = audioCtx.createBiquadFilter();
    filter.type = freq ? 'bandpass' : 'highpass';
    filter.frequency.value = freq || 2500;
    filter.Q.value = q || 0.8;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    src.start();
  } catch (e) {}
}

function playSweep(startFreq, endFreq, duration, volume, type) {
  if (!audioCtx) return;
  try {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration * 0.75);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.02);
  } catch (e) {}
}

// ====== 游戏音效 ======
function sfxSword() {
  playSweep(400, 6000, 0.055, 0.09, 'sawtooth');
  setTimeout(function() { playNoise(0.04, 0.06, 5500, 0.2); playTone(4200, 'sawtooth', 0.1, 0.07); }, 15);
  setTimeout(function() { playTone(3200, 'sine', 0.35, 0.05); }, 30);
}

function sfxCrit() {
  playSweep(300, 7000, 0.06, 0.12, 'sawtooth');
  setTimeout(function() { playNoise(0.06, 0.09, 6000, 0.18); playTone(4800, 'sawtooth', 0.22, 0.1); }, 10);
  setTimeout(function() { playTone(1400, 'sawtooth', 0.05, 0.05); }, 25);
}

function sfxSlash() {
  playSweep(600, 4800, 0.04, 0.07, 'sawtooth');
  playNoise(0.03, 0.05, 5000, 0.22);
  playTone(3600, 'sawtooth', 0.09, 0.06);
}

function sfxSkill() {
  playSweep(120, 800, 0.3, 0.07, 'triangle');
  playNoise(0.35, 0.05, 500, 0.8);
}

function sfxHit() {
  playTone(50, 'sine', 0.28, 0.08);
  playNoise(0.05, 0.03, 200, 0.7);
  playTone(100, 'triangle', 0.12, 0.03);
}

function sfxVictory() {
  var ns = [523, 659, 784, 1047];
  for (var i = 0; i < ns.length; i++) {
    setTimeout((function(f, idx) {
      return function() { playTone(f, 'triangle', 0.22, 0.08); };
    })(ns[i], i), i * 140);
  }
}

function sfxDefeat() {
  playTone(300, 'triangle', 0.4, 0.08);
  setTimeout(function() { playTone(220, 'triangle', 0.45, 0.1); }, 200);
  setTimeout(function() { playTone(130, 'triangle', 0.55, 0.12); }, 420);
}

function sfxCoin() {
  playTone(1400, 'sine', 0.08, 0.06);
  setTimeout(function() { playTone(1800, 'sine', 0.06, 0.04); }, 60);
}

function sfxLevelUp() {
  var ns = [392, 523, 659, 784, 1047, 1318];
  for (var i = 0; i < ns.length; i++) {
    setTimeout((function(f) { return function() { playTone(f, 'triangle', 0.16, 0.06); }; })(ns[i]), i * 110);
  }
}

function sfxHeal() {
  playTone(440, 'sine', 0.5, 0.04, 620);
  setTimeout(function() { playTone(554, 'sine', 0.35, 0.03); }, 200);
}

function sfxFlee() {
  playNoise(0.35, 0.04, 1800, 0.5);
  playTone(260, 'triangle', 0.3, 0.03, 80);
}

function sfxClick() { playTone(900, 'sine', 0.02, 0.015); }

function sfxQuest() {
  playTone(523, 'triangle', 0.12, 0.05);
  setTimeout(function() { playTone(659, 'triangle', 0.12, 0.05); }, 100);
  setTimeout(function() { playTone(784, 'triangle', 0.16, 0.06); }, 200);
}

function sfxStart() {
  playTone(150, 'triangle', 0.35, 0.06, 750);
}

// ====== BGM ======
var musicPlaying = false;
var musicNoteIdx = 0;
var musicTimer = null;
// 五声音阶
var PENTA = [[131, 147, 165, 196, 220], [262, 294, 330, 392, 440], [523, 587, 659, 784, 880]];
var MELODY = [
  [1, 2, 2], [1, 1, 2], [1, 0, 3], [0, 4, 3], [0, 3, 2], [1, 2, 2], [1, 1, 2], [1, 0, 4], [0, 4, 2],
  [1, 2, 2], [1, 1, 2], [1, 0, 3], [0, 4, 2], [0, 3, 1], [0, 4, 2], [1, 0, 3], [1, 1, 4],
  [1, 0, 2], [1, 1, 2], [1, 2, 2], [1, 3, 3], [1, 4, 3], [2, 0, 5],
  [1, 3, 2], [1, 2, 2], [1, 1, 2], [1, 0, 3], [0, 4, 3], [0, 3, 4],
  [0, 3, 2], [0, 4, 2], [1, 0, 2], [1, 1, 2], [1, 2, 3], [1, 0, 3], [1, 1, 4],
  [1, 2, 3], [1, 1, 2], [1, 0, 2], [0, 4, 3], [0, 3, 2], [1, 0, 3], [1, 0, 6]
];
var BGM_BPM = 42, BGM_BEAT = 60000 / BGM_BPM;
var curBgmFreq = 0;

function musicPlayNote() {
  if (!audioCtx || !musicPlaying) return;
  var idx = musicNoteIdx % MELODY.length;
  var m = MELODY[idx];
  var freq = PENTA[m[0]][m[1]];
  var dur = m[2] * BGM_BEAT / 1000;
  var prevFreq = curBgmFreq || freq;
  curBgmFreq = freq;

  // 主音
  try {
    var o1 = audioCtx.createOscillator(), g1 = audioCtx.createGain();
    o1.type = 'triangle';
    if (idx > 0 && Math.abs(freq - prevFreq) < freq * 0.35) {
      o1.frequency.setValueAtTime(prevFreq, audioCtx.currentTime);
      o1.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + 0.12);
    } else {
      o1.frequency.setValueAtTime(freq, audioCtx.currentTime);
    }
    g1.gain.setValueAtTime(0, audioCtx.currentTime);
    g1.gain.linearRampToValueAtTime(0.07, audioCtx.currentTime + 0.1);
    g1.gain.setValueAtTime(0.07, audioCtx.currentTime + dur * 0.55);
    g1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur * 0.95);
    o1.connect(g1); g1.connect(musicGain);
    o1.start(); o1.stop(audioCtx.currentTime + dur + 0.15);
  } catch (e) {}

  musicNoteIdx++;
  var nextDelay = m[2] * BGM_BEAT;
  if (m[2] >= 5) nextDelay += 150;
  musicTimer = setTimeout(musicPlayNote, nextDelay);
}

function startMusic() {
  if (musicPlaying) return;
  if (!audioCtx) initAudio();
  if (!audioCtx) return;

  musicPlaying = true;
  musicNoteIdx = 0;
  curBgmFreq = 0;

  // 低音嗡鸣
  try {
    for (var i = 0; i < 3; i++) {
      var freq = [32.7, 65.4, 98][i];
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(i === 0 ? 0.014 : i === 1 ? 0.01 : 0.006, audioCtx.currentTime);
      o.connect(g); g.connect(musicGain);
      o.start();
    }
  } catch (e) {}

  musicPlayNote();

  // 尝试加载外部BGM
  loadExternalBGM();
}

var externalBgm = null;
function loadExternalBGM() {
  try {
    var fs = wx.getFileSystemManager();
    // 优先使用分包内的 bgm（不占主包 4MB 体积），回退到主包 assets
    var candidates = ['subpackages/audio/bgm.mp3', 'assets/bgm.mp3'];
    for (var i = 0; i < candidates.length; i++) {
      try {
        fs.accessSync(candidates[i]);
        externalBgm = wx.createInnerAudioContext();
        externalBgm.src = candidates[i];
        externalBgm.loop = true;
        externalBgm.volume = musicVol;
        externalBgm.play();
        return;
      } catch (e) {
        // 尝试下一个候选路径
      }
    }
  } catch (e) {}
}

function stopMusic() {
  musicPlaying = false;
  curBgmFreq = 0;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  if (externalBgm) {
    externalBgm.stop();
    externalBgm.destroy();
    externalBgm = null;
  }
}

function setSfxVol(v) {
  sfxVol = Math.max(0, Math.min(1, v));
  if (sfxGain) sfxGain.gain.value = sfxVol;
}

function setMusicVol(v) {
  musicVol = Math.max(0, Math.min(1, v));
  if (musicGain) musicGain.gain.value = musicVol;
  if (externalBgm) externalBgm.volume = musicVol;
}

module.exports = {
  initAudio: initAudio,
  startMusic: startMusic,
  loadExternalBGM: loadExternalBGM,
  stopMusic: stopMusic,
  setSfxVol: setSfxVol,
  setMusicVol: setMusicVol,
  sfxSword: sfxSword,
  sfxCrit: sfxCrit,
  sfxSlash: sfxSlash,
  sfxSkill: sfxSkill,
  sfxHit: sfxHit,
  sfxVictory: sfxVictory,
  sfxDefeat: sfxDefeat,
  sfxCoin: sfxCoin,
  sfxLevelUp: sfxLevelUp,
  sfxHeal: sfxHeal,
  sfxFlee: sfxFlee,
  sfxClick: sfxClick,
  sfxQuest: sfxQuest,
  sfxStart: sfxStart,
  get sfxVol() { return sfxVol; },
  get musicVol() { return musicVol; }
};

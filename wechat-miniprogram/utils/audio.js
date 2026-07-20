// ==================== 音频管理器 ====================
// BGM 使用本地 mp3，SFX 使用程序生成短 WAV（base64 data URL）

var _bgm = null;
var _titleBgm = null;
var _musicVol = 0.35;
var _sfxVol = 0.7;
var _musicEnabled = true;
var _sfxEnabled = true;
var _sfxPool = [];  // 音效对象池，避免频繁创建 InnerAudioContext 造成内存泄漏
var _sfxPoolIdx = 0;
var _sfxPoolMax = 4;  // iOS 微信 InnerAudioContext 数量有限，限制为 4
var _sfxScratch = null;  // 共享音效播放实例（用于非重叠短音效）

// 获取一个可用的音效实例（优先复用已完成播放的）
function getSfxPlayer() {
  // 清理已播放完毕的实例
  _sfxPool = _sfxPool.filter(function(s) {
    return !s._done;
  });
  // 如果池子没满，创建新的
  if (_sfxPool.length < _sfxPoolMax) {
    var s = wx.createInnerAudioContext();
    s.volume = _sfxVol;
    s._done = true;
    s._cleanup = function() {
      this._done = true;
      try { this.stop(); } catch(e) {}
    };
    s.onEnded(function() { s._cleanup(); });
    s.onError(function() { s._cleanup(); });
    s.onStop(function() { s._cleanup(); });
    _sfxPool.push(s);
    return s;
  }
  // 池子已满，轮转复用最旧的一个
  _sfxPoolIdx = (_sfxPoolIdx + 1) % _sfxPool.length;
  var old = _sfxPool[_sfxPoolIdx];
  try { old.stop(); } catch(e) {}
  old._done = false;
  return old;
}

function setLittleEndian(view, offset, bytes, val) {
  for (var i = 0; i < bytes; i++) {
    view.setUint8(offset + i, (val >> (i * 8)) & 0xff);
  }
}

// 生成简单波形 WAV（8-bit unsigned mono）
function makeWav(freq, duration, waveType) {
  var sampleRate = 8000;
  var numSamples = Math.floor(sampleRate * duration);
  var buffer = new ArrayBuffer(44 + numSamples);
  var view = new DataView(buffer);
  var dataSize = numSamples;

  // RIFF header
  var header = 'RIFF';
  for (var i = 0; i < 4; i++) view.setUint8(i, header.charCodeAt(i));
  setLittleEndian(view, 4, 4, 36 + dataSize);
  header = 'WAVE';
  for (var j = 0; j < 4; j++) view.setUint8(8 + j, header.charCodeAt(j));
  header = 'fmt ';
  for (var k = 0; k < 4; k++) view.setUint8(12 + k, header.charCodeAt(k));
  setLittleEndian(view, 16, 4, 16); // subchunk1 size
  setLittleEndian(view, 20, 2, 1);  // PCM
  setLittleEndian(view, 22, 2, 1);  // mono
  setLittleEndian(view, 24, 4, sampleRate);
  setLittleEndian(view, 28, 4, sampleRate); // byte rate
  setLittleEndian(view, 32, 2, 1);  // block align
  setLittleEndian(view, 34, 2, 8);  // bits per sample
  header = 'data';
  for (var m = 0; m < 4; m++) view.setUint8(36 + m, header.charCodeAt(m));
  setLittleEndian(view, 40, 4, dataSize);

  for (var n = 0; n < numSamples; n++) {
    var t = n / sampleRate;
    var phase = (freq * t) % 1;
    var sample = 0;
    switch (waveType) {
      case 'square': sample = phase < 0.5 ? 1 : -1; break;
      case 'sawtooth': sample = phase * 2 - 1; break;
      case 'triangle': sample = phase < 0.5 ? (phase * 4 - 1) : (3 - phase * 4); break;
      default: sample = Math.sin(2 * Math.PI * phase);
    }
    // 简单衰减包络
    var env = Math.max(0, 1 - n / numSamples);
    var v = Math.max(-1, Math.min(1, sample * env));
    view.setUint8(44 + n, 128 + Math.floor(v * 127));
  }

  var base64 = '';
  if (typeof wx !== 'undefined' && wx.arrayBufferToBase64) {
    base64 = wx.arrayBufferToBase64(buffer);
  } else if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(buffer).toString('base64');
  }
  return 'data:audio/wav;base64,' + base64;
}

var _sfxCache = {};
function sfxSrc(name) {
  if (_sfxCache[name]) return _sfxCache[name];
  var map = {
    atk: makeWav(880, 0.12, 'square'),
    crit: makeWav(1320, 0.18, 'sawtooth'),
    skill: makeWav(440, 0.32, 'sawtooth'),
    hit: makeWav(120, 0.22, 'sine'),
    levelup: makeWav(784, 0.55, 'triangle'),
    win: makeWav(523, 0.45, 'triangle'),
    coin: makeWav(1200, 0.12, 'sine'),
    heal: makeWav(660, 0.35, 'sine'),
    flee: makeWav(200, 0.35, 'triangle'),
    click: makeWav(900, 0.04, 'sine')
  };
  _sfxCache[name] = map[name] || '';
  return _sfxCache[name];
}

function destroyBgm(bgm) {
  if (!bgm) return;
  try { bgm.stop(); } catch (e) {}
  try { bgm.destroy(); } catch (e) {}
}

module.exports = {
  init: function () {
    // 从本地存储读取上次的音量设置
    try {
      var settings = wx.getStorageSync('luanshi_settings');
      if (settings) {
        if (typeof settings.musicVol === 'number') _musicVol = settings.musicVol;
        if (typeof settings.sfxVol === 'number') _sfxVol = settings.sfxVol;
        if (typeof settings.musicEnabled === 'boolean') _musicEnabled = settings.musicEnabled;
        if (typeof settings.sfxEnabled === 'boolean') _sfxEnabled = settings.sfxEnabled;
      }
    } catch (e) {}

    destroyBgm(_bgm);
    destroyBgm(_titleBgm);
    _bgm = wx.createInnerAudioContext();
    _bgm.src = '/subpackages/asset/bgm.mp3';
    _bgm.loop = true;
    _bgm.volume = _musicVol;
    // 修复耳机听不到音乐的问题：iOS 微信默认遵循静音开关，
    // 导致耳机/蓝牙模式下 BGM 静音。设为 false 强制播放。
    _bgm.obeyMuteSwitch = false;

    _titleBgm = wx.createInnerAudioContext();
    _titleBgm.src = '/subpackages/asset/行香子.mp3';
    _titleBgm.loop = true;
    _titleBgm.volume = _musicVol;
    _titleBgm.obeyMuteSwitch = false;
  },

  playBgm: function () {
    if (!_musicEnabled) return;
    if (!_bgm) this.init();
    if (_titleBgm) { try { _titleBgm.pause(); } catch (e) {} }
    try { _bgm.play(); } catch (e) {}
  },

  playTitleBgm: function () {
    if (!_musicEnabled) return;
    if (!_titleBgm) this.init();
    if (_bgm) { try { _bgm.pause(); } catch (e) {} }
    try { _titleBgm.play(); } catch (e) {}
  },

  stopBgm: function () {
    if (_bgm) { try { _bgm.stop(); } catch (e) {} }
    if (_titleBgm) { try { _titleBgm.stop(); } catch (e) {} }
  },

  setMusicVol: function (v) {
    _musicVol = v;
    if (_bgm) _bgm.volume = v;
    if (_titleBgm) _titleBgm.volume = v;
  },

  setSfxVol: function (v) {
    _sfxVol = v;
  },

  setMusicEnabled: function (enabled) {
    _musicEnabled = enabled;
    if (!enabled) this.stopBgm();
  },

  setSfxEnabled: function (enabled) {
    _sfxEnabled = enabled;
  },

  playSfx: function (name) {
    if (!_sfxEnabled) return;
    var src = sfxSrc(name);
    if (!src) return;
    var s = getSfxPlayer();
    s.src = src;
    s.volume = _sfxVol;
    s.play();
  },

  // 销毁所有 BGM 和音效实例（页面卸载时调用）
  destroy: function () {
    destroyBgm(_bgm);
    destroyBgm(_titleBgm);
    _bgm = null;
    _titleBgm = null;
    for (var i = 0; i < _sfxPool.length; i++) {
      try { _sfxPool[i].destroy(); } catch (e) {}
    }
    _sfxPool = [];
    _sfxPoolIdx = 0;
  }
};

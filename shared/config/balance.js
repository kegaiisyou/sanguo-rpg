// 乱世烽火 · 数值公式（共享数据层）
// 升级曲线 + 即时历练收益（纯文字 RPG，无放置/离线收益）
(function (global) {
  var C = (global.LF && global.LF.CONSTANTS) ||
          (typeof require !== 'undefined' ? require('./constants') : {});

  // 升级所需修为：60 × 1.6^(level-1)
  function expNeed(level) {
    return Math.round(60 * Math.pow(1.6, level - 1));
  }

  global.LF = global.LF || {};
  global.LF.BALANCE = { expNeed: expNeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.BALANCE;
})(typeof window !== 'undefined' ? window : globalThis);

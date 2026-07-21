// 乱世烽火 · 数值公式（共享数据层）
// 放置类核心：升级曲线、离线收益、即时历练收益
(function (global) {
  var C = (global.LF && global.LF.CONSTANTS) ||
          (typeof require !== 'undefined' ? require('./constants') : {});

  // 升级所需修为：60 × 1.6^(level-1)，与既有 data.js 的 expNeed×1.6 一致
  function expNeed(level) {
    return Math.round(60 * Math.pow(1.6, level - 1));
  }

  // 离线收益（按设计文档 v2：操演部众放置内核暂未启用，仅保留函数定义备用，不再被调用）
  function offlineGain(save, now) {
    var last = save.lastSeen || now;
    var elapsedMin = Math.max(0, (now - last) / 60000);
    elapsedMin = Math.min(elapsedMin, C.OFFLINE_CAP_HOURS * 60);
    var xp = Math.round(elapsedMin * C.OFFLINE_XP_PER_MIN * (1 + save.level * 0.1));
    var gold = Math.round(elapsedMin * C.OFFLINE_GOLD_PER_MIN * (1 + save.level * 0.05));
    return { xp: xp, gold: gold, minutes: Math.round(elapsedMin) };
  }

  global.LF = global.LF || {};
  global.LF.BALANCE = { expNeed: expNeed, offlineGain: offlineGain };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.BALANCE;
})(typeof window !== 'undefined' ? window : globalThis);

// 乱世烽火 · 全局常量（共享数据层）
// UMD：浏览器挂到 window.LF，Node/微信端走 module.exports
(function (global) {
  var CONSTANTS = {
    GAME_NAME: '乱世烽火',
    VERSION: '0.1.0',
    OFFLINE_CAP_HOURS: 8,     // 离线收益累计上限（小时）
    TICK_MS: 1000,            // 主循环节拍（预留）
    OFFLINE_XP_PER_MIN: 2,    // 每分钟基础修为（放置收益）
    OFFLINE_GOLD_PER_MIN: 1,  // 每分钟基础银两
    MAX_LEVEL: 60
  };
  global.LF = global.LF || {};
  global.LF.CONSTANTS = CONSTANTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONSTANTS;
})(typeof window !== 'undefined' ? window : globalThis);

// 乱世烽火 · 全局常量（共享数据层）
// UMD：浏览器挂到 window.LF，Node/微信端走 module.exports
(function (global) {
  var CONSTANTS = {
    GAME_NAME: '乱世烽火',
    VERSION: '0.2.0',
    MAX_LEVEL: 60
  };
  global.LF = global.LF || {};
  global.LF.CONSTANTS = CONSTANTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONSTANTS;
})(typeof window !== 'undefined' ? window : globalThis);

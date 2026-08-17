// shared/config/ui-spec.js
// ===========================================================================
//  UI 设计规范（设计宪法）—— 所有新增界面必须遵守，尤其手机为第一场景。
//  浏览器：挂到 window.LF.UISPEC；Node / 微信端：module.exports
//
//  用途：
//   1) 作为"断点 / 触摸热区 / 配色"的单一事实来源，避免各处硬编码 560px 之类。
//   2) 让新增 UI 在 390px 视窗下自检（见 _regression/run.js）。
//   3) 给设计师 / AI 一个明确的约束集合。
// ===========================================================================
(function (global) {
  'use strict';

  var UISPEC = {
    // ---- 响应式断点（基于视窗宽度，CSS 像素） ----
    BREAKPOINTS: {
      MOBILE_MAX: 560,   // ≤560  手机（单列紧凑布局为主场景）
      TABLET_MAX: 900,   // 561–900 平板（2 列 / 居中加宽）
      DESKTOP_MIN: 901   // >900  桌面（多列 / 宽面板）
    },

    // ---- 触摸热区最小尺寸（遵循 Apple HIG ≥44 / Material ≥48） ----
    TOUCH: {
      BUTTON_MIN: 46,  // 主操作按钮最小高度 & 最小宽度（px）
      CELL_MIN: 36,    // 物品格 / 装备格最小边长（px）
      GAP_MIN: 8,      // 可点击元素之间最小间距（px）
      TAP_SLOP: 8      // 拖动判定阈值：移动超过此值视为拖动而非点击（px）
    },

    // ---- 装备品质色板（与 shared/data/items.js 的 QMAP 对应） ----
    QUALITY: {
      white:  { name: '凡品', color: '#9a948a' },
      green:  { name: '良品', color: '#3f7d5e' },
      blue:   { name: '精良', color: '#3a6ea5' },
      purple: { name: '珍稀', color: '#7d4fa3' },
      orange: { name: '神兵', color: '#b0832f' }
    },

    // ---- 通用面板配色（与 index.html 内联样式保持一致，改这里同步） ----
    COLORS: {
      PANEL_LEFT:  'rgba(86,59,107,.26)',
      PANEL_INFO:  'rgba(36,24,12,.58)',
      ACCENT_GOLD: '#d8b46a'
    },

    // ---- 工具：当前视窗档位 ----
    currentTier: function (w) {
      w = (w == null) ? (typeof window !== 'undefined' ? window.innerWidth : 0) : w;
      if (w <= UISPEC.BREAKPOINTS.MOBILE_MAX) return 'mobile';
      if (w <= UISPEC.BREAKPOINTS.TABLET_MAX) return 'tablet';
      return 'desktop';
    },
    isMobile: function (w) { return UISPEC.currentTier(w) === 'mobile'; }
  };

  global.LF = global.LF || {};
  global.LF.UISPEC = UISPEC;
  if (typeof module !== 'undefined' && module.exports) module.exports = UISPEC;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

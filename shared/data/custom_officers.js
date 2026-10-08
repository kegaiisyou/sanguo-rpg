// ═══════════════════════════════════════════════════════════════════════
// 乱世烽火 · 玩家自建武将数据文件（v20261007h）
// ───────────────────────────────────────────────────────────────────────
// 用法：
//   1. 用 tools/officer_editor.html 可视化编辑武将 → 导出代码
//   2. 把导出的 { ... } 对象粘贴进下方 CUSTOM_OFFICERS 数组
//   3. 游戏启动时 officers.js 会自动合并进武将表（无需改主程序）
//   4. 头像：填 avatar 字段（如 'npc-caocao'，或留空自动用泛用模板）
//
// 字段说明：
//   id      唯一标识（小写字母数字下划线，勿与内置武将重复）
//   name    姓名
//   title   头衔/官职
//   faction 势力 key（见下方 FACTION_KEYS）
//   home    驻城 key（须为 CITIES 中存在者）
//   loyalty 初始忠诚（0-100）
//   stats   五维 { wu武勇 zhi智略 tong统率 zheng政务 mei魅力 } 各 1-100
//   tags    特性标签数组
//   bio     列传简介
//   avatar  头像文件名（shared/img/ 下，不带前缀，如 'npc-caocao'）
// ═══════════════════════════════════════════════════════════════════════
(function (global) {
  var CUSTOM_OFFICERS = [
    // ── 示例：在此粘贴 tools/officer_editor.html 导出的武将对象 ──
    // { id:'my_hero', name:'我的英雄', title:'义士', faction:'player', home:'zhuo',
    //   loyalty:80, stats:{ wu:80, zhi:60, tong:70, zheng:50, mei:65 },
    //   tags:['义士'], bio:'乱世中崛起的一介布衣。', avatar:'npc-wufu' }
  ];
  global.LF = global.LF || {};
  global.LF.CUSTOM_OFFICERS = CUSTOM_OFFICERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = CUSTOM_OFFICERS;
})(typeof window !== 'undefined' ? window : globalThis);

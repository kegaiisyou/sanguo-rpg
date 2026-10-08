// ═══════════════════════════════════════════════════════════════════════
// 乱世烽火 · 玩家自建 NPC 数据文件（v20261007h）
// ───────────────────────────────────────────────────────────────────────
// 用法：
//   1. 用 tools/officer_editor.html 可视化编辑 NPC → 导出代码
//   2. 把导出的 { ... } 对象粘贴进下方 CUSTOM_NPC_CARDS 数组
//   3. 游戏启动时 npc_cards.js 会自动合并（无需改主程序）
//
// NPC 卡字段说明（与 npc_cards.js 同构）：
//   id       唯一标识
//   kinds    出现格型数组（如 ['market','street']）
//   icon     列表 emoji
//   role     身份标签
//   personal 是否起个人姓名（true 用姓名池）
//   gender   'm' | 'f' | 'any'
//   desc     观察描述（可用 {city} {state} 占位符）
//   says     闲谈台词池
//   avatar   头像文件名（shared/img/ 下，如 'npc-scholar'，可选）
// ═══════════════════════════════════════════════════════════════════════
(function (global) {
  var CUSTOM_NPC_CARDS = [
    // ── 示例：在此粘贴 tools/officer_editor.html 导出的 NPC 卡 ──
    // { id:'my_npc', kinds:['street'], icon:'🎐', role:'异乡人', personal:true,
    //   gender:'m', desc:'风尘仆仆的行商，谈吐间似有远方的故事。',
    //   says:['这一路风沙，可算到了 {city}。'], avatar:'npc-trader' }
  ];
  global.LF = global.LF || {};
  global.LF.CUSTOM_NPC_CARDS = CUSTOM_NPC_CARDS;
  if (typeof module !== 'undefined' && module.exports) module.exports = CUSTOM_NPC_CARDS;
})(typeof window !== 'undefined' ? window : globalThis);

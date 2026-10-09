// 乱世烽火 · 触发剧本 / 事件注册表（数据驱动）
// 由 index.html 的触发引擎（checkTriggers / runTrigger）解释执行。
//
// 两类触发器：
//   hook:'onEnter'  进入房间时评估 —— 即"场景首次访问剧本"
//   hook:'onTalk'   与某 NPC 交谈时评估 —— 即"交互剧本"
//
// 事件触发（hook:'onEnter' 或 'onTalk' 皆可）的 cond 支持复合判断：
//   时间(time) + 地点(room/roomIn/notRoom) + 地点是否有某 NPC(hasNpc)
//   + NPC 好感/属性(npcFavor) + 玩家自身属性(player) + 旗帜(flags)
//
// 效果 steps 支持：narrate / sys / log / reveal / highlight / npcTalk /
//   moveGate(可锁退路) / clearGate / event / combat / setFlag /
//   removeNpc / branch / graduate
// 任何"被追击 / 护送 / 首次到访"剧情，只需增写一份数据即可复用同一引擎。
//
// 本稿切片：苦役营·夺营五分支（moshu/officer_letter/tunnel_early/minor_ahe/minor）均已补全完整演出与毕业收束（v20260926a）。
// 出生点 = camp_tz1（见 shared/index.js defaultSave；苦役营现为 kuyilao 3×3 网格，camp_yard 旧房已删）。
(function (global) {
  var LF = global.LF = global.LF || {};
  var TRIGGERS = [];


  // 剧情表按线拆分（v20261008p）：各片段见同目录 triggers_*.js
  // 汇总顺序 = 原表顺序（序章 → 毕业引导 → 夺营前置 → 支线/夺营），勿调换；
  // 用 if 守卫，单文件缺失时不致整表崩掉。
  if (LF.pushTriggersPrologue) LF.pushTriggersPrologue(TRIGGERS);
  if (LF.pushTriggersGuide)    LF.pushTriggersGuide(TRIGGERS);
  if (LF.pushTriggersCoup)     LF.pushTriggersCoup(TRIGGERS);
  if (LF.pushTriggersSide)     LF.pushTriggersSide(TRIGGERS);


  LF.TRIGGERS = TRIGGERS;
  if (LF.SharedGame) LF.SharedGame.TRIGGERS = TRIGGERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TRIGGERS;
})(typeof window !== 'undefined' ? window : globalThis);

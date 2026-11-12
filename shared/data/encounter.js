// 战斗分层判定（v20261112b）：全仓唯一的「战棋 / RPG 回合制」判定入口。
// 设计依据：docs/02-游戏设定/05-战斗分流判定方案.md
// 纪律：舞台由「玩家意图 / 冲突性质」决定，不由兵力数字决定；
//       兵力只负责准入与编成，避免同一地点同一敌人因兵力波动而换界面。
// 本模块为纯函数、无 DOM、不读 state，故不依赖任何引擎后赋值绑定。
(function (global) {
  var LF = global.LF || (global.LF = {});

  var MODE = { RPG: 'rpg', BATTLEFIELD: 'battlefield', DUEL: 'duel' };
  var INTENT = { PERSONAL: 'personal', MILITARY: 'military' };
  var TARGET = {
    BEAST: 'beast', NPC: 'npc', BOSS: 'boss', TUTORIAL: 'tutorial',
    CITY: 'city', ARMY: 'army', SETTLEMENT: 'settlement', PASS: 'pass'
  };
  var PERSONAL_TARGETS = { beast: 1, npc: 1, boss: 1, tutorial: 1 };
  var MILITARY_TARGETS = { city: 1, army: 1, settlement: 1, pass: 1 };

  var LABEL = {
    personal: '个人战 · 凭武艺与招式决胜（DQ 回合制）',
    military: '军事行动 · 部曲列阵会战（战棋沙盘）',
    duel: '阵前斗将 · 武将过场'
  };

  // 优先级：forceMode（剧情/教学/调试显式指定）> intent > targetKind 兜底 > 默认 personal
  function resolveCombatMode(ctx) {
    ctx = ctx || {};
    var mode, intent = ctx.intent || null, reason = null;
    if (ctx.forceMode === MODE.RPG || ctx.forceMode === MODE.BATTLEFIELD || ctx.forceMode === MODE.DUEL) {
      mode = ctx.forceMode; reason = 'forceMode';
    } else {
      if (!intent) {
        if (PERSONAL_TARGETS[ctx.targetKind] === 1) { intent = INTENT.PERSONAL; reason = 'targetKind'; }
        else if (MILITARY_TARGETS[ctx.targetKind] === 1) { intent = INTENT.MILITARY; reason = 'targetKind'; }
        else { intent = INTENT.PERSONAL; reason = 'fallback'; }
      } else {
        reason = 'intent';
      }
      mode = intent === INTENT.MILITARY ? MODE.BATTLEFIELD : MODE.RPG;
    }
    return { mode: mode, intent: intent, reason: reason, label: labelOf(mode), source: ctx.source || '' };
  }

  function labelOf(mode) {
    if (mode === MODE.BATTLEFIELD) return LABEL.military;
    if (mode === MODE.DUEL) return LABEL.duel;
    return LABEL.personal;
  }

  // 战前宣告文案与判定同源，禁止在 UI 里手写第二份
  function decide(ctx) {
    var dec = resolveCombatMode(ctx);
    dec.announce = '〔本战性质〕' + dec.label;
    return dec;
  }

  LF.ENCOUNTER = {
    MODE: MODE, INTENT: INTENT, TARGET: TARGET, LABEL: LABEL,
    resolveCombatMode: resolveCombatMode, labelOf: labelOf, decide: decide
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

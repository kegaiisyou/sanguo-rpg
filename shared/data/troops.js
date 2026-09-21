// 军队 · 兵科 / 阵位 / 军令（v20260921a）
// 设计源：docs/身份势力_军队_成名_统一架构设计.md §2；战术层按「三阵位 + 军令」落地（不做格子阵型）。
// 说明：军令在战斗中作为**伪武学**注入营级单位的 artMap（CombatEngine 原样结算），
//       故战斗核心引擎无需改动；士气/自损/溃散等语义由 war.js 的回合钩子在 runPlayerPhase 之后兑现。
(function (global) {
  global.LF = global.LF || {};
  var LF = global.LF;

  // ── 七兵科（每兵数值；营级战力 = 该值 × 兵力）──
  // slot 决定可列阵位：步=前/中军，远=后军，骑=游骑，械=中军，辅=后军
  LF.TROOPS = {
    changqiang: { id: 'changqiang', name: '长枪兵', slot: '步', atk: 6, def: 8, hp: 24, spd: 14, cost: 1, upkeep: 1, desc: '结阵拒马，正面最坚，骑兵克星。' },
    daodun: { id: 'daodun', name: '刀盾兵', slot: '步', atk: 7, def: 10, hp: 28, spd: 12, cost: 1, upkeep: 1, desc: '盾厚甲坚，最耐箭矢，攻坚肉搏之选。' },
    gongnu: { id: 'gongnu', name: '弓弩兵', slot: '远', atk: 9, def: 4, hp: 18, spd: 13, cost: 1, upkeep: 1, desc: '强弩及远，先声夺人，近身则弱。' },
    qibing: { id: 'qibing', name: '骑兵', slot: '骑', atk: 11, def: 6, hp: 30, spd: 20, cost: 2, upkeep: 2, desc: '疾如风火，包抄断粮，野战之利刃。' },
    gongcheng: { id: 'gongcheng', name: '攻城兵', slot: '械', atk: 4, def: 5, hp: 22, spd: 8, cost: 1, upkeep: 1, siege: true, desc: '扛梯推车，专破城垣，野战无用。' },
    qizhong: { id: 'qizhong', name: '辎重兵', slot: '辅', atk: 1, def: 3, hp: 16, spd: 10, cost: 1, upkeep: 1, logisticsBonus: 8, desc: '押粮护械，辎重容量大增，不堪战。' },
    minfu: { id: 'minfu', name: '民夫', slot: '辅', atk: 0, def: 1, hp: 12, spd: 9, cost: 1, upkeep: 1, logisticsBonus: 5, desc: '抬担运土，可充杂役，遇战即溃。' }
  };

  // ── 三阵位 + 游骑 ──
  // front 前军：承受主要打击（敌方选靶加权，见 engine.js _pickPlayerTarget 的 guard 判定）
  // mid   中军：主力输出，也是全军士气锚
  // rear  后军：远程与辎重所在，前军不破则稳定输出
  // flank 游骑：机动，包抄/断粮/追击
  LF.ARMY_RANKS = {
    front: { id: 'front', name: '前军', icon: '🛡', note: '当先接敌，伤亡最重；守得住，后军才能放手。' },
    mid: { id: 'mid', name: '中军', icon: '⚔', note: '全军主力，进退所系；中军一乱，三军皆乱。' },
    rear: { id: 'rear', name: '后军', icon: '🏹', note: '弓弩辎重所在，前军未破则箭如雨下。' },
    flank: { id: 'flank', name: '游骑', icon: '🐎', note: '游走侧翼，可包抄、断粮、追亡逐北。' }
  };
  LF.ARMY_RANK_ORDER = ['front', 'mid', 'rear', 'flank'];

  // 兵科 → 默认阵位 / 可选阵位
  LF.TROOP_RANKS = {
    '步': { def: 'front', allow: ['front', 'mid'] },
    '远': { def: 'rear', allow: ['rear', 'mid'] },
    '骑': { def: 'flank', allow: ['flank', 'front'] },
    '械': { def: 'mid', allow: ['mid', 'rear'] },
    '辅': { def: 'rear', allow: ['rear'] }
  };

  // ── 军令（战斗中每营每回合择一）──
  // 字段：
  //   rank     限定阵位（null=不限）
  //   dmgMul   伤害倍率（0 表示不出手，走 engine 的 defend 分支）
  //   defend   true → 生成 {id:'defend'} 伪招，转成防御架势
  //   multiHit 段数（次段伤害 ×0.7）
  //   eff      CombatEngine 支持的附加效果
  //   selfDmg  自损（按最大气血比例），由 war.js 回合钩子结算
  //   moraleSelf / moraleFoe / moraleArmy  士气增减，由 war.js 回合钩子结算
  //   noTarget true → 不下达攻击目标（防御/督战类）
  LF.ARMY_ORDERS = {
    chongzhen: {
      id: 'chongzhen', name: '冲阵', rank: 'front', dmgMul: 1.7, beat: 12,
      eff: { breakDef: 0.15 }, selfDmg: 0.06, moraleSelf: -2, moraleFoe: -4,
      desc: '鼓噪直进，以命搏命——破敌阵则气势如虹，自身折损亦重。'
    },
    jianshou: {
      id: 'jianshou', name: '坚守', rank: 'front', dmgMul: 0, defend: true, noTarget: true,
      moraleSelf: 3, moraleArmy: 1,
      desc: '盾墙如林，只守不攻——稳住阵脚，全军心安。'
    },
    yashang: {
      id: 'yashang', name: '压上', rank: 'mid', dmgMul: 1.0, multiHit: 2, beat: 10,
      moraleFoe: -2, desc: '中军压上，刀盾相叠，一波接一波推过去。'
    },
    duzhan: {
      id: 'duzhan', name: '督战', rank: 'mid', dmgMul: 0, noTarget: true,
      selfBuffAtk: 0.20, selfBuffTurns: 2, moraleArmy: 4,
      desc: '主将亲立旗下，斩卒立威——三军士气大振，攻势更盛。'
    },
    qishe: {
      id: 'qishe', name: '齐射', rank: 'rear', dmgMul: 1.25, guaranteed: true, beat: 8,
      moraleFoe: -3, desc: '万弩齐发，遮天蔽日——不需瞄准，只要箭够密。'
    },
    luezhen: {
      id: 'luezhen', name: '掠阵', rank: 'rear', dmgMul: 0.6, beat: 8,
      eff: { slowChance: 0.5, slowTurns: 2 }, moraleFoe: -1,
      desc: '零星冷箭，不重杀伤，专乱敌阵脚。'
    },
    baochao: {
      id: 'baochao', name: '包抄', rank: 'flank', dmgMul: 1.35, beat: 16,
      eff: { breakDef: 0.25 }, moraleFoe: -5,
      desc: '绕出侧翼，自敌阵薄弱处杀入——破甲最利，敌心最惊。'
    },
    duanliang: {
      id: 'duanliang', name: '断粮', rank: 'flank', dmgMul: 0.3, beat: 16,
      moraleFoe: -8, moraleSelf: -1,
      desc: '焚其辎重、断其归路——杀伤不大，敌心先乱。'
    },
    zhuiji: {
      id: 'zhuiji', name: '追击', rank: 'flank', dmgMul: 1.1, multiHit: 3, beat: 18,
      desc: '敌阵已乱，纵骑逐北——溃兵之中，杀伤最丰。'
    }
  };

  // 士气分档（影响战力与溃散判定）
  LF.TROOP_MORALE_BANDS = [
    { min: 85, key: 'high', name: '士气如虹', color: '#ffd268', atkMul: 1.10 },
    { min: 65, key: 'steady', name: '士气可用', color: '#b8893a', atkMul: 1.00 },
    { min: 45, key: 'shaken', name: '士气浮动', color: '#a89370', atkMul: 0.90 },
    { min: 25, key: 'low', name: '士气低落', color: '#c0703a', atkMul: 0.75 },
    { min: 0, key: 'broken', name: '士气涣散', color: '#c0392b', atkMul: 0.55 }
  ];

  LF.moraleBand = function (m) {
    var B = LF.TROOP_MORALE_BANDS;
    for (var i = 0; i < B.length; i++) if ((m || 0) >= B[i].min) return B[i];
    return B[B.length - 1];
  };

  // ── 官职 → 全军兵力上限（呼应 LF.TITLES 官职链）──
  LF.ARMY_CAP_BY_TITLE = { '游侠': 50, '县令': 150, '太守': 400, '州牧': 800, '君主': 1500 };

  LF.armyCapOf = function (title) {
    return LF.ARMY_CAP_BY_TITLE[title || '游侠'] || 50;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.TROOPS;
})(typeof window !== 'undefined' ? window : globalThis);

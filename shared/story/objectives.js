// 乱世烽火 · 任务日志（目标追踪）数据层
// 设计原则：纯数据 + 判定函数，所有进度均从已有 state 派生（不依赖剧情、不新增计数器），
// 因此系统稳定——后续新增玩法/改流程，只要 state 字段语义不变，本层无需改动。
// check(s) 返回是否已达成；prog(s) 返回进度文案；ratio(s) 返回 0~1 进度比例（可选，用于进度条）。
// type: 'main'=主线 / 'side'=支线 / 'trial'=修行；reward: 达成奖励（xp/gold/rep）。
// s 为玩家存档（运行时即 state）。
(function (global) {
  // 与 items.js QUALITY 对齐的品质排序
  var QORDER = { white: 0, green: 1, blue: 2, purple: 3, orange: 4 };
  function bestEquipQuality(s) {
    var best = 0, name = '';
    if (s.equipment) {
      Object.keys(s.equipment).forEach(function (k) {
        var it = s.equipment[k];
        if (it && it.quality != null) {
          var q = QORDER[it.quality];
          if (q != null && q > best) { best = q; name = it.name; }
        }
      });
    }
    return { q: best, name: name };
  }
  function clamp1(x) { return Math.max(0, Math.min(1, x)); }

  var OBJECTIVES = [
    {
      id: 'slay_foe', title: '初试身手', type: 'main', reward: { xp: 50 },
      hint: '于山林巡山、讨平盗匪游散，以验证所学武艺。',
      check: function (s) { return (s.quest.bandit + s.quest.turban) > 0; },
      prog: function (s) { return '已讨匪 ' + (s.quest.bandit + s.quest.turban) + ' / 1 股'; },
      ratio: function (s) { return clamp1((s.quest.bandit + s.quest.turban) / 1); }
    },
    {
      id: 'rise_repute', title: '扬名立万', type: 'main', reward: { xp: 80, gold: 50 },
      hint: '胜战、行侠、奇遇皆可积攒江湖声望，名动一方。',
      check: function (s) { return s.reputation >= 20; },
      prog: function (s) { return '声望 ' + s.reputation + ' / 20'; },
      ratio: function (s) { return clamp1(s.reputation / 20); }
    },
    {
      id: 'join_sect', title: '择木而栖', type: 'trial', reward: { xp: 120 },
      hint: '声望初立后，点状态栏「⚔ 门派」择一门派加入，得门风加成与传功。',
      check: function (s) { return !!s.sect; },
      prog: function (s) { return s.sect ? ('已属 ' + (global.LF.SECTS[s.sect] ? global.LF.SECTS[s.sect].name : s.sect)) : '尚未加入'; },
      ratio: function (s) { return s.sect ? 1 : 0; }
    },
    {
      id: 'martial_growth', title: '武艺精进', type: 'trial', reward: { xp: 100 },
      hint: '于「武学」研习招式（消耗潜能），技艺日深。',
      check: function (s) { return s.learnedMartial.length >= 3; },
      prog: function (s) { return '已习 ' + s.learnedMartial.length + ' / 3 招'; },
      ratio: function (s) { return clamp1(s.learnedMartial.length / 3); }
    },
    {
      id: 'gear_up', title: '披坚执锐', type: 'side', reward: { xp: 80, gold: 80 },
      hint: '铁匠坊锻造、市集采买，寻得良品以上兵甲。',
      check: function (s) { return bestEquipQuality(s).q >= 1; },
      prog: function (s) { var b = bestEquipQuality(s); return b.q >= 1 ? ('已着 ' + b.name) : '尚无良品兵甲'; },
      ratio: function (s) { return bestEquipQuality(s).q >= 1 ? 1 : 0; }
    },
    {
      id: 'wealth', title: '小有资财', type: 'side', reward: { xp: 100 },
      hint: '征税、市租、贸易皆可聚财，以资军用。',
      check: function (s) { return s.gold >= 300; },
      prog: function (s) { return '库银 ' + s.gold + ' / 300'; },
      ratio: function (s) { return clamp1(s.gold / 300); }
    },
    {
      id: 'hold_city', title: '据城而定', type: 'main', reward: { xp: 300, gold: 300 },
      hint: '于军营「起兵略地」夺城，自立一方、荫及部曲。',
      check: function (s) { return (s.ruledCities && s.ruledCities.length >= 1); },
      prog: function (s) { return '已据城 ' + (s.ruledCities ? s.ruledCities.length : 0) + ' / 1'; },
      ratio: function (s) { return (s.ruledCities && s.ruledCities.length >= 1) ? 1 : 0; }
    }
  ];

  // 接取式任务定义（任务日志「进行中/已完成」）：need 用物品 id+数量，进度由背包实时派生；
  // 接取/完成由触发器 acceptQuest / completeQuest 步骤驱动，面板初始空白，接到任务才出现。
  var QUEST_DEFS = {
    stone: {
      id: 'stone', title: '采石充仓', type: 'side',
      hint: '去矿坑凿取青石，凑足五块后给予仓吏（仓库）。',
      need: [ { item: 'shitiao', name: '石料', icon: '🪨', count: 5 } ],
      submit: { npc: '仓吏', room: 'camp_warehouse' },
      reward: '便携腰包（行囊+4）· 修为+30'
    },
    zt_food: {
      id: 'zt_food', title: '寻吃食·破命数', type: 'side',
      hint: '周听涛要你寻来吃食，方肯替你窥探命数。劳役换得「劳字木片」，往伙房易食，再交予周听涛。',
      need: [ { item: 'fan', name: '吃食', icon: '🍙', count: 1 } ],
      submit: { npc: '周听涛', room: 'camp_tz1' },
      reward: '密道线索 · 修为+20'
    }
  };

  global.LF = global.LF || {};
  global.LF.OBJECTIVES = OBJECTIVES;
  global.LF.QUEST_DEFS = QUEST_DEFS;
  if (typeof module !== 'undefined' && module.exports) module.exports = OBJECTIVES;
})(typeof window !== 'undefined' ? window : globalThis);

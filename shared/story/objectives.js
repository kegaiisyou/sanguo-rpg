// 乱世烽火 · 志向（目标追踪）数据层
// 设计原则：纯数据 + 判定函数，所有进度均从已有 state 派生（不依赖剧情、不新增计数器），
// 因此系统稳定——后续新增玩法/改流程，只要 state 字段语义不变，本层无需改动。
// check(s) 返回是否已达成；prog(s) 返回进度文案。s 为玩家存档（运行时即 state）。
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

  var OBJECTIVES = [
    {
      id: 'slay_foe', title: '初试身手',
      hint: '于山林巡山、讨平盗匪游散，以验证所学武艺。',
      check: function (s) { return (s.quest.bandit + s.quest.turban) > 0; },
      prog: function (s) { return '已讨匪 ' + (s.quest.bandit + s.quest.turban) + ' 股'; }
    },
    {
      id: 'rise_repute', title: '扬名立万',
      hint: '胜战、行侠、奇遇皆可积攒江湖声望，名动一方。',
      check: function (s) { return s.reputation >= 20; },
      prog: function (s) { return '声望 ' + s.reputation + '（需 20）'; }
    },
    {
      id: 'join_sect', title: '择木而栖',
      hint: '声望初立后，点状态栏「⚔ 门派」择一门派加入，得门风加成与传功。',
      check: function (s) { return !!s.sect; },
      prog: function (s) { return s.sect ? ('已属 ' + (global.LF.SECTS[s.sect] ? global.LF.SECTS[s.sect].name : s.sect)) : '尚未加入'; }
    },
    {
      id: 'martial_growth', title: '武艺精进',
      hint: '于「武学」研习招式（消耗潜能），技艺日深。',
      check: function (s) { return s.learnedMartial.length >= 3; },
      prog: function (s) { return '已习 ' + s.learnedMartial.length + '/3 招'; }
    },
    {
      id: 'gear_up', title: '披坚执锐',
      hint: '铁匠坊锻造、市集采买，寻得良品以上兵甲。',
      check: function (s) { return bestEquipQuality(s).q >= 1; },
      prog: function (s) { var b = bestEquipQuality(s); return b.q >= 1 ? ('已着 ' + b.name) : '尚无良品'; }
    },
    {
      id: 'wealth', title: '小有资财',
      hint: '征税、市租、贸易皆可聚财，以资军用。',
      check: function (s) { return s.gold >= 300; },
      prog: function (s) { return '库银 ' + s.gold + '/300'; }
    },
    {
      id: 'hold_city', title: '据城而定',
      hint: '于军营「起兵略地」夺城，自立一方、荫及部曲。',
      check: function (s) { return (s.ruledCities && s.ruledCities.length >= 1); },
      prog: function (s) { return '已据城 ' + (s.ruledCities ? s.ruledCities.length : 0) + '/1'; }
    }
  ];

  global.LF = global.LF || {};
  global.LF.OBJECTIVES = OBJECTIVES;
  if (typeof module !== 'undefined' && module.exports) module.exports = OBJECTIVES;
})(typeof window !== 'undefined' ? window : globalThis);

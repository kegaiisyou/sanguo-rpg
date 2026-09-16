// 乱世烽火 · 统一人物数据层（v20260916d）
// ════════════════════════════════════════════════════════════════════════════
// 为什么要有这一层：
//   眼下「人」分散在 7 张互不相通的表里，各表字段各不相同——
//     ① NPC_CARDS（23 张程序卡：市井众生，一卡生成许多个）
//     ② NPC_NAMED（19 个具名：一卡一人，名字位置写死）
//     ③ ENEMIES（24 个敌人：只有 hp/atk/def/spd，没有身份）
//     ④ DIALOGUES.npcs（47 个剧情文案：只有 name/desc/lines，没有属性）
//     ⑤ COMPANION_DEFS（1 个随从：有完整战斗数值，但游戏里零接入点）
//     ⑥ travel.js 的郊野路人（只有 type + name）
//     ⑦ rooms.js 里硬编码的固定人物
//   结果是：程序 NPC 生成时**一个属性都没有**，只有名字和台词；
//   而「数值」只存在于敌人和随从身上，且两者口径不一、与主角四维也不同坐标系；
//   id 还撞车（deserter 既是程序卡又是敌人）。
//
//   本表不推翻任何一张旧表，而是**在它们之上加一层统一的人事口径**：
//   任何「人」——无论是市井小民、具名角色、敌人还是将来的关羽曹操——
//   都能查到同一套五维、同一套战斗派生、同一套分档。
//   旧表继续各自管各自擅长的事（卡管装配、dialogues 管台词、enemies 管掉落），
//   需要「这个人有多强」时，一律来问本表。
//
// 五维口径（三国志式 1-100）：
//   武勇 阵前厮杀、单挑、冲阵        智略 谋划、识破、用计
//   统率 带兵、阵型、士气            政务 农商、营造、治城
//   魅力 交游、招揽、服众
//   战斗数值**由五维派生**，不再单独维护一套 hp/atk/def/spd；
//   但敌人表里已有的字面量（如华雄 1200 血）作为 override 保留——
//   那是为了 Boss 的手感硬调的，不该被公式推平。
//
// 后续要接的三件事（本表只提供数据与算法，不动现有一行逻辑）：
//   招募闭环   好感达标 → materialize() 把实例「转正」成有完整属性的人物
//   武将面板   五维 + 分档 + 派生战力 + 归属，一屏看全
//   武将编辑器 register() 批量导入史实人物 / 虚构人物，与上方同表同源
// ════════════════════════════════════════════════════════════════════════════
(function (global) {
  if (!global.LF) global.LF = {};

  var STAT_KEYS = ['wu', 'zhi', 'tong', 'zheng', 'mei'];
  var STATS = {
    wu:    { n: '武勇', d: '阵前厮杀、单挑、统兵冲阵' },
    zhi:   { n: '智略', d: '谋划、识破、用计' },
    tong:  { n: '统率', d: '带兵、阵型、士气' },
    zheng: { n: '政务', d: '农商、营造、治城' },
    mei:   { n: '魅力', d: '交游、招揽、服众' }
  };

  // 分档（三国志式评价，90+ 才称一流，避免满屏「天才」）
  var TIERS = [
    { min: 95, n: '绝世', cls: 't-god' },
    { min: 85, n: '一流', cls: 't-great' },
    { min: 75, n: '上乘', cls: 't-good' },
    { min: 60, n: '中上', cls: 't-ok' },
    { min: 45, n: '中平', cls: 't-mid' },
    { min: 30, n: '平庸', cls: 't-low' },
    { min: 0,  n: '浅薄', cls: 't-bad' }
  ];

  // ── 程序卡五维（23 张）：一类人的基准，实例生成时按 key 微扰 ±5 ──
  // 定这些数的依据：这是「同身份的普通人」的中位数，不是英雄。
  // 门吏武勇 45 意味着比刚出营的主角（attr 5 ≈ 武勇 25）强，但打不过校尉（65）。
  var CARD_STATS = {
    gateguard:   { wu: 45, zhi: 35, tong: 40, zheng: 30, mei: 35 },   // 门吏
    porter:      { wu: 40, zhi: 25, tong: 20, zheng: 15, mei: 25 },   // 脚夫
    sentry:      { wu: 50, zhi: 35, tong: 45, zheng: 25, mei: 30 },   // 营门哨兵
    vendor:      { wu: 20, zhi: 45, tong: 25, zheng: 55, mei: 50 },   // 坐商
    hawker:      { wu: 25, zhi: 40, tong: 20, zheng: 35, mei: 55 },   // 货郎
    householder: { wu: 30, zhi: 35, tong: 25, zheng: 40, mei: 40 },   // 户主
    elder:       { wu: 10, zhi: 50, tong: 15, zheng: 35, mei: 45 },   // 老妪
    storyteller: { wu: 15, zhi: 65, tong: 20, zheng: 30, mei: 60 },   // 说书人
    beggar:      { wu: 15, zhi: 30, tong: 10, zheng: 10, mei: 20 },   // 乞儿
    civ:         { wu: 25, zhi: 35, tong: 25, zheng: 30, mei: 35 },   // 闲人
    clerk:       { wu: 20, zhi: 55, tong: 30, zheng: 65, mei: 45 },   // 主簿
    courtier:    { wu: 30, zhi: 65, tong: 40, zheng: 60, mei: 60 },   // 幕僚
    farmhead:    { wu: 35, zhi: 40, tong: 35, zheng: 55, mei: 45 },   // 庄头
    officer:     { wu: 65, zhi: 45, tong: 60, zheng: 35, mei: 45 },   // 校尉
    soldier:     { wu: 55, zhi: 30, tong: 40, zheng: 20, mei: 30 },   // 兵卒
    drillmaster: { wu: 70, zhi: 45, tong: 55, zheng: 25, mei: 40 },   // 教头
    commander:   { wu: 75, zhi: 55, tong: 75, zheng: 40, mei: 55 },   // 将领
    warden:      { wu: 50, zhi: 30, tong: 35, zheng: 25, mei: 25 },   // 狱卒
    inmate:      { wu: 40, zhi: 35, tong: 25, zheng: 20, mei: 25 },   // 囚徒
    miner:       { wu: 45, zhi: 25, tong: 25, zheng: 20, mei: 25 },   // 矿夫
    cook:        { wu: 25, zhi: 35, tong: 20, zheng: 40, mei: 40 },   // 伙夫
    storeman:    { wu: 25, zhi: 45, tong: 30, zheng: 60, mei: 35 },   // 仓吏
    deserter:    { wu: 50, zhi: 30, tong: 25, zheng: 15, mei: 20 }    // 落单溃兵
  };

  // ── 敌人五维（24 个）：野兽只有武勇（智/政为零，不入人事）──
  var ENEMY_STATS = {
    bandit:         { wu: 45, zhi: 25, tong: 30, zheng: 10, mei: 15 },
    camp_guard:     { wu: 50, zhi: 30, tong: 40, zheng: 20, mei: 25 },
    camp_dummy:     { wu: 5,  zhi: 0,  tong: 0,  zheng: 0,  mei: 0  },   // 木桩
    bandit_chief:   { wu: 60, zhi: 40, tong: 55, zheng: 20, mei: 35 },
    yellow_turban:  { wu: 45, zhi: 25, tong: 35, zheng: 15, mei: 30 },
    hua_xiong:      { wu: 92, zhi: 45, tong: 78, zheng: 30, mei: 55 },   // 华雄：全书最高武勇之一
    dummy:          { wu: 5,  zhi: 0,  tong: 0,  zheng: 0,  mei: 0  },
    stray_dog:      { wu: 25, zhi: 10, tong: 5,  zheng: 0,  mei: 0  },
    hungry_refugee: { wu: 20, zhi: 25, tong: 10, zheng: 10, mei: 15 },
    deserter:       { wu: 50, zhi: 30, tong: 25, zheng: 15, mei: 20 },
    heishan_zei:    { wu: 50, zhi: 30, tong: 35, zheng: 10, mei: 20 },
    heishan_zhu:    { wu: 68, zhi: 50, tong: 65, zheng: 25, mei: 45 },   // 黑山帅
    city_guard:     { wu: 55, zhi: 35, tong: 45, zheng: 25, mei: 30 },
    wild_wolf:      { wu: 35, zhi: 15, tong: 10, zheng: 0,  mei: 0  },
    wild_boar:      { wu: 40, zhi: 10, tong: 10, zheng: 0,  mei: 0  },
    venom_snake:    { wu: 30, zhi: 15, tong: 5,  zheng: 0,  mei: 0  },
    black_bear:     { wu: 55, zhi: 15, tong: 10, zheng: 0,  mei: 0  },
    goshawk:        { wu: 30, zhi: 20, tong: 10, zheng: 0,  mei: 0  },
    python:         { wu: 45, zhi: 15, tong: 10, zheng: 0,  mei: 0  },
    snow_wolf:      { wu: 45, zhi: 18, tong: 12, zheng: 0,  mei: 0  },
    mad_bull:       { wu: 50, zhi: 8,  tong: 10, zheng: 0,  mei: 0  },
    wolf_pack:      { wu: 40, zhi: 20, tong: 25, zheng: 0,  mei: 0  },
    tiger:          { wu: 70, zhi: 20, tong: 15, zheng: 0,  mei: 0  },
    lucky_star:     { wu: 20, zhi: 40, tong: 20, zheng: 30, mei: 50 }
  };

  // 未登记者的兜底：中庸之人
  var FALLBACK = { wu: 30, zhi: 30, tong: 30, zheng: 30, mei: 30 };

  // 编辑导入的人物（史实 / 虚构）登记在这里，与内置表同权
  var REGISTERED = {};

  // ── 稳定微扰：同卡不同人（vendor@luoyang:2,3#0）也要略有差别，但同 key 永远同一结果 ──
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function jitter(stats, key) {
    if (!key) return stats;
    var h = hashStr(String(key)), out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i], d = ((h >> (i * 5)) % 11) - 5;   // -5 ~ +5
      out[k] = Math.max(1, Math.min(100, (stats[k] || 0) + d));
    }
    return out;
  }

  // ── 战斗数值派生：五维 → hp/atk/def/spd（与主角同坐标系）──
  // 主角初始（attr 5）：maxHp 100 / atk 15 / def 20 / spd 20。
  // 校核：平民 ≈ 与刚出营的主角相当；门吏明显强一截；华雄之流则交给 override。
  function deriveCombat(stats, lv) {
    var s = stats || FALLBACK, L = Math.max(1, lv || 1) - 1;
    return {
      hp:  Math.round(30 + s.wu * 2.5 + s.tong * 1.2 + L * 12),
      atk: Math.round((3 + s.wu * 0.55 + L * 1.2) * 10) / 10,
      def: Math.round((2 + s.wu * 0.3 + s.tong * 0.25 + L * 0.8) * 10) / 10,
      spd: Math.round((3 + s.zhi * 0.25 + s.wu * 0.2 + L * 0.5) * 10) / 10
    };
  }

  function tierOf(v) {
    for (var i = 0; i < TIERS.length; i++) if (v >= TIERS[i].min) return TIERS[i];
    return TIERS[TIERS.length - 1];
  }

  // 综合战力（一句话比较强弱用；武勇为主，统率为辅）
  function powerOf(stats, lv) {
    var c = deriveCombat(stats, lv), s = stats || FALLBACK;
    return Math.round(c.hp * 0.2 + c.atk * 3 + c.def * 2 + c.spd * 1.5 + s.tong * 0.5);
  }

  // ── 统一查询：给什么都能查出五维 ──
  // 入参可以是：卡 id（'vendor'）、敌人 id（'hua_xiong'）、实例 key（'vendor@luoyang:2,3#0'）、
  // 或运行时 NPC 对象（{cardId} / {card:{id}} / {key} / {id}）
  // 实例 key（'vendor@luoyang:2,3#0'）→ 卡 id（'vendor'）；裸 id 原样返回
  function normKey(k) {
    var s = k == null ? '' : String(k);
    return s.indexOf('@') > 0 ? s.split('@')[0] : s;
  }
  function statsOf(what, opt) {
    var key = null, base = null;
    if (!what) return Object.assign({}, FALLBACK);
    if (typeof what === 'string') key = normKey(what);
    else {
      if (what.stats) return Object.assign({}, what.stats);      // 已是具名人物（自带五维）
      key = normKey(what.cardId || what.id || (what.card && what.card.id) || what.key || '');
    }
    if (key) {
      if (REGISTERED[key]) base = REGISTERED[key].stats;
      else if (CARD_STATS[key]) base = CARD_STATS[key];
      else if (ENEMY_STATS[key]) base = ENEMY_STATS[key];
    }
    if (!base) base = FALLBACK;
    // 实例（带 @ 或显式给 jitterKey）才微扰；卡 id 查询返回基准值
    var jk = (opt && opt.jitterKey) || (typeof what === 'string' && what.indexOf('@') > 0 ? what : (what && what.key));
    return jitter(Object.assign({}, base), jk);
  }

  // 战斗数值：敌人表里已有的字面量优先（override），其余用五维派生
  function combatOf(what, lv, override) {
    if (override && (override.hp != null || override.atk != null)) {
      return {
        hp: override.hp != null ? override.hp : 1,
        atk: override.atk != null ? override.atk : 1,
        def: override.def != null ? override.def : 0,
        spd: override.spd != null ? override.spd : 1
      };
    }
    return deriveCombat(statsOf(what), lv);
  }

  // ── 招募：把运行时 NPC 实例「转正」成有完整属性的人物 ──
  // 现在的实例只有「名字 + 卡 + 位置」，转正后固化五维、拿到战力，可以入册、可任官。
  // 注意：好感是玩家与「这个人」的关系，存在 state 里，不写进人物卡。
  function materialize(npc, opt) {
    opt = opt || {};
    var stats = statsOf(npc);
    var id = (npc && (npc.key || npc.cardId || npc.id)) || ('p_' + Math.random().toString(36).slice(2, 8));
    return {
      id: id,
      name: (npc && npc.name) || '',
      role: (npc && npc.role) || '',
      icon: (npc && npc.icon) || '👤',
      stats: stats,
      lv: opt.lv || 1,
      combat: deriveCombat(stats, opt.lv || 1),
      power: powerOf(stats, opt.lv || 1),
      faction: opt.faction || '在野',     // 在野 / 势力 id / 玩家势力名
      home: opt.home || null,             // {cid,x,y} 或 rid
      tags: opt.tags || [],               // 特性：忠义 / 贪财 / 善射…
      origin: opt.origin || '市井',       // 市井 / 史实 / 虚构
      joinedDay: opt.day || 0
    };
  }

  // ── 编辑导入：史实人物 / 虚构人物（武将编辑器的落点）──
  // list: [{ id,name,title,stats,tags,faction,origin,bio }]，校验后入 REGISTERED，
  // 之后 statsOf('guan_yu') 就能查到——与程序卡、敌人同表同源，无需改动任何现有代码。
  function register(list) {
    var ok = 0, bad = [];
    (list || []).forEach(function (c) {
      var err = validate(c);
      if (err) { bad.push((c && c.id || '?') + ': ' + err); return; }
      REGISTERED[c.id] = c;
      ok++;
    });
    return { ok: ok, bad: bad };
  }
  function validate(c) {
    if (!c || !c.id) return '缺 id';
    if (!c.name) return '缺 name';
    if (!c.stats) return '缺 stats';
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var v = c.stats[STAT_KEYS[i]];
      if (typeof v !== 'number' || v < 0 || v > 100) return 'stats.' + STAT_KEYS[i] + ' 须为 0-100 的数字';
    }
    return null;
  }
  function listRegistered() { return Object.keys(REGISTERED).map(function (k) { return REGISTERED[k]; }); }

  global.LF.PERSONA = {
    STAT_KEYS: STAT_KEYS, STATS: STATS, TIERS: TIERS,
    CARD_STATS: CARD_STATS, ENEMY_STATS: ENEMY_STATS,
    FALLBACK: FALLBACK,
    deriveCombat: deriveCombat, tierOf: tierOf, powerOf: powerOf,
    statsOf: statsOf, combatOf: combatOf,
    materialize: materialize,
    register: register, validate: validate, listRegistered: listRegistered
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.PERSONA;
})(typeof window !== 'undefined' ? window : globalThis);

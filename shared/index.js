// 乱世烽火 · 共享数据层聚合入口
// 浏览器：window.LF.SharedGame；Node/微信端：module.exports
(function (global) {
  var LF = global.LF = global.LF || {};

  // 四维属性 → 战斗数值换算（开局四维皆=5：气血100/攻击15/防御20/身法20；防御×4 配合新减伤模型，每点防御属性≈4%减伤）
  // 派生战力初值见 defaultSave（由 recalcBase 依据 attr+bonus 重算，此处字面量仅作占位）
  //   气血 ×20 → 气血上限；攻击 ×3 → 攻击；防御 ×4 → 防御（配合减伤模型防膨胀）；身法 ×4 → 身法
  var ATTR_RATIO = { hp:20, atk:3, def:4, spd:4 };   // 防御×4：每点防御属性换算 4 点防御战力（配合减伤模型防膨胀）

  // 默认存档：开局【无门派】——主角以"江湖散人 / 游侠"身份起事；
  //   门派（颍川义军 / 太平道 / 西凉军）为【中后期可选补充玩法】，满足条件后方可主动加入（见 joinSect）
  function defaultSave() {
    return {
      version: '0.2.0',
      name: '你',
      sect: null,                       // ⚠ 开局不属任何门派；中后期满足条件方可加入（joinSect）
      level: 1, exp: 0,
      hp: 100, maxHp: 100,
      mp: 0, maxMp: 0,                  // 内力开局锁定 0，待后期通内功心法解锁
      atk: 15, def: 20, spd: 20,        // 派生战力（由 recalcBase 依据 attr+bonus 计算；spd 初值防未重算时 NaN）
      energy: 100, maxEnergy: 100,   // 精力：行动消耗，休整恢复
      food: 100, maxFood: 100,       // 食物：随行走/时间流失
      drink: 100, maxDrink: 100,     // 饮水：随行走/时间流失
      pot: 0,                        // 潜能：历练所得，修炼武学消耗
      attr: { hp:5, atk:5, def:5, spd:5 },    // 四维（捏人可分配，每点换战力见 ATTR_RATIO）
      freePoints: 0,                          // 入局后可自由分配点数（捏人未分配完的点由 confirmCreate 转入，每升一级 +1）
      sectBonus:  { hp:0, atk:0, def:0, spd:0 }, // 门派永久战力加成
      flatBonus:  { hp:0, atk:0, def:0, spd:0 }, // 技能/事件等永久战力加成
      chivalry: 0,                   // 侠义值（P3 善恶双轨·正数轴，互不抵消）
      notoriety: 0,                  // 凶名值（P3 善恶双轨·正数轴，互不抵消）
      reputation: 0,                 // 声望 0-100（P4 起由胜战真实获取；调试台仅 ?dev=1 可直赋）
      repExp: 0,                     // 声望经验累计（后续真实途径用，先留字段）
      gold: 200,
      skills: ['basic_fist'],
      room: 'camp_yard',             // 当前所处房间（默认出生点：苦役营·劳役场，开场教学密道线入口）
      spawnRoom: 'camp_yard',        // 玩家出生点（调试台可改；新局/重置后落点）
      flags: {},
      npcFavor: {},                     // NPC 好感度表（keyed by npc id），供触发引擎复合判断
      lastSeen: Date.now(),
      time: 4,                       // 时辰索引（0子..4辰..11亥）；辰时=7:00-8:59
      clock: 442,                    // 当日分钟数 0-1439，442 = 7:22（与 time=辰时 对齐）
      eraName: '光和',               // 年号（游戏内恒定；年序由累计天数派生）
      eraYear: 1,                    // 光和元年（1=元年，2=二年…），由 day 回写
      adYear: 178,                   // 公元年（光和元年=公元178年），由 day 回写
      day: 0,                        // 游戏内累计天数（跨子夜 +1，驱动农历月日与年号递进）
      weather: 0,                    // 天候索引（见 index.html · WEATHERS）
      // ─── v0.2 战斗系统新增 ───
      spd: 20,                                  // 身法速度
      lines: {                                  // 13 武器艺线等级
        fist:0, sword:0, blade:0, spear:0, staff:0, halberd:0,
        hammer:0, whip:0, bow:0, hidden:0, ride:0, light:0, internal:0
      },
      realm: {},                                // { martialId: 境界索引(0-6) }
      lineExp: {},                              // { lineId: 经验值 }（P2 战斗出手累积）
      learnedMartial: ['beng_quan'],            // 已学招式（新武学系统）
      equippedForce: ['cun_jin'],               // 已装配发力技巧（初始带寸劲暴击）
      // ─── v0.7 格子制行囊：基础容量 6 格 + 背包槽（腰包/鞶囊可扩容） ───
      party: [],                                    // 随从同伴（每场战斗满血入场，见 startCombat）
      pack: (function () {
        var a = new Array(6).fill(null);
        a[0] = { defId:'jinchuang',   name:'金疮药',   icon:'🧪', cat:'药剂', desc:'外敷金创，止血生肌，可疗外伤五十。', count:1, effect:{hp:50} };
        a[1] = { defId:'zangbu_hat',  name:'脏布帽子', icon:'🧢', cat:'装备', slot:'hat',    desc:'一顶灰扑扑的布帽，聊胜于无。', count:1, atk:0,def:0,hp:0,mp:0,spd:0, quality:'white' };
        a[2] = { defId:'polan_stick', name:'破烂木棒', icon:'🪵', cat:'装备', slot:'weapon', desc:'枯枝胡乱削成，挥之噗噗作响，聊备一格。', count:1, atk:2,def:0,hp:0,mp:0,spd:0, quality:'white' };
        a[3] = { defId:'roubao',      name:'肉包子',   icon:'🥟', cat:'食饵', desc:'热乎包子一只，啃下可充饥解渴。', count:10, effect:{food:20,drink:5} };
        a[4] = { defId:'yaobao',      name:'便携腰包', icon:'👝', cat:'装备', slot:'belt', desc:'软皮小囊，系于腰间，多纳杂物四件。', count:1, atk:0,def:0,hp:0,mp:0,spd:0, packSpace:4,  quality:'white' };
        a[5] = { defId:'hutou',       name:'虎头鞶囊', icon:'🎒', cat:'装备', slot:'bag', desc:'虎头纹鞶囊，革坚囊阔，可容杂物二十。', count:1, atk:0,def:0,hp:0,mp:0,spd:0, packSpace:20, quality:'green' };
        return a;
      })(),                                       // 基础 6 格：可拖拽自由摆放；装备背包后扩容
      equips: [],                                 // 兼容旧字段（已并入 pack，保留避免 undefined）
      equipment: { hat:null, cloth:null, shoe:null, weapon:null, trinket:null, belt:null, bag:null }, // 六装备槽 + 背包槽
      quest: { bandit:0, turban:0, hua_xiong:false, luoyang:false }  // P4 主线进度计数
    };
  }

  // 套用门派加成（仅新建 / 读档时由 enterGame 调用一次）：
  //   —— 保留玩家【捏人 / 养成】所得的资质与战力，仅在入门时【幂等叠加】门派加成，绝不重置基础值。
  //   —— 开局 sect 为 null 时直接返回，主角保持"江湖散人"配置（含捏人资质），不被强制归入某一派。
  // 依据四维 attr + 门派/永久加成 重算派生战力（combat engine 直接读 atk/def/spd/maxHp）
  function recalcBase(s) {
    var R = ATTR_RATIO, b = s.sectBonus || {}, f = s.flatBonus || {};
    s.maxHp = s.attr.hp * R.hp + (b.hp || 0) + (f.hp || 0);
    s.atk   = s.attr.atk * R.atk + (b.atk || 0) + (f.atk || 0);
    s.def   = s.attr.def * R.def + (b.def || 0) + (f.def || 0);
    s.spd   = s.attr.spd * R.spd + (b.spd || 0) + (f.spd || 0);
    return s;
  }

  function applySect(save) {
    var sect = LF.SECTS[save.sect];
    if (!sect) { save._sectApplied = null; return save; }   // 未入门：保留玩家配置
    if (save._sectApplied === save.sect) return save;       // 已套用过，避免重载重复叠加
    save.sectBonus = save.sectBonus || { hp:0, atk:0, def:0, spd:0 };
    // 若曾入他派，先剥离旧加成
    if (save._sectApplied && LF.SECTS[save._sectApplied]) {
      var o = LF.SECTS[save._sectApplied].bonus || {};
      save.sectBonus.hp  = Math.max(0, save.sectBonus.hp  - (o.maxHp || 0));
      save.sectBonus.atk = Math.max(0, save.sectBonus.atk - (o.atk   || 0));
      save.sectBonus.def = Math.max(0, save.sectBonus.def - (o.def   || 0));
      save.sectBonus.spd = Math.max(0, save.sectBonus.spd - (o.spd   || 0));
      save.maxMp = Math.max(0, (save.maxMp || 0) - (o.maxMp || 0));
    }
    var b = sect.bonus || {};
    save.sectBonus.hp  += (b.maxHp || 0);
    save.sectBonus.atk += (b.atk   || 0);
    save.sectBonus.def += (b.def   || 0);
    save.sectBonus.spd += (b.spd   || 0);
    save.maxMp = Math.max(0, (save.maxMp || 0) + (b.maxMp || 0));
    recalcBase(save);
    save._sectApplied = save.sect;
    return save;
  }

  // 是否满足加入某门派的条件（中后期门派作为可选补充玩法，设门槛避免开局即定型）
  function canJoinSect(save, id) {
    var sect = LF.SECTS[id];
    if (!sect) return false;
    if (save.sect === id) return false;                 // 已入此门
    var req = sect.unlock || {};
    if (req.reputation != null && (save.reputation || 0) < req.reputation) return false;
    if (req.level != null && (save.level || 1) < req.level) return false;
    if (req.flag && !(save.flags && save.flags[req.flag])) return false; // 需先触发某剧情节点
    return true;
  }

  // 中后期【主动加入门派】：增量叠加、保留养成，绝不重置基础值；
  //   若已入门他派则先剥离旧加成，再套用新门派（可转投）。返回是否成功
  function joinSect(save, id) {
    if (!canJoinSect(save, id)) return false;
    save.sect = id;
    save._sectApplied = null;
    applySect(save);
    save.hp = save.maxHp; save.mp = save.maxMp;        // 入门馈赠：气血内力尽复
    _grantSectSkills(save, LF.SECTS[id]);
    return true;
  }

  function _grantSectSkills(save, sect) {
    if (!sect.startingSkills) return;
    save.skills = save.skills || [];
    save.learnedMartial = save.learnedMartial || [];
    sect.startingSkills.forEach(function (sk) {
      if (save.skills.indexOf(sk) < 0) save.skills.push(sk);
      if (save.learnedMartial.indexOf(sk) < 0) save.learnedMartial.push(sk);
    });
  }

  LF.SharedGame = {
    CONSTANTS: LF.CONSTANTS,
    SECTS: LF.SECTS,
    SKILLS: LF.SKILLS,
    EVENTS: LF.EVENTS,
    DIALOGUES: LF.DIALOGUES,
    ROOMS: LF.ROOMS,
    BALANCE: LF.BALANCE,
    MARTIAL_ARTS: LF.MARTIAL_ARTS,
    ENEMIES: LF.ENEMIES,
    ITEMS: LF.ITEMS,
    CombatEngine: LF.CombatEngine,
    CardSystem: LF.CardSystem,
    defaultSave: defaultSave,
    applySect: applySect,
    canJoinSect: canJoinSect,
    joinSect: joinSect,
    recalcBase: recalcBase,
    ATTR_RATIO: ATTR_RATIO
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.SharedGame;
})(typeof window !== 'undefined' ? window : globalThis);

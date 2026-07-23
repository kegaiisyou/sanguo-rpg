// 乱世烽火 · 共享数据层聚合入口
// 浏览器：window.LF.SharedGame；Node/微信端：module.exports
(function (global) {
  var LF = global.LF = global.LF || {};

  // 默认存档（门派加成由 applySect 在新建时套用一次）
  function defaultSave() {
    return {
      version: '0.2.0',
      name: '你',
      sect: 'yingchuan',
      level: 1, exp: 0,
      hp: 100, maxHp: 100,
      mp: 30, maxMp: 30,
      energy: 100, maxEnergy: 100,   // 精力：行动消耗，休整恢复
      food: 100, maxFood: 100,       // 食物：随行走/时间流失
      drink: 100, maxDrink: 100,     // 饮水：随行走/时间流失
      pot: 0,                        // 潜能：历练所得，修炼武学消耗
      chivalry: 0,                   // 侠义值（P3 善恶双轨·正数轴，互不抵消）
      notoriety: 0,                  // 凶名值（P3 善恶双轨·正数轴，互不抵消）
      reputation: 0,                 // 声望 0-100（P4 起由胜战真实获取；调试台仅 ?dev=1 可直赋）
      repExp: 0,                     // 声望经验累计（后续真实途径用，先留字段）
      gold: 50,
      skills: ['basic_fist'],
      room: 'ji_guomen',             // 当前所处房间（默认出生点：蓟城·郭门）
      spawnRoom: 'ji_guomen',        // 玩家出生点（调试台可改；新局/重置后落点）
      flags: {},
      lastSeen: Date.now(),
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
      items: [],                                 // 背包物品：[{id,name,count}]（P1 背包系统，消耗品类）
      equips: [],                                // 装备背包：每件独立装备对象（见 LF.ITEMS.rollEquip）
      equipment: { weapon:null, armor:null, trinket:null, mount:null }, // 已装备槽位
      quest: { bandit:0, turban:0, hua_xiong:false, luoyang:false }  // P4 主线进度计数
    };
  }

  // 套用门派加成（仅新建存档时调用一次）
  function applySect(save) {
    var sect = LF.SECTS[save.sect];
    if (!sect) return save;
    save.maxHp = 100 + (sect.bonus.maxHp || 0);
    save.maxMp = 30 + (sect.bonus.maxMp || 0);
    save.atk = 15 + (sect.bonus.atk || 0);
    save.def = 5 + (sect.bonus.def || 0);
    save.spd = 20;                       // 基础身法
    return save;
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
    defaultSave: defaultSave,
    applySect: applySect
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.SharedGame;
})(typeof window !== 'undefined' ? window : globalThis);

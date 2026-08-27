(function(global) {
  'use strict';

  // ========== 敌人数据 ==========
  // ai: aggressive(激进) | defensive(保守) | boss(Boss)
  // skills: 敌人技能列表
  // drop: 掉落表
  var ENEMIES = {

    // ─── 测试/教学用 ───
    bandit: {
      id: 'bandit', name: '山贼', title: '流窜匪徒',
      element: '土',
      hp: 300, atk: 25, def: 15, spd: 20,
      skills: [
        { id: 'slash', name: '劈砍', beat: 30, dmgMul: 1.0, desc: '举刀劈下' },
        { id: 'stone', name: '投石', beat: 35, dmgMul: 0.7, desc: '掷石扰乱',
          eff: { slowChance: 0.4, slowTurns: 2 } }
      ],
      ai: 'aggressive',
      drop: { gold: [10, 30], pot: [5, 15],
        table: [{ item: 'shengrou', name: '生肉', weight: 22 }, { item: 'shitiao', name: '石料', weight: 25 }, { item: 'mutou', name: '木头', weight: 30 }, { item: 'tiekuangshi', name: '铁矿石', weight: 12 }],
        equip: { tier: 1, chance: 35 } }
    },

    // 乌桓游骑斥候（开场教学战专用：实力强劲，以反衬老乞丐「无名掌法」之强）
    wuhuan_scout: {
      id: 'wuhuan_scout', name: '乌桓斥候', title: '游骑哨探',
      element: '金',
      hp: 240, atk: 38, def: 16, spd: 34,
      skills: [
        { id: 'scout_slash', name: '突刺', beat: 28, dmgMul: 1.0, desc: '弯刀疾刺' },
        { id: 'rider_chop', name: '跃马斩', beat: 40, dmgMul: 1.5, desc: '跃马挥刀，力劈而下',
          eff: { bleedChance: 0.3 } }
      ],
      ai: 'aggressive',
      drop: { gold: [4, 10], pot: [2, 6], table: [], equip: { tier: 0, chance: 0 } }
    },

    // ─── 中等敌人 ───
    bandit_chief: {
      id: 'bandit_chief', name: '流寇头目', title: '山寨首领',
      element: '土',
      hp: 600, atk: 40, def: 25, spd: 25,
      skills: [
        { id: 'heavy_slash', name: '重砍', beat: 40, dmgMul: 1.3, desc: '全力一刀' },
        { id: 'charge', name: '冲锋', beat: 35, dmgMul: 1.1, desc: '猛撞而来',
          eff: { stunChance: 0.3 } },
        { id: 'roar', name: '怒吼', beat: 20, dmgMul: 0, desc: '厉声咆哮',
          eff: { selfBuff: { atk: 5, turns: 3 } } }
      ],
      ai: 'aggressive',
      drop: { gold: [40, 100], pot: [15, 30],
        table: [{ item: 'blade_manual_frag', name: '刀谱残页', weight: 3 }, { item: 'shitiao', name: '石料', weight: 35 }, { item: 'zhuan', name: '砖头', weight: 25 }],
        equip: { tier: 2, chance: 50 } }
    },

    // ─── 太平道系 ───
    yellow_turban: {
      id: 'yellow_turban', name: '太平力士', title: '太平道护法',
      element: '土',
      hp: 800, atk: 50, def: 35, spd: 22,
      skills: [
        { id: 'talisman', name: '符箓·炎', beat: 35, dmgMul: 1.1, desc: '符纸化火袭向',
          attr: { wu: '火' }, eff: { burnChance: 0.4, burnDmg: 6, burnTurns: 3 } },
        { id: 'heavy_hammer', name: '金刚锤', beat: 50, dmgMul: 1.5, desc: '巨锤砸下',
          attr: { wu: '金', yin: '刚' }, eff: { stunChance: 0.35 } },
        { id: 'heal_talisman', name: '符箓·愈', beat: 25, dmgMul: 0, desc: '符光护体',
          eff: { selfHeal: 80 } }
      ],
      ai: 'defensive',
      drop: { gold: [60, 120], pot: [20, 40],
        table: [{ item: 'talisman_scrap', name: '残符', weight: 5 }], equip: { tier: 3, chance: 65 } }
    },

    // ─── Boss：华雄 ───
    hua_xiong: {
      id: 'hua_xiong', name: '华雄', title: '董卓麾下大将',
      element: '金',
      hp: 1200, atk: 60, def: 45, spd: 30,
      skills: [
        { id: 'drag_blade', name: '拖刀', beat: 40, dmgMul: 1.3, desc: '拖刀而来，刀光如练',
          attr: { wu: '金', yin: '刚' } },
        { id: 'force_split', name: '力劈华山', beat: 75, dmgMul: 2.0, desc: '纵身跃起，画戟贯顶劈下',
          attr: { yin: '刚' }, eff: { breakDef: 0.4 } },
        { id: 'fury', name: '狂怒', beat: 0, dmgMul: 0, desc: '怒发冲冠，战力暴涨',
          eff: { selfBuff: { atk: 15, spd: 8, turns: 3 } }, passive: true }
      ],
      ai: 'boss',
      drop: {
        gold: [200, 400],
        pot: [80, 100],
        table: [
          { item: 'halberd_manual_page', name: '画戟谱残页', weight: 8 },
          { item: 'war_horse_token', name: '战马令', weight: 2 }
        ], equip: { tier: 4, chance: 100 }
      }
    },

    // ─── 木人桩（测试用，不掉落） ───
    dummy: {
      id: 'dummy', name: '木人桩', title: '练功器械',
      element: '木',
      hp: 9999, atk: 0, def: 10, spd: 1,
      skills: [],
      ai: 'defensive',
      drop: { gold: [0, 0], pot: [0, 0], table: [], equip: { tier: 0, chance: 0 } }
    },

    // ─── 新手练级（出生点周边·必能打过）───
    stray_dog: {
      id: 'stray_dog', name: '野犬', title: '城外流浪恶犬',
      element: '无',
      hp: 50, atk: 6, def: 2, spd: 16,
      skills: [
        { id: 'bite', name: '扑咬', beat: 28, dmgMul: 0.9, desc: '低吼扑上，张口便咬' }
      ],
      ai: 'aggressive',
      drop: { gold: [3, 10], pot: [2, 6], table: [{ item: 'shengrou', name: '生肉', weight: 18 }], equip: { tier: 1, chance: 20 } }
    },
    hungry_refugee: {
      id: 'hungry_refugee', name: '饥饿流民', title: '饿极暴起的难民',
      element: '无',
      hp: 80, atk: 7, def: 3, spd: 14,
      skills: [
        { id: 'claw', name: '乱抓', beat: 26, dmgMul: 0.8, desc: '十指如爪，胡乱抓挠' },
        { id: 'snatch', name: '抢夺', beat: 30, dmgMul: 0.6, desc: '扑上来抢夺吃食' }
      ],
      ai: 'aggressive',
      drop: { gold: [2, 8], pot: [2, 5], table: [], equip: { tier: 1, chance: 15 } }
    },
    deserter: {
      id: 'deserter', name: '落单溃兵', title: '掉队西凉溃卒',
      element: '金',
      hp: 130, atk: 11, def: 8, spd: 18,
      skills: [
        { id: 'wild_slash', name: '怯懦挥砍', beat: 30, dmgMul: 1.0, desc: '心慌意乱，胡乱砍杀',
          eff: { slowChance: 0.2, slowTurns: 1 } },
        { id: 'cower', name: '缩身', beat: 22, dmgMul: 0, desc: '抱头缩身，勉强招架',
          eff: { selfBuff: { def: 4, turns: 2 } } }
      ],
      ai: 'defensive',
      drop: { gold: [8, 20], pot: [4, 10], table: [], equip: { tier: 1, chance: 30 } }
    },

    // ─── 黑山寨（剿匪据点） ───
    heishan_zei: {
      id: 'heishan_zei', name: '黑山寨卒', title: '黑山喽啰',
      element: '金',
      hp: 360, atk: 32, def: 18, spd: 22,
      skills: [
        { id: 'slash', name: '劈砍', beat: 30, dmgMul: 1.0, desc: '举刀劈下' },
        { id: 'jab', name: '突刺', beat: 28, dmgMul: 0.9, desc: '短矛突刺' }
      ],
      ai: 'aggressive',
      drop: { gold: [20, 50], pot: [8, 18], table: [], equip: { tier: 2, chance: 40 } }
    },
    heishan_zhu: {
      id: 'heishan_zhu', name: '黑山寨主·张燕', title: '黑山一十七部之主',
      element: '金',
      hp: 1000, atk: 58, def: 40, spd: 28,
      skills: [
        { id: 'yan_slash', name: '雁翎刀法', beat: 35, dmgMul: 1.3, desc: '刀光如燕掠', attr: { wu: '金' } },
        { id: 'charge', name: '飞燕突', beat: 30, dmgMul: 1.1, desc: '疾冲而来', eff: { stunChance: 0.3 } },
        { id: 'roar', name: '聚义怒吼', beat: 20, dmgMul: 0, desc: '鼓舞喽啰', eff: { selfBuff: { atk: 6, turns: 3 } } }
      ],
      ai: 'boss',
      drop: {
        gold: [120, 240],
        pot: [40, 70],
        table: [{ item: 'heishan_token', name: '黑山令', weight: 6 }],
        equip: { tier: 3, chance: 80 }
      }
    },

    // ─── 城防守军（攻城战专用：玩家起兵略地，胜则易帜夺城，败则城遭兵火）───
    city_guard: {
      id: 'city_guard', name: '城防守军', title: '据城死守之卒',
      element: '金',
      hp: 760, atk: 44, def: 30, spd: 24,
      skills: [
        { id: 'guard_thrust', name: '拒马刺', beat: 30, dmgMul: 1.1, desc: '长戟前刺，拒敌于阵前' },
        { id: 'guard_wall', name: '结阵', beat: 22, dmgMul: 0, desc: '收矛结阵，守御森严',
          eff: { selfBuff: { def: 6, turns: 2 } } },
        { id: 'guard_roar', name: '鼓噪', beat: 18, dmgMul: 0, desc: '擂鼓助威，士气大振',
          eff: { selfBuff: { atk: 5, spd: 4, turns: 2 } } }
      ],
      ai: 'defensive',
      drop: { gold: [30, 80], pot: [10, 25], table: [], equip: { tier: 2, chance: 30 } }
    },

    // ═══ 野兽系（野外地图·多生态试炼） ═══
    // 设计要点：覆盖 林/山/原/泽/北境 五类生境，阶 1–4；机制含冲撞(晕)、毒、减速、自Buff、连击，
    // 全部使用引擎已支持的 eff 字段（poisonChance/burnChance/stunChance/slowChance/selfBuff/multiHit），不用 bleed 等未实现字段。

    // ── 林/原·寻常野兽 ──
    wild_wolf: {
      id: 'wild_wolf', name: '野狼', title: '林间孤狼',
      element: '金',
      hp: 150, atk: 24, def: 12, spd: 22,
      skills: [
        { id: 'wolf_bite', name: '撕咬', beat: 28, dmgMul: 1.0, desc: '獠牙撕咬，血淋淋' },
        { id: 'wolf_howl', name: '狼嚎', beat: 20, dmgMul: 0, desc: '仰天长嚎，激起凶性',
          eff: { selfBuff: { atk: 5, spd: 4, turns: 2 } } }
      ],
      ai: 'aggressive',
      drop: { gold: [5, 15], pot: [3, 8], table: [{ item: 'shengrou', name: '生肉', weight: 25 }], equip: { tier: 1, chance: 20 } }
    },
    wild_boar: {
      id: 'wild_boar', name: '野猪', title: '山林蛮猪',
      element: '土',
      hp: 240, atk: 28, def: 24, spd: 9,
      skills: [
        { id: 'tusk_charge', name: '獠牙冲撞', beat: 55, dmgMul: 1.6, desc: '低首猛撞，势如奔雷', eff: { stunChance: 0.25 } },
        { id: 'gore', name: '挑刺', beat: 30, dmgMul: 1.0, desc: '獠牙上挑' }
      ],
      ai: 'aggressive',
      drop: { gold: [6, 18], pot: [3, 9], table: [{ item: 'shengrou', name: '生肉', weight: 30 }, { item: 'tiekuangshi', name: '铁矿石', weight: 8 }], equip: { tier: 1, chance: 18 } }
    },
    venom_snake: {
      id: 'venom_snake', name: '蝮蛇', title: '草泽毒蛇',
      element: '木',
      hp: 90, atk: 16, def: 6, spd: 18,
      skills: [
        { id: 'snake_bite', name: '毒牙', beat: 26, dmgMul: 0.8, desc: '毒牙噬咬', eff: { poisonChance: 0.7, poisonDmg: 7, poisonTurns: 3 } },
        { id: 'coil', name: '盘绕', beat: 22, dmgMul: 0, desc: '盘身戒备', eff: { selfBuff: { def: 3, turns: 2 } } }
      ],
      ai: 'defensive',
      drop: { gold: [2, 8], pot: [3, 7], table: [{ item: 'shengrou', name: '生肉', weight: 15 }], equip: { tier: 1, chance: 10 } }
    },

    // ── 深山/旷野·凶兽 ──
    black_bear: {
      id: 'black_bear', name: '黑熊', title: '深山巨熊',
      element: '土',
      hp: 520, atk: 46, def: 36, spd: 11,
      skills: [
        { id: 'bear_swipe', name: '熊掌挥击', beat: 35, dmgMul: 1.2, desc: '巨掌横扫，力沉势猛' },
        { id: 'bear_roar', name: '熊吼', beat: 20, dmgMul: 0, desc: '震吼示威，战力骤涨',
          eff: { selfBuff: { atk: 8, spd: 3, turns: 2 } } }
      ],
      ai: 'defensive',
      drop: { gold: [15, 40], pot: [8, 18], table: [{ item: 'shengrou', name: '生肉', weight: 35 }, { item: 'tiekuangshi', name: '铁矿石', weight: 10 }], equip: { tier: 2, chance: 30 } }
    },
    goshawk: {
      id: 'goshawk', name: '苍鹰', title: '旷野猛禽',
      element: '金',
      hp: 200, atk: 40, def: 14, spd: 34,
      skills: [
        { id: 'hawk_dive', name: '俯冲爪击', beat: 24, dmgMul: 1.3, desc: '自空俯冲，利爪攫击' },
        { id: 'hawk_rake', name: '掠爪', beat: 20, dmgMul: 0.9, desc: '双翅一振，爪痕凌厉', eff: { slowChance: 0.3, slowTurns: 2 } }
      ],
      ai: 'aggressive',
      drop: { gold: [8, 20], pot: [4, 10], table: [{ item: 'shengrou', name: '生肉', weight: 18 }], equip: { tier: 2, chance: 20 } }
    },
    python: {
      id: 'python', name: '巨蟒', title: '草泽巨蟒',
      element: '木',
      hp: 460, atk: 44, def: 28, spd: 13,
      skills: [
        { id: 'constrict', name: '绞缠', beat: 35, dmgMul: 1.2, desc: '尾身绞缠，越收越紧', eff: { slowChance: 0.5, slowTurns: 2 } },
        { id: 'venom_bite', name: '毒噬', beat: 28, dmgMul: 0.9, desc: '毒牙深噬', eff: { poisonChance: 0.6, poisonDmg: 8, poisonTurns: 3 } }
      ],
      ai: 'defensive',
      drop: { gold: [12, 30], pot: [8, 16], table: [{ item: 'shengrou', name: '生肉', weight: 25 }], equip: { tier: 2, chance: 25 } }
    },
    snow_wolf: {
      id: 'snow_wolf', name: '雪狼', title: '北境雪狼',
      element: '金',
      hp: 340, atk: 48, def: 22, spd: 30,
      skills: [
        { id: 'frost_bite', name: '霜牙', beat: 28, dmgMul: 1.2, desc: '寒牙撕咬，彻骨生寒', eff: { slowChance: 0.35, slowTurns: 2 } },
        { id: 'snow_howl', name: '雪原长嚎', beat: 20, dmgMul: 0, desc: '长嚎聚势，群狼响应',
          eff: { selfBuff: { atk: 6, spd: 5, turns: 2 } } }
      ],
      ai: 'aggressive',
      drop: { gold: [10, 28], pot: [5, 12], table: [{ item: 'shengrou', name: '生肉', weight: 22 }], equip: { tier: 2, chance: 22 } }
    },
    mad_bull: {
      id: 'mad_bull', name: '疯牛', title: '原野狂牛',
      element: '土',
      hp: 280, atk: 34, def: 26, spd: 12,
      skills: [
        { id: 'gore_charge', name: '犄角冲撞', beat: 55, dmgMul: 1.6, desc: '低头猛冲，犄角开膛', eff: { stunChance: 0.3 } }
      ],
      ai: 'aggressive',
      drop: { gold: [6, 16], pot: [4, 10], table: [{ item: 'shengrou', name: '生肉', weight: 28 }, { item: 'mutou', name: '木头', weight: 8 }], equip: { tier: 1, chance: 16 } }
    },
    wolf_pack: {
      id: 'wolf_pack', name: '群狼', title: '林间狼群',
      element: '金',
      hp: 300, atk: 40, def: 18, spd: 26,
      skills: [
        { id: 'pack_rush', name: '群狼环攻', beat: 30, dmgMul: 0.9, multiHit: 2, desc: '数狼齐扑，交相撕咬' },
        { id: 'pack_howl', name: '嚎召', beat: 20, dmgMul: 0, desc: '召集群狼，凶性大发',
          eff: { selfBuff: { atk: 5, spd: 4, turns: 2 } } }
      ],
      ai: 'aggressive',
      drop: { gold: [12, 30], pot: [6, 14], table: [{ item: 'shengrou', name: '生肉', weight: 30 }], equip: { tier: 2, chance: 25 } }
    },

    // ── 山林·兽王（Boss 级试炼） ──
    tiger: {
      id: 'tiger', name: '猛虎', title: '山林之王',
      element: '金',
      hp: 720, atk: 64, def: 38, spd: 26,
      skills: [
        { id: 'tiger_pounce', name: '猛虎扑食', beat: 60, dmgMul: 1.8, desc: '纵身扑击，爪牙交加' },
        { id: 'tiger_claw', name: '虎爪连抓', beat: 30, dmgMul: 1.1, desc: '连环抓挠，势不可挡', eff: { slowChance: 0.3, slowTurns: 2 } }
      ],
      ai: 'aggressive',
      drop: { gold: [25, 60], pot: [12, 28], table: [{ item: 'shengrou', name: '生肉', weight: 40 }], equip: { tier: 3, chance: 45 } }
    }
  };

  // ========== 辅助函数 ==========
  ENEMIES.get = function(id) { return this[id] || null; };

  // 导出
  global.LF = global.LF || {};
  global.LF.ENEMIES = ENEMIES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENEMIES;

})(typeof window !== 'undefined' ? window : globalThis);

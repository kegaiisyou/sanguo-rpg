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
      hp: 300, atk: 25, def: 15, spd: 20,
      skills: [
        { id: 'slash', name: '劈砍', beat: 30, dmgMul: 1.0, desc: '举刀劈下' },
        { id: 'stone', name: '投石', beat: 35, dmgMul: 0.7, desc: '掷石扰乱',
          eff: { slowChance: 0.4, slowTurns: 2 } }
      ],
      ai: 'aggressive',
      drop: { gold: [10, 30], pot: [5, 15], table: [], equip: { tier: 1, chance: 35 } }
    },

    // ─── 中等敌人 ───
    bandit_chief: {
      id: 'bandit_chief', name: '流寇头目', title: '山寨首领',
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
        table: [{ item: 'blade_manual_frag', name: '刀谱残页', weight: 3 }], equip: { tier: 2, chance: 50 } }
    },

    // ─── 黄巾系 ───
    yellow_turban: {
      id: 'yellow_turban', name: '黄巾力士', title: '太平道护法',
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
      hp: 9999, atk: 0, def: 10, spd: 1,
      skills: [],
      ai: 'defensive',
      drop: { gold: [0, 0], pot: [0, 0], table: [], equip: { tier: 0, chance: 0 } }
    }
  };

  // ========== 辅助函数 ==========
  ENEMIES.get = function(id) { return this[id] || null; };

  // 导出
  global.LF = global.LF || {};
  global.LF.ENEMIES = ENEMIES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENEMIES;

})(typeof window !== 'undefined' ? window : globalThis);

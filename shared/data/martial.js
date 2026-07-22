(function(global) {
  'use strict';

  // ========== 13 武器艺线 ==========
  var LINES = {
    fist:    { id:'fist',    name:'拳脚', order:1  },
    sword:   { id:'sword',   name:'剑',   order:2  },
    blade:   { id:'blade',   name:'刀',   order:3  },
    spear:   { id:'spear',   name:'枪',   order:4  },
    staff:   { id:'staff',   name:'棍',   order:5  },
    halberd: { id:'halberd', name:'戟',   order:6  },
    hammer:  { id:'hammer',  name:'锤',   order:7  },
    whip:    { id:'whip',    name:'鞭',   order:8  },
    bow:     { id:'bow',     name:'弓',   order:9  },
    hidden:  { id:'hidden',  name:'暗器', order:10 },
    ride:    { id:'ride',    name:'骑术', order:11 },
    light:   { id:'light',   name:'轻功', order:12 },
    internal:{ id:'internal',name:'内功', order:13 }
  };

  // ========== 武学境界（7 阶） ==========
  var REALMS = [
    '初窥门径','小有成','小有成就','已臻大成',
    '出神入化','登峰造极','返璞归真'
  ];

  // ========== 武学招式数据 ==========
  // type: skill=武技 | ultimate=招式(绝技) | technique=技巧(发力方式)
  // attr.wu: 五行属性 | attr.yin: 阴阳(刚/柔)
  // cost.type: null|mp|rage
  // detach: true 表示脱离型发力方式
  var MARTIAL_ARTS = {

    // ─── 拳脚 ───
    beng_quan: {
      id: 'beng_quan', name: '崩拳', line: 'fist', type: 'skill',
      beat: 25, cost: {}, dmgMul: 1.0,
      attr: { wu: null, yin: '刚' },
      desc: '基础拳法，直击面门，刚猛有力',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+10%' },
        { realm: 3, eff: '有概率附加破甲' },
        { realm: 6, eff: '伤害+30%，连击一次' }
      ]
    },

    lian_xing_tui: {
      id: 'lian_xing_tui', name: '连星腿', line: 'fist', type: 'skill',
      beat: 30, cost: { type: 'mp', val: 5 }, dmgMul: 0.85,
      attr: { wu: null, yin: '刚' },
      desc: '连环二段踢，第一腿破防、第二腿追击',
      multiHit: 2,
      learn: { lineMin: 1, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '追加第三腿' },
        { realm: 3, eff: '伤害+15%' },
        { realm: 5, eff: '第三腿必暴击' }
      ]
    },

    tie_shan_kao: {
      id: 'tie_shan_kao', name: '铁山靠', line: 'fist', type: 'skill',
      beat: 35, cost: { type: 'mp', val: 8 }, dmgMul: 1.3,
      attr: { wu: null, yin: '刚' },
      desc: '以肩背撞敌，势大力沉，有概率使敌眩晕',
      eff: { stunChance: 0.25 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 2, eff: '眩晕概率+15%' },
        { realm: 4, eff: '伤害+20%' }
      ]
    },

    du_sha_zhang: {
      id: 'du_sha_zhang', name: '毒砂掌', line: 'fist', type: 'skill',
      beat: 30, cost: { type: 'mp', val: 5 }, dmgMul: 0.7,
      attr: { wu: null, yin: '柔' },
      tec: ['毒'],
      desc: '掌蕴毒素，命中后附加持续中毒',
      eff: { poisonChance: 0.6, poisonDmg: 8, poisonTurns: 3 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },

    // ─── 剑 ───
    chuan_yun_ci: {
      id: 'chuan_yun_ci', name: '穿云刺', line: 'sword', type: 'skill',
      beat: 25, cost: { type: 'mp', val: 3 }, dmgMul: 0.9,
      attr: { wu: '金', yin: '柔' },
      desc: '剑走轻灵，直刺破空，出手极快',
      learn: { lineMin: 1, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+10%' },
        { realm: 3, eff: '暴击率+15%' }
      ]
    },

    hui_feng_liu_liu: {
      id: 'hui_feng_liu_liu', name: '回风拂柳', line: 'sword', type: 'skill',
      beat: 30, cost: { type: 'mp', val: 6 }, dmgMul: 1.0,
      attr: { wu: '木', yin: '柔' },
      desc: '剑如柳絮回风，二段柔劲',
      multiHit: 2,
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },

    // ─── 刀 ───
    heng_sao_qian_jun: {
      id: 'heng_sao_qian_jun', name: '横扫千军', line: 'blade', type: 'skill',
      beat: 40, cost: { type: 'mp', val: 10 }, dmgMul: 1.2,
      attr: { wu: '金', yin: '刚' },
      desc: '阔刀横扫，势不可挡',
      learn: { lineMin: 2, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 2, eff: '伤害+20%' },
        { realm: 4, eff: '附加破甲' }
      ]
    },

    // ─── 枪 ───
    hui_ma_qiang: {
      id: 'hui_ma_qiang', name: '回马枪', line: 'spear', type: 'ultimate',
      beat: 50, cost: { type: 'rage', val: 100 }, dmgMul: 1.8,
      attr: { wu: '金', yin: '刚' },
      desc: '佯败回身一枪，枪法精髓杀招',
      learn: { lineMin: 3, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 2, eff: '伤害+25%' },
        { realm: 5, eff: '无视防御30%' }
      ]
    },

    po_zhen_qiang: {
      id: 'po_zhen_qiang', name: '破阵枪', line: 'spear', type: 'skill',
      beat: 35, cost: { type: 'mp', val: 7 }, dmgMul: 1.1,
      attr: { wu: '金', yin: '刚' },
      desc: '长枪直贯，专破防御架势',
      eff: { breakDef: 0.3 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },

    // ─── 发力技巧（脱离型，可嵌任意武学） ───
    cun_jin: {
      id: 'cun_jin', name: '寸劲', line: 'fist', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '短距爆发劲力，装配后暴击率+20%',
      eff: { critRate: 0.20 },
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 2, eff: '暴击率+30%' },
        { realm: 5, eff: '暴击伤害+50%' }
      ]
    },

    zhen_zi_jue: {
      id: 'zhen_zi_jue', name: '震字诀', line: 'fist', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '受力反弹劲，装配后受击时反弹15%伤害',
      eff: { reflectDmg: 0.15 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },

    luo_xuan_jin: {
      id: 'luo_xuan_jin', name: '螺旋劲', line: 'fist', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '螺旋发力，装配后攻击附加30%破甲',
      eff: { armorPen: 0.30 },
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    }
  };

  // ========== 辅助函数 ==========
  MARTIAL_ARTS.get = function(id) { return this[id] || null; };

  MARTIAL_ARTS.getSkills = function() {
    var result = [];
    for (var k in this) {
      if (this[k] && this[k].type === 'skill') result.push(this[k]);
    }
    return result;
  };

  MARTIAL_ARTS.getUltimates = function() {
    var result = [];
    for (var k in this) {
      if (this[k] && this[k].type === 'ultimate') result.push(this[k]);
    }
    return result;
  };

  MARTIAL_ARTS.getTechniques = function() {
    var result = [];
    for (var k in this) {
      if (this[k] && this[k].type === 'technique') result.push(this[k]);
    }
    return result;
  };

  MARTIAL_ARTS.getDetached = function() {
    var result = [];
    for (var k in this) {
      if (this[k] && this[k].detach) result.push(this[k]);
    }
    return result;
  };

  MARTIAL_ARTS.LINES = LINES;
  MARTIAL_ARTS.REALMS = REALMS;

  // 导出
  global.LF = global.LF || {};
  global.LF.MARTIAL_ARTS = MARTIAL_ARTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = MARTIAL_ARTS;

})(typeof window !== 'undefined' ? window : globalThis);

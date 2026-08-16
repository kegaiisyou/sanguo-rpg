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

    wu_ming_quan: {
      id: 'wu_ming_quan', name: '无名拳法', line: 'fist', type: 'skill',
      beat: 20, cost: {}, dmgMul: 0.9,
      attr: { wu: null, yin: '刚' },
      desc: '老乞丐所授，平平无奇的一套拳脚，却暗合拳理根基，宜作开手根基',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+8%' },
        { realm: 3, eff: '出拳更稳，命中提升' },
        { realm: 6, eff: '伤害+25%，偶发连击' }
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
    },

    // ─── 棍 ───
    qi_mei_gun: {
      id: 'qi_mei_gun', name: '齐眉棍', line: 'staff', type: 'skill',
      beat: 25, cost: {}, dmgMul: 1.0,
      attr: { wu: '土', yin: '刚' },
      desc: '棍法根基，横扫直劈，朴实而沉稳',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+10%' },
        { realm: 3, eff: '暴击率+10%' },
        { realm: 6, eff: '伤害+25%，连击一次' }
      ]
    },
    gun_lin_qiu_yu: {
      id: 'gun_lin_qiu_yu', name: '棍林秋雨', line: 'staff', type: 'skill',
      beat: 35, cost: { type: 'mp', val: 7 }, dmgMul: 1.15,
      attr: { wu: '土', yin: '刚' },
      desc: '棍影连绵如雨，二段连打',
      multiHit: 2,
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    jin_gang_fu_di: {
      id: 'jin_gang_fu_di', name: '金刚伏地', line: 'staff', type: 'ultimate',
      beat: 50, cost: { type: 'rage', val: 100 }, dmgMul: 1.8,
      attr: { wu: '土', yin: '刚' },
      desc: '抡棍如山压下，势不可挡',
      eff: { stunChance: 0.15 },
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 戟 ───
    ji_zhan_yi_ji: {
      id: 'ji_zhan_yi_ji', name: '戟展一击', line: 'halberd', type: 'skill',
      beat: 28, cost: {}, dmgMul: 1.0,
      attr: { wu: '金', yin: '刚' },
      desc: '戟刃挑刺，刚猛直取',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+10%' },
        { realm: 3, eff: '暴击率+15%' }
      ]
    },
    fang_tian_hua_ji: {
      id: 'fang_tian_hua_ji', name: '方天画戟', line: 'halberd', type: 'skill',
      beat: 38, cost: { type: 'mp', val: 8 }, dmgMul: 1.25,
      attr: { wu: '金', yin: '刚' },
      desc: '戟尖专破防御架势',
      eff: { breakDef: 0.3 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    long_chu_qian_tan: {
      id: 'long_chu_qian_tan', name: '龙出浅滩', line: 'halberd', type: 'ultimate',
      beat: 50, cost: { type: 'rage', val: 100 }, dmgMul: 1.8,
      attr: { wu: '金', yin: '刚' },
      desc: '一戟挑天，戟法杀招',
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 锤 ───
    liu_xing_chui: {
      id: 'liu_xing_chui', name: '流星锤', line: 'hammer', type: 'skill',
      beat: 30, cost: {}, dmgMul: 1.1,
      attr: { wu: '金', yin: '刚' },
      desc: '锤势沉重，一击裂石',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+10%' },
        { realm: 3, eff: '破甲' }
      ]
    },
    kai_shan_chui: {
      id: 'kai_shan_chui', name: '开山锤', line: 'hammer', type: 'skill',
      beat: 40, cost: { type: 'mp', val: 9 }, dmgMul: 1.3,
      attr: { wu: '金', yin: '刚' },
      desc: '重锤击首，有概率震晕',
      eff: { stunChance: 0.2 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    tian_lie_di_chui: {
      id: 'tian_lie_di_chui', name: '天裂地锤', line: 'hammer', type: 'ultimate',
      beat: 52, cost: { type: 'rage', val: 100 }, dmgMul: 1.9,
      attr: { wu: '金', yin: '刚' },
      desc: '双锤砸地，天崩地裂',
      eff: { stunChance: 0.15 },
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 鞭 ───
    ruo_shui_bian: {
      id: 'ruo_shui_bian', name: '弱水鞭', line: 'whip', type: 'skill',
      beat: 26, cost: {}, dmgMul: 0.95,
      attr: { wu: '水', yin: '柔' },
      desc: '鞭走柔劲，缠身难脱',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+8%' },
        { realm: 3, eff: '连击一次' }
      ]
    },
    she_xing_bian: {
      id: 'she_xing_bian', name: '蛇行鞭', line: 'whip', type: 'skill',
      beat: 34, cost: { type: 'mp', val: 6 }, dmgMul: 1.1,
      attr: { wu: '水', yin: '柔' },
      desc: '鞭如灵蛇，二段缠绕',
      multiHit: 2,
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    wan_gou_bian: {
      id: 'wan_gou_bian', name: '万钩鞭', line: 'whip', type: 'ultimate',
      beat: 50, cost: { type: 'rage', val: 100 }, dmgMul: 1.7,
      attr: { wu: '水', yin: '柔' },
      desc: '鞭影如网，缚敌于无形',
      multiHit: 2,
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 弓 ───
    bai_bu_chuan_yang: {
      id: 'bai_bu_chuan_yang', name: '百步穿杨', line: 'bow', type: 'skill',
      beat: 28, cost: {}, dmgMul: 1.05,
      attr: { wu: '金', yin: '柔' },
      desc: '一箭离弦，百步穿杨',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+10%' },
        { realm: 3, eff: '暴击率+15%' }
      ]
    },
    lian_zhu_jian: {
      id: 'lian_zhu_jian', name: '连珠箭', line: 'bow', type: 'skill',
      beat: 34, cost: { type: 'mp', val: 6 }, dmgMul: 1.0,
      attr: { wu: '金', yin: '柔' },
      desc: '三连急射，箭箭追命',
      multiHit: 3,
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    lie_ri_leng_jian: {
      id: 'lie_ri_leng_jian', name: '烈日冷箭', line: 'bow', type: 'ultimate',
      beat: 50, cost: { type: 'rage', val: 100 }, dmgMul: 1.9,
      attr: { wu: '金', yin: '刚' },
      desc: '蓄力一箭穿心，必取敌酋',
      eff: { ignoreDef: 0.3 },
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 暗器 ───
    fei_biao: {
      id: 'fei_biao', name: '飞镖', line: 'hidden', type: 'skill',
      beat: 18, cost: {}, dmgMul: 0.8,
      attr: { wu: '金', yin: '柔' },
      desc: '出手极快，耗力极微',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+8%' },
        { realm: 3, eff: '连击一次' }
      ]
    },
    mei_hua_zhen: {
      id: 'mei_hua_zhen', name: '梅花针', line: 'hidden', type: 'skill',
      beat: 26, cost: { type: 'mp', val: 4 }, dmgMul: 0.9,
      attr: { wu: '金', yin: '柔' },
      desc: '淬毒暗器，中者身毒',
      eff: { poisonChance: 0.5, poisonDmg: 6, poisonTurns: 3 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    tian_nv_san_hua: {
      id: 'tian_nv_san_hua', name: '天女散花', line: 'hidden', type: 'ultimate',
      beat: 46, cost: { type: 'rage', val: 100 }, dmgMul: 1.6,
      attr: { wu: '金', yin: '柔' },
      desc: '满天花雨，暗器如蝗',
      multiHit: 4,
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 骑术 ───
    ben_ti_chong_zhen: {
      id: 'ben_ti_chong_zhen', name: '奔蹄冲阵', line: 'ride', type: 'skill',
      beat: 30, cost: {}, dmgMul: 1.1,
      attr: { wu: '土', yin: '刚' },
      desc: '策马冲撞，破开阵脚',
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+10%' },
        { realm: 3, eff: '破甲' }
      ]
    },
    tie_qi_ta_ying: {
      id: 'tie_qi_ta_ying', name: '铁骑踏营', line: 'ride', type: 'skill',
      beat: 40, cost: { type: 'mp', val: 9 }, dmgMul: 1.35,
      attr: { wu: '土', yin: '刚' },
      desc: '铁骑踏营，有概率踏晕敌阵',
      eff: { stunChance: 0.2 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    wan_jun_ta_di: {
      id: 'wan_jun_ta_di', name: '万钧踏地', line: 'ride', type: 'ultimate',
      beat: 52, cost: { type: 'rage', val: 100 }, dmgMul: 1.9,
      attr: { wu: '土', yin: '刚' },
      desc: '千军辟易，一踏山河动',
      eff: { stunChance: 0.15 },
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 轻功 ───
    ti_ruo_qing_yan: {
      id: 'ti_ruo_qing_yan', name: '体若轻燕', line: 'light', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '身法轻灵，装配后暴击率+15%',
      eff: { critRate: 0.15 },
      learn: { lineMin: 0, wuxing: 0, neigong: 0 }
    },
    ta_xue_wu_hen: {
      id: 'ta_xue_wu_hen', name: '踏雪无痕', line: 'light', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '步法飘忽，装配后攻击破甲+15%',
      eff: { armorPen: 0.15 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    yan_lue_fei_ti: {
      id: 'yan_lue_fei_ti', name: '燕掠飞踢', line: 'light', type: 'skill',
      beat: 28, cost: { type: 'mp', val: 5 }, dmgMul: 1.0,
      attr: { wu: '金', yin: '刚' },
      desc: '腾身而起，二段连踢',
      multiHit: 2,
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    liu_xing_zhui_yue: {
      id: 'liu_xing_zhui_yue', name: '流星追月', line: 'light', type: 'ultimate',
      beat: 48, cost: { type: 'rage', val: 100 }, dmgMul: 1.7,
      attr: { wu: '金', yin: '刚' },
      desc: '凌空连踢，如流星追月',
      multiHit: 3,
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 内功 ───
    yang_qi_jue: {
      id: 'yang_qi_jue', name: '养气诀', line: 'internal', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '内息绵长，装配后暴击率+10%',
      eff: { critRate: 0.10 },
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 2, eff: '暴击率+15%' },
        { realm: 5, eff: '暴击伤害+40%' }
      ]
    },
    xuan_yin_jue: {
      id: 'xuan_yin_jue', name: '玄阴诀', line: 'internal', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '阴柔内劲透体，装配后破甲+20%',
      eff: { armorPen: 0.20 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    hun_yuan_gong: {
      id: 'hun_yuan_gong', name: '混元功', line: 'internal', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '混元护体，装配后受击反弹20%伤害',
      eff: { reflectDmg: 0.20 },
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

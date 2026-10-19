(function(global) {
  'use strict';

  // ========== 13 武器艺线（套路：一门武学线=一套招式，攻/防/进退收于门下） ==========
  // v20261018l：成套化——每线配定位描述（kind: 外功/内功/轻功/骑术），武学录按套路卡片分组
  var LINES = {
    fist:    { id:'fist',    name:'拳脚', order:1,  kind:'外功', desc:'刚猛近身，拳拳到肉，贴身短打' },
    sword:   { id:'sword',   name:'剑',   order:2,  kind:'外功', desc:'剑走轻灵，攻守兼备，一沾即走' },
    blade:   { id:'blade',   name:'刀',   order:3,  kind:'外功', desc:'大开大合，势如破竹，以力破巧' },
    spear:   { id:'spear',   name:'枪',   order:4,  kind:'外功', desc:'长兵致远，一寸长一寸强，稳扎稳打' },
    staff:   { id:'staff',   name:'棍',   order:5,  kind:'外功', desc:'棍扫六合，守中带攻，绵密难破' },
    halberd: { id:'halberd', name:'戟',   order:6,  kind:'外功', desc:'步骑皆宜，攻防一体，势大力沉' },
    hammer:  { id:'hammer',  name:'锤',   order:7,  kind:'外功', desc:'重锤撼岳，一力降十会，破甲摧坚' },
    whip:    { id:'whip',    name:'鞭',   order:8,  kind:'外功', desc:'软鞭缠斗，借力打力，进退自如' },
    bow:     { id:'bow',     name:'弓',   order:9,  kind:'外功', desc:'百步穿杨，先手制敌，以远制近' },
    hidden:  { id:'hidden',  name:'暗器', order:10, kind:'外功', desc:'暗器无影，出其不意，防不胜防' },
    ride:    { id:'ride',    name:'骑术', order:11, kind:'骑术', desc:'马战冲阵，来去如风，威震敌胆' },
    light:   { id:'light',   name:'轻功', order:12, kind:'轻功', desc:'身法轻灵，进退迅捷，料敌机先' },
    internal:{ id:'internal',name:'内功', order:13, kind:'内功', desc:'内息吐纳，强体增力，厚积薄发' },
    // v20261018n：系统武学（绝世秘籍）——研读秘籍得技能树，逐招解锁；自成一线，不混入兵器艺线
    xuanyin: { id:'xuanyin', name:'玄阴', order:14, kind:'内功', desc:'玄阴真经所载：寒劲入骨、攻防进退俱备——绝世秘籍，非机缘不可得' }
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
      id: 'wu_ming_quan', name: '演武拳', line: 'fist', type: 'skill',
      beat: 20, cost: {}, dmgMul: 0.9,
      attr: { wu: null, yin: '刚' },
      desc: '韩铁所授，平平无奇的一套拳脚，却暗合拳理根基，宜作开手根基',
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

    tie_quan: {
      id: 'tie_quan', name: '铁拳', line: 'fist', type: 'skill',
      beat: 28, cost: {}, dmgMul: 1.2,
      attr: { wu: '金', yin: '刚' },
      desc: '铁拳谱所载外功，拳硬如铁，刚猛无俦。一拳既出，金石可裂',
      learn: { lineMin: 1, wuxing: 0, neigong: 0 },
      breakthrough: [
        { realm: 1, eff: '伤害+15%' },
        { realm: 3, eff: '有概率附加破甲' },
        { realm: 6, eff: '伤害+35%，连击一次' }
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
      maxMp: 15,
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
      maxMp: 10,
      desc: '阴柔内劲透体，装配后破甲+20%',
      eff: { armorPen: 0.20 },
      learn: { lineMin: 2, wuxing: 0, neigong: 0 }
    },
    hun_yuan_gong: {
      id: 'hun_yuan_gong', name: '混元功', line: 'internal', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      maxMp: 15,
      desc: '混元护体，装配后受击反弹20%伤害',
      eff: { reflectDmg: 0.20 },
      learn: { lineMin: 3, wuxing: 0, neigong: 0 }
    },

    // ─── 系统武学·玄阴真经（v20261018n）───
    // 绝世秘籍：研读得技能树，逐招解锁（sys.pre 前置 / sys.cost 银两 / sys.realm 境界门槛）
    // 攻防进退俱全，与低端残缺套路形成对照；招式效果全部走现有战斗机制
    xuanyin_juqi: {
      id: 'xuanyin_juqi', name: '玄阴聚气', line: 'xuanyin', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      maxMp: 15,
      desc: '玄阴真经总纲心法。阴气归元，蓄劲如弓——装配后暴击伤害+20%',
      eff: { critDmgAdd: 0.20 },
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      sys: { root: true },
      breakthrough: [
        { realm: 1, eff: '内力上限+15' },
        { realm: 3, eff: '暴击伤害+35%' },
        { realm: 6, eff: '暴击率+12%' }
      ]
    },
    xuanyin_zhi: {
      id: 'xuanyin_zhi', name: '玄阴指', line: 'xuanyin', type: 'skill',
      beat: 30, cost: { type: 'mp', val: 8 }, dmgMul: 0.95,
      attr: { wu: null, yin: '柔' },
      desc: '以阴劲透指而入，中者如堕冰窟。有概率附阴毒内伤，绵绵不绝',
      eff: { poisonChance: 0.35, poisonDmg: 8, poisonTurns: 2 },
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      sys: { pre: ['xuanyin_juqi'], cost: 200, realm: 1 },
      breakthrough: [
        { realm: 2, eff: '阴毒伤害+6' },
        { realm: 5, eff: '阴毒概率+20%' }
      ]
    },
    gui_mei_shenfa: {
      id: 'gui_mei_shenfa', name: '鬼魅身法', line: 'xuanyin', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      desc: '玄阴轻功，身如鬼魅，飘忽难测——装配后暴击率+12%',
      eff: { critRate: 0.12 },
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      sys: { pre: ['xuanyin_zhi'], cost: 300, realm: 2 }
    },
    xuanyin_huti: {
      id: 'xuanyin_huti', name: '玄阴护体', line: 'xuanyin', type: 'technique',
      beat: 0, cost: {}, dmgMul: 1.0,
      detach: true,
      maxMp: 10,
      desc: '阴劲护体，劲随敌至——装配后受击反震30%伤害',
      eff: { reflectDmg: 0.30 },
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      sys: { pre: ['xuanyin_zhi'], cost: 300, realm: 2 }
    },
    xuanyin_jiuzhuan: {
      id: 'xuanyin_jiuzhuan', name: '玄阴九转', line: 'xuanyin', type: 'ultimate',
      beat: 52, cost: { type: 'rage', val: 100 }, dmgMul: 2.0,
      attr: { wu: null, yin: '柔' },
      desc: '玄阴真经压轴绝技。阴劲九转，三连透体，防不胜防',
      multiHit: 3,
      learn: { lineMin: 0, wuxing: 0, neigong: 0 },
      sys: { pre: ['gui_mei_shenfa', 'xuanyin_huti'], cost: 800, realm: 3 },
      breakthrough: [
        { realm: 2, eff: '伤害+20%' },
        { realm: 4, eff: '阴毒缠身' },
        { realm: 6, eff: '四连阴劲' }
      ]
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

  // v20261018n：系统武学（绝世秘籍）——研读秘籍开启技能树，逐招解锁。
  // 与普通套路对照：低端武学天生残缺，系统武学攻防进退俱全但被技能树层层锁住。
  // root：研读即得的第一招；招式本身带 sys（pre/cost/realm）描述解锁条件。
  MARTIAL_ARTS.SYSTEM_SCHOOLS = {
    xuanyin: {
      line: 'xuanyin', name: '玄阴真经', kind: '内功',
      root: 'xuanyin_juqi',
      desc: '寒劲入骨、攻防进退俱全的绝世武学。研读此经，只通总纲；其余招式，须以修为与银两逐招叩开。'
    }
  };

  // v20261018l：各艺线全量招数统计（武学录套路卡片显示「门下 N 招」）
  MARTIAL_ARTS.TOTAL_BY_LINE = (function(){
    var t = {};
    for (var k in MARTIAL_ARTS) {
      if (MARTIAL_ARTS[k] && MARTIAL_ARTS[k].line) {
        var ln = MARTIAL_ARTS[k].line;
        t[ln] = (t[ln] || 0) + 1;
      }
    }
    return t;
  })();

  // v20261018f：参悟词条池（P0 参悟系统）——品质 0 白 / 1 蓝 / 2 紫，val = base + quality*step
  // key 均为战斗已消费字段：critRate/armorPen/critDmgAdd/stunChance/ignoreDef/multiHit
  var AFFIX_POOL = [
    { key: 'critRate',   name: '刚猛', base: 0.06, step: 0.04, txt: '暴击+' },
    { key: 'armorPen',   name: '破竹', base: 0.08, step: 0.05, txt: '破甲+' },
    { key: 'critDmgAdd', name: '凝神', base: 0.10, step: 0.08, txt: '暴伤+' },
    { key: 'stunChance', name: '重创', base: 0.05, step: 0.03, txt: '眩晕率+' },
    { key: 'ignoreDef',  name: '破防', base: 0.08, step: 0.05, txt: '无视防御+' },
    { key: 'multiHit',   name: '连绵', base: 1,    step: 0,    txt: '连击次数+' }
  ];
  MARTIAL_ARTS.AFFIX_POOL = AFFIX_POOL;
  MARTIAL_ARTS.AFFIX_QUALITY = ['白', '蓝', '紫'];

  // 导出
  global.LF = global.LF || {};
  global.LF.MARTIAL_ARTS = MARTIAL_ARTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = MARTIAL_ARTS;

})(typeof window !== 'undefined' ? window : globalThis);

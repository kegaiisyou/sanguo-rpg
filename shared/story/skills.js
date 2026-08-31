// 乱世烽火 · 武学树（共享数据层 · 文字放置路线）
// 树状：tier 分层，prereq 前置，cost 消耗修为，effect 永久加成
// ⚠ 注意：本文件定义的 LF.SKILLS 武学树【当前未接入任何升级/学习 UI】。
//   真正驱动战斗的招式源是 state.learnedMartial（由研习界面 MARTIAL_ARTS 写入），
//   LF.SKILLS 仅为早期遗留数据，待门派/内功系统接入时可复用，请勿误以为已生效。
(function (global) {
  var SKILLS = {
    basic_fist: {
      id: 'basic_fist', name: '基础拳脚', tier: 1,
      desc: '军中基本功，攻防皆增。', cost: 0, prereq: [],
      effect: { atk: 1, def: 1 }
    },
    tu_na: {
      id: 'tu_na', name: '吐纳法', tier: 1,
      desc: '行气导引，内力上限提升。', cost: 10, prereq: [],
      effect: { maxMp: 15 }
    },
    yingchuan_blade: {
      id: 'yingchuan_blade', name: '颍川刀法', tier: 2,
      desc: '韩伯所授，攻势如潮。', cost: 30, prereq: ['basic_fist'],
      effect: { atk: 5 }
    },
    taiping_sutra: {
      id: 'taiping_sutra', name: '太平经', tier: 2,
      desc: '太平道秘传，内力转增。', cost: 30, prereq: ['tu_na'],
      effect: { maxMp: 30, atk: 2 }
    },
    bawang_spear: {
      id: 'bawang_spear', name: '霸王枪', tier: 3,
      desc: '盖世绝学，一击破敌。', cost: 120, prereq: ['yingchuan_blade'],
      effect: { atk: 12, def: 3 }
    }
  };
  global.LF = global.LF || {};
  global.LF.SKILLS = SKILLS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SKILLS;
})(typeof window !== 'undefined' ? window : globalThis);

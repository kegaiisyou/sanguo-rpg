// 乱世烽火 · 门派设定（共享数据层 · 文字放置路线）
// 弱化美术，门派以数值倾向区分，对应颍川线背景
(function (global) {
  var SECTS = {
    yingchuan: {
      id: 'yingchuan', name: '颍川义军',
      desc: '草莽起兵，攻守均衡，最宜新手。',
      bonus: { atk: 2, def: 2, maxHp: 20 },
      startingSkills: ['basic_fist']
    },
    taiping: {
      id: 'taiping', name: '太平道',
      desc: '信奉黄天，内力深厚，擅奇术。',
      bonus: { maxMp: 30, atk: 1 },
      startingSkills: ['basic_fist', 'tu_na']
    },
    xiliang: {
      id: 'xiliang', name: '西凉军',
      desc: '边军悍勇，攻击凌厉，血厚耐战。',
      bonus: { atk: 4, maxHp: 40, def: 1 },
      startingSkills: ['basic_fist']
    }
  };
  global.LF = global.LF || {};
  global.LF.SECTS = SECTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = SECTS;
})(typeof window !== 'undefined' ? window : globalThis);

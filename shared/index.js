// 乱世烽火 · 共享数据层聚合入口
// 浏览器：window.LF.SharedGame；Node/微信端：module.exports
(function (global) {
  var LF = global.LF = global.LF || {};

  // 默认存档（门派加成由 applySect 在新建时套用一次）
  function defaultSave() {
    return {
      version: (LF.CONSTANTS && LF.CONSTANTS.VERSION) || '0.1.0',
      name: '你',
      sect: 'yingchuan',
      level: 1, exp: 0,
      hp: 100, maxHp: 100,
      mp: 30, maxMp: 30,
      atk: 15, def: 5,
      gold: 50,
      skills: ['basic_fist'],
      flags: {},
      lastSeen: Date.now()
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
    return save;
  }

  LF.SharedGame = {
    CONSTANTS: LF.CONSTANTS,
    SECTS: LF.SECTS,
    SKILLS: LF.SKILLS,
    EVENTS: LF.EVENTS,
    DIALOGUES: LF.DIALOGUES,
    BALANCE: LF.BALANCE,
    defaultSave: defaultSave,
    applySect: applySect
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.SharedGame;
})(typeof window !== 'undefined' ? window : globalThis);

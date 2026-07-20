// 乱世烽火 · 随机事件文本（共享数据层 · 文字放置路线）
// 由颍川线剧情衍生的奇遇/抉择；choices 含 effect（即时结算）与可选 cost
(function (global) {
  var EVENTS = [
    {
      id: 'ev_escapees', title: '溃兵劫掠',
      text: '一队西凉溃兵闯入村庄，抢夺粮草。村民惊惶四散。',
      choices: [
        { text: '挺身驱赶（历练）', effect: { xp: 20, gold: 10 },
          result: '你挥刀逼退溃兵，护下半个村子，乡民感念不已。' },
        { text: '隐身窥探', effect: { mp: 5 },
          result: '你隐入草垛，记下溃兵动向，内力沉稳。' }
      ]
    },
    {
      id: 'ev_hermit', title: '水镜点拨',
      text: '水镜先生立于溪畔，似在等你：「器宇不凡，可愿听老夫一言？」',
      choices: [
        { text: '恭听教诲', effect: { maxMp: 20, flag: 'buff_hermit' },
          result: '你顿觉心神澄明，内力上限提升！(内力上限+20)' },
        { text: '婉言谢过', effect: { xp: 5 },
          result: '你将这句话记在心里，继续赶路。' }
      ]
    },
    {
      id: 'ev_leftci', title: '左慈赠药',
      text: '方士左慈笑道：「疲惫了？贫道为你行气导引。」',
      choices: [
        { text: '接受调理', effect: { hp: 'full', mp: 'full' },
          result: '一阵清气流转，气血内力皆复。' },
        { text: '不必劳烦', effect: { gold: 5 },
          result: '左慈留下几枚五铢钱，飘然而去。' }
      ]
    },
    {
      id: 'ev_merchant', title: '西域行商',
      text: '西域行商摊开货物：「上好金疮药，壮士可要备上？」',
      choices: [
        { text: '购药（耗银两）', cost: { gold: 20 }, effect: { hp: 50 },
          result: '你买下伤药，气血稍复。' },
        { text: '挥手辞去', effect: {},
          result: '行商耸耸肩，继续赶路。' }
      ]
    },
    {
      id: 'ev_hanbo', title: '县尉托付',
      text: '县尉韩伯招手道：「黄巾余孽盘踞山林，壮士可愿为民除害？」',
      choices: [
        { text: '受命剿匪', effect: { xp: 30, gold: 15 },
          result: '你领了令箭，山野间连破数伙黄巾，声望渐起。' },
        { text: '容后再议', effect: { mp: 3 },
          result: '你拱手告退，暗中盘算起兵之策。' }
      ]
    }
  ];
  global.LF = global.LF || {};
  global.LF.EVENTS = EVENTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
})(typeof window !== 'undefined' ? window : globalThis);

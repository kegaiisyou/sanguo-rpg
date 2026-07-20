// 乱世烽火 · NPC 对话与序幕（共享数据层）
// 文本抽取自 wechat-game/js/data.js 颍川线，统一为可复用叙事资源
(function (global) {
  var DIALOGUES = {
    prologue: [
      '【汉灵帝中平年间 · 颍川郡】',
      '黄巾余孽肆虐乡里，烽火连天。',
      '你本是颍川一介草莽，眼见家园遭劫，遂聚众起兵。'
    ],
    npcs: {
      hanbo: {
        name: '县尉韩伯',
        lines: [
          '壮士留步！黄巾余孽肆虐乡里，颍川百姓苦不堪言……壮士可愿为民除害？',
          '黄巾贼盘踞山林，劫掠村庄。若能剿灭五伙黄巾贼，县衙必有重赏。',
          '西凉溃兵流窜至此，四处烧杀。壮士可愿再助一臂之力？'
        ]
      },
      hualao: {
        name: '医馆华老',
        lines: ['壮士请进！老夫游方至此，略通医术。行军散老夫这里备着。']
      },
      xiaowei: {
        name: '义军校尉',
        lines: ['前方就是西凉军大营！董卓虽死，其部将华雄仍在作乱。壮士此去凶险！']
      },
      zuoci: {
        name: '方士左慈',
        lines: ['贫道夜观天象……天下将乱矣。壮士若是疲惫，可在此歇息，贫道为你行气导引。']
      },
      shuijing: {
        name: '水镜先生',
        lines: ['卧龙、凤雏，得一可安天下……壮士器宇不凡，老夫赠你一言——顺势而为，可成大事。']
      }
    },
    boss: {
      name: '华雄',
      defeat: '华雄被斩！壮士真乃万人敌，关东联军必有重谢！'
    }
  };
  global.LF = global.LF || {};
  global.LF.DIALOGUES = DIALOGUES;
  if (typeof module !== 'undefined' && module.exports) module.exports = DIALOGUES;
})(typeof window !== 'undefined' ? window : globalThis);

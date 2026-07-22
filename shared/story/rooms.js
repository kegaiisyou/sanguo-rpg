// 乱世烽火 · 房间与世界地图（共享数据层 · 文字放置路线）
// 仿北大侠客行：每个房间含环境描写、在场人物、可见物品、出口方向（行走探索）
// npcs 引用 LF.DIALOGUES.npcs 的 key；actions 的 id 由 index.html 的 handleAction 执行
(function (global) {
  var ROOMS = {
    camp: {
      id: 'camp', name: '颍川主营',
      desc: [
        '颍川主营扎于旷野，旌旗半卷。新募的乡勇正操练刀枪，呼喝声震野。',
        '中军大帐前，县尉韩伯按剑而立，目光如炬；远处粮囤旗帜招展，马匹嘶鸣，烟尘渐起。'
      ],
      exits: { '北': 'city', '东': 'forest', '西': 'stream' },
      npcs: ['hanbo'],
      items: [],
      actions: [
        { id: 'learn', label: '研习武学', group: '行动', tip: '案上谱录，凝神参悟' },
        { id: 'rest', label: '帐中休整', group: '行动', tip: '盹一觉，气血内力尽复' },
        { id: 'spar_bandit', label: '入林试炼（剿山贼）', group: '行动', tip: '实战磨砺武艺' },
        { id: 'spar_chief', label: '讨伐流寇头目', group: '行动', tip: '战力验证（中等）' },
        { id: 'spar_turban', label: '征讨黄巾力士', group: '行动', tip: '符箓之力（中等）' },
        { id: 'battle_hua_xiong', label: '温酒斩华雄', group: '行动', tip: '需声望≥20·首场Boss战' },
        { id: 'visit_luoyang', label: '赴洛阳', group: '行动', tip: '需先斩华雄·扬名' }
      ]
    },
    city: {
      id: 'city', name: '颍川城',
      desc: [
        '颍川城内市集熙攘，酒肆茶楼人声鼎沸。西域胡商牵着骆驼穿行，铜铃叮当。',
        '城西医馆飘出药香，华老正捣药；街头偶有溃兵游荡，神色仓皇，似在寻机劫掠。'
      ],
      exits: { '南': 'camp' },
      npcs: ['hualao', 'yingmen'],
      items: ['行商摊上的金疮药'],
      actions: [
        { id: 'market', label: '逛市集', group: '行动', tip: '与行商交易伤药钱粮' },
        { id: 'city_patrol', label: '维持治安', group: '行动', tip: '驱赶城中溃兵' },
        { id: 'rest', label: '客栈安歇', group: '行动', tip: '酒楼歇脚，气血内力尽复' }
      ]
    },
    forest: {
      id: 'forest', name: '北邙山林',
      desc: [
        '山林幽深，古木蔽日。小径两旁荆棘丛生，偶有禽兽惊飞。',
        '黄巾余孽盘踞于此，劫掠过往行商。林深处似有营寨火光，隐闻呼喝之声。'
      ],
      exits: { '西': 'camp' },
      npcs: [],
      items: ['林间散落的五铢钱'],
      actions: [
        { id: 'patrol', label: '巡山剿匪', group: '行动', tip: '深入山林，扫荡黄巾余孽' },
        { id: 'rest', label: '林间栖身', group: '行动', tip: '倚树小憩，尽复状态' }
      ]
    },
    stream: {
      id: 'stream', name: '溪畔草庐',
      desc: [
        '一弯溪水潺潺，水镜先生立于岸畔，长须随风，似在等你。',
        '草庐简陋却洁净，竹简散落案上，茶烟袅袅；方士左慈斜倚石上，含笑不语。'
      ],
      exits: { '东': 'camp' },
      npcs: ['shuijing', 'zuoci'],
      items: [],
      actions: [
        { id: 'rest', label: '草庐借宿', group: '行动', tip: '水镜先生邀你歇脚，尽复状态' }
      ]
    },
    luoyang: {
      id: 'luoyang', name: '洛阳城',
      desc: [
        '洛阳城阙巍峨，朱雀大街车水马龙。你「温酒斩华雄」之名已传遍九州，百姓夹道相迎，孩童指你而呼「温酒斩将者」。',
        '太庙之前，老兵斟酒相敬：「壮士此战，气吞山河！」中原未平，然你已立下不世奇功，青史当留一笔。'
      ],
      exits: { '南': 'camp' },
      npcs: [],
      items: [],
      actions: [
        { id: 'rest', label: '城中休整', group: '行动', tip: '酒肆安歇，气血内力尽复' }
      ]
    }
  };

  // 出口反向校验（保证地图连通，便于后续扩展）
  global.LF = global.LF || {};
  global.LF.ROOMS = ROOMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ROOMS;
})(typeof window !== 'undefined' ? window : globalThis);

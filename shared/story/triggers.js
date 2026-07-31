// 乱世烽火 · 触发剧本 / 事件注册表（数据驱动）
// 由 index.html 的触发引擎（checkTriggers / runTrigger）解释执行。
//
// 两类触发器：
//   hook:'onEnter'  进入房间时评估 —— 即"场景首次访问剧本"
//   hook:'onTalk'   与某 NPC 交谈时评估 —— 即"交互剧本"
//
// 事件触发（hook:'onEnter' 或 'onTalk' 皆可）的 cond 支持复合判断：
//   时间(time) + 地点(room/roomIn/notRoom) + 地点是否有某 NPC(hasNpc)
//   + NPC 好感/属性(npcFavor) + 玩家自身属性(player) + 旗帜(flags)
//
// 效果 steps 支持：narrate / sys / log / reveal / highlight / npcTalk /
//   moveGate(可锁退路) / clearGate / event / combat / setFlag /
//   removeNpc / branch / graduate
// 任何"被追击 / 护送 / 首次到访"剧情，只需增写一份数据即可复用同一引擎。
(function (global) {
  var LF = global.LF = global.LF || {};
  var TRIGGERS = [];

  // ───────────────────────── 开场教学：燕山绕圈链 ─────────────────────────
  // 原硬编码的 onb 链 / tutorialBeggarTalk / onbEscape / ONB_CHAIN 平移为数据。

  // 村口·进场自动播报（苏醒段）
  TRIGGERS.push({
    id: 'intro_enter', hook: 'onEnter', room: 'ys_entrance', once: true,
    steps: [
      { t: 'narrate', room: 'ys_entrance' },
      { t: 'sys', text: '〔老乞丐就在身侧，点下方「老乞丐」与他交谈。〕' }
    ]
  });

  // 村口·老乞丐初次交谈（复用捏脸姓名；二选一性格分支先保留数据，待后续扩展）
  TRIGGERS.push({
    id: 'intro_beggar_enter', hook: 'onTalk', npc: 'beggar_old', room: 'ys_entrance', once: true,
    steps: [
      { t: 'npcTalk', npc: 'beggar_old',
        prompt: '老乞丐压着嗓子：「此地不宜久留，乌桓游骑顷刻便至——随老夫往北撤！你要如何应他？」',
        asks: [
          { label: '〔正经〕多谢前辈救命之恩，晚辈听您吩咐。', set: { favor: 1, personality: 'serious' },
            reveal: ['lower', 'loctab'],
            say: '你郑重一揖：「多谢前辈救命之恩，晚辈没齿难忘。」老乞丐嗬嗬一笑：「小乞丐还挺有良心——少客套，保命要紧！」' },
          { label: '〔懵圈〕我……这是哪里？我怎会在此？', set: { personality: 'transmigrator' },
            reveal: ['lower', 'loctab'],
            say: '你捂着脑袋：「我……这是哪里？」老乞丐一愣：「甭管哪，保命要紧！随老夫往北撤——点下头罗盘上的『北』。」' }
        ] },
      { t: 'highlight', layer: 'lower' },
      { t: 'sys', text: '〔已点亮下方「移动」罗盘与位置名——往「北」便是北巷。〕' }
    ]
  });

  // 北巷·老乞丐问名姓（复用玩家捏脸填写的姓名；新增"报名"选项）
  TRIGGERS.push({
    id: 'intro_beggar_north', hook: 'onTalk', npc: 'beggar_old', room: 'ys_north', once: true,
    steps: [
      { t: 'reveal', layer: 'status', highlight: true },
      { t: 'sys', text: '〔顶部「状态栏」已点亮——气血 / 内力 / 时辰常驻在此。〕' },
      { t: 'npcTalk', npc: 'beggar_old',
        prompt: '老乞丐敲你脑壳：「先看清你自个光景——盯住上头『状态栏』。对了，你叫什么名儿？」',
        asks: [
          { label: '〔报名〕我叫{{name}}，敢问前辈尊号？', set: { favor: 1 },
            say: '老乞丐哈哈一笑：「名号？喊我老乞丐便罢。{{name}}，记下了——东北那头是猎棚，随我来，别落单。」' },
          { label: '〔胡诌〕（随口报了个名。）',
            say: '你支吾报了名。老乞丐皱眉：「这叫什么名儿？罢了罢了，活下来再说——东北那头是猎棚，随我来。」' },
          { label: '〔沉默〕（闷声不答。）',
            say: '你闷不吭声。老乞丐摆手：「哑巴也好，少惹眼——东北那头是猎棚，随我来。」' }
        ] }
    ]
  });

  // 燕山链·进场即锁退路（被乌桓游骑追，只能往前进；数据由 ONB_CHAIN 推导）
  TRIGGERS.push({
    id: 'intro_chain_gate', hook: 'onEnter',
    roomIn: ['ys_entrance', 'ys_north', 'ys_ne', 'ys_east', 'ys_se', 'ys_south', 'ys_sw', 'ys_west', 'ys_nw'],
    once: false,
    cond: { notFlag: 'flags.onb.done' },
    steps: [ { t: 'moveGate', fromChain: true } ]
  });

  // 猎棚·脚本化教学战斗
  TRIGGERS.push({
    id: 'intro_battle', hook: 'onEnter', room: 'ys_ne', once: true,
    cond: { notFlag: 'flags.onb.tcDone' },
    steps: [ { t: 'combat', tutorial: true } ]
  });

  // 山口·逃脱收尾（按好感决定老乞丐去留，开启全图）
  TRIGGERS.push({
    id: 'intro_escape', hook: 'onEnter', room: 'yanshan_shankou', once: true,
    steps: [
      { t: 'narrate', lines: [
        '二人沿乱石径疾奔，身后号角愈急。老乞丐忽然将你往隘口一推：「进了山口便是白檀屯寨，亭长盘查归盘查，总比落进乌桓手里强！」',
        '你跌撞冲出隘口，回望时，老乞丐反身迎向追兵，枯瘦的背影立在风口，如一截老树。',
        '火把与喊杀声渐渐远去——你们甩掉了追兵。'
      ] },
      { t: 'branch', if: { npcFavor: { key: 'beggar_old', min: 1 } },
        then: [
          { t: 'log', cls: 'npc', npc: '老乞丐', text: '老乞丐也踱出隘口，拍拍身上灰：「俺这把老骨头，便留在燕山口罢。日后你回此歇脚，俺给你看门。」' },
          { t: 'log', cls: 'good', text: '〔老乞丐自此常驻燕山山口，可随时与他交谈。〕' }
        ],
        else: [
          { t: 'removeNpc', key: 'beggar_old' },
          { t: 'log', cls: 'npc', npc: '老乞丐', text: '老乞丐摆摆手，没入夜色：「小子，自个儿闯去罢。江湖路远，好自为之。」' },
          { t: 'log', cls: 'sys', text: '〔老乞丐就此离去，未留在燕山山口。〕' }
        ] },
      { t: 'setFlag', path: 'flags.onb.done', value: true },
      { t: 'clearGate' },
      { t: 'graduate' }
    ]
  });

  // ─────────────────── 事件触发模板（示例，当前不自动触发） ───────────────────
  // 演示"时间 + 地点 + 是否有某 NPC + NPC 好感 + 玩家属性"的复合判断：
  // TRIGGERS.push({
  //   id: 'ev_example_night_meet', hook: 'onEnter',
  //   cond: {
  //     time: { day: false },                 // 夜间
  //     roomIn: ['ji_guomen','yanshan_shankou'],
  //     hasNpc: 'beggar_old',                 // 地点存在老乞丐
  //     npcFavor: { key:'beggar_old', min:2 },// 好感≥2
  //     player: { chivalry:{ min:10 } }       // 玩家侠义≥10
  //   },
  //   once: false,
  //   steps: [
  //     { t:'moveGate', lockBack:true, hint:'夜色沉沉，老乞丐低声：「先别走，有要事。」' },
  //     { t:'npcTalk', npc:'beggar_old', prompt:'老乞丐：「……」',
  //       asks:[ { label:'听他说', say:'……', then:[ {t:'event', id:'ev_righteous'} ] } ] },
  //     { t:'clearGate' }
  //   ]
  // });

  // 逃亡途中（onb 未结束）常驻催促：避免老乞丐在中间房间"哑火"只剩态度台词
  TRIGGERS.push({
    id: 'beggar_flee', hook: 'onTalk', npc: 'beggar_old', once: false,
    roomIn: ['ys_entrance','ys_north','ys_ne','ys_east','ys_se','ys_south','ys_sw','ys_west','ys_nw'],
    cond: { notFlag: 'flags.onb.done' },
    steps: [
      { t: 'log', cls: 'npc', npc: '老乞丐', text: '老乞丐压低嗓子：「别停，贴着我走——乌桓的探子就在后头，快往前！」' }
    ]
  });

  // 山口常驻（onb 结束后）：老乞丐留守燕山口，可随时交谈（常驻 NPC 交互模板，可复用）
  TRIGGERS.push({
    id: 'beggar_ambient', hook: 'onTalk', npc: 'beggar_old', room: 'yanshan_shankou', once: false,
    cond: { flags: { 'onb.done': true } },
    steps: [
      { t: 'npcTalk', npc: 'beggar_old',
        prompt: '老乞丐盘腿坐在隘口石上：「{{name}}，走累了便在此歇脚。还有啥要问老夫的？」',
        asks: [
          { label: '前辈守着燕山口，可知如今天下情势？',
            say: '老乞丐嗬嗬一笑：「乌桓退了，可豪强并起——白檀屯寨的亭长比官还横。你自个儿留神，莫撞枪口。」' },
          { label: '（拱手告辞）', say: '你朝老乞丐一拱手，转身去了。' }
        ] }
    ]
  });

  LF.TRIGGERS = TRIGGERS;
  if (LF.SharedGame) LF.SharedGame.TRIGGERS = TRIGGERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TRIGGERS;
})(typeof window !== 'undefined' ? window : globalThis);

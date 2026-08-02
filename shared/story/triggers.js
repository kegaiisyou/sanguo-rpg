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
      { t: 'sys', text: '〔雪地、断墙、满身血痂……你记不起自己是谁，只知方才险些死了。点下方「老乞丐」与他交谈，听他交代去处。〕' },
      { t: 'reveal', layer: 'npc' }
    ]
  });

  // 村口·老乞丐初次交谈（复用捏脸姓名；性格分支先保留数据，待后续扩展）
  TRIGGERS.push({
    id: 'intro_beggar_enter', hook: 'onTalk', npc: 'beggar_old', room: 'ys_entrance', once: true,
    steps: [
      { t: 'npcTalk', npc: 'beggar_old',
        prompt: '老乞丐将你往墙根一按，枯眼里映着雪光：「此地不宜久留——乌桓游骑顷刻便至，老夫方才从乱兵刀下把你拖回这条命。随老夫往北撤，你要如何应？」',
        asks: [
          { label: '〔正经〕多谢前辈救命之恩，晚辈听您吩咐。', set: { favor: 1, personality: 'serious' },
            reveal: ['lower', 'loctab'],
            say: '你挣扎起身，郑重一揖：「多谢前辈救命之恩，晚辈没齿难忘。」老乞丐嗬嗬一笑：「小乞丐还挺有良心——少客套，保命要紧！下头这圈罗盘便是「移动」，往『北』是北巷，先奔那儿去。」' },
          { label: '〔懵圈〕我……这是哪里？我怎会在此？', set: { personality: 'transmigrator' },
            reveal: ['lower', 'loctab'],
            say: '你捂着脑袋：「我……这是哪里？我怎会在此？」老乞丐一愣，随之摆手：「甭管哪——保命要紧！老夫拖你回来的路上，乌桓的火把就没断过。下头这圈罗盘是「移动」，点『北』，咱们先撤到北巷。」' }
        ] },
      { t: 'highlight', layer: 'lower' },
      { t: 'sys', text: '〔已点亮下方「移动」罗盘——上北下南、左西右东，点亮的方位才能去；灰暗的是被追兵堵死的回头路。先点「北」前往北巷。〕' }
    ]
  });

  // 北巷·老乞丐问名姓（复用玩家捏脸填写的姓名；三选项决定状态栏解锁与好感）
  // 注：状态栏不在村口点亮，等到此处「问名」由三个选项分别解锁，呼应"先别显状态栏"的需求
  // 问名设为「必经」：选完即写入 flags.onb.named，并立即解锁东北前进（见 gate_north_name）
  TRIGGERS.push({
    id: 'intro_beggar_north', hook: 'onTalk', npc: 'beggar_old', room: 'ys_north', once: true,
    steps: [
      { t: 'npcTalk', npc: 'beggar_old',
        prompt: '老乞丐敲你脑壳：「小子，你叫什么名儿？老夫总不能一路喊你『喂』。报上名来——往后行走江湖，这名头要紧。」',
        asks: [
          { label: '〔报名〕我叫{{name}}，敢问前辈尊号？', set: { favor: 1, 'flags.onb.named': true }, reveal: ['status'], highlight: 'status',
            say: '老乞丐哈哈一笑：「名号？喊我老乞丐便罢。{{name}}，记下了——」他兴致上来，抬手指着你头顶：「你且认得这『状态栏』（顶栏）：左首是你名号，其右是时辰与十二辰刻，再右是年号年序与农历月日，最右是天色风雨。气血内力不在此栏，而在🧭「角色」与临敌的人物卡上——气血是你性命，红了便是伤重；内力用来施展招式。时辰关系天色与遭遇，有些事只在特定时辰现。东边那头便是猎棚，随老夫来，别落单。」' },
          { label: '〔反问〕前辈，如今是哪朝哪代？', set: { favor: -1, 'flags.onb.named': true }, reveal: ['status'], highlight: 'status',
            say: '老乞丐一愣，摇摇头：「哪朝哪代？老夫流落江湖大半生，早不记这些了。你自个点开头顶那『状态栏』——时辰、年号历法都写着哩，不必问我。顶栏只显名号、时辰、年号与天色；气血内力要瞧🧭「角色」。既问了，便与老夫同去东边猎棚，路上再与你细说。」' },
          { label: '〔沉默〕（闷声不答。）', set: { favor: -1, 'flags.onb.named': true }, reveal: ['status'], highlight: 'status',
            say: '老乞丐摆摆手：「也罢，出门在外，本不该轻信他人。你既不愿说，老夫不勉强——但头顶这『状态栏』你须认得：左首名号，右列时辰、年号历法与天色。气血内力不在此栏，要瞧🧭「角色」与战斗人物卡。往后行走江湖，先看清自个光景。东边那头是猎棚，随老夫来。」' }
        ] },
      { t: 'moveGate', fromChain: true }   // 问名完成→立即解锁东北前进（罗盘实时刷新）
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

  // 北巷·问名必经：未问名前锁住所有出口，逼玩家先与老乞丐交谈报名（牺牲跳过自由度，确保状态栏必现）
  // 必须排在 intro_chain_gate 之后，否则会被其 fromChain 的 fwd 覆盖
  TRIGGERS.push({
    id: 'gate_north_name', hook: 'onEnter', room: 'ys_north', once: false,
    cond: { flags: { 'flags.onb.done': false, 'flags.onb.named': false } },
    steps: [
      { t: 'moveGate', fwd: '__block__', hint: '老乞丐叉腰拦在棚口：「小子，连名儿都不报，休想往前——先与老夫问名！」' }
    ]
  });

  // 猎棚·屏息避敌 → 教学战斗（真实战斗引擎，演示攻击/防御/道具/撤退）
  TRIGGERS.push({
    id: 'intro_battle', hook: 'onEnter', room: 'ys_ne',
    cond: { notFlag: 'flags.onb.tcDone' },
    steps: [
      // 好感反馈：问名时态度（健谈/冷淡）在此轻微体现
      { t: 'branch', if: { npcFavor: { key: 'beggar_old', min: 1 } },
        then: [ { t: 'log', cls: 'env', text: '老乞丐见你跟来，眉眼舒展：「{{name}}，你倒是听劝——且贴着我，莫声张。」' } ],
        else: [ { t: 'log', cls: 'env', text: '老乞丐瞥你一眼，神色淡淡的：「既跟来了，便贴着我，莫添乱。」' } ] },
      { t: 'npcTalk', npc: 'beggar_old',
        prompt: '老乞丐忽然将你往棚后一按，枯指点着你眉心，气声里压着急：「屏息——外头有马嘶，是乌桓的哨探巡过来了。莫出声，莫乱动。」',
        asks: [
          { label: '（屏息贴墙，一动不动。）',
            say: '你屏住呼吸，后背紧贴冰凉的棚壁。棚外蹄声由远及近，在几步外停住、盘旋，嗅了半晌，终是拨转马头去了。老乞丐长舒一口气：「好小子，沉得住气。」' },
          { label: '（忍不住探头张望。）',
            say: '你刚一探头，便撞上一名乌桓游骑的视线！他咧嘴怪叫，弯刀一勒马便扑了过来——老乞丐骂了声「笨」，反手将你护在身后：「既叫你瞧见了，便教你怎么动手！」' }
        ] },
      { t: 'combat', enemy: 'wuhuan_scout', tutorial: true }
    ]
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

  // 山口·新手引导（毕业後首次交谈）：讲解行囊非战斗用药 + 任务系统，并交付第一个新手任务
  TRIGGERS.push({
    id: 'tut_world_guide', hook: 'onTalk', npc: 'beggar_old', room: 'yanshan_shankou', once: true,
    cond: { flags: { 'flags.onb.done': true, 'quest.tut': false } },
    steps: [
      { t: 'log', cls: 'env', text: '老乞丐就着风口坐下，拍拍身边石墩：「既出了山，江湖的门道也得知晓几分。」' },
      { t: 'log', cls: 'env', text: '「其一，行囊：点下头🎒「行囊」，选中物件按「使用」。非战时服药可疗伤、回内力；暗器唯有临敌方能伤人——平日带了也施展不出。」' },
      { t: 'log', cls: 'env', text: '「其二，任务：点📜「任务」可看主线进度与所托之事；顶栏状态点开能看时辰历法。气血内力不在顶栏，而在🧭「角色」与战斗人物卡上。」' },
      { t: 'log', cls: 'env', text: '「其三，眼下有桩小事托你：我那老相识在白檀军屯当差。你既往南去，替我捎个口信、探探动静；到了白檀，自有人接应。回头与我说一声便好。」' },
      { t: 'setFlag', path: 'quest.tut', value: 'accepted' },
      { t: 'log', cls: 'sys', text: '〔任务〕新手·送信白檀：从燕山口往南赴白檀军屯，探看老乞丐的相识（点📜任务可追踪）。' }
    ]
  });

  // 新手任务·送信白檀：到达白檀军屯即完成任务并发放奖励
  TRIGGERS.push({
    id: 'tut_quest_done', hook: 'onEnter', room: 'baitan_tun', once: true,
    cond: { flags: { 'quest.tut': 'accepted' } },
    steps: [
      { t: 'log', cls: 'env', text: '你到白檀军屯，交割了老乞丐的口信——其老相识拍拍你肩，塞来几枚铜钱与一瓶伤药作谢。' },
      { t: 'grant', gold: 30, rep: 3, items: [{ id: 'jinchuang', name: '金疮药', count: 1, cat: '药剂', effect: { hp: 120 } }] },
      { t: 'setFlag', path: 'quest.tut', value: 'done' },
      { t: 'log', cls: 'sys', text: '〔任务〕新手·送信白檀 ✓ 已完成（奖励：铜钱+30 · 江湖声望+3 · 金疮药×1）。回燕山口与老乞丐一说，他便知晓。' }
    ]
  });

  // 山口常驻（onb 结束后、且已接下新手任务）：老乞丐留守燕山口，可随时交谈（常驻 NPC 交互模板，可复用）
  TRIGGERS.push({
    id: 'beggar_ambient', hook: 'onTalk', npc: 'beggar_old', room: 'yanshan_shankou', once: false,
    cond: { flags: { 'flags.onb.done': true, 'quest.tut': true } },
    steps: [
      // 好感反馈：问名时结下的善缘/冷淡，在此延续
      { t: 'branch', if: { npcFavor: { key: 'beggar_old', min: 1 } },
        then: [ { t: 'log', cls: 'env', text: '老乞丐见是你，咧嘴一笑：「{{name}}，来啦？坐下烤烤火，外头风雪大。」' } ],
        else: [ { t: 'log', cls: 'env', text: '老乞丐淡淡一点头：「是你。坐罢，隘口风大，莫久站。」' } ] },
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

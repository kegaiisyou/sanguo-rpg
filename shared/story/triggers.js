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
//
// 本稿切片：苦役营·密道线（单路线，其余 9 条路线待后续扩展）。
// 出生点 = camp_yard（见 shared/index.js defaultSave）。
(function (global) {
  var LF = global.LF = global.LF || {};
  var TRIGGERS = [];

  // ───────────────────────── 开场教学：苦役营·密道线 ─────────────────────────

  // 1) 牢房·开场（P0 · v20260911g）：本触发器在【序章开场动画演毕、牢房渲染完成】后才评估。
  //    动画本身由 core/engine.js · playPrologue() 在全屏 #prologue 幕布上演出（见 index.html / game.css）；
  //    新档进入时 enterGame 先播动画，动画结束时才 renderRoom → 到这里正好是「角色已被推进牢房」。
  //    此处只负责：点亮交互界面 → 铁链/尘土 → 周听涛开口 → 锁死牢门（叩门问答见 laotou_door）。
  TRIGGERS.push({
    id: 'camp_opening', hook: 'onEnter', room: 'camp_tz1', once: false,
    // once:false：旧存档若遗留 trg.camp_cell_enter=true，仍会拦住补播；置 false 后仅由 prologueShown 旗标控制（只播一次）
    cond: { notFlag: 'flags.onb.prologueShown' },
    steps: [
      { t: 'reveal', layer: 'npc' },
      { t: 'reveal', layer: 'lower' },
      { t: 'reveal', layer: 'actions' },
      { t: 'log', cls: 'sys', text: '铁链啷当，你被推进牢里，扬起的尘土呛得你睁不开眼。' },
      { t: 'log', cls: 'env', text: '牢门在身后轰然合拢，镣铐沉沉坠着手脚。尘土自门缝墙隙里翻涌而起——栅外天光只剩一线。' },
      { t: 'log', cls: 'npc', text: '栅里忽地响起一个拖长腔的嗓子：「话说天下大势，分久必合，合久必分，某夜观天象，大汉四百年气数将尽———欸，奇了怪了，你这新来的，变数多到我都看不清哇」' },
      { t: 'log', cls: 'sys', text: '你被迷眼的尘土呛得睁不开，只觉栅外有人影晃动，却看不清是谁。〔左侧「对话」可寻那嗓音的主人；栅上「牢门」可叩问牢头（锁着时才能叩）。〕' },
      { t: 'moveGate', fwd: '__locked__', hint: '牢门紧锁，须先与牢头说通，方可出牢。' },
      { t: 'setFlag', path: 'flags.onb.prologueShown', value: true }
    ]
  });

  // 2.2) 首次担石劳作：记一次劳作体验，并顺带点亮状态栏 + 位置页签（自然的「干完活才看自身状态」时刻）
  TRIGGERS.push({
    id: 'labor_first', hook: 'onCustom', room: 'kuyilao', cell: [1,1], once: true,
    cond: { notFlag: 'flags.onb.labored' },
    steps: [
      { t: 'log', cls: 'sys', text: '你扛起乱石，肩头火辣。日头毒辣，囚徒如蚁，狱卒皮鞭声在身后炸响——这便是苦役营的日夜。' },
      { t: 'setFlag', path: 'flags.onb.labored', value: true },
      { t: 'reveal', layer: 'status' },
      { t: 'reveal', layer: 'loctab' }
    ]
  });

  // 2.5) 环顾四周（勘察劳役场）：揭示去路，自然引导（不明示去向，留玩家自由探索）
  TRIGGERS.push({
    id: 'survey_yard', hook: 'onCustom', room: 'kuyilao', cell: [1,1], once: true,
    cond: { flags: { 'flags.onb.labored': true }, notFlag: 'flags.onb.surveyed' },
    steps: [
      { t: 'log', cls: 'sys', text: '你环顾劳役场：西边塌了半截的墙根，藤蔓爬墙——那是营墙的缺口，风里带着外面的草木腥气；东南角一道低矮门洞，通向囚室，里头囚徒横七竖八。狱卒往来，各处出口皆被看死，唯有那塌墙根透着几分松动。' },
      { t: 'setFlag', path: 'flags.onb.surveyed', value: true },
      { t: 'sys', text: '你记下了几处去路。场中那讲古的蓬头囚徒似乎藏了不少门道，若有闲，再凑近听听也无妨。' }
    ]
  });

  // 2) 周听涛·说书人+相士底：初次交谈，自介并发布「寻吃食」任务
  TRIGGERS.push({
    id: 'zt_intro', hook: 'onTalk', npc: 'zhoutingtao', room: 'camp_tz1', once: true,
    cond: { notFlag: 'flags.task.zt_intro' },
    steps: [
      { t: 'setFlag', path: 'flags.task.zt_intro', value: true },
      { t: 'acceptQuest', id: 'zt_food' },
      { t: 'npcTalk', npc: 'zhoutingtao',
        prompt: '尘埃稍落，你才看清栅里那人：蓬头垢面，满身碎布条与旧伤痕，眼神却清亮。他捋了捋乱发，拖长腔道：「某周听涛，可是天下间数一数二的相士——」忽又压低嗓子：「你这新来的，眼中被迷了尘，看不清人影，却瞒不过老夫的招子。你命数古怪，似一颗我看不透的变数。」',
        asks: [
          { label: '〔请教先生〕', say: '周听涛敲了敲栅栏：「老夫替人窥命数，向来要些酬劳——你且去营中寻些吃食来。待你寻来，老夫便替你把这道乱命，寻出一丝破解之法。」〔任务：寻来吃食，交予周听涛。〕' }
        ] }
    ]
  });

  // 2.5) 周听涛·交吃食→破命数（接取「寻吃食」后，持干粮来交付，授密道线）
  //   仅在身上确有「吃食(fan)」时才拦截对话；否则放行给普通 talk()，轮播周听涛的台词。
  //   （旧版无条件拦截 → 每次对话都只重复「吃食还没寻来」，台词全被吞——v20260911f 修复）
  TRIGGERS.push({
    id: 'zt_food_deliver', hook: 'onTalk', npc: 'zhoutingtao', room: 'camp_tz1', once: false,
    cond: { flags: { 'flags.task.zt_intro': true }, hasItem: 'fan', notFlag: 'flags.route.crypt' },
    steps: [
      { t: 'npcTalk', npc: 'zhoutingtao',
        prompt: '你将从伙房换来的干粮递过去。周听涛眼睛一亮，也不客气，三两口扒了半张饼，这才正色道：「好，这桩吃食老夫领了——既食人之禄，便替你掐一掐这乱如麻的命数。」',
        asks: [
          { label: '〔静候先生掐算〕', set: { 'flags.route.crypt': true },
            then: [
              { t: 'consume', id: 'fan', n: 1 },
              { t: 'completeQuest', id: 'zt_food' },
              { t: 'setFlag', path: 'flags.task.zt_food_done', value: true },
              { t: 'log', cls: 'good', text: '周听涛屈指掐算，半晌忽一笑：「果然……你这命格，乱中藏变。营后塌墙根下有暗道，默叔替老夫守着。夜里随我来——记着，塌墙根，寻默叔。」〔已得密道线索：先去囚室寻默叔对暗号，再赴塌墙根钻暗道。〕' }
            ] }
        ] }
    ]
  });

  // 3) 牢门门禁：叩门→牢头问答，是才开门（moveGate 锁死全出口，开门即清）
  //    v20260911g：开门此刻不再点亮顶栏——「顶上时辰」改在出牢后牢头指更鼓时一并介绍（见 laotou_corridor）。
  TRIGGERS.push({
    id: 'laotou_door', hook: 'onTalk', npc: 'laotou', room: 'camp_tz1', once: false,
    cond: { notFlag: 'flags.onb.cellOpen' },
    steps: [
      { t: 'npcTalk', npc: 'laotou',
        prompt: '你叩了叩牢门。栅外传来粗哑嗓门：「谁在那头敲？哦——新来的囚籍。少在里头装蒜，想通了没，要不要出来干活？」',
        asks: [
          { label: '想通了，求牢头放我出去干活', set: { 'flags.onb.cellOpen': true },
            then: [
              { t: 'clearGate' },
              { t: 'log', cls: 'order', text: '牢头「咔哒」开了锁：「出来罢。去廊口候着，老子有话交代。」〔栅门开了，〔南〕可出牢房。〕' }
            ] },
          { label: '再想想，暂不出门', say: '牢头「呸」了一声：「不识抬举！想通透了再来敲。」栅外脚步声远了。〔牢门仍锁着。〕' }
        ] }
    ]
  });

  // 3.5) 牢头·出场后三话题（税赋/悲苦/天字一号疯子）
  TRIGGERS.push({
    id: 'laotou_topics', hook: 'onTalk', npc: 'laotou', roomIn: ['camp_tz1','kuyilao'], once: false,
    cond: { flags: { 'flags.onb.cellOpen': true } },
    steps: [
      { t: 'npcTalk', npc: 'laotou',
        prompt: '牢头抱着臂，斜眼打量你。',
        asks: [
          { label: '〔打听因何入营〕', say: '牢头嗤笑：「你当自己犯了什么大罪？呸，不过是交不起租赋，被衙役当壮丁抓来抵数。这年头，十室九空，税比刀狠。」' },
          { label: '〔问外头光景〕', say: '牢头朝墙外啐了一口：「外面？也好不到哪去。蝗灾旱灾接连着来，太平道那帮人趁机蛊惑，到处都是饿殍。蹲在这营里，反倒落个温饱。」' },
          { label: '〔问隔壁牢房〕', say: '牢头压低声：「隔壁天字一号那厮，天天自言自语，疯疯癫癫——你莫去招惹。前儿他还冲着墙比划，嘴里念叨『甲子』『苍天』的胡话，邪门得紧。」' }
        ] }
    ]
  });

  // 3.2) 走廊·更鼓与点卯（P1 · v20260911g）：出牢后首次到牢廊（城格 kuyilao 1,0）
  //   —— 教程里「时间系统」的亮相节拍就在此处，顺序严格照设计走：
  //       ① 牢头指着廊口那面「值更鼓」，喝你去前头干活、并交代「几点前必须回来」；
  //       ② 说到鼓，顺势讲营里的时辰（十二时辰、卯时开牢、戌时闭门）；
  //       ③ 这一刻才点亮顶部状态栏（顶上「时辰」）+ 位置页签，并高亮顶栏；
  //       ④ clockOn 置位 = 时间正式开始流动（点卯/晚归判定随之生效）。
  //   注：出门不再单发旁白（与牢头台词重复）——场景描写并入 npcTalk 提示词，一次讲完。
  //   注：铺垫/收尾一律用 log（同步 next），勿用 narrate（会阻塞其后的 npcTalk，见 §9.61）。
  TRIGGERS.push({
    id: 'laotou_corridor', hook: 'onEnter', room: 'kuyilao', cell: [1, 0], once: true,
    cond: { notFlag: 'flags.onb.curfewSet' },
    steps: [
      { t: 'reveal', layer: 'npc' },
      { t: 'reveal', layer: 'lower' },
      { t: 'reveal', layer: 'actions' },
      { t: 'npcTalk', npc: 'laotou',
        prompt: '你刚迈出牢门，廊口便杵着个歪戴幞头的牢头，手里转着一串铁钥匙，眯眼打量你这身囚服，啧了一声。他抬下巴朝廊上那面蒙着旧皮的鼓一努：「瞧见那面更鼓没有？营里没有漏刻，全营的钟点，都靠它一槌一槌敲出来。别在廊下晃——去前头劳役场给老子干活，戌时前，你必须回这牢门销名。」',
        asks: [
          { label: '〔看那更鼓〕这鼓，怎么讲时辰？', then: [
            { t: 'log', cls: 'npc', text: '牢头嗤笑：「一昼夜十二时辰，鼓声一回一换：卯时开牢放风，戌时鸣鼓闭门。过了戌时你还不回，按营规吃三鞭，门一落锁，你便蹲到明日。」' },
            { t: 'reveal', layer: 'status', highlight: true },
            { t: 'reveal', layer: 'loctab' },
            { t: 'log', cls: 'order', text: '〔时间系统〕顶上那一行便是「时辰」——点名、放风、点卯、晚归，皆以它为准；点它可展开钟表，日头与天候也在其上。' },
            { t: 'log', cls: 'order', text: '〔门禁〕戌时（约晚七点）前须回牢销名，逾时受鞭刑。' },
            { t: 'setFlag', path: 'flags.onb.clockOn', value: true },
            { t: 'setFlag', path: 'flags.onb.curfewSet', value: true },
            { t: 'setFlag', path: 'flags.onb.curfewHour', value: 10 },
            { t: 'setFlag', path: 'flags.onb.curfewLabel', value: '戌时（约 19:00–21:00）' }
          ] }
        ] },
      // 兜底（幂等）：即便玩家未点选项就离开，也确保门禁/时辰校准已生效，晚归判定不会失灵
      { t: 'setFlag', path: 'flags.onb.clockOn', value: true },
      { t: 'setFlag', path: 'flags.onb.curfewSet', value: true },
      { t: 'setFlag', path: 'flags.onb.curfewHour', value: 10 },
      { t: 'setFlag', path: 'flags.onb.curfewLabel', value: '戌时（约 19:00–21:00）' }
    ]
  });
  // 3.3) 晚归·受刑（戌时后回牢：牢头好感-1、鞭打扣血，含文案+动画；离牢时重置以便每轮各罚一次）
  //   注：铺垫用 log（同步 next）；勿用 narrate（见 3.2 注释）。
  TRIGGERS.push({
    id: 'laotou_late', hook: 'onEnter', room: 'camp_tz1', once: false,
    cond: { flags: { 'flags.onb.curfewSet': true }, time: { day: false }, notFlag: 'flags.onb.lateDone' },
    steps: [
      { t: 'log', cls: 'env', text: '你摸黑蹭回牢门，栅外更鼓正敲——早过了戌时。' },
      { t: 'npcTalk', npc: 'laotou',
        prompt: '牢头脸一沉，灯笼照见你身上的囚服：「好小子，点卯的时辰早过了，还晓得回来？营规面前不讲情——三鞭，记着下回的钟点！」',
        asks: [
          { label: '〔咬牙受刑〕', then: [
            { t: 'hurt', amount: 15, favor: -1, favorNpc: 'laotou', fxText: '鞭！' },
            { t: 'log', cls: 'sys', text: '牢头亲自动手。你背上挨了三鞭，火辣辣地疼，血齿间都是铁锈味。（气血 -15，牢头好感 -1）' },
            { t: 'log', cls: 'order', text: '〔门禁〕你已晚归受刑。明日戌时前务必回牢销名。' },
            { t: 'setFlag', path: 'flags.onb.lateDone', value: true }
          ] }
        ] }
    ]
  });

  // 3) 塌墙根·未逃脱前：封锁出口，只能退回劳役场（北门锁死，逼走密道抉择）
  TRIGGERS.push({
    id: 'wall_gate', hook: 'onEnter', room: 'camp_wall', once: false,
    cond: { notFlag: 'flags.route.escaped_crypt' },
    steps: [ { t: 'moveGate', fwd: 'camp_yard', hint: '塌墙根下空空荡荡，没有先生许可与默叔暗号，这道墙根你过不去。先回场上寻先生、再去囚室问默叔。' } ]
  });

  // 4.5) 回到劳役场：解除塌墙根门禁
  // 修复：wall_gate 设的是全局 state.moveGate（fwd=camp_yard），离场后若不清，
  // 会残留在出生点，把「西→塌墙根」也锁死（西门目标不是 camp_yard → blocked），导致无法再西去。
  TRIGGERS.push({
    id: 'yard_clear_gate', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
    steps: [ { t: 'clearGate' } ]
  });

  // 5) 囚室·默叔示意暗号（逃逸前置：在囚室对上暗号，再赴塌墙根决断）
  TRIGGERS.push({
    id: 'moshu_signal', hook: 'onTalk', npc: 'moshu', room: 'camp_tz2', once: true,
    cond: { flags: { 'flags.route.crypt': true }, notFlag: 'flags.task.signal' },
    steps: [
      { t: 'npcTalk', npc: 'moshu',
        prompt: '默叔见是你，咧嘴无声一笑，却先抬手虚按，示意你蹲下；又伸出三根指头，缓缓收起两根，只留食指朝塌墙根一点。',
        asks: [
          { label: '（蹲下，按他手势比出「一指墙根」）',
            set: { 'flags.task.signal': true },
            say: '默叔眼中一亮，点头。他比了个「随我来」的手势，等你起身——暗号对上了。〔已与默叔对上暗号，可赴塌墙根钻暗道。〕' }
        ] }
    ]
  });

  // 5.5) 塌墙根·密道决断（路线枢纽）：改由 index.html 的 openEscapeHub('camp_wall') 接手
  // （玩家点「决断出营·墙根」→ 弹出已解锁路线的抉择；统一在 doEscape() 内毕业。）


  // 6) 〔已移除〕原「逃出苦役营后·林径乌桓游骑拦路」的开场教学战，现已迁移至练武场·木人桩
  //    （train_dummy 触发 tutCombat 引导演练），出营不再强制触发战斗。

  // ════════════════ 支线：三则（v20260831t）════════════════
  // 支线A · 黑山寨·后寨「井底货」：被掳货郎吴六——放人得药(侠) / 敲诈得银(凶)
  TRIGGERS.push({
    id: 'wz_wuliu', hook: 'onTalk', npc: 'wuliu', room: 'ji_heishan_houzhai', once: false,
    cond: { notFlag: 'flags.wz_wuliu_done' },
    steps: [
      { t: 'npcTalk', npc: 'wuliu',
        prompt: '你走近那蜷缩货郎。他抬头见你，先是一惊，随即膝行两步：「好汉！小的是过路货郎吴六，被这伙山贼掳来三日——若得脱身，愿以命酬！」',
        asks: [
          { label: '〔侠〕割绳放他下山', set: { 'flags.wz_wuliu_done': true },
            then: [
              { t: 'grant', rep: 2, items: [{id:'caoyao', name:'草药', icon:'🌿', cat:'素材', count:2}, {id:'roubao', name:'肉包子', icon:'🥟', cat:'食饵', count:1}] },
              { t: 'log', cls: 'good', text: '你割断绳索。吴六千恩万谢，将贴身藏的草药与干粮塞进你手里，趁夜溜下山去——寨中少了一名苦力，山中多了一户感念你恩德的人家。' }
            ] },
          { label: '〔凶〕扣腕逼他拿银买命', set: { 'flags.wz_wuliu_done': true },
            then: [
              { t: 'grant', gold: 35 },
              { t: 'log', cls: 'sys', text: '你扣住他腕子，冷冷道：「拿银买命。」吴六哆嗦着从货底摸出一小袋银钱奉上，恨恨地别过脸去。' }
            ] },
          { label: '暂不理他', say: '你只瞥了一眼，径直走开。吴六张了张嘴，终究没敢再唤。' }
        ] }
    ]
  });

  // 支线B · 林径「寻药篓」：受伤猎户托寻被野狼叼走的药篓（应下→战野狼→胜后交还得谢礼）
  TRIGGERS.push({
    id: 'wz_liehu', hook: 'onTalk', npc: 'liehu', room: 'lindao', once: false,
    cond: { notFlag: 'flags.wz_liehu_done' },
    steps: [
      { t: 'npcTalk', npc: 'liehu',
        prompt: '猎户见你停步，眼睛一亮：「小兄弟，可肯帮我个忙？药篓叫野狼拖进林子深处了，里头有给阿婆治伤的药——你若寻得回，愿以猎物相酬！」',
        asks: [
          { label: '应下，循狼迹入林', set: { 'flags.wz_liehu': true },
            then: [
              { t: 'log', cls: 'sys', text: '你循着草丛里的血迹与爪印拨草而入——林深忽暗，一头野狼正撕扯着那只药篓，见你逼近，呲牙低吼！' },
              { t: 'combat', enemy: 'wild_wolf' }
            ] },
          { label: '婉言谢过', say: '你摇摇头。猎户叹了口气，垂眼不再言语。' }
        ] }
    ]
  });

  // 支线C · 苦役营·塌墙根「墙外接应」：教学毕业后回访福生，白檀屯接应送补给
  TRIGGERS.push({
    id: 'wz_fusheng', hook: 'onTalk', npc: 'fu_sheng', room: 'kuyilao', cell: [1,2], once: false,
    cond: { flags: { 'flags.onb.done': true }, notFlag: 'flags.wz_fusheng_done' },
    steps: [
      { t: 'npcTalk', npc: 'fu_sheng',
        prompt: '福生见你平安归来，眼睛一亮，压低嗓门：「嘿，你真钻出来啦！白檀屯的叔伯早候在墙外，托我带句话——北边庄子遭了雪灾，正缺人手。你若去，口粮管够，还能得些盘缠。」',
        asks: [
          { label: '应下这趟差，托福生转告', set: { 'flags.wz_fusheng_done': true },
            then: [
              { t: 'grant', gold: 15, rep: 2, items: [{id:'roubao', name:'肉包子', icon:'🥟', cat:'食饵', count:2}, {id:'jiu', name:'黍酒', icon:'🍶', cat:'食饵', count:1}] },
              { t: 'log', cls: 'good', text: '你接过福生递来的干粮袋：肉包两只、黍酒一壶，还有十几文铜钱。福生咧嘴一笑：「白檀屯的叔伯记你的好，路上慢走！」' }
            ] },
          { label: '谢过，暂不前往', set: { 'flags.wz_fusheng_done': true }, say: '你拱拱手。福生会意，也不多劝，只道接应的人会再多等两日。' }
        ] }
    ]
  });

  // ════════════════ 苦役营·全量 10 越狱路线（v20260902a） ═════════════════
  // 路线授予：各 NPC 对话 set 写入 flags.route.*；物品由对应触发 grant。
  // 逃脱执行：camp_wall「决断出营·墙根」→ openEscapeHub('camp_wall')；
  //          camp_gate「决断出营·岗哨」→ openEscapeHub('camp_gate')；
  //          doEscape() 统一判定前置并 graduate。

  // — 路线2 挖地道：苟三授 route.tunnel（镐锄自行于仓库/矿坑取） —
  TRIGGERS.push({
    id: 'gou_tunnel', hook: 'onTalk', npc: 'gou_san', room: 'kuyilao', cell: [2,0], once: false,
    cond: { notFlag: 'flags.route.tunnel' },
    steps: [
      { t: 'npcTalk', npc: 'gou_san',
        prompt: '苟三十指翻飞，朝矿道一努嘴：「想刨地道？矿坑那头连墙根，土松。镐锄么——仓库墙角倚着几把闲的，偷来便是。」',
        asks: [
          { label: '〔受教〕记下了，去寻镐锄', set: { 'flags.route.tunnel': true },
            say: '苟三咧嘴：「镐锄到手，从矿道那头下铲——刨通了，地道线就成了。」〔已得挖地道线索：需自行取得镐锄（仓库/矿坑可拾）。〕' }
        ] }
    ]
  });

  // — 路线8 水渠夜遁：吴算（知水道走向）授 route.drain —
  TRIGGERS.push({
    id: 'wu_drain', hook: 'onTalk', npc: 'wu_suan', room: 'kuyilao', cell: [2,1], once: false,
    cond: { notFlag: 'flags.route.drain' },
    steps: [
      { t: 'npcTalk', npc: 'wu_suan',
        prompt: '吴算盘噼啪一算：「排水渠从矿道底过墙根，夜里水声盖动静，最宜夜遁。走向么，老夫门儿清。」',
        asks: [
          { label: '〔请教〕求水道走向', set: { 'flags.route.drain': true },
            say: '吴算盘眯眼：「子时换岗最松，顺渠摸黑漂出便是。〔已得水渠夜遁线索：需石四肯带你认道（路线8）。〕' }
        ] }
    ]
  });

  // — 路线8 辅助：石四指矿道暗渠 —
  TRIGGERS.push({
    id: 'shi_drain', hook: 'onTalk', npc: 'shi_si', room: 'kuyilao', cell: [2,0], once: false,
    cond: { notFlag: 'flags.task.drain_hint' },
    steps: [
      { t: 'npcTalk', npc: 'shi_si',
        prompt: '石四敲着残腿：「矿道底下有暗渠，通墙外水沟。夜里水声大，正好盖动静——你顺着渠漂出去，比钻墙根还隐。」',
        asks: [
          { label: '〔记下了〕这便去备水渠', set: { 'flags.task.drain_hint': true },
            say: '石四往墙根一指：「去寻吴算盘问准走向，夜里动手。」〔水渠夜遁（路线8）：吴算处得走向后，于塌墙根走水渠。〕' }
        ] }
    ]
  });

  // — 路线3 下迷药：林娘配 sleep_drug 并授 route.drug（鲁大仅提示） —
  TRIGGERS.push({
    id: 'lin_drug', hook: 'onTalk', npc: 'lin_niang', room: 'kuyilao', cell: [0,1], once: false,
    cond: { notFlag: 'flags.route.drug' },
    steps: [
      { t: 'npcTalk', npc: 'lin_niang',
        prompt: '林娘拢着药草：「迷药药材我这里有——蒙汗草研碎下饭，官差睡死不觉。要下药业，我替你配一包。」',
        asks: [
          { label: '〔恳请〕劳烦配一包迷药', set: { 'flags.route.drug': true },
            then: [
              { t: 'grant', items: [{ id: 'sleep_drug', name: '迷药', icon: '💤', cat: '药剂', count: 1 }] },
              { t: 'log', cls: 'good', text: '林娘将一包迷药塞入你怀中：「下在粥锅，官差睡到日上三竿。可这药只放倒人，伤天和，慎用。」〔已得迷药 + 下药业线索（路线3）：于岗哨下迷药。〕' }
            ] }
        ] }
    ]
  });

  // — 路线4 趁乱暴动：秦九霄授 route.riot（夺赵虎腰牌） —
  TRIGGERS.push({
    id: 'qin_riot', hook: 'onTalk', npc: 'qin_jiuxiao', room: 'kuyilao', cell: [1,1], once: false,
    cond: { notFlag: 'flags.route.riot' },
    steps: [
      { t: 'npcTalk', npc: 'qin_jiuxiao',
        prompt: '秦九霄独臂撑地：「想活命，趁换岗那阵乱，夺了赵阎王的腰牌，带人冲出去！老子断臂前就是这么干的。」',
        asks: [
          { label: '〔应下〕夺腰牌，趁乱暴动', set: { 'flags.route.riot': true },
            say: '秦九霄眼中凶光：「好胆！岗哨那处，待你得了腰牌，老子陪你干一票。」〔已得趁乱暴动线索（路线4）：于岗哨夺赵虎腰牌后暴动，需先与官差一战。〕' }
        ] }
    ]
  });

  // — 路线5 伪造木牍：陈简刻 wooden_pass（营中竹木随手取） —
  TRIGGERS.push({
    id: 'chen_wooden', hook: 'onTalk', npc: 'chen_jian', room: 'kuyilao', cell: [2,1], once: false,
    cond: { notFlag: 'flags.task.wooden' },
    steps: [
      { t: 'npcTalk', npc: 'chen_jian',
        prompt: '陈简借着天窗光：「伪造路引？这活老子在行。取块竹木来，刻上通关印信款式，混出门时举着它。」',
        asks: [
          { label: '〔取竹木〕烦陈简刻一牍', set: { 'flags.task.wooden': true },
            then: [
              { t: 'grant', items: [{ id: 'wooden_pass', name: '木牍路引', icon: '🪵', cat: '素材', count: 1 }] },
              { t: 'log', cls: 'good', text: '陈简三两下刻好一枚木牍路引，塞给你：「汉末纸贵，木牍最便。收好，混出门举着它，官差懒得细看。」〔已得木牍路引（路线5）：于岗哨出示混出。〕' }
            ] }
        ] }
    ]
  });

  // — 路线7 攀绳翻墙：苏娘搓 rope（韩铁指点） —
  TRIGGERS.push({
    id: 'su_rope', hook: 'onTalk', npc: 'su_niang', room: 'kuyilao', cell: [2,2], once: false,
    cond: { notFlag: 'flags.task.rope' },
    steps: [
      { t: 'npcTalk', npc: 'su_niang',
        prompt: '苏娘指尖灵巧，正将布条绞成一股绳：「攀墙？得有绳。营里竹麻随处可取，我替你搓一条便是。」',
        asks: [
          { label: '〔拜托〕劳烦搓一条绳', set: { 'flags.task.rope': true },
            then: [
              { t: 'grant', items: [{ id: 'rope', name: '绳', icon: '🪢', cat: '素材', count: 1 }] },
              { t: 'log', cls: 'good', text: '苏娘将搓好的绳绕在你腕上：「绳有了，翻墙时莫慌，墙头碎瓷割手。」〔已得绳（路线7）：于墙根攀绳翻墙。〕' }
            ] }
        ] }
    ]
  });

  // — 路线9 劫狱强攻：韩铁明示「木人桩练级后可硬闯」 —
  TRIGGERS.push({
    id: 'han_assault', hook: 'onTalk', npc: 'han_tie', room: 'kuyilao', cell: [2,2], once: false,
    cond: { notFlag: 'flags.task.assault_hint' },
    steps: [
      { t: 'npcTalk', npc: 'han_tie',
        prompt: '韩铁捶胸：「拳脚够硬，这营墙也拦不住你！在桩上练出真章，岗哨强突——那叫一个痛快。」',
        asks: [
          { label: '〔受教〕先去戳木人桩', set: { 'flags.task.assault_hint': true },
            say: '韩铁斜眼：「戳透了桩，老子准你岗哨强突。劫狱强攻最难最爽，战力到了才成。」〔劫狱强攻线（路线9）：木人桩练至战力达标（等级≥3 或击败木人桩若干），于岗哨杀出。〕' }
        ] }
    ]
  });

  // — 木人桩系列·二：练成后韩铁点拨去犬舍逗野犬，专练「撤退」 —
  TRIGGERS.push({
    id: 'han_spar_dog', hook: 'onTalk', npc: 'han_tie', room: 'kuyilao', cell: [2,2], once: false,
    cond: { flags: { 'flags.onb.tcDone': true }, notFlag: 'flags.task.dog_hint' },
    steps: [
      { t: 'npcTalk', npc: 'han_tie',
        prompt: '韩铁一拍你肩：「木人桩是死物，真打还得会『撤』。犬舍那几条恶犬性子烈，你且去逗逗它们——打不过就〔撤退〕，那也是真本事。」',
        asks: [
          { label: '〔领命〕去犬舍会会恶犬', set: { 'flags.task.dog_hint': true },
            say: '韩铁咧嘴：「犬舍在东边——记住，〔撤退〕不是逃，是留得青山。撤得利落，比硬拼更见功夫。」〔木人桩系列·二：犬舍逗野犬，练「撤退」。〕' }
        ] }
    ]
  });

  // — 仓库拾镐锄（路线2 必需物；郑刚/墙角闲镐） —
  TRIGGERS.push({
    id: 'wh_pickaxe', hook: 'onCustom', room: 'kuyilao', cell: [2,1], once: true,
    cond: { notFlag: 'flags.task.pickaxe' },
    steps: [
      { t: 'log', cls: 'sys', text: '你趁郑刚打盹，从墙角摸起一把闲镐锄——沉甸甸正趁手。〔已得镐锄：挖地道线（路线2）可成。〕' },
      { t: 'grant', items: [{ id: 'pickaxe', name: '镐锄', icon: '⛏️', cat: '素材', count: 1 }] },
      { t: 'setFlag', path: 'flags.task.pickaxe', value: true }
    ]
  });

  // — 信息中心：孙老首谈点明全部路线（提示向） —
  TRIGGERS.push({
    id: 'sun_routes', hook: 'onTalk', npc: 'sun_lao', room: 'kuyilao', cell: [0,0], once: false,
    cond: { notFlag: 'flags.task.sun_hint' },
    steps: [
      { t: 'npcTalk', npc: 'sun_lao',
        prompt: '孙老吧嗒旱烟：「这营里十条出路，老朽都听过——密道、地道、迷药、暴动、木牍、收买、攀绳、水渠、硬闯、外应。」',
        asks: [
          { label: '〔洗耳恭听〕各路找谁', set: { 'flags.task.sun_hint': true },
            say: '孙老吐口烟：「周先生守暗道；苟三懂挖地道；鲁大下迷药；秦九霄要暴动；陈简刻木牍；犬舍粮囤可收买；苏娘搓绳攀墙；石四吴算通水渠；韩教头许你硬闯——看清自个儿斤两再决断。」〔已得路线全图：与对应 NPC 交谈即可解锁各线。〕' }
        ] }
    ]
  });

  // — 岗哨逃脱（暴动/劫狱强攻）的战后毕业，由 index.html 的 exitCombatToRoom 钩子处理 —
  //   （岗哨战斗路线胜/撤退后，exitCombatToRoom 检测到 flags.route._pending 即 finishEscape）

  // — 毕业引导：首入开放世界，逐步点亮全部核心系统（行囊/角色/战斗/武学/交易/地图/历法/善恶） —
  TRIGGERS.push({
    id: 'camp_tour', hook: 'onEnter', room: 'lindao', once: false,
    cond: { flags: { 'flags.onb.done': true }, notFlag: 'flags.task.tour_done' },
    steps: [
      { t: 'setFlag', path: 'flags.task.tour_done', value: true },
      { t: 'reveal', layer: 'dock' },
      { t: 'highlight', layer: 'dock' },
      { t: 'sys', text: '〔系统全貌〕你既自由，江湖诸般手段皆已为你敞开，下方「行囊/任务/角色」面板此刻点亮——' },
      { t: 'sys', text: '· 点开「角色」面板：查看修为、战力、善恶声望（凶名/义声）。声望将左右世人待你之态度。' },
      { t: 'sys', text: '· 点开「武学」：研习招式、内功（内力将随门派/心法开启）。战斗中以「攻击/防御/道具/撤退」四式应敌。' },
      { t: 'sys', text: '· 寻见「货郎」可交易买卖；点「山河志」地图纵览州郡；点顶上「时辰」可知历法天候——皆是你闯荡的凭仗。' },
      { t: 'log', cls: 'good', text: '（提示：此后每遇新系统，皆有高亮引路。先往林径寻那挑担的行脚货郎，或北去白檀军屯安顿身心，再做打算。）' }
    ]
  });

  // — 〔已移除〕原外应接应线（路线10·穆长风/老乞丐）整体删除；出营后的接应由林径行脚货郎与白檀军屯承接。 —


  TRIGGERS.push({
    id: 'kaixuan_hook', hook: 'onEnter', room: 'luoyang', once: true,
    cond: { flags: { 'quest.luoyang': true } },
    steps: [ { event: 'ev_kaixuan_decree' } ]
  });

  // ════════════════ 苦役营·新手支线：采石充仓（v20260909w） ════════════════
  // 接任务：与仓吏对话，受托采石料
  TRIGGERS.push({
    id: 'kyl_stone_accept', hook: 'onTalk', npc: 'storeman_kuyilao', room: 'kuyilao', cell: [2,1], once: true,
    cond: { notFlag: 'flags.task.stone_started' },
    steps: [
      { t: 'npcTalk', npc: 'storeman_kuyilao',
        prompt: '仓吏见你过来，搁下笔册叹道：「营中营建正缺石料，矿坑那头采得慢。你若肯去矿坑凿些青石来交予我，上头必有赏赐——五块便够，多了也记你功劳。」',
        asks: [
          { label: '〔应下〕我去矿坑采来。',
            set: { 'flags.task.stone_started': true },
            say: '仓吏点头：「好！矿坑在仓库北边，挥镐便能凿下青石。采够五块拿来与我，赏你一个便携腰包，系在腰上装东西也方便些。」〔任务：采石充仓——去矿坑采五块石料，给予仓吏。〕',
            then: [ { t: 'acceptQuest', id: 'stone' } ] },
          { label: '〔婉拒〕我再想想。',
            say: '仓吏摆摆手：「不急，何时想通了再来找我。」' }
        ] }
    ]
  });
  // 任务进行中：再次对话提示进度
  TRIGGERS.push({
    id: 'kyl_stone_progress', hook: 'onTalk', npc: 'storeman_kuyilao', room: 'kuyilao', cell: [2,1], once: false,
    cond: { flags: { 'flags.task.stone_started': true }, notFlag: 'flags.task.stone_done' },
    steps: [
      { t: 'log', cls: 'npc', text: '〔仓吏〕「石料采得如何了？矿坑在北边，挥镐便得。凑够五块拿来与我。」' }
    ]
  });
  // 交任务：给予石料给仓吏，累计5块完成（按实际给予数量累计）
  TRIGGERS.push({
    id: 'kyl_stone_give', hook: 'onGive', npc: 'storeman_kuyilao', room: 'kuyilao', cell: [2,1], item: 'shitiao', once: false,
    cond: { flags: { 'flags.task.stone_started': true }, notFlag: 'flags.task.stone_done' },
    steps: [
      { t: 'setFlag', path: 'flags.task.stone_count', increment: true, incrementByEnv: 'qty' },
      { t: 'branch',
        if: { player: { 'flags.task.stone_count': { min: 5 } } },
        then: [
          { t: 'setFlag', path: 'flags.task.stone_done', value: true },
          { t: 'completeQuest', id: 'stone' },
          { t: 'log', cls: 'npc', text: '〔仓吏〕「五块石料齐了！好汉子，做事利落。这腰包你拿去，系在腰上，往后装东西也方便些。」' },
          { t: 'grant', items: [ { id: 'yaobao', name: '便携腰包', icon: '👝', cat: '装备', count: 1 } ] },
          { t: 'exp', amount: 30 },
          { t: 'log', cls: 'good', text: '〔任务完成·采石充仓〕获得 便携腰包（行囊+4）· 修为 +30' }
        ],
        else: [
          { t: 'log', cls: 'npc', text: '〔仓吏〕收下石料，在册上记了一笔：「还差几块，继续去采。」' }
        ]
      }
    ]
  });
  // 任务完成后对话
  TRIGGERS.push({
    id: 'kyl_stone_done', hook: 'onTalk', npc: 'storeman_kuyilao', room: 'kuyilao', cell: [2,1], once: false,
    cond: { flags: { 'flags.task.stone_done': true } },
    steps: [
      { t: 'log', cls: 'npc', text: '〔仓吏〕「石料已收妥，营中营建又快了几分。你若还想帮忙，营里各处都缺人手——农庄、伙房、演武场，尽可去转转。」' }
    ]
  });

  LF.TRIGGERS = TRIGGERS;
  if (LF.SharedGame) LF.SharedGame.TRIGGERS = TRIGGERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TRIGGERS;
})(typeof window !== 'undefined' ? window : globalThis);

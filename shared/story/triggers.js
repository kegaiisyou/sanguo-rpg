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

  // 1) 劳役场·进场：场景已由 enterRoom 自动播报（「醒来+劳役场」两句）。
  //    此处一次性点亮交互界面（NPC / 行动 / 下方区），并由官差牢头在叙事里喝令去担石——
  //    改用「叙事旁白」而非模态弹窗，避免手机端进场即被弹窗打断；玩家落座即可直接点「担石劳作」开玩。
  TRIGGERS.push({
    id: 'camp_opening', hook: 'onEnter', room: 'camp_yard', once: true,
    steps: [
      { t: 'reveal', layer: 'npc' },
      { t: 'reveal', layer: 'lower' },
      { t: 'reveal', layer: 'actions' },
      { t: 'log', cls: 'npc', text: '（一名狱卒踱到你跟前，踢了踢脚边碎石）新来的？少发愣——场中那些石头，今天归你搬。搬不满三车，晌饭就甭想。' }
    ]
  });

  // 2.2) 首次担石劳作：记一次劳作体验，并顺带点亮状态栏 + 位置页签（自然的「干完活才看自身状态」时刻）
  TRIGGERS.push({
    id: 'labor_first', hook: 'onCustom', room: 'camp_yard', once: true,
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
    id: 'survey_yard', hook: 'onCustom', room: 'camp_yard', once: true,
    cond: { flags: { 'flags.onb.labored': true }, notFlag: 'flags.onb.surveyed' },
    steps: [
      { t: 'log', cls: 'sys', text: '你环顾劳役场：西边塌了半截的墙根，藤蔓爬墙——那是营墙的缺口，风里带着外面的草木腥气；东南角一道低矮门洞，通向囚室，里头囚徒横七竖八。狱卒往来，各处出口皆被看死，唯有那塌墙根透着几分松动。' },
      { t: 'setFlag', path: 'flags.onb.surveyed', value: true },
      { t: 'sys', text: '你记下了几处去路。场中那讲古的蓬头囚徒似乎藏了不少门道，若有闲，再凑近听听也无妨。' }
    ]
  });

  // 3) 周听涛·取信授密道线（玩家自由回到周听涛、且已劳作+勘察后，他自然接话给出线索）
  TRIGGERS.push({
    id: 'zt_crypt', hook: 'onTalk', npc: 'zhoutingtao', room: 'camp_yard', once: true,
    cond: { flags: { 'flags.onb.labored': true, 'flags.onb.surveyed': true }, notFlag: 'flags.route.crypt' },
    steps: [
      { t: 'npcTalk', npc: 'zhoutingtao',
        prompt: '你再凑近周听涛。他讲完一段，忽压低嗓子朝你挤眼：「你这新来的，不似旁人浑浑噩噩——石也担了，路也看清了。既如此，老夫便与你透个底。」',
        asks: [
          { label: '〔倾听〕先生请讲。',
            set: { 'flags.route.crypt': true },
            say: '「老夫装疯这些日子，没白装。营后塌墙根下有暗道，默叔替我守着。你若信得过，夜里随我来——记着，塌墙根，寻默叔。」〔已得密道线索：先去东南囚室寻默叔对暗号，再赴西边塌墙根钻暗道。〕' }
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
    id: 'yard_clear_gate', hook: 'onEnter', room: 'camp_yard', once: false,
    steps: [ { t: 'clearGate' } ]
  });

  // 5) 囚室·默叔示意暗号（逃逸前置：在囚室对上暗号，再赴塌墙根决断）
  TRIGGERS.push({
    id: 'moshu_signal', hook: 'onTalk', npc: 'moshu', room: 'camp_cell', once: true,
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


  // 6) 逃出苦役营（onb.done 毕业）后·首次进入林径：乌桓游骑拦路，老乞丐开场教学战
  //    教学战由 startCombat(...,{tutorial:true}) 激活 tutCombat 脚本演出（攻/防/道具分步引导，
  //    老乞丐帮打 + 受伤赠金疮药），胜/败/逃均由老乞丐救场收尾并置 tcDone。
  TRIGGERS.push({
    id: 'tut_combat_lindao', hook: 'onEnter', room: 'lindao', once: true,
    cond: { flags: { 'flags.onb.done': true }, notFlag: 'flags.onb.tcDone' },
    steps: [
      { t: 'log', cls: 'combat', text: '你钻出营墙，沿林径向北疾行——忽闻脚步声急，一名营中官差持矛追来，拦住去路！' },
      { t: 'combat', enemy: 'camp_guard', tutorial: true }
    ]
  });

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
    id: 'wz_fusheng', hook: 'onTalk', npc: 'fu_sheng', room: 'camp_wall', once: false,
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
    id: 'gou_tunnel', hook: 'onTalk', npc: 'gou_san', room: 'camp_mine', once: false,
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
    id: 'wu_drain', hook: 'onTalk', npc: 'wu_suan', room: 'camp_warehouse', once: false,
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
    id: 'shi_drain', hook: 'onTalk', npc: 'shi_si', room: 'camp_mine', once: false,
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
    id: 'lin_drug', hook: 'onTalk', npc: 'lin_niang', room: 'camp_kitchen', once: false,
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
    id: 'qin_riot', hook: 'onTalk', npc: 'qin_jiuxiao', room: 'camp_yard', once: false,
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
    id: 'chen_wooden', hook: 'onTalk', npc: 'chen_jian', room: 'camp_warehouse', once: false,
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
    id: 'su_rope', hook: 'onTalk', npc: 'su_niang', room: 'camp_wall', once: false,
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
    id: 'han_assault', hook: 'onTalk', npc: 'han_tie', room: 'camp_training', once: false,
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

  // — 仓库拾镐锄（路线2 必需物；郑刚/墙角闲镐） —
  TRIGGERS.push({
    id: 'wh_pickaxe', hook: 'onCustom', room: 'camp_warehouse', once: true,
    cond: { notFlag: 'flags.task.pickaxe' },
    steps: [
      { t: 'log', cls: 'sys', text: '你趁郑刚打盹，从墙角摸起一把闲镐锄——沉甸甸正趁手。〔已得镐锄：挖地道线（路线2）可成。〕' },
      { t: 'grant', items: [{ id: 'pickaxe', name: '镐锄', icon: '⛏️', cat: '素材', count: 1 }] },
      { t: 'setFlag', path: 'flags.task.pickaxe', value: true }
    ]
  });

  // — 信息中心：孙老首谈点明全部路线（提示向） —
  TRIGGERS.push({
    id: 'sun_routes', hook: 'onTalk', npc: 'sun_lao', room: 'camp_farm', once: false,
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
  //   （教学战斗胜/被老乞丐救场后 tcDone，检测到 flags.route._pending 即 finishEscape）

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
      { t: 'log', cls: 'good', text: '（提示：此后每遇新系统，皆有高亮引路。先往白檀军屯投穆长风旧识，安顿身心，再做打算。）' }
    ]
  });

  // — 外应接应线（路线10）：毕业首访林径，穆长风接应指白檀 —
  TRIGGERS.push({
    id: 'mt_contact', hook: 'onTalk', npc: 'mu_changfeng', room: 'lindao', once: false,
    cond: { flags: { 'flags.onb.done': true }, notFlag: 'flags.task.contact' },
    steps: [
      { t: 'npcTalk', npc: 'mu_changfeng',
        prompt: '穆长风眯眼打量你：「你这后生，竟真从苦役营钻出来了？白檀军屯的叔伯们同老夫有旧——你既出得来，便投他们去。」',
        asks: [
          { label: '〔拜谢〕愿往白檀投奔', set: { 'flags.task.contact': true },
            then: [
              { t: 'grant', gold: 15, rep: 2, items: [{ id: 'roubao', name: '肉包子', icon: '🥟', cat: '食饵', count: 2 }, { id: 'jiu', name: '黍酒', icon: '🍶', cat: '食饵', count: 1 }] },
              { t: 'log', cls: 'good', text: '穆长风将干粮袋塞给你：「肉包两只、黍酒一壶，还有盘缠。北边庄子遭了雪灾，正缺人手——去吧，江湖路远。」〔外应接应线（路线10）已成：白檀军屯在望。〕' }
            ] }
        ] }
    ]
  });


  TRIGGERS.push({
    id: 'kaixuan_hook', hook: 'onEnter', room: 'luoyang', once: true,
    cond: { flags: { 'quest.luoyang': true } },
    steps: [ { event: 'ev_kaixuan_decree' } ]
  });

  LF.TRIGGERS = TRIGGERS;
  if (LF.SharedGame) LF.SharedGame.TRIGGERS = TRIGGERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TRIGGERS;
})(typeof window !== 'undefined' ? window : globalThis);

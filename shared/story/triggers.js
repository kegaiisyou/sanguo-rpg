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

  // 5.5) 塌墙根·密道决断（路线枢纽：玩家主动勘察后逃脱）
  // 由 camp_wall 的「勘察塌墙根·决断出营」动作以 hook:'onCustom' 触发；
  // 仅当已取得密道线索且与默叔对上暗号时成立，否则仅给提示（见 handleAction）。
  TRIGGERS.push({
    id: 'wall_escape', hook: 'onCustom', room: 'camp_wall', once: true,
    cond: { flags: { 'flags.route.crypt': true, 'flags.task.signal': true } },
    steps: [
      { t: 'log', cls: 'env', text: '你按默叔所授暗号，拨开乱砖——塌墙根下赫然一道幽深暗道。你不再犹豫，钻了进去。潮气扑面，七拐八绕，头顶人声渐远，你钻出了营墙。' },
      { t: 'setFlag', path: 'flags.route.escaped_crypt', value: true },
      { t: 'setFlag', path: 'flags.onb.done', value: true },
      { t: 'clearGate' },
      { t: 'graduate' },
      { t: 'sys', text: '〔教学完成〕你已逃出苦役营。点下方移动罗盘「北」钻出墙外，前往白檀军屯，自此汇入北疆乱世。（塌墙根还有苏娘搓绳、福生传信——攀绳、外应另两条路，留待他日。）' }
    ]
  });


  // 6) 逃出苦役营（onb.done 毕业）后·首次进入林径：乌桓游骑拦路，老乞丐开场教学战
  //    教学战由 startCombat(...,{tutorial:true}) 激活 tutCombat 脚本演出（攻/防/道具分步引导，
  //    老乞丐帮打 + 受伤赠金疮药），胜/败/逃均由老乞丐救场收尾并置 tcDone。
  TRIGGERS.push({
    id: 'tut_combat_lindao', hook: 'onEnter', room: 'lindao', once: true,
    cond: { flags: { 'flags.onb.done': true }, notFlag: 'flags.onb.tcDone' },
    steps: [
      { t: 'log', cls: 'combat', text: '你钻出营墙，沿林径向北疾行——忽闻马蹄声碎，一名乌桓游骑横马拦路，弯刀出鞘！' },
      { t: 'combat', enemy: 'wuhuan_scout', tutorial: true }
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

  // 凯旋钩子：斩华雄、凯旋后首访洛阳，触发「关东盟檄」事件，铺陈第二章三条线
  TRIGGERS.push({
    id: 'kaixuan_hook', hook: 'onEnter', room: 'luoyang', once: true,
    cond: { flags: { 'quest.luoyang': true } },
    steps: [ { event: 'ev_kaixuan_decree' } ]
  });

  LF.TRIGGERS = TRIGGERS;
  if (LF.SharedGame) LF.SharedGame.TRIGGERS = TRIGGERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TRIGGERS;
})(typeof window !== 'undefined' ? window : globalThis);

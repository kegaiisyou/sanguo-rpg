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

  // 1) 劳役场·进场：周听涛（同为阶下囚）低声讲古 + 渐进揭示
  // 注：场景已由 enterRoom 自动播报，此处不再 narrate，避免「开场看了两遍文字」。
  TRIGGERS.push({
    id: 'camp_opening', hook: 'onEnter', room: 'camp_yard', once: true,
    steps: [
      { t: 'sys', text: '〔苦役营·劳役场。黑压压一片囚徒与往来狱卒。场中一个蓬头囚徒正压着嗓子讲古——点下方「周听涛」听他讲些什么。〕' },
      { t: 'reveal', layer: 'npc' },
      { t: 'npcTalk', npc: 'zhoutingtao',
        prompt: '周听涛压着嗓子：「天下分久必合，合久必分——这乱世里，最出彩的偏是先秦刺客。易水萧萧，荆轲白马一去不返；鱼肠藏刃，专诸笑里酬恩。剑客的潇洒，不在活命，在来去从容。列位，这般孤勇，如今可还在？」',
        asks: [
          { label: '〔听书〕先生讲得精彩，这孤勇可在？',
            set: { favor: 1 },
            reveal: ['lower', 'actions'],
            say: '周听涛独独朝你挤眼：「你这囚籍的，命数不在牢里。听得进老夫一句，往后自有生路。」说罢以指蘸茶，在案上画了个「墙」字，又轻轻抹去——你心头一凛。〔已点亮下方场景 / 罗盘 / 行动区；与先生多攀谈、在场中担石，可探得生路。〕' }
        ] }
    ]
  });

  // 2.2) 首次担石劳作：渐进揭示状态栏 + 位置页签（onb 分层，对应文档序列）
  TRIGGERS.push({
    id: 'labor_first', hook: 'onCustom', room: 'camp_yard', once: true,
    cond: { notFlag: 'flags.task.labored' },
    steps: [
      { t: 'log', cls: 'sys', text: '你扛起乱石，肩头火辣。日头毒辣，囚徒如蚁，狱卒皮鞭声在身后炸响——这便是苦役营的日夜。' },
      { t: 'setFlag', path: 'flags.task.labored', value: true },
      { t: 'reveal', layer: 'status' },
      { t: 'reveal', layer: 'loctab' },
      { t: 'sys', text: '〔系统〕你已体会苦役营的劳役。上方状态栏与位置页签已开启。' }
    ]
  });

  // 2) 周听涛·取信授密道线（好感≥1 且尚未取得线索）
  TRIGGERS.push({
    id: 'zt_crypt', hook: 'onTalk', npc: 'zhoutingtao', room: 'camp_yard', once: true,
    cond: { npcFavor: { key: 'zhoutingtao', min: 1 }, notFlag: 'flags.route.crypt' },
    steps: [
      { t: 'npcTalk', npc: 'zhoutingtao',
        prompt: '你凑近低问：「先生方才那『墙』字，是何意？」周听涛四下瞅了瞅，压低嗓子：',
        asks: [
          { label: '〔请教〕先生既知生路，可否指点？',
            set: { 'flags.route.crypt': true },
            say: '「老夫装疯这些日子，没白装。营后塌墙根下有暗道，默叔替我守着。你若信得过，夜里随我来——记着，塌墙根，寻默叔。」〔已得密道线索：去西边塌墙根找默叔。〕' }
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
      { t: 'sys', text: '〔教学完成〕你已逃出苦役营。点下方移动罗盘「北」前往燕山·山口，寻穆长风接应。（塌墙根还有苏娘搓绳、福生传信——攀绳、外应另两条路，留待他日。）' }
    ]
  });

  // 6) 山口·穆长风接应（外部接应线切片）
  TRIGGERS.push({
    id: 'ys_contact', hook: 'onEnter', room: 'yanshan_shankou', once: true,
    cond: { flags: { 'flags.route.escaped_crypt': true } },
    steps: [
      { t: 'narrate', room: 'yanshan_shankou' },
      { t: 'log', cls: 'npc', npc: '穆长风', text: '穆长风斜倚隘口石上，见你钻出，咧嘴一笑：「出来了？老夫当年也是从这墙根爬出去的——结果又给抓了回来，哈哈！莫学我。」' },
      { t: 'npcTalk', npc: 'mulongfeng',
        prompt: '穆长风拍拍身旁石墩，示意你坐下：「既出来了，喝口风。外头世界，可比这墙里凶得多。」',
        asks: [
          { label: '〔问江湖〕前辈既出得来，可知外头出路？',
            set: { 'flags.route.contact': true },
            say: '「往南是白檀军屯，老相识在那儿当差，初出江湖可去投奔；往北渔阳、蓟城，正是乱世横流、英雄并起之处。你既出了营，自去闯吧——江湖险恶，保重。」' },
          { label: '〔辞行〕前辈保重，晚辈去也。',
            set: { 'flags.route.contact': true },
            say: '「去罢去罢，莫回头。这墙根的风，老夫替你挡着。」他笑着挥手，身影没入隘口的风里。' }
        ] },
      { t: 'log', cls: 'sys', text: '〔接应〕外部接应线已接驳：南去白檀军屯可寻穆长风旧识（开放世界钩子）。' }
    ]
  });

  LF.TRIGGERS = TRIGGERS;
  if (LF.SharedGame) LF.SharedGame.TRIGGERS = TRIGGERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TRIGGERS;
})(typeof window !== 'undefined' ? window : globalThis);

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

  // 1) 劳役场·进场：周听涛拍案开嗓（评书）+ 渐进揭示
  TRIGGERS.push({
    id: 'camp_opening', hook: 'onEnter', room: 'camp_yard', once: true,
    steps: [
      { t: 'narrate', room: 'camp_yard' },
      { t: 'sys', text: '〔苦役营·劳役场。黑压压一片囚徒与往来狱卒。当中一人拍案而起，醒木一拍——是说书先生周听涛。点下方「周听涛」听他说书。〕' },
      { t: 'reveal', layer: 'npc' },
      { t: 'npcTalk', npc: 'zhoutingtao',
        prompt: '周听涛醒木拍案：「话说天下大势，分久必合，合久必分……如今这汉室，也到了分崩的时候喽。」又道：「且说那使枪的少年夜走太行，一杆孤枪挑翻十八寨；又有那独臂刀客，单刀赴会，血溅五步……列位看官，这般孤勇，可还在不在？」',
        asks: [
          { label: '〔听书〕先生讲得精彩，这孤勇可在？',
            set: { favor: 1 },
            reveal: ['lower', 'loctab', 'actions'],
            say: '醒木先生独独朝你挤眼：「你这囚籍的，命数不在牢里。听得进老夫一句，往后自有生路。」说罢以指蘸茶，在案上画了个「墙」字，又轻轻抹去——你心头一凛。〔已点亮下方场景 / 罗盘 / 行动区；与先生多攀谈，可探得生路。〕' }
        ] }
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

  // 3) 塌墙根·无密道线索：封锁出口，只能退回劳役场
  TRIGGERS.push({
    id: 'wall_gate', hook: 'onEnter', room: 'camp_wall', once: false,
    cond: { notFlag: 'flags.route.crypt' },
    steps: [ { t: 'moveGate', fwd: 'camp_yard', hint: '塌墙根下空空荡荡，默叔不在——没有先生许可，这道墙根你过不去。先回场上寻先生。' } ]
  });

  // 4) 塌墙根·有线索：默叔守口，放行
  TRIGGERS.push({
    id: 'wall_open', hook: 'onEnter', room: 'camp_wall', once: false,
    cond: { flags: { 'flags.route.crypt': true } },
    steps: [ { t: 'clearGate' } ]
  });

  // 5) 默叔·引你入密道（逃逸枢纽）
  TRIGGERS.push({
    id: 'moshu_escort', hook: 'onTalk', npc: 'moshu', room: 'camp_wall', once: true,
    cond: { flags: { 'flags.route.crypt': true } },
    steps: [
      { t: 'npcTalk', npc: 'moshu',
        prompt: '默叔见是你，咧嘴无声一笑，朝塌墙根一指，又比了个「随我来」的手势。',
        asks: [
          { label: '（随默叔钻进塌墙根的暗道）',
            say: '你跟着默叔拨开乱砖，暗道幽深，潮气扑面。七拐八绕，头顶人声渐远——你们钻出了营墙。' }
        ] },
      { t: 'setFlag', path: 'flags.route.escaped_crypt', value: true },
      { t: 'setFlag', path: 'flags.onb.done', value: true },
      { t: 'clearGate' },
      { t: 'graduate' },
      { t: 'sys', text: '〔教学完成〕你已逃出苦役营。点下方移动罗盘「北」前往燕山·山口，寻穆长风接应。' }
    ]
  });

  // 6) 山口·穆长风接应（外部接应线切片）
  TRIGGERS.push({
    id: 'ys_contact', hook: 'onEnter', room: 'yanshan_shankou', once: true,
    cond: { flags: { 'flags.route.escaped_crypt': true } },
    steps: [
      { t: 'narrate', room: 'yanshan_shankou' },
      { t: 'log', cls: 'npc', npc: '穆长风', text: '穆长风斜倚隘口石上，见你钻出，咧嘴一笑：「出来了？老夫当年也是从这墙根爬出去的——结果又给抓了回来，哈哈！莫学我。」' },
      { t: 'log', cls: 'env', text: '「外头往南是白檀军屯，老相识在那儿当差。你既出了营，自去闯吧。江湖险恶，保重。」' },
      { t: 'setFlag', path: 'flags.route.contact', value: true },
      { t: 'log', cls: 'sys', text: '〔接应〕外部接应线已接驳：南去白檀军屯可寻穆长风旧识（开放世界钩子）。' }
    ]
  });

  LF.TRIGGERS = TRIGGERS;
  if (LF.SharedGame) LF.SharedGame.TRIGGERS = TRIGGERS;
  if (typeof module !== 'undefined' && module.exports) module.exports = TRIGGERS;
})(typeof window !== 'undefined' ? window : globalThis);

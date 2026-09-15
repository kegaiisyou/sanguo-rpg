// 乱世烽火 · NPC 装配器与交谈面板（v20260916c）
// 从 engine.js 抽离：人设卡装配（时辰 / 城况 / 格池 / 稳定 key / 姓名）、好感度记账、
// 台词轮播、交谈面板（话题 / 事务 / 观察 / 给予）。内容数据在 shared/data/npc_cards.js。
// 不读任何 window 裸全局——运行时依赖经 LF.createNpc(ctx) 注入，与 engine.js 解耦。
// 注意：state 在读档 / 新游戏时会被整体重赋值（Core.state = state = normalize(...)），
// 故一律经 S()=getState() 惰性取值（函数首行 `var state = S()`），绝不在工厂顶层捕获旧对象。
window.LF = window.LF || {};
(function () {
  LF.Core = LF.Core || {};

  // ctx 依赖（引擎注入）：
  //   G                —— SharedGame（ENEMIES：敌意卡「挑战」取敌人）
  //   LF               —— 数据：NPC_CARDS / NPC_NAMES / CITIES
  //   getState()       —— 实时 state（惰性）
  //   log/toast/save/renderStatus —— 输出与存档
  //   openModal/closeModal         —— 交谈弹窗
  //   exert            —— 事务动作（下田助农 / 籴粮）的体力与时辰判定
  //   narrActive/getAskPending/removeTutChoices —— 叙事窗占用状态（占用时不许开口）
  //   observeNpc/openGivePanel     —— 交谈面板底部「观察 / 给予」两个入口
  //   startCombat      —— 敌意卡「挑战」
  //   genCityGrid/cellDisplayType/seededRand —— City 助手
  //   getNPC_COMBAT_MAP —— NPC 卡 id → 敌人 id 映射（引擎常量，定义在引擎中段，故走 getter）
  LF.createNpc = function (ctx) {
    var G = ctx.G;
    var LF = ctx.LF;
    var getState = ctx.getState, S = getState;
    var log = ctx.log, toast = ctx.toast, save = ctx.save, renderStatus = ctx.renderStatus;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;
    var exert = ctx.exert;
    var narrActive = ctx.narrActive, getAskPending = ctx.getAskPending, removeTutChoices = ctx.removeTutChoices;
    var observeNpc = ctx.observeNpc, openGivePanel = ctx.openGivePanel;
    var startCombat = ctx.startCombat;
    var genCityGrid = ctx.genCityGrid, cellDisplayType = ctx.cellDisplayType, seededRand = ctx.seededRand;
    var getNPC_COMBAT_MAP = ctx.getNPC_COMBAT_MAP;

    // ══════════════════════════════════════════════════════════════════════════
    // 城市 NPC 装配器（v20260912d）—— 数据在 shared/data/npc_cards.js
    // ══════════════════════════════════════════════════════════════════════════
    // 旧版此处是 NPC_GEN：一个格型一个生成函数，台词内联、没有姓名、一个动作占一个按钮，
    // 且 key 不带坐标（`mkt_'+cid`），由此带出三个硬伤：
    //   ① 点「交谈」毫无反应 —— 生成器自带的「交谈」被 buildNpcActions 当重复项滤掉，
    //      换上的标准项走 talk(key)，而 talk 里 `G.DIALOGUES.npcs[key]` 查不到动态 key 就 return；
    //   ② 好感度串味 —— 一城几处市集共用一个 key，赠礼全记在同一笔账上；
    //   ③ 七十城一个腔调 —— 台词写死「渔阳」「黑山」，洛阳的营门哨也在讲苦役营的事。
    // 现在改为「人设卡 + 装配器」：卡只管内容（格型/作息/台词/话题/事务），
    // 装配器只管调度（时辰、城况、格池、稳定 key、姓名），新增角色 = 加一张卡。
    var NPC_CARDS = [], NPC_CARD_BY = {};
    (function () {
      var src = (LF.NPC_CARDS || []);
      for (var i = 0; i < src.length; i++) { var cd = src[i]; if (cd && cd.id) { NPC_CARDS.push(cd); NPC_CARD_BY[cd.id] = cd; } }
    })();
    // key → 最近一次生成的对象：talk(key) / 观察 / 给予都要按 key 反查回同一个「人」
    var NPC_BY_KEY = {};
    var NPC_BY_KEY_N = 0;
    function npcRegister(o) {
      if (!o || !o.key) return o;
      // v20260916c：原为 NPC_BY_KEY = {} 换新对象——但引擎（及 city.js）持有的是本对象的引用，
      // 换新的话外部那份会永远停在旧表上，观察 / 交谈便查不到人。改为原地清空，引用不变。
      if (NPC_BY_KEY_N > 1400) { for (var _k in NPC_BY_KEY) delete NPC_BY_KEY[_k]; NPC_BY_KEY_N = 0; }   // 防长局内存堆积（对象都很小，纯保险）
      NPC_BY_KEY[o.key] = o; NPC_BY_KEY_N++;
      return o;
    }
    // ── 时辰：教学期时间冻结时按「戌·入夜」评估，与具名角色作息（NPC_ROUTINES_CITY）同源 ──
    function npcHour() {
      var state = S();
      var onb = state.flags && state.flags.onb;
      if (onb && onb.started && !onb.done && !onb.clockOn) return 10;
      return (((state.time || 0) % 12) + 12) % 12;
    }
    // ── 城况用语：台词只引用客观情形，不涉国号（GAME_DESIGN §用词规范）──
    function npcFill(line, c, cnm, mktName) {
      if (line == null) return '';
      c = c || {};
      return String(line)
        .replace(/\{city\}/g, cnm || '此城')
        .replace(/\{comm\}/g, c.comm || '本郡')
        .replace(/\{state\}/g, c.state || '本州')
        .replace(/\{mkt\}/g, mktName || '市集')
        .replace(/\{order\}/g, (c.order >= 60 ? '治安尚安' : c.order >= 45 ? '治安平平' : '治安不靖'))
        .replace(/\{wealth\}/g, (c.commerce >= 60 ? '商旅繁盛' : c.commerce >= 45 ? '市井如常' : '商旅寥落'))
        .replace(/\{agri\}/g, (c.agri >= 60 ? '农事丰稔' : c.agri >= 45 ? '收成平平' : '田畴荒疏'))
        .replace(/\{wall\}/g, (c.wall >= 60 ? '甲械精良' : c.wall >= 45 ? '器械尚可' : '器械不齐'));
    }
    // ── 姓名：由 key 派生，故同一个 NPC 走开再回来仍是同一个名字 ──
    function npcNameOf(card, key) {
      if (!card.personal) return card.role || '路人';
      var NM = LF.NPC_NAMES;
      if (!NM) return card.role || '路人';
      var surs = NM.surnames || ['王'];
      var giv = (card.gender === 'f') ? (NM.givenF || ['阿妹']) : (NM.givenM || ['二郎']);
      var rnd = seededRand('npc|name|' + key);
      return (surs[Math.floor(rnd() * surs.length)] || '王') + (giv[Math.floor(rnd() * giv.length)] || '二郎');
    }
    // ── 好感度：按 key 记账（key 稳定且唯一 → 每个 NPC 各有一本账）──
    var FAVOR_TIERS = [
      { min: 80, name: '知己', cls: 'f-best' },
      { min: 40, name: '厚交', cls: 'f-good' },
      { min: 15, name: '相识', cls: 'f-ok' },
      { min: 1, name: '面熟', cls: 'f-meh' },
      { min: -9, name: '陌生', cls: '' },
      { min: -29, name: '戒备', cls: 'f-bad' },
      { min: -9999, name: '仇视', cls: 'f-worst' }
    ];
    // 好感读取兼容两种键（v20260915f）：任务脚本写卡 id（'sun_lao'）、给予面板写实例 key
    //   （'sun_lao@kuyilao:0,0#0'）。若各按各的键读，加了的好感在人物面板上看不出来 —— 故回退一次。
    function npcFavor(key) {
      var state = S();
      if(!key || !state.npcFavor) return 0;
      if(state.npcFavor[key] != null) return state.npcFavor[key];
      return state.npcFavor[String(key).split('@')[0]] || 0;
    }
    function npcFavorTier(v) { for (var i = 0; i < FAVOR_TIERS.length; i++) { if (v >= FAVOR_TIERS[i].min) return FAVOR_TIERS[i]; } return FAVOR_TIERS[FAVOR_TIERS.length - 1]; }
    function addNpcFavor(key, n) {
      var state = S();
      if (!key || !n) return 0;
      if (!state.npcFavor) state.npcFavor = {};
      state.npcFavor[key] = (state.npcFavor[key] || 0) + n;
      return state.npcFavor[key];
    }
    function npcFavorPct(v) { return Math.max(3, Math.min(100, Math.round((v + 100) / 2))); }
    // ── 台词轮播：顺序推进而非随机取，同一个人不会连着说三遍同一句 ──
    function npcRotate(seqKey, arr) {
      var state = S();
      if (!arr || !arr.length) return '';
      if (!state.npcSeq) state.npcSeq = {};
      var idx = (state.npcSeq[seqKey] || 0) % arr.length;
      state.npcSeq[seqKey] = idx + 1;
      return arr[idx];
    }
    function npcLine(o, tpl) { return npcFill(tpl, o._c, o._cnm, o._mkt); }
    // 该 NPC 此刻的一句闲谈（好感度到「相识」后换用 warm 池）
    function npcSmallTalk(o) {
      var pool = (npcFavor(o.key) >= 15 && o.card.warm && o.card.warm.length) ? o.card.warm : (o.card.says || []);
      return npcLine(o, npcRotate(o.key + '|s', pool));
    }
    // ── 装配：格型 × 时辰 × 城况 → 本格该有谁 ──
    function npcHourOK(card, hour) { return !card.hours || card.hours.indexOf(hour) >= 0; }
    // 某几个格型的格坐标池（按 y*size+x 升序，稳定）—— roam 卡按序号取模落点，故同一时刻只在一处（不分身）。
    // 用 cellDisplayType 而非 m.cells：只有「此刻真走得进」的格才收进池子，
    // 否则首都在开发半径外的 unbuilt 格会把唯一的货郎/乞儿关进去，玩家一辈子见不着。
    function npcCellPool(cid, m, types) {
      var out = [];
      for (var yy = 0; yy < m.size; yy++) for (var xx = 0; xx < m.size; xx++) {
        if (types.indexOf(cellDisplayType(cid, xx, yy)) >= 0) out.push(xx + ',' + yy);
      }
      return out;
    }
    function npcCountOf(card, c) {
      var n = card.count; if (n == null) n = 1;
      if (typeof n === 'object') {
        n = (n.base || 0) + Math.floor(((c && c.pop) || 50) * (n.perPop || 0));
        if (n.max != null && n > n.max) n = n.max;
        if (n < 0) n = 0;
      }
      return n | 0;
    }
    function npcEligible(card, cid, hour, c) {
      if (!card) return false;
      if (card.except && card.except.indexOf(cid) >= 0) return false;
      if (!npcHourOK(card, hour)) return false;
      var cd = card.cond;
      if (cd) {
        if (cd.orderBelow != null && !((c.order || 0) < cd.orderBelow)) return false;
        if (cd.orderAbove != null && !((c.order || 0) > cd.orderAbove)) return false;
        if (cd.popAbove != null && !((c.pop || 0) > cd.popAbove)) return false;
      }
      return true;
    }
    // 该卡在本格露面的实例序号；null = 不在本格
    function npcSlotsHere(card, cid, cellType, hour, c, m, here) {
      var n = npcCountOf(card, c); if (n <= 0) return null;
      var kinds = card.kinds || [];
      if (card.roam) {
        var roaming = card.roam.hours && card.roam.hours.indexOf(hour) >= 0;
        var pool = npcCellPool(cid, m, roaming ? (card.roam.to || []) : kinds);
        if (!pool.length) return null;
        // 游荡时段每过一个时辰整体前移一格 —— 街面上的人真的在走动，而不是钉死在某处
        var step = roaming ? (hour % pool.length) : 0;
        var idxs = [];
        for (var i = 0; i < n; i++) { if (pool[(i + step) % pool.length] === here) idxs.push(i); }
        return idxs.length ? idxs : null;
      }
      if (kinds.indexOf(cellType) < 0) return null;
      var all = []; for (var j = 0; j < n; j++) all.push(j);
      return all;
    }
    function npcMake(card, cid, x, y, slot, c, cnm, mktName) {
      var key = card.id + '@' + cid + ':' + x + ',' + y + '#' + slot;
      var o = {
        key: key, card: card, cardId: card.id, cid: cid, x: x, y: y, slot: slot,
        cell: x + ',' + y,
        name: npcNameOf(card, key),
        role: card.role || '', icon: card.icon || '👤', desc: card.desc || '',
        align: card.align || 'neutral', hostile: !!card.danger,
        _c: c, _cnm: cnm, _mkt: mktName
      };
      return npcRegister(o);
    }
    // 敌意卡（溃兵之流）：不给「交谈」，只给挑战
    function npcHostileActs(o) {
      var eid = ((G.ENEMIES && G.ENEMIES[o.cardId]) ? o.cardId : ((getNPC_COMBAT_MAP()[o.cardId] || [])[0] || null)) || 'deserter';
      return [{ label: '挑战', icon: '⚔', danger: true, fn: function () { startCombat(eid); } }];
    }
    // city.js 的 cityCellNpcs 调此函数取「本格生成的城市 NPC」（签名沿用旧的 (cid,x,y)）
    function buildCityCellNpcs(cid, x, y) {
      var m = genCityGrid(cid); if (!m) return [];
      var c = (LF.CITIES || {})[cid] || {};
      var cnm = c.name || '此城', here = x + ',' + y;
      var cellType = cellDisplayType(cid, x, y);
      var hour = npcHour();
      var mk = m.markets && m.markets[here];
      var mktName = mk ? mk.name : '市集';
      var out = [];
      for (var i = 0; i < NPC_CARDS.length; i++) {
        var card = NPC_CARDS[i];
        if (!npcEligible(card, cid, hour, c)) continue;
        var slots = npcSlotsHere(card, cid, cellType, hour, c, m, here);
        if (!slots) continue;
        for (var s = 0; s < slots.length; s++) {
          var o = npcMake(card, cid, x, y, slots[s], c, cnm, mktName);
          // 标准动作列（交谈/观察/给予/攻击）由 renderNpcList 统一补；敌意卡自带且只带「挑战」
          out.push({ o: o, acts: o.hostile ? npcHostileActs(o) : [] });
        }
      }
      return out;
    }
    // ══════════════════════════════════════════════════════════════════════════
    // 交谈面板：把「问价 / 问农 / 问政 / 探问 / 查账 / 讨教 …」这些
    //   本来各占一个按钮的内容统一收进「交谈」，作为话题呈现。
    // ══════════════════════════════════════════════════════════════════════════
    var talkNpc = null;
    function openTalkPanel(o) {
      if (!o || !o.key) return;
      if (getAskPending()) { toast('先把眼前的话应了。'); return; }
      removeTutChoices();
      if (narrActive()) { toast('……且听他把话说完。'); return; }
      talkNpc = o;
      openModal('talk', { npc: o });
    }
    // 每天每话题首次聊起 +1 好感（闲聊不刷，防原地刷好感）
    function npcTopicOnce(o, topicId) {
      var state = S();
      if (!state.npcTopic) state.npcTopic = {};
      var rec = state.npcTopic[o.key] || (state.npcTopic[o.key] = {});
      var day = state.day || 1;
      if (rec[topicId] === day) return false;
      rec[topicId] = day;
      return true;
    }
    function npcTalkPrefix(o) { return '〔' + o.name + (o.role ? '·' + o.role : '') + '〕'; }
    function npcSpeak(o, topic) {
      var state = S();
      var line;
      if (topic && topic.lines && topic.lines.length) line = npcLine(o, npcRotate(o.key + '|t|' + topic.id, topic.lines));
      else line = npcSmallTalk(o);
      if (!line) line = '「……」';
      log(npcTalkPrefix(o) + line, 'npc', o.name);
      if (topic && topic.favor) { addNpcFavor(o.key, topic.favor); }
      else if (topic && npcTopicOnce(o, topic.id)) {
        addNpcFavor(o.key, 1);
        log('〔' + o.name + '·好感 +1〕', 'good');
      }
      save(state);
      return line;
    }
    // 事务（有副作用的动作）：数据侧只写 engine:'xxx'，实现集中在此表
    var NPC_ACT_IMPL = {
      farm_help: function (o) {
        var state = S();
        if (!exert('下田助农')) return '';
        state.food = Math.min(state.maxFood, state.food + 12);
        log('〔农庄〕你下田搭了把手，庄头塞来新麦（粮草+12）。', 'good');
        return '「壮士好力气！这点新麦拿去。」';
      },
      farm_buy: function (o) {
        var state = S();
        if (!exert('向农籴粮')) return '';
        state.food = state.maxFood;
        log('〔农庄〕你向庄头籴粮，行囊充实（粮草补满）。', 'good');
        return '「粮在囤里，壮士自己量。」';
      }
    };
    function talkTopicBtns(o) {
      var tp = o.card.topics || [], h = '';
      for (var i = 0; i < tp.length; i++) {
        h += '<button class="talk-btn" data-topic="' + tp[i].id + '">'
          + '<span class="tb-ic">' + (tp[i].icon || '💬') + '</span><span class="tb-lb">' + tp[i].label + '</span></button>';
      }
      return h;
    }
    function talkActBtns(o) {
      var ac = o.card.acts || [], h = '';
      for (var i = 0; i < ac.length; i++) {
        h += '<button class="talk-btn talk-btn-act" data-topic-act="' + ac[i].id + '" title="' + (ac[i].tip || '') + '">'
          + '<span class="tb-ic">' + (ac[i].icon || '·') + '</span><span class="tb-lb">' + ac[i].label + '</span></button>';
      }
      return h;
    }
    function talkFavorHTML(o) {
      var v = npcFavor(o.key), t = npcFavorTier(v);
      return '<div class="talk-fav ' + t.cls + '">'
        + '<div class="tf-bar"><i style="width:' + npcFavorPct(v) + '%"></i></div>'
        + '<div class="tf-lb">' + t.name + ' · ' + (v > 0 ? '+' : '') + v + '</div></div>';
    }
    function renderTalkPanel(o) {
      if (!o) return '<h3>交 谈</h3><p>未指定对象。</p>';
      var topics = talkTopicBtns(o), acts = talkActBtns(o);
      return '<div class="talk-panel">'
        + '<div class="talk-head">'
        +   '<span class="talk-av">' + (o.icon || '👤') + '</span>'
        +   '<div class="talk-id"><div class="talk-nm">' + o.name + '</div>'
        +     '<div class="talk-role">' + (o.role || '') + '</div></div>'
        +   '<div class="talk-fav-wrap">' + talkFavorHTML(o) + '</div>'
        + '</div>'
        + '<div class="talk-line" id="talk-line">' + npcSmallTalk(o) + '</div>'
        + (topics ? '<div class="talk-sec">话题</div><div class="talk-grid">' + topics + '</div>' : '')
        + (acts ? '<div class="talk-sec">事务</div><div class="talk-grid">' + acts + '</div>' : '')
        + '<div class="talk-foot">'
        +   '<button class="talk-foot-btn" id="talk-observe">👁 观察</button>'
        +   '<button class="talk-foot-btn" id="talk-give">🎁 给予</button>'
        +   '<button class="talk-foot-btn" id="talk-close">告 辞</button>'
        + '</div>'
        + '</div>';
    }
    function talkSetLine(txt) {
      var el = document.getElementById('talk-line'); if (el) el.textContent = txt || '';
      var box = document.querySelector('.talk-fav-wrap');
      if (box && talkNpc) box.innerHTML = talkFavorHTML(talkNpc);
    }
    function bindTalkPanel() {
      var o = talkNpc; if (!o) return;
      var card = document.getElementById('modal-card'); if (!card) return;
      card.querySelectorAll('[data-topic]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-topic');
          var t = (o.card.topics || []).filter(function (x) { return x.id === id; })[0];
          talkSetLine(npcSpeak(o, t));
        };
      });
      card.querySelectorAll('[data-topic-act]').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute('data-topic-act');
          var a = (o.card.acts || []).filter(function (x) { return x.id === id; })[0];
          var impl = a && a.engine && NPC_ACT_IMPL[a.engine];
          var said = impl ? impl(o) : '';
          if (said === '' && !impl) { toast('此事此刻做不得。'); return; }
          talkSetLine(said || npcSmallTalk(o));
          renderStatus();
        };
      });
      var ob = document.getElementById('talk-observe');
      if (ob) ob.onclick = function () { closeModal(); observeNpc(o); };
      var gv = document.getElementById('talk-give');
      if (gv) gv.onclick = function () { openGivePanel(o); };
      var cl = document.getElementById('talk-close');
      if (cl) cl.onclick = function () { closeModal(); log(npcTalkPrefix(o) + '你与之拱手作别。', 'sys'); };
    }

    return {
      NPC_CARDS: NPC_CARDS, NPC_CARD_BY: NPC_CARD_BY, NPC_BY_KEY: NPC_BY_KEY,
      npcRegister: npcRegister, npcHour: npcHour, npcFill: npcFill, npcNameOf: npcNameOf,
      FAVOR_TIERS: FAVOR_TIERS, npcFavor: npcFavor, npcFavorTier: npcFavorTier,
      addNpcFavor: addNpcFavor, npcFavorPct: npcFavorPct, npcRotate: npcRotate, npcLine: npcLine,
      npcSmallTalk: npcSmallTalk, npcHourOK: npcHourOK, npcCellPool: npcCellPool,
      npcCountOf: npcCountOf, npcEligible: npcEligible, npcSlotsHere: npcSlotsHere, npcMake: npcMake,
      npcHostileActs: npcHostileActs, buildCityCellNpcs: buildCityCellNpcs,
      openTalkPanel: openTalkPanel, npcTopicOnce: npcTopicOnce, npcTalkPrefix: npcTalkPrefix,
      npcSpeak: npcSpeak, NPC_ACT_IMPL: NPC_ACT_IMPL,
      talkTopicBtns: talkTopicBtns, talkActBtns: talkActBtns, talkFavorHTML: talkFavorHTML,
      renderTalkPanel: renderTalkPanel, talkSetLine: talkSetLine, bindTalkPanel: bindTalkPanel,
      getTalkNpc: function () { return talkNpc; }
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createNpc;
})();

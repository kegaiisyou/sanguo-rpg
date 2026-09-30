// NPC 内驱力 · 年代位置 · 自由流动 · 委托（v20260927k）
// 目的：让历史名将真正「活」在场景里，而不是只躺在名册面板中。
//   ① 内驱力（drive）：义理/野心/面子/财欲/好武/嗜酒 六维，驱动 NPC 说什么、去哪、想要什么。
//   ② 位置（place）：籍贯为根，可因流动改驻（flags.npcTravel），日后可接 timeline（年份→城）。
//   ③ 落格（wander）：按首要内驱力挑格型——好武进演武场，嗜酒入市集酒肆，野心趋衙署中军，
//      财欲趋市，义理游于市井闾里。同一人每日只落一格，杜绝分身。
//   ④ 流动（tickDay）：按内驱力决定去向——野心逐鹿大城，好武趋边地，余人就近转徙。
//   ⑤ 委托（quest）：内驱力直接变成「我想要什么」——嗜酒者讨酒，好武者讨兵刃，义理者讨粮济民，
//      财欲者借钱，野心者募资起事。委托由 NPC 主动提出，玩家交付后得好感/声望/回赠。
//   ⑥ 郊野偶遇（famousInField）：名将不只待在城里，好武/嗜酒者会出门游猎于野。
// 设计取舍：本模块【不碰】city.js 的几何生成，只做「谁在哪、想要什么」，由 city.js / field.js 询问后渲染。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createNpcAi = function (ctx) {
    ctx = ctx || {};
    function S() { return (typeof ctx.getState === 'function') ? ctx.getState() : null; }
    function log(m, c) { if (typeof ctx.log === 'function') ctx.log(m, c || 'sys'); }
    function toast(m) { if (typeof ctx.toast === 'function') ctx.toast(m); }
    function saveIt() { var s = S(); if (s && typeof ctx.save === 'function') ctx.save(s); }
    function roster() { var s = S(); return (s && s.officers) || []; }
    function itemName(id) {
      var it = (LF.ITEMS && (LF.ITEMS[id] || (LF.ITEMS.DEFS && LF.ITEMS.DEFS[id]))) || null;
      return it ? (it.name || id) : id;
    }
    function countItem(id) {
      if (typeof ctx.packFind !== 'function') return 0;
      var c = ctx.packFind(id);
      return c ? (c.count || 1) : 0;
    }

    var DKEYS = ['yi', 'xin', 'mian', 'cai', 'wu', 'jiu'];
    var DNAME = { yi: '义理', xin: '野心', mian: '面子', cai: '财欲', wu: '好武', jiu: '嗜酒' };
    // 各内驱力偏好的城格型（与 city.js 的 cellDisplayType 对齐）
    var DPREF = {
      wu:   ['drill', 'barracks'],
      jiu:  ['market'],
      xin:  ['gov', 'command'],
      cai:  ['market'],
      yi:   ['market', 'resid'],
      mian: ['resid', 'gov']
    };

    function personae() {
      return (LF.PERSONA && typeof LF.PERSONA.listRegistered === 'function') ? LF.PERSONA.listRegistered() : [];
    }
    function clamp(v) { return Math.max(0, Math.min(100, Math.round(v || 0))); }
    function hit(txt, words) {
      txt = txt || '';
      for (var i = 0; i < words.length; i++) if (txt.indexOf(words[i]) >= 0) return 1;
      return 0;
    }
    function hash(s) {
      var h = 2166136261;
      for (var i = 0; i < (s || '').length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }

    // ── 内驱力：显式数据优先，否则由五维 + 标签/小传推导 ──
    function driveOf(t) {
      var d = {}; DKEYS.forEach(function (k) { d[k] = 0; });
      if (!t) return d;
      if (t.drive) { DKEYS.forEach(function (k) { d[k] = clamp(t.drive[k] || 0); }); return d; }
      var s = t.stats || {};
      var txt = ((t.tags) || []).join('') + ' ' + (t.bio || '') + ' ' + (t.title || '');
      d.yi   = 25 + ((s.mei || 50) - 50) * 0.5 + hit(txt, ['忠义', '汉室', '义士', '烈', '仁德', '鞠躬']) * 30;
      d.xin  = 20 + ((s.tong || 50) - 50) * 0.4 + ((s.zhi || 50) - 50) * 0.2 + hit(txt, ['枭雄', '雄心', '大志', '霸业', '不臣', '奸雄']) * 35;
      d.mian = 20 + ((s.mei || 50) - 50) * 0.6 + hit(txt, ['名望', '矜', '傲', '名士', '清议']) * 25;
      d.cai  = 15 + hit(txt, ['贪', '财', '货殖', '商贾', '敛', '聚敛']) * 40;
      d.wu   = ((s.wu || 50) - 50) * 0.9 + hit(txt, ['猛', '勇', '万人敌', '骁', '斗', '冠三军']) * 35;
      d.jiu  = hit(txt, ['酒', '醉', '饮', '酣', '樽']) * 45;
      DKEYS.forEach(function (k) { d[k] = clamp(d[k]); });
      return d;
    }
    function topDesire(t) {
      var d = driveOf(t), best = 'yi', bv = -1;
      DKEYS.forEach(function (k) { if (d[k] > bv) { bv = d[k]; best = k; } });
      return { key: best, name: DNAME[best] || best, val: bv };
    }
    function driveText(t) {
      var d = driveOf(t), top = topDesire(t), out = [];
      DKEYS.forEach(function (k) { if (d[k] >= 40) out.push(DNAME[k] + d[k]); });
      return out.length ? out.join(' ') : (top.name + top.val);
    }

    // ── 位置：流动记录 > 籍贯（timeline 留待数据扩展）──
    function travelMap() { var s = S(); if (!s) return {}; s.flags = s.flags || {}; return s.flags.npcTravel || (s.flags.npcTravel = {}); }
    function placeOf(t) {
      if (!t) return null;
      var tr = travelMap();
      if (tr[t.id]) return tr[t.id];
      if (t.timeline) {  // 数据形如 { 184:'zhuo', 190:'luoyang' }：取不晚于当前年份的最近一条
        var y = yearNow();
        if (y) { var hitY = null; Object.keys(t.timeline).forEach(function (k) { var n = parseInt(k, 10); if (!isNaN(n) && n <= y && (hitY === null || n > hitY)) hitY = n; }); if (hitY !== null) return t.timeline[hitY]; }
      }
      return t.home || null;
    }
    function yearNow() {
      var s = S(); if (!s) return null;
      return (s.flags && s.flags.year) || s.year || null;
    }
    function travelTo(id, cid) { var tr = travelMap(); tr[id] = cid; }

    // ── 落格：按首要内驱力在同型格中稳定选一格（同人同日只落一处）──
    function wander(t, cellsByType) {
      var top = topDesire(t).key;
      var pref = DPREF[top] || ['resid'];
      var pool = [];
      for (var i = 0; i < pref.length && !pool.length; i++) pool = (cellsByType[pref[i]] || []).slice();
      if (!pool.length) return null;   // 该城无其偏好格型则不露面（宁缺毋滥，避免满街乱站）
      return pool[hash(t.id) % pool.length];
    }

    function taken(t) {   // 已在麾下 / 已随行 / 已故：不再游荡于市
      var st = S(); if (!st || !t) return true;
      var inR = roster().some(function (o) { return o && o.id === t.id; });
      var rec = (st.flags && st.flags.recruited) || {};
      return inR || !!rec[t.id];
    }

    // ── 地产：城中置业（v20260927k）──
    // 玩家可于里坊/市集经牙人购置正宅，得「房契」一纸（道具 house_deed），产权记 flags.properties[cid]。
    // 房契亦可赠予渴望安居的名将（面子/名望型 NPC 的委托正是「求一纸房契」），故置业不只是摆设。
    function cityNameOf(cid) { var c = (LF.CITIES || {})[cid] || {}; return c.name || cid; }
    function estatePrice(cid) {
      var c = (LF.CITIES || {})[cid] || {};
      return 200 + (c.grid || 5) * 60;      // 城越大，宅价越高（涿县500 → 洛阳740）
    }
    function ownsEstate(cid) {
      var s = S(); if (!s) return false;
      return !!((s.flags && s.flags.properties) || {})[cid];
    }
    function buyEstate(cid) {
      var s = S(); if (!s) return false;
      var price = estatePrice(cid);
      if (ownsEstate(cid)) { toast('你在此城已有宅院。'); return false; }
      if ((s.gold || 0) < price) { toast('银两不足——' + cityNameOf(cid) + '正宅需 ' + price + ' 两。'); return false; }
      s.gold -= price;
      s.flags = s.flags || {};
      s.flags.properties = s.flags.properties || {};
      s.flags.properties[cid] = { type: 'residence', bought: s.day || 0, price: price };
      if (typeof ctx.packAdd === 'function') ctx.packAdd('house_deed', 1);
      log('你于牙行画押、纳银 ' + price + ' 两，购得' + cityNameOf(cid) + '正宅一处——房契已收入行囊。', 'good');
      saveIt();
      return true;
    }
    // 牙人卡：由 city.js 挂在里坊/市集格（内联 fn，走引擎 toggleObjExpand 的 a.fn 调用）
    function estateCard(cid) {
      var price = estatePrice(cid), owned = ownsEstate(cid), acts = [];
      if (owned) {
        acts.push({ label: '打理宅院', icon: '🏠', fn: function () {
          var pr = ((S().flags || {}).properties || {})[cid] || {};
          log('你的宅院：' + cityNameOf(cid) + '正宅（' + (pr.price || '?') + ' 两购入）。乱世之中，总算有一处可闭门安歇的所在。', 'sys');
        } });
      } else {
        acts.push({ label: '置业·' + price + '两', icon: '🏠', fn: function () { buyEstate(cid); } });
        acts.push({ label: '问房价', icon: '🧾', fn: function () {
          log('牙人陪笑：「' + cityNameOf(cid) + '城中，正宅一处作价 ' + price + ' 两。契上署印画押，便是足下的产业了。」', 'sys');
        } });
      }
      return {
        o: { name: '牙人', icon: '🧾', key: 'estate_' + cid, desc: '牙行中人，专司城中田宅交易', role: '牙人' },
        acts: acts
      };
    }

    // ── 在此城的可遇名将（含麾下/已随从过滤）──
    function eachFamous(cid, cellsByType, cb) {
      var st = S(); if (!st || typeof cb !== 'function') return;
      personae().forEach(function (t) {
        if (!t || !t.id) return;
        if (taken(t)) return;                           // 已在麾下/已随行，不再游荡于市
        if (placeOf(t) !== cid) return;                 // 不在此城
        var pos = wander(t, cellsByType);
        if (pos) cb(t, pos, topDesire(t));
      });
    }

    // ── 郊野偶遇：名将不只窝在城里，好武/嗜酒者会出门游猎 ──
    // room 为郊野房间；所属城 = LF.PLACES[fid].parent 或 LF.Travel.fields[fid].place（须确在 LF.CITIES 中）
    // 每名将固定“出没”于其所属城郊野中的唯一一片（hash(tid+k) 最小者），避免整片野外交互都刷出同一人、像跟随玩家
    var _haunt = {};
    function hauntField(tid, pid) {
      var key = tid + '@' + pid;
      if (_haunt[key]) return _haunt[key];
      var best = null, bestH = Infinity;
      var P = LF.PLACES || {};
      for (var k in P) {
        var q = P[k];
        if (q && q.kind === 'field' && q.parent === pid) {
          var h = hash(tid + k);
          if (h < bestH) { bestH = h; best = k; }
        }
      }
      _haunt[key] = best;
      return best;
    }
    function famousInField(room) {
      var st = S(); if (!st || !room) return [];
      var fid = room.fieldId; if (!fid) return [];
      var pl = (LF.PLACES || {})[fid] || {};
      var meta = ((LF.Travel && LF.Travel.fields) || {})[fid] || {};
      var pid = pl.parent || meta.place;
      if (!pid || !(LF.CITIES || {})[pid]) return [];       // 只认城郊（非城地点下辖的野地不派名将）
      var OUTP = { wu: 0.50, jiu: 0.35, xin: 0.25, cai: 0.20, yi: 0.15, mian: 0.10 };
      var out = [];
      var _ff = st.flags.fieldFame || (st.flags.fieldFame = {});
      personae().forEach(function (t) {
        if (!t || !t.id) return;
        if (taken(t)) return;
        if (placeOf(t) !== pid) return;                     // 只在本城郊野出没
        var top = topDesire(t).key;
        var p = OUTP[top] || 0.15;
        if (hauntField(t.id, pid) !== fid) return;   // 仅固定出没的那一片郊野（消除“跟随式”重复偶遇）
        var _fk = fid + ':' + t.id;
        if (_ff[_fk]) return;                        // 今日已在此片郊野偶遇过，不再重复刷（消“每次移动都偶遇”）
        if (Math.random() > p) return;               // 按内驱力概率决定是否出门游猎（非必现）
        _ff[_fk] = 1;                                // 标记今日已遇
        out.push(t);
      });
      return out.slice(0, 2);
    }
    function fieldLine(t) {
      var top = topDesire(t).key;
      if (top === 'wu') return t.name + '正于林间空地舒拳踢腿，一招一式带着风声——见你来，收势抱拳：「来得好，可敢与某走两遭？」';
      if (top === 'jiu') return t.name + '倚树而坐，腰间悬着一葫芦酒，仰面灌了一口：「这野地里的风，配酒正好。」';
      if (top === 'xin') return t.name + '立于高坡远望城郭，指点山川之势，口中喃喃似在算计什么。';
      if (top === 'cai') return t.name + '在道旁与行商低声议价，见你来便住了口，袖中似有算筹响动。';
      if (top === 'mian') return t.name + '衣冠齐整，独坐道旁石上，似在等人来请。';
      return t.name + '行于野径，见你便驻足颔首：「足下亦远行乎？」';
    }

    // ── 委托：内驱力 → 「我想要什么」 ──
    // 需求只用 items.js 中确有的道具（jiu 黍酒 / gumao 骨矛 / dou 菽豆 / maopi 毛皮），
    // 免得造出不存在的物品导致任务永远交不掉。
    var QD = {
      jiu:  { kind: 'item', item: 'jiu',   count: 1, title: '讨一壶酒',   ask: '某走遍州郡，只为寻一坛好酒。足下若能寻一壶「黍酒」来，某必有厚报。', thx: '好酒！足下真是解人——这份情某记下了。' },
      wu:   { kind: 'item', item: 'gumao', count: 1, title: '求一杆兵刃', ask: '某这双拳脚正痒，可惜手中无趁手的家伙。寻一杆「骨矛」来，某与你走两遭。', thx: '好家伙！合手，甚合手——某今日便要开张。' },
      yi:   { kind: 'item', item: 'dou',   count: 3, title: '济民之粮',   ask: '城外流民嗷嗷待哺，某欲施粥，尚缺三份「菽豆」。足下可肯相助？', thx: '此豆虽微，活人不少。足下之义，某代饥民谢过。' },
      // 面子/名望者渴望体面居所 → 求一纸房契（与地产系统串联：玩家先置业，方可赠予）
      mian: { kind: 'item', item: 'house_deed', count: 1, title: '求一纸房契', ask: '某欲在此城置一处安身之所，奈何市面房契难求，牙人又漫天要价。足下若得「房契」一纸，某愿以重金相谢。', thx: '好！有此一纸，某便算在此城落下脚了——此恩某记下了。' },
      cai:  { kind: 'gold', gold: 200,               title: '周转银钱',   ask: '某近来手头拮据，欲借银二百两周转。他日必当厚报，绝不食言。', thx: '足下真豪爽！这笔钱某记在账上，来日加倍奉还。' },
      xin:  { kind: 'gold', gold: 300,               title: '资助起事',   ask: '大丈夫当据方面，岂可久居人下？某欲图大事，所缺者不过三百两起事的资财。足下可愿入伙？', thx: '好！待某成事，足下当为首功——此日可期。' }
    };
    function questOf(t) {
      var d = driveOf(t), top = topDesire(t).key, use = top;
      // 「求宅」不看是否首要欲望：50 位名将实测无一人以「面子」为首要（mian 公式上限偏低，
      // 总被义理/野心/好武压过），若只挂首要内驱力，房契委托将永不见天日、地产链路断掉。
      // 故改为：面子/名望较重者（≥40）即有半数机会改为求一纸房契。
      if (d.mian >= 40 && hash(t.id + 'estate') % 100 < 50) use = 'mian';
      var q = QD[use] || QD.yi;
      return {
        key: use, kind: q.kind, item: q.item || null, count: q.count || 1,
        gold: q.gold || 0, title: q.title, ask: q.ask, thx: q.thx,
        need: (q.kind === 'gold') ? (q.gold + ' 两银') : (q.count + ' ×' + itemName(q.item))
      };
    }
    function questMap() { var s = S(); if (!s) return {}; s.flags = s.flags || {}; return s.flags.npcQuests || (s.flags.npcQuests = {}); }
    function questReady(q) {
      if (q.kind === 'gold') return (S().gold || 0) >= q.gold;
      return countItem(q.item) >= q.count;
    }
    function questState(t) {
      var q = questOf(t), m = questMap()[t.id];
      if (!m) return { phase: 'none', q: q, m: null };
      if (m.done) return { phase: 'done', q: q, m: m };
      return { phase: questReady(q) ? 'ready' : 'taken', q: q, m: m };
    }
    function offerQuest(t) {
      var q = questOf(t), m = questMap();
      if (m[t.id]) return false;
      m[t.id] = { drive: q.key, kind: q.kind, item: q.item, count: q.count, gold: q.gold, took: (S().day || 0), done: false };
      saveIt();
      return true;
    }
    function deliverQuest(t) {
      var st = questState(t), q = st.q;
      if (st.phase !== 'ready') return false;
      if (q.kind === 'gold') {
        S().gold = (S().gold || 0) - q.gold;
      } else {
        if (typeof ctx.packConsume !== 'function') return false;
        if (!ctx.packConsume(q.item, q.count)) return false;
      }
      var m = questMap()[t.id]; m.done = true;
      // 酬谢：声望 + 回赠银两（按内驱力轻重有别）
      var rep = ({ yi: 3, xin: 2, wu: 2, jiu: 1, cai: 1, mian: 2 })[q.key] || 2;
      var back = Math.round((q.kind === 'gold' ? q.gold * 0.8 : 60) + rep * 20);
      if (typeof ctx.addRep === 'function') ctx.addRep(rep);
      S().gold = (S().gold || 0) + back;
      if (typeof ctx.addXp === 'function') ctx.addXp(30);
      log('你交付了' + q.need + '——' + t.name + '大喜：「' + q.thx + '」（声望+' + rep + '，银两+' + back + '，修为+30）', 'good');
      saveIt();
      return true;
    }

    // ── 人物卡：倾谈（按内驱力给不同台词）/ 委托 / 在野者可登庸 ──
    // 注意 act 名不可叫「交谈/观察/给予/攻击」——engine.js:1857 会把这些 label 的自定义动作
    // 整条过滤掉（城市 NPC 统一走 buildNpcActions 的标准列），故这里改叫「倾谈」「细观」。
    function cardOf(t) {
      var top = topDesire(t), acts = [];
      acts.push({ label: '倾谈', icon: '💬', fn: function () { log(t.name + '：' + talkLine(t, top), 'sys'); } });
      acts.push({ label: '细观', icon: '👁', fn: function () {
        log('你细观' + t.name + '——' + ((t.title) ? t.title + '，' : '') + '此人' + top.name + '之心甚重（' + driveText(t) + '）。', 'sys');
      } });
      // 委托：受托 → 交付
      var qs = questState(t);
      if (qs.phase === 'none') {
        acts.push({ label: '受托', icon: '📜', fn: function () {
          if (offerQuest(t)) { log(t.name + '：「' + qs.q.ask + '」', 'sys'); log('〔受托〕' + t.name + '所求：' + qs.q.need + '（' + qs.q.title + '）', 'good'); }
        } });
      } else if (qs.phase === 'taken') {
        acts.push({ label: '问所求', icon: '📜', fn: function () {
          log(t.name + '：「' + qs.q.ask + '」——尚缺 ' + qs.q.need + '。', 'sys');
        } });
      } else if (qs.phase === 'ready') {
        acts.push({ label: '交付·' + qs.q.title, icon: '📦', fn: function () { deliverQuest(t); } });
      } else {
        acts.push({ label: '叙旧', icon: '🍶', fn: function () { log(t.name + '：「' + qs.q.thx + '」', 'sys'); } });
      }
      if (t.faction === '在野' && typeof ctx.recruit === 'function') {
        acts.push({ label: '礼聘登庸', icon: '🤝', fn: function () { ctx.recruit(t.id); } });
      }
      return {
        o: { name: t.name, icon: '🧑', key: 'famous_' + t.id, desc: (t.title || '名士') + '（' + top.name + '）', role: t.title },
        acts: acts
      };
    }
    function talkLine(t, top) {
      var n = hash(t.id + (top ? top.key : '')) % 3;
      if (!top) return '足下有何见教？';
      if (top.key === 'yi') return ['汉室倾颓，奸臣窃命——某虽不才，愿以微躯扶之。', '天下兴亡，匹夫有责。足下若举义旗，某愿效前驱。', '某所求者，非爵禄，乃社稷耳。'][n];
      if (top.key === 'xin') return ['大丈夫当据方面，建号立国，岂可久居人下？', '此间城小，非某久恋之地——天下大者可图。', '时机未至耳；一至，某当自取之。'][n];
      if (top.key === 'mian') return ['某之名，当传于青史——足下他日若闻，当知某不负此生。', '清议所归，士林所重，某岂敢自轻？', '名爵者，士人之羽翼也，不可不重。'][n];
      if (top.key === 'cai') return ['足下囊中似有长物？某正欲周转一二……', '泉货流通，才是活水；屯而不行，与土何异？', '若有生财之道，某愿闻其详。'][n];
      if (top.key === 'wu') return ['某这双拳脚，正痒得紧——足下可敢下场走两遭？', '天下英雄，某欲尽会之，方知高下。', '演武场上见真章，嘴上功夫作不得数。'][n];
      if (top.key === 'jiu') return ['此处可有佳酿？某走遍州郡，只为寻一坛好酒。', '无酒不成欢——足下若有某地之名酿，望不吝见告。', '酒入豪肠，绣口一吐，便是半个盛唐……咳，半个乱世。'][n];
      return '足下有何见教？';
    }

    // 两城距离（里，按经纬度粗算；与 officers.js 的 dist 同法）
    function cityDist(a, b) {
      var A = (LF.CITIES || {})[a], B = (LF.CITIES || {})[b];
      if (!A || !B || !A.pos || !B.pos) return 0;
      var dx = (A.pos[0] - B.pos[0]) * 85, dy = (A.pos[1] - B.pos[1]) * 111;
      return Math.round(Math.sqrt(dx * dx + dy * dy));
    }
    // ── 每日流动：按内驱力决定去向（野心趋大城，好武趋边地，余人就近）──
    // v20260927k 修正：初版把「月流动倾向」当成日概率用，结果 40 天跑了 648 人次、涿县空城、
    // 刘备一路跑到合浦——名将天天搬家，玩家根本追不上。现改为：
    //   ① 月倾向 ÷ 30 → 日概率（野心者约两月一行，义理者数年不动）
    //   ② 抵达后进入安居期 30~120 天（flags.npcTravelUntil），期内不再动
    //   ③ 非野心/好武者只就近流动（≤600 里），不再凭 hash 跳到天涯海角
    function tickDay() {
      var st = S(); if (!st) return 0;
      if (st.flags) st.flags.fieldFame = {};   // 每日清零郊野偶遇标记，名将次日方可再次于野外出没
      var cities = LF.CITIES || {};
      var ids = Object.keys(cities);
      if (!ids.length) return 0;
      function weight(cid) { return ((cities[cid] || {}).grid || 5); }
      var moved = 0;
      personae().forEach(function (t) {
        if (!t || !t.id) return;
        if (roster().some(function (o) { return o && o.id === t.id; })) return;   // 麾下之人由玩家调遣，不自走
        var top = topDesire(t).key;
        var restlessM = ({ xin: 0.50, wu: 0.40, jiu: 0.45, cai: 0.30, mian: 0.15, yi: 0.12 })[top] || 0.20;
        if (Math.random() > restlessM / 30) return;                              // 折算成今日是否启程
        var nowDay = st.day || 0;
        st.flags = st.flags || {};
        var untilMap = st.flags.npcTravelUntil || (st.flags.npcTravelUntil = {});
        if (untilMap[t.id] && nowDay < untilMap[t.id]) return;                   // 尚在安居期，不启程
        var cur = placeOf(t);
        var far = (top === 'xin' || top === 'wu');                               // 野心/好武者方可远行
        var pool = ids.filter(function (cid) {
          if (cid === cur) return false;
          return far ? true : (cityDist(cur, cid) <= 600);                       // 余人只在近邻州郡间转徙
        });
        if (!pool.length) return;
        // 野心者偏好大城，好武者偏好边地（grid 小者为边），余者随机
        pool.sort(function (a, b) {
          if (top === 'xin') return weight(b) - weight(a);
          if (top === 'wu') return weight(a) - weight(b);
          return (hash(t.id + a + (st.day || 0)) - hash(t.id + b + (st.day || 0)));
        });
        var tgt = far ? pool[0] : pool[hash(t.id + (st.day || 0)) % pool.length];
        if (!tgt) return;
        travelTo(t.id, tgt);
        untilMap[t.id] = nowDay + Math.round(30 + Math.random() * 90);           // 抵达后安居一月以上
        moved++;
      });
      if (moved) saveIt();
      return moved;
    }

    return {
      driveOf: driveOf, topDesire: topDesire, driveText: driveText,
      placeOf: placeOf, travelTo: travelTo, wander: wander,
      eachFamous: eachFamous, cardOf: cardOf, tickDay: tickDay,
      famousInField: famousInField, fieldLine: fieldLine,
      questOf: questOf, questState: questState, offerQuest: offerQuest, deliverQuest: deliverQuest,
      estateCard: estateCard, buyEstate: buyEstate, ownsEstate: ownsEstate, estatePrice: estatePrice,
      DKEYS: DKEYS, DNAME: DNAME, DPREF: DPREF, QD: QD,
      enabled: function () { return true; }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

// 武将系统（v20260921b）：登庸 / 搜索 / 俘获 / 任命太守与主将 / 政务·统率加成 / 武将面板
// 在统一人物口径 LF.PERSONA 之上完成玩法接入。范式：LF.createOfficers(ctx) 工厂 + 引擎别名块 + getter 注入。
//   · 在野武将 → 城中「寻访」登庸；势力武将 → 随所属城池驻防，克城时或被俘归你。
//   · 任「主将」→ 统率加成军队战力；任「太守」→ 政务加成所在城治域成长。
// ⚠ 面板 HTML 片段必须单行或用 \n 转义（JS 单引号字符串不可跨真实换行）。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createOfficers = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var log = ctx.log, toast = ctx.toast, save = ctx.save;
    var cityOwnerOf = ctx.cityOwnerOf, playerFaction = ctx.playerFaction;
    var openModal = ctx.openModal || function () {};
    var getCurrentModalKind = ctx.getCurrentModalKind || function () { return ''; };
    var armyCount = ctx.armyCount || function () { return 120; };
    var escapeHtml = ctx.escapeHtml || function (s) { return String(s == null ? '' : s); };
    var busyAct = ctx.busyAct || function () {};
    var advanceMinutes = ctx.advanceMinutes || function () {};
    var renderStatus = ctx.renderStatus || function () {};
    var isCityGrid = ctx.isCityGrid || function () { return false; };
    var armyTrainAt = ctx.armyTrainAt || function () { return 0; };
    var SKILL_MAP = {}; (LF.OFFICER_SKILLS || []).forEach(function (s) { SKILL_MAP[s.id] = s; });
    function idsOf(t) { return (t && t.skills) ? t.skills : []; }
    function sumEff(ids, key) { var s = 0; (ids || []).forEach(function (id) { var d = SKILL_MAP[id]; if (d && d.eff && typeof d.eff[key] === 'number') s += d.eff[key]; }); return s; }
    var officerTab = 'roster';

    // ── 索引：模板 id → 武将；驻城 → 武将列表 ──
    var _byId = null, _byCity = null;
    function rebuild() {
      var list = (LF.PERSONA && LF.PERSONA.listRegistered) ? LF.PERSONA.listRegistered() : [];
      _byId = {}; _byCity = {};
      list.forEach(function (t) {
        _byId[t.id] = t;
        var h = t.home;
        if (h) { (_byCity[h] = _byCity[h] || []).push(t); }
      });
    }
    function template(id) { if (!_byId) rebuild(); return _byId[id] || null; }
    function garrisonOf(cid) { if (!_byCity) rebuild(); return (_byCity[cid] || []).slice(); }

    // ── 玩家名册（state.officers）──
    function ensure() {
      var st = S(); if (!st) return null;
      if (!Array.isArray(st.officers)) st.officers = [];
      st.officers.forEach(function (o) { if (!o.assignment) o.assignment = null; if (typeof o.loyalty !== 'number') o.loyalty = 50; });
      return st.officers;
    }
    function roster() { return ensure() || []; }
    function getInst(id) { return roster().filter(function (o) { return o.id === id; })[0] || null; }
    function commander() {
      var list = roster();
      for (var i = 0; i < list.length; i++) if (list[i].assignment && list[i].assignment.type === 'commander') return list[i];
      return null;
    }
    function governorOf(cid) {
      var list = roster(), out = [];
      list.forEach(function (o) { if (o.assignment && o.assignment.type === 'governor' && o.assignment.cid === cid) out.push(o); });
      return out[0] || null;
    }
    function garrisonCommander(cid) {
      var g = garrisonOf(cid); if (!g.length) return null;
      var best = null;
      g.forEach(function (t) { if (!best || (t.stats.tong || 0) > (best.stats.tong || 0)) best = t; });
      return best;
    }
    // 守将单位数值（由五维派生，按战力缩放）
    function officerCombat(id) {
      var t = template(id); if (!t) return null;
      var s = t.stats, p = LF.PERSONA.powerOf(s);
      var scale = Math.max(0.75, Math.min(2.4, p / 95));
      var ids = idsOf(t);
      var atkMul = 1 + sumEff(ids, 'atkMul');
      var defMul = 1 + sumEff(ids, 'defMul');
      var spdAdd = sumEff(ids, 'spdAdd');
      var crit = sumEff(ids, 'crit');
      return { atk: Math.round(13 * scale * atkMul), def: Math.round(11 * scale * 0.95 * defMul), hp: Math.round(40 * scale), spd: Math.round(14 + s.wu * 0.06 + spdAdd), crit: crit };
    }

    // ── 加成 ──
    function commandBonus() {
      var c = commander(); if (!c) return 1;
      var base = 1 + (c.stats.tong || 0) / 100 * 0.5;  // 统率 100 → 战力 +50%
      var atk = 1 + sumEff(idsOf(template(c.id)), 'atkMul');
      return base * atk;
    }
    function civilBonus(cid) {
      var g = governorOf(cid); if (!g) return 1;
      var ids = idsOf(template(g.id));
      return 1 + (g.stats.zheng || 0) / 100 * 0.6 + sumEff(ids, 'devMul');  // 政务 + 特技(屯田/商才/工神/能吏)
    }
    function garrisonCivilBonus(cid) {
      var g = garrisonOf(cid); if (!g.length) return 1;
      var best = 0, bestZheng = 0;
      g.forEach(function (t) { var ids = idsOf(t); best = Math.max(best, sumEff(ids, 'devMul')); bestZheng = Math.max(bestZheng, t.stats.zheng || 0); });
      return 1 + bestZheng / 100 * 0.4 + best;
    }

    // ── 相性 / 关系网（v20260922f）──
    // 结义（sworn）：同组武将同阵营互勉；宿敌（enemy）：键方对值方心存芥蒂，同阵营相疑。
    var RELATIONS = {
      sworn: [['liu_bei', 'guan_yu', 'zhang_fei'], ['sun_ce', 'zhou_yu'], ['liu_bei', 'zhao_yun']],
      enemy: { 'lv_bu': ['liu_bei', 'guan_yu', 'zhang_fei'], 'dong_zhuo': ['liu_bei', 'guan_yu', 'zhang_fei'] }
    };
    function swornBrothers(id) {
      var out = [];
      (RELATIONS.sworn || []).forEach(function (g) { if (g.indexOf(id) >= 0) g.forEach(function (x) { if (x !== id) out.push(x); }); });
      return out;
    }
    function enemyOf(id) { return (RELATIONS.enemy && RELATIONS.enemy[id]) || []; }
    function affOf(t) {
      if (!t) return 75;
      if (typeof t.aff === 'number') return t.aff;
      var h = 0; for (var i = 0; i < (t.id || '').length; i++) h = (h * 31 + (t.id.charCodeAt(i) || 0)) % 150;
      return 30 + h;
    }
    // 每月忠诚浮动：结义同阵营互勉(+)、宿敌同阵营相疑(-)、主君魅力牵引向中位
    function loyaltyTick() {
      var list = ensure(); if (!list || !list.length) return;
      var ids = list.map(function (o) { return o.id; });
      var lordMei = (typeof roleFavorMul === 'function') ? Math.round(45 + (roleFavorMul() - 1) * 120) : 55;
      list.forEach(function (o) {
        var t = template(o.id) || {}, aff = affOf(t);
        var sworn = swornBrothers(o.id).filter(function (b) { return ids.indexOf(b) >= 0; }).length;
        var foe = enemyOf(o.id).filter(function (b) { return ids.indexOf(b) >= 0; }).length;
        var target = lordMei + (aff - 75) * 0.2 + sworn * 8 - foe * 10;
        var cur = o.loyalty || 50;
        o.loyalty = Math.max(0, Math.min(100, Math.round(cur + (target - cur) * 0.25 + (Math.random() * 6 - 3))));
      });
      save(S());
    }
    // 主将若有结义兄弟在册，全军临战默契：士气/战力小幅提升
    function battleSynergy() {
      var c = commander(); if (!c) return 0;
      var ids = roster().map(function (o) { return o.id; });
      var sworn = swornBrothers(c.id).filter(function (b) { return ids.indexOf(b) >= 0; }).length;
      return sworn * 0.04;
    }
    // 太守对府库月度纳赋的增益（政务 + 魅力）
    function taxBonus() {
      var rc = (S().ruledCities) || []; if (!rc.length) return 1;
      var tot = 0;
      rc.forEach(function (cid) { var g = governorOf(cid); if (g) tot += (g.stats.zheng || 0) / 100 * 0.25 + (g.stats.mei || 0) / 100 * 0.15; });
      return Math.max(1, 1 + tot);
    }
    // 太守对所在城治安的月度增益
    function orderBonus(cid) {
      var g = governorOf(cid); if (!g) return 0;
      return Math.round((g.stats.zheng || 0) / 100 * 6);
    }
    // 任命太守若有「屯田」特技，提升该城农业；「商才」提升商业（月度）
    function yieldBonus(cid) {
      var g = governorOf(cid); if (!g) return { agri: 0, com: 0 };
      var ids = idsOf(template(g.id));
      return { agri: sumEff(ids, 'farmMul'), com: sumEff(ids, 'tradeMul') };
    }

    // ── 登庸 / 搜索 ──
    function dist(a, b) {
      var A = (LF.CITIES || {})[a], B = (LF.CITIES || {})[b];
      if (!A || !B || A.pos == null || B.pos == null) return 9999;
      var dx = (A.pos[0] - B.pos[0]) * 85, dy = (A.pos[1] - B.pos[1]) * 111;
      return Math.round(Math.sqrt(dx * dx + dy * dy));
    }
    function recruitableHere(cid) {
      var all = (LF.PERSONA && LF.PERSONA.listRegistered) ? LF.PERSONA.listRegistered() : [];
      var wild = all.filter(function (t) { return t.faction === '在野'; });
      if (cid) wild.sort(function (a, b) { return dist(a.home, cid) - dist(b.home, cid); });
      return wild;
    }
    function recruitChance(t) {
      var st = S() || {};
      var rep = st.reputation || 0;
      var mei = (t.stats && t.stats.mei) || 50;
      var loy = t.loyalty || 50;
      var p = 0.30 + rep / 300 + mei / 500 + (100 - loy) / 400;
      var recAdd = 0;
      roster().forEach(function (o) { recAdd = Math.max(recAdd, sumEff(idsOf(template(o.id)), 'recruit')); });  // 人望/名望
      return Math.max(0.08, Math.min(0.95, p + recAdd));
    }
    function recruit(id) {
      var t = template(id); if (!t) { toast('查无此人。'); return { ok: false, msg: '查无此人' }; }
      if (getInst(id)) { toast(t.name + '已在麾下。'); return { ok: false, msg: '已在麾下' }; }
      var p = recruitChance(t);
      if (Math.random() < p) {
        var loyBonus = 0;
        roster().forEach(function (o) { loyBonus = Math.max(loyBonus, sumEff(idsOf(template(o.id)), 'loyalty')); });  // 名望/教化
        var inst = { id: t.id, name: t.name, stats: t.stats, assignment: null, loyalty: Math.round((t.loyalty || 50) * 0.6 + 20 + loyBonus), faction: 'player' };
        roster().push(inst);
        log('〔登庸〕' + t.name + '感公诚意，慨然来投，自此麾下又添一良佐。', 'good');
        toast('🤝 ' + t.name + ' 来投');
        save(S());
        return { ok: true, msg: t.name + ' 来投' };
      }
      log('〔登庸〕' + t.name + '婉言辞谢，暂未肯屈身。', 'sys');
      toast(t.name + ' 未肯来投');
      return { ok: false, msg: '未肯来投' };
    }

    // ── 任命 / 遣散 ──
    function appoint(id, role, cid) {
      var o = getInst(id); if (!o) { toast('麾下无此人。'); return false; }
      if (role === 'commander') {
        if (o.assignment && o.assignment.type === 'commander') {
          o.assignment = null; log('〔解将〕' + o.name + ' 解去主将之印，仍参帷幄。', 'sys'); toast(o.name + ' 解主将');
          save(S()); return true;
        }
        roster().forEach(function (x) { if (x.assignment && x.assignment.type === 'commander') x.assignment = null; });
        o.assignment = { type: 'commander' };
        log('〔任将〕拜 ' + o.name + ' 为三军主将，望旌麾所指，所向披靡。', 'good');
        toast('⚔ ' + o.name + ' 任主将');
      } else if (role === 'governor') {
        if (!cid) { toast('未指定城池。'); return false; }
        if (cityOwnerOf && playerFaction && cityOwnerOf(cid) !== playerFaction()) { toast('此城非你治下，何谈任命太守？'); return false; }
        if (o.assignment && o.assignment.type === 'governor' && o.assignment.cid === cid) {
          o.assignment = null; log('〔解守〕' + o.name + ' 解去' + (((LF.CITIES || {})[cid] || {}).name || cid) + '太守之任。', 'sys'); toast(o.name + ' 解太守');
          save(S()); return true;
        }
        roster().forEach(function (x) { if (x.assignment && x.assignment.type === 'governor' && x.assignment.cid === cid) x.assignment = null; });
        o.assignment = { type: 'governor', cid: cid };
        log('〔任守〕以 ' + o.name + ' 守' + (((LF.CITIES || {})[cid] || {}).name || cid) + '，军民赖以安。', 'good');
        toast('🏯 ' + o.name + ' 任太守');
      } else { toast('未知任命。'); return false; }
      save(S());
      return true;
    }
    function dismiss(id) {
      var list = ensure(); if (!list) return false;
      var i = -1;
      list.forEach(function (o, k) { if (o.id === id) i = k; });
      if (i < 0) { toast('麾下无此人。'); return false; }
      var nm = list[i].name;
      list.splice(i, 1);
      log('〔遣散〕' + nm + ' 解印归田，各奔前程。', 'sys');
      toast(nm + ' 已遣散');
      save(S());
      return true;
    }

    // ── 设施派遣层（v20260924j）：遣武将监理城邑设施，依才具与民夫/士卒按月批量产出 ──
    function statName(k) { return ({ wu: '武', zhi: '智', tong: '统', zheng: '政', mei: '魅' })[k] || k; }
    function facKeyOf(f) { return f.cid + '|' + f.ftype + '|' + f.slot; }
    function facLabor(fkey) {
      var st = S(); if (!st) return 0;
      st.flags.facilityLabor = st.flags.facilityLabor || {};
      return st.flags.facilityLabor[fkey] || 0;
    }
    function facTroops(fkey) {
      var st = S(); if (!st) return 0;
      st.flags.facilityTroops = st.flags.facilityTroops || {};
      return st.flags.facilityTroops[fkey] || 0;
    }
    function stewardOf(fkey) {
      var list = roster();
      for (var i = 0; i < list.length; i++) if (list[i].assignment && list[i].assignment.type === 'steward' && list[i].assignment.fkey === fkey) return list[i];
      return null;
    }
    function trooplimit() { return (typeof armyCount === 'function') ? Math.max(0, armyCount()) : 120; }
    function facilityOutput(fkey) {
      var p = (fkey || '').split('|'); var cid = p[0], ftype = p[1];
      var T = (LF.FACILITY_TYPES || {})[ftype]; if (!T) return null;
      var o = stewardOf(fkey);
      var statMul = 1, skill = 0;
      if (o) { var t = template(o.id); statMul = 1 + (o.stats[T.stat] || 0) / 100 * 0.85; skill = sumEff(idsOf(t), T.skill); }
      var lab = facLabor(fkey), labMul = 1 + lab / 100;
      var tr = facTroops(fkey), trMul = 1 + tr / 160;
      var amount = Math.round(T.base * statMul * (1 + skill) * labMul * trMul);
      return { type: ftype, res: T.res, resName: T.resName, icon: T.icon, name: T.name, amount: amount, officer: o, statMul: statMul, skill: skill, labor: lab, laborCap: T.laborCap, troops: tr, troopCap: trooplimit(), stat: T.stat, desc: T.desc };
    }
    function dispatchAssign(fkey, oid) {
      var o = getInst(oid); if (!o) { toast('麾下无此人。'); return false; }
      if (o.assignment && o.assignment.type === 'steward' && o.assignment.fkey === fkey) { o.assignment = null; }
      else {
        roster().forEach(function (x) { if (x !== o && x.assignment && x.assignment.type === 'steward' && x.assignment.fkey === fkey) x.assignment = null; });
        o.assignment = { type: 'steward', cid: fkey.split('|')[0], fkey: fkey };
        var st = S(); st.flags.facilityLabor = st.flags.facilityLabor || {};
        if (!st.flags.facilityLabor[fkey]) st.flags.facilityLabor[fkey] = 20;
      }
      log('〔派遣〕' + o.name + ' 受命监理 ' + ((facilityOutput(fkey) || {}).name || '设施') + '，民力得其所用。', 'sys');
      save(S());
      if (typeof openModal === 'function' && getCurrentModalKind && getCurrentModalKind() === 'officers') openModal('officers');
      return true;
    }
    function dispatchRemove(fkey) {
      var o = stewardOf(fkey); if (!o) return false;
      o.assignment = null;
      log('〔召回〕' + o.name + ' 自设施解任归营。', 'sys'); save(S());
      if (typeof openModal === 'function' && getCurrentModalKind && getCurrentModalKind() === 'officers') openModal('officers');
      return true;
    }
    function dispatchLabor(fkey, d) {
      var st = S(); st.flags.facilityLabor = st.flags.facilityLabor || {};
      var cap = ((LF.FACILITY_TYPES || {})[(fkey.split('|')[1])] || {}).laborCap || 60;
      var cur = Math.max(0, Math.min(cap, (st.flags.facilityLabor[fkey] || 0) + d));
      st.flags.facilityLabor[fkey] = cur; save(S());
      if (typeof openModal === 'function' && getCurrentModalKind && getCurrentModalKind() === 'officers') openModal('officers');
    }
    function dispatchTroops(fkey, d) {
      var st = S(); st.flags.facilityTroops = st.flags.facilityTroops || {};
      var cap = trooplimit();
      var cur = Math.max(0, Math.min(cap, (st.flags.facilityTroops[fkey] || 0) + d));
      st.flags.facilityTroops[fkey] = cur; save(S());
      if (typeof openModal === 'function' && getCurrentModalKind && getCurrentModalKind() === 'officers') openModal('officers');
    }
    function facilitiesMonthlyYield() {
      var rc = (S().ruledCities) || []; if (!rc.length) return;
      var res = S().res = S().res || { grain: 0, iron: 0, kit: 0 };
      var tot = { grain: 0, iron: 0, kit: 0, gold: 0 };
      rc.forEach(function (cid) {
        var slots = (LF.facilitySlotsOf ? LF.facilitySlotsOf(cid) : []) || [];
        slots.forEach(function (s) {
          var o = facilityOutput(facKeyOf(s));
          if (o && o.amount > 0) tot[o.res] += o.amount;
        });
      });
      res.grain += tot.grain; res.iron += tot.iron; res.kit += tot.kit; S().gold = (S().gold || 0) + tot.gold;
      var pts = []; if (tot.grain) pts.push('粮 ' + tot.grain); if (tot.iron) pts.push('铁 ' + tot.iron); if (tot.kit) pts.push('器械 ' + tot.kit); if (tot.gold) pts.push('银 ' + tot.gold);
      if (pts.length) log('〔营生〕麾下设施岁入：' + pts.join('、') + '。', 'sys');
    }

    // ── 克城俘获 ──
    function captureFrom(defKey, cid) {
      if (!defKey || defKey === 'player' || defKey === 'none') return [];
      var g = garrisonOf(cid).filter(function (t) { return t.faction === defKey || (defKey !== 'player' && t.faction !== '在野'); });
      var got = [];
      g.forEach(function (t) {
        if (getInst(t.id)) return;
        var loy = t.loyalty || 50;
        var p = 0.12 + (100 - loy) / 300;            // 忠诚越低越易俘
        if (Math.random() < p) {
          roster().push({ id: t.id, name: t.name, stats: t.stats, assignment: null, loyalty: Math.round(loy * 0.5 + 15), faction: 'player' });
          got.push(t.name);
        }
      });
      if (got.length) {
        log('〔俘获〕克城之际，' + got.join('、') + ' 束手就擒，纳为己用。', 'good');
        toast('🏆 俘获 ' + got.join('、'));
        save(S());
      }
      return got;
    }

    // ── 武将面板 ──
    function esc(s) { return escapeHtml(s == null ? '' : s); }
    var SKILL_CAT_COLOR = { 战:'#9e3b2e', 智:'#3f5f7a', 政:'#7a6a2e', 魅:'#8a5a3a' };
    function skillTagsHTML(ids) {
      if (!ids || !ids.length) return '';
      return '<span class="of-skills">' + ids.map(function (id) {
        var d = SKILL_MAP[id]; if (!d) return '';
        var c = SKILL_CAT_COLOR[d.cat] || '#888';
        return '<i style="border:1px solid ' + c + ';color:' + c + ';background:rgba(0,0,0,.18);border-radius:10px;padding:1px 7px;margin-left:5px;font-style:normal;font-size:11px;" title="' + esc(d.name) + '：' + esc(d.desc) + '">' + esc(d.name) + '</i>';
      }).join('') + '</span>';
    }
    function tierCls(v) { var t = LF.PERSONA.tierOf(v); return t ? t.cls : 't-mid'; }
    function statBars(stats) {
      var K = ['wu', 'zhi', 'tong', 'zheng', 'mei'], N = { wu: '武', zhi: '智', tong: '统', zheng: '政', mei: '魅' };
      var h = '<div class="of-stats">';
      K.forEach(function (k) {
        var v = stats[k] || 0, pct = Math.max(2, v);
        h += '<span class="of-s" title="' + N[k] + ' ' + v + '"><i class="' + tierCls(v) + '">' + N[k] + '</i><b style="width:' + pct + '%"></b><em>' + v + '</em></span>';
      });
      return h + '</div>';
    }
    function assignTag(o) {
      if (!o.assignment) return '<span class="of-tag free">在野未任</span>';
      if (o.assignment.type === 'commander') return '<span class="of-tag cmd">主将</span>';
      if (o.assignment.type === 'steward') { var _fn = (facilityOutput(o.assignment.fkey) || {}).name || '设施'; return '<span class="of-tag stew">监理·' + esc(_fn) + '</span>'; }
      if (o.assignment.type === 'edict') { return '<span class="of-tag stew">内政·' + esc(edictName(o.assignment.cmd)) + '</span>'; }
      var cn = (((LF.CITIES || {})[o.assignment.cid] || {}).name || o.assignment.cid);
      return '<span class="of-tag gov">太守·' + esc(cn) + '</span>';
    }
    function renderOfficerPanel() {
      var list = roster();
      var cmd = commander();
      var h = '<h3>武 将</h3>';
      h += '<div class="of-head">麾下 <b>' + list.length + '</b> 员' + (cmd ? '　|　主将：<b>' + esc(cmd.name) + '</b>（统率' + (cmd.stats.tong || 0) + '，战力 +' + Math.round((commandBonus() - 1) * 100) + '%）' : '　|　未设主将') + '</div>';
      h += '<div class="of-ops"><button class="btn sm" onclick="window.openOfficerTab(\'search\')">🔍 寻访人才</button></div>';
      if (!list.length) {
        h += '<div class="of-empty">帐下尚无僚佐。可往城中「寻访人才」，延揽天下英雄；克城之时，败军之将亦或来归。</div>';
      } else {
        h += '<div class="of-list">';
        list.forEach(function (o) {
          h += '<div class="of-row">';
          h += '<div class="of-top"><b>' + esc(o.name) + '</b><span class="of-title">' + esc((template(o.id) || {}).title || '') + '</span>' + assignTag(o) + skillTagsHTML(idsOf(template(o.id))) + '</div>';
          h += statBars(o.stats);
          h += '<div class="of-acts">';
          if (!(o.assignment && o.assignment.type === 'commander')) h += '<button class="btn sm" onclick="window.appointOfficer(\'' + o.id + '\',\'commander\')">任主将</button>';
          else h += '<button class="btn sm" onclick="window.appointOfficer(\'' + o.id + '\',\'commander\')">解主将</button>';
          var here = S().room;
          var ownHere = cityOwnerOf && playerFaction && here && cityOwnerOf(here) === playerFaction();
          if (!(o.assignment && o.assignment.type === 'governor' && o.assignment.cid === here)) {
            if (ownHere) h += '<button class="btn sm" onclick="window.appointOfficer(\'' + o.id + '\',\'governor\',\'' + here + '\')">守' + esc((((LF.CITIES || {})[here] || {}).name || here)) + '</button>';
          } else h += '<button class="btn sm" onclick="window.appointOfficer(\'' + o.id + '\',\'governor\',\'' + here + '\')">解太守</button>';
          h += '<button class="btn sm danger" onclick="window.dismissOfficer(\'' + o.id + '\')">遣散</button>';
          h += '</div></div>';
        });
        h += '</div>';
      }
      h += '<p class="hint">主将以「统率」增益全军战力；太守以「政务」增益治下城池的月度成长。任将须立于该城方能委以太守之职。　武将特技（红·战／蓝·智／绿·政／紫·魅）悬停可见其效：如「神将」增攻、「屯田」增垦、「人望」易募。</p>';
      return h;
    }
    function renderSearchPanel() {
      var cid = S().room;
      if (cityOwnerOf && playerFaction && cid && cityOwnerOf(cid) !== playerFaction()) cid = (S().flags && S().flags.cityPos && S().flags.cityPos.cid) || cid;
      var list = recruitableHere(cid);
      var h = '<h3>寻访人才</h3>';
      h += '<div class="of-note">于' + esc((((LF.CITIES || {})[cid] || {}).name || '野')) + '一带访求在野之士。声望愈隆、魅力愈盛，延揽愈易。</div>';
      if (!list.length) h += '<div class="of-empty">此地暂无名士可访。</div>';
      else {
        h += '<div class="of-list">';
        list.forEach(function (t) {
          var p = Math.round(recruitChance(t) * 100);
          h += '<div class="of-row">';
          h += '<div class="of-top"><b>' + esc(t.name) + '</b><span class="of-title">' + esc(t.title || '') + '</span><span class="of-chance">登庸率 ' + p + '%</span>' + skillTagsHTML(t.skills) + '</div>';
          h += statBars(t.stats);
          h += '<div class="of-acts"><button class="btn sm" onclick="window.recruitOfficer(\'' + t.id + '\')">登庸</button></div>';
          h += '</div>';
        });
        h += '</div>';
      }
      h += '<p class="hint">在野之士籍贯各异，近者先见。克城之时，败军之将亦或束手来归。</p>';
      return h;
    }
    function renderOfficerHub() {
      var tabs = [['roster', '麾下'], ['search', '寻访'], ['factions', '群雄']];
      var h = '<div class="of-tabs">';
      tabs.forEach(function (t) {
        h += '<button class="of-tab' + (officerTab === t[0] ? ' on' : '') + '" onclick="window.openOfficerTab(\'' + t[0] + '\')">' + t[1] + '</button>';
      });
      h += '</div>';
      if (officerTab === 'search') h += renderSearchPanel();
      else if (officerTab === 'factions') h += renderFactionsPanel();
      else h += renderOfficerPanel();
      return h;
    }
    function renderFactionsPanel() {
      var all = (LF.PERSONA && LF.PERSONA.listRegistered) ? LF.PERSONA.listRegistered() : [];
      var groups = {};
      all.forEach(function (t) { if (t.faction === 'player') return; (groups[t.faction] = groups[t.faction] || []).push(t); });
      function facName(f) { var F = (LF.FACTIONS || {})[f]; return (F && F.name) || f; }
      var h = '<h3>群雄 · 天下武将</h3>';
      h += '<div class="of-note">列天下群雄麾下之将——知其名，方知敌友。克城可俘其守将，乱世任才。</div>';
      var order = Object.keys(groups);
      if (!order.length) h += '<div class="of-empty">暂无群雄录。</div>';
      order.forEach(function (f) {
        var list = groups[f];
        h += '<div class="of-group"><div class="of-ghead">⚑ ' + esc(facName(f)) + '（' + list.length + ' 员）</div><div class="of-list">';
        list.forEach(function (t) {
          var cn = (((LF.CITIES || {})[t.home] || {}).name) || t.home || '野';
          h += '<div class="of-row">';
          h += '<div class="of-top"><b>' + esc(t.name) + '</b><span class="of-title">' + esc(t.title || '') + '</span><span class="of-fac">' + esc(facName(f)) + '</span>' + skillTagsHTML(t.skills) + '</div>';
          h += statBars(t.stats);
          h += '<div class="of-acts"><span class="of-loc">驻 ' + esc(cn) + '</span></div>';
          h += '</div>';
        });
        h += '</div></div>';
      });
      return h;
    }
    function renderCityGarrison(cid) {
      var list = garrisonOf(cid); if (!list.length) return '';
      function facName(f) { var F = (LF.FACTIONS || {})[f]; return (F && F.name) || f; }
      var h = '<div class="row"><span>守将（' + list.length + ' 员）</span></div><div class="city-garr">';
      list.forEach(function (t) {
        var cn = (((LF.CITIES || {})[t.home] || {}).name) || t.home || '野';
        h += '<div class="cg-row"><b>' + esc(t.name) + '</b><span class="cg-title">' + esc(t.title || '') + '</span><span class="cg-fac">' + esc(facName(t.faction)) + '</span>' + skillTagsHTML(t.skills) + '</div>';
        h += statBars(t.stats);
      });
      h += '</div>';
      return h;
    }
    function openOfficerTab(t) { officerTab = t; if (typeof openModal === 'function') openModal('officers'); }
    function openOfficerPanel() { officerTab = 'roster'; if (typeof openModal === 'function') openModal('officers'); }
    function openSearchPanel() { officerTab = 'search'; if (typeof openModal === 'function') openModal('officers'); }

    // ── 内政命令（命令式委任内政，v20260924l）：玩家可亲自下令，或委任武将按月执行 ──
    function playerEconMul() { var r = S() && S().role; return r === 'xiang' ? 1.35 : 1; }
    function edictCmds() { return (LF.EDICT_COMMANDS) || {}; }
    function edictName(k) { var C = edictCmds()[k]; return C ? C.name : k; }
    function cityStatsOf(cid) {
      var st = S(); if (!st) return {};
      st.flags.cityStats = st.flags.cityStats || {};
      return st.flags.cityStats[cid] || (st.flags.cityStats[cid] = {});
    }
    function addCityStat(cid, key, d) { var cs = cityStatsOf(cid); cs[key] = (cs[key] || 0) + d; }
    function delegateeOf(cmdKey, cid) {
      var list = roster();
      for (var i = 0; i < list.length; i++) { var a = list[i].assignment; if (a && a.type === 'edict' && a.cmd === cmdKey && a.cid === cid) return list[i]; }
      return null;
    }
    function facSlotsForCmd(cid, k) {
      var C = edictCmds()[k]; if (!C || !C.res) return [];
      var slots = (typeof LF.facilitySlotsOf === 'function') ? LF.facilitySlotsOf(cid) : [];
      return slots.filter(function (s) { var T = (LF.FACILITY_TYPES || {})[s.ftype]; return T && T.res === C.res; });
    }

    function playerActor() {
      var st = S(); if (!st) return null;
      var base = 55, role = st.role;
      var zheng = base + (role === 'xiang' ? 22 : (role === 'jiang' ? 6 : 0));
      var mei = base + (role === 'youxia' ? 16 : (role === 'xiang' ? 10 : 0));
      var zhi = base + (role === 'xiang' ? 14 : 0);
      return { isPlayer: true, id: st.id, name: st.name || '\u4f60', stats: { wu: base, zhi: zhi, tong: base, zheng: zheng, mei: mei } };
    }
    function commandEffect(cmdKey, actor) {
      var C = edictCmds()[cmdKey]; if (!C || !actor) return null;
      var ids = idsOf(template(actor.id));
      var statMul = 1 + (actor.stats[C.stat] || 0) / 100 * 0.85;
      var skill = sumEff(ids, C.skill) || 0;
      var amount = Math.round((C.base || 0) * statMul * (1 + skill));
      if (actor.isPlayer && C.res) amount = Math.round(amount * playerEconMul());
      return { key: cmdKey, C: C, kind: C.kind, trainType: C.trainType, amount: amount, res: C.res, statKey: C.statKey, statGain: C.statGain || 0, order: C.order || 0, skill: skill, statMul: statMul };
    }
    function edictResultText(eff) {
      if (eff.C.kind === 'train') return '\u52df\u8bad ' + (eff.trainType || '\u6b65\u5175') + ' ' + eff.amount + ' \u540d';
      if (eff.C.kind === 'recruit') return '\u6216\u5f97\u8d24\u624d\uff08\u4eb2\u884c\u5373\u8bd5\uff09';
      if (eff.C.kind === 'explore') return '\u6216\u6709\u5947\u9047\u00b7\u5b9d\u7269';
      var p = [];

      if (eff.res === 'grain') p.push('\u5f97\u7cae ' + eff.amount);
      else if (eff.res === 'gold') p.push('\u5f97\u94f6 ' + eff.amount + ' \u4e24');
      else if (eff.res === 'iron') p.push('\u5f97\u94c1 ' + eff.amount);
      else if (eff.res === 'kit') p.push('\u5f97\u5668\u68b0 ' + eff.amount);
      if (eff.statKey === 'agri') p.push('\u5730\u529b +' + eff.statGain);
      else if (eff.statKey === 'com') p.push('\u5e02\u6613 +' + eff.statGain);
      else if (eff.statKey === 'defense') p.push('\u57ce\u9632 +' + eff.statGain);
      if (eff.order) p.push('\u6cbb\u5b89 +' + eff.order);
      return p.length ? p.join('\u3001') : '\u4e8b\u6bd5';
    }
    function cityName(cid) { return (((LF.CITIES || {})[cid] || {}).name || cid); }
    function doExplore(cid, who) {
      var c = cityName(cid), roll = Math.random(), opts = ['grain', 'iron', 'kit', 'gold'], k = opts[Math.floor(Math.random() * opts.length)], gain = 10 + Math.floor(Math.random() * 20);
      if (roll < 0.5) {
        if (k === 'gold') S().gold = (S().gold || 0) + gain;
        else { S().res = S().res || { grain: 0, iron: 0, kit: 0 }; S().res[k] = (S().res[k] || 0) + gain; }
        log('\u3014\u63a2\u7d22\u3015' + who + '\u4f7f\u4eba\u7d22\u5947\uff0c\u5f97' + ({ grain: '\u7cae', iron: '\u94c1', kit: '\u5668\u68b0', gold: '\u94f6' }[k]) + ' ' + gain + '\u3002', 'good');
      } else if (roll < 0.78) {
        var ks = ['agri', 'com', 'defense'], kk = ks[Math.floor(Math.random() * ks.length)], g2 = 1 + (Math.random() < 0.4 ? 1 : 0);
        addCityStat(cid, kk, g2);
        log('\u3014\u63a2\u7d22\u3015' + who + '\u8e0f\u52d8\u5730\u5229\uff0c' + ({ agri: '\u5730\u529b', com: '\u5e02\u6613', defense: '\u57ce\u9632' }[kk]) + ' +' + g2 + '\u3002', 'sys');
      } else if (roll < 0.93) {
        var list = recruitableHere(cid);
        if (list.length) { var t = list[Math.floor(Math.random() * list.length)]; log('\u3014\u63a2\u7d22\u3015' + who + '\u63a2\u5f97 ' + t.name + ' \u9690\u4e8e' + c + '\u5468\u8fb9\uff0c\u53ef\u4e8e\u6b66\u5c06\u9762\u677f\u767b\u96c7\u3002', 'good'); }
        else { addCityStat(cid, 'com', 1); log('\u3014\u63a2\u7d22\u3015' + who + '\u8bbf\u5f97\u5546\u8def\uff0c\u5e02\u6613\u5c0f\u8fdb\u3002', 'sys'); }
      } else {
        var g3 = 8 + Math.floor(Math.random() * 12); S().gold = (S().gold || 0) + g3;
        log('\u3014\u63a2\u7d22\u3015' + who + '\u4e8e\u91ce\u5f97\u9057\u91d1 ' + g3 + ' \u4e24\u3002', 'good');
      }
      save(S());
    }
    function applyEdictToState(cid, eff, who) {
      var st = S(); if (!st) return;
      if (eff.C.kind === 'train') {
        var got = armyTrainAt(cid, eff.trainType || '\u6b65\u5175', eff.amount);
        if (got > 0) log('\u3014\u5185\u653f\u3015' + (who || '\u4f60') + '\u4e8e' + cityName(cid) + '\u7ec3\u5175\uff0c\u52df\u8bad ' + (eff.trainType || '\u6b65\u5175') + ' ' + got + ' \u540d\u3002', 'good');
        else log('\u3014\u5185\u653f\u3015' + (who || '\u4f60') + '\u6b32\u4e8e' + cityName(cid) + '\u7ec3\u5175\uff0c\u7136\u5175\u6e90\u5df2\u5c3d\u6216\u5175\u529b\u5df2\u8fbe\u4e0a\u9650\u3002', 'sys');
        return;
      }
      if (eff.C.kind === 'recruit') {
        var list = recruitableHere(cid);
        if (!list.length) { log('\u3014\u767b\u96c7\u3015' + cityName(cid) + '\u5883\u5185\u4e00\u65f6\u65e0\u53ef\u767b\u96c7\u4e4b\u58eb\u3002', 'sys'); return; }
        var best = list[0], bp = -1;
        list.forEach(function (t) { var pc = recruitChance(t); if (pc > bp) { bp = pc; best = t; } });
        recruit(best.id);
        return;
      }
      if (eff.C.kind === 'explore') { doExplore(cid, who || '\u4f60'); return; }
      if (eff.res && eff.amount) {
        if (eff.res === 'gold') st.gold = (st.gold || 0) + eff.amount;
        else { st.res = st.res || { grain: 0, iron: 0, kit: 0 }; st.res[eff.res] = (st.res[eff.res] || 0) + eff.amount; }
      }
      if (eff.statKey && eff.statGain) addCityStat(cid, eff.statKey, eff.statGain);
      if (eff.order) {
        st.flags.cityOrder = st.flags.cityOrder || {};
        var cur = (st.flags.cityOrder[cid] != null ? st.flags.cityOrder[cid] : ((LF.CITIES || {})[cid] || {}).order || 50);
        st.flags.cityOrder[cid] = Math.min(100, Math.max(0, cur + eff.order));
      }
      log('\u3014\u5185\u653f\u3015' + (who || '\u4f60') + '\u884c' + edictName(eff.key) + '\uff0c' + edictResultText(eff) + '\u3002', 'good');
    }

    function civilCommand(cmdKey) {
      var cid = S() && S().room;
      if (!isCityGrid(cid)) { toast('\u9700\u7acb\u4e8e\u57ce\u4e2d\u65b9\u80fd\u53d1\u4ee4\u3002'); return; }
      if (cityOwnerOf(cid) !== playerFaction()) { toast('\u4f60\u5e76\u975e\u6b64\u57ce\u4e4b\u4e3b\uff0c\u4f55\u8c08\u653f\u4ee4\uff1f'); return; }
      var C = edictCmds()[cmdKey]; if (!C) return;
      var actor = playerActor(); var eff = commandEffect(cmdKey, actor);
      busyAct(C.icon + ' ' + C.name + '\u00b7\u534a\u4e2a\u65f6\u8fb0', 1000, function () {
        applyEdictToState(cid, eff, '\u4f60');
        advanceMinutes(120);
        save(S()); renderStatus();
        toast(C.icon + ' ' + C.name + '\uff1a' + edictResultText(eff));
        if (getCurrentModalKind() === 'edict') openModal('edict');
      });
    }
    function delegateCommand(cmdKey, oid) {
      var cid = S() && S().room;
      if (!isCityGrid(cid) || cityOwnerOf(cid) !== playerFaction()) { toast('\u9700\u7acb\u4e8e\u5df1\u65b9\u57ce\u6c60\u65b9\u80fd\u59d4\u4efb\u3002'); return false; }
      if (!oid) {
        roster().forEach(function (o) { var a = o.assignment; if (a && a.type === 'edict' && a.cmd === cmdKey && a.cid === cid) o.assignment = null; });
      } else {
        var o = getInst(oid); if (!o) { toast('\u9e4c\u4e0b\u65e0\u6b64\u4eba\u3002'); return false; }
        roster().forEach(function (x) { if (x !== o && x.assignment && x.assignment.type === 'edict' && x.assignment.cmd === cmdKey && x.assignment.cid === cid) x.assignment = null; });
        o.assignment = { type: 'edict', cmd: cmdKey, cid: cid };
      }
      save(S());
      if (getCurrentModalKind() === 'edict') openModal('edict');
      return true;
    }
    function undelegateCommand(cmdKey) { return delegateCommand(cmdKey, null); }
    function monthlyAffairs() {
      facilitiesMonthlyYield();
      var list = roster();
      list.forEach(function (o) {
        var a = o.assignment; if (!a || a.type !== 'edict') return;
        var eff = commandEffect(a.cmd, o); if (!eff) return;
        applyEdictToState(a.cid, eff, o.name);
      });
    }
    function renderEdictCommands(cid) {
      if (!cid || cityOwnerOf(cid) !== playerFaction()) return '';
      var h = '<div class="edict-cmds">';
      h += '<div class="edict-cmd-h">\ud83d\udcdc \u5185\u653f\u547d\u4ee4\uff08\u4eb2\u884c\u8017\u65f6\u8fb0\uff1b\u6216\u59d4\u4efb\u9e4c\u4e0b\u6b66\u5c06\u6309\u6708\u7763\u529e\uff09</div>';
      var cmds = edictCmds();
      Object.keys(cmds).forEach(function (k) {
        var C = cmds[k];
        var eff = commandEffect(k, playerActor());
        var fslots = facSlotsForCmd(cid, k);
        h += '<div class="edict-cmd">';
        h += '<button class="btn edict-do" onclick="civilCommand(\'' + k + '\')">' + C.icon + ' ' + C.name + '<br><span class="sub">' + C.cat + '\u00b7' + statName(C.stat) + (C.skill ? '\u00b7\u7279\u6280' : '') + '</span></button>';
        if (fslots.length) {
          h += '<div class="edict-fac">';
          fslots.forEach(function (s) {
            var fk = facKeyOf(s), safe = fk.replace(/\|/g, '_'), o = facilityOutput(fk);
            h += '<div class="fac-row">';
            h += '<div class="fac-top"><b>' + escapeHtml(o.icon) + ' ' + escapeHtml(o.name) + '</b>' + (o.officer ? '<span class="of-tag stew">' + escapeHtml(o.officer.name) + ' \u76d1\u7406</span>' : '<span class="of-tag free">\u672a\u9053</span>') + '</div>';
            h += '<div class="fac-ctl">\u6c11\u592b ' + o.labor + '/' + o.laborCap + ' <button class="btn xs" onclick="window.dispatchLabor(\'' + fk + '\',-5)">\u2212</button><button class="btn xs" onclick="window.dispatchLabor(\'' + fk + '\',5)">\uff0b</button> \u58eb\u5341 ' + o.troops + '/' + o.troopCap + ' <button class="btn xs" onclick="window.dispatchTroops(\'' + fk + '\',-10)">\u2212</button><button class="btn xs" onclick="window.dispatchTroops(\'' + fk + '\',10)">\uff0b</button></div>';
            h += '<div class="fac-out">\u6708\u51fa\uff1a<b>' + o.amount + ' ' + escapeHtml(o.resName) + '</b>' + (o.officer ? '（' + statName(o.stat) + '\u00d7' + (Math.round(o.statMul * 100) / 100) + (o.skill ? (' \uff0b\u6280' + Math.round(o.skill * 100) + '%') : '') + '\uff09' : '（\u672a\u9053\u5b98\uff0c\u4ec5\u8d56\u6c11\u529b\uff09') + '</div>';
            var opts = '<option value="">\u2014 \u59d4\u4efb \u2014</option>';
            if (o.officer) opts = '<option value="">\u2715 \u64a4\u59d4\u4efb\uff08\u73b0\u4efb\uff1a' + escapeHtml(o.officer.name) + '\uff09</option>';
            roster().forEach(function (x) { if (x.assignment && x.assignment.type === 'steward' && x.assignment.fkey === fk) return; opts += '<option value="' + x.id + '">' + escapeHtml(x.name) + '\uff08' + statName(o.stat) + (x.stats[o.stat] || 0) + '\uff09</option>'; });
            h += '<div class="fac-assign"><select id="facsel_' + safe + '" class="fac-sel">' + opts + '</select><button class="btn sm" onclick="window.dispatchAssign(\'' + fk + '\',document.getElementById(\'facsel_' + safe + '\').value)">\u6d3e\u9063</button>';
            if (o.officer) h += '<button class="btn sm danger" onclick="window.dispatchRemove(\'' + fk + '\')">\u53ec\u56de</button>';
            h += '</div></div>';
          });
          h += '</div>';
        } else {
          var dg = delegateeOf(k, cid);
          var opts = '<option value="">\u2014 \u59d4\u4efb \u2014</option>';
          if (dg) opts = '<option value="">\u2715 \u64a4\u59d4\u4efb\uff08\u73b0\u4efb\uff1a' + escapeHtml(dg.name) + '\uff09</option>';
          roster().forEach(function (o) { var a = o.assignment; if (a && a.type === 'edict' && a.cmd === k && a.cid === cid) return; opts += '<option value="' + o.id + '">' + escapeHtml(o.name) + '\uff08' + statName(C.stat) + (o.stats[C.stat] || 0) + '\uff09</option>'; });
          h += '<select class="edict-del" onchange="delegateCommand(\'' + k + '\', this.value)">' + opts + '</select>';
          h += '<div class="edict-pred">' + (dg ? ('\u59d4\u4efb ' + escapeHtml(dg.name) + '\uff1a') : '\u4eb2\u884c\uff1a') + escapeHtml(edictResultText(eff)) + '</div>';
        }
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    return {
      template: template, garrisonOf: garrisonOf, garrisonCommander: garrisonCommander, officerCombat: officerCombat,
      commandBonus: commandBonus, civilBonus: civilBonus, garrisonCivilBonus: garrisonCivilBonus, swornBrothers: swornBrothers, enemyOf: enemyOf, affOf: affOf, loyaltyTick: loyaltyTick, battleSynergy: battleSynergy, taxBonus: taxBonus, orderBonus: orderBonus, yieldBonus: yieldBonus,
      roster: roster, get: getInst, commander: commander, governorOf: governorOf,
      idsOf: idsOf, template: template, statBars: statBars, skillTagsHTML: skillTagsHTML, tierCls: tierCls, assignTag: assignTag,
      recruitableHere: recruitableHere, recruitChance: recruitChance, recruit: recruit,
      appoint: appoint, dismiss: dismiss, captureFrom: captureFrom,
      renderOfficerPanel: renderOfficerPanel, renderSearchPanel: renderSearchPanel, renderOfficerHub: renderOfficerHub, renderFactionsPanel: renderFactionsPanel, renderCityGarrison: renderCityGarrison,
      openOfficerPanel: openOfficerPanel, openSearchPanel: openSearchPanel, openOfficerTab: openOfficerTab,
      dispatchAssign: dispatchAssign, dispatchRemove: dispatchRemove, dispatchLabor: dispatchLabor, dispatchTroops: dispatchTroops, facilitiesMonthlyYield: facilitiesMonthlyYield, facilityOutput: facilityOutput, civilCommand: civilCommand, delegateCommand: delegateCommand, undelegateCommand: undelegateCommand, monthlyAffairs: monthlyAffairs, renderEdictCommands: renderEdictCommands
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.createOfficers;
})(typeof window !== 'undefined' ? window : globalThis);

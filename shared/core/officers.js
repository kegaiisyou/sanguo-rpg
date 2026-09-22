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
    var escapeHtml = ctx.escapeHtml || function (s) { return String(s == null ? '' : s); };
    var SKILL_MAP = {}; (LF.OFFICER_SKILLS || []).forEach(function (s) { SKILL_MAP[s.id] = s; });
    function idsOf(t) { return (t && t.skills) ? t.skills : []; }
    function sumEff(ids, key) { var s = 0; (ids || []).forEach(function (id) { var d = SKILL_MAP[id]; if (d && d.eff && typeof d.eff[key] === 'number') s += d.eff[key]; }); return s; }

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
    var SKILL_CAT_COLOR = { 战:'#c0392b', 智:'#2c6fb0', 政:'#2e8b57', 魅:'#8e44ad' };
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
      var cn = (((LF.CITIES || {})[o.assignment.cid] || {}).name || o.assignment.cid);
      return '<span class="of-tag gov">太守·' + esc(cn) + '</span>';
    }
    function renderOfficerPanel() {
      var list = roster();
      var cmd = commander();
      var h = '<h3>武 将</h3>';
      h += '<div class="of-head">麾下 <b>' + list.length + '</b> 员' + (cmd ? '　|　主将：<b>' + esc(cmd.name) + '</b>（统率' + (cmd.stats.tong || 0) + '，战力 +' + Math.round((commandBonus() - 1) * 100) + '%）' : '　|　未设主将') + '</div>';
      h += '<div class="of-ops"><button class="btn sm" onclick="window.openSearchPanel()">🔍 寻访人才</button></div>';
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
    function openOfficerPanel() { if (typeof openModal === 'function') openModal('officers'); }
    function openSearchPanel() { if (typeof openModal === 'function') openModal('officerSearch'); }

    return {
      template: template, garrisonOf: garrisonOf, garrisonCommander: garrisonCommander, officerCombat: officerCombat,
      commandBonus: commandBonus, civilBonus: civilBonus, garrisonCivilBonus: garrisonCivilBonus,
      roster: roster, get: getInst, commander: commander, governorOf: governorOf,
      recruitableHere: recruitableHere, recruitChance: recruitChance, recruit: recruit,
      appoint: appoint, dismiss: dismiss, captureFrom: captureFrom,
      renderOfficerPanel: renderOfficerPanel, renderSearchPanel: renderSearchPanel,
      openOfficerPanel: openOfficerPanel, openSearchPanel: openSearchPanel
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.createOfficers;
})(typeof window !== 'undefined' ? window : globalThis);

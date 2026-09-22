// 角色大厅（v20260923r）：原神式角色页——主角 / 随从 / 武将 一览切换
//   · 左侧角色列表（立绘占位=名字印章），右侧详情（属性 / 天赋 / 装备）
//   · 主角详情沿用引擎既有面板（四维加点）；武将详情 = 五维 + 特技 + 忠诚 + 六槽装备
//   · 武将装备：点空槽从主角行囊选装（行囊→武将），点已装卸下（武将→行囊）
// 范式：LF.createCharHall(ctx) 工厂 + 引擎别名块；面板 HTML 片段必须单行或用 \n 转义。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createCharHall = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF, G = ctx.G;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;
    var log = ctx.log, toast = ctx.toast, save = ctx.save, renderStatus = ctx.renderStatus;
    var escapeHtml = ctx.escapeHtml;
    var row = ctx.row;
    var Officers = ctx.Officers;
    var SLOTS = LF.SLOTS || {};
    var packList = ctx.packList, packAdd = ctx.packAdd;
    var afterPackChange = ctx.afterPackChange;
    var mainDetailHTML = ctx.mainDetailHTML;    // 引擎侧主角详情（属性+加点+门派+武学）
    var bindMainDetail = ctx.bindMainDetail;    // 引擎侧主角详情绑定
    var sel = 'main';   // 选中 key：main / p:<id> / o:<id>

    function roster() {
      var st = S(); var arr = [];
      arr.push({ key: 'main', kind: 'main', name: st.name || '无名客', tag: '主', sub: 'LV.' + (st.level || 1) });
      (st.party || []).forEach(function (c) {
        arr.push({ key: 'p:' + c.id, kind: 'party', id: c.id, name: c.name, tag: '随', sub: c.title || c.role || '随行' });
      });
      (Officers.roster() || []).forEach(function (o) {
        var t = Officers.template(o.id) || {};
        arr.push({ key: 'o:' + o.id, kind: 'officer', id: o.id, name: o.name, tag: '将', sub: t.title || '麾下' });
      });
      return arr;
    }
    function getInst(key) {
      if (!key || key === 'main') return null;
      var st = S();
      if (key.indexOf('p:') === 0) {
        var id = key.slice(2);
        for (var i = 0; i < (st.party || []).length; i++) if (st.party[i].id === id) return st.party[i];
        return null;
      }
      if (key.indexOf('o:') === 0) return Officers.get(key.slice(2));
      return null;
    }
    function ensureGear(o) {
      if (!o.gear || typeof o.gear !== 'object') o.gear = { hat: null, cloth: null, shoe: null, weapon: null, trinket: null, belt: null };
      return o.gear;
    }
    // ── 立绘占位（后续替换为 AI 水墨立绘）──
    function figHTML(it) {
      var seal = (it.name || '?').slice(0, 1);
      var cls = 'ch-fig ' + (it.kind === 'main' ? 'ch-fig-main' : (it.kind === 'officer' ? 'ch-fig-of' : 'ch-fig-p'));
      return '<div class="' + cls + '"><div class="ch-seal">' + escapeHtml(seal) + '</div>' +
        '<div class="ch-figname">' + escapeHtml(it.name) + '</div>' +
        '<div class="ch-figtitle">' + escapeHtml(it.sub) + '</div></div>';
    }
    // ── 左侧列表 ──
    function listHTML() {
      var h = '<div class="ch-list">';
      roster().forEach(function (it) {
        var on = it.key === sel ? ' on' : '';
        h += '<button type="button" class="ch-item' + on + '" data-key="' + it.key + '">' +
          '<span class="ch-ava">' + escapeHtml(it.tag) + '</span>' +
          '<span class="ch-meta"><b>' + escapeHtml(it.name) + '</b><i>' + escapeHtml(it.tag + ' · ' + it.sub) + '</i></span>' +
          '</button>';
      });
      return h + '</div>';
    }
    // ── 详情 ──
    function detailHTML() {
      if (sel === 'main') return mainDetailHTML ? mainDetailHTML() : '<p class="of-empty">主角</p>';
      var inst = getInst(sel);
      if (!inst) return '<div class="of-empty">该角色已不在麾下。</div>';
      if (sel.indexOf('p:') === 0) return partyDetail(inst);
      return officerDetail(inst);
    }
    function partyDetail(c) {
      var h = '<div class="ch-detail-head"><h3>随 从 · ' + escapeHtml(c.name) + '</h3><p class="ch-detail-sub">' + escapeHtml(c.title || c.role || '随行') + '</p></div>';
      h += row('气血', (c.hp || 0) + ' / ' + (c.maxHp || 0)) + row('内力', (c.mp || 0) + ' / ' + (c.maxMp || 0));
      h += row('攻击', c.atk || 0) + row('防御', c.def || 0) + row('身法', c.spd || 0);
      h += row('五行', c.element || '无');
      h += '<div class="row"><span>武学</span></div><div class="skills">' +
        (c.learnedMartial || []).map(function (m) {
          var a = (LF.MARTIAL_ARTS && LF.MARTIAL_ARTS.get) ? LF.MARTIAL_ARTS.get(m) : null;
          return '<span class="sk-tag">' + escapeHtml(a ? a.name : m) + '</span>';
        }).join('') +
        '</div>';
      return h;
    }
    function officerDetail(o) {
      var t = Officers.template(o.id) || {};
      var gear = ensureGear(o);
      var h = '<div class="ch-detail-head"><h3>武 将 · ' + escapeHtml(o.name) + '</h3><p class="ch-detail-sub">' + escapeHtml(t.title || '未授职') + '</p></div>';
      h += row('忠诚', o.loyalty != null ? o.loyalty + ' / 100' : '—');
      h += row('所属', escFaction(o));
      h += '<div class="row"><span>五维</span></div>' + (Officers.statBars ? Officers.statBars(o.stats) : '');
      var skIds = Officers.idsOf ? Officers.idsOf(t) : [];
      if (skIds.length) h += '<div class="row"><span>特技</span></div>' + (Officers.skillTagsHTML ? Officers.skillTagsHTML(skIds) : '');
      h += '<div class="row"><span>装备</span></div>' + gearHTML(o, gear);
      h += '<p class="tip">点空槽从行囊为武将取装，点已装位卸下归还行囊。武将装备暂不计入战斗数值（仅管理与展示）。</p>';
      return h;
    }
    function escFaction(o) {
      var F = (LF.FACTIONS || {})[o.faction];
      return escapeHtml((F && F.name) || o.faction || '在野');
    }
    // ── 武将六槽装备 ──
    function gearHTML(o, gear) {
      var h = '<div class="ch-gear">';
      Object.keys(SLOTS).forEach(function (slot) {
        if (slot === 'bag') return;
        var s = SLOTS[slot];
        var it = gear[slot];
        h += '<div class="ch-gslot' + (it ? ' has' : '') + '" data-slot="' + slot + '">' +
          '<span class="ch-gic">' + (it ? escapeHtml(it.icon || '') : escapeHtml(s.icon || '')) + '</span>' +
          '<b>' + (it ? escapeHtml(it.name) : escapeHtml(s.label)) + '</b>' +
          (it
            ? '<i class="ch-gact" data-act="unequip" data-slot="' + slot + '">卸</i>'
            : '<i class="ch-gact" data-act="pick" data-slot="' + slot + '">装</i>') +
          '</div>';
      });
      return h + '</div>';
    }
    function pickEquip(o, slot) {
      var items = packList() || [];
      var cands = items.filter(function (it) { return it.cat === '装备' && it.slot === slot; });
      if (!cands.length) { toast('行囊中没有可装备的' + ((SLOTS[slot] || {}).label || slot) + '。'); return; }
      var h = '<div class="ch-pick" data-slot="' + slot + '"><b>为 ' + escapeHtml(o.name) + ' 选' + escapeHtml((SLOTS[slot] || {}).label || slot) + '：</b>';
      cands.forEach(function (it) {
        var def = it.defId || it.id;
        h += '<button type="button" class="ch-pickit" data-def="' + escapeHtml(def) + '">' + escapeHtml(it.icon || '') + ' ' + escapeHtml(it.name) + '</button>';
      });
      h += '<button type="button" class="ch-pickit" data-cancel="1">取消</button></div>';
      var main = document.querySelector('#modal-card .ch-main');
      if (main) {
        var old = main.querySelector('.ch-pick'); if (old) old.remove();
        main.insertAdjacentHTML('beforeend', h);
        // 动态插入的选装条须即时绑定（bindCharHall 只在 openModal 时执行一次）
        var wrap = main.querySelector('.ch-pick[data-slot="' + slot + '"]');
        if (wrap) {
          wrap.querySelectorAll('.ch-pickit[data-def]').forEach(function (b) {
            b.onclick = function () { doEquip(o, slot, b.getAttribute('data-def')); };
          });
          wrap.querySelectorAll('.ch-pickit[data-cancel]').forEach(function (b) {
            b.onclick = function () { wrap.remove(); };
          });
        }
      }
    }
    function takeEquipFromPack(defId) {
      var pk = S().pack || [];
      for (var i = 0; i < pk.length; i++) {
        var c = pk[i];
        if (c && c.cat === '装备' && (c.defId === defId || c.id === defId)) { pk[i] = null; return c; }
      }
      return null;
    }
    function doEquip(o, slot, defId) {
      var it = takeEquipFromPack(defId);
      if (!it) { toast('那件装备不在行囊中。'); return; }
      var gear = ensureGear(o);
      var old = gear[slot];
      gear[slot] = it;
      if (old && old.defId) packAdd({ defId: old.defId, count: 1 });
      save(S());
      if (typeof afterPackChange === 'function') afterPackChange();
      openModal('char'); renderStatus();
      toast(o.name + ' 装备了「' + it.name + '」。');
    }
    function doUnequip(o, slot) {
      var gear = ensureGear(o);
      var it = gear[slot];
      if (!it) return;
      gear[slot] = null;
      if (it.defId && packAdd({ defId: it.defId, count: 1 }) === false) { gear[slot] = it; toast('行囊已满，无法卸下。'); return; }
      save(S());
      if (typeof afterPackChange === 'function') afterPackChange();
      openModal('char'); renderStatus();
      toast(o.name + ' 卸下了「' + it.name + '」。');
    }
    // ── 渲染与绑定 ──
    function renderCharHall() {
      var st = S();
      var me = { key: 'main', kind: 'main', name: st.name || '无名客', tag: '主', sub: 'LV.' + (st.level || 1) };
      var cur = roster().filter(function (x) { return x.key === sel; })[0] || me;
      return '<div class="ch-wrap">' +
        '<div class="ch-side">' + listHTML() + '</div>' +
        '<div class="ch-main"><div class="ch-stage">' + figHTML(cur) + '</div><div class="ch-detail">' + detailHTML() + '</div></div>' +
        '</div>';
    }
    function selectChar(key) { sel = key; openModal('char'); }
    function bindCharHall() {
      var card = document.querySelector('#modal-card');
      if (!card) return;
      card.querySelectorAll('.ch-item').forEach(function (b) {
        b.onclick = function () { sel = b.getAttribute('data-key'); openModal('char'); };
      });
      card.querySelectorAll('.ch-gact[data-act="pick"]').forEach(function (b) {
        b.onclick = function () { var o = getInst(sel); if (o) pickEquip(o, b.getAttribute('data-slot')); };
      });
      card.querySelectorAll('.ch-gact[data-act="unequip"]').forEach(function (b) {
        b.onclick = function () { var o = getInst(sel); if (o) doUnequip(o, b.getAttribute('data-slot')); };
      });
      card.querySelectorAll('.ch-pickit[data-def]').forEach(function (b) {
        b.onclick = function () {
          var wrap = b.closest('.ch-pick'); var slot = wrap ? wrap.getAttribute('data-slot') : '';
          var o = getInst(sel); if (o && slot) doEquip(o, slot, b.getAttribute('data-def'));
        };
      });
      card.querySelectorAll('.ch-pickit[data-cancel]').forEach(function (b) {
        b.onclick = function () { var el = b.closest('.ch-pick'); if (el) el.remove(); };
      });
      if (typeof bindMainDetail === 'function') bindMainDetail();
    }
    return {
      renderCharHall: renderCharHall, bindCharHall: bindCharHall, selectChar: selectChar,
      roster: roster, getInst: getInst
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.createCharHall;
})(typeof window !== 'undefined' ? window : globalThis);

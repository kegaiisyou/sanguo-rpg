// 行囊（背包）数据模型 + 基础操作层（v20260908i）
// 从 engine.js「格子制行囊核心」拆出：纯数据操作（无 DOM），供装备/商店/随从/战斗掉落/城内营造等系统共享。
// 依赖经 ctx 注入：getState（惰性，兼容读档时 state 被重新赋值）、LF（取 LF.ITEMS）、toast、afterPackChange（入库/重渲等引擎集成钩子）。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createInventory = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var toast = ctx.toast;
    var afterPackChange = ctx.afterPackChange;

    var BASE_PACK = 6;
    var DEF_MAX_STACK = 99;
    function packMax(st) {
      st = st || S();
      var m = BASE_PACK;
      if (st && st.equipment) {
        for (var k in st.equipment) {
          var eq = st.equipment[k];
          if (eq && eq.packSpace) m += eq.packSpace;
        }
      }
      return m;
    }
    // 装备/卸下背包装备后，按容量重排行囊数组长度（仅增长；缩容且装不下时保留原状以免丢物）
    function packResize() {
      var max = packMax();
      var items = S().pack.filter(function (x) { return x; });
      if (items.length > max) { toast('卸下背包后容量不足，物品暂留原处。'); return; }
      while (S().pack.length < max) S().pack.push(null);
      if (S().pack.length > max) {
        var a = new Array(max).fill(null), k = 0;
        for (var i = 0; i < S().pack.length; i++) { if (S().pack[i]) a[k++] = S().pack[i]; }
        S().pack = a;
      }
    }
    function packEnsure(st) {
      if (!st.equipment) st.equipment = {};
      LF.ITEMS.SLOT_KEYS.forEach(function (k) { if (!(k in st.equipment)) st.equipment[k] = null; });
      var max = packMax(st);
      if (!Array.isArray(st.pack)) { st.pack = new Array(max).fill(null); }
      else {
        var items = st.pack.filter(function (x) { return x; });
        if (items.length > max) items = items.slice(0, max);   // 容量缩小时丢弃溢出（保留前 max 件）
        var a = new Array(max).fill(null);
        for (var i = 0; i < items.length; i++) a[i] = items[i];
        st.pack = a;
      }
      if (st.equipment.armor) { st.equipment.cloth = st.equipment.armor; delete st.equipment.armor; }
      if (st.equipment.mount) { st.equipment.belt = st.equipment.mount; delete st.equipment.mount; }
      if (Array.isArray(st.items)) {
        st.items.forEach(function (it) {
          var k = itemKey(it);
          if (k && it.cat !== '装备') {
            for (var i = 0; i < st.pack.length; i++) {
              var c = st.pack[i];
              if (c && itemKey(c) === k && c.cat !== '装备') { c.count = (c.count || 1) + (it.count || 1); return; }
            }
          }
          var e = st.pack.indexOf(null); if (e < 0) e = st.pack.length; st.pack[e] = it;
        });
        st.items = null;
      }
    }
    function itemKey(it) { return it ? (it.defId || it.id) : null; }
    function packIsStackable(it) { return it && it.cat !== '装备' && !it.maxDur; }
    function packFirstEmpty() {
      var pk = S().pack;
      for (var i = 0; i < pk.length; i++) { if (!pk[i]) return i; }
      return -1;
    }
    function packAdd(itemOrDefId, count) {
      var defId, baseCount;
      if (typeof itemOrDefId === 'string') { defId = itemOrDefId; baseCount = count || 1; }
      else { var o = itemOrDefId; defId = o.defId || o.id; baseCount = (o.count || 1) + (count || 0); }
      if (!defId) return false;
      var d = LF.ITEMS[defId] || {};
      var pk = S().pack;
      if (!packIsStackable({ cat: d.cat, maxDur: d.maxDur })) {
        if (typeof itemOrDefId !== 'string') itemOrDefId.count = baseCount;
        var e = packFirstEmpty();
        if (e < 0 && pk.length < packMax()) { pk.push(null); e = packFirstEmpty(); }
        if (e < 0) { toast('行囊已满，拾取失败。'); return false; }
        pk[e] = (typeof itemOrDefId === 'string') ? LF.ITEMS.makeItem(defId, baseCount) : itemOrDefId;
        return true;
      }
      var cap = d.maxStack || DEF_MAX_STACK, rem = baseCount;
      for (var i = 0; i < pk.length && rem > 0; i++) {
        var c = pk[i];
        if (c && itemKey(c) === defId && packIsStackable(c)) {
          var space = cap - (c.count || 0);
          if (space > 0) { var add = Math.min(space, rem); c.count += add; rem -= add; }
        }
      }
      while (rem > 0) {
        var e2 = packFirstEmpty();
        if (e2 < 0 && pk.length < packMax()) { pk.push(null); e2 = packFirstEmpty(); }
        if (e2 < 0) { toast('行囊已满，拾取失败。'); return false; }
        var put = Math.min(cap, rem);
        pk[e2] = LF.ITEMS.makeItem(defId, put); rem -= put;
      }
      return true;
    }
    function packConsume(defId, n) {
      n = n || 1; var rem = n, pk = S().pack;
      for (var i = 0; i < pk.length && rem > 0; i++) {
        var c = pk[i];
        if (c && itemKey(c) === defId && c.cat !== '装备') {
          var take = Math.min(rem, c.count || 1); c.count -= take; rem -= take;
          if (c.count <= 0) pk[i] = null;
        }
      }
      return rem === 0;
    }
    function packFind(defId) {
      var pk = S().pack;
      if (!pk) return null;
      for (var i = 0; i < pk.length; i++) { var c = pk[i]; if (c && itemKey(c) === defId) return c; }
      return null;
    }
    function packList() {
      var o = [], pk = S().pack;
      for (var i = 0; i < pk.length; i++) { if (pk[i]) o.push(pk[i]); }
      return o;
    }
    function packGet(loc) { return loc.kind === 'pack' ? S().pack[loc.idx] : S().equipment[loc.slot]; }
    function packSet(loc, val) { if (loc.kind === 'pack') S().pack[loc.idx] = val; else S().equipment[loc.slot] = val; }
    function locEq(a, b) { return a.kind === b.kind && (a.kind === 'pack' ? a.idx === b.idx : a.slot === b.slot); }

    // 直接使用物品（非战斗，疗伤/补内/进食）
    function usePackItem(idx) {
      var pk = S().pack, it = pk[idx]; if (!it) return;
      if (it.cat === '装备') { toast('装备需拖至装备栏，不可直接使用。'); return; }
      // v20261008c：生药有毒（半夏/附子）——不可生服，明确提示，不消耗
      if (it.toxic || ((LF.ITEMS[itemKey(it)] || {}).toxic)) {
        toast('「' + (it.name || '此物') + '」生品有毒，须依法炮制后方可入药，莫要生服。');
        return;
      }
      // v20261008c：条目精简（旧档/外部构造缺 effect）时用物品表回填，保证使用生效
      if (!it.effect) {
        var _d0 = (LF.ITEMS && LF.ITEMS[itemKey(it)]) || {};
        if (_d0.effect) it.effect = _d0.effect;
        if (_d0.name && !it.name) it.name = _d0.name;
        if (_d0.icon && !it.icon) it.icon = _d0.icon;
        if (_d0.cat && !it.cat) it.cat = _d0.cat;
      }
      if (it.effect) {
        var e = it.effect, gain = 0, full = [], msgs = [];
        if (e.hp) { if (S().hp >= S().maxHp) full.push('气血'); else { S().hp = Math.min(S().maxHp, S().hp + e.hp); gain++; msgs.push('伤势略缓（+' + e.hp + '）'); } }
        if (e.mp) { if (S().mp >= S().maxMp) full.push('内息'); else { S().mp = Math.min(S().maxMp, S().mp + e.mp); gain++; msgs.push('内息稍复（+' + e.mp + '）'); } }
        if (e.food) { if ((S().food || 0) >= 100) full.push('食'); else { S().food = Math.min(100, (S().food || 0) + e.food); gain++; msgs.push('腹中稍暖（+' + e.food + '）'); } }
        if (e.drink) { if ((S().drink || 0) >= 100) full.push('饮'); else { S().drink = Math.min(100, (S().drink || 0) + e.drink); gain++; msgs.push('喉间得润（+' + e.drink + '）'); } }
        // v20261008b：精力补给（B 轴提神药）—— 五维中此前唯一无补给的一项，只能靠睡觉
        if (e.energy) { var mxEn = S().maxEnergy || 100; if ((S().energy || 0) >= mxEn) full.push('精力'); else { S().energy = Math.min(mxEn, (S().energy || 0) + e.energy); gain++; msgs.push('精神一振（+' + e.energy + '）'); } }
        if (gain === 0) { toast('「' + it.name + '」所滋补皆已满，留着吧。'); return; }   // 对应属性已满 → 拦截，防误点浪费
        toast(msgs.join('；') + (full.length ? '（' + full.join('、') + '已满，未耗）' : ''));
      } else if (it.maxDur) { toast('「' + it.name + '」为器具，于对应劳作时自行消耗耐久，无需手动使用。'); return; }
      else { toast('此物暂无可施用之效。'); return; }
      // 进食钩子（v20260915d）：「灶上一口热饭」一类例事按「真的吃了什么」记账，由引擎 LF.onEat 接手
      try { if (LF && LF.onEat) LF.onEat(it.defId, it.name); } catch (e) {}
      it.count--; if (it.count <= 0) pk[idx] = null;
      afterPackChange();
    }
    function discardPackItem(idx) {
      var pk = S().pack, it = pk[idx]; if (!it) return;
      pk[idx] = null; toast('已丢弃「' + it.name + '」。'); afterPackChange();
    }
    function packAutoSort() {
      var items = packList();
      var map = {};
      items.forEach(function (it) {
        if (it.cat !== '装备') {
          var key = it.defId; if (!map[key]) map[key] = { item: it }; else map[key].item.count += (it.count || 1);
        }
      });
      var equipItems = items.filter(function (it) { return it.cat === '装备'; });
      var merged = Object.keys(map).map(function (k) { return map[k].item; });
      var out = merged.concat(equipItems), pk = S().pack;
      for (var i = 0; i < pk.length; i++) pk[i] = null;
      out.forEach(function (it, i) { pk[i] = it; });
      toast('行囊已整理。'); afterPackChange();
    }

    return {
      BASE_PACK: BASE_PACK,
      packMax: packMax, packResize: packResize, packEnsure: packEnsure,
      itemKey: itemKey, packIsStackable: packIsStackable, packFirstEmpty: packFirstEmpty,
      packAdd: packAdd, packConsume: packConsume, packFind: packFind, packList: packList,
      packGet: packGet, packSet: packSet, locEq: locEq,
      usePackItem: usePackItem, discardPackItem: discardPackItem, packAutoSort: packAutoSort
    };
  };
})(typeof window !== 'undefined' ? window : global);

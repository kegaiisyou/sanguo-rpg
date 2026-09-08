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
      var it;
      if (typeof itemOrDefId === 'string') { it = LF.ITEMS.makeItem(itemOrDefId, count || 1); }
      else { it = itemOrDefId; if (count) it.count = (it.count || 1) + count; }
      if (!it) return false;
      if (packIsStackable(it)) {
        var k = itemKey(it), pk = S().pack;
        for (var i = 0; i < pk.length; i++) {
          var c = pk[i];
          if (c && itemKey(c) === k && c.cat !== '装备') { c.count = (c.count || 1) + (it.count || 1); return true; }
        }
      }
      var e = packFirstEmpty();
      if (e < 0 && S().pack.length < packMax()) { while (S().pack.length < packMax()) S().pack.push(null); e = packFirstEmpty(); }   // 防御：数组短于容量时先补齐再判定
      if (e < 0) { toast('行囊已满，拾取失败。'); return false; }
      S().pack[e] = it; return true;
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
      if (it.effect) {
        if (it.effect.hp) { S().hp = Math.min(S().maxHp, S().hp + (it.effect.hp || 0)); toast('伤势略缓（+' + (it.effect.hp || 0) + '）。'); }
        if (it.effect.mp) { S().mp = Math.min(S().maxMp, S().mp + (it.effect.mp || 0)); toast('内息稍复（+' + (it.effect.mp || 0) + '）。'); }
        if (it.effect.food) { S().food = Math.min(100, (S().food || 0) + (it.effect.food || 0)); toast('腹中稍暖（+' + (it.effect.food || 0) + '）。'); }
        if (it.effect.drink) { S().drink = Math.min(100, (S().drink || 0) + (it.effect.drink || 0)); toast('喉间得润（+' + (it.effect.drink || 0) + '）。'); }
      } else if (it.maxDur) { toast('「' + it.name + '」为器具，于对应劳作时自行消耗耐久，无需手动使用。'); return; }
      else { toast('此物暂无可施用之效。'); return; }
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

// 乱世烽火 · 地图视图子系统（城内布防图 / 郊野图 / 山河志 三套地图的渲染与页签绑定）
// UMD：浏览器挂到 window.LF，Node 端走 module.exports（校验用）
(function (global) {
  var LF = global.LF || (global.LF = {});
  LF.createMapView = function (ctx) {
    // 依赖经 ctx 注入：state 惰性取值（读档会重赋值），其余为城市模型（City.* 别名）与引擎本地函数
    var S = ctx.getState, LF_ = ctx.LF, G = ctx.G,
        CELL_META = ctx.CELL_META, cellDisplayType = ctx.cellDisplayType,
        cityBurnedMap = ctx.cityBurnedMap, cellDisplayName = ctx.cellDisplayName,
        genCityGrid = ctx.genCityGrid, cityCellSiteName = ctx.cityCellSiteName,
        fieldHasWater = ctx.fieldHasWater, initStrategicMapInGame = ctx.initStrategicMapInGame,
        openModal = ctx.openModal;
    // 郊野入城点映射缓存：拓扑在 link() 后即固定，按郊野 id 缓存，避免每次开图重复扫描远边格
    var _FIELD_CITYOUT_CACHE = {};

    // 统一地图入口（v20260906c）：三套地图（城内布防图 / 郊野图 / 山河志）共用 openModal('map')，
    // 行为一致；scope ∈ 'city' | 'field' | 'world' | 'auto'(默认=当前上下文) 决定默认展示页。
    function openMap(scope, opts) {
      opts = opts || {}; var o = {}; for (var _k in opts) o[_k] = opts[_k];
      o._scope = scope || 'auto';
      if (scope === 'world') o.forceWorld = true;
      openModal('map', o);
    }
    // ===== 山河图 · 城内网格视图（v20260824b）=====
    // 仅作城郭总览展示（地图不再承担移动职责），移动统一走下方方向键
    function buildMapCityHTML(opts) {
      opts = opts || {};
      var cid = S().room, cp = S().flags.cityPos, m = genCityGrid(cid);
      if (!m || !cp) return '';
      var size = m.size, CELL = 62, W = size * CELL, H = size * CELL;
      var cname = ((LF_.CITIES[cid] || {}).name || '城');
      var cells = '';
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var t = cellDisplayType(cid, x, y), meta = CELL_META[t] || CELL_META.empty;
        var ri = (t === 'gate') ? { gate: true, nm: '城门', ic: '🏛️', desc: '' } : null;
        var burnt = !!cityBurnedMap(cid)[x + ',' + y];
        var cur = (cp.x === x && cp.y === y);
        var adj = (Math.abs(cp.x - x) + Math.abs(cp.y - y)) === 1;
        var locked = (t === 'ruin' || t === 'unbuilt' || t === 'site');
        var cls = 'mc-cell mc-' + t + (ri && ri.lv ? (' mc-r' + ri.lv) : '') + (cur ? ' mc-cur' : '') + (adj && !locked ? ' mc-adj' : '') + (locked ? ' mc-block mc-locked' : '') + (burnt ? ' mc-burnt' : '');
        var _nm;
        if (ri) _nm = ri.gate ? '城门' + (burnt ? '·焚' : '') : ri.nm + (burnt ? '·焚' : '');
        else if (t === 'market') { var _mk = m.markets && m.markets[x + ',' + y]; _nm = _mk ? _mk.name : cellDisplayName(cid, t); }
        else if (t === 'site') _nm = cityCellSiteName(cid, x, y);
        else _nm = cellDisplayName(cid, t);
        cells += '<div class="' + cls + '" data-x="' + x + '" data-y="' + y + '"' +
          ' style="left:' + (x * CELL) + 'px;top:' + (y * CELL) + 'px;width:' + CELL + 'px;height:' + CELL + 'px">' +
          '<span class="mc-ic">' + (ri && !ri.gate ? ri.ic : meta.i) + '</span><span class="mc-nm">' + _nm + '</span></div>';
      }
      var curMetaName = cellDisplayName(cid, m.cells[cp.y][cp.x]);
      // v20260905j：移除「返回山河志（出城）」按钮——切山河志改走页签，出城仍须立于城门格经罗盘
      return '<h3>' + cname + ' · 城内布防图</h3>' +
        '<div class="map-city"><div class="map-city-canvas" style="width:' + W + 'px;height:' + H + 'px">' + cells + '</div></div>' +
        '<div class="mk-bar"><button class="mk-recenter" id="mc-recenter">⌖ 回到当前位置</button></div>' +
        '<p class="tip">城中街道由下方方向键游走；地图仅为城郭总览。当前位于〔' + curMetaName + '〕。' +
        '城中街道可自由通行；出城须至城门——站上城门格，罗盘便会亮出朝外的出城方向。</p>';
    }
    // 城内打开「地图」时的双页签：默认城内布防图，可切换到山河志（十三州战略地图，v20260905j）
    function buildCityMapTabsHTML(forceWorld) {
      var cityOn = !forceWorld, worldOn = !!forceWorld;
      return '<div class="map-tabs" id="map-tabs">' +
        '<button type="button" class="mt-tab' + (cityOn ? ' on' : '') + '" data-tab="city">🏯 城内布防图</button>' +
        '<button type="button" class="mt-tab' + (worldOn ? ' on' : '') + '" data-tab="world">🗺 山河志 · 十三州</button></div>' +
        '<div class="map-tab-body' + (cityOn ? '' : ' hidden') + '" data-body="city">' + buildMapCityHTML({}) + '</div>' +
        '<div class="map-tab-body' + (worldOn ? '' : ' hidden') + '" data-body="world">' +
        '<h3>山河志 · 战略地图</h3><div id="strategic-map-container"></div>' +
        '<p class="tip">拖拽平移 · 滚轮缩放 · 点城池查看详情/前往（体力-4·食物-1·饮水-1·时间+1刻）。' +
        '打开时默认以你所在之处居中；切回「城内布防图」可继续在城中走动。</p></div>';
    }
    // 郊野局部地图（v20260905n）：4×4 网格展示当前郊野——玩家所在格、入口(回母城)、资源/野兽/路人、远边通邻城出口
    function buildFieldMapHTML(opts) {
      opts = opts || {};
      var rid = S().room, room = G.ROOMS[rid];
      if (!room || !room.isField || !room.fieldId) return '';
      var fid = room.fieldId;
      var fp = (LF_.PLACES || {})[fid] || {};
      var size = fp.size || 4, gd = fp.gateDir || '东';
      var geo = LF_.Travel.fieldGeometry(size, gd);
      var CELL = 62, W = size * CELL, H = size * CELL, fc = room.fc, fr = room.fr;
      var meta = ((LF_.Travel && LF_.Travel.fields) || {})[fid] || {};
      var parentName = ((LF_.CITIES || {})[fp.parent] && LF_.CITIES[fp.parent].name) || ((LF_.PLACES || {})[fp.parent] && LF_.PLACES[fp.parent].name) || fp.parent || '';
      // 远边入城点：按郊野 id 缓存扫描结果（拓扑固定）；远边各格 exits[gateDir] 指向城市的即为入城口
      if (!_FIELD_CITYOUT_CACHE[fid]) {
        var _co = {};
        (function () {
          var far = [];
          if (gd === '东' || gd === '西') { for (var r = 0; r < size; r++) far.push([r, geo.farCol]); }
          else { for (var c = 0; c < size; c++) far.push([geo.farRow, c]); }
          far.forEach(function (p) {
            var rm = G.ROOMS[LF_.Travel.roomId(fid, p[0], p[1])] || {};
            var ex = rm.exits && rm.exits[gd];
            if (typeof ex === 'string' && ex.indexOf('__gate__:') === 0) {
              var nid = ex.split(':')[1];
              _co[p[0] + ',' + p[1]] = ((LF_.CITIES || {})[nid] && LF_.CITIES[nid].name) || ((LF_.PLACES || {})[nid] && LF_.PLACES[nid].name) || nid;
            }
          });
        })();
        _FIELD_CITYOUT_CACHE[fid] = _co;
      }
      var cityOut = _FIELD_CITYOUT_CACHE[fid];
      var cells = '';
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
        var cid = LF_.Travel.roomId(fid, r, c), cr = G.ROOMS[cid] || {};
        var isCur = (r === fr && c === fc), isEntry = (r === geo.entryR && c === geo.entryC);
        var cityNm = cityOut[r + ',' + c];
        var ic = '·', nm = '荒野', cls = 'mc-cell mf' + (isCur ? ' mc-cur' : '');
        if (isEntry) { ic = '🚪'; nm = '入' + parentName; cls += ' mf-entry'; }
        else if (cityNm) { ic = '🏰'; nm = '入' + cityNm + '·' + gd; cls += ' mf-cityout'; }
        else if (cr.resources && cr.resources.length) { ic = '🌿'; nm = cr.resources[0].name; }
        else if (cr.monsters && cr.monsters.length) { var m0 = cr.monsters[0]; ic = (m0.aggr === 'flee' ? '🐗' : (m0.aggr === 'neutral' ? '🐺' : '⚔')); nm = m0.name; }
        else if (cr.water) { ic = cr.water.icon || '💧'; nm = cr.water.name; }
        else if (cr.fieldNpcs && cr.fieldNpcs.length) { ic = '💬'; nm = cr.fieldNpcs[0].name; }
        cells += '<div class="' + cls + '" data-x="' + c + '" data-y="' + r + '"' +
          ' style="left:' + (c * CELL) + 'px;top:' + (r * CELL) + 'px;width:' + CELL + 'px;height:' + CELL + 'px">' +
          '<span class="mc-ic">' + ic + '</span><span class="mc-nm">' + nm + '</span></div>';
      }
      var exits = '';
      (meta.neighbors || []).forEach(function (nb) {
        var nn = ((LF_.PLACES || {})[nb.nid] && LF_.PLACES[nb.nid].name) || nb.nid;
        exits += '<li>远边行军 → 『' + nn + '』</li>';
      });
      return '<h3>' + fp.name + ' · 郊野图</h3>' +
        '<div class="map-city"><div class="map-city-canvas" style="width:' + W + 'px;height:' + H + 'px">' + cells + '</div></div>' +
        '<p class="tip">你正行于〔' + parentName + '〕之' + (gd) + '郊野，当前位于〔' + (room.nmBand || '郊野') + '〕。' +
        '金框为你的所在；🚪 入' + parentName + '（回城口）　🏰 入邻城（远边通城口）。' +
        (fieldHasWater(room) ? '　💧 水畔可 🎣 垂钓。' : '') + '</p>' +
        (exits ? '<ul class="mf-exits">' + exits + '</ul>' : '') + buildFieldAttrPanel(fid);
    }
    // 野地属性面板（v20260906d）：聚合本野地资源/野怪/友好路人，列出临近城市与母城治安倾向
    function buildFieldAttrPanel(fid) {
      var fp = (LF_.PLACES || {})[fid] || {};
      var size = fp.size || 4, gd = fp.gateDir || '东';
      var res = {}, mon = {}, npc = {}, wat = {}, r, c, rm;
      for (r = 0; r < size; r++) for (c = 0; c < size; c++) {
        rm = G.ROOMS[LF_.Travel.roomId(fid, r, c)]; if (!rm) continue;
        (rm.resources || []).forEach(function (x) { if (!res[x.type]) res[x.type] = { name: x.name, item: x.item, amt: 0 }; res[x.type].amt += (x.amt || 1); });
        (rm.monsters || []).forEach(function (x) { if (!mon[x.id]) mon[x.id] = { name: x.name, aggr: x.aggr, lvl: 1, n: 0 }; mon[x.id].n++; if ((x.lvl || 1) > mon[x.id].lvl) mon[x.id].lvl = x.lvl; });
        (rm.fieldNpcs || []).forEach(function (x) { if (!npc[x.type]) npc[x.type] = { name: x.name, n: 0 }; npc[x.type].n++; });
        if (rm.water) { if (!wat[rm.water.type]) wat[rm.water.type] = { name: rm.water.name, icon: rm.water.icon, n: 0 }; wat[rm.water.type].n++; }
      }
      var cid = fp.parent, cdef = (LF_.CITIES || {})[cid] || {};
      var order = (S().flags && S().flags.cityOrder && S().flags.cityOrder[cid] != null) ? S().flags.cityOrder[cid] : (cdef.order != null ? cdef.order : 50);
      var disp = order >= 60 ? '安靖 🟢' : (order < 40 ? '动荡 🔴' : '平靖 🟡');
      var parentName = (cdef.name) || ((LF_.PLACES || {})[cid] && LF_.PLACES[cid].name) || cid;
      var near = (LF_.Travel.fields[fid] && LF_.Travel.fields[fid].neighbors) || [];
      function listHtml(map, fn) { var ks = Object.keys(map); if (!ks.length) return '<span style="opacity:.5">无</span>'; return ks.map(fn).join('　'); }
      var resHtml = listHtml(res, function (k) { var o = res[k]; return (o.item && LF_.ITEMS[o.item] ? LF_.ITEMS[o.item].icon : '🌿') + ' ' + o.name + '×' + o.amt; });
      var monHtml = listHtml(mon, function (k) { var m = mon[k]; var ic = m.aggr === 'flee' ? '🐗' : (m.aggr === 'neutral' ? '🐺' : '⚔'); return ic + ' ' + m.name + '×' + m.n; });
      var npcHtml = listHtml(npc, function (k) { return '💬 ' + npc[k].name + '×' + npc[k].n; });
      var watHtml = listHtml(wat, function (k) { var o = wat[k]; return (o.icon || '💧') + ' ' + o.name + '×' + o.n; });
      var nearHtml = near.length ? near.map(function (nb) { var n = (LF_.PLACES[nb.nid] && LF_.PLACES[nb.nid].name) || nb.nid; return '🏯 ' + n + (nb.li ? ('（' + nb.li + '里）') : ''); }).join('　') : '（荒僻无邻）';
      var rowStyle = 'display:flex;gap:8px;padding:3px 0;border-bottom:1px dashed rgba(255,255,255,.08);font-size:13px;line-height:1.5;';
      var kStyle = 'flex:0 0 64px;color:#c8a45a;font-weight:600;';
      var vStyle = 'flex:1;color:#e8e0cf;';
      return '<div style="margin-top:10px;padding:8px 10px;background:rgba(0,0,0,.22);border:1px solid rgba(200,164,90,.28);border-radius:8px;">' +
        '<div style="' + rowStyle + '"><span style="' + kStyle + '">母城治安</span><span style="' + vStyle + '">' + parentName + ' · ' + order + ' · ' + disp + '</span></div>' +
        '<div style="' + rowStyle + '"><span style="' + kStyle + '">临近城市</span><span style="' + vStyle + '">' + nearHtml + '</span></div>' +
        '<div style="' + rowStyle + '"><span style="' + kStyle + '">资源</span><span style="' + vStyle + '">' + resHtml + '</span></div>' +
        '<div style="' + rowStyle + '"><span style="' + kStyle + '">野怪</span><span style="' + vStyle + '">' + monHtml + '</span></div>' +
        '<div style="' + rowStyle + '"><span style="' + kStyle + '">水域</span><span style="' + vStyle + '">' + watHtml + '</span></div>' +
        '<div style="' + rowStyle + 'border-bottom:none"><span style="' + kStyle + '">路人</span><span style="' + vStyle + '">' + npcHtml + '</span></div>' +
        '</div>';
    }
    // 野外打开「地图」时的双页签：默认郊野图，可切换到山河志（十三州战略地图，v20260905n）
    function buildFieldMapTabsHTML(forceWorld) {
      var fieldOn = !forceWorld, worldOn = !!forceWorld;
      return '<div class="map-tabs" id="map-tabs">' +
        '<button type="button" class="mt-tab' + (fieldOn ? ' on' : '') + '" data-tab="field">🏕 郊野图</button>' +
        '<button type="button" class="mt-tab' + (worldOn ? ' on' : '') + '" data-tab="world">🗺 山河志 · 十三州</button></div>' +
        '<div class="map-tab-body' + (fieldOn ? '' : ' hidden') + '" data-body="field">' + buildFieldMapHTML({}) + '</div>' +
        '<div class="map-tab-body' + (worldOn ? '' : ' hidden') + '" data-body="world">' +
        '<h3>山河志 · 战略地图</h3><div id="strategic-map-container"></div>' +
        '<p class="tip">拖拽平移 · 滚轮缩放 · 点城池查看详情。打开时默认以你所在郊野居中。</p></div>';
    }
    // 页签绑定：布防图/郊野图 与 山河志 互切；山河志首次激活时（点击或默认页）才初始化并聚焦「此身所在」
    function initMapTabs() {
      var tabs = document.querySelector('#modal-card .map-tabs');
      if (!tabs) return false;
      var worldDone = false;
      function activateWorld() {
        if (worldDone) return;
        worldDone = true;
        initStrategicMapInGame({ focusYou: true });   // 打开即居中玩家所在
      }
      tabs.querySelectorAll('.mt-tab').forEach(function (b) {
        b.onclick = function () {
          var go = b.getAttribute('data-tab');
          tabs.querySelectorAll('.mt-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
          document.querySelectorAll('#modal-card .map-tab-body').forEach(function (x) {
            x.classList.toggle('hidden', x.getAttribute('data-body') !== go);
          });
          if (go === 'world') activateWorld();
        };
      });
      // 若默认即为山河志页（如 openMap('world')），打开即初始化
      var active = tabs.querySelector('.mt-tab.on');
      if (active && active.getAttribute('data-tab') === 'world') activateWorld();
      return true;
    }
    function initMapCity(opts) {
      opts = opts || {};
      var wrap = document.querySelector('#modal-card .map-city'); if (!wrap) return;
      // 地图定位为「信息/总览」，不再作为移动手段：取消点格行走，仅保留回到当前位置
      var rb = document.getElementById('mc-recenter');
      if (rb) rb.onclick = function () {
        var cur = wrap.querySelector('.mc-cell.mc-cur');
        if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      };
    }
    return {
      openMap: openMap,
      buildMapCityHTML: buildMapCityHTML,
      buildCityMapTabsHTML: buildCityMapTabsHTML,
      buildFieldMapHTML: buildFieldMapHTML,
      buildFieldAttrPanel: buildFieldAttrPanel,
      buildFieldMapTabsHTML: buildFieldMapTabsHTML,
      initMapTabs: initMapTabs,
      initMapCity: initMapCity
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createMapView;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

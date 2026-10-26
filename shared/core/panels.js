// 模块 panels（从 engine.js 拆分）：展示型面板簇
// 只负责「渲染一段 HTML 字符串」，不触碰 $card/$modal 框架、不参与状态推进。
//   renderCodex       图鉴·览物志（武学十三艺线 / 门派 / 贼寇名录）
//   renderSettings    设置三标签页（画面 / 声音 / 游戏）；fromTitle 时不含调试台
//   renderCredit      群英同撰
//   topObjectiveText  顶部志向标题（注：当前无调用点，statusbar 抽出后的遗留）
//   renderLogPanel    回顾（logRing 近 HIST_MAX 句，旧句在上）
//   renderLevelup     破境弹窗（读即清 levelupGained）
//   renderCityStat    城况·城型城门市集工事一览
// 依赖全部由 engine.js 工厂注入；可变绑定一律走 getter。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createPanels = function (ctx) {
    // state 会被读档/新局重赋值 → getState
    var getState = ctx.getState, S = getState;
    // Core.settings（engine L9）：对象引用，仍走 getter 以防日后重挂
    var getSettings = ctx.getSettings, SET = getSettings;
    // HIST_MAX 声明在 engine L4125，晚于本工厂插入点，直接传值会捕获 undefined → 必须 getter
    var getHistMax = ctx.getHistMax, HMAX = getHistMax;
    var G = ctx.G;                        // Core.G（engine L7）
    var LF = ctx.LF;                      // 命名空间（CONSTANTS.VERSION / OBJECTIVES）
    var SFX = ctx.SFX;                    // engine L30
    var lfSpeedLabel = ctx.lfSpeedLabel;  // Core.lfSpeedLabel（engine L14）
    var row = ctx.row;                    // 函数声明，提升可用
    var escapeHtml = ctx.escapeHtml;
    // 城况面板依赖（City 模块链式别名，engine L110-129 声明，早于工厂插入点）
    var cityProfile = ctx.cityProfile, genCityGrid = ctx.genCityGrid,
        cellDisplayType = ctx.cellDisplayType, availableGateDirs = ctx.availableGateDirs,
        cityLevelName = ctx.cityLevelName, cityGridSize = ctx.cityGridSize,
        cityDevOf = ctx.cityDevOf;      // 函数声明，提升可用

    // 图鉴：览物志（重构 v20261026c）
    // 多分类收藏：人物 / 城镇 / 装备 / 武学 / 配方 / 势力 / 建筑 / 奇遇 / 兵种
    var CX_DEF = [
      { k: 'person',  n: '人物' },
      { k: 'city',    n: '城镇' },
      { k: 'item',    n: '装备' },
      { k: 'martial', n: '武学' },
      { k: 'recipe',  n: '配方' },
      { k: 'faction', n: '势力' },
      { k: 'build',   n: '建筑' },
      { k: 'event',   n: '奇遇' },
      { k: 'enemy',   n: '兵种' }
    ];
    var _cxCache = {};
    function cxFn(k) {
      return ({
        person: codexPersons, city: codexCities, item: codexItems, martial: codexMartial,
        recipe: codexRecipes, faction: codexFactions, build: codexBuildings,
        event: codexEvents, enemy: codexEnemies
      })[k];
    }
    function cxRender(k) {
      if (_cxCache[k]) return _cxCache[k];
      var fn = cxFn(k), out;
      try { out = fn ? fn() : '<p class="tip">暂无数据。</p>'; }
      catch (e) { out = '<p class="tip">该分类暂不可读。</p>'; }
      _cxCache[k] = out; return out;
    }
    function renderCodex() {
      var h = '<h3>览 物 志</h3><p class="tip">天下风物，皆录于此；点条目可展开详情。</p>';
      h += '<div class="cx-tabs">';
      CX_DEF.forEach(function (t, i) {
        h += '<button class="cx-tab' + (i === 0 ? ' on' : '') + '" data-cx="' + t.k + '" onclick="window.__cxTab(\'' + t.k + '\')">' + t.n + '</button>';
      });
      h += '</div><div class="cx-body">';
      CX_DEF.forEach(function (t, i) {
        h += '<div class="cx-pg' + (i === 0 ? '' : ' hidden') + '" data-pg="' + t.k + '">' + (i === 0 ? cxRender(t.k) : '') + '</div>';
      });
      h += '</div>';
      return h;
    }
    function cxStat(label, val, max) {
      max = max || 100;
      var pct = Math.max(0, Math.min(100, Math.round((val || 0) / max * 100)));
      return '<div class="cx-stat"><span class="cx-stat-l">' + label + '</span><span class="cx-stat-bar"><i style="width:' + pct + '%"></i></span><span class="cx-stat-v">' + (val || 0) + '</span></div>';
    }
    function power(o) { var s = o.stats || {}; return (s.wu || 0) + (s.zhi || 0) + (s.tong || 0) + (s.zheng || 0) + (s.mei || 0); }
    function facOf(key) { return (G.FACTIONS && G.FACTIONS[key]) ? G.FACTIONS[key] : null; }
    function cityNameOf(cid) { return (G.CITIES && G.CITIES[cid]) ? G.CITIES[cid].name : (cid || '—'); }

    function codexPersons() {
      var list = (G.PERSONA && G.PERSONA.listRegistered) ? G.PERSONA.listRegistered() : [];
      if (!list.length) return '<p class="tip">尚无武将数据。</p>';
      list.sort(function (a, b) { return power(b) - power(a); });
      var h = '<div class="cx-grid">';
      list.forEach(function (o) {
        var fac = facOf(o.faction), facName = fac ? fac.name : (o.faction || '—'), facColor = fac ? fac.color : '#888';
        var tags = (o.tags || []).join('·');
        h += '<div class="cx-card" onclick="window.__cxToggle(this)">' +
          '<div class="cx-card-h"><span class="cx-dot" style="background:' + facColor + '"></span><b>' + escapeHtml(o.name) + '</b><span class="cx-sub">' + escapeHtml(o.title || '') + '</span></div>' +
          '<div class="cx-meta"><span>' + escapeHtml(facName) + '</span><span>战力 ' + power(o) + '</span>' + (tags ? '<span>#' + escapeHtml(tags) + '</span>' : '') + '</div>' +
          '<div class="cx-detail">' +
            cxStat('武勇', o.stats.wu) + cxStat('智略', o.stats.zhi) + cxStat('统率', o.stats.tong) + cxStat('政务', o.stats.zheng) + cxStat('魅力', o.stats.mei) +
            '<div class="cx-line">驻城：' + escapeHtml(cityNameOf(o.home)) + '　忠诚：' + (o.loyalty != null ? o.loyalty : '—') + '</div>' +
            (o.skills && o.skills.length ? '<div class="cx-line">特技：' + escapeHtml(o.skills.join('、')) + '</div>' : '') +
            '<div class="cx-bio">' + escapeHtml(o.bio || '') + '</div>' +
          '</div></div>';
      });
      return h + '</div>';
    }
    function codexCities() {
      var C = G.CITIES || {}, keys = Object.keys(C);
      if (!keys.length) return '<p class="tip">尚无城镇数据。</p>';
      var TIER = { xian: '县', jun: '郡', zhou: '州' }, CTYPE = { plain: '平原城', mountain: '山城', fort: '军镇', port: '港口', shuizhai: '水寨', pass: '关隘' };
      var h = '<div class="cx-grid">';
      keys.forEach(function (id) {
        var c = C[id]; if (!c) return;
        var fac = facOf(c.owner), facName = fac ? fac.name : (c.owner || '—'), facColor = fac ? fac.color : '#888';
        var tier = (TIER[c.tier] || c.tier || '') + (CTYPE[c.ctype] ? '·' + CTYPE[c.ctype] : '');
        var goods = (c.goods || []).map(function (g) { return escapeHtml(g.name); }).join('、');
        var lm = (c.landmarks || []).map(function (g) { return escapeHtml(g.name); }).join('、');
        h += '<div class="cx-card" onclick="window.__cxToggle(this)">' +
          '<div class="cx-card-h"><b>' + escapeHtml(c.name) + '</b><span class="cx-sub">' + escapeHtml(c.comm || c.state || '') + '</span></div>' +
          '<div class="cx-meta"><span><span class="cx-dot" style="background:' + facColor + '"></span>' + escapeHtml(facName) + '</span><span>' + escapeHtml(tier) + '</span></div>' +
          '<div class="cx-detail"><div class="cx-bio">' + escapeHtml(c.desc || '') + '</div>' +
          (goods ? '<div class="cx-line">特产：' + goods + '</div>' : '') +
          (lm ? '<div class="cx-line">地标：' + lm + '</div>' : '') +
          '<div class="cx-line">兵力：' + (c.garrison != null ? c.garrison : '—') + '　人口：' + (c.pop != null ? c.pop : '—') + '</div></div></div>';
      });
      return h + '</div>';
    }
    function codexItems() {
      var IT = G.ITEMS || {}, keys = Object.keys(IT);
      if (!keys.length) return '<p class="tip">尚无物品数据。</p>';
      var QMAP = { white: ['凡品', '#9a948a'], green: ['良品', '#3f7d5e'], blue: ['精良', '#3a6ea5'], purple: ['珍稀', '#7d4fa3'], orange: ['神兵', '#b0832f'] };
      var MOUNT = /马|鞍|骑|蹬|辔/;
      var CATS = [['all', '全部'], ['装备', '装备'], ['药剂', '药剂'], ['道具', '道具'], ['素材', '素材'], ['凭证', '凭证'], ['mount', '坐骑']];
      var h = '<div class="cx-filter">';
      CATS.forEach(function (c, i) { h += '<button class="cx-f' + (i === 0 ? ' on' : '') + '" data-cat="' + c[0] + '" onclick="window.__cxFilter(this)">' + c[1] + '</button>'; });
      h += '</div><div class="cx-grid" data-itemgrid>';
      keys.forEach(function (id) {
        var it = IT[id]; if (!it || !it.name) return;
        var cat = it.cat || '其他', q = QMAP[it.quality] || ['', '#9a948a'];
        var isM = MOUNT.test(it.name || '') || (it.slot === 'belt' && MOUNT.test(it.name || ''));
        var stats = '';
        if (it.stats) { var p = []; if (it.stats.atk) p.push('攻' + it.stats.atk); if (it.stats.def) p.push('防' + it.stats.def); if (it.stats.hp) p.push('血' + it.stats.hp); if (it.stats.spd) p.push('速' + it.stats.spd); stats = p.join(' '); }
        var extra = it.packSpace ? ' 容量+' + it.packSpace : '';
        h += '<div class="cx-card cx-item" data-cat="' + cat + '"' + (isM ? ' data-mount="1"' : '') + ' style="border-left:3px solid ' + q[1] + '" onclick="window.__cxToggle(this)">' +
          '<div class="cx-card-h"><span class="cx-ic">' + (it.icon || '·') + '</span><b>' + escapeHtml(it.name) + '</b>' +
          (it.quality ? '<span class="cx-q" style="color:' + q[1] + '">' + q[0] + '</span>' : '') + '</div>' +
          '<div class="cx-meta"><span>' + escapeHtml(cat) + '</span>' + (stats ? '<span>' + stats + '</span>' : '') + (it.price ? '<span>' + it.price + '文</span>' : '') + '</div>' +
          '<div class="cx-detail"><div class="cx-bio">' + escapeHtml(it.desc || '') + '</div>' + (extra ? '<div class="cx-line">' + extra + '</div>' : '') + '</div></div>';
      });
      return h + '</div>';
    }
    function codexMartial() {
      var MA = G.MARTIAL_ARTS || {}, LINES = MA.LINES || {};
      var moves = {};
      Object.keys(MA).forEach(function (id) {
        var m = MA[id];
        if (m && typeof m === 'object' && typeof m.type === 'string' && m.line) { (moves[m.line] = moves[m.line] || []).push(m); }
      });
      var known = {}; try { (S() && S().learnedMartial || []).forEach(function (id) { known[id] = 1; }); } catch (e) {}
      var lineOrder = Object.keys(LINES).sort(function (a, b) { return (LINES[a].order || 0) - (LINES[b].order || 0); });
      var h = '<div class="cx-sec-t">武 学 艺 线</div><div class="cx-grid">';
      lineOrder.forEach(function (lk) {
        var ln = LINES[lk]; if (!ln) return;
        var ml = (moves[lk] || []).map(function (m) { return '<span class="cx-chip' + (known[m.id] ? ' on' : '') + '">' + escapeHtml(m.name) + '</span>'; }).join('');
        h += '<div class="cx-card"><div class="cx-card-h"><b>' + escapeHtml(ln.name) + '</b><span class="cx-sub">' + escapeHtml(ln.kind || '') + '</span></div>' +
          '<div class="cx-bio">' + escapeHtml(ln.desc || '') + '</div><div class="cx-chips">' + ml + '</div></div>';
      });
      h += '</div>';
      var LINEAGES = G.LINEAGES || {}, lk2 = Object.keys(LINEAGES);
      if (lk2.length) {
        h += '<div class="cx-sec-t">武 学 流 派</div><div class="cx-grid">';
        lk2.forEach(function (id) {
          var s = LINEAGES[id]; if (!s) return;
          var lnName = LINES[s.line] ? LINES[s.line].name : s.line;
          h += '<div class="cx-card"><div class="cx-card-h"><b>' + escapeHtml(s.name) + '</b><span class="cx-sub">' + escapeHtml(lnName) + '·' + escapeHtml(s.elem || '') + '</span></div>' +
            '<div class="cx-bio">' + escapeHtml(s.origin || '') + '</div></div>';
        });
        h += '</div>';
      }
      return h;
    }
    function codexRecipes() {
      var R = G.RECIPES || {}, benches = Object.keys(R);
      if (!benches.length) return '<p class="tip">尚无配方数据。</p>';
      var BNAME = { bench: '木工台', alchemy: '炼炉', forge: '铁匠炉', kitchen: '庖厨', clinic: '医馆', tailor: '裁缝', weave: '织机' };
      function iname(did) { var it = G.ITEMS && G.ITEMS[did]; return it ? it.name : did; }
      var h = '';
      benches.forEach(function (b) {
        var list = R[b] || []; if (!list.length) return;
        h += '<div class="cx-sec-t">' + escapeHtml(BNAME[b] || b) + '</div><div class="cx-grid">';
        list.forEach(function (r) {
          var ins = (r.in || []).map(function (x) { return escapeHtml(iname(x.id)) + '×' + (x.n || 1); }).join('、');
          var out = escapeHtml(iname(r.out)) + (r.outN > 1 ? ('×' + r.outN) : '');
          h += '<div class="cx-card"><div class="cx-card-h"><span class="cx-ic">' + (r.icon || '🔨') + '</span><b>' + escapeHtml(r.name) + '</b>' +
            (r.cat ? '<span class="cx-sub">' + escapeHtml(r.cat) + '</span>' : '') + '</div>' +
            '<div class="cx-line">产出：' + out + '</div>' + (ins ? '<div class="cx-line">材料：' + ins + '</div>' : '') +
            (r.note ? '<div class="cx-bio">' + escapeHtml(r.note) + '</div>' : '') + '</div>';
        });
        h += '</div>';
      });
      return h;
    }
    function codexFactions() {
      var F = G.FACTIONS || {}, keys = Object.keys(F);
      if (!keys.length) return '<p class="tip">尚无势力数据。</p>';
      var h = '<div class="cx-grid">';
      keys.forEach(function (id) {
        var f = F[id]; if (!f) return;
        h += '<div class="cx-card"><div class="cx-card-h"><span class="cx-dot" style="background:' + (f.color || '#888') + '"></span><b>' + escapeHtml(f.name) + '</b>' +
          (f.lord ? '<span class="cx-sub">' + escapeHtml(f.lord) + '</span>' : '') + '</div><div class="cx-bio">' + escapeHtml(f.desc || '') + '</div></div>';
      });
      return h + '</div>';
    }
    function codexBuildings() {
      var B = G.BUILDING_ARCH || {}, keys = Object.keys(B);
      var h = '<div class="cx-sec-t">营 建 建 筑</div><div class="cx-grid">';
      if (keys.length) {
        keys.forEach(function (id) {
          var b = B[id]; if (!b) return;
          h += '<div class="cx-card"><div class="cx-card-h"><b>' + escapeHtml(b.name) + '</b>' + (b.tier ? '<span class="cx-sub">T' + b.tier + '</span>' : '') + '</div>' +
            (b.tags && b.tags.length ? '<div class="cx-meta"><span>' + b.tags.join('·') + '</span></div>' : '') + '</div>';
        });
      } else { h += '<p class="tip">暂无建筑数据。</p>'; }
      h += '</div>';
      var OFF = (G.OFFICE_SUBROOMS || []).concat(G.OFFICE_DYN ? Object.keys(G.OFFICE_DYN).map(function (k) { return G.OFFICE_DYN[k]; }) : []);
      if (OFF.length) {
        h += '<div class="cx-sec-t">官 署 坊</div><div class="cx-grid">';
        OFF.forEach(function (o) {
          if (!o) return;
          h += '<div class="cx-card"><div class="cx-card-h"><b>' + escapeHtml(o.name || '') + '</b></div>' + (o.note ? '<div class="cx-bio">' + escapeHtml(o.note) + '</div>' : '') + '</div>';
        });
        h += '</div>';
      }
      return h;
    }
    function codexEvents() {
      var E = G.EVENTS || []; if (!E.length) return '<p class="tip">尚无奇遇数据。</p>';
      var h = '<div class="cx-grid">';
      E.forEach(function (ev) {
        var ch = (ev.choices || []).map(function (c) { return escapeHtml(c.text); }).join(' / ');
        h += '<div class="cx-card" onclick="window.__cxToggle(this)"><div class="cx-card-h"><b>' + escapeHtml(ev.title || '') + '</b>' +
          (ev.choices ? '<span class="cx-sub">' + ev.choices.length + ' 选</span>' : '') + '</div>' +
          '<div class="cx-bio">' + escapeHtml(ev.text || '') + '</div><div class="cx-detail"><div class="cx-line">抉择：' + ch + '</div></div></div>';
      });
      return h + '</div>';
    }
    function codexEnemies() {
      var EN = G.ENEMIES || {}, keys = Object.keys(EN);
      if (!keys.length) return '<p class="tip">尚无兵种数据。</p>';
      var h = '<div class="cx-grid">';
      keys.forEach(function (id) {
        var e = EN[id]; if (!e || !e.name) return;
        var sk = (e.skills || []).map(function (s) { return escapeHtml(s.name); }).join('、');
        h += '<div class="cx-card" onclick="window.__cxToggle(this)"><div class="cx-card-h"><b>' + escapeHtml(e.name) + '</b>' +
          (e.title ? '<span class="cx-sub">' + escapeHtml(e.title) + '</span>' : '') + '</div>' +
          '<div class="cx-meta"><span>' + escapeHtml(e.element || '') + '</span><span>HP ' + escapeHtml(e.hp) + '</span><span>攻' + escapeHtml(e.atk) + '</span><span>防' + escapeHtml(e.def) + '</span><span>速' + escapeHtml(e.spd) + '</span></div>' +
          '<div class="cx-detail">' + (sk ? '<div class="cx-line">技能：' + sk + '</div>' : '') + (e.ai ? '<div class="cx-line">性情：' + escapeHtml(e.ai) + '</div>' : '') + '</div></div>';
      });
      return h + '</div>';
    }
    window.__cxTab = function (k) {
      var card = document.getElementById('modal-card'); if (!card) return;
      card.querySelectorAll('.cx-tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cx') === k); });
      card.querySelectorAll('.cx-pg').forEach(function (p) {
        var pg = p.getAttribute('data-pg');
        if (pg !== k) { p.classList.add('hidden'); return; }
        p.classList.remove('hidden');
        if (!p.getAttribute('data-done')) { p.innerHTML = cxRender(k); p.setAttribute('data-done', '1'); }
      });
    };
    window.__cxToggle = function (el) {
      var d = el.querySelector('.cx-detail'); if (d) d.classList.toggle('open');
      el.classList.toggle('open');
    };
    window.__cxFilter = function (btn) {
      var pg = btn.closest('.cx-pg'); if (!pg) return;
      var grid = pg.querySelector('[data-itemgrid]'); if (!grid) return;
      var cat = btn.getAttribute('data-cat');
      btn.parentNode.querySelectorAll('.cx-f').forEach(function (b) { b.classList.toggle('on', b === btn); });
      grid.querySelectorAll('.cx-item').forEach(function (c) {
        var show = cat === 'all' || (cat === 'mount' ? c.getAttribute('data-mount') === '1' : c.getAttribute('data-cat') === cat);
        c.style.display = show ? '' : 'none';
      });
    };

    // 设置：标签页（画面 / 声音 / 游戏）；fromTitle 时不含调试台
    function renderSettings(opts){
      opts=opts||{};
      var fromTitle=!!opts.fromTitle;
      var ts=SET().textSpeed;
      var gfx=
        '<div class="set-row col"><span>文字演出（越大越慢）</span>'+
          '<input type="range" class="lf-range" id="rng-speed" min="0" max="100" step="5" value="'+ts+'">'+
          '<span class="spd-val" id="spd-val">'+lfSpeedLabel(ts)+'</span></div>'+
        '<div class="set-row"><span>标题特效</span><div class="seg" id="seg-fx">'+
          '<button data-v="1" class="'+(SET().titleFx!==false?'on':'')+'">开</button>'+
          '<button data-v="0" class="'+(SET().titleFx===false?'on':'')+'">关</button></div></div>'+
        '<p class="tip">水墨烟尘与墨晕动画；喧嚣可关，长夜更静。</p>';
      var snd=
        '<div class="set-row"><span>声音（总开关）</span><div class="seg" id="seg-snd">'+
          '<button data-v="1" class="'+(SET().sound?'on':'')+'">开</button>'+
          '<button data-v="0" class="'+(!SET().sound?'on':'')+'">关</button></div></div>'+
        '<div class="set-row col"><span>背景音乐</span>'+
          '<input type="range" class="lf-range" id="rng-bgm" min="0" max="100" step="5" value="'+Math.round((SET().bgmVol!=null?SET().bgmVol:35))+'">'+
          '<span class="spd-val" id="bgm-val">'+Math.round((SET().bgmVol!=null?SET().bgmVol:35))+'%</span></div>'+
        '<div class="set-row col"><span>音效音量</span>'+
          '<input type="range" class="lf-range" id="rng-sfx" min="0" max="100" step="5" value="'+Math.round((SET().sfxVol!=null?SET().sfxVol:60))+'">'+
          '<span class="spd-val" id="sfx-val">'+Math.round((SET().sfxVol!=null?SET().sfxVol:60))+'%</span></div>'+
        '<div class="set-row col"><span>曲目选择</span><div class="seg" id="seg-bgm-track" style="flex-wrap:wrap;">'+
          (function(){
            try {
              var tracks = SFX.getBgmTracks();
              var cur = SFX.getCurrentBgmIdx();
              return tracks.map(function(t){ return '<button data-idx="'+t.idx+'" class="'+(t.idx===cur?'on':'')+'" style="margin:2px;font-size:11px;padding:4px 8px;">'+t.name+'</button>'; }).join('');
            } catch(e) { return ''; }
          })()+
        '</div></div>'+
        '<p class="tip">四首古风BGM可选，箫笛古琴各有意境；主曲曲间稍歇自动续奏。背景音乐滑块调至0即静音。</p>';
      var game='';
      if(!fromTitle){
        game+='<button class="close" id="m-save" style="margin-top:14px;">立即存档</button>';
      }
      game+='<button class="close" id="m-clear" style="background:rgba(120,60,50,.12);color:#8a3b2e;margin-top:10px;">清除全部存档</button>';
      game+='<button class="close" onclick="openModal(&quot;codex&quot;)" style="background:rgba(47,106,165,.16);color:#5a8fc8;margin-top:10px;">📖 览物志</button>';
      if(!fromTitle){
        game+='<button class="close" id="m-dev" style="background:rgba(176,131,47,.16);color:#8a6a2e;margin-top:10px;">🛠 调试台</button>';
      }
      game+='<p class="tip">设定已存，演武时遵循。</p>'+
        '<p class="tip">当前版本 v'+LF.CONSTANTS.VERSION+'</p>';
      return '<h3>设 置</h3>'+
        '<div class="set-tabs">'+
          '<button data-tab="gfx" class="on">画面</button>'+
          '<button data-tab="snd">声音</button>'+
          '<button data-tab="game">游戏</button>'+
        '</div>'+
        '<div class="set-panel" data-panel="gfx">'+gfx+'</div>'+
        '<div class="set-panel hidden" data-panel="snd">'+snd+'</div>'+
        '<div class="set-panel hidden" data-panel="game">'+game+'</div>';
    }

    // 开发人员名单：群英同撰
    function renderCredit(){
      return '<h3>群 英 同 撰</h3>'+
        '<p class="tip">此作由一人独力编撰，赖 AI 襄助而成。勒名于左，以志其事。</p>'+
        row('总 撰','一只大鸽子')+
        row('执 笔','一只大鸽子')+
        row('程 式','CodeBuddy')+
        row('绘 事','豆包')+
        row('校 勘','一只大鸽子')+
        row('音 律','一只大鸽子')+
        row('协 力','豆包（AI 协作）')+
        '<p class="tip">一人一灯，江湖路远。若遇同好，可续刻其名。</p>';
    }

    function topObjectiveText(){
      if(!LF.OBJECTIVES) return '志向';
      for(var i=0;i<LF.OBJECTIVES.length;i++){ if(!LF.OBJECTIVES[i].check(S())) return LF.OBJECTIVES[i].title; }
      return '诸事已了';
    }

    function renderLogPanel(){
      var r=(S() && S().logRing)||[];
      var h='<h3>回 顾</h3>'+
        '<p class="tip log-tip">你听过、读过的近 '+HMAX()+' 句都记在这里（旧句在上）。'+
        '对话帘里的台词、营中的号令、野外的见闻，收帘之后仍可回来翻看。</p>';
      if(!r.length) return h+'<p class="tip q-empty">尚无可回顾之事。</p>';
      h+='<div class="log-pane">';
      var lastLoc='', lastStamp='';
      r.forEach(function(e){
        if(e.r && e.r!==lastLoc){ lastLoc=e.r; lastStamp=''; h+='<div class="log-loc">◆ '+escapeHtml(e.r)+'</div>'; }
        var stamp=(e.s&&e.s!==lastStamp)?('<span class="log-t">'+escapeHtml(e.s)+'</span>'):'';
        lastStamp=e.s||lastStamp;
        h+='<div class="log-line'+(e.c?(' c-'+e.c):'')+'">'+stamp+
           (e.n?('<b>'+escapeHtml(e.n)+'：</b>'):'')+escapeHtml(e.t)+'</div>';
      });
      h+='</div><button class="close" id="m-leave">收 起</button>';
      return h;
    }

    // 升级小弹窗：替代「直接弹出角色面板」，给玩家「去加点 / 忽略」的选择
    function renderLevelup(){
      var lvl=S().level;
      var pts=S().freePoints||0;
      // v20260916c：本轮实际新增点数（addXp 记录）；旧版文案把「已有自由点」全算成「获得」，误导玩家
      var gained=S().levelupGained||0;
      S().levelupGained=0;   // 读取即清，防止下次打开残留
      var maxed=lvl>=G.CONSTANTS.MAX_LEVEL;
      var banner=maxed?'功 行 圆 满':'破 境';
      var sub=maxed? ('修为已臻圆满（LV.'+lvl+'），尚有 '+pts+' 点自由属性点待分配。')
                   : ('破境至 LV.'+lvl+'，获得 '+gained+' 点自由属性点（现有 '+pts+' 点待分配）。');
      return '<div class="levelup-pop">'+
        '<div class="lu-banner">'+banner+'</div>'+
        '<div class="lu-lv">LV.'+lvl+'</div>'+
        '<div class="lu-sub">'+sub+'</div>'+
        '<p class="tip">自由属性点可随时在角色面板分配，不必此刻决定；选「忽略」后，点状态栏或「角色」仍可回来加点。</p>'+
        '<div class="lu-btns">'+
          '<button class="btn lu-go" onclick="openModal(\'char\')">去加点</button>'+
          '<button class="btn lu-skip" onclick="closeModal()">忽略</button>'+
        '</div>'+
      '</div>';
    }

      // 城况面板（v20260825d）：参数 + 城型 + 城门 + 市集清单
      function renderCityStat(cid){
        var p=cityProfile(cid); if(!p) return '<h3>城 况</h3><p class="empty">暂无此城数据。</p>';
        var m=genCityGrid(cid);
        var mkHtml='';
        if(m && m.markets){
          var seen={}, list=[], total=0;
          for(var k in m.markets){
            total++;
            var mk=m.markets[k];
            var _xy=k.split(',');
            // 仅统计已营建、当前可见的市集（与城内地图一致：开发度半径外/遭战火者不计入），避免面板虚报
            if(cellDisplayType(cid, +_xy[0], +_xy[1])!=='market') continue;
            if(!seen[mk.name]){ seen[mk.name]=1; list.push(mk); }
          }
          if(list.length){
            var _tip = (total>list.length) ? ('，另有 '+(total-list.length)+' 处位于未营建/焦土区，待营建或修缮后开放') : '';
            mkHtml='<div class="row"><span>市集（已营建 '+list.length+' 处'+_tip+'）</span></div><div class="city-mk">';
            list.forEach(function(mk){
              var shops=mk.shops.map(function(s){ return s.sign; }).join('、');
              mkHtml+='<div class="mk-i">🏯 <b>'+mk.name+'</b>：'+shops+'</div>';
            });
            mkHtml+='</div>';
          }
        }
        // 在建营造工单（第3步）：列出本城所有「building」状态的 BuildOrder
        var boHtml='';
        var _bo=S().flags.buildOrders;
        if(_bo){
          var boList=[];
          for(var _bid in _bo){ var _o=_bo[_bid]; if(_o && _o.cid===cid && _o.status==='building') boList.push(_o); }
          if(boList.length){
            boHtml='<div class="row"><span>营造工事（'+boList.length+' 处）</span></div><div class="city-mk">';
            boList.forEach(function(_o){
              var _bp=LF.BUILD[_o.blueprintId]||{};
              var _st=(_bp.stages||[]).length;
              boHtml+='<div class="mk-i">🚧 <b>'+(_bp.doneName||'新筑')+'</b>：阶段 '+Math.min((_o.stageIndex||0)+1,_st)+' / '+_st+'　人力 '+(_o.laborPaid||0)+'/'+(_o.laborNeeded||(_bp.labor||2))+'</div>';
            });
            boHtml+='</div>';
          }
        }
        var garrHtml = (LF.Officers ? LF.Officers.renderCityGarrison(cid) : '');
        return '<h3>城 况 · '+p.c.name+'</h3>'+

          row('行政', p.tierDesc)+
          row('城型', p.ctypeDesc)+
          row('城门', (availableGateDirs(cid)||[]).length+' 座')+
          row('城级', cityLevelName(cid)+'（'+cityGridSize(cid)+'×'+cityGridSize(cid)+' 格，建设度 '+cityDevOf(cid)+'）')+
          row('人口', p.popDesc)+
          row('治安', p.orderDesc)+
          row('商业', p.comDesc)+
          row('农业', p.agriDesc)+
          row('城防', (p.c.wall>=60?'高垒深沟': p.c.wall>=45?'城墙完固': p.c.wall>=30?'城垣可守':'防守疏懈'))+
          (mkHtml? mkHtml : '')+
          (boHtml? boHtml : '')+
          (garrHtml? garrHtml : '')+
          (function(){ var _pf=S().faction||'义军'; var _own=(typeof cityOwnerOf==='function' && cityOwnerOf(cid)===_pf); var _cap=(S().flags.factionCapital && S().flags.factionCapital[_pf]===cid); if(_own&&!_cap) return '<div class="row"><span>定都</span><button class="btn sm" onclick="window.declareCapital(\'+cid+\')">于此定都（中枢改建皇宫）</button></div>'; if(_own&&_cap) return '<div class="row"><span>都城</span><span>此城为本势力都城</span></div>'; return ''; })()+
          '<p class="tip">城型与城门数量已预留：山城/城寨/港口将随城防与商业改变城门布局（plain 为四门）。市集名取「方位·交易物·地理·吉语」可混可单，商铺招牌由字号生成。城内空地可点格「营造」筑新宅新市。</p>';
      }

    return {
      renderCodex, renderSettings, renderCredit,
      topObjectiveText, renderLogPanel, renderLevelup, renderCityStat
    };
  };
})(typeof window !== 'undefined' ? window : global);

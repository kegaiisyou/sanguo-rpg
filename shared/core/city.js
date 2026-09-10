// 乱世烽火 · 城市网格系统（v20260908h）
// 从 engine.js 抽离：数据驱动的「城市网格」模型——城门方向 / 网格生成 / 盛衰·归属·等级状态 /
// 单元格类型·描述·互动 / 房间注册（registerCityRooms）。
// 不读任何 window 裸全局——运行时依赖经 LF.createCity(ctx) 注入，与 engine.js 解耦。
// 注意：state 在引擎读档/新游戏时会被重新赋值（Core.state = state = normalize(...)），
// 因此一律经 S()=getState() 惰性取值，绝不在工厂顶层捕获旧对象。
window.LF = window.LF || {};
(function () {
  LF.Core = LF.Core || {};

  // ctx 依赖（引擎注入）：
  //   G             —— SharedGame（ROOMS，registerCityRooms 写入）
  //   getState()    —— 实时 state（惰性）
  //   LF            —— 数据：CITIES / ROADS / PLACES / CITY_OWNER / MARKETS / BUILD / TITLES
  //   BUILDINGS     —— 建筑定义（genCityGrid 招牌、cityCellActs 进店）
  //   log           —— 围城/克城叙事
  //   NPC_GEN       —— 城内格 NPC 生成器
  LF.createCity = function (ctx) {
    var G = ctx.G;
    var LF = ctx.LF;
    var getBUILDINGS = ctx.getBUILDINGS, getNPC_GEN = ctx.getNPC_GEN;
    var getState = ctx.getState, S = getState;
    var log = ctx.log;

    // ===== 城市网格系统（v20260824）：每城程序生成 N×N 房间网格，点击相邻格移动 =====
    // grid 字段见 shared/data/cities.js；genCityGrid 用基于城市 id 的种子稳定生成布局（存档持久化）
    var GRID_VER = '20260825f';   // 网格布局版本；改动布局/中心类型后自增，旧档自动重建
    // 城门数量随城型决定（plain 四门；山城/城寨/港口按城防/商业递减）。后续山城/港口/城寨将影响城门布局
    function cityGates(c) {
      var ct = c.ctype || 'plain';
      if (ct === 'fort') return Math.max(1, Math.min(3, 1 + Math.floor((c.wall || 0) / 40)));
      if (ct === 'mountain') return Math.max(1, Math.min(2, 1 + Math.floor((c.wall || 0) / 55)));
      if (ct === 'port') return Math.max(2, Math.min(3, 2 + Math.floor((c.commerce || 0) / 50)));
      if (ct === 'shuizhai') return Math.max(1, Math.min(3, 1 + Math.floor((c.wall || 0) / 45)));  // 水寨：水上营垒，依水寨墙高开 1~3 门
      return 4;
    }
    // —— 城门方向·路网自适应（v20260905k）——
    // 旧版固定取「默认方位序的前 nG 个」开门：山城/寨城单门往往开在无路的一侧，
    // 门格虽在、郊野却无人可通 → 晋阳/武威/上庸「有入无出」、交趾「有出无入」等孤城软锁。
    // 现改为：在四方位里枚举 nG 个开门的组合，选择「郊野远边能真连到的路网邻居」
    // （网格城权重 2、其它地点 1）总数最多的方向集；得分相同则维持城型默认序
    // （即原本已最优的城零变化）。与 genCityGrid 门洞格 / availableGateDirs 同源。
    var CITY_GATE_ORDER = { plain: ['北', '东', '南', '西'], mountain: ['北', '西', '南', '东'],
      fort: ['北', '南', '西', '东'], port: ['北', '东', '南', '西'],
      shuizhai: ['北', '东', '南', '西'] };
    var CITY_GATE_DIRS_CACHE = {};
    function cityGateDirs(cid) {
      if (CITY_GATE_DIRS_CACHE[cid]) return CITY_GATE_DIRS_CACHE[cid];
      var c = (LF.CITIES || {})[cid];
      // v20260907i：城市配置 gateDirs 强制开门方向（如苦役营仅开南门）；其余城市仍走路网自适应
      if (c && c.gateDirs && c.gateDirs.length) { var _gd = c.gateDirs.slice(); CITY_GATE_DIRS_CACHE[cid] = _gd; return _gd; }
      var ord = CITY_GATE_ORDER[(c && c.ctype) || 'plain'] || ['北', '东', '南', '西'];
      var out = ord.slice(0, 4);
      if (c && c.grid) {
        var nG = cityGates(c);
        var DIRV = { '北': [0, -1], '南': [0, 1], '东': [1, 0], '西': [-1, 0] };
        var nbs = (((LF.ROADS || {}).adj || {})[cid] || []).map(function (e) {
          var np = (LF.PLACES || {})[e.to];
          if (!np || !np.pos || np.pos.length !== 2) return null;
          var la = (c.pos[1] || 0) * Math.PI / 180;
          return { v: [(np.pos[0] - c.pos[0]) * Math.cos(la), -(np.pos[1] - c.pos[1])],
            city: !!((LF.CITIES[e.to] || {}).grid) };
        }).filter(Boolean);
        if (nbs.length) {
          function angFrom(d, v) {
            var dv = DIRV[d], va = Math.atan2(v[1], v[0]), da = Math.atan2(dv[1], dv[0]);
            var a = Math.abs(va - da); if (a > Math.PI) a = 2 * Math.PI - a; return a;
          }
          // 复刻 travel.js 的分组语义：先归最近「朝外」门，无朝外门才归最近门（后归不产生出野口）
          function pick(gdirs, v) {
            var facing = [], all = [];
            gdirs.forEach(function (d) { var dv = DIRV[d]; if (v[0] * dv[0] + v[1] * dv[1] > 0) facing.push(d); all.push(d); });
            var pool = facing.length ? facing : all, best = pool[0], ba = 1e9;
            pool.forEach(function (d) { var a = angFrom(d, v); if (a < ba) { ba = a; best = d; } });
            return { d: best, face: !!facing.length };
          }
          function score(set) {
            var by = {}; set.forEach(function (d) { by[d] = []; });
            nbs.forEach(function (nb) { by[pick(set, nb.v).d].push(nb); });
            var s = 0;
            set.forEach(function (d) {
              by[d].forEach(function (nb) { if (pick(set, nb.v).face) s += nb.city ? 2 : 1; });
            });
            return s;
          }
          function affinity(set) {
            var a = 0; set.forEach(function (d) { a += 4 - ord.indexOf(d); }); return a;
          }
          // v20260907c：剔除「无正向邻点」的虚门，避免开出「有门无路」的城门（罗盘出不去）。
          // 仅从「确有正向邻点」的可用方向中枚举开门组合（数量取 min(城型门数, 可用方向数)）。
          var usable = ord.filter(function (d) {
            return nbs.some(function (nb) { return pick([d], nb.v).face; });
          });
          if (!usable.length) usable = ord.slice(0, 4);   // 极端：无邻点（不应发生），退回默认四门
          var k = Math.min(nG, usable.length);
          var bestSet = null, bestSc = -1, bestAf = -1;
          for (var mask = 0; mask < (1 << usable.length); mask++) {
            var bits = 0; for (var b = 0; b < usable.length; b++) if (mask & (1 << b)) bits++;
            if (bits !== k) continue;
            var set = [];
            for (var i = 0; i < usable.length; i++) if (mask & (1 << i)) set.push(usable[i]);
            var sc = score(set), af = affinity(set);
            if (sc > bestSc || (sc === bestSc && af > bestAf)) { bestSc = sc; bestAf = af; bestSet = set; }
          }
          out = bestSet || usable.slice(0, k);
        }
      }
      CITY_GATE_DIRS_CACHE[cid] = out;
      return out;
    }
    var CELL_META = {
      palace: { i: '🏯', nm: '皇宫' }, gov: { i: '🏛', nm: '衙署' },
      plaza: { i: '🏛', nm: '城中广场' }, gate: { i: '🚪', nm: '城门' },
      market: { i: '🛒', nm: '市集' }, home: { i: '🏠', nm: '民宅' }, barracks: { i: '⚔', nm: '军营' },
      farm: { i: '🌾', nm: '农庄' }, prison: { i: '⛓', nm: '牢房' }, mine: { i: '⛏', nm: '矿坑' }, kitchen: { i: '🍚', nm: '伙房' }, command: { i: '🚩', nm: '中军帐' }, warehouse: { i: '📦', nm: '仓库' }, drill: { i: '🥋', nm: '演武场' }, sentry: { i: '🏮', nm: '岗哨' }, empty: { i: '🟫', nm: '空地' }, ruin: { i: '🔥', nm: '焦土' },
      site: { i: '🚧', nm: '工地' }
    };
    // ── 苦役营教程·具名名册覆盖（v20260909p）──
    // 生成城内部按网格坐标注入具名 NPC / 场景动作，使新手教程可在真实城市里展开。
    var TUTORIAL_CITY_NPCS = {
      kuyilao: {
        '1,1': ['laotou', 'qin_jiuxiao'],                 // 中军场院（劳役场）
        '1,0': [],                                         // 囚室（默叔已迁入牢区·天字二号）
        '2,1': ['chen_jian', 'wu_suan', 'zheng_gang'],     // 仓库（仓吏由 warehouse() 自动生成）
        '2,0': ['shi_si', 'gou_san'],                      // 矿坑
        '0,1': ['lin_niang'],                              // 伙房
        '0,0': ['sun_lao'],                                // 农田
        '1,2': ['zhao_hu', 'qian_biao', 'sun_meng', 'fu_sheng'], // 岗哨/南门
        '2,2': ['han_tie', 'su_niang']                     // 演武场
      }
    };
    var TUTORIAL_CITY_ACTS = {
      kuyilao: {
        '1,1': [{ id: 'labor_yard', label: '担石劳作', tip: '按狱卒吩咐扛石运土——熟悉劳作，点亮状态栏。' },
                { id: 'survey_yard', label: '环顾四周', tip: '勘察劳役场，看清几处去路。' }],
        // 囚室格 (1,0) 不挂场景动作——六间子牢房走面板 doors（CELL_INTERIORS），罗盘走网格邻居
        '2,1': [{ id: 'survey_warehouse', label: '翻找仓库', tip: '墙角倚着闲镐锄，竹木随手可取。' }],
        '1,2': [{ id: 'wall_choose', label: '决断出营·墙根', tip: '于塌墙根（南门）盘算出营法子。' }],
        '2,2': [{ id: 'train_dummy', label: '戳木人桩', tip: '演武场木人桩练拳脚，战力达标可强突。' }]
      }
    };
    var CELL_DESC = {
      palace: '宫阙巍峨，金瓦耀日，甲士环侍，天子所居之地，气象森严。',
      gov: '衙署高敞，匾额肃然，郡守（县令）于此听讼断案、发号施令。',
      plaza: '城中广场四达，旌旗在望，商旅往来如织。',
      gate: '城门巍峨，匾额森然，出城可重返山河。',
      market: '市列珠玑，铺肆连绵——药铺、布庄、食肆、杂货各据一隅。',
      home: '寻常民宅，檐下晾着布衣，孩童探头张望。',
      barracks: '军营肃整，旌甲林立，校尉按剑而立。',
      farm: '阡陌纵横，农人扶犁，仓廪所系，民食之源。',
      prison: '牢房阴森，铁栏纵横，镣铐叮当，囚徒或坐或卧。',
      mine: '矿坑幽深，镐痕遍布，碎石堆旁搁着铁镐木筐。',
      kitchen: '伙房烟火气浓，大锅沸汤，案板上堆着粗粮野菜。',
      command: '中军帐高悬旌旗，案上摊着舆图军报，主将居中而坐。',
      warehouse: '仓库厚门粗锁，粮袋木料堆垛齐整，仓吏执册清点。',
      drill: '演武场平整开阔，木桩兵器林立，兵卒汗流浃背操练不休。',
      sentry: '营门岗哨，哨兵按刀而立，日夜查验进出之人。',
      empty: '一片空地，瓦砾草莽，尚待营建。',
      ruin: '焦土未冷，断壁残垣，劫后萧索。',
      unbuilt: '城郭未及营建，草莽瓦砾，尚无居人。',
      site: '建材成堆、工匠往来，工事未完，暂不可入。'
    };
    // ══ 城市盛衰 / 归属系统（v20260824d）══
    // 建设度(dev)决定建成半径：随盛衰扩建/降级；焦土(ruin)由战火标记；归属(owner)易主则中枢变帅府/行辕
    var pendingSiegeCid = null;
    var buildingState = null;   // 建筑内部交互状态：{building, cid, x, y, ent}
    function ensureCityState(cid) {
      var c = (LF.CITIES || {})[cid] || {};
      var F = S().flags;
      if (!F.cityDev) F.cityDev = {};
      if (F.cityDev[cid] == null) F.cityDev[cid] = Math.min(100, 35 + Math.round((c.pop || 50) * 0.6));
      if (!F.cityOwner) F.cityOwner = {};
      if (F.cityOwner[cid] == null) F.cityOwner[cid] = cityDefaultOwner(cid);
      if (!F.cityBurned) F.cityBurned = {};
      if (!F.cityBurned[cid]) F.cityBurned[cid] = {};
      if (!F.cityBroken) F.cityBroken = {};
      if (!F.cityBroken[cid]) F.cityBroken[cid] = {};
      if (!F.cityLevel) F.cityLevel = {};
      if (F.cityLevel[cid] == null) {
        var _t = (LF.CITIES || {})[cid] || {};
        F.cityLevel[cid] = (_t.tier === 'capital') ? 7 : (_t.tier === 'zhou') ? 4 : (_t.tier === 'xian') ? 3 : (_t.grid >= 9 ? 7 : _t.grid >= 7 ? 4 : _t.grid >= 5 ? 3 : _t.grid >= 3 ? 1 : 0);
      } else if (F.cityLevel[cid] === 0) { var _g2 = (LF.CITIES || {})[cid] || {}; if (_g2.grid >= 3 && _g2.grid < 5 && _g2.tier !== 'xian' && _g2.tier !== 'zhou' && _g2.tier !== 'capital') { F.cityLevel[cid] = 1; } }
      // 城市营造覆盖层（第3步）：cityCells[cid]["x,y"]=CellInst{type,level,shops,owner,built,buildOrderId}
      if (!F.cityCells) F.cityCells = {};
      if (!F.cityCells[cid]) F.cityCells[cid] = {};
      // 统一工单：宏观（requester:npcId，tick 按天推进）与微观（requester:'player'，现场 exert 推进）共用
      if (!F.buildOrders) F.buildOrders = {};
      if (!F.buildOrderSeq) F.buildOrderSeq = 0;
    }
    // ══ 城市等级动态系统（v20260826c）══
    // 等级 0..7 平滑对应 grid 2..9（每次升级仅 +1 圈）：村/镇/乡/县城/郡城/府城/州城/都城
    var CITY_LV_SIZE = [2, 3, 4, 5, 6, 7, 8, 9];
    var CITY_LV_NAME = ['村', '镇', '乡', '县城', '郡城', '府城', '州城', '都城'];
    function cityTierLv(cid) {
      var F = S().flags;
      var cl = F.cityLevel && F.cityLevel[cid];
      if (cl != null) return cl;
      var c = (LF.CITIES || {})[cid] || {};
      if (c.tier === 'capital') return 7;
      if (c.tier === 'zhou') return 4;
      if (c.tier === 'xian') return 3;
      var g = c.grid || 5;
      return (g >= 9 ? 7 : g >= 7 ? 4 : g >= 5 ? 3 : g >= 3 ? 1 : 0);
    }
    function cityGridSize(cid) { return CITY_LV_SIZE[cityTierLv(cid)] || 3; }
    function cityLevelName(cid) { return CITY_LV_NAME[cityTierLv(cid)] || '城'; }
    function cityDevOf(cid) { ensureCityState(cid); return S().flags.cityDev[cid]; }
    function cityOwnerOf(cid) { ensureCityState(cid); return S().flags.cityOwner[cid]; }
    function cityDefaultOwner(cid) {
      var c = (LF.CITIES || {})[cid] || {};
      return ((LF.CITY_OWNER || {})[cid]) || c.owner || '汉';
    }
    function isCaptured(cid) { return cityOwnerOf(cid) !== cityDefaultOwner(cid); }
    function cityBurnedMap(cid) { ensureCityState(cid); return S().flags.cityBurned[cid]; }
    // 势力显示名（与 engine 侧 factionName 语义一致；此处仅供 cityLine/城内叙事使用，不依赖引擎函数）
    function factionLabel(id) {
      if (id === '义军' || id === 'player') return ((LF.FACTIONS || {}).player || {}).name || '义军';
      if (id === '汉' || id === 'han') return ((LF.FACTIONS || {}).han || {}).name || '汉室';
      var f = (LF.FACTIONS || {})[id]; return f ? (f.name || id) : id;
    }
    // ══ 群雄逐鹿 · 易帜核心（v20260909o）══
    // 势力归属唯一写入口：玩家攻城(siegeWin)、NPC 互伐、事件攻伐统一走这里。
    // 负责：写 flags.cityOwner + 玩家治下账目（ruledCities 增删）。
    function conquerCity(cid, owner, devDelta) {
      ensureCityState(cid);
      var F = S().flags, old = F.cityOwner[cid];
      if (old === owner) return { changed: false, old: old, owner: owner };
      F.cityOwner[cid] = owner;
      if (!S().ruledCities) S().ruledCities = [];
      var pf = playerFaction();
      var wasP = (old === pf), isP = (owner === pf);
      if (isP) { if (S().ruledCities.indexOf(cid) < 0) S().ruledCities.push(cid); }
      else if (wasP) { var ix = S().ruledCities.indexOf(cid); if (ix >= 0) S().ruledCities.splice(ix, 1); }
      if (devDelta) setCityDev(cid, Math.max(0, Math.min(100, cityDevOf(cid) + devDelta)));
      return { changed: true, old: old, owner: owner };
    }
    // 天下大势 · 大事记：存档 flags.chronicle（持久随档），新条目在前，至多保留 80 条
    function chronicle(text, kind) {
      var st = S(); st.flags = st.flags || {};
      var arr = st.flags.chronicle || (st.flags.chronicle = []);
      arr.unshift({ d: st.day || 0, t: String(text || ''), k: kind || 'war' });
      if (arr.length > 80) arr.length = 80;
    }
    function chronicleList() { var f = S().flags; return (f && f.chronicle) || []; }
    // 注：道路等级 / 断路修缮系统已于 v20260827 移除；城市格只保留真实地点（市集/军营/官署…），道路作为可通行空地。
    function burnedGates(cid) {
      var m = genCityGrid(cid); if (!m) return 0;
      var size = m.size, cx = Math.floor(size / 2), cy = Math.floor(size / 2), bm = cityBurnedMap(cid), n = 0;
      [[cx, 0], [0, cy], [size - 1, cy], [cx, size - 1]].forEach(function (p) { if (bm[p[0] + ',' + p[1]]) n++; });
      return n;
    }
    // 每座被焚城门使守军战力减 8%（最多三成）——城门不免疫火烧，焚毁自有其代价
    function siegeGuardMul(cid) { var n = burnedGates(cid); return n ? Math.max(0.7, 1 - 0.08 * n) : 1; }
    function setCityDev(cid, v) { if (!S().flags.cityDev) S().flags.cityDev = {}; S().flags.cityDev[cid] = Math.max(0, Math.min(100, v)); }
    function playerFaction() { return S().faction || '义军'; }
    function centerTypeOf(cid) { var m = genCityGrid(cid); if (!m) return 'gov'; var c = Math.floor(m.size / 2); return m.cells[c][c]; }
    function devRadius(dev, size) {
      var R = Math.floor(size / 2);
      if (dev >= 85) return R;
      if (dev >= 65) return Math.max(1, Math.round(R * 0.8));
      if (dev >= 45) return Math.max(1, Math.round(R * 0.6));
      if (dev >= 25) return Math.max(1, Math.round(R * 0.4));
      return 1;
    }
    function baseDisplayType(cid, x, y) {
      var m = genCityGrid(cid); if (!m) return 'empty';
      var size = m.size, cx = Math.floor(size / 2), cy = Math.floor(size / 2);
      if (x === cx && y === cy) return m.cells[y][x];
      if (x === cx || y === cy) {            // 中轴大街（含城门）恒为可通行：保证出城必经城门、且城门始终可达
        var t = m.cells[y][x];
        if (t === 'unbuilt') t = 'empty';
        return t;
      }
      var R = devRadius(cityDevOf(cid), size);
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) > R) return 'unbuilt';
      return m.cells[y][x];
    }
    // ══ 城市营造覆盖层（第3步：BuildOrder + cityCells 四层叠加）══
    // cityCells[cid]["x,y"]=CellInst{type,level,shops,owner,built,buildOrderId}
    // 四层叠加：掘断(broken) > 覆盖层(override：已建→type / 施工中→site) > 焦土(ruin) > 底层(baseDisplayType)
    function cityCellInst(cid, x, y) {
      ensureCityState(cid);
      return (S().flags.cityCells[cid] || {})[x + ',' + y] || null;
    }
    function setCityCell(cid, x, y, inst) {
      ensureCityState(cid);
      var k = x + ',' + y;
      if (inst) S().flags.cityCells[cid][k] = inst; else delete S().flags.cityCells[cid][k];
    }
    function nextBuildOrderId() {
      S().flags.buildOrderSeq = (S().flags.buildOrderSeq || 0) + 1;
      return 'bo' + S().flags.buildOrderSeq;
    }
    function buildOrderById(id) { return (S().flags.buildOrders || {})[id] || null; }
    function activeBuildOrder(cid, x, y) {
      var inst = cityCellInst(cid, x, y);
      if (!inst || !inst.buildOrderId) return null;
      return buildOrderById(inst.buildOrderId);
    }
    function cellDisplayType(cid, x, y) {
      var inst = cityCellInst(cid, x, y);
      if (inst) return inst.built ? inst.type : 'site';        // 覆盖层：已建显示建筑、施工中显示工地
      var t = baseDisplayType(cid, x, y);
      if (t === 'unbuilt') return t;
      if (t === 'gate') return t;                                // 城门另有守军减益
      if (cityBurnedMap(cid)[x + ',' + y]) return 'ruin';
      return t;
    }
    function canEnterCell(cid, x, y) { var t = cellDisplayType(cid, x, y); return t !== 'ruin' && t !== 'unbuilt' && t !== 'site'; }
    function burnCells(cid, n) {
      var m = genCityGrid(cid); if (!m) return;
      var size = m.size, cx = Math.floor(size / 2), cy = Math.floor(size / 2);
      var bm = cityBurnedMap(cid);
      var cp = S().flags.cityPos || {};
      var cand = [];
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        if (x === cx && y === cy) continue;
        if (cp.cid === cid && cp.x === x && cp.y === y) continue;
        var t = baseDisplayType(cid, x, y);
        if (t === 'unbuilt') continue;
        if (bm[x + ',' + y]) continue;
        cand.push(x + ',' + y);
      }
      for (var i = cand.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = cand[i]; cand[i] = cand[j]; cand[j] = tmp; }
      for (var k = 0; k < n && k < cand.length; k++) bm[cand[k]] = true;
    }
    function siegeWin(cid) {
      var F = S().flags; F.cityOwner = F.cityOwner || {};
      // ── v20260826g 身份系统：占城即得 tier 对应官职（取更高者）──
      var _tier = ((LF.CITIES || {})[cid] || {}).tier || 'xian';
      var _gained = _tier === 'capital' ? '君主' : _tier === 'zhou' ? '州牧' : '太守';
      if ((LF.TITLES || []).indexOf(S().title) < (LF.TITLES || []).indexOf(_gained)) S().title = _gained;
      conquerCity(cid, playerFaction(), +18);   // 易帜核心：写归属 + 治下账目 + 建设提升
      var ct = centerTypeOf(cid);
      var cnm = ((LF.CITIES || {})[cid] || {}).name || '城';
      log('〔克城〕守军溃散，「' + cnm + '」易帜——中枢改立「' + cellDisplayName(cid, ct) + '」，' + factionLabel(playerFaction()) + ' 据此城！', 'combat');
      log('战后稍歇，外郭营建更见起色，可容更多百姓居止。', 'sys');
      chronicle('你率军攻克「' + cnm + '」，' + factionLabel(playerFaction()) + ' 易帜据城。', 'good');
    }
    function siegeLose(cid) {
      setCityDev(cid, cityDevOf(cid) - 28);
      burnCells(cid, 3 + Math.floor(Math.random() * 3));
      S().hp = 1; S().defeated = true;
      var cnm = ((LF.CITIES || {})[cid] || {}).name || '城';
      log('〔败退〕攻城失利，守军反扑，「' + cnm + '」城中数处火起，化作焦土焦垣。', 'combat');
      log('你力竭倒地，须先「休整」恢复，方可再动。', 'sys');
    }
    // 行政中心按城市等级显示不同名称：都城→皇宫，州城→州衙，县城→城主府；势力易主后变帅府/行辕
    function cellDisplayName(cid, t) {
      if (t === 'unbuilt') return '未营建';
      if (t === 'site') return '工地';
      if (t === 'gov') {
        if (isCaptured(cid)) return '行辕';
        var _c = (LF.CITIES || {})[cid] || {};
        var _tier = _c.tier || (_c.grid >= 9 ? 'capital' : _c.grid >= 7 ? 'zhou' : 'xian');
        if (_tier === 'zhou') return '州衙';
        if (_tier === 'xian') return '城主府';
        return '衙署';
      }
      if (t === 'palace') {
        if (isCaptured(cid)) return '帅府';
        return CELL_META.palace.nm;
      }
      return CELL_META[t] ? CELL_META[t].nm : t;
    }
    // ═══ 城格内部：可进入子房间(doors) + 不可进入交互物(objects)（v20260910q 地图框架）═══
    // 通用规则：罗盘=大方位去别处；面板=当前地点内的 rooms/items；NPC 单列。
    var CELL_INTERIORS = {
      'kuyilao|1,0': {
        doors: [
          { label: '天字一号', icon: '🚪', target: 'camp_tz1', group: '天字牢房' },
          { label: '天字二号', icon: '🚪', target: 'camp_tz2', group: '天字牢房' },
          { label: '天字三号', icon: '🚪', target: 'camp_tz3', group: '天字牢房' },
          { label: '地字一号', icon: '🚪', target: 'camp_dz1', group: '地字牢房' },
          { label: '地字二号', icon: '🚪', target: 'camp_dz2', group: '地字牢房' },
          { label: '地字三号', icon: '🚪', target: 'camp_dz3', group: '地字牢房' }
        ],
        objects: []
      }
    };
    function cellInteriors(cid, x, y){ return CELL_INTERIORS[cid + '|' + x + ',' + y] || null; }
    var CELL_NARR = {
      'kuyilao|1,0': [
        '长巷两侧铁栅森然，风从栅缝钻过，带着潮气与远处草木腥。六间牢房分列东西——东侧天字一号至三号，西侧地字一号至三号。',
        '你顺着栅廊望去，牢门皆虚掩或紧锁，囚徒们或坐或卧，目光却都朝着那几扇通往子牢房的门。'
      ]
    };
    function cellNarr(cid, x, y){ return CELL_NARR[cid + '|' + x + ',' + y] || null; }
    function seededRand(seed) {
      var h = 2166136261; for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
      var s = h >>> 0;
      return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }
    function isCityGrid(rid) { var c = (LF.CITIES || {})[rid]; return !!(c && c.grid); }
    function genCityGrid(cid) {
      var c = (LF.CITIES || {})[cid]; if (!c || !c.grid) return null;
      var _lv = cityTierLv(cid);
      var _myVer = GRID_VER + '@' + _lv + ((c.gateDirs || []).join(',')) + ((c.layoutGrid || []).map(function (r) { return r.join(''); }).join('|'));
      var F = S().flags;
      if (F.cityGrid && F.cityGrid[cid] && F.cityGrid[cid].ver === _myVer) return F.cityGrid[cid];
      var size = cityGridSize(cid), rnd = seededRand(cid + '_grid_' + _lv);
      var cx = Math.floor(size / 2), cy = Math.floor(size / 2);
      var tier = c.tier || (c.grid >= 9 ? 'capital' : c.grid >= 7 ? 'zhou' : 'xian');
      var centerType = (tier === 'capital') ? 'palace' : 'gov';   // 都城中央为皇宫，其余为衙门/城主府
      // 城门方向为路网自适应（v20260905k，见 cityGateDirs），门洞格与 availableGateDirs 同源
      var nG = cityGates(c);
      var gateSides = cityGateDirs(cid), gateSet = {};
      gateSides.forEach(function (_d) {
        var _gx = (_d === '东') ? size - 1 : ((_d === '西') ? 0 : cx);
        var _gy = (_d === '南') ? size - 1 : ((_d === '北') ? 0 : cy);
        gateSet[_gx + ',' + _gy] = 1;
      });
      var g = [];
      for (var y = 0; y < size; y++) { var row = [];
        for (var x = 0; x < size; x++) {
          var t;
          if (c.layoutGrid) { t = (c.layoutGrid[y] && c.layoutGrid[y][x]) || 'empty'; }
          else if (x === cx && y === cy) t = centerType;
          else if (gateSet[x + ',' + y]) t = 'gate';
          else {
            if (c.layout === 'empty') { t = 'empty'; }
            else {
              var roll = rnd();
              if (roll < 0.20) t = 'market';
              else if (roll < 0.46) t = 'home';
              else if (roll < 0.58) t = 'barracks';
              else if (roll < 0.68) t = 'farm';
              else if (roll < 0.78) t = 'empty';
              else t = 'empty';
            }
            if (t === 'market' && c.commerce < 55 && rnd() < 0.5) t = 'home';
            if (t === 'barracks' && c.wall < 60 && rnd() < 0.5) t = 'empty';
          }
          row.push(t);
        }
        g.push(row);
      }
      // ── 市集生成（v20260825d）：每城多个市场，各有名称（方位/交易物/地理/祝福，可混可单）与异质商铺招牌 ──
      var markets = {};
      var MK = (typeof LF !== 'undefined' && LF.MARKETS);
      var mktPool = ['yaofu', 'buzhuang', 'shishi', 'zahuo', 'gongzao', 'jiulou', 'ranfang', 'gaodian', 'qianzhuang', 'tiejiang', 'wuguan', 'biaoju', 'chalou', 'duguang', 'maxing', 'shudian', 'xiangzhu'];
      for (var my = 0; my < size; my++) for (var mx = 0; mx < size; mx++) {
        if (g[my][mx] !== 'market') continue;
        var dx = mx - cx, dy = my - cy, dir = '中';
        if (Math.abs(dx) >= Math.abs(dy)) dir = dx > 0 ? '东' : (dx < 0 ? '西' : '中');
        else dir = dy < 0 ? '北' : (dy > 0 ? '南' : '中');
        var mrnd = seededRand(cid + '_mkt_' + mx + '_' + my);
        var nShop = Math.max(2, Math.min((tier === 'capital' ? 5 : tier === 'zhou' ? 4 : 3), 2 + Math.floor((c.commerce || 0) / 30)));
        var taken = {}, takenKey = {}, shops = [];
        for (var si = 0; si < nShop; si++) {
          var mk, _t = 0;
          do { mk = mktPool[Math.floor(mrnd() * mktPool.length)]; _t++; } while (takenKey[mk] >= 2 && _t < 24);  // 同类最多 2 家，保证市场内商铺多样
          takenKey[mk] = (takenKey[mk] || 0) + 1;
          var sg = MK ? MK.sign(mk, mrnd, taken) : ((getBUILDINGS()[mk] && getBUILDINGS()[mk].name) || mk);
          shops.push({ key: mk, sign: sg });
        }
        var nm = MK ? MK.marketName(cid, dir, shops[0].key, mrnd) : (dir + '市');
        markets[mx + ',' + my] = { name: nm, dir: dir, shops: shops };
      }
      F.cityGrid = F.cityGrid || {};
      F.cityGrid[cid] = { ver: _myVer, size: size, cells: g, markets: markets, gates: nG };
      return F.cityGrid[cid];
    }
    function cityCellDesc(cid, x, y) {
      var m = genCityGrid(cid); if (!m) return [];
      var t = cellDisplayType(cid, x, y), meta = CELL_META[t] || CELL_META.empty;
      var d = '〔城内·' + meta.nm + '〕' + (CELL_DESC[t] || '');
      if (t === 'gate') {
        if (cityBurnedMap(cid)[x + ',' + y]) d += ' 城门曾遭战火，焦痕犹在。';
      }
      if (t === 'site') {
        var _inst = cityCellInst(cid, x, y);
        var _o = _inst && _inst.buildOrderId ? buildOrderById(_inst.buildOrderId) : null;
        var _bp = _o ? LF.BUILD[_o.blueprintId] : null;
        if (_o && _bp) {
          var _stage = (_bp.stages || [])[_o.stageIndex];
          d += ' 正在营造「' + (_bp.doneName || '新筑') + '」，当前工段「' + (_stage ? _stage.name : '收尾') + '」。';
        }
      }
      return [d];
    }
    function cityCellNpcs(cid, x, y) {
      var m = genCityGrid(cid); if (!m) return [];
      var p = cityProfile(cid); if (!p) return [];
      var c = (LF.CITIES || {})[cid] || {};
      var gen = getNPC_GEN()[cellDisplayType(cid, x, y)] || getNPC_GEN().common;
      var list = gen(cid, x, y, c, c.name || '此城', m);
      // 教程/具名名册（v20260909p）：按格注入具名 NPC
      var ros = (TUTORIAL_CITY_NPCS[cid] && TUTORIAL_CITY_NPCS[cid][x + ',' + y]) || [];
      for (var ri = 0; ri < ros.length; ri++) {
        var rk = ros[ri];
        var rd = (G.DIALOGUES && G.DIALOGUES.npcs && G.DIALOGUES.npcs[rk]) || {};
        list.push({ o: { key: rk, name: rd.name || rk, icon: rd.icon || '👤', desc: rd.desc || '' }, acts: [] });
      }
      return list;
    }
    function cityCellActs(cid, x, y) {
      var m = genCityGrid(cid); if (!m) return [];
      var dt = cellDisplayType(cid, x, y), t = dt, p = cityProfile(cid), out = [];
      var bm = cityBurnedMap(cid);
      var burnt = !!bm[x + ',' + y];
      var size = m.size, cx = Math.floor(size / 2), cy = Math.floor(size / 2);
      // 营造入口（第3步）：工地可继续营造；空地可择蓝图开工（已建格升级留待后续）
      var inst = cityCellInst(cid, x, y);
      if (inst && !inst.built) {
        out.push({ id: 'city_build', label: '继续营造', icon: '🚧', tip: '回到工地，投料营造，工成则此格落成新筑', data: { cid: cid, x: x, y: y } });
      } else if (!inst && dt === 'empty') {
        out.push({ id: 'city_build', label: '营造新筑', icon: '🏗️', tip: '择空地依图纸营造建筑（民宅/市集/农庄/军营/土路）', data: { cid: cid, x: x, y: y } });
      }
      // ── 苦役营新格型互动（v20260907j）──
      // 牢房格(prison)不再另挂入口：囚室格 (1,0) 即城格，六间子牢房走面板 doors（CELL_INTERIORS），罗盘走网格邻居（v20260910q）
      if (t === 'mine') { out.push({ id: 'mine_dig', label: '开凿矿料', icon: '⛏', tip: '挥镐采掘，可得石料' }); }
      if (t === 'kitchen') { out.push({ id: 'kitchen_cook', label: '生火造饭', icon: '🍚', tip: '于伙房埋锅造饭，稍歇精神' }); }
      if (t === 'command') { out.push({ id: 'command_talk', label: '中军议事', icon: '🚩', tip: '入帐议事，览军情城务' }); }
      if (t === 'warehouse') { out.push({ id: 'warehouse_view', label: '进入仓库', icon: '📦', tip: '入库存取物资，存粮木料皆在此' }); }
      if (t === 'drill') { out.push({ id: 'drill_train', label: '操练武艺', icon: '🥋', tip: '于演武场挥汗操练，拳脚渐稳' }); }
      if (t === 'sentry') { out.push({ id: 'sentry_look', label: '瞭望岗哨', icon: '🏮', tip: '登岗瞭望，查看来往行踪' }); }
      if (t === 'barracks') { out.push({ id: 'recruit', label: '募兵操练', tip: '入营招募兵卒' }); out.push({ id: 'siege', label: '起兵略地', danger: true, tip: '起兵夺城，胜则易帜、败则遭火' }); }
      if (t === 'market') {
        // 商街店铺 = 场景交互物品：以本市场商铺清单（含程序生成招牌）渲染（进·字号 等），不再占用 NPC 列表
        var mkt = m.markets && m.markets[x + ',' + y];
        if (mkt) {
          mkt.shops.forEach(function (sh) {
            var bd = getBUILDINGS()[sh.key]; if (!bd) return;
            out.push({ id: 'enter_building', label: '进·' + sh.sign, icon: bd.icon, tip: '步入' + sh.sign + '——' + (bd.sub || '入内一观'), data: { building: sh.key, sign: sh.sign, mkt: mkt.name } });
          });
        } else {
          // 兜底（旧档无市场数据）：沿用全局五店
          ['yaofu', 'buzhuang', 'shishi', 'zahuo', 'gongzao'].forEach(function (k) {
            var bd = getBUILDINGS()[k]; if (!bd) return;
            out.push({ id: 'enter_building', label: '进·' + bd.name, icon: bd.icon, tip: '步入' + bd.name + '——' + (bd.sub || '入内一观'), data: { building: k } });
          });
        }
      }
      // v20260905h：出城统一走移动罗盘——立于城门格时，罗盘自动出现朝外的「出城」方向。
      // 不再提供「出城门」场景按钮；任意格可用「前往城门」自动寻路抵门（不出城），到门后由罗盘定向踏出。
      if (t !== 'gate') { /* 前往城门：归山河图/城门罗盘，城市视图不再常驻此钮 */ }
      // ── 政令台（v20260826g 身份系统）：立于中枢且此城归你所统，方能发号 ──
      if (x === cx && y === cy && cityOwnerOf(cid) === playerFaction()) {
        out.push({ id: 'edict', label: '政令台', icon: '📜', tip: '于此发号政令：征税、安民、观天下大势' });
      }
      // 教程/具名 动作名册（按格注入；v20260909p）
      var _tacts = (TUTORIAL_CITY_ACTS[cid] && TUTORIAL_CITY_ACTS[cid][x + ',' + y]) || [];
      for (var ti = 0; ti < _tacts.length; ti++) out.push(_tacts[ti]);
      return out;
    }
    // ── 城市房间由 cities.js 程序合成（rooms.js 不再手写）；山河志州治节点由 cities.js+coords 自动派生 ──
    function registerCityRooms() {
      var C = LF.CITIES || {};
      for (var cid in C) {
        var c = C[cid];
        if (!c || !c.grid) continue;
        if (G.ROOMS[cid]) continue;
        G.ROOMS[cid] = {
          id: cid, name: c.name,
          desc: (c.blurb || [c.desc || c.name]),
          find: (c.blurbFind || ''),
          exits: {}, npcs: [],
          items: (c.groundItems || []),
          actions: (c.rootActs || [{ id: 'rest', label: '城中休整', group: '行动', tip: '寻一处馆驿安歇，气血内力尽复' }]),
          isCity: true
        };
      }
    }

    function cityProfile(cid) {
      var c = (LF.CITIES || {})[cid]; if (!c) return null;
      var tier = c.pop >= 85 ? '巨邑' : c.pop >= 70 ? '大城' : c.pop >= 55 ? '州城' : c.pop >= 40 ? '县城' : '边邑';
      var popDesc = c.pop >= 85 ? '户口百万' : c.pop >= 70 ? '户口数十万' : c.pop >= 55 ? '户口数万' : c.pop >= 40 ? '户口数千' : '人口稀少';
      var orderDesc = c.order >= 70 ? '路不拾遗' : c.order >= 55 ? '夜不闭户' : c.order >= 40 ? '盗匪出没' : '兵荒马乱';
      var comDesc = c.commerce >= 70 ? '商贾云集' : c.commerce >= 55 ? '市井兴旺' : c.commerce >= 40 ? '买卖尚可' : '市面萧条';
      var agriDesc = (c.agri >= 70 ? '沃野千里' : c.agri >= 55 ? '田畴丰美' : c.agri >= 40 ? '耕耨寻常' : '地瘠人稀');
      var ctypeDesc = ({ plain: '平原城', mountain: '山城', port: '港口城', fort: '城寨' })[c.ctype || 'plain'];
      var gates = cityGates(c);
      return { c: c, tier: tier, tierDesc: tier, popDesc: popDesc, orderDesc: orderDesc, comDesc: comDesc, agriDesc: agriDesc, ctypeDesc: ctypeDesc, gates: gates };
    }
    function cityLine(cid) {
      var p = cityProfile(cid); if (!p) return '';
      var _s = '〔' + p.c.name + '·' + p.c.state + '·城况〕' + p.tierDesc + '｜' + p.popDesc + '｜' + p.orderDesc + '｜' + p.comDesc + '｜农:' + p.agriDesc + '｜' + p.ctypeDesc;
      if (isCaptured(cid)) _s += '｜〔' + factionLabel(cityOwnerOf(cid)) + '所占〕';   // 势力易主后显示占领势力
      return _s;
    }

    return {
      cityProfile: cityProfile, cityLine: cityLine,
      cityGates: cityGates, cityGateDirs: cityGateDirs,
      CELL_META: CELL_META, CELL_DESC: CELL_DESC,
      ensureCityState: ensureCityState,
      cityTierLv: cityTierLv, cityGridSize: cityGridSize, cityLevelName: cityLevelName,
      CITY_LV_SIZE: CITY_LV_SIZE, CITY_LV_NAME: CITY_LV_NAME,
      cityDevOf: cityDevOf, cityOwnerOf: cityOwnerOf, cityDefaultOwner: cityDefaultOwner,
      isCaptured: isCaptured, cityBurnedMap: cityBurnedMap,
      factionLabel: factionLabel, conquerCity: conquerCity, chronicle: chronicle, chronicleList: chronicleList,
      burnedGates: burnedGates, siegeGuardMul: siegeGuardMul, setCityDev: setCityDev,
      playerFaction: playerFaction, centerTypeOf: centerTypeOf, devRadius: devRadius, baseDisplayType: baseDisplayType,
      cityCellInst: cityCellInst, setCityCell: setCityCell, nextBuildOrderId: nextBuildOrderId,
      buildOrderById: buildOrderById, activeBuildOrder: activeBuildOrder,
      cellDisplayType: cellDisplayType, canEnterCell: canEnterCell,
      burnCells: burnCells, siegeWin: siegeWin, siegeLose: siegeLose,
      cellDisplayName: cellDisplayName, seededRand: seededRand, isCityGrid: isCityGrid,
      genCityGrid: genCityGrid, cityCellDesc: cityCellDesc,
      cityCellNpcs: cityCellNpcs, cityCellActs: cityCellActs,
      registerCityRooms: registerCityRooms
    };
  };
})();

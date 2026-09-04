// ===== 战略地图（D3 矢量 · 三国州郡）=====
// 从游戏 LF.CITIES 读取城市数据（经纬度 pos），从 region.geojson 读取郡边界
// 支持拖拽缩放、点击城市传送（调用游戏 goRoomOnMap）

(function(global){
  if(!global.LF) global.LF = {};

  // 势力配色（高饱和度，确保在游戏里清晰可见）
  const FACTIONS = {
    wei:  { label:'魏', fill:'rgba(80,130,220,0.92)',  stroke:'#1f2940', hover:'rgba(80,130,220,1.0)' },
    shu:  { label:'蜀', fill:'rgba(0,200,50,0.92)',    stroke:'#223318', hover:'rgba(0,200,50,1.0)' },
    wu:   { label:'吴', fill:'rgba(220,40,40,0.92)',   stroke:'#3f2016', hover:'rgba(220,40,40,1.0)' },
    none: { label:'争', fill:'rgba(160,150,140,0.92)', stroke:'#34291c', hover:'rgba(130,120,110,0.85)' },
  };

  // 特殊地点（地理坐标真相源见 shared/data/map.js 的 LF.MAP.specialGeo，与势力图网格坐标 coords 同文件维护）
  const SPECIAL_LOCATIONS = Object.entries(global.LF.MAP.specialGeo || {}).map(([id, l]) => ({ id, ...l }));

  // 几何工具：把同州的零散郡多边形合并成自然的州外框（凹包 + 样条平滑）
  function convexHull(pts) {
    if (pts.length < 3) return pts;
    const p = pts.slice().sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const pt of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop(); lower.push(pt); }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) { const pt = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop(); upper.push(pt); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }
  function segIntersect(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return o1 !== o2 && o3 !== o4;
  }
  function pointSegDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  // 凹包：从凸包出发，反复把过长的边用最近的外部点内凹替换，得到贴合郡分布的自然轮廓
  function concaveHull(pts, maxLen) {
    if (pts.length < 3) return pts.slice();
    let hull = convexHull(pts);
    let guard = 0, changed = true;
    while (changed && guard++ < 4000) {
      changed = false;
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= maxLen) continue;
        let best = null, bestD = Infinity;
        for (const p of pts) {
          if (hull.indexOf(p) !== -1) continue;
          const dd = pointSegDist(p, a, b);
          if (dd < bestD) { bestD = dd; best = p; }
        }
        if (!best) break;
        let ok = true;
        for (let j = 0; j < hull.length; j++) {
          if (j === i || (j + 1) % hull.length === i || j === (i + 1) % hull.length) continue;
          if (segIntersect(a, best, hull[j], hull[(j + 1) % hull.length]) ||
              segIntersect(best, b, hull[j], hull[(j + 1) % hull.length])) { ok = false; break; }
        }
        if (ok) { hull.splice(i + 1, 0, best); changed = true; break; }
      }
    }
    return hull;
  }
  // 闭合环 + Catmull-Rom 平滑，让州界呈自然手绘曲线
  function smoothClosedRing(ring, subdiv) {
    const n = ring.length;
    if (n < 3) return ring.slice();
    subdiv = subdiv || 6;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = ring[(i - 1 + n) % n], p1 = ring[i], p2 = ring[(i + 1) % n], p3 = ring[(i + 2) % n];
      for (let j = 0; j < subdiv; j++) {
        const t = j / subdiv, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([x, y]);
      }
    }
    out.push(out[0].slice());
    return out;
  }
  // 道格拉斯-普克抽稀：去掉郡多边形上过密的锯齿顶点
  function rdpSimplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [s, e] = stack.pop();
      let maxD = 0, idx = -1;
      for (let i = s + 1; i < e; i++) {
        const d = pointSegDist(pts[i], pts[s], pts[e]);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps && idx !== -1) { keep[idx] = true; stack.push([s, idx]); stack.push([idx, e]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function simplifyRing(ring, tol) {
    if (!ring || ring.length < 4) return ring ? ring.slice() : ring;
    const open = (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
      ? ring.slice(0, -1) : ring.slice();
    const simp = rdpSimplify(open, tol);
    if (simp.length < 3) return ring.slice();
    return simp.concat([simp[0]]);
  }

  // 地图填色 / overlay（势力范围、灾害示意、按郡着色等）
  let overlayMode = 'faction';
  let customOverlay = null;
  let _applyOverlay = null;
  const FACTION_FILL = {
    wei:  'rgba(80,130,220,0.42)',
    shu:  'rgba(60,190,90,0.40)',
    wu:   'rgba(220,70,60,0.40)',
    contested: 'rgba(220,170,40,0.42)',
    none: 'rgba(160,150,140,0.26)',
  };
  function commanderyTint(id) {
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return `hsla(${h},45%,55%,0.32)`;
  }
  function commanderyFill(p) {
    if (overlayMode === 'custom') return (customOverlay && customOverlay[p.id]) || 'rgba(150,120,80,0.06)';
    if (overlayMode === 'none') return 'rgba(150,120,80,0.06)';
    if (overlayMode === 'commandery') return commanderyTint(p.id);
    return FACTION_FILL[p.faction] || FACTION_FILL.none;
  }
  // 河流（手绘墨线）
  const RIVERS = [
    { name:'黄河', width:3.0, color:'#3f6480', pts:[[100,35],[102,36],[104,35.4],[106,35],[108,34.9],[110,35.1],[112,35],[114,35.6],[116,36.2],[118,38],[119.5,40]] },
    { name:'长江', width:3.6, color:'#3a5f7d', pts:[[100,32],[103,31],[106,30.5],[108,30],[110,30],[112,29.6],[114,29.5],[117,30],[119,31.4],[121,31.6]] },
    { name:'淮河', width:2.0, color:'#4a6b76', pts:[[108,33],[111,33],[114,33],[117,33],[119,32.8]] },
  ];

  // 州名标签位置由州几何「最深内点」计算（见下方 deepAnchor/stateLabelsDom），不再用硬编码坐标。

  // 加载郡边界 GeoJSON
  let _regionCache = null;
  function loadRegions() {
    // 优先用 script 全局（shared/data/map_regions.js 设置 LF.REGIONS），避免 file:// 下 fetch 被浏览器拦截导致地图空白
    if (global.LF && global.LF.REGIONS) return Promise.resolve(global.LF.REGIONS);
    if (_regionCache) return _regionCache;
    _regionCache = fetch('shared/data/map_regions.geojson?v=' + (global.LF.CONSTANTS ? global.LF.CONSTANTS.VERSION : '1')).then(r => r.json());
    return _regionCache;
  }

  // 从游戏 LF.CITIES 构建城市列表
  function buildCitiesFromGame() {
    const C = global.LF.CITIES || {};
    const cities = [];
    for (const cid in C) {
      const c = C[cid];
      if (!c || !c.pos || !c.pos.length) continue;
      const owner = c.owner || 'none';
      const faction = FACTIONS[owner] ? owner : 'none';
      cities.push({
        id: cid,
        name: c.name,
        state: c.state,
        tier: c.tier,
        grid: c.grid,
        owner: faction,
        capital: c.tier === 'zhou',
        desc: c.desc || c.name,
        comm: c.comm != null ? c.comm : null, // 行政区名(郡/国/尹)，与城点显示名 name 解耦
        pos: c.pos, // [lng, lat]
      });
    }
    return cities;
  }

  // 初始化战略地图
  // container: 容器 DOM 元素
  // opts: { onCityClick: function(city), onStateClick: function(state) }
  function initStrategicMap(container, opts) {
    opts = opts || {};

    // 清理容器
    container.innerHTML = '';
    container.classList.add('strategic-map-wrap');

    // 创建结构
    const viewport = document.createElement('div');
    viewport.className = 'strategic-map-viewport';
    viewport.id = 'sm-viewport';

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.className = 'strategic-map-svg';
    svgEl.id = 'sm-svg';

    const overlay = document.createElement('div');
    overlay.className = 'strategic-map-overlay';
    overlay.id = 'sm-overlay';

    viewport.appendChild(svgEl);
    viewport.appendChild(overlay);
    container.appendChild(viewport);

    // UI 层
    const ui = document.createElement('div');
    ui.className = 'strategic-map-ui';
    ui.innerHTML = `
      <div class="strategic-info" id="sm-info">点击州郡或城池查看详情</div>
      <div class="strategic-zoom-fab">
        <div class="strategic-zoom-ctrl">
          <button data-z="locate" title="定位到当前位置" aria-label="定位到当前位置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg></button>
          <button data-z="in" title="放大" aria-label="放大"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
          <button data-z="out" title="缩小" aria-label="缩小"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
          <button data-z="reset" title="复位" aria-label="复位"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg></button>
        </div>
        <button class="strategic-zoom-toggle" title="展开/收起缩放工具" aria-label="缩放工具" aria-expanded="false"><svg class="sg-zoom-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.3"/><line x1="15.3" y1="15.3" x2="21" y2="21"/><path d="M10.5 7.6v5.8M7.6 10.5h5.8"/></svg><svg class="sg-zoom-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg></button>
      </div>
      <div class="strategic-overlay-fab">
        <button class="strategic-overlay-toggle" title="展开/收起填色模式" aria-label="填色模式" aria-expanded="false"><svg class="sg-ov-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg><svg class="sg-ov-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9.5l6 6 6-6"/></svg></button>
        <div class="strategic-overlay-ctrl">
          <button data-ov="faction" class="active" title="势力范围">势力</button>
          <button data-ov="commandery" title="按郡着色">郡</button>
          <button data-ov="none" title="无底色">无</button>
        </div>
      </div>
      <div class="strategic-hint">拖拽平移 · 滚轮缩放 · 点击城池前往</div>
    `;
    container.appendChild(ui);


    const info = ui.querySelector('#sm-info');
    const svg = d3.select(svgEl);

    const projection = d3.geoMercator();
    const geoPath = d3.geoPath(projection);

    // 平面路径生成器：先把坐标用 projection 投影，再用普通 d3 路径串拼接，
    // 规避 d3.geoPath 的球面(测地线)处理把含尖刺/自接触顶点的环切成多子路径，
    // 从而在州/郡/势力内部渲染出多余线条。几何本身已 clean，问题纯在渲染层。
    function geomRings(geom) {
      if (!geom) return [];
      if (geom.type === 'Polygon') return [geom.coordinates[0]];
      if (geom.type === 'MultiPolygon') return geom.coordinates.map(p => p[0]);
      return [];
    }
    function planarPath(geom) {
      return geomRings(geom).map(r => 'M' + r.map(c => {
        const p = projection(c);
        return p[0].toFixed(2) + ',' + p[1].toFixed(2);
      }).join('L') + 'Z').join(' ');
    }
    function ringCentroid(pts) {
      let a = 0, cx = 0, cy = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1];
        const cr = x0 * y1 - x1 * y0;
        a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr;
      }
      a *= 0.5;
      if (Math.abs(a) < 1e-9) {
        let sx = 0, sy = 0;
        for (const p of pts) { sx += p[0]; sy += p[1]; }
        return [sx / (pts.length - 1), sy / (pts.length - 1)];
      }
      return [cx / (6 * a), cy / (6 * a)];
    }
    function planarCentroid(geom) {
      const rings = geomRings(geom);
      let best = null, bestArea = -1;
      for (const r of rings) {
        const pr = r.map(c => projection(c));
        let a = 0;
        for (let i = 0; i < pr.length - 1; i++) a += pr[i][0] * pr[i + 1][1] - pr[i + 1][0] * pr[i][1];
        a = Math.abs(a * 0.5);
        if (a > bestArea) { bestArea = a; best = pr; }
      }
      return best ? ringCentroid(best) : [0, 0];
    }

    // 地理范围
    const BASE_EXTENT = [95, 17, 128, 44];
    const rectFC = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: {},
        geometry: { type: 'Polygon', coordinates: [[
          [BASE_EXTENT[0], BASE_EXTENT[3]], [BASE_EXTENT[2], BASE_EXTENT[3]],
          [BASE_EXTENT[2], BASE_EXTENT[1]], [BASE_EXTENT[0], BASE_EXTENT[1]],
          [BASE_EXTENT[0], BASE_EXTENT[3]],
        ]] },
      }],
    };

    let W, H;
    let baseW = 0, baseH = 0, baseT = d3.zoomIdentity;   // 基础适配：渲染坐标系(首次视口) → 当前视口
    let currentTransform = d3.zoomIdentity;
    let selectedId = null;
    let statePaths = null;
    let cityMarks = [];
    let guideMarks = [];      // 引导标记：当前位置 / 目标打点
    let locateGuide = null;   // 「定位到我」动画入口
    let commanderyLabelsDom = [];
    let stateLabelsDom = [];
    let provinceLayer = null;
    let commanderyLayer = null;
    let factionFillLayer = null;
    let commanderyFillLayer = null;

    function render(regionData, cities) {
      svg.selectAll('*').remove();
      overlay.innerHTML = '';

      // 清理旧的州名标签
      container.querySelectorAll('.strategic-state-label-dom').forEach(e => e.remove());

      W = viewport.clientWidth;
      H = viewport.clientHeight;
      svg.attr('width', W).attr('height', H);
      projection.fitExtent([[0, 0], [W, H]], rectFC);
      baseW = W; baseH = H;

      // 构建郡 feature（直接用 dissolve 后的几何，d3 处理 Polygon/MultiPolygon）
      const cmdFeats = regionData.features.filter(f => f.properties.layer === 'commandery');
      const states = cmdFeats.map(f => {
        const name = f.properties.name;
        const city = cities.find(c => c.name === name);
        const faction = (FACTIONS[f.properties.faction] ? f.properties.faction : (city && FACTIONS[city.owner] ? city.owner : 'none'));
        const state = f.properties.state || (city ? city.state : '未知');
        const comm = city && city.comm ? city.comm : null;
        return {
          id: f.properties.id || name,
          name,
          comm,
          state,
          faction,
          desc: city ? city.desc : `${name}郡`,
          feature: f,
        };
      });

      const fc = {
        type: 'FeatureCollection',
        features: states.map(s => ({
          type: 'Feature',
          properties: { id: s.id, name: s.name, comm: s.comm, state: s.state, faction: s.faction, desc: s.desc },
          geometry: s.feature.geometry,
        })),
      };

      // defs / 滤镜
      const defs = svg.append('defs');
      const paper = defs.append('filter').attr('id', 'sm-paper').attr('x','0').attr('y','0').attr('width','100%').attr('height','100%');
      paper.append('feTurbulence').attr('type','fractalNoise').attr('baseFrequency','0.012 0.018').attr('numOctaves','3').attr('seed','11').attr('result','n');
      paper.append('feColorMatrix').attr('in','n').attr('type','matrix')
        .attr('values','0 0 0 0 0.55  0 0 0 0 0.47  0 0 0 0 0.33  0 0 0 0.05 0');

      // 可缩放根层
      const root = svg.append('g').attr('id', 'sm-root');

      // 河流（暂时去掉）
      // const riverLayer = root.append('g').attr('id', 'sm-rivers');
      // const rline = d3.line().x(d => projection(d)[0]).y(d => projection(d)[1]).curve(d3.curveCatmullRom);
      // riverLayer.selectAll('g').data(RIVERS).enter().append('g').each(function(r) {
      //   const g = d3.select(this);
      //   g.append('path').attr('d', rline(r.pts)).attr('fill','none')
      //     .attr('stroke','#9fb6bf').attr('stroke-width', r.width*1.6)
      //     .attr('opacity',0.26).attr('stroke-linecap','round');
      //   g.append('path').attr('d', rline(r.pts)).attr('fill','none')
      //     .attr('stroke', r.color).attr('stroke-width', r.width*0.85)
      //     .attr('opacity',0.55).attr('stroke-linecap','round');
      // });

      // 州郡填充（暂时去掉填充色，只保留可点击区域，郡边界线隐藏）
      const stateLayer = root.append('g').attr('id', 'sm-states');
      statePaths = stateLayer.selectAll('path.main').data(fc.features).enter().append('path')
        .attr('class','main')
        .attr('d', geoPath)
        .attr('fill', 'none')
        .attr('stroke', 'none')
        .attr('pointer-events','all')
        .style('cursor','pointer')
        .on('click', function(e, d) { e.stopPropagation(); selectState(d); });

      // 郡边界线（暂时隐藏）
      // const borderLayer = root.append('g').attr('id', 'sm-borders');
      // borderLayer.selectAll('path').data(fc.features).enter().append('path')
      //   .attr('d', geoPath)
      //   .attr('fill','none')
      //   .attr('stroke','#9a8a6a')
      //   .attr('stroke-width',0.25)
      //   .attr('stroke-linejoin','round')
      //   .attr('pointer-events','none');

      // ── 分层数据：州(dissolve) / 势力(dissolve) / 郡(去重叠) ──
      const provFeats = regionData.features.filter(f => f.properties.layer === 'province');
      const facFeats = regionData.features.filter(f => f.properties.layer === 'faction');
      const provinceFeatures = provFeats.map(f => ({ state: f.properties.state, feature: f }));

      // 势力填充层（已 dissolve，无重叠无双线 → 干净的势力范围图）
      factionFillLayer = root.append('g').attr('id', 'sm-faction-fill');
      factionFillLayer.selectAll('path').data(facFeats).enter().append('path')
        .attr('d', f => planarPath(f.geometry))
        .attr('fill', f => FACTION_FILL[f.properties.faction] || FACTION_FILL.none)
        .attr('stroke', 'none')
        .attr('pointer-events', 'none');
      // 远端先隐藏势力填充，避免半透明色块接缝形成"内部线"；拉近时再淡入
      factionFillLayer.style('opacity', 0);

      // 郡填充层（干净非重叠郡面，仅填充；描边交给独立的郡边界层）
      commanderyFillLayer = root.append('g').attr('id', 'sm-cmd-fill');
      commanderyFillLayer.selectAll('path').data(fc.features).enter().append('path')
        .attr('d', f => planarPath(f.geometry))
        .attr('fill', d => commanderyFill(d.properties))
        .attr('stroke', 'none')
        .attr('pointer-events', 'none');

      // 郡边界层（独立层级：不受 overlay 模式隐藏，与州边界交叉淡入淡出）
      const commanderyBorderLayer = root.append('g').attr('id', 'sm-cmd-border');
      commanderyBorderLayer.selectAll('path').data(fc.features).enter().append('path')
        .attr('d', f => planarPath(f.geometry))
        .attr('fill', 'none')
        .attr('stroke', 'rgba(40,26,5,0.55)')
        .attr('stroke-width', 0.6)
        .attr('stroke-linejoin', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('pointer-events', 'none');
      commanderyLayer = commanderyBorderLayer;
      // 默认完全不显示，避免首帧渲染闪烁；由 applyTransform 在拉近时切换
      commanderyLayer.style('opacity', 0).style('display', 'none');

      // 州级外框：单一干净金色描边（宏观疆界清晰，且无粗黑 halo 带，杜绝州内视觉线条）
      provinceLayer = root.append('g').attr('id', 'sm-provinces');
      provinceLayer.selectAll('path').data(provinceFeatures).enter().append('path')
        .attr('d', f => planarPath(f.feature.geometry))
        .attr('fill', 'none')
        .attr('stroke', '#b8893a')
        .attr('stroke-width', 2.2)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('pointer-events', 'none');

      _applyOverlay = function(mode) {
        overlayMode = mode || overlayMode;
        const fac = overlayMode === 'faction';
        factionFillLayer.style('display', fac ? null : 'none');
        commanderyFillLayer.style('display', fac ? 'none' : null);
        if (!fac) commanderyFillLayer.selectAll('path').attr('fill', d => commanderyFill(d.properties));
      };

      // 城市节点
      cityMarks = cities.map(c => {
        const wrap = document.createElement('div');
        wrap.className = 'strategic-city';
        wrap.setAttribute('data-cid', c.id);

        const dot = document.createElement('div');
        dot.className = 'strategic-city-dot' + (c.capital ? ' capital' : '');

        const nm = document.createElement('div');
        nm.className = 'strategic-city-name';
        nm.textContent = c.name;

        wrap.appendChild(dot);
        wrap.appendChild(nm);

        wrap.addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectCity(c);
          if (opts.onCityClick) opts.onCityClick(c);
        });

        overlay.appendChild(wrap);
        return { el: wrap, dot, nm, base: projection(c.pos), city: c };
      });

      // 特殊地点（苦役营、黑山寨等手写锚点房）
      const specialMarks = SPECIAL_LOCATIONS.map(loc => {
        const wrap = document.createElement('div');
        wrap.className = 'strategic-city special-loc';
        wrap.setAttribute('data-cid', loc.id);
        wrap.style.zIndex = '3';

        const dot = document.createElement('div');
        dot.className = 'strategic-city-dot special-dot';
        dot.style.background = loc.color;
        dot.style.borderColor = '#2a1208';
        dot.style.width = '10px';
        dot.style.height = '10px';

        const nm = document.createElement('div');
        nm.className = 'strategic-city-name special-name';
        nm.textContent = loc.name;
        nm.style.color = loc.color;
        nm.style.fontWeight = 'bold';

        wrap.appendChild(dot);
        wrap.appendChild(nm);

        wrap.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (opts.onCityClick) opts.onCityClick({ id: loc.id, name: loc.name, isSpecial: true });
        });

        overlay.appendChild(wrap);
        return { el: wrap, dot, nm, base: projection(loc.pos), loc };
      });

      // 引导标记：当前位置(you) / 目标打点(goal)。由游戏层 opts.marks 传入，
      // 只做纯视觉叠加（pointer-events:none），不遮挡下方城点的点击传送。
      guideMarks = [];
      (opts.marks || []).forEach(m => {
        if (!m || !m.pos || !m.pos.length) return;
        const p = projection(m.pos);
        if (!p || !isFinite(p[0]) || !isFinite(p[1])) return;
        const isGoal = m.type === 'goal';
        const wrap = document.createElement('div');
        wrap.className = 'strategic-guide ' + (isGoal ? 'g-goal' : 'g-you');
        const fig = document.createElement('div');
        fig.className = 'sg-fig';
        fig.textContent = isGoal ? '⚑' : '';
        const pill = document.createElement('div');
        pill.className = 'sg-pill';
        pill.textContent = m.label || m.name || (isGoal ? '目标' : '当前所在');
        wrap.appendChild(fig);
        wrap.appendChild(pill);
        overlay.appendChild(wrap);
        guideMarks.push({ el: wrap, fig, pill, type: m.type || 'you', base: p });
      });
      // 有引导标记时，底栏提示补一行读图说明
      if (guideMarks.length) {
        const hint = ui.querySelector('.strategic-hint');
        if (hint) {
          const parts = ['拖拽平移 · 滚轮缩放 · 点击城池前往'];
          if (guideMarks.some(o => o.type === 'you')) parts.push('◎ 你在此');
          if (guideMarks.some(o => o.type === 'goal')) parts.push('⚑ 目标');
          hint.innerHTML = parts.join('　');
        }
      }

      // ── 标签锚点安全网：点/环判定 + 州(郡)内兜底 ──
      // 统一在投影像素坐标判定「点是否落在州/郡内」，供最深内点搜索与兜底锚点使用。
      function pointInRingXY(p, ringPx) {
        const x = p[0], y = p[1];
        let inside = false;
        for (let i = 0, j = ringPx.length - 2; i < ringPx.length - 1; j = i++) {
          const xi = ringPx[i][0], yi = ringPx[i][1];
          const xj = ringPx[j][0], yj = ringPx[j][1];
          if ((yi > y) !== (yj > y) && x < (xj + (y - yj) / (yj - yi) * (xi - xj))) inside = !inside;
        }
        return inside;
      }
      function pointInStatePx(geom, p) {
        if (!geom || !p || !isFinite(p[0]) || !isFinite(p[1])) return false;
        const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
        for (let k = 0; k < polys.length; k++) {
          const poly = polys[k];
          if (!pointInRingXY(p, poly[0].map(c => projection(c)))) continue;
          let hole = false;
          for (let h = 1; h < poly.length; h++) {
            if (pointInRingXY(p, poly[h].map(c => projection(c)))) { hole = true; break; }
          }
          if (!hole) return true;
        }
        return false;
      }
      // 抗退化「点是否在环内」（winding number）。deepAnchor 的扫描线网格 y 经常与
      // 多边形顶点 y 完全重合（底部/顶部平行边、溶解产生的重复顶点），普通射线奇偶法
      // 在这种重合下会把 bbox 角上「州外」的网格点误判为州内，再经细化搜索把锚点一路
      // 推到州外（凉州/交州即此例，旧锚点落在主环外数十 px）。winding 对重合 y 稳定，
      // 边界点一律视作在内（其距离≈0，不会成为最远点）。
      function pointInRingWind(p, ringPx) {
        const x = p[0], y = p[1];
        let wn = 0;
        const n = ringPx.length - 1;   // 环闭合：末点=首点
        for (let i = 0; i < n; i++) {
          const x1 = ringPx[i][0], y1 = ringPx[i][1];
          const x2 = ringPx[i + 1][0], y2 = ringPx[i + 1][1];
          const cr = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1);
          if (y1 <= y) { if (y2 > y && cr > 0) wn++; }
          else { if (y2 <= y && cr < 0) wn--; }
        }
        return wn !== 0;
      }
      // 州名锚点：在州内取「离州边界最远」的深内点（近似 pole of inaccessibility）。
      // 凹形/细长州用纯质心会压线，碰撞避让又常把标签推到州界上（中心压边=半截字挂
      // 到州外，冀州串到幽州就是这路来的）。改取州形最深处后，中心天然离边界有距离，
      // 无需互相避让也能保证「州名落在本州轮廓内」。
      function deepAnchor(geom) {
        const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
        // 预投影所有环（外环+洞），网格搜索时不再重复投影
        const polyRingsPx = polys.map(p => p.map(ring => ring.map(c => projection(c))));
        const outerPx = polyRingsPx.map(r => r[0]);
        const inGeom = (p) => {
          for (let k = 0; k < polyRingsPx.length; k++) {
            if (!pointInRingWind(p, polyRingsPx[k][0])) continue;
            let hole = false;
            for (let h = 1; h < polyRingsPx[k].length; h++) {
              if (pointInRingWind(p, polyRingsPx[k][h])) { hole = true; break; }
            }
            if (!hole) return true;
          }
          return false;
        };
        // 取面积最大外环的包围盒（避免锚点被小岛等次要地块带偏）
        let bb = null;
        for (let k = 0; k < polys.length; k++) {
          const o = outerPx[k];
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let q = 0; q < o.length; q++) {
            if (o[q][0] < minX) minX = o[q][0];
            if (o[q][0] > maxX) maxX = o[q][0];
            if (o[q][1] < minY) minY = o[q][1];
            if (o[q][1] > maxY) maxY = o[q][1];
          }
          const area = (maxX - minX) * (maxY - minY);
          if (!bb || area > bb.area) bb = { minX, maxX, minY, maxY, area };
        }
        if (!bb) return [0, 0];
        const dist2 = (p) => {
          let best = Infinity;
          for (let k = 0; k < outerPx.length; k++) {
            const o = outerPx[k], n = o.length;
            if (n < 2) continue;
            let x1 = o[n - 1][0], y1 = o[n - 1][1];
            for (let i = 0; i < n; i++) {
              const x2 = o[i][0], y2 = o[i][1];
              const vx = x2 - x1, vy = y2 - y1;
              const wx = p[0] - x1, wy = p[1] - y1;
              const l2 = vx * vx + vy * vy;
              const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / l2));
              const qx = x1 + t * vx - p[0], qy = y1 + t * vy - p[1];
              const d = qx * qx + qy * qy;
              if (d < best) best = d;
              x1 = x2; y1 = y2;
            }
          }
          return best;
        };
        let best = null, bd = -1;
        for (let gy = 0; gy <= 36; gy++) {
          for (let gx = 0; gx <= 36; gx++) {
            const p = [bb.minX + (bb.maxX - bb.minX) * gx / 36, bb.minY + (bb.maxY - bb.minY) * gy / 36];
            if (!inGeom(p)) continue;
            const d = dist2(p);
            if (d > bd) { bd = d; best = p; }
          }
        }
        if (best) {
          const rx = (bb.maxX - bb.minX) / 72, ry = (bb.maxY - bb.minY) / 72;
          for (let gy = -8; gy <= 8; gy++) {
            for (let gx = -8; gx <= 8; gx++) {
              const p = [best[0] + rx * gx, best[1] + ry * gy];
              if (!inGeom(p)) continue;
              const d = dist2(p);
              if (d > bd) { bd = d; best = p; }
            }
          }
        }
        return best || insideAnchor(geom, planarCentroid(geom));
      }
      // 锚点（郡名等次要标签）：优先用质心；不在本区(或多环区)时在区内 bbox 网格里找靠近中心的可用点
      function insideAnchor(geom, candidate) {
        if (candidate && pointInStatePx(geom, candidate)) return candidate;
        const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
        let bb = null;
        for (let k = 0; k < polys.length; k++) {
          const outer = polys[k][0].map(c => projection(c));
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let q = 0; q < outer.length; q++) {
            if (outer[q][0] < minX) minX = outer[q][0];
            if (outer[q][0] > maxX) maxX = outer[q][0];
            if (outer[q][1] < minY) minY = outer[q][1];
            if (outer[q][1] > maxY) maxY = outer[q][1];
          }
          const area = (maxX - minX) * (maxY - minY);
          if (!bb || area > bb.area) bb = { minX, maxX, minY, maxY, area };
        }
        if (!bb) return [0, 0];
        const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
        let best = null, bestD = Infinity;
        for (let gy = 1; gy <= 30; gy++) {
          for (let gx = 1; gx <= 30; gx++) {
            const p = [bb.minX + (bb.maxX - bb.minX) * gx / 30, bb.minY + (bb.maxY - bb.minY) * gy / 30];
            if (!pointInStatePx(geom, p)) continue;
            const d = (p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy);
            if (d < bestD) { bestD = d; best = p; }
          }
        }
        return best || (candidate && isFinite(candidate[0]) && isFinite(candidate[1]) ? candidate : [0, 0]);
      }

      // 州名标签（用本州「最深内点」作锚，放进 overlay 跟随 transform）
      stateLabelsDom = [];
      provFeats.forEach(f => {
        const stateName = f.properties.state;
        const el = document.createElement('div');
        el.className = 'strategic-state-label-dom';
        el.textContent = stateName;
        const c = deepAnchor(f.geometry);
        overlay.appendChild(el);
        stateLabelsDom.push({ el, name: stateName, baseX: c[0], baseY: c[1] });
      });

      // 郡名标签（投影质心定位，拉近时淡入；文案用与城点解耦的行政区名 comm，
      // 对照史书为郡/国/尹等名号；非郡级区域（新野、夷洲 comm 为空）不设郡大标，仅以城点示之）
      commanderyLabelsDom = [];
      cmdFeats.forEach(f => {
        const _city = cities.find(c => c.name === f.properties.name);
        const comm = _city && _city.comm ? _city.comm : null;
        if (!comm) return;
        const el = document.createElement('div');
        el.className = 'strategic-cmd-label-dom';
        el.textContent = comm;
        const c = insideAnchor(f.geometry, planarCentroid(f.geometry));
        overlay.appendChild(el);
        commanderyLabelsDom.push({ el, name: comm, baseX: c[0], baseY: c[1] });
      });

      // ===== 州名重叠求解（参考系 k=1，一次求解；之后位置与字号等比缩放保持不叠）=====
      // 标签实测 w≈38 h≈20（字号17 / 字距1.5px）。宏观下中原相邻州（并冀司兖青徐豫幽）的
      // 「最深内点」可能仅相距十几像素，标签易互压。此处做有限位移：
      // 每对重叠沿「所需位移更小」的轴各推一半，累计位移封顶，并以「标签盒四角仍在州内」
      // （winding，含洞）为硬约束 —— 求解器只能把盒子推到贴州界、完全在州内，杜绝甩出轮廓；
      // 窄州放不下时留最深内点（最小溢出），宁可轻微相邻也不越界。替代早前无约束全局避让。
      {
        const HW = 19, HH = 9.5, GAP = 3;           // k=1、字号17 时半宽/半高 + 间隔
        const stateFeatByName = {};
        provFeats.forEach(f => { stateFeatByName[f.properties.state] = f; });
        // 预投影本州环（含洞），供位移约束复用
        const statePolysPx = stateLabelsDom.map(o => {
          const geom = stateFeatByName[o.name] ? stateFeatByName[o.name].geometry : null;
          const polys = geom ? (geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]) : [];
          return polys.map(poly => ({
            outer: poly[0].map(c => projection(c)),
            holes: poly.slice(1).map(ring => ring.map(c => projection(c))),
          }));
        });
        function windInStateIdx(idx, x, y) {
          const polys = statePolysPx[idx];
          for (let p = 0; p < polys.length; p++) {
            if (!pointInRingWind([x, y], polys[p].outer)) continue;
            let inHole = false;
            for (let h = 0; h < polys[p].holes.length; h++) {
              if (pointInRingWind([x, y], polys[p].holes[h])) { inHole = true; break; }
            }
            if (!inHole) return true;
          }
          return false;
        }
        // 硬约束：标签「盒四角」都须在本州多边形内（含洞判定），
        // 不再退让到外接框 —— 求解器只能把盒子推到贴州界、完全在州内，杜绝甩出轮廓。
        function boxInStateIdx(idx, x, y) {
          return windInStateIdx(idx, x - HW, y - HH) && windInStateIdx(idx, x + HW, y - HH)
              && windInStateIdx(idx, x - HW, y + HH) && windInStateIdx(idx, x + HW, y + HH);
        }
        // 沿 x 或 y 单轴平移；远端令任一角出州则二分回收，返回实际位移
        function shiftInState(idx, bx, by, isY, delta) {
          if (!delta) return { x: bx, y: by, moved: 0 };
          const sgn = delta > 0 ? 1 : -1, dist = Math.abs(delta);
          let lo = 0, hi = dist;
          for (let b = 0; b < 16; b++) {
            const m = (lo + hi) / 2;
            if (boxInStateIdx(idx, isY ? bx : bx + sgn * m, isY ? by + sgn * m : by)) lo = m;
            else hi = m;
          }
          return isY
            ? { x: bx, y: by + sgn * lo, moved: lo }
            : { x: bx + sgn * lo, y: by, moved: lo };
        }
        const cap = stateLabelsDom.map(() => 30);   // 每州累计位移上限(px, k=1)
        for (let iter = 0; iter < 260; iter++) {
          let any = false;
          for (let i = 0; i < stateLabelsDom.length; i++) {
            for (let j = i + 1; j < stateLabelsDom.length; j++) {
              const A = stateLabelsDom[i], B = stateLabelsDom[j];
              const dx = B.baseX - A.baseX, dy = B.baseY - A.baseY;
              const adx = Math.abs(dx), ady = Math.abs(dy);
              if (adx >= HW * 2 + GAP || ady >= HH * 2 + GAP) continue;
              const needX = HW * 2 + GAP - adx;
              const needY = HH * 2 + GAP - ady;
              // 依次尝试 y / x 两轴，某轴被本州几何顶住则换另一轴
              const axes = needY < needX ? [true, false] : [false, true];
              for (let ai = 0; ai < axes.length; ai++) {
                const useY = axes[ai];
                const need = useY ? needY : needX;
                const tb = cap[i] + cap[j];
                if (tb < 0.5) continue;
                // 预算按两州剩余可位移量分摊，能动的多动
                let pa = Math.min(cap[i], need * (cap[i] / tb));
                let pb = need - pa;
                if (pb > cap[j]) pb = cap[j];
                if (pa + pb < 0.5) continue;
                const sA = useY ? (dy >= 0 ? -1 : 1) : (dx >= 0 ? -1 : 1);
                const ra = shiftInState(i, A.baseX, A.baseY, useY, sA * pa);
                const rb = shiftInState(j, B.baseX, B.baseY, useY, -sA * pb);
                if (ra.moved < 0.5 && rb.moved < 0.5) continue;
                cap[i] -= ra.moved; A.baseX = ra.x; A.baseY = ra.y;
                cap[j] -= rb.moved; B.baseX = rb.x; B.baseY = rb.y;
                any = true;
                break;   // 本对已推，下一对
              }
            }
          }
          if (!any) break;
        }
      }

      function positionOverlay(t) {
        const k = t.k;
        cityMarks.forEach(o => {
          o.el.style.left = (o.base[0] * k) + 'px';
          o.el.style.top = (o.base[1] * k) + 'px';
        });
        guideMarks.forEach(o => {
          o.el.style.left = (o.base[0] * k) + 'px';
          o.el.style.top = (o.base[1] * k) + 'px';
        });
        if (typeof specialMarks !== 'undefined') {
          specialMarks.forEach(o => {
            o.el.style.left = (o.base[0] * k) + 'px';
            o.el.style.top = (o.base[1] * k) + 'px';
          });
        }
        if (stateLabelsDom && stateLabelsDom.length) {
          stateLabelsDom.forEach(o => {
            o.el.style.left = (o.baseX * k) + 'px';
            o.el.style.top = (o.baseY * k) + 'px';
          });
        }
        if (commanderyLabelsDom && commanderyLabelsDom.length) {
          commanderyLabelsDom.forEach(o => {
            o.el.style.left = (o.baseX * k) + 'px';
            o.el.style.top = (o.baseY * k) + 'px';
          });
        }
      }

      // 应用变换 + 按缩放分级显隐
      function fade(k, lo, hi) { const t = (k - lo) / (hi - lo); return t <= 0 ? 0 : t >= 1 ? 1 : t; }
      function applyTransform(userT) {
        // 叠加基础适配：把渲染坐标系映射到当前视口。
        // d3 v7 的 ZoomTransform 已移除 .transform() 方法，这里用仿射合成等价实现：
        //   t = baseT ∘ userT  →  k = baseT.k*userT.k, x = baseT.x + baseT.k*userT.x, y = baseT.y + baseT.k*userT.y
        const k = baseT.k * userT.k;
        const t = d3.zoomIdentity.translate(baseT.x + baseT.k * userT.x, baseT.y + baseT.k * userT.y).scale(k);
        root.attr('transform', `translate(${t.x},${t.y}) scale(${k})`);
        overlay.style.transform = `translate(${t.x}px,${t.y}px)`;
        // 两级 LOD 交叉淡入淡出：
        //   拉远(k<1.9) → 只州描边+州名（郡描边/郡名/城名为0）
        //   拉近(k>3.4) → 州描边+州名淡出，郡描边+郡名+城名淡入
        const lod = fade(k, 1.9, 3.4);
        if (provinceLayer) {
          const pop = 1 - lod;
          provinceLayer.style('opacity', pop);
        }
        if (commanderyLayer) {
          // 州内保持干净无内部线：郡边界线层始终隐藏（"郡"填色模式仍显示色块）
          commanderyLayer.style('display', 'none');
        }
        if (commanderyFillLayer) commanderyFillLayer.style('opacity', lod);
        // 势力填充与郡同节奏淡入（远端只显示州描边，杜绝色块接缝造成的内部线）
        if (factionFillLayer) factionFillLayer.style('opacity', lod);
        if (stateLabelsDom.length) stateLabelsDom.forEach(o => {
          o.el.style.opacity = String(1 - lod);
          // 远观等比缩小：k=1 基准 17px，k<1 时与地图同比例变小（与 k=1 布局重叠率恒定）
          const fs = Math.max(11, 17 * Math.min(1, k));
          o.el.style.fontSize = fs.toFixed(1) + 'px';
          o.el.style.letterSpacing = (fs < 15 ? '1px' : fs < 18 ? '1.5px' : '2px');
        });
        if (commanderyLabelsDom.length) commanderyLabelsDom.forEach(o => { o.el.style.opacity = String(lod); });
        if (cityMarks.length) cityMarks.forEach(o => { const op = fade(k, 1.4, 3.0); if (o.el) { o.el.style.opacity = String(op); o.el.style.pointerEvents = op > 0.05 ? 'auto' : 'none'; } });
        if (typeof specialMarks !== 'undefined' && specialMarks.length) specialMarks.forEach(o => { const op = fade(k, 1.4, 3.0); if (o.el) { o.el.style.opacity = String(op); o.el.style.pointerEvents = op > 0.05 ? 'auto' : 'none'; } if (o.nm) o.nm.style.opacity = String(op); });
        // 引导标记任何缩放级别都保持可见（仅1~2枚，不产生干扰）
        guideMarks.forEach(o => { if (o.el) o.el.style.opacity = '1'; });
        positionOverlay(t);
      }

      // 初始 transform
      if (!render._initDone) {
        render._initDone = true;
        currentTransform = d3.zoomIdentity.translate(30, 60).scale(0.8);
      }
      computeBaseFit();
      applyTransform(currentTransform);

      // 暴露给 zoom
      render._apply = applyTransform;
      render._statePaths = statePaths;

      // 「定位到我」：把视图平滑移到当前位置（无 you 标记时退回第一个目标）
      locateGuide = function() {
        const g = guideMarks.find(o => o.type === 'you') || guideMarks[0];
        if (!g || !W || !H) return;
        const k = 2.6 / (baseT.k || 1);                 // 保持屏幕上约 2.6 倍缩放手感
        const target = baseT.invert([W / 2, H / 2]);    // 视口中心换算回渲染坐标系
        const tx = target[0] - g.base[0] * k;
        const ty = target[1] - g.base[1] * k;
        currentTransform = d3.zoomIdentity.translate(tx, ty).scale(k);
        svg.transition().duration(450).call(zoom.transform, currentTransform);
      };
    }

    // 基础适配：把「渲染坐标系(baseW×baseH，即首次渲染时的视口)」等比映射进当前视口。
    // 仅随视口尺寸变化重算，resize 时调用后配合 applyTransform(currentTransform) 即可，
    // 无需重建 SVG 与标签 DOM（避免手机转屏卡顿/闪烁）。
    function computeBaseFit() {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      W = w; H = h;
      svg.attr('width', w).attr('height', h);
      if (!baseW || !baseH) { baseW = w; baseH = h; }
      const s = Math.min(w / baseW, h / baseH);
      const tx = (w - baseW * s) / 2;
      const ty = (h - baseH * s) / 2;
      baseT = d3.zoomIdentity.translate(tx, ty).scale(s);
    }

    function sealStyle(faction) {
      const f = FACTIONS[faction] || FACTIONS.none;
      return `background:${f.stroke}`;
    }

    function selectState(d) {
      selectedId = d.properties.id;
      const f = FACTIONS[d.properties.faction] || FACTIONS.none;
      const title = d.properties.comm || d.properties.name;
      const hasCity = d.properties.comm && d.properties.comm !== d.properties.name;
      info.innerHTML = `
        <div class="strategic-info-h">
          <span class="seal" style="${sealStyle(d.properties.faction)}">${f.label}</span>
          ${title}
        </div>
        <div class="strategic-info-b">${d.properties.desc}<br/>
          <span style="color:#8a6a3a;font-size:11px;">${d.properties.state || ''}${hasCity ? ' · 城址 ' + d.properties.name : ''}</span>
        </div>
      `;
      info.classList.add('show');
    }

    function selectCity(c) {
      const f = FACTIONS[c.owner] || FACTIONS.none;
      info.innerHTML = `
        <div class="strategic-info-h">
          <span class="seal" style="${sealStyle(c.owner)}">${f.label}</span>
          ${c.name}${c.capital ? ' · 州治' : ''}
        </div>
        <div class="strategic-info-b">${c.desc || ''}<br/>
          <span style="color:#8a6a3a;font-size:11px;">${[c.comm, c.state, c.grid ? c.grid + '×' + c.grid + '城内' : ''].filter(Boolean).join(' · ')}</span>
        </div>
        <button class="go-btn" id="sm-go-btn">前往此城</button>
      `;
      info.classList.add('show');

      const goBtn = info.querySelector('#sm-go-btn');
      if (goBtn) {
        goBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (opts.onCityClick) opts.onCityClick(c);
        });
      }
    }

    // 缩放 / 平移
    const zoom = d3.zoom().scaleExtent([0.5, 8])
      .filter(e => {
        if (e.type === 'wheel') return true;
        if (e.type === 'dblclick') return false;
        return !e.button;
      })
      .on('zoom', (e) => {
        currentTransform = e.transform;
        if (render._apply) render._apply(e.transform);
      });
    svg.call(zoom);

    // 缩放按钮
    ui.querySelectorAll('.strategic-zoom-ctrl button').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.z;
        if (k === 'in') svg.transition().duration(200).call(zoom.scaleBy, 1.4);
        else if (k === 'out') svg.transition().duration(200).call(zoom.scaleBy, 1/1.4);
        else if (k === 'locate') { if (locateGuide) locateGuide(); }
        else svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
      });
    });

    // 两组控制（缩放 / 填色模式）的收起式浮动组：小屏(容器宽<540)默认只露手柄，
    // 点开才展开按钮列；在图上拖拽/双指缩放时自动收起，避免持续遮挡并/司(左上)与扬州/交州(右下)。
    let applyCompact = null;
    const bindFab = (fab, toggleSel) => {
      if (!fab) return null;
      const toggle = fab.querySelector(toggleSel);
      const setOpen = (open) => {
        fab.classList.toggle('open', open);
        if (toggle) toggle.setAttribute('aria-expanded', open);
      };
      if (toggle) toggle.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!fab.classList.contains('open')); });
      svgEl.addEventListener('pointerdown', () => { if (fab.classList.contains('open')) setOpen(false); });
      return () => {
        const compact = ui.clientWidth < 540;
        fab.classList.toggle('compact', compact);
        if (!compact) fab.classList.remove('open');
        if (toggle) toggle.setAttribute('aria-expanded', fab.classList.contains('open'));
      };
    };
    const applyCompactZoom = bindFab(ui.querySelector('.strategic-zoom-fab'), '.strategic-zoom-toggle');
    const applyCompactOverlay = bindFab(ui.querySelector('.strategic-overlay-fab'), '.strategic-overlay-toggle');
    applyCompact = () => { if (applyCompactZoom) applyCompactZoom(); if (applyCompactOverlay) applyCompactOverlay(); };
    applyCompact();

    // 填色模式切换（势力范围 / 按郡 / 无）
    ui.querySelectorAll('.strategic-overlay-ctrl button').forEach(b => {
      b.addEventListener('click', () => {
        ui.querySelectorAll('.strategic-overlay-ctrl button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        if (_applyOverlay) _applyOverlay(b.dataset.ov);
      });
    });
    // 对外 API：游戏可传入 {commanderyId:'rgba(...)'} 绘制灾害/自定义范围图
    global.LF.setMapOverlay = function(mapById) { customOverlay = mapById || null; if (_applyOverlay) _applyOverlay('custom'); };

    // 点击空白
    svg.on('click', () => {
      selectedId = null;
      info.classList.remove('show');
    });

    // 加载数据并渲染
    const cities = buildCitiesFromGame();
    loadRegions().then(regionData => {
      render(regionData, cities);
    }).catch(err => {
      console.error('战略地图加载失败', err);
      container.innerHTML = '<div class="strategic-loading">地图加载失败，请刷新重试</div>';
    });

    // 响应式：仅重算基础适配并复用当前变换，不再整图重建（手机转屏不卡顿/不闪烁）
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      if (applyCompact) applyCompact();
      rt = setTimeout(() => {
        computeBaseFit();
        if (render._apply) render._apply(currentTransform);
      }, 200);
    });

    return {
      refresh: () => {
        const cities2 = buildCitiesFromGame();
        loadRegions().then(regionData => {
          render(regionData, cities2);
        });
      },
      destroy: () => {
        container.innerHTML = '';
        container.classList.remove('strategic-map-wrap');
      }
    };
  }

  global.LF.initStrategicMap = initStrategicMap;
  global.LF.STRATEGIC_FACTIONS = FACTIONS;
})(typeof window !== 'undefined' ? window : globalThis);

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

  // 河流（手绘墨线）
  const RIVERS = [
    { name:'黄河', width:3.0, color:'#3f6480', pts:[[100,35],[102,36],[104,35.4],[106,35],[108,34.9],[110,35.1],[112,35],[114,35.6],[116,36.2],[118,38],[119.5,40]] },
    { name:'长江', width:3.6, color:'#3a5f7d', pts:[[100,32],[103,31],[106,30.5],[108,30],[110,30],[112,29.6],[114,29.5],[117,30],[119,31.4],[121,31.6]] },
    { name:'淮河', width:2.0, color:'#4a6b76', pts:[[108,33],[111,33],[114,33],[117,33],[119,32.8]] },
  ];

  // 州名位置（经纬度坐标 [lng, lat]）
  const STATE_POSITIONS = {
    '凉州': [102, 38],
    '幽州': [116, 40],
    '并州': [112, 38],
    '冀州': [115, 37],
    '司隶': [110, 34.5],
    '兖州': [116, 35.5],
    '青州': [118, 36.5],
    '豫州': [113, 33],
    '荆州': [112, 30],
    '徐州': [117, 34],
    '扬州': [119, 32],
    '益州': [104, 31],
    '交州': [110, 23],
  };

  // 加载郡边界 GeoJSON
  let _regionCache = null;
  function loadRegions() {
    if (_regionCache) return _regionCache;
    _regionCache = fetch('shared/data/region.geojson?v=1').then(r => r.json());
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
      <div class="strategic-zoom-ctrl">
        <button data-z="in" title="放大">＋</button>
        <button data-z="out" title="缩小">－</button>
        <button data-z="reset" title="复位">⟲</button>
      </div>
      <div class="strategic-hint">拖拽平移 · 滚轮缩放 · 点击城池前往</div>
    `;
    container.appendChild(ui);

    // 浮动调试面板（手机也能看到日志）
    const debugPanel = document.createElement('div');
    debugPanel.className = 'strategic-debug-panel';
    debugPanel.innerHTML = `
      <div class="strategic-debug-header">
        <span>🗺️ 地图调试</span>
        <button class="strategic-debug-toggle">−</button>
        <button class="strategic-debug-clear">清</button>
      </div>
      <div class="strategic-debug-content"></div>
    `;
    container.appendChild(debugPanel);
    const debugContent = debugPanel.querySelector('.strategic-debug-content');
    const debugToggle = debugPanel.querySelector('.strategic-debug-toggle');
    const debugClear = debugPanel.querySelector('.strategic-debug-clear');
    let debugMinimized = false;
    debugToggle.addEventListener('click', () => {
      debugMinimized = !debugMinimized;
      debugContent.style.display = debugMinimized ? 'none' : 'block';
      debugToggle.textContent = debugMinimized ? '+' : '−';
    });
    debugClear.addEventListener('click', () => {
      debugContent.innerHTML = '';
    });
    // 重写console.log，捕获[战略地图]日志
    const origLog = console.log.bind(console);
    console.log = function(...args) {
      origLog(...args);
      try {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        if (msg.indexOf('[战略地图]') >= 0) {
          const line = document.createElement('div');
          line.className = 'strategic-debug-line';
          line.textContent = msg;
          debugContent.appendChild(line);
          debugContent.scrollTop = debugContent.scrollHeight;
        }
      } catch(e) {}
    };

    const info = ui.querySelector('#sm-info');
    const svg = d3.select(svgEl);

    const projection = d3.geoMercator();
    const geoPath = d3.geoPath(projection);

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
    let currentTransform = d3.zoomIdentity;
    let selectedId = null;
    let statePaths = null;
    let cityMarks = [];
    let stateLabelsDom = [];

    function render(regionData, cities) {
      svg.selectAll('*').remove();
      overlay.innerHTML = '';

      // 清理旧的州名标签
      container.querySelectorAll('.strategic-state-label-dom').forEach(e => e.remove());

      W = viewport.clientWidth;
      H = viewport.clientHeight;
      svg.attr('width', W).attr('height', H);
      projection.fitExtent([[0, 0], [W, H]], rectFC);

      // 构建州郡 feature
      const states = regionData.features.map(f => {
        const name = f.properties.city;
        // 从城市列表找匹配的郡，获取势力和州名
        const city = cities.find(c => c.name === name);
        const faction = city ? city.owner : 'none';
        const state = city ? city.state : '未知';
        return {
          id: name,
          name,
          state,
          faction,
          desc: city ? city.desc : `${name}郡（${FACTIONS[faction].label}势力）`,
          ring: f.geometry.coordinates[0],
          feature: f,
        };
      });

      const fc = {
        type: 'FeatureCollection',
        features: states.map(s => ({
          type: 'Feature',
          properties: { id: s.id, name: s.name, faction: s.faction, desc: s.desc },
          geometry: { type: 'Polygon', coordinates: [s.ring] },
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

      // 州级边界线（用turf.dissolve根据state属性合并同州的郡，去掉内部边界）
      const stateBorderLayer = root.append('g').attr('id', 'sm-state-borders');
      try {
        console.log('[战略地图] turf.dissolve是否存在:', typeof window.turf.dissolve);
        
        // 构建带state属性的FeatureCollection
        const fcWithState = {
          type: 'FeatureCollection',
          features: states.map(s => ({
            type: 'Feature',
            properties: { state: s.state, name: s.name },
            geometry: { type: 'Polygon', coordinates: [s.ring] }
          }))
        };
        
        let stateFeatures = [];
        
        // 方法1：用turf.dissolve合并（推荐，能干净去掉内部边界）
        if (typeof window.turf.dissolve === 'function') {
          try {
            const dissolved = window.turf.dissolve(fcWithState, { propertyName: 'state' });
            if (dissolved && dissolved.features) {
              stateFeatures = dissolved.features;
              console.log('[战略地图] turf.dissolve合并成功，州数:', stateFeatures.length);
              stateFeatures.forEach(f => {
                console.log('[战略地图] 州:', f.properties.state, 'geometry类型:', f.geometry.type);
              });
            }
          } catch (e) {
            console.warn('[战略地图] turf.dissolve合并失败:', e);
          }
        }
        
        // 方法2：如果dissolve不可用，用turf.union逐个合并
        if (stateFeatures.length === 0 && typeof window.turf.union === 'function') {
          console.log('[战略地图] 使用turf.union逐个合并');
          const stateGroups = {};
          states.forEach(s => {
            if (!stateGroups[s.state]) stateGroups[s.state] = [];
            stateGroups[s.state].push(s);
          });
          Object.entries(stateGroups).forEach(([stateName, stateCities]) => {
            try {
              const polys = stateCities.map(s => window.turf.polygon([s.ring]));
              let merged = polys[0];
              for (let i = 1; i < polys.length; i++) {
                try {
                  const result = window.turf.union(merged, polys[i]);
                  if (result) merged = result;
                } catch (e) {}
              }
              if (merged && merged.geometry) {
                stateFeatures.push({
                  type: 'Feature',
                  properties: { state: stateName },
                  geometry: merged.geometry
                });
              }
            } catch (e) {
              console.warn('[战略地图] union合并失败:', stateName, e);
            }
          });
          console.log('[战略地图] turf.union合并成功，州数:', stateFeatures.length);
        }
        
        console.log('[战略地图] 最终州数:', stateFeatures.length);

        // 渲染州级边界线（如果合并成功）
        if (stateFeatures.length > 0) {
          stateBorderLayer.selectAll('path').data(stateFeatures).enter().append('path')
            .attr('d', geoPath)
            .attr('fill','rgba(150,120,80,0.06)')
            .attr('stroke','#2a1a05')
            .attr('stroke-width',2.5)
            .attr('stroke-linejoin','round')
            .attr('vector-effect','non-scaling-stroke')
            .attr('pointer-events','none');
          console.log('[战略地图] 渲染州级边界线数量:', stateFeatures.length);
        } else {
          // 合并失败，直接画郡边界
          console.log('[战略地图] 州合并全部失败，直接画郡边界');
          stateBorderLayer.selectAll('path').data(fcWithState.features).enter().append('path')
            .attr('d', geoPath)
            .attr('fill','none')
            .attr('stroke','#3a2a10')
            .attr('stroke-width',1.2)
            .attr('stroke-linejoin','round')
            .attr('vector-effect','non-scaling-stroke')
            .attr('pointer-events','none');
        }
      } catch (err) {
        console.warn('[战略地图] 州级边界渲染失败', err);
      }

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

      // 州名标签（用投影坐标定位，放到overlay里跟随transform）
      stateLabelsDom = [];
      Object.entries(STATE_POSITIONS).forEach(([stateName, pos]) => {
        const el = document.createElement('div');
        el.className = 'strategic-state-label-dom';
        el.textContent = stateName;
        // pos是[经度, 纬度]，用projection计算像素坐标
        const px = projection(pos)[0];
        const py = projection(pos)[1];
        overlay.appendChild(el);
        stateLabelsDom.push({ el, name: stateName, baseX: px, baseY: py });
      });

      function positionOverlay(k) {
        cityMarks.forEach(o => {
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
      }

      // 应用变换
      function applyTransform(t) {
        root.attr('transform', `translate(${t.x},${t.y}) scale(${t.k})`);
        overlay.style.transform = `translate(${t.x}px,${t.y}px)`;
        positionOverlay(t.k);
      }

      // 初始 transform
      if (!render._initDone) {
        render._initDone = true;
        currentTransform = d3.zoomIdentity.translate(30, 60).scale(0.8);
      }
      applyTransform(currentTransform);

      // 暴露给 zoom
      render._apply = applyTransform;
      render._statePaths = statePaths;
    }

    function sealStyle(faction) {
      return `background:${FACTIONS[faction].stroke}`;
    }

    function selectState(d) {
      selectedId = d.properties.id;
      const f = FACTIONS[d.properties.faction];
      info.innerHTML = `
        <div class="strategic-info-h">
          <span class="seal" style="${sealStyle(d.properties.faction)}">${f.label}</span>
          ${d.properties.name}
        </div>
        <div class="strategic-info-b">${d.properties.desc}</div>
      `;
      info.classList.add('show');
    }

    function selectCity(c) {
      const f = FACTIONS[c.owner];
      info.innerHTML = `
        <div class="strategic-info-h">
          <span class="seal" style="${sealStyle(c.owner)}">${f.label}</span>
          ${c.name}${c.capital ? ' · 州治' : ''}
        </div>
        <div class="strategic-info-b">${c.desc || ''}<br/>
          <span style="color:#8a6a3a;font-size:11px;">${c.state} · ${c.grid}×${c.grid}城内</span>
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
        else svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
      });
    });

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

    // 响应式
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const t = currentTransform;
        const cities2 = buildCitiesFromGame();
        loadRegions().then(regionData => {
          render(regionData, cities2);
          if (render._apply) render._apply(t);
        });
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

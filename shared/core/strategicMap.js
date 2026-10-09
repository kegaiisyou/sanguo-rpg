window.LF = window.LF || {};
(function(){
  // 战略地图「游戏集成层」(v20261008i 从 engine.js 抽出)
  // 职责：地图容器 HTML、此身/目标/据点标记计算、D3 三件套懒加载+空闲预取、进局渲染接线。
  // 纯渲染(D3 geoPath/缩放/描边)仍在 shared/strategic-map.js，本模块不重复其逻辑。
  LF.createStrategicMap = function(ctx){
    var LF = ctx.LF;
    var getState = ctx.getState;
    var G = ctx.G;
    var _wf = function(getter){
      return function(){ var fn = getter(); return fn.apply(null, arguments); };
    };
    var curRoom = _wf(ctx.getCurRoom), isBldRoom = _wf(ctx.getIsBldRoom), cityOwnerOf = _wf(ctx.getCityOwnerOf),
        closeModal = _wf(ctx.getCloseModal), renderRoom = _wf(ctx.getRenderRoom), save = _wf(ctx.getSave),
        log = _wf(ctx.getLog), goRoomOnMap = _wf(ctx.getGoRoomOnMap), placeInfo = _wf(ctx.getPlaceInfo);
function buildStrategicMapHTML(opts){
    opts=opts||{};
    var title = opts.pickSpawn ? '选择出生点' : '山河志 · 战略地图';
    var tip = opts.pickSpawn
      ? '与山河志同一张地图：点圆点=城池、方点=关隘/野地/副本。点击任一点即设为出生点并立即传送（城市出生落在城门）。'
      : '拖拽平移 · 滚轮缩放 · 点击城池前往（体力-4 · 食物-1 · 饮水-1 · 时间+1刻）。当前位于「'+curRoom().name+'」；点右下 ◎ 可回到所在处。';
    return '<h3>'+title+'</h3>'+
      '<div id="strategic-map-container"></div>'+
      '<p class="tip">'+tip+'</p>';
  }
  // 解析「此身所在」的地图标记：
  //   城内/城格 → 城点；城内建筑 → 所属城；specialGeo 手写锚点房 → 该地理点
  function smYouMark(){
    if(!getState() || !getState().room) return null;
    var rid=getState().room;
    if(isBldRoom(rid)){
      var back=getState().flags && getState().flags.bldEnt && getState().flags.bldEnt.back;
      if(back && back.kind==='city' && back.cid){
        var _bc=(LF.CITIES||{})[back.cid];
        if(_bc && _bc.pos) return {type:'you', pos:_bc.pos, cid:back.cid, label:'此身所在 · '+_bc.name};
      }
      return null;
    }
    var c=(LF.CITIES||{})[rid];
    if(c && c.pos) return {type:'you', pos:c.pos, cid:rid, label:'此身所在 · '+c.name};
    var sg=((LF.MAP&&LF.MAP.specialGeo)||{})[rid];
    if(sg && sg.pos) return {type:'you', pos:sg.pos, cid:rid, label:'此身所在 · '+sg.name};
    // 郊野行军格：按「母城 → 外邻各点均值」线性插值打点，表明正行于哪片郊野
    var _cr=G.ROOMS[rid];
    if(_cr && _cr.isField && _cr.fieldId){
      var _fp=(LF.PLACES||{})[_cr.fieldId]||{};
      var _par=_fp.parent;
      var _cpos=null;
      if((LF.CITIES||{})[_par] && LF.CITIES[_par].pos) _cpos=LF.CITIES[_par].pos;
      else if((LF.PLACES||{})[_par] && LF.PLACES[_par].pos) _cpos=LF.PLACES[_par].pos;
      var _fmeta=((LF.Travel&&LF.Travel.fields)||{})[_cr.fieldId]||{};
      // v20260907d：多段郊野链的中段 neighbors 是指向「下一程入口房」的虚拟邻点（无真实经纬）。
      // 沿链递归到末段，收集真实邻城/邻地点的坐标作为外端点；endStage 用于按「段序+段内进度」全局插值，
      // 使中段「此身所在」打点不再从战略图消失，且位置沿母城→外端点连续推进。
      var _posList=[], _endStage=_fmeta.stage||0;
      (function walk(m){
        ((m.neighbors)||[]).forEach(function(n){
          var _p=((LF.CITIES&&LF.CITIES[n.nid]&&LF.CITIES[n.nid].pos)?LF.CITIES[n.nid].pos
                :((LF.PLACES&&LF.PLACES[n.nid]&&LF.PLACES[n.nid].pos)?LF.PLACES[n.nid].pos:null));
          if(_p){ _posList.push(_p); return; }
          var _nr=G.ROOMS[n.nid], _ff=_nr&&_nr.fieldId;
          if(_ff && LF.Travel && LF.Travel.fields && LF.Travel.fields[_ff]){
            var _nx=LF.Travel.fields[_ff];
            if((_nx.stage||0)>_endStage) _endStage=_nx.stage||0;
            if(_endStage<=8) walk(_nx);
          }
        });
      })(_fmeta);
      if(_cpos && _posList.length){
        var _g=_fp.gateDir||'东';
        var _geo=LF.Travel.fieldGeometry(_fp.size||4,_g);
        var _near=(_g==='东'||_g==='西')?_geo.nearCol:_geo.nearRow;
        var _ax=(_g==='东'||_g==='西')?_cr.fc:_cr.fr;
        var _den=(_fp.size||4)-1;
        var _t=(_den<=0)?0.5:(((_g==='东'||_g==='南')?(_ax-_near):(_near-_ax))/_den);
        _t=Math.max(0,Math.min(1,_t));
        var _s=_fmeta.stage||0, _glb=(_s+_t)/(_endStage+1);
        var _ox=0,_oy=0; _posList.forEach(function(p){ _ox+=p[0]; _oy+=p[1]; });
        _ox/=_posList.length; _oy/=_posList.length;
        return {type:'you', pos:[_cpos[0]+(_ox-_cpos[0])*_glb, _cpos[1]+(_oy-_cpos[1])*_glb],
                cid:_cr.fieldId, label:'此身所在 · '+((_fp.name)||'郊野')};
      }
    }
    return null;
  }
  // 主线/任务目标打点（后续支线目标可在此追加）
  function smGoalMarks(){
    var marks=[];
    if(getState() && getState().quest && getState().quest.luoyang){
      var lc=(LF.CITIES||{}).luoyang;
      if(lc && lc.pos) marks.push({type:'goal', pos:lc.pos, cid:'luoyang', label:'目标 · 赴洛阳'});
    }
    // 治下之城（据城而定/扫平群雄的成果）：朱红「据」章
    var held = getState() && getState().ruledCities;
    if(held && held.length){
      var C=LF.CITIES||{};
      held.forEach(function(cid){
        var c=C[cid];
        if(c && c.pos) marks.push({type:'hold', pos:c.pos, cid:cid, label:'据 · '+c.name});
      });
    }
    return marks;
  }
  function strategicMapMarks(){
    var out=[];
    var y=smYouMark(); if(y) out.push(y);
    smGoalMarks().forEach(function(x){ out.push(x); });
    return out;
  }
  // 运行时归属读取器：让山河志城市点/详情随易主实时变色（v20260909o）
  function strategicOwnerOf(cid){ try{ return cityOwnerOf(cid); }catch(e){ return null; } }
  // 战略地图懒加载（v20260919f）：d3 / map_regions / strategic-map 三件套体积大（d3 ~280KB），
  // 仅在首次开图时才注入，避免首屏下载/解析这些用户可能永远用不到的资源。
  // 资源 URL 清单放在 index.html 的 window.__MAP_ASSETS（版本号随对应文件走，便于统一 bump）。
  function _loadMapAsset(src){
    return new Promise(function(res, rej){
      var s=document.createElement('script'); s.src=src; s.async=true;
      s.onload=function(){ res(); };
      s.onerror=function(){ rej(new Error('地图资源加载失败: '+src)); };
      document.head.appendChild(s);
    });
  }
  // P0-①：战略图三件套改为并行加载（原串行 chain：d3→regions→sm 顺序等待）
  // 并行后首次开图等待从「三者之和」降到「最慢一项」，配合下方空闲预取即可秒开。
  function ensureStrategicMap(){
    if(window.__MAP_READY) return window.__MAP_READY;
    var A=window.__MAP_ASSETS;
    if(A && window.d3 && window.LF && LF.REGIONS && LF.initStrategicMap){ window.__MAP_READY=Promise.resolve(); return window.__MAP_READY; }
    window.__MAP_READY=new Promise(function(resolve, reject){
      // v20260928g：d3/regions 先就绪，再加载 strategic-map —— 旧版 Promise.all 三件套并行，
      //   无缓存时 strategic-map.js 先执行、内部顶层引用 d3 报 "d3 is not defined"（本地必现）。
      var p1 = (!A || !window.d3) ? _loadMapAsset(A?A.d3:'shared/vendor/d3.min.js') : Promise.resolve();
      var p2 = (!A || !(window.LF && LF.REGIONS)) ? _loadMapAsset(A?A.regions:'shared/data/map_regions.js') : Promise.resolve();
      Promise.all([p1, p2]).then(function(){
        // v20261008g：几何基础（LF.StratGeom）先就位，再加载 strategic-map
        //   —— sm 顶层即执行 `var convexHull = SG.convexHull` 取别名，geo 未加载会静默取到 undefined。
        if(A && !(window.LF && LF.StratGeom)) return _loadMapAsset(A.geo||'shared/strategic-geometry.js');
      }).then(function(){
        if(!A || !(window.LF && LF.initStrategicMap)) return _loadMapAsset(A?A.sm:'shared/strategic-map.js');
      }).then(resolve, reject);
    });
    return window.__MAP_READY;
  }
  // P0-①：进入游戏后利用浏览器空闲时段预取战略图三件套，使玩家点开山河志时资源已就绪（不阻塞首屏/序章）
  function prefetchStrategicMap(){
    try{
      if(window.__MAP_READY) return;
      var ric=window.requestIdleCallback||function(cb){ return setTimeout(cb, 1400); };
      ric(function(){ ensureStrategicMap().catch(function(){}); }, {timeout:5000});
    }catch(e){}
  }
  function initStrategicMapInGame(opts){
    opts=opts||{};
    var container=document.getElementById('strategic-map-container');
    if(!container) return;
    function render(){
      var marks=strategicMapMarks();
      // 选出生点模式
      if(opts.pickSpawn){
        LF.initStrategicMap(container, {
          marks: marks,
          ownerOf: strategicOwnerOf,
          onCityClick: function(city){
            if(!city || !city.id) return;
            getState().spawnRoom=city.id;
            log('【调试】出生点已设为：'+city.name+'。','good');
            closeModal(); renderRoom(city.id); save(getState());
          }
        });
      } else {
        // 正常模式：点击城市点=显示详情（placeInfo）；点详情面板「前往此城」= goRoomOnMap 传送（v20260918a 接线）
        LF.initStrategicMap(container, {
          marks: marks,
          focusYou: !!opts.focusYou,
          ownerOf: strategicOwnerOf,
          onCityClick: function(city){
            if(!city || !city.id) return;
            placeInfo(city.id, city.name, city.kind, city.state, city.desc, city.owner, city.isPlace);
          },
          onCityGo: function(city){
            if(!city || !city.id) return;
            goRoomOnMap(city.id);
          }
        });
      }
    }
    if(window.LF && LF.initStrategicMap && window.d3 && LF.REGIONS){
      render(); return;
    }
    container.innerHTML='<div class="strategic-loading">战略地图加载中...</div>';
    ensureStrategicMap().then(function(){
      if(window.LF && LF.initStrategicMap && window.d3 && LF.REGIONS) render();
      else container.innerHTML='<div class="strategic-loading">战略地图加载失败，请刷新重试</div>';
    }).catch(function(){
      container.innerHTML='<div class="strategic-loading">战略地图加载失败，请刷新重试</div>';
    });
  }

      return { buildStrategicMapHTML: buildStrategicMapHTML, smYouMark: smYouMark, smGoalMarks: smGoalMarks,
             strategicMapMarks: strategicMapMarks, strategicOwnerOf: strategicOwnerOf,
             ensureStrategicMap: ensureStrategicMap, prefetchStrategicMap: prefetchStrategicMap,
             initStrategicMapInGame: initStrategicMapInGame };
  };
})();

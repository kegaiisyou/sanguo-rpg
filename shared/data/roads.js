// 路网自动生成（系统统一管理：作者只摆 pos，边由坐标算）
// 输出 LF.ROADS: { nodes, edges, adj, route(a,b), li(a,b) }
//   nodes  地点 id -> [lng,lat]
//   edges  边列表 { a,b,li(汉里),type(road/pass/water/mountain),risk(0~1) }
//   adj    邻接表（行军 A* 用）
//   route  两地点间最短(按里)路线 + 逐段 legs + 总里数
// 策略：每个地点连最近 K 个邻居形成连通路网；关卡 controls 声明的直连拆成经关口两段。
(function(global){
  global.LF = global.LF || {};
  var P = global.LF.PLACES || {};
  var KINDS = global.LF.PLACE_KINDS || {};

  // 经纬度 -> 近似大圆距离(km)，再换算汉里(1km≈2汉里，游戏手感)
  function distKm(a, b){
    var R = 6371;
    var dLat = (b[1]-a[1]) * Math.PI/180, dLng = (b[0]-a[0]) * Math.PI/180;
    var la1 = a[1]*Math.PI/180, la2 = b[1]*Math.PI/180;
    var h = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return 2*R*Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function toLi(km){ return Math.round(km*2); }

  function edgeType(a, b){
    if (KINDS[a.kind] && KINDS[a.kind].isPass) return 'pass';
    if (KINDS[b.kind] && KINDS[b.kind].isPass) return 'pass';
    return a.roadType || b.roadType || 'road';
  }
  function edgeRisk(a, b, li, type){
    var r = Math.min(0.9, li/3000);            // 路程越长越险
    [a, b].forEach(function(p){
      if (p.kind === 'wild') r += 0.15;
      if (p.kind === 'landmark' && p.isBattlefield) r += 0.10;
      if (p.kind === 'dungeon') r += 0.20;
    });
    if (type === 'pass') r += 0.05;
    return Math.min(0.95, r);
  }

  // 仅取有坐标、且非“仅入口进入”的地点(dungeon/story 经 entry 进入，不进路网)
  var ids = Object.keys(P).filter(function(id){
    var p = P[id];
    return p.pos && p.pos.length === 2 && p.kind !== 'dungeon' && p.kind !== 'story';
  });
  var nodes = {}; ids.forEach(function(id){ nodes[id] = P[id].pos; });
  var adj = {}; ids.forEach(function(id){ adj[id] = []; });
  var edges = [];

  function addEdge(a, b){
    if (!nodes[a] || !nodes[b]) return;
    if (adj[a].some(function(e){ return e.to === b; })) return;
    var li = toLi(distKm(nodes[a], nodes[b]));
    var t = edgeType(P[a], P[b]);
    var edge = { a:a, b:b, li:li, type:t, risk:edgeRisk(P[a], P[b], li, t) };
    edges.push(edge);
    adj[a].push({ to:b, li:li, edge:edge });
    adj[b].push({ to:a, li:li, edge:edge });
  }
  function removeEdge(a, b){
    if (adj[a]) adj[a] = adj[a].filter(function(e){ return e.to !== b; });
    if (adj[b]) adj[b] = adj[b].filter(function(e){ return e.to !== a; });
    edges = edges.filter(function(e){ return !((e.a===a&&e.b===b) || (e.a===b&&e.b===a)); });
  }

  // 最近 K 邻居连边（K=3，形成连通路网，避免全连接爆炸）
  var K = 3;
  ids.forEach(function(a){
    var nb = ids.filter(function(b){ return b !== a; })
      .map(function(b){ return { b:b, li:toLi(distKm(nodes[a], nodes[b])) }; })
      .sort(function(x, y){ return x.li - y.li; })
      .slice(0, K);
    nb.forEach(function(d){ addEdge(a, d.b); });
  });

  // 关卡 chokepoint：controls 声明的直连拆成经关口两段
  Object.keys(P).forEach(function(id){
    var pl = P[id];
    if (pl.controls && Array.isArray(pl.controls)){
      pl.controls.forEach(function(pair){
        var x = pair[0], y = pair[1];
        if (nodes[x] && nodes[y]){ removeEdge(x, y); addEdge(x, id); addEdge(id, y); }
      });
    }
  });

  // A* 寻路（按里数），返回 { path, legs, totalLi }
  function route(a, b){
    if (!adj[a] || !adj[b]) return null;
    var g = {}, f = {}, prev = {}, open = {};
    open[a] = true; g[a] = 0; f[a] = 0;
    while (Object.keys(open).length){
      var cur = null, best = Infinity;
      Object.keys(open).forEach(function(n){ if (f[n] < best){ best = f[n]; cur = n; } });
      delete open[cur];
      if (cur === b) break;
      adj[cur].forEach(function(e){
        var ng = g[cur] + e.li;
        if (g[e.to] === undefined || ng < g[e.to]){
          g[e.to] = ng; prev[e.to] = cur; f[e.to] = ng; open[e.to] = true;
        }
      });
    }
    if (g[b] === undefined) return null;
    var path = [b], c = b;
    while (c !== a){ c = prev[c]; if (c === undefined) return null; path.unshift(c); }
    var legs = [];
    for (var i = 0; i < path.length - 1; i++){
      var ea = path[i], eb = path[i+1];
      var ed = adj[ea].filter(function(e){ return e.to === eb; })[0];
      legs.push({ a:ea, b:eb, li:ed.li, type:ed.edge.type, risk:ed.edge.risk });
    }
    return { path:path, legs:legs, totalLi:g[b] };
  }
  function li(a, b){ var r = route(a, b); return r ? r.totalLi : null; }

  global.LF.ROADS = { nodes:nodes, edges:edges, adj:adj, route:route, li:li };
})(typeof window !== 'undefined' ? window : globalThis);

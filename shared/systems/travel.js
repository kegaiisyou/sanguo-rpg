// systems/travel.js — 行军 / 郊野旅行系统（玩家单人 RPG 向，v20260904m）
// 职责：
//   build()  读取 LF.PLACES + LF.ROADS，按路况在每对相邻地点之间生成「郊野(field)」区域骨架，
//            写入 LF.PLACES(kind:'field'，无 pos，不污染战略图) 与 LF.PLACE_GATES[地点][方位]=郊野 id。
//   link()   房间生成完毕后，把郊野网格「近边入口」连回母地点（用 __gate__ 哨兵，到达时落到对应城门），
//            「远边出口」按 sub-bearing 分支连到邻地点，完成 城门↔郊野↔邻城 的真实罗盘通路。
// 数据契约（供后续 军队扎营 / 资源开采 复用）：room.resources / room.monsters / room.fieldNpcs。
// 依赖：LF.PLACES / LF.PLACE_KINDS / LF.ROADS（均已在 index.html 中先于本文件加载）；
//       母地点「可用城门方向」由 index.html 注入 LF.Travel._gateDirs（需 genCityGrid 等游戏函数）。
(function(global){
  global.LF = global.LF || {};
  var P = global.LF.PLACES || {};
  var KINDS = global.LF.PLACE_KINDS || {};
  var ROADS = global.LF.ROADS || {};

  // —— 方位工具 ——
  var CARD = ['北','东','南','西'];
  var OPP = { '北':'南','南':'北','东':'西','西':'东' };
  function opp(d){ return OPP[d]; }
  // 地理 delta(lng,lat) → 屏幕向量（北=上=-y，东=右=+x）
  function geoVec(a, b){
    var latR = (a[1]||0) * Math.PI/180;
    return [ (b[0]-a[0]) * Math.cos(latR), -(b[1]-a[1]) ];
  }
  function quantize4(vx, vy){
    if(Math.abs(vx) > Math.abs(vy)) return vx>=0 ? '东' : '西';
    return vy>=0 ? '南' : '北';
  }
  var DIRV = { '北':[0,-1],'南':[0,1],'东':[1,0],'西':[-1,0] };
  function dirVec(d){ return DIRV[d]; }
  function perpVec(d){ return (d==='东'||d==='西') ? [0,1] : [1,0]; }
  function angNorm(a){ while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; return a; }
  function nearestGateDir(gdirs, v){
    var best=gdirs[0], bestAng=Infinity;
    var va=Math.atan2(v[1], v[0]);
    gdirs.forEach(function(d){
      var dv=dirVec(d), da=Math.atan2(dv[1], dv[0]);
      var diff=Math.abs(angNorm(va-da));
      if(diff<bestAng){ bestAng=diff; best=d; }
    });
    return best;
  }
  // 某方位与向量 v 的最小夹角（用于把关卡的内部出口占用的方位，避让到最近的空闲方位）
  function angDiff(cardDir, v){
    var dv = dirVec(cardDir);
    var va = Math.atan2(v[1], v[0]);
    var da = Math.atan2(dv[1], dv[0]);
    return Math.abs(angNorm(va - da));
  }
  // 城门郊野分组：把邻点归到「真能朝外通到它」的开门（该方向轴向分量 >0 中夹角最近者）。
  // 旧版先按四方向量化再就近补门，邻点恰在门角平分/量化 tie 时会被塞进背向的门郊野，
  // 使 link() 因 along<=0 跳过 → 城↔城 单向断头、无法穿野入城。
  // 若无任何开门朝向该邻点（如山城只开两门而邻点在背侧），退回最近门，物理上不可达属合理。
  function pickOutwardGate(gdirs, v){
    var best=null, bestA=Infinity;
    for(var i=0;i<gdirs.length;i++){
      var d=gdirs[i], dv=dirVec(d);
      if(v[0]*dv[0]+v[1]*dv[1]<=0) continue;   // 沿轴向分量≤0：此门背向邻点，不选
      var a=angDiff(d,v);
      if(a<bestA){ bestA=a; best=d; }
    }
    return best || nearestGateDir(gdirs, v);
  }

  // 郊野几何：给定 size 与母地点在外侧的方向 gateDir（郊野坐落在母地点该侧）。
  // 近边 = 朝向母地点的一侧（入口格）；远边 = 朝外一侧（按方位分支到邻点）。
  function fieldGeometry(size, gateDir){
    var N = size;
    var nearCol, farCol, nearRow, farRow;
    if(gateDir==='东'){ nearCol=0; farCol=N-1; }
    else if(gateDir==='西'){ nearCol=N-1; farCol=0; }
    else if(gateDir==='南'){ nearRow=0; farRow=N-1; }
    else { nearRow=N-1; farRow=0; } // 北
    var entryR=Math.floor(N/2), entryC=Math.floor(N/2);
    if(gateDir==='东'||gateDir==='西') entryC=nearCol; else entryR=nearRow;
    return { N:N, gateDir:gateDir, nearCol:nearCol, farCol:farCol,
             nearRow:nearRow, farRow:farRow, entryR:entryR, entryC:entryC };
  }
  function roomId(fid, r, c){ return fid + '@' + r + '_' + c; }

  // 确定性随机（按 field id + 格坐标 播种，保证每次生成一致、可与存档对应）
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function hashStr(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

  // 内容表（供行军/遭遇引擎消费；后续军队/开采也读这里）
  // item 字段 = 采集后真实入包的物品 defId（须在 LF.ITEMS 中定义）
  var RES = [
    {type:'herb',  name:'草药',   item:'caoyao'},
    {type:'ore',   name:'铁矿石', item:'tiekuangshi'},
    {type:'wood',  name:'木头',   item:'mutou'},
    {type:'berry', name:'野果',   item:'yeguo'}
  ];
  var MON = [
    {id:'bandit',        name:'山贼',     aggr:'hostile'},
    {id:'yellow_turban', name:'黄巾散卒', aggr:'hostile'},
    {id:'wild_wolf',     name:'野狼',     aggr:'neutral'},
    {id:'wild_boar',     name:'野彘',     aggr:'flee'}
  ];
  var NPCS = [ {type:'trader', name:'行商'}, {type:'refugee', name:'流民'} ];

  // 散布：返回 {resources, monsters, npcs}（入口格保持清爽，便于进出）
  function scatterContent(rng, p, r, c, isEntry){
    var res=[], mon=[], npc=[];
    var DEF = (global.LF.PLACE_DEFAULTS && global.LF.PLACE_DEFAULTS.field) || {};
    var richness = (p.richness!=null)? p.richness : (DEF.richness!=null?DEF.richness:0.5);
    var risk = (p.risk!=null)? p.risk : (DEF.risk!=null?DEF.risk:0.3);
    var x = rng();
    if(x < 0.16*richness + (isEntry?0:0.04)){
      var rt = RES[Math.floor(rng()*RES.length)];
      res.push({ type:rt.type, name:rt.name, item:rt.item, amt: 1+Math.floor(rng()*3) });
    }
    var y = rng();
    if(y < 0.20*risk + (isEntry?0:0.05)){
      var mt = MON[Math.floor(rng()*MON.length)];
      mon.push({ id:mt.id, name:mt.name, aggr:mt.aggr, lvl: 1+Math.floor(rng()*3) });
    }
    var z = rng();
    if(z < 0.06){ var nt = NPCS[Math.floor(rng()*NPCS.length)]; npc.push({ type:nt.type, name:nt.name }); }
    return { resources:res, monsters:mon, npcs:npc };
  }

  // —— 构建郊野骨架（在 PLACES / ROADS 就绪后由 index.html 调用）——
  var fields = {};        // fieldId -> meta
  var PLACE_GATES = {};    // placeId -> { dir: fieldId }
  var _built = false;

  function build(){
    if(_built) return;
    P = global.LF.PLACES || {};
    ROADS = global.LF.ROADS || {};
    var T = global.LF.Travel;
    function ensureGate(placeId, dir){
      if(!PLACE_GATES[placeId]) PLACE_GATES[placeId] = {};
      if(PLACE_GATES[placeId][dir]) return PLACE_GATES[placeId][dir];
      var fid = 'fld_' + placeId + '_' + dir;
      PLACE_GATES[placeId][dir] = fid;
      return fid;
    }
    Object.keys(P).forEach(function(pid){
      var pl = P[pid];
      if(!pl || !pl.pos || pl.pos.length!==2) return;
      if(pl.kind==='dungeon' || pl.kind==='story') return;   // 经 entry 进入，不走路网
      var edges = (ROADS.adj && ROADS.adj[pid]) || [];
      if(!edges.length) return;
      var isCityType = KINDS[pl.kind] && KINDS[pl.kind].isCityType;
      var isGridCity = isCityType && LF.CITIES[pid] && LF.CITIES[pid].grid;
      // 收集有效邻居
      var nbs = edges.map(function(e){
        var np = P[e.to];
        if(!np || !np.pos || np.kind==='dungeon' || np.kind==='story') return null;
        var v = geoVec(pl.pos, np.pos);
        return { nid:e.to, v:v, d:quantize4(v[0], v[1]) };
      }).filter(Boolean);
      if(!nbs.length) return;

      function createField(dir, list){
        var fid = ensureGate(pid, dir);
        var geo = fieldGeometry(4, dir);
        var entryR = roomId(fid, geo.entryR, geo.entryC);
        fields[fid] = { id:fid, place:pid, dir:dir, neighbors:list, size:4 };
        if(!P[fid]){
          P[fid] = {
            id:fid, kind:'field', name: pl.name + (isCityType ? '·'+dir+'郊野' : '·郊野'),
            state: pl.state, owner: pl.owner||'neutral', open:true, _seed:'field',
            size:4, gateDir:dir, seed: hashStr(fid), parent: pid, parentDir:dir,
            entryRoom: entryR
          };
          // 注意：不设 pos，避免污染战略图点位
        }
      }

      if(isGridCity){
        // 真城市：按各城门方向（可用城门集合）生成郊野，回城由 currentRoomExits 动态处理
        // v20260905l：郊野元数据只收纳「真能朝外走到」的邻点。单门/限门城把部分邻点背向
        // 所有开门时，pickOutwardGate 会兜底塞进最近门郊野，但 link() 远边 along<=0 本就跳过、
        // 走不出去 → 该邻点成了「列了却到不了」的假可达目标（误导城门罗盘/自动行军）。
        // 这里在分组时就剔除背向成员：meta.neighbors 严格等于「从此郊野远边真能抵达」的集合。
        var gdirs = (T._gateDirs ? T._gateDirs(pid) : CARD);
        var byDir = {};
        nbs.forEach(function(nb){
          var d = pickOutwardGate(gdirs, nb.v);
          var dv = dirVec(d);
          if(nb.v[0]*dv[0] + nb.v[1]*dv[1] <= 0) return;   // 背向该门：物理不可达，不入组
          (byDir[d] = byDir[d] || []).push(nb);
        });
        Object.keys(byDir).forEach(function(d){ createField(d, byDir[d]); });
      } else {
        // 非城地点：把邻居分配到「空闲方位」(避开内部出口)，每空闲方位一块郊野；重要(城市)邻居优先占用空闲方位
        var occ = (pl.kind==='fort' || pl.kind==='pass') ? ['北','东'] : [];
        var free = CARD.filter(function(d){ return occ.indexOf(d)<0; });
        if(!free.length) return;
        nbs.sort(function(a,b){
          var ca = (KINDS[(P[a.nid]||{}).kind] && KINDS[(P[a.nid]||{}).kind].isCityType)?1:0;
          var cb = (KINDS[(P[b.nid]||{}).kind] && KINDS[(P[b.nid]||{}).kind].isCityType)?1:0;
          if(ca!==cb) return cb-ca;
          return Math.hypot(a.v[0],a.v[1]) - Math.hypot(b.v[0],b.v[1]);
        });
        var groups = {}; free.forEach(function(d){ groups[d]=[]; });
        nbs.forEach(function(nb){
          var best = free.reduce(function(b,d){ return angDiff(d, nb.v) < angDiff(b, nb.v) ? d : b; }, free[0]);
          groups[best].push(nb);
        });
        free.forEach(function(d){ if(groups[d].length) createField(d, groups[d]); });
      }
    });
    global.LF.PLACE_GATES = PLACE_GATES;   // 供 index.html 城门罗盘读取
    _built = true;
  }

  // —— 连接郊野内外出口（房间生成完毕后由 index.html 调用）——
  var _linked = false;
  function freeCardinal(room, pref){
    if(!room.exits) room.exits = {};
    if(!room.exits[pref]) return pref;
    for(var i=0;i<CARD.length;i++){ if(!room.exits[CARD[i]]) return CARD[i]; }
    return pref;
  }
  function link(){
    if(_linked) return;
    // G 宿主：index.html 中 var G = window.LF.SharedGame（局部），未暴露为 window.G；
    // 故回退到 global.LF.(SharedGame|LF)，确保浏览器真机与 Node 校验都能取到房间表。
    var G = global.G || (global.LF && (global.LF.SharedGame || global.LF));
    if(!G || !G.ROOMS) return;
    var ROOMS = G.ROOMS;
    var claimed = {};   // roomId -> { cardinal:true } 记录本函数设置的出口，避免多个郊野争抢同一方位导致互相覆盖
    function pickDir(roomId, pref){
      var r = ROOMS[roomId]; if(r && !r.exits) r.exits = {};
      var cm = claimed[roomId] || {};
      if((!r || !r.exits[pref]) && !cm[pref]) return pref;
      for(var i=0;i<CARD.length;i++){ var d=CARD[i]; if((!r || !r.exits[d]) && !cm[d]) return d; }
      return null;   // 无空闲方位：返回 null，由调用方跳过（绝不覆盖已有出口，避免数据损坏）
    }
    // 第一遍：入口↔母地点（父房出口优先占用方位，确保父房→郊野双向连通）
    Object.keys(fields).forEach(function(fid){
      var meta = fields[fid];
      var pid = meta.place, dir = meta.dir, N = meta.size;
      var geo = fieldGeometry(N, dir);
      var entryId = roomId(fid, geo.entryR, geo.entryC);
      var entryRoom = ROOMS[entryId];
      if(!entryRoom) return;
      entryRoom.exits = entryRoom.exits || {};
      var pk = (P[pid] && P[pid].kind) || '';
      var isCityParent = KINDS[pk] && KINDS[pk].isCityType;
      if(isCityParent && LF.CITIES[pid] && LF.CITIES[pid].grid){
        // 真·城市（有城格）：由 currentRoomExits 动态生成「出城」出口，入口只留哨兵回城
        entryRoom.exits[opp(dir)] = '__gate__:' + pid + ':' + dir;
      } else {
        var pr = ROOMS[pid];
        if(pr){
          pr.exits = pr.exits || {};
          var inDir = pickDir(pid, dir);
          if(inDir){
            claimed[pid] = claimed[pid] || {}; claimed[pid][inDir] = true;
            pr.exits[inDir] = entryId;
            entryRoom.exits[opp(inDir)] = '__gate__:' + pid + ':' + dir;
          } else {
            // 父房方位已满：仅保留入口→父房哨兵（单向），不强行占用，避免破坏其它出口
            entryRoom.exits[opp(dir)] = '__gate__:' + pid + ':' + dir;
          }
        } else {
          entryRoom.exits[opp(dir)] = '__gate__:' + pid + ':' + dir;
        }
      }
    });
    // 第二遍：远边各格按 sub-bearing 分支到邻地点（v20260905j）
    // 旧版逐个邻点直接写 cell.exits[dir]，同一远野格被多个邻点共享时「后写覆盖先写」，
    // 导致部分城↔城路径（如 洛阳东郊野→河内 被 lvboshe 占格）丢失入城哨兵、穿野无法入城。
    // 现改为：外向邻点按投影排序后逐格独占分配（冲突向外就近寻空槽），保证每个邻点都有唯一出野口。
    Object.keys(fields).forEach(function(fid){
      var meta = fields[fid];
      var dir = meta.dir, N = meta.size;
      var geo = fieldGeometry(N, dir);
      var entryId = roomId(fid, geo.entryR, geo.entryC);
      var colAxis = (dir==='东'||dir==='西');
      var axis = dirVec(dir), perp = perpVec(dir);
      // 预分配：邻点沿远边排布的期望槽位（按横向投影 t 排序，稳定可复现）
      var cands = [];
      meta.neighbors.forEach(function(nb){
        var along = nb.v[0]*axis[0] + nb.v[1]*axis[1];
        if(along<=0) return;                       // 邻点不在该门朝外一侧，物理不可达，跳过
        var proj = nb.v[0]*perp[0] + nb.v[1]*perp[1];
        var len = Math.hypot(nb.v[0], nb.v[1]) || 1;
        var t = Math.max(-1, Math.min(1, proj/len));
        cands.push({ nb:nb, t:t, want: Math.round((t+1)/2*(N-1)) });
      });
      cands.sort(function(a,b){ return a.t - b.t; });
      var usedIdx = {};
      cands.forEach(function(o){
        var want = o.want, slot = null;
        for(var off=0; off<N && slot===null; off++){
          var c1=want-off, c2=want+off;
          if(c1>=0 && c1<N && !usedIdx[c1]) slot=c1;
          else if(c2>=0 && c2<N && !usedIdx[c2]) slot=c2;
        }
        if(slot===null) return;                    // 远野槽已满（极端情形），略过
        usedIdx[slot] = 1;
        var cellId = colAxis ? roomId(fid, slot, geo.farCol) : roomId(fid, geo.farRow, slot);
        var cell = ROOMS[cellId]; if(!cell) return;
        cell.exits = cell.exits || {};
        var nb = o.nb, nid = nb.nid, nk = (P[nid] && P[nid].kind) || '';
        var isCityN = KINDS[nk] && KINDS[nk].isCityType;
        var tgt;
        if(isCityN){
          tgt = '__gate__:' + nid + ':' + opp(dir);     // 到达邻城时落到朝向本郊野的城门
        } else {
          tgt = nid;                                    // 非城地点直接进其房
          var nr = ROOMS[nid];
          if(nr){ nr.exits = nr.exits || {}; var bdir = pickDir(nid, opp(dir)); if(bdir){ claimed[nid]=claimed[nid]||{}; claimed[nid][bdir]=true; nr.exits[bdir] = entryId; } } // 回程出口（方位满则跳过，沿用旧语义回到郊野入口）
        }
        cell.exits[dir] = tgt;
      });
    });
    _linked = true;
  }

  global.LF.Travel = {
    build: build,
    link: link,
    fields: fields,
    fieldGeometry: fieldGeometry,
    roomId: roomId,
    scatterContent: scatterContent,
    gateTarget: function(placeId, dir){ return (PLACE_GATES[placeId] && PLACE_GATES[placeId][dir]) || null; },
    setGateDirs: function(fn){ this._gateDirs = fn; },
    RES: RES, MON: MON, NPCS: NPCS
  };
})(typeof window !== 'undefined' ? window : globalThis);

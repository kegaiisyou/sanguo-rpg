// 乱世烽火 · 移动与方向罗盘（v20261008s 自 shared/core/engine.js 拆出）
// Dock 上方常驻方向罗盘 + 城门进出 + 郊野/城格行走。含：renderMoveBar / renderSelf /
// currentRoomExits / availableGateDirs / gateOutwardDir / gateCellCoord / nearestGateCell /
// gateCurfew / arriveAtGate / leaveViaGate / exitDisplayName / move。
//
// 依赖经 ctx 注入；state 与 combatMode 是会被引擎重新赋值的可变绑定，
// 故以 getState() / getCombatMode() getter 形式注入（簇内全部只读，无写回）。
// DIR_ARROW / DIR_GRID 在本模块内自持（与 companion.js 导出值一致）。
(function (global) {
  var LF = global.LF || (global.LF = {});
  LF.createMovement = function (ctx) {
    var getState = ctx.getState, getCombatMode = ctx.getCombatMode,
        G = ctx.G, WEATHERS = ctx.WEATHERS, wxEff = ctx.wxEff, toast = ctx.toast,
        openLearn = ctx.openLearn, autoOnbRoutines = ctx.autoOnbRoutines, exert = ctx.exert,
        mkAct = ctx.mkAct, renderRoom = ctx.renderRoom, roomCanLearn = ctx.roomCanLearn,
        genCityGrid = ctx.genCityGrid,
        cellDisplayType = ctx.cellDisplayType,
        log = ctx.log,
        canEnterCell = ctx.canEnterCell,
        advanceMinutes = ctx.advanceMinutes,
        isBldRoom = ctx.isBldRoom,
        isCityGrid = ctx.isCityGrid,
        cellDisplayName = ctx.cellDisplayName,
        setOnBoat = ctx.setOnBoat,
        hourLabel = ctx.hourLabel,
        roomIsBoatRoute = ctx.roomIsBoatRoute,
        bldForRoom = ctx.bldForRoom,
        bldMove = ctx.bldMove,
        leaveBldRoom = ctx.leaveBldRoom,
        bldRoom = ctx.bldRoom,
        cityGateDirs = ctx.cityGateDirs,
        isCurfewHour = ctx.isCurfewHour,
        interactBusy = ctx.interactBusy,
        save = ctx.save,
        cellLockedHere = ctx.cellLockedHere,
        goCell = ctx.goCell,
        isOnBoat = ctx.isOnBoat, roomObjs = ctx.roomObjs, fieldPlacedCamps = ctx.fieldPlacedCamps;

  // ===== 常驻移动区：Dock 上方方向罗盘（位置即方位，永远可见） =====
  var DIR_ARROW={'北':'↑','南':'↓','东':'→','西':'←','东北':'↗','西北':'↖','东南':'↘','西南':'↙'};
  // 方向 → 罗盘 3×3 网格坐标 [行,列]（上北下南左西右东）
  var DIR_GRID={'北':[1,2],'东北':[1,3],'东':[2,3],'东南':[3,3],'南':[3,2],'西南':[3,1],'西':[2,1],'西北':[1,1]};
  function renderMoveBar(room){
    var bar=document.getElementById('move-bar'); if(!bar) return;
    bar.innerHTML=''; bar.classList.remove('pulse','has-exits');
    // 建筑内部房间：无方位概念，罗盘只在「南」位放一枚「返回」钮（v20260928g 罗盘化：
    //   旧版单独渲染 mv-bld-exits 按钮条，与左侧场景按钮重复且非罗盘视觉；现统一为罗盘出口，
    //   子区域入口仍在场景按钮（见 roomObjs bld 分支 blda_））
    if(isBldRoom(getState().room)){
      bar.classList.add('has-exits');
      var _ctr=document.createElement('div'); _ctr.className='mv-center'; _ctr.textContent='你在此'; bar.appendChild(_ctr);
      var _f=bldForRoom(getState().room);
      var _isSub = _f && !_f.ar.isRoot;
      var _lb = _isSub ? '返回正堂' : '返回街巷';
      var _back = document.createElement('button');
      _back.className='mv-exit e-out';
      _back.dataset.dir='南';
      var _g=DIR_GRID['南']; _back.style.gridRow=_g[0]; _back.style.gridColumn=_g[1];
      _back.innerHTML='<span class="mv-arrow">↓</span><span class="mv-nm">'+_lb+'</span>';
      _back.onclick = _isSub ? (function(){ bldMove('__bld__'+_f.key); }) : (function(){ leaveBldRoom(); });
      bar.appendChild(_back);
      return;
    }
    var exits=currentRoomExits();
    if(!exits.length) return;           // 无出口：隐藏移动区，不占空间
    bar.classList.add('has-exits');
    // 中心：当前所在
    var ctr=document.createElement('div'); ctr.className='mv-center'; ctr.textContent='你在此';
    bar.appendChild(ctr);
    // 移动门禁：由触发引擎经 state.moveGate 设定（任何"被追/护送"剧情可复用，如苦役营越狱逃亡）
    var gate=getState().moveGate;
    var fwd=gate && gate.fwd;
    exits.forEach(function(o){
      var tid=o.tid || (room.exits && room.exits[o.dir]);
      var g=DIR_GRID[o.dir]||[2,2];
      // 门禁两种用法：fwd = 只许走这一个方向（剧情引导）；only = 方向白名单（v20260912f，
      //   教学开场「只许往南去中军场院」——别处一格都去不得）。
      var only = (gate && gate.only) || null;
      var blocked = (fwd && tid!==fwd) || (only && only.length && only.indexOf(o.dir)<0);
      var b=document.createElement('button');
      b.className='mv-exit e-'+o.dir+(o.kind?(' '+o.kind):'')+(blocked?' mv-blocked':'');
      b.dataset.dir=o.dir;   // 语义锚点：供通用指引系统高亮「该往哪走」的方位键
      b.style.gridRow=g[0]; b.style.gridColumn=g[1];
      b.innerHTML='<span class="mv-arrow">'+(DIR_ARROW[o.dir]||'➤')+'</span><span class="mv-nm">'+stripDir(o.name)+'</span>';
      if(o.place) b.title='出城前往：'+o.place;
      if(blocked){ b.onclick=function(){ toast(gate && gate.hint ? gate.hint : '此处暂不能去。'); }; }
      else { b.onclick=function(){ move(o.dir, tid); }; }
      bar.appendChild(b);
    });
  }
  // 当前房间的方位通路（兼容 ROOM_OBJECTS 与旧版 room.exits）
  function currentRoomExits(){
    var room=G.ROOMS[getState().room]||bldRoom(getState().room);
    if(!room) return [];
    // 建筑内部无方位罗盘：子区域与出入口以场景按钮呈现
    if(isBldRoom(getState().room)) return [];
    if(isCityGrid(getState().room)){
      var cp=getState().flags.cityPos, m=genCityGrid(getState().room);
      if(!m||!cp) return [];
      var DIRS=[['北',0,-1],['南',0,1],['东',1,0],['西',-1,0]];
      var ex=[];
      DIRS.forEach(function(d){
        var nx=cp.x+d[1], ny=cp.y+d[2];
        if(nx>=0&&nx<m.size&&ny>=0&&ny<m.size){
          if(!canEnterCell(getState().room,nx,ny)) return;   // 焦土/未营建/断路不可通行
          var t=cellDisplayType(getState().room,nx,ny);
          var ri=(t==='gate')?{gate:true,nm:'城门'}:null;
          ex.push({dir:d[0], name:d[0]+'·'+(ri?ri.nm:cellDisplayName(getState().room,t)), icon:'🚪', tid:'__cell__', kind:'cell'});
        }
      });
      // 城门外向出口：经罗盘「出城」进入对应郊野（不同城门 → 不同郊野 → 不同邻城）
      var ct2=cellDisplayType(getState().room, cp.x, cp.y);
      if(ct2==='gate'||ct2==='sentry'){
        var od=gateOutwardDir(getState().room, cp.x, cp.y);
        var gt=(LF.PLACE_GATES && LF.PLACE_GATES[getState().room] && LF.PLACE_GATES[getState().room][od])||null;
        if(gt){
          var gp=(LF.PLACES && LF.PLACES[gt])||{};
          var gRoom=gp.entryRoom || gt;          // 指向真实房间（郊野入口格），而非郊野 id
          // v20260905i：罗盘钮名只标「出城」，去向写入 title，避免长名在 3×3 窄钮内截断
          ex.push({dir:od, name:od+'·出城', icon:'🚪', tid:gRoom, kind:'gateout', place:(gp.name||'郊野')});
        }
      }
      return ex;
    }
    var objs=roomObjs(room.id);
    var ex=objs.filter(function(o){return o.type==='exit';});
    if(ex.length) return ex;
    return Object.keys(room.exits||{}).map(function(dir){
      var tid=room.exits[dir];
      return {dir:dir, name:dir+'·'+exitDisplayName(tid), icon:'🚪', tid:tid};
    });
  }
  function renderSelf(room){
    // 研习武学：仅特定房间出现；调息已移至底部 dock
    if(roomCanLearn(room.id)){
      mkAct('self','📖','研习武学', function(){ openLearn(); }, null, 'learn_wu');
    }
  }

  function stripDir(nm){ return (nm||'').replace(/^[^·]*·/,''); }

  // —— 城门 / 郊野行军 辅助 ——
  // 取某城实际可用的城门方向（v20260905k：路网自适应，与 genCityGrid 门洞格同源）
  function availableGateDirs(pid){
    var c=(LF.CITIES||{})[pid];
    if(!c || !c.grid) return ['北','东','南','西'];
    return cityGateDirs(pid);
  }
  // 城门格 → 朝外方位
  function gateOutwardDir(cid,x,y){
    var m=genCityGrid(cid); if(!m) return null;
    var s=m.size;
    if(y===0) return '北'; if(y===s-1) return '南';
    if(x===s-1) return '东'; if(x===0) return '西';
    return null;
  }
  function gateCellCoord(pid, dir){
    var m=genCityGrid(pid); if(!m) return null;
    var s=m.size, cx=Math.floor(s/2), cy=Math.floor(s/2);
    if(dir==='北') return [cx,0];
    if(dir==='南') return [cx,s-1];
    if(dir==='东') return [s-1,cy];
    if(dir==='西') return [0,cy];
    return [cx,cy];
  }
  // 到达某城时落在指定城门（供郊野→城 哨兵出口使用）
  // 注意：目标城的该侧可能没有实际城门（单门山城只朝固定方向开门），此时落在墙/屋格会令玩家困在无路格。
  // 改为：若指定方位无「可进入的城门格」，就近落到最近的真正城门格。
  function nearestGateCell(pid, want){
    var m=genCityGrid(pid); if(!m||!m.size) return want||null;
    var s=m.size, best=null, bd=1e9;
    for(var _y=0;_y<s;_y++) for(var _x=0;_x<s;_x++){
      if(cellDisplayType(pid,_x,_y)!=='gate') continue;
      if(!canEnterCell(pid,_x,_y)) continue;
      var dd=Math.abs(_x-(want?want[0]:Math.floor(s/2)))+Math.abs(_y-(want?want[1]:Math.floor(s/2)));
      if(dd<bd){ bd=dd; best=[_x,_y]; }
    }
    return best;
  }
  // 宵禁（v20260911h · P3 · 门禁）：戌时鸣鼓落锁起，至次日寅时，城门昼夜紧闭；
  //   出不得城、也叫不开门——须待卯时启门，或于野外就地安营 / 在城中「投店打尖」。
  //   苦役营（kuyilao）不受此判：营门另有囚籍规条（见 leaveViaGate 首段），免得与教学链打架。
  function gateCurfew(cid){ return cid !== 'kuyilao' && isCurfewHour(); }
  function arriveAtGate(pid, dir){
    // 夜间门禁只限制“出城”(leaveViaGate)；回城投宿不受限，否则流落野外叫不开门、无法进城
    if(gateCurfew(pid)){
      log('〔门禁〕'+((LF.CITIES[pid]||{}).name||'城门')+'夜鼓已歇——门内应声：「且入城安歇，卯时再出。」你推门入城。','sys');
      toast('城门夜闭，但守卒见你露宿在外，破例放进城安歇。卯时前不得再出。');
    }
    setOnBoat(false);   // 进城即上岸
    var gc=gateCellCoord(pid, dir);
    var m=genCityGrid(pid);
    if(gc && m && m.size){
      var t=cellDisplayType(pid, gc[0], gc[1]);
      if(t!=='gate' || !canEnterCell(pid, gc[0], gc[1])){
        var fb=nearestGateCell(pid, gc);
        if(fb) gc=fb;
      }
    }
    if(!gc){ renderRoom(pid); return; }
    getState().flags.cityPos={cid:pid, x:gc[0], y:gc[1]};
    advanceMinutes(10);   // v20260917b：入城门 10 分钟（门卒盘查；与出城门统一）
    renderRoom(pid);
  }
  // 从城门经郊野出城（罗盘点「出城」按钮或城门外向移动触发）
  function leaveViaGate(dir){
    var cp=getState().flags.cityPos; if(!cp||cp.cid!==getState().room){ toast('须先立于城门。'); return; }
    // 教学未毕业：苦役营（kuyilao）各出口被看死，须熬过夺营之变、随势脱身
    if (getState().room === 'kuyilao' && !(getState().flags && getState().flags.onb && getState().flags.onb.done)) {
      toast('营门看死，官差盯得紧。且安心做活、熬过这几日——营中暗流，自有变故。'); return;
    }
    // 宵禁（v20260911h · P3 · 门禁）：夜里城门自内落锁，出不得城
    if(gateCurfew(getState().room)){
      log('〔门禁〕夜鼓已过，'+((LF.CITIES[getState().room]||{}).name||'城')+'门落锁。守卒按刀一横：「卯时启门，今夜谁也不许出城。」','warn');
      toast('城门已闭（'+hourLabel()+'）——须待卯时启门。若城中无处安身，可去市集或城门内脚店「投店打尖」。');
      return;
    }
    var _fid = (LF.PLACE_GATES && LF.PLACE_GATES[getState().room] && LF.PLACE_GATES[getState().room][dir]) || null;
    var target = _fid ? ((LF.PLACES && LF.PLACES[_fid] && LF.PLACES[_fid].entryRoom) || _fid) : null;
    if(!target){ toast('此门暂无通途。'); return; }
    if(!exert('远行')) return;
    getState().energy=Math.max(0,getState().energy-2);
    getState().food=Math.max(0,getState().food-1); getState().drink=Math.max(0,getState().drink-1);
    advanceMinutes(10);
    log('你出'+((LF.CITIES[getState().room]||{}).name||'城')+'的'+dir+'门，踏上城外古道……','sys');
    renderRoom(target);
  }
  // 出口显示名（处理 __gate__ 哨兵 → 入城提示）
  function exitDisplayName(tid){
    if(typeof tid==='string' && tid.indexOf('__gate__:')===0){
      var _p=tid.split(':'), pid=_p[1], dir=_p[2];
      var nm=(LF.CITIES&&LF.CITIES[pid]&&LF.CITIES[pid].name) || (LF.PLACES&&LF.PLACES[pid]&&LF.PLACES[pid].name) || pid;
      return dir+'·入城('+nm+')';
    }
    if(typeof tid==='string' && tid.indexOf('__cell__:')===0){
      var _c=tid.split(':');
      var _t=cellDisplayType(_c[1], +_c[2], +_c[3]);
      var _nm=cellDisplayName(_c[1], _t);
      // v20260913c：prison 格在子牢房罗盘上显示「牢房走廊」，避免「回牢房」歧义（回哪间？）
      if(_t==='prison') _nm='牢房走廊';
      return '往'+_nm;
    }
    var r=G.ROOMS[tid];
    if(!r) return tid;
    // 郊野行军格：罗盘出口用语义分段名（近郭/初野/深野/远野），不再显示冗长全名
    if(r.isField && r.nmBand) return r.nmBand;
    return r.name;
  }

  // ===== 行走探索 =====
  function move(dir, tid){
    if(getCombatMode()!==null){ toast('正与敌缠斗，先应敌！'); return; }   // 战斗进行中禁止移动
    if(interactBusy()){ toast('先把话说完 / 先做决断，再动身。'); return; }   // 对话悬挂时不许挪窝（v20260911i）
    // 郊野→城 哨兵出口：落到对应城门
    if(typeof tid==='string' && tid.indexOf('__gate__:')===0){
      var _p=tid.split(':'); arriveAtGate(_p[1], _p[2]); return;
    }
    // 子房间退回城格（经面板 doors 进入的子房间，其出口指向具体城格）：直接落格，不走 move 能耗
    if(typeof tid==='string' && tid.indexOf('__cell__:')===0){
      var _c=tid.split(':');
      getState().flags.cityPos={cid:_c[1], x:+_c[2], y:+_c[3]};
      advanceMinutes(5);   // v20260917b：进出子房间 5 分钟（一进一出有门槛感，但不重）
      save(getState()); renderRoom(_c[1], true);
      autoOnbRoutines();   // v20260916e：子房间退回城格同样触发自动应卯/销名（如从牢房内部出来即自动销名）
      return;
    }
    if(isCityGrid(getState().room)){
      var _cp=getState().flags.cityPos;
      if(_cp && _cp.cid===getState().room){
        var _ct=cellDisplayType(getState().room, _cp.x, _cp.y);
        // v20260911h：出城口与 currentRoomExits / leave_city 同口径 —— 城门格与岗哨格皆可出城
        // （苦役营南门是 sentry 格，此前只认 gate 会落到网格移动分支 → 越界报「此处无路可去」）
        if(_ct==='gate'||_ct==='sentry'){
          var _od=gateOutwardDir(getState().room, _cp.x, _cp.y);
          if(_od===dir && LF.PLACE_GATES && LF.PLACE_GATES[getState().room] && LF.PLACE_GATES[getState().room][_od]){
            leaveViaGate(_od); return;
          }
        }
      }
      var dm={'北':[0,-1],'南':[0,1],'东':[1,0],'西':[-1,0]}[dir];
      if(dm){
        var _m=genCityGrid(getState().room);
        if(!_cp||!_m){ toast('此处无路可去。'); return; }
        // v20260916f：牢房落锁——戌亥子丑寅卯（约晚8点至早6点）牢门上闩，囚室出不得。
        //   守的是「戌时前回牢」的规矩：回得早，白天照常进出；拖到锁门，就只能等卯时开锁。
        if(cellLockedHere()){
          toast('〔牢门落锁〕'+hourLabel()+'，牢门上着粗铁闩，从里头推不动——要到卯时方开。今夜你出不得这囚室。');
          return;
        }
        var nx=_cp.x+dm[0], ny=_cp.y+dm[1];
        if(nx>=0&&nx<_m.size&&ny>=0&&ny<_m.size && canEnterCell(getState().room,nx,ny)){
          goCell(getState().room, nx, ny);
          autoOnbRoutines();   // v20260916e：落格即触发自动应卯/销名（走进中军自动应卯、走进牢房自动销名）
          return;
        }
      }
      toast('此处无路可去。');
      return;
    }
    if(!exert('远行')) return;
    // 水路郊野：未乘船不得踏入（须先在本格「乘船渡江」）
    var _tgtRoom=G.ROOMS[tid];
    if(_tgtRoom && roomIsBoatRoute(_tgtRoom) && !isOnBoat()){
      toast('此处是水路津渡，须先点「乘船渡江」方能渡江。');
      return;
    }
    // 郊野逐格穿行：遇雨雪雾等天候额外耗费体力（WX_EFF.walk），城郭内不受影响
    var _oldR=G.ROOMS[getState().room];
    var _wx=wxEff();
    var _fieldStep=(_oldR && _oldR.isField) || !!(tid && G.ROOMS[tid] && G.ROOMS[tid].isField);
    var _extra=(_fieldStep && _wx.walk) ? _wx.walk : 0;
    getState().energy=Math.max(0,getState().energy-4-_extra);
    getState().food=Math.max(0,getState().food-1);
    getState().drink=Math.max(0,getState().drink-1);
    advanceMinutes(30);
    // v20260916b：与城内同理——不带新信息的话就不往文本栏写。郊野每格都刷「沿途景物渐换」，
    //   走一趟能把半屏顶掉，而那句「景物渐换」玩家早从场景描述里看到了。
    //   只留真正要紧的一句：天候额外耗力（玩家据此决定要不要冒雨赶路、要不要先扎营）。
    if(_extra) log('（'+((WEATHERS[getState().weather]||{}).n||'')+'中行路，分外耗费气力。）','warn');
    var _gone=getState().room;
    renderRoom(tid);
    // 自动上岸：抵达陆地（城或非水路郊野）即离舟，整段水路只需乘一次船
    if(!roomIsBoatRoute(G.ROOMS[tid])) setOnBoat(false);
    var _gc=_gone && G.ROOMS[_gone];
    if(_gc && _gc.isField){
      var _left=fieldPlacedCamps(_gc);
      if(_left.length) log('你起身离营——'+_left.map(function(f){return f.name;}).join('、')+'留在原地（折返仍可寻回，亦可作来日途中歇脚）。','sys');
    }
  }
    return {
      renderMoveBar: renderMoveBar, renderSelf: renderSelf,
      currentRoomExits: currentRoomExits, availableGateDirs: availableGateDirs,
      gateOutwardDir: gateOutwardDir, gateCellCoord: gateCellCoord,
      nearestGateCell: nearestGateCell, gateCurfew: gateCurfew,
      arriveAtGate: arriveAtGate, leaveViaGate: leaveViaGate,
      exitDisplayName: exitDisplayName, move: move
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createMovement;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

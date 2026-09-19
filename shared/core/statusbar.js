// 状态栏渲染（从 engine.js 拆分）
// renderStatus / renderLocTab：顶部身份 + 数值条 + 追踪任务 + 时辰天气；场景名（城格坐标→显示名）渲染。
// 引擎可变状态走 S()；SHICHEN/WEATHERS/LF.OBJECTIVES 为全局常量/命名空间，直接引用。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createStatusbar = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getCheckQuestRewards = ctx.getCheckQuestRewards;
    var getDeriveCalendar = ctx.getDeriveCalendar;
    var getInCampNow = ctx.getInCampNow;
    var getCellDisplayName = ctx.getCellDisplayName;
    var getGenCityGrid = ctx.getGenCityGrid;
    var getIsCityGrid = ctx.getIsCityGrid;
    var getNeedHave = ctx.getNeedHave;
    var $statusEl = document.getElementById('status');
  // v20260919e：LF.OBJECTIVES 是静态常量表，renderStatus 每帧扫一遍太浪费——
  // 懒建一次 id→目标 映射（兼容数据晚于本模块加载的情况），O(1) 查询。
  var _objMap = null;
  function _objLook(id){
    if (_objMap === null){
      _objMap = {};
      var L = (typeof LF !== 'undefined' && LF.OBJECTIVES) || [];
      for (var _i = 0; _i < L.length; _i++){ if (L[_i] && L[_i].id) _objMap[L[_i].id] = L[_i]; }
    }
    return _objMap[id] || null;
  }
  function renderStatus(){
    getCheckQuestRewards()();
    var sh=SHICHEN[S().time%12];
    var hh=String(Math.floor(S().clock/60)).padStart(2,'0');
    var mm=String(S().clock%60).padStart(2,'0');
    var c=getDeriveCalendar()();
    var era=(S().eraName||'光和')+(c.eraYear===1?'元年':c.eraYear+'年');
    var w=WEATHERS[S().weather]||WEATHERS[0];
    // 宵禁时段变红（v20260916a）：酉戌亥子丑寅在营中时，时辰标红——把「快回牢」写进一眼能看见的地方
    var lateInCamp = !!(S().flags && S().flags.onb && !S().flags.onb.done)
      && getInCampNow()() && (S().time>=9 || S().time<=2);
    $statusEl.innerHTML=
      '<span class="who" title="'+S().name+'">'+S().name+'</span>'+
      '<span class="dot">·</span>'+
      '<span class="st-clock" id="st-clock">'+hh+':'+mm+'</span>'+
      '<span class="st-time'+(lateInCamp?' st-time-night':'')+'" title="'+(lateInCamp?'戌时落锁，营规要拿人':sh)+'">'+sh+'</span>'+
      '<span class="dot">·</span>'+
      '<span class="st-wx" title="'+w.n+'">'+w.ic+w.n+'</span>'+
      // 回顾入口（v20260914a）：贴在状态栏最右侧，随手可及。点它为「回顾」，点状态栏其余处仍是「时辰钟表」。
      '<span class="st-log" id="st-log" role="button" title="回顾：你听过、读过的每一句">回顾</span>';
    var qtr=document.getElementById('quest-track');
    if(qtr){
      var tq=S().trackingQuest, to=null, qd=null;
      if(tq){
        to = _objLook(tq);
        if(!to && S().quests){ for(var _qj=0;_qj<S().quests.length;_qj++){ if(S().quests[_qj].id===tq){ qd=S().quests[_qj]; break; } } }
      }
      if(to){
        var _qdone=to.check(S());
        qtr.style.display='';
        qtr.innerHTML='<span class="qt-ic">📜</span>追踪 · <b>'+to.title+'</b><span class="qt-prog">'+(_qdone?'已达成 ✓':to.prog(S()))+'</span><button class="qt-clear" type="button">✕</button>';
        var _qb=qtr.querySelector('.qt-clear'); if(_qb){ _qb.onclick=function(){ S().trackingQuest=null; renderStatus(); }; }
      } else if(qd){
        var _pt = (qd.need && qd.need.length)
          ? qd.need.map(function(nd){ return nd.name+' '+Math.min(getNeedHave()(nd),nd.count)+'/'+nd.count; }).join('  ')
          : (qd.submit ? ('提交 · '+qd.submit.npc) : '');
        qtr.style.display='';
        qtr.innerHTML='<span class="qt-ic">📜</span>追踪 · <b>'+qd.title+'</b><span class="qt-prog">'+_pt+'</span><button class="qt-clear" type="button">✕</button>';
        var _qb2=qtr.querySelector('.qt-clear'); if(_qb2){ _qb2.onclick=function(){ S().trackingQuest=null; renderStatus(); }; }
      } else { qtr.style.display='none'; }
    }
  }
  function renderLocTab(room){
    var loc=room.name||'';
    if(getIsCityGrid()(room.id) && S().flags.cityPos){
      var _m=getGenCityGrid()(room.id);
      if(_m){ var _ct=_m.cells[S().flags.cityPos.y][S().flags.cityPos.x]; loc+=' · '+getCellDisplayName()(room.id,_ct); }
    }
    var t=document.getElementById('loc-tab'); if(t) t.textContent=loc;
  }
    return {
      renderStatus: renderStatus, renderLocTab: renderLocTab
    };
  };
})(typeof window !== 'undefined' ? window : global);

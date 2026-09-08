// 城市内部探索：建筑（屋舍）面板与交互（v20260909e）
// 从 engine.js 拆出：bldCurArea（当前区域）/ bldDef（屋舍定义，含蓝图建筑动态构造）/ renderBuildingPanel / bindBuildingPanel。
// 依赖经 ctx 注入：getState（惰性）；getBuildingState（引擎侧可变对象，openModal 会整体重赋值，故须 getter；面板只写其属性，无需 setter）；
// getBUILDINGS（建筑数据表，与 city.js 等共享，留在引擎）；bldActsFilter（被房间物件系统复用，留在引擎）；
// getCard/getCurrentModalKind（引擎 UI 状态）；itemIconHTML / LF（LF.BUILD 蓝图）/ openModal / closeModal。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createBuilding = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getBuildingState = ctx.getBuildingState;
    var LF = ctx.LF, getBUILDINGS = ctx.getBUILDINGS, itemIconHTML = ctx.itemIconHTML;
    var bldActsFilter = ctx.bldActsFilter;
    var getCard = ctx.getCard, getCurrentModalKind = ctx.getCurrentModalKind;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;

  function bldCurArea(b){
    var key=getBuildingState().area||'root';
    if(key==='root' || !b.areas || !b.areas[key]){
      var npcs=(b.interior||[]).filter(function(e){return e.kind==='npc';});
      if(b.rootExtraNpcs) npcs=npcs.concat(b.rootExtraNpcs);
      var objs=(b.interior||[]).filter(function(e){return e.kind==='obj';});
      if(b.rootExtraObjs) objs=objs.concat(b.rootExtraObjs);
      return { name:(b.rootName||b.name), icon:b.icon, desc:b.sub, npcs:npcs, objs:objs, areas:(b.subAreas||[]), isRoot:true };
    }
    return b.areas[key];
  }
  function bldDef(){
    if(!getBuildingState()) return null;
    // 玩家营造的蓝图建筑：用 LF.BUILD[蓝图id] 的动态 interior 临时构造屋舍定义
    if(getBuildingState().bp){
      var bp=LF.BUILD[getBuildingState().bp]; if(!bp) return null;
      return { name:bp.doneName||'屋舍', icon:itemIconHTML({name:bp.doneName||'屋舍'},13), sub:bp.desc||'',
        interior:bp.interior||[], rootName:bp.rootName, subAreas:bp.subAreas, areas:bp.areas,
        rootExtraNpcs:bp.rootExtraNpcs, rootExtraObjs:bp.rootExtraObjs };
    }
    return getBUILDINGS()[getBuildingState().building] || null;
  }
  function renderBuildingPanel(){
    var b=bldDef();
    if(!b) return '<div class="empty">此处并无屋舍。</div>';
    var area=bldCurArea(b);
    if(getBuildingState().sel!=null){
      var list=(getBuildingState().selKind==='obj')? area.objs : area.npcs;
      var e=list[getBuildingState().sel];
      if(!e){ getBuildingState().sel=null; return renderBuildingPanel(); }
      var h='<div class="bld-crumb">'+b.icon+((getState()&&getState().flags&&getState().flags.bldEnt&&getState().flags.bldEnt.sign)||b.name)+' › '+area.name+'</div>';
      h+='<div class="bld-detail">';
      h+='<div class="bld-d-head">'+e.icon+' '+e.name+' <span class="bld-ent-ki">'+(getBuildingState().selKind==='obj'?'物件':'人物')+'</span></div>';
      h+='<div class="bld-d-desc">'+e.desc+'</div>';
      h+='<div class="bld-acts">';
      bldActsFilter(e.acts).forEach(function(a,ai){ h+='<button class="btn bld-act'+(a.danger?' danger':'')+'" data-ai="'+ai+'">'+a.icon+' '+a.label+'</button>'; });
      h+='</div><button class="btn bld-back" data-back="1">返 回</button>';
      h+='</div>';
      return h;
    }
    var h='<div class="bld-crumb">'+b.icon+' '+((getState()&&getState().flags&&getState().flags.bldEnt&&getState().flags.bldEnt.sign)||b.name)+'</div>';
    h+='<h3>'+area.icon+' '+area.name+'</h3>';
    h+='<div class="bld-sub">'+area.desc+'</div>';
    h+='<div class="bld-list">';
    (area.npcs||[]).forEach(function(e,i){ h+='<div class="bld-ent bld-npc" data-kind="npc" data-i="'+i+'"><span class="bld-ent-ic">'+e.icon+'</span><span class="bld-ent-nm">'+e.name+'</span><span class="bld-ent-ki">人物</span></div>'; });
    (area.objs||[]).forEach(function(e,i){ h+='<div class="bld-ent bld-obj" data-kind="obj" data-i="'+i+'"><span class="bld-ent-ic">'+e.icon+'</span><span class="bld-ent-nm">'+e.name+'</span><span class="bld-ent-ki">物件</span></div>'; });
    h+='</div>';
    if(area.areas && area.areas.length){
      h+='<div class="bld-areas">';
      area.areas.forEach(function(a){ h+='<button class="btn bld-area" data-area="'+a.key+'">'+a.label+'</button>'; });
      h+='</div>';
    }
    // 注：建筑内无方向罗盘，退出统一由房间底部「返回街巷/返回正堂」按钮（move-bar）完成，故弹窗不再重复放置导航按钮，避免繁琐
    return h;
  }
  function bindBuildingPanel(){
    var b=bldDef();
    if(!b) return;
    var area=bldCurArea(b);
    if(getBuildingState().sel!=null){
      var list=(getBuildingState().selKind==='obj')? area.objs : area.npcs;
      var e=list[getBuildingState().sel];
      if(e){
        getCard().querySelectorAll('.bld-act').forEach(function(el){
          el.onclick=function(){ var a=bldActsFilter(e.acts)[+el.getAttribute('data-ai')]; if(a&&a.fn){ a.fn(); if(getCurrentModalKind()==='building') openModal('building'); } };
        });
      }
      var back=getCard().querySelector('.bld-back'); if(back) back.onclick=function(){ getBuildingState().sel=null; openModal('building'); };
      return;
    }
    getCard().querySelectorAll('.bld-ent').forEach(function(el){
      el.onclick=function(){ getBuildingState().selKind=el.getAttribute('data-kind'); getBuildingState().sel=+el.getAttribute('data-i'); openModal('building'); };
    });
    getCard().querySelectorAll('.bld-area').forEach(function(el){
      el.onclick=function(){ if(getBuildingState().stack) getBuildingState().stack.push(getBuildingState().area); getBuildingState().area=el.getAttribute('data-area'); getBuildingState().sel=null; openModal('building'); };
    });
    var up=getCard().querySelector('.bld-up'); if(up) up.onclick=function(){ if(getBuildingState().stack && getBuildingState().stack.length) getBuildingState().area=getBuildingState().stack.pop(); else getBuildingState().area='root'; getBuildingState().sel=null; openModal('building'); };
    var exit=getCard().querySelector('.bld-exit'); if(exit) exit.onclick=function(){ closeModal(); };
  }

    return {
      bldCurArea: bldCurArea, bldDef: bldDef, renderBuildingPanel: renderBuildingPanel, bindBuildingPanel: bindBuildingPanel
    };
  };
})(typeof window !== 'undefined' ? window : global);

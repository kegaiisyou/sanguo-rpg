// 模块 learn（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createLearn = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var G = ctx.G;
    var clearActions = ctx.clearActions;
    var buildActions = ctx.buildActions;
    var curRoom = ctx.curRoom;
    var save = ctx.save;
    var renderStatus = ctx.renderStatus;
    var addBtn = ctx.addBtn;
    var log = ctx.log;
    var getActions = ctx.getActions;
  function openLearn(){
    clearActions();
    log('【修炼】案上摊开武学谱录，你凝神参悟，耗「潜能」以窥门径：','title');
    var MA=G.MARTIAL_ARTS, LINES=MA.LINES;
    var order=Object.keys(LINES).sort(function(a,b){return LINES[a].order-LINES[b].order;});
    order.forEach(function(lid){
      var line=LINES[lid];
      var list=[];
      for(var k in MA){ var a=MA[k]; if(a&&a.id&&a.line===lid&&a.type!=='technique') list.push(a); }
      if(!list.length) return;
      var head=document.createElement('div'); head.className='learn-line';
      head.innerHTML='<span class="ll-name">'+line.name+'</span><span class="ll-lv">艺线 Lv.'+(S().lines[lid]||0)+'</span>';
      getActions().appendChild(head);
      list.forEach(function(a){
        var owned=S().learnedMartial.indexOf(a.id)>=0;
        var rlm=(S().realm[a.id]||0);
        var rname=G.MARTIAL_ARTS.REALMS[rlm];
        var potCost=a.type==='ultimate'?50 : 20 + a.learn.lineMin*8 + Math.floor(a.beat/10);
        var lockLine=(S().lines[lid]||0) < a.learn.lineMin;
        var b=document.createElement('button'); b.className='act wide';
        b.title=a.desc+'（当前境界：'+rname+'）';
        if(owned){ b.innerHTML='✓ '+a.name+'（'+rname+'）'; b.disabled=true; }
        else if(lockLine){ b.innerHTML='🔒 '+a.name+'（'+line.name+'艺线需 Lv.'+a.learn.lineMin+'）'; b.disabled=true; }
        else{
          b.innerHTML='› '+a.name+(a.type==='ultimate'?' · 绝技':'')+'（耗潜能 '+potCost+'）';
          b.onclick=function(){
            if(S().pot<potCost){ log('潜能不足，难窥'+a.name+'门径。可多去历练积攒潜能。','sys'); return; }
            S().pot-=potCost; S().learnedMartial.push(a.id);
            S().lines[lid]=Math.min(20,(S().lines[lid]||0)+1);
            log('【习得】'+a.name+'！'+a.desc,'good');
            clearActions(); buildActions(curRoom()); save(S()); renderStatus();
          };
        }
        getActions().appendChild(b);
      });
    });
    // 发力技巧（可嵌任意武学，单独成组）
    var techs=MA.getTechniques();
    if(techs.length){
      var th=document.createElement('div'); th.className='learn-line';
      th.innerHTML='<span class="ll-name">发力技巧</span><span class="ll-lv">装配增威</span>';
      getActions().appendChild(th);
      techs.forEach(function(a){
        var equipped=S().equippedForce.indexOf(a.id)>=0;
        var potCost=20 + a.learn.lineMin*8;
        var lockLine=(S().lines[a.line]||0) < a.learn.lineMin;
        var b=document.createElement('button'); b.className='act wide';
        b.title=a.desc;
        if(equipped){ b.innerHTML='✓ '+a.name+'（已装配）'; b.disabled=true; }
        else if(lockLine){ b.innerHTML='🔒 '+a.name+'（'+LINES[a.line].name+'艺线需 Lv.'+a.learn.lineMin+'）'; b.disabled=true; }
        else{
          b.innerHTML='› '+a.name+'（耗潜能 '+potCost+'）';
          b.onclick=function(){
            if(S().pot<potCost){ log('潜能不足，难通'+a.name+'。','sys'); return; }
            S().pot-=potCost; S().equippedForce.push(a.id);
            log('【装配】'+a.name+'！'+a.desc,'good');
            clearActions(); buildActions(curRoom()); save(S()); renderStatus();
          };
        }
        getActions().appendChild(b);
      });
    }
    addBtn('返回营中', function(){ buildActions(curRoom()); });
  }
    return {
      openLearn
    };
  };
})(typeof window !== 'undefined' ? window : global);

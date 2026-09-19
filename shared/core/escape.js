// 模块 escape（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createEscape = function (ctx) {
    var getState = ctx.getState, S = getState;
    var ctxRouteInfo = ctx.getRouteInfo;
    var ctxEscapeAvail = ctx.getEscapeAvail;
    var ctxEscapeLockHint = ctx.getEscapeLockHint;
    var ctxDoEscape = ctx.getDoEscape;
    var ctxTutAsk = ctx.getTutAsk;
    var log = ctx.log;
  function openEscapeHub(room, expand){
    if(document.getElementById('tut-choices')) return;
    if(S().flags && S().flags.onb && S().flags.onb.done){ log('你已逃出苦役营，不必再决断。','sys'); return; }
    // 枢纽分流（v20260912e）：旧房间体系按「墙根 / 岗哨」各列一半；城内枢纽（kuyilao 城格）列全部九条。
    //   两半合起来才是完整的「十越狱路线」——此前城内只列到墙根四条，下药/暴动/木牍/收买/强攻那五条
    //   在游戏里【没有任何入口】：(1,2) 格只注入了 wall_choose，而 gate_choose 全项目根本不存在，等于白写。
    var WALL=['crypt','tunnel','rope','drain'], GATE=['drug','riot','wooden','bribe','assault'];
    var atWall = (room==='camp_wall'), atGate = (room==='camp_gate');
    var routes = atWall ? WALL : (atGate ? GATE : WALL.concat(GATE));
    var opts=[], open=[], locked=[];
    routes.forEach(function(r){ (ctxEscapeAvail()(r)?open:locked).push(r); });
    open.forEach(function(r){
      opts.push({ label: '〔'+ctxRouteInfo()[r].name+'〕就此出营', fn: function(){ ctxDoEscape()(r, room); } });
    });
    if(expand){
      locked.forEach(function(r){
        opts.push({ label: '〔'+ctxRouteInfo()[r].name+'〕'+ctxEscapeLockHint()(r), fn: function(){ log('这条路子还未备妥——'+ctxEscapeLockHint()(r)+'。', 'sys'); } });
      });
    } else if(locked.length){
      opts.push({ label: (open.length ? ('另有 '+locked.length+' 条门路尚未备妥——细看还差什么')
                                      : ('眼下 '+locked.length+' 条门路皆未备妥——细看还差什么')),
        fn: function(){ openEscapeHub(room, true); } });
    }
    opts.push({ label: '再想想，先不逃', fn: function(){ log('你压下心头去意，先回营中再探探门道。','sys'); } });
    var title = atWall ? '塌墙根下，你盘算着出营的法子——'
              : atGate ? '岗哨咽喉，你思量着强出营墙的法子——'
              : '营中处处是路，你盘算着出营的法子——';
    if(!open.length) title += '（眼下尚无门路，去与营中众人多攀谈，或备齐所需之物）';
    else if(locked.length) title += '（已有 '+open.length+' 条备妥，另有 '+locked.length+' 条未成）';
    ctxTutAsk()(title, opts);
  }
    return {
      openEscapeHub
    };
  };
})(typeof window !== 'undefined' ? window : global);

// 模块 jobboard（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createJobboard = function (ctx) {
    var getState = ctx.getState
    var getCurrentModalKind = ctx.getCurrentModalKind, S = getState;
    var LABOR_PER_WOOD = ctx.LABOR_PER_WOOD;
    var LF = ctx.LF;
    var getJOB_BOARD = ctx.JOB_BOARD;
    var acceptQuest = ctx.acceptQuest;
    var addReputation = ctx.addReputation;
    var addXp = ctx.addXp;
    var buildActions = ctx.buildActions;
    var completeQuest = ctx.completeQuest;
    var curRoom = ctx.curRoom;
    var log = ctx.log;
    var openModal = ctx.openModal;
    var renderStatus = ctx.renderStatus;

  var lastJobTaken=null;
  function jobSeal(j){
    if(jobFlag(j.key,'_done')) return '<span class="job-seal done">已了</span>';
    if(jobFlag(j.key,'_started')) return '<span class="job-seal doing">已领</span>';
    return '<span class="job-seal open">可领</span>';
  }
  function jobPlankHTML(j){
    var done=jobFlag(j.key,'_done'), started=jobFlag(j.key,'_started');
    var cls=done?' done':(started?' doing':' open');
    var expand=(j.key===lastJobTaken)?' expand':'';
    var act;
    if(!done && !started){
      act='<button class="job-take" data-job="'+j.key+'" type="button">摘 下 木 牍 · 领 活</button>';
    } else if(started && !done){
      act='<div class="job-doing">已摘此牍——按牌上所言去办。</div>';
    } else {
      act='<div class="job-done-line">这片木牍已翻过来扣着——了了。</div>';
    }
    var h='<div class="job-plank'+cls+expand+'">'+
      '<div class="job-plank-head job-toggle" data-job="'+j.key+'" role="button" tabindex="0">'+
        jobSeal(j)+'<span class="job-name">'+j.title+'</span><span class="job-fold">▾</span>'+
      '</div>'+
      '<div class="job-body">'+
        '<div class="job-word">'+j.word+'</div>'+
        '<div class="job-meta">'+j.tip+'</div>'+
        act+
      '</div>'+
    '</div>';
    return h;
  }
  function renderJobBoard(){
    var h='<h3 class="q-title">差 役 牌</h3>'+
      '<p class="job-sub">营中差事全钉在这块木牌上：摘下一片木牍，那桩活便落在你头上。</p>'+
      '<div class="job-board">'+getJOB_BOARD().map(jobPlankHTML).join('')+'</div>'+
      '<p class="job-note">牌角另钉着一句：活要做出东西来，东西要送到人手上。空着手回来，不算交差。</p>'+
      '<p class="job-note sub">牌侧一行小字，是另一码事：干活记工，满 '+LABOR_PER_WOOD+' 工发一枚劳字木片，木片到营西伙房换饭——那是口粮，不是差役。</p>';
    return h;
  }
  function bindJobBoard(){
    document.querySelectorAll('.job-toggle[data-job]').forEach(function(h){
      h.onclick=function(){
        var plank=h.parentNode;
        plank.classList.toggle('expand');
      };
    });
    document.querySelectorAll('.job-take[data-job]').forEach(function(b){
      b.onclick=function(){ jobTake(b.getAttribute('data-job')); };
    });
  }
  function jobFlag(key, suffix){ var t=(S().flags && S().flags.task)||{}; return t[key+suffix]; }
  function jobOpen(key){ return !!jobFlag(key,'_started') && !jobFlag(key,'_done'); }
  function jobTake(key){
    var j=null; getJOB_BOARD().forEach(function(x){ if(x.key===key) j=x; }); if(!j) return;
    if(!S().flags) S().flags={};
    if(!S().flags.task) S().flags.task={};
    S().flags.task[key+'_started']=true;
    acceptQuest(j.quest);
    lastJobTaken=key;                          // v20260916h：重渲染后刚领的木牍默认展开
    log(j.take,'sys');
    log('〔差役〕'+j.tip,'sys');
    save(S()); buildActions(curRoom());
    if(getCurrentModalKind()==='job'){ openModal('job'); }
  }
  // 看差役牌（v20260915b）：从对话文字流改为木牍面板 —— 木牌质感 + 一片木牍一桩活
  function jobBoard(){
    openModal('job');
  }
  // ═══ 差役记账（v20260915f）═══
  // 牌上摘牍只是接活；做一次记一笔（jobTick），够了翻牍发赏（jobSettle）。
  //   各处只管调这两个，不必各自拼 flags 路径 —— 也免得「记了数却忘了翻牍」这类漏账。
  function jobTick(key, n){
    if(!S().flags) S().flags={};
    if(!S().flags.task) S().flags.task={};
    var k=key+'_cnt'; S().flags.task[k]=(S().flags.task[k]||0)+(n||1);
    return S().flags.task[k];
  }
  function jobSettle(key, questId, exp, rep){
    if(!S().flags) S().flags={};
    if(!S().flags.task) S().flags.task={};
    S().flags.task[key+'_done']=true;
    if(questId) completeQuest(questId);
    if(exp) addXp(exp);
    if(rep) addReputation(rep);
    save(S()); renderStatus();
  }
    return {
      bindJobBoard, jobBoard, jobFlag, jobOpen,
      jobPlankHTML, jobSeal, jobSettle, jobTake,
      jobTick, lastJobTaken, renderJobBoard,
    };
  };
})(typeof window !== 'undefined' ? window : global);

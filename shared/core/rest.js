// 模块 rest（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createRest = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var G = ctx.G;
    var REST_KINDS = ctx.REST_KINDS;
    var advanceTime = ctx.advanceTime;
    var buildActions = ctx.buildActions;
    var clearActions = ctx.clearActions;
    var clockFlowing = ctx.clockFlowing;
    var closeModal = ctx.closeModal;
    var curRoom = ctx.curRoom;
    var die = ctx.die;
    var inCellNow = ctx.inCellNow;
    var log = ctx.log;
    var maybeFieldAmbush = ctx.maybeFieldAmbush;
    var packUpPlaced = ctx.packUpPlaced;
    var renderStatus = ctx.renderStatus;
    var shuicaoDrawToBag = ctx.shuicaoDrawToBag;
    var shuicaoDrinkPlaced = ctx.shuicaoDrinkPlaced;
    var shuicaoFillPlaced = ctx.shuicaoFillPlaced;
    var toast = ctx.toast;
    var getCombatMode = ctx.getCombatMode;
    var effectiveStats = ctx.effectiveStats;   // 重构后曾裸引用全局 → ReferenceError，改经 ctx 注入（engine 惰性包装）

  function actRest(){
    var sceneEl=document.getElementById('scene'); if(sceneEl){ sceneEl.classList.remove('bg-danger'); }
    clearActions();
    var esR=effectiveStats();
    S().hp=esR.maxHp; S().mp=esR.maxMp; S().energy=S().maxEnergy;
    S().food=S().maxFood; S().drink=S().maxDrink;
    if(S().defeated){ S().defeated=false; log('你缓缓起身，伤势渐愈，气力渐复……','good'); }
    else { log('你就地调息，闭目养神片刻——气血、内力、精力皆复，饥渴亦消。','env'); }
    buildActions(curRoom()); save(S()); renderStatus();
  }

  // [v20260909j] 野外采药 / 伐木 / 木工台采集制作逻辑已抽离 → shared/core/crafting.js

  // ===== 通用可放置物品（模板驱动：物品定义 place 字段 → 场景对象） =====
  // 放置物动作表：place.actions 字符串 → 动作函数（物品数据外置，动作需在此注册）
  // 旧存档兼容：早期放置数据仅存 {key:'tent'}（无 defId），用此表回填物品
  var PLACE_KEY_DEF = { tent:'zhangpeng', p_bench:'gongzuotai', campfire:'campfire', sleepmat:'sleepmat' };
  var PLACE_ACTIONS = {
    tent: function(){
      return [
        {label:'休息…', icon:'🧘', fn:function(){ closeModal(); openRestModal('tent'); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('tent'); }}
      ];
    },
    shuicao: function(p){
      return [
        {label:'饮水', icon:'💧', fn:function(){ shuicaoDrinkPlaced(p); }},
        {label:'添水', icon:'🪣', fn:function(){ shuicaoFillPlaced(p); }},
        {label:'装水入袋', icon:'💧', fn:function(){ shuicaoDrawToBag(p); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('shuicao'); }}
      ];
    },
    p_bench: function(){
      return [
        {label:'制作…', icon:'🔨', fn:function(){ openModal('craft', {bench:'bench'}); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('p_bench'); }}
      ];
    },
    campfire: function(){
      return [
        {label:'烤火取暖…', icon:'🔥', fn:function(){ closeModal(); openRestModal('campfire'); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('campfire'); }}
      ];
    },
    sleepmat: function(){
      return [
        {label:'躺下小睡…', icon:'💤', fn:function(){ closeModal(); openRestModal('sleepmat'); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('sleepmat'); }}
      ];
    }
  };
  // 休息设施配置：不同设施恢复效率不同，休息时长可由玩家自选
  var REST_KINDS = {
    tent:     { name:'帐篷',   hp: 0.35, mp: 0.35, en: 0.40, fd: 0.30, dr: 0.30 }, // 帐篷：全恢复效率最高
    sleepmat: { name:'草席',   hp: 0.22, mp: 0.22, en: 0.32, fd: 0.20, dr: 0.20 }, // 草席：中等
    campfire: { name:'篝火',   hp: 0.10, mp: 0.10, en: 0.38, fd: 0.50, dr: 0.50 }, // 篝火：暖身解饥渴、精力恢复快
    wild:     { name:'野外露宿', hp: 0.12, mp: 0.12, en: 0.30, fd: 0.16, dr: 0.16 }, // 荒野扎营：以地为席，聊胜于无
    ground:   { name:'席地打盹', hp: 0.08, mp: 0.08, en: 0.22, fd: 0.12, dr: 0.12 }  // 就地：聊胜于无
  };
  // 天候对野外歇息效率的折扣（键=天候索引；无折扣项=1）。帐篷遮风挡雨不受天候影响；
  // 城市/建筑内歇息同样不受影响（outdoorRestFactor 先判 isField）。
  var WX_REST={
    3:{campfire:0.85, sleepmat:0.9, wild:0.9,  ground:0.85},  // 微雨：略打折扣
    4:{campfire:0.5,  sleepmat:0.6, wild:0.55, ground:0.5},   // 大雨：露天皆难安身
    5:{campfire:0.8,  sleepmat:0.8, wild:0.75, ground:0.7}    // 雪：天寒，无蔽风雪者折扣
  };
  function outdoorRestFactor(kind){
    if(kind==='tent') return 1;
    var _r=G.ROOMS[S().room]; if(!_r || !_r.isField) return 1;
    var _t=WX_REST[S().weather]; if(!_t) return 1;
    return (_t[kind]!=null) ? _t[kind] : 1;
  }
  // 打开自由时长休息面板（设施决定效率；战败只能就地打盹）
  function openRestModal(kind){
    if(getCombatMode()!==null){ toast('正与敌缠斗，先应敌！'); return; }
    if(S().dead){ die(); return; }
    if(S().defeated && kind!=='ground'){ toast('你重伤未愈，动弹不得，只能席地打盹。'); kind='ground'; }
    openModal('rest', {kind:kind});
  }
  // ══ 仓库系统（v20260907k）：城中仓库 30 格，可存可取；苦役营初始存有木料石料 ══
  var storageCid=null;   // 当前仓库所在城（openModal 写入）；storageSel 已随仓库簇移入 shared/core/storage.js
  // 牢中打盹场景（v20260911k）：时辰尚未启用（教学期）且人在牢里时，
  //   「歇几个时辰」这套问法本身就是个假问题 —— 更鼓还没开始走，玩家也答不上来。
  //   故改为一键「就此睡去」，睡多久由天定（见 doNap），醒来只知天光未变。
  function cellNapScene(){
    if(clockFlowing()) return false;                          // 时辰已在流动：照常走「歇息」面板
    if((restState.kind||'ground')==='ground') return false;    // 席地打盹（战败/野外）不走这一套
    if(inCellNow()) return true;                              // 牢房格 / 天字地字号子牢房
    return S().room==='camp_cell';
  }
  function renderRestPanel(){
    var kind = (restState.kind||'ground');
    var cfg = REST_KINDS[kind] || REST_KINDS.ground;
    var wxFac = outdoorRestFactor(kind);
    if(cellNapScene()){
      // 不打时长牌、不报恢复量：玩家此刻只知道「睡了」，不该知道睡了几个时辰
      return '<h3 style="text-align:center;margin:0 0 6px;">草荐 · 打盹</h3>'
        + '<p class="tip">草荐又硬又潮，翻身便窸窣作响。四下里黑得沉，也听不见更鼓——只管合眼睡去。</p>'
        + '<button class="sheet-btn" style="margin:6px 0;" id="m-rest-nap">就此睡去</button>'
        + '<button class="sheet-leave" id="m-rest-leave">收 工</button>';
    }
    // 休息时长档位：1 / 3 / 6 时辰，恢复量随时长线性增长
    var opts = [ {h:1, lb:'小憩 · 1 时辰'}, {h:3, lb:'安睡 · 3 时辰'}, {h:6, lb:'酣眠 · 6 时辰'} ];
    var esR = effectiveStats();
    function est(h){
      return '精力+'+Math.round(esR.maxEnergy*cfg.en*h*wxFac)+'　气血+'+Math.round(esR.maxHp*cfg.hp*h*wxFac)
        + (esR.maxMp>0?('　内力+'+Math.round(esR.maxMp*cfg.mp*h*wxFac)):'')
        + '　饥渴+'+Math.round(100*cfg.fd*h*wxFac)+'%';
    }
    var h = '<h3 style="text-align:center;margin:0 0 6px;">'+cfg.name+' · 歇息</h3>'
      + '<p class="tip">歇息推进时辰，恢复随长短而异；饥渴食水亦会流逝。'+est(1)+'。'
      + (wxFac<1 ? '<br><span style="color:#b8893a;">〔'+((WEATHERS[S().weather]||{}).n||'')+'〕野外无遮蔽，歇息恢复打折。</span>' : '')
      + '</p>';
    opts.forEach(function(o){
      h += '<button class="sheet-btn" style="margin:6px 0;" data-rest="'+o.h+'">'+o.lb+'<br><span style="font-size:12px;opacity:.75;">'+est(o.h)+'</span></button>';
    });
    h += '<button class="sheet-leave" id="m-rest-leave">收 工</button>';
    return h;
  }
  function bindRestPanel(){
    $card.querySelectorAll('[data-rest]').forEach(function(b){
      b.onclick=function(){ doRest(parseInt(b.getAttribute('data-rest'),10)||1); };
    });
    var np=document.getElementById('m-rest-nap'); if(np) np.onclick=function(){ doNap(); };
    var lv=document.getElementById('m-rest-leave'); if(lv) lv.onclick=closeModal;
    var ck=document.getElementById('m-rest-cook'); if(ck) ck.onclick=function(){ closeModal(); openModal('craft',{bench:'kitchen'}); };
  }
  // 执行自由时长休息：推进时间并按要求恢复（野外天候差时打折，见 outdoorRestFactor）
  function doRest(hours){
    var kind = restState.kind || 'ground';
    var cfg = REST_KINDS[kind] || REST_KINDS.ground;
    var wxFac = outdoorRestFactor(kind);
    var esR = effectiveStats();
    advanceTime(hours);
    var hpGain = Math.round(esR.maxHp*cfg.hp*hours*wxFac);
    var mpGain = esR.maxMp>0 ? Math.round(esR.maxMp*cfg.mp*hours*wxFac) : 0;
    var enGain = Math.round(esR.maxEnergy*cfg.en*hours*wxFac);
    S().hp = Math.min(esR.maxHp, (S().hp||0)+hpGain);
    if(S().mp>0) S().mp = Math.min(esR.maxMp, (S().mp||0)+mpGain);
    S().energy = Math.min(S().maxEnergy, (S().energy||0)+enGain);
    S().food = Math.min(S().maxFood, (S().food||0)+Math.round(S().maxFood*cfg.fd*hours*wxFac));
    S().drink = Math.min(S().maxDrink, (S().drink||0)+Math.round(S().maxDrink*cfg.dr*hours*wxFac));
    if(S().defeated){ S().defeated=false; }
    save(S()); renderStatus();
    // v20260911k：去掉括号里那串「时辰未启／恢复折扣」的机制旁白 —— 睡前要的是一句交代，不是结算说明
    log('你在'+cfg.name+'歇了'+hours+'个时辰，气血、内力与精力渐复，饥渴也解了些。'
      +(wxFac<1?('（'+((WEATHERS[S().weather]||{}).n||'')+'天，无遮蔽处歇息费力，恢复打了折扣。）'):''),'good');
    closeModal();
    var _ambush = false;
    var _rroom = G.ROOMS[S().room];
    if(_rroom && _rroom.isField && kind!=='ground'){
      _ambush = maybeFieldAmbush(_rroom);   // 凶兽未清剿的野地扎营（无论露宿或支帐围火）醒转皆可能遭袭
    }
    if(!_ambush) buildActions(G.ROOMS[S().room]);
  }
  // 牢中一觉（v20260911k）：老师傅口中那句「也不知道睡了多久」——
  //   时长随机 1~3 时辰，只用来自算恢复量，绝不报给玩家；时辰未启时时钟本就冻结，
  //   醒来仍是那一线昏暗天光，昼夜不分（正是文案要传达的处境）。
  function doNap(){
    var kind = restState.kind || 'sleepmat';
    var cfg = REST_KINDS[kind] || REST_KINDS.ground;
    var wxFac = outdoorRestFactor(kind);
    var esR = effectiveStats();
    var hours = 1 + Math.floor(Math.random()*3);
    var hpGain = Math.round(esR.maxHp*cfg.hp*hours*wxFac);
    var mpGain = esR.maxMp>0 ? Math.round(esR.maxMp*cfg.mp*hours*wxFac) : 0;
    var enGain = Math.round(esR.maxEnergy*cfg.en*hours*wxFac);
    S().hp = Math.min(esR.maxHp, (S().hp||0)+hpGain);
    if(S().mp>0) S().mp = Math.min(esR.maxMp, (S().mp||0)+mpGain);
    S().energy = Math.min(S().maxEnergy, (S().energy||0)+enGain);
    S().food = Math.min(S().maxFood, (S().food||0)+Math.round(S().maxFood*cfg.fd*hours*wxFac));
    S().drink = Math.min(S().maxDrink, (S().drink||0)+Math.round(S().maxDrink*cfg.dr*hours*wxFac));
    if(S().defeated){ S().defeated=false; }
    save(S()); renderStatus();
    log('你也不知睡了多久。牢里光线昏暗，分不清是黑夜还是白昼。','good');
    closeModal();
    buildActions(G.ROOMS[S().room]);
  }
  // 城市格放置物定位（v20260825b）：城市网格内放置物带 {cell:{x,y}}，按格隔离，不再全城共享；
  // 旧存档无格坐标的放置物视为位于城心格，保证不"消失"。
    return {
      PLACE_ACTIONS, PLACE_KEY_DEF, REST_KINDS, WX_REST,
      actRest, bindRestPanel, cellNapScene, doNap,
      doRest, openRestModal, outdoorRestFactor, renderRestPanel,
      storageCid,
    };
  };
})(typeof window !== 'undefined' ? window : global);

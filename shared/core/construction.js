window.LF = window.LF || {};
(function(){
  // 放置 / 营造系统（v20261008j 从 engine.js 抽出）
  // 职责：可放置物动作表(PLACE_ACTIONS)、休息设施配置(REST_KINDS/WX_REST)、放置物↔场景物件映射、
  // 工地营造全流程（查看/填充/搭建/落成）。深度依赖引擎可变状态，故全部经 getter 惰性注入。
  LF.createConstruction = function(ctx){
    var LF = ctx.LF, G = ctx.G;
    var getState = ctx.getState, getBuildState = ctx.getBuildState,
        getcurrentModalKind = ctx.getcurrentModalKind,
        getPackInspect = ctx.getPackInspect, setPackInspect = ctx.setPackInspect,
        getRoomObjects = ctx.getRoomObjects, getShop = ctx.getShop;
    // 引擎侧依赖全是「getter（调用后才返回真正函数）」：统一包一层 _wf，
    //   使模块内 toast('…') / save(state) / isBldRoom(rid) 在运行时先取真身再转发参数。
    //   否则 isBldRoom(roomId) 只会取回函数本身(恒为真) → 任何房间都误判为楼房间并崩在 _f.ar.objs。
    var _wf = function(getter){
      return function(){ var fn = getter(); return fn.apply(null, arguments); };
    };
    var curRoom = _wf(ctx.getCurRoom), itemIconHTML = _wf(ctx.getItemIconHTML),
        toast = _wf(ctx.getToast), log = _wf(ctx.getLog), afterPackChange = _wf(ctx.getAfterPackChange),
        packAdd = _wf(ctx.getPackAdd), packFind = _wf(ctx.getPackFind), packConsume = _wf(ctx.getPackConsume),
        openModal = _wf(ctx.getOpenModal), openForgePanel = _wf(ctx.getOpenForgePanel), enterBldRoom = _wf(ctx.getEnterBldRoom),
        save = _wf(ctx.getSave), advanceMinutes = _wf(ctx.getAdvanceMinutes), buildActions = _wf(ctx.getBuildActions),
        isBldRoom = _wf(ctx.getIsBldRoom), isCityGrid = _wf(ctx.getIsCityGrid), genCityGrid = _wf(ctx.getGenCityGrid),
        bldForRoom = _wf(ctx.getBldForRoom), bldActsFilter = _wf(ctx.getBldActsFilter), bldMove = _wf(ctx.getBldMove),
        closeModal = _wf(ctx.getCloseModal), openRestModal = _wf(ctx.getOpenRestModal),
        shuicaoDrinkPlaced = _wf(ctx.getShuicaoDrinkPlaced), shuicaoFillPlaced = _wf(ctx.getShuicaoFillPlaced),
        shuicaoDrawToBag = _wf(ctx.getShuicaoDrawToBag);
  // ===== 通用可放置物品（模板驱动：物品定义 place 字段 → 场景对象） =====
  // 放置物动作表：place.actions 字符串 → 动作函数（物品数据外置，动作需在此注册）
  // 旧存档兼容：早期放置数据仅存 {key:'tent'}（无 defId），用此表回填物品
  var PLACE_KEY_DEF = { tent:'zhangpeng', p_bench:'gongzuotai', campfire:'campfire', sleepmat:'sleepmat', zhangtai:'zhangtai', shop_shelf:'shelf_wood' };
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
    },
    // v20260930：账台（P0 经营入口）。玩家在自家铺面放置后，点之即入经营总览（上帝视角）。
    //   因是玩家放置物，故只出现于自己的店，天然满足「别人店不显示」的约束。
    manage_shop: function(p){
      return [
        {label:'经营总览…', icon:'📊', fn:function(){ closeModal(); openModal('shop_manage', {placed:p}); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('zhangtai'); }}
      ];
    },
    container: function(p){
      return [
        {label:'打开', icon:'📂', fn:function(){ closeModal(); openModal('container', {placed:p}); }},
        {label:'收起', icon:'📦', fn:function(){ getShop().contPickup(p); }}
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

  // 打开自由时长休息面板（设施决定效率；战败只能就地打盹）

  // ══ 仓库系统（v20260907k）：城中仓库 30 格，可存可取；苦役营初始存有木料石料 ══
  var storageCid=null;   // 当前仓库所在城（openModal 写入）；storageSel 已随仓库簇移入 shared/core/storage.js
  // 牢中打盹场景（v20260911k）：时辰尚未启用（教学期）且人在牢里时，
  //   「歇几个时辰」这套问法本身就是个假问题 —— 更鼓还没开始走，玩家也答不上来。
  //   故改为一键「就此睡去」，睡多久由天定（见 doNap），醒来只知天光未变。

  // 执行自由时长休息：推进时间并按要求恢复（野外天候差时打折，见 outdoorRestFactor）

  // 牢中一觉（v20260911k）：老师傅口中那句「也不知道睡了多久」——
  //   时长随机 1~3 时辰，只用来自算恢复量，绝不报给玩家；时辰未启时时钟本就冻结，
  //   醒来仍是那一线昏暗天光，昼夜不分（正是文案要传达的处境）。

  // 城市格放置物定位（v20260825b）：城市网格内放置物带 {cell:{x,y}}，按格隔离，不再全城共享；
  // 旧存档无格坐标的放置物视为位于城心格，保证不"消失"。
  function placedCellTag(roomId){
    var cp=getState().flags && getState().flags.cityPos;
    if(!cp || !isCityGrid(roomId) || cp.cid!==roomId) return null;
    return {x:cp.x, y:cp.y};
  }
  function placedInCell(p, roomId, tag){
    if(!tag) return true;                       // 非城市房间：全部在当前房间可见
    var c=p.cell;
    if(!c){                                     // 旧存档无格数据 → 归城心格
      var m=genCityGrid(roomId); if(!m) return true;
      var s=m.size; c={x:Math.floor(s/2), y:Math.floor(s/2)};
    }
    return c.x===tag.x && c.y===tag.y;
  }

  // 玩家放置物 → 场景物件（统一映射，城市/野外/建筑内部房间共用）
  function placedFeature(p){
    if(p.bp){
      var bp = LF.BUILD[p.bp] || {};
      if(p.done){
        return {type:'feature', key:bp.key||p.key, icon:itemIconHTML({name:bp.doneName||'建筑'}, 14), name:bp.doneName||'建筑', desc:bp.desc||'', actions:buildDoneActions(bp.key||p.key, bp)};
      }
      return {type:'feature', key:bp.key||p.key, icon:itemIconHTML({name:bp.siteName||'营造中'}, 14), name:bp.siteName||'营造中', desc:bp.desc||'', actions:buildSiteActions(bp.key||p.key)};
    }
    var defId = p.defId || PLACE_KEY_DEF[p.key];
    var pl = ((LF.ITEMS[defId]||{}).place) || {};
    var acts = (PLACE_ACTIONS[pl.actions] || function(){ return []; })(p);
    return {type:'feature', key:pl.key||p.key, icon:itemIconHTML({name:pl.name||'未知物'}, 14), name:pl.name||'未知物', desc:pl.desc||'', actions:acts};
  }
  // 合并静态 getRoomObjects() 与玩家动态放置物，供场景/列表/出口统一读取
  function roomObjs(roomId, opts){
    // 建筑内部房间：interior/子区域的物件 + 子区域跳转 + 玩家在房内放置物 → 场景按钮
    // （返回街道/返回正堂统一收进底部移动罗盘，见 renderMoveBar 的 isBldRoom 分支，避免重复）
    if(isBldRoom(roomId)){
      var _f=bldForRoom(roomId), _out=[];
      if(_f){
        (_f.ar.objs||[]).forEach(function(o,i){
          _out.push({type:'feature', key:'bldo_'+roomId+'_'+i, icon:o.icon, name:o.name, desc:o.desc, actions:bldActsFilter(o.acts)});
        });
        (_f.ar.areas||[]).forEach(function(a){
          _out.push({type:'feature', key:'blda_'+roomId+'_'+a.key, icon:'🚪', name:a.label||a.key, desc:'', direct:true, actions:[{label:a.label||a.key, icon:'🚪', fn:(function(tid){ return function(){ bldMove(tid); }; })('__bld__'+_f.key+'@'+a.key)}]});
        });
        // v20260928g：房间内出口（返回正堂/返回街道）不再设置场景交互按钮——
        //   统一收进底部移动罗盘（renderMoveBar isBldRoom 分支的罗盘「南·返回」），
        //   仅当房间内还有子区域时，子区域入口仍保留为场景按钮（上方 blda_）。
      }
      // 玩家在房内放置的物件（帐篷/篝火…）：按本房间 id 隔离，进店/进房后也保留可见（v20260825c）
      var _placed=(getState().placed && getState().placed[roomId]) || [];
      _placed.forEach(function(p){ var _o=placedFeature(p); if(_o) _out.push(_o); });
      return _out;
    }
    var base = getRoomObjects()[roomId] || [];
    var placed = (getState().placed && getState().placed[roomId]) || [];
    var _cellTag = placedCellTag(roomId);
    var dyn = placed.filter(function(p){ return placedInCell(p, roomId, _cellTag); }).map(placedFeature);
    // 放置物覆盖同 key 的静态 feature（如收起的工作台摆放后，静态木工台不再重复显示）
    var dynKeys={}; dyn.forEach(function(o){ dynKeys[o.key]=1; });
    // placedOnly：仅渲染玩家放置物（城市网格等由 cell 动作/左栏 NPC 承担场景内容，屏蔽旧版静态 getRoomObjects() 条目）
    var filteredBase = opts && opts.placedOnly ? [] : base.filter(function(o){ return !(o.type==='feature' && dynKeys[o.key]); });
    return filteredBase.concat(dyn);
  }
  function placeInspect(){
    if(!getPackInspect() || getPackInspect().kind!=='pack') return;
    var idx=getPackInspect().idx; var it=getState().pack[idx];
    if(!it) return;
    var _tag=placedCellTag(getState().room);   // 城市网格：放置物归当前格（cell），跨格隔离
    // 图纸类：依图在房中营造建筑（多阶段、需填充材料）
    var bpId = (LF.ITEMS[it.defId]||{}).blueprint;
    if(bpId){
      var bp = LF.BUILD[bpId] || {};
      getState().placed = getState().placed || {};
      getState().placed[getState().room] = getState().placed[getState().room] || [];
      if(getState().placed[getState().room].some(function(o){ return o.bp===bpId && placedInCell(o, getState().room, _tag); })){ toast('此处已在营造'+(bp.siteName||'该建筑')+'。'); return; }
      if(it.count && it.count>1){ it.count--; } else { getState().pack[idx]=null; }
      getState().placed[getState().room].push({key:bp.key, defId:it.defId, bp:bpId, stage:0, got:{}, cell:_tag});
      setPackInspect(null);
      afterPackChange();
      log('你展开'+it.name+'，依图在'+curRoom().name+'勘定地基，开工营造。','sys');
      if(getcurrentModalKind()==='pack'){ var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
      return;
    }
    var pl = (it && (it.place || ((LF.ITEMS[it.defId]||{}).place))) || null;
    if(!(it.placeable || pl)) return;
    getState().placed = getState().placed || {};
    getState().placed[getState().room] = getState().placed[getState().room] || [];
    // v20261008c：货架三兄弟（木/铁/雕花）此前共用 key 'shop_shelf'，同房间/同格互相拦截，
    //   造成"放了木架就放不了铁架"。冲突判定改为按具体物品（defId）——同种才互斥，
    //   不同种（如木架+铁架、木架+柜子）可同房间/同格并置；旧存档无 defId 时按 key 回退。
    if(getState().placed[getState().room].some(function(o){
      if(!placedInCell(o, getState().room, _tag)) return false;
      var od = o.defId || PLACE_KEY_DEF[o.key];
      return it.defId ? (od === it.defId) : (o.key === pl.key);
    })){ toast('此处已支有'+pl.name+'，欲换新样须先收起旧物。'); return; }
    if(it.count && it.count>1){ it.count--; } else { getState().pack[idx]=null; }
    getState().placed[getState().room].push({key:pl.key, defId:it.defId, cell:_tag});
    setPackInspect(null);
    afterPackChange();
    log('你支起'+pl.name+'，安置于'+curRoom().name+'。','sys');
    if(getcurrentModalKind()==='pack'){ var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
  }
  function packUpPlaced(key){
    getState().placed = getState().placed || {};
    var arr = getState().placed[getState().room];
    var _tag=placedCellTag(getState().room);
    if(!arr || !arr.some(function(o){ return o.key===key && placedInCell(o, getState().room, _tag); })){ toast('此处并无此物可收。'); return; }
    var p=null;
    for(var i=0;i<arr.length;i++){ if(arr[i].key===key && placedInCell(arr[i], getState().room, _tag)){ p=arr[i]; arr.splice(i,1); break; } }
    var defId = p.defId || PLACE_KEY_DEF[p.key];
    var ok = packAdd(defId, 1);
    if(!ok){ if(p) arr.push(p); toast('行囊已满，无法收起。'); return; }
    setPackInspect(null);
    afterPackChange();
    log('你收起'+((LF.ITEMS[defId]||{}).name||'此物')+'，收进行囊。','sys');
    if(getcurrentModalKind()==='pack'){ var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
  }
  // ===== 营造系统：蓝图 → 工地 → 填充材料 → 分阶搭建 → 落成 =====
  // 工地/建筑在 placed 中以 { key, defId, bp, stage, got, done } 存储（见 roomObjs 渲染）
  function findPlacedBp(siteKey){
    var arr = (getState().placed && getState().placed[getState().room]) || [];
    var _tag=placedCellTag(getState().room);
    for(var i=0;i<arr.length;i++){ if(arr[i].key===siteKey && placedInCell(arr[i], getState().room, _tag)) return arr[i]; }
    return null;
  }
  function buildSiteActions(siteKey){
    return [
      {label:'查看进度', icon:'📋', fn:function(){ inspectBuildSite(siteKey); }},
      {label:'填充材料', icon:'🧺', fn:function(){ openModal('build', {site:siteKey}); }},
      {label:'搭建', icon:'🔨', fn:function(){ buildStage(siteKey); }}
    ];
  }
  function buildDoneActions(siteKey, bp){
    var acts = [];
    if(bp.done === 'forge'){
      acts.push({label:'炉膛…', icon:'🔥', fn:function(){ openForgePanel(siteKey); }});
      acts.push({label:'打造…', icon:'⚒️', fn:function(){ openModal('craft', {bench:'forge'}); }});
    }
    // 蓝图含 interior 时：建成后可步入，成为可进出的独立房间（左下 NPC + 上方交互物件）
    if(bp.interior && bp.interior.length){
      acts.push({label:'进·'+(bp.doneName||'屋内'), icon:itemIconHTML({name:bp.doneName||'屋内'},13), fn:function(){
        var _p=findPlacedBp(siteKey); if(_p) enterBldRoom('site_'+siteKey, {kind:'room', room:getState().room, bp:_p.bp});
      }});
    }
    acts.push({label:'端详', icon:'👁', fn:function(){ log('〔'+bp.doneName+'〕'+(bp.desc||''), 'sys'); }});
    return acts;
  }
  function inspectBuildSite(siteKey){
    var p = findPlacedBp(siteKey); if(!p) return;
    var bp = LF.BUILD[p.bp]; if(!bp) return;
    var stages = bp.stages || [];
    if(p.done){ log('〔'+bp.doneName+'〕'+bp.desc, 'good'); return; }
    var stage = stages[p.stage];
    if(!stage){ log('〔'+bp.siteName+'〕工事已完，只待收尾落成。', 'sys'); return; }
    var parts = [];
    for(var k in stage.need){
      var it = LF.ITEMS[k] || {};
      parts.push((it.name||k)+' '+(p.got[k]||0)+'/'+stage.need[k]);
    }
    var next = stages[p.stage+1] ? '；完成后将进行「'+stages[p.stage+1].name+'」' : '；此为最后一程，搭建完毕即可落成';
    log('〔'+bp.siteName+'·第'+(p.stage+1)+'/'+stages.length+'阶·'+stage.name+'〕所需：'+parts.join('、')+next, 'sys');
  }
  function buildAddMat(siteKey, matId){
    var p = findPlacedBp(siteKey); if(!p) return;
    var bp = LF.BUILD[p.bp]; if(!bp || p.done) return;
    var stage = (bp.stages||[])[p.stage]; if(!stage) return;
    var need = stage.need[matId]; if(!need) return;
    if((p.got[matId]||0) >= need){ toast('该材料已填满此阶段所需。'); return; }
    var cur = packFind(matId);
    if(!cur || (cur.count||0) < 1){ toast('行囊中无'+(LF.ITEMS[matId]||{}).name+'。'); return; }
    if(getState().energy<=0){ toast('精力已尽，先休整恢复再行填充。'); return; }
    advanceMinutes(60);
    getState().energy=Math.max(0,getState().energy-1);
    packConsume(matId, 1);
    p.got[matId] = (p.got[matId]||0) + 1;
    save(getState()); afterPackChange();
    var matName=(LF.ITEMS[matId]||{}).name || matId;
    log('你填入'+matName+'×1，'+stage.name+'更近一步。','env');
    getBuildState().msg = '已填入 '+matName+'×1，'+stage.name+'更近一步。';
    if(getcurrentModalKind()==='build') openModal('build', {site:siteKey});
  }
  function buildStage(siteKey){
    var p = findPlacedBp(siteKey); if(!p) return;
    var bp = LF.BUILD[p.bp]; if(!bp) return;
    var stages = bp.stages || [];
    if(p.done){ toast(bp.doneName+'已然落成。'); return; }
    var stage = stages[p.stage];
    if(!stage){ p.done = true; save(getState()); afterPackChange(); log('工事收尾，'+bp.doneName+'落成！','good'); buildActions(G.ROOMS[getState().room]); return; }
    for(var k in stage.need){ if((p.got[k]||0) < stage.need[k]){ toast('「'+stage.name+'」材料未齐，无法搭建。'); return; } }
    if(getState().energy<=0){ toast('精力已尽，先休整恢复再行搭建。'); return; }
    advanceMinutes(60);
    getState().energy=Math.max(0,getState().energy-2);
    p.stage++;
    save(getState()); afterPackChange();
    if(p.stage >= stages.length){
      p.done = true;
      log('你抟土垒石、架木为炉——'+bp.doneName+'终告落成！','good');
    } else {
      log('你完成了「'+stage.name+'」，工事推进至「'+stages[p.stage].name+'」。','env');
    }
    buildActions(G.ROOMS[getState().room]);
  }
  // 休息面板（真对象在 createRest 前 L245 赋值；此处仅保留声明防 var 提升覆盖）
  var restState;
  // 营造面板
  function buildMatRows(siteKey){
    var p = findPlacedBp(siteKey); if(!p) return '<p class="tip">此处并无营造工地。</p>';
    var bp = LF.BUILD[p.bp]; if(!bp) return '<p class="tip">未知图纸。</p>';
    if(p.done) return '<p class="tip">'+bp.doneName+'已然落成。'+(bp.desc||'')+'</p>';
    var stages = bp.stages || [];
    var stage = stages[p.stage];
    if(!stage) return '<p class="tip">工事已完，只待收尾——去工地「搭建」即可落成。</p>';
    var html = '<p class="tip">营造进度：'+p.stage+' / '+stages.length+'　当前·<b>'+stage.name+'</b></p>';
    for(var k in stage.need){
      var it = LF.ITEMS[k] || {};
      var have = p.got[k] || 0;
      var need = stage.need[k];
      var packN = (packFind(k)||{count:0}).count;
      var done = have >= need;
      html += '<div style="display:flex;align-items:center;gap:8px;border:1px solid #6b5a3a;border-radius:8px;padding:8px;margin:6px 0;background:rgba(0,0,0,.18);">'
        + '<span>'+itemIconHTML(it, 18)+'</span>'
        + '<span style="opacity:.8;flex:1;">'+have+' / '+need+'　·　行囊'+packN+'</span>'
        + (done ? '<span style="color:#8fce8f;">已备齐</span>' : '<button class="btn-mini" data-site="'+siteKey+'" data-mat="'+k+'">填充</button>')
        + '</div>';
    }
    return html;
  }
    return { PLACE_KEY_DEF: PLACE_KEY_DEF, PLACE_ACTIONS: PLACE_ACTIONS, REST_KINDS: REST_KINDS, WX_REST: WX_REST,
             placedCellTag: placedCellTag, placedInCell: placedInCell, placedFeature: placedFeature, roomObjs: roomObjs,
             placeInspect: placeInspect, packUpPlaced: packUpPlaced, findPlacedBp: findPlacedBp,
             buildSiteActions: buildSiteActions, buildDoneActions: buildDoneActions, inspectBuildSite: inspectBuildSite,
             buildAddMat: buildAddMat, buildStage: buildStage };
  };
})();

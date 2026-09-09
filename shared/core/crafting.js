// 资源加工链：采集 / 制作 / 锻造（v20260909j）
// 从 engine.js 拆出：
//  - 野外采集：gatherActs / startGather / doPickGather（草药两段式）；
//  - 伐木与测试房采集：chopTree / searchBench / pickupAxe / consumeTool（工具耐久消耗）；
//  - 建材场：mineStone（采石） / cutWood（伐木场） / fireBrick（砖窑） / openBuildCrate（拾图）；
//  - 制作面板：craftState 面板逻辑 buildCraftHTML / renderCraftPanel / bindCraftPanel / doCraft（木工台/灶台/锻造台共用）；
//  - 冶炼炉膛：findForge / ensureForgeState / openForgePanel / renderForgePanel / bindForgePanel / forgeAct / tickForge（炉火随时辰推进）。
// craftState / forgeState 两个可变状态【留在引擎】——openModal 的 'craft'/'forge' 分支会直接写入
// （craftState.bench / forgeState.site），故本模块经 ctx.getCraftState / ctx.getForgeState 取得同一对象引用后读写字段。
// 引擎侧对 renderCraftPanel/bindCraftPanel/doCraft/forgeAct/tickForge/openForgePanel 等的调用全部经引擎 var 同名别名接管。
// 依赖经 ctx 注入：getState（S() 惰性）；getCard（$card）；LF（LF.RECIPES/LF.ITEMS/LF.BUILD）；G（G.ROOMS 场景刷新）；
// packFind/packAdd/packConsume/packIsStackable/packFirstEmpty/itemKey（背包操作）；
// placedCellTag/placedInCell（放置物按格隔离/可见性判定，引擎侧保留）；
// advanceTime/afterPackChange/save/log/toast/openModal/closeModal/renderRoom/buildActions/exert/itemIconHTML。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createCrafting = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getCraftState = ctx.getCraftState, getForgeState = ctx.getForgeState;
    var getCard = ctx.getCard;
    var placedCellTag = ctx.placedCellTag, placedInCell = ctx.placedInCell;
    var LF = ctx.LF, G = ctx.G;
    var packFind = ctx.packFind, packAdd = ctx.packAdd, packConsume = ctx.packConsume,
        packIsStackable = ctx.packIsStackable, packFirstEmpty = ctx.packFirstEmpty, itemKey = ctx.itemKey;
    var itemIconHTML = ctx.itemIconHTML;
    var advanceTime = ctx.advanceTime, afterPackChange = ctx.afterPackChange, save = ctx.save;
    var log = ctx.log, toast = ctx.toast, openModal = ctx.openModal, closeModal = ctx.closeModal,
        renderRoom = ctx.renderRoom, buildActions = ctx.buildActions, exert = ctx.exert;

    // ===== 野外采药（北邙山林·草药丛） =====
    // 状态机：点击「采集草药」→ 耗时 1 时辰，草丛变为「可拾取」；点击「拾取草药」入包，满则提示
    function gatherActs(){
      var st=S();
      var g=st.gather;
      if(g && g.room===st.room && g.phase==='ready'){
        return [{label:'拾取草药', icon:'🌿', fn:function(){ doPickGather(); }}];
      }
      return [{label:'采集草药', icon:'🌿', fn:function(){ startGather(); }}];
    }
    function startGather(){
      var st=S();
      if(st.defeated){ toast('重伤未愈，先调息恢复。'); return; }
      st.gatherCount = st.gatherCount || {};
      var k = st.room + '@' + st.day;
      if((st.gatherCount[k]||0) >= 3){ toast('此处今日已采过三回，草药渐稀，明日再来。'); return; }
      advanceTime(1);                                   // 采撷耗约一个时辰
      st.gatherCount[k] = (st.gatherCount[k]||0) + 1;
      st.gather = { room: st.room, phase: 'ready' };
      log('你蹲身拨开草叶，俯首采撷，忙活约一个时辰——草丛间已遗下可拾之药。','env');
      renderRoom(st.room);                           // 重渲后按钮变为「拾取草药」
    }
    function doPickGather(){
      var st=S();
      if(!st.gather || st.gather.room!==st.room || st.gather.phase!=='ready') return;
      var n = 2 + Math.floor(Math.random()*2);            // 得草药 2~3 株
      var it = LF.ITEMS.makeItem('caoyao', n);
      // 预判能否装入（与 packAdd 逻辑一致：可堆叠同物，或有空位）
      var ok=false;
      if(packIsStackable(it)){ var kk=itemKey(it); for(var i=0;i<st.pack.length;i++){ var c=st.pack[i]; if(c && itemKey(c)===kk && c.cat!=='装备'){ ok=true; break; } } }
      if(!ok){ if(packFirstEmpty()>=0) ok=true; }
      if(!ok){ toast('行囊已满，草药散落于地，无处安放——腾出空位再来拾取。'); return; }
      packAdd(it);                                       // 此时必能装入
      st.gather = null;
      log('你拾起野草 '+n+' 株，收入行囊（可往「草庐/客栈」合成疗伤之物）。','good');
      afterPackChange(); renderRoom(st.room);
    }

    // ===== 建造系统测试房间：采集(砍树) → 制作(木工台) 垂直切片 =====
    function chopTree(){
      var st=S();
      if(st.defeated){ toast('重伤未愈，先调息恢复。'); return; }
      var hasIronAxe = !!packFind('tiefu');
      var withAxe = hasIronAxe || !!packFind('futou');   // 执行时实时判定，避免拾斧后菜单仍显示旧状态
      advanceTime(1);
      if(hasIronAxe) consumeTool('tiefu',1);
      else if(withAxe) consumeTool('futou',1);
      if(withAxe){
        var n = hasIronAxe ? 2 : 1;
        packAdd('mutou', n);
        log('你抡'+(hasIronAxe?'铁':'锈')+'斧，咔咔几声，老树应声倒下，得木头×'+n+'。','env');
      } else {
        packAdd('xiaoshuzhi', 1);
        log('你徒手折下几根细枝，捋得小树枝×1。若有把斧头，便能伐得粗实木头。','env');
      }
      afterPackChange();
      buildActions(G.ROOMS[st.room]);   // 刷新场景物体（斧头/材料状态即时反映到菜单）
    }

    function searchBench(){
      var st=S();
      st.flags = st.flags || {};
      if(st.flags.buildTestSearched){ toast('木工台已翻找过了。'); return; }
      st.flags.buildTestSearched = true;
      packAdd('mutou', 1);
      afterPackChange();
      log('你翻了翻木工台，台板下压着一根边角木头，顺手收了。','sys');
      buildActions(G.ROOMS[st.room]);   // 仅刷新物体（移除「翻找」），不重播场景旁白
    }

    // 制作面板：buildCraftHTML/renderCraftPanel 按 craftState（留在引擎）的工作台读 LF.RECIPES 渲染配方
    function buildCraftHTML(){
      var cs = getCraftState();
      var recipes = (LF.RECIPES && LF.RECIPES[cs.bench]) || [];
      var DEFS = LF.ITEMS;
      function cnt(id){ var it=packFind(id); return it?it.count:0; }
      // 按 cat 分组（保持首次出现顺序）
      var cats = [], idx = {};
      recipes.forEach(function(r){ if(idx[r.cat]==null){ idx[r.cat]=cats.length; cats.push(r.cat); } });
      if(!cs.cat || cats.indexOf(cs.cat)<0) cs.cat = cats[0];
      var activeCat = cs.cat;
      function rowHTML(r){
        var can=r.in.every(function(x){ return cnt(x.id)>=x.n; });
        var ins=r.in.map(function(x){ var d=DEFS[x.id]||{}; return itemIconHTML(d,16)+'×'+x.n+' <span style="opacity:.6">('+cnt(x.id)+')</span>'; }).join(' ＋ ');
        var od=DEFS[r.out]||{};
        var btn='<button class="sheet-btn" '+(can?'':'data-dis="1" style="opacity:.45;"')+' data-r="'+r.id+'">'+(can?'制 作':'材 料 不 足')+'</button>';
        return '<div style="border:1px solid #6b5a3a;border-radius:8px;padding:10px;margin:8px 0;background:rgba(0,0,0,.18);">'+
                 '<div style="font-size:16px;margin-bottom:4px;">'+itemIconHTML(od,20)+' <b>'+od.name+'×'+r.outN+'</b></div>'+
                 '<div style="font-size:13px;color:#d8c9a8;margin-bottom:6px;">'+ins+'</div>'+
                 '<div style="font-size:12px;opacity:.6;margin-bottom:8px;">'+r.note+'</div>'+
                 btn+'</div>';
      }
      var tabHTML = cats.map(function(c){
        var on = (c===activeCat) ? ' style="background:linear-gradient(180deg,#6e5a36,#4a3a22);color:#ffe9b8;border-color:#d8b46a;"' : '';
        return '<button class="craft-tab" data-cat="'+c+'"'+on+'>'+c+'</button>';
      }).join('');
      var rows = recipes.filter(function(r){ return r.cat===activeCat; }).map(rowHTML).join('');
      return '<h3 style="text-align:center;margin:0 0 4px;">🔨 木工台 · 制作</h3>'+
             (cats.length>1 ? '<div class="craft-tabs" style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;flex-wrap:wrap;">'+tabHTML+'</div>' : '')+
             '<p class="tip" style="text-align:center;margin:0 0 10px;">选一配方，将材料加工成形</p>'+
             rows+
             '<button class="sheet-leave" id="m-leave">收 工</button>';
    }
    function renderCraftPanel(){ return buildCraftHTML(); }
    function bindCraftPanel(){
      var card = getCard();
      card.querySelectorAll('.craft-tab').forEach(function(t){
        t.onclick=function(){ getCraftState().cat = t.getAttribute('data-cat'); card.innerHTML=buildCraftHTML(); bindCraftPanel(); };
      });
      card.querySelectorAll('.sheet-btn[data-r]').forEach(function(b){
        b.onclick=function(){ if(b.getAttribute('data-dis')) return; doCraft(b.getAttribute('data-r')); };
      });
      var lv=document.getElementById('m-leave'); if(lv) lv.onclick=closeModal;
    }
    function doCraft(id){
      var cs = getCraftState();
      var list = (LF.RECIPES && LF.RECIPES[cs.bench]) || [];
      var r=null; for(var i=0;i<list.length;i++){ if(list[i].id===id){ r=list[i]; break; } }
      if(!r) return;
      for(var k=0;k<r.in.length;k++){ if((packFind(r.in[k].id)||{count:0}).count < r.in[k].n){ toast('材料不足，无法制作'+(LF.ITEMS[r.out]||{}).name); return; } }
      r.in.forEach(function(x){ packConsume(x.id, x.n); });
      packAdd(r.out, r.outN);
      advanceTime(1);
      afterPackChange();
      log('你于木工台上劳作，制成'+(LF.ITEMS[r.out]||{}).name+'×'+r.outN+'。','sys');
      var card = getCard();
      card.innerHTML=buildCraftHTML(); bindCraftPanel();
    }
    function pickupAxe(){
      var st=S();
      if(packFind('futou')){ toast('你已有一把斧头了。'); return; }
      packAdd('futou', 1);
      afterPackChange();
      log('你从墙角的工具堆里捡起一把锈迹斑斑的斧头，握在手里沉甸甸的。','sys');
      buildActions(G.ROOMS[st.room]);   // 拾斧后刷新，使老树菜单即时变为「挥斧伐木」
    }
    // 工具耐久消耗：从行囊中找可耗耐久的工具扣减，耗尽即损毁
    function consumeTool(defId, n){
      var st=S();
      for(var i=0;i<st.pack.length;i++){
        var it=st.pack[i]; if(!it || it.defId!==defId || !it.maxDur) continue;
        it.dur = (it.dur||0) - n;
        if(it.dur<=0){ st.pack[i]=null; log('你的'+it.name+'耐久耗尽，咔嚓一声损毁了。','sys'); }
        else if(it.dur<=2){ log(it.name+'已有些松垮（耐久 '+it.dur+'/'+it.maxDur+'），趁还能用多伐几根。','sys'); }
        return;
      }
    }

    // ===== 采石崖：采石料（每日限次，与采药一致） =====
    function mineStone(){
      var st=S();
      if(st.defeated){ toast('重伤未愈，先调息恢复。'); return; }
      st.buildCount = st.buildCount || {};
      var k = st.room + '@' + st.day;
      if((st.buildCount[k]||0) >= 3){ toast('此处今日已采过三回，崖壁渐薄，明日再来。'); return; }
      advanceTime(1);
      st.buildCount[k] = (st.buildCount[k]||0) + 1;
      var hasIronAxe = !!packFind('tiefu');
      if(hasIronAxe) consumeTool('tiefu',1);
      var n = hasIronAxe ? 2 : 1;
      packAdd('shitiao', n);
      // 崖壁偶露铁矿：采石有一定概率连铁矿石一并剥落
      var ores = 0;
      if(Math.random() < 0.35){ ores = hasIronAxe ? 2 : 1; packAdd('tiekuangshi', ores); }
      afterPackChange();
      log('你抡'+(hasIronAxe?'铁斧凿石':'镐凿石')+'，哐哐数声，剥下石料×'+n+(ores?('，兼得铁矿石×'+ores):'')+'。','env');
    }

    // 伐木场：伐木取材（每日限次，仿采石崖）
    function cutWood(){
      var st=S();
      if(st.defeated){ toast('重伤未愈，先调息恢复。'); return; }
      if(!exert('伐木')) return;
      st.buildCount = st.buildCount || {};
      var k = 'wood_' + st.room + '@' + st.day;
      if((st.buildCount[k]||0) >= 3){ toast('今日采伐已足三回，林子需养，明日再来。'); return; }
      st.buildCount[k] = (st.buildCount[k]||0) + 1;
      advanceTime(1);
      var hasAxe = !!packFind('tiefu') || !!packFind('futou');
      var n = hasAxe ? 2 : 1;
      packAdd('mucai', n);
      afterPackChange();
      log('你'+(hasAxe?'挥斧斫木':'徒手折枝')+'，哢哢数声，得木材×'+n+'。','env');
      openModal('building');
    }
    // 砖窑：烧砖（每日限次，耗柴火/石料，仿采石崖）
    function fireBrick(){
      var st=S();
      if(st.defeated){ toast('重伤未愈，先调息恢复。'); return; }
      if(!exert('烧砖')) return;
      st.buildCount = st.buildCount || {};
      var k = 'brick_' + st.room + '@' + st.day;
      if((st.buildCount[k]||0) >= 3){ toast('今日窑火已足三窑，歇火养窑，明日再烧。'); return; }
      st.buildCount[k] = (st.buildCount[k]||0) + 1;
      advanceTime(1);
      var hasFuel = !!packFind('mucai');
      var n = hasFuel ? 2 : 1;
      if(hasFuel) packConsume('mucai', 1);
      packAdd('zhuan', n);
      afterPackChange();
      log('你添柴鼓风，窑火映红脸膛，出砖×'+n+(hasFuel?'（耗木材×1为薪）':'（无薪，砖质稍逊）')+'。','env');
      openModal('building');
    }
    // 残破木箱：一次性拾取「冶炼工坊图」
    function openBuildCrate(){
      var st=S();
      st.flags = st.flags || {};
      if(st.flags.buildCrateGot){ toast('木箱已然空了。'); return; }
      st.flags.buildCrateGot = true;
      packAdd('tuzhi_yeolian', 1);
      afterPackChange();
      log('你拨开草垛，旧木箱里静静躺着一卷泛黄的《冶炼工坊图》。','good');
      buildActions(G.ROOMS[st.room]);
    }

    // ===== 冶炼工坊：炉膛（铁矿石 + 木材燃料 → 分时辰烧制 → 铁料） =====
    function findForge(siteKey){
      var st=S();
      var arr = (st.placed && st.placed[st.room]) || [];
      var _tag=placedCellTag(st.room);
      for(var i=0;i<arr.length;i++){ if(arr[i].key===siteKey && placedInCell(arr[i], st.room, _tag)) return arr[i]; }
      return null;
    }
    // 炉膛状态存于 placed 对象上：p.forge = { ore, wood, burn, prog, need, out }
    //   ore 已投铁矿石 / wood 已投木材 / burn 是否在烧 / prog 当前烧制进度 / need 总需时辰 / out 已炼铁料待取
    function ensureForgeState(p){
      if(!p.forge) p.forge = { ore:0, wood:0, burn:false, prog:0, need:0, out:0 };
      return p.forge;
    }
    function openForgePanel(siteKey){
      openModal('forge', {site:siteKey});
    }
    function renderForgePanel(){
      var fs = getForgeState();
      var p = findForge(fs.site); if(!p) return '<p class="tip">炉膛已不存在。</p>';
      var bp = LF.BUILD[p.bp] || {};
      var f = ensureForgeState(p);
      var row = function(k,v){ return '<div class="row"><span>'+k+'</span><span>'+v+'</span></div>'; };
      var pct = f.need>0 ? Math.min(100, Math.round(f.prog/f.need*100)) : 0;
      var bar = f.burn
        ? '<div class="forge-bar"><i style="width:'+pct+'%"></i></div><div class="forge-pct">烧制中 '+pct+'%'+(f.prog)+'/'+(f.need)+' 时辰</div>'
        : (f.prog>0 ? '<div class="forge-bar"><i style="width:'+pct+'%"></i></div><div class="forge-pct">熄火 · 进度 '+pct+'%</div>' : '<p class="tip">炉膛尚冷，投料后点火。</p>');
      var msg = fs.msg; fs.msg='';
      var h = '<h3 style="text-align:center;margin:0 0 4px;">冶炼炉膛</h3>'
        + (msg ? '<div class="build-msg">'+msg+'</div>' : '')
        + row('铁矿石', f.ore)
        + row('木材', f.wood)
        + row('已炼铁料', f.out)
        + bar
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:10px 0;">'
        + '<button class="btn-mini" data-forge="ore">投铁矿石×1</button>'
        + '<button class="btn-mini" data-forge="wood">投木材×1</button>'
        + (f.burn ? '' : '<button class="btn-mini" data-forge="fire">点火烧制</button>')
        + (f.out>0 ? '<button class="btn-mini" data-forge="take">收取铁料</button>' : '')
        + '</div>'
        + '<p class="tip">每块铁矿石需 2 时辰烧炼、耗 2 木材；可在任意行动推进时辰时持续烧制。</p>'
        + '<button class="sheet-leave" id="m-forge-leave">收 工</button>';
      return h;
    }
    function bindForgePanel(){
      var card = getCard();
      card.querySelectorAll('[data-forge]').forEach(function(b){
        b.onclick=function(){ forgeAct(b.getAttribute('data-forge')); };
      });
      var lv=document.getElementById('m-forge-leave'); if(lv) lv.onclick=closeModal;
    }
    function forgeAct(act){
      var st=S();
      var fs = getForgeState();
      var p = findForge(fs.site); if(!p) return;
      var f = ensureForgeState(p);
      if(act==='ore'){
        var cur = packFind('tiekuangshi');
        if(!cur || (cur.count||0) < 1){ toast('行囊中无铁矿石。'); return; }
        if(st.energy<=0){ toast('精力已尽，先休整恢复再行添料。'); return; }
        packConsume('tiekuangshi', 1);
        f.ore++;
        fs.msg = '已投铁矿石×1。';
        save(st); afterPackChange();
      } else if(act==='wood'){
        var w = packFind('mucai');
        if(!w || (w.count||0) < 1){ toast('行囊中无木材。'); return; }
        if(st.energy<=0){ toast('精力已尽，先休整恢复再行添柴。'); return; }
        packConsume('mucai', 1);
        f.wood++;
        fs.msg = '已投木材×1。';
        save(st); afterPackChange();
      } else if(act==='fire'){
        if(f.burn){ toast('炉火正旺。'); return; }
        if(f.ore<1){ toast('炉中无铁矿石。'); return; }
        if(f.wood<1){ toast('炉中无木材，添柴方可点火。'); return; }
        f.burn = true;
        f.prog = 0;
        f.need = f.ore*2;   // 每块矿石需 2 时辰烧炼
        fs.msg = '你引火点燃炉膛，炉火渐旺……';
        log('你引火点燃炉膛，风箱鼓动，炉火渐旺——铁矿石在烈焰中缓缓融化。','env');
        save(st);
      } else if(act==='take'){
        if(f.out<1){ toast('炉中尚无炼成铁料。'); return; }
        var got = packAdd('tiekuai', f.out);
        if(!got){ toast('行囊已满，先腾出空位。'); return; }
        log('你钳出铁料×'+f.out+'，趁热打制成块。','good');
        f.out = 0;
        save(st); afterPackChange();
      }
      openModal('forge', {site:fs.site});
    }
    // 烧制推进：任意行动推进时辰时调用（engine 的 advanceTime 内 hook）
    function tickForge(n){
      var st=S();
      if(!st.placed) return;
      var roomIds = Object.keys(st.placed);
      for(var r=0; r<roomIds.length; r++){
        var arr = st.placed[roomIds[r]];
        if(!arr) continue;
        for(var i=0; i<arr.length; i++){
          var p = arr[i];
          if(!p || !p.forge || !p.forge.burn) continue;
          var f = p.forge;
          var step = Math.min(n, f.need - f.prog);
          f.prog += step;
          var woodCost = step;
          f.wood = Math.max(0, f.wood - woodCost);
          if(f.wood<=0 && f.prog < f.need){ f.burn=false; }   // 燃料耗尽熄火
          if(f.prog >= f.need){
            f.out += f.ore;      // 全部矿石炼成铁料
            f.ore = 0; f.prog = 0; f.need = 0; f.burn = false;
          }
        }
      }
    }

    return {
      gatherActs: gatherActs, startGather: startGather, doPickGather: doPickGather,
      chopTree: chopTree, searchBench: searchBench, pickupAxe: pickupAxe, consumeTool: consumeTool,
      buildCraftHTML: buildCraftHTML, renderCraftPanel: renderCraftPanel, bindCraftPanel: bindCraftPanel,
      doCraft: doCraft,
      mineStone: mineStone, cutWood: cutWood, fireBrick: fireBrick, openBuildCrate: openBuildCrate,
      findForge: findForge, ensureForgeState: ensureForgeState, openForgePanel: openForgePanel,
      renderForgePanel: renderForgePanel, bindForgePanel: bindForgePanel, forgeAct: forgeAct,
      tickForge: tickForge
    };
  };
})(typeof window !== 'undefined' ? window : global);

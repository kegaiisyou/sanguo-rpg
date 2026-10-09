// 乱世烽火 · 放置容器系统（v20261008r 自 shared/shop.js 拆出）
// 箱子 / 柜子 / 货架通用：槽位数组存储，支持点击与拖拽双向搬运、详情浮框、
// 数量步进、整理、存取全部。与行囊/战利品/仓库/给予同一套物品管理交互。
//
// 依赖经 ctx 注入 14 项；另用 window 上既有的全局桥接（S / LFUI / usePackItem /
// equipFromPackTo / discardPackItem 等，由 HTML onclick 或其它模块挂载）。
// 容器状态（contPlaced / contSel / contDragFrom / _bulk）随本模块内部持有。
(function (global) {
  var LF = global.LF || (global.LF = {});
  LF.createContainer = function (ctx) {
    var afterPackChange = ctx.afterPackChange, closeModal = ctx.closeModal,
        getCurrentModalKind = ctx.getCurrentModalKind, itemIconHTML = ctx.itemIconHTML,
        packAdd = ctx.packAdd, packConsume = ctx.packConsume, packFind = ctx.packFind,
        packFirstEmpty = ctx.packFirstEmpty, packIsStackable = ctx.packIsStackable,
        packMax = ctx.packMax, packUpPlaced = ctx.packUpPlaced,
        positionFloat = ctx.positionFloat, save = ctx.save, toast = ctx.toast,
        S = ctx.S;   // 行囊 getter（shop.js 的 S()），本模块 32 处调用

  // ── 放置容器（箱子/柜子/货架通用，v20260930q）：槽位数组存储，支持点击与拖拽双向搬运 ──
  var DEF_MAX_STACK = 99;
  function maxStackOf(it){ var d=window.LF.ITEMS[(it&&(it.defId||it.id))||'']||{}; return d.maxStack||DEF_MAX_STACK; }
  function contInit(p){
    var d = window.LF.ITEMS[p.defId] || {};
    var n = d.contSlots || d.shelfSlots || 4;
    function toObj(s){ if(!s) return null; if(s.defId || s.name || s.icon) return s; return window.LF.ITEMS.makeItem(s.id||s.defId, s.n||s.count||1); }
    if(p.shelf && !p.cont){ // 旧货架数据迁移
      var oi = (p.shelf.items||[]); var os = []; for(var k=0;k<n;k++){ os.push(oi[k] ? toObj(oi[k]) : null); }
      p.cont = { slots: os };
    }
    if(!p.cont || !p.cont.slots || p.cont.slots.length!==n){
      var old = (p.cont && p.cont.slots) || []; var slots = [];
      for(var i2=0;i2<n;i2++){ slots.push(toObj(old[i2])); }
      p.cont = { slots: slots };
    }
  }
  // ── 放置容器（箱子/柜子/货架通用）：与行囊/战利品/仓库/给予同一套物品管理交互 ──
  //  单击=选中并查看属性/耐久/描述；双击=快捷整堆搬运；拖拽=换位；
  //  并提供「全部取出 / 全部收纳」与按数量(×1/×5/×10/自定)拆分收纳或取出；可使用/丢弃。
  var contPlaced = null;     // 当前打开的容器 placed 对象（供 onclick 全局处理器读取）
  var contSel = null;        // {side:'cont'|'pack', idx} 当前选中格
  var contDragFrom = null;   // HTML5 拖拽来源
  // ── 放置容器（箱子/柜子/货架通用）：与行囊/战利品/仓库/给予同一套物品管理交互 ──
  //  单击=选中并查看属性/耐久/描述；双击=快捷整堆搬运；拖拽=换位；
  //  并提供「全部取出 / 全部收纳」与按数量(×1/×5/×10/自定)拆分收纳或取出；可使用/丢弃。
  var contPlaced = null;     // 当前打开的容器 placed 对象（供全局处理器读取）
  var contSel = null;        // {side:'cont'|'pack', idx} 当前选中格
  var contDragFrom = null;   // HTML5 拖拽来源
  function contCount(p){ var n=0; (p.cont.slots||[]).forEach(function(s){ if(s) n++; }); return n; }
  function contRoom(p){ return (p.cont.slots?p.cont.slots.length:0) - contCount(p); }
  function packCountOfDef(defId){ var n=0; (S().pack||[]).forEach(function(it){ if(it && (it.defId||it.id)===defId) n+=(it.count||1); }); return n; }
  // v20261008d：批量模式标志——「全部取出 / 全部收纳」循环调用 contPutCore/contTakeCore，
  //   旧版每格一次 save()+afterPackChange()（全量存刷 + 重渲染），N 格 = N 次。
  //   批量期间 _bulk>0 时底层只改数据不存刷，由批量入口末尾统一存一次并汇总提示。
  var _bulk=0;
  function contPutCore(p, defId, n){
    contInit(p);
    var it = packFind(defId); if(!it) return false;
    n = Math.min(n, it.count||0); if(n<=0) return false;
    var stack = packIsStackable(it);
    var slots = p.cont.slots; var moved = 0; var cap = maxStackOf(it);
    if(stack){
      for(var k=0;k<slots.length && n>0;k++){ var s=slots[k]; if(s && (s.defId||s.id)===defId && packIsStackable(s)){ var space=cap-(s.count||0); if(space>0){ var add=Math.min(space,n); s.count+=add; moved+=add; n-=add; } } }
    }
    for(var k2=0;k2<slots.length && n>0;k2++){
      if(!slots[k2]){
        if(stack){ var put=Math.min(cap,n); slots[k2]=window.LF.ITEMS.makeItem(defId, put); moved+=put; n-=put; }
        else { var pidx=S().pack.indexOf(it); if(pidx<0) break; slots[k2]=it; S().pack[pidx]=null; moved+=(it.count||1); n=0; }
      }
    }
    if(moved<=0) return false;
    if(stack) packConsume(defId, moved);
    contMerge(p);
    if(!_bulk){ save(S()); afterPackChange(); }
    return true;
  }
  function contTakeCore(p, idx, n){
    contInit(p);
    var s=p.cont.slots[idx]; if(!s) return false;
    n=Math.min(n, s.count||1); if(n<=0) return false;
    var stack=packIsStackable(s);
    if(stack){
      var ok=packAdd(s.defId||s.id, n); if(!ok) return false;
      s.count-=n; if(s.count<=0) p.cont.slots[idx]=null;
    } else {
      var e=packFirstEmpty(); if(e<0){ if(!_bulk) toast('行囊已满，无法取出。'); return false; }
      S().pack[e]=s; p.cont.slots[idx]=null;
    }
    if(!_bulk){ save(S()); afterPackChange(); }
    return true;
  }
  function contMerge(p){
    contInit(p); var slots=p.cont.slots;
    for(var i=0;i<slots.length;i++){ var a=slots[i]; if(!a||!packIsStackable(a)) continue;
      var cap=maxStackOf(a);
      for(var j=i+1;j<slots.length;j++){ var b=slots[j]; if(b && (b.defId||b.id)===(a.defId||a.id) && packIsStackable(b)){ var space=cap-(a.count||0); if(space>0){ var add=Math.min(space,b.count||0); a.count+=add; b.count-=add; if(b.count<=0) slots[j]=null; } } }
    }
    var kept=[]; for(var x=0;x<slots.length;x++){ if(slots[x]) kept.push(slots[x]); }
    for(var y=0;y<slots.length;y++) slots[y]=(y<kept.length)?kept[y]:null;
  }
  function contPut(p, defId, n){ if(contPutCore(p, defId, n)) refreshContainerPanel(p); }
  function contTake(p, idx, n){ if(contTakeCore(p, idx, n)){ refreshContainerPanel(p); contReshowFloat(p); } }
  function contPutAllOf(p, defId){   // 行囊中该物可能分多堆叠：全部收进容器
    contInit(p);
    var total = packCountOfDef(defId), guard=0;
    while(total>0 && contRoom(p)>0 && guard<300){
      guard++;
      if(!contPutCore(p, defId, Math.min(total, contRoom(p)))) break;
      var after = packCountOfDef(defId);
      if(after>=total) break;
      total = after;
    }
    refreshContainerPanel(p);
  }
  function contTakeAll(p){
    contInit(p);
    var ok=0, fail=0; _bulk++;
    try{ (p.cont.slots||[]).forEach(function(s,idx){ if(s&&(s.count||0)>0){ if(contTakeCore(p, idx, s.count||1)) ok++; else fail++; } }); }
    finally{ _bulk--; }
    save(S()); afterPackChange();
    if(ok||fail) toast(fail? ('取出 '+ok+' 格，'+fail+' 格因行囊已满未取出。') : ('取出 '+ok+' 格。'));
    refreshContainerPanel(p);
    var f=document.getElementById('cont-float'); if(f) f.style.display='none'; contSel=null;
  }
  function contPutAll(p){
    contInit(p);
    var ok=0, fail=0; _bulk++;
    try{
      for(var i=0;i<S().pack.length && contRoom(p)>0;i++){
        var it=S().pack[i]; if(!it || (it.count||0)<=0) continue;
        if(contPutCore(p, it.defId||it.id, it.count||1)) ok++; else fail++;
      }
    } finally{ _bulk--; }
    save(S()); afterPackChange();
    if(ok||fail) toast(fail? ('收纳 '+ok+' 格，'+fail+' 格放不下。') : ('收纳 '+ok+' 格。'));
    refreshContainerPanel(p);
    var f=document.getElementById('cont-float'); if(f) f.style.display='none'; contSel=null;
  }
  function contUse(p, idx){   // 容器内直接使用（同仓库 storeUseItem）
    contInit(p);
    var s=p.cont.slots[idx]; if(!s||(s.count||0)<=0) return;
    var d=window.LF.ITEMS[s.defId||s.id]||{};
    if(d.cat==='装备'){ toast('装备需装备至身上，不可直接使用。'); return; }
    var msgs=[];
    if(d.effect){
      var e=d.effect;
      if(e.hp){ if(S().hp>=S().maxHp) toast('气血已满。'); else { S().hp=Math.min(S().maxHp,S().hp+e.hp); msgs.push('伤势略缓（+'+e.hp+'）'); } }
      if(e.mp){ if(S().mp>=S().maxMp) toast('内息已满。'); else { S().mp=Math.min(S().maxMp,S().mp+e.mp); msgs.push('内息稍复（+'+e.mp+'）'); } }
      if(e.food){ if((S().food||0)>=100) toast('食已饱。'); else { S().food=Math.min(100,(S().food||0)+e.food); msgs.push('腹中稍暖（+'+e.food+'）'); } }
      if(e.drink){ if((S().drink||0)>=100) toast('饮已足。'); else { S().drink=Math.min(100,(S().drink||0)+e.drink); msgs.push('喉间得润（+'+e.drink+'）'); } }
      if(msgs.length) toast(msgs.join('；')); else { toast('「'+(d.name||'此物')+'」所滋补皆已满，留着吧。'); return; }
    } else if(d.maxDur){ toast('「'+(d.name||'此物')+'」为器具，于对应劳作时自行消耗耐久，无需手动使用。'); return; }
    else { toast('此物暂无可施用之效。'); return; }
    s.count--; if(s.count<=0) p.cont.slots[idx]=null;
    save(S()); afterPackChange(); refreshContainerPanel(p);
  }
  function contPickup(p){
    contInit(p);
    (p.cont.slots||[]).forEach(function(s,idx){ if(s&&(s.count||0)>0) contTakeCore(p, idx, s.count||1); });
    packUpPlaced(p.key); save(S()); closeModal();
  }
  function refreshContainerPanel(p){
    var card=document.getElementById('modal-card');
    if(card && getCurrentModalKind()==='container'){ card.innerHTML=renderContainerPanel({placed:p}); bindContainerPanel(p); }
  }
  function renderContainerPanel(opts){
    opts=opts||{}; var p=opts.placed; if(!p){ return '<p class="tip">容器数据缺失。</p>'; }
    contInit(p);
    if(contPlaced!==p){ contPlaced=p; contSel=null; }
    var f=document.getElementById('cont-float'); if(f) f.style.display='none';
    var d=window.LF.ITEMS[p.defId]||{}; var slots=p.cont.slots||[]; var cells='';
    for(var i=0;i<slots.length;i++){ var s=slots[i];
      if(s){ cells+='<div class="packcell" data-c-idx="'+i+'">'+itemIconHTML(s,16)+'<span class="pc-n">'+(s.count||1)+'</span></div>'; }
      else { cells+='<div class="packcell empty"></div>'; } }
    var pk='';
    var _pk=(S().pack||[]); var _cap=packMax(); if(_pk.length>_cap)_cap=_pk.length;
    for(var i=0;i<_cap;i++){ var pit=_pk[i]; if(!pit){ pk+='<div class="packcell empty" data-pk-idx="'+i+'"></div>'; continue; } pk+='<div class="packcell" data-pk-idx="'+i+'">'+itemIconHTML(pit,16)+'<span class="pc-n">'+(pit.count||1)+'</span></div>'; }
    var used=contCount(p);
    var cap=slots.length;
    // v20261008c：货架分层视觉——按容量定列数（8=4列×2行 / 16=4×4 / 24=4×6），强化"层板"心智
    var capCls = cap>=24 ? 'cap24' : (cap>=16 ? 'cap16' : 'cap8');
    var pct = cap ? Math.round(used*100/cap) : 0;
    var barW = Math.min(100, pct);
    var placeIc = (d.place && d.place.icon) ? d.place.icon : (d.icon||'📦');
    return '<div class="shop-wrap">'
      + '<div class="shop-head"><span class="shop-title">'+placeIc+' '+(d.name||'容器')+'</span><span class="shop-gold">'+used+' / '+cap+' 格</span></div>'
      + '<div class="shop-cap"><div class="shop-cap-bar"><i style="width:'+barW+'%"></i></div><span class="shop-cap-n">'+pct+'%</span></div>'
      + '<div class="shop-main">'
      +   '<div class="shop-left"><div class="shop-pane-title">容器 · 点选取物</div><div class="shop-scroll"><div class="pack-grid cont-grid '+capCls+'" id="cont-grid">'+cells+'</div></div></div>'
      +   '<div class="shop-right"><div class="shop-pane-title">你的行囊 · 拖物到左栏即收纳</div><div class="shop-scroll"><div class="pack-grid" id="cont-pack">'+pk+'</div></div></div>'
      + '</div>'
      + '<div class="shop-foot"><div class="sf-acts">'
      +   '<div class="sf-row">'
      +     '<button class="btn" id="cont-take-all">全部取出</button>'
      +     '<button class="btn" id="cont-put-all">全部收纳</button>'
      +     '<button class="btn" id="cont-sort">整 理</button>'
      +   '</div>'
      +   '<button class="btn sf-main" id="cont-pickup">收 起 货 架</button>'
      + '</div></div></div>';
  }
  function qtyRow(act){
    var label = act==='take'?'取出':'存入';
    return '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'
      + '<button class="li-act" data-cq="'+act+'" data-n="1">×1</button>'
      + '<button class="li-act" data-cq="'+act+'" data-n="5">×5</button>'
      + '<button class="li-act" data-cq="'+act+'" data-n="10">×10</button>'
      + '<button class="li-act" data-cq="'+act+'" data-n="999">全部</button>'
      + '<input id="cont-qty-input" class="txt" type="number" min="1" value="1" style="width:46px;">'
      + '<button class="li-act" data-cq="'+act+'" data-input="1">'+label+'</button>'
      + '</div>';
  }
  function renderContainerInspect(p){
    if(!contSel) return '';
    var side=contSel.side, idx=contSel.idx, defId, count, d, isEquip=false, it=null;
    if(side==='cont'){ var s=p.cont.slots[idx]; if(!s) return ''; it=s; defId=s.defId||s.id; count=s.count||1; d=window.LF.ITEMS[defId]||{}; isEquip=(s.cat==='装备'); }
    else { it=S().pack[idx]; if(!it) return ''; defId=it.defId||it.id; count=it.count||1; d=window.LF.ITEMS[defId]||{}; isEquip=(it.cat==='装备'); }
    var name = it.name||d.name||'物';
    var h='<div class="li-name">'+name+'</div>';
    h+='<div class="li-cat">'+(d.cat||'道具')+(count>1?(' · ×'+count):'')+'</div>';
    if(isEquip){
      var fields=[['atk','攻击'],['def','防御'],['spd','身法'],['hp','气血'],['mp','内息']];
      var parts=[]; fields.forEach(function(fl){ var v=it[fl[0]]||0; if(v) parts.push(fl[1]+' +'+v); });
      if(parts.length) h+='<div class="li-line">'+parts.join(' · ')+'</div>';
      if(it.packSpace) h+='<div class="li-line">空间 +'+it.packSpace+'</div>';
    }
    var dur = it.maxDur; if(dur){ var dv = (it.dur!=null? it.dur : dur); h+='<div class="li-line">耐久 '+(dv||0)+' / '+dur+'</div>'; }
    if(packIsStackable(it)) h+='<div class="li-line" style="opacity:.85">同类可叠放 ×'+maxStackOf(it)+'</div>';
    if(d.effect){ var e=d.effect,t=[]; if(e.hp)t.push('疗伤 +'+e.hp); if(e.mp)t.push('复内 +'+e.mp); if(e.food)t.push('充饥 +'+e.food); if(e.drink)t.push('解渴 +'+e.drink); if(e.dmg)t.push('伤害 +'+e.dmg); if(t.length)h+='<div class="li-line">'+t.join(' · ')+'</div>'; }
    if(d.price) h+='<div class="li-line">价值 '+d.price+' 两</div>';
    if(d.desc) h+='<div class="li-line" style="opacity:.85">'+d.desc+'</div>';
    var acts='';
    if(side==='cont'){
      h+='<div class="li-line" style="opacity:.8">取出数量：</div>'+qtyRow('take');
      if(d.effect) acts+='<button class="li-act" data-cont-act="use">使 用</button>';
      acts+='<button class="li-act" data-cont-act="discard">丢 弃</button>';
    } else {
      if(!isEquip){
        h+='<div class="li-line" style="opacity:.8">收纳数量：</div>'+qtyRow('put');
        if(d.effect) acts+='<button class="li-act" data-cont-act="use">使 用</button>';
      } else {
        acts+='<button class="li-act" data-cont-act="equip">装 备</button>';
      }
      acts+='<button class="li-act" data-cont-act="discard">丢 弃</button>';
    }
    if(acts) h+='<div class="li-acts">'+acts+'</div>';
    return h;
  }
  function showContainerFloat(p, el){
    if(!contSel) return;
    var f=document.getElementById('cont-float');
    if(!f){ f=document.createElement('div'); f.className='loot-info'; f.id='cont-float'; document.body.appendChild(f); }
    f.innerHTML=renderContainerInspect(p);
    if(!f.querySelector('.lf-close')) {   // v20261008g：显式 ✕ 关闭
      var _x=document.createElement('button'); _x.className='lf-close'; _x.textContent='✕'; _x.setAttribute('aria-label','关闭');
      _x.onclick=function(ev){ ev.stopPropagation(); f.style.display='none'; contSel=null; var c=document.querySelectorAll('#cont-grid .pcell-insp,#cont-pack .pcell-insp'); c.forEach(function(x){ x.classList.remove('pcell-insp'); }); };
      f.appendChild(_x);
    }
    f.querySelectorAll('[data-cont-act]').forEach(function(b){ b.onclick=function(){ contAct(b.getAttribute('data-cont-act')); }; });
    f.querySelectorAll('[data-cq]').forEach(function(b){ b.onclick=function(){ var n=parseInt(b.getAttribute('data-n'),10); if(b.getAttribute('data-input')) contQtyInput(b.getAttribute('data-cq')); else contQty(b.getAttribute('data-cq'), n); }; });
    f.style.display='block';
    positionFloat(f, el);
  }
  function contReshowFloat(p){
    if(!contSel) return;
    var sel=contSel;
    if(sel.side==='cont'){ var _cs=p.cont.slots[sel.idx]; if(!_cs||(_cs.count||0)<=0){ contSel=null; var f=document.getElementById('cont-float'); if(f) f.style.display='none'; return; } }
    else { if(!S().pack[sel.idx]){ contSel=null; var f2=document.getElementById('cont-float'); if(f2) f2.style.display='none'; return; } }
    var el = sel.side==='cont' ? document.querySelector('#cont-grid [data-c-idx="'+sel.idx+'"]') : document.querySelector('#cont-pack [data-pk-idx="'+sel.idx+'"]');
    if(el){ el.classList.add('pcell-insp'); showContainerFloat(p, el); }
  }
  function bindContainerPanel(p){
    var card=document.getElementById('modal-card'); if(!card) return;
    var lastClick={t:0,key:null};
    card.querySelectorAll('[data-c-idx],[data-pk-idx]').forEach(function(el){
      var isCont=el.hasAttribute('data-c-idx');
      var idx=parseInt(el.getAttribute(isCont?'data-c-idx':'data-pk-idx'),10);
      el.onclick=function(e){
        if(el.__dragMoved){ el.__dragMoved=false; return; }
        var key=isCont?('cont:'+idx):('pack:'+idx);
        var now=Date.now(); var dbl=(lastClick.key===key && now-lastClick.t<320); lastClick={t:now,key:key};
        if(dbl){ if(isCont) contTake(p, idx, 999); else { var it=S().pack[idx]; if(it) contPut(p, it.defId||it.id, 999); } return; }
        // v20261008g：再次点击同一格 = 切换关闭详情
        if(contSel && contSel.side===(isCont?'cont':'pack') && contSel.idx===idx){ contSel=null; var _f3=document.getElementById('cont-float'); if(_f3) _f3.style.display='none'; el.classList.remove('pcell-insp'); return; }
        contSel={side:isCont?'cont':'pack', idx:idx};
        card.querySelectorAll('.pcell-insp').forEach(function(c){ c.classList.remove('pcell-insp'); });
        el.classList.add('pcell-insp');
        showContainerFloat(p, el);
      };
      el.setAttribute('draggable','true');
      el.ondragstart=function(e){ contDragFrom={side:isCont?'cont':'pack', idx:idx}; var _f=document.getElementById('cont-float'); if(_f) _f.style.display='none'; if(e&&e.dataTransfer) e.dataTransfer.setData('text/plain','x'); if(e) e.stopPropagation(); };
    });
    var cg=card.querySelector('#cont-grid'), cp=card.querySelector('#cont-pack');
    [cg,cp].forEach(function(g){ if(g) g.ondragover=function(e){ if(e) e.preventDefault(); }; });
    if(cg) cg.ondrop=function(e){ if(e) e.preventDefault(); if(contDragFrom&&contDragFrom.side==='pack'){ var it=S().pack[contDragFrom.idx]; if(it) contPut(p, it.defId||it.id, 999); } contDragFrom=null; };
    if(cp) cp.ondrop=function(e){ if(e) e.preventDefault(); if(contDragFrom&&contDragFrom.side==='cont'){ contTake(p, contDragFrom.idx, 999); } contDragFrom=null; };
    var pDrag=null, pGhost=null, pSX=0,pSY=0,pMoved=false,pSrcEl=null;
    card.querySelectorAll('[data-c-idx],[data-pk-idx]').forEach(function(el){
      el.onpointerdown=function(e){
        if(e.pointerType==='mouse') return;
        var isCont=el.hasAttribute('data-c-idx');
        pDrag={side:isCont?'cont':'pack', idx:parseInt(el.getAttribute(isCont?'data-c-idx':'data-pk-idx'),10)};
        pSrcEl=el; pMoved=false; el.__dragMoved=false; pSX=e.clientX; pSY=e.clientY;
        var _f=document.getElementById('cont-float'); if(_f) _f.style.display='none';
      };
    });
    card.onpointermove=function(e){
      if(!pDrag) return;
      if(!pMoved){ if(Math.abs(e.clientX-pSX)<8 && Math.abs(e.clientY-pSY)<8) return; pMoved=true; if(pSrcEl) pSrcEl.__dragMoved=true; }
      if(!pGhost){ pGhost=document.createElement('div'); pGhost.className='pack-ghost'; document.body.appendChild(pGhost); }
      var id = pDrag.side==='cont' ? (p.cont.slots[pDrag.idx]?(p.cont.slots[pDrag.idx].defId||p.cont.slots[pDrag.idx].id):null) : (S().pack[pDrag.idx]?(S().pack[pDrag.idx].defId||S().pack[pDrag.idx].id):null);
      var dn = id?window.LF.ITEMS[id]:null;
      pGhost.textContent = dn?(dn.icon||''):''; pGhost.style.fontSize='22px';
    };
    function endPDrag(e, cancelled){
      var from=pDrag; pDrag=null; if(pGhost){ pGhost.remove(); pGhost=null; }
      if(!from || !pMoved || cancelled) return;
      var tgt=document.elementFromPoint(e.clientX,e.clientY);
      while(tgt && tgt!==card && !tgt.id) tgt=tgt.parentNode;
      if(tgt && tgt.id==='cont-grid' && from.side==='pack'){ var it=S().pack[from.idx]; if(it) contPut(p, it.defId||it.id, 999); }
      else if(tgt && tgt.id==='cont-pack' && from.side==='cont'){ contTake(p, from.idx, 999); }
    }
    card.onpointerup=function(e){ endPDrag(e,false); };
    card.onpointercancel=function(e){ endPDrag(e,true); };
    card.onclick=function(e){
      if(e.target.closest('[data-c-idx],[data-pk-idx]')) return;
      if(e.target.closest('button')) return;
      var f=document.getElementById('cont-float'); if(f) f.style.display='none'; contSel=null;
    };
    var ta=card.querySelector('#cont-take-all'); if(ta) ta.onclick=function(){ contTakeAll(p); };
    var pa=card.querySelector('#cont-put-all'); if(pa) pa.onclick=function(){ contPutAll(p); };
    var pu=card.querySelector('#cont-pickup'); if(pu) pu.onclick=function(){ contPickup(p); };
    var so=card.querySelector('#cont-sort'); if(so) so.onclick=function(){ contSort(p); };
  }
  function contAct(kind){
    var p=contPlaced, sel=contSel; if(!p||!sel) return;
    if(kind==='use'){
      if(sel.side==='cont') contUse(p, sel.idx);
      else { var it=S().pack[sel.idx]; if(it){ LFUI.usePackItem(sel.idx); refreshContainerPanel(p); contReshowFloat(p); } }
    } else if(kind==='equip'){
      var it2=S().pack[sel.idx]; if(it2&&it2.slot){ LFUI.equipFromPackTo(sel.idx, it2.slot); refreshContainerPanel(p); contReshowFloat(p); }
    } else if(kind==='discard'){
      if(sel.side==='cont'){ var s=p.cont.slots[sel.idx]; if(s){ var nm=(window.LF.ITEMS[s.defId||s.id]||{}).name||'物'; if(window.confirm('确定丢弃容器中的「'+nm+'×'+(s.count||1)+'」？此操作不可撤销。')){ p.cont.slots[sel.idx]=null; save(S()); afterPackChange(); } } }
      else { var it3=S().pack[sel.idx]; if(it3){ if(window.confirm('确定丢弃「'+it3.name+'×'+(it3.count||1)+'」？此操作不可撤销。')){ LFUI.discardPackItem(sel.idx); } } }
      refreshContainerPanel(p); contReshowFloat(p);
    }
  }
  function contQty(act, n){
    var p=contPlaced, sel=contSel; if(!p||!sel) return;
    if(act==='take'){ if(sel.side==='cont') contTake(p, sel.idx, n); return; }
    if(sel.side!=='pack') return;
    var it=S().pack[sel.idx]; if(!it) return;
    var defId=it.defId||it.id; var total=packCountOfDef(defId);
    if(n>=total){ contPutAllOf(p, defId); return; }   // 多堆叠：一键全部收纳
    var remain=n;   // 按特定数量拆分收纳（跨多个堆叠累加）
    while(remain>0 && packCountOfDef(defId)>0 && contRoom(p)>0){
      var take=Math.min(remain, packCountOfDef(defId));
      if(!contPutCore(p, defId, take)) break;
      remain-=take;
    }
    refreshContainerPanel(p);
  }
  function contQtyInput(act){
    var p=contPlaced, sel=contSel; if(!p||!sel) return;
    var inp=document.getElementById('cont-qty-input'); var n=inp?parseInt(inp.value,10):0; if(!n||n<1) n=1;
    contQty(act, n);
  }
  window.contAct=contAct; window.contQty=contQty; window.contQtyInput=contQtyInput;
  window.contCloseCleanup=function(){ contPlaced=null; contSel=null; var f=document.getElementById('cont-float'); if(f) f.style.display='none'; };
  function contSort(p){ contMerge(p); if(LFUI && LFUI.packAutoSort) LFUI.packAutoSort(); save(S()); afterPackChange(); refreshContainerPanel(p); toast('已整理。'); }
    return {
      maxStackOf: maxStackOf, packCountOfDef: packCountOfDef,
      contInit: contInit, contCount: contCount, contRoom: contRoom,
      contPutCore: contPutCore, contTakeCore: contTakeCore, contMerge: contMerge,
      contPut: contPut, contTake: contTake, contPutAllOf: contPutAllOf,
      contTakeAll: contTakeAll, contPutAll: contPutAll, contUse: contUse,
      contPickup: contPickup, contSort: contSort,
      refreshContainerPanel: refreshContainerPanel, renderContainerPanel: renderContainerPanel,
      bindContainerPanel: bindContainerPanel, qtyRow: qtyRow,
      renderContainerInspect: renderContainerInspect, showContainerFloat: showContainerFloat,
      contReshowFloat: contReshowFloat, contAct: contAct, contQty: contQty,
      contQtyInput: contQtyInput
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createContainer;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

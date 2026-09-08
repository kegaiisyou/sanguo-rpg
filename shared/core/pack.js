// 行囊装备面板与交互层（v20260908n）
// 从 engine.js「格子制行囊核心 / 行囊装备面板」拆出：装备/卸下、格子拖拽排序、面板与人形装备栏渲染、详情浮框与操作。
// 依赖经 ctx 注入：getState（惰性，兼容读档时 state 被重赋值）；packInspect 的 get/set（被放置系统 placeInspect/packUpPlaced 共享，故仍留在引擎）；
// Inventory 数据层别名（locEq/packMax/packFirstEmpty/packList/packGet/usePackItem/discardPackItem）；引擎 UI 回调（toast/save/renderStatus/afterPackChange/itemIconHTML/effectiveStats/compareEquip/positionFloat）。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createPack = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var toast = ctx.toast, save = ctx.save, renderStatus = ctx.renderStatus;
    var afterPackChange = ctx.afterPackChange, itemIconHTML = ctx.itemIconHTML;
    var effectiveStats = ctx.effectiveStats, compareEquip = ctx.compareEquip, positionFloat = ctx.positionFloat;
    var locEq = ctx.locEq, packMax = ctx.packMax, packFirstEmpty = ctx.packFirstEmpty,
        packList = ctx.packList, packGet = ctx.packGet,
        usePackItem = ctx.usePackItem, discardPackItem = ctx.discardPackItem;
    var getPackInspect = ctx.getPackInspect, setPackInspect = ctx.setPackInspect;

  function movePackItem(from,to){
    if(locEq(from,to)) return;
    if(from.kind==='pack' && to.kind==='pack'){
      var s=getState().pack[from.idx], d=getState().pack[to.idx];
      getState().pack[to.idx]=s; getState().pack[from.idx]=d; afterPackChange(); return;
    }
    if(from.kind==='pack' && to.kind==='equip'){
      var it=getState().pack[from.idx];
      if(!it || it.cat!=='装备' || it.slot!==to.slot){ toast('该物不可装备于「'+LF.ITEMS.SLOTS[to.slot].label+'」。'); return; }
      var old=getState().equipment[to.slot];
      getState().equipment[to.slot]=it; getState().pack[from.idx]=old;
      toast('已装备「'+it.name+'」。'); afterPackChange(); return;
    }
    if(from.kind==='equip' && to.kind==='pack'){ unequipToPack(from.slot, to.idx); return; }
  }
  function swapPackCells(a,b){
    if(locEq(a,b)) return;
    var s=getState().pack[a.idx], d=getState().pack[b.idx];
    getState().pack[b.idx]=s; getState().pack[a.idx]=d;
    if(typeof save==='function') save(getState());
    renderStatus();
    var card=document.getElementById('modal-card'); if(!card) return;
    var sc=card.querySelector('.pack-scroll'); var grid=sc&&sc.querySelector('.pack-grid');
    if(sc && grid){ grid.innerHTML=renderPackGrid(); if(typeof bindPackInteractions==='function') bindPackInteractions(card); }
  }
  function refreshPackGridLight(){   // 仅重渲行囊格子，保留滚动位置（避免装备/使用/丢弃后滚动条复位）
    var card=document.getElementById('modal-card'); if(!card) return;
    var sc=card.querySelector('.pack-scroll'); var grid=sc&&sc.querySelector('.pack-grid');
    if(sc && grid){ grid.innerHTML=renderPackGrid(); if(typeof bindPackInteractions==='function') bindPackInteractions(card); }
  }
  // 装备/卸下后仅重渲装备栏（人形+装备槽+背包槽）与战力属性，保留滚动位置，实时反馈装备变化
  function refreshPackEquipLight(){
    var card=document.getElementById('modal-card'); if(!card) return;
    var fig=card.querySelector('.equip-figure');
    if(fig){ var w=document.createElement('div'); w.innerHTML=renderEquipFigure(); var nf=w.firstElementChild; if(nf) fig.replaceWith(nf); }
    var st=card.querySelector('#packLeftStats');
    if(st){ var w2=document.createElement('div'); w2.innerHTML=renderEquipStats(); var ns=w2.firstElementChild; if(ns) st.replaceWith(ns); }
    if(typeof bindPackInteractions==='function') bindPackInteractions(card);
  }
  function unequipToPack(slot,toIdx){
    var eq=getState().equipment[slot]; if(!eq) return;
    // 卸下会缩减容量（如背囊/腰包提供 packSpace），若卸下后装不下则禁止，避免丢物或状态不一致
    if(eq.packSpace){
      var maxAfter = packMax() - eq.packSpace;
      var cnt = getState().pack.filter(function(x){ return x; }).length;
      if(cnt > maxAfter){ toast('卸下后背囊空间不足，无法卸下「'+eq.name+'」。'); return; }
    }
    if(toIdx!=null && !getState().pack[toIdx]){ getState().pack[toIdx]=eq; getState().equipment[slot]=null; }
    else { var e=packFirstEmpty(); if(e<0){ toast('行囊已满，无法卸下。'); return; } getState().pack[e]=eq; getState().equipment[slot]=null; }
    toast('已卸下「'+eq.name+'」。'); afterPackChange();
  }
  // 双击格子：快速装备 / 快速使用
  function quickUseFromPack(idx){
    var it=getState().pack[idx]; if(!it) return;
    if(it.cat==='装备' && it.slot){ movePackItem({kind:'pack',idx:idx},{kind:'equip',slot:it.slot}); }
    else { usePackItem(idx); }
  }
  function inspCls(loc){ return (getPackInspect() && locEq(getPackInspect(),loc))?' pcell-insp':''; }
  function renderPackGrid(){
    var grid='';
    for(var i=0;i<getState().pack.length;i++){
      var it=getState().pack[i];
      if(!it){ grid += '<div class="packcell pcell-empty" data-loc="pack:'+i+'"></div>'; continue; }
      var cnt = (it.count>1)?('<span class="pcell-cnt">'+it.count+'</span>'):'';
      var qb = (it.quality)?('<span class="pcell-qbadge" style="background:'+((LF.ITEMS.QMAP[it.quality]||{}).color||'#9a948a')+'"></span>'):'';
      grid += '<div class="packcell'+inspCls({kind:'pack',idx:i})+'" data-loc="pack:'+i+'">'
            + '<div class="pcell-ic">'+itemIconHTML(it,13)+'</div>'
            + cnt + qb + '</div>';
    }
    return grid;
  }
  // 装备栏图（人形 + 六装备槽 + 背包槽）：独立成函数，供 renderPack 与装备后实时刷新复用
  function renderEquipFigure(){
    var sil = '<svg class="equip-sil" viewBox="0 0 124 130" preserveAspectRatio="xMidYMid meet">'
      + '<g fill="rgba(186,160,220,.2)" stroke="rgba(200,172,236,.75)" stroke-width="1.6">'
      + '<circle cx="62" cy="22" r="19"/>'
      + '<rect x="44" y="43" width="36" height="47" rx="15"/>'
      + '<rect x="28" y="48" width="10" height="28" rx="5"/>'
      + '<rect x="86" y="48" width="10" height="28" rx="5"/>'
      + '<rect x="48" y="88" width="12" height="18" rx="6"/>'
      + '<rect x="64" y="88" width="12" height="18" rx="6"/>'
      + '</g></svg>';
    var eqHtml='', bagSlot='';
    LF.ITEMS.SLOT_KEYS.forEach(function(slot){
      if(slot==='bag') return;            // 背包槽独立于六装备槽，单独放在人形下方
      var eq=getState().equipment[slot], sl=LF.ITEMS.SLOTS[slot];
      var insCls=(getPackInspect() && getPackInspect().kind==='equip' && getPackInspect().slot===slot)?' pcell-insp':'';
      var badge = '';
      if(eq && eq.quality){ var bc=(LF.ITEMS.QMAP[eq.quality]||{}).color||'#9a948a'; badge='<span class="ep-qbadge" style="background:'+bc+'"></span>'; }
      var durBar='';
      if(eq && eq.maxDur){ var dp=Math.max(0,Math.round((eq.dur/eq.maxDur)*100)); var dc=dp>50?'#6fd08a':(dp>25?'#e0b14a':'#e0796f'); durBar='<span class="ep-dur"><i style="width:'+dp+'%;background:'+dc+'"></i></span>'; }
      var inner = eq
        ? '<div class="ep-name">'+eq.name+'</div>'
        : '<div class="ep-ph">'+sl.label+'</div>';
      eqHtml += '<div class="equipslot ep-'+slot+insCls+'" data-loc="equip:'+slot+'">'+inner+badge+durBar+'</div>';
    });
    // 背包槽（bag）：人形下方独立渲染
    (function(){
      var eq=getState().equipment.bag, sl=LF.ITEMS.SLOTS.bag;
      var insCls=(getPackInspect() && getPackInspect().kind==='equip' && getPackInspect().slot==='bag')?' pcell-insp':'';
      var badge='';
      if(eq && eq.quality){ var bc=(LF.ITEMS.QMAP[eq.quality]||{}).color||'#9a948a'; badge='<span class="ep-qbadge" style="background:'+bc+'"></span>'; }
      var durBar='';
      if(eq && eq.maxDur){ var dp=Math.max(0,Math.round((eq.dur/eq.maxDur)*100)); var dc=dp>50?'#6fd08a':(dp>25?'#e0b14a':'#e0796f'); durBar='<span class="ep-dur"><i style="width:'+dp+'%;background:'+dc+'"></i></span>'; }
      var inner=eq?'<div class="ep-name">'+eq.name+'</div>':'<div class="ep-ph">'+sl.label+'</div>';
      bagSlot='<div class="equipslot ep-bagflow'+insCls+'" data-loc="equip:bag">'+inner+badge+durBar+'</div>';
    })();
    eqHtml = sil + eqHtml;
    return '<div class="equip-figure">'+eqHtml+bagSlot+'</div>';
  }
  function renderPack(){
    var grid='';
    for(var i=0;i<getState().pack.length;i++){
      var it=getState().pack[i];
      if(!it){ grid += '<div class="packcell pcell-empty" data-loc="pack:'+i+'"></div>'; continue; }
      var cnt = (it.count>1)?('<span class="pcell-cnt">'+it.count+'</span>'):'';
      var qb = (it.quality)?('<span class="pcell-qbadge" style="background:'+((LF.ITEMS.QMAP[it.quality]||{}).color||'#9a948a')+'"></span>'):'';
      grid += '<div class="packcell'+inspCls({kind:'pack',idx:i})+'" data-loc="pack:'+i+'">'
            + '<div class="pcell-ic">'+itemIconHTML(it,13)+'</div>'
            + cnt + qb + '</div>';
    }
    return '<div class="pack-wrap">'
      + '<div class="pack-head"><span class="pack-title">行 囊</span></div>'
      + '<div class="pack-main">'
      +   '<div class="pack-left"><div class="pack-left-title">装 备</div>'+renderEquipFigure()+renderEquipStats()+'</div>'
      +   '<div class="pack-right"><div class="pack-right-title">物 品</div>'
      +     '<div class="pack-scroll"><div class="pack-grid">'+grid+'</div></div>'
      +   '</div>'
      + '</div>'
      + '<div class="pack-foot"><button class="btn" onclick="LFUI.packAutoSort()">自动整理</button>'
      + '<button class="btn" '+(canDiscard()?'':'disabled')+' onclick="LFUI.discardInspect()">丢弃</button>'
      + '<span class="pack-hint">点按物品查看 · 点空白处关闭</span>'
      + '<span class="pack-cap">容量 '+packList().length+' / '+packMax()+'</span>'
      + '<span class="pack-gold">银两 '+getState().gold+'</span></div>'
      + '</div>';
  }
  function renderEquipStats(){
    var s = (typeof effectiveStats==='function') ? effectiveStats() : getState();
    function row(label, val){ return '<div class="ps-row"><span>'+label+'</span><b>'+(val==null?'—':val)+'</b></div>'; }
    var collapsed = ((window.LF && LF.UISPEC && LF.UISPEC.isMobile()) || (window.innerWidth && window.innerWidth<=560)) ? ' collapsed' : '';
    return '<div class="pack-left-stats'+collapsed+'" id="packLeftStats">'
      + '<div class="ps-h" onclick="LFUI.toggleStats()" role="button" tabindex="0">属 性 <span class="ps-caret">▾</span></div>'
      + '<div class="ps-body">'
      + row('攻击', s.atk||0)
      + row('防御', s.def||0)
      + row('身法', s.spd||0)
      + row('气血', s.maxHp||0)
      + (s.maxMp>0? row('内力', s.maxMp||0):'')
      + '</div></div>';
  }
  // 物品详情面板：单击物品后展示属性 / 耐久 / 使用效果 / 描述
  // 行囊属性浮框：与战利品栏同一套 .loot-info 浅色纸 + .li-* 内容；操作按钮放末尾，避免挤压文字
  function renderPackInspect(){
    if(!getPackInspect()) return '<div class="li-name">行囊</div><div class="li-line">点选物品，可查看其属性、耐久与使用之效。</div>';
    var it = packGet(getPackInspect());
    if(!it){ setPackInspect(null); return '<div class="li-name">行囊</div><div class="li-line">点选物品，可查看其属性、耐久与使用之效。</div>'; }
    var q = LF.ITEMS.QMAP[it.quality] || {name:'凡品',color:'#9a948a'};
    var qname = it.qualityName || q.name;
    var h='<div class="li-name">'+itemIconHTML(it,15)+' '+it.name+'</div>';
    h+='<div class="li-cat">'+(it.cat||'道具')+(it.qualityName?(' · '+qname):'')+(it.count>1?(' · ×'+it.count):'')+'</div>';
    if(it.cat==='装备'){
      var fields=[['atk','攻击'],['def','防御'],['spd','身法'],['hp','气血'],['mp','内息'],['wuxing','悟性']];
      var parts=[];
      fields.forEach(function(f){ var v=it[f[0]]||0; if(v) parts.push(f[1]+' +'+v); });
      if(parts.length) h+='<div class="li-line">'+parts.join(' · ')+'</div>';
      if(it.packSpace) h+='<div class="li-line">空间 +'+it.packSpace+'</div>';
    }
    if(it.maxDur){ h+='<div class="li-line">耐久 '+it.dur+' / '+it.maxDur+'</div>'; }
    if(it.effect){
      var e=it.effect, t=[];
      if(e.hp) t.push('疗伤 +'+e.hp);
      if(e.mp) t.push('复内 +'+e.mp);
      if(e.food) t.push('充饥 +'+e.food);
      if(e.drink) t.push('解渴 +'+e.drink);
      if(e.dmg) t.push('伤害 +'+e.dmg);
      if(t.length) h+='<div class="li-line">'+t.join(' · ')+'</div>';
    }
    if(it.desc) h+='<div class="li-line" style="opacity:.85">'+it.desc+'</div>';
    if(it.cat==='装备') h+=compareEquip(it);
    // 操作按钮统一置于末尾
    var acts='';
    if(getPackInspect().kind==='equip') acts+='<button class="li-act" onclick="LFUI.unequipInspect()">卸 下</button>';
    else {
      if(it.cat==='装备') acts+='<button class="li-act" onclick="LFUI.equipInspect()">装 备</button>';
      if(it.effect) acts+='<button class="li-act" onclick="LFUI.useInspect()">使 用</button>';
      var canPlace=it.placeable||(LF.ITEMS[it.defId]||{}).placeable||(LF.ITEMS[it.defId]||{}).place;
      var isBlueprint=!!(LF.ITEMS[it.defId]||{}).blueprint;
      if(canPlace||isBlueprint) acts+='<button class="li-act" onclick="LFUI.placeInspect()">'+(isBlueprint?'依 图':'放 置')+'</button>';
    }
    if(acts) h+='<div class="li-acts">'+acts+'</div>';
    return h;
  }
  function parseLoc(s){ if(!s) return null; var p=s.split(':'); if(p[0]==='pack') return {kind:'pack',idx:parseInt(p[1],10)}; if(p[0]==='equip') return {kind:'equip',slot:p[1]}; return null; }
  // 将行囊浮层详情框定位到被选中格子旁边（与战利品栏同一套视觉）
  function showPackFloat(){
    if(!getPackInspect()) return;
    var f=document.getElementById('pack-float');
    if(!f){ f=document.createElement('div'); f.className='loot-info'; f.id='pack-float'; document.body.appendChild(f); }
    f.innerHTML=renderPackInspect(); f.style.display='block';
    var a=document.querySelector('.pcell-insp'); if(!a){ f.style.display='none'; return; }
    var ar=a.getBoundingClientRect();
    var cw=ar.width; if(cw) f.style.width=Math.max(88,Math.min(184,Math.round(cw)))+'px';
    positionFloat(f, a);
  }
  var packLastClick={t:0, loc:null};
  function bindPackInteractions(){
    var card=document.getElementById('modal-card'); if(!card) return;
    var cells=card.querySelectorAll('[data-loc]');
    cells.forEach(function(el){
      el.onclick=function(){
        if(el.__dragMoved){ el.__dragMoved=false; return; }
        var key=el.getAttribute('data-loc'); var loc=parseLoc(key); if(!loc) return;
        var now=Date.now();
        if(packLastClick.loc===key && now-packLastClick.t<320){ packLastClick.t=0; quickUseFromPack(loc.idx); return; }  // 双击：快速装备/使用
        packLastClick={t:now, loc:key};
        var it=packGet(loc);
        if(!it){ setPackInspect(null); var f=document.getElementById('pack-float'); if(f) f.style.display='none'; return; }  // 空位：仅收起浮框
        setPackInspect(loc);
        card.querySelectorAll('.pcell-insp').forEach(function(c){ c.classList.remove('pcell-insp'); });   // 仅更新高亮，不重渲染面板，避免列表滚动复位
        el.classList.add('pcell-insp');
        showPackFloat();
      };
    });
    cells.forEach(function(el){
      el.setAttribute('draggable','true');
      el.ondragstart=function(e){
        var loc=parseLoc(el.getAttribute('data-loc')); if(!loc||!packGet(loc)){ e.preventDefault(); return; }
        el.__from=loc; var _pf=document.getElementById('pack-float'); if(_pf) _pf.style.display='none';
        e.dataTransfer.setData('text/plain', el.getAttribute('data-loc'));
      };
      el.ondragover=function(e){ e.preventDefault(); };
      el.ondrop=function(e){
        e.preventDefault();
        var to=parseLoc(el.getAttribute('data-loc')); if(!to) return;
        var from=el.__from || parseLoc(e.dataTransfer.getData('text/plain'));
        if(from){ movePackItem(from,to); setPackInspect(null); var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
      };
    });
    var dragging=null, ghost=null, sx=0, sy=0, moved=false, srcEl=null;
    cells.forEach(function(el){
      el.onpointerdown=function(e){
        if(e.pointerType==='mouse') return;
        var loc=parseLoc(el.getAttribute('data-loc')); if(!loc||!packGet(loc)) return;
        dragging=loc; srcEl=el; moved=false; el.__dragMoved=false; sx=e.clientX; sy=e.clientY;
        var _pf=document.getElementById('pack-float'); if(_pf) _pf.style.display='none';   // 触屏拖拽起点立即隐藏行囊浮框
        setPackInspect(null);
      };
    });
    card.onpointermove=function(e){
      if(!dragging) return;
      if(!moved){ if(Math.abs(e.clientX-sx)<8 && Math.abs(e.clientY-sy)<8) return; moved=true; srcEl && (srcEl.__dragMoved=true); }
      if(!ghost){ ghost=document.createElement('div'); ghost.className='pack-ghost'; document.body.appendChild(ghost); }
      ghost.textContent=(packGet(dragging)||{}).name||'';
      ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px';
    };
    function endDrag(e, cancelled){
      var from=dragging; dragging=null;
      if(ghost){ ghost.remove(); ghost=null; }
      if(!from || !moved || cancelled){ return; }
      var tgt=document.elementFromPoint(e.clientX,e.clientY);
      while(tgt && tgt!==card && !tgt.getAttribute('data-loc')) tgt=tgt.parentNode;
      var to=parseLoc(tgt?tgt.getAttribute('data-loc'):null);
      if(to) swapPackCells(from,to);
    }
    card.onpointerup=function(e){ endDrag(e,false); };
    card.onpointercancel=function(e){ endDrag(e,true); };
    // 点空白处关闭属性详情
    card.onclick=function(e){
      if(e.target.closest('[data-loc]')) return;   // 点物品格：由格子自身处理
      if(e.target.closest('button')) return;        // 点按钮：不关闭
      if(e.target.closest('#pack-float')) return;   // 点在浮层内：保持显示
      var f=document.getElementById('pack-float'); if(f) f.style.display='none';  // 点空白仅收起浮框，不重渲染
    };
  }
  // 详情面板操作
  function useInspect(){ if(!getPackInspect()||getPackInspect().kind!=='pack') return; var idx=getPackInspect().idx; usePackItem(idx); if(!getState().pack[idx]){ setPackInspect(null); var f=document.getElementById('pack-float'); if(f) f.style.display='none'; return; } showPackFloat(); }
  function discardInspect(){ if(!getPackInspect()||getPackInspect().kind!=='pack') return; var idx=getPackInspect().idx; setPackInspect(null); discardPackItem(idx); var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
  function canDiscard(){ return !!(getPackInspect() && getPackInspect().kind==='pack'); }
  function packHighlightReplaced(idx){   // 装备/卸下后，自动滚到并高亮被换下的背包物品
    setTimeout(function(){
      var card=document.getElementById('modal-card'); if(!card) return;
      var rc=card.querySelector('.packcell[data-loc="pack:'+idx+'"]'); if(!rc) return;
      rc.scrollIntoView({block:'nearest',behavior:'smooth'});
      rc.classList.add('pcell-rep');
      setTimeout(function(){ if(rc) rc.classList.remove('pcell-rep'); }, 1400);
    }, 60);
  }
  function equipInspect(){ if(!getPackInspect()||getPackInspect().kind!=='pack') return; var idx=getPackInspect().idx; var it=getState().pack[idx]; if(!it||it.cat!=='装备') return; var slot=it.slot; if(!slot){ toast('此物无可装备之处。'); return; } var old=getState().equipment[slot]; movePackItem({kind:'pack',idx:idx},{kind:'equip',slot:slot}); setPackInspect({kind:'equip',slot:slot}); showPackFloat(); if(old) packHighlightReplaced(idx); }
  function unequipInspect(){ if(!getPackInspect()||getPackInspect().kind!=='equip') return; var slot=getPackInspect().slot; var eq=getState().equipment[slot]; unequipToPack(slot); var repIdx=-1; if(eq){ for(var i=0;i<getState().pack.length;i++){ if(getState().pack[i]===eq){ repIdx=i; setPackInspect({kind:'pack',idx:i}); break; } } } else setPackInspect(null); showPackFloat(); if(repIdx>=0) packHighlightReplaced(repIdx); }
  function closeInspect(){ setPackInspect(null); refreshPackGridLight(); var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
  function toggleStats(){ var el=document.getElementById('packLeftStats'); if(el) el.classList.toggle('collapsed'); }

    return {
      movePackItem: movePackItem, swapPackCells: swapPackCells, refreshPackGridLight: refreshPackGridLight, refreshPackEquipLight: refreshPackEquipLight, unequipToPack: unequipToPack, quickUseFromPack: quickUseFromPack, inspCls: inspCls, renderPackGrid: renderPackGrid, renderEquipFigure: renderEquipFigure, renderPack: renderPack, renderEquipStats: renderEquipStats, renderPackInspect: renderPackInspect, parseLoc: parseLoc, showPackFloat: showPackFloat, bindPackInteractions: bindPackInteractions, useInspect: useInspect, discardInspect: discardInspect, canDiscard: canDiscard, packHighlightReplaced: packHighlightReplaced, equipInspect: equipInspect, unequipInspect: unequipInspect, closeInspect: closeInspect, toggleStats: toggleStats,
      getPackLastClick: function () { return packLastClick; }
    };
  };
})(typeof window !== 'undefined' ? window : global);

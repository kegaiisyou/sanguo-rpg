// 仓库系统（v20260909f）：城中仓库 30 格，存/取/换位/整理/使用/装备
// 从 engine.js 拆出：ensureStorage … bindStoragePanel（原「══ 仓库系统 ══」整段）。
// 依赖经 ctx 注入：getState（惰性）；getStorageCid（引擎侧可变值，openModal 写入当前仓库城，簇内只读，故只需 getter）；
// storageSel 仅本簇使用，已随簇移入模块作为私有状态；Inventory 数据层别名（itemKey/packIsStackable/packFind/packConsume/packAdd）；
// 引擎 UI 回调（toast/save/log/afterPackChange/getCard/getCurrentModalKind/openModal/closeModal/itemIconHTML/ensureCityState）。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createStorage = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getStorageCid = ctx.getStorageCid;
    var LF = ctx.LF, itemIconHTML = ctx.itemIconHTML, ensureCityState = ctx.ensureCityState;
    var itemKey = ctx.itemKey, packIsStackable = ctx.packIsStackable, packFind = ctx.packFind,
        packConsume = ctx.packConsume, packAdd = ctx.packAdd, packFirstEmpty = ctx.packFirstEmpty,
        packMax = ctx.packMax, packList = ctx.packList, packGet = ctx.packGet;
    var usePackItem = ctx.usePackItem, equipFromPackTo = ctx.equipFromPackTo;
    var toast = ctx.toast, save = ctx.save, log = ctx.log, afterPackChange = ctx.afterPackChange;
    var getCard = ctx.getCard, getCurrentModalKind = ctx.getCurrentModalKind;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;
    var storageSel = null;   // {src:'store'|'pack', defId, name, max}

  function ensureStorage(cid){
    ensureCityState(cid);
    getState().flags.storage=getState().flags.storage||{};
    var st=getState().flags.storage[cid];
    if(!st){
      st=getState().flags.storage[cid]={slots:30, items:[]};
      // 苦役营仓库初始物资（v20260909i）：建材/工具/食物/药品/杂项
      if(cid==='kuyilao'){
        var campItems = [
          {id:'mucai', count:200},   // 木材
          {id:'shitiao', count:100}, // 石料
          {id:'mutou', count:150},   // 木头
          {id:'zhuan', count:80},    // 砖头
          {id:'tiekuai', count:40},  // 铁料
          {id:'zhuzi', count:60},    // 竹子
          {id:'futou', count:5},     // 斧头
          {id:'roubao', count:50},   // 肉包子
          {id:'yeguo', count:30},    // 野果
          {id:'shengrou', count:20}, // 生肉
          {id:'jinchuang', count:20},// 金疮药
          {id:'yaofen', count:30},   // 草药粉
          {id:'caoyao', count:50},   // 草药
          {id:'yecai', count:40},    // 野菜（v20260924z：营中储备口粮，伙房鲁大收菜差役可用）
          {id:'caizi', count:20},    // 菜籽（v20260924z：留种，农田开垦后可播种）
          {id:'tangyao', count:8},   // 汤药
          {id:'xiang', count:20},    // 线香
          {id:'sleepmat', count:15}, // 草席
          {id:'campfire', count:10}  // 篝火
        ];
        campItems.forEach(function(c){
          var it=LF.ITEMS.makeItem(c.id, c.count);
          if(it) st.items.push(it);
        });
      } else if(cid==='kuyilao'){
        // v20260924z：老档兼容 —— 仓库已有存档时，若缺野菜/菜籽则补齐（营中储备口粮与留种）
        var have={}; st.items.forEach(function(c){ if(c && itemKey(c)) have[itemKey(c)]=true; });
        var extra=[ {id:'yecai', count:40}, {id:'caizi', count:20} ];
        extra.forEach(function(c){
          if(!have[c.id]){ var it=LF.ITEMS.makeItem(c.id, c.count); if(it) st.items.push(it); }
        });
      }
    }
    return st;
  }
  function storageItemCount(st, defId){
    var n=0; for(var i=0;i<st.items.length;i++){ var c=st.items[i]; if(c && itemKey(c)===defId) n+=c.count||0; }
    return n;
  }
  function storageMaxStack(defId){ var d=LF.ITEMS[defId]||{}; return d.maxStack||99; }
  function storageAdd(cid, itemOrDefId, count){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var defId = (typeof itemOrDefId==='string') ? itemOrDefId : (itemOrDefId.defId||itemOrDefId.id);
    var total = (typeof itemOrDefId==='string') ? (count||1) : ((itemOrDefId.count||1)+(count||0));
    if(!defId) return false;
    var d = LF.ITEMS[defId]||{}; var stackable = (d.cat!=='装备' && !d.maxDur); var cap = d.maxStack||99; var rem = total;
    if(stackable){
      for(var i=0;i<st.items.length && rem>0;i++){ var c=st.items[i]; if(c && itemKey(c)===defId && packIsStackable(c)){ var space=cap-(c.count||0); if(space>0){ var add=Math.min(space,rem); c.count+=add; rem-=add; } } }
      while(rem>0){
        var e=-1; for(var j=0;j<st.items.length;j++){ if(!st.items[j]){ e=j; break; } }
        if(e<0 && st.items.length<st.slots){ while(st.items.length<st.slots) st.items.push(null); e=-1; for(var j2=0;j2<st.items.length;j2++){ if(!st.items[j2]){ e=j2; break; } } }
        if(e<0){ toast('仓库已满，存不下了。'); return false; }
        var put=Math.min(cap,rem); st.items[e]=LF.ITEMS.makeItem(defId, put); rem-=put;
      }
      return true;
    }
    var e2=-1; for(var k=0;k<st.items.length;k++){ if(!st.items[k]){ e2=k; break; } }
    if(e2<0 && st.items.length<st.slots){ while(st.items.length<st.slots) st.items.push(null); e2=-1; for(var k2=0;k2<st.items.length;k2++){ if(!st.items[k2]){ e2=k2; break; } } }
    if(e2<0){ toast('仓库已满，存不下了。'); return false; }
    st.items[e2] = (typeof itemOrDefId==='string') ? LF.ITEMS.makeItem(defId, total) : itemOrDefId;
    return true;
  }
  function storagePut(cid, defId, n){
    var it=packFind(defId);
    if(!it || (it.count||0)<n){ toast('行囊此物不足。'); return; }
    var packIdx=getState().pack.indexOf(it);
    if(packIdx<0){ toast('行囊此物不足。'); return; }
    if(!storePutFromPack(packIdx, n, cid, null)) return;
    if(getCurrentModalKind()==='storage') refreshStoragePanel(cid);
  }
  function storageTake(cid, defId, n){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var si=-1; for(var i=0;i<st.items.length;i++){ var c=st.items[i]; if(c && itemKey(c)===defId){ si=i; break; } }
    if(si<0){ toast('仓库此物不足。'); return; }
    if(!storeTakeToPack(cid, si, n, null)) return;
    if(getCurrentModalKind()==='storage') refreshStoragePanel(cid);
  }
  // ── 仓库模式（货郎同款交互）所需：格维度存取/换位/整理/使用/装备 ──
  function storeGet(cid){ return ensureStorage(cid); }
  function storePutFromPack(packIdx, n, cid, toIdx){
    var it=getState().pack[packIdx]; if(!it || (it.count||0)<n){ toast('行囊此物不足。'); return false; }
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var stack=packIsStackable(it);
    function consume(n2){
      it.count=(it.count||0)-n2;
      if(it.count<=0) getState().pack[packIdx]=null;
    }
    if(toIdx!=null && toIdx>=0 && toIdx<st.slots){
      var dst=st.items[toIdx];
      if(dst && stack && (dst.defId||dst.id)===(it.defId||it.id) && dst.cat!=='装备'){ dst.count=(dst.count||1)+n; consume(n); }
      else if(!dst){
        if(stack){ var pc=LF.ITEMS.makeItem(it.defId, n); if(!pc) return false; st.items[toIdx]=pc; consume(n); }
        else { if(n>1){ toast('装备一次存一件。'); return false; } st.items[toIdx]=it; getState().pack[packIdx]=null; }
      } else {
        if(n>1){ toast('此处已有他物，一次仅可拖 1 件交换。'); return false; }
        var tmp=st.items[toIdx];
        if(stack){ var p2=LF.ITEMS.makeItem(it.defId, 1); if(!p2) return false; st.items[toIdx]=p2; consume(1); }
        else { st.items[toIdx]=it; getState().pack[packIdx]=null; }
        if(getState().pack[packIdx]===null){ getState().pack[packIdx]=tmp; }
        else { var e=packFirstEmpty(); if(e<0){ toast('行囊已满，交换物无处安放。'); return false; } getState().pack[e]=tmp; }
      }
      save(getState()); afterPackChange();
      log('你将'+it.name+'×'+n+'存入仓库。','sys');
      return true;
    }
    if(stack){
      if(!storageAdd(cid, it.defId, n)) return false;
      consume(n);
    } else {
      if(n>1){ toast('装备一次存一件。'); return false; }
      var e=-1; for(var i=0;i<st.items.length;i++){ if(!st.items[i]){ e=i; break; } }
      if(e<0 && st.items.length<st.slots){ while(st.items.length<st.slots) st.items.push(null); e=-1; for(var i=0;i<st.items.length;i++){ if(!st.items[i]){ e=i; break; } } }
      if(e<0){ toast('仓库已满，存不下了。'); return false; }
      st.items[e]=it; getState().pack[packIdx]=null;
    }
    save(getState()); afterPackChange();
    log('你将'+it.name+'×'+n+'存入仓库。','sys');
    return true;
  }
  function storeTakeToPack(cid, si, n, toPackIdx){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var it=st.items[si]; if(!it) return false;
    n=Math.min(n, it.count||0);
    if(n<=0){ toast('仓库此物不足。'); return false; }
    var stack=packIsStackable(it);
    if(toPackIdx!=null && toPackIdx>=0 && toPackIdx<getState().pack.length){
      var dst=getState().pack[toPackIdx];
      if(dst && stack && itemKey(dst)===itemKey(it) && dst.cat!=='装备'){ dst.count=(dst.count||1)+n; it.count=(it.count||0)-n; if(it.count<=0) st.items[si]=null; }
      else if(!dst){
        if(stack){ var pc=LF.ITEMS.makeItem(it.defId, n); if(!pc) return false; getState().pack[toPackIdx]=pc; it.count=(it.count||0)-n; if(it.count<=0) st.items[si]=null; }
        else { getState().pack[toPackIdx]=it; st.items[si]=null; }
      } else {
        if(n>1){ toast('此处已有他物，一次仅可拖 1 件交换。'); return false; }
        var tmp=getState().pack[toPackIdx];
        if(stack){ var p2=LF.ITEMS.makeItem(it.defId, 1); if(!p2) return false; getState().pack[toPackIdx]=p2; it.count=(it.count||0)-1; if(it.count<=0) st.items[si]=null; }
        else { getState().pack[toPackIdx]=it; st.items[si]=null; }
        if(st.items[si]===null){ st.items[si]=tmp; }
        else { var e=-1; for(var i=0;i<st.items.length;i++){ if(!st.items[i]){ e=i; break; } }
          if(e<0 && st.items.length<st.slots){ while(st.items.length<st.slots) st.items.push(null); e=-1; for(var i=0;i<st.items.length;i++){ if(!st.items[i]){ e=i; break; } } }
          if(e>=0) st.items[e]=tmp;
          else { toast('仓库已满，交换物无处安放。'); return false; }
        }
      }
      save(getState()); afterPackChange();
      log('你从仓库取出'+(it.name||'物')+(n>1?('×'+n):'')+'。','sys');
      return true;
    }
    if(stack){
      if(!packAdd(it.defId, n)){ toast('行囊已满，无法取出。'); return false; }
      it.count=(it.count||0)-n; if(it.count<=0) st.items[si]=null;
    } else {
      if(toPackIdx!=null && toPackIdx>=0 && !getState().pack[toPackIdx]){ getState().pack[toPackIdx]=it; st.items[si]=null; }
      else { var e=packFirstEmpty(); if(e<0){ toast('行囊已满，无法取出。'); return false; } getState().pack[e]=it; st.items[si]=null; }
    }
    save(getState()); afterPackChange();
    log('你从仓库取出'+(it.name||'物')+(n>1?('×'+n):'')+'。','sys');
    return true;
  }
  function storeSwap(cid, a, b){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    if(a===b||a<0||b<0||a>=st.slots||b>=st.slots) return;
    var A=st.items[a], B=st.items[b];
    if(A&&B&&packIsStackable(A)&&packIsStackable(B)&&itemKey(A)===itemKey(B)&&B.cat!=='装备'){
      B.count=(B.count||1)+(A.count||1); st.items[a]=null;
    } else {
      st.items[a]=B; st.items[b]=A;
    }
    save(getState()); afterPackChange();
  }
  function storeSort(cid){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var map={}; var order=[];
    for(var i=0;i<st.items.length;i++){ var it=st.items[i]; if(!it) continue;
      if(packIsStackable(it)){ var k=itemKey(it); if(!map[k]){ map[k]={item:it}; order.push(k); } else { map[k].item.count=(map[k].item.count||1)+(it.count||1); } }
      else { order.push('_e'+i); map['_e'+i]={item:it}; }
    }
    for(var j=0;j<st.items.length;j++) st.items[j]=null;
    order.forEach(function(k,ix){ if(ix<st.slots) st.items[ix]=map[k].item; });
    toast('仓库已整理。'); save(getState()); afterPackChange();
  }
  function storeUseItem(cid, si){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var it=st.items[si]; if(!it) return;
    if(it.cat==='装备'){ toast('装备需装备至身上，不可直接使用。'); return; }
    if(it.effect){
      if(it.effect.hp){ getState().hp=Math.min(getState().maxHp, getState().hp+(it.effect.hp||0)); toast('伤势略缓（+'+(it.effect.hp||0)+'）。'); }
      if(it.effect.mp){ getState().mp=Math.min(getState().maxMp, getState().mp+(it.effect.mp||0)); toast('内息稍复（+'+(it.effect.mp||0)+'）。'); }
      if(it.effect.food){ getState().food=Math.min(100,(getState().food||0)+(it.effect.food||0)); toast('腹中稍暖（+'+(it.effect.food||0)+'）。'); }
      if(it.effect.drink){ getState().drink=Math.min(100,(getState().drink||0)+(it.effect.drink||0)); toast('喉间得润（+'+(it.effect.drink||0)+'）。'); }
      if(it.effect.energy){ var _mx=getState().maxEnergy||100; getState().energy=Math.min(_mx,(getState().energy||0)+(it.effect.energy||0)); toast('精神一振（+'+(it.effect.energy||0)+'）。'); }
    } else if(it.maxDur){ toast('「'+it.name+'」为器具，于对应劳作时自行消耗耐久，无需手动使用。'); return; }
    else { toast('此物暂无可施用之效。'); return; }
    it.count--; if(it.count<=0) st.items[si]=null;
    save(getState()); afterPackChange();
  }
  function storeEquipItem(cid, si, slot){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var it=st.items[si]; if(!it) return;
    var sl=(LF.ITEMS.SLOTS&&LF.ITEMS.SLOTS[slot])?LF.ITEMS.SLOTS[slot].label:slot;
    if(it.cat!=='装备' || it.slot!==slot){ toast('该物不可装备于「'+sl+'」。'); return; }
    var old=getState().equipment[slot];
    getState().equipment[slot]=it; st.items[si]=old||null;
    toast('已装备「'+it.name+'」。'+(old?('，原「'+old.name+'」退回仓库。'):''));
    save(getState()); afterPackChange();
  }
  var stDragFrom = null;   // HTML5 拖拽来源
  function storageRoom(cid){ ensureStorage(cid); var st=getState().flags.storage[cid]; var used=0; for(var i=0;i<st.items.length;i++) if(st.items[i]) used++; return st.slots-used; }
  function stQtyRow(act){ var label=act==='take'?'取出':'存入'; return '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">'
    + '<button class="li-act" data-cq="'+act+'" data-n="1">×1</button>'
    + '<button class="li-act" data-cq="'+act+'" data-n="5">×5</button>'
    + '<button class="li-act" data-cq="'+act+'" data-n="10">×10</button>'
    + '<button class="li-act" data-cq="'+act+'" data-n="999">全部</button>'
    + '<input id="st-qty-input" class="txt" type="number" min="1" value="1" style="width:46px;">'
    + '<button class="li-act" data-cq="'+act+'" data-input="1">'+label+'</button>'
    + '</div>'; }
  function renderStorageInspect(cid){
    if(!storageSel) return '';
    var src=storageSel.src, idx=storageSel.idx, defId, count, d, isEquip=false, it=null;
    if(src==='store'){ var st=getState().flags.storage[cid]; var sit=st&&st.items[idx]; if(!sit) return ''; defId=itemKey(sit); count=sit.count||1; d=LF.ITEMS[defId]||{}; it=sit; }
    else { it=getState().pack[idx]; if(!it) return ''; defId=it.defId||it.id; count=it.count||1; d=LF.ITEMS[defId]||{}; isEquip=(it.cat==='装备'); }
    var name = src==='store' ? it.name : (it.name||d.name||'物');
    var h='<div class="li-name">'+name+'</div>';
    h+='<div class="li-cat">'+(d.cat||'道具')+(count>1?(' · ×'+count):'')+'</div>';
    if(src==='pack' && isEquip){
      var fields=[['atk','攻击'],['def','防御'],['spd','身法'],['hp','气血'],['mp','内息']];
      var parts=[]; fields.forEach(function(fl){ var v=it[fl[0]]||0; if(v) parts.push(fl[1]+' +'+v); });
      if(parts.length) h+='<div class="li-line">'+parts.join(' · ')+'</div>';
      if(it.packSpace) h+='<div class="li-line">空间 +'+it.packSpace+'</div>';
    }
    var dur = it.maxDur; if(dur){ var dv = (it.dur!=null? it.dur : it.maxDur); h+='<div class="li-line">耐久 '+(dv||0)+' / '+dur+'</div>'; }
    if(!(d.cat==='装备'||d.maxDur)) h+='<div class="li-line" style="opacity:.85">同类可叠放 ×'+storageMaxStack(defId)+'</div>';
    if(d.price) h+='<div class="li-line">价值 '+d.price+' 两</div>';
    if(d.effect){ var e=d.effect,t=[]; if(e.hp)t.push('疗伤 +'+e.hp); if(e.mp)t.push('复内 +'+e.mp); if(e.food)t.push('充饥 +'+e.food); if(e.drink)t.push('解渴 +'+e.drink); if(e.energy)t.push('精力 +'+e.energy); if(e.dmg)t.push('伤害 +'+e.dmg); if(t.length)h+='<div class="li-line">'+t.join(' · ')+'</div>'; }
    if(d.desc) h+='<div class="li-line" style="opacity:.85">'+d.desc+'</div>';
    var acts='';
    if(src==='store'){
      h+='<div class="li-line" style="opacity:.8">取出数量：</div>'+stQtyRow('take');
      if(d.effect) acts+='<button class="li-act" data-st-act="use">使 用</button>';
      acts+='<button class="li-act" data-st-act="equip">装 备</button>';
      acts+='<button class="li-act" data-st-act="discard">丢 弃</button>';
    } else {
      if(!isEquip){
        h+='<div class="li-line" style="opacity:.8">存入数量：</div>'+stQtyRow('put');
        if(d.effect) acts+='<button class="li-act" data-st-act="use">使 用</button>';
      } else { acts+='<button class="li-act" data-st-act="equip">装 备</button>'; }
      acts+='<button class="li-act" data-st-act="discard">丢 弃</button>';
    }
    if(acts) h+='<div class="li-acts">'+acts+'</div>';
    return h;
  }
  function showStorageFloat(cid, el){
    if(!storageSel) return;
    var f=document.getElementById('st-float');
    if(!f){ f=document.createElement('div'); f.className='loot-info'; f.id='st-float'; document.body.appendChild(f); }
    f.innerHTML=renderStorageInspect(cid);
    f.querySelectorAll('[data-st-act]').forEach(function(b){ b.onclick=function(){ stAct(b.getAttribute('data-st-act')); }; });
    f.querySelectorAll('[data-cq]').forEach(function(b){ b.onclick=function(){ var n=parseInt(b.getAttribute('data-n'),10); if(b.getAttribute('data-input')) stQtyInput(b.getAttribute('data-cq')); else stQty(b.getAttribute('data-cq'), n); }; });
    f.style.display='block';
    positionFloat(f, el);
  }
  function stReshowFloat(cid){
    if(!storageSel) return; var sel=storageSel;
    if(sel.src==='store'){ var st=getState().flags.storage[cid]; if(!st||!st.items[sel.idx]){ storageSel=null; var f=document.getElementById('st-float'); if(f) f.style.display='none'; return; } }
    else { if(!getState().pack[sel.idx]){ storageSel=null; var f2=document.getElementById('st-float'); if(f2) f2.style.display='none'; return; } }
    var el=sel.src==='store'?document.querySelector('#st-grid [data-st-idx="'+sel.idx+'"]'):document.querySelector('#st-pack [data-pk-idx="'+sel.idx+'"]');
    if(el){ el.classList.add('pcell-insp'); showStorageFloat(cid, el); }
  }
  function refreshStoragePanel(cid){
    var card=document.getElementById('modal-card');
    if(card && getCurrentModalKind()==='storage'){ card.innerHTML=renderStoragePanel(cid); bindStoragePanel(); }
  }
  function storeDiscardItem(cid, si){
    var st=getState().flags.storage[cid]; var it=st&&st.items[si]; if(!it) return;
    if(!window.confirm('确定丢弃仓库中的「'+it.name+'×'+(it.count||1)+'」？此操作不可撤销。')) return;
    st.items[si]=null; save(getState()); afterPackChange();
  }
  function stAct(kind){
    if(!storageSel) return; var cid=getStorageCid(); if(cid==null) return;
    if(kind==='use'){ if(storageSel.src==='store'){ storeUseItem(cid, storageSel.idx); } else { var pit=getState().pack[storageSel.idx]; if(pit){ LFUI.usePackItem(storageSel.idx); refreshStoragePanel(cid); stReshowFloat(cid); } } }
    else if(kind==='equip'){ if(storageSel.src==='store'){ var st=getState().flags.storage[cid]; var it=st.items[storageSel.idx]; if(it&&it.slot) storeEquipItem(cid, storageSel.idx, it.slot); } else { var p2=getState().pack[storageSel.idx]; if(p2&&p2.slot) LFUI.equipFromPackTo(storageSel.idx, p2.slot); } refreshStoragePanel(cid); stReshowFloat(cid); }
    else if(kind==='discard'){ if(storageSel.src==='store'){ storeDiscardItem(cid, storageSel.idx); } else { var p3=getState().pack[storageSel.idx]; if(p3 && window.confirm('确定丢弃「'+p3.name+'×'+(p3.count||1)+'」？此操作不可撤销。')){ LFUI.discardPackItem(storageSel.idx); } } refreshStoragePanel(cid); stReshowFloat(cid); }
  }
  function stQty(act, n){
    if(!storageSel) return; var cid=getStorageCid(); if(cid==null) return;
    if(act==='take'){ if(storageSel.src!=='store') return; var st=getState().flags.storage[cid]; var it=st.items[storageSel.idx]; if(!it) return; n=Math.min(n, it.count||0); if(n>0) storeTake(cid, itemKey(it), n); }
    else { if(storageSel.src!=='pack') return; var pit=getState().pack[storageSel.idx]; if(!pit) return; n=Math.min(n, pit.count||0, storageRoom(cid)); if(n>0) storagePut(cid, pit.defId||pit.id, n); }
  }
  function stQtyInput(act){ if(!storageSel) return; var inp=document.getElementById('st-qty-input'); var n=inp?parseInt(inp.value,10):0; if(!n||n<1) n=1; stQty(act, n); }
  function stTakeAll(cid){ ensureStorage(cid); var st=getState().flags.storage[cid]; for(var i=0;i<st.items.length;i++){ var it=st.items[i]; if(it){ storeTakeToPack(cid, i, it.count||0, null); } } refreshStoragePanel(cid); var f=document.getElementById('st-float'); if(f) f.style.display='none'; storageSel=null; }
  function stPutAll(cid){ ensureStorage(cid); for(var i=0;i<getState().pack.length;i++){ var pit=getState().pack[i]; if(!pit || (pit.count||0)<=0) continue; storePutFromPack(i, pit.count||0, cid, null); } refreshStoragePanel(cid); var f=document.getElementById('st-float'); if(f) f.style.display='none'; storageSel=null; }
  function stSort(cid){ ensureStorage(cid); storeSort(cid); if(LFUI && LFUI.packAutoSort) LFUI.packAutoSort(); save(getState()); afterPackChange(); refreshStoragePanel(cid); toast('已整理。'); }
  function renderStoragePanel(cid){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    storageSel=null;
    var f=document.getElementById('st-float'); if(f) f.style.display='none';
    var cnm=(LF.CITIES[cid]||{}).name||'此城';
    var used=0; for(var i=0;i<st.items.length;i++) if(st.items[i]) used++;
    var cells='';
    for(var i=0;i<st.slots;i++){ var it=st.items[i];
      if(!it){ cells+='<div class="packcell empty"></div>'; }
      else { cells+='<div class="packcell" data-st-idx="'+i+'">'+itemIconHTML(it,16)+'<span class="pc-n">'+(it.count||1)+'</span></div>'; }
    }
    var pk='';
    var _cap=packMax(); if(getState().pack.length>_cap)_cap=getState().pack.length;
    for(var i=0;i<_cap;i++){ var pit=getState().pack[i]; if(!pit){ pk+='<div class="packcell empty" data-pk-idx="'+i+'"></div>'; continue; } pk+='<div class="packcell" data-pk-idx="'+i+'">'+itemIconHTML(pit,16)+'<span class="pc-n">'+(pit.count||1)+'</span></div>'; }
    return '<div class="shop-wrap">'
      + '<div class="shop-head"><span class="shop-title">🏯 仓库 · '+cnm+'</span><span class="shop-gold">'+used+' / '+st.slots+' 格</span></div>'
      + '<div class="shop-main">'
      +   '<div class="shop-left"><div class="shop-pane-title">仓库 · 点选取物</div><div class="shop-scroll"><div class="pack-grid" id="st-grid">'+cells+'</div></div></div>'
      +   '<div class="shop-right"><div class="shop-pane-title">你的行囊 · 拖物到左栏即存入</div><div class="shop-scroll"><div class="pack-grid" id="st-pack">'+pk+'</div></div></div>'
      + '</div>'
      + '<div class="shop-foot"><div class="sf-acts">'
      +   '<button class="btn" id="st-take-all">全部取出</button>'
      +   '<button class="btn" id="st-put-all">全部收纳</button>'
      +   '<button class="btn" id="st-sort">整 理</button>'
      +   '<button class="btn" id="m-st-leave">收 工</button>'
      + '</div></div></div>';
  }
  function bindStoragePanel(){
    var cid=getStorageCid(); if(cid==null) return;
    var card=document.getElementById('modal-card'); if(!card) return;
    var lastClick={t:0,key:null};
    card.querySelectorAll('[data-st-idx],[data-pk-idx]').forEach(function(el){
      var isStore=el.hasAttribute('data-st-idx');
      var idx=parseInt(el.getAttribute(isStore?'data-st-idx':'data-pk-idx'),10);
      el.onclick=function(e){
        if(el.__dragMoved){ el.__dragMoved=false; return; }
        var key=isStore?('store:'+idx):('pack:'+idx);
        var now=Date.now(); var dbl=(lastClick.key===key && now-lastClick.t<320); lastClick={t:now,key:key};
        if(dbl){ if(isStore){ var st=getState().flags.storage[cid]; var it=st.items[idx]; if(it) storeTake(cid, itemKey(it), it.count||0); } else { var pit=getState().pack[idx]; if(pit) storagePut(cid, pit.defId||pit.id, pit.count||0); } return; }
        storageSel={src:isStore?'store':'pack', idx:idx};
        card.querySelectorAll('.pcell-insp').forEach(function(c){ c.classList.remove('pcell-insp'); });
        el.classList.add('pcell-insp');
        showStorageFloat(cid, el);
      };
      el.setAttribute('draggable','true');
      el.ondragstart=function(e){ stDragFrom={src:isStore?'store':'pack', idx:idx}; var _f=document.getElementById('st-float'); if(_f) _f.style.display='none'; if(e&&e.dataTransfer) e.dataTransfer.setData('text/plain','x'); if(e) e.stopPropagation(); };
    });
    var sg=card.querySelector('#st-grid'), spk=card.querySelector('#st-pack');
    [sg,spk].forEach(function(g){ if(g) g.ondragover=function(e){ if(e) e.preventDefault(); }; });
    if(sg) sg.ondrop=function(e){ if(e) e.preventDefault(); if(stDragFrom&&stDragFrom.src==='pack'){ var pit=getState().pack[stDragFrom.idx]; if(pit){ var to=null; var tcell=e.target.closest && e.target.closest('[data-st-idx]'); if(tcell) to=parseInt(tcell.getAttribute('data-st-idx'),10); storePutFromPack(stDragFrom.idx, 999, cid, to); refreshStoragePanel(cid); storageSel=null; var f=document.getElementById('st-float'); if(f) f.style.display='none'; } } stDragFrom=null; };
    if(spk) spk.ondrop=function(e){ if(e) e.preventDefault(); if(stDragFrom&&stDragFrom.src==='store'){ var st=getState().flags.storage[cid]; var it=st.items[stDragFrom.idx]; if(it){ var to=null; var tcell=e.target.closest && e.target.closest('[data-pk-idx]'); if(tcell) to=parseInt(tcell.getAttribute('data-pk-idx'),10); storeTakeToPack(cid, stDragFrom.idx, it.count||0, to); refreshStoragePanel(cid); storageSel=null; var f=document.getElementById('st-float'); if(f) f.style.display='none'; } } stDragFrom=null; };
    var pDrag=null, pGhost=null, pSX=0,pSY=0,pMoved=false,pSrcEl=null;
    card.querySelectorAll('[data-st-idx],[data-pk-idx]').forEach(function(el){ el.onpointerdown=function(e){ if(e.pointerType==='mouse') return; var isStore=el.hasAttribute('data-st-idx'); pDrag={src:isStore?'store':'pack', idx:parseInt(el.getAttribute(isStore?'data-st-idx':'data-pk-idx'),10)}; pSrcEl=el; pMoved=false; el.__dragMoved=false; pSX=e.clientX; pSY=e.clientY; var _f=document.getElementById('st-float'); if(_f) _f.style.display='none'; }; });
    card.onpointermove=function(e){ if(!pDrag) return; if(!pMoved){ if(Math.abs(e.clientX-pSX)<8 && Math.abs(e.clientY-pSY)<8) return; pMoved=true; if(pSrcEl) pSrcEl.__dragMoved=true; } if(!pGhost){ pGhost=document.createElement('div'); pGhost.className='pack-ghost'; document.body.appendChild(pGhost); } var id=pDrag.src==='store'?(getState().flags.storage[cid].items[pDrag.idx]?itemKey(getState().flags.storage[cid].items[pDrag.idx]):null):(getState().pack[pDrag.idx]?(getState().pack[pDrag.idx].defId||getState().pack[pDrag.idx].id):null); var dn=id?LF.ITEMS[id]:null; pGhost.textContent=dn?(dn.icon||''):''; pGhost.style.fontSize='22px'; };
    function endPDrag(e, cancelled){ var from=pDrag; pDrag=null; if(pGhost){ pGhost.remove(); pGhost=null; } if(!from||!pMoved||cancelled) return; var tgt=document.elementFromPoint(e.clientX,e.clientY); while(tgt&&tgt!==card&&!tgt.id) tgt=tgt.parentNode; if(tgt&&tgt.id==='st-grid'&&from.src==='pack'){ var pit=getState().pack[from.idx]; if(pit) storePutFromPack(cid, from.idx, 999, null); } else if(tgt&&tgt.id==='st-pack'&&from.src==='store'){ var st=getState().flags.storage[cid]; var it=st.items[from.idx]; if(it) storeTakeToPack(cid, from.idx, it.count||0, null); } if(from){ refreshStoragePanel(cid); storageSel=null; var f=document.getElementById('st-float'); if(f) f.style.display='none'; } }
    card.onpointerup=function(e){ endPDrag(e,false); };
    card.onpointercancel=function(e){ endPDrag(e,true); };
    card.onclick=function(e){ if(e.target.closest('[data-st-idx],[data-pk-idx]')) return; if(e.target.closest('button')) return; var f=document.getElementById('st-float'); if(f) f.style.display='none'; storageSel=null; };
    var ta=card.querySelector('#st-take-all'); if(ta) ta.onclick=function(){ stTakeAll(cid); };
    var pa=card.querySelector('#st-put-all'); if(pa) pa.onclick=function(){ stPutAll(cid); };
    var so=card.querySelector('#st-sort'); if(so) so.onclick=function(){ stSort(cid); };
    var lv=card.querySelector('#m-st-leave'); if(lv) lv.onclick=closeModal;
  }


    return {
      ensureStorage: ensureStorage, storageItemCount: storageItemCount, storageAdd: storageAdd, storagePut: storagePut, storageTake: storageTake, storeGet: storeGet, storePutFromPack: storePutFromPack, storeTakeToPack: storeTakeToPack, storeSwap: storeSwap, storeSort: storeSort, storeUseItem: storeUseItem, storeEquipItem: storeEquipItem, renderStoragePanel: renderStoragePanel, bindStoragePanel: bindStoragePanel
    };
  };
})(typeof window !== 'undefined' ? window : global);

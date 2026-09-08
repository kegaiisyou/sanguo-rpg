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
      var m=LF.ITEMS.makeItem('mucai',200); if(m) st.items.push(m);
      var st2=LF.ITEMS.makeItem('shitiao',100); if(st2) st.items.push(st2);
    }
    return st;
  }
  function storageItemCount(st, defId){
    var n=0; for(var i=0;i<st.items.length;i++){ var c=st.items[i]; if(c && itemKey(c)===defId) n+=c.count||0; }
    return n;
  }
  function storageAdd(cid, itemOrDefId, count){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var it=(typeof itemOrDefId==='string')? LF.ITEMS.makeItem(itemOrDefId, count||1) : itemOrDefId;
    if(!it) return false;
    if(packIsStackable(it)){
      var k=itemKey(it);
      for(var i=0;i<st.items.length;i++){ var c=st.items[i]; if(c && itemKey(c)===k && c.cat!=='装备'){ c.count=(c.count||1)+(it.count||1); return true; } }
    }
    var e=-1; for(var i=0;i<st.items.length;i++){ if(!st.items[i]){ e=i; break; } }
    if(e<0 && st.items.length<st.slots){ while(st.items.length<st.slots) st.items.push(null); e=-1; for(var i=0;i<st.items.length;i++){ if(!st.items[i]){ e=i; break; } } }
    if(e<0){ toast('仓库已满，存不下了。'); return false; }
    st.items[e]=it; return true;
  }
  function storagePut(cid, defId, n){
    var it=packFind(defId);
    if(!it || (it.count||0)<n){ toast('行囊此物不足。'); return; }
    if(!packIsStackable(it)){ toast('装备无法存入仓库。'); return; }
    if(!storageAdd(cid, defId, n)) return;
    packConsume(defId, n);
    save(getState()); afterPackChange();
    log('你将'+(LF.ITEMS[defId]?LF.ITEMS[defId].name:defId)+'×'+n+'存入仓库。','sys');
    if(getCurrentModalKind()==='storage') openModal('storage',{cid:cid});
  }
  function storageTake(cid, defId, n){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    if(storageItemCount(st, defId)<n){ toast('仓库此物不足。'); return; }
    if(!packAdd(defId, n)){ toast('行囊已满，无法取出。'); return; }
    var rem=n;
    for(var i=0;i<st.items.length && rem>0;i++){ var c=st.items[i]; if(c && itemKey(c)===defId){ var take=Math.min(rem, c.count||0); c.count-=take; rem-=take; if(c.count<=0) st.items[i]=null; } }
    save(getState()); afterPackChange();
    log('你从仓库取出'+(LF.ITEMS[defId]?LF.ITEMS[defId].name:defId)+'×'+(n-rem)+'。','sys');
    if(getCurrentModalKind()==='storage') openModal('storage',{cid:cid});
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
  function renderStoragePanel(cid){
    ensureStorage(cid); var st=getState().flags.storage[cid];
    var cnm=(LF.CITIES[cid]||{}).name||'此城';
    var used=0; for(var i=0;i<st.items.length;i++) if(st.items[i]) used++;
    var cbase='display:flex;align-items:center;justify-content:center;position:relative;width:46px;height:46px;margin:2px;border-radius:6px;font-size:12px;color:#3a3226;cursor:pointer;';
    var cells='';
    for(var i=0;i<st.slots;i++){
      var it=st.items[i];
      if(!it){ cells+='<div style="'+cbase+'background:rgba(120,100,70,.08);border:1px dashed rgba(120,100,70,.25);"></div>'; }
      else {
        var sel=(storageSel && storageSel.src==='store' && storageSel.defId===itemKey(it));
        var cnt=(it.count>1)?'<span style="position:absolute;right:2px;bottom:1px;font-size:10px;font-weight:700;color:#6b4a24;">'+it.count+'</span>':'';
        cells+='<div data-st-sel="store:'+i+'" style="'+cbase+'background:linear-gradient(180deg,#f7f0e2,#ece0c8);border:1px solid '+(sel?'#c8923a':'rgba(74,60,40,.28)')+';box-shadow:'+(sel?'0 0 0 2px rgba(200,146,58,.35)':'none')+';" title="'+it.name+'">'+itemIconHTML(it,12)+cnt+'</div>';
      }
    }
    var packHtml='';
    for(var i=0;i<getState().pack.length;i++){ var pit=getState().pack[i]; if(!pit||!packIsStackable(pit)) continue;
      var pk=itemKey(pit); var psel=(storageSel && storageSel.src==='pack' && storageSel.defId===pk);
      packHtml+='<button data-st-sel="pack:'+pk+'" style="display:inline-flex;align-items:center;gap:4px;margin:2px;padding:6px 10px;border-radius:8px;font-size:13px;color:#3a3226;cursor:pointer;background:linear-gradient(180deg,#f7f0e2,#ece0c8);border:1px solid '+(psel?'#c8923a':'rgba(74,60,40,.28)')+';box-shadow:'+(psel?'0 0 0 2px rgba(200,146,58,.35)':'none')+';">'+itemIconHTML(pit,12)+' '+pit.name+(pit.count>1?' ×'+pit.count:'')+'</button>';
    }
    if(!packHtml) packHtml='<div class="tip" style="margin:6px 0;">行囊空空，无物可存。</div>';
    var selHtml='<div class="tip" style="margin:8px 0 4px;color:#6b4a24;">点选上方格子取物，或点行囊物品存入。</div>';
    if(storageSel && storageSel.defId){
      var isStore=storageSel.src==='store';
      var act=isStore?'取出':'存入';
      var qs=[1,5,10,storageSel.max];
      var btns='';
      for(var qi=0;qi<qs.length;qi++){
        var qv=qs[qi]; if(qi===3 && qv<=10) continue;
        var lb=(qi===3)?'全部':'×'+qv;
        btns+='<button data-st-act="'+(isStore?'take':'put')+'" data-st-n="'+qv+'" style="margin:3px;padding:8px 14px;border-radius:8px;font-size:14px;color:#f7f0e2;background:linear-gradient(180deg,#8a6a3c,#6b4a24);border:1px solid #5a3d1e;cursor:pointer;">'+lb+'</button>';
      }
      selHtml='<div style="margin:8px 0 4px;">已选：'+storageSel.name+'（'+(isStore?storageItemCount(getState().flags.storage[cid], storageSel.defId):((packFind(storageSel.defId)||{}).count||0))+'）　'+act+'：'+btns+'</div>';
    }
    return '<h3 style="text-align:center;margin:0 0 6px;">仓 库 · '+cnm+'</h3>'
      + '<p class="tip" style="margin:0 0 6px;">容量 '+st.slots+' 格 · 已用 '+used+' 格。'+(cid==='kuyilao'?'初置木料石料，供营建之需。':'')+'</p>'
      + '<div style="display:flex;flex-wrap:wrap;justify-content:center;">'+cells+'</div>'
      + selHtml
      + '<div style="margin:10px 0 4px;font-size:13px;font-weight:700;color:#6b4a24;">行囊</div>'
      + '<div style="display:flex;flex-wrap:wrap;justify-content:center;">'+packHtml+'</div>'
      + '<button class="sheet-leave" id="m-st-leave">收 工</button>';
  }
  function bindStoragePanel(){
    var card=document.getElementById('modal-card')||getCard();
    card.querySelectorAll('[data-st-sel]').forEach(function(el){
      el.onclick=function(){
        var sp=el.getAttribute('data-st-sel').split(':');
        var src=sp[0], id=sp[1];
        if(src==='store'){ var st=getState().flags.storage[getStorageCid()]; var it=st?st.items[parseInt(id,10)]:null; if(it){ storageSel={src:'store',defId:itemKey(it),name:it.name,max:it.count||0}; } }
        else { var pit=packFind(id); if(pit){ storageSel={src:'pack',defId:id,name:pit.name,max:pit.count||0}; } }
        if(getStorageCid()!=null) openModal('storage',{cid:getStorageCid()});
      };
    });
    card.querySelectorAll('[data-st-act]').forEach(function(el){
      el.onclick=function(){
        if(!storageSel || getStorageCid()==null) return;
        var act=el.getAttribute('data-st-act');
        var n=parseInt(el.getAttribute('data-st-n'),10)||1;
        var st=getState().flags.storage[getStorageCid()];
        var max=(act==='take')? storageItemCount(st, storageSel.defId) : ((packFind(storageSel.defId)||{}).count||0);
        n=Math.min(n, max);
        if(n<=0){ toast('无物可取。'); return; }
        if(act==='take') storageTake(getStorageCid(), storageSel.defId, n);
        else storagePut(getStorageCid(), storageSel.defId, n);
      };
    });
    var lv=document.getElementById('m-st-leave'); if(lv) lv.onclick=closeModal;
  }

    return {
      ensureStorage: ensureStorage, storageItemCount: storageItemCount, storageAdd: storageAdd, storagePut: storagePut, storageTake: storageTake, storeGet: storeGet, storePutFromPack: storePutFromPack, storeTakeToPack: storeTakeToPack, storeSwap: storeSwap, storeSort: storeSort, storeUseItem: storeUseItem, storeEquipItem: storeEquipItem, renderStoragePanel: renderStoragePanel, bindStoragePanel: bindStoragePanel
    };
  };
})(typeof window !== 'undefined' ? window : global);

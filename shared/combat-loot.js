(function (global) {
  var LF = global.LF || (global.LF = {});
  // 战利品「搜打撤」窗口模块（v20261008p 自 shared/core/combat.js 拆出）
  // 左战利品 / 右行囊：点物品看属性、拖动取舍、拾取全部、装备对比。
  // 含 v20261008g 手机端修复：长按 150ms 进入拖拽、ghost 阈值 12px、
  // touchmove 防滚（拖拽期锁滚动，避免浏览器抢手势致判定失败）。
  // 依赖全部经 ctx 注入；除 document/window/Math/setTimeout 等宿主全局外不触碰
  // G / SFX / 战斗状态，可独立测试。
  LF.createCombatLoot = function (ctx) {
    var getState = ctx.getState, packAdd = ctx.packAdd, packList = ctx.packList,
        packMax = ctx.packMax, packResize = ctx.packResize, save = ctx.save, toast = ctx.toast,
        renderStatus = ctx.renderStatus, itemIconHTML = ctx.itemIconHTML,
        usePackItem = ctx.usePackItem, equipFromPackTo = ctx.equipFromPackTo,
        exitCombatToRoom = ctx.exitCombatToRoom;

    // 战利品「搜打撤」窗口：左战利品 / 右行囊，点物品看属性、拖动取舍、拾取全部
    function mountLootPanes(host, lootArr){
      host.classList.add('cs-panes-host');
      var lastReplaced=null;   // 装备替换后高亮的背包格
      host.innerHTML=
        '<div class="cs-panes-tip">拖到右侧行囊＝拾取；拖到左侧＝暂存（确认后未取走的战利品将被放弃）。点物品看属性，可装备/使用。</div>'+
        '<div class="cs-panes">'+
          '<div class="cs-pane loot"><div class="cs-pane-h">战 利 品</div><div class="cs-grid" id="lp-loot"></div><button id="lp-takeall" class="loot-act take">拾 取 全 部</button></div>'+
          '<div class="cs-pane"><div class="cs-pane-h">行 囊</div><div class="cs-grid" id="lp-bag"></div><button id="lp-sort" class="loot-act">整 理 背 包</button></div>'+
        '</div>'+
        '<div class="cs-org-cap" id="lp-cap"></div>'+
        '<div class="loot-info" id="lp-info" style="display:none;"></div>';
      var sel=null, ghost=null, dragSrc=null, startX=0, startY=0, moved=false, lastTap={t:0,key:null}, lootTimer=null, lootTouchLock=null;   // v20261008g：长按拖拽计时器 + 滚动锁
      function rerender(){
        var lg=document.getElementById('lp-loot'); if(!lg) return;
        var bg=document.getElementById('lp-bag');
        var lgh='', lc=0;
        for(var li=0; li<lootArr.length; li++){
          var it=lootArr[li];
          if(it){
            lc++;
            lgh+='<div class="packcell'+(sel&&sel.pane==='loot'&&sel.idx===li?' sel':'')+'" data-pane="loot" data-idx="'+li+'">'+
              '<div class="pcell-ic">'+itemIconHTML(it,15)+'</div>'+(it.count>1?'<span class="pcell-cnt">'+it.count+'</span>':'')+'</div>';
          } else {
            lgh+='<div class="packcell pcell-empty" data-pane="loot" data-idx="'+li+'"></div>';
          }
        }
        lg.innerHTML=lgh;
        var bgh='', bcap=Math.max(getState().pack.length, packMax());
        for(var bi=0; bi<bcap; bi++){
          var bit=getState().pack[bi];
          if(!bit){ bgh+='<div class="packcell pcell-empty" data-pane="bag" data-idx="'+bi+'"></div>'; continue; }
          var rep = lastReplaced && lastReplaced.pane==='bag' && lastReplaced.idx===bi;
          bgh+='<div class="packcell'+(sel&&sel.pane==='bag'&&sel.idx===bi?' sel':'')+(rep?' just-rep':'')+'" data-pane="bag" data-idx="'+bi+'">'+
            '<div class="pcell-ic">'+itemIconHTML(bit,15)+'</div>'+(bit.count>1?'<span class="pcell-cnt">'+bit.count+'</span>':'')+'</div>';
        }
        bg.innerHTML=bgh;
        var cap=document.getElementById('lp-cap'); if(cap) cap.textContent='战利品 '+lc+' 件 · 行囊 '+packList().length+' / '+packMax();
        wire();
      }
      function wire(){
        Array.prototype.forEach.call(host.querySelectorAll('.packcell'), function(c){ c.addEventListener('pointerdown', onDown); });
      }
      function onDown(e){
        var c=e.currentTarget;
        if(c.classList.contains('pcell-empty')) return;   // 空格不是拖拽源（交给滚动）
        e.preventDefault();
        hideInfo(); sel=null;
        startX=e.clientX; startY=e.clientY; moved=false;
        // v20261008g：长按 150ms 进入拖拽（先按后拖），轻滑放行滚动——修复手机端"拖动总被滚动抢走/判定失败"
        clearTimeout(lootTimer);
        lootTimer=setTimeout(function(){
          c.classList.add('dragging'); c.classList.add('drag-arm');
          dragSrc={pane:c.getAttribute('data-pane'), idx:parseInt(c.getAttribute('data-idx'),10)};
          try{ c.setPointerCapture(e.pointerId); }catch(_){}
          host.classList.add('drag-lock');
          if(!lootTouchLock){ lootTouchLock=function(ev){ if(dragSrc) ev.preventDefault(); }; document.addEventListener('touchmove', lootTouchLock, {passive:false}); }   // v20261008g：拖拽期禁浏览器滚动
          document.addEventListener('pointermove', onMove);
          document.addEventListener('pointerup', onUp);
        }, 150);
      }
      function onMove(e){
        // 长按未到：手指已移动 → 取消长按，放行滚动
        if(!dragSrc){
          if(Math.abs(e.clientX-startX)>10||Math.abs(e.clientY-startY)>10){ clearTimeout(lootTimer); }
          return;
        }
        if(!moved && (Math.abs(e.clientX-startX)>12||Math.abs(e.clientY-startY)>12)){
          moved=true;
          var it = dragSrc.pane==='loot'?lootArr[dragSrc.idx]:getState().pack[dragSrc.idx];
          makeGhost(it, e);
        }
        if(ghost){ ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px'; hlDrop(e); }
      }
      function onUp(e){
        clearTimeout(lootTimer);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if(lootTouchLock){ document.removeEventListener('touchmove', lootTouchLock); lootTouchLock=null; }
        if(ghost){ ghost.parentNode.removeChild(ghost); ghost=null; }
        clearHl();
        var dc=host.querySelector('.packcell.dragging'); if(dc) dc.classList.remove('dragging');   // 不论是否移动都清除淡化，避免源格卡在变淡态
        var da=host.querySelector('.packcell.drag-arm'); if(da) da.classList.remove('drag-arm');
        host.classList.remove('drag-lock');
        if(moved){ var tgt=cellAt(e.clientX,e.clientY); if(tgt) doMove(dragSrc,tgt); }
        else if(dragSrc){ onTap(dragSrc); }
        dragSrc=null;
      }
      function cellAt(x,y){
        var el=document.elementFromPoint(x,y);
        var cell=null, pane=null;
        while(el && el!==document.body){
          if(!cell && el.classList && el.classList.contains('packcell'))
            cell={pane:el.getAttribute('data-pane'), idx:parseInt(el.getAttribute('data-idx'),10)};
          if(!pane && el.classList && el.classList.contains('cs-pane')) pane=el.classList.contains('loot')?'loot':'bag';
          el=el.parentNode;
        }
        if(cell) return cell;                       // 落在具体格子 → 按该格
        return pane?{pane:pane, idx:null}:null;     // 落在面板空白处 → 落对方栏首位
      }
      function firstEmpty(){ if(getState().pack.length<packMax()){ while(getState().pack.length<packMax()) getState().pack.push(null); } for(var i=0;i<getState().pack.length;i++) if(!getState().pack[i]) return i; return -1; }   // 先补齐到容量再找空位，避免数组短于容量时误报满
      function firstLootEmpty(){ for(var i=0;i<lootArr.length;i++){ if(!lootArr[i]) return i; } return lootArr.length; }   // 满则追加（战利品栏不限数量）
      function sameStack(a,b){ if(!a||!b||a.cat==='装备'||b.cat==='装备'||a.maxDur||b.maxDur) return false; var ka=a.defId||a.id, kb=b.defId||b.id; return !!ka && ka===kb; }   // 仅同 defId 非装备可堆叠
      function doMove(src,tgt){
        // 同格 = 不操作（避免物品消失）
        if(src.pane===tgt.pane && tgt.idx!=null && src.idx===tgt.idx) return;
        // 背包→背包 空白背景 = 不操作
        if(src.pane==='bag' && tgt.pane==='bag' && tgt.idx==null) return;
        // 战利品→战利品 空白背景 = 不操作（临时背包内，保持原位）
        if(src.pane==='loot' && tgt.pane==='loot' && tgt.idx==null) return;

        if(src.pane==='loot' && tgt.pane==='bag'){
          var it=lootArr[src.idx]; if(!it) return;
          var bi=(tgt.idx==null)?firstEmpty():tgt.idx; if(bi<0){ toast('行囊已满'); return; }   // 背包满
          var occ=getState().pack[bi];
          if(sameStack(occ,it)){ occ.count=(occ.count||1)+(it.count||1); lootArr[src.idx]=null; }   // 同物自动堆叠
          else { lootArr[src.idx]= occ ? occ : null; getState().pack[bi]=it; }   // 换出物回填战利品（临时背包，确认后才结算）
        } else if(src.pane==='bag' && tgt.pane==='loot'){
          var bit=getState().pack[src.idx]; if(!bit) return;
          var slot=(tgt.idx==null)?firstLootEmpty():tgt.idx; var occL=lootArr[slot];
          if(sameStack(occL,bit)){ occL.count=(occL.count||1)+(bit.count||1); getState().pack[src.idx]=null; }   // 同物堆叠
          else { getState().pack[src.idx]= occL || null; lootArr[slot]=bit; }
        } else if(src.pane==='bag' && tgt.pane==='bag'){
          var bit2=getState().pack[src.idx]; if(!bit2) return;
          var occ2=getState().pack[tgt.idx];
          if(sameStack(occ2,bit2)){ occ2.count=(occ2.count||1)+(bit2.count||1); getState().pack[src.idx]=null; }   // 同物堆叠
          else { getState().pack[tgt.idx]=bit2; getState().pack[src.idx]= occ2 || null; }   // 交换
        } else if(src.pane==='loot' && tgt.pane==='loot' && src.idx!==tgt.idx){
          var a=lootArr[src.idx], b=lootArr[tgt.idx];
          if(sameStack(a,b)){ b.count=(b.count||1)+(a.count||1); lootArr[src.idx]=null; }   // 同物堆叠
          else { lootArr[src.idx]=b; lootArr[tgt.idx]=a; }
        }
        // 规整行囊：稀疏 undefined 填成 null，并补齐到容量上限（不重排索引，避免拖拽后错位）
        (function(){ var max=packMax(); for(var i=0;i<getState().pack.length;i++){ if(getState().pack[i]===undefined) getState().pack[i]=null; } while(getState().pack.length<max) getState().pack.push(null); })();
        sel=null; hideInfo(); renderStatus(); rerender();
      }
      function onTap(src){
        var key=src.pane+':'+src.idx, now=Date.now();
        if(lastTap.key===key && now-lastTap.t<320){ lastTap.t=0; quickLootGrab(src); return; }  // 双击：快速装备/使用
        lastTap={t:now, key:key};
        var cur = sel && sel.pane===src.pane && sel.idx===src.idx;
        if(cur){ sel=null; hideInfo(); host.querySelectorAll('.packcell.sel').forEach(function(c){ c.classList.remove('sel'); }); return; }  // 再点同格：取消选中
        sel={pane:src.pane, idx:src.idx};
        host.querySelectorAll('.packcell.sel').forEach(function(c){ c.classList.remove('sel'); });   // 仅更新高亮，不重渲染，避免滚动复位
        var cell=host.querySelector('.packcell[data-pane="'+src.pane+'"][data-idx="'+src.idx+'"]'); if(cell) cell.classList.add('sel');
        var it = src.pane==='loot'?lootArr[src.idx]:getState().pack[src.idx];
        showInfo(it);
      }
      function quickLootGrab(src){
        var it=src.pane==='loot'?lootArr[src.idx]:getState().pack[src.idx]; if(!it) return;
        if(it.cat==='装备' && it.slot){
          var oldEq=getState().equipment[it.slot];
          if(src.pane==='loot') lootArr[src.idx]=null; else getState().pack[src.idx]=oldEq||null;
          getState().equipment[it.slot]=it;
          if(oldEq){ var ri=getState().pack.indexOf(oldEq); if(ri>=0) lastReplaced={pane:'bag',idx:ri}; }
          toast('装备「'+it.name+'」'+(oldEq?'，卸下「'+oldEq.name+'」':''));
        } else if(it.effect || it.cat==='丹药' || it.cat==='兵粮'){
          var useIdx;
          if(src.pane==='loot'){ var e=firstEmpty(); if(e<0){ toast('行囊已满'); return; } lootArr[src.idx]=null; getState().pack[e]=it; useIdx=e; }
          else useIdx=src.idx;
          usePackItem(useIdx);
        }
        save(getState()); renderStatus(); rerender(); hideInfo();
        if(lastReplaced){ var rc=host.querySelector('.packcell[data-pane="bag"][data-idx="'+lastReplaced.idx+'"]'); if(rc) rc.scrollIntoView({block:'nearest',behavior:'smooth'}); setTimeout(function(){ lastReplaced=null; rerender(); },1300); }
      }
      function showInfo(it){
        var box=document.getElementById('lp-info'); if(!box) return;
        box.innerHTML = lootInfoHTML(it) + liActionsHTML(it); box.style.display='block';
        Array.prototype.forEach.call(box.querySelectorAll('.li-act'), function(b){
          b.onclick=function(e){ e.stopPropagation(); actOn(it, b.getAttribute('data-act')); };
        });
        var infoCell = host.querySelector('.packcell.sel');   // 浮框宽度=被点击格子实际宽度，保持与「未选中时」格子一样大
        if(infoCell){ var cw=infoCell.getBoundingClientRect().width; if(cw) box.style.width=Math.max(88, Math.min(184, Math.round(cw)))+'px'; }
        positionInfo(box, infoCell);
      }
      function liActionsHTML(it){
        var h='<div class="li-acts">';
        if(it.cat==='装备') h+='<button class="li-act" data-act="equip">装 备</button>';
        if(it.effect || it.cat==='丹药' || it.cat==='兵粮') h+='<button class="li-act" data-act="use">使 用</button>';
        h+='</div>';
        return h;
      }
      function actOn(it, act){
        if(act==='equip'){
          var oldEq = it.slot ? getState().equipment[it.slot] : null;
          var idx = (sel.pane==='loot') ? firstEmpty() : sel.idx;
          if(idx<0){ toast('行囊已满，无法装备'); return; }
          if(sel.pane==='loot'){ var occ=getState().pack[idx]; lootArr[sel.idx]=occ||null; getState().pack[idx]=it; }
          equipFromPackTo(idx, it.slot);
          if(oldEq){ var ri=getState().pack.indexOf(oldEq); if(ri>=0){ lastReplaced={pane:'bag', idx:ri}; } }   // 高亮被换下的装备
        } else {
          var idx2 = (sel.pane==='loot') ? firstEmpty() : sel.idx;
          if(idx2<0){ toast('行囊已满，无法使用'); return; }
          if(sel.pane==='loot'){ var occ2=getState().pack[idx2]; lootArr[sel.idx]=occ2||null; getState().pack[idx2]=it; }
          usePackItem(idx2);
        }
        save(getState()); renderStatus(); rerender(); hideInfo();
        if(lastReplaced){ var rc=host.querySelector('.packcell[data-pane="bag"][data-idx="'+lastReplaced.idx+'"]'); if(rc) rc.scrollIntoView({block:'nearest', behavior:'smooth'}); }   // 被换下装备若不在视野内自动滚到
        if(lastReplaced) setTimeout(function(){ lastReplaced=null; rerender(); }, 1300);
      }
      // 悬浮弹层：跟随所点格子定位，空间不足自动翻到格子上方，避免破坏网格布局
      function positionInfo(box, cell){
        var vw=window.innerWidth, vh=window.innerHeight, m=8;
        var bw=box.offsetWidth||150, bh=box.offsetHeight||120;
        if(!cell){ box.style.left='50%'; box.style.top=''; box.style.bottom=m+'px'; box.style.transform='translateX(-50%)'; return; }
        var r=cell.getBoundingClientRect();
        var left=r.left+r.width/2-bw/2; left=Math.max(m, Math.min(left, vw-bw-m));
        var top=r.bottom+m;
        if(top+bh > vh-m){ top=r.top-bh-m; }   // 下方放不下 → 翻到格子上方
        if(top < m) top=m;
        box.style.left=left+'px'; box.style.top=top+'px'; box.style.bottom=''; box.style.transform='';
      }
      function relayout(){ var box=document.getElementById('lp-info'); if(box && box.style.display==='block') hideInfo(); }   // 滚动/缩放即收起弹层，避免遮挡
      window.addEventListener('scroll', relayout, true);
      window.addEventListener('resize', relayout);
      host.addEventListener('pointerdown', function(e){   // 点空白区域收起弹层（不重渲染、不复位滚动）
        if(e.target.closest('.packcell') || e.target.closest('.loot-info')) return;
        hideInfo();
      }, true);
      function hideInfo(){ var box=document.getElementById('lp-info'); if(box){ box.style.display='none'; box.innerHTML=''; } }
      function makeGhost(it,e){
        ghost=document.createElement('div'); ghost.className='loot-ghost';
        ghost.innerHTML = it?itemIconHTML(it,28):'📦';
        ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px';
        document.body.appendChild(ghost);
      }
      function hlDrop(e){
        clearHl();
        var el=document.elementFromPoint(e.clientX,e.clientY);
        while(el && el!==document.body && !(el.classList&&el.classList.contains('packcell'))) el=el.parentNode;
        if(el && el.classList && el.classList.contains('packcell')) el.classList.add('drop-ok');
      }
      function clearHl(){ Array.prototype.forEach.call(host.querySelectorAll('.drop-ok'), function(c){ c.classList.remove('drop-ok'); }); }
      function organizePack(){
        var prio={'装备':0,'丹药':1,'兵粮':2,'材料':3,'杂物':4};
        var real=getState().pack.filter(function(x){return x;});
        real.sort(function(a,b){ var pa=prio[a.cat]!=null?prio[a.cat]:9, pb=prio[b.cat]!=null?prio[b.cat]:9; if(pa!==pb) return pa-pb; return (a.name||'').localeCompare(b.name||''); });
        // 整理时合并同 defId 堆叠（sameStack 判定：排除装备/耐久物，杜绝 undefined===undefined 误判导致不同物品错堆）
        for(var i=0;i<real.length;i++){
          if(!real[i]) continue;
          for(var j=i+1;j<real.length;j++){
            if(real[j] && sameStack(real[i], real[j])){ real[i].count=(real[i].count||1)+(real[j].count||1); real[j]=null; }
          }
        }
        getState().pack=real.filter(function(x){return x;});
        packResize();   // 整理后数组可能短于容量，补齐到 packMax，避免 UI 出现"幽灵空位"而 packAdd 误判行囊已满
        save(getState()); renderStatus(); sel=null; hideInfo(); rerender();
      }
      var ta=document.getElementById('lp-takeall');
      if(ta) ta.onclick=function(){
        for(var i=0;i<lootArr.length;i++){ if(lootArr[i] && packAdd(lootArr[i])) lootArr[i]=null; }
        sel=null; hideInfo(); renderStatus(); rerender();
      };
      var sb=document.getElementById('lp-sort');
      if(sb) sb.onclick=function(){ organizePack(); };
      rerender();
    }

    // 独立战利品窗口（宝箱等非战斗场景）：标题 + 左右对照 + 确认
    function openLootWindow(loot, opts){
      var onConfirm=opts.onConfirm||exitCombatToRoom;
      var ov=document.getElementById('loot-win'); if(ov&&ov.parentNode) ov.parentNode.removeChild(ov);
      ov=document.createElement('div'); ov.id='loot-win'; ov.className='loot-win';
      ov.innerHTML='<div class="loot-card">'+
        (opts.title?'<div class="cs-title">'+opts.title+'</div>':'')+
        (opts.sub?'<div class="cs-sub">'+opts.sub+'</div>':'')+
        '<div id="lp-host"></div>'+
        '<button id="lp-ok" class="act cb-menu primary" style="width:100%;margin-top:10px;min-height:48px;font-size:16px;letter-spacing:3px;">确 认</button>'+
        '</div>';
      (document.getElementById('app')||document.body).appendChild(ov);
      mountLootPanes(document.getElementById('lp-host'), loot);
      var ok=document.getElementById('lp-ok');
      if(ok) ok.onclick=function(){
        if(loot.some(function(x){return x;}) && !ok.dataset.armed){ ok.dataset.armed='1'; ok.textContent='战利品未取完 · 再点确认放弃'; return; }   // 二次确认防误弃
        save(getState()); renderStatus(); if(ov.parentNode) ov.parentNode.removeChild(ov); onConfirm();
      };
    }

    // 物品属性信息（战利品窗口点选时显示）
    function compareEquip(it){
      if(!it || it.cat!=='装备' || !it.slot) return '';
      var cur=getState().equipment[it.slot];
      if(!cur) return '<div class="li-cmp good">当前未装备此部位 · 可直接穿戴</div>';
      var keys=[['atk','攻'],['def','防'],['spd','速'],['hp','气血']];
      var parts=[];
      keys.forEach(function(k){ var d=(it[k[0]]||0)-(cur[k[0]]||0); if(d!==0) parts.push((d>0?'▲ ':'▼ ')+k[1]+(d>0?' +':' ')+d); });
      if(!parts.length) return '<div class="li-cmp">与当前「'+cur.name+'」属性相同</div>';
      var sumAfter=(it.atk||0)+(it.def||0)+(it.spd||0)+(it.hp||0);
      var sumCur=(cur.atk||0)+(cur.def||0)+(cur.spd||0)+(cur.hp||0);
      var good = sumAfter>sumCur;
      return '<div class="li-cmp '+(good?'good':'bad')+'">对比「'+cur.name+'」：'+parts.join(' · ')+'</div>';
    }
    function lootInfoHTML(it){
      if(!it) return '';
      var h='<div class="li-name">'+it.name+'</div>';
      h+='<div class="li-cat">'+(it.cat||'道具')+(it.qualityName?(' · '+it.qualityName):'')+'</div>';
      var lines=[];
      if(it.atk) lines.push('攻 +'+it.atk);
      if(it.def) lines.push('防 +'+it.def);
      if(it.spd) lines.push('速 +'+it.spd);
      if(it.hp) lines.push('气血 +'+it.hp);
      if(it.effect){
        var e=it.effect,t=[];
        if(e.heal) t.push('回复气血 '+e.heal);
        if(e.hp) t.push('回复气血 '+e.hp);
        if(e.dmg) t.push('伤害 '+e.dmg);
        if(e.atk) t.push('攻 +'+e.atk);
        if(e.buff) t.push('施加增益');
        if(t.length) lines.push(t.join(' / '));
      }
      if(lines.length) h+='<div class="li-line">'+lines.join(' · ')+'</div>';
      if(it.cat==='装备') h+=compareEquip(it);
      return h;
    }
    return {
      mountLootPanes: mountLootPanes, openLootWindow: openLootWindow,
      compareEquip: compareEquip, lootInfoHTML: lootInfoHTML
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createCombatLoot;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

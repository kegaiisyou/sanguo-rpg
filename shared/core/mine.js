// 模块 mine（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createMine = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var RECIPES = ctx.RECIPES;
    var advanceMinutes = ctx.advanceMinutes;
    var afterPackChange = ctx.afterPackChange;
    var busyAct = ctx.busyAct;
    var closeModal = ctx.closeModal;
    var exert = ctx.exert;
    var log = ctx.log;
    var openModal = ctx.openModal;
    var renderStatus = ctx.renderStatus;
    var toast = ctx.toast;
    var $card = ctx.getCard ? ctx.getCard() : document.getElementById('modal-card');   // v20260924w：闭包裸引用 $card → 开矿洞即炸，经 ctx 取 modal 容器

  // ══════════ 矿坑体系（v20260915i）：露天矿脉 + 分层矿洞 + 镐头六级 ══════════
  // 镐头不进行囊，是玩家自身的等级（S().flags.pick，0=粗石镐 … 5=百炼钢镐）：
  //   露天矿脉与矿洞全靠它衡量能凿什么、凿几下；升级走铁匠炉（RECIPES.forge 的 pick:N 配方）、
  //   市集（青铜镐）、或差役奖励（淘铜铸镐）。
  function pickLv(){ return (S().flags && S().flags.pick) || 0; }
  function pickDef(lv){
    lv = (lv==null) ? pickLv() : lv;
    return (LF.PICKS || [])[lv] || { name:'粗石镐', icon:'🪨', lv:0, desc:'', caveMax:2 };
  }
  function upgradePick(lv){
    var cur = pickLv();
    if (lv <= cur) return false;            // 镐只升不降
    if (lv > 5) lv = 5;
    var pd = pickDef(lv);
    S().flags.pick = lv;
    save(S()); renderStatus();
    log('你换上了'+pd.name+'——'+(pd.desc || ''),'good');
    return true;
  }
  // 按当前镐算「凿某类矿点需几镐」（-1 = 镐不够，刃会弹开）
  function pickHitsNow(t){
    var h = ((LF.PICKS||[])[pickLv()]||{}).hits || {};
    return (h[t] == null) ? -1 : h[t];
  }
  function mineState(){ var st=S(); if(!st.mine) st.mine={ spots:null, used:false }; return st.mine; }

  // ═══ 露天矿脉 ═══
  function genOpenMine(){
    var m = mineState();
    var pool=[];
    function push(t,w){ for(var i=0;i<w;i++) pool.push(t); }
    push('gap',2); push('rock',7); push('big',2); push('iron',2); push('jade',1);
    var spots=[];
    for(var i=0;i<16;i++){
      var t=pool[Math.floor(Math.random()*pool.length)];
      spots.push({ t:t, alive:true, hp:null, clicks:0 });
    }
    m.spots=spots; m.used=false;
  }
  function renderMinePanel(){
    var m=mineState();
    if(!m.spots || !m.spots.length){ genOpenMine(); }
    var pd=pickDef();
    var h='<h3 style="text-align:center;margin:0 0 6px;">⛏ 露天矿脉</h3>';
    h+='<div class="mine-head">'+(pd.icon||'🪨')+' 手中镐：<b>'+pd.name+'</b></div>';
    h+='<div class="mine-tip">'+(pd.desc||'')+'</div>';
    h+='<div class="mine-grid">';
    for(var i=0;i<m.spots.length;i++){
      var sp=m.spots[i];
      var ms=LF.MINE_SPOT[sp.t];
      var lock=(pickLv()<LF.PICK_GATE[sp.t]);
      var hits=pickHitsNow(sp.t);
      var hp=(sp.hp==null?hits:sp.hp);
      h+='<button class="mine-cell'+(sp.alive?'':' dead')+(lock?' lock':'')+'" data-mi="'+i+'">'+
          '<span class="mc-ic">'+ms.icon+'</span>'+
          '<span class="mc-n">'+ms.name+'</span>'+
          (sp.alive?('<span class="mc-h">'+(lock?'镐不足':(hp>0?('余 '+hp+' 镐'):'已尽'))+'</span>'):'<span class="mc-h">采尽</span>')+
         '</button>';
    }
    h+='</div>';
    h+='<div style="text-align:center;margin:8px 0;"><button class="btn-mini" id="m-forge-pick">🔨 锻镐铸镐</button></div>';
    h+='<p class="tip" style="text-align:center;">每凿一镐耗一刻与精力；采尽一轮，矿脉自行刷新。铁砂、青玉等好料，凭镐而取。</p>';
    h+='<button class="sheet-leave" id="m-leave">收 工</button>';
    return h;
  }
  function bindMinePanel(){
    var card=$card;
    card.querySelectorAll('.mine-cell[data-mi]').forEach(function(b){
      b.onclick=function(){ mineHit(parseInt(b.getAttribute('data-mi'),10)); };
    });
    var fp=document.getElementById('m-forge-pick');
    if(fp) fp.onclick=function(){ openModal('craft',{bench:'forge'}); };
    var lv=document.getElementById('m-leave'); if(lv) lv.onclick=closeModal;
  }
  function mineHit(idx){
    var m=mineState();
    if(!m.spots || !m.spots[idx]) return;
    var sp=m.spots[idx];
    if(!sp.alive) return;
    var t=sp.t, ms=LF.MINE_SPOT[t];
    if(pickLv()<LF.PICK_GATE[t]){ toast('镐刃弹开——这'+ms.name+'，得换把好镐才凿得动。'); return; }
    if(!exert('开凿矿料')) return;
    if(S().energy<4){ log('〔力竭〕你两臂发颤，连镐都握不稳了。','warn'); return; }
    busyAct('开凿矿料·一镐', 650, function(){
      S().energy=Math.max(0,S().energy-4);
      advanceMinutes(30);
      var hits=pickHitsNow(t);
      if(sp.hp==null) sp.hp=hits; else if(sp.hp>hits) sp.hp=hits;
      sp.hp--;
      var gone=false;
      if(t==='jade'){ sp.clicks=(sp.clicks||0)+1; if(sp.hp>0 && sp.clicks>=LF.MINE_SPOT.jade.limit) gone=true; }
      if(sp.hp<=0 || gone){
        sp.alive=false;
        if(gone){ log('青玉脉光华一闪，没入岩壁——你只抢到一瞬，没凿透。','sys'); }
        else {
          packAdd(ms.out, ms.outN);
          var extra='';
          if(ms.crit && Math.random()<ms.critPct){ packAdd(ms.crit,1); extra='，兼得'+LF.ITEMS[ms.crit].name+'×1'; }
          log('你凿穿了'+ms.name+'，得'+LF.ITEMS[ms.out].name+'×'+ms.outN+extra+'。','good');
        }
      } else {
        log('你一镐凿下，'+ms.name+'碎了些许（余 '+sp.hp+' 镐）。','env');
      }
      var left=m.spots.filter(function(x){return x.alive;}).length;
      if(left===0){ genOpenMine(); log('矿脉采尽，山壁簌簌落土——新一层矿脉露了出来。','sys'); }
      save(S()); afterPackChange();
      $card.innerHTML = renderMinePanel(); bindMinePanel();
    });
  }

  // ═══ 矿洞（分层 1-9）═══
  function caveState(){ var st=S(); if(!st.cave) st.cave={ floor:1, points:null, pity:0, guarantee:false, eventDone:false, downDug:false }; return st.cave; }
  function rareForFloor(floor){
    if(floor>=9) return 'xuan';
    if(floor>=7) return 'jade';
    if(floor>=5) return 'iron';
    return 'copper';
  }
  function caveFloorDesc(floor){
    if(floor<=2) return '浅层：碎石杂陈，岩缝里夹着柴木。';
    if(floor===3||floor===4) return '中层：石壁渐硬，岩壁上沁出青绿——古铜脉在此。';
    if(floor===5||floor===6) return '深处：铁砂成堆，隐隐有磁石吸着镐头。';
    if(floor===7||floor===8) return '幽深：壁上玉光点点，传说有人在此刻过字。';
    return '最底：墨色铁母沉在岩心，阴风自更深处灌来。';
  }
  function genCaveFloor(floor){
    var c=caveState();
    var pool=[];
    function push(t,w){ for(var i=0;i<w;i++) pool.push(t); }
    if(floor<=2){ push('rock',6); push('gap',2); }
    else if(floor===3){ push('rock',4); push('gap',1); push('big',2); push('copper',3); }
    else if(floor===4){ push('rock',3); push('big',2); push('copper',3); push('iron',2); }
    else if(floor===5||floor===6){ push('big',3); push('copper',2); push('iron',4); }
    else if(floor===7||floor===8){ push('big',2); push('iron',3); push('jade',3); }
    else { push('xuan',2); push('jade',2); push('iron',2); }
    var n=3+Math.floor(Math.random()*3);
    var spots=[];
    for(var i=0;i<n;i++){ spots.push({ t:pool[Math.floor(Math.random()*pool.length)], alive:true, hp:null, clicks:0 }); }
    c.floor=floor; c.points=spots; c.pity=0; c.guarantee=false; c.eventDone=false; c.downDug=false;
    save(S());
  }
  function renderCavePanel(){
    var c=caveState();
    if(!c.points || !c.points.length){ genCaveFloor(c.floor||1); }
    var pd=pickDef();
    var h='<h3 style="text-align:center;margin:0 0 6px;">🕳 矿洞 · 第 '+c.floor+' 层</h3>';
    h+='<div class="mine-head">'+(pd.icon||'🪨')+' 手中镐：<b>'+pd.name+'</b> · 最深可下 '+pd.caveMax+' 层</div>';
    h+='<div class="cave-vein">'+caveFloorDesc(c.floor)+'</div>';
    h+='<div class="mine-grid">';
    for(var i=0;i<c.points.length;i++){
      var sp=c.points[i];
      var ms=LF.MINE_SPOT[sp.t];
      var lock=(pickLv()<LF.PICK_GATE[sp.t]);
      var hits=pickHitsNow(sp.t);
      var hp=(sp.hp==null?hits:sp.hp);
      h+='<button class="mine-cell'+(sp.alive?'':' dead')+(lock?' lock':'')+'" data-ci="'+i+'">'+
          '<span class="mc-ic">'+ms.icon+'</span>'+
          '<span class="mc-n">'+ms.name+'</span>'+
          (sp.alive?('<span class="mc-h">'+(lock?'镐不足':(hp>0?('余 '+hp+' 镐'):'已尽'))+'</span>'):'<span class="mc-h">采尽</span>')+
         '</button>';
    }
    h+='</div>';
    var st=S();
    if(c.floor>=7 && c.floor<=8 && !st.flags.task.bailian_stele && !st.flags.mine_stele){
      h+='<div style="text-align:center;margin:8px 0;"><button class="btn-mini" id="m-stele">🪦 研读残碑</button></div>';
    }
    if(c.floor===9 && !st.flags.mine_armory){
      h+='<div style="text-align:center;margin:8px 0;"><button class="btn-mini" id="m-armory">⚔ 前朝藏兵洞</button></div>';
    }
    if(c.floor>=9){
      h+='<p class="tip" style="text-align:center;">已是第九层，再无下路。</p>';
    } else if(!c.downDug){
      h+='<div style="text-align:center;margin:10px 0;"><button class="btn-mini" id="m-cave-dig">⬇ 探查下路（松动的岩壁）</button></div>';
      h+='<p class="tip" style="text-align:center;">矿道并非处处通底——寻一处松动的岩壁凿开，方有下行之路；每下一层耗一挂木梯。</p>';
    } else {
      h+='<div style="text-align:center;margin:10px 0;"><button class="btn-mini" id="m-cave-down">⬇ 架木梯下行</button></div>';
      h+='<p class="tip" style="text-align:center;">下路已通——峭壁陡滑，须架一挂木梯方能下行（木梯：木材×3+石料×2，铁匠炉制得）。</p>';
    }
    h+='<div style="display:flex;gap:8px;justify-content:center;margin:10px 0;flex-wrap:wrap;">'+
        '<button class="btn-mini" id="m-cave-up">↑ 收工上撤</button></div>';
    h+='<p class="tip" style="text-align:center;">越深矿越好，也越耗精力（每镐 '+(5+c.floor)+' 点）；连凿八镐不见好料，下一镐必出稀罕。</p>';
    h+='<button class="sheet-leave" id="m-leave">收 工</button>';
    return h;
  }
  function bindCavePanel(){
    var card=$card;
    card.querySelectorAll('.mine-cell[data-ci]').forEach(function(b){
      b.onclick=function(){ caveHit(parseInt(b.getAttribute('data-ci'),10)); };
    });
    var st=document.getElementById('m-stele'); if(st) st.onclick=steleRead;
    var ar=document.getElementById('m-armory'); if(ar) ar.onclick=armoryEnter;
    var dg=document.getElementById('m-cave-dig'); if(dg) dg.onclick=caveDig;
    var dn=document.getElementById('m-cave-down'); if(dn) dn.onclick=caveDown;
    var up=document.getElementById('m-cave-up'); if(up) up.onclick=function(){ closeModal(); log('你沿矿道拾级而上，重见天光。','env'); };
    var lv=document.getElementById('m-leave'); if(lv) lv.onclick=closeModal;
  }
  function caveHit(idx){
    var c=caveState();
    if(!c.points || !c.points[idx]) return;
    var sp=c.points[idx];
    if(!sp.alive) return;
    var t=sp.t, ms=LF.MINE_SPOT[t];
    if(pickLv()<LF.PICK_GATE[t]){ toast('镐刃弹开——这'+ms.name+'，得换把好镐才凿得动。'); return; }
    if(!exert('凿矿')) return;
    if(S().energy < 5+c.floor){ log('〔力竭〕矿道深邃，你气力不济——先收工回去歇歇。','warn'); return; }
    busyAct('凿矿·一镐', 650, function(){
      S().energy=Math.max(0,S().energy-(5+c.floor));
      advanceMinutes(30);
      if(!c.eventDone){ c.eventDone=true; rollCaveEvent(c); }
      var hits=pickHitsNow(t);
      if(sp.hp==null) sp.hp=hits; else if(sp.hp>hits) sp.hp=hits;
      sp.hp--;
      var done=(sp.hp<=0), gone=false;
      if(t==='jade'){ sp.clicks=(sp.clicks||0)+1; if(!done && sp.clicks>=LF.MINE_SPOT.jade.limit){ done=true; gone=true; } }
      if(done){
        sp.alive=false;
        if(gone){ log('青玉脉光华一闪，没入岩壁——没凿透。','sys'); }
        else {
          var isRare=(t==='copper'||t==='iron'||t==='jade'||t==='xuan');
          var out=ms.out, outN=ms.outN, rar=false;
          if(!isRare && c.guarantee){
            var rt=rareForFloor(c.floor), rms=LF.MINE_SPOT[rt];
            out=rms.out; outN=rms.outN; rar=true;
            log('矿壁深处闪出一道'+rms.name+'的异色——这一镐凿出好东西！','good');
          }
          packAdd(out,outN);
          log('你凿穿了'+ms.name+'，得'+LF.ITEMS[out].name+'×'+outN+'。','good');
          if(isRare||rar){ c.pity=0; c.guarantee=false; }
          else {
            c.pity++;
            if(c.pity>=8){ c.guarantee=true; c.pity=0; log('连凿数镐不见好料——矿壁深处透出一线异色，下一镐必出稀罕。','sys'); }
          }
        }
      } else {
        c.pity++;
        if(c.pity>=8 && !c.guarantee){ c.guarantee=true; c.pity=0; log('连凿数镐不见好料——矿壁深处透出一线异色，下一镐必出稀罕。','sys'); }
        log('你一镐凿下，'+ms.name+'碎了些许（余 '+sp.hp+' 镐）。','env');
      }
      save(S()); afterPackChange();
      $card.innerHTML = renderCavePanel(); bindCavePanel();
    });
  }
  function rollCaveEvent(c){
    var r=Math.random();
    if(r<0.14){ S().energy=Math.max(0,S().energy-10); log('头顶簌簌落土，一小段矿道塌了下来——你连滚带爬避开，耗去不少气力（精力-10）。','warn'); }
    else if(r<0.28){ S().energy=Math.min(S().maxEnergy||100,S().energy+10); log('岩壁缝隙渗出清泉，你掬了几捧，精神一振（精力+10）。','env'); }
    else if(r<0.42){ log('一群蝙蝠扑棱棱掠过，惊得你心头一紧——好在没伤着人。','env'); }
    else if(r<0.54){ S().gold=(S().gold||0)+10; log('镐头磕到个硬物——拨开浮土，是半瓮前朝旧钱（银两+10）。','good'); }
  }
  // 探查下路（v20260915j）：每层先凿开松动的岩壁，方有下行之路；挖开时若带着木梯，顺手架梯直下
  function caveDig(){
    var c=caveState();
    if(c.floor>=9){ toast('已是第九层，再无下路。'); return; }
    if(c.downDug) return;
    if(!exert('探查下路')) return;
    busyAct('凿开松动岩壁', 800, function(){
      S().energy=Math.max(0,S().energy-6);
      advanceMinutes(30);
      c.downDug=true;
      var hasLadder=(packFind('muti')||{count:0}).count>=1;
      if(hasLadder){
        var next=c.floor+1;
        var pd=pickDef();
        if((pd.caveMax||2) < next){
          log('下路挖通了——但再往下，岩壁硬得凿之不动，换把好镐再来。','warn');
        } else {
          packConsume('muti',1);
          S().energy=Math.max(0,S().energy-8);
          genCaveFloor(next);
          log('你凿开松动的岩壁，架上木梯向深处攀去——已至第 '+next+' 层。','good');
        }
      } else {
        log('你凿开松动的岩壁，底下透出黑黢黢的深洞——峭壁陡滑，须一挂木梯方能下行（木梯：木材×3+石料×2，铁匠炉制得）。','sys');
      }
      save(S()); afterPackChange();
      $card.innerHTML = renderCavePanel(); bindCavePanel();
    });
  }
  // 架木梯下行（v20260915j）：下路挖通后，须耗一挂木梯才能再下一层
  function caveDown(){
    var c=caveState();
    var next=c.floor+1;
    if(next>9){ toast('已是第九层，再无下路。'); return; }
    if(!c.downDug){ toast('下路尚未挖通——先探查并凿开松动的岩壁。'); return; }
    if((packFind('muti')||{count:0}).count<1){ toast('须一挂木梯方能下行——木梯以木材×3+石料×2，在铁匠炉制得。'); return; }
    var pd=pickDef();
    if((pd.caveMax||2) < next){ toast('再往下，岩壁硬得凿之不动——换把好镐再来。'); return; }
    if(!exert('下行')) return;
    busyAct('架梯下行', 700, function(){
      packConsume('muti',1);
      S().energy=Math.max(0,S().energy-8);
      advanceMinutes(30);
      genCaveFloor(next);
      log('你架上木梯，一级级向深处攀去——已至第 '+next+' 层。','env');
      save(S()); afterPackChange();
      $card.innerHTML = renderCavePanel(); bindCavePanel();
    });
  }
  function steleRead(){
    var st=S();
    if(st.flags.task.bailian_stele || st.flags.mine_stele){ toast('碑文已拓过了。'); return; }
    if((packFind('zhuzi')||{count:0}).count<1 || (packFind('mo')||{count:0}).count<1){
      toast('拓碑需备竹与墨（削竹为简、松烟为墨）。'); return;
    }
    packConsume('zhuzi',1); packConsume('mo',1);
    packAdd('bailian_jian',1);
    st.flags.task.bailian_stele=true; st.flags.mine_stele=true;
    log('你研墨展简，把残碑上的铭文一笔一画拓了下来——「以炒铁为料，折叠锻打……千锤乃成」，正是百炼钢法。','good');
    log('〔得百炼钢简〕持之往铁匠铺，可依简锻百炼钢镐。','sys');
    save(S()); afterPackChange();
    $card.innerHTML = renderCavePanel(); bindCavePanel();
  }
  function armoryEnter(){
    var st=S();
    if(st.flags.mine_armory){ toast('藏兵洞已搜过了。'); return; }
    st.flags.mine_armory=true;
    if(!packFind('bailian_jian')){
      packAdd('bailian_jian',1);
      log('你推开半掩的石门，里头是前朝旧卒的藏兵洞——角落里一具枯骨旁，散着几片刻字铁简。','env');
      log('拾起细看，竟是百炼钢法残简！〔得百炼钢简〕','good');
    } else {
      packAdd('xuatie',2); st.gold=(st.gold||0)+20;
      log('藏兵洞里再翻不出新物——只在墙根刨出两块沉甸甸的墨色铁母（玄铁×2·银两+20）。','good');
    }
    save(S()); afterPackChange();
    $card.innerHTML = renderCavePanel(); bindCavePanel();
  }

    return {
      armoryEnter, bindCavePanel, bindMinePanel, caveDig,
      caveDown, caveFloorDesc, caveHit, caveState,
      genCaveFloor, genOpenMine, mineHit, mineState,
      pickDef, pickHitsNow, pickLv, rareForFloor,
      renderCavePanel, renderMinePanel, rollCaveEvent, steleRead,
      upgradePick,
    };
  };
})(typeof window !== 'undefined' ? window : global);

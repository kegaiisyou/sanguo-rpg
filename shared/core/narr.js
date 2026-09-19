// 叙事/日志子系统（从 engine.js 拆分）
// 横切层：打字机、串行日志队列、动作锁、耗时动作进度条、长文案分句、面板反馈浮条。
// 内部状态（logQueue/logBusy/narrOngoing/narrToken/busyRunning/busyTimer/lockObserver/activeTyper）全部收敛于此模块；
// 与对话/战斗/巡逻相关的引擎状态（askPending/combatMode/curfewWant）通过 getter 注入，不在此模块持有。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createNarr = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getSettings = ctx.getSettings;
    var getAskPending = ctx.getAskPending;
    var getCombatMode = ctx.getCombatMode;
    var getCurfewWant = ctx.getCurfewWant;
    var setCurfewWant = ctx.setCurfewWant;
    var getDlgSettle = ctx.getDlgSettle;
    var getEscapeHtml = ctx.getEscapeHtml;
    var getRecHist = ctx.getRecHist;
    var getCurfewPatrol = ctx.getCurfewPatrol;
    // 叙事所需的稳定 DOM 句柄（与引擎一样在加载期一次性取，脚本置于 body 末尾 DOM 已就绪）
    var $narr = document.getElementById('narr');
    var busyEl = document.getElementById('busy');
    var $modal = document.getElementById('modal');
    var $card = document.getElementById('modal-card');
  // ===== 文字叙事窗 =====
  // 轻触快进：仅立即显示「当前正在打字」的那一段；两次快进至少间隔 300ms，防误触连跳多段
  var activeTyper=null, lastSkipAt=0;
  function typeInto(node, text, delay, done, onstep){
    var i=0, finished=false, timer=null;
    function finish(){
      if(finished) return; finished=true;
      if(timer){ clearTimeout(timer); timer=null; }
      node.textContent=text;
      if(onstep) onstep();
      if(activeTyper && activeTyper.fn===finish) activeTyper=null;
      if(done) done();
    }
    activeTyper={ fn: finish };
    (function step(){
      if(finished) return;
      node.textContent=text.slice(0,i);
      if(onstep) onstep();
      if(i<text.length){ i++; timer=setTimeout(step, delay); }
      else finish();
    })();
  }
  function skipTypewriter(){
    if(!activeTyper) return;
    var now=Date.now();
    if(now-lastSkipAt<300) return;   // 防误触：两次快进至少间隔 300ms
    lastSkipAt=now;
    var fn=activeTyper.fn; activeTyper=null; fn();
  }
  // 快进：仅点击「叙事区文字」才生效；点中任何按钮/控件（移动罗盘、对话选项、行动区、NPC 列表）一律不触发，避免误触跳过剧情
  (function(){ var _sc=document.getElementById('scene'); if(_sc) _sc.addEventListener('click', function(e){
    if(e.target && e.target.closest) { var hit=e.target.closest('button, a, .onb-choices, .mv-exit, .mv-bar, .dock, .npc-list'); if(hit) return; }
    skipTypewriter();
  }); })();
  // 串行输出队列：所有叙事段落入队，一次只打字一段；前段完成(或快进)后才出下一段，
  // 从根本上杜绝「好几行一起刷出」让玩家措手不及
  var logQueue=[], logBusy=false;
  var narrOngoing=false; // 是否正处于「连续叙事」中（保证逐行间隙按钮仍锁定）
  var narrToken=0;      // 场景叙事令牌：新场景使旧序列失效，杜绝旧文字混入新场景
  var lockObserver=null;
  // 对话/抉择悬挂态（v20260911i）：tutAsk 弹出而玩家尚未选择时置真。
  //   此前只锁「叙事中」，对话选项面板一挂起（narrOngoing 已成假）玩家就能点罗盘走人——
  //   甚至趁牢头念「三鞭」时拔腿溜走躲掉鞭刑，剧本状态与场景随之错位。
  // 耗时动作进行中（v20260914a）：见下方 busyAct —— 采集/伐木/劳作/营造这类动作的进度条期间为真。
  var busyRunning=false;
  var busyTimer=null;    // 进行中进度条的 setInterval 句柄（离局时须掐掉，见 busyCancel）
  // 是否正处于「文字输出中」（打字 / 排队 / 连续叙事）
  function narrActive(){ return logBusy || (logQueue && logQueue.length>0) || narrOngoing; }
  // 交互闸门（v20260911i）：叙事中 / 对话抉择悬挂中 / 耗时动作进行中，一律不许走动、不许另开岔路
  function interactBusy(){ return narrActive() || getAskPending() || busyRunning; }
  // 文字输出中：锁定交互按钮（变灰不可点），输出完成或快进到底后自动解锁
  // 注：战斗中（getCombatMode() 为真）不锁 #actions —— 战斗指令菜单由战斗逻辑自行管理，不应被叙事锁挡住
  // 注：.onb-choices（对话选项）刻意不在锁范围内 —— 它是悬挂态下玩家唯一的出路，锁住即死局。
  // ⚠️ v20260911k 修一处「静默失效的选择器」：旧版写的是 `#npc button` 与 `.obj-panel button`，
  //   而实际 DOM 是 <aside id="npc-list"> 里的 <button class="nl-item">、浮动菜单 <div class="obj-menu"> 里的
  //   <button class="op-btn"> —— 两个选择器都匹配不到任何元素，等于「NPC 列表从未上过锁」。
  //   后果：对话悬挂（getAskPending()）时点另一个 NPC，仍能展开菜单、再开一段对话；tutAsk 会顶掉旧面板，
  //   旧剧本的 next() 从此无人回调 —— 剧情链与锁状态双双悬挂（表现为选项消失、所有按钮点不动，
  //   即玩家反馈的「强制对话时点他们跳开对话，引发死循环」）。
  function syncActionLock(){
    var active=interactBusy();
    var sel='#move-bar button, #npc-list button, .obj-menu button, #dock button, #move-tabs .mv-tab';
    if(!getCombatMode()) sel+=', #actions button:not(.cb-menu)';
    var nodes=document.querySelectorAll(sel);
    for(var i=0;i<nodes.length;i++){ if(active) nodes[i].classList.add('locked'); else nodes[i].classList.remove('locked'); }
    var narr=document.getElementById('narr');
    if(narr) narr.classList.toggle('typing', active);
    // 巡夜续评（v20260911i）：getCurfewPatrol() 常在「劳作/进格」动作里被叫起，而此时动作自身的
    //   文案正在打字（interactBusy 为真），只延后一帧根本轮不到它 —— 于是它挂起「待评」，
    //   等这轮叙事彻底收尾（active 转假）时再评一次。见 getCurfewPatrol() 内的 getCurfewWant()。
    if(!active && getCurfewWant()){ setCurfewWant(false); setTimeout(function(){ try{ getCurfewPatrol()(); }catch(e){} }, 0); }
    // 对话窗收尾（v20260912g）：话说完、也没有挂起的问题了 → 稍候收窗，把底部位置让回给罗盘/功能栏
    if(!active && !getCombatMode()) getDlgSettle()();
  }
  // ===== 耗时动作的「在做」呈现（v20260914a）=====
  // 采集 / 伐木 / 采石 / 烧砖 / 制作 / 担石劳作 / 操练 / 城内营造……此前点一下就「已经做完了」，
  //   只留一行结果，玩家没有「花了半个时辰」的分量感 —— 而这条链正是前期循环里最高频的动作。
  // 这里给一个统一的短进度：亮出「在做什么」、条子走满、再落结果；期间锁住其它按钮
  //   （busyRunning → interactBusy，与「文字输出中」共用同一把锁）。
  // 与「文字演出」设置同调：设成「瞬（无动画）」时不做动画，直接执行原逻辑（尊重 getSettings().textSpeed）。
  // 用法：把原函数体整段搬进 done 回调；守卫/校验（不足则 toast 返回）仍留在回调【之外】，
  //   这样返回值语义、错误提示时序都不变，只有「生效」这一步被推迟到动画之后。
  function busyAct(label, ms, done){
    var d=done||function(){};
    if(!busyEl || !(getSettings() && getSettings().textSpeed>0)){ d(); return; }
    var dur=Math.max(300, ms||1000), t0=Date.now();
    busyEl.innerHTML='<span class="bs-nm">'+getEscapeHtml()(label||'忙碌中')+'…</span>'+
      '<span class="bs-track"><i class="bs-bar"></i></span>';
    busyEl.classList.remove('hidden');
    busyEl.setAttribute('aria-hidden','false');
    busyRunning=true; syncActionLock();
    var bar=busyEl.querySelector('.bs-bar');
    busyTimer=setInterval(function(){
      var k=Math.min(1,(Date.now()-t0)/dur);
      if(bar) bar.style.width=(k*100).toFixed(0)+'%';
      if(k>=1){ busyStopTimer(); busyHide(); d(); }
    }, 40);
  }
  function busyHide(){
    if(busyEl){ busyEl.classList.add('hidden'); busyEl.setAttribute('aria-hidden','true'); busyEl.innerHTML=''; }
    if(busyRunning){ busyRunning=false; syncActionLock(); }
  }
  // 掐掉进行中的进度计时器（v20260914b）
  //   为什么单有 busyHide 不够：它只收 UI 与那把锁，setInterval 仍在跑；计时走满照样回调 done()。
  //   而「离局」那一刻 S() 已被 showTitle 清空，done() 里的 advanceTime → clockFlowing → onbF()
  //   要读 S().flags —— 于是定时器里抛一个没人接的 TypeError: Cannot read properties of null
  //   （reading 'flags'）：轻则控制台炸、重则半路动作在死后/换局后落到别人头上。
  //   故离局（showTitle）与殒落（die）一律用 busyCancel 把计时器一并掐掉，当次动作不再落地。
  function busyStopTimer(){ if(busyTimer){ clearInterval(busyTimer); busyTimer=null; } }
  function busyCancel(){ busyStopTimer(); busyHide(); }
  // 新场景/战斗开始时，丢弃旧场景残留的排队文字与打字定时器，避免文案串场
  function flushNarr(){
    // 进度条只属于「当下这一格」：房间被换掉（读档/剧本强制移动/战斗开场）时一并收掉，
    //   否则 busyRunning 这把锁会永远留在身上，全屏按钮再也点不动（v20260914a）
    if(busyRunning) busyHide();
    narrToken++;                 // 使任何进行中的旧 logScene 序列失效
    logQueue.length=0;
    if(activeTyper && activeTyper.timer){ try{ clearTimeout(activeTyper.timer); }catch(e){} }
    activeTyper=null;
    logBusy=false;
    narrOngoing=false;
    syncActionLock();
  }
  function initLockObserver(){
    if(lockObserver) return;
    lockObserver=new MutationObserver(function(muts){
      if(!narrActive()) return;
      if(getCombatMode()) return;   // 战斗中由 DQ 逻辑自行管理 #actions，不在此处上锁（syncActionLock 也不再解锁，需保持一致）
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType!==1) return;
          var bs=(n.matches && n.matches('button:not(.cb-menu)')) ? [n] : (n.querySelectorAll?n.querySelectorAll('button:not(.cb-menu)'):[]);
          for(var i=0;i<bs.length;i++) bs[i].classList.add('locked');
        });
      });
    });
    // v20260911k：容器 id 是 npc-list（旧版写 'npc' 不存在），NPC 列表按钮此前根本不在观察范围内
    ['actions','move-bar','npc-list'].forEach(function(id){ var el=document.getElementById(id); if(el) lockObserver.observe(el,{childList:true,subtree:true}); });
  }
  initLockObserver();
  // ═══ 长文案分句（v20260911k 引入；v20260912g 改「按句」而非「按字数」）═══
  // v20260911k 是按字数硬切（42 字一刀、切不动再退逗号），本意是「别一口气讲一大段」，
  //   可玩家读到的是：一句话被拦腰截断、从半句起蹦出下一句 —— 像机器人在念稿，不像人说话。
  // 现改为**只在「一句说完」处断行**：句号/问号/叹号/分号/省略号 才算收尾，逗号永不断句；
  //   引号、括号内的标点（「……。」）也不算收尾，整句一口气落完。于是每行都是一个完整的句子，
  //   人怎么说、字就怎么落。只有遇上长得离谱的单句（> SPEECH_HARD 字，多是无标点的环境描写）
  //   才退一步按软标点断一次，免得一行糊满整屏。
  var SPEECH_HARD=80;   // 单句超长兜底阈值（字）：仅防「一行占满全屏」，正常句子不受影响
  // deep=true（v20260912l 对话帘用）：连引号里的句子也断 —— 他一句一句讲，而不是把
  //   一整段引语塞成一行。default=false 保持原样（叙事区打字机要整句引语一起走）。
  function splitSpeech(text, deep){
    var s=String(text==null?'':text).trim();
    if(!s) return [];
    var SENT='。！？；…', OPEN='「『（【〔', TAIL='」』）】〕', SOFT='，、,.：:';
    var out=[], buf='', dep=0;
    for(var i=0;i<s.length;i++){
      var ch=s.charAt(i);
      if(OPEN.indexOf(ch)>=0){ dep++; buf+=ch; continue; }
      if(TAIL.indexOf(ch)>=0){
        dep = dep>0 ? dep-1 : 0;
        buf+=ch;
        // 收尾括号恰好收在一句的末标点之后（「……。」）→ 这一句到此为止
        if(dep===0 && buf.length>=2 && SENT.indexOf(buf.charAt(buf.length-2))>=0){ out.push(buf); buf=''; }
        continue;
      }
      buf+=ch;
      if((deep || dep===0) && SENT.indexOf(ch)>=0){ out.push(buf); buf=''; }   // 括号/引号内部不算句末（deep 时算）
    }
    if(buf) out.push(buf);
    if(deep) out=balanceSpeech(out, OPEN, TAIL);
    // 超长单句兜底：只在「这一行会糊满整屏」时才按软标点断一次
    var fin=[];
    out.forEach(function(seg){
      if(seg.replace(/\s/g,'').length<=SPEECH_HARD){ fin.push(seg); return; }
      var cut=-1;
      for(var j=0;j<seg.length;j++){
        if(SOFT.indexOf(seg.charAt(j))<0) continue;
        if(seg.slice(0,j+1).replace(/\s/g,'').length>=SPEECH_HARD*0.6){ cut=j+1; break; }
      }
      if(cut<=0 || cut>=seg.length){ fin.push(seg); return; }
      fin.push(seg.slice(0,cut)); fin.push(seg.slice(cut));
    });
    return fin.filter(function(x){ return String(x).replace(/\s/g,'').length>0; });
  }
  // 引号里断句的善后（v20260912l）：断在引号里，那一行就会「开着引号断掉」、闭引号孤零零落到末行。
  // 这里给断在引号里的那句补上收尾符（让它自成一段），后头多出来的收尾符就地丢掉：
  //   「甲。／乙」 → 「甲。」／乙      （而不是  「甲。／「乙」／」）
  function balanceSpeech(list, OPEN, TAIL){
    var out=[], owe=[];
    for(var i=0;i<list.length;i++){
      var seg=list[i], buf='';
      for(var j=0;j<seg.length;j++){
        var ch=seg.charAt(j);
        if(OPEN.indexOf(ch)>=0){ owe.push(ch); buf+=ch; continue; }
        if(TAIL.indexOf(ch)>=0){ if(owe.length){ owe.pop(); buf+=ch; } continue; }   // 没得配的就是前面补过的余数，丢掉
        buf+=ch;
      }
      while(owe.length){ buf+=TAIL.charAt(OPEN.indexOf(owe.pop())); }   // 补上收尾符
      if(buf) out.push(buf);
    }
    return out;
  }
  // 面板反馈浮条（v20260915j→v20260916d）：弹窗开着时，操作日志若只落在叙事区会被面板挡住，
  //   玩家点「凿矿/存取/买卖」看不到结果。这里把每条 log 同时浮显到当前弹窗顶部，
  //   统一解决采矿、仓库、货郎、锻造等一切面板的反馈遮挡问题。
  //   v20260916d 增强：
  //     ① 对话文本（cls='npc'）不再镜像——聊天窗口内已显示原话，长文本镜像只添乱；
  //     ② 多行显示（pre-wrap），不再单行截断成「只看到开头」；
  //     ③ 时长按文本长度自适应（短反馈 2.6s，长反馈最长 6s）；
  //     ④ 密集反馈（上一条还很短）拼接显示，避免连续操作只看得见最后一条。
  function fbShow(txt, cls){
    if(!$modal || $modal.classList.contains('hidden')) return;
    if(cls==='npc' || cls==='talk') return;
    if(!$card) return;
    var fb=document.getElementById('modal-fb');
    if(!fb){ injectModalFb(); fb=document.getElementById('modal-fb'); }
    if(!fb) return;
    var s=String(txt==null?'':txt);
    var prev=fb.textContent||'';
    if(window.__fbTimer && prev && prev!==s && prev.length<40 && s.length<56){
      s=prev+'　'+s;   // 上一条还在展示且很短 → 拼接，连点几下也能看到前因后果
    }
    fb.textContent=s;
    fb.classList.add('show');
    if(window.__fbTimer) clearTimeout(window.__fbTimer);
    window.__fbTimer=setTimeout(function(){ fb.classList.remove('show'); window.__fbTimer=null; },
      Math.min(6000, Math.max(2600, 1400+String(s).length*70)));
  }
  function injectModalFb(){
    var holder=$card ? ($card.parentNode || $card) : null;
    if(!holder) return;
    if(holder.querySelector('#modal-fb')) return;
    var fb=document.createElement('div'); fb.id='modal-fb'; fb.className='modal-fb';
    holder.insertBefore(fb, $card);
  }
  function log(text, cls, name, done){
    if(!$narr){ return; }
    fbShow(text, cls);
    var parts=splitSpeech(text);
    if(parts.length>1){
      for(var i=0;i<parts.length-1;i++) logRaw(parts[i], cls, name, null);
      logRaw(parts[parts.length-1], cls, name, done);
      return;
    }
    logRaw(parts.length?parts[0]:text, cls, name, done);
  }
  function logRaw(text, cls, name, done){
    logQueue.push({text:String(text==null?'':text), cls:cls, name:name, done:done});
    syncActionLock();           // 开始输出即锁定按钮（防「文案未完就点下一处」）
    if(!logBusy) pumpLog();
  }
  function pumpLog(){
    if(logBusy) return;
    var item=logQueue.shift();
    if(!item){ return; }
    logBusy=true;
    logNow(item.text, item.cls, item.name, function(){ logBusy=false; if(item.done) item.done(); syncActionLock(); pumpLog(); });
  }
  // 真正执行单段打字（由 log 队列驱动）
  function logNow(text, cls, name, done){
    cls=cls||'env';
    getRecHist()(text, cls, name);   // 回顾：记「真正上屏的这句」（v20260914a）
    var p=document.createElement('p');
    p.className='narr '+cls;
    var sc=document.getElementById('scene');
    function scroll(){ if(sc) sc.scrollTop=sc.scrollHeight; }
    function finish(){ if(done) done(); }
    var delay = getSettings().textSpeed>0 ? getSettings().textSpeed : 0;
    if(cls==='npc' && name){
      var s=document.createElement('span'); s.className='nm'; s.textContent=name+'：'; p.appendChild(s);
      var tn=document.createTextNode(''); p.appendChild(tn); $narr.appendChild(p);
      if(delay<=0){ tn.textContent=text; scroll(); finish(); }
      else { p.classList.add('typing'); typeInto(tn, text, delay, function(){ p.classList.remove('typing'); scroll(); finish(); }, scroll); }
    } else {
      var tn2=document.createTextNode(''); p.appendChild(tn2); $narr.appendChild(p);
      if(delay<=0){ tn2.textContent=text; scroll(); finish(); }
      else { p.classList.add('typing'); typeInto(tn2, text, delay, function(){ p.classList.remove('typing'); scroll(); finish(); }, scroll); }
    }
  }
  // 串行叙事：逐行依次输出，前一行打字完成后隔 gap 再播下一行，避免多行同时刷出眼花
  // v20260911e：末行后【同步】收尾（onDone），不再挂尾随 setTimeout——该定时器在部分环境
  //   会被节流/丢弃，导致 onDone（进而 onbRoomEnter / narrate 后续步骤）永不触发（表现为
  //   序章不播、走廊点卯对话不出）。行间间隔仍用 gap。
  function logScene(lines, gap, onDone){
    gap = gap==null ? 150 : gap;
    var myToken = ++narrToken;          // 本段叙事获得令牌
    narrOngoing=true; syncActionLock(); // 连续叙事期间保持按钮锁定
    (function play(i){
      if(myToken!==narrToken){ if(narrOngoing){ narrOngoing=false; syncActionLock(); } return; } // 已被新场景取代，放弃旧叙事
      if(i>=lines.length){ narrOngoing=false; if(onDone) onDone(); syncActionLock(); return; }
      var l=lines[i];
      log(l.t, l.c, l.n, function(){
        var ni=i+1;
        if(ni>=lines.length){ play(ni); }                       // 末行：立即收尾
        else { setTimeout(function(){ play(ni); }, gap); }      // 行间：间隔 gap
      });
    })(0);
  }
  // 场景失效：新场景（换房）使任何进行中的旧叙事序列作废（原 engine.js 内联的 narrToken++ 拆出）
  function invalidateScene(){ narrToken++; }
    return {
      typeInto, skipTypewriter, narrActive, interactBusy, syncActionLock, busyAct, busyHide, busyStopTimer, busyCancel, flushNarr, initLockObserver, splitSpeech, balanceSpeech, fbShow, injectModalFb, log, logRaw, pumpLog, logNow, logScene, invalidateScene
    };
  };
})(typeof window !== 'undefined' ? window : global);

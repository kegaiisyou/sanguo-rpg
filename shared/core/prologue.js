// 模块 prologue（从 engine.js 拆分）：序章开场动画
// 全屏幕布 #prologue（DOM 见 index.html，样式见 game.css）上的一次性演出，
// 与叙事区 #narr 无关；演完调 onDone 把界面交还。仅浏览器端使用。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createPrologue = function (ctx) {
    var getSettings = ctx.getSettings, SET = getSettings;  // settings.textSpeed
    var G = ctx.G;                                         // G.DIALOGUES.prologue
    var SFX = ctx.SFX;                                     // 收尾更鼓

    // ===== 序章开场动画（P0 · v20260911g；动效重做 v20260911j；水墨长卷 v20260912i；长镜头运镜 v20260912m）=====
    // 独立于叙事区（#narr）的全屏幕布 #prologue（DOM 见 index.html，样式见 game.css）：
    //   黑幕揭开 → 行军征战图（底图长镜头运镜）→ 题头与正文如墨迹洇开逐行浮现 →
    //   柔和纸光一掠 → 淡出。
    // 演出期间界面 #app 是隐藏的，故「动画演完，角色才出现在牢里」；随后的 camp_opening 剧本接着开场。
    // 文案取自 G.DIALOGUES.prologue（第一行作金色小标题）。轻触幕布 / 点「跳过」立即收尾。
    // ★ v20260912m「长镜头运镜」：删去卷轴（pr-roll）与墨色显影（pr-wash-out/in 圆形 clip）两类
    //   「元素动效」，改为电影摄影语言——.pr-wash 仅作开场黑幕（opacity 整体淡出揭开，非圆形）；
    //   .pr-bg 以 26s 慢速推进横移（prPan）模拟镜头在长卷上游走；文字 .pr-line 去掉 clip-path，
    //   只用 opacity+blur 墨迹洇开（模糊→清晰）；云雾/墨尘/光斑/暗角呼吸继续营造氛围。
    // 文字层始终「静字」：只用 opacity + blur 浮现，绝不 translate/rotate 位移。
    // settings.textSpeed<=0（文字演出设为「瞬（无动画）」）时整段跳过，直接进牢房。
    function playPrologue(onDone){
      var box=document.getElementById('prologue');
      var lines=((G && G.DIALOGUES && G.DIALOGUES.prologue) || []).slice();
      var speed=(SET() && SET().textSpeed!=null) ? SET().textSpeed : 55;
      if(!box || !lines.length || speed<=0){ if(onDone) onDone(); return; }
      var wrap=document.getElementById('pr-lines');
      var flash=document.getElementById('pr-flash');
      // v20260912n：序章底图从 AI 同风格候选图中随机取一张（每次开局不同）
      var bgEl=box.querySelector('.pr-bg');
      if(bgEl){
        var bgs=['assets/title_bg_alt1.jpg','assets/title_bg_alt2.jpg','assets/title_bg_alt3.jpg','assets/title_bg_alt4.jpg','assets/title_bg_alt5.jpg','assets/title_bg_alt6.jpg'];
        bgEl.style.backgroundImage='url("'+bgs[Math.floor(Math.random()*bgs.length)]+'")';
      }
      var timers=[], done=false;
      function T(fn, ms){ timers.push(setTimeout(fn, ms)); }
      function clearAll(){ for(var i=0;i<timers.length;i++){ clearTimeout(timers[i]); } timers=[]; }
      function finish(){
        if(done) return; done=true; clearAll();
        box.removeEventListener('click', finish);
        box.classList.add('pr-out');            // 淡出（.9s），随后彻底隐藏并把界面交还 #app
        timers.push(setTimeout(function(){
          box.classList.add('hidden');
          if(wrap) wrap.innerHTML='';
          if(onDone) onDone();
        }, 900));
      }
      // 复位（同一会话内读档可能重播）
      box.classList.remove('hidden','pr-out','pr-wash-out');
      if(flash) flash.classList.remove('on');
      if(wrap){
        wrap.innerHTML='';
        lines.forEach(function(t, i){
          var p=document.createElement('p');
          p.className='pr-line '+(i===0?'pr-kicker':'pr-body');
          p.textContent=String(t==null?'':t);
          wrap.appendChild(p);
        });
      }
      box.addEventListener('click', finish);
      // 排期：黑幕揭开（1.8s）→ 题头浮现 → 正文逐行浮现（底图全程长镜头运镜）
      var els=(wrap && wrap.childNodes) || [];
      var t0=1600;                                           // 黑幕揭开近完成，文字才登场
      T(function(){ box.classList.add('pr-wash-out'); }, 120);   // 黑幕淡出揭开，露出行军征战图
      for(var i=0;i<els.length;i++){
        (function(el, idx){
          T(function(){ el.classList.add('on'); }, t0);
          t0 += Math.max(1400, Math.min(2600, String(lines[idx]||'').length*55)) + 560;
        })(els[i], i);
      }
      T(function(){ try{ SFX.hit(); }catch(e){} }, t0+300);   // 收尾一记更鼓（声音保留；v20260912m 起去掉纸光闪动）
      T(finish, t0+800);
    }

    return {
      playPrologue
    };
  };
})(typeof window !== 'undefined' ? window : global);

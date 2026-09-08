(function (global) {
  var LF = global.LF || (global.LF = {});
  LF.createCombat = function (ctx) {
    var getState = ctx.getState, getCurrentModalKind = ctx.getCurrentModalKind,
        getCombatMode = ctx.getCombatMode, setCombatMode = ctx.setCombatMode,
        getDqCardEl = ctx.getDqCardEl, setDqCardEl = ctx.setDqCardEl,
        getPendingSiegeCid = ctx.getPendingSiegeCid, setPendingSiegeCid = ctx.setPendingSiegeCid,
        getNarr = ctx.getNarr,
        G = ctx.G, SFX = ctx.SFX, LF = ctx.LF,
        effectiveStats = ctx.effectiveStats, clampHp = ctx.clampHp, decayEquipment = ctx.decayEquipment,
        save = ctx.save, log = ctx.log, toast = ctx.toast, renderStatus = ctx.renderStatus, renderRoom = ctx.renderRoom,
        clearActions = ctx.clearActions, flushNarr = ctx.flushNarr, collapseObjPanel = ctx.collapseObjPanel,
        openModal = ctx.openModal, closeModal = ctx.closeModal,
        packAdd = ctx.packAdd, packList = ctx.packList, packMax = ctx.packMax, packResize = ctx.packResize,
        itemIconHTML = ctx.itemIconHTML, usePackItem = ctx.usePackItem, equipFromPackTo = ctx.equipFromPackTo,
        onbReveal = ctx.onbReveal, highlightOnb = ctx.highlightOnb,
        maybeStarve = ctx.maybeStarve, siegeWin = ctx.siegeWin, siegeLose = ctx.siegeLose,
        addXp = ctx.addXp, addReputation = ctx.addReputation, enemyExp = ctx.enemyExp, finishEscape = ctx.finishEscape;

    // 战斗系统（v20260908n）：战斗FX + 战斗渲染 + DQ 回合制 + 战利品结算
    // 依赖经 ctx 注入；state/combatMode/dqCardEl/pendingSiegeCid 为引擎中后赋值或随运行变化的绑定，用 getter/setter 惰性取值。

  function logHTML(html, cls){
    var p=document.createElement('p');
    p.className='narr '+(cls||'env');
    p.innerHTML=html;
    getNarr().appendChild(p);
    var sc=document.getElementById('scene'); sc.scrollTop=sc.scrollHeight;
  }

  // 纯文本 log（不包裹 narr CSS 动画，用于战斗行间动态插入）
  function logText(text, cls){
    var p=document.createElement('p');
    p.className='narr '+(cls||'sys');
    p.textContent=text;
    getNarr().appendChild(p);
    var sc=document.getElementById('scene'); sc.scrollTop=sc.scrollHeight;
    return p;
  }

  // ── 战斗动态效果辅助 ──
  // 取得受击锚点（敌人卡 / 玩家状态区）
  function combatAnchor(side, idx){
    // DQ 队伍战斗：优先按 data-i 精确定位多单位卡片（飘字/受击动画挂到正确的敌人/队友）
    if(idx!=null){
      var sideCls = side==='enemy' ? 'dq-enemy' : 'dq-ally';
      var dq = document.querySelectorAll('.dq-unit.'+sideCls);
      for(var i=0;i<dq.length;i++){ if(dq[i].getAttribute('data-i')===String(idx)) return dq[i]; }
      return dq.length ? dq[dq.length-1] : null;
    }
    var sel = side==='enemy' ? '#scene .c-enemy' : '#scene .c-player';
    var list = document.querySelectorAll(sel);
    return list.length ? list[list.length-1] : null;
  }
  // 给锚点加一次性动画 class
  function flashAnchor(side, cls, ms, idx){
    var a=combatAnchor(side, idx); if(!a) return;
    var toks=String(cls).split(/\s+/).filter(Boolean);
    toks.forEach(function(t){ a.classList.remove(t); });
    void a.offsetWidth;
    toks.forEach(function(t){ a.classList.add(t); });
    setTimeout(function(){ toks.forEach(function(t){ a.classList.remove(t); }); }, ms||500);
  }
  // 伤害飘字：挂到承受方卡上方，浮起淡出
  function floatDamage(dmg, side, crit, idx){
    var a=combatAnchor(side, idx); if(!a) return;
    var f=document.createElement('div');
    f.className='dmg-float side-'+side+(crit?' crit':'');
    f.textContent='-'+dmg;
    a.appendChild(f);
    setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 900);
  }
  // 漂浮文字标签（闪避/格挡等）
  function floatLabel(side, txt, kind, idx){
    var a=combatAnchor(side, idx); if(!a) return;
    var f=document.createElement('div');
    f.className='dmg-float label-'+kind+' side-'+side;
    f.textContent=txt;
    a.appendChild(f);
    setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 900);
  }
  // 暴击金红爆裂粒子
  function critBurst(side, idx){
    var a=combatAnchor(side, idx); if(!a) return;
    var b=document.createElement('div'); b.className='crit-burst side-'+side; a.appendChild(b);
    setTimeout(function(){ if(b.parentNode) b.parentNode.removeChild(b); }, 620);
  }
  // 受击：红闪 + 后仰
  function flashHit(side, crit, idx){ flashAnchor(side, crit?'hit hit-crit':'hit', 560, idx); }
  // 攻击武器字 / 受击印记 挂载到状态卡（随机微偏移，避免重叠）
  var ATK_GLYPH={fist:'拳',sword:'剑',blade:'刀',spear:'枪',staff:'棍',hammer:'锤',whip:'鞭',fire:'焰'};
  function combatAnchorAppend(side, html, cls, life, idx){
    var a=combatAnchor(side, idx); if(!a) return null;
    var el=document.createElement('div'); el.className=cls; el.innerHTML=html;
    var rx=(Math.random()*46-23), ry=(Math.random()*28-14);
    el.style.left='calc(50% + '+rx+'px)';
    el.style.top='calc(46% + '+ry+'px)';
    a.appendChild(el);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, life||760);
    return el;
  }
  // 攻击方"冒出武器"字（拳/剑/刀…）
  function popWeapon(side, line){ combatAnchorAppend(side, ATK_GLYPH[line]||'击', 'wpop', 640); }
  // 受击方差异化印记：拳印/剑痕/刀影…，kind 可叠加 wound(伤痕)/bandage(绷带)
  // 图像化管线：每种武学一张专属图，放到 IMPACT_IMAGES 即可生效；未配置的武器线回退 CSS 闷痕
  // fist: AI 生成的写实皮下淤青拳印（已去白底/去水印），multiply 正片叠底融入卡面
  var IMPACT_IMAGES = { fist: 'assets/impacts/fist_clean.png' };
  function floatImpact(side, line, kind, idx){
    line = line || 'fist';
    var kindCls = (kind && kind!=='hit') ? ' imp-'+kind : '';
    var life = kind==='wound' ? 1200 : (kind==='bandage' ? 1000 : 760);
    var img = IMPACT_IMAGES[line];
    if(img){
      var a=combatAnchor(side, idx); if(!a) return null;
      var el=document.createElement('img');
      el.className='impact is-img imp-'+line+kindCls; el.src=img; el.alt='';
      var rx=(Math.random()*46-23), ry=(Math.random()*28-14);
      el.style.left='calc(50% + '+rx+'px)';
      el.style.top='calc(46% + '+ry+'px)';
      a.appendChild(el);
      setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, life);
      return el;
    }
    combatAnchorAppend(side, '', 'impact noimg imp-'+line+kindCls, life, idx);
  }
  // 格挡：蓝盾光
  function flashBlock(side, idx){ flashAnchor(side, 'block', 620, idx); }
  // 闪避：灰字"闪" + 抖动
  function showDodge(side, idx){
    floatLabel(side, '闪', 'dodge', idx);
    flashAnchor(side, 'dodge', 420, idx);
  }
  // 受击/暴击震屏
  function shakeScene(){
    var sc=document.getElementById('scene'); if(!sc) return;
    sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake');
    setTimeout(function(){ sc.classList.remove('shake'); }, 340);
  }
  // 战斗日志：分类样式 + 类型图标 + 暴击/受击/格挡/闪避差异化特写
  var COMBAT_ICON={
    player_atk:'⚔', enemy_atk:'🗡', buff:'⬆', debuff:'☣',
    dot:'☠', counter:'⚡', heal:'✚', system:'·'
  };
  // 敌人立绘（emoji 大图标，按 id 映射；缺省回退 👤）
  var ENEMY_PORTRAIT={
    bandit:'🥷', bandit_chief:'👹', yellow_turban:'🛡️', hua_xiong:'⚔️',
    dummy:'🪵', heishan_zei:'🔥', heishan_zhu:'👺',
    hungry_refugee:'🥺', stray_dog:'🐕', deserter:'💂'
  };
  var PLAYER_PORTRAIT='🧍';

  // ── 立绘：分层 SVG 武将（替代 emoji 小图标）──
  // 每个敌人按配色/武器区分；玩家为主角携长枪。facing 控制对峙朝向。
  var PORTRAIT_CFG={
    bandit:{body:'#4a5568',trim:'#2d3748',cape:'#2b6cb0',weapon:'sword'},
    bandit_chief:{body:'#553c2b',trim:'#3b2a1d',cape:'#9b2c2c',weapon:'axe'},
    yellow_turban:{body:'#6b6b3a',trim:'#4a4a26',cape:'#b7791f',weapon:'shield'},
    hua_xiong:{body:'#742a2a',trim:'#4a1a1a',cape:'#c53030',weapon:'blade'},
    dummy:{body:'#8a6d3b',trim:'#5c4a26',cape:'#6b4f2a',weapon:'none'},
    heishan_zei:{body:'#3a2e2e',trim:'#241c1c',cape:'#dd6b20',weapon:'axe'},
    heishan_zhu:{body:'#2d1b1b',trim:'#1a0f0f',cape:'#9b2c2c',weapon:'blade'},
    hungry_refugee:{body:'#718096',trim:'#4a5568',cape:'#a0aec0',weapon:'none'},
    stray_dog:{body:'#8b5a2b',trim:'#5c3a1c',cape:'#744210',weapon:'none',small:true},
    deserter:{body:'#4a5568',trim:'#2d3748',cape:'#3182ce',weapon:'spear'},
    _player:{body:'#1a365d',trim:'#0bc5ea',cape:'#ecc94b',weapon:'spear'}
  };
  function weaponSvg(type, color){
    switch(type){
      case 'sword': return '<path class="p-weapon" d="M70 62 L106 30" stroke="'+color+'" stroke-width="5" stroke-linecap="round"/>';
      case 'spear': return '<line class="p-weapon" x1="72" y1="64" x2="114" y2="40" stroke="'+color+'" stroke-width="5" stroke-linecap="round"/><path d="M114 40 l9 -5 -6 10 z" fill="'+color+'"/>';
      case 'axe': return '<line class="p-weapon" x1="72" y1="64" x2="110" y2="42" stroke="'+color+'" stroke-width="5"/><path d="M110 42 q16 -3 13 13 q-13 3 -13 -13z" fill="'+color+'"/>';
      case 'blade': return '<path class="p-weapon" d="M70 60 Q102 42 112 24 Q104 46 70 66 Z" fill="'+color+'"/>';
      case 'shield': return '<path class="p-weapon" d="M72 56 q17 0 17 19 q0 17 -17 23 q-17 -6 -17 -23 q0 -19 17 -19z" fill="'+color+'"/>';
      default: return '';
    }
  }
  function buildPortrait(side, id){
    var cfg=(side==='player')?PORTRAIT_CFG._player:(PORTRAIT_CFG[id]||PORTRAIT_CFG.bandit);
    var facing=(side==='player')?1:-1;
    var w=weaponSvg(cfg.weapon, cfg.trim);
    var s=cfg.small?0.8:1;
    return '<svg class="pt-svg" viewBox="0 0 120 160">'
      +'<g transform="translate(60 0) scale('+(facing*s)+' 1) translate(-60 0)">'
      +'<ellipse class="p-shadow" cx="60" cy="153" rx="32" ry="6" fill="rgba(0,0,0,.18)"/>'
      +'<g class="p-body">'
      +'<path class="p-leg" d="M50 96 L46 150 L56 150 L60 104 Z" fill="'+cfg.trim+'"/>'
      +'<path class="p-leg" d="M70 96 L74 150 L64 150 L60 104 Z" fill="'+cfg.trim+'"/>'
      +'<path class="p-cape" d="M44 62 L28 126 Q44 132 52 112 Z" fill="'+cfg.cape+'" opacity=".92"/>'
      +'<path class="p-torso" d="M42 58 Q60 50 78 58 L74 102 Q60 110 46 102 Z" fill="'+cfg.body+'"/>'
      +'<circle class="p-head" cx="60" cy="40" r="16" fill="#f1d3a8"/>'
      +'<path class="p-helm" d="M44 41 Q60 15 76 41 L72 37 Q60 25 48 37 Z" fill="'+cfg.trim+'"/>'
      +'<path class="p-helm" d="M60 22 L60 15" stroke="'+cfg.cape+'" stroke-width="3" stroke-linecap="round"/>'
      +w
      +'</g></g></svg>';
  }
  // 出招前摇：攻击方身体前倾（一次性动画）
  function markAttack(side){
    var a=combatAnchor(side); if(!a) return;
    a.classList.remove('attacking'); void a.offsetWidth; a.classList.add('attacking');
    setTimeout(function(){ a.classList.remove('attacking'); }, 520);
  }
  // 暴击特写：场景暗角 + 轻微推近（一次性）
  function markSceneCrit(){
    var sc=document.getElementById('scene'); if(!sc) return;
    sc.classList.remove('crit-moment'); void sc.offsetWidth; sc.classList.add('crit-moment');
    setTimeout(function(){ sc.classList.remove('crit-moment'); }, 560);
  }
  // 武侠「斬」印章：暴击 / 斩将时盖下
  function flashSeal(ch){
    var s=document.createElement('div'); s.className='combat-seal'; s.textContent=ch||'斬';
    document.body.appendChild(s); setTimeout(function(){ if(s.parentNode) s.parentNode.removeChild(s); }, 900);
  }

  // ── V5：轻量音效（Web Audio 合成，零外部资源）──
  // SFX 音效系统已移至 shared/core/audio.js（v20260909a），含 UI音效+战斗音效+古风BGM+音量控制

  function logCombat(entry){
    var text=entry.text||''; var cls=entry.type||'sys';
    var crit=/暴击/.test(text);
    if(crit) cls+=' crit';
    if(entry.type==='player_atk'){ markAttack('player'); }
    else if(entry.type==='enemy_atk'){ markAttack('enemy'); }
    var el=logText(text, cls);
    var ico=COMBAT_ICON[entry.type];
    if(ico && !crit){ el.classList.add('ico'); el.setAttribute('data-ico', ico); }

    // 目标侧（承受方）：谁在挨这一下
    var side=null;
    if(entry.type==='player_atk') side='enemy';
    else if(entry.type==='enemy_atk') side='player';
    else if(entry.type==='counter') side='enemy';
    else if(entry.type==='dot') side=(entry.side==='enemy'?'enemy':'player');

    if(/闪过|未命中/.test(text) && side){
      showDodge(side);                              // 闪避：灰字 + 抖动
    } else if(/格挡/.test(text)){
      var bs = /^你/.test(text) ? 'player' : 'enemy'; // 谁在格挡
      flashBlock(bs); floatLabel(bs,'格挡','block');  // 格挡：蓝盾光
    } else if(entry.dmg && entry.dmg>0 && side){
      floatDamage(entry.dmg, side, crit);           // 伤害飘字
      flashHit(side, crit);                          // 受击红闪/后仰
      floatImpact(side, entry.atkLine, 'hit');       // 受击差异化印记（拳印/剑痕/刀影…）
      // 重伤：高频受击叠加"伤痕"裂迹
      if(crit || entry.dmg>=20) floatImpact(side, entry.atkLine, 'wound');
      // 濒危：低血时随机缠上"绷带"
      var maxHp = side==='enemy' ? ((G.CombatEngine.state.enemies[0]||{}).maxHp||0) : effectiveStats().maxHp;
      var curHp = side==='enemy' ? entry.eHp : entry.pHp;
      if(maxHp && curHp!=null && curHp/maxHp < 0.3 && Math.random()<0.45) floatImpact(side, entry.atkLine, 'bandage');
      if(crit){ critBurst(side); markSceneCrit(); flashSeal('斬'); }   // 暴击金红爆裂粒子 + 场景特写 + 武侠斩印
    }
    if(crit || (entry.dmg && entry.dmg>=25)) shakeScene();
    // V5：音效
    if(entry.type==='player_atk' || entry.type==='enemy_atk'){
      if(crit) SFX.crit();
      else { SFX.swing(); setTimeout(function(){ SFX.hit(); }, 110); }
    } else if((entry.type==='counter' || entry.type==='dot') && entry.dmg){
      SFX.hit();
    }
  }
  /** 开始战斗 */
  function startCombat(enemyId, opt){
    opt=opt||{};
    // 校验敌人 id：无效则给出提示并中止，避免进入战斗后在 init 中崩溃
    if(typeof enemyId==='string') enemyId=[enemyId];
    var valid=(enemyId||[]).filter(function(id){ return G.ENEMIES && !!G.ENEMIES[id]; });
    if(!valid.length){ log('〔系统〕此处并无可战之敌，刀兵无从施展。','sys'); return; }
    var themeId = valid[0];
    enemyId = valid;
    // 注意：引导/教学状态统一存于 getState().flags.onb（历史代码曾误用未定义的 getState().onb，已统一修正）
    if(opt.tutorial && getState().flags.onb && !getState().flags.onb.tcDone){
      getState().flags.onb.tcTutorial=true; getState().flags.onb.tcDone=false; getState().flags.onb.packGiven=false;
      getState().flags.onb.tcTried={atk:false,def:false};
      getState().flags.onb.tcMsgs={attack:false,defend:false,pack:false,use:false,finish:false};
    }
    var appEl=document.getElementById('app'); if(appEl) appEl.classList.add('in-combat');
    document.body.classList.add('in-combat');   // 用于盖过 body.onb.reveal-* 的显示规则，战斗时隐藏 NPC/移动区
    collapseObjPanel();           // 关闭可能开着的 NPC/对象面板，避免压在战场上
    if(opt.tutorial && getState().flags.onb && !getState().flags.onb.tcDone) document.body.classList.add('tut-combat');
    var es=effectiveStats();
    var pstate=Object.assign({}, getState(), {
      atk:es.atk, def:es.def, maxHp:es.maxHp, maxMp:es.maxMp, spd:es.spd,
      hitRate:es.hitRate, critRate:es.critRate
    });
    // 组队作战：主角 + 同伴（getState().party）。每场战斗同伴满血入场
    var party=[pstate];
    (getState().party||[]).forEach(function(c){ if(c) party.push(Object.assign({}, c, { hp:c.maxHp })); });
    var r=G.CombatEngine.init(party, enemyId);
    if(r.error){ log(r.error,'sys'); return; }
    // 战力缩放（v20260905d：改为作用于「本场战斗单位」，不再污染全局 ENEMIES 数据——
    // 旧实现直接改 getEnemy() 返回的共享敌人定义，城门焚毁会把 city_guard 永久削弱且多次叠加）：
    //   guardMul  → 城门被焚（不免疫火烧）守军战力下降
    //   fieldLvl  → 郊野凶兽按等阶强化（1~3 阶：每级气血/攻/防约 +25%、速度约 +12%）
    var _mulF = (opt.guardMul && opt.guardMul<1) ? opt.guardMul : ((opt.fieldLvl&&opt.fieldLvl>1) ? (1+0.25*(opt.fieldLvl-1)) : null);
    if(_mulF){
      var _mulS = (opt.fieldLvl&&opt.fieldLvl>1) ? (1+0.12*(opt.fieldLvl-1)) : null;
      var _es=(G.CombatEngine.state && G.CombatEngine.state.enemies)||[];
      _es.forEach(function(_e){
        _e.hp=_e.maxHp=Math.max(1,Math.round((_e.maxHp||1)*_mulF));
        _e.atk=Math.max(1,Math.round((_e.atk||0)*_mulF));
        _e.def=Math.max(1,Math.round((_e.def||0)*_mulF));
        if(_mulS) _e.spd=Math.max(1,Math.round((_e.spd||10)*_mulS));
      });
    }
    // V3：战场氛围（按敌人定主题背景）
    var SCENE_THEME={ bandit:'camp', bandit_chief:'camp', heishan_zei:'camp', heishan_zhu:'fort',
      yellow_turban:'altar', hua_xiong:'snow', stray_dog:'wild', hungry_refugee:'wild',
      deserter:'wild', wuhuan_scout:'wild', city_guard:'fort', dummy:'train' };
    var sceneEl=document.getElementById('scene');
    if(sceneEl){ sceneEl.dataset.bg = SCENE_THEME[themeId] || 'plain'; sceneEl.classList.remove('bg-danger'); }
    getState().energy=Math.max(0,getState().energy-5);   // 应战耗精力
    getNarr().innerHTML='';
    flushNarr();                 // 丢弃旧场景残留文字，避免串场
    var enemy=G.CombatEngine.getEnemy();
    log('──── 狭路相逢 ────','combat');
    log((enemy.title?('「'+enemy.title+'」'):'')+enemy.name+' 拦住去路！','title');
    // 卡牌战斗系统已移除，统一走 DQ 风格队伍回合制（常规战斗 / 教学战均走此路）
    setCombatMode('manual');
    dqInitCombat();   // DQ 风格：列阵 + 逐人下令 + 攻击选目标 + 敌群齐出
  }

  /** 开场教学战斗是否激活 */
  function tutCombatActive(){ return !!(getState().flags.onb && getState().flags.onb.tcTutorial && !getState().flags.onb.tcDone); }
  /** 老乞丐扔来行囊：给金疮药 + 点亮行囊 + 解锁道具按钮 */
  function tutThrowPack(){
    if(!getState().flags.onb) return;
    if(getState().flags.onb.packGiven) return;   // 防重复发放
    getState().flags.onb.packGiven=true;
    packAdd('jinchuang',1);   // 老乞丐赠金疮药（已堆叠则 +1）
    onbReveal('dock'); highlightOnb('dock'); save(getState()); renderStatus();
    log('老乞丐：「接住！」抛来一只行囊——里头有瓶金疮药，以备疗伤（下头「道具」已点亮）。','env');
    save(getState());
  }

  /** 当前教学步骤：'attack'|'defend'|'item'|'finish'（非教学返回 null） */
  function tutStep(){
    if(!tutCombatActive()) return null;
    var t=getState().flags.onb;
    return !t.tcTried.atk ? 'attack' : (!t.tcTried.def ? 'defend' : (!t.tcUsedItem ? 'item' : 'finish'));
  }

  /**
   * 开场教学战：脚本化演出（复用 DQ 战斗卡渲染）。
   * 设计：主角出手多为虚招（打在空气），真正重创官差的是老乞丐的「无名掌法」；
   * 主角只会被刀芒锐气擦伤——由此自然引出「行囊/金疮药」教学，将剧情、引导、系统功能合而为一。
   */
  function tutCombatAct(actionId){
    var eng=G.CombatEngine, st=eng.state;
    var enemy=st.enemies[0], p=st.playerUnits[0];
    var expect=tutStep();   // 当前应当练习的步骤（严格状态机，杜绝乱序导致的死循环）
    if(actionId!=='attack' && actionId!=='defend') return;  // 教学战只处理攻/防（道具走 dqOpenItems）

    // 点错按钮：老乞丐温和纠正，不推进、不扣血、敌人不死 —— 永远只能靠"当前高亮的那一步"前进
    if(expect==='attack' && actionId!=='attack'){
      log('「别急——先点〔攻击〕，试试你的拳脚！」','npc','老乞丐'); return;
    }
    if(expect==='defend' && actionId!=='defend'){
      log('「攻击你会了，这回试试〔防御〕——看敌势，借力卸力！」','npc','老乞丐'); return;
    }
    if(expect==='item'){
      log('「先用〔道具〕取金疮药，治你臂上刀伤——疗伤也是功夫！」','npc','老乞丐'); return;
    }
    if(expect==='finish' && actionId!=='attack'){
      log('「攻防皆会、伤也疗了——再点〔攻击〕，送他上路！」','npc','老乞丐'); return;
    }

    // ── 点对了：按步骤演出 ──
    if(actionId==='defend'){
      getState().flags.onb.tcTried.def=true;
      log('你依言横臂护住要害。老乞丐掌风一引，将官差的刀势荡开，顺势一掌印在他马腹——','env');
      log('「这便是「防」字诀——先看敌势，再借力卸力，莫硬接！」','npc','老乞丐');
      enemy.hp=Math.max(1, enemy.hp-40);
    } else {   // attack
      if(expect==='attack'){   // 首击完整演出
        getState().flags.onb.tcTried.atk=true;
        log('你摆开架势强装镇静，随手一拳却打在空气——官差跃马挥刀，迎面劈下！','env');
        log('老乞丐无名掌法暴起，劲气错身而过，顺手拽你衣领躲过杀招；刀芒锐气擦过，在你臂上划开一道血口。','env');
        enemy.hp=Math.max(1, enemy.hp-120);
        p.hp=Math.max(1, p.hp-22); getState().hp=p.hp;     // 刀芒锐气砍伤
        if(!getState().flags.onb.packGiven) tutThrowPack();  // 受伤后老乞丐甩出行囊 → 解锁「道具」教学
      } else {   // expect==='finish' 收尾击杀
        log('老乞丐无名掌法再起，掌力如潮，一掌正印在官差胸口，将他连人带马震退数丈！','env');
        enemy.hp=0;
      }
    }
    dqRenderCard();   // 同步 DQ 卡面血条
    save(getState());
    if(enemy.hp<=0){ st.result='win'; endCombat('win'); return; }
    dqRenderRound();
  }

  // ── DQ 风格队伍战斗（常规/教学战斗共用）：列阵卡 + 逐人下令 ──

  var dqOrders=[];        // 本回合各队员指令 {unit, actionId, targetIdx}
  var dqCursor=0;         // 正在下令的队员序号（按存活队伍顺序）
  var dqBusy=false;       // 结算动画进行中，禁止重复操作
  // 胜负结算特写覆盖层
  function playCombatFx(kind){
    var fx=document.createElement('div');
    fx.className='combat-fx '+kind;
    var w=document.createElement('div'); w.className='fx-word';
    w.textContent= kind==='win'?'胜':'败';
    fx.appendChild(w);
    if(kind==='win'){
      for(var i=0;i<16;i++){
        var s=document.createElement('span'); s.className='fx-spark';
        s.style.left=(Math.random()*100)+'%';
        s.style.animationDelay=(Math.random()*0.6).toFixed(2)+'s';
        s.style.animationDuration=(1.0+Math.random()*0.6).toFixed(2)+'s';
        fx.appendChild(s);
      }
    } else {
      var c=document.createElement('div'); c.className='fx-crack'; fx.appendChild(c);
    }
    document.body.appendChild(fx);
    setTimeout(function(){ if(fx.parentNode) fx.parentNode.removeChild(fx); }, kind==='win'?1300:1650);
  }

  // ===================== DQ 风格队伍回合制（常规/教学战斗共用）=====================
  // 传统勇者斗恶龙式：敌群在右、我方在左列阵；逐名队员下令（攻击需选目标 / 防御 / 道具 / 撤退）；
  // 全员出招后，敌群依序反击。简化掉五行克制提示、战意连击等花哨显示，只保留清晰血条与意图。

  /** 进入 DQ 战斗：建卡 + 预告敌意 + 渲染列阵 + 开首回合 */
  function dqInitCombat(){
    dqResetRage();   // 新战斗重置"狂怒转阶段"演出标记
    setDqCardEl(document.getElementById('dq-combat-card'));
    if(!getDqCardEl()){ setDqCardEl(document.createElement('div')); getDqCardEl().id='dq-combat-card'; getDqCardEl().className='combat-card dq-combat-card'; var _sc=document.getElementById('scene'); if(_sc) _sc.appendChild(getDqCardEl()); }
    if(!getDqCardEl()._skipBound){ getDqCardEl()._skipBound=true;   // 点击战斗卡 = 演出快进（跳过当前段等待，连点加速过场）
      getDqCardEl().addEventListener('click', function(e){
        if(e.target && e.target.closest && e.target.closest('button, a')) return;
        if(dqPlaySkip) dqPlaySkip();
      });
    }
    G.CombatEngine.peekEnemyIntents();
    dqRenderCard();
    log('〔行动顺序条：蓝=我方指令，红=敌方意图，数字为出手节奏（越小越快）〕','sys');
    setTimeout(function(){ dqRenderRound(); }, 400);
  }

  /** 渲染列阵（敌人 + 我方，含血量/意图） */
  function dqRenderCard(){
    if(!getDqCardEl()) return;
    var st=G.CombatEngine.getStatus();
    // 同名敌人追加 甲乙丙… 区分（预计算一次，避免死亡分支重复计数）
    var nameCount={}, orderSeen={}, enemyLabels={};
    st.enemies.forEach(function(e){ nameCount[e.name]=(nameCount[e.name]||0)+1; });
    st.enemies.forEach(function(e){ orderSeen[e.name]=(orderSeen[e.name]||0)+1; var n=orderSeen[e.name];
      enemyLabels[e.idx]= nameCount[e.name]>1 ? (e.name + ['甲','乙','丙','丁','戊','己'][n-1]) : e.name; });
    function hpBar(u){ var pct=Math.max(0,Math.round(u.hp/u.maxHp*100)); var cls=pct>50?'dq-hp':pct>25?'dq-hp-warn':'dq-hp-danger'; return '<div class="dq-hpbar"><span class="dq-hpfill '+cls+'" style="width:'+pct+'%"></span></div><div class="dq-hpv">'+Math.max(0,u.hp)+' / '+u.maxHp+'</div>'; }
    function debuffs(u){ var s=''; (u.dots||[]).forEach(function(d){ s+='<span class="dq-debuff">'+d.name+(d.stacks>1?('×'+d.stacks):'')+'</span>'; }); return s; }

    var html='<div class="dq-field">';
    html+='<div id="dq-orderbar" class="dq-orderbar" aria-label="行动顺序"></div>';
    html+='<div class="dq-side dq-enemies">';
    st.enemies.forEach(function(e){
      if(e.hp<=0){ html+='<div class="dq-unit dq-enemy dead"><div class="dq-uname">'+enemyLabels[e.idx]+'</div><div class="dq-dead">已败</div></div>'; return; }
      var intent = e.intent ? (e.intent==='defend'?'摆出防御架势':('欲施「'+(e.intent.name||'普攻')+'」')) : '';
      html+='<div class="dq-unit dq-enemy" data-i="'+e.idx+'">'+
        '<div class="dq-uname">'+enemyLabels[e.idx]+'</div>'+ hpBar(e)+
        (intent?'<div class="dq-intent'+(e.intent!=='defend'&&e.intent.dmgMul>=1.5?' heavy':'')+'">'+(e.intent!=='defend'&&e.intent.dmgMul>=1.5?'⚠ ':'')+intent+'</div>':'')+
        debuffs(e)+'</div>';
    });
    html+='</div>';
    html+='<div class="dq-side dq-party">';
    st.playerUnits.forEach(function(u){
      html+='<div class="dq-unit dq-ally'+(u.hp<=0?' dead':'')+'" data-i="'+u.idx+'">'+
        '<div class="dq-uname">'+u.name+(u.idx===0?'（你）':'')+'</div>'+ hpBar(u)+ debuffs(u)+'</div>';
    });
    html+='</div>';
    html+='<div class="dq-round">—— 第 '+st.round+' 回合 ——</div>';
    html+='</div>';
    getDqCardEl().innerHTML=html;
    dqRenderOrderBar();
  }

  /** P0-1 行动顺序条：渲染本回合行动序列（我方指令序→敌方意图序），beat 徽标 = 出手节奏 */
  function dqRenderOrderBar(){
    var el=document.getElementById('dq-orderbar');
    if(!el) return;
    var eng=G.CombatEngine.state;
    if(!eng) return;
    var cells=[];
    // ── 我方段：存活队员按 dqOrders 指令序（未下令显示待定，当前光标单位加亮框） ──
    var cursorUnit=null;
    if(dqCursor!=null){
      var liveUnits=eng.playerUnits.filter(function(u){ return u.hp>0; });
      cursorUnit=liveUnits[dqCursor];
    }
    eng.playerUnits.forEach(function(u){
      if(u.hp<=0) return;
      var o=null;
      for(var i=0;i<dqOrders.length;i++){ if(dqOrders[i].unit===u){ o=dqOrders[i]; break; } }
      var label, beat=null;
      if(o){
        if(o.actionId==='defend'){ label='防御'; beat=30; }
        else if(o.actionId==='item'){ label='用道具'; beat=25; }
        else { var a=u.artMap[o.actionId]||u.artMap['beng_quan']; label=(a&&a.name)||'普攻'; beat=(a&&a.beat)||null; }
      } else { label='待定'; }
      var cls='p'+(o?'':' wait')+(u===cursorUnit?' cur':'');
      cells.push('<span class="dq-order-step '+cls+'"><span class="ob-name">'+(u.idx===0?'你':u.name)+'</span><span class="ob-act">'+(o?label:'待下令')+'</span>'+(beat?beatBadge(beat):'')+'</span>');
    });
    cells.push('<span class="dq-order-div">▼ 敌方行动</span>');
    // ── 敌方段：存活敌人按已预告意图（蓄力重招标红） ──
    eng.enemies.forEach(function(e){
      if(e.hp<=0) return;
      var act=e.intent;
      var label, beat=null, heavy=false, done=false;
      if(act==='defend'){ label='防御'; beat=30; done=true; }
      else if(act && typeof act==='object'){ label='「'+(act.name||'普攻')+'」'; beat=act.beat||null; heavy=(act.dmgMul||0)>=1.5; done=true; }
      else { label='待定'; }
      var cls='e'+(done?'':' wait')+(heavy?' heavy':'');
      cells.push('<span class="dq-order-step '+cls+'"><span class="ob-name">'+e.name+'</span><span class="ob-act">'+(done?label:'待意图')+'</span>'+(beat?beatBadge(beat):'')+(heavy?'<span class="ob-beat slow">重</span>':'')+'</span>');
    });
    el.innerHTML=cells.join('<span class="dq-order-arrow">→</span>');
  }
  function beatBadge(b){
    var cls=b<=20?'fast':(b<=30?'mid':'slow');
    var label=b<=20?'快':(b<=30?'中':'慢');
    return '<span class="ob-beat '+cls+'">'+label+b+'</span>';
  }

  /** 开场：清空本回合指令、预告敌意、进入首名队员下令 */
  function dqRenderRound(){
    if(dqBusy) return;
    dqOrders=[]; dqCursor=0;
    G.CombatEngine.peekEnemyIntents();
    dqRenderCard();
    setTimeout(dqNextCommand, 200);
  }

  /** 轮到当前队员下令（必须用引擎真实单位对象：带 artIds/artMap，getStatus 副本不含） */
  function dqNextCommand(){
    var units=G.CombatEngine.state.playerUnits.filter(function(u){ return u.hp>0; });
    if(dqCursor>=units.length){ dqResolveRound(); return; }
    dqRenderCommands(units[dqCursor]);
  }

  /** 显示某队员命令菜单（DQ 四选项；教学战接入 tutCombatAct 脚本演出 + 分步引导高亮） */
  function dqRenderCommands(unit){
    var ra=document.getElementById('actions'); if(!ra) return;
    ra.innerHTML='';
    var tut=tutCombatActive();
    var tip=document.createElement('div'); tip.className='dq-turn'; tip.textContent=(unit.idx===0?'你':unit.name)+' 的回合'+(tut?'〔教学演练中〕':''); ra.appendChild(tip);
    var step=tut?tutStep():null;
    // 教学引导文案（剧情与引导合一）：攻击 → 防御 → 道具 → 收尾
    if(tut){
      var stT=G.CombatEngine.state;
      // 受伤即由老乞丐扔出行囊（首击时已在 tutCombatAct 内抛出，此处兜底）
      if(!getState().flags.onb.packGiven && (stT.playerUnits[0].hp < stT.playerUnits[0].maxHp || (getState().flags.onb.tcTried.atk && getState().flags.onb.tcTried.def))){
        tutThrowPack();
      }
      if(step==='attack'){ if(!getState().flags.onb.tcMsgs.attack){ log('「先点亮的〔攻击〕，挫他锐气！」','npc','老乞丐'); getState().flags.onb.tcMsgs.attack=true; } }
      else if(step==='defend'){ if(!getState().flags.onb.tcMsgs.defend){ log('「再点〔防御〕——看敌势，借力卸力，莫硬接！」','npc','老乞丐'); getState().flags.onb.tcMsgs.defend=true; } }
      else if(step==='item'){ if(!getState().flags.onb.tcMsgs.use){ log('「点〔道具〕，取金疮药治你臂上刀伤！」','npc','老乞丐'); getState().flags.onb.tcMsgs.use=true; } }
      else { if(!getState().flags.onb.tcMsgs.finish){ log('「好生养着。再点〔攻击〕，送这乌桓斥候上路！」','npc','老乞丐'); getState().flags.onb.tcMsgs.finish=true; } }
    }
    function btn(label, fn, cls){ var b=document.createElement('button'); b.className='act cb-menu'+(cls?' '+cls:''); b.classList.remove('locked'); b.textContent=label; b.onclick=fn; ra.appendChild(b); }
    btn('攻击', function(){ if(tut){ tutCombatAct('attack'); return; } dqShowTargets(unit); }, tut&&(step==='attack'||step==='finish')?'onb-glow':null);
    btn('防御', function(){ if(tut){ tutCombatAct('defend'); return; } dqOrders.push({unit:unit, actionId:'defend'}); dqAdvance(); }, tut&&step==='defend'?'onb-glow':null);
    // 教学：老乞丐赠行囊前不显示「道具」，避免提前绕过关卡；正常战恒显示
    if(!(tut && !getState().flags.onb.packGiven)) btn('道具', function(){ dqOpenItems(unit); }, tut&&step==='item'?'onb-glow':'item');
    var fleePct = 78;
    try { fleePct = Math.max(20, Math.min(95, Math.round(G.CombatEngine.fleeChance()*100))); } catch(_e) {}
    btn('撤退·' + fleePct + '%', function(){ if(tut){ log('「未到撤的时候，先应敌！」','npc','老乞丐'); return; } dqTryFlee(unit); }, 'flee');
    // 武学：选择已学招式（连线已有的 G.MARTIAL_ARTS，使之在战斗里真正可用）
    if(!tut && unit.artIds.length){
      btn('武学', function(){ dqShowArts(unit); }, 'skill');
    }
  }

  /** 武学：列出该队员已学招式，选后进入目标选择 */
  function dqShowArts(unit){
    var ra=document.getElementById('actions'); if(!ra) return;
    ra.innerHTML='';
    var tip=document.createElement('div'); tip.className='dq-turn'; tip.textContent='选择武学'; ra.appendChild(tip);
    (unit.artIds||[]).forEach(function(aid){
      var a=G.MARTIAL_ARTS.get(aid); if(!a) return;
      var b=document.createElement('button'); b.className='act cb-menu skill';
      b.textContent=a.name + (a.element?('〔'+a.element+'〕'):'') + (a.type==='ultimate'?' · 绝技':(a.type==='tech'?' · 发力':''));
      b.onclick=function(){ dqShowTargets(unit, aid); };
      ra.appendChild(b);
    });
    var cancel=document.createElement('button'); cancel.className='act cb-menu ghost'; cancel.textContent='返回'; cancel.onclick=function(){ dqRenderCommands(unit); }; ra.appendChild(cancel);
  }

  /** 攻击：选择目标敌人（forcedAid 指定招式，缺省用 beng_quan） */
  function dqShowTargets(unit, forcedAid){
    var ra=document.getElementById('actions'); if(!ra) return;
    ra.innerHTML='';
    var tip=document.createElement('div'); tip.className='dq-turn'; tip.textContent='选择攻击目标'; ra.appendChild(tip);
    var st=G.CombatEngine.getStatus();
    var aid = forcedAid || (unit.artIds.indexOf('beng_quan')>=0 ? 'beng_quan' : (unit.artIds[0]||'beng_quan'));
    st.enemies.forEach(function(e){
      if(e.hp<=0) return;
      var b=document.createElement('button'); b.className='act cb-menu'; b.textContent=e.name+(st.enemies.filter(function(x){return x.name===e.name;}).length>1?(' '+(['甲','乙','丙','丁','戊'][e.idx]||(e.idx+1))):'');
      b.onclick=function(){ dqOrders.push({unit:unit, actionId:aid, targetIdx:e.idx}); dqAdvance(); }; ra.appendChild(b);
    });
    var cancel=document.createElement('button'); cancel.className='act cb-menu ghost'; cancel.textContent='返回'; cancel.onclick=function(){ dqRenderCommands(unit); }; ra.appendChild(cancel);
  }

  /** 道具：给该队员使用恢复类道具 / 暗器（即时结算，占用该队员本回合） */
  function dqOpenItems(unit){
    var ra=document.getElementById('actions'); if(!ra) return;
    if(tutCombatActive()){
      var _stp=tutStep();
      if(_stp!=='item'){
        log('「先按眼下点亮的练——' + (_stp==='attack'?'先点〔攻击〕，试试拳脚！':(_stp==='defend'?'先练〔防御〕，借力卸力！':'攻防皆会、伤也疗了——点〔攻击〕送他上路！')) + '」','npc','老乞丐');
        dqRenderCommands(unit); return;
      }
    }
    var usables=packList().filter(function(it){ return it.effect && (it.effect.hp||it.effect.mp||it.effect.dmg); });
    if(!usables.length){ log('〔行囊空空，无物可用。〕','sys'); dqRenderCommands(unit); return; }
    ra.innerHTML='';
    var tip=document.createElement('div'); tip.className='dq-turn'; tip.textContent='给 '+(unit.idx===0?'你':unit.name)+' 使用'; ra.appendChild(tip);
    usables.forEach(function(it){
      var b=document.createElement('button'); b.className='act cb-menu item'; b.textContent=it.name+(it.count>1?(' ×'+it.count):'');
      b.onclick=function(){
        var st=G.CombatEngine.state;
        if(it.effect.dmg){   // 暗器：直接伤当前存活的首名敌人
          var tgt=st.enemies.filter(function(x){ return x.hp>0; })[0];
          if(!tgt){ log('敌阵已无活口。','sys'); dqRenderCommands(unit); return; }
          var d=it.effect.dmg;
          tgt.hp=Math.max(0, tgt.hp-d);
          dqConsumeItem(it.defId);
          dqOrders.push({unit:unit, actionId:'item'});
          log((unit.idx===0?'你':unit.name)+'抖手发出「'+it.name+'」，重创'+tgt.name+' '+d+' 点！','player');
          dqRenderCard();
          if(st.enemies.every(function(x){ return x.hp<=0; })){ st.result='win'; dqFinish(); return; }  // 暗器毙敌立即结算
          if(tutCombatActive()){ getState().flags.onb.tcUsedItem=true; save(getState()); dqRenderRound(); return; }
          dqAdvance(); return;
        }
        var before=unit.hp;
        unit.hp=Math.min(unit.maxHp, unit.hp+(it.effect.hp||0));
        unit.mp=Math.min(unit.maxMp, unit.mp+(it.effect.mp||0));
        if(unit.idx===0){ getState().hp=unit.hp; getState().mp=unit.mp; }
        dqConsumeItem(it.defId);
        dqOrders.push({unit:unit, actionId:'item'});   // 占用该队员本次行动
        log((unit.idx===0?'你':unit.name)+'使用'+it.name+'，回复 '+Math.max(0,unit.hp-before)+' 气血。','good');
        if(tutCombatActive()){ getState().flags.onb.tcUsedItem=true; save(getState()); dqRenderRound(); return; }  // 教学：不走引擎回合，直接进入下一引导步
        dqRenderCard(); dqAdvance();
      };
      ra.appendChild(b);
    });
    var cancel=document.createElement('button'); cancel.className='act cb-menu ghost'; cancel.textContent='返回'; cancel.onclick=function(){ dqRenderCommands(unit); }; ra.appendChild(cancel);
  }
  function dqConsumeItem(defId){
    for(var i=0;i<getState().pack.length;i++){ if(getState().pack[i] && getState().pack[i].defId===defId){ getState().pack[i].count--; if(getState().pack[i].count<=0) getState().pack[i]=null; break; } }
  }

  /** 撤退：全队尝试脱身（主角判定） */
  function dqTryFlee(unit){
    var r=G.CombatEngine.tryFlee();
    log(r.text,'sys');
    if(r.success){ endCombat('fled'); return; }
    if(r.log) r.log.forEach(function(e){ log(e.text,e.type||'sys'); });
    var st=G.CombatEngine.getStatus();
    if(st.result){ endCombat(st.result); return; }
    if(st.playerUnits[0].hp<=0){ endCombat('lose'); return; }
    log('敌军围困，脱身不得！','sys');
    dqAdvance();   // 逃跑失败，该队员本回合作废
  }

  /** 推进到下一名队员 */
  function dqAdvance(){ dqCursor++; dqRenderOrderBar(); dqNextCommand(); }

  /** 全员下令完毕：结算 玩家阶段 → 敌方阶段 → 下一回合 */
  function dqResolveRound(){
    dqBusy=true; clearActions();
    var pLog=G.CombatEngine.runPlayerPhase(dqOrders);
    dqPlayLog(pLog, function(){
      if(G.CombatEngine.state.result){ dqFinish(); return; }
      var eLog=G.CombatEngine.runEnemyPhase();
      dqPlayLog(eLog, function(){
        if(G.CombatEngine.state.result){ dqFinish(); return; }
        dqBusy=false; dqOrders=[]; dqCursor=0; dqRenderRound();
      });
    });
  }

  /** 逐条回放战斗日志：直接写入叙事层并刷新列阵（不受打字锁影响）。
   *  点击战斗卡可立即结束当前段等待（连点加速过场）；演出结束自动清除钩子。 */
  var dqPlaySkip=null;
  function dqPlayLog(log, done){
    var i=0, timer=null;
    function step(){
      if(i>=log.length){ dqPlaySkip=null; if(done) done(); return; }
      var e=log[i++];
      dqPush(e.text);
      dqRenderCard();                // 先刷新列阵（含最新血量/意图），再挂飘字/受击特效，避免重建卡片清掉刚挂上的特效
      dqFx(e);                       // DQ 战斗表现层：飘字/受击/暴击/克制/狂怒演出（v20260831r）
      var d=(e.type==='player_atk'||e.type==='enemy_atk')?520:(e.type==='counter'||e.type==='dot')?420:300;
      timer=setTimeout(step, d);
    }
    dqPlaySkip=function(){ if(timer){ clearTimeout(timer); timer=null; } step(); };
    step();
  }
  // ── DQ 战斗表现层（v20260831r）：每条引擎日志回放时驱动飘字/受击/暴击/克制/狂怒演出 ──
  // 引擎日志已带 tgtSide/tgtIdx（多敌定位），配合 .dq-unit[data-i] 把特效挂到正确单位卡片。
  var dqRageFired={};   // 记录本场已触发过"狂怒"转阶段演出的敌人（idx:true）
  function dqResetRage(){ dqRageFired={}; }
  function dqFx(entry){
    var text=entry.text||'';
    var crit=entry.crit || /暴击/.test(text);
    var side=entry.tgtSide, idx=entry.tgtIdx;
    if(!side){   // 旧路径 fallback：按日志类型推断承受方
      if(entry.type==='player_atk') side='enemy';
      else if(entry.type==='enemy_atk') side='player';
      else if(entry.type==='counter') side='enemy';
      else if(entry.type==='dot') side=(entry.side==='enemy'?'enemy':'player');
    }
    if(/闪过|未命中/.test(text) && side){ showDodge(side, idx); }
    else if(/格挡/.test(text)){
      var bs=(side==='player'||/^你/.test(text))?'player':'enemy';
      flashBlock(bs, idx); floatLabel(bs,'格挡','block', idx);
    }
    else if(entry.dmg && entry.dmg>0 && side){
      floatDamage(entry.dmg, side, crit, idx);           // 伤害飘字（暴击放大变红）
      flashHit(side, crit, idx);                          // 受击红闪/后仰
      floatImpact(side, entry.atkLine||'fist', 'hit', idx); // 拳印/剑痕/刀影…
      if(crit || entry.dmg>=20) floatImpact(side, entry.atkLine||'fist', 'wound', idx);
      var es=G.CombatEngine.state.enemies||[];
      var maxHp = side==='enemy' ? ((es[idx]||{}).maxHp||0) : effectiveStats().maxHp;
      var curHp = side==='enemy' ? ((es[idx]||{}).hp) : (entry.pHp!=null?entry.pHp:0);
      if(maxHp && curHp!=null && curHp/maxHp<0.3 && Math.random()<0.45) floatImpact(side, entry.atkLine||'fist', 'bandage', idx);
      if(crit){ critBurst(side, idx); markSceneCrit(); flashSeal('斬'); }  // 暴击爆裂 + 场景特写 + 斩印
      // 五行克制标签（挂在承受方卡片）
      if(entry.attrType==='counter') floatLabel(side,'克制','counter', idx);
      else if(entry.attrType==='countered') floatLabel(side,'被克','countered', idx);
      // ── Boss 转阶段：敌方血量首破 40%（狂怒阈值）→ 屏红 + 「狂」印章 + 震屏 ──
      if(side==='enemy' && !dqRageFired[idx]){
        var eu=es[idx];
        if(eu && eu.maxHp>0 && eu.hp>0 && eu.hp/eu.maxHp<0.4){
          dqRageFired[idx]=true;
          var sc=document.getElementById('scene');
          if(sc){ sc.classList.remove('bg-danger'); void sc.offsetWidth; sc.classList.add('bg-danger'); }
          flashSeal('狂'); markSceneCrit(); shakeScene(); SFX.crit();
          log('「'+eu.name+'」双目赤红，陷入狂怒！','sys');
        }
      }
    }
    if(crit || (entry.dmg && entry.dmg>=25)) shakeScene();
    // 音效
    if(entry.type==='player_atk' || entry.type==='enemy_atk'){
      if(crit) SFX.crit();
      else { SFX.swing(); setTimeout(function(){ SFX.hit(); }, 110); }
    } else if((entry.type==='counter'||entry.type==='dot') && entry.dmg){ SFX.hit(); }
  }

  function dqPush(text){
    if(!getNarr()) return;
    var p=document.createElement('div'); p.className='cb-line'; p.textContent=text; getNarr().appendChild(p);
    var sc=document.getElementById('scene'); if(sc) sc.scrollTop=sc.scrollHeight;
  }

  /** 战斗结束收尾（解叙事锁、清场由 endCombat 处理） */
  function dqFinish(){
    dqBusy=false; flushNarr(); clearActions();
    endCombat(G.CombatEngine.state.result==='win'?'win':'lose');
  }

  /** 战斗结束 */
  function endCombat(result){
    if(getCombatMode()===null) return;   // 防止重复调用（如快速连点）
    setCombatMode(null);
    dqPlaySkip=null;                // 战斗结束，清除演出快进钩子
    // 注意：保留 in-combat（含 #lower/#dock 隐藏）直到结算面板被「确认」关闭，
    // 这样方向罗盘不会在战后提前浮现、暗示玩家优先离开场景
    var sceneEl=document.getElementById('scene'); if(sceneEl){ sceneEl.dataset.bg=''; sceneEl.classList.remove('bg-danger'); }
    clearActions();                  // 清除战斗按钮，防止残留可点击
    if(G.CombatEngine && G.CombatEngine.state){ G.CombatEngine.state.result='ended'; } // 标记引擎已结束，阻断重复结算
    // 开场教学战斗：战败/逃跑由老乞丐救场，避免新手卡死（仍算教学完成）
    var tutC = getState().flags.onb && getState().flags.onb.tcTutorial && !getState().flags.onb.tcDone;
    if(tutC && result!=='win'){
      if(result==='lose'){ getState().hp = effectiveStats().maxHp; log('老乞丐枯手一拂，将你从刀下拽回：「这刀老夫替你挡了！」','env'); }
      else { log('「罢了，先撤一步，拳脚日后再练。」','npc','老乞丐'); }
      getState().flags.onb.tcDone=true; getState().flags.onb.tcTutorial=false; getState().defeated=false;
      log('〔教学演练结束——往后真打可没这般好运，记得用药、看敌意。〕','sys');
      save(getState()); renderStatus();
      if(getDqCardEl()){ getDqCardEl().classList.add('settle-win'); }
      playCombatFx('win');
      showCombatSettlement({result:'win', title:'演 练 结 束', sub:'老乞丐出手相救，化险为夷。',
        lines:[{text:'教学演练完成——往后真打可没这般好运。'}]}, exitCombatToRoom);
      return;
    }
    // ── 攻城战（易主/火战）特殊处理（v20260824d）──
    if(getPendingSiegeCid()){
      var sc=getPendingSiegeCid(); setPendingSiegeCid(null);
      if(result==='fled'){
        log('你鸣金收兵，撤出战场，「'+(((LF.CITIES||{})[sc]||{}).name||'城')+'」暂未易主。','sys');
      } else if(result==='win'){
        siegeWin(sc);
      } else {
        siegeLose(sc);
      }
      var _fx=(result==='win'?'win':(result==='lose'?'lose':''));
      if(getDqCardEl()) getDqCardEl().classList.add(result==='win'?'settle-win':(result==='lose'?'settle-lose':''));
      playCombatFx(_fx);
      var cityName=(((LF.CITIES||{})[sc]||{}).name||'城');
      save(getState()); renderStatus();
      showCombatSettlement({result:result, enemyName:cityName,
        lines: result==='win' ? [{text:'「'+cityName+'」已收入麾下。'}]
             : result==='fled' ? [{text:'鸣金收兵，「'+cityName+'」暂未易主。'}]
             : [{text:'兵败如山倒，「'+cityName+'」未能取下。'}]},
        function(){ if(getCurrentModalKind()==='map') openModal('map'); exitCombatToRoom(); });
      return;
    }
    var st=G.CombatEngine.getStatus();
    var enemy=G.CombatEngine.getEnemy();
    // 终局先用真实状态同步战斗卡（避免最后一击致负/致死时卡面停留在上一回合血量）
    if(getDqCardEl()) dqRenderCard();

    // 更新玩家状态
    getState().hp=st.playerUnits[0].hp;
    getState().mp=st.playerUnits[0].mp;
    maybeStarve();   // 战后结算饥馁（食物/饮水耗尽则扣血）
    decayEquipment(); // 战后装备耐久衰减

    if(result==='win'){
      if(tutCombatActive()){
        getState().flags.onb.tcDone=true; getState().flags.onb.tcTutorial=false;
        if(getState().learnedMartial.indexOf('wu_ming_quan')<0) getState().learnedMartial.push('wu_ming_quan');
        log('老乞丐枯手翻飞，所示武功极高深，残敌尽数被震退、溃不成军！','env');
        log('「这便是「无名拳法」——拳贵直、劲贵整，记着了？」','npc','老乞丐');
        log('【习得】无名拳法！（已收入武学，可在「角色」查看）','good');
        log('朝你一努嘴：「前头便是去路——点下头「移动」，随老夫往下头去便是。」','npc','老乞丐');
        log('你喘匀了气，打量这猎棚：棚角堆着干茅与兽骨，灶台余烬未熄，外头东北风卷着雪沫子，一下下扑打篷布。老乞丐已替你望风，只催你动身。','env');
        log('〔教学演练结束——往后真打可没这般好运，记着用药、看清敌意。〕','sys');
        renderStatus(); save(getState());
      }
      // 多敌：聚合全部敌人的掉落与经验（RREP/主线进度仍按首敌处理）
      var enemyDatas=G.CombatEngine.getAllEnemyData();
      var drop={ gold:0, pot:0, items:[], equip:null };
      var expGain=0;
      enemyDatas.forEach(function(ed){
        var d=G.CombatEngine.getDrop(ed);
        drop.gold+=d.gold; drop.pot+=d.pot;
        d.items.forEach(function(it){ drop.items.push(it); });
        if(!drop.equip && d.equip) drop.equip=d.equip;
        expGain+=enemyExp(ed);
      });
      getState().gold+=drop.gold;
      getState().pot+=drop.pot;
      addXp(expGain);
      // ── 掉落收集：先放入「战利品」列表，由「搜打撤」窗口决定拾取/丢弃（不自动入库，避免背包被静默塞满）──
      var summary={ result:'win', enemyName:enemy.name, expGain:expGain, gold:drop.gold, pot:drop.pot, loot:[], lines:[] };
      if(tutCombatActive()) summary.lines.push({text:'【习得】无名拳法！已收入武学。'});
      drop.items.forEach(function(it){
        summary.loot.push(LF.ITEMS.makeItem(it.id, 1) || {defId:it.id, name:it.name, icon:(it.icon||'📦'), cat:it.cat||'道具', count:1, effect:it.effect});
      });
      // ── 装备掉落（P1 完整）──
      if(drop.equip){
        summary.loot.push(LF.ITEMS.equipToPackItem(drop.equip));
      }

      // ── 声望 / 主线进度（P4 真实获取途径，替代调试台直赋）──
      var RREP={bandit:2,bandit_chief:4,yellow_turban:5,hua_xiong:20,dummy:0,heishan_zei:2,heishan_zhu:12};
      if(RREP[enemy.id]) addReputation(RREP[enemy.id]);
      if(enemy.id==='bandit'||enemy.id==='bandit_chief'||enemy.id==='heishan_zei'||enemy.id==='heishan_zhu') getState().quest.bandit++;
      else if(enemy.id==='yellow_turban') getState().quest.turban++;
      else if(enemy.id==='hua_xiong'){
        getState().quest.hua_xiong=true; getState().quest.luoyang=true;
        log('【主线】力斩华雄！洛阳之门已为你敞开，可自「颍川主营」赴洛阳。','good');
        summary.lines.push({text:'【主线】力斩华雄！洛阳之门已开。'});
      }
      else if(enemy.id==='heishan_zhu'){
        log('【剿匪】黑山寨主张燕授首！聚义厅群龙无首，余众溃散——此寨已平。','good');
        summary.lines.push({text:'【剿匪】黑山寨主张燕授首，此寨已平。'});
      }
      if(RREP[enemy.id]) summary.repText=RREP[enemy.id];

      // ── 支线B：林径猎户寻药篓——胜野狼后交还药篓，猎户赠谢礼（v20260831t）──
      if(enemy.id==='wild_wolf' && getState().flags && getState().flags.wz_liehu && !getState().flags.wz_liehu_done){
        getState().flags.wz_liehu_done=true;
        getState().gold+=15;
        addReputation(2);
        packAdd('caoyao',3);
        packAdd('roubao',1);
        log('你拎着药篓走出林来。猎户接过药篓，喜极：「寻回来了！」硬塞给你草药三把、肉包一只与一串铜钱，又指了条采药捷径。','npc','受伤猎户');
        summary.lines.push({text:'【支线·寻药篓】猎户得药，赠你谢礼（草药×3、肉包×1、银两+15）。'});
      }

      // ── P2：艺线经验由战斗出手累积，满则升级 ──
      var gains=G.CombatEngine.getLineGains()||[];
      if(gains.length){
        var expMap={};
        gains.forEach(function(g){ if(!g.line) return; expMap[g.line]=(expMap[g.line]||0)+(g.crit?8:5); });
        var LINES=G.MARTIAL_ARTS.LINES, upMsgs=[];
        for(var l in expMap){
          getState().lineExp[l]=(getState().lineExp[l]||0)+expMap[l];
          var lv=getState().lines[l]||0, need=(lv+1)*40;
          while(lv<20 && getState().lineExp[l]>=need){
            getState().lineExp[l]-=need; lv++;
            upMsgs.push(LINES[l].name+'艺线 Lv.'+lv);
            need=(lv+1)*40;
          }
          getState().lines[l]=lv;
        }
        if(upMsgs.length) log('【武学精进】'+upMsgs.join('、')+' 突破！攻防随之精进。','good');
        if(upMsgs.length) summary.lines.push({text:'【武学精进】'+upMsgs.join('、')+' 突破！'});
      }

      // ── 郊野战果归档：胜则按格+野怪id 记清剿（防反复刷同一批伏兽/野兽）──
      var _froom = G.ROOMS[getState().room];
      if(_froom && _froom.isField && enemyDatas && enemyDatas.length){
        var _cf0 = getState().flags.fieldClearedMon;
        if(!_cf0) _cf0 = getState().flags.fieldClearedMon = {};
        var _crow = _cf0[getState().room];
        if(!_crow) _crow = _cf0[getState().room] = {};
        enemyDatas.forEach(function(ed){ if(ed && ed.id) _crow[ed.id] = 1; });
      }

      if(getDqCardEl()) getDqCardEl().classList.add('settle-win');
      playCombatFx('win');
      SFX.win();
      toast('胜！+'+drop.gold+'银 +'+drop.pot+'潜能');
      showCombatSettlement(summary, exitCombatToRoom);
    } else if(result==='lose'){
      getState().hp=1;
      getState().defeated=true;   // 战败标记：封锁一切行动直到休整恢复
      if(getDqCardEl()) getDqCardEl().classList.add('settle-lose');
      playCombatFx('lose');
      SFX.lose();
      toast('败北！气血仅余1点');
      showCombatSettlement({result:'lose', enemyName:enemy.name,
        lines:[{text:'重伤倒地，气若游丝——须先「休整」恢复，方可再动。'}]}, exitCombatToRoom);
    } else if(result==='fled'){
      log('你已脱离战斗，回到原地。','sys');
      toast('已脱离战斗');
      showCombatSettlement({result:'fled', enemyName:enemy.name,
        lines:[{text:'你已脱离战斗，回到原地。'}]}, exitCombatToRoom);
    } else {
      log('两败俱伤，战斗未分胜负，各自收兵。','sys');
      toast('战斗未分胜负');
      showCombatSettlement({result:'fled', enemyName:enemy.name,
        lines:[{text:'两败俱伤，战斗未分胜负，各自收兵。'}]}, exitCombatToRoom);
    }

    save(getState()); renderStatus();
  }

  // 退出战斗结算、回到正常场景（同时解除 in-combat，让方向罗盘等恢复正常显示）
  function exitCombatToRoom(){
    var appEl=document.getElementById('app'); if(appEl) appEl.classList.remove('in-combat');
    document.body.classList.remove('in-combat');
    document.body.classList.remove('tut-combat');
    if(getDqCardEl() && getDqCardEl().parentNode){ getDqCardEl().parentNode.removeChild(getDqCardEl()); setDqCardEl(null); }
    // 苦役营·岗哨战斗路线（暴动/劫狱强攻）：教学战斗胜/被救场后自动毕业逃脱
    if(getState().flags && getState().flags.route && getState().flags.route._pending && getState().flags.onb && getState().flags.onb.tcDone && !getState().flags.onb.done){
      var rp=getState().flags.route._pending;
      finishEscape(rp); return;
    }
    renderRoom(getState().room, true);
  }

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
    var sel=null, ghost=null, dragSrc=null, startX=0, startY=0, moved=false, lastTap={t:0,key:null};
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
      hideInfo(); sel=null; c.classList.add('dragging');
      dragSrc={pane:c.getAttribute('data-pane'), idx:parseInt(c.getAttribute('data-idx'),10)};
      startX=e.clientX; startY=e.clientY; moved=false;
      try{ c.setPointerCapture(e.pointerId); }catch(_){}
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }
    function onMove(e){
      if(!dragSrc) return;
      if(!moved && (Math.abs(e.clientX-startX)>6||Math.abs(e.clientY-startY)>6)){
        moved=true;
        var it = dragSrc.pane==='loot'?lootArr[dragSrc.idx]:getState().pack[dragSrc.idx];
        makeGhost(it, e);
      }
      if(ghost){ ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px'; hlDrop(e); }
    }
    function onUp(e){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if(ghost){ ghost.parentNode.removeChild(ghost); ghost=null; }
      clearHl();
      var dc=host.querySelector('.packcell.dragging'); if(dc) dc.classList.remove('dragging');   // 不论是否移动都清除淡化，避免源格卡在变淡态
      if(moved){ var tgt=cellAt(e.clientX,e.clientY); if(tgt) doMove(dragSrc,tgt); }
      else { onTap(dragSrc); }
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
    var h='<div class="li-name">'+itemIconHTML(it,16)+' '+it.name+'</div>';
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

  // 战斗结算面板：战后弹出，展示战果 + 「搜打撤」战利品窗口（背包无论满否都出现）
  function showCombatSettlement(summary, onConfirm){
    onConfirm = onConfirm || exitCombatToRoom;
    var ov=document.getElementById('combat-settle');
    if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
    ov=document.createElement('div'); ov.id='combat-settle';
    ov.className='cs-overlay '+(summary.result==='lose'?'lose':(summary.result==='fled'?'fled':'win'));
    var titleText = summary.title || (summary.result==='win'?'✦ 大 胜 ✦':(summary.result==='lose'?'✘ 战 败':'⤺ 撤 退'));
    var sub = summary.sub || (summary.enemyName ? ('「'+summary.enemyName+'」'+(summary.result==='win'?'败于你手':(summary.result==='lose'?'将你击溃':'已被甩在身后'))) : '');
    var fixed='';
    if(summary.expGain) fixed+='<span class="cs-rew">⚔ 修为 +'+summary.expGain+'</span>';
    if(summary.gold) fixed+='<span class="cs-rew">💰 银两 +'+summary.gold+'</span>';
    if(summary.pot) fixed+='<span class="cs-rew">✦ 潜能 +'+summary.pot+'</span>';
    if(summary.repText) fixed+='<span class="cs-rew">🏴 声望 +'+summary.repText+'</span>';
    var linesHTML='';
    (summary.lines||[]).forEach(function(ln){ linesHTML+='<div class="cs-row ln">'+ln.text+'</div>'; });
    var hasLoot = !!(summary.loot && summary.loot.length);
    ov.innerHTML=
      '<div class="cs-card">'+
        '<div class="cs-title">'+titleText+'</div>'+
        (sub?'<div class="cs-sub">'+sub+'</div>':'')+
        '<div class="cs-rewards">'+fixed+'</div>'+
        (linesHTML?'<div class="cs-lines">'+linesHTML+'</div>':'')+
        (hasLoot?'<div id="cs-loot-host"></div>':'')+
        '<button id="cs-confirm" class="act cb-menu primary">确认'+(hasLoot?'拾取并返回':'')+'</button>'+
      '</div>';
    (document.getElementById('app')||document.body).appendChild(ov);
    if(hasLoot) mountLootPanes(document.getElementById('cs-loot-host'), summary.loot);
    var cs=document.getElementById('cs-confirm');
    if(cs) cs.onclick=function(){
      if(hasLoot && summary.loot.some(function(x){return x;}) && !cs.dataset.armed){
        cs.dataset.armed='1'; cs.textContent='战利品未取完 · 再点确认放弃'; return;   // 二次确认防误弃
      }
      save(getState()); renderStatus();   // 背包变动已入库；左栏残留＝放弃
      if(ov.parentNode) ov.parentNode.removeChild(ov);
      onConfirm();
    };
  }

    return {
      logHTML: logHTML, logText: logText, combatAnchor: combatAnchor, flashAnchor: flashAnchor,
      floatDamage: floatDamage, floatLabel: floatLabel, critBurst: critBurst, flashHit: flashHit,
      combatAnchorAppend: combatAnchorAppend, popWeapon: popWeapon, floatImpact: floatImpact, flashBlock: flashBlock,
      showDodge: showDodge, shakeScene: shakeScene, weaponSvg: weaponSvg, buildPortrait: buildPortrait,
      markAttack: markAttack, markSceneCrit: markSceneCrit, flashSeal: flashSeal, logCombat: logCombat,
      startCombat: startCombat, tutCombatActive: tutCombatActive, tutThrowPack: tutThrowPack, tutStep: tutStep,
      tutCombatAct: tutCombatAct, playCombatFx: playCombatFx, dqInitCombat: dqInitCombat,
      dqRenderCard: dqRenderCard, dqRenderOrderBar: dqRenderOrderBar, beatBadge: beatBadge,
      dqRenderRound: dqRenderRound, dqNextCommand: dqNextCommand, dqRenderCommands: dqRenderCommands,
      dqShowArts: dqShowArts, dqShowTargets: dqShowTargets, dqOpenItems: dqOpenItems,
      dqConsumeItem: dqConsumeItem, dqTryFlee: dqTryFlee, dqAdvance: dqAdvance,
      dqResolveRound: dqResolveRound, dqPlayLog: dqPlayLog, dqResetRage: dqResetRage,
      dqFx: dqFx, dqPush: dqPush, dqFinish: dqFinish, endCombat: endCombat,
      exitCombatToRoom: exitCombatToRoom, mountLootPanes: mountLootPanes, openLootWindow: openLootWindow,
      compareEquip: compareEquip, lootInfoHTML: lootInfoHTML, showCombatSettlement: showCombatSettlement
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createCombat;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

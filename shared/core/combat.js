(function (global) {
  var LF = global.LF || (global.LF = {});
  LF.createCombat = function (ctx) {
    var getState = ctx.getState, getCurrentModalKind = ctx.getCurrentModalKind,
        getCombatMode = ctx.getCombatMode, setCombatMode = ctx.setCombatMode,
        getDqCardEl = ctx.getDqCardEl, setDqCardEl = ctx.setDqCardEl,
        getPendingSiegeCid = ctx.getPendingSiegeCid, setPendingSiegeCid = ctx.setPendingSiegeCid,
        getPendingArmyBattle = ctx.getPendingArmyBattle,
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
        addXp = ctx.addXp, addReputation = ctx.addReputation, enemyExp = ctx.enemyExp;

    // 战斗系统（v20260908n）：战斗FX + 战斗渲染 + DQ 回合制 + 战利品结算
    // 依赖经 ctx 注入；state/combatMode/dqCardEl/pendingSiegeCid 为引擎中后赋值或随运行变化的绑定，用 getter/setter 惰性取值。

    // 战利品「搜打撤」窗口：已拆出为 shared/combat-loot.js，此处实例化并对齐原内部名
    var _loot = LF.createCombatLoot({
      getState: getState, packAdd: packAdd, packList: packList, packMax: packMax,
      packResize: packResize, save: save, toast: toast, renderStatus: renderStatus,
      itemIconHTML: itemIconHTML, usePackItem: usePackItem, equipFromPackTo: equipFromPackTo,
      exitCombatToRoom: function () { return exitCombatToRoom; }
    });
    var mountLootPanes = _loot.mountLootPanes, openLootWindow = _loot.openLootWindow,
        compareEquip = _loot.compareEquip, lootInfoHTML = _loot.lootInfoHTML;

    // 战斗视觉特效：已拆出为 shared/combat-fx.js，此处实例化并对齐原内部名
    var _fx = LF.createCombatFx({ SFX: SFX, getNarr: getNarr, log: log });
    var logHTML = _fx.logHTML, logText = _fx.logText, combatAnchor = _fx.combatAnchor;
    var flashAnchor = _fx.flashAnchor, floatDamage = _fx.floatDamage;
    var floatLabel = _fx.floatLabel, critBurst = _fx.critBurst, flashHit = _fx.flashHit;
    var combatAnchorAppend = _fx.combatAnchorAppend, popWeapon = _fx.popWeapon;
    var floatImpact = _fx.floatImpact, flashBlock = _fx.flashBlock, showDodge = _fx.showDodge;
    var shakeScene = _fx.shakeScene, weaponSvg = _fx.weaponSvg;
    var buildPortrait = _fx.buildPortrait, markAttack = _fx.markAttack;
    var markSceneCrit = _fx.markSceneCrit, flashSeal = _fx.flashSeal;
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
    try { if (window.SFX && SFX.setCombatBgm) SFX.setCombatBgm(true); else if (window.SFX && SFX.duckBgm) SFX.duckBgm(true); } catch(e){}   // P2/P3：开战切战曲+压氛围

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
    // 军队作战：营级单位（自带军令 artMap）并入我方序列
    if(opt.armyUnits && opt.armyUnits.length){
      opt.armyUnits.forEach(function(u){ party.push(u); });
    }
    var r=G.CombatEngine.init(party, enemyId);
    if(r.error){ log(r.error,'sys'); return; }
    // 军队作战：守军/攻方士气初始化（营级单位 hp 归零不判主角死亡，由 War 依兵力回扣结算）
    if(opt.armyUnits && opt.armyUnits.length && G.CombatEngine.state){
      var _ast=G.CombatEngine.state;
      (_ast.enemies||[]).forEach(function(e,i){
        var _aed=(_ast.enemyDatas||[])[i]||{};
        if(e.morale==null) e.morale = (_aed.morale!=null?_aed.morale:80);
      });
    }
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
  /** 韩铁扔来行囊：给金疮药 + 点亮行囊 + 解锁道具按钮 */
  function tutThrowPack(){
    if(!getState().flags.onb) return;
    if(getState().flags.onb.packGiven) return;   // 防重复发放
    getState().flags.onb.packGiven=true;
    packAdd('jinchuang',1);   // 韩铁赠金疮药（已堆叠则 +1）
    onbReveal('dock'); highlightOnb('dock'); save(getState()); renderStatus();
    log('韩铁：「接住！」抛来一只行囊——里头有瓶金疮药，以备疗伤（下头「道具」已点亮）。','env');
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
   * 设计：主角出手多为虚招（打在空气），真正发力的是韩教头的拳脚；
   * 主角只会在韩铁虚晃时被蹭破胳膊——由此自然引出「行囊/金疮药」教学，将剧情、引导、系统功能合而为一。
   */
  function tutCombatAct(actionId){
    var eng=G.CombatEngine, st=eng.state;
    var enemy=st.enemies[0], p=st.playerUnits[0];
    var expect=tutStep();   // 当前应当练习的步骤（严格状态机，杜绝乱序导致的死循环）
    if(actionId!=='attack' && actionId!=='defend') return;  // 教学战只处理攻/防（道具走 dqOpenItems）

    // 点错按钮：韩铁温和纠正，不推进、不扣血、敌人不死 —— 永远只能靠"当前高亮的那一步"前进
    if(expect==='attack' && actionId!=='attack'){
      log('「别急——先点〔攻击〕，试试你的拳脚！」','npc','韩铁'); return;
    }
    if(expect==='defend' && actionId!=='defend'){
      log('「攻击你会了，这回试试〔防御〕——看敌势，借力卸力！」','npc','韩铁'); return;
    }
    if(expect==='item'){
      log('「先用〔道具〕取金疮药，治你臂上擦伤——疗伤也是功夫！」','npc','韩铁'); return;
    }
    if(expect==='finish' && actionId!=='attack'){
      log('「攻防皆会、伤也疗了——再点〔攻击〕，送这木人桩散架！」','npc','韩铁'); return;
    }

    // ── 点对了：按步骤演出 ──
    if(actionId==='defend'){
      getState().flags.onb.tcTried.def=true;
      log('你依言横臂护住要害。韩铁拳风一引，将木人桩的来势荡开，顺势一掌印在桩身——','env');
      log('「这便是「防」字诀——先看敌势，再借力卸力，莫硬接！」','npc','韩铁');
      enemy.hp=Math.max(1, enemy.hp-40);
    } else {   // attack
      if(expect==='attack'){   // 首击完整演出
        getState().flags.onb.tcTried.atk=true;
        log('你摆开架势强装镇静，随手一拳却打在空气——韩铁虚晃一招，拳风蹭过，在你胳膊上划开一道血口。','env');
        log('韩铁收势一笑：「蹭破点皮，正好试试金疮药。」','npc','韩铁');
        enemy.hp=Math.max(1, enemy.hp-120);
        p.hp=Math.max(1, p.hp-22); getState().hp=p.hp;     // 蹭伤
        if(!getState().flags.onb.packGiven) tutThrowPack();  // 受伤后韩铁甩出行囊 → 解锁「道具」教学
      } else {   // expect==='finish' 收尾击杀
        log('韩铁拳脚再起，一记崩拳正印在木人桩心口，桩身木屑横飞、应声而裂！','env');
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
      // 受伤即由韩铁扔出行囊（首击时已在 tutCombatAct 内抛出，此处兜底）
      if(!getState().flags.onb.packGiven && (stT.playerUnits[0].hp < stT.playerUnits[0].maxHp || (getState().flags.onb.tcTried.atk && getState().flags.onb.tcTried.def))){
        tutThrowPack();
      }
      if(step==='attack'){ if(!getState().flags.onb.tcMsgs.attack){ log('「先点亮的〔攻击〕，挫它一阵！」','npc','韩铁'); getState().flags.onb.tcMsgs.attack=true; } }
      else if(step==='defend'){ if(!getState().flags.onb.tcMsgs.defend){ log('「再点〔防御〕——看敌势，借力卸力，莫硬接！」','npc','韩铁'); getState().flags.onb.tcMsgs.defend=true; } }
      else if(step==='item'){ if(!getState().flags.onb.tcMsgs.use){ log('「点〔道具〕，取金疮药治你臂上擦伤！」','npc','韩铁'); getState().flags.onb.tcMsgs.use=true; } }
      else { if(!getState().flags.onb.tcMsgs.finish){ log('「好生养着。再点〔攻击〕，送这木人桩散架！」','npc','韩铁'); getState().flags.onb.tcMsgs.finish=true; } }
    }
    function btn(label, fn, cls){ var b=document.createElement('button'); b.className='act cb-menu'+(cls?' '+cls:''); b.classList.remove('locked'); b.textContent=label; b.onclick=fn; ra.appendChild(b); }
    btn('攻击', function(){ if(tut){ tutCombatAct('attack'); return; } dqShowTargets(unit); }, tut&&(step==='attack'||step==='finish')?'onb-glow':null);
    btn('防御', function(){ if(tut){ tutCombatAct('defend'); return; } dqOrders.push({unit:unit, actionId:'defend'}); dqAdvance(); }, tut&&step==='defend'?'onb-glow':null);
    // 教学：韩铁赠行囊前不显示「道具」，避免提前绕过关卡；正常战恒显示
    if(!(tut && !getState().flags.onb.packGiven)) btn('道具', function(){ dqOpenItems(unit); }, tut&&step==='item'?'onb-glow':'item');
    var fleePct = 78;
    try { fleePct = Math.max(20, Math.min(95, Math.round(G.CombatEngine.fleeChance()*100))); } catch(_e) {}
    btn('撤退·' + fleePct + '%', function(){ if(tut){ log('「未到撤的时候，先应敌！」','npc','韩铁'); return; } dqTryFlee(unit); }, 'flee');
    // 武学：选择已学招式（连线已有的 G.MARTIAL_ARTS，使之在战斗里真正可用）
    if(!tut && unit.artIds.length){
      btn(unit.isTroop?'军令':'武学', function(){ dqShowArts(unit); }, 'skill');
    }
  }

  /** 武学：列出该队员已学招式，选后进入目标选择 */
  function dqShowArts(unit){
    var ra=document.getElementById('actions'); if(!ra) return;
    ra.innerHTML='';
    var tip=document.createElement('div'); tip.className='dq-turn'; tip.textContent='选择武学'; ra.appendChild(tip);
    (unit.artIds||[]).forEach(function(aid){
      var a = unit.isTroop ? (unit.artMap && unit.artMap[aid]) : G.MARTIAL_ARTS.get(aid);
      if(!a) return;
      var b=document.createElement('button'); b.className='act cb-menu skill';
      b.textContent = unit.isTroop
        ? (a.name + '〔军令〕')
        : (a.name + (a.element?('〔'+a.element+'〕'):'') + (a.type==='ultimate'?' · 绝技':(a.type==='tech'?' · 发力':'')));
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
        log('「先按眼下点亮的练——' + (_stp==='attack'?'先点〔攻击〕，试试拳脚！':(_stp==='defend'?'先练〔防御〕，借力卸力！':'攻防皆会、伤也疗了——点〔攻击〕送它散架！')) + '」','npc','韩铁');
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
    if(ctx.armyRoundHook) ctx.armyRoundHook(dqOrders);   // 军队：军令副作用（士气/自损）·冲散·援军到场
    dqPlayLog(pLog, function(){
      if(G.CombatEngine.state.result){ dqFinish(); return; }
      var eLog=G.CombatEngine.runEnemyPhase();
      dqPlayLog(eLog, function(){
        if(G.CombatEngine.state.result){ dqFinish(); return; }
        // v20260924z2：木人桩死物打不倒（hp 9999，本就不是用来击杀的）——
        //   练的是「接得住招」：攻防交手满三回合（round 已整轮+1 至 3）即算练成，按胜利结算，
        //   胜利结算里 jobTick('dummy') 才会给「木人试艺」差役计数。此前只能靠打赢，永无可能。
        var _en=G.CombatEngine.getEnemy();
        if(_en && _en.id==='dummy' && G.CombatEngine.state.round>=3){
          log('你与木人桩拆了三合——桩身不倒，拳脚却已见章法。韩铁远远看着，点了下头。','combat');
          G.CombatEngine.state.result='win';
          dqFinish(); return;
        }
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
    try { if (window.SFX && SFX.setCombatBgm) SFX.setCombatBgm(false); else if (window.SFX && SFX.duckBgm) SFX.duckBgm(false); } catch(e){}  // P2/P3：战后恢复原曲
    if(getCombatMode()===null) return;   // 防止重复调用（如快速连点）
    setCombatMode(null);
    dqPlaySkip=null;                // 战斗结束，清除演出快进钩子
    // 注意：保留 in-combat（含 #lower/#dock 隐藏）直到结算面板被「确认」关闭，
    // 这样方向罗盘不会在战后提前浮现、暗示玩家优先离开场景
    var sceneEl=document.getElementById('scene'); if(sceneEl){ sceneEl.dataset.bg=''; sceneEl.classList.remove('bg-danger'); }
    clearActions();                  // 清除战斗按钮，防止残留可点击
    if(G.CombatEngine && G.CombatEngine.state){ G.CombatEngine.state.result='ended'; } // 标记引擎已结束，阻断重复结算
    // 开场教学战斗：战败/逃跑由韩铁护航，避免新手卡死（仍算教学完成）
    var tutC = getState().flags.onb && getState().flags.onb.tcTutorial && !getState().flags.onb.tcDone;
    if(tutC && result!=='win'){
      if(result==='lose'){ getState().hp = effectiveStats().maxHp; log('韩铁伸手一扶，将你从桩影里拽起：「莫慌，演练罢了——拳脚慢慢练。」','env'); }
      else { log('「罢了，先歇着，拳脚日后再练。」','npc','韩铁'); }
      getState().flags.onb.tcDone=true; getState().flags.onb.tcTutorial=false; getState().defeated=false;
      log('〔教学演练结束——往后真打可没这般好运，记得用药、看敌意。〕','sys');
      save(getState()); renderStatus();
      if(getDqCardEl()){ getDqCardEl().classList.add('settle-win'); }
      playCombatFx('win');
      showCombatSettlement({result:'win', title:'演 练 结 束', sub:'韩铁出手相护，化险为夷。',
        lines:[{text:'教学演练完成——往后真打可没这般好运。'}]}, exitCombatToRoom);
      return;
    }
    // ── 军队作战（攻城 / 守城 / 野战）：交由 War 编排结算（分段推进 · 兵力回扣 · 易帜）──
    if(getPendingArmyBattle && getPendingArmyBattle()){
      save(getState()); renderStatus();
      if(getDqCardEl()) getDqCardEl().classList.add(result==='win'?'settle-win':(result==='lose'?'settle-lose':''));
      playCombatFx(result==='win'?'win':(result==='lose'?'lose':''));
      if(ctx.armyBattleEnd) ctx.armyBattleEnd(result);
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
        log('韩铁拳脚翻飞，所示武功极高深，木人桩应声散架、木屑横飞！','env');
        log('「这便是「演武拳」——拳贵直、劲贵整，记着了？」','npc','韩铁');
        log('【习得】演武拳！（已收入武学，可在「角色」查看）','good');
        log('韩铁拍拍手上的木屑：「拳脚练成了！往后真打——岗哨那边，老子陪你干一票。先去犬舍逗逗那几条恶犬，试试真格的；记着，打不过就〔撤退〕，那也是本事。」','npc','韩铁');
        log('〔教学演练结束——往后真打可没这般好运，记着用药、看清敌意、该撤就撤。〕','sys');
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
      if(tutCombatActive()) summary.lines.push({text:'【习得】演武拳！已收入武学。'});
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

      // ── 副本战果归档（v20260927h）：胜则整房记清剿，此后该房转「已清」并开放「搜检残迹」──
      if(_froom && (_froom._kind || _froom.kind) === 'dungeon'){
        var _dg0 = getState().flags.dungeonCleared || (getState().flags.dungeonCleared = {});
        _dg0[getState().room] = 1;
      }

      if(getDqCardEl()) getDqCardEl().classList.add('settle-win');
      playCombatFx('win');
      SFX.win();
      toast('胜！+'+drop.gold+'银 +'+drop.pot+'潜能');
      // v20260930：此前 onCombatResult 仅在 fled 时回调，导致夺营等剧本战斗「胜/败」均不结算、
      //   回房间后被 onEnter 反复重触发（对话→战斗→对话死循环）。胜/败亦回调，由引擎统一收束毕业。
      try { if (LF.onCombatResult) LF.onCombatResult('win', enemy); } catch(_e) {}
      showCombatSettlement(summary, exitCombatToRoom);
    } else if(result==='lose'){
      getState().hp=1;
      getState().defeated=true;   // 战败标记：封锁一切行动直到休整恢复
      if(getDqCardEl()) getDqCardEl().classList.add('settle-lose');
      playCombatFx('lose');
      SFX.lose();
      toast('败北！气血仅余1点');
      // v20260930：败亦回调 onCombatResult（夺营等剧本战斗会置 escaped 并毕业，避免读档后无限重触发）
      try { if (LF.onCombatResult) LF.onCombatResult('lose', enemy); } catch(_e) {}
      showCombatSettlement({result:'lose', enemyName:enemy.name,
        lines:[{text:'重伤倒地，气若游丝——须先「休整」恢复，方可再动。'}]}, exitCombatToRoom);
    } else if(result==='fled'){
      log('你已脱离战斗，回到原地。','sys');
      toast('已脱离战斗');
      try { if (LF.onCombatResult) LF.onCombatResult('fled', enemy); } catch(_e) {}   // 引擎侧结算钩子（犬舍试手等）
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
    // v20260926a：旧「岗哨战斗路线战后自动毕业」已随决断出营枢纽一并移除（route._pending 不再写入）
    renderRoom(getState().room, true);
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

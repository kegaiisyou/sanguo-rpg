// 乱世烽火 · 战斗视觉特效模块（v20261008q 自 shared/core/combat.js 拆出）
// 飘字 / 受击闪光 / 震屏 / 武器字 / 立绘 / 五行封印 等纯表现层函数。
// 依赖仅三项注入：SFX（音效）、getNarr（叙事区元素）、log（日志），
// 外加 document / Math / setTimeout 等宿主全局；不触碰战斗状态与 G，可独立测试。
(function (global) {
  var LF = global.LF || (global.LF = {});
  LF.createCombatFx = function (ctx) {
    var SFX = ctx.SFX, getNarr = ctx.getNarr, log = ctx.log;

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
    return {
      logHTML: logHTML, logText: logText, combatAnchor: combatAnchor, flashAnchor: flashAnchor,
      floatDamage: floatDamage, floatLabel: floatLabel, critBurst: critBurst, flashHit: flashHit,
      combatAnchorAppend: combatAnchorAppend, popWeapon: popWeapon, floatImpact: floatImpact,
      flashBlock: flashBlock, showDodge: showDodge, shakeScene: shakeScene, weaponSvg: weaponSvg,
      buildPortrait: buildPortrait, markAttack: markAttack, markSceneCrit: markSceneCrit,
      flashSeal: flashSeal
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createCombatFx;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

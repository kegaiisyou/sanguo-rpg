// 模块 companion（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createCompanion = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var G = ctx.G;
    var buildActions = ctx.buildActions;
    var closeModal = ctx.closeModal;
    var log = ctx.log;
    var npcAttitude = ctx.npcAttitude;
    var renderNpcList = ctx.renderNpcList;
    var row = ctx.row;
    var talk = ctx.talk;
    var toast = ctx.toast;

  function recruitCompanion(key){
    var c=COMPANION_DEFS[key]; if(!c){ toast('此人不可招入队中。'); return; }
    if(!S().party) S().party=[];
    if(S().party.some(function(m){ return m.id===c.id; })){ toast(c.name+'已在队中。'); return; }
    S().party.push(Object.assign({}, c));
    if(!S().flags) S().flags={};
    if(!S().flags.recruited) S().flags.recruited={};
    S().flags.recruited[key]=true;   // 标记已招募，NPC 从场景列表中隐去
    save(S());
    if(typeof buildActions==='function') buildActions(G.ROOMS[S().room]);
    log(c.name+'抱拳道：「承蒙看得起，愿随壮士同生共死！」','good');
    toast(c.name+' 加入队伍！');
  }
  function dismissCompanion(id){
    if(!S().party) return;
    var idx=-1;
    for(var i=0;i<S().party.length;i++){ if(S().party[i].id===id){ idx=i; break; } }
    if(idx<0) return;
    var c=S().party[idx];
    S().party.splice(idx,1);
    for(var k in COMPANION_DEFS){ if(COMPANION_DEFS[k].id===id && S().flags && S().flags.recruited){ delete S().flags.recruited[k]; } }
    save(S());
    if(currentModalKind==='party') openModal('party');
    log(c.name+'与你拱手作别，转身没入人海。','sys');
    toast(c.name+' 已离队。');
  }
  function renderPartyPanel(){
    var list=(S().party||[]);
    var html='<h3>队 伍</h3>';
    if(!list.length){
      html+='<p class="tip">你孤身一人行走江湖。江湖儿女中自有可招募之人——留意 NPC 的「邀请入队」。</p>';
    }
    list.forEach(function(c){
      var arts=(c.learnedMartial||[]).map(function(aid){ var a=G.MARTIAL_ARTS.get(aid); return '<span>'+(a?a.name:aid)+'</span>'; }).join('');
      html+='<div style="border:1px solid #6b5a3a;border-radius:10px;padding:10px;margin:8px 0;background:rgba(0,0,0,.18);">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
        +   '<span style="font-weight:700;font-size:15px;">'+(c.name||'同伴')+'</span>'
        +   '<button class="btn-mini" style="background:#7d241d;border-color:#a13a2c;" onclick="LFUI.dismissCompanion(\''+c.id+'\')">解散</button>'
        + '</div>'
        + row('气血', c.hp+' / '+c.maxHp)
        + row('内力', (c.mp||0)+' / '+(c.maxMp||0))
        + row('攻击', c.atk||0)
        + row('防御', c.def||0)
        + row('身法', c.spd||0)
        + row('五行', c.element||'无')
        + '<div class="row"><span>武学</span></div><div class="skills">'+(arts||'<span>未习武学</span>')+'</div>'
        + '<p class="tip">'+((COMPANION_DEFS[c.id]||{}).desc||'每场战斗同伴满血入场，可随你一起出手。')+'</p>'
        + '</div>';
    });
    return html;
  }
  // ===== NPC 给予物品（v20260909u）：选择行囊物品给予NPC，增减好感或触发任务 =====
  var giveNpc = null;
  function openGivePanel(o){
    giveNpc = o;
    openModal('give', {npc: o});
  }
  var giveSelectedIdx = null;
  var giveQty = 1;
  function renderGivePanel(npc){
    if(!npc) return '<h3>给 予</h3><p>未指定对象。</p>';
    var grid='';
    var hasItem=false;
    for(var i=0;i<S().pack.length;i++){
      var it=S().pack[i];
      if(!it){ grid += '<div class="packcell pcell-empty"></div>'; continue; }
      hasItem=true;
      var cnt = (it.count>1)?('<span class="pcell-cnt">'+it.count+'</span>'):'';
      var qb = (it.quality)?('<span class="pcell-qbadge" style="background:'+((LF.ITEMS.QMAP[it.quality]||{}).color||'#9a948a')+'"></span>'):'';
      var sel = (giveSelectedIdx===i)?' give-selected':'';
      grid += '<div class="packcell give-item'+sel+'" data-give-idx="'+i+'">'
            + '<div class="pcell-ic">'+(it.icon||'📦')+'</div>'
            + '<div class="give-item-name">'+it.name+'</div>'
            + cnt + qb + '</div>';
    }
    // 右侧详情
    var detailHTML = '<div class="give-empty-tip">← 点选左侧物品</div>';
    var qtyHTML = '';
    var confirmHTML = '';
    if(giveSelectedIdx!=null && S().pack[giveSelectedIdx]){
      var it = S().pack[giveSelectedIdx];
      var maxQty = it.count || 1;
      if(giveQty > maxQty) giveQty = maxQty;
      if(giveQty < 1) giveQty = 1;
      detailHTML = '<div class="give-d-name">'+(it.icon||'📦')+' '+it.name+'</div>';
      // 类型 + 槽位 + 品质 + 持有数量
      var slotLabel = (it.slot && LF.ITEMS && LF.ITEMS.SLOTS && LF.ITEMS.SLOTS[it.slot]) ? LF.ITEMS.SLOTS[it.slot].label : '';
      var catText = (it.cat||'道具') + (slotLabel?(' · '+slotLabel):'') + (it.qualityName?(' · '+it.qualityName):'') + (maxQty>1?(' · 持有'+maxQty):'');
      detailHTML += '<div class="give-d-cat">'+catText+'</div>';
      if(it.cat==='装备'){
        var fields=[['atk','攻击'],['def','防御'],['spd','身法'],['hp','气血'],['mp','内息'],['wuxing','悟性']];
        var parts=[];
        fields.forEach(function(f){ var v=it[f[0]]||0; if(v) parts.push(f[1]+' +'+v); });
        if(it.packSpace) parts.push('行囊 +'+it.packSpace);
        if(parts.length) detailHTML+='<div class="give-d-line">'+parts.join(' · ')+'</div>';
      }
      if(it.desc) detailHTML+='<div class="give-d-line give-d-desc">'+it.desc+'</div>';
      var estFavor = calcGiveFavor(it) * giveQty;
      detailHTML+='<div class="give-d-favor">预计好感 +'+estFavor+'</div>';
      // 数量选择（仅堆叠物品）
      if(maxQty > 1){
        qtyHTML = '<div class="give-qty-row">'
          + '<span>赠予数量</span>'
          + '<button class="give-qty-btn" id="give-qty-minus">−</button>'
          + '<span class="give-qty-num" id="give-qty-num">'+giveQty+'</span>'
          + '<button class="give-qty-btn" id="give-qty-plus">+</button>'
          + '<button class="give-qty-all" id="give-qty-all">全部</button>'
          + '</div>';
      }
      confirmHTML = '<button class="give-confirm-btn" id="give-confirm">确认赠予 ×'+giveQty+'</button>';
    }
    return '<div class="give-panel">'
      + '<div class="give-head"><span>赠 与</span><span class="give-head-npc">'+npc.name+'</span></div>'
      + '<div class="give-body">'
      +   '<div class="give-left">'
      +     '<div class="give-col-title">行 囊</div>'
      +     '<div class="pack-scroll give-grid-scroll"><div class="pack-grid">'+grid+'</div></div>'
      +     (hasItem?'':'<div class="give-empty">行囊空空，无物可赠。</div>')
      +   '</div>'
      +   '<div class="give-right">'
      +     '<div class="give-col-title">详 情</div>'
      +     '<div class="give-detail-box">'+detailHTML+'</div>'
      +     qtyHTML
      +   '</div>'
      + '</div>'
      + '<div class="give-foot">'
      +   confirmHTML
      +   '<button class="give-cancel-btn" id="give-cancel">取 消</button>'
      + '</div>'
      + '</div>';
  }
  function giveItemToNpc(packIdx, qty){
    if(!giveNpc || !giveNpc.key) return;
    var it = S().pack[packIdx];
    if(!it) return;
    var n = qty || 1;
    var maxQty = it.count || 1;
    if(n > maxQty) n = maxQty;
    var npcKey = giveNpc.key;
    var npcName = giveNpc.name;
    // 从行囊移除物品（批量）
    if(it.count && it.count > n){ it.count -= n; } else { S().pack[packIdx]=null; }
    // 检查 onGive 触发器（任务条件）—— 传递给予数量 qty，支持累计计数
    var triggered = checkTriggers({hook:'onGive', npc:npcKey, room:S().room, item:it, qty:n});
    if(!triggered){
      // 没有特殊触发，根据物品价值增减好感（批量）
      var favor = calcGiveFavor(it) * n;
      if(!S().npcFavor) S().npcFavor = {};
      S().npcFavor[npcKey] = (S().npcFavor[npcKey]||0) + favor;
      var react = giveReaction(npcName, it, favor);
      log(react, 'npc', npcName);
      if(favor>0) log('〔'+npcName+'·好感 +'+favor+'〕','good');
      else if(favor<0) log('〔'+npcName+'·好感 '+favor+'〕','bad');
    }
    save(S());
    renderNpcList();
    giveSelectedIdx = null;
    giveQty = 1;
    // 刷新给予面板
    if(currentModalKind==='give'){
      var card=document.getElementById('modal-card');
      if(card) card.innerHTML = renderGivePanel(giveNpc);
      bindGivePanel();
    }
  }
  function calcGiveFavor(it){
    // 根据物品类型/品质计算好感度变化
    var cat = it.cat || '道具';
    var base = 1;
    if(cat==='装备'){
      var qmult = {white:1, green:3, blue:6, purple:10, orange:15};
      base = 3 + (qmult[it.quality]||1);
    } else if(cat==='药剂'){
      base = 5;
    } else if(cat==='食饵'){
      base = 2;
    } else if(cat==='素材'){
      base = 1;
    } else if(cat==='简册'){
      base = 8;
    } else if(cat==='器具'){
      base = 4;
    }
    // 贵重物品额外加成
    if(it.price && it.price>=50) base += Math.floor(it.price/50);
    return Math.min(30, base);
  }
  function giveReaction(npcName, it, favor){
    if(favor>=15) return npcName+'双眼一亮，双手接过：「壮士厚赠，在下愧不敢当！此恩铭记于心。」';
    if(favor>=8) return npcName+'面露喜色，接过物品：「多谢壮士，此物正中下怀。」';
    if(favor>=3) return npcName+'点点头收下：「有心了。」';
    if(favor>0) return npcName+'淡淡收下，未多言语。';
    return npcName+'皱了皱眉，勉强收下：「此物……也罢。」';
  }
  function bindGivePanel(){
    document.querySelectorAll('.give-item').forEach(function(el){
      el.onclick=function(){
        var idx=parseInt(el.getAttribute('data-give-idx'),10);
        giveSelectedIdx = idx;
        giveQty = 1;
        var card=document.getElementById('modal-card');
        if(card) card.innerHTML = renderGivePanel(giveNpc);
        bindGivePanel();
      };
    });
    var minus=document.getElementById('give-qty-minus');
    if(minus) minus.onclick=function(){
      if(giveQty>1){ giveQty--; refreshGiveDetail(); }
    };
    var plus=document.getElementById('give-qty-plus');
    if(plus) plus.onclick=function(){
      var it = S().pack[giveSelectedIdx];
      var maxQty = it ? (it.count||1) : 1;
      if(giveQty<maxQty){ giveQty++; refreshGiveDetail(); }
    };
    var all=document.getElementById('give-qty-all');
    if(all) all.onclick=function(){
      var it = S().pack[giveSelectedIdx];
      giveQty = it ? (it.count||1) : 1;
      refreshGiveDetail();
    };
    var confirm=document.getElementById('give-confirm');
    if(confirm) confirm.onclick=function(){
      if(giveSelectedIdx!=null) giveItemToNpc(giveSelectedIdx, giveQty);
    };
    var cancel=document.getElementById('give-cancel');
    if(cancel) cancel.onclick=closeModal;
    // 点击遮罩层关闭
    var modal=document.getElementById('modal');
    if(modal){
      modal.onclick=function(e){
        if(e.target===modal) closeModal();
      };
    }
  }
  function refreshGiveDetail(){
    var card=document.getElementById('modal-card');
    if(card) card.innerHTML = renderGivePanel(giveNpc);
    bindGivePanel();
  }
  // ===== NPC 标准操作列：交谈 / 观察 / 给予 / 攻击 + 对象自带动作 =====
  // 教学期是否放行「给予」（v20260915c）：交付类差事如今只认「给予」——zt_food 的结清挂在
  //   triggers.js 的 zt_food_give（hook:'onGive'），「交谈」里已不再自动交付。若连这颗按钮一起
  //   屏蔽，玩家攥着干粮站在周听涛跟前却交不出去，教学链当场断死。故：教学期仅当
  //   「此人正是收件人 + 差事已应下 + 手里确有那份东西 + 尚未结清」时，才放出这一颗按钮。
  function onbGiveUnlocked(o){
    var f=S().flags||{}, t=f.task||{}, onb=f.onb;
    if(!onb || onb.done) return true;              // 已脱籍：照旧全开
    if(!o) return false;
    // 教学链特例（v20260915c）：周听涛收干粮 —— 原判据原样保留
    if(o.key==='zhoutingtao'){
      if(!t.zt_accepted) return false;               // 差事尚未应下，无货可交
      if(f.route && f.route.crypt) return false;     // 密道已得，这桩差事已了
      return !!packFind('fan');                      // 手里得真有那份吃食
    }
    // 泛化（v20260915k）：教学期凡「未结差事的收件人 + 手里确有需要的实物」也放行给予
    //   —— 仓吏收石料/旧物/铜矿、鲁大收野菜……操作菜单直接露出「给予」，
    //   不必先点「交谈」钻进对话面板底栏才能交差（那一步绕得太深，玩家容易以为交不了）。
    //   匹配口径与任务日志一致：q.submit.npc 是显示名/身份（'仓吏'/'鲁大'）。
    //   具名 NPC 的名字就是显示名（鲁大/孙老…）；程序 NPC（storeman 卡生成）名字是随机人名
    //   （丁大牛…），显示身份在 role 字段（'仓吏'）——两者都认。
    var quests=S().quests||[];
    for(var i=0;i<quests.length;i++){
      var q=quests[i];
      if(!q || !q.submit) continue;
      if(q.submit.npc!==o.name && q.submit.npc!==o.role) continue;
      var needItem=(q.need||[]).some(function(nd){ return nd.item && packFind(nd.item); });
      if(needItem) return true;
    }
    return false;
  }
  function buildNpcActions(o){
    var acts=[];
    acts.push({label:'交谈', icon:'💬', fn:function(){ if(o.key) talk(o.key); }});
    // 开场教学链（onb 未完成）期间：仅保留「交谈」，隐藏「观察」「攻击」，避免新手误触/无意义选项
    var onboarding = !!(S().flags && S().flags.onb && !S().flags.onb.done);
    if(!onboarding){
      acts.push({label:'观察', icon:'👁', fn:function(){ observeNpc(o); }});
    }
    if(onbGiveUnlocked(o)){
      acts.push({label:'给予', icon:'🎁', fn:function(){ openGivePanel(o); }});
    }
    if(!onboarding){
      var dangerAct=(o.actions||[]).filter(function(a){return a.danger;})[0];
      acts.push({label:'攻击', icon:'⚔', danger:true, fn:function(){
        if(dangerAct){ dangerAct.fn(); return; }
        var eid = (G.ENEMIES && G.ENEMIES[o.key]) ? o.key : (NPC_COMBAT_MAP[o.key] || null);
        if(eid && G.ENEMIES[eid]){ startCombat(eid); return; }
        log('〔'+o.name+'〕你按捺住杀机——此人并无敌意，不便妄动刀兵。','sys');
      }});
    }
    (o.actions||[]).forEach(function(a){
      if(a.danger) return;                       // 敌意动作已并入「攻击」
      if(/交谈|观察|给予/.test(a.label||'')) return;  // 去重标准项
      acts.push(a);
    });
    return acts;
  }
  function observeNpc(o){
    var key=o.key, parts=[];
    if(o.desc) parts.push(o.desc);
    if(key && G.DIALOGUES.npcs[key]) parts.push('当前态度：'+npcAttitude(key));
    else if(key && NPC_BY_KEY[key]){
      // 程序 NPC：显示身份与「你与他」的交情（每个 NPC 一本账，见 npcFavor）
      if(o.role) parts.push('身份：'+o.role);
      var _fv=npcFavor(key);
      parts.push('与你的交情：'+npcFavorTier(_fv).name+(S().npcFavor&&S().npcFavor[key]?'（'+(_fv>0?'+':'')+_fv+'）':''));
    }
    // 掉落预览：NPC 对应敌人模板有掉落表时，展示可能掉落的物资/装备（战前情报）
    var eid = (G.ENEMIES && G.ENEMIES[key]) ? key : ((NPC_COMBAT_MAP[key]||[])[0] || null);
    if(eid && G.ENEMIES[eid] && G.ENEMIES[eid].drop){
      var d=G.ENEMIES[eid].drop, dr=[];
      if(d.gold && d.gold[1]>0) dr.push('银两'+d.gold[0]+'~'+d.gold[1]);
      if(d.pot && d.pot[1]>0) dr.push('粮草'+d.pot[0]+'~'+d.pot[1]);
      (d.table||[]).forEach(function(t){ dr.push(t.name+'（'+(t.weight||0)+'%）'); });
      if(d.equip && d.equip.chance>0){
        var QR={0:['凡品','良品'],1:['凡品','精良'],2:['良品','珍稀'],3:['精良','神兵'],4:['珍稀','神兵']};
        var rng=QR[d.equip.tier]||['',''];
        dr.push((rng[0]?rng[0]+'~'+rng[1]+'装备':'装备')+'（'+(d.equip.chance||0)+'%）');
      }
      if(dr.length) parts.push('可能掉落：'+dr.join('、'));
    }
    if(!parts.length) parts.push('你凝神打量，未见异常。');
    log('〔观察·'+o.name+'〕'+parts.join('；')+'。','sys');
  }
  // ===== 常驻移动区：Dock 上方方向罗盘（位置即方位，永远可见） =====
  var DIR_ARROW={'北':'↑','南':'↓','东':'→','西':'←','东北':'↗','西北':'↖','东南':'↘','西南':'↙'};
  // 方向 → 罗盘 3×3 网格坐标 [行,列]（上北下南左西右东）
  var DIR_GRID={'北':[1,2],'东北':[1,3],'东':[2,3],'东南':[3,3],'南':[3,2],'西南':[3,1],'西':[2,1],'西北':[1,1]};
    return {
      DIR_ARROW, DIR_GRID, bindGivePanel, buildNpcActions,
      calcGiveFavor, dismissCompanion, giveItemToNpc, giveNpc,
      giveQty, giveReaction, giveSelectedIdx, observeNpc,
      onbGiveUnlocked, openGivePanel, recruitCompanion, refreshGiveDetail,
      renderGivePanel, renderPartyPanel,
    };
  };
})(typeof window !== 'undefined' ? window : global);

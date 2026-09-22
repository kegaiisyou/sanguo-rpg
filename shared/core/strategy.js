// 战略层 · 外交/战争/朔日结算（从 engine.js 拆分，v20260918k）
// 依赖经 ctx 注入：getState（惰性，state 在 enterGame/load 时被重赋值 → 函数内一律 S()）；
// LF（LF.FACTIONS/LF.CITIES）；引擎函数 log/toast/save/renderStatus/openModal/escapeHtml；
// 城市系统 conquerCity/playerFaction/cityOwnerOf/cityDevOf/setCityDev/isCityGrid；
// 大事记 chronicle/chronicleList；职种 roleAtkMul/roleEconMul/roleFavorMul/roleDef。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createStrategy = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var log = ctx.log, toast = ctx.toast, save = ctx.save, renderStatus = ctx.renderStatus, openModal = ctx.openModal;
    var conquerCity = ctx.conquerCity, playerFaction = ctx.playerFaction;
    var cityOwnerOf = ctx.cityOwnerOf, cityDevOf = ctx.cityDevOf, setCityDev = ctx.setCityDev, isCityGrid = ctx.isCityGrid;
    var chronicle = ctx.chronicle, chronicleList = ctx.chronicleList, escapeHtml = ctx.escapeHtml;
    var roleAtkMul = ctx.roleAtkMul, roleEconMul = ctx.roleEconMul, roleFavorMul = ctx.roleFavorMul, roleDef = ctx.roleDef;
    var Officers = ctx.Officers || null;
  // ══ 玩家外交系统（v20260918h）══
  function diploGet(fid){ return (S().flags.diplo && S().flags.diplo[fid]) || null; }
  function diploStatus(fid){ var d=diploGet(fid); return d? d.status : 'war'; }
  function diploActive(fid){ var d=diploGet(fid); return !!(d && d.status!=='war' && d.until > (S().flags._monthKey||0)); }
  function diploTruceBetween(ka,kb){
    if(ka==='player' && kb!=='player' && kb!=='han') return diploActive(kb);
    if(kb==='player' && ka!=='player' && ka!=='han') return diploActive(ka);
    return false;
  }
  function diploExpire(){
    if(!S() || !S().flags || !S().flags.diplo) return;
    var mk=S().flags._monthKey||0;
    Object.keys(S().flags.diplo).forEach(function(fid){
      var d=S().flags.diplo[fid];
      if(d.status!=='war' && d.until<=mk){
        delete S().flags.diplo[fid];
        log('〔外交〕你与'+warFactionName(fid)+'的盟约期满，刀兵再起。','sys');
      }
    });
  }
  function diploPropose(fid, kind){
    if(!S()||S().dead) return;
    if(fid==='player'||fid==='han'){ toast('汉室与己方，无须此道。'); return; }
    var f=(LF.FACTIONS||{})[fid]; if(!f){ toast('此势力已不复存在。'); return; }
    if(diploStatus(fid)==='alliance'){ toast('已与'+f.name+'结盟。'); return; }
    var mk=(S().flags._monthKey||0);
    if(kind==='truce'){
      if((S().gold||0)<50){ toast('府库空虚，无金缔和。'); return; }
      if((S().reputation||0)<10){ toast('声名不彰，对方不屑言和。'); return; }
      S().gold-=50; S().flags.diplo=S().flags.diplo||{};
      S().flags.diplo[fid]={status:'truce',until:mk+3};
      log('〔外交〕你遣使与'+f.name+'议定休战，三月之内兵戈不兴。','good'); toast('🤝 与'+f.name+'休战');
    } else if(kind==='alliance'){
      if((S().gold||0)<200){ toast('盟金不足（需💰200）。'); return; }
      if((S().reputation||0)<30){ toast('威望不足（需声望30），无人肯盟。'); return; }
      S().gold-=200; S().flags.diplo=S().flags.diplo||{};
      S().flags.diplo[fid]={status:'alliance',until:mk+9};
      log('〔外交〕你与'+f.name+'义结金兰，共抗天下。','good'); toast('🤝 与'+f.name+'结盟');
    }
    save(S()); openModal('factionMap');
  }
  function diploSue(cid){
    if(!S()||S().dead) return;
    var C=LF.CITIES||{}, c=C[cid]; if(!c) return;
    var defKey=warOwnerKey(cid);
    if(defKey==='player'){ toast('此城已为你所治。'); return; }
    if(!LF.FACTIONS[defKey]){ toast('此城为无主/地方群豪，直取可也。'); return; }
    var power=warCityPower(cid);
    var rep=(S().reputation||0);
    var p=0.30 + rep/200*0.5 + (roleFavorMul()-1)*0.4 - Math.min(0.5, power/120);
    p=Math.max(0.05, Math.min(0.95, p));
    if(Math.random()<p){
      conquerCity(cid, playerFaction(), +6);   // 与攻城同源：owner 用 playerFaction()（'义军'），否则 ruledCities 不更新、招降之城不入治下
      chronicle('你遣说客劝降「'+c.name+'」，守将倒戈，不血刃而下。','good');
      log('〔招降〕'+c.name+'守将归降，城池易帜。','good'); toast('🏳 '+c.name+'归降');
    } else {
      log('〔招降〕'+c.name+'守将不从，城头箭如雨下，说客狼狈而归。','sys'); toast(c.name+'守将不从');
    }
    save(S()); openModal('factionMap');
  }
  function renderDiplomacy(fid){
    var f=(LF.FACTIONS||{})[fid]; if(!f) return '';
    var st=diploStatus(fid);
    var stTxt={war:'敌对',truce:'休战',alliance:'同盟',vassal:'附庸'}[st]||'敌对';
    var d=diploGet(fid), until=(d&&d.until)||0, mk=(S().flags._monthKey||0);
    var h='<div class="dip-box">';
    h+='<div class="dip-h">🕊 与 '+f.name+' 之邦交</div>';
    h+='<div class="dip-sub">现状：<b>'+stTxt+'</b>'+(st!=='war'&&until>mk?('（约至第'+Math.round(until*30)+'日）'):'')+'</div>';
    h+='<div class="dip-acts">';
    if(st==='war'){
      h+='<button class="btn" onclick="diploPropose(\''+fid+'\',\'truce\')">🤝 议和<br><span class="sub">💰50·声望10·休战3月</span></button>';
      h+='<button class="btn" onclick="diploPropose(\''+fid+'\',\'alliance\')">🤝 结盟<br><span class="sub">💰200·声望30·休战9月</span></button>';
    } else {
      h+='<div class="dip-cur">当前已'+stTxt+'，刀兵暂歇。</div>';
    }
    h+='</div>';
    var ids=Object.keys(LF.CITIES||{}).filter(function(cc){ return warOwnerKey(cc)===fid; });
    if(ids.length){
      h+='<div class="dip-cities-h">说降其城（不战而下）：</div><div class="dip-cities">';
      ids.forEach(function(cc){ var c2=(LF.CITIES||{})[cc]||{}; h+='<button class="btn sm" onclick="diploSue(\''+cc+'\')">🏳 '+c2.name+'</button>'; });
      h+='</div>';
    }
    h+='<div class="dip-foot">金帛动人心，威望服诸侯；说客一去，不战屈人之兵。</div>';
    h+='</div>';
    return h;
  }
  function openDiplomacy(fid){
    if(!S()) return;
    S().flags._dipFid=fid;
    openModal('diplomacy');
  }
  // ── 身份 / 势力系统（v20260826g）：政令台 + 势力图 ──
  function factionName(id){
    if(id==='义军'||id==='player') return (LF.FACTIONS&&LF.FACTIONS.player)?LF.FACTIONS.player.name:'义军';
    if(id==='汉'||id==='han') return (LF.FACTIONS&&LF.FACTIONS.han)?LF.FACTIONS.han.name:'汉室';
    var f=(LF.FACTIONS||{})[id]; return f?f.name:id;
  }
  function factionColor(id){
    if(id==='义军'||id==='player') return (LF.FACTIONS&&LF.FACTIONS.player)?LF.FACTIONS.player.color:'#3a3a3a';
    if(id==='汉'||id==='han') return (LF.FACTIONS&&LF.FACTIONS.han)?LF.FACTIONS.han.color:'#7d6a2e';
    var f=(LF.FACTIONS||{})[id]; return f?f.color:'#888';
  }
  function civilEdict(kind){
    var cid=S().room;
    if(!isCityGrid(cid)) return;
    if(cityOwnerOf(cid)!==playerFaction()){ toast('你并非此城之主，何谈政令？'); return; }
    var c=(LF.CITIES||{})[cid]||{};
    if(kind==='tax'){
      var last=(S().flags.cityTax||{})[cid];
      if(last===S().day){ toast('今日已在此征过税赋。'); return; }
      var gain=Math.round((c.pop+c.commerce)/12)+5;
      S().gold+=gain;
      S().flags.cityTax=S().flags.cityTax||{}; S().flags.cityTax[cid]=S().day;
      S().flags.cityOrder=S().flags.cityOrder||{};
      var ord=(S().flags.cityOrder[cid]!=null?S().flags.cityOrder[cid]:c.order)-4;
      S().flags.cityOrder[cid]=Math.max(0,ord);
      log('你颁下政令，差役挨户征缴。'+c.name+'岁入 💰'+gain+' 两，然胥吏扰民，治安略降。','sys');
      toast('征得 💰'+gain+' 两');
    } else if(kind==='pacify'){
      if(S().gold<20){ toast('府库空虚，无银安民。'); return; }
      S().gold-=20;
      S().flags.cityOrder=S().flags.cityOrder||{};
      var o2=(S().flags.cityOrder[cid]!=null?S().flags.cityOrder[cid]:c.order)+6;
      S().flags.cityOrder[cid]=Math.min(100,o2);
      log('你开仓赈济、张贴安民告示，'+c.name+'百姓稍安，治安渐复。','good');
      toast('安民：治安 +6');
    }
    renderStatus(); save(S()); openModal('edict');
  }
  function renderEdict(){
    var cid=S().room; if(!isCityGrid(cid)) return '';
    var c=(LF.CITIES||{})[cid]||{};
    var ord=(S().flags.cityOrder&&S().flags.cityOrder[cid]!=null)?S().flags.cityOrder[cid]:c.order;
    var taxReady=(S().flags.cityTax||{})[cid]!==S().day;
    var taxTip=taxReady?('可征 💰'+(Math.round((c.pop+c.commerce)/12)+5)+' 两'):'今日已征';
    var h='';
    h+='<div class="edict-box">';
    h+='<div class="edict-h">📜 '+c.name+' · 政令台</div>';
    h+='<div class="edict-sub">官职：'+(S().title||'游侠')+'　｜　势力：'+factionName(playerFaction())+'　｜　职种：'+roleDef().icon+' '+roleDef().name+'　｜　治安：'+ord+'</div>';
    h+='<div class="edict-acts">';
    h+='<button class="btn" onclick="civilEdict(\'tax\')">💰 征税<br><span class="sub">'+taxTip+'</span></button>';
    h+='<button class="btn" onclick="civilEdict(\'pacify\')">🤝 安民<br><span class="sub">耗💰20，治安+6</span></button>';
    h+='<button class="btn" onclick="openModal(\'factionMap\')">🏴 大势<br><span class="sub">观天下势力</span></button>';
    h+='<button class="btn" onclick="openModal(\'army\')">🛡 治军<br><span class="sub">点兵编成·辎重调遣</span></button>';
    h+='</div>';
    h+='<button class="btn" onclick="openOfficerPanel()">🎖 武将<br><span class="sub">登庸·郡守·主将</span></button>';
    h+='<div class="edict-foot">立于中枢、城归你所统，方能发号。占城即得官职，聚财养士。</div>';
    h+='</div>';
    return h;
  }
  function renderFactionMap(){
    var groups={};
    var keys=Object.keys(LF.CITIES||{});
    keys.forEach(function(cid){
      var owner=cityOwnerOf(cid);
      var fid=(owner==='义军'||owner==='player')?'player':owner;
      if(!groups[fid]) groups[fid]={fid:fid, cities:[]};
      groups[fid].cities.push((LF.CITIES[cid]||{}).name||cid);
    });
    var order=['han','dongzhuo','yuanshao','caocao','sunce','liubiao','liuzhang','gongsun','matang','player'];
    var h='';
    h+='<div class="faction-map">';
    h+='<div class="fm-h">🏴 天下大势 · 群雄割据</div>';
    order.forEach(function(fid){
      var g=groups[fid]; if(!g) return;
      var f=(LF.FACTIONS||{})[fid]||{name:fid, color:'#888', desc:''};
      h+='<div class="fm-row">';
      h+='<div class="fm-lord"><span class="fm-dot" style="background:'+f.color+'"></span><b>'+f.name+'</b>'+(f.lord?'　<small>主君 '+f.lord+'</small>':'')+(fid!=='player'&&fid!=='han'?'　<button class="btn sm" onclick="openDiplomacy(\''+fid+'\')">🕊 外交</button>':'')+'</div>';
      h+='<div class="fm-cities">'+g.cities.join('、')+'</div>';
      h+='<div class="fm-desc">'+f.desc+'</div>';
      h+='</div>';
    });
    var _cl = chronicleList().slice(0, 8);   // 群雄逐鹿 · 烽火递报（v20260909o）
    if (_cl.length) {
      h += '<div class="fm-war"><div class="fm-war-h">🗞 烽火递报 · 天下易帜</div>';
      _cl.forEach(function (e) {
        var _c = e.k === 'danger' ? '#d2694a' : (e.k === 'good' ? '#86b087' : (e.k === 'war' ? '#c9a45a' : '#b9ad92'));
        h += '<div class="fm-war-i" style="color:' + _c + '"><span style="opacity:.6;">第' + e.d + '日</span>　' + escapeHtml(e.t) + '</div>';
      });
      h += '</div>';
    }
    h += '<div class="fm-foot">你治下：' + ((S().ruledCities || []).length) + ' 城　｜　官职：' + (S().title || '游侠') + '　｜　职种：'+roleDef().icon+' '+roleDef().name+'　｜　势力：' + factionName(playerFaction()) + '　｜　(攻城略地、诸侯互伐皆令版图易色)</div>';
    h+='</div>';
    return h;
  }
  // ══ 群雄逐鹿 · NPC 势力互伐与事件攻伐（v20260909o）══
  // 归属可动态变更的发动机：
  //  · 唯一写入口 conquerCity（见 city.js）——玩家攻城(siegeWin)/NPC 互伐/事件攻伐全部汇流至此；
  //  · 自动逐鹿：每次「过天」有低概率在相邻异势力城市间爆发一役，胜者易帜，写入天下大势大事记；
  //  · 事件驱动：剧情/数据脚本可随时 window.warlordBattle(cid, attackerId, opts) 指定一场攻伐。
  // 护栏（自动模式）：不攻都城(皇宫)/不灭有主势力的孤城/玩家立身之城不惊扰；
  //                 事件层经 opts.allowCapital / allowLast / allowInside 可显式破局。
  var WAR_ADJ_KM = 420;   // 邻接判距（两城城廓互为攻伐的方圆半径，公里）
  var warAdjPairs = null;
  function warKm(lng1, lat1, lng2, lat2) {
    var R = 6371, dLng = (lng2 - lng1) * Math.PI / 180, dLat = (lat2 - lat1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function warCityAdjPairs() {
    if (warAdjPairs) return warAdjPairs;
    warAdjPairs = [];
    var C = LF.CITIES || {}, ids = Object.keys(C);
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
      var a = C[ids[i]], b = C[ids[j]];
      if (!a.pos || !b.pos || a.pos.length < 2 || b.pos.length < 2) continue;
      if (warKm(a.pos[0], a.pos[1], b.pos[0], b.pos[1]) <= WAR_ADJ_KM) warAdjPairs.push([ids[i], ids[j]]);
    }
    return warAdjPairs;
  }
  // 归属的「势力键」：玩家义旗归一为 player；其余保留数据键（未知键 = 地方群豪/无主）
  function warOwnerKey(cid) { var o = cityOwnerOf(cid); return (o === '义军' || o === 'player') ? 'player' : o; }
  function warIsLordKey(fid) { return !!(LF.FACTIONS && LF.FACTIONS[fid]) && fid !== 'han' && fid !== 'player'; }
  function warFactionName(fid) {
    if (fid === 'player') return factionName('player');
    if (fid === 'han' || fid === '汉') return factionName('han');
    var f = (LF.FACTIONS || {})[fid];
    return f ? (f.name || fid) : (fid && fid !== 'none' ? '地方群豪' : '无主之地');
  }
  function warCityPower(cid) {
    var c = (LF.CITIES || {})[cid] || {};
    var dev = 0; try { dev = cityDevOf(cid); } catch (e) {}
    return (c.wall || 40) * 1.2 + (c.pop || 40) * 0.6 + (c.commerce || 40) * 0.3 + dev * 0.06;
  }
  function warFactionTotal(fid) {
    var sum = 0, C = LF.CITIES || {}, ids = Object.keys(C);
    for (var i = 0; i < ids.length; i++) if (warOwnerKey(ids[i]) === fid) sum += warCityPower(ids[i]);
    return sum;
  }
  function warFactionCityCount(fid) {
    var n = 0, C = LF.CITIES || {}, ids = Object.keys(C);
    for (var i = 0; i < ids.length; i++) if (warOwnerKey(ids[i]) === fid) n++;
    return n;
  }
  function warInRoom(cid) { try { return !!S() && S().room === cid; } catch (e) { return false; } }
  // 势力兵力：玩家读军队系统，NPC 读 factionAssets（v20260921a）——「养兵」自此真的影响天下大势
  function factionTroops(fid) {
    if (fid === 'player') { try { return ctx.getArmyTroops ? ctx.getArmyTroops() : 0; } catch (e) { return 0; } }
    return ((S().flags.factionAssets || {})[fid] || {}).troops || 0;
  }
  // ── 战事执行：校验过后的单役结算；返回 {win, city, atk, def} 或 null ──
  function runWarlordBattle(targetCid, attackerFid) {
    if (!S() || S().dead) return null;    if (!S().flags.factionWarHit) S().flags.factionWarHit = {};
    S().flags.factionWarHit[targetCid] = true;   // 兵锋所及，民生凋敝（当月不发展）

    var C = LF.CITIES || {}, tc = C[targetCid];
    if (!tc) return null;
    var city = tc.name || targetCid;
    var defKey = warOwnerKey(targetCid);
    var atkT = factionTroops(attackerFid);                                     // 兵在册，势自盛（v20260921a）
    var defT = factionTroops(defKey);
    var atk = (warFactionTotal(attackerFid) + atkT * 2.2) * (0.6 + Math.random() * 0.2);   // 举国之力的一支偏师
    if (attackerFid === 'player') atk *= roleAtkMul();   // 职种：将才攻势更盛（v20260918h）
    var def = (warCityPower(targetCid) + defT * 1.1) * (1.1 + Math.random() * 0.2);          // 据城而守，一夫当关
    var defReal = !!(LF.FACTIONS && LF.FACTIONS[defKey]);
    if (defReal) def += warFactionTotal(defKey) * 0.1;                        // 邻郡/本州驰援之师
    var atkRoll = atk * (0.85 + Math.random() * 0.3);
    var win = atkRoll >= def;
    if (Math.random() < 0.13) win = !win;                                     // 乱世无常，胜败难料
    if (win) conquerCity(targetCid, attackerFid, -5);
    return { win: win, city: city, atk: attackerFid, atkName: warFactionName(attackerFid), def: defKey, defName: warFactionName(defKey), wasPlayerCity: (defKey === 'player') };
  }
  function warChronicleEntry(r) {
    if (!r || !r.win) return;
    chronicle(r.atkName + '军攻取「' + r.city + '」（旧属' + r.defName + '），易帜改换门庭。', 'war');
    if (r.wasPlayerCity) chronicle('噩耗：你治下「' + r.city + '」被' + r.atkName + '军攻陷！', 'danger');
  }
  // ── 事件/剧情接口：指定一场攻伐 ──
  // 例：warlordBattle('luoyang','caocao') / warlordBattle('xuchang','dongzhuo',{allowLast:true})
  // 返回 {ok:boolean, win?:boolean, reason?:string}；攻取成功即易帜并入大事记。
  function warlordBattle(targetCid, attackerFid, opt) {
    opt = opt || {};
    var C = LF.CITIES || {};
    var tc = C[targetCid];
    if (!S() || S().dead) return { ok: false, reason: '无可攻之人' };
    if (!tc) return { ok: false, reason: '此城不在版图之内' };
    if (!warIsLordKey(attackerFid)) return { ok: false, reason: '攻方须为一镇诸侯' };
    var defKey = warOwnerKey(targetCid);
    if (defKey === attackerFid) return { ok: false, reason: '同室不操戈' };
    if (opt.allowCapital !== true && tc.tier === 'capital') return { ok: false, reason: '王都重地，非举事所能轻动' };
    var defReal = !!(LF.FACTIONS && LF.FACTIONS[defKey]);
    if (opt.allowLast !== true && defReal && defKey !== 'player' && warFactionCityCount(defKey) <= 1)
      return { ok: false, reason: (warFactionName(defKey) + '仅余孤城，守军死志犹坚') };
    if (opt.allowInside !== true && warInRoom(targetCid)) return { ok: false, reason: '你正身处此城，兵锋未至' };
    var r = runWarlordBattle(targetCid, attackerFid);
    if (!r) return { ok: false, reason: '战事未起' };
    log((r.win ? '〔攻伐〕' + r.atkName + '军攻取「' + r.city + '」，' : '〔攻伐〕' + r.atkName + '军进兵「' + r.city + '」，守军力战拒之。'), r.wasPlayerCity ? 'combat' : 'sys');
    if (r.win) {
      warChronicleEntry(r);
      if (r.wasPlayerCity) {
        toast('🏴 噩耗：' + r.city + '失守！');
        if (!S().ruledCities || !S().ruledCities.length)
          log('你名下已无统辖之城——天下虽大，暂无可发号之地。', 'sys');
      }
      save(S());
    }
    return { ok: r.win, win: r.win, city: r.city, atk: attackerFid, def: r.def };
  }
  // ── 自动逐鹿：过天轮转 ──
  // 频率约为「数日一役」，胜负均入大事记由「天下大势」公示；只惊扰玩家相关战事。
  function warlordDayTick(crossings) {
    if (!S() || S().dead) return;
    S().flags = S().flags || {};
    var cool = (S().flags.warCool || 0) - (crossings || 1);
    if (cool > 0) { S().flags.warCool = cool; return; }
    S().flags.warCool = 1 + Math.floor(Math.random() * 3);   // 战后暂歇数日
    if (Math.random() >= 0.45) return;                          // 半数日辰，干戈未动
    var idsAll = Object.keys(LF.CITIES || {}), counts = {};
    for (var x = 0; x < idsAll.length; x++) {   // 全域统计城数（顺带统一种子 flags.cityOwner）
      var _k = warOwnerKey(idsAll[x]);
      counts[_k] = (counts[_k] || 0) + 1;
    }
    var pairs = warCityAdjPairs(), cands = [], defendCands = [];
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i][0], b = pairs[i][1];
      var ka = warOwnerKey(a), kb = warOwnerKey(b);
      if (ka === kb) continue;
      var ha = warIsLordKey(ka), hb = warIsLordKey(kb);
      if (!ha && !hb) continue;                                  // 两侧皆非豪强 → 无人举兵
      if (diploTruceBetween(ka, kb)) continue;                   // 外交：休战/同盟期间不互攻（v20260918h）
      if (warInRoom(a) || warInRoom(b)) {                        // 玩家立足之处，兵锋暂缓
        var _pc = warInRoom(a) ? a : b;                          // 但若所指正是你治下之城 → 升格为「守城战」
        if (warOwnerKey(_pc) === 'player') {
          var _att = warInRoom(a) ? kb : ka;
          if (warIsLordKey(_att)) defendCands.push({ target: _pc, atk: _att });
        }
        continue;
      }
      var dirs = [];
      if (ha) dirs.push({ atk: ka, tid: b });                    // a 之主人攻 b
      if (hb) dirs.push({ atk: kb, tid: a });
      for (var d = 0; d < dirs.length; d++) {
        var tid = dirs[d].tid, tc = (LF.CITIES || {})[tid];
        if (tc && tc.tier === 'capital') continue;               // 不攻都城（皇宫所在）
        var tkey = warOwnerKey(tid);
        var treal = !!(LF.FACTIONS && LF.FACTIONS[tkey]);
        if (treal && tkey !== 'player' && (counts[tkey] || 0) <= 1) continue; // 不灭有主孤城
        cands.push({ target: tid, atk: dirs[d].atk });
      }
    }
    // 玩家亲历的守城战 → 走战术战斗；无军可用则退回后台掷骰（v20260921a）
    if (defendCands.length) {
      var dpick = defendCands[Math.floor(Math.random() * defendCands.length)];
      var dok = false;
      try { dok = !!(ctx.startDefendBattle && ctx.startDefendBattle(dpick.target, dpick.atk)); } catch (e) { dok = false; }
      if (!dok) {
        var dr = runWarlordBattle(dpick.target, dpick.atk);
        if (dr) { warChronicleEntry(dr); if (dr.wasPlayerCity && !dr.win) log('〔狼烟〕' + dr.atkName + '军来犯你治下「' + dr.city + '」，守军力战，未能破城。', 'sys'); }
      }
      S().flags.warCool = 2; save(S()); return;
    }
    if (!cands.length) return;
    var pick = cands[Math.floor(Math.random() * cands.length)];
    var r = runWarlordBattle(pick.target, pick.atk);
    if (r && r.win) {
      warChronicleEntry(r);
      if (r.wasPlayerCity) {
        log('〔噩耗〕' + r.atkName + '军攻陷你治下「' + r.city + '」！', 'combat');
        toast('🏴 噩耗：' + r.city + '失守！');
        if (!S().ruledCities || !S().ruledCities.length)
          log('你名下已无统辖之城——天下虽大，暂无可发号之地。', 'sys');
      }
      save(S());
    } else if (r && r.wasPlayerCity) {
      log('〔狼烟〕' + r.atkName + '军来犯你治下「' + r.city + '」，守军力战，未能破城。', 'sys');
    }
  }

  // ══ 战略层 · 朔日结算（v20260918g）══
  // 叠在现有「耗时辰」连续模型之上：不改用命令书，只在每月边界自动结算一次，
  // 让时间真正按月推进——治下纳赋、群雄内政、势力存亡、天下一统都挂在月结上。
  // 月度边界由日历派生（1 农历月 = 30 天）判定；首月只记锚点不结算，避免开局即算。
  function onMonthTick(cal) {
    if (!S() || S().dead) return;
    var ym = cal.eraName + cal.eraYear + '年·' + cal.monthName + '月';
    log('〔朔日〕' + ym + '——时序更迭，天下大势暗流涌动。', 'sys');
    monthlyYield();
    factionDomesticAI();
    scanFactionSurvival();
    diploExpire();            // 外交盟约到期清算（v20260918h）
    checkUnify();
    if ((cal.month % 3) === 1) {
      var rk = (S().flags.factionPowerRank || []);
      if (rk.length) {
        var top = rk.slice(0, 3).map(function (r) { return r.name + '(' + r.cities + '城)'; }).join('、');
        log('〔大势〕群雄之势——' + top + ' 渐成气候。', 'sys');
      }
    }
    if (typeof save === 'function') save(S());
  }
  function monthlyYield() {
    var rc = S().ruledCities;
    if (!rc || !rc.length) return;
    var dev = S().flags.cityDev || {};
    var total = 0;
        var em = roleEconMul();
    rc.forEach(function (cid) { total += Math.round((dev[cid] || 0) * 0.6 * em); });
    if (total > 0) {
      S().gold = (S().gold || 0) + total;
      log('〔府库〕治下 ' + rc.length + ' 城纳赋，得银 ' + total + ' 两。', 'sys');
    }
  }
  function factionDomesticAI() {
    if (!S() || S().dead) return;
    var F = S().flags; F.factionAssets = F.factionAssets || {}; F.factionWarHit = F.factionWarHit || {};
    var C = LF.CITIES || {}, byFaction = {};
    Object.keys(C).forEach(function (cid) {
      var k = warOwnerKey(cid);
      if (k === 'han' || k === 'player') return;
      (byFaction[k] = byFaction[k] || []).push(cid);
    });
    var rank = [];
    Object.keys(byFaction).forEach(function (fid) {
      if (!warIsLordKey(fid)) return;
      var cities = byFaction[fid], asset = F.factionAssets[fid] = F.factionAssets[fid] || { gold: 300, troops: 0 };
      var grown = 0;
      cities.forEach(function (cid) {
        var c = C[cid] || {};
        var g = F.factionWarHit[cid] ? 0 : (0.3 + (((c.agri || 40) + (c.commerce || 40)) / 200) * 0.9) * (Officers ? Officers.garrisonCivilBonus(cid) : 1);
        var before = cityDevOf(cid);
        var after = Math.min(100, before + g);
        if (after > before) { setCityDev(cid, after); grown += (after - before); }
        asset.gold = (asset.gold || 0) + Math.round(before * 0.04 + ((c.agri || 40) + (c.commerce || 40)) * 0.12);
      });
      asset.troops = (asset.troops || 0) + Math.round(grown * 4 + cities.length * 3);
      // 群雄亦募兵：府库充盈则以银募卒，兵力自此成为攻伐的真实筹码（v20260921a）
      if ((asset.gold || 0) > 400 && (asset.troops || 0) < cities.length * 240) {
        var buy = Math.min(Math.floor(((asset.gold || 0) - 300) / 8), 80);
        if (buy > 0) { asset.gold = (asset.gold || 0) - buy * 8; asset.troops = (asset.troops || 0) + buy; }
      }
      asset.cities = cities.length;
      rank.push({ fid: fid, name: warFactionName(fid), power: warFactionTotal(fid), cities: cities.length });
    });
    // 玩家兵力并入势力资产，供攻伐结算与天下大势读取（v20260921a）
    var _pa = F.factionAssets['player'] = F.factionAssets['player'] || { gold: 0, troops: 0 };
    _pa.troops = factionTroops('player');
    _pa.cities = (S().ruledCities || []).length;
    rank.sort(function (a, b) { return b.power - a.power; });
    F.factionPowerRank = rank;
    // 玩家治下城：随月发展（战乱城停滞），受相才加成（v20260918h）
    (S().ruledCities||[]).forEach(function(cid){
      if (F.factionWarHit[cid]) return;
      var c=C[cid]||{}, g=(0.3+(((c.agri||40)+(c.commerce||40))/200)*0.9)*roleEconMul()*(Officers?Officers.civilBonus(cid):1);
      var before=cityDevOf(cid), after=Math.min(100,before+g);
      if(after>before) setCityDev(cid,after);
    });
    F.factionWarHit = {};
  }
  function scanFactionSurvival() {
    var F = S().flags; F.factionDead = F.factionDead || {}; F.factionEverHeld = F.factionEverHeld || {};
    var counts = {};
    Object.keys(LF.CITIES || {}).forEach(function (c) { var k = warOwnerKey(c); counts[k] = (counts[k] || 0) + 1; });
    Object.keys(LF.FACTIONS || {}).forEach(function (fid) {
      if (fid === 'han' || fid === 'player') return;
      var n = counts[fid] || 0;
      if (n > 0) { F.factionEverHeld[fid] = true; F.factionDead[fid] = false; }
      else if (F.factionEverHeld[fid] && !F.factionDead[fid]) {
        F.factionDead[fid] = true;
        var nm = (LF.FACTIONS[fid] || {}).name || fid;
        chronicle(nm + '势力土崩瓦解，退出群雄之争。', 'fall');
        log('〔大势〕' + nm + '势力土崩瓦解，自此退出群雄之争。', 'sys');
      }
    });
  }
  function checkUnify() {
    if (S().flags.unified) return;
    var counts = {};
    Object.keys(LF.CITIES || {}).forEach(function (c) { var k = warOwnerKey(c); counts[k] = (counts[k] || 0) + 1; });
    var aliveReal = 0;
    Object.keys(LF.FACTIONS || {}).forEach(function (fid) {
      if (fid === 'han' || fid === 'player') return;
      if ((counts[fid] || 0) > 0) aliveReal++;
    });
    if ((counts['player'] || 0) > 0 && aliveReal === 0) {
      S().flags.unified = true;
      var nm = (LF.FACTIONS.player || {}).name || '义军';
      chronicle(nm + '扫平群雄，海内归心，天下一统！', 'unify');
      log('〔天下一统〕历经百战，你终扫平群雄、海内归心——乱世至此落幕。', 'good');
      toast('🏆 天下一统！');
    }
  }
    return {
      diploGet: diploGet, diploStatus: diploStatus, diploActive: diploActive, diploTruceBetween: diploTruceBetween,
      diploExpire: diploExpire, diploPropose: diploPropose, diploSue: diploSue, renderDiplomacy: renderDiplomacy, openDiplomacy: openDiplomacy,
      factionName: factionName, factionColor: factionColor, civilEdict: civilEdict, renderEdict: renderEdict, renderFactionMap: renderFactionMap,
      factionTroops: factionTroops,
      warKm: warKm, warCityAdjPairs: warCityAdjPairs, warOwnerKey: warOwnerKey, warIsLordKey: warIsLordKey, warFactionName: warFactionName,
      warCityPower: warCityPower, warFactionTotal: warFactionTotal, warFactionCityCount: warFactionCityCount, warInRoom: warInRoom,
      runWarlordBattle: runWarlordBattle, warChronicleEntry: warChronicleEntry, warlordBattle: warlordBattle, warlordDayTick: warlordDayTick,
      onMonthTick: onMonthTick, monthlyYield: monthlyYield, factionDomesticAI: factionDomesticAI, scanFactionSurvival: scanFactionSurvival, checkUnify: checkUnify
    };
  };
})(typeof window !== 'undefined' ? window : global);
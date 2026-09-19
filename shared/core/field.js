// 模块 field（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createField = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var G = ctx.G;
    var log = ctx.log;
    var toast = ctx.toast;
    var wxEff = ctx.wxEff;
    var isDaytime = ctx.isDaytime;
    var WEATHERS = ctx.WEATHERS;
    var effectiveStats = ctx.effectiveStats;
    var advanceMinutes = ctx.advanceMinutes;
    var afterPackChange = ctx.afterPackChange;
    var buildActions = ctx.buildActions;
    var mkAct = ctx.mkAct;
    var openModal = ctx.openModal;
    var closeModal = ctx.closeModal;
    var save = ctx.save;
    var renderStatus = ctx.renderStatus;
    var toggleObjExpand = ctx.toggleObjExpand;
    var placedCellTag = ctx.placedCellTag;
    var placedInCell = ctx.placedInCell;
    var packUpPlaced = ctx.packUpPlaced;
    // 靠后创建的模块别名：经 getter 惰性取值，运行时再解析真实函数
    var openRestModal = function () { return ctx.openRestModal().apply(null, arguments); };
    var startCombat = function () { return ctx.startCombat().apply(null, arguments); };
    var packAdd = function () { return ctx.packAdd().apply(null, arguments); };
    var packFind = function () { return ctx.packFind().apply(null, arguments); };
    var packConsume = function () { return ctx.packConsume().apply(null, arguments); };
    var getCombatMode = ctx.getCombatMode;
    // ===== 郊野内容（资源 / 野兽 / 路人）=====
    // 此格仍存的野怪：玩家战后按格+野怪id 记录清剿（flags.fieldClearedMon），防反复刷同一批
    function fieldMonstersLeft(room){
      if(!room || !room.isField || !(room.monsters && room.monsters.length)) return [];
      var cleared = S().flags && S().flags.fieldClearedMon && S().flags.fieldClearedMon[room.id];
      var fled    = S().flags && S().flags.fieldFledMon    && S().flags.fieldFledMon[room.id];
      return room.monsters.filter(function(m){
        return !(cleared && cleared[m.id]) && !(fled && fled[m.id]);
      });
    }
    function fieldNarr(room){
      var out=[];
      // 方位与去向（v20260905f）：回城方向 + 出野可通何处，行军不再「盲走」
      var _fid=room.fieldId;
      if(_fid){
        var _fp=(LF.PLACES||{})[_fid]||{};
        var _fmeta=((LF.Travel&&LF.Travel.fields)||{})[_fid]||{};
        var _par=_fp.parent||_fmeta.place;
        if(_par){
          var _pn=((LF.CITIES||{})[_par]&&LF.CITIES[_par].name)?LF.CITIES[_par].name:((LF.PLACES||{})[_par]?LF.PLACES[_par].name:_par);
          var _g=_fp.gateDir||'东';
          var _back=({'北':'南','南':'北','东':'西','西':'东','东北':'西南','西南':'东北','西北':'东南','东南':'西北'})[_g]||'';
          // v20260905o 修复：原「出野」提示用整片郊野的 gateDir+neighbors，但出野出口只存在于远野边特定格、
          // 且每格仅通一个邻城（travel.js:310 cell.exits[dir]=tgt），导致提示「向北出野可至X」与罗盘（按当前格 exits）不一致。
          // 改为：优先以「当前格实际出野出口」播报；当前格无出野出口时，引导向 gateDir 深入至远野边格再出野。
          var _here=[];
          if(room.exits){
            for(var _d in room.exits){
              var _t=room.exits[_d];
              if(typeof _t==='string' && _t.indexOf('__gate__:')===0){
                var _nid=_t.split(':')[1];
                if(_nid && _nid!==_par){   // 排除回母城哨兵，仅列真正出野至邻城的出口
                  var _nn=((LF.CITIES||{})[_nid]&&LF.CITIES[_nid].name)?LF.CITIES[_nid].name:((LF.PLACES||{})[_nid]?LF.PLACES[_nid].name:_nid);
                  if(_nn) _here.push(_d+'至'+_nn);
                }
              }
            }
          }
          var _outs=[], _nxt=null;
          ((_fmeta.neighbors)||[]).forEach(function(n){
            var _nm=((LF.CITIES||{})[n.nid]&&LF.CITIES[n.nid].name)?LF.CITIES[n.nid].name:((LF.PLACES||{})[n.nid]?LF.PLACES[n.nid].name:null);
            if(_nm){ _outs.push(_nm); return; }
            // 多段郊野链（v20260907d）：中段的「邻居」实为下一程入口房（fld_x@r_c），按其 fieldId 取名，
            // 避免把 fld_xxx_南_2@1_2 这类房间 id 原文打进提示文案
            var _nr=G.ROOMS[n.nid], _ff=_nr&&_nr.fieldId;
            if(_ff && LF.PLACES[_ff] && LF.PLACES[_ff].name) _nxt=LF.PLACES[_ff].name;
          });
          var _txt;
          if(_here.length){
            _txt='「'+(_fp.name||'野')+'」：来路向'+_back+'，归「'+_pn+'」；此格向'+_here.join('、')+'（出野）。';
          } else if(_outs.length){
            _txt='「'+(_fp.name||'野')+'」：来路向'+_back+'，归「'+_pn+'」；向'+_g+'深入至远野边格可出野（可至 '+_outs.join(' / ')+'）。';
          } else if(_nxt){
            _txt='「'+(_fp.name||'野')+'」：来路向'+_back+'，归「'+_pn+'」；向'+_g+'深入至远野边格即入『'+_nxt+'』，再行数程当可出野。';
          } else {
            _txt='「'+(_fp.name||'野')+'」：向'+_back+'归「'+_pn+'」；其余方向似无通途，宜折返。';
          }
          // k/s（v20260914a）：〔途〕是「地貌性」情报，同一格反复进出不必重念全文 ——
          //   k='way' 是「已识」标记键，s 是再次进入时的压缩版（消费方见 fieldNarrFresh）。
          var _brief = _here.length
            ? ('「'+(_fp.name||'野')+'」归「'+_pn+'」，此格向'+_here.join('、')+'出野。')
            : ('「'+(_fp.name||'野')+'」归「'+_pn+'」，来路向'+_back+'；出野须向'+_g+'至远野边。');
          out.push({t:'〔途〕'+_txt, c:'sys', k:'way', s:'〔途·已识〕'+_brief});
        }
      }
      // 顶栏天候/昼夜提示（v20260905d）：让时间与天候对郊野的影响可见可感
      var _w=(WEATHERS[S().weather]||WEATHERS[0]);
      var _t=wxEff().tip;
      out.push({t:'〔天候〕'+_w.n+'·'+(isDaytime()?'昼':'夜')+(_t?('，'+_t):'，天色和朗，正宜赶路。'), c:'sys'});
      // 〔地利〕同理：初次说明「此处有何可采」，之后再进不必重念（场景动作栏里就列着「采集」，s:null 即二次进入后略过）
      if(room.resources && room.resources.length){ room.resources.forEach(function(r){ out.push({t:'〔地利〕此处有'+r.name+'（'+r.amt+'）可采。', c:'item', k:'res:'+r.name, s:null}); }); }
      var mons=fieldMonstersLeft(room);
      if(mons.length){ mons.forEach(function(m){
        var _lv=(({1:'一',2:'二',3:'三'})[m.lvl||1]||'')+'阶';
        if(m.aggr==='hostile') out.push({t:'〔戒备〕'+m.name+'（'+_lv+'）逡巡于此，见你便露凶光。', c:'combat'});
        else if(m.aggr==='neutral') out.push({t:'〔野兽〕'+m.name+'（'+_lv+'）在林间徘徊，似不主动袭人。', c:'sys'});
        else out.push({t:'〔走兽〕'+m.name+'（'+_lv+'）见人便窜入草丛。', c:'sys'});
      }); }
      if(room.fieldNpcs && room.fieldNpcs.length){ room.fieldNpcs.forEach(function(n){ out.push({t:'〔路人〕'+n.name+'在此歇脚。', c:'sys'}); }); }
      var fcamps=fieldPlacedCamps(room);
      if(fcamps.length) out.push({t:'〔营地〕此处已支有'+fcamps.map(function(f){return f.name;}).join('、')+'，可就近安歇或收起带走。', c:'good'});
      if(roomIsBoatRoute(room)) out.push(isOnBoat()
        ? {t:'〔水路〕烟波浩渺，你正乘舟渡江——沿岸码头渐近。', c:'sys'}
        : {t:'〔水路〕此处为津渡水路，须「乘船渡江」方可前行。', c:'warn'});
      return out;
    }
    // 〔野外叙事的重复抑制〕（v20260914a）
    //   旧版每走进一格郊野就把 fieldNarr 的九条一次铺开（按 55ms/字算约十三秒，不想读就得连点九下）——
    //   可玩家在「砍柴 → 回城交货 → 再出城砍柴」这条链上，同一格一天要进好几次，每次都重读同样的地貌。
    //   这里把条目分两类：
    //     · 静态（带 k：〔途〕〔地利〕）——初次进场照全说；再次进场换成 s 的压缩版（〔地利〕s:null 即不再念）。
    //     · 动态（不带 k：〔天候〕〔戒备〕〔路人〕〔营地〕〔水路〕）——每次照播，因为它们本来就随状态而变。
    //   「这格已识」记在 S().flags.fieldSeen[roomId]（随存档走；一房一标记，体量极小）。
    function fieldNarrFresh(room, rid){
      var lines=fieldNarr(room);
      if(!room || !room.isField) return lines;
      if(!S().flags.fieldSeen) S().flags.fieldSeen={};
      var first=!S().flags.fieldSeen[rid];
      S().flags.fieldSeen[rid]=1;
      if(first) return lines;
      var out=[];
      lines.forEach(function(e){
        if(!e.k){ out.push(e); return; }              // 动态条目：照播
        if(e.s) out.push({t:e.s, c:e.c, k:e.k, once:true});   // 静态条目：只留压缩版
      });
      return out;
    }
    // ===== 渡口坐船（v20260907c）=====
    // 水路郊野（isBoatRoute，多为 port/shuizhai 起点的多段链）须乘船方可通过：
    // 玩家进入水路郊野后须先「乘船渡江」，无舟无银则只能借无主小筏（保证不卡死）。
    // 一旦登上陆地（城或非水路郊野）即自动上岸，整段水路只需乘一次船。
    var BOAT_FEE = 12;   // 渡资（银两）；持有扁舟则免
    function fieldMetaOf(room){ var fid=room&&room.fieldId; return fid?((LF.Travel&&LF.Travel.fields)||{})[fid]||((LF.PLACES||{})[fid]||{}):{}; }
    function roomIsBoatRoute(room){ return !!(room && room.isField && fieldMetaOf(room).isBoatRoute); }
    function isOnBoat(){ return !!(S().flags && S().flags.onBoat); }
    function setOnBoat(v){ S().flags=S().flags||{}; S().flags.onBoat=!!v; }
    function boatBoardAct(){
      if(isOnBoat()){ toast('你已在舟中。'); return; }
      if(packFind('zhou')){ setOnBoat(true); log('你解缆登舟，扁舟轻荡，准备渡江。','good'); }
      else if((S().gold||0) >= BOAT_FEE){ S().gold-=BOAT_FEE; setOnBoat(true); log('你付了渡资 '+BOAT_FEE+' 银，登上渡船，船夫撑篙离岸。','good'); }
      else { setOnBoat(true); log('渡口无舟可雇，你寻得一只无主小筏，亲自撑篙渡江。','sys'); }
      buildActions(G.ROOMS[S().room]); renderStatus();
    }
    function fieldActions(room){
      // 水路郊野：须乘船方可通过（已在舟中则显示已乘，未乘则给出「乘船渡江」）
      if(roomIsBoatRoute(room)){
        if(isOnBoat()) mkAct('scene','⛵','已乘舟（渡江中）', function(){ toast('你正在舟中渡江，向岸边行去即可上岸。'); });
        else mkAct('scene','🚣','乘船渡江', boatBoardAct);
      }
      if(room.resources && room.resources.length){
        room.resources.forEach(function(res){ mkAct('scene','🌿','采'+res.name, function(){ gatherField(room, res); }); });
      }
      fieldMonstersLeft(room).forEach(function(m){
        if(m.aggr==='hostile') mkAct('scene','⚔','清剿·'+m.name, function(){ startCombat([m.id], {fieldLvl:m.lvl}); });
        else if(m.aggr==='neutral') mkAct('scene','⚔','挑战'+m.name, function(){ startCombat([m.id], {fieldLvl:m.lvl}); });
        else if(m.aggr==='flee') mkAct('scene','🏹','猎取·'+m.name, function(){ huntFieldBeast(room, m); });
      });
      if(room.fieldNpcs && room.fieldNpcs.length){
        room.fieldNpcs.forEach(function(n){ mkAct('scene','💬','与'+n.name+'交谈', function(){ talkFieldNpc(room, n); }); });
      }
      if(fieldHasWater(room)) mkAct('scene','🎣','垂钓', function(){ fishField(room); });
      addFieldCamp(room);
    }
    function gatherField(room, res){
      if(!S().flags.fieldGathered) S().flags.fieldGathered={};
      if(S().flags.fieldGathered[room.id] && S().flags.fieldGathered[room.id].indexOf(res.type)>=0){ toast(res.name+'已被采尽。'); return; }
      var did = (res.item) || null;
      if(!did || !LF.ITEMS[did]){ toast(res.name+'暂无可采（物产缺失）。'); return; }
      if(!packAdd(did, 1)) return;   // 行囊满则由 packAdd 提示，此格不标记采尽，可回头再采
      S().flags.fieldGathered[room.id]=S().flags.fieldGathered[room.id]||[];
      S().flags.fieldGathered[room.id].push(res.type);
      log('你俯身采得'+LF.ITEMS[did].name+'一份，收进行囊。','good');
      save(S()); buildActions(G.ROOMS[S().room]);
    }
    // 水域垂钓（v20260907a）：郊野含水域格即可下钩，钓得鲜鱼/咸鱼入包；单格单局限 4 获，鱼惊则稍后再来
    function fieldHasWater(room){
      var fid=room && room.fieldId; if(!fid) return false;
      var fp=(LF.PLACES||{})[fid]||{}; var size=fp.size||4;
      for(var r=0;r<size;r++) for(var c=0;c<size;c++){
        var rm=G.ROOMS[LF.Travel.roomId(fid,r,c)];
        if(rm && rm.water) return true;
      }
      return false;
    }
    function fishField(room){
      if(!fieldHasWater(room)){ toast('此处无水，无从下钩。'); return; }
      S().flags.fieldFished=S().flags.fieldFished||{};
      var n=(S().flags.fieldFished[room.id]||0);
      if(n>=4){ toast('此间水域鱼已受惊，稍后再来方有所得。'); return; }
      var did=(Math.random()<0.7)?'fish':'fish_dried';
      var amt=1+Math.floor(Math.random()*3);
      if(!packAdd(did, amt)) return;
      S().flags.fieldFished[room.id]=n+1;
      log('你抛竿静候，须臾竿弯——钓得'+LF.ITEMS[did].name+'×'+amt+'，收入行囊。','good');
      save(S()); buildActions(G.ROOMS[S().room]);
    }
    // 猎取惊兽（aggr==='flee'，如野彘）：屏息潜行接近；成则入战（胜者照常清剿+掉落），
    // 败则惊走——按格+野怪id 记 flags.fieldFledMon，此后本格不再现身（存档持久）。
    function huntFieldBeast(room, m){
      if(S().defeated){ toast('你重伤在身，追不动猎物。'); return; }
      var es=effectiveStats ? effectiveStats() : null;
      var spd=(es && es.spd!=null) ? es.spd : ((S().spd||10));
      // 潜行成功率 = 身手基础 − 兽阶警觉 + 天候掩行 − 夜间野兽警觉
      var _wx=wxEff();
      var p=0.60 + Math.max(0, spd-20)*0.006 - ((m.lvl||1)-1)*0.06 + (_wx.hunt||0) - (isDaytime()?0:0.05);
      p=Math.min(0.85, Math.max(0.30, p));
      log('你屏息蹑足，借草木掩身缓缓向'+m.name+'靠拢……'+(isDaytime()?'':'（夜色深沉，蹑步愈轻。）'),'sys');
      if(Math.random() < p){
        log(m.name+'惊觉回首，獠牙尽露与你搏斗起来！','combat');
        startCombat([m.id], {fieldLvl:m.lvl});
        return;
      }
      if(!S().flags.fieldFledMon) S().flags.fieldFledMon={};
      var row=S().flags.fieldFledMon[room.id]; if(!row) row=S().flags.fieldFledMon[room.id]={};
      row[m.id]=1;
      save(S());
      log(m.name+'耳聪目明，趁你尚未及身便蹬地窜入密林深处，转瞬没了踪影。','sys');
      buildActions(G.ROOMS[S().room]);
    }
    function talkFieldNpc(room, n){
      if(n.type==='trader'){
        log('行商卸下担子：「壮士远来，荒野中正少个歇脚处——干粮伤药、柴薪卧席，小老儿都备了些，价好商量。」','sys');
        openModal('shop', { shop:'field_trader' });
        return;
      }
      if(n.type==='refugee'){
        var rt = (Math.random() < 0.5)
          ? '小老儿逃难至此，腹中空空，只盼太平…' + ((room && room.monsters && room.monsters.length)? '那边林子里似有歹人出没，将军路过当心。' : '将军若往南行，听说道上有商队结伴，或能捎您一程。')
          : '前路不太平，行路切记贴身藏好干粮饮水。';
        log('流民拱手叹道：「将军行行好——'+rt+'」','sys');
        return;
      }
      log('路人朝你点了点头，继续赶路。','sys');
    }
    // ===== 郊野营地（v20260905b）：帐篷/篝火/草席在野外格可支设、可收起、可按设施安歇 =====
    // 复用既有 S().placed[房间id] 放置物机制：野外格房间独立隔离；设施 key（物品 place.key）→ REST_KINDS
    var PLACE_CAMP_KIND = { campfire:'campfire', sleepmat:'sleepmat', tent:'tent' };
    var FIELD_CAMP_REST = { tent:'安歇…', campfire:'烤火取暖…', sleepmat:'躺下小睡…' };
    // 本格已支设的营地设施（含图标/名称/对应休息档位；按 帐篷>篝火>草席 排序）
    function fieldPlacedCamps(room){
      if(!room || !room.id) return [];
      var arr=(S().placed && S().placed[room.id]) || [];
      var order={tent:0, campfire:1, sleepmat:2}, out=[];
      arr.forEach(function(p){
        var k=PLACE_CAMP_KIND[p && p.key]; if(!k) return;
        var d=LF.ITEMS[p.defId] || {}; var pl=d.place || {};
        out.push({ key:p.key, kind:k, name:pl.name || d.name || p.key, icon:pl.icon || '⛺', order:order[k] });
      });
      out.sort(function(a,b){ return a.order-b.order; });
      return out;
    }
    // 行囊中可支设且本格尚未支设的营地器具（每类一例；行商处亦贩此等物）
    function carriedCampGear(room){
      if(!S().pack) return [];
      var placed={}; fieldPlacedCamps(room).forEach(function(f){ placed[f.key]=1; });
      var seen={}, out=[];
      S().pack.forEach(function(it){
        if(!it) return;
        var d=LF.ITEMS[it.defId]; if(!d || !d.place) return;
        var k=PLACE_CAMP_KIND[d.place.key]; if(!k || seen[d.place.key]) return;
        if(placed[d.place.key]) return;
        seen[d.place.key]=1;
        out.push({ key:d.place.key, defId:it.defId, kind:k, name:d.name, icon:d.place.icon || '⛺' });
      });
      return out;
    }
    // 支设某器具入本格（行囊扣除一件；随即按该档位打开安歇面板）
    function placeFieldGear(room, g){
      if(S().defeated){ toast('你重伤动弹不得，先就地打盹吧。'); openRestModal('ground'); return; }
      var tag=placedCellTag(room.id);
      S().placed=S().placed || {}; S().placed[room.id]=S().placed[room.id] || [];
      if(S().placed[room.id].some(function(o){ return o.key===g.key && placedInCell(o, room.id, tag); })){ toast('此处已支有'+g.name+'。'); return; }
      var cur=packFind(g.defId);
      if(!cur || (cur.count||1)<1){ toast('行囊中已无'+g.name+'。'); return; }
      packConsume(g.defId, 1);
      S().placed[room.id].push({ key:g.key, defId:g.defId, cell:tag });
      log('你卸下行囊，支起'+g.name+'。','good');
      afterPackChange();          // 存档 + 刷新行囊与场景（支设后场景按钮即切换为设施）
      openRestModal(g.kind);
    }
    // 郊野格场景的营地按钮组：
    //   已有支设设施 → 设施按钮（安歇…/收起带走），不再重复「扎营休整」；
    //   行囊有器具   → 「布设·X」按钮 + 兜底「扎营休整」（露宿）；
    //   否则         → 仅「扎营休整」。
    function addFieldCamp(room){
      var facs=fieldPlacedCamps(room);
      if(facs.length){
        facs.forEach(function(f){
          var b=mkAct('scene', f.icon, f.name, function(e){
            toggleObjExpand(e, b, {name:f.name, desc:'本格营地设施'}, [
              {label: (FIELD_CAMP_REST[f.kind] || '安歇…'), icon:'💤', fn:function(){ openRestModal(f.kind); }},
              {label:'收起带走', icon:'📦', fn:function(){ packUpPlaced(f.key); }}
            ]);
          });
        });
        return;
      }
      var carry=carriedCampGear(room);
      carry.forEach(function(g){
        mkAct('scene', g.icon, '布设·'+g.name, function(){ placeFieldGear(room, g); });
      });
      mkAct('scene','⛺','扎营休整', function(){ campInField(room); });
    }
    // 野外扎营（无设施兜底）：效率低于帐/席/篝火；格内仍有凶兽时，露宿醒转可能遭夜袭（见 doRest）
    function campInField(room){
      if(S().defeated){ toast('你重伤动弹不得，只能席地打盹。'); openRestModal('ground'); return; }
      var host=fieldMonstersLeft(room).filter(function(m){ return m.aggr==='hostile'; });
      if(host.length){
        log('〔警觉〕此格仍有'+host.map(function(m){return m.name;}).join('、')+'逡巡——荒野露宿恐遭夜袭！','combat');
      }
      openRestModal('wild');
    }
    function maybeFieldAmbush(room){
      if(S().defeated || getCombatMode()!==null) return false;
      var hostiles=fieldMonstersLeft(room).filter(function(m){ return m.aggr==='hostile'; });
      if(!hostiles.length) return false;
      // 拦路/夜袭概率 = 55% 基准 + 天候掩蔽修正 + 入夜加成（雾雨夜里更难提防），clamp 至 [0.2,0.9]
      var _ch=0.55 + (wxEff().amb||0) + (isDaytime()?0:0.12);
      _ch=Math.max(0.2, Math.min(0.9, _ch));
      if(Math.random() < _ch){
        var ids=hostiles.map(function(m){ return m.id; });
        var ml=1; hostiles.forEach(function(m){ if((m.lvl||1)>ml) ml=m.lvl||1; });
        var label=hostiles.map(function(m){ return m.name; }).join('、');
        log('〔警觉〕'+label+(isDaytime()?('趁'+((WEATHERS[S().weather]||{}).n||'')+'天色'):'趁夜色')+'扑出，拦住去路！','combat');
        startCombat(ids, {fieldLvl:ml});
        return true;
      }
      return false;
    }
  
    return {
      fieldMonstersLeft, fieldNarr, fieldNarrFresh, fieldMetaOf, roomIsBoatRoute, isOnBoat, setOnBoat, boatBoardAct,
      fieldActions, gatherField, fieldHasWater, fishField, huntFieldBeast, talkFieldNpc, fieldPlacedCamps, carriedCampGear,
      placeFieldGear, addFieldCamp, campInField, maybeFieldAmbush
    };
  };
})(typeof window !== 'undefined' ? window : global);

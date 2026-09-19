// 模块 quest（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createQuest = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var G = ctx.G;
    var getGuide = ctx.getGuide;
    var dirToRoom = ctx.dirToRoom;
    var roomNameOf = ctx.roomNameOf;
    var isCityGrid = ctx.isCityGrid;
    var genCityGrid = ctx.genCityGrid;
    var toast = ctx.toast;
    var closeModal = ctx.closeModal;
    var openModal = ctx.openModal;
    var save = ctx.save;
    var log = ctx.log;
    var renderStatus = ctx.renderStatus;
    var addXp = ctx.addXp;
    var addReputation = ctx.addReputation;
  // ===== P0：志向（目标追踪）+ 门派加入 UX =====
  var QORDER={white:0,green:1,blue:2,purple:3,orange:4};
  function objBestEquip(s){ var b={q:0,name:''}; if(s.equipment){ Object.keys(s.equipment).forEach(function(k){ var it=s.equipment[k]; if(it&&it.quality!=null){ var q=QORDER[it.quality]; if(q!=null&&q>b.q){b.q=q;b.name=it.name;} } }); } return b; }
  // 任务日志：接取式任务「进行中 / 已完成」分页；初始空白，接到任务才出现
  function renderObjectives(){
    var quests = (S().quests && S().quests.length) ? S().quests : [];
    var done = (S().questsDone && S().questsDone.length) ? S().questsDone : [];
    var career = (LF.OBJECTIVES) ? LF.OBJECTIVES.map(function(o){ return {o:o,done:o.check(S())}; }) : [];
    var h='<h3 class=\"q-title\">任 务 日 志</h3>'+
      '<div class="quest-tabs">'+
        '<button class="qtab active" data-t="active" onclick="switchQuestTab(\'active\')">进行中</button>'+
        '<button class="qtab" data-t="done" onclick="switchQuestTab(\'done\')">已完成'+(done.length?('（'+done.length+'）'):'')+'</button>'+
        '<button class="qtab" data-t="career" onclick="switchQuestTab(\'career\')">志业</button>'+
      '</div>'+
      '<div class="quest-pane" id="qp-active">';
    if(!quests.length){
      h+='<p class="tip q-empty">暂无进行中的任务。与营中众人攀谈，或留意高亮提示，即可接取任务。</p>';
    } else {
      quests.forEach(function(q){ h+=questCardHTML(q); });
    }
    h+='</div><div class="quest-pane" id="qp-done" style="display:none">';
    if(!done.length){
      h+='<p class="tip q-empty">尚无已完成的任务。</p>';
    } else {
      h+='<div class="obj-done">';
      done.forEach(function(q){ h+='<span class="obj-d">'+q.title+'</span>'; });
      h+='</div>';
    }
    h+='</div><div class="quest-pane" id="qp-career" style="display:none">';
    if(!career.length){
      h+='<p class="tip q-empty">暂无功业可记。</p>';
    } else {
      career.forEach(function(x){ h+=objCardHTML(x); });
    }
    h+='</div>';
    return h;
  }
  function objCardHTML(x){
    var o=x.o;
    var tn={main:'主线',side:'支线',trial:'修行'}[o.type]||'任务';
    var cls=o.type==='main'?'t-main':(o.type==='trial'?'t-trial':'t-side');
    var r='<div class="obj '+cls+'">'+
      '<div class="obj-head"><span class="obj-tag '+cls+'">'+tn+'</span><span class="obj-t">'+o.title+'</span></div>'+
      '<div class="obj-h">'+o.hint+'</div>';
    if(typeof o.ratio==='function'){
      var rt=Math.max(0,Math.min(1,o.ratio(S())||0));
      r+='<div class="obj-bar"><span style="width:'+Math.round(rt*100)+'%"></span></div>'+
         '<div class="obj-p">'+o.prog(S())+'</div>';
    } else {
      r+='<div class="obj-p">进度 · '+o.prog(S())+'</div>';
    }
    if(o.reward){
      var rw=[];
      if(o.reward.xp) rw.push('修为+'+o.reward.xp);
      if(o.reward.gold) rw.push('银两+'+o.reward.gold);
      if(o.reward.rep) rw.push('声望+'+o.reward.rep);
      r+='<div class="obj-reward">奖励 · '+rw.join(' · ')+'</div>';
    }
    var tracking=S().trackingQuest===o.id;
    // 「指路」（v20260914a）：志业多半是长期倾向，只有数据里标了 o.at 的才给按钮 —— 没位置就不装模作样
    r+='<div class="obj-acts">'+(x.done?'':gotoBtnHTML(o.at))+
       '<button class="obj-track'+(tracking?' on':'')+'" data-quest="'+o.id+'" type="button">'+(tracking?'追踪中 ✓':'追 踪')+'</button></div>'+
       '</div>';
    return r;
  }
  function questTitle(qid){
    if(LF.OBJECTIVES){ for(var i=0;i<LF.OBJECTIVES.length;i++){ if(LF.OBJECTIVES[i].id===qid) return LF.OBJECTIVES[i].title; } }
    if(S().quests){ for(var i=0;i<S().quests.length;i++){ if(S().quests[i].id===qid) return S().quests[i].title; } }
    return qid;
  }
  function packCount(id){
    if(!S().pack) return 0; var n=0;
    for(var i=0;i<S().pack.length;i++){ var it=S().pack[i]; if(it && (it.defId||it.id)===id) n+=(it.count||1); }
    return n;
  }
  // 旗标计数（v20260911i）：营中苦役的进度不是「物品×N」，而是「活计趟数」——落在 S().flags.task.<key>_cnt。
  //   flagNum 取值 / addFlagNum 累加；needHave 把「物品需求」与「旗标需求」统一换算成「已有多少」，
  //   供状态栏追踪条与任务卡共用（need 项无 flag 时按背包实时派生，见 story/objectives.js）。
  function flagNum(path){
    var ks=String(path).split('.'), c=S();
    for(var i=0;i<ks.length;i++){ if(c==null) return 0; c=c[ks[i]]; }
    return (typeof c==='number')?c:(parseInt(c,10)||0);
  }
  function addFlagNum(path, n){
    var ks=String(path).split('.'), c=S();
    for(var i=0;i<ks.length-1;i++){ if(c[ks[i]]==null) c[ks[i]]={}; c=c[ks[i]]; }
    var k=ks[ks.length-1];
    c[k]=(parseInt(c[k],10)||0)+(n||1);
    return c[k];
  }
  function needHave(nd){
    if(!nd) return 0;
    if(nd.flag) return flagNum(nd.flag);
    if(nd.item) return packCount(nd.item);
    return 0;
  }
  function acceptQuest(id){
    S().quests=S().quests||[]; if(S().quests.some(function(q){return q.id===id;})) return;
    var def=LF.QUEST_DEFS && LF.QUEST_DEFS[id]; if(!def) return;
    S().quests.push(JSON.parse(JSON.stringify(def)));
    save(S()); renderStatus();
  }
  function completeQuest(id){
    S().quests=S().quests||[];
    var i=S().quests.findIndex(function(q){return q.id===id;}); if(i<0) return;
    var q=S().quests.splice(i,1)[0];
    S().questsDone=S().questsDone||[];
    S().questsDone.push({id:q.id,title:q.title,type:q.type,reward:q.reward});
    if(S().trackingQuest===id) S().trackingQuest=null;
    save(S()); renderStatus();
  }
  // 进行中任务卡（折叠式 v20260915k）：一行标签+标题+进度+箭头，点开才见
  //   提示/材料/提交人/奖励/按钮 —— 任务一多，一眼扫过去全是标题，不再被长文字刷屏。
  function questCardHTML(q){
    var tn={main:'主线',side:'支线',trial:'修行'}[q.type]||'任务';
    var cls={main:'t-main',side:'t-side',trial:'t-trial'}[q.type]||'t-side';
    var progTxt='';
    if(q.need && q.need.length){
      var doneN=0;
      q.need.forEach(function(nd){ if(needHave(nd)>=nd.count) doneN++; });
      progTxt='<span class="q-prog">'+doneN+'/'+q.need.length+'</span>';
    } else {
      progTxt='<span class="q-prog">…</span>';
    }
    var h='<div class="obj '+cls+' obj-col" data-quest="'+q.id+'">'+
      '<div class="obj-head">'+
        '<span class="obj-tag '+cls+'">'+tn+'</span>'+
        '<span class="obj-t">'+q.title+'</span>'+
        progTxt+
        '<span class="obj-arrow">▸</span>'+
      '</div>'+
      '<div class="obj-more">';
    if(q.hint){ h+='<div class="obj-h">'+q.hint+'</div>'; }
    if(q.need && q.need.length){
      h+='<div class="q-need">';
      q.need.forEach(function(nd){
        var have=needHave(nd), ok=have>=nd.count;
        h+='<div class="q-need-row'+(ok?' done':'')+'">'+
           '<span class="q-ic">'+(nd.icon||'')+'</span>'+
           '<span class="q-nm">'+nd.name+'</span>'+
           '<span class="q-cnt">'+Math.min(have,nd.count)+' / '+nd.count+'</span></div>';
      });
      h+='</div>';
    }
    // v20260916b：submit 以最新 QUEST_DEFS 为准 —— 任务接取时深拷贝进存档（acceptQuest），
    //   数据源后来修订过 submit.room（如 camp_warehouse → kuyilao）时，存档里那本是旧值，
    //   指路/提交行会按旧房间走，白指去「山河」。渲染时用定义覆盖，旧档任务也指向新位置。
    var _def2 = LF.QUEST_DEFS && LF.QUEST_DEFS[q.id];
    var _submit = (_def2 && _def2.submit) || q.submit;
    if(_submit){ var _rn2=(G.ROOMS[_submit.room]&&G.ROOMS[_submit.room].name)||''; h+='<div class="q-submit">📍 提交 · '+_submit.npc+(_rn2?('（'+_rn2+'）'):'')+'</div>'; }
    if(q.reward){ h+='<div class="obj-reward">奖励 · '+q.reward+'</div>'; }
    var tracking=S().trackingQuest===q.id;
    // 接取式任务几乎都带 submit（去某房间找某人复命）——那是任务文字里最实在的一句「去哪儿」
    h+='<div class="obj-acts">'+gotoBtnHTML(_submit ? { room:_submit.room, npc:_submit.npc } : (q.at||null))+
       '<button class="obj-track'+(tracking?' on':'')+'" data-quest="'+q.id+'" type="button">'+(tracking?'追踪中 ✓':'追 踪')+'</button></div></div>'+
      '</div>';
    return h;
  }
  window.switchQuestTab=function(t){
    var card=document.getElementById('modal-card'); if(!card) return;
    var btns=card.querySelectorAll('.qtab'); for(var i=0;i<btns.length;i++){ btns[i].classList.toggle('active', btns[i].getAttribute('data-t')===t); }
    var pa=document.getElementById('qp-active'), pd=document.getElementById('qp-done'), pc=document.getElementById('qp-career');
    if(pa) pa.style.display = t==='active'?'':'none';
    if(pd) pd.style.display = t==='done'?'':'none';
    if(pc) pc.style.display = t==='career'?'':'none';
  };
  function bindQuestPanel(){
    // 折叠展开（v20260915k）：点任务卡头部展开/收起详情；内部按钮点击不冒泡
    document.querySelectorAll('.obj-col .obj-head').forEach(function(hd){
      hd.onclick=function(e){
        if(e.target.closest('.obj-track')||e.target.closest('.obj-goto')) return;
        var card=hd.parentNode;
        card.classList.toggle('open');
        var ar=hd.querySelector('.obj-arrow'); if(ar) ar.textContent=(card.classList.contains('open')?'▾':'▸');
      };
    });
    // 「指路」（v20260914a）：点一下就把去路点亮 —— 不必再对着一行文字自己猜该往哪走
    document.querySelectorAll('.obj-goto[data-goto]').forEach(function(b){
      b.onclick=function(){
        var at=null;
        try{ at=JSON.parse(decodeURIComponent(b.getAttribute('data-goto'))); }catch(e){}
        questGoto(at);
      };
    });
    document.querySelectorAll('.obj-track[data-quest]').forEach(function(b){
      b.onclick=function(){
        var qid=b.getAttribute('data-quest');
        if(S().trackingQuest===qid){ S().trackingQuest=null; toast('已取消追踪'); }
        else { S().trackingQuest=qid; toast('已追踪「'+questTitle(qid)+'」，目标显示在顶栏'); }
        renderStatus();
        openModal('quest');
      };
    });
  }
  function checkQuestRewards(){
    if(!S() || !LF.OBJECTIVES) return;
    S().questRewards=S().questRewards||{};
    var got=[];
    LF.OBJECTIVES.forEach(function(o){
      if(S().questRewards[o.id]) return;
      if(o.check(S())){
        S().questRewards[o.id]=true;
        if(o.reward){
          if(o.reward.xp){ addXp(o.reward.xp); got.push('修为+'+o.reward.xp); }
          if(o.reward.gold){ S().gold=(S().gold||0)+o.reward.gold; got.push('银两+'+o.reward.gold); }
          if(o.reward.rep){ addReputation(o.reward.rep); got.push('声望+'+o.reward.rep); }
        }
        got.push('任务「'+o.title+'」');
      }
    });
    if(got.length) log('【任务达成】'+got.join('，')+'。','good');
  }
  function gotoBtnHTML(at){
    if(!at) return '';
    var o=(typeof at==='string')?{room:at}:at;
    var j; try{ j=JSON.stringify(o); }catch(e){ return ''; }
    // 有可点亮的目标 → 「指路」；只有 at.why（这条路本就不在一处）→ 「问路」，老实说清该往哪走
    var t=(o.act||o.npc||o.dock||o.room)?'在场景里点亮去路':'问路：这条该往哪走';
    return '<button class="obj-goto" data-goto="'+encodeURIComponent(j)+'" type="button" title="'+t+'">指 路</button>';
  }
  // 一次指路：先在本格找，再指罗盘方向，实在不在此处就报出路名并亮「山河」。
  function questGoto(at){
    if(!at || !S()) return;
    if(typeof at==='string') at={room:at};
    closeModal();
    var anchors=[];
    if(at.act) anchors.push({act:at.act});
    if(at.npc) anchors.push({npc:at.npc});
    if(at.dock) anchors.push({dock:at.dock});
    // ① 目标就在当下这一格（人物 / 动作按钮 / 页签）→ 直接点亮并滚进视野
    if(anchors.length && (!at.room || at.room===S().room)){
      var ok=false;
      try{ ok=getGuide().exists(anchors); }catch(e){}
      // 锚点写的是显示名（'仓吏'/'鲁大'），而 nl-item 的 data-k 是 NPC 实例 key
      //   （storeman@kuyilao:2,1#0）——语义锚点匹配不到时，按显示名在人物列表里兜底（v20260916a）
      if(!ok && at.npc){
        var _nm=at.npc, _chips=document.querySelectorAll('#npc-list .nl-item');
        for(var _ii=0;_ii<_chips.length;_ii++){
          if(_chips[_ii].textContent.indexOf(_nm)>=0){
            var _k=_chips[_ii].getAttribute('data-k');
            if(_k){ try{ getGuide().focus([{npc:_k}]); ok=true; }catch(e){} }
            break;
          }
        }
      }
      if(ok){
        toast('就在眼前 · '+(at.npc||at.act||'此处'));
        return;
      }
    }
    // ② 目标在隔壁 → 点亮罗盘上那个方位的键（一步可达，最实用的一条）
    if(at.room){
      var dir=dirToRoom(S().room, at.room);
      if(dir){
        try{ getGuide().focus([{dir:dir}]); }catch(e){}
        toast('向'+dir+'去 · '+roomNameOf(at.room));
        return;
      }
    }
    // ②·⑤ 同城不同格：提交人在城里别处（仓吏在仓库格）→ 报出该往哪边走（v20260916a）
    if(at.room && at.room===S().room && isCityGrid(S().room) && at.npc){
      var _cell=cityNpcCellPos(at.npc, S().room);
      var _cp2=S().flags && S().flags.cityPos;
      if(_cell && _cp2 && _cp2.cid===S().room){
        var _dx=_cell[0]-_cp2.x, _dy=_cell[1]-_cp2.y;
        var _w=(_dy<0?'北':(_dy>0?'南':''))+(_dx>0?'东':(_dx<0?'西':''));
        if(!_w){ toast('「'+at.npc+'」就在这一格。'); return; }
        toast('「'+at.npc+'」在'+_w+'边的格子里——顺着罗盘一格一格走过去。');
        return;
      }
    }
    // ③ 不在此处 → 报明去处，并把「山河」指出来（远行本该走山河志）
    var nm=roomNameOf(at.room);
    if(nm){ toast('「'+nm+'」不在此处——可点「山河」寻路前往'); }
    else if(at.why){ toast(at.why); return; }   // 这条路本就不在一处：直接用数据里备好的「该往哪走」
    else { toast('此事此地办不了，先看看别处有什么可做'); }
    try{ getGuide().ping({dock:'map'}); }catch(e){}
  }
  // 城格 NPC 所在格：具名 NPC 看 NPC_NAMED 的 cell；程序 NPC 由 kinds→城市 layoutGrid/cells 推导（v20260916a）
  function cityNpcCellPos(name, cid){
    if(!name) return null;
    var named=LF.NPC_NAMED||[];
    for(var i=0;i<named.length;i++){
      var nc=named[i];
      if(nc.city!==cid || !nc.cell) continue;
      var dlg=G.DIALOGUES && G.DIALOGUES.npcs && G.DIALOGUES.npcs[nc.id];
      if(dlg && dlg.name===name){ var p=nc.cell.split(','); return [+p[0], +p[1]]; }
    }
    var cards=LF.NPC_CARDS||[];
    for(var j=0;j<cards.length;j++){
      var c2=cards[j];
      if(!c2.role || c2.role!==name || !(c2.kinds && c2.kinds.length)) continue;
      var grid=genCityGrid(cid);
      if(grid && grid.cells){
        var _cells=grid.cells, _sz=grid.size||_cells.length;
        for(var y=0;y<_sz;y++) for(var x=0;x<_sz;x++){
          if(_cells[y] && _cells[y][x]===c2.kinds[0]) return [x,y];
        }
      }
    }
    return null;
  }
    return {
      QORDER, objBestEquip, renderObjectives, objCardHTML, questTitle, packCount, flagNum, addFlagNum, needHave, acceptQuest, completeQuest, questCardHTML, switchQuestTab: window.switchQuestTab, bindQuestPanel, checkQuestRewards, gotoBtnHTML, questGoto, cityNpcCellPos
    };
  };
})(typeof window !== 'undefined' ? window : global);

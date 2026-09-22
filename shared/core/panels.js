// 模块 panels（从 engine.js 拆分）：展示型面板簇
// 只负责「渲染一段 HTML 字符串」，不触碰 $card/$modal 框架、不参与状态推进。
//   renderCodex       图鉴·览物志（武学十三艺线 / 门派 / 贼寇名录）
//   renderSettings    设置三标签页（画面 / 声音 / 游戏）；fromTitle 时不含调试台
//   renderCredit      群英同撰
//   topObjectiveText  顶部志向标题（注：当前无调用点，statusbar 抽出后的遗留）
//   renderLogPanel    回顾（logRing 近 HIST_MAX 句，旧句在上）
//   renderLevelup     破境弹窗（读即清 levelupGained）
//   renderCityStat    城况·城型城门市集工事一览
// 依赖全部由 engine.js 工厂注入；可变绑定一律走 getter。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createPanels = function (ctx) {
    // state 会被读档/新局重赋值 → getState
    var getState = ctx.getState, S = getState;
    // Core.settings（engine L9）：对象引用，仍走 getter 以防日后重挂
    var getSettings = ctx.getSettings, SET = getSettings;
    // HIST_MAX 声明在 engine L4125，晚于本工厂插入点，直接传值会捕获 undefined → 必须 getter
    var getHistMax = ctx.getHistMax, HMAX = getHistMax;
    var G = ctx.G;                        // Core.G（engine L7）
    var LF = ctx.LF;                      // 命名空间（CONSTANTS.VERSION / OBJECTIVES）
    var SFX = ctx.SFX;                    // engine L30
    var lfSpeedLabel = ctx.lfSpeedLabel;  // Core.lfSpeedLabel（engine L14）
    var row = ctx.row;                    // 函数声明，提升可用
    var escapeHtml = ctx.escapeHtml;
    // 城况面板依赖（City 模块链式别名，engine L110-129 声明，早于工厂插入点）
    var cityProfile = ctx.cityProfile, genCityGrid = ctx.genCityGrid,
        cellDisplayType = ctx.cellDisplayType, availableGateDirs = ctx.availableGateDirs,
        cityLevelName = ctx.cityLevelName, cityGridSize = ctx.cityGridSize,
        cityDevOf = ctx.cityDevOf;      // 函数声明，提升可用

    // 图鉴：览物志
    function renderCodex(){
      var known={}; if(S()&&S().learnedMartial) S().learnedMartial.forEach(function(id){known[id]=1;});
      var byLine={};
      Object.keys(G.MARTIAL_ARTS||{}).forEach(function(id){
        var m=G.MARTIAL_ARTS[id]; if(!m||!m.line) return;
        (byLine[m.line]=byLine[m.line]||[]).push({name:m.name,on:!!known[id]});
      });
      var h='<h3>览 物 志</h3><p class="tip">江湖风物，已历者标朱。</p>';
      h+='<div class="codex-sec"><h4>武 学（十三艺线）</h4><div class="codex-grid">';
      Object.keys(byLine).forEach(function(line){
        byLine[line].forEach(function(it){ h+='<span class="codex-chip'+(it.on?' on':'')+'">'+it.name+'</span>'; });
      });
      h+='</div></div>';
      h+='<div class="codex-sec"><h4>门 派</h4><div class="codex-grid">';
      Object.keys(G.SECTS||{}).forEach(function(k){ h+='<span class="codex-chip">'+G.SECTS[k].name+'</span>'; });
      h+='</div></div>';
      if(G.ENEMIES){
        h+='<div class="codex-sec"><h4>贼 寇 名 录</h4><div class="codex-grid">';
        Object.keys(G.ENEMIES).forEach(function(k){ var e=G.ENEMIES[k]; if(e&&e.name) h+='<span class="codex-chip">'+e.name+'</span>'; });
        h+='</div></div>';
      }
      return h;
    }

    // 设置：标签页（画面 / 声音 / 游戏）；fromTitle 时不含调试台
    function renderSettings(opts){
      opts=opts||{};
      var fromTitle=!!opts.fromTitle;
      var ts=SET().textSpeed;
      var gfx=
        '<div class="set-row col"><span>文字演出（越大越慢）</span>'+
          '<input type="range" class="lf-range" id="rng-speed" min="0" max="100" step="5" value="'+ts+'">'+
          '<span class="spd-val" id="spd-val">'+lfSpeedLabel(ts)+'</span></div>'+
        '<div class="set-row"><span>标题特效</span><div class="seg" id="seg-fx">'+
          '<button data-v="1" class="'+(SET().titleFx!==false?'on':'')+'">开</button>'+
          '<button data-v="0" class="'+(SET().titleFx===false?'on':'')+'">关</button></div></div>'+
        '<p class="tip">水墨烟尘与墨晕动画；喧嚣可关，长夜更静。</p>';
      var snd=
        '<div class="set-row"><span>音效</span><div class="seg" id="seg-snd">'+
          '<button data-v="1" class="'+(SET().sound?'on':'')+'">开</button>'+
          '<button data-v="0" class="'+(!SET().sound?'on':'')+'">关</button></div></div>'+
        '<div class="set-row col"><span>背景音乐</span>'+
          '<input type="range" class="lf-range" id="rng-bgm" min="0" max="100" step="5" value="'+Math.round((SET().bgmVol!=null?SET().bgmVol:35))+'">'+
          '<span class="spd-val" id="bgm-val">'+Math.round((SET().bgmVol!=null?SET().bgmVol:35))+'%</span></div>'+
        '<div class="set-row col"><span>音效音量</span>'+
          '<input type="range" class="lf-range" id="rng-sfx" min="0" max="100" step="5" value="'+Math.round((SET().sfxVol!=null?SET().sfxVol:60))+'">'+
          '<span class="spd-val" id="sfx-val">'+Math.round((SET().sfxVol!=null?SET().sfxVol:60))+'%</span></div>'+
        '<div class="set-row col"><span>曲目选择</span><div class="seg" id="seg-bgm-track" style="flex-wrap:wrap;">'+
          (function(){
            try {
              var tracks = SFX.getBgmTracks();
              var cur = SFX.getCurrentBgmIdx();
              return tracks.map(function(t){ return '<button data-idx="'+t.idx+'" class="'+(t.idx===cur?'on':'')+'" style="margin:2px;font-size:11px;padding:4px 8px;">'+t.name+'</button>'; }).join('');
            } catch(e) { return ''; }
          })()+
        '</div></div>'+
        '<p class="tip">四首古风BGM可选，箫笛古琴各有意境；曲间静默5秒。</p>';
      var game='';
      if(!fromTitle){
        game+='<button class="close" id="m-save" style="margin-top:14px;">立即存档</button>';
      }
      game+='<button class="close" id="m-clear" style="background:rgba(120,60,50,.12);color:#8a3b2e;margin-top:10px;">清除全部存档</button>';
      if(!fromTitle){
        game+='<button class="close" id="m-dev" style="background:rgba(176,131,47,.16);color:#8a6a2e;margin-top:10px;">🛠 调试台</button>';
      }
      game+='<p class="tip">设定已存，演武时遵循。</p>'+
        '<p class="tip">当前版本 v'+LF.CONSTANTS.VERSION+'</p>';
      return '<h3>设 置</h3>'+
        '<div class="set-tabs">'+
          '<button data-tab="gfx" class="on">画面</button>'+
          '<button data-tab="snd">声音</button>'+
          '<button data-tab="game">游戏</button>'+
        '</div>'+
        '<div class="set-panel" data-panel="gfx">'+gfx+'</div>'+
        '<div class="set-panel hidden" data-panel="snd">'+snd+'</div>'+
        '<div class="set-panel hidden" data-panel="game">'+game+'</div>';
    }

    // 开发人员名单：群英同撰
    function renderCredit(){
      return '<h3>群 英 同 撰</h3>'+
        '<p class="tip">此作由一人独力编撰，赖 AI 襄助而成。勒名于左，以志其事。</p>'+
        row('总 撰','一只大鸽子')+
        row('执 笔','一只大鸽子')+
        row('程 式','一只大鸽子')+
        row('绘 事','一只大鸽子')+
        row('校 勘','一只大鸽子')+
        row('音 律','一只大鸽子')+
        row('协 力','CodeBuddy（AI 协作）')+
        '<p class="tip">一人一灯，江湖路远。若遇同好，可续刻其名。</p>';
    }

    function topObjectiveText(){
      if(!LF.OBJECTIVES) return '志向';
      for(var i=0;i<LF.OBJECTIVES.length;i++){ if(!LF.OBJECTIVES[i].check(S())) return LF.OBJECTIVES[i].title; }
      return '诸事已了';
    }

    function renderLogPanel(){
      var r=(S() && S().logRing)||[];
      var h='<h3>回 顾</h3>'+
        '<p class="tip log-tip">你听过、读过的近 '+HMAX()+' 句都记在这里（旧句在上）。'+
        '对话帘里的台词、营中的号令、野外的见闻，收帘之后仍可回来翻看。</p>';
      if(!r.length) return h+'<p class="tip q-empty">尚无可回顾之事。</p>';
      h+='<div class="log-pane">';
      var lastLoc='', lastStamp='';
      r.forEach(function(e){
        if(e.r && e.r!==lastLoc){ lastLoc=e.r; lastStamp=''; h+='<div class="log-loc">◆ '+escapeHtml(e.r)+'</div>'; }
        var stamp=(e.s&&e.s!==lastStamp)?('<span class="log-t">'+escapeHtml(e.s)+'</span>'):'';
        lastStamp=e.s||lastStamp;
        h+='<div class="log-line'+(e.c?(' c-'+e.c):'')+'">'+stamp+
           (e.n?('<b>'+escapeHtml(e.n)+'：</b>'):'')+escapeHtml(e.t)+'</div>';
      });
      h+='</div><button class="close" id="m-leave">收 起</button>';
      return h;
    }

    // 升级小弹窗：替代「直接弹出角色面板」，给玩家「去加点 / 忽略」的选择
    function renderLevelup(){
      var lvl=S().level;
      var pts=S().freePoints||0;
      // v20260916c：本轮实际新增点数（addXp 记录）；旧版文案把「已有自由点」全算成「获得」，误导玩家
      var gained=S().levelupGained||0;
      S().levelupGained=0;   // 读取即清，防止下次打开残留
      var maxed=lvl>=G.CONSTANTS.MAX_LEVEL;
      var banner=maxed?'功 行 圆 满':'破 境';
      var sub=maxed? ('修为已臻圆满（LV.'+lvl+'），尚有 '+pts+' 点自由属性点待分配。')
                   : ('破境至 LV.'+lvl+'，获得 '+gained+' 点自由属性点（现有 '+pts+' 点待分配）。');
      return '<div class="levelup-pop">'+
        '<div class="lu-banner">'+banner+'</div>'+
        '<div class="lu-lv">LV.'+lvl+'</div>'+
        '<div class="lu-sub">'+sub+'</div>'+
        '<p class="tip">自由属性点可随时在角色面板分配，不必此刻决定；选「忽略」后，点状态栏或「角色」仍可回来加点。</p>'+
        '<div class="lu-btns">'+
          '<button class="btn lu-go" onclick="openModal(\'char\')">去加点</button>'+
          '<button class="btn lu-skip" onclick="closeModal()">忽略</button>'+
        '</div>'+
      '</div>';
    }

      // 城况面板（v20260825d）：参数 + 城型 + 城门 + 市集清单
      function renderCityStat(cid){
        var p=cityProfile(cid); if(!p) return '<h3>城 况</h3><p class="empty">暂无此城数据。</p>';
        var m=genCityGrid(cid);
        var mkHtml='';
        if(m && m.markets){
          var seen={}, list=[], total=0;
          for(var k in m.markets){
            total++;
            var mk=m.markets[k];
            var _xy=k.split(',');
            // 仅统计已营建、当前可见的市集（与城内地图一致：开发度半径外/遭战火者不计入），避免面板虚报
            if(cellDisplayType(cid, +_xy[0], +_xy[1])!=='market') continue;
            if(!seen[mk.name]){ seen[mk.name]=1; list.push(mk); }
          }
          if(list.length){
            var _tip = (total>list.length) ? ('，另有 '+(total-list.length)+' 处位于未营建/焦土区，待营建或修缮后开放') : '';
            mkHtml='<div class="row"><span>市集（已营建 '+list.length+' 处'+_tip+'）</span></div><div class="city-mk">';
            list.forEach(function(mk){
              var shops=mk.shops.map(function(s){ return s.sign; }).join('、');
              mkHtml+='<div class="mk-i">🏯 <b>'+mk.name+'</b>：'+shops+'</div>';
            });
            mkHtml+='</div>';
          }
        }
        // 在建营造工单（第3步）：列出本城所有「building」状态的 BuildOrder
        var boHtml='';
        var _bo=S().flags.buildOrders;
        if(_bo){
          var boList=[];
          for(var _bid in _bo){ var _o=_bo[_bid]; if(_o && _o.cid===cid && _o.status==='building') boList.push(_o); }
          if(boList.length){
            boHtml='<div class="row"><span>营造工事（'+boList.length+' 处）</span></div><div class="city-mk">';
            boList.forEach(function(_o){
              var _bp=LF.BUILD[_o.blueprintId]||{};
              var _st=(_bp.stages||[]).length;
              boHtml+='<div class="mk-i">🚧 <b>'+(_bp.doneName||'新筑')+'</b>：阶段 '+Math.min((_o.stageIndex||0)+1,_st)+' / '+_st+'　人力 '+(_o.laborPaid||0)+'/'+(_o.laborNeeded||(_bp.labor||2))+'</div>';
            });
            boHtml+='</div>';
          }
        }
        var garrHtml = (LF.Officers ? LF.Officers.renderCityGarrison(cid) : '');
        return '<h3>城 况 · '+p.c.name+'</h3>'+

          row('行政', p.tierDesc)+
          row('城型', p.ctypeDesc)+
          row('城门', (availableGateDirs(cid)||[]).length+' 座')+
          row('城级', cityLevelName(cid)+'（'+cityGridSize(cid)+'×'+cityGridSize(cid)+' 格，建设度 '+cityDevOf(cid)+'）')+
          row('人口', p.popDesc)+
          row('治安', p.orderDesc)+
          row('商业', p.comDesc)+
          row('农业', p.agriDesc)+
          row('城防', (p.c.wall>=60?'高垒深沟': p.c.wall>=45?'城墙完固': p.c.wall>=30?'城垣可守':'防守疏懈'))+
          (mkHtml? mkHtml : '')+
          (boHtml? boHtml : '')+
          (garrHtml? garrHtml : '')+
          '<p class="tip">城型与城门数量已预留：山城/城寨/港口将随城防与商业改变城门布局（plain 为四门）。市集名取「方位·交易物·地理·吉语」可混可单，商铺招牌由字号生成。城内空地可点格「营造」筑新宅新市。</p>';
      }

    return {
      renderCodex, renderSettings, renderCredit,
      topObjectiveText, renderLogPanel, renderLevelup, renderCityStat
    };
  };
})(typeof window !== 'undefined' ? window : global);

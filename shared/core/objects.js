// shared/core/objects.js — 房间互动物件 + 差役牌系统（从 engine.js 抽出，v20261008l）
// 范式：LF.createObjects(ctx) 工厂；state 经 getState 惰性取值(S())；可变引用/函数经 ctx 注入。
window.LF = window.LF || {};
(function () {
  LF.createObjects = function (ctx) {
    var getState = ctx.getState, S = getState;
    var toast = ctx.toast, log = ctx.log, save = ctx.save, renderStatus = ctx.renderStatus,
        advanceMinutes = ctx.advanceMinutes, exert = ctx.exert, packFind = ctx.packFind,
        packAdd = ctx.packAdd, afterPackChange = ctx.afterPackChange, packConsume = ctx.packConsume,
        buildActions = ctx.buildActions, curRoom = ctx.curRoom, busyAct = ctx.busyAct;
    var SHICHEN = ctx.SHICHEN, LABOR_PER_WOOD = ctx.LABOR_PER_WOOD;
    var fxGet = ctx.fxGet;
    var jobOpen = ctx.jobOpen, jobFlag = ctx.jobFlag, jobTick = ctx.jobTick, jobSettle = ctx.jobSettle;
    var farmHas = ctx.farmHas, farmObjects = ctx.farmObjects, farmWater = ctx.farmWater;
    var stoneLoad = ctx.stoneLoad, stoneUnload = ctx.stoneUnload, onbF = ctx.onbF, onbUnlockDock = ctx.onbUnlockDock;
  // ═══ 城格内部：可进入子房间(doors) + 不可进入交互物(objects)（v20260910q 地图框架）═══
  // 通用规则：罗盘=大方位去别处；面板=当前地点内的 rooms/items；NPC 单列。
  // 放 engine.js 而非 city.js：city.js 的 helper 是 LF.createCity(ctx) 内部闭包，
  // 需 return + 别名块才能被 engine 看见；这套只 engine 用，全局最省事。
  var CELL_INTERIORS = {
    'kuyilao|1,0': {
      doors: [
        { label: '天字一号', icon: '🚪', target: 'camp_tz1', group: '天字牢房' },
        { label: '天字二号', icon: '🚪', target: 'camp_tz2', group: '天字牢房' },
        { label: '天字三号', icon: '🚪', target: 'camp_tz3', group: '天字牢房' },
        { label: '地字一号', icon: '🚪', target: 'camp_dz1', group: '地字牢房' },
        { label: '地字二号', icon: '🚪', target: 'camp_dz2', group: '地字牢房' },
        { label: '地字三号', icon: '🚪', target: 'camp_dz3', group: '地字牢房' }
      ],
      objects: [
        { icon:'🪣', label:'水槽', acts:[
          {label:'饮水', icon:'💧', fn:function(){ troughDrinkBy('kuyilao|1,0'); }},
          {label:'添水', icon:'🪣', fn:function(){ troughFillBy('kuyilao|1,0'); }},
          {label:'装水入袋', icon:'💧', fn:function(){ troughDrawToBag('kuyilao|1,0'); }}
        ]},
        { icon:'⏳', label:'铜壶漏刻', acts:[
          {label:'观漏', icon:'⏳', fn:function(){ loukeLook(); }}
        ]}
      ]
    },
    // 中军帐(1,1)：与牢房(1,0)对称，但只管「逃出去」那一摊。教学期只露记工册与刁斗两件，
    //   舆图 / 军报 / 兵器架 / 正帐一律挂在 planningEscape() 门槛后 —— 这一格要摆「担石劳作 / 环顾四周」
    //   的引导，一上来摆满按钮会把引导锚点顶掉（沿用 v20260912f 起「没介绍到的先藏着」的做法）。
    'kuyilao|1,1': {
      doors: [],
      objects: [
        // v20260920h：担石劳作改「装担→卸料」闭环 —— 乱石堆在场院装担，送到仓库卸料台才记一工
        { icon:'🪨', label:'乱石堆', actId:'labor_yard', acts:[
          {label:'装担', icon:'🪨', fn:function(){ stoneLoad(); }}
        ]},
        { icon:'📋', label:'记工木牌', acts:[
          {label:'查工分', icon:'📋', fn:function(){ ledgerLook(); }},
          {label:'看差役', icon:'📜', fn:function(){ jobBoard(); }}
        ]},
        { icon:'🥁', label:'铜刁斗', acts:[
          {label:'击鼓', icon:'🥁', fn:function(){ diaodouStrike(); }}
        ]},
        { icon:'🗺️', label:'舆图沙盘', show: planningEscape, acts:[
          {label:'细看舆图', icon:'🗺️', fn:function(){ yutuLook(); }}
        ]},
        { icon:'📜', label:'军报木牍', show: planningEscape, acts:[
          {label:'翻看军报', icon:'📜', fn:function(){ junbaoLook(); }}
        ]},
        { icon:'⚔️', label:'兵器架', show: planningEscape, acts:[
          {label:'取一件', icon:'⚔️', fn:function(){ rackTake(); }}
        ]}
      ]
    },
    // 农田（0,0）：接了「开垦薄田」才见着待垦的荒地；此后一畦一畦开出来（见 farmObjects）。
    //   未接活时一律不摆 —— 这一格本就有「下地务农」的自由劳作，再堆设施会把格上的引导顶掉。
    //   v20260915g：畦的数目随开出进度变化，故不能在定义时就写死数组（此处常量尚未声明），
    //   改由 cellInteriors 在【运行时】问 farmObjects() 要。
    'kuyilao|0,0': {
      farmObjects: true,
      // v20260924z3：柴林（伐木场）从农田格直接进 —— 薄田东出口是旧营区房间的路，玩家种地都在这一格，
      //   入口必须摆在看得见的地方。伐木与务农同为营内自由劳作，故此门常开、不设任务门槛。
      doors: [
        { label:'柴林（伐木场）', icon:'🌳', target:'camp_woodland', group:'农庄' }
      ]
    },
    // 演武场（2,2）：犬舍单独一间子房（v20260915e）——木人桩留在格上（格型动作），
    //   逗犬进屋，两者隔开：先教打（桩），再教跑（犬）。门槛 = 木人桩已练成（tcDone）。
    'kuyilao|2,2': {
      doors: [
        { label:'犬舍', icon:'🐕', target:'camp_kennel', group:'演武场',
          show: function(){ return !!(S().flags && S().flags.onb && S().flags.onb.tcDone); } }
      ]
    },
    // 伙房（0,1）：灶边水缸 —— 「担水入灶」的落点（打水在囚室水槽，倾水在此处，两头一担挑起来）
    //   v20260915g 另起一口「大灶」：田里种出的菜豆在此下锅 —— 不然种地就是「掐了菜、交了差」便完事，
    //   产出没有第二个去处，农田这块内容也就悬空了。
    'kuyilao|0,1': {
      objects: [
        { icon:'🪣', label:'灶边水缸', show: function(){ return jobOpen('water'); }, acts:[
          {label:'倾水入缸', icon:'💧', fn:function(){ kitchenPour(); }}
        ]},
        { icon:'🍲', label:'大灶', show: function(){ return farmHas('dou',1) || farmHas('yecai',3); }, acts:[
          {label:'煮豆粥（菽豆×1 · 水×2）', icon:'🥣', show: function(){ return farmHas('dou',1); }, fn:function(){ cookDouzhou(); }},
          {label:'野菜入锅（野菜×3）', icon:'🥬', show: function(){ return farmHas('yecai',3); }, fn:function(){ cookYeCai(); }}
        ]}
      ]
    },
    // 岗哨（1,2）：望楼 —— 「瞭望换岗」的落点（看的是时辰：换岗那一刻门洞最乱，正是出营的缝隙）
    'kuyilao|1,2': {
      objects: [
        { icon:'🗼', label:'望楼', show: function(){ return jobOpen('watch'); }, acts:[
          {label:'登楼瞭望', icon:'👁️', fn:function(){ watchLook(); }}
        ]}
      ]
    },
    // 仓库（2,1）：卸料台 + 三翻找点位（v20260920h）
    //   担石搬运闭环的落点：场院装担 → 此处「卸料入仓」记工；卸料台无负重时不放行。
    //   仓中翻找改三点位：麻袋堆/木箱/货架各管各的掉落池、翻空后隔天刷新；任务随机指定目标物。
    'kuyilao|2,1': {
      objects: [
        { icon:'⛏️', label:'卸料台', actId:'haul_stones', acts:[
          {label:'卸料入仓', icon:'🪨', fn:function(){ stoneUnload(); }}
        ]},
        { icon:'🧺', label:'麻袋堆', actId:'rummage_sack', acts:[
          {label:'翻找', icon:'🔍', fn:function(){ rummageFind('sack'); }}
        ]},
        { icon:'📦', label:'木箱', actId:'rummage_box', acts:[
          {label:'翻找', icon:'🔍', fn:function(){ rummageFind('box'); }}
        ]},
        { icon:'🪜', label:'货架', actId:'rummage_shelf', acts:[
          {label:'翻找', icon:'🔍', fn:function(){ rummageFind('shelf'); }}
        ]}
      ]
    }
    // 矿坑（2,0）【不摆设施】：该格是 mine 型，格上本就有「开凿矿料」出石料（city.js 格型动作）。
    //   早前在此另摆一个「岩壁矿脉·凿石」，于是同一格里出现两个都出石料的按钮 —— 纯属重复，撤掉。
  };
  function cellInteriors(cid, x, y){
    var d = CELL_INTERIORS[cid + '|' + x + ',' + y] || null;
    // v20260915g：农田的畦是「开一畦多一畦」，数目随进度变；且定义常量在文件更下方，
    //   故此处运行时再生成（比在表里写死数组干净，也不受声明顺序所累）。
    // v20260920e：农田格另起一口「水井」——打水装袋 / 掬饮 / 浇灌，与畦同格摆（合并，不互顶）。
    // v20260924z5：农田格曾把 doors（柴林入口）一并吞掉——此处只拼 objects 就 return 了。
    //   柴林门定义在 CELL_INTERIORS 里，必须原样带出，否则农庄格看不到伐木场入口。
    if(d && d.farmObjects) return { doors: d.doors || [], objects: farmObjects().concat([wellObject()]) };
    return d;
  }
  // ═══ 农田水井（v20260920e）：夜半添水 / 浇畦的水源。井水取之不竭，只费工夫，不凭空。 ═══
  function wellObject(){
    return { icon:'⛲', label:'水井', acts:[
      { label:'打水', icon:'🪣', fn:function(){ wellDrawToBag(); } },
      { label:'掬饮', icon:'💧', fn:function(){ wellDrink(); } },
      { label:'浇灌', icon:'🌱', fn:function(){ farmWater(0); } }
    ]};
  }
  function wellDrawToBag(){
    var bag=packFind('shuidai');
    if(!bag){ toast('没有水袋，捧不起这井水——开垦薄田能得一只。'); return; }
    var cap=bag.waterCap||10;
    if((bag.water||0)>=cap){ toast('水袋已是满的。'); return; }
    bag.water=cap;
    advanceMinutes(5);
    log('你摇起井绳，汲满一袋清冽井水（水袋 '+cap+' / '+cap+'）。','good');
    save(S()); renderStatus();
  }
  function wellDrink(){
    S().drink=Math.min(S().maxDrink, (S().drink||0)+8);
    advanceMinutes(5);
    log('你扒着井沿掬了几口水，凉意直透喉底（饮 +8）。','good');
    save(S()); renderStatus();
  }
  // ═══ 苦役营牢房设施：水槽(容量+添水) / 值更鼓(击鼓)（v20260910s）═══
  var TROUGH_CAP = 20;   // 水槽容量（饮水单位）；水不凭空生，满则溢
  // fxGet 现由 engine 经 ctx.fxGet 注入（v20261008l 抽取修正：避免 engine 的 Farm 注入找不到 fxGet）
  // 饮槽中水：回复 饮，扣槽水（不凭空）
  function troughDrinkBy(key){
    var f=fxGet(key);
    if(f.water<=0){ toast('水槽见了底，须先添水。'); return; }
    var sip=Math.min(8, f.water);
    f.water-=sip;
    S().drink=Math.min(S().maxDrink, (S().drink||0)+sip);
    advanceMinutes(5);   // v20260917b：饮水/取水 5 分钟
    log('你掬槽中水饮了几口，喉间干涸稍解（饮 +'+sip+'）。','good');
    save(S()); renderStatus();
  }
  // 以水袋向槽添水：容器水倒入，槽满则溢
  function troughFillBy(key){
    var f=fxGet(key);
    if(f.water>=TROUGH_CAP){ toast('水槽已注满，添不下了。'); return; }
    var bag=packFind('shuidai');
    var bw=(bag && bag.water>0)? bag.water : 0;
    if(!bag){ toast('须先得一只水袋，方能向槽中倾水（开垦薄田可得，农田水井打水装袋）。'); return; }
    if(bw<=0){ toast('水袋空空——先去农田那格的水井「打水」再来添槽。'); return; }
    var add=Math.min(bw, TROUGH_CAP-f.water);
    f.water+=add; bag.water=bw-add;
    advanceMinutes(5);   // v20260917b：添水 5 分钟
    log('你将水袋中 '+add+' 份水倾入槽中（槽 '+f.water+' / '+TROUGH_CAP+'）。','good');
    // 夜半添水（v20260915f）：注满即了 —— 这一槽水，够地字号那几位润到天亮。
    if(f.water>=TROUGH_CAP && jobOpen('nightwater') && !jobFlag('nightwater','_done')){
      jobTick('nightwater');
      log('槽水终于漫到沿口。栅后有人哑着嗓子道了句谢——夜半这一槽，是替人解的渴。（修为+20 · 崔九好感+1）','good');
      S().npcFavor=S().npcFavor||{}; S().npcFavor['cui_jiu']=(S().npcFavor['cui_jiu']||0)+1;
      jobSettle('nightwater','night_water',20,0);
    }
    save(S()); renderStatus();
  }
  // 铜壶漏刻（v20260916g）：牢房里那面「值更鼓」换成漏刻——营中钟点从「靠鼓敲」改为「靠漏走」，
  //   与中军帐刁斗不再撞车（一个是滴答观时、一个是槌击报更）。观漏无声无险，只答时辰与换岗。
  function loukeLook(){
    var sh=SHICHEN[S().time%12];
    log('〔滴答〕你凑近铜壶漏刻，铜壶承水，漏箭浮沉，刻度正指「'+sh+'」。营中换岗向在戌时前后，漏尽更敲。','sys');
    save(S());
  }
  // 玩家放置的水槽（PLACE_ACTIONS）：水量存于放置条目 p.water
  function shuicaoDrinkPlaced(p){
    if((p.water||0)<=0){ toast('水槽见了底，须先添水。'); return; }
    var sip=Math.min(8, p.water);
    p.water-=sip;
    S().drink=Math.min(S().maxDrink, (S().drink||0)+sip);
    log('你掬槽中水饮了几口，喉间干涸稍解（饮 +'+sip+'）。','good');
    save(S()); renderStatus();
  }
  function shuicaoFillPlaced(p){
    if((p.water||0)>=TROUGH_CAP){ toast('水槽已注满，添不下了。'); return; }
    var bag=packFind('shuidai');
    var bw=(bag && bag.water>0)? bag.water : 0;
    if(!bag){ toast('须先得一只水袋，方能向槽中倾水（开垦薄田可得，农田水井打水装袋）。'); return; }
    if(bw<=0){ toast('水袋空空——先去农田那格的水井「打水」再来添槽。'); return; }
    var add=Math.min(bw, TROUGH_CAP-(p.water||0));
    p.water=(p.water||0)+add; bag.water=bw-add;
    log('你将水袋中 '+add+' 份水倾入槽中（槽 '+p.water+' / '+TROUGH_CAP+'）。','good');
    save(S()); renderStatus();
  }
  // 从水槽向水袋装水：槽水倒入水袋，受水袋容量( waterCap )限制（水袋可随身盛水，去别处再添槽）
  function troughDrawToBag(key){
    var f=fxGet(key);
    if(f.water<=0){ toast('水槽空了，无水解渴。'); return; }
    var bag=packFind('shuidai');
    if(!bag){ toast('须先得一只水袋，方能从此槽中盛水（开垦薄田可得，农田水井打水装袋）。'); return; }
    var cap=bag.waterCap||10, cur=(bag.water||0);
    if(cur>=cap){ toast('水袋已满，盛不下了。'); return; }
    var take=Math.min(f.water, cap-cur);
    f.water-=take; bag.water=cur+take;
    advanceMinutes(5);   // v20260917b：取水/装水 5 分钟
    log('你以槽中水注满水袋（水袋 '+bag.water+' / '+cap+'）。','good');
    save(S()); renderStatus();
  }
  function shuicaoDrawToBag(p){
    if((p.water||0)<=0){ toast('水槽空了，无水解渴。'); return; }
    var bag=packFind('shuidai');
    if(!bag){ toast('须先得一只水袋，方能从此槽中盛水（开垦薄田可得，农田水井打水装袋）。'); return; }
    var cap=bag.waterCap||10, cur=(bag.water||0);
    if(cur>=cap){ toast('水袋已满，盛不下了。'); return; }
    var take=Math.min(p.water, cap-cur);
    p.water=(p.water||0)-take; bag.water=cur+take;
    log('你以槽中水注满水袋（水袋 '+bag.water+' / '+cap+'）。','good');
    save(S()); renderStatus();
  }
  // ═══ 苦役营·中军帐设施（v20260914d）═══
  // 与牢房(1,0)分工：牢房管「活下去」（水槽解渴 / 更鼓探时辰 / 草荐打盹），
  //   中军帐管「逃出去」——记工册答「还欠几分工」，舆图军报给出营要用的虚实，兵器架刁斗是拿命去换的冒险。
  // 牢头白日在场院督工、戌时起回牢门口守夜（见 data/npc_cards.js 的 routine）——器械动得动不得，就看他在不在。
  function laotouOnYard(){
    var t=S().time%12;
    return !(t===10||t===11||t===0||t===1||t===2);
  }
  // 是否已起了出营的心思：中军帐的进阶设施自此才现形（教学期这一格要摆「担石劳作/环顾四周」的引导，
  //   一上来多塞五个按钮会把引导锚点顶掉，故一律收在门槛后）
  function planningEscape(){ return !!(S().flags && S().flags.route && S().flags.route.crypt); }
  // 记工木牌：工分 / 木片 / 旷役 —— 营中规则的日常面，教学期也可点，且正答「干了半天攒了几分」
  function ledgerLook(){
    var o=onbF();
    if(!o || !o.started){ log('〔记工册〕工册上还没有你的名字——你是新押入的囚徒，待牢头录名后，才有工分可查。','sys'); return; }
    if(o.done){ log('〔记工册〕册上早没了你的名字——你已脱籍。','sys'); return; }
    var cnt=o.workCnt||0, per=LABOR_PER_WOOD||3, need=per-(cnt%per);
    var pai=packFind('lao_pai'), have=pai?(pai.count||1):0, miss=o.missCount||0;
    log('〔记工册〕名下已记 '+cnt+' 工，手上有「劳字木片」'+have+' 枚；再干 '+need+' 工，可换下一枚。','sys');
    // v20260914g：工分与木片的来路去处，此前全营没有一处写明（玩家挣到木片，却不知往哪使、该交给谁）。
    //   记工册正是管这件事的地方，故让它把这条链答全：工分 → 木片 → 伙房换饭 → 交到人手上。
    log('〔记工册〕木片是营里的钱：干活记工，满 '+per+' 工发一枚，拿它往营西伙房换饭；换来的干粮须交到人手上（点那人，选「给予」），空手说一句不算数。','sys');
    if(miss>0) log('〔记工册〕名下另有旷役 '+miss+' 次——每记一次，当日便扣一份口粮、惹牢头一顿脸色。','warn');
  }
  // 刁斗：击鼓报更。中军帐的鼓是号令鼓，比牢房那口漏刻更招人（与 loukeLook 对称）
  function diaodouStrike(){
    var f=fxGet('kuyilao|1,1|dou');
    f.strikes=(f.strikes||0)+1;
    log('〔当——〕你一槌敲在刁斗上，声震全营。此刻乃「'+SHICHEN[S().time%12]+'」。','sys');
    if(laotouOnYard()) log('牢头隔着半个场院瞪过来：「敲你娘的丧钟！再敲，今夜的口粮没了。」','warn');
    else log('夜深，刁斗声荡开去，岗上戍卒探头骂了两句，又缩回去了。','sys');
    if(f.strikes>3) toast('刁斗连响数通，营中已四下张望——再敲必惹祸上身。');
    save(S());
  }
  // 舆图沙盘：营盘九格 + 换岗时辰 + 水渠走向（水渠夜遁线的由头）
  function yutuLook(){
    log('〔舆图〕营盘方方正正九格：北列农田、囚室、矿坑；中为伙房、中军帐、仓库；南列军营、岗哨、演武场。','sys');
    log('〔舆图〕一道水渠自伙房那侧穿墙而出，通到墙外的河沟——图上只注了「排水」二字。','sys');
    log('〔舆图〕换岗在戌时前后，鼓响三通；子时最松，岗上只余两人。','sys');
    // v20260914f：看过舆图，顺手把「山河」放行 —— 顺着一张营盘图，头一回晓得外头还有州郡。
    //   解锁口径与别处一致（onbUnlockDock + Guide 高亮，见「角色」「行囊」的首次解锁）；
    //   教学期这颗页签本是藏着的（body.onb），不这么做，玩家出了营才第一次见着山河志。
    var o=onbF();
    if(o && !o.done && (!o.unlocked || o.unlocked.indexOf('map')<0)){
      onbUnlockDock('map');
      log('你把图上那几条道记熟了，目光顺着营墙往外挪——墙外是渔阳，再往外是幽州，更远处还有十来个州。','sys');
      log('〔山河〕点下方「🗺️ 山河」，可看这一带的州郡城池。眼下你还走不出去，先把路记在心里。','sys');
      try{ if(LF.Guide && LF.Guide.ping) LF.Guide.ping({dock:'map'}); }catch(e){}
    }
  }
  // 军报木牍：营中虚实（收买线的由头）
  function junbaoLook(){
    log('〔军报〕「渔阳戍卒二百，屯粮不足旬月。」「营中苦役三百余，逃者七，追回三。」','sys');
    log('〔军报〕最末一牍墨迹未干：粮官贪杯，犬卒好赌——银钱到手，睁一只眼闭一只眼。','sys');
  }
  // 兵器架：白日动手吃一鞭；趁夜取械 → 开出「劫狱强攻线」的第三条前置（原只有等级≥3 / 戳通木人桩）
  function rackTake(){
    var o=onbF();
    if(!o || !o.started || o.done){ toast('你已脱籍，营中器械与你无干。'); return; }
    if(S().flags.route && S().flags.route.rack){ toast('你已藏下一件，贪多必失。'); return; }
    if(laotouOnYard()){
      log('你手刚搭上枪杆，背后一声暴喝：「作死！」牢头的鞭梢已抽在手背上，火辣辣一条血棱。','warn');
      S().hp=Math.max(1,(S().hp==null?(S().maxHp||100):S().hp)-8);
      renderStatus(); save(S());
      return;
    }
    if(!exert('取械')) return;
    if(!S().flags.route) S().flags.route={};
    S().flags.route.rack=true;
    log('〔得械〕你抽了一杆钝头枪，塞进塌墙根的乱砖底下——真要硬闯岗哨，手里总得有件家伙。','good');
    save(S());
  }
  // ═══ 苦役营·差役牌（v20260914e 立，v20260914f 改）═══
  // 木牌就是派活的地方：营里的差事全钉在上头 —— 谁要的、去哪干、做出来交到谁手上。
  //   领活在此（摘木牍）→ 去那一格实地做工、做出实物 → 回头寻收差的那位，走给予面板把东西交出去（真扣行囊）。
  //   交差判定挂在 onGive 触发器上（triggers.js kyl_farm_give / kyl_stone_give），不靠对话复命 ——
  //   对话复命那一套是「空着手说一句就完事」，东西还躺在行囊里，算不得交差。
  // 只留两条，且刻意不重样：田里出菜（交伙房）、矿里出石（交仓库）。
  var JOB_BOARD = [
    { key:'farm', quest:'camp_farm', title:'开垦薄田',
      word:'孙老要的：薄田三垄，翻透，掐两捧菜，交伙房鲁大',
      take:'你把「开垦薄田」那片木牍摘了下来。',
      tip:'去营北农田那格：翻三垄开出第一畦 → 播菜籽 → 约三时辰后采收。地是九畦的园子，开出几畦看你肯下多少工；浇过水的早熟，该收不收会枯。菜捧去伙房，点鲁大、选「给予」交到他手上。' },
    { key:'stone', quest:'stone', title:'采石充仓',
      word:'仓吏要的：矿坑凿青石五块，交仓库',
      take:'你把「采石充仓」那片木牍摘了下来。',
      tip:'去营东北矿坑，就格上「开凿矿料」凿够五块石料；扛回仓库，点仓吏、选「给予」，把石料交到他手上。' },
    // v20260915f：第二批 —— 四桩「要跑腿、要使唤东西」的差事。
    //   与田里出菜、矿里出石的区别在：不产实物，产的是「跑这一趟」本身（水、话、时辰、拳脚）。
    { key:'water', quest:'water_cook', title:'担水入灶',
      word:'鲁大要的：囚室水槽打两袋水，倾进伙房灶边水缸',
      take:'你把「担水入灶」那片木牍摘了下来。',
      tip:'去农田那格的水井「打水」装满水袋，再往伙房那格点「灶边水缸」倾进去——两趟。' },
    { key:'dummy', quest:'dummy_train', title:'木人试艺',
      word:'韩铁要的：演武场木人桩，戳倒三回',
      take:'你把「木人试艺」那片木牍摘了下来。',
      tip:'去演武场（有木人桩那格）戳木人桩，打赢三回——跑掉不算，得把它戳倒。' },
    { key:'errand', quest:'errand_word', title:'捎句话',
      word:'孙老托的：带一句话给牢头，再回来回他个话',
      take:'你把「捎句话」那片木牍摘了下来。',
      tip:'去农田找孙老，问他要捎什么话 → 往中军场院寻牢头把话带到 → 回来与孙老回一声。' },
    { key:'watch', quest:'watch_shift', title:'瞭望换岗',
      word:'秦九霄要的：岗哨望楼看一回换岗，回来报时辰',
      take:'你把「瞭望换岗」那片木牍摘了下来。',
      tip:'去营东北岗哨那格点「登楼瞭望」记下换岗在几时，再回来与秦九霄说一声。' },
    // v20260915f：第三批 —— 地字号那三间的差事（送粥 / 添水 / 翻找）。
    //   前两桩是「给人递点东西」：一碗粥、一槽水，东西轻，落到人身上才重。
    { key:'porridge', quest:'porridge_visit', title:'送粥探监',
      word:'林娘托的：地字二号那个藏饼的少年，送一碗粥过去',
      take:'你把「送粥探监」那片木牍摘了下来。',
      tip:'先在伙房换一碗粥（过了饭点换到的正是粥），再往地字二号牢房，点那瘦少年、选「给予」，把粥递到他手上。' },
    { key:'nightwater', quest:'night_water', title:'夜半添水',
      word:'囚友求的：牢房那槽水快见底了，添满它',
      take:'你把「夜半添水」那片木牍摘了下来。',
      tip:'往囚室那格的水槽点「添水」，把槽水注满——添满即了（水不够就多打几袋）。' },
    { key:'rummage', quest:'store_rummage', title:'仓中翻找',
      word:'仓吏要的：仓库翻出一件指定的旧物，交还仓里',
      take:'你把「仓中翻找」那片木牍摘了下来。',
      tip:'去仓库那格，翻「麻袋堆 / 木箱 / 货架」三处（各管各的货，翻过即空、隔天再来）——翻到仓吏点名要的那件，点仓吏、选「给予」交到他手上。' },
    // v20260915i：矿坑改版差役——铜矿出自矿洞三层以下（青铜镐的三条来路之一：制作 / 市集 / 差役）
    { key:'copper', quest:'mine_copper', title:'淘铜铸镐',
      word:'仓吏要的：矿洞三层以下古铜脉，凿铜矿四块，交仓库',
      take:'你把「淘铜铸镐」那片木牍摘了下来。',
      tip:'入矿洞下到第三层起，寻「古铜脉」凿取铜矿（粗石镐凿不动，先换精致石镐或青铜镐）——凑足四块回仓库，点仓吏、选「给予」，把铜矿交到他手上。' }
  ];
  // 差役牌面板（v20260915b）：木牌上钉着几片木牍，摘一片领一桩活
  // v20260916h：木牍改「缩略 → 点击展开」——默认只露状态印与活名，一屏能多排几片；
  //   点活名那行展开全部（一句话、指引、操作），再点收起。摘牍后刚领的那片自动展开。

  // 看差役牌（v20260915b）：从对话文字流改为木牍面板 —— 木牌质感 + 一片木牍一桩活

  // ═══ 差役记账（v20260915f）═══
  // 牌上摘牍只是接活；做一次记一笔（jobTick），够了翻牍发赏（jobSettle）。
  //   各处只管调这两个，不必各自拼 flags 路径 —— 也免得「记了数却忘了翻牍」这类漏账。

  // ═══ 担水入灶（v20260915f）：囚室水槽打水 → 伙房灶边水缸倾进去 ══
  //   水是营里的硬通货（解渴 / 添槽 / 和泥都靠它）。这一趟的意义在「两头跑」：
  //   打水在一处、用场在另一处，营里的日子本就是这么串起来的。
  var WATER_PER_TRIP = 5;                       // 倾一袋入缸：满五份水才算一趟
  function kitchenPour(){
    if(!jobOpen('water')){ toast('没人使唤你担水，别在灶前碍事。'); return; }
    var bag=packFind('shuidai');
    if(!bag || !(bag.water>0)){ toast('水袋空空——先去农田那格的水井「打水」装袋。'); return; }
    if(!exert('担水入灶')) return;
    busyAct('倾水入缸', 900, function(){
      var pour=Math.min(WATER_PER_TRIP, bag.water);
      bag.water-=pour;
      advanceMinutes(60);
      var n=jobTick('water');
      log('你把水袋里 '+pour+' 份水倾进灶边那口大缸，缸沿浮起一层浮沫。（已担 '+n+' / 2 趟）','good');
      if(n>=2){
        log('〔差役了结·担水入灶〕鲁大舀了半瓢稠的递来：「水担得勤，锅里的食便稠些——往后这缸，就归你管了。」（干粮×1 · 修为+20 · 鲁大好感+1）','good');
        packAdd('fan',1); afterPackChange();
        S().npcFavor=S().npcFavor||{}; S().npcFavor['lu_da']=(S().npcFavor['lu_da']||0)+1;
        jobSettle('water','water_cook',20,0);
      } else { save(S()); renderStatus(); }
      buildActions(curRoom());
    });
  }
  // ═══ 瞭望换岗（v20260915f）：岗哨登楼看一回，记下换岗在几时，回来报与秦九霄 ══
  //   看的是「时辰」——换岗那一刻门洞最乱，这条缝隙正是出营的本钱。
  var WATCH_HOUR = 10;                          // 戌时前后换岗（与更鼓那套口径一致）
  function watchLook(){
    if(!jobOpen('watch')){ toast('无令不得登楼——守卒的横眼正盯着你。'); return; }
    if(!exert('登楼瞭望')) return;
    busyAct('登楼瞭望', 1000, function(){
      advanceMinutes(60);
      var h=S().time%12, sh=SHICHEN[h];
      var d=Math.abs(h-WATCH_HOUR), near=(d<=1 || d>=11);
      S().flags=S().flags||{}; S().flags.task=S().flags.task||{};
      S().flags.task.watch_seen=sh;
      log('你伏在望楼垛口看了半晌：此刻'+sh+'，'+(near?'正撞上换岗——两班守卒在门洞下交割腰牌，乱了一阵。':'岗上的兵交班还早，只听得见风穿过箭楼。'),'env');
      if(near) log('〔记下了〕换岗就在'+sh+'前后——这一刻门洞下最乱，是条缝。','good');
      else log('（换岗在戌时前后，那时候再来一趟，才看得出门道。）','sys');
      save(S()); renderStatus();
    });
  }
  // ═══ 仓中翻找（v20260915f 立；v20260920h 改三点位）═══
  //   从前的「点一下随机出货」改成：仓库里三处可翻的点位（麻袋堆/木箱/货架），各管各的掉落池；
  //   翻过即翻空，当日不再出（隔天刷新）；接「仓中翻找」差事时仓吏随机指定目标物（flags.task.rummage_target），
  //   翻到目标物交回才算完 —— 翻到别的可留可交（给仓吏则按物品价值换好感，不会吞东西）。
  // v20260915g：只翻【已登记】的通用物资——凡能进背包的，必先在 items.js 登记、再引用。
  var RUMMAGE_SPOTS = {
    sack:  { label:'麻袋堆', pool:[['bumu',0.5],['rope',0.3],['mucai',0.2]] },
    box:   { label:'木箱',   pool:[['mucai',0.5],['rope',0.3],['shitiao',0.2]] },
    shelf: { label:'货架',   pool:[['mucai',0.4],['bumu',0.4],['rope',0.2]] }
  };
  function rummageTarget(){ var t=S().flags.task||{}; return t.rummage_target||null; }
  function rummageFind(spot){
    var def=RUMMAGE_SPOTS[spot]; if(!def) return;
    if(!jobOpen('rummage')){ toast('仓里的东西不是你能乱翻的。'); return; }
    var t=S().flags.task||{};
    var em=t.rummageEmptied||(t.rummageEmptied={});
    if(em[spot]===S().day){ toast(def.label+'已经翻空了——过一夜再来，或去别的堆翻翻。'); return; }
    if(!exert('翻找'+def.label)) return;
    busyAct('翻找'+def.label, 1000, function(){
      advanceMinutes(60);
      var r=Math.random(), id=null, acc=0;
      for(var i=0;i<def.pool.length;i++){ acc+=def.pool[i][1]; if(r<acc){ id=def.pool[i][0]; break; } }
      if(!id) id=def.pool[0][0];
      if(!packAdd(id,1)){ toast('行囊塞不下——腾出一格再来翻。'); return; }
      em[spot]=S().day;                 // 翻空：当日不再出，隔天刷新
      var tgt=rummageTarget();
      var its=window.LF && LF.ITEMS && LF.ITEMS.DEFS ? LF.ITEMS.DEFS : {};
      var itd=its[id]||{};
      var hit = tgt && tgt===id;
      var msg='你在'+def.label+'里摸出'+(itd.icon||'🔧')+'「'+(itd.name||id)+'」';
      if(hit) msg+='——正是仓吏要的那件！回去点仓吏、选「给予」交到他手上。';
      else if(tgt) msg+='（仓吏要的是「'+((its[tgt]||{}).name||tgt)+'」，这件的他不收；留着或另递。）';
      else msg+='。';
      log(msg,'good');
      afterPackChange(); save(S()); renderStatus(); buildActions(curRoom());
    });
  }

  // ═══ 伙房大灶：把田里的产出煮成热食（v20260915g）═══
  //   农田出菜豆、伙房出热食 —— 两头接上，「种地」才不只是掐两捧菜去交差。
  //   热食也顶「灶上一口热饭」那桩例事（LF.onEat 已认豆粥），于是 田间 → 灶上 → 例事 自成一环。
  //   一律【先加产出、后扣料】：行囊塞不下时料还攥在手里，不至于白扔一把豆子。
  function cookDouzhou(){
    if(!farmHas('dou',1)){ toast('没有菽豆——去田里种一茬，或拿别的东西与人换。'); return; }
    var bag=packFind('shuidai');
    if(!bag || (bag.water||0)<2){ toast('熬粥要水：水袋里不足两份（先去农田那格的水井「打水」装袋）。'); return; }
    if(!exert('煮豆粥')) return;
    busyAct('煮豆粥', 1000, function(){
      if(!packAdd('douzhou',1)){ toast('行囊塞不下——腾出一格再煮。'); return; }
      packConsume('dou',1); bag.water=(bag.water||0)-2;
      advanceMinutes(60);
      log('你把菽豆下锅，添两瓢水，灶膛的火舌舔着锅底。不多时豆香漫开——得「豆粥」×1。（回食 22、水 6）','good');
      afterPackChange(); save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 野菜入锅：三捧野菜换一碗稀粥（菜太寡，鲁大添半勺杂粮）——复用既有的「稀粥」，不另立新物
  function cookYeCai(){
    if(!farmHas('yecai',3)){ toast('野菜不足三捧——大灶不值当为两片叶子生火。'); return; }
    if(!exert('野菜入锅')) return;
    busyAct('野菜入锅', 900, function(){
      if(!packAdd('xizhou',1)){ toast('行囊塞不下——腾出一格再煮。'); return; }
      packConsume('yecai',3);
      advanceMinutes(60);
      log('三捧野菜下了锅。鲁大舀半勺杂粮添进去：「菜太寡，得搭把米才压得住饥。」——得「稀粥」×1。','good');
      afterPackChange(); save(S()); renderStatus(); buildActions(curRoom());
    });
  }
    return {
      CELL_INTERIORS: CELL_INTERIORS, JOB_BOARD: JOB_BOARD, cellInteriors: cellInteriors,
      wellObject: wellObject, wellDrawToBag: wellDrawToBag, wellDrink: wellDrink,
      troughDrinkBy: troughDrinkBy, troughFillBy: troughFillBy, loukeLook: loukeLook,
      shuicaoDrinkPlaced: shuicaoDrinkPlaced, shuicaoFillPlaced: shuicaoFillPlaced,
      troughDrawToBag: troughDrawToBag, shuicaoDrawToBag: shuicaoDrawToBag,
      laotouOnYard: laotouOnYard, planningEscape: planningEscape, ledgerLook: ledgerLook,
      diaodouStrike: diaodouStrike, yutuLook: yutuLook, junbaoLook: junbaoLook,
      rackTake: rackTake, kitchenPour: kitchenPour, watchLook: watchLook,
      rummageFind: rummageFind, cookDouzhou: cookDouzhou, cookYeCai: cookYeCai,
      rummageTarget: rummageTarget
    };
  };
})();

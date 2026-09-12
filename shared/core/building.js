// 可进入建筑系统：屋舍面板 + 建筑数据表 + 进出楼房间逻辑（v20260909h）
// 从 engine.js 拆出：
//  - BUILDINGS（建筑定义数据表：药铺/布庄/食肆/杂货/营造所/酒楼/染坊/糕点铺/钱庄/铁匠/武馆/镖局/茶楼/赌馆/马行/书肆/香烛店，与 city.js 共享）；
//  - 进出楼房间逻辑：isBldRoom / bldForRoom / bldRoom / enterBldRoom / bldMove / leaveBldRoom / hasCount；
//  - 建筑面板：bldCurArea / bldDef / renderBuildingPanel / bindBuildingPanel。
// 依赖经 ctx 注入：getState/S（引擎读档/新建会重绑 state，须惰性取值）；getBuildingState（openModal 会整体重赋值，须 getter）；
// bldActsFilter（被房间物件系统复用，留在引擎）；getCard/getCurrentModalKind（引擎 UI 状态）；getCombatMode（引擎可变状态，getter）；
// itemIconHTML / LF（LF.BUILD 蓝图）/ openModal / closeModal / renderStatus / toast / log / renderRoom / advanceTime /
// exert / packFind / packAdd / packConsume / itemKey / usePackItem / bldZihao / setCityDev / cityDevOf。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createBuilding = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getBuildingState = ctx.getBuildingState;
    var LF = ctx.LF, itemIconHTML = ctx.itemIconHTML, bldActsFilter = ctx.bldActsFilter;
    var packFind = ctx.packFind, packAdd = ctx.packAdd, packConsume = ctx.packConsume;
    var exert = ctx.exert, log = ctx.log, toast = ctx.toast, renderStatus = ctx.renderStatus;
    var itemKey = ctx.itemKey, usePackItem = ctx.usePackItem, bldZihao = ctx.bldZihao;
    var setCityDev = ctx.setCityDev, cityDevOf = ctx.cityDevOf;
    var advanceTime = ctx.advanceTime, renderRoom = ctx.renderRoom;
    var getCombatMode = ctx.getCombatMode;
    var getCard = ctx.getCard, getCurrentModalKind = ctx.getCurrentModalKind;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;

  function bldCurArea(b){
    var key=getBuildingState().area||'root';
    if(key==='root' || !b.areas || !b.areas[key]){
      var npcs=(b.interior||[]).filter(function(e){return e.kind==='npc';});
      if(b.rootExtraNpcs) npcs=npcs.concat(b.rootExtraNpcs);
      var objs=(b.interior||[]).filter(function(e){return e.kind==='obj';});
      if(b.rootExtraObjs) objs=objs.concat(b.rootExtraObjs);
      return { name:(b.rootName||b.name), icon:b.icon, desc:b.sub, npcs:npcs, objs:objs, areas:(b.subAreas||[]), isRoot:true };
    }
    return b.areas[key];
  }
  function bldDef(){
    if(!getBuildingState()) return null;
    // 玩家营造的蓝图建筑：用 LF.BUILD[蓝图id] 的动态 interior 临时构造屋舍定义
    if(getBuildingState().bp){
      var bp=LF.BUILD[getBuildingState().bp]; if(!bp) return null;
      return { name:bp.doneName||'屋舍', icon:itemIconHTML({name:bp.doneName||'屋舍'},13), sub:bp.desc||'',
        interior:bp.interior||[], rootName:bp.rootName, subAreas:bp.subAreas, areas:bp.areas,
        rootExtraNpcs:bp.rootExtraNpcs, rootExtraObjs:bp.rootExtraObjs };
    }
    return BUILDINGS[getBuildingState().building] || null;
  }
  function renderBuildingPanel(){
    var b=bldDef();
    if(!b) return '<div class="empty">此处并无屋舍。</div>';
    var area=bldCurArea(b);
    if(getBuildingState().sel!=null){
      var list=(getBuildingState().selKind==='obj')? area.objs : area.npcs;
      var e=list[getBuildingState().sel];
      if(!e){ getBuildingState().sel=null; return renderBuildingPanel(); }
      var h='<div class="bld-crumb">'+b.icon+((getState()&&getState().flags&&getState().flags.bldEnt&&getState().flags.bldEnt.sign)||b.name)+' › '+area.name+'</div>';
      h+='<div class="bld-detail">';
      h+='<div class="bld-d-head">'+e.icon+' '+e.name+' <span class="bld-ent-ki">'+(getBuildingState().selKind==='obj'?'物件':'人物')+'</span></div>';
      h+='<div class="bld-d-desc">'+e.desc+'</div>';
      h+='<div class="bld-acts">';
      bldActsFilter(e.acts).forEach(function(a,ai){ h+='<button class="btn bld-act'+(a.danger?' danger':'')+'" data-ai="'+ai+'">'+a.icon+' '+a.label+'</button>'; });
      h+='</div><button class="btn bld-back" data-back="1">返 回</button>';
      h+='</div>';
      return h;
    }
    var h='<div class="bld-crumb">'+b.icon+' '+((getState()&&getState().flags&&getState().flags.bldEnt&&getState().flags.bldEnt.sign)||b.name)+'</div>';
    h+='<h3>'+area.icon+' '+area.name+'</h3>';
    h+='<div class="bld-sub">'+area.desc+'</div>';
    h+='<div class="bld-list">';
    (area.npcs||[]).forEach(function(e,i){ h+='<div class="bld-ent bld-npc" data-kind="npc" data-i="'+i+'"><span class="bld-ent-ic">'+e.icon+'</span><span class="bld-ent-nm">'+e.name+'</span><span class="bld-ent-ki">人物</span></div>'; });
    (area.objs||[]).forEach(function(e,i){ h+='<div class="bld-ent bld-obj" data-kind="obj" data-i="'+i+'"><span class="bld-ent-ic">'+e.icon+'</span><span class="bld-ent-nm">'+e.name+'</span><span class="bld-ent-ki">物件</span></div>'; });
    h+='</div>';
    if(area.areas && area.areas.length){
      h+='<div class="bld-areas">';
      area.areas.forEach(function(a){ h+='<button class="btn bld-area" data-area="'+a.key+'">'+a.label+'</button>'; });
      h+='</div>';
    }
    // 注：建筑内无方向罗盘，退出统一由房间底部「返回街巷/返回正堂」按钮（move-bar）完成，故弹窗不再重复放置导航按钮，避免繁琐
    return h;
  }
  function bindBuildingPanel(){
    var b=bldDef();
    if(!b) return;
    var area=bldCurArea(b);
    if(getBuildingState().sel!=null){
      var list=(getBuildingState().selKind==='obj')? area.objs : area.npcs;
      var e=list[getBuildingState().sel];
      if(e){
        getCard().querySelectorAll('.bld-act').forEach(function(el){
          el.onclick=function(){ var a=bldActsFilter(e.acts)[+el.getAttribute('data-ai')]; if(a&&a.fn){ a.fn(); if(getCurrentModalKind()==='building') openModal('building'); } };
        });
      }
      var back=getCard().querySelector('.bld-back'); if(back) back.onclick=function(){ getBuildingState().sel=null; openModal('building'); };
      return;
    }
    getCard().querySelectorAll('.bld-ent').forEach(function(el){
      el.onclick=function(){ getBuildingState().selKind=el.getAttribute('data-kind'); getBuildingState().sel=+el.getAttribute('data-i'); openModal('building'); };
    });
    getCard().querySelectorAll('.bld-area').forEach(function(el){
      el.onclick=function(){ if(getBuildingState().stack) getBuildingState().stack.push(getBuildingState().area); getBuildingState().area=el.getAttribute('data-area'); getBuildingState().sel=null; openModal('building'); };
    });
    var up=getCard().querySelector('.bld-up'); if(up) up.onclick=function(){ if(getBuildingState().stack && getBuildingState().stack.length) getBuildingState().area=getBuildingState().stack.pop(); else getBuildingState().area='root'; getBuildingState().sel=null; openModal('building'); };
    var exit=getCard().querySelector('.bld-exit'); if(exit) exit.onclick=function(){ closeModal(); };
  }

  
  // ══ 建筑物内部交互系统（v20260824e）══
  // 药铺/布庄/食肆/杂货/营造所 皆为「可进入的屋舍」：进入后与内部 NPC、功能物件交互，取代原一键式空泛交互
  var BUILDINGS = {
    yaofu: {
      name:'济世药铺', icon:'🧪', sub:'门悬药葫芦，柜列百草，药香盈室',
      interior: [
        { kind:'npc', name:'坐堂大夫', icon:'👴', desc:'须发皆白的老郎中，悬壶济世，深谙岐黄。', acts:[
          { label:'问诊', icon:'💬', fn:function(){
              var s='老大夫搭上你的脉门，沉吟片刻。';
              if(packFind('jinchuang')) s+='「你带有金疮药，若金创未愈，可让老夫为你敷上。」';
              else if(packFind('caoyao')) s+='「身有草药几味，可取药炉炼作金疮药，便于外敷。」';
              else s+='「伤药无多，且往药柜翻检药斗，或市集采买些草药罢。」';
              log(s,'sys'); openModal('building'); } },
          { label:'施治·敷金疮药', icon:'🩹', fn:function(){
              var idx=-1; for(var i=0;i<S().pack.length;i++){ var c=S().pack[i]; if(c && itemKey(c)==='jinchuang'){ idx=i; break; } }
              if(idx<0){ toast('你身上并无金疮药，须先备药。'); return; }
              usePackItem(idx);
              log('老大夫就着灯火为你敷药包扎，创处一阵清凉，血止痛缓。','sys');
              openModal('building'); } }
        ]},
        { kind:'npc', name:'抓药药商', icon:'🧑‍💼', desc:'柜后司药的伙计，算盘拨得噼啪响。', acts:[
          { label:'采买药材', icon:'🪙', fn:function(){ openModal('shop', {shop:'doctor'}); } },
          { label:'交谈', icon:'💬', fn:function(){ log('药商笑道：「客官有所不知，'+bldZihao()+'的药草须得依方配伍，单味可不成气候。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'药柜', icon:'🗄️', desc:'百格药斗，分门别类贮着各色药材。', acts:[
          { label:'翻检药斗', icon:'🤲', fn:function(){ if(!exert('翻检')) return; if(packAdd('caoyao',1)) log('你于药斗中取得一束草药，收入行囊。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'捣药罐', icon:'⚗️', desc:'青石药臼，捣药之声笃笃。', acts:[
          { label:'捣制药草', icon:'🥄', fn:function(){ if(!packFind('caoyao')){ toast('行囊里没有可捣的草药。'); return; } if(!exert('捣药')) return; packConsume('caoyao',1); packAdd('yaofen',1); log('你将草药投入臼中，捣作细粉，清香扑鼻。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'药炉', icon:'🔥', desc:'炭火熊熊的炼药炉，丹火不熄。', acts:[
          { label:'炼制金疮药', icon:'🧪', fn:function(){ if(!packFind('caoyao')){ toast('炼药需先有草药，去药柜翻检罢。'); return; } if(!exert('炼药')) return; packConsume('caoyao',1); packAdd('jinchuang',1); log('炉火淬炼，草药凝作一瓶金疮药。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'炼药台', icon:'⚗️', desc:'青玉案几，用以合药配伍。', acts:[
          { label:'合炼汤药', icon:'🍵', fn:function(){ if(!packFind('jinchuang')||!packFind('yaofen')){ toast('需备金疮药与草药粉各一，方可合炼。'); return; } if(!exert('合药')) return; packConsume('jinchuang',1); packConsume('yaofen',1); packAdd('tangyao',1); log('金疮药合草药粉，于台上熬炼成一碗汤药。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'熬药壶', icon:'🫖', desc:'小炭炉上坐着药壶，咕嘟作响。', acts:[
          { label:'熬制汤药', icon:'🍲', fn:function(){ if(!hasCount('caoyao',2)){ toast('熬汤药须草药两味，药柜可取。'); return; } if(!exert('熬药')) return; packConsume('caoyao',2); packAdd('tangyao',1); log('文火慢熬，草药化作一碗温补汤药。','sys'); openModal('building'); } }
        ]}
      ],
    subAreas:[{key:'yaofu_hou',label:'入后堂'},{key:'yaofu_lou',label:'上二楼'}],
    areas:{
      yaofu_hou:{ name:'后堂', icon:'🚪', desc:'库房碾坊，药香沉静，学徒正晾药帘。', npcs:[
        { name:'药铺学徒', icon:'🧑', desc:'束发少年，忙着称量药材。', acts:[
          { label:'交谈', icon:'💬', fn:function(){ log('学徒道：「师父说，这药性有寒热温凉，配错了要出人命的。」','sys'); } }
        ]}
      ], objs:[
        { name:'晒药匾', icon:'🟫', desc:'竹匾里铺着切好的饮片，日头下泛香。', acts:[
          { label:'翻动饮片', icon:'🤲', fn:function(){ if(!exert('翻药')) return; log('你帮着翻了翻药匾，饮片匀称，香气更盛。','sys'); } }
        ]}
      ], areas:[] },
      yaofu_lou:{ name:'二楼客房', icon:'🪜', desc:'雅静客房，偶有宿疾老者在此静养。', npcs:[
        { name:'宿疾老者', icon:'🧓', desc:'面色青白，久病未愈的乡绅。', acts:[
          { label:'探问', icon:'💬', fn:function(){ log('老者咳嗽两声：「老朽这咳疾缠身半载，怕是熬不过这个冬天喽……」','sys'); } }
        ]}
      ], objs:[], areas:[] }
    },
    },
    buzhuang: {
      name:'锦绣布庄', icon:'🧵', sub:'机杼声声，绫罗满架',
      interior: [
        { kind:'npc', name:'布庄掌柜', icon:'🧑‍💼', desc:'精明的中年掌柜，掌中算盘不离。', acts:[
          { label:'置办衣甲', icon:'🛡️', fn:function(){ if(!exert('置办衣甲')) return; S().def=(S().def||0)+2; log('掌柜取来新裁战袍加身，护体更坚（防御+2）。','good'); renderStatus(); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('掌柜道：「客官这身行头该换换了，刀枪无眼，甲胄要紧。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'织机', icon:'🪡', desc:'木织机一架，织娘投梭走线。', acts:[
          { label:'看织娘织锦', icon:'👀', fn:function(){ log('你驻足看织娘投梭，经纬交织，渐成云锦一段。','sys'); openModal('building'); } }
        ]}
      ],
    subAreas:[{key:'bz_hou',label:'入后库'}],
    areas:{
      bz_hou:{ name:'后库', icon:'🚪', desc:'布匹成堆，裁缝在此赶制衣甲。', npcs:[
        { name:'裁缝', icon:'🧵', desc:'指尖生茧的老裁缝。', acts:[
          { label:'交谈', icon:'💬', fn:function(){ log('裁缝道：「甲靠生漆浸过才硬，布要双股绞才牢。」','sys'); } }
        ]}
      ], objs:[
        { name:'布料架', icon:'🧶', desc:'架上绫罗绢帛与各色粗布。', acts:[
          { label:'翻看布料', icon:'👀', fn:function(){ log('你拂过架上布匹，粗布结实、绸缎滑手。','sys'); } }
        ]}
      ], areas:[] }
    },
    },
    shishi: {
      name:'悦来食肆', icon:'🍜', sub:'灶火正旺，酒旗招展',
      interior: [
        { kind:'npc', name:'食肆掌柜', icon:'🧑‍🍳', desc:'围着油渍围裙的胖掌柜，嗓门洪亮。', acts:[
          { label:'打尖进食', icon:'🍲', fn:function(){ if(!exert('打尖进食')) return; S().food=S().maxFood; S().drink=Math.max(S().drink, Math.round((S().maxDrink||0)*0.6)); log('热汤面饼下肚，饥渴尽消（粮草补满）。','good'); renderStatus(); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('掌柜抹着桌子：「客官慢用，'+bldZihao()+'的热汤管够！」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'灶台', icon:'🔥', desc:'大灶一口，汤锅翻滚。', acts:[
          { label:'讨碗热汤', icon:'🥣', fn:function(){ if(!exert('讨汤')) return; S().food=Math.min(S().maxFood,(S().food||0)+10); log('灶上舀得一碗热汤，下肚暖意融融。','sys'); renderStatus(); openModal('building'); } }
        ]}
      ],
    rootName:'大堂',
    rootExtraNpcs:[
      { name:'店小二', icon:'🧑', desc:'端盘擦桌、招呼客人的伶俐小伙。', acts:[
        { label:'唤小二添茶', icon:'🍵', fn:function(){ if(!exert('唤小二')) return; log('小二拎壶过来给你满上热茶，笑道：「客官慢用！」','sys'); } },
        { label:'打听消息', icon:'💬', fn:function(){ log('小二压低声音：「楼上有几位商贾在谈军粮买卖，听着蹊跷……」','sys'); } }
      ]},
      { name:'酒客', icon:'🧑‍🦱', desc:'踞案独酌的过路客。', acts:[
        { label:'攀谈', icon:'💬', fn:function(){ log('酒客咂口酒：「如今天下不靖，这酒钱都涨了三成喽。」','sys'); } }
      ]}
    ],
    subAreas:[{key:'ss_houchu',label:'入后厨'},{key:'ss_ersou',label:'上二楼'},{key:'ss_houyuan',label:'去后院'}],
    areas:{
      ss_houchu:{ name:'后厨', icon:'🍳', desc:'灶火熊熊，油烟与香气交织。', npcs:[
        { name:'厨子', icon:'👨‍🍳', desc:'满面油光的大厨，掌勺不停。', acts:[
          { label:'交谈', icon:'💬', fn:function(){ log('厨子擦汗：「客官要吃些甚么？今儿有现成的热汤面。」','sys'); } }
        ]}
      ], objs:[
        { name:'菜案', icon:'🔪', desc:'案上码着时蔬鲜肉。', acts:[
          { label:'翻看食材', icon:'👀', fn:function(){ log('案上青菜水灵、肉脯鲜红，后厨井井有条。','sys'); } }
        ]}
      ], areas:[] },
      ss_ersou:{ name:'二楼雅座', icon:'🪜', desc:'临窗雅座，商旅据案高谈。', npcs:[
        { name:'行商', icon:'🧑‍💼', desc:'踞坐雅间的贩货客。', acts:[
          { label:'攀谈', icon:'💬', fn:function(){ log('行商道：「北地战马紧俏，南货却贱，倒腾一趟利市三倍。」','sys'); } }
        ]},
        { name:'醉汉', icon:'🥴', desc:'伏案酣睡的醉客。', acts:[
          { label:'推醒', icon:'✋', fn:function(){ log('你推了推醉汉，他嘟囔两句又睡了过去。','sys'); } }
        ]}
      ], objs:[], areas:[{key:'ss_yajian',label:'进雅间'}] },
      ss_yajian:{ name:'雅间', icon:'🚪', desc:'屏帘半掩的私密雅间。', npcs:[
        { name:'密谈客', icon:'🕴️', desc:'压低嗓音的两个陌生人。', acts:[
          { label:'偷听', icon:'👂', fn:function(){ if(!exert('屏息偷听')) return; log('你贴近屏帘，隐约听见「……约在子时，城西……」便再无声。','sys'); } }
        ]}
      ], objs:[], areas:[] },
      ss_houyuan:{ name:'后院', icon:'🌿', desc:'静谧后院，水井与马厩所在。', npcs:[
        { name:'马夫', icon:'🧑‍🌾', desc:'喂马的粗豪汉子。', acts:[
          { label:'交谈', icon:'💬', fn:function(){ log('马夫道：「好马得喂饱豆料，跑长途才不掉链子。」','sys'); } }
        ]}
      ], objs:[
        { name:'水井', icon:'⛲', desc:'后院老井，井水清冽。', acts:[
          { label:'打水', icon:'🪣', fn:function(){ if(!exert('打水')) return; S().drink=Math.min(S().maxDrink,(S().drink||0)+8); log('你摇轱辘打上一桶井水，灌了几口，燥意全消（饮水+8）。','sys'); renderStatus(); } }
        ]}
      ], areas:[] }
    },
    },
    zahuo: {
      name:'万丰杂货', icon:'🏪', sub:'针头线脑，百货杂陈',
      interior: [
        { kind:'npc', name:'杂货掌柜', icon:'🧑‍💼', desc:'眯眼算账的老朝奉。', acts:[
          { label:'采买补给', icon:'🛒', fn:function(){ if(!exert('采买补给')) return; S().drink=S().maxDrink; log('水囊火折尽数补齐，长途无虞（饮水补满）。','good'); renderStatus(); openModal('building'); } },
          { label:'采办物料', icon:'🪵', fn:function(){ openModal('shop', {shop:'build_pedlar'}); } },
          { label:'交谈', icon:'💬', fn:function(){ log('朝奉道：「客官要寻甚稀罕物？'+bldZihao()+'虽小，货路却宽，或能凑办。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'货架', icon:'📦', desc:'靠墙货架，瓶罐竹篾杂列。', acts:[
          { label:'翻看货品', icon:'👀', fn:function(){ log('你拂过架上尘土，瓶罐间多是油烛绳结之类。','sys'); openModal('building'); } }
        ]}
      ],
    subAreas:[{key:'zh_ku',label:'入库房'}],
    areas:{
      zh_ku:{ name:'库房', icon:'📦', desc:'堆满筐篓杂货的后库。', npcs:[
        { name:'伙计', icon:'🧑', desc:'蹲着捆扎货物的小伙计。', acts:[
          { label:'交谈', icon:'💬', fn:function(){ log('伙计道：「客官要的稀罕物，得翻箱倒柜寻寻。」','sys'); } }
        ]}
      ], objs:[
        { name:'杂物堆', icon:'📦', desc:'墙角摞着竹篾油烛之类。', acts:[
          { label:'翻检', icon:'👀', fn:function(){ if(!exert('翻检')) return; log('你翻了翻杂物堆，瓶罐间多是油烛绳结。','sys'); } }
        ]}
      ], areas:[] }
    },
    },
    gongzao: {
      name:'营造所', icon:'🔨', sub:'匠作萃聚，砖石木料山积',
      interior: [
        { kind:'npc', name:'匠作师傅', icon:'👷', desc:'满手老茧的老匠人，督着营造。', acts:[
          { label:'问营造', icon:'💬', fn:function(){ log('匠师指点：「城池以建设度为凭——夯土、立木、砌砖、设栅，四事皆备，外郭自当拓开。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'夯土基', icon:'🟫', desc:'夯实墙基的夯具。', acts:[
          { label:'夯土筑基', icon:'🔨', fn:function(){ if(!exert('夯土')) return; setCityDev(S().room, cityDevOf(S().room)+2); advanceTime(1); log('你持夯具将墙基一层层砸实，城垣渐起（建设度 '+cityDevOf(S().room)+'）。','sys'); renderRoom(S().room,true); openModal('building'); } }
        ]},
        { kind:'obj', name:'木作台', icon:'🪚', desc:'刨削木料的工作台。', acts:[
          { label:'木作立架', icon:'🪵', fn:function(){ if(!exert('木作')) return; setCityDev(S().room, cityDevOf(S().room)+2); advanceTime(1); log('木作台上锯刨声声，梁架立起（建设度 '+cityDevOf(S().room)+'）。','sys'); renderRoom(S().room,true); openModal('building'); } }
        ]},
        { kind:'obj', name:'砖窑', icon:'🧱', desc:'窑火正红的砖窑。', acts:[
          { label:'烧砖砌墙', icon:'🧱', fn:function(){ if(!exert('砌砖')) return; setCityDev(S().room, cityDevOf(S().room)+2); advanceTime(1); log('砖窑出砖，垒砌围墙，城郭更见齐整（建设度 '+cityDevOf(S().room)+'）。','sys'); renderRoom(S().room,true); openModal('building'); } }
        ]},
        { kind:'obj', name:'立栅', icon:'🪵', desc:'削木为栅的栅栏架。', acts:[
          { label:'立栅设防', icon:'🚧', fn:function(){ if(!exert('立栅')) return; setCityDev(S().room, cityDevOf(S().room)+2); advanceTime(1); log('削木立栅，周遭设防，外圈渐辟为民居街市（建设度 '+cityDevOf(S().room)+'）。','sys'); renderRoom(S().room,true); openModal('building'); } }
        ]}
      ],
    subAreas:[{key:'gz_liao',label:'入料场'}],
    areas:{
      gz_liao:{ name:'料场', icon:'🪵', desc:'木料石料堆积如山的场院。', npcs:[
        { name:'料场匠人', icon:'🧑‍🔧', desc:'监看料场的副匠。', acts:[
          { label:'交谈', icon:'💬', fn:function(){ log('匠人道：「好料出好活，这粱木得选三年的杉木才扛得住。」','sys'); } }
        ]}
      ], objs:[
        { name:'木料堆', icon:'🪵', desc:'成捆的原木与板材。', acts:[
          { label:'翻看木料', icon:'👀', fn:function(){ if(!exert('翻看')) return; log('你拨弄木料，杉木轻韧、松木结实，各有所用。','sys'); } }
        ]},
        { name:'石料堆', icon:'🪨', desc:'青石条与碎石。', acts:[
          { label:'搬弄石料', icon:'🏋️', fn:function(){ if(!exert('搬弄')) return; log('你掂了掂石条，分量十足，正合砌基。','sys'); } }
        ]}
      ], areas:[] }
    },
    },
    // ── 商铺类型池扩充（v20260825e）：酒楼/染坊/糕点铺/钱庄/铁匠铺/武馆/镖局/茶楼/赌馆/马行/书肆/香烛店 ──
    jiulou: {
      name:'醉仙楼', icon:'🍶', sub:'朱阁临街，酒旗高挑，烹羊宰牛且为乐',
      interior: [
        { kind:'npc', name:'酒楼掌柜', icon:'🧑‍🍳', desc:'胖掌柜笑面迎客，算盘珠响。', acts:[
          { label:'打尖进食', icon:'🍲', fn:function(){ if(!exert('打尖进食')) return; S().food=S().maxFood; S().drink=Math.max(S().drink, Math.round((S().maxDrink||0)*0.7)); log('热馔醇酿下肚，饥渴尽消（粮草补满）。','good'); renderStatus(); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('掌柜道：「客官可知，这壶中物最误事，也最解忧。」','sys'); openModal('building'); } }
        ]},
        { kind:'npc', name:'店小二', icon:'🧑', desc:'穿梭席间的伶俐伙计。', acts:[
          { label:'唤小二添酒', icon:'🍶', fn:function(){ if(!exert('唤小二')) return; log('小二拎壶过来满上：「客官慢用，今儿有上好的黍酒！」','sys'); } },
          { label:'打听消息', icon:'💬', fn:function(){ log('小二压低嗓门：「楼上那位将军，半夜还在与人对弈，神色忡忡……」','sys'); } }
        ]},
        { kind:'obj', name:'酒瓮', icon:'🏺', desc:'墙角摞着几口酒瓮，泥封沁香。', acts:[
          { label:'打一壶酒', icon:'🍶', fn:function(){ if(!exert('打酒')) return; if(packAdd('jiu',1)) log('你打了壶黍酒，酒香扑鼻，或可御寒壮行。','sys'); openModal('building'); } }
        ]}
      ],
      subAreas:[{key:'jl_erlou',label:'上二楼'}],
      areas:{
        // v20260912a 用词规范：只讲「已经发生过的旧事」（光武中兴 / 高祖入关）。
        //   旧版此处的说书人正在讲「温酒斩华雄」「三英战吕布」——对开场（光和六年）的世人而言，
        //   这些不但没发生，连「三国」都还不存在（见 GAME_DESIGN.md §用词规范）。
        //   exert 键仍沿用 '听说书'，避免旧存档的每日次数记录失效。
        jl_erlou:{ name:'二楼雅座', icon:'🪜', desc:'临窗雅座，醒木声起。', npcs:[
          { name:'讲古先生', icon:'🗣️', desc:'醒木一拍，正说得唾沫横飞。', acts:[
            { label:'听讲古', icon:'👂', fn:function(){ if(!exert('听说书')) return; log('讲古先生拍案：「光武当年起于白水，昆阳一战，四十万新军溃如崩山——这才是真龙的气象！」满堂喝彩。','sys'); } },
            { label:'打赏', icon:'🪙', fn:function(){ log('你掷下几文，讲古先生拱手：「谢赏！再听一段高祖入关？」','sys'); } }
          ]}
        ], objs:[], areas:[] }
      }
    },
    ranfang: {
      name:'彩云染坊', icon:'🎨', sub:'青红皂白诸色入缸，布帛如染春山',
      interior: [
        { kind:'npc', name:'染匠', icon:'🧑‍🎨', desc:'满臂染渍的老师傅。', acts:[
          { label:'染布', icon:'🎨', fn:function(){ if(!exert('染布')) return; log('你将素绢投入染缸，绞出时已是青碧如水。','sys'); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('染匠道：「'+bldZihao()+'的靛青得发酵七日，急不得；色不正，是火候没到。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'染缸', icon:'🪣', desc:'数口大缸，色水幽深。', acts:[
          { label:'翻看染缸', icon:'👀', fn:function(){ log('缸中靛蓝、茜红、栀子黄，各色沉浮。','sys'); } }
        ]}
      ],
      subAreas:[{key:'rf_liang',label:'去晾布场'}],
      areas:{
        rf_liang:{ name:'晾布场', icon:'🌿', desc:'竹竿上高高低低晾着彩布，风过如旗。', npcs:[], objs:[
          { name:'晾布竿', icon:'🧵', desc:'随风轻摆的湿布。', acts:[
            { label:'翻动布料', icon:'🤲', fn:function(){ if(!exert('翻布')) return; log('你帮着翻了翻晾布，色已半干，香气清浅。','sys'); } }
          ]
        }], areas:[] }
      }
    },
    gaodian: {
      name:'稻香糕点铺', icon:'🍰', sub:'蒸笼腾腾，蜜香满街',
      interior: [
        { kind:'npc', name:'糕点娘', icon:'👩‍🍳', desc:'系着围裙、笑靥如花的少妇。', acts:[
          { label:'买糕点', icon:'🍪', fn:function(){ if(!exert('买糕点')) return; S().food=Math.min(S().maxFood,(S().food||0)+12); log('你称了斤许蜜糕胡饼，粮草稍济（粮草+12）。','good'); renderStatus(); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('糕点娘道：「客官尝尝这杏仁酥，是家翁从长安学来的方子——咱'+bldZihao()+'就靠这手艺立足。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'蒸笼', icon:'🥟', desc:'竹蒸笼叠得老高，热气直冒。', acts:[
          { label:'掀笼看货', icon:'👀', fn:function(){ log('笼中米糕雪白、枣泥酥红，香气扑鼻。','sys'); } }
        ]}
      ]
    },
    qianzhuang: {
      name:'汇通钱庄', icon:'🪙', sub:'高柜台、铁栅栏，金银出纳叮当',
      interior: [
        { kind:'npc', name:'钱庄掌柜', icon:'🧓', desc:'戴玳瑁镜、拨算盘的老朝奉。', acts:[
          { label:'兑换金银', icon:'🪙', fn:function(){ log('掌柜将银锭秤了又秤，开出庄票一张：「客官收好，凭票通兑。」','sys'); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('老朝奉低声：「'+bldZihao()+'是本城老字号，钱在手里不如粮在仓——兵荒马乱的，客官当心。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'钱柜', icon:'🗄️', desc:'沉重的铁柜，锁孔幽深。', acts:[
          { label:'打量钱柜', icon:'👀', fn:function(){ log('钱柜纹丝不动，想是极沉；账房先生瞪了你一眼。','sys'); } }
        ]}
      ]
    },
    tiejiang: {
      name:'打铁营', icon:'⚒️', sub:'风箱呼啸，铁花四溅',
      interior: [
        { kind:'npc', name:'铁匠', icon:'🧔', desc:'赤膊壮汉，臂有刺青，锤不离手。', acts:[
          { label:'打制兵器', icon:'⚔', fn:function(){ if(!exert('打铁')) return; S().atk=(S().atk||0)+2; log('铁匠为你打就一柄厚背刀，寒光逼人（攻击+2）。','good'); renderStatus(); openModal('building'); } },
          { label:'修整甲胄', icon:'🛡️', fn:function(){ if(!exert('修甲')) return; S().def=(S().def||0)+2; log('铁匠敲敲打打，将你甲胄补得严丝合缝（防御+2）。','good'); renderStatus(); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('铁匠抹汗：「好钢需千锤——'+bldZihao()+'的招牌也是这么熬出来的。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'熔炉', icon:'🔥', desc:'炉膛通红，炭火噼啪。', acts:[
          { label:'看打铁', icon:'👀', fn:function(){ if(!exert('看打铁')) return; log('你看着铁匠抡锤，火星溅起如萤，一柄剑坯渐成。','sys'); } }
        ]}
      ],
      subAreas:[{key:'tj_liao',label:'入料场'}],
      areas:{
        tj_liao:{ name:'料场', icon:'🪨', desc:'矿石铁锭堆积。', npcs:[], objs:[
          { name:'铁料堆', icon:'⛏️', desc:'生铁与精钢。', acts:[
            { label:'翻看铁料', icon:'👀', fn:function(){ log('精钢泛青、生铁灰暗，好刃须好铁。','sys'); } }
          ]
        }], areas:[] }
      }
    },
    wuguan: {
      name:'振武馆', icon:'🥋', sub:'演武场上刀枪剑戟，喝声不绝',
      interior: [
        { kind:'npc', name:'教头', icon:'🥋', desc:'精神矍铄的枪棒教头。', acts:[
          { label:'习武演武', icon:'⚔', fn:function(){ if(!exert('习武')) return; S().atk=(S().atk||0)+1; log('教头指点你一招「进步撩阴」，身手精进（攻击+1）。','good'); renderStatus(); openModal('building'); } },
          { label:'请教门道', icon:'💬', fn:function(){ log('教头道：「军中枪法贵直，江湖刀法贵变——客官既到'+bldZihao()+'，习哪一路？」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'木人桩', icon:'🪵', desc:'遍体钉痕的木桩。', acts:[
          { label:'练上几式', icon:'🥊', fn:function(){ if(!exert('练武')) return; log('你对木人桩拆了几招，拳风呼呼，筋骨舒展。','sys'); } }
        ]}
      ]
    },
    biaoju: {
      name:'威远镖局', icon:'🛡️', sub:'镖旗猎猎，趟子手往来如梭',
      interior: [
        { kind:'npc', name:'镖头', icon:'🧗', desc:'腰挎朴刀、眼神锐利的汉子。', acts:[
          { label:'接谈镖务', icon:'💬', fn:function(){ log('镖头打量你：「'+bldZihao()+'这趟镖走荆州，路上不太平，客官可要同行？」','sys'); openModal('building'); } },
          { label:'打听行程', icon:'👂', fn:function(){ log('镖头压低声音：「前头官道有流寇，绕道走河津稳妥些。」','sys'); } }
        ]},
        { kind:'obj', name:'镖旗', icon:'🚩', desc:'绣着「威远」二字的镖旗。', acts:[
          { label:'端详镖旗', icon:'👀', fn:function(){ log('镖旗被摩挲得发亮，想是走过不少路。','sys'); } }
        ]}
      ]
    },
    chalou: {
      name:'听雨茶楼', icon:'🍵', sub:'竹炉汤沸，茶烟袅袅',
      interior: [
        { kind:'npc', name:'茶博士', icon:'🧑', desc:'提壶续水的老茶倌。', acts:[
          { label:'上茶', icon:'🍵', fn:function(){ if(!exert('上茶')) return; S().drink=Math.min(S().maxDrink,(S().drink||0)+10); log('一盏清茶入喉，润喉解乏（饮水+10）。','good'); renderStatus(); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('茶博士道：「'+bldZihao()+'这壶中茶如人生，头苦二甘三回甜——客官细品。」','sys'); openModal('building'); } }
        ]},
        // v20260912a 用词规范：同上 —— 不讲未发生的赤壁/结亲，改讲楚汉旧事与当世风闻。
        { kind:'npc', name:'讲古先生', icon:'🗣️', desc:'醒木轻敲，正讲前朝旧事。', acts:[
          { label:'听讲古', icon:'👂', fn:function(){ if(!exert('听说书')) return; log('讲古先生：「且说那楚汉相争，垓下一战——四面楚歌起，霸王别了虞姬，自刎乌江。」满座唏嘘。','sys'); } },
          { label:'打听消息', icon:'💬', fn:function(){ log('你递过茶钱，先生低声：「听闻州里又要加征，衙前榜文贴了三日，人心不安哪……」','sys'); } }
        ]}
      ]
    },
    duguang: {
      name:'快活赌坊', icon:'🎲', sub:'骰声铿锵，吆喝连天',
      interior: [
        { kind:'npc', name:'赌徒', icon:'🎲', desc:'眼发红、袖藏骰的精瘦汉。', acts:[
          { label:'掷骰一博', icon:'🎲', danger:true, fn:function(){ if(!exert('赌博')) return; var win=Math.random()<0.5; log(win?'你押中点数，赢得几贯，眉开眼笑。':'你手气不济，输了几文，懊恼不已。','sys'); openModal('building'); } },
          { label:'豪赌一场', icon:'🎲', danger:true, when:'night', fn:function(){ if(!exert('豪赌')) return; if(S().gold<20){ log('赌徒乜斜你一眼：「囊中羞涩，也敢进这夜局？」','sys'); return; } var win=Math.random()<0.45; if(win){ S().gold+=30; log('入夜赌局灯火如昼，你押上重注，骰子落定——通吃！银两 +30（当前 '+S().gold+'）。','good'); } else { S().gold-=30; log('入夜赌局灯火如昼，你押上重注，骰子翻落——血本无归，银两 -30（当前 '+S().gold+'）。','bad'); } openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ var h=S().time%12; log(h>=10||h<=1 ? '赌徒压低声：「客官来得正是时候，入夜的局子才够味——敢不敢玩把大的？」' : '赌徒嘿嘿一笑：「'+bldZihao()+'白日小赌怡情，入夜才有大场面——十赌九输，可偏有人想着那一赢。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'骰盆', icon:'🥏', desc:'青瓷骰盆，六子乱滚。', acts:[
          { label:'看人下注', icon:'👀', fn:function(){ log('盆边围了三两人，吆五喝六，热闹非常。','sys'); } }
        ]}
      ]
    },
    maxing: {
      name:'千里马行', icon:'🐴', sub:'马嘶声声，料豆满槽',
      interior: [
        { kind:'npc', name:'马贩', icon:'🧑‍🌾', desc:'络腮胡、懂马性的老行家。', acts:[
          { label:'相马买马', icon:'🐴', fn:function(){ if(!exert('相马')) return; if(packAdd('horse',1)) log('你相中一匹栗色川马，蹄声如鼓，正堪长途。','good'); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('马贩道：「西凉马骏，幽州马韧，南马矮而温——'+bldZihao()+'走南闯北，各有所用。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'马厩', icon:'🐎', desc:'并排马槽，料豆清香。', acts:[
          { label:'喂马', icon:'🌾', fn:function(){ if(!exert('喂马')) return; log('你添了把料豆，马儿打响鼻，蹭了蹭你手心。','sys'); } }
        ]}
      ]
    },
    shudian: {
      name:'翰墨书肆', icon:'📜', sub:'竹简累累，韦编盈架（纸贵简行，仍以简为主）',
      interior: [
        { kind:'npc', name:'书生', icon:'🧑‍🎓', desc:'青衫落拓、指染墨痕的儒生。', acts:[
          { label:'购简抄书', icon:'📜', fn:function(){ if(!exert('购书')) return; if(packAdd('zhujian',1)) log('你购得几卷竹简，或为兵法，或为诗赋，沉甸甸压肩。','sys'); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ log('书生叹：「蔡侯纸虽已出世，价昂而难得，寻常仍用竹简——'+bldZihao()+'架上，韦编三绝，非虚言也。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'简牍架', icon:'📚', desc:'架上竹简层层，麻绳编缀。', acts:[
          { label:'翻看简牍', icon:'👀', fn:function(){ if(!exert('翻简')) return; log('你抽出一卷，墨迹古拙，辨得「兵马未动，粮草先行」八字。','sys'); } }
        ]}
      ]
    },
    xiangzhu: {
      name:'宝馨香烛店', icon:'🕯️', sub:'香烟缭绕，烛影摇红',
      interior: [
        { kind:'npc', name:'香铺掌柜', icon:'🧓', desc:'面容慈和的香铺东家。', acts:[
          { label:'请香烛', icon:'🕯️', when:'morn', fn:function(){ if(!exert('请香')) return; if(packAdd('xiang',1)) log('晨光初透，掌柜捧出今晨新卷的头香：「'+bldZihao()+'晨起开张，头炷香最灵——客官有缘，请了这炷，心诚则灵。」','good'); openModal('building'); } },
          { label:'交谈', icon:'💬', fn:function(){ var h=S().time%12; log(h===3||h===4 ? '掌柜合十道：「晨光初透，正是开张时——'+bldZihao()+'的头香最灵，客官请一炷？」' : '掌柜合十道：「小店卯时开张、过午歇业——'+bldZihao()+'的规矩，客官记牢了，莫扑空。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'香案', icon:'🕯️', desc:'供着神主，香炉余烬。', acts:[
          { label:'上香', icon:'🙏', fn:function(){ if(!exert('上香')) return; log('你拈香三拜，青烟袅袅，心头稍静。','sys'); } }
        ]}
      ]
    }
  };

  // ══ 建筑内部＝可进入房间（v20260825）══
  // 房间 id 约定：__bld__<key>（正堂）/ __bld__<key>@<areaKey>（子区域）
  // key = BUILDINGS 键（yaofu…）或 site_<siteKey>（玩家放置建筑）；进入后为独立房间场景，而非弹窗
  function isBldRoom(rid){ return !!(rid && rid.indexOf('__bld__')===0); }
  function bldForRoom(rid){
    var m=(rid||'').match(/^__bld__(.+?)(?:@(.+))?$/); if(!m) return null;
    var key=m[1], areaKey=m[2];
    var b=BUILDINGS[key];
    if(!b && S() && S().flags && S().flags.bldEnt && S().flags.bldEnt.key===key){
      var _bp=LF.BUILD[S().flags.bldEnt.bp];
      if(_bp) b={ name:_bp.doneName||'屋舍', icon:itemIconHTML({name:_bp.doneName||'屋舍'},13), sub:_bp.desc||'', interior:_bp.interior||[], rootName:_bp.rootName, rootExtraNpcs:_bp.rootExtraNpcs, rootExtraObjs:_bp.rootExtraObjs, subAreas:_bp.subAreas, areas:_bp.areas };
    }
    if(!b) return null;
    var ar;
    if(!areaKey){
      var npcs=(b.interior||[]).filter(function(e){return e.kind==='npc';});
      if(b.rootExtraNpcs) npcs=npcs.concat(b.rootExtraNpcs);
      var objs=(b.interior||[]).filter(function(e){return e.kind==='obj';});
      if(b.rootExtraObjs) objs=objs.concat(b.rootExtraObjs);
      ar={ name:((S() &&S().flags&&S().flags.bldEnt&&S().flags.bldEnt.sign)||b.rootName||b.name), icon:b.icon, desc:b.sub, npcs:npcs, objs:objs, areas:(b.subAreas||[]), isRoot:true };
    } else {
      ar=b.areas && b.areas[areaKey] || null;
      if(!ar) return null;
      ar={ name:ar.name, icon:ar.icon||'进', desc:ar.desc, npcs:ar.npcs||[], objs:ar.objs||[], areas:ar.areas||[], isRoot:false };
    }
    return { id:rid, key:key, areaKey:areaKey, b:b, ar:ar };
  }
  function bldRoom(rid){
    var f=bldForRoom(rid); if(!f) return null;
    return { id:rid, name:f.ar.name, icon:f.ar.icon, desc:[f.ar.desc||''], bldKey:f.key, isBld:true };
  }
  function enterBldRoom(key, back, sign){
    if(getCombatMode()!==null){ toast('正与敌缠斗，先应敌！'); return; }
    if(!S().flags) S().flags={};
    S().flags.bldEnt={ key:key, back:back||null, bp:(back&&back.bp)||null, sign:(sign||null) };
    closeModal();
    renderRoom('__bld__'+key, true);
  }
  function bldMove(tid){
    if(getCombatMode()!==null){ toast('正与敌缠斗，先应敌！'); return; }
    advanceTime(1);
    log('你移步前行，景物为之一变……','sys');
    renderRoom(tid);
  }
  function leaveBldRoom(){
    var ent=S().flags && S().flags.bldEnt;
    var back=ent && ent.back;
    delete S().flags.bldEnt;
    if(back && back.kind==='city'){
      S().flags.cityPos={cid:back.cid,x:back.x,y:back.y};
      renderRoom(back.cid);
    } else {
      renderRoom((back && back.room) || 'camp_yard');
    }
  }
  function hasCount(defId,n){ var c=packFind(defId); return c && (c.count||1)>=n; }
  return {
      bldCurArea: bldCurArea, bldDef: bldDef, renderBuildingPanel: renderBuildingPanel, bindBuildingPanel: bindBuildingPanel,
      BUILDINGS: BUILDINGS, isBldRoom: isBldRoom, bldForRoom: bldForRoom, bldRoom: bldRoom,
      enterBldRoom: enterBldRoom, bldMove: bldMove, leaveBldRoom: leaveBldRoom, hasCount: hasCount
    };
  };
})(typeof window !== 'undefined' ? window : global);

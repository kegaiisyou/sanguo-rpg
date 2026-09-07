// 营造（生存建造）蓝图数据（外置，便于横向扩展更多图纸）
// 结构：LF.BUILD[蓝图ID] = {
//   key       放置于房间后的唯一对象 key
//   size      建筑规模：small(小型/1人) / medium(中型/2-5人) / large(大型/10-30人) / huge(巨型/50+人)
//   labor     所需人力（影响建造速度）
//   siteIcon  营造中图标
//   siteName  营造中名称
//   doneIcon  建成后图标
//   doneName  建成后名称
//   desc      说明
//   stages    [ { name:'阶段名', need:{ 材料defId:数量, ... } }, ... ]
//   done      'forge' | ...  （建成后的功能动作标识，对应 LFUI/buildDoneActions 的处理）
//   interior  建成后内部：可进入的独立房间（NPC + 交互物件），与店铺屋舍体验一致
//   city:true 城市格营造（城内空地开工，落成后写入 cityCells）
// }
(function (global) {
  global.LF = global.LF || {};
  LF.BUILD = {
    // ════════════════════════════════════════════════════════════
    // 一、已有建筑（补充分级字段）
    // ════════════════════════════════════════════════════════════
    bp_yeolian: {
      key: 'site_yeolian',
      size: 'medium', labor: 3,
      siteName: '冶炼工坊（营造中）',
      doneName: '冶炼工坊',
      desc: '依《冶炼工坊图》备料营造：先夯石砌基，再立木架炉，炉成可熔石取铁。',
      stages: [
        { name: '夯筑石基', need: { shitiao: 3, zhuan: 2 } },
        { name: '立木架炉', need: { mucai: 4 } }
      ],
      done: 'forge',
      interior: [
        { kind:'npc', name:'铁匠师傅', icon:'匠', desc:'围着皮围裙、抡锤如风的老师傅，通晓冶铁锻造。', acts:[
          { label:'请教冶炼', icon:'话', fn:function(){ log('铁匠师傅瓮声道：「好铁要经千锤百炼——石中炼出铁锭，铁锭再锻成器物，不可急躁。」','sys'); openModal('building'); } },
          { label:'请他熔石', icon:'火', fn:function(){
              if(!packFind('tiekuangshi')){ toast('需有铁矿石，方能请师傅开炉熔炼。'); return; }
              if(!exert('请师熔炼')) return;
              packConsume('tiekuangshi',1); packAdd('tiekuai',1);
              log('铁匠师傅投石入炉，风箱鼓动，火星四溅——取出一枚铁锭交予你。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'冶炼炉膛', icon:'火', desc:'炉火正旺的冶炼炉，风箱呼呼作响。', acts:[
          { label:'熔石取铁', icon:'炼', fn:function(){
              if(!exert('生火熔炼')) return;
              if(packFind('tiekuangshi')){ packConsume('tiekuangshi',1); packAdd('tiekuai',1); log('你将铁矿石投入炉膛，熔得铁锭一枚。','sys'); }
              else log('炉膛空空，投石入炉方能出铁。','sys');
              openModal('building'); } }
        ]},
        { kind:'obj', name:'铁砧', icon:'砧', desc:'沉重的铁砧，锤痕斑斑。', acts:[
          { label:'打造器具', icon:'打', fn:function(){ openModal('craft', {bench:'forge'}); } }
        ]}
      ]
    },
    bp_woodcamp: {
      key: 'site_woodcamp',
      size: 'medium', labor: 3,
      siteName: '伐木场（营造中）',
      doneName: '伐木场',
      desc: '依《伐木场图》备料营造：先清场立栅，再搭工棚架马，场成可伐木取材。',
      stages: [
        { name: '清场立栅', need: { shitiao: 2 } },
        { name: '搭棚架马', need: { mucai: 3 } }
      ],
      done: 'woodcamp',
      interior: [
        { kind:'npc', name:'伐木工头', icon:'🪓', desc:'精壮的伐木工头，熟稔林间采伐。', acts:[
          { label:'问采伐', icon:'💬', fn:function(){ log('工头道：「好木要选三年杉松，斧利则事半功倍。场成之后，每日可在此伐得木料。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'伐木锯台', icon:'🪚', desc:'架马与锯台，原木在此解板成材。', acts:[
          { label:'伐木取材', icon:'🌳', fn:function(){ if(typeof chopTree==='function') chopTree(); else log('你抡起斧头，对着树木斫去……','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_yaolu: {
      key: 'site_yaolu',
      size: 'medium', labor: 3,
      siteName: '砖窑（营造中）',
      doneName: '砖窑',
      desc: '依《砖窑图》备料营造：先夯土砌窑，再备柴垒坯，窑成可烧土为砖。',
      stages: [
        { name: '夯土砌窑', need: { shitiao: 3 } },
        { name: '备柴垒坯', need: { mucai: 2 } }
      ],
      done: 'yaolu',
      interior: [
        { kind:'npc', name:'窑匠师傅', icon:'🧱', desc:'满面烟灰的窑匠，通晓烧砖火候。', acts:[
          { label:'问烧砖', icon:'💬', fn:function(){ log('窑匠道：「砖以黏土入窑，柴火足则砖坚。场成之后，每日可在此烧得砖头。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'窑膛', icon:'🔥', desc:'窑火正旺的砖窑膛。', acts:[
          { label:'烧砖', icon:'🧱', fn:function(){ if(packFind('shitiao')){ if(!exert('烧砖')) return; packConsume('shitiao',2); packAdd('zhuan',1); log('你添柴鼓风，窑火映红脸膛，出砖×1。','sys'); } else { toast('需石料×2方能烧砖。'); } openModal('building'); } }
        ]}
      ]
    },
    // ── 城市营造蓝图 ──
    bp_house: {
      city: true, onTypes: ['empty'], cellType: 'home', tuzhi: 'tuzhi_house',
      size: 'small', labor: 2,
      siteName: '民宅（营造中）', doneName: '民宅',
      desc: '依《民宅图》备料营造：立柱搭梁、苫草为顶，落成后百姓可居，城中人烟渐盛。',
      stages: [
        { name: '立柱搭梁', need: { mucai: 4 } },
        { name: '苫草为顶', need: { shitiao: 2 } }
      ],
      labor: 3,
      done: 'city_home'
    },
    bp_market: {
      city: true, onTypes: ['empty'], cellType: 'market', tuzhi: 'tuzhi_market',
      size: 'medium', labor: 5,
      siteName: '市集（营造中）', doneName: '市集',
      desc: '依《市集图》备料营造：平整地基、起造铺面、铺砖立市，落成后商旅云集，每日可收市租。',
      stages: [
        { name: '平整地基', need: { shitiao: 4 } },
        { name: '起造铺面', need: { mucai: 5 } },
        { name: '铺砖立市', need: { zhuan: 4 } }
      ],
      labor: 3,
      done: 'city_market'
    },
    bp_farm: {
      city: true, onTypes: ['empty'], cellType: 'farm', tuzhi: 'tuzhi_farm',
      size: 'medium', labor: 4,
      siteName: '农庄（营造中）', doneName: '农庄',
      desc: '依《农庄图》备料营造：治田开阡、起造仓廪，落成后农人耕作，城中粮草渐丰。',
      stages: [
        { name: '治田开阡', need: { mucai: 3 } },
        { name: '起造仓廪', need: { shitiao: 3 } }
      ],
      labor: 3,
      done: 'city_farm'
    },
    bp_barracks: {
      city: true, onTypes: ['empty'], cellType: 'barracks', tuzhi: 'tuzhi_barracks',
      size: 'large', labor: 10,
      siteName: '军营（营造中）', doneName: '军营',
      desc: '依《军营图》备料营造：立栅筑垒、列帐为营，落成后士卒驻扎，可募兵操练。',
      stages: [
        { name: '立栅筑垒', need: { mucai: 5 } },
        { name: '列帐为营', need: { zhuan: 3 } }
      ],
      labor: 3,
      done: 'city_barracks'
    },

    // ════════════════════════════════════════════════════════════
    // 二、新增：可进入内部的建筑（内容丰富）
    // ════════════════════════════════════════════════════════════
    bp_blacksmith: {
      key: 'site_blacksmith',
      size: 'medium', labor: 4,
      siteName: '铁匠铺（营造中）',
      doneName: '铁匠铺',
      desc: '依《铁匠铺图》备料营造：夯基立架、装炉设砧，铺成可炼铁锻兵、修理器具。',
      stages: [
        { name: '夯筑石基', need: { shitiao: 4, zhuan: 2 } },
        { name: '立木为架', need: { mucai: 4 } },
        { name: '装炉设砧', need: { tiekuai: 2, mutou: 2 } }
      ],
      done: 'blacksmith',
      interior: [
        { kind:'npc', name:'铁匠师傅', icon:'⚒️', desc:'膀阔腰圆的铁匠，抡锤如风，火星四溅。', acts:[
          { label:'请教锻造', icon:'💬', fn:function(){ log('铁匠抹了把汗：「三分锻打七分淬，兵刃好坏全看火候。你若有铁料，老夫可为你打制。」','sys'); openModal('building'); } },
          { label:'委托修装备', icon:'🔧', fn:function(){ toast('修装备功能待开放……'); openModal('building'); } }
        ]},
        { kind:'obj', name:'锻炉', icon:'🔥', desc:'炭火熊熊的锻炉，映得满屋通红。', acts:[
          { label:'熔铁锭', icon:'🔥', fn:function(){
              if(!packFind('tiekuangshi')){ toast('需铁矿石方能熔炼。'); return; }
              if(!exert('熔铁')) return;
              packConsume('tiekuangshi',1); packAdd('tiekuai',1);
              log('你投石入炉，鼓风煅烧，熔得铁锭一枚。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'铁砧', icon:'砧', desc:'厚重的铁砧，上面锤痕累累。', acts:[
          { label:'打造兵器', icon:'⚔️', fn:function(){ openModal('craft', {bench:'forge'}); } }
        ]}
      ]
    },
    bp_tavern: {
      key: 'site_tavern',
      size: 'medium', labor: 5,
      siteName: '酒楼（营造中）',
      doneName: '酒楼',
      desc: '依《酒楼图》备料营造：起楼造灶、置桌设柜，楼成可饮酒吃饭、打听消息。',
      stages: [
        { name: '夯基砌墙', need: { shitiao: 4, zhuan: 3 } },
        { name: '立架起楼', need: { mucai: 6 } },
        { name: '装修置具', need: { mucai: 2, mutou: 2 } }
      ],
      done: 'tavern',
      interior: [
        { kind:'npc', name:'酒保', icon:'🍶', desc:'肩搭毛巾的酒保，嗓门洪亮，招呼客人。', acts:[
          { label:'打尖吃饭', icon:'🍜', fn:function(){
              if(!exert('打尖')) return;
              if(packFind('roubao')){ packConsume('roubao',1); log('你就着热汤吃下肉包子，饥渴稍解。','sys'); }
              else { log('酒保端来一碗热汤：「客官慢用，小店今日只有这个。」','sys'); }
              openModal('building'); } },
          { label:'打听消息', icon:'💬', fn:function(){ log('酒保压低声音：「近日黑山军在北边活动频繁，过往客商多有被劫的，客官出行小心。」','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'灶台', icon:'🔥', desc:'大灶一口，汤锅翻滚，香气四溢。', acts:[
          { label:'讨碗热汤', icon:'🥣', fn:function(){
              if(!exert('讨汤')) return;
              log('灶上舀得一碗热汤，下肚暖意融融。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'酒坛', icon:'🍶', desc:'靠墙堆着几坛黍酒，泥封未启。', acts:[
          { label:'打角酒', icon:'🍶', fn:function(){
              if(!exert('打酒')) return;
              packAdd('jiu',1); log('你打了一角黍酒，收入行囊。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_inn: {
      key: 'site_inn',
      size: 'medium', labor: 4,
      siteName: '客栈（营造中）',
      doneName: '客栈',
      desc: '依《客栈图》备料营造：起房置床、设柜存物，栈成可住宿休息、寄存物品。',
      stages: [
        { name: '夯基砌墙', need: { shitiao: 3, zhuan: 2 } },
        { name: '立架起房', need: { mucai: 5 } },
        { name: '置床设柜', need: { mucai: 2, mutou: 2 } }
      ],
      done: 'inn',
      interior: [
        { kind:'npc', name:'掌柜', icon:'🧑‍💼', desc:'拨着算盘的客栈掌柜，精明干练。', acts:[
          { label:'开房休息', icon:'🛏️', fn:function(){
              if(!exert('休息')) return;
              log('你在客房中沉沉睡去，醒来时精神焕发。','good'); openModal('building'); } },
          { label:'寄存物品', icon:'📦', fn:function(){ toast('寄存功能待开放……'); openModal('building'); } }
        ]},
        { kind:'obj', name:'客房', icon:'🛏️', desc:'整洁的客房，床铺干净，窗明几净。', acts:[
          { label:'和衣而卧', icon:'😴', fn:function(){
              if(!exert('小憩')) return;
              log('你靠在床头小憩片刻，疲惫稍解。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_martialhall: {
      key: 'site_martialhall',
      size: 'medium', labor: 5,
      siteName: '武馆（营造中）',
      doneName: '武馆',
      desc: '依《武馆图》备料营造：立桩设架、列兵器，馆成可练武学艺、与人切磋。',
      stages: [
        { name: '夯基平地', need: { shitiao: 3 } },
        { name: '立架搭棚', need: { mucai: 4 } },
        { name: '设桩列兵', need: { mucai: 2, tiekuai: 2 } }
      ],
      done: 'martialhall',
      interior: [
        { kind:'npc', name:'武师', icon:'🥋', desc:'目光如电的武师，一身精悍肌肉，拳脚生风。', acts:[
          { label:'请教武艺', icon:'💬', fn:function(){ log('武师抱拳道：「练拳不练功，到老一场空。足下若肯下苦功，老夫愿指点一二。」','sys'); openModal('building'); } },
          { label:'切磋比试', icon:'⚔️', fn:function(){ toast('切磋功能待开放……'); openModal('building'); } }
        ]},
        { kind:'obj', name:'木桩', icon:'🪵', desc:'一人高的练功木桩，上面拳痕脚印密布。', acts:[
          { label:'打桩练功', icon:'👊', fn:function(){
              if(!exert('打桩')) return;
              log('你对着木桩拳打脚踢，汗流浃背，武艺似有精进。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'兵器架', icon:'⚔️', desc:'架上列着刀枪剑戟，寒光闪闪。', acts:[
          { label:'挑选兵器', icon:'🗡️', fn:function(){ log('你随手拿起一把木刀挥舞了几下，手感尚可。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_granary: {
      key: 'site_granary',
      size: 'large', labor: 8,
      siteName: '粮仓（营造中）',
      doneName: '粮仓',
      desc: '依《粮仓图》备料营造：夯基筑囤、架梁苫顶，仓成可大量存储粮草，兵马未动粮草先行。',
      stages: [
        { name: '夯基筑囤', need: { shitiao: 6, zhuan: 4 } },
        { name: '架梁苫顶', need: { mucai: 6 } },
        { name: '置斛设仓', need: { mucai: 4, mutou: 2 } }
      ],
      done: 'granary',
      interior: [
        { kind:'npc', name:'仓吏', icon:'📝', desc:'管仓的小吏，手里捧着账册，精打细算。', acts:[
          { label:'查点存粮', icon:'📊', fn:function(){ log('仓吏翻着账册：「目前仓中存粮尚丰，支应数月无虞。」','sys'); openModal('building'); } },
          { label:'存入粮草', icon:'📥', fn:function(){ toast('存粮功能待开放……'); openModal('building'); } }
        ]},
        { kind:'obj', name:'粮囤', icon:'🌾', desc:'高大的粮囤，里面盛满了粮食。', acts:[
          { label:'查看储量', icon:'👀', fn:function(){ log('你探头望去，粮囤中米粟堆积如山，散发着谷物的清香。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'斗斛', icon:'⚖️', desc:'量粮的斗斛，校准精准。', acts:[
          { label:'量取一斗', icon:'🥣', fn:function(){
              if(!exert('量粮')) return;
              log('你用量斛舀了一斗米，收入行囊。','sys'); packAdd('shengrou',1); openModal('building'); } }
        ]}
      ]
    },

    // ════════════════════════════════════════════════════════════
    // 三、新增：极简内部的建筑（1-2个物件触发功能）
    // ════════════════════════════════════════════════════════════
    bp_watchtower: {
      key: 'site_watchtower',
      size: 'medium', labor: 4,
      siteName: '瞭望塔（营造中）',
      doneName: '瞭望塔',
      desc: '依《瞭望塔图》备料营造：夯基立柱、搭台设梯，塔成可登高远眺，察敌观风。',
      stages: [
        { name: '夯筑塔基', need: { shitiao: 3 } },
        { name: '立柱架梁', need: { mucai: 4 } },
        { name: '搭台设梯', need: { mucai: 3, mutou: 2 } }
      ],
      done: 'watchtower',
      interior: [
        { kind:'obj', name:'塔顶', icon:'🔭', desc:'高塔之巅，视野开阔，方圆数里尽收眼底。', acts:[
          { label:'登高远眺', icon:'👀', fn:function(){
              if(!exert('远眺')) return;
              log('你登上塔顶，极目四望——远处山川河流、城池道路依稀可辨。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_arrowtower: {
      key: 'site_arrowtower',
      size: 'medium', labor: 5,
      siteName: '箭塔（营造中）',
      doneName: '箭塔',
      desc: '依《箭塔图》备料营造：夯基立柱、装弩设箭，塔成可自动射击来犯之敌。',
      stages: [
        { name: '夯筑塔基', need: { shitiao: 3 } },
        { name: '立柱架梁', need: { mucai: 5 } },
        { name: '装弩备箭', need: { tiekuai: 2, mucai: 2, mutou: 5 } }
      ],
      done: 'arrowtower',
      interior: [
        { kind:'obj', name:'弩机', icon:'🏹', desc:'架在塔上的劲弩，弦上箭满，蓄势待发。', acts:[
          { label:'检查弩机', icon:'🔧', fn:function(){
              if(!exert('检查')) return;
              log('你检查弩机，弓弦紧绷，箭矢齐备，随时可以击发。','sys'); openModal('building'); } },
          { label:'试射一箭', icon:'🎯', fn:function(){
              if(!exert('试射')) return;
              log('你扣动弩机，箭矢呼啸而出，正中百步外的靶心！','good'); openModal('building'); } }
        ]}
      ]
    },
    bp_farmland: {
      key: 'site_farmland',
      size: 'medium', labor: 3,
      siteName: '农田（营造中）',
      doneName: '农田',
      desc: '依《农田图》备料营造：整地修渠、围篱播种，田成可定时产出粮食，春种秋收。',
      stages: [
        { name: '整地翻土', need: { mutou: 3 } },
        { name: '修渠引水', need: { shitiao: 2, mucai: 2 } },
        { name: '围篱播种', need: { mucai: 2, mutou: 2 } }
      ],
      done: 'farmland',
      interior: [
        { kind:'obj', name:'田垄', icon:'🌾', desc:'整齐的田垄，禾苗青青，随风摇曳。', acts:[
          { label:'浇水施肥', icon:'💧', fn:function(){
              if(!exert('浇田')) return;
              log('你取水浇田，禾苗似乎更精神了些。','sys'); openModal('building'); } },
          { label:'查看长势', icon:'👀', fn:function(){ log('你蹲下身查看禾苗长势——目前长势良好，再过些时日便可收获。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_well: {
      key: 'site_well',
      size: 'small', labor: 2,
      siteName: '水井（营造中）',
      doneName: '水井',
      desc: '依《水井图》备料营造：挖井砌壁、置辘轳，井成可源源取水，定居之始。',
      stages: [
        { name: '挖掘井穴', need: { mutou: 2 } },
        { name: '砌壁置辘', need: { zhuan: 4, mucai: 2 } }
      ],
      done: 'well',
      interior: [
        { kind:'obj', name:'井口', icon:'🪣', desc:'青石砌就的井口，井水清澈，深不见底。', acts:[
          { label:'打水', icon:'💧', fn:function(){
              if(!exert('打水')) return;
              log('你摇动辘轳，打上来一桶清冽井水，饮之甘甜。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_pigpen: {
      key: 'site_pigpen',
      size: 'small', labor: 2,
      siteName: '猪圈（营造中）',
      doneName: '猪圈',
      desc: '依《猪圈图》备料营造：整地围栅、置槽建窝，圈成可养猪，定时产出肥肉毛皮。',
      stages: [
        { name: '整地围栅', need: { mucai: 3, mutou: 1 } },
        { name: '置槽建窝', need: { mucai: 1, mutou: 1 } }
      ],
      done: 'pigpen',
      interior: [
        { kind:'obj', name:'猪槽', icon:'🐖', desc:'石砌的猪槽，几头肥猪正在拱食。', acts:[
          { label:'喂食', icon:'🌽', fn:function(){
              if(!exert('喂猪')) return;
              log('你将草料倒入猪槽，猪儿们争先恐后地拱食起来。','sys'); openModal('building'); } },
          { label:'查看猪只', icon:'👀', fn:function(){ log('你数了数，圈中有大小猪只五六头，膘肥体壮。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_gate: {
      key: 'site_gate',
      size: 'medium', labor: 5,
      siteName: '寨门（营造中）',
      doneName: '寨门',
      desc: '依《寨门图》备料营造：夯基立门、置闸设岗，门成可为营地门户，开关自如。',
      stages: [
        { name: '夯筑门基', need: { shitiao: 3 } },
        { name: '立柱安门', need: { mucai: 5, tiekuai: 2 } },
        { name: '置闸设岗', need: { mucai: 3, mutou: 2 } }
      ],
      done: 'gate',
      interior: [
        { kind:'obj', name:'门闸', icon:'🚪', desc:'厚重的木栅门，上有铁钉包裹，可开可闭。', acts:[
          { label:'开启寨门', icon:'🔓', fn:function(){
              if(!exert('开门')) return;
              log('你合力推开沉重的寨门，门外的道路豁然开朗。','sys'); openModal('building'); } },
          { label:'关闭寨门', icon:'🔒', fn:function(){
              if(!exert('关门')) return;
              log('你放下门闸，寨门紧闭，外人不得擅入。','sys'); openModal('building'); } }
        ]}
      ]
    },
    bp_training: {
      key: 'site_training',
      size: 'medium', labor: 3,
      siteName: '训练场（营造中）',
      doneName: '训练场',
      desc: '依《训练场图》备料营造：整地铺沙、设器立桩，场成可练武提升，闻鸡起舞。',
      stages: [
        { name: '整地铺沙', need: { shitiao: 2, mutou: 2 } },
        { name: '设器立桩', need: { mucai: 3, tiekuai: 1 } }
      ],
      done: 'training',
      interior: [
        { kind:'obj', name:'练功场', icon:'🏟️', desc:'平整的沙地练功场，四周立着木桩和兵器架。', acts:[
          { label:'操练武艺', icon:'🥋', fn:function(){
              if(!exert('操练')) return;
              log('你在练功场上挥拳踢腿、舞刀弄枪，汗水浸透了衣衫。','sys'); openModal('building'); } },
          { label:'打坐调息', icon:'🧘', fn:function(){
              if(!exert('打坐')) return;
              log('你盘膝而坐，调息吐纳，心神渐渐宁静。','sys'); openModal('building'); } }
        ]}
      ]
    },

    // 道路为城市基础设施：由 genCityGrid 随城市自动生成（含十字主街与随机支路），
    // 不列为可营造建筑（v20260826 起移除 bp_road，玩家无需单独建造道路）。
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.BUILD;
})(typeof window !== 'undefined' ? window : globalThis);

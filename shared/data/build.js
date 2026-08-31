// 营造（生存建造）蓝图数据（外置，便于横向扩展更多图纸）
// 结构：LF.BUILD[蓝图ID] = {
//   key       放置于房间后的唯一对象 key
//   siteIcon  营造中图标
//   siteName  营造中名称
//   doneIcon  建成后图标
//   doneName  建成后名称
//   desc      说明
//   stages    [ { name:'阶段名', need:{ 材料defId:数量, ... } }, ... ]
//   done      'forge' | ...  （建成后的功能动作标识，对应 LFUI/buildDoneActions 的处理）
// }
(function (global) {
  global.LF = global.LF || {};
  LF.BUILD = {
    bp_yeolian: {
      key: 'site_yeolian',

      siteName: '冶炼工坊（营造中）',

      doneName: '冶炼工坊',
      desc: '依《冶炼工坊图》备料营造：先夯石砌基，再立木架炉，炉成可熔石取铁。',
      stages: [
        { name: '夯筑石基', need: { shitiao: 3, zhuan: 2 } },
        { name: '立木架炉', need: { mucai: 4 } }
      ],
      done: 'forge',
      // 建成后内部：可进入的独立房间（左下 NPC + 上方交互物件），与店铺屋舍体验一致
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
    // 后续可在此追加：窑炉(bp_yaolu2)、营地支线(bp_camp)……
    bp_woodcamp: {
      key: 'site_woodcamp',

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
          { label:'伐木取材', icon:'🌳', fn:function(){ cutWood(); } }
        ]}
      ]
    },
    bp_yaolu: {
      key: 'site_yaolu',

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
          { label:'烧砖', icon:'🧱', fn:function(){ fireBrick(); } }
        ]}
      ]
    },
    // ── 城市营造蓝图（第3步：BuildOrder + cityCells 覆盖层）──
    // city:true  出现在城内「营造」面板；onTypes 指定可营造的当前格类型（cellDisplayType）；
    // cellType   落成后写入 cityCells 的格类型；labor 为每阶段所需「营造」次数（1 次耗 2 精力 + 1 时辰）。
    // 城格蓝图只产格型覆盖（经 NPC_GEN 自动获得对应 NPC/动作），不产生 placed 工地对象。
    bp_house: {
      city: true, onTypes: ['empty'], cellType: 'home', tuzhi: 'tuzhi_house',
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
      siteName: '军营（营造中）', doneName: '军营',
      desc: '依《军营图》备料营造：立栅筑垒、列帐为营，落成后士卒驻扎，可募兵操练。',
      stages: [
        { name: '立栅筑垒', need: { mucai: 5 } },
        { name: '列帐为营', need: { zhuan: 3 } }
      ],
      labor: 3,
      done: 'city_barracks'
    },
    // 道路为城市基础设施：由 genCityGrid 随城市自动生成（含十字主街与随机支路），
    // 不列为可营造建筑（v20260826 起移除 bp_road，玩家无需单独建造道路）。

  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.BUILD;
})(typeof window !== 'undefined' ? window : globalThis);

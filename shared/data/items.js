(function (global) {
  'use strict';

  // ========== 装备系统数据层（格子制行囊 + 六装备槽 + 背包槽） ==========
  // 六装备槽（贴合三国武侠）：帽笠 / 衣甲 / 鞋履 / 兵刃 / 饰品 / 腰带
  //   ——「坐骑」并入腰带（战带/鞍带），「护腕」可后续作为扩展槽。
  //   ——「背包」为独立装备槽，腰包 / 鞶囊等可穿戴以扩充行囊容量。
  var SLOTS = {
    hat:     { label:'帽笠', icon:'🎩' },
    cloth:   { label:'衣甲', icon:'🥋' },
    shoe:    { label:'鞋履', icon:'🥾' },
    weapon:  { label:'兵刃', icon:'⚔️' },
    trinket: { label:'饰品', icon:'💍' },
    belt:    { label:'腰带', icon:'🪢' },
    tool:    { label:'工具', icon:'⛏️' },
    bag:     { label:'背包', icon:'👝' }
  };
  var SLOT_KEYS = Object.keys(SLOTS);

  // 品质：倍率影响数值，颜色用于界面标签
  var QUALITY = [
    { key: 'white',  name: '凡品', mult: 1.0,  color: '#9a948a' },
    { key: 'green',  name: '良品', mult: 1.35, color: '#3f7d5e' },
    { key: 'blue',   name: '精良', mult: 1.8,  color: '#3a6ea5' },
    { key: 'purple', name: '珍稀', mult: 2.4,  color: '#7d4fa3' },
    { key: 'orange', name: '神兵', mult: 3.2,  color: '#b0832f' }
  ];
  var QMAP = {};
  QUALITY.forEach(function (q) { QMAP[q.key] = q; });

  // 六类型（随机掉落用），一一对应六槽
  var TYPES = {
    weapon:  { label: '兵刃', names: ['铁剑', '钢刀', '长枪', '梨花枪', '雁翎刀', '丈八蛇矛', '熟铜锏', '流星锤'], base: [4, 12], bias: 'atk' },
    cloth:   { label: '衣甲', names: ['皮甲', '锁子甲', '铁鳞甲', '明光铠', '山文甲'],               base: [3, 10], bias: 'def' },
    hat:     { label: '帽笠', names: ['皮帽', '铁盔', '簪缨盔', '凤翅盔', '束发冠'],               base: [1, 4],  bias: 'def' },
    shoe:    { label: '鞋履', names: ['布鞋', '战靴', '乌皮靴', '云履', '麻鞋'],                   base: [1, 4],  bias: 'spd' },
    trinket: { label: '饰品', names: ['玉佩', '青玉戒', '狼牙坠', '铜符', '夜光璧'],                 base: [2, 6],  bias: 'mix' },
    belt:    { label: '腰带', names: ['布带', '犀带', '玉带', '吞兽带', '蹀躞带'],                 base: [1, 4],  bias: 'mix' }
  };
  var TYPE_KEYS = Object.keys(TYPES);

  // 静态物品定义（期初行囊 / 任务 / 商店）。defId 唯一键。
  var DEFS = {
    jinchuang:   { defId: 'jinchuang',   name: '金疮药', icon: '🧪', cat: '药剂', maxStack: 30, effect: { hp: 50 },                 desc: '外敷金创，止血生肌，可疗外伤五十。' },
    zhou:        { defId: 'zhou',        name: '扁舟',   icon: '⛵', cat: '道具', desc: '一叶轻舟，江河可渡。行经水路郊野时持有此舟，渡口乘船不取分文。' },
    roubao:      { defId: 'roubao',      name: '肉包子', icon: '🥟', cat: '食饵', effect: { food: 20, drink: 5 },     desc: '热乎包子一只，啃下可充饥解渴。' },
    yaofen:      { defId: 'yaofen',      name: '草药粉', icon: '🌿', cat: '药剂', effect: { hp: 25 },                 desc: '捣碎的草药细粉，作敷料可缓伤痛。' },
    tangyao:     { defId: 'tangyao',     name: '汤药',   icon: '🍵', cat: '药剂', maxStack: 12, effect: { hp: 130 },                desc: '慢火熬出的汤药，温养气血，重伤可复。' },
    zangbu_hat:  { defId: 'zangbu_hat',  name: '脏布帽子', icon: '🧢', cat: '装备', slot: 'hat',    stats: {},        desc: '一顶灰扑扑的布帽，聊胜于无。', quality: 'white' },
    polan_stick: { defId: 'polan_stick', name: '破烂木棒', icon: '🪵', cat: '装备', slot: 'weapon', stats: { atk: 2 }, desc: '枯枝胡乱削成，挥之噗噗作响，聊备一格。', quality: 'white' },
    yaobao:  { defId: 'yaobao',  name: '便携腰包', icon: '👝', cat: '装备', slot: 'belt', stats: {}, packSpace: 4,  desc: '软皮小囊，系于腰间，多纳杂物四件。', quality: 'white' },
    hutou:   { defId: 'hutou',   name: '虎头鞶囊', icon: '🎒', cat: '装备', slot: 'bag', stats: {}, packSpace: 20, desc: '虎头纹鞶囊，革坚囊阔，可容杂物二十。', quality: 'green' },
    // —— 背囊/行囊类（占「背包」槽，扩充行囊容量；与虎头鞶囊互斥，择一而用）——
    xiaonang:       { defId: 'xiaonang',       name: '小囊',     icon: '👝', cat: '装备', slot: 'bag', stats: {},       packSpace: 6,  desc: '寻常小皮囊，粗能容物六件。', quality: 'white' },
    shunang:        { defId: 'shunang',        name: '书囊',     icon: '🎒', cat: '装备', slot: 'bag', stats: { wuxing: 1 }, packSpace: 10, desc: '书生负笈之囊，囊中常卷，渐通文墨（悟性 +1）。', quality: 'green' },
    jianyixingzhuang:{ defId: 'jianyixingzhuang', name: '简易行装', icon: '🎒', cat: '装备', slot: 'bag', stats: { spd: 1 },  packSpace: 4,  desc: '一卷轻便行囊，减负疾行（身法 +1）。', quality: 'white' },
    pibao:          { defId: 'pibao',          name: '皮革包裹', icon: '🎒', cat: '装备', slot: 'bag', stats: {},       packSpace: 14, desc: '厚实皮革裹就，囊阔能容十四。', quality: 'green' },
    caiyaobiluo:    { defId: 'caiyaobiluo',    name: '采药背篓', icon: '🧺', cat: '装备', slot: 'bag', stats: {},       packSpace: 15, desc: '竹编背篓，采药山行尤便，可容十五。', quality: 'green' },
    // —— 腰带：防御型（与「便携腰包」互斥，体现「要容量还是要防御」的取舍）——
    shutong:        { defId: 'shutong',        name: '熟铜护腰', icon: '🪢', cat: '装备', slot: 'belt', stats: { def: 1 }, desc: '熟铜片缀就的护腰，堪挡一刀（防御 +1）。', quality: 'white' },
    // —— 教程·苦役营经济物品（真实物品，占行囊一格）——
    lao_pai:  { defId: 'lao_pai',  name: '劳字木片', icon: '🪵', cat: '凭证', desc: '劳役所发的木片，刻一「劳」字。可持往伙房易食，占行囊一格。' },
    fan:      { defId: 'fan',      name: '干粮',     icon: '🍙', cat: '食饵', maxStack: 50, effect: { food: 25 }, desc: '粗粝饭团，啃下可充饥（回食物 25）。可交付 NPC。' },
    xizhou:   { defId: 'xizhou',   name: '稀粥',     icon: '🥣', cat: '食饵', effect: { food: 12, drink: 12 }, desc: '误了饭点才捞着的半瓢冷粥，米粒可数，好歹暖了肚子（回食物 12、水 12）。' },
    chutu:         { defId:'chutu', name:'木锄', icon:'⛏️', cat:'工具', slot:'tool', tool:true, hoeLv:0, maxDur:14, price:12, desc:'木柄木头的锄（锄之第一阶），务农开荒的趁手家伙。' },
    yecai:    { defId: 'yecai',    name: '野菜',     icon: '🥬', cat: '食饵', effect: { food: 6 }, desc: '薄田里掐下的菜蔬，带着泥腥气。生啃可略充饥，交到伙房能入锅。' },
    // —— 素材：野外采集所得 ——
    caoyao:         { defId: 'caoyao',         name: '草药',     icon: '🌿', cat: '素材', desc: '山野可入药的茎叶，多凑几味可合成疗伤之物。' },
    shengrou:       { defId: 'shengrou',       name: '生肉',     icon: '🥩', cat: '素材', desc: '猎获或劫掠所得的生肉，于篝火炊制可成一包肉脯干粮。' },
    xiang:          { defId: 'xiang',          name: '线香',     icon: '🕯️', cat: '素材', desc: '香烛店晨起请来的线香，心诚则灵，可敬神祈愿、趋吉避凶。' },
    chaye:          { defId: 'chaye',          name: '茶叶',     icon: '🍵', cat: '素材', desc: '炒青晒制的散茶，沸水一冲，满室清香；茶楼案上待客的常物。' },
    yeguo:          { defId: 'yeguo',          name: '野果',     icon: '🍎', cat: '食饵', effect: { food: 8, drink: 3 }, desc: '道旁野树结的果子，涩中带甜，饥渴时聊可充饥解渴。' },
    // —— 建造/制造系统测试素材 ——
    xiaoshuzhi:    { defId: 'xiaoshuzhi', name: '小树枝', icon: '🍂', cat: '素材', desc: '徒手折下的细弱枝条，需于木工台加工方能成材。' },
    mutou:         { defId: 'mutou',   name: '木头',   icon: '🪵', cat: '素材', maxStack: 99, desc: '粗伐的树干枝料，可于木工台加工成木材，亦能直接搭架。' },
    zhuzi:         { defId: 'zhuzi',   name: '竹子',   icon: '🎋', cat: '素材', desc: '伐自竹林的翠竹，破篾可编器，削制可作简册，亦为弓杆良材。' },
    mo:            { defId: 'mo',      name: '墨',     icon: '🖤', cat: '素材', desc: '松烟和胶制成的墨锭，研磨后可书于简册，字迹历久不褪。' },
    mucai:         { defId: 'mucai',   name: '木材',   icon: '🟫', cat: '素材', maxStack: 99, desc: '经木工台刨削而成的规整木料，修筑与打造的基材。' },
    futou:         { defId:'futou', name:'石斧', icon:'🪓', cat:'工具', slot:'tool', tool:true, axeLv:0, maxDur:8, price:10, desc:'石刃木柄的粗斧（斧之第一阶），伐木可得木料；每伐一次耗耐久一，耐久尽则损毁。' },
    zhangpeng:     { defId: 'zhangpeng', name: '帐篷', icon: '⛺', cat: '器具', placeable:true,
      place:{ key:'tent', icon:'⛺', name:'帐篷', desc:'支起的行帐，可在此休整或收起', actions:'tent' },
      desc: '可携行的小帐。于背包「放置」后支起，房中即可「休息」「收起」。' },
    gongzuotai:    { defId: 'gongzuotai', name: '便携工作台', icon: '🔨', cat: '器具', placeable:true,
      place:{ key:'p_bench', icon:'🔨', name:'木工台', desc:'摊开随行的木工台，可将木头加工成木材', actions:'p_bench' },
      desc: '可折叠的轻便木工台，于背包「放置」后支起，即可制作木器。' },
    campfire:      { defId: 'campfire', name: '篝火', icon: '🔥', cat: '器具', placeable:true,
      place:{ key:'campfire', icon:'🔥', name:'篝火', desc:'噼啪作响的营火，可烤火取暖、烘炊干粮', actions:'campfire' },
      desc: '一捆干柴点起的营火。于背包「放置」后，可烤火取暖恢复精力、烘热干粮。' },
    sleepmat:      { defId: 'sleepmat', name: '草席', icon: '🛏️', cat: '器具', placeable:true,
      place:{ key:'sleepmat', icon:'🛏️', name:'草席', desc:'一领草编卧席，铺地即可小睡养神', actions:'sleepmat' },
      desc: '轻便的草编卧席。于背包「放置」后铺地，可躺下小睡，回复气血内力。' },
    shuicao:       { defId: 'shuicao', name: '水槽', icon: '🪣', cat: '器具', placeable:true,
      place:{ key:'shuicao', icon:'🪣', name:'水槽', desc:'凿石为槽，蓄泉水以供饮濯；以他器倾注添水，槽满则溢', actions:'shuicao' },
      desc: '凿石为槽，置于室中便可蓄水。槽中水不凭空生，须以盛水之器倾注添满；饮之可解喉间干涸。' },
    zhangtai:      { defId: 'zhangtai', name: '账台', icon: '📊', cat: '器具', placeable:true,
      place:{ key:'zhangtai', icon:'📊', name:'账台', desc:'东家专用账台，可在此接管铺面经营（进货/定价/雇人/装潢）', actions:'manage_shop' },
      desc: '一方东家账台。于自家铺面「放置」后支起，点之即入经营总览，俯瞰买卖盈亏。' },
    shelf_wood:   { defId:'shelf_wood', name:'木货架', icon:'🪟', cat:'器具', placeable:true,
      place:{ key:'shop_shelf', icon:'🪟', name:'木货架', desc:'简陋木架，可存放少量货物（8 格）', actions:'container' },
      shelfSlots:8, contSlots:8, shelfTypes:4, price:30, desc:'粗木钉就的货架，于自家铺面「放置」后支起，可存放陈列货物（低级，容量小）。' },
    shelf_iron:   { defId:'shelf_iron', name:'铁货架', icon:'🗄', cat:'器具', placeable:true,
      place:{ key:'shop_shelf', icon:'🗄', name:'铁货架', desc:'铁木货架，可存放较多货物（16 格）', actions:'container' },
      shelfSlots:16, contSlots:16, shelfTypes:8, price:80, desc:'铁骨木板的结实货架，容量更大，适合有些规模的店铺。' },
    shelf_carved: { defId:'shelf_carved', name:'雕花货架', icon:'🗄', cat:'器具', placeable:true,
      place:{ key:'shop_shelf', icon:'🗄', name:'雕花货架', desc:'精工雕花货架，可存放大量货物（24 格）', actions:'container' },
      shelfSlots:24, contSlots:24, shelfTypes:12, price:200, desc:'匠人雕花的体面货架，气派又实用，大铺必备。' },
    box_small:    { defId:'box_small', name:'小箱子', icon:'📦', cat:'器具', placeable:true,
      place:{ key:'box_small', icon:'📦', name:'小箱子', desc:'精巧小木箱，仅容一物（1 格），便于贴身收些细碎。', actions:'container' },
      contSlots:1, price:8, desc:'尺半见方的小木箱，扣盖严实。于背包「放置」后支起，可存放 1 件物品。' },
    box_wood:     { defId:'box_wood', name:'木质箱子', icon:'🧰', cat:'器具', placeable:true,
      place:{ key:'box_wood', icon:'🧰', name:'木质箱子', desc:'扎实木箱，可存放少量物件（4 格）。', actions:'container' },
      contSlots:4, price:24, desc:'杉木钉就的箱子，于背包「放置」后支起，可存放 4 件物品。' },
    box_cabinet:  { defId:'box_cabinet', name:'柜子', icon:'🗄️', cat:'器具', placeable:true,
      place:{ key:'box_cabinet', icon:'🗄️', name:'柜子', desc:'高脚木柜，可存放较多物件（9 格）。', actions:'container' },
      contSlots:9, price:60, desc:'齐整的木柜，于背包「放置」后支起，可存放 9 件物品。' },
    shuidai:       { defId: 'shuidai', name: '水袋', icon: '💧', cat: '器具',
      desc: '兽皮缝就的水囊，可盛清水随身。盛满后向水槽倾注，便能给水槽添水。', waterCap:10 },
    // —— 营造系统：建材与图纸 ——
    shitiao:        { defId: 'shitiao',       name: '石料', icon: '🪨', cat: '素材', desc: '采自岩壁的石块，夯基砌灶的硬底料。' },
    zhuan:          { defId: 'zhuan',         name: '砖头', icon: '🧱', cat: '素材', desc: '窑烧而成的土砖，垒砌围墙与炉体的规整块材。' },
    tiekuai:        { defId: 'tiekuai',       name: '铁料', icon: '⛓️', cat: '素材', desc: '冶炼工坊熔石取铁所得，打造兵刃器具的关键材料。' },
    tiekuangshi:    { defId: 'tiekuangshi',   name: '铁矿石', icon: '⛏️', cat: '素材', desc: '崖间采得的铁矿石。投入冶炼工坊，添柴鼓风烧炼，可化成铁料。' },
    // —— 矿脉野地专属矿产（仅 geology==='mineral' 的野地可采）——
    tongkuang:      { defId: 'tongkuang',     name: '铜矿',   icon: '🟤', cat: '素材', desc: '矿脉野地采得的铜矿，可铸钱锻器。' },
    yinkuang:       { defId: 'yinkuang',      name: '银矿',   icon: '⚪', cat: '素材', desc: '矿脉野地采得的银矿，价昂于铜。' },
    jade:           { defId: 'jade',          name: '玉石',   icon: '🟢', cat: '素材', desc: '矿脉野地采得的玉石，温润可雕琢佩饰。' },
    yan:            { defId: 'yan',           name: '盐矿',   icon: '🧂', cat: '素材', desc: '矿脉野地采得的盐矿，行旅军中皆不可缺。' },
    tuzhi_yeolian:  { defId: 'tuzhi_yeolian', name: '冶炼工坊简', icon: '📜', cat: '简册', blueprint: 'bp_yeolian', price: 30,
      desc: '营造冶炼工坊的简册。于背包「依简营造」置于房中，备料后可分阶筑成工坊，炉成可熔石取铁。' },
    tuzhi_woodcamp: { defId: 'tuzhi_woodcamp', name: '伐木场简', icon: '📜', cat: '简册', blueprint: 'bp_woodcamp', price: 24,
      desc: '营造伐木场的简册。于背包「依简营造」置于房中，备料后可分阶筑成伐木场，场成可伐木取材。' },
    tuzhi_yaolu:    { defId: 'tuzhi_yaolu', name: '砖窑简', icon: '📜', cat: '简册', blueprint: 'bp_yaolu', price: 24,
      desc: '营造砖窑的简册。于背包「依简营造」置于房中，备料后可分阶筑成砖窑，窑成可烧土为砖。' },
    // —— 城市营造图样（第4步图纸系统：城中空地「营造」开工，开工即耗图）——
    tuzhi_house:    { defId: 'tuzhi_house',    name: '民宅简', icon: '📜', cat: '简册', blueprint: 'bp_house', price: 18,
      desc: '营造民宅的简册。于城中空地「营造」开工，立柱搭梁、苫草为顶，落成后百姓可居。' },
    tuzhi_market:   { defId: 'tuzhi_market',   name: '市集简', icon: '📜', cat: '简册', blueprint: 'bp_market', price: 30,
      desc: '营造市集的简册。于城中空地「营造」开工，平整地基、起造铺面，落成后商旅云集可收市租。' },
    tuzhi_farm:     { defId: 'tuzhi_farm',     name: '农庄简', icon: '📜', cat: '简册', blueprint: 'bp_farm', price: 20,
      desc: '营造农庄的简册。于城中空地「营造」开工，治田开阡、起造仓廪，落成后农人耕作粮草渐丰。' },
    tuzhi_barracks: { defId: 'tuzhi_barracks', name: '军营简', icon: '📜', cat: '简册', blueprint: 'bp_barracks', price: 36,
      desc: '营造军营的简册。于城中空地「营造」开工，立栅筑垒、列帐为营，落成后士卒驻扎可募兵操练。' },
    // —— 新增建筑图纸（v20260908）——
    tuzhi_blacksmith: { defId: 'tuzhi_blacksmith', name: '铁匠铺简', icon: '📜', cat: '简册', blueprint: 'bp_blacksmith', price: 40,
      desc: '营造铁匠铺的简册。于背包「依简营造」置于房中，夯基立架、装炉设砧，铺成可炼铁锻兵、修理器具。' },
    tuzhi_tavern: { defId: 'tuzhi_tavern', name: '酒楼简', icon: '📜', cat: '简册', blueprint: 'bp_tavern', price: 45,
      desc: '营造酒楼的简册。于背包「依简营造」置于房中，起楼造灶、置桌设柜，楼成可饮酒吃饭、打听消息。' },
    tuzhi_inn: { defId: 'tuzhi_inn', name: '客栈简', icon: '📜', cat: '简册', blueprint: 'bp_inn', price: 35,
      desc: '营造客栈的简册。于背包「依简营造」置于房中，起房置床、设柜存物，栈成可住宿休息、寄存物品。' },
    tuzhi_martialhall: { defId: 'tuzhi_martialhall', name: '武馆简', icon: '📜', cat: '简册', blueprint: 'bp_martialhall', price: 42,
      desc: '营造武馆的简册。于背包「依简营造」置于房中，立桩设架、列兵器，馆成可练武学艺、与人切磋。' },
    tuzhi_granary: { defId: 'tuzhi_granary', name: '粮仓简', icon: '📜', cat: '简册', blueprint: 'bp_granary', price: 60,
      desc: '营造粮仓的简册。于背包「依简营造」置于房中，夯基筑囤、架梁苫顶，仓成可大量存储粮草。' },
    tuzhi_watchtower: { defId: 'tuzhi_watchtower', name: '瞭望塔简', icon: '📜', cat: '简册', blueprint: 'bp_watchtower', price: 30,
      desc: '营造瞭望塔的简册。于背包「依简营造」置于房中，夯基立柱、搭台设梯，塔成可登高远眺、察敌观风。' },
    tuzhi_arrowtower: { defId: 'tuzhi_arrowtower', name: '箭塔简', icon: '📜', cat: '简册', blueprint: 'bp_arrowtower', price: 38,
      desc: '营造箭塔的简册。于背包「依简营造」置于房中，夯基立柱、装弩设箭，塔成可自动射击来犯之敌。' },
    tuzhi_farmland: { defId: 'tuzhi_farmland', name: '农田简', icon: '📜', cat: '简册', blueprint: 'bp_farmland', price: 25,
      desc: '营造农田的简册。于背包「依简营造」置于房中，整地修渠、围篱播种，田成可定时产出粮食。' },
    tuzhi_well: { defId: 'tuzhi_well', name: '水井简', icon: '📜', cat: '简册', blueprint: 'bp_well', price: 20,
      desc: '营造水井的简册。于背包「依简营造」置于房中，挖井砌壁、置辘轳，井成可源源取水。' },
    tuzhi_pigpen: { defId: 'tuzhi_pigpen', name: '猪圈简', icon: '📜', cat: '简册', blueprint: 'bp_pigpen', price: 18,
      desc: '营造猪圈的简册。于背包「依简营造」置于房中，整地围栅、置槽建窝，圈成可养猪产肉。' },
    tuzhi_gate: { defId: 'tuzhi_gate', name: '寨门简', icon: '📜', cat: '简册', blueprint: 'bp_gate', price: 32,
      desc: '营造寨门的简册。于背包「依简营造」置于房中，夯基立门、置闸设岗，门成可为营地门户。' },
    tuzhi_training: { defId: 'tuzhi_training', name: '训练场简', icon: '📜', cat: '简册', blueprint: 'bp_training', price: 28,
      desc: '营造训练场的简册。于背包「依简营造」置于房中，整地铺沙、设器立桩，场成可练武提升。' },
    // —— 冶炼工坊产出（铁料加工链）——
    tiejian:  { defId: 'tiejian',  name: '铁剑', icon: '⚔️', cat: '装备', slot: 'weapon', stats: { atk: 8 }, quality: 'green',
      desc: '冶炼工坊打制的铁剑，刃口冷冽，远胜木棒。' },
    tiefu:         { defId:'tiefu', name:'铁斧', icon:'🪓', cat:'工具', slot:'tool', tool:true, axeLv:4, maxDur:38, price:150, desc:'精铁打造的斧（斧之第五阶），斧刃不卷，伐木如割。' },
    tiema:    { defId: 'tiema',    name: '铁马掌', icon: '🧲', cat: '素材', price: 15,
      desc: '打铁余料锻成的马蹄铁，可售与马市，亦或他途。' },
    // —— 显示测试专用：全属性加成的饰品 ——
    ceshizhizhu: { defId: 'ceshizhizhu', name: '测试之珠', icon: '🔮', cat: '装备', slot: 'trinket',
      stats: { atk: 18, def: 16, spd: 12, hp: 120, mp: 80, wuxing: 8 }, quality: 'orange',
      desc: '专供界面测试的饰品：攻防身法、气血内力、乃至悟性，诸般属性皆有所加，以观多属性之排版效果。' },
    // —— 东汉风新增：兽皮 / 蛇类 / 竹器 / 石器兵器 ——
    maopi:   { defId: 'maopi',   name: '毛皮',     icon: '🐾', cat: '素材', desc: '猎获野兽剥下的毛皮，可缝衣制甲，亦能售与行商。' },
    shedan:  { defId: 'shedan',  name: '蛇胆',     icon: '🟢', cat: '素材', desc: '蛇类肝胆，据闻可入药驱风，行商高价收之。' },
    shepi:   { defId: 'shepi',   name: '蛇皮',     icon: '🐍', cat: '素材', desc: '蜕落或剥取的蛇皮，韧而轻，可制囊裹。' },
    zhujian: { defId: 'zhujian', name: '竹简',     icon: '📜', cat: '素材', desc: '削竹为简、韦编成册，可录文记事，亦为营造图样之材。' },
    shidao:  { defId: 'shidao',  name: '石刀',     icon: '🔪', cat: '装备', slot: 'weapon', stats: { atk: 3 }, quality: 'white', desc: '粗砺的石刃绑于木柄，劈砍虽钝，聊备防身。' },
    gumao:   { defId: 'gumao',   name: '骨矛',     icon: '🗡️', cat: '装备', slot: 'weapon', stats: { atk: 5 }, quality: 'white', desc: '兽骨削尖为矛，锋锐胜于木棒，可刺可挑。' },
    mugong:  { defId: 'mugong',  name: '木弓',     icon: '🏹', cat: '装备', slot: 'weapon', stats: { atk: 4 }, quality: 'white', desc: '竹木弯就的猎弓，远可射禽兽，近亦可格。' },
    zhujia:  { defId: 'zhujia',  name: '竹制铠甲', icon: '🛡️', cat: '装备', slot: 'cloth', stats: { def: 2 }, quality: 'white', desc: '竹片编缀而成的铠甲，轻便耐磨，可挡寻常刀石（防御 +2）。' },
    // —— 强敌战利品（敌人掉落表引用；残页/令牌为收集与后续研习/支线素材）——
    blade_manual_frag: { defId: 'blade_manual_frag', name: '刀谱残页', icon: '📜', cat: '素材',
      desc: '某部刀谱散佞的一页，刀势刻痕犹存，多攒几页或可拼凑研习。' },
    talisman_scrap:    { defId: 'talisman_scrap',    name: '残符',     icon: '🕯️', cat: '素材',
      desc: '太平道符簋烧残的一角，纸面朱砂尚存，笔意晦涩难解。' },
    halberd_manual_page:{ defId: 'halberd_manual_page', name: '画戟谱残页', icon: '📜', cat: '素材',
      desc: '载有画戟招式的残页，笔画遂劲，隐有凛冽杀意。' },
    war_horse_token:   { defId: 'war_horse_token',   name: '战马令',   icon: '🏇', cat: '素材', price: 60,
      desc: '军中调马之令，持之或可往马市换得好马，亦可售与行商。' },
    heishan_token:     { defId: 'heishan_token',     name: '黑山令',   icon: '🪙', cat: '素材', price: 40,
      desc: '黑山军信物，铜牌刻燕形纹，凭此或可见黑山旧部，亦可售钱。' },
    // —— 酒楼/马市商品（对应城内店肆交互 packAdd 引用）——
    jiu:       { defId: 'jiu',       name: '黍酒', icon: '🍶', cat: '食饵', effect: { drink: 15, food: 5 },
      desc: '黍米酿就的浊酒，酒香扑鼻，饮之解渴暖身，或可御寒壮行。' },
    horse:     { defId: 'horse',     name: '川马', icon: '🐴', cat: '素材', price: 80,
      desc: '相中的栗色川马，蹄声如鼓，正堪长途，亦可售与马行。' },
    // —— 苦役营教程物品（v20260902a · 10 越狱路线获取物）——
    // —— 洛阳铲（v20260928f）：越狱「挖地道」线任务专用道具 ——
    //   B 类：来路不正，货郎不收、市面买不着（noSell）。半筒瓦铲可带起整筒土样，
    //   看土色便知底下是夯土还是虚坑——故独享 soilSample；digPower 2 = 一铲抵两铲。
    luoyang_chan: { defId: 'luoyang_chan', name: '洛阳铲', icon: '🪓', cat: '凭证',
      quest: true, taskOnly: true, noSell: true,
      tool: true, maxDur: 8, digPower: 2, soilSample: true,
      desc: '半筒瓦铲，铲头如瓦、木柄三尺——本是探土辨层的贼家伙，一铲下去带起整筒土样，看土色便知底下是夯土还是虚坑。此物来路不正：市面买不着，出了这档子事也没人肯收。挖地道线（路线二）离不得它，一铲抵两铲。' },
    // —— 工具六系 × 六阶（v20260928e）：镐/斧/锄/镰/竿/锯，材料阶梯 粗石→精石→青铜→粗铁→精铁→百炼钢 ——
    //   汉末冶铁：炒钢法与「百炼」之器已见于世，故以 石→铜→铁→百炼钢 为阶，与镐头六级同构。
    //   工具占「工具」装备槽（单槽·手持一件），不占行囊格；行囊可携备用件随时换。
    // —— 镐 ——
    cushi_gao:     { defId:'cushi_gao', name:'粗石镐', icon:'🪨', cat:'工具', slot:'tool', tool:true, pickLv:0, maxDur:12, price:8, desc:'碎石绑木柄的粗使家什（镐之第一阶），只凿得小石堆，矿洞可下二层。' },
    jing_shi_gao:  { defId:'jing_shi_gao', name:'精致石镐', icon:'⛏', cat:'工具', slot:'tool', tool:true, pickLv:1, maxDur:18, price:24, desc:'选石开棱、柄切手（镐之第二阶），磋小石两下一碎；已能开铜脉，矿洞可下三层。' },
    qingtong_gao:  { defId:'qingtong_gao', name:'青铜镐', icon:'🥉', cat:'工具', slot:'tool', tool:true, pickLv:2, maxDur:26, price:55, desc:'青铜铸的镐头（镐之第三阶），能凿大石堆。矿洞可下四层。' },
    cu_tie_gao:    { defId:'cu_tie_gao', name:'粗铁镐', icon:'⛏️', cat:'工具', slot:'tool', tool:true, pickLv:3, maxDur:36, price:110, desc:'粗铁锻的镐头（镐之第四阶），铁石开采的入门家什。矿洞可下六层。' },
    jing_tie_gao:  { defId:'jing_tie_gao', name:'精致铁镐', icon:'⚒️', cat:'工具', slot:'tool', tool:true, pickLv:4, maxDur:48, price:220, desc:'细锻铁镐（镐之第五阶），尖锐却有弹性：青玉脉也凿得开。矿洞可下八层。' },
    bailian_gao:   { defId:'bailian_gao', name:'百炼钢镐', icon:'⚔️', cat:'工具', slot:'tool', tool:true, pickLv:5, maxDur:64, price:480, desc:'按百炼钢法锻就的神器（镐之第六阶），天下没几把。玄铁矿脉也凿得，矿洞全层可下。' },
    // —— 斧 ——
    jingshi_fu:    { defId:'jingshi_fu', name:'精致石斧', icon:'🪓', cat:'工具', slot:'tool', tool:true, axeLv:1, maxDur:14, price:20, desc:'选石磨刃的斧（斧之第二阶），比粗斧省力些。' },
    tongfu:        { defId:'tongfu', name:'青铜斧', icon:'🪓', cat:'工具', slot:'tool', tool:true, axeLv:2, maxDur:22, price:48, desc:'青铜铸刃的斧（斧之第三阶），碗口粗的树也斩得断。' },
    cutie_fu:      { defId:'cutie_fu', name:'粗铁斧', icon:'🪓', cat:'工具', slot:'tool', tool:true, axeLv:3, maxDur:30, price:95, desc:'粗铁锻的斧（斧之第四阶），沉而有力。' },
    bailian_fu:    { defId:'bailian_fu', name:'百炼钢斧', icon:'🪓', cat:'工具', slot:'tool', tool:true, axeLv:5, maxDur:52, price:300, desc:'百炼钢斧（斧之第六阶），巨木应声而倒。' },
    // —— 锄 ——
    jingmu_chu:    { defId:'jingmu_chu', name:'精致木锄', icon:'⛏️', cat:'工具', slot:'tool', tool:true, hoeLv:1, maxDur:20, price:22, desc:'削得趁手的木锄（锄之第二阶），翻土略快些。' },
    tongchu:       { defId:'tongchu', name:'青铜锄', icon:'⛏️', cat:'工具', slot:'tool', tool:true, hoeLv:2, maxDur:26, price:50, desc:'青铜锄头的锄（锄之第三阶），硬土也啃得动。' },
    cutie_chu:     { defId:'cutie_chu', name:'粗铁锄', icon:'⛏️', cat:'工具', slot:'tool', tool:true, hoeLv:3, maxDur:34, price:100, desc:'粗铁锄头（锄之第四阶），翻土起垄省力得多。' },
    tiechu:        { defId:'tiechu', name:'铁锄', icon:'⛏️', cat:'工具', slot:'tool', tool:true, hoeLv:4, maxDur:42, price:160, desc:'精铁打的小锄（锄之第五阶），垄沟齐整。' },
    bailian_chu:   { defId:'bailian_chu', name:'百炼钢锄', icon:'⛏️', cat:'工具', slot:'tool', tool:true, hoeLv:5, maxDur:58, price:320, desc:'百炼钢锄（锄之第六阶），入土如切腐。' },
    // —— 镰 ——
    jingshi_lian:  { defId:'jingshi_lian', name:'精致石镰', icon:'🌾', cat:'工具', slot:'tool', tool:true, sickleLv:1, maxDur:20, price:28, desc:'磨得锋利的石镰（镰之第二阶）。' },
    tonglian:      { defId:'tonglian', name:'青铜镰', icon:'🌾', cat:'工具', slot:'tool', tool:true, sickleLv:2, maxDur:26, price:52, desc:'青铜小镰（镰之第三阶），一揽一大把。' },
    cutie_lian:    { defId:'cutie_lian', name:'粗铁镰', icon:'🌾', cat:'工具', slot:'tool', tool:true, sickleLv:3, maxDur:34, price:100, desc:'粗铁镰（镰之第四阶），割稻如风。' },
    tielian:       { defId:'tielian', name:'铁镰', icon:'🌾', cat:'工具', slot:'tool', tool:true, sickleLv:4, maxDur:42, price:155, desc:'精铁镰（镰之第五阶），刃薄而韧。' },
    bailian_lian:  { defId:'bailian_lian', name:'百炼钢镰', icon:'🌾', cat:'工具', slot:'tool', tool:true, sickleLv:5, maxDur:56, price:300, desc:'百炼钢镰（镰之第六阶），刈草如剃。' },
    // —— 竿 ——
    diaogan:       { defId:'diaogan', name:'竹竿', icon:'🎣', cat:'工具', slot:'tool', tool:true, rodLv:0, maxDur:18, price:25, desc:'竹竿系线（竿之第一阶），临水垂钓的家什。' },
    gugou_gan:     { defId:'gugou_gan', name:'骨钩竿', icon:'🎣', cat:'工具', slot:'tool', tool:true, rodLv:1, maxDur:24, price:40, desc:'骨钩细线（竿之第二阶），比竹竿稳当。' },
    tonggou_gan:   { defId:'tonggou_gan', name:'铜钩竿', icon:'🎣', cat:'工具', slot:'tool', tool:true, rodLv:2, maxDur:30, price:70, desc:'铜钩竿（竿之第三阶），钩锐不易脱。' },
    cutie_gan:     { defId:'cutie_gan', name:'粗铁竿', icon:'🎣', cat:'工具', slot:'tool', tool:true, rodLv:3, maxDur:36, price:120, desc:'粗铁竿（竿之第四阶），大鱼也拽得动。' },
    tiegan:        { defId:'tiegan', name:'铁竿', icon:'🎣', cat:'工具', slot:'tool', tool:true, rodLv:4, maxDur:44, price:190, desc:'精铁竿（竿之第五阶），韧而不折。' },
    bailian_gan:   { defId:'bailian_gan', name:'百炼钢竿', icon:'🎣', cat:'工具', slot:'tool', tool:true, rodLv:5, maxDur:58, price:340, desc:'百炼钢竿（竿之第六阶），钓得起江中大物。' },
    // —— 锯 ——
    mujv:          { defId:'mujv', name:'木锯', icon:'🪚', cat:'工具', slot:'tool', tool:true, sawLv:0, maxDur:16, price:30, desc:'石齿木锯（锯之第一阶），解板成材——原木非锯不成料。' },
    jingshi_jv:    { defId:'jingshi_jv', name:'精致石锯', icon:'🪚', cat:'工具', slot:'tool', tool:true, sawLv:1, maxDur:22, price:45, desc:'磨利的石锯（锯之第二阶）。' },
    tongjv:        { defId:'tongjv', name:'青铜锯', icon:'🪚', cat:'工具', slot:'tool', tool:true, sawLv:2, maxDur:28, price:75, desc:'青铜锯（锯之第三阶），锯齿不易崩。' },
    cutie_jv:      { defId:'cutie_jv', name:'粗铁锯', icon:'🪚', cat:'工具', slot:'tool', tool:true, sawLv:3, maxDur:36, price:130, desc:'粗铁锯（锯之第四阶），解板快。' },
    tiejv:         { defId:'tiejv', name:'铁锯', icon:'🪚', cat:'工具', slot:'tool', tool:true, sawLv:4, maxDur:44, price:200, desc:'精铁锯（锯之第五阶），锯缝平直。' },
    bailian_jv:    { defId:'bailian_jv', name:'百炼钢锯', icon:'🪚', cat:'工具', slot:'tool', tool:true, sawLv:5, maxDur:58, price:360, desc:'百炼钢锯（锯之第六阶），原木应声而开。' },
    sleep_drug: { defId: 'sleep_drug', name: '迷药', icon: '💤', cat: '药剂',
      desc: '林娘以蒙汗草配制的迷药。下迷药业（路线3）下于饭中，可放倒官差；不伤性命。' },
    blank_pass:  { defId: 'blank_pass',  name: '空白木牍', icon: '🪵', cat: '素材',
      desc: '中军帐文案房取来的空白木牍，未刻一字。可请人刻作路引——陈简那双手，能把这枚木片变成一张路引。' },
    wooden_pass: { defId: 'wooden_pass', name: '木牍路引', icon: '🪵', cat: '素材',
      desc: '陈简以营中竹木伪造的路引木牍。伪造木牍线（路线5）混出门的凭证；如今纸贵，木牍最便。' },
    rope:      { defId: 'rope',      name: '绳', icon: '🪢', cat: '素材',
      desc: '苏娘以竹麻搓制的绳。攀绳翻墙线（路线7）攀墙工具；结实耐用。' },
    bumu:      { defId: 'bumu',      name: '粗布', icon: '🟦', cat: '素材',
      desc: '粗织麻布，缝囊储物、留种布袋皆可用；行商常收，市集有售。' },
    guard_tally:{ defId: 'guard_tally', name: '腰牌', icon: '🪪', cat: '素材',
      desc: '赵虎的都伯腰牌，夺来可作暴动线（路线4）的信物；沾了血才到手。' },
    // —— 囚服 / 镣铐（v20260912f）：主角开局仅有的两件行头 ——
    //   囚服占「衣甲」槽、镣铐占「鞋履」槽，故开局的装备面板是有东西可看的
    //   （行囊教学第一步就落在这里：先让玩家看清自己身上还剩什么，再谈别的）。
    qiufu:     { defId: 'qiufu',     name: '囚服', icon: '🥋', cat: '装备', slot: 'cloth', stats: { def: 1 }, quality: 'white',
      desc: '赭色粗麻囚衣，襟前烙着营中编号。遮体御寒尚可，说不上护身。' },
    liaokao:   { defId: 'liaokao',   name: '镣铐', icon: '⛓️', cat: '装备', slot: 'shoe',  stats: {},          quality: 'white',
      desc: '脚踝上一副生铁镣，走起路来哗啦作响。戴着它，跑是跑不快的。' },
    // —— 渔获（郊野水域垂钓所得；可充饥，亦可售与行商）——
    fish:       { defId: 'fish',       name: '鲜鱼', icon: '🐟', cat: '食饵', effect: { food: 25 },
      desc: '郊野河湖钓得的鲜鱼，去鳞剖腹下锅最鲜；久置则腥，宜尽早烹食。' },
    fish_dried: { defId: 'fish_dried', name: '咸鱼', icon: '🐟', cat: '食饵', price: 12, effect: { food: 18 },
      desc: '盐渍风干的咸鱼，耐存不坏，行旅干粮之选，亦堪易米。' },
    // —— 农事（v20260915g）：种子与收成 ——
    //   这几件是「任务物也是泛用物」的样板：教学里靠它们交差，出了营照样能吃、能卖、能留种。
    //   此前图省事直接在代码里塞自造对象（不进这张表），结果在商店/寄售这些读 LF.ITEMS[defId]
    //   的地方掉回英文 id —— 玩家看到的「乱码」就是从这儿来的。凡进背包的物，一律先在此登记。
    caizi:    { defId: 'caizi',    name: '菜籽', icon: '🌱', cat: '素材', price: 2,
      desc: '野菜结的籽。撒进翻透的畦里还能再长一茬——孙老说，肯留种的人才算种地的。' },
    douzhong: { defId: 'douzhong', name: '菽种', icon: '🥜', cat: '素材', price: 4,
      desc: '菽豆的种子。生得慢些，收成却厚，也耐存放。' },
    dou:      { defId: 'dou',      name: '菽豆', icon: '🥜', cat: '食饵', price: 5, effect: { food: 14 },
      desc: '收下的菽豆。煮烂了能顶一顿，晒干了能存一冬，也能换几个钱。' },
    // 伙房大灶的出品（v20260915g）：田里种出来的东西，得有个变成热食的去处
    douzhou:  { defId: 'douzhou',  name: '豆粥', icon: '🥣', cat: '食饵', price: 8, effect: { food: 22, drink: 6 },
      desc: '菽豆熬的稠粥，面上浮一层豆油。营里的稀粥照得见人影，这一碗照不见——顶饿，也顶一句想家。' },

    // —— 矿洞体系新资源 (v20260915i)：玄铁 / 木炭 / 百炼钢简 ——
    xuatie:     { defId: 'xuatie',     name: '玄铁', icon: '🪨', cat: '素材', price: 120,
      desc: '矿洞最深处采得的墨色铁母，沉逾寻常铁石。百炼成钢后锻器，锋锐无匹。' },
    mutan:      { defId: 'mutan',      name: '木炭', icon: '⚫', cat: '素材', price: 4,
      desc: '闷窑熏出的木炭，无烟耐烧。铁匠炉里最认它——火候稳，锻出的钢才匀。' },
    bailian_jian:{ defId: 'bailian_jian', name: '百炼钢简', icon: '📜', cat: '凭证',
      desc: '刻着百炼钢法的残简：炒钢为料、反复折叠锻打。持之往铁匠铺，可依简锻百炼钢镐。' },
    // —— 地产（v20260927k）：城中置业的一纸凭证 ——
    house_deed: { defId: 'house_deed', name: '房契', icon: '🏠', cat: '凭证', price: 500,
      desc: '官牙勘验、署印画押的一纸房契，载明城中宅院归属。持之即为该宅主人；亦可用以赠人，成人安身之所。' },
    shop_deed:  { defId: 'shop_deed',  name: '商铺契', icon: '🏪', cat: '凭证', price: 800,
      desc: '官牙勘验的商铺契书，载明城中铺面归属。持之即为该铺主人，可收租取利；亦可用以赠人。' },
    // 矿洞下行（v20260915j）：每下一层须架一挂木梯（铁匠炉制：木材×3+石料×2）
    muti:       { defId: 'muti',       name: '木梯', icon: '🪜', cat: '工具', price: 8,
      desc: '削木为柱、绑石为阶的短梯。矿道陡崖深不见底，有它才下得去。' },
    // —— 财货（v20260927s）：珍稀值钱之物，可售行商、可易宝物 ——
    jintiao:    { defId: 'jintiao',    name: '金条', icon: '🪙', cat: '财货', price: 200,
      desc: '足色金条，官铸成锭。乱世硬通货，行商见之眼睛发亮。' },
    yinding:    { defId: 'yinding',    name: '银锭', icon: '🪙', cat: '财货', price: 100,
      desc: '船形银锭，成色十足。可换钱帛，亦可作礼。' },
    yupei:      { defId: 'yupei',      name: '玉佩', icon: '🟢', cat: '财货', price: 150,
      desc: '青玉平安扣，温润生光。佩之养性，赠人留情，行商重价收之。' },
    shouzhuo:   { defId: 'shouzhuo',   name: '手镯', icon: '🟢', cat: '财货', price: 120,
      desc: '翡翠圆镯，色若春水。名门贵妇梳妆匣里的旧物。' },
    zhenzhu:    { defId: 'zhenzhu',    name: '珍珠', icon: '⚪', cat: '财货', price: 90,
      desc: '江蚌孕育的圆珠，莹润如月。可饰可藏，行商高价求之。' },
    // —— 建材资材（v20260927s）：修筑与制造的进阶材料 ——
    tieding:    { defId: 'tieding',    name: '铁锭', icon: '⛓️', cat: '素材', price: 30,
      desc: '冶炼工坊精炼的铁锭，匀实无杂，锻兵铸铁的良材。' },
    shihui:     { defId: 'shihui',     name: '石灰', icon: '🪨', cat: '素材', price: 5,
      desc: '石灰窑烧出的白灰，和泥砌墙、刷白辟湿皆宜。' },
    zhucai:     { defId: 'zhucai',     name: '竹材', icon: '🎋', cat: '素材', price: 6,
      desc: '剖削齐整的竹材，编器搭架、造箭为弓皆堪用。' },
    // —— 农具（v20260927s）：种田开垦的趁手家伙 ——
    liandao:       { defId:'liandao', name:'镰刀', icon:'🌾', cat:'工具', slot:'tool', tool:true, sickleLv:0, maxDur:16, price:18, desc:'弯月镰刀（镰之第一阶），割麦刈草最为利落。' },
    tiechan:    { defId: 'tiechan', name: '铁铲', icon: '⛏️', cat: '工具', slot:'tool', tool:true, spadeLv:4, maxDur: 40, price: 90,
      desc: '铁头木柄的铲，翻土起畦、掘坑筑沟都好使。' },
    li:         { defId: 'li',         name: '木犁', icon: '🪵', cat: '工具', price: 35,
      desc: '曲辕铁铧的木犁，牛拽人扶，开荒破土的大件。' },
    mutong:     { defId: 'mutong',     name: '木桶', icon: '🪣', cat: '器具', price: 8,
      desc: '铁箍木桶，挑水盛粮、储果腌菜皆用得着。' },
    // —— 种子（v20260927s）：撒进畦里便有收成 ——
    maizhong:   { defId: 'maizhong',   name: '麦种', icon: '🌾', cat: '种子', price: 3,
      desc: '金黄麦粒选作种子，春撒秋收，一亩可换三斗面。' },
    daozhong:   { defId: 'daozhong',   name: '稻种', icon: '🌾', cat: '种子', price: 3,
      desc: '水田稻种，插秧灌渠，秋来满畈金浪。' },
    caizhong:   { defId: 'caizhong',   name: '菜种', icon: '🌱', cat: '种子', price: 2,
      desc: '细小菜籽，撒畦覆土，旬月可掐嫩叶。' },
    yaozhong:   { defId: 'yaozhong',   name: '药种', icon: '🌱', cat: '种子', price: 4,
      desc: '草药种子，圃中栽养，成株可采可入药。' },
    // —— 作物收成（v20260927s）——
    xiaomai:    { defId: 'xiaomai',    name: '小麦', icon: '🌾', cat: '素材', price: 6,
      desc: '新收的小麦，穗粒饱满，晒干可磨面、可换钱。' },
    qingcai:    { defId: 'qingcai',    name: '青菜', icon: '🥬', cat: '食饵', price: 3, effect: { food: 8 },
      desc: '畦里掐下的鲜嫩青菜，下锅一焯便是一盘好菜。' },
    // —— 半成品与食材（v20260927s）——
    mianfen:    { defId: 'mianfen',    name: '面粉', icon: '🌾', cat: '素材', price: 8,
      desc: '石磨碾出的细面，和面擀饼、蒸馍包饺的底子。' },
    dami:       { defId: 'dami',       name: '大米', icon: '🍚', cat: '食饵', price: 10, effect: { food: 20 },
      desc: '白米粒粒饱满，淘水下锅，顶一日的饱。' },
    you:        { defId: 'you',        name: '食用油', icon: '🫙', cat: '素材', price: 12,
      desc: '榨出的清油，煎炒烹炸都离不得。' },
    jiang:      { defId: 'jiang',      name: '酱', icon: '🫙', cat: '素材', price: 6,
      desc: '豆麦酿成的酱，咸香扑鼻，佐饭拌菜皆宜。' },
    bupi:       { defId: 'bupi',       name: '布匹', icon: '🟨', cat: '素材', price: 14,
      desc: '织机上落下来的成匹粗布，裁衣缝囊、裹物包扎皆可用。' },
    // —— 畜牧产品（v20260927s）——
    jidan:      { defId: 'jidan',      name: '鸡蛋', icon: '🥚', cat: '素材', price: 3,
      desc: '鸡舍里拾的鲜蛋，滚水一煮便能饱腹。' },
    niunai:     { defId: 'niunai',     name: '牛奶', icon: '🥛', cat: '食饵', price: 5, effect: { drink: 12, food: 6 },
      desc: '挤下的鲜牛乳，煮沸去腥，饮之解渴养身。' },
    yangmao:    { defId: 'yangmao',    name: '羊毛', icon: '🐑', cat: '素材', price: 8,
      desc: '剪下的卷曲羊毛，弹松可絮衣被，纺线可织毡毯。' },
    pige:       { defId: 'pige',       name: '皮革', icon: '🟤', cat: '素材', price: 20,
      desc: '鞣制过的熟皮，坚韧防水，制甲缝靴的好料。' },
    fengmi:     { defId: 'fengmi',     name: '蜂蜜', icon: '🍯', cat: '食饵', price: 16, effect: { food: 10, drink: 6 },
      desc: '山野蜂巢割取的蜜，甘甜入喉，可疗疲解乏。' },
    // —— 肉类（v20260927s）：畜牧或猎获所得 ——
    zhurou:     { defId: 'zhurou',     name: '猪肉', icon: '🥩', cat: '素材', price: 9,
      desc: '肥瘦相间的猪肉，切块炖煮最是解馋。' },
    yangrou:    { defId: 'yangrou',    name: '羊肉', icon: '🥩', cat: '素材', price: 12,
      desc: '带骨羊肉，膻香扑鼻，冬日炖锅一绝。' },
    jirou:      { defId: 'jirou',      name: '鸡肉', icon: '🍗', cat: '素材', price: 8,
      desc: '家养肥鸡，宰净下锅，鲜嫩多汁。' },
    niurou:     { defId: 'niurou',     name: '牛肉', icon: '🥩', cat: '素材', price: 15,
      desc: '腱子牛肉，筋膜分明，卤煮酱烧皆美。' },
    // —— 牲畜（v20260927s）：养在圈里的小家畜 ——
    xiaozhu:    { defId: 'xiaozhu',    name: '小猪', icon: '🐷', cat: '牲畜', price: 25,
      desc: '圆滚滚的小猪，养在圈里添膘，大了可宰可卖。' },
    xiaoyang:   { defId: 'xiaoyang',   name: '小羊', icon: '🐑', cat: '牲畜', price: 30,
      desc: '卷毛小羊羔，长成可剪毛、可宰肉。' },
    xiaoji:     { defId: 'xiaoji',     name: '小鸡', icon: '🐔', cat: '牲畜', price: 10,
      desc: '绒黄的小鸡雏，养大能下蛋、能宰肉。' },
    xiaoniu:    { defId: 'xiaoniu',    name: '小牛', icon: '🐮', cat: '牲畜', price: 60,
      desc: '花斑小牛犊，养大能耕田、能挤奶。' },
    // —— 名贵药材（v20260927s）——
    renshen:    { defId: 'renshen',    name: '人参', icon: '🌿', cat: '素材', price: 80,
      desc: '百草之王，根如人形。吊气续命、大补元气，行商重金求之。' },
    lingzhi:    { defId: 'lingzhi',    name: '灵芝', icon: '🍄', cat: '素材', price: 70,
      desc: '深山老木上的灵芝，菌盖如云。入药可延年，卖价不菲。' },
    // ── 药材（v20261008b · 药店体系）：四性五味，供配药 / 鉴药 / 问诊 ──
    //   注：蜂蜜 fengmi（蜜丸基）、黍酒 jiu（酒基）已存在，直接复用为加工材料，不另建。
    mahuang:    { defId: 'mahuang',    name: '麻黄',   icon: '🌾', cat: '素材', price: 7,
      desc: '〔温·辛〕发汗解表，宣肺平喘——风寒汤、醒神汤之要药。' },
    guizhi:     { defId: 'guizhi',     name: '桂枝',   icon: '🌿', cat: '素材', price: 8,
      desc: '〔温·辛甘〕温通经脉，助阳化气——风寒汤、活血酒常用。' },
    shigao:     { defId: 'shigao',     name: '石膏',   icon: '🪨', cat: '素材', price: 9,
      desc: '〔寒·辛甘〕清热泻火，除烦止渴——清凉散、避暑丹之君药。' },
    huanglian:  { defId: 'huanglian',  name: '黄连',   icon: '🌿', cat: '素材', price: 18,
      desc: '〔寒·苦〕清热燥湿，泻火解毒——解毒丸、败毒散、避瘴丸之君药。' },
    fuling:     { defId: 'fuling',     name: '茯苓',   icon: '🍄', cat: '素材', price: 9,
      desc: '〔平·甘淡〕利水渗湿，健脾宁心——诸方常用的佐药。' },
    danggui:    { defId: 'danggui',    name: '当归',   icon: '🌿', cat: '素材', price: 22,
      desc: '〔温·辛甘〕补血活血，调经止痛——活血酒、金创膏之君药。' },
    banxia:     { defId: 'banxia',     name: '半夏',   icon: '🥔', cat: '素材', price: 16,
      desc: '〔温·辛〕燥湿化痰，降逆止呕。**生者有毒**，须依法炮制、火候到位方可入药。' },
    fuzi:       { defId: 'fuzi',       name: '附子',   icon: '🌶️', cat: '素材', price: 45,
      desc: '〔热·辛甘〕回阳救逆，补火助阳——壮气酒之君药。**大毒**，须以甘草为使解其毒。' },
    gancao:     { defId: 'gancao',     name: '甘草',   icon: '🌿', cat: '素材', price: 5,
      desc: '〔平·甘〕调和诸药，解百毒——使药之首，有毒之方几乎离不得它。' },
    chaye:      { defId: 'chaye',      name: '茶叶',   icon: '🍃', cat: '素材', price: 12,
      desc: '〔凉·苦甘〕提神醒脑，解腻消滞——提神散之君药，行旅赖以熬夜。' },
    // ── 加工材料（半成品层）：药材炮制所得，丸散膏丹的底子 ──
    yaomo:      { defId: 'yaomo',      name: '药末',   icon: '🧂', cat: '素材', price: 10,
      desc: '药材碾罗过的细末，丸、散、膏皆以此为基。蜂蜜（fengmi）可炼蜜丸，黍酒（jiu）可浸药酒。' },
    // —— 加工品（v20260928g）：配方产出 ——
    jingtie:    { defId: 'jingtie',    name: '精铁', icon: '⚙️', cat: '素材', price: 60,
      desc: '铁锭入炉、木炭猛火炼出的精钢，去渣存精——百炼成钢的胚子。' },
    hongshao:   { defId: 'hongshao',   name: '红烧肉', icon: '🍖', cat: '菜肴', price: 16, effect: { food: 18, drink: 4 },
      desc: '肥瘦相间，酱色油亮，入口即化的炖肉。' },
    kaoji:      { defId: 'kaoji',      name: '烤鸡', icon: '🍗', cat: '菜肴', price: 14, effect: { food: 15, drink: 3 },
      desc: '整鸡架火慢烤，皮脆肉嫩，撕开流汁。' },
    kaoyang:    { defId: 'kaoyang',    name: '烤羊肉', icon: '🍢', cat: '菜肴', price: 18, effect: { food: 17, drink: 5 },
      desc: '带骨羊肉串在火上翻烤，撒盐椒，膻香扑鼻。' },
    // ══ v20261008b · 药店成药（六轴体系，见 docs/PHARMACY_BLUEPRINT.md §3.0）══
    //   E 治疗 / A 解状态 / B 精力 / C 时令 / D 增益 / F 军用社交
    //   注：A/C/D/F 轴的「解状态 / 免疫 / 增益」需战斗侧接入后生效，当前先按回血给即时反馈。
    // ── A 轴 · 解状态 ──
    jiedu:      { defId:'jiedu', name:'解毒丸', icon:'🧫', cat:'药剂', maxStack:20, price:26, effect:{ hp:15 },
      desc:'黄连为君、茯苓为佐、甘草为使。〔解：毒〕——蝮蛇、毒虫之伤，服之可解。**须战斗侧接入后生效**。' },
    qingliang:  { defId:'qingliang', name:'清凉散', icon:'❄️', cat:'药剂', maxStack:20, price:24, effect:{ hp:12 },
      desc:'石膏为君、黄连为臣。〔解：灼烧〕——火攻、烫伤之苦，服之清凉。**须战斗侧接入后生效**。' },
    xingshen:   { defId:'xingshen', name:'醒神汤', icon:'🌀', cat:'药剂', maxStack:20, price:22, effect:{ hp:10 },
      desc:'麻黄为君、桂枝为臣。〔解：眩晕〕——震慑昏迷者，灌之即醒。**须战斗侧接入后生效**。' },
    huoxuejiu:  { defId:'huoxuejiu', name:'活血酒', icon:'🍶', cat:'药剂', maxStack:15, price:30, effect:{ hp:20 },
      desc:'当归为君、桂枝为臣，黍酒浸之。〔解：迟滞〕，兼治跌打瘀青。**须战斗侧接入后生效**。' },
    // ── B 轴 · 补精力 ──
    tishen:     { defId:'tishen', name:'提神散', icon:'🍃', cat:'药剂', maxStack:30, price:20, effect:{ energy:35 },
      desc:'茶叶为君、茯苓为臣。精神一振，赶夜路、连轴劳作都撑得住——睡觉要花时辰，这味药是拿银两换时间。' },
    shentang:   { defId:'shentang', name:'参汤', icon:'🥣', cat:'药剂', maxStack:12, price:45, effect:{ energy:50, hp:30 },
      desc:'人参为君、当归为臣，慢火煨就。大补元气，既复精力又养气血——重伤初愈者最宜。' },
    // ── D 轴 · 战前增益 ──
    zhuangqi:   { defId:'zhuangqi', name:'壮气酒', icon:'🔥', cat:'药剂', maxStack:12, price:35, effect:{ hp:10 },
      desc:'附子为君（大毒）、甘草为使解之，黍酒浸成。〔增益：攻 +5 · 3 回合〕——出门前嗑一味，胆气自壮。' },
    huxin:      { defId:'huxin', name:'护心丸', icon:'🔴', cat:'药剂', maxStack:8, price:60, effect:{ hp:40 },
      desc:'人参为君、茯苓为臣、灵芝为佐。〔护心：致命一击保一口气〕——绝境中留一线生机。' },
    jinchuangao:{ defId:'jinchuangao', name:'金创膏', icon:'🩹', cat:'药剂', maxStack:20, price:34, effect:{ hp:70 },
      desc:'当归为君、草药为臣、灵芝为佐。敷之止血生肌，〔减伤 20% · 3 回合〕——刀伤渗血，先敷这个。' },
    // ── C 轴 · 时令防护 ──
    fenghan:    { defId:'fenghan', name:'风寒汤', icon:'🫚', cat:'药剂', maxStack:20, price:15, effect:{ hp:20 },
      desc:'桂枝为君、麻黄为臣。〔免疫：风寒 · 12 时辰〕——风雪天出行前喝一碗，主头热身痛。' },
    bishu:      { defId:'bishu', name:'避暑丹', icon:'🧊', cat:'药剂', maxStack:20, price:18, effect:{ hp:15 },
      desc:'石膏为君、茯苓为佐。〔免疫：中暑 · 12 时辰〕——暑月行军、燥热烦渴者宜服。' },
    bizhang:    { defId:'bizhang', name:'避瘴丸', icon:'🌫️', cat:'药剂', maxStack:15, price:28, effect:{ hp:10 },
      desc:'黄连为君、半夏为臣（有毒，火候须到位）。〔免疫：瘴气 · 12 时辰〕——南中瘴疠之地，不可不备。' },
    anshui:     { defId:'anshui', name:'安神汤', icon:'🫖', cat:'药剂', maxStack:12, price:24, effect:{ hp:20 },
      desc:'茯苓为君、灵芝为佐。〔歇息恢复 +30%〕——夜不能寐者服之，一觉到天明。' },
    // ── F 轴 · 军用 / 社交 ──
    junyao:     { defId:'junyao', name:'军中金疮药', icon:'⚔️', cat:'药剂', maxStack:60, price:20, effect:{ hp:40 },
      desc:'粗料大批配就，不及上等精细，胜在管够。〔战后减员 -15%〕——三军必备的便宜货。' },
    baidu:      { defId:'baidu', name:'败毒散', icon:'💊', cat:'药剂', maxStack:12, price:60, effect:{ hp:30 },
      desc:'黄连为君、半夏为臣，茯苓甘草佐使。〔免疫：疫病〕，主时疫寒热——瘟疫一起，此药千金不易。' },
    shangdeng:  { defId:'shangdeng', name:'上等伤药', icon:'🎁', cat:'药剂', maxStack:10, price:80, effect:{ hp:80 },
      desc:'人参当归为君臣，灵芝佐之。包扎精细、药力醇厚——赠与负伤名将，是最体面的人情。' },
    // ══ v20260928h · 牙行房契（主城各一，凭契置业）══
    fangqi_luoyang:  { defId: 'fangqi_luoyang',  name: '洛阳民宅契', icon: '📜', cat: '契文', price: 120, desc: '牙行作保的洛阳宅契——凭契可入洛阳民居置业安居。' },
    fangqi_changan:  { defId: 'fangqi_changan',  name: '长安民宅契', icon: '📜', cat: '契文', price: 110, desc: '牙行作保的长安宅契——凭契可入长安民居置业安居。' },
    fangqi_yecheng:  { defId: 'fangqi_yecheng',  name: '邺城民宅契', icon: '📜', cat: '契文', price: 95,  desc: '牙行作保的邺城宅契——凭契可入邺城民居置业安居。' },
    fangqi_chengdu:  { defId: 'fangqi_chengdu',  name: '成都民宅契', icon: '📜', cat: '契文', price: 90,  desc: '牙行作保的成都宅契——凭契可入成都民居置业安居。' },
    fangqi_jianye:   { defId: 'fangqi_jianye',   name: '建业民宅契', icon: '📜', cat: '契文', price: 100, desc: '牙行作保的建业宅契——凭契可入建业民居置业安居。' },
    fangqi_xiangyang:{ defId: 'fangqi_xiangyang',name: '襄阳民宅契', icon: '📜', cat: '契文', price: 88,  desc: '牙行作保的襄阳宅契——凭契可入襄阳民居置业安居。' },
    fangqi_wuchang:  { defId: 'fangqi_wuchang',  name: '武昌民宅契', icon: '📜', cat: '契文', price: 92,  desc: '牙行作保的武昌宅契——凭契可入武昌民居置业安居。' },
    fangqi_puyang:   { defId: 'fangqi_puyang',   name: '濮阳民宅契', icon: '📜', cat: '契文', price: 80,  desc: '牙行作保的濮阳宅契——凭契可入濮阳民居置业安居。' },
    fangqi_changsha: { defId: 'fangqi_changsha',  name: '长沙民宅契', icon: '📜', cat: '契文', price: 75,  desc: '牙行作保的长沙宅契——凭契可入长沙民居置业安居。' },
    fangqi_linzi:    { defId: 'fangqi_linzi',    name: '临淄民宅契', icon: '📜', cat: '契文', price: 85,  desc: '牙行作保的临淄宅契——凭契可入临淄民居置业安居。' },
    // ══ v20260928h · 家具（布置宅院用）══
    jiaju_chuang:   { defId: 'jiaju_chuang',   name: '花梨木床', icon: '🛏️', cat: '家具', price: 40, desc: '雕花卧榻，铺着新絮。宅中安歇，恢复更足。' },
    jiaju_zhuo:     { defId: 'jiaju_zhuo',     name: '八仙桌',   icon: '🪑', cat: '家具', price: 26, desc: '四方木桌，待客议事皆宜。' },
    jiaju_yi:       { defId: 'jiaju_yi',       name: '圈椅',     icon: '🪑', cat: '家具', price: 18, desc: '曲木圈椅，靠背趁手。' },
    jiaju_gui:      { defId: 'jiaju_gui',      name: '衣箱柜',   icon: '🗄️', cat: '家具', price: 30, desc: '樟木大柜，衣物杂物尽可收纳。' },
    jiaju_deng:     { defId: 'jiaju_deng',     name: '铜油灯',   icon: '🕯️', cat: '家具', price: 14, desc: '铜盏青油，夜读添亮。' },
    jiaju_pingfeng: { defId: 'jiaju_pingfeng', name: '山水屏风', icon: '🖼️', cat: '家具', price: 48, desc: '绢面山水屏，堂前挡风，亦掩内室。' },
    jiaju_huaping:  { defId: 'jiaju_huaping',  name: '青瓷花瓶', icon: '🏺', cat: '家具', price: 22, desc: '青釉瓷瓶，可插新折花枝。' },
    jiaju_zihua:    { defId: 'jiaju_zihua',    name: '名家字画', icon: '🖌️', cat: '家具', price: 55, desc: '裱好的一轴字画，悬于堂上生色。' },
    // ══ v20260928h · 马行（坐骑/鞍具/草料）══
    ma:     { defId: 'ma',     name: '骏马', icon: '🐴', cat: '坐骑', price: 160, desc: '膘肥体壮的良驹，日行数百里。' },
    lu:     { defId: 'lu',     name: '毛驴', icon: '🫏', cat: '坐骑', price: 60,  desc: '温顺毛驴，驮货代步皆宜。' },
    maan:   { defId: 'maan',   name: '马鞍', icon: '🧎', cat: '鞍具', price: 30,  desc: '皮木马鞍，骑乘平稳不磨。' },
    macao:  { defId: 'macao',  name: '马草', icon: '🌾', cat: '草料', price: 8,   desc: '干草料，喂马的日常口粮。' }
  };

  function ri(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // tier 1-4：决定品质权重与数值缩放（敌人强度越高，掉装越好）
  function rollEquip(tier) {
    tier = tier || 1;
    var type = pick(TYPE_KEYS);
    var td = TYPES[type];
    var qidx = Math.round((tier - 1) + (Math.random() * 2.4 - 1.0));
    if (qidx < 0) qidx = 0;
    if (qidx >= QUALITY.length) qidx = QUALITY.length - 1;
    var q = QUALITY[qidx];
    var scale = 1 + (tier - 1) * 0.32;
    function val(base) { return Math.max(1, Math.round(ri(base[0], base[1]) * scale * q.mult)); }
    var atk = 0, def = 0, hp = 0, mp = 0, spd = 0;
    if (type === 'weapon')      { atk = val(td.base); }
    else if (type === 'cloth')  { def = val(td.base); hp = val([12, 32]); }
    else if (type === 'hat')    { def = val(td.base); }
    else if (type === 'shoe')   { spd = val(td.base); }
    else if (type === 'belt')   { if (Math.random() < 0.5) def = val(td.base); else spd = val(td.base); }
    else if (type === 'trinket') {
      var r = Math.random();
      if (r < 0.4)      { atk = val(td.base); }
      else if (r < 0.7) { def = val(td.base); }
      else              { hp = val([12, 28]); mp = val([6, 18]); }
    }
    var maxDur = ri(14, 26);
    return {
      id: 'eq_' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36),
      type: type, typeName: td.label,
      name: pick(td.names),
      quality: q.key, qualityName: q.name, color: q.color,
      atk: atk, def: def, hp: hp, mp: mp, spd: spd,
      dur: maxDur, maxDur: maxDur
    };
  }

  // 属性摘要文本（兼容掉落装备对象与背包装备物品）
  function statText(eq) {
    if (!eq) return '';
    var p = [];
    if (eq.atk) p.push('攻+' + eq.atk);
    if (eq.def) p.push('防+' + eq.def);
    if (eq.hp)  p.push('血+' + eq.hp);
    if (eq.mp)  p.push('内+' + eq.mp);
    if (eq.spd) p.push('速+' + eq.spd);
    return p.join(' ');
  }

  // 由静态定义生成背包物品（期初 / 任务 / 商店用）
  function makeItem(defId, count) {
    var d = DEFS[defId]; if (!d) return null;
    var it = { defId: d.defId, name: d.name, icon: d.icon, cat: d.cat, desc: d.desc, count: count || 1 };
    if (d.effect) it.effect = JSON.parse(JSON.stringify(d.effect));
    if (d.maxDur) { it.maxDur = d.maxDur; it.dur = d.maxDur; }
    // v20260928f：任务专用道具字段（洛阳铲等）——不可交易 / 挖掘效率 / 取土样
    if (d.quest) it.quest = true;
    if (d.taskOnly) it.taskOnly = true;
    if (d.noSell) it.noSell = true;
    if (d.digPower) it.digPower = d.digPower;
    if (d.soilSample) it.soilSample = true;
    if (d.placeable) it.placeable = true;   // 可放置/支起类（如帐篷）
    if (d.place) it.place = d.place;        // 放置模板：放置后生成的场景对象定义
    if (d.blueprint) it.blueprint = d.blueprint; // 图纸类：依图在房中营造建筑
    if (d.waterCap) it.waterCap = d.waterCap;    // 水袋等容器：可盛量（v20260920e 补——此前 makeItem 丢了此字段）
    // v20260928e：工具与装备同走装备链路（占「工具」槽，不占行囊格）
    if (d.cat === '装备' || d.cat === '工具') {
      it.slot = d.slot; it.quality = (d.cat === '工具') ? null : (d.quality || 'white');
      it.atk = 0; it.def = 0; it.hp = 0; it.mp = 0; it.spd = 0;
      if (d.stats) { for (var k in d.stats) { if (k in it) it[k] = d.stats[k]; } }
      if (d.packSpace) it.packSpace = d.packSpace;   // 背包装备槽：扩充行囊容量
    }
    return it;
  }

  // 由掉落/生成的装备对象转成背包物品
  function equipToPackItem(eq) {
    var sl = SLOTS[eq.type] || { label: eq.typeName || '装备', icon: '🛡️' };
    return {
      defId: eq.id, name: eq.name, icon: sl.icon, cat: '装备', slot: eq.type,
      atk: eq.atk || 0, def: eq.def || 0, hp: eq.hp || 0, mp: eq.mp || 0, spd: eq.spd || 0,
      quality: eq.quality, qualityName: eq.qualityName, qualityColor: eq.color,
      dur: eq.dur, maxDur: eq.maxDur,
      desc: (eq.qualityName || '') + '·' + sl.label + '：' + (statText(eq) || '')
    };
  }

  var ITEMS = {
    SLOTS: SLOTS, SLOT_KEYS: SLOT_KEYS,
    QUALITY: QUALITY, QMAP: QMAP, TYPES: TYPES, DEFS: DEFS,
    rollEquip: rollEquip, statText: statText, makeItem: makeItem, equipToPackItem: equipToPackItem
  };

  // 将静态物品定义直接挂到 LF.ITEMS 上，使 LF.ITEMS['mutou'] 等直接可用（同时保留 LF.ITEMS.DEFS）
  for (var _dk in DEFS) { if (!( _dk in ITEMS)) ITEMS[_dk] = DEFS[_dk]; }

  // —— 镐头等级表 LF.PICKS（v20260915i）——
  // 镐头不进行囊，是玩家自身的等级：露天矿脉 / 矿洞全靠它衡量能凿什么、凿几下。
  //   hits: 开采一类矿点需要的下数（-1 = 碰不得）；数字为按 lv 0..5 的敲击数
  //   caveMax: 可下矿洞最深层数（进入每层时检查）
  var PICKS = [
    { id:'cushi_gao',    name:'粗石镐', icon:'🪨', lv:0, caveMax:2,
      hits:{ gap:1, rock:3, big:-1, copper:-1, iron:-1, jade:-1, xuan:-1 },
      desc:'碎石绑木柄的粗使家什，只能凿小石堆、矿洞浅层。监工随手丢来的。' },
    { id:'jing_shi_gao', name:'精致石镐', icon:'⛏', lv:1, caveMax:3,
      hits:{ gap:1, rock:2, big:-1, copper:2, iron:-1, jade:-1, xuan:-1 },
      desc:'选石开棱、柄切手的石镐，磋小石两下一碎；已能开铜脉。' },
    { id:'qingtong_gao', name:'青铜镐', icon:'🥉', lv:2, caveMax:4,
      hits:{ gap:1, rock:2, big:3, copper:2, iron:-1, jade:-1, xuan:-1 },
      desc:'青铜镐头，能凿大石堆。矿洞可下四层。' },
    { id:'cu_tie_gao',   name:'粗铁镐', icon:'⛏️', lv:3, caveMax:6,
      hits:{ gap:1, rock:2, big:2, copper:2, iron:3, jade:-1, xuan:-1 },
      desc:'粗铁镐头，铁石开采入门工具。矿洞可下六层。' },
    { id:'jing_tie_gao', name:'精致铁镐', icon:'⚒️', lv:4, caveMax:8,
      hits:{ gap:1, rock:1, big:2, copper:2, iron:2, jade:2, xuan:-1 },
      desc:'细锻铁镐，尖锐却有弹性：青玉脉也能开。矿洞可下八层。' },
    { id:'bailian_gao',  name:'百炼钢镐', icon:'⚔️', lv:5, caveMax:9,
      hits:{ gap:1, rock:1, big:1, copper:1, iron:1, jade:1, xuan:2 },
      desc:'按百炼钢法锻就的神器，天下几把。玄铁矿脉也凿得，矿洞全层可下。' }
  ];
  // 每类矿点能凿的镐门槛（最低 lv）
  var PICK_GATE = { gap:0, rock:0, big:2, copper:1, iron:3, jade:4, xuan:5 };
  // 矿点名称 / 收获
  var MINE_SPOT = {
    gap:   { name:'岩缝', icon:'△', out:'mucai',  outN:1, w:1,
             desc:'岩壁封境缝隙，里头塞着柴木。' },
    rock:  { name:'石堆', icon:'◆', out:'shitiao', outN:1, w:5,
             desc:'块石堆积。' },
    big:   { name:'大石堆', icon:'◇', out:'shitiao', outN:2, w:2, crit:'tiekuangshi', critPct:0.1,
             desc:'半人高的大石堆，里头好东西多。' },
    copper:{ name:'古铜脉', icon:'◆', out:'tongkuang', outN:1, w:1,
             desc:'矿壁渗出的青绿铜粒。' },
    iron:  { name:'铁砂堆', icon:'◆', out:'tiekuangshi', outN:1, w:1,
             desc:'磁石糊的铁砂粒子，散着铁腥味。' },
    jade:  { name:'青玉脉', icon:'◈', out:'jade', outN:1, w:1, limit:2,
             desc:'声光外溢的玉脉，一闪即逝——只容几镐。' },
    xuan:  { name:'玄铁矿脉', icon:'◈', out:'xuatie', outN:1, w:1,
             desc:'墨色铁母，沉。百炼钢镐才斫得动。' }
  };

  global.LF = global.LF || {};
  // v20260928e：镐等级 → 物品 id（镐已物品化，锻造 / 任务发镐走此表）
  var GAO_BY_LV = ['cushi_gao','jing_shi_gao','qingtong_gao','cu_tie_gao','jing_tie_gao','bailian_gao'];
  global.LF.PICKS = PICKS;
  global.LF.GAO_BY_LV = GAO_BY_LV;
  // —— 工具阶位：采集效率与磨损（v20260928f）——
  //   磨损概率随阶位递减：高阶工具更耐用（L0 每用必损，L5 三回才损一回）
  var TOOL_WEAR = [1.00, 0.90, 0.80, 0.65, 0.50, 0.35];
  //   伐木出材：基础根数 + 多得一根的概率
  var AXE_YIELD = [1, 1, 2, 2, 3, 3];
  var AXE_BONUS = [0, 0.20, 0, 0.25, 0, 0.40];
  //   手持工具：优先「工具」装备槽；槽内无同系，则取行囊中该系最高阶（兼容旧习惯）
  function heldTool(st, key){
    var eq = (st && st.equipment) ? st.equipment.tool : null;
    if (eq && eq.defId) {
      var d = DEFS[eq.defId];
      if (d && d[key] != null) return { item: eq, def: d, lv: d[key], equipped: true };
    }
    var best = null, pk = (st && st.pack) || [];
    for (var i = 0; i < pk.length; i++) {
      var p2 = pk[i]; if (!p2 || !p2.defId) continue;
      var d2 = DEFS[p2.defId];
      if (d2 && d2[key] != null && (!best || d2[key] > best.lv)) best = { item: p2, def: d2, lv: d2[key], equipped: false };
    }
    return best;
  }
  // 磨损：按阶位概率扣 1 点耐久（就地改写物品实例），返回本次是否磨损
  // v20260928j：天候叠加——雨/雪等劣境提升磨损概率（冻土硬、湿木滑、矿壁濡、草秸韧）
  function toolKeyOf(d){ if(!d) return null; var ks=['pickLv','axeLv','hoeLv','sickleLv','rodLv','sawLv'];
    for(var i=0;i<ks.length;i++) if(d[ks[i]]!=null) return ks[i]; return null; }
  function wearSitMul(st, held){
    var W = st && st.weather, key = toolKeyOf(held && held.def); if(W==null || !key) return 1;
    var mul = 1;
    if(W===3 || W===4){ if(key==='axeLv') mul=1.4; else if(key==='hoeLv') mul=1.3;
      else if(key==='sickleLv') mul=1.3; else if(key==='pickLv') mul=1.2; }
    else if(W===5){ if(key==='hoeLv') mul=1.6; else if(key==='axeLv') mul=1.3;
      else if(key==='sickleLv') mul=1.3; else mul=1.2; }
    else if(W===7){ if(key==='hoeLv') mul=1.2; }
    return mul;
  }
  // 给农事日志用的「劣境提示」：仅当倍率>1 时返回一句，否则 null
  function wearSitNote(st, held){
    var m = wearSitMul(st, held);
    if(m>1) return '（天候劣境，'+(held&&held.def?held.def.name:'工具')+'磨损加剧）';
    return null;
  }
  function wearTool(st, held){
    if (!held || !held.item) return false;
    var lv = held.lv || 0;
    var pr = (TOOL_WEAR[lv] != null) ? TOOL_WEAR[lv] : 1;
    pr = Math.min(1, pr * wearSitMul(st, held));
    if (Math.random() >= pr) return false;
    var it = held.item;
    if (it.maxDur == null) return false;
    it.dur = (it.dur == null ? it.maxDur : it.dur) - 1;
    return true;
  }
  global.LF.TOOL_WEAR = TOOL_WEAR;
  global.LF.AXE_YIELD = AXE_YIELD;
  global.LF.AXE_BONUS = AXE_BONUS;
  global.LF.heldTool = heldTool;
  global.LF.wearTool = wearTool;
  global.LF.wearSitMul = wearSitMul;
  global.LF.wearSitNote = wearSitNote;
  ITEMS.heldTool = heldTool; ITEMS.wearTool = wearTool;
  // —— 工具用途说明（v20260928g）：让玩家点开工具即看见阶位差异 ——
  var TOOL_USE = {
    pickLv:   function(lv){ return '开矿：镐级 '+lv+'，对应矿脉逐级解锁（百炼钢镐可入玄铁矿）。'; },
    axeLv:    function(lv){ var n=(AXE_YIELD&&AXE_YIELD[lv]!=null)?AXE_YIELD[lv]:1;
                return '伐木：每斧得 '+n+' 根木'+(AXE_BONUS&&AXE_BONUS[lv]?('，约 '+Math.round(AXE_BONUS[lv]*100)+'% 多得一根'):'')+'；磨损率 '+Math.round((TOOL_WEAR&&TOOL_WEAR[lv]!=null?TOOL_WEAR[lv]:1)*100)+'%。'; },
    hoeLv:    function(lv){ return '翻地：一锄翻 '+(1+Math.floor(lv/2))+' 垄（多翻的结转下畦）。'; },
    sickleLv: function(lv){ return '收割：镰级 '+lv+'，每级多收一捧、脱粒更净、留种更易（徒手采收费力且脱粒不净）。'; },
    rodLv:    function(lv){ return '垂钓：渔获量随级升、上品鱼概率更高；水域耐钓 '+(4+lv)+' 回。'; },
    sawLv:    function(lv){ return '解板：每块料出木材 '+(1+Math.floor(lv/2))+'。'; }
  };
  function toolUseText(it){
    if(!it || it.cat!=='工具') return null;
    var d = (ITEMS[it.defId]||DEFS[it.defId]); if(!d) return null;
    for(var _k in TOOL_USE){ if(d[_k]!=null) return TOOL_USE[_k](d[_k]); }
    return null;
  }
  // —— 修理费用（v20260928g）：耐久缺口 → 铁料 + 手工银两，形成「采铁→炼铁→随身修」闭环 ——
  //   每 3 点缺口耗 1 铁料（tiekuai）；每点缺口 2 两手工费。
  function repairCost(it){
    if(!it || it.maxDur==null) return null;
    var dur = (it.dur==null ? it.maxDur : it.dur);
    var gap = it.maxDur - dur;
    if(gap<=0) return null;
    return { gap:gap, mat:'tiekuai', matN:Math.max(1, Math.ceil(gap/3)), gold:gap*2 };
  }
  global.LF.TOOL_USE = TOOL_USE;
  ITEMS.toolUseText = toolUseText;
  global.LF.repairCost = repairCost;
  global.LF.PICK_GATE = PICK_GATE;
  global.LF.MINE_SPOT = MINE_SPOT;
  global.LF.SLOTS = SLOTS;
  global.LF.ITEMS = ITEMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ITEMS;
})(typeof window !== 'undefined' ? window : globalThis);

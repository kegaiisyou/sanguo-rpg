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
    jinchuang:   { defId: 'jinchuang',   name: '金疮药', icon: '🧪', cat: '药剂', effect: { hp: 50 },                 desc: '外敷金创，止血生肌，可疗外伤五十。' },
    roubao:      { defId: 'roubao',      name: '肉包子', icon: '🥟', cat: '食饵', effect: { food: 20, drink: 5 },     desc: '热乎包子一只，啃下可充饥解渴。' },
    yaofen:      { defId: 'yaofen',      name: '草药粉', icon: '🌿', cat: '药剂', effect: { hp: 25 },                 desc: '捣碎的草药细粉，作敷料可缓伤痛。' },
    tangyao:     { defId: 'tangyao',     name: '汤药',   icon: '🍵', cat: '药剂', effect: { hp: 130 },                desc: '慢火熬出的汤药，温养气血，重伤可复。' },
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
    // —— 素材：野外采集所得 ——
    caoyao:         { defId: 'caoyao',         name: '草药',     icon: '🌿', cat: '素材', desc: '山野可入药的茎叶，多凑几味可合成疗伤之物。' },
    shengrou:       { defId: 'shengrou',       name: '生肉',     icon: '🥩', cat: '素材', desc: '猎获或劫掠所得的生肉，于篝火炊制可成一包肉脯干粮。' },
    xiang:          { defId: 'xiang',          name: '线香',     icon: '🕯️', cat: '素材', desc: '香烛店晨起请来的线香，心诚则灵，可敬神祈愿、趋吉避凶。' },
    // —— 建造/制造系统测试素材 ——
    xiaoshuzhi:    { defId: 'xiaoshuzhi', name: '小树枝', icon: '🍂', cat: '素材', desc: '徒手折下的细弱枝条，需于木工台加工方能成材。' },
    mutou:         { defId: 'mutou',   name: '木头',   icon: '🪵', cat: '素材', desc: '粗伐的树干枝料，可于木工台加工成木材，亦能直接搭架。' },
    mucai:         { defId: 'mucai',   name: '木材',   icon: '🟫', cat: '素材', desc: '经木工台刨削而成的规整木料，修筑与打造的基材。' },
    futou:         { defId: 'futou',   name: '斧头',   icon: '🪓', cat: '素材', tool:true, maxDur:5, desc: '伐木器具。持之伐木可得粗实木头；每伐一次耗耐久 1，耐久尽则损毁。亦可售与行商。' },
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
    // —— 营造系统：建材与图纸 ——
    shitiao:        { defId: 'shitiao',       name: '石料', icon: '🪨', cat: '素材', desc: '采自岩壁的石块，夯基砌灶的硬底料。' },
    zhuan:          { defId: 'zhuan',         name: '砖头', icon: '🧱', cat: '素材', desc: '窑烧而成的土砖，垒砌围墙与炉体的规整块材。' },
    tiekuai:        { defId: 'tiekuai',       name: '铁料', icon: '⛓️', cat: '素材', desc: '冶炼工坊熔石取铁所得，打造兵刃器具的关键材料。' },
    tiekuangshi:    { defId: 'tiekuangshi',   name: '铁矿石', icon: '⛏️', cat: '素材', desc: '崖间采得的铁矿石。投入冶炼工坊，添柴鼓风烧炼，可化成铁料。' },
    tuzhi_yeolian:  { defId: 'tuzhi_yeolian', name: '冶炼工坊图', icon: '📜', cat: '图纸', blueprint: 'bp_yeolian', price: 30,
      desc: '营造冶炼工坊的图样。于背包「依图营造」置于房中，备料后可分阶筑成工坊，炉成可熔石取铁。' },
    tuzhi_woodcamp: { defId: 'tuzhi_woodcamp', name: '伐木场图', icon: '📜', cat: '图纸', blueprint: 'bp_woodcamp', price: 24,
      desc: '营造伐木场的图样。于背包「依图营造」置于房中，备料后可分阶筑成伐木场，场成可伐木取材。' },
    tuzhi_yaolu:    { defId: 'tuzhi_yaolu', name: '砖窑图', icon: '📜', cat: '图纸', blueprint: 'bp_yaolu', price: 24,
      desc: '营造砖窑的图样。于背包「依图营造」置于房中，备料后可分阶筑成砖窑，窑成可烧土为砖。' },
    // —— 城市营造图样（第4步图纸系统：城中空地「营造」开工，开工即耗图）——
    tuzhi_house:    { defId: 'tuzhi_house',    name: '民宅图', icon: '📜', cat: '图纸', blueprint: 'bp_house', price: 18,
      desc: '营造民宅的图样。于城中空地「营造」开工，立柱搭梁、苫草为顶，落成后百姓可居。' },
    tuzhi_market:   { defId: 'tuzhi_market',   name: '市集图', icon: '📜', cat: '图纸', blueprint: 'bp_market', price: 30,
      desc: '营造市集的图样。于城中空地「营造」开工，平整地基、起造铺面，落成后商旅云集可收市租。' },
    tuzhi_farm:     { defId: 'tuzhi_farm',     name: '农庄图', icon: '📜', cat: '图纸', blueprint: 'bp_farm', price: 20,
      desc: '营造农庄的图样。于城中空地「营造」开工，治田开阡、起造仓廪，落成后农人耕作粮草渐丰。' },
    tuzhi_barracks: { defId: 'tuzhi_barracks', name: '军营图', icon: '📜', cat: '图纸', blueprint: 'bp_barracks', price: 36,
      desc: '营造军营的图样。于城中空地「营造」开工，立栅筑垒、列帐为营，落成后士卒驻扎可募兵操练。' },
    // —— 冶炼工坊产出（铁料加工链）——
    tiejian:  { defId: 'tiejian',  name: '铁剑', icon: '⚔️', cat: '装备', slot: 'weapon', stats: { atk: 8 }, quality: 'green',
      desc: '冶炼工坊打制的铁剑，刃口冷冽，远胜木棒。' },
    tiefu:    { defId: 'tiefu',    name: '铁斧', icon: '🪓', cat: '素材', tool: true, maxDur: 15, price: 60,
      desc: '铁铸斧头，伐木采石更为趁手（耐久 15）。' },
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
      desc: '相中的栗色川马，蹄声如鼓，正堪长途，亦可售与马行。' }
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
    if (d.placeable) it.placeable = true;   // 可放置/支起类（如帐篷）
    if (d.place) it.place = d.place;        // 放置模板：放置后生成的场景对象定义
    if (d.blueprint) it.blueprint = d.blueprint; // 图纸类：依图在房中营造建筑
    if (d.cat === '装备') {
      it.slot = d.slot; it.quality = d.quality || 'white';
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

  global.LF = global.LF || {};
  global.LF.ITEMS = ITEMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ITEMS;
})(typeof window !== 'undefined' ? window : globalThis);

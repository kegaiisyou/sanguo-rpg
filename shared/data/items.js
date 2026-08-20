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
      desc: '轻便的草编卧席。于背包「放置」后铺地，可躺下小睡，回复气血内力。' }
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

(function (global) {
  'use strict';

  // ========== 装备系统数据层（P1 完整：武器/防具/饰品/坐骑 + 品质 + 耐久） ==========
  // 装备由战斗掉落生成；装备后并入角色有效属性（攻/防/血/内/速）。

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

  // 四槽位类型定义
  var TYPES = {
    weapon:  { label: '兵刃', names: ['铁剑', '钢刀', '长枪', '梨花枪', '雁翎刀', '丈八蛇矛', '熟铜锏', '流星锤'], base: [4, 12], bias: 'atk' },
    armor:   { label: '护甲', names: ['皮甲', '锁子甲', '铁鳞甲', '明光铠', '山文甲'],               base: [3, 10], bias: 'def' },
    trinket: { label: '饰品', names: ['玉佩', '青玉戒', '狼牙坠', '铜符', '夜光璧'],                 base: [2, 6],  bias: 'mix' },
    mount:   { label: '坐骑', names: ['黄骠马', '乌骓马', '赤兔驹', '照夜白'],                       base: [3, 8],  bias: 'spd' }
  };
  var TYPE_KEYS = Object.keys(TYPES);

  function ri(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // tier 1-4：决定品质权重与数值缩放（敌人强度越高，掉装越好）
  function rollEquip(tier) {
    tier = tier || 1;
    var type = pick(TYPE_KEYS);
    var td = TYPES[type];
    // 品质随 tier 上移（tier1 多白绿，tier4 多出紫橙）
    var qidx = Math.round((tier - 1) + (Math.random() * 2.4 - 1.0));
    if (qidx < 0) qidx = 0;
    if (qidx >= QUALITY.length) qidx = QUALITY.length - 1;
    var q = QUALITY[qidx];
    var scale = 1 + (tier - 1) * 0.32;
    function val(base) { return Math.max(1, Math.round(ri(base[0], base[1]) * scale * q.mult)); }
    var atk = 0, def = 0, hp = 0, mp = 0, spd = 0;
    if (type === 'weapon') { atk = val(td.base); }
    else if (type === 'armor') { def = val(td.base); hp = val([12, 32]); }
    else if (type === 'trinket') {
      var r = Math.random();
      if (r < 0.4) { atk = val(td.base); }
      else if (r < 0.7) { def = val(td.base); }
      else { hp = val([12, 28]); mp = val([6, 18]); }
    } else if (type === 'mount') { spd = val(td.base); }
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

  // 属性摘要文本
  function statText(eq) {
    var p = [];
    if (eq.atk) p.push('攻+' + eq.atk);
    if (eq.def) p.push('防+' + eq.def);
    if (eq.hp)  p.push('血+' + eq.hp);
    if (eq.mp)  p.push('内+' + eq.mp);
    if (eq.spd) p.push('速+' + eq.spd);
    return p.join(' ');
  }

  var ITEMS = {
    QUALITY: QUALITY, QMAP: QMAP, TYPES: TYPES,
    rollEquip: rollEquip, statText: statText
  };

  global.LF = global.LF || {};
  global.LF.ITEMS = ITEMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ITEMS;
})(typeof window !== 'undefined' ? window : globalThis);

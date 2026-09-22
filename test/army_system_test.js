// 军队 / 攻城系统单测（v20260922a）：官职兵力上限 / 士气分档 / 募兵（兵源·银两·上限）/
// 守军派生（城市基防·三段守波·守将集成）/ 三段攻城编排 / 战前编成面板
// 范式：镜像 officer_system_test.js —— 加载数据层 → 工厂注入伪 ctx → 调用暴露函数断言。
'use strict';
var path = require('path'), ROOT = path.join(__dirname, '..');
function load(p) { require(path.join(ROOT, p)); }
load('shared/config/constants.js');   // LF.CONSTANTS / FACTIONS / CITY_OWNER
load('shared/data/troops.js');        // LF.TROOPS / ARMY_RANKS / TROOP_RANKS / ARMY_ORDERS / moraleBand / armyCapOf
load('shared/data/cities.js');        // LF.CITIES（pop/wall）
load('shared/data/personas.js');      // LF.PERSONA
load('shared/data/officers.js');      // LF.OFFICERS（史实武将）
var LF = globalThis.LF;

var fail = 0, pass = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } }
var noop = function () {};

// ── 伪 state（随测试重置）──
var state;
function reset(o) {
  state = Object.assign({ title: '州牧', gold: 100000, room: 'luoyang', flags: {}, officers: [] }, o || {});
  state.army = state.army || {};
}
reset();

// 洛阳归属 → 董卓，使守将派生能命中吕布
var owned = { luoyang: 'dongzhuo' };
function cityOwnerOf(c) { return owned[c] || 'none'; }

// ── 武将实例（复用真实工厂，验证守将集成）──
var Officers = require(path.join(ROOT, 'shared/core/officers.js'))({
  getState: function () { return state; }, LF: LF,
  log: noop, toast: noop, save: noop,
  escapeHtml: function (s) { return String(s == null ? '' : s); },
  cityOwnerOf: cityOwnerOf, playerFaction: function () { return 'player'; }
});

// ── 军队实例 ──
var G = { ENEMIES: {} };
var Army = require(path.join(ROOT, 'shared/core/army.js'))({
  getState: function () { return state; },
  getCurrentModalKind: function () { return 'x'; },   // 非 'army' → 不触发 openModal
  LF: LF, G: G,
  log: noop, toast: noop, save: noop, renderStatus: noop, renderRoom: noop,
  openModal: noop, closeModal: noop,
  itemIconHTML: function () { return ''; }, escapeHtml: function (s) { return String(s == null ? '' : s); },
  packAdd: noop, packConsume: noop, packFind: noop, packList: noop, afterPackChange: noop,
  cityDevOf: function () { return 0; }, isCityGrid: function () { return false; },
  roleAtkMul: function () { return 1; }, roleDef: function () { return 1; },
  exert: noop, advanceTime: noop, commandBonus: function () { return 1; }
});

// ── 战术战斗实例 ──
var War = require(path.join(ROOT, 'shared/core/war.js'))({
  getState: function () { return state; },
  LF: LF, G: G,
  log: noop, toast: noop, save: noop, renderStatus: noop, renderRoom: noop,
  openModal: noop, closeModal: noop,
  escapeHtml: function (s) { return String(s == null ? '' : s); },
  exert: noop, advanceTime: noop,
  startCombat: noop, showCombatSettlement: noop, conquerCity: noop,
  playerFaction: function () { return 'player'; },
  cityDevOf: function () { return 0; }, cityOwnerOf: cityOwnerOf,
  isCityGrid: function () { return false; }, roleAtkMul: function () { return 1; },
  Army: Army,
  getPendingArmyBattle: function () { return null; }, setPendingArmyBattle: noop,
  Officers: Officers
});

// ── 战前编成面板依赖 DOM ──
var _card = { innerHTML: '' };
global.document = { getElementById: function () { return _card; } };

// ════════════════════════════════════════════════
// 1) 官职 → 全军兵力上限
// ════════════════════════════════════════════════
ok(LF.armyCapOf('游侠') === 50, '游侠兵力上限=50');
ok(LF.armyCapOf('县令') === 150, '县令兵力上限=150');
ok(LF.armyCapOf('太守') === 400, '太守兵力上限=400');
ok(LF.armyCapOf('州牧') === 800, '州牧兵力上限=800');
ok(LF.armyCapOf('君主') === 1500, '君主兵力上限=1500');
ok(LF.armyCapOf('未知官职') === 50, '未知官职回落到游侠(50)');

// ════════════════════════════════════════════════
// 2) 士气分档
// ════════════════════════════════════════════════
ok(Math.abs(LF.moraleBand(100).atkMul - 1.10) < 1e-9, '士气100→如虹 +10%');
ok(Math.abs(LF.moraleBand(70).atkMul - 1.00) < 1e-9, '士气70→可用 +0%');
ok(Math.abs(LF.moraleBand(50).atkMul - 0.90) < 1e-9, '士气50→浮动 -10%');
ok(Math.abs(LF.moraleBand(30).atkMul - 0.75) < 1e-9, '士气30→低落 -25%');
ok(Math.abs(LF.moraleBand(10).atkMul - 0.55) < 1e-9, '士气10→涣散 -45%');

// ════════════════════════════════════════════════
// 3) 募兵：兵源 / 银两 / 上限
// ════════════════════════════════════════════════
reset();   // 州牧，gold 100000，army 空
var r1 = Army.armyRecruit('luoyang', 'changqiang', 100);
ok(r1 === true, '募长枪兵×100 成功');
ok(state.army.troops.length === 1 && state.army.troops[0].count === 100, '部曲计入 100 人');
ok(state.army.troops[0].rank === 'front', '长枪兵默认列前军（步→前军）');
ok(state.army.rallyPoint === 'luoyang' && state.army.active === true, '成军后置集结点/激活');
ok(state.army.recruited['luoyang'] === 100, '记洛阳已募 100（兵源上限校验用）');
ok(state.gold === 100000 - (2 + 1 * 2) * 100, '耗银 = (2+兵耗×2)×人数 = 400 两，实=' + (100000 - state.gold));

// 兵源耗尽（洛阳 pop80 → 兵源 160；再募 100 → 仅余 60）
var r2 = Army.armyRecruit('luoyang', 'changqiang', 100);
ok(r2 === true && state.army.troops[0].count === 160, '兵源剩 60，自动收缩募满 160');
var r3 = Army.armyRecruit('luoyang', 'changqiang', 100);
ok(r3 === false && state.army.troops[0].count === 160, '兵源已尽 → 拒募，人数不变');

// 银两不足 → 拒募（换未耗尽兵源的城）
reset();
state.gold = 0;
ok(Army.armyRecruit('xuchang', 'changqiang', 10) === false, '府库为空 → 募兵被拒');

// 兵力上限 → 拒募（游侠 cap=50）
reset({ title: '游侠' });
ok(Army.armyRecruit('xuchang', 'changqiang', 50) === true, '游侠募满 50 人成功');
ok(Army.armyRecruit('xuchang', 'changqiang', 1) === false, '已达兵力上限 → 拒募');

// ════════════════════════════════════════════════
// 4) 攻城编排：三段 / 城市基防 / 守军派生
// ════════════════════════════════════════════════
ok(War.SEGS.length === 3, '攻城分三段（城门/巷道/府衙），实=' + War.SEGS.length);
ok(War.SEGS[0].key === 'gate' && War.SEGS[1].key === 'street' && War.SEGS[2].key === 'hall',
  '三段顺序为 gate→street→hall');

// 洛阳 wall85 pop80 dev0 → 基防 = round(85*1.2 + 80*0.6) = 150
var base = War.cityBase('luoyang');
ok(base === 150, '洛阳城防基数=150（wall85·pop80），实=' + base);
ok(base > 30, '城防基数不低于下限 30');

function waveOk(units, seg) {
  ok(Array.isArray(units) && units.length >= 1, '第' + seg + '段守波非空（' + units.length + ' 支）');
  units.forEach(function (u, i) {
    ok(u && u.hp > 0 && u.atk > 0 && u.def >= 0 && u.count > 0 && u.maxHp > 0,
      '第' + seg + '段守军[' + i + ']="' + (u && u.name) + '" 数值有效（hp=' + (u && u.hp) + ' atk=' + (u && u.atk) + '）');
  });
}
var w0 = War.defenderWave('luoyang', 0);
waveOk(w0, 0);
ok(w0[0].name === '城门守卒' && w0[1].name === '城头弓弩', '城门段=城门守卒+城头弓弩');

var w1 = War.defenderWave('luoyang', 1);
waveOk(w1, 1);
ok(w1[0].name === '巷战锐卒' && w1[1].name === '屋脊弓手', '巷道段=巷战锐卒+屋脊弓手');

var w2 = War.defenderWave('luoyang', 2);
waveOk(w2, 2);
ok(w2[0].name === '府衙亲兵', '府衙段首支=府衙亲兵');
ok(w2[1].name.indexOf('守将') >= 0, '府衙段含守将单位（集成 garrisonCommander），实="' + w2[1].name + '"');

// 无武将模块时守军派生亦不崩（默认守将名 = 城+「守将」）
var War2 = require(path.join(ROOT, 'shared/core/war.js'))({
  getState: function () { return state; }, LF: LF, G: G,
  log: noop, toast: noop, save: noop, renderStatus: noop, renderRoom: noop,
  openModal: noop, closeModal: noop, escapeHtml: function (s) { return String(s == null ? '' : s); },
  exert: noop, advanceTime: noop, startCombat: noop, showCombatSettlement: noop, conquerCity: noop,
  playerFaction: function () { return 'player'; }, cityDevOf: function () { return 0; },
  cityOwnerOf: cityOwnerOf, isCityGrid: function () { return false; }, roleAtkMul: function () { return 1; },
  Army: Army, getPendingArmyBattle: function () { return null; }, setPendingArmyBattle: noop, Officers: null
});
var w2b = War2.defenderWave('luoyang', 2);
ok(w2b.length === 2 && w2b[1].name.indexOf('守将') >= 0, '无 Officers 时守军派生兜底正常');

// ════════════════════════════════════════════════
// 5) 战前编成面板渲染（含三段说明 / 守军预估 / 举兵按钮）
// ════════════════════════════════════════════════
reset();
Army.armyRecruit('luoyang', 'changqiang', 100);   // 生成可编部曲
_card.innerHTML = '';
War.openSiegePrep('luoyang');
var html = _card.innerHTML;
ok(html.indexOf('战前编成') >= 0, '战前编成面板标题存在');
ok(html.indexOf('守军约') >= 0, '面板含守军数量预估');
ok(html.indexOf('举 兵') >= 0, '面板含「举兵」开战按钮');
ok(html.indexOf('长枪兵') >= 0, '面板列出部曲（长枪兵）');
ok(html.indexOf('破城门、清巷道、下府衙') >= 0, '面板说明三段攻城流程');

// ════════════════════════════════════════════════
// 6) 兵员→营级数值幂律缩放（多兵更厚）
// ════════════════════════════════════════════════
var fS = War.aggF(100).hpF, fL = War.aggF(1000).hpF;
ok(fL > fS, '聚合防御/气血随兵员幂律增长（1000 兵 > 100 兵）');
var u = War.mkUnit('测试营', 100, { hp: 20, atk: 5, def: 5, spd: 10 });
ok(u.hp > 20 && u.atk >= 1 && u.count === 100, 'mkUnit 按兵员放大营级气血，hp=' + u.hp);

console.log('\n军队/攻城系统单测：通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);

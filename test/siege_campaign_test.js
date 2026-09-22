'use strict';
// 战役级（攻城三段）端到端自测（v20260922c）
// 驱动 startSiegeBattle 走完 城门→巷道→府衙 三段，断言城破易帜（conquerCity 以 player 调用）。
// 战斗核心以「强制获胜」桩替代，仅校验攻城状态机编排；不验证战斗数值平衡（见 army_system_test）。
var path = require('path'), ROOT = path.join(__dirname, '..');
function load(p) { require(path.join(ROOT, p)); }
load('shared/config/constants.js');
load('shared/data/troops.js');
load('shared/data/cities.js');
load('shared/data/personas.js');
load('shared/data/officers.js');
var LF = globalThis.LF;
var noop = function () {};
var fail = 0, pass = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } }

var state;
function reset(o) {
  state = Object.assign({ title: '州牧', gold: 100000, room: 'luoyang', flags: {}, officers: [] }, o || {});
  state.army = state.army || {};
}
// 目标城归属：设为某势力，便于 captureFrom 路径走通
var owned = { luoyang: 'dongzhuo' };
function cityOwnerOf(c) { return owned[c] || ((LF.CITIES[c] || {}).owner) || 'none'; }

var G = { ENEMIES: {} };
var conquerCalls = [];
var pendingArmyBattle = null;
var War;  // 前向声明，供 startCombat 桩回调

var Army = require(path.join(ROOT, 'shared/core/army.js'))({
  getState: function () { return state; },
  getCurrentModalKind: function () { return 'x'; },
  LF: LF, G: G,
  log: noop, toast: noop, save: noop, renderStatus: noop, renderRoom: noop,
  openModal: noop, closeModal: noop,
  itemIconHTML: function () { return ''; }, escapeHtml: function (s) { return String(s == null ? '' : s); },
  packAdd: noop, packConsume: noop, packFind: noop, packList: noop, afterPackChange: noop,
  cityDevOf: function () { return 0; }, isCityGrid: function () { return false; },
  roleAtkMul: function () { return 1; }, roleDef: function () { return 1; },
  exert: noop, advanceTime: noop, commandBonus: function () { return 1; }
});

War = require(path.join(ROOT, 'shared/core/war.js'))({
  getState: function () { return state; },
  LF: LF, G: G,
  log: noop, toast: noop, save: noop, renderStatus: noop, renderRoom: noop,
  openModal: noop, closeModal: noop,
  escapeHtml: function (s) { return String(s == null ? '' : s); },
  exert: function () { return true; }, advanceTime: noop,
  startCombat: function (ids, opt) { War.armyBattleEnd('win'); },                 // 强制获胜：跳过战术战斗
  showCombatSettlement: function (res, cb) { if (cb) cb(); },                    // 立即推进下一段 / 易帜
  conquerCity: function (cid, fac, rep) { conquerCalls.push([cid, fac, rep]); },
  playerFaction: function () { return 'player'; },
  cityDevOf: function () { return 0; },
  cityOwnerOf: cityOwnerOf,
  isCityGrid: function () { return false; },
  roleAtkMul: function () { return 1; },
  Army: Army,
  getPendingArmyBattle: function () { return pendingArmyBattle; },
  setPendingArmyBattle: function (v) { pendingArmyBattle = v; },
  Officers: {
    garrisonCommander: function () { return null; },
    captureFrom: noop, officerCombat: function () { return null; },
    civilBonus: function () { return 1; }, garrisonCivilBonus: function () { return 1; }
  }
});

// ── 用例 1：完整攻城三段 → 城破易帜 ──
(function () {
  reset({ room: 'luoyang', flags: { cityPos: { cid: 'luoyang' } } });
  Army.armyRecruit('luoyang', 'changqiang', 200);
  state.army.rallyPoint = 'luoyang';
  state.army.logistics.grain = 50;          // 满足「军粮告罄」前置
  var before = conquerCalls.length;
  var launched = War.startSiegeBattle('luoyang');
  ok(launched === true, 'startSiegeBattle 应返回 true');
  ok(conquerCalls.length === before + 1, '应触发一次 conquerCity');
  var c = conquerCalls[conquerCalls.length - 1];
  ok(c[0] === 'luoyang', 'conquerCity 目标应为 luoyang');
  ok(c[1] === 'player', 'conquerCity 归属应为 player');
  ok(c[2] === -5, 'conquerCity rep 应为 -5');
  ok(Army.armyActive(), '攻城后军队仍激活');
})();

// ── 用例 2：无兵不可兴师（前置守卫） ──
(function () {
  reset({ room: 'luoyang', flags: { cityPos: { cid: 'luoyang' } } });
  var before = conquerCalls.length;
  var r = War.startSiegeBattle('luoyang');
  ok(r === false, '无部曲时 startSiegeBattle 应返回 false');
  ok(conquerCalls.length === before, '无兵不应触发 conquerCity');
})();

console.log('\n───── 攻城战役自测 ─────');
console.log('  PASS: ' + pass + ' / FAIL: ' + fail);
process.exit(fail ? 1 : 0);

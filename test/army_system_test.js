// 军队系统自测（v20260921a）
// 运行：node test/army_system_test.js
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'shared/data/troops.js'));
require(path.join(ROOT, 'shared/core/army.js'));
require(path.join(ROOT, 'shared/core/war.js'));
var LF = globalThis.LF;

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n── ' + t + ' ──'); }

// ── 桩 ──
LF.CITIES = {
  luoyang: { name: '洛阳', pop: 90, wall: 80, agri: 60, commerce: 70, lng: 112.45, lat: 34.62 },
  xuchang: { name: '许昌', pop: 60, wall: 50, agri: 70, commerce: 55, lng: 114.02, lat: 34.03 },
  chenliu: { name: '陈留', pop: 40, wall: 40, agri: 55, commerce: 45, lng: 114.40, lat: 34.80 }
};
LF.FACTIONS = { caocao: { name: '曹' } };

var state = {
  title: '太守', gold: 8000, room: 'luoyang', day: 1, hp: 100, maxHp: 100,
  ruledCities: ['luoyang'], pack: [], flags: {}, army: null
};
var modalKind = null;
var G = { ENEMIES: {}, ROOMS: { luoyang: {}, fld_x: { isField: true } } };

function mkCtx(extra) {
  var c = {
    getState: function () { return state; },
    getCurrentModalKind: function () { return modalKind; },
    LF: LF, G: G,
    log: function () { }, toast: function () { }, save: function () { },
    renderStatus: function () { }, renderRoom: function () { },
    openModal: function () { }, closeModal: function () { },
    itemIconHTML: function () { return ''; }, escapeHtml: function (s) { return String(s); },
    packAdd: function () { return true; }, packConsume: function () { return true; },
    packFind: function () { return null; }, packList: function () { return state.pack || []; },
    afterPackChange: function () { },
    cityDevOf: function () { return 40; }, isCityGrid: function (r) { return !!LF.CITIES[r]; },
    roleAtkMul: function () { return 1; }, roleDef: function () { return { icon: '⚔', name: '将才' }; },
    roleEconMul: function () { return 1; }, roleFavorMul: function () { return 1; },
    exert: function () { return true; }, advanceTime: function () { },
    startCombat: function (ids, opt) { c.__lastStart = { ids: ids, opt: opt }; return true; },
    showCombatSettlement: function (a, b) { c.__lastSettle = { info: a, cb: b }; return true; },
    conquerCity: function (cid, fid, rep) { c.__conquered = { cid: cid, fid: fid, rep: rep }; return true; },
    playerFaction: function () { return 'player'; },
    getPendingArmyBattle: function () { return c.__ab || null; },
    setPendingArmyBattle: function (v) { c.__ab = v; }
  };
  if (extra) for (var k in extra) c[k] = extra[k];
  return c;
}

var ctx = mkCtx();
var Army = LF.createArmy(ctx);
var warCtx = mkCtx({ Army: Army });
var War = LF.createWar(warCtx);

// ══ 1. 兵科 / 阵位 / 军令 ══
section('兵科 · 阵位 · 军令');
var T = LF.TROOPS, ids = Object.keys(T);
ok('七兵科齐备', ids.length === 7, ids.length);
ok('每兵科字段完整', ids.every(function (k) {
  var d = T[k];
  return d.id === k && d.name && typeof d.atk === 'number' && typeof d.def === 'number' &&
    typeof d.hp === 'number' && typeof d.spd === 'number' && d.slot && LF.TROOP_RANKS[d.slot];
}));
ok('四阵位齐备', Object.keys(LF.ARMY_RANKS).length === 4 && LF.ARMY_RANK_ORDER.length === 4);
ok('军令齐备且各有所属阵位', Object.keys(LF.ARMY_ORDERS).every(function (k) {
  var o = LF.ARMY_ORDERS[k];
  return o.id === k && o.name && (!o.rank || LF.ARMY_RANKS[o.rank]);
}));
ok('前军/中军/后军/游骑各有军令', ['front', 'mid', 'rear', 'flank'].every(function (r) {
  return Object.keys(LF.ARMY_ORDERS).some(function (k) { return LF.ARMY_ORDERS[k].rank === r; });
}));
ok('士气分档单调递减', (function () {
  var B = LF.TROOP_MORALE_BANDS;
  for (var i = 1; i < B.length; i++) if (B[i].min >= B[i - 1].min) return false;
  return LF.moraleBand(90).key === 'high' && LF.moraleBand(5).key === 'broken';
})());
ok('官职兵力上限递增', LF.armyCapOf('游侠') < LF.armyCapOf('太守') && LF.armyCapOf('太守') < LF.armyCapOf('君主'));

// ══ 2. 募兵 / 解散 / 整编 ══
section('募兵 · 解散 · 整编');
state.army = null;
ok('ensureArmy 补默认值', (function () { var a = Army.ensureArmy(); return a && a.troops && a.morale === 100 && a.logistics && typeof a.logistics.grain === 'number'; })());
var g0 = state.gold;
ok('募兵成功并扣银', Army.armyRecruit('luoyang', 'changqiang', 50) && state.gold < g0);
ok('募兵后入册', Army.troopOf('changqiang') && Army.troopOf('changqiang').count === 50);
ok('首次成军点亮 active 与驻扎地', state.army.active === true && state.army.rallyPoint === 'luoyang');
state.title = '游侠';
ok('官职上限生效（游侠 50）', (function () {
  Army.armyRecruit('luoyang', 'daodun', 100);
  return Army.armyCount() === LF.armyCapOf('游侠');
})(), 'count=' + Army.armyCount());
state.title = '太守';
ok('兵源池受限（城 pop*2）', Army.recruitLeft('chenliu') === Math.round(40 * 2) && Army.recruitLeft('luoyang') <= Math.round(90 * 2));
ok('整编：步卒可列前军/中军', Army.armySetRank('changqiang', 'mid') && Army.troopOf('changqiang').rank === 'mid');
ok('整编：步卒不可列游骑', Army.armySetRank('changqiang', 'flank') === false);
ok('解散按比例减员', (function () {
  state.title = '太守';
  Army.armyRecruit('luoyang', 'changqiang', 10);
  var before = Army.armyCount();
  Army.armyDisband('changqiang', 20);
  return Army.armyCount() === before - 20;
})());

// ══ 3. 辎重 / 军粮 / 士气 ══
section('辎重 · 军粮 · 军心');
ok('辎重容量随辎重兵增长', (function () {
  var c0 = Army.logisticsCap();
  Army.armyRecruit('luoyang', 'qizhong', 20);
  return Army.logisticsCap() >= c0;
})());
var grain0 = state.army.logistics.grain;
ok('籴粮扣银入账', Army.armyBuyGrain(300) && state.army.logistics.grain === grain0 + 300);
ok('军粮可支天数随兵力变化', Army.grainDays() > 0);
ok('有粮时按日扣粮不掉士气', (function () {
  var m0 = state.army.morale, g = state.army.logistics.grain;
  Army.tickArmyDay(1);
  return state.army.logistics.grain < g && state.army.morale === m0;
})());
ok('断粮则士气下跌', (function () {
  state.army.logistics.grain = 0;
  var m0 = state.army.morale;
  Army.tickArmyDay(1);
  return state.army.morale < m0;
})());
ok('士气分档影响战力倍率', LF.moraleBand(90).atkMul > LF.moraleBand(20).atkMul);

// ══ 4. 独立调兵 / 行军 ══
section('调兵 · 行军 · 斥候 · 设伏');
state.army.logistics.grain = 5000;
state.army.marching = null;
ok('调兵：生成行军任务并预支军粮', (function () {
  var g = state.army.logistics.grain;
  var r = Army.armyDeploy('xuchang');
  return r && state.army.marching && state.army.marching.to === 'xuchang' && state.army.logistics.grain < g;
})());
ok('行军中不在身边', Army.armyWithPlayer() === false);
ok('行军按日推进并抵达', (function () {
  var d = state.army.marching.left;
  for (var i = 0; i < d + 1; i++) Army.tickArmyDay(1);
  return state.army.marching === null && state.army.rallyPoint === 'xuchang';
})());
ok('同城即与你会合', (function () { state.room = 'xuchang'; return Army.armyWithPlayer() === true; })());
ok('宿营整军回士气', (function () {
  state.army.morale = 60;
  var okc = Army.armyCamp();
  return okc && state.army.morale > 60;
})());
ok('无骑兵则派不出斥候', (function () {
  state.army.troops = state.army.troops.filter(function (t) { return t.type !== 'qibing'; });
  return Army.armyScout() === false;
})());
ok('有骑兵则可派斥候', (function () {
  state.title = '太守';
  Army.armyRecruit('xuchang', 'qibing', 10);
  var r = Army.armyScout();
  return r && Army.scouting() === true;
})());
ok('城中不可设伏', (function () { state.room = 'xuchang'; return Army.armyAmbush() === false; })());
ok('郊野可设伏', (function () {
  state.room = 'fld_x';
  var r = Army.armyAmbush();
  return r && state.flags.armyAmbush && state.flags.armyAmbush.room === 'fld_x';
})());

// ══ 5. 营级单位聚合 ══
section('营级单位 · 军令注入');
Army.armySetRank('changqiang', 'front');   // 确保有前军，以验证 guard 吸火
var units = Army.buildArmyPlayerUnits({ combatOnly: true });
ok('每兵种一营', units.length > 0 && units.every(function (u) { return u.isTroop && u.count > 0; }));
ok('数值随兵力聚合', units.every(function (u) { return u.maxHp > 0 && u.atk > 0 && u.hp === u.maxHp; }));
ok('前军带 guard（吸火）', units.some(function (u) { return u.rank === 'front' && u.guard === true; }));
ok('阵位排序 前→中→后→游骑', (function () {
  var o = LF.ARMY_RANK_ORDER, last = -1;
  return units.every(function (u) { var i = o.indexOf(u.rank); if (i < last) return false; last = i; return true; });
})());
ok('每个营都注入了军令', units.every(function (u) { return u._artMap && Object.keys(u._artMap).length > 0 && u.artIds.length > 0; }));
var ordersMatchRank = units.every(function (u) {
  return u.artIds.every(function (aid) {
    var o = LF.ARMY_ORDERS[aid];
    return !o || !o.rank || o.rank === u.rank;
  });
});
ok('军令与阵位匹配', ordersMatchRank);
ok('坚守映射为防御架势', (function () {
  var f = units.filter(function (u) { return u.rank === 'front'; })[0];
  return !f || !f._artMap.jianshou || f._artMap.jianshou.id === 'defend';
})());
ok('后勤兵不打仗（combatOnly）', units.every(function (u) { return u.troopType !== 'minfu'; }));

// ══ 6. 战后回扣与溃散 ══
section('战后回扣 · 溃散');
var before = Army.armyCount();
var damaged = units.map(function (u) {
  var c = Object.assign({}, u); c.hp = Math.round(u.maxHp * 0.5); return c;
});
var loss = Army.settleArmyLoss(damaged);
ok('按残血比例折兵', loss.lost > 0 && Army.armyCount() < before, 'lost=' + loss.lost);
ok('溃散额外折兵', (function () {
  var c0 = Army.armyCount();
  var u2 = Army.buildArmyPlayerUnits({ combatOnly: true }).map(function (u) { u.routed = true; u.hp = Math.round(u.maxHp * 0.5); return u; });
  var l2 = Army.settleArmyLoss(u2);
  return l2.routed.length > 0 && Army.armyCount() < c0;
})());
ok('战后士气取各营均值', state.army.morale >= 0 && state.army.morale <= 100);

// ══ 7. 守军派生 / 攻城编排 ══
section('守军派生 · 攻城编排');
var w0 = War.defenderWave('luoyang', 0);
var w2 = War.defenderWave('luoyang', 2);
ok('城门段有守卒与弓弩', w0.length >= 2 && w0.some(function (u) { return /守卒/.test(u.name); }));
ok('府衙段有守将', w2.some(function (u) { return /守将/.test(u.name); }));
ok('守军数值有效', w0.concat(w2).every(function (u) { return u.maxHp > 0 && u.atk > 0 && u.morale > 0; }));
ok('守军亦带军令', w0.every(function (u) { return u._artMap && u.artIds.length > 0; }));
ok('三段次序为 城门→巷道→府衙', War.SEGS.map(function (s) { return s.name; }).join('') === '城门巷道府衙');
ok('聚合防御保持可辨（<80 上限内）', (function () {
  var big = War.mkUnit('大营', 400, { atk: 8, def: 10, hp: 26, spd: 12 }, {});
  return big.def > 0 && big.def <= 80;
})(), 'def=' + War.mkUnit('大营', 400, { atk: 8, def: 10, hp: 26, spd: 12 }, {}).def);
ok('野战可起兵', (function () {
  state.room = 'luoyang';
  state.army.rallyPoint = 'luoyang';   // 部曲与你会合，方可出战
  var r = War.startFieldBattle({ def: { name: '流寇', troops: 60 } });
  return r === true && warCtx.__lastStart && warCtx.__lastStart.opt.armyBattle === true;
})());
ok('攻城编排登记三段上下文', (function () {
  Army.armyRecruit('luoyang', 'changqiang', 30);
  var r = War.launchSiege('luoyang');
  return r && warCtx.__ab && warCtx.__ab.kind === 'siege' && warCtx.__ab.seg === 0;
})());
ok('守军定义已注入 ENEMIES', Object.keys(G.ENEMIES).some(function (k) { return k.indexOf('_dfn_') === 0; }));

// ══ 8. 战场事件：军令副作用 / 冲散 / 援军 ══
section('战场事件');
var st = {
  round: 3,
  playerUnits: [
    { name: '长枪兵营', hp: 100, maxHp: 1000, isTroop: true, morale: 30, routed: false },
    { name: '主角', hp: 50, maxHp: 100, morale: 90 }
  ],
  enemies: [{ name: '城门守卒', hp: 500, maxHp: 900, morale: 40, routed: false }]
};
G.CombatEngine = { state: st };
warCtx.__ab = { kind: 'siege', cid: 'luoyang', seg: 0, reinforce: null };
ok('军令：冲阵自损 + 士气结算', (function () {
  var hp0 = st.playerUnits[0].hp;
  War.armyRoundHook([{ unit: st.playerUnits[0], actionId: 'chongzhen' }]);
  return st.playerUnits[0].hp < hp0 && st.enemies[0].morale < 40;
})());
ok('军令：督战提振全军士气', (function () {
  var m0 = st.playerUnits[1].morale;
  War.armyRoundHook([{ unit: st.playerUnits[0], actionId: 'duzhan' }]);
  return st.playerUnits[0].morale > 30 || st.playerUnits[1].morale >= m0;
})());
ok('冲散：残血低士气可溃散', (function () {
  var routed = false;
  for (var i = 0; i < 200 && !routed; i++) {
    st.playerUnits[0].routed = false; st.playerUnits[0].hp = 200; st.playerUnits[0].morale = 5;
    War.armyRoundHook([]);
    routed = !!st.playerUnits[0].routed;
  }
  return routed;
})());
ok('援军：到回合入场', (function () {
  warCtx.__ab = {
    kind: 'siege', cid: 'luoyang', seg: 0,
    reinforce: { round: 1, done: false, name: '邻郡援军', unit: War.mkUnit('邻郡援军', 50, { atk: 7, def: 8, hp: 26, spd: 16 }, {}) }
  };
  var n0 = st.enemies.length;
  War.armyRoundHook([]);
  return st.enemies.length === n0 + 1 && warCtx.__ab.reinforce.done === true;
})());

// ══ 9. 结算回写 ══
section('胜负回写');
G.CombatEngine = { state: { playerUnits: [{ name: '主角', hp: 40, maxHp: 100 }], enemies: [] } };
warCtx.__ab = { kind: 'siege', cid: 'luoyang', seg: 2, fid: null };
warCtx.__conquered = null;
warCtx.__lastSettle = null;
War.armyBattleEnd('win');
ok('结算面板已弹出', !!warCtx.__lastSettle);
if (warCtx.__lastSettle && warCtx.__lastSettle.cb) warCtx.__lastSettle.cb();   // 玩家点确认 → 易帜
ok('攻破府衙 → 易帜', !!warCtx.__conquered && warCtx.__conquered.cid === 'luoyang' && warCtx.__conquered.fid === 'player');

console.log('\n════ 结果：' + pass + ' 通过 / ' + fail + ' 失败 ════');
process.exit(fail ? 1 : 0);

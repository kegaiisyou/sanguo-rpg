// 聚落攻掠常驻冒烟（v20261116a 由根目录 _smoke_i.js 迁入 test/，原稿 v20261111i）：Place 军事属性 / 房间挂接 / Settlement 闭环 / war.js 平定回扣
const assert = require('assert');
global.window = global;

// ── 1. 数据层：placeKinds + places.js 补全逻辑真跑一遍 ──
require('../shared/data/placeKinds.js');
const LF = global.LF;
LF.CITIES = {};                       // 本用例只测 EXTRA 非城地点，避免拉入 72 城
require('../shared/data/places.js');
assert(LF.PLACE_DEFAULTS.wild.raidable === true, 'wild 类型契约含 raidable');
assert(LF.PLACE_DEFAULTS.camp.garrison > 0, 'camp 类型契约含守军');
const P = LF.PLACES;
assert(P.wuzhangyuan && P.lindao && P.guandu && P.luofeng_dungeon, 'EXTRA 地点已注册');
const FID = ['dongzhuo','yuanshao','caocao','sunce','liubiao','liuzhang','gongsun','matang','han'];
for (const id of ['wuzhangyuan','maolu','luofengpo','lvboshe','lindao','changshan','chibi','guandu']) {
  assert.strictEqual(P[id].raidable, true, id + ' 可攻掠');
  assert.strictEqual(P[id].military, true, id + ' 已标军事目标');
  assert(P[id].garrison > 0, id + ' 有守军');
  assert(P[id].loot && P[id].loot.length, id + ' 有辎重');
  assert(FID.indexOf(P[id].owner) >= 0, id + ' 归属为当世势力');
}
assert.strictEqual(P.luofeng_dungeon.raidable, undefined, '副本不走军事目标链路');
assert.strictEqual(P.luofeng_dungeon.loot[0], 'scroll_fire', '副本原有 loot 未被覆盖');
console.log('DATA_OK  8 个非城 Place 自动获得军事属性，副本数据零改动');

// ── 2. 房间层：genPlaceRooms 挂 placeId / 守军 / 辎重 ──
require('../shared/gen/rooms.js');
const r = LF.genPlaceRooms('lindao').lindao;
assert(r, '林径房间生成');
assert.strictEqual(r.placeId, 'lindao');
assert(r.garrison > 0, '房间带守军');
assert(r.loot && r.loot.length, '房间带辎重');
assert.strictEqual(r._kind, 'landmark', 'wild 仍走 landmark 生成器，原有动作不变');
const dg = LF.genPlaceRooms('luofeng_dungeon')['luofeng_dungeon@entrance'];
assert.strictEqual(dg.placeId, undefined, '副本入口房不被误标为军事目标');
console.log('ROOMS_OK 军事目标房挂 placeId，副本房不受影响');

// ── 3. Settlement 模块 ──
LF.TROOPS = {
  changqiang: { name:'长枪兵', hp:24, atk:6, def:8, spd:14 },
  daodun: { name:'刀盾兵', hp:28, atk:7, def:10, spd:12 },
  gongnu: { name:'弓弩兵', hp:18, atk:9, def:4, spd:13 }
};
LF.BF_PICK_FOE = (pool, rnd) => ['changqiang','daodun','gongnu'][Math.floor(rnd() * 3)];
LF.ITEMS = { dou:{name:'菽豆'}, jiu:{name:'黍酒'}, gumao:{name:'骨矛'} };
LF.FACTIONS = { han:{name:'汉室'}, dongzhuo:{name:'董卓'}, yuanshao:{name:'袁绍'},
  caocao:{name:'曹操'}, sunce:{name:'孙策'}, liubiao:{name:'刘表'},
  liuzhang:{name:'刘璋'}, gongsun:{name:'公孙'}, matang:{name:'马腾'}, player:{name:'义军'} };
require('../shared/core/settlement.js');

const state = { gold: 0, flags: {} };
const LOGS = [], TOASTS = [], PACK = [], REP = [];
const ST = LF.createSettlement({
  getState: () => state, LF: LF,
  log: (t) => LOGS.push(t), toast: (t) => TOASTS.push(t), save: () => {},
  addReputation: (n) => REP.push(n),
  packAdd: (id) => { PACK.push(id); return true; }
});
assert.strictEqual(ST.RAID_KM, 160);
assert.strictEqual(ST.list().length, 8, '8 个军事目标');
assert.strictEqual(ST.isMilitary('luofeng_dungeon'), false);
assert.strictEqual(ST.isMilitary('no_such_place'), false);

const NEAR = [117.00, 41.10], FAR = [104.06, 30.67];
const nearV = ST.get('lindao', NEAR);
assert.strictEqual(nearV.distKm, 0);
assert.strictEqual(nearV.attackable, true, '近处未平定敌对 → 可攻');
assert.strictEqual(nearV.hostile, true);
assert(nearV.ownerName, '归属显示名');
const farV = ST.get('lindao', FAR);
assert(farV.distKm > 1000);
assert.strictEqual(farV.attackable, false, '远处 → 鞭长莫及');
assert.strictEqual(ST.get('lindao').attackable, false, '缺玩家坐标 → 不可攻');
assert.strictEqual(ST.canAttack('lindao', NEAR), true);

const comp = ST.compose('lindao');
assert.strictEqual(comp.length, 3, '守军 3 营');
assert(comp.every(t => LF.TROOPS[t.type] && t.count >= 8), '兵种合法且有兵力');
assert(Math.abs(comp.reduce((s,t) => s + t.count, 0) - nearV.garrison) <= 3, '总兵力≈守军');
assert.deepStrictEqual(ST.compose('lindao'), comp, '同地编成确定性');
assert.strictEqual(ST.plunder('guandu'), false, '未平定不可劫掠');
assert(TOASTS.some(t => t.indexOf('守军未平') >= 0));

const lose = ST.resolve('lindao', 'lose');
assert.strictEqual(lose.won, false);
assert(lose.garrison < nearV.garrison, '失利后守军减员');
assert.strictEqual(ST.cleared('lindao'), false, '失利未平定');
assert.strictEqual(state.flags.placeOwner, undefined, '失利不改归属');

const win = ST.resolve('lindao', 'win');
assert.strictEqual(win.won, true);
assert(win.gold > 0 && win.rep >= 1);
assert.strictEqual(state.flags.placeOwner.lindao, 'player', '平定后易帜');
assert.strictEqual(ST.cleared('lindao'), true);
assert.strictEqual(ST.ownerOf('lindao'), 'player');
const after = ST.get('lindao', NEAR);
assert.strictEqual(after.hostile, false, '己方不再敌对');
assert.strictEqual(after.attackable, false, '已平定不可再攻');
assert.strictEqual(after.plunderable, true, '平定后可劫掠');
assert.strictEqual(ST.canAttack('lindao', NEAR), false);
assert.strictEqual(state.flags.cityOwner, undefined, '绝不污染城市归属账本');
assert.strictEqual(state.flags.ruledCities, undefined, '绝不污染治下城池');

const goldBefore = state.gold;
assert.strictEqual(ST.plunder('lindao'), true);
assert(state.gold > goldBefore, '劫掠入账银两');
assert(PACK.length > 0, '劫掠入包物品');
assert.strictEqual(ST.looted('lindao'), true);
assert.strictEqual(ST.plunder('lindao'), false, '辎重只能搜刮一次');
assert(LOGS.some(t => t.indexOf('〔劫掠〕') >= 0));
console.log('SETTLE_OK 距离准入 / 确定性编成 / 平定易帜 / 一次性劫掠 / 账本隔离');

// ── 4. war.js：placeId 透传 + finishField 平定回扣 ──
const LF2 = {
  TROOPS: LF.TROOPS, BF_PICK_FOE: LF.BF_PICK_FOE,
  ARMY_RANKS: { front:{name:'前军'}, flank:{name:'侧翼'}, mid:{name:'中军'}, rear:{name:'后军'} },
  moraleBand: () => ({ name:'昂扬' }),
  FACTIONS: LF.FACTIONS, CITIES: {}, ARMY_ORDERS: {}, Officers: null,
  Settlement: ST
};
const G = { ENEMIES: {}, CombatEngine: { state: null }, ROOMS: {} };
const Army = {
  ensureArmy: () => ({ morale:80, logistics:{grain:20}, troops:[{type:'changqiang',count:100,rank:'front'}] }),
  armyCount: () => 100, armyWithPlayer: () => true,
  buildArmyPlayerUnits: () => [{ name:'亲兵', rank:'front', morale:80, hp:100, maxHp:100, count:100, isTroop:true, artIds:[], _artMap:{} }],
  buildOrdersFor: () => ({ map:{}, ids:[] }),
  settleArmyLoss: () => ({ lost:0, routed:[] }),
  armyMoraleAdd: () => {}, grainDays: () => 5
};
let pending = null, bfStart = null;
const MODALS = [], SETTLES = [], WLOGS = [];
const ctx = {
  getState: () => state, LF: LF2, G: G,
  log: (...a) => WLOGS.push(a.join(' ')), toast: () => {}, save: () => {},
  renderStatus: () => {}, renderRoom: () => {},
  openModal: (k, o) => MODALS.push([k, o]), closeModal: () => {},
  escapeHtml: (s) => s, exert: () => true, advanceTime: () => {},
  startCombat: () => {}, showCombatSettlement: (s, cb) => { SETTLES.push(s); SETTLE_CB = cb; },
  conquerCity: () => {}, playerFaction: () => 'player', cityDevOf: () => 0, cityOwnerOf: () => 'han',
  isCityGrid: () => false, roleAtkMul: () => 1, Army: Army,
  getPendingArmyBattle: () => pending, setPendingArmyBattle: (v) => { pending = v; },
  getBattlefield: () => ({ start: (cfg) => { bfStart = cfg; } }),
  addReputation: (n) => REP.push(n)
};
let SETTLE_CB = null;
require('../shared/core/war.js');
const War = LF.createWar(ctx);
const foes = [{ name:'守军', count:100, hp:300, maxHp:300, atk:20, def:10, spd:12,
                rank:'front', morale:70, isTroop:true, troopType:'changqiang', artIds:[], _artMap:{} }];
assert.strictEqual(War.startFieldBattle({
  def: { name:'官渡守军', troops: 200 }, foeUnits: foes, placeId: 'guandu', closeMap: true
}), true);
assert(bfStart, '战棋沙盘已起');
assert.strictEqual(bfStart.kind, 'field');
assert.strictEqual(pending.placeId, 'guandu', 'placeId 进入 pendingArmyBattle');
assert.strictEqual(ST.cleared('guandu'), false, '战前未平定');

bfStart.onEnd('win', [], null);
const sum = SETTLES[0];
assert(sum, '结算面板已弹出');
assert(sum.gold > 0, '缴获写入结算面板');
assert(sum.repText >= 1, '声望写入结算面板');
assert(String(sum.lines).indexOf('〔捷报〕') >= 0, '捷报进入战报行');
assert.strictEqual(ST.cleared('guandu'), true, '得胜后聚落平定');
assert.strictEqual(state.flags.placeOwner.guandu, 'player', '得胜后易帜');
assert(state.gold > goldBefore, '缴获银两入账');
SETTLE_CB();
assert.deepStrictEqual(MODALS.pop(), ['map', { forceWorld:true, _scope:'world' }], '确认后回山河志');
console.log('WAR_OK    placeId 透传 / 平定回扣 / 缴获声望 / 战后重开山河志');
console.log('SMOKE_I_ALL_OK');
console.log('SETTLEMENT SMOKE: PASS（数据 / 房间 / Settlement / war 回扣 全绿）');

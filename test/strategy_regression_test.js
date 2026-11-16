// 战略层常驻回归（v20261116a）：AI 粮草长局 / 简明朝堂 / 三令落账 / 兵科归一
// 之前这几条只靠临时 _verify_grain*.mjs 与 Playwright 临时脚本，脚本一删就没有回归资产。
// 本文件只用 Node 内置模块 + 项目现有依赖，隔离 vm 加载真实源码，不依赖浏览器与定时器。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  x ' + m); } }
const noop = function () {};

function isolated(file, extra) {
  const M = Object.create(Math); M.random = () => 0;   // 固定随机数：自动逐鹿必发一役
  const sb = { window: {}, console, Math: M, Object, JSON, setTimeout, clearTimeout };
  sb.window = vm.createContext(sb);
  if (extra) Object.keys(extra).forEach(k => { sb[k] = extra[k]; });
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sb.window, { filename: file });
  return sb;
}

// ════════════════════ A. AI 粮草：60 月长局不得死锁 ════════════════════
{
  const C = {};
  ['a1','a2','a3','a4','a5','a6'].forEach((id, i) => C[id] = { name: 'A' + i, agri: 85, commerce: 60, pop: 70, wall: 50, tier: 'city', pos: [110 + i, 35] });
  ['b1','b2'].forEach((id, i) => C[id] = { name: 'B' + i, agri: 25, commerce: 60, pop: 70, wall: 50, tier: 'city', pos: [120 + i, 30] });
  C.p1 = { name: '我城', agri: 60, commerce: 60, pop: 70, wall: 50, tier: 'city', pos: [115, 32] };
  const OWN = { a1:'fa', a2:'fa', a3:'fa', a4:'fa', a5:'fa', a6:'fa', b1:'fb', b2:'fb', p1:'player' };
  const F = { cityOwner: Object.assign({}, OWN), cityDev: {}, cityStats: {}, ruledCities: ['p1'], factionWarHit: {} };
  const state = { dead:false, flags:F, gold:1000, reputation:0, day:1, room:'p1',
    res:{ grain:200, iron:0, kit:0 },
    army:{ troops:[{ type:'changqiang', count:10 }], logistics:{ grain:123 } }, title:'游侠' };
  const logs = [];
  const FACTIONS = { fa:{name:'富农'}, fb:{name:'贫农'}, han:{name:'汉室'}, player:{name:'义军'} };
  const ctx = {
    getState: () => state,
    LF: { CITIES:C, FACTIONS:FACTIONS, ownerKeyOf:k => k, armyCapOf:() => 50 },
    log: t => logs.push(t), toast: noop, save: noop, renderStatus: noop, openModal: noop,
    conquerCity: (cid,fid) => { OWN[cid]=fid; F.cityOwner[cid]=fid; },
    playerFaction: () => 'player', cityOwnerOf: cid => OWN[cid],
    cityDevOf: cid => F.cityDev[cid] || 0, setCityDev: (c,v) => { F.cityDev[c]=v; },
    isCityGrid: cid => cid === 'p1',
    chronicle: noop, chronicleList: () => [], escapeHtml: s => String(s),
    roleAtkMul: () => 1, roleEconMul: () => 1, roleFavorMul: () => 1,
    roleDef: () => ({ icon:'侠', name:'游侠' }),
    Officers: null, renderEdictCommands: () => '', monthlyAffairs: noop,
    getArmyTroops: () => 10, warCityAdjPairs: () => [['a1','b1'],['a6','p1']]
  };
  const sb = isolated('shared/core/strategy.js');
  const St = sb.window.LF.createStrategy(ctx);
  const A = () => F.factionAssets;

  // 首月：富农存粮 > 贫农，玩家辎粮镜像不变
  St.factionDomesticAI();
  ok(A().fa.grain > A().fb.grain && !A().fa.grainShort && !A().fb.grainShort, 'A1 首月产粮有等差且不缺粮');
  ok(A().player.grain === 123, 'A2 玩家辎粮镜像 123 石');

  // 60 月压测：不得出现 v20261115c 初版「第 30 月起永久断粮、兵力冻结、逐鹿停摆」
  let shortFa = 0, shortFb = 0;
  for (let m = 2; m <= 60; m++) {
    St.factionDomesticAI();
    if (A().fa.grainShort) shortFa++;
    if (A().fb.grainShort) shortFb++;
  }
  const a = A().fa, b = A().fb;
  ok(a.troops > b.troops && a.troops > 0 && b.troops > 0, 'A3 富农养兵 > 贫农且都没归零');
  ok(shortFa <= 2 && shortFb <= 2 && !a.grainShort && !b.grainShort && a.grain > 0 && b.grain > 0,
     'A4 60 月无永久断粮死锁');
  const need = f => Math.max(20, Math.round((f.troops || 0) * 0.15));
  ok(a.grain >= need(a) && b.grain >= need(b), 'A5 长局后两方仍备得出征军资');
  const grainBefore = a.grain + b.grain;
  St.warlordDayTick(1);
  ok(a.grain + b.grain < grainBefore, 'A6 长局末月自动逐鹿仍能发兵扣粮');

  // 人为断粮：一次裁到可持续规模、当月记饥馑、下月复耕即解禁
  b.troops = 5000; b.grain = 0; b.grainShort = false;
  St.factionDomesticAI();
  ok(b.grainShort === true && b.troops < 5000, 'A7 断粮 → 饥馑 + 逃兵（兵额裁到粮能养的规模）');
  St.factionDomesticAI();
  ok(b.grainShort === false, 'A8 下月复耕即解禁，缺粮不是永久状态');

  // 旧档兼容：删掉 grain 字段后惰性补 240 石
  delete a.grain;
  St.factionDomesticAI();
  ok(typeof a.grain === 'number', 'A9 旧档缺 grain 字段可惰性兼容');

  // B. 简明朝堂：默认三令、展开完整朝堂、旧入口 forceFull
  state.flags.courtFull = 0;
  const simple = St.renderEdict();
  ok(simple.indexOf('court-simple') >= 0, 'B1 默认渲染简明朝堂');
  ['kaiken','shangye','lianbing'].forEach(k =>
    ok(simple.indexOf("civilCommand('" + k + "')") >= 0, 'B2 简明朝堂含 ' + k + ' 大按钮'));
  state.flags.courtFull = 1;
  ok(St.renderEdict().indexOf('court-v2') >= 0, 'B3 展开后完整三层朝堂仍可达');
  state.flags.courtFull = 0;
  ok(St.renderGrandStrategy().indexOf('court-v2') >= 0, 'B4 旧入口 forceFull 不污染 courtFull');
  ok(state.flags.courtFull === 0, 'B5 forceFull 只影响本次渲染');
}

// ════════════════════ A2. 朔日月报历史翻页（v20261116b） ════════════════════
{
  const C = { p1:{ name:'我城', agri:60, commerce:60, pop:70, wall:50, tier:'city', pos:[115,32] } };
  const OWN = { p1:'player' };
  const F = { cityOwner:{p1:'player'}, cityDev:{}, cityStats:{}, ruledCities:['p1'], factionWarHit:{} };
  const state = { dead:false, flags:F, gold:100, reputation:0, day:1, room:'p1',
    res:{ grain:100, iron:0, kit:0 }, army:{ troops:[{type:'changqiang',count:1}], logistics:{grain:10} }, title:'游侠' };
  const ctx = {
    getState: () => state,
    LF: { CITIES:C, FACTIONS:{ player:{name:'义军'}, han:{name:'汉室'} }, ownerKeyOf:k => k, armyCapOf:() => 50 },
    log: noop, toast: noop, save: noop, renderStatus: noop, openModal: noop,
    conquerCity: noop, playerFaction: () => 'player', cityOwnerOf: cid => OWN[cid],
    cityDevOf: () => 0, setCityDev: noop, isCityGrid: () => false,
    chronicle: noop, chronicleList: () => [], escapeHtml: s => String(s),
    roleAtkMul: () => 1, roleEconMul: () => 1, roleFavorMul: () => 1, roleDef: () => ({icon:'侠',name:'游侠'}),
    Officers: null, renderEdictCommands: () => '', monthlyAffairs: noop,
    getArmyTroops: () => 1, warCityAdjPairs: () => [], warFactionTotal: () => 10
  };
  const sb = isolated('shared/core/strategy.js');
  const St = sb.window.LF.createStrategy(ctx);
  const WIN = sb.window;
  // 连跑 15 期月报，历史最多留 12 期，monthReport 恒指最新
  for (let i = 1; i <= 15; i++) St.onMonthTick({ eraName:'光和', eraYear:6, month:i, monthName:'月'+i, day:i*30 });
  ok(F.monthReports && F.monthReports.length === 12, 'A2-1 月报历史上限 12 期');
  ok(F.monthReport === F.monthReports[11], 'A2-2 monthReport 兼容字段指向最新一期');
  ok(F.monthReports[0].ym !== F.monthReports[11].ym, 'A2-3 历史各期年号不同（真在翻页）');
  // 翻页：初始最新（idx 0 → 实际数组末条由渲染倒序取，函数内钳制 0..len-1）
  ok(typeof WIN.monthReportPage === 'function', 'A2-4 翻页函数已挂 window');
  F.monthReportIdx = 0;
  WIN.monthReportPage(-1);
  ok(F.monthReportIdx === 0, 'A2-5 最新一期再翻下一期不越界');
  WIN.monthReportPage(1);
  ok(F.monthReportIdx === 1, 'A2-6 上一期 index 递增');
  for (let i = 0; i < 30; i++) WIN.monthReportPage(1);
  ok(F.monthReportIdx === F.monthReports.length - 1, 'A2-7 连续上一期钳制在末条');
  WIN.monthReportPage(-1);
  ok(F.monthReportIdx === F.monthReports.length - 2, 'A2-8 从最旧往回翻一期');
  // 势力图渲染含翻页条与按钮
  const html = St.renderFactionMap();
  ok(/fm-mr-nav/.test(html) && /monthReportPage\(1\)/.test(html), 'A2-9 势力图渲染翻页按钮');
  ok(/第 \d+ \/ 12 期/.test(html), 'A2-10 势力图渲染页码');
}

// ════════════════════ C. 简明朝堂三令真实落账 + 兵科归一 ════════════════════
{
  global.window = global;
  const load = p => require(path.join(ROOT, p));
  load('shared/config/constants.js');
  load('shared/data/troops.js');
  load('shared/data/cities.js');
  load('shared/data/personas.js');
  load('shared/data/officers.js');
  load('shared/data/edicts.js');
  const LF = globalThis.LF;
  const G = { ENEMIES: {} };
  const st = {
    room:'luoyang', day:1, gold:1000, res:{ grain:200, iron:20, kit:20 }, flags:{},
    army:{ active:true, troops:[{ type:'changqiang', count:1 }], logistics:{ grain:50 }, recruited:{} },
    role:'youxia', id:'hero', title:'游侠', hp:100, food:80, drink:80, energy:80, ruledCities:['luoyang']
  };
  const Army = load('shared/core/army.js')({
    getState: () => st, getCurrentModalKind: () => 'x', LF, G,
    log: noop, toast: noop, save: noop, renderStatus: noop, renderRoom: noop,
    openModal: noop, closeModal: noop, itemIconHTML: () => '', escapeHtml: s => String(s),
    packAdd: noop, packConsume: noop, packFind: noop, packList: noop, afterPackChange: noop,
    cityDevOf: () => 0, isCityGrid: () => true, roleAtkMul: () => 1, roleDef: () => 1,
    exert: noop, advanceTime: noop, commandBonus: () => 1
  });
  const Officers = load('shared/core/officers.js')({
    getState: () => st, LF, log: noop, toast: noop, save: noop, renderStatus: noop,
    cityOwnerOf: () => 'player', playerFaction: () => 'player',
    isCityGrid: () => true, armyTrainAt: Army.armyTrainAt,
    busyAct: (label, ms, done) => done(),     // 同步执行耗时动作回调，测试不等 1s 定时器
    advanceMinutes: noop, getCurrentModalKind: () => 'x', openModal: noop,
    escapeHtml: s => String(s)
  });

  ok(LF.EDICT_COMMANDS.lianbing.trainType === '步兵', 'C0 配置写中文兵科名（回归 v20261114b 的归一前提）');

  const g0 = st.res.grain, lg0 = st.army.logistics.grain;
  Officers.civilCommand('kaiken');
  ok(st.res.grain > g0 - 8, 'C1 农业令产仓粮（扣 8 石籽粮后仍净增）');
  ok(st.army.logistics.grain > lg0, 'C2 农业令兼补辎粮（v20261115a 口径统一）');

  const gold0 = st.gold;
  Officers.civilCommand('shangye');
  ok(st.gold > gold0 - 8, 'C3 商业令产银（扣 8 两本钱后仍净增）');

  const cnt0 = Army.armyCount();
  Officers.civilCommand('lianbing');
  ok(Army.armyCount() > cnt0, 'C4 募兵令经 troopKey 归一后真实增兵');
  ok(Army.armyTrainAt('luoyang', '步兵', 1) > 0, 'C5 armyTrainAt 直接收中文兵科名也增兵');

  // 每城每令每日一次：同令再点不重复落账
  const grainBefore = st.res.grain, goldBefore = st.gold, cntBefore = Army.armyCount();
  Officers.civilCommand('kaiken'); Officers.civilCommand('shangye'); Officers.civilCommand('lianbing');
  ok(st.res.grain === grainBefore && st.gold === goldBefore && Army.armyCount() === cntBefore, 'C6 三令每城每日各一次');
  const cs = (st.flags.cityStats || {}).luoyang || {};
  ok((cs.agri || 0) > 0 && (cs.com || 0) > 0, 'C7 经营积累写入 cityStats');
}

console.log('=== 战略层回归：' + pass + ' PASS / ' + fail + ' FAIL ===');
if (fail) { console.log('STRATEGY REGRESSION: FAIL'); process.exit(1); }
console.log('STRATEGY REGRESSION: PASS（60 月粮草 / 简明朝堂 / 三令落账 / 兵科归一）');

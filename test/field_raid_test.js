// 敌军主动扑击常驻回归（v20261116a）：FieldArmy 候选/冷却 + time.js 跨日链 + 引擎接线
// 防两类回归：① 部队只会走不会打（跨日链漏接 / raidCheck 失效）；
//             ② 同一跨日「设伏 + 扑击」弹两次战棋。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; } else { fail++; console.log('  x ' + m); } }

function isolated(file) {
  const M = Object.create(Math); M.random = () => 0;
  const sb = { window: {}, console, Math: M, Object, JSON, setTimeout, clearTimeout };
  sb.window = vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sb.window, { filename: file });
  return sb;
}

// ════════════════ 1) FieldArmy：near 复用 / raidCheck / markRaided 冷却 ════════════════
{
  const C = {
    c1: { name:'甲城', pos:[110,35], owner:'fa', garrison:40 },
    c2: { name:'乙城', pos:[116,32], owner:'player', garrison:40 }
  };
  const Y = [110, 35];
  function army(o) {
    return Object.assign({ fid:'fa', hostile:true, status:'marching', power:600, morale:80,
      prog:0.2, speed:0.1, grain:10, ttl:10, from:'c1', to:'c2',
      troops:[{ type:'changqiang', count:600 }] }, o);
  }
  const F = { faSeq:4, faRaidDay:null, fieldArmies:[
    army({ id:'fa1', pos:[110.1,35] }),                       // 敌对 · 近
    army({ id:'fa2', pos:[120,30] }),                         // 敌对 · 远
    army({ id:'fa3', pos:[110.2,35], hostile:false, fid:'player' }), // 非敌对 · 近
    army({ id:'fa4', pos:[110.3,35], raided:true })            // 已扑击过 · 近
  ]};
  const state = { day:10, dead:false, flags:F };
  const ctx = {
    getState: () => state,
    LF: { CITIES:C, FACTIONS:{ fa:{name:'甲方'}, player:{name:'义军'} },
          ownerKeyOf: cid => (C[cid] || {}).owner || 'han', OWNER_ALIAS:{},
          TROOPS:{ changqiang:{ name:'长枪兵', hp:24, atk:6, def:8, spd:14 } },
          BF_PICK_FOE: () => 'changqiang' },
    log: () => {}, getOwner: () => null
  };
  const sb = isolated('shared/core/fieldarmy.js');
  const FA = sb.window.LF.createFieldArmy(ctx);

  ok(FA.RAID_COOLDOWN_DAYS === 3, 'F1 扑击冷却常量 = 3 日');
  ok(FA.near(Y, FA.ENGAGE_KM).length === 3, 'F2 near() 取到 3 支近处部队（不再是死代码）');
  const pick = FA.raidCheck(Y);
  ok(pick && pick.id === 'fa1', 'F3 raidCheck 只挑敌对 / 未扑击 / 行军中的近敌');
  ok(FA.raidCheck(null) === null, 'F4 无玩家坐标不扑击');

  FA.markRaided('fa1');
  ok(F.fieldArmies[0].raided === true && F.faRaidDay === 10, 'F5 markRaided 写一次性标记 + 全局冷却');
  ok(FA.raidCheck(Y) === null, 'F6 冷却期内不再扑击');
  state.day = 11;
  ok(FA.raidCheck(Y) === null, 'F7 冷却未满（1/3 日）仍不扑击');
  state.day = 13;
  F.fieldArmies[0].raided = false;
  ok(FA.raidCheck(Y) && FA.raidCheck(Y).id === 'fa1', 'F8 冷却期满且未扑击过可再次扑击');
  F.fieldArmies[0].raided = true;
  ok(FA.raidCheck(Y) === null, 'F9 同一支部队不会反复扑击');
  state.dead = true;
  ok(FA.raidCheck(Y) === null, 'F10 玩家已殒落不扑击');
}

// ════════════════ 2) time.js：跨日链顺序 / 设伏优先 ════════════════
{
  const calls = [];
  let ambushResult = false;
  const st = { clock:0, time:0, day:1, food:80, drink:80, energy:80, hp:100,
    flags:{ _monthKey:null }, eraName:'中平', eraYear:1, adYear:184 };
  const getter = fn => () => fn;
  const ctx = {
    getState: () => st,
    getClockFlowing: getter(() => true),
    getAutoOnbRoutines: getter(() => {}),
    getApplyTimeRoutines: getter(() => {}),
    getOnbDayTick: getter(() => {}),
    getWarlordDayTick: getter(() => {}),
    getTickArmyDay: getter(() => {}),
    getNpcAi: getter({ tickDay: () => {} }),
    getTryAmbush: getter(() => { calls.push('ambush'); return ambushResult; }),
    getDeriveCalendar: getter(() => ({ adYear:184, month:1, eraName:'中平', eraYear:1 })),
    getOnMonthTick: getter(() => {}),
    getTickForge: getter(() => {}),
    getTickBuildOrders: getter(() => {}),
    getRequestCurfewPatrol: getter(() => {}),
    getWeathers: getter(['晴']),
    getOnbF: getter(() => ({})),
    getOnbBound: getter(() => false),
    getInCampNow: getter(() => false),
    getLog: getter(() => {}),
    getCheckDeath: getter(() => {}),
    getTickAge: getter(() => {}),
    getFieldArmy: getter({ tickDay: () => calls.push('tickDay') }),
    getTryFieldRaid: getter(() => { calls.push('raid'); return false; })
  };
  const sb = isolated('shared/core/time.js');
  const Time = sb.window.LF.createTime(ctx);

  Time.advanceMinutes(1440);              // 跨一整日子夜
  ok(calls.indexOf('tickDay') >= 0, 'T1 跨日仍推进大地图行军');
  ok(calls.indexOf('raid') > calls.indexOf('tickDay'), 'T2 敌军扑击接在行军推进之后');
  ok(calls.indexOf('ambush') >= 0 && calls.indexOf('ambush') < calls.indexOf('raid'),
     'T3 设伏判定先于扑击');

  calls.length = 0;
  ambushResult = true;                    // 本日已因设伏开战
  Time.advanceMinutes(1440);
  ok(calls.indexOf('raid') === -1, 'T4 设伏先手时不叠加第二次战棋');
}

// ════════════════ 3) 引擎接线静态校验（防 getter 漏注入 / 编成分叉） ════════════════
{
  const eng = fs.readFileSync(path.join(ROOT, 'shared/core/engine.js'), 'utf8');
  const fa = fs.readFileSync(path.join(ROOT, 'shared/core/fieldarmy.js'), 'utf8');
  ok(eng.indexOf('getTryFieldRaid: function(){ return tryFieldArmyRaid; }') >= 0,
     'E1 createTime 注入 getTryFieldRaid getter');
  ok(eng.indexOf('window.tryFieldArmyRaid = tryFieldArmyRaid') >= 0, 'E2 调试桥接已暴露');
  ok(eng.indexOf('function fieldArmyFoes(fa)') >= 0 && eng.indexOf('var foes = fieldArmyFoes(fa);') >= 0,
     'E3 迎战与扑击共用同一份敌军编成');
  ok(eng.indexOf('if (ok) FA.markRaided(fa.id);') >= 0, 'E4 只在开战成功后登记冷却');
  ok(fa.indexOf('下期在 near()') === -1 && eng.indexOf('接战留待下期') === -1,
     'E5 误导性「下期再接」注释已清理');
}

console.log('=== 敌军扑击回归：' + pass + ' PASS / ' + fail + ' FAIL ===');
if (fail) { console.log('FIELD RAID REGRESSION: FAIL'); process.exit(1); }
console.log('FIELD RAID REGRESSION: PASS（候选/冷却 / 跨日链 / 设伏优先 / 引擎接线）');

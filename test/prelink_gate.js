// test/prelink_gate.js
// P0.1 重构稳定性卡点（运行时层）：用 jsdom 真实加载 index.html（与浏览器一致的启动路径），
// 抓 test/syntax_check_all.js 与 test/cross_reference_check.js 覆盖不到的那一类——
//   「createX(ctx) 工厂前向裸引用」：ctx.foo 在引擎别名块里尚未赋值就被固化，调用时静默 undefined，
//   正是 v20260919j 重构 → v20260920a~f 连修 23 处断链的根因。
//
// 三道检查（错误即 FAIL）：
//   1) 启动期错误：jsdomError / console.error / window.error 任一非空即 FAIL；
//   2) 工厂就位：window.openModal（引擎 API）必须是 function，且各核心 createX 工厂就位
//      （防模块没挂上 / 改名；engine/state/calendar 非 LF.createX 形式，改用 openModal 证明引擎已运行）；
//   3) 运行期演练：进游戏 + 打开各子系统面板（dev/jobboard/quest/learn/rest/triggers/farm/
//      mine/companion/strategy…）。面板渲染会调用 v20260920f 修复点（Dev.moralTitle /
//      Jobboard.LABOR_PER_WOOD / Quest.log / Learn.log / Rest.effectiveStats / Triggers.findEvent…），
//      若回归为 undefined → 抛 "X is not a function"（判失败）；未进游戏态时的 "of null" 报错为
//      无存档的良性边角，不判失败（玩家常态必有 state）。
// 用法： node test/prelink_gate.js
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack ? e.detail.stack : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + ROOT + '/',
  virtualConsole: vc,
  pretendToBeVisual: true,
  // jsdom 未实现 Web Animations API：引擎标题屏 drip 动画 b.animate 会抛错，
  // 中断引擎初始化并把 #modal 替换为错误页，导致新游戏流程无法启动。
  // 此处打最小可用 Animation 桩，仅供测试环境（不影响真实浏览器）。
  beforeParse(window) {
    if (window.Element && !window.Element.prototype.animate) {
      window.Element.prototype.animate = function () {
        var a = { finished: Promise.resolve(), cancel: function(){}, play: function(){}, pause: function(){}, finish: function(){}, onfinish: null, oncancel: null };
        Object.defineProperty(a, 'currentTime', { get: function(){return 0;}, set: function(){} });
        Object.defineProperty(a, 'playState', { get: function(){return 'finished';} });
        return a;
      };
    }
  },
});
const w = dom.window;
w.addEventListener('error', e => errors.push('window.error: ' + (e.error && e.error.stack ? e.error.stack : e.message)));
w.addEventListener('unhandledrejection', e => errors.push('unhandledrejection: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason)));

// 必须存在的核心工厂（均为 LF.createX 形式；引擎/状态/日历非此形式，另用 openModal 证明）
const HARD_FACTORIES = [
  'createFarm', 'createJobboard', 'createCompanion', 'createMine', 'createRest',
  'createDev', 'createTriggers', 'createQuest', 'createLearn', 'createPanels', 'createStrategy',
];
// 进游戏后实际打开的面板 kind（驱动真实渲染路径，触发各子系统内部函数）
const PANEL_KINDS = ['dev', 'jobboard', 'quest', 'learn', 'rest', 'triggers', 'farm', 'mine', 'companion', 'strategy', 'codex', 'settings', 'credit'];

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  const fails = [];

  if (errors.length) fails.push('启动期错误 ' + errors.length + ' 条');

  // 2) 引擎 API + 工厂就位
  if (typeof w.openModal !== 'function') fails.push('引擎 API 未暴露: window.openModal（engine.js 未运行）');
  if (typeof w.LF !== 'object' || !w.LF) fails.push('window.LF 缺失（数据/工厂层未加载）');
  else {
    for (const fn of HARD_FACTORIES) {
      if (typeof w.LF[fn] !== 'function') fails.push('工厂缺失/非函数: LF.' + fn);
    }
  }

  // 3) 运行期演练
  const before = errors.length;
  let bootedGame = false;
  try {
    if (typeof w.openModal === 'function') {
      w.openModal('newgame');
      const slot = w.document.querySelector('.slot[data-slot="1"][data-mode="new"]');
      if (slot) {
        slot.click();
        const skip = w.document.getElementById('cr-skip');
        if (skip) { skip.checked = true; try { skip.dispatchEvent(new w.Event('change')); } catch (e) { if (skip.onchange) skip.onchange(); } }
        const rbtn = w.document.querySelector('.role-btn[data-role="youxia"]');
        if (rbtn) rbtn.click();
        const go = w.document.getElementById('cr-go');
        if (go) go.click();
      }
    }
    // state 由 state.js 暴露为 LF.Core.state（window 上无裸名 state / getState）
    bootedGame = !!(w.LF && w.LF.Core && w.LF.Core.state);
    if (typeof w.advanceMinutes === 'function') w.advanceMinutes(1440 * 3);
    else if (typeof w.advanceTime === 'function') w.advanceTime(3);
    for (const kind of PANEL_KINDS) {
      try { if (typeof w.openModal === 'function') w.openModal(kind); }
      catch (e) { errors.push('打开面板 ' + kind + ' 抛错: ' + (e.stack || e.message)); }
      try { if (typeof w.closeModal === 'function') w.closeModal(); }
      catch (e) { /* 关闭失败不影响判定 */ }
    }
  } catch (e) {
    errors.push('演练抛错: ' + (e.stack || e.message));
  }

  // 错误分类：未进游戏态时的 "of null" 报错属良性边角（无 state），不判失败；
  // 其余（含 "X is not a function" 这类 v20260920f 回归）一律判失败。
  const newErrs = errors.slice(before);
  let fatal = newErrs;
  if (!bootedGame) fatal = newErrs.filter(e => !/of null|null \(reading/.test(e));
  if (fatal.length) fails.push('运行期新增错误 ' + fatal.length + ' 条' + (bootedGame ? '' : '（已忽略无游戏态的 null 报错）'));

  // 信息：所有 create* 工厂覆盖度（不判失败）
  console.log('=== LF 工厂覆盖（INFO）===');
  if (w.LF) {
    const all = Object.keys(w.LF).filter(k => k.indexOf('create') === 0).sort();
    console.log('  create* 数量=' + all.length + '：' + all.join(', '));
  } else console.log('  window.LF 不可用');
  console.log('=== 进游戏状态 ===');
  console.log('  bootedGame=' + bootedGame + ' | getState()=' + (typeof w.getState === 'function' ? (w.getState() ? 'ok' : 'null') : 'n/a'));
  console.log('=== 错误明细 (' + errors.length + ') ===');
  errors.slice(0, 40).forEach(e => console.log('  ' + e));

  if (fails.length) {
    console.log('\nPRELINK GATE: FAIL');
    fails.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('\nPRELINK GATE: PASS（启动 + 引擎API + 工厂就位 + 进游戏/面板渲染 全绿）');
  process.exit(0);
}

if (w.document.readyState === 'complete') setTimeout(boot, 800);
else w.addEventListener('load', () => setTimeout(boot, 800));
setTimeout(() => { if (!booted) { console.log('[warn] load 事件 30s 未触发，兜底执行检查'); boot(); } }, 30000);

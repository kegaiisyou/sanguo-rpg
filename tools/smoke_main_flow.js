// -*- coding: utf-8 -*-
/**
 * 主流程冒烟测试（headless 真实浏览器）。
 *
 * 目的：每次改完代码跑一遍，自动抓「界面卡死 / 加载崩溃 / 关键路径走不通」。
 * 覆盖：加载无致命错误 → 新游戏入口可用 → 序章 → 苦役营牢房夺营 → 战斗
 *       （核心回归：战斗指令不被对话框遮挡）→ 战斗循环不卡死 → 脱逃进入大世界。
 *
 * 用法： node tools/smoke_main_flow.js
 * 依赖： playwright（devDependency）。浏览器自动探测本机 ms-playwright chromium；
 *       可用环境变量 SMOKE_CHROME_PATH 强制指定 chrome.exe。
 *
 * 退出码： 0 通过 / 1 失败（卡死 / 致命 JS 错误 / 关键断言不达标）。
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8124;
const ROOT = process.cwd();

function startServer() {
  return spawn('python', ['serve_nocache.py'], { cwd: ROOT, stdio: 'ignore' });
}
function waitServer() {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    (function poll() {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/index.html' }, () => res());
      req.on('error', () => { if (Date.now() - t0 > 15000) rej(new Error('server timeout')); else setTimeout(poll, 300); });
    })();
  });
}
function findChrome() {
  const base = process.env.LOCALAPPDATA + '\\ms-playwright';
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium-') && !d.includes('headless'));
    for (const d of dirs.sort().reverse()) {
      const p = path.join(base, d, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  return process.env.SMOKE_CHROME_PATH || null;
}

// ---- 状态快照 ----
async function snap(p) {
  return await p.evaluate(() => {
    const g = (id) => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const map = (sel) => [...document.querySelectorAll(sel)]
      .filter(x => x.getBoundingClientRect().width > 0 && x.textContent && x.textContent.trim())
      .map(x => ({ c: (x.className || '').toString().slice(0, 24), t: x.textContent.trim().slice(0, 20), x: Math.round(x.getBoundingClientRect().x + x.getBoundingClientRect().width / 2), y: Math.round(x.getBoundingClientRect().y + x.getBoundingClientRect().height / 2) }));
    let room = null, inCombat = false;
    try { room = LF.Core.state.room; inCombat = document.getElementById('app').classList.contains('in-combat'); } catch (e) {}
    return {
      room, inCombat, dlg: g('dlg-state'),
      narr: (g('narr') || '').slice(0, 60),
      btns: map('.cb-menu, #dlg-foot button, .tut-ask button, .dlg-ask button, #dlg-body button, .dlg-opt').slice(0, 14),
      bodyHasJail: /牢|铁链|苦役/.test(g('narr') || document.body.innerText),
    };
  });
}
// 推进打字机（点对话框区直到「说话中」结束）
async function tapType(p, max) {
  for (let i = 0; i < (max || 40); i++) {
    const st = await p.evaluate(() => { const e = document.getElementById('dlg-state'); return e ? e.textContent : ''; });
    if (!st || !/说话中/.test(st)) break;
    await p.mouse.click(196, 430).catch(() => {});
    await p.waitForTimeout(380);
  }
}
// 核心回归：进入战斗的第一回合，检查战斗指令按钮的真实命中元素是否被 #dlg 遮挡
async function checkCombatNotBlocked(p) {
  return await p.evaluate(() => {
    const app = document.getElementById('app');
    if (!app || !app.classList.contains('in-combat')) return 'NOT_IN_COMBAT';
    const acts = document.querySelectorAll('#actions .cb-menu, #actions .act');
    if (!acts.length) return 'NO_ACTION_BTNS';
    const r = acts[0].getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    let n = top;
    while (n && n !== document.body) {
      if (n.id === 'dlg-foot') return 'BLOCKED_BY_DLG_FOOT';
      if (n.id === 'dlg' && getComputedStyle(n).display !== 'none') return 'BLOCKED_BY_DLG';
      if (n.classList && (n.classList.contains('cb-menu') || n.classList.contains('act') || n.id === 'actions')) return 'OK_HIT_ACTION';
      n = n.parentElement;
    }
    return 'UNKNOWN:' + (top ? (top.className || top.tagName) : 'null');
  });
}

const log = (...a) => console.log('[smoke]', ...a);
const CENTER = [196, 430];

(async () => {
  const server = startServer();
  await waitServer();
  const browser = await chromium.launch({ headless: true, executablePath: findChrome() || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const fatal = [];
  page.on('pageerror', e => fatal.push('PAGEERR: ' + (e.stack || e.message)));

  const fail = (msg) => { log('FAIL:', msg); if (fatal.length) log('FATAL:', fatal); server.kill(); browser.close(); process.exit(1); };

  try {
    // === 阶段 0：加载 ===
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.LF && window.LF.CONSTANTS, { timeout: 20000 });
    const version = await page.evaluate(() => window.LF.CONSTANTS.VERSION);
    log('loaded, VERSION =', version);

    // === 阶段 1：新游戏入口 ===
    await page.click('#t-start');
    await page.waitForTimeout(500);
    await page.click('.slot[data-slot="1"]');
    await page.waitForTimeout(500);
    await page.fill('#cr-name', '冒烟客').catch(() => {});
    await page.click('.role-btn[data-role="youxia"]').catch(() => {});
    await page.click('#cr-go');
    await page.waitForFunction(() => window.LF && LF.Core && LF.Core.state && LF.Core.state.room, { timeout: 15000 }).catch(() => {});
    const entered = await page.evaluate(() => (window.LF && LF.Core.state && LF.Core.state.room) || null);
    if (!entered) return fail('新游戏后未进入游戏（state.room 为空）');
    log('entered game, room =', entered);

    // === 阶段 2：推进序章（真实点击，直到进入牢房/出现对话选项）===
    let reachedJail = false;
    for (let i = 0; i < 30; i++) {
      const s = await snap(page);
      if (s.bodyHasJail || (s.btns && s.btns.length) || s.inCombat) { reachedJail = true; log('序章结束，进入牢房/教程'); break; }
      await page.mouse.click(CENTER[0], CENTER[1]).catch(() => {});
      await page.waitForTimeout(500);
    }
    if (!reachedJail) return fail('序章未能推进到牢房（可能卡在开场叙事）');

    // === 阶段 3：主循环（选项 / 普攻 / 脱逃）===
    let combatChecked = false, leftCamp = false, prev = '', stalled = 0;
    for (let step = 0; step < 100; step++) {
      const s = await snap(page);
      if (s.room && s.room !== 'camp_tz1' && !s.inCombat) { leftCamp = true; log('LEFT CAMP ->', s.room); break; }
      // 进入战斗的第一回合做遮挡回归
      if (s.inCombat && !combatChecked) {
        combatChecked = true;
        const occ = await checkCombatNotBlocked(page);
        log('combat entered, occlusion check =', occ);
        if (occ !== 'OK_HIT_ACTION') return fail('战斗指令被遮挡，无法点击（历史卡死 bug 复现）：' + occ);
      }
      if (s.inCombat) {
        const atk = s.btns.find(b => /普攻|攻击/.test(b.t));
        if (atk) { await page.mouse.click(atk.x, atk.y).catch(() => {}); await page.waitForTimeout(800); continue; }
      }
      const choice = s.btns.find(b => /^(\d)?\[?[（(]/.test(b.t) || b.t.includes('〔') || /请择一|确定|继续/.test(b.t));
      if (choice) { await page.mouse.click(choice.x, choice.y).catch(() => {}); await page.waitForTimeout(1200); await tapType(page, 25); continue; }
      const key = s.room + '|' + s.narr + '|' + JSON.stringify(s.btns.map(b => b.t));
      if (key === prev) { stalled++; if (stalled > 4) return fail('流程停滞（连续 ' + stalled + ' 步无进展）: ' + JSON.stringify(s)); }
      else stalled = 0;
      prev = key;
      await tapType(page, 25);
      await page.mouse.click(CENTER[0], CENTER[1]).catch(() => {});
      await page.waitForTimeout(500);
    }
    if (!combatChecked) return fail('始终未进入战斗，无法验证战斗遮挡回归');
    if (!leftCamp) return fail('未能脱逃出苦役营（夺营流程未走通）');

    // === 阶段 4：脱逃后抵达大世界，处理可能的升级弹窗 ===
    await page.waitForTimeout(1500);
    await tapType(page, 20);
    for (let i = 0; i < 4; i++) {
      const hasModal = await page.evaluate(() => { const m = document.querySelector('#modal-card'); return m && !m.hasAttribute('hidden'); });
      if (!hasModal) break;
      await page.evaluate(() => { const btn = document.querySelector('#modal-card .m-close, #modal-card button'); if (btn) btn.click(); }).catch(() => {});
      await page.waitForTimeout(700);
    }
    const finalRoom = await page.evaluate(() => LF.Core.state.room);
    log('final room =', finalRoom, '| fatal errors =', fatal.length);
    if (fatal.length) return fail('存在未捕获 JS 异常');
    log('SMOKE OK ✅  版本', version, '| 战斗遮挡回归通过 | 已脱逃至', finalRoom);
    server.kill(); await browser.close(); process.exit(0);
  } catch (e) {
    return fail('异常：' + e.message);
  }
})();

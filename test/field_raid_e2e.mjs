// 手动真机脚本（不入 npm test）：需先在项目根跑 `python serve_nocache.py`（8124），
// 并装好 playwright-core + 本机 chrome-headless-shell；然后 `node test/field_raid_e2e.mjs`。
// 注意：教学期 body.onb / 叙事帘 / askPending 会按设计拦住 interactBusy，
//       故先按 dev 调试同款手法置 onb.done，再真实点完对话选项、等叙事队列清空。
import { chromium } from 'playwright-core';
const EXE = 'C:/Users/Administrator/.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe';
const URL = 'http://127.0.0.1:8124/index.html';
const L = []; const say = (...a) => L.push(a.map(String).join(' '));
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const results = [];

for (const vp of [{ width:1280, height:820, tag:'desktop' }, { width:390, height:844, tag:'mobile' }]) {
  const ctx = await browser.newContext({ viewport:{ width:vp.width, height:vp.height }, hasTouch:vp.tag==='mobile', isMobile:vp.tag==='mobile' });
  const page = await ctx.newPage();
  const errs = [], cerrs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') cerrs.push(m.text()); });
  await page.goto(URL, { waitUntil:'load', timeout:30000 });
  await page.waitForTimeout(1200);

  const bridge = await page.evaluate(() => ({
    raid: typeof window.tryFieldArmyRaid,
    raidCheck: !!(window.LF && window.LF.FieldArmy && window.LF.FieldArmy.raidCheck),
    markRaided: !!(window.LF && window.LF.FieldArmy && window.LF.FieldArmy.markRaided),
    cd: window.LF && window.LF.FieldArmy && window.LF.FieldArmy.RAID_COOLDOWN_DAYS,
    ver: window.LF && window.LF.CONSTANTS && window.LF.CONSTANTS.VERSION
  }));
  say(vp.tag, 'BRIDGE', JSON.stringify(bridge));
  let ok = bridge.raid === 'function' && bridge.raidCheck && bridge.markRaided && bridge.cd === 3 && bridge.ver === '20261116a';
  say(vp.tag, 'T_BRIDGE', ok ? 'PASS' : 'FAIL');

  await page.evaluate(() => { try { window.enterGame(undefined, 0, false); } catch (e) {} });
  await page.waitForTimeout(600);
  // 教学毕业（与 dev.js 调试按钮同款），让时钟流动、UI 显露
  await page.evaluate(() => {
    const st = window.getState && window.getState();
    if (st && st.flags && st.flags.onb) st.flags.onb.done = true;
    document.body.classList.remove('onb');
  });
  // 真实点完对话选项；叙事帘本身点击 = 快进打字机
  for (let i = 0; i < 14; i++) {
    const r = await page.evaluate(() => {
      const veil = document.getElementById('dlg-veil');
      const sels = '.onb-choices button, #dlg-foot button, #dlg-veil button, .dlg-choice';
      const bs = Array.from(document.querySelectorAll(sels)).filter(b => b.getClientRects().length);
      if (bs.length) { bs[0].click(); return 'choice:' + (bs[0].textContent||'').trim().slice(0,16); }
      if (veil && getComputedStyle(veil).display !== 'none' && !veil.classList.contains('hidden')) { veil.click(); return 'skip'; }
      return 'idle';
    });
    if (r === 'idle') break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(2600);   // 叙事行间 150ms + 打字机，等队列清空

  const fired = await page.evaluate(() => {
    const st = window.getState && window.getState();
    const FA = window.LF && window.LF.FieldArmy;
    if (!st || !FA || !FA.raidCheck) return { err:'no state/FA' };
    const cid = st.flags && st.flags.cityPos && st.flags.cityPos.cid;
    const c = cid && window.LF.CITIES && window.LF.CITIES[cid];
    if (!c || !c.pos) return { err:'no player pos' };
    st.flags.fieldArmies = [{
      id:'faE2E', fid:'caocao', name:'曹军·掠境军', hostile:true, status:'marching',
      power:400, morale:78, prog:0.2, speed:0.1, grain:12, ttl:12,
      pos:[c.pos[0] + 0.05, c.pos[1]], from:cid, to:cid,
      troops:[{ type:'changqiang', count:400 }]
    }];
    st.flags.faRaidDay = null;
    const cand = FA.raidCheck(c.pos);
    let seenPos = null;
    const orig = FA.raidCheck;
    FA.raidCheck = function (p) { seenPos = p; return orig.call(FA, p); };
    const oldRandom = Math.random; Math.random = () => 0;
    let ret, err = null;
    try { ret = window.tryFieldArmyRaid(); } catch (e) { err = e.message; }
    Math.random = oldRandom;
    FA.raidCheck = orig;
    const setup = document.getElementById('bf-setup');
    const modal = document.getElementById('modal');
    return { cand: cand && cand.id, seenPos: seenPos ? 'ok' : 'not-called', ret, err,
      setupVisible: !!(setup && getComputedStyle(setup).display !== 'none'),
      modalVisible: !!(modal && !modal.className.includes('hidden')),
      raided: !!(st.flags.fieldArmies[0] && st.flags.fieldArmies[0].raided),
      body: document.body.className,
      veil: (()=>{const v=document.getElementById('dlg-veil');return v?getComputedStyle(v).display:'none';})() };
  });
  say(vp.tag, 'FIRE', JSON.stringify(fired));
  const okFire = fired.cand === 'faE2E' && fired.seenPos === 'ok' && fired.ret === true
                 && !fired.err && fired.setupVisible && fired.raided;
  say(vp.tag, 'T_FIRE', okFire ? 'PASS' : 'FAIL');

  // 跨日链在真实 bundle 里再跑一次：时钟已流动，day 应前进且无异常
  const dayTick = await page.evaluate(() => {
    const before = window.getState && window.getState().day;
    let err = null;
    try { window.advanceMinutes(1440); } catch (e) { err = e.message; }
    return { before, after: window.getState && window.getState().day, err };
  });
  say(vp.tag, 'DAY_TICK', JSON.stringify(dayTick));
  const okDay = !dayTick.err && dayTick.after > dayTick.before;
  say(vp.tag, 'T_DAY', okDay ? 'PASS' : 'FAIL');

  const realCerrs = cerrs.filter(t => !/ERR_CONNECTION_RESET|favicon|net::ERR/i.test(t));
  say(vp.tag, 'ERRORS', 'pageerror=' + errs.length, 'consoleError=' + realCerrs.length, errs.slice(0,3).join(' | '), realCerrs.slice(0,3).join(' | '));
  const okErr = errs.length === 0 && realCerrs.length === 0;
  say(vp.tag, 'T_ERR', okErr ? 'PASS' : 'FAIL');
  results.push(ok && okFire && okDay && okErr);
  await ctx.close();
}
await browser.close();
say('ALL', results.every(Boolean) ? 'PASS' : 'FAIL');
console.log(L.join('\n'));
if (!results.every(Boolean)) process.exitCode = 1;

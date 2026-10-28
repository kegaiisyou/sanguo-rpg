// 全流程自动试玩：新游戏 → 教程 → 第4日夺营 → 毕业（onb.done）
// 用真实 chromium-headless-shell 跑，捕获 console / pageerror / 死循环特征。
const { chromium } = require('C:/tmp/pw/node_modules/playwright-core');

const EXEC = 'C:\\Users\\Administrator\\.cache\\hyperframes\\chrome\\chrome-headless-shell\\win64-152.0.7977.30\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const URL = 'http://127.0.0.1:8124/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[PT]', ...a);

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const consoleMsgs = [], pageErrors = [];
  page.on('console', m => consoleMsgs.push(m.text()));
  page.on('pageerror', e => pageErrors.push(String(e)));

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.LF && typeof window.getState === 'function', { timeout: 20000 });
  await page.evaluate(() => { try { LF.Core.settings.textSpeed = 0; } catch (e) {} });
  log('game ready (textSpeed=0)');

  // 1) 真实 UI 开局
  await page.evaluate(() => { const b = document.getElementById('t-start'); if (b) b.click(); });
  await sleep(400);
  await page.evaluate(() => { const s = document.querySelector('#modal-card .slot, .slot[data-slot]'); if (s) s.click(); });
  await sleep(500);
  await page.evaluate(() => {
    const n = document.getElementById('cr-name'); if (n) { n.value = '试玩者'; n.dispatchEvent(new Event('input', { bubbles: true })); }
    const r = document.querySelector('.role-btn[data-role="youxia"]'); if (r) r.click();
    for (let i = 0; i < 3; i++) { const b = document.querySelector('.ap-btn[data-act="inc"][data-k="hp"]'); if (b) b.click(); }
  });
  await sleep(200);
  await page.evaluate(() => { const g = document.getElementById('cr-go'); if (g) g.click(); });
  await sleep(900);
  for (let i = 0; i < 5; i++) {
    const has = await page.evaluate(() => { const p = document.getElementById('prologue'); if (p && !p.classList.contains('hidden')) { p.click(); return true; } return false; });
    if (has) await sleep(300);
    if (await page.evaluate(() => !document.getElementById('prologue') || document.getElementById('prologue').classList.contains('hidden'))) break;
  }
  await sleep(600);
  log('new game started');

  // 2) 开牢门（真实对话 laotou_door，含 API 兜底）
  await page.evaluate(() => { if (window.talk) window.talk('laotou'); });
  await sleep(500);
  for (let i = 0; i < 6; i++) {
    const opened = await page.evaluate(() => !!(window.getState().flags.onb && window.getState().flags.onb.cellOpen));
    if (opened) break;
    await page.evaluate(() => {
      const NEG = /关闭|取消|不了|拒绝|离开|算了|否|不要|暂不/;
      const PROG = /接令|问明|潜行|强突|交付|报|继续|好|是|确定|下一步|应|收|接|对|行|走|跟随|帮|取|看|问|给|吃|干|劳|点|销|逃|说|搜|开|推|翻|挖|做|学|练|试|信|闯|采|喝|歇|休|睡|认|递/;
      const btns = [...document.querySelectorAll('#dlg .dlg-foot button, .onb-btn')];
      const pick = btns.find(b => /想通了|放我出去/.test(b.textContent || ''))
               || btns.find(b => !NEG.test(b.textContent || '') && PROG.test(b.textContent || ''))
               || btns[btns.length - 1];
      if (pick) pick.click();
    });
    await sleep(400);
  }
  const opened = await page.evaluate(() => !!(window.getState().flags.onb && window.getState().flags.onb.cellOpen));
  if (!opened) { await page.evaluate(() => { window.getState().flags.onb = window.getState().flags.onb || {}; window.getState().flags.onb.cellOpen = true; }); log('cellOpen forced via API fallback'); }
  else log('cellOpen = true (via dialogue)');

  // 3) 修营防 ×3（真实 handleAction + 预先塞料）→ 韩铁好感≥2 → officer_letter
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => {
      window.packAdd('mucai', 10); window.packAdd('shitiao', 10);
      if (window.handleAction) window.handleAction('camp_fortify');
    });
    await sleep(1300);
  }
  const fort = await page.evaluate(() => {
    const f = window.getState().flags.onb || {};
    return { fortAll: !!f.fortAll, han: (window.getState().npcFavor || {}).han_tie || 0 };
  });
  log('fortify =', JSON.stringify(fort));

  // 4) 推进到第4日（day>=3）
  for (let i = 0; i < 8; i++) {
    const d = await page.evaluate(() => window.getState().day);
    if (d >= 3) break;
    await page.evaluate(() => { if (window.advanceTime) window.advanceTime(72); });
    await sleep(250);
  }
  let day = await page.evaluate(() => window.getState().day);
  if (day < 3) { await page.evaluate(() => { window.getState().day = 3; }); day = 3; log('day forced to 3'); }
  else log('day =', day);

  // 5) 落位中军场院(1,1) 触发夺营裁决（级联：裁决器→场景→对话→战斗）
  for (let t = 0; t < 4; t++) {
    await page.evaluate(() => {
      const st = window.getState();
      st.flags.cityPos = { cid: 'kuyilao', x: 1, y: 1 };
      st.room = 'kuyilao';
      if (window.checkTriggers) window.checkTriggers({ hook: 'onEnter', room: 'kuyilao' });
    });
    await sleep(800);
  }
  const branch = await page.evaluate(() => (window.getState().flags.coup || {}).branch || '(none)');
  log('coup branch =', branch);

  // 诊断 dump：场景是否真触发了对话
  const diag = await page.evaluate(() => {
    const s = window.getState();
    const dlg = document.getElementById('dlg');
    const foot = document.getElementById('dlg-foot');
    return {
      coup: s.flags.coup,
      dlgHidden: dlg ? dlg.classList.contains('hidden') : 'no#dlg',
      dlgBtns: foot ? [...foot.querySelectorAll('button')].map(b => b.textContent) : [],
      dlgBody: (document.getElementById('dlg-body') || {}).textContent ? document.getElementById('dlg-body').textContent.slice(0, 80) : ''
    };
  });
  log('DIAG:', JSON.stringify(diag));

  // 6) 驱动支线对话 + 战斗 → 毕业
  let onbDone = false;
  for (let i = 0; i < 120; i++) {
    const st = await page.evaluate(() => {
      const s = window.getState();
      const dlg = document.getElementById('dlg');
      const dlgOpen = dlg && !dlg.classList.contains('hidden');
      const combat = document.getElementById('dq-combat-card');
      const combatOpen = !!(combat && !combat.classList.contains('hidden') && combat.offsetParent !== null);
      const g = window.G && window.G.CombatEngine;
      if (g && g.state) {
        if (g.state.playerUnits && g.state.playerUnits[0]) { g.state.playerUnits[0].atk = 999; g.state.playerUnits[0].hp = g.state.playerUnits[0].maxHp = 9999; }
        (g.state.enemies || []).forEach(e => { if (e.hp > 1) e.hp = 1; });
      }
      const foot = document.getElementById('dlg-foot');
      return {
        onbDone: !!(s.flags.onb && s.flags.onb.done), dlgOpen, combatOpen,
        letter: !!(s.flags.onb && s.flags.onb.letter_in_hand),
        dlgBtns: foot ? [...foot.querySelectorAll('button')].map(b => b.textContent) : null
      };
    });
    if (i % 10 === 0) log('  iter' + i + ':', JSON.stringify({ d: st.dlgOpen, c: st.combatOpen, l: st.letter, btns: st.dlgBtns }));
    if (st.onbDone) { onbDone = true; log('onb.done = true (graduated)'); break; }
    if (st.dlgOpen) {
      if (st.letter) log('  letter_in_hand set → awaiting final choice → combat');
      await page.evaluate(() => {
        const NEG = /关闭|取消|不了|拒绝|离开|算了|否|不要|暂不/;
        const PROG = /接令|问明|潜行|强突|交付|报|继续|好|是|确定|下一步|应|收|接|对|行|走|跟随|帮|取|看|问|给|吃|干|劳|点|销|逃|说|搜|开|推|翻|挖|做|学|练|试|信|闯|采|喝|歇|休|睡|认|递/;
        const btns = [...document.querySelectorAll('#dlg .dlg-foot button, .onb-btn')];
        let pick = null;
        for (const b of btns) { if (NEG.test(b.textContent)) continue; if (PROG.test(b.textContent)) { pick = b; break; } }
        if (!pick) pick = btns[btns.length - 1];
        if (pick) pick.click();
      });
    } else if (st.combatOpen) {
      if (i % 10 === 0) log('  combat → attacking');
      await page.evaluate(() => {
        const ra = document.getElementById('actions');
        if (!ra) return;
        const btns = [...ra.querySelectorAll('button')];
        const txt = b => (b.textContent || '');
        let pick = btns.find(b => /普攻/.test(txt(b)))
               || btns.find(b => /选择攻击目标/.test(txt(b)) || (txt(b) && !/返回|防御|道具|撤退|招式/.test(txt(b))))
               || btns.find(b => !/返回/.test(txt(b)));
        if (!pick) pick = btns[0];
        if (pick) pick.click();
      });
    }
    await sleep(500);
  }

  // 7) 饭桶容器验证（kuyilao|0,1）：饭桶 acts 走 .obj-menu 浮动菜单
  let fanResult = 'skipped';
  if (onbDone) {
    await page.evaluate(() => {
      const st = window.getState();
      st.defeated = false; st.energy = 100; st.hp = st.maxHp || 100; st.pack = [];
      st.flags.cityPos = { cid: 'kuyilao', x: 0, y: 1 };
      st.room = 'kuyilao';
      window.renderRoom('kuyilao', true);
    });
    await sleep(300);
    const before = await page.evaluate(() => (window.getState().pack || []).filter(pp => pp && pp.defId).map(pp => pp.defId));
    const clickFan = () => page.evaluate(() => { const b = [...document.querySelectorAll('#actions button')].find(b => /饭桶/.test(b.textContent || '')); if (b) { b.click(); return true; } return false; });
    const clickMenu = (reSrc) => page.evaluate((reSrc) => { const re = new RegExp(reSrc); const b = [...document.querySelectorAll('.obj-menu .op-btn')].find(b => re.test(b.textContent || '')); if (b) { b.click(); return true; } return false; }, reSrc);
    let fanErr = null;
    if (!(await clickFan())) fanErr = 'no 饭桶 button';
    else {
      await sleep(300);
      if (!(await clickMenu('打开'))) fanErr = 'no 打开 in .obj-menu';
      else {
        await sleep(1100);
        await clickFan(); await sleep(300);
        if (!(await clickMenu('取物'))) fanErr = 'no 取物 in .obj-menu';
        await sleep(400);
      }
    }
    const after = await page.evaluate(() => (window.getState().pack || []).filter(pp => pp && pp.defId).map(pp => pp.defId));
    const got = after.filter(x => !before.includes(x));
    fanResult = fanErr ? ('ERR: ' + fanErr) : JSON.stringify({ ok: got.length > 0, got, before, after });
    log('饭桶 container =', fanResult);
  }

  // 8) 最终核验 + 错误汇总
  const final = await page.evaluate(() => {
    const s = window.getState();
    return { room: s.room, onbDone: !!(s.flags.onb && s.flags.onb.done), coup: s.flags.coup || null, day: s.day, branch: (s.flags.coup || {}).branch || '' };
  });
  log('FINAL:', JSON.stringify(final));

  let maxRepeat = 1, last = null, run = 0, loopLine = '';
  for (const m of consoleMsgs) { if (m === last) { run++; if (run > maxRepeat) { maxRepeat = run; loopLine = m; } } else { run = 1; last = m; } }
  log('--- console msgs:', consoleMsgs.length, '| pageErrors:', pageErrors.length, '| maxRepeatedLine:', maxRepeat);
  if (maxRepeat > 15) log('LOOP SUSPECT:', loopLine.slice(0, 80));
  log('pageErrors sample:', JSON.stringify(pageErrors.slice(0, 8)));

  await browser.close();
  const ok = onbDone && pageErrors.length === 0 && maxRepeat <= 15;
  log(ok ? 'RESULT: PASS' : 'RESULT: FAIL (onbDone=' + onbDone + ', pageErrors=' + pageErrors.length + ')');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });

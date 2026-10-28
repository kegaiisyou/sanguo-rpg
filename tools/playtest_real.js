// 真实流程试玩（v20261028）：不强制任何 flag，按玩家真实路径走一遍。
//   出牢 → 点卯 → 仓库取材(翻找/卸料) → 军营修营防×3 → 歇息过夜×N → 第4日中军场院夺营 → 毕业
// 目的：暴露「强制式」脚本掩盖的真实卡点（日子推不动 / 材料拿不到 / 分支拿不到 / 毕业不了）。
const { chromium } = require('C:/tmp/pw/node_modules/playwright-core');
const EXEC = 'C:\\Users\\Administrator\\.cache\\hyperframes\\chrome\\chrome-headless-shell\\win64-152.0.7977.30\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const URL = 'http://127.0.0.1:8124/index.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[REAL]', ...a);

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.LF && typeof window.getState === 'function', { timeout: 20000 });
  await page.evaluate(() => { try { LF.Core.settings.textSpeed = 0; } catch (e) {} });

  // ---------- helpers ----------
  const S = () => page.evaluate(() => {
    const s = window.getState();
    return {
      room: s.room, day: s.day, hour: s.time, clock: s.clock,
      cellOpen: !!(s.flags.onb && s.flags.onb.cellOpen),
      curfewSet: !!(s.flags.onb && s.flags.onb.curfewSet),
      clockOn: !!(s.flags.onb && s.flags.onb.clockOn),
      onbDone: !!(s.flags.onb && s.flags.onb.done),
      pos: s.flags.cityPos,
      han: (s.npcFavor || {}).han_tie || 0,
      fort: (s.flags.onb && s.flags.onb.fort) || {},
      fortAll: !!(s.flags.onb && s.flags.onb.fortAll),
      energy: s.energy, hp: s.hp, food: s.food, drink: s.drink,
      pack: (s.pack || []).filter(p => p && p.defId).map(p => p.defId + 'x' + (p.count || 1))
    };
  });
  // 走到某格（等价于玩家在网格里移动：落位 + 触发 onEnter）
  const goto = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const s = window.getState();
      s.flags.cityPos = { cid: 'kuyilao', x: x, y: y };
      s.room = 'kuyilao';
      if (window.renderRoom) window.renderRoom('kuyilao', true);
    }, { x, y });
    await sleep(250);
    await page.evaluate(() => { if (window.checkTriggers) window.checkTriggers({ hook: 'onEnter', room: 'kuyilao' }); });
    await sleep(250);
  };
  const clickAct = (re) => page.evaluate((src) => {
    const re = new RegExp(src);
    const b = [...document.querySelectorAll('#actions button')].find(b => re.test(b.textContent || ''));
    if (b) { b.click(); return true; }
    return false;
  }, re.source);
  // 场景物件：点物件按钮 → .obj-menu 里点动作
  const objAct = async (objRe, actRe) => {
    const ok1 = await page.evaluate((src) => {
      const re = new RegExp(src);
      const b = [...document.querySelectorAll('#actions button')].find(b => re.test(b.textContent || ''));
      if (b) { b.click(); return true; }
      return false;
    }, objRe.source);
    if (!ok1) return 'no-obj';
    await sleep(250);
    const ok2 = await page.evaluate((src) => {
      const re = new RegExp(src);
      const b = [...document.querySelectorAll('.obj-menu .op-btn')].find(b => re.test(b.textContent || ''));
      if (b) { b.click(); return true; }
      return false;
    }, actRe.source);
    await sleep(300);
    return ok2 ? 'ok' : 'no-act';
  };
  const listActs = () => page.evaluate(() => [...document.querySelectorAll('#actions button')].map(b => (b.textContent || '').trim()));
  // 对话：优先点指定文案，否则点第一个「正向」选项
  const dlgPick = (preferRe, tries) => page.evaluate(({ src, n }) => {
    const btns = [...document.querySelectorAll('#dlg-foot button, .onb-btn')];
    const re = src ? new RegExp(src) : null;
    if (re) { const b = btns.find(x => re.test(x.textContent || '')); if (b) { b.click(); return 'prefer:' + (b.textContent || '').trim(); } }
    const NEG = /取消|不了|算了|拒绝|离开|收工/;
    const b = btns.find(x => !NEG.test(x.textContent || ''));
    if (b) { b.click(); return 'first:' + (b.textContent || '').trim(); }
    return 'none';
  }, { src: preferRe ? preferRe.source : null, n: tries || 0 });
  const dlgOpen = () => page.evaluate(() => {
    const d = document.getElementById('dlg');
    return !!(d && !d.classList.contains('hidden'));
  });
  // 推进对话直到关闭（把整段话说完）
  const drainDlg = async (max) => {
    for (let i = 0; i < (max || 8); i++) {
      if (!(await dlgOpen())) break;
      await dlgPick(null, i);
      await sleep(350);
    }
  };
  // 真实歇息：开歇息面板 → 点「酣眠·6时辰」
  const rest = async (h) => {
    const api = await page.evaluate(() => 'openRestModal=' + (typeof window.openRestModal) + ' dockRest=' + (typeof window.dockRest));
    await page.evaluate(() => { if (window.openRestModal) window.openRestModal('ground'); else if (window.dockRest) window.dockRest(); });
    await sleep(400);
    const diag = await page.evaluate(() => {
      const card = document.getElementById('modal-card');
      const modal = document.getElementById('modal');
      return {
        modalHidden: modal ? modal.classList.contains('hidden') : 'no#modal',
        btns: card ? [...card.querySelectorAll('[data-rest]')].map(b => b.getAttribute('data-rest')) : [],
        head: card ? (card.textContent || '').replace(/\s+/g, ' ').slice(0, 90) : 'no-card'
      };
    });
    const clicked = await page.evaluate((hh) => {
      const b = document.querySelector('#modal-card [data-rest="' + hh + '"]');
      if (b) { b.click(); return true; }
      const any = document.querySelector('#modal-card [data-rest]');
      if (any) { any.click(); return 'fallback'; }
      return false;
    }, h);
    await sleep(700);
    await page.evaluate(() => { if (window.closeModal) window.closeModal(); });
    await sleep(250);
    return { clicked: clicked, api: api, diag: diag };
  };

  // ---------- 1) 真实 UI 开局 ----------
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
  for (let i = 0; i < 6; i++) {
    const p = await page.evaluate(() => { const p = document.getElementById('prologue'); if (p && !p.classList.contains('hidden')) { p.click(); return true; } return false; });
    if (!p) break;
    await sleep(300);
  }
  await sleep(500);
  let s = await S();
  log('开局: room=' + s.room + ' day=' + s.day + ' hour=' + s.hour + ' cellOpen=' + s.cellOpen);

  // ---------- 2) 出牢：牢门·叩门 → 与牢头谈妥 → 推门而出 ----------
  // 玩家此刻在牢房 camp_tz1，牢门是场景物件
  await drainDlg(6);
  let opened = (await S()).cellOpen;
  for (let i = 0; i < 8 && !opened; i++) {
    const r = await objAct(/牢门/, /叩门/);
    if (r === 'no-obj') { log('  !! 牢门物件不在 #actions 里'); }
    await sleep(400);
    await drainDlg(6);
    opened = (await S()).cellOpen;
    if (opened) break;
    // 若没开门，尝试直接找牢头谈
    await page.evaluate(() => { if (window.talk) window.talk('laotou'); });
    await sleep(400);
    await drainDlg(6);
    opened = (await S()).cellOpen;
  }
  log('出牢: cellOpen=' + opened);
  if (!opened) { log('!!! 卡点：牢门开不了 —— 流程在此走不通'); }

  // 推门而出 → 牢区走廊(1,0)（触发 laotou_corridor → 时辰/门禁立规）
  await objAct(/牢门/, /推门而出/);
  await sleep(500);
  await drainDlg(10);
  s = await S();
  log('走廊: pos=' + JSON.stringify(s.pos) + ' curfewSet=' + s.curfewSet + ' clockOn=' + s.clockOn);
  if (!s.curfewSet) { await goto(1, 0); await drainDlg(10); s = await S(); log('补走走廊: curfewSet=' + s.curfewSet); }

  // ---------- 3) 中军场院·验名点卯 ----------
  await goto(1, 1);
  await drainDlg(6);
  const rc = await clickAct(/点卯/);
  await sleep(600);
  await drainDlg(6);
  s = await S();
  log('点卯: clicked=' + rc + ' rollTaught=' + await page.evaluate(() => !!(window.getState().flags.onb && window.getState().flags.onb.rollTaught)));

  // ---------- 4) 真实取材：场院装担 → 仓库卸料（石料）；仓库翻找（木材） ----------
  // 担石闭环：中军场院(1,1)「乱石堆·装担」→ 仓库(2,1)「卸料台·卸料」
  let unloaded = 0;
  for (let k = 0; k < 4; k++) {
    await goto(1, 1);
    const load = await objAct(/乱石堆/, /装担/);
    await sleep(1000);
    await goto(2, 1);
    const unl = await objAct(/卸料台/, /卸料/);
    await sleep(1000);
    if (unl === 'ok') unloaded++;
  }
  // 差役牌摘「仓中翻找」木牍（教程 ④ 第一步：不摘则仓里翻不动）
  await goto(1, 1);
  await objAct(/记工木牌/, /看差役/);
  await sleep(700);
  const took = await page.evaluate(() => {
    const card = document.getElementById('modal-card');
    if (!card) return 'no-card';
    // 木牍默认收起：先点 .job-toggle 展开，再点 .job-take 摘牍（此前误点含文字的容器，活没接成）
    const tg = card.querySelector('.job-toggle[data-job="rummage"]');
    if (tg) tg.click();
    const b = card.querySelector('.job-take[data-job="rummage"]');
    if (!b) {
      const all = [...card.querySelectorAll('[data-job]')].map(x => (x.className || '') + ':' + x.getAttribute('data-job'));
      return 'no-take-btn|' + JSON.stringify(all);
    }
    b.click();
    return 'took';
  });
  await sleep(600);
  await page.evaluate(() => { if (window.closeModal) window.closeModal(); });
  const rs = await page.evaluate(() => !!(window.getState().flags.task && window.getState().flags.task.rummage_started));
  log('差役牌: 摘牍=' + took + ' rummage_started=' + rs);

  // 翻找攒木材：三处轮流 打开→取物；不够就过一夜再翻（营栅3 + 鹿角2 = 5 木材）
  let wood = 0;
  for (let round = 0; round < 6 && wood < 5; round++) {
    await goto(2, 1);
    for (const c of [/木箱/, /货架/, /麻袋堆/]) {
      await objAct(c, /打开/);
      await sleep(950);
      await objAct(c, /取物/);
      await sleep(450);
    }
    const cur = await S();
    const ent = cur.pack.find(x => x.indexOf('mucai') === 0);
    wood = ent ? (parseInt(ent.split('x')[1], 10) || 0) : 0;
    log('  翻找第' + (round + 1) + '轮: 木材=' + wood + ' 行囊=' + JSON.stringify(cur.pack));
    if (wood < 5) await rest(6);
  }
  s = await S();
  log('取材: 卸料次数=' + unloaded + ' 木材=' + wood + ' 行囊=' + JSON.stringify(s.pack));

  // ---------- 5) 军营(0,2)：严石接洽 + 修筑营防×3 ----------
  await goto(0, 2);
  await drainDlg(8);
  await page.evaluate(() => { if (window.buildActions) window.buildActions(window.G.ROOMS[window.getState().room]); });
  await sleep(400);
  let acts = await listActs();
  const fpanel = await page.evaluate(() => {
    const d = document.getElementById('dlg'), m = document.getElementById('modal');
    return { dlgHidden: d ? d.classList.contains('hidden') : '-', modalHidden: m ? m.classList.contains('hidden') : '-' };
  });
  log('军营格动作=' + JSON.stringify(acts) + ' panel=' + JSON.stringify(fpanel));
  for (let k = 0; k < 3; k++) {
    const r = await clickAct(/修筑营防/);
    await sleep(1400);
    await drainDlg(4);
    if (r !== true) { log('  !! 修筑营防按钮不可见/不可点 (第' + (k + 1) + '次)'); }
    const cur = await S();
    log('  修营防' + (k + 1) + ': fort=' + JSON.stringify(cur.fort) + ' 韩铁=' + cur.han + ' 行囊=' + JSON.stringify(cur.pack));
  }
  s = await S();
  log('军营: fortAll=' + s.fortAll + ' 韩铁好感=' + s.han);

  // ---------- 6) 真实过夜：歇息推进到 day>=3 ----------
  let naps = 0;
  for (let i = 0; i < 24; i++) {
    const cur = await S();
    if (cur.day >= 3) break;
    // 夜里回牢再歇（贴合营规）
    const r = await rest(6);
    naps++;
    const after = await S();
    if (naps <= 2) log('  歇息诊断: api=' + r.api + ' clicked=' + r.clicked + ' btns=' + JSON.stringify(r.diag.btns) + ' modalHidden=' + r.diag.modalHidden + ' head=' + r.diag.head);
    if (i % 3 === 0 || after.day !== cur.day) log('  过夜' + naps + ': day ' + cur.day + '→' + after.day + ' 精力=' + after.energy + ' 食=' + after.food + ' 水=' + after.drink);
    if (after.hp <= 0) { log('  !! 饿/渴致死 hp=0'); break; }
  }
  s = await S();
  log('过夜: 共' + naps + '次酣眠 → day=' + s.day + ' hp=' + s.hp + ' 精力=' + s.energy);

  // ---------- 7) 第4日踏入中军场院 → 夺营裁决 ----------
  await goto(1, 1);
  await sleep(600);
  await drainDlg(8);
  const coup = await page.evaluate(() => window.getState().flags.coup || {});
  log('夺营: coup=' + JSON.stringify(coup));

  // ---------- 8) 驱动夺营对话 + 战斗 → 毕业 ----------
  let onbDone = (await S()).onbDone;
  for (let i = 0; i < 140 && !onbDone; i++) {
    const st = await page.evaluate(() => {
      const s = window.getState();
      const dlg = document.getElementById('dlg');
      const dlgUp = !!(dlg && !dlg.classList.contains('hidden'));
      const card = document.getElementById('dq-combat-card');
      const combatUp = !!(card && !card.classList.contains('hidden') && card.offsetParent !== null);
      const g = window.G && window.G.CombatEngine;
      if (g && g.state) {
        if (g.state.playerUnits && g.state.playerUnits[0]) { g.state.playerUnits[0].atk = 999; g.state.playerUnits[0].hp = g.state.playerUnits[0].maxHp = 9999; }
        (g.state.enemies || []).forEach(e => { if (e.hp > 1) e.hp = 1; });
      }
      return { onbDone: !!(s.flags.onb && s.flags.onb.done), dlgUp, combatUp, day: s.day };
    });
    if (st.onbDone) { onbDone = true; break; }
    if (st.dlgUp) {
      await dlgPick(null, i);
    } else if (st.combatUp) {
      await page.evaluate(() => {
        const ra = document.getElementById('actions');
        if (!ra) return;
        const btns = [...ra.querySelectorAll('button')];
        const t = b => (b.textContent || '');
        const pick = btns.find(b => /普攻/.test(t(b))) || btns.find(b => !/返回|防御|道具|撤退/.test(t(b)));
        if (pick) pick.click();
      });
    }
    await sleep(450);
  }
  s = await S();
  const fin = await page.evaluate(() => {
    const s = window.getState();
    return { onbDone: !!(s.flags.onb && s.flags.onb.done), day: s.day, branch: (s.flags.coup || {}).branch || '', coup: s.flags.coup || null };
  });
  log('FINAL: ' + JSON.stringify(fin));
  log('毕业=' + fin.onbDone + ' 分支=' + fin.branch + ' 用时(酣眠)=' + naps + ' pageErrors=' + pageErrors.length);
  if (pageErrors.length) log('errors sample: ' + JSON.stringify(pageErrors.slice(0, 5)));

  await browser.close();
  log(fin.onbDone ? 'REAL RESULT: PASS' : 'REAL RESULT: FAIL (毕业未完成)');
  process.exit(fin.onbDone ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });

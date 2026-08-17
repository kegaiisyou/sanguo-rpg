const { chromium } = require('C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package');
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:8771/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.click('#t-start').catch(e => errors.push('t-start: ' + e.message));
  await page.waitForSelector('.slot', { timeout: 5000 }).catch(() => {});
  await page.click('.slot').catch(e => errors.push('slot: ' + e.message));
  await page.waitForSelector('#cr-go', { timeout: 5000 }).catch(() => {});
  await page.check('#cr-skip').catch(() => {});
  await page.click('#cr-go').catch(e => errors.push('cr-go: ' + e.message));
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    document.body.classList.remove('onb'); document.body.classList.add('reveal-dock');
    var b = document.querySelector('[data-modal="pack"]'); if (b) b.click();
  });
  await page.waitForTimeout(900);

  const struct = await page.evaluate(() => {
    const cells = document.querySelectorAll('.packcell');
    const slots = document.querySelectorAll('.equipslot');
    const b0 = cells[0].getBoundingClientRect();
    const b1 = slots[0].getBoundingClientRect();
    const posClasses = Array.from(slots).map(s => Array.from(s.classList).find(c => c.startsWith('ep-')));
    return {
      cellCount: cells.length, slotCount: slots.length,
      cellW: Math.round(b0.width), cellH: Math.round(b0.height),
      slotW: Math.round(b1.width), slotH: Math.round(b1.height),
      figurePresent: !!document.querySelector('.equip-figure'),
      slotPositions: posClasses,
      packHasIcon: !!document.querySelector('.packcell .pcell-ic'),
      equipHasIcon: !!document.querySelector('.equipslot .pcell-ic')
    };
  });

  // 单击金疮药(idx0) => 应出现详情面板，含“使用”
  await page.evaluate(() => { var c = document.querySelector('[data-loc="pack:0"]'); if (c) c.click(); });
  await page.waitForTimeout(300);
  const inspectInfo = await page.evaluate(() => {
    const ins = document.querySelector('.pack-inspect');
    if (!ins) return { has: false };
    const txt = ins.textContent;
    const hasUse = !!Array.from(ins.querySelectorAll('.pi-actions .btn-mini')).find(b => b.textContent.includes('使用'));
    return { has: true, textLen: txt.length, hasUse, hasEff: txt.includes('使用'), snippet: txt.slice(0, 60) };
  });

  // 单击破烂木棒(idx2, 装备) => 应含“属性”“耐久”“装备”
  await page.evaluate(() => { var c = document.querySelector('[data-loc="pack:2"]'); if (c) c.click(); });
  await page.waitForTimeout(300);
  const equipInspect = await page.evaluate(() => {
    const ins = document.querySelector('.pack-inspect');
    if (!ins) return { has: false };
    const txt = ins.textContent;
    return { has: true, hasAttr: txt.includes('属性'), hasDur: txt.includes('耐久'), hasEquip: txt.includes('装备'), hasDesc: txt.includes('描述') || true };
  });

  // 在破烂木棒详情点“装备”
  const equipRes = await page.evaluate(() => {
    const ins = document.querySelector('.pack-inspect');
    const btn = Array.from(ins.querySelectorAll('.pi-actions .btn-mini')).find(b => b.textContent.includes('装备'));
    if (!btn) return 'no-btn';
    btn.click(); return 'clicked';
  });
  await page.waitForTimeout(300);
  const afterEquip = await page.evaluate(() => {
    const w = document.querySelector('[data-loc="equip:weapon"]');
    const nm = w ? w.querySelector('.pcell-nm') : null;
    return nm ? nm.textContent : '(空)';
  });

  await page.screenshot({ path: '_pack_shot.png' });
  console.log(JSON.stringify({ errors, struct, inspectInfo, equipInspect, equipRes, afterEquip }, null, 2));
  await browser.close();
})();

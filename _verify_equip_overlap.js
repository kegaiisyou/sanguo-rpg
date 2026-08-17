const { chromium } = require('C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package');
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:8773/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

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

  const readDom = () => page.evaluate(() => {
    const stats = document.querySelector('.pack-left-stats');
    if (!stats) return [];
    return Array.from(stats.querySelectorAll('.ps-row')).map(r => ({
      label: r.querySelector('span').textContent.trim(),
      val: r.querySelector('b').textContent.trim()
    }));
  });
  const before = await readDom();

  // 找到武器（破烂木棒）并点击装备；若无则装备首个可装备物品
  const equipRes = await page.evaluate(async () => {
    const cells = Array.from(document.querySelectorAll('.packcell:not(.pcell-empty)'));
    const target = (key) => {
      const c = cells.find(el => (el.textContent || '').includes(key));
      if (!c) return null;
      c.click();
      return new Promise(r => setTimeout(r, 120));
    };
    await target('木棒');
    let btns = Array.from(document.querySelectorAll('.pack-info button, .pack-foot button'));
    let b = btns.find(x => /装备/.test(x.textContent));
    if (b) { b.click(); return { equipped: true, name: '破烂木棒' }; }
    // fallback: equip any equippable
    for (const c of cells) {
      c.click();
      await new Promise(r => setTimeout(r, 80));
      btns = Array.from(document.querySelectorAll('.pack-info button, .pack-foot button'));
      b = btns.find(x => /装备/.test(x.textContent));
      if (b) { b.click(); return { equipped: true, name: (c.textContent || '').trim().slice(0, 12) }; }
    }
    return { equipped: false };
  });
  await page.waitForTimeout(400);
  const after = await readDom();

  // 点击某个物品查看详情，测量重叠
  await page.evaluate(() => { var c = document.querySelector('.packcell[data-loc]:not(.pcell-empty)'); if (c) c.click(); });
  await page.waitForTimeout(400);
  const overlap = await page.evaluate(() => {
    function rect(s) { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }
    function ov(a, b) { return !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b); }
    const panels = ['.pack-head', '.pack-main', '.pack-left', '.pack-right', '.pack-info', '.pack-foot', '.pack-left-stats', '.equip-figure'];
    const rs = panels.map(p => ({ p, rc: rect(p) }));
    const pairs = [];
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      if (rs[i].rc && rs[j].rc && ov(rs[i].rc, rs[j].rc)) pairs.push(rs[i].p + ' x ' + rs[j].p);
    }
    const st = rect('.pack-left-stats'), info = rect('.pack-info'), main = rect('.pack-main'), foot = rect('.pack-foot');
    return {
      pairs,
      stBottom: st ? Math.round(st.b) : null,
      infoTop: info ? Math.round(info.t) : null,
      infoBottom: info ? Math.round(info.b) : null,
      mainBottom: main ? Math.round(main.b) : null,
      footTop: foot ? Math.round(foot.t) : null,
      viewportH: window.innerHeight,
      infoText: info ? info.t : null
    };
  });
  await page.screenshot({ path: '_pack_inspect2.png' });

  console.log('BEFORE_DOM', JSON.stringify(before));
  console.log('AFTER_DOM', JSON.stringify(after));
  console.log('EQUIP', JSON.stringify(equipRes));
  console.log('OVERLAP', JSON.stringify(overlap));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})();

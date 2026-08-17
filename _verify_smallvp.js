const { chromium } = require('C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package');
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 760, height: 520 } });
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

  const inspect = await page.evaluate(() => {
    const c = document.querySelector('.packcell[data-loc]:not(.pcell-empty)'); if (c) c.click();
  });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    function rect(s) { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }
    const st = rect('.pack-left-stats'), info = rect('.pack-info'), main = rect('.pack-main'), left = rect('.pack-left');
    const leftScroll = document.querySelector('.pack-left');
    return {
      stBottom: st ? Math.round(st.b) : null,
      infoTop: info ? Math.round(info.t) : null,
      infoBottom: info ? Math.round(info.b) : null,
      mainBottom: main ? Math.round(main.b) : null,
      leftHeight: left ? Math.round(left.height) : null,
      leftScrollHeight: leftScroll ? leftScroll.scrollHeight : null,
      leftClientHeight: leftScroll ? leftScroll.clientHeight : null,
      viewportH: window.innerHeight,
      // 关键检查：info 与 stats 是否有像素重叠
      realOverlap: st && info ? (st.b > info.t && st.t < info.b) : false
    };
  });
  await page.screenshot({ path: '_pack_small.png' });
  console.log('SMALL', JSON.stringify(r));
  console.log('ERRORS', JSON.stringify(errors));
  await browser.close();
})();

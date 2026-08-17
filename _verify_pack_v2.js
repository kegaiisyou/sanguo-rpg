const { chromium } = require('C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package');
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:8770/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

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

  const r = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const left = q('.pack-left'), right = q('.pack-right'), scroll = q('.pack-scroll'),
          info = q('.pack-info'), fig = q('.equip-figure'), grid = q('.pack-grid');
    if (!left || !right || !scroll || !info || !fig || !grid) return { ok:false, missing:true };
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const figBox = fig.getBoundingClientRect();
    const stCount = document.querySelectorAll('.pcell-st').length;
    const overflowY = getComputedStyle(scroll).overflowY;
    const sbWidth = getComputedStyle(scroll, '::-webkit-scrollbar').width || 'n/a';
    const infoBefore = info.getBoundingClientRect().top;
    scroll.scrollTop = 9999;
    const infoAfter = info.getBoundingClientRect().top;
    const scrolled = scroll.scrollTop > 0;
    const slots = Array.from(document.querySelectorAll('.equipslot'));
    const rects = slots.map(s => s.getBoundingClientRect());
    function overlaps(a,b){ return !(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom); }
    const clash = [];
    for(let i=0;i<rects.length;i++) for(let j=i+1;j<rects.length;j++)
      if(overlaps(rects[i],rects[j])) clash.push([slots[i].className.split(' ').find(c=>c.startsWith('ep-')), slots[j].className.split(' ').find(c=>c.startsWith('ep-'))]);
    const firstCell = document.querySelector('.packcell:not(.pcell-empty)');
    const jc = Array.from(document.querySelectorAll('.packcell')).filter(c => (c.textContent||'').includes('金疮药')).length;
    const stats = document.querySelector('.pack-left-stats');
    const statRows = stats ? Array.from(stats.querySelectorAll('.ps-row')).map(r => r.textContent.replace(/\s+/g,' ').trim()) : [];
    return {
      ok:true, cols, figW:Math.round(figBox.width), figH:Math.round(figBox.height),
      stCount, overflowY, sbWidth, scrolled, infoFixed: Math.abs(infoBefore-infoAfter) < 1,
      slotClash: clash, firstCellText: firstCell ? firstCell.textContent.trim() : '',
      jinchuangCells: jc, statsExists: !!stats, statRows
    };
  });
  await page.screenshot({ path: '_pack_v2.png', fullPage: false });

  // 单击首个物品，验证详情面板
  await page.evaluate(() => { var c = document.querySelector('.packcell[data-loc]:not(.pcell-empty)'); if (c) c.click(); });
  await page.waitForTimeout(400);
  const inspect = await page.evaluate(() => {
    const info = document.querySelector('.pack-info');
    const txt = info ? info.textContent.trim() : '';
    return { hasContent: txt.length > 4, snippet: txt.slice(0, 70) };
  });
  await page.screenshot({ path: '_pack_inspect.png', fullPage: false });

  console.log('STRUCT', JSON.stringify(r, null, 2));
  console.log('INSPECT', JSON.stringify(inspect, null, 2));
  console.log('ERRORS', JSON.stringify(errors, null, 2));
  await browser.close();
})();

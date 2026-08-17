const { chromium } = require('C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package');
(async () => {
  const errs = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR:' + e.message));
  await page.goto('http://localhost:8773/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // 进入游戏
  await page.click('#t-start').catch(e => errs.push('t-start: ' + e.message));
  await page.waitForSelector('.slot', { timeout: 5000 }).catch(() => {});
  await page.click('.slot').catch(e => errs.push('slot: ' + e.message));
  await page.waitForSelector('#cr-go', { timeout: 5000 }).catch(() => {});
  await page.check('#cr-skip').catch(() => {});
  await page.click('#cr-go').catch(e => errs.push('cr-go: ' + e.message));
  await page.waitForTimeout(2500);

  // 打开行囊
  await page.evaluate(() => {
    var b = document.querySelector('[data-modal="pack"]');
    if (!b) {
      b = Array.from(document.querySelectorAll('button')).find(x => /行囊/.test(x.textContent));
    }
    if (b) b.click();
  });
  await page.waitForTimeout(900);

  const rects1 = await page.evaluate(() => {
    function r(sel){ const e=document.querySelector(sel); if(!e) return null; const b=e.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),bottom:Math.round(b.bottom),right:Math.round(b.right)}; }
    const slots = Array.from(document.querySelectorAll('.equipslot')).map(e=>{const b=e.getBoundingClientRect();return {cls:e.className.replace(/equipslot|pcell-sel|pcell-insp/g,'').trim(),y:Math.round(b.y),bottom:Math.round(b.bottom),h:Math.round(b.height)};});
    return {
      card: r('.pack-card'),
      main: r('.pack-main'),
      left: r('.pack-left'),
      leftScrollH: document.querySelector('.pack-left')?.scrollHeight ?? -1,
      leftClientH: document.querySelector('.pack-left')?.clientHeight ?? -1,
      figure: r('.equip-figure'),
      stats: r('.pack-left-stats'),
      right: r('.pack-right'),
      grid: r('.pack-grid'),
      firstCell: r('.packcell'),
      cellNm: (()=>{const e=document.querySelector('.packcell .pcell-nm');return e?getComputedStyle(e).fontSize:null;})(),
      info: r('.pack-info'),
      slots
    };
  });
  console.log('--- PACK OPEN ---');
  console.log(JSON.stringify(rects1, null, 2));
  await page.screenshot({ path: '_phone_pack.png' });

  // 点击一个物品查看详情
  await page.evaluate(() => { const c=document.querySelector('.packcell:not(.pcell-empty)'); if(c) c.click(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '_phone_inspect.png' });
  const rects2 = await page.evaluate(() => {
    function r(sel){ const e=document.querySelector(sel); if(!e) return null; const b=e.getBoundingClientRect(); return {y:Math.round(b.y),bottom:Math.round(b.bottom),h:Math.round(b.height)}; }
    return {
      figure: r('.equip-figure'),
      stats: r('.pack-left-stats'),
      info: r('.pack-info'),
      mainH: r('.pack-main')?.h
    };
  });
  console.log('--- INSPECT ---');
  console.log(JSON.stringify(rects2, null, 2));
  console.log('ERRORS:', errs.length, errs.slice(0,5));
  await browser.close();
})();
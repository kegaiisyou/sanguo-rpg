const { chromium } = require('C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package');
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:8771/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.click('#t-start').catch(()=>{});
  await page.waitForSelector('.slot', { timeout: 5000 }).catch(() => {});
  await page.click('.slot').catch(()=>{});
  await page.waitForSelector('#cr-go', { timeout: 5000 }).catch(() => {});
  await page.check('#cr-skip').catch(() => {});
  await page.click('#cr-go').catch(()=>{});
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    document.body.classList.remove('onb'); document.body.classList.add('reveal-dock');
    var b = document.querySelector('[data-modal="pack"]'); if (b) b.click();
  });
  await page.waitForTimeout(900);
  // 装备破烂木棒(idx2)
  await page.evaluate(() => { var c = document.querySelector('[data-loc="pack:2"]'); if (c) c.click(); });
  await page.waitForTimeout(300);
  const r1 = await page.evaluate(() => {
    const ins = document.querySelector('.pack-inspect');
    const btn = Array.from(ins.querySelectorAll('.pi-actions .btn-mini')).find(b => b.textContent.includes('装备'));
    if (btn) btn.click(); return !!btn;
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const w = document.querySelector('[data-loc="equip:weapon"]');
    const nm = w ? w.querySelector('.ep-name') : null;
    const ph = w ? w.querySelector('.ep-ph') : null;
    return { hasBtn:true, weaponName: nm ? nm.textContent : (ph ? '(占位:'+ph.textContent+')' : '(空)') };
  });
  console.log(JSON.stringify({ errors, clickedEquip: r1, after }, null, 2));
  await browser.close();
})();

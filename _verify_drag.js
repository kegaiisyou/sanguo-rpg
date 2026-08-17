const { chromium } = require('C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package');
(async () => {
  const errs = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR:' + e.message));
  await page.goto('http://localhost:8773/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.click('#t-start').catch(()=>{});
  await page.waitForSelector('.slot').catch(()=>{});
  await page.click('.slot').catch(()=>{});
  await page.waitForSelector('#cr-go').catch(()=>{});
  await page.check('#cr-skip').catch(()=>{});
  await page.click('#cr-go').catch(()=>{});
  await page.waitForTimeout(2200);
  await page.evaluate(() => { var b=document.querySelector('[data-modal="pack"]')||Array.from(document.querySelectorAll('button')).find(x=>/行囊/.test(x.textContent)); if(b)b.click(); });
  await page.waitForTimeout(700);

  const res = await page.evaluate(() => {
    function pe(type, x, y, target){
      target.dispatchEvent(new PointerEvent(type, { pointerType:'touch', clientX:x, clientY:y, bubbles:true, cancelable:true }));
    }
    const card = document.getElementById('modal-card');
    const el = document.querySelector('.packcell[data-loc^="pack:"]:not(.pcell-empty)');
    if(!el) return { err:'no cell' };
    const r = el.getBoundingClientRect();
    pe('pointerdown', r.x+10, r.y+10, el);
    pe('pointermove', r.x+55, r.y+55, card);
    const g = document.querySelector('.pack-ghost');
    let ghost = null;
    if(g){ const cs=getComputedStyle(g); const b=g.getBoundingClientRect(); ghost={ fontSize:cs.fontSize, width:Math.round(b.width), height:Math.round(b.height), text:g.textContent }; }
    // 结束拖动到空白处（不移动物品），验证浮层移除
    pe('pointerup', r.x+55, r.y+55, card);
    const still = !!document.querySelector('.pack-ghost');
    return { ghost, stillAfterUp: still, srcName: el.textContent.trim().slice(0,8) };
  });
  console.log('RESULT:', JSON.stringify(res));
  console.log('ERRORS:', errs.length, errs.slice(0,5));
  await browser.close();
})();

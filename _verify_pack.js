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

  const diag = await page.evaluate(() => ({
    appHidden: document.getElementById('app') ? document.getElementById('app').classList.contains('hidden') : null,
    dockDisp: document.getElementById('dock') ? getComputedStyle(document.getElementById('dock')).display : null,
    statusLen: document.getElementById('status') ? document.getElementById('status').children.length : null
  }));

  // 强制打开背包（绕过 onb 隐藏）
  await page.evaluate(() => {
    document.body.classList.remove('onb'); document.body.classList.add('reveal-dock');
    var b = document.querySelector('[data-modal="pack"]'); if (b) b.click();
  });
  await page.waitForTimeout(900);

  const packInfo = await page.evaluate(() => {
    const cells = document.querySelectorAll('.packcell');
    const slots = document.querySelectorAll('.equipslot');
    const names = Array.from(cells).map(c => { const n = c.querySelector('.pcell-nm'); return n ? n.textContent : ''; });
    const slotNames = Array.from(slots).map(s => { const n = s.querySelector('.pcell-nm'); return n ? n.textContent : ''; });
    return { cellCount: cells.length, slotCount: slots.length, names: names.filter(Boolean), slotNames: slotNames.filter(Boolean) };
  });

  // 自动整理
  const autoRes = await page.evaluate(() => { try { window.LFUI.packAutoSort(); return 'ok'; } catch (e) { return 'err:' + e.message; } });
  await page.waitForTimeout(300);

  // 使用肉包子 idx3
  const useRes = await page.evaluate(() => { try { window.LFUI.usePackItem(3); return 'ok'; } catch (e) { return 'err:' + e.message; } });
  await page.waitForTimeout(300);
  const afterUse = await page.evaluate(() => {
    const cells = document.querySelectorAll('.packcell');
    return Array.from(cells).map(c => { const n = c.querySelector('.pcell-nm'); return n ? n.textContent : ''; }).filter(Boolean);
  });

  // 点击移动测试：选中 idx0 移到 idx20（验证点击拖动/摆放）
  await page.evaluate(() => { var c = document.querySelector('[data-loc="pack:0"]'); if (c) c.click(); });
  await page.waitForTimeout(200);
  const moveRes = await page.evaluate(() => {
    var t = document.querySelector('[data-loc="pack:20"]'); if (t) t.click();
    var cells = document.querySelectorAll('.packcell');
    var n0 = cells[0].querySelector('.pcell-nm'); var n20 = cells[20].querySelector('.pcell-nm');
    return { from: n0 ? n0.textContent : '(空)', to: n20 ? n20.textContent : '(空)' };
  });

  await page.screenshot({ path: '_pack_shot.png' });
  console.log(JSON.stringify({ errors, diag, packInfo, autoRes, useRes, afterUse, moveRes }, null, 2));
  await browser.close();
})();

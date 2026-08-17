const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, deviceScaleFactor:2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message));
  await page.goto('http://localhost:8773/index.html', { waitUntil:'networkidle' });
  await page.waitForTimeout(400);
  // 默认：打开行囊
  await page.evaluate(() => { if (typeof openModal==='function') openModal('pack'); });
  await page.waitForTimeout(300);
  const defCap = await page.evaluate(() => ({pack: state.pack.length, max: (typeof packMax==='function'?packMax():'?'), items: packList().length}));
  await page.screenshot({ path:'_pack_v3_default.png' });
  // 装备虎头鞶囊(idx5) 到背包槽
  await page.evaluate(() => { movePackItem({kind:'pack',idx:5},{kind:'equip',slot:'bag'}); openModal('pack'); });
  await page.waitForTimeout(300);
  const bagCap = await page.evaluate(() => ({pack: state.pack.length, max: (typeof packMax==='function'?packMax():'?'), items: packList().length, bag: state.equipment.bag && state.equipment.bag.name}));
  await page.screenshot({ path:'_pack_v3_bag.png' });
  // 选中虎头鞶囊查看详情(此时在装备槽)
  await page.evaluate(() => { packInspect={kind:'equip',slot:'bag'}; openModal('pack'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path:'_pack_v3_bagdetail.png' });
  console.log('DEFAULT', JSON.stringify(defCap));
  console.log('WITH_BAG', JSON.stringify(bagCap));
  console.log('ERRORS', errors.length, JSON.stringify(errors));
  await browser.close();
})();

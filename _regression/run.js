// _regression/run.js
// ===========================================================================
//  手机端回归脚本（回归 = 改完代码跑一遍，确认旧功能没被改坏）
//  用法：
//    1) 先起静态服务器： python -m http.server 8773   （在仓库根目录）
//    2) 跑本脚本：        node _regression/run.js
//  可选环境变量： BASE_URL、PLAYWRIGHT_PATH
//  退出码：0=全部通过，1=有失败
// ===========================================================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:8773/index.html';

function loadPlaywright() {
  const cands = [
    process.env.PLAYWRIGHT_PATH,
    'C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\site-packages\\playwright\\driver\\package'
  ].filter(Boolean);
  for (const c of cands) { try { return require(c); } catch (e) { /* try next */ } }
  return require('playwright-core');
}
const { chromium } = loadPlaywright();

const results = [];
function check(name, pass, detail) { results.push({ name, pass: !!pass, detail: detail || '' }); }

async function enterGame(page) {
  await page.click('#t-start').catch(() => {});
  await page.waitForSelector('.slot', { timeout: 5000 }).catch(() => {});
  await page.click('.slot').catch(() => {});
  await page.waitForSelector('#cr-go', { timeout: 5000 }).catch(() => {});
  await page.check('#cr-skip').catch(() => {});
  await page.click('#cr-go').catch(() => {});
  await page.waitForTimeout(2200);
}
async function openPack(page) {
  await page.evaluate(() => {
    const b = document.querySelector('[data-modal="pack"]')
      || Array.from(document.querySelectorAll('button')).find(x => /行囊/.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(700);
}
// 真实鼠标点击：找到含 text 的 .packcell 并点其中心（触发 onclick）
async function clickCellByText(page, text) {
  const box = await page.evaluate((t) => {
    const cells = Array.from(document.querySelectorAll('.packcell:not(.pcell-empty)'));
    const el = cells.find(c => (c.textContent || '').includes(t));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, text);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(350);
  return true;
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR:' + e.message));

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }).catch(e => { console.error('无法加载', BASE_URL, '->', e.message); process.exit(1); });
  await page.waitForTimeout(700);

  // ---------- 测试一：行囊基础布局（手机 390×844） ----------
  await enterGame(page);
  await openPack(page);

  const pack = await page.evaluate(() => {
    const grid = document.querySelector('.pack-grid');
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
    const cell = document.querySelector('.packcell:not(.pcell-empty)');
    const cellW = cell ? Math.round(cell.getBoundingClientRect().width) : 0;
    const left = document.querySelector('.pack-left');
    const stats = document.querySelector('.pack-left-stats');
    const footBtn = document.querySelector('.pack-foot .btn');
    const moveBtn = Array.from(document.querySelectorAll('.pi-actions button, .pack-foot button, .pack-info button')).find(b => /移动/.test(b.textContent));
    return {
      cols, cellW,
      leftScroll: left ? left.scrollHeight : -1,
      leftClient: left ? left.clientHeight : -1,
      statsCollapsed: stats ? stats.classList.contains('collapsed') : null,
      footBtnH: footBtn ? Math.round(parseFloat(getComputedStyle(footBtn).minHeight)) : -1,
      hasMoveBtn: !!moveBtn
    };
  });
  check('手机端物品格为 3 列', pack.cols === 3, 'cols=' + pack.cols);
  check('物品格宽度≥34px', pack.cellW >= 34, 'w=' + pack.cellW);
  check('左栏无溢出（scroll≤client）', pack.leftScroll <= pack.leftClient + 2, 'scroll=' + pack.leftScroll + ' client=' + pack.leftClient);
  check('小屏属性面板默认收起', pack.statsCollapsed === true, 'collapsed=' + pack.statsCollapsed);
  check('底部按钮热区≥44px', pack.footBtnH >= 44, 'minH=' + pack.footBtnH);
  check('点选“移动”模式已移除（无移动按钮）', !pack.hasMoveBtn, '');

  // 查看武器详情，验证属性行渲染（含对比逻辑）；破烂木棒 atk:2 必有属性行
  const viewed = await clickCellByText(page, '破烂木棒');
  const insp = await page.evaluate(() => ({ hasStat: !!document.querySelector('.pi-stat') }));
  check('详情面板有属性行（重写后的渲染）', insp.hasStat, '');
  await page.screenshot({ path: '_regression/phone-pack.png' });

  // 装备武器，验证品质角标出现在已装备槽
  if (viewed) {
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.pi-actions button')).find(x => /装备/.test(x.textContent)); if (b) b.click(); });
    await page.waitForTimeout(400);
  }
  const badge = await page.evaluate(() => !!document.querySelector('.ep-qbadge'));
  check('已装备槽显示品质角标', badge, '');
  await page.screenshot({ path: '_regression/phone-pack-equipped.png' });

  // ---------- 测试二：拖动浮层（触摸） ----------
  const drag = await page.evaluate(() => {
    function pe(type, x, y, target){ target.dispatchEvent(new PointerEvent(type, { pointerType:'touch', clientX:x, clientY:y, bubbles:true, cancelable:true })); }
    const card = document.getElementById('modal-card');
    const el = document.querySelector('.packcell[data-loc^="pack:"]:not(.pcell-empty)');
    if (!el) return { err: 'no cell' };
    const r = el.getBoundingClientRect();
    pe('pointerdown', r.x + 10, r.y + 10, el);
    pe('pointermove', r.x + 55, r.y + 55, card);
    const g = document.querySelector('.pack-ghost');
    const info = g ? { fontSize: getComputedStyle(g).fontSize } : null;
    pe('pointerup', r.x + 55, r.y + 55, card);
    return { ghost: info, stillAfterUp: !!document.querySelector('.pack-ghost') };
  });
  check('拖动浮层字号=13px（不再突然变大）', drag.ghost && drag.ghost.fontSize === '13px', JSON.stringify(drag.ghost));
  check('拖动结束后浮层被清除', drag.stillAfterUp === false, 'still=' + drag.stillAfterUp);

  check('整轮无 JS 控制台错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  // ---------- 输出 ----------
  console.log('\n==== 手机端回归结果 ====');
  let fail = 0;
  results.forEach(r => {
    const tag = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) fail++;
    console.log(`[${tag}] ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
  });
  console.log(`\n${results.length - fail}/${results.length} 通过`);
  process.exit(fail ? 1 : 0);
})();

(function (global) {
  'use strict';

  // ========== 货郎交易系统（统一「待结算占位」买卖） ==========
  // 抽离自 index.html，避免主文件臃肿。所有对 index.html 的依赖通过 createShop(ctx) 注入：
  //   getState   -> 返回当前 game state（必须动态，因为读档/新局会整体替换 state 对象）
  //   getCard    -> 返回 modal 卡片 DOM（#modal-card）
  //   其余皆为稳定的函数引用（不会被重新赋值）
  global.LF = global.LF || {};

  global.LF.createShop = function (ctx) {
    var packAdd          = ctx.packAdd;
    var afterPackChange  = ctx.afterPackChange;
    var save             = ctx.save;
    var toast            = ctx.toast;
    var itemIconHTML     = ctx.itemIconHTML;
    var packIsStackable  = ctx.packIsStackable;
    var packFind         = ctx.packFind;
    var packFirstEmpty   = ctx.packFirstEmpty;
    var positionFloat    = ctx.positionFloat;
    var closeModal       = ctx.closeModal;
    var $card            = ctx.getCard();

    // 当前 game state（动态获取，确保读档/新局后引用正确）
    function S() { return ctx.getState(); }

    // ── 模块内部状态（不污染 state.pack，故不进存档、不参与战斗/装备/容量）──
    var shopState = 'build_pedlar';
    var shopBuyPending = [];    // 购入待付：{id, price, count, cell}   ——cell=行囊格 idx（占用真实格子，可自由拖动换位）
    var shopSellPending = [];  // 售出待收：{defId, price, count, item, uid} ——uid=唯一序号（leftSeq 引用，增删不漂移）
    var sellUidSeq = 1;         // 待售品 uid 自增序号
    var leftSeq = null;         // 左栏统一显示顺序：'g:'+真货id 或 's:'+待售uid（会话内，待售可与真货任意换位）
    var shopSel = null;        // 右侧行囊真实物品选中 idx
    var shopGoodSel = null;    // 左侧货郎真货选中 id
    var shopBuySel = null;     // 右侧 buy 占位选中（buyp 索引）
    var shopSellSel = null;    // 左侧 sell 占位选中（sellp 索引）
    var flashPack = {};        // 换格/放置后短暂高亮的行囊格 idx 集合（供 renderTrade 应用脉冲）
    var settleBox = null;      // 结算明细浮层元素（确认结算前弹出清单，防误触）

    // 取某物在货郎处的「收购价」（货郎不收 / 收购价<=0 时返回 null）
    function shopSellPrice(id) {
      var shop = LF.SHOPS[shopState]; if (!shop) return null;
      var r = null; shop.items.forEach(function (x) { if (x.id === id) r = x; });
      return (r && r.sell > 0) ? r.sell : null;
    }
    // 价格格式化（模块内，供 renderShopPanel / renderShopInfo 共用）
    function fmtPrice(n) {
      n = Number(n) || 0;
      if (n <= 9999) return n + ' 两';
      if (n <= 99999999) { var v = (n / 10000).toFixed(n < 100000 ? 1 : 0); return (v.replace(/\.0$/, '')) + '万 两'; }
      var v2 = (n / 100000000).toFixed(n < 1000000000 ? 1 : 0); return (v2.replace(/\.0$/, '')) + '亿 两';
    }
    // 行囊格 data-loc 形如 "pack:索引"（旧逻辑按 split(':')[1] 取索引，这里统一管理，避免后续改动再踩 NaN）
    function locIdx(loc) { if (loc == null) return -1; var p = String(loc).split(':'); return parseInt(p.length > 1 ? p[1] : p[0], 10); }
    // 行囊两格互换（持久化）
    function swapPackSlots(a, b) { if (a === b) return; var pk = S().pack; var t = pk[a]; pk[a] = pk[b]; pk[b] = t; flashPack[a] = true; flashPack[b] = true; if (typeof save === 'function') save(S()); }
    // 行囊第一个空格下标（无则 -1）
    function firstEmptyPackIdx() { var pk = S().pack; for (var i = 0; i < pk.length; i++) if (!pk[i]) return i; return -1; }
    // 货郎商品展示顺序（会话内记忆、不进存档、关闭即丢弃）
    var shopGoodsOrder = {};
    var scrollToSell = false;   // 寄售成功后把左栏滚动到待售格（货郎真货多时待售格排在末尾，不滚动则看不见、误以为"无法选中"）
    function ensureGoodsOrder() {
      var shop = LF.SHOPS[shopState]; if (!shop) return;
      if (!shopGoodsOrder[shopState]) {
        shopGoodsOrder[shopState] = shop.items.filter(function (r) { return r.buy > 0; }).map(function (r) { return r.id; });
      }
    }
    // 同类区域内拖拽换位（整理）：行囊换格持久化；货郎商品换序仅会话内
    function reorderPackAtEl(el, fromIdx) {
      if (!el || !el.closest) return false;
      var t = el.closest('.shop-right [data-loc]'); if (!t) return false;
      var toIdx = locIdx(t.getAttribute('data-loc')); if (toIdx < 0 || toIdx === fromIdx) return false;
      var pk = S().pack; var tmp = pk[toIdx]; pk[toIdx] = pk[fromIdx]; pk[fromIdx] = tmp;
      flashPack[toIdx] = true; flashPack[fromIdx] = true;
      if (typeof save === 'function') save(S());   // 行囊顺序持久化（下次开包/交易保持）
      return true;
    }
    // 一键把行囊中所有货郎肯收的物挂上寄售
    function sellAllPack() {
      var shop = LF.SHOPS[shopState]; if (!shop) return;
      var pk = S().pack, idxs = [];
      for (var i = 0; i < pk.length; i++) { var it = pk[i]; if (it && shopSellPrice(it.defId) > 0) idxs.push(i); }
      if (!idxs.length) { toast('行囊里没有货郎肯收的东西。'); return; }
      idxs.sort(function (a, b) { return b - a; });   // 从大到小，避免逐个移除后索引错位
      idxs.forEach(function (idx) { var it = pk[idx]; if (it) addSellPending(idx, it.count); });
      scrollToSell = true;
      shopSellSel = null; renderTrade();
    }
    // 货品名按长度分级（sg-n2~sg-n6），字号交给 CSS 分级控制
    function sgFontSize(name) {
      var L = (name || '').replace(/\s+/g, '').length;
      return 'sg-n' + (L <= 2 ? 2 : L <= 3 ? 3 : L <= 4 ? 4 : L <= 5 ? 5 : 6);
    }
    // ── 待付格子模型 & 左栏统一顺序（真货 g:id + 待售 s:uid）──
    function findShopRec(id) { var s = LF.SHOPS[shopState]; if (!s) return null; for (var i = 0; i < s.items.length; i++) if (s.items[i].id === id) return s.items[i]; return null; }
    function baseGoods() { var s = LF.SHOPS[shopState] || { items: [] }; return s.items.filter(function (r) { return r.buy > 0; }); }
    function sellIdxByUid(uid) { for (var i = 0; i < shopSellPending.length; i++) if (shopSellPending[i].uid === uid) return i; return -1; }
    function buyPendingAtCell(cell) { for (var i = 0; i < shopBuyPending.length; i++) if (shopBuyPending[i].cell === cell) return i; return -1; }
    // 待付品可用的「真空格」：pack 为空 且 未被其他待付品占用
    function firstFreeCellForBuy() {
      var pk = S().pack;
      for (var i = 0; i < pk.length; i++) if (!pk[i] && buyPendingAtCell(i) < 0) return i;
      return -1;
    }
    // 待付品移到指定格子：空格=移入；真物格=真物让位到旧格；其他待付格=两待付交换格子
    function placeBuyPending(p, toCell) {
      if (!p || toCell == null || toCell < 0 || toCell >= S().pack.length || toCell === p.cell) return;
      var pk = S().pack;
      var holder = buyPendingAtCell(toCell);
      if (holder >= 0) {
        var q = shopBuyPending[holder]; q.cell = p.cell; p.cell = toCell;
      } else if (pk[toCell]) {
        pk[p.cell] = pk[toCell]; pk[toCell] = null; p.cell = toCell;
      } else {
        p.cell = toCell;
      }
      flashPack[toCell] = true; flashPack[p.cell] = true;
      if (typeof save === 'function') save(S());
    }
    // 左栏统一顺序
    function ensureLeftSeq() {
      if (leftSeq) {   // 保留已有顺序：清理失效项、补缺失真货
        var good = leftSeq.filter(function (k) {
          if (k.charAt(0) === 'g') { var r = findShopRec(k.slice(2)); return r && r.buy > 0; }
          return sellIdxByUid(parseInt(k.slice(2), 10)) >= 0;
        });
        var have = {}; good.forEach(function (k) { if (k.charAt(0) === 'g') have[k.slice(2)] = true; });
        baseGoods().forEach(function (r) { if (!have[r.id]) good.push('g:' + r.id); });
        leftSeq = good;
        return;
      }
      rebuildLeftSeq();
    }
    function rebuildLeftSeq() {
      ensureGoodsOrder();
      leftSeq = [];
      var ord = shopGoodsOrder[shopState] || [];
      var have = {}; ord.forEach(function (id) { have[id] = true; });
      var base = baseGoods();
      base.forEach(function (r) { if (have[r.id]) leftSeq.push('g:' + r.id); });
      base.forEach(function (r) { if (!have[r.id]) leftSeq.push('g:' + r.id); });
      shopSellPending.forEach(function (p) { if (p.uid != null) leftSeq.push('s:' + p.uid); });
    }
    function leftKeyOf(el) {
      var t = el && el.closest ? el.closest('[data-shop],[data-selluid]') : null;
      if (!t) return null;
      if (t.getAttribute('data-shop') != null) return 'g:' + t.getAttribute('data-shop');
      return 's:' + t.getAttribute('data-selluid');
    }
    function removeKey(key) { if (!leftSeq) return; var a = leftSeq.indexOf(key); if (a >= 0) leftSeq.splice(a, 1); }
    function moveKeyToEnd(key) { if (!leftSeq) return; var a = leftSeq.indexOf(key); if (a >= 0) { leftSeq.splice(a, 1); leftSeq.push(key); } }
    // 左栏拖放：同 defId 待售→堆叠；否则两格交换位置（待售可与真货/待售任意换位）
    function dropLeft(dragKey, el) {
      var dstKey = leftKeyOf(el);
      if (!dstKey) { moveKeyToEnd(dragKey); return; }
      if (dstKey === dragKey) return;
      if (dragKey.charAt(0) === 's' && dstKey.charAt(0) === 's') {
        var srcIdx = sellIdxByUid(parseInt(dragKey.slice(2), 10));
        var dstIdx = sellIdxByUid(parseInt(dstKey.slice(2), 10));
        if (srcIdx >= 0 && dstIdx >= 0 && shopSellPending[dstIdx].defId === shopSellPending[srcIdx].defId) {
          shopSellPending[dstIdx].count += shopSellPending[srcIdx].count;   // 相同待售物堆叠
          if (shopSellPending[dstIdx].item) shopSellPending[dstIdx].item.count = shopSellPending[dstIdx].count;
          var merged = shopSellPending[dstIdx];
          shopSellPending.splice(srcIdx, 1);
          removeKey(dragKey);
          shopSellSel = shopSellPending.indexOf(merged);   // splice 后索引可能偏移，用对象重算
          return;
        }
      }
      var a = leftSeq.indexOf(dragKey), b = leftSeq.indexOf(dstKey);
      if (a < 0 || b < 0) return;
      var t = leftSeq[a]; leftSeq[a] = leftSeq[b]; leftSeq[b] = t;   // 交换位置
    }
    function renderShopPanel() {
      var shop = LF.SHOPS[shopState] || { name: '', items: [] };
      var DEFS = LF.ITEMS;
      // 左栏：按 leftSeq 统一顺序渲染（真货 data-shop + 待售 data-sellp/data-selluid），待售可插到任意位置、与真货任意换位
      ensureGoodsOrder();
      ensureLeftSeq();
      var goodsHTML = leftSeq.map(function (key) {
        if (key.charAt(0) === 'g') {
          var gid = key.slice(2);
          var r = findShopRec(gid); if (!r || !r.buy) return '';
          var d = DEFS[gid] || {}; var pc = buyPendingCount(gid);
          return '<div class="shop-good' + (S().gold >= r.buy ? '' : ' shop-bad') + (shopGoodSel === gid ? ' pcell-sel' : '') + '" data-shop="' + gid + '">'
            + '<div class="sg-name ' + sgFontSize(d.name) + '">' + d.name + '</div>'
            + '<div class="sg-buy">买 ' + fmtPrice(r.buy) + '</div>'
            + (pc ? '<span class="pcell-tag pcell-buy">待付×' + pc + '</span>' : '')
            + '</div>';
        }
        var si = sellIdxByUid(parseInt(key.slice(2), 10)); if (si < 0) return '';   // 失效项跳过（待售已被删除）
        var p = shopSellPending[si]; var d2 = DEFS[p.defId] || {};
        return '<div class="shop-good pcell-pending' + (shopSellSel === si ? ' pcell-sel' : '') + '" data-sellp="' + si + '" data-selluid="' + p.uid + '">'   // 不能带 pcell-sell 类：该类的 position:absolute 会让整格脱离网格、飘到容器外（"无法选中"的根因）
          + '<div class="sg-name ' + sgFontSize(d2.name) + '">' + d2.name + '</div>'
          + '<div class="sg-buy">+' + fmtPrice(p.price) + '</div>'
          + '<span class="pcell-tag pcell-sell">待售×' + p.count + '</span>'
          + '<button class="pcell-x" type="button" data-cx="sell" data-ci="' + si + '" title="取回">✕</button></div>';
      }).join('');
      // 右栏：真物按 idx 渲染；待付品绑定固定格子 cell（自由拖动换位，与真物无缝混排）
      var grid = '';
      var cellBuy = {};
      shopBuyPending.forEach(function (p, bi) { if (p.cell != null && p.cell >= 0) cellBuy[p.cell] = bi; });
      for (var i = 0; i < S().pack.length; i++) {
        var it = S().pack[i];
        if (it) {
          var cnt = (it.count > 1) ? ('<span class="pcell-cnt">' + it.count + '</span>') : '';
          var sp = shopSellPrice(it.defId);
          var sellTag = (sp != null) ? '<span class="pcell-sell">卖' + sp + '</span>' : '';
          var durTag = (it.maxDur) ? '<span class="pcell-dur">' + it.dur + '/' + it.maxDur + '</span>' : '';
          grid += '<div class="packcell' + (shopSel === i ? ' pcell-sel' : '') + '" data-loc="pack:' + i + '">'
            + '<div class="pcell-ic">' + itemIconHTML(it, 13) + '</div>' + cnt + sellTag + durTag + '</div>';
        } else if (cellBuy[i] != null) {
          var bi = cellBuy[i]; var bp = shopBuyPending[bi]; var bd = DEFS[bp.id] || { name: bp.id };
          grid += '<div class="packcell pcell-buyp' + (shopBuySel === bi ? ' pcell-sel' : '') + '" data-buyp="' + bi + '" data-cell="' + i + '">'
            + '<div class="pcell-ic">' + itemIconHTML(bd, 13) + '</div>'
            + '<span class="pcell-cnt">' + bp.count + '</span>'
            + '<span class="pcell-tag pcell-buy">待付</span>'
            + '<button class="pcell-x" type="button" data-cx="buy" data-ci="' + bi + '" title="取消">✕</button></div>';
        } else {
          grid += '<div class="packcell pcell-empty" data-loc="pack:' + i + '"></div>';
        }
      }
      var bn = shopBuyPending.reduce(function (s, p) { return s + p.price * p.count; }, 0);
      var sn = shopSellPending.reduce(function (s, p) { return s + p.price * p.count; }, 0);
      var badge = (shopBuyPending.length || shopSellPending.length) ? ('<span class="shop-badge">待结算 ' + shopBuyPending.length + '购 / ' + shopSellPending.length + '售</span>') : '';
      return '<div class="shop-wrap">'
        + '<div class="shop-head"><span class="shop-title">💰 ' + shop.name + ' · 交易</span><span class="shop-gold">银两 ' + S().gold + ' 两</span></div>'
        + '<div class="shop-main">'
        +   '<div class="shop-left"><div class="shop-pane-title">货郎的货 · 点按选购</div><div class="shop-scroll"><div class="shop-goods-grid">' + goodsHTML + '</div></div></div>'
        +   '<div class="shop-right"><div class="shop-pane-title">你的行囊 · 拖物到左栏即寄售</div><div class="shop-scroll"><div class="pack-grid">' + grid + '</div></div></div>'
        + '</div>'
        + '<div class="shop-foot"><button class="btn" id="m-leave">告 辞</button>'
        + '<button class="btn" id="pack-sort">整理行囊</button>'
        +   '<span class="shop-hint">' + (bn ? ('将付 ' + fmtPrice(bn) + ' ') : '') + (sn ? ('将收 ' + fmtPrice(sn) + ' ') : '') + '· 同栏拖拽整理·拖到对侧买卖·✕取消</span>'
        +   badge + (shopBuyPending.length || shopSellPending.length ? '<button class="btn" id="trade-clear">清空待结算</button>' : '') + '<button class="btn btn-ok" id="trade-ok">确认结算</button></div>'
        + '</div>';
    }
    // ===== 统一交易系统：拖到对侧成为「待结算占位」，确认后统一结算 =====
    function restoreTradePending() {   // 离开货郎时归还寄售真物并清空购入占位
      if (shopSellPending.length) { shopSellPending.forEach(function (p) { if (p && p.item) packAdd(p.item); }); shopSellPending = []; }
      if (shopBuyPending.length) shopBuyPending = [];
      if (leftSeq) leftSeq = leftSeq.filter(function (k) { return k.charAt(0) === 'g'; });   // 只剩真货（保留整理顺序）
      if (typeof save === 'function') save(S());
    }
    function buyPendingCount(id) { var n = 0; shopBuyPending.forEach(function (p) { if (p.id === id) n += p.count; }); return n; }
    function renderTrade() {
      // 重渲前记录两栏滚动位置，整块 innerHTML 重渲后恢复（避免每次买卖/换格滚动条跳回顶部）
      var ls = $card.querySelector('.shop-left .shop-scroll'), rs = $card.querySelector('.shop-right .shop-scroll');
      var lt = ls ? ls.scrollTop : 0, rt = rs ? rs.scrollTop : 0;
      hideSettleDialog();   // 重渲时收起结算明细浮层（结算完成后自动消失）
      $card.innerHTML = renderShopPanel(); bindShopPanel();
      var nl = $card.querySelector('.shop-left .shop-scroll'), nr = $card.querySelector('.shop-right .shop-scroll');
      if (nl) nl.scrollTop = lt; if (nr) nr.scrollTop = rt;
      // 换格/放置后短暂高亮，给玩家明确反馈（否则重渲后看不出变化）
      var fp = Object.keys(flashPack);
      if (fp.length) {
        fp.forEach(function (k) { var el = $card.querySelector('.shop-right [data-loc="pack:' + k + '"],.shop-right [data-cell="' + k + '"]'); if (el) el.classList.add('just-moved'); });
        setTimeout(function () { fp.forEach(function (k) { var el = $card.querySelector('.shop-right [data-loc="pack:' + k + '"],.shop-right [data-cell="' + k + '"]'); if (el) el.classList.remove('just-moved'); }); }, 700);
        flashPack = {};
      }
      // 寄售成功后自动把左栏滚到待售格可见（货郎真货多时待售格排在末尾，藏起来会让人觉得"格子无法选中/被锁定"）
      if (scrollToSell) {
        scrollToSell = false;
        var se = $card.querySelector('.shop-left [data-sellp]');
        if (se) {
          var scEl = se.closest('.shop-scroll') || $card.querySelector('.shop-left .shop-scroll');
          if (scEl) {
            var sr2 = se.getBoundingClientRect(), scr2 = scEl.getBoundingClientRect();
            if (sr2.bottom > scr2.bottom || sr2.top < scr2.top) {
              scEl.scrollTop += sr2.top - scr2.top - 6;
            }
          }
        }
      }
      showShopFloat();
    }
    function addBuyPending(id, n) {
      var r = null, shop = LF.SHOPS[shopState]; if (shop) shop.items.forEach(function (x) { if (x.id === id) r = x; });
      if (!r || !r.buy) { toast('货郎不出售此物。'); return; }
      var used = 0; shopBuyPending.forEach(function (p) { used += p.price * p.count; });
      var maxByGold = Math.floor((S().gold - used) / r.buy);
      var maxBySpace = buySpaceLimit(id) - buyPendingCount(id);
      var max = Math.max(0, Math.min(maxByGold, maxBySpace));
      n = Math.max(1, Math.min(n || 1, max));
      if (n <= 0) { toast('银两或行囊不足。'); return; }
      for (var i = 0; i < shopBuyPending.length; i++) { if (shopBuyPending[i].id === id) { shopBuyPending[i].count += n; renderTrade(); toast('已加购：' + ((LF.ITEMS[id] || {}).name || id) + '×' + n); return; } }
      var cell = firstFreeCellForBuy();
      if (cell < 0) { toast('行囊空间不足。'); return; }
      shopBuyPending.push({ id: id, price: r.buy, count: n, cell: cell }); renderTrade();
      toast('加入待付：购入 ' + ((LF.ITEMS[id] || {}).name || id) + '×' + n);
    }
    function addSellPending(idx, n) {
      var it = S().pack[idx]; if (!it) return;
      var sp = shopSellPrice(it.defId); if (sp == null) { toast('货郎不收此物。'); return; }
      n = Math.max(1, Math.min(n || 1, it.count || 1)); if (n <= 0) return;
      var taken;
      if (n >= it.count) { taken = it; S().pack[idx] = null; }
      else { taken = LF.ITEMS.makeItem(it.defId, n); if (it.maxDur) taken.dur = it.dur; it.count -= n; }
      // 已有同类待售 → 直接堆叠（不新增格子/顺序项，数量累加）
      for (var mi = 0; mi < shopSellPending.length; mi++) {
        if (shopSellPending[mi].defId === it.defId) {
          shopSellPending[mi].count += n;
          if (shopSellPending[mi].item) shopSellPending[mi].item.count = shopSellPending[mi].count;
          shopSel = null; afterPackChange(); renderTrade();
          toast('加入寄售：售出 ' + ((LF.ITEMS[it.defId] || {}).name || it.defId) + '×' + n);
          return;
        }
      }
      var uid = ++sellUidSeq;
      shopSellPending.push({ defId: it.defId, price: sp, count: n, item: taken, uid: uid });
      if (leftSeq) leftSeq.push('s:' + uid);   // 新待售排到左栏末尾（之后可自由拖动换位）
      scrollToSell = true;   // 寄售后滚动到待售格，确保用户能看到/选中自己的寄售
      shopSel = null; afterPackChange(); renderTrade();
      toast('加入寄售：售出 ' + ((LF.ITEMS[it.defId] || {}).name || it.defId) + '×' + n);
    }
    function removeBuyPending(i) {
      if (i >= 0 && i < shopBuyPending.length) {
        shopBuyPending.splice(i, 1);
        if (shopBuySel === i) shopBuySel = null;
        renderTrade();
      }
    }
    function removeSellPending(i) {
      if (i >= 0 && i < shopSellPending.length) {
        var p = shopSellPending.splice(i, 1)[0];
        if (p && p.uid != null) removeKey('s:' + p.uid);   // 同步移除左栏顺序项
        if (p && p.item) packAdd(p.item);
        if (shopSellSel === i) shopSellSel = null;
        afterPackChange(); renderTrade();
      }
    }
    function confirmTrade() {
      if (!shopBuyPending.length && !shopSellPending.length) { toast('尚未加入任何交易。'); return; }
      var need = 0; shopBuyPending.forEach(function (p) { need += p.price * p.count; });
      if (need > S().gold) { toast('银两不足，无法结算。'); return; }
      shopBuyPending.forEach(function (p) { var got = 0; for (var k = 0; k < p.count; k++) { if (packAdd(p.id, 1)) got++; else break; } S().gold -= p.price * got; if (got < p.count) toast('行囊空间不足，仅购入 ' + ((LF.ITEMS[p.id] || {}).name || p.id) + '×' + got); });
      shopSellPending.forEach(function (p) { S().gold += p.price * p.count; });
      var bn = shopBuyPending.map(function (p) { return ((LF.ITEMS[p.id] || {}).name || p.id) + '×' + p.count; }).join('、');
      var sn = shopSellPending.map(function (p) { return ((LF.ITEMS[p.defId] || {}).name || p.defId) + '×' + p.count; }).join('、');
      shopBuyPending = []; shopSellPending = [];
      if (typeof save === 'function') save(S());
      afterPackChange();
      toast('结算完成' + (bn ? ('：购入 ' + bn) : '') + (sn ? ('，售出 ' + sn) : ''));
      renderTrade();
    }
    // 结算明细浮层：确认前逐条列出购入/售出与收支，看清后再真正结算（防误触）
    function hideSettleDialog() { if (settleBox) { settleBox.remove(); settleBox = null; } }
    function showSettleDialog() {
      hideSettleDialog();
      var bn = 0, sn = 0;
      shopBuyPending.forEach(function (p) { bn += p.price * p.count; });
      shopSellPending.forEach(function (p) { sn += p.price * p.count; });
      if (!bn && !sn) { confirmTrade(); return; }   // 空交易直接过
      var rows = '';
      if (shopBuyPending.length) {
        rows += '<div class="sd-sec">购入 · 待付</div>';
        shopBuyPending.forEach(function (p) {
          var d = LF.ITEMS[p.id] || { name: p.id };
          rows += '<div class="sd-row"><span class="sd-nm">' + (d.icon ? d.icon + ' ' : '') + (d.name || p.id) + ' ×' + p.count + '</span><span class="sd-p pay">−' + fmtPrice(p.price * p.count) + '</span></div>';
        });
      }
      if (shopSellPending.length) {
        rows += '<div class="sd-sec">售出 · 待收</div>';
        shopSellPending.forEach(function (p) {
          var d = LF.ITEMS[p.defId] || { name: p.defId };
          rows += '<div class="sd-row"><span class="sd-nm">' + (d.icon ? d.icon + ' ' : '') + (d.name || p.defId) + ' ×' + p.count + '</span><span class="sd-p recv">+' + fmtPrice(p.price * p.count) + '</span></div>';
        });
      }
      var net = sn - bn;
      var netTxt = net > 0 ? '净收 ' + fmtPrice(net) : (net < 0 ? '净付 ' + fmtPrice(-net) : '收支相抵');
      var lack = bn - S().gold;
      var warn = lack > 0 ? '<div class="sd-warn">银两不足！还差 ' + fmtPrice(lack) + ' 两</div>' : '';
      var box = document.createElement('div');
      box.className = 'sd-mask';
      box.innerHTML = '<div class="sd-panel">'
        + '<div class="sd-title">结算明细</div>'
        + '<div class="sd-list">' + rows + '</div>'
        + '<div class="sd-total">将付 <b>' + fmtPrice(bn) + '</b> · 将收 <b>' + fmtPrice(sn) + '</b> · ' + netTxt + '</div>'
        + warn
        + '<div class="sd-acts">'
        + (lack > 0 ? '' : '<button class="sd-btn sd-ok" type="button">确认结算</button>')
        + '<button class="sd-btn sd-back" type="button">再想想</button>'
        + '</div></div>';
      box.onclick = function (e) { if (e.target === box) hideSettleDialog(); };
      box.querySelector('.sd-back').onclick = function () { hideSettleDialog(); };
      var okB = box.querySelector('.sd-ok'); if (okB) okB.onclick = function () { hideSettleDialog(); confirmTrade(); };
      document.body.appendChild(box);
      settleBox = box;
    }
    // 货郎详情：覆盖四种选中（左真货 / 右真物 / 右 buy 占位 / 左 sell 占位），与战利品栏同套 .loot-info 浮框
    function renderShopInfo() {
      if (shopGoodSel != null) {
        var shop = LF.SHOPS[shopState]; var r = null;
        if (shop) shop.items.forEach(function (x) { if (x.id === shopGoodSel) r = x; });
        if (r) {
          var def = LF.ITEMS[r.id] || {};
          var ic = def.icon ? ('<span style="font-size:15px;">' + def.icon + '</span> ') : '';
          var price = r.buy; var max = buyMaxNow(r.id);
          var h = '<div class="li-name">' + ic + (def.name || r.id) + '</div>';
          h += '<div class="li-cat">' + (def.cat || '货') + '</div>';
          h += '<div class="li-line">买价 ' + fmtPrice(price) + ' 两' + (max > 0 ? (' · 最多 ' + max + ' 件') : '') + '</div>';
          if (def.desc) h += '<div class="li-line" style="opacity:.85">' + def.desc + '</div>';
          if (max <= 0) h += '<div class="li-line" style="opacity:.7">银两或行囊不足。</div>';
          else {
            h += qtyRow(max);
            h += '<div class="li-acts"><button class="li-act" data-buygo="1" data-buyid="' + r.id + '">加入待付</button>'
              + '<button class="li-act" data-buygo="max" data-buyid="' + r.id + '">填满</button></div>';
          }
          return h;
        }
      }
      if (shopBuySel != null && shopBuyPending[shopBuySel]) { var bp = shopBuyPending[shopBuySel]; var d = LF.ITEMS[bp.id] || {};
        return '<div class="li-name">' + ((d.icon ? ('<span style="font-size:15px;">' + d.icon + '</span> ') : '') + (d.name || bp.id)) + '</div>'
          + '<div class="li-cat">待付购入</div>'
          + '<div class="li-line">将付 ' + fmtPrice(bp.price * bp.count) + '（' + bp.count + ' 件）</div>'
          + '<div class="li-line" style="opacity:.7">拖回左栏即取消</div>'
          + '<div class="li-acts"><button class="li-act" data-cancel="buy" data-ci="' + shopBuySel + '">取消</button></div>';
      }
      if (shopSellSel != null && shopSellPending[shopSellSel]) { var sp = shopSellPending[shopSellSel]; var sd = LF.ITEMS[sp.defId] || {};
        return '<div class="li-name">' + ((sd.icon ? ('<span style="font-size:15px;">' + sd.icon + '</span> ') : '') + (sd.name || sp.defId)) + '</div>'
          + '<div class="li-cat">寄售中</div>'
          + '<div class="li-line">将收 ' + fmtPrice(sp.price * sp.count) + '（' + sp.count + ' 件）</div>'
          + '<div class="li-line" style="opacity:.7">拖回右栏即取回</div>'
          + '<div class="li-acts"><button class="li-act" data-cancel="sell" data-ci="' + shopSellSel + '">取回</button></div>';
      }
      if (shopSel == null || !S().pack[shopSel]) return '<div class="li-name">货郎</div><div class="li-line">点选左边货品或右边物品，可看售价与详情。</div>';
      var it = S().pack[shopSel]; var spr = shopSellPrice(it.defId);
      var ic = itemIconHTML(it, 16);
      var h = '<div class="li-name">' + ic + ' ' + it.name + '</div>';
      h += '<div class="li-cat">' + (it.cat || '道具') + (it.count > 1 ? (' · ×' + it.count) : '') + '</div>';
      if (it.maxDur) h += '<div class="li-line">耐久 ' + it.dur + '/' + it.maxDur + '</div>';
      if (it.desc) h += '<div class="li-line" style="opacity:.85">' + it.desc + '</div>';
      // 与行囊/战利品一致：可装备 / 使用 / 放置 / 丢弃
      var acts = '';
      if (it.cat === '装备' && it.slot) acts += '<button class="li-act" data-eq="1" data-idx="' + shopSel + '" data-slot="' + it.slot + '">装 备</button>';
      if (it.effect) acts += '<button class="li-act" data-use="1" data-idx="' + shopSel + '">使 用</button>';
      var canPlace = it.placeable || (LF.ITEMS[it.defId] || {}).placeable || (LF.ITEMS[it.defId] || {}).place || (LF.ITEMS[it.defId] || {}).blueprint;
      if (canPlace) acts += '<button class="li-act" data-place="1" data-idx="' + shopSel + '">放 置</button>';
      acts += '<button class="li-act" data-discard="1" data-idx="' + shopSel + '">丢 弃</button>';
      if (spr != null) {
        var mx = it.count;
        h += qtyRow(mx);
        h += '<div class="li-acts"><button class="li-act" data-sellgo="1" data-selli="' + shopSel + '">寄售</button>' + acts + '</div>';
      } else {
        h += '<div class="li-line" style="opacity:.7">货郎不收此物。</div>';
        h += '<div class="li-acts">' + acts + '</div>';
      }
      return h;
    }
    // 货郎浮框（挂 body，跟随被点选格子定位，与战利品栏同款 .loot-info 浅色纸）
    function shopFloatShow(html, cell) {
      var f = document.getElementById('shop-float');
      if (!f) { f = document.createElement('div'); f.className = 'loot-info'; f.id = 'shop-float'; document.body.appendChild(f); }
      f.innerHTML = html; f.style.display = 'block'; positionShopFloat(f, cell);
      f.querySelectorAll('.li-step').forEach(function (b) { b.onclick = function () { var inp = f.querySelector('.li-qin'); if (!inp) return; var max = parseInt(inp.getAttribute('data-max'), 10) || 1; var v = parseInt(inp.value, 10) || 1; v = Math.max(1, Math.min(max, v + parseInt(b.getAttribute('data-step'), 10))); inp.value = v; }; });
      f.querySelectorAll('.li-qin').forEach(function (inp) { inp.oninput = function () { var max = parseInt(inp.getAttribute('data-max'), 10) || 1; var v = parseInt(inp.value, 10); if (isNaN(v) || v < 1) v = 1; if (v > max) v = max; inp.value = v; }; });
      f.querySelectorAll('[data-buygo]').forEach(function (b) { b.onclick = function () { var inp = f.querySelector('.li-qin'); var max = parseInt((inp && inp.getAttribute('data-max')) || '0', 10); var q = (b.getAttribute('data-buygo') === 'max') ? max : (parseInt(inp && inp.value, 10) || 1); addBuyPending(b.getAttribute('data-buyid'), q); }; });
      f.querySelectorAll('[data-sellgo]').forEach(function (b) { b.onclick = function () { var inp = f.querySelector('.li-qin'); var q = Math.max(1, parseInt(inp && inp.value, 10) || 1); addSellPending(parseInt(b.getAttribute('data-selli'), 10), q); }; });
      f.querySelectorAll('[data-buyq]').forEach(function (b) { b.onclick = function () { var q = parseInt(b.getAttribute('data-buyq'), 10); if (q <= 0) { showShopFloat(); return; } addBuyPending(b.getAttribute('data-buyid'), q); }; });
      f.querySelectorAll('[data-sellq]').forEach(function (b) { b.onclick = function () { addSellPending(parseInt(b.getAttribute('data-selli'), 10), parseInt(b.getAttribute('data-sellq'), 10)); }; });
      f.querySelectorAll('[data-cancel]').forEach(function (b) { b.onclick = function () { if (b.getAttribute('data-cancel') === 'buy') removeBuyPending(parseInt(b.getAttribute('data-ci'), 10)); else removeSellPending(parseInt(b.getAttribute('data-ci'), 10)); }; });
      f.querySelectorAll('[data-eq]').forEach(function (b) { b.onclick = function () { var idx = parseInt(b.getAttribute('data-idx'), 10); var slot = b.getAttribute('data-slot'); if (window.LFUI && window.LFUI.equipFromPackTo) window.LFUI.equipFromPackTo(idx, slot); renderTrade(); }; });
      f.querySelectorAll('[data-use]').forEach(function (b) { b.onclick = function () { var idx = parseInt(b.getAttribute('data-idx'), 10); if (window.LFUI && window.LFUI.usePackItem) window.LFUI.usePackItem(idx); renderTrade(); }; });
      f.querySelectorAll('[data-place]').forEach(function (b) { b.onclick = function () { var idx = parseInt(b.getAttribute('data-idx'), 10); if (window.LFUI && window.LFUI.placeFromPackTo) window.LFUI.placeFromPackTo(idx); renderTrade(); }; });
      f.querySelectorAll('[data-discard]').forEach(function (b) { b.onclick = function () { var idx = parseInt(b.getAttribute('data-idx'), 10); if (window.LFUI && window.LFUI.discardPackItem) window.LFUI.discardPackItem(idx); renderTrade(); }; });
    }
    function showShopFloat() { shopFloatShow(renderShopInfo(), $card.querySelector('.pcell-sel')); }
    // 货郎浮框跟随被点选的物品（与行囊/战利品一致）：空间不足自动翻到上方、夹在视口内，不再钉死底部
    function positionShopFloat(box, cell) { positionFloat(box, cell); }
    function bindShopPanel() {
      var card = document.getElementById('modal-card'); if (!card) return;
      function clearSel(sel) { card.querySelectorAll(sel).forEach(function (c) { c.classList.remove('pcell-sel'); }); }
      // 左栏：真货点选 / sell 占位点选（数据驱动，统一处理）
      card.querySelectorAll('[data-shop],[data-sellp]').forEach(function (el) {
        el.onclick = function (e) {
          if (el.__dragMoved) { el.__dragMoved = false; return; }
          if (e.target.closest('.pcell-x')) return;
          shopSel = null; shopBuySel = null; clearSel('.shop-right .packcell'); clearSel('[data-sellp]'); clearSel('[data-shop]');
          var sid = el.getAttribute('data-shop'), sp = el.getAttribute('data-sellp');
          if (sid != null) shopGoodSel = sid; else if (sp != null) shopSellSel = parseInt(sp, 10);
          el.classList.add('pcell-sel'); showShopFloat();
        };
        el.setAttribute('draggable', 'true');
        el.ondragstart = function (e) {
          var _sf = document.getElementById('shop-float'); if (_sf) _sf.style.display = 'none';
          var sid = el.getAttribute('data-shop'), uid = el.getAttribute('data-selluid');
          e.dataTransfer.setData('text/plain', JSON.stringify({ kind: (sid != null ? 'buy' : 'sellp'), payload: (sid != null ? sid : parseInt(uid, 10)) }));
        };
      });
      // 右栏：真物点选 / buy 占位点选
      card.querySelectorAll('.shop-right [data-loc],.shop-right [data-buyp]').forEach(function (el) {
        el.onclick = function (e) {
          if (el.__dragMoved) { el.__dragMoved = false; return; }
          if (e.target.closest('.pcell-x')) return;
          shopGoodSel = null; shopSellSel = null; clearSel('[data-shop]'); clearSel('[data-sellp]'); clearSel('.shop-right .packcell');
          var loc = el.getAttribute('data-loc'), bp = el.getAttribute('data-buyp');
          if (loc != null) { var idx = locIdx(loc); shopSel = (S().pack[idx]) ? idx : null; }
          else if (bp != null) shopBuySel = parseInt(bp, 10);
          el.classList.add('pcell-sel'); showShopFloat();
        };
        el.setAttribute('draggable', 'true');
        el.ondragstart = function (e) {
          var _sf = document.getElementById('shop-float'); if (_sf) _sf.style.display = 'none';
          var loc = el.getAttribute('data-loc'), bp = el.getAttribute('data-buyp');
          var payload = loc != null ? locIdx(loc) : parseInt(bp, 10);
          if (loc != null && !S().pack[payload]) { e.preventDefault(); return; }
          e.dataTransfer.setData('text/plain', JSON.stringify({ kind: (loc != null ? 'sell' : 'buyp'), payload: payload }));
        };
      });
      // 原生 HTML5 拖拽落点（桌面）：drop 后立即 renderTrade 即时反馈（否则要等下次结算/买卖才刷新）
      var left = card.querySelector('.shop-left'), right = card.querySelector('.shop-right');
      left.ondragover = function (e) { e.preventDefault(); };
      left.ondrop = function (e) { e.preventDefault(); try { var d = JSON.parse(e.dataTransfer.getData('text/plain')); if (d.kind === 'buy') dropLeft('g:' + d.payload, e.target); else if (d.kind === 'sell') addSellPending(d.payload, 1); else if (d.kind === 'buyp') removeBuyPending(d.payload); else if (d.kind === 'sellp') dropLeft('s:' + d.payload, e.target); } catch (_) { } renderTrade(); };   // buy/sellp 落左栏：统一换位/堆叠/末尾；sell 落左栏=寄售；buyp 落左栏=取消
      right.ondragover = function (e) { e.preventDefault(); };
      right.ondrop = function (e) { e.preventDefault(); try { var d = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (d.kind === 'sell') { var t2 = e.target.closest && e.target.closest('.shop-right [data-cell],[data-loc]'); if (t2) { var c2 = t2.getAttribute('data-cell') != null ? parseInt(t2.getAttribute('data-cell'), 10) : locIdx(t2.getAttribute('data-loc')); var bpAt = buyPendingAtCell(c2); if (bpAt >= 0) placeBuyPending(shopBuyPending[bpAt], d.payload); else reorderPackAtEl(t2, d.payload); } else { var fi = firstEmptyPackIdx(); if (fi >= 0 && fi !== d.payload) swapPackSlots(d.payload, fi); } }
        else if (d.kind === 'buy') addBuyPending(d.payload, 1);
        else if (d.kind === 'sellp') { var _sd = sellIdxByUid(parseInt(d.payload, 10)); if (_sd >= 0) removeSellPending(_sd); }
        else if (d.kind === 'buyp') { var t3 = e.target.closest && e.target.closest('.shop-right [data-cell],[data-loc]'); if (t3) { var c3 = t3.getAttribute('data-cell') != null ? parseInt(t3.getAttribute('data-cell'), 10) : locIdx(t3.getAttribute('data-loc')); placeBuyPending(shopBuyPending[d.payload], c3); } }
      } catch (_) { } renderTrade(); };   // sell 落右栏：空格/真物格换位，待付格则待付让位；buyp 落右栏任意格=待付移入该格（自由摆放）
      // 触屏 pointer 拖拽：轻点(tap)放行 click 选中；位移超阈值才进入拖拽（否则"点选像被锁定/没反应"）
      var ghost = null, dragging = null, srcEl = null, sx = 0, sy = 0, moved = false, dropEl = null;
      var pending = null;   // 按下但未确认拖拽的候选项 {kind,payload,el,sx,sy}
      function shopDragInfo(el) {
        var loc = el.getAttribute('data-loc'), bp = el.getAttribute('data-buyp'), sid = el.getAttribute('data-shop');
        if (loc != null) { var idx = locIdx(loc); return S().pack[idx] ? { kind: 'sell', payload: idx } : null; }   // 行囊空格不可拖
        if (bp != null) return { kind: 'buyp', payload: parseInt(bp, 10) };
        if (sid != null) { if (el.classList.contains('shop-bad')) return null; return { kind: 'buy', payload: sid }; }
        return { kind: 'sellp', payload: parseInt(el.getAttribute('data-selluid'), 10) };
      }
      function armDrag(di, el, e) { pending = { kind: di.kind, payload: di.payload, el: el, sx: e.clientX, sy: e.clientY }; }
      function beginDrag() {
        if (!pending) return;
        dragging = { kind: pending.kind, payload: pending.payload };
        srcEl = pending.el; moved = false; pending.el.__dragMoved = false;
        sx = pending.sx; sy = pending.sy;
        pending = null;
        var _sf = document.getElementById('shop-float'); if (_sf) _sf.style.display = 'none';
      }
      card.querySelectorAll('.shop-right [data-loc],.shop-right [data-buyp],[data-shop],[data-sellp]').forEach(function (el) {
        el.onpointerdown = function (e) {
          if (e.pointerType === 'mouse') return;   // 桌面走 HTML5 拖拽
          if (e.target.closest('.pcell-x')) return;
          var di = shopDragInfo(el); if (!di) return;
          armDrag(di, el, e);
        };
      });
      card.onpointermove = function (e) {
        if (pending) { if (Math.abs(e.clientX - pending.sx) > 12 || Math.abs(e.clientY - pending.sy) > 12) beginDrag(); }
        if (!dragging) return;
        if (!moved) { if (Math.abs(e.clientX - sx) < 8 && Math.abs(e.clientY - sy) < 8) return; moved = true; srcEl && (srcEl.__dragMoved = true); }
        if (!ghost) { ghost = document.createElement('div'); ghost.className = 'pack-ghost'; document.body.appendChild(ghost); }
        var nm;
        if (dragging.kind === 'sell') nm = (S().pack[dragging.payload] || {}).name || '';
        else if (dragging.kind === 'buyp') nm = '待付·' + ((LF.ITEMS[shopBuyPending[dragging.payload] && shopBuyPending[dragging.payload].id] || {}).name || '');
        else if (dragging.kind === 'sellp') { var _spi = sellIdxByUid(dragging.payload); nm = '寄售·' + ((LF.ITEMS[shopSellPending[_spi] && shopSellPending[_spi].defId] || {}).name || ''); }
        else nm = (LF.ITEMS[dragging.payload] || {}).name || '';
        ghost.textContent = nm; ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
        // 拖拽目标格实时高亮，提供落点反馈
        var under = document.elementFromPoint(e.clientX, e.clientY);
        var cell = (under && under.closest) ? under.closest('.shop-right [data-cell],[data-loc], [data-shop], [data-buyp], [data-selluid]') : null;
        if (dropEl && dropEl !== cell) { dropEl.classList.remove('shop-drop'); dropEl = null; }
        if (cell && cell !== dropEl) { dropEl = cell; cell.classList.add('shop-drop'); }
      };
      function endDrag(e, cancelled) {
        var d = dragging; dragging = null; if (ghost) { ghost.remove(); ghost = null; }
        if (dropEl) { dropEl.classList.remove('shop-drop'); dropEl = null; }
        if (!d || !moved || cancelled) return;
        var L = card.querySelector('.shop-left'), R = card.querySelector('.shop-right');
        // 右栏=我的行囊，左栏=货郎。拖到**同栏**=整理换位；拖到**对侧**=买卖。
        if (inRect(e, R)) {
          if (d.kind === 'sell') {
            var tR = document.elementFromPoint(e.clientX, e.clientY) || e.target;
            var tRc = tR && tR.closest ? tR.closest('.shop-right [data-cell],[data-loc]') : null;
            if (tRc) {
              var cR = tRc.getAttribute('data-cell') != null ? parseInt(tRc.getAttribute('data-cell'), 10) : locIdx(tRc.getAttribute('data-loc'));
              var bpR = buyPendingAtCell(cR);
              if (bpR >= 0) placeBuyPending(shopBuyPending[bpR], d.payload);   // 真物拖到待付格：待付让位到真物源格
              else reorderPackAtEl(tRc, d.payload);                              // 空格/真物格：换位（持久化）
            } else { var fi = firstEmptyPackIdx(); if (fi >= 0 && fi !== d.payload) swapPackSlots(d.payload, fi); }
          }
          else if (d.kind === 'buy') addBuyPending(d.payload, 1);          // 货郎货→行囊=购买
          else if (d.kind === 'sellp') { var _sd2 = sellIdxByUid(d.payload); if (_sd2 >= 0) removeSellPending(_sd2); }   // 待售→行囊=取回/取消
          else if (d.kind === 'buyp') { var tRp = document.elementFromPoint(e.clientX, e.clientY) || e.target; var tR2 = tRp && tRp.closest ? tRp.closest('.shop-right [data-cell],[data-loc]') : null; if (tR2) { var cRp = tR2.getAttribute('data-cell') != null ? parseInt(tR2.getAttribute('data-cell'), 10) : locIdx(tR2.getAttribute('data-loc')); placeBuyPending(shopBuyPending[d.payload], cRp); } }   // 待付拖到右栏任意格：自由摆放（空格/真物格/其他待付格）
        } else if (inRect(e, L)) {
          if (d.kind === 'buy') { var tL = document.elementFromPoint(e.clientX, e.clientY) || e.target; dropLeft('g:' + d.payload, tL); }   // 真货在左栏内换位/到末尾
          else if (d.kind === 'sell') addSellPending(d.payload, 1);        // 行囊物→货郎=寄售
          else if (d.kind === 'buyp') removeBuyPending(d.payload);         // 待付→货郎=取消购买
          else if (d.kind === 'sellp') { var tLp = document.elementFromPoint(e.clientX, e.clientY) || e.target; dropLeft('s:' + d.payload, tLp); }   // 待售在左栏内：拖到同物=堆叠，拖到其他格=换位，拖空白=末尾
        }
        renderTrade();
      }
      card.onpointerup = function (e) { if (pending) { pending = null; return; } endDrag(e, false); };   // 轻点未进入拖拽：放行 click 选中
      card.onpointercancel = function (e) { if (pending) { pending = null; return; } endDrag(e, true); };
      var ok = document.getElementById('trade-ok'); if (ok) ok.onclick = function () {
        if (shopBuyPending.length === 0 && shopSellPending.length === 0) { confirmTrade(); return; }   // 空交易直接跳过
        showSettleDialog();   // 有交易：弹出明细浮层，逐条看清将付/将收后再确认（防误触）
      };
      var lv = document.getElementById('m-leave'); if (lv) lv.onclick = function () { delete shopGoodsOrder[shopState]; restoreTradePending(); hideSettleDialog(); closeModal(); };
      // 待结算占位上的直接「✕」取消（始终可达，不必先点开浮框）
      card.querySelectorAll('.pcell-x').forEach(function (x) {
        x.onpointerdown = function (e) { e.stopPropagation(); };
        x.onclick = function (e) { e.stopPropagation(); var ci = parseInt(x.getAttribute('data-ci'), 10); if (x.getAttribute('data-cx') === 'buy') removeBuyPending(ci); else removeSellPending(ci); };
      });
      // 「清空待结算」：一键取回所有待付/待售（取消整笔交易）
      var clr = document.getElementById('trade-clear'); if (clr) clr.onclick = function () { restoreTradePending(); renderTrade(); toast('已清空待结算。'); };
      var ps = document.getElementById('pack-sort'); if (ps) ps.onclick = function () { if (window.LFUI && window.LFUI.packAutoSort) { window.LFUI.packAutoSort(); renderTrade(); } };
      card.onpointerdown = function (e) {
        if (e.target.closest('.shop-good') || e.target.closest('.shop-right .packcell') || e.target.closest('#shop-float')) return;
        var f = document.getElementById('shop-float'); if (f) f.style.display = 'none';
      };
    }
    // 货郎拖拽命中判定（触屏 pointer 拖拽用）
    function inRect(e, el) { if (!el) return false; var r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
    // 计算某货品当前最多能买几件（受金币与行囊空间共同限制）
    function buySpaceLimit(id) {
      var it = LF.ITEMS.makeItem(id, 1); if (!it) return 0;
      if (packIsStackable(it)) {          // 可堆叠：已有同类则不限，否则需 1 真空格（待付占用的格不算）
        if (packFind(id)) return 9999;
        return firstFreeCellForBuy() >= 0 ? 9999 : 0;
      }
      var empt = 0; for (var i = 0; i < S().pack.length; i++) { if (!S().pack[i] && buyPendingAtCell(i) < 0) empt++; }
      return empt;
    }
    // 某货品本笔交易「当前最多还能买几件」：减去已加入待付的部分（金币 + 行囊共同限制）
    function buyMaxNow(id) {
      var shop = LF.SHOPS[shopState]; var r = null; if (shop) shop.items.forEach(function (x) { if (x.id === id) r = x; });
      if (!r || !r.buy) return 0;
      var used = 0; shopBuyPending.forEach(function (p) { used += p.price * p.count; });
      var maxByGold = Math.floor((S().gold - used) / r.buy);
      var maxBySpace = buySpaceLimit(id) - buyPendingCount(id);
      return Math.max(0, Math.min(maxByGold, maxBySpace));
    }
    // 详情浮框里的数量步进器（− 数字 +），data-max 为上限
    function qtyRow(max) {
      return '<div class="li-qty">'
        + '<button class="li-step" type="button" data-step="-1">−</button>'
        + '<input class="li-qin" type="number" inputmode="numeric" min="1" max="' + max + '" value="1" data-max="' + max + '">'
        + '<button class="li-step" type="button" data-step="1">＋</button>'
        + '<span class="li-qmax">/ ' + max + '</span></div>';
    }
    // 打开货郎：设定当前商店、复位选择态与待结算占位，返回面板 HTML
    function openShop(id) {
      shopState = id || 'build_pedlar';
      shopSel = null; shopGoodSel = null; shopBuySel = null; shopSellSel = null;
      shopBuyPending = []; shopSellPending = [];
      leftSeq = null; sellUidSeq = 1;
      return renderShopPanel();
    }

    return {
      openShop: openShop,
      bindShopPanel: bindShopPanel,
      restoreTradePending: restoreTradePending,
      addBuyPending: addBuyPending,
      addSellPending: addSellPending,
      removeBuyPending: removeBuyPending,
      removeSellPending: removeSellPending,
      confirmTrade: confirmTrade,
      renderShopPanel: renderShopPanel
    };
  };
})(window);

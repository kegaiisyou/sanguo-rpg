// 乱世烽火 · 城内营造子系统（cityBuild* 微观委派营造 + 工单跨日推进 + 每日市租 + 城内格移动）
// 写路径：deep 纠缠 exert(精力)/背包(pack*)/buildOrders(状态)/日循环/渲染/开放模态，故依赖经 ctx 注入。
// 注意：cityCellSiteName 留引擎（地图视图 mapview.js 经 ctx 依赖它）；城市内部探索(buildingState/renderBuildingPanel)
// 不属本模块，仍留引擎。
// UMD：浏览器挂到 window.LF，Node 端走 module.exports（校验用）
(function (global) {
  var LF = global.LF || (global.LF = {});
  LF.createCityBuild = function (ctx) {
    // 惰性取值：state/currentModalKind/cityBuildState 均为引擎中后赋值或随运行变化的绑定，必须用 getter
    var S = ctx.getState, CMK = ctx.getCurrentModalKind, CBS = ctx.getCityBuildState,
        LF_ = ctx.LF,
        cellDisplayType = ctx.cellDisplayType, cellDisplayName = ctx.cellDisplayName,
        ensureCityState = ctx.ensureCityState, cityCellInst = ctx.cityCellInst, setCityCell = ctx.setCityCell,
        nextBuildOrderId = ctx.nextBuildOrderId, buildOrderById = ctx.buildOrderById, activeBuildOrder = ctx.activeBuildOrder,
        packFind = ctx.packFind, packConsume = ctx.packConsume, afterPackChange = ctx.afterPackChange,
        toast = ctx.toast, log = ctx.log, save = ctx.save, openModal = ctx.openModal, closeModal = ctx.closeModal,
        advanceTime = ctx.advanceTime, exert = ctx.exert, renderRoom = ctx.renderRoom, itemIconHTML = ctx.itemIconHTML,
        npcBuildSpeed = ctx.npcBuildSpeed;

    // 候选蓝图：依当前格类型过滤城市类图纸（v20260826）
    function cityBuildBpList(cid, x, y) {
      var out = [], cur = cellDisplayType(cid, x, y);
      for (var k in LF_.BUILD) {
        var bp = LF_.BUILD[k];
        if (!bp || !bp.city) continue;
        if ((bp.onTypes || []).indexOf(cur) < 0) continue;
        out.push({ id: k, bp: bp });
      }
      return out;
    }
    // 图纸总耗材（各阶段 need 累加）
    function cityBuildMatTotal(bp) {
      var total = {};
      (bp.stages || []).forEach(function (s) { for (var mk in s.need) total[mk] = (total[mk] || 0) + s.need[mk]; });
      return total;
    }
    // 开工：校验图纸/已占用 → 落 buildOrders + cityCells 占位（built:false），耗图样、入模态
    function startCityBuild(cid, x, y, bpId) {
      var bp = LF_.BUILD[bpId]; if (!bp) return;
      if (bp.tuzhi) {
        var tzd = LF_.ITEMS[bp.tuzhi] || {};
        if (!packFind(bp.tuzhi)) { toast('营造「' + (bp.doneName || '此建筑') + '」需先持有「' + (tzd.name || '图纸') + '」——可于货郎处购得。'); return; }
      }
      var inst = cityCellInst(cid, x, y);
      if (inst && inst.built) { toast('此格已有建筑落成。'); return; }
      if (inst && !inst.built) { toast('此格已有工地，去「继续营造」推进工事。'); return; }
      ensureCityState(cid);
      S().flags.buildOrders = S().flags.buildOrders || {};
      var id = nextBuildOrderId();
      var stages = bp.stages || [], matsNeeded = {};
      stages.forEach(function (s) { for (var mk in s.need) { matsNeeded[mk] = (matsNeeded[mk] || 0) + s.need[mk]; } });
      S().flags.buildOrders[id] = {
        id: id, cid: cid, x: x, y: y, blueprintId: bpId,
        requester: 'player', level: 1,
        matsNeeded: matsNeeded, matsPaid: {},
        laborNeeded: (bp.labor || 2), laborPaid: 0, moneyPaid: 0,
        stages: stages, stageIndex: 0,
        startDay: (S().day || 0), estDays: 0, status: 'building', assignedNpc: null
      };
      setCityCell(cid, x, y, { type: bp.cellType || 'home', level: 1, shops: [], owner: 'player', built: false, buildOrderId: id });
      if (bp.tuzhi) packConsume(bp.tuzhi, 1);
      log('你持「' + ((LF_.ITEMS[bp.tuzhi] || {}).name || '图样') + '」择定空地，破土动工——「' + (bp.doneName || '新筑') + '」开始营造！', 'sys');
      save(S());
      openModal('citybuild', { cid: cid, x: x, y: y });
    }
    // 投料：每投入 1 份材料耗时 1 时辰 + 精力 1
    function cityBuildMat(o, matId) {
      var bp = LF_.BUILD[o.blueprintId]; if (!bp || o.status !== 'building') return;
      var stage = (bp.stages || [])[o.stageIndex]; if (!stage) return;
      var need = stage.need[matId]; if (!need) return;
      if ((o.matsPaid[matId] || 0) >= need) { toast('「' + stage.name + '」所需此料已备齐。'); return; }
      var cur = packFind(matId);
      if (!cur || (cur.count || 0) < 1) { toast('行囊中无' + (LF_.ITEMS[matId] || {}).name + '。'); return; }
      if (S().energy <= 0) { toast('精力已尽，先休整恢复再行填充。'); return; }
      advanceTime(1);
      S().energy = Math.max(0, S().energy - 1);
      packConsume(matId, 1);
      o.matsPaid[matId] = (o.matsPaid[matId] || 0) + 1;
      save(S()); afterPackChange();
      log('你投入' + (LF_.ITEMS[matId] || {}).name + '×1 于「' + stage.name + '」。', 'env');
      if (CMK() === 'citybuild') openModal('citybuild', { cid: o.cid, x: o.x, y: o.y });
    }
    // 营造：本阶段材料备齐后，每轮 exert 推 laborPaid；满则进入下一阶段，末阶段满则落成
    function cityBuildExert(o) {
      var bp = LF_.BUILD[o.blueprintId]; if (!bp || o.status !== 'building') return;
      var stages = bp.stages || [];
      var stage = stages[o.stageIndex];
      if (!stage) { finishCityBuild(o); return; }
      for (var mk in stage.need) { if ((o.matsPaid[mk] || 0) < stage.need[mk]) { toast('「' + stage.name + '」材料未齐，无法营造。'); return; } }
      if (S().energy <= 0) { toast('精力已尽，先休整恢复再行营造。'); return; }
      if (!exert('营造')) return;
      advanceTime(1);
      S().energy = Math.max(0, S().energy - 2);
      o.laborPaid = (o.laborPaid || 0) + 1;
      var needLabor = (bp.labor || 2);
      save(S()); afterPackChange();
      if (o.laborPaid >= needLabor) {
        o.laborPaid = 0;
        o.stageIndex++;
        if (o.stageIndex >= stages.length) { finishCityBuild(o); return; }
        log('你完成了「' + stage.name + '」，工事推进至「' + stages[o.stageIndex].name + '」。', 'env');
      } else {
        log('你挥汗如雨，昼夜营造——「' + stage.name + '」工事更进一层（' + o.laborPaid + '/' + needLabor + '）。', 'env');
      }
      if (CMK() === 'citybuild') openModal('citybuild', { cid: o.cid, x: o.x, y: o.y });
    }
    // 落成：built=true 写入 cityCells 覆盖层；市集预设空铺面（后续招商/升级）
    function finishCityBuild(o) {
      var bp = LF_.BUILD[o.blueprintId] || {};
      var inst = cityCellInst(o.cid, o.x, o.y);
      if (inst) {
        inst.built = true; inst.type = bp.cellType || inst.type;
        if (inst.type === 'market' && !inst.shops) inst.shops = [];
      }
      o.status = 'done';
      var cnm = ((LF_.CITIES || {})[o.cid] || {}).name || '城中';
      log('〔工成〕' + (bp.doneName || '建筑') + '于「' + cnm + '」落成！匠人散去，百姓渐聚。', 'good');
      save(S()); afterPackChange();
      if (S().room === o.cid) renderRoom(o.cid, true);
      closeModal();
    }
    // 持有图纸/简册清单（用于营造面板提示；图样物品以 blueprint 字段标识，v20260908 起 cat 已更名为「简册」）
    function heldTuzhiList() {
      var out = [];
      (S().pack || []).forEach(function (it) { if (it && (LF_.ITEMS[it.defId] || {}).blueprint) out.push(it); });
      return out;
    }
    // 营造面板 HTML（依城市格状态：空地候选 / 工地进度 / 已落成）
    function renderCityBuildPanel() {
      var st = CBS(), cid = st.cid, x = st.x, y = st.y;
      if (cid == null || x == null || y == null) return '<h3>营 造</h3><p class="tip">未定位营造地点。</p>';
      var inst = cityCellInst(cid, x, y);
      var cnm = ((LF_.CITIES || {})[cid] || {}).name || '城中';
      var head = '<h3>营 造 · ' + cnm + '</h3>';
      var body = '';
      if (inst && !inst.built) {
        var o = activeBuildOrder(cid, x, y);
        body = o ? renderCityBuildProgress(o) : '<p class="tip">工地空置，工匠徘徊。去别处空地择图开工。</p>';
      } else if (inst && inst.built) {
        body = renderCityBuildDone(inst);
      } else {
        var list = cityBuildBpList(cid, x, y);
        if (!list.length) {
          body = '<p class="tip">此格（' + cellDisplayName(cid, cellDisplayType(cid, x, y)) + '）无可营造之蓝图——寻城中空地（🟫）营造。</p>';
        } else {
          var held = heldTuzhiList();
          var holdHtml = '<p class="tip" style="border:1px dashed #6b5a3a;padding:6px;border-radius:8px;">持有图纸：' + (held.length ? held.map(function (it) { var d = LF_.ITEMS[it.defId] || {}; return (d.icon || '') + (d.name || it.defId) + '×' + (it.count || 1); }).join('　') : '无（可于「货郎」处购得城市营造图样）') + '</p>';
          body = holdHtml + '<p class="tip">此地为「' + cellDisplayName(cid, cellDisplayType(cid, x, y)) + '」。持图者方可开工：</p>';
          list.forEach(function (it) {
            var bp = it.bp, total = cityBuildMatTotal(bp), mats = '';
            for (var mk in total) mats += ((LF_.ITEMS[mk] || {}).name || mk) + '×' + total[mk] + '　';
            var has = !bp.tuzhi || packFind(bp.tuzhi);
            var badge = bp.tuzhi ? '　〔' + (has ? '持图' : '缺图') + '〕' : '';
            var btn = has ? '<button class="btn-mini" data-start="' + it.id + '">开 工</button>' : '<button class="btn-mini" disabled style="opacity:.5;cursor:not-allowed;">缺 图</button>';
            body += '<div style="display:flex;align-items:center;gap:10px;border:1px solid #6b5a3a;border-radius:8px;padding:8px;margin:6px 0;background:rgba(0,0,0,.18);">' +
              '<div style="flex:1;"><b>' + bp.doneName + badge + '</b><div class="tip">' + bp.desc + '</div>' +
              '<div class="tip">耗材：' + mats + '　营造：' + (bp.stages || []).length + ' 阶段 × ' + (bp.labor || 2) + ' 轮</div></div>' +
              '<span style="flex:none;">' + btn + '</span></div>';
          });
        }
      }
      return head + body + '<button class="btn-mini" id="cb-leave" style="width:100%;margin-top:8px;">收 工</button>';
    }
    // 阶段进度（材料投料 + 人力营造）
    function renderCityBuildProgress(o) {
      var bp = LF_.BUILD[o.blueprintId] || {};
      var stages = bp.stages || [];
      var stage = stages[o.stageIndex];
      if (!stage) return '<p class="tip">工事已毕，只待收尾。</p>';
      var html = '<p class="tip">营造「<b>' + bp.doneName + '</b>」· 阶段 ' + Math.min(o.stageIndex + 1, stages.length) + ' / ' + stages.length + '　当前·<b>' + stage.name + '</b></p>';
      for (var k in stage.need) {
        var it = LF_.ITEMS[k] || {};
        var have = o.matsPaid[k] || 0, need = stage.need[k], packN = (packFind(k) || { count: 0 }).count;
        var done = have >= need;
        html += '<div style="display:flex;align-items:center;gap:8px;border:1px solid #6b5a3a;border-radius:8px;padding:8px;margin:6px 0;background:rgba(0,0,0,.18);">' +
          '<span>' + itemIconHTML(it, 18) + '</span>' +
          '<span style="opacity:.8;flex:1;">' + have + ' / ' + need + '　·　行囊' + packN + '</span>' +
          (done ? '<span style="color:#8fce8f;">已备齐</span>' : '<button class="btn-mini" data-order="' + o.id + '" data-mat="' + k + '">投 料</button>') +
          '</div>';
      }
      var matsOk = true;
      for (var k2 in stage.need) { if ((o.matsPaid[k2] || 0) < stage.need[k2]) { matsOk = false; break; } }
      html += '<div style="display:flex;align-items:center;gap:8px;border:1px solid #6b5a3a;border-radius:8px;padding:8px;margin:6px 0;background:rgba(0,0,0,.18);">' +
        '<span>⚒️</span><span style="opacity:.8;flex:1;">营造进度（人力）' + o.laborPaid + ' / ' + (bp.labor || 2) + '</span>' +
        (matsOk ? '<button class="btn-mini" data-order="' + o.id + '" data-exert="1">营 造</button>' : '') +
        '</div>';
      if (!matsOk) html += '<p class="tip">投齐本阶段材料，方可开营造（每轮耗时 1 时辰、耗 4 精力）。</p>';
      return html;
    }
    // 已落成说明
    function renderCityBuildDone(inst) {
      var nm = cellDisplayName(CBS().cid, inst.type);
      var ownerName = inst.owner === 'player' ? '你' : (inst.owner || '未知');
      return '<p class="tip">「' + nm + '」已然落成（等级 ' + (inst.level || 1) + '，产权：' + ownerName + '）。' +
        (inst.type === 'market' ? '　市集每日可收市租（10 钱/级），银两自动入你名下。' : '') + '</p>';
    }
    // 面板交互绑定（开工 / 投料 / 营造 / 收工）
    function bindCityBuildPanel() {
      var st = CBS();
      var card = document.querySelector('#modal-card');
      if (!card) return;
      card.querySelectorAll('[data-start]').forEach(function (b) {
        b.onclick = function () { startCityBuild(st.cid, st.x, st.y, b.getAttribute('data-start')); };
      });
      card.querySelectorAll('[data-mat]').forEach(function (b) {
        b.onclick = function () { var o = buildOrderById(b.getAttribute('data-order')); if (o) cityBuildMat(o, b.getAttribute('data-mat')); };
      });
      card.querySelectorAll('[data-exert]').forEach(function (b) {
        b.onclick = function () { var o = buildOrderById(b.getAttribute('data-order')); if (o) cityBuildExert(o); };
      });
      var lv = document.getElementById('cb-leave'); if (lv) lv.onclick = function () { closeModal(); };
    }
    // ══ 宏观工单推进 + 每日市租（第3步）══
    // 微观(requester:'player')由玩家现场 exert 推进；宏观(requester:npcId)每日跨子夜按 estDays 推进（第5步政令台委派启用）
    function tickBuildOrders(n) {
      var bo = S().flags.buildOrders;
      if (!bo || n <= 0) return;
      for (var id in bo) {
        var o = bo[id]; if (!o || o.status !== 'building') continue;
        if (o.requester === 'player') continue;
        var mul = (typeof npcBuildSpeed === 'function') ? npcBuildSpeed(o.assignedNpc) : 1;
        o.laborPaid = (o.laborPaid || 0) + Math.max(1, Math.ceil((o.laborNeeded || 1) / Math.max(1, (o.estDays || 1)) * n * mul));
        var mats = o.matsNeeded || {};
        for (var mk in mats) o.matsPaid[mk] = mats[mk];
        if (o.laborPaid >= (o.laborNeeded || 1)) {
          o.status = 'done';
          commitBuildOrder(o);
          var _bp = LF_.BUILD[o.blueprintId] || {};
          log('〔工成〕' + (_bp.doneName || '建筑') + '落成（工单 ' + o.id + '）。', 'sys');
        }
      }
      collectRents();
    }
    // 工单落成：写入 cityCells 覆盖层
    function commitBuildOrder(o) {
      var bp = LF_.BUILD[o.blueprintId] || {};
      var inst = cityCellInst(o.cid, o.x, o.y);
      if (inst) { inst.built = true; inst.type = bp.cellType || inst.type; inst.level = o.level || inst.level; }
    }
    // 市租：已建市集按等级每日入其 owner 名下（player→state.gold；其余留待第5/6步势力钱袋）
    function collectRents() {
      var cc = S().flags.cityCells; if (!cc) return;
      for (var cid in cc) {
        var cells = cc[cid]; if (!cells) continue;
        for (var k in cells) {
          var c = cells[k];
          if (!c || c.type !== 'market' || !c.built) continue;
          var rent = (c.level || 1) * 10;
          if (c.owner === 'player') S().gold = (S().gold || 0) + rent;
        }
      }
    }
    // 城内格移动（相邻一格；经城门省力）——城内地图模式下同步刷新网格
    function goCell(cid, x, y) {
      var cp = S().flags.cityPos; if (!cp || cp.cid !== cid) return;
      if (Math.abs(cp.x - x) + Math.abs(cp.y - y) !== 1) return;   // 仅相邻格可移动
      if (!exert('远行')) return;
      var ri = (cellDisplayType(cid, x, y) === 'gate') ? { gate: true, nm: '城门' } : null;
      var eng = (ri ? 1 : 2);   // 经城门省力
      S().energy = Math.max(0, S().energy - eng);
      S().food = Math.max(0, S().food - 1); S().drink = Math.max(0, S().drink - 1);
      advanceTime(1);
      S().flags.cityPos = { cid: cid, x: x, y: y };
      // v20260910p：kuyilao 囚室格 (1,0) 踏到即入 camp_prison——直接见天字/地字六间子牢房，无按钮层
      if (cid === 'kuyilao' && x === 1 && y === 0) {
        S().room = 'camp_prison';
        S().moveGate = null;
        save(S());
        renderRoom('camp_prison', true);
        if (CMK() === 'map') openModal('map');
        return;
      }
      if (ri) {
        log('你行至城门口，城门在望……', 'sys');
      } else {
        log('你转入城中街巷，景物渐换……', 'sys');
      }
      renderRoom(cid, true);
      save(S());
      if (CMK() === 'map') openModal('map');   // 城内地图模式下同步刷新网格
    }
    return {
      cityBuildBpList: cityBuildBpList,
      cityBuildMatTotal: cityBuildMatTotal,
      startCityBuild: startCityBuild,
      cityBuildMat: cityBuildMat,
      cityBuildExert: cityBuildExert,
      finishCityBuild: finishCityBuild,
      heldTuzhiList: heldTuzhiList,
      renderCityBuildPanel: renderCityBuildPanel,
      renderCityBuildProgress: renderCityBuildProgress,
      renderCityBuildDone: renderCityBuildDone,
      bindCityBuildPanel: bindCityBuildPanel,
      tickBuildOrders: tickBuildOrders,
      commitBuildOrder: commitBuildOrder,
      collectRents: collectRents,
      goCell: goCell
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createCityBuild;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

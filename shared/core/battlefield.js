// 战棋沙盘 · 核心（v20261030d）
// 独立棋盘状态机 + 渲染 + 交互；复用 war.js 的营级聚合语义（aggF 幂律、军令倍率、士气分档）。
// 设计：对局状态为内存临时对象，不落存档；战果经 cfg.onEnd(result, units, php) 回交 war.js 结算链。
// 交互：点己方营 → 浮出常用指令菜单（移动/攻击/待机/详情/列阵）；移动与攻击为即时非破坏操作；
//       复杂项（详情/列阵）开模态面板。战场支持拖动平移（仅 translate，不 scale，避免字体模糊）。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createBattlefield = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF, G = ctx.G;
    var log = ctx.log, toast = ctx.toast, save = ctx.save, renderStatus = ctx.renderStatus, renderRoom = ctx.renderRoom;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;
    var escapeHtml = ctx.escapeHtml, exert = ctx.exert, advanceTime = ctx.advanceTime;
    var Army = ctx.Army, Officers = ctx.Officers || null;
    var getPendingArmyBattle = ctx.getPendingArmyBattle, setPendingArmyBattle = ctx.setPendingArmyBattle;

    // ════════ 对局状态 ════════
    var board = null;     // {w,h,grid,units,round,phase,sel,mode,reach,attack,over,result,cfg}
    var drag = null;      // {x,y,ox,oy,moved}

    function T() { return (LF.TROOPS) || {}; }
    function slotOf(type) { var d = T()[type]; return d ? d.slot : '步'; }
    function terrainAt(x, y) {
      if (!board || !board.terrain) return LF.BF_TERRAIN.plain;
      var k = board.terrain[y] && board.terrain[y][x];
      return (k && LF.BF_TERRAIN[k]) || LF.BF_TERRAIN.plain;
    }
    function unitAt(x, y) {
      if (!board) return null;
      for (var i = 0; i < board.units.length; i++) {
        var u = board.units[i];
        if (u.hp > 0 && !u.routed && u.x === x && u.y === y) return u;
      }
      return null;
    }
    function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

    // ════════ 启动 ════════
    function start(cfg) {
      cfg = cfg || {};
      var grid = cfg.grid || (LF.BF_SCALE_TO_GRID && LF.BF_SCALE_TO_GRID[cfg.scale]) || LF.BF_DEFAULT_GRID;
      var w = grid.w, h = grid.h;
      var allies = (cfg.allies || []).map(function (u, i) { return toCell(u, 'ally', i); });
      var foes = (cfg.foes || []).map(function (u, i) { return toCell(u, 'foe', i); });
      var sp = LF.BF_SPAWN(w, h, allies.length, foes.length, cfg.kind === 'siege' ? 'siege' : 'field');
      allies.forEach(function (u, i) { if (sp.ally[i]) { u.x = sp.ally[i].x; u.y = sp.ally[i].y; } });
      foes.forEach(function (u, i) { if (sp.foe[i]) { u.x = sp.foe[i].x; u.y = sp.foe[i].y; } });
      board = {
        w: w, h: h, terrain: null, units: allies.concat(foes),
        round: 1, phase: 'ally', sel: null, mode: null, reach: [], attack: [], over: false, result: null,
        cfg: cfg, title: cfg.title || '会战', reinforce: cfg.reinforce || null, reinforceDone: false,
        log: []
      };
      if (cfg.ambush) moraleAll(sideUnits('ally'), 5);
      openModal && openModal('battlefield');
      setTimeout(function () { mount(); render(); }, 30);
      return board;
    }
    // 把 war.js 的营级 unit（含 isTroop/troopType/hp/maxHp/count/morale/_artMap）扩展为棋盘单位
    function toCell(u, side, i) {
      var slot = u.slot || (u.troopType && T()[u.troopType] && T()[u.troopType].slot) || ({ front: '步', mid: '械', rear: '远', flank: '骑' }[u.rank] || '步');
      var nu = {
        id: side + i, side: side,
        name: u.name, type: u.troopType, rank: u.rank || 'front', slot: slot,
        count: u.count, hp: u.hp, maxHp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd,
        morale: u.morale == null ? 80 : u.morale, crit: u.crit || 0,
        move: LF.BF_MOVE(u.spd), range: LF.BF_RANGE(slot),
        officer: u.officer || null,
        x: 0, y: 0, moved: false, acted: false, routed: false, defending: false,
        isTroop: true, troopType: u.troopType
      };
      // 军令：优先用 war.js 已注入的 artIds/_artMap；缺失时用 Army.buildOrdersFor 现算（修复调试台入口只弹取消按钮）
      if (u.artIds && u.artIds.length) {
        nu.orders = u.artIds.slice();
        nu._artMap = u._artMap || null;
      } else {
        try {
          var od = Army && Army.buildOrdersFor ? Army.buildOrdersFor(nu, nu.rank || 'front', nu.count) : null;
          if (od) { nu.orders = od.ids.slice(); nu._artMap = od.map; }
          else { nu.orders = []; nu._artMap = null; }
        } catch (e) { nu.orders = []; nu._artMap = null; }
      }
      return nu;
    }

    // ════════ 移动可达（八方向 BFS）════════
    function reachable(u) {
      if (!board || u.moved) return [];
      var w = board.w, h = board.h, steps = u.move, res = {}, q = [{ x: u.x, y: u.y, s: 0 }];
      res[u.x + ',' + u.y] = 0;
      var dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      while (q.length) {
        var cur = q.shift();
        if (cur.s >= steps) continue;
        for (var d = 0; d < dirs.length; d++) {
          var nx = cur.x + dirs[d][0], ny = cur.y + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var key = nx + ',' + ny;
          var occ = unitAt(nx, ny);
          if (occ) { if (occ.side !== u.side) continue; if (cur.s + 1 >= steps) continue; } // 可穿越友军，但不可停留/穿敌
          if (res[key] != null && res[key] <= cur.s + 1) continue;
          res[key] = cur.s + 1;
          q.push({ x: nx, y: ny, s: cur.s + 1 });
        }
      }
      var out = [];
      for (var k in res) { if (res[k] > 0) { var p = k.split(','); out.push({ x: +p[0], y: +p[1] }); } }
      return out.filter(function (p) { return !unitAt(p.x, p.y); });
    }
    function attackable(u) {
      if (!board || u.acted) return [];
      var out = [];
      board.units.forEach(function (e) {
        if (e.side === u.side || e.hp <= 0 || e.routed) return;
        if (cheb(u.x, u.y, e.x, e.y) <= u.range) out.push(e);
      });
      return out;
    }

    // ════════ 伤害结算 ════════
    function dmgRoll(a, d, orderId, isCounter) {
      var O = (LF.ARMY_ORDERS || {})[orderId] || {};
      if (O.defend) return { miss: true };
      var mul = O.dmgMul || 1;
      var moraleMul = (LF.moraleBand ? LF.moraleBand(a.morale) : { atkMul: 1 }).atkMul;
      var C = LF.BF_DMG_COEFF || {};
      var atkMul = C.terrainAtkMul || 1, counterMul = C.counterMul || 1;
      var terr = terrainAt(d.x, d.y), dodge = terr.dodge || 0;
      var hit = Math.max(0.05, 0.95 - dodge);
      if (Math.random() > hit) return { miss: true };
      var defMul = (C.terrainDefMul || 1);
      var raw = a.atk * mul * atkMul * counterMul * moraleMul;
      var defReduce = Math.min(0.8, (d.def * defMul) / 100);
      var val = raw * (1 - defReduce) * (0.9 + Math.random() * 0.2);
      if (isCounter) val *= (LF.BF_RIPOSTE ? LF.BF_RIPOSTE.dmg : 0.5);
      var crit = Math.random() < (a.crit || 0);
      if (crit) val *= 1.6;
      return { dmg: Math.max(1, Math.round(val)), crit: crit };
    }
    function applyOrderSideEffects(a, orderId) {
      var O = (LF.ARMY_ORDERS || {})[orderId] || {};
      var allies = sideUnits('ally'), foes = sideUnits('foe');
      if (O.selfDmg && a.hp > 0) {
        var sd = Math.max(1, Math.round(a.maxHp * O.selfDmg));
        a.hp = Math.max(0, a.hp - sd);
        log('「' + a.name + '」' + (O.name || '军令') + '过猛，自损 ' + sd + '。', 'danger');
      }
      if (O.moraleSelf) a.morale = clampM((a.morale == null ? 80 : a.morale) + O.moraleSelf);
      if (O.moraleFoe) moraleAll(foes, O.moraleFoe);
      if (O.moraleArmy) moraleAll(allies, O.moraleArmy);
    }
    // 攻击：a 对 d 用 orderId 出手；近战相邻则 d 反击
    function resolveAttack(a, d, orderId) {
      if (!board || a.side !== 'ally' || board.phase !== 'ally' || a.acted) return;
      if (cheb(a.x, a.y, d.x, d.y) > a.range) return;
      var O = (LF.ARMY_ORDERS || {})[orderId] || {};
      if (O.noTarget) return;
      var r = dmgRoll(a, d, orderId, false);
      if (r.miss) { floatText(d.x, d.y, '闪避', 'label-dodge'); log('〔交锋〕' + a.name + '攻' + d.name + '，被其闪过。', 'combat'); }
      else {
        d.hp = Math.max(0, d.hp - r.dmg);
        floatText(d.x, d.y, '-' + r.dmg, r.crit ? 'label-crit' : 'dmg');
        log('〔' + (O.name || '攻击') + '〕' + a.name + '攻' + d.name + '，伤 ' + r.dmg + (r.crit ? '（暴击）' : '') + '。', 'combat');
      }
      applyOrderSideEffects(a, orderId);
      a.acted = true; a.moved = true;
      // 反击：近战（距离 1）且 d 存活且 d 非坚守
      if (!r.miss && d.hp > 0 && cheb(a.x, a.y, d.x, d.y) === 1 && !O.defend) {
        var rr = dmgRoll(d, a, pickCounterOrder(d), true);
        if (rr.miss) { /* 反击落空 */ }
        else { a.hp = Math.max(0, a.hp - rr.dmg); floatText(a.x, a.y, '-' + rr.dmg, 'dmg'); log('〔反击〕' + d.name + '还击，伤 ' + a.name + ' ' + rr.dmg + '。', 'combat'); }
      }
      if (d.hp <= 0) log('〔破营〕' + d.name + '营溃散，折损于阵。', 'good');
      afterAction();
    }
    function pickCounterOrder(d) {
      // 反击用默认攻击军令（该阵位最高 dmgMul 的非防御军令）
      var best = null, O = LF.ARMY_ORDERS || {};
      (d.orders || []).forEach(function (oid) { var o = O[oid]; if (o && !o.defend && (!best || (o.dmgMul || 0) > (best.dmgMul || 0))) best = o; });
      return best ? best.id : null;
    }

    // ════════ 每回合末 / AI ════════
    function sideUnits(side) { return board.units.filter(function (u) { return u.side === side && u.hp > 0 && !u.routed; }); }
    function moraleAll(list, v) { list.forEach(function (u) { u.morale = clampM((u.morale == null ? 80 : u.morale) + v); }); }
    function clampM(v) { return Math.max(0, Math.min(100, Math.round(v))); }

    function foePhase() {
      board.phase = 'foe'; render();
      var foes = sideUnits('foe');
      var i = 0;
      function step() {
        if (i >= foes.length) { setTimeout(turnEnd, 120); return; }
        var u = foes[i++];
        if (u.acted) { step(); return; }
        aiAct(u);
        render();
        setTimeout(step, 220);
      }
      setTimeout(step, 260);
    }
    function aiAct(u) {
      var targets = sideUnits('ally');
      if (!targets.length) return;
      // 目标优先级：残血 > 远程(可先除) > 高威胁(atk高)
      targets.sort(function (a, b) {
        var ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
        if (ra !== rb) return ra - rb;
        var ka = a.range >= 2 ? 1 : 0, kb = b.range >= 2 ? 1 : 0;
        if (ka !== kb) return kb - ka;
        return b.atk - a.atk;
      });
      var tgt = null;
      for (var k = 0; k < targets.length; k++) {
        if (cheb(u.x, u.y, targets[k].x, targets[k].y) <= u.range) { tgt = targets[k]; break; }
      }
      if (!tgt) {
        // 向最近敌人移动：从可达格选离某敌最近的
        var reach = reachable(u);
        var near = null, bestD = 1e9;
        reach.forEach(function (p) {
          targets.forEach(function (t) { var dd = cheb(p.x, p.y, t.x, t.y); if (dd < bestD) { bestD = dd; near = p; } });
        });
        if (near) { u.x = near.x; u.y = near.y; u.moved = true; }
        // 移动后再看能否攻击
        for (var j = 0; j < targets.length; j++) if (cheb(u.x, u.y, targets[j].x, targets[j].y) <= u.range) { tgt = targets[j]; break; }
      }
      if (tgt) {
        var orderId = pickAiOrder(u);
        var r = dmgRoll(u, tgt, orderId, false);
        if (r.miss) { /* 落空 */ }
        else { tgt.hp = Math.max(0, tgt.hp - r.dmg); floatText(tgt.x, tgt.y, '-' + r.dmg, 'dmg'); log('〔敌袭〕' + u.name + '攻' + tgt.name + '，伤 ' + r.dmg + '。', 'danger'); }
        if (tgt.hp <= 0) log('〔破营〕我方' + tgt.name + '营折损！', 'danger');
        u.acted = true;
      }
    }
    function pickAiOrder(u) {
      var best = null, O = LF.ARMY_ORDERS || {};
      (u.orders || []).forEach(function (oid) { var o = O[oid]; if (o && !o.defend && !o.noTarget && (!best || (o.dmgMul || 0) > (best.dmgMul || 0))) best = o; });
      return best ? best.id : null;
    }
    function turnEnd() {
      // 士气 / 溃散（沿用 war.js routCheck 阈值）
      [sideUnits('ally'), sideUnits('foe')].forEach(function (list, idx) {
        var isFoe = idx === 1;
        list.forEach(function (u) {
          if (u.routed) return;
          var r = u.maxHp > 0 ? u.hp / u.maxHp : 0, m = u.morale == null ? 80 : u.morale, risk = 0;
          if (r < LF.BF_ROUT.hpRatio) risk += 0.06 + (LF.BF_ROUT.hpRatio - r) * 0.5;
          if (m < LF.BF_ROUT.morale) risk += (LF.BF_ROUT.morale - m) * 0.006;
          if (risk > 0 && Math.random() < risk) {
            u.routed = true; u.hp = Math.max(1, Math.round(u.hp * 0.5));
            log((isFoe ? '敌' : '我') + '「' + u.name + '」阵脚大乱，溃散离场！', isFoe ? 'good' : 'danger');
            moraleAll(list, isFoe ? 6 : -6);
          }
        });
      });
      // 援军入场（敌方援军，来自 war.js reinforce）
      if (board.reinforce && !board.reinforceDone && board.round >= (board.reinforce.round || 3)) {
        board.reinforceDone = true;
        var ru = board.reinforce.unit;
        if (ru) {
          var ru2 = toCell(ru, 'foe', 900);
          // 放在敌方出生列某空位
          var fx = board.w - 2, placed = false;
          for (var yy = 0; yy < board.h && !placed; yy++) if (!unitAt(fx, yy)) { ru2.x = fx; ru2.y = yy; placed = true; }
          if (!placed) { ru2.x = fx; ru2.y = Math.floor(board.h / 2); }
          board.units.push(ru2);
          log('〔援军〕' + ru.name + '自旁路杀到，敌势复振！', 'warn');
        }
      }
      // 重置行动标记
      board.units.forEach(function (u) { u.moved = false; u.acted = false; u.defending = false; });
      board.round++; board.phase = 'ally'; board.sel = null; board.mode = null;
      var over = checkOver();
      if (over) { render(); endBattle(over); return; }
      render();
    }
    function checkOver() {
      var a = sideUnits('ally').length, f = sideUnits('foe').length;
      if (f === 0) return 'win';
      if (a === 0) return 'lose';
      if (board.round > (board.cfg.maxRounds || 30)) {
        var ap = totalHp('ally'), fp = totalHp('foe');
        return ap >= fp ? 'win' : 'lose';
      }
      return null;
    }
    function totalHp(side) { var s = 0; sideUnits(side).forEach(function (u) { s += u.hp; }); return s; }

    function afterAction() {
      var over = checkOver();
      if (over) { render(); endBattle(over); return; }
      // 若所有 ally 已行动，自动进入敌阶段
      var allActed = sideUnits('ally').every(function (u) { return u.acted; });
      board.sel = null; board.mode = null; board.reach = []; board.attack = [];
      if (allActed) { render(); foePhase(); }
      else render();
    }

    // ════════ 交互 ════════
    // 移动位移动画（FLIP）：render 重建后把新位置单位先偏移到旧位置，再过渡回原位
    function animateMove(u, oldX, oldY, newX, newY) {
      var grid = document.getElementById('bf-grid');
      if (!grid) return;
      var cs = cellSize();
      var cell = grid.querySelector('.bf-cell.bf-sel');
      if (!cell) return;
      var el = cell.querySelector('.bf-unit');
      if (!el) return;
      var dx = (oldX - newX) * cs, dy = (oldY - newY) * cs;
      el.style.transition = 'none';
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      el.offsetWidth; // force reflow
      el.style.transition = 'transform .18s ease';
      el.style.transform = 'translate(0,0)';
      setTimeout(function () { el.style.transition = ''; el.style.transform = ''; }, 200);
    }
    function bfClick(x, y) {
      if (!board || board.over || board.phase !== 'ally') return;
      var u = unitAt(x, y);
      if (board.mode === 'move' && board.sel) {
        if (inReach(x, y)) {
          var oldX = board.sel.x, oldY = board.sel.y;
          board.sel.x = x; board.sel.y = y; board.sel.moved = true; board.mode = null; board.reach = [];
          render();
          animateMove(board.sel, oldX, oldY, x, y);
          return;
        }
      }
      if (board.mode === 'attack' && board.sel) {
        if (inAttack(x, y)) {
          var tgt = u;
          openOrderMenu(board.sel, tgt);
          return;
        }
      }
      if (u && u.side === 'ally') { board.sel = u; board.mode = null; board.reach = reachable(u); board.attack = attackable(u); render(); return; }
      // 点空白 / 敌方：取消选择
      board.sel = null; board.mode = null; board.reach = []; board.attack = []; closeMenu();
      render();
    }
    function inReach(x, y) { return board.reach.some(function (p) { return p.x === x && p.y === y; }); }
    function inAttack(x, y) { return board.attack.some(function (p) { return p.x === x && p.y === y; }); }
    function bfOrder(cmd) { // 浮出菜单按钮：move / attack / wait / detail / formation
      if (!board || !board.sel || board.phase !== 'ally') return;
      var u = board.sel;
      if (cmd === 'move') { board.mode = 'move'; board.reach = reachable(u); board.attack = []; render(); }
      else if (cmd === 'attack') { board.mode = 'attack'; board.attack = attackable(u); board.reach = []; render(); }
      else if (cmd === 'wait') { u.acted = true; u.moved = true; board.sel = null; board.mode = null; afterAction(); }
      else if (cmd === 'detail') { openDetailModal(u); }
      else if (cmd === 'formation') { openFormationModal(u); }
    }
    function bfEndTurn() {
      if (!board || board.over || board.phase !== 'ally') return;
      board.sel = null; board.mode = null; board.reach = []; board.attack = [];
      foePhase();
    }
    function bfRetreat() {
      if (!board || board.over) return;
      // 二次确认
      if (!board._retreatAsk) {
        board._retreatAsk = true;
        toast('再点一次「鸣金收兵」确认撤退（撤兵视为未竟全功）。');
        render();
        setTimeout(function () { board._retreatAsk = false; render(); }, 3000);
        return;
      }
      board._retreatAsk = false;
      endBattle('fled');
    }

    function openOrderMenu(a, tgt) {
      var O = LF.ARMY_ORDERS || {};
      var items = (a.orders || []).filter(function (oid) { var o = O[oid]; return o && !o.noTarget; });
      var h = '<div class="bf-pop"><div class="bf-pop-t">择军令攻 ' + esc(tgt.name) + '</div>';
      items.forEach(function (oid) {
        var o = O[oid];
        h += '<button type="button" class="bf-pop-b" onclick="window.bfStrike(\'' + oid + '\')">' + esc(o.name) + '<span>' + (o.desc || '') + '</span></button>';
      });
      h += '<button type="button" class="bf-pop-b ghost" onclick="window.bfCloseMenu()">取消</button></div>';
      board._strikeTarget = tgt;
      showMenu(h);
    }
    function bfStrike(orderId) {
      if (!board || !board.sel) return;
      var a = board.sel, tgt = unitAt(board.sel.x, board.sel.y); // 重新定位目标需缓存
      var t = board._strikeTarget;
      closeMenu();
      if (!t) return;
      resolveAttack(a, t, orderId);
    }
    function bfCloseMenu() { closeMenu(); }

    // ════════ 渲染 ════════
    function mount() {
      var card = document.getElementById('modal-card');
      if (!card) return;
      card.innerHTML = '<div id="bf-root" class="bf-root">' +
        '<div class="bf-top" id="bf-top"></div>' +
        '<div class="bf-viewport" id="bf-viewport"><div class="bf-grid" id="bf-grid"></div></div>' +
        '<div class="bf-detail" id="bf-detail"></div>' +
        '<div class="bf-bar" id="bf-bar"></div>' +
        '<div class="bf-pop-host" id="bf-pop-host"></div>' +
        '</div>';
      bindDrag();
    }
    function cellSize() {
      var vp = document.getElementById('bf-viewport');
      var compact = vp && vp.clientWidth < 540;
      return compact ? 48 : 64;
    }
    function render() {
      if (!board) return;
      var grid = document.getElementById('bf-grid');
      if (!grid) return;
      var cs = cellSize();
      grid.style.width = (board.w * cs) + 'px';
      grid.style.height = (board.h * cs) + 'px';
      // 顶栏
      var top = document.getElementById('bf-top');
      if (top) {
        var aN = sideUnits('ally').length, fN = sideUnits('foe').length;
        var aHp = totalHp('ally'), fHp = totalHp('foe');
        top.innerHTML = '<span class="bf-top-l">第 ' + board.round + ' 回合 · ' + (board.phase === 'ally' ? '我军阶段' : '敌军阶段') + '</span>' +
          '<span class="bf-top-m">' + esc(board.title) + '</span>' +
          '<span class="bf-top-r">我军 ' + aN + '/' + aHp + ' · 敌 ' + fN + '/' + fHp + '</span>';
      }
      // 格子 + 单位
      var html = [];
      for (var y = 0; y < board.h; y++) {
        for (var x = 0; x < board.w; x++) {
          var cls = 'bf-cell';
          if (y < board.h / 2) cls += ' bf-cell-ally'; else cls += ' bf-cell-foe';
          if (board.sel && board.mode === 'move' && inReach(x, y)) cls += ' bf-reach';
          if (board.sel && board.mode === 'attack' && inAttack(x, y)) cls += ' bf-atk';
          var u = unitAt(x, y);
          var inner = '';
          if (u) {
            if (board.sel === u) cls += ' bf-sel';
            var band = (LF.moraleBand ? LF.moraleBand(u.morale) : { color: '#C8B78F' }).color;
            var hpPct = Math.max(0, Math.min(100, Math.round(100 * u.hp / u.maxHp)));
            var sideCls = u.side === 'ally' ? 'bf-u-ally' : 'bf-u-foe';
            inner = '<div class="bf-unit ' + sideCls + (u.routed ? ' bf-routed' : '') + '" onclick="window.bfClick(' + x + ',' + y + ')">' +
              '<div class="bf-u-name">' + esc(u.name) + (u.officer ? '<i class="bf-u-off">督</i>' : '') + '</div>' +
              '<div class="bf-u-hp"><span style="width:' + hpPct + '%"></span></div>' +
              '<div class="bf-u-mor" style="border-color:' + band + '"></div>' +
              '</div>';
          } else {
            inner = '<div class="bf-cell-hit" onclick="window.bfClick(' + x + ',' + y + ')"></div>';
          }
          html.push('<div class="' + cls + '" style="left:' + (x * cs) + 'px;top:' + (y * cs) + 'px;width:' + cs + 'px;height:' + cs + 'px">' + inner + '</div>');
        }
      }
      grid.innerHTML = html.join('');
      // 详情条
      var det = document.getElementById('bf-detail');
      if (det) {
        if (board.sel) {
          var u = board.sel, O = LF.ARMY_ORDERS || {};
          var mband = LF.moraleBand ? LF.moraleBand(u.morale) : { name: '—' };
          var off = u.officer ? (esc(u.officer.name) + ' 督阵 +' + (u.officer.atk || 0) + '攻') : '无';
          var ordHtml = (u.orders || []).map(function (oid) { var o = O[oid]; return '<span class="bf-chip">' + (o ? esc(o.name) : oid) + '</span>'; }).join('');
          det.innerHTML = '<div class="bf-dt-card"><div class="bf-dt-h">' + esc(u.name) + ' · ' + (u.count || 0) + ' 人 · ' + esc((LF.ARMY_RANKS || {})[u.rank] ? (LF.ARMY_RANKS[u.rank].name) : u.rank) + '</div>' +
            '<div class="bf-dt-row">攻 ' + u.atk + ' · 防 ' + u.def + ' · 速 ' + u.spd + ' · 移 ' + u.move + ' · 射 ' + u.range + '</div>' +
            '<div class="bf-dt-row">军心 ' + u.morale + '（' + esc(mband.name) + '）· ' + off + '</div>' +
            '<div class="bf-dt-ord">可用军令：' + (ordHtml || '—') + '</div></div>';
        } else det.innerHTML = '<div class="bf-dt-hint">点选己方营，调遣走位与军令。</div>';
      }
      // 操作条
      var bar = document.getElementById('bf-bar');
      if (bar) {
        bar.innerHTML = '<button type="button" class="btn" id="bf-et">结束回合</button>' +
          '<button type="button" class="btn btn-danger" id="bf-rt">' + (board._retreatAsk ? '确认撤退？' : '鸣金收兵') + '</button>' +
          '<span class="bf-bar-tip">' + (board.phase === 'ally' ? '我军调度中' : '敌军行动中…') + '</span>';
        var et = document.getElementById('bf-et'); if (et) et.onclick = function () { bfEndTurn(); };
        var rt = document.getElementById('bf-rt'); if (rt) rt.onclick = function () { bfRetreat(); };
      }
      // 浮出常用指令菜单（点选己方营后；进入移动/攻击模式或敌方阶段时不显示）
      if (board.phase !== 'ally') closeMenu();
      else if (board.mode) closeMenu();
      else if (board.sel) showActionMenu(board.sel);
      else closeMenu();
    }
    // 浮出常用指令菜单（移动/攻击/待机/详情/列阵）
    function showActionMenu(u) {
      if (u.acted) { closeMenu(); return; }
      var h = '<div class="bf-pop bf-action">' +
        '<button type="button" class="bf-pop-b" onclick="window.bfOrder(\'move\')">移动</button>' +
        '<button type="button" class="bf-pop-b" onclick="window.bfOrder(\'attack\')">攻击</button>' +
        '<button type="button" class="bf-pop-b" onclick="window.bfOrder(\'wait\')">待机</button>' +
        '<button type="button" class="bf-pop-b ghost" onclick="window.bfOrder(\'detail\')">详情</button>' +
        '<button type="button" class="bf-pop-b ghost" onclick="window.bfOrder(\'formation\')">列阵</button>' +
        '</div>';
      showMenu(h);
    }
    function showMenu(html) {
      var host = document.getElementById('bf-pop-host');
      if (!host) return;
      host.innerHTML = html;
    }
    function closeMenu() { var host = document.getElementById('bf-pop-host'); if (host) host.innerHTML = ''; }

    // 拖动手势（仅 translate，不 scale，避免字体模糊）
    function bindDrag() {
      var vp = document.getElementById('bf-viewport');
      var grid = document.getElementById('bf-grid');
      if (!vp || !grid) return;
      var offX = 0, offY = 0, minX = 0, minY = 0;
      function clamp() {
        var gw = grid.offsetWidth, gh = grid.offsetHeight, vw = vp.clientWidth, vh = vp.clientHeight;
        minX = Math.min(0, vw - gw); minY = Math.min(0, vh - gh);
        offX = Math.max(minX, Math.min(0, offX)); offY = Math.max(minY, Math.min(0, offY));
        grid.style.transform = 'translate(' + offX + 'px,' + offY + 'px)';
      }
      vp.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX, y: e.clientY, ox: offX, oy: offY, moved: false };
        vp.setPointerCapture && vp.setPointerCapture(e.pointerId);
      });
      vp.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
        offX = drag.ox + dx; offY = drag.oy + dy; clamp();
      });
      vp.addEventListener('pointerup', function (e) {
        if (drag && !drag.moved) {
          // 视为点击：换算到格子坐标
          var rect = grid.getBoundingClientRect();
          var gx = Math.floor((e.clientX - rect.left) / cellSize());
          var gy = Math.floor((e.clientY - rect.top) / cellSize());
          if (gx >= 0 && gy >= 0 && gx < board.w && gy < board.h) bfClick(gx, gy);
        }
        drag = null;
      });
    }

    // 飘字（复用 .dmg-float 动效）
    function floatText(x, y, txt, cls) {
      var grid = document.getElementById('bf-grid');
      if (!grid) return;
      var cs = cellSize();
      var el = document.createElement('div');
      el.className = 'dmg-float ' + (cls || 'dmg') + ' bf-float';
      el.textContent = txt;
      el.style.left = (x * cs + cs / 2) + 'px';
      el.style.top = (y * cs + cs / 2) + 'px';
      grid.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
    }

    function openDetailModal(u) {
      var O = LF.ARMY_ORDERS || {};
      var ord = (u.orders || []).map(function (oid) { var o = O[oid]; return o ? ('<div class="bf-md-row"><b>' + esc(o.name) + '</b>：' + esc(o.desc || '') + (o.dmgMul ? '（伤×' + o.dmgMul + '）' : '') + '</div>') : ''; }).join('');
      var h = '<div class="bf-modal"><h3>' + esc(u.name) + ' · 营情</h3>' +
        '<div class="bf-md-row">兵力 ' + (u.count || 0) + ' · 兵科 ' + esc((T()[u.type] || {}).name || u.type) + ' · 阵位 ' + esc((LF.ARMY_RANKS || {})[u.rank] ? LF.ARMY_RANKS[u.rank].name : u.rank) + '</div>' +
        '<div class="bf-md-row">攻 ' + u.atk + ' · 防 ' + u.def + ' · 速 ' + u.spd + ' · 移动 ' + u.move + ' · 射程 ' + u.range + '</div>' +
        '<div class="bf-md-row">军心 ' + u.morale + ' · 督阵 ' + (u.officer ? esc(u.officer.name) + '（+' + (u.officer.atk || 0) + '攻）' : '无') + '</div>' +
        '<div class="bf-md-title">可用军令</div>' + (ord || '<div class="bf-md-row">—</div>') +
        '<button type="button" class="btn" onclick="window.bfCloseModal()">关闭</button></div>';
      openModal && openModal('generic', { html: h, title: '营情' });
    }
    function openFormationModal(u) {
      var F = LF.BF_FORMATION || {};
      var keys = Object.keys(F);
      var h = '<div class="bf-modal"><h3>' + esc(u.name) + ' · 列阵</h3>';
      if (!keys.length) h += '<div class="bf-md-row">列阵之术尚未习得（二期开启），今以本阵应敌。</div>';
      else keys.forEach(function (k) { var f = F[k]; h += '<div class="bf-md-row"><b>' + esc(f.name) + '</b>：防×' + (f.defMul || 1) + ' 攻×' + (f.atkMul || 1) + '</div>'; });
      h += '<button type="button" class="btn" onclick="window.bfCloseModal()">关闭</button></div>';
      openModal && openModal('generic', { html: h, title: '列阵' });
    }
    function bfCloseModal() { closeModal && closeModal(); }

    // ════════ 战果 ════════
    function endBattle(result) {
      if (!board || board.over) return;
      board.over = true; board.result = result;
      var survivors = board.units.filter(function (u) { return u.side === 'ally' && u.hp > 0; });
      var php = (S() && S().hp != null) ? S().hp : null;  // 战棋主角不参战，HP 不变
      var onEnd = board.cfg.onEnd;
      log('〔战罢〕会战' + (result === 'win' ? '得胜' : result === 'lose' ? '失利' : '撤兵') + '。', result === 'win' ? 'good' : 'danger');
      if (onEnd) onEnd(result, survivors, php);
    }

    function esc(s) { return escapeHtml ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }

    // ════════ 对外契约 ════════
    var api = {
      start: start,
      render: render,
      endBattle: endBattle,
      isActive: function () { return !!board && !board.over; },
      reachable: reachable, attackable: attackable, resolveAttack: resolveAttack
    };
    // 全局桥接（供 onclick 调用）
    if (typeof window !== 'undefined') {
      window.bfClick = bfClick; window.bfOrder = bfOrder; window.bfEndTurn = bfEndTurn; window.bfRetreat = bfRetreat;
      window.bfStrike = function (oid) { var t = board && board._strikeTarget; closeMenu(); if (board && board.sel && t) resolveAttack(board.sel, t, oid); };
      window.bfCloseMenu = closeMenu; window.bfCloseModal = bfCloseModal;
    }
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);

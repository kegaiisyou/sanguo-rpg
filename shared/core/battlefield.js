// 战棋沙盘 · 核心（v20261030k）
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
    // 战报：战斗中每步既写入本局 board.log（界面可读），也走引擎 log（主日志）
    var _log = log;
    function blog(m, c) { if (board) board.log.push({ m: m, c: c || '' }); _log(m, c); }
    log = blog;

    // 节奏：动画/延时按速度分档；跳帧(skip)时归零
    function D(ms) { if (!board) return ms; var s = board.speed || 1; return board.skip ? 0 : Math.max(0, Math.round(ms / s)); }

    // 全舞台模式：不用弹窗小卡，视野最大化（emblem class + :has 双保险）
    function setFullscreenMode(on) {
      try {
        var m = document.getElementById('modal');
        if (m) { if (on) m.classList.add('bf-full'); else m.classList.remove('bf-full'); }
      } catch (e) {}
    }
    // 内嵌抽屉：详情 / 列阵 不再另开窗口，直接在战场内弹出底部面板
    function showSheet(html) {
      var s = document.getElementById('bf-sheet');
      if (!s) return;
      s.innerHTML = '<div class="bf-sheet-in">' + html + '</div>';
      s.hidden = false;
    }
    function closeSheet() {
      var s = document.getElementById('bf-sheet');
      if (!s) return;
      s.hidden = true; s.innerHTML = '';
    }

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
    // 兵种推断（war.js 生成的守/攻军未带 troopType，按名称补足以支持克制）
    function inferType(name) {
      name = name || '';
      if (/弓|弩/.test(name)) return 'gongnu';
      if (/骑|骁骑|游骑/.test(name)) return 'qibing';
      if (/枪|矛/.test(name)) return 'changqiang';
      if (/盾|刀|锐卒|亲兵|守卒|步/.test(name)) return 'daodun';
      if (/攻城|梯|车/.test(name)) return 'gongcheng';
      if (/辎|粮/.test(name)) return 'qizhong';
      return 'changqiang';
    }

    // ───────── 通用助手 ─────────
    function bfClamp(v, lo, hi) { v = +v || lo; return Math.max(lo, Math.min(hi, v)); }
    function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function rng() { return (board && board._rng) ? board._rng() : Math.random(); }
    function applyDamage(t, dmg, by) {
      if (board && board.invincible && t.side === 'ally') return;
      t.hp = Math.max(0, t.hp - dmg);
      if (by) { by.dmgDealt = (by.dmgDealt || 0) + dmg; if (t.hp <= 0) by.kills = (by.kills || 0) + 1; }
    }
    function bfAggF(c) { return { hpF: Math.pow(c, 0.85), atkF: Math.pow(c, 0.85), defF: Math.log(1 + c) * 1.15 }; }
    function bfOrdersFor(rank) { var ids = []; var O = LF.ARMY_ORDERS || {}; for (var k in O) { if (O[k] && (!O[k].rank || O[k].rank === rank)) ids.push(k); } return ids; }
    function bfBuildUnit(type, rank, count) {
      var t = T()[type]; if (!t) return null;
      var f = bfAggF(count);
      return { name: t.name, troopType: type, rank: rank, count: count,
        hp: Math.round(t.hp * f.hpF), maxHp: Math.round(t.hp * f.hpF),
        atk: Math.round(t.atk * f.atkF), def: Math.round(t.def * f.defF), spd: t.spd,
        morale: 80, artIds: bfOrdersFor(rank), _artMap: null, isTroop: true };
    }

    // ───────── 战前部署（setup）─────────
    function ensureSetupDiv() {
      var el = document.getElementById('bf-setup');
      if (!el) { el = document.createElement('div'); el.id = 'bf-setup'; el.className = 'bf-setup'; document.body.appendChild(el); }
      return el;
    }
    function hideSetup() { var el = document.getElementById('bf-setup'); if (el) el.style.display = 'none'; }
    function openSetup(preset) {
      preset = preset || {};
      var ranks = [{ k: 'front', n: '前军' }, { k: 'mid', n: '中军' }, { k: 'rear', n: '后军' }, { k: 'flank', n: '侧翼' }];
      function toRow(u) { return { type: u.troopType || inferType(u.name), rank: u.rank || 'front', count: u.count || 100 }; }
      function defSide(side, n) { var pool = side === 'ally' ? ['changqiang', 'daodun', 'gongnu'] : ['changqiang', 'daodun', 'qibing', 'gongnu']; var a = []; for (var i = 0; i < n; i++) a.push({ type: pool[i % pool.length], rank: ['front', 'mid', 'rear'][i % 3], count: 120 }); return a; }
      var st = {
        grid: (preset.grid && preset.grid.w) ? { w: preset.grid.w, h: preset.grid.h } : { w: 12, h: 9 },
        allies: preset.allies ? preset.allies.map(toRow) : defSide('ally', 3),
        foes: preset.foes ? preset.foes.map(toRow) : defSide('foe', 3),
        title: preset.title || '野战', kind: preset.kind || 'field', maxRounds: preset.maxRounds || 30,
        dbg: { invincible: !!preset.invincible, showAllThreat: !!preset.showAllThreat, enemyIdle: !!preset.enemyIdle, seed: preset.seed || '', speedDefault: preset.speedDefault || 1, skipDefault: !!preset.skipDefault }
      };
      function gridOn(w, h) { return (st.grid.w === w && st.grid.h === h) ? ' on' : ''; }
      function unitRow(side, i, r, canDel) {
        var opts = Object.keys(T()).map(function (t) { return '<option value="' + t + '"' + (t === r.type ? ' selected' : '') + '>' + esc(T()[t].name) + '</option>'; }).join('');
        var rks = ranks.map(function (rk) { return '<option value="' + rk.k + '"' + (rk.k === r.rank ? ' selected' : '') + '>' + rk.n + '</option>'; }).join('');
        return '<div class="bf-srow" data-side="' + side + '" data-i="' + i + '">' +
          '<select class="bf-s-type">' + opts + '</select>' +
          '<select class="bf-s-rank">' + rks + '</select>' +
          '<input class="bf-s-count" type="number" min="20" max="800" value="' + r.count + '" />' +
          (canDel ? '<button type="button" class="bf-s-del">×</button>' : '') + '</div>';
      }
      function renderSetup() {
        var div = ensureSetupDiv(); div.style.display = 'block';
        var types = Object.keys(T());
        var allyRows = st.allies.map(function (r, i) { return unitRow('ally', i, r, st.allies.length > 1); }).join('');
        var foeRows = st.foes.map(function (r, i) { return unitRow('foe', i, r, st.foes.length > 1); }).join('');
        var sc = document.createElement('div'); sc.className = 'bf-setup-scroll';
        sc.innerHTML =
          '<div class="bf-setup-head">战前部署 · ' + esc(st.title) + '</div>' +
          '<div class="bf-ssec"><div class="bf-ssec-t">战场大小</div>' +
          '<div class="bf-spresets">' +
          '<button type="button" class="bf-gp' + gridOn(8, 6) + '" data-w="8" data-h="6">小 (8×6)</button>' +
          '<button type="button" class="bf-gp' + gridOn(12, 9) + '" data-w="12" data-h="9">中 (12×9)</button>' +
          '<button type="button" class="bf-gp' + gridOn(14, 12) + '" data-w="14" data-h="12">大 (14×12)</button></div>' +
          '<div class="bf-srow"><label>宽</label><input id="bf-gw" type="number" min="6" max="40" value="' + st.grid.w + '"/>' +
          '<label>高</label><input id="bf-gh" type="number" min="6" max="40" value="' + st.grid.h + '"/></div></div>' +
          '<div class="bf-ssec"><div class="bf-ssec-t">我方部署（兵种 / 阵位 / 兵力）</div>' + allyRows +
          (st.allies.length < 6 ? '<button type="button" class="bf-sadd bf-add-ally">＋ 添加我军</button>' : '') + '</div>' +
          '<div class="bf-ssec"><div class="bf-ssec-t">敌军部署</div>' + foeRows +
          (st.foes.length < 6 ? '<button type="button" class="bf-sadd bf-add-foe">＋ 添加敌军</button>' : '') + '</div>' +
          '<div class="bf-ssec"><div class="bf-ssec-t">调试功能</div>' +
          '<label class="bf-dbg-row"><input type="checkbox" class="bf-dbg" data-k="invincible"' + (st.dbg.invincible ? ' checked' : '') + '/> 我军无敌（不损兵）</label>' +
          '<label class="bf-dbg-row"><input type="checkbox" class="bf-dbg" data-k="showAllThreat"' + (st.dbg.showAllThreat ? ' checked' : '') + '/> 显示全体敌军威胁</label>' +
          '<label class="bf-dbg-row"><input type="checkbox" class="bf-dbg" data-k="enemyIdle"' + (st.dbg.enemyIdle ? ' checked' : '') + '/> 敌军不行动</label>' +
          '<label class="bf-dbg-row"><input type="checkbox" class="bf-dbg" data-k="skipDefault"' + (st.dbg.skipDefault ? ' checked' : '') + '/> 默认跳帧加速</label>' +
          '<label class="bf-dbg-row">固定随机种子 <input type="number" class="bf-dbg" data-k="seed" value="' + (st.dbg.seed || '') + '" placeholder="留空=随机"/></label>' +
          '<label class="bf-dbg-row">回合上限 <input type="number" class="bf-dbg" data-k="maxRounds" value="' + st.maxRounds + '"/></label></div>' +
          '<div class="bf-setup-actions"><button type="button" class="btn bf-main" id="bf-go">开始战斗</button>' +
          '<button type="button" class="btn" id="bf-cancel">取消</button></div>';
        div.innerHTML = ''; div.appendChild(sc); attachSetup(sc);
      }
      function attachSetup(sc) {
        sc.addEventListener('change', function (e) {
          var t = e.target;
          if (t.classList.contains('bf-s-type') || t.classList.contains('bf-s-rank')) {
            var row = t.closest('.bf-srow'); var arr = st[row.getAttribute('data-side') === 'ally' ? 'allies' : 'foes']; var i = +row.getAttribute('data-i');
            if (t.classList.contains('bf-s-type')) arr[i].type = t.value; else arr[i].rank = t.value;
          } else if (t.classList.contains('bf-gp')) { st.grid.w = +t.getAttribute('data-w'); st.grid.h = +t.getAttribute('data-h'); var gw = document.getElementById('bf-gw'), gh = document.getElementById('bf-gh'); if (gw) gw.value = st.grid.w; if (gh) gh.value = st.grid.h; }
          else if (t.id === 'bf-gw') st.grid.w = bfClamp(t.value, 6, 40);
          else if (t.id === 'bf-gh') st.grid.h = bfClamp(t.value, 6, 40);
          else if (t.classList.contains('bf-dbg')) { st.dbg[t.getAttribute('data-k')] = (t.type === 'checkbox') ? t.checked : (+t.value || 0); }
        });
        sc.addEventListener('input', function (e) {
          var t = e.target;
          if (t.classList.contains('bf-s-count')) { var row = t.closest('.bf-srow'); var arr = st[row.getAttribute('data-side') === 'ally' ? 'allies' : 'foes']; arr[+row.getAttribute('data-i')].count = bfClamp(t.value, 20, 800); }
          else if (t.id === 'bf-gw') st.grid.w = bfClamp(t.value, 6, 40);
          else if (t.id === 'bf-gh') st.grid.h = bfClamp(t.value, 6, 40);
          else if (t.classList.contains('bf-dbg') && t.type === 'number') st.dbg[t.getAttribute('data-k')] = (+t.value || 0);
        });
        sc.addEventListener('click', function (e) {
          var t = e.target;
          if (t.classList.contains('bf-gp')) { st.grid.w = +t.getAttribute('data-w'); st.grid.h = +t.getAttribute('data-h'); var gw = document.getElementById('bf-gw'), gh = document.getElementById('bf-gh'); if (gw) gw.value = st.grid.w; if (gh) gh.value = st.grid.h; renderSetup(); }
          else if (t.classList.contains('bf-s-del')) { var row = t.closest('.bf-srow'); var arr = st[row.getAttribute('data-side') === 'ally' ? 'allies' : 'foes']; arr.splice(+row.getAttribute('data-i'), 1); renderSetup(); }
          else if (t.classList.contains('bf-add-ally')) { st.allies.push({ type: 'changqiang', rank: 'front', count: 120 }); renderSetup(); }
          else if (t.classList.contains('bf-add-foe')) { st.foes.push({ type: 'qibing', rank: 'flank', count: 120 }); renderSetup(); }
          else if (t.id === 'bf-go') doStart();
          else if (t.id === 'bf-cancel') hideSetup();
        });
      }
      function doStart() {
        var allies = st.allies.map(function (r) { return bfBuildUnit(r.type, r.rank, r.count); }).filter(Boolean);
        var foes = st.foes.map(function (r) { return bfBuildUnit(r.type, r.rank, r.count); }).filter(Boolean);
        if (!allies.length || !foes.length) { toast && toast('双方至少各需一营。'); return; }
        var cfg = {
          kind: st.kind, grid: { w: bfClamp(st.grid.w, 6, 40), h: bfClamp(st.grid.h, 6, 40) },
          allies: allies, foes: foes, title: st.title, maxRounds: bfClamp(st.maxRounds, 1, 200),
          invincible: !!st.dbg.invincible, showAllThreat: !!st.dbg.showAllThreat, enemyIdle: !!st.dbg.enemyIdle,
          seed: st.dbg.seed ? bfClamp(st.dbg.seed, 1, 1e9) : null,
          speedDefault: st.dbg.skipDefault ? 3 : (st.dbg.speedDefault || 1), skipDefault: !!st.dbg.skipDefault,
          _setupDone: true, onEnd: preset.onEnd || function () {}
        };
        hideSetup(); beginBattle(cfg);
      }
      renderSetup();
    }

    // ───────── 战斗结算画面 ─────────
    function buildSummary(result, survivors, php) {
      var units = board.units.slice();
      units.sort(function (a, b) { return (b.dmgDealt || 0) - (a.dmgDealt || 0); });
      return {
        result: result, round: board.round, units: units, survivors: survivors.length, php: php,
        allyTotal: board.units.filter(function (u) { return u.side === 'ally'; }).length,
        foeTotal: board.units.filter(function (u) { return u.side === 'foe'; }).length,
        foeAlive: board.units.filter(function (u) { return u.side === 'foe' && u.hp > 0; }).length
      };
    }
    function renderResult(sum) {
      var el = document.getElementById('bf-result'); if (!el) return;
      var titleMap = { win: '我军得胜', lose: '我军失利', fled: '鸣金撤兵', draw: '势均力敌' };
      var rows = sum.units.map(function (u) {
        var lost = Math.max(0, Math.round((u.startCount || 0) * (1 - u.hp / u.maxHp)));
        var tn = (T()[u.type] && T()[u.type].name) || u.type;
        return '<tr><td class="' + (u.side === 'ally' ? 'bf-ra' : 'bf-rf') + '">' + esc(u.name) + '</td><td>' + esc(tn) + '</td><td>' +
          Math.max(0, Math.round(u.hp)) + '/' + u.maxHp + '</td><td>' + lost + '</td><td>' + (u.dmgDealt || 0) + '</td><td>' + (u.kills || 0) + '</td></tr>';
      }).join('');
      el.innerHTML = '<div class="bf-result-card"><h2 class="bf-result-title ' + (sum.result === 'win' ? 'good' : (sum.result === 'lose' ? 'bad' : 'mid')) + '">战斗结算 · ' + (titleMap[sum.result] || sum.result) + '</h2>' +
        '<div class="bf-result-sub">共 ' + sum.round + ' 回合 · 我军存活 ' + sum.survivors + '/' + sum.allyTotal + ' 营 · 敌军存活 ' + sum.foeAlive + '/' + sum.foeTotal + ' 营</div>' +
        '<table class="bf-result-tbl"><thead><tr><th>部队</th><th>兵种</th><th>余兵/上限</th><th>折损</th><th>伤害</th><th>歼敌</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<button type="button" class="btn bf-main" onclick="window.bfCloseResult()">继续</button></div>';
      el.hidden = false;
    }
    function bfCloseResult() {
      if (!board) return;
      var cb = board.cfg.onEnd;
      var res = board.result, surv = board.units.filter(function (u) { return u.side === 'ally' && u.hp > 0; }), php = board._result ? board._result.php : null;
      setFullscreenMode(false); closeModal && closeModal();
      if (cb) cb(res, surv, php);
      board = null;
    }

    // ════════ 启动 ════════
    function start(cfg) {
      if (cfg && cfg.setup && !cfg._setupDone) { openSetup(cfg); return; }
      return beginBattle(cfg);
    }
    function beginBattle(cfg) {
      cfg = cfg || {};
      var grid = cfg.grid || (LF.BF_SCALE_TO_GRID && LF.BF_SCALE_TO_GRID[cfg.scale]) || LF.BF_DEFAULT_GRID;
      var w = grid.w, h = grid.h;
      var allies = (cfg.allies || []).map(function (u, i) { return toCell(u, 'ally', i); });
      var foes = (cfg.foes || []).map(function (u, i) { return toCell(u, 'foe', i); });
      var sp = LF.BF_SPAWN(w, h, allies.length, foes.length, cfg.kind === 'siege' ? 'siege' : 'field');
      allies.forEach(function (u, i) { if (sp.ally[i]) { u.x = sp.ally[i].x; u.y = sp.ally[i].y; } });
      foes.forEach(function (u, i) { if (sp.foe[i]) { u.x = sp.foe[i].x; u.y = sp.foe[i].y; } });
      board = {
        w: w, h: h, terrain: LF.BF_GEN_TERRAIN(w, h, cfg.kind === 'siege' ? 'siege' : 'field'), units: allies.concat(foes),
        round: 1, phase: 'ally', sel: null, mode: null, reach: [], attack: [], over: false, result: null,
        speed: 1, skip: false, threat: null,
        cfg: cfg, title: cfg.title || '会战', reinforce: cfg.reinforce || null, reinforceDone: false,
        invincible: !!cfg.invincible, showAllThreat: !!cfg.showAllThreat, enemyIdle: !!cfg.enemyIdle,
        seed: cfg.seed || null, _rng: null, maxRounds: cfg.maxRounds || 99,
        log: []
      };
      if (cfg.seed) board._rng = mulberry32(cfg.seed);
      board.speed = cfg.speedDefault || 1; board.skip = !!cfg.skipDefault;
      if (cfg.ambush) moraleAll(sideUnits('ally'), 5);
      openModal && openModal('battlefield');
      setFullscreenMode(true);
      setTimeout(function () { mount(); render(); }, 30);
      return board;
    }
    // 把 war.js 的营级 unit（含 isTroop/troopType/hp/maxHp/count/morale/_artMap）扩展为棋盘单位
    function toCell(u, side, i) {
      var slot = u.slot || (u.troopType && T()[u.troopType] && T()[u.troopType].slot) || ({ front: '步', mid: '械', rear: '远', flank: '骑' }[u.rank] || '步');
      var nu = {
        id: side + i, side: side,
        name: u.name, type: u.troopType || inferType(u.name), rank: u.rank || 'front', slot: slot,
        count: u.count, hp: u.hp, maxHp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd,
        morale: u.morale == null ? 80 : u.morale, crit: u.crit || 0,
        move: LF.BF_MOVE(u.spd), range: LF.BF_RANGE(slot),
        officer: u.officer || null,
        x: 0, y: 0, moved: false, acted: false, routed: false, defending: false,
        dmgDealt: 0, kills: 0, startCount: u.count,
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

    // ════════ 移动可达（八方向 Dijkstra，按地形移动消耗累加）════════
    function reachable(u) {
      if (!board || u.moved) return [];
      var w = board.w, h = board.h, budget = u.move;
      var cost = {}, prev = {};
      cost[u.x + ',' + u.y] = 0;
      var pq = [{ x: u.x, y: u.y, c: 0 }];
      var dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      while (pq.length) {
        var mi = 0; for (var pi = 1; pi < pq.length; pi++) if (pq[pi].c < pq[mi].c) mi = pi;
        var cur = pq.splice(mi, 1)[0];
        if (cur.c > cost[cur.x + ',' + cur.y]) continue;
        for (var d = 0; d < dirs.length; d++) {
          var nx = cur.x + dirs[d][0], ny = cur.y + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var key = nx + ',' + ny;
          var occ = unitAt(nx, ny);
          if (occ && occ.side !== u.side) continue;                 // 敌格不可进入/穿越
          var enter = occ ? 1 : ((terrainAt(nx, ny).moveCost) || 1); // 友军格不计地形消耗
          var nc = cur.c + enter;
          if (nc > budget) continue;
          if (cost[key] == null || nc < cost[key]) {
            cost[key] = nc; prev[key] = { x: cur.x, y: cur.y };
            pq.push({ x: nx, y: ny, c: nc });
          }
        }
      }
      var out = [];
      for (var k in cost) { if (cost[k] > 0 && cost[k] <= budget) { var p = k.split(','); out.push({ x: +p[0], y: +p[1] }); } }
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
    // 敌方威胁覆盖：移动可达 + 从其可达格起的攻击范围（P1-1）
    function computeThreat(u) {
      if (!board || !u) return null;
      var move = reachable(u);
      var atkSet = {}, moveSet = {};
      move.forEach(function (p) { moveSet[p.x + ',' + p.y] = 1; });
      move.concat([{ x: u.x, y: u.y }]).forEach(function (p) {
        var x0 = Math.max(0, p.x - u.range), x1 = Math.min(board.w - 1, p.x + u.range);
        var y0 = Math.max(0, p.y - u.range), y1 = Math.min(board.h - 1, p.y + u.range);
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) if (cheb(p.x, p.y, x, y) <= u.range) atkSet[x + ',' + y] = 1;
      });
      return { u: u, move: move, moveSet: moveSet, atk: atkSet };
    }

    // ════════ 伤害结算 ════════
    // 兵种克制倍率（aType 克 dType → adv；反之 dis）
    function counterMulOf(aType, dType) {
      var C = LF.BF_COUNTER || {}, M = LF.BF_COUNTER_MUL || { adv: 1.25, dis: 0.8 };
      if (C[aType] && C[aType].indexOf(dType) >= 0) return M.adv;
      if (C[dType] && C[dType].indexOf(aType) >= 0) return M.dis;
      return 1;
    }
    function formationAtkMul(u) { var F = LF.BF_FORMATION || {}; return (u && u.formation && F[u.formation]) ? (F[u.formation].atkMul || 1) : 1; }
    function formationDefMul(u) { var F = LF.BF_FORMATION || {}; return (u && u.formation && F[u.formation]) ? (F[u.formation].defMul || 1) : 1; }
    function dmgRoll(a, d, orderId, isCounter) {
      var O = (LF.ARMY_ORDERS || {})[orderId] || {};
      if (O.defend) return { miss: true };
      var mul = O.dmgMul || 1;
      var moraleMul = (LF.moraleBand ? LF.moraleBand(a.morale) : { atkMul: 1 }).atkMul;
      var C = LF.BF_DMG_COEFF || {};
      // 地形：攻击方站格增攻（丘），防守方站格减伤（林/丘/营垒/城垣）+ 闪避
      var terrA = terrainAt(a.x, a.y), terrD = terrainAt(d.x, d.y);
      var atkMul = (terrA.atkMul || 1) * (C.terrainAtkMul || 1);
      var counterMul = counterMulOf(a.type, d.type);
      var dodge = terrD.dodge || 0;
      var hit = Math.max(0.05, 0.95 - dodge);
      if (rng() > hit) return { miss: true };
      var defMul = (terrD.defMul || 1) * formationDefMul(d) * (C.terrainDefMul || 1);
      var raw = a.atk * mul * atkMul * counterMul * moraleMul * formationAtkMul(a);
      var defReduce = Math.min(0.8, (d.def * defMul) / 100);
      var val = raw * (1 - defReduce) * (0.9 + rng() * 0.2);
      if (isCounter) val *= (LF.BF_RIPOSTE ? LF.BF_RIPOSTE.dmg : 0.5);
      var crit = rng() < (a.crit || 0);
      if (crit) val *= 1.6;
      return { dmg: Math.max(1, Math.round(val)), crit: crit, counter: counterMul, terrain: (terrD.defMul || 1) * (terrA.atkMul || 1) };
    }
    // 预计伤害/命中（预览用，不含随机暴击/闪避抖动，取期望中心）
    function dmgEstimate(a, d, orderId) {
      var O = (LF.ARMY_ORDERS || {})[orderId] || {};
      if (O.defend) return null;
      var mul = O.dmgMul || 1;
      var moraleMul = (LF.moraleBand ? LF.moraleBand(a.morale) : { atkMul: 1 }).atkMul;
      var C = LF.BF_DMG_COEFF || {};
      var terrA = terrainAt(a.x, a.y), terrD = terrainAt(d.x, d.y);
      var atkMul = (terrA.atkMul || 1) * (C.terrainAtkMul || 1);
      var counterMul = counterMulOf(a.type, d.type);
      var dodge = terrD.dodge || 0;
      var hit = Math.max(0.05, 0.95 - dodge);
      var defMul = (terrD.defMul || 1) * formationDefMul(d) * (C.terrainDefMul || 1);
      var raw = a.atk * mul * atkMul * counterMul * moraleMul * formationAtkMul(a);
      var defReduce = Math.min(0.8, (d.def * defMul) / 100);
      var avg = raw * (1 - defReduce);
      return { dmg: Math.max(1, Math.round(avg)), hit: Math.round(hit * 100), counter: counterMul, adj: cheb(a.x, a.y, d.x, d.y) === 1 };
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
    // 攻击：a 对 d 用 orderId 出手；近战相邻则 d 反击（动画在 render 后播放，结束再推进回合）
    function resolveAttack(a, d, orderId) {
      if (!board || a.side !== 'ally' || board.phase !== 'ally' || a.acted) return;
      if (cheb(a.x, a.y, d.x, d.y) > a.range) return;
      var O = (LF.ARMY_ORDERS || {})[orderId] || {};
      if (O.noTarget) return;
      var r = dmgRoll(a, d, orderId, false);
      var counter = null;
      if (!r.miss && d.hp > 0 && cheb(a.x, a.y, d.x, d.y) === 1 && !O.defend) {
        counter = dmgRoll(d, a, pickCounterOrder(d), true);
        if (counter.miss) counter = null; else applyDamage(a, counter.dmg, d);
      }
      if (r.miss) log('〔交锋〕' + a.name + '攻' + d.name + '，被其闪过。', 'combat');
      else { applyDamage(d, r.dmg, a); log('〔' + (O.name || '攻击') + '〕' + a.name + '攻' + d.name + '，伤 ' + r.dmg + (r.crit ? '（暴击）' : '') + (r.counter > 1 ? '（克制）' : r.counter < 1 ? '（被克）' : '') + '。', 'combat'); }
      applyOrderSideEffects(a, orderId);
      a.acted = true; a.moved = true;
      if (counter) log('〔反击〕' + d.name + '还击，伤 ' + a.name + ' ' + counter.dmg + '。', 'combat');
      if (d.hp <= 0) log('〔破营〕' + d.name + '营溃散，折损于阵。', 'good');
      board.sel = null; board.mode = null; board.reach = []; board.attack = [];
      render();
      animateAttack({ a: a, d: d, r: r, counter: counter }, afterAction);
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
      board.phase = 'foe'; board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = null;
      render();
      if (board.enemyIdle) { setTimeout(function () { log('〔调试〕敌军按兵不动。', 'warn'); turnEnd(); }, D(260)); return; }
      var foes = sideUnits('foe');
      var i = 0;
      function step() {
        if (i >= foes.length) { setTimeout(turnEnd, D(260)); return; }
        var u = foes[i++];
        if (u.acted) { step(); return; }
        board._acting = u; render();
        setTimeout(function () { aiAct(u, function () { board._acting = null; render(); setTimeout(step, D(200)); }); }, D(300));
      }
      setTimeout(step, D(360));
    }
    // 敌方行动（P1-4 升级）：残血优先击杀 / 点后排弓弩 / 规避被克 / 占地形 / 危则后撤
    function aiAct(u, done) {
      var enemies = sideUnits('ally');
      if (!enemies.length) { done(); return; }
      function scoreTarget(t) {
        var s = 0, hr = t.hp / t.maxHp;
        s += (1 - hr) * 2.2;
        var cm = counterMulOf(u.type, t.type);
        if (cm > 1) s += 0.6; else if (cm < 1) s -= 0.5;
        if (t.range >= 2) s += 0.35;
        s += (u.atk / (t.def + 10)) * 0.02;
        return s;
      }
      var scored = enemies.map(function (t) { return { t: t, s: scoreTarget(t) }; }).sort(function (a, b) { return b.s - a.s; });
      var inRange = scored.filter(function (o) { return cheb(u.x, u.y, o.t.x, o.t.y) <= u.range; });
      var path = null, oldX = u.x, oldY = u.y, bestTgt = null, bestScore = -1e9, moveCell = null;
      if (inRange.length) {
        bestTgt = inRange[0].t;
      } else {
        var reach = reachable(u), cand = reach.concat([{ x: u.x, y: u.y }]);
        for (var ci = 0; ci < cand.length; ci++) {
          var p = cand[ci];
          for (var si = 0; si < scored.length; si++) {
            var o = scored[si], t = o.t;
            if (cheb(p.x, p.y, t.x, t.y) <= u.range) {
              var terr = terrainAt(p.x, p.y);
              var sc = o.s + (terr.atkMul ? (terr.atkMul - 1) * 2 : 0) + (terr.defMul ? (terr.defMul - 1) * 1.2 : 0);
              if (u.range >= 2 && cheb(p.x, p.y, t.x, t.y) === 1) sc -= 0.6; // 远程拉开距离，规避贴脸反击
              if (sc > bestScore) { bestScore = sc; bestTgt = t; moveCell = p; }
            }
          }
        }
        if (moveCell) { path = pathBetween(oldX, oldY, moveCell.x, moveCell.y, u); u.x = moveCell.x; u.y = moveCell.y; u.moved = true; }
      }
      var hr = u.hp / u.maxHp;
      if (!path && !inRange.length && (hr < 0.22 || u.morale < 28)) {
        var rf = retreatCell(u);
        if (rf) { path = pathBetween(oldX, oldY, rf.x, rf.y, u); u.x = rf.x; u.y = rf.y; u.moved = true; bestTgt = null; }
      }
      var info = null;
      if (bestTgt) {
        var orderId = pickAiOrder(u);
        var Oo = (LF.ARMY_ORDERS || {})[orderId] || {};
        var r = dmgRoll(u, bestTgt, orderId, false);
        var counter = null;
        if (!r.miss && bestTgt.hp > 0 && cheb(u.x, u.y, bestTgt.x, bestTgt.y) === 1 && !Oo.defend) {
          counter = dmgRoll(bestTgt, u, pickCounterOrder(bestTgt), true);
          if (counter.miss) counter = null; else applyDamage(u, counter.dmg, bestTgt);
        }
        if (r.miss) log('〔敌袭〕' + u.name + '攻' + bestTgt.name + '，被其闪过。', 'danger');
        else { applyDamage(bestTgt, r.dmg, u); log('〔敌袭〕' + u.name + '攻' + bestTgt.name + '，伤 ' + r.dmg + (r.counter > 1 ? '（克制）' : r.counter < 1 ? '（被克）' : '') + '。', 'danger'); }
        if (bestTgt.hp <= 0) log('〔破营〕我方' + bestTgt.name + '营折损！', 'danger');
        u.acted = true;
        info = { a: u, d: bestTgt, r: r, counter: counter };
      }
      function finish() { if (info) { render(); animateAttack(info, done); } else done(); }
      if (path) { render(); animateMove(u, path, finish); } else finish();
    }
    // 后撤格：移动可达中不在任何敌方攻击覆盖内、且最靠近己方出生侧者
    function retreatCell(u) {
      var reach = reachable(u);
      var safe = reach.filter(function (p) {
        for (var i = 0; i < board.units.length; i++) { var e = board.units[i]; if (e.side === u.side || e.hp <= 0 || e.routed) continue; if (cheb(p.x, p.y, e.x, e.y) <= e.range) return false; }
        return true;
      });
      if (!safe.length) return null;
      var backX = u.side === 'foe' ? board.w - 1 : 0;
      safe.sort(function (a, b) { return Math.abs(a.x - backX) - Math.abs(b.x - backX); }); // 离己方出生侧最近者
      return safe[0];
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
          if (risk > 0 && rng() < risk) {
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

    // ════════ 交互 / 动画 ═════════
    // 八方向 BFS 取最短路径（供移动轨迹）；避开任意单位占据格（终点除外）
    function pathBetween(sx, sy, tx, ty, u) {
      if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
      var w = board.w, h = board.h;
      var dirs = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      var seen = {}, prev = {}, q = [{ x: sx, y: sy }]; seen[sx + ',' + sy] = 1;
      var found = false;
      while (q.length) {
        var cur = q.shift();
        if (cur.x === tx && cur.y === ty) { found = true; break; }
        for (var d = 0; d < dirs.length; d++) {
          var nx = cur.x + dirs[d][0], ny = cur.y + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var key = nx + ',' + ny;
          if (seen[key]) continue;
          var occ = unitAt(nx, ny);
          if (occ && !(nx === tx && ny === ty)) continue;
          seen[key] = 1; prev[key] = { x: cur.x, y: cur.y };
          q.push({ x: nx, y: ny });
        }
      }
      if (!found) return null;
      var path = [], c = { x: tx, y: ty };
      while (c) { path.unshift(c); c = prev[c.x + ',' + c.y]; }
      return path;
    }
    // 移动动画：沿路径逐格行进（带轨迹点）；跳帧时直接结算
    function animateMove(u, path, done) {
      if (board && board.skip) { done && done(); return; }
      var grid = document.getElementById('bf-grid');
      if (!grid || !path || path.length < 2) { done && done(); return; }
      var cs = cellSize();
      var cell = grid.querySelector('[data-uid="' + u.id + '"]');
      if (!cell) { done && done(); return; }
      drawTrail(path, cs);
      var dest = path[path.length - 1];
      var dx0 = (path[0].x - dest.x) * cs, dy0 = (path[0].y - dest.y) * cs;
      cell.style.transition = 'none';
      cell.style.transform = 'translate(' + dx0 + 'px,' + dy0 + 'px)';
      cell.classList.add('bf-march');
      cell.offsetWidth; // force reflow
      var stepMs = D(150);
      cell.style.transition = 'transform ' + stepMs + 'ms linear';
      var i = 1;
      (function next() {
        if (i >= path.length) {
          cell.style.transition = 'none';
          cell.style.transform = 'translate(0,0)';
          cell.classList.remove('bf-march');
          setTimeout(function () { clearTrail(); done && done(); }, D(70));
          return;
        }
        var p = path[i];
        cell.style.transform = 'translate(' + ((p.x - dest.x) * cs) + 'px,' + ((p.y - dest.y) * cs) + 'px)';
        i++;
        setTimeout(next, stepMs);
      })();
    }
    // 攻击动画：攻击者前冲 -> 命中闪光 + 震屏 -> 退回；反击作为第二拍；跳帧时直接结算
    function animateAttack(info, done) {
      var grid = document.getElementById('bf-grid');
      if (!grid) { done && done(); return; }
      if (board && board.skip) { done && done(); return; }
      var a = info.a, d = info.d, cs = cellSize();
      var ca = grid.querySelector('[data-uid="' + a.id + '"]'), cd = grid.querySelector('[data-uid="' + d.id + '"]');
      var ua = ca && ca.querySelector('.bf-unit'), ud = cd && cd.querySelector('.bf-unit');
      if (!ua || !ud) {
        if (info.r && !info.r.miss) floatText(d.x, d.y, '-' + info.r.dmg, info.r.crit ? 'label-crit' : 'dmg');
        else if (info.r) floatText(d.x, d.y, '闪避', 'label-dodge');
        afterCounter();
        return;
      }
      var dx = d.x - a.x, dy = d.y - a.y, len = Math.hypot(dx, dy) || 1, lx = dx / len, ly = dy / len, lp = 0.42 * cs;
      ua.style.transition = 'transform .14s ease-out';
      ua.style.transform = 'translate(' + (lx * lp) + 'px,' + (ly * lp) + 'px)';
      setTimeout(function () {
        ud.classList.add('bf-hit');
        if (info.r && !info.r.miss) floatText(d.x, d.y, '-' + info.r.dmg, info.r.crit ? 'label-crit' : 'dmg');
        else if (info.r) floatText(d.x, d.y, '闪避', 'label-dodge');
        shakeGrid();
        setTimeout(function () {
          ua.style.transition = 'transform .16s ease-in';
          ua.style.transform = 'translate(0,0)';
          setTimeout(function () { ud.classList.remove('bf-hit'); afterCounter(); }, D(170));
        }, D(150));
      }, D(150));
      function afterCounter() {
        if (info.counter) { setTimeout(function () { animateAttack({ a: d, d: a, r: info.counter, counter: null }, done); }, D(130)); }
        else done && done();
      }
    }
    function drawTrail(path, cs) {
      var t = document.getElementById('bf-trail'); if (!t || !path) return; t.innerHTML = '';
      path.forEach(function (p) { var dot = document.createElement('div'); dot.className = 'bf-trail-dot'; dot.style.left = (p.x * cs + cs / 2) + 'px'; dot.style.top = (p.y * cs + cs / 2) + 'px'; t.appendChild(dot); });
    }
    function clearTrail() { var t = document.getElementById('bf-trail'); if (t) t.innerHTML = ''; }
    function ensureLayers() {
      var grid = document.getElementById('bf-grid'); if (!grid) return;
      if (!grid.querySelector('#bf-aim')) { var a = document.createElement('div'); a.id = 'bf-aim'; a.className = 'bf-aim'; grid.appendChild(a); }
      if (!grid.querySelector('#bf-trail')) { var t = document.createElement('div'); t.id = 'bf-trail'; t.className = 'bf-trail'; grid.appendChild(t); }
    }
    function drawAimLines() {
      var aim = document.getElementById('bf-aim'); if (!aim) return; aim.innerHTML = '';
      var cs = cellSize(), a = board.sel; if (!a) return;
      (board.attack || []).forEach(function (t) {
        var x1 = a.x * cs + cs / 2, y1 = a.y * cs + cs / 2, x2 = t.x * cs + cs / 2, y2 = t.y * cs + cs / 2;
        var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        var line = document.createElement('div'); line.className = 'bf-aim-line';
        line.style.left = x1 + 'px'; line.style.top = y1 + 'px'; line.style.width = len + 'px'; line.style.transform = 'rotate(' + ang + 'deg)';
        aim.appendChild(line);
      });
    }
    function shakeGrid() { var vp = document.getElementById('bf-viewport'); if (!vp) return; vp.classList.add('bf-shake'); setTimeout(function () { vp.classList.remove('bf-shake'); }, 200); }
    function bfClick(x, y) {
      if (!board || board.over || board.phase !== 'ally') return;
      var u = unitAt(x, y);
      if (board.mode === 'move' && board.sel) {
        if (inReach(x, y)) {
          var oldX = board.sel.x, oldY = board.sel.y;
          var path = pathBetween(oldX, oldY, x, y, board.sel);
          board.sel.x = x; board.sel.y = y; board.sel.moved = true; board.mode = null; board.reach = [];
          render();
          animateMove(board.sel, path, function () {});
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
      if (u && u.side === 'ally') { board.sel = u; board.mode = null; board.reach = reachable(u); board.attack = attackable(u); board.threat = null; render(); return; }
      if (u && u.side === 'foe' && !board.mode) { board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = computeThreat(u); closeMenu(); render(); return; }
      // 点空白：取消选择 / 清除威胁
      board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = null; closeMenu();
      render();
    }
    function inReach(x, y) { return board.reach.some(function (p) { return p.x === x && p.y === y; }); }
    function inAttack(x, y) { return board.attack.some(function (p) { return p.x === x && p.y === y; }); }
    function bfOrder(cmd) { // 浮出菜单按钮：move / attack / wait / detail / formation
      if (!board || !board.sel || board.phase !== 'ally') return;
      board.threat = null;
      var u = board.sel;
      if (cmd === 'move') { board.mode = 'move'; board.reach = reachable(u); board.attack = []; render(); }
      else if (cmd === 'attack') { board.mode = 'attack'; board.attack = attackable(u); board.reach = []; render(); }
      else if (cmd === 'wait') { u.acted = true; u.moved = true; board.sel = null; board.mode = null; afterAction(); }
      else if (cmd === 'detail') { openDetailModal(u); }
      else if (cmd === 'formation') { openFormationModal(u); }
    }
    function bfEndTurn() { // 统一结束回合：一 tap 即可，无需逐个待机
      if (!board || board.over || board.phase !== 'ally') return;
      board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = null;
      closeSheet();
      foePhase();
    }
    function bfNextUnit() { // 跳到下一个未行动的我军营，并弹出指令菜单
      if (!board || board.over || board.phase !== 'ally') return;
      var list = sideUnits('ally').filter(function (u) { return !u.acted; });
      if (!list.length) { toast && toast('全军已待命，可结束回合。'); return; }
      var idx = 0;
      if (board.sel) { for (var i = 0; i < list.length; i++) { if (list[i] === board.sel) { idx = (i + 1) % list.length; break; } } }
      var u = list[idx];
      board.sel = u; board.mode = null; board.reach = reachable(u); board.attack = attackable(u); board.threat = null;
      render();
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
        var e = dmgEstimate(a, tgt, oid);
        var est = e ? ('<span>预计伤 ' + e.dmg + ' · 命中 ' + e.hit + '%' + (e.counter > 1 ? ' · 克制' : e.counter < 1 ? ' · 被克' : '') + (e.adj && !o.defend ? ' · 将遭反击' : '') + '</span>') : '<span>' + (o.desc || '') + '</span>';
        h += '<button type="button" class="bf-pop-b" onclick="window.bfStrike(\'' + oid + '\')">' + esc(o.name) + est + '</button>';
      });
      h += '<button type="button" class="bf-pop-b ghost" onclick="window.bfCloseMenu()">取消</button></div>';
      board._strikeTarget = tgt;
      showMenu(h); positionMenuNear(tgt);
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
        '<div class="bf-log" id="bf-log"></div>' +
        '<div class="bf-bar" id="bf-bar"></div>' +
        '<div class="bf-pop-host" id="bf-pop-host"></div>' +
        '<div class="bf-sheet" id="bf-sheet" hidden></div>' +
        '<div class="bf-result" id="bf-result" hidden></div>' +
        '</div>';
      setFullscreenMode(true);
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
      var allThreat = null;
      if (board.showAllThreat) {
        allThreat = {};
        board.units.forEach(function (u) {
          if (u.side !== 'foe' || u.hp <= 0 || u.routed) return;
          var reach = reachable(u);
          reach.concat([{ x: u.x, y: u.y }]).forEach(function (p) {
            for (var tx = 0; tx < board.w; tx++) for (var ty = 0; ty < board.h; ty++) {
              if (cheb(p.x, p.y, tx, ty) <= u.range) allThreat[tx + ',' + ty] = 1;
            }
          });
        });
      }
      for (var y = 0; y < board.h; y++) {
        for (var x = 0; x < board.w; x++) {
          var tkey = terrainAt(x, y).key;
          var cls = 'bf-cell';
          if (y < board.h / 2) cls += ' bf-cell-ally'; else cls += ' bf-cell-foe';
          if (tkey && tkey !== 'plain') cls += ' bf-t-' + tkey;
          if (board.sel && board.mode === 'move' && inReach(x, y)) cls += ' bf-reach';
          if (board.sel && board.mode === 'attack' && inAttack(x, y)) cls += ' bf-atk';
          if (board.threat) {
            if (board.threat.moveSet[x + ',' + y]) cls += ' bf-threat-move';
            else if (board.threat.atk[x + ',' + y]) cls += ' bf-threat-atk';
          } else if (allThreat && allThreat[x + ',' + y]) cls += ' bf-threat-all';
          var tico = (tkey && tkey !== 'plain') ? '<div class="bf-tico">' + esc(terrainAt(x, y).icon) + '</div>' : '';
          var u = unitAt(x, y);
          var inner = tico;
          if (u) {
            if (board.sel === u) cls += ' bf-sel';
            if (u.acted) cls += ' bf-acted';
            if (board.phase === 'foe' && board._acting === u) cls += ' bf-acting';
            var danger = (u.hp / u.maxHp < (LF.BF_ROUT ? LF.BF_ROUT.hpRatio : 0.5)) || ((u.morale == null ? 80 : u.morale) < (LF.BF_ROUT ? LF.BF_ROUT.morale : 45));
            if (danger) cls += ' bf-danger';
            var band = (LF.moraleBand ? LF.moraleBand(u.morale) : { color: '#C8B78F' }).color;
            var hpPct = Math.max(0, Math.min(100, Math.round(100 * u.hp / u.maxHp)));
            var sideCls = u.side === 'ally' ? 'bf-u-ally' : 'bf-u-foe';
            var fmtTag = (u.formation && u.formation !== 'benzhen') ? '<i class="bf-u-fmt" title="' + esc(((LF.BF_FORMATION || {})[u.formation] || {}).name || '') + '">' + esc(((LF.BF_FORMATION || {})[u.formation] || {}).name || '').charAt(0) + '</i>' : '';
            inner += '<div class="bf-unit ' + sideCls + (u.routed ? ' bf-routed' : '') + '" onclick="window.bfClick(' + x + ',' + y + ')">' +
              '<div class="bf-u-name">' + esc(u.name) + (u.officer ? '<i class="bf-u-off">督</i>' : '') + fmtTag + (danger ? '<i class="bf-u-danger" title="溃散风险高">危</i>' : '') + '</div>' +
              '<div class="bf-u-hp"><span style="width:' + hpPct + '%"></span></div>' +
              '<div class="bf-u-mor" style="border-color:' + band + '"></div>' +
              (u.acted ? '<i class="bf-acted-tag">已</i>' : '') +
              '</div>';
          } else {
            inner += '<div class="bf-cell-hit" onclick="window.bfClick(' + x + ',' + y + ')"></div>';
          }
          html.push('<div class="' + cls + '"' + (u ? ' data-uid="' + u.id + '"' : '') + ' style="left:' + (x * cs) + 'px;top:' + (y * cs) + 'px;width:' + cs + 'px;height:' + cs + 'px">' + inner + '</div>');
        }
      }
      grid.innerHTML = html.join('');
      ensureLayers();
      if (board.sel && board.mode === 'attack') drawAimLines();
      // 详情条
      var det = document.getElementById('bf-detail');
      if (det) {
        if (board.sel) {
          var u = board.sel, O = LF.ARMY_ORDERS || {};
          var danger = (u.hp / u.maxHp < (LF.BF_ROUT ? LF.BF_ROUT.hpRatio : 0.5)) || ((u.morale == null ? 80 : u.morale) < (LF.BF_ROUT ? LF.BF_ROUT.morale : 45));
          var mband = LF.moraleBand ? LF.moraleBand(u.morale) : { name: '—' };
          var off = u.officer ? (esc(u.officer.name) + ' 督阵 +' + (u.officer.atk || 0) + '攻') : '无';
          var ordHtml = (u.orders || []).map(function (oid) { var o = O[oid]; return '<span class="bf-chip">' + (o ? esc(o.name) : oid) + '</span>'; }).join('');
          det.innerHTML = '<div class="bf-dt-card"><div class="bf-dt-h">' + esc(u.name) + ' · ' + (u.count || 0) + ' 人 · ' + esc((LF.ARMY_RANKS || {})[u.rank] ? (LF.ARMY_RANKS[u.rank].name) : u.rank) + '</div>' +
            '<div class="bf-dt-row">攻 ' + u.atk + ' · 防 ' + u.def + ' · 速 ' + u.spd + ' · 移 ' + u.move + ' · 射 ' + u.range + '</div>' +
            '<div class="bf-dt-row">军心 ' + u.morale + '（' + esc(mband.name) + '）· ' + off + (danger ? ' · <span class="bf-dt-danger">溃散风险高</span>' : '') + '</div>' +
            '<div class="bf-dt-ord">可用军令：' + (ordHtml || '—') + '</div></div>';
        } else if (board.threat) {
          var tu = board.threat.u;
          det.innerHTML = '<div class="bf-dt-card"><div class="bf-dt-h bf-dt-foe">' + esc(tu.name) + ' · 威胁预览</div>' +
            '<div class="bf-dt-row">攻 ' + tu.atk + ' · 防 ' + tu.def + ' · 移 ' + tu.move + ' · 射 ' + tu.range + '</div>' +
            '<div class="bf-dt-row">红框=可攻击范围，黄框=可移动格；点空白关闭。</div></div>';
        } else det.innerHTML = '<div class="bf-dt-hint">点选己方营调遣；点敌方营查看其威胁范围。</div>';
      }
      // 战报
      var lg = document.getElementById('bf-log');
      if (lg) {
        var arr = (board.log || []).slice(-7);
        lg.innerHTML = arr.length ? arr.map(function (e) { return '<div class="bf-log-l bf-log-' + (e.c || 'sys') + '">' + esc(e.m) + '</div>'; }).join('') : '<div class="bf-log-l bf-log-sys">战报将在此处逐条呈现。</div>';
        lg.scrollTop = lg.scrollHeight;
      }
      // 操作条
      var bar = document.getElementById('bf-bar');
      if (bar) {
        var speed = board.speed || 1, skip = !!board.skip;
        var rest = sideUnits('ally').filter(function (u) { return !u.acted; }).length;
        bar.innerHTML =
          '<span class="bf-speed">速度' +
          '<button type="button" class="bf-sp' + (speed === 1 ? ' on' : '') + '" onclick="window.bfSpeed(1)">1×</button>' +
          '<button type="button" class="bf-sp' + (speed === 2 ? ' on' : '') + '" onclick="window.bfSpeed(2)">2×</button>' +
          '<button type="button" class="bf-sp' + (speed === 3 ? ' on' : '') + '" onclick="window.bfSpeed(3)">3×</button>' +
          '<button type="button" class="bf-sp' + (skip ? ' on' : '') + '" onclick="window.bfSkip()">' + (skip ? '跳帧✓' : '跳帧') + '</button></span>' +
          '<button type="button" class="btn bf-main" id="bf-et">结束回合' + (board.phase === 'ally' && rest > 0 ? '（余' + rest + '）' : '') + '</button>' +
          '<button type="button" class="btn" id="bf-nx">下一营</button>' +
          '<button type="button" class="btn btn-danger" id="bf-rt">' + (board._retreatAsk ? '确认撤退？' : '鸣金收兵') + '</button>' +
          '<span class="bf-bar-tip">' + (board.phase === 'ally' ? (rest > 0 ? '我军调度中 · 余 ' + rest + ' 营' : '全军已待命') : '敌军行动中…') + '</span>';
        var et = document.getElementById('bf-et'); if (et) et.onclick = function () { bfEndTurn(); };
        var nx = document.getElementById('bf-nx'); if (nx) nx.onclick = function () { bfNextUnit(); };
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
      showMenu(h); positionMenuNear(u);
    }
    function showMenu(html) {
      var host = document.getElementById('bf-pop-host');
      if (!host) return;
      host.innerHTML = html;
    }
    function closeMenu() { var host = document.getElementById('bf-pop-host'); if (host) host.innerHTML = ''; }
    // 把浮出菜单锚定到指定单位附近（而非固定贴底），缩短与目标的视觉距离
    function positionMenuNear(u) {
      var host = document.getElementById('bf-pop-host');
      var pop = host && host.querySelector('.bf-pop');
      if (!pop) return;
      var root = document.getElementById('bf-root');
      var grid = document.getElementById('bf-grid');
      if (!root) return;
      var rr = root.getBoundingClientRect();
      var cx = rr.width / 2, cy = rr.height / 2, half = 0;
      if (u && grid) {
        var cell = grid.querySelector('[data-uid="' + u.id + '"]');
        if (cell) { var cr = cell.getBoundingClientRect(); cx = cr.left + cr.width / 2 - rr.left; cy = cr.top + cr.height / 2 - rr.top; half = cr.height / 2; }
      }
      var mw = pop.offsetWidth || 220, mh = pop.offsetHeight || 70, margin = 8;
      var above = (cy - half - 10 - mh) >= margin;
      var top = above ? (cy - half - 10 - mh) : (cy + half + 10);
      top = Math.max(margin, Math.min(rr.height - mh - margin, top));
      var left = Math.max(margin + mw / 2, Math.min(rr.width - margin - mw / 2, cx));
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.style.right = 'auto';
      pop.style.bottom = 'auto';
      pop.style.transform = 'translateX(-50%)';
    }

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
        '<div class="bf-md-row">列阵 ' + (u.formation && (F[u.formation]) ? esc(F[u.formation].name) : '本阵') + '</div>' +
        '<div class="bf-md-title">可用军令</div>' + (ord || '<div class="bf-md-row">—</div>') +
        '<button type="button" class="btn" onclick="window.bfCloseSheet()">关闭</button></div>';
      showSheet(h);
    }
    function applyFormation(u, key) { if (u) { u.formation = (key && key !== 'benzhen') ? key : null; } render(); }
    function openFormationModal(u) {
      var F = LF.BF_FORMATION || {};
      var keys = Object.keys(F);
      var h = '<div class="bf-modal"><h3>' + esc(u.name) + ' · 列阵</h3>';
      if (!keys.length) h += '<div class="bf-md-row">列阵之术尚未习得，今以本阵应敌。</div>';
      else keys.forEach(function (k) {
        var f = F[k];
        var on = (!u.formation && k === 'benzhen') || u.formation === k;
        h += '<button type="button" class="bf-fmt-b' + (on ? ' on' : '') + '" onclick="window.bfSetFormation(\'' + u.id + '\',\'' + k + '\')">' +
          '<b>' + esc(f.name) + '</b> 防×' + (f.defMul || 1) + ' 攻×' + (f.atkMul || 1) + (f.move ? ' 移+' + f.move : '') + '<span>' + esc(f.desc || '') + '</span></button>';
      });
      h += '<button type="button" class="btn" onclick="window.bfCloseSheet()">关闭</button></div>';
      showSheet(h);
    }
    function bfCloseModal() { closeModal && closeModal(); }

    // ════════ 战果 ════════
    function endBattle(result) {
      if (!board || board.over) return;
      board.over = true; board.result = result;
      closeSheet();
      var survivors = board.units.filter(function (u) { return u.side === 'ally' && u.hp > 0; });
      var php = (S() && S().hp != null) ? S().hp : null;  // 战棋主角不参战，HP 不变
      board._result = buildSummary(result, survivors, php);
      log('〔战罢〕会战' + (result === 'win' ? '得胜' : result === 'lose' ? '失利' : '撤兵') + '。', result === 'win' ? 'good' : 'danger');
      renderResult(board._result);
    }

    function esc(s) { return escapeHtml ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }

    // ════════ 对外契约 ════════
    var api = {
      start: start,
      render: render,
      endBattle: endBattle,
      openSetup: openSetup,
      isActive: function () { return !!board && !board.over; },
      reachable: reachable, attackable: attackable, resolveAttack: resolveAttack
    };
    // 全局桥接（供 onclick 调用）
    if (typeof window !== 'undefined') {
      window.bfClick = bfClick; window.bfOrder = bfOrder; window.bfEndTurn = bfEndTurn; window.bfRetreat = bfRetreat;
      window.bfStrike = function (oid) { var t = board && board._strikeTarget; closeMenu(); if (board && board.sel && t) resolveAttack(board.sel, t, oid); };
      window.bfCloseMenu = closeMenu; window.bfCloseModal = bfCloseModal;
      window.bfSetFormation = function (uid, key) { var u = board && board.units.filter(function (x) { return x.id === uid; })[0]; if (u) { applyFormation(u, key); closeSheet(); } };
      window.bfCloseSheet = closeSheet;
      window.bfNextUnit = bfNextUnit;
      window.bfOpenSetup = openSetup;
      window.bfCloseResult = bfCloseResult;
      window.bfSpeed = function (s) { if (board) { board.speed = s; render(); } };
      window.bfSkip = function () { if (board) { board.skip = !board.skip; render(); } };
    }
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);

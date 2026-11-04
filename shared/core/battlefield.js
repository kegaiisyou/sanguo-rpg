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
    var CSX = 48, CSY = 48;
  var panX = 0, panY = 0; // 全局平移偏移（拖拽 + 相机跟随共用）
  var MARGIN = 0; // 边缘非可达留白圈数（渲染格坐标偏移共用）
  var zoomLevel = 1; // 用户缩放倍率（与居中平移合并进同一 transform，避免互相覆盖）

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
    var suppressClick = false; // 拖动后仅吞掉紧随的一次 click（避免真实点按被误吞）

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
        invincible: !!cfg.invincible, showAllThreat: cfg.showAllThreat !== false, enemyIdle: !!cfg.enemyIdle,
        seed: cfg.seed || null, _rng: null, maxRounds: cfg.maxRounds || 99,
        log: [], _centeredInit: false, history: []
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
      else { playSfx('attack'); buzz(22); shakeGrid(); effectLayer('bf-hit-flash', 300); applyDamage(d, r.dmg, a); log('〔' + (O.name || '攻击') + '〕' + a.name + '攻' + d.name + '，伤 ' + r.dmg + (r.crit ? '（暴击）' : '') + (r.counter > 1 ? '（克制）' : r.counter < 1 ? '（被克）' : '') + '。', 'combat'); }
      applyOrderSideEffects(a, orderId);
      a.acted = true; a.moved = true;
      if (counter) log('〔反击〕' + d.name + '还击，伤 ' + a.name + ' ' + counter.dmg + '。', 'combat');
      if (d.hp <= 0) { effectLayer('bf-rout-smoke', 1200); log('〔破营〕' + d.name + '营溃散，折损于阵。', 'good'); }
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
      board.phase = 'foe'; board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = null; board._history = [];
      render();
      if (board.enemyIdle) { setTimeout(function () { log('〔调试〕敌军按兵不动。', 'warn'); turnEnd(); }, D(260)); return; }
      var foes = sideUnits('foe');
      var i = 0;
      function step() {
        if (i >= foes.length) { setTimeout(turnEnd, D(260)); return; }
        var u = foes[i++];
        if (u.acted) { step(); return; }
        board._acting = u; render(); focusCell(u.x, u.y);
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
        else { applyDamage(bestTgt, r.dmg, u); effectLayer('bf-hit-flash', 300); log('〔敌袭〕' + u.name + '攻' + bestTgt.name + '，伤 ' + r.dmg + (r.counter > 1 ? '（克制）' : r.counter < 1 ? '（被克）' : '') + '。', 'danger'); }
        if (bestTgt.hp <= 0) { effectLayer('bf-rout-smoke', 1200); log('〔破营〕我方' + bestTgt.name + '营折损！', 'danger'); }
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
      var cs = cellSize(), csX = CSX, csY = CSY;
      var cell = grid.querySelector('[data-uid="' + u.id + '"]');
      if (!cell) { done && done(); return; }
      drawTrail(path);
      var dest = path[path.length - 1];
      var dx0 = (path[0].x - dest.x) * csX, dy0 = (path[0].y - dest.y) * csY;
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
        cell.style.transform = 'translate(' + ((p.x - dest.x) * csX) + 'px,' + ((p.y - dest.y) * csY) + 'px)';
        i++;
        setTimeout(next, stepMs);
      })();
    }
    // 攻击动画：攻击者前冲 -> 命中闪光 + 震屏 -> 退回；反击作为第二拍；跳帧时直接结算
    function animateAttack(info, done) {
      var grid = document.getElementById('bf-grid');
      if (!grid) { done && done(); return; }
      if (board && board.skip) { done && done(); return; }
      var a = info.a, d = info.d, cs = cellSize(), csX = CSX, csY = CSY;
      var ca = grid.querySelector('[data-uid="' + a.id + '"]'), cd = grid.querySelector('[data-uid="' + d.id + '"]');
      var ua = ca && ca.querySelector('.bf-unit'), ud = cd && cd.querySelector('.bf-unit');
      if (!ua || !ud) {
        if (info.r && !info.r.miss) floatText(d.x, d.y, '-' + info.r.dmg, info.r.crit ? 'label-crit' : 'dmg');
        else if (info.r) floatText(d.x, d.y, '闪避', 'label-dodge');
        afterCounter();
        return;
      }
      var dx = d.x - a.x, dy = d.y - a.y, len = Math.hypot(dx, dy) || 1, lx = dx / len, ly = dy / len, lp = 0.42 * Math.min(csX, csY);
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
    function drawTrail(path) {
      var t = document.getElementById('bf-trail'); if (!t || !path) return; t.innerHTML = '';
      path.forEach(function (p) { var dot = document.createElement('div'); dot.className = 'bf-trail-dot'; dot.style.left = ((p.x + MARGIN) * CSX + CSX / 2) + 'px'; dot.style.top = ((p.y + MARGIN) * CSY + CSY / 2) + 'px'; t.appendChild(dot); });
    }
    function clearTrail() { var t = document.getElementById('bf-trail'); if (t) t.innerHTML = ''; }
    function ensureLayers() {
      var grid = document.getElementById('bf-grid'); if (!grid) return;
      if (!grid.querySelector('#bf-aim')) { var a = document.createElement('div'); a.id = 'bf-aim'; a.className = 'bf-aim'; grid.appendChild(a); }
      if (!grid.querySelector('#bf-trail')) { var t = document.createElement('div'); t.id = 'bf-trail'; t.className = 'bf-trail'; grid.appendChild(t); }
    }
    function drawAimLines() {
      var aim = document.getElementById('bf-aim'); if (!aim) return; aim.innerHTML = '';
      var cs = cellSize(), csX = CSX, csY = CSY, a = board.sel; if (!a) return;
      (board.attack || []).forEach(function (t) {
        var x1 = (a.x + MARGIN) * csX + csX / 2, y1 = (a.y + MARGIN) * csY + csY / 2, x2 = (t.x + MARGIN) * csX + CSX / 2, y2 = (t.y + MARGIN) * csY + CSY / 2;
        var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        var line = document.createElement('div'); line.className = 'bf-aim-line';
        line.style.left = x1 + 'px'; line.style.top = y1 + 'px'; line.style.width = len + 'px'; line.style.transform = 'rotate(' + ang + 'deg)';
        aim.appendChild(line);
      });
    }
    function shakeGrid() { var vp = document.getElementById('bf-viewport'); if (!vp) return; vp.classList.add('bf-shake'); setTimeout(function () { vp.classList.remove('bf-shake'); }, 200); }
    // 战棋 v12 氛围特效层（命中闪光/溃败烟尘；CSS 动画结束自动移除，pointer-events:none 不挡点击）
    function effectLayer(cls, ms) { var vp = document.getElementById('bf-viewport'); if (!vp) return; var el = document.createElement('div'); el.className = cls; vp.appendChild(el); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms + 80); }
    var _actx = null;
    function playSfx(type) {
      try {
        if (!_actx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) _actx = new AC(); }
        if (!_actx) return;
        if (_actx.state === 'suspended') _actx.resume();
        var t = _actx.currentTime;
        var P = { select:[440,0.05,'sine',0.05], move:[330,0.08,'triangle',0.045], confirm:[620,0.07,'square',0.05], attack:[180,0.13,'sawtooth',0.07], hit:[140,0.1,'square',0.06], cancel:[220,0.06,'sine',0.04], detail:[520,0.05,'sine',0.04], win:[660,0.22,'triangle',0.07], lose:[150,0.28,'sawtooth',0.07] };
        var p = P[type] || P.select;
        var o = _actx.createOscillator(), g = _actx.createGain();
        o.type = p[2]; o.frequency.setValueAtTime(p[0], t); o.frequency.exponentialRampToValueAtTime(Math.max(60, p[0] * 0.6), t + p[1]);
        g.gain.setValueAtTime(p[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + p[1]);
        o.connect(g); g.connect(_actx.destination); o.start(t); o.stop(t + p[1] + 0.02);
      } catch (e) {}
    }
    function buzz(pat) { try { if (navigator.vibrate) navigator.vibrate(pat); } catch (e) {} }
    function bfClick(x, y) {
      if (suppressClick) { suppressClick = false; return; }
      if (!board || board.over || board.phase !== 'ally') return;
      var u = unitAt(x, y);
      // 移动模式：点可移动格子直接移动，无需二次确认
      if (board.mode === 'move' && board.sel) {
        if (inReach(x, y)) { commitMove(x, y); return; }
      }
      // 攻击模式：点可攻击敌人，直接弹出攻击指令
      if (board.mode === 'attack' && board.sel) {
        if (inAttack(x, y)) { openOrderMenu(board.sel, u); return; }
      }
      if (u && u.side === 'ally') { board.sel = u; board.mode = null; board.reach = reachable(u); board.attack = attackable(u); board.threat = null; board.pendingMove = null; board._pathPreview = []; playSfx('select'); buzz(8); render(); focusCell(u.x, u.y); return; }
      // 选中后直接点可达空格 = 直接移动
      if (board.sel && !u && inReach(x, y)) { commitMove(x, y); return; }
      // 选中后直接点可攻击敌 = 弹出攻击指令
      if (board.sel && !board.mode && u && u.side === 'foe' && inAttack(x, y)) { openOrderMenu(board.sel, u); return; }
      if (u && u.side === 'foe' && !board.mode) { board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = computeThreat(u); board.pendingMove = null; board._pathPreview = []; closeMenu(); render(); return; }
      // 点空白：取消选择
      board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = null; board.pendingMove = null; board._pathPreview = []; closeMenu();
      render();
    }
    function inReach(x, y) { return board.reach.some(function (p) { return p.x === x && p.y === y; }); }
    function inAttack(x, y) { return board.attack.some(function (p) { return p.x === x && p.y === y; }); }
    function unitById(id) { return board.units.filter(function (u) { return u.id === id; })[0]; }

    function commitMove(x, y) {
      var u = board.sel; if (!u) return;
      var oldX = u.x, oldY = u.y;
      var path = pathBetween(oldX, oldY, x, y, u);
      u.facing = { x: Math.sign(x - oldX), y: Math.sign(y - oldY) };
      u.x = x; u.y = y; u.moved = true; board.mode = null; board.reach = []; board.threat = null;
      playSfx('confirm'); buzz(14);
      render();
      animateMove(u, path, function () {});
    }
    function updatePathDots() {
      var grid = document.getElementById('bf-grid');
      if (!grid || !board) return;
      var show = (board.mode === 'move' || board.pendingMove) && board._pathPreview && board._pathPreview.length;
      var set = {};
      if (show) board._pathPreview.forEach(function (p) { set[p.x + ',' + p.y] = true; });
      var cells = grid.querySelectorAll('.bf-cell');
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var key = cell.getAttribute('data-x') + ',' + cell.getAttribute('data-y');
        var dot = cell.querySelector('.bf-path-dot');
        if (set[key] && !dot) { var d = document.createElement('i'); d.className = 'bf-path-dot'; cell.appendChild(d); }
        else if (!set[key] && dot) { cell.removeChild(dot); }
      }
    }
    function bfPathHover(x, y) {
      if (!board || board.mode !== 'move' || !board.sel) { if (board && board._pathPreview && board._pathPreview.length) { board._pathPreview = []; updatePathDots(); } return; }
      if (inReach(x, y)) { board._pathPreview = pathBetween(board.sel.x, board.sel.y, x, y, board.sel); updatePathDots(); }
      else if (board._pathPreview.length) { board._pathPreview = []; updatePathDots(); }
    }
    function bfPathClear() { if (board && board._pathPreview && board._pathPreview.length) { board._pathPreview = []; updatePathDots(); } }
    function bfOrder(cmd) { // 浮出菜单按钮：move / attack / wait / detail / formation
      if (!board || !board.sel || board.phase !== 'ally') return;
      board.threat = null;
      var u = board.sel;
      if (cmd === 'move') { board.mode = 'move'; board.reach = reachable(u); board.attack = []; board.pendingMove = null; board._pathPreview = []; render(); }
      else if (cmd === 'attack') { board.mode = 'attack'; board.attack = attackable(u); board.reach = []; board.pendingMove = null; board._pathPreview = []; render(); }
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
      render(); focusCell(u.x, u.y);
    }
    function bfRetreat() {
      if (!board || board.over) return;
      // 二次确认
      if (!board._retreatAsk) {
        board._retreatAsk = true;
        toast('再点一次「鸣金收兵」确认撤退（撤兵视为未竟全功）。');
        render();
        setTimeout(function () { if (board && !board.over) { board._retreatAsk = false; render(); } }, 3000);
        return;
      }
      board._retreatAsk = false;
      effectLayer('bf-rout-smoke', 1200);
      endBattle('fled');
    }

    function openOrderMenu(a, tgt) {
      var O = LF.ARMY_ORDERS || {};
      var items = (a.orders || []).filter(function (oid) { var o = O[oid]; return o && !o.noTarget; });
      var oid0 = (a.orders || []).filter(function (o) { return O[o] && !O[o].defend; })[0];
      var pe = oid0 ? dmgEstimate(a, tgt, oid0) : null;
      var head = '攻 ' + esc(tgt.name) + (pe ? ' · 预计伤 ' + pe.dmg + ' 命中 ' + pe.hit + '%' + (pe.counter > 1 ? ' 克制' : pe.counter < 1 ? ' 被克' : '') + (pe.adj ? ' 将遭反击' : '') : '');
      var h = '<div class="bf-pop"><div class="bf-pop-t">' + head + '</div>';
      items.forEach(function (oid) {
        var o = O[oid];
        var e = dmgEstimate(a, tgt, oid);
        var est = e ? ('<span>预计伤 ' + e.dmg + ' · 命中 ' + e.hit + '%' + (e.counter > 1 ? ' · 克制' : e.counter < 1 ? ' · 被克' : '') + (e.adj && !o.defend ? ' · 将遭反击' : '') + '</span>') : '<span>' + (o.desc || '') + '</span>';
        h += '<button type="button" class="bf-pop-b" onclick="window.bfStrike(\'' + oid + '\')">' + esc(o.name) + est + '</button>';
      });
      h += '<button type="button" class="bf-pop-b ghost" onclick="window.bfCloseMenu()">取消</button></div>';
      board._strikeTarget = tgt;
      updateAttackPreview();
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
      card.innerHTML = '<div id="bf-root" class="bf-root bf-combat-smoke">' +
        '<div class="bf-outzone" id="bf-outzone" onclick="window.bfDeselect()"></div>' +
        '<div class="bf-top" id="bf-top"></div>' +
        '<div class="bf-topmenu" id="bf-topmenu"></div>' +
        '<div class="bf-viewport" id="bf-viewport"><div class="bf-grid" id="bf-grid"></div></div>' +
        '<div class="bf-fab" id="bf-fab">' +
          '<button type="button" class="bf-fab-b" data-panel="units" title="部队列表">阵</button>' +
          '<button type="button" class="bf-fab-b" data-panel="zoom" title="视图缩放">⤢</button>' +
        '</div>' +
        '<div class="bf-fab-panel" id="bf-fab-panel" hidden></div>' +
        '<div class="bf-plate" id="bf-plate" hidden></div>' +
        '<div class="bf-bar" id="bf-bar"></div>' +
        '<div class="bf-pop-host" id="bf-pop-host"></div>' +
        '<div class="bf-sheet" id="bf-sheet" hidden></div>' +
        '<div class="bf-preview" id="bf-preview"></div>' +
        '<div class="bf-result" id="bf-result" hidden></div>' +
        '</div>';
      setFullscreenMode(true);
      bindDrag();
      var _vp = document.getElementById('bf-viewport');
      if (_vp) _vp.addEventListener('click', function (e) { if (suppressClick) { suppressClick = false; return; } if (e.target === _vp && window.bfDeselect) window.bfDeselect(); });
      // 顶栏 ⋮ 菜单（事件委托：顶栏 innerHTML 每次重绘仍生效）
      var _top = document.getElementById('bf-top');
      if (_top) _top.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.bf-top-btn'); if (b && b.dataset.menu === 'more') window.bfToggleTopMenu(); });
      // 右侧 FAB 堆叠（部队列表 / 战报 / 缩放）
      bindFab();
      // 高对比配色记忆
      try { if (localStorage.getItem('bf-hc') === '1') { var _r = document.getElementById('bf-root'); if (_r) _r.classList.add('bf-hc'); } } catch (e) {}
    }
    function cellSize() {
      var vp = document.getElementById('bf-viewport');
      if (!vp || !board) { return { csX: CSX, csY: CSY }; }
      var vw = vp.clientWidth || 360, vh = vp.clientHeight || 640;
      // 方格布局：横纵同尺寸；四周留 2 格「不可到达区域」。
      // 关键：cs 必须按 (棋盘+2*MARGIN) 计算，否则 grid 会撑出视口、敌军被推到屏幕外。
      var M = 2;
      var cs = Math.floor(Math.min(vw / (board.w + 2 * M), vh / (board.h + 2 * M)));
      cs = Math.max(14, Math.min(150, cs));
      CSX = cs; CSY = cs; MARGIN = M;
      return { csX: cs, csY: cs };
    }
    // 整张战场较小时居中（fit 后整体可见，无需平移）
    function recenterGrid() {
      var grid = document.getElementById('bf-grid'), vp = document.getElementById('bf-viewport');
      if (!grid || !vp) return;
      var gw = grid.offsetWidth, gh = grid.offsetHeight, vw = vp.clientWidth, vh = vp.clientHeight;
      grid.style.transformOrigin = '50% 50%';
      if (gw <= vw && gh <= vh) grid.style.transform = 'translate(' + ((vw - gw) / 2) + 'px,' + ((vh - gh) / 2) + 'px) scale(' + zoomLevel + ')';
    }
    // 应用平移 + 边界收敛（全可见时居中）
    function applyPan() {
      var grid = document.getElementById('bf-grid'), vp = document.getElementById('bf-viewport');
      if (!grid || !vp) return;
      var gw = grid.offsetWidth, gh = grid.offsetHeight, vw = vp.clientWidth, vh = vp.clientHeight;
      if (gw <= vw && gh <= vh) { panX = (vw - gw) / 2; panY = (vh - gh) / 2; }
      else { var minX = Math.min(0, vw - gw), minY = Math.min(0, vh - gh); panX = Math.max(minX, Math.min(0, panX)); panY = Math.max(minY, Math.min(0, panY)); }
      grid.style.transformOrigin = '50% 50%';
      grid.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomLevel + ')';
    }
    // 相机跟随：把指定格居中到视口（大棋盘平移，小棋盘保持居中）
    function focusCell(cx, cy) {
      var grid = document.getElementById('bf-grid'), vp = document.getElementById('bf-viewport');
      if (!grid || !vp || !board) return;
      var csX = CSX, csY = CSY;
      var gw = grid.offsetWidth, gh = grid.offsetHeight, vw = vp.clientWidth, vh = vp.clientHeight;
      if (gw <= vw && gh <= vh) { applyPan(); return; }
      var cellCX = (cx + MARGIN) * csX + csX / 2, cellCY = (cy + MARGIN) * csY + csY / 2;
      panX = vw / 2 - cellCX; panY = vh / 2 - cellCY;
      applyPan();
    }
    function render() {
      if (!board) return;
      var grid = document.getElementById('bf-grid');
      if (!grid) return;
      var cs = cellSize(), csX = CSX, csY = CSY;
      // 差分取整：每格 left/top/width/height 用整数像素，总尺寸恰好贴合视口 → 零留白且文字不虚化
      var X = [], Y = [], iX, iY;
      var GW = board.w + 2 * MARGIN, GH = board.h + 2 * MARGIN;
      for (iX = 0; iX <= GW; iX++) X.push(Math.round(iX * csX));
      for (iY = 0; iY <= GH; iY++) Y.push(Math.round(iY * csY));
      grid.style.width = X[GW] + 'px';
      grid.style.height = Y[GH] + 'px';
      grid.style.setProperty('--bf-cs', Math.min(csX, csY) + 'px');
      // 顶栏
      var top = document.getElementById('bf-top');
      if (top) {
        var aN = sideUnits('ally').length, fN = sideUnits('foe').length;
        var aHp = totalHp('ally'), fHp = totalHp('foe');
        top.innerHTML = '<span class="bf-top-l">第 ' + board.round + ' 回合 · ' + (board.phase === 'ally' ? '我军阶段' : '敌军阶段') + '</span>' +
          '<span class="bf-top-m">' + esc(board.title) + '</span>' +
          '<span class="bf-top-r">我 ' + aN + '/' + aHp + ' · 敌 ' + fN + '/' + fHp + '</span>' +
          '<button type="button" class="bf-top-btn" data-menu="more" title="更多">⋮</button>';
      }
      // 部队列表 -> FAB 抽屉按需渲染（见 refreshFabPanels / unitListHTML）
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
      // 攻击覆盖区（选中后即显示：从所有可达格起的射程并集，去掉移动可达格）
      var atkRangeSet = null;
      if (board.sel && (board.mode === 'attack' || !board.mode)) {
        atkRangeSet = {};
        var _bases = board.reach.concat([{ x: board.sel.x, y: board.sel.y }]);
        var _R = board.sel.range;
        _bases.forEach(function (p) {
          var x0 = Math.max(0, p.x - _R), x1 = Math.min(board.w - 1, p.x + _R), y0 = Math.max(0, p.y - _R), y1 = Math.min(board.h - 1, p.y + _R);
          for (var ax = x0; ax <= x1; ax++) for (var ay = y0; ay <= y1; ay++) if (cheb(p.x, p.y, ax, ay) <= _R) atkRangeSet[ax + ',' + ay] = 1;
        });
      }
      for (var gy = 0; gy < GH; gy++) {
        for (var gx = 0; gx < GW; gx++) {
          var bx = gx - MARGIN, by = gy - MARGIN;
          if (bx < 0 || bx >= board.w || by < 0 || by >= board.h) {
            html.push('<div class="bf-cell bf-edge" style="left:' + X[gx] + 'px;top:' + Y[gy] + 'px;width:' + (X[gx + 1] - X[gx]) + 'px;height:' + (Y[gy + 1] - Y[gy]) + 'px;"></div>');
            continue;
          }
          var x = bx, y = by;
          var tkey = terrainAt(x, y).key;
          var cls = 'bf-cell';
          if (y < board.h / 2) cls += ' bf-cell-ally'; else cls += ' bf-cell-foe';
          if (tkey && tkey !== 'plain') cls += ' bf-t-' + tkey;
          if (board.sel && (board.mode === 'move' || !board.mode) && inReach(x, y)) cls += (board.mode === 'move' ? ' bf-reach' : ' bf-reach bf-dim');
          if (board.sel && (board.mode === 'attack' || !board.mode) && inAttack(x, y)) cls += (board.mode === 'attack' ? ' bf-atk' : ' bf-atk bf-dim');
          if (atkRangeSet && atkRangeSet[x + ',' + y] && !inReach(x, y)) cls += ' bf-atk-range';
          if (board.threat) {
            if (board.threat.moveSet[x + ',' + y]) cls += ' bf-threat-move';
            else if (board.threat.atk[x + ',' + y]) cls += ' bf-threat-atk';
          } else if (allThreat && allThreat[x + ',' + y]) cls += ' bf-threat-all';
          var tico = (tkey && tkey !== 'plain') ? '<div class="bf-tico">' + esc({forest:'林',hill:'丘',ford:'渡',rampart:'垒',wall:'城'}[tkey] || terrainAt(x, y).icon) + '</div>' : '';
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
            var hov = (board.mode === 'attack' && u.side === 'foe') ? ' onmouseover="window.bfHover(' + x + ',' + y + ')" onmouseout="window.bfHover(-1,-1)"' : '';
            var face = (u.facing && (u.facing.x || u.facing.y))
              ? (u.facing.x > 0 ? '\u25B6' : u.facing.x < 0 ? '\u25C0' : u.facing.y > 0 ? '\u25BC' : '\u25B2')
              : (u.side === 'ally' ? '\u25BC' : '\u25B2');
            var tname = ((T()[u.troopType] || {}).name || u.name);
            var morPct = Math.max(0, Math.min(100, Math.round(u.morale == null ? 80 : u.morale)));
            var icoCls = u.troopType ? 'ico-' + u.troopType : '';
            inner += '<div class="bf-unit ' + sideCls + (u.routed ? ' bf-routed' : '') + (danger ? ' bf-danger' : '') + (board.sel === u ? ' bf-sel-u' : '') + (u.acted ? ' bf-acted' : '') + '"' + hov + ' onclick="window.bfClick(' + x + ',' + y + ')">' +
              '<i class="bf-u-ico ' + icoCls + '"></i>' +
              '<i class="bf-u-cnt">' + (u.count || 0) + '</i>' +
              '<i class="bf-u-face">' + face + '</i>' +
              
              '<i class="bf-u-hp"><i style="width:' + hpPct + '%"></i></i>' +
              '<i class="bf-u-mor"><i style="width:' + morPct + '%"></i></i>' +
              (u.acted ? '<i class="bf-acted-tag">已</i>' : '') +
              '</div>';
          } else {
            inner += '<div class="bf-cell-hit" onclick="window.bfClick(' + x + ',' + y + ')"></div>';
          }
          var pathDot = ((board.mode === 'move' || board.pendingMove) && board._pathPreview && board._pathPreview.some(function (p) { return p.x === x && p.y === y; })) ? '<i class="bf-path-dot"></i>' : '';
          html.push('<div class="' + cls + '"' + (u ? ' data-uid="' + u.id + '"' : '') + ' data-x="' + x + '" data-y="' + y + '"' + ' style="left:' + X[x + MARGIN] + 'px;top:' + Y[y + MARGIN] + 'px;width:' + (X[x + 1 + MARGIN] - X[x + MARGIN]) + 'px;height:' + (Y[y + 1 + MARGIN] - Y[y + MARGIN]) + 'px"' + (u ? hov : '') + ' onmouseover="window.bfPathHover(' + x + ',' + y + ')" onmouseout="window.bfPathClear()">' + inner + pathDot + '</div>');
        }
      }
      grid.innerHTML = html.join('');
      ensureLayers();
      if (!board._centeredInit && grid.offsetWidth && document.getElementById('bf-viewport') && document.getElementById('bf-viewport').clientWidth) { board._centeredInit = true; focusCell(Math.floor(board.w / 2), Math.floor(board.h / 2)); }
      if (board.sel && board.mode === 'attack') drawAimLines();
      // 选中详情 -> 改由底部操作板（renderPlate）渲染，此处不再单独浮层
      // 战报浮层已移除，战报走 FAB 抽屉
      // 操作条
      var bar = document.getElementById('bf-bar');
      if (bar) {
        var speed = board.speed || 1, skip = !!board.skip;
        var rest = sideUnits('ally').filter(function (u) { return !u.acted; }).length;
        bar.innerHTML =
          '<select class="bf-speed-select" id="bf-speed-select" onchange="window.bfSpeed(parseInt(this.value))">' +
          '<option value="1"' + (speed === 1 ? ' selected' : '') + '>1×</option>' +
          '<option value="2"' + (speed === 2 ? ' selected' : '') + '>2×</option>' +
          '<option value="3"' + (speed === 3 ? ' selected' : '') + '>3×</option>' +
          '<option value="0"' + (skip ? ' selected' : '') + '>跳帧</option>' +
          '</select>' +
          '<button type="button" class="btn bf-main" id="bf-et">结束回合' + (board.phase === 'ally' && rest > 0 ? '（余' + rest + '）' : '') + '</button>' +
          '<button type="button" class="btn bf-more-btn" id="bf-more">更多</button>' +
          '<div class="bf-more-menu" id="bf-more-menu" hidden>' +
            '<button type="button" class="bf-more-item" id="bf-nx">下一营</button>' +
            '<button type="button" class="bf-more-item" id="bf-rt">' + (board._retreatAsk ? '确认撤退？' : '鸣金收兵') + '</button>' +
          '</div>';
        var et = document.getElementById('bf-et'); if (et) et.onclick = function () { bfEndTurn(); };
        var nx = document.getElementById('bf-nx'); if (nx) nx.onclick = function () { document.getElementById('bf-more-menu').hidden = true; bfNextUnit(); };
        var rt = document.getElementById('bf-rt'); if (rt) rt.onclick = function () { document.getElementById('bf-more-menu').hidden = true; bfRetreat(); };
        var moreBtn = document.getElementById('bf-more');
        var moreMenu = document.getElementById('bf-more-menu');
        if (moreBtn && moreMenu) moreBtn.onclick = function (e) { e.stopPropagation(); moreMenu.hidden = !moreMenu.hidden; };
        // 点其他地方关闭更多菜单
        document.addEventListener('click', function (e) { if (!e.target.closest('#bf-more') && !e.target.closest('#bf-more-menu')) moreMenu.hidden = true; });

      updateAttackPreview();
      // 确认钮在落点格内渲染（见棋盘 pendingMove），无需单独处理
      renderPlate();
      refreshFabPanels();
      }
      // 指令菜单：仅攻击指令/详情由点击敌方触发；原底部 .bf-action 弹出已移除（改用顶部 contextual 条，不挡速度面板）
      if (board.phase !== 'ally') closeMenu();
      else if (board.mode) closeMenu();
      else closeMenu();
    }
    function dangerOf(u) {
      if (!u) return false;
      return (u.hp / u.maxHp < (LF.BF_ROUT ? LF.BF_ROUT.hpRatio : 0.5)) || ((u.morale == null ? 80 : u.morale) < (LF.BF_ROUT ? LF.BF_ROUT.morale : 45));
    }
    function unitListHTML() {
      if (!board) return '';
      var html = '';
      board.units.forEach(function (u) {
        if (u.hp <= 0 && u.routed) return;
        var hpPct = Math.max(0, Math.min(100, Math.round(100 * u.hp / u.maxHp)));
        var morPct = Math.max(0, Math.min(100, Math.round(u.morale == null ? 80 : u.morale)));
        var sideCls = u.side === 'ally' ? 'ally' : 'foe';
        var selCls = board.sel === u ? ' selected' : '';
        html += '<div class="bf-unit-card ' + sideCls + selCls + '" onclick="window.bfClick(' + u.x + ',' + u.y + ')">' +
          '<div class="bf-uc-ava">' + troopAvatarHTML(u.troopType, u.side, 38) + '</div>' +
          '<div class="bf-uc-main">' +
          '<div class="bf-uc-name">' + esc(u.name) + '</div>' +
          '<div class="bf-uc-count">' + u.count + ' / ' + u.maxHp + '</div>' +
          '<div class="bf-uc-hp"><i style="width:' + hpPct + '%"></i></div>' +
          '<div class="bf-uc-mor"><i style="width:' + morPct + '%"></i></div>' +
          '</div></div>';
      });
      return html;
    }
    function renderTopMenu() {
      var m = document.getElementById('bf-topmenu');
      if (!m || !board) return;
      var hcOn = document.getElementById('bf-root') && document.getElementById('bf-root').classList.contains('bf-hc');
      m.innerHTML =
        '<button type="button" class="bf-tm-i" onclick="window.bfToggleThreat();window.bfRefreshTopMenu();">' + (board.showAllThreat ? '✓ ' : '') + '威胁总览</button>' +
        '<button type="button" class="bf-tm-i" onclick="window.bfCloseTopMenu();window.bfOpenLegend();">' + (board._fabPanel === 'legend' ? '✓ ' : '') + '地形图例</button>' +
        '<button type="button" class="bf-tm-i" onclick="window.bfToggleHC();window.bfRefreshTopMenu();">' + (hcOn ? '✓ ' : '') + '高对比</button>';
    }
    function toggleTopMenu() {
      var m = document.getElementById('bf-topmenu');
      if (!m) return;
      if (m.classList.contains('open')) { m.classList.remove('open'); return; }
      renderTopMenu(); m.classList.add('open');
    }
    function openFabPanel(kind) {
      var fab = document.getElementById('bf-fab'), panel = document.getElementById('bf-fab-panel');
      if (!fab || !panel) return;
      fab.dataset.cur = kind; fab.classList.add('open');
      panel.hidden = false; panel.innerHTML = fabPanelHTML(kind);
      bindFabPanel(kind, panel);
      if (board) board._fabPanel = kind;
    }
    function closeFab() {
      var fab = document.getElementById('bf-fab'), panel = document.getElementById('bf-fab-panel');
      if (fab) { fab.classList.remove('open'); fab.dataset.cur = ''; }
      if (panel) { panel.hidden = true; panel.innerHTML = ''; }
      if (board) board._fabPanel = '';
    }
    function bindFab() {
      var fab = document.getElementById('bf-fab'), panel = document.getElementById('bf-fab-panel');
      if (!fab || !panel) return;
      fab.querySelectorAll('.bf-fab-b').forEach(function (b) {
        b.addEventListener('click', function () {
          var kind = b.dataset.panel;
          if (fab.classList.contains('open') && fab.dataset.cur === kind) { closeFab(); return; }
          openFabPanel(kind);
        });
      });
      var root = document.getElementById('bf-root');
      if (root) root.addEventListener('pointerdown', function (e) {
        if (panel.hidden) return;
        if (!panel.contains(e.target) && !fab.contains(e.target)) closeFab();
      }, true);
    }
    function fabPanelHTML(kind) {
      if (kind === 'units') return '<div class="bf-fp-h">部队列表 <button type="button" class="bf-fp-x" onclick="window.bfCloseFab()">✕</button></div><div class="bf-fp-body" id="bf-fp-units"></div>';
      if (kind === 'zoom') return '<div class="bf-fp-h">视图缩放 <button type="button" class="bf-fp-x" onclick="window.bfCloseFab()">✕</button></div><div class="bf-fp-body bf-fp-zoom">' +
        '<button type="button" class="btn" onclick="window.bfZoom(1.2)">放大 ＋</button>' +
        '<button type="button" class="btn" onclick="window.bfZoom(0.8)">缩小 －</button>' +
        '<button type="button" class="btn" onclick="window.bfZoom(0)">重置 ⌂</button></div>';
      if (kind === 'legend') {
        var rows = '';
        if (LF.BF_TERRAIN) rows = Object.keys(LF.BF_TERRAIN).map(function (k) {
          var t = LF.BF_TERRAIN[k], eff = [];
          if (t.moveCost && t.moveCost !== 1) eff.push('移' + t.moveCost);
          if (t.defMul && t.defMul !== 1) eff.push('守+' + Math.round((t.defMul - 1) * 100) + '%');
          if (t.atkMul && t.atkMul !== 1) eff.push('攻+' + Math.round((t.atkMul - 1) * 100) + '%');
          if (t.dodge) eff.push('闪避+' + Math.round(t.dodge * 100) + '%');
          return '<div class="bf-leg-row"><span class="bf-leg-ico">' + ({forest:'林',hill:'丘',ford:'渡',rampart:'垒',wall:'城'}[k] || t.icon || '·') + '</span><span class="bf-leg-name">' + esc(t.name) + '</span><span class="bf-leg-eff">' + eff.join(' · ') + '</span></div>';
        }).join('');
        return '<div class="bf-fp-h">地形图例 <button type="button" class="bf-fp-x" onclick="window.bfCloseFab()">✕</button></div><div class="bf-fp-body">' + rows +
          '<div class="bf-leg-row"><span class="bf-leg-ico">⬡</span><span class="bf-leg-name">蓝框</span><span class="bf-leg-eff">可移动</span></div>' +
          '<div class="bf-leg-row"><span class="bf-leg-ico">⬡</span><span class="bf-leg-name">红框</span><span class="bf-leg-eff">可攻击</span></div>' +
          '<div class="bf-leg-row"><span class="bf-leg-ico">⬡</span><span class="bf-leg-name">金点</span><span class="bf-leg-eff">移动路径</span></div>' +
          '<div class="bf-leg-hint">点「高对比」切换色弱友好配色</div></div>';
      }
      return '';
    }
    function bindFabPanel(kind, panel) {
      if (kind === 'units') { var fu = document.getElementById('bf-fp-units'); if (fu) fu.innerHTML = unitListHTML(); }
    }
    function refreshFabPanels() {
      var panel = document.getElementById('bf-fab-panel');
      if (!panel || panel.hidden || !board) return;
      if (board._fabPanel === 'units') { var fu = document.getElementById('bf-fp-units'); if (fu) fu.innerHTML = unitListHTML(); }
    }

    /* 部队立绘：真实立绘背景图（v7 豆包美术资源，WebP）；容器尺寸由父级定（操作板/列表） */
    function troopAvatarHTML(troopType, side, size) {
      return '<span class="bf-ava-art bf-ava-' + (side === 'ally' ? 'ally' : 'foe') + ' ' + (troopType ? 'ico-' + troopType : '') + '"></span>';
    }

    function renderPlate() {
      var plate = document.getElementById('bf-plate');
      var bar = document.getElementById('bf-bar');
      if (!plate || !board) return;
      if (board.phase !== 'ally') { plate.hidden = true; plate.innerHTML = ''; if (bar) bar.style.visibility = 'visible'; return; }
      if (board.sel) {
        var u = board.sel;
        if (!u.acted) {
          var danger = dangerOf(u);
          plate.hidden = false;
          if (bar) bar.style.visibility = 'hidden';
          plate.innerHTML = '<div class="bf-plate-row">' + '<div class="bf-plate-ava">' + troopAvatarHTML(u.troopType, u.side, 46) + '</div>' + '<div class="bf-plate-info">' +
            '<span class="bf-plate-name">' + esc(u.name) + '</span>' +
            '<div class="bf-plate-tags">' +
              '<span class="bf-tag bf-tag-count">兵 ' + (u.count || 0) + '</span>' +
              '<span class="bf-tag bf-tag-mor">军心 ' + u.morale + '</span>' +
            '</div>' +
            '<span class="bf-plate-stats">攻' + u.atk + ' · 防' + u.def + ' · 速' + u.spd + ' · 移' + u.move + ' · 射' + u.range + '</span>' +
            (danger ? '<span class="bf-plate-danger">溃散风险高</span>' : '') +
            '</div></div><div class="bf-plate-acts">' +
            '<button type="button" class="bf-act bf-act-pri' + (board.mode === 'move' ? ' bf-on' : '') + '" title="移动" onclick="window.bfOrder(\'move\')">移</button>' +
            '<button type="button" class="bf-act bf-act-pri' + (board.mode === 'attack' ? ' bf-on' : '') + '" title="攻击" onclick="window.bfOrder(\'attack\')">攻</button>' +
            '<button type="button" class="bf-act bf-act-pri" title="待机" onclick="window.bfOrder(\'wait\')">待</button>' +
            '<button type="button" class="bf-act" title="单位详情" onclick="window.bfOrder(\'detail\')">详</button>' +
            '<button type="button" class="bf-act" title="列阵" onclick="window.bfOrder(\'formation\')">阵</button>' +
            '<button type="button" class="bf-act bf-act-x" title="取消选择" onclick="window.bfDeselect()">✕</button>' +
            '</div>';
          return;
        }
        if (board.threat) {
          var tu = board.threat.u;
          plate.hidden = false;
          if (bar) bar.style.visibility = 'hidden';
          plate.innerHTML = '<div class="bf-plate-row"><div class="bf-plate-ava">' + troopAvatarHTML(tu.troopType, tu.side, 46) + '</div><div class="bf-plate-info"><span class="bf-plate-name bf-plate-foe">' + esc(tu.name) + ' 威胁预览</span><span class="bf-plate-stats">攻' + tu.atk + '·防' + tu.def + '·移' + tu.move + '·射' + tu.range + '</span></div></div><div class="bf-plate-hint">红框=可攻击 · 黄框=可移动 · 点空白关闭</div>';
          return;
        }
      }
      plate.hidden = true; plate.innerHTML = '';
      if (bar) bar.style.visibility = 'visible';
    }
    function showMenu(html) {
      var host = document.getElementById('bf-pop-host');
      if (!host) return;
      host.innerHTML = html;
    }
    function closeMenu() { var host = document.getElementById('bf-pop-host'); if (host) host.innerHTML = ''; var pv = document.getElementById('bf-preview'); if (pv) pv.style.display = 'none'; }
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
      var _r = pop.getBoundingClientRect(); var mw = _r.width || pop.offsetWidth || 220, mh = _r.height || pop.offsetHeight || 70, margin = 8;
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

    // 拖动手势（仅 translate，不 scale，避免字体模糊）；格子自带 onclick 负责点选
    // 手机轻点手指抖动可达 10~20px，必须放宽判定，否则真实点按被误判为拖动而吞掉 click。
    // 规则：移动 <6px 视为点按（不平移）；6~24px 仅轻微平移但【不吞 click】并在抬起时回弹；
    //       仅 >24px 的明确拖动才抑制紧随的 click（避免拖动结束误选）。
    function clientToCell(cx, cy) {
      var grid = document.getElementById('bf-grid');
      if (!grid || !board) return null;
      var r = grid.getBoundingClientRect();
      var gx = Math.floor((cx - r.left) / CSX), gy = Math.floor((cy - r.top) / CSY);
      var bx = gx - MARGIN, by = gy - MARGIN;
      if (bx < 0 || bx >= board.w || by < 0 || by >= board.h) return null;
      return { x: bx, y: by };
    }
    function bindDrag() {
      var vp = document.getElementById('bf-viewport');
      var grid = document.getElementById('bf-grid');
      if (!vp || !grid) return;
      var lpTimer = null;
      vp.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX, y: e.clientY, ox: panX, oy: panY, panning: false, moved: 0 };
        suppressClick = false;
        if (lpTimer) clearTimeout(lpTimer);
        lpTimer = setTimeout(function () {
          lpTimer = null;
          if (!drag || drag.moved > 12) return;
          var c = clientToCell(e.clientX, e.clientY);
          var uu = c ? unitAt(c.x, c.y) : null;
          if (uu) { suppressClick = true; playSfx('detail'); openDetailModal(uu); }
        }, 420);
      });
      window.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        var dist = Math.abs(dx) + Math.abs(dy);
        drag.moved = dist;
        if (dist > 12 && lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        if (!drag.panning && dist > 6) drag.panning = true;
        if (drag.panning) { panX = drag.ox + dx; panY = drag.oy + dy; applyPan(); }
      });
      window.addEventListener('pointerup', function () {
        if (!drag) return;
        var wasDrag = drag.panning && drag.moved > 24;
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        if (drag.panning && !wasDrag) { panX = drag.ox; panY = drag.oy; applyPan(); } // 非拖动：平移回弹，消除累积漂移
        drag = null;
        if (wasDrag) suppressClick = true;
      });
    }

    // 飘字（复用 .dmg-float 动效）
    function floatText(x, y, txt, cls) {
      var grid = document.getElementById('bf-grid');
      if (!grid) return;
      var cs = cellSize(), csX = CSX, csY = CSY;
      var el = document.createElement('div');
      el.className = 'dmg-float ' + (cls || 'dmg') + ' bf-float';
      el.textContent = txt;
      el.style.left = ((x + MARGIN) * csX + csX / 2) + 'px';
      el.style.top = ((y + MARGIN) * csY + csY / 2) + 'px';
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
      playSfx(result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'cancel'); buzz(result === 'win' ? [30,40,30] : result === 'lose' ? [80,80,80] : 12);
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
    // 攻击预演面板（桌面悬停 / 选定后常驻显示）
    function updateAttackPreview() {
      var pv = document.getElementById('bf-preview');
      if (!pv) { pv = document.createElement('div'); pv.id = 'bf-preview'; pv.className = 'bf-preview'; var root = document.getElementById('bf-root'); if (root) root.appendChild(pv); }
      if (!board || (!board.mode && !board._strikeTarget)) { if (pv) pv.style.display = 'none'; return; }
      var tgt = board._strikeTarget || board._hoverTarget;
      if (!tgt || tgt.side !== 'foe' || tgt.hp <= 0) { pv.style.display = 'none'; return; }
      var a = board.sel; if (!a) { pv.style.display = 'none'; return; }
      var O = LF.ARMY_ORDERS || {};
      var oid = (a.orders || []).filter(function (o) { return O[o] && !O[o].defend; })[0];
      var e = oid ? dmgEstimate(a, tgt, oid) : null;
      var lines = '<div class="bf-pv-t">' + esc(a.name) + ' → ' + esc(tgt.name) + '</div>';
      lines += '<div class="bf-pv-r">攻 ' + a.atk + '·防 ' + a.def + ' → 敌 攻 ' + tgt.atk + '·防 ' + tgt.def + '</div>';
      if (e) {
        lines += '<div class="bf-pv-r">预计伤 <b>' + e.dmg + '</b> · 命中 ' + e.hit + '%' +
          (e.counter > 1 ? ' · <span class="bf-pv-adv">克制</span>' : e.counter < 1 ? ' · <span class="bf-pv-dis">被克</span>' : '') +
          (e.adj ? ' · <span class="bf-pv-warn">将遭反击</span>' : '') + '</div>';
      }
      pv.innerHTML = lines; pv.style.display = 'block';
    }

    // 全局桥接（供 onclick 调用）
    if (typeof window !== 'undefined') {
      window.bfClick = bfClick; window.bfOrder = bfOrder; window.bfEndTurn = bfEndTurn; window.bfRetreat = bfRetreat;
      window.bfToggleThreat = function () { if (!board) return; board.showAllThreat = !board.showAllThreat; render(); };
      window.bfStrike = function (oid) { var t = board && board._strikeTarget; closeMenu(); if (board && board.sel && t) resolveAttack(board.sel, t, oid); };
      window.bfCloseMenu = closeMenu; window.bfCloseModal = bfCloseModal;
      window.bfDeselect = function () { if (!board) return; board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = null; board.pendingMove = null; board._pathPreview = []; closeMenu(); render(); };
      window.bfToggleLegend = function () { openFabPanel('legend'); };
      window.bfToggleTopMenu = toggleTopMenu;
      window.bfCloseTopMenu = function () { var m = document.getElementById('bf-topmenu'); if (m) m.classList.remove('open'); };
      window.bfRefreshTopMenu = function () { renderTopMenu(); };
      window.bfOpenLegend = function () { openFabPanel('legend'); };
      window.bfCloseFab = closeFab;
      window.bfZoom = function (f) { if (!board) return; if (f === 0) zoomLevel = 1; else zoomLevel = Math.max(0.6, Math.min(2, zoomLevel * f)); applyPan(); };
      window.bfToggleHC = function () { var r = document.getElementById('bf-root'); if (!r) return; var on = r.classList.toggle('bf-hc'); try { localStorage.setItem('bf-hc', on ? '1' : '0'); } catch (e) {} };
      window.bfSetFormation = function (uid, key) { var u = board && board.units.filter(function (x) { return x.id === uid; })[0]; if (u) { applyFormation(u, key); closeSheet(); } };
      window.bfCloseSheet = closeSheet;
      window.bfHover = function (x, y) { if (!board || board.mode !== 'attack') return; board._hoverTarget = (x >= 0 && y >= 0) ? unitAt(x, y) : null; updateAttackPreview(); };
      window.bfPathHover = bfPathHover; window.bfPathClear = bfPathClear;
      window.bfConfirmMove = function () { var p = board && board.pendingMove; if (p) window.bfClick(p.x, p.y); };
      window.bfCancelMove = function () { if (board && board.pendingMove) { board.pendingMove = null; board._pathPreview = []; render(); } };
      window.bfNextUnit = bfNextUnit;
      window.bfOpenSetup = openSetup;
      window.bfCloseResult = bfCloseResult;
      window.bfSpeed = function (s) {
        if (!board) return;
        if (s === 0) { board.skip = true; board.speed = 1; }
        else { board.speed = s; board.skip = false; }
        render();
      };
      window.bfSkip = function () { if (board) { board.skip = !board.skip; render(); } };
    }
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);

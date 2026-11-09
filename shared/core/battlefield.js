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
    // 战报只写战棋内 board.log，不再走引擎全局 log（避免大世界刷伤害字幕）
    var _log = log;
    function blog(m, c) { if (board) (board.log = board.log || []).push({ m: m, c: c || '' }); }
    log = blog;

    // 节奏：动画/延时按速度分档；跳帧(skip)时归零
    function D(ms) { if (!board) return ms; var s = board.speed || 1; return board.skip ? 0 : Math.max(0, Math.round(ms / s)); }
    // 演出倍率：只放大「看得到」的动画时长，不影响点击/菜单/长按等交互计时；一处可调
    var FX_SCALE = 1.7;
    function F(ms) { return D(Math.round(ms * FX_SCALE)); }
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
      // 新兵科须排在泛化规则之前，否则「弓骑兵 / 床弩手」会被 /弓|弩/ 抢先判成弓弩兵
      if (/床弩|连弩车|弩车/.test(name)) return 'chuangnu';
      if (/弓骑|骑射|游骑/.test(name)) return 'gongqi';
      if (/火矢|火箭/.test(name)) return 'huoshi';
      if (/大戟|戟士|戟兵/.test(name)) return 'daji';
      if (/陷阵|死士/.test(name)) return 'xianzhen';
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
    // 兵力即真实人数：hp 随战斗下降时，count 按初始比例同步折算为存活兵力，保证网格/坞/详情三处一致
    function syncCount(u) { if (u.startCount == null) u.startCount = u.count; u.count = Math.max(0, Math.round(u.startCount * (u.hp / u.maxHp))); }
    // 「战力伤害 → 兵力损失」换算：伤害扣的是 hp(战力)，count 按 hp/maxHp 比例映射；
    // 该比例随兵种与初始兵力变化，故所有展示伤害的地方都要同时给出折兵数。
    function countForHp(u, hp) { return Math.max(0, Math.round((u.startCount || u.count || 0) * Math.max(0, hp) / (u.maxHp || 1))); }
    function casualtyOf(u, dmg) { return u ? Math.max(0, (u.count || 0) - countForHp(u, (u.hp || 0) - dmg)) : 0; }
    function applyDamage(t, dmg, by) {
      if (board && board.invincible && t.side === 'ally') return;
      t.hp = Math.max(0, t.hp - dmg);
      syncCount(t);
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
      function toRow(u) { return { type: u.troopType || inferType(u.name), rank: u.rank || 'front', count: u.count || 100, _src: u }; }
      function defSide(side, n) { var pool = side === 'ally' ? ['changqiang', 'daodun', 'gongnu'] : ['changqiang', 'daodun', 'qibing', 'gongnu']; var a = []; for (var i = 0; i < n; i++) a.push({ type: pool[i % pool.length], rank: ['front', 'mid', 'rear'][i % 3], count: 120 }); return a; }
      var st = {
        grid: (preset.grid && preset.grid.w) ? { w: preset.grid.w, h: preset.grid.h } : (LF.BF_SCALE_TO_GRID && LF.BF_SCALE_TO_GRID[preset.scale]) ? { w: LF.BF_SCALE_TO_GRID[preset.scale].w, h: LF.BF_SCALE_TO_GRID[preset.scale].h } : { w: 12, h: 9 },
        allies: preset.allies ? preset.allies.map(toRow) : defSide('ally', 3),
        foes: preset.foes ? preset.foes.map(toRow) : defSide('foe', 3),
        title: preset.title || '野战', kind: preset.kind || 'field', map: preset.map || (preset.kind === 'siege' ? 'siege' : 'plain'), maxRounds: preset.maxRounds || 30,
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
        var autoOn = true; try { autoOn = (localStorage.getItem('bf-setup-always') || '1') === '1'; } catch (e) {}
        var mapBtns = Object.keys(LF.BF_MAPS || {}).map(function (k) { var m = LF.BF_MAPS[k];
          return '<button type="button" class="bf-map' + (st.map === k ? ' on' : '') + '" data-map="' + k + '"><b>' + esc(m.name) + '</b><i>' + esc(m.desc) + '</i></button>'; }).join('');
        sc.innerHTML =
          '<div class="bf-setup-head">战前部署 · ' + esc(st.title) + '</div>' +
          '<div class="bf-ssec"><div class="bf-ssec-t">战场地图</div><div class="bf-maps">' + mapBtns + '</div></div>' +
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
          '<label class="bf-dbg-row">回合上限 <input type="number" class="bf-dbg" data-k="maxRounds" value="' + st.maxRounds + '"/></label>' +
          '<label class="bf-dbg-row"><input type="checkbox" id="bf-always"' + (autoOn ? ' checked' : '') + '/> 每次开战前先显示此部署界面</label></div>' +
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
          else if (t.id === 'bf-always') { try { localStorage.setItem('bf-setup-always', t.checked ? '1' : '0'); } catch (e) {} }
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
          else if (t.closest && t.closest('.bf-map')) { st.map = t.closest('.bf-map').getAttribute('data-map'); renderSetup(); }
          else if (t.classList.contains('bf-s-del')) { var row = t.closest('.bf-srow'); var arr = st[row.getAttribute('data-side') === 'ally' ? 'allies' : 'foes']; arr.splice(+row.getAttribute('data-i'), 1); renderSetup(); }
          else if (t.classList.contains('bf-add-ally')) { st.allies.push({ type: 'changqiang', rank: 'front', count: 120 }); renderSetup(); }
          else if (t.classList.contains('bf-add-foe')) { st.foes.push({ type: 'qibing', rank: 'flank', count: 120 }); renderSetup(); }
          else if (t.id === 'bf-go') doStart();
          else if (t.id === 'bf-cancel') { hideSetup(); if (preset.allies && preset.allies.length) beginBattle(preset); }
        });
      }
      function doStart() {
        function build(r) {
          var u = r._src;
          if (u && (u.troopType || inferType(u.name)) === r.type && (u.rank || 'front') === r.rank && (u.count || 100) === r.count) return u;
          return bfBuildUnit(r.type, r.rank, r.count);
        }
        var allies = st.allies.map(build).filter(Boolean);
        var foes = st.foes.map(build).filter(Boolean);
        if (!allies.length || !foes.length) { toast && toast('双方至少各需一营。'); return; }
        var cfg = {
          kind: st.map === 'siege' ? 'siege' : st.kind, map: st.map,
          grid: { w: bfClamp(st.grid.w, 6, 40), h: bfClamp(st.grid.h, 6, 40) },
          allies: allies, foes: foes, title: st.title, maxRounds: bfClamp(st.maxRounds, 1, 200),
          invincible: !!st.dbg.invincible, showAllThreat: !!st.dbg.showAllThreat, enemyIdle: !!st.dbg.enemyIdle,
          seed: st.dbg.seed ? bfClamp(st.dbg.seed, 1, 1e9) : null,
          speedDefault: st.dbg.skipDefault ? 3 : (st.dbg.speedDefault || 1), skipDefault: !!st.dbg.skipDefault,
          _setupDone: true, onEnd: preset.onEnd || function () {}
        };
        for (var pk in preset) { if (!(pk in cfg) && pk !== 'allies' && pk !== 'foes' && pk !== 'grid' && pk !== 'setup') cfg[pk] = preset[pk]; }
        hideSetup(); beginBattle(cfg);
      }
      renderSetup();
    }

    // ───────── 战斗结算画面 ─────────
    function buildSummary(result, survivors, php) {
      var units = board.units.slice();
      units.sort(function (a, b) { return (b.dmgDealt || 0) - (a.dmgDealt || 0); });
      return {
        result: result, round: board.round, units: units, php: php,
        allyTotal: board.units.filter(function (u) { return u.side === 'ally'; }).length,
        foeTotal: board.units.filter(function (u) { return u.side === 'foe'; }).length,
        survivors: board.units.filter(function (u) { return u.side === 'ally' && u.hp > 0 && !u.routed; }).length,
        foeAlive: board.units.filter(function (u) { return u.side === 'foe' && u.hp > 0 && !u.routed; }).length
      };
    }
    function renderResult(sum) {
      var el = document.getElementById('bf-result'); if (!el) return;
      var titleMap = { win: '我军得胜', lose: '我军失利', fled: '鸣金撤兵', draw: '势均力敌' };
      var ranked = sum.units.slice().sort(function (a, b) { return (b.dmgDealt || 0) - (a.dmgDealt || 0); });
      var mvpRows = ranked.slice(0, 3).map(function (u, i) {
        return '<div class="bf-mvp-row"><span class="bf-mvp-no">' + (i + 1) + '</span><span class="bf-mvp-ico ico-' + (u.troopType || '') + '"></span><span class="bf-mvp-name ' + (u.side === 'ally' ? 'bf-ra' : 'bf-rf') + '">' + esc(u.name) + '</span><span class="bf-mvp-dmg">' + (u.dmgDealt || 0) + '</span><span class="bf-mvp-kill">歼 ' + (u.kills || 0) + '</span></div>';
      }).join('');
      var rows = sum.units.map(function (u) {
        var lost = Math.max(0, (u.startCount || 0) - Math.round(u.count || 0));
        var tn = (T()[u.type] && T()[u.type].name) || u.type;
        return '<tr><td class="' + (u.side === 'ally' ? 'bf-ra' : 'bf-rf') + '">' + esc(u.name) + '</td><td>' + esc(tn) + '</td><td>' +
          Math.max(0, Math.round(u.count || 0)) + '/' + (u.startCount || 0) + '</td><td>' + lost + '</td><td>' + (u.dmgDealt || 0) + '</td><td>' + (u.kills || 0) + '</td></tr>';
      }).join('');
      el.innerHTML = '<div class="bf-result-card"><h2 class="bf-result-title ' + (sum.result === 'win' ? 'good' : (sum.result === 'lose' ? 'bad' : 'mid')) + '">战斗结算 · ' + (titleMap[sum.result] || sum.result) + '</h2>' +
        '<div class="bf-result-sub">共 ' + sum.round + ' 回合 · 我军存活 ' + sum.survivors + '/' + sum.allyTotal + ' 营 · 敌军存活 ' + sum.foeAlive + '/' + sum.foeTotal + ' 营</div>' +
        '<table class="bf-result-tbl"><thead><tr><th>部队</th><th>兵种</th><th>余兵/上限</th><th>折损</th><th>伤害</th><th>歼敌</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="bf-result-mvp"><div class="bf-mvp-h">战功榜 · 伤害三甲</div>' + mvpRows + '</div>' +
        '<div class="bf-result-foot">合计伤害 ' + (sum.units.reduce(function (a, u) { return a + (u.dmgDealt || 0); }, 0)) + ' · 歼敌 ' + (sum.units.reduce(function (a, u) { return a + (u.kills || 0); }, 0)) + ' 营 · 折兵 ' + (sum.units.reduce(function (a, u) { return a + Math.max(0, (u.startCount || 0) - Math.round(u.count || 0)); }, 0)) + '</div>' +
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
      if (cfg && !cfg._setupDone && cfg.autoSetup !== false) {
        var always = '1'; try { always = localStorage.getItem('bf-setup-always') || '1'; } catch (e) {}
        if (always === '1') { openSetup(cfg); return; }
      }
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
        w: w, h: h, terrain: LF.BF_GEN_TERRAIN(w, h, cfg.kind === 'siege' ? 'siege' : 'field', cfg.map), map: cfg.map || 'plain', units: allies.concat(foes),
        round: 1, phase: 'ally', sel: null, mode: null, reach: [], attack: [], over: false, result: null, _history: [],
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
      try { playSfx('horn'); } catch (e) {}
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
        move: LF.BF_MOVE(u.spd),
        // 兵种自带 range 覆盖 slot 默认（弓骑兵 2 / 床弩手 3）；未声明者仍是旧射程
        range: (u.troopType && T()[u.troopType] && T()[u.troopType].range) || LF.BF_RANGE(slot),
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
      // 兵科特性：火矢焚林/垒/城，床弩破城垣/营垒（数据驱动，见 troops.js 可选字段）
      var trait = T()[a.troopType] || {}, traitMul = 1;
      if (trait.fire && (terrD.key === 'forest' || terrD.key === 'rampart' || terrD.key === 'wall')) traitMul *= 1.25;
      if (trait.siegeBonus && (terrD.key === 'wall' || terrD.key === 'rampart')) traitMul *= (1 + trait.siegeBonus);
      var raw = a.atk * mul * atkMul * counterMul * moraleMul * formationAtkMul(a) * traitMul;
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
      // 兵科特性：火矢焚林/垒/城，床弩破城垣/营垒（数据驱动，见 troops.js 可选字段）
      var trait = T()[a.troopType] || {}, traitMul = 1;
      if (trait.fire && (terrD.key === 'forest' || terrD.key === 'rampart' || terrD.key === 'wall')) traitMul *= 1.25;
      if (trait.siegeBonus && (terrD.key === 'wall' || terrD.key === 'rampart')) traitMul *= (1 + trait.siegeBonus);
      var raw = a.atk * mul * atkMul * counterMul * moraleMul * formationAtkMul(a) * traitMul;
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
      pushHistory(a);
      if (r.miss) log('〔交锋〕' + a.name + '攻' + d.name + '，被其闪过。', 'combat');
      else { r.lost = casualtyOf(d, r.dmg); playSfx(weaponSfx(a.troopType)); buzz(r.crit ? 45 : 22); shakeGrid(r.crit, d.x - a.x, d.y - a.y); effectLayer('bf-hit-flash', F(300)); applyDamage(d, r.dmg, a); log('〔' + (O.name || '攻击') + '〕' + a.name + '攻' + d.name + '，伤 ' + r.dmg + '（折兵 ' + (r.lost || 0) + '）' + (r.crit ? '（暴击）' : '') + (r.counter > 1 ? '（克制）' : r.counter < 1 ? '（被克）' : '') + '。', 'combat'); }
      applyOrderSideEffects(a, orderId);
      a.acted = true; a.moved = true;
      if (counter) log('〔反击〕' + d.name + '还击，伤 ' + a.name + ' ' + counter.dmg + '。', 'combat');
      if (d.hp <= 0) effectLayer('bf-rout-smoke', F(1200));
      board.sel = null; board.mode = null; board.reach = []; board.attack = [];
      render();
      // 飘字/爆裂必须放在 render 之后：render 会重建 #bf-grid 的 innerHTML，否则刚挂的飘字被冲掉
      floatHit(d, r, counter); if (d.hp <= 0) { routBurst(d.x, d.y); log('〔破营〕' + d.name + '营溃散，折损于阵。', d.side === 'foe' ? 'good' : 'danger'); bfBanner('〔破营〕' + d.name + '营溃散，折损于阵！', d.side === 'foe' ? 'good' : 'danger'); }
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
        if (cm > 1) s += 0.9; else if (cm < 1) s -= 0.7;
        if (t.range >= 2) s += 0.35;
        // 集火可斩：预估能直接击溃者优先
        var est = u.atk * (cm > 1 ? 1.25 : cm < 1 ? 0.8 : 1) * 0.92;
        if (est >= t.hp) s += 1.6;
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
              var sc = o.s + (terr.atkMul ? (terr.atkMul - 1) * 2 : 0) + (terr.defMul ? (terr.defMul - 1) * 2.2 : 0);
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
      // 射程够不到任何敌军时主动推进（残血后撤优先，已后撤/已能攻击者不推进）
      if (!path && !bestTgt) {
        var adv = advanceCell(u, scored);
        if (adv) {
          path = pathBetween(oldX, oldY, adv.x, adv.y, u);
          u.x = adv.x; u.y = adv.y; u.moved = true; u.acted = true;
          log('〔进军〕' + u.name + '向前进逼。');
        }
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
        else { r.lost = casualtyOf(bestTgt, r.dmg); playSfx(weaponSfx(u.troopType)); shakeGrid(r.crit, bestTgt.x - u.x, bestTgt.y - u.y); applyDamage(bestTgt, r.dmg, u); effectLayer('bf-hit-flash', F(300)); log('〔敌袭〕' + u.name + '攻' + bestTgt.name + '，伤 ' + r.dmg + '（折兵 ' + (r.lost || 0) + '）' + (r.counter > 1 ? '（克制）' : r.counter < 1 ? '（被克）' : '') + '。', 'danger'); }
        if (bestTgt.hp <= 0) effectLayer('bf-rout-smoke', F(1200));
        u.acted = true;
        info = { a: u, d: bestTgt, r: r, counter: counter };
      }
      function finish() { if (info) { render(); if (info.d) { floatHit(info.d, info.r, info.counter); if (info.d.hp <= 0) { routBurst(info.d.x, info.d.y); log('〔破营〕我方' + info.d.name + '营折损！', 'danger'); bfBanner('〔破营〕我方' + info.d.name + '营折损！', 'danger'); } } animateAttack(info, done); } else done(); }
      if (path) { render(); animateMove(u, path, finish); } else finish();
    }
    // 推进格：目标超出射程时，朝评分最高的敌军逼近。
    // 只在可达格中挑「切比雪夫距离真正变短」者；同距离时偏好移动代价低、防御高的地形。
    function advanceCell(u, scored) {
      var tgt = scored && scored.length ? scored[0].t : null;
      if (!tgt) return null;
      var reach = reachable(u), curD = cheb(u.x, u.y, tgt.x, tgt.y), best = null, bestSc = -1e9;
      for (var i = 0; i < reach.length; i++) {
        var p = reach[i];
        if (p.x === u.x && p.y === u.y) continue;
        var d = cheb(p.x, p.y, tgt.x, tgt.y);
        if (d >= curD) continue;
        var terr = terrainAt(p.x, p.y);
        var sc = -d * 10 - (terr.moveCost || 1) * 0.5 + (terr.defMul ? (terr.defMul - 1) * 1.5 : 0);
        if (sc > bestSc) { bestSc = sc; best = p; }
      }
      return best;
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
            u.routed = true; u.hp = Math.max(1, Math.round(u.hp * 0.5)); syncCount(u);
            log((isFoe ? '敌' : '我') + '「' + u.name + '」军心涣散，溃散离场！', isFoe ? 'good' : 'danger');
            floatText(u.x, u.y, '溃散', 'label-rout', 0);
            bfBanner((isFoe ? '敌' : '我') + '「' + u.name + '」军心涣散，溃散离场！', isFoe ? 'good' : 'danger');
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
          // 放在敌方出生行某空位（与 BF_SPAWN 的横向布阵一致）
          var fy = (board.cfg && board.cfg.kind === 'siege') ? Math.max(1, board.h - 2)
            : Math.max(1, board.h - 1 - Math.floor(board.h * 0.12));
          var placed = false;
          for (var xx = 0; xx < board.w && !placed; xx++) if (!unitAt(xx, fy)) { ru2.x = xx; ru2.y = fy; placed = true; }
          if (!placed) { ru2.x = Math.floor(board.w / 2); ru2.y = fy; }
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
      var stepMs = F(150);
      cell.style.transition = 'transform ' + stepMs + 'ms linear';
      var i = 1;
      (function next() {
        if (i >= path.length) {
          cell.style.transition = 'none';
          cell.style.transform = 'translate(0,0)';
          cell.classList.remove('bf-march');
          setTimeout(function () { clearTrail(); done && done(); }, F(70));
          return;
        }
        var p = path[i];
        cell.style.transform = 'translate(' + ((p.x - dest.x) * csX) + 'px,' + ((p.y - dest.y) * csY) + 'px)';
        i++;
        setTimeout(next, stepMs);
      })();
    }
    // 格心坐标统一入口：棋盘/特效层共用一套 (x+MARGIN)*cs + cs/2，杜绝各写一份产生偏差
    function cellCenter(x, y) { return { x: (x + MARGIN) * CSX + CSX / 2, y: (y + MARGIN) * CSY + CSY / 2 }; }
    // 箭群抛物线：从攻击者格心成束抛射到受击者格心，箭体朝向随抛物线切线变化（参考三国志系列齐射）
    function volley(host, a, d, onDone) {
      var from = cellCenter(a.x, a.y), to = cellCenter(d.x, d.y);
      var dx = to.x - from.x, dy = to.y - from.y;
      var dist = Math.hypot(dx, dy) || 1;
      var siege = a.troopType === 'gongcheng' || a.troopType === 'chuangnu' || a.slot === '械';
      var n = siege ? 1 : (a.troopType === 'gongnu' || a.troopType === 'huoshi' ? 5 : 3);
      var arc = Math.min(46, 16 + dist * 0.22);
      var finished = false, left = n;
      function oneDone() { left--; if (left <= 0 && !finished) { finished = true; onDone && onDone(); } }
      function finishAll() { if (!finished) { finished = true; onDone && onDone(); } }
      var gap = F(38), dur = F(300);
      for (var i = 0; i < n; i++) (function (i) {
        var spread = i - (n - 1) / 2;
        var ex = dx + spread * (siege ? 0 : 3), ey = dy + spread * (siege ? 0 : 2);
        var el = document.createElement('div');
        el.className = 'bf-arrow' + (siege ? ' bf-arrow-siege' : ' bf-arrow-volley') + (a.troopType === 'huoshi' ? ' bf-arrow-fire' : '');
        el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
        host.appendChild(el);
        // 抛物线 y(t) = ey*t - 4*arc*t*(1-t)：导数在 0/0.5/1 处为 ey-4arc / ey / ey+4arc
        var a0 = Math.atan2(ey - 4 * arc, ex) * 180 / Math.PI;
        var am = Math.atan2(ey, ex) * 180 / Math.PI;
        var a1 = Math.atan2(ey + 4 * arc, ex) * 180 / Math.PI;
        var mx = ex / 2, my = ey / 2 - arc - Math.abs(spread) * 2;
        var frames = [
          { transform: 'translate(0px,0px) rotate(' + a0 + 'deg)', offset: 0 },
          { transform: 'translate(' + mx + 'px,' + my + 'px) rotate(' + am + 'deg)', offset: 0.5 },
          { transform: 'translate(' + ex + 'px,' + ey + 'px) rotate(' + a1 + 'deg)', offset: 1 }
        ];
        var delay = i * gap, once = false;
        function cleanup() {
          if (once) return; once = true;
          if (el.parentNode) el.parentNode.removeChild(el);
          oneDone();
        }
        if (el.animate) {
          var anim = el.animate(frames, { duration: dur, delay: delay, easing: 'ease-out', fill: 'forwards' });
          anim.onfinish = cleanup; anim.oncancel = cleanup;
        }
        // 兜底：WAAPI 不可用 / 元素被 render 冲掉 / 动画未触发 finish，照样清理并收尾
        setTimeout(cleanup, delay + dur + F(60));
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, delay + dur + F(160));
      })(i);
      setTimeout(finishAll, (n - 1) * gap + dur + F(180));
    }
    // 近战兵种专属打击效果：枪影 / 刀光 / 骑冲残影 / 器械砸击
    function strikeFx(host, a, d, crit) {
      var from = cellCenter(a.x, a.y), to = cellCenter(d.x, d.y);
      var kind = ({ changqiang: 'spear', daji: 'spear', daodun: 'blade', xianzhen: 'blade',
        qibing: 'charge', gongqi: 'charge', gongcheng: 'siege' })[a.troopType] || 'blade';
      var anchor = (kind === 'blade' || kind === 'siege') ? to : from;
      var el = document.createElement('div');
      el.className = 'bf-strike bf-strike-' + kind + (crit ? ' crit' : '');
      el.style.left = anchor.x + 'px'; el.style.top = anchor.y + 'px';
      el.style.setProperty('--bf-rot', (Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI) + 'deg');
      el.style.setProperty('--bf-len', Math.max(CSX, Math.hypot(to.x - from.x, to.y - from.y)) + 'px');
      host.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, F(640));
    }
    // 攻击动画：攻击者前冲 -> 命中闪光 + 震屏 -> 退回；反击作为第二拍；跳帧时直接结算
    function animateAttack(info, done) {
      var fgrid = document.getElementById('bf-floats') || document.getElementById('bf-grid');
      var grid = document.getElementById('bf-grid');
      if (!fgrid || !grid) { done && done(); return; }
      if (board && board.skip) { done && done(); return; }
      var a = info.a, d = info.d, cs = cellSize(), csX = CSX, csY = CSY;
      var ca = grid.querySelector('[data-uid="' + a.id + '"]'), cd = grid.querySelector('[data-uid="' + d.id + '"]');
      var ua = ca && ca.querySelector('.bf-unit'), ud = cd && cd.querySelector('.bf-unit');
      // 攻击全程给目标格加锁定脉冲，让视线先跟上「谁在挨打」
      if (cd) cd.classList.add('bf-locked');
      function finishAttack() { if (cd) cd.classList.remove('bf-locked'); done && done(); }
      // 命中统一落点：闪光 + 方向震屏 + 火花 + 击退(内含 hit-stop 定格) + 分层音效
      function landing() {
        var crit = info.r && info.r.crit, hs = 0;
        if (ud) {
          ud.classList.add('bf-hit');
          // 折兵时让格上兵力药丸脉冲一下，把「少了多少兵」也落到棋子本身
          if (info.r && info.r.lost) {
            var cnt = ud.querySelector('.bf-u-cnt');
            if (cnt) { cnt.classList.remove('bf-cnt-drop'); void cnt.offsetWidth; cnt.classList.add('bf-cnt-drop'); }
          }
          shakeGrid(crit ? 2 : 1, d.x - a.x, d.y - a.y);
          hitSpark(d.x, d.y, crit);
          hs = knockback(ud, a, d, crit, info.r && info.r.miss) || 0;
        }
        playSfx('hit', crit);
        return hs;
      }
      function hitAndCounter() {
        var hs = landing();
        setTimeout(function () {
          if (ud) ud.classList.remove('bf-hit');
          if (info.counter) { setTimeout(function () { animateAttack({ a: d, d: a, r: info.counter, counter: null }, done); }, F(130)); }
          else finishAttack();
        }, F(150) + hs);
      }
      // 远程（射程≥2）：从攻击者格心成束抛射到受击者格心，落点命中后再结算
      if (a.range >= 2 && ua && ud) { volley(fgrid, a, d, hitAndCounter); return; }
      // 近战：突刺
      if (!ua || !ud) { hitAndCounter(); return; }
      var ddx = d.x - a.x, ddy = d.y - a.y, len = Math.hypot(ddx, ddy) || 1, lx = ddx / len, ly = ddy / len, lp = 0.42 * Math.min(csX, csY);
      ua.style.transition = 'transform ' + (F(140) / 1000) + 's ease-out';
      ua.style.transform = 'translate(' + (lx * lp) + 'px,' + (ly * lp) + 'px)';
      setTimeout(function () {
        strikeFx(fgrid, a, d, info.r && info.r.crit);
        var hs = landing();
        setTimeout(function () {
          ua.style.transition = 'transform ' + (F(160) / 1000) + 's ease-in';
          ua.style.transform = 'translate(0,0)';
          setTimeout(function () { ud.classList.remove('bf-hit'); if (info.counter) { setTimeout(function () { animateAttack({ a: d, d: a, r: info.counter, counter: null }, done); }, F(130)); } else finishAttack(); }, F(170));
        }, F(150) + hs);
      }, F(150));
    }
    // 方向性击退抖动：受击方沿「攻击者→防守者」方向被撞退，回弹中带垂直高频抖动；暴击更重，闪避不击退
    function knockback(el, a, d, crit, miss) {
      if (!el || !el.animate || miss) return;
      // 城垣/营垒上的守军、攻城器械：据坚不动，完全不出现击退
      var terr = terrainAt(d.x, d.y);
      if (terr.key === 'wall' || terr.key === 'rampart' || d.troopType === 'gongcheng') return;
      // 重量分档：甲厚/人多者稳，轻装者一撞即退；防御地形再乘衰减
      var wUnit = { daodun: 0.5, changqiang: 0.85, daji: 0.8, xianzhen: 1.15,
        qibing: 1.05, gongqi: 1.25, gongnu: 1.4, huoshi: 1.45, chuangnu: 0.55,
        gongcheng: 0.4, qizhong: 1.2, minfu: 1.35 }[d.troopType] || 1;
      var wTerr = 1 / Math.max(0.8, terr.defMul || 1);
      var cs = Math.min(CSX, CSY);
      var vx = d.x - a.x, vy = d.y - a.y, len = Math.hypot(vx, vy) || 1;
      var nx = vx / len, ny = vy / len, px = -ny, py = nx;
      var amp = Math.min(cs * 0.55, cs * (crit ? 0.34 : 0.20) * wUnit * wTerr), sh = amp * 0.24;
      function T(k, s) { return 'translate(' + (nx * amp * k + px * sh * s).toFixed(1) + 'px,' + (ny * amp * k + py * sh * s).toFixed(1) + 'px)'; }
      // hit-stop：撞到最远点后定格 hs 毫秒再回弹（无需全局冻结计时器）
      var base = F(crit ? 420 : 330), hs = D(crit ? 105 : 55), total = base + hs;
      var frames = [
        [0, 0, 0], [0.16 * base, 1, 0], [0.16 * base + hs, 1, 0],
        [0.30 * base + hs, 0.62, 1], [0.46 * base + hs, 0.34, -1],
        [0.64 * base + hs, 0.16, 0.6], [0.82 * base + hs, 0.05, -0.3], [total, 0, 0]
      ];
      try {
        el.animate(frames.map(function (f) { return { transform: T(f[1], f[2]), offset: f[0] / total }; }), { duration: total, easing: 'ease-out' });
      } catch (e) { return 0; }
      return hs;
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
    // 方向性分级震屏：lv 1 普通 / 2 暴击 / 3 破营；位移沿攻击方向，幅度与时长按级别递增
    function shakeGrid(strong, dx, dy) {
      var vp = document.getElementById('bf-viewport'); if (!vp) return;
      var lv = strong === true ? 2 : (Number(strong) || 1);
      var vx = dx || 0, vy = dy || 0, len = Math.hypot(vx, vy);
      if (len < 0.001) { vx = 0; vy = 1; len = 1; }
      var amp = lv >= 3 ? 9 : lv >= 2 ? 6 : 3;
      vp.style.setProperty('--bf-sh-x', (vx / len * amp).toFixed(1) + 'px');
      vp.style.setProperty('--bf-sh-y', (vy / len * amp).toFixed(1) + 'px');
      vp.classList.remove('bf-shake', 'bf-shake-crit', 'bf-shake-break');
      void vp.offsetWidth;
      vp.classList.add(lv >= 3 ? 'bf-shake-break' : lv >= 2 ? 'bf-shake-crit' : 'bf-shake');
      setTimeout(function () { vp.classList.remove('bf-shake', 'bf-shake-crit', 'bf-shake-break'); }, lv >= 3 ? 480 : lv >= 2 ? 360 : 200);
    }
    // 战棋 v12 氛围特效层（命中闪光/溃败烟尘；CSS 动画结束自动移除，pointer-events:none 不挡点击）
    function effectLayer(cls, ms) { var vp = document.getElementById('bf-viewport'); if (!vp) return; var el = document.createElement('div'); el.className = cls; vp.appendChild(el); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms + 80); }
    var _actx = null;
    function playSfx(type, strong) {
      try {
        if (!_actx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) _actx = new AC(); }
        if (!_actx) return;
        if (_actx.state === 'suspended') _actx.resume();
        var t = _actx.currentTime;
        function tone(freq, dur, wave, gain, at) {
          var st = at == null ? t : at;
          var o = _actx.createOscillator(), g = _actx.createGain();
          o.type = wave; o.frequency.setValueAtTime(freq, st); o.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.6), st + dur);
          g.gain.setValueAtTime(gain, st); g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
          o.connect(g); g.connect(_actx.destination); o.start(st); o.stop(st + dur + 0.02);
        }
        // 国风 UI 音：短噪声经带通滤波 = 木鱼/竹板的「嗒」，与合成器战斗音区分
        function wood(freq, at, vol) {
          var dur = 0.075, n = Math.ceil(_actx.sampleRate * dur);
          var buf = _actx.createBuffer(1, n, _actx.sampleRate), data = buf.getChannelData(0);
          for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
          var src = _actx.createBufferSource(); src.buffer = buf;
          var bp = _actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
          var g = _actx.createGain(); g.gain.setValueAtTime(vol || 0.09, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
          src.connect(bp); bp.connect(g); g.connect(_actx.destination); src.start(at); src.stop(at + dur);
        }
        if (type === 'select' || type === 'detail') { wood(1150, t, 0.075); tone(520, 0.05, 'sine', 0.018, t); return; }
        if (type === 'confirm') { wood(780, t, 0.085); return; }
        if (type === 'cancel') { wood(430, t, 0.07); return; }
        // 命中音分层：低频冲击 + 中频肉声 + 高频脆响，暴击再叠一层金属泛音
        if (type === 'hit') {
          tone(120, 0.12, 'sawtooth', 0.055, t);
          tone(300, 0.075, 'square', 0.026, t + 0.006);
          tone(strong ? 1180 : 820, 0.05, 'triangle', strong ? 0.034 : 0.020, t);
          if (strong) tone(1560, 0.10, 'sine', 0.020, t + 0.02);
          return;
        }
        var P = { select:[440,0.05,'sine',0.05], move:[330,0.08,'triangle',0.045], confirm:[620,0.07,'square',0.05], attack:[180,0.13,'sawtooth',0.07], hit:[140,0.1,'square',0.06], cancel:[220,0.06,'sine',0.04], detail:[520,0.05,'sine',0.04], win:[660,0.22,'triangle',0.07], lose:[150,0.28,'sawtooth',0.07], arrow:[760,0.1,'triangle',0.05], siege:[90,0.2,'sawtooth',0.09], horn:[330,0.42,'sawtooth',0.07] };
        var p = P[type] || P.select;
        tone(p[0], p[1], p[2], p[3], t);
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
      if (u && u.side === 'ally') { board.sel = u; board.mode = null; board.reach = reachable(u); board.attack = attackable(u); board.threat = null; board._previewFoe = null; board.pendingMove = null; board._pathPreview = []; playSfx('select'); buzz(8); render(); focusCell(u.x, u.y); return; }
      // 选中后直接点可达空格 = 直接移动
      if (board.sel && !u && inReach(x, y)) { commitMove(x, y); return; }
      // 选中后直接点可攻击敌 = 弹出攻击指令
      if (board.sel && !board.mode && u && u.side === 'foe' && inAttack(x, y)) { openOrderMenu(board.sel, u); return; }
      if (u && u.side === 'foe' && !board.mode) { board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = computeThreat(u); board._previewFoe = u; board.pendingMove = null; board._pathPreview = []; closeMenu(); render(); return; }
      // 点空白：取消选择
      board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = null; board._previewFoe = null; board.pendingMove = null; board._pathPreview = []; closeMenu();
      render();
    }
    // 底部坞点敌军芯片：仅查看威胁预览/属性，不改变选择（与棋盘点敌同效）
    function bfPreviewFoe(x, y) {
      if (!board || board.over || board.phase !== 'ally') return;
      var u = unitAt(x, y);
      if (!u || u.side !== 'foe') return;
      board.sel = null; board.mode = null; board.reach = []; board.attack = []; board.threat = computeThreat(u); board._previewFoe = u; board.pendingMove = null; board._pathPreview = []; closeMenu(); render();
    }
    function inReach(x, y) { return board.reach.some(function (p) { return p.x === x && p.y === y; }); }
    function inAttack(x, y) { return board.attack.some(function (p) { return p.x === x && p.y === y; }); }
    function unitById(id) { return board.units.filter(function (u) { return u.id === id; })[0]; }

    function commitMove(x, y) {
      var u = board.sel; if (!u) return;
      pushHistory(u);
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
    // 撤销：回合内可逐级回退上一步（移动/攻击），含受击方血量，避免误触劝退
    function pushHistory(actor) {
      if (!board) return;
      var snap = { actor: actor ? actor.id : null,
        units: board.units.map(function (u) { return { id: u.id, x: u.x, y: u.y, moved: u.moved, acted: u.acted, hp: u.hp, count: u.count, dmgDealt: u.dmgDealt, kills: u.kills, routed: u.routed }; }) };
      board._history.push(snap);
      if (board._history.length > 16) board._history.shift();
    }
    function bfUndo() {
      if (!board || board.over || board.phase !== 'ally') return;
      if (!board._history.length) return;
      var snap = board._history.pop();
      var byId = {}; board.units.forEach(function (u) { byId[u.id] = u; });
      snap.units.forEach(function (s) { var u = byId[s.id]; if (!u) return; u.x = s.x; u.y = s.y; u.moved = s.moved; u.acted = s.acted; u.hp = s.hp; u.count = s.count; u.dmgDealt = s.dmgDealt; u.kills = s.kills; u.routed = s.routed; });
      var a = snap.actor ? byId[snap.actor] : null;
      board.sel = (a && a.hp > 0) ? a : null; board.mode = null; board.reach = []; board.attack = []; board.threat = null;
      if (board.sel) { board.reach = reachable(board.sel); board.attack = attackable(board.sel); }
      render(); renderTopMenu();
      if (toast) toast('已撤销上一步。');
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
      effectLayer('bf-rout-smoke', F(1200));
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
        '<div class="bf-viewport" id="bf-viewport"><div class="bf-grid" id="bf-grid"></div><div class="bf-floats" id="bf-floats"></div></div>' +
        '<div class="bf-banners" id="bf-banners"></div>' +
        '<div class="bf-order" id="bf-order"></div>' +
        '<div class="bf-dock" id="bf-dock"></div>' +
        '<div class="bf-fab" id="bf-fab">' +
          '<button type="button" class="bf-fab-b" data-panel="log" title="战报">报</button>' +
          '<button type="button" class="bf-fab-b" data-panel="zoom" title="视图缩放">⤢</button>' +
        '</div>' +
        '<div class="bf-fab-panel" id="bf-fab-panel" hidden></div>' +
        '<div class="bf-plate" id="bf-plate"></div>' +
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
      if (gw <= vw && gh <= vh) { panX = (vw - gw) / 2; panY = (vh - gh) / 2; }
      applyPan();
    }
    // 应用平移 + 边界收敛（按缩放后的有效尺寸判断，放大后仍可拖动视野）
    function applyPan() {
      var grid = document.getElementById('bf-grid'), vp = document.getElementById('bf-viewport');
      if (!grid || !vp) return;
      var gw = grid.offsetWidth, gh = grid.offsetHeight, vw = vp.clientWidth, vh = vp.clientHeight;
      var z = zoomLevel;
      // transform-origin:50% 50% → 左边缘 = panX + gw*(1-z)/2，右边缘 = panX + gw*(1+z)/2
      var minX = vw - gw * (1 + z) / 2, maxX = gw * (z - 1) / 2;
      var minY = vh - gh * (1 + z) / 2, maxY = gh * (z - 1) / 2;
      if (minX > maxX) panX = (vw - gw) / 2; else panX = Math.max(minX, Math.min(maxX, panX));
      if (minY > maxY) panY = (vh - gh) / 2; else panY = Math.max(minY, Math.min(maxY, panY));
      grid.style.transformOrigin = '50% 50%';
      var _tf2 = 'translate(' + panX + 'px,' + panY + 'px) scale(' + z + ')';
      grid.style.transform = _tf2;
      var _fl2 = document.getElementById('bf-floats'); if (_fl2) { _fl2.style.transformOrigin = '50% 50%'; _fl2.style.transform = _tf2; }
    }
    // 相机跟随：把指定格居中到视口（大棋盘平移，小棋盘保持居中）
    function focusCell(cx, cy) {
      var grid = document.getElementById('bf-grid'), vp = document.getElementById('bf-viewport');
      if (!grid || !vp || !board) return;
      var csX = CSX, csY = CSY;
      var gw = grid.offsetWidth, gh = grid.offsetHeight, vw = vp.clientWidth, vh = vp.clientHeight;
      if (gw * zoomLevel <= vw && gh * zoomLevel <= vh) { applyPan(); return; }
      var cellCX = (cx + MARGIN) * csX + csX / 2, cellCY = (cy + MARGIN) * csY + csY / 2;
      // 屏幕 x = panX + gw/2 + z*(cellCX - gw/2)，解出把该格居中所需的 panX
      panX = vw / 2 - gw / 2 - zoomLevel * (cellCX - gw / 2);
      panY = vh / 2 - gh / 2 - zoomLevel * (cellCY - gh / 2);
      applyPan();
    }
    // 战场整幅水墨背景：地图模板 → 画（现有 3 张原画复用；后续补齐 5 张只改这张表）
    // 平原画含草地/树林/河流，故 river 复用；山地画含群山/小路，故 forest/pass 复用。
    var BF_MAP_ART = {
      plain:  'field_plain.webp',
      river:  'field_plain.webp',
      forest: 'field_mountain.webp',
      pass:   'field_mountain.webp',
      siege:  'field_siege.webp'
    };
    function render() {
      if (!board) return;
      // CSS 侧演出时长同步倍率（粒子/飘字/弹道）；跳帧时压到极短
      var fxRoot = document.getElementById('bf-root');
      if (fxRoot) fxRoot.style.setProperty('--bf-fx', (board.skip ? 0.15 : FX_SCALE / (board.speed || 1)).toFixed(2));
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
      // 一张地图一张画：background 写在棋盘容器上（而非逐格），cover 自适应任意棋盘尺寸。
      // dataset 去重：render 每步都跑，避免重复写同一 URL 触发无谓重绘。
      var art = BF_MAP_ART[board.map] || BF_MAP_ART.plain;
      if (grid.dataset.art !== art) {
        grid.dataset.art = art;
        grid.style.backgroundImage = "url('shared/img/battlefield/" + art + "')";
        grid.style.backgroundSize = 'cover';
        grid.style.backgroundPosition = 'center';
        grid.style.backgroundRepeat = 'no-repeat';
      }
      // 特效层必须与网格层同尺寸、同变换中心：否则缩放后箭/飘字按各自 50% 缩放，飞到棋盘外
      var fl = document.getElementById('bf-floats');
      if (fl) {
        fl.style.width = X[GW] + 'px'; fl.style.height = Y[GH] + 'px';
        fl.style.transformOrigin = '50% 50%';
        fl.style.setProperty('--bf-cs', Math.min(csX, csY) + 'px');
      }
      // 顶栏
      var top = document.getElementById('bf-top');
      if (top) {
        var aN = sideUnits('ally').length, fN = sideUnits('foe').length;
        var aHp = totalHp('ally'), fHp = totalHp('foe');
        top.innerHTML = '<span class="bf-top-l">第 ' + board.round + ' 回合 · ' + (board.phase === 'ally' ? '我军阶段' : '敌军阶段') + '</span>' +
          '<span class="bf-top-m">' + esc(board.title) + '</span>' +
          '<span class="bf-top-r">我 ' + aN + '/' + aHp + ' · 敌 ' + fN + '/' + fHp + '</span>' +
          '<button type="button" class="bf-top-btn bf-undo-btn" title="撤销上一步" onclick="window.bfUndo()"' + (board._history && board._history.length ? '' : ' disabled') + '>↩</button>' +
          '<button type="button" class="bf-top-btn" data-menu="more" title="更多">⋮</button>';
      }
      var orderEl = document.getElementById('bf-order');
      if (orderEl) {
        var phaseUnits = sideUnits(board.phase).slice().sort(function (a, b) { return (b.spd || 0) - (a.spd || 0) || ((a.acted ? 1 : 0) - (b.acted ? 1 : 0)); });
        orderEl.innerHTML = '<span class="bf-order-h">出手序</span>' + phaseUnits.map(function (u) {
          var cls = 'bf-order-chip ' + (u.side === 'ally' ? 'bf-ally' : 'bf-foe') + (board._acting === u ? ' on' : (u.acted ? ' done' : ''));
          return '<i class="' + cls + '"><i class="bf-order-ico ico-' + (u.troopType || '') + '"></i></i>';
        }).join('');
        // 详情板/威胁预览展开时收起出手序条，避免四层 HUD 同时占屏
        var plateOpen = !!(board.phase === 'ally' && ((board.sel && !board.sel.acted) || board.threat));
        orderEl.classList.toggle('bf-order-hidden', plateOpen);
      }
      // 部队列表 -> FAB 抽屉按需渲染（见 refreshFabPanels / unitListHTML）
      // 战报 -> FAB 抽屉按需渲染（见 refreshFabPanels / logHTML）
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
            // 延迟追赶血条：残影从上次显示值收缩到本次实时值
            var ghostPct = Math.max(hpPct, u._hpShown == null ? hpPct : u._hpShown);
            u._hpShown = hpPct;
            inner += '<div class="bf-unit ' + sideCls + (u.routed ? ' bf-routed' : '') + (danger ? ' bf-danger' : '') + (board.sel === u ? ' bf-sel-u' : '') + (u.acted ? ' bf-acted' : '') + '"' + hov + ' onclick="window.bfClick(' + x + ',' + y + ')">' +
              '<i class="bf-u-ico ' + icoCls + '"></i>' +
              '<b class="bf-u-cnt">' + (u.count || 0) + '</b>' +
              '<i class="bf-u-hp"><i class="bf-u-hp-fill" style="width:' + hpPct + '%"></i><i class="bf-u-hp-ghost" data-to="' + hpPct + '" style="width:' + ghostPct + '%"></i></i>' +
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
      // 强制一次样式计算后把残影宽度改为新值，触发 transition 追赶（render 重建 DOM 需手动触发）
      void grid.offsetWidth;
      var ghosts = grid.querySelectorAll('.bf-u-hp-ghost');
      for (var gi = 0; gi < ghosts.length; gi++) ghosts[gi].style.width = ghosts[gi].getAttribute('data-to') + '%';
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
          '<select class="bf-speed-select" id="bf-speed-select" onchange="window.bfSpeed(parseFloat(this.value))">' +
          '<option value="0.5"' + (speed === 0.5 ? ' selected' : '') + '>0.5×</option>' +
          '<option value="1"' + (speed === 1 ? ' selected' : '') + '>1×</option>' +
          '<option value="2"' + (speed === 2 ? ' selected' : '') + '>2×</option>' +
          '<option value="3"' + (speed === 3 ? ' selected' : '') + '>3×</option>' +
          '<option value="0"' + (skip ? ' selected' : '') + '>跳帧</option>' +
          '</select>' +
          '<button type="button" class="btn bf-main" id="bf-et">结束回合' + (board.phase === 'ally' && rest > 0 ? '（余' + rest + '）' : '') + '</button>' +
          '<button type="button" class="btn bf-more-btn" id="bf-more">更多</button>';
        var et = document.getElementById('bf-et'); if (et) et.onclick = function () { bfEndTurn(); };
        // 更多菜单挂 #bf-root 直下（不放 .bf-bar 内）：手机端操作条 overflow-x:auto 会裁掉向上展开的菜单，表现为「点了有动画但没内容」
        var moreMenu = document.getElementById('bf-more-menu');
        if (!moreMenu) {
          moreMenu = document.createElement('div');
          moreMenu.id = 'bf-more-menu';
          moreMenu.className = 'bf-more-menu';
          moreMenu.hidden = true;
          moreMenu.innerHTML =
            '<button type="button" class="bf-more-item" id="bf-nx">下一营</button>' +
            '<button type="button" class="bf-more-item" id="bf-rt">' + (board._retreatAsk ? '确认撤退？' : '鸣金收兵') + '</button>';
          var rootEl = document.getElementById('bf-root');
          if (rootEl) rootEl.appendChild(moreMenu);
          var nx = document.getElementById('bf-nx'); if (nx) nx.onclick = function () { moreMenu.hidden = true; bfNextUnit(); };
          var rt = document.getElementById('bf-rt'); if (rt) rt.onclick = function () { moreMenu.hidden = true; bfRetreat(); };
          // 点其他地方关闭更多菜单（仅创建时绑一次，避免每次 render 泄漏监听器）
          document.addEventListener('click', function (e) { if (!e.target.closest('#bf-more') && !e.target.closest('#bf-more-menu')) moreMenu.hidden = true; });
        } else {
          var rtB = document.getElementById('bf-rt');
          if (rtB) rtB.textContent = board._retreatAsk ? '确认撤退？' : '鸣金收兵';
        }
        var moreBtn = document.getElementById('bf-more');
        if (moreBtn && moreMenu) moreBtn.onclick = function (e) { e.stopPropagation(); moreMenu.hidden = !moreMenu.hidden; };

      updateAttackPreview();
      // 确认钮在落点格内渲染（见棋盘 pendingMove），无需单独处理
      renderPlate();
      renderDock();
      refreshFabPanels();
      }
      // 指令菜单：仅攻击指令/详情由点击敌方触发；原底部 .bf-action 弹出已移除（改用顶部 contextual 条，不挡速度面板）
      if (board.phase !== 'ally') { closeMenu(); var _mm = document.getElementById('bf-more-menu'); if (_mm) _mm.hidden = true; }
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
        var actedCls = u.acted ? ' acted' : '';
        var mvDot = (!u.acted && !u.moved) ? '<i class="bf-dk-dot bf-dk-mv" title="可移动"></i>' : '';
        var atkDot = (!u.acted) ? '<i class="bf-dk-dot bf-dk-atk" title="可攻击"></i>' : '';
        html += '<div class="bf-unit-card ' + sideCls + selCls + actedCls + '" onclick="window.bfClick(' + u.x + ',' + u.y + ');window.bfCloseFab()">' +
          '<div class="bf-uc-ava">' + troopAvatarHTML(u.troopType, u.side, 38) + '</div>' +
          '<div class="bf-uc-main">' +
          '<div class="bf-uc-name">' + esc(u.name) + '</div>' +
          '<div class="bf-uc-count">' + u.count + '</div>' +
          '<div class="bf-uc-hp"><i style="width:' + hpPct + '%"></i></div>' +
          '<div class="bf-uc-mor"><i style="width:' + morPct + '%"></i></div>' +
          '</div><div class="bf-uc-dots">' + mvDot + atkDot + '</div></div>';
      });
      return html;
    }
    function logHTML() {
      if (!board) return '';
      var html = '';
      (board.log || []).slice(-30).forEach(function (l) {
        html += '<div class="bf-log-item ' + (l.c || '') + '">' + esc(l.m) + '</div>';
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
      if (kind === 'log') return '<div class="bf-fp-h">战报 <button type="button" class="bf-fp-x" onclick="window.bfCloseFab()">✕</button></div><div class="bf-fp-body" id="bf-fp-log"></div>';
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
      else if (kind === 'log') { var fl = document.getElementById('bf-fp-log'); if (fl) { fl.innerHTML = logHTML(); fl.scrollTop = fl.scrollHeight; } }
    }
    function refreshFabPanels() {
      var panel = document.getElementById('bf-fab-panel');
      if (!panel || panel.hidden || !board) return;
      if (board._fabPanel === 'units') { var fu = document.getElementById('bf-fp-units'); if (fu) fu.innerHTML = unitListHTML(); }
      else if (board._fabPanel === 'log') { var fl = document.getElementById('bf-fp-log'); if (fl) { fl.innerHTML = logHTML(); fl.scrollTop = fl.scrollHeight; } }
    }

    /* 部队立绘：真实立绘背景图（v7 豆包美术资源，WebP）；容器尺寸由父级定（操作板/列表） */
    function troopAvatarHTML(troopType, side, size) {
      return '<span class="bf-ava-art bf-ava-' + (side === 'ally' ? 'ally' : 'foe') + ' ' + (troopType ? 'ico-' + troopType : '') + '"></span>';
    }

    /* 底部常驻单位坞：横排小卡（立绘+兵力+血条+状态点）；点选即选中并居中 */
    function renderDock() {
      var dock = document.getElementById('bf-dock');
      if (!dock || !board) return;
      if (board.phase !== 'ally') { dock.hidden = true; dock.innerHTML = ''; var _vp0 = document.getElementById('bf-viewport'); if (_vp0) _vp0.style.bottom = ''; return; }
      dock.hidden = false;
      // 坞占位：为操作条(56) + 坞(~62) 预留底部空间，避免遮挡棋盘
      var _vp = document.getElementById('bf-viewport');
      if (_vp) _vp.style.bottom = '120px';
      var html = '';
      // 单个单位小卡：立绘 + 兵力 + 血条 + 军心 + 行动状态点；我方点选、敌军点开威胁预览
      function card(u, isFoe) {
        var hpPct = Math.max(0, Math.min(100, Math.round(100 * u.hp / u.maxHp)));
        var morPct = Math.max(0, Math.min(100, Math.round(u.morale == null ? 80 : u.morale)));
        var selCls = (isFoe ? board._previewFoe === u : board.sel === u) ? ' selected' : '';
        var actedCls = u.acted ? ' acted' : '';
        var mvDot = (!u.acted && !u.moved) ? '<i class="bf-dk-dot bf-dk-mv"></i>' : '';
        var atkDot = (!u.acted) ? '<i class="bf-dk-dot bf-dk-atk"></i>' : '';
        var clk = isFoe ? ('window.bfPreviewFoe(' + u.x + ',' + u.y + ')') : ('window.bfClick(' + u.x + ',' + u.y + ')');
        return '<button type="button" class="bf-dk-card ' + (isFoe ? 'foe' : '') + selCls + actedCls + '" onclick="' + clk + '" title="' + esc(u.name) + '">' +
          '<span class="bf-dk-ava">' + troopAvatarHTML(u.troopType, u.side, 34) + '</span>' +
          '<span class="bf-dk-cnt">' + (u.count || 0) + '</span>' +
          '<span class="bf-dk-hp"><i style="width:' + hpPct + '%"></i></span>' +
          '<span class="bf-dk-mor"><i style="width:' + morPct + '%"></i></span>' +
          '<span class="bf-dk-dots">' + mvDot + atkDot + '</span>' +
          '</button>';
      }
      sideUnits('ally').forEach(function (u) { html += card(u, false); });
      var foes = sideUnits('foe');
      if (foes.length) { html += '<span class="bf-dk-sep"></span>'; foes.forEach(function (u) { html += card(u, true); }); }
      dock.innerHTML = html;
    }

    function renderPlate() {
      var plate = document.getElementById('bf-plate');
      var bar = document.getElementById('bf-bar');
      if (!plate || !board) return;
      if (board.phase !== 'ally') { plate.classList.remove('open'); plate.innerHTML = ''; if (bar) bar.style.visibility = 'visible'; return; }
      if (board.sel && !board.sel.acted) {
        var u = board.sel;
        var danger = dangerOf(u);
        plate.classList.add('open');
        if (bar) bar.style.visibility = 'hidden';
        plate.innerHTML = '<div class="bf-plate-row">' + '<div class="bf-plate-ava">' + troopAvatarHTML(u.troopType, u.side, 46) + '</div>' + '<div class="bf-plate-info">' +
          '<span class="bf-plate-name">' + esc(u.name) + '</span>' +
          '<div class="bf-plate-tags">' +
            '<span class="bf-tag bf-tag-count">兵 ' + (u.count || 0) + '</span>' +
            '<span class="bf-tag bf-tag-mor">军心 ' + u.morale + '</span>' +
          '</div>' +
          '<span class="bf-plate-stats">攻' + u.atk + ' · 防' + u.def + ' · 速' + u.spd + ' · 移' + u.move + ' · 射' + u.range + ' · 1兵≈' + Math.round(u.maxHp / (u.startCount || u.count || 1)) + '战力</span>' +
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
        plate.classList.add('open');
        if (bar) bar.style.visibility = 'hidden';
        plate.innerHTML = '<div class="bf-plate-row"><div class="bf-plate-ava">' + troopAvatarHTML(tu.troopType, tu.side, 46) + '</div><div class="bf-plate-info"><span class="bf-plate-name bf-plate-foe">' + esc(tu.name) + ' 威胁预览</span><span class="bf-plate-stats">攻' + tu.atk + '·防' + tu.def + '·移' + tu.move + '·射' + tu.range + '</span></div></div><div class="bf-plate-hint">红框=可攻击 · 黄框=可移动 · 点空白关闭</div>';
        return;
      }
      plate.classList.remove('open'); plate.innerHTML = '';
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
      // r 已含缩放，故每格屏幕尺寸也要乘 zoomLevel
      var ux = CSX * zoomLevel, uy = CSY * zoomLevel;
      var gx = Math.floor((cx - r.left) / ux), gy = Math.floor((cy - r.top) / uy);
      var bx = gx - MARGIN, by = gy - MARGIN;
      if (bx < 0 || bx >= board.w || by < 0 || by >= board.h) return null;
      return { x: bx, y: by };
    }
    function bindDrag() {
      var vp = document.getElementById('bf-viewport');
      var grid = document.getElementById('bf-grid');
      if (!vp || !grid) return;
      var lpTimer = null, ptrs = {}, pinch = null;
      function ptrDist() { var ks = Object.keys(ptrs), a = ptrs[ks[0]], b = ptrs[ks[1]]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
      vp.addEventListener('pointerdown', function (e) {
        ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        var cnt = Object.keys(ptrs).length;
        if (cnt === 2) {
          var ks = Object.keys(ptrs), p0 = ptrs[ks[0]], p1 = ptrs[ks[1]], vr = vp.getBoundingClientRect();
          pinch = { dist: ptrDist(), zoom: zoomLevel, ox: panX, oy: panY,
            mx: (p0.x + p1.x) / 2 - vr.left, my: (p0.y + p1.y) / 2 - vr.top,
            hw: grid.offsetWidth / 2, hh: grid.offsetHeight / 2 };
          drag = null; return;
        }
        if (cnt > 2) return;
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
        if (ptrs[e.pointerId]) ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (pinch && Object.keys(ptrs).length >= 2) {
          var nd = ptrDist();
          if (nd > 0) {
            var z = Math.max(0.6, Math.min(2.5, pinch.zoom * nd / pinch.dist)), k = z / pinch.zoom;
            // 以双指中点为锚点：该点在棋盘内的位置缩放前后保持不动，画面不漂移
            panX = pinch.mx - pinch.hw - k * (pinch.mx - pinch.ox - pinch.hw);
            panY = pinch.my - pinch.hh - k * (pinch.my - pinch.oy - pinch.hh);
            zoomLevel = z; applyPan();
          }
          return;
        }
        if (!drag) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        var dist = Math.abs(dx) + Math.abs(dy);
        drag.moved = dist;
        if (dist > 12 && lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        if (!drag.panning && dist > 6) drag.panning = true;
        if (drag.panning) { panX = drag.ox + dx; panY = drag.oy + dy; applyPan(); }
      });
      function dragUp(e) {
        delete ptrs[e.pointerId];
        if (Object.keys(ptrs).length < 2) pinch = null;
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        if (drag) {
          var wasDrag = drag.panning && drag.moved > 24;
          if (drag.panning && !wasDrag) { panX = drag.ox; panY = drag.oy; applyPan(); }
          drag = null;
          if (wasDrag) suppressClick = true;
        }
        if (Object.keys(ptrs).length === 1) {
          var k = Object.keys(ptrs)[0], p = ptrs[k];
          drag = { x: p.x, y: p.y, ox: panX, oy: panY, panning: false, moved: 0 };
        }
      }
      window.addEventListener('pointerup', dragUp);
      window.addEventListener('pointercancel', dragUp);
    }

    // 飘字：cls 区分 dmg/label-crit/label-dodge/label-counter…，off 为向上偏移（多条不重叠）
    function floatText(x, y, txt, cls, off) {
      // 挂到独立的 bf-floats 图层：render() 只重建 #bf-grid，飘字不会被冲掉；且与网格同步 transform
      var grid = document.getElementById('bf-floats') || document.getElementById('bf-grid');
      if (!grid) return;
      var cs = cellSize(), csX = CSX, csY = CSY;
      var el = document.createElement('div');
      el.className = 'dmg-float ' + (cls || 'dmg') + ' bf-float';
      el.textContent = txt;
      el.style.left = ((x + MARGIN) * csX + csX / 2) + 'px';
      el.style.top = ((y + MARGIN) * csY + csY / 2 - (off || 0)) + 'px';
      grid.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, F(850));
    }
    // 一次攻击的飘字汇总（主伤 + 克制/被克 + 反击），与动画解耦，跳帧(skip)模式也必出
    function floatHit(d, r, counter) {
      if (!r) return;
      if (r.miss) { floatText(d.x, d.y, '闪避', 'label-dodge', 0); return; }
      // 主次反转：兵力损失是主视觉（大而醒目），战力伤害退为次要小标
      var lost = r.lost || 0;
      // 统一写「兵 -N」；折兵为 0 时仅弱化样式，不抢真实折兵的视觉
      var cls = 'label-casualty' + (lost > 0 && r.crit ? ' crit' : '') + (lost > 0 ? '' : ' zero');
      floatText(d.x, d.y, '兵 -' + lost, cls, 12);
      floatText(d.x, d.y, '伤 ' + r.dmg, 'label-dmg-sub', -12);
      if (r.counter > 1) floatText(d.x, d.y, '克制', 'label-counter', -30);
      else if (r.counter < 1) floatText(d.x, d.y, '被克', 'label-countered', -30);
      if (counter) floatText(d.x, d.y, '反击-' + counter.dmg, 'label-counter', -48);
    }
    // 击溃爆裂：在格子处放一圈扩散环（单位随即从棋盘移除，用此补"阵亡"打击感）
    function routBurst(x, y) {
      var grid = document.getElementById('bf-floats') || document.getElementById('bf-grid'); if (!grid) return;
      var cs = cellSize(), csX = CSX, csY = CSY;
      var lx = ((x + MARGIN) * csX + csX / 2) + 'px', ly = ((y + MARGIN) * csY + csY / 2) + 'px';
      var el = document.createElement('div');
      el.className = 'bf-rout-pop';
      el.style.left = lx; el.style.top = ly;
      grid.appendChild(el);
      var puff = document.createElement('div');
      puff.className = 'bf-rout-puff';
      puff.style.left = lx; puff.style.top = ly;
      grid.appendChild(puff);
      routScatter(x, y);
      shakeGrid(3, 0, 1); buzz([30, 40, 60]);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, F(700));
      setTimeout(function () { if (puff.parentNode) puff.parentNode.removeChild(puff); }, F(700));
    }
    // 命中火花/碎屑：受击瞬间在防守方格子四散飞溅的小粒子（暴击更多更亮）
    function hitSpark(x, y, crit) {
      var grid = document.getElementById('bf-floats') || document.getElementById('bf-grid'); if (!grid) return;
      var cs = cellSize(), csX = CSX, csY = CSY;
      var cx = (x + MARGIN) * csX + csX / 2, cy = (y + MARGIN) * csY + csY / 2;
      var n = crit ? 10 : 6;
      for (var i = 0; i < n; i++) {
        var p = document.createElement('div');
        p.className = 'bf-spark' + (crit ? ' crit' : '');
        var ang = (Math.PI * 2 * i / n) + Math.random() * 0.6;
        var d = (crit ? 20 : 13) + Math.random() * 9;
        p.style.left = cx + 'px'; p.style.top = cy + 'px';
        p.style.setProperty('--dx', (Math.cos(ang) * d) + 'px');
        p.style.setProperty('--dy', (Math.sin(ang) * d) + 'px');
        grid.appendChild(p);
        (function (pp) { setTimeout(function () { if (pp.parentNode) pp.parentNode.removeChild(pp); }, F(480)); })(p);
      }
    }
    // 溃散残兵四散：破营/溃散时几名残兵向四周逃散的小碎片
    function routScatter(x, y) {
      var grid = document.getElementById('bf-floats') || document.getElementById('bf-grid'); if (!grid) return;
      var cs = cellSize(), csX = CSX, csY = CSY;
      var cx = (x + MARGIN) * csX + csX / 2, cy = (y + MARGIN) * csY + csY / 2;
      for (var i = 0; i < 7; i++) {
        var p = document.createElement('div');
        p.className = 'bf-scatter';
        var ang = (Math.PI * 2 * i / 7) + Math.random() * 0.5;
        var d = 16 + Math.random() * 14;
        p.style.left = cx + 'px'; p.style.top = cy + 'px';
        p.style.setProperty('--dx', (Math.cos(ang) * d) + 'px');
        p.style.setProperty('--dy', (Math.sin(ang) * d) + 'px');
        grid.appendChild(p);
        (function (pp) { setTimeout(function () { if (pp.parentNode) pp.parentNode.removeChild(pp); }, F(620)); })(p);
      }
    }
    // 战场对话提示条（溃散/破营等）：顶部堆叠，自动淡入淡出
    function bfBanner(text, kind) {
      var host = document.getElementById('bf-banners'); if (!host) return;
      var el = document.createElement('div');
      el.className = 'bf-banner' + (kind ? ' ' + kind : '');
      el.textContent = text;
      host.appendChild(el);
      setTimeout(function () { el.classList.add('show'); }, 20);
      setTimeout(function () { el.classList.remove('show'); }, F(1400));
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, F(1800));
    }
    // 兵种 → 音效：弓弩破空 / 攻城轰鸣 / 其余金铁交击
    function weaponSfx(type) {
      if (type === 'gongcheng' || type === 'chuangnu') return 'siege';
      if (type === 'gongnu' || type === 'gongqi' || type === 'huoshi') return 'arrow';
      return 'attack';
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
    function applyFormation(u, key) { if (u) { u.formation = (key && key !== 'benzhen') ? key : null; try { if (u.troopType) localStorage.setItem('bfFmt_' + u.troopType, u.formation || 'benzhen'); } catch (e) {} } render(); }
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
      var _saved = null; try { _saved = localStorage.getItem('bfFmt_' + u.troopType); } catch (e) {}
      if (_saved && _saved !== (u.formation || 'benzhen') && F[_saved]) h += '<button type="button" class="btn bf-fmt-recall" onclick="window.bfSetFormation(\'' + u.id + '\',\'' + _saved + '\')">沿用上次（' + esc(F[_saved].name) + '）</button>';
      h += '<button type="button" class="btn" onclick="window.bfCloseSheet()">关闭</button></div>';
      showSheet(h);
    }
    function bfCloseModal() { setFullscreenMode(false); closeModal && closeModal(); }

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
        lines += '<div class="bf-pv-r">预计伤 <b>' + e.dmg + '</b> · 折兵约 <b>' + casualtyOf(tgt, e.dmg) + '</b> · 命中 ' + e.hit + '%' +
          (e.counter > 1 ? ' · <span class="bf-pv-adv">克制</span>' : e.counter < 1 ? ' · <span class="bf-pv-dis">被克</span>' : '') +
          (e.adj ? ' · <span class="bf-pv-warn">将遭反击</span>' : '') + '</div>';
      }
      pv.innerHTML = lines; pv.style.display = 'block';
    }

    // 全局桥接（供 onclick 调用）
    if (typeof window !== 'undefined') {
      window.bfClick = bfClick; window.bfPreviewFoe = bfPreviewFoe; window.bfOrder = bfOrder; window.bfEndTurn = bfEndTurn; window.bfRetreat = bfRetreat;
      window.bfToggleThreat = function () { if (!board) return; board.showAllThreat = !board.showAllThreat; render(); };
      window.bfStrike = function (oid) { var t = board && board._strikeTarget; closeMenu(); if (board && board.sel && t) resolveAttack(board.sel, t, oid); };
      window.bfCloseMenu = closeMenu; window.bfCloseModal = bfCloseModal;
      window.bfUndo = bfUndo;
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

// 聚落军事目标（v20261111i · P1-③ 第 4 步）
// 范围：给非城 Place 加「可攻掠」属性，闭环 = 守军迎战 → 平定易帜 → 搜刮辎重。
// 刻意隔离：不写 cityOwner / ruledCities / cityWards（城市归属由 strategy.js 逐鹿独占），
//   聚落归属独立存 state.flags.placeOwner[pid]；攻掠复用 War.startFieldBattle 野战沙盘（不读 LF.CITIES）。
// 范式：IIFE 工厂 LF.createSettlement(ctx) + 引擎挂 LF.Settlement；状态惰性存 flags，默认档不预置。
(function (global) {
  global.LF = global.LF || {};
  var LF = global.LF;

  LF.createSettlement = function (ctx) {
    var S = function () { return ctx.getState(); };
    var DATA = ctx.LF || LF;
    var log = ctx.log, toast = ctx.toast, save = ctx.save;
    var addReputation = ctx.addReputation;
    var packAdd = ctx.packAdd;

    var RAID_KM = 160;      // 主动攻掠半径，与大地图接战 ENGAGE_KM 同口径（约一日程）
    var EXCLUDE = { city: 1, dungeon: 1, field: 1, story: 1 };

    function flags() { var st = S(); if (!st) return null; if (!st.flags) st.flags = {}; return st.flags; }
    function P(pid) { return (DATA.PLACES || {})[pid] || null; }
    function hash(s) {
      var h = 2166136261;
      for (var i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }
    function seeded(seed) {
      var a = seed >>> 0;
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function km(a, b) {
      if (!a || !b) return 99999;
      var R = 6371, dx = (b[0] - a[0]) * Math.PI / 180, dy = (b[1] - a[1]) * Math.PI / 180;
      var h = Math.sin(dy / 2) * Math.sin(dy / 2) +
        Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dx / 2) * Math.sin(dx / 2);
      return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
    }
    function factionName(k) {
      var F = DATA.FACTIONS || {};
      return (F[k] && F[k].name) || (k === 'rogue' ? '地方豪强' : (k === 'player' ? '你的义旗' : String(k || '在野')));
    }

    function isMilitary(pid) {
      var p = P(pid);
      return !!(p && p.raidable && !EXCLUDE[p.kind]);
    }
    function list() { return Object.keys(DATA.PLACES || {}).filter(isMilitary); }
    function ownerOf(pid) {
      var f = flags(), own = f && f.placeOwner && f.placeOwner[pid];
      return own || (P(pid) || {}).owner || 'rogue';
    }
    function garrisonOf(pid) {
      var f = flags(), g = f && f.placeGarrison && f.placeGarrison[pid];
      if (g != null) return g;
      var p = P(pid);
      return p && p.garrison != null ? Math.max(20, Math.round(p.garrison)) : 0;
    }
    function cleared(pid) { var f = flags(); return !!(f && f.placeCleared && f.placeCleared[pid]); }
    function looted(pid) { var f = flags(); return !!(f && f.placeLooted && f.placeLooted[pid]); }

    // 军事视图：给场景动作 / 山河志详情卡共用，youPos 可选（带距离与可攻判定）
    function get(pid, youPos) {
      var p = P(pid);
      if (!p || !isMilitary(pid)) return null;
      var d = (youPos && p.pos) ? km(p.pos, youPos) : null;
      var own = ownerOf(pid), isHostile = own !== 'player';
      var g = garrisonOf(pid), loot = p.loot || [];
      return {
        pid: pid, id: pid, name: p.name || pid, kind: p.kind, state: p.state || '',
        pos: p.pos, desc: p.desc || '', owner: own, ownerName: factionName(own), hostile: isHostile,
        garrison: g, power: g, wall: p.wall || 0, loot: loot.slice(),
        cleared: cleared(pid), looted: looted(pid),
        distKm: d == null ? null : Math.round(d),
        attackable: !!(isHostile && !cleared(pid) && d != null && d <= RAID_KM),
        plunderable: !!(cleared(pid) && !looted(pid) && loot.length)
      };
    }
    function canAttack(pid, youPos) { var v = get(pid, youPos); return !!(v && v.attackable); }

    function poolOf(p) {
      if (p.kind === 'fort' || p.kind === 'pass') return 'siege';
      var st = String(p.state || '');
      if (p.foePool) return p.foePool;
      if (/益州|南中|交州/.test(st)) return 'nanman';
      return 'field';
    }
    // 守军编成：按 placeId 确定性（同地每次一样），复用野战/攻城权重池，3 营按 5:3:2 分兵
    function compose(pid) {
      var p = P(pid); if (!p) return [];
      var g = garrisonOf(pid), rnd = seeded(hash(pid)), pool = poolOf(p);
      var shares = [0.5, 0.3, 0.2], out = [];
      for (var i = 0; i < shares.length; i++) {
        var t = DATA.BF_PICK_FOE ? DATA.BF_PICK_FOE(pool, rnd) : 'changqiang';
        if (!(DATA.TROOPS || {})[t]) t = 'changqiang';
        out.push({ type: t, count: Math.max(8, Math.round(g * shares[i])) });
      }
      return out;
    }

    // 战果回扣：胜 → 易帜 + 平定 + 缴获/声望；负/撤 → 守军减员，仍可再攻
    function resolve(pid, result) {
      var p = P(pid); if (!p || !isMilitary(pid)) return null;
      var f = flags(); if (!f) return null;
      var g = garrisonOf(pid);
      if (result === 'win') {
        var gold = Math.max(10, Math.round(g * 0.25));
        var rep = g >= 200 ? 3 : (g >= 100 ? 2 : 1);
        f.placeOwner = f.placeOwner || {}; f.placeOwner[pid] = 'player';
        f.placeCleared = f.placeCleared || {}; f.placeCleared[pid] = 1;
        f.placeGarrison = f.placeGarrison || {}; f.placeGarrison[pid] = 0;
        try { save(S()); } catch (e) {}
        return { won: true, gold: gold, rep: rep, name: p.name || pid, plunderable: !!(p.loot || []).length };
      }
      var left = Math.max(20, Math.round(g * 0.88));
      f.placeGarrison = f.placeGarrison || {}; f.placeGarrison[pid] = left;
      try { save(S()); } catch (e) {}
      return { won: false, gold: 0, rep: 0, name: p.name || pid, garrison: left };
    }

    // 劫掠：须先平定守军，一次性；loot 支持 'gold:N' 与物品 id（与副本 dungeonLoot 同协议）
    function plunder(pid) {
      var p = P(pid); if (!p || !isMilitary(pid)) return false;
      if (!cleared(pid)) { toast('守军未平，辎重无从下手。'); return false; }
      if (looted(pid)) { toast('辎重已搜刮一空。'); return false; }
      var f = flags(); f.placeLooted = f.placeLooted || {}; f.placeLooted[pid] = 1;
      var got = [], gold = 0;
      (p.loot || []).forEach(function (x) {
        if (typeof x === 'string' && x.indexOf('gold:') === 0) {
          var n = parseInt(x.slice(5), 10) || 0;
          if (n > 0) { gold += n; S().gold = (S().gold || 0) + n; }
        } else if (x) {
          if (packAdd(x, 1)) got.push(((DATA.ITEMS || {})[x] || {}).name || x);
        }
      });
      try { save(S()); } catch (e) {}
      var msg = [];
      if (got.length) msg.push('得 ' + got.join('、'));
      if (gold) msg.push('得银 ' + gold + ' 两');
      log('〔劫掠〕你在「' + (p.name || pid) + '」' + (msg.length ? ('搜得' + msg.join('；')) : '翻检一无所获') + '。', msg.length ? 'good' : 'sys');
      return true;
    }

    return {
      RAID_KM: RAID_KM, isMilitary: isMilitary, list: list, get: get, canAttack: canAttack,
      compose: compose, resolve: resolve, plunder: plunder,
      ownerOf: ownerOf, garrisonOf: garrisonOf, cleared: cleared, looted: looted, factionName: factionName
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

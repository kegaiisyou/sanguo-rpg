// 大地图行军部队实体（v20261111g · P1-③ 第 1 步）
// 范围：只做「实体」——按势力生成行军中的部队、每日推进位置、在山河志上可见可点。
//   刻意不做：接战触发、胜负结算、城池归属变更（后者已由 strategy.js 逐鹿系统负责，避免双重结算）。
//   下期在 near() / engage() 上接「主动接战 → 战棋野战」即可，无需改本模块数据模型。
// 范式：IIFE 工厂 LF.createFieldArmy(ctx) + 引擎别名块；状态惰性存 state.flags.fieldArmies。
(function () {
  window.LF = window.LF || {};
  var LF = window.LF;

  LF.createFieldArmy = function (ctx) {
    var S = function () { return ctx.getState(); };
    var DATA = ctx.LF;
    var log = ctx.log;
    var MAX_FORCES = 12;          // 全局同时存在的部队上限，避免刷屏
    var ADJ_KM = 420;             // 与 strategy.js WAR_ADJ_KM 一致：互为攻伐的邻接半径
    var ENGAGE_KM = 160;          // 主动迎战半径：玩家所在点方圆 160 公里内方可截击（约一日程）
    var adjCache = null;

    function flags() {
      var st = S();
      if (!st) return null;
      if (!st.flags) st.flags = {};
      if (!st.flags.fieldArmies) st.flags.fieldArmies = [];
      if (st.flags.faSeq == null) st.flags.faSeq = 0;
      return st.flags;
    }
    function list() { var f = flags(); return f ? f.fieldArmies : []; }
    function get(id) {
      var a = list();
      for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
      return null;
    }
    function remove(id) {
      var f = flags(); if (!f) return;
      f.fieldArmies = f.fieldArmies.filter(function (a) { return a.id !== id; });
    }

    function km(a, b) {
      if (!a || !b) return 99999;
      var R = 6371, dx = (b[0] - a[0]) * Math.PI / 180, dy = (b[1] - a[1]) * Math.PI / 180;
      var h = Math.sin(dy / 2) * Math.sin(dy / 2) +
        Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dx / 2) * Math.sin(dx / 2);
      return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
    }
    function adjOf(cid) {
      if (!adjCache) {
        adjCache = {};
        var C = DATA.CITIES || {}, ids = Object.keys(C);
        for (var i = 0; i < ids.length; i++) {
          if (!C[ids[i]].pos) continue;
          adjCache[ids[i]] = [];
          for (var j = 0; j < ids.length; j++) {
            if (i === j || !C[ids[j]].pos) continue;
            if (km(C[ids[i]].pos, C[ids[j]].pos) <= ADJ_KM) adjCache[ids[i]].push(ids[j]);
          }
        }
      }
      return adjCache[cid] || [];
    }
    // 归属必须过 LF.ownerKeyOf（唯一归一化入口）：cities.js 里 49 城是旧键 wei/wu/shu/contested，
    //   直接用 cityOwnerOf 原始值会对不上 LF.FACTIONS，也会与山河志/势力图配色口径不一致。
    function ownerOf(cid) {
      try {
        var k = DATA.ownerKeyOf ? DATA.ownerKeyOf(cid, ctx.getOwner() || null) : null;
        if (k) return (k === '义军') ? 'player' : k;
      } catch (e) {}
      var raw = (DATA.CITIES[cid] || {}).owner || 'han';
      return (DATA.OWNER_ALIAS || {})[raw] || raw;
    }
    function cityName(cid) { return ((DATA.CITIES || {})[cid] || {}).name || cid; }
    function factionName(fid) {
      var f = (DATA.FACTIONS || {})[fid];
      return f ? (f.name || fid) : (fid === 'player' ? '义军' : '地方群豪');
    }
    function factionColor(fid) {
      var f = (DATA.FACTIONS || {})[fid];
      return (f && f.color) || '#8a2f2f';
    }
    function troopName(t) { return ((DATA.TROOPS || {})[t] || {}).name || t; }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // 外交：与玩家结盟/休战的势力不作为「敌对」标记（不改逐鹿关系矩阵，只影响展示与下期接战准入）
    function hostileToPlayer(fid) {
      if (fid === 'player') return false;
      try {
        var st = S(), d = st && st.flags && st.flags.diplo;
        var rec = d && d[fid];
        if (rec && (rec.status === 'alliance' || rec.status === 'truce')) return false;
      } catch (e) {}
      return true;
    }
    function factionTroops(fid) {
      try {
        var f = S().flags.factionAssets || {};
        var t = (f[fid] || {}).troops || 0;
        if (t > 0) return t;
      } catch (e) {}
      // 兜底：factionAssets 由朔日结算才创建，新档开局为 0；
      //   改按治下城池驻军估算，保证开局第一天就有部队可遭遇（月结后自动切回真实兵力）。
      var cs = citiesOf(fid), sum = 0, C = DATA.CITIES || {};
      for (var i = 0; i < cs.length; i++) sum += ((C[cs[i]] || {}).garrison || 40) * 6;
      return sum;
    }
    function citiesOf(fid) {
      var out = [], C = DATA.CITIES || {}, ids = Object.keys(C);
      for (var i = 0; i < ids.length; i++) if (ownerOf(ids[i]) === fid) out.push(ids[i]);
      return out;
    }

    // 兵力构成：复用战棋 data 的野战权重池（含 4 扩展兵种），3~5 营按份额分配
    function compose(power) {
      var n = 3 + Math.floor(Math.random() * 3), out = [], left = power, i;
      for (i = 0; i < n; i++) {
        var t = DATA.BF_PICK_FOE ? DATA.BF_PICK_FOE('field') : 'changqiang';
        var c = (i === n - 1) ? left : Math.max(40, Math.round(left / (n - i) * (0.75 + Math.random() * 0.5)));
        c = Math.min(left, c);
        if (c <= 0) break;
        out.push({ type: t, count: c });
        left -= c;
      }
      return out;
    }
    function recalcPos(a) {
      var C = DATA.CITIES || {}, f = (C[a.from] || {}).pos, t = (C[a.to] || {}).pos;
      if (!f || !t) { a.pos = null; return; }
      var p = Math.max(0, Math.min(1, a.prog));
      // 同路多支部队用 id 哈希做垂直微偏移，避免与城点/彼此完全重叠
      var off = ((parseInt(a.id.replace(/\D/g, ''), 10) || 1) % 7 - 3) * 0.09;
      var dx = t[0] - f[0], dy = t[1] - f[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
      a.pos = [f[0] + dx * p + (-dy / len) * off, f[1] + dy * p + (dx / len) * off];
    }

    // 生成一支部队：有城、有兵的 NPC 势力 → 选一座己方城 → 邻接的敌方城（优先玩家城）
    function spawn(force) {
      var f = flags(); if (!f) return null;
      if (!force && list().length >= MAX_FORCES) return null;
      var C = DATA.CITIES || {}, ids = Object.keys(C), fids = Object.keys(DATA.FACTIONS || {});
      var cand = [];
      for (var i = 0; i < fids.length; i++) {
        var fid = fids[i];
        if (fid === 'player' || fid === 'han') continue;
        var cs = citiesOf(fid);
        if (cs.length) cand.push({ fid: fid, cities: cs });
      }
      if (!cand.length) return null;
      var src = pick(cand), from = pick(src.cities);
      var adj = adjOf(from), enemy = [], neutral = [];
      for (var j = 0; j < adj.length; j++) {
        var o = ownerOf(adj[j]);
        if (o === src.fid) continue;
        (o === 'player' ? enemy : neutral).push(adj[j]);
      }
      var to = enemy.length ? pick(enemy) : (neutral.length ? pick(neutral) : null);
      if (!to) return null;

      var ownTroops = factionTroops(src.fid);
      var power = Math.max(240, Math.min(2600, Math.round((ownTroops || 800) * (0.10 + Math.random() * 0.16))));
      f.faSeq += 1;
      var missions = [
        { k: 'raid', n: '掠境' },
        { k: 'march', n: '调防' },
        { k: 'siege', n: '进逼' }
      ];
      var m = pick(missions);
      // 寿命按行军速度算：每日 prog 增量 = speed/2，走完单程约需 2/speed 日；
      //   抵达掉头时再重置一次回程寿命，否则部队会在半途凭空消失。
      var spd = 0.10 + Math.random() * 0.10;
      var a = {
        id: 'fa' + f.faSeq,
        fid: src.fid,
        name: factionName(src.fid) + '·' + m.n + '军',
        from: from, to: to,
        fromName: cityName(from), toName: cityName(to),
        prog: 0,
        speed: spd,                              // 每日 prog 增量 = speed/2，约 10~20 日抵达
        pos: null,
        power: power,
        troops: compose(power),
        morale: 68 + Math.floor(Math.random() * 24),
        grain: 16 + Math.floor(Math.random() * 16),   // 够走完单程；回程若断粮则掉士气直至溃散
        mission: m.k, missionLabel: m.n,
        hostile: hostileToPlayer(src.fid),
        born: (S() && S().day) || 0,
        ttl: Math.ceil(2 / (spd / 2)) + 3,
        status: 'marching'
      };
      recalcPos(a);
      f.fieldArmies.push(a);
      return a;
    }

    // 每日推进：位置/军粮/士气；抵达后掉头回防，寿命耗尽或溃散则移除。
    //   注意：抵达不触发攻城结算——城池归属由 strategy.js 逐鹿系统独占，本层只做「看得见的兵」。
    function tickDay(crossings) {
      var f = flags(); if (!f) return;
      var n = Math.max(1, Math.min(3, crossings || 1));
      for (var d = 0; d < n; d++) {
        var a = f.fieldArmies;
        for (var i = a.length - 1; i >= 0; i--) {
          var u = a[i];
          u.prog += u.speed / 2;                 // 半速：给玩家更多拦截窗口
          u.grain -= 1;
          if (u.grain <= 0) { u.grain = 0; u.morale -= 4; }
          u.ttl -= 1;
          if (u.prog >= 1) {
            // 回防抵达出发城：一个来回走完即解散，给新部队腾位（也避免 ttl 重置造成永生）
            if (u.status === 'returning') { a.splice(i, 1); continue; }
            // 抵达：换旗回防，不落城、不改归属
            var tmp = u.from; u.from = u.to; u.to = tmp;
            tmp = u.fromName; u.fromName = u.toName; u.toName = tmp;
            u.prog = 0;
            u.status = 'returning';
            u.mission = 'march'; u.missionLabel = '回防';
            u.name = factionName(u.fid) + '·回防军';
            u.ttl = Math.ceil(2 / (u.speed / 2)) + 2;   // 重置回程寿命
          }
          recalcPos(u);
          if (u.ttl <= 0 || u.morale < 20) a.splice(i, 1);
        }
        // 每日按势产生新部队；有城有兵的势力越多，天下越热闹
        if (a.length < MAX_FORCES && Math.random() < 0.42) {
          var nu = spawn(false);
          if (nu && nu.hostile && ownerOf(nu.to) === 'player' && log) {
            try { log('【斥候】' + nu.name + '（约 ' + nu.power + ' 人）自' + nu.fromName + '向' + nu.toName + '开拔。', 'warn'); } catch (e) {}
          }
        }
      }
    }

    // 战略图 marks：与既有 you/goal/hold 同构，交 strategicMap.js 的 strategicMapMarks() 合并
    //   youPos 可选（玩家所在经纬度）：带上距离、是否可迎战、是否迫近，供详情卡判断按钮与提示。
    function marks(youPos) {
      return list().filter(function (a) { return a.pos; }).map(function (a) {
        var d = youPos ? km(a.pos, youPos) : null;
        return {
          type: 'army', id: a.id, pos: a.pos,
          fid: a.fid, faction: factionName(a.fid), color: factionColor(a.fid),
          label: a.name + ' ' + a.power,
          name: a.name, power: a.power, troops: a.troops,
          fromName: a.fromName, toName: a.toName,
          prog: a.prog, morale: a.morale, grain: a.grain,
          missionLabel: a.missionLabel, status: a.status, hostile: a.hostile,
          distKm: d == null ? null : Math.round(d),
          engagable: !!(d != null && d <= ENGAGE_KM && a.hostile),
          threat: !!(d != null && d <= ENGAGE_KM * 1.6 && a.hostile)
        };
      });
    }

    // 下期接战用：取距某点 radiusKm 内的部队
    function near(pos, radiusKm) {
      if (!pos) return [];
      var r = radiusKm || ENGAGE_KM;
      return list().filter(function (a) { return a.pos && km(a.pos, pos) <= r; });
    }

    // 主动迎战准入：部队仍在、敌对、且在遭遇半径内
    function canEngage(id, youPos) {
      var a = get(id);
      if (!a || !a.hostile || !a.pos || !youPos) return false;
      return km(a.pos, youPos) <= ENGAGE_KM;
    }

    // 战果回扣（v20261111h）：胜 → 部队溃散移除 + 缴获/声望；负/撤 → 敌军减员掉士气、继续行军。
    //   只动本层实体，不改城池归属（仍由 strategy.js 逐鹿独占）。
    function resolve(id, result) {
      var a = get(id);
      if (!a) return null;
      if (result === 'win') {
        var gold = Math.max(8, Math.round(a.power * 0.32));
        var rep = a.power >= 800 ? 3 : (a.power >= 400 ? 2 : 1);
        remove(id);
        return { dispersed: true, gold: gold, rep: rep, name: a.name, power: a.power };
      }
      a.power = Math.max(60, Math.round(a.power * 0.88));
      a.troops.forEach(function (t) { t.count = Math.max(1, Math.round(t.count * 0.88)); });
      a.morale = Math.max(20, a.morale - 10);
      a.ttl -= 2;
      return { dispersed: false, gold: 0, rep: 0, name: a.name, power: a.power };
    }

    return {
      list: list, get: get, remove: remove, spawn: spawn, tickDay: tickDay,
      marks: marks, near: near, canEngage: canEngage, resolve: resolve, compose: compose,
      MAX_FORCES: MAX_FORCES, ENGAGE_KM: ENGAGE_KM
    };
  };
})();

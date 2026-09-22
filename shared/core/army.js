// 军队核心（v20260921a）：募兵 / 编制阵位 / 辎重军粮 / 士气 / 独立调兵 / 营级单位聚合 / 战后回扣 / 军队视图
// 范式：LF.createArmy(ctx) 工厂 + 引擎顶部别名块；state 一律 getState 惰性取值（读档/新局会重赋值）。
// ⚠ 面板里的 HTML 片段必须单行或用 \n 转义（JS 单引号字符串不可跨真实换行）。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createArmy = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getCurrentModalKind = ctx.getCurrentModalKind;
    var LF = ctx.LF, G = ctx.G;
    var log = ctx.log, toast = ctx.toast, save = ctx.save, renderStatus = ctx.renderStatus, renderRoom = ctx.renderRoom;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;
    var itemIconHTML = ctx.itemIconHTML, escapeHtml = ctx.escapeHtml;
    var packAdd = ctx.packAdd, packConsume = ctx.packConsume, packFind = ctx.packFind, packList = ctx.packList;
    var afterPackChange = ctx.afterPackChange;
    var cityDevOf = ctx.cityDevOf, isCityGrid = ctx.isCityGrid;
    var roleAtkMul = ctx.roleAtkMul, roleDef = ctx.roleDef;
    var exert = ctx.exert, advanceTime = ctx.advanceTime;
    var commandBonus = ctx.commandBonus || function () { return 1; };

    // ══ 数据基座 ══
    function TROOPS() { return (LF.TROOPS) || {}; }
    function ensureArmy() {
      var st = S(); if (!st) return null;
      var a = st.army;
      if (!a || typeof a !== 'object') a = st.army = {};
      if (typeof a.active !== 'boolean') a.active = false;
      if (!Array.isArray(a.troops)) a.troops = [];
      if (!a.logistics || typeof a.logistics !== 'object') a.logistics = { items: [], cap: 8, grain: 0 };
      if (!Array.isArray(a.logistics.items)) a.logistics.items = [];
      if (typeof a.logistics.grain !== 'number') a.logistics.grain = 0;
      if (typeof a.morale !== 'number') a.morale = 100;
      if (!a.rallyPoint) a.rallyPoint = null;      // 军队所在城 cid（null = 随主角）
      if (!a.recruited) a.recruited = {};          // cid → 已募人数（兵源上限）
      if (!a.marching) a.marching = null;          // {from,to,left,km}
      return a;
    }
    function troopOf(type) {
      var t = ensureArmy() ? S().army.troops : [];
      for (var i = 0; i < t.length; i++) if (t[i] && t[i].type === type) return t[i];
      return null;
    }
    function armyCount() {
      var a = ensureArmy(); if (!a) return 0;
      var n = 0; a.troops.forEach(function (t) { if (t) n += (t.count || 0); });
      return n;
    }
    function armyCap() { return LF.armyCapOf(S() ? S().title : '游侠'); }
    function armyUpkeep() {   // 每日军粮消耗（人·日）
      var a = ensureArmy(); if (!a) return 0;
      var n = 0, T = TROOPS();
      a.troops.forEach(function (t) { var d = T[t.type]; n += (t.count || 0) * ((d && d.upkeep) || 1); });
      return n;
    }
    function moraleMul() { return LF.moraleBand(ensureArmy() ? ensureArmy().morale : 100).atkMul; }
    function armyPower() {
      var a = ensureArmy(); if (!a) return 0;
      var T = TROOPS(), p = 0;
      a.troops.forEach(function (t) {
        var d = T[t.type]; if (!d) return;
        p += ((d.atk || 0) * 1.0 + (d.def || 0) * 0.7 + (d.hp || 0) * 0.05) * (t.count || 0);
      });
      return Math.round(p * moraleMul() * commandBonus());
    }
    function logisticsCap() {
      var a = ensureArmy(); if (!a) return 8;
      var c = 8;
      a.troops.forEach(function (t) {
        var d = TROOPS()[t.type]; if (!d || !d.logisticsBonus) return;
        c += (t.count || 0) * (t.type === 'qizhong' ? 0.5 : 0.3);
      });
      return Math.max(8, Math.round(c));
    }
    function armyActive() { var a = ensureArmy(); return !!(a && a.active && armyCount() > 0); }
    function armyHereCid() {   // 军队当前所在城（随主角时 = 主角所在城）
      var a = ensureArmy(); if (!a) return null;
      if (a.marching) return null;
      if (a.rallyPoint) return a.rallyPoint;
      var st = S();
      if (st.flags && st.flags.cityPos && st.flags.cityPos.cid && isCityGrid && st.room === st.flags.cityPos.cid) return st.flags.cityPos.cid;
      return isCityGrid && st && isCityGrid(st.room) ? st.room : null;
    }
    function armyWithPlayer() {
      var a = ensureArmy(); if (!a || a.marching) return false;
      if (!a.rallyPoint) return true;
      var st = S();
      return (st.room === a.rallyPoint) || (st.flags && st.flags.cityPos && st.flags.cityPos.cid === a.rallyPoint);
    }

    // ══ 募兵 / 解散 / 整编 ══
    function recruitCity() {   // 玩家当前所在城（用于军营募兵）
      var st = S(); if (!st) return null;
      if (isCityGrid && isCityGrid(st.room)) return st.room;
      if (st.flags && st.flags.cityPos && st.flags.cityPos.cid) return st.flags.cityPos.cid;
      return null;
    }
    function cityManpool(cid) {
      var c = (LF.CITIES || {})[cid] || {};
      return Math.max(5, Math.round((c.pop || 40) * 2));
    }
    function recruitLeft(cid) {
      var a = ensureArmy(); if (!a) return 0;
      return Math.max(0, cityManpool(cid) - (a.recruited[cid] || 0));
    }
    function recruitCost(type, n) {
      var d = TROOPS()[type]; if (!d) return 0;
      return Math.round((2 + (d.cost || 1) * 2) * n);
    }
    function armyRecruit(cid, type, n) {
      n = Math.max(1, (n | 0) || 1);
      var d = TROOPS()[type];
      if (!d) { toast('无此兵科。'); return false; }
      var a = ensureArmy(); if (!a) return false;
      var cap = armyCap(), cur = armyCount();
      if (cur >= cap) { toast('兵力已至上限（' + cur + '/' + cap + '）——须先得更高官职。'); return false; }
      if (cur + n > cap) n = cap - cur;
      if (n <= 0) { toast('兵力已至上限（' + cur + '/' + cap + '），须先得更高官职。'); return false; }
      var left = recruitLeft(cid);
      if (left <= 0) { toast('此城兵源已尽，征无可征。'); return false; }
      if (n > left) { n = left; toast('此城可征之兵仅余 ' + left + ' 人。'); }
      var cost = recruitCost(type, n), gold = S().gold || 0;
      if (gold < cost) { toast('府库不足，募 ' + n + ' 名' + d.name + '需银 ' + cost + ' 两。'); return false; }
      S().gold = gold - cost;
      a.recruited[cid] = (a.recruited[cid] || 0) + n;
      var t = troopOf(type);
      if (t) t.count = (t.count || 0) + n;
      else a.troops.push({ type: type, count: n, rank: rankDefault(type), xp: 0 });
      if (!a.active) { a.active = true; a.rallyPoint = cid; }
      a.morale = Math.max(0, Math.min(100, (a.morale || 100) - 1));
      log('〔募兵〕于' + (((LF.CITIES || {})[cid] || {}).name || '城中') + '募得' + d.name + ' ' + n + ' 名，耗银 ' + cost + ' 两。', 'sys');
      if (!a.rallyPoint) a.rallyPoint = cid;
      save(S()); renderStatus();
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function armyDisband(type, n) {
      var t = troopOf(type); if (!t) return false;
      n = Math.max(1, (n | 0) || 1);
      if (n > t.count) n = t.count;
      t.count -= n;
      var a = ensureArmy();
      a.troops = a.troops.filter(function (x) { return x && (x.count || 0) > 0; });
      a.morale = Math.max(0, Math.min(100, (a.morale || 100) + 1));
      log('〔遣散〕' + (TROOPS()[type] || {}).name + ' ' + n + ' 名解甲归田，军心稍安。', 'sys');
      if (!armyCount()) { a.active = false; a.rallyPoint = null; }
      save(S()); renderStatus();
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function rankDefault(type) {
      var d = TROOPS()[type]; if (!d) return 'front';
      var r = LF.TROOP_RANKS[d.slot];
      return r ? r.def : 'front';
    }
    function rankAllow(type) {
      var d = TROOPS()[type]; if (!d) return ['front'];
      var r = LF.TROOP_RANKS[d.slot];
      return r ? r.allow : ['front'];
    }
    function armySetRank(type, rank) {
      var t = troopOf(type); if (!t) return false;
      if (rankAllow(type).indexOf(rank) < 0) { toast((TROOPS()[type] || {}).name + '不宜列于此阵。'); return false; }
      t.rank = rank;
      log('〔整编〕' + (TROOPS()[type] || {}).name + '改列' + (LF.ARMY_RANKS[rank] || {}).name + '。', 'sys');
      save(S());
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }

    // ══ 辎重 / 军粮 ══
    function logiItems() { var a = ensureArmy(); return a ? a.logistics.items : []; }
    function logiUsed() { var n = 0; logiItems().forEach(function (it) { if (it) n++; }); return n; }
    function armyDeposit(defId, n) {
      n = Math.max(1, (n | 0) || 1);
      var a = ensureArmy(); if (!a) return false;
      if (logiUsed() >= logisticsCap() && !logiItems().some(function (it) { return it && it.defId === defId; })) { toast('辎重已满载。'); return false; }
      if (!packConsume(defId, n)) { toast('囊中无此物。'); return false; }
      var slot = null;
      for (var i = 0; i < a.logistics.items.length; i++) { var it = a.logistics.items[i]; if (it && it.defId === defId) { slot = it; break; } }
      if (slot) slot.count = (slot.count || 0) + n;
      else a.logistics.items.push({ defId: defId, count: n });
      afterPackChange && afterPackChange();
      save(S());
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function armyWithdraw(defId, n) {
      n = Math.max(1, (n | 0) || 1);
      var a = ensureArmy(); if (!a) return false;
      for (var i = 0; i < a.logistics.items.length; i++) {
        var it = a.logistics.items[i];
        if (it && it.defId === defId) {
          if (n > it.count) n = it.count;
          it.count -= n;
          if (it.count <= 0) a.logistics.items[i] = null;
          a.logistics.items = a.logistics.items.filter(function (x) { return !!x; });
          packAdd(defId, n);
          afterPackChange && afterPackChange();
          save(S());
          if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
          return true;
        }
      }
      toast('辎重中无此物。'); return false;
    }
    function armyBuyGrain(n) {
      n = Math.max(1, (n | 0) || 1);
      var a = ensureArmy(); if (!a) return false;
      var cost = Math.ceil(n / 12);
      if ((S().gold || 0) < cost) { toast('银两不足，籴 ' + n + ' 石军粮需 ' + cost + ' 两。'); return false; }
      S().gold -= cost;
      a.logistics.grain = (a.logistics.grain || 0) + n;
      log('〔籴粮〕以 ' + cost + ' 两籴得军粮 ' + n + ' 石，辎重可支 ' + grainDays().toFixed(1) + ' 日。', 'sys');
      save(S()); renderStatus();
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function grainDays() {
      var up = armyUpkeep();
      if (!up) return 0;
      return ((ensureArmy() ? ensureArmy().logistics.grain : 0) || 0) / up;
    }

    // ══ 军粮与士气（每日） ══
    function armyMoraleAdd(v, why) {
      var a = ensureArmy(); if (!a) return;
      var before = a.morale || 100;
      a.morale = Math.max(0, Math.min(100, before + v));
      if (Math.abs(a.morale - before) >= 5) {
        var b = LF.moraleBand(a.morale);
        log('〔军心〕' + (why || '') + '士气' + (v > 0 ? '+' : '') + v + '，今为「' + b.name + '」。', v > 0 ? 'good' : 'sys');
      }
    }
    function tickArmyDay(crossings) {
      var a = ensureArmy();
      if (!a || !armyCount()) return;
      crossings = Math.max(1, crossings || 1);
      // 行军进度
      if (a.marching) {
        a.marching.left -= crossings;
        if (a.marching.left <= 0) {
          var to = a.marching.to;
          a.rallyPoint = to; a.marching = null;
          log('〔行军〕你的部曲抵达' + (((LF.CITIES || {})[to] || {}).name || '目的地') + '，扎营待命。', 'sys');
        } else if (Math.random() < (scouting() ? 0.10 : 0.22)) {
          // 行军途中遭遇：部曲自行应战（玩家不在队中），按比例折兵
          var nl = Math.max(1, Math.round(armyCount() * (0.02 + Math.random() * 0.05)));
          var _rem = nl;
          a.troops.forEach(function (t) { if (_rem <= 0) return; var dd = Math.min(t.count || 0, _rem); t.count = (t.count || 0) - dd; _rem -= dd; });
          a.troops = a.troops.filter(function (t) { return (t.count || 0) > 0; });
          armyMoraleAdd(-6, '途中遇袭，');
          log('〔遭遇〕你的部曲行至半途撞上' + (Math.random() < 0.5 ? '一伙剪径的流寇' : '别部游骑') + '，一场混战折了 ' + nl + ' 人。', 'danger');
        }
      }
      var need = armyUpkeep() * crossings * (a.marching ? 1.5 : 1);
      var have = a.logistics.grain || 0;
      if (have >= need) {
        a.logistics.grain = Math.round((have - need) * 10) / 10;
      } else {
        var short = need - have;
        a.logistics.grain = 0;
        armyMoraleAdd(-Math.min(20, Math.round(6 * Math.max(1, short / Math.max(1, need)) * crossings)), '军粮不继，');
        log('〔断粮〕军粮告罄（缺 ' + Math.round(short) + ' 石），士卒怨声载道。', 'danger');
      }
      save(S());
    }

    // ══ 独立调兵 / 行军 ══
    function cityKm(a, b) {
      var A = (LF.CITIES || {})[a], B = (LF.CITIES || {})[b];
      if (!A || !B || A.lng == null || B.lng == null) return 120;
      var dx = (A.lng - B.lng) * 85, dy = (A.lat - B.lat) * 111;
      return Math.max(30, Math.round(Math.sqrt(dx * dx + dy * dy)));
    }
    function armyDeploy(cid) {
      var a = ensureArmy(); if (!a || !armyCount()) { toast('你尚无部曲可调。'); return false; }
      if (!(LF.CITIES || {})[cid]) { toast('此地不在版图之内。'); return false; }
      var from = a.rallyPoint || armyHereCid() || S().room;
      if (from === cid) { toast('部曲已在此地。'); return false; }
      if (a.marching) { toast('部曲正在路上（尚余 ' + a.marching.left + ' 日）。'); return false; }
      var km = cityKm(from, cid);
      var days = Math.max(1, Math.ceil(km / 55));
      var need = Math.round(armyUpkeep() * days * 1.5);
      if ((a.logistics.grain || 0) < need) { toast('军粮不足：此行需 ' + need + ' 石，辎重仅有 ' + Math.round(a.logistics.grain || 0) + ' 石。'); return false; }
      a.logistics.grain -= need;
      a.marching = { from: from, to: cid, left: days, km: km };
      log('〔调兵〕你令部曲自' + (((LF.CITIES || {})[from] || {}).name || '旧营') + '开拔，趋' + (((LF.CITIES || {})[cid] || {}).name || '新城') + '——约 ' + km + ' 里，' + days + ' 日可至（预支军粮 ' + need + ' 石）。', 'sys');
      save(S());
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function armyCamp() {   // 宿营整军：耗 1 日，回士气
      var a = ensureArmy(); if (!a || !armyCount()) { toast('无人可整。'); return false; }
      if (!exert('整军')) return false;
      var need = Math.max(1, armyUpkeep());
      if ((a.logistics.grain || 0) < need) { toast('军粮不足，安营亦需支粮 ' + need + ' 石。'); return false; }
      a.logistics.grain -= need;
      advanceTime(12);
      armyMoraleAdd(8, '安营整军，士卒得歇，');
      log('〔宿营〕你令三军扎营休整一日，炊烟四起，士气稍复。', 'sys');
      save(S()); renderStatus();
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function armyScout() {   // 派出斥候：需骑兵，三日探路 → 伏兵概率减半
      var a = ensureArmy(); if (!a || !armyCount()) { toast('无人可遣。'); return false; }
      var q = troopOf('qibing');
      if (!q || (q.count || 0) < 3) { toast('须有骑兵三人以上，方可派出斥候。'); return false; }
      S().flags.armyScoutUntil = (S().day || 0) + 3;
      log('〔斥候〕游骑四出哨探，三里一骑——三日内行军知敌，伏兵之险大减。', 'sys');
      save(S());
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function armyAmbush() {  // 就地设伏：郊野设伏，敌至则先手
      var a = ensureArmy(); if (!a || !armyCount()) { toast('无人可伏。'); return false; }
      var st = S();
      if (!G.ROOMS[st.room] || !G.ROOMS[st.room].isField) { toast('设伏须在郊野山泽之间。'); return false; }
      S().flags.armyAmbush = { room: st.room, day: st.day || 0 };
      log('〔设伏〕你令部曲散入林木沟壑，屏息以待——此间过路的兵马，要吃一记闷棍。', 'sys');
      save(S());
      if (getCurrentModalKind && getCurrentModalKind() === 'army') openModal('army');
      return true;
    }
    function scouting() { return ((S().flags.armyScoutUntil || 0) > (S().day || 0)); }

    // ══ 营级单位聚合（对齐 CombatEngine 的 _buildPlayerUnit 契约）══
    // 每个兵种聚合为一营：hp/atk/def = 单兵值 × 兵力；spd 取兵科值（不随兵力放大，避免先手碾压）。
    // 军令以「伪武学」注入 _artMap，由引擎 _buildPlayerUnit 原样保留（不查 MARTIAL_ARTS）。
    function buildOrdersFor(unit, rank, count) {
      var map = {}, ids = [];
      var O = LF.ARMY_ORDERS || {};
      Object.keys(O).forEach(function (oid) {
        var o = O[oid];
        if (o.rank && o.rank !== rank) return;
        var art;
        if (o.defend) {
          art = { id: 'defend', name: o.name, desc: o.desc };
        } else if (o.selfBuffAtk) {
          art = {
            id: oid, name: o.name, desc: o.desc, dmgMul: 0, beat: o.beat || 10,
            eff: { selfBuff: { atk: Math.max(1, Math.round(unit.atk * o.selfBuffAtk)), turns: o.selfBuffTurns || 2 } },
            noTarget: true
          };
        } else {
          var mul = o.dmgMul || 0;
          if (oid === 'qishe' && unit.troopType !== 'gongnu') mul *= 0.6;   // 非弓弩齐射威力减半
          if (oid === 'baochao' && unit.troopType !== 'qibing') mul *= 0.75;
          art = {
            id: oid, name: o.name, desc: o.desc, dmgMul: mul, beat: o.beat || 10,
            multiHit: o.multiHit || 1, guaranteed: !!o.guaranteed, eff: o.eff || {}, noTarget: false
          };
        }
        map[oid] = art; ids.push(oid);
      });
      if (!ids.length) { map['jianshou'] = { id: 'defend', name: '坚守', desc: '按兵不动。' }; ids.push('jianshou'); }
      return { map: map, ids: ids };
    }
    function buildArmyPlayerUnits(opt) {
      opt = opt || {};
      var a = ensureArmy();
      if (!a || !armyCount()) return [];
      var T = TROOPS(), out = [], mm = moraleMul();
      var filter = opt.types || null;
      a.troops.forEach(function (t, i) {
        var d = T[t.type]; if (!d) return;
        var n = t.count || 0;
        if (!n) return;
        if (d.atk <= 0 && opt.combatOnly) return;            // 民夫不上阵（除非强攻）
        if (filter && filter.indexOf(t.type) < 0) return;
        var rank = t.rank || rankDefault(t.type);
        var maxHp = Math.max(1, Math.round((d.hp || 10) * n));
        var atk = Math.max(1, Math.round((d.atk || 1) * n * mm * (opt.atkMul || 1) * commandBonus()));
        var def = Math.max(0, Math.round((d.def || 1) * n));
        var u = {
          name: d.name + '营',
          hp: maxHp, maxHp: maxHp,
          mp: 0, maxMp: 0,
          atk: atk, def: def, spd: (d.spd || 10),
          element: '无', hitRate: 0.95, critRate: 0,
          equippedForce: [], learnedMartial: [],
          isTroop: true, troopType: t.type, rank: rank,
          guard: rank === 'front',
          morale: Math.round(a.morale || 100),
          count: n
        };
        var od = buildOrdersFor(u, rank, n);
        u._artMap = od.map; u.artIds = od.ids;
        out.push(u);
      });
      out.sort(function (x, y) {
        return LF.ARMY_RANK_ORDER.indexOf(x.rank) - LF.ARMY_RANK_ORDER.indexOf(y.rank);
      });
      return out;
    }
    // 战后回扣：按各营剩余气血比例折算存活兵力
    function settleArmyLoss(units) {
      var a = ensureArmy(); if (!a) return { lost: 0, routed: [] };
      var lost = 0, routed = [], avgMorale = [], alive = 0;
      (units || []).forEach(function (u) {
        if (!u || !u.isTroop) return;
        var t = troopOf(u.troopType); if (!t) return;
        var ratio = u.maxHp > 0 ? Math.max(0, u.hp / u.maxHp) : 0;
        if (u.routed) { ratio = Math.min(ratio, 0.45); routed.push(u.name); }
        var survivors = Math.floor((u.count || 0) * ratio * (u.routed ? 0.8 : 1));
        var dead = (u.count || 0) - survivors;
        if (dead > 0) { t.count = Math.max(0, (t.count || 0) - dead); lost += dead; }
        avgMorale.push(u.morale || 50);
        alive += survivors;
      });
      a.troops = a.troops.filter(function (x) { return x && (x.count || 0) > 0; });
      if (avgMorale.length) {
        var m = 0; avgMorale.forEach(function (x) { m += x; });
        a.morale = Math.max(0, Math.min(100, Math.round(m / avgMorale.length)));
      }
      if (!armyCount()) { a.active = false; a.rallyPoint = null; }
      return { lost: lost, routed: routed, alive: alive };
    }

    // ══ 军队视图 ══
    function moraleBar(m) {
      var b = LF.moraleBand(m);
      var pct = Math.max(0, Math.min(100, m || 0));
      return '<div class="am-mbar"><i style="width:' + pct + '%;background:' + b.color + '"></i></div>';
    }
    function esc(s) { return escapeHtml ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }
    function renderArmyPanel() {
      var a = ensureArmy();
      if (!a) return '<p class="hint">军务未启。</p>';
      var T = TROOPS(), cap = armyCap(), cnt = armyCount();
      var band = LF.moraleBand(a.morale || 100);
      var h = '';
      h += '<h3>军 队</h3>';
      h += '<div class="am-head">';
      h += '<div class="am-stat"><span>兵力</span><b>' + cnt + ' / ' + cap + '</b></div>';
      h += '<div class="am-stat"><span>战力</span><b>' + armyPower() + '</b></div>';
      h += '<div class="am-stat"><span>军粮</span><b>' + Math.round(a.logistics.grain || 0) + ' 石 · ' + grainDays().toFixed(1) + ' 日</b></div>';
      h += '<div class="am-stat"><span>军心</span><b style="color:' + band.color + '">' + band.name + '（' + Math.round(a.morale || 0) + '）</b></div>';
      h += '</div>' + moraleBar(a.morale || 100);
      if (a.marching) {
        h += '<div class="am-march">🚩 部曲自' + esc((((LF.CITIES || {})[a.marching.from] || {}).name || '旧营')) + '开拔赴' + esc((((LF.CITIES || {})[a.marching.to] || {}).name || '新城')) + '，尚余 ' + a.marching.left + ' 日（' + a.marching.km + ' 里）</div>';
      } else {
        h += '<div class="am-march">📍 部曲所在：' + (a.rallyPoint ? esc((((LF.CITIES || {})[a.rallyPoint] || {}).name || a.rallyPoint)) : '随你同行') + (armyWithPlayer() ? '（与你同在）' : '（不在你身边）') + '</div>';
      }
      if (scouting()) h += '<div class="am-march">🐎 斥候已出，三日内知敌。</div>';
      // 兵种网格
      h += '<div class="am-grid">';
      if (!a.troops.length) {
        h += '<div class="am-empty">尚无部曲——可往城中军营募兵，或于政令台「治军」。</div>';
      }
      a.troops.forEach(function (t) {
        var d = T[t.type]; if (!d) return;
        var r = LF.ARMY_RANKS[t.rank] || LF.ARMY_RANKS.front;
        h += '<div class="am-cell">';
        h += '<div class="am-ctop"><b>' + esc(d.name) + '</b><span class="am-rank">' + r.icon + esc(r.name) + '</span></div>';
        h += '<div class="am-cnum">' + (t.count || 0) + ' 人</div>';
        h += '<div class="am-cdesc">' + esc(d.desc) + '</div>';
        h += '<div class="am-cops">';
        rankAllow(t.type).forEach(function (rk) {
          if (rk === t.rank) return;
          h += '<button class="btn sm" onclick="window.armySetRank(\'' + t.type + '\',\'' + rk + '\')">改列' + esc((LF.ARMY_RANKS[rk] || {}).name) + '</button>';
        });
        h += '<button class="btn sm danger" onclick="window.armyDisband(\'' + t.type + '\',1)">遣散1</button>';
        h += '<button class="btn sm danger" onclick="window.armyDisband(\'' + t.type + '\',10)">遣散10</button>';
        h += '</div></div>';
      });
      h += '</div>';
      // 募兵（仅当置身城中军营；兵源按城人口、受兵力上限与府库所限）
      var rc = recruitCity();
      var rgold = Math.round((S() || {}).gold || 0);
      if (rc) {
        var rcName = (((LF.CITIES || {})[rc] || {}).name || rc);
        h += '<div class="am-recruit"><div class="am-rhead">募兵 · ' + esc(rcName) + '军营（兵源余 ' + recruitLeft(rc) + ' · 府库 ' + rgold + ' 两）</div><div class="am-rgrid">';
        var RT = TROOPS();
        Object.keys(RT).forEach(function (type) {
          var d = RT[type]; if (!d) return;
          var rc0 = recruitCost(type, 1);
          h += '<div class="am-rrow"><div class="am-rname"><b>' + esc(d.name) + '</b><span class="am-rdesc">' + esc(d.desc) + '</span></div>';
          h += '<div class="am-rcost">' + rc0 + ' 两/人</div><div class="am-rops">';
          h += '<button class="btn sm" onclick="window.armyRecruit(\'' + rc + '\',\'' + type + '\',30)">募30</button>';
          h += '<button class="btn sm" onclick="window.armyRecruit(\'' + rc + '\',\'' + type + '\',80)">募80</button>';
          h += '<button class="btn sm" onclick="window.armyRecruit(\'' + rc + '\',\'' + type + '\',9999)">募满</button>';
          h += '</div></div>';
        });
        h += '</div></div>';
      } else {
        h += '<div class="am-empty">须置身城中军营，方能募兵整军。</div>';
      }
      // 辎重
      var lcap = logisticsCap();
      h += '<div class="am-logi"><div class="am-lhead">辎重（' + logiUsed() + '/' + lcap + '）· 军粮 ' + Math.round(a.logistics.grain || 0) + ' 石</div><div class="am-lgrid">';
      if (!a.logistics.items.length) h += '<div class="am-empty">辎重空空——可自囊中存入粮秣、箭矢、药材。</div>';
      a.logistics.items.forEach(function (it) {
        h += '<div class="packcell" title="' + esc(it.defId) + '">' + itemIconHTML(it.defId) + '<span class="pk-n">' + (it.count || 0) + '</span></div>';
      });
      h += '</div><div class="am-lops">';
      h += '<button class="btn sm" onclick="window.armyBuyGrain(50)">籴粮50石</button>';
      h += '<button class="btn sm" onclick="window.armyBuyGrain(200)">籴粮200石</button>';
      h += '<button class="btn sm" onclick="window.openArmyDeposit()">自囊中存入</button>';
      h += '</div></div>';
      // 军务
      h += '<div class="am-ops">';
      h += '<button class="btn sm" onclick="window.armyCamp()">宿营整军</button>';
      h += '<button class="btn sm" onclick="window.armyScout()">派出斥候</button>';
      h += '<button class="btn sm" onclick="window.armyAmbush()">就地设伏</button>';
      h += '<button class="btn sm" onclick="window.openArmyDeploy()">调兵遣将</button>';
      h += '</div>';
      h += '<p class="hint">军令依阵位而别：前军可冲阵/坚守，中军压上/督战，后军齐射/掠阵，游骑包抄/断粮/追击。阵容既定，战阵之上每回合下的是军令，不是拳脚。</p>';
      return h;
    }
    function openArmyDeposit() {
      var mine = packList ? packList().filter(function (it) { return !!it; }) : [];
      if (!mine.length) { toast('囊中空空，无可存入。'); return; }
      var h = '<h3>存入辎重</h3><div class="am-lgrid">';
      mine.forEach(function (it) {
        h += '<button class="packcell" onclick="window.armyDeposit(\'' + esc(it.defId) + '\',1)">' + itemIconHTML(it.defId) + '<span class="pk-n">' + (it.count || 0) + '</span></button>';
      });
      h += '</div><p class="hint">点击存入一件；于军队面板点的辎重格可取出。</p>';
      openModal('armyDeposit');
      var card = document.getElementById('modal-card'); if (card) card.innerHTML = h;
    }
    function openArmyDeploy() {
      var a = ensureArmy(); if (!a) return;
      var from = a.rallyPoint || armyHereCid() || S().room;
      var h = '<h3>调兵遣将</h3><p class="hint">自' + esc((((LF.CITIES || {})[from] || {}).name || '旧营')) + '开拔。路程越远，耗时与军粮越巨；军队不在身边时，守城战由守军自行应战。</p><div class="am-deploy">';
      var ids = Object.keys(LF.CITIES || {}).slice(0, 200);
      ids.forEach(function (cid) {
        if (cid === from) return;
        var c = LF.CITIES[cid];
        var km = cityKm(from, cid), days = Math.max(1, Math.ceil(km / 55));
        h += '<div class="am-drow"><span>' + esc(c.name || cid) + '</span><span class="am-dkm">' + km + ' 里 · ' + days + ' 日</span><button class="btn sm" onclick="window.armyDeploy(\'' + cid + '\')">开拔</button></div>';
      });
      h += '</div>';
      openModal('armyDeploy');
      var card = document.getElementById('modal-card'); if (card) card.innerHTML = h;
    }
    function bindArmyPanel() {
      var box = document.getElementById('modal-card');
      if (!box) return;
      box.querySelectorAll('.packcell[data-w]').forEach(function () { });
      // 辎重格 → 取出
      var lg = box.querySelector('.am-lgrid');
      if (lg) {
        lg.querySelectorAll('.packcell').forEach(function (el) {
          var id = el.getAttribute('title') || el.getAttribute('data-defid');
          if (!id) return;
          el.style.cursor = 'pointer';
          el.onclick = function () { armyWithdraw(id, 1); };
        });
      }
    }

    return {
      ensureArmy: ensureArmy, armyCount: armyCount, armyCap: armyCap, armyPower: armyPower,
      armyUpkeep: armyUpkeep, armyActive: armyActive, armyHereCid: armyHereCid, armyWithPlayer: armyWithPlayer,
      troopOf: troopOf, recruitLeft: recruitLeft, recruitCost: recruitCost,
      armyRecruit: armyRecruit, armyDisband: armyDisband, armySetRank: armySetRank, rankDefault: rankDefault, rankAllow: rankAllow,
      armyDeposit: armyDeposit, armyWithdraw: armyWithdraw, armyBuyGrain: armyBuyGrain, grainDays: grainDays, logisticsCap: logisticsCap,
      armyMoraleAdd: armyMoraleAdd, tickArmyDay: tickArmyDay, moraleMul: moraleMul,
      armyDeploy: armyDeploy, armyCamp: armyCamp, armyScout: armyScout, armyAmbush: armyAmbush, scouting: scouting, cityKm: cityKm,
      buildArmyPlayerUnits: buildArmyPlayerUnits, settleArmyLoss: settleArmyLoss, buildOrdersFor: buildOrdersFor,
      renderArmyPanel: renderArmyPanel, bindArmyPanel: bindArmyPanel, openArmyDeposit: openArmyDeposit, openArmyDeploy: openArmyDeploy
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.createArmy;
})(typeof window !== 'undefined' ? window : globalThis);

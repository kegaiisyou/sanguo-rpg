// 战术战斗（v20260921a）：守军派生 / 三段攻城 / 野战 / 战场事件（援军·伏兵·袭营·冲散）/ 战前编成
// 设计：不做格子阵型；战术由「三阵位 + 军令」与「战场事件」承载，战斗核心（CombatEngine）原样复用。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createWar = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF, G = ctx.G;
    var log = ctx.log, toast = ctx.toast, save = ctx.save, renderStatus = ctx.renderStatus, renderRoom = ctx.renderRoom;
    var openModal = ctx.openModal, closeModal = ctx.closeModal;
    var escapeHtml = ctx.escapeHtml, exert = ctx.exert, advanceTime = ctx.advanceTime;
    var startCombat = ctx.startCombat, showCombatSettlement = ctx.showCombatSettlement;
    var conquerCity = ctx.conquerCity, playerFaction = ctx.playerFaction, cityDevOf = ctx.cityDevOf;
    var isCityGrid = ctx.isCityGrid, roleAtkMul = ctx.roleAtkMul;
    var Army = ctx.Army;               // 军队工厂实例
    var getPendingArmyBattle = ctx.getPendingArmyBattle, setPendingArmyBattle = ctx.setPendingArmyBattle;

    var SEGS = [
      { key: 'gate', name: '城门', mark: '〔破门〕', desc: '护城河下，门楼之前——云梯未稳，矢石如雨。' },
      { key: 'street', name: '巷道', mark: '〔巷战〕', desc: '街巷纵横，屋舍为障——一步一血，寸土必争。' },
      { key: 'hall', name: '府衙', mark: '〔府衙〕', desc: '衙署之前，守将亲督——此处一破，满城易主。' }
    ];

    // ══ 聚合：兵员 → 营级数值 ══
    // hp/atk 取幂律（避免线性膨胀拉长战斗），def 取对数（CombatEngine 每点 def 减伤 1%、上限 80%，
    // 故聚合防御须保持在 ~70 以内才有意义）。
    function aggF(count) {
      var c = Math.max(1, count || 1);
      return { hpF: Math.pow(c, 0.85), atkF: Math.pow(c, 0.85) * 1.0, defF: Math.log(1 + c) * 1.15 };
    }
    function mkUnit(name, count, per, o) {
      o = o || {};
      var f = aggF(count);
      var hp = Math.max(1, Math.round((per.hp || 20) * f.hpF));
      return {
        name: name, count: count,
        hp: hp, maxHp: hp,
        atk: Math.max(1, Math.round((per.atk || 5) * f.atkF * (o.atkMul || 1))),
        def: Math.max(0, Math.round((per.def || 5) * f.defF)),
        spd: per.spd || 12,
        element: '无', hitRate: 0.95, critRate: o.critRate || 0,
        equippedForce: [], learnedMartial: [],
        isTroop: true, troopType: o.troopType || null, rank: o.rank || 'front',
        guard: o.guard !== false,
        morale: o.morale == null ? 80 : o.morale,
        _built: true
      };
    }
    function applyOrders(u, rank) {
      // 复用 army 的军令构造（同一份逻辑），保证敌我军令一致
      var od = Army.buildOrdersFor(u, rank, u.count || 1);
      u._artMap = od.map; u.artIds = od.ids;
      return u;
    }
    function clampM(v) { return Math.max(0, Math.min(100, Math.round(v))); }

    // ══ 守军派生 ══
    function cityBase(cid) {
      var c = (LF.CITIES || {})[cid] || {};
      var dev = cityDevOf ? cityDevOf(cid) : 0;
      return Math.max(30, Math.round((c.wall || 30) * 1.2 + (c.pop || 40) * 0.6 + dev * 0.3));
    }
    function defenderWave(cid, seg) {
      var n = cityBase(cid);
      var c = (LF.CITIES || {})[cid] || {};
      var tag = (c.name || cid);
      var P = {
        dun: { atk: 6, def: 10, hp: 26, spd: 10 },
        nu: { atk: 9, def: 4, hp: 18, spd: 13 },
        qiang: { atk: 6, def: 8, hp: 24, spd: 12 },
        jiang: { atk: 13, def: 11, hp: 40, spd: 16 }
      };
      var out = [];
      if (seg === 0) {
        out.push(applyOrders(mkUnit('城门守卒', Math.round(n * 0.5), P.dun, { rank: 'front', morale: 85 }), 'front'));
        out.push(applyOrders(mkUnit('城头弓弩', Math.round(n * 0.3), P.nu, { rank: 'rear', guard: false, morale: 80 }), 'rear'));
      } else if (seg === 1) {
        out.push(applyOrders(mkUnit('巷战锐卒', Math.round(n * 0.45), P.qiang, { rank: 'front', morale: 75 }), 'front'));
        out.push(applyOrders(mkUnit('屋脊弓手', Math.round(n * 0.25), P.nu, { rank: 'rear', guard: false, morale: 75 }), 'rear'));
      } else {
        out.push(applyOrders(mkUnit('府衙亲兵', Math.round(n * 0.4), P.dun, { rank: 'front', morale: 80 }), 'front'));
        out.push(applyOrders(mkUnit(tag + '守将', Math.max(8, Math.round(n * 0.22)), P.jiang, { rank: 'mid', morale: 90, critRate: 0.12, atkMul: 1.1 }), 'mid'));
      }
      return out;
    }
    // 把守军单位注册为临时敌人定义，供 startCombat 的 init 原样构建
    function registerDefenders(cid, seg, units) {
      var ids = [];
      units.forEach(function (u, i) {
        var id = '_dfn_' + seg + '_' + i;
        G.ENEMIES[id] = {
          id: id, name: u.name, title: '', hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd,
          ai: /守将/.test(u.name) ? 'aggressive' : 'balanced',
          element: '无', exp: 0, drop: { gold: 0, pot: 0, items: [] },
          skills: [{ name: '矢石交下', dmgMul: 1.0, eff: {} }, { name: '短兵相接', dmgMul: 1.35, eff: {} }],
          morale: u.morale, isTroop: true
        };
        ids.push(id);
      });
      return ids;
    }
    // 攻方部队（守城战 / 野战用）
    function attackerWave(fid, scale) {
      var T = LF.TROOPS || {};
      var assets = (S().flags && S().flags.factionAssets) || {};
      var a = assets[fid] || {};
      var tot = (a.troops || 0);
      var n = Math.max(20, Math.round(tot * (scale || 0.5)));
      var out = [];
      out.push(applyOrders(mkUnit('步卒', Math.round(n * 0.5), { atk: 6, def: 8, hp: 24, spd: 12 }, { rank: 'front', morale: 78 }), 'front'));
      out.push(applyOrders(mkUnit((((LF.FACTIONS || {})[fid] || {}).name || '敌军') + '骁骑', Math.round(n * 0.25), { atk: 11, def: 6, hp: 30, spd: 20 }, { rank: 'flank', guard: false, morale: 80 }), 'flank'));
      return out;
    }
    function registerAttackers(units, tag) {
      var ids = [];
      units.forEach(function (u, i) {
        var id = '_atk_' + (tag || 'x') + '_' + i;
        G.ENEMIES[id] = {
          id: id, name: u.name, title: '', hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd,
          ai: 'balanced', element: '无', exp: 0, drop: { gold: 0, pot: 0, items: [] },
          skills: [{ name: '鼓噪而进', dmgMul: 1.05, eff: {} }, { name: '骑兵突阵', dmgMul: 1.4, eff: {} }],
          morale: u.morale, isTroop: true
        };
        ids.push(id);
      });
      return ids;
    }

    // ══ 战场事件 ══
    function allyUnits(st) { return (st && st.playerUnits ? st.playerUnits : []).filter(function (u) { return u && u.hp > 0; }); }
    function foeUnits(st) { return (st && st.enemies ? st.enemies : []).filter(function (e) { return e && e.hp > 0; }); }
    function moraleAll(list, v) {
      list.forEach(function (u) { if (u && u.morale != null) u.morale = clampM(u.morale + v); });
    }
    function armyRoundHook(orders) {
      var st = G.CombatEngine && G.CombatEngine.state;
      if (!st) return;
      var O = LF.ARMY_ORDERS || {};
      var allies = allyUnits(st), foes = foeUnits(st);
      // 军令副作用（士气 / 自损）——伤害与特效由引擎内 _resolveAction 结算
      (orders || []).forEach(function (o) {
        if (!o || !o.unit) return;
        var def = O[o.actionId], u = o.unit;
        if (!def) return;
        if (def.selfDmg && u.hp > 0) {
          var d = Math.max(1, Math.round(u.maxHp * def.selfDmg));
          u.hp = Math.max(0, u.hp - d);
          if (u.hp <= 0) log('「' + u.name + '」冲得太猛，反被自家血肉拖垮——几近打残。', 'danger');
        }
        if (def.moraleSelf) u.morale = clampM((u.morale == null ? 80 : u.morale) + def.moraleSelf);
        if (def.moraleFoe) moraleAll(foes, def.moraleFoe);
        if (def.moraleArmy) moraleAll(allies, def.moraleArmy);
      });
      // ── 冲散：士气与伤亡压垮 → 溃散离场 ──
      function routCheck(list, isFoe) {
        list.forEach(function (u) {
          if (!u || u.hp <= 0 || u.routed) return;
          var r = u.maxHp > 0 ? u.hp / u.maxHp : 0;
          var m = u.morale == null ? 80 : u.morale;
          var risk = 0;
          if (r < 0.5) risk += 0.06 + (0.5 - r) * 0.5;
          if (m < 45) risk += (45 - m) * 0.006;
          if (u.stunNext) risk += 0.1;
          if (risk > 0 && Math.random() < risk) {
            u.routed = true;
            u.hp = Math.max(1, Math.round(u.hp * 0.5));
            log((isFoe ? '敌' : '') + '「' + u.name + '」阵脚大乱，旗倒人散——' + (isFoe ? '敌军' : '你的部曲') + '溃了！', isFoe ? 'good' : 'danger');
            moraleAll(list, isFoe ? 6 : -6);
          }
        });
      }
      routCheck(allies.filter(function (u) { return u.isTroop; }), false);
      routCheck(foes, true);
      // ── 援军到场 ──
      var ab = getPendingArmyBattle ? getPendingArmyBattle() : null;
      if (ab && ab.reinforce && !ab.reinforce.done && (st.round || 0) >= ab.reinforce.round) {
        ab.reinforce.done = true;
        var ru = ab.reinforce.unit;
        var id = '_dfn_rnf';
        G.ENEMIES[id] = {
          id: id, name: ru.name, title: '', hp: ru.maxHp, atk: ru.atk, def: ru.def, spd: ru.spd,
          ai: 'aggressive', element: '无', exp: 0, drop: { gold: 0, pot: 0, items: [] },
          skills: [{ name: '疾驰赴援', dmgMul: 1.2, eff: {} }], morale: ru.morale, isTroop: true
        };
        var built = (G.CombatEngine.buildEnemyUnit ? G.CombatEngine.buildEnemyUnit(id, (st.enemies || []).length)
          : { idx: (st.enemies || []).length, id: id, name: ru.name, hp: ru.maxHp, maxHp: ru.maxHp, atk: ru.atk, def: ru.def, spd: ru.spd, skills: [] });
        built.morale = ru.morale;
        (st.enemies || []).push(built);
        log('〔援军〕狼烟所召，' + ru.name + '自旁路杀到——敌势复振！', 'warn');
      }
      renderStatus && renderStatus();
    }

    // ══ 编成 → 起战 ══
    var prep = null;   // {cid, mode, exclude:{}}
    function ourUnits(opt) {
      var a = Army.ensureArmy();
      var types = null;
      if (prep && prep.exclude) {
        var ex = prep.exclude;
        types = (a.troops || []).filter(function (t) { return !ex[t.type]; }).map(function (t) { return t.type; });
      }
      var us = Army.buildArmyPlayerUnits({ types: types, atkMul: opt && opt.atkMul, combatOnly: true });
      return us;
    }
    function maybeAmbush(opt) {
      // 伏兵：敌先手 —— 我方士气重挫、一营陷入混乱
      var st = G.CombatEngine && G.CombatEngine.state;
      if (!st) return;
      var allies = allyUnits(st);
      moraleAll(allies, -18);
      if (allies.length > 1) {
        var pick = allies[Math.floor(Math.random() * allies.length)];
        if (pick) { pick.stunNext = true; log('〔中伏〕' + pick.name + '猝不及防，阵型散乱，一时难以呼应。', 'danger'); }
      }
    }
    function maybeNight(opt) {
      // 袭营：敌士气重挫、我方攻势加成，但自家也心惊
      var st = G.CombatEngine && G.CombatEngine.state;
      if (!st) return;
      moraleAll(foeUnits(st), -25);
      (st.playerUnits || []).forEach(function (u) {
        if (!u || !u.isTroop) return;
        u.atk = Math.round(u.atk * 1.3);
        u.artIds.forEach(function (aid) { var a = u._artMap && u._artMap[aid]; if (a && a.dmgMul) a.dmgMul = Math.round(a.dmgMul * 1.15 * 100) / 100; });
      });
      moraleAll(allyUnits(st), -4);
      log('〔袭营〕夜色如墨，你令士卒衔枚疾走——敌军梦中惊起，旗鼓不整。', 'good');
    }

    function beginBattle(enemyIds, opt) {
      opt = opt || {};
      var ab = {
        kind: opt.kind || 'field', cid: opt.cid || null, seg: opt.seg || 0,
        reinforce: opt.reinforce || null, night: !!opt.night, ambush: !!opt.ambush,
        fid: opt.fid || null, def: opt.def || null
      };
      if (setPendingArmyBattle) setPendingArmyBattle(ab);
      var units = ourUnits({ atkMul: opt.atkMul });
      if (!units.length) { toast('你身边并无可战之兵。'); if (setPendingArmyBattle) setPendingArmyBattle(null); return false; }
      startCombat(enemyIds, { armyBattle: true, armyUnits: units });
      // 战斗初始化是异步（setTimeout 400ms）的，事件效果在 init 之后兑现
      setTimeout(function () {
        if (ab.ambush) maybeAmbush();
        if (ab.night) maybeNight();
        var st = G.CombatEngine && G.CombatEngine.state;
        if (st) {
          log('〔列阵〕' + units.map(function (u) { return (LF.ARMY_RANKS[u.rank] || {}).name + '·' + u.name; }).join('，') + '。', 'sys');
          if (ab.reinforce) log('〔警讯〕狼烟未起——若战事胶着，' + ab.reinforce.name + '将于第 ' + ab.reinforce.round + ' 回合驰至。', 'warn');
        }
        renderStatus && renderStatus();
      }, 520);
      return true;
    }

    // ══ 攻城战：三段 ══
    function startSiegeBattle(cid, opt) {
      opt = opt || {};
      var a = Army.ensureArmy();
      if (!a || !Army.armyCount()) { toast('你尚无部曲——先往城中军营募兵。'); return false; }
      if (!Army.armyWithPlayer()) { toast('你的部曲不在身边（' + (((LF.CITIES || {})[a.rallyPoint] || {}).name || '他处') + '）——先调兵会合。'); return false; }
      if ((a.logistics.grain || 0) <= 0) { toast('军粮告罄，无粮何以兴师？'); return false; }
      if (!exert('兴师')) return false;
      prep = prep && prep.cid === cid ? prep : { cid: cid, mode: 'siege', exclude: {} };
      return launchSiege(cid);
    }
    function launchSiege(cid) {
      var ids = registerDefenders(cid, 0, defenderWave(cid, 0));
      var rf = null;
      var owner = (((((LF.CITIES || {})[cid] || {}).owner) || ''));
      if (owner && owner !== 'player' && Math.random() < 0.35) {
        var ru = applyOrders(mkUnit('邻郡援军', Math.round(cityBase(cid) * 0.3), { atk: 7, def: 8, hp: 26, spd: 16 }, { rank: 'flank', guard: false, morale: 82 }), 'flank');
        rf = { unit: ru, round: 3, done: false, name: ru.name };
      }
      return beginBattle(ids, {
        kind: 'siege', cid: cid, seg: 0, reinforce: rf,
        atkMul: (roleAtkMul ? roleAtkMul() : 1)
      });
    }
    function carryUnits() {
      var st = G.CombatEngine && G.CombatEngine.state;
      if (!st) return { troops: [], php: null };
      var php = null;
      (st.playerUnits || []).forEach(function (u, i) { if (i === 0) php = u.hp; });
      var troops = (st.playerUnits || []).filter(function (u) { return u && u.isTroop && u.hp > 0; }).map(function (u) { u._built = true; return u; });
      return { troops: troops, php: php };
    }
    function armyBattleEnd(result) {
      var ab = getPendingArmyBattle ? getPendingArmyBattle() : null;
      if (!ab) return;
      var st = G.CombatEngine && G.CombatEngine.state;
      var carried = carryUnits();
      if (st && carried.php != null) S().hp = Math.max(1, Math.round(carried.php));
      var loss = Army.settleArmyLoss(carried.troops);
      var lines = [];
      lines.push('折损兵卒 ' + loss.lost + ' 人' + (loss.routed && loss.routed.length ? '，溃散：' + loss.routed.join('、') : ''));
      lines.push('军心：' + LF.moraleBand((Army.ensureArmy() || {}).morale || 100).name);
      lines.push('辎重余粮 ' + Math.round((Army.ensureArmy() || {}).logistics.grain || 0) + ' 石（可支 ' + Army.grainDays().toFixed(1) + ' 日）');

      if (ab.kind === 'siege') {
        if (result === 'win' && ab.seg < SEGS.length - 1) {
          var seg = SEGS[ab.seg];
          showCombatSettlement && showCombatSettlement({
            result: 'win', enemyName: seg.name, title: '克 ' + seg.name, sub: seg.mark, lines: lines
          }, function () {
            var next = ab.seg + 1;
            var ids = registerDefenders(ab.cid, next, defenderWave(ab.cid, next));
            beginBattle(ids, {
              kind: 'siege', cid: ab.cid, seg: next, reinforce: ab.reinforce && !ab.reinforce.done && next < 2 ? ab.reinforce : null,
              atkMul: (roleAtkMul ? roleAtkMul() : 1)
            });
          });
          return;
        }
        finishSiege(ab, result, loss, lines);
        return;
      }
      if (ab.kind === 'defend') { finishDefend(ab, result, loss, lines); return; }
      finishField(ab, result, loss, lines);
    }
    function finishSiege(ab, result, loss, lines) {
      if (setPendingArmyBattle) setPendingArmyBattle(null);
      var cid = ab.cid;
      var cname = (((LF.CITIES || {})[cid] || {}).name || '此城');
      if (result === 'win') {
        Army.armyMoraleAdd(10, '城破之功，');
        showCombatSettlement && showCombatSettlement({
          result: 'win', enemyName: cname, title: '城 破', sub: '〔易帜〕', lines: lines
        }, function () { conquerCity(cid, playerFaction ? playerFaction() : 'player', -5); renderRoom(); save(S()); });
      } else {
        Army.armyMoraleAdd(-12, '兵败之辱，');
        showCombatSettlement && showCombatSettlement({
          result: 'lose', enemyName: cname, title: result === 'fled' ? '鸣金收兵' : '兵 败', sub: '〔退兵〕', lines: lines
        }, function () { renderRoom(); save(S()); });
      }
      prep = null;
    }
    function finishDefend(ab, result, loss, lines) {
      if (setPendingArmyBattle) setPendingArmyBattle(null);
      var cid = ab.cid;
      var cname = (((LF.CITIES || {})[cid] || {}).name || '此城');
      if (result === 'win') {
        Army.armyMoraleAdd(12, '守土之功，');
        showCombatSettlement && showCombatSettlement({
          result: 'win', enemyName: cname, title: '守 住', sub: '〔却敌〕', lines: lines
        }, function () { renderRoom(); save(S()); });
      } else {
        Army.armyMoraleAdd(-15, '城陷之痛，');
        showCombatSettlement && showCombatSettlement({
          result: 'lose', enemyName: cname, title: '城 陷', sub: '〔失守〕', lines: lines
        }, function () { if (ab.fid) conquerCity(cid, ab.fid, -5); renderRoom(); save(S()); });
      }
      prep = null;
    }
    function finishField(ab, result, loss, lines) {
      if (setPendingArmyBattle) setPendingArmyBattle(null);
      if (result === 'win') Army.armyMoraleAdd(8, '野战得胜，');
      else Army.armyMoraleAdd(-10, '野战失利，');
      showCombatSettlement && showCombatSettlement({
        result: result === 'win' ? 'win' : 'lose', enemyName: ab.def ? ab.def.name : '敌军',
        title: result === 'win' ? '得 胜' : (result === 'fled' ? '收 兵' : '败 走'), sub: '〔野战〕', lines: lines
      }, function () { renderRoom(); save(S()); });
      prep = null;
    }

    // ══ 守城战 ══
    function startDefendBattle(cid, fid) {
      var a = Army.ensureArmy();
      if (!a) return false;
      if (!Army.armyWithPlayer() && a.rallyPoint !== cid) {
        warlordAutoDefend(cid, fid); return false;
      }
      var units = attackerWave(fid, 0.6);
      var ids = registerAttackers(units, 'd');
      return beginBattle(ids, { kind: 'defend', cid: cid, fid: fid });
    }
    function warlordAutoDefend(cid, fid) {
      // 军队不在城中：守军自行应战（后台判定），与旧战略层掷骰同源
      log('〔警讯〕' + (((LF.CITIES || {})[cid] || {}).name || '城') + '告急——你的部曲不在城中，守军自行应战。', 'warn');
      return false;
    }
    // ══ 野战 ══
    function startFieldBattle(opt) {
      opt = opt || {};
      var a = Army.ensureArmy();
      if (!a || !Army.armyCount()) { toast('你并无部曲，无从交战。'); return false; }
      if (!Army.armyWithPlayer()) { toast('部曲不在身边。'); return false; }
      if (!exert('交战')) return false;
      var def = opt.def || { name: '流寇', troops: 60 };
      var units = [];
      units.push(applyOrders(mkUnit(def.name + '步卒', Math.round((def.troops || 60) * 0.55), { atk: 6, def: 8, hp: 24, spd: 12 }, { rank: 'front', morale: 75 }), 'front'));
      if ((def.troops || 60) > 40) units.push(applyOrders(mkUnit(def.name + '游骑', Math.round((def.troops || 60) * 0.22), { atk: 11, def: 6, hp: 30, spd: 20 }, { rank: 'flank', guard: false, morale: 78 }), 'flank'));
      var ids = registerAttackers(units, 'f');
      var ambush = !!opt.ambush;
      if (opt.byPlayer) {   // 我方设伏 → 敌中伏
        units.forEach(function (u) { u.morale = clampM((u.morale || 78) - 25); });
      }
      return beginBattle(ids, { kind: 'field', def: def, ambush: ambush, night: !!opt.night });
    }

    // ══ 设伏：郊野候敌，敌至则先手 ══
    function tryAmbush() {
      var st = S(); if (!st || !st.flags || !st.flags.armyAmbush) return false;
      var am = st.flags.armyAmbush;
      if (st.room !== am.room) { st.flags.armyAmbush = null; return false; }
      if (!Army.armyWithPlayer() || !Army.armyCount()) return false;
      if (Math.random() >= 0.32) return false;
      st.flags.armyAmbush = null;
      var n = Army.armyCount();
      log('〔设伏〕林间尘头大起——一队人马正撞进你的伏中。', 'combat');
      return startFieldBattle({ def: { name: '过路兵马', troops: Math.round(n * 0.7) }, byPlayer: true });
    }

    // ══ 战前编成面板 ══
    function esc(s) { return escapeHtml ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s); }
    function openSiegePrep(cid) {
      var a = Army.ensureArmy();
      if (!a || !Army.armyCount()) { toast('尚无部曲可编。'); return; }
      prep = { cid: cid, mode: 'siege', exclude: {} };
      renderPrep(cid);
    }
    function renderPrep(cid) {
      var a = Army.ensureArmy();
      var c = (LF.CITIES || {})[cid] || {};
      var T = LF.TROOPS || {};
      var st = S();
      var gd = Army.grainDays();
      var h = '';
      h += '<h3>战前编成</h3>';
      h += '<div class="wp-target"><b>' + esc(c.name || cid) + '</b><span>' + esc(c.state || '') + ' · 城防 ' + (c.wall || 0) + ' · 人户 ' + (c.pop || 0) + ' · 守军约 ' + cityBase(cid) + '</span></div>';
      h += '<div class="wp-note">' + esc(SEGS[0].desc) + '攻城须破城门、清巷道、下府衙三段；每克一段，可鸣金收兵，亦可带伤再战。</div>';
      h += '<div class="wp-grid">';
      (a.troops || []).forEach(function (t) {
        var d = T[t.type]; if (!d) return;
        var on = !(prep.exclude[t.type]);
        var r = LF.ARMY_RANKS[t.rank] || LF.ARMY_RANKS.front;
        h += '<div class="wp-cell' + (on ? '' : ' off') + '" onclick="window.warToggleTroop(\'' + t.type + '\')">';
        h += '<div class="wp-ctop"><b>' + esc(d.name) + '</b><span>' + r.icon + esc(r.name) + '</span></div>';
        h += '<div class="wp-cnum">' + (t.count || 0) + ' 人' + (on ? '' : '（留守）') + '</div>';
        h += '</div>';
      });
      h += '</div>';
      var band = LF.moraleBand(a.morale || 100);
      h += '<div class="wp-foot' + (gd < 3 ? ' warn' : '') + '">军心：<b style="color:' + band.color + '">' + band.name + '</b>　军粮可支 <b>' + gd.toFixed(1) + '</b> 日' + (gd < 3 ? '　⚠ 粮草不继，久战必溃' : '') + '</div>';
      h += '<div class="wp-ops"><button class="btn primary" onclick="window.warLaunch()">举 兵</button><button class="btn" onclick="window.closeModal()">再想想</button></div>';
      openModal('warPrep');
      var card = document.getElementById('modal-card'); if (card) card.innerHTML = h;
    }
    function warToggleTroop(type) {
      if (!prep) return;
      prep.exclude[type] = !prep.exclude[type];
      renderPrep(prep.cid);
    }
    function warLaunch() {
      if (!prep) return;
      var cid = prep.cid;
      closeModal();
      launchSiege(cid);
    }

    return {
      SEGS: SEGS, cityBase: cityBase, defenderWave: defenderWave, attackerWave: attackerWave,
      mkUnit: mkUnit, applyOrders: applyOrders, aggF: aggF,
      armyRoundHook: armyRoundHook, armyBattleEnd: armyBattleEnd,
      startSiegeBattle: startSiegeBattle, launchSiege: launchSiege,
      startDefendBattle: startDefendBattle, startFieldBattle: startFieldBattle, tryAmbush: tryAmbush,
      openSiegePrep: openSiegePrep, renderPrep: renderPrep, warToggleTroop: warToggleTroop, warLaunch: warLaunch,
      beginBattle: beginBattle
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.createWar;
})(typeof window !== 'undefined' ? window : globalThis);

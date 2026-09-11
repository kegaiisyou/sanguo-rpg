// 乱世烽火 · 触发引擎（v20260908h）
// 从 engine.js 抽离：数据驱动的「场景首访剧本」与「事件触发」。
// 不读任何 window 裸全局——引擎依赖经 LF.createTriggers(ctx) 注入，与 engine.js 解耦。
// 剧本数据仍由 shared/story/triggers.js 提供（经 ctx.getTriggers() 取得）。
window.LF = window.LF || {};
(function () {
  LF.Core = LF.Core || {};

  // ctx 依赖（引擎注入）：
  //   G                          —— SharedGame（ROOMS/DIALOGUES/EVENTS）
  //   getState()                 —— 实时 state
  //   getTriggers()              —— 剧本数组（引擎侧从 window.LF.TRIGGERS / G.TRIGGERS 取）
  //   getOnbLayers()             —— 新手引导层名数组（定义于引擎，启动时赋值）
  //   log/logScene/onbReveal/highlightOnb/onbGoal/tutAsk/findEvent/runEvent/
  //   startCombat/addReputation/packAdd/save/renderStatus/renderMoveBar/renderNpcList —— 引擎函数
  LF.createTriggers = function (dep) {
    var G = dep.G;
    var getState = dep.getState, getTriggers = dep.getTriggers, getOnbLayers = dep.getOnbLayers;
    var log = dep.log, logScene = dep.logScene,
        onbReveal = dep.onbReveal, highlightOnb = dep.highlightOnb, onbGoal = dep.onbGoal,
        tutAsk = dep.tutAsk, findEvent = dep.findEvent, runEvent = dep.runEvent,
        startCombat = dep.startCombat, addReputation = dep.addReputation,
        packAdd = dep.packAdd, save = dep.save, renderStatus = dep.renderStatus,
        renderMoveBar = dep.renderMoveBar, renderNpcList = dep.renderNpcList,
        addXp = dep.addXp,
        acceptQuest = dep.acceptQuest, completeQuest = dep.completeQuest;

    function getPath(o, p) {
      var ks = String(p).split('.'), c = o;
      for (var i = 0; i < ks.length; i++) { if (c == null) return undefined; c = c[ks[i]]; }
      return c;
    }
    function setPath(o, p, v) {
      var ks = String(p).split('.'), c = o;
      for (var i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null) c[ks[i]] = {}; c = c[ks[i]]; }
      c[ks[ks.length - 1]] = v;
    }
    function isDay() { var state = getState(); var h = state.time % 12; return h >= 3 && h <= 9; }

    function resolveTpl(s) {
      if (typeof s !== 'string') return s;
      return s.replace(/\{\{name\}\}/g, (getState().name || '无名客'));
    }

    function testCond(c, env) {
      var state = getState();
      if (!c) return true;
      if (c.room && c.room !== state.room) return false;
      if (c.roomIn && c.roomIn.indexOf(state.room) < 0) return false;
      if (c.notRoom && c.notRoom.indexOf(state.room) >= 0) return false;
      if (c.notFlag && getPath(state, c.notFlag)) return false;
      if (c.hasNpc) { var np = (G.ROOMS[state.room] && G.ROOMS[state.room].npcs) || []; if (np.indexOf(c.hasNpc) < 0) return false; }
      if (c.npcFavor) { var f = (state.npcFavor && state.npcFavor[c.npcFavor.key]) || 0; if (c.npcFavor.min != null && f < c.npcFavor.min) return false; if (c.npcFavor.max != null && f > c.npcFavor.max) return false; }
      if (c.player) { for (var k in c.player) { var nd = c.player[k], v = getPath(state, k) || 0; if (nd.min != null && v < nd.min) return false; if (nd.max != null && v > nd.max) return false; } }
      if (c.flags) { for (var p in c.flags) { if (!!getPath(state, p) !== !!c.flags[p]) return false; } }
      if (c.time) { if (c.time.day === true && !isDay()) return false; if (c.time.day === false && isDay()) return false; if (c.time.phases && c.time.phases.indexOf(state.time % 12) < 0) return false; }
      if (c.hasItem) { var _pk = state.pack || []; var _hit = false; for (var _h = 0; _h < _pk.length; _h++) { if (_pk[_h] && (_pk[_h].defId || _pk[_h].id) === c.hasItem) { _hit = true; break; } } if (!_hit) return false; }
      return true;
    }

    function applySet(set, npcKey) {
      var state = getState();
      if (!set) return;
      for (var k in set) {
        if (k === 'favor') { if (!state.npcFavor) state.npcFavor = {}; state.npcFavor[npcKey] = (state.npcFavor[npcKey] || 0) + set[k]; }
        else { setPath(state, k, set[k]); }
      }
    }
    function markDone(tr) {
      var state = getState();
      if (tr.once !== false) { if (!state.flags) state.flags = {}; state.flags['trg.' + tr.id] = true; }
    }
    function isDone(tr) {
      var state = getState();
      return tr.once !== false && !!(state.flags && state.flags['trg.' + tr.id]);
    }

    function runSteps(arr, idx, done, env) {
      if (!arr || idx >= arr.length) { if (done) done(); return; }
      runStep(arr[idx], function () { runSteps(arr, idx + 1, done, env); }, env);
    }
    function runStep(step, next, env) {
      var state = getState();
      switch (step.t) {
        case 'narrate': {
          var lines = step.lines || (step.room && G.ROOMS[step.room] && G.ROOMS[step.room].desc) || [];
          logScene(lines.map(function (d) { return { t: d, c: 'env' }; }), 800, next);
          break;
        }
        case 'sys': log(step.text, 'sys'); next(); break;
        case 'log': log(resolveTpl(step.text), step.cls || 'npc', step.npc); next(); break;
        case 'reveal': onbReveal(step.layer); if (step.highlight) highlightOnb(step.layer); next(); break;
        case 'highlight': highlightOnb(step.layer); next(); break;
        case 'npcTalk': {
          var npcName = (G.DIALOGUES.npcs[step.npc] && G.DIALOGUES.npcs[step.npc].name) || step.npc;
          var asks = (step.asks || []).map(function (a) {
            return {
              label: resolveTpl(a.label), fn: function () {
                applySet(a.set, step.npc);
                onbGoal();   // 对话选项推进旗标后立即刷新「当前目标」引导（v20260907f）
                (a.reveal || []).forEach(function (l) { onbReveal(l); });
                if (a.highlight) { (Array.isArray(a.highlight) ? a.highlight : [a.highlight]).forEach(function (l) { highlightOnb(l); }); }
                if (a.say) log(resolveTpl(a.say));   // say 为混合叙事（含主角动作+老乞丐台词），不附加「老乞丐：」前缀以免不通顺
                save(state);
                if (a.then && a.then.length) { runSteps(a.then, 0, next, env); } else { next(); }
              }
            };
          });
          tutAsk(resolveTpl(step.prompt), asks);
          break;   // 等待玩家选择，选择后才 next()
        }
        case 'moveGate': {
          // fromChain 仅燕山链用过，链已弃用；此处保留通用门禁（fwd/back/lockBack），用于苦役营越狱等剧情
          if (step.fromChain) {
            state.moveGate = null;
          } else {
            state.moveGate = { fwd: step.fwd, back: step.back, lockBack: !!step.lockBack, hint: step.hint };
          }
          renderMoveBar(G.ROOMS[state.room]);   // 门禁变化即时刷新罗盘（如问名后解锁前进）
          next();
          break;
        }
        case 'clearGate': state.moveGate = null; renderMoveBar(G.ROOMS[state.room]); next(); break;
        case 'event': { var ev = findEvent(step.id); if (ev) runEvent(ev); next(); break; }
        case 'combat': {
          startCombat(step.enemy, { tutorial: !!step.tutorial });
          break;  // 战斗异步，后续步骤待战斗结束再续（开场战斗为链尾，无需续）
        }
        case 'setFlag': { if (step.increment) { var cur = getPath(state, step.path) || 0; var inc = step.incrementByEnv ? (env && env[step.incrementByEnv] ? env[step.incrementByEnv] : 1) : (step.value || 1); setPath(state, step.path, cur + inc); } else { setPath(state, step.path, step.value); } save(state); next(); break; }
        case 'grant': {
          if (step.gold) { state.gold = Math.max(0, (state.gold || 0) + step.gold); }
          if (step.rep) { addReputation(step.rep); }
          if (step.items && step.items.length) { step.items.forEach(function (it) {
            if (it.id && LF.ITEMS && LF.ITEMS.DEFS && LF.ITEMS.DEFS[it.id]) {
              packAdd(it.id, it.count || 1);
            } else {
              packAdd({ defId: it.id, name: it.name, icon: (it.icon || '📦'), cat: it.cat, count: it.count || 1, effect: it.effect });
            }
          }); }
          save(state); renderStatus(); next(); break;
        }
        case 'removeNpc': { var rn = G.ROOMS[state.room].npcs, i = rn ? rn.indexOf(step.key) : -1; if (i >= 0) rn.splice(i, 1); next(); break; }
        case 'exp': { if (addXp) { addXp(step.amount || 0); } else { state.exp = (state.exp || 0) + (step.amount || 0); } renderStatus(); save(state); next(); break; }
        // 刑罚·扣血（v20260911e）：reduce HP（下限 1，不死）、降好感、播放鞭打动效
        case 'hurt': {
          var dmg = step.amount || 15;
          var st = getState();
          var curHp = (st.hp == null) ? (st.maxHp || 100) : st.hp;
          st.hp = Math.max(1, curHp - dmg);
          if (step.favor && step.favorNpc) { if (!st.npcFavor) st.npcFavor = {}; st.npcFavor[step.favorNpc] = (st.npcFavor[step.favorNpc] || 0) + step.favor; }
          renderStatus(); save(st);
          if (step.fx !== false) {
            var _sc = document.getElementById('scene') || document.getElementById('app') || document.body;
            if (_sc) { _sc.classList.remove('fx-whip'); void _sc.offsetWidth; _sc.classList.add('fx-whip'); setTimeout(function(){ _sc.classList.remove('fx-whip'); }, 950); }
            try {
              var _fl = document.createElement('div'); _fl.className = 'whip-float'; _fl.textContent = step.fxText || '鞭！';
              (document.getElementById('app') || document.body).appendChild(_fl);
              setTimeout(function(){ if (_fl.parentNode) _fl.parentNode.removeChild(_fl); }, 980);
            } catch (e) {}
          }
          next(); break;
        }
        case 'branch': { var ok = step.if ? testCond(step.if, env) : true; runSteps(ok ? (step.then || []) : (step.else || []), 0, next, env); break; }
        case 'graduate': graduate(); next(); break;
        case 'acceptQuest': if (acceptQuest) acceptQuest(step.id); next(); break;
        case 'completeQuest': if (completeQuest) completeQuest(step.id); next(); break;
        case 'consume': {
          var _pk = state.pack || []; var _id = step.id, _n = step.n || 1, _did = false;
          for (var _k = 0; _k < _pk.length; _k++) { if (_pk[_k] && (_pk[_k].defId || _pk[_k].id) === _id) { var _c = _pk[_k].count || 1; if (_c > _n) { _pk[_k].count = _c - _n; } else { _pk.splice(_k, 1); } _did = true; break; } }
          if (!_did) log('（行囊中并无「' + _id + '」）', 'sys');
          save(state); renderStatus(); next(); break;
        }
        default: next();
      }
    }
    function runTrigger(tr, env) {
      runSteps(tr.steps || [], 0, function () { markDone(tr); save(getState()); }, env);
    }
    function checkTriggers(env) {
      var handled = false, list = getTriggers();
      for (var i = 0; i < list.length; i++) {
        var tr = list[i];
        if (tr.hook && tr.hook !== env.hook) continue;
        if (isDone(tr)) continue;
        if (tr.room && tr.room !== env.room) continue;
        if (tr.npc && tr.npc !== env.npc) continue;
        if (tr.item && (!env.item || (env.item.defId || env.item.id) !== tr.item)) continue;  // 仅匹配指定物品（v20260910g 修复：石料任务不会被其他赠物累计）
        if (tr.roomIn && tr.roomIn.indexOf(env.room) < 0) continue;
        // 单元格/格型作用域（v20260909p）：生成城市内部同一房间下按网格坐标定位触发
        if (tr.cell) {
          var _cp = getState().flags && getState().flags.cityPos;
          if (!_cp || _cp.cid !== env.room || _cp.x !== tr.cell[0] || _cp.y !== tr.cell[1]) continue;
        }
        if (tr.cellType) {
          var _cp2 = getState().flags && getState().flags.cityPos;
          if (!_cp2 || _cp2.cid !== env.room) continue;
          var _c2 = (LF.Core && LF.Core.city);
          if (!_c2 || _c2.cellDisplayType(env.room, _cp2.x, _cp2.y) !== tr.cellType) continue;
        }
        if (tr.cond && !testCond(tr.cond, env)) continue;
        tr._npc = env.npc || tr.npc;
        runTrigger(tr, env);
        handled = true;
        if (env.hook === 'onTalk') break;   // 交谈类一次即可
      }
      onbGoal();   // 旗标可能随触发改变，刷新「当前目标」与高亮
      return handled;
    }
    function graduate(deferNote) {
      var state = getState();
      // 毕业衔接（v20260911h · P3）：脱籍出营 —— 营规（点卯 / 晚归受罚 / 口粮罚例）自此失效，
      //   但时间与作息照常流动（NPC 仍按时辰上下工、城门仍宵禁），世界不会为谁停下。
      //   deferNote=true 时不在此报信：调用方会在 renderRoom 落位之后统一输出，
      //   否则 renderRoom 开头的 flushNarr() 会把仍在排队中的这句清掉（玩家看不到）。
      if (!deferNote && state.flags && state.flags.onb && !state.flags.onb.done) {
        log('〔脱籍〕你已出营——点卯、晚归、口粮罚例一概不再管你；只是营中的钟点照旧，鼓声、作息、日头都不会为你停。', 'order');
      }
      if (state.flags && state.flags.onb) state.flags.onb.done = true;   // 教学链毕业：解锁 NPC 的观察/攻击等完整菜单
      document.body.classList.remove('onb');
      getOnbLayers().forEach(function (l) { document.body.classList.remove('reveal-' + l); });
      state.moveGate = null;
      renderMoveBar(G.ROOMS[state.room]); renderNpcList();
    }

    return { checkTriggers: checkTriggers, graduate: graduate };
  };
})();

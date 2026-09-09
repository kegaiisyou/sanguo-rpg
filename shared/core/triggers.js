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
        addXp = dep.addXp;

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
      runStep(arr[idx], function () { runSteps(arr, idx + 1, done, env); });
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
        case 'branch': { var ok = step.if ? testCond(step.if, env) : true; runSteps(ok ? (step.then || []) : (step.else || []), 0, next, env); break; }
        case 'graduate': graduate(); next(); break;
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
        if (tr.roomIn && tr.roomIn.indexOf(env.room) < 0) continue;
        if (tr.cond && !testCond(tr.cond, env)) continue;
        tr._npc = env.npc || tr.npc;
        runTrigger(tr, env);
        handled = true;
        if (env.hook === 'onTalk') break;   // 交谈类一次即可
      }
      onbGoal();   // 旗标可能随触发改变，刷新「当前目标」与高亮
      return handled;
    }
    function graduate() {
      var state = getState();
      if (state.flags && state.flags.onb) state.flags.onb.done = true;   // 教学链毕业：解锁 NPC 的观察/攻击等完整菜单
      document.body.classList.remove('onb');
      getOnbLayers().forEach(function (l) { document.body.classList.remove('reveal-' + l); });
      state.moveGate = null;
      renderMoveBar(G.ROOMS[state.room]); renderNpcList();
    }

    return { checkTriggers: checkTriggers, graduate: graduate };
  };
})();

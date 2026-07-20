// 乱世烽火 · H5 文字放置引擎
// 核心循环：历练(挂机收益) / 探索(随机事件) / 修炼(武学树) / 休整 / 离线收益
(function () {
  var G = window.LF.SharedGame;
  var Storage = window.LF.Storage;
  var BAL = G.BALANCE, C = G.CONSTANTS;

  // 载入或新建存档（门派加成仅新建时套用一次）
  var state = Storage.load();
  if (!state) { state = G.defaultSave(); G.applySect(state); }

  var $status = document.getElementById('status');
  var $log = document.getElementById('log');
  var $actions = document.getElementById('actions');
  var $panel = document.getElementById('panel');

  function log(text, cls) {
    var p = document.createElement('p');
    p.className = 'line ' + (cls || '');
    p.textContent = text;
    $log.appendChild(p);
    $log.scrollTop = $log.scrollHeight;
  }

  function addXp(n) {
    state.exp += n;
    while (state.exp >= BAL.expNeed(state.level) && state.level < C.MAX_LEVEL) {
      state.exp -= BAL.expNeed(state.level);
      state.level++;
      state.maxHp += 10; state.maxMp += 5; state.atk += 2; state.def += 1;
      state.hp = state.maxHp; state.mp = state.maxMp;
      log('【升级】你已至 LV.' + state.level + '！气血内力尽复，实力大增。', 'good');
    }
  }
  function addGold(n) { state.gold = Math.max(0, state.gold + n); }

  function applyEffect(e) {
    e = e || {};
    if (e.xp) addXp(e.xp);
    if (e.gold) addGold(e.gold);
    if (e.atk) state.atk += e.atk;
    if (e.def) state.def += e.def;
    if (e.maxMp) { state.maxMp += e.maxMp; state.mp += e.maxMp; }
    if (e.mp === 'full') state.mp = state.maxMp;
    else if (e.mp) state.mp = Math.min(state.maxMp, state.mp + e.mp);
    if (e.hp === 'full') state.hp = state.maxHp;
    else if (e.hp) state.hp = Math.min(state.maxHp, state.hp + e.hp);
    if (e.flag) state.flags[e.flag] = true;
  }

  function renderStatus() {
    var sectName = G.SECTS[state.sect] ? G.SECTS[state.sect].name : state.sect;
    $status.innerHTML =
      '<span>' + state.name + ' · ' + sectName + '</span>' +
      '<span>LV.' + state.level + '</span>' +
      '<span>修为 ' + state.exp + '/' + BAL.expNeed(state.level) + '</span>' +
      '<span>气血 ' + state.hp + '/' + state.maxHp + '</span>' +
      '<span>内力 ' + state.mp + '/' + state.maxMp + '</span>' +
      '<span>银两 ' + state.gold + '</span>';
  }

  function addBtn(label, fn, cls) {
    var b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.onclick = fn;
    $actions.appendChild(b);
  }

  function mainMenu() {
    $panel.innerHTML = '';
    $actions.innerHTML = '';
    addBtn('历练（挂机收益）', doTrain);
    addBtn('探索（随机事件）', doExplore);
    addBtn('修炼（武学）', doLearn);
    addBtn('休整（恢复）', doRest);
    addBtn('信息/存档', doInfo);
  }

  function doTrain() {
    var y = BAL.trainYield(state);
    applyEffect(y);
    log('【历练】部众操练一日，得修为 ' + y.xp + '、银两 ' + y.gold + '、内力 ' + y.mp + '。', 'act');
    after();
  }

  function doExplore() {
    var ev = G.EVENTS[Math.floor(Math.random() * G.EVENTS.length)];
    log('— ' + ev.title + ' —', 'evt');
    log(ev.text);
    $panel.innerHTML = '';
    ev.choices.forEach(function (ch) {
      var b = document.createElement('button');
      b.className = 'choice';
      b.textContent = ch.text;
      b.onclick = function () {
        if (ch.cost) {
          if (state.gold < (ch.cost.gold || 0)) { log('银两不足，无法行事。', 'sys'); return; }
          addGold(-(ch.cost.gold || 0));
        }
        applyEffect(ch.effect || {});
        log(ch.result, 'res');
        $panel.innerHTML = '';
        after();
      };
      $panel.appendChild(b);
    });
  }

  function doLearn() {
    $panel.innerHTML = '';
    log('【修炼】可选武学：', 'act');
    Object.keys(G.SKILLS).forEach(function (id) {
      var s = G.SKILLS[id];
      var owned = state.skills.indexOf(id) >= 0;
      var prereqOk = s.prereq.every(function (p) { return state.skills.indexOf(p) >= 0; });
      var b = document.createElement('button');
      b.className = 'choice';
      if (owned) {
        b.textContent = s.name + '（已修）'; b.disabled = true;
      } else if (!prereqOk) {
        b.textContent = s.name + '（需先修：' + s.prereq.map(function (p) { return G.SKILLS[p].name; }).join('、') + '）';
        b.disabled = true;
      } else {
        b.textContent = s.name + '（耗修为 ' + s.cost + '）';
        b.onclick = function () {
          if (state.exp < s.cost) { log('修为不足，无法修习 ' + s.name + '。', 'sys'); return; }
          state.exp -= s.cost; state.skills.push(id);
          applyEffect(s.effect);
          log('【习得】' + s.name + '！' + s.desc, 'good');
          $panel.innerHTML = ''; after();
        };
      }
      $panel.appendChild(b);
    });
  }

  function doRest() {
    state.hp = state.maxHp; state.mp = state.maxMp;
    log('【休整】你于营中歇息，气血内力尽复。', 'act');
    after();
  }

  function doInfo() {
    $panel.innerHTML = '';
    log('— 角色信息 —');
    log('门派：' + G.SECTS[state.sect].name);
    log('已习武学：' + (state.skills.map(function (id) { return G.SKILLS[id].name; }).join('、') || '无'));
    var b = document.createElement('button'); b.className = 'choice';
    b.textContent = '清空存档重来';
    b.onclick = function () { Storage.clear(); location.reload(); };
    $panel.appendChild(b);
    var b2 = document.createElement('button'); b2.className = 'choice';
    b2.textContent = '返回';
    b2.onclick = function () { $panel.innerHTML = ''; };
    $panel.appendChild(b2);
  }

  function after() {
    state.lastSeen = Date.now();
    Storage.save(state);
    renderStatus();
  }

  // 离线收益结算
  var now = Date.now();
  if (state.lastSeen) {
    var off = BAL.offlineGain(state, now);
    if (off.xp > 0 || off.gold > 0) {
      applyEffect({ xp: off.xp, gold: off.gold });
      log('【离线收益】你离去 ' + off.minutes + ' 分钟，部众替你操练，得修为 ' + off.xp + '、银两 ' + off.gold + '。', 'sys');
    }
  }

  // 序幕
  G.DIALOGUES.prologue.forEach(function (l) { log(l, 'prologue'); });
  log('— 颍川起兵 —', 'evt');
  renderStatus();
  mainMenu();

  window.addEventListener('beforeunload', function () { state.lastSeen = Date.now(); Storage.save(state); });
})();

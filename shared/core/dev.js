// 乱世烽火 · 调试台（v20260910b 精简版）
// 从 engine.js 抽离：handleDev（调试动作分发）/ renderDev（调试面板渲染）。
window.LF = window.LF || {};
(function () {
  LF.Core = LF.Core || {};

  LF.createDev = function (ctx) {
    var G = ctx.G, LF = ctx.LF;
    var getState = ctx.getState, getCard = ctx.getCard, getModal = ctx.getModal,
        getCurrentModalKind = ctx.getCurrentModalKind;

    function handleDev(act) {
      var MA = G.MARTIAL_ARTS;
      var state = getState();
      if (act === 'rep100') { state.reputation = 100; ctx.log('【声望】已设为 100（' + ctx.repTitle(100) + '）', 'good'); }
      else if (act === 'rep0') { state.reputation = 0; ctx.log('【声望】已清零', 'sys'); }
      else if (act === 'allmartial') {
        var got = 0;
        for (var k in MA) { var a = MA[k]; if (!a || !a.id) continue;
          if (a.type === 'technique') { if (state.equippedForce.indexOf(a.id) < 0) { state.equippedForce.push(a.id); got++; } }
          else { if (state.learnedMartial.indexOf(a.id) < 0) { state.learnedMartial.push(a.id); got++; } }
        }
        ctx.log('【满配】已习得全部招式并装配全部发力技巧（新增 ' + got + ' 项）', 'good');
      }
      else if (act === 'maxlv') {
        state.level = G.CONSTANTS.MAX_LEVEL; state.hp = state.maxHp; state.mp = state.maxMp;
        ctx.log('【速填】等级设为 ' + state.level + '，状态回满', 'good');
      }
      else if (act === 'pot+200') { state.pot += 200; ctx.log('【速填】潜能 +200（当前 ' + state.pot + '）', 'good'); }
      else if (act === 'fp+10') { state.freePoints = (state.freePoints||0) + 10; ctx.log('【速填】自由属性点 +10（当前 ' + state.freePoints + '）', 'good'); }
      else if (act === 'gold+500') { state.gold += 500; ctx.log('【速填】银两 +500（当前 ' + state.gold + '）', 'good'); }
      else if (act === 'full') { var esF = ctx.effectiveStats(); state.hp = esF.maxHp; state.mp = esF.maxMp; state.energy = state.maxEnergy; state.food = state.maxFood; state.drink = state.maxDrink; ctx.log('【速填】气血/内力/精力/饥渴 全满', 'good'); }
      else if (act === 'mkgear') { var eq = LF.ITEMS.rollEquip(3); ctx.packAdd(LF.ITEMS.equipToPackItem(eq)); ctx.save(state); renderDev(); ctx.toast('夺得 ' + eq.name); }
      else if (act === 'cha+10') { state.chivalry += 10; ctx.log('【调试】侠义 +10（当前 ' + state.chivalry + '）', 'good'); }
      else if (act === 'not+10') { state.notoriety += 10; ctx.log('【调试】凶名 +10（当前 ' + state.notoriety + '）', 'good'); }
      else if (act === 'moral0') { state.chivalry = 0; state.notoriety = 0; ctx.log('【调试】善恶双轴清零', 'sys'); }
      else if (act === 'spawnNow') {
        if (!state.spawnRoom) { ctx.toast('尚未设置出生点'); return; }
        ctx.closeModal();
        ctx.renderRoom(state.spawnRoom);
        var _sn = ((LF.CITIES || {})[state.spawnRoom] ? LF.CITIES[state.spawnRoom].name
          : ((((LF.MAP && LF.MAP.specialGeo) || {})[state.spawnRoom] || G.ROOMS[state.spawnRoom] || {}).name || state.spawnRoom));
        ctx.log('已传送到出生点：' + _sn, 'good');
      }
      else if (act === 'skipOnb') {
        if (state.flags && state.flags.onb) state.flags.onb.done = true;
        document.body.classList.remove('onb');
        ctx.log('【调试】已跳过新手教程，解锁全部功能', 'good');
      }
      else if (act === 'resetStone') {
        if (state.flags) {
          delete state.flags.task;
        }
        ctx.log('【调试】已重置采石充仓任务', 'sys');
      }
      else if (act === 'time+1') {
        state.time = (state.time + 1) % 12;
        state.clock = (state.clock + 120) % 1440;
        ctx.log('【调试】时辰推进至：' + (['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][state.time%12]) + '时', 'sys');
      }
      else if (act === 'item_stone') { ctx.packAdd('shitiao', 10); ctx.log('【调试】获得石料×10', 'good'); }
      else if (act === 'item_wood') { ctx.packAdd('mucai', 10); ctx.log('【调试】获得木材×10', 'good'); }
      else if (act === 'item_yao') { ctx.packAdd('jinchuangyao', 5); ctx.log('【调试】获得金疮药×5', 'good'); }
      else if (act === 'showFlags') {
        var flags = [];
        function walk(obj, prefix) {
          for (var k in obj) {
            var v = obj[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, prefix + k + '.'); }
            else if (v !== undefined && v !== null) { flags.push(prefix + k + ' = ' + JSON.stringify(v)); }
          }
        }
        if (state.flags) walk(state.flags, '');
        ctx.log('【当前旗标】\n' + (flags.length ? flags.join('\n') : '（无）'), 'sys');
      }
    }

    function renderDev() {
      var state = getState();
      var $card = getCard(), $modal = getModal();
      state.faction = state.faction || '义军';

      function spawnNameOf(s) {
        if (!s) return '未设置';
        if ((LF.CITIES || {})[s]) return LF.CITIES[s].name + '（城）';
        var _sg = ((LF.MAP && LF.MAP.specialGeo) || {})[s]; if (_sg) return _sg.name;
        var _r = G.ROOMS[s]; if (_r && _r.name) return _r.name;
        return s;
      }

      var h = '<h3>🛠 调 试 台 <span class="dev-sub">v' + LF.CONSTANTS.VERSION + '</span></h3>';

      // 1. 传送
      h += '<div class="dev-sec"><div class="dev-h">🚀 传送（当前出生点：' + spawnNameOf(state.spawnRoom) + '）</div><div class="dev-btns">' +
         '<button class="dev wide" data-act="setspawn">🗺 地图选出生点</button>' +
         '<button class="dev wide" data-act="spawnNow">⤵ 传送至出生点</button></div></div>';

      // 2. 速填
      h += '<div class="dev-sec"><div class="dev-h">💰 速填（银两 ' + state.gold + ' · 潜能 ' + state.pot + ' · 自由点 ' + (state.freePoints||0) + '）</div><div class="dev-btns">' +
         '<button class="dev" data-act="gold+500">银两+500</button>' +
         '<button class="dev" data-act="pot+200">潜能+200</button>' +
         '<button class="dev" data-act="fp+10">属性点+10</button>' +
         '<button class="dev" data-act="full">回满状态</button>' +
         '<button class="dev" data-act="maxlv">满级</button>' +
         '<button class="dev" data-act="allmartial">满配武学</button>' +
         '<button class="dev" data-act="mkgear">掉件装备</button></div>' +
         // 经验值精确输入
         '<div class="dev-btns" style="margin-top:6px;">' +
         '<input type="number" id="dev-xp-input" class="dev-input" placeholder="输入经验值" value="50" min="1">' +
         '<button class="dev" id="dev-xp-btn">获得经验</button>' +
         '<span class="dev-tip" style="margin-left:8px;">当前经验 ' + state.exp + ' / 升级需 ' + (state.level>=G.CONSTANTS.MAX_LEVEL?'已满':G.BALANCE.expNeed(state.level)) + '</span></div></div>';

      // 3. 角色善恶
      h += '<div class="dev-sec"><div class="dev-h">🎭 角色（侠义 ' + state.chivalry + ' · 凶名 ' + state.notoriety + ' · ' + ctx.moralTitle() + '）</div><div class="dev-btns">' +
         '<button class="dev" data-act="cha+10">侠义+10</button>' +
         '<button class="dev" data-act="not+10">凶名+10</button>' +
         '<button class="dev" data-act="moral0">善恶清零</button>' +
         '<button class="dev" data-act="rep100">声望=100</button></div></div>';

      // 4. 任务
      h += '<div class="dev-sec"><div class="dev-h">📜 任务调试</div><div class="dev-btns">' +
         '<button class="dev" data-act="skipOnb">跳过新手教程</button>' +
         '<button class="dev" data-act="resetStone">重置采石任务</button>' +
         '<button class="dev" data-act="showFlags">查看当前旗标</button></div></div>';

      // 5. 时间
      h += '<div class="dev-sec"><div class="dev-h">⏰ 时间（当前：' + (['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][state.time%12]) + '时）</div><div class="dev-btns">' +
         '<button class="dev" data-act="time+1">时辰+1</button></div></div>';

      // 6. 物品
      h += '<div class="dev-sec"><div class="dev-h">🎒 获得物品</div><div class="dev-btns">' +
         '<button class="dev" data-act="item_stone">石料×10</button>' +
         '<button class="dev" data-act="item_wood">木材×10</button>' +
         '<button class="dev" data-act="item_yao">金疮药×5</button></div></div>';

      h += '<button class="close" id="m-close">收 起</button>';
      $card.innerHTML = h;
      $modal.classList.remove('hidden');

      $card.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.onclick = function () {
          var a = btn.getAttribute('data-act');
          if (a === 'setspawn') { ctx.openSpawnMap(); return; }
          handleDev(a); ctx.save(state); ctx.renderStatus();
          if (getCurrentModalKind() !== 'char') renderDev();
        };
      });

      // 经验值精确获得
      var xpBtn = document.getElementById('dev-xp-btn');
      if (xpBtn) xpBtn.onclick = function () {
        var input = document.getElementById('dev-xp-input');
        var val = parseInt(input ? input.value : '0', 10);
        if (val > 0) {
          ctx.addXp(val);
          ctx.log('【调试】获得经验 +' + val, 'good');
          ctx.save(state); ctx.renderStatus();
          renderDev();
        }
      };

      var c = document.getElementById('m-close'); if (c) c.onclick = ctx.closeModal;
    }

    return { handleDev: handleDev, renderDev: renderDev };
  };
})();

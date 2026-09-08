// 乱世烽火 · 调试台（v20260908g）
// 从 engine.js 抽离：handleDev（调试动作分发）/ renderDev（调试面板渲染）。
// 不读任何 window 裸全局——引擎依赖经 LF.createDev(ctx) 注入，与 engine.js 解耦。
window.LF = window.LF || {};
(function () {
  LF.Core = LF.Core || {};

  // ctx 依赖（引擎注入）：
  //   G, LF                  —— SharedGame / 全局命名空间
  //   getState()             —— 实时 state（存活期对象，可直改其字段）
  //   getCard()/getModal()   —— 弹窗 DOM（存活期元素）
  //   getCurrentModalKind()  —— 当前弹窗种类
  //   addReputation/repTitle/log/addXp/isCityGrid/isCaptured/cityDefaultOwner/
  //   burnCells/effectiveStats/closeModal/renderRoom/openSpawnMap/moralTitle/
  //   factionName/renderStatus/toast/packAdd/save —— 引擎函数引用
  LF.createDev = function (ctx) {
    var G = ctx.G, LF = ctx.LF;
    var getState = ctx.getState, getCard = ctx.getCard, getModal = ctx.getModal,
        getCurrentModalKind = ctx.getCurrentModalKind;

    function handleDev(act) {
      var MA = G.MARTIAL_ARTS;
      var state = getState();
      if (act === 'rep+5') { ctx.addReputation(5); }
      else if (act === 'rep20') { state.reputation = 20; ctx.log('【声望】已设为 20（' + ctx.repTitle(20) + '）', 'good'); }
      else if (act === 'rep100') { state.reputation = 100; ctx.log('【声望】已设为 100（' + ctx.repTitle(100) + '）', 'good'); }
      else if (act === 'rep0') { state.reputation = 0; ctx.log('【声望】已清零', 'sys'); }
      else if (act.indexOf('skill:') === 0) {
        var id = act.slice(6); var a = MA.get(id);
        var i = state.learnedMartial.indexOf(id);
        if (i >= 0) { state.learnedMartial.splice(i, 1); ctx.log('移除招式：' + (a ? a.name : id), 'sys'); }
        else { state.learnedMartial.push(id); ctx.log('习得招式：' + (a ? a.name : id), 'good'); }
      }
      else if (act.indexOf('force:') === 0) {
        var fid = act.slice(6); var fa = MA.get(fid);
        var fi = state.equippedForce.indexOf(fid);
        if (fi >= 0) { state.equippedForce.splice(fi, 1); ctx.log('卸下发力技巧：' + (fa ? fa.name : fid), 'sys'); }
        else { state.equippedForce.push(fid); ctx.log('装配发力技巧：' + (fa ? fa.name : fid), 'good'); }
      }
      else if (act === 'allmartial') {
        var got = 0;
        for (var k in MA) { var a = MA[k]; if (!a || !a.id) continue;
          if (a.type === 'technique') { if (state.equippedForce.indexOf(a.id) < 0) { state.equippedForce.push(a.id); got++; } }
          else { if (state.learnedMartial.indexOf(a.id) < 0) { state.learnedMartial.push(a.id); got++; } }
        }
        ctx.log('【满配】已习得全部招式并装配全部发力技巧（新增 ' + got + ' 项）', 'good');
      }
      else if (act === 'lines+5') {
        for (var l in state.lines) state.lines[l] = Math.min(20, state.lines[l] + 5);
        ctx.log('【艺线】全部武器艺线 +5（上限20）', 'good');
      }
      else if (act === 'realm+1') {
        var n = 0;
        state.learnedMartial.forEach(function (id) {
          var a = MA.get(id); if (a && a.type !== 'technique') { state.realm[id] = Math.min(6, (state.realm[id] || 0) + 1); n++; }
        });
        ctx.log('【境界】已学招式境界全部 +1（' + n + ' 式）。突破效果现已生效：伤害/暴击/破甲/连击随境界提升。', 'good');
      }
      else if (act === 'maxlv') {
        state.level = G.CONSTANTS.MAX_LEVEL; state.hp = state.maxHp; state.mp = state.maxMp;
        ctx.log('【速填】等级设为 ' + state.level + '，状态回满', 'good');
      }
      else if (act === 'pot+200') { state.pot += 200; ctx.log('【速填】潜能 +200（当前 ' + state.pot + '）', 'good'); }
      else if (act === 'gold+500') { state.gold += 500; ctx.log('【速填】银两 +500（当前 ' + state.gold + '）', 'good'); }
      else if (act === 'full') { var esF = ctx.effectiveStats(); state.hp = esF.maxHp; state.mp = esF.maxMp; state.energy = state.maxEnergy; state.food = state.maxFood; state.drink = state.maxDrink; ctx.log('【速填】气血/内力/精力/饥渴 全满', 'good'); }
      else if (act === 'mkgear') { var eq = LF.ITEMS.rollEquip(3); ctx.packAdd(LF.ITEMS.equipToPackItem(eq)); ctx.save(state); renderDev(); ctx.toast('夺得 ' + eq.name); }
      // ── 等级 / 身份势力 / 城市 调试（v20260827）──
      else if (act === 'xp+200') { ctx.addXp(200); }
      else if (act === 'dev-capture') {
        state.faction = state.faction || '义军';
        var cp = state.flags.cityPos; if (!cp || !ctx.isCityGrid(cp.cid)) { ctx.toast('你不在城中（立于中枢方能占城）'); return; }
        var cid = cp.cid;
        if (ctx.isCaptured(cid)) { ctx.toast('「' + (LF.CITIES[cid] ? LF.CITIES[cid].name : cid) + '」已是你的领地'); return; }
        if (!state.flags.cityOwner) state.flags.cityOwner = {};
        state.ruledCities = state.ruledCities || [];
        state.flags.cityOwner[cid] = state.faction;
        if (state.ruledCities.indexOf(cid) < 0) state.ruledCities.push(cid);
        var _tier = (LF.CITIES[cid] || {}).tier || 'xian';
        var _tt = _tier === 'capital' ? '君主' : _tier === 'zhou' ? '州牧' : '太守';
        if (LF.TITLES.indexOf(_tt) > LF.TITLES.indexOf(state.title)) state.title = _tt;
        ctx.log('【调试】已占领「' + (LF.CITIES[cid] ? LF.CITIES[cid].name : cid) + '」，授官「' + state.title + '」', 'good');
        ctx.renderStatus();
      }
      else if (act === 'dev-release') {
        var cp = state.flags.cityPos; if (!cp) { ctx.toast('你不在城中'); return; }
        var cid = cp.cid;
        state.flags.cityOwner[cid] = ctx.cityDefaultOwner(cid);
        state.ruledCities = state.ruledCities || [];
        var _idx = state.ruledCities.indexOf(cid); if (_idx >= 0) state.ruledCities.splice(_idx, 1);
        var _best = '游侠';
        state.ruledCities.forEach(function (rc) { var t = (LF.CITIES[rc] || {}).tier || 'xian'; var tt = t === 'capital' ? '君主' : t === 'zhou' ? '州牧' : '太守'; if (LF.TITLES.indexOf(tt) > LF.TITLES.indexOf(_best)) _best = tt; });
        state.title = _best;
        ctx.log('【调试】已释放「' + (LF.CITIES[cid] ? LF.CITIES[cid].name : cid) + '」', 'sys');
        ctx.renderStatus();
      }
      else if (act === 'dev-citydev') {
        var cp = state.flags.cityPos; if (!cp) { ctx.toast('你不在城中'); return; }
        if (!state.flags.cityDev) state.flags.cityDev = {};
        state.flags.cityDev[cp.cid] = Math.min(100, (state.flags.cityDev[cp.cid] || 0) + 20);
        ctx.log('【调试】' + cp.cid + ' 建设度→' + (state.flags.cityDev[cp.cid]), 'good');
      }
      else if (act === 'dev-burn') {
        var cp = state.flags.cityPos; if (!cp) { ctx.toast('你不在城中'); return; }
        ctx.burnCells(cp.cid, 3);
        ctx.log('【调试】' + cp.cid + ' 焚城（随机3格）', 'sys');
      }
      // ── P3 善恶双轴调试 ──
      else if (act === 'cha+10') { state.chivalry += 10; ctx.log('【调试】侠义 +10（当前 ' + state.chivalry + '）', 'good'); }
      else if (act === 'not+10') { state.notoriety += 10; ctx.log('【调试】凶名 +10（当前 ' + state.notoriety + '）', 'good'); }
      else if (act === 'moral0') { state.chivalry = 0; state.notoriety = 0; state.flags.usurper_seen = false; ctx.log('【调试】善恶双轴清零', 'sys'); }
      else if (act === 'spawnNow') {
        if (!state.spawnRoom) { ctx.toast('尚未设置出生点'); return; }
        ctx.closeModal();
        ctx.renderRoom(state.spawnRoom);
        var _sn = ((LF.CITIES || {})[state.spawnRoom] ? LF.CITIES[state.spawnRoom].name
          : ((((LF.MAP && LF.MAP.specialGeo) || {})[state.spawnRoom] || G.ROOMS[state.spawnRoom] || {}).name || state.spawnRoom));
        ctx.log('已传送到出生点：' + _sn, 'good');
      }
    }

    function renderDev() {
      var MA = G.MARTIAL_ARTS;
      var state = getState();
      var $card = getCard(), $modal = getModal();
      state.faction = state.faction || '义军';
      var rep = state.reputation, fp = (state.freePoints || 0);
      var facOpts = Object.keys(LF.FACTIONS).map(function (f) {
        var val = (f === 'player') ? '义军' : f;  // 玩家势力在存档中以 '义军' 存储，下拉值与之对齐
        return '<option value="' + val + '"' + (val === state.faction ? ' selected' : '') + '>' + LF.FACTIONS[f].name + '</option>';
      }).join('');
      var titleOpts = LF.TITLES.map(function (t) {
        return '<option value="' + t + '"' + (t === state.title ? ' selected' : '') + '>' + t + '</option>';
      }).join('');
      var cityName = (state.flags.cityPos && LF.CITIES[state.flags.cityPos.cid]) ? LF.CITIES[state.flags.cityPos.cid].name : (state.flags.cityPos ? state.flags.cityPos.cid : '不在城');
      // 出生点名解析：城市 / 手写特殊锚点 / 程序生成地点房 三种来源兼容
      function spawnNameOf(s) {
        if (!s) return '未设置';
        if ((LF.CITIES || {})[s]) return LF.CITIES[s].name + '（城）';
        var _sg = ((LF.MAP && LF.MAP.specialGeo) || {})[s]; if (_sg) return _sg.name;
        var _r = G.ROOMS[s]; if (_r && _r.name) return _r.name;
        return s;
      }
      var h = '<h3>🛠 调 试 台 <span class="dev-sub">v' + LF.CONSTANTS.VERSION + '</span></h3>';
      // 出生点（最常用 → 置顶）
      h += '<div class="dev-sec"><div class="dev-h">出生点（当前：' + spawnNameOf(state.spawnRoom) + '）</div><div class="dev-btns">' +
         '<button class="dev wide" data-act="setspawn">🗺 地图选出生点</button>' +
         '<button class="dev wide" data-act="spawnNow">⤵ 传送至出生点</button></div>' +
         '<p class="dev-tip">新档开局落点。城市出生落在城门，点击后立即传送验证。默认洛阳。</p></div>';
      // 资源
      h += '<div class="dev-sec"><div class="dev-h">资源（声望 ' + rep + ' · 银两 ' + state.gold + ' · 潜能 ' + state.pot + ' · 自由点 ' + fp + '）</div><div class="dev-btns">' +
         '<button class="dev" data-act="rep+5">声望+5</button><button class="dev" data-act="rep100">声望=100</button>' +
         '<button class="dev" data-act="gold+500">银两+500</button><button class="dev" data-act="pot+200">潜能+200</button>' +
         '<button class="dev" data-act="xp+200">经验+200</button><button class="dev" data-act="full">回满状态</button></div></div>';
      // 善恶
      h += '<div class="dev-sec"><div class="dev-h">善恶双轴（侠义 ' + state.chivalry + ' · 凶名 ' + state.notoriety + ' · ' + ctx.moralTitle() + '）</div><div class="dev-btns">' +
         '<button class="dev" data-act="cha+10">侠义+10</button><button class="dev" data-act="not+10">凶名+10</button><button class="dev" data-act="moral0">清零</button></div></div>';
      // 身份 / 势力（含名城占领、官职）
      h += '<div class="dev-sec"><div class="dev-h">身份 / 势力（当前：' + ctx.factionName(state.faction) + ' · ' + state.title + '）</div>' +
         '<div class="dev-btns"><select id="dev-fac" class="dev-sel">' + facOpts + '</select><select id="dev-title" class="dev-sel">' + titleOpts + '</select></div>' +
         '<div class="dev-btns"><button class="dev" data-act="dev-capture">占领所在城</button><button class="dev" data-act="dev-release">释放所在城</button></div></div>';
      // 武学
      h += '<div class="dev-sec"><div class="dev-h">武学招式（点击 学/弃）</div><div class="dev-btns">';
      for (var k in MA) { var a = MA[k]; if (!a || !a.id || a.type === 'technique') continue;
        var owned = state.learnedMartial.indexOf(a.id) >= 0;
        h += '<button class="dev' + (owned ? ' on' : '') + '" data-act="skill:' + a.id + '">' + (owned ? '✓ ' : '+ ') + a.name + '</button>';
      }
      h += '</div></div>';
      h += '<div class="dev-sec"><div class="dev-h">发力技巧（点击 装配/卸下）</div><div class="dev-btns">';
      for (var k2 in MA) { var a2 = MA[k2]; if (!a2 || !a2.id || a2.type !== 'technique') continue;
        var on = state.equippedForce.indexOf(a2.id) >= 0;
        h += '<button class="dev' + (on ? ' on' : '') + '" data-act="force:' + a2.id + '">' + (on ? '✓ ' : '+ ') + a2.name + '</button>';
      }
      h += '</div><div class="dev-btns"><button class="dev wide" data-act="allmartial">⚡ 一键满配武学</button></div></div>';
      // 突破
      h += '<div class="dev-sec"><div class="dev-h">艺线 / 境界（突破增强战力）</div><div class="dev-btns">' +
         '<button class="dev" data-act="lines+5">全艺线+5</button><button class="dev" data-act="realm+1">全境界+1</button></div></div>';
      // 角色速填
      h += '<div class="dev-sec"><div class="dev-h">角色速填</div><div class="dev-btns">' +
         '<button class="dev" data-act="maxlv">满级(设等级)</button><button class="dev" data-act="mkgear">掉件装备</button></div></div>';
      // 城市
      h += '<div class="dev-sec"><div class="dev-h">城市（当前：' + cityName + '）</div><div class="dev-btns">' +
         '<button class="dev" data-act="dev-citydev">建设+20</button><button class="dev" data-act="dev-burn">焚城(随机3格)</button></div></div>';
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
      var c = document.getElementById('m-close'); if (c) c.onclick = ctx.closeModal;
      var fsel = document.getElementById('dev-fac'); if (fsel) { fsel.onchange = function () { state.faction = fsel.value; ctx.log('【调试】势力→' + ctx.factionName(state.faction), 'sys'); ctx.renderStatus(); renderDev(); }; }
      var tsel = document.getElementById('dev-title'); if (tsel) { tsel.onchange = function () { state.title = tsel.value; ctx.renderStatus(); renderDev(); }; }
    }

    return { handleDev: handleDev, renderDev: renderDev };
  };
})();

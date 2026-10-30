// 乱世烽火 · 调试台（v20260910b 精简版）
// 从 engine.js 抽离：handleDev（调试动作分发）/ renderDev（调试面板渲染）。
window.LF = window.LF || {};
(function () {
  LF.Core = LF.Core || {};

  LF.createDev = function (ctx) {
    var G = ctx.G, LF = ctx.LF;
    var getState = ctx.getState, getCard = ctx.getCard, getModal = ctx.getModal,
        getCurrentModalKind = ctx.getCurrentModalKind;

    // v20261017d · 演武场：调试台视图切换（'main' 调试台 / 'arena' 敌人清单）
    var devView = 'main';
    // 主要敌人分组清单（id 取自 shared/data/enemies.js）
    var ARENA_GROUPS = [
      { name: '🥋 教学 · 苦役营', ids: ['camp_dummy', 'camp_guard', 'diyunzhou'] },
      { name: '⛰ 山贼匪类', ids: ['bandit', 'bandit_chief', 'heishan_zei', 'heishan_zhu'] },
      { name: '✊ 太平道', ids: ['yellow_turban', 'yth_intercept'] },
      { name: '⚔ 官军 · 名将', ids: ['city_guard', 'hua_xiong'] },
      { name: '🐾 郊野猛兽', ids: ['stray_dog', 'hungry_refugee', 'deserter', 'wild_wolf', 'wild_boar',
        'venom_snake', 'black_bear', 'goshawk', 'python', 'snow_wolf', 'mad_bull', 'wolf_pack', 'tiger'] },
      { name: '🌟 试炼', ids: ['dummy', 'lucky_star'] }
    ];

    function handleDev(act) {
      var MA = G.MARTIAL_ARTS;
      var state = getState();
      if (act === 'rep100') { state.reputation = 100; ctx.log('【声望】已设为 100（' + ctx.repTitle(100) + '）', 'good'); }
      else if (act === 'rep0') { state.reputation = 0; ctx.log('【声望】已清零', 'sys'); }
      else if (act === 'toggleFog') { state.flags=state.flags||{}; var nf=!(state.flags.fog!==false); state.flags.fog=nf; ctx.log('【调试】迷雾 '+(nf?'开（仅显示已探索）':'关（全显）'),'sys'); }
      else if (act === 'toggleGated') { state.flags=state.flags||{}; var ng=!(state.flags.mapGated!==false); state.flags.mapGated=ng; ctx.log('【调试】地图门槛 '+(ng?'开（需探索/舆图）':'关（视作已持舆图）'),'sys'); }
      else if (act === 'maxlv') {
        state.level = G.CONSTANTS.MAX_LEVEL; state.hp = state.maxHp; state.mp = state.maxMp;
        ctx.log('【速填】等级设为 ' + state.level + '，状态回满', 'good');
      }
      else if (act === 'pot+200') { state.pot += 200; ctx.log('【速填】潜能 +200（当前 ' + state.pot + '）', 'good'); }
      else if (act === 'fp+10') { state.freePoints = (state.freePoints||0) + 10; ctx.log('【速填】自由属性点 +10（当前 ' + state.freePoints + '）', 'good'); }
      else if (act === 'gold+500') { state.gold += 500; ctx.log('【速填】银两 +500（当前 ' + state.gold + '）', 'good'); }
      else if (act === 'full') { var esF = ctx.effectiveStats(); state.hp = esF.maxHp; state.mp = esF.maxMp; state.energy = state.maxEnergy; state.food = state.maxFood; state.drink = state.maxDrink; ctx.log('【速填】气血/内力/精力/饥渴 全满', 'good'); }
      else if (act === 'mkgear') { var eq = LF.ITEMS.rollEquip(3); ctx.packAdd(LF.ITEMS.equipToPackItem(eq)); ctx.save(state); renderDev(); ctx.toast('夺得 ' + eq.name); }
      else if (act === 'mkbag') {   // v20261024l：掉一件背包扩容类装备（slot=bag，便于调试背包容量）
        var bags = Object.keys(LF.ITEMS.DEFS||{}).map(function(k){return LF.ITEMS.DEFS[k];}).filter(function(d){ return d.cat==='装备' && d.slot==='bag'; });
        if (!bags.length) { ctx.toast('暂无背囊类装备'); return; }
        var db = bags[Math.floor(Math.random()*bags.length)];
        ctx.packAdd(LF.ITEMS.makeItem(db.defId, 1)); ctx.save(state); renderDev();
        ctx.toast('夺得 ' + db.name + '（装备后背包 +' + (db.packSpace||0) + ' 格）');
      }
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
          delete state.flags['trg.kyl_stone_accept'];
        }
        if (state.quests) { var _si = state.quests.findIndex(function (q) { return q.id === 'stone'; }); if (_si >= 0) state.quests.splice(_si, 1); }
        if (state.questsDone) { var _di = state.questsDone.findIndex(function (q) { return q.id === 'stone'; }); if (_di >= 0) state.questsDone.splice(_di, 1); }
        if (state.trackingQuest === 'stone') state.trackingQuest = null;
        // 关闭可能残留的对话选项面板
        var tut = document.getElementById('tut-choices');
        if (tut) tut.remove();
        ctx.log('【调试】已重置采石充仓任务（含接任务标记）', 'sys');
      }
      else if (act === 'time+1') {
        state.time = (state.time + 1) % 12;
        state.clock = (state.clock + 120) % 1440;
        ctx.log('【调试】时辰推进至：' + (['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][state.time%12]) + '时', 'sys');
      }
      else if (act === 'item_stone') { ctx.packAdd('shitiao', 10); ctx.log('【调试】获得石料×10', 'good'); }
      else if (act === 'item_wood') { ctx.packAdd('mucai', 10); ctx.log('【调试】获得木材×10', 'good'); }
      // v20260915g：原写作 jinchuangyao，items.js 里并无此 id（正确为 jinchuang）→ makeItem 返回 null，
      //   调试按钮点了毫无反应。这也是「凡入包的物先查登记表」的道理。
      else if (act === 'item_yao') { ctx.packAdd('jinchuang', 5); ctx.log('【调试】获得金疮药×5', 'good'); }
      else if (act === 'item_tiequan') { ctx.packAdd({ defId: 'tiequan_pu', count: 1 }); ctx.log('【调试】获得 铁拳拳谱×1 —— 行囊中研读可习得外功「铁拳」', 'good'); }
      // v20261018n：系统武学秘籍（玄阴真经）——研读开启技能树
      else if (act === 'item_xuanyin') { ctx.packAdd({ defId: 'xuanyin_jing', count: 1 }); ctx.log('【调试】获得 玄阴真经×1 —— 行囊中研读得总纲，武学录以技能树逐招解锁', 'good'); }

      else if (act === 'grind') {
        // 捣药（v20261017b 正式化）：调试台直接打开配药台工作台（等价店主视角）
        var _gr = LF.Grinding || (LF.Grinding = LF.createGrinding({
          getState: getState, packAdd: ctx.packAdd, packConsume: ctx.packConsume,
          packFind: ctx.packFind, toast: ctx.toast,
          log: ctx.log, save: ctx.save, renderStatus: ctx.renderStatus
        }));
        _gr.openGrindBench('city', { shopOwner: true });
      }
      // v20261017d · 演武场：进清单 / 返回 / 点敌开战
      else if (act === 'arena') { devView = 'arena'; renderDev(); }
      else if (act === 'arena_back') { devView = 'main'; renderDev(); }
      else if (act.indexOf('arena_') === 0) {
        var _eid = act.slice(6);
        if (!(G.ENEMIES || {})[_eid]) { ctx.toast('查无此敌：' + _eid); return; }
        ctx.closeModal();
        document.body.classList.remove('in-combat');   // 清可能残留的战斗态
        var _app = document.getElementById('app'); if (_app) _app.classList.remove('in-combat');
        ctx.log('【演武场】迎战：' + (G.ENEMIES[_eid].title ? '「' + G.ENEMIES[_eid].title + '」' : '') + G.ENEMIES[_eid].name, 'good');
        ctx.startCombat(_eid);
      }
      else if (act === 'demoDeath') { if (ctx.getDie) ctx.getDie()('演示 · 气血枯尽'); }
      else if (act === 'age+10') { var st=getState(); st.age=(st.age||18)+10; ctx.log('【调试】年龄 +10 → '+st.age+' 岁', 'sys'); }
      else if (act === 'demoAge') { var st=getState(); st.age=ctx.lifespanOf(); if (ctx.getDie) ctx.getDie()('寿终正寝 · 年华已尽'); }
      else if (act === 'martial_stall') { window.openModal('martial_stall'); }
      else if (act === 'bf_field') { window.openBattlefieldDebug('field'); }
      else if (act === 'bf_siege') { window.openBattlefieldDebug('siege'); }
      // v20260924z17：原「查看当前旗标」按钮已移除 —— walk() 对 state.flags 做无保护的递归遍历，
      //   旗标里一旦出现环引用（或嵌套极深）就会无限递归，点一下页面直接卡死。
    }

    function renderDev() {
      var state = getState();
      var $card = getCard(), $modal = getModal();
      state.faction = state.faction || '义军';

      // v20261017d · 演武场视图
      if (devView === 'arena') { renderArena(); return; }

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
         '<button class="dev" data-act="mkgear">掉件装备</button>' +
         '<button class="dev" data-act="mkbag">掉件背囊</button></div>' +
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
         '<button class="dev" data-act="rep100">声望=100</button>'+
         '<button class="dev" data-act="demoDeath">⚰ 演示身亡结算</button>'+
         '<button class="dev" data-act="age+10">年龄+10</button>'+
         '<button class="dev" data-act="demoAge">演示·寿终</button>'
         + '<button class="dev" data-act="martial_stall">📜 武学摊</button></div></div>';

      // 4. 任务
      h += '<div class="dev-sec"><div class="dev-h">📜 任务调试</div><div class="dev-btns">' +
         '<button class="dev" data-act="skipOnb">跳过新手教程</button>' +
         '<button class="dev" data-act="resetStone">重置采石任务</button></div></div>';

      // 5. 时间
      h += '<div class="dev-sec"><div class="dev-h">⏰ 时间（当前：' + (['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][state.time%12]) + '时）</div><div class="dev-btns">' +
         '<button class="dev" data-act="time+1">时辰+1</button></div></div>';

      // 6. 物品
      h += '<div class="dev-sec"><div class="dev-h">🎒 获得物品</div><div class="dev-btns">' +
         '<button class="dev" data-act="item_stone">石料×10</button>' +
         '<button class="dev" data-act="item_wood">木材×10</button>' +
         '<button class="dev" data-act="item_yao">金疮药×5</button>' +
         '<button class="dev" data-act="item_tiequan">铁拳拳谱</button>' +
         '<button class="dev" data-act="item_xuanyin">玄阴真经</button></div></div>';
      // 8. 地图调试（迷雾 / 门槛解锁 开关，方便测试野外网格）
      h += '<div class="dev-sec"><div class="dev-h">🗺 地图调试（迷雾 '+((state.flags&&state.flags.fog!==false)?'开':'关')+' · 门槛 '+((state.flags&&state.flags.mapGated!==false)?'开':'关')+'）</div><div class="dev-btns">' +
         '<button class="dev" data-act="toggleFog">切换迷雾</button>' +
         '<button class="dev" data-act="toggleGated">切换门槛解锁</button></div></div>';



      // 8. 制药（捣药 v20261015a 配方驱动）：初始三味散剂 + 已学进阶
      h += '<div class="dev-sec"><div class="dev-h">🧪 制药调试</div><div class="dev-btns">'
         + '<select id="dev-grind-herb" class="dev-input">'
         + '<option value="jinchuang">金疮药</option>'
         + '<option value="xingjunsan">行军散</option>'
         + '<option value="xingshensan">醒神散</option>'
         + '<option value="jinchuangao">金创膏</option>'
         + '<option value="xumingdan">续命丹</option>'
         + '</select>'
         + '<button class="dev" data-act="grind">🥣 捣 药</button>'
         + '</div></div>';

      // 8. 演武场（v20261017d）
      h += '<div class="dev-sec"><div class="dev-h">⚔ 战斗调试</div><div class="dev-btns">'
         + '<button class="dev wide" data-act="arena">🥋 进入演武场 · 选敌试战</button>'
         + '<button class="dev" data-act="bf_field">🎲 战棋·野战</button>'
         + '<button class="dev" data-act="bf_siege">🏯 战棋·攻城</button>'
         + '</div></div>';

      h += '<button class="close" id="m-close">收 起</button>';
      $card.innerHTML = h;
      $modal.classList.remove('hidden');

      $card.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.onclick = function () {
          var a = btn.getAttribute('data-act');
          if (a === 'setspawn') { ctx.openSpawnMap(); return; }
          if (a === 'bf_field' || a === 'bf_siege') { handleDev(a); return; }
          if (a === 'demoDeath' || a === 'demoAge') { handleDev(a); return; }
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

    // v20261017d · 演武场：敌人分组清单，点选即战（属性 hp/攻/防/速）
    function renderArena() {
      var state = getState();
      var $card = getCard(), $modal = getModal();
      var h = '<h3>⚔ 演 武 场 <span class="dev-sub">选敌即战 · 血/攻/防/速</span></h3>';
      ARENA_GROUPS.forEach(function (g) {
        var items = g.ids.filter(function (id) { return (G.ENEMIES || {})[id]; });
        if (!items.length) return;
        h += '<div class="dev-sec"><div class="dev-h">' + g.name + '</div><div class="dev-btns">';
        items.forEach(function (id) {
          var e = G.ENEMIES[id];
          h += '<button class="dev" data-act="arena_' + id + '" title="' + (e.title || '') + '">' + e.name
             + '<span class="dev-attr">' + (e.hp || 0) + '·' + (e.atk || 0) + '·' + (e.def || 0) + '·' + (e.spd || 0) + '</span></button>';
        });
        h += '</div></div>';
      });
      h += '<div class="dev-sec" style="border-top:none;margin-top:4px;padding-top:0;"><div class="dev-btns">'
         + '<button class="dev wide" data-act="arena_back">← 返回调试台</button></div></div>';
      h += '<button class="close" id="m-close">收 起</button>';
      $card.innerHTML = h;
      $modal.classList.remove('hidden');
      bindActs($card);
      var c = document.getElementById('m-close'); if (c) c.onclick = ctx.closeModal;
    }

    // 统一按钮绑定：演武场开战类动作直接分发并中止后续渲染
    function bindActs($card) {
      $card.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.onclick = function () {
          var a = btn.getAttribute('data-act');
          if (a === 'setspawn') { ctx.openSpawnMap(); return; }
          if (a.indexOf('arena_') === 0 && a !== 'arena_back') { handleDev(a); return; }
          handleDev(a); ctx.save(getState()); ctx.renderStatus();
          if (getCurrentModalKind() !== 'char') {
            renderDev();
            // v20261018c：调试操作后 renderStatus 的 rAF 帧可能触发升级/任务奖励弹层（openModal 会改 kind）覆盖面板 → 延迟重绘一次保面板稳定
            setTimeout(function () { if (getCurrentModalKind() !== 'char') renderDev(); }, 90);
          }
        };
      });
    }

    return { handleDev: handleDev, renderDev: renderDev };
  };
})();

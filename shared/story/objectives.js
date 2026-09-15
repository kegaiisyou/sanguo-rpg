// 乱世烽火 · 任务日志（目标追踪）数据层
// 设计原则：纯数据 + 判定函数，所有进度均从已有 state 派生（不依赖剧情、不新增计数器），
// 因此系统稳定——后续新增玩法/改流程，只要 state 字段语义不变，本层无需改动。
// check(s) 返回是否已达成；prog(s) 返回进度文案；ratio(s) 返回 0~1 进度比例（可选，用于进度条）。
// type: 'main'=主线 / 'side'=支线 / 'trial'=修行；reward: 达成奖励（xp/gold/rep）。
// s 为玩家存档（运行时即 state）。
//
// at（v20260914a，可选）：任务卡上的「指路」锚点 —— 点一下就点亮去路，不必自己猜该往哪走。
//   写法（引擎 questGoto / LF.Guide 同一套语义锚点，可混用）：
//     { room:'camp_warehouse' }   目标房间：在隔壁 → 点亮罗盘方位键；不在 → 报出路名并亮「山河」
//     { npc:'仓吏' }              目标人物（须在本格）
//     { act:'learn_wu' }          目标场景动作按钮（须在本格）
//     { dock:'char' }             目标底部页签
//     { why:'……' }                这条路本就不在某一处：点「指路」直接把该往哪走说给你听
//   没有 at 就不显示按钮 —— 宁可不给，也不给一个点不着的东西。
//   接取式任务（QUEST_DEFS）不必写 at：引擎会自动用 submit={npc,room} 现成的位置信息。
(function (global) {
  // 与 items.js QUALITY 对齐的品质排序
  var QORDER = { white: 0, green: 1, blue: 2, purple: 3, orange: 4 };
  function bestEquipQuality(s) {
    var best = 0, name = '';
    if (s.equipment) {
      Object.keys(s.equipment).forEach(function (k) {
        var it = s.equipment[k];
        if (it && it.quality != null) {
          var q = QORDER[it.quality];
          if (q != null && q > best) { best = q; name = it.name; }
        }
      });
    }
    return { q: best, name: name };
  }
  function clamp1(x) { return Math.max(0, Math.min(1, x)); }

  var OBJECTIVES = [
    {
      id: 'slay_foe', title: '初试身手', type: 'main', reward: { xp: 50 },
      hint: '于山林巡山、讨平盗匪游散，以验证所学武艺。',
      // 讨匪发生在郊野山林（每格的「清剿·某某」是运行时按野怪生成的动作，没有稳定 id），
      // 所以这条给的是「问路」而非「点亮」——点一下，它告诉你该往哪走。
      at: { why: '巡山讨匪在郊野山林之间：循罗盘出城，走进程郊野格后点「清剿·某某」即可。' },
      check: function (s) { return (s.quest.bandit + s.quest.turban) > 0; },
      prog: function (s) { return '已讨匪 ' + (s.quest.bandit + s.quest.turban) + ' / 1 股'; },
      ratio: function (s) { return clamp1((s.quest.bandit + s.quest.turban) / 1); }
    },
    {
      id: 'rise_repute', title: '扬名立万', type: 'main', reward: { xp: 80, gold: 50 },
      hint: '胜战、行侠、奇遇皆可积攒江湖声望，名动一方。',
      check: function (s) { return s.reputation >= 20; },
      prog: function (s) { return '声望 ' + s.reputation + ' / 20'; },
      ratio: function (s) { return clamp1(s.reputation / 20); }
    },
    {
      id: 'join_sect', title: '择木而栖', type: 'trial', reward: { xp: 120 },
      // v20260914a：原文写「点状态栏『⚔ 门派』」，但全项目没有任何地方能打开门派面板
      //   （openModal('sect') 只在入门成功后自调用一次）——照着做只会白找一场。
      //   已在「角色」面板补上唯一入口，此处把话改对它。
      hint: '声望初立后，点下方「角色」页签，其中「⚔ 门派」可择一门派加入，得门风加成与传功。',
      at: { dock: 'char' },
      check: function (s) { return !!s.sect; },
      prog: function (s) { return s.sect ? ('已属 ' + (global.LF.SECTS[s.sect] ? global.LF.SECTS[s.sect].name : s.sect)) : '尚未加入'; },
      ratio: function (s) { return s.sect ? 1 : 0; }
    },
    {
      id: 'martial_growth', title: '武艺精进', type: 'trial', reward: { xp: 100 },
      hint: '于「武学」研习招式（消耗潜能），技艺日深。',
      // 「研习武学」是真实存在的场景动作（data-act="learn_wu"），但只在主营 / 郡学宫一类房间出现；
      //   在本格时点亮它，不在本格就直说该去哪儿 —— 两种情形都不至于让玩家干瞪眼。
      at: { act: 'learn_wu', why: '「研习武学」只在主营、郡学宫一类的地方出现（且需有潜能）。' },
      check: function (s) { return s.learnedMartial.length >= 3; },
      prog: function (s) { return '已习 ' + s.learnedMartial.length + ' / 3 招'; },
      ratio: function (s) { return clamp1(s.learnedMartial.length / 3); }
    },
    {
      id: 'gear_up', title: '披坚执锐', type: 'side', reward: { xp: 80, gold: 80 },
      hint: '铁匠坊锻造、市集采买，寻得良品以上兵甲。',
      check: function (s) { return bestEquipQuality(s).q >= 1; },
      prog: function (s) { var b = bestEquipQuality(s); return b.q >= 1 ? ('已着 ' + b.name) : '尚无良品兵甲'; },
      ratio: function (s) { return bestEquipQuality(s).q >= 1 ? 1 : 0; }
    },
    {
      id: 'wealth', title: '小有资财', type: 'side', reward: { xp: 100 },
      hint: '征税、市租、贸易皆可聚财，以资军用。',
      check: function (s) { return s.gold >= 300; },
      prog: function (s) { return '库银 ' + s.gold + ' / 300'; },
      ratio: function (s) { return clamp1(s.gold / 300); }
    },
    {
      id: 'hold_city', title: '据城而定', type: 'main', reward: { xp: 300, gold: 300 },
      hint: '于军营「起兵略地」夺城，自立一方、荫及部曲。',
      check: function (s) { return (s.ruledCities && s.ruledCities.length >= 1); },
      prog: function (s) { return '已据城 ' + (s.ruledCities ? s.ruledCities.length : 0) + ' / 1'; },
      ratio: function (s) { return (s.ruledCities && s.ruledCities.length >= 1) ? 1 : 0; }
    }
  ];

  // 接取式任务定义（任务日志「进行中/已完成」）：need 用物品 id+数量，进度由背包实时派生；
  // 接取/完成由触发器 acceptQuest / completeQuest 步骤驱动，面板初始空白，接到任务才出现。
  var QUEST_DEFS = {
    stone: {
      id: 'stone', title: '采石充仓', type: 'side',
      hint: '去营东北矿坑「开凿矿料」凿取青石，凑足五块后回仓库，点仓吏选「给予」，交到他手上。',
      need: [ { item: 'shitiao', name: '石料', icon: '🪨', count: 5 } ],
      submit: { npc: '仓吏', room: 'camp_warehouse' },
      reward: '便携腰包（行囊+4）· 修为+30'
    },
    zt_food: {
      id: 'zt_food', title: '寻吃食·破命数', type: 'side',
      // v20260914g：原文只说「劳役换得劳字木片，往伙房易食，再交予周听涛」——三步都没说清在哪、怎么交，
      //   玩家照着做只会到处乱撞（木片哪来？伙房在哪格？怎么算交到手上？）。此处把整条链一次说尽。
      hint: '周听涛要一份吃食，方肯替你窥探命数。营里不白给饭：① 中军场院「担石劳作」干满三工 → 挣一枚「劳字木片」；② 往营西伙房（有灶台那格）把木片换成干粮；③ 回天字一号牢房，点周听涛、选「给予」，把干粮交到他手上——空手跟他说话不算数。',
      need: [ { item: 'fan', name: '吃食', icon: '🍙', count: 1 } ],
      submit: { npc: '周听涛', room: 'camp_tz1' },
      reward: '密道线索 · 修为+20'
    },
    // ── 营中差役（v20260911i 立，v20260914e 改）：差事要「实地真有活可干」──
    // v20260914e：担石 / 务农 / 搬石那三条「面板上一个按钮就完事」的差役，已退为自由劳作（只挣工分，
    //   不再成其为差役）——点一下就完事，体验太薄。取而代之的两条要求跑腿 + 交货：
    //   赴目标格的可交互设施做工（农田「开垦」→「掐菜」/ 矿坑「凿石」），再把实物交到收差人手上
    //   （菜交伙房鲁大、石料交仓库郑刚）。派活与收活分人，正是营里各管一摊的样子。
    // 进度直接看你交出去几份实物（need.item）—— 由 onGive 触发器累计（kyl_farm_give）；
    //   取值/显示见 engine.js · needHave()（need 支持 flag 形式，是对本文件原「纯物品派生」原则的一处必要扩展）。
    camp_farm: {
      id: 'camp_farm', title: '开垦薄田', type: 'side',
      hint: '赴营北农田「开垦」三垄开出第一畦 → 播菜籽（头一回下地，孙老连锄头带籽一齐给）→ 约三个时辰后「采收」（浇过水早一个时辰）→ 捧去伙房，点鲁大、选「给予」，把野菜交到他手上才算完。',
      need: [ { item: 'yecai', name: '野菜', icon: '🥬', count: 2 } ],
      submit: { npc: '鲁大', room: 'kuyilao' },
      reward: '干粮×1 · 修为+25 · 孙老好感+1'
    },
    // ── 营中例事（v20260915d）：点卯与吃饭本是营规，只有罚没有赏，最招人嫌。 ──
    //   把两件「每日都躲不掉的事」也钉上木牌：应卯记「勤」，记满了能销旷役；吃自己换来的饭，
    //   吃满两顿给修为。规矩没变，只是做完有得拿 —— 玩家便不再觉得营里处处跟他作对。
    //   进度走 flag 计数（flags.task.roll_cnt / meal_cnt），由引擎在应卯与进食时各记一笔。
    roll_call: {
      id: 'roll_call', title: '点卯应名', type: 'side',
      hint: '卯、辰两个时辰（天亮开工那阵）赶到中军场院（挂记工木牌那一格），点「应卯点名」应一声——一日只应一次。连应三日：册上记满三笔「勤」，销一次旷役，另得干粮两张。',
      need: [ { flag: 'flags.task.roll_cnt', name: '应卯', icon: '📋', count: 3 } ],
      submit: { npc: '牢头', room: 'kuyilao' },
      reward: '干粮×2 · 修为+30 · 销一次旷役'
    },
    mess_meal: {
      id: 'mess_meal', title: '灶上一口热饭', type: 'side',
      hint: '营西伙房以「劳字木片」换一份饭（卯辰 / 午未 / 酉戌是饭点，得热饭；过了点只剩冷粥），再点下方「🎒 行囊」里的干粮、选「使用」把它吃下去——吃满两顿。',
      need: [ { flag: 'flags.task.meal_cnt', name: '进餐', icon: '🍚', count: 2 } ],
      submit: { npc: '大勺', room: 'kuyilao' },
      reward: '干粮×1 · 修为+20'
    },
    // 犬舍试手（v20260915e）：韩铁教的是「打不过就撤」——所以结清条件是【成功撤退】，
    //   把狗打死不算。教的是留得青山，不是逞凶。
    dog_spar: {
      id: 'dog_spar', title: '犬舍试手', type: 'side',
      hint: '演武场（有木人桩那一格）东侧有间犬舍——进去点「逗弄野犬」，交手后按「撤退·xx%」脱身。撤得成才算本事；把狗打死不算。',
      need: [ { flag: 'flags.task.dog_fled', name: '全身而退', icon: '🐕', count: 1 } ],
      submit: { npc: '韩铁', room: 'kuyilao' },
      reward: '修为+40 · 声望+2'
    },
    // ── 第二批（v20260915f）：四桩「要跑腿」的差事 ──
    //   与「做出实物交上去」的田/矿不同，这四桩卖的是脚力与眼力：水、话、时辰、拳脚。
    water_cook: {
      id: 'water_cook', title: '担水入灶', type: 'side',
      hint: '囚室那格的水槽点「装水入袋」打满水 → 往伙房那格点「灶边水缸」倾进去，两趟。',
      need: [ { flag: 'flags.task.water_cnt', name: '担水', icon: '🪣', count: 2 } ],
      submit: { npc: '鲁大', room: 'kuyilao' },
      reward: '干粮×1 · 修为+20 · 鲁大好感+1'
    },
    dummy_train: {
      id: 'dummy_train', title: '木人试艺', type: 'side',
      hint: '演武场那格戳木人桩，打赢三回——撤了不算，得把它戳倒。',
      need: [ { flag: 'flags.task.dummy_cnt', name: '戳倒木人', icon: '🪵', count: 3 } ],
      submit: { npc: '韩铁', room: 'kuyilao' },
      reward: '修为+35 · 韩铁好感+1'
    },
    errand_word: {
      id: 'errand_word', title: '捎句话', type: 'side',
      hint: '去农田问孙老要捎什么话 → 往中军场院寻牢头带到 → 回来与孙老回一声。',
      need: [ { flag: 'flags.task.errand_cnt', name: '传话', icon: '💬', count: 2 } ],
      submit: { npc: '孙老', room: 'kuyilao' },
      reward: '修为+25 · 孙老好感+1'
    },
    watch_shift: {
      id: 'watch_shift', title: '瞭望换岗', type: 'side',
      hint: '岗哨那格点「登楼瞭望」记下换岗在几时，再回来与秦九霄说一声。',
      need: [ { flag: 'flags.task.watch_cnt', name: '报知时辰', icon: '🗼', count: 1 } ],
      submit: { npc: '秦九霄', room: 'kuyilao' },
      reward: '修为+30 · 出营线索'
    },
    // ── 第三批（v20260915f）：地字号那三间的差事 ──
    porridge_visit: {
      id: 'porridge_visit', title: '送粥探监', type: 'side',
      hint: '在伙房换一碗粥（过了饭点换到的正是粥），往地字二号牢房点那瘦少年、选「给予」递到他手上。',
      need: [ { flag: 'flags.task.porridge_cnt', name: '递粥', icon: '🥣', count: 1 } ],
      submit: { npc: '林娘', room: 'kuyilao' },
      reward: '修为+30 · 阿禾好感+2 · 水渠线索'
    },
    night_water: {
      id: 'night_water', title: '夜半添水', type: 'side',
      hint: '往囚室那格的水槽点「添水」，把槽水注满——添满即了，水不够就多打几袋。',
      need: [ { flag: 'flags.task.nightwater_cnt', name: '槽水注满', icon: '💧', count: 1 } ],
      submit: { npc: '崔九', room: 'kuyilao' },
      reward: '修为+20 · 地字号好感+1'
    },
    store_rummage: {
      id: 'store_rummage', title: '仓中翻找', type: 'side',
      hint: '仓库那格点「翻找旧物」，翻出什么算什么；再点仓吏、选「给予」交到他手上。',
      need: [ { flag: 'flags.task.rummage_cnt', name: '交还仓里', icon: '🧺', count: 1 } ],
      submit: { npc: '仓吏', room: 'kuyilao' },
      reward: '修为+20 · 仓吏好感+1'
    },
    // ── 矿坑支线（v20260915i）：淘铜铸镐 / 老矿工遗愿 ──
    mine_copper: {
      id: 'mine_copper', title: '淘铜铸镐', type: 'side',
      hint: '矿洞里三层往下有古铜脉——下矿洞，入第三层起寻「古铜脉」凿取铜矿；凑足四块回仓库，点仓吏、选「给予」，把铜矿交到他手上。',
      need: [ { item: 'tongkuang', name: '铜矿', icon: '🟤', count: 4 } ],
      submit: { npc: '仓吏', room: 'kuyilao' },
      reward: '青铜镐 · 修为+30'
    },
    mine_bailian: {
      id: 'mine_bailian', title: '老矿工的遗愿', type: 'side',
      hint: '老矿工说矿洞深处刻着一碑百炼钢法。备好竹简与墨（削竹为简、松烟为墨），入矿洞下到第七层，寻「半截残碑」拓印铭文，再回来与老矿工说一声。',
      need: [ { flag: 'flags.task.bailian_stele', name: '拓回残碑铭文', icon: '📜', count: 1 } ],
      submit: { npc: '老矿工', room: 'kuyilao' },
      reward: '修为+40 · 老矿工好感+1'
    }
  };

  global.LF = global.LF || {};
  global.LF.OBJECTIVES = OBJECTIVES;
  global.LF.QUEST_DEFS = QUEST_DEFS;
  if (typeof module !== 'undefined' && module.exports) module.exports = OBJECTIVES;
})(typeof window !== 'undefined' ? window : globalThis);

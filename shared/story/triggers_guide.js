// 乱世烽火 · 触发剧本 —— 毕业引导 + 苦役营日常任务
//   首入开放世界点亮系统 / 开垦薄田 / 瞭望换岗 / 任务登记
//
// 由 shared/story/triggers.js 汇总加载（v20261008p 按剧情线拆分）。
// 本文件内的 push 顺序即最终 TRIGGERS 顺序中的一段，段内勿随意调换。
(function (global) {
  var LF = global.LF = global.LF || {};

  LF.pushTriggersGuide = function (T) {

    // — 毕业引导：首入开放世界，逐步点亮全部核心系统（行囊/角色/战斗/武学/交易/地图/历法/善恶） —
    T.push({
      id: 'camp_tour', hook: 'onEnter', room: 'lindao', once: false,
      cond: { flags: { 'flags.onb.done': true }, notFlag: 'flags.task.tour_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.tour_done', value: true },
        { t: 'reveal', layer: 'dock' },
        { t: 'highlight', layer: 'dock' },
        { t: 'sys', text: '〔系统全貌〕你既自由，江湖诸般手段皆已为你敞开，下方「行囊/任务/角色」面板此刻点亮——' },
        { t: 'sys', text: '· 点开「角色」面板：查看修为、战力、善恶声望（凶名/义声）。声望将左右世人待你之态度。' },
        { t: 'sys', text: '· 点开「武学」：研习招式、内功（内力将随门派/心法开启）。战斗中以「攻击/防御/道具/撤退」四式应敌。' },
        { t: 'sys', text: '· 寻见「货郎」可交易买卖；点「山河志」地图纵览州郡；点顶上「时辰」可知历法天候——皆是你闯荡的凭仗。' },
        { t: 'log', cls: 'good', text: '（提示：此后每遇新系统，皆有高亮引路。先往林径寻那挑担的行脚货郎，或北去白檀军屯安顿身心，再做打算。）' },
        { t: 'reveal', layer: 'map' },
        { t: 'highlight', layer: 'map' },
        { t: 'sys', text: '· 点下方「山河志」可纵览天下十三州郡、敌我城池与名将——你的战略宏图，自此展开。' }
      ]
    });

    // — 〔已移除〕原外应接应线（路线10·穆长风/老乞丐）整体删除；出营后的接应由林径行脚货郎与白檀军屯承接。 —


    T.push({
      id: 'kaixuan_hook', hook: 'onEnter', room: 'luoyang', once: true,
      cond: { flags: { 'quest.luoyang': true } },
      steps: [ { event: 'ev_kaixuan_decree' } ]
    });

    // ════════════════ 苦役营·新手支线：采石充仓（v20260909w） ════════════════
    // 接任务：与仓吏对话，受托采石料
    T.push({
      id: 'kyl_stone_accept', hook: 'onTalk', npc: 'storeman', room: 'kuyilao', cell: [2,1], once: true,
      cond: { notFlag: 'flags.task.stone_started' },
      steps: [
        { t: 'npcTalk', npc: 'storeman_kuyilao',
          prompt: '仓吏见你过来，搁下笔册叹道：「营中营建正缺石料，矿坑那头采得慢。你若肯去矿坑凿些青石来交予我，上头必有赏赐——五块便够，多了也记你功劳。」',
          asks: [
            { label: '〔应下〕我去矿坑采来。',
              set: { 'flags.task.stone_started': true },
              say: '仓吏点头：「好！矿坑在仓库北边，挥镐便能凿下青石。采够五块拿来与我，赏你一个便携腰包，系在腰上装东西也方便些。」〔任务：采石充仓——去矿坑采五块石料，给予仓吏。〕',
              then: [ { t: 'acceptQuest', id: 'stone' } ] },
            { label: '〔婉拒〕我再想想。',
              say: '仓吏摆摆手：「不急，何时想通了再来找我。」' }
          ] }
      ]
    });
    // 任务进行中：再次对话提示进度
    T.push({
      id: 'kyl_stone_progress', hook: 'onTalk', npc: 'storeman', room: 'kuyilao', cell: [2,1], once: false,
      cond: { flags: { 'flags.task.stone_started': true }, notFlag: 'flags.task.stone_done' },
      steps: [
        { t: 'log', cls: 'npc', text: '〔仓吏〕「石料凿得如何了？凿够了就交过来——点我，选「给予」，把石料择出来。五块，一块一记。」' }
      ]
    });
    // 交任务：给予石料给仓吏，累计5块完成（按实际给予数量累计）
    T.push({
      id: 'kyl_stone_give', hook: 'onGive', npc: 'storeman', room: 'kuyilao', cell: [2,1], item: 'shitiao', once: false,
      cond: { flags: { 'flags.task.stone_started': true }, notFlag: 'flags.task.stone_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.stone_count', increment: true, incrementByEnv: 'qty' },
        { t: 'branch',
          if: { player: { 'flags.task.stone_count': { min: 5 } } },
          then: [
            { t: 'setFlag', path: 'flags.task.stone_done', value: true },
            { t: 'completeQuest', id: 'stone' },
            // v20260916f：同 farm——交差回报改对话窗，结算 log 在对话关掉后才出，对话不会被顶掉
            { t: 'npcTalk', npc: 'storeman_kuyilao',
              prompt: '五块石料齐了！好汉子，做事利落。这腰包你拿去，系在腰上，往后装东西也方便些。',
              asks: [ { label: '〔收下〕多谢仓吏。' } ] },
            { t: 'grant', items: [ { id: 'yaobao', name: '便携腰包', icon: '👝', cat: '装备', count: 1 } ] },
            { t: 'exp', amount: 30 },
            { t: 'log', cls: 'good', text: '〔任务完成·采石充仓〕获得 便携腰包（行囊+4）· 修为 +30' }
          ],
          else: [
            { t: 'log', cls: 'npc', text: '〔仓吏〕收下石料，在册上记了一笔：「还差几块，继续去采。」' }
          ]
        }
      ]
    });
    // 任务完成后对话
    T.push({
      id: 'kyl_stone_done', hook: 'onTalk', npc: 'storeman', room: 'kuyilao', cell: [2,1], once: false,
      cond: { flags: { 'flags.task.stone_done': true } },
      steps: [
        { t: 'log', cls: 'npc', text: '〔仓吏〕「石料已收妥，营中营建又快了几分。你若还想帮忙，营里各处都缺人手——农庄、伙房、演武场，尽可去转转。」' }
      ]
    });

    // ══════════ 苦役营·差役「开垦薄田」：交差 = 把野菜给予鲁大（v20260914f）═════════
    // 与「采石充仓」同一套口径：东西从行囊里真扣掉（给予面板），按实际给出的数量累计，够了才发赏。
    //   任务日志那边 need 记的就是「野菜×2」，与这里对得上（见 objectives.js camp_farm）。
    // 不写 cell：鲁大有作息会挪格（申时去粮囤），写死会闹出「人在这儿却交不上」的怪事。
    T.push({
      id: 'kyl_farm_give', hook: 'onGive', npc: 'lu_da', room: 'kuyilao', item: 'yecai', once: false,
      cond: { flags: { 'flags.task.farm_started': true }, notFlag: 'flags.task.farm_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.farm_count', increment: true, incrementByEnv: 'qty' },
        { t: 'branch',
          if: { player: { 'flags.task.farm_count': { min: 2 } } },
          then: [
            { t: 'setFlag', path: 'flags.task.farm_done', value: true },
            { t: 'completeQuest', id: 'camp_farm' },
            // v20260916f：交菜的回报改成对话窗（npcTalk）——旧版是 log，结算一刷屏，
            //   鲁大的话就被顶出视野，玩家总觉得「对话被跳过」。弹窗必须点掉，对话不会再错过。
            { t: 'npcTalk', npc: 'lu_da',
              prompt: '菜下了锅，热气腾起来。他舀半瓢稠的递过来：「孙老那块地，果然没白翻。往后菜多了，只管送来。」',
              asks: [ { label: '〔应下〕好，往后菜熟了便送来。' } ] },
            { t: 'grant', items: [ { id: 'fan', name: '干粮', icon: '🍙', cat: '食饵', count: 1 } ] },
            // v20260920e：开垦薄田顺手送一只水袋——农田水井打水、浇畦、夜半添槽都靠它。
            { t: 'grant', items: [ { id: 'shuidai', name: '水袋', icon: '💧', cat: '器用', count: 1, waterCap: 10 } ] },
            { t: 'favor', npc: 'sun_lao', amount: 1 },
            { t: 'exp', amount: 25 },
            { t: 'log', cls: 'good', text: '〔任务完成·开垦薄田〕获得 干粮×1 · 水袋×1 · 修为+25 · 孙老好感+1' }
          ],
          else: [
            { t: 'log', cls: 'npc', text: '〔鲁大〕接过菜往案上一摊：「这才多少。再掐些来，凑够两捧，我给锅里添一勺油花。」' }
          ] }
      ]
    });

    // ══════════ 第二批·捎句话（v20260915f）：孙老 → 牢头 → 回孙老 ══════════
    //   三句话跑三趟，卖的是脚力。话本身轻（一个「补」字），跑这一趟人才知道营里的门道。
    //   不写 cell：孙老、牢头都有作息会挪格，写死会闹出「人在这儿却交不上话」。
    T.push({
      id: 'errand_from_sun', hook: 'onTalk', npc: 'sun_lao', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.errand_started': true }, notFlag: 'flags.task.errand_got' },
      steps: [
        { t: 'log', cls: 'npc', text: '孙老把烟锅在鞋底一磕：「劳你捎句话——就问牢头，北墙那段塌了几日的口子，今夜补不补。别多说，也别少说。」' },
        { t: 'setFlag', path: 'flags.task.errand_got', value: true },
        { t: 'setFlag', path: 'flags.task.errand_cnt', increment: true },
        { t: 'log', cls: 'sys', text: '〔捎句话〕记下了——往中军场院寻牢头，把这句话带到。' }
      ]
    });
    T.push({
      id: 'errand_to_laotou', hook: 'onTalk', npc: 'laotou', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.errand_got': true }, notFlag: 'flags.task.errand_told' },
      steps: [
        { t: 'log', cls: 'npc', text: '你把孙老那句话带到。牢头眼皮都不抬：「补。今夜就补。」（他把话头一收）「……这话，是谁问的？」' },
        { t: 'setFlag', path: 'flags.task.errand_told', value: true },
        { t: 'setFlag', path: 'flags.task.errand_cnt', increment: true },
        { t: 'log', cls: 'sys', text: '〔捎句话〕话已带到——回去与孙老回一声。' }
      ]
    });
    T.push({
      id: 'errand_back_sun', hook: 'onTalk', npc: 'sun_lao', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.errand_told': true }, notFlag: 'flags.task.errand_done' },
      steps: [
        { t: 'log', cls: 'npc', text: '你回了他一个字：「补。」孙老眯着眼听完，半晌才道：「一个字，够老朽听一宿了——那口子补上，明晚便少一条路。」' },
        { t: 'setFlag', path: 'flags.task.errand_done', value: true },
        { t: 'setFlag', path: 'flags.task.errand_cnt', value: 2 },
        { t: 'completeQuest', id: 'errand_word' },
        { t: 'favor', npc: 'sun_lao', amount: 1 },
        { t: 'exp', amount: 25 },
        { t: 'log', cls: 'good', text: '〔任务完成·捎句话〕修为+25 · 孙老好感+1' }
      ]
    });

    // ══════════ 第二批·瞭望换岗：登楼看过，回来报与秦九霄 ══════════
    T.push({
      id: 'watch_report', hook: 'onTalk', npc: 'qin_jiuxiao', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.watch_started': true, 'flags.task.watch_seen': true }, notFlag: 'flags.task.watch_done' },
      steps: [
        { t: 'log', cls: 'npc', text: '秦九霄听完你说的时辰，指节在膝上敲了两下：「换岗那阵，门洞下最乱——要动手，就在那一刻。早一刻人没散，晚一刻锁已经落了。」' },
        { t: 'setFlag', path: 'flags.task.watch_cnt', value: 1 },
        { t: 'setFlag', path: 'flags.task.watch_done', value: true },
        { t: 'completeQuest', id: 'watch_shift' },
        { t: 'exp', amount: 30 },
        { t: 'log', cls: 'good', text: '〔任务完成·瞭望换岗〕修为+30 · 记下了出营的那条缝' }
      ]
    });

    // ══════════ 第三批·送粥探监：把粥递到阿禾手上（地字二号）══════════
    //   先前只知道他藏饼；等粥递过去，才知道那半块饼是留给山下瞎眼妹妹的 —— 
    //   这条线换来的不是赏，是暗渠的入口（水渠夜遁·路线8）。
    T.push({
      id: 'dz_porridge_give', hook: 'onGive', npc: 'a_he', room: 'camp_dz2', item: 'xizhou', once: false,
      cond: { flags: { 'flags.task.porridge_started': true }, notFlag: 'flags.task.porridge_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.porridge_cnt', increment: true },
        { t: 'setFlag', path: 'flags.task.porridge_done', value: true },
        { t: 'completeQuest', id: 'porridge_visit' },
        { t: 'favor', npc: 'a_he', amount: 2 },
        { t: 'exp', amount: 30 },
        { t: 'log', cls: 'npc', text: '〔阿禾〕双手接过碗，先没喝——他把碗往怀里揣了揣，才小口抿着。半晌抬头：「……我妹两天没吃东西了。你若真要出去，我告诉你暗渠从哪儿下：营墙根往东数第七块砖，底下是空的。」' },
        { t: 'setFlag', path: 'flags.route.crypt', value: true },
        { t: 'log', cls: 'good', text: '〔任务完成·送粥探监〕修为+30 · 阿禾好感+2 · 得了暗渠的入口（水渠夜遁线可成）' }
      ]
    });

    // ══════════ 第三批·阿禾讨物链：木材 → 石料（默叔支路前置）══════════
    //   阿禾要木材、再要石料，想悄悄在墙角刨个窝——这些材料日后被牢头搜出，成为第4日夺营的导火索。
    //   注意：此链只涨「阿禾」好感；默叔好感改由「挡灾同担」事件（moshu_harass）单独结算，
    //   以免「只帮阿禾就能刷默叔」稀释了共患难的分量。
    T.push({
      id: 'ahe_wood_intro', hook: 'onTalk', npc: 'a_he', room: 'camp_dz2', once: false,
      cond: { flags: { 'flags.task.porridge_done': true }, notFlag: 'flags.task.ahe_wood_done' },
      steps: [
        { t: 'npcTalk', npc: 'a_he',
          prompt: '阿禾把空碗往怀里一揣，压低声：「……劳烦你再替我寻些木材来。我想在墙角刨个窝——夜里风大，妹子若来寻我，也有个遮风处。」',
          asks: [
            { label: '〔应下〕我去找木材', set: { 'flags.task.ahe_wood_started': true },
              // v20260924z：补 acceptQuest —— 此前应下只置 flag 未登记任务日志，玩家在任务栏看不到「寻木材」
              then: [ { t: 'acceptQuest', id: 'ahe_wood' } ],
              say: '阿禾点点头，从破袄里摸出半截炭条，在墙角划了个浅浅的圈：「就这儿。木材不拘多少，凑一把就成。」' }
          ] }
      ]
    });
    T.push({
      id: 'ahe_wood_give', hook: 'onGive', npc: 'a_he', room: 'camp_dz2', item: 'mucai', once: false,
      cond: { flags: { 'flags.task.ahe_wood_started': true }, notFlag: 'flags.task.ahe_wood_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.ahe_wood_done', value: true },
        { t: 'completeQuest', id: 'ahe_wood' },
        { t: 'favor', npc: 'a_he', amount: 2 },
        { t: 'exp', amount: 25 },
        { t: 'log', cls: 'npc', text: '〔阿禾〕接过木材，喉头动了动：「……我记着你这份情。等出去了，我教你认山里的草药。」' },
        { t: 'log', cls: 'good', text: '〔任务完成·寻木材〕修为+25 · 阿禾好感+2' }
      ]
    });
    T.push({
      id: 'ahe_stone_intro', hook: 'onTalk', npc: 'a_he', room: 'camp_dz2', once: false,
      cond: { flags: { 'flags.task.ahe_wood_done': true }, notFlag: 'flags.task.ahe_stone_done' },
      steps: [
        { t: 'npcTalk', npc: 'a_he',
          prompt: '阿禾搓了搓手：「木材有了……还差样硬物。你若能弄来石头，我凿把镐——墙根是夯土的，有镐才刨得动。」',
          asks: [
            { label: '〔应下〕我去寻石料', set: { 'flags.task.ahe_stone_started': true },
              // v20260924z：补 acceptQuest（与 ahe_wood 同源问题）
              then: [ { t: 'acceptQuest', id: 'ahe_stone' } ],
              say: '阿禾眼睛亮了亮：「矿坑、担石场都有碎石。劳你再跑一趟。」' }
          ] }
      ]
    });
    T.push({
      id: 'ahe_stone_give', hook: 'onGive', npc: 'a_he', room: 'camp_dz2', item: 'shitiao', once: false,
      cond: { flags: { 'flags.task.ahe_stone_started': true }, notFlag: 'flags.task.ahe_stone_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.ahe_stone_done', value: true },
        { t: 'completeQuest', id: 'ahe_stone' },
        { t: 'favor', npc: 'a_he', amount: 2 },
        { t: 'exp', amount: 30 },
        { t: 'log', cls: 'npc', text: '〔阿禾〕接过石料，指节攥得发白，眼里却亮得怕人：「够了……够凿把镐了。今夜我就动手。」' },
        { t: 'log', cls: 'good', text: '〔任务完成·寻石料〕修为+30 · 阿禾好感+2' }
      ]
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
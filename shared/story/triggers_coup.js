// 乱世烽火 · 触发剧本 —— 夺营前置：默叔线 / 韩铁线 + 营中苦役
//   挡灾同担 / coup.moshu 电影化大段 / officer_letter 送信搬救兵 / 苦役任务化
//
// 由 shared/story/triggers.js 汇总加载（v20261008p 按剧情线拆分）。
// 本文件内的 push 顺序即最终 TRIGGERS 顺序中的一段，段内勿随意调换。
(function (global) {
  var LF = global.LF = global.LF || {};

  LF.pushTriggersCoup = function (T) {

    // ══════════ 默叔·挡灾同担（丙·替牢头刁难时扛下 → 好感+1）══════════
    //   默叔哑且缄口，寻常交谈给不了好感（dialogues.js 只配了 lines，无 topic）。
    //   他的好感只在此「共患难」一刻结算：牢头踹门刁难，你替他扛下——哑者认的是替他挨的那一下。
    //   本触发 once:true，是玩家与默叔关系里唯一一次涨好感的机会；选「别管」则默叔好感恒定 0，
    //   第4日夺营会落入 minor_ahe / minor 支路（设计意图：没共过患难，便不被墨家支线接纳）。
    T.push({
      id: 'moshu_harass', hook: 'onTalk', npc: 'moshu', room: 'camp_tz2', once: true,
      steps: [
        { t: 'log', cls: 'warn', text: '你正要同默叔打手势，牢门忽被人一脚踹开——牢头提着钥匙串进来，目光扫过默叔膝上那只未完工的木鸢，冷笑：「老哑巴，今日夯墙的活计你少了一截，是想挨鞭是不是？」' },
        { t: 'npcTalk', npc: 'moshu',
          prompt: '默叔缓缓把木鸢往身后藏，却并不躲。他抬眼看了你一下，又垂下——那眼神不是求你救，是怕你惹祸上身。',
          asks: [
            { label: '〔替他扛〕「那活计是我叫他歇的，冲我来」',
              then: [
                { t: 'favor', npc: 'moshu', amount: 1 },
                { t: 'hurt', amount: 8, favor: -1, favorNpc: 'laotou', fxText: '牢头一推' },
                { t: 'setFlag', path: 'flags.moshu.shielded', value: true },
                { t: 'log', cls: 'npc', text: '你迎上去把话揽下。牢头眯眼，反手把你搡了个趔趄：「牙尖嘴利！记你一笔。」默叔怔住，望着你挨那一下，指节攥了又松——他第一次，朝你弯了弯眼角。' },
                { t: 'log', cls: 'good', text: '〔默叔好感 +1〕他记下了你这一挡。' }
              ] },
            { label: '〔别管〕退到栅边，不作声',
              then: [
                { t: 'log', cls: 'sys', text: '你没作声。牢头骂骂咧咧，拖着默叔去补那截夯墙的活；默叔回头瞥你一眼，眼神淡了下去。' }
              ] }
          ] }
      ]
    });

    // ══════════ 夺营裁决器（第4日·共享起爆点）══════════
    //   太平道于第4日夺营；玩家此前的积累（密道/军官/阿禾默叔牵绊）决定走哪条分支。
    //   本切片只做「裁决 + 占位」，各分支的电影化大段（崔九牺牲、狄云舟对决等）留待后续切片接入 flags.coup.branch。
    //   优先级（自上而下）：tunnel_early(密道先逃) > officer_letter(送信搬救兵) > moshu(默叔线) > minor_ahe > minor(兜底)
    //   触发点沿用现状：第4日（player.day>=3）踏入网格中军场院(kuyilao 1,1) 且已出牢(cellOpen) 时裁决一次。
    T.push({
      id: 'coup_resolver', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
      cond: { flags: { 'flags.onb.cellOpen': true }, player: { day: { min: 3 } }, notFlag: 'flags.coup.done' },
      steps: [
        { t: 'setFlag', path: 'flags.coup.done', value: true },
        { t: 'log', cls: 'warn', text: '〔夺营·起爆〕第4日，营中骤变——太平道的旗号已暗里插遍岗哨。你此前的经营，决定这一夜通向何处。' },
        { t: 'branch',
          if: { flags: { 'flags.route.tunnel': true } },
          then: [
            { t: 'setFlag', path: 'flags.coup.branch', value: 'tunnel_early' },
            { t: 'log', cls: 'warn', text: '〔夺营·密道先逃〕你早通了矿坑地道——混乱中猫腰钻进坑道，比谁都先出了营。（最简逃生线）' }
          ],
          else: [ { t: 'branch',
            if: { flags: { 'flags.route.crypt': true } },
            then: [
              { t: 'setFlag', path: 'flags.coup.branch', value: 'tunnel_early' },
              { t: 'log', cls: 'warn', text: '〔夺营·密道先逃〕塌墙根暗道你早探明——趁乱一头扎进，最先脱身。（最简逃生线）' }
            ],
            else: [ { t: 'branch',
              if: { flags: { 'flags.route.drain': true } },
              then: [
                { t: 'setFlag', path: 'flags.coup.branch', value: 'tunnel_early' },
                { t: 'log', cls: 'warn', text: '〔夺营·密道先逃〕水渠夜遁的道你早摸熟——顺渠漂出，乱兵追之不及。（最简逃生线）' }
              ],
              else: [ { t: 'branch',
                if: { npcFavor: { key: 'han_tie', min: 2 } },
                then: [
                  { t: 'setFlag', path: 'flags.coup.branch', value: 'officer_letter' },
                  { t: 'log', cls: 'warn', text: '〔夺营·送信搬救兵〕韩铁信你，密令你趁乱出营送信搬救兵。你成了这营里最后一封活信——' }
                ],
                else: [ { t: 'branch',
                  if: { npcFavor: { key: 'a_he', min: 2 } },
                  then: [ { t: 'branch',
                    if: { npcFavor: { key: 'moshu', min: 1 } },
                    then: [
                      { t: 'setFlag', path: 'flags.coup.branch', value: 'moshu' },
                      { t: 'log', cls: 'warn', text: '〔夺营·默叔线〕你与阿禾、默叔的牵绊，让这一夜通向墨家支路——' }
                    ],
                    else: [
                      { t: 'setFlag', path: 'flags.coup.branch', value: 'minor_ahe' },
                      { t: 'log', cls: 'warn', text: '〔夺营·轻版〕你与阿禾有些交情，默叔却未认你。阿禾拉你逃，大段从简。' }
                    ]
                  } ],
                  else: [
                    { t: 'setFlag', path: 'flags.coup.branch', value: 'minor' },
                    { t: 'log', cls: 'warn', text: '〔夺营·孤身〕你孤身一人，被乱局裹挟。（最简逃生 / 短暂被俘 待接入）' }
                  ]
                } ]
              } ]
            } ]
          } ]
        }
      ]
    });

    // ══════════ 默叔线·电影化大段（coup.moshu 分支，第4日夺营接续演出）══════════
    //   触发条件：coup_resolver 在同一次踏入中军场院时已置 branch='moshu'；本触发器顺次接续（checkTriggers 顺序同步触发）。
    //   流程：牢头搜洞+石镐 → 崔九替死 → 默叔出手 → 岗哨狄云舟拦路(战斗) → 逃出（收尾在 engine.onCombatResult）。
    T.push({
      id: 'coup_moshu_scene', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
      cond: { flags: { 'flags.coup.branch': 'moshu' }, notFlag: 'flags.coup.moshu_escaped' },
      steps: [
        { t: 'log', cls: 'warn', text: '卯时三刻，号角骤起——太平道的旗已插上粮仓。火光里，牢头领着两名官差踹进牢区；他鼻翼翕动，循着新翻的土腥，从墙角刨出阿禾那口洞，又从草堆里抄出那把石镐。' },
        { t: 'log', cls: 'combat', text: '「好啊——私通外贼、图谋不轨！」牢头一声唿哨，铁链已套上阿禾的脖颈。「这洞、这镐，是谁的主意？」' },
        { t: 'log', cls: 'npc', text: '你正要开口，崔九却已跨前半步，把你们三个挡在身后。这沉默的什长只盯着牢头：「洞是我挖的，镐是我藏的。要拿，拿我。」' },
        { t: 'log', cls: 'env', text: '牢头狞笑，腰刀照准崔九劈下。崔九不避不让——他侧身将你往默叔那边一推，那一刀结结实实嵌进肩胛。血溅上土墙，他却没有倒，只回头看你一眼。' },
        { t: 'log', cls: 'good', text: '〔崔九〕「……老子带出去的兵，夜里得睡得着。」他笑着，却再没松开那攥紧的铁链。' },
        { t: 'log', cls: 'combat', text: '默叔眼底第一次有了杀意。他袖中机括「咔」地弹开，一截墨家短弩的寒光抵在牢头咽喉——牢头与官差轰然倒地。他一把拽起你与阿禾，朝塌墙根的暗道疾去。' },
        { t: 'npcTalk', npc: 'moshu',
          prompt: '暗道里湿滑逼仄，阿禾脚下一崴，险些栽进暗沟。默叔半拖半拽，在你耳边急促道：「这丫头腿软——你拿主意，这节骨眼上，顾谁？」',
          asks: [
            { label: '〔背起阿禾〕攥紧她手腕，扛上肩头', then: [
              { t: 'setFlag', path: 'flags.coup.moshu_carry_ahe', value: true },
              { t: 'log', cls: 'good', text: '你一把将阿禾拽上背。她轻得像片枯叶，却死死攥着你衣领：「……你别丢下我。」你没答，只把步子迈得更稳。' }
            ] },
            { label: '〔断后护叔〕把阿禾推给默叔，自己殿后', then: [
              { t: 'setFlag', path: 'flags.coup.moshu_cover', value: true },
              { t: 'log', cls: 'combat', text: '你将阿禾往默叔怀里一推，反手抄起地上半截断矛，殿在最后。暗道窄，追兵一次只容得一人钻进来——你正等着他。' }
            ] }
          ]
        },
        { t: 'log', cls: 'env', text: '你们钻出暗道，迎面却是岗哨通明的火把。狄云舟横矛立在那里，甲胄映着火光，像是早料到有人从此处钻出。' },
        { t: 'npcTalk', npc: 'diyunzhou',
          prompt: '狄云舟将长矛一顿，矛尖点地：「站住。这营里少一个囚犯，我项上人头就得落地。你，留下。」',
          asks: [
            { label: '〔应战〕夺矛而走', then: [
              { t: 'log', cls: 'combat', text: '你欺身抢进，一把攥住矛杆往前夺——狄云舟腕力惊人，却没防备你这不要命的抢法。' },
              { t: 'combat', enemy: 'diyunzhou' }
            ] },
            { label: '〔偕默叔齐上〕并肩破围', then: [
              { t: 'setFlag', path: 'flags.coup.moshu_flank', value: true },
              { t: 'favor', npc: 'moshu', amount: 1 },
              { t: 'log', cls: 'combat', text: '默叔与你交换一个眼色，短弩与断矛同时递出——两面夹击，狄云舟的矛势登时被绞住。' },
              { t: 'combat', enemy: 'diyunzhou' }
            ] },
            { label: '〔佯败诱敌〕诈作不支，暗遁暗道', then: [
              { t: 'setFlag', path: 'flags.coup.moshu_ruse', value: true },
              { t: 'log', cls: 'combat', text: '你故意脚下一滑、踉跄后退，引得狄云舟挺矛直刺——就在矛尖及体的刹那，你偏身没入暗道阴影，留他一矛扎进虚处。' },
              { t: 'combat', enemy: 'diyunzhou' }
            ] }
          ]
        }
      ]
    });

    // ══════════ 韩铁线·送信搬救兵（coup.officer_letter 分支，第4日夺营接续演出）══════════
    //   触发条件：coup_resolver 在同一次踏入中军场院时已置 branch='officer_letter'；本触发器顺次接续。
    //   流程：韩铁托密令 → 北墙水沟缺口 → 太平道伏兵截杀(战斗) → 揣信出营（收尾在 engine.onCombatResult）。
    T.push({
      id: 'coup_officer_letter_scene', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
      cond: { flags: { 'flags.coup.branch': 'officer_letter' }, notFlag: 'flags.coup.officer_letter_escaped' },
      steps: [
        { t: 'log', cls: 'warn', text: '火光里，韩铁一把揪住你，将一封蜡封密令塞进你掌心：「拿着——营要乱了，这是活路，也是韩某的脸面。」' },
        { t: 'npcTalk', npc: 'han_tie',
          prompt: '韩铁压低嗓：「出北墙，把这信交给白檀屯的穆老——他能搬来救兵。这营里活着的信，就剩你一封。别让韩某死不瞑目。」',
          asks: [
            { label: '〔接令〕将密令贴胸揣好', then: [
              { t: 'setFlag', path: 'flags.coup.letter_in_hand', value: true },
              { t: 'log', cls: 'good', text: '你将蜡封密令贴肉藏进怀里。韩铁拍了拍你肩，转身没入火光——这一去，他再没回来。' }
            ] },
            { label: '〔问明接应〕先问清白檀屯虚实', then: [
              { t: 'setFlag', path: 'flags.coup.letter_in_hand', value: true },
              { t: 'setFlag', path: 'flags.coup.asked_mu', value: true },
              { t: 'log', cls: 'npc', text: '你攥住他手腕：「白檀屯穆老，我怎知不是空头人情？」韩铁咧嘴：「穆老是我同乡老卒，他认这密令的火漆——你只管去，说『韩教头最后那封活信』，他必信。」' }
            ] }
          ] },
        { t: 'log', cls: 'env', text: '你猫腰避开乱兵，沿墙根摸到北墙水沟缺口。土腥混着火药味，远处杀声渐密。〔暗号〕出了北墙，沿官道往北便是林径——穆老的人在岔道接应。' },
        { t: 'npcTalk', who: 'you',
          prompt: '北墙缺口外影影绰绰，一队太平道伏兵早已守在那里。你怎么过这道缺口？',
          asks: [
            { label: '〔潜行贴渠〕屏息溜过水沟', then: [
              { t: 'setFlag', path: 'flags.coup.officer_letter_sneak', value: true },
              { t: 'log', cls: 'combat', text: '你贴着水渠石壁挪步，枯枝却在脚下咔嚓一响——伏兵的火把猛地转过来：「有动静！」你已无路，只得挺身上前。' },
              { t: 'combat', enemy: 'yth_intercept' }
            ] },
            { label: '〔强突〕一鼓作气冲过去', then: [
              { t: 'log', cls: 'combat', text: '你低喝一声，撞开缺口的荆棘直冲出去——伏兵早有防备，长钩挠钩兜头落下。' },
              { t: 'combat', enemy: 'yth_intercept' }
            ] }
          ] }
      ]
    });

    // ══════════ 韩铁线收尾·白檀屯救兵（coup.officer_letter 后续）══════════
    //   触发：揣信逃出后落到林径（lindao）接应点；仅 officer_letter 分支（letter_in_hand）命中。
    //   流程：穆老信使认出密令 → 交付 → 救兵出发 → 边军支线种子（mu_lao 好感）+ 首尾呼应韩铁。
    T.push({
      id: 'coup_reinforcements_scene', hook: 'onEnter', room: 'lindao', once: false,
      cond: { flags: { 'flags.coup.letter_in_hand': true }, notFlag: 'flags.coup.reinforcements_done' },
      steps: [
        { t: 'log', cls: 'env', text: '林径口，一个独眼老卒牵着空马候在岔道，见你怀中那封蜡封密令的形制，眼睛一亮，迎上前来。' },
        { t: 'npcTalk', npc: 'mu_lao',
          prompt: '独眼老卒抱拳：「白檀屯穆老遣某在此候着。韩教头临行前便吩咐：活着的信一到，救兵即刻拔营。把信予我，穆老的人马今夜便踏平那座牢笼。」',
          asks: [
            { label: '〔交付密令〕将蜡封密令递过', then: [
              { t: 'setFlag', path: 'flags.coup.reinforcements_done', value: true },
              { t: 'log', cls: 'good', text: '你递出密令。老卒就着月色验讫，翻身上马，疾驰而去——马蹄声里，是韩铁没能等到的那支兵。' },
              { t: 'log', cls: 'order', text: '〔边军支线·起〕穆老记下了你这封活信的人情。北疆白檀屯，自此与你有了牵连。' },
              { t: 'favor', npc: 'mu_lao', amount: 1 },
              { t: 'exp', amount: 60 },
              { t: 'log', cls: 'sys', text: '〔夺营线·收束〕韩铁把活路给了你，自己留在了营里。信到，救兵必至——他流的那点血，没有白流。' }
            ] },
            { label: '〔先报韩铁近况〕「韩教头托我带一句话」', then: [
              { t: 'setFlag', path: 'flags.coup.reinforcements_done', value: true },
              { t: 'setFlag', path: 'flags.coup.told_han_tie', value: true },
              { t: 'log', cls: 'npc', text: '你没先交令，只哑声道：「韩教头让我带话——他说白檀屯的兵，今夜必至；他自己在营里，断后。」老卒眼眶一红，猛地抱拳：「韩教头……某记下了。这封信，某替他送到。」' },
              { t: 'log', cls: 'order', text: '〔边军支线·起〕穆老记下了韩铁与你的两重人情。北疆白檀屯，自此与你有了牵连。' },
              { t: 'favor', npc: 'mu_lao', amount: 2 },
              { t: 'exp', amount: 60 },
              { t: 'log', cls: 'sys', text: '〔夺营线·收束〕韩铁把活路给了你，自己留在了营里。信到，救兵必至——他流的那点血，没有白流。' }
            ] }
          ] }
      ]
    });

    // ══════════ 第三批·仓中翻找：翻出仓吏点名的那件，交回仓里才算完（v20260920h） ══════════
    //   接活时随机指定目标物（flags.task.rummage_target），此处只认目标件结活；
    //   翻到别的可留可交（交非目标件走好感增减，不会吞东西）。
    [['mucai', '木材'], ['rope', '绳'], ['bumu', '粗布']].forEach(function (f) {
      T.push({
        id: 'rummage_give_' + f[0], hook: 'onGive', npc: 'storeman', room: 'kuyilao', cell: [2, 1], item: f[0], once: false,
        cond: { flags: { 'flags.task.rummage_started': true, 'flags.task.rummage_target': f[0] }, notFlag: 'flags.task.rummage_done' },
        steps: [
          { t: 'setFlag', path: 'flags.task.rummage_cnt', increment: true },
          { t: 'setFlag', path: 'flags.task.rummage_done', value: true },
          { t: 'completeQuest', id: 'store_rummage' },
          { t: 'favor', npc: 'storeman_kuyilao', amount: 1 },
          { t: 'exp', amount: 20 },
          { t: 'log', cls: 'npc', text: '〔仓吏〕接过「' + f[1] + '」掂了掂：「翻出来的东西也肯交回来——仓里缺的不是物件，是这样的人。」' },
          { t: 'log', cls: 'good', text: '〔任务完成·仓中翻找〕修为+20 · 仓吏好感+1' }
        ]
      });
    });

    // ════════════════ 营中苦役·任务化（v20260911i） ════════════════
    // 症结：营中「担石劳作 / 下地务农 / 搬石料」此前只是面板上的一个按钮 —— 点完吐一句旁白就完事，
    //   没有交代、没有进度、更没有交付与赏，交互到此为止，营中一日也就没什么可盼的。
    // 改造：三桩苦役各挂一位当值 NPC，走完整闭环 ——
    //   交谈 → 发布 → 接受／婉拒 → 任务日志记 N/3（点「任务」可随时查）→ 干满 → 回头复命领赏。
    //   进度取「活计计数」flags.task.<key>_cnt —— 由给予面板在交出去那一刻累加（kyl_farm_give / kyl_stone_give），
    //   不再随格上的通用劳作按钮累加（v20260914e：那会让人点几下「下地务农」就把差事交了）。
    // ⚠️ 两条约定：
    //   ① 必须排在本文件 sun_routes 之后 —— 孙老先把「十条出路」讲完，再谈他田里的活计；
    //   ② 不写 cell —— NPC 有时辰作息会挪格，而「能对谈」本身就意味着他正在本格
    //      （talk 入口由 cityCellNpcs 按作息过滤过），写死 cell 反而会出现「人在这儿却交不上任务」。
    // v20260914e：牛铁那条「担石充役」已退为自由劳作（场院〔担石劳作〕只挣工分，不再成其为差役）——
    //   它就一个按钮，点一下便完事，玩家使不上劲。留下的两桩差役都要求：赴实地做工 → 把东西交到人手上。
    //   派活与收活还特意分人：田是孙老派、伙房鲁大收（各管一摊，正是营里的样子）。
    // v20260914f：派活统一收到中军帐那块「差役牌」上（engine.js JOB_BOARD）—— 木牌上摘木牍即领活，
    //   去实地做出东西，再交给牌上写明的收差人。交差走给予面板（onGive），东西真从行囊里扣掉；
    //   故此处的 onTalk 只管「催活」与「教他怎么交」，不再管发布与领赏（领赏见下方 kyl_farm_give）。
    //   采石那桩不再另立一条：本就有「采石充仓」（kyl_stone_*），只是改由木牌发布，免得两条采石打架。
    var LABOR_QUESTS = [
      { key: 'farm', npc: 'sun_lao', to: 'lu_da', quest: 'camp_farm', title: '开垦薄田', board: true,
        prog: '孙老拄着锄把，眯眼瞅你：「地翻透了没有？翻透了就掐两捧菜，捧去伙房给鲁大——是交到他手上，不是跟他说一声。」',
        progTo: '鲁大瞥了眼你怀里：「菜呢？掐了就递过来——点我，选「给予」，把菜择出来给我。空着手说干了活，不算数。」',
        // v20260916f：after 挂在派活人（孙老）的 onTalk 上 —— 旧文案写的是收差人鲁大的话，
        //   于是「送完菜去找孙老聊天」弹出的是鲁大台词（角色错位）。改为孙老自己的了结话。
        after: '孙老拄着锄把，看着你直点头：「菜送到了鲁大手上，老朽都听说了——那块地往后归你照看，收成自己留着。」' }
    ];
    LABOR_QUESTS.forEach(function (q) {
      var K = 'flags.task.' + q.key;
      var TO = q.to || q.npc;             // 收差人（派活与收活未必同一个人：田是孙老派、伙房鲁大收）
      function flagObj(suffix, val) { var o = {}; o[K + suffix] = val; return o; }
      // ① 发布：v20260914f 起不再由 NPC 对话发布 —— 差役牌上摘木牍即为领活（q.board）。
      //   两处都能接，账就对不上了（木牌写「可接」、NPC 又问一遍），故此条整体撤掉。
      // ② 收差人对话：不判完成，只催 + 教他怎么交 —— 真正的判定在 onGive（kyl_farm_give / kyl_stone_give）。
      T.push({
        id: 'kq_' + q.key + '_give', hook: 'onTalk', npc: TO, room: 'kuyilao', once: false,
        cond: { flags: flagObj('_started', true), notFlag: K + '_done' },
        steps: [ { t: 'log', cls: 'npc', text: q.progTo || q.prog } ]
      });
      // ③ 派活人：只报进度
      T.push({
        id: 'kq_' + q.key + '_prog', hook: 'onTalk', npc: q.npc, room: 'kuyilao', once: false,
        cond: { flags: flagObj('_started', true), notFlag: K + '_done' },
        steps: [ { t: 'log', cls: 'npc', text: q.prog } ]
      });
      // ④ 了结之后
      T.push({
        id: 'kq_' + q.key + '_done', hook: 'onTalk', npc: q.npc, room: 'kuyilao', once: false,
        cond: { flags: flagObj('_done', true) },
        steps: [ { t: 'log', cls: 'npc', text: q.after } ]
      });
    });

    // ════════════════ 巡夜查房·逾时不归的强制措施（v20260911i） ════════════════
    // 症状：laotou_late 只在「玩家自己走回牢房」时才触发 —— 不进牢房，就永远没有鞭子。
    //   于是「不回牢点卯」反倒成了躲开营规的办法，人可以整夜在外头浪。
    // 对策（逃脱者2 式查房）：由引擎 curfewPatrol() 判定「戌时后仍在营中游荡而未归牢」，
    //   以 onPatrol 钩子把巡夜狱卒叫来 —— 押回牢房格 + 三鞭 + 记一次逾时（旷役当场扣口粮，v20260916h）。
    //   人在牢里则安全；一旦又溜出去，照样再拿（引擎侧在归牢时清掉「今夜抓过了」的印记）。
    T.push({
      id: 'curfew_patrol', hook: 'onPatrol', once: false,
      cond: { flags: { 'flags.onb.curfewSet': true }, notFlag: 'flags.onb.done' },
      steps: [
        { t: 'log', cls: 'warn', text: '〔更鼓〕戌时鼓落，营门落锁，巡夜的灯笼一盏一盏移过来……' },
        { t: 'branch',
          if: { player: { 'flags.onb.missCount': { max: 0 } } },
          then: [
            // 初犯（v20260916a）：说教为主，押回不鞭、不记过 —— 把「戌时前回牢」的规矩讲清楚，
            //   别让新手第一回被灯笼吓着就挨三鞭 + 扣口粮（那挫败感太硬）。
            { t: 'setFlag', path: 'flags.onb.lateDone', value: true },   // 仍记「已罚」，免得押回时 laotou_late 再罚一道
            { t: 'forceRoom', room: 'kuyilao', cell: [1, 0] },
            { t: 'setFlag', path: 'flags.onb.curfewFirstWarn', value: true },
            { t: 'log', cls: 'npc', text: '〔牢头〕灯笼照住你的脸。牢头皱着眉打量你两眼：「头一回，念你初犯——这顿鞭子先记在账上。营规第七条：戌时后须在牢里。下回再撞见，可就是三鞭加罚粮了。回去！」' },
            { t: 'log', cls: 'sys', text: '你被押回了牢房格。脊背没挨鞭子，但牢头那双眼你记住了——戌时前回牢，才是正理。' }
          ],
          else: [
            // 再犯：原三鞭版（押回 + 三鞭 + 记逾时 + 次日口粮加倍）
            { t: 'npcTalk', npc: 'laotou',
              prompt: '灯笼照住你的脸。巡夜狱卒把铁链往地上一顿，哗啦一响：「鼓都敲过几回了，还在这儿晃？营规第七条——戌时后不在牢里，视同脱逃！」',
              asks: [
                { label: '〔束手就擒〕……我随你回去。',
                  then: [
                    { t: 'setFlag', path: 'flags.onb.lateDone', value: true },   // 先记「已罚」，免得押回时 laotou_late 再罚一道
                    { t: 'setFlag', path: 'flags.onb.missCount', increment: true },
                    { t: 'forceRoom', room: 'kuyilao', cell: [1, 0] },
                    { t: 'hurt', amount: 15, favor: -1, favorNpc: 'laotou', fxText: '鞭！' },
                    { t: 'log', cls: 'sys', text: '一路拖回牢区，脊背上结结实实挨了三鞭，血齿间都是铁锈味。（气血 -15，牢头好感 -1）' },
                    { t: 'log', cls: 'order', text: '〔逾时不归〕牢头在册上记你一笔旷役，口粮当场扣了一份——往后戌时前回牢销名，躲是躲不掉的，营规自会来拿人。' }
                  ] },
                { label: '〔嘴硬〕我偏在外头站着，你能奈我何？',
                  then: [
                    { t: 'setFlag', path: 'flags.onb.lateDone', value: true },
                    { t: 'setFlag', path: 'flags.onb.missCount', increment: true },
                    { t: 'forceRoom', room: 'kuyilao', cell: [1, 0] },
                    { t: 'hurt', amount: 15, favor: -1, favorNpc: 'laotou', fxText: '鞭！' },
                    { t: 'log', cls: 'sys', text: '狱卒冷笑：「嘴硬的，都挨双份。」铁链一抖，仍把你拖走了。（气血 -15，牢头好感 -1）' },
                    { t: 'log', cls: 'order', text: '〔逾时不归〕你还是被押回了牢房格。硬话换不来情面——戌时前回牢才是正经。' }
                  ] }
              ] }
          ] }
      ]
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
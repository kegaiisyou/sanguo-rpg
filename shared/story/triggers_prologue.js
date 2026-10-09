// 乱世烽火 · 触发剧本 —— 序章·苦役营·密道线
//   开场三拍 / 担石劳作 / 走廊更鼓 / 囚室暗号 / 林径寻药篓 / 水渠夜遁
//
// 由 shared/story/triggers.js 汇总加载（v20261008p 按剧情线拆分）。
// 本文件内的 push 顺序即最终 TRIGGERS 顺序中的一段，段内勿随意调换。
(function (global) {
  var LF = global.LF = global.LF || {};

  LF.pushTriggersPrologue = function (T) {
    // ───────────────────────── 开场教学：苦役营·密道线 ─────────────────────────

    // 1) 牢房·开场「醒」三拍（P0 · v20260913c）：本触发器在【序章开场动画演毕、牢房渲染完成】后才评估。
    //    动画本身由 core/engine.js · playPrologue() 在全屏 #prologue 幕布上演出（见 index.html / game.css）；
    //    新档进入时 enterGame 先播动画，动画结束时才 renderRoom → 到这里正好是「角色已被推进牢房」。
    //
    //    为什么从「一口气六条」改成「一拍一按」（v20260913c）——玩家原话：
    //      「整体文字一次性给太多了，需要把他们拆分开，一开始先不要玩家检视自身，
    //        先交互或者按一些按钮之后，再出现这些文字。」
    //    旧版进门连刷六条（铁链／牢门／嗓子／尘土／「你低头看自己」／行囊），其中有两处真问题：
    //      · 字数：六条一屏，读都没读完就被推着走；
    //      · 替主角做事：人还没睁眼，旁白先替他「低头看自己」—— 玩家是「被喂」而不是「在动」。
    //    现在：帘头署「你」；一上场只给一个可点的动作（睁眼／撑起身／摸身上），点了才落一句回声；
    //    「低头看自己」挪到第三次点击之后；身体的事讲完，才点亮「行囊」页签。
    //    周听涛那嗓子与「叩牢门」的引导都不在这里 —— 等玩家真的开了行囊、又合上，再说（engine·onbAfterPack）。
    //    帘内推进由玩家点按驱动（v20260913a 起），所以这一串不会自己往下滚。
    T.push({
      id: 'camp_opening', hook: 'onEnter', room: 'camp_tz1', once: false,
      // once:false：旧存档若遗留 trg.camp_cell_enter=true，仍会拦住补播；置 false 后仅由 prologueShown 旗标控制（只播一次）
      cond: { notFlag: 'flags.onb.prologueShown' },
      steps: [
        { t: 'reveal', layer: 'npc' },
        { t: 'reveal', layer: 'lower' },
        { t: 'reveal', layer: 'actions' },
        // 先给体感，再给字：铁链与牢门配一记屏震＋闷响（fx = 屏震／音效／手机轻颤，v20260913c 新增）
        { t: 'fx', shake: true, sfx: 'close', buzz: 26 },
        { t: 'log', cls: 'sys', text: '铁链啷当，你被推进牢里。' },
        // 拍①：醒了没 —— 两个分支各落一句回声，然后合流到拍②（无 then 时自然 next 到下一步）
        {
          t: 'npcTalk', who: '你', prompt: '霉土气呛人，眼前一片昏黑，栅外有人影晃。',
          asks: [
            { label: '〔睁眼看〕', sayTo: 'dlg', say: '你睁开眼。栅缝漏进一线天光，照见草荐、水渍，和墙上深深浅浅的刻痕。' },
            { label: '〔先不动，听一听〕', sayTo: 'dlg', say: '你没动。镣铐随呼吸轻响，栅外脚步来来回回，有人压着嗓子低语。' }
          ]
        },
        // 拍②：撑起身（帘里只有一问，一次只给一件事）
        {
          t: 'npcTalk', who: '你', prompt: '牢门合拢的闷响还在耳里，手脚沉得像灌了铅。',
          asks: [{ label: '〔撑起身〕', sayTo: 'dlg', say: '你撑起身来，尘土从墙隙里翻涌而下。' }]
        },
        // 拍③：到这一步才谈「自己身上还剩什么」，并顺手把「行囊」页签亮出来（介绍到哪、才放行哪）
        {
          t: 'npcTalk', who: '你', prompt: '低头看看自己身上——',
          asks: [{
            label: '〔摸一摸身上〕', sayTo: 'dlg',
            say: '一身赭色囚服，脚踝上一副生铁镣。走一步，便哗啦一响。这差不多就是你如今全部的家当了。',
            then: [
              { t: 'unlockDock', key: 'pack' },
              { t: 'highlight', dock: 'pack' },
              { t: 'log', cls: 'order', text: '〔行囊〕囚服镣铐俱在此中。点下方「🎒 行囊」细看。' }
            ]
          }]
        },
        { t: 'moveGate', fwd: '__locked__', hint: '牢门紧锁，须先与牢头说通，方可出牢。' },
        { t: 'setFlag', path: 'flags.onb.prologueShown', value: true },
        // 开场落定 → 目标条这时才从「无」切到「点行囊」（onbGoalStep ⓪ 在 prologueShown 之前一律不给目标）
        { t: 'goal' }
      ]
    });

    // 2.2) 首次担石劳作：记一次劳作体验，并顺带点亮状态栏 + 位置页签（自然的「干完活才看自身状态」时刻）
    T.push({
      id: 'labor_first', hook: 'onCustom', room: 'kuyilao', cell: [1,1], once: true,
      cond: { notFlag: 'flags.onb.labored' },
      steps: [
        { t: 'log', cls: 'sys', text: '你扛起乱石，肩头火辣。囚徒如蚁，皮鞭声在身后炸响——这便是苦役营的日夜。' },
        { t: 'setFlag', path: 'flags.onb.labored', value: true },
        { t: 'reveal', layer: 'status' },
        { t: 'reveal', layer: 'loctab' },
        // v20260914c：扛完一工正是「看自己」最有痛感的时刻 —— 精力气血是真掉了一截，不是凭空叫人多看一眼面板。
        //   此时才把「角色」页签亮出来（教学期没介绍到的一律还藏着，见 onbUnlockDock），并一句点明它管着什么。
        { t: 'unlockDock', key: 'char' },
        { t: 'highlight', dock: 'char' },
        { t: 'log', cls: 'order', text: '〔角色〕肩头火辣，气力下去一截。点下方「🧭 角色」——气血精力、四维加点、门派去就，都记在那儿。' },
        { t: 'goal' }
      ]
    });

    // 2.5) 环顾四周（勘察劳役场）：揭示去路，自然引导（不明示去向，留玩家自由探索）
    T.push({
      id: 'survey_yard', hook: 'onCustom', room: 'kuyilao', cell: [1,1], once: true,
      cond: { flags: { 'flags.onb.labored': true }, notFlag: 'flags.onb.surveyed' },
      steps: [
        { t: 'log', cls: 'sys', text: '你环顾劳役场：西边塌了半截的墙根，藤蔓爬墙——那是营墙的缺口；东南一道低矮门洞，通向囚室。' },
        { t: 'log', cls: 'sys', text: '狱卒往来，各处出口皆被看死，唯有那塌墙根透着几分松动。' },
        { t: 'setFlag', path: 'flags.onb.surveyed', value: true },
        { t: 'sys', text: '你记下了几处去路。场中那相面的蓬头囚徒似乎藏了不少门道，若有闲，再凑近问问也无妨。' }
      ]
    });

    // 2) 周听涛·相士底：初次交谈，自介并发布「寻吃食」任务
    //    v20260911i：任务改为「当面取舍」——先由玩家应下（或婉拒），acceptQuest 才把它记进任务日志。
    //    旧版是话还没问完就先替玩家接了任务（acceptQuest 排在 npcTalk 之前），等于剥夺了玩家的选择。
    T.push({
      id: 'zt_intro', hook: 'onTalk', npc: 'zhoutingtao', room: 'camp_tz1', once: true,
      cond: { notFlag: 'flags.task.zt_intro' },
      steps: [
        { t: 'setFlag', path: 'flags.task.zt_intro', value: true },   // 「谈过」≠「接下」，婉拒后由 zt_retry 再问
        { t: 'npcTalk', npc: 'zhoutingtao',
          prompt: '尘埃稍落，才看清栅里那人：蓬头垢面，满身旧伤，眼神却清亮。他拖长腔道：「某周听涛，天下数一数二的相士——」随即压低嗓子：「你这新来的，命数古怪，像一个老夫看不透的变数。去营中寻些吃食来，老夫便替你寻一丝破解之法。这桩差事，你应是不应？」',
          asks: [
            { label: '〔应下〕好，我去寻些吃食来。',
              set: { 'flags.task.zt_accepted': true },
              say: '你点头应下。周听涛咧嘴一笑，露出豁牙：「痛快！〔寻吃食·破命数〕已替你记在册上了——常点下头「任务」看看进度，别把老夫的饼忘了。」随即又摆手：「记着，吃食要交到老夫手上（点老夫，选「给予」），空着手来跟老夫说话不算数。」',
              // v20260911k：既然让他「点下头任务看进度」，就得先把下方那排按钮亮出来 ——
              //   此前教学期 #dock 一直藏着，指引指向的是个看不见的按钮（体验断点）。
              then: [ { t: 'acceptQuest', id: 'zt_food' }, { t: 'unlockDock', key: 'quest' }, { t: 'reveal', layer: 'dock', highlight: true } ] },
            { label: '〔婉拒〕我一个将死之人，不信什么命数。',
              say: '周听涛也不恼，拖长腔笑了一声：「命数这东西，你信它时它才压你。也罢——几时想通了，几时再来寻老夫。」〔婉拒：任务未接，随时可回来应下。〕' }
          ] }
      ]
    });

    // 2.1) 婉拒之后再问一次：周听涛仍愿把差事交你，答应的那一刻才入任务日志
    //    （旧版婉拒即断线；此处让「拒绝」是个真选项，而不是把路堵死）
    T.push({
      id: 'zt_retry', hook: 'onTalk', npc: 'zhoutingtao', room: 'camp_tz1', once: false,
      cond: { flags: { 'flags.task.zt_intro': true }, notFlag: 'flags.task.zt_accepted' },
      steps: [
        { t: 'npcTalk', npc: 'zhoutingtao',
          prompt: '周听涛斜靠栅栏，似笑非笑地看你，手里捏着根草茎：「如何，可想通透了？替老夫寻些吃食来——我便替你掐一掐这道乱命的头绪。」',
          asks: [
            { label: '〔应下〕我这就去寻。',
              set: { 'flags.task.zt_accepted': true },
              say: '「好，好。」周听涛搓了搓手，把草茎一折：「〔寻吃食·破命数〕记你册上了。营里不白给饭——去中军场院「担石劳作」，干满三工挣一枚劳字木片；再往营西伙房（有灶台那一格），拿木片换一份干粮。记着：吃食要交到老夫手上（点老夫，选「给予」），空着手来说话不算数。」',
              then: [ { t: 'acceptQuest', id: 'zt_food' }, { t: 'unlockDock', key: 'quest' }, { t: 'reveal', layer: 'dock', highlight: true } ] },
            { label: '〔仍不〕再容我想想。', say: '「也罢，也罢。」他摆摆手，重新闭上眼，掐他那些没头没尾的卦。' }
          ] }
      ]
    });

    // 2.5) 周听涛·交吃食→破命数（v20260914g 改：交付一律走「给予」，对话只管指路）
    //   旧版：身上有干粮时点「交谈」即自动交付（consume fan）—— 玩家什么都没做，聊一句天就算交了差，
    //     「给予」这套交付机制在这条线上始终用不上，于是这条任务给人的感受就是「不用提交、也不知找谁」。
    //   现在：真交付挂在 zt_food_give（hook:'onGive'）—— 点周听涛、选「给予」、把干粮择出来，行囊真扣一件；
    //     此处只按「当下手里有什么」指路：没木片 → 去挣；有木片 → 去换；有干粮 → 教他怎么递。
    //     三条支路写在同一条触发器里（cond 无 notHasItem，故用 branch 嵌套判），免得多条 onTalk 互相打架。
    T.push({
      id: 'zt_food_deliver', hook: 'onTalk', npc: 'zhoutingtao', room: 'camp_tz1', once: false,
      cond: { flags: { 'flags.task.zt_accepted': true }, notFlag: 'flags.task.zt_food_done' },
      steps: [
        { t: 'branch',
          if: { hasItem: 'fan' },
          then: [
            { t: 'log', cls: 'npc', text: '〔周听涛〕眼巴巴瞅着你怀里那半张饼：「吃食在手了？莫叫老夫空欢喜——点老夫，选「给予」，把干粮择出来递过来。空手跟老夫说话，不算数。」' }
          ],
          else: [
            { t: 'branch',
              if: { hasItem: 'lao_pai' },
              then: [
                { t: 'log', cls: 'npc', text: '〔周听涛〕「木片有了？好。往营西伙房——有灶台那一格，把木片递上去换一份干粮；换来了，再送来与老夫。」' }
              ],
              else: [
                { t: 'log', cls: 'npc', text: '〔周听涛〕「空着手来见老夫？营里不白给饭：去中军场院「担石劳作」，干满三工换一枚劳字木片；拿了木片，往营西伙房换干粮。老夫只认拿到手的东西。」' }
              ] }
          ] }
      ]
    });
    // 2.6) 交付：把干粮「给予」周听涛 —— 东西已由引擎 giveItemToNpc 从行囊扣掉（先扣后触发），
    //   此处只管认下这桩吃食、授密道线、结清任务。不写 consume（会二次扣除）。
    T.push({
      id: 'zt_food_give', hook: 'onGive', npc: 'zhoutingtao', room: 'camp_tz1', item: 'fan', once: false,
      // v20260924z2：仍要求已接取（zt_accepted）—— 差事得先应下，交付才认账。
      //   notFlag 用 zt_food_done 而非 route.crypt：若此前曾置过密道线索旗标（crypt）但任务未结清
      //   （异常态/老档），crypt 会把它永久拦死——用完成标记判定，只要任务没结 + 已应下 + 干粮在手就给认。
      cond: { flags: { 'flags.task.zt_accepted': true }, notFlag: 'flags.task.zt_food_done' },
      steps: [
        { t: 'log', cls: 'npc', text: '你将从伙房换来的干粮递过去。周听涛眼睛一亮，也不客气，三两口扒了半张饼，这才正色道：「好，这桩吃食老夫领了——既食人之禄，便替你掐一掐这乱如麻的命数。」' },
        { t: 'setFlag', path: 'flags.route.crypt', value: true },
        { t: 'completeQuest', id: 'zt_food' },
        { t: 'setFlag', path: 'flags.task.zt_food_done', value: true },
        { t: 'exp', amount: 20 },
        { t: 'log', cls: 'good', text: '周听涛屈指掐算，半晌忽一笑：「果然……你这命格，乱中藏变。营后塌墙根下有暗道，默叔替老夫守着。夜里随我来——记着，塌墙根，寻默叔。」〔已得密道线索：先去囚室寻默叔对暗号，再赴塌墙根钻暗道。〕' }
      ]
    });

    // 3) 牢门门禁：叩门→牢头问答，是才开门（moveGate 锁死全出口，开门即清）
    //    v20260911g：开门此刻不再点亮顶栏——「顶上时辰」改在出牢后牢头指更鼓时一并介绍（见 laotou_corridor）。
    T.push({
      id: 'laotou_door', hook: 'onTalk', npc: 'laotou', room: 'camp_tz1', once: false,
      cond: { notFlag: 'flags.onb.cellOpen' },
      steps: [
        { t: 'npcTalk', npc: 'laotou',
          prompt: '你叩了叩牢门。栅外传来粗哑嗓门：「谁在那头敲？哦——新来的囚籍。少在里头装蒜，想通了没，要不要出来干活？」',
          asks: [
            { label: '想通了，求牢头放我出去干活', set: { 'flags.onb.cellOpen': true },
              then: [
                { t: 'clearGate' },
                { t: 'log', cls: 'order', text: '牢头「咔哒」开了锁：「出来罢。去廊口候着，老子有话交代——记住，戌时前回牢过夜，晚了有你挨的。」〔栅门开了，〔南〕可出牢房。〕' }
              ] },
            { label: '再想想，暂不出门', say: '牢头「呸」了一声：「不识抬举！想通透了再来敲。」栅外脚步声远了。〔牢门仍锁着。〕' }
          ] }
      ]
    });

    // 3.5) 牢头·出场后三话题（税赋/悲苦/天字一号疯子）
    T.push({
      id: 'laotou_topics', hook: 'onTalk', npc: 'laotou', roomIn: ['camp_tz1','kuyilao'], once: false,
      cond: { flags: { 'flags.onb.cellOpen': true } },
      steps: [
        { t: 'npcTalk', npc: 'laotou',
          prompt: '牢头抱着臂，斜眼打量你。',
          asks: [
            { label: '〔打听因何入营〕', say: '牢头嗤笑：「你当自己犯了什么大罪？呸，不过是交不起租赋，被衙役当壮丁抓来抵数。这年头，十室九空，税比刀狠。」' },
            { label: '〔问外头光景〕', say: '牢头朝墙外啐了一口：「外面？也好不到哪去。蝗灾旱灾接连着来，太平道那帮人趁机蛊惑，到处都是饿殍。蹲在这营里，反倒落个温饱。」' },
            { label: '〔问隔壁牢房〕', say: '牢头压低声：「隔壁天字一号那厮，天天自言自语，疯疯癫癫——你莫去招惹。前儿他还冲着墙比划，嘴里念叨『甲子』『苍天』的胡话，邪门得紧。」' }
          ] }
      ]
    });

    // 3.2) 走廊·更鼓与点卯（P1 · v20260911g）：出牢后首次到牢廊（城格 kuyilao 1,0）
    //   —— 教程里「时间系统」的亮相节拍就在此处，顺序严格照设计走：
    //       ① 牢头指着廊口那面「值更鼓」，喝你去前头干活、并交代「几点前必须回来」；
    //       ② 说到鼓，顺势讲营里的时辰（十二时辰、卯时开牢、戌时闭门）；
    //       ③ 这一刻才点亮顶部状态栏（顶上「时辰」）+ 位置页签，并高亮顶栏；
    //       ④ clockOn 置位 = 时间正式开始流动（点卯/晚归判定随之生效）。
    //   注：出门不再单发旁白（与牢头台词重复）——场景描写并入 npcTalk 提示词，一次讲完。
    //   注：铺垫/收尾一律用 log（同步 next），勿用 narrate（会阻塞其后的 npcTalk，见 §9.61）。
    T.push({
      id: 'laotou_corridor', hook: 'onEnter', room: 'kuyilao', cell: [1, 0], once: true,
      cond: { notFlag: 'flags.onb.curfewSet' },
      steps: [
        { t: 'reveal', layer: 'npc' },
        { t: 'reveal', layer: 'lower' },
        { t: 'reveal', layer: 'actions' },
        { t: 'npcTalk', npc: 'laotou',
          prompt: '廊口杵着个歪戴幞头的牢头，手里转着一串铁钥匙，眯眼打量你这身囚服，啧了一声：「别在廊下晃——去前头劳役场干活。瞧见那口铜壶漏刻没有？营里没有日晷，黑天白日全凭它滴答报辰。午后牢头回牢门口守着，戌时前你回牢过夜，销名的字就落给你。」',
          asks: [
            { label: '〔记下了〕午后回牢销名，戌时前归牢过夜。', then: [
              // 统一拨回清晨卯时（v20260911i）：在这之前牢中时辰是冻结的（clockFlowing 为假），
              // 玩家可能已在牢里反复打盹；就在「介绍时辰」这一槌上把漏刻校准——于是「踏出牢门」
              // 永远是白天，绝不会出现「一出门就已经入夜」的荒谬。
              { t: 'setTime', hour: 3, clock: 360 },
              { t: 'log', cls: 'env', text: '（漏刻滴答走水，漏箭浮到卯位，廊外天光正好——卯时刚过，日头才爬上营墙。）' },
              { t: 'log', cls: 'npc', text: '牢头嗤笑：「一昼夜十二时辰，漏刻走一格换一辰：卯时开牢放风，戌时鸣鼓闭门。过了戌时你还不回，按营规吃三鞭，门一落锁，你便蹲到明日。」' },
              { t: 'reveal', layer: 'status', highlight: true },
              { t: 'reveal', layer: 'loctab' },
              { t: 'log', cls: 'order', text: '〔时间系统〕顶上那一行便是「时辰」——点名、放风、点卯、晚归，皆以它为准；点它可展开钟表，日头与天候也在其上。' },
              { t: 'log', cls: 'order', text: '〔门禁〕戌时（约晚七点）前须回牢过夜，逾时受鞭刑；销名午后牢头回牢门口即可办。' },
              { t: 'setFlag', path: 'flags.onb.clockOn', value: true },
              { t: 'setFlag', path: 'flags.onb.curfewSet', value: true },
              { t: 'setFlag', path: 'flags.onb.curfewHour', value: 10 },
              { t: 'setFlag', path: 'flags.onb.curfewLabel', value: '戌时（约 19:00–21:00）' },
              // 牢头讲罢营规，顺手把「点卯应名」这桩例事挂上（acceptQuest 幂等，兜底段再挂一次无妨）
              // v20260920d：有任务就该亮任务栏——页签随第一桩任务出现而激活（此前要等周听涛才亮，属疏漏）
              { t: 'unlockDock', key: 'quest' },
              { t: 'acceptQuest', id: 'roll_call' }
            ] }
          ] },
        // 兜底（幂等）：即便玩家未点选项就离开，也确保门禁/时辰校准已生效，晚归判定不会失灵
        { t: 'setTime', hour: 3, clock: 360 },   // 一并兜一次「拨回清晨」（v20260911i）
        { t: 'setFlag', path: 'flags.onb.clockOn', value: true },
        { t: 'setFlag', path: 'flags.onb.curfewSet', value: true },
        { t: 'setFlag', path: 'flags.onb.curfewHour', value: 10 },
        { t: 'setFlag', path: 'flags.onb.curfewLabel', value: '戌时（约 19:00–21:00）' },
        { t: 'unlockDock', key: 'quest' },
        { t: 'acceptQuest', id: 'roll_call' },
        // v20260912f：出牢头一件事就是去中军场院 —— 廊口这一段只放行〔南〕，
        //   农田、矿坑等方向此刻走不通（罗盘上按下去也只给一句提示）。
        //   到中军场院（cell 1,1）即由 yard_clear_gate 解除，恢复自由探索。
        { t: 'moveGate', only: ['南'], hint: '廊口只一条道：往南去中军场院听差。别处的路，眼下还轮不到你走。' }
      ]
    });
    // 3.3) 晚归·受刑（戌时后回牢：牢头好感-1、鞭打扣血，含文案+动画；离牢时重置以便每轮各罚一次）
    //   v20260916g：销名改「牢头守夜时自动落账」（autoOnbRoutines，牢头 10..2 在牢门口）——
    //     已销名的玩家（checkInDone）戌时后回牢属合规过夜，不再挨鞭；只有「没销上名」的晚归才受刑。
    //   注：铺垫用 log（同步 next）；勿用 narrate（见 3.2 注释）。
    T.push({
      id: 'laotou_late', hook: 'onEnter', room: 'camp_tz1', once: false,
      cond: { flags: { 'flags.onb.curfewSet': true }, time: { day: false }, notFlag: ['flags.onb.lateDone', 'flags.onb.checkInDone'] },
      steps: [
        { t: 'log', cls: 'env', text: '你摸黑蹭回牢门，栅外刁斗正敲——早过了戌时。' },
        { t: 'npcTalk', npc: 'laotou',
          prompt: '牢头脸一沉，灯笼照见你身上的囚服：「好小子，应卯、销名的时辰都过了，还晓得回来？营规面前不讲情——三鞭，记着下回的钟点！」',
          asks: [
            { label: '〔咬牙受刑〕', then: [
              { t: 'hurt', amount: 15, favor: -1, favorNpc: 'laotou', fxText: '鞭！' },
              { t: 'log', cls: 'sys', text: '牢头亲自动手。你背上挨了三鞭，火辣辣地疼，血齿间都是铁锈味。（气血 -15，牢头好感 -1）' },
              { t: 'log', cls: 'order', text: '〔门禁〕你已晚归受刑。明日戌时前务必回牢。' },
              { t: 'setFlag', path: 'flags.onb.lateDone', value: true }
            ] }
          ] }
      ]
    });


    // 4.5) 回到劳役场：解除塌墙根门禁
    // 修复：wall_gate 设的是全局 state.moveGate（fwd=camp_yard），离场后若不清，
    // 会残留在出生点，把「西→塌墙根」也锁死（西门目标不是 camp_yard → blocked），导致无法再西去。
    T.push({
      id: 'yard_clear_gate', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
      steps: [ { t: 'clearGate' } ]
    });

    // 4.6) 营规两条·引导弹窗（v20260916g→h）：出牢廊头一回到中军场院，把「应卯/销名」的规矩当面讲清——
    //   「卯至午到中军应名、午后牢头回牢落销名、戌时前回牢过夜、逾时扣口粮记旷役」——
    //   玩家还没开始按营规过日子，先立个明白账（弹窗必须点掉，比日志醒目）。
    T.push({
      id: 'onb_rule_guide', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: true,
      cond: { flags: { 'flags.onb.curfewSet': true } },
      steps: [
        { t: 'npcTalk', npc: 'laotou',
          prompt: '牢头背着手踱到场院当中，回头瞥你一眼：「营里两条规矩，你记牢了——头一条，卯时到午时，到中军场院应名，牢头在这儿点卯，过午不候；第二条，午后牢头回牢门口守着，戌时前你回牢过夜，销名的字就落给你。两条都办妥，这一日才算全须全尾；哪一条误了，扣口粮、记旷役，册子上都记着。」',
          asks: [
            { label: '〔记下了〕卯至午到中军应名，午后回牢销名，戌时前归牢过夜。' }
          ] }
      ]
    });

    // 5) 囚室·默叔示意暗号（逃逸前置：在囚室对上暗号，再赴塌墙根决断）
    T.push({
      id: 'moshu_signal', hook: 'onTalk', npc: 'moshu', room: 'camp_tz2', once: true,
      cond: { flags: { 'flags.route.crypt': true }, notFlag: 'flags.task.signal' },
      steps: [
        { t: 'npcTalk', npc: 'moshu',
          prompt: '默叔见是你，咧嘴无声一笑，却先抬手虚按，示意你蹲下；又伸出三根指头，缓缓收起两根，只留食指朝塌墙根一点。',
          asks: [
            { label: '（蹲下，按他手势比出「一指墙根」）',
              set: { 'flags.task.signal': true },
              say: '默叔眼中一亮，点头。他比了个「随我来」的手势，等你起身——暗号对上了。〔已与默叔对上暗号，可赴塌墙根钻暗道。〕' }
          ] }
      ]
    });



    // 6) 〔已移除〕原「逃出苦役营后·林径乌桓游骑拦路」的开场教学战，现已迁移至练武场·木人桩
    //    （train_dummy 触发 tutCombat 引导演练），出营不再强制触发战斗。

    // ════════════════ 支线：三则（v20260831t）════════════════
    // 支线A · 黑山寨·后寨「井底货」：被掳货郎吴六——放人得药(侠) / 敲诈得银(凶)
    T.push({
      id: 'wz_wuliu', hook: 'onTalk', npc: 'wuliu', room: 'ji_heishan_houzhai', once: false,
      cond: { notFlag: 'flags.wz_wuliu_done' },
      steps: [
        { t: 'npcTalk', npc: 'wuliu',
          prompt: '你走近那蜷缩货郎。他抬头见你，先是一惊，随即膝行两步：「好汉！小的是过路货郎吴六，被这伙山贼掳来三日——若得脱身，愿以命酬！」',
          asks: [
            { label: '〔侠〕割绳放他下山', set: { 'flags.wz_wuliu_done': true },
              then: [
                { t: 'grant', rep: 2, items: [{id:'caoyao', name:'草药', icon:'🌿', cat:'素材', count:2}, {id:'roubao', name:'肉包子', icon:'🥟', cat:'食饵', count:1}] },
                { t: 'log', cls: 'good', text: '你割断绳索。吴六千恩万谢，将贴身藏的草药与干粮塞进你手里，趁夜溜下山去——寨中少了一名苦力，山中多了一户感念你恩德的人家。' }
              ] },
            { label: '〔凶〕扣腕逼他拿银买命', set: { 'flags.wz_wuliu_done': true },
              then: [
                { t: 'grant', gold: 35 },
                { t: 'log', cls: 'sys', text: '你扣住他腕子，冷冷道：「拿银买命。」吴六哆嗦着从货底摸出一小袋银钱奉上，恨恨地别过脸去。' }
              ] },
            { label: '暂不理他', say: '你只瞥了一眼，径直走开。吴六张了张嘴，终究没敢再唤。' }
          ] }
      ]
    });

    // 支线B · 林径「寻药篓」：受伤猎户托寻被野狼叼走的药篓（应下→战野狼→胜后交还得谢礼）
    T.push({
      id: 'wz_liehu', hook: 'onTalk', npc: 'liehu', room: 'lindao', once: false,
      cond: { notFlag: 'flags.wz_liehu_done' },
      steps: [
        { t: 'npcTalk', npc: 'liehu',
          prompt: '猎户见你停步，眼睛一亮：「小兄弟，可肯帮我个忙？药篓叫野狼拖进林子深处了，里头有给阿婆治伤的药——你若寻得回，愿以猎物相酬！」',
          asks: [
            { label: '应下，循狼迹入林', set: { 'flags.wz_liehu': true },
              then: [
                { t: 'log', cls: 'sys', text: '你循着草丛里的血迹与爪印拨草而入——林深忽暗，一头野狼正撕扯着那只药篓，见你逼近，呲牙低吼！' },
                { t: 'combat', enemy: 'wild_wolf' }
              ] },
            { label: '婉言谢过', say: '你摇摇头。猎户叹了口气，垂眼不再言语。' }
          ] }
      ]
    });

    // 支线C · 苦役营·塌墙根「墙外接应」：教学毕业后回访福生，白檀屯接应送补给
    T.push({
      id: 'wz_fusheng', hook: 'onTalk', npc: 'fu_sheng', room: 'kuyilao', cell: [1,2], once: false,
      cond: { flags: { 'flags.onb.done': true }, notFlag: 'flags.wz_fusheng_done' },
      steps: [
        { t: 'npcTalk', npc: 'fu_sheng',
          prompt: '福生见你平安归来，眼睛一亮，压低嗓门：「嘿，你真钻出来啦！白檀屯的叔伯早候在墙外，托我带句话——北边庄子遭了雪灾，正缺人手。你若去，口粮管够，还能得些盘缠。」',
          asks: [
            { label: '应下这趟差，托福生转告', set: { 'flags.wz_fusheng_done': true },
              then: [
                { t: 'grant', gold: 15, rep: 2, items: [{id:'roubao', name:'肉包子', icon:'🥟', cat:'食饵', count:2}, {id:'jiu', name:'黍酒', icon:'🍶', cat:'食饵', count:1}] },
                { t: 'log', cls: 'good', text: '你接过福生递来的干粮袋：肉包两只、黍酒一壶，还有十几文铜钱。福生咧嘴一笑：「白檀屯的叔伯记你的好，路上慢走！」' }
              ] },
            { label: '谢过，暂不前往', set: { 'flags.wz_fusheng_done': true }, say: '你拱拱手。福生会意，也不多劝，只道接应的人会再多等两日。' }
          ] }
      ]
    });


    // — 路线2 挖地道：苟三授 route.tunnel（洛阳铲自行于仓库/矿坑取） —
    T.push({
      id: 'gou_tunnel', hook: 'onTalk', npc: 'gou_san', room: 'kuyilao', cell: [2,0], once: false,
      cond: { notFlag: 'flags.route.tunnel' },
      steps: [
        { t: 'npcTalk', npc: 'gou_san',
          prompt: '苟三十指翻飞，朝矿道一努嘴：「想刨地道？矿坑那头连墙根，土松。洛阳铲么——仓库墙角倚着几把闲的，偷来便是。」',
          asks: [
            { label: '〔受教〕记下了，去寻洛阳铲', set: { 'flags.route.tunnel': true },
              say: '苟三咧嘴：「洛阳铲到手，从矿道那头下铲——刨通了，地道线就成了。」〔已得挖地道线索：需自行取得洛阳铲（仓库/矿坑可拾）。〕' }
          ] }
      ]
    });

    // — 路线8 水渠夜遁：吴算（知水道走向）授 route.drain —
    T.push({
      id: 'wu_drain', hook: 'onTalk', npc: 'wu_suan', room: 'kuyilao', cell: [2,1], once: false,
      cond: { notFlag: 'flags.route.drain' },
      steps: [
        { t: 'npcTalk', npc: 'wu_suan',
          prompt: '吴算盘噼啪一算：「排水渠从矿道底过墙根，夜里水声盖动静，最宜夜遁。走向么，老夫门儿清。」',
          asks: [
            { label: '〔请教〕求水道走向', set: { 'flags.route.drain': true },
              say: '吴算盘眯眼：「子时换岗最松，顺渠摸黑漂出便是。〔已得水渠夜遁线索：需石四肯带你认道（路线8）。〕' }
          ] }
      ]
    });

    // — 路线8 辅助：石四指矿道暗渠 —
    T.push({
      id: 'shi_drain', hook: 'onTalk', npc: 'shi_si', room: 'kuyilao', cell: [2,0], once: false,
      cond: { notFlag: 'flags.task.drain_hint' },
      steps: [
        { t: 'npcTalk', npc: 'shi_si',
          prompt: '石四敲着残腿：「矿道底下有暗渠，通墙外水沟。夜里水声大，正好盖动静——你顺着渠漂出去，比钻墙根还隐。」',
          asks: [
            { label: '〔记下了〕这便去备水渠', set: { 'flags.task.drain_hint': true },
              say: '石四往墙根一指：「去寻吴算盘问准走向，夜里动手。」〔水渠夜遁（路线8）：吴算处得走向后，于塌墙根走水渠。〕' }
          ] }
      ]
    });

    // — 木人桩系列·二：练成后韩铁点拨去犬舍逗野犬，专练「撤退」 —
    T.push({
      id: 'han_spar_dog', hook: 'onTalk', npc: 'han_tie', room: 'kuyilao', cell: [2,2], once: false,
      cond: { flags: { 'flags.onb.tcDone': true }, notFlag: 'flags.task.dog_hint' },
      steps: [
        { t: 'npcTalk', npc: 'han_tie',
          prompt: '韩铁一拍你肩：「木人桩是死物，真打还得会『撤』。犬舍那几条恶犬性子烈，你且去逗逗它们——打不过就〔撤退〕，那也是真本事。」',
          asks: [
            { label: '〔领命〕去犬舍会会恶犬', set: { 'flags.task.dog_hint': true },
              say: '韩铁咧嘴：「犬舍在东边——记住，〔撤退〕不是逃，是留得青山。撤得利落，比硬拼更见功夫。」〔木人桩系列·二：犬舍逗野犬，练「撤退」。〕' }
          ] },
        { t: 'acceptQuest', id: 'dog_spar' }
      ]
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
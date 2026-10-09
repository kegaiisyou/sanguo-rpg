// 乱世烽火 · 触发剧本 —— 矿坑支线 + 夺营三条续作分支
//   淘铜铸镐 / 老矿工遗愿 / coup 三分支收束
//
// 由 shared/story/triggers.js 汇总加载（v20261008p 按剧情线拆分）。
// 本文件内的 push 顺序即最终 TRIGGERS 顺序中的一段，段内勿随意调换。
(function (global) {
  var LF = global.LF = global.LF || {};

  LF.pushTriggersSide = function (T) {

    // ════════════════ 矿坑支线（v20260915i）：淘铜铸镐 / 老矿工遗愿 ════════════════
    // 「淘铜铸镐」走差役牌（engine.js JOB_BOARD 的 copper）：摘木牍领活 → 矿洞三层以下凿铜矿 →
    //   回仓库交仓吏。真交付挂在 onGive（kyl_copper_give）——东西真扣，满四块结清。
    T.push({
      id: 'kyl_copper_give', hook: 'onGive', npc: 'storeman', room: 'kuyilao', item: 'tongkuang', once: false,
      cond: { flags: { 'flags.task.copper_started': true }, notFlag: 'flags.task.copper_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.copper_count', increment: true, incrementByEnv: 'qty' },
        { t: 'branch',
          if: { player: { 'flags.task.copper_count': { min: 4 } } },
          then: [
            { t: 'setFlag', path: 'flags.task.copper_done', value: true },
            { t: 'completeQuest', id: 'mine_copper' },
            { t: 'pick', lv: 2 },
            { t: 'exp', amount: 30 },
            { t: 'log', cls: 'good', text: '〔任务完成·淘铜铸镐〕仓吏把铜矿收进库里，又朝你点点头：「营里正缺铜器，这趟差办得利落。这镐头你拿去使——青铜的，比你手里那把石头强。」' }
          ],
          else: [
            { t: 'log', cls: 'npc', text: '〔仓吏〕收下铜矿，在册上记了一笔：「还差几块，再下矿洞凿去。」' }
          ] }
      ]
    });
    T.push({
      id: 'kq_copper_prog', hook: 'onTalk', npc: 'storeman', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.copper_started': true }, notFlag: 'flags.task.copper_done' },
      steps: [ { t: 'log', cls: 'npc', text: '〔仓吏〕「铜矿凿得如何了？凿够了就交过来——点我，选「给予」，把铜矿择出来。四块，一块一记。」' } ]
    });
    T.push({
      id: 'kq_copper_done', hook: 'onTalk', npc: 'storeman', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.copper_done': true } },
      steps: [ { t: 'log', cls: 'npc', text: '〔仓吏〕「铜矿已入库，营里打壶铸镐都有了料。往后矿里再有稀罕货，也先拿来我看。」' } ]
    });

    // 「老矿工遗愿」：老矿工（矿坑格 2,0）引路 → 矿洞七层残碑拓印（engine steleRead 已置 bailian_stele）
    //   → 回来复命。百炼钢简由拓印直接入手；复命领修为与好感。
    T.push({
      id: 'oldminer_intro', hook: 'onTalk', npc: 'old_miner', room: 'kuyilao', once: false,
      cond: { notFlag: 'flags.task.bailian_started' },
      steps: [
        { t: 'npcTalk', npc: 'old_miner',
          prompt: '（老矿工磕了磕烟杆，浑浊的眼珠往矿道深处一瞟）「我这辈子下过最深的一回，是第八层。那壁上刻着字——不是凿石头的记号，是好钢的法子。可惜那时我连把像样的镐都没有，只来得及记下几个字，就再没下去过。」',
          asks: [
            { label: '〔应下〕我去替你寻那碑。',
              set: { 'flags.task.bailian_started': true },
              say: '老矿工怔了怔，哑着嗓子笑了：「……好。你记着：那碑在第七层往下的壁上，半截露在土外。拓字要竹简和墨——营里竹子有的是，墨……得自己想辙。字拓回来了，来跟我说一声。」',
              then: [ { t: 'acceptQuest', id: 'mine_bailian' }, { t: 'log', cls: 'order', text: '〔老矿工的遗愿〕已记入任务：下矿洞七层，拓回残碑铭文。' } ] },
            { label: '〔推辞〕我这点本事，下不到那深处。',
              say: '老矿工也不恼，把烟杆往地上一磕：「本事是练出来的。你先把镐头换利索了，想去了，再来寻我。」' }
          ] }
      ]
    });
    T.push({
      id: 'oldminer_done', hook: 'onTalk', npc: 'old_miner', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.bailian_stele': true }, notFlag: 'flags.task.bailian_done' },
      steps: [
        { t: 'setFlag', path: 'flags.task.bailian_done', value: true },
        { t: 'completeQuest', id: 'mine_bailian' },
        { t: 'favor', npc: 'old_miner', amount: 1 },
        { t: 'exp', amount: 40 },
        { t: 'log', cls: 'npc', text: '（老矿工接过你拓回的铭文，枯指抚过字迹，半晌没说话。末了他把简册还你，声音发哑）「……是它。三十年，到底是见着了。这法子你好生收着——寻得着铁匠，照着锻，是好钢。」' },
        { t: 'log', cls: 'good', text: '〔任务完成·老矿工的遗愿〕修为+40 · 老矿工好感+1' }
      ]
    });
    T.push({
      id: 'oldminer_after', hook: 'onTalk', npc: 'old_miner', room: 'kuyilao', once: false,
      cond: { flags: { 'flags.task.bailian_done': true } },
      steps: [ { t: 'log', cls: 'npc', text: '（老矿工眯着眼，像在回味什么）「百炼钢……那是要拿命去锻的。你有那个心气，就下去吧。」' } ]
    });


    // ════════════ 夺营·三条续作分支（v20260926a，完整剧情）════════════
    // 决断出营枢纽已移除；第4日夺营成为唯一毕业出口。下列三分支此前仅置 flag 无后续，
    // 现补全为含抉择/战斗/收尾的完整流程，胜或退皆经 engine.coupGraduate 统一毕业。

    // 孙老暗流提示（替代原「十越狱路线全图」）：点明营中将变天，引导玩家熬过夺营
    T.push({
      id: 'sun_upheaval', hook: 'onTalk', npc: 'sun_lao', room: 'kuyilao', cell: [0,0], once: false,
      cond: { notFlag: 'flags.task.sun_upheaval' },
      steps: [
        { t: 'npcTalk', npc: 'sun_lao',
          prompt: '孙老吧嗒旱烟，忽然压低嗓门：「小子，老朽在这营里熬了十来年。近来不对劲——太平道的黄巾，悄悄往岗亭上插。上头还装不知道，可这风，是变天的前奏。」',
          asks: [
            { label: '〔凝神〕老丈的意思是……', set: { 'flags.task.sun_upheaval': true },
              say: '孙老吐口烟：「意思是——安心做你的活，别瞎扑腾。等那场变故来了，寻个空子溜便是。这营墙，拦得住规矩，拦不住天意。」〔已得暗流提示：熬过这几日，营中自有变故，届时随势脱身。〕' }
          ] }
      ]
    });

    // 分支一 · 密道先逃（route.tunnel/crypt/drain 任一备妥）：钻早通好的暗道，途中救阿禾与否
    T.push({
      id: 'coup_tunnel_scene', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
      cond: { flags: { 'flags.coup.branch': 'tunnel_early' }, notFlag: 'flags.coup.tunnel_escaped' },
      steps: [
        { t: 'log', cls: 'warn', text: '〔夺营·密道先逃〕混乱一起，你猫腰钻进早通好的坑道。土腥扑鼻，头顶人声渐远——你比谁都先脱了身。' },
        { t: 'npcTalk', npc: 'a_he',
          prompt: '坑道半途，却见阿禾被两名官差逼在死角，正拼死挣脱。她望见你，眼里又是期盼又是惶急：「你……你能带我走吗？」',
          asks: [
            { label: '〔伸手〕拉阿禾一同钻出去',
              then: [
                { t: 'log', cls: 'combat', text: '你反手将阿禾拽进坑道，身后官差已追至，火把照得坑口通明！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] },
            { label: '〔咬牙〕此时顾不得旁人，独自钻出',
              then: [
                { t: 'log', cls: 'sys', text: '你别过脸，埋头钻进暗道深处。阿禾的呼声渐远，你不知她后来如何——只知自己先一步出了营。' },
                { t: 'log', cls: 'combat', text: '坑口处一名巡夜官差似觉动静，持矛探入！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] },
            { label: '〔周旋〕佯作降卒，混在乱兵里溜',
              then: [
                { t: 'setFlag', path: 'flags.coup.tunnel_ruse', value: true },
                { t: 'log', cls: 'combat', text: '你顺势伏低，装作被裹挟的夫役，混在抢功的乱兵里往营门挪——趁人不备，一头扎进暗巷。' },
                { t: 'combat', enemy: 'camp_guard' }
              ] }
          ] }
      ]
    });

    // 分支二 · 阿禾线（a_he 好感≥2 但 moshu<1）：阿禾引你钻塌墙根缝，抉择护她或断后
    T.push({
      id: 'coup_ahe_scene', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
      cond: { flags: { 'flags.coup.branch': 'minor_ahe' }, notFlag: 'flags.coup.ahe_escaped' },
      steps: [
        { t: 'log', cls: 'warn', text: '〔夺营·阿禾线〕阿禾一把扯住你：「跟我来——我知道一处塌墙根的缝，能钻出去！」她眼里既有慌乱，也有一股你没见过的决然。' },
        { t: 'npcTalk', npc: 'a_he',
          prompt: '阿禾边跑边回头：「我哥还在东边粮囤……可这节骨眼，顾不得了。你、你肯陪我走吗？」她声音发颤，却攥紧了你的袖子。',
          asks: [
            { label: '〔并肩〕护着阿禾钻那道缝',
              then: [
                { t: 'log', cls: 'combat', text: '你们刚挤进塌墙根的缝，外头便追来两名太平道喽啰，刀光直劈阿禾后背！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] },
            { label: '〔推她先走〕「你先钻，我断后」',
              then: [
                { t: 'log', cls: 'sys', text: '你将阿禾推进缝里，自己返身挡住追兵。待缝隙那头传来她远去的脚步声，你才寻路另寻缺口。' },
                { t: 'log', cls: 'combat', text: '一名官差从阴影里扑出，长矛直取你心口！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] },
            { label: '〔背负〕背起阿禾，趁乱强突',
              then: [
                { t: 'setFlag', path: 'flags.coup.ahe_carry', value: true },
                { t: 'log', cls: 'combat', text: '你一把将阿禾负在背上，塌墙根的缝太窄，你侧身护住她，硬从追兵刀缝里挤出！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] }
          ] }
      ]
    });

    // 分支三 · 孤身（无门道、无牵绊）：被俘，崔九暗中点拨，趁机脱身
    T.push({
      id: 'coup_minor_scene', hook: 'onEnter', room: 'kuyilao', cell: [1,1], once: false,
      cond: { flags: { 'flags.coup.branch': 'minor' }, notFlag: 'flags.coup.minor_escaped' },
      steps: [
        { t: 'log', cls: 'warn', text: '〔夺营·孤身〕你孤身一人，被乱局裹挟。一名太平道卒认出你这囚籍，反手便将你按在粮囤后，喝令蹲下——你成了这营里又一名俘囚。' },
        { t: 'npcTalk', npc: 'cui_jiu',
          prompt: '昏暗里，却见崔九被人拖过。他瞥见你，竟咧嘴一笑，低声道：「别慌……这帮贼只顾夺库抢粮，营墙那头守备早空了。等他们一乱，你寻个空子溜。」',
          asks: [
            { label: '〔颔首〕记下了，静待时机',
              then: [
                { t: 'log', cls: 'env', text: '片刻后，营中火起、喊杀连天，看押的贼卒也去抢功。你趁机挣脱缚索，贴着墙根摸向空虚的营门。' },
                { t: 'log', cls: 'combat', text: '一名回身查哨的贼卒撞见你，抡刀便砍！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] },
            { label: '〔佯降〕假意归顺，待贼不备夺路',
              then: [
                { t: 'setFlag', path: 'flags.coup.minor_feint', value: true },
                { t: 'log', cls: 'combat', text: '你垂首应声，装作驯顺；待那贼卒转身抢功，你猛地挣断缚索，撞向空虚的营门！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] },
            { label: '〔强突〕不待崔九示意，径扑营门',
              then: [
                { t: 'setFlag', path: 'flags.coup.minor_rush', value: true },
                { t: 'log', cls: 'combat', text: '你不等崔九发话，就地一滚挣开束缚，直扑那处无人把守的营门——守卒回身，长矛已到！' },
                { t: 'combat', enemy: 'camp_guard' }
              ] }
          ] }
      ]
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
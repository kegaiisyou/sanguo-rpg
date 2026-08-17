// 乱世烽火 · 随机事件文本（共享数据层 · 文字放置路线）
// 由颍川线剧情衍生的奇遇/抉择；choices 含 effect（即时结算）与可选 cost
// P3 善恶双轨：每个 choice 可带 moral 字段（'chivalry' 侠义 / 'notoriety' 凶名），独立累积互不抵消
(function (global) {
  var EVENTS = [
    {
      id: 'ev_escapees', title: '溃兵劫掠',
      text: '一队西凉溃兵闯入村庄，抢夺粮草。村民惊惶四散。',
      choices: [
        { text: '挺身驱赶（历练）', moral: 'chivalry', effect: { xp: 20, gold: 10 },
          result: '你挥刀逼退溃兵，护下半个村子，乡民感念不已。' },
        { text: '隐身窥探', effect: { mp: 5 },
          result: '你隐入草垛，记下溃兵动向，内力沉稳。' },
        { text: '趁火打劫，掠走村中财物', moral: 'notoriety', effect: { gold: 25 },
          result: '你趁乱卷走些细软，村人敢怒不敢言——凶名悄然加身。' }
      ]
    },
    {
      id: 'ev_hermit', title: '水镜点拨',
      text: '水镜先生立于溪畔，似在等你：「器宇不凡，可愿听老夫一言？」',
      choices: [
        { text: '恭听教诲', effect: { maxMp: 20, flag: 'buff_hermit' },
          result: '你顿觉心神澄明，内力上限提升！(内力上限+20)' },
        { text: '婉言谢过', effect: { xp: 5 },
          result: '你将这句话记在心里，继续赶路。' }
      ]
    },
    {
      id: 'ev_leftci', title: '左慈赠药',
      text: '方士左慈笑道：「疲惫了？贫道为你行气导引。」',
      choices: [
        { text: '接受调理', effect: { hp: 'full', mp: 'full' },
          result: '一阵清气流转，气血内力皆复。' },
        { text: '不必劳烦', effect: { gold: 5 },
          result: '左慈留下几枚五铢钱，飘然而去。' }
      ]
    },
    {
      id: 'ev_merchant', title: '西域行商',
      text: '西域行商摊开货物：「上好金疮药、各式行囊背篓，壮士可要备上？」',
      choices: [
        { text: '购药（耗银两）', cost: { gold: 20 }, effect: { hp: 50 },
          result: '你买下伤药，气血稍复。' },
        { text: '购·小囊（耗银10）', cost: { gold: 10 }, effect: { give: [{defId:'xiaonang',n:1}] },
          result: '你买下一只小囊，可扩充行囊六格。' },
        { text: '购·书囊（耗银18）', cost: { gold: 18 }, effect: { give: [{defId:'shunang',n:1}] },
          result: '你买下书囊，囊中卷册助你通文（悟性 +1），可容十物。' },
        { text: '购·简易行装（耗银8）', cost: { gold: 8 }, effect: { give: [{defId:'jianyixingzhuang',n:1}] },
          result: '你买下简易行装，减负疾行（身法 +1），可容四物。' },
        { text: '购·皮革包裹（耗银22）', cost: { gold: 22 }, effect: { give: [{defId:'pibao',n:1}] },
          result: '你买下厚实皮革包裹，可容十四物。' },
        { text: '购·采药背篓（耗银24）', cost: { gold: 24 }, effect: { give: [{defId:'caiyaobiluo',n:1}] },
          result: '你买下竹编背篓，采药山行尤便，可容十五物。' },
        { text: '购·熟铜护腰（耗银12）', cost: { gold: 12 }, effect: { give: [{defId:'shutong',n:1}] },
          result: '你买下熟铜护腰，堪挡一刀（防御 +1）。' },
        { text: '挥手辞去', effect: {},
          result: '行商耸耸肩，继续赶路。' },
        { text: '强夺货物（凶名+）', moral: 'notoriety', cost: {}, effect: { hp: 50, gold: 10 },
          result: '你一把夺过药囊与钱袋，行商抱头鼠窜——江湖上多了桩恶名。' }
      ]
    },
    {
      id: 'ev_hanbo', title: '县尉托付',
      text: '县尉韩伯招手道：「盗匪流寇盘踞山林，壮士可愿为民除害？」',
      choices: [
        { text: '受命剿匪', moral: 'chivalry', effect: { xp: 30, gold: 15 },
          result: '你领了令箭，山野间连破数伙盗匪，声望渐起。' },
        { text: '容后再议', effect: { mp: 3 },
          result: '你拱手告退，暗中盘算起兵之策。' }
      ]
    },
    // ── P3 解锁事件：侠义≥30 时由韩伯引荐 ──
    {
      id: 'ev_righteous', title: '清流委托',
      text: '韩伯拱手：「壮士侠名远播，有一桩护送名士过关的义举，可愿相助？」',
      choices: [
        { text: '应下义举（侠义+）', moral: 'chivalry', effect: { gold: 30, reputation: 8 },
          result: '你护送名士安然过境，清流交口称誉，声望大涨。' },
        { text: '容后再议', effect: {},
          result: '韩伯颔首，静待时机。' }
      ]
    },
    // ── P3 解锁事件：凶名≥30 时由影门密使引荐 ──
    {
      id: 'ev_shadow', title: '影门悬赏',
      text: '影门密使压低声音：「有一桩脏活，酬金百两。壮士凶名在外，正合影门胃口——可敢接？」',
      choices: [
        { text: '接下悬赏（凶名+）', moral: 'notoriety', effect: { gold: 100, reputation: 5 },
          result: '你领了密令，夜色中身影没入长街。影门记你一笔。' },
        { text: '婉拒', effect: {},
          result: '密使意味深长一笑，飘然而去。' }
      ]
    },
    // ── P3 隐藏事件：侠义≥40 ∧ 凶名≥40 时由水镜先生点破 ──
    {
      id: 'ev_usurper', title: '枭雄之姿',
      text: '水镜先生凝视你：「侠义在胸，凶名在身——你已非寻常江湖客。乱世枭雄，当如是也。」',
      choices: [
        { text: '笑纳此评', effect: { reputation: 10, gold: 50 },
          result: '你朗声大笑。亦正亦邪之名，自此传于乱世。' },
        { text: '谦辞', effect: { maxMp: 10 },
          result: '你拱手逊谢，心中却已定下大计。' }
      ]
    },

    // ── 新增奇遇：流民托孤（蓟城流民区） ──
    {
      id: 'ev_refugee', title: '流民托孤',
      text: '蓟城外难民如蚁。一名妇人跪在雪泥里，将襁褓塞向你：「壮士，妾身撑不住了……这孩子，求您带他一条生路。」',
      choices: [
        { text: '倾囊分粮，携孤归乡（耗银5）', cost: { gold: 5 }, moral: 'chivalry',
          effect: { reputation: 2, xp: 15 },
          result: '你解下干粮袋塞进她怀里，又抱过孩子。妇人叩首泣谢，你只觉肩头沉了些，心却定了。' },
        { text: '黯然离去', effect: {},
          result: '你别过脸去，脚步却比来时重。风雪里那声婴啼，久久未散。' },
        { text: '趁危夺其随身财物', moral: 'notoriety', effect: { gold: 15 },
          result: '你一把掠过她腕上铜镯与几枚钱，妇人呆望着你，眼神比雪还冷。' }
      ]
    },
    // ── 新增奇遇：酒楼听舆（渔阳酒楼） ──
    {
      id: 'ev_tavern', title: '酒楼听舆',
      text: '渔阳酒楼人声鼎沸。邻桌商旅压低嗓子议论：「听说白檀屯寨的亭长，比州郡的官还横……」',
      choices: [
        { text: '沽酒请众人唠嗑（耗银8）', cost: { gold: 8 }, effect: { reputation: 2, xp: 10 },
          result: '几碗酒下肚，话匣子开了。你听来不少关节：何处有贼、何处有贤、何处可避风头。' },
        { text: '默记于心', effect: { mp: 5 },
          result: '你不动声色，将零碎消息一一存入心底。' },
        { text: '寻衅滋事，夺人腰缠', moral: 'notoriety', effect: { gold: 20 },
          result: '你借酒撒疯，一把扣住那商旅的钱袋。满楼哗然，却无人敢拦。' }
      ]
    },
    // ── 新增奇遇：黑山招徕（黑山寨） ──
    {
      id: 'ev_heishan', title: '黑山招徕',
      text: '黑山寨口，一名喽啰斜倚矛杆：「看壮士气度不凡——不如入伙？劫官道、破豪强，快意恩仇，胜过这乱世乞活。」',
      choices: [
        { text: '严词拒绝，劝其散伙（侠义）', moral: 'chivalry', effect: { xp: 20, reputation: 2 },
          result: '你冷笑：「聚啸山林，终是草寇。趁早散了，免得身首异处。」喽啰悻悻退去。' },
        { text: '假意周旋，暗记虚实', effect: { mp: 5, xp: 5 },
          result: '你含笑敷衍，眼角却将寨中布防尽收眼底。' },
        { text: '入伙劫掠（凶名）', moral: 'notoriety', effect: { gold: 40, reputation: 1 },
          result: '你一点头，喽啰欢呼簇拥。当夜便随队劫了一票——凶名，自此在黑山落了户。' }
      ]
    },
    // ── 新增奇遇：战场遗孤（蓟城荒山） ──
    {
      id: 'ev_orphan', title: '战场遗孤',
      text: '蓟城荒山，新坟累累。一个孩童蹲在残旗旁啜泣，怀里还死死攥着半截断剑——那是他父亲的身份。',
      choices: [
        { text: '携孤护送归乡（耗银10）', cost: { gold: 10 }, moral: 'chivalry',
          effect: { reputation: 3, xp: 15 },
          result: '你牵起那孩子，将他送回尚在的亲族。孩童破涕为笑，你心头一酸。' },
        { text: '留银两而去', effect: { gold: -5 },
          result: '你解下几枚铜钱放在他脚边，转身离去。身后那声「多谢大哥」，稚嫩得刺耳。' },
        { text: '搜刮遗骸旁财物（凶名）', moral: 'notoriety', effect: { gold: 25 },
          result: '你面无表情地翻检尸骸，取下值钱物事。孩童的哭声，你充耳不闻。' }
      ]
    },
    // ── 新增奇遇：古刹问禅（渔阳茶肆/寺院） ──
    {
      id: 'ev_oldmonk', title: '古刹问禅',
      text: '渔阳城外古刹，一老僧扫地不辍。见你来，缓缓道：「施主眉间杀气未消，可愿听老衲一句？」',
      choices: [
        { text: '听禅入定', effect: { maxMp: 15 },
          result: '你盘膝而坐，听木鱼声中杂念渐消。内息流转，竟比平日绵长许多。' },
        { text: '布施香火（耗银10）', cost: { gold: 10 }, moral: 'chivalry',
          effect: { reputation: 2, xp: 5 },
          result: '你添了香火钱。老僧合十：「善哉。施主心中有秤，自会称量这乱世。」' },
        { text: '盗取殿上香火钱（凶名）', moral: 'notoriety', effect: { gold: 15 },
          result: '你趁老僧背身，一把抓了供桌铜钱。木鱼声停了一瞬，又缓缓响了起来。' }
      ]
    },
    // ── 新增奇遇：江湖论剑（蓟城森林） ──
    {
      id: 'ev_wanderer', title: '江湖论剑',
      text: '蓟城森林深处，一背负长剑的游侠横剑相拦：「久闻乱世出英杰——可否赐教一二？」',
      choices: [
        { text: '应战切磋', effect: { xp: 15, atk: 1 },
          result: '剑光交错数十合，你虽未胜，招式却被逼出几分新意。攻伐之意，愈发凝实。' },
        { text: '礼下于人，请教一式', effect: { xp: 8, mp: 3 },
          result: '你执礼甚恭。游侠大笑，随手演了一路起手式，你暗暗记下了。' },
        { text: '出言讥讽，扬长而去（凶名）', moral: 'notoriety', effect: { xp: 3 },
          result: '你嗤笑一声：「也配论剑？」拂袖而去。身后游侠摇头，却也懒得追。' }
      ]
    },
    // ── 新增奇遇：决堤赈灾（白檀田） ──
    {
      id: 'ev_flood', title: '决堤赈灾',
      text: '白檀屯田一带河堤决口，灾民跪在泥水里哭喊。里正束手：「粮仓紧闭，谁敢擅开？」',
      choices: [
        { text: '出粮赈济灾民（耗银15）', cost: { gold: 15 }, moral: 'chivalry',
          effect: { reputation: 5, xp: 15 },
          result: '你开仓放粮、搭棚施粥。灾民叩拜如潮，里正也不得不对你拱手。' },
        { text: '袖手旁观', effect: {},
          result: '你立在堤上，看泥水漫过田垄。乱世之中，这样的景象，看得太多了。' },
        { text: '囤粮居奇，趁荒抬价（凶名）', moral: 'notoriety', effect: { gold: 30 },
          result: '你反手低买高卖，趁灾民危急狠赚一笔。笑声里，是此起彼伏的骂名。' }
      ]
    },
    // ── 新增奇遇：夜半刺客（蓟城学宫） ──
    {
      id: 'ev_assassin', title: '夜半刺客',
      text: '蓟城学宫夜深，一道黑影破窗而入，短刃直取你咽喉！你侧身避过，反手扣住他手腕：「谁派你来的？」',
      choices: [
        { text: '反手制住，诘其主使（侠义）', moral: 'chivalry', effect: { xp: 20, gold: 20, reputation: 2 },
          result: '你卸了刺客兵刃，套出幕后之人，顺手搜出赏银。明早，这消息自有用处。' },
        { text: '破财消灾（耗银20）', cost: { gold: 20 }, effect: {},
          result: '你将一袋银两掷去：「滚。下回换个干净些的杀手。」黑影拾银遁入夜色。' },
        { text: '杀之灭口（凶名）', moral: 'notoriety', effect: { xp: 10, gold: 10 },
          result: '你指尖一紧，刺客便软了下去。搜出腰牌与钱袋，你面无表情地没入廊影。' }
      ]
    }
  ];
  global.LF = global.LF || {};
  global.LF.EVENTS = EVENTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = EVENTS;
})(typeof window !== 'undefined' ? window : globalThis);

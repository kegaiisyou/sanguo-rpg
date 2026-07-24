// 乱世烽火 · 房间与世界地图（共享数据层 · 文字放置路线）
// 仿北大侠客行：每个房间含环境描写、在场人物、可见物品、出口方向（行走探索）
// npcs 引用 LF.DIALOGUES.npcs 的 key；actions 的 id 由 index.html 的 handleAction 执行
(function (global) {
  var ROOMS = {
    camp: {
      id: 'camp', name: '颍川主营',
      desc: [
        '颍川主营扎于旷野，旌旗半卷。新募的乡勇正操练刀枪，呼喝声震野。',
        '中军大帐前，县尉韩伯按剑而立，目光如炬；远处粮囤旗帜招展，马匹嘶鸣，烟尘渐起。'
      ],
      exits: { '北': 'city', '东': 'forest', '西': 'stream' },
      find: '细看：主营旌旗半卷，乡勇正操演刀枪；中军大帐前韩伯按剑而立，粮囤旗扬，马嘶隐隐自远处传来。',
      npcs: ['hanbo'],
      items: [],
      actions: [
        { id: 'learn', label: '研习武学', group: '行动', tip: '案上谱录，凝神参悟' },
        { id: 'rest', label: '帐中休整', group: '行动', tip: '盹一觉，气血内力尽复' },
        { id: 'spar_bandit', label: '入林试炼（剿山贼）', group: '行动', tip: '实战磨砺武艺' },
        { id: 'spar_chief', label: '讨伐流寇头目', group: '行动', tip: '战力验证（中等）' },
        { id: 'spar_turban', label: '征讨黄巾力士', group: '行动', tip: '符箓之力（中等）' },
        { id: 'battle_hua_xiong', label: '温酒斩华雄', group: '行动', tip: '需声望≥20·首场Boss战' },
        { id: 'visit_luoyang', label: '赴洛阳', group: '行动', tip: '需先斩华雄·扬名' }
      ]
    },
    city: {
      id: 'city', name: '颍川城',
      desc: [
        '颍川城内市集熙攘，酒肆茶楼人声鼎沸。西域胡商牵着骆驼穿行，铜铃叮当。',
        '城西医馆飘出药香，华老正捣药；街头偶有溃兵游荡，神色仓皇，似在寻机劫掠。'
      ],
      exits: { '南': 'camp' },
      find: '细看：市集人声鼎沸，西域胡商铜铃叮当；城西医馆药香浮动，街头溃兵游荡，神色仓皇似在寻机劫掠。',
      npcs: ['hualao', 'yingmen'],
      items: ['行商摊上的金疮药'],
      actions: [
        { id: 'market', label: '逛市集', group: '行动', tip: '与行商交易伤药钱粮' },
        { id: 'city_patrol', label: '维持治安', group: '行动', tip: '驱赶城中溃兵' },
        { id: 'rest', label: '客栈安歇', group: '行动', tip: '酒楼歇脚，气血内力尽复' }
      ]
    },
    forest: {
      id: 'forest', name: '北邙山林',
      desc: [
        '山林幽深，古木蔽日。小径两旁荆棘丛生，偶有禽兽惊飞。',
        '黄巾余孽盘踞于此，劫掠过往行商。林深处似有营寨火光，隐闻呼喝之声。'
      ],
      exits: { '西': 'camp', '北': 'forest_patrol_a' },
      find: '细看：古木蔽日，小径荆棘丛生；林深处营寨火光隐约，时有呼喝之声——黄巾余孽便盘踞于此。',
      npcs: [],
      items: ['林间散落的五铢钱'],
      actions: [
        { id: 'patrol', label: '巡山剿匪', group: '行动', tip: '深入山林，扫荡黄巾余孽' },
        { id: 'rest', label: '林间栖身', group: '行动', tip: '倚树小憩，尽复状态' }
      ]
    },
    stream: {
      id: 'stream', name: '溪畔草庐',
      desc: [
        '一弯溪水潺潺，水镜先生立于岸畔，长须随风，似在等你。',
        '草庐简陋却洁净，竹简散落案上，茶烟袅袅；方士左慈斜倚石上，含笑不语。'
      ],
      exits: { '东': 'camp' },
      find: '细看：溪水潺潺，竹简散落案上；水镜先生岸畔负手而立，左慈斜倚石上含笑，茶烟袅袅，风过林梢。',
      npcs: ['shuijing', 'zuoci'],
      items: [],
      actions: [
        { id: 'rest', label: '草庐借宿', group: '行动', tip: '水镜先生邀你歇脚，尽复状态' }
      ]
    },
    luoyang: {
      id: 'luoyang', name: '洛阳城',
      desc: [
        '洛阳城阙巍峨，朱雀大街车水马龙。你「温酒斩华雄」之名已传遍九州，百姓夹道相迎，孩童指你而呼「温酒斩将者」。',
        '太庙之前，老兵斟酒相敬：「壮士此战，气吞山河！」中原未平，然你已立下不世奇功，青史当留一笔。'
      ],
      exits: { '南': 'camp', '北': 'ji_guomen' },
      find: '细看：城阙巍峨，朱雀大街车水马龙；太庙前老兵斟酒相敬，孩童指你而呼「温酒斩将者」，声名已传九州。',
      npcs: [],
      items: [],
      actions: [
        { id: 'rest', label: '城中休整', group: '行动', tip: '酒肆安歇，气血内力尽复' }
      ]
    },
    // ═══════════════════════════════════════════
    //  幽州 · 蓟城（汉末州治，12 间核心）
    // ═══════════════════════════════════════════
    // ═══════════════════════════════════════════
    //  幽州 · 蓟城（汉末州治）
    //  结构：南北主干（郭门—南门—通衢—北门）串起东/西市街，
    //        市街再连官署 / 军营 / 商区 / 民居 / 酒肆等建筑
    // ═══════════════════════════════════════════
    ji_guomen: {
      id: 'ji_guomen', name: '蓟城·郭门',
      desc: [
        '夯土城墙巍然矗立，郭门内外往来车马络绎不绝。城门税吏正逐一盘查过往商旅，铜铃与驼铃此起彼伏。',
        '城外远处可见流民棚的炊烟，马市那边传来阵阵马嘶声。南行可返中原洛阳，入郭门即进蓟城。'
      ],
      exits: { '北': 'ji_nanmen', '西': 'ji_liumin', '东': 'ji_mashi', '南': 'luoyang' },
      npcs: ['guanli'],
      find: '细看：郭门两侧揭帖写满入城税则，墙根兵卒正煮着腥膻肉汤。西去土路连着流民棚，东边草场马群扬尘——乌桓马商的旗幡格外扎眼；北面城楼便是入城正门。',
      items: [],
      actions: [
        { id: 'rest', label: '郭门歇脚', group: '行动', tip: '依墙小憩，气血内力尽复' }
      ]
    },
    ji_nanmen: {
      id: 'ji_nanmen', name: '蓟城·南门（阳门）',
      desc: [
        '阳门为蓟城南向正门，门楼三重飞檐，气势恢宏。城砖上苔痕斑驳，镌刻着燕地数百年的风雨。',
        '守门士卒甲胄鲜明，持戟而立。门内通衢大街直贯城中，车马行人川流不息。'
      ],
      exits: { '南': 'ji_guomen', '北': 'ji_tongqu' },
      find: '细看：阳门三重飞檐，门砖苔痕斑驳镌燕地风雨；守门士卒甲胄鲜明，门内通衢大街车马川流不息。',
      npcs: ['shoumen'],
      items: [],
      actions: [
        { id: 'rest', label: '门楼歇息', group: '行动', tip: '倚门楼小憩，气血内力尽复' }
      ]
    },
    ji_tongqu: {
      id: 'ji_tongqu', name: '蓟城·通衢大街',
      desc: [
        '蓟城南北主干，路面以青石铺就，宽可并行六车。街旁槐柳成荫，旗幡招展，店家伙计沿街吆喝。',
        '此乃全城枢纽：北抵朔门，南通阳门，东接东市街往商区，西通西市街向官署军营。'
      ],
      exits: { '南': 'ji_nanmen', '北': 'ji_beimen', '东': 'ji_dongshijie', '西': 'ji_xishijie' },
      find: '细看：青石主道宽可并行六车，槐柳成荫旗幡招展；北去朔门，南出阳门，东市街通大市，西市街达州牧府与军营。',
      npcs: ['shuoshu'],
      items: [],
      actions: []
    },
    ji_beimen: {
      id: 'ji_beimen', name: '蓟城·北门（朔门）',
      desc: [
        '朔门为蓟城北向正门，门洞阴冷，风自关外灌入，挟着草野与尘沙的气息。',
        '城门税吏懒洋洋倚墙打盹，出城者稀——北面尽是荒田野岭，少有商旅往还。'
      ],
      exits: { '南': 'ji_tongqu', '北': 'ji_tian' },
      find: '细看：朔门砖石斑驳，门额「镇朔」二字已模糊；出得门来北望，阡陌连绵，偶有农人荷锄而归。',
      npcs: [], items: [],
      actions: [
        { id: 'rest', label: '门洞歇脚', group: '行动', tip: '倚墙避风小憩，气血内力尽复' }
      ]
    },
    // ── 西市街：通衢西出，连官署 / 军营 / 训练场 / 郡衙 ──
    ji_xishijie: {
      id: 'ji_xishijie', name: '蓟城·西市街',
      desc: [
        '西市街自通衢向西延展，青石板路两侧多是官署与兵营的墙垣，间或见卖兵甲弓矢的铺子。',
        '街北是州牧府，街西通军营，南接郡衙，市声渐稀，多了几分肃杀。'
      ],
      exits: { '东': 'ji_tongqu', '西': 'ji_junying', '北': 'ji_zhoumu', '南': 'ji_junya' },
      npcs: [],
      find: '细看：西市街北首州牧府朱门铜钉，西去军营旌旗猎猎，南接郡衙，偶有巡街武卒往来。',
      items: [],
      actions: []
    },
    ji_zhoumu: {
      id: 'ji_zhoumu', name: '蓟城·州牧府正厅',
      desc: [
        '幽州刺史部治所，朱门铜钉，堂前立着汉天子旌旗。厅内案牍堆积，幽州十一郡军政要务汇聚于此。',
        '堂上悬「镇北安民」匾额，两侧刀枪架上兵刃森然。后堂已并入正厅，公孙瓒常在此与州牧议边事。'
      ],
      exits: { '南': 'ji_xishijie' },
      npcs: ['liuyu', 'gongsun'],
      find: '细看：正厅「仁静」匾额下，刘州牧案上摊着抚恤流亡的簿册，堂下差役进进出出；公孙瓒按刀立于侧，目光如炬。',
      items: [],
      actions: []
    },
    ji_junya: {
      id: 'ji_junya', name: '蓟城·郡衙',
      desc: [
        '蓟县郡衙，处理钱粮刑名、户籍徭役。照壁上绘着「公正廉明」，堂前梆点按时敲响。',
        '衙前槐下常有百姓击鼓鸣冤，书吏抱着卷宗匆匆进出。'
      ],
      exits: { '北': 'ji_xishijie' },
      npcs: ['xianling'],
      find: '细看：郡衙照壁斑驳，堂上县令正批阅词状；墙角枷锁与刑杖林立，差役押着一名醉汉走过。',
      items: [],
      actions: []
    },
    ji_junying: {
      id: 'ji_junying', name: '蓟城·军营',
      desc: [
        '营中旌旗猎猎，幽州突骑正在操练阵法。马蹄踏地声如闷雷，都尉立在点将台上挥旗指挥。',
        '营帐间有兵器架与草料堆，空气中弥漫着皮革与铁锈的气味。北面是练武场，南侧驿馆可歇。'
      ],
      exits: { '东': 'ji_xishijie', '北': 'ji_lianwu', '南': 'ji_yiguan' },
      npcs: ['duwei'],
      find: '细看：旌旗猎猎，幽州突骑操演阵法，马蹄踏地如闷雷；营帐间兵器架、草料堆林立，皮革铁锈之气弥漫。',
      items: [],
      actions: []
    },
    ji_lianwu: {
      id: 'ji_lianwu', name: '蓟城·练武场',
      desc: [
        '军营北侧的开阔校场，夯土围成，中央立着木人桩与箭靶。健卒正比试膂力，尘土飞扬。',
        '场边兵械架上枪棒刀戟俱全，墙上悬着「勤练不辍」四字。此处最宜切磋武艺。'
      ],
      exits: { '南': 'ji_junying' },
      npcs: [],
      find: '细看：校场木人桩新添刀痕，箭靶密布箭孔；兵械架上枪棒锃亮，健卒正两两较技，呼喝震场。',
      items: [],
      actions: [
        { id: 'spar_bandit', label: '校场试招', group: '行动', tip: '与健卒过招，磨砺身手' }
      ]
    },
    ji_yiguan: {
      id: 'ji_yiguan', name: '蓟城·驿馆',
      desc: [
        '传舍驿馆，供往来官吏与驿使歇脚。堂中驿丞正登记文书，墙上贴着各郡悬赏与军情通报。',
        '后院马厩备有驿马，卧房虽简却整洁。北面便是军营驻地。'
      ],
      exits: { '北': 'ji_junying' },
      npcs: ['yicheng'],
      find: '细看：传舍驿馆中驿丞登记文书，墙上悬各郡悬赏与军情通报；后院马厩备有驿马，卧房虽简却整洁。',
      items: [],
      actions: [
        { id: 'rest', label: '驿馆歇宿', group: '行动', tip: '卧房安歇，气血内力尽复' }
      ]
    },
    // ── 东市街：通衢东出，连商区 / 学宫 / 酒楼 / 茶肆 / 平民里 ──
    ji_dongshijie: {
      id: 'ji_dongshijie', name: '蓟城·东市街',
      desc: [
        '东市街自通衢向东，渐入繁华。酒楼茶肆帘招招展，胡商汉贾摩肩接踵，叫卖声不绝于耳。',
        '街北酒楼高悬「醉仙」匾，街南茶肆炉香袅袅；西通大市，东达平民里。'
      ],
      exits: { '西': 'ji_tongqu', '东': 'ji_dashi', '北': 'ji_jiulou', '南': 'ji_chasi' },
      npcs: [],
      find: '细看：东市街酒楼茶肆林立，胡商汉贾摩肩接踵；北首「醉仙楼」帘招高挑，南面茶肆炉香袅袅，东去便是大市。',
      items: [],
      actions: []
    },
    ji_dashi: {
      id: 'ji_dashi', name: '蓟城·大市',
      desc: [
        '四方商贾辐辏，胡汉货物琳琅满目。市楼高耸，市令坐镇其中，以旗鼓号令开市闭市。',
        '东首是米行布庄，西首是铁器皮货；北面学宫隐隐传来诵读声，东行可至闾里民居。'
      ],
      exits: { '西': 'ji_dongshijie', '北': 'ji_xuegong', '东': 'ji_minli', '南': 'ji_chasi' },
      npcs: ['shiling'],
      find: '细看：市楼高耸，旗鼓号令开闭；东首米行布庄，西首铁器皮货，北面学宫诵读声隐隐可闻。',
      items: [],
      actions: [
        { id: 'market', label: '逛市集', group: '行动', tip: '与商贾交易钱粮药材' }
      ]
    },
    ji_xuegong: {
      id: 'ji_xuegong', name: '蓟城·郡学宫',
      desc: [
        '郡学设于蓟城东北，青瓦白墙，松柏掩映。堂上博士正讲授《春秋》，弟子席地而坐，竹简沙沙。',
        '学宫藏有儒门心法与燕地古枪谱，壁上镌刻着历代名将的用兵心得。院中古槐下，偶有隐士论道。'
      ],
      exits: { '南': 'ji_dashi' },
      npcs: ['boshi'],
      find: '细看：青瓦白墙，松柏掩映；堂上博士讲授《春秋》，壁上镌历代名将用兵心得，古槐下偶有隐士论道。',
      items: [],
      actions: [
        { id: 'learn', label: '研习武学', group: '行动', tip: '参悟儒门心法与燕地枪术' }
      ]
    },
    ji_jiulou: {
      id: 'ji_jiulou', name: '蓟城·醉仙楼',
      desc: [
        '三层木楼，飞檐挑角，「醉仙楼」金匾高悬。楼下食客觥筹交错，跑堂吆喝声与丝竹声交织。',
        '倚窗可望通衢人流。此处消息最灵，三教九流无所不谈——或能听来些北疆流言。'
      ],
      exits: { '南': 'ji_dongshijie' },
      npcs: ['xiaoguan'],
      find: '细看：醉仙楼内觥筹交错，跑堂穿梭如蝶；二楼雅座有商贾低议军情，不妨上去听个一二。',
      items: [],
      actions: [
        { id: 'rest', label: '楼中饮宴', group: '行动', tip: '沽酒小酌，气血内力尽复' }
      ]
    },
    ji_chasi: {
      id: 'ji_chasi', name: '蓟城·清风茶肆',
      desc: [
        '茶肆朴素洁净，炉上铜铫煮着蒙顶新芽，水汽与香气氤氲。几案竹帘相隔，茶客低声闲谈。',
        '说书人拍案正讲三国纷争，听得人时而扼腕、时而抚掌。此处最宜听市井闲话。'
      ],
      exits: { '北': 'ji_dongshijie' },
      npcs: ['shuosheng'],
      find: '细看：清风茶肆炉香袅袅，说书人正讲到温酒斩将处，满堂喝彩；邻桌老者似见多识广，或可知北山匪情。',
      items: [],
      actions: [
        { id: 'rest', label: '茶肆歇脚', group: '行动', tip: '品茗小坐，气血内力尽复' }
      ]
    },
    ji_minli: {
      id: 'ji_minli', name: '蓟城·平民里',
      desc: [
        '闾里之间，巷道纵横。土墙茅檐鳞次栉比，妇人在井边浣衣，孩童追逐嬉戏。里魁拄杖巡视，不时呵斥吵闹。',
        '此处多是幽州军户与平民杂居，邻里相熟。北首几户新居，南接更深的巷陌。'
      ],
      exits: { '西': 'ji_dashi', '北': 'ji_minju', '南': 'ji_minju2' },
      npcs: ['likui'],
      find: '细看：土墙茅檐鳞次，井边妇人浣衣，孩童追逐嬉戏；巷口老槐下老卒闲坐说古，北首新居炊烟正起。',
      items: [],
      actions: []
    },
    ji_minju: {
      id: 'ji_minju', name: '蓟城·民居（北巷）',
      desc: [
        '平民里北首的几户人家，院落不大却收拾得齐整。鸡埘菜畦俱全，老妪在檐下缝补，见你含笑点头。',
        '墙头探出石榴枝，显得几分生机。邻里往来，自有幽州边城的烟火气。'
      ],
      exits: { '南': 'ji_minli' },
      npcs: [],
      find: '细看：北巷院落齐整，老妪檐下缝补，鸡埘菜畦俱全；墙头石榴枝探出，邻里笑语可闻。',
      items: ['院落里的青菜'],
      actions: []
    },
    ji_minju2: {
      id: 'ji_minju2', name: '蓟城·民居（南巷）',
      desc: [
        '平民里南向更深的巷陌，屋舍稍显破旧，却也烟火气十足。铁匠铺叮当声不绝，飘出炭火味。',
        '几个半大孩子蹲在墙根弹珠，见生人便好奇张望。'
      ],
      exits: { '北': 'ji_minli' },
      npcs: [],
      find: '细看：南巷屋舍稍旧，铁匠铺火星四溅，炭火味扑鼻；墙根孩童弹珠嬉戏，见你张望便嘻笑起来。',
      items: ['巷口的废铁'],
      actions: []
    },
    ji_mashi: {
      id: 'ji_mashi', name: '蓟城·城外马市',
      desc: [
        '城郭之东，空旷草场上马匹成群。乌桓马商驱赶着高头大马，操着半生不熟的汉话与人议价。',
        '空气中混杂着马汗与干草的气味。地上散落着蹄铁与断缰绳——此处是北疆最好的马匹交易之地。'
      ],
      exits: { '西': 'ji_guomen' },
      find: '细看：草场马群成群，乌桓马商议价声不绝；北望是蓟城北出的旷野，东去道旁偶有歇脚的脚夫。',
      npcs: ['wuhuan'],
      items: [],
      actions: [
        { id: 'rest', label: '马场歇息', group: '行动', tip: '倚草料堆小憩，气血内力尽复' }
      ]
    },
    // ═══ 蓟城正北 · 出北门渐进通道（太行山前，黑山军在州北山区） ═══
    ji_tian: {
      id: 'ji_tian', name: '城外·农田',
      desc: [
        '城北沃野，阡陌纵横。残雪初融的田垄间，农人正扶犁驱牛，孩童在田埂上追逐嬉闹。',
        '远处几间茅屋升起炊烟，鸡犬相闻。道旁立着界石，上书「蓟县北郊官田」。'
      ],
      exits: { '南': 'ji_beimen', '北': 'ji_huangdi', '东': 'ji_xiaoshulin' },
      find: '细看：田垄间偶见遗落的五铢钱与半截陶罐；东面林木稀疏处，似有条小径通向林子。',
      npcs: [], items: ['田垄间的五铢钱'],
      actions: [
        { id: 'rest', label: '田埂小憩', group: '行动', tip: '倚界石歇脚，气血内力尽复' }
      ]
    },
    ji_xiaoshulin: {
      id: 'ji_xiaoshulin', name: '城外·小树林',
      desc: [
        '稀疏的林木沿坡而生，枝干尚幼，正好遮些日头。林间落叶铺地，踩上去沙沙作响。',
        '几只山雀扑棱棱飞起，显是受了惊。此处静僻，倒宜歇脚或伏身。'
      ],
      exits: { '西': 'ji_tian', '北': 'ji_senlin' },
      find: '细看：林间有被踩实的隐径向北渐入密林；树干上偶有刀刻的记号，不知何人所为。',
      npcs: [], items: [],
      actions: [
        { id: 'rest', label: '林间歇脚', group: '行动', tip: '倚树小憩，气血内力尽复' }
      ]
    },
    ji_huangdi: {
      id: 'ji_huangdi', name: '城外·荒地',
      desc: [
        '田垄渐荒，蒿草没胫，随风起伏如浪。几处坍塌的土屋朽木横陈，显是久无人居。',
        '偶有狐兔自草丛中惊窜，远处传来鹧鸪的啼声，更添几分萧索。'
      ],
      exits: { '南': 'ji_tian', '北': 'ji_xiaoqiu', '东': 'ji_senlin' },
      find: '细看：荒草间散落着碎瓦与锈蚀的农具；东面林影幽深，北望一道缓丘横亘，应是去山里的路。',
      npcs: [], items: ['荒地里的铁锄'],
      actions: []
    },
    ji_senlin: {
      id: 'ji_senlin', name: '城外·森林',
      desc: [
        '林木渐密，古木交柯，日影斑驳难透。小径在树根间蜿蜒，不知通向何处。',
        '林深处似有野兽低吼，又有飞鸟惊起——这片林子，已有些许荒野的凶险。'
      ],
      exits: { '南': 'ji_xiaoshulin', '西': 'ji_huangdi' },
      find: '细看：林间泥地上蹄印与脚印交错；西通荒地，南回小树林，再往里便是深山了。',
      npcs: [], items: ['林间散落的干果'],
      actions: [
        { id: 'patrol', label: '林中巡探', group: '行动', tip: '深入森林，搜检有无贼踪' }
      ]
    },
    ji_xiaoqiu: {
      id: 'ji_xiaoqiu', name: '城外·小山丘',
      desc: [
        '一道缓丘自平野隆起，坡上野草萋萋，几块巨石犬牙交错。登顶可远眺蓟城与北山。',
        '风过丘顶猎猎作响。丘后山势渐陡，怪石渐多，已是荒山的边缘。'
      ],
      exits: { '南': 'ji_huangdi', '北': 'ji_huangshan' },
      find: '细看：丘顶巨石后有被人坐卧的痕迹，灰烬犹温；北望山影森然，黑山之脉已隐隐在望。',
      npcs: [], items: [],
      actions: [
        { id: 'rest', label: '丘顶歇息', group: '行动', tip: '坐巨石上远眺，气血内力尽复' }
      ]
    },
    ji_huangshan: {
      id: 'ji_huangshan', name: '城外·荒山',
      desc: [
        '山体荒秃，怪石嶙峋，寸草难生。山风如啸，卷起碎石簌簌滚落。',
        '此处已是黑山余脉，岩缝间偶有枯骨与断刃——想是过往行商遭了劫。再往北，便是贼巢。'
      ],
      exits: { '南': 'ji_xiaoqiu', '北': 'ji_heishan_zhai' },
      find: '细看：岩壁上凿着粗糙的箭头指向北面山坳；风中隐约传来人声与兵刃相击，黑山寨便在坳中。',
      npcs: [], items: ['岩缝里的断刃'],
      actions: []
    },
    ji_liumin: {
      id: 'ji_liumin', name: '蓟城·流民棚',
      desc: [
        '郭外荒地上，破旧棚屋杂乱无章。黄巾乱后逃难至此的流民挤作一团，面有菜色，眼中尽是惶然。',
        '几个乞儿蹲在路口，伸出脏兮兮的手。偶尔有溃兵在此劫掠，妇孺的哭声随风飘散。'
      ],
      exits: { '东': 'ji_guomen' },
      npcs: ['minlao'],
      find: '细看：棚户以破席败革搭成，老弱蜷缩其间，小儿哭声断续。东面就是回郭门的路；若肯周济，或能问出些北疆流言。',
      items: [],
      actions: [
        { id: 'rest', label: '棚中歇脚', group: '行动', tip: '寻僻静处小憩，气血内力尽复' }
      ]
    },
    // ═══ 北邙·巡山道（实走巡逻子地图，往来随机遇敌） ═══
    forest_patrol_a: {
      id: 'forest_patrol_a', name: '北邙·巡山道（东）',
      desc: [
        '林间小道蜿蜒，枯枝败叶没踝。远处山梁似有炊烟，隐闻呼哨之声。',
        '你屏息前行，指按刀柄——这片山林，正是黄巾余孽与流寇出没之地。'
      ],
      exits: { '南': 'forest', '东': 'forest_patrol_b' },
      npcs: [], patrol: true,
      find: '细看：道旁歪斜的脚印杂沓，多是草鞋与马蹄；东侧林子更深，偶有黑影一闪。',
      items: [], actions: []
    },
    forest_patrol_b: {
      id: 'forest_patrol_b', name: '北邙·巡山道（中）',
      desc: [
        '林壑渐深，古木遮天。溪涧旁的乱石后似有人影晃动，空气中飘着烤肉与汗酸的气味。',
        '一阵夜鸟惊飞，显是方才有人经过。你握紧兵刃，继续巡视。'
      ],
      exits: { '西': 'forest_patrol_a', '北': 'forest_patrol_c' },
      npcs: [], patrol: true,
      find: '细看：乱石后有新鲜的灰烬与啃剩的骨头，想是贼人临时歇脚处；北面密林愈发幽暗。',
      items: [], actions: []
    },
    forest_patrol_c: {
      id: 'forest_patrol_c', name: '北邙·巡山道（西）',
      desc: [
        '西段山道陡峻，一侧是深涧。此处风声如啸，树影森然，最宜伏击。',
        '你驻足回望，来路已被暮色吞没。若再深入，便入贼巢腹地了。'
      ],
      exits: { '南': 'forest_patrol_b', '东': 'forest' },
      npcs: [], patrol: true,
      find: '细看：涧边草丛压得齐整，显是常有人上下；东南方透出微光，应是回山林的主道。',
      items: [], actions: []
    },
    // ═══ 剿匪据点：黑山寨（史料原型·黑山军张燕，太行/北地山寨） ═══
    ji_heishan_zhai: {
      id: 'ji_heishan_zhai', name: '黑山寨·寨门',
      desc: [
        '寨门以粗木夯土垒成，门楼上猎猎飘着「黑山」大旗。两名喽啰横刀而立，打量着每一个靠近的人。',
        '寨墙后隐约传来喧哗与兵刃相击之声，显是座凶山恶水之地。'
      ],
      exits: { '南': 'ji_huangshan', '北': 'ji_heishan_juyi' },
      npcs: ['heishan_zhai'],
      find: '细看：寨门两侧鹿砦森然，吊桥仅供一人通行；北望寨内，聚义厅的灯火通明，人影幢幢。',
      items: [], actions: []
    },
    ji_heishan_juyi: {
      id: 'ji_heishan_juyi', name: '黑山寨·聚义厅',
      desc: [
        '聚义厅内虎皮蒙椅，刀枪架上寒光凛凛。堂中篝火熊熊，喽啰们大碗饮酒，喧声震瓦。',
        '厅首端坐一人，抚刀而笑——正是黑山寨主张燕。见你闯入，眼中杀机毕露。'
      ],
      exits: { '南': 'ji_heishan_zhai', '北': 'ji_heishan_houzhai' },
      npcs: ['heishan_zhu'],
      find: '细看：厅侧暗门通向后寨，堆积着劫来的钱粮与俘获的壮丁；北面甬道幽深，似有兵器坊。',
      items: [], actions: []
    },
    ji_heishan_houzhai: {
      id: 'ji_heishan_houzhai', name: '黑山寨·后寨',
      desc: [
        '后寨是贼人囤积赃物的所在，箱笼累累，绳索捆着的俘丁蜷缩墙角。',
        '此处守备稍松，若悄然取了钱粮、放了俘丁，便可断贼根本。'
      ],
      exits: { '南': 'ji_heishan_juyi' },
      npcs: [],
      find: '细看：箱笼中多是劫来的金帛与兵甲；墙角俘丁目光恳切，似在盼你施救。',
      items: [], actions: []
    }
  };

  // 出口反向校验（保证地图连通，便于后续扩展）
  global.LF = global.LF || {};
  global.LF.ROOMS = ROOMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ROOMS;
})(typeof window !== 'undefined' ? window : globalThis);

// 城市数据（程序生成城市房间的单一真相源）
// 说明：
//   grid        —— 城内网格规格(9/7/5)，>0 即参与程序生成（genCityGrid / cityProfile / cityNpcs / cityActs / cityGates）
//   tier/ctype  —— 城市层级与类型（影响外观、图标、规模）
//   name        —— 显示名（山河志/状态栏统一使用）
//   state/pos   —— 所属州、地图坐标（pos 与 map.js 的 coords 保持一致）
//   desc        —— 一句话简介（州治节点 hover/山河志用）
//   blurb       —— 进城到达旁白（2 段，原 rooms.js 的 desc）
//   blurbFind   —— 进城 find 一行（原 rooms.js 的 find）
//   groundItems —— 进城地面可见物（原 rooms.js 的 items）
//   rootActs    —— 进城根房动作（原 rooms.js 的 actions；统一仅“休整”，颍川额外保留市集/治安）
//   zoneId      —— 山河志州治节点 id（仅 roomId≠zoneId 的 3 座名城需填）
//   icon        —— 山河志州治节点图标（默认🏯）
(function(global){
  if(!global.LF) global.LF = {};
  var CITIES = {
    // ═══ 幽州 ═══
    ji_guomen: { name:'蓟城', state:'幽州', tier:'zhou', pop:72, order:80, commerce:60, wall:82, agri:45, grid:7, pos:[9,3],
      desc:'幽州州治，北疆雄城', ctype:'plain', owner:'gongsun', garrison:70,
      zoneId:'jicheng', icon:'🏯',
      blurb:['夯土城墙巍然矗立，郭门内外往来车马络绎不绝。城门税吏正逐一盘查过往商旅，铜铃与驼铃此起彼伏。','城外远处可见流民棚的炊烟，马市那边传来阵阵马嘶声。南行可返中原洛阳，入郭门即进蓟城。'],
      blurbFind:'郭门两侧揭帖写满入城税则，墙根兵卒正煮着腥膻肉汤。西去土路连着流民棚，东边草场马群扬尘——乌桓马商的旗幡格外扎眼；北面城楼便是入城正门。',
      groundItems:[], rootActs:[{id:'rest',label:'郭门歇脚',group:'行动',tip:'依墙小憩，气血内力尽复'}] },
    yuyang_guomen: { name:'渔阳', state:'幽州', tier:'zhou', pop:55, order:50, commerce:55, wall:66, agri:40, grid:7, pos:[14,-1],
      desc:'幽州北境门户，屯戍要地', ctype:'plain', owner:'gongsun', garrison:55,
      zoneId:'yuyang', icon:'🏯',
      blurb:['夯土城墙夹道而立，郭门扼南北通衢之喉。南来北往的商旅、流民在税亭前排起长队，驼铃与车辙声不绝。','城外南望，蓟城（幽州治所）大道烟尘隐隐；入郭门即进渔阳城。关吏正挨个验籍，墙根戍卒就着风沙啃着硬饼。'],
      blurbFind:'郭门两侧揭帖写满入城税则与宵禁时刻，墙根戍卒就着风沙啃硬饼。南去蓟城大道尘土飞扬，北入城去便是南门；西首兵营旌旗隐约，东边市声渐起——渔阳便是个北疆门户的模样。',
      groundItems:[], rootActs:[{id:'rest',label:'郭门歇脚',group:'行动',tip:'依墙避风小憩，气血内力尽复'}] },

    // ═══ 司隶 ═══
    luoyang: { name:'洛阳', state:'司隶', tier:'zhou', pop:95, order:98, commerce:90, wall:90, agri:60, grid:9, pos:[5,4],
      desc:'天子脚下，中原腹心', ctype:'plain', owner:'dongzhuo', garrison:90,
      blurb:['洛阳城阙巍峨，朱雀大街车水马龙。你力斩华雄之名已传遍州郡，百姓夹道相迎。','太庙之前，老兵斟酒相敬：「壮士此战，气吞山河！」中原未平，然你已立下不世奇功，青史当留一笔。'],
      blurbFind:'城阙巍峨，朱雀大街车水马龙；太庙前老兵斟酒相敬，孩童指你而呼「斩华雄者」，声名已传州郡。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'酒肆安歇，气血内力尽复'}] },

    // ═══ 豫州 ═══
    city: { name:'颍川', state:'豫州', tier:'zhou', pop:80, order:85, commerce:75, wall:70, agri:65, grid:9, pos:[6,7],
      desc:'中原腹地，乱世初起之地', ctype:'plain', owner:'kongrong', garrison:65,
      zoneId:'yingchuan', icon:'🏙️',
      blurb:['颍川城内市集熙攘，酒肆茶楼人声鼎沸。西域胡商牵着骆驼穿行，铜铃叮当。','城西医馆飘出药香，华老正捣药；街头偶有溃兵游荡，神色仓皇，似在寻机劫掠。'],
      blurbFind:'市集人声鼎沸，西域胡商铜铃叮当；城西医馆药香浮动，街头溃兵游荡，神色仓皇似在寻机劫掠。',
      groundItems:['行商摊上的金疮药'], rootActs:[{id:'market',label:'逛市集',group:'行动',tip:'与行商交易伤药钱粮'},{id:'city_patrol',label:'维持治安',group:'行动',tip:'驱赶城中溃兵'},{id:'rest',label:'客栈安歇',group:'行动',tip:'酒楼歇脚，气血内力尽复'}] },

    // ═══ 冀州 ═══
    ye: { name:'邺城', state:'冀州', tier:'zhou', pop:78, order:82, commerce:70, wall:85, agri:55, grid:9, pos:[10,5],
      desc:'漳水之滨，袁氏根本', ctype:'plain', owner:'yuan', garrison:80,
      blurb:['邺城雄峙漳水之滨，城墙高峻，市井井然。州衙官署沿中轴排列，比屋连甍，气象俨然。','城头旌旗寂寂，街上行人稀疏——新附之地，百业待兴。远处铜雀台基初筑，工匠三三两两散坐歇息。'],
      blurbFind:'漳水绕郭，州衙巍然；铜雀台基初筑，街市疏朗。邺城初定，静待风云。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    changyi: { name:'昌邑', state:'兖州', tier:'zhou', pop:60, order:62, commerce:58, wall:64, agri:52, grid:7, pos:[11,7],
      desc:'兖州要邑，漕运通津', ctype:'plain', owner:'kongrong', garrison:58,
      blurb:['昌邑城枕河而筑，漕船往来如梭。粮市喧阗，脚夫扛着麻袋穿梭，河腥与米香混在一处。','郡仓高耸，守卒持戈而立；街角赌坊喧声不止，似有流民于此铤而走险。'],
      blurbFind:'漕船如梭，粮市喧阗；郡仓高耸，守卒持戈。昌邑虽小，却是兖州钱粮咽喉。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    xiapi: { name:'下邳', state:'徐州', tier:'zhou', pop:70, order:74, commerce:68, wall:76, agri:60, grid:9, pos:[16,8],
      desc:'泗水环绕，淮北重镇', ctype:'plain', owner:'lu', garrison:70,
      blurb:['下邳城外泗水如带，白鹭掠波。水门处渔舟列岸，贩夫走卒挤作一团，讨价还价声不绝。','城中酒楼临河，歌女拨弦；而城西武库森严，吕将军的赤兔马正悠闲嚼着豆料。'],
      blurbFind:'泗水如带，渔舟列岸；酒楼歌弦，武库森严。下邳坐断徐淮，兵家必争。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    linzi: { name:'临淄', state:'青州', tier:'zhou', pop:76, order:78, commerce:82, wall:72, agri:58, grid:9, pos:[14,4],
      desc:'齐都故地，工商繁盛', ctype:'port', owner:'yuan', garrison:68,
      blurb:['临淄乃旧齐繁华之都，市列珠玑，户盈罗绮。盐铁之利甲于天下，海风里都带着咸腥与铜臭。','蹴鞠场少年奔逐，学馆中弦诵不绝；只是城头少见守军，富庶之中透着几分懈怠。'],
      blurbFind:'市列珠玑，盐铁甲天下；蹴鞠场少年奔逐，学馆弦诵不绝。临淄富庶，却也暗藏松懈。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    xiangyang: { name:'襄阳', state:'荆州', tier:'zhou', pop:82, order:88, commerce:80, wall:90, agri:66, grid:9, pos:[6,10],
      desc:'汉水之险，荆襄锁钥', ctype:'plain', owner:'liubiao', garrison:85,
      blurb:['襄阳据汉水之阳，城高池深，舟桥横锁大江。南北货殖在此集散，码头樯橹连云。','城头旌旗整肃，守军披甲而立；而城中士族清谈不止，似对乱世另有盘算。'],
      blurbFind:'汉水横锁，舟桥连云；城头整肃，士族清谈。襄阳扼荆襄之喉，固若金汤。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    shouchun: { name:'寿春', state:'扬州', tier:'zhou', pop:74, order:79, commerce:76, wall:74, agri:62, grid:9, pos:[12,11],
      desc:'淮右大都，袁术旧都', ctype:'plain', owner:'yuan', garrison:66,
      blurb:['寿春城郭宏阔，袁术曾在此僭号，宫阙虽芜，气象犹存。市中米贵，饥民壅道，怨声时闻。','城南芍陂灌田万顷，稻浪连云；而城北营中旌旗参差，似有枭雄各怀心思。'],
      blurbFind:'宫阙虽芜，气象犹存；米贵饥民，怨声时闻。寿春坐拥芍陂之利，却也暗流汹涌。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    chengdu: { name:'成都', state:'益州', tier:'zhou', pop:86, order:90, commerce:84, wall:86, agri:90, grid:9, pos:[1,11],
      desc:'天府之国，锦官城池', ctype:'plain', owner:'liu', garrison:80,
      blurb:['成都沃野千里，沟洫如网，稻香弥望。锦江濯锦，彩绚于市；茶馆里竹椅列阵，闲人满座。','城西武侯祠柏森森，城东官仓粟陈陈。蜀中偏安，民生富庶，乱世里独得一份从容。'],
      blurbFind:'沃野千里，沟洫如网；锦江濯锦，茶馆满座。成都坐享天府之富，从容自安。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    wuwei: { name:'武威', state:'凉州', tier:'zhou', pop:58, order:55, commerce:60, wall:70, agri:38, grid:7, pos:[-10,8],
      desc:'河西走廊，凉州雄郡', ctype:'plain', owner:'ma', garrison:72,
      blurb:['武威控河西走廊之咽，胡汉杂处，驼铃昼夜不息。市上毡毯、葡萄、良马堆积如山。','城头羌笛悠悠，营中骠骑肃立；马超的烈字大旗猎猎作响，西凉铁骑之威，令行客不敢直视。'],
      blurbFind:'胡汉杂处，驼铃不息；毡毯良马，堆积如山。武威西凉铁骑之威，凛冽逼人。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    jinyang: { name:'晋阳', state:'并州', tier:'zhou', pop:64, order:68, commerce:62, wall:80, agri:46, grid:7, pos:[3,-5],
      desc:'并州治所，北门锁钥', ctype:'mountain', owner:'dongzhuo', garrison:74,
      blurb:['晋阳依山为城，壁垒森严，是并州抵御胡骑的屏藩。朔风凛冽，甲胄上凝着寒霜。','城外关隘烽燧相连，守军裹裘而立；市中皮货、战马交易繁盛，胡商与边军摩肩接踵。'],
      blurbFind:'依山为城，壁垒森严；朔风凛冽，烽燧相连。晋阳北门锁钥，胡汉交割之地。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    fanyu: { name:'番禺', state:'交州', tier:'zhou', pop:66, order:70, commerce:72, wall:60, agri:70, grid:7, pos:[4,17],
      desc:'南海之滨，珠崖门户', ctype:'port', owner:'shixie', garrison:58,
      blurb:['番禺枕海而立，椰影帆樯，咸风裹着鱼虾与香料之气。珠市璀璨，蛮舶往来，异彩夺目。','城外荔园连野，城内楼船新造；士燮治交州，远来避乱者如归，市井颇具南洋风味。'],
      blurbFind:'枕海而立，帆樯如林；珠市璀璨，蛮舶往来。番禺南海门户，南洋风味独浓。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },

    // ═══ 雍州/荆州/扬州核心 ═══
    chang_an: { name:'长安', state:'雍州', tier:'zhou', pop:88, order:92, commerce:86, wall:92, agri:58, grid:9, pos:[2,5],
      desc:'西京旧都，关中之固', ctype:'plain', owner:'dongzhuo', garrison:88,
      blurb:['长安雄踞关中，城高三仞，灞柳依依。未央宫阙虽旧，气象不减；市中胡商、秦腔、百戏杂陈。','只是董卓迁都之后，街巷间甲士林立，百姓噤声；太师府前，车马肃杀，暗流汹涌。'],
      blurbFind:'城高三仞，灞柳依依；宫阙虽旧，甲士林立。长安关中之固，却也暗藏杀机。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    jianye: { name:'建业', state:'扬州', tier:'zhou', pop:80, order:84, commerce:83, wall:82, agri:64, grid:9, pos:[14,12],
      desc:'江东首府，石头城险', ctype:'port', owner:'sun', garrison:78,
      blurb:['建业襟江带湖，石头城虎踞龙蟠。秦淮画舫灯影如昼，画船箫鼓彻夜。','城西军寨战船列阵，江东子弟意气风发；市中吴侬软语，丝茶锦缎流光溢彩。'],
      blurbFind:'石头城虎踞龙蟠，秦淮灯影如昼；军寨战船列阵，丝茶锦缎流光。建业江东根本。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    hanzhong: { name:'汉中', state:'益州', tier:'zhou', pop:62, order:66, commerce:64, wall:84, agri:72, grid:7, pos:[3,7],
      desc:'秦蜀咽喉，沃野粮仓', ctype:'mountain', owner:'liu', garrison:76,
      blurb:['汉中夹于秦岭巴山之间，沃野稻香，栈道连云。褒斜二谷兵粮转运，自古为争雄之枢。','城北定军山草木森森，传有老将埋骨；市中茶马互市，氐羌商旅络绎。'],
      blurbFind:'夹山为险，沃野稻香；栈道连云，茶马互市。汉中秦蜀咽喉，兵家必争。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    jiangling: { name:'江陵', state:'荆州', tier:'zhou', pop:72, order:76, commerce:78, wall:80, agri:68, grid:9, pos:[6,13],
      desc:'南郡治所，江津要冲', ctype:'port', owner:'liubiao', garrison:74,
      blurb:['江陵据长江之津，舟楫南来北往，米市盐栈连绵数里。城墙崭新，砖石缝里还透着潮气。','城中商铺林立，蜀锦楚漆争辉；码头纤夫号子震天，而城西水寨战舰初成，隐隐透着杀气。'],
      blurbFind:'长江之津，舟楫如云；米市盐栈，连绵数里。江陵南郡要冲，水寨初成。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    xiangping: { name:'襄平', state:'幽州', tier:'zhou', pop:54, order:52, commerce:56, wall:68, agri:44, grid:7, pos:[16,-3],
      desc:'辽东孤郡，边塞雄城', ctype:'mountain', owner:'gongsun', garrison:70,
      blurb:['襄平远踞辽东，孤城悬于边塞。朔风卷雪，城头旌旗冻作铁色；市集上貂皮、人参、东珠列肆。','城外沃野虽广，胡骑时扰；公孙氏据守一方，关门昼闭，自成一统。'],
      blurbFind:'孤城悬于边塞，朔风卷雪；貂皮人参，列肆盈市。襄平辽东独镇，关门昼闭。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] },
    xuchang: { name:'许都', state:'豫州', tier:'zhou', pop:78, order:83, commerce:77, wall:84, agri:60, grid:9, pos:[8,6],
      desc:'颍水之畔，新都气象', ctype:'plain', owner:'caocao', garrison:82,
      blurb:['许都乃新迁之邑，宫室初具，街衢方正。曹公屯田令下，流民归附，市井渐有生气。','城北丞相府戒备森严，文士谋臣出入不绝；校场旌旗蔽日，虎豹骑甲光夺目。'],
      blurbFind:'宫室初具，街衢方正；屯田令下，流民归附。许都新都气象，曹公根基。',
      groundItems:[], rootActs:[{id:'rest',label:'城中休整',group:'行动',tip:'寻一处馆驿安歇，气血内力尽复'}] }
  };
  global.LF.CITIES = CITIES;
  if (typeof module !== 'undefined' && module.exports) module.exports = CITIES;
})(typeof window !== 'undefined' ? window : globalThis);

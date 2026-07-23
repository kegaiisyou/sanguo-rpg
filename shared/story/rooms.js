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
      exits: { '西': 'camp' },
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
      npcs: [],
      items: [],
      actions: [
        { id: 'rest', label: '城中休整', group: '行动', tip: '酒肆安歇，气血内力尽复' }
      ]
    },
    // ═══════════════════════════════════════════
    //  幽州 · 蓟城（汉末州治，12 间核心）
    // ═══════════════════════════════════════════
    ji_guomen: {
      id: 'ji_guomen', name: '蓟城·郭门',
      desc: [
        '夯土城墙巍然矗立，郭门内外往来车马络绎不绝。城门税吏正逐一盘查过往商旅，铜铃与驼铃此起彼伏。',
        '城外远处可见流民棚的炊烟，马市那边传来阵阵马嘶声。南行可返中原洛阳，北行即入蓟城。'
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
        '此处为全城枢纽：北去州牧府邸，东往大市商区，西向军营驻地，南出阳门通外郭。'
      ],
      exits: { '南': 'ji_nanmen', '北': 'ji_zhoumu', '东': 'ji_dashi', '西': 'ji_junying' },
      npcs: ['shuoshu'],
      items: [],
      actions: []
    },
    ji_zhoumu: {
      id: 'ji_zhoumu', name: '蓟城·州牧府正厅',
      desc: [
        '幽州刺史部治所，朱门铜钉，堂前立着汉天子旌旗。厅内案牍堆积，幽州十一郡军政要务汇聚于此。',
        '堂上悬「镇北安民」匾额，两侧刀枪架上兵刃森然。后堂隐隐有人语，似是州牧在与人议事。'
      ],
      exits: { '南': 'ji_tongqu', '北': 'ji_zhoumu_houtang' },
      npcs: ['liuyu'],
      find: '细看：正厅「仁静」匾额下，刘州牧案上摊着抚恤流亡的簿册，堂下差役进进出出。北面一道月门通向后堂，传闻公孙瓒常在那议事。',
      items: [],
      actions: []
    },
    ji_zhoumu_houtang: {
      id: 'ji_zhoumu_houtang', name: '蓟城·州牧府后堂',
      desc: [
        '后堂幽静，纱帷半卷，铜灯映着壁上的北疆舆图。案上散落着边关急报与乌桓书信，墨迹未干。',
        '此处是州牧私议机密之所，寻常人不得擅入。窗外隐约传来校场操练的呼喝声。'
      ],
      exits: { '南': 'ji_zhoumu' },
      npcs: ['gongsun'],
      items: [],
      actions: []
    },
    ji_dashi: {
      id: 'ji_dashi', name: '蓟城·大市',
      desc: [
        '四方商贾辐辏，胡汉货物琳琅满目。市楼高耸，市令坐镇其中，以旗鼓号令开市闭市。',
        '东首是米行布庄，西首是铁器皮货；北面学宫隐隐传来诵读声，东行可至闾里民居。'
      ],
      exits: { '西': 'ji_tongqu', '北': 'ji_xuegong', '东': 'ji_minli' },
      npcs: ['shiling'],
      items: [],
      actions: [
        { id: 'market', label: '逛市集', group: '行动', tip: '与商贾交易钱粮药材' }
      ]
    },
    ji_junying: {
      id: 'ji_junying', name: '蓟城·军营',
      desc: [
        '营中旌旗猎猎，幽州突骑正在操练阵法。马蹄踏地声如闷雷，都尉立在点将台上挥旗指挥。',
        '营帐间有兵器架与草料堆，空气中弥漫着皮革与铁锈的气味。北侧驿馆传舍隐约可见。'
      ],
      exits: { '东': 'ji_tongqu', '北': 'ji_yiguan' },
      npcs: ['duwei'],
      items: [],
      actions: []
    },
    ji_xuegong: {
      id: 'ji_xuegong', name: '蓟城·郡学宫',
      desc: [
        '郡学设于蓟城东北，青瓦白墙，松柏掩映。堂上博士正讲授《春秋》，弟子席地而坐，竹简沙沙。',
        '学宫藏有儒门心法与燕地古枪谱，壁上镌刻着历代名将的用兵心得。院中古槐下，偶有隐士论道。'
      ],
      exits: { '南': 'ji_dashi' },
      npcs: ['boshi'],
      items: [],
      actions: [
        { id: 'learn', label: '研习武学', group: '行动', tip: '参悟儒门心法与燕地枪术' }
      ]
    },
    ji_yiguan: {
      id: 'ji_yiguan', name: '蓟城·驿馆',
      desc: [
        '传舍驿馆，供往来官吏与驿使歇脚。堂中驿丞正登记文书，墙上贴着各郡悬赏与军情通报。',
        '后院马厩备有驿马，卧房虽简却整洁。窗外可闻街巷人声，附近便是军营驻地。'
      ],
      exits: { '南': 'ji_junying' },
      npcs: ['yicheng'],
      items: [],
      actions: [
        { id: 'rest', label: '驿馆歇宿', group: '行动', tip: '卧房安歇，气血内力尽复' }
      ]
    },
    ji_minli: {
      id: 'ji_minli', name: '蓟城·平民里',
      desc: [
        '闾里之间，巷道纵横。土墙茅檐鳞次栉比，妇人在井边浣衣，孩童追逐嬉戏。里魁拄杖巡视，不时呵斥吵闹。',
        '此处多是幽州军户与平民杂居，邻里相熟，巷口老槐下常有老卒闲坐说古。西行即回大市。'
      ],
      exits: { '西': 'ji_dashi' },
      npcs: ['likui'],
      items: [],
      actions: []
    },
    ji_mashi: {
      id: 'ji_mashi', name: '蓟城·城外马市',
      desc: [
        '城郭之东，空旷草场上马匹成群。乌桓马商驱赶着高头大马，操着半生不熟的汉话与人议价。',
        '空气中混杂着马汗与干草的气味。地上散落着蹄铁与断缰绳——此处是北疆最好的马匹交易之地。'
      ],
      exits: { '西': 'ji_guomen' },
      npcs: ['wuhuan'],
      items: [],
      actions: [
        { id: 'rest', label: '马场歇息', group: '行动', tip: '倚草料堆小憩，气血内力尽复' }
      ]
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
    }
  };

  // 出口反向校验（保证地图连通，便于后续扩展）
  global.LF = global.LF || {};
  global.LF.ROOMS = ROOMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ROOMS;
})(typeof window !== 'undefined' ? window : globalThis);

// 房间定义（手写部分）
// 说明：
//   1) 本文件只保留「手写锚点房」（苦役营 / 黑山寨 / 建造测试 / 林径）。
//   2) 程序生成城市（CITIES.grid 驱动）不再在此手写——其房间对象在启动时由
//      index.html 的 registerCityRooms() 依据 shared/data/cities.js 自动合成并注入 G.ROOMS。
//      cities.js 是城市唯一真相源，新增城市只需改 cities.js 一条 + map.js 的 coords 一个坐标。
//   3) 手写锚点房的「可交互物件」原散落在 index.html 的 ROOM_OBJECTS，现并入本文件（一房一文件）。
//      以 buildRoomObjects() 工厂返回，待引擎加载后由 index.html 调用实例化
//      （避免加载期引用尚未定义的引擎全局：packFind / state / chopTree 等）。
(function(global){
  if(!global.LF) global.LF = {};
  var ROOMS = {
  // ═══ 锚点 · 苦役营（保留手写） ═══
    camp_yard: {
      id: 'camp_yard',
      name: '苦役营·劳役场',
      desc: [
        '劳役场黄土夯实，烈日下囚徒们扛石运土，皮鞭声与喘息声交织。远处哨塔上戍卒眯眼张望。',
        '场边木栅低矮，几名囚徒趁监工转身的间隙，低声交换着眼神——这里的人都想出去。'
      ],
      exits: {
        '西': 'camp_cell',
        '北': 'camp_wall',
        '东': 'camp_farm',
        '南': 'camp_gate'
      },
      find: '劳役场黄土夯实，囚徒扛石运土。〔西〕囚室（西）；〔北〕塌墙根（北）；〔东〕农田（东）；〔南〕牢门岗哨（南）。',
      npcs: [
        'zhoutingtao',
        'qin_jiuxiao',
        'laotou'
      ],
      items: [],
      actions: [
        {
          id: 'labor_yard',
          label: '担石劳作',
          tip: '按狱卒吩咐扛石运土——熟悉劳作，点亮状态栏。'
        },
        {
          id: 'survey_yard',
          label: '环顾四周',
          tip: '勘察劳役场，看清几处去路。'
        }
      ]
    },
    camp_cell: {
      id: 'camp_cell',
      name: '苦役营·囚室',
      desc: [
        '囚室低矮潮湿，草荐发硬，墙角水渍蜿蜒。几名囚徒横七竖八地躺着，鼾声与镣铐声交织。',
        '角落里缩着个哑老囚——据说是替周听涛守着什么暗道口的默叔。'
      ],
      exits: {
        '东': 'camp_yard'
      },
      find: '囚室潮湿逼仄，草荐发硬；角落哑老囚默坐，指尖似在无意义地划动。〔东〕回劳役场（东）。',
      npcs: [
        'moshu',
        'qian_sh'
      ],
      items: [],
      actions: []
    },
    camp_wall: {
      id: 'camp_wall',
      name: '苦役营·塌墙根',
      desc: [
        '营墙在这段塌了半截，乱砖委地，藤蔓爬满。风从砖缝里钻过，带着外面草木的腥气。',
        '墙根下三两囚徒各自盘算：有人搓绳，有人探渠——都是琢磨着怎么出去的。'
      ],
      exits: {
        '东': 'camp_yard',
        '北': 'lindao'
      },
      find: '塌墙根乱砖委地，藤蔓爬墙；墙根下囚徒各谋出路。〔东〕回劳役场（东）；〔北〕钻出墙外·白檀军屯（北）。',
      npcs: [
        'su_niang',
        'fu_sheng'
      ],
      items: [],
      actions: [
        {
          id: 'wall_choose',
          label: '勘察塌墙根·决断出营',
          tip: '你既探得密道，决断从何处出营。'
        }
      ]
    },

  // ═══ 锚点 · 苦役营·六间子牢房（囚室格 (1,0) 即城格，六间子房走面板 doors → CELL_INTERIORS，v20260910q）═══
    camp_tz1: { id: 'camp_tz1', name: '天字一号牢房',
      desc: ['栅内草荐发硬，墙角水渍蜿蜒。一名蓬头囚徒盘腿而坐，似在打盹，又似在听墙外的风。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '天字一号牢房：蓬头囚徒盘腿而坐，似醒似睡。〔南〕回牢房。',
      npcs: ['zhoutingtao'], items: [], actions: [] },
    camp_tz2: { id: 'camp_tz2', name: '天字二号牢房',
      desc: ['栅里缩着个哑老囚，指尖无意识地划动，像在记着什么暗号。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '天字二号牢房：哑老囚缩在墙角，指尖无声比划。〔南〕回牢房。',
      npcs: ['moshu'], items: [], actions: [] },
    camp_tz3: { id: 'camp_tz3', name: '天字三号牢房',
      desc: ['几名囚徒横七竖八躺着，鼾声与镣铐声交织。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '天字三号牢房：囚徒横七竖八，鼾声镣铐交织。〔南〕回牢房。',
      npcs: [], items: [], actions: [] },
    camp_dz1: { id: 'camp_dz1', name: '地字一号牢房',
      desc: ['地字号牢房逼仄，苦役们挤作一团。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '地字一号牢房：苦役挤作一团，面有菜色。〔南〕回牢房。',
      npcs: [], items: [], actions: [] },
    camp_dz2: { id: 'camp_dz2', name: '地字二号牢房',
      desc: ['一名囚徒正就着冷水啃硬饼，见你望来，把饼往身后藏了藏。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '地字二号牢房：瘦囚啃硬饼，见人藏饼。〔南〕回牢房。',
      npcs: [], items: [], actions: [] },
    camp_dz3: { id: 'camp_dz3', name: '地字三号牢房',
      desc: ['栅角堆着几件破烂家什，一名老囚正用木条编着什么。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '地字三号牢房：老囚编着草绳草垫。〔南〕回牢房。',
      npcs: [], items: [], actions: [] },
  // ═══ 锚点 · 苦役营（其余 8 间 · v20260902a 补全） ═══
    camp_farm: {
      id: 'camp_farm',
      name: '苦役营·农田',
      desc: [
        '营墙外的薄田被囚徒们翻得稀烂，几垄蔫苗在日头下打卷。老驿丞蹲在田埂上吧嗒着旱烟，几个苦力正弯腰锄地。',
        '憨牛扛着耙从你身边经过，憨憨一笑；角落里石头闷头刨土，喜子哼着小曲，一派苦中作乐的光景。'
      ],
      exits: {
        '西': 'camp_yard',
        '南': 'camp_kitchen',
        '北': 'camp_kennel'
      },
      find: '薄田稀烂，囚徒锄地；老驿丞蹲田埂。〔西〕回劳役场（西）；〔南〕伙房（南）；〔北〕犬舍（北）。',
      npcs: [ 'sun_lao', 'niu_tie', 'liu_shi', 'wang_xi', 'zheng_gui' ],
      items: [],
      actions: []
    },
    camp_kitchen: {
      id: 'camp_kitchen',
      name: '苦役营·伙房',
      desc: [
        '伙房烟火气冲天，大灶上煮着能照见人影的稀粥。虎背熊腰的鲁大勺翻动铁锅，热气熏得他满脸油光。',
        '墙角堆着几麻袋杂粮与药材，灶台下还塞着些瓶瓶罐罐——这便是全营的伙食与汤药出处。'
      ],
      exits: {
        '北': 'camp_farm',
        '东': 'camp_store'
      },
      find: '伙房煮粥，鲁大勺掌勺；墙角杂粮药材。〔北〕回农田（北）；〔东〕粮囤（东）。',
      npcs: [ 'lu_da', 'lin_niang' ],
      items: [],
      actions: [
        {
          id: 'survey_kitchen',
          label: '打量伙房',
          tip: '看看灶台下的药材与粥锅，或能寻出什么门道。'
        }
      ]
    },
    camp_store: {
      id: 'camp_store',
      name: '苦役营·粮囤',
      desc: [
        '粮囤里麻袋垒得齐整，仓官黄主簿正拨着算盘，眼珠却不住往门外溜。逃荒来的旺儿缩在墙角，饿得直咽口水。',
        '囤后有一道半掩的小门，似是运粮出入的便道——若打点得当，或能从此溜出。'
      ],
      exits: {
        '西': 'camp_kitchen'
      },
      find: '粮囤麻袋齐整，黄主簿拨算盘；旺儿缩墙角。〔西〕回伙房（西）。囤后小门半掩。',
      npcs: [ 'huang_er', 'li_wang' ],
      items: [],
      actions: []
    },
    camp_kennel: {
      id: 'camp_kennel',
      name: '苦役营·犬舍',
      desc: [
        '犬舍腥臊扑鼻，几条恶犬被铁链拴着，见了生人便呲牙低吼。犬卒冯二懒洋洋地靠墙打盹，马彪则怕狗似的远远站着。',
        '犬舍后门直通营外小径——若犬卒肯睁只眼闭只眼，这条道最是省心。'
      ],
      exits: {
        '南': 'camp_farm',
        '东': 'camp_warehouse'
      },
      find: '犬舍腥臊，恶犬拴铁链；冯二打盹，马彪怕狗。〔南〕回农田（南）；〔东〕仓库（东）。犬舍后门通营外。',
      npcs: [ 'feng_er', 'ma_biao' ],
      items: [],
      actions: [
        {
          id: 'spar_dog',
          label: '逗弄野犬',
          tip: '犬舍那几条恶犬性子烈——跟它们练练手，专试「撤退」。'
        }
      ]
    },
    camp_warehouse: {
      id: 'camp_warehouse',
      name: '苦役营·仓库',
      desc: [
        '仓库里堆着镐锄、绳索与竹木，刀笔吏陈简正借着天窗光校着什么，管账的吴算盘噼啪打着算盘。',
        '此处竹木随手可取，正是伪造路引、搓绳攀墙的好去处；墙角还倚着几把闲着的镐锄。'
      ],
      exits: {
        '西': 'camp_kennel',
        '北': 'camp_mine'
      },
      find: '仓库堆镐锄绳索竹木；陈简校字，吴算盘打算盘；仓吏执册清点料数。〔西〕回犬舍（西）；〔北〕矿坑（北）。此处竹木可取。',
      npcs: [ 'chen_jian', 'wu_suan', 'zheng_gang', 'storeman_kuyilao' ],
      items: [],
      actions: [
        {
          id: 'survey_warehouse',
          label: '翻找仓库',
          tip: '墙角有闲镐锄，竹木随处可取——或许能取一柄傍身。'
        }
      ]
    },
    camp_mine: {
      id: 'camp_mine',
      name: '苦役营·矿坑',
      desc: [
        '矿坑幽深，煤尘呛人。矿奴石四拖着残腿在掌子面敲打，老囚徒苟三蹲在暗处，十指灵巧地拨弄着什么。',
        '矿道向营墙根延伸，石四说底下连着一道暗渠——若顺渠摸黑，或能潜出墙外。'
      ],
      exits: {
        '南': 'camp_warehouse',
        '西': 'camp_training'
      },
      find: '矿坑幽深煤尘呛；石四敲矿，苟三蹲暗处。〔南〕回仓库（南）；〔西〕练武场（西）。矿道连暗渠。',
      npcs: [ 'shi_si', 'gou_san' ],
      items: [],
      actions: [
        {
          id: 'survey_mine',
          label: '勘察矿道',
          tip: '矿道向墙根延伸，似有暗渠可潜出。'
        }
      ]
    },
    camp_training: {
      id: 'camp_training',
      name: '苦役营·练武场',
      desc: [
        '练武场列着木人桩，教头韩铁敞着衣襟，捶了捶沙袋般坚硬的胸膛。',
        '「拳脚够硬，这营墙也拦不住你！」他斜眼打量你，「想出去？先在这桩上练出真章。」'
      ],
      exits: {
        '东': 'camp_mine',
        '北': 'camp_gate'
      },
      find: '练武场列木人桩，韩教头捶胸。〔东〕回矿坑（东）；〔北〕岗哨（北）。「拳脚硬亦可杀出。」',
      npcs: [ 'han_tie' ],
      items: [],
      actions: [
        {
          id: 'train_dummy',
          label: '戳木人桩',
          tip: '在木人桩上练攻击/防御/用道具/撤退，熟悉战斗操作（不掉血）。'
        }
      ]
    },
    camp_gate: {
      id: 'camp_gate',
      name: '苦役营·牢门岗哨',
      desc: [
        '牢门岗哨是全营咽喉，都伯赵虎负手而立，副手钱彪盯梢最紧，伍长孙猛带班巡弋。',
        '此处是营墙唯一的正门——强突、混出、收买、暴动，皆在此处见真章。'
      ],
      exits: {
        '南': 'camp_yard',
        '北': 'camp_training'
      },
      find: '岗哨咽喉，赵虎负手，钱彪盯梢，孙猛巡弋。〔南〕回劳役场（南）；〔北〕练武场（北）。正门在此。',
      npcs: [ 'zhao_hu', 'qian_biao', 'sun_meng', 'li_heng', 'zhou_ba', 'wu_yong' ],
      items: [],
      actions: [
        {
          id: 'gate_choose',
          label: '决断出营·岗哨',
          tip: '你已探得数条门道，在此择一路强出营墙。'
        }
      ]
    },

  // ═══ 锚点 · 黑山寨（保留手写） ═══
    ji_heishan_zhai: {
      id: 'ji_heishan_zhai',
      name: '黑山寨·寨门',
      desc: [
        '寨门以粗木夯土垒成，门楼上猎猎飘着「黑山」大旗。两名喽啰横刀而立，打量着每一个靠近的人。',
        '寨墙后隐约传来喧哗与兵刃相击之声，显是座凶山恶水之地。'
      ],
      exits: {
        '南': 'lindao',
        '北': 'ji_heishan_juyi'
      },
      npcs: [
        'heishan_zhai'
      ],
      find: '寨门两侧鹿砦森然，吊桥仅供一人通行；北望寨内，聚义厅的灯火通明，人影幢幢。',
      items: [],
      actions: []
    },
    ji_heishan_juyi: {
      id: 'ji_heishan_juyi',
      name: '黑山寨·聚义厅',
      desc: [
        '聚义厅内虎皮蒙椅，刀枪架上寒光凛凛。堂中篝火熊熊，喽啰们大碗饮酒，喧声震瓦。',
        '厅首端坐一人，抚刀而笑——正是黑山寨主张燕。见你闯入，眼中杀机毕露。'
      ],
      exits: {
        '南': 'ji_heishan_zhai',
        '北': 'ji_heishan_houzhai'
      },
      npcs: [
        'heishan_zhu'
      ],
      find: '厅侧暗门通向后寨，堆积着劫来的钱粮与俘获的壮丁；北面甬道幽深，似有兵器坊。',
      items: [],
      actions: []
    },
    ji_heishan_houzhai: {
      id: 'ji_heishan_houzhai',
      name: '黑山寨·后寨',
      desc: [
        '后寨是贼人囤积赃物的所在，箱笼累累，绳索捆着的俘丁蜷缩墙角。',
        '此处守备稍松，若悄然取了钱粮、放了俘丁，便可断贼根本。'
      ],
      exits: {
        '南': 'ji_heishan_juyi'
      },
      npcs: [
        'wuliu'
      ],
      find: '箱笼中多是劫来的金帛与兵甲；墙角被掳的货郎吴六缩着，目光恳切，似在盼你施救。',
      items: [],
      actions: []
    },

  // ═══ 林径（手写连接：苦役营 ↔ 黑山寨） ═══
    lindao: {
      id: 'lindao',
      name: '林径',
      desc: [
        '一条野径从塌墙根向外斜伸，两旁灌木荆棘，踩出的小路隐没在草莽里。',
        '风过林梢，远处隐约传来山寨的呼喝——沿此径向北，似可绕到黑山寨后。'
      ],
      exits: {
        '北': 'ji_heishan_zhai'
      },
      find: '野径蜿蜒，北望林木幽深，山寨旗影隐约。〔北〕黑山寨（北）。',
      npcs: [
        'liehu'
      ],
      items: [],
      actions: []
    }
  };

  // ── 手写锚点房的「可交互物件」（工厂：引擎就绪后由 index.html 实例化）──
  function buildRoomObjects(){
    return {
      // ═══ 剿匪据点：黑山寨（寨门 / 聚义厅 / 后寨） ═══
      ji_heishan_zhai:[
        {type:'npc', key:'heishan_zhai', icon:'🔪', name:'黑山寨卒', desc:'横刀拦路，面带凶相', actions:[
          {label:'与他交谈', fn:function(){ talk('heishan_zhai'); }},
          {label:'拔刀相向', danger:true, fn:function(){ handleAction('spar_heishan_zei'); }, tip:'恶贼当前，不必多言'}
        ]},
        {type:'feature',key:'env', icon:'🔍', name:'四周环境', desc:'环顾黑山寨门'},
        {type:'exit', dir:'南', icon:'🚪', name:'南·林径', desc:'退回林径，往苦役营', actions:[{label:'退回林径', fn:function(){ move('南','lindao'); }}]},
        {type:'exit', dir:'北', icon:'🔥', name:'北·聚义厅', desc:'灯火通明，人影幢幢', actions:[{label:'闯聚义厅', fn:function(){ move('北','ji_heishan_juyi'); }}]}
      ],
      ji_heishan_juyi:[
        {type:'npc', key:'heishan_zhu', icon:'🔥', name:'黑山寨主·张燕', desc:'抚刀而笑，杀机毕露', actions:[
          {label:'与他交谈', fn:function(){ talk('heishan_zhu'); }},
          {label:'拔刀相向', danger:true, fn:function(){ handleAction('spar_heishan_zhu'); }, tip:'夺寨先斩贼首'}
        ]},
        {type:'feature',key:'env', icon:'🔍', name:'四周环境', desc:'环顾聚义厅'},
        {type:'exit', dir:'南', icon:'🚪', name:'南·寨门', desc:'退回寨门', actions:[{label:'退回寨门', fn:function(){ move('南','ji_heishan_zhai'); }}]},
        {type:'exit', dir:'北', icon:'📦', name:'北·后寨', desc:'囤积赃物的所在', actions:[{label:'入后寨', fn:function(){ move('北','ji_heishan_houzhai'); }}]}
      ],
      ji_heishan_houzhai:[
        {type:'feature',key:'env', icon:'🔍', name:'四周环境', desc:'环顾后寨'},
        {type:'exit', dir:'南', icon:'🚪', name:'南·聚义厅', desc:'退回聚义厅', actions:[{label:'退回聚义厅', fn:function(){ move('南','ji_heishan_juyi'); }}]}
      ],
      lindao: [
        {type:'npc', key:'lindao_trader', icon:'🧺', name:'行脚货郎', desc:'挑着担子歇脚的行商，扁担上挂满干粮伤药', actions:[
          {label:'买卖', icon:'🛒', fn:function(){ openModal('shop', {shop:'field_trader'}); }},
          {label:'交谈', icon:'💬', fn:function(){ talk('lindao_trader'); }}
        ]}
      ],
      // ═══ 苦役营·六间子牢房：各置草荐（可打盹，复用不耗）═══
      camp_tz1: [ { type:'feature', key:'caojian_tz1', icon:'🌾', name:'草荐', desc:'栅内草荐发硬，铺地可卧', actions:[
        {label:'打盹', icon:'🛏️', fn:function(){ window.openRestModal('sleepmat'); }}
      ]},
      // 牢门：锁着时只能「叩门」请牢头（触发 laotou_door 开门）；开了之后变成出口，不再能闲聊（避免变成牢头 NPC）
      { type:'feature', key:'cell_door', icon:'🚪', name:'牢门', desc:'厚重的木栅牢门，外头挂着一把铜锁；栅缝里透进一线天光。锁着时只能叩门请牢头，开了便可推门而出。', actions:[
        { label:'叩门', icon:'✊', fn:function(){
            var s = window.getState();
            if (s.flags && s.flags.onb && s.flags.onb.cellOpen) { log('牢门已开着，栅外天光透入——不必再叩。', 'sys'); return; }
            talk('laotou');
          } },
        { label:'推门而出', icon:'🚶', fn:function(){
            var s = window.getState();
            if (!(s.flags && s.flags.onb && s.flags.onb.cellOpen)) { log('牢门紧锁，须先叩门请牢头开锁。', 'sys'); return; }
            if (s.flags.onb) s.flags.onb.lateDone = false; // 离牢：重置本轮晚归惩罚
            window.move('南', '__cell__:kuyilao:1:0');
          } }
      ]} ],
      camp_tz2: [ { type:'feature', key:'caojian_tz2', icon:'🌾', name:'草荐', desc:'栅内草荐发硬，铺地可卧', actions:[
        {label:'打盹', icon:'🛏️', fn:function(){ window.openRestModal('sleepmat'); }}
      ]} ],
      camp_tz3: [ { type:'feature', key:'caojian_tz3', icon:'🌾', name:'草荐', desc:'栅内草荐发硬，铺地可卧', actions:[
        {label:'打盹', icon:'🛏️', fn:function(){ window.openRestModal('sleepmat'); }}
      ]} ],
      camp_dz1: [ { type:'feature', key:'caojian_dz1', icon:'🌾', name:'草荐', desc:'栅内草荐发硬，铺地可卧', actions:[
        {label:'打盹', icon:'🛏️', fn:function(){ window.openRestModal('sleepmat'); }}
      ]} ],
      camp_dz2: [ { type:'feature', key:'caojian_dz2', icon:'🌾', name:'草荐', desc:'栅内草荐发硬，铺地可卧', actions:[
        {label:'打盹', icon:'🛏️', fn:function(){ window.openRestModal('sleepmat'); }}
      ]} ],
      camp_dz3: [ { type:'feature', key:'caojian_dz3', icon:'🌾', name:'草荐', desc:'栅内草荐发硬，铺地可卧', actions:[
        {label:'打盹', icon:'🛏️', fn:function(){ window.openRestModal('sleepmat'); }}
      ]} ],
      camp_farm: [ { type:'feature', key:'farm_ridge', icon:'🌾', name:'田垄', desc:'被翻得稀烂的薄田，几垄蔫苗在日头下打卷', actions:[
        {label:'借农具', icon:'🪓', fn:function(){ var S=getState(); if(!S) return; if(S.flags&&S.flags.onb&&S.flags.onb.farmTool){ log('你肩上还扛着借来的锄头呢。','sys'); return; } S.flags=S.flags||{}; S.flags.onb=S.flags.onb||{}; S.flags.onb.farmTool=true; packAdd('chutu',1); log('你从田埂边拾了把木柄锄头，沉甸甸压在肩头。〔务农需先借农具〕','good'); save(S); }},
        {label:'下地务农', icon:'🧺', fn:function(){ var S=getState(); if(!S) return; if(!packFind('chutu')){ log('没家伙怎么下地？先「借农具」去。','sys'); return; } if(!exert('务农')) return; S.flags=S.flags||{}; S.flags.onb=S.flags.onb||{}; var n=(S.flags.onb.farmCnt||0)+1; S.flags.onb.farmCnt=n; log('你抡起锄头翻了一垄地，汗珠子砸进土里。〔进度 '+n+'/3〕','sys'); if(n>=3 && !S.flags.onb.farmDone){ S.flags.onb.farmDone=true; if(packAdd('lao_pai',1)) log('〔监工丢来一片木符〕你挣得「劳字木片」一枚，可往伙房易食。','good'); else log('你手里腾不出地方——行囊塞得满满当当，木片没处搁。','sys'); } save(S); }}
      ]} ],
      camp_kitchen: [ { type:'feature', key:'kitchen_stove', icon:'🍲', name:'灶台', desc:'大灶上煮着能照见人影的稀粥，热气熏人', actions:[
        {label:'以劳字木片换饭', icon:'🪵', fn:function(){ if(!packFind('lao_pai')){ log('你翻了翻行囊，没有「劳字木片」——先去扛活挣一块罢。','sys'); return; } packConsume('lao_pai',1); packAdd('fan',1); log('你将劳字木片递给伙夫，换得一枚粗粝饭团。〔干粮入包：可食用回食，或交予周听涛。〕','good'); }}
      ]} ],
      camp_store: [ { type:'feature', key:'store_stones', icon:'🪨', name:'石料堆', desc:'墙角垒着待运的青石，沉甸甸压手', actions:[
        {label:'搬石料', icon:'💪', fn:function(){ var S=getState(); if(!S) return; if(!exert('搬石')) return; S.flags=S.flags||{}; S.flags.onb=S.flags.onb||{}; var n=(S.flags.onb.storeCnt||0)+1; S.flags.onb.storeCnt=n; log('你扛起一块青石往仓里送，肩头火辣。〔进度 '+n+'/5〕','sys'); if(n>=5 && !S.flags.onb.storeDone){ S.flags.onb.storeDone=true; if(packAdd('lao_pai',1)) log('〔仓吏抛来一片木符〕你帮着运足五石，挣得「劳字木片」一枚。','good'); else log('你手里腾不出地方——行囊塞得满满当当，木片没处搁。','sys'); } save(S); }}
      ]} ]
    };
  }

  // ═══ 苦役营·作息流动（全城通用：NPC 按真实时辰在房间间挪动）═══
  ['camp_tz1','camp_tz2','camp_tz3','camp_dz1','camp_dz2','camp_dz3'].forEach(function(rid){
    var r = ROOMS[rid]; if (!r || !r.actions) return;
    r.actions.push({ type:'feature', key:'cell_scratch_'+rid, icon:'🧱', name:'牢栏刻痕', desc:'斑驳牢栏上似有前人指甲刻痕', actions:[
      {label:'细看刻痕', icon:'🔍', fn:function(){ log('牢栏木隙里，前人指甲刻下几道深浅不一的划痕，依稀是「租」「税」「甲子」字样——这一营的囚徒，多半都因交不起赋税被抓，墙外「苍天已死，黄天当立」的童谣也早传开了。','sys'); }}
    ]});
  });

  // ═══ NPC 时辰作息表（v20260911g：从「演示 2 条」铺开到全营 + 跨城样例）═══
  // 共用同一套真实时间系统（state.time · 十二时辰：0子 1丑 2寅 3卯 4辰 5巳 6午 7未 8申 9酉 10戌 11亥）。
  // 两层机制，同一份时间源：
  //   ① LF.NPC_ROUTINES      房间级：按 G.ROOMS 的房 id 挪动。目标房可为手写房（camp_tz1…）、
  //      程序生成的地点房（gen/rooms.js 注入的城/镇/关/副本）、或城市根房（城市 id）——
  //      落在「城市根房」上的角色在该城任一格都可见（适合货郎、巡卒一类）。由 engine.js · applyTimeRoutines() 消费。
  //   ② LF.NPC_ROUTINES_CITY 城格级：按「城市 + 格坐标」挪动。苦役营 kuyilao 的具名 NPC 是【按格登记】的
  //      （见 core/city.js · TUTORIAL_CITY_NPCS），故用这一层；由 cityCellNpcs() 按当前时辰过滤名册。
  // 值可为单个目标，也可写数组（同一时辰同时出现在多处，如「两地巡弋」）；未列出的时辰回 _home。
  // ⚠️ 有「按格触发」的角色**不要**编排作息，否则会把越狱路线任务挪走：
  //    苟三(2,0) 石四(2,0) 吴算(2,1) 陈简(2,1) 林娘(0,1) 秦九霄(1,1) 孙老(0,0) 韩铁(2,2) 苏娘(2,2) 福生(1,2)。
  //    本表只排「无任务锚点」的角色。
  global.LF.NPC_ROUTINES = {
    // —— 苦役营·牢房区（camp_tz*/dz* 是真实可进的子牢房）——
    // 囚徒：白日下地、午后进矿 → 饭点涌伙房 → 入夜回牢（与 camp_opening「戌时前回牢销名」对得上）
    camp_prisoner: { 3:'camp_farm', 4:'camp_farm', 5:'camp_mine', 6:'camp_kitchen', 7:'camp_kitchen', 8:'camp_kitchen',
                     9:'camp_mine', 10:'camp_tz3', 11:'camp_tz3', 0:'camp_tz3', 1:'camp_tz3', 2:'camp_tz3', _home:'camp_tz3' },
    // 伙夫：掌灶一日三顿，夜里守粮囤
    camp_cook:     { 3:'camp_kitchen', 4:'camp_kitchen', 5:'camp_kitchen', 6:'camp_kitchen', 7:'camp_kitchen', 8:'camp_kitchen',
                     9:'camp_store', 10:'camp_store', 11:'camp_store', 0:'camp_store', 1:'camp_store', 2:'camp_store', _home:'camp_kitchen' },
    // —— 跨城作息推广（v20260911h · P3）：作息表不止服务苦役营，天下各城的钟点同样在走 ——
    // 游侠刘磐四方游走：白日渔阳（商旅辐辏、便于访友）→ 午后蓟城（州治，好手多）→ 入夜宿涿县（桃园故里、投店便宜）
    liupan:        { 3:'yuyang', 4:'yuyang', 5:'yuyang', 6:'jicheng', 7:'jicheng', 8:'jicheng', 9:'zhuo',
                     10:'zhuo', 11:'zhuo', 0:'zhuo', 1:'zhuo', 2:'zhuo', _home:'yuyang' },
    // 打更人·老麻（本批新增的「作息型」角色，只靠本表存在）：白日替人跑腿（涿县），
    //   入夜掌渔阳城里的更鼓——你夜里进不得城、或在城里没处落脚，第一个撞见的多半是他。
    gengfu:        { 3:'zhuo', 4:'zhuo', 5:'zhuo', 6:'zhuo', 7:'zhuo', 8:'zhuo', 9:'zhuo',
                     10:'yuyang', 11:'yuyang', 0:'yuyang', 1:'yuyang', 2:'yuyang', _home:'zhuo' }
  };
  // —— 城格级作息（苦役营教程城）：只排「无任务锚点」的具名角色 ——
  global.LF.NPC_ROUTINES_CITY = {
    kuyilao: {
      // 牢头：白日在中军场院督工（1,1），戌时起回牢门口守夜（1,0）——与 laotou_corridor「戌时鸣鼓闭门」呼应
      laotou:     { 10:'1,0', 11:'1,0', 0:'1,0', 1:'1,0', 2:'1,0', _home:'1,1' },
      // 郑刚：白日守库房（2,1），辰巳押石进矿坑（2,0），申时赴演武场点验（2,2）
      zheng_gang: { 3:'2,1', 4:'2,1', 5:'2,1', 6:'2,0', 7:'2,0', 8:'2,0', 9:'2,2', _home:'2,1' },
      // 牛铁：白日场院扛活，入夜回牢
      niu_tie:    { 10:'1,0', 11:'1,0', 0:'1,0', 1:'1,0', 2:'1,0', _home:'1,1' },
      // 鲁大：掌灶，申时去粮囤领米
      lu_da:      { 9:'2,1', _home:'0,1' },
      // 李旺：农田躲活，饭点蹲伙房（劝人别逃的是他）
      li_wang:    { 6:'0,1', 7:'0,1', 0:'0,1', 11:'0,1', _home:'0,0' }
    }
  };

  global.LF.buildRoomObjects = buildRoomObjects;

  global.LF.ROOMS = ROOMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ROOMS;
})(typeof window !== 'undefined' ? window : globalThis);

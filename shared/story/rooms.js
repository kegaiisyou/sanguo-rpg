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
        'qin_jiuxiao'
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
      actions: []
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
      find: '仓库堆镐锄绳索竹木；陈简校字，吴算盘打算盘。〔西〕回犬舍（西）；〔北〕矿坑（北）。此处竹木可取。',
      npcs: [ 'chen_jian', 'wu_suan', 'zheng_gang' ],
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
        '南': 'camp_wall',
        '北': 'ji_heishan_zhai'
      },
      find: '野径蜿蜒，北望林木幽深，山寨旗影隐约；南回塌墙根。〔南〕回苦役营（南）；〔北〕黑山寨（北）。',
      npcs: [
        'liehu',
        'wuliu',
        'mu_changfeng'
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
      ]
    };
  }
  global.LF.buildRoomObjects = buildRoomObjects;

  global.LF.ROOMS = ROOMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ROOMS;
})(typeof window !== 'undefined' ? window : globalThis);

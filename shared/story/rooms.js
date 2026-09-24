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

  // ═══ 锚点 · 苦役营·六间子牢房（囚室格 (1,0) 即城格，六间子房走面板 doors → CELL_INTERIORS，v20260910q）═══
    camp_tz1: { id: 'camp_tz1', name: '天字一号牢房',
      desc: ['栅内草荐发硬，墙角水渍蜿蜒。一名蓬头囚徒盘腿而坐，似在打盹，又似在听墙外的风。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '天字一号牢房：蓬头囚徒盘腿而坐，似醒似睡。〔南〕回牢房。',
      // v20260912g：牢头归位到「牢房走廊」（囚室格 1,0，见 data/npc_cards.js 的 cell/routine）——
      //   他本就在栅外当值，不该出现在这间子牢房里；此处只留真正同处一室的周听涛。
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
      find: '地字一号牢房：苦役挤作一团，面有菜色。靠栅那个却坐得笔直，脊梁挺得像杆枪。〔南〕回牢房。',
      npcs: [ 'cui_jiu' ], items: [], actions: [] },
    camp_dz2: { id: 'camp_dz2', name: '地字二号牢房',
      desc: ['一名囚徒正就着冷水啃硬饼，见你望来，把饼往身后藏了藏。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '地字二号牢房：瘦囚啃硬饼，见你望来把饼往身后藏——那眼神不是防你，是怕你抢。〔南〕回牢房。',
      npcs: [ 'a_he' ], items: [], actions: [] },
    camp_dz3: { id: 'camp_dz3', name: '地字三号牢房',
      desc: ['栅角堆着几件破烂家什，一名老囚正用木条编着什么。'],
      exits: { '南': '__cell__:kuyilao:1:0' },
      find: '地字三号牢房：老囚手指翻飞，木条草茎在他手里自己就长成了器物。〔南〕回牢房。',
      npcs: [ 'xi_weng' ], items: [], actions: [] },
  // ═══ 锚点 · 苦役营（其余 8 间 · v20260902a 补全） ═══
    camp_kennel: {
      id: 'camp_kennel',
      name: '苦役营·犬舍',
      desc: [
        '犬舍腥臊扑鼻，几条恶犬被铁链拴着，见了生人便呲牙低吼。犬卒冯二懒洋洋地靠墙打盹，马彪则怕狗似的远远站着。',
        '犬舍后门直通营外小径——若犬卒肯睁只眼闭只眼，这条道最是省心。'
      ],
      exits: {
        // v20260915e：旧营区房间（camp_farm / camp_warehouse）随苦役营改城格后已成孤岛，
        //   这间犬舍因此无路可通、成了死内容。改回演武场格（子房协议一律冒号分隔）。
        '南': '__cell__:kuyilao:2:2'
      },
      find: '犬舍腥臊，恶犬拴铁链；冯二打盹，马彪怕狗。〔南〕回演武场。犬舍后门通营外。',
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
    liupan:        { 3:'yuyang', 4:'yuyang', 5:'yuyang', 6:'jicheng', 7:'jicheng', 8:'jicheng', 9:'zhuo',
                     10:'zhuo', 11:'zhuo', 0:'zhuo', 1:'zhuo', 2:'zhuo', _home:'yuyang' },
    // 打更人·老麻（本批新增的「作息型」角色，只靠本表存在）：白日替人跑腿（涿县），
    //   入夜掌渔阳城里的更鼓——你夜里进不得城、或在城里没处落脚，第一个撞见的多半是他。
    gengfu:        { 3:'zhuo', 4:'zhuo', 5:'zhuo', 6:'zhuo', 7:'zhuo', 8:'zhuo', 9:'zhuo',
                     10:'yuyang', 11:'yuyang', 0:'yuyang', 1:'yuyang', 2:'yuyang', _home:'zhuo' }
  };
  // —— 城格级作息（苦役营教程城）：v20260912f 起改由 LF.NPC_NAMED 的卡派生 ——
  // 以往这张表和 core/city.js 的登记格分头维护（同一个人要在两处对齐，最易出错、也最像「两套系统」）；
  // 现在作息就写在 data/npc_cards.js 的卡里（routine 字段），这里只做归并。
  global.LF.NPC_ROUTINES_CITY = (function () {
    var out = {}, named = ((global.LF && global.LF.NPC_NAMED) || []);
    for (var i = 0; i < named.length; i++) {
      var c = named[i]; if (!c || !c.routine || !c.city) continue;
      if (!out[c.city]) out[c.city] = {};
      out[c.city][c.id] = c.routine;
    }
    return out;
  })();

  global.LF.buildRoomObjects = buildRoomObjects;

  global.LF.ROOMS = ROOMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ROOMS;
})(typeof window !== 'undefined' ? window : globalThis);

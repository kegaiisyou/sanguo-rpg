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
        '北': 'camp_wall'
      },
      find: '劳役场黄土夯实，囚徒扛石运土。〔西〕囚室（西）；〔北〕塌墙根（北）；林木幽深处似有去路。',
      npcs: [
        'zhou_tingtao',
        'hu_shi'
      ],
      items: [],
      actions: [
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
        'moshu'
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
      npcs: [],
      find: '箱笼中多是劫来的金帛与兵甲；墙角俘丁目光恳切，似在盼你施救。',
      items: [],
      actions: []
    },

  // ═══ 锚点 · 建造测试（保留手写） ═══
    build_test: {
      id: 'build_test',
      name: '建造系统测试',
      desc: [
        '林间一片空地，阳光自枝叶罅隙漏下。地当央立着一座粗木搭就的木工台，台面刨痕累累。',
        '台旁一棵老树粗壮挺拔，墙角还堆着些杂役用的家伙什。此地似是专供试手「建造系统」之所。'
      ],
      exits: {
        '北': 'city',
        '东': 'combat_test'
      },
      find: '空地中央一座木工台，旁有老树与一堆积役工具——显然是试手建造的去处。',
      npcs: [],
      items: [],
      actions: []
    },

  // ═══ 锚点 · 演武场（战斗系统测试，置于建造场隔壁） ═══
    combat_test: {
      id: 'combat_test',
      name: '演武场·试炼坪',
      desc: [
        '建造场东侧辟出一片空坪，木桩、草人列于四隅。坪心立着一块试炼碑，碑侧按修为高下分列数名「陪练」——皆为符术所化，伤而不死，专供试招。',
        '此处不耗气力、不损声名，正宜将各路敌手的拳脚、招式、五行逐一试过，摸清自家斤两，再去闯那真刀真枪的江湖。'
      ],
      exits: {
        '西': 'build_test',
        '北': 'city'
      },
      find: '空坪木桩草人列于四隅，坪心试炼碑按修为分列数名陪练。〔西〕回建造场（西）；〔北〕返颍川（北）。',
      npcs: [],
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
      npcs: [],
      items: [],
      actions: []
    }
  };

  // ── 手写锚点房的「可交互物件」（工厂：引擎就绪后由 index.html 实例化）──
  function buildRoomObjects(){
    function treeActs(){
      var hasAxe = !!packFind('tiefu') || !!packFind('futou');
      return [{label: hasAxe ? '挥斧伐木' : '徒手折枝', icon:'🌳', fn:function(){ chopTree(); }}];
    }
    function benchActs(){
      var acts=[];
      if(!(state.flags && state.flags.buildTestSearched)){
        acts.push({label:'翻找工作台', icon:'🔍', fn:function(){ searchBench(); }});
      }
      acts.push({label:'制作…', icon:'🔨', fn:function(){ openModal('craft', {bench:'bench'}); }});
      return acts;
    }
    function build_quarry_actions(){
      return [{label:'采石料', icon:'⛏️', fn:function(){ mineStone(); }}];
    }
    function build_crate_actions(){
      var got = state.flags && state.flags.buildCrateGot;
      if(got) return [{label:'木箱已空', icon:'📭', fn:function(){ toast('木箱已然空了。'); }}];
      return [{label:'翻找木箱', icon:'🔍', fn:function(){ openBuildCrate(); }}];
    }
    return {
      build_test:[
        {type:'feature', key:'tree',     icon:'🌳', name:'一棵老树', desc:'粗壮老树，枝干坚实，正堪伐取',   actions:treeActs},
        {type:'feature', key:'bench',    icon:'🔨', name:'木工台',   desc:'粗木搭就的工作台，可将木头加工成木材', actions:benchActs},
        {type:'feature', key:'toolpile', icon:'🪓', name:'工具堆',   desc:'墙角堆着些杂役用的家伙什',       actions:[{label:'拾取斧头', icon:'🪓', fn:function(){ pickupAxe(); }}]},
        {type:'npc', key:'pedlar', icon:'🧺', name:'货郎', desc:'挑担行商，收售木料与器具', actions:[{label:'与他交易', icon:'💰', fn:function(){ openModal('shop', {shop:'build_pedlar'}); }}]},
        {type:'npc', key:'liupan', icon:'🗡️', name:'游侠·刘磐', desc:'背负环首刀，抱拳而立', actions:[
          {label:'邀请入队', icon:'🤝', fn:function(){ recruitCompanion('liupan'); }}
        ]},
        {type:'feature', key:'env',      icon:'🔍', name:'四周环境', desc:'环顾这片空地',                   actions:[{label:'环顾四周', fn:function(){ renderRoom(state.room, true); }}]},
        {type:'feature', key:'quarry',     icon:'🪨', name:'采石崖',   desc:'崖壁裸露青石，敲击可采下石料',     actions: build_quarry_actions},
        {type:'feature', key:'crate',    icon:'📦', name:'残破木箱', desc:'半埋草垛里的旧木箱，似有人遗落了图纸', actions: build_crate_actions},
        {type:'exit',  dir:'北',     icon:'🚪', name:'北·颍川',desc:'返回颍川',                           actions:[{label:'返回颍川', fn:function(){ move('北','city'); }}]},
        {type:'exit',  dir:'东',     icon:'🏯', name:'东·演武场',desc:'试炼坪，可测试战斗系统',             actions:[{label:'前往演武场', fn:function(){ move('东','combat_test'); }}]}
      ],

      // ═══ 战斗系统测试：演武场（建造场隔壁） ═══
      combat_test:[
        {type:'feature', key:'newbie', icon:'🪵', name:'新手试炼桩', desc:'木人桩与几只极易对付的活靶，供熟悉基础攻防', actions:[
          {label:'木人桩（无伤·测UI）', icon:'🥊', fn:function(){ startCombat('dummy'); }},
          {label:'野犬（hp50·无）', icon:'🐕', fn:function(){ startCombat('stray_dog'); }},
          {label:'饥饿流民（hp80·无）', icon:'🧎', fn:function(){ startCombat('hungry_refugee'); }},
          {label:'落单溃兵（hp130·金）', icon:'🪖', fn:function(){ startCombat('deserter'); }}
        ]},
        {type:'feature', key:'mid', icon:'⚔️', name:'寻常试炼', desc:'山野间常见的匪类，正经练手', actions:[
          {label:'山贼（hp300·土）', icon:'🪓', fn:function(){ startCombat('bandit'); }},
          {label:'黑山寨卒（hp360·金）', icon:'🔪', fn:function(){ startCombat('heishan_zei'); }},
          {label:'流寇头目（hp600·土）', icon:'👹', fn:function(){ startCombat('bandit_chief'); }}
        ]},
        {type:'feature', key:'elite', icon:'🔥', name:'精锐试炼', desc:'久历战阵的劲敌，招式带异常', actions:[
          {label:'乌桓斥候（hp240·金）', icon:'🏹', fn:function(){ startCombat('wuhuan_scout'); }},
          {label:'太平力士（hp800·土·符术）', icon:'🟡', fn:function(){ startCombat('yellow_turban'); }},
          {label:'黑山寨主·张燕（hp1000·金·Boss）', icon:'😈', fn:function(){ startCombat('heishan_zhu'); }}
        ]},
        {type:'feature', key:'boss', icon:'👑', name:'宿敌试炼', desc:'一方豪强的压阵之将，全力一战', actions:[
          {label:'华雄（hp1200·金·Boss）', icon:'🐅', fn:function(){ startCombat('hua_xiong'); }}
        ]},
        {type:'feature', key:'beast_low', icon:'🐺', name:'寻常野兽', desc:'林原间的走兽飞禽，宜试手身法', actions:[
          {label:'野犬（hp50·无）', icon:'🐕', fn:function(){ startCombat('stray_dog'); }},
          {label:'野狼（hp150·金）', icon:'🐺', fn:function(){ startCombat('wild_wolf'); }},
          {label:'野猪（hp240·土·冲撞晕）', icon:'🐗', fn:function(){ startCombat('wild_boar'); }},
          {label:'蝮蛇（hp90·木·毒）', icon:'🐍', fn:function(){ startCombat('venom_snake'); }}
        ]},
        {type:'feature', key:'beast_high', icon:'🐯', name:'凶兽', desc:'深山旷野的猛兽，招式带异常', actions:[
          {label:'黑熊（hp520·土）', icon:'🐻', fn:function(){ startCombat('black_bear'); }},
          {label:'苍鹰（hp200·金·极速）', icon:'🦅', fn:function(){ startCombat('goshawk'); }},
          {label:'巨蟒（hp460·木·绞缠毒）', icon:'🐲', fn:function(){ startCombat('python'); }},
          {label:'雪狼（hp340·金·北境）', icon:'🐺', fn:function(){ startCombat('snow_wolf'); }},
          {label:'疯牛（hp280·土·冲撞晕）', icon:'🐂', fn:function(){ startCombat('mad_bull'); }},
          {label:'群狼（hp300·金·连击）', icon:'🐺', fn:function(){ startCombat('wolf_pack'); }},
          {label:'猛虎（hp720·金·兽王级）', icon:'🐯', fn:function(){ startCombat('tiger'); }}
        ]},
        {type:'feature', key:'env', icon:'🔍', name:'四周环境', desc:'环顾试炼坪', acts:[{label:'环顾四周', fn:function(){ renderRoom(state.room, true); }}]},
        {type:'exit', dir:'西', icon:'🚪', name:'西·建造场', desc:'返回建造系统测试场', actions:[{label:'返回建造场', fn:function(){ move('西','build_test'); }}]},
        {type:'exit', dir:'北', icon:'🏯', name:'北·颍川', desc:'返回颍川城', actions:[{label:'返回颍川', fn:function(){ move('北','city'); }}]}
      ],

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

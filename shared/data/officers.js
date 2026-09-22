// 乱世烽火 · 史实武将数据层（v20260921b）
// 在统一人物口径 LF.PERSONA 之上批量录入三国人物：五维 + 所属势力 + 驻城(home) + 初始忠诚。
// 由 LF.createOfficers 读取 LF.PERSONA.listRegistered() 完成「驻城→武将」「势力→武将」建索引与玩法接入。
//   · faction 为 '在野' 者可在城中「寻访」登庸；其余随所属城池存在，克城时或被俘。
//   · home 必须是 LF.CITIES 中存在的 cid（校验见 test/cross_reference_check.js 的「武将引用」规则）。
(function (global) {
  if (!global.LF || !LF.PERSONA) { console.error('[officers] 需先加载 personas.js'); return; }
  var R = [
    // ═══ 董卓 ═══
    { id:'dong_zhuo', name:'董卓', title:'太师', faction:'dongzhuo', home:'luoyang', loyalty:70,
      stats:{ wu:70, zhi:55, tong:75, zheng:40, mei:30 }, tags:['凶暴','权臣'], bio:'西凉豪帅，挟帝据京，焚雒阳、施暴政。' },
    { id:'lv_bu', name:'吕布', title:'温侯', faction:'dongzhuo', home:'luoyang', loyalty:55,
      stats:{ wu:99, zhi:35, tong:97, zheng:10, mei:50 }, tags:['骁勇','反复'], bio:'飞将无双，弓马绝伦，然轻于去就。' },
    { id:'li_ru', name:'李儒', title:'谋士', faction:'dongzhuo', home:'luoyang', loyalty:75,
      stats:{ wu:30, zhi:85, tong:40, zheng:55, mei:45 }, tags:['毒计'], bio:'董卓女婿，多谋而酷烈。' },
    { id:'hua_xiong', name:'华雄', title:'骁将', faction:'dongzhuo', home:'luoyang', loyalty:70,
      stats:{ wu:92, zhi:45, tong:78, zheng:30, mei:55 }, tags:['猛将'], bio:'董卓帐下骁将，汜水关前连斩数将。' },
    { id:'guo_si', name:'郭汜', title:'中郎将', faction:'dongzhuo', home:'luoyang', loyalty:65,
      stats:{ wu:80, zhi:45, tong:72, zheng:30, mei:35 }, tags:['武将'], bio:'与李傕同为凉州宿将。' },
    { id:'li_jue', name:'李傕', title:'车骑将军', faction:'dongzhuo', home:'luoyang', loyalty:65,
      stats:{ wu:82, zhi:50, tong:78, zheng:35, mei:35 }, tags:['武将'], bio:'董卓死后率凉州兵入长安。' },

    // ═══ 曹操 ═══
    { id:'cao_cao', name:'曹操', title:'兖州牧', faction:'caocao', home:'xuchang', loyalty:90,
      stats:{ wu:72, zhi:91, tong:92, zheng:88, mei:85 }, tags:['奸雄','通才'], bio:'挟天子以令诸侯，唯才是举，雄略过人。' },
    { id:'xun_yu', name:'荀彧', title:'尚书令', faction:'caocao', home:'xuchang', loyalty:90,
      stats:{ wu:25, zhi:96, tong:55, zheng:90, mei:80 }, tags:['王佐'], bio:'曹操首席谋主，居中持重，筹画万机。' },
    { id:'guo_jia', name:'郭嘉', title:'军祭酒', faction:'caocao', home:'xuchang', loyalty:88,
      stats:{ wu:20, zhi:95, tong:50, zheng:40, mei:75 }, tags:['奇谋'], bio:'鬼才，料事如神，惜乎早夭。' },
    { id:'dian_wei', name:'典韦', title:'都尉', faction:'caocao', home:'xuchang', loyalty:92,
      stats:{ wu:96, zhi:45, tong:88, zheng:20, mei:40 }, tags:['虎卫'], bio:'力能扛鼎，常宿卫操侧，宛城殉主。' },
    { id:'xu_chu', name:'许褚', title:'校尉', faction:'caocao', home:'xuchang', loyalty:90,
      stats:{ wu:97, zhi:30, tong:90, zheng:15, mei:35 }, tags:['虎痴'], bio:'容貌雄毅，号虎痴，操之贴身樊哙。' },
    { id:'xiahou_dun', name:'夏侯惇', title:'将军', faction:'caocao', home:'xiapi', loyalty:92,
      stats:{ wu:90, zhi:60, tong:85, zheng:50, mei:60 }, tags:['宗亲','刚烈'], bio:'拔矢啖睛，骁勇绝伦，治军严整。' },
    { id:'zhang_liao', name:'张辽', title:'中郎将', faction:'caocao', home:'xiapi', loyalty:80,
      stats:{ wu:93, zhi:75, tong:94, zheng:60, mei:70 }, tags:['良将'], bio:'威震逍遥津，止啼小儿，古今罕俦。' },
    { id:'cao_ren', name:'曹仁', title:'将军', faction:'caocao', home:'shouchun', loyalty:90,
      stats:{ wu:88, zhi:70, tong:90, zheng:65, mei:55 }, tags:['宗亲','善守'], bio:'勇毅绝人，江陵、襄樊皆以孤城拒敌。' },

    // ═══ 孙策 ═══
    { id:'sun_ce', name:'孙策', title:'讨逆将军', faction:'sunce', home:'jianye', loyalty:90,
      stats:{ wu:94, zhi:65, tong:90, zheng:55, mei:88 }, tags:['小霸王'], bio:'江东猛虎，转斗千里，平定江东。' },
    { id:'zhou_yu', name:'周瑜', title:'中护军', faction:'sunce', home:'jianye', loyalty:92,
      stats:{ wu:70, zhi:96, tong:93, zheng:80, mei:95 }, tags:['美周郎','儒将'], bio:'风雅绝伦，赤壁一炬，天下三分。' },
    { id:'taishi_ci', name:'太史慈', title:'建昌都尉', faction:'sunce', home:'jianye', loyalty:88,
      stats:{ wu:93, zhi:65, tong:88, zheng:40, mei:70 }, tags:['信义'], bio:'弓马绝伦，信义著于州里。' },
    { id:'huang_gai', name:'黄盖', title:'偏将军', faction:'sunce', home:'jianye', loyalty:88,
      stats:{ wu:85, zhi:60, tong:82, zheng:55, mei:60 }, tags:['老将','苦肉'], bio:'赤壁献苦肉计，舟焚火攻，江东宿将。' },

    // ═══ 刘表 ═══
    { id:'liu_biao', name:'刘表', title:'荆州牧', faction:'liubiao', home:'xiangyang', loyalty:80,
      stats:{ wu:50, zhi:78, tong:55, zheng:85, mei:70 }, tags:['守成'], bio:'坐镇荆襄，带甲十万，然偏安无志。' },
    { id:'huang_zhong', name:'黄忠', title:'中郎将', faction:'liubiao', home:'xiangyang', loyalty:70,
      stats:{ wu:95, zhi:60, tong:90, zheng:45, mei:50 }, tags:['老当益壮'], bio:'定军山刃斩夏侯渊，勇毅冠三军。' },
    { id:'wei_yan', name:'魏延', title:'牙门将', faction:'liubiao', home:'xiangyang', loyalty:65,
      stats:{ wu:90, zhi:65, tong:88, zheng:50, mei:45 }, tags:['奇兵'], bio:'善养士卒，勇猛过人，后镇汉中。' },
    { id:'kuai_yue', name:'蒯越', title:'章陵太守', faction:'liubiao', home:'xiangyang', loyalty:78,
      stats:{ wu:30, zhi:90, tong:50, zheng:85, mei:60 }, tags:['谋士'], bio:'深晓谋略，佐表平宗贼、定荆楚。' },
    { id:'cai_mao', name:'蔡瑁', title:'水军都督', faction:'liubiao', home:'jiangling', loyalty:72,
      stats:{ wu:60, zhi:55, tong:65, zheng:60, mei:45 }, tags:['水军'], bio:'荆襄水师之主，楼船习流。' },

    // ═══ 刘璋 ═══
    { id:'liu_zhang', name:'刘璋', title:'益州牧', faction:'liuzhang', home:'chengdu', loyalty:75,
      stats:{ wu:35, zhi:55, tong:40, zheng:70, mei:65 }, tags:['暗弱'], bio:'暗弱守成，政令不出成都。' },
    { id:'fa_zheng', name:'法正', title:'军议校尉', faction:'liuzhang', home:'chengdu', loyalty:60,
      stats:{ wu:25, zhi:94, tong:55, zheng:80, mei:65 }, tags:['奇谋'], bio:'奇谋善断，定军山画策，蜀汉谋主。' },
    { id:'zhang_song', name:'张松', title:'别驾', faction:'liuzhang', home:'chengdu', loyalty:45,
      stats:{ wu:20, zhi:90, tong:35, zheng:70, mei:60 }, tags:['短小'], bio:'貌寝而有才，献图迎刘备。' },
    { id:'yan_yan', name:'严颜', title:'巴郡太守', faction:'liuzhang', home:'hanzhong', loyalty:78,
      stats:{ wu:88, zhi:65, tong:85, zheng:60, mei:55 }, tags:['老将'], bio:'巴郡宿将，宁死不降，后归先主。' },
    { id:'zhang_ren', name:'张任', title:'从事', faction:'liuzhang', home:'hanzhong', loyalty:80,
      stats:{ wu:86, zhi:80, tong:88, zheng:55, mei:45 }, tags:['忠勇'], bio:'矢志忠勇，射杀庞统于落凤坡。' },

    // ═══ 公孙度 ═══
    { id:'gongsun_du', name:'公孙度', title:'辽东太守', faction:'gongsun', home:'xiangping', loyalty:82,
      stats:{ wu:60, zhi:70, tong:65, zheng:75, mei:55 }, tags:['雄踞'], bio:'自号平州牧，威行海外，雄踞辽东。' },
    { id:'gongsun_gong', name:'公孙恭', title:'辽东太守', faction:'gongsun', home:'xiangping', loyalty:78,
      stats:{ wu:55, zhi:60, tong:58, zheng:65, mei:50 }, tags:['守成'], bio:'度之子，继镇辽东。' },

    // ═══ 马腾 ═══
    { id:'ma_teng', name:'马腾', title:'征西将军', faction:'matang', home:'wuwei', loyalty:80,
      stats:{ wu:85, zhi:55, tong:82, zheng:50, mei:70 }, tags:['羌汉'], bio:'凉州骁锐，与韩遂共据西陲。' },
    { id:'ma_chao', name:'马超', title:'偏将军', faction:'matang', home:'jinyang', loyalty:75,
      stats:{ wu:97, zhi:45, tong:93, zheng:20, mei:75 }, tags:['锦马超'], bio:'狮盔兽带，渭水六战，号神威天将军。' },
    { id:'ma_dai', name:'马岱', title:'司马', faction:'matang', home:'wuwei', loyalty:78,
      stats:{ wu:85, zhi:55, tong:80, zheng:45, mei:45 }, tags:['骁将'], bio:'腾之从子，常随超左右。' },
    { id:'han_sui', name:'韩遂', title:'镇西将军', faction:'matang', home:'jinyang', loyalty:70,
      stats:{ wu:78, zhi:70, tong:75, zheng:60, mei:65 }, tags:['老辣'], bio:'凉州老帅，与马腾结为兄弟，共抗关东。' },

    // ═══ 袁绍 ═══
    { id:'yuan_shao', name:'袁绍', title:'冀州牧', faction:'yuanshao', home:'yecheng', loyalty:85,
      stats:{ wu:55, zhi:80, tong:75, zheng:78, mei:80 }, tags:['四世三公'], bio:'地广兵强，雄踞河北，然迟疑少断。' },
    { id:'tian_feng', name:'田丰', title:'别驾', faction:'yuanshao', home:'yecheng', loyalty:80,
      stats:{ wu:25, zhi:95, tong:50, zheng:80, mei:60 }, tags:['刚直'], bio:'谋略深远，屡谏不从，竟见杀。' },
    { id:'ju_shou', name:'沮授', title:'监军', faction:'yuanshao', home:'yecheng', loyalty:82,
      stats:{ wu:20, zhi:92, tong:48, zheng:78, mei:55 }, tags:['远略'], bio:'统御之才，献挟天子、据河北之策。' },
    { id:'yan_liang', name:'颜良', title:'骁将', faction:'yuanshao', home:'yecheng', loyalty:78,
      stats:{ wu:94, zhi:35, tong:88, zheng:20, mei:35 }, tags:['勇冠'], bio:'河北猛将，白马为关羽所斩。' },
    { id:'wen_chou', name:'文丑', title:'骁将', faction:'yuanshao', home:'yecheng', loyalty:78,
      stats:{ wu:93, zhi:35, tong:87, zheng:20, mei:35 }, tags:['勇冠'], bio:'与颜良齐名，延津败殁。' },

    // ═══ 汉室 ═══
    { id:'huangfu_song', name:'皇甫嵩', title:'车骑将军', faction:'han', home:'luoyang', loyalty:85,
      stats:{ wu:80, zhi:88, tong:90, zheng:70, mei:60 }, tags:['名将'], bio:'平定黄巾之首功，用兵持重。' },
    { id:'zhu_jun', name:'朱儁', title:'右车骑将军', faction:'han', home:'luoyang', loyalty:83,
      stats:{ wu:78, zhi:80, tong:82, zheng:65, mei:55 }, tags:['名将'], bio:'与皇甫嵩并力剿黄巾。' },
    { id:'lu_zhi', name:'卢植', title:'北中郎将', faction:'han', home:'luoyang', loyalty:84,
      stats:{ wu:60, zhi:90, tong:70, zheng:80, mei:70 }, tags:['大儒'], bio:'通古今学，刘备、公孙瓒之师。' },

    // ═══ 在野（可寻访登庸）═══
    { id:'liu_bei', name:'刘备', title:'汉室宗亲', faction:'在野', home:'zhuo', loyalty:50,
      stats:{ wu:70, zhi:75, tong:80, zheng:85, mei:98 }, tags:['仁德','汉胄'], bio:'织席贩履，然弘毅宽厚，深得人心。' },
    { id:'guan_yu', name:'关羽', title:'别部司马', faction:'在野', home:'zhuo', loyalty:55,
      stats:{ wu:97, zhi:75, tong:95, zheng:70, mei:85 }, tags:['武圣','傲上'], bio:'髯长二尺，勇冠三军，千里独行。' },
    { id:'zhang_fei', name:'张飞', title:'别部司马', faction:'在野', home:'zhuo', loyalty:55,
      stats:{ wu:98, zhi:50, tong:92, zheng:40, mei:55 }, tags:['猛张飞','暴而无恩'], bio:'喝断当阳桥，义释严颜，万人之敌。' },
    { id:'zhao_yun', name:'赵云', title:'从骑', faction:'在野', home:'beiping', loyalty:50,
      stats:{ wu:96, zhi:72, tong:94, zheng:55, mei:85 }, tags:['常山赵子龙'], bio:'一身是胆，长坂坡七进七出。' },
    { id:'zhuge_liang', name:'诸葛亮', title:'卧龙', faction:'在野', home:'xiangyang', loyalty:40,
      stats:{ wu:40, zhi:100, tong:60, zheng:92, mei:95 }, tags:['卧龙','奇才'], bio:'隆中高卧，未出茅庐已知三分天下。' },
    { id:'xu_shu', name:'徐庶', title:'谋士', faction:'在野', home:'xiangyang', loyalty:45,
      stats:{ wu:50, zhi:90, tong:55, zheng:70, mei:75 }, tags:['孝义'], bio:'走马荐诸葛，身在曹营心在汉。' },
    { id:'pang_tong', name:'庞统', title:'凤雏', faction:'在野', home:'jiangling', loyalty:42,
      stats:{ wu:35, zhi:98, tong:55, zheng:82, mei:85 }, tags:['凤雏'], bio:'与卧龙齐名，惜落凤坡中矢。' },
    { id:'jiang_wei', name:'姜维', title:'中郎', faction:'在野', home:'hanzhong', loyalty:45,
      stats:{ wu:90, zhi:88, tong:90, zheng:60, mei:70 }, tags:['天水麒麟'], bio:'幼麟，后继承武侯之志。' },
  ];
  // 去重（同名 id 仅保留首条）
  var seen = {}, clean = [];
  R.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; clean.push(c); } });
  var res = LF.PERSONA.register(clean);
  if (global.console && res.bad && res.bad.length) console.warn('[officers] 录入失败 ' + res.bad.length + ' 条：', res.bad);
  if (typeof module !== 'undefined' && module.exports) module.exports = res;
})(typeof window !== 'undefined' ? window : globalThis);

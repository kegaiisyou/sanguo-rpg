// 乱世烽火 · 全局常量（共享数据层）
// UMD：浏览器挂到 window.LF，Node/微信端走 module.exports
(function (global) {
  var CONSTANTS = {
    GAME_NAME: '乱世烽火',
    VERSION: '20260912e',
    MAX_LEVEL: 60
  };
  global.LF = global.LF || {};
  global.LF.CONSTANTS = CONSTANTS;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONSTANTS;

  // ── 身份 / 势力系统（v20260826g）──
  // 官职链：下标越大权柄越高；占城即得对应 tier 官职（取更高者）
  global.LF.TITLES = ['游侠', '县令', '太守', '州牧', '君主'];

  // 势力字典：NPC 势力 + 玩家势力（用于势力图展示；城市归属见 LF.CITY_OWNER）
  global.LF.FACTIONS = {
    han:      { name: '汉室',   color: '#7d6a2e', lord: '汉献帝', desc: '名存实亡的天子朝廷，权柄已落诸侯之手' },
    dongzhuo: { name: '董卓',   color: '#8a2f2f', lord: '董卓',   desc: '西凉铁骑，挟帝据京，凶焰熏天' },
    yuanshao: { name: '袁绍',   color: '#2f5f8a', lord: '袁绍',   desc: '四世三公，雄踞河北，带甲百万' },
    caocao:   { name: '曹操',   color: '#2f7a3f', lord: '曹操',   desc: '屯田积谷，挟天子以令诸侯，虎视中原' },
    sunce:    { name: '孙策',   color: '#8a5a2f', lord: '孙策',   desc: '江东猛虎，据有扬、会，渐成鼎足' },
    liubiao:  { name: '刘表',   color: '#6f6f2f', lord: '刘表',   desc: '坐镇江夏，带甲十万，守成之主' },
    liuzhang: { name: '刘璋',   color: '#5f2f8a', lord: '刘璋',   desc: '暗弱守成，益州殷实而政令不出' },
    gongsun:  { name: '公孙度', color: '#2f8a8a', lord: '公孙度', desc: '远踞辽东，白山黑水之雄' },
    matang:   { name: '马腾',   color: '#8a2f6f', lord: '马腾',   desc: '羌汉杂处，凉州骁锐，西陲屏藩' },
    player:   { name: '义军',   color: '#3a3a3a', lord: '（你）', desc: '乱世之中，你拉起的一杆义旗' }
  };

  // 城市初始归属（cid → 势力 id；键须与 LF.CITIES 一致）；未列出者归入 'han'
  // v20260909n：剔除 8 个不在 CITIES 的旧地图残留 id（ji_guomen/yuyang_guomen/city/ye/changyi/linzi/fanyu/chang_an）
  global.LF.CITY_OWNER = {
    luoyang: 'dongzhuo', xiapi: 'caocao', xiangyang: 'liubiao', shouchun: 'caocao',
    chengdu: 'liuzhang', wuwei: 'matang', jinyang: 'matang', jianye: 'sunce',
    hanzhong: 'liuzhang', jiangling: 'liubiao', xiangping: 'gongsun', xuchang: 'han'
  };

  // ── 归属键归一表（v20260912b）────────────────────────────────────────
  // 为什么需要：cities.js 的 `owner` 字段是**早期以三国版图命名**的遗留键
  //   （wei / shu / wu / contested，共 71 城），而 LF.FACTIONS 用的是**当世势力**键
  //   （han / dongzhuo / caocao / …）。两者字典不同 → 展示层查不到势力名与配色，
  //   会直接把英文键当名字显示（旧版山河志「势力」层 59 城踩这个坑）。
  // 这里做**单点归一**：任何读取城市归属的地方（山河志分层、势力图、城内叙事）
  //   都先过 OWNER_ALIAS，即可拿到当世势力键；数据本身与玩法判定不受影响。
  //   键义（当世视角，见 GAME_DESIGN §1.1.2）：
  //     wei→han（河北/中原/关中各郡：朝廷任命的刺史太守，名义属汉）
  //     shu→liuzhang（益州诸郡）· wu→sunce（江东、交州诸郡）· contested→han（争夺之地）
  global.LF.OWNER_ALIAS = {
    '汉': 'han', '汉室': 'han', '朝廷': 'han', '无主': 'han', 'none': 'han',
    wei: 'han', shu: 'liuzhang', wu: 'sunce', contested: 'han', qunxiong: 'han'
  };

  // 城市归属读取器（唯一入口）：运行时归属（玩家占城等动态）> 初始归属表 > 城市数据 > 汉室
  //   传入 getLive（可选）用于注入引擎的运行时归属查询（engine 的 cityOwnerOf）。
  global.LF.ownerKeyOf = function (cid, getLive) {
    var live = null;
    try { live = getLive ? getLive(cid) : null; } catch (e) { live = null; }
    var raw = live
      || global.LF.CITY_OWNER[cid]
      || (global.LF.CITIES && global.LF.CITIES[cid] && global.LF.CITIES[cid].owner)
      || 'han';
    return global.LF.OWNER_ALIAS[raw] || raw;
  };

  // ── 城市沿革表（v20260912b，史料化注记）──────────────────────────────
  // 每个城市的**显示名**取「游戏锚点年代（光和六年，183）当时人的叫法」；
  // 后世才出现的专名一律不用，改记在这里，供 tooltip / 文档 / 将来「史书模式」复用。
  //   later：后世（常被玩家认得的）叫法；note：沿革说明；era：改名年代或人物。
  // 规则见 GAME_DESIGN §1.1.2「时代语汇规范」；「郡名作城名」者也在此交代治所，便于对照。
  global.LF.CITY_HIST = {
    jianye:   { later: '建业', era: '229 孙权', note: '孙权 229 年自京口徙治秣陵并改名建业；光和年间为扬州丹阳郡秣陵县' },
    xuchang:  { later: '许昌/许都', era: '196 曹操', note: '曹操 196 年迎帝都许，改许县为许都（后称许昌）；光和年间为豫州颍川郡许县' },
    yongan:   { later: '永安/白帝城', era: '222 刘备', note: '刘备 222 年改鱼复为永安并筑城（白帝城之名亦起于此时）；汉为益州巴东郡鱼复县' },
    qiaojun:  { later: '谯郡', era: '曹魏', note: '谯郡为曹魏析沛国所置；汉为豫州沛国谯县（曹操籍贯仍属实）' },
    jianan:   { later: '建安郡', era: '260 孙吴', note: '建安郡为孙吴 260 年析会稽所置；汉为扬州会稽郡东冶（冶县）' },
    jianning: { later: '建宁郡', era: '225 诸葛亮', note: '建宁郡为诸葛亮南征后改益州郡而来；汉为益州郡治滇池县' },
    nanhai:   { later: '广州/南海', era: '孙吴', note: '「广州」为孙吴所置州名；汉为交州南海郡番禺县（交州州治）' },
    changli:  { later: '昌黎郡', era: '十六国', note: '昌黎郡迟至十六国始置；汉为幽州辽西郡柳城，塞外要冲' },
    beiping:  { later: '北平', era: '—', note: '汉无北平城；东汉右北平郡治土垠县（北平为后世府名）' },
    luoyang:  { later: '洛阳', era: '—', note: '东汉都雒阳（洛、雒两字汉时并书，曹魏后通用「洛」）；本作取通行字「洛阳」' },
    wujun:    { later: '吴郡', era: '—', note: '吴郡为郡名，治吴县；本作以郡名为城名，便于玩家识别' },
    kuaiji:   { later: '会稽', era: '—', note: '会稽郡治山阴县；本作以郡名为城名' },
    yuzhang:  { later: '豫章', era: '—', note: '豫章郡治南昌县（「南昌」汉时已有）' },
    wuling:   { later: '武陵', era: '—', note: '武陵郡治临沅县；本作以郡名为城名' },
    changsha: { later: '长沙', era: '—', note: '长沙郡治临湘县；本作以郡名为城名' },
    guiyang:  { later: '桂阳', era: '—', note: '桂阳郡治郴县；本作以郡名为城名' },
    lingling: { later: '零陵', era: '—', note: '零陵郡治泉陵县；本作以郡名为城名' },
    hanzhong: { later: '汉中', era: '—', note: '汉中郡治南郑县；本作以郡名为城名' },
    hanei:    { later: '河内', era: '—', note: '河内郡治怀县；本作以郡名为城名' },
    runan:    { later: '汝南', era: '—', note: '汝南郡治平舆县；本作以郡名为城名' },
    langya:   { later: '琅琊', era: '—', note: '琅琊国（琅邪）治开阳县；本作以国名为城名' },
    beihai:   { later: '北海', era: '—', note: '北海国（光武建武中置）治营陵县；本作以国名为城名。孔融任北海相在 190 年之后，非开局' },
    xiaopei:  { later: '小沛', era: '东汉末', note: '小沛即沛县之别称（以别于沛国治相县），汉末已有此呼' }
  };
})(typeof window !== 'undefined' ? window : globalThis);

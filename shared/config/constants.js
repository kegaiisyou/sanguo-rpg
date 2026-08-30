// 乱世烽火 · 全局常量（共享数据层）
// UMD：浏览器挂到 window.LF，Node/微信端走 module.exports
(function (global) {
  var CONSTANTS = {
    GAME_NAME: '乱世烽火',
    VERSION: '20260830k',
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

  // 城市初始归属（cid → 势力 id）；未列出者归入 'han'
  global.LF.CITY_OWNER = {
    ji_guomen: 'yuanshao', yuyang_guomen: 'yuanshao', luoyang: 'dongzhuo', city: 'caocao',
    ye: 'yuanshao', changyi: 'caocao', xiapi: 'caocao', linzi: 'yuanshao',
    xiangyang: 'liubiao', shouchun: 'caocao', chengdu: 'liuzhang', wuwei: 'matang',
    jinyang: 'matang', fanyu: 'han', chang_an: 'dongzhuo', jianye: 'sunce',
    hanzhong: 'liuzhang', jiangling: 'liubiao', xiangping: 'gongsun', xuchang: 'han'
  };
})(typeof window !== 'undefined' ? window : globalThis);

// ==================== 乱世烽火 - 游戏数据 ====================
// 所有地图、道具、NPC、敌人、任务数据

var TILE = 40;
var MAP_W = 20, MAP_H = 14;

// 瓦片样式
var tileStyle = {
  G: { color: '#4a7c2e', name: '荒地' },
  F: { color: '#2d6b1e', name: '密林' },
  P: { color: '#c4a46c', name: '驿道' },
  W: { color: '#4e2218', name: '山崖' },
  H: { color: '#7b6b5a', name: '民居' },
  V: { color: '#5d4037', name: '山洞' },
  D: { color: '#5c1515', name: '西凉大营' },
  S: { color: '#c06014', name: '集市' },
  A: { color: '#b8860b', name: '练兵场' },
  C: { color: '#3a4a58', name: '河流' },
  B: { color: '#6b5a4a', name: '木桥' },
  T: { color: '#5d5550', name: '道观' },
  R: { color: '#c4a35a', name: '沙地' }
};

// ==================== 道具数据库 ====================
var ITEM_DB = {
  potion:      { id: 'potion',      name: '行军散',  desc: '恢复35点气血',          type: 'heal', icon: '💊', price: 10, rarity: 1, effect: { hp: 35 } },
  superPotion: { id: 'superPotion', name: '五石散',  desc: '恢复全部气血',          type: 'heal', icon: '🧪', price: 50, rarity: 2, effect: { hp: 'full' } },
  atkElixir:   { id: 'atkElixir',   name: '温侯酒',  desc: '临时攻击+15（5回合）',  type: 'buff', icon: '💪', price: 30, rarity: 1, effect: { atk: 15, dur: 5 } },
  defElixir:   { id: 'defElixir',   name: '藤甲符',  desc: '临时防御+10（5回合）',  type: 'buff', icon: '🛡️', price: 30, rarity: 1, effect: { def: 10, dur: 5 } },
  goldBag:     { id: 'goldBag',     name: '五铢钱袋', desc: '获得50枚五铢钱',        type: 'gold', icon: '💰', price: 0,  rarity: 1, effect: { gold: 50 } },
  mpElixir:    { id: 'mpElixir',    name: '回气散',   desc: '恢复20点内力',          type: 'mp',   icon: '💠', price: 25, rarity: 1, effect: { mp: 20 } }
};

// ==================== 所有地图 ====================
var allMaps = {
  main: {
    name: '颍川',
    data: [
      ['W','W','W','W','W','W','W','G','G','G','G','G','G','W','W','W','W','W','W','W'],
      ['W','W','G','G','G','F','G','G','G','G','F','F','G','G','W','G','G','G','F','W'],
      ['W','G','C','C','P','B','P','P','P','G','G','G','G','G','G','G','F','F','G','W'],
      ['G','C','C','P','P','G','P','P','G','H','H','S','S','G','G','G','G','F','G','W'],
      ['F','F','B','G','G','G','P','G','G','H','H','S','S','G','G','G','G','G','V','W'],
      ['F','F','G','G','G','G','P','P','P','G','G','G','G','A','A','G','G','V','V','W'],
      ['W','G','G','G','V','G','G','G','P','P','G','G','F','A','A','G','G','G','G','G'],
      ['W','G','G','V','V','G','G','G','P','G','G','G','F','F','G','G','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','P','P','G','G','F','F','G','G','G','V','G','W'],
      ['W','G','F','F','G','G','G','G','G','P','P','G','G','G','G','G','V','V','G','W'],
      ['W','G','F','F','G','G','G','G','G','G','P','P','G','G','G','G','G','G','G','W'],
      ['W','G','G','G','G','G','G','V','G','G','G','P','P','G','G','F','F','G','G','W'],
      ['W','G','G','G','G','G','G','V','V','G','G','G','P','P','G','F','F','G','W','W'],
      ['W','W','W','W','W','W','W','W','G','G','G','G','W','W','W','W','W','W','W','W']
    ],
    exits: [
      { dir: 'north', range: [7, 12], to: 'north', entry: [9, 12] },
      { dir: 'south', range: [8, 11], to: 'south', entry: [9, 1] },
      { dir: 'west', range: [6, 7], to: 'west', entry: [18, 6] },
      { dir: 'east', range: [6, 7], to: 'east', entry: [1, 6] }
    ],
    npcs: [
      { id: 'master', x: 10, y: 3, name: '县尉韩伯', color: '#4a3728', type: 'master',
        dialogs: [
          { s: '壮士留步！', t: '黄巾余孽肆虐乡里，颍川百姓苦不堪言……壮士可愿为民除害？' },
          { q: 'quest_1', s: '黄巾贼盘踞山林，劫掠村庄', t: '若能剿灭五伙黄巾贼，县衙必有重赏。', t2: '壮士真乃当世豪杰！这是县衙备下的赏金。' },
          { s: '黄巾贼剿得如何了？', t: '五伙贼寇，一伙不可少！\n斩草除根，保境安民，老夫在此静候佳音。' },
          { s: '壮士为颍川除一大害，百姓无不感激！', t: '然而西凉溃兵流窜至此，四处烧杀。壮士可愿再助一臂之力？' },
          { q: 'quest_2', s: '西凉溃兵，残暴不仁', t: '击溃三股溃兵，护我百姓！', t2: '溃兵已除，颍川重归安宁！这是赏金。' },
          { s: '溃兵可曾肃清？', t: '三股溃兵横行无忌。\n除恶务尽，一个都不可放过！' }
        ] },
      { id: 'doctor', x: 11, y: 3, name: '医馆华老', color: '#7b6b5a', type: 'doctor',
        dialogs: [
          { s: '壮士请进！老夫游方至此，略通医术', t: '行军打仗，伤药不可少。行军散10枚五铢钱一包，可要备上？', buy: true }
        ] },
      { id: 'escort', x: 11, y: 11, name: '义军校尉', color: '#7b1f1f', type: 'escort',
        dialogs: [
          { s: '前方就是西凉军大营！', t: '董卓已死，然其部将华雄仍在作乱。壮士此去凶险万分！' },
          { q: 'quest_3', s: '华雄盘踞于此，残害忠良！', t: '若壮士能斩杀华雄，便是天下义士，我关东联军必有重谢！', t2: '天呐！华雄被斩了！壮士真乃万人敌！请受我关东联军一拜！' }
        ] },
      { id: 'monk', x: 6, y: 1, name: '方士左慈', color: '#5d6570', type: 'monk',
        dialogs: [
          { s: '贫道夜观天象……天下将乱矣。', t: '壮士若是疲惫，可在此歇息。贫道为你行气导引，可恢复气血内力。', heal: true }
        ] },
      { id: 'hermit', x: 17, y: 2, name: '水镜先生', color: '#2e5d32', type: 'hermit',
        dialogs: [
          { s: '卧龙、凤雏，得一可安天下……', t: '壮士器宇不凡，老夫赠你一言——顺势而为，可成大事。', t2: '你顿觉心神澄明！(内力上限+20)', buff: { mp: 20 } }
        ] }
    ],
    enemies: [
      { id: 'bandit1', x: 4, y: 1, name: '黄巾喽啰', hp: 30, atk: 8, def: 1, exp: 15, gold: 12, color: '#b8860b', type: 'bandit' },
      { id: 'bandit2', x: 13, y: 1, name: '黄巾探子', hp: 35, atk: 9, def: 2, exp: 18, gold: 15, color: '#c4a035', type: 'bandit' },
      { id: 'bandit3', x: 2, y: 4, name: '流寇', hp: 35, atk: 9, def: 2, exp: 18, gold: 15, color: '#9b870c', type: 'bandit' },
      { id: 'bandit4', x: 6, y: 5, name: '黄巾头目', hp: 50, atk: 12, def: 3, exp: 25, gold: 22, color: '#daa520', type: 'bandit' },
      { id: 'bandit5', x: 8, y: 8, name: '黄巾马贼', hp: 40, atk: 10, def: 2, exp: 20, gold: 18, color: '#8b7500', type: 'bandit' },
      { id: 'bully1', x: 16, y: 5, name: '西凉溃兵', hp: 60, atk: 15, def: 5, exp: 35, gold: 30, color: '#4a3728', type: 'bully' },
      { id: 'bully2', x: 3, y: 9, name: '西凉散兵', hp: 55, atk: 14, def: 4, exp: 30, gold: 28, color: '#5d4535', type: 'bully' },
      { id: 'bully3', x: 15, y: 9, name: '溃兵头领', hp: 70, atk: 17, def: 6, exp: 40, gold: 35, color: '#6b4c3b', type: 'bully' },
      { id: 'guard1', x: 7, y: 11, name: '西凉偏将', hp: 100, atk: 20, def: 7, exp: 80, gold: 60, color: '#6b1a1a', type: 'guard' },
      { id: 'guard2', x: 3, y: 11, name: '西凉副将', hp: 110, atk: 21, def: 7, exp: 90, gold: 70, color: '#8b2020', type: 'guard' },
      { id: 'boss', x: 5, y: 12, name: '华雄', hp: 300, atk: 32, def: 14, exp: 350, gold: 600, color: '#8b0000', type: 'boss' }
    ]
  },
  north: {
    name: '北邙山林',
    data: [
      ['W','W','W','W','G','F','T','G','G','F','F','F','W','W','G','G','G','G','G','W'],
      ['W','W','G','G','G','F','G','G','G','F','G','F','W','G','G','G','G','G','G','W'],
      ['W','G','G','F','F','G','G','F','F','C','C','F','F','G','G','G','G','G','G','W'],
      ['G','G','F','F','F','G','G','G','C','C','F','F','F','G','G','G','G','G','G','W'],
      ['F','F','F','F','G','G','P','P','P','G','G','G','F','F','G','G','G','G','G','W'],
      ['F','F','G','G','G','P','P','P','G','G','G','G','F','F','G','G','G','G','G','W'],
      ['F','G','G','G','P','P','G','G','G','G','F','F','F','G','G','F','F','F','F','G'],
      ['W','G','G','G','G','G','G','G','G','F','F','F','G','V','V','F','F','F','G','W'],
      ['W','G','G','G','F','F','F','G','G','G','G','V','V','V','F','F','F','G','G','W'],
      ['W','G','G','F','F','F','G','G','P','P','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','F','F','F','G','G','P','P','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','F','F','G','G','G','G','G','G','G','G','G','F','F','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','F','F','G','G','G','G','W'],
      ['W','W','W','W','W','W','W','G','G','G','G','W','W','W','W','W','W','W','W','W']
    ],
    exits: [
      { dir: 'south', range: [7, 10], to: 'main', entry: [9, 1] }
    ],
    npcs: [
      { id: 'n_hermit', x: 6, y: 1, name: '山中隐士', color: '#3d5a2e', type: 'hermit',
        dialogs: [{ s: '山人不知岁月……', t: '老夫隐居此地三十载，北邙山深处有猛虎出没，壮士千万小心。', heal: true }] }
    ],
    enemies: [
      { id: 'n_b1', x: 9, y: 2, name: '山贼哨探', hp: 40, atk: 11, def: 2, exp: 20, gold: 16, color: '#8b6914', type: 'bandit' },
      { id: 'n_b2', x: 1, y: 4, name: '野狼', hp: 45, atk: 13, def: 3, exp: 22, gold: 10, color: '#5d4a3c', type: 'bandit' },
      { id: 'n_b3', x: 14, y: 7, name: '山贼头目', hp: 60, atk: 14, def: 4, exp: 35, gold: 25, color: '#a0522d', type: 'bandit' },
      { id: 'n_b4', x: 4, y: 10, name: '猛虎', hp: 80, atk: 20, def: 5, exp: 50, gold: 15, color: '#c87d20', type: 'bully' }
    ]
  },
  south: {
    name: '西凉荒原',
    data: [
      ['W','W','W','W','W','W','W','W','G','G','G','G','W','W','W','W','W','W','W','W'],
      ['R','R','D','D','D','R','R','R','R','R','R','R','R','R','R','R','R','R','R','R'],
      ['R','R','D','D','D','R','R','R','G','G','R','R','R','D','D','R','R','R','R','R'],
      ['R','R','R','R','R','R','R','G','G','G','R','R','D','D','D','R','R','R','R','R'],
      ['R','R','R','R','R','R','G','G','G','G','R','R','R','D','R','R','G','G','R','R'],
      ['R','R','R','G','G','R','R','G','G','R','R','R','R','R','R','G','G','R','R','R'],
      ['R','R','G','G','G','R','R','R','R','R','R','R','R','R','G','G','G','R','R','R'],
      ['R','R','G','G','G','R','R','P','P','R','R','R','G','G','G','R','R','R','R','R'],
      ['R','R','R','G','G','R','R','P','P','R','R','R','G','G','R','R','R','R','R','R'],
      ['R','R','R','R','R','R','P','P','R','R','R','R','R','R','R','R','R','R','R','R'],
      ['R','R','R','R','R','R','P','R','R','R','R','R','R','R','R','R','G','G','R','R'],
      ['R','R','G','G','R','R','R','R','R','R','R','R','R','R','R','G','G','R','R','R'],
      ['W','W','G','G','R','R','R','R','R','R','R','R','R','R','R','R','R','W','W','W'],
      ['W','W','W','W','W','W','R','R','R','R','R','R','R','R','R','W','W','W','W','W']
    ],
    exits: [
      { dir: 'north', range: [7, 10], to: 'main', entry: [9, 12] }
    ],
    npcs: [
      { id: 's_merchant', x: 8, y: 7, name: '西域行商', color: '#8b4513', type: 'doctor',
        dialogs: [{ s: '大漠风沙，蜀道难行……', t: '老夫往来西域贩运药石，这里有上好的金疮药，壮士可要备上？', buy: true }] },
      { id: 's_scout', x: 3, y: 2, name: '西凉斥候', color: '#5c1515', type: 'escort',
        dialogs: [{ s: '嘘……小声些！', t: '华雄虽死，其旧部仍在荒原流窜。前方沙暴中常有伏兵出没，切莫大意！' }] }
    ],
    enemies: [
      { id: 's_b1', x: 10, y: 1, name: '流沙盗', hp: 65, atk: 16, def: 6, exp: 40, gold: 35, color: '#8b6914', type: 'bully' },
      { id: 's_b2', x: 17, y: 3, name: '西凉残兵', hp: 75, atk: 18, def: 7, exp: 50, gold: 40, color: '#6b1a1a', type: 'bully' },
      { id: 's_b3', x: 15, y: 6, name: '沙匪头领', hp: 90, atk: 20, def: 8, exp: 65, gold: 50, color: '#a0522d', type: 'guard' },
      { id: 's_b4', x: 3, y: 11, name: '荒漠马贼', hp: 85, atk: 19, def: 7, exp: 55, gold: 45, color: '#8b7355', type: 'guard' },
      { id: 's_b5', x: 8, y: 12, name: '西凉督将', hp: 130, atk: 24, def: 10, exp: 120, gold: 100, color: '#7b1f1f', type: 'guard' }
    ]
  },
  east: {
    name: '洛阳官道',
    data: [
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W'],
      ['W','G','G','G','G','F','F','F','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','F','F','F','F','C','C','B','G','G','G','G','G','G','G','G','G','W'],
      ['G','G','G','F','F','G','G','C','C','G','G','H','H','G','G','G','G','G','G','W'],
      ['G','G','G','G','P','P','P','P','P','P','G','H','H','G','G','G','G','T','T','W'],
      ['G','G','G','G','P','P','P','G','G','G','G','G','G','G','G','G','T','T','G','W'],
      ['G','G','G','P','P','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','F','F','G','G','G','G','S','S','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','F','F','G','G','G','G','S','S','G','G','G','G','G','G','F','F','G','G','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','F','F','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','G','P','P','P','G','G','G','G','G','G','G','W'],
      ['W','G','G','W','W','G','G','G','G','P','P','P','G','G','G','G','G','G','G','W'],
      ['W','G','W','W','W','G','G','G','G','P','P','G','G','F','F','G','G','G','G','W'],
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W']
    ],
    exits: [
      { dir: 'west', range: [6, 7], to: 'main', entry: [18, 6] }
    ],
    npcs: [
      { id: 'e_guard', x: 4, y: 4, name: '洛阳卫兵', color: '#8b0000', type: 'escort',
        dialogs: [{ s: '前方洛阳！验明身份！', t: '洛阳乃天子脚下，壮士若有军功在身，可前往校尉处领赏。' }] },
      { id: 'e_shop', x: 7, y: 7, name: '铁匠铺主', color: '#4a3728', type: 'doctor',
        dialogs: [{ s: '好铁打好刀！', t: '老夫祖传冶铁手艺，行军散、金疮药都备着，壮士看看？', buy: true }] }
    ],
    enemies: [
      { id: 'e_b1', x: 1, y: 9, name: '官道劫匪', hp: 55, atk: 14, def: 4, exp: 30, gold: 25, color: '#8b6914', type: 'bandit' },
      { id: 'e_b2', x: 14, y: 5, name: '黄巾溃兵', hp: 60, atk: 15, def: 5, exp: 35, gold: 30, color: '#b8860b', type: 'bandit' },
      { id: 'e_b3', x: 9, y: 12, name: '西凉逃兵', hp: 70, atk: 17, def: 6, exp: 45, gold: 38, color: '#6b1a1a', type: 'bully' },
      { id: 'e_b4', x: 17, y: 2, name: '山道悍匪', hp: 80, atk: 19, def: 7, exp: 55, gold: 45, color: '#a0522d', type: 'bully' }
    ]
  },
  west: {
    name: '嵩山深处',
    data: [
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W'],
      ['W','W','W','W','W','G','G','G','F','F','F','F','G','G','G','G','W','W','W','W'],
      ['W','G','G','G','F','F','C','C','C','B','F','G','G','G','G','G','W','W','W','W'],
      ['G','G','G','F','F','C','C','C','F','F','G','G','G','G','G','G','G','G','G','W'],
      ['G','G','G','F','F','F','F','G','G','G','V','V','V','G','G','G','G','G','G','W'],
      ['G','G','G','G','F','F','G','G','G','V','V','V','V','G','G','G','G','G','G','W'],
      ['F','F','G','G','G','G','G','G','G','G','V','V','G','G','G','G','G','G','G','W'],
      ['F','F','G','G','G','G','G','G','P','P','G','G','G','G','G','G','G','G','G','W'],
      ['G','G','G','F','F','G','G','P','P','G','G','G','G','G','F','F','G','G','G','W'],
      ['G','G','F','F','F','G','G','G','G','G','G','G','G','F','F','F','G','G','G','W'],
      ['G','G','G','F','F','G','G','G','G','G','T','T','T','G','G','G','G','G','G','W'],
      ['G','G','G','G','G','G','G','G','G','G','T','T','T','G','G','G','G','G','G','W'],
      ['G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W']
    ],
    exits: [
      { dir: 'east', range: [6, 7], to: 'main', entry: [1, 6] }
    ],
    npcs: [
      { id: 'w_taoist', x: 10, y: 10, name: '嵩山道人', color: '#4a5568', type: 'monk',
        dialogs: [{ s: '道可道，非常道……', t: '此乃嵩山太室，人迹罕至。前方山洞中有灵石，可助修行。壮士疲惫否？', heal: true }] },
      { id: 'w_hermit', x: 17, y: 1, name: '采药老人', color: '#2d5a1e', type: 'hermit',
        dialogs: [{ s: '小心！前方有妖狼……', t: '老朽采药数十载，这山洞中藏有稀世药石，壮士若有缘或可得之。' }] }
    ],
    enemies: [
      { id: 'w_b1', x: 2, y: 4, name: '山魈', hp: 50, atk: 13, def: 3, exp: 28, gold: 18, color: '#5d4a3c', type: 'bandit' },
      { id: 'w_b2', x: 15, y: 7, name: '妖狼', hp: 70, atk: 18, def: 5, exp: 42, gold: 20, color: '#4a3728', type: 'bully' },
      { id: 'w_b3', x: 4, y: 10, name: '妖狼头领', hp: 100, atk: 22, def: 7, exp: 70, gold: 50, color: '#6b4c3b', type: 'guard' },
      { id: 'w_b4', x: 14, y: 3, name: '山中悍匪', hp: 85, atk: 19, def: 8, exp: 60, gold: 48, color: '#a0522d', type: 'guard' }
    ]
  }
};

// 当前地图状态
var currentMap = 'main';
var mapDeadStates = { main: {}, north: {}, south: {}, east: {}, west: {} };
var mapData, npcs, enemies, deadEnemies;

function loadMapGlobals(mapId) {
  var m = allMaps[mapId];
  mapData = m.data;
  MAP_W = m.data[0].length;
  MAP_H = m.data.length;
  npcs = m.npcs;
  enemies = m.enemies;
  if (!mapDeadStates[mapId]) mapDeadStates[mapId] = {};
  deadEnemies = mapDeadStates[mapId];
}
loadMapGlobals('main');

var killCounts = { bandit: 0, bully: 0, guard: 0, boss: 0 };

// ==================== 任务 ====================
var quests = {
  quest_1: { name: '剿灭黄巾', desc: '击败5名黄巾贼', target: 5, progress: 0, rewardGold: 150, rewardExp: 100, done: false, rewardClaimed: false },
  quest_2: { name: '肃清溃兵', desc: '击败3股西凉溃兵', target: 3, progress: 0, rewardGold: 250, rewardExp: 150, done: false, rewardClaimed: false },
  quest_3: { name: '斩杀华雄', desc: '击败华雄', target: 1, progress: 0, rewardGold: 1200, rewardExp: 600, done: false, rewardClaimed: false }
};

// 说书人序幕（测试期只放一句，正式上线可恢复完整版）
var prologueLines = [
  '【汉灵帝中平年间·颍川郡】· 说书人序幕（测试版）'
];

// 默认玩家数据
function defaultPlayer() {
  return {
    x: 9, y: 3,
    hp: 100, maxHp: 100,
    mp: 30, maxMp: 30,
    atk: 15, def: 5,
    level: 1, exp: 0, expNeed: 60,
    gold: 50,
    items: [{ id: 'potion', count: 3 }, { id: 'superPotion', count: 1 }],
    quests: { quest_1: false, quest_2: false, quest_3: false },
    hermitBuffed: false
  };
}

// 区域名称
function areaName(x, y) {
  if (currentMap === 'north') {
    if (y <= 1) return '北邙绝顶';
    if (x <= 1 && y <= 5) return '西麓密林';
    if (x >= 17) return '东山崖';
    if (x >= 5 && x <= 7 && y <= 2) return '古观旧址';
    if (x >= 5 && x <= 7 && y >= 7 && y <= 8) return '幽谷洞穴';
    return '北邙山';
  }
  if (currentMap === 'south') {
    if (y <= 1) return '荒原入口';
    if (x <= 2 && y >= 1 && y <= 3) return '西凉残营';
    if (x <= 2 && y >= 12) return '西绝壁';
    if (x >= 17) return '东沙丘';
    if (y >= 12 && x >= 7 && x <= 12) return '南隘口';
    if (y >= 8) return '深漠';
    return '西凉荒原';
  }
  if (currentMap === 'east') {
    if (y <= 1) return '洛阳北郊';
    if (y >= 12) return '洛阳南门';
    if (x <= 1) return '官道入口';
    if (x >= 17) return '洛阳近郊';
    if (x >= 3 && x <= 5 && y >= 4 && y <= 5) return '官道驿站';
    if (x >= 7 && x <= 8 && y >= 7 && y <= 8) return '洛阳集市';
    if (x >= 15 && x <= 16 && y >= 4 && y <= 5) return '道观';
    return '洛阳官道';
  }
  if (currentMap === 'west') {
    if (y <= 1 && x >= 10) return '嵩阳峰';
    if (y <= 1) return '西山峭壁';
    if (x >= 8 && x <= 10 && y >= 10 && y <= 11) return '嵩山道观';
    if (x >= 4 && x <= 6 && y >= 4 && y <= 5) return '太室山洞';
    if (x <= 2 && y >= 8) return '少室山';
    return '嵩山深处';
  }
  if (y <= 1 && x <= 5) return '北邙山';
  if (y <= 1 && x >= 6 && x <= 7) return '古观';
  if (y <= 1) return '东山';
  if (x <= 2 && y <= 3) return '河畔';
  if (x >= 3 && x <= 4 && y <= 2) return '木桥';
  if (x >= 8 && x <= 9 && y <= 3) return '颍川·民居';
  if (x >= 10 && x <= 11 && y <= 3) return '颍川·集市';
  if (x >= 13 && x <= 14 && y >= 4 && y <= 6) return '练兵场';
  if (x >= 17 && x <= 18 && y >= 4 && y <= 5) return '废弃军械库';
  if (x >= 3 && x <= 5 && y >= 6 && y <= 7) return '幽暗洞穴';
  if (y >= 8 && y <= 9 && x >= 16 && x <= 17) return '乱葬岗';
  if (x >= 12 && x <= 13 && y >= 5 && y <= 8) return '密林深处';
  if (x >= 1 && x <= 2 && y >= 8 && y <= 10) return '竹林';
  if (x >= 15 && x <= 16 && y >= 10 && y <= 12) return '枯木林';
  if (x >= 6 && x <= 8 && y >= 11 && y <= 12) return '西凉前哨';
  if (y >= 13 && x >= 2 && x <= 8) return '西凉军大营';
  if (y >= 12 && x >= 17) return '绝壁';
  if (y >= 11) return '险地';
  if (x >= 8 && y <= 2) return '驿道';
  return '原野';
}

module.exports = {
  TILE: TILE, MAP_W: MAP_W, MAP_H: MAP_H,
  tileStyle: tileStyle,
  ITEM_DB: ITEM_DB,
  allMaps: allMaps,
  currentMap: currentMap,
  mapDeadStates: mapDeadStates,
  mapData: mapData, npcs: npcs, enemies: enemies, deadEnemies: deadEnemies,
  loadMapGlobals: loadMapGlobals,
  killCounts: killCounts,
  quests: quests,
  prologueLines: prologueLines,
  defaultPlayer: defaultPlayer,
  areaName: areaName
};

// ==================== 游戏数据层 ====================
// 设定：幽州大营死牢 — 主角为苦力劳役，目标越狱

var TILE = 32;
var MAP_W = 20, MAP_H = 14;

var tileStyle = {
  G: { cls: 'tile-grass', name: '夯土地', color: '#6b5a3e', colorDark: '#4a3a20', colorLight: '#8a7a5a' },
  F: { cls: 'tile-forest', name: '营帐', color: '#5a4a30', colorDark: '#3a2a18', colorLight: '#7a6a48' },
  P: { cls: 'tile-path', name: '营道', color: '#9a8a6a', colorDark: '#6a5a3a', colorLight: '#baa888' },
  W: { cls: 'tile-wall', name: '寨墙', color: '#4e2218', colorDark: '#1e0805', colorLight: '#6e3a28' },
  H: { cls: 'tile-house', name: '营房', color: '#5a5040', colorDark: '#3a3020', colorLight: '#7a7060' },
  V: { cls: 'tile-cave', name: '牢房', color: '#3a2820', colorDark: '#1a1008', colorLight: '#5a4030' },
  D: { cls: 'tile-dungeon', name: '岗哨', color: '#6a1810', colorDark: '#3a0800', colorLight: '#8a2820' },
  S: { cls: 'tile-shop', name: '库房', color: '#705020', colorDark: '#4a3010', colorLight: '#907040' },
  A: { cls: 'tile-altar', name: '校场', color: '#6a5a30', colorDark: '#3a2a10', colorLight: '#8a7a48' },
  C: { cls: 'tile-water', name: '拒马', color: '#3a4a58', colorDark: '#1a2a38', colorLight: '#5a6a78' },
  B: { cls: 'tile-bridge', name: '营门', color: '#5a4030', colorDark: '#3a2010', colorLight: '#7a6048' },
  T: { cls: 'tile-temple', name: '哨塔', color: '#5a5048', colorDark: '#3a3028', colorLight: '#7a7060' },
  R: { cls: 'tile-sand', name: '柴草堆', color: '#8a7a40', colorDark: '#5a4a20', colorLight: '#aa9a60' }
};

// ========== 所有地图数据 ==========
var allMaps = {
  // ===== 地图1: 地牢 (起始点) =====
  dungeon: {
    name: '地牢',
    data: [
      // 北边界：x6-9为通往上层的出口（→劳役场）
      ['W','W','W','W','W','W','P','P','P','P','W','W','W','W','W','W','W','W','W','W'],
      ['W','W','G','G','G','G','G','G','D','D','G','G','G','G','G','G','G','G','W','W'],
      ['W','W','G','G','G','G','G','G','D','D','G','G','G','G','G','G','G','G','W','W'],
      ['W','W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W','W'],
      ['W','W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W','W','W'],
      ['W','W','V','V','V','G','G','G','G','G','G','G','G','G','V','V','V','W','W','W'],
      ['W','W','V','V','V','G','G','G','G','G','G','G','G','G','V','V','V','W','W','W'],
      ['W','W','V','V','V','G','G','G','G','G','G','G','G','G','V','V','V','W','W','W'],
      ['W','W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W','W','W'],
      ['W','W','V','V','V','G','G','G','G','G','G','G','G','G','V','V','V','W','W','W'],
      ['W','W','V','V','V','G','G','G','G','G','G','G','G','G','V','V','V','W','W','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W','W'],
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W']
    ],
    connections: { north: 'labor' },
    npcs: [
      { id: 'madman', x: 14, y: 5, name: '疯囚犯', color: { skin: '#d4b896', hair: '#999', cloth: '#4a3020' },
        dialogs: [
          { s: '嘿嘿嘿……又一个活人。', t: '老夫在此关了七年，疯没疯……谁知道呢？不过小子，你想出去吗？' },
          { s: '老夫知道这地牢的每一道门。', t: '但你得先活下来。去，把外面那几个狱卒收拾了，老夫就告诉你出路。' },
          { q: 'quest_1', s: '牢里的狱卒，一个比一个凶。', t: '干掉五个狱卒，老夫把这磨了七年的铁片给你。撬锁，你总得会吧？', t2: '嘿嘿……拿去。记住——外面的世界比地牢更可怕。去吧，别回头。' }
        ]
      },
      { id: 'oldprisoner', x: 8, y: 5, name: '老囚', color: { skin: '#c8a882', hair: '#ccc', cloth: '#3a2820' },
        dialogs: [
          { s: '咳咳……年轻人，你也是被抓来的？', t: '这幽州大营，是刺史刘虞麾下的苦役营。我们每日挖壕、筑墙、搬粮……直到累死为止。' },
          { s: '最上面的牢房住着些新来的。', t: '听说外面已经乱成一锅粥了——太平道闹得沸沸扬扬，官府四处抓人充军。老朽就是替人顶了罪……' }
        ]
      },
      { id: 'bribeguard', x: 8, y: 1, name: '贪财狱卒', color: { skin: '#deb887', hair: '#333', cloth: '#5a2020' },
        dialogs: [
          { s: '嘘……小声点。', t: '牢里日子苦，你若肯花几个钱，我这有几样东西。都是从犯人身上搜来的。', buy: true }
        ]
      }
    ],
    enemies: [
      { id: 'd_b1', x: 3, y: 1, name: '狱卒甲', hp: 25, atk: 7, def: 1, exp: 12, gold: 8, color: '#5a2020', type: 'bandit' },
      { id: 'd_b2', x: 10, y: 1, name: '狱卒乙', hp: 25, atk: 7, def: 1, exp: 12, gold: 8, color: '#5a2525', type: 'bandit' },
      { id: 'd_b3', x: 5, y: 3, name: '巡逻狱卒', hp: 30, atk: 8, def: 2, exp: 15, gold: 10, color: '#6a2828', type: 'bandit' },
      { id: 'd_b4', x: 15, y: 3, name: '守夜狱卒', hp: 30, atk: 8, def: 2, exp: 15, gold: 10, color: '#6a2828', type: 'bandit' },
      { id: 'd_b5', x: 12, y: 7, name: '刑讯狱卒', hp: 35, atk: 10, def: 3, exp: 18, gold: 12, color: '#7a3030', type: 'bandit' },
      { id: 'd_b6', x: 2, y: 11, name: '牢头', hp: 50, atk: 12, def: 4, exp: 30, gold: 20, color: '#8a3535', type: 'bandit' },
      { id: 'd_b7', x: 17, y: 9, name: '鞭刑手', hp: 55, atk: 14, def: 4, exp: 35, gold: 22, color: '#8a3838', type: 'bully' }
    ]
  },

  // ===== 地图2: 劳役场 =====
  labor: {
    name: '劳役场',
    data: [
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W'],
      ['W','A','A','A','G','G','F','F','G','G','F','F','G','G','G','A','A','A','G','W'],
      ['W','A','A','A','G','G','F','F','G','G','F','F','G','G','G','A','A','A','G','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','R','R','R','G','G','G','G','G','G','G','R','R','R','G','G','G','W'],
      ['W','G','G','R','R','R','G','D','D','G','G','G','G','R','R','R','G','G','G','W'],
      ['W','G','G','G','G','G','G','D','D','G','G','G','G','G','G','G','G','F','F','W'],
      ['P','G','H','H','G','G','G','G','G','P','P','P','G','G','G','G','G','F','F','P'],
      ['P','G','H','H','G','G','G','G','G','P','P','P','G','G','G','G','G','G','G','P'],
      ['P','G','G','G','P','P','P','P','P','P','P','P','P','P','P','P','G','G','G','P'],
      ['W','F','F','F','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','F','F','F','G','G','G','G','G','H','H','H','G','G','G','G','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','G','H','H','H','G','G','G','G','G','G','G','W'],
      // 南边界：x6-13通往地牢(▼)
      ['W','W','W','W','W','W','P','P','P','P','P','P','P','P','W','W','W','W','W','W']
    ],
    connections: { south: 'dungeon', west: 'barracks', east: 'storage' },
    npcs: [
      { id: 'foreman', x: 10, y: 9, name: '苦力头目', color: { skin: '#d4b896', hair: '#444', cloth: '#4a3a28' },
        dialogs: [
          { s: '喂！新来的？看着不像苦力啊……', t: '老子在这服了五年苦役，知道不少门道。你要是想出去，先得弄身兵甲。西边的兵营里兵器多。' },
          { s: '兵营在西面，武库在东面。', t: '不过两处都有重兵把守。你要是能从兵营里弄到兵器和铠甲，辕门那边的守卫就不足为惧了。' },
          { q: 'quest_3', s: '听说你干掉了不少狱卒？', t: '好小子，有种！但最难缠的还是辕门那边的幽州督军——那家伙刀下亡魂比咱们苦力还多。你若能杀了他，所有人都能逃出去！', t2: '天……天呐！他真的死了？快走！大伙儿一起冲出辕门！' }
        ]
      },
      { id: 'medic', x: 3, y: 7, name: '营中医者', color: { skin: '#fce5d8', hair: '#777', cloth: '#4a5a3a' },
        dialogs: [
          { s: '苦役营里伤病太多，缺医少药。', t: '老夫略通医术，你若受伤，可在此歇息调养。只是药石实在不够分……', heal: true }
        ]
      },
      { id: 'cook', x: 17, y: 11, name: '伙夫老周', color: { skin: '#deb887', hair: '#555', cloth: '#5a4a30' },
        dialogs: [
          { s: '饿了吧？这苦役营的饭，猪都不吃。', t: '不过我这有从仓库偷来的干粮和伤药，你要不要来点？比军中的好多了。', buy: true }
        ]
      }
    ],
    enemies: [
      { id: 'l_b1', x: 2, y: 1, name: '监工甲', hp: 35, atk: 9, def: 2, exp: 16, gold: 12, color: '#5a3030', type: 'bandit' },
      { id: 'l_b2', x: 17, y: 1, name: '监工乙', hp: 35, atk: 9, def: 2, exp: 16, gold: 12, color: '#5a3535', type: 'bandit' },
      { id: 'l_b3', x: 5, y: 5, name: '巡逻兵', hp: 40, atk: 10, def: 3, exp: 20, gold: 15, color: '#6a3535', type: 'bandit' },
      { id: 'l_b4', x: 14, y: 5, name: '巡逻兵', hp: 40, atk: 10, def: 3, exp: 20, gold: 15, color: '#6a3535', type: 'bandit' },
      { id: 'l_b5', x: 7, y: 3, name: '鞭刑手', hp: 50, atk: 13, def: 4, exp: 28, gold: 18, color: '#7a4040', type: 'bully' },
      { id: 'l_b6', x: 12, y: 3, name: '鞭刑手', hp: 50, atk: 13, def: 4, exp: 28, gold: 18, color: '#7a4040', type: 'bully' }
    ]
  },

  // ===== 地图3: 兵营 =====
  barracks: {
    name: '兵营',
    data: [
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W'],
      ['W','W','W','G','G','G','G','F','F','F','G','G','G','G','G','G','W','W','W','W'],
      ['W','G','G','G','G','G','G','F','F','F','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','H','H','H','G','G','G','G','G','D','D','G','G','G','H','H','H','G','W'],
      ['W','G','H','H','H','G','G','G','G','G','D','D','G','G','G','H','H','H','G','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','F','F','G','G','G','A','A','A','A','A','G','G','G','F','F','P','P'],
      ['W','G','G','F','F','G','G','G','A','A','A','A','A','G','G','G','F','F','P','P'],
      ['W','G','G','G','G','P','P','P','P','P','P','P','P','P','P','G','G','G','G','P'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','W','S','S','S','G','G','G','G','D','D','G','G','G','G','G','S','S','S','W'],
      ['W','W','S','S','S','G','G','G','G','D','D','G','G','G','G','G','S','S','S','W'],
      // 南边界：x6-13通往劳役场(▼)
      ['W','W','W','W','W','W','P','P','P','P','P','P','P','P','W','W','W','W','W','W']
    ],
    connections: { south: 'labor', north: 'gate' },
    npcs: [
      { id: 'disgruntled', x: 9, y: 5, name: '散兵赵四', color: { skin: '#deb887', hair: '#333', cloth: '#4a4040' },
        dialogs: [
          { s: '妈的，老子也不想在这鬼地方待了。', t: '那督军克扣军饷，弟兄们早就憋了一肚子火。你要是能把巡逻队干掉几个，我告诉你去武库偷兵器的路。' },
          { q: 'quest_2', s: '巡逻队就在营房附近转悠。', t: '干掉三队巡逻兵，我就把武库暗门的钥匙给你。', t2: '好！这是武库的钥匙。记住了——轻甲刀兵都在仓库，辕门那边的督军，不穿甲可挡不住。' }
        ]
      },
      { id: 'quartermaster', x: 2, y: 11, name: '军需官', color: { skin: '#fce5d8', hair: '#444', cloth: '#5a3a20' },
        dialogs: [
          { s: '军需重地！闲人免进！……等等，你看着面生。', t: '想买军械？哈！不过我这倒有些多余的军粮和药材，你要不要？', buy: true }
        ]
      },
      { id: 'veteran', x: 16, y: 4, name: '老兵', color: { skin: '#c8a882', hair: '#999', cloth: '#3a4a3a' },
        dialogs: [
          { s: '年轻人……看你不是当兵的。', t: '老夫戍边二十年，阅人无数。你身上有股狠劲。拿去吧——这是老夫年轻时从乌桓人那学来的吐纳法。', t2: '你顿觉气息贯通！(内力上限+15)', buff: { mp: 15 } }
        ]
      }
    ],
    enemies: [
      { id: 'b_b1', x: 3, y: 1, name: '哨兵', hp: 50, atk: 12, def: 4, exp: 25, gold: 18, color: '#5a4040', type: 'bandit' },
      { id: 'b_b2', x: 10, y: 2, name: '哨兵', hp: 50, atk: 12, def: 4, exp: 25, gold: 18, color: '#5a4040', type: 'bandit' },
      { id: 'b_b3', x: 16, y: 7, name: '巡逻队长', hp: 65, atk: 15, def: 5, exp: 35, gold: 25, color: '#6a4848', type: 'bully' },
      { id: 'b_b4', x: 4, y: 9, name: '营兵', hp: 55, atk: 13, def: 4, exp: 28, gold: 20, color: '#5a4545', type: 'bully' },
      { id: 'b_b5', x: 14, y: 1, name: '营兵', hp: 55, atk: 13, def: 4, exp: 28, gold: 20, color: '#5a4545', type: 'bully' },
      { id: 'b_b6', x: 9, y: 11, name: '百夫长', hp: 80, atk: 17, def: 6, exp: 50, gold: 35, color: '#7a5050', type: 'guard' }
    ]
  },

  // ===== 地图4: 武库&粮仓 =====
  storage: {
    name: '武库粮仓',
    data: [
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W'],
      ['W','W','W','G','G','G','G','S','S','S','S','G','G','G','G','G','G','W','W','W'],
      ['W','G','G','G','G','G','G','S','S','S','S','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','S','S','G','G','D','D','G','G','G','G','D','D','G','G','S','S','G','W'],
      ['W','G','S','S','G','G','D','D','G','G','G','G','D','D','G','G','S','S','G','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['P','G','G','R','R','R','G','G','G','G','G','G','G','G','R','R','R','G','G','W'],
      ['P','G','G','R','R','R','G','G','G','G','G','G','G','G','R','R','R','G','G','W'],
      ['P','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','F','F','G','G','G','G','G','G','G','G','G','W'],
      ['W','G','G','G','G','G','G','G','F','F','G','G','G','G','G','G','G','G','G','W'],
      ['W','W','H','H','G','G','G','G','G','G','G','G','G','G','G','G','H','H','W','W'],
      // 南边界：x6-13通往劳役场(▼)
      ['W','W','W','W','W','W','P','P','P','P','P','P','P','P','W','W','W','W','W','W']
    ],
    connections: { south: 'labor', north: 'gate' },
    npcs: [
      { id: 'warehouseman', x: 10, y: 4, name: '库吏', color: { skin: '#deb887', hair: '#555', cloth: '#4a3a20' },
        dialogs: [
          { s: '武库重地！你……你不是营兵？', t: '看在刚才乱兵闹事的份上，我当没看见。西角有堆废兵器，有些还能用。不过好东西都在辕门那边。' }
        ]
      },
      { id: 'craftsman', x: 3, y: 11, name: '随军铁匠', color: { skin: '#d4b896', hair: '#333', cloth: '#3a3a3a' },
        dialogs: [
          { s: '打铁四十年，头一回在牢营里做工。', t: '我这有几件私藏的好东西，外面买不到的。要的话拿钱来。', buy: true }
        ]
      },
      { id: 'escort', x: 17, y: 1, name: '被俘义士', color: { skin: '#fce5d8', hair: '#222', cloth: '#6a3a20' },
        dialogs: [
          { s: '壮士！你也是来救人的？', t: '我叫阿蒙，是外面义军的探子。你若能打破辕门，便是天下人的恩人！我愿意助你一臂之力。', companion: 'righteous' }
        ]
      }
    ],
    enemies: [
      { id: 'st_b1', x: 3, y: 4, name: '守仓兵', hp: 55, atk: 14, def: 4, exp: 30, gold: 20, color: '#5a4040', type: 'bully' },
      { id: 'st_b2', x: 14, y: 4, name: '守仓兵', hp: 55, atk: 14, def: 4, exp: 30, gold: 20, color: '#5a4040', type: 'bully' },
      { id: 'st_b3', x: 15, y: 9, name: '护仓卫士', hp: 70, atk: 16, def: 6, exp: 40, gold: 30, color: '#6a4848', type: 'guard' },
      { id: 'st_b4', x: 4, y: 8, name: '护仓卫士', hp: 70, atk: 16, def: 6, exp: 40, gold: 30, color: '#6a4848', type: 'guard' },
      { id: 'st_b5', x: 9, y: 1, name: '护仓督尉', hp: 100, atk: 20, def: 8, exp: 80, gold: 50, color: '#8a5858', type: 'guard' }
    ]
  },

  // ===== 地图5: 辕门 (最终区域) =====
  gate: {
    name: '辕门',
    data: [
      // 北边界：没有出口，全是高墙
      ['W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W','W'],
      ['W','W','W','T','T','W','W','W','W','W','W','W','W','W','T','T','W','W','W','W'],
      ['W','W','W','T','T','W','W','W','W','W','W','W','W','W','T','T','W','W','W','W'],
      ['W','D','D','G','G','G','G','D','D','D','D','G','G','G','G','G','D','D','W','W'],
      ['W','D','D','G','G','G','G','D','D','D','D','G','G','G','G','G','D','D','W','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W','W'],
      ['W','G','G','G','G','F','F','G','G','G','G','G','G','F','F','G','G','G','W','W'],
      ['W','G','G','G','G','F','F','G','G','B','B','G','G','F','F','G','G','G','W','W'],
      ['W','P','P','P','P','P','P','P','P','B','B','P','P','P','P','P','P','P','W','W'],
      ['W','G','G','G','G','F','F','G','G','B','B','G','G','F','F','G','G','G','W','W'],
      ['W','G','G','G','G','F','F','G','G','G','G','G','G','F','F','G','G','G','W','W'],
      ['W','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','W','W'],
      ['W','A','A','A','A','A','A','A','A','A','A','A','A','A','A','A','A','A','W','W'],
      // 南边界：x3-7通兵营，x12-16通武库
      ['W','W','W','P','P','P','P','P','W','W','W','W','P','P','P','P','P','W','W','W']
    ],
    connections: { south_west: 'barracks', south_east: 'storage' },
    npcs: [
      { id: 'guardcaptain', x: 9, y: 6, name: '守门队长', color: { skin: '#deb887', hair: '#333', cloth: '#6a1a1a' },
        dialogs: [
          { s: '何人擅闯辕门！', t: '今日大营戒严，任何人不得出入！……等等，你这身囚服……来人！有囚犯越狱！' },
          { s: '督军大人就在大帐中。', t: '你想见他也好——反正你马上就是个死囚了。' }
        ]
      },
      { id: 'vicecommander', x: 4, y: 3, name: '副将李严', color: { skin: '#c8a882', hair: '#111', cloth: '#5a1a10' },
        dialogs: [
          { s: '站住！再往前一步，格杀勿论！', t: '督军大人有令——擅闯辕门者，斩立决！你还有机会——乖乖回牢房，我当没看见。' }
        ]
      },
      { id: 'runner', x: 16, y: 6, name: '逃兵', color: { skin: '#d4b896', hair: '#444', cloth: '#3a3a4a' },
        dialogs: [
          { s: '别杀我！我也是被逼的！', t: '督军就在辕门后的中军大帐里！他手里有出营的令牌。还有——小心他的亲兵，个个都是百战精锐。', heal: true }
        ]
      }
    ],
    enemies: [
      { id: 'g_b1', x: 3, y: 4, name: '精锐卫兵', hp: 75, atk: 17, def: 6, exp: 45, gold: 30, color: '#6a2020', type: 'bully' },
      { id: 'g_b2', x: 14, y: 4, name: '精锐卫兵', hp: 75, atk: 17, def: 6, exp: 45, gold: 30, color: '#6a2020', type: 'bully' },
      { id: 'g_b3', x: 2, y: 8, name: '督军亲兵', hp: 90, atk: 20, def: 7, exp: 60, gold: 40, color: '#7a2828', type: 'guard' },
      { id: 'g_b4', x: 17, y: 8, name: '督军亲兵', hp: 90, atk: 20, def: 7, exp: 60, gold: 40, color: '#7a2828', type: 'guard' },
      { id: 'g_b5', x: 9, y: 3, name: '副统领', hp: 140, atk: 25, def: 10, exp: 150, gold: 100, color: '#8a3030', type: 'guard' },
      { id: 'boss', x: 9, y: 12, name: '幽州督军', hp: 350, atk: 35, def: 15, exp: 500, gold: 800, color: '#8b0000', type: 'boss' }
    ]
  }
};

// ========== 物品数据库 ==========
var ITEM_DB = {
  potion: { id: 'potion', name: '破布绷带', icon: '🧵', desc: '恢复60点气血', type: 'heal', effect: { hp: 60 }, rarity: 1 },
  superPotion: { id: 'superPotion', name: '军营伤药', icon: '🧪', desc: '完全恢复气血', type: 'heal', effect: { hp: 'full' }, rarity: 2 },
  manaPill: { id: 'manaPill', name: '粗盐', icon: '🧂', desc: '含盐恢复20点内力', type: 'mp', effect: { mp: 20 }, rarity: 2 },
  atkElixir: { id: 'atkElixir', name: '烈酒', icon: '🍶', desc: '攻击+15，持续5回合', type: 'buff', effect: { atk: 15, turns: 5 }, rarity: 2 },
  defElixir: { id: 'defElixir', name: '厚皮甲', icon: '🛡️', desc: '防御+10，持续5回合', type: 'buff', effect: { def: 10, turns: 5 }, rarity: 2 },
  elixir: { id: 'elixir', name: '百年参须', icon: '✨', desc: '完全恢复气血和内力', type: 'elixir', effect: { hp: 'full', mp: 'full' }, rarity: 3 },
  goldPouch: { id: 'goldPouch', name: '狱卒钱袋', icon: '💰', desc: '获得50枚五铢钱', type: 'gold', effect: { gold: 50 }, rarity: 1 }
};

// ========== 任务系统 ==========
var quests = {
  quest_1: { name: '逃出地牢', desc: '击败5名狱卒', target: 5, progress: 0, rewardGold: 80, rewardExp: 100, done: false, rewardClaimed: false },
  quest_2: { name: '盗取兵器', desc: '击败3队巡逻兵', target: 3, progress: 0, rewardGold: 150, rewardExp: 150, done: false, rewardClaimed: false },
  quest_3: { name: '击杀督军', desc: '击败幽州督军', target: 1, progress: 0, rewardGold: 500, rewardExp: 500, done: false, rewardClaimed: false }
};

// ========== 玩家默认数据 ==========
function defaultPlayer() {
  return {
    x: 3, y: 9,
    hp: 80, maxHp: 80,
    mp: 20, maxMp: 20,
    atk: 10, def: 3,
    level: 1, exp: 0, expNeed: 60,
    gold: 5,
    items: [],
    quests: { quest_1: false, quest_2: false, quest_3: false },
    hermitBuffed: false,
    companion: null
  };
}

// ========== 同伴模板 ==========
var COMPANION_TEMPLATES = {
  prisoner: { name: '难友', hp: 50, maxHp: 50, atk: 8, def: 2, icon: 'prisoner' },
  righteous: { name: '义士阿蒙', hp: 90, maxHp: 90, atk: 14, def: 4, icon: 'righteous' }
};

// ========== 区域名 ==========
function areaName(x, y, currentMap) {
  if (currentMap === 'dungeon') {
    if (y <= 1 && x >= 6 && x <= 9) return '石阶出口';
    if (y <= 4 && x >= 7 && x <= 10) return '狱卒值房';
    if (x >= 2 && x <= 4 && y >= 5 && y <= 7) return '左囚室';
    if (x >= 14 && x <= 16 && y >= 5 && y <= 7) return '右囚室';
    if (x >= 2 && x <= 4 && y >= 9 && y <= 10) return '死牢·左';
    if (x >= 14 && x <= 16 && y >= 9 && y <= 10) return '死牢·右';
    if (y >= 11) return '地牢深处';
    return '地牢';
  }
  if (currentMap === 'labor') {
    if (y <= 2 && x <= 6) return '西校场';
    if (y <= 2 && x >= 14) return '东校场';
    if (x >= 4 && x <= 6 && y >= 4 && y <= 5) return '柴草堆';
    if (x >= 13 && x <= 15 && y >= 4 && y <= 5) return '木料场';
    if (x >= 2 && x <= 4 && y >= 7 && y <= 8) return '医舍';
    if (y === 9 && x >= 6 && x <= 13) return '中央大道';
    if (x >= 9 && x <= 11 && y >= 11 && y <= 12) return '伙房';
    if (y >= 13) return '地牢入口';
    return '劳役场';
  }
  if (currentMap === 'barracks') {
    if (y <= 2) return '营北哨所';
    if (x >= 2 && x <= 5 && y >= 4 && y <= 5) return '左营房';
    if (x >= 14 && x <= 17 && y >= 4 && y <= 5) return '右营房';
    if (x >= 7 && x <= 12 && y >= 7 && y <= 8) return '校场';
    if (y === 9) return '营中要道';
    if (x >= 2 && x <= 4 && y >= 11 && y <= 12) return '军需库';
    if (x >= 15 && x <= 17 && y >= 11 && y <= 12) return '武备库';
    if (y >= 13) return '劳役场方向';
    return '兵营';
  }
  if (currentMap === 'storage') {
    if (y <= 2 && x >= 7 && x <= 10) return '粮仓正门';
    if (x >= 2 && x <= 4 && y >= 4 && y <= 5) return '东武库';
    if (x >= 13 && x <= 15 && y >= 4 && y <= 5) return '西武库';
    if (y === 6) return '仓间甬道';
    if (x >= 3 && x <= 5 && y >= 7 && y <= 8) return '柴草场';
    if (x >= 13 && x <= 15 && y >= 7 && y <= 8) return '薪炭场';
    if (y >= 11 && x >= 7 && x <= 8) return '库吏居所';
    if (x >= 2 && x <= 3 && y >= 11) return '铁匠铺';
    if (y >= 13) return '劳役场方向';
    return '武库粮仓';
  }
  if (currentMap === 'gate') {
    if (y <= 1) return '高墙之上';
    if (y <= 3 && x >= 2 && x <= 5) return '左哨塔下';
    if (y <= 3 && x >= 14 && x <= 17) return '右哨塔下';
    if (x >= 3 && x <= 6 && y >= 4 && y <= 5) return '督军亲营';
    if (x >= 13 && x <= 16 && y >= 4 && y <= 5) return '督军亲营';
    if (y >= 6 && y <= 10 && x >= 8 && x <= 11) return '辕门正前';
    if (y === 12 && x <= 9) return '校场';
    if (y >= 13) return '大营入口';
    return '辕门';
  }
  return '幽州大营';
}

module.exports = { TILE, MAP_W, MAP_H, tileStyle, allMaps, ITEM_DB, quests, defaultPlayer, areaName, COMPANION_TEMPLATES };

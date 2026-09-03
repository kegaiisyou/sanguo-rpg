// 生成新的 cities.js，包含61个城市（D3地图城市名单）
// 每个城市：经纬度pos / 势力owner / 等级tier / 城内网格grid / 数值属性

const fs = require('fs');

// 61个城市基础数据：[id, name, state, tier, grid, lng, lat, owner, ctype, desc]
// tier: zhou(州治9格) / jun(大郡7格) / xian(小县5格)
// owner: wei(魏) / shu(蜀) / wu(吴) / contested(争夺)
// ctype: plain(平原) / port(港口) / mountain(山城)
const cities = [
  // ═══ 幽州 ═══
  ['jicheng', '蓟城', '幽州', 'zhou', 9, 116.23, 39.84, 'wei', 'plain', '幽州州治，北疆雄城'],
  ['beiping', '北平', '幽州', 'xian', 5, 118.08, 39.71, 'wei', 'plain', '幽州北境，右北平郡'],
  ['xiangping', '襄平', '幽州', 'jun', 7, 122.94, 41.12, 'wei', 'mountain', '辽东孤郡，边塞雄城'],

  // ═══ 冀州 ═══
  ['yecheng', '邺城', '冀州', 'zhou', 9, 114.47, 36.58, 'wei', 'plain', '冀州州治，曹魏根本'],
  ['julu', '钜鹿', '冀州', 'xian', 5, 115.04, 37.21, 'wei', 'plain', '冀州钜鹿郡，古战场'],
  ['ganling', '甘陵', '冀州', 'xian', 5, 115.71, 36.85, 'wei', 'plain', '冀州甘陵郡'],
  ['nanpi', '南皮', '冀州', 'xian', 5, 116.68, 38.05, 'wei', 'plain', '冀州渤海郡治'],
  ['zhongshan', '中山', '冀州', 'xian', 5, 115.00, 38.52, 'wei', 'plain', '冀州中山国'],

  // ═══ 并州 ═══
  ['jinyang', '晋阳', '并州', 'zhou', 9, 112.56, 37.87, 'wei', 'mountain', '并州治所，北门锁钥'],
  ['shangdang', '上党', '并州', 'xian', 5, 113.08, 36.19, 'wei', 'mountain', '并州上党郡，高地要塞'],

  // ═══ 司隶 ═══
  ['luoyang', '洛阳', '司隶', 'zhou', 9, 112.42, 34.66, 'wei', 'plain', '天子脚下，中原腹心'],
  ['hanei', '河内', '司隶', 'jun', 7, 113.40, 35.11, 'wei', 'plain', '司隶河内郡，三河之一'],
  ['hongnong', '弘农', '司隶', 'xian', 5, 110.88, 34.55, 'wei', 'mountain', '司隶弘农郡，函谷关所在'],

  // ═══ 豫州 ═══
  ['xuchang', '许昌', '豫州', 'zhou', 9, 113.83, 34.04, 'wei', 'plain', '颍水之畔，曹魏新都'],
  ['qiaojun', '谯郡', '豫州', 'jun', 7, 115.80, 33.87, 'wei', 'plain', '豫州谯郡，曹操故里'],
  ['runan', '汝南', '豫州', 'jun', 7, 114.06, 32.97, 'wei', 'plain', '豫州汝南郡，名士之乡'],
  ['xiaopei', '小沛', '豫州', 'xian', 5, 116.57, 34.74, 'contested', 'plain', '豫州沛国，刘备曾驻'],

  // ═══ 兖州 ═══
  ['chenliu', '陈留', '兖州', 'jun', 7, 114.53, 34.67, 'wei', 'plain', '兖州陈留郡，曹操起兵地'],
  ['puyang', '濮阳', '兖州', 'xian', 5, 115.01, 35.78, 'wei', 'plain', '兖州东郡治，黄河要津'],
  ['jibei', '济北', '兖州', 'xian', 5, 117.04, 36.62, 'wei', 'plain', '兖州济北国'],

  // ═══ 徐州 ═══
  ['xiapi', '下邳', '徐州', 'jun', 7, 118.02, 33.93, 'contested', 'plain', '徐州州治，淮北重镇'],
  ['guangling', '广陵', '徐州', 'xian', 5, 120.15, 33.35, 'wu', 'port', '徐州广陵郡，江北门户'],
  ['langya', '琅琊', '徐州', 'xian', 5, 118.32, 35.12, 'wei', 'mountain', '徐州琅琊国，诸葛故里'],

  // ═══ 青州 ═══
  ['beihai', '北海', '青州', 'xian', 5, 119.16, 36.71, 'wei', 'port', '青州北海国，孔融曾治'],
  ['pingyuan', '平原', '青州', 'xian', 5, 116.44, 37.17, 'wei', 'plain', '青州平原郡'],

  // ═══ 雍州 ═══
  ['changan', '长安', '雍州', 'zhou', 9, 108.94, 34.34, 'wei', 'plain', '西京旧都，关中之固'],
  ['tianshui', '天水', '雍州', 'jun', 7, 105.70, 34.60, 'wei', 'mountain', '雍州天水郡，姜维故里'],
  ['anding', '安定', '雍州', 'xian', 5, 106.97, 35.63, 'wei', 'mountain', '雍州安定郡'],
  ['jincheng', '金城', '雍州', 'xian', 5, 103.82, 36.06, 'wei', 'mountain', '雍州金城郡，黄河渡口'],
  ['wudu', '武都', '雍州', 'xian', 5, 105.73, 33.74, 'contested', 'mountain', '雍州武都郡，氐羌之地'],

  // ═══ 凉州 ═══
  ['wuwei', '武威', '凉州', 'jun', 7, 102.63, 37.93, 'wei', 'mountain', '凉州州治，河西走廊'],

  // ═══ 益州 ═══
  ['chengdu', '成都', '益州', 'zhou', 9, 104.07, 30.69, 'shu', 'plain', '天府之国，蜀汉都城'],
  ['hanzhong', '汉中', '益州', 'jun', 7, 107.00, 33.08, 'shu', 'mountain', '秦蜀咽喉，沃野粮仓'],
  ['zitong', '梓潼', '益州', 'xian', 5, 105.16, 31.64, 'shu', 'mountain', '益州梓潼郡，蜀道要冲'],
  ['yongan', '永安', '益州', 'xian', 5, 109.47, 31.02, 'shu', 'mountain', '益州巴东郡，白帝城'],
  ['jiangzhou', '江州', '益州', 'xian', 5, 106.53, 29.59, 'shu', 'mountain', '益州巴郡治，重庆古称'],
  ['yongchang', '永昌', '益州', 'xian', 5, 99.18, 25.03, 'shu', 'mountain', '益州永昌郡，西南边陲'],
  ['yuexi', '越巂', '益州', 'xian', 5, 102.26, 27.88, 'shu', 'mountain', '益州越巂郡，南中之地'],
  ['zangke', '牂牁', '益州', 'xian', 5, 107.52, 26.26, 'shu', 'mountain', '益州牂牁郡，云贵高原'],
  ['jianning', '建宁', '益州', 'xian', 5, 103.81, 25.50, 'shu', 'mountain', '益州建宁郡，南中枢纽'],

  // ═══ 荆州 ═══
  ['xiangyang', '襄阳', '荆州', 'jun', 7, 112.11, 32.00, 'contested', 'plain', '荆州州治，荆襄锁钥'],
  ['jiangling', '江陵', '荆州', 'jun', 7, 112.23, 30.33, 'contested', 'port', '荆州南郡治，长江要冲'],
  ['wancheng', '宛城', '荆州', 'jun', 7, 112.53, 32.99, 'wei', 'plain', '荆州南阳郡治，帝乡'],
  ['changsha', '长沙', '荆州', 'jun', 7, 112.94, 28.30, 'wu', 'plain', '荆州长沙郡，湘水之滨'],
  ['wuling', '武陵', '荆州', 'xian', 5, 111.70, 29.00, 'contested', 'mountain', '荆州武陵郡，湘西之地'],
  ['guiyang', '桂阳', '荆州', 'xian', 5, 112.73, 25.75, 'wu', 'mountain', '荆州桂阳郡，南岭北麓'],
  ['lingling', '零陵', '荆州', 'xian', 5, 109.40, 24.33, 'contested', 'mountain', '荆州零陵郡，湘南门户'],
  ['jiangxia', '江夏', '荆州', 'xian', 5, 114.24, 30.65, 'contested', 'port', '荆州江夏郡，武昌古称'],
  ['xinye', '新野', '荆州', 'xian', 5, 113.09, 32.18, 'contested', 'plain', '荆州南阳属县，刘备驻兵'],
  ['shangyong', '上庸', '荆州', 'xian', 5, 110.23, 32.23, 'contested', 'mountain', '荆州上庸郡，鄂西北'],

  // ═══ 扬州 ═══
  ['jianye', '建业', '扬州', 'zhou', 9, 118.73, 32.01, 'wu', 'port', '江东首府，孙吴都城'],
  ['wujun', '吴郡', '扬州', 'jun', 7, 120.63, 31.27, 'wu', 'plain', '扬州吴郡，三吴之一'],
  ['kuaiji', '会稽', '扬州', 'jun', 7, 120.57, 29.99, 'wu', 'port', '扬州会稽郡，越地故都'],
  ['lujiang', '庐江', '扬州', 'xian', 5, 116.83, 30.74, 'contested', 'plain', '扬州庐江郡，江淮之间'],
  ['shouchun', '寿春', '扬州', 'jun', 7, 116.78, 32.56, 'contested', 'plain', '扬州九江郡治，袁术旧都'],
  ['yuzhang', '豫章', '扬州', 'jun', 7, 115.86, 28.69, 'wu', 'plain', '扬州豫章郡，南昌古称'],
  ['jianan', '建安', '扬州', 'xian', 5, 118.29, 27.02, 'wu', 'mountain', '扬州建安郡，闽地'],
  ['yizhou', '夷洲', '扬州', 'xian', 5, 120.66, 24.18, 'wu', 'port', '东海大岛，孙权曾遣将'],

  // ═══ 交州 ═══
  ['nanhai', '南海', '交州', 'jun', 7, 113.38, 22.94, 'wu', 'port', '交州州治，广州古称'],
  ['jiaozhi', '交趾', '交州', 'xian', 5, 105.88, 21.05, 'wu', 'plain', '交州交趾郡，越南北部'],
  ['hepu', '合浦', '交州', 'xian', 5, 109.20, 21.67, 'wu', 'port', '交州合浦郡，珍珠产地'],
];

// 数值属性模板（按tier）
const tierStats = {
  zhou: { pop: 80, order: 82, commerce: 78, wall: 85, agri: 60, garrison: 80 },
  jun:  { pop: 62, order: 65, commerce: 62, wall: 68, agri: 52, garrison: 60 },
  xian: { pop: 45, order: 50, commerce: 45, wall: 50, agri: 42, garrison: 40 },
};

// 势力显示名
const ownerName = { wei: '曹魏', shu: '蜀汉', wu: '东吴', contested: '争夺' };

// 生成blurb（进城旁白）
function genBlurb(c) {
  const owner = ownerName[c.owner] || '当地';
  const wallDesc = c.wall >= 70 ? '城高池深' : (c.wall >= 50 ? '城墙完备' : '土墙围合');
  const commerceDesc = c.commerce >= 70 ? '市列珠玑，商旅云集' : (c.commerce >= 50 ? '市集有序，买卖如常' : '市井疏朗，百业待兴');
  return [
    `${c.name}${c.tier === 'zhou' ? '城阙巍峨' : '城池在望'}，${wallDesc}。${commerceDesc}。`,
    `城头${owner}旌旗猎猎，守军披甲而立。入郭门即进${c.name}，街衢纵横，百姓往来如常。`
  ];
}

// 生成blurbFind
function genBlurbFind(c) {
  const owner = ownerName[c.owner] || '当地';
  return `郭门两侧揭帖写满入城税则，墙根戍卒持戈而立。${owner}治下，${c.name}${c.commerce >= 60 ? '商旅往来不绝' : '街市渐有生气'}；入城各坊分明，可自由穿行。`;
}

// 生成rootActs
function genRootActs(c) {
  const acts = [{ id: 'rest', label: '郭门歇脚', group: '行动', tip: '依墙小憩，气血内力尽复' }];
  if (c.tier === 'zhou' || c.tier === 'jun') {
    acts.unshift({ id: 'market', label: '逛市集', group: '行动', tip: '与行商交易伤药钱粮' });
  }
  return acts;
}

// 生成完整城市对象
function buildCity(c) {
  const [id, name, state, tier, grid, lng, lat, owner, ctype, desc] = c;
  const stats = tierStats[tier] || tierStats.xian;
  return {
    id, name, state, tier,
    pop: stats.pop, order: stats.order, commerce: stats.commerce,
    wall: stats.wall, agri: stats.agri, grid,
    pos: [lng, lat],  // 经纬度坐标（D3地图用）
    desc, ctype, owner, garrison: stats.garrison,
    blurb: genBlurb({ name, tier, wall: stats.wall, commerce: stats.commerce, owner }),
    blurbFind: genBlurbFind({ name, owner, commerce: stats.commerce }),
    groundItems: [],
    rootActs: genRootActs({ tier }),
  };
}

// 生成cities.js内容
function genCitiesJS() {
  let out = `// 城市数据（程序生成城市房间的单一真相源）
// 说明：
//   grid        —— 城内网格规格(9/7/5)，>0 即参与程序生成
//   tier/ctype  —— 城市层级与类型（影响外观、图标、规模）
//   name        —— 显示名
//   state/pos   —— 所属州、地图坐标（pos 为经纬度 [lng, lat]，D3战略地图直接使用）
//   desc        —— 一句话简介
//   blurb       —— 进城到达旁白（2 段）
//   blurbFind   —— 进城 find 一行
//   groundItems —— 进城地面可见物
//   rootActs    —— 进城根房动作
//   owner       —— 势力归属（wei曹魏 / shu蜀汉 / wu东吴 / contested争夺）
(function(global){
  if(!global.LF) global.LF = {};
  var CITIES = {
`;

  let currentState = '';
  for (const c of cities) {
    const city = buildCity(c);
    if (city.state !== currentState) {
      currentState = city.state;
      out += `    // ═══ ${currentState} ═══\n`;
    }
    out += `    ${city.id}: { name:'${city.name}', state:'${city.state}', tier:'${city.tier}', pop:${city.pop}, order:${city.order}, commerce:${city.commerce}, wall:${city.wall}, agri:${city.agri}, grid:${city.grid}, pos:[${city.pos[0]},${city.pos[1]}],\n`;
    out += `      desc:'${city.desc}', ctype:'${city.ctype}', owner:'${city.owner}', garrison:${city.garrison},\n`;
    out += `      blurb:${JSON.stringify(city.blurb)},\n`;
    out += `      blurbFind:'${city.blurbFind.replace(/'/g, "\\'")}',\n`;
    out += `      groundItems:[], rootActs:${JSON.stringify(city.rootActs)} },\n`;
  }

  out += `  };
  global.LF.CITIES = CITIES;
  if (typeof module !== 'undefined' && module.exports) module.exports = CITIES;
})(typeof window !== 'undefined' ? window : globalThis);
`;
  return out;
}

const content = genCitiesJS();
fs.writeFileSync('C:/Users/Administrator/CodeBuddy/20260402085532/shared/data/cities.js', content, 'utf8');
console.log(`已生成 ${cities.length} 个城市数据，写入 cities.js`);
console.log('各州统计：');
const stateCount = {};
for (const c of cities) {
  stateCount[c[2]] = (stateCount[c[2]] || 0) + 1;
}
for (const [s, n] of Object.entries(stateCount)) {
  console.log(`  ${s}: ${n}城`);
}
console.log('势力统计：');
const ownerCount = {};
for (const c of cities) {
  ownerCount[c[7]] = (ownerCount[c[7]] || 0) + 1;
}
for (const [o, n] of Object.entries(ownerCount)) {
  console.log(`  ${o}: ${n}城`);
}

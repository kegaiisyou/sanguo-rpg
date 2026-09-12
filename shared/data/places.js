// 统一地点注册表（Place 系统单一真相源）
// 现有城市从 LF.CITIES 自动并入(kind:'city'，沿用其 name/state/pos/owner/tier/grid)；
// 再叠加作者维护区的著名地点 / 关卡 / 副本（EXTRA）。
// 加地点 = 在 EXTRA 写一行档案；路网(roads.js) / 房间生成(gen/rooms.js) 自动消费。
// 不改动 cities.js / rooms.js / index.html 的现有逻辑，保证可运行版本不回退。
(function(global){
  global.LF = global.LF || {};
  var C = global.LF.CITIES || {};
  var PLACES = {};

  // —— 现有城市并入（补齐 kind/pos/owner，原 cities.js 字段基本原样保留）——
  Object.keys(C).forEach(function(id){
    var c = C[id];
    PLACES[id] = {
      id: id, kind: 'city', name: c.name, state: c.state, pos: c.pos,
      owner: c.owner || 'neutral', tier: c.tier, ctype: c.ctype,
      grid: c.grid || 0, open: true, _seed: 'city'
    };
  });

  // —— 作者维护区：著名地点 / 关卡 / 副本 ——
  // pos 取近似真实经纬度 [lng,lat]，用于自动算里数与路网；roadType 可覆盖路况。
  var EXTRA = {
    // 关卡（城市派生，扼守道路；isPass:true 时系统据 controls 把它塞成路由必经）
    hulaoguan: { kind:'pass', name:'虎牢关', state:'司隶', pos:[113.20,34.90],
      owner:'dongzhuo', isPass:true, garrison:60, wall:90, defenseBonus:0.30,
      controls:[['luoyang','xuchang']],          // 洛阳↔许昌 必经此关(手工覆盖)
      roadType:'pass', desc:'司隶咽喉，洛阳东门锁钥' },

    // 名胜：古战场 / 剧情钩子（五丈原·隆中·落凤坡·吕伯奢宅·常山·赤壁·官渡）
    // v20260912a 用词规范：地名可留（多为汉代既有地名），但 name/desc 不得叙述「尚未发生」的事——
    //   旧 desc 的「武侯星落」「三顾始出」「凤雏殒命」「孟德夜刃」「火攻破曹」「绍操决战」全是后世视角，
    //   而开场锚点是光和六年，这些战役/人物际遇都还没发生（见 GAME_DESIGN.md §1.1.2 用词规范）。
    //   内部的 battle/plot 键保留不动，将来「玩家亲手打出来的历史」再由这些钩子接续。
    wuzhangyuan: { kind:'wild', name:'五丈原', state:'雍州', pos:[107.90,34.20],
      battle:'wuzhang', isBattlefield:true, desc:'渭水南岸，高阜临流' },
    maolu: { kind:'landmark', name:'隆中草庐', state:'荆州', pos:[112.10,32.00],
      plot:'sangu_maolu', desc:'隆中山下，草庐数椽' },
    luofengpo: { kind:'landmark', name:'落凤坡', state:'益州', pos:[104.20,30.90],
      plot:'pangtong_die', isBattlefield:true, desc:'雒城西南，坡陀险狭' },
    lvboshe: { kind:'wild', name:'吕伯奢宅', state:'司隶', pos:[113.95,34.60],
      plot:'caocao_lvboshe', desc:'中牟道旁，孤宅临路' },
    changshan: { kind:'landmark', name:'常山', state:'冀州', pos:[114.60,38.10],
      plot:null, desc:'真定之地，燕赵旧疆' },
    chibi: { kind:'landmark', name:'赤壁', state:'荆州', pos:[113.90,29.70],
      battle:'chibi', isBattlefield:true, desc:'大江之滨，赤壁危矶' },
    guandu: { kind:'landmark', name:'官渡', state:'司隶', pos:[113.90,34.80],
      battle:'guandu', isBattlefield:true, desc:'黄河津渡，南北通衢' },

    // 副本：挂在某地点入口下(entry)，由生成器造多层刷怪房 + Boss 房
    luofeng_dungeon: { kind:'dungeon', name:'落凤坡秘谷', state:'益州', pos:[104.10,30.85],
      floors:2, roomsPerFloor:4, spawns:['bandit','wolf'], boss:'pangtong_ambush',
      loot:['scroll_fire','gold:50'], entry:'luofengpo', entryReq:{ level:5 },
      desc:'落凤坡下秘谷，伏兵四起' }
  };
  Object.keys(EXTRA).forEach(function(id){
    var e = EXTRA[id];
    e.id = id;
    if (e.open === undefined) e.open = true;
    PLACES[id] = e;
  });

  global.LF.PLACES = PLACES;
})(typeof window !== 'undefined' ? window : globalThis);

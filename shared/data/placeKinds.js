// 地点类型定义（kindDefs）：统一 Place 系统的“类型契约”
// 任何地点的 kind 在此查表；生成器(房间) / 路网 / 遭遇 / 战斗 都按这里读默认。
// 后期要改某类地点的行为（默认守军、默认网格、战斗 scale、图标…），
// 只改本文件，所有该类型地点自动继承 —— 不必逐个地点改。
(function(global){
  global.LF = global.LF || {};

  // 类型表：label 显示名 / icon 战略图图标 / color 分色 /
  // isCityType 是否城市派生子系统(市场·驿馆·守军·根房) /
  // grid 默认城内网格 / battleScale 在此处开战用的战斗 scale /
  // gen 房间生成器名(对应 gen/rooms.js) / isPass 是否关隘
  var KINDS = {
    city:     { label:'城',   icon:'城', color:'#c8a45a', isCityType:true,  grid:9, battleScale:'tactical',  gen:'city',  isPass:false },
    town:     { label:'镇',   icon:'镇', color:'#d8b86a', isCityType:true,  grid:7, battleScale:'tactical',  gen:'city',  isPass:false },
    fort:     { label:'要塞', icon:'垒', color:'#9a6b3a', isCityType:true,  grid:5, battleScale:'strategic', gen:'fort',  isPass:false },
    pass:     { label:'关',   icon:'关', color:'#8a5a2a', isCityType:true,  grid:5, battleScale:'strategic', gen:'fort',  isPass:true  },
    wild:     { label:'野',   icon:'野', color:'#6f8f5a', isCityType:false, grid:0, battleScale:'tactical',  gen:'wild',  isPass:false },
    field:    { label:'郊野', icon:'野', color:'#6f8f5a', isCityType:false, grid:0, battleScale:'tactical',  gen:'field', isField:true, isPass:false },
    landmark: { label:'名胜', icon:'◎', color:'#b06fa0', isCityType:false, grid:0, battleScale:'tactical',  gen:'landmark', isPass:false },
    dungeon:  { label:'副本', icon:'穴', color:'#5a7a9a', isCityType:false, grid:0, battleScale:'tactical',  gen:'dungeon', isPass:false },
    story:    { label:'剧情', icon:'卷', color:'#7a6a9a', isCityType:false, grid:0, battleScale:'tactical',  gen:'story',  isPass:false },
    camp:     { label:'营',   icon:'营', color:'#9a8a5a', isCityType:false, grid:5, battleScale:'tactical',  gen:'camp',  isPass:false }
  };

  // 各类未显式给字段时的默认值（生成器/路网直接读这里）
  // v20261111i：军事目标契约 —— 守军 / 城防 / 补给 / 辎重 / 可攻掠。
  // 单个地点可在 places.js 逐项覆写；settlement.js 消费这些字段造守军与战利品。
  var DEFAULTS = {
    town:   { garrison:80,  wall:20, defenseBonus:0.05, supplies:40, loot:['gold:30','dou'],  raidable:true },
    camp:   { garrison:140, wall:25, defenseBonus:0.10, supplies:50, loot:['gold:50','jiu'],  raidable:true },
    fort:   { garrison:200, wall:70, defenseBonus:0.20, assault:'auto', supplies:30, tax:0, canGarrison:true,  loot:['gold:70','gumao'], raidable:true },
    pass:   { garrison:180, wall:80, defenseBonus:0.25, assault:'auto', supplies:20, tax:0, canGarrison:false, loot:['gold:70','dou'],   raidable:true },
    dungeon:{ floors:1, roomsPerFloor:4, spawns:[], boss:null, loot:[], respawn:'onClear', instance:false, difficulty:1, entryReq:{}, clearReward:null },
    landmark:{ plot:null, battle:null, isBattlefield:false, garrison:60, wall:10, defenseBonus:0, supplies:20, loot:['gold:20'], raidable:true },
    wild:   { garrison:50,  wall:0,  defenseBonus:0,    supplies:15, loot:['gold:15','dou'], raidable:true },
    story:  { raidable:false },
    field:  { size:4, richness:0.5, risk:0.3 }
  };

  global.LF.PLACE_KINDS = KINDS;
  global.LF.PLACE_DEFAULTS = DEFAULTS;
})(typeof window !== 'undefined' ? window : globalThis);

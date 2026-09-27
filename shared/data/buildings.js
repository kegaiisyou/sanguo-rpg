// shared/data/buildings.js
// 建筑原型注册表 + 坊(ward)子房间定义 —— Phase 0 数据基石
//
// 设计评审结论（来自本轮）：
//  1) 府邸/官署/军营 不占整格，做成"坊"格子里的子房间（汉末里坊制：坊是封闭居住/管理单元，内含多户）。
//  2) 官署名用汉末（东汉）真实名称。隋唐的"大理寺/光禄寺/鸿胪寺"在汉分别为 廷尉/光禄勋/大鸿胪。
//  3) 新增建筑/坊只加此表，不碰生成代码（数据驱动）。
//  4) 将坊子房间只是"地图表现层"，指向已存在的 state.armies，不新建模拟层，避免复杂度爆炸。
window.LF = window.LF || {};
(function () {
  var LF = window.LF;

  // 建筑原型。tags: economy/culture/religion/military/water/gov/residential/travel
  // tier: 生成门槛（城市 dev/culture/commerce/沿海 决定能否出现）
  // reqs: { coastal, culture, commerce, ctype } 生成约束
  // yield: 月度产出（接 facilityOutput 数学，单位同 state.res）
  // npcRoles: 该建筑内可能刷的 NPC 角色
  // isWard: true 表示这是一个"坊"格子，内部由 WARD_DEFS[kind].subGen 生成多个子房间
  LF.BUILDING_ARCH = {
    temple:   { key:'temple',   name:'寺观', tags:['culture','religion'], tier:1, reqs:{},                 yield:{},            npcRoles:['monk','pilgrim','oracle'] },
    academy:  { key:'academy',  name:'学宫', tags:['culture','edu'],       tier:2, reqs:{culture:3},        yield:{},            npcRoles:['scholar','student','master'] },
    guild:    { key:'guild',    name:'商会', tags:['economy','trade'],     tier:2, reqs:{commerce:4},       yield:{gold:8},      npcRoles:['merchant','broker','apprentice'] },
    market:   { key:'market',   name:'市集', tags:['economy'],             tier:0, reqs:{},                 yield:{gold:4},      npcRoles:['vendor','peddler'] },
    dock:     { key:'dock',     name:'码头', tags:['water','trade'],       tier:1, reqs:{coastal:true},     yield:{gold:6},      npcRoles:['sailor','porter','smuggler'] },
    inn:      { key:'inn',      name:'驿站', tags:['economy','travel'],    tier:1, reqs:{},                 yield:{gold:2},      npcRoles:['innkeeper','traveler'] },
    barracks: { key:'barracks', name:'军营', tags:['military'],            tier:1, reqs:{},                 yield:{},            npcRoles:['soldier','drillmaster'] },
    storage:  { key:'storage',  name:'仓库', tags:['economy'],             tier:0, reqs:{},                 yield:{},            npcRoles:['storekeeper'] },
  };

  // 官署坊子房间：汉末（东汉）真实中央官署。note 标出与隋唐名的对应，便于文案校对。
  // 来源：三公九卿制 + 尚书台（实权中枢）+ 御史台（监察）+ 大将军府/丞相府（军权中枢）。
  LF.OFFICE_SUBROOMS = [
    { key:'shangshu',  name:'尚书台', note:'中枢政务，实权所在（尚书令/尚书仆射）',            tags:['gov','power'] },
    { key:'yushi',    name:'御史台', note:'监察百官（御史中丞）',                            tags:['gov','censor'] },
    { key:'taichang', name:'太常',   note:'礼乐、宗庙、教育',                                tags:['gov','ritual'] },
    { key:'guanglu',  name:'光禄勋', note:'宫禁侍卫与郎官（隋唐称光禄寺）',                  tags:['gov','guard'] },
    { key:'weiwei',   name:'卫尉',   note:'宫门屯兵',                                        tags:['gov','guard'] },
    { key:'taipu',    name:'太仆',   note:'车马、厩政',                                      tags:['gov','transport'] },
    { key:'tingwei',  name:'廷尉',   note:'司法断狱（隋唐改称大理寺）',                      tags:['gov','justice'] },
    { key:'dahonglu', name:'大鸿胪', note:'朝会宾客、蛮夷事务（隋唐称鸿胪寺）',              tags:['gov','ceremony'] },
    { key:'zongzheng',name:'宗正',   note:'皇族宗室事务',                                    tags:['gov','clan'] },
    { key:'dasinong', name:'大司农', note:'国家财政、盐铁、粮储',                            tags:['gov','finance'] },
    { key:'shaofu',   name:'少府',   note:'皇室私库、尚方、织室',                            tags:['gov','imperial'] },
    { key:'dajiang',  name:'大将军府', note:'军权中枢（如董卓、曹操任大将军）',              tags:['gov','military'] },
  ];

  // 坊定义：坊格子 -> 子房间生成策略。
  //  subGen: mansions(驻城武将府邸) / offices(固定官署) / generals(将府→state.armies) /
  //          shops(市坊商铺) / schools(文教) / docks(码头，仅沿海)
  //  capacity: 该坊最多可见子房间数（超出归入通用房，防格子/列表爆炸）
  LF.WARD_DEFS = {
    resid:   { name:'里坊',   kind:'residential', capacity:6, subGen:'mansions',
               note:'如"静安坊"内含 董府、诸葛府、姜维宅、庞统家 等子房间（按驻城武将名册生成）' },
    gov:     { name:'官署坊', kind:'gov',         capacity:12, subGen:'offices',
               note:'一格官署坊，内含尚书台、廷尉、大鸿胪……等子房间（LF.OFFICE_SUBROOMS）' },
    mil:     { name:'军坊',   kind:'military',    capacity:8,  subGen:'generals',
               note:'每将一府，府=本队军帐兼宅邸；子房间引用 state.armies[aid]（表现层，非新模拟）' },
    market:  { name:'市坊',   kind:'economy',     capacity:8,  subGen:'shops',
               note:'商铺、商会、货栈' },
    culture: { name:'文教坊', kind:'culture',     capacity:5,  subGen:'schools',
               note:'学宫、寺观、精舍' },
    water:   { name:'码头坊', kind:'water',       capacity:5,  subGen:'docks',
               note:'仅沿海 / ctype∈{port,shuizhai} 城生成' },
  };

  // 野外资源节点类型：复用 travel.js 的 RES 概念，落到具体节点地产出，可建专属据点。
  //  build: 对应 build.js 蓝图 id（Phase 1 在 build.js 中新增这些节点专属蓝图）
  //  rate: 月度基础产出（接 facilityOutput 数学）
  LF.RES_NODE_TYPES = {
    mine_iron:   { name:'铁矿脉', res:'iron',   build:'bp_minecamp', rate:6 },
    mine_copper: { name:'铜矿脉', res:'copper', build:'bp_minecamp', rate:5 },
    mine_silver: { name:'银矿脉', res:'silver', build:'bp_minecamp', rate:3 },
    mine_jade:   { name:'玉矿',   res:'jade',   build:'bp_minecamp', rate:2 },
    salt:        { name:'盐池',   res:'salt',   build:'bp_salt',     rate:5 },
    forest:      { name:'林场',   res:'wood',   build:'bp_lumber',   rate:7 },
    fishery:     { name:'渔场',   res:'fish',   build:'bp_fishery',  rate:6 },
    herb:        { name:'药圃',   res:'herb',   build:'bp_herb',     rate:4 },
  };

  // 年代闸门：武将按历史事件/时间入场、投奔、升贬。
  //  monthKey 格式同 state.cal（如 20703 = 建安十二年三月，依游戏内纪元换算）。
  //  act: activate(入场) / defect(投奔他势) / promote(升) / demote(贬)
  //  to: 落点城市 rid；quest: 触发的任务锚点（接 objectives 的 at）
  //  注：运行时投奔/易主由 diploSue / conquerCity 触发 transfer，这里仅作初始编排。
  LF.ERA_SCHEDULE = [
    { gen:'zhuge_liang', at:'20701', act:'activate', to:'xiangyang', quest:'三顾茅庐' },
    { gen:'simayi',      at:'20806', act:'activate', to:'luoyang'  },
    { gen:'zhugeliang',  at:'22101', act:'promote',  to:'chengdu',  note:'丞相' },
  ];

  // 工厂入口（保持与现有 LF.createX(ctx) 范式一致，便于 engine 别名块接入）
  LF.createBuildings = function (ctx) {
    return LF.BUILDING_ARCH;
  };
})();

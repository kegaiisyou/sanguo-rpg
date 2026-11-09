// 战棋沙盘 · 数据层（v20261030h）
// 纯数据 + 换算函数，无依赖；须先于 shared/core/battlefield.js 载入。
// 设计：棋盘尺寸参数化（默认大棋盘 + 视口固定可拖动），地形/克制/阵型一期仅留结构位，
//       二期加表时不返工、不改 core 调用签名。规模→战场尺寸映射供「野外遭遇 / 城镇围攻」等场景选择。
(function (global) {
  global.LF = global.LF || {};
  var LF = global.LF;

  // ── 视口（可见格数，决定拖动范围与单屏密度）──
  // 横屏/桌面：7 列 6 行；手机竖屏（容器宽 <540）：5 列 8 行。
  LF.BF_VIEWPORT = { cols: 7, rows: 6, colsPhone: 5, rowsPhone: 8 };

  // ── 默认逻辑棋盘尺寸（可被 cfg.grid 覆盖；调试页自由调节）──
  // 逻辑盘可比视口大，靠拖动平移查看；双方从两端入场，中间留机动纵深。
  LF.BF_DEFAULT_GRID = { w: 14, h: 12 };

  // ── 规模 → 战场尺寸映射 ──
  // 用于「野战 / 城镇围攻 / 野外遭遇」等不同规模场景自动选尺寸。
  LF.BF_SCALE_TO_GRID = {
    skirmish: { w: 10, h: 8 },     // 野外小规模遭遇：纵深适中
    field: { w: 14, h: 12 },       // 野战：标准大棋盘
    siege: { w: 16, h: 12 }        // 城镇围攻：横向更长，利于展开攻防
  };

  // ── 地形表（走位占点策略支柱：林躲箭 / 丘增防 / 河阻路 / 营垒城垣强防）──
  // moveCost：进入该格的移动消耗（影响每回合可达）；defMul：守方减伤；atkMul：站此格攻击加成；
  // dodge：该格提供的额外闪避（命中 = 0.95 - dodge）；cover：是否遮蔽（预留）。
  LF.BF_TERRAIN = {
    plain:  { key:'plain',  name:'平地', icon:'',   moveCost:1, defMul:1,    atkMul:1,    dodge:0,    cover:false },
    forest: { key:'forest', name:'林地', icon:'🌲', moveCost:2, defMul:1.1,  atkMul:1,    dodge:0.12, cover:true  },
    hill:   { key:'hill',   name:'丘陵', icon:'⛰', moveCost:2, defMul:1.2,  atkMul:1.05, dodge:0.05, cover:false },
    ford:   { key:'ford',   name:'河渡', icon:'🌊', moveCost:3, defMul:0.9,  atkMul:1,    dodge:0,    cover:false },
    rampart:{ key:'rampart',name:'营垒', icon:'🏰', moveCost:1, defMul:1.3,  atkMul:1,    dodge:0,    cover:true  },
    wall:   { key:'wall',   name:'城垣', icon:'🧱', moveCost:1, defMul:1.4,  atkMul:1.1,  dodge:0,    cover:true  }
  };
  // 地形效果已在上方 BF_TERRAIN 实装；生成逻辑见 LF.BF_GEN_TERRAIN。

  // ── 移动力换算：兵科 spd → 移动格数（每回合）──
  // spd 12→2 / 14→2 / 20→3 / 8→1；至少 1。
  LF.BF_MOVE = function (spd) { return Math.max(1, Math.round((spd || 12) / 7)); };

  // ── 射程换算：兵科 slot → 攻击射程（格）──
  // 远（弓弩）= 2 格，其余（步/骑/械/辅）= 1 格。
  LF.BF_RANGE = function (slot) { return slot === '远' ? 2 : 1; };

  // ── 伤害链系数位（一期默认 1.0，二期填地形/克制/阵型表时自动生效）──
  // 完整伤害 = atk × 军令dmgMul × terrainAtkMul × counterMul × moraleAtkMul
  //          × (1 - min(0.8, def × terrainDefMul / 100)) × 随机(0.9~1.1)
  LF.BF_DMG_COEFF = { terrainAtkMul: 1, terrainDefMul: 1, counterMul: 1 };

  // ── 兵种克制三角（长枪克骑 / 骑克弓 / 弓克枪；克制增伤、被克减伤）──
  // 十二兵科克制网（v20261109c）：石头剪刀布扩为环形，攻方命中 C[攻] 得 adv，
  // 否则守方 C[守] 含攻方则 dis。新兵种全部入网，避免出现「无克制」的白板。
  LF.BF_COUNTER = {
    changqiang: ['qibing', 'gongqi'],       // 枪阵拒马 → 骑 / 弓骑
    daji:       ['qibing', 'xianzhen'],     // 大戟勾砍 → 骑 / 弃甲死士
    xianzhen:   ['gongnu', 'chuangnu'],     // 死士突进 → 弓弩 / 床弩
    gongnu:     ['changqiang', 'xianzhen'], // 攒射 → 密集枪阵 / 轻甲死士
    huoshi:     ['daji', 'qizhong'],        // 火攻 → 重甲 / 辎重
    qibing:     ['gongnu', 'huoshi', 'chuangnu'], // 冲锋 → 远程 / 慢速器械
    gongqi:     ['chuangnu', 'minfu'],      // 骑射游走 → 床弩 / 民夫
    chuangnu:   ['daji', 'daodun']          // 穿坚 → 重甲
  };
  // 克制倍率：adv=克制方伤害系数；dis=被克方（反被克）伤害系数
  LF.BF_COUNTER_MUL = { adv: 1.25, dis: 0.8 };

  // ── 阵型表（每营每回合可在「列阵」面板切换；减伤换攻 / 增攻换防）──
  LF.BF_FORMATION = {
    benzhen:  { key:'benzhen',  name:'本阵',   defMul:1,    atkMul:1,    move:0, desc:'不列阵，随势应变。' },
    fangyuan: { key:'fangyuan', name:'方圆阵', defMul:1.2,  atkMul:0.95, move:0, desc:'圆阵御外，坚不可摧，攻势稍钝。' },
    fengshi:  { key:'fengshi',  name:'锋矢阵', defMul:0.85, atkMul:1.2,  move:0, desc:'锐锋向前，破阵最利，侧后空虚。' },
    hey:      { key:'hey',      name:'鹤翼阵', defMul:1.0,  atkMul:1.08, move:0, desc:'两翼张开，包抄压上，中军稳健。' },
    changshe: { key:'changshe', name:'长蛇阵', defMul:0.9,  atkMul:1.1,  move:1, desc:'首尾相顾，行军如风，阵散则危。' }
  };

  // ── 反击比例：射程内敌人反击的概率与伤害比（沿用 DQ 演出风格的近战互搏语义）──
  LF.BF_RIPOSTE = { chance: 0.6, dmg: 0.5 };

  // ── 溃散阈值（沿用 war.js routCheck 思路）：血量比 <0.5 或 士气 <45 累加风险 ──
  LF.BF_ROUT = { hpRatio: 0.5, morale: 45, baseRisk: 0.06 };

  // ── 出生布阵：给定逻辑尺寸与双方单位数，自动上下两端列阵（中间留机动纵深）──
  // 返回 { ally:[{x,y}...], foe:[{x,y}...] }；每方沿 x 横向一字排开，避免重叠。
  // 与棋盘按 y 上下分阵营的染色、默认朝向（我军 ▼ / 敌军 ▲）保持一致：我军居上、敌军居下。
  LF.BF_SPAWN = function (w, h, allyN, foeN, mode) {
    w = w || 14; h = h || 12; allyN = Math.max(1, allyN | 0); foeN = Math.max(1, foeN | 0);
    var allyY = mode === 'siege' ? 1 : Math.max(1, Math.floor(h * 0.12));   // 攻城时攻方贴上沿、守方贴下沿
    var foeY = mode === 'siege' ? h - 2 : Math.max(allyY + 4, h - 1 - Math.floor(h * 0.12));
    function row(n, y) {
      var out = [], used = {}, step = w / (n + 1);
      for (var i = 0; i < n; i++) {
        var x = Math.max(0, Math.min(w - 1, Math.round((i + 1) * step)));
        while (used[x]) x = (x + 1) % w;   // 兵多格窄时顺延，保证不叠子
        used[x] = 1;
        out.push({ x: x, y: y });
      }
      return out;
    }
    return { ally: row(allyN, allyY), foe: row(foeN, foeY) };
  };

  // ── 战场地图模板（战前界面可选）：决定地形构成与特殊地标 ──
  LF.BF_MAPS = {
    plain:  { key:'plain',  name:'平原旷野', desc:'视野开阔 · 骑兵驰骋',   forest:.06, hill:.04, ford:.02 },
    forest: { key:'forest', name:'山林伏兵', desc:'林地密布 · 宜伏宜避箭', forest:.34, hill:.10, ford:.02 },
    river:  { key:'river',  name:'河网渡口', desc:'河道纵横 · 行军迟缓',   forest:.08, hill:.04, ford:.10, riverBand:true },
    pass:   { key:'pass',   name:'险隘关道', desc:'中央狭道 · 营垒据守',   forest:.10, hill:.18, ford:.02, rampart:true },
    siege:  { key:'siege',  name:'城塞攻防', desc:'城垣横亘 · 攻坚守易',   forest:.04, hill:.04, ford:.02, wall:true }
  };

  // ── 地形生成：按地图模板散布林/丘/河，保留双方出生行净空 ──
  LF.BF_GEN_TERRAIN = function (w, h, mode, mapKey) {
    w = w || 14; h = h || 12;
    var M = (LF.BF_MAPS && LF.BF_MAPS[mapKey]) || (mode === 'siege' ? LF.BF_MAPS.siege : LF.BF_MAPS.plain);
    var t = [];
    for (var y = 0; y < h; y++) { t[y] = []; for (var x = 0; x < w; x++) t[y][x] = 'plain'; }
    var cells = [];
    for (var yy = 2; yy < h - 2; yy++) for (var xx = 1; xx < w - 1; xx++) cells.push([xx, yy]);
    for (var i = cells.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp; }
    var n = cells.length || 1;
    var nf = Math.round(n * M.forest), nh = Math.round(n * M.hill), nr = Math.round(n * M.ford), k = 0;
    for (var a = 0; a < nf && k < n; a++, k++) t[cells[k][1]][cells[k][0]] = 'forest';
    for (var b = 0; b < nh && k < n; b++, k++) t[cells[k][1]][cells[k][0]] = 'hill';
    for (var c = 0; c < nr && k < n; c++, k++) t[cells[k][1]][cells[k][0]] = 'ford';
    // 河网：中部横贯一条浅滩，留两处渡口缺口供通行
    if (M.riverBand) {
      var by = Math.max(2, Math.min(h - 3, Math.floor(h / 2)));
      var gap1 = Math.floor(w / 3), gap2 = Math.floor(w * 2 / 3);
      for (var rx = 1; rx < w - 1; rx++) if (rx !== gap1 && rx !== gap2 && t[by]) t[by][rx] = 'ford';
    }
    // 险隘：中央两格营垒卡住狭道
    if (M.rampart) {
      var py = Math.floor(h / 2), px = Math.floor(w / 2);
      if (t[py]) { t[py][px] = 'rampart'; if (t[py][px + 1]) t[py][px + 1] = 'rampart'; }
    }
    // 城塞：守方（下沿）前方横亘一道城垣
    if (M.wall || mode === 'siege') {
      var fy = Math.max(2, h - 3);
      for (var wx = Math.floor(w * 0.25); wx < Math.floor(w * 0.75); wx++) { if (t[fy] && t[fy][wx] === 'plain') t[fy][wx] = 'wall'; }
    }
    return t;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF;
})(typeof window !== 'undefined' ? window : globalThis);

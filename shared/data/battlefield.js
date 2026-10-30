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
  LF.BF_COUNTER = {
    changqiang: ['qibing'],   // 长枪兵 → 克制 骑兵
    qibing:     ['gongnu'],   // 骑兵   → 克制 弓弩兵
    gongnu:     ['changqiang']// 弓弩兵 → 克制 长枪兵
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

  // ── 出生布阵：给定逻辑尺寸与双方单位数，自动两端列阵（中间留机动纵深）──
  // 返回 { ally:[{x,y}...], foe:[{x,y}...] }；纵向均分，避免重叠。
  LF.BF_SPAWN = function (w, h, allyN, foeN, mode) {
    w = w || 14; h = h || 12; allyN = Math.max(1, allyN | 0); foeN = Math.max(1, foeN | 0);
    var allyX = mode === 'siege' ? 1 : Math.max(1, Math.floor(w * 0.12));   // 攻城时攻方贴左、守方贴右
    var foeX = mode === 'siege' ? w - 2 : Math.max(allyX + 4, w - 1 - Math.floor(w * 0.12));
    function col(n, x) {
      var out = [];
      if (n <= 1) { out.push({ x: x, y: Math.floor(h / 2) }); return out; }
      for (var i = 0; i < n; i++) {
        var y = Math.round((i + 1) * (h + 1) / (n + 1));
        out.push({ x: x, y: y });
      }
      return out;
    }
    return { ally: col(allyN, allyX), foe: col(foeN, foeX) };
  };

  // ── 地形生成：在逻辑盘上散布林/丘/河，保留双方出生列净空 ──
  LF.BF_GEN_TERRAIN = function (w, h, mode) {
    w = w || 14; h = h || 12;
    var t = [];
    for (var y = 0; y < h; y++) { t[y] = []; for (var x = 0; x < w; x++) t[y][x] = 'plain'; }
    var cells = [];
    for (var yy = 1; yy < h - 1; yy++) for (var xx = 2; xx < w - 2; xx++) cells.push([xx, yy]);
    for (var i = cells.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp; }
    var n = cells.length;
    var nf = Math.round(n * 0.12), nh = Math.round(n * 0.08), nr = Math.round(n * 0.04);
    var k = 0;
    for (var a = 0; a < nf; a++) { t[cells[k][1]][cells[k][0]] = 'forest'; k++; }
    for (var b = 0; b < nh; b++) { t[cells[k][1]][cells[k][0]] = 'hill'; k++; }
    for (var c = 0; c < nr; c++) { t[cells[k][1]][cells[k][0]] = 'ford'; k++; }
    if (mode === 'siege') {
      var fx = w - 3;
      for (var ry = Math.floor(h * 0.3); ry < Math.floor(h * 0.7); ry++) { if (t[ry][fx] === 'plain') t[ry][fx] = 'wall'; }
    }
    return t;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF;
})(typeof window !== 'undefined' ? window : globalThis);

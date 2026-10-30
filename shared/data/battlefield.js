// 战棋沙盘 · 数据层（v20261030d）
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

  // ── 地形表（一期仅 plain 平地；字段结构一次定齐，二期直接填值即可）──
  // moveCost：进入该格的额外移动消耗（一期全 1）；defMul/atkMul：攻防系数；
  // dodge：该格提供的额外闪避（命中 = 0.95 - dodge）；cover：是否遮蔽（预留）。
  LF.BF_TERRAIN = {
    plain: { key: 'plain', name: '平地', icon: '', moveCost: 1, defMul: 1, atkMul: 1, dodge: 0, cover: false }
  };
  // 二期地形（占位，本期不生效）：林/丘/河渡/营垒/城垣/街巷
  // LF.BF_TERRAIN.forest = { key:'forest', name:'林地', icon:'🌲', moveCost:2, defMul:1.1, atkMul:1, dodge:0.12, cover:true };
  // LF.BF_TERRAIN.hill = { key:'hill', name:'丘陵', icon:'⛰', moveCost:2, defMul:1.2, atkMul:1.05, dodge:0.05, cover:false };
  // LF.BF_TERRAIN.ford = { key:'ford', name:'河渡', icon:'🌊', moveCost:3, defMul:0.9, atkMul:1, dodge:0, cover:false };
  // LF.BF_TERRAIN.rampart = { key:'rampart', name:'营垒', icon:'🏰', moveCost:1, defMul:1.3, atkMul:1, dodge:0, cover:true };
  // LF.BF_TERRAIN.wall = { key:'wall', name:'城垣', icon:'🧱', moveCost:1, defMul:1.4, atkMul:1.1, dodge:0, cover:true };

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

  // ── 兵种克制三角表（二期启用；一期为空 → counterMul 恒 1）──
  // 形如 { changqiang:['qibing'], qibing:['gongnu'], gongnu:['changqiang'] }（key 克 values）
  LF.BF_COUNTER = {};

  // ── 阵型表（二期启用；一期为空）──
  // 形如 { fangyuan:{name:'方圆阵', defMul:1.2, atkMul:0.95, move:0}, ... }
  LF.BF_FORMATION = {};

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

  if (typeof module !== 'undefined' && module.exports) module.exports = LF;
})(typeof window !== 'undefined' ? window : globalThis);

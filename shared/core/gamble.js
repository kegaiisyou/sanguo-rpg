// 乱世烽火 · 赌坊掷骰小游戏（v20261003a Canvas 真3D投影骰子）
// 入口：快活赌坊「押大押小」→ openModal('gamble')
// 玩法：押注银两 → 押大/押小 → 水墨手入陶碗撒骰 → 骰子3D翻滚落定 → 和 4~10 小 / 11~17 大（1:1），豹子通吃
// 渲染：Canvas 手绘 3D 立方体（旋转矩阵+透视投影+背面剔除+动态光照+面上点数随旋转投影）——非 DOM 纸片
(function () {
  'use strict';
  // 六面底色（水墨色系，翻滚/结算时各面颜色清晰可辨）
  var FACE_COLOR = { 1: '#f5ead8', 2: '#fdf7e8', 3: '#ecd9b8', 4: '#dfe6d2', 5: '#e8d9d9', 6: '#dbe4ea' };
  // 传统骰子点数配色：1 与 4 面用朱砂红点，2/3/5/6 面用墨色点
  var DOT_COLOR = { 1: '#c23a2c', 2: '#3a2c1c', 3: '#3a2c1c', 4: '#c23a2c', 5: '#3a2c1c', 6: '#3a2c1c' };
  function shade(hex, l) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + Math.round(r * l) + ',' + Math.round(g * l) + ',' + Math.round(b * l) + ')';
  }
  var IMG = 'shared/img/gamble/';
  function state() { return (window.LF && LF.Core) ? LF.Core.state : null; }
  function gold() { var s = state(); return s ? (s.gold || 0) : 0; }
  function sfx(name) { try { window.SFX && window.SFX.play(name); } catch (e) {} }
  var D = 24; // 骰子半边长（48px 立方体）

  // ---------- 3D 数学 ----------
  function rot3(p, rx, ry, rz) {
    var x = p[0], y = p[1], z = p[2];
    var cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    var y1 = y * cx - z * sx, z1 = y * sx + z * cx;
    var x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
    var x3 = x2 * cz - y1 * sz, y3 = x2 * sz + y1 * cz;
    return [x3, y3, z2];
  }
  var VERT = [
    [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
  ];
  var FACES = [
    { i: [2, 3, 7, 6], n: 2, nx: 0, ny: 1, nz: 0 },   // top +Y 2
    { i: [0, 1, 5, 4], n: 5, nx: 0, ny: -1, nz: 0 },  // bottom -Y 5
    { i: [4, 5, 7, 6], n: 1, nx: 0, ny: 0, nz: 1 },   // front +Z 1
    { i: [0, 1, 3, 2], n: 6, nx: 0, ny: 0, nz: -1 },  // back -Z 6
    { i: [1, 3, 7, 5], n: 3, nx: 1, ny: 0, nz: 0 },   // right +X 3
    { i: [0, 2, 6, 4], n: 4, nx: -1, ny: 0, nz: 0 }   // left -X 4
  ];
  // 每面点数在面内 9 宫格 (u,v)
  var DOT_UV = {
    1: [[.5, .5]],
    2: [[.25, .25], [.75, .75]],
    3: [[.25, .25], [.5, .5], [.75, .75]],
    4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]],
    5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]],
    6: [[.25, .25], [.75, .25], [.25, .5], [.75, .5], [.25, .75], [.75, .75]]
  };
  // 点数面朝上的旋转（把面法线转到 +Y），再叠加展示倾斜角
  var FACE_UP = {
    1: [-Math.PI / 2, 0, 0], 2: [0, 0, 0], 3: [0, 0, Math.PI / 2],
    4: [0, 0, -Math.PI / 2], 5: [Math.PI, 0, 0], 6: [Math.PI / 2, 0, 0]
  };


  // 等轴测投影（isometric）：像🎲emoji——顶面呈完美菱形（点数在菱形里），前/右两侧面从菱形下方展开
  // 规则：x轴↘30°、z轴↙30°、y轴垂直向上 → 玩家一眼即认「菱形=朝上的点数面」
  function proj(p, fov) {
    return [(p[0] - p[2]) * 0.8660254, (p[0] + p[2]) * 0.5 - p[1]];
  }
  function facePoint(pts, u, v) {
    return [pts[0][0] + (pts[1][0] - pts[0][0]) * u + (pts[3][0] - pts[0][0]) * v,
            pts[0][1] + (pts[1][1] - pts[0][1]) * u + (pts[3][1] - pts[0][1]) * v,
            pts[0][2] + (pts[1][2] - pts[0][2]) * u + (pts[3][2] - pts[0][2]) * v];
  }
  // 画一颗骰子到 canvas：cx,cy 中心，内层姿态 rx/ry/rz + 外层观察倾斜 TILT，s 边长，fov 透视
  // settled=落定态：顶面（hot 点数面）点数放大加粗，侧面点数淡化 → 结算数字一目了然
  // 宣纸纹理（预生成一次，面填充后叠加淡噪点）
  var PAPER = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 24;
    var g = c.getContext('2d'); g.fillStyle = '#f5ecd8'; g.fillRect(0, 0, 24, 24);
    for (var i = 0; i < 70; i++) { g.fillStyle = 'rgba(120,90,50,' + (0.03 + Math.random() * 0.06) + ')'; g.fillRect(Math.random() * 24, Math.random() * 24, 1.2, 1.2); }
    return c;
  })();
  function paperFill(ctx, cv, path, globalAlpha) {
    var pat = cv._ppat || (cv._ppat = ctx.createPattern(PAPER, 'repeat'));
    ctx.save(); ctx.globalAlpha = globalAlpha; ctx.fillStyle = pat; ctx.fill(); ctx.restore();
  }
  function drawDice(cv, cx, cy, s, rx, ry, rz, fov, settled, hot) {
    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    var half = s / 2;
    var faces = [];
    for (var fi = 0; fi < 6; fi++) {
      var F = FACES[fi];
      var pts = F.i.map(function (vi) {
        return rot3([VERT[vi][0] * half, VERT[vi][1] * half, VERT[vi][2] * half], rx, ry, rz);
      });
      var nc = rot3([F.nx * half, F.ny * half, F.nz * half], rx, ry, rz);
      // 等轴测视线 (1,1,1)：法线与视线同向（和>0）才可见 → 顶面+前面+右面
      if (nc[0] + nc[1] + nc[2] <= 0) continue;
      faces.push({ pts: pts, n: F.n, dep: nc[0] + nc[1] + nc[2] });
    }
    faces.sort(function (a, b) { return a.dep - b.dep; });
    for (var i = 0; i < faces.length; i++) {
      var f2 = faces[i];
      var isHot = settled && f2.n === hot;
      var fc = FACE_COLOR[f2.n] || '#f5ead8';
      var dc = DOT_COLOR[f2.n] || '#3a2c1c';
      ctx.beginPath();
      var pp0 = proj(f2.pts[0], fov); ctx.moveTo(pp0[0] + cx, pp0[1] + cy);
      for (var j = 1; j < 4; j++) { var pj = proj(f2.pts[j], fov); ctx.lineTo(pj[0] + cx, pj[1] + cy); }
      ctx.closePath();
      if (isHot) {
        // 落定顶面：面本色最亮，无描边——靠亮度+大点数白描边区分（去黑色描边）
        ctx.fillStyle = shade(fc, 1);
        ctx.fill();
        paperFill(ctx, cv, 1, .5);
        var dots = DOT_UV[f2.n];
        ctx.save();
        ctx.shadowColor = 'rgba(226,180,90,.8)'; ctx.shadowBlur = 7;
        for (var k = 0; k < dots.length; k++) {
          var Q = facePoint(f2.pts, dots[k][0], dots[k][1]);
          var pq = proj(Q, fov);
          var rr = Math.max(3.2, s * 0.16);
          ctx.beginPath();
          ctx.arc(pq[0] + cx, pq[1] + cy, rr, 0, 6.2832);
          ctx.fillStyle = dc;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255,255,255,.95)';
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // 各面保持本色（轻微光照差异），落定侧面略暗但仍可见颜色
        var l = settled ? 0.82 : (f2.dep / (half * 3) > 0.5 ? 0.92 : 0.86);
        ctx.fillStyle = shade(fc, l);
        ctx.fill();
        paperFill(ctx, cv, 1, .38);
        ctx.strokeStyle = 'rgba(58,44,28,.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // 点数按面本色（红/黑）；落定侧面弱化点数，翻滚正常
        var dots = DOT_UV[f2.n];
        var da = settled ? 0.35 : 1;
        for (var k = 0; k < dots.length; k++) {
          var Q = facePoint(f2.pts, dots[k][0], dots[k][1]);
          var pq = proj(Q, fov);
          ctx.beginPath();
          ctx.arc(pq[0] + cx, pq[1] + cy, Math.max(2.2, s * 0.1), 0, 6.2832);
          ctx.globalAlpha = da;
          ctx.fillStyle = dc;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(0,0,0,.18)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  var RULE = 'bao'; // 当前玩法：bao=经典通吃 / nobao=江湖无豹
  var DEALER_LINES = [
    '这位客官，手气如何？',
    '押大押小，落子无悔——',
    '听我这碗骰声，怕是有三两天没开过豹子了。',
    '输赢乃常事，莫要红了眼。',
    '客官且坐，看我这手活儿利不利索。',
    '豹子一出，庄家通吃——客官押大押小，全凭天意。'
  ];
  function render() {
    return '<div class="gm-sign">快活赌坊<i>骰宝赌桌</i><span class="gm-bank"><img class="gm-silver" src="' + IMG + 'silver.png" alt="银两"><b id="gm-gold">' + gold() + '</b></span></div>' +
      '<p class="tip gm-sub" id="gm-rule-tip">骰宝三骰：先选玩法，再下注（大/小二选一，可同押豹子·单偶·单点）；押中按各注赔率结算</p>' +
      '<div class="gm-stage">' +
      '<div class="gm-tag hidden" id="gm-tag"></div>' +
      '<div class="gm-bowl" id="gm-bowl"><div class="gm-mat"></div>' +
      '<img class="gm-dealer" id="gm-dealer" src="' + IMG + 'dealer.png" alt="荷官"><span class="gm-dealer-tag">荷官</span>' +
      '<img class="gm-bowl-img" src="' + IMG + 'bowl.png" alt="陶碗">' +
      '<div class="gm-hand" id="gm-hand"><img class="gm-himg gm-hc" id="gm-hc" src="' + IMG + 'hand_closed.png" alt=""><img class="gm-himg gm-ho" id="gm-ho" src="' + IMG + 'hand_open.png" alt=""></div>' +
      '<div class="gm-dice" id="gm-d1"><canvas class="gm-canvas" width="60" height="60"></canvas></div>' +
      '<div class="gm-dice" id="gm-d2"><canvas class="gm-canvas" width="60" height="60"></canvas></div>' +
      '<div class="gm-dice" id="gm-d3"><canvas class="gm-canvas" width="60" height="60"></canvas></div>' +
      '</div>' +
      '<div class="gm-duel hidden" id="gm-duel">' +
      '<div class="gm-duel-side"><div class="gm-duel-label">玩家</div><div class="gm-duel-dice">' +
      '<div class="gm-dice" id="gm-p1"><canvas width="50" height="50"></canvas></div>' +
      '<div class="gm-dice" id="gm-p2"><canvas width="50" height="50"></canvas></div>' +
      '<div class="gm-dice" id="gm-p3"><canvas width="50" height="50"></canvas></div></div></div>' +
      '<div class="gm-duel-vs">VS</div>' +
      '<div class="gm-duel-side gm-side-banker"><div class="gm-duel-label">荷官 <img class="gm-duel-dealer" src="' + IMG + 'dealer.png" alt="荷官"></div><div class="gm-duel-dice">' +
      '<div class="gm-dice" id="gm-b1"><canvas width="50" height="50"></canvas></div>' +
      '<div class="gm-dice" id="gm-b2"><canvas width="50" height="50"></canvas></div>' +
      '<div class="gm-dice" id="gm-b3"><canvas width="50" height="50"></canvas></div></div></div>' +
      '</div>' +
      '<button class="gm-skip hidden" id="gm-skip">立即开盅 ▸</button>' +
      '<div class="gm-result" id="gm-result">掷骰定乾坤，押大押小，落子无悔</div>' +
      '<div class="gm-rules" id="gm-rules">' +
      '<div class="gm-rule-head">先选玩法</div>' +
      '<div class="gm-rule-row">' +
      '<button class="gm-rule" data-rule="bao"><b>经典通吃</b><small>豹子 · 庄家通吃</small></button>' +
      '<button class="gm-rule" data-rule="nobao"><b>江湖无豹</b><small>豹子 · 计点数判大小</small></button>' +
      '<button class="gm-rule" data-rule="duel"><b>骰子对决</b><small>你摇 vs 荷官摇 · 1:1</small></button>' +
      '</div>' +
      '<p class="gm-rule-tip">骰宝：大/小二选一，可另同押豹子·单偶·单点（各按赔率结算）· 骰子对决与荷官比大小</p>' +
      '</div>' +
      '<div class="gm-bet hidden" id="gm-bet">' +
      '<div class="gm-amt-row"><input id="gm-amt" class="gm-amt" type="number" min="1" max="' + Math.max(gold(), 1) + '" value="30" inputmode="numeric"><span class="gm-chips">' +
      '<span class="gm-chip" data-q="10">10</span><span class="gm-chip" data-q="30">30</span><span class="gm-chip" data-q="50">50</span><span class="gm-chip gm-all" data-q="all">全押</span></span></div>' +
      '<div class="gm-bets">' +
      '<div class="gm-bet-row"><span class="gm-betopt gm-bbig" data-b="big">押 大<small>11-17 点</small></span><span class="gm-betopt gm-bsmall" data-b="small">押 小<small>4-10 点</small></span><span class="gm-row-hint">大/小二选一</span></div>' +
      '<div class="gm-bet-row"><span class="gm-betopt gm-bbao" data-b="bao">押豹子<small>1 赔 24</small></span><span class="gm-betopt gm-bodd" data-b="odd">押 单<small>1:1</small></span><span class="gm-betopt gm-beven" data-b="even">押 偶<small>1:1</small></span></div>' +
      '<div class="gm-bet-row gm-row-pts"><span class="gm-pts-t" id="gm-pts-t">押单点<small>中 n 颗赔 n 倍 · 50 两起</small></span><span class="gm-pts-nums" id="gm-pts-nums"><span class="gm-betopt gm-pt" data-b="p1" title="押一点数：三骰中每出现一颗「1」即赔 1 倍注金（50 两起）">1</span><span class="gm-betopt gm-pt" data-b="p2" title="押一点数：三骰中每出现一颗「2」即赔 1 倍注金（50 两起）">2</span><span class="gm-betopt gm-pt" data-b="p3" title="押一点数：三骰中每出现一颗「3」即赔 1 倍注金（50 两起）">3</span><span class="gm-betopt gm-pt" data-b="p4" title="押一点数：三骰中每出现一颗「4」即赔 1 倍注金（50 两起）">4</span><span class="gm-betopt gm-pt" data-b="p5" title="押一点数：三骰中每出现一颗「5」即赔 1 倍注金（50 两起）">5</span><span class="gm-betopt gm-pt" data-b="p6" title="押一点数：三骰中每出现一颗「6」即赔 1 倍注金（50 两起）">6</span></span></div>' +
      '</div>' +
      '<div class="gm-btns"><button class="btn btn-ghost gm-switch" id="gm-modeswitch">换玩法</button><button class="btn gm-go" id="gm-go">摇骰开盅</button>' +
      '<button class="btn btn-ghost gm-again hidden" id="gm-again">再来一局</button></div>' +
      '<div class="gm-hist" id="gm-hist"><div class="gm-hist-head">本桌记录 ▾</div><div class="gm-hist-list" id="gm-hist-list"></div><div class="gm-hist-sum" id="gm-hist-sum"></div></div>' +
      '</div>' +
      '<div class="gm-duelbet hidden" id="gm-duelbet">' +
      '<div class="gm-amt-row"><input id="gm-amt2" class="gm-amt" type="number" min="1" max="' + Math.max(gold(), 1) + '" value="30" inputmode="numeric"><span class="gm-chips">' +
      '<span class="gm-chip" data-q="10">10</span><span class="gm-chip" data-q="30">30</span><span class="gm-chip" data-q="50">50</span><span class="gm-chip gm-all" data-q="all">全押</span></span></div>' +
      '<div class="gm-bets"><div class="gm-bet-row"><span class="gm-betopt gm-bself" data-b="self">押你赢<small>1:1</small></span><span class="gm-betopt gm-bbanker" data-b="banker">押荷官赢<small>1:1</small></span></div></div>' +
      '<div class="gm-btns"><button class="btn btn-ghost gm-switch" id="gm-modeswitch2">换玩法</button><button class="btn gm-go" id="gm-go2">摇骰对决</button>' +
      '<button class="btn btn-ghost gm-again hidden" id="gm-again2">再来一局</button></div>' +
      '</div>';
  }

  var els = null;
  function $() {
    if (els) return els;
    els = {
      gold: document.getElementById('gm-gold'), amt: document.getElementById('gm-amt'),
      hand: document.getElementById('gm-hand'), hc: document.getElementById('gm-hc'), ho: document.getElementById('gm-ho'),
      d: [document.getElementById('gm-d1'), document.getElementById('gm-d2'), document.getElementById('gm-d3')],
      cvs: [document.querySelector('#gm-d1 .gm-canvas'), document.querySelector('#gm-d2 .gm-canvas'), document.querySelector('#gm-d3 .gm-canvas')],
      result: document.getElementById('gm-result'), big: document.getElementById('gm-big'),
      small: document.getElementById('gm-small'), again: document.getElementById('gm-again'),
      rules: document.getElementById('gm-rules'), bet: document.getElementById('gm-bet'),
      dealer: document.getElementById('gm-dealer'), ruleTip: document.getElementById('gm-rule-tip'),
      tag: document.getElementById('gm-tag'),
      stage: document.querySelector('.gm-stage'), histList: document.getElementById('gm-hist-list'),
      ptsT: document.getElementById('gm-pts-t'), ptsNums: document.getElementById('gm-pts-nums'),
      bowl: document.getElementById('gm-bowl'),
      skip: document.getElementById('gm-skip'), go: document.getElementById('gm-go'),
      duel: document.getElementById('gm-duel'), duelbet: document.getElementById('gm-duelbet'),
      go2: document.getElementById('gm-go2'), again2: document.getElementById('gm-again2'),
      amt2: document.getElementById('gm-amt2'),
      p: [document.getElementById('gm-p1'), document.getElementById('gm-p2'), document.getElementById('gm-p3')],
      b: [document.getElementById('gm-b1'), document.getElementById('gm-b2'), document.getElementById('gm-b3')],
      pc: [document.querySelector('#gm-p1 canvas'), document.querySelector('#gm-p2 canvas'), document.querySelector('#gm-p3 canvas')],
      bc: [document.querySelector('#gm-b1 canvas'), document.querySelector('#gm-b2 canvas'), document.querySelector('#gm-b3 canvas')]
    };
    return els;
  }
  var phase = 0, amt = 0, faces = [0, 0, 0];
  // 骰宝多注：size=大小注('big'/'small'/'')，bao/odd/even 可选，point=单点数(0 或 1-6)
  var bets = { size: '', bao: false, odd: false, even: false, point: 0 };
  // 对决：duelBet='self'/'banker'，duelFace=玩家/荷官骰面
  var duelBet = '', duelFaces = { p: [0, 0, 0], b: [0, 0, 0] };
  // 游戏启动即预载赌坊素材（碗/手），避免进入赌坊时卡顿
  (function () { ['bowl', 'hand_closed', 'hand_open'].forEach(function (n) { var im = new Image(); im.src = IMG + n + '.png'; }); })();

  function resetUI() {
    var e = $();
    if (e.rules && e.bet) { e.rules.classList.add('hidden'); e.bet.classList.remove('hidden'); }
    e.hand.className = 'gm-hand';
    e.hc.style.opacity = 1; e.ho.style.opacity = 0;
    e.d.forEach(function (d) {
      d.style.display = 'none'; d.style.transform = ''; d.style.transition = 'none';
    });
    e.cvs.forEach(function (c) { if (c) { c.getContext('2d').clearRect(0, 0, 60, 60); } });
    e.result.textContent = '掷骰定乾坤，押大押小，落子无悔';
    e.result.className = 'gm-result';
    if (e.tag) e.tag.className = 'gm-tag hidden';
    if (e.skip) e.skip.classList.add('hidden');
    if (e.go) e.go.classList.remove('hidden');
    e.again.classList.add('hidden');
    e.amt.disabled = false;
    document.querySelectorAll('.gm-chip').forEach(function (q) { q.style.opacity = 1; });
    bets = { size: '', bao: false, odd: false, even: false, point: 0 };
    document.querySelectorAll('.gm-betopt').forEach(function (x) { x.classList.remove('on'); });
    if (e.ptsNums) e.ptsNums.style.display = 'none';
    if (e.ptsT) e.ptsT.classList.remove('on');
    phase = 0;
  }
  function resetDuelUI() {
    var e = $();
    e.result.textContent = '骰子对决：你摇三骰，荷官摇三骰，点数大者胜——平局退注。';
    e.result.className = 'gm-result';
    e.p.forEach(function (d) { d.style.opacity = 0; d.style.transform = 'scale(.4)'; });
    e.b.forEach(function (d) { d.style.opacity = 0; d.style.transform = 'scale(.4)'; });
    e.pc.forEach(function (c) { if (c) c.getContext('2d').clearRect(0, 0, 50, 50); });
    e.bc.forEach(function (c) { if (c) c.getContext('2d').clearRect(0, 0, 50, 50); });
    if (e.skip) e.skip.classList.add('hidden');
    if (e.go2) e.go2.classList.remove('hidden');
    if (e.again2) e.again2.classList.add('hidden');
    e.amt2.disabled = false;
    document.querySelectorAll('.gm-betopt').forEach(function (x) { x.classList.remove('on'); });
    // 再来一局保持上次押注选择（恢复高亮）
    if (duelBet) {
      var sel2 = document.querySelector('#gm-duelbet .gm-betopt[data-b="' + duelBet + '"]');
      if (sel2) sel2.classList.add('on');
    }
    phase = 0;
  }

  function betCount() {
    var n = 0;
    if (bets.size) n++;
    if (bets.bao) n++;
    if (bets.odd) n++;
    if (bets.even) n++;
    if (bets.point) n++;
    return n;
  }
  // 押注明细：选中注后实时显示「注金 × 规则 × 输赢金额」
  function updateBetInfo() {
    var e = $();
    if (!e || !e.bet || e.bet.classList.contains('hidden')) return;
    if (phase !== 0) return;
    if (!betCount()) { e.result.textContent = '掷骰定乾坤，押大押小，落子无悔'; e.result.className = 'gm-result'; return; }
    var amtN = parseInt(e.amt.value, 10) || 0;
    if (!amtN) { e.result.textContent = '掷骰定乾坤，押大押小，落子无悔'; return; }
    var lines = [];
    function line(name, winDesc, mul) {
      lines.push(name + ' ' + amtN + '两｜' + winDesc + ' 赢+' + amtN * mul + ' / 不中 输-' + amtN);
    }
    if (bets.size) line(bets.size === 'big' ? '押大' : '押小', bets.size === 'big' ? '11-17点' : '4-10点', 1);
    if (bets.bao) line('押豹子', '三骰同面', 24);
    if (bets.odd) line('押单', '和数为单', 1);
    if (bets.even) line('押偶', '和数为双', 1);
    if (bets.point) line('押点' + bets.point, '任一中该点', 2);
    e.result.innerHTML = lines.join('<br>');
    e.result.className = 'gm-result gm-betinfo';
  }
  function start() {
    var e = $(), s = state();
    if (!s) return;
    if (phase !== 0) return;
    amt = parseInt(e.amt.value, 10);
    if (!amt || amt < 1) { e.result.textContent = '荷官瞥你一眼：「空手下注，是来寻开心的？」'; return; }
    var cnt = betCount();
    if (!cnt) { e.result.textContent = '荷官：「客官先选个注——大小、豹子、单偶、单点数都行。」'; return; }
    if (bets.point && amt < 50) { e.result.textContent = '荷官：「押单点数，五十两起。」'; sfx('click'); return; }
    if (amt * cnt > gold()) { e.result.textContent = '荷官冷笑：「囊中银两不够，也敢上桌？」（当前 ' + gold() + '）'; return; }
    sfx('diceShake');
    if (e.gold) { e.gold.classList.remove('gm-gold-flash'); void e.gold.offsetWidth; e.gold.classList.add('gm-gold-flash'); }
    if (e.go) e.go.disabled = true;
    e.amt.disabled = true;
    document.querySelectorAll('.gm-chip').forEach(function (q) { q.style.opacity = .4; });
    e.result.className = 'gm-result rolling';
    var sTxt = [];
    if (bets.size) sTxt.push(bets.size === 'big' ? '押大' : '押小');
    if (bets.bao) sTxt.push('豹子');
    if (bets.odd) sTxt.push('单');
    if (bets.even) sTxt.push('偶');
    if (bets.point) sTxt.push('点' + bets.point);
    e.result.textContent = sTxt.join('+') + ' —— 每注 ' + amt + ' 两，天公作美！';
    if (e.tag) { e.tag.className = 'gm-tag ' + (bets.size === 'big' ? 'big' : 'small'); e.tag.textContent = sTxt.join('+') + ' · ' + amt + '两 ×' + cnt; }
    phase = 1;
    faces = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    e.hand.className = 'gm-hand in';
    e.hc.style.opacity = 1;
    if (e.skip) e.skip.classList.remove('hidden');
    if (e.go) e.go.classList.add('hidden');
    window.setTimeout(function () {
      if (phase !== 1) return;
      e.hc.style.opacity = 0; e.ho.style.opacity = 1;
      e.d.forEach(function (d) {
        d.style.display = 'block';
        d.style.transition = 'none';
        d.style.transform = 'scale(.35)';
        d.style.opacity = 1;
      });
      window.setTimeout(function () {
        if (phase !== 1) return;
        e.d.forEach(function (d, i) {
          d.style.transition = 'transform .4s ease-in, opacity .3s';
          d.style.transform = 'scale(1)';
        });
        window.setTimeout(function () {
          if (phase !== 1) return;
          e.hand.className = 'gm-hand back';
          window.setTimeout(spin, 440);
        }, 440);
      }, 120);
    }, 700);
  }

  var R = 48;
  function spin() {
    var e = $();
    var stopDur = [850, 1450, 2000];
    var stAng = [0.4, 2.2, 4.0], spAng = [0.15, 2.9, 5.6];
    var spinTurns = [1.7, 2.2, 2.6];
    var t0 = performance.now(), done = 0, lastTick = 0, lastAng = [{rx:0,ry:0,rz:0},{rx:0,ry:0,rz:0},{rx:0,ry:0,rz:0}];
    function frame(now) {
      if (phase !== 1) return; // 被轻点跳过 → 停止翻滚
      var el = now - t0;
      for (var i = 0; i < 3; i++) {
        var d = e.d[i], cv = e.cvs[i];
        if (el < stopDur[i]) {
          var k = el / stopDur[i], kk = 1 - Math.pow(1 - k, 2.2);
          var ang = stAng[i] + (spAng[i] - stAng[i]) * kk;
          var x = R * Math.cos(ang), y = R * Math.sin(ang);
          var spin = kk * spinTurns[i] * 900; // 3D 翻滚角
          var bounce = Math.sin(el / 92 + i * 2.1) * 7;
          // Canvas 真 3D：绕 X/Y 高速翻滚（面上点数随旋转自然变化）
          lastAng[i] = { rx: spin * 0.7 * Math.PI / 180, ry: spin * Math.PI / 180, rz: 0 };
          drawDice(cv, 30, 30, 26, lastAng[i].rx, lastAng[i].ry, 0, 120);
          var tick = Math.floor(el / 150);
          if (tick !== lastTick && i === (tick % 3)) { lastTick = tick; sfx('diceTick'); }
          d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (y - bounce).toFixed(1) + 'px) scale(1)';
        } else if (d.getAttribute('data-done') !== '1') {
          d.setAttribute('data-done', '1');
          var a = spAng[i];
          var x = R * Math.cos(a), y = R * Math.sin(a);
          var idx = i, face = faces[idx];
          sfx('diceLand');
          // 弹跳落定 → 3D 过渡到「点数面朝上+倾斜展示」
          d.style.transition = 'transform .11s ease-out';
          d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (y - 10).toFixed(1) + 'px) scale(1)';
          settleCube(cv, face, x, y, lastAng[idx]);
          done++;
        }
      }
      if (done >= 3) { window.setTimeout(finalize, 420); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // 立方体从翻滚态缓动到「点数面朝上」——等轴测视角下即呈现完美菱形顶面（🎲图式）
  function settleCube(cv, face, x, y, from) {
    var t0 = performance.now();
    var fu = FACE_UP[face];
    var to = { rx: fu[0], ry: fu[1], rz: fu[2] };
    function norm(a, b) { var d = (a - b) % 6.2832; if (d > 3.1416) d -= 6.2832; if (d < -3.1416) d += 6.2832; return b + d; }
    function step(now) {
      var k = Math.min(1, (now - t0) / 400);
      var e = 1 - Math.pow(1 - k, 3);
      var rx = from.rx + (norm(to.rx, from.rx) - from.rx) * e;
      var ry = from.ry + (norm(to.ry, from.ry) - from.ry) * e;
      var rz = from.rz + (norm(to.rz, from.rz) - from.rz) * e;
      drawDice(cv, 30, 30, 26, rx, ry, rz, 120, k >= 1, face);
      if (k < 1) requestAnimationFrame(step);
      else { // 落定：弹回原位 + 碗轻震
        var d = cv.parentElement;
        d.style.transition = 'transform .3s cubic-bezier(.3,1.5,.4,1)';
        d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(1)';
        var bowl = document.getElementById('gm-bowl');
        if (bowl) { bowl.classList.remove('shake'); void bowl.offsetWidth; bowl.classList.add('shake'); }
      }
    }
    requestAnimationFrame(step);
  }

  // 加速手势：动画期间轻点骰子区 → 骰子立即落定结算
  function skipDuel() {
    var e = $();
    if (phase !== 1) return;
    phase = 2;
    for (var i = 0; i < 3; i++) {
      var fu = FACE_UP[duelFaces.p[i]];
      drawDice(e.pc[i], 25, 25, DUEL_S, fu[0], fu[1], fu[2], 90, true, duelFaces.p[i]);
      var fu2 = FACE_UP[duelFaces.b[i]];
      drawDice(e.bc[i], 25, 25, DUEL_S, fu2[0], fu2[1], fu2[2], 90, true, duelFaces.b[i]);
      e.p[i].style.opacity = 1; e.b[i].style.opacity = 1;
    }
    if (e.skip) e.skip.classList.add('hidden');
    sfx('diceLand');
    window.setTimeout(function () { if (phase === 2) { phase = 3; duelFinalize(); } }, 150);
  }
  function skip() {
    var e = $();
    if (phase !== 1) return;
    phase = 2;
    e.hand.className = 'gm-hand back';
    if (e.skip) e.skip.classList.add('hidden');
    if (e.go) { e.go.disabled = false; e.go.classList.remove('hidden'); }
    var sp = [4.0, 5.6, 1.2], k = [0, 1, 2];
    e.d.forEach(function (d, i) {
      d.style.display = 'block';
      d.style.transition = 'none';
      var x = R * Math.cos(sp[i]), y = R * Math.sin(sp[i]);
      d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(1)';
      var cv = e.cvs[i];
      var fu = FACE_UP[faces[i]];
      drawDice(cv, 30, 30, 26, fu[0], fu[1], fu[2], 120, true, faces[i]);
      sfx('diceLand');
    });
    window.setTimeout(function () { if (phase === 2) { phase = 3; finalize(); } }, 120);
  }

  // 本桌会话统计（关窗时汇总到文本输出框）
  var sess = { rounds: 0, net: 0, streak: 0 };
  function close() {
    if (sess.rounds > 0) {
      var s2 = state();
      var t = '在快活赌坊共玩了 ' + sess.rounds + ' 局，';
      if (sess.net > 0) t += '净赚 ' + sess.net + ' 两。';
      else if (sess.net < 0) t += '输了 ' + (-sess.net) + ' 两。';
      else t += '不赔不赚。';
      if (window.log) { window.log(t, sess.net > 0 ? 'good' : (sess.net < 0 ? 'bad' : 'sys')); }
    }
    sess = { rounds: 0, net: 0 };
  }

  function updateHistSum() {
    var el = document.getElementById('gm-hist-sum');
    if (!el) return;
    var cls = sess.net > 0 ? 'win' : (sess.net < 0 ? 'lose' : '');
    el.className = 'gm-hist-sum ' + cls;
    el.textContent = '本桌 ' + sess.rounds + ' 局 · 净 ' + (sess.net >= 0 ? '+' : '') + sess.net + ' 两 · 连胜 ' + sess.streak;
  }

  function finalize() {
    var e = $(), s = state();
    phase = 3;
    var sum = faces[0] + faces[1] + faces[2];
    var bao = faces[0] === faces[1] && faces[1] === faces[2];
    var label = sum >= 11 ? '大' : '小';
    var odd = sum % 2 === 1;
    var z = function (n) { return ['零', '一', '二', '三', '四', '五', '六'][n] || n; };
    var delta = 0, parts = [], wonAny = false;
    function hit(txt, win, mul) {
      var d = win ? amt * (mul || 1) : -amt;
      delta += d;
      if (win) { wonAny = true; parts.push(txt + '赢+' + d); }
      else { parts.push(txt + '输-' + amt); }
    }
    // 大小注（经典通吃时豹子使大小注全输）
    if (bets.size === 'big') { var bw = (RULE === 'bao' && bao) ? false : sum >= 11; hit('押大', bw, 1); }
    else if (bets.size === 'small') { var sw = (RULE === 'bao' && bao) ? false : sum <= 10; hit('押小', sw, 1); }
    // 豹子注 1:24
    if (bets.bao) hit('押豹子', bao, 24);
    // 奇偶注 1:1
    if (bets.odd) hit('押单', odd, 1);
    if (bets.even) hit('押偶', !odd, 1);
    // 单点数：中 n 颗赢 n 倍注金
    if (bets.point) { var hits = 0; for (var h = 0; h < 3; h++) { if (faces[h] === bets.point) hits++; } hit('押点' + bets.point, hits > 0, hits); }
    s.gold += delta;
    if (bao && RULE === 'bao') sfx('bao'); else if (wonAny && delta > 0) sfx('win'); else sfx('lose');
    var head = bao ? '【豹子】' : '【' + label + '】';
    var msg = head + z(faces[0]) + z(faces[1]) + z(faces[2]) + '，共 ' + sum + ' 点——' + parts.join(' · ') + '；合计 ' + (delta >= 0 ? '+' : '') + delta + ' 两（当前 ' + s.gold + '）';
    e.result.textContent = msg;
    e.result.className = delta > 0 ? 'gm-result win' : (delta < 0 ? 'gm-result lose' : 'gm-result');
    if (e.tag) e.tag.className = 'gm-tag hidden';
    e.gold.textContent = s.gold;
    if (e.histList) {
      var line = document.createElement('div');
      line.className = 'gm-hist-line ' + (delta > 0 ? 'win' : (delta < 0 ? 'lose' : 'tie'));
      line.textContent = amt + '两·' + faces[0] + faces[1] + faces[2] + ' ' + sum + '点 · ' + (delta > 0 ? '赢+' + delta : (delta < 0 ? '输' + delta : '平'));
      e.histList.appendChild(line);
      while (e.histList.children.length > 20) e.histList.removeChild(e.histList.firstChild);
      e.histList.scrollTop = e.histList.scrollHeight;
    }
    sess.rounds++; sess.net += delta; if (delta > 0) sess.streak++; else if (delta < 0) sess.streak = 0; updateHistSum();
    if (e.again) e.again.classList.remove('hidden');
    if (e.skip) e.skip.classList.add('hidden');
    if (e.go) { e.go.disabled = false; e.go.classList.add('hidden'); }
    if (e.ptsNums) e.ptsNums.style.display = 'none';
    if (e.ptsT) e.ptsT.classList.remove('on');
    bets.point = 0;
    phase = 0;
  }

  // ── 骰子对决：你摇 → 荷官摇，两遍动画依次落定 ──
  var DUEL_S = 20;
  function duelHighlight(side) {
    var e = $();
    if (!e.duel) return;
    var sides = e.duel.querySelectorAll('.gm-duel-side');
    for (var i = 0; i < sides.length; i++) sides[i].classList.remove('active');
    var node = e.duel.querySelector(side === 'p' ? '.gm-duel-side:first-child' : '.gm-duel-side:last-child');
    if (node) node.classList.add('active');
  }
  function rollDuelSide(cvs, elsArr, faces, side, onDone) {
    var e = $();
    duelHighlight(side);
    var dur = [1100, 1300, 1500];
    var t0 = performance.now();
    function frame(now) {
      if (phase !== 1) return;
      var el = now - t0;
      for (var i = 0; i < 3; i++) {
        var k = Math.min(1, el / dur[i]);
        var e2 = 1 - Math.pow(1 - k, 2.2);
        drawDice(cvs[i], 25, 25, DUEL_S, e2 * 1080 * (i + 1) * Math.PI / 180, e2 * 720 * Math.PI / 180, 0, 90);
        elsArr[i].style.opacity = 1;
        elsArr[i].style.transform = 'translate(' + (i * 26 - 26).toFixed(0) + 'px,' + (-Math.sin(el / 120 + i) * 5).toFixed(1) + 'px)';
      }
      if (el < dur[2] + 260) requestAnimationFrame(frame);
      else {
        for (var i = 0; i < 3; i++) {
          var fu = FACE_UP[faces[i]];
          drawDice(cvs[i], 25, 25, DUEL_S, fu[0], fu[1], fu[2], 90, true, faces[i]);
          elsArr[i].style.transform = 'translate(' + (i * 26 - 26).toFixed(0) + 'px,0) scale(1)';
        }
        sfx('diceLand');
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(frame);
  }
  function startDuelRoll() {
    var e = $();
    e.result.className = 'gm-result rolling';
    e.result.textContent = '你摇三骰——' + (duelBet === 'self' ? '押你赢' : '押荷官赢') + ' ' + (parseInt(e.amt2.value, 10) || 30) + ' 两！';
    rollDuelSide(e.pc, e.p, duelFaces.p, 'p', function () {
      e.result.textContent = '荷官摇三骰——';
      rollDuelSide(e.bc, e.b, duelFaces.b, 'b', function () { duelFinalize(); });
    });
  }
  function duelFinalize() {
    var e = $(), s = state();
    phase = 3;
    var pSum = duelFaces.p[0] + duelFaces.p[1] + duelFaces.p[2];
    var bSum = duelFaces.b[0] + duelFaces.b[1] + duelFaces.b[2];
    var amt2 = parseInt(e.amt2.value, 10) || 30;
    var delta = 0, msg, win = false;
    if (pSum === bSum) { msg = '【对决】平局：' + pSum + ' 对 ' + bSum + '——注银退回，不赔不赚。'; }
    else if ((duelBet === 'self' && pSum > bSum) || (duelBet === 'banker' && bSum > pSum)) { delta = amt2; win = true; msg = '【对决】' + pSum + ' 对 ' + bSum + '——你押中了，赢 ' + delta + ' 两（当前 ' + (s.gold + delta) + '）！'; sfx('win'); }
    else { delta = -amt2; msg = '【对决】' + pSum + ' 对 ' + bSum + '——押注落空，输 ' + amt2 + ' 两（当前 ' + (s.gold + delta) + '）。'; sfx('lose'); }
    s.gold += delta;
    e.result.textContent = msg;
    e.result.className = win ? 'gm-result win' : (delta < 0 ? 'gm-result lose' : 'gm-result');
    e.gold.textContent = s.gold;
    if (e.histList) {
      var line = document.createElement('div');
      line.className = 'gm-hist-line ' + (delta > 0 ? 'win' : (delta < 0 ? 'lose' : 'tie'));
      line.textContent = '对决 ' + pSum + ':' + bSum + ' · ' + (delta > 0 ? '赢+' + delta : (delta < 0 ? '输' + delta : '平局退注'));
      e.histList.appendChild(line);
      while (e.histList.children.length > 20) e.histList.removeChild(e.histList.firstChild);
      e.histList.scrollTop = e.histList.scrollHeight;
    }
    sess.rounds++; sess.net += delta; if (delta > 0) sess.streak++; else if (delta < 0) sess.streak = 0; updateHistSum();
    if (e.again2) e.again2.classList.remove('hidden');
    if (e.skip) e.skip.classList.add('hidden');
    if (e.go2) { e.go2.disabled = false; e.go2.classList.add('hidden'); }
    phase = 0;
  }
  function startDuel() {
    var e = $(), s = state();
    if (phase !== 0 || !s) return;
    var amt2 = parseInt(e.amt2.value, 10);
    if (!amt2 || amt2 < 1) { e.result.textContent = '荷官：「空手上桌，是来寻开心的？」'; return; }
    if (!duelBet) { e.result.textContent = '荷官：「先押你赢，还是押荷官赢？」'; sfx('click'); return; }
    if (amt2 > gold()) { e.result.textContent = '荷官冷笑：「囊中银两不够，也敢对决？」（当前 ' + gold() + '）'; return; }
    for (var i = 0; i < 3; i++) { duelFaces.p[i] = 1 + Math.floor(Math.random() * 6); duelFaces.b[i] = 1 + Math.floor(Math.random() * 6); }
    e.p.forEach(function (d) { d.style.opacity = 1; d.style.transform = 'translate(0,0)'; });
    e.b.forEach(function (d) { d.style.opacity = 0; });
    if (e.go2) e.go2.disabled = true;
    if (e.amt2) e.amt2.disabled = true;
    if (e.skip) e.skip.classList.remove('hidden');
    sfx('diceShake');
    e.result.className = 'gm-result rolling';
    phase = 1;
    startDuelRoll();
  }

  function bind() {
    els = null; // 弹窗每次打开会重建 DOM，必须重新获取
    var e = $();
    if (!e.go) return;
    if (window.SFX && SFX.startAmbient) { try { SFX.startAmbient(); } catch (e5) { } } // 赌坊氛围音
    // 玩法选择（三卡：经典通吃 / 江湖无豹 / 骰子对决）
    document.querySelectorAll('.gm-rule').forEach(function (r) {
      r.onclick = function () {
        var rk = r.getAttribute('data-rule');
        document.querySelectorAll('.gm-rule').forEach(function (x) { x.classList.remove('on'); });
        r.classList.add('on');
        if (e.ruleTip) e.ruleTip.style.display = 'none';
        if (rk === 'duel') {
          duelBet = '';
          RULE = 'duel';
          e.rules.classList.add('hidden'); e.bet.classList.add('hidden'); e.duelbet.classList.remove('hidden');
          if (e.duel) e.duel.classList.remove('hidden');
          if (e.bowl) e.bowl.classList.add('hidden');
          resetDuelUI();
        } else {
          RULE = rk;
          e.rules.classList.add('hidden'); e.duelbet.classList.add('hidden'); e.bet.classList.remove('hidden');
          if (e.duel) e.duel.classList.add('hidden');
          if (e.bowl) e.bowl.classList.remove('hidden');
          resetUI();
          e.result.textContent = RULE === 'bao'
            ? '玩法选定：经典通吃。豹子通吃；大/小二选一，可另同押豹子·单偶·单点数，中者按各注赔率结算。'
            : '玩法选定：江湖无豹。豹子按点数计大小；大/小二选一，可另同押豹子·单偶·单点数。';
        }
        sfx('confirm');
      };
    });
    // 骰宝多注选择
    document.querySelectorAll('#gm-bet .gm-betopt').forEach(function (x) {
      x.onclick = function () {
        if (phase !== 0) return;
        var b = x.getAttribute('data-b');
        if (b === 'big' || b === 'small') { bets.size = (bets.size === b) ? '' : b; }
        else if (b.indexOf('p') === 0) { var n = parseInt(b.slice(1), 10); bets.point = (bets.point === n) ? 0 : n; }
        else if (b === 'bao') { bets.bao = !bets.bao; }
        else if (b === 'odd') { bets.odd = !bets.odd; if (bets.odd) bets.even = false; }
        else if (b === 'even') { bets.even = !bets.even; if (bets.even) bets.odd = false; }
        document.querySelectorAll('#gm-bet .gm-betopt').forEach(function (y) {
          var yb = y.getAttribute('data-b');
          var on = (yb === 'big' && bets.size === 'big') || (yb === 'small' && bets.size === 'small') ||
            (yb === 'bao' && bets.bao) || (yb === 'odd' && bets.odd) || (yb === 'even' && bets.even) ||
            (yb.indexOf('p') === 0 && bets.point === parseInt(yb.slice(1), 10));
          y.classList.toggle('on', on);
        });
        updateBetInfo();
        sfx('click');
      };
    });
    // 押单点：50 两起押；点选展开数字 1-6，再点收起并取消
    if (e.ptsT) {
      e.ptsT.onclick = function () {
        if (phase !== 0) return;
        if (e.ptsNums.style.display === 'flex') {
          e.ptsNums.style.display = 'none';
          e.ptsT.classList.remove('on');
          bets.point = 0;
          document.querySelectorAll('#gm-bet .gm-betopt.gm-pt').forEach(function (y) { y.classList.remove('on'); });
          updateBetInfo();
          sfx('click');
          return;
        }
        var amtN = parseInt(e.amt.value, 10) || 0;
        if (amtN < 50) { e.result.textContent = '荷官：「押单点数，五十两起。」'; sfx('click'); return; }
        e.ptsNums.style.display = 'flex';
        e.ptsT.classList.add('on');
        updateBetInfo();
        sfx('click');
      };
    }
    // 对决下注选择
    document.querySelectorAll('#gm-duelbet .gm-betopt').forEach(function (x) {
      x.onclick = function () {
        if (phase !== 0) return;
        duelBet = x.getAttribute('data-b');
        document.querySelectorAll('#gm-duelbet .gm-betopt').forEach(function (y) { y.classList.toggle('on', y === x); });
        sfx('click');
      };
    });
    document.querySelectorAll('#gm-modeswitch, #gm-modeswitch2').forEach(function (ms) {
      ms.onclick = function () {
        if (phase !== 0) return;
        if (e.rules) e.rules.classList.remove('hidden');
        if (e.bet) e.bet.classList.add('hidden');
        if (e.duelbet) e.duelbet.classList.add('hidden');
        if (e.duel) e.duel.classList.add('hidden');
        if (e.bowl) e.bowl.classList.remove('hidden');
        e.result.textContent = '再选玩法：经典通吃 / 江湖无豹 / 骰子对决。';
        sfx('click');
      };
    });
    e.go.onclick = function () { start(); };
    e.go2.onclick = function () { startDuel(); };
    e.skip.onclick = function () { if (RULE === 'duel') skipDuel(); else skip(); };
    e.again.onclick = function () { e.d.forEach(function (d) { d.removeAttribute('data-done'); }); resetUI(); };
    e.again2.onclick = function () { resetDuelUI(); };
    updateHistSum();
    var histHead = document.querySelector('.gm-hist-head');
    if (histHead) {
      histHead.onclick = function () {
        var l = document.getElementById('gm-hist-list');
        if (!l) return;
        var open = l.style.display === 'block';
        l.style.display = open ? 'none' : 'block';
        histHead.textContent = open ? '本桌记录 ▸' : '本桌记录 ▾';
      };
    }
    if (e.dealer) {
      e.dealer.onclick = function () {
        if (phase !== 0) { sfx('click'); return; }
        sfx('click');
        e.result.textContent = '荷官：' + DEALER_LINES[Math.floor(Math.random() * DEALER_LINES.length)];
      };
    }
    // 首局轻引导
    var seen = 0;
    try { seen = parseInt(localStorage.getItem('sanguo_gamble_seen') || '0', 10); } catch (e3) { }
    if (!seen) {
      try { localStorage.setItem('sanguo_gamble_seen', '1'); } catch (e3) { }
      e.result.textContent = '荷官：客官头回来？先选个玩法——经典通吃，三骰同面庄家通吃；江湖无豹，豹子按点数计大小。选定后再押大押小。';
      if (e.ruleTip) e.ruleTip.textContent = '首次游玩：先选玩法，再押大押小';
    }
    document.querySelectorAll('#gm-bet .gm-chip').forEach(function (q) {
      q.onclick = function () {
        if (phase !== 0) return;
        var v = q.getAttribute('data-q');
        e.amt.value = v === 'all' ? Math.max(gold(), 1) : v;
        updateBetInfo();
        sfx('click');
      };
    });
    document.querySelectorAll('#gm-duelbet .gm-chip').forEach(function (q) {
      q.onclick = function () {
        if (phase !== 0) return;
        var v = q.getAttribute('data-q');
        e.amt2.value = v === 'all' ? Math.max(gold(), 1) : v;
        sfx('click');
      };
    });
    if (e.amt) {
      e.amt.addEventListener('input', function () { updateBetInfo(); });
    }
    phase = 0;
  }

  window.LF = window.LF || {};
  window.LF.Gamble = { render: render, bind: bind, close: close };
})();

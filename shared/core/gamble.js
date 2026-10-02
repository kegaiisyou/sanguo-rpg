// 乱世烽火 · 赌坊掷骰小游戏（v20261001h Canvas 真3D投影骰子）
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

  function render() {
    return '<div class="gm-sign">快活赌坊<i>押大押小</i></div>' +
      '<p class="tip gm-sub">三骰落定：四至十为小，十一至十七为大，赔一赔一；三骰同面，庄家通吃。</p>' +
      '<div class="gm-bank"><img class="gm-silver" src="' + IMG + 'silver.png" alt="银两"><b id="gm-gold">' + gold() + '</b></div>' +
      '<div class="gm-stage">' +
      '<div class="gm-bowl" id="gm-bowl"><div class="gm-mat"></div>' +
      '<img class="gm-dealer" src="' + IMG + 'dealer.png" alt="荷官"><span class="gm-dealer-tag">荷官</span>' +
      '<img class="gm-bowl-img" src="' + IMG + 'bowl.png" alt="陶碗">' +
      '<div class="gm-hand" id="gm-hand"><img class="gm-himg gm-hc" id="gm-hc" src="' + IMG + 'hand_closed.png" alt=""><img class="gm-himg gm-ho" id="gm-ho" src="' + IMG + 'hand_open.png" alt=""></div>' +
      '<div class="gm-dice" id="gm-d1"><canvas class="gm-canvas" width="60" height="60"></canvas></div>' +
      '<div class="gm-dice" id="gm-d2"><canvas class="gm-canvas" width="60" height="60"></canvas></div>' +
      '<div class="gm-dice" id="gm-d3"><canvas class="gm-canvas" width="60" height="60"></canvas></div>' +
      '</div>' +
      '<div class="gm-result" id="gm-result">掷骰定乾坤，押大押小，落子无悔</div></div>' +
      '<div class="gm-bet">' +
      '<div class="gm-amt-row"><input id="gm-amt" class="gm-amt" type="number" min="1" max="' + Math.max(gold(), 1) + '" value="30" inputmode="numeric">' +
      '<span class="gm-chip" data-q="10">10</span><span class="gm-chip" data-q="30">30</span><span class="gm-chip" data-q="50">50</span><span class="gm-chip gm-all" data-q="all">全押</span></div>' +
      '<div class="gm-btns"><button class="btn gm-big" id="gm-big">押 大</button><button class="btn gm-small" id="gm-small">押 小</button>' +
      '<button class="btn btn-ghost gm-again hidden" id="gm-again">再来一局</button></div>' +
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
      small: document.getElementById('gm-small'), again: document.getElementById('gm-again')
    };
    return els;
  }
  var phase = 0, amt = 0, betBig = false, faces = [0, 0, 0];
  // 游戏启动即预载赌坊素材（碗/手），避免进入赌坊时卡顿
  (function () { ['bowl', 'hand_closed', 'hand_open'].forEach(function (n) { var im = new Image(); im.src = IMG + n + '.png'; }); })();

  function resetUI() {
    var e = $();
    e.hand.className = 'gm-hand';
    e.hc.style.opacity = 1; e.ho.style.opacity = 0;
    e.d.forEach(function (d) {
      d.style.display = 'none'; d.style.transform = ''; d.style.transition = 'none';
    });
    e.cvs.forEach(function (c) { if (c) { c.getContext('2d').clearRect(0, 0, 60, 60); } });
    e.result.textContent = '掷骰定乾坤，押大押小，落子无悔';
    e.result.className = 'gm-result';
    e.big.classList.remove('hidden'); e.small.classList.remove('hidden'); e.again.classList.add('hidden');
    e.amt.disabled = false;
    document.querySelectorAll('.gm-quick').forEach(function (q) { q.style.opacity = 1; });
    e.big.disabled = false; e.small.disabled = false;
    phase = 0;
  }

  function start(big) {
    var e = $(), s = state();
    if (!s) return;
    if (phase !== 0) return;
    amt = parseInt(e.amt.value, 10);
    if (!amt || amt < 1) { e.result.textContent = '荷官瞥你一眼：「空手下注，是来寻开心的？」'; return; }
    if (amt > gold()) { e.result.textContent = '荷官冷笑：「囊中银两不够，也敢上桌？」（当前 ' + gold() + '）'; return; }
    betBig = big;
    sfx('diceShake');
    if (e.gold) { e.gold.classList.remove('gm-gold-flash'); void e.gold.offsetWidth; e.gold.classList.add('gm-gold-flash'); }
    e.big.disabled = true; e.small.disabled = true; e.amt.disabled = true;
    document.querySelectorAll('.gm-quick').forEach(function (q) { q.style.opacity = .4; });
    e.result.className = 'gm-result rolling';
    e.result.textContent = betBig ? '押大 —— ' + amt + ' 两，天公作美！' : '押小 —— ' + amt + ' 两，地母开眼！';
    phase = 1;
    faces = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    e.hand.className = 'gm-hand in';
    e.hc.style.opacity = 1;
    window.setTimeout(function () {
      e.hc.style.opacity = 0; e.ho.style.opacity = 1;
      e.d.forEach(function (d) {
        d.style.display = 'block';
        d.style.transition = 'none';
        d.style.transform = 'scale(.35)';
        d.style.opacity = 1;
      });
      window.setTimeout(function () {
        e.d.forEach(function (d, i) {
          d.style.transition = 'transform .4s ease-in, opacity .3s';
          d.style.transform = 'scale(1)';
        });
        window.setTimeout(function () {
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

  function finalize() {
    var e = $(), s = state();
    phase = 3;
    var sum = faces[0] + faces[1] + faces[2];
    var bao = faces[0] === faces[1] && faces[1] === faces[2];
    var win = !bao && ((betBig && sum >= 11) || (!betBig && sum <= 10));
    var label = sum >= 11 ? '大' : '小';
    var z = function (n) { return ['零', '一', '二', '三', '四', '五', '六'][n] || n; };
    var msg;
    if (bao) { s.gold -= amt; msg = '【豹子】三骰同面（' + faces[0] + '·' + faces[1] + '·' + faces[2] + '）——庄家通吃！银两 -' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result lose'; sfx('lose'); }
    else if (win) { s.gold += amt; msg = '【' + label + '】' + z(faces[0]) + z(faces[1]) + z(faces[2]) + '，共 ' + sum + ' 点——' + (betBig ? '大' : '小') + '押中了，通吃赔付！银两 +' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result win'; sfx('win'); }
    else { s.gold -= amt; msg = '【' + label + '】' + z(faces[0]) + z(faces[1]) + z(faces[2]) + '，共 ' + sum + ' 点——庄家收骰，银两 -' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result lose'; sfx('lose'); }
    e.result.textContent = msg;
    e.gold.textContent = s.gold;
    e.big.classList.add('hidden'); e.small.classList.add('hidden'); e.again.classList.remove('hidden');
    phase = 0;
  }

  function bind() {
    var e = $();
    if (!e.big) return;
    e.big.onclick = function () { start(true); };
    e.small.onclick = function () { start(false); };
    e.again.onclick = function () { e.d.forEach(function (d) { d.removeAttribute('data-done'); }); resetUI(); };
    document.querySelectorAll('.gm-quick').forEach(function (q) {
      q.onclick = function () {
        if (phase !== 0) return;
        var v = q.getAttribute('data-q');
        e.amt.value = v === 'all' ? Math.max(gold(), 1) : v;
      };
    });
    phase = 0;
  }

  window.LF = window.LF || {};
  window.LF.Gamble = { render: render, bind: bind };
})();

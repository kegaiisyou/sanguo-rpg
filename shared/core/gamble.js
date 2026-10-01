// 乱世烽火 · 赌坊掷骰小游戏（v20261001c 水墨重绘）
// 入口：快活赌坊「押大押小」→ openModal('gamble')
// 玩法：押注银两 → 押大/押小 → 水墨手入陶碗撒骰 → 3D 骰转圈落定 → 和 4~10 小 / 11~17 大（1:1），豹子通吃
// 备忘：其余赌坊玩法见 docs/GAMBLING_ROADMAP.md
(function () {
  'use strict';
  // CSS 3D 骰子：标准相对面布局 front=1, back=6, right=3, left=4, top=2, bottom=5
  var DOT_POS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  var GP = { 1: [26, 26], 2: [50, 26], 3: [74, 26], 4: [26, 50], 5: [50, 50], 6: [74, 50], 7: [26, 74], 8: [50, 74], 9: [74, 74] };
  function faceDots(n) {
    return (DOT_POS[n] || [5]).map(function (k) {
      var p = GP[k];
      return '<i class="gm-dot" style="left:' + p[0] + '%;top:' + p[1] + '%"></i>';
    }).join('');
  }
  function diceHTML(n) { return faceDots(n); }
  var IMG = 'shared/img/gamble/';
  function state() { return (window.LF && LF.Core) ? LF.Core.state : null; }
  function gold() { var s = state(); return s ? (s.gold || 0) : 0; }

  function render() {
    return '<h3>快活赌坊 · 押大押小</h3>' +
      '<p class="tip gm-sub">三骰落定：四至十为小，十一至十七为大，赔一赔一；三骰同面，庄家通吃。</p>' +
      '<div class="gm-bank">银两 <b id="gm-gold">' + gold() + '</b></div>' +
      '<div class="gm-stage">' +
      '<div class="gm-bowl"><img class="gm-bowl-img" src="' + IMG + 'bowl.png" alt="陶碗">' +
      '<div class="gm-hand" id="gm-hand"><img class="gm-himg gm-hc" id="gm-hc" src="' + IMG + 'hand_closed.png" alt=""><img class="gm-himg gm-ho" id="gm-ho" src="' + IMG + 'hand_open.png" alt=""></div>' +
      '<div class="gm-dice" id="gm-d1"></div>' +
      '<div class="gm-dice" id="gm-d2"></div>' +
      '<div class="gm-dice" id="gm-d3"></div>' +
      '</div>' +
      '<div class="gm-result" id="gm-result">掷骰定乾坤，押大押小，落子无悔</div></div>' +
      '<div class="gm-bet">' +
      '<div class="gm-amt-row"><input id="gm-amt" class="gm-amt" type="number" min="1" max="' + Math.max(gold(), 1) + '" value="30" inputmode="numeric">' +
      '<span class="gm-quick" data-q="10">10</span><span class="gm-quick" data-q="30">30</span><span class="gm-quick" data-q="50">50</span><span class="gm-quick" data-q="all">全押</span></div>' +
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
      result: document.getElementById('gm-result'), big: document.getElementById('gm-big'),
      small: document.getElementById('gm-small'), again: document.getElementById('gm-again')
    };
    return els;
  }
  var phase = 0, amt = 0, betBig = false, faces = [0, 0, 0];

  function resetUI() {
    var e = $();
    e.hand.className = 'gm-hand';
    e.hc.style.opacity = 1; e.ho.style.opacity = 0;
    e.d.forEach(function (d) {
      d.style.display = 'none'; d.style.transform = ''; d.style.transition = 'none';

    });
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
    e.big.disabled = true; e.small.disabled = true; e.amt.disabled = true;
    document.querySelectorAll('.gm-quick').forEach(function (q) { q.style.opacity = .4; });
    e.result.className = 'gm-result rolling';
    e.result.textContent = betBig ? '押大 —— ' + amt + ' 两，天公作美！' : '押小 —— ' + amt + ' 两，地母开眼！';
    phase = 1;
    faces = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    // ① 手伸入陶碗（由上而下，越近越大）
    e.hand.className = 'gm-hand in';
    e.hc.style.opacity = 1;
    window.setTimeout(function () {
      // ② 手张开：握拳淡出、张手淡入；骰子现于掌心（小=远）
      e.hc.style.opacity = 0; e.ho.style.opacity = 1;
      e.d.forEach(function (d) {
        d.style.display = 'block';
        d.style.transition = 'none';
        d.style.transform = 'scale(.4)';
        d.style.opacity = 1;
      });
      window.setTimeout(function () {
        // ③ 骰子从掌心落到碗面：放大 + 3D 翻转（落下瞬间有立体感）
        e.d.forEach(function (d, i) {
          d.style.transition = 'transform .42s ease-in, opacity .3s';
          d.style.transform = 'scale(1) rotateZ(' + (i * 55) + 'deg)';
        });
        window.setTimeout(function () {
          // ④ 手缩回
          e.hand.className = 'gm-hand back';
          window.setTimeout(spin, 460);
        }, 440);
      }, 120);
    }, 700);
  }

  var R = 52;
  function spin() {
    var e = $();
    var stopDur = [850, 1450, 2000];
    var stAng = [0.4, 2.2, 4.0], spAng = [0.15, 2.9, 5.6];
    var spinTurns = [1.7, 2.2, 2.6];
    e.d.forEach(function (d, i) { d.style.transition = 'none'; });
    var t0 = performance.now(), done = 0;
    function frame(now) {
      var el = now - t0;
      for (var i = 0; i < 3; i++) {
        var d = e.d[i];
        if (el < stopDur[i]) {
          var k = el / stopDur[i], kk = 1 - Math.pow(1 - k, 2.2);
          var ang = stAng[i] + (spAng[i] - stAng[i]) * kk;
          var x = R * Math.cos(ang), y = R * Math.sin(ang);
          var spin = kk * spinTurns[i] * 720;
          d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(1) rotateZ(' + spin + 'deg)';
        } else if (d.getAttribute('data-done') !== '1') {
          d.setAttribute('data-done', '1');
          var a = spAng[i];
          var x = R * Math.cos(a), y = R * Math.sin(a);
          var self = d, idx = i;
          // 弹跳落定：先弹起 → 回落归位，顶面揭晓点数（IIFE 传值，防闭包 var 作用域被后续帧覆盖）
          var tx = x.toFixed(1), ty = y.toFixed(1);
          d.style.transition = 'transform .11s ease-out';
          d.style.transform = 'translate(' + tx + 'px,' + (y - 10).toFixed(1) + 'px) scale(1) rotateZ(0deg)';
          (function (fx, fy, el, face) {
            window.setTimeout(function () {
              el.style.transition = 'transform .3s cubic-bezier(.3,1.5,.4,1)';
              el.style.transform = 'translate(' + fx + 'px,' + fy + 'px) scale(1) rotateZ(0deg)';
              el.innerHTML = diceHTML(face);
            }, 115);
          })(tx, ty, self, faces[idx]);
          done++;
        }
      }
      if (done >= 3) { window.setTimeout(finalize, 380); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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
    if (bao) { s.gold -= amt; msg = '【豹子】三骰同面（' + faces[0] + '·' + faces[1] + '·' + faces[2] + '）——庄家通吃！银两 -' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result lose'; }
    else if (win) { s.gold += amt; msg = '【' + label + '】' + z(faces[0]) + z(faces[1]) + z(faces[2]) + '，共 ' + sum + ' 点——' + (betBig ? '大' : '小') + '押中了，通吃赔付！银两 +' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result win'; }
    else { s.gold -= amt; msg = '【' + label + '】' + z(faces[0]) + z(faces[1]) + z(faces[2]) + '，共 ' + sum + ' 点——庄家收骰，银两 -' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result lose'; }
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

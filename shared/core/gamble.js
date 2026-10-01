// 乱世烽火 · 赌坊掷骰小游戏（v20261001a）
// 入口：快活赌坊「押大押小」→ openModal('gamble')
// 玩法：押注银两 → 押大/押小 → 手入竹碗撒骰 → 三骰转圈落定 → 和 4~10 小 / 11~17 大（1:1），豹子通吃
// 备忘：其余赌坊玩法见 docs/GAMBLING_ROADMAP.md
(function () {
  'use strict';
  var DOTS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  var GP = { 1: [26, 26], 2: [50, 26], 3: [74, 26], 4: [26, 50], 5: [50, 50], 6: [74, 50], 7: [26, 74], 8: [50, 74], 9: [74, 74] };
  function faceHTML(n) {
    var dots = (DOTS[n] || [5]).map(function (k) {
      var p = GP[k];
      return '<i class="gm-dot" style="left:' + p[0] + '%;top:' + p[1] + '%"></i>';
    }).join('');
    return '<div class="gm-face">' + dots + '</div>';
  }
  var HAND_CLOSED = '<svg viewBox="0 0 72 92" width="72" height="92" aria-hidden="true">' +
    '<g stroke="#3a2c1c" stroke-width="3" stroke-linejoin="round" fill="#e8c39a">' +
    '<path d="M18 44 L10 46 Q4 48 6 54 L8 60 Q11 67 15 63 L18 58 Q19 61 17 66 Q16 72 21 72 L23 64 Q25 68 23 73 Q23 78 28 77 L30 68 Q32 70 30 74 Q30 79 35 77 L37 68 Q39 70 37 73 Q37 78 42 75 L44 66 Q46 68 45 61 L48 56 Q50 52 46 50 L44 48 L44 40 Q44 30 42 26 Q38 20 32 18 L28 18 Q22 20 20 26 Q18 32 18 44 Z"/>' +
    '<path d="M18 46 L16 58 Q14 62 18 60 L21 56 Z" fill="#d9a877"/>' +
    '<path d="M36 20 Q44 14 52 16 Q57 18 56 23 Q54 27 47 26 Q40 25 36 28 Z" fill="#d9a877"/>' +
    '</g></svg>';
  var HAND_OPEN = '<svg viewBox="0 0 84 92" width="84" height="92" aria-hidden="true">' +
    '<g stroke="#3a2c1c" stroke-width="3" stroke-linejoin="round" fill="#e8c39a">' +
    '<path d="M20 42 Q14 44 8 47 Q4 50 8 55 Q12 60 16 55 L19 50 Q20 56 18 62 Q17 68 22 67 L25 60 Q26 66 24 71 Q23 76 28 74 L31 66 Q32 70 30 73 Q30 78 35 75 L38 66 Q40 70 38 73 Q39 78 44 74 L46 64 Q48 68 47 62 L50 55 Q53 52 49 49 L46 46 L47 36 Q48 28 45 23 Q41 17 35 17 L30 17 Q24 20 22 26 Q20 32 20 42 Z"/>' +
    '<path d="M30 18 Q36 8 46 8 Q52 8 51 14 Q50 19 43 20 Q36 21 30 24 Z" fill="#d9a877"/>' +
    '<path d="M56 34 Q66 30 73 34 Q76 37 73 41 Q69 45 62 42 Q57 39 55 44 Z" fill="#d9a877"/>' +
    '<path d="M58 26 Q67 18 75 19 Q79 21 76 26 Q72 30 66 28 Q60 27 57 31 Z" fill="#d9a877"/>' +
    '</g></svg>';

  function state() { return (window.LF && LF.Core) ? LF.Core.state : null; }
  function gold() { var s = state(); return s ? (s.gold || 0) : 0; }

  function render() {
    return '<h3>快活赌坊 · 押大押小</h3>' +
      '<p class="tip gm-sub">三骰落定：四至十为小，十一至十七为大，赔一赔一；三骰同面，庄家通吃。</p>' +
      '<div class="gm-bank">银两 <b id="gm-gold">' + gold() + '</b></div>' +
      '<div class="gm-stage">' +
      '<div class="gm-bowl"><div class="gm-bowl-rim"></div>' +
      '<div class="gm-hand" id="gm-hand"><span class="gm-hand-c" id="gm-hand-c">' + HAND_CLOSED + '</span><span class="gm-hand-o" id="gm-hand-o">' + HAND_OPEN + '</span></div>' +
      '<div class="gm-dice" id="gm-d1"></div><div class="gm-dice" id="gm-d2"></div><div class="gm-dice" id="gm-d3"></div>' +
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
      hand: document.getElementById('gm-hand'), hc: document.getElementById('gm-hand-c'), ho: document.getElementById('gm-hand-o'),
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
    e.d.forEach(function (d) { d.style.display = 'none'; d.style.transform = ''; d.innerHTML = ''; });
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
    // 手入碗
    e.hand.className = 'gm-hand in';
    window.setTimeout(function () {
      // 手张开 + 骰子现于掌心
      e.hc.style.opacity = 0; e.ho.style.opacity = 1;
      faces = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      e.d.forEach(function (d, i) {
        d.style.display = 'block';
        d.style.transform = 'translate(0px, 0px) rotate(0deg)';
      });
      window.setTimeout(function () {
        // 骰子掉入碗心（掌心位置→碗心）
        e.d.forEach(function (d, i) {
          d.style.transition = 'transform .4s ease-in';
          d.style.transform = 'translate(0px, 52px) rotate(' + (i * 47) + 'deg)';
        });
        // 手缩回
        window.setTimeout(function () {
          e.hand.className = 'gm-hand back';
          window.setTimeout(spin, 420);
        }, 420);
      }, 80);
    }, 780);
  }

  var R = 50;
  function spin() {
    var e = $(), s = state();
    var stopDur = [900, 1500, 2050];
    var stAng = [0.4, 2.2, 4.0], spAng = [0.15, 2.9, 5.6];
    var spinTurns = [1.6, 2.1, 2.4];
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
          d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (kk * spinTurns[i] * 720) + 'deg)';
        } else if (d.getAttribute('data-done') !== '1') {
          d.setAttribute('data-done', '1');
          var a = spAng[i];
          var x = R * Math.cos(a), y = R * Math.sin(a);
          d.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(0deg)';
          d.innerHTML = faceHTML(faces[i]);
          done++;
        }
      }
      if (done >= 3) { finalize(); return; }
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
    var loss = 0;
    var label = sum >= 11 ? '大' : '小';
    var z = function (n) { return ['零', '一', '二', '三', '四', '五', '六'][n] || n; };
    var msg;
    if (bao) { loss = amt; s.gold -= amt; msg = '【豹子】三骰同面（' + faces[0] + '·' + faces[1] + '·' + faces[2] + '）——庄家通吃！银两 -' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result lose'; }
    else if (win) { s.gold += amt; msg = '【' + label + '】' + z(faces[0]) + z(faces[1]) + z(faces[2]) + '，共 ' + sum + ' 点——' + (betBig ? '大' : '小') + '押中了，通吃赔付！银两 +' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result win'; }
    else { loss = amt; s.gold -= amt; msg = '【' + label + '】' + z(faces[0]) + z(faces[1]) + z(faces[2]) + '，共 ' + sum + ' 点——庄家收骰，银两 -' + amt + '（当前 ' + s.gold + '）'; e.result.className = 'gm-result lose'; }
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

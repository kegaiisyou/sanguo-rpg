// 乱世烽火 · 捣药 v20261015a（配方驱动版）
// 古法：炮制首重净制（拣选去杂），次则合捣（孙思邈"有各捣者有合捣者"），末以筛罗成剂。
// 玩法三工序：净选(5s 点杂) → 捣研(点击式：点哪株杵砸哪株；按住=蓄力调轻重) → 成剂(配方凑齐收药)
// 药性：力量==硬度 = 100（恰好）；过重一档 70、两档 40（流失）；过轻弹起不碎。
//   点击（<150ms）= 自动力恰好硬度，新手直接点也能中；长按蓄力可追求 100 或冒流失风险。
// 配方：LF.GRIND_RX 静态表；已学存 learnedRx（初始三味）；进阶由配方卷轴习得（背包研读）。
(function (global) {
  var LF = global.LF || (global.LF = {});

  // ── 静态配方表（供背包卷轴研读与店铺挂载读取）──
  // need 按"每份"计；开炉投料 = need 各味 ×2 份
  var GRIND_RX = {
    jinchuang:   { name: '金疮药', icon: '🧪', out: 'jinchuang',  outN: 2, need: { gancao: 2, renshen: 1 },
      desc: '甘草粉×2·人参粉×1 → 疗外伤 50。止血生肌，江湖常备。' },
    xingjunsan:  { name: '行军散', icon: '💊', out: 'xingjunsan', outN: 2, need: { huanglian: 2, gancao: 1 },
      desc: '黄连粉×2·甘草粉×1 → 清湿热·回复 40。行军风餐露宿之备。' },
    xingshensan: { name: '醒神散', icon: '🌀', out: 'xingshensan', outN: 2, need: { renshen: 2, huanglian: 1 },
      desc: '人参粉×2·黄连粉×1 → 回复内力 40。久战力竭，服之内息复振。' },
    jinchuangao: { name: '金创膏', icon: '🩹', out: 'jinchuangao', outN: 1, need: { gancao: 3, renshen: 2 },
      desc: '甘草粉×3·人参粉×2 → 疗外伤 70。厚涂创口，愈合如新。', unlock: 'fang_jinchuangao' },
    xumingdan:   { name: '续命丹', icon: '🔴', out: 'xumingdan',  outN: 1, need: { renshen: 2, gancao: 2, huanglian: 2 },
      desc: '三味各 2 粉 → 续命 150。重伤濒危，含服续命。', unlock: 'fang_xumingdan' }
  };
  LF.GRIND_RX = GRIND_RX;
  LF.GRIND_RX_UNLOCK = { fang_jinchuangao: 'jinchuangao', fang_xumingdan: 'xumingdan' };

  // ── 预加载（v20261015b）：bundle 载入即预热捣药全部图片，进界面秒显、不再白屏等待 ──
  ['assets/icons/grind/mortar.png', 'assets/icons/grind/pestle.png',
   'assets/icons/grind/renshen.png', 'assets/icons/grind/gancao.png',
   'assets/icons/grind/huanglian.png'].forEach(function (u) {
    try { var _pi = new Image(); _pi.src = u; } catch (e) { }
  });

  LF.createGrinding = function (ctx) {
    var getState = ctx.getState, packAdd = ctx.packAdd, toast = ctx.toast,
        log = ctx.log, save = ctx.save, renderStatus = ctx.renderStatus;

    var HIT = 56;          // 药材命中半径（v20261017a 扩大：手机手指易点空）
    var P1 = 160, P2 = 520; // 蓄力段位
    var LIMIT = 20000;     // 捣研限时 20 秒
    var CLN_T = 5000, CLN_IMP = 4, CLN_GOOD = 2; // 净选：5 秒 · 4 杂质 + 2 好药

    var HERB_ART = {
      renshen: 'assets/icons/grind/renshen.png',
      gancao: 'assets/icons/grind/gancao.png',
      huanglian: 'assets/icons/grind/huanglian.png'
    };
    var MORTAR_ART = 'assets/icons/grind/mortar.png';
    var PESTLE_ART = 'assets/icons/grind/pestle.png';
    var HERB_HD = { renshen: 1, gancao: 2, huanglian: 3 };
    var HERB_NAME = { renshen: '人参', gancao: '甘草', huanglian: '黄连' };
    var HERB_LEAF = { renshen: '#8a9a4a', gancao: '#7f9454', huanglian: '#9a7b3f' };  // 碎片
    var HERB_PILE = { renshen: 'rgba(138,154,74,.78)', gancao: 'rgba(127,148,84,.82)', huanglian: 'rgba(154,123,63,.84)' }; // 粉堆

    function sfx(name) {
      try { if (window.SFX && window.SFX.play) window.SFX.play(name); } catch (e) { }
    }
    function buzz(ms) {
      try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
    }

    function close() {
      var ov = document.getElementById('grind-win');
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    }

    function openGrind(recipeId, opts) {
      opts = opts || {};
      var rx = GRIND_RX[recipeId];
      if (!rx) { toast('无此药方。'); return; }
      var learned = (getState().learnedRx || []);
      if (learned.indexOf(recipeId) < 0) { toast('尚未习得「' + rx.name + '」药方。'); return; }

      // 投料：need 各味 ×2 份 → 株数组
      var kinds = [];
      Object.keys(rx.need).forEach(function (k) {
        for (var i = 0; i < rx.need[k] * 2; i++) kinds.push(k);
      });
      var N = kinds.length;
      var needShown = Object.keys(rx.need).map(function (k) {
        return HERB_NAME[k] + '粉 ' + (rx.need[k] * 2);
      }).join(' · ');

      var ov = document.createElement('div');
      ov.id = 'grind-win';
      ov.className = 'grind-win';
      ov.innerHTML =
        '<div class="grind-card">' +
          '<div class="grind-title">捣 药<span class="grind-seal">捣</span></div>' +
          '<div class="grind-rx" id="gr-rxbar">' +
            '<button class="grind-rxbook" id="gr-rxbook">药方簿</button>' +
            '<div class="grind-rxinfo">' +
              '<b id="gr-rxname">' + rx.icon + ' ' + rx.name + '</b>' +
              '<span id="gr-rxneed">' + needShown + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="grind-sub" id="gr-sub"></div>' +
          '<div class="grind-time" id="gr-timewrap"><div class="grind-timebar" id="gr-timebar"></div><span id="gr-time"></span></div>' +
          '<div class="grind-mortar" id="gr-mortar">' +
            '<div class="grind-ring" id="gr-ring"></div>' +
            '<div class="grind-ripple" id="gr-ripple"></div>' +
            '<div class="grind-stick" id="gr-stick"><img src="' + PESTLE_ART + '" alt=""></div>' +
          '</div>' +
          '<div class="grind-hud">' +
            '<span>药性 <b id="gr-keep">100%</b></span>' +
            '<span>捣碎 <b id="gr-cov">0/' + N + '</b></span>' +
            '<span>时间 <b id="gr-tl">20</b></span>' +
          '</div>' +
          '<div class="grind-acts">' +
            '<button class="btn grind-done" id="gr-done">收 手</button>' +
          '</div>' +
          '<div class="grind-result" id="gr-result" hidden></div>' +
          '<div class="grind-tut" id="gr-tut" hidden></div>' +
          '<div class="grind-tip" id="gr-tip">点击杂质挑出 · 点到好药会误伤药性</div>' +
        '</div>';
      document.body.appendChild(ov);

      var mortar = ov.querySelector('#gr-mortar');
      var stick = ov.querySelector('#gr-stick');
      var $sub = ov.querySelector('#gr-sub');
      var $rxneed = ov.querySelector('#gr-rxneed');
      var $cov = ov.querySelector('#gr-cov');
      var $keep = ov.querySelector('#gr-keep');
      var $tl = ov.querySelector('#gr-tl');
      var $ripple = ov.querySelector('#gr-ripple');
      var $ring = ov.querySelector('#gr-ring');
      var $timebar = ov.querySelector('#gr-timebar');
      var $time = ov.querySelector('#gr-time');
      var $tip = ov.querySelector('#gr-tip');
      var $done = ov.querySelector('#gr-done');
      var $result = ov.querySelector('#gr-result');
      var $tut = ov.querySelector('#gr-tut');
      var $rxbook = ov.querySelector('#gr-rxbook');
      // v20261017a：分步引导（首局显示，结束后存档标记不再打扰）
      var tutTimer = null;
      function tut(text, ms) {
        if ((getState().flags || {}).grindTutDone) return;
        $tut.textContent = text;
        $tut.hidden = false;
        $tut.classList.add('show');
        if (tutTimer) clearTimeout(tutTimer);
        tutTimer = setTimeout(function () {
          $tut.classList.remove('show');
          setTimeout(function () { $tut.hidden = true; }, 350);
        }, ms || 4200);
      }

      var R = mortar.clientWidth / 2 || 140;
      // v20261015d：俯视臼圆心=容器中心(R)，修正 CY 少乘半径导致药材整体偏上飘出臼口
      var CY = R, RX = R * 0.52, RY = R * 0.52;

      // ── 捣研药材：配方投料，约束在臼窝口内 ──
      var pieces = [];
      for (var i = 0; i < N; i++) {
        var kind = kinds[i];
        var a = Math.random() * Math.PI * 2;
        var r = Math.sqrt(Math.random());
        var x = R + Math.cos(a) * r * RX;
        var y = CY + Math.sin(a) * r * RY;
        var el = document.createElement('div');
        el.className = 'grind-herb';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        var im = document.createElement('img');
        im.className = 'grind-herb-img';
        im.src = HERB_ART[kind];
        im.alt = '';
        im.onload = function () { this.classList.add('loaded'); };
        el.appendChild(im);
        var hdEl = document.createElement('span');
        hdEl.className = 'grind-hd';
        for (var k = 0; k < HERB_HD[kind]; k++) hdEl.appendChild(document.createElement('i'));
        el.appendChild(hdEl);
        mortar.appendChild(el);
        pieces.push({ el: el, kind: kind, x: x, y: y, broken: false, hd: HERB_HD[kind] });
      }

      // ── 净选：捣前 5 秒，臼上漂浮 4 杂质 + 2 好药（好药取配方所需）──
      var phase = 'clean', cleanGood = 0, cleanBad = 0, cleanLeft = CLN_IMP, cleanTimer = null, cleanT = CLN_T;
      var cleanPieces = [];
      function makeClean() {
        var types = [];
        var impKinds = ['stone', 'dirt', 'leaf', 'rock'];
        for (var ci = 0; ci < CLN_IMP; ci++) types.push({ t: 'imp', kind: impKinds[ci] });
        var gk = Object.keys(rx.need);
        for (var gj = 0; gj < CLN_GOOD; gj++) types.push({ t: 'good', kind: gk[gj % gk.length] });
        for (var si = types.length - 1; si > 0; si--) {
          var r2 = Math.floor(Math.random() * (si + 1)), tmp = types[si]; types[si] = types[r2]; types[r2] = tmp;
        }
        for (var qi = 0; qi < types.length; qi++) {
          var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
          var x = R + Math.cos(a) * rr * RX * 1.08, y = CY + Math.sin(a) * rr * RY * 1.08;
          var el = document.createElement('div');
          el.className = 'grind-cln grind-cln-' + (types[qi].t === 'imp' ? types[qi].kind : 'good');
          el.style.left = x + 'px';
          el.style.top = y + 'px';
          if (types[qi].t === 'good') {
            var im = document.createElement('img');
            im.className = 'grind-herb-img';
            im.src = HERB_ART[types[qi].kind];
            im.alt = '';
            im.onload = function () { this.classList.add('loaded'); };
            el.appendChild(im);
          } else {
            el.appendChild(document.createElement('span'));
          }
          mortar.appendChild(el);
          cleanPieces.push({ el: el, x: x, y: y, t: types[qi].t, gone: false, mover: null });
        }
        for (var bi2 = 0; bi2 < cleanPieces.length; bi2++) (function (p) {
          p.mover = setInterval(function () {
            if (p.gone) return;
            p.x = Math.max(R - RX * 1.08, Math.min(R + RX * 1.08, p.x + (Math.random() - 0.5) * 8));
            p.y = Math.max(CY - RY * 1.08, Math.min(CY + RY * 1.08, p.y + (Math.random() - 0.5) * 3));
            p.el.style.left = p.x + 'px';
            p.el.style.top = p.y + 'px';
          }, 300);
        })(cleanPieces[bi2]);
      }
      function inkBurst(x, y, color) {
        // v20261015e：点击碎裂成小墨点飞散
        for (var i = 0; i < 6; i++) {
          var d = document.createElement('div');
          d.className = 'grind-ink';
          var ang = Math.random() * Math.PI * 2, dist = 14 + Math.random() * 22;
          d.style.left = x + 'px';
          d.style.top = y + 'px';
          d.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
          d.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
          d.style.background = color;
          d.style.width = (4 + Math.random() * 5) + 'px';
          d.style.height = d.style.width;
          mortar.appendChild(d);
          (function (e) { setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 430); })(d);
        }
      }
      function cleanTap(px, py) {
        for (var i = 0; i < cleanPieces.length; i++) {
          var p = cleanPieces[i];
          if (p.gone) continue;
          var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
          if (d <= 36) {
            p.gone = true;
            if (p.mover) clearInterval(p.mover);
            var el = p.el;
            el.classList.add(p.t === 'imp' ? 'cln-out' : 'cln-err');
            (function (el2) { setTimeout(function () { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 230); })(el);
            if (p.t === 'imp') {
              cleanGood++; cleanLeft--;
              sfx('hit'); buzz(12);
              inkBurst(p.x, p.y, 'rgba(70,58,40,.85)');
              floatText(p.x, p.y - 6, '挑出', '#3f8f5f');
            } else {
              cleanBad++;
              sfx('error'); buzz(25);
              inkBurst(p.x, p.y, 'rgba(138,122,90,.9)');
              floatText(p.x, p.y - 6, '误伤 -30', '#b0452f');
            }
            return;
          }
        }
      }
      function startGrindPhase(force) {
        if (phase !== 'clean' && !force) return;
        phase = 'grind';
        if (cleanTimer) clearInterval(cleanTimer);
        for (var i = 0; i < cleanPieces.length; i++) {
          if (cleanPieces[i].mover) clearInterval(cleanPieces[i].mover);
          if (cleanPieces[i].el.parentNode) cleanPieces[i].el.parentNode.removeChild(cleanPieces[i].el);
        }
        cleanPieces = [];
        $timebar.classList.remove('cln');
        $sub.textContent = rx.icon + ' ' + rx.name + ' · ' + needShown + '（20 秒内捣成粉）';
        $tip.textContent = '点哪株砸哪株：轻点=恰好力道；按住蓄力可加重（过重会流失药性）';
        $time.textContent = '20';
        tut('捣研：点哪株砸哪株；轻点＝恰好力道，按住蓄力可加重', 4600);
        startTimer();
      }
      function startClean() {
        makeClean();
        $sub.textContent = '净制挑杂 · 挑出杂质，勿误伤好药（5 秒）';
        tut('净选：点掉 4 颗杂质，别点好药（会误伤药性）', 4600);
        $timebar.classList.add('cln');
        $time.textContent = '5.0';
        $timebar.style.width = '100%';
        cleanT = CLN_T;
        cleanTimer = setInterval(function () {
          if (done) return;
          cleanT -= 100;
          if (cleanT < 0) cleanT = 0;
          $timebar.style.width = (cleanT / CLN_T * 100) + '%';
          $time.textContent = (cleanT / 1000).toFixed(1);
          if (cleanT <= 0 || cleanLeft <= 0) startGrindPhase();
        }, 100);
      }

      // ── 捣研 ──
      var broken = 0, done = false, keepSum = 0;
      var cnt = {};          // 各味已碎粉计数
      Object.keys(rx.need).forEach(function (k) { cnt[k] = 0; });
      var pileSum = 0;
      var aiming = false, downT = 0, liftT = 0, liftTimer = null, target = null, downPt = null;
      var timer = null, timeLeft = LIMIT;

      function powerUi(p, hd) {
        // v20261017a：环语义化——未到=淡墨渐扩；恰好=淡青；过重=朱砂脉动
        var cls = 'grind-ring';
        if (p > 0) {
          cls += ' on' + p;
          if (hd && p > hd) cls += ' over';
          else if (hd && p === hd) cls += ' ok';
        }
        $ring.className = cls;
      }
      function hud() {
        $cov.textContent = broken + '/' + N;
        $keep.textContent = Math.round(keepSum / (N * 100) * 100) + '%';
      }
      function floatText(x, y, txt, color) {
        var d = document.createElement('div');
        d.className = 'grind-num';
        d.style.left = x + 'px';
        d.style.top = y + 'px';
        d.style.color = color;
        d.textContent = txt;
        mortar.appendChild(d);
        (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900); })(d);
      }
      function powerOf(t) { return t < P1 ? 1 : (t < P2 ? 2 : 3); }
      function stickLift(x, y, hd) {
        var cx = R, cy = CY, maxX = R * 0.78, maxY = R * 0.62;
        var dx = Math.max(-maxX, Math.min(maxX, x - cx));
        var dy = Math.max(-maxY, Math.min(maxY, y - cy));
        var p = powerOf(liftT);
        var lift = [26, 52, 78][p - 1];
        stick.classList.remove('fall', 'bounce', 'back');
        stick.style.transform = 'translate(' + dx + 'px,' + (dy - lift) + 'px) rotate(0deg)';
        powerUi(p, hd);
      }
      function impact() {
        mortar.classList.add('sink');
        setTimeout(function () { mortar.classList.remove('sink'); }, 110);
        mortar.classList.remove('shake');
        void mortar.offsetWidth;
        mortar.classList.add('shake');
        $ripple.classList.remove('burst');
        void $ripple.offsetWidth;
        $ripple.classList.add('burst');
      }
      function explode(p, keep) {
        var cx = p.x, cy = p.y;
        var leaf = HERB_LEAF[p.kind] || '#9a7b3f';
        p.el.classList.add('crush');
        var im = p.el.querySelector('.grind-herb-img');
        if (im) im.style.opacity = '.25';
        setTimeout(function () {
          if (!p.el.parentNode) return;
          p.el.parentNode.removeChild(p.el);
          var n = 8 + Math.floor(Math.random() * 3);
          for (var i = 0; i < n; i++) {
            var f = document.createElement('div');
            f.className = 'grind-frag';
            f.style.left = cx + 'px';
            f.style.top = cy + 'px';
            f.style.background = leaf;
            var dx = (Math.random() - 0.5) * 90, dy = -(20 + Math.random() * 55);
            f.style.setProperty('--dx', dx + 'px');
            f.style.setProperty('--dy', dy + 'px');
            mortar.appendChild(f);
            (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 430); })(f);
          }
          // 粉堆留在臼里（成剂原料，看得见的进度）
          var pl = document.createElement('div');
          pl.className = 'grind-pile';
          pl.style.left = cx + 'px';
          pl.style.top = cy + 'px';
          pl.style.background = HERB_PILE[p.kind];
          mortar.appendChild(pl);
        }, 60);
      }
      function rxUi() {
        var parts = Object.keys(rx.need).map(function (k) {
          return HERB_NAME[k] + '粉 ' + cnt[k] + '/' + (rx.need[k] * 2);
        });
        $rxneed.textContent = parts.join(' · ');
      }
      function checkMake() {
        if (broken >= N) {
          // v20261017a：合并按钮——底部按钮变"成 剂"高亮
          $done.textContent = '成 剂';
          $done.classList.add('on');
          $tip.textContent = '药粉齐备，点「成 剂」收药！';
          sfx('confirm');
          tut('药粉齐备，点下方「成 剂」收药！', 3200);
        }
      }

      // 砸下判定：锁定目标株（点击哪株砸哪株）
      function strike(px, power) {
        if (!target) return;
        var h = target;
        target = null;
        if (h.broken) return;
        var keep;
        if (power >= h.hd) {
          keep = (power === h.hd) ? 100 : Math.max(40, 100 - (power - h.hd) * 30);
          h.broken = true;
          broken++;
          explode(h, keep);
          keepSum += keep;
          cnt[h.kind]++;
          rxUi();
          floatText(h.x, h.y - 10, '+' + keep, keep >= 100 ? '#3f8f5f' : (keep >= 70 ? '#d9a13a' : '#b0452f'));
          if (keep === 100) { sfx('heal'); buzz(10); }          // 恰好：清亮"叮"
          else {
            sfx('error'); buzz(30);                              // 过重：沉闷"咚"
            inkBurst(h.x, h.y, HERB_PILE[h.kind]);               // 流失可视化：药粉溅出墨点
          }
        } else {
          // 过轻：药材弹起
          h.el.classList.remove('jolt');
          void h.el.offsetWidth;
          h.el.classList.add('jolt');
          floatText(h.x, h.y - 10, '太轻', '#9aa0a6');
          sfx('miss');
        }
        impact();
        hud();
        if (broken >= N) {
          setTimeout(function () { if (!done) checkMake(); }, 260);
        }
      }
      function stickStrike(px, py, power) {
        var cx = R, cy = CY, maxX = R * 0.78, maxY = R * 0.62;
        var dx = Math.max(-maxX, Math.min(maxX, px - cx));
        var dy = Math.max(-maxY, Math.min(maxY, py - cy));
        stick.classList.remove('back');
        stick.classList.add('fall');
        stick.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg)';
        setTimeout(function () {
          stick.classList.remove('fall');
          stick.classList.add('bounce');
          stick.style.transform = 'translate(' + dx + 'px,' + (dy - 10) + 'px) rotate(0deg)';
          setTimeout(function () {
            stick.classList.remove('bounce');
            stick.classList.add('back');
            stick.style.transform = 'translate(0,0) rotate(0deg)';
          }, 90);
        }, 130);
      }

      function settle(mode) {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        // 结算：净制加成 + 药性保持
        var keepPct = keepSum / (N * 100);
        var cleanPct = cleanGood / CLN_IMP;
        var keepAdj = (cleanPct >= 0.75 ? 0.05 : (cleanPct < 0.5 ? -0.05 : 0)) - cleanBad * 0.025;
        var keepFinal = Math.max(0, Math.min(1, keepPct + keepAdj));
        var good = mode === 'done' && broken >= N && keepFinal >= 0.85;
        var covPct = broken / N;
        // v20261017a：部分成功——全碎=满产；碎≥80%=普通1份；否则一无所获
        var got = 0, plain = false;
        if (broken >= N) { got = rx.outN; plain = !good; }
        else if (covPct >= 0.8) { got = 1; plain = true; }
        var outDef = plain && LF.ITEMS[rx.out + '_p'] ? rx.out + '_p' : rx.out;
        if (got > 0) packAdd(outDef, got);
        var line = '〔捣药〕' + rx.name + (good ? '（良品）' : (plain ? '（普通）' : '')) + ' ×' + got +
          '（覆盖' + Math.round(covPct * 100) + '%，药性' + Math.round(keepFinal * 100) + '%，净制' + cleanGood + '/' + CLN_IMP + '）';
        if (log) log(line, good ? 'good' : (got > 0 ? 'sys' : 'warn'));
        if (save) save(getState());
        if (renderStatus) renderStatus();
        // v20261017a：结算结果卡（产出+良/普说明+再来一炉），收药浮起动效
        var def = LF.ITEMS[outDef] || {};
        var effTxt = '';
        if (def.effect) {
          effTxt = Object.keys(def.effect).map(function (k) {
            return (k === 'hp' ? '疗' : k === 'mp' ? '回内力' : k) + ' ' + def.effect[k];
          }).join(' · ');
        }
        var head = good ? '良品' : (plain ? '普通' : '未成');
        var sub = good ? '药性圆满，功效尽显' :
          (plain ? '药性略逊，功效打折' : '药粉未成，一无所获……');
        $result.innerHTML =
          '<div class="grind-res-head ' + (good ? 'g' : plain ? 'p' : 'f') + '">' + head + '</div>' +
          '<div class="grind-res-line">' + (got > 0 ? rx.icon + ' ' + rx.name + ' ×' + got + '（' + effTxt + '）' : sub) + '</div>' +
          '<div class="grind-res-sub">' + sub + '</div>' +
          '<div class="grind-res-acts">' +
            '<button class="btn grind-again" id="gr-again">再来一炉</button>' +
            '<button class="btn-ghost" id="gr-close">收 工</button>' +
          '</div>';
        $result.hidden = false;
        $result.classList.add('pop');
        $done.hidden = true;
        $result.querySelector('#gr-again').onclick = function () {
          $result.hidden = true;
          close();
          openGrind(recipeId, { skipClean: true });
        };
        $result.querySelector('#gr-close').onclick = function () { close(); };
        // 首局引导完成标记
        try {
          var st = getState();
          if (!(st.flags || {}).grindTutDone) {
            st.flags = st.flags || {};
            st.flags.grindTutDone = true;
            if (save) save(getState());
          }
        } catch (e) { }
        if (got > 0) toast('收得 ' + rx.name + (good ? '（良品）' : '（普通）') + ' ×' + got);
        else toast('药粉未成，一无所获……');
      }

      function startTimer() {
        timer = setInterval(function () {
          if (done) return;
          timeLeft -= 100;
          if (timeLeft < 0) timeLeft = 0;
          $timebar.style.width = (timeLeft / LIMIT * 100) + '%';
          $timebar.classList.toggle('low', timeLeft / LIMIT <= 0.25);
          $time.textContent = (timeLeft / 1000).toFixed(1);
          $tl.textContent = Math.ceil(timeLeft / 1000);
          if (timeLeft <= 0) {
            if (broken >= N) {
              $tip.textContent = '药粉齐备，点「成 剂」收药！';
              checkMake();
            } else {
              toast('火候已过，药性散尽……');
              settle('timeout');
            }
          }
        }, 100);
      }

      function onDown(e) {
        if (done) return;
        e.preventDefault();
        var rect = mortar.getBoundingClientRect();
        var px = e.clientX - rect.left, py = e.clientY - rect.top;
        if (phase === 'clean') { cleanTap(px, py); return; }
        // 点击式：找最近未碎株锁定
        var best = null, bd = HIT;
        for (var i = 0; i < pieces.length; i++) {
          var p = pieces[i];
          if (p.broken) continue;
          var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
          if (d <= bd) { bd = d; best = p; }
        }
        if (!best) {
          // v20261017a：点空反馈——臼沿轻闪
          mortar.classList.remove('miss');
          void mortar.offsetWidth;
          mortar.classList.add('miss');
          sfx('click');
          return;
        }
        target = best;
        aiming = true;
        downT = Date.now();
        liftT = 0;
        downPt = { x: px, y: py };
        stickLift(best.x, best.y, best.hd);
        if (liftTimer) clearInterval(liftTimer);
        liftTimer = setInterval(function () {
          if (!aiming) return;
          liftT = Date.now() - downT;
          stickLift(best.x, best.y, best.hd);
        }, 100);
      }
      function cancelAim() {
        // v20261017a：滑出臼区取消砸击（防误砸）
        aiming = false;
        if (liftTimer) { clearInterval(liftTimer); liftTimer = null; }
        target = null;
        stick.classList.remove('fall', 'bounce', 'back');
        stick.style.transform = 'translate(0,0) rotate(0deg)';
        powerUi(0);
      }
      function onUp(e) {
        if (!aiming || done) return;
        aiming = false;
        if (liftTimer) { clearInterval(liftTimer); liftTimer = null; }
        var hold = Date.now() - downT;
        var power = hold < 150 ? (target ? target.hd : 2) : powerOf(hold); // 轻点=自动力恰好硬度
        var tx = target ? target.x : R, ty = target ? target.y : CY;
        stickStrike(tx, ty, power);
        strike(tx, power);
      }

      ov.querySelector('#gr-done').onclick = function () {
        // v20261017a：单按钮——净选=跳过净选；碎完=成剂；否则收手放弃
        if (phase === 'clean') { startGrindPhase(true); return; }
        if (broken >= N) { settle('done'); return; }
        settle('quit');
      };
      $rxbook.onclick = function () { openRxBook(recipeId); };
      mortar.addEventListener('pointerdown', onDown);
      mortar.addEventListener('pointerup', onUp);
      mortar.addEventListener('pointercancel', onUp);
      mortar.addEventListener('pointermove', function (e) {
        // v20261017a：蓄力中滑出臼区 → 取消砸击
        if (!aiming || !downPt) return;
        var rect = mortar.getBoundingClientRect();
        var dx = (e.clientX - rect.left) - downPt.x, dy = (e.clientY - rect.top) - downPt.y;
        if (Math.sqrt(dx * dx + dy * dy) > 70) cancelAim();
      });
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

      hud();
      powerUi(0);
      if (opts && opts.skipClean) {
        // v20261017a：再来一炉——跳过净选直接捣研
        phase = 'grind';
        startGrindPhase(true);
      } else {
        startClean();
      }
    }

    // ── 药方簿：已学可切换 / 未学灰显（药铺有售）──
    function openRxBook(cur) {
      var old = document.getElementById('grind-rxbook-win');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var learned = (getState().learnedRx || []);
      var ov = document.createElement('div');
      ov.id = 'grind-rxbook-win';
      ov.className = 'grind-rxbook-win';
      var rows = '';
      Object.keys(GRIND_RX).forEach(function (rid) {
        var r = GRIND_RX[rid];
        var has = learned.indexOf(rid) >= 0;
        rows += '<div class="rxb-row' + (has ? '' : ' lock') + (rid === cur ? ' cur' : '') + '" data-rid="' + rid + '">' +
          '<span class="rxb-ic">' + r.icon + '</span>' +
          '<div class="rxb-info"><b>' + r.name + '</b><span>' + (has ? r.desc : '未习得 · 药铺有售') + '</span></div>' +
          (has ? '<button class="rxb-use">用此方</button>' : '<span class="rxb-lock">🔒</span>') +
        '</div>';
      });
      ov.innerHTML =
        '<div class="grind-rxbook-card">' +
          '<div class="grind-title">药方簿<span class="grind-seal">方</span></div>' +
          '<div class="rxb-list">' + rows + '</div>' +
          '<div class="grind-acts"><button class="btn" data-close="1">关 闭</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      ov.querySelectorAll('.rxb-use').forEach(function (b) {
        b.onclick = function () {
          var rid = b.closest('.rxb-row').getAttribute('data-rid');
          close();
          ov.parentNode && ov.parentNode.removeChild(ov);
          openGrind(rid);
        };
      });
      ov.querySelector('[data-close="1"]').onclick = function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
      };
      ov.addEventListener('click', function (e) { if (e.target === ov) { if (ov.parentNode) ov.parentNode.removeChild(ov); } });
    }

    return { openGrind: openGrind, closeGrind: close, openRxBook: openRxBook };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createGrinding;
})(typeof window !== 'undefined' ? window : this);

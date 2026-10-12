// 乱世烽火 · 捣药 v20261012a（合捣版）
// 古法：丸散"有各捣者，有合捣者"，过筛后更合于臼中共捣数百过，视其色理和同为佳。
// 玩法：单味各捣 / 三味混捣；按住=举杵瞄准（横移+蓄力轻中重），松手=弧线自由落体砸下+反震；
//       力量≥硬度才碎；力量过重则药性流失（精准匹配=100药性，重一档70，重两档40）；
//       连击5杵速加快、8落点扩大、10药香满溢+3秒；特殊药材：金药+2药末/顽石耐捣/药虫游走；
//       20秒限时，限时内捣完按覆盖/药性保持/共鸣评级，超时凡品药性流失。
(function (global) {
  var LF = global.LF || (global.LF = {});

  LF.createGrinding = function (ctx) {
    var getState = ctx.getState, packAdd = ctx.packAdd, toast = ctx.toast,
        log = ctx.log, save = ctx.save, renderStatus = ctx.renderStatus;

    var N = 12;          // 药材块数
    var HIT = 50;        // 基础命中半径（px）
    var SPILL_R = 0.72;  // 臼沿判定半径比例
    var CW = 5000;       // 连击窗口
    var P1 = 160, P2 = 520;  // 蓄力段位切换
    var LIMIT = 20000;   // 限时 20 秒
    var MIX = [['renshen', 4], ['gancao', 4], ['huanglian', 4]]; // 混捣·三味

    // 水墨资产
    var HERB_ART = {
      caoyao: 'assets/icons/items48/caoyao.png',
      renshen: 'assets/icons/grind/renshen.png',
      gancao: 'assets/icons/grind/gancao.png',
      huanglian: 'assets/icons/grind/huanglian.png'
    };
    var MORTAR_ART = 'assets/icons/grind/mortar.png';
    var PESTLE_ART = 'assets/icons/grind/pestle.png';
    var HERB_HD = { caoyao: 1, renshen: 1, gancao: 2, huanglian: 3 };
    var HERB_NAME = { caoyao: '草药', renshen: '人参', gancao: '甘草', huanglian: '黄连' };
    var HERB_ICON = { caoyao: '🌿', renshen: '🌱', gancao: '🌾', huanglian: '🌸' };
    var HERB_LEAF = { caoyao: '#7d8f5a', renshen: '#8a9a4a', gancao: '#7f9454', huanglian: '#9a7b3f' }; // 碎片主色

    var TIERS = [
      { q: 1, name: '凡品', color: 'var(--ink-soft)' },
      { q: 2, name: '良品', color: 'var(--gold)' },
      { q: 3, name: '珍品', color: 'var(--seal)' }
    ];

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

    function openGrind(herbId, opts) {
      herbId = herbId || 'caoyao';
      opts = opts || {};
      close();

      var mix = (herbId === 'mix');
      var kinds = [];
      if (mix) {
        for (var mi = 0; mi < MIX.length; mi++)
          for (var mc = 0; mc < MIX[mi][1]; mc++) kinds.push(MIX[mi][0]);
      } else {
        for (var sc = 0; sc < N; sc++) kinds.push(herbId);
      }
      var subGrind = mix ? '人参·甘草·黄连 合捣 · 20 秒内全部捣成粉'
                    : (HERB_ICON[herbId] + ' ' + HERB_NAME[herbId] + ' 各捣 · 20 秒内全部捣成粉');
      var sub = '净制挑杂 · 挑出杂质，勿误伤好药（5 秒）';

      var ov = document.createElement('div');
      ov.id = 'grind-win';
      ov.className = 'grind-win';
      ov.innerHTML =
        '<div class="grind-card">' +
          '<div class="grind-title">捣 药<span class="grind-seal">捣</span></div>' +
          '<div class="grind-sub">' + sub + '</div>' +
          '<div class="grind-time" id="gr-timewrap"><div class="grind-timebar" id="gr-timebar"></div><span id="gr-time">20</span></div>' +
          '<div class="grind-mortar" id="gr-mortar">' +
            '<div class="grind-ripple" id="gr-ripple"></div>' +
            '<div class="grind-stick" id="gr-stick"><img src="' + PESTLE_ART + '" alt=""></div>' +
          '</div>' +
          '<div class="grind-power" id="gr-power"><i></i><i></i><i></i></div>' +
          '<div class="grind-hud">' +
            '<span>捣碎 <b id="gr-cov">0/' + N + '</b></span>' +
            '<span>药性 <b id="gr-keep">100%</b></span>' +
            '<span>共鸣 <b id="gr-combo">0</b></span>' +
            '<span>溅出 <b id="gr-spill">0</b></span>' +
          '</div>' +
          '<div class="grind-acts">' +
            '<button class="btn" id="gr-done">收 手</button>' +
            '<button class="btn-ghost" id="gr-auto">自动捣</button>' +
          '</div>' +
          '<div class="grind-tip" id="gr-tip">点击杂质挑出 · 点到好药会误伤药性</div>' +
        '</div>';
      document.body.appendChild(ov);

      var mortar = ov.querySelector('#gr-mortar');
      var stick = ov.querySelector('#gr-stick');
      var $sub = ov.querySelector('.grind-sub');
      var $cov = ov.querySelector('#gr-cov');
      var $keep = ov.querySelector('#gr-keep');
      var $combo = ov.querySelector('#gr-combo');
      var $spill = ov.querySelector('#gr-spill');
      var $ripple = ov.querySelector('#gr-ripple');
      var $power = ov.querySelectorAll('#gr-power i');
      var $timebar = ov.querySelector('#gr-timebar');
      var $time = ov.querySelector('#gr-time');
      var $tip = ov.querySelector('#gr-tip');

      // 药材：约束在臼窝口内（窝口视觉中心偏上 CY≈0.62R，椭圆带 rx0.34 / ry0.12）
      var R = mortar.clientWidth / 2 || 140;
      var CY = R * 0.62, RX = R * 0.42, RY = R * 0.16;
      var specials = { gold: 0.10, stone: 0.10, bug: 0.10 };
      var spUsed = {};
      function rollSpecial() {
        for (var k in specials) {
          if (!spUsed[k] && Math.random() < specials[k]) { spUsed[k] = true; return k; }
        }
        return null;
      }
      var pieces = [];
      for (var i = 0; i < N; i++) {
        var kind = kinds[i];
        var a = Math.random() * Math.PI * 2;
        var r = Math.sqrt(Math.random());
        var x = R + Math.cos(a) * r * RX;
        var y = CY + Math.sin(a) * r * RY;
        var sp = rollSpecial();
        var el = document.createElement('div');
        el.className = 'grind-herb' + (sp ? (' grind-sp-' + sp) : '');
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        if (sp === 'stone' || sp === 'bug') {
          el.appendChild(document.createElement('span')); // 顽石/药虫本体由 CSS 绘制
        } else {
          var im = document.createElement('img');
          im.className = 'grind-herb-img';
          im.src = HERB_ART[kind];
          im.alt = '';
          el.appendChild(im);
        }
        var hdEl = document.createElement('span');
        hdEl.className = 'grind-hd';
        var hd = sp === 'stone' ? 4 : (sp === 'gold' ? 3 : HERB_HD[kind]);
        for (var k = 0; k < hd; k++) hdEl.appendChild(document.createElement('i'));
        el.appendChild(hdEl);
        mortar.appendChild(el);
        pieces.push({
          el: el, kind: kind, x: x, y: y, broken: false,
          hd: hd, potency: (sp === 'stone' ? 50 : 100),
          special: sp, hp: (sp === 'stone' ? 2 : 1), mover: null
        });
      }
      // 药虫游走（窝口内缓慢爬行）
      for (var bi = 0; bi < pieces.length; bi++) {
        (function (p) {
          if (p.special !== 'bug') return;
          p.mover = setInterval(function () {
            if (p.broken || done) return;
            p.x = Math.max(R - RX, Math.min(R + RX, p.x + (Math.random() - 0.5) * 14));
            p.y = Math.max(CY - RY, Math.min(CY + RY, p.y + (Math.random() - 0.5) * 6));
            p.el.style.left = p.x + 'px';
            p.el.style.top = p.y + 'px';
          }, 240);
        })(pieces[bi]);
      }

      // 净制挑杂（鬼谷八荒式）：捣前 5 秒，臼上漂浮 4 杂质 + 2 好药，点杂挑出/点好药误伤
      var CLN_T = 5000, CLN_IMP = 4, CLN_GOOD = 2;
      var phase = 'clean', cleanGood = 0, cleanBad = 0, cleanLeft = CLN_IMP, cleanTimer = null, cleanT = CLN_T;
      var cleanPieces = [];
      function makeClean() {
        var types = [];
        var impKinds = ['stone', 'dirt', 'leaf', 'rock'];
        for (var ci = 0; ci < CLN_IMP; ci++) types.push({ t: 'imp', kind: impKinds[ci] });
        var gk = [];
        if (mix) gk = ['renshen', 'gancao', 'huanglian'];
        else for (var gi = 0; gi < CLN_GOOD; gi++) gk.push(herbId);
        for (var gj = 0; gj < CLN_GOOD; gj++) types.push({ t: 'good', kind: gk[gj] });
        for (var si = types.length - 1; si > 0; si--) {
          var r = Math.floor(Math.random() * (si + 1)), tmp = types[si]; types[si] = types[r]; types[r] = tmp;
        }
        for (var qi = 0; qi < types.length; qi++) {
          var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
          var x = R + Math.cos(a) * rr * RX * 1.25, y = CY - 6 + Math.sin(a) * rr * RY * 2.2;
          var el = document.createElement('div');
          el.className = 'grind-cln grind-cln-' + (types[qi].t === 'imp' ? types[qi].kind : 'good');
          el.style.left = x + 'px';
          el.style.top = y + 'px';
          if (types[qi].t === 'good') {
            var im = document.createElement('img');
            im.className = 'grind-herb-img';
            im.src = HERB_ART[types[qi].kind];
            im.alt = '';
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
            p.x = Math.max(R - RX * 1.25, Math.min(R + RX * 1.25, p.x + (Math.random() - 0.5) * 8));
            p.y = Math.max(CY - 6 - RY * 2.2, Math.min(CY - 6 + RY * 2.2, p.y + (Math.random() - 0.5) * 3));
            p.el.style.left = p.x + 'px';
            p.el.style.top = p.y + 'px';
          }, 300);
        })(cleanPieces[bi2]);
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
              floatText(p.x, p.y - 6, '挑出', '#3f8f5f');
            } else {
              cleanBad++;
              sfx('error'); buzz(25);
              floatText(p.x, p.y - 6, '误伤 -30', '#b0452f');
            }
            return;
          }
        }
      }
      function startGrindPhase() {
        if (phase !== 'clean') return;
        phase = 'grind';
        if (cleanTimer) clearInterval(cleanTimer);
        for (var i = 0; i < cleanPieces.length; i++) {
          if (cleanPieces[i].mover) clearInterval(cleanPieces[i].mover);
          if (cleanPieces[i].el.parentNode) cleanPieces[i].el.parentNode.removeChild(cleanPieces[i].el);
        }
        cleanPieces = [];
        $timebar.classList.remove('cln');
        $sub.textContent = subGrind;
        $tip.textContent = '按住举杵 · 松手砸下；力量=硬度最养药性，过重流失，连击10药香满溢+3秒';
        $time.textContent = '20';
        startTimer();
      }
      function startClean() {
        makeClean();
        $timebar.classList.add('cln');
        $time.textContent = '5.0';
        $timebar.style.width = '100%';
        cleanT = CLN_T;
        cleanTimer = setInterval(function () {
          if (done) return;
          cleanT -= 100;
          if (cleanT < 0) cleanT = 0;
          var pct = cleanT / CLN_T;
          $timebar.style.width = (pct * 100) + '%';
          $time.textContent = (cleanT / 1000).toFixed(1);
          if (cleanT <= 0 || cleanLeft <= 0) startGrindPhase();
        }, 100);
      }

      var broken = 0, spill = 0, miss = 0, combo = 0, maxCombo = 0, lastBreakT = 0, done = false;
      var keepSum = 0, goldGot = 0;
      var dusts = [];
      var aiming = false, downT = 0, lastX = R, liftT = 0, liftTimer = null, timer = null, timeLeft = LIMIT;
      var hitR = HIT;

      function powerUi(p) {
        for (var i = 0; i < 3; i++) $power[i].className = (i < p) ? ('on' + p) : '';
      }

      function comboUi() {
        $combo.textContent = combo;
        $ripple.className = 'grind-ripple' + (combo >= 8 ? ' blaze' : (combo >= 5 ? ' hot' : ''));
        if (combo >= 8 && hitR === HIT) {
          hitR = 64;
          floatText(R, R * 0.9, '落点扩大', '#d9a13a');
          sfx('levelup');
        }
        if (combo >= 5 && combo % 5 === 0) sfx('levelup');
        if (combo >= 10 && combo % 10 === 0) {
          timeLeft = Math.min(LIMIT, timeLeft + 3000);
          floatText(R, R * 0.8, '药香满溢 +3秒', '#3f8f5f');
          sfx('win');
        }
      }

      function hud() {
        $cov.textContent = broken + '/' + N;
        $keep.textContent = Math.round(keepSum / (N * 100) * 100) + '%';
        $spill.textContent = spill;
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

      function stickLift(x) {
        var cx = R, maxX = R * 0.78;
        var dx = Math.max(-maxX, Math.min(maxX, x - cx));
        var p = powerOf(liftT);
        var lift = [26, 52, 78][p - 1];
        var rot = dx / maxX * 14;
        stick.classList.remove('fall', 'bounce', 'back');
        stick.style.transform = 'translate(' + dx + 'px,-' + lift + 'px) rotate(' + rot + 'deg)';
        powerUi(p);
      }

      // 药材爆裂：压扁 → 碎片飞散 + 药粉雾 → 留渣 + 药性飘字
      function explode(p, keep) {
        var cx = p.x, cy = p.y;
        var leaf = HERB_LEAF[p.kind] || '#9a7b3f';
        if (p.special === 'gold') leaf = '#c9a13a';
        p.el.classList.add('crush');
        var im = p.el.querySelector('.grind-herb-img');
        if (im) im.style.opacity = '.3';
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
            var fx = (Math.random() - 0.5) * 110;
            var fr = (Math.random() - 0.5) * 540;
            f.style.setProperty('--fx', fx + 'px');
            f.style.setProperty('--fr', fr + 'deg');
            f.style.setProperty('--fr2', (fr + (Math.random() - 0.5) * 300) + 'deg');
            mortar.appendChild(f);
            (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 580); })(f);
          }
          var pf = document.createElement('div');
          pf.className = 'grind-puff';
          pf.style.left = cx + 'px';
          pf.style.top = cy + 'px';
          mortar.appendChild(pf);
          (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950); })(pf);
          var rs = document.createElement('div');
          rs.className = 'grind-residue';
          rs.style.left = cx + 'px';
          rs.style.top = cy + 'px';
          mortar.appendChild(rs);
        }, 90);
        var col = keep >= 100 ? '#3f8f5f' : (keep >= 70 ? '#d9a13a' : '#b0452f');
        floatText(cx, cy - 10, '+' + keep, col);
      }

      function chips(x, y) {
        for (var i = 0; i < 4; i++) {
          var c = document.createElement('div');
          c.className = 'grind-chip';
          c.style.left = x + 'px';
          c.style.top = y + 'px';
          var dx = (Math.random() - 0.5) * 40, dy = (Math.random() - 0.5) * 40;
          c.style.setProperty('--dx', dx + 'px');
          c.style.setProperty('--dy', dy + 'px');
          mortar.appendChild(c);
          (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 380); })(c);
        }
      }

      function dropDust(x, y) {
        var d = document.createElement('div');
        d.className = 'grind-dust';
        d.style.left = x + 'px';
        d.style.top = y + 'px';
        mortar.appendChild(d);
        dusts.push({ x: x, y: y, el: d });
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

      // 砸下判定
      function strike(px, power) {
        var cy = CY;
        for (var di = dusts.length - 1; di >= 0; di--) {
          var d2 = Math.sqrt((dusts[di].x - px) * (dusts[di].x - px) + (dusts[di].y - cy) * (dusts[di].y - cy));
          if (d2 <= hitR) {
            if (dusts[di].el.parentNode) dusts[di].el.parentNode.removeChild(dusts[di].el);
            dusts.splice(di, 1);
            if (spill > 0) spill--;
            sfx('coin');
            hud();
            return;
          }
        }

        var hits = [];
        for (var i = 0; i < pieces.length; i++) {
          var p = pieces[i];
          if (p.broken) continue;
          var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - cy) * (p.y - cy));
          if (d <= hitR) hits.push(p);
        }

        var distC = Math.abs(px - R);
        if (hits.length === 0) {
          if (distC > R * SPILL_R) {
            spill++;
            dropDust(px, cy);
            sfx('error');
            buzz(20);
          } else {
            miss++;
            sfx('miss');
          }
        } else {
          var broke = 0, nowKeep = 0;
          for (var j = 0; j < hits.length; j++) {
            var h = hits[j];
            if (h.special === 'stone') {
              if (power >= 3) {
                h.hp--;
                h.el.classList.remove('jolt');
                void h.el.offsetWidth;
                h.el.classList.add('jolt');
                if (h.hp <= 0) { h.broken = true; broken++; broke++; explode(h, h.potency); nowKeep += h.potency; }
                else { miss++; }
              } else { miss++; }
            } else if (power >= h.hd) {
              var keep = (power === h.hd) ? 100 : Math.max(40, 100 - (power - h.hd) * 30);
              h.broken = true;
              broken++;
              broke++;
              explode(h, keep);
              nowKeep += keep;
              if (h.special === 'gold') goldGot += 2;
              if (power > h.hd + 1) { spill++; dropDust(h.x, h.y); sfx('error'); }
            } else {
              h.el.classList.remove('jolt');
              void h.el.offsetWidth;
              h.el.classList.add('jolt');
              miss++;
            }
          }
          keepSum += nowKeep;
          var now = Date.now();
          if (broke >= 2) {
            combo = (lastBreakT && now - lastBreakT <= CW) ? combo + 1 : 1;
            lastBreakT = now;
            if (combo > maxCombo) maxCombo = combo;
          } else if (broke >= 1) {
            lastBreakT = now;
          }
          sfx(power >= 3 ? 'thud' : 'hit');
          if (broke >= 1) buzz(power >= 3 ? [28, 22, 28] : 14);
          comboUi();
          chips(px, cy);
        }

        impact();
        hud();
        if (broken >= N) setTimeout(function () { settle('done'); }, 320);
      }

      // 杵砸落物理：fall(弧线下落) → bounce(反震) → back(回位)；连击5以上加快
      function stickStrike(px, power) {
        var cx = R, maxX = R * 0.78;
        var dx = Math.max(-maxX, Math.min(maxX, px - cx));
        var spd = combo >= 5;
        stick.classList.toggle('spd', spd);
        stick.classList.remove('back');
        stick.classList.add('fall');
        stick.style.transform = 'translate(' + dx + 'px,0) rotate(0deg)';
        var tFall = spd ? 110 : 145, tBounce = spd ? 70 : 95;
        setTimeout(function () {
          stick.classList.remove('fall');
          stick.classList.add('bounce');
          stick.style.transform = 'translate(' + dx + 'px,-10px) rotate(' + (dx / maxX * 4) + 'deg)';
          setTimeout(function () {
            stick.classList.remove('bounce');
            stick.classList.add('back');
            stick.style.transform = 'translate(0,0) rotate(0deg)';
          }, tBounce);
        }, tFall);
      }

      function settle(mode) {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        for (var i = 0; i < pieces.length; i++)
          if (pieces[i].mover) clearInterval(pieces[i].mover);
        var cover = broken / N;
        var keepPct = keepSum / (N * 100);
        var cleanPct = cleanGood / CLN_IMP;
        var keepAdj = (cleanPct >= 0.8 ? 0.08 : (cleanPct < 0.6 ? -0.08 : 0)) - cleanBad * 0.025;
        var keepFinal = Math.max(0, Math.min(1, keepPct + keepAdj));
        var pct = timeLeft / LIMIT;
        var t, n, clean = (spill <= 1);
        var recipe = mix && cover >= 1 && keepFinal >= 0.75; // 合捣出上品
        if (mode === 'done' && pct >= 0.4 && maxCombo >= 5 && cover >= 0.95 && keepFinal >= 0.85) { t = TIERS[2]; n = 2; }
        else if (mode === 'done' && (keepFinal >= 0.85 || (pct >= 0.2 && keepFinal >= 0.6) || (maxCombo >= 5 && cover >= 0.9))) { t = TIERS[1]; n = 1; }
        else { t = TIERS[0]; n = 1; }
        if (recipe) n += 1;
        if (goldGot > 0) n += goldGot;

        var rows = [
          ['捣碎覆盖', Math.round(cover * 100) + '%', broken + '/' + N + ' 块'],
          ['药性保持', Math.round(keepFinal * 100) + '%', '力量过重会流失'],
          ['净制挑杂', cleanGood + '/' + CLN_IMP, cleanBad > 0 ? '误伤好药 ' + cleanBad + ' 株' : '无误伤'],
          ['最大共鸣', maxCombo + '', '连击10药香满溢'],
          ['剩余药性', (mode === 'done' ? '余 ' + Math.round(pct * 100) + '%' : '已流失'), mode === 'done' ? '限时内捣完' : '超时未竟'],
          ['溅出损耗', spill + '', '重砸/点偏所致'],
        ];
        if (goldGot > 0) rows.push(['金药', '×' + goldGot, '碎金药 +' + goldGot + ' 药末']);
        if (recipe) rows.push(['合捣', '出上品', '覆盖满·药性≥75% +1']);
        rows.push(['合计', t.name + ' ×' + n, clean ? '· 澄净' : '· 出末']);
        var html = '<div class="grind-result">' +
          '<div class="grind-q" style="color:' + t.color + '">〔' + t.name + '〕药末 ×' + n +
            (mode === 'timeout' ? '<span class="grind-fail">（药性流失）</span>' : (clean ? '（澄净）' : '')) + '</div>' +
          '<table class="grind-tab">';
        rows.forEach(function (r) {
          html += '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td><td>' + r[2] + '</td></tr>';
        });
        html += '</table></div>';

        var card = ov.querySelector('.grind-card');
        card.insertAdjacentHTML('beforeend', html +
          '<div class="grind-acts">' +
            '<button class="btn" id="gr-take">收 取</button>' +
            '<button class="btn-ghost" id="gr-again">再捣一炉</button>' +
          '</div>');
        var act = ov.querySelector('.grind-acts');
        if (act) act.parentNode.removeChild(act);
        if (t.q >= 3) sfx('win');
        else if (t.q >= 2) sfx('confirm');
        else sfx('cancel');
        ov.querySelector('#gr-take').onclick = function () {
          packAdd('yaomo', n);
          if (log) log('〔捣药〕' + (mix ? '合捣' : HERB_NAME[herbId]) + '捣作药末×' + n + '（' + t.name + '，覆盖' + Math.round(cover * 100) + '%，药性' + Math.round(keepPct * 100) + '%，共鸣' + maxCombo + '）', t.q >= 2 ? 'good' : 'sys');
          if (save) save(getState());
          if (renderStatus) renderStatus();
          if (toast) toast('收得药末 ×' + n + '（' + t.name + '）');
          close();
        };
        ov.querySelector('#gr-again').onclick = function () {
          close();
          openGrind(herbId, opts);
        };
      }

      function startTimer() {
        timer = setInterval(function () {
          if (done) return;
          timeLeft -= 100;
          if (timeLeft < 0) timeLeft = 0;
          var pct = timeLeft / LIMIT;
          $timebar.style.width = (pct * 100) + '%';
          $timebar.classList.toggle('low', pct <= 0.25);
          $time.textContent = (timeLeft / 1000).toFixed(1);
          if (timeLeft <= 0) settle('timeout');
        }, 100);
      }

      function onDown(e) {
        if (done) return;
        e.preventDefault();
        var rect = mortar.getBoundingClientRect();
        var px = e.clientX - rect.left, py = e.clientY - rect.top;
        if (phase === 'clean') { cleanTap(px, py); return; }
        aiming = true;
        downT = Date.now();
        liftT = 0;
        lastX = px;
        stickLift(px);
        if (liftTimer) clearInterval(liftTimer);
        liftTimer = setInterval(function () {
          if (!aiming) return;
          liftT = Date.now() - downT;
          stickLift(lastX);
        }, 100);
      }

      function onMove(e) {
        if (!aiming || done) return;
        e.preventDefault();
        var rect = mortar.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        liftT = Date.now() - downT;
        stickLift(lastX);
      }

      function onUp(e) {
        if (!aiming || done) return;
        aiming = false;
        if (liftTimer) { clearInterval(liftTimer); liftTimer = null; }
        var power = powerOf(Date.now() - downT);
        var rect = mortar.getBoundingClientRect();
        var px = (e.clientX != null ? e.clientX : (lastX + rect.left)) - rect.left;
        stickStrike(px, power);
        strike(px, power);
        powerUi(0);
      }

      mortar.addEventListener('pointerdown', onDown);
      mortar.addEventListener('pointermove', onMove);
      mortar.addEventListener('pointerup', onUp);
      mortar.addEventListener('pointercancel', onUp);

      ov.querySelector('#gr-done').onclick = function () {
        if (phase === 'clean') { startGrindPhase(); return; }
        settle('done');
      };
      ov.querySelector('#gr-auto').onclick = function () {
        if (log) log('〔捣药〕交由药工代捣，出凡品药末。', 'sys');
        packAdd('yaomo', 1);
        if (save) save(getState());
        if (renderStatus) renderStatus();
        if (toast) toast('药工代捣，得药末 ×1（凡品）');
        close();
      };
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

      hud();
      powerUi(0);
      startClean();
    }

    return { openGrind: openGrind, closeGrind: close };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createGrinding;
})(typeof window !== 'undefined' ? window : this);

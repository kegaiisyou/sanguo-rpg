// 乱世烽火 · 捣药（杵操控版 v3：有重量的捣）
// 目标：20秒内把臼内12株药材全部捣成粉（限时+进度条，有成功/超时两种结局）
// 手感：按住=举杵瞄准（横移+蓄力轻中重），松手=杵弧线自由落体砸下→砸底反震弹起
// 药材：命中先压扁→爆裂成碎片飞散+药粉雾→留渣迹；臼下沉+冲击波+手机震动
// 硬度：人参1/甘草2/黄连3；力量≥硬度才碎，重砸软材溅出可回收；一杵碎≥2株攒共鸣
(function (global) {
  var LF = global.LF || (global.LF = {});

  LF.createGrinding = function (ctx) {
    var getState = ctx.getState, packAdd = ctx.packAdd, toast = ctx.toast,
        log = ctx.log, save = ctx.save, renderStatus = ctx.renderStatus;

    var N = 12;          // 药材块数
    var HIT = 50;        // 命中半径（px）
    var SPILL_R = 0.72;  // 臼沿判定半径比例
    var CW = 5000;       // 连击窗口
    var P1 = 160, P2 = 520;  // 蓄力段位切换
    var LIMIT = 20000;   // 限时 20 秒

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

      var it = (LF.ITEMS && LF.ITEMS[herbId]) || {};
      var name = it.name || '药材';
      var icon = it.icon || '🌿';
      var herbArt = HERB_ART[herbId] || HERB_ART.caoyao;
      var hd = HERB_HD[herbId] || 1;
      var leaf = HERB_LEAF[herbId] || '#9a7b3f';

      var ov = document.createElement('div');
      ov.id = 'grind-win';
      ov.className = 'grind-win';
      ov.innerHTML =
        '<div class="grind-card">' +
          '<div class="grind-title">捣 药<span class="grind-seal">捣</span></div>' +
          '<div class="grind-sub">' + icon + ' ' + name + ' 入臼 · 20 秒内全部捣成粉</div>' +
          '<div class="grind-time" id="gr-timewrap"><div class="grind-timebar" id="gr-timebar"></div><span id="gr-time">20</span></div>' +
          '<div class="grind-mortar" id="gr-mortar">' +
            '<div class="grind-ripple" id="gr-ripple"></div>' +
            '<div class="grind-stick" id="gr-stick"><img src="' + PESTLE_ART + '" alt=""></div>' +
          '</div>' +
          '<div class="grind-power" id="gr-power"><i></i><i></i><i></i></div>' +
          '<div class="grind-hud">' +
            '<span>捣碎 <b id="gr-cov">0/' + N + '</b></span>' +
            '<span>共鸣 <b id="gr-combo">0</b></span>' +
            '<span>溅出 <b id="gr-spill">0</b></span>' +
          '</div>' +
          '<div class="grind-acts">' +
            '<button class="btn" id="gr-done">收 手</button>' +
            '<button class="btn-ghost" id="gr-auto">自动捣</button>' +
          '</div>' +
          '<div class="grind-tip">按住举杵 · 松手砸下；力量≥硬度才碎，重砸软材溅出</div>' +
        '</div>';
      document.body.appendChild(ov);

      var mortar = ov.querySelector('#gr-mortar');
      var stick = ov.querySelector('#gr-stick');
      var $cov = ov.querySelector('#gr-cov');
      var $combo = ov.querySelector('#gr-combo');
      var $spill = ov.querySelector('#gr-spill');
      var $ripple = ov.querySelector('#gr-ripple');
      var $power = ov.querySelectorAll('#gr-power i');
      var $timebar = ov.querySelector('#gr-timebar');
      var $time = ov.querySelector('#gr-time');

      // 药材：椭圆带撒布（横移杵沿中心线可覆盖），块 44px，带硬度点
      var R = mortar.clientWidth / 2 || 140;
      var pieces = [];
      for (var i = 0; i < N; i++) {
        var a = Math.random() * Math.PI * 2;
        var r = Math.sqrt(Math.random()) * R * 0.55;
        var x = R + Math.cos(a) * r;
        var y = R + Math.sin(a) * r * 0.45;
        var el = document.createElement('div');
        el.className = 'grind-herb';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        var im = document.createElement('img');
        im.className = 'grind-herb-img';
        im.src = herbArt;
        im.alt = '';
        el.appendChild(im);
        var hdEl = document.createElement('span');
        hdEl.className = 'grind-hd';
        for (var k = 0; k < hd; k++) hdEl.appendChild(document.createElement('i'));
        el.appendChild(hdEl);
        mortar.appendChild(el);
        pieces.push({ el: el, x: x, y: y, broken: false, hd: hd });
      }

      var broken = 0, spill = 0, miss = 0, combo = 0, maxCombo = 0, lastBreakT = 0, done = false;
      var dusts = [];
      var aiming = false, downT = 0, lastX = R, liftT = 0, liftTimer = null, timer = null, timeLeft = LIMIT;

      function powerUi(p) {
        for (var i = 0; i < 3; i++) $power[i].className = (i < p) ? ('on' + p) : '';
      }

      function comboUi() {
        $combo.textContent = combo;
        $ripple.className = 'grind-ripple' + (combo >= 8 ? ' blaze' : (combo >= 5 ? ' hot' : ''));
        if (combo >= 5 && combo % 5 === 0) sfx('levelup');
      }

      function hud() {
        $cov.textContent = broken + '/' + N;
        $spill.textContent = spill;
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

      // 药材爆裂：压扁 → 碎片飞散 + 药粉雾 → 留渣
      function explode(p) {
        var cx = p.x, cy = p.y;
        p.el.classList.add('crush');
        var im = p.el.querySelector('.grind-herb-img');
        if (im) im.style.opacity = '.3';
        setTimeout(function () {
          if (!p.el.parentNode) return;
          p.el.parentNode.removeChild(p.el);
          // 碎片（带抛物线：上抛后下落）
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
          // 药粉雾
          var pf = document.createElement('div');
          pf.className = 'grind-puff';
          pf.style.left = cx + 'px';
          pf.style.top = cy + 'px';
          mortar.appendChild(pf);
          (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950); })(pf);
          // 渣迹
          var rs = document.createElement('div');
          rs.className = 'grind-residue';
          rs.style.left = cx + 'px';
          rs.style.top = cy + 'px';
          mortar.appendChild(rs);
        }, 90);
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
        var cy = R;
        for (var di = dusts.length - 1; di >= 0; di--) {
          var d2 = Math.sqrt((dusts[di].x - px) * (dusts[di].x - px) + (dusts[di].y - cy) * (dusts[di].y - cy));
          if (d2 <= HIT) {
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
          if (d <= HIT) hits.push(p);
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
          var broke = 0;
          for (var j = 0; j < hits.length; j++) {
            var h = hits[j];
            if (power >= h.hd) {
              h.broken = true;
              broken++;
              broke++;
              explode(h);
              if (power > h.hd + 1) { spill++; dropDust(h.x, h.y); sfx('error'); }
            } else {
              h.el.classList.remove('jolt');
              void h.el.offsetWidth;
              h.el.classList.add('jolt');
              miss++;
            }
          }
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

      // 杵砸落物理：fall(弧线下落) → bounce(反震) → back(回位)
      function stickStrike(px, power) {
        var cx = R, maxX = R * 0.78;
        var dx = Math.max(-maxX, Math.min(maxX, px - cx));
        stick.classList.remove('back');
        stick.classList.add('fall');
        stick.style.transform = 'translate(' + dx + 'px,0) rotate(0deg)';
        setTimeout(function () {
          stick.classList.remove('fall');
          stick.classList.add('bounce');
          stick.style.transform = 'translate(' + dx + 'px,-10px) rotate(' + (dx / maxX * 4) + 'deg)';
          setTimeout(function () {
            stick.classList.remove('bounce');
            stick.classList.add('back');
            stick.style.transform = 'translate(0,0) rotate(0deg)';
          }, 95);
        }, 145);
      }

      function settle(mode) {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        var cover = broken / N;
        var pct = timeLeft / LIMIT;
        var t, n, head;
        if (mode === 'done' && pct >= 0.4 && maxCombo >= 5 && cover >= 0.95) { t = TIERS[2]; n = 2; }
        else if (mode === 'done' && (pct >= 0.2 || maxCombo >= 5 || cover >= 0.9)) { t = TIERS[1]; n = 1; }
        else { t = TIERS[0]; n = 1; }
        var clean = (spill <= 1);

        var rows = [
          ['捣碎覆盖', Math.round(cover * 100) + '%', broken + '/' + N + ' 块'],
          ['最大共鸣', maxCombo + '', '一杵多碎续接'],
          ['剩余药性', (mode === 'done' ? '余 ' + Math.round(pct * 100) + '%' : '已流失'), mode === 'done' ? '限时内捣完' : '超时未竟'],
          ['溅出损耗', spill + '', '重砸/点偏所致'],
          ['合计', t.name, clean ? '· 澄净' : '· 出末']
        ];
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
          if (log) log('〔捣药〕' + name + '捣作药末×' + n + '（' + t.name + '，覆盖' + Math.round(cover * 100) + '%，共鸣' + maxCombo + '）', t.q >= 2 ? 'good' : 'sys');
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
        var px = e.clientX - rect.left;
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

      ov.querySelector('#gr-done').onclick = function () { settle('done'); };
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
      startTimer();
    }

    return { openGrind: openGrind, closeGrind: close };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createGrinding;
})(typeof window !== 'undefined' ? window : this);

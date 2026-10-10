// 乱世烽火 · 捣药（杵操控版：按住举杵 · 松手砸下）
// 杵常驻臼内：按住=举杵瞄准（横移跟随手指，蓄力分轻/中/重），松手=捣下
// 每株药材有硬度（人参1/甘草2/黄连3）：力量≥硬度才碎；重砸软材溅出损耗；点空臼沿溅出可回收
// 一杵碎≥2株攒连击，连击满5「药性共鸣」；无倒计时，纯操作爽感；产出凡1/良1/珍2
(function (global) {
  var LF = global.LF || (global.LF = {});

  LF.createGrinding = function (ctx) {
    var getState = ctx.getState, packAdd = ctx.packAdd, toast = ctx.toast,
        log = ctx.log, save = ctx.save, renderStatus = ctx.renderStatus;

    var N = 12;          // 药材块数
    var HIT = 46;        // 命中半径（px）
    var SPILL_R = 0.72;  // 臼沿判定半径比例
    var CW = 5000;       // 连击窗口：5秒内续碎 → 连击延续
    var P1 = 160, P2 = 520;  // 蓄力段位切换（轻 <160ms / 中 160-520 / 重 >520）

    // 水墨资产（assets/icons/grind/，白底抠图透明 PNG，同背包 items48 风格）
    var HERB_ART = {
      caoyao: 'assets/icons/items48/caoyao.png',
      renshen: 'assets/icons/grind/renshen.png',
      gancao: 'assets/icons/grind/gancao.png',
      huanglian: 'assets/icons/grind/huanglian.png'
    };
    var MORTAR_ART = 'assets/icons/grind/mortar.png';
    var PESTLE_ART = 'assets/icons/grind/pestle.png';
    var HERB_HD = { caoyao: 1, renshen: 1, gancao: 2, huanglian: 3 };  // 药材硬度

    var TIERS = [
      { q: 1, name: '凡品', color: 'var(--ink-soft)' },
      { q: 2, name: '良品', color: 'var(--gold)' },
      { q: 3, name: '珍品', color: 'var(--seal)' }
    ];

    function sfx(name) {
      try { if (window.SFX && window.SFX.play) window.SFX.play(name); } catch (e) { }
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

      var ov = document.createElement('div');
      ov.id = 'grind-win';
      ov.className = 'grind-win';
      ov.innerHTML =
        '<div class="grind-card">' +
          '<div class="grind-title">捣 药</div>' +
          '<div class="grind-sub">' + icon + ' ' + name + ' 入臼 · 按住举杵 · 松手砸下</div>' +
          '<div class="grind-mortar" id="gr-mortar">' +
            '<div class="grind-ripple" id="gr-ripple"></div>' +
            '<div class="grind-stick" id="gr-stick"><img src="' + PESTLE_ART + '" alt=""></div>' +
          '</div>' +
          '<div class="grind-power" id="gr-power"><i></i><i></i><i></i></div>' +
          '<div class="grind-hud">' +
            '<span>捣碎 <b id="gr-cov">0/' + N + '</b></span>' +
            '<span>共鸣 <b id="gr-combo">0</b></span>' +
            '<span>溅出 <b id="gr-spill">0</b></span>' +
            '<span>连锁 <b id="gr-chain">0</b></span>' +
          '</div>' +
          '<div class="grind-acts">' +
            '<button class="btn" id="gr-done">收 手</button>' +
            '<button class="btn-ghost" id="gr-auto">自动捣</button>' +
          '</div>' +
          '<div class="grind-tip">轻点=轻捣 · 按住越久砸越重；力量≥硬度才碎，重砸软材会溅出</div>' +
        '</div>';
      document.body.appendChild(ov);

      var mortar = ov.querySelector('#gr-mortar');
      var stick = ov.querySelector('#gr-stick');
      var $cov = ov.querySelector('#gr-cov');
      var $combo = ov.querySelector('#gr-combo');
      var $spill = ov.querySelector('#gr-spill');
      var $chain = ov.querySelector('#gr-chain');
      var $ripple = ov.querySelector('#gr-ripple');
      var $power = ov.querySelectorAll('#gr-power i');

      // 生成药材块（椭圆带撒布：横移杵沿中心线可全覆盖；每株带硬度标）
      var R = mortar.clientWidth / 2 || 140;
      var pieces = [];
      for (var i = 0; i < N; i++) {
        var a = Math.random() * Math.PI * 2;
        var r = Math.sqrt(Math.random()) * R * 0.78;
        var x = R + Math.cos(a) * r;
        var y = R + Math.sin(a) * r * 0.4;   // 垂直压缩40%：药材聚在中心水平带(±0.31R)，横移杵可覆盖
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

      var broken = 0, spill = 0, miss = 0, combo = 0, maxCombo = 0, chain = 0, lastBreakT = 0, done = false;
      var dusts = [];   // 溅出的可回收粉点 {x,y,el}
      var aiming = false, downT = 0, lastX = R, liftT = 0, liftTimer = null;

      function powerUi(p) {
        for (var i = 0; i < 3; i++) {
          $power[i].className = (i < p) ? ('on' + p) : '';
        }
      }

      function comboUi() {
        $combo.textContent = combo;
        $ripple.className = 'grind-ripple' + (combo >= 8 ? ' blaze' : (combo >= 5 ? ' hot' : ''));
        if (combo >= 5 && combo % 5 === 0) sfx('levelup');
      }

      function hud() {
        $cov.textContent = broken + '/' + N;
        $spill.textContent = spill;
        $chain.textContent = chain;
      }

      // 杵抬起：横移跟随 + 举起高度随蓄力段位
      function stickLift(x) {
        var cx = R, maxX = R * 0.78;
        var dx = Math.max(-maxX, Math.min(maxX, x - cx));
        var p = powerOf(liftT);
        var lift = [24, 48, 72][p - 1];
        var rot = dx / maxX * 12;
        stick.style.transform = 'translate(' + dx + 'px,-' + lift + 'px) rotate(' + rot + 'deg)';
        stick.classList.remove('strike', 'back');
        powerUi(p);
      }

      function powerOf(t) { return t < P1 ? 1 : (t < P2 ? 2 : 3); }

      function chips(x, y) {
        for (var i = 0; i < 5; i++) {
          var c = document.createElement('div');
          c.className = 'grind-chip';
          c.style.left = x + 'px';
          c.style.top = y + 'px';
          var dx = (Math.random() - 0.5) * 46, dy = (Math.random() - 0.5) * 46;
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

      function shake() {
        mortar.classList.remove('shake');
        void mortar.offsetWidth;
        mortar.classList.add('shake');
      }

      // 连锁震碎：命中株的相邻未碎药材 50% 震碎（计入覆盖，不计共鸣）
      function chainBreak(px, py) {
        for (var i = 0; i < pieces.length; i++) {
          var p = pieces[i];
          if (p.broken) continue;
          var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
          if (d < HIT && Math.random() < 0.5) {
            p.broken = true;
            p.el.classList.add('broken');
            broken++;
            chain++;
            chips(p.x, p.y);
          }
        }
      }

      // 砸下判定：以松手位置为中心
      function strike(px, power) {
        var cy = R;
        // 1. 优先回收溅出粉粒
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

        var distC = Math.sqrt((px - R) * (px - R));
        if (hits.length === 0) {
          // 2. 点空：在臼沿 → 溅出掉可回收粉粒；臼内 → 空捣（纯 miss，无惩罚）
          if (distC > R * SPILL_R) {
            spill++;
            dropDust(px, cy);
            sfx('error');
          } else {
            miss++;
            sfx('miss');
          }
        } else {
          // 3. 命中药材：力量≥硬度碎；超硬太多溅出损耗（株仍碎）
          var broke = 0;
          for (var j = 0; j < hits.length; j++) {
            var h = hits[j];
            if (power >= h.hd) {
              h.broken = true;
              h.el.classList.add('broken');
              broken++;
              broke++;
              chips(h.x, h.y);
              if (power > h.hd + 1) { spill++; dropDust(h.x, h.y); sfx('error'); }
            } else {
              h.el.classList.remove('jolt');
              void h.el.offsetWidth;
              h.el.classList.add('jolt');
              miss++;
            }
          }
          chainBreak(px, cy);
          var now = Date.now();
          if (broke >= 2) {
            combo = (lastBreakT && now - lastBreakT <= CW) ? combo + 1 : 1;
            lastBreakT = now;
            if (combo > maxCombo) maxCombo = combo;
          } else if (broke >= 1) {
            lastBreakT = now;
          }
          sfx(power >= 3 ? 'thud' : 'hit');
          comboUi();
        }

        shake();
        hud();
        if (broken >= N) setTimeout(settle, 260);
      }

      function settle() {
        if (done) return;
        done = true;
        var cover = broken / N;
        var t, n;
        if (maxCombo >= 8 && cover >= 0.85) { t = TIERS[2]; n = 2; }
        else if (cover >= 0.9 || maxCombo >= 5) { t = TIERS[1]; n = 1; }
        else { t = TIERS[0]; n = 1; }
        var clean = (spill <= 1 && chain >= 3);

        var rows = [
          ['捣碎覆盖', Math.round(cover * 100) + '%', broken + '/' + N + ' 块'],
          ['最大共鸣', maxCombo + '', '一杵多碎续接'],
          ['溅出损耗', spill + '', '重砸/点偏所致'],
          ['连锁震碎', chain + '', '相邻药材联动'],
          ['合计', t.name, clean ? '· 澄净' : '· 出末']
        ];
        var html = '<div class="grind-result">' +
          '<div class="grind-q" style="color:' + t.color + '">〔' + t.name + '〕药末 ×' + n + (clean ? '（澄净）' : '') + '</div>' +
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
        // 砸落动画：杵快速落回（strike 0.1s），判定与动画同时进行
        stick.classList.add('strike');
        var cx = R, maxX = R * 0.78;
        var dx = Math.max(-maxX, Math.min(maxX, px - cx));
        stick.style.transform = 'translate(' + dx + 'px,0) rotate(0deg)';
        stick.addEventListener('transitionend', function back(e2) {
          if (e2.propertyName === 'transform') {
            stick.removeEventListener('transitionend', back);
            stick.classList.remove('strike');
            stick.classList.add('back');
            stick.style.transform = 'translate(0,0) rotate(0deg)';
          }
        });
        strike(px, power);
        powerUi(0);
      }

      mortar.addEventListener('pointerdown', onDown);
      mortar.addEventListener('pointermove', onMove);
      mortar.addEventListener('pointerup', onUp);
      mortar.addEventListener('pointercancel', onUp);

      ov.querySelector('#gr-done').onclick = settle;
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
    }

    return { openGrind: openGrind, closeGrind: close };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createGrinding;
})(typeof window !== 'undefined' ? window : this);

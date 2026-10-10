// 乱世烽火 · 捣药（软判定版：药性节律 · 弱音游）
// 药材入臼 → 点击/触屏捣击 → 8秒内连续捣碎攒「药性共鸣」→ 连锁震碎相邻药材 → 溅出仅与操作失误挂钩
// 节奏=氛围与加成（波纹律动+音效增强），非规则门槛：乱捣保底凡品，跟节奏+规划连锁冲珍品。
// 产出维持 凡1/良1/珍2；消耗与配方链待后续接入。
(function (global) {
  var LF = global.LF || (global.LF = {});

  LF.createGrinding = function (ctx) {
    var getState = ctx.getState, packAdd = ctx.packAdd, toast = ctx.toast,
        log = ctx.log, save = ctx.save, renderStatus = ctx.renderStatus;

    var N = 12;          // 药材块数
    var HIT = 46;        // 命中半径（px）
    var SPILL_R = 0.72;  // 臼沿判定半径比例
    var CW = 8000;       // 共鸣窗口：8秒内续捣碎 → 连击延续

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

      var ov = document.createElement('div');
      ov.id = 'grind-win';
      ov.className = 'grind-win';
      ov.innerHTML =
        '<div class="grind-card">' +
          '<div class="grind-title">捣 药</div>' +
          '<div class="grind-sub">' + icon + ' ' + name + ' 入臼 · 连捣得共鸣，震碎生连锁</div>' +
          '<div class="grind-mortar" id="gr-mortar">' +
            '<div class="grind-ripple" id="gr-ripple"></div>' +
          '</div>' +
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
          '<div class="grind-tip">8秒内连捣攒共鸣：共鸣≥5 良品有望，≥8 珍品可期；点偏臼沿才溅出</div>' +
        '</div>';
      document.body.appendChild(ov);

      var mortar = ov.querySelector('#gr-mortar');
      var $cov = ov.querySelector('#gr-cov');
      var $combo = ov.querySelector('#gr-combo');
      var $spill = ov.querySelector('#gr-spill');
      var $chain = ov.querySelector('#gr-chain');
      var $ripple = ov.querySelector('#gr-ripple');

      // 生成药材块（极坐标均匀撒在臼内；溅出判定与位置解耦，不再受撒布运气影响）
      var R = mortar.clientWidth / 2 || 140;
      var pieces = [];
      for (var i = 0; i < N; i++) {
        var a = Math.random() * Math.PI * 2;
        var r = Math.sqrt(Math.random()) * R * 0.76;
        var x = R + Math.cos(a) * r, y = R + Math.sin(a) * r;
        var el = document.createElement('div');
        el.className = 'grind-herb';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.textContent = icon;
        mortar.appendChild(el);
        pieces.push({ el: el, x: x, y: y, broken: false });
      }

      var broken = 0, spill = 0, miss = 0, combo = 0, maxCombo = 0, chain = 0, lastBreakT = 0, done = false;
      var dusts = [];   // 溅出的可回收粉点 {x,y,el}

      function comboUi() {
        $combo.textContent = combo;
        // 波纹律动随共鸣提速：<5 慢板 / ≥5 快板 / ≥8 疾板
        $ripple.className = 'grind-ripple' + (combo >= 8 ? ' blaze' : (combo >= 5 ? ' hot' : ''));
        if (combo >= 5 && combo % 5 === 0) sfx('levelup');
      }

      function hud() {
        $cov.textContent = broken + '/' + N;
        $spill.textContent = spill;
        $chain.textContent = chain;
      }

      function pestle(x, y) {
        var p = document.createElement('div');
        p.className = 'grind-pestle';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        mortar.appendChild(p);
        setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 240);
      }

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
          (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 380); })(el);
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

      // 连锁震碎：被点击药材的相邻未碎药材 50% 震碎（计入覆盖，不计共鸣）
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

      function settle() {
        if (done) return;
        done = true;
        var cover = broken / N;
        // 品质：珍=共鸣≥8 且 覆盖≥85%；良=覆盖≥90% 或 共鸣≥5；其余凡品
        var t, n;
        if (maxCombo >= 8 && cover >= 0.85) { t = TIERS[2]; n = 2; }
        else if (cover >= 0.9 || maxCombo >= 5) { t = TIERS[1]; n = 1; }
        else { t = TIERS[0]; n = 1; }
        var clean = (spill <= 1 && chain >= 3);

        var rows = [
          ['捣碎覆盖', Math.round(cover * 100) + '%', broken + '/' + N + ' 块'],
          ['最大共鸣', maxCombo + '', '连捣续接'],
          ['溅出损耗', spill + '', '点偏臼沿所致'],
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
        if (act) act.parentNode.removeChild(act);          // 移除「收手/自动捣」
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

      mortar.addEventListener('pointerdown', function (e) {
        if (done) return;
        e.preventDefault();
        var rect = mortar.getBoundingClientRect();
        var px = e.clientX - rect.left, py = e.clientY - rect.top;
        var cx = rect.width / 2, cy = rect.height / 2;
        var dx = px - cx, dy = py - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // 1. 优先回收溅出粉粒（点中粉点即回收，不计捣击）
        for (var di = dusts.length - 1; di >= 0; di--) {
          var d2 = Math.sqrt((dusts[di].x - px) * (dusts[di].x - px) + (dusts[di].y - py) * (dusts[di].y - py));
          if (d2 <= HIT) {
            if (dusts[di].el.parentNode) dusts[di].el.parentNode.removeChild(dusts[di].el);
            dusts.splice(di, 1);
            if (spill > 0) spill--;
            sfx('coin');
            hud();
            return;
          }
        }

        // 2. 溅出判定：点空（距所有未碎药材>HIT）且点在臼沿区 → 溅出，掉可回收粉粒
        var best = null, bd = 1e9;
        for (var i = 0; i < pieces.length; i++) {
          var p = pieces[i];
          if (p.broken) continue;
          var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
          if (d < bd) { bd = d; best = p; }
        }
        if ((!best || bd > HIT) && dist > cx * SPILL_R) {
          spill++;
          dropDust(px, py);
          sfx('error');
          pestle(px, py);
          hud();
          return;
        }

        // 3. 命中药材 → 捣碎 + 共鸣 + 连锁
        if (best && bd <= HIT) {
          best.broken = true;
          best.el.classList.add('broken');
          broken++;
          chips(best.x, best.y);
          chainBreak(best.x, best.y);
          var now = Date.now();
          combo = (lastBreakT && now - lastBreakT <= CW) ? combo + 1 : 1;
          lastBreakT = now;
          if (combo > maxCombo) maxCombo = combo;
          sfx('hit');
          comboUi();
        } else {
          miss++;
        }
        pestle(px, py);

        mortar.classList.remove('shake');
        void mortar.offsetWidth;
        mortar.classList.add('shake');
        hud();
        if (broken >= N) setTimeout(settle, 260);
      });

      ov.querySelector('#gr-done').onclick = settle;
      ov.querySelector('#gr-auto').onclick = function () {
        // 防疲劳：跳过操作，直接出凡品（与「自动抓药」同理念）
        if (log) log('〔捣药〕交由药工代捣，出凡品药末。', 'sys');
        packAdd('yaomo', 1);
        if (save) save(getState());
        if (renderStatus) renderStatus();
        if (toast) toast('药工代捣，得药末 ×1（凡品）');
        close();
      };
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

      hud();
    }

    return { openGrind: openGrind, closeGrind: close };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LF.createGrinding;
})(typeof window !== 'undefined' ? window : this);

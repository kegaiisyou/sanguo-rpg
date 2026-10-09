// 乱世烽火 · 捣药（A1 方案：节奏点击 + 位置覆盖）
// 药材入臼 → 点击/触屏捣击 → 按 覆盖率/节奏/飞溅 评分 → 出对应品质药末。
// 仅验证手感阶段，挂调试面板；后续再接正式配方与「碾/磨」第二道工序。
(function (global) {
  var LF = global.LF || (global.LF = {});

  LF.createGrinding = function (ctx) {
    var getState = ctx.getState, packAdd = ctx.packAdd, toast = ctx.toast,
        log = ctx.log, save = ctx.save, renderStatus = ctx.renderStatus;

    var N = 12;          // 药材块数
    var STD = 550;       // 标准捣击间隔（ms）
    var HIT = 46;        // 命中半径（px）
    var SPILL_R = 0.72;  // 超过半径比例视为靠边 → 计飞溅

    var TIERS = [
      { q: 1, name: '凡品', color: 'var(--ink-soft)' },
      { q: 2, name: '良品', color: 'var(--gold)' },
      { q: 3, name: '珍品', color: 'var(--seal)' }
    ];

    function tierOf(score) {
      return score <= 2 ? TIERS[0] : (score <= 4 ? TIERS[1] : TIERS[2]);
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
          '<div class="grind-sub">' + icon + ' ' + name + ' 入臼 · 点击臼内捣击，捣遍且匀</div>' +
          '<div class="grind-mortar" id="gr-mortar"></div>' +
          '<div class="grind-hud">' +
            '<span>捣碎 <b id="gr-cov">0/' + N + '</b></span>' +
            '<span>节奏 <b id="gr-rhy">—</b></span>' +
            '<span>溅出 <b id="gr-spill">0</b></span>' +
          '</div>' +
          '<div class="grind-acts">' +
            '<button class="btn" id="gr-done">收 手</button>' +
            '<button class="btn-ghost" id="gr-auto">自动捣</button>' +
          '</div>' +
          '<div class="grind-tip">覆盖 ≥90% 且节奏匀 → 珍品；捣在臼沿会溅出损耗</div>' +
        '</div>';
      document.body.appendChild(ov);

      var mortar = ov.querySelector('#gr-mortar');
      var $cov = ov.querySelector('#gr-cov');
      var $rhy = ov.querySelector('#gr-rhy');
      var $spill = ov.querySelector('#gr-spill');

      // 生成药材块（极坐标均匀撒在臼内）
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

      var broken = 0, spill = 0, miss = 0, lastT = 0, gaps = [], done = false;

      function rhythmLabel() {
        if (gaps.length < 3) return '—';
        var s = 0, k = Math.min(gaps.length, 6);
        for (var i = gaps.length - k; i < gaps.length; i++) s += Math.abs(gaps[i] - STD);
        var avg = s / k;
        return avg < 150 ? '匀' : (avg < 300 ? '偏' : '乱');
      }

      function hud() {
        $cov.textContent = broken + '/' + N;
        $rhy.textContent = rhythmLabel();
        $spill.textContent = spill;
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
          (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 380); })(c);
        }
      }

      function settle() {
        if (done) return;
        done = true;
        var cover = broken / N;
        var cs = cover >= 0.9 ? 2 : (cover >= 0.7 ? 1 : 0);
        var rs = 0;
        if (gaps.length >= 3) {
          var s = 0;
          gaps.forEach(function (g) { s += Math.abs(g - STD); });
          var avg = s / gaps.length;
          rs = avg < 150 ? 2 : (avg < 300 ? 1 : 0);
        }
        var ss = spill <= 4 ? 1 : 0;
        var total = cs + rs + ss;
        var t = tierOf(total);
        var n = t.q >= 3 ? 2 : 1;

        var rows = [
          ['捣碎覆盖', cs + '/2', broken + '/' + N + ' 块'],
          ['节奏匀整', rs + '/2', rhythmLabel()],
          ['无飞溅', ss + '/1', spill + ' 片'],
          ['合计', total + '/5', t.name]
        ];
        var html = '<div class="grind-result">' +
          '<div class="grind-q" style="color:' + t.color + '">〔' + t.name + '〕药末 ×' + n + '</div>' +
          '<table class="grind-tab">';
        rows.forEach(function (r) {
          html += '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td><td>' + r[2] + '</td></tr>';
        });
        html += '</table></div>';

        var card = ov.querySelector('.grind-card');
        card.insertAdjacentHTML('beforeend', html +
          '<div class="grind-acts"><button class="btn" id="gr-take">收 取</button></div>');
        var act = ov.querySelector('.grind-acts');
        if (act) act.parentNode.removeChild(act);          // 移除「收手/自动捣」
        ov.querySelector('#gr-take').onclick = function () {
          packAdd('yaomo', n);
          if (log) log('〔捣药〕' + name + '捣作药末×' + n + '（' + t.name + '，' + total + '/5）', t.q >= 2 ? 'good' : 'sys');
          if (save) save(getState());
          if (renderStatus) renderStatus();
          if (toast) toast('收得药末 ×' + n + '（' + t.name + '）');
          close();
        };
      }

      mortar.addEventListener('pointerdown', function (e) {
        if (done) return;
        e.preventDefault();
        var rect = mortar.getBoundingClientRect();
        var px = e.clientX - rect.left, py = e.clientY - rect.top;
        var cx = rect.width / 2, cy = rect.height / 2;
        var dx = px - cx, dy = py - cy;
        if (Math.sqrt(dx * dx + dy * dy) > cx * SPILL_R) spill++;

        var best = null, bd = 1e9;
        for (var i = 0; i < pieces.length; i++) {
          var p = pieces[i];
          if (p.broken) continue;
          var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
          if (d < bd) { bd = d; best = p; }
        }
        if (best && bd <= HIT) {
          best.broken = true;
          best.el.classList.add('broken');
          broken++;
          chips(best.x, best.y);
        } else {
          miss++;
        }
        pestle(px, py);

        var now = Date.now();
        if (lastT) gaps.push(now - lastT);
        lastT = now;

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

// 乱世烽火 · 反馈 + 更新日志 常驻侧边组件（v20261026b）
// 借鉴 sanguo.nevatown 的「更新·反馈」：右侧常驻标签，玩家可直接留言、看更新日志。
// 无后端：反馈存 localStorage；更新日志为内置 CHANGELOG。事件 stopPropagation 防误触游戏热键。
(function (global) {
  var KEY = 'lf_feedback_v1';
  // 更新日志（玩家可见的版本记录；新增条目往这里加）
  var CHANGELOG = [
    { d: '10-26', k: 'feature', t: '「览物志」上线：标题页与设置内可查阅人物 / 城镇 / 装备 / 武学 / 配方 / 势力 / 建筑 / 奇遇 / 兵种。' },
    { d: '10-26', k: 'fix', t: '修复虎牢关关城格「出城」无反应、离关失败的问题，现已能真正离关。' },
    { d: '10-26', k: 'fix', t: '移除「驻守关际 / 巡视瓮城 / 查点储粮」三个无效按钮（原点击即报错）。' },
    { d: '10-25', k: 'feature', t: '行囊与角色页体验重做：拖拽手感、快速穿戴、装备并入角色大厅。' },
    { d: '10-23', k: 'ui', t: '新增玩家反馈入口：你提的意见会被开发者看到，改好了写进此更新日志。' }
  ];
  var KIND = {
    fix: { n: '修复', c: '#ff8a8a' }, balance: { n: '平衡', c: '#ffc85a' },
    ui: { n: '界面', c: '#6ec8ff' }, feature: { n: '新内容', c: '#6ee0aa' }, other: { n: '其他', c: '#c3baff' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function build() {
    var host = document.createElement('div');
    host.setAttribute('data-nt-fb', '');
    host.innerHTML =
      '<div class="ntf-tab" role="button" tabindex="0">反馈<br>更新</div>' +
      '<div class="ntf-panel" hidden>' +
        '<div class="ntf-head"><span class="ntf-title">玩家之声</span><button class="ntf-x" aria-label="关闭">×</button></div>' +
        '<div class="ntf-tabs">' +
          '<button class="ntf-t on" data-t="updates">更新日志</button>' +
          '<button class="ntf-t" data-t="feedback">提意见</button>' +
        '</div>' +
        '<div class="ntf-body">' +
          '<div class="ntf-pane" data-p="updates"></div>' +
          '<div class="ntf-pane" data-p="feedback" hidden>' +
            '<p class="ntf-hint">哪里不好玩、卡住了、遇到 bug、想要什么新玩法，都可以写。开发者每条都会看，改好了写进「更新日志」。</p>' +
            '<textarea class="ntf-ta" maxlength="1000" placeholder="比如：手机上武将志按钮点不到"></textarea>' +
            '<div class="ntf-row"><button class="ntf-send">发送</button><span class="ntf-msg"></span><span class="ntf-count"></span></div>' +
            '<div class="ntf-mine"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);

    // 事件隔离：不冒泡到游戏（避免打字触发对话数字键等全局监听）
    ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'wheel', 'contextmenu'].forEach(function (ev) {
      host.addEventListener(ev, function (e) { e.stopPropagation(); }, true);
    });

    var tab = host.querySelector('.ntf-tab');
    var panel = host.querySelector('.ntf-panel');
    var x = host.querySelector('.ntf-x');
    var open = function () { panel.hidden = false; tab.classList.add('on'); renderUpdates(host); };
    var close = function () { panel.hidden = true; tab.classList.remove('on'); };
    tab.onclick = function () { panel.hidden ? open() : close(); };
    tab.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); panel.hidden ? open() : close(); } };
    x.onclick = close;

    host.querySelectorAll('.ntf-t').forEach(function (b) {
      b.onclick = function () {
        host.querySelectorAll('.ntf-t').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var t = b.getAttribute('data-t');
        host.querySelectorAll('.ntf-pane').forEach(function (p) { p.hidden = p.getAttribute('data-p') !== t; });
        if (t === 'updates') renderUpdates(host); else renderMine(host);
      };
    });

    var ta = host.querySelector('.ntf-ta');
    var send = host.querySelector('.ntf-send');
    var msg = host.querySelector('.ntf-msg');
    var cnt = host.querySelector('.ntf-count');
    ta.oninput = function () { cnt.textContent = ta.value.length ? ta.value.length + '/1000' : ''; };
    send.onclick = function () {
      var text = ta.value.trim();
      if (text.length < 2) { msg.className = 'ntf-msg bad'; msg.textContent = '再多写几个字吧'; return; }
      var a = load(); a.unshift({ text: text, ts: Date.now() }); if (a.length > 50) a = a.slice(0, 50); save(a);
      ta.value = ''; cnt.textContent = ''; submitFeedback(text, msg);
      renderMine(host);
    };

    global.__ntfHost = host; // 便于调试
  }

  function renderUpdates(host) {
    var pane = host.querySelector('.ntf-pane[data-p="updates"]');
    var html = '', last = '';
    CHANGELOG.forEach(function (e) {
      if (e.d !== last) { html += '<div class="ntf-day">' + esc(e.d) + '</div>'; last = e.d; }
      var k = KIND[e.k] || KIND.other;
      html += '<div class="ntf-item"><span class="ntf-tag" style="background:' + k.c + '33;color:' + k.c + '">' + k.n + '</span><span>' + esc(e.t) + '</span></div>';
    });
    pane.innerHTML = html;
  }
  function renderMine(host) {
    var box = host.querySelector('.ntf-mine');
    var a = load();
    if (!a.length) { box.innerHTML = '<p class="ntf-hint">你提过的意见会显示在这里。</p>'; return; }
    box.innerHTML = '<div class="ntf-mine-t">我提过的意见（' + a.length + '）</div>' + a.map(function (f) {
      var dt = new Date(f.ts);
      var s = (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2);
      return '<div class="ntf-mine-i"><span class="ntf-mine-ti">' + s + '</span>' + esc(f.text) + '</div>';
    }).join('');
  }


  function submitFeedback(text, msg){
    var ep=(LF.CONSTANTS.FEEDBACK_ENDPOINT||'').trim();
    var em=(LF.CONSTANTS.FEEDBACK_EMAIL||'').trim();
    var payload={ text:text, ts:Date.now(), ua:navigator.userAgent, v:LF.CONSTANTS.VERSION };
    if(ep){
      try{
        fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
          .then(function(r){ if(r&&r.ok) ok(msg,'已送达，谢谢！我们会尽快处理。'); else copyFallback(text,msg); })
          .catch(function(){ copyFallback(text,msg); });
      }catch(e){ copyFallback(text,msg); }
      return;
    }
    if(em){
      try{ location.href='mailto:'+encodeURIComponent(em)+'?subject='+encodeURIComponent('乱世烽火·玩家反馈 v'+LF.CONSTANTS.VERSION)+'&body='+encodeURIComponent(text); ok(msg,'已唤起邮件，发送后即达开发者。'); return; }catch(e){}
    }
    copyFallback(text,msg);
  }
  function ok(msg,t){ if(msg){ msg.className='ntf-msg ok'; msg.textContent=t; } }
  function copyFallback(text,msg){
    try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text); ok(msg,'已复制到剪贴板，可粘贴发给我。'); return; } }catch(e){}
    ok(msg,'已记录（本地）。你可复制下面内容发给我：'+text);
  }
  // ── 自注入样式（深色侧栏，与游戏主题互补）──
  if (!document.getElementById('ntf-style')) {
    var st = document.createElement('style');
    st.id = 'ntf-style';
    st.textContent =
      '[data-nt-fb]{all:initial;}' +
      '.ntf-tab{position:fixed;top:58%;right:0;transform:translateY(-50%);z-index:2147483000;padding:8px 6px;font:600 12px/1.3 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;text-align:center;color:#fff;background:rgba(18,18,28,.78);border:1px solid rgba(255,255,255,.22);border-right:0;border-radius:8px 0 0 8px;cursor:pointer;opacity:.82;-webkit-tap-highlight-color:transparent;user-select:none;}' +
      '.ntf-tab.on{opacity:1;}' +
      '.ntf-panel{position:fixed;top:0;right:0;bottom:0;width:min(360px,92vw);z-index:2147483001;background:#17171f;color:#e6e6ee;display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.5);font:14px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}' +
      '.ntf-head{display:flex;align-items:center;padding:12px 14px 8px;}' +
      '.ntf-title{font-weight:700;font-size:15px;}' +
      '.ntf-x{margin-left:auto;background:none;border:0;color:#a9a9b8;font-size:20px;line-height:1;cursor:pointer;}' +
      '.ntf-tabs{display:flex;gap:6px;padding:0 14px;border-bottom:1px solid rgba(255,255,255,.12);}' +
      '.ntf-t{font:inherit;color:#a9a9b8;background:none;border:0;border-bottom:2px solid transparent;padding:8px 10px;cursor:pointer;}' +
      '.ntf-t.on{color:#fff;border-bottom-color:#8b7bff;font-weight:700;}' +
      '.ntf-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:12px 16px 16px;}' +
      '.ntf-pane[hidden]{display:none;}' +
      '.ntf-hint{font-size:12px;color:#8d8d9c;margin:0 0 10px;}' +
      '.ntf-day{margin:12px 0 6px;font-size:12px;color:#8d8d9c;}' +
      '.ntf-day:first-child{margin-top:0;}' +
      '.ntf-item{display:flex;gap:8px;align-items:baseline;padding:5px 0;font-size:13px;}' +
      '.ntf-tag{flex:none;font-size:11px;padding:0 6px;border-radius:4px;}' +
      '.ntf-ta{width:100%;min-height:120px;resize:vertical;font:inherit;color:#fff;background:#0f0f15;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:8px 10px;}' +
      '.ntf-ta:focus{outline:none;border-color:#8b7bff;}' +
      '.ntf-row{display:flex;align-items:center;gap:10px;margin-top:10px;}' +
      '.ntf-send{font:inherit;font-weight:700;color:#fff;background:#6b5cff;border:0;border-radius:8px;padding:7px 18px;cursor:pointer;}' +
      '.ntf-send[disabled]{opacity:.5;cursor:default;}' +
      '.ntf-msg{font-size:13px;}' +
      '.ntf-msg.ok{color:#9fe9c6;}.ntf-msg.bad{color:#ffb0b0;}' +
      '.ntf-count{margin-left:auto;font-size:12px;color:#6f6f7d;}' +
      '.ntf-mine{margin-top:14px;border-top:1px solid rgba(255,255,255,.1);padding-top:10px;}' +
      '.ntf-mine-t{font-size:12px;color:#8d8d9c;margin-bottom:6px;}' +
      '.ntf-mine-i{font-size:12px;color:#c9c9d4;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06);}' +
      '.ntf-mine-ti{color:#8b7bff;margin-right:6px;}';
    document.head.appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})(typeof window !== 'undefined' ? window : globalThis);

window.LF = window.LF || {};
(function(){
  // 顶部提示条（v20261008i 从 engine.js 抽出；v20261008k 修复 terser 跨 IIFE 内联把计时器句柄挂到 DOM 元素自身）
  LF.createUI = function(ctx){
    var getSettings = ctx.getSettings, getTick = ctx.getTick, getToastEl = ctx.getToastEl;
    function toast(msg, ms, cls){
      if(getSettings().sound) getTick()(480);
      var $t = getToastEl(); if(!$t) return;
      $t.textContent = String(msg==null?'':msg);
      $t.className = 'show '+(cls||'');
      if($t._toastTimer) clearTimeout($t._toastTimer);
      $t._toastTimer = setTimeout(function(){ $t.classList.remove('show'); $t._toastTimer=null; },
        ms||Math.min(4200, Math.max(1700, 900+String(msg).length*80)));
    }
    return { toast: toast };
  };
})();

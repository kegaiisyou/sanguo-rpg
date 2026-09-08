// 山河志·运行时状态与设置容器（v20260907v）
// 从原 engine.js 顶部闭包抽出为「全局可访问」模块，作为后续按子系统拆分 engine.js 的钥匙石。
// 本文件须在任何 engine.js / core/*.js 之前加载。
window.LF = window.LF || {};
LF.Core = LF.Core || {};
(function(){
  var G = window.LF && (window.LF.SharedGame || window.LF);
  var SLOTS=['lf_save_1','lf_save_2','lf_save_3'];   // 三档存档
  var curSlot=0;                                     // 当前游戏所在档位（0=未入局）
  var SETTINGS_KEY='lf_settings_v1';
  // 设置：文字演出速度（每字毫秒；0=瞬/无动画；默认偏慢，可在设置内调节）
  var settings=(function(){ try{return JSON.parse(localStorage.getItem(SETTINGS_KEY))||{};}catch(e){return {};} })();
  if(typeof settings.textSpeed!=='number') settings.textSpeed=55;            // 默认偏慢
  else if(settings.textSpeed===1) settings.textSpeed=22;   // 旧版「常」迁移
  else if(settings.textSpeed===2) settings.textSpeed=55;   // 旧版「缓」迁移
  // settings.textSpeed===0 保留为「瞬」；其余数值（已是毫秒）原样保留
  if(typeof settings.sound!=='boolean') settings.sound=false;
  if(typeof settings.titleFx!=='boolean') settings.titleFx=true;
  function saveSettings(){ try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch(e){} }
  function lfSpeedLabel(v){ return v<=0?'瞬（无动画）':(v+' ms / 字'); }
  var SHICHEN=['子时','丑时','寅时','卯时','辰时','巳时','午时','未时','申时','酉时','戌时','亥时'];
  var state=null;   // 启动不进局，待标题屏择档后载入

  // 暴露为全局，供 engine.js 及其拆分文件以裸名访问（与旧 IIFE 闭包语义等价）
  LF.Core.G=G; LF.Core.SLOTS=SLOTS; LF.Core.curSlot=curSlot;
  LF.Core.SETTINGS_KEY=SETTINGS_KEY; LF.Core.settings=settings;
  LF.Core.SHICHEN=SHICHEN; LF.Core.state=state;
  LF.Core.saveSettings=saveSettings; LF.Core.lfSpeedLabel=lfSpeedLabel;
  window.G=G; window.SLOTS=SLOTS; window.curSlot=curSlot;
  window.SETTINGS_KEY=SETTINGS_KEY; window.settings=settings;
  window.SHICHEN=SHICHEN; window.state=state;
  window.saveSettings=saveSettings; window.lfSpeedLabel=lfSpeedLabel;
})();

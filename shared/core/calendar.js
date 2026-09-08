// 山河志·历法与天候（v20260907v）
// 从原 engine.js 的「历法/天候」分节抽出：纯数据 + 仅读全局 state 的纯函数。
// 依赖 shared/core/state.js 暴露的全局 state / LF；须在其后、engine.js 之前加载。
// 注意：本分节在原文件中还裹着「地图坐标系统 / 山河志地图渲染 / 存档系统」，
// 那些仍强耦合引擎闭包（state/G/SLOTS 与 save/normalize/renderRoom 等兄弟函数），暂留 engine.js。
window.LF = window.LF || {};
(function(){
  LF.Core = LF.Core || {};
  var LUNAR_MONTHS=['正','二','三','四','五','六','七','八','九','十','冬','腊'];
  var LUNAR_START={month:12, day:15};   // 游戏始于「光和元年·腊月十五」（示例锚定）
  var WK=['日','一','二','三','四','五','六'];   // 星期（公历对照用，仅弹窗展示）
  var WK_BASE=5;                        // 腊月十五 = 星期五（示例锚定，保证对照可读）
  var WEATHERS=[
    {n:'晴',  ic:'☀'},
    {n:'多云',ic:'🌤'},
    {n:'阴',  ic:'☁'},
    {n:'微雨',ic:'🌦'},
    {n:'大雨',ic:'🌧'},
    {n:'雪',  ic:'❄'},
    {n:'雾',  ic:'🌫'},
    {n:'风',  ic:'🌬'}
  ];
  // 郊野 × 天候/昼夜 影响模型（v20260905d）：状态栏早已显示天候，此处让机制真正生效。
  // walk:郊野每移一格的额外精力损耗；hunt:猎取潜行的成功率修正；amb:敌对伏击/夜袭概率修正。
  var WX_EFF=[
    {walk:0,   hunt:0,    amb:0,    tip:''},
    {walk:0,   hunt:0,    amb:0,    tip:''},
    {walk:0,   hunt:0,    amb:0.05, tip:'天色阴沉，林间易藏凶徒。'},
    {walk:1,   hunt:0.08, amb:0.08, tip:'细雨湿滑，行路费力，柴薪易湿。'},
    {walk:2,   hunt:0.10, amb:0.12, tip:'大雨滂沱！行路疲惫，露宿篝火皆难安身。'},
    {walk:2,   hunt:0.12, amb:0.05, tip:'风雪交加，天寒地冻，行路疲累。'},
    {walk:1,   hunt:0.15, amb:0.22, tip:'浓雾迷离，难辨远近——伏击难防，却宜潜行猎兽。'},
    {walk:1,   hunt:0,    amb:0,    tip:'朔风扑面，行路吃力。'}
  ];
  function isDaytime(){ var t=(LF.Core.state.time||0)%12; return t>=3 && t<=9; }  // 卯~酉为昼
  function wxEff(){ return WX_EFF[LF.Core.state.weather] || WX_EFF[0]; }
  function mapData(){ return (window.LF && LF.MAP) || {}; }
  function lunarDayName(d){
    var cn=['','一','二','三','四','五','六','七','八','九','十'];
    if(d>=1&&d<=10) return '初'+cn[d];
    if(d>=11&&d<=19) return '十'+cn[d-10];
    if(d===20) return '二十';
    if(d>=21&&d<=29) return '廿'+cn[d-20];
    return '三十';
  }
  // 由累计天数派生农历月日 / 年号年序 / 公历对照 / 星期（确定性、可重算）
  function deriveCalendar(){
    var d=LF.Core.state.day||0;
    var totalMonths=(LUNAR_START.month-1)+Math.floor(d/30);
    var month=(totalMonths%12)+1;
    var day=((LUNAR_START.day-1)+(d%30))%30+1;
    var years=Math.floor(totalMonths/12);
    return {
      month:month, day:day,
      monthName:LUNAR_MONTHS[month-1],
      dayName:lunarDayName(day),
      eraYear:1+years,
      adYear:178+years,
      wk:WK[(WK_BASE+d)%7],
      gregMonth:month, gregDay:day
    };
  }
  // 暴露到 LF.Core（不再污染 window），engine.js 顶部统一取别名使用
  LF.Core.LUNAR_MONTHS=LUNAR_MONTHS; LF.Core.LUNAR_START=LUNAR_START;
  LF.Core.WK=WK; LF.Core.WK_BASE=WK_BASE; LF.Core.WEATHERS=WEATHERS; LF.Core.WX_EFF=WX_EFF;
  LF.Core.isDaytime=isDaytime; LF.Core.wxEff=wxEff; LF.Core.mapData=mapData;
  LF.Core.lunarDayName=lunarDayName; LF.Core.deriveCalendar=deriveCalendar;
})();

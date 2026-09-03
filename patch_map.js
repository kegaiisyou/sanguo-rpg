// 修改 index.html：替换大地图为战略地图
const fs = require('fs');

const filePath = 'C:/Users/Administrator/CodeBuddy/20260402085532/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. 在 initMapKing 函数后添加战略地图函数
// 找到 initMapKing 函数的结束位置（第7910行附近）
const strategicMapFuncs = `
  // ===== 战略地图（D3 矢量 · 三国州郡）=====
  function buildStrategicMapHTML(opts){
    opts=opts||{};
    var title = opts.pickSpawn ? '选择出生点' : '山河志 · 战略地图';
    var tip = opts.pickSpawn
      ? '点击一处城池设为出生点，并立即传送至此。'
      : '拖拽平移 · 滚轮缩放 · 点击城池前往（体力-4 · 食物-1 · 饮水-1 · 时间+1刻）。当前位于「'+curRoom().name+'」。';
    return '<h3>'+title+'</h3>'+
      '<div id="strategic-map-container"></div>'+
      '<p class="tip">'+tip+'</p>';
  }
  function initStrategicMapInGame(opts){
    opts=opts||{};
    var container=document.getElementById('strategic-map-container');
    if(!container) return;
    if(!window.LF || !LF.initStrategicMap){
      container.innerHTML='<div class="strategic-loading">战略地图加载中...</div>';
      return;
    }
    // 选出生点模式
    if(opts.pickSpawn){
      LF.initStrategicMap(container, {
        onCityClick: function(city){
          if(!city || !city.id) return;
          state.spawnRoom=city.id;
          log('【调试】出生点已设为：'+city.name+'。','good');
          closeModal(); renderRoom(city.id); save(state);
        }
      });
    } else {
      // 正常模式：点击城市传送
      LF.initStrategicMap(container, {
        onCityClick: function(city){
          if(!city || !city.id) return;
          goRoomOnMap(city.id);
        }
      });
    }
  }
`;

// 在 initMapKing 函数结束后插入（找到 "function closeModal" 之前）
if (!html.includes('buildStrategicMapHTML')) {
  html = html.replace('  function closeModal(){', strategicMapFuncs + '\n  function closeModal(){');
  console.log('已添加战略地图函数');
}

// 2. 修改调用位置：buildMapKingHTML -> buildStrategicMapHTML
html = html.replace('h=buildMapKingHTML({});', 'h=buildStrategicMapHTML({});');
console.log('已替换 buildMapKingHTML 调用');

// 3. 修改调用位置：initMapKing -> initStrategicMapInGame
html = html.replace('else initMapKing({});', 'else initStrategicMapInGame({});');
console.log('已替换 initMapKing 调用');

fs.writeFileSync(filePath, html, 'utf8');
console.log('index.html 已更新完成');

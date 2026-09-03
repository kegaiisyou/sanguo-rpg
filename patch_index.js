// 修改 index.html：添加战略地图 CSS/JS 引用，替换大地图函数
const fs = require('fs');

const filePath = 'C:/Users/Administrator/CodeBuddy/20260402085532/index.html';
let html = fs.readFileSync(filePath, 'utf8');

// 1. 在 </head> 前添加战略地图 CSS 引用
const cssLink = '<link rel="stylesheet" href="shared/css/strategic-map.css?v=20260902b" />\n';
if (!html.includes('strategic-map.css')) {
  html = html.replace('</head>', cssLink + '</head>');
  console.log('已添加战略地图 CSS 引用');
}

// 2. 在 cities.js 引用后添加 d3.js、turf.js、战略地图 JS 引用
const jsRefs = [
  '<script src="shared/vendor/d3.min.js?v=20260902b"></script>',
  '<script src="shared/vendor/turf.min.js?v=20260902b"></script>',
  '<script src="shared/strategic-map.js?v=20260902b"></script>',
];
const citiesRef = '<script src="shared/data/cities.js?v=20260902a"></script>';
if (!html.includes('strategic-map.js')) {
  html = html.replace(citiesRef, citiesRef + '\n    ' + jsRefs.join('\n    '));
  console.log('已添加 d3/turf/战略地图 JS 引用');
}

fs.writeFileSync(filePath, html, 'utf8');
console.log('index.html 已更新');

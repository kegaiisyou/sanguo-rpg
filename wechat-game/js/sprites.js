// ==================== 立绘资源加载 ====================
// 加载 11 张 192x288 透明背景像素立绘，供地图/战斗/对话绘制
// 资源位于代码包根目录 assets/pixel_chars/

var BASE = 'assets/pixel_chars/';

// 立绘键名（与 assets/pixel_chars 下的文件名一一对应）
var SPRITE_KEYS = [
  'hero',             // 玩家·少侠
  'yellow_turban',    // 黄巾贼 (bandit)
  'xiliang_soldier',  // 西凉兵 (bully)
  'captain',          // 偏将/副将 (guard)
  'boss',             // 华雄 (boss)
  'hanbo',            // 县尉韩伯 (master)
  'hualao',           // 医者/行商 (doctor)
  'deputy_general',   // 校尉/斥候/卫兵 (escort)
  'zuoci',            // 方士左慈 (monk)
  'shuijing',         // 水镜先生 (hermit)
  'storyteller'       // 说书人/序幕
];

var sprites = {};
var loadedCount = 0;
var totalCount = SPRITE_KEYS.length;

function makeImage(key) {
  var img = wx.createImage();
  img.onload = function () { loadedCount++; };
  // 加载失败静默处理，绘制层会回退到几何兜底
  img.onerror = function () {};
  img.src = BASE + key + '.png';
  return img;
}

SPRITE_KEYS.forEach(function (k) {
  sprites[k] = makeImage(k);
});

function get(key) {
  return sprites[key];
}

// 图片是否真正解码完成（width>0 表示已可用）
function isReady(key) {
  var img = sprites[key];
  return !!(img && img.width && img.width > 0);
}

function allLoaded() {
  return loadedCount >= totalCount;
}

function progress() {
  return loadedCount + '/' + totalCount;
}

module.exports = {
  get: get,
  isReady: isReady,
  allLoaded: allLoaded,
  progress: progress,
  keys: SPRITE_KEYS
};

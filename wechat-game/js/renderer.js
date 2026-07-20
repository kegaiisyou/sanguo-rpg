// ==================== 乱世烽火 - Canvas渲染器 ====================
// 负责所有画面绘制：地图、角色、UI、战斗、对话、背包等

var data = require('./data.js');
var sprites = require('./sprites.js');
var TILE = 40;

// 角色类型 -> 立绘键名（对应 assets/pixel_chars 下的文件）
function spriteKeyFor(type, sub) {
  if (type === 'player') return 'hero';
  if (type === 'enemy') {
    if (sub === 'bully') return 'xiliang_soldier';
    if (sub === 'guard') return 'captain';
    if (sub === 'boss') return 'boss';
    return 'yellow_turban'; // bandit 默认
  }
  if (type === 'npc') {
    if (sub === 'doctor') return 'hualao';
    if (sub === 'escort') return 'deputy_general';
    if (sub === 'monk') return 'zuoci';
    if (sub === 'hermit') return 'shuijing';
    return 'hanbo'; // master 默认
  }
  return 'hero';
}

// 全局canvas和上下文引用
var canvas = null;
var ctx = null;
var W = 0, H = 0;
var dpr = 1;

// 安全边距：避免刘海、小程序胶囊、底部全面屏手势误触
var SAFE_TOP = 0, SAFE_BOTTOM = 0, SAFE_SIDE = 0;
function updateSafeArea() {
  SAFE_TOP = Math.max(28, Math.floor(H * 0.035));
  SAFE_BOTTOM = Math.max(26, Math.floor(H * 0.04));
  SAFE_SIDE = Math.max(18, Math.floor(W * 0.045));
}

// 相机偏移
var camX = 0, camY = 0;

// 动画状态
var animFrame = 0;
var shakeTimer = 0;
var shakeIntensity = 0;
var shakeTarget = ''; // 'player' or 'enemy'
var flashAlpha = 0;
var playerFacing = 'down';   // 'up' | 'down' | 'left' | 'right'
var playerMoving = false;
var battleLogLines = [];
var mapBannerText = '';
var mapBannerAlpha = 0;
var hintText = '';
var hintTimer = 0;

function initRenderer(c, w, h, d) {
  canvas = c;
  ctx = c.getContext('2d');
  W = w;
  H = h;
  dpr = d || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;
  updateSafeArea();
}

// ==================== 相机 ====================
function updateCamera(px, py, mapW, mapH) {
  var mw = mapW * TILE;
  var mh = mapH * TILE;
  var cx = px * TILE + TILE / 2;
  var cy = py * TILE + TILE / 2;

  if (mw <= W) camX = (W - mw) / 2;
  else camX = Math.max(W - mw, Math.min(0, W / 2 - cx));
  if (mh <= H) camY = (H - mh) / 2;
  else camY = Math.max(H - mh, Math.min(0, H / 2 - cy));
}

// ==================== 地图渲染 ====================

// 确定性伪随机（保证纹理稳定不抖动）
function tileHash(x, y) {
  var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// 程序化瓦片：底色 + 纹理，去除"纯色块廉价感"
function drawTile(t, gx, gy) {
  var px = gx * TILE + 1;
  var py = gy * TILE + 1;
  var s = TILE - 2;
  var tileColors = {
    G: '#4a7c2e', F: '#2d6b1e', P: '#c4a46c', W: '#5e2d20',
    H: '#7b6b5a', V: '#5d4037', D: '#5c1515', S: '#c06014',
    A: '#b8860b', C: '#3a4a58', B: '#6b5a4a', T: '#5d5550', R: '#c4a35a'
  };
  var base = tileColors[t] || '#333';
  ctx.fillStyle = base;
  ctx.fillRect(px, py, s, s);

  if (t === 'G' || t === 'F') {
    // 草地：散布深浅草斑与短草
    for (var i = 0; i < 5; i++) {
      var rx = px + tileHash(gx * 3 + i, gy * 7) * s;
      var ry = py + tileHash(gx * 5, gy * 3 + i) * s;
      var shade = tileHash(gx + i, gy + i);
      ctx.fillStyle = shade > 0.5 ? 'rgba(120,170,70,0.5)' : 'rgba(30,70,20,0.5)';
      ctx.fillRect(rx, ry, 2, 2);
    }
    ctx.strokeStyle = 'rgba(30,80,25,0.6)';
    ctx.lineWidth = 1;
    for (var k = 0; k < 3; k++) {
      var gx2 = px + tileHash(gx * 9 + k, gy * 2) * s;
      var gy2 = py + tileHash(gx * 4, gy * 9 + k) * s;
      ctx.beginPath();
      ctx.moveTo(gx2, gy2 + 4);
      ctx.lineTo(gx2, gy2);
      ctx.stroke();
    }
  } else if (t === 'P') {
    // 泥路：碎石点
    for (var j = 0; j < 4; j++) {
      var cx2 = px + tileHash(gx * 2 + j, gy * 5) * s;
      var cy2 = py + tileHash(gx * 6, gy * 2 + j) * s;
      ctx.fillStyle = tileHash(gx + j, gy) > 0.5 ? 'rgba(150,120,80,0.6)' : 'rgba(90,70,45,0.6)';
      ctx.fillRect(cx2, cy2, 2, 2);
    }
  } else if (t === 'W') {
    // 木墙：竖木纹 + 上高光下暗边（立体）
    ctx.fillStyle = 'rgba(255,180,120,0.12)';
    ctx.fillRect(px, py, s, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px, py + s - 3, s, 3);
    ctx.strokeStyle = 'rgba(40,20,12,0.5)';
    ctx.lineWidth = 1;
    for (var m = 1; m < 3; m++) {
      ctx.beginPath();
      ctx.moveTo(px + m * s / 3, py + 2);
      ctx.lineTo(px + m * s / 3, py + s - 2);
      ctx.stroke();
    }
  } else if (t === 'H' || t === 'V') {
    // 石墙：砖缝
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
    ctx.beginPath();
    ctx.moveTo(px, py + s / 2);
    ctx.lineTo(px + s, py + s / 2);
    ctx.stroke();
  } else if (t === 'C') {
    // 水面：波纹（随动画轻微流动）
    ctx.strokeStyle = 'rgba(120,180,220,0.45)';
    ctx.lineWidth = 1;
    var off = Math.sin((gx + gy) * 0.6 + animFrame * 0.05) * 2;
    ctx.beginPath();
    ctx.moveTo(px + 3, py + s / 2 + off);
    ctx.quadraticCurveTo(px + s / 2, py + s / 2 - 3 + off, px + s - 3, py + s / 2 + off);
    ctx.stroke();
  } else if (t === 'D') {
    ctx.fillStyle = 'rgba(255,120,90,0.18)';
    ctx.beginPath();
    ctx.arc(px + s / 2, py + s / 2, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (t === 'S') {
    ctx.strokeStyle = 'rgba(255,200,120,0.5)';
    ctx.lineWidth = 1;
    for (var q = 0; q < 3; q++) {
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 8 + q * 8);
      ctx.lineTo(px + s - 4, py + 8 + q * 8);
      ctx.stroke();
    }
  } else if (t === 'A') {
    ctx.fillStyle = tileHash(gx, gy) > 0.6 ? 'rgba(255,235,150,0.6)' : 'rgba(120,80,0,0.4)';
    ctx.fillRect(px + s / 2 - 2, py + s / 2 - 2, 4, 4);
  }
}

// 屏幕暗角，增强聚焦感
function drawVignette() {
  var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawMap(mapData, npcs, enemies, deadEnemies, px, py) {
  // 背景
  ctx.fillStyle = '#0d0a10';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(camX, camY);

  // 地图底色
  ctx.fillStyle = '#2d5016';
  ctx.fillRect(0, 0, mapData[0].length * TILE, mapData.length * TILE);

  var tileColors = {
    G: '#4a7c2e', F: '#2d6b1e', P: '#c4a46c', W: '#5e2d20',
    H: '#7b6b5a', V: '#5d4037', D: '#5c1515', S: '#c06014',
    A: '#b8860b', C: '#3a4a58', B: '#6b5a4a', T: '#5d5550', R: '#c4a35a'
  };

  // 绘制瓦片（带程序化纹理）
  for (var y = 0; y < mapData.length; y++) {
    for (var x = 0; x < mapData[y].length; x++) {
      var t = mapData[y][x];
      drawTile(t, x, y);
    }
  }


  // 绘制边缘出入口指示
  drawMapEdges(mapData, npcs, enemies, deadEnemies);

  // 绘制敌人（只绘制活着的）
  if (enemies) {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!deadEnemies || !deadEnemies[e.id]) {
        drawActor(e.x, e.y, e.color, e.name, 'enemy', e.type);
      }
    }
  }

  // 绘制NPC
  if (npcs) {
    for (var i = 0; i < npcs.length; i++) {
      var n = npcs[i];
      var npcColor = { skin: '#fce5d8', hair: '#555', cloth: n.color };
      if (n.type === 'monk') npcColor = { skin: '#fce5d8', hair: '#fff', cloth: n.color };
      if (n.type === 'hermit') npcColor = { skin: '#c8a882', hair: '#ccc', cloth: n.color };
      drawActor(n.x, n.y, npcColor, n.name, 'npc', n.type);
    }
  }

  // 绘制玩家
  drawActor(px, py, { skin: '#ffe0bd', hair: '#3d2817', cloth: '#1a5276' }, '少侠', 'player', 'player');

  ctx.restore();

  // 屏幕暗角
  drawVignette();
}

function drawMapEdges(mapData, npcs, enemies, deadEnemies) {
  var exits = [];
  if (data.allMaps && data.allMaps[data.currentMap]) {
    exits = data.allMaps[data.currentMap].exits || [];
  }
  var mw = mapData[0].length, mh = mapData.length;

  function addLabel(x, y, arrow, label) {
    var t = mapData[y] && mapData[y][x];
    if (t === 'W' || t === 'C') return;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = 'rgba(212,168,83,0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    ctx.fillStyle = 'rgba(212,168,83,0.9)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(arrow, x * TILE + TILE / 2, y * TILE + TILE / 2 - 2);
    ctx.fillStyle = 'rgba(200,180,130,0.75)';
    ctx.font = '7px sans-serif';
    ctx.fillText(label, x * TILE + TILE / 2, y * TILE + TILE / 2 + 10);
  }

  for (var i = 0; i < exits.length; i++) {
    var e = exits[i];
    var targetName = (data.allMaps && data.allMaps[e.to]) ? data.allMaps[e.to].name : e.to;
    var r0 = e.range[0], r1 = e.range[1];
    if (e.dir === 'north') {
      for (var x = r0; x <= r1; x++) addLabel(x, 0, '▲', targetName);
    } else if (e.dir === 'south') {
      for (var x = r0; x <= r1; x++) addLabel(x, mh - 1, '▼', targetName);
    } else if (e.dir === 'west') {
      for (var y = r0; y <= r1; y++) addLabel(0, y, '◄', targetName);
    } else if (e.dir === 'east') {
      for (var y = r0; y <= r1; y++) addLabel(mw - 1, y, '►', targetName);
    }
  }
}

// ==================== 颜色辅助工具 ====================

// 颜色明暗调整：hex -> rgb 字符串，amt ∈ [-1,1]（正变亮/负变暗）
function shade(hex, amt) {
  if (!hex) hex = '#888888';
  hex = ('' + hex).replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
  var f = amt < 0 ? 0 : 255, t = Math.abs(amt);
  r = Math.round((f - r) * t) + r; g = Math.round((f - g) * t) + g; b = Math.round((f - b) * t) + b;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ==================== 像素立绘角色绘制（替代程序化几何人形） ====================

// 用预加载的 192×288 像素立绘绘制角色，自动等比缩放
function drawSpriteChar(cx, footY, h, key, facing) {
  if (!key) {
    drawFallbackChar(cx, footY, h);
    return;
  }
  var img = sprites.get(key);
  if (!img || !img.width || !img.height) {
    drawFallbackChar(cx, footY, h);
    return;
  }

  var ratio = img.width / img.height;
  var drawH = h;
  var drawW = Math.round(drawH * ratio);
  var drawX = Math.round(cx - drawW / 2);
  var drawY = Math.round(footY - drawH);

  if (facing === 'left') {
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-drawW / 2), drawY, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
}

// 立绘未加载时的极简占位符
function drawFallbackChar(cx, footY, h) {
  var w = Math.round(h * 0.45);
  ctx.fillStyle = 'rgba(60,50,40,0.7)';
  ctx.fillRect(cx - w / 2, footY - h, w, h);
  ctx.strokeStyle = 'rgba(180,140,80,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, footY - h, w, h);
  ctx.fillStyle = 'rgba(180,140,80,0.8)';
  var fs = Math.max(10, Math.round(h * 0.18));
  ctx.font = fs + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('…', cx, footY - h / 2 + fs / 3);
  ctx.textAlign = 'start';
}

// 旧版 drawHumanoid 已移除，全部使用像素立绘 sprite 渲染

// 圆角进度条（血/蓝）
function drawBar(x, y, w, h, pct, color) {
  pct = Math.max(0, Math.min(1, pct));
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(x, y, w, h, h / 2); ctx.fill();
  if (pct > 0) {
    ctx.fillStyle = color;
    roundRect(x, y, Math.max(h, w * pct), h, h / 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(245,225,170,0.55)';
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, h / 2); ctx.stroke();
}

// ==================== 角色绘制（使用像素立绘） ====================
function drawActor(gx, gy, color, name, type, subType) {
  var footX = gx * TILE + TILE / 2;
  var footY = gy * TILE + TILE - 2;

  // 抖动偏移
  var sx = 0, sy = 0;
  if (shakeTimer > 0) {
    if ((shakeTarget === 'player' && type === 'player') ||
        (shakeTarget === 'enemy' && type === 'enemy')) {
      sx = Math.sin(shakeTimer * 20) * shakeIntensity * 6;
      sy = Math.cos(shakeTimer * 17) * shakeIntensity * 3;
    }
  }

  // 行走动画
  var bob = (type === 'player' && playerMoving && animFrame % 30 < 15) ? -1 : 0;

  var cx = footX + sx;
  var cy = footY + sy + bob;
  var h = 52;  // 像素立绘偏高瘦，略加大高度

  var facing = (type === 'player') ? playerFacing : 'down';
  var key = spriteKeyFor(type, subType);

  // 地面阴影
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, footY + sy + 1, h * 0.22, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  drawSpriteChar(cx, cy, h, key, facing);

  // 名字标签
  ctx.font = '9px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  var nameBgW = Math.max(40, ctx.measureText(name).width + 12);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(cx - nameBgW / 2, cy - h - 6, nameBgW, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#f0e0c0';
  ctx.fillText(name, cx, cy - h + 4);
  ctx.textAlign = 'start'; // 重置

  // 闪白效果
  if (flashAlpha > 0 && ((shakeTarget === 'player' && type === 'player') ||
                         (shakeTarget === 'enemy' && type === 'enemy'))) {
    ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
    ctx.fillRect(cx - h * 0.22, cy - h, h * 0.44, h);
  }
}

// ==================== UI绘制 ====================
function drawStatusBar(player) {
  var barH = 72;
  var barY = 0;
  drawScrollPanel(0, barY, W, barH + SAFE_TOP, { r: 0 });
  ctx.strokeStyle = '#c89b4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY + barH + SAFE_TOP - 1);
  ctx.lineTo(W, barY + barH + SAFE_TOP - 1);
  ctx.stroke();

  var cols = 5;
  var contentX = SAFE_SIDE;
  var contentW = W - SAFE_SIDE * 2;
  var cw = contentW / cols;
  var cx = contentX;

  // Lv
  drawStat(cx, barY + SAFE_TOP, cw, barH, '⭐', 'Lv.' + player.level, '', '#d4a853', '#8b7355', true,
    player.exp, player.expNeed, 'exp');
  cx += cw;
  // HP
  drawStat(cx, barY + SAFE_TOP, cw, barH, '❤️', player.hp + '/' + player.maxHp, '', '#e74c3c', '#8b7355', true,
    player.hp, player.maxHp, 'hp');
  cx += cw;
  // MP
  drawStat(cx, barY + SAFE_TOP, cw, barH, '💠', player.mp + '/' + player.maxMp, '', '#3498db', '#8b7355', true,
    player.mp, player.maxMp, 'mp');
  cx += cw;
  // ATK
  drawStat(cx, barY + SAFE_TOP, cw, barH, '⚔️', '' + player.atk, '攻击', '#d4a853', '#8b7355', false);
  cx += cw;
  // Gold
  drawStat(cx, barY + SAFE_TOP, cw, barH, '💰', '' + player.gold, '五铢钱', '#d4a853', '#8b7355', false);
}

function drawStat(x, y, w, h, icon, val, label, valColor, labelColor, hasBar, cur, max, type) {
  ctx.fillStyle = valColor;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(icon + ' ' + val, x + w / 2, y + 20);

  if (label) {
    ctx.fillStyle = labelColor;
    ctx.font = '8px sans-serif';
    ctx.fillText(label, x + w / 2, y + 34);
  }

  if (hasBar && max) {
    var barW = w - 10, barH = 4;
    var bx = x + 5, by = y + 40;
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx, by, barW, barH);

    var pct = Math.max(0, Math.min(1, cur / max));
    var barColors = { hp: '#c0392b', mp: '#2e8b8b', exp: '#d4a853' };
    ctx.fillStyle = barColors[type] || '#d4a853';
    ctx.fillRect(bx, by, barW * pct, barH);
  }
}

function drawActionBar() {
  var barH = 44;
  var barY = H - barH - SAFE_BOTTOM;
  // 背景延伸至底部，按钮悬在安全区上方
  ctx.fillStyle = 'rgba(10,6,2,0.92)';
  ctx.fillRect(0, barY, W, barH + SAFE_BOTTOM);
  ctx.strokeStyle = '#c89b4a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(W, barY);
  ctx.stroke();
  // 顶部分隔阴影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, barY - 2, W, 2);

  var btns = ['🎒行囊', '📜任务', '🧘调息', '⚙️设置'];
  var bcolors = ['#8a5a2b', '#2e6b4f', '#2e6b8b', '#555'];
  var margin = SAFE_SIDE;
  var bw = (W - margin * 2 - (btns.length - 1) * 8) / btns.length;
  for (var i = 0; i < btns.length; i++) {
    var bx = margin + i * (bw + 8), by = barY + 6, bww = bw, bhh = barH - 12;
    drawSealBtn(bx, by, bww, bhh, btns[i], bcolors[i], true, { r: 4, font: 'bold 11px sans-serif' });
  }
}

// 虚拟方向键——透明玻璃质感，不挡地图
function drawDPad() {
  var dSize = 52, gap = 5, padX = SAFE_SIDE + 4;
  var actionBarH = 44;
  var dPadH = 3 * dSize + 2 * gap;
  var padY = H - SAFE_BOTTOM - actionBarH - dPadH - 24;
  var btns = [
    { x: 1, y: 0, dir: 'up', sym: '▲' },
    { x: 0, y: 1, dir: 'left', sym: '◄' },
    { x: 2, y: 1, dir: 'right', sym: '►' },
    { x: 1, y: 2, dir: 'down', sym: '▼' }
  ];

  for (var i = 0; i < btns.length; i++) {
    var b = btns[i];
    var bx = padX + b.x * (dSize + gap);
    var by = padY + b.y * (dSize + gap);

    // 玻璃质感半透明底 + 金边
    ctx.fillStyle = 'rgba(20,12,4,0.38)';
    roundRect(bx, by, dSize, dSize, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(200,150,60,0.35)';
    ctx.lineWidth = 1;
    roundRect(bx, by, dSize, dSize, 8); ctx.stroke();

    // 内发光
    var g = ctx.createLinearGradient(bx, by, bx, by + dSize);
    g.addColorStop(0, 'rgba(255,220,140,0.10)');
    g.addColorStop(0.5, 'rgba(255,220,140,0.02)');
    g.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = g;
    roundRect(bx + 2, by + 2, dSize - 4, dSize - 4, 7); ctx.fill();

    // 方向箭头
    ctx.fillStyle = 'rgba(232,200,130,0.9)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.sym, bx + dSize / 2, by + dSize / 2 + 5);
  }

  // 交互按钮（右下角铜环，半透明）
  var acx = W - SAFE_SIDE - 34, acy = padY + dSize + 34;
  // 外环
  ctx.fillStyle = 'rgba(30,15,5,0.40)';
  ctx.beginPath(); ctx.arc(acx, acy, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,150,60,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(acx, acy, 30, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,150,60,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(acx, acy, 26, 0, Math.PI * 2); ctx.stroke();
  // 图标
  ctx.fillStyle = 'rgba(232,200,130,0.85)';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✋', acx, acy + 6);
  ctx.fillStyle = 'rgba(232,200,130,0.6)';
  ctx.font = '8px sans-serif';
  ctx.fillText('交互', acx, acy + 18);
}

// ==================== 对话框 ====================
function drawDialog(speaker, text, choices, portraitKey) {
  var dh = 140;
  var dy = H - dh - SAFE_BOTTOM;
  drawScrollPanel(0, dy, W, dh, { r: 0 });
  ctx.strokeStyle = '#c89b4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, dy + 1);
  ctx.lineTo(W, dy + 1);
  ctx.stroke();

  // 角色头像（铜框 + 像素立绘）
  ctx.save();
  ctx.beginPath();
  ctx.rect(12, dy + 12, 56, 72);
  ctx.clip();
  ctx.fillStyle = '#1a120a';
  ctx.fillRect(12, dy + 12, 56, 72);
  drawSpriteChar(40, dy + 12 + 70, 68, portraitKey || 'hero');
  ctx.restore();
  ctx.strokeStyle = '#c89b4a';
  ctx.lineWidth = 2;
  roundRect(12, dy + 12, 56, 72, 6);
  ctx.stroke();

  // 名字（古风木牌标签）
  drawSealBtn(80, dy + 14, Math.max(64, speaker.length * 13 + 18), 22, speaker, '#7a3a1a', true, { r: 4, font: 'bold 12px "STKaiti","KaiTi",serif', textColor: '#ffe9c0' });

  // 对话文本
  ctx.fillStyle = '#d8c8a8';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  var lines = wrapText(text, W - 100, 12);
  for (var i = 0; i < Math.min(lines.length, 3); i++) {
    ctx.fillText(lines[i], 80, dy + 50 + i * 18);
  }

  // 选项按钮
  if (choices && choices.length > 0) {
    for (var i = 0; i < choices.length; i++) {
      var bx = 80 + i * 110;
      drawSealBtn(bx, dy + dh - 36, 100, 28, choices[i], '#8a5a2b', true, { r: 4, font: '11px sans-serif', textColor: '#ffe9c0' });
    }
  }
}

// ==================== 战斗面板 ====================
// ==================== 战斗演出特效 ====================
var damagePopups = [];   // {side:'player'|'enemy', value, crit, life}
var slashFx = { life: 0, target: '' };

function addDamage(value, target, crit) {
  damagePopups.push({ side: target, value: value, crit: !!crit, life: 1 });
}

function triggerSlash(target) {
  slashFx.life = 1;
  slashFx.target = target;
}

function tickEffects(dt) {
  for (var i = damagePopups.length - 1; i >= 0; i--) {
    damagePopups[i].life -= dt / 700;
    if (damagePopups[i].life <= 0) damagePopups.splice(i, 1);
  }
  if (slashFx.life > 0) {
    slashFx.life -= dt / 260;
    if (slashFx.life < 0) slashFx.life = 0;
  }
}

function drawBattleFX() {
  var pcy = 160;
  // 刀光
  if (slashFx.life > 0) {
    var sx = slashFx.target === 'enemy' ? W * 0.725 : W * 0.275;
    var sy = pcy + 58;
    ctx.save();
    ctx.globalAlpha = Math.max(0, slashFx.life);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, 32, -0.9, 0.9);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,120,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 26, -0.7, 1.1);
    ctx.stroke();
    ctx.restore();
  }
  // 漂浮伤害数字
  ctx.textAlign = 'center';
  for (var i = 0; i < damagePopups.length; i++) {
    var p = damagePopups[i];
    var bx = p.side === 'enemy' ? W * 0.725 : W * 0.275;
    var by = pcy + 58 - (1 - p.life) * 36;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.font = (p.crit ? 'bold 26px' : 'bold 18px') + ' sans-serif';
    ctx.fillStyle = p.crit ? '#ffd54a' : '#ff7b6b';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    var txt = (p.crit ? '暴击 ' : '') + p.value;
    ctx.strokeText(txt, bx, by);
    ctx.fillText(txt, bx, by);
    ctx.restore();
  }
}

function drawBattle(player, enemy, enemyHp, enemyMaxHp, logLines) {
  // 背景（墨底）
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(18,10,8,0.97)');
  bg.addColorStop(0.5, 'rgba(10,6,10,0.98)');
  bg.addColorStop(1, 'rgba(18,10,8,0.97)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 战斗标题（古风 + 祥云把手）
  ctx.fillStyle = '#d4a853';
  ctx.font = 'bold 18px "STKaiti","KaiTi",serif';
  ctx.textAlign = 'center';
  ctx.fillText('狭 路 相 逢', W / 2, 40);
  ctx.strokeStyle = 'rgba(212,168,83,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 70, 48); ctx.lineTo(W / 2 - 20, 48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + 20, 48); ctx.lineTo(W / 2 + 70, 48); ctx.stroke();
  drawCloudCorner(W / 2 - 80, 42, 12, 1, 1);
  drawCloudCorner(W / 2 + 80, 42, 12, -1, 1);

  // 角色卡通用参数
  var pcy = 160;
  var cardH = 190;

  // 玩家角色卡
  var px = W * 0.1, pw = W * 0.35;
  drawScrollPanel(px, pcy - 20, pw, cardH, { r: 8 });
  var pax = px + (pw - 84) / 2, pay = pcy + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(pax, pay, 84, 100, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(200,155,74,0.4)'; ctx.lineWidth = 1;
  roundRect(pax, pay, 84, 100, 6); ctx.stroke();
  drawSpriteChar(px + pw / 2, pay + 96, 140, 'hero');

  ctx.fillStyle = '#e8d5a3';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('少侠', px + pw / 2, pcy + 122);
  ctx.fillStyle = '#a89070';
  ctx.font = '10px sans-serif';
  ctx.fillText('气血:' + player.hp + '/' + player.maxHp + ' 内力:' + player.mp + '/' + player.maxMp, px + pw / 2, pcy + 138);

  drawBar(px + 14, pcy + 150, pw - 28, 9, player.hp / player.maxHp, '#c0392b');
  drawBar(px + 14, pcy + 164, pw - 28, 6, player.mp / player.maxMp, '#2e8b8b');

  // VS 铜环
  ctx.save();
  var vx = W / 2, vy = pcy + 70;
  var vg = ctx.createRadialGradient(vx - 4, vy - 4, 2, vx, vy, 22);
  vg.addColorStop(0, '#b5662e');
  vg.addColorStop(1, '#6e2f12');
  ctx.fillStyle = vg;
  ctx.beginPath(); ctx.arc(vx, vy, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e8c080'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff7e6'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('⚔️', vx, vy + 7);
  ctx.restore();

  // 敌人角色卡
  var ex = W * 0.55, ew = W * 0.35;
  drawScrollPanel(ex, pcy - 20, ew, cardH, { r: 8 });
  var eax = ex + (ew - 84) / 2, eay = pcy + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(eax, eay, 84, 100, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(200,155,74,0.4)'; ctx.lineWidth = 1;
  roundRect(eax, eay, 84, 100, 6); ctx.stroke();
  drawSpriteChar(ex + ew / 2, eay + 96, 140, spriteKeyFor('enemy', enemy.type));

  ctx.fillStyle = '#e8d5a3';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(enemy.name, ex + ew / 2, pcy + 122);
  ctx.fillStyle = '#a89070';
  ctx.font = '10px sans-serif';
  ctx.fillText('气血:' + enemyHp + '/' + enemyMaxHp, ex + ew / 2, pcy + 138);

  drawBar(ex + 14, pcy + 150, ew - 28, 9, Math.max(0, enemyHp) / enemyMaxHp, '#c0392b');

  // 战斗日志
  ctx.fillStyle = '#d4a853';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  var ly = pcy + 175;
  for (var i = 0; i < logLines.length; i++) {
    ctx.fillText(logLines[i], W / 2, ly + i * 18);
  }

  // 操作按钮
  var margin = SAFE_SIDE;
  var btw = (W - margin * 2 - 3 * 6) / 4;
  var bty = H - SAFE_BOTTOM - 44;
  var blabels = ['⚔️出战', '🗡️霸王枪', '🎒行囊', '💨撤离'];
  var bcolors = ['#a83232', '#2e6b8b', '#2e6b4f', '#555'];
  for (var i = 0; i < 4; i++) {
    var btx = margin + i * (btw + 6);
    drawSealBtn(btx, bty, btw, 44, blabels[i], bcolors[i], true, { r: 6, font: 'bold 11px sans-serif', textColor: '#fff7e6' });
  }

  // 战斗演出特效（飘字/刀光）绘制在最上层
  drawBattleFX();
}

// 立绘由 drawSpriteChar 统一绘制（使用 assets/pixel_chars 下的像素 PNG）


// ==================== 标题画面 ====================
function drawTitleScreen(hasSave) {
  // 深色渐变背景
  var grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#1a0808');
  grd.addColorStop(0.3, '#2d1010');
  grd.addColorStop(0.7, '#0d0505');
  grd.addColorStop(1, '#1a0808');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // 火焰光效
  var now = Date.now() / 1000;
  var alpha = 0.06 + Math.sin(now * 1.5) * 0.02;
  var grd2 = ctx.createRadialGradient(W * 0.25, H * 0.35, 0, W * 0.5, H * 0.5, W * 0.5);
  grd2.addColorStop(0, 'rgba(200,60,30,' + alpha + ')');
  grd2.addColorStop(0.5, 'rgba(200,120,30,0.02)');
  grd2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd2;
  ctx.fillRect(0, 0, W, H);

  // 图标
  ctx.fillStyle = '#c04020';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏯', W / 2, H * 0.28);

  // 标题
  ctx.fillStyle = '#e8c080';
  ctx.font = 'bold 36px "STKaiti","KaiTi",serif';
  ctx.shadowColor = 'rgba(200,120,40,0.6)';
  ctx.shadowBlur = 20;
  ctx.fillText('乱 世 烽 火', W / 2, H * 0.38);
  ctx.shadowBlur = 0;

  // 副标题
  ctx.fillStyle = '#a07050';
  ctx.font = '14px "STKaiti","KaiTi",serif';
  ctx.fillText('汉 末 苍 生 · 群 雄 逐 鹿', W / 2, H * 0.44);

  // 分割线
  var grd3 = ctx.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0);
  grd3.addColorStop(0, 'rgba(192,80,48,0)');
  grd3.addColorStop(0.5, 'rgba(192,80,48,0.8)');
  grd3.addColorStop(1, 'rgba(192,80,48,0)');
  ctx.fillStyle = grd3;
  ctx.fillRect(W / 2 - 70, H * 0.48, 140, 2);

  // 按钮
  var by = H * 0.55;
  drawTitleBtn('初 入 乱 世', by, '#e8d5a3');
  by += 56;
  if (hasSave) {
    drawTitleBtn('再 续 前 缘', by, '#e8d5a3');
    by += 56;
  } else {
    drawTitleBtn('再 续 前 缘', by, '#666');
    by += 56;
  }

  // 版本号
  ctx.fillStyle = '#4a3520';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('v1.0 · WeChat Mini-Game', W / 2, H - 30);

  // 屏幕金边
  ctx.strokeStyle = 'rgba(200,155,74,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);
}

function drawTitleBtn(label, y, color) {
  var bw = 168, bh = 44;
  var bx = W / 2 - bw / 2;
  var enabled = (color !== '#666');
  drawSealBtn(bx, y, bw, bh, label, enabled ? '#a83232' : '#555', enabled,
    { r: 8, font: '16px "STKaiti","KaiTi",serif', textColor: enabled ? '#ffe9c0' : '#999' });
}

// ==================== 序幕画面 ====================
function drawPrologue(lineIndex, lineText, canContinue) {
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.fillRect(0, 0, W, H);

  var mx = 20, my = H * 0.15, mw = W - 40, mh = H * 0.7;
  drawScrollPanel(mx, my, mw, mh, { r: 12 });

  // 说书人头像框
  ctx.fillStyle = '#14100c';
  ctx.fillRect(mx + 16, my + 20, 70, 85);
  ctx.strokeStyle = '#c89b4a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx + 16, my + 20, 70, 85);

  // 立绘：像素风说书人
  var sbx = mx + 16, sby = my + 20, sbw = 70, sbh = 85;
  drawSpriteChar(sbx + sbw / 2, sby + sbh - 4, 80, 'storyteller');

  // 标题
  ctx.fillStyle = '#e8a850';
  ctx.font = 'bold 13px "STKaiti","KaiTi",serif';
  ctx.textAlign = 'left';
  ctx.fillText('📖 说书人', mx + 100, my + 36);

  // 文本
  ctx.fillStyle = '#c8b080';
  ctx.font = '12px sans-serif';
  var lines = wrapText(lineText, mw - 130, 12);
  for (var i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], mx + 100, my + 58 + i * 20);
  }

  // 进度
  ctx.fillStyle = '#8a7755';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText((lineIndex + 1) + ' / ' + 10, mx + mw / 2, my + mh - 20);

  if (canContinue) {
    var btnLabel = (lineIndex >= 9) ? '踏入乱世' : '继续';
    drawSealBtn(mx + mw - 110, my + mh - 48, 90, 32, btnLabel, '#a83232', true,
      { r: 6, font: '13px "STKaiti","KaiTi",serif', textColor: '#ffe9c0' });
  }
}

// ==================== 背包面板 ====================
function drawBackpack(player, selectedId) {
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, W, H);

  var mx = 16, my = 60, mw = W - 32, mh = H - 120;
  drawScrollPanel(mx, my, mw, mh, { r: 12 });

  // 标题
  ctx.fillStyle = '#e8c080';
  ctx.font = 'bold 16px "STKaiti","KaiTi",serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎒 行 囊', W / 2, my + 28);

  ctx.fillStyle = '#d4a853';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('💰 ' + player.gold, mx + mw - 20, my + 28);

  // 道具列表
  var ix = mx + 12, iy = my + 44;
  var items = player.items || [];
  var ciw = (mw - 24) / 4;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var def = data.ITEM_DB[item.id];
    if (!def) continue;

    var col = Math.floor(i % 4);
    var row = Math.floor(i / 4);

    var bx = ix + col * ciw + 2, by = iy + row * 72;

    var isSelected = (selectedId === def.id);
    ctx.fillStyle = isSelected ? 'rgba(60,45,25,0.8)' : 'rgba(40,30,20,0.7)';
    ctx.strokeStyle = isSelected ? '#e8c080' : 'rgba(138,106,58,0.6)';
    ctx.lineWidth = isSelected ? 2 : 1;
    roundRect(bx, by, ciw - 4, 66, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d4a853';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.icon, bx + (ciw - 4) / 2, by + 26);

    ctx.fillStyle = '#c8b080';
    ctx.font = '9px sans-serif';
    ctx.fillText(def.name, bx + (ciw - 4) / 2, by + 42);

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('x' + item.count, bx + (ciw - 4) / 2, by + 58);
  }

  // 详情
  var dy = iy + 180;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(mx + 12, dy, mw - 24, 30, 6);
  ctx.fill();
  ctx.fillStyle = '#a89070';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(selectedId ? getItemDesc(selectedId) : '点击道具查看详情', mx + 22, dy + 20);

  // 按钮
  var bty = dy + 44;
  drawBackpackBtn('使用', mx + 12, bty, (mw - 36) / 3, '#2ea043', selectedId);
  drawBackpackBtn('丢弃', mx + 24 + (mw - 36) / 3, bty, (mw - 36) / 3, '#c0392b', selectedId);
  drawBackpackBtn('关闭', mx + 36 + (mw - 36) / 3 * 2, bty, (mw - 36) / 3, '#666', true);
}

function getItemDesc(id) {
  if (data.ITEM_DB[id]) {
    return data.ITEM_DB[id].icon + ' ' + data.ITEM_DB[id].name + ' - ' + data.ITEM_DB[id].desc;
  }
  return id;
}

function drawBackpackBtn(label, x, y, w, color, enabled) {
  drawSealBtn(x, y, w, 36, label, color, enabled, { r: 6, font: '13px sans-serif', textColor: '#fff7e6' });
}

// ==================== 弹窗 ====================
function drawModal(title, text) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  var mw = W * 0.8, mh = 200;
  var mx = (W - mw) / 2, my = (H - mh) / 2;
  drawScrollPanel(mx, my, mw, mh, { r: 12 });

  ctx.fillStyle = '#e8c080';
  ctx.font = 'bold 16px "STKaiti","KaiTi",serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, my + 36);

  ctx.fillStyle = '#b8a080';
  ctx.font = '12px sans-serif';
  var lines = text.split('\n');
  for (var i = 0; i < Math.min(lines.length, 6); i++) {
    ctx.fillText(lines[i], W / 2, my + 62 + i * 20);
  }

  // 确定按钮
  drawSealBtn(W / 2 - 50, my + mh - 50, 100, 36, '确定', '#a83232', true,
    { r: 6, font: '14px "STKaiti","KaiTi",serif', textColor: '#ffe9c0' });
}

// ==================== 设置面板 ====================
function drawSettings(sfxVol, musicVol) {
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, W, H);

  var mx = 20, my = H * 0.2, mw = W - 40, mh = H * 0.55;
  drawScrollPanel(mx, my, mw, mh, { r: 12 });

  ctx.fillStyle = '#e8c080';
  ctx.font = 'bold 18px "STKaiti","KaiTi",serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚙️ 设 置', W / 2, my + 36);

  // 音效音量
  ctx.fillStyle = '#d4a853';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🔊 音效', mx + 20, my + 70);
  ctx.fillStyle = '#b48c3c';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(sfxVol * 100) + '', mx + mw - 20, my + 70);

  // 音量条
  var sby = my + 80;
  ctx.fillStyle = '#2a2015';
  ctx.fillRect(mx + 20, sby, mw - 40, 8);
  ctx.fillStyle = '#b48c3c';
  ctx.fillRect(mx + 20, sby, (mw - 40) * sfxVol, 8);

  // 音乐音量
  ctx.fillStyle = '#d4a853';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🎵 音乐', mx + 20, my + 120);
  ctx.fillStyle = '#b48c3c';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(musicVol * 100) + '', mx + mw - 20, my + 120);

  var mby = my + 130;
  ctx.fillStyle = '#2a2015';
  ctx.fillRect(mx + 20, mby, mw - 40, 8);
  ctx.fillStyle = '#b48c3c';
  ctx.fillRect(mx + 20, mby, (mw - 40) * musicVol, 8);

  // 存档按钮
  var bty = my + 170;
  drawSealBtn(mx + 20, bty, mw - 40, 40, '💾 存档进度', '#2e6b4f', true, { r: 6, font: '14px sans-serif', textColor: '#fff7e6' });

  // 关闭按钮
  var cby = bty + 50;
  drawSealBtn(mx + 60, cby, mw - 120, 36, '关闭', '#555', true, { r: 6, font: '13px sans-serif', textColor: '#ddd' });
}

// ==================== 提示 ====================
function drawHint() {
  if (hintTimer <= 0) return;
  var hx = W / 2 - 120, hy = H / 2 - 20, hw = 240, hh = 36;
  ctx.fillStyle = 'rgba(20,14,9,0.92)';
  roundRect(hx, hy, hw, hh, 8);
  ctx.fill();
  ctx.strokeStyle = '#c89b4a';
  ctx.lineWidth = 1.5;
  roundRect(hx, hy, hw, hh, 8);
  ctx.stroke();
  ctx.fillStyle = '#e8c080';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hintText, W / 2, H / 2 + 4);
}

// ==================== 地图横幅 ====================
function drawMapBanner() {
  if (mapBannerAlpha <= 0) return;
  var bx = W / 2 - 80, by = H / 2 - 24, bw = 160, bh = 48;
  ctx.save();
  ctx.globalAlpha = mapBannerAlpha;
  drawScrollPanel(bx, by, bw, bh, { r: 6 });
  ctx.fillStyle = '#f0d8a0';
  ctx.font = 'bold 20px "STKaiti","KaiTi",serif';
  ctx.textAlign = 'center';
  ctx.fillText('— ' + mapBannerText + ' —', W / 2, H / 2 + 8);
  ctx.restore();
}

// ==================== 辅助函数 ====================
function wrapText(text, maxWidth, fontSize) {
  ctx.font = fontSize + 'px sans-serif';
  var words = text.split('');
  var lines = [];
  var line = '';
  for (var i = 0; i < words.length; i++) {
    var test = line + words[i];
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length === 0) lines.push(text);
  return lines;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ==================== 国风样式辅助 ====================

// 祥云卷角花
function drawCloudCorner(x, y, s, fx, fy) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(fx, fy);
  ctx.strokeStyle = 'rgba(212,168,83,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(2, 2, 3, 0, Math.PI * 2);
  ctx.moveTo(9, 5);
  ctx.arc(9, 5, 3, Math.PI, Math.PI * 2);
  ctx.moveTo(2, 9);
  ctx.arc(4, 9, 3, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, 2); ctx.lineTo(s, 2);
  ctx.moveTo(2, 2); ctx.lineTo(2, s);
  ctx.stroke();
  ctx.restore();
}

// 国风卷轴面板：墨色宣纸渐变 + 双层金边 + 四角祥云
function drawScrollPanel(x, y, w, h, opt) {
  opt = opt || {};
  var r = (opt.r != null) ? opt.r : 12;
  var grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, 'rgba(36,26,17,0.97)');
  grd.addColorStop(0.5, 'rgba(26,18,12,0.98)');
  grd.addColorStop(1, 'rgba(18,12,8,0.97)');
  ctx.fillStyle = grd;
  roundRect(x, y, w, h, r);
  ctx.fill();
  // 内描边（暗金）
  ctx.strokeStyle = 'rgba(120,90,45,0.6)';
  ctx.lineWidth = 1;
  roundRect(x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 3));
  ctx.stroke();
  // 外描边（亮金）
  ctx.strokeStyle = '#c89b4a';
  ctx.lineWidth = 2;
  roundRect(x, y, w, h, r);
  ctx.stroke();
  // 四角祥云
  var cs = Math.min(16, w / 3, h / 3);
  drawCloudCorner(x + 6, y + 6, cs, 1, 1);
  drawCloudCorner(x + w - 6, y + 6, cs, -1, 1);
  drawCloudCorner(x + 6, y + h - 6, cs, 1, -1);
  drawCloudCorner(x + w - 6, y + h - 6, cs, -1, -1);
}

// 木牌/印章按钮
function drawSealBtn(x, y, w, h, label, color, enabled, opt) {
  opt = opt || {};
  var r = (opt.r != null) ? opt.r : 6;
  var font = opt.font || '13px sans-serif';
  if (!enabled) {
    ctx.fillStyle = 'rgba(40,36,30,0.8)';
    roundRect(x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = 'rgba(80,70,55,0.5)'; ctx.lineWidth = 1;
    roundRect(x, y, w, h, r); ctx.stroke();
    ctx.fillStyle = '#6b6258';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 4);
    return;
  }
  // 竖向渐变（上亮下暗，釉面/木质质感）
  var g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(color || '#a83232', 0.30));
  g.addColorStop(0.5, color || '#a83232');
  g.addColorStop(1, shade(color || '#a83232', -0.34));
  ctx.fillStyle = g;
  roundRect(x, y, w, h, r); ctx.fill();
  // 顶部高光
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  roundRect(x + 2, y + 2, w - 4, h * 0.34, Math.max(2, r - 1)); ctx.fill();
  // 底部暗角
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(x + 2, y + h * 0.62, w - 4, h * 0.38, Math.max(2, r - 1)); ctx.fill();
  // 内金描边
  ctx.strokeStyle = 'rgba(245,225,170,0.92)';
  ctx.lineWidth = 1.5;
  roundRect(x + 3, y + 3, w - 6, h - 6, Math.max(2, r - 2)); ctx.stroke();
  // 外暗描边
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  roundRect(x, y, w, h, r); ctx.stroke();
  ctx.fillStyle = opt.textColor || '#fff7e6';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
}

// 触摸区域检测
function hitTestDPad(tx, ty) {
  var dSize = 52, gap = 5, padX = SAFE_SIDE + 4;
  var actionBarH = 44;
  var dPadH = 3 * dSize + 2 * gap;
  var padY = H - SAFE_BOTTOM - actionBarH - dPadH - 24;
  var btns = ['up', 'left', 'right', 'down'];
  var positions = [{x:1,y:0},{x:0,y:1},{x:2,y:1},{x:1,y:2}];

  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    var bx = padX + p.x * (dSize + gap);
    var by = padY + p.y * (dSize + gap);
    if (tx >= bx && tx <= bx + dSize && ty >= by && ty <= by + dSize) {
      return btns[i];
    }
  }

  // 交互按钮
  var acx = W - SAFE_SIDE - 34, acy = padY + dSize + 34;
  var dist = Math.sqrt((tx - acx) * (tx - acx) + (ty - acy) * (ty - acy));
  if (dist < 32) return 'action';

  return null;
}

function hitTestActionBar(tx, ty) {
  var barH = 44;
  var barY = H - barH - SAFE_BOTTOM;
  if (ty < barY || ty > H) return null;

  var margin = SAFE_SIDE;
  var bw = (W - margin * 2 - 3 * 8) / 4;
  for (var i = 0; i < 4; i++) {
    var bx = margin + i * (bw + 8);
    if (tx >= bx && tx <= bx + bw) {
      return ['inventory', 'quest', 'meditate', 'settings'][i];
    }
  }
  return null;
}

function hitTestDialogChoices(tx, ty) {
  var dh = 140, dy = H - dh - SAFE_BOTTOM;
  if (ty < dy + dh - 40 || ty > dy + dh) return null;
  // 简单检测：点击下半部分即为继续
  if (tx > SAFE_SIDE && tx < W - SAFE_SIDE) return 0;
  return null;
}

function hitTestBattleButtons(tx, ty) {
  var bty = H - SAFE_BOTTOM - 44, bth = 44;
  if (ty < bty || ty > bty + bth) return null;

  var margin = SAFE_SIDE;
  var btw = (W - margin * 2 - 3 * 6) / 4;
  for (var i = 0; i < 4; i++) {
    var btx = margin + i * (btw + 6);
    if (tx >= btx && tx <= btx + btw) {
      return ['atk', 'skill', 'item', 'flee'][i];
    }
  }
  return null;
}

function hitTestBackpack(tx, ty) {
  var mx = 16, my = 60, mw = W - 32, mh = H - 120;
  if (tx < mx || tx > mx + mw || ty < my || ty > my + mh) return null;

  // 道具格子
  var ix = mx + 12, iy = my + 44, ciw = (mw - 24) / 4;
  var col = Math.floor((tx - ix) / ciw);
  var row = Math.floor((ty - iy) / 72);
  if (col >= 0 && col < 4 && row >= 0 && row < 4) {
    return { type: 'slot', col: col, row: row };
  }

  // 按钮区域
  var bty = iy + 180 + 44;
  if (ty >= bty && ty <= bty + 36) {
    var bw3 = (mw - 36) / 3;
    if (tx < mx + 12 + bw3) return { type: 'use' };
    if (tx < mx + 24 + bw3 * 2) return { type: 'discard' };
    return { type: 'close' };
  }

  return null;
}

function hitTestTitleButtons(tx, ty) {
  var by = H * 0.55;
  var bw = 168, bh = 44;
  var bx = W / 2 - bw / 2;

  if (tx >= bx && tx <= bx + bw && ty >= by && ty <= by + bh) return 'new';
  by += 56;
  if (tx >= bx && tx <= bx + bw && ty >= by && ty <= by + bh) return 'load';
  return null;
}

function hitTestSettings(tx, ty) {
  var mx = 20, my = H * 0.2, mw = W - 40, mh = H * 0.55;
  if (tx < mx || tx > mx + mw || ty < my || ty > my + mh) return null;

  // SFX 音量区域
  if (ty >= my + 70 && ty <= my + 90 && tx >= mx + 20 && tx <= mx + mw - 20) {
    return { type: 'sfxVol', value: (tx - mx - 20) / (mw - 40) };
  }

  // 音乐音量区域
  if (ty >= my + 120 && ty <= my + 140 && tx >= mx + 20 && tx <= mx + mw - 20) {
    return { type: 'musicVol', value: (tx - mx - 20) / (mw - 40) };
  }

  // 存档按钮
  if (ty >= my + 170 && ty <= my + 210) return { type: 'save' };
  // 关闭按钮
  if (ty >= my + 220 && ty <= my + 256) return { type: 'close' };

  return null;
}

module.exports = {
  initRenderer: initRenderer,
  spriteKeyFor: spriteKeyFor,
  updateCamera: updateCamera,
  drawMap: drawMap,
  drawStatusBar: drawStatusBar,
  drawActionBar: drawActionBar,
  drawDPad: drawDPad,
  drawDialog: drawDialog,
  drawBattle: drawBattle,
  drawTitleScreen: drawTitleScreen,
  drawPrologue: drawPrologue,
  drawBackpack: drawBackpack,
  drawModal: drawModal,
  drawSettings: drawSettings,
  drawHint: drawHint,
  drawMapBanner: drawMapBanner,
  hitTestDPad: hitTestDPad,
  hitTestActionBar: hitTestActionBar,
  hitTestDialogChoices: hitTestDialogChoices,
  hitTestBattleButtons: hitTestBattleButtons,
  hitTestBackpack: hitTestBackpack,
  hitTestTitleButtons: hitTestTitleButtons,
  hitTestSettings: hitTestSettings,
  setHint: function(t) { hintText = t; hintTimer = 1; },
  setMapBanner: function(t, a) { mapBannerText = t; mapBannerAlpha = a || 1; },
  setShake: function(target, intensity, dur) { shakeTarget = target; shakeIntensity = intensity; shakeTimer = dur; },
  setFlash: function(a) { flashAlpha = a || 0; },
  setPlayerFacing: function(f) { playerFacing = f || 'down'; },
  setPlayerMoving: function(m) { playerMoving = !!m; },
  addDamage: addDamage,
  triggerSlash: triggerSlash,
  tickEffects: tickEffects,
  // 暴露内部渲染状态，供 game-core 读写（严格模式下必须通过访问器）
  get ctx() { return ctx; },
  get W() { return W; },
  get H() { return H; },
  get SAFE_TOP() { return SAFE_TOP; },
  get SAFE_BOTTOM() { return SAFE_BOTTOM; },
  get SAFE_SIDE() { return SAFE_SIDE; },
  get animFrame() { return animFrame; },
  set animFrame(v) { animFrame = v; },
  get shakeTimer() { return shakeTimer; },
  set shakeTimer(v) { shakeTimer = v; },
  get shakeIntensity() { return shakeIntensity; },
  set shakeIntensity(v) { shakeIntensity = v; },
  get flashAlpha() { return flashAlpha; },
  set flashAlpha(v) { flashAlpha = v; },
  get hintTimer() { return hintTimer; },
  set hintTimer(v) { hintTimer = v; },
  get mapBannerAlpha() { return mapBannerAlpha; },
  set mapBannerAlpha(v) { mapBannerAlpha = v; },
  get camX() { return camX; },
  get camY() { return camY; }
};

// ==================== Canvas 像素画绘制引擎 ====================
// 20×24 像素网格 · 逐块绘制 · 像素复古风
// 移植自 HTML 版 v5.3

var _pxDef = {
  hero: { skin: '#e8c090', skinD: '#c89860', hat: 'topknot', hatC: '#2a1810', robe: '#1e3a5c', robeL: '#285080', belt: '#8b6914', eye: '#000', beltY: 14, weapon: 'sword', wC: '#d0d0d8', wSide: 'r', wH: 4, beard: 'none', shoulderW: 5, chest: 0, spike: 0, faceW: 3 },
  storyteller: { skin: '#d4a574', skinD: '#b08060', hat: 'wide', hatC: '#4a3020', hatA: '#5a3a25', robe: '#3d2b1a', robeL: '#503822', belt: '#2a1f15', eye: '#000', beltY: 15, weapon: 'fan', wC: '#e0d0b0', wSide: 'r', wH: 5, beard: 'three', bC: '#9a9070', bH: 7, shoulderW: 4, chest: 0, spike: 0, faceW: 2 },
  master: { skin: '#e0c0a0', skinD: '#c0a080', hat: 'official', hatC: '#1a1010', hatA: '#3a2a1a', robe: '#1a1a30', robeL: '#282848', belt: '#6b5930', eye: '#000', beltY: 15, weapon: 'none', beard: 'goatee', bC: '#555', bH: 6, shoulderW: 4, chest: 0, spike: 0, faceW: 3 },
  doctor: { skin: '#d0b090', skinD: '#b09070', hat: 'round', hatC: '#3a2a18', robe: '#5a5040', robeL: '#6b6050', belt: '#3a3028', eye: '#000', beltY: 15, weapon: 'none', beard: 'long', bC: '#c0c0b0', bH: 7, shoulderW: 4, chest: 0, spike: 0, faceW: 2 },
  monk: { skin: '#d8c0a0', skinD: '#b89878', hat: 'topknot', hatC: '#1a1010', hatA: '#c8a860', robe: '#1a1a1a', robeL: '#2a2a2a', belt: '#333', eye: '#000', beltY: 15, weapon: 'whisk', wC: '#888', wSide: 'r', wH: 6, beard: 'goatee', bC: '#666', bH: 5, shoulderW: 4, chest: 0, spike: 0, faceW: 2 },
  hermit: { skin: '#d0b898', skinD: '#b09070', hat: 'cloth', hatC: '#2e5a28', robe: '#2a4028', robeL: '#385838', belt: '#1a3018', eye: '#000', beltY: 15, weapon: 'staff', wC: '#8b6b3a', wSide: 'r', wH: 9, beard: 'long', bC: '#888', bH: 7, shoulderW: 4, chest: 0, spike: 0, faceW: 2 },
  escort: { skin: '#d8b888', skinD: '#b89868', hat: 'helm', hatC: '#3a3a3a', hatA: '#c02018', robe: '#6b1f18', robeL: '#8b2a20', belt: '#4a1010', eye: '#000', beltY: 15, weapon: 'spear', wC: '#888', wSide: 'l', wH: 5, beard: 'none', shoulderW: 5, chest: 1, spike: 0, faceW: 3 },
  bandit: { skin: '#d0a878', skinD: '#b08858', hat: 'band', hatC: '#c8a020', robe: '#6b5010', robeL: '#8b6a18', belt: '#4a3008', eye: '#000', beltY: 14, weapon: 'knife', wC: '#777', wSide: 'r', wH: 3, beard: 'none', shoulderW: 4, chest: 0, spike: 0, faceW: 3 },
  bully: { skin: '#d0a878', skinD: '#b08858', hat: 'leather', hatC: '#3a2818', robe: '#3a2818', robeL: '#4a3828', belt: '#2a1810', eye: '#000', beltY: 14, weapon: 'knife', wC: '#777', wSide: 'r', wH: 3, beard: 'none', shoulderW: 4, chest: 0, spike: 0, faceW: 3 },
  guard: { skin: '#d8b080', skinD: '#b89060', hat: 'horn', hatC: '#3a3a3a', robe: '#5a1515', robeL: '#782020', belt: '#3a0a0a', eye: '#000', beltY: 14, weapon: 'spear', wC: '#aaa', wSide: 'l', wH: 5, beard: 'none', shoulderW: 5, chest: 1, spike: 0, faceW: 3 },
  boss: { skin: '#d0a870', skinD: '#b08850', hat: 'giant', hatC: '#2a2a2a', hatA: '#d81810', robe: '#4a1010', robeL: '#6a1818', belt: '#c8a840', eye: '#000', beltY: 14, weapon: 'bigBlade', wC: '#ccc', wSide: 'r', wH: 8, beard: 'none', shoulderW: 6, chest: 1, spike: 1, faceW: 3 },
  soldier: { skin: '#fce5d8', skinD: '#dcc0b0', hat: 'helm', hatC: '#4a3020', robe: '#7b1f1f', robeL: '#9b2f2f', belt: '#5a1a1a', eye: '#000', beltY: 14, weapon: 'spear', wC: '#8a6040', wSide: 'r', wH: 4, beard: 'none', shoulderW: 4, chest: 0, spike: 0, faceW: 2 },
  captain: { skin: '#fce5d8', skinD: '#dcb898', hat: 'wide', hatC: '#3a3a3a', hatA: '#c02018', robe: '#5a1515', robeL: '#782020', belt: '#8b6914', eye: '#000', beltY: 14, weapon: 'spear', wC: '#aaa', wSide: 'l', wH: 5, beard: 'goatee', bC: '#444', bH: 5, shoulderW: 5, chest: 1, spike: 0, faceW: 3 }
};

// ==================== AI 像素画像映射（与 HTML 版一致） ====================
var _aiImg = {
  hero: '/subpackages/asset/pixel_chars/hero_ai.png',
  storyteller: '/subpackages/asset/pixel_chars/storyteller_ai.png',
  master: '/subpackages/asset/pixel_chars/hanbo_ai.png',
  doctor: '/subpackages/asset/pixel_chars/hualao_ai.png',
  monk: '/subpackages/asset/pixel_chars/zuoci_ai.png',
  hermit: '/subpackages/asset/pixel_chars/shuijing_ai.png',
  escort: '/subpackages/asset/pixel_chars/captain_ai.png',
  bandit: '/subpackages/asset/pixel_chars/yellow_turban_ai.png',
  bully: '/subpackages/asset/pixel_chars/xiliang_soldier_ai.png',
  guard: '/subpackages/asset/pixel_chars/deputy_general_ai.png',
  boss: '/subpackages/asset/pixel_chars/boss_ai.png',
  soldier: '/subpackages/asset/pixel_chars/escort_ai.png',
  captain: '/subpackages/asset/pixel_chars/captain_ai.png'
};

function drawHat(B, P, d) {
  var t = d.hat, c = d.hatC, a = d.hatA || c;
  switch (t) {
    case 'topknot':
      B(7, 2, 6, 1, c); B(8, 1, 4, 1, c); B(9, 0, 2, 1, c);
      if (d.hatA) B(7, 1, 7, 1, d.hatA);
      B(7, 3, 2, 1, c); B(11, 3, 2, 1, c);
      break;
    case 'wide':
      B(2, 0, 16, 2, c); B(1, 2, 18, 2, a); B(1, 3, 18, 1, a); P(0, 2, c); P(19, 2, c);
      break;
    case 'official':
      B(6, 0, 8, 3, c); B(7, -1, 6, 1, c);
      B(2, 1, 4, 2, a); B(14, 1, 4, 2, a);
      break;
    case 'round':
      B(7, 1, 6, 2, c); B(6, 3, 8, 1, c); P(7, 0, c); P(12, 0, c);
      break;
    case 'cloth':
      B(6, 1, 8, 2, c); B(5, 3, 10, 1, c); P(6, 0, c); P(13, 0, c);
      break;
    case 'helm':
      B(5, 0, 10, 3, c); P(4, 1, c); P(15, 1, c);
      B(9, -1, 2, 2, a); P(9, -2, a); P(10, -2, a);
      break;
    case 'horn':
      B(5, 0, 10, 3, c); P(4, 1, c); P(15, 1, c);
      P(3, 0, c); P(16, 0, c);
      break;
    case 'giant':
      B(4, -1, 12, 4, c); B(3, 3, 14, 1, c);
      B(8, -2, 4, 3, a); P(9, -3, a); P(10, -3, a);
      B(3, 4, 14, 1, c);
      break;
    case 'band':
      B(6, 1, 8, 2, c); P(5, 3, c); P(14, 3, c);
      B(7, 0, 3, 1, '#2a1810'); B(11, 0, 3, 1, '#2a1810');
      break;
    case 'leather':
      B(6, 1, 8, 2, c); B(7, 0, 6, 1, c);
      break;
  }
}

function drawWeapon(B, P, d) {
  if (d.weapon === 'none') return;
  var c = d.wC, s = d.wSide, sh = 10 + d.beltY || 14, h = d.wH;
  var x = (s === 'r') ? 16 : 4;
  switch (d.weapon) {
    case 'sword':
      B(x, sh, 2, h, c); B(x - 1, sh, 4, 2, '#c8b860');
      break;
    case 'spear':
      B(x, sh - 2, 1, h + 2, c); B(x - 1, sh - 4, 3, 2, c);
      break;
    case 'knife':
      B(x, sh, 2, h, c); B(x + 2, sh + h - 2, 3, 2, c);
      break;
    case 'fan':
      B(x, sh, 3, 2, c); B(x, sh + 2, 4, 1, c); B(x, sh + 3, 3, 1, c);
      break;
    case 'staff':
      B(x, sh - 3, 1, h + 3, c);
      break;
    case 'whisk':
      B(x, sh, 1, h, c);
      B(x + 1, sh - h + 4, 2, h - 1, '#aaa');
      break;
    case 'bigBlade':
      B(x, sh - 2, 3, h + 4, c); B(x - 1, sh - 3, 5, 2, '#c8b860');
      break;
  }
}

function drawBeard(B, P, d) {
  if (d.beard === 'none') return;
  var c = d.bC, h = d.bH || 6;
  switch (d.beard) {
    case 'goatee':
      for (var i = 0; i < h; i++) { P(9, 8 + i, c); P(11, 8 + i, c); P(10, 8 + i, c); }
      break;
    case 'long':
      for (var i = 0; i < h; i++) { B(9, 8 + i, 2, 1, c); }
      break;
    case 'three':
      for (var i = 0; i < h; i++) { P(8, 8 + i, c); P(10, 8 + i, c); P(12, 8 + i, c); }
      break;
  }
}

function renderPixelChar(canvas, charId, w, h) {
  var W = w || canvas.width, H = h || canvas.height;
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  var GW = 20, GH = 24;
  var ps = Math.floor(Math.min(W / GW, H / GH));
  var ox = Math.floor((W - GW * ps) / 2);
  var oy = Math.floor((H - GH * ps) / 2);

  ctx.fillStyle = '#14100c';
  ctx.fillRect(0, 0, W, H);

  var d = _pxDef[charId] || _pxDef.hero;
  var P = function (x, y, c) { if (x < 0 || x >= GW || y < 0 || y >= GH) return; ctx.fillStyle = c; ctx.fillRect(ox + x * ps, oy + y * ps, ps, ps); };
  var B = function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(ox + x * ps, oy + y * ps, w * ps, h * ps); };
  function oval(cx, cy, rw, rh, color) {
    for (var dy = -rh; dy <= rh; dy++) {
      for (var dx = -rw; dx <= rw; dx++) {
        if (dx * dx * 1.0 / (rw * rw) + dy * dy * 1.0 / (rh * rh) <= 1) P(cx + dx, cy + dy, color);
      }
    }
  }
  function ovalOut(cx, cy, rw, rh, fill, outline, ot) {
    ot = ot || 1;
    for (var dy = -rh - ot; dy <= rh + ot; dy++) {
      for (var dx = -rw - ot; dx <= rw + ot; dx++) {
        var dist = dx * dx * 1.0 / (rw * rw) + dy * dy * 1.0 / (rh * rh);
        if (dist <= 1 && dist > 0.65) P(cx + dx, cy + dy, outline);
        else if (dist <= 1) P(cx + dx, cy + dy, fill);
      }
    }
  }

  // 1. 身体
  var sx = 10 - d.shoulderW, sw = d.shoulderW * 2;
  var bodyTop = 9;
  B(sx, bodyTop, sw, 1, d.robeL);
  B(sx - 1, bodyTop + 1, sw + 2, 1, d.robeL);
  for (var r = bodyTop + 2; r <= d.beltY - 1; r++) { B(sx, r, sw, 1, d.robeL); }
  var beltH = 2;
  B(sx - 1, d.beltY, sw + 2, beltH, d.belt);
  for (var r2 = d.beltY + beltH; r2 <= GH - 1; r2++) {
    B(sx, r2, sw, 1, d.robeL);
  }
  if (d.spike) {
    B(sx - 2, bodyTop - 1, 2, 3, d.hatC);
    B(sx + sw, bodyTop - 1, 2, 3, d.hatC);
    P(sx - 3, bodyTop - 1, d.hatC); P(sx + sw + 2, bodyTop - 1, d.hatC);
  }
  if (d.chest) {
    B(10 - 2, bodyTop + 2, 4, 3, d.hatC);
    B(10 - 1, bodyTop + 5, 2, 2, d.belt);
  }

  // 2. 头部
  var hw = d.faceW + 2, hh = 3;
  oval(10, 5, hw, hh, d.skin);
  oval(10, 6, hw, hh, d.skin);
  ovalOut(10, 5, hw, hh, d.skin, d.skinD, 1);

  // 眼睛/嘴
  P(8, 4, d.eye); P(12, 4, d.eye);
  P(10, 7, d.skinD);

  // 3. 帽子
  drawHat(B, P, d);

  // 4. 武器
  drawWeapon(B, P, d);

  // 5. 胡子
  drawBeard(B, P, d);
}

function renderPortrait(canvas, charId, w, h, callback) {
  var W = w || canvas.width, H = h || canvas.height;
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 暗色底色
  ctx.fillStyle = '#14100c';
  ctx.fillRect(0, 0, W, H);

  var path = _aiImg[charId];
  if (!path || typeof canvas.createImage !== 'function') {
    renderPixelChar(canvas, charId, W, H);
    if (typeof callback === 'function') callback();
    return;
  }

  var img = canvas.createImage();
  img.onload = function () {
    var iw = img.width || W, ih = img.height || H;
    var scale = Math.min(W / iw, H / ih) * 0.94;
    var dw = iw * scale, dh = ih * scale;
    var dx = (W - dw) / 2, dy = (H - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);

    // 柔边渐变遮罩，与 HTML 版保持一致
    var grd = ctx.createRadialGradient(
      W / 2, H * 0.45, Math.min(dw, dh) * 0.28,
      W / 2, H * 0.45, Math.max(W, H) * 0.58
    );
    grd.addColorStop(0, 'rgba(20,16,12,0)');
    grd.addColorStop(0.55, 'rgba(20,16,12,0)');
    grd.addColorStop(0.82, 'rgba(20,16,12,0.45)');
    grd.addColorStop(1, 'rgba(20,16,12,0.95)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    if (typeof callback === 'function') callback();
  };
  img.onerror = function () {
    renderPixelChar(canvas, charId, W, H);
    if (typeof callback === 'function') callback();
  };
  img.src = path;
}

module.exports = {
  renderPixelChar: renderPixelChar,
  renderPortrait: renderPortrait,
  charList: Object.keys(_pxDef),
  pxDef: _pxDef
};

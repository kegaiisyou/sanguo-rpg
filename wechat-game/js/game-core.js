// ==================== 乱世烽火 - 游戏核心逻辑 ====================
// 游戏状态管理、主循环、输入处理、战斗系统、对话系统

var data = require('./data.js');
var renderer = require('./renderer.js');
var audio = require('./audio.js');
var storage = require('./storage.js');

// 全局canvas引用（init中创建）
var canvas = null;

// ====== 游戏状态 ======
var player = data.defaultPlayer();
var gameStarted = false;
var inBattle = false;
var enemyIdx = null;
var enemyHp = 0;
var enemyMaxHp = 0;

// 对话状态
var curNpc = null;
var curNpcDi = 0;

// 序幕状态
var prologueIdx = 0;
var prologueTyping = false;
var prologueTimer = null;
var prologueCanContinue = false;

// UI状态
var state = 'title'; // title, prologue, playing, dialog, battle, backpack, modal, settings
var backpackInBattle = false;
var bagSelectedId = null;

// 移动状态
var moveDir = null;
var moveTimer = null;
var moveThrottle = 100;
var keyStates = {};

// 动画
var animId = null;
var lastFrameTime = 0;
var gamePaused = false;

// 选择框
var modalCallback = null;

// 地图引用
var currentMap = 'main';
var mapData, npcs, enemies, deadEnemies;
var quests = data.quests;
var killCounts = { bandit: 0, bully: 0, guard: 0, boss: 0 };

// ====== 主入口 ======
function init() {
  try {
    // 获取canvas
    canvas = wx.createCanvas();
    var sysInfo = wx.getSystemInfoSync();
    var w = sysInfo.windowWidth;
    var h = sysInfo.windowHeight;
    var dpr = sysInfo.pixelRatio || 1;

    renderer.initRenderer(canvas, w, h, dpr);

    // 加载设置
    var settings = storage.loadSettings();
    if (settings) {
      audio.setSfxVol(settings.sfxVol);
      audio.setMusicVol(settings.musicVol);
      // 同步 renderer 知道音量值
    }

    audio.initAudio();
    audio.startMusic();

    // 异步加载 audio 分包（承载 bgm.mp3），加载成功后再尝试播放外部 BGM
    try {
      if (wx.loadSubpackage) {
        wx.loadSubpackage({
          name: 'audio',
          success: function() { audio.loadExternalBGM(); },
          fail: function(e) { console.log('audio subpackage load failed:', e); }
        });
      }
    } catch (e) {
      console.log('loadSubpackage not available:', e);
    }

    // 加载地图
    loadMapGlobals('main');

    // 检查存档
    var hasSaveFile = storage.hasSave();

    // 注册输入
    registerInput();

    // 注册生命周期
    wx.onHide(function() {
      gamePaused = true;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      stopMoveLoop();
    });
    wx.onShow(function() {
      gamePaused = false;
      lastFrameTime = Date.now();
      gameLoop();
    });

    // 开始主循环
    state = 'title';
    lastFrameTime = Date.now();
    gameLoop();

    return hasSaveFile;
  } catch (e) {
    console.error('init error:', e);
    drawFatalError(e);
  }
}

function drawFatalError(e) {
  try {
    if (!canvas) canvas = wx.createCanvas();
    var c = canvas.getContext('2d');
    c.fillStyle = '#000';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#ff4444';
    c.font = '14px sans-serif';
    c.textAlign = 'left';
    c.fillText('INIT ERROR: ' + (e && e.message ? e.message : String(e)), 20, 40);
    c.fillStyle = '#aaa';
    c.font = '10px sans-serif';
    var stack = (e && e.stack ? e.stack : '').split('\n').slice(0, 8);
    for (var i = 0; i < stack.length; i++) {
      c.fillText(stack[i], 20, 65 + i * 16);
    }
  } catch (err) {}
}

function loadMapGlobals(mapId) {
  currentMap = mapId;
  data.currentMap = mapId;
  data.loadMapGlobals(mapId);
  mapData = data.mapData;
  npcs = data.npcs;
  enemies = data.enemies;
  deadEnemies = data.deadEnemies;
  data.MAP_W = mapData[0].length;
  data.MAP_H = mapData.length;
}

// ====== 主循环 ======
function gameLoop() {
  try {
    var now = Date.now();
    var dt = now - lastFrameTime;
    lastFrameTime = now;

    renderer.animFrame++;

    // 更新动画
    if (renderer.shakeTimer > 0) {
      renderer.shakeTimer -= dt / 1000;
      if (renderer.shakeTimer <= 0) {
        renderer.shakeTimer = 0;
        renderer.shakeIntensity = 0;
        renderer.flashAlpha = 0;
      }
    }
    if (renderer.flashAlpha > 0) {
      renderer.flashAlpha -= dt / 300;
      if (renderer.flashAlpha < 0) renderer.flashAlpha = 0;
    }
    if (renderer.hintTimer > 0) {
      renderer.hintTimer -= dt / 2200;
      if (renderer.hintTimer < 0) renderer.hintTimer = 0;
    }
    if (renderer.mapBannerAlpha > 0) {
      renderer.mapBannerAlpha -= dt / 2000;
      if (renderer.mapBannerAlpha < 0) renderer.mapBannerAlpha = 0;
    }

    // 战斗演出特效衰减
    renderer.tickEffects(dt);

    // 同步玩家移动/朝向状态（覆盖键盘与虚拟键）
    renderer.setPlayerMoving(state === 'playing' && !!moveDir);

    render();

    animId = requestAnimationFrame(gameLoop);
  } catch (e) {
    console.error('gameLoop error:', e);
    drawFatalError(e);
  }
}

function render() {
  var ctx = renderer.ctx;
  var W = renderer.W;
  var H = renderer.H;

  ctx.clearRect(0, 0, W, H);

  switch (state) {
    case 'title':
      renderer.drawTitleScreen(storage.hasSave());
      break;

    case 'prologue':
      renderPrologue();
      break;

    case 'playing':
      renderer.updateCamera(player.x, player.y, mapData[0].length, mapData.length);
      renderer.drawMap(mapData, npcs, enemies, deadEnemies, player.x, player.y);
      renderer.drawStatusBar(player);
      renderer.drawActionBar();
      renderer.drawDPad();
      renderer.drawMapBanner();
      renderer.drawHint();
      break;

    case 'dialog':
      renderer.updateCamera(player.x, player.y, mapData[0].length, mapData.length);
      renderer.drawMap(mapData, npcs, enemies, deadEnemies, player.x, player.y);
      renderer.drawStatusBar(player);
      renderer.drawActionBar();
      renderDialogUI();
      break;

    case 'battle':
      var logLines = ['⚔️ 狭路相逢！'];
      if (battleLogText) logLines = [battleLogText];
      renderer.drawBattle(player, enemies[enemyIdx], enemyHp, enemyMaxHp, logLines);
      break;

    case 'backpack':
      renderer.updateCamera(player.x, player.y, mapData[0].length, mapData.length);
      renderer.drawMap(mapData, npcs, enemies, deadEnemies, player.x, player.y);
      renderer.drawStatusBar(player);
      renderer.drawActionBar();
      renderer.drawBackpack(player, bagSelectedId);
      break;

    case 'settings':
      renderer.updateCamera(player.x, player.y, mapData[0].length, mapData.length);
      renderer.drawMap(mapData, npcs, enemies, deadEnemies, player.x, player.y);
      renderer.drawStatusBar(player);
      renderer.drawActionBar();
      renderer.drawSettings(audio.sfxVol, audio.musicVol);
      break;

    case 'modal':
      renderer.updateCamera(player.x, player.y, mapData[0].length, mapData.length);
      if (inBattle) {
        renderer.drawBattle(player, enemies[enemyIdx], enemyHp, enemyMaxHp, []);
      } else {
        renderer.drawMap(mapData, npcs, enemies, deadEnemies, player.x, player.y);
        renderer.drawStatusBar(player);
        renderer.drawActionBar();
      }
      var mt = modalTitle || '';
      var mc = modalContent || '';
      renderer.drawModal(mt, mc);
      break;
  }
}

// ====== 序幕 ======
var prologueLines = data.prologueLines;
var prologueCurrentText = '';

function startPrologue() {
  prologueIdx = 0;
  prologueCanContinue = false;
  state = 'prologue';
  showPrologueLine(0);
}

function showPrologueLine(idx) {
  if (idx >= prologueLines.length) {
    finishPrologue();
    return;
  }
  prologueIdx = idx;
  prologueTyping = true;
  prologueCanContinue = false;
  prologueCurrentText = '';

  var line = prologueLines[idx];
  var i = 0;
  function typeChar() {
    if (i < line.length) {
      prologueCurrentText += line.charAt(i);
      i++;
      prologueTimer = setTimeout(typeChar, 30);
    } else {
      prologueTyping = false;
      prologueCanContinue = true;
    }
  }
  typeChar();
}

function renderPrologue() {
  renderer.drawPrologue(prologueIdx, prologueCurrentText, prologueCanContinue);
}

function nextPrologue() {
  if (prologueTyping) {
    // 跳过打字动画
    if (prologueTimer) clearTimeout(prologueTimer);
    prologueCurrentText = prologueLines[prologueIdx];
    prologueTyping = false;
    prologueCanContinue = true;
    return;
  }

  if (prologueTimer) clearTimeout(prologueTimer);
  var next = prologueIdx + 1;
  if (next >= prologueLines.length) {
    finishPrologue();
    return;
  }
  showPrologueLine(next);
}

function finishPrologue() {
  player = data.defaultPlayer();
  killCounts = { bandit: 0, bully: 0, guard: 0, boss: 0 };
  deadEnemies = {};
  data.deadEnemies = {};
  quests = {
    quest_1: { name: '剿灭黄巾', desc: '击败5名黄巾贼', target: 5, progress: 0, rewardGold: 150, rewardExp: 100, done: false, rewardClaimed: false },
    quest_2: { name: '肃清溃兵', desc: '击败3股西凉溃兵', target: 3, progress: 0, rewardGold: 250, rewardExp: 150, done: false, rewardClaimed: false },
    quest_3: { name: '斩杀华雄', desc: '击败华雄', target: 1, progress: 0, rewardGold: 1200, rewardExp: 600, done: false, rewardClaimed: false }
  };
  data.quests = quests;
  startGamePlay();
}

// ====== 游戏开始 ======
function startGamePlay() {
  gameStarted = true;
  state = 'playing';
  loadMapGlobals('main');
  renderer.setHint('🎮 虚拟方向键移动 | 🗡️ 交互按钮');
}

function loadGame() {
  var saveData = storage.loadGame();
  if (!saveData) return false;

  var p = saveData.player;
  player.x = p.x; player.y = p.y;
  player.hp = p.hp; player.maxHp = p.maxHp;
  player.mp = p.mp; player.maxMp = p.maxMp;
  player.atk = p.atk; player.def = p.def;
  player.level = p.level; player.exp = p.exp;
  player.expNeed = p.expNeed; player.gold = p.gold;
  player.items = migrateItems(p.items);
  player.quests = p.quests || { quest_1: false, quest_2: false, quest_3: false };
  player.hermitBuffed = p.hermitBuffed || saveData.hermitBuffed || false;

  killCounts = saveData.killCounts || { bandit: 0, bully: 0, guard: 0, boss: 0 };
  data.killCounts = killCounts;

  var mapDead = saveData.mapDeadStates || { main: {}, north: {}, south: {}, east: {}, west: {} };
  data.mapDeadStates = mapDead;

  var loadMapId = saveData.currentMap || 'main';
  loadMapGlobals(loadMapId);
  deadEnemies = mapDead[loadMapId] || {};
  data.deadEnemies = deadEnemies;

  quests = saveData.quests || data.quests;
  data.quests = quests;

  startGamePlay();
  return true;
}

function migrateItems(oldItems) {
  var list = [];
  if (!oldItems) return list;
  if (Array.isArray(oldItems)) return oldItems;
  for (var k in data.ITEM_DB) {
    if (oldItems[k] && oldItems[k] > 0) {
      list.push({ id: k, count: oldItems[k] });
    }
  }
  return list;
}

// ====== 输入处理 ======
var touchStartX = 0, touchStartY = 0;
var touchDirActive = false;
var touchDir = null;

function registerInput() {
  // 触摸开始
  wx.onTouchStart(function(e) {
    var touch = e.touches[0];
    if (!touch) return;
    var tx = touch.clientX, ty = touch.clientY;

    switch (state) {
      case 'title':
        handleTitleTap(tx, ty);
        break;
      case 'prologue':
        nextPrologue();
        break;
      case 'playing':
        handlePlayTap(tx, ty, true);
        break;
      case 'dialog':
        handleDialogTap(tx, ty);
        break;
      case 'battle':
        handleBattleTap(tx, ty);
        break;
      case 'backpack':
        handleBackpackTap(tx, ty);
        break;
      case 'settings':
        handleSettingsTap(tx, ty);
        break;
      case 'modal':
        closeModal();
        break;
    }
  });

  // 触摸移动（用于虚拟方向键长按）
  wx.onTouchMove(function(e) {
    var touch = e.touches[0];
    if (!touch || state !== 'playing') return;

    if (touchDirActive) {
      var tx = touch.clientX, ty = touch.clientY;
      var newDir = renderer.hitTestDPad(tx, ty);
      if (newDir !== touchDir && newDir !== 'action') {
        touchDir = newDir;
        if (newDir) startMoveLoop(newDir);
        else stopMoveLoop();
      }
    }
  });

  // 触摸结束
  wx.onTouchEnd(function(e) {
    if (touchDirActive) {
      touchDirActive = false;
      touchDir = null;
      stopMoveLoop();
    }
  });

  // PC键盘
  if (wx.onKeyDown) {
    wx.onKeyDown(function(e) {
      if (state === 'playing' || state === 'dialog') {
        handleKeyDown(e);
      } else if (state === 'battle') {
        handleBattleKey(e);
      }
    });
    wx.onKeyUp(function(e) {
      handleKeyUp(e);
    });
  }
}

function handleTitleTap(tx, ty) {
  var result = renderer.hitTestTitleButtons(tx, ty);
  if (result === 'new') {
    audio.sfxClick();
    startPrologue();
  } else if (result === 'load') {
    if (storage.hasSave()) {
      audio.sfxClick();
      if (loadGame()) {
        renderer.setHint('📖 读档成功！继续你的冒险吧。');
      }
    }
  }
}

function handlePlayTap(tx, ty, isTouchStart) {
  // 虚拟方向键
  var dirResult = renderer.hitTestDPad(tx, ty);
  if (dirResult === 'action') {
    audio.sfxClick();
    interactWithNPC();
    return;
  }
  if (dirResult) {
    touchDirActive = true;
    touchDir = dirResult;
    startMoveLoop(dirResult);
    return;
  }

  // 底部操作栏
  var actionResult = renderer.hitTestActionBar(tx, ty);
  if (actionResult) {
    audio.sfxClick();
    handleActionBar(actionResult);
    return;
  }
  // 底部 UI 区域（含按钮间隙与安全区）全部消耗，避免误触地图
  if (ty >= renderer.H - 44 - renderer.SAFE_BOTTOM) {
    return;
  }

  // 点击地图移动
  if (isTouchStart) {
    handleMapTap(tx, ty);
  }
}

function handleMapTap(tx, ty) {
  // 将屏幕坐标转换为地图坐标
  var mx = tx - renderer.camX;
  var my = ty - renderer.camY;
  var gx = Math.floor(mx / data.TILE);
  var gy = Math.floor(my / data.TILE);

  if (gx < 0 || gx >= mapData[0].length || gy < 0 || gy >= mapData.length) return;

  // 计算移动方向
  var dx = gx - player.x;
  var dy = gy - player.y;
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !(dx === 0 && dy === 0)) {
    execMove(dx, dy);
  }
}

function handleDialogTap(tx, ty) {
  var choice = renderer.hitTestDialogChoices(tx, ty);
  if (choice !== null) {
    continueDialog();
  }
  // 点击对话框区域任意位置也可以继续
  if (ty > renderer.H - 140 - renderer.SAFE_BOTTOM) {
    continueDialog();
  }
}

var battleLogText = '';

function handleBattleTap(tx, ty) {
  var action = renderer.hitTestBattleButtons(tx, ty);
  if (action) {
    battleAction(action);
  }
}

function handleBattleKey(e) {
  var k = (e.key || '').toLowerCase();
  if (k === '1' || k === 'a') battleAction('atk');
  if (k === '2' || k === 's') battleAction('skill');
  if (k === '3' || k === 'i') battleAction('item');
  if (k === '4' || k === 'f') battleAction('flee');
}

function handleBackpackTap(tx, ty) {
  var result = renderer.hitTestBackpack(tx, ty);
  if (!result) {
    closeBackpack();
    return;
  }
  if (result.type === 'slot') {
    var items = player.items || [];
    var idx = result.row * 4 + result.col;
    if (idx < items.length) {
      bagSelectedId = items[idx].id;
    }
  } else if (result.type === 'use') {
    useBagItem();
  } else if (result.type === 'discard') {
    discardBagItem();
  } else if (result.type === 'close') {
    closeBackpack();
  }
}

function handleSettingsTap(tx, ty) {
  var result = renderer.hitTestSettings(tx, ty);
  if (!result) {
    closeSettings();
    return;
  }
  if (result.type === 'sfxVol') {
    audio.setSfxVol(Math.max(0, Math.min(1, result.value)));
  } else if (result.type === 'musicVol') {
    audio.setMusicVol(Math.max(0, Math.min(1, result.value)));
  } else if (result.type === 'save') {
    saveGame();
    renderer.setHint('💾 存档成功！');
    closeSettings();
  } else if (result.type === 'close') {
    closeSettings();
  }
}

function handleActionBar(action) {
  switch (action) {
    case 'inventory':
      openBackpack(false);
      break;
    case 'quest':
      showQuest();
      break;
    case 'meditate':
      meditate();
      break;
    case 'settings':
      openSettings();
      break;
  }
}

function handleKeyDown(e) {
  if (!gameStarted) return;
  var k = (e.key || '').toLowerCase();

  if (state === 'dialog') {
    if (k === 'escape' || k === ' ' || k === 'enter' || k === 'e') {
      continueDialog();
    }
    return;
  }

  if (inBattle) return;

  // 快捷键
  if (k === ' ' || k === 'e' || k === 'enter') { interactWithNPC(); return; }
  if (k === 'i') { openBackpack(false); return; }
  if (k === 'q') { showQuest(); return; }
  if (k === 'm') { meditate(); return; }
  if (k === 'escape') {
    if (state === 'settings') closeSettings();
    else if (state === 'backpack') closeBackpack();
    return;
  }

  // 移动键
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) {
    if (!keyStates[k]) {
      keyStates[k] = true;
      updateKeyMove();
    }
  }
}

function handleKeyUp(e) {
  var k = (e.key || '').toLowerCase();
  if (keyStates[k]) {
    keyStates[k] = false;
    updateKeyMove();
  }
}

function updateKeyMove() {
  stopMoveLoop();
  if (keyStates['w'] || keyStates['arrowup']) startMoveLoop('up');
  else if (keyStates['s'] || keyStates['arrowdown']) startMoveLoop('down');
  else if (keyStates['a'] || keyStates['arrowleft']) startMoveLoop('left');
  else if (keyStates['d'] || keyStates['arrowright']) startMoveLoop('right');
}

var lastMoveTime = 0;

function startMoveLoop(dir) {
  var now = Date.now();
  if (moveDir === dir && moveTimer) return; // 同方向已启动
  moveDir = dir;
  renderer.setPlayerFacing(dir);
  renderer.setPlayerMoving(true);
  if (moveTimer) clearInterval(moveTimer);
  // 防止方向切换时立即执行两步
  if (now - lastMoveTime >= moveThrottle) {
    execMoveByDir(dir);
    lastMoveTime = now;
  }
  moveTimer = setInterval(function() {
    if (state !== 'playing' || !moveDir) { stopMoveLoop(); return; }
    execMoveByDir(moveDir);
    lastMoveTime = Date.now();
  }, moveThrottle);
}

function stopMoveLoop() {
  moveDir = null;
  renderer.setPlayerMoving(false);
  if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }
}

function execMoveByDir(dir) {
  switch (dir) {
    case 'up': execMove(0, -1); break;
    case 'down': execMove(0, 1); break;
    case 'left': execMove(-1, 0); break;
    case 'right': execMove(1, 0); break;
  }
}

// ====== 移动系统 ======
function execMove(dx, dy) {
  if (!gameStarted || inBattle) return;
  var nx = player.x + dx, ny = player.y + dy;
  var mw = mapData[0].length, mh = mapData.length;

  // 地图边界：只有站在出入口范围内才能切换地图
  if (nx < 0 || nx >= mw || ny < 0 || ny >= mh) {
    var exits = data.allMaps[currentMap].exits || [];
    var dir = (ny < 0) ? 'north' : (ny >= mh) ? 'south' : (nx < 0) ? 'west' : 'east';
    var found = null;
    for (var i = 0; i < exits.length; i++) {
      var e = exits[i];
      if (e.dir !== dir) continue;
      var r0 = e.range[0], r1 = e.range[1];
      if (dir === 'north' || dir === 'south') {
        if (player.x >= r0 && player.x <= r1) { found = e; break; }
      } else {
        if (player.y >= r0 && player.y <= r1) { found = e; break; }
      }
    }
    if (found) switchMap(found.to, found.entry[0], found.entry[1]);
    return;
  }

  // 不可通行
  var t = mapData[ny][nx];
  if (t === 'W' || t === 'C') return;

  // 检查敌人
  for (var i = 0; i < enemies.length; i++) {
    var en = enemies[i];
    if (en.x === nx && en.y === ny && !deadEnemies[en.id]) {
      audio.sfxStart();
      startBattle(i);
      return;
    }
  }

  player.x = nx; player.y = ny;

  // 检查NPC附近
  checkNpcProximity();

  // 区域名
  var loc = data.areaName(nx, ny);
  // 区域名hint只在留空时显示（用状态栏区域名代替）
}

function switchMap(targetMapId, entryX, entryY) {
  loadMapGlobals(targetMapId);
  player.x = Math.max(0, Math.min(mapData[0].length - 1, entryX));
  player.y = Math.max(0, Math.min(mapData.length - 1, entryY));
  var t = mapData[player.y] && mapData[player.y][player.x];
  if (t === 'W' || t === 'C') {
    for (var r = 1; r < 5; r++) {
      var found = false;
      for (var dx = -r; dx <= r && !found; dx++) {
        for (var dy = -r; dy <= r && !found; dy++) {
          var nx = player.x + dx, ny = player.y + dy;
          if (nx >= 0 && nx < mapData[0].length && ny >= 0 && ny < mapData.length) {
            var nt = mapData[ny][nx];
            if (nt !== 'W' && nt !== 'C') { player.x = nx; player.y = ny; found = true; }
          }
        }
      }
      if (found) break;
    }
  }
  data.mapData = mapData;
  data.npcs = npcs;
  data.enemies = enemies;
  data.deadEnemies = deadEnemies;
  renderer.setMapBanner(data.allMaps[targetMapId].name);
}

// ====== NPC交互 ======
function checkNpcProximity() {
  for (var i = 0; i < npcs.length; i++) {
    var n = npcs[i];
    if (Math.abs(player.x - n.x) <= 1 && Math.abs(player.y - n.y) <= 1) {
      renderer.setHint('点击🗡️与' + n.name + '对话');
      return;
    }
  }
}

function interactWithNPC() {
  if (!gameStarted) return;
  for (var i = 0; i < npcs.length; i++) {
    var n = npcs[i];
    if (Math.abs(player.x - n.x) <= 1 && Math.abs(player.y - n.y) <= 1) {
      curNpc = i;
      curNpcDi = getNpcStartDialog(i);
      openDialog(n.dialogs[curNpcDi]);
      return;
    }
  }
  // 演武场治疗
  if (mapData[player.y] && mapData[player.y][player.x] === 'A') {
    player.hp = player.maxHp; player.mp = player.maxMp;
    audio.sfxHeal();
    renderer.setHint('🧘 在演武场调息，气血内力完全恢复！');
  }
  // 同格敌人
  for (var i = 0; i < enemies.length; i++) {
    var en = enemies[i];
    if (en.x === player.x && en.y === player.y && !deadEnemies[en.id]) {
      startBattle(i);
      return;
    }
  }
}

// ====== 对话系统 ======
var dialogSpeaker = '';
var dialogText = '';
var dialogChoices = [];

function openDialog(d) {
  var n = npcs[curNpc];
  dialogSpeaker = n.name;
  dialogText = d.s;
  dialogChoices = [];

  if (d.heal) {
    dialogChoices = ['有劳大师', '不必了'];
  } else if (d.q) {
    if (!player.quests[d.q]) {
      dialogChoices = ['义不容辞', '容我再想想'];
    } else if (d.t2 && quests[d.q].done && !quests[d.q].rewardClaimed) {
      dialogChoices = ['领取报酬', '告辞'];
    }
  } else if (d.buy) {
    dialogChoices = ['买行军散(10钱)', '不了，告辞'];
  }

  if (dialogChoices.length === 0) {
    dialogChoices = ['继续'];
  }

  state = 'dialog';
}

function renderDialogUI() {
  var npcType = (npcs[curNpc] && npcs[curNpc].type) ? npcs[curNpc].type : 'master';
  var key = renderer.spriteKeyFor('npc', npcType);
  renderer.drawDialog(dialogSpeaker, dialogText, dialogChoices, key);
}

function continueDialog() {
  var d = npcs[curNpc].dialogs[curNpcDi];
  var choice = dialogChoices[0];

  if (d.heal && choice === '有劳大师') {
    doHeal();
    return;
  }
  if (d.buy && choice === '买行军散(10钱)') {
    buyItem();
    return;
  }
  if (d.q && choice === '义不容辞') {
    acceptQuest(d.q);
    return;
  }
  if (d.q && choice === '领取报酬') {
    claimReward(d.q);
    return;
  }

  // 显示后续文本
  if (d.t) {
    dialogText = d.t;
    dialogChoices = [];
    if (d.q) {
      if (player.quests[d.q] && quests[d.q].done && d.t2 && !quests[d.q].rewardClaimed) {
        dialogChoices = ['继续'];
      } else if (!player.quests[d.q]) {
        dialogChoices = ['义不容辞', '容我再想想'];
      } else {
        dialogChoices = ['告辞'];
      }
    } else if (d.buff || d.t2) {
      dialogChoices = ['继续'];
      if (d.t2) {
        // t2 will be shown next
      }
    } else {
      var nextDi = findNextDialog(curNpc, curNpcDi);
      if (nextDi >= 0) dialogChoices = ['继续'];
      else dialogChoices = ['告辞'];
    }
  } else if (d.t2) {
    dialogText = d.t2;
    if (d.buff) {
      applyBuff(d.buff);
    }
    dialogChoices = ['告辞'];
  } else {
    closeDialog();
  }
}

function closeDialog() {
  state = 'playing';
  dialogSpeaker = '';
  dialogText = '';
  dialogChoices = [];
}

function doHeal() {
  player.hp = player.maxHp; player.mp = player.maxMp;
  audio.sfxHeal();
  renderer.setHint('🧘 大师诵经祈福，你感到浑身舒畅！');
  closeDialog();
}

function buyItem() {
  if (player.gold < 10) { renderer.setHint('五铢钱不够!'); closeDialog(); return; }
  player.gold -= 10;
  addItem('potion', 1);
  audio.sfxCoin();
  renderer.setHint('💊 购得行军散一包!');
  closeDialog();
}

function getNpcStartDialog(npcIdx) {
  var n = npcs[npcIdx];
  if (n.id === 'master') {
    if (player.quests.quest_1 && !quests.quest_1.done) return 2;
    if (player.quests.quest_1 && quests.quest_1.done && !quests.quest_1.rewardClaimed) return 1;
    if (player.quests.quest_1 && quests.quest_1.rewardClaimed && !player.quests.quest_2) return 3;
    if (player.quests.quest_2 && !quests.quest_2.done) return 5;
    if (player.quests.quest_2 && quests.quest_2.done && !quests.quest_2.rewardClaimed) return 4;
    return 0;
  }
  if (n.id === 'escort') {
    if (player.quests.quest_3 && quests.quest_3.done && !quests.quest_3.rewardClaimed) return 1;
    if (player.quests.quest_3 && quests.quest_3.rewardClaimed) return 0;
    if (player.quests.quest_2 && quests.quest_2.done && !player.quests.quest_3) return 1;
    return 0;
  }
  return 0;
}

function findNextDialog(npcIdx, curDi) {
  var next = curDi + 1;
  if (next >= npcs[npcIdx].dialogs.length) return -1;
  var nd = npcs[npcIdx].dialogs[next];
  if (nd.q && player.quests[nd.q]) return -1;
  var n = npcs[npcIdx];
  if (n.id === 'master' && curDi === 2 && !quests.quest_1.done) return -1;
  if (n.id === 'master' && curDi === 5 && !quests.quest_2.done) return -1;
  return next;
}

function applyBuff(buff) {
  if (buff.mp) { player.maxMp += buff.mp; player.mp = Math.min(player.mp + buff.mp, player.maxMp); renderer.setHint('💠 内力上限+' + buff.mp + '！'); }
  if (buff.hp) { player.maxHp += buff.hp; player.hp = Math.min(player.hp + buff.hp, player.maxHp); renderer.setHint('❤️ 气血上限+' + buff.hp + '！'); }
}

function acceptQuest(q) {
  player.quests[q] = true;
  audio.sfxQuest();
  quests[q].progress = killCounts[q === 'quest_1' ? 'bandit' : q === 'quest_2' ? 'bully' : 'boss'];
  if (quests[q].progress >= quests[q].target) {
    quests[q].done = true;
    showModal('📜 任务已接受', '【' + quests[q].name + '】\n' + quests[q].desc + '\n\n✅ 你已完成此任务的要求！\n速去领取报酬吧！');
  } else {
    showModal('📜 任务已接受', '【' + quests[q].name + '】\n' + quests[q].desc + '\n\n目标: ' + quests[q].progress + '/' + quests[q].target);
  }
  closeDialog();
}

function claimReward(q) {
  if (quests[q].rewardClaimed) { renderer.setHint('报酬已领取过了！'); closeDialog(); return; }
  quests[q].rewardClaimed = true;
  var qd = quests[q];
  player.gold += qd.rewardGold;
  player.exp += qd.rewardExp;
  audio.sfxCoin();
  var lvUp = checkLevelUpSilent();
  var txt = '【' + qd.name + '】完成！\n\n💰 五铢钱 +' + qd.rewardGold + '\n✨ 修为 +' + qd.rewardExp;
  if (lvUp > 0) txt += '\n\n🎉 威名远扬！等级提升至' + player.level + '级！';
  showModal('🏆 任务完成', txt);
  closeDialog();
}

// ====== 战斗系统 ======
function startBattle(ei) {
  enemyIdx = ei;
  var e = enemies[ei];
  enemyHp = e.hp; enemyMaxHp = e.hp;
  inBattle = true;
  state = 'battle';
  battleLogText = '⚔️ 狭路相逢！' + e.name + '挡在了你的面前！';
  stopMoveLoop();
}

function battleAction(act) {
  var e = enemies[enemyIdx];

  if (act === 'flee') {
    if (Math.random() < 0.5) {
      battleLogText = '💨 轻功施展，脱离了战斗！';
      audio.sfxFlee();
      endBattle(false);
    } else {
      battleLogText = '❌ 逃脱失败！';
      audio.sfxHit();
      enemyTurnDo();
    }
    return;
  }

  if (act === 'atk') {
    var rng = Math.floor(Math.random() * 7);
    var crit = rng >= 5 ? 2 : 1;
    var dmg = Math.max(1, Math.floor((player.atk - e.def) * crit + Math.random() * 5));
    enemyHp -= dmg;
    battleLogText = '⚔️ 一剑挥出，造成 ' + dmg + ' 点伤害！' + (crit > 1 ? ' 【会心一击！】' : '');
    if (crit > 1) { audio.sfxCrit(); renderer.setShake('enemy', 1.3, 0.55); renderer.setFlash(0.8); }
    else { audio.sfxSword(); renderer.setShake('enemy', 1, 0.4); }
    renderer.addDamage(dmg, 'enemy', crit > 1);
    renderer.triggerSlash('enemy');
  }

  if (act === 'skill') {
    if (player.mp < 10) { battleLogText = '💠 内力不足！需要10点内力'; return; }
    player.mp -= 10;
    audio.sfxSkill();
    var baseDmg = Math.max(3, Math.floor(player.atk * 2.2) - e.def * 3 + Math.floor(Math.random() * 10));
    enemyHp -= baseDmg;
    audio.sfxSlash();
    renderer.setShake('enemy', 1.2, 0.55);
    renderer.addDamage(baseDmg, 'enemy', false);
    renderer.triggerSlash('enemy');
    battleLogText = '🗡️ 霸王枪！造成 ' + baseDmg + ' 点伤害！(消耗10内力)';
  }

  if (act === 'item') {
    if (getTotalItems() <= 0) {
      battleLogText = '❌ 行囊空空，无物可用！';
      return;
    }
    openBackpack(true);
    return;
  }

  if (enemyHp <= 0) {
    battleLogText = '🎉 ' + e.name + ' 被击败了！';
    endBattle(true);
    return;
  }
  enemyTurnDo();
}

function enemyTurnDo() {
  var e = enemies[enemyIdx];
  var dmg = Math.max(1, e.atk - player.def + Math.floor(Math.random() * 5));
  var crit = false;
  if (Math.random() < 0.12) { dmg = Math.floor(dmg * 1.8); crit = true; }
  player.hp -= dmg;
  battleLogText += '\n' + e.name + '反击，造成 ' + dmg + ' 点伤害！' + (crit ? ' 【重击！】' : '');
  audio.sfxHit();
  if (crit) renderer.setShake('player', 1.5, 0.55);
  else renderer.setShake('player', 1, 0.4);
  renderer.addDamage(dmg, 'player', crit);
  renderer.triggerSlash('player');

  if (player.hp <= 0) {
    player.hp = 1;
    audio.sfxDefeat();
    endBattle(false);
    player.x = 9; player.y = 3;
    showModal('💀 力竭倒下', '你被敌人击败了！\n\n被过路商队救回了颍川，气血恢复至1。\n回去调息修养后再来报仇吧！');
  }
}

function endBattle(won) {
  var e = enemies[enemyIdx];
  state = 'playing';
  inBattle = false;
  enemyIdx = null;
  battleLogText = '';
  // 重置战斗演出抖动/闪光，避免残留影响地图（否则 shakeTarget='enemy' 会让全图敌人抖动）
  renderer.setShake('', 0, 0);
  renderer.setFlash(0);

  if (won) {
    audio.sfxVictory();
    player.exp += e.exp;
    player.gold += e.gold;

    deadEnemies[e.id] = true;
    data.deadEnemies = deadEnemies;

    if (e.type === 'bandit') killCounts.bandit++;
    if (e.type === 'bully') killCounts.bully++;
    if (e.type === 'guard') killCounts.guard++;
    if (e.type === 'boss') killCounts.boss++;
    data.killCounts = killCounts;

    // 任务进度
    var questDone = false;
    if (player.quests.quest_1 && !quests.quest_1.done && e.type === 'bandit') {
      quests.quest_1.progress++;
      if (quests.quest_1.progress >= quests.quest_1.target) { quests.quest_1.done = true; questDone = true; }
    }
    if (player.quests.quest_2 && !quests.quest_2.done && e.type === 'bully') {
      quests.quest_2.progress++;
      if (quests.quest_2.progress >= quests.quest_2.target) { quests.quest_2.done = true; questDone = true; }
    }
    if (e.type === 'boss' && player.quests.quest_3 && !quests.quest_3.done) {
      quests.quest_3.progress++;
      if (quests.quest_3.progress >= quests.quest_3.target) { quests.quest_3.done = true; questDone = true; }
    }

    var lvUp = checkLevelUpSilent();
    var txt = '⚔️ ' + e.name + ' 已被击败！\n\n💰 五铢钱 +' + e.gold + '\n✨ 修为 +' + e.exp;
    if (lvUp > 0) txt += '\n\n🎉 威名远扬！等级提升至' + player.level + '级！';
    if (questDone) txt += '\n\n📜 有任务目标已达成！回去领赏吧。';
    showModal('🎉 战斗胜利', txt);
  }
}

function checkLevelUpSilent() {
  var gained = 0;
  while (player.exp >= player.expNeed) {
    player.exp -= player.expNeed;
    player.level++;
    player.expNeed = Math.floor(player.expNeed * 1.6);
    player.maxHp += 22; player.hp = player.maxHp;
    player.maxMp += 12; player.mp = player.maxMp;
    player.atk += 4; player.def += 2;
    gained++;
    audio.sfxLevelUp();
  }
  return gained;
}

// ====== 背包系统 ======
function getItemCount(id) {
  var idx = findItemIdx(id);
  return idx >= 0 ? player.items[idx].count : 0;
}

function findItemIdx(id) {
  if (!player.items) return -1;
  for (var i = 0; i < player.items.length; i++) {
    if (player.items[i].id === id) return i;
  }
  return -1;
}

function addItem(id, count) {
  if (!player.items) player.items = [];
  count = count || 1;
  var idx = findItemIdx(id);
  if (idx >= 0) {
    player.items[idx].count = Math.min(99, player.items[idx].count + count);
  } else {
    player.items.push({ id: id, count: Math.min(99, count) });
  }
}

function removeItem(id, count) {
  count = count || 1;
  var idx = findItemIdx(id);
  if (idx < 0) return false;
  player.items[idx].count -= count;
  if (player.items[idx].count <= 0) player.items.splice(idx, 1);
  return true;
}

function getTotalItems() {
  var n = 0;
  if (!player.items) return 0;
  for (var i = 0; i < player.items.length; i++) n += player.items[i].count;
  return n;
}

function openBackpack(inBat) {
  backpackInBattle = !!inBat;
  bagSelectedId = null;
  state = 'backpack';
}

function closeBackpack() {
  state = backpackInBattle ? 'battle' : 'playing';
  bagSelectedId = null;
  backpackInBattle = false;
}

function useBagItem() {
  if (!bagSelectedId) return;
  var def = data.ITEM_DB[bagSelectedId];
  var count = getItemCount(bagSelectedId);
  if (count <= 0) return;

  var eff = def.effect;
  var used = false;
  var msg = '';

  if (def.type === 'heal') {
    if (player.hp >= player.maxHp) {
      msg = '💡 气血已满，无需恢复！';
    } else if (eff.hp === 'full') {
      removeItem(def.id, 1);
      player.hp = player.maxHp;
      msg = '🧪 服下' + def.name + '，气血完全恢复！';
      audio.sfxHeal(); used = true;
    } else {
      removeItem(def.id, 1);
      player.hp = Math.min(player.maxHp, player.hp + eff.hp);
      msg = '💊 服下' + def.name + '，恢复 ' + eff.hp + ' 气血！';
      audio.sfxHeal(); used = true;
    }
  } else if (def.type === 'mp') {
    if (player.mp >= player.maxMp) {
      msg = '💡 内力已满，无需恢复！';
    } else {
      removeItem(def.id, 1);
      player.mp = Math.min(player.maxMp, player.mp + (eff.mp || 20));
      msg = '💠 服下' + def.name + '，恢复 ' + (eff.mp || 20) + ' 内力！';
      audio.sfxHeal(); used = true;
    }
  } else if (def.type === 'gold') {
    removeItem(def.id, 1);
    player.gold += (eff.gold || 50);
    msg = '💰 打开' + def.name + '，获得 ' + (eff.gold || 50) + ' 两！';
    audio.sfxCoin(); used = true;
  }

  if (backpackInBattle && used) {
    battleLogText = msg;
    closeBackpack();
    if (enemyHp <= 0) {
      endBattle(true);
    } else {
      enemyTurnDo();
    }
    return;
  }

  closeBackpack();
  renderer.setHint(used ? '✅ ' + msg : msg);
}

function discardBagItem() {
  if (!bagSelectedId) return;
  removeItem(bagSelectedId, 1);
  closeBackpack();
}

// ====== 其他功能 ======
function meditate() {
  if (player.gold < 15) { renderer.setHint('💰 需要15枚五铢钱'); return; }
  player.gold -= 15;
  player.hp = Math.min(player.maxHp, player.hp + 50);
  player.mp = Math.min(player.maxMp, player.mp + 20);
  audio.sfxHeal();
  renderer.setHint('🧘 打坐调息一番，恢复50气血和20内力');
}

function showQuest() {
  var txt = '📜 乱世任务\n\n';
  var hasQuest = false;
  for (var k in quests) {
    var q = quests[k];
    if (!player.quests[k]) continue;
    hasQuest = true;
    var status = q.done ? '[✅ 已完成]' : '[进行中 ' + q.progress + '/' + q.target + ']';
    txt += status + ' ' + q.name + '\n  ' + q.desc + '\n  报酬: ' + q.rewardGold + '钱 +' + q.rewardExp + '修为\n\n';
  }
  if (!hasQuest) txt += '暂无进行中的任务。\n前往颍川找县尉韩伯接取任务吧！\n\n';
  txt += '击杀: 黄巾×' + killCounts.bandit + ' 溃兵×' + killCounts.bully + ' 西凉×' + killCounts.guard;
  showModal('任务', txt);
}

function openSettings() {
  state = 'settings';
}

function closeSettings() {
  storage.saveSettings(audio.sfxVol, audio.musicVol);
  state = 'playing';
}

function saveGame() {
  var success = storage.saveGame(player, killCounts, data.mapDeadStates, currentMap, quests);
  if (success) renderer.setHint('💾 存档成功！');
  else renderer.setHint('❌ 存档失败');
}

var modalTitle = '';
var modalContent = '';

function showModal(title, text) {
  modalTitle = title;
  modalContent = text;
  state = 'modal';
}

function closeModal() {
  state = 'playing';
  modalTitle = '';
  modalContent = '';
}

module.exports = {
  init: init,
  startPrologue: startPrologue,
  loadGame: loadGame,
  hasSave: function() { return storage.hasSave(); },
  saveGame: saveGame
};

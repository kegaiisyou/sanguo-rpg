// ==================== 乱世烽火 - 小程序版 ====================
var { TILE, MAP_W, MAP_H, tileStyle, allMaps, ITEM_DB, quests: defaultQuests, defaultPlayer, areaName, COMPANION_TEMPLATES } = require('../../utils/gameData.js');
var { renderPortrait, pxDef } = require('../../utils/pixelChar.js');
var audio = require('../../utils/audio.js');

// 小程序环境调试
var console = console || { log: function () { }, error: function () { } };

Page({
  data: {
    showOverlay: false,
    dialog: { show: false, speaker: '', text: '', choices: [] },
    battle: { show: false, enemies: [], log: '', log2: '', playerHpPercent: 100, playerMpPercent: 100, playerHit: false, critShow: false, critText: '', dmgShow: false, dmgNum: '', dmgDir: '', quickItem: null, companion: null, companionHpPercent: 100, targetIdx: 0, critShake: false, critOverlay: false, slashShow: false, sparks: [] },
    bag: { show: false, items: [] },
    settings: { show: false, musicVol: 35, sfxVol: 70, musicEnabled: true, sfxEnabled: true },
    hint: { text: '', show: false },
    toast: { show: false, title: '', text: '' },
    questPanel: { show: false, quests: [] },
    mapBanner: { show: false, text: '' },
    locText: '',
    bpDetail: null,
    hpPercent: 100,
    mpPercent: 100,
    expPercent: 0,
    player: {},
    playerName: '豪杰',
    bpSelectedId: '',
    gameStarted: false,
    showTitle: true,
    safeTop: 0,
    safeBottom: 0,
    menuRight: 90,
    prologue: { show: false, text: '', btnText: '继续', portraitRendered: false, isLast: false, hasSave: false }
  },

  // ==================== CORE STATE ====================
  ctx: null,
  canvas: null,
  cw: 0, ch: 0,
  offX: 0, offY: 0,

  player: null,
  currentMap: 'dungeon',
  mapData: null,
  npcs: [],
  enemies: [],
  deadEnemies: {},
  mapDeadStates: { dungeon: {}, labor: {}, barracks: {}, storage: {}, gate: {} },
  killCounts: { bandit: 0, bully: 0, guard: 0, boss: 0 },

  curNpc: null, curNpcDi: 0,
  inBattle: false, defending: false,
  battleEnemies: [],  // [{ref: enemyObj, hp, maxHp, hit: false, dead: false}]
  targetIdx: 0,       // 当前攻击目标索引
  companion: null,     // 同伴状态
  gameStarted: false,

  // 移动控制
  moveDir: null,
  moveTimer: null,
  moveThrottle: 160,
  _dirJustTouched: false,

  // PC 键盘控制（WASD / 方向键，仅 PC 端微信客户端有效）
  keyStates: {},
  lastKeyDir: null,
  keyMoveTimer: null,
  keyDownListener: null,
  keyUpListener: null,


  // 动画系统
  animFrame: 0,        // 全局动画计数器
  animTimer: null,     // 动画定时器
  isMoving: false,     // 当前是否在移动
  moveFrameCount: 0,   // 移动动画帧计数

  // 原版任务（副本，避免污染data）
  quests: JSON.parse(JSON.stringify(defaultQuests)),

  // 提示/timer
  hintTimer: null,

  // 背包临时选择
  _bpSelectedId: '',

  // ==================== 生命周期 ====================
  onLoad() {
    var that = this;
    // 初始化音频
    audio.init();
    audio.playTitleBgm();
    // 安全区适配
    var sys = wx.getSystemInfoSync();
    var safeTop = sys.statusBarHeight || 0;
    var safeBottom = 0;
    if (sys.safeArea && sys.safeArea.bottom < sys.screenHeight) {
      safeBottom = sys.screenHeight - sys.safeArea.bottom;
    }
    // 右上角胶囊按钮避让（避免地图信息被关闭按钮遮挡）
    var menuRight = 16;
    if (wx.getMenuButtonBoundingClientRect) {
      var mr = wx.getMenuButtonBoundingClientRect();
      if (mr && mr.width) {
        menuRight = Math.max(16, Math.ceil(mr.width + 8));
      }
    }

    this.setData({ safeTop: safeTop, safeBottom: safeBottom, menuRight: menuRight });
    this.safeTop = safeTop;
    this.safeBottom = safeBottom;

    // PC 端注册全局键盘事件（WASD / 方向键），移动端基础库不支持则静默跳过
    this.keyStates = {};
    this.lastKeyDir = null;
    if (wx.canIUse('onKeyDown') && wx.canIUse('onKeyUp')) {
      this.keyDownListener = function (e) { that.onKeyDown(e); };
      this.keyUpListener = function (e) { that.onKeyUp(e); };
      wx.onKeyDown(this.keyDownListener);
      wx.onKeyUp(this.keyUpListener);
    }

    // 初始化玩家数据
    this.player = defaultPlayer();
    this.loadMapGlobals('dungeon');

    // 获取 Canvas 2D 上下文（标题页 canvas 被隐藏，可能尺寸为 0，startGame 会再初始化一次）
    this.initGameCanvas(function () {
      // 检查是否有存档，有则启用"再续前缘"按钮
      var hasSave = !!wx.getStorageSync('luanshi_save');
      that.setData({ 'prologue.hasSave': hasSave });
    });
  },

  // 初始化/重新初始化游戏 Canvas
  _canvasRetryCount: 0,
  initGameCanvas(cb) {
    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#game-canvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0]) {
        console.error('Canvas not found');
        // 重试一次
        if (that._canvasRetryCount < 2) {
          that._canvasRetryCount++;
          setTimeout(function () { that.initGameCanvas(cb); }, 200);
          return;
        }
        if (cb) cb(); return;
      }
      var canvas = res[0].node;
      var ctx = canvas.getContext('2d');
      var dpr = wx.getSystemInfoSync().pixelRatio;
      var cw = res[0].width || 0;
      var ch = res[0].height || 0;
      if (cw <= 0 || ch <= 0) {
        console.warn('Canvas size 0, retrying...');
        if (that._canvasRetryCount < 2) {
          that._canvasRetryCount++;
          setTimeout(function () { that.initGameCanvas(cb); }, 200);
          return;
        }
        if (cb) cb(); return;
      }
      that._canvasRetryCount = 0;
      that.cw = cw;
      that.ch = ch;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
      that.canvas = canvas;
      that.ctx = ctx;

      // Canvas 尺寸确定后，按屏幕高度重新计算 TILE，让地图撑满
      that.loadMapGlobals(that.currentMap);
      if (cb) cb();
    });
  },

  onUnload() {
    if (this.keyMoveTimer) { clearInterval(this.keyMoveTimer); this.keyMoveTimer = null; }
    if (this.keyDownListener && wx.canIUse('offKeyDown')) { wx.offKeyDown(this.keyDownListener); this.keyDownListener = null; }
    if (this.keyUpListener && wx.canIUse('offKeyUp')) { wx.offKeyUp(this.keyUpListener); this.keyUpListener = null; }
    if (this.moveTimer) clearInterval(this.moveTimer);
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (this._typeTimer) clearInterval(this._typeTimer);
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    if (this._toastTimer) clearTimeout(this._toastTimer);
    if (this._critTimer) clearTimeout(this._critTimer);
    if (this._dmgTimer) clearTimeout(this._dmgTimer);
    if (this._tutTimer) clearInterval(this._tutTimer);
    if (this.animTimer) { clearInterval(this.animTimer); this.animTimer = null; }
    audio.destroy();
  },

  // 从后台恢复时继续 BGM
  onShow() {
    if (this.gameStarted && !this.inBattle) {
      audio.playBgm();
    }
  },

  // ==================== 地图加载 ====================
  loadMapGlobals(mapId) {
    var m = allMaps[mapId];
    if (!m) return;
    this.mapData = m.data;
    this.npcs = JSON.parse(JSON.stringify(m.npcs));
    this.enemies = JSON.parse(JSON.stringify(m.enemies));
    MAP_W = m.data[0].length;
    MAP_H = m.data.length;
    // 根据 Canvas 高度自动计算 TILE，让地图纵向撑满，横向滚动
    if (this.cw > 0 && this.ch > 0) {
      TILE = Math.max(32, Math.floor(this.ch / MAP_H));
    }
    if (!this.mapDeadStates[mapId]) this.mapDeadStates[mapId] = {};
    this.deadEnemies = this.mapDeadStates[mapId];

    // ===== 校验 NPC/敌人位置：如果落在不可通行格子上，自动偏移到最近空地 =====
    this._validateActorPositions(this.npcs);
    this._validateActorPositions(this.enemies);
  },

  // 确保 NPC 和敌人不站在墙壁/C/水/障碍物上
  _validateActorPositions(actors) {
    var that = this;
    if (!actors) return;
    for (var i = 0; i < actors.length; i++) {
      var a = actors[i];
      if (a.x < 0 || a.x >= MAP_W || a.y < 0 || a.y >= MAP_H) continue;
      var t = that.mapData[a.y] && that.mapData[a.y][a.x];
      if (t === 'W' || t === 'C') {
        // 螺旋搜索最近的可通行格（半径 3）
        for (var r = 1; r <= 3; r++) {
          var found = false;
          for (var dx = -r; dx <= r && !found; dx++) {
            for (var dy = -r; dy <= r && !found; dy++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              var nx = a.x + dx, ny = a.y + dy;
              if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
                var nt = that.mapData[ny][nx];
                if (nt !== 'W' && nt !== 'C') {
                  a.x = nx; a.y = ny; found = true;
                }
              }
            }
          }
          if (found) break;
        }
      }
    }
  },

  switchMap(targetMapId, entryX, entryY) {
    this.currentMap = targetMapId;
    this.loadMapGlobals(targetMapId);

    // 放置玩家
    this.player.x = Math.max(0, Math.min(MAP_W - 1, entryX));
    this.player.y = Math.max(0, Math.min(MAP_H - 1, entryY));

    var t = this.mapData[this.player.y] && this.mapData[this.player.y][this.player.x];
    if (t === 'W' || t === 'C') {
      var found = false;
      for (var r = 1; r < 5 && !found; r++) {
        for (var dx = -r; dx <= r && !found; dx++) {
          for (var dy = -r; dy <= r && !found; dy++) {
            var nx2 = this.player.x + dx, ny2 = this.player.y + dy;
            if (nx2 >= 0 && nx2 < MAP_W && ny2 >= 0 && ny2 < MAP_H) {
              var nt = this.mapData[ny2][nx2];
              if (nt !== 'W' && nt !== 'C') { this.player.x = nx2; this.player.y = ny2; found = true; }
            }
          }
        }
      }
    }

    this.render();
    this.updateLocName();
    this.showMapBanner('— ' + allMaps[targetMapId].name + ' —');
    // 切换地图时自动存档
    this.autoSave();
  },

  // 自动存档（静默，不弹提示）
  autoSave() {
    this.mapDeadStates[this.currentMap] = this.deadEnemies;
    var d = {
      player: JSON.parse(JSON.stringify(this.player)),
      killCounts: JSON.parse(JSON.stringify(this.killCounts)),
      mapDeadStates: JSON.parse(JSON.stringify(this.mapDeadStates)),
      currentMap: this.currentMap,
      quests: JSON.parse(JSON.stringify(this.quests))
    };
    try { wx.setStorageSync('luanshi_save', JSON.stringify(d)); } catch (e) { /* 静默失败 */ }
  },

  // 地图切换横幅
  showMapBanner(text) {
    var that = this;
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    this.setData({ mapBanner: { show: true, text: text } });
    this._bannerTimer = setTimeout(function () {
      that.setData({ 'mapBanner.show': false });
    }, 2000);
  },

  // ==================== 序幕：死牢疯囚 ====================
  prologueLines: [
    '【东汉·光和六年·幽州大营死牢】',
    '黑暗。潮湿。铁链拖地的声音从远处传来。',
    '「嘿嘿……又来了个活的？」',
    '角落里蜷缩着一个蓬头垢面的人，很久没剪的头发遮住了大半张脸。',
    '「知道这是哪吗？幽州大营的死牢！专关我们这种——犯了事还没被砍头的。」',
    '他忽然凑近，眼中闪过一瞬间的清明——',
    '「不过老夫在这关了七年，墙有几块砖、地有几道缝，闭着眼都知道。」',
    '疯子从破衣夹层摸出一根磨尖的铁片，塞进你手心。',
    '「拿着。别信任何人——包括我。你得靠自己，从这鬼地方爬出去。」',
    '   ——铁片冰凉，你攥紧它，望向铁栏外晃动的火光。'
  ],
  prologueIdx: 0,
  prologueTyping: false,

  // 从标题界面进入序幕
  startPrologue() {
    audio.playSfx('click');
    this.prologueIdx = 0;
    this.prologueTyping = false;
    this.setData({
      showTitle: false,
      'prologue.show': true,
      'prologue.text': '',
      'prologue.btnText': '继续',
      'prologue.isLast': false,
      'prologue.portraitRendered': false
    });
    // setData 完成后渲染疯囚犯立绘并开始打字
    var that = this;
    setTimeout(function () {
      that.renderStorytellerPortrait();
      that.showPrologueLine(0);
    }, 100);
  },

  // 渲染疯囚犯像素立绘
  renderStorytellerPortrait() {
    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#prologue-canvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0]) return;
      var canvas = res[0].node;
      var ctx = canvas.getContext('2d');
      var dpr = wx.getSystemInfoSync().pixelRatio;
      var w = 140, h = 170;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
      renderPortrait(canvas, 'storyteller', 140, 170, function () {
        that.setData({ 'prologue.portraitRendered': true });
      });
    });
  },

  // 打字效果
  showPrologueLine(idx) {
    if (idx >= this.prologueLines.length) {
      this.finishPrologue();
      return;
    }
    this.prologueIdx = idx;
    this.prologueTyping = true;

    var line = this.prologueLines[idx];
    var isLast = idx >= this.prologueLines.length - 1;
    this.setData({
      'prologue.text': '',
      'prologue.btnText': isLast ? '踏入乱世' : '继续',
      'prologue.isLast': isLast
    });

    var i = 0;
    var that = this;
    this._typeTimer = setInterval(function () {
      if (i < line.length) {
        i++;
        that.setData({ 'prologue.text': line.substring(0, i) });
      } else {
        clearInterval(that._typeTimer);
        that._typeTimer = null;
        that.prologueTyping = false;
      }
    }, 30);
  },

  // 继续/跳过打字
  skipPrologueTyping() {
    if (this.prologueTyping && this._typeTimer) {
      clearInterval(this._typeTimer);
      this._typeTimer = null;
      this.prologueTyping = false;
      this.setData({ 'prologue.text': this.prologueLines[this.prologueIdx] });
      return;
    }
    this.nextPrologue();
  },

  // 点击弹窗空白处也继续
  onPrologueBoxTap() {
    this.skipPrologueTyping();
  },

  // 下一条
  nextPrologue() {
    if (this.prologueTyping) return;
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    var next = this.prologueIdx + 1;
    if (next >= this.prologueLines.length) {
      this.finishPrologue();
      return;
    }
    this.showPrologueLine(next);
  },

  // 序幕结束，进入游戏
  finishPrologue() {
    if (this._typeTimer) { clearInterval(this._typeTimer); this._typeTimer = null; }
    this.setData({ 'prologue.show': false });
    this.startGame();
  },

  // 从标题界面直接读档
  onLoadGame() {
    audio.playSfx('click');
    this.setData({ showTitle: false });
    this.loadGame();
  },

  // ==================== 游戏启停 ====================
  startGame() {
    audio.playBgm();
    this.player = defaultPlayer();
    this.currentMap = 'dungeon';
    this.loadMapGlobals('dungeon');
    this.killCounts = { bandit: 0, bully: 0, guard: 0, boss: 0 };
    this.mapDeadStates = { dungeon: {}, labor: {}, barracks: {}, storage: {}, gate: {} };
    this.deadEnemies = {};
    this.gameStarted = true;
    this.setData({ gameStarted: true });
    this.player.quests = { quest_1: false, quest_2: false, quest_3: false };
    this.quests = JSON.parse(JSON.stringify(defaultQuests));

    var that = this;
    if (!this.ctx || this.cw <= 0 || this.ch <= 0) {
      this.initGameCanvas(function () {
        that.render();
        that.updateStats();
        that.updateLocName();
        that.startAnimLoop();
        that.showTutorialHints();
      });
    } else {
      this.render();
      this.updateStats();
      this.updateLocName();
      this.startAnimLoop();
      this.showTutorialHints();
    }
  },

  // 动画循环（驱动角色bob和粒子效果）
  startAnimLoop() {
    if (this.animTimer) return;
    var that = this;
    // 非战斗时 30fps 动画循环
    this.animTimer = setInterval(function () {
      if (!that.gameStarted || that.inBattle) return;
      that.animFrame++;
      // 移动结束后衰减 isMoving 标志
      if (that.isMoving && that.moveFrameCount <= 0) {
        that.isMoving = false;
      }
      if (that.moveFrameCount > 0) that.moveFrameCount--;
      // 驱动渲染（仅当非战斗）
      if (!that.data.showOverlay) {
        that.render();
      }
    }, 100); // 10fps 足够流畅，不浪费性能
  },

  // 标记移动状态
  markMoving() {
    this.isMoving = true;
    this.moveFrameCount = 4; // 保持移动状态 ~400ms
  },

  // 新手指引（多段提示）
  showTutorialHints() {
    var that = this;
    var hints = [
      '⬆⬇⬅➡ 方向键移动 | 点击地图也可移动',
      '💬 走到NPC旁按对话键 | 找到出路逃离大营',
      '⚔️ 击败狱卒和卫兵 | 搜集武器和伤药'
    ];
    var i = 0;
    this.showHint(hints[0]);
    this._tutTimer = setInterval(function () {
      i++;
      if (i < hints.length) that.showHint(hints[i]);
      else { clearInterval(that._tutTimer); that._tutTimer = null; }
    }, 3000);
  },

  loadGame() {
    try {
      var raw = wx.getStorageSync('luanshi_save');
      if (!raw) return false;
      var data = JSON.parse(raw);
      var p = data.player;
      Object.assign(this.player, p);

      this.killCounts = data.killCounts || { bandit: 0, bully: 0, guard: 0, boss: 0 };
      this.mapDeadStates = data.mapDeadStates || { dungeon: {}, labor: {}, barracks: {}, storage: {}, gate: {} };
      this.currentMap = data.currentMap || 'dungeon';
      this.loadMapGlobals(this.currentMap);
      this.quests = data.quests || JSON.parse(JSON.stringify(defaultQuests));
      // 从存档重建 player.quests 布尔状态
      this.player.quests = {};
      for (var qk in this.quests) {
        this.player.quests[qk] = this.quests[qk].done && this.quests[qk].rewardClaimed ? false : (this.quests[qk].progress > 0 || this.quests[qk].done);
      }

      this.gameStarted = true;
      this.setData({ gameStarted: true });
      audio.playBgm();
      var that = this;
      if (!this.ctx || this.cw <= 0 || this.ch <= 0) {
        this.initGameCanvas(function () {
          that.render();
          that.updateStats();
          that.updateLocName();
          that.showHint('📂 读档成功！');
        });
      } else {
        this.render();
        this.updateStats();
        this.updateLocName();
        this.showHint('📂 读档成功！');
      }
      return true;
    } catch (e) {
      console.error('读档失败', e);
      this.startGame();
      return false;
    }
  },

  saveGame() {
    this.mapDeadStates[this.currentMap] = this.deadEnemies;
    var d = {
      player: JSON.parse(JSON.stringify(this.player)),
      killCounts: JSON.parse(JSON.stringify(this.killCounts)),
      mapDeadStates: JSON.parse(JSON.stringify(this.mapDeadStates)),
      currentMap: this.currentMap,
      quests: JSON.parse(JSON.stringify(this.quests))
    };
    try {
      wx.setStorageSync('luanshi_save', JSON.stringify(d));
      this.showHint('💾 存档成功！');
    } catch (e) {
      this.showHint('❌ 存档失败');
    }
  },

  // ==================== 渲染 ====================
  render() {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var w = this.cw, h = this.ch;

    // 战斗中直接刷黑屏，防止原生 canvas 浮在战斗面板之上导致地图露出
    if (this.inBattle) {
      ctx.fillStyle = '#0a0303';
      ctx.fillRect(0, 0, w, h);
      return;
    }

    var af = this.animFrame || 0;

    // 清屏
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // 计算镜头偏移（玩家偏上，留出底部 UI 区）
    var cx = w / 2 - TILE / 2;
    // 玩家出现在 Canvas 上部 38% 处，为底部虚拟方向键 + 状态栏留空间
    var cy = h * 0.38 - TILE / 2;
    this.offX = cx - this.player.x * TILE;
    this.offY = cy - this.player.y * TILE;

    // 限制镜头不超出边界
    var mapPxW = MAP_W * TILE, mapPxH = MAP_H * TILE;
    var viewOffX = this.offX, viewOffY = this.offY;
    if (w >= mapPxW) viewOffX = (w - mapPxW) / 2;
    else { viewOffX = Math.min(0, Math.max(w - mapPxW, viewOffX)); }
    if (h >= mapPxH) viewOffY = (h - mapPxH) / 2;
    else {
      // 只限制顶部（不让地图露出下方空白），底部允许溢出
      viewOffY = Math.min(0, viewOffY);
      // 柔和限制：地图底部不要露出太多空白
      viewOffY = Math.max(viewOffY, h - mapPxH - TILE * 3);
    }
    this.offX = viewOffX;
    this.offY = viewOffY;

    // ===== 绘制瓦片（增强版） =====
    for (var y = 0; y < MAP_H; y++) {
      for (var x = 0; x < MAP_W; x++) {
        var t = this.mapData[y][x];
        var ts = tileStyle[t] || tileStyle.G;
        var sx = viewOffX + x * TILE;
        var sy = viewOffY + y * TILE;
        if (sx > w || sx + TILE < 0 || sy > h || sy + TILE < 0) continue;

        // 主色填充（加微弱随机色偏避免棋盘格感）
        ctx.fillStyle = ts.color;
        ctx.fillRect(sx, sy, TILE, TILE);

        // --- 微纹理：模拟地面颗粒感 ---
        var seed = (x * 7 + y * 13) % 100;
        ctx.fillStyle = ts.colorDark;
        for (var k = 0; k < 3; k++) {
          var gx = sx + ((seed + k * 31) % TILE);
          var gy = sy + ((seed + k * 17) % TILE);
          ctx.fillRect(gx, gy, Math.max(1, TILE * 0.06), Math.max(1, TILE * 0.06));
        }

        // --- 同类型瓦片色调微变（±6%亮度，打破均匀感）---
        var hueShift = ((seed % 13) - 6) * 0.01;
        ctx.fillStyle = 'rgba(255,255,255,' + (hueShift > 0 ? hueShift.toFixed(2) : '0') + ')';
        ctx.fillRect(sx, sy, TILE, TILE);
        if (hueShift < 0) {
          ctx.fillStyle = 'rgba(0,0,0,' + (-hueShift).toFixed(2) + ')';
          ctx.fillRect(sx, sy, TILE, TILE);
        }

        // --- 地形边缘高光（上/左边缘浅色=立体感）---
        ctx.fillStyle = ts.colorLight;
        ctx.fillRect(sx, sy, TILE, Math.max(1, TILE * 0.06));
        ctx.fillRect(sx, sy, Math.max(1, TILE * 0.06), TILE);

        // --- 边框 ---
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, TILE, TILE);

        // --- 瓦片专属装饰 ---
        this.drawTileDecor(ctx, t, ts, sx, sy, af);

        // --- 不可通行方块视觉标记（发光边框+角标） ---
        if (t === 'W' || t === 'C') {
          var bw = Math.max(2, TILE * 0.07);
          var isWall = t === 'W';
          // 外层实色边框
          ctx.save();
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = isWall ? '#e06030' : '#6098c8';
          ctx.lineWidth = bw;
          ctx.strokeRect(sx + bw * 0.5, sy + bw * 0.5, TILE - bw, TILE - bw);
          // 内层高亮细线
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = isWall ? '#ffa060' : '#a0d0f0';
          ctx.lineWidth = Math.max(1, bw * 0.5);
          ctx.strokeRect(sx + bw, sy + bw, TILE - bw * 2, TILE - bw * 2);
          ctx.restore();
          // 四角三角标记（禁止标识）
          var cs = Math.max(3, TILE * 0.12);
          ctx.fillStyle = isWall ? 'rgba(220,80,30,0.45)' : 'rgba(60,140,200,0.45)';
          ctx.fillRect(sx + 1, sy + 1, cs, cs);
          ctx.fillRect(sx + TILE - cs - 1, sy + 1, cs, cs);
          ctx.fillRect(sx + 1, sy + TILE - cs - 1, cs, cs);
          ctx.fillRect(sx + TILE - cs - 1, sy + TILE - cs - 1, cs, cs);
        }
      }
    }

    // ===== 阴影层：建筑/山崖投射阴影 =====
    for (var y2 = 0; y2 < MAP_H; y2++) {
      for (var x2 = 0; x2 < MAP_W; x2++) {
        var t2 = this.mapData[y2][x2];
        var isWall = t2 === 'W';
        var castsShadow = isWall || t2 === 'C' || t2 === 'H' || t2 === 'T' || t2 === 'D' || t2 === 'V';
        if (castsShadow) {
          var sx2 = viewOffX + x2 * TILE;
          var sy2 = viewOffY + y2 * TILE;
          if (sx2 > w || sx2 + TILE * 1.3 < 0 || sy2 > h || sy2 + TILE * 1.3 < 0) continue;
          // 寨墙阴影更深更远，拒马阴影较浅（低矮障碍）
          var isWall2 = t2 === 'W';
          var alpha = isWall2 ? 0.25 : (t2 === 'C' ? 0.15 : 0.12);
          var sw = TILE * (isWall2 ? 0.8 : 0.7);
          var sh = TILE * (isWall2 ? 0.3 : (t2 === 'C' ? 0.18 : 0.22));
          ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(2) + ')';
          ctx.fillRect(sx2 + TILE * 0.15, sy2 + TILE, sw, sh);
        }
      }
    }

    // 地图边界出入口箭头
    this.drawEdgeIndicators(ctx);

    // ===== 绘制角色（y序确保遮挡正确）=====
    var that = this;
    // 收集所有角色按y排序
    var actors = [];

    // 敌人
    this.enemies.forEach(function (e) {
      if (that.deadEnemies[e.id]) return;
      actors.push({ type: 'enemy', obj: e, y: e.y, x: e.x });
    });

    // NPC
    this.npcs.forEach(function (n) {
      actors.push({ type: 'npc', obj: n, y: n.y, x: n.x });
    });

    // 玩家
    actors.push({ type: 'player', y: this.player.y, x: this.player.x });

    // 同伴（跟随玩家，显示在玩家右侧一格，避免出界）
    if (this.player.companion) {
      var compX = this.player.x + 1;
      var compY = this.player.y;
      if (compX >= MAP_W) { compX = this.player.x - 1; }
      if (compX < 0) compX = 0;
      if (this.mapData[compY] && this.mapData[compY][compX] && this.mapData[compY][compX] !== 'W') {
        actors.push({ type: 'companion', y: compY, x: compX });
      }
    }

    // 按y排序（同y按x）
    actors.sort(function (a, b) {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    // 绘制
    actors.forEach(function (a) {
      if (a.type === 'enemy') that.drawEnemyOnMap(ctx, a.obj, af);
      else if (a.type === 'npc') that.drawNpcOnMap(ctx, a.obj, af);
      else if (a.type === 'companion') that.drawCompanionOnMap(ctx, a, af);
      else that.drawPlayer(ctx, af);
    });

    // ===== 大气渐晕效果（边缘暗角） =====
    var grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.5, w / 2, h / 2, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ===== 氛围粒子（萤火虫光点） =====
    this.drawAmbientParticles(ctx, w, h, af);
  },

  // 瓦片专属装饰（增强版）
  drawTileDecor(ctx, t, ts, sx, sy, af) {
    var s = TILE;
    if (t === 'F') {
      // 密林：层叠树丛 + 树干
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.1, sy + s * 0.12, s * 0.28, s * 0.26);
      ctx.fillRect(sx + s * 0.55, sy + s * 0.18, s * 0.24, s * 0.22);
      ctx.fillRect(sx + s * 0.32, sy + s * 0.52, s * 0.26, s * 0.26);
      // 树干
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(sx + s * 0.6, sy + s * 0.36, s * 0.08, s * 0.15);
      ctx.fillRect(sx + s * 0.38, sy + s * 0.65, s * 0.06, s * 0.12);
      // 树梢高光
      ctx.fillStyle = ts.colorLight;
      ctx.fillRect(sx + s * 0.14, sy + s * 0.12, s * 0.08, s * 0.06);
      ctx.fillRect(sx + s * 0.58, sy + s * 0.18, s * 0.07, s * 0.05);
    } else if (t === 'P') {
      // 驿道：路面纹理（石子+车轮印）
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(sx, sy + s * 0.4, s, Math.max(1, s * 0.06));
      ctx.fillRect(sx, sy + s * 0.55, s, Math.max(1, s * 0.03));
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.15, sy + s * 0.28, s * 0.06, s * 0.05);
      ctx.fillRect(sx + s * 0.42, sy + s * 0.62, s * 0.07, s * 0.05);
      ctx.fillRect(sx + s * 0.75, sy + s * 0.35, s * 0.05, s * 0.04);
    } else if (t === 'H') {
      // 民居：房子 + 烟囱
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.15, sy + s * 0.25, s * 0.7, s * 0.7);
      ctx.fillStyle = '#4a3020';
      ctx.beginPath();
      ctx.moveTo(sx + s * 0.05, sy + s * 0.3);
      ctx.lineTo(sx + s * 0.5, sy + s * 0.05);
      ctx.lineTo(sx + s * 0.95, sy + s * 0.3);
      ctx.closePath(); ctx.fill();
      // 烟囱
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(sx + s * 0.72, sy + s * 0.1, s * 0.08, s * 0.2);
      // 门
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(sx + s * 0.4, sy + s * 0.55, s * 0.2, s * 0.4);
      // 门环
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(sx + s * 0.47, sy + s * 0.7, s * 0.06, s * 0.06);
      // 窗
      ctx.fillStyle = '#ffd080';
      ctx.fillRect(sx + s * 0.22, sy + s * 0.4, s * 0.15, s * 0.15);
      ctx.fillRect(sx + s * 0.63, sy + s * 0.4, s * 0.15, s * 0.15);
      // 窗格
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx + s * 0.29, sy + s * 0.4, s * 0.01, s * 0.15);
      ctx.fillRect(sx + s * 0.22, sy + s * 0.47, s * 0.15, s * 0.01);
      ctx.fillRect(sx + s * 0.7, sy + s * 0.4, s * 0.01, s * 0.15);
    } else if (t === 'D') {
      // 岗哨：军帐 + 火把
      ctx.fillStyle = '#8a3020';
      ctx.beginPath();
      ctx.moveTo(sx + s * 0.2, sy + s * 0.7);
      ctx.lineTo(sx + s * 0.5, sy + s * 0.05);
      ctx.lineTo(sx + s * 0.8, sy + s * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a2010';
      ctx.fillRect(sx + s * 0.35, sy + s * 0.6, s * 0.3, s * 0.3);
      // 旗子+旗杆
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(sx + s * 0.48, sy + s * 0.0, s * 0.04, s * 0.38);
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(sx + s * 0.52, sy + s * 0.03, s * 0.18, s * 0.12);
      // 火把光晕
      var torchFlicker = 0.15 + Math.sin(af * 0.15 + sx * 0.1 + sy * 0.1) * 0.05;
      var tg = ctx.createRadialGradient(sx + s * 0.85, sy + s * 0.15, 0, sx + s * 0.85, sy + s * 0.15, s * 0.22);
      tg.addColorStop(0, 'rgba(255,180,40,' + torchFlicker.toFixed(2) + ')');
      tg.addColorStop(0.5, 'rgba(255,120,20,' + (torchFlicker * 0.3).toFixed(2) + ')');
      tg.addColorStop(1, 'rgba(255,80,10,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(sx + s * 0.63, sy, s * 0.37, s * 0.35);
    } else if (t === 'T') {
      // 哨塔：多层结构
      ctx.fillStyle = ts.colorLight;
      ctx.fillRect(sx + s * 0.15, sy + s * 0.2, s * 0.7, s * 0.55);
      // 飞檐
      ctx.fillStyle = '#3a2820';
      ctx.beginPath(); ctx.moveTo(sx + s * 0.08, sy + s * 0.28); ctx.lineTo(sx + s * 0.5, sy + s * 0.0); ctx.lineTo(sx + s * 0.92, sy + s * 0.28); ctx.closePath(); ctx.fill();
      // 第二层
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.2, sy + s * 0.28, s * 0.6, s * 0.15);
      ctx.fillRect(sx + s * 0.15, sy + s * 0.43, s * 0.7, s * 0.08);
      ctx.fillStyle = '#c8a040';
      ctx.font = Math.max(10, Math.floor(s * 0.35)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('哨', sx + s * 0.5, sy + s * 0.62);
    } else if (t === 'S') {
      // 库房：堆叠物资
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.08, sy + s * 0.55, s * 0.84, s * 0.12);
      // 麻袋堆
      ctx.fillStyle = '#e8c080';
      ctx.fillRect(sx + s * 0.12, sy + s * 0.38, s * 0.18, s * 0.17);
      ctx.fillStyle = '#d0a868';
      ctx.fillRect(sx + s * 0.38, sy + s * 0.42, s * 0.16, s * 0.13);
      // 木箱
      ctx.fillStyle = '#8a6a40';
      ctx.fillRect(sx + s * 0.65, sy + s * 0.35, s * 0.22, s * 0.2);
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(sx + s * 0.7, sy + s * 0.4, s * 0.12, s * 0.03);
    } else if (t === 'A') {
      // 校场：兵器架+靶子
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx + s * 0.45, sy + s * 0.22, s * 0.08, s * 0.58);
      // 长矛
      ctx.fillStyle = '#8a6040';
      ctx.fillRect(sx + s * 0.42, sy + s * 0.2, s * 0.03, s * 0.35);
      ctx.fillRect(sx + s * 0.5, sy + s * 0.18, s * 0.03, s * 0.38);
      // 靶子
      ctx.fillStyle = '#c8a060';
      ctx.fillRect(sx + s * 0.15, sy + s * 0.35, s * 0.22, s * 0.35);
      ctx.fillStyle = '#8a3020';
      ctx.fillRect(sx + s * 0.2, sy + s * 0.4, s * 0.12, s * 0.08);
    } else if (t === 'B') {
      // 营门：双柱+横梁
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(sx + s * 0.08, sy + s * 0.1, s * 0.08, s * 0.85);
      ctx.fillRect(sx + s * 0.84, sy + s * 0.1, s * 0.08, s * 0.85);
      ctx.fillStyle = '#5a3a28';
      ctx.fillRect(sx + s * 0.05, sy + s * 0.12, s * 0.9, s * 0.1);
      ctx.fillRect(sx + s * 0.3, sy + s * 0.45, s * 0.4, s * 0.06);
      ctx.fillStyle = '#c8a040';
      ctx.font = Math.max(10, Math.floor(s * 0.22)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('门', sx + s * 0.5, sy + s * 0.62);
    } else if (t === 'C') {
      // 拒马：粗大木刺交叉 + 横梁 + 水面光泽（不可通行）
      var ms = Math.max(2, s * 0.055);
      // 粗木刺（垂直）
      ctx.fillStyle = '#3a2010';
      for (var si = 0; si < 4; si++) {
        ctx.fillRect(sx + s * (0.06 + si * 0.22), sy + s * 0.08, ms, s * 0.65);
      }
      // 横梁（双层）
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(sx + s * 0.03, sy + s * 0.32, s * 0.94, ms);
      ctx.fillRect(sx + s * 0.03, sy + s * 0.6, s * 0.94, ms);
      // 木刺尖端（高亮）
      ctx.fillStyle = ts.colorLight;
      for (var ti = 0; ti < 4; ti++) {
        ctx.fillRect(sx + s * (0.06 + ti * 0.22) + ms * 0.2, sy + s * 0.08, ms * 0.6, ms * 0.5);
      }
      // 水面反光条纹
      ctx.fillStyle = 'rgba(180,210,230,0.12)';
      var wave = Math.sin((af + sx * 0.04 + sy * 0.03) * 0.35);
      ctx.fillRect(sx + s * 0.08, sy + s * 0.72 + wave, s * 0.35, Math.max(1, s * 0.04));
      ctx.fillRect(sx + s * 0.5, sy + s * 0.78 - wave, s * 0.3, Math.max(1, s * 0.03));
      // 水波弧线
      ctx.strokeStyle = 'rgba(150,200,220,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + s * 0.05, sy + s * 0.88);
      ctx.quadraticCurveTo(sx + s * 0.5, sy + s * 0.82 + wave * 2, sx + s * 0.95, sy + s * 0.88);
      ctx.stroke();
    } else if (t === 'V') {
      // 牢房：铁栏+锁链+血痕
      // 铁栏
      ctx.fillStyle = '#222';
      ctx.fillRect(sx, sy + s * 0.0, s, s * 0.1);
      ctx.fillRect(sx, sy + s * 0.9, s, s * 0.1);
      for (var b = 0; b < 4; b++) {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(sx + s * (0.15 + b * 0.23), sy + s * 0.05, s * 0.06, s * 0.88);
        // 铁栏高光
        ctx.fillStyle = 'rgba(80,80,80,0.5)';
        ctx.fillRect(sx + s * (0.16 + b * 0.23), sy + s * 0.05, s * 0.02, s * 0.88);
      }
      // 地面锁链
      ctx.strokeStyle = 'rgba(60,60,60,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + s * 0.3, sy + s * 0.75);
      ctx.quadraticCurveTo(sx + s * 0.5, sy + s * 0.7, sx + s * 0.7, sy + s * 0.8);
      ctx.stroke();
      // 血痕
      ctx.fillStyle = 'rgba(80,10,10,0.15)';
      ctx.fillRect(sx + s * 0.5, sy + s * 0.65, s * 0.2, s * 0.04);
      ctx.fillRect(sx + s * 0.2, sy + s * 0.78, s * 0.15, s * 0.03);
    } else if (t === 'R') {
      // 柴草堆：秸秆纹理
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.1, sy + s * 0.22, s * 0.3, Math.max(1, s * 0.03));
      ctx.fillRect(sx + s * 0.5, sy + s * 0.45, s * 0.25, Math.max(1, s * 0.03));
      ctx.fillRect(sx + s * 0.2, sy + s * 0.62, s * 0.35, Math.max(1, s * 0.03));
      // 稻草堆
      ctx.fillStyle = ts.colorLight;
      ctx.fillRect(sx + s * 0.6, sy + s * 0.15, s * 0.28, s * 0.2);
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.62, sy + s * 0.22, s * 0.12, s * 0.08);
    } else if (t === 'G') {
      // 夯土地：碎石+杂草
      ctx.fillStyle = ts.colorDark;
      ctx.fillRect(sx + s * 0.15, sy + s * 0.38, s * 0.08, s * 0.06);
      ctx.fillRect(sx + s * 0.68, sy + s * 0.55, s * 0.07, s * 0.05);
      ctx.fillRect(sx + s * 0.4, sy + s * 0.72, s * 0.06, s * 0.04);
      ctx.fillStyle = ts.colorLight;
      ctx.fillRect(sx + s * 0.3, sy + s * 0.18, s * 0.08, s * 0.04);
      ctx.fillRect(sx + s * 0.75, sy + s * 0.7, s * 0.06, s * 0.03);
      // 龟裂纹
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx + s * 0.5, sy + s * 0.25);
      ctx.lineTo(sx + s * 0.6, sy + s * 0.4);
      ctx.lineTo(sx + s * 0.45, sy + s * 0.55);
      ctx.stroke();
    } else if (t === 'W') {
      // 寨墙：明显砖缝纹理 + 铆钉（不可通行）
      var bw = Math.max(1.5, s * 0.025);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      // 横缝（3条）
      for (var row = 0; row < 3; row++) {
        ctx.fillRect(sx + s * 0.05, sy + s * (0.22 + row * 0.26), s * 0.9, bw);
      }
      // 竖缝（交错排列，模拟砌砖）
      for (var col = 0; col < 3; col++) {
        var rowOff = (col % 2) * s * 0.13;
        ctx.fillRect(sx + s * (0.22 + col * 0.28), sy + s * 0.05 + rowOff, bw, s * 0.2);
        ctx.fillRect(sx + s * (0.22 + col * 0.28), sy + s * 0.35 + rowOff, bw, s * 0.2);
        ctx.fillRect(sx + s * (0.22 + col * 0.28), sy + s * 0.65 + rowOff, bw, s * 0.2);
      }
      // 铆钉/铁环（墙面的金属固定件）
      ctx.fillStyle = 'rgba(120,100,70,0.35)';
      ctx.fillRect(sx + s * 0.1, sy + s * 0.08, s * 0.06, s * 0.06);
      ctx.fillRect(sx + s * 0.84, sy + s * 0.08, s * 0.06, s * 0.06);
      ctx.fillRect(sx + s * 0.1, sy + s * 0.86, s * 0.06, s * 0.06);
      ctx.fillRect(sx + s * 0.84, sy + s * 0.86, s * 0.06, s * 0.06);
      // 苔藓斑
      ctx.fillStyle = 'rgba(50,70,25,0.18)';
      ctx.fillRect(sx + s * 0.03, sy + s * 0.68, s * 0.12, s * 0.08);
      ctx.fillRect(sx + s * 0.85, sy + s * 0.38, s * 0.1, s * 0.07);
    }
  },

  // 氛围粒子（增强版：萤火虫+火花+尘埃）
  drawAmbientParticles(ctx, w, h, af) {
    // 萤火虫光点（增大数量+暖色调）
    var particles = 12;
    for (var i = 0; i < particles; i++) {
      var seed = i * 137.5;
      var px = ((seed * 13 + af * 0.3) % (w + 60)) - 30;
      var py = ((seed * 17 + Math.sin(af * 0.05 + i) * 80) % h + h) % h;
      var alpha = 0.12 + Math.sin(af * 0.08 + i * 1.7) * 0.08;
      var size = 1.5 + Math.sin(af * 0.1 + i) * 1;
      var r = ctx.createRadialGradient(px, py, 0, px, py, size * 4);
      r.addColorStop(0, 'rgba(255,220,140,' + alpha.toFixed(2) + ')');
      r.addColorStop(0.4, 'rgba(255,180,80,' + (alpha * 0.35).toFixed(2) + ')');
      r.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = r;
      ctx.fillRect(px - size * 4, py - size * 4, size * 8, size * 8);
    }

    // 火把火花（暖色上升粒子）
    for (var j = 0; j < 6; j++) {
      var sparkSeed = j * 211 + 42;
      var sx = ((sparkSeed * 19 + af * 0.6) % (w + 40)) - 20;
      var sy = h - (j * h / 6) * 0.3;
      var sparkAlpha = 0.06 + Math.abs(Math.sin(af * 0.12 + j * 2.1)) * 0.06;
      var sparkSize = 1 + Math.sin(af * 0.2 + j) * 0.5;
      var sr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sparkSize * 3);
      sr.addColorStop(0, 'rgba(255,200,60,' + sparkAlpha.toFixed(2) + ')');
      sr.addColorStop(1, 'rgba(255,120,20,0)');
      ctx.fillStyle = sr;
      ctx.fillRect(sx - sparkSize * 3, sy - sparkSize * 3, sparkSize * 6, sparkSize * 6);
    }

    // 飘浮尘埃（极淡的灰白点）
    for (var k = 0; k < 5; k++) {
      var dustSeed = k * 319 + 17;
      var dx = ((dustSeed * 23 + af * 0.25) % (w + 30)) - 15;
      var dy = ((dustSeed * 29 + af * 0.15) % h + h) % h;
      ctx.fillStyle = 'rgba(200,180,150,0.04)';
      ctx.fillRect(dx, dy, 3, 3);
    }
  },

  // ===== 地图像素角色绘制引擎 =====
  // 在 Canvas 指定位置绘制像素角色（30×36 像素网格）
  drawMapPixelChar(ctx, dx, dy, size, def, highlightColor) {
    var GW = 20, GH = 24;
    var ps = Math.floor(size / GW); // 每个"像素"的实际大小
    if (ps < 1) ps = 1;
    var totalW = GW * ps, totalH = GH * ps;
    var ox = dx + Math.floor((size - totalW) / 2);
    var oy = dy + Math.floor((size * 1.2 - totalH) / 2);

    var d = def || pxDef.hero;
    var P = function (x, y, c) { if (x < 0 || x >= GW || y < 0 || y >= GH) return; ctx.fillStyle = c; ctx.fillRect(ox + x * ps, oy + y * ps, ps, ps); };
    var B = function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(ox + x * ps, oy + y * ps, w * ps, h * ps); };

    // 椭圆辅助
    function oval(cx, cy, rw, rh, color) {
      for (var dy2 = -rh; dy2 <= rh; dy2++) {
        for (var dx2 = -rw; dx2 <= rw; dx2++) {
          if (dx2 * dx2 / (rw * rw) + dy2 * dy2 / (rh * rh) <= 1) P(cx + dx2, cy + dy2, color);
        }
      }
    }
    function ovalOut(cx, cy, rw, rh, fill, outline, ot) {
      ot = ot || 1;
      for (var dy2 = -rh - ot; dy2 <= rh + ot; dy2++) {
        for (var dx2 = -rw - ot; dx2 <= rw + ot; dx2++) {
          var dist = dx2 * dx2 / (rw * rw) + dy2 * dy2 / (rh * rh);
          if (dist <= 1 && dist > 0.6) P(cx + dx2, cy + dy2, outline);
          else if (dist <= 1) P(cx + dx2, cy + dy2, fill);
        }
      }
    }
    // 高亮覆盖（敌人类型着色）
    function tint(r, g, b, a) {
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (a || 0.18) + ')';
      ctx.fillRect(ox, oy, GW * ps, GH * ps);
    }

    // 1. 身体
    var sx = 10 - d.shoulderW, sw = d.shoulderW * 2;
    var bodyTop = 9;
    B(sx, bodyTop, sw, 1, d.robeL);
    B(sx - 1, bodyTop + 1, sw + 2, 1, d.robeL);
    for (var r = bodyTop + 2; r <= d.beltY - 1; r++) { B(sx, r, sw, 1, d.robeL); }
    var beltH = 2;
    B(sx - 1, d.beltY, sw + 2, beltH, d.belt);
    for (var r2 = d.beltY + beltH; r2 <= GH - 1; r2++) { B(sx, r2, sw, 1, d.robeL); }
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
    P(8, 4, d.eye); P(12, 4, d.eye); P(10, 7, d.skinD);

    // 3. 帽子（简化版）
    var t = d.hat, c = d.hatC, a = d.hatA || c;
    switch (t) {
      case 'topknot':
        B(7, 2, 6, 1, c); B(8, 1, 4, 1, c); B(9, 0, 2, 1, c);
        if (d.hatA) B(7, 1, 7, 1, d.hatA); B(7, 3, 2, 1, c); B(11, 3, 2, 1, c); break;
      case 'wide':
        B(2, 0, 16, 2, c); B(1, 2, 18, 2, a); B(1, 3, 18, 1, a); P(0, 2, c); P(19, 2, c); break;
      case 'official':
        B(6, 0, 8, 3, c); B(7, -1, 6, 1, c); B(2, 1, 4, 2, a); B(14, 1, 4, 2, a); break;
      case 'round':
        B(7, 1, 6, 2, c); B(6, 3, 8, 1, c); P(7, 0, c); P(12, 0, c); break;
      case 'cloth':
        B(6, 1, 8, 2, c); B(5, 3, 10, 1, c); P(6, 0, c); P(13, 0, c); break;
      case 'helm':
        B(5, 0, 10, 3, c); P(4, 1, c); P(15, 1, c);
        B(9, -1, 2, 2, a); P(9, -2, a); P(10, -2, a); break;
      case 'horn':
        B(5, 0, 10, 3, c); P(4, 1, c); P(15, 1, c); P(3, 0, c); P(16, 0, c); break;
      case 'giant':
        B(4, -1, 12, 4, c); B(3, 3, 14, 1, c);
        B(8, -2, 4, 3, a); P(9, -3, a); P(10, -3, a); B(3, 4, 14, 1, c); break;
      case 'band':
        B(6, 1, 8, 2, c); P(5, 3, c); P(14, 3, c);
        B(7, 0, 3, 1, '#2a1810'); B(11, 0, 3, 1, '#2a1810'); break;
      case 'leather':
        B(6, 1, 8, 2, c); B(7, 0, 6, 1, c); break;
    }

    // 4. 武器
    if (d.weapon !== 'none') {
      var wc = d.wC, ws = d.wSide, wsh = 10 + d.beltY || 14, wh = d.wH;
      var wx = (ws === 'r') ? 16 : 4;
      switch (d.weapon) {
        case 'sword': B(wx, wsh, 2, wh, wc); B(wx - 1, wsh, 4, 2, '#c8b860'); break;
        case 'spear': B(wx, wsh - 2, 1, wh + 2, wc); B(wx - 1, wsh - 4, 3, 2, wc); break;
        case 'knife': B(wx, wsh, 2, wh, wc); B(wx + 2, wsh + wh - 2, 3, 2, wc); break;
        case 'fan': B(wx, wsh, 3, 2, wc); B(wx, wsh + 2, 4, 1, wc); B(wx, wsh + 3, 3, 1, wc); break;
        case 'staff': B(wx, wsh - 3, 1, wh + 3, wc); break;
        case 'whisk': B(wx, wsh, 1, wh, wc); B(wx + 1, wsh - wh + 4, 2, wh - 1, '#aaa'); break;
        case 'bigBlade': B(wx, wsh - 2, 3, wh + 4, wc); B(wx - 1, wsh - 3, 5, 2, '#c8b860'); break;
      }
    }

    // 5. 胡子
    if (d.beard !== 'none') {
      var bc = d.bC, bh = d.bH || 6;
      switch (d.beard) {
        case 'goatee': for (var i = 0; i < bh; i++) { P(9, 8 + i, bc); P(11, 8 + i, bc); P(10, 8 + i, bc); } break;
        case 'long': for (var i = 0; i < bh; i++) { B(9, 8 + i, 2, 1, bc); } break;
        case 'three': for (var i = 0; i < bh; i++) { P(8, 8 + i, bc); P(10, 8 + i, bc); P(12, 8 + i, bc); } break;
      }
    }

    // 6. 高亮着色
    if (highlightColor) tint(highlightColor[0], highlightColor[1], highlightColor[2]);
  },

  // ===== 角色绘制 =====
  drawPlayer(ctx, af) {
    var px = this.offX + this.player.x * TILE;
    var py = this.offY + this.player.y * TILE;
    var s = TILE * 0.82;

    var bobY = this.isMoving ? Math.sin(af * 0.8) * s * 0.03 : Math.sin(af * 0.04) * s * 0.01;
    py += bobY;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.save();
    ctx.translate(px + TILE / 2, py + s * 0.88);
    ctx.scale(1, 0.2);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 像素角色
    this.drawMapPixelChar(ctx, px, py, s, pxDef.hero);
  },

  drawCompanionOnMap(ctx, a, af) {
    var s = TILE * 0.55;
    var cx = this.offX + a.x * TILE;
    var cy = this.offY + a.y * TILE;
    var bobY = Math.sin(af * 0.05 + a.x * 0.3) * s * 0.02;
    cy += bobY;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.save();
    ctx.translate(cx + TILE / 2, cy + s * 0.85);
    ctx.scale(1, 0.2);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    this.drawMapPixelChar(ctx, cx, cy, s, pxDef.soldier);

    // 名字标签
    ctx.fillStyle = '#80c060';
    ctx.font = Math.max(8, Math.floor(s * 0.28)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('义兵', cx + TILE / 2, cy + s * 0.72);
  },

  drawEnemyOnMap(ctx, e, af) {
    var s = TILE * 0.7;
    var ex = this.offX + e.x * TILE;
    var ey = this.offY + e.y * TILE;
    var bobY = Math.sin(af * 0.06 + e.x * 0.3) * s * 0.03;
    ey += bobY;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.save();
    ctx.translate(ex + TILE / 2, ey + s * 0.85);
    ctx.scale(1, 0.18);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 像素角色 — 根据敌人类型选择
    var def = pxDef[e.type] || pxDef.bandit;
    // 根据敌人颜色微调（覆盖def中的部分颜色）
    var customDef = JSON.parse(JSON.stringify(def));
    if (e.color) {
      customDef.robe = e.color;
      customDef.robeL = e.color;
    }
    this.drawMapPixelChar(ctx, ex, ey, s, customDef);

    // 难度星级
    var stars = e.hp >= 100 ? '★★★' : e.hp >= 60 ? '★★' : '★';
    var starColor = e.hp >= 100 ? '#ff4040' : e.hp >= 60 ? '#ffaa20' : '#c0c0c0';
    var starAlpha = 0.6 + Math.sin(af * 0.05) * 0.2;
    ctx.fillStyle = starColor;
    ctx.globalAlpha = starAlpha;
    ctx.font = Math.floor(s * 0.2) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(stars, ex + TILE / 2, ey + s * 0.2 - TILE * 0.05);
    ctx.globalAlpha = 1;
  },

  drawNpcOnMap(ctx, n, af) {
    var s = TILE * 0.7;
    var nx = this.offX + n.x * TILE;
    var ny = this.offY + n.y * TILE;
    var bobY = Math.sin(af * 0.05 + n.x * 0.4 + n.y * 0.3) * s * 0.02;
    ny += bobY;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.save();
    ctx.translate(nx + TILE / 2, ny + s * 0.85);
    ctx.scale(1, 0.18);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 像素角色 — NPC类型映射
    var npcType = n.type || 'bandit';
    var baseDef = pxDef[npcType] || pxDef.storyteller;
    var customDef = JSON.parse(JSON.stringify(baseDef));
    var c = n.color || {};
    if (c.cloth) { customDef.robe = c.cloth; customDef.robeL = c.cloth; }
    if (c.skin) { customDef.skin = c.skin; }
    if (c.hair) { customDef.hair = c.hair; }
    this.drawMapPixelChar(ctx, nx, ny, s, customDef);

    // 名字标签
    ctx.font = Math.floor(s * 0.16) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    var metrics = ctx.measureText(n.name);
    var nameW = metrics ? metrics.width : n.name.length * (s * 0.15);
    var labelW = Math.max(14, nameW + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(nx + TILE / 2 - labelW / 2, ny + s * 0.15 - TILE * 0.06, labelW, Math.floor(s * 0.2));
    ctx.fillStyle = '#ffd880';
    ctx.fillText(n.name, nx + TILE / 2, ny + s * 0.28);

    // 头顶标记点
    ctx.fillStyle = '#e8a850';
    ctx.font = (s * 0.35) + 'px sans-serif';
    ctx.fillText('●', nx + TILE / 2, ny + s * 0.08);
  },

  // 地图边缘出入口提示（仅在最边缘中心显示一个 subtle 箭头，避免整排抢眼）
  drawEdgeIndicators(ctx) {
    var conns = allMaps[this.currentMap].connections;
    if (!conns) return;
    var w = this.cw, h = this.ch;

    function drawArrow(cx, cy, arrow) {
      // 只绘制一个小的半透明箭头，不填充整格，不显示文字
      var r = TILE * 0.18;
      if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) return;

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(212,168,83,0.6)';
      ctx.font = Math.floor(r * 1.2) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(arrow, cx, cy);
      ctx.restore();
    }

    // 仅在边缘中心显示一个箭头，而不是整排
    if (conns.north) {
      drawArrow(this.offX + MAP_W * TILE / 2, this.offY + TILE * 0.5, '▲');
    }
    if (conns.south) {
      drawArrow(this.offX + MAP_W * TILE / 2, this.offY + (MAP_H - 0.5) * TILE, '▼');
    }
    if (conns.west) {
      drawArrow(this.offX + TILE * 0.5, this.offY + MAP_H * TILE / 2, '◄');
    }
    if (conns.east) {
      drawArrow(this.offX + (MAP_W - 0.5) * TILE, this.offY + MAP_H * TILE / 2, '►');
    }
  },

  // ==================== 移动系统 (DPad 虚拟方向键 / 点击屏幕) ====================
  onDirDown(e) {
    if (!this.gameStarted || this.inBattle) return;
    if (this.data.dialog.show) return;
    var dir = e.currentTarget.dataset.dir;
    this.moveDir = dir;
    this._dirJustTouched = true; // 标记已触发 touch，防止 tap 重复移动
    this.doMove();
    if (this.moveTimer) clearInterval(this.moveTimer);
    var that = this;
    this.moveTimer = setInterval(function () { that.doMove(); }, this.moveThrottle);
  },

  onDirUp() {
    this.moveDir = null;
    if (this.moveTimer) { clearInterval(this.moveTimer); this.moveTimer = null; }
    var that = this;
    setTimeout(function () { that._dirJustTouched = false; }, 400);
  },

  onDirTap(e) {
    if (!this.gameStarted || this.inBattle) return;
    if (this.data.dialog.show) return;
    // 触屏端 touchstart 已触发连续/单步移动，忽略随后产生的 tap，避免重复移动
    if (this._dirJustTouched) return;
    var dir = e.currentTarget.dataset.dir;
    this.moveDir = dir;
    this.doMove();
    this.moveDir = null;
  },


  onInteractBtn() {
    if (!this.gameStarted || this.inBattle) return;
    if (this.data.dialog.show) return;
    for (var i = 0; i < this.npcs.length; i++) {
      var n = this.npcs[i];
      if (Math.abs(this.player.x - n.x) <= 1 && Math.abs(this.player.y - n.y) <= 1) {
        this.interactNpc(i);
        return;
      }
    }
    this.showHint('附近无人可对话');
  },

  onCanvasTap(e) {
    if (!this.gameStarted || this.inBattle || this.data.dialog.show || this.data.bag.show || this.data.battle.show || this.data.toast.show) return;
    // 点击地图向点击方向移动一格（玩家始终在屏幕中心）
    var x = e.detail.x, y = e.detail.y;
    var cx = this.cw / 2, cy = this.ch / 2;
    var dx = x - cx, dy = y - cy;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.execMove(dx > 0 ? 1 : -1, 0);
    } else {
      this.execMove(0, dy > 0 ? 1 : -1);
    }
  },


  doMove() {
    if (!this.moveDir || this.inBattle) return;
    var dx = 0, dy = 0;
    switch (this.moveDir) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }
    this.execMove(dx, dy);
  },

  execMove(dx, dy) {
    var nx = this.player.x + dx;
    var ny = this.player.y + dy;

    // 地图边界=切换地图
    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) {
      var mc = allMaps[this.currentMap].connections;
      if (ny < 0 && mc.north) this.switchMap(mc.north, this.player.x, allMaps[mc.north].data.length - 1);
      else if (ny >= MAP_H && mc.south) {
        // 辕门特殊处理：根据x坐标分流到兵营或武库
        if (mc.south_west && mc.south_east && this.player.x < 10) {
          this.switchMap(mc.south_west, this.player.x, 0);
        } else if (mc.south_west && mc.south_east && this.player.x >= 10) {
          this.switchMap(mc.south_east, this.player.x, 0);
        } else {
          this.switchMap(mc.south, this.player.x, 0);
        }
      }
      else if (nx < 0 && mc.west) this.switchMap(mc.west, allMaps[mc.west].data[0].length - 1, this.player.y);
      else if (nx >= MAP_W && mc.east) this.switchMap(mc.east, 0, this.player.y);
      return;
    }

    // 不可通行
    var t = this.mapData[ny][nx];
    if (t === 'W' || t === 'C') return;

    // 检查敌人（包括相邻格子，实现包夹效果）
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.x === nx && e.y === ny && !this.deadEnemies[e.id]) {
        // 扫描相邻格子的其他敌人，一起进入战斗
        var battleIndices = [i];
        for (var j = 0; j < this.enemies.length; j++) {
          if (j === i) continue;
          var ej = this.enemies[j];
          if (!this.deadEnemies[ej.id] && Math.abs(ej.x - nx) <= 1 && Math.abs(ej.y - ny) <= 1) {
            battleIndices.push(j);
          }
        }
        this.startBattle(battleIndices);
        return;
      }
    }

    this.player.x = nx;
    this.player.y = ny;
    this.markMoving();
    this.render();
    this.updateLocName();
    this.updateStats();
    this.checkNpcProximity();
  },

  // ==================== PC 键盘控制 (WASD / 方向键) ====================
  keyToDir(k) {
    if (!k) return null;
    k = String(k).toLowerCase();
    if (k === 'w' || k === 'arrowup') return 'up';
    if (k === 's' || k === 'arrowdown') return 'down';
    if (k === 'a' || k === 'arrowleft') return 'left';
    if (k === 'd' || k === 'arrowright') return 'right';
    return null;
  },

  onKeyDown(e) {
    if (!this.gameStarted) return;
    var key = e.key || e.code;
    var dir = this.keyToDir(key);
    if (dir) {
      // 禁止在面板打开时移动（dialog / bag / settings / quest / prologue / toast / battle）
      if (this.data.dialog.show || this.data.bag.show || this.data.settings.show || this.data.questPanel.show || this.data.prologue.show || this.data.toast.show || this.data.battle.show) return;
      this.keyStates[dir] = true;
      this.lastKeyDir = dir;
      this.startKeyMove();
    } else {
      this.onKeyAction(key);
    }
  },

  onKeyUp(e) {
    var key = e.key || e.code;
    var dir = this.keyToDir(key);
    if (!dir) return;
    this.keyStates[dir] = false;
    if (this.lastKeyDir === dir) {
      // 寻找仍按下的方向键
      this.lastKeyDir = null;
      var dirs = ['up', 'down', 'left', 'right'];
      for (var i = 0; i < dirs.length; i++) {
        if (this.keyStates[dirs[i]]) { this.lastKeyDir = dirs[i]; break; }
      }
    }
    if (!this.lastKeyDir) this.stopKeyMove();
  },

  startKeyMove() {
    if (this.keyMoveTimer) return;
    var that = this;
    this.keyMoveTimer = setInterval(function () {
      if (!that.lastKeyDir || that.inBattle) return;
      if (that.data.dialog.show || that.data.bag.show || that.data.settings.show || that.data.questPanel.show || that.data.prologue.show || that.data.toast.show || that.data.battle.show) return;
      var dx = 0, dy = 0;
      switch (that.lastKeyDir) {
        case 'up': dy = -1; break;
        case 'down': dy = 1; break;
        case 'left': dx = -1; break;
        case 'right': dx = 1; break;
      }
      that.execMove(dx, dy);
    }, this.moveThrottle);
  },

  stopKeyMove() {
    if (this.keyMoveTimer) {
      clearInterval(this.keyMoveTimer);
      this.keyMoveTimer = null;
    }
  },

  onKeyAction(key) {
    if (!key) return;
    key = String(key).toLowerCase();
    // Enter / Space：与附近 NPC 交互，或在对话中继续
    if (key === 'enter' || key === ' ') {
      if (this.data.dialog.show) { this.onDialogChoice({ currentTarget: { dataset: { idx: 0 } } }); return; }
      if (this.data.prologue.show) { this.skipPrologueTyping(); return; }
      if (this.gameStarted && !this.inBattle) { this.onInteractBtn(); }
      return;
    }
    // Esc：关闭面板/对话
    if (key === 'escape') {
      this.closeOverlay();
      return;
    }
    // I：行囊
    if (key === 'i') {
      if (this.gameStarted && !this.inBattle && !this.data.bag.show) { this.onInventory(); }
      return;
    }
    // Q：任务
    if (key === 'q') {
      if (this.gameStarted && !this.inBattle && !this.data.questPanel.show) { this.onQuest(); }
      return;
    }
    // M：打坐
    if (key === 'm') {
      if (this.gameStarted && !this.inBattle) { this.onMeditate(); }
      return;
    }
  },

  // ==================== NPC 交互 ====================
  checkNpcProximity() {
    for (var i = 0; i < this.npcs.length; i++) {
      var n = this.npcs[i];
      if (Math.abs(this.player.x - n.x) <= 1 && Math.abs(this.player.y - n.y) <= 1) {
        if (this._lastProximityNpc !== n.id) {
          this._lastProximityNpc = n.id;
          this.showHint('💬 靠近' + n.name + '，点击对话');
        }
        return;
      }
    }
    this._lastProximityNpc = '';
  },

  interactNpc(idx) {
    this.curNpc = idx;
    this.curNpcDi = 0;
    this.showDialog(0);
  },

  // ==================== 对话系统 ====================
  showDialog(di) {
    var n = this.npcs[this.curNpc];
    var d = n.dialogs[di];
    this.curNpcDi = di;

    // 跳过已完成的任务对话
    if (d.q && this.player.quests[d.q] === true && this.quests[d.q].done && this.quests[d.q].rewardClaimed) {
      // 跳到下一个
      var next = this.findNextDialog(this.curNpc, di);
      if (next >= 0) { this.showDialog(next); return; }
      else { this.closeDialog(); return; }
    }

    var choices = [];
    var speaker = n.name;
    var text = d.t || d.s || '';

    if (d.q) {
      if (this.player.quests[d.q] === true && this.quests[d.q].done && !this.quests[d.q].rewardClaimed) {
        text = d.t2 || d.t;
        choices = ['继续'];
        this._dialogPhase = 'next2';
      } else if (!this.player.quests[d.q]) {
        text = d.s + '\n' + d.t;
        choices = ['义不容辞', '容我再想想'];
        this._dialogPhase = 'accept';
      } else {
        choices = ['告辞'];
      }
    } else if (d.buy) {
      if (this.player.gold < 10) {
        text = '五铢钱不够！\n(需要10枚五铢钱)';
        choices = ['告辞'];
      } else {
        choices = ['购买(10枚五铢钱)', '告辞'];
      }
      this._dialogPhase = 'buy';
    } else if (d.heal) {
      text = d.s + '\n' + (d.t || '');
      choices = ['接受治疗(15枚五铢钱)', '告辞'];
      this._dialogPhase = 'heal';
    } else if (d.buff || d.t2) {
      choices = ['继续'];
      this._dialogPhase = 'next2';
    } else {
      choices = ['继续'];
      var _next = this.findNextDialog(this.curNpc, di);
      if (_next >= 0) choices[0] = '继续';
      else choices = ['告辞'];
    }

    this.setData({
      showOverlay: true,
      'dialog.show': true,
      'dialog.speaker': speaker,
      'dialog.text': text,
      'dialog.choices': choices
    });
    // 渲染 NPC 立绘（映射非标准 ID 到像素画定义）
    var idMap = { madman: 'storyteller', oldprisoner: 'hermit', bribeguard: 'master', foreman: 'captain',
      medic: 'doctor', cook: 'doctor', disgruntled: 'escort', quartermaster: 'master',
      veteran: 'hermit', warehouseman: 'master', craftsman: 'doctor', runner: 'hermit',
      guardcaptain: 'guard', vicecommander: 'guard', escort: 'captain' };
    this._renderDlgPortrait(idMap[n.id] || n.id);
  },
  _renderDlgPortrait(charId) {
    var that = this;
    setTimeout(function () {
      var query = wx.createSelectorQuery();
      query.select('#dlg-canvas').fields({ node: true, size: true }).exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          // Canvas 节点未就绪，用像素画降级
          return;
        }
        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        var dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = 80 * dpr;
        canvas.height = 96 * dpr;
        ctx.scale(dpr, dpr);
        renderPortrait(canvas, charId, 80, 96);
      });
    }, 80);
  },

  onDialogChoice(e) {
    var idx = e.currentTarget.dataset.idx;
    var phase = this._dialogPhase;
    var that = this;

    if (phase === 'close') {
      this.closeDialog();
      return;
    }

    if (phase === 'accept') {
      var d = this.npcs[this.curNpc].dialogs[this.curNpcDi];
      if (idx === 0) this.acceptQuest(d.q);
      else this.closeDialog();
      return;
    }

    if (phase === 'next2') {
      this.nextDialog2();
      return;
    }

    if (phase === 'buy') {
      if (idx === 0) this.buyItem();
      else this.closeDialog();
      return;
    }

    if (phase === 'heal') {
      if (idx === 0) {
        if (this.player.gold < 15) { this.showHint('💰 需要15枚五铢钱'); this.closeDialog(); return; }
        this.player.gold -= 15;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
        this.player.mp = Math.min(this.player.maxMp, this.player.mp + 20);
        audio.playSfx('heal');
        this.showHint('🧘 治疗完成，恢复50气血和20内力');
        this.updateStats();
      }
      this.closeDialog();
      return;
    }

    // 普通继续
    var next = this.findNextDialog(this.curNpc, this.curNpcDi);
    if (next >= 0) this.showDialog(next);
    else this.closeDialog();
  },

  findNextDialog(npcIdx, curDi) {
    var npc = this.npcs[npcIdx];
    if (!npc || !npc.dialogs) return -1;
    var dialogs = npc.dialogs;
    var next = curDi + 1;
    while (next < dialogs.length) {
      var d = dialogs[next];
      if (d.q && this.player.quests[d.q] === true && this.quests[d.q].done && this.quests[d.q].rewardClaimed) {
        next++; continue;
      }
      return next;
    }
    return -1;
  },

  acceptQuest(q) {
    this.player.quests[q] = true;
    this.quests[q].progress = this.killCounts[q === 'quest_1' ? 'bandit' : q === 'quest_2' ? 'bully' : 'boss'] || 0;
    if (this.quests[q].progress >= this.quests[q].target) {
      this.quests[q].done = true;
    }
    var qd = this.quests[q];
    this.closeDialog();
    this.showToast('📜 任务接受', '【' + qd.name + '】\n' + qd.desc + '\n进度：' + qd.progress + '/' + qd.target);
  },

  nextDialog2() {
    var d = this.npcs[this.curNpc].dialogs[this.curNpcDi];
    var that = this;

    if (d.buff) {
      if (d.buff.mp) { that.player.maxMp += d.buff.mp; that.player.mp = Math.min(that.player.mp + d.buff.mp, that.player.maxMp); }
      if (d.buff.hp) { that.player.maxHp += d.buff.hp; that.player.hp = Math.min(that.player.hp + d.buff.hp, that.player.maxHp); }
    }

    if (d.companion) {
      var tpl = COMPANION_TEMPLATES[d.companion];
      if (tpl) {
        this.player.companion = JSON.parse(JSON.stringify(tpl));
        this.showHint('🤝 ' + tpl.name + '加入队伍！');
      }
    }

    if (d.q && that.quests[d.q].done && d.t2 && !that.quests[d.q].rewardClaimed) {
      // 领取报酬
      var qd = that.quests[d.q];
      if (qd.rewardClaimed) { that.closeDialog(); return; }
      qd.rewardClaimed = true;
      that.player.gold += qd.rewardGold;
      that.player.exp += qd.rewardExp;
      var lvCount = that.checkLevelUp();
      var txt = '【' + qd.name + '】完成！\n\n💰 五铢钱 +' + qd.rewardGold + '\n✨ 修为 +' + qd.rewardExp;
      if (lvCount > 0) txt += '\n\n🎉 威名远扬！等级提升至' + that.player.level + '级！';

      // 最终任务(quest_3)完成后弹出胜利
      if (d.q === 'quest_3') {
        txt += '\n\n🏴 幽州督军已死，辕门大开！\n你带着难友们冲出大营，消失在夜色中……';
      }
      that.showHint(txt);
      // 完成任务后自动存档
      that.autoSave();
    }

    that.closeDialog();
    that.updateStats();
  },

  buyItem() {
    if (this.player.gold < 10) { this.showHint('五铢钱不够！'); this.closeDialog(); return; }
    this.player.gold -= 10;
    this.addItem('potion', 1);
    audio.playSfx('coin');
    this.showHint('🧵 购得破布绷带一卷！');
    this.updateStats();
    this.closeDialog();
  },

  closeDialog() {
    this.setData({ showOverlay: false, 'dialog.show': false });
    this._dialogPhase = '';
  },

  closeOverlay() {
    if (this.inBattle) return; // 战斗中不允许点击遮罩关闭
    if (this.data.settings && this.data.settings.show) { this.onCloseSettings(); return; }
    if (this.data.questPanel && this.data.questPanel.show) { this.onCloseQuest(); return; }
    this.closeDialog();
    this.setData({ showOverlay: false, 'toast.show': false });
    this.onCloseBag();
  },

  // ==================== 战斗系统 ====================
  // ei 可以是单个索引，也可以是索引数组
  startBattle(ei) {
    var idxList = Array.isArray(ei) ? ei : [ei];
    var that = this;
    this.battleEnemies = [];
    this.targetIdx = 0;
    this.inBattle = true;
    // 立即把大地图 canvas 刷黑，防止原生 canvas 浮在战斗面板之上
    if (this.ctx && this.cw > 0 && this.ch > 0) {
      this.ctx.fillStyle = '#0a0303';
      this.ctx.fillRect(0, 0, this.cw, this.ch);
    }
    this.defending = false;
    this._battleEnding = false;
    this._battleGen = (this._battleGen || 0) + 1; // 战斗代数，防止旧定时器干扰
    this.moveDir = null;
    if (this.moveTimer) { clearInterval(this.moveTimer); this.moveTimer = null; }

    // 构建战斗敌人列表
    for (var i = 0; i < idxList.length; i++) {
      var e = this.enemies[idxList[i]];
      if (e && !this.deadEnemies[e.id]) {
        this.battleEnemies.push({ ref: e, hp: e.hp, maxHp: e.hp, hit: false, dead: false });
      }
    }
    // 至少保证一个敌人
    if (this.battleEnemies.length === 0) {
      this.inBattle = false;
      return;
    }

    // 查找快捷道具
    var quickItem = null;
    var items = this.player.items || [];
    for (var j = 0; j < items.length; j++) {
      var def = ITEM_DB[items[j].id];
      if (def && (def.type === 'heal' || def.type === 'elixir' || def.type === 'mp')) {
        quickItem = { id: def.id, name: def.name, icon: def.icon, count: items[j].count };
        break;
      }
    }

    // 同伴状态
    this.companion = this.player.companion ? JSON.parse(JSON.stringify(this.player.companion)) : null;

    // 构建 setData 用的敌人视图数据
    var enemyViews = [];
    for (var k = 0; k < this.battleEnemies.length; k++) {
      var be = this.battleEnemies[k];
      enemyViews.push({ name: be.ref.name, hp: be.hp, maxHp: be.maxHp, hpPercent: 100, hit: false, dead: false, type: be.ref.type });
    }

    var names = this.battleEnemies.map(function (be) { return be.ref.name; }).join('、');

    this.setData({
      showOverlay: false, // 战斗全屏不需要遮罩
      'battle.show': true,
      'battle.enemies': enemyViews,
      'battle.targetIdx': 0,
      'battle.playerHpPercent': Math.max(0, Math.min(100, Math.round(this.player.hp / this.player.maxHp * 100))),
      'battle.playerMpPercent': Math.max(0, Math.min(100, Math.round(this.player.mp / this.player.maxMp * 100))),
      'battle.playerHit': false,
      'battle.critShow': false,
      'battle.quickItem': quickItem,
      'battle.companion': this.companion,
      'battle.companionHpPercent': this.companion ? 100 : 0,
      'battle.log': this.battleEnemies.length > 1
        ? '⚔️ 敌军合围！' + names + '挡在了你的面前！'
        : '⚔️ 狭路相逢！' + names + '挡在了你的面前！',
      'battle.log2': '',
      'battle.dmgShow': false,
      'battle.dmgNum': '',
      'battle.dmgDir': ''
    }, function () {
      that.renderBattleChars();
      // 延迟检测同伴立绘
      if (that.companion) {
        setTimeout(function () { that.renderCompanionChar(); }, 300);
      }
    });
  },

  // 全屏渲染所有战斗立绘
  renderBattleChars() {
    var that = this;
    var dpr = wx.getSystemInfoSync().pixelRatio;

    // 玩家立绘
    var pq = wx.createSelectorQuery();
    pq.select('#battle-player-canvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0]) return;
      var canvas = res[0].node;
      var ctx = canvas.getContext('2d');
      canvas.width = 72 * dpr; canvas.height = 86 * dpr;
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
      renderPortrait(canvas, 'hero', 72, 86);
    });

    // 敌人立绘（每个敌人一个 canvas）
    for (var i = 0; i < this.battleEnemies.length; i++) {
      (function (idx) {
        var be = that.battleEnemies[idx];
        var enemyCharId = (be.ref && be.ref.type) || 'bandit';
        var eq = wx.createSelectorQuery();
        eq.select('#battle-enemy-canvas-' + idx).fields({ node: true, size: true }).exec(function (res2) {
          if (!res2 || !res2[0]) return;
          var canvas2 = res2[0].node;
          var ctx2 = canvas2.getContext('2d');
          canvas2.width = 56 * dpr; canvas2.height = 66 * dpr;
          ctx2.scale(dpr, dpr);
          ctx2.imageSmoothingEnabled = false;
          renderPortrait(canvas2, enemyCharId, 56, 66);
        });
      })(i);
    }
  },

  // 渲染同伴立绘
  renderCompanionChar() {
    var that = this;
    var dpr = wx.getSystemInfoSync().pixelRatio;
    var cq = wx.createSelectorQuery();
    cq.select('#battle-companion-canvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0]) return;
      var canvas = res[0].node;
      var ctx = canvas.getContext('2d');
      canvas.width = 52 * dpr; canvas.height = 62 * dpr;
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
      renderPortrait(canvas, 'soldier', 52, 62);
    });
  },

  onBattleAction(e) {
    if (!this.inBattle || this._battleEnding) return;
    var act = e.currentTarget.dataset.act;
    this.battleAction(act);
  },

  // 切换攻击目标
  onSelectEnemyTarget(e) {
    if (!this.inBattle) return;
    var idx = parseInt(e.currentTarget.dataset.idx);
    if (isNaN(idx) || idx < 0 || idx >= this.battleEnemies.length) return;
    if (this.battleEnemies[idx].dead) return;
    this.targetIdx = idx;
    this.setData({ 'battle.targetIdx': idx });
  },

  // 获取当前目标敌人
  _getTarget() {
    // 如果当前目标已死，自动切换到下一个活着的敌人
    if (this.battleEnemies[this.targetIdx] && this.battleEnemies[this.targetIdx].dead) {
      for (var i = 0; i < this.battleEnemies.length; i++) {
        if (!this.battleEnemies[i].dead) {
          this.targetIdx = i;
          this.setData({ 'battle.targetIdx': i });
          break;
        }
      }
    }
    return this.battleEnemies[this.targetIdx] || null;
  },

  // 检查是否所有敌人已死
  _allEnemiesDead() {
    for (var i = 0; i < this.battleEnemies.length; i++) {
      if (!this.battleEnemies[i].dead) return false;
    }
    return true;
  },

  // 获取活着的敌人数量
  _aliveEnemyCount() {
    var cnt = 0;
    for (var i = 0; i < this.battleEnemies.length; i++) {
      if (!this.battleEnemies[i].dead) cnt++;
    }
    return cnt;
  },

  // 同步battle.enemies视图数据
  _syncEnemyViews() {
    var views = [];
    for (var k = 0; k < this.battleEnemies.length; k++) {
      var be = this.battleEnemies[k];
      views.push({
        name: be.ref.name, hp: Math.max(0, be.hp), maxHp: be.maxHp,
        hpPercent: Math.max(0, Math.min(100, Math.round(be.hp / be.maxHp * 100))),
        hit: be.hit, dead: be.dead, type: be.ref.type
      });
    }
    this.setData({ 'battle.enemies': views });
  },

  battleAction(act) {
    if (!this.inBattle) return;
    // 战斗结算中只允许道具和逃脱，阻止重复攻击
    if (this._battleEnding && act !== 'item' && act !== 'flee') return;
    var target = this._getTarget();
    if (!target) { this._battleEnding = true; this.endBattle(true); return; }
    var that = this;
    var prevLog = this.data.battle.log || '';

    if (act === 'flee') {
      // 多敌人时逃脱更难
      var fleeChance = Math.max(0.15, 0.65 - this.battleEnemies.length * 0.2);
      if (Math.random() < fleeChance) {
        that.setData({ 'battle.log2': prevLog, 'battle.log': '💨 轻功施展，脱离了战斗！' });
        that.endBattle(false);
      } else {
        that.setData({ 'battle.log2': prevLog, 'battle.log': '❌ 敌军重重包围，逃脱失败！' });
        setTimeout(function () { that.enemyTurn(); }, 500);
      }
      return;
    }

    if (act === 'defend') {
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + 5);
      this.defending = true;
      this.updateStats();
      this.updateBattleStats();
      this.setData({ 'battle.log2': prevLog, 'battle.log': '🛡️ 凝神防御！本回合所受伤害减半，内力+5' });
      setTimeout(function () { that.enemyTurn(); }, 350);
      return;
    }

    if (act === 'atk') {
      var rng = Math.floor(Math.random() * 7);
      var crit = rng >= 5 ? 2 : 1;
      var dmg = Math.max(1, (this.player.atk - target.ref.def) * crit + Math.floor(Math.random() * 5));
      target.hp -= dmg;
      target.hit = true;
      var log = '⚔️ 攻击' + target.ref.name + '，造成 ' + dmg + ' 点伤害！' + (crit > 1 ? ' 【会心一击！】' : '');
      audio.playSfx(crit > 1 ? 'crit' : 'atk');
      this._syncEnemyViews();
      this.setData({ 'battle.log2': prevLog, 'battle.log': log });
      this.showDmgNum('enemy', '-' + dmg, crit > 1);
      if (crit > 1) { this.showCrit('会心一击！'); this.showCritEffect(); }
      setTimeout(function () { target.hit = false; that._syncEnemyViews(); }, 250);
    }

    if (act === 'skill') {
      if (this.player.mp < 10) {
        this.setData({ 'battle.log': '💠 内力不足！需要10点内力' });
        return;
      }
      this.player.mp -= 10;
      var dmg = Math.max(3, (this.player.atk * 2 - target.ref.def) + Math.floor(Math.random() * 8));
      target.hp -= dmg;
      target.hit = true;
      audio.playSfx('skill');
      this._syncEnemyViews();
      this.setData({ 'battle.log2': prevLog, 'battle.log': '💥 霸王枪！对' + target.ref.name + '造成 ' + dmg + ' 点伤害！' });
      this.showDmgNum('enemy', '-' + dmg, true);
      this.showCrit('霸王枪！');
      this.showCritEffect();
      setTimeout(function () { target.hit = false; that._syncEnemyViews(); }, 250);
    }

    if (act === 'item') {
      this.openBackpack(true);
      return;
    }

    if (act === 'quickItem') {
      var qi = this.data.battle.quickItem;
      if (!qi || qi.count <= 0) { this.showHint('无可用快捷道具'); return; }
      this._bpSelectedId = qi.id;
      this._bagInBattle = true;
      this.onUseBagItem();
      if (!this.inBattle) return;
      var remaining = this.getItemCount(qi.id);
      if (remaining <= 0) {
        var newQi = null;
        var items2 = this.player.items || [];
        for (var j = 0; j < items2.length; j++) {
          var def2 = ITEM_DB[items2[j].id];
          if (def2 && (def2.type === 'heal' || def2.type === 'elixir' || def2.type === 'mp')) {
            newQi = { id: def2.id, name: def2.name, icon: def2.icon, count: items2[j].count };
            break;
          }
        }
        this.setData({ 'battle.quickItem': newQi });
      } else {
        this.setData({ 'battle.quickItem.count': remaining });
      }
      return;
    }

    this.updateStats();
    this.updateBattleStats();

    // 标记死亡敌人
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      this._syncEnemyViews();
      var deathLog = '💀 ' + target.ref.name + ' 被击败了！';
      if (this._allEnemiesDead()) {
        deathLog = '🎉 敌军全灭！' + target.ref.name + ' 倒下！';
      }
      this.setData({ 'battle.log2': prevLog, 'battle.log': deathLog });
      audio.playSfx('win');
      
      // 最后一击动画延迟：让玩家看到击杀效果后再结算
      if (this._allEnemiesDead()) {
        this._battleEnding = true;
        var thatEnd = this;
        var battleGen = this._battleGen;
        setTimeout(function () { if (battleGen === thatEnd._battleGen) thatEnd.endBattle(true); }, 800);
        return;
      } else {
        // 还有活着的敌人，自动切换目标
        this._getTarget();
        // 继续敌人回合
        setTimeout(function () { that.enemyTurn(); }, 500);
        return;
      }
    }

    // 敌人回合
    setTimeout(function () { that.enemyTurn(); }, 400);
  },

  // 暴击屏幕特效：全屏震动 + 斩击线 + 火花粒子
  showCritEffect() {
    var that = this;
    // 屏幕震动
    this.setData({ 'battle.critShake': true, 'battle.critOverlay': true, 'battle.slashShow': true });
    // 生成4-6个火花粒子
    var sparks = [];
    for (var i = 0; i < 6; i++) {
      sparks.push({
        id: 's' + i,
        sx: (Math.random() - 0.5) * 80 + 'px',
        sy: (Math.random() - 0.5) * 80 - 20 + 'px',
        top: (42 + Math.random() * 16) + '%',
        left: (42 + Math.random() * 16) + '%',
        delay: (Math.random() * 0.15).toFixed(2) + 's'
      });
    }
    this.setData({ 'battle.sparks': sparks });
    // 清除特效
    setTimeout(function () {
      that.setData({ 'battle.critShake': false, 'battle.critOverlay': false, 'battle.slashShow': false });
    }, 500);
    setTimeout(function () {
      that.setData({ 'battle.sparks': [] });
    }, 600);
  },

  // 浮动伤害数字
  showDmgNum(target, num, isBig) {
    var that = this;
    if (this._dmgTimer) clearTimeout(this._dmgTimer);
    this.setData({ 'battle.dmgShow': true, 'battle.dmgNum': num, 'battle.dmgDir': target });
    this._dmgTimer = setTimeout(function () { that.setData({ 'battle.dmgShow': false }); }, 600);
  },

  // 所有活着的敌人依次攻击
  enemyTurn() {
    if (!this.inBattle) return;
    if (this._allEnemiesDead()) return;
    var that = this;
    var prevLog = this.data.battle.log || '';

    // 找一个活着的敌人来攻击
    var attacker = null;
    for (var i = 0; i < this.battleEnemies.length; i++) {
      if (!this.battleEnemies[i].dead) {
        attacker = this.battleEnemies[i];
        break;
      }
    }
    if (!attacker) return;

    var e = attacker.ref;
    var crit = Math.random() < 0.15 ? 2 : 1;
    var rawDmg = (e.atk - this.player.def) * crit + Math.floor(Math.random() * 3);
    if (this.defending) rawDmg = Math.max(1, Math.floor(rawDmg / 2));
    var dmg = Math.max(1, rawDmg);
    this.player.hp -= dmg;
    var defText = this.defending ? '（防御减半）' : '';
    var log = e.name + '发动攻击，造成 ' + dmg + ' 点伤害！' + defText + (crit > 1 ? ' 【重击！】' : '');
    this.defending = false;
    audio.playSfx('hit');

    this.updateStats();
    this.updateBattleStats();
    this.setData({ 'battle.log2': prevLog, 'battle.log': log, 'battle.playerHit': true });
    this.showDmgNum('player', '-' + dmg, false);
    if (crit > 1) this.showCrit('重击！');
    setTimeout(function () { that.setData({ 'battle.playerHit': false }); }, 250);

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.updateStats();
      this.updateBattleStats();
      this.setData({ 'battle.log': log + '\n💀 你被击败了……' });
      setTimeout(function () { that.handleDeath(); }, 1500);
      return;
    }

    // 同伴回合（如果存在且存活）
    if (that.companion) {
      setTimeout(function () { that.companionTurn(); }, 350);
    }
  },

  // 同伴自动攻击
  companionTurn() {
    if (!this.inBattle || !this.companion || this.companion.hp <= 0) return;
    if (this._allEnemiesDead()) return;
    var that = this;
    var prevLog = this.data.battle.log || '';

    // 找一个活着的敌人
    var target = null;
    for (var i = 0; i < this.battleEnemies.length; i++) {
      if (!this.battleEnemies[i].dead) { target = this.battleEnemies[i]; break; }
    }
    if (!target) return;

    var dmg = Math.max(1, this.companion.atk - target.ref.def + Math.floor(Math.random() * 3));
    target.hp -= dmg;
    target.hit = true;
    this._syncEnemyViews();
    this.setData({ 'battle.log2': prevLog, 'battle.log': this.companion.name + '协助攻击' + target.ref.name + '，造成 ' + dmg + ' 点伤害！' });
    audio.playSfx('atk');
    this.showDmgNum('enemy', '-' + dmg, false);
    setTimeout(function () { target.hit = false; that._syncEnemyViews(); }, 250);

    // 检查敌人是否死亡
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      this._syncEnemyViews();
      var battleGen = this._battleGen;
      setTimeout(function () {
        if (battleGen !== that._battleGen) return;
        if (that._allEnemiesDead()) {
          that._battleEnding = true;
          that.setData({ 'battle.log': '🎉 敌军全灭！' + target.ref.name + ' 倒下！' });
          setTimeout(function () { if (battleGen === that._battleGen) that.endBattle(true); }, 800);
        }
      }, 300);
    }
  },

  endBattle(won) {
    if (won && this.battleEnemies.length > 0) {
      var totalExp = 0, totalGold = 0;
      var dropMsgs = [];

      for (var i = 0; i < this.battleEnemies.length; i++) {
        var be = this.battleEnemies[i];
        var e = be.ref;
        this.deadEnemies[e.id] = true;
        totalExp += e.exp;
        totalGold += e.gold;

        if (e.type === 'bandit') this.killCounts.bandit++;
        if (e.type === 'bully') this.killCounts.bully++;
        if (e.type === 'guard') this.killCounts.guard++;
        if (e.type === 'boss') this.killCounts.boss++;

        // 任务进度
        if (this.player.quests.quest_1 && !this.quests.quest_1.done && e.type === 'bandit') {
          this.quests.quest_1.progress++;
          if (this.quests.quest_1.progress >= this.quests.quest_1.target) this.quests.quest_1.done = true;
        }
        if (this.player.quests.quest_2 && !this.quests.quest_2.done && e.type === 'bully') {
          this.quests.quest_2.progress++;
          if (this.quests.quest_2.progress >= this.quests.quest_2.target) this.quests.quest_2.done = true;
        }
        if (e.type === 'boss' && this.player.quests.quest_3 && !this.quests.quest_3.done) {
          this.quests.quest_3.progress++;
          if (this.quests.quest_3.progress >= this.quests.quest_3.target) this.quests.quest_3.done = true;
        }

        // 掉落
        if (e.type === 'boss') { this.addItem('elixir', 1); dropMsgs.push('✨仙芝'); }
        else if (e.type === 'guard' && Math.random() < 0.5) { this.addItem('superPotion', 1); dropMsgs.push('🧪金疮药'); }
        else if (e.type === 'bully' && Math.random() < 0.35) { this.addItem('manaPill', 1); dropMsgs.push('💠清心丹'); }
        else if (e.type === 'bandit' && Math.random() < 0.3) { this.addItem('potion', 1); dropMsgs.push('💊行军散'); }
      }

      this.player.exp += totalExp;
      this.player.gold += totalGold;

      // 战后恢复
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.floor(this.player.maxHp * 0.1));
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + 5);

      // 同伴恢复
      if (this.companion && this.player.companion) {
        this.player.companion.hp = Math.min(this.player.companion.maxHp, this.player.companion.hp + Math.floor(this.player.companion.maxHp * 0.15));
        this.companion = this.player.companion;
      }

      var lvGained = this.checkLevelUp();
      audio.playSfx('win');

      if (lvGained > 0) {
        var that2 = this;
        setTimeout(function () {
          that2.showToast('🎉 威名远扬！', '等级提升至 Lv.' + that2.player.level + '！\n\n攻击+' + (lvGained * 4) + '  防御+' + (lvGained * 2) + '\n气血上限+' + (lvGained * 22) + '  内力上限+' + (lvGained * 12));
        }, 300);
      }

      var dropStr = dropMsgs.length > 0 ? ' 获得：' + dropMsgs.join(' ') : '';
      this.showHint('🎉 大获全胜！+💰' + totalGold + ' +✨' + totalExp + dropStr);

      // quest_1 完成后给予同伴
      if (this.quests.quest_1.done && this.quests.quest_1.rewardClaimed && !this.player.companion) {
        this.player.companion = JSON.parse(JSON.stringify(COMPANION_TEMPLATES.yibing));
        this.showHint('👥 义兵加入了你的队伍！');
      }
    }

    this.setData({ 'battle.show': false, 'battle.playerHit': false, 'battle.critShow': false, 'battle.dmgShow': false });
    this.inBattle = false;
    this.defending = false;
    this.battleEnemies = [];
    this.targetIdx = 0;
    this._battleEnding = false;
    this.updateStats();
    this.render();
  },

  // 战败处理
  handleDeath() {
    var p = this.player;
    var lostGold = Math.max(10, Math.floor(p.gold * 0.2));
    p.gold = Math.max(0, p.gold - lostGold);
    p.hp = Math.max(1, Math.floor(p.maxHp * 0.3));
    p.mp = Math.max(1, Math.floor(p.maxMp * 0.3));

    // 同伴也回血
    if (p.companion) {
      p.companion.hp = Math.max(1, Math.floor(p.companion.maxHp * 0.3));
    }

    this.setData({ 'battle.show': false, 'battle.playerHit': false, 'battle.critShow': false, 'battle.dmgShow': false });
    this.inBattle = false;
    this.defending = false;
    this.battleEnemies = [];
    this.targetIdx = 0;
    this._battleEnding = false;

    // 传送回地图初始位置
    p.x = 9; p.y = 3;
    this.updateStats();
    this.render();
    this.updateLocName();
    this.autoSave();

    var that = this;
    setTimeout(function () {
      that.showToast('💀 力竭落败', '你被击败了……\n\n失去 💰' + lostGold + ' 五铢钱\n气血内力已恢复三成\n\n重整旗鼓，卷土重来！');
    }, 300);
  },

  // ==================== 升级系统 ====================
  checkLevelUp() {
    var gained = 0;
    var safety = 0; // 防止死循环
    while (this.player.exp >= this.player.expNeed && this.player.expNeed > 0) {
      safety++;
      if (safety > 100) { console.error('checkLevelUp 死循环中断'); break; }
      this.player.exp -= this.player.expNeed;
      this.player.level++;
      this.player.expNeed = Math.floor(this.player.expNeed * 1.6);
      this.player.maxHp += 22; this.player.hp = this.player.maxHp;
      this.player.maxMp += 12; this.player.mp = this.player.maxMp;
      this.player.atk += 4; this.player.def += 2;
      gained++;
    }
    if (gained > 0) audio.playSfx('levelup');
    return gained;
  },

  // ==================== 背包系统 ====================
  openBackpack(inBattle) {
    this._bagInBattle = !!inBattle;
    this._bpSelectedId = '';
    this.setData({ showOverlay: true, 'bag.show': true, 'bag.items': this.buildSortedItems() });
  },

  onCloseBag() {
    this.setData({ showOverlay: false, 'bag.show': false });
    this._bagInBattle = false;
    this._bpSelectedId = '';
  },

  onSelectBagItem(e) {
    this._bpSelectedId = e.currentTarget.dataset.id;
    var def = ITEM_DB[this._bpSelectedId];
    var typeText = '';
    if (def) {
      switch (def.type) {
        case 'heal': typeText = def.effect.hp === 'full' ? '回复全部气血' : '回复 ' + def.effect.hp + ' 点气血'; break;
        case 'elixir': typeText = '回复全部气血和内力'; break;
        case 'mp': typeText = '回复 ' + (def.effect.mp || 20) + ' 点内力'; break;
        case 'gold': typeText = '获得 ' + (def.effect.gold || 50) + ' 枚五铢钱'; break;
        case 'buff': typeText = '临时提升属性'; break;
        default: typeText = '特殊道具'; break;
      }
    }
    this.setData({
      bpSelectedId: this._bpSelectedId,
      bpDetail: def ? {
        icon: def.icon,
        name: def.name,
        desc: def.desc,
        typeText: typeText
      } : null
    });
  },

  onUseBagItem() {
    if (!this._bpSelectedId) return;
    var def = ITEM_DB[this._bpSelectedId];
    if (!def) return;

    var used = false;
    if (def.type === 'heal') {
      if (this.player.hp >= this.player.maxHp) { this.showHint('💡 气血已满！'); return; }
      if (def.effect.hp === 'full') { this.player.hp = this.player.maxHp; } else { this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.effect.hp); }
      this.removeItem(def.id, 1);
      audio.playSfx('heal');
      this.showHint('💊 使用' + def.name);
      used = true;
    } else if (def.type === 'elixir') {
      if (this.player.hp >= this.player.maxHp && this.player.mp >= this.player.maxMp) { this.showHint('💡 气血内力已满！'); return; }
      if (def.effect.hp === 'full') { this.player.hp = this.player.maxHp; } else { this.player.hp = Math.min(this.player.maxHp, this.player.hp + (def.effect.hp || 0)); }
      if (def.effect.mp === 'full') { this.player.mp = this.player.maxMp; } else { this.player.mp = Math.min(this.player.maxMp, this.player.mp + (def.effect.mp || 0)); }
      this.removeItem(def.id, 1);
      audio.playSfx('heal');
      this.showHint('✨ 使用' + def.name + '，气血内力全恢复！');
      used = true;
    } else if (def.type === 'mp') {
      if (this.player.mp >= this.player.maxMp) { this.showHint('💡 内力已满！'); return; }
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + (def.effect.mp || 20));
      this.removeItem(def.id, 1);
      audio.playSfx('heal');
      this.showHint('💠 使用' + def.name);
      used = true;
    } else if (def.type === 'gold') {
      this.player.gold += (def.effect.gold || 50);
      this.removeItem(def.id, 1);
      audio.playSfx('coin');
      this.showHint('💰 打开' + def.name);
      used = true;
    }

    if (this._bagInBattle && used) {
      this.onCloseBag();
      this.updateStats();
      this.updateBattleStats();
      var that = this;
      setTimeout(function () { if (that.inBattle) that.enemyTurn(); }, 300);
      return;
    }

    this._bpSelectedId = '';
    this._bagInBattle = false;
    // 刷新背包
    this.setData({ bpSelectedId: '', 'bag.items': this.buildSortedItems() });
    this.updateStats();
  },

  onDiscardBagItem() {
    if (!this._bpSelectedId) return;
    this.removeItem(this._bpSelectedId, 1);
    this.showHint('🗑️ 已丢弃');
    this._bpSelectedId = '';
    this.setData({ bpSelectedId: '', 'bag.items': this.buildSortedItems() });
  },

  // ==================== 道具系统 ====================
  // 构建排序后的物品列表
  buildSortedItems() {
    var items = [];
    for (var k in ITEM_DB) {
      var def = ITEM_DB[k];
      var count = this.getItemCount(def.id);
      if (count > 0) items.push({ id: def.id, name: def.name, icon: def.icon, count: count, rarity: def.rarity || 1 });
    }
    items.sort(function(a, b) { return b.rarity - a.rarity; });
    return items;
  },

  getItemCount(id) {
    if (!this.player.items) return 0;
    for (var i = 0; i < this.player.items.length; i++) {
      if (this.player.items[i].id === id) return this.player.items[i].count;
    }
    return 0;
  },

  addItem(id, ct) {
    ct = ct || 1;
    if (!this.player.items) this.player.items = [];
    for (var i = 0; i < this.player.items.length; i++) {
      if (this.player.items[i].id === id) { this.player.items[i].count += ct; return; }
    }
    this.player.items.push({ id: id, count: ct });
  },

  removeItem(id, ct) {
    ct = ct || 1;
    if (!this.player.items) return;
    for (var i = 0; i < this.player.items.length; i++) {
      if (this.player.items[i].id === id) {
        this.player.items[i].count -= ct;
        if (this.player.items[i].count <= 0) this.player.items.splice(i, 1);
        return;
      }
    }
  },

  // ==================== UI 辅助 ====================
  updateStats() {
    var p = this.player;
    var hpPercent = p.maxHp ? Math.max(0, Math.min(100, Math.round(p.hp / p.maxHp * 100))) : 0;
    var mpPercent = p.maxMp ? Math.max(0, Math.min(100, Math.round(p.mp / p.maxMp * 100))) : 0;
    var expPercent = p.expNeed ? Math.max(0, Math.min(100, Math.round(p.exp / p.expNeed * 100))) : 0;
    this.setData({
      'player.hp': p.hp, 'player.maxHp': p.maxHp,
      'player.mp': p.mp, 'player.maxMp': p.maxMp,
      'player.atk': p.atk, 'player.gold': p.gold,
      'player.level': p.level, 'player.exp': p.exp, 'player.expNeed': p.expNeed,
      hpPercent: hpPercent, mpPercent: mpPercent, expPercent: expPercent
    });
  },
  // 战斗专用：额外更新战斗面板数据
  updateBattleStats() {
    var p = this.player;
    var battlePlayerHp = p.maxHp ? Math.max(0, Math.min(100, Math.round(p.hp / p.maxHp * 100))) : 0;
    var battlePlayerMp = p.maxMp ? Math.max(0, Math.min(100, Math.round(p.mp / p.maxMp * 100))) : 0;
    this.setData({
      'battle.playerHpPercent': battlePlayerHp,
      'battle.playerMpPercent': battlePlayerMp
    });
  },

  updateLocName() {
    var locText = areaName(this.player.x, this.player.y, this.currentMap);
    this.setData({ locText: locText });
  },

  showHint(msg) {
    this.setData({ 'hint.text': msg, 'hint.show': true });
    if (this.hintTimer) clearTimeout(this.hintTimer);
    var that = this;
    this.hintTimer = setTimeout(function () { that.setData({ 'hint.show': false }); }, 1800);
  },

  showToast(title, text) {
    var that = this;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this.setData({ 'toast.show': true, 'toast.title': title, 'toast.text': text });
    this._toastTimer = setTimeout(function () { that.setData({ 'toast.show': false }); }, 2500);
  },

  onToastBoxTap() {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this.setData({ 'toast.show': false });
  },

  // 阻止事件冒泡（用于弹窗内容区）
  onNoop() { },

  // 战斗暴击大字特效
  showCrit(text) {
    var that = this;
    if (this._critTimer) clearTimeout(this._critTimer);
    this.setData({ 'battle.critShow': true, 'battle.critText': text });
    this._critTimer = setTimeout(function () {
      that.setData({ 'battle.critShow': false });
    }, 600);
  },


  // ==================== 按钮事件 ====================
  onSave() { audio.playSfx('click'); this.saveGame(); },
  onInventory() { audio.playSfx('click'); this.openBackpack(false); },
  onMeditate() {
    if (this.inBattle) { this.showHint('⚔️ 战斗中无法打坐！'); return; }
    if (this.player.gold < 15) { this.showHint('💰 需要15枚五铢钱'); return; }
    this.player.gold -= 15;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
    this.player.mp = Math.min(this.player.maxMp, this.player.mp + 20);
    audio.playSfx('heal');
    this.showHint('🧘 打坐调息一番，恢复50气血和20内力');
    this.updateStats();
  },
  onQuest() {
    audio.playSfx('click');
    var list = [];
    for (var k in this.quests) {
      var q = this.quests[k];
      // 未接受的隐藏不显示
      if (!this.player.quests[k] && !q.done) continue;
      
      var item = { id: k, name: q.name, desc: q.desc, target: q.target, progress: q.progress };
      if (q.done && q.rewardClaimed) {
        item.statusText = '✅ 已完成';
        item.done = true; item.rewardClaimed = true;
      } else if (q.done) {
        item.statusText = '📍 可领赏 (' + q.progress + '/' + q.target + ') ';
        item.done = true;
      } else if (this.player.quests[k]) {
        item.statusText = '进行中 (' + q.progress + '/' + q.target + ') ';
        item.active = true;
      } else {
        item.statusText = '未接受';
      }
      list.push(item);
    }
    this.setData({ showOverlay: true, questPanel: { show: true, quests: list } });
  },
  onCloseQuest() {
    this.setData({ showOverlay: false, questPanel: { show: false, quests: [] } });
  },

  // 设置面板
  onSettings() {
    audio.playSfx('click');
    this.setData({ showOverlay: true, 'settings.show': true });
  },
  onCloseSettings() {
    this.setData({ showOverlay: false, 'settings.show': false });
  },
  onMusicVolChange(e) {
    var vol = e.detail.value / 100;
    audio.setMusicVol(vol);
    this.setData({ 'settings.musicVol': e.detail.value });
    // 持久化音量设置
    try {
      var s = wx.getStorageSync('luanshi_settings') || {};
      s.musicVol = vol;
      wx.setStorageSync('luanshi_settings', s);
    } catch (err) {}
  },
  onSfxVolChange(e) {
    var vol = e.detail.value / 100;
    audio.setSfxVol(vol);
    this.setData({ 'settings.sfxVol': e.detail.value });
    // 持久化音量设置
    try {
      var s = wx.getStorageSync('luanshi_settings') || {};
      s.sfxVol = vol;
      wx.setStorageSync('luanshi_settings', s);
    } catch (err) {}
  },
  onManualSave() {
    audio.playSfx('click');
    this.saveGame();
  },
  onToggleMusic() {
    var enabled = !this.data.settings.musicEnabled;
    audio.setMusicEnabled(enabled);
    this.setData({ 'settings.musicEnabled': enabled });
    if (!enabled) { audio.stopBgm(); } else { audio.playBgm(); }
    try {
      var s = wx.getStorageSync('luanshi_settings') || {};
      s.musicEnabled = enabled;
      wx.setStorageSync('luanshi_settings', s);
    } catch (err) {}
  },
  onToggleSfx() {
    var enabled = !this.data.settings.sfxEnabled;
    audio.setSfxEnabled(enabled);
    this.setData({ 'settings.sfxEnabled': enabled });
    try {
      var s = wx.getStorageSync('luanshi_settings') || {};
      s.sfxEnabled = enabled;
      wx.setStorageSync('luanshi_settings', s);
    } catch (err) {}
  }
});

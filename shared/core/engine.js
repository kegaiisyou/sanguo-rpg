(function(){
  try{
  // [moved → shared/core/state.js]

  // ── 去全局泄漏：state.js / calendar.js 已只暴露到 LF.Core，此处一次性取别名 ──
  var Core = LF.Core;
  var G = Core.G || LF.SharedGame || LF;
  var state = Core.state;
  var settings = Core.settings;
  var SLOTS = Core.SLOTS;
  var curSlot = Core.curSlot;
  var SETTINGS_KEY = Core.SETTINGS_KEY;
  var saveSettings = Core.saveSettings;
  var lfSpeedLabel = Core.lfSpeedLabel;
  var SHICHEN = Core.SHICHEN;
  var WEATHERS = Core.WEATHERS;
  var WX_EFF = Core.WX_EFF;
  var isDaytime = Core.isDaytime;
  var wxEff = Core.wxEff;
  var mapData = Core.mapData;
  var lunarDayName = Core.lunarDayName;
  var deriveCalendar = Core.deriveCalendar;
  var LUNAR_MONTHS = Core.LUNAR_MONTHS;
  var LUNAR_START = Core.LUNAR_START;
  var WK = Core.WK;
  var WK_BASE = Core.WK_BASE;

  // 音效桥：audio.js（在 engine.js 之前加载）将音频引擎挂到 window.SFX；
  // 此处显式声明供 Combat 工厂 ctx（SFX: SFX）与引擎内裸名共用，消除隐式读 window 全局。
  var SFX = (typeof window !== 'undefined' && window.SFX) || null;

  // 存档系统：从 save.js 工厂注入运行时上下文（不再读 window 裸全局）
  var Save = LF.createSave({ SLOTS: SLOTS, G: G, SHICHEN: SHICHEN, getCurSlot: function(){ return curSlot; } });
  var rawSlot = Save.rawSlot, saveToSlot = Save.saveToSlot, clearSlot = Save.clearSlot,
      slotExists = Save.slotExists, save = Save.save, load = Save.load,
      clearSave = Save.clearSave, slotMeta = Save.slotMeta, normalize = Save.normalize;
  Save.migrateOld();

  // 装备数据层：从 equipment.js 工厂注入引擎依赖（effectiveStats/decayEquipment/equipFromPackTo/equipItem/unequip）。
  // 置于 Dev/Combat/Pack 等工厂之前，使下方别名立即可供各 createXxx ctx 与引擎内裸名消费；
  // clampHp/log 为 function 声明（提升），Pack 的 movePackItem/unequipToPack 为后建 var → 经 getter 惰性注入。
  var Equipment = LF.createEquipment({
    getState: function () { return state; },
    LF: LF,
    clampHp: clampHp, log: function () { return log.apply(null, arguments); },
    packMovePackItem: function () { return movePackItem; },
    packUnequipToPack: function () { return unequipToPack; }
  });
  var effectiveStats = Equipment.effectiveStats, decayEquipment = Equipment.decayEquipment,
      equipFromPackTo = Equipment.equipFromPackTo, equipItem = Equipment.equipItem,
      unequip = Equipment.unequip;

  // 调试台：从 dev.js 工厂注入引擎依赖（handleDev/renderDev 不再读 window 裸全局）
  var Dev = LF.createDev({
    G: G, LF: LF,
    getState: function () { return state; },
    getCard: function () { return $card; },
    getModal: function () { return $modal; },
    getCurrentModalKind: function () { return currentModalKind; },
    addReputation: function () { return addReputation.apply(null, arguments); },
    repTitle: function () { return repTitle.apply(null, arguments); },
    log: function () { return log.apply(null, arguments); },
    addXp: function () { return addXp.apply(null, arguments); },
    // City(createCity 在 L82) / Inventory(createInventory 在 L116) 均晚于本工厂创建；
    // 此处仅定义包装、调用时（用户点调试按钮）再取值 → 不固化 undefined（与 Equipment.L42 getter 同范式）
    isCityGrid: function () { return isCityGrid.apply(null, arguments); },
    isCaptured: function () { return isCaptured.apply(null, arguments); },
    cityDefaultOwner: function () { return cityDefaultOwner.apply(null, arguments); },
    burnCells: function () { return burnCells.apply(null, arguments); },
    effectiveStats: effectiveStats, closeModal: closeModal,
    renderRoom: renderRoom, openSpawnMap: openSpawnMap,
    // moralTitle/factionName 由 Progression/Strategy 晚定义（L392/L445）→ 惰性包装（同上方 isCityGrid 范式）
    moralTitle: function () { return moralTitle.apply(null, arguments); },
    factionName: function () { return factionName.apply(null, arguments); },
    renderStatus: renderStatus, toast: toast,
    packAdd: function () { return Inventory.packAdd.apply(null, arguments); }, save: save
  });
  var handleDev = Dev.handleDev, renderDev = Dev.renderDev;

  // 触发引擎：从 triggers.js 工厂注入引擎依赖（checkTriggers/graduate 不再读 window 裸全局）
  var Triggers = LF.createTriggers({
    G: G,
    getState: function () { return state; },
    getTriggers: function () { return (window.LF && window.LF.TRIGGERS) || (G && G.TRIGGERS) || []; },
    // log/logScene 解构自 Narr（L373），本工厂先建 → 包装函数延迟引用（同下方 packAdd 范式）
    log: function () { return log.apply(null, arguments); }, logScene: function () { return logScene.apply(null, arguments); },
    onbReveal: onbReveal, highlightOnb: highlightOnb, onbGoal: onbGoal,
    tutAsk: tutAsk, dlgEcho: dlgEcho, fxBeat: fxBeat,
    // findEvent（L396 才从 Progression 解构）/ addReputation（L395）均晚于本工厂 → 惰性包装
    findEvent: function () { return findEvent.apply(null, arguments); },
    runEvent: runEvent,
    // startCombat 来自 Combat 别名（L197 才赋值），本工厂先建 → 包装函数延迟引用（同 L75 packAdd 范式）
    startCombat: function () { return Combat.startCombat.apply(null, arguments); },
    addReputation: function () { return addReputation.apply(null, arguments); },
    // packAdd 同上：Inventory 在 L123 才赋值，闭包延迟引用
    packAdd: function () { return Inventory.packAdd.apply(null, arguments); }, save: save, renderStatus: renderStatus,
    renderMoveBar: renderMoveBar, renderNpcList: renderNpcList,
    addXp: function () { return addXp.apply(null, arguments); },
    acceptQuest: function () { return acceptQuest.apply(null, arguments); },
    completeQuest: function () { return completeQuest.apply(null, arguments); },
    upgradePick: function () { return upgradePick.apply(null, arguments); },
    // setTimeOfDay / forceRoom 定义在本文件后段（函数声明提升，包装引用更稳，同 packAdd 范式）
    setTimeOfDay: function () { return setTimeOfDay.apply(null, arguments); },
    forceRoom: function () { return forceRoom.apply(null, arguments); },
    // 底部页签逐项解锁（v20260912f）：剧本写 { t:'unlockDock', key:'pack' } 即「介绍到这个页签才把它亮出来」
    unlockDock: function () { return onbUnlockDock.apply(null, arguments); },
    getOnbLayers: function () { return ONB_LAYERS; }
  });
  var checkTriggers = Triggers.checkTriggers, graduate = Triggers.graduate;

  // 城市网格系统：从 city.js 工厂注入引擎依赖（BUILDINGS 在引擎中后定义，用 getter 惰性取值）
  // NPC 装配器（buildCityCellNpcs，函数声明提升）同样经 getter 注入：city.js 只认「怎么调」，
  // 不认人设卡数据，故加角色无需动 city.js。
  var City = LF.createCity({
    G: G,
    getState: function () { return state; },
    LF: LF,
    getBUILDINGS: function () { return BUILDINGS; },
    getNPC_BUILD: function () { return buildCityCellNpcs; },
    log: function () { return log.apply(null, arguments); }  });
  var cityProfile = City.cityProfile, cityLine = City.cityLine,
      cityGates = City.cityGates, cityGateDirs = City.cityGateDirs,
      CELL_META = City.CELL_META, CELL_DESC = City.CELL_DESC,
      ensureCityState = City.ensureCityState,
      cityTierLv = City.cityTierLv, cityGridSize = City.cityGridSize, cityLevelName = City.cityLevelName,
      CITY_LV_SIZE = City.CITY_LV_SIZE, CITY_LV_NAME = City.CITY_LV_NAME,
      cityDevOf = City.cityDevOf, cityOwnerOf = City.cityOwnerOf, cityDefaultOwner = City.cityDefaultOwner,
      isCaptured = City.isCaptured, cityBurnedMap = City.cityBurnedMap,
      factionLabel = City.factionLabel, conquerCity = City.conquerCity,
      chronicle = City.chronicle, chronicleList = City.chronicleList,
      burnedGates = City.burnedGates, siegeGuardMul = City.siegeGuardMul, setCityDev = City.setCityDev,
      playerFaction = City.playerFaction, centerTypeOf = City.centerTypeOf, devRadius = City.devRadius, baseDisplayType = City.baseDisplayType,
      cityCellInst = City.cityCellInst, setCityCell = City.setCityCell, nextBuildOrderId = City.nextBuildOrderId,
      buildOrderById = City.buildOrderById, activeBuildOrder = City.activeBuildOrder,
      cellDisplayType = City.cellDisplayType, canEnterCell = City.canEnterCell,
      burnCells = City.burnCells, siegeWin = City.siegeWin, siegeLose = City.siegeLose,
      cellDisplayName = City.cellDisplayName, seededRand = City.seededRand, isCityGrid = City.isCityGrid,
      genCityGrid = City.genCityGrid, cityCellDesc = City.cityCellDesc,
      cityCellNpcs = City.cityCellNpcs, cityCellActs = City.cityCellActs,
      registerCityRooms = City.registerCityRooms;
// 模块 farm（从 engine.js 拆分）
  var Farm = LF.createFarm({
      getState: function () { return state; },
      LF: LF,
      CROPS: function () { return CROPS.apply(null, arguments); },
      advanceMinutes: advanceMinutes,
      afterPackChange: afterPackChange,
      buildActions: buildActions,
      busyAct: function () { return busyAct.apply(null, arguments); },
      curRoom: curRoom,
      exert: exert,
      fxGet: fxGet,
      log: function () { return log.apply(null, arguments); },
      // onbWork：农事操作（翻/播/浇/收）各记 1 工分（v20260920h）
      onbWork: function () { return onbWork.apply(null, arguments); },
      renderStatus: renderStatus,
      toast: toast,
      jobOpen: function () { return jobOpen; },
  });
  var CROPS = Farm.CROPS, FARM_LI = Farm.FARM_LI, FARM_MAX = Farm.FARM_MAX, FARM_UP = Farm.FARM_UP, farmClear = Farm.farmClear;
  var farmFx = Farm.farmFx, farmHarvest = Farm.farmHarvest, farmHas = Farm.farmHas, farmObjects = Farm.farmObjects, farmSow = Farm.farmSow;
  var farmTill = Farm.farmTill, farmTilled = Farm.farmTilled, farmUpgrade = Farm.farmUpgrade, farmWater = Farm.farmWater, farmWeed = Farm.farmWeed;
  var plantPast = Farm.plantPast, plotLeft = Farm.plotLeft, plotStage = Farm.plotStage;
  // 模块 field（从 engine.js 拆分）
  var Field = LF.createField({
    getState: function () { return state; },
    LF: LF,
    G: G,
    log: function () { return log.apply(null, arguments); },
    toast: toast,
    wxEff: wxEff,
    isDaytime: isDaytime,
    WEATHERS: WEATHERS,
    effectiveStats: effectiveStats,
    advanceMinutes: advanceMinutes,
    afterPackChange: afterPackChange,
    buildActions: buildActions,
    mkAct: mkAct,
    openModal: openModal,
    closeModal: closeModal,
    save: save,
    renderStatus: renderStatus,
    toggleObjExpand: toggleObjExpand,
    placedCellTag: placedCellTag,
    placedInCell: placedInCell,
    packUpPlaced: packUpPlaced,
    openRestModal: function () { return openRestModal; },
    startCombat: function () { return startCombat; },
    packAdd: function () { return packAdd; },
    packFind: function () { return packFind; },
    packConsume: function () { return packConsume; },
    getCombatMode: function () { return combatMode; }
  });
  var fieldMonstersLeft = Field.fieldMonstersLeft, fieldNarr = Field.fieldNarr, fieldNarrFresh = Field.fieldNarrFresh,
      fieldMetaOf = Field.fieldMetaOf, roomIsBoatRoute = Field.roomIsBoatRoute, isOnBoat = Field.isOnBoat, setOnBoat = Field.setOnBoat,
      boatBoardAct = Field.boatBoardAct, fieldActions = Field.fieldActions, gatherField = Field.gatherField, fieldHasWater = Field.fieldHasWater,
      fishField = Field.fishField, huntFieldBeast = Field.huntFieldBeast, talkFieldNpc = Field.talkFieldNpc, fieldPlacedCamps = Field.fieldPlacedCamps,
      carriedCampGear = Field.carriedCampGear, placeFieldGear = Field.placeFieldGear, addFieldCamp = Field.addFieldCamp, campInField = Field.campInField,
      maybeFieldAmbush = Field.maybeFieldAmbush;

  // 模块 rest（从 engine.js 拆分）
  // 模块 sect（从 engine.js 拆分）
  var Sect = LF.createSect({
    getState: function () { return state; },
    G: G,
    log: function () { return log.apply(null, arguments); },
    toast: toast,
    openModal: openModal,
    renderStatus: renderStatus
  });
  var sectBonusText = Sect.sectBonusText, sectReqText = Sect.sectReqText, renderSectPanel = Sect.renderSectPanel, bindSectPanel = Sect.bindSectPanel;

  // 展示型面板簇（v20260919j）：图鉴 / 设置 / 致谢 / 志向标题 / 回顾 / 破境
  // 可变绑定一律 getter：HIST_MAX 声明在 L4125，晚于此处插入点，直接取值会捕获 undefined。
  var Panels = LF.createPanels({
    getState: function(){ return state; },   // 惰性取当前 state（重构后 window.getState 定义在 L4683，此处不能引用未声明变量）
    getSettings: function(){ return settings; },
    getHistMax: function(){ return HIST_MAX; },
    G: G,
    LF: LF,
    SFX: SFX,
    lfSpeedLabel: lfSpeedLabel,
    row: row,
    escapeHtml: escapeHtml,
    cityProfile: cityProfile, genCityGrid: genCityGrid,
    cellDisplayType: cellDisplayType, availableGateDirs: availableGateDirs,
    cityLevelName: cityLevelName, cityGridSize: cityGridSize,
    cityDevOf: cityDevOf,
  });
  var renderCodex = Panels.renderCodex,
      renderSettings = Panels.renderSettings,
      renderCredit = Panels.renderCredit,
      topObjectiveText = Panels.topObjectiveText,
      renderLogPanel = Panels.renderLogPanel,
      renderLevelup = Panels.renderLevelup,
      renderCityStat = Panels.renderCityStat;

  // 序章开场动画（v20260919j）：全屏幕布 #prologue 的一次性演出，演完回调 onDone
  var Prologue = LF.createPrologue({
    getSettings: function(){ return settings; },
    G: G,
    SFX: SFX
  });
  var playPrologue = Prologue.playPrologue;

  var restState = { kind: 'ground' };   // v20260924w：上移到 createRest 前——rest.js 经 ctx.restState() 取同一对象（kind 同步）
  var Rest = LF.createRest({
      getState: function () { return state; },
      LF: LF,
      G: G,
      REST_KINDS: function () { return REST_KINDS.apply(null, arguments); },
      advanceTime: advanceTime,
      buildActions: buildActions,
      clearActions: clearActions,
      clockFlowing: clockFlowing,
      closeModal: closeModal,
      curRoom: curRoom,
      die: die,
      // effectiveStats（L49 已定义）—— 供 actRest 结算休整恢复值（重构后 rest.js 闭包裸引用断链）
      effectiveStats: function () { return effectiveStats.apply(null, arguments); },
      inCellNow: inCellNow,
      log: function () { return log.apply(null, arguments); },
      maybeFieldAmbush: maybeFieldAmbush,
      packUpPlaced: packUpPlaced,
      renderStatus: renderStatus,
      shuicaoDrawToBag: shuicaoDrawToBag,
      shuicaoDrinkPlaced: shuicaoDrinkPlaced,
      shuicaoFillPlaced: shuicaoFillPlaced,
      toast: toast,
      getCombatMode: function () { return combatMode; },
      restState: function () { return restState; },
      getCard: function () { return document.getElementById('modal-card'); },
  });
  var PLACE_ACTIONS = Rest.PLACE_ACTIONS, PLACE_KEY_DEF = Rest.PLACE_KEY_DEF, REST_KINDS = Rest.REST_KINDS, WX_REST = Rest.WX_REST, actRest = Rest.actRest;
  var bindRestPanel = Rest.bindRestPanel, cellNapScene = Rest.cellNapScene, doNap = Rest.doNap, doRest = Rest.doRest, openRestModal = Rest.openRestModal;
  var outdoorRestFactor = Rest.outdoorRestFactor, renderRestPanel = Rest.renderRestPanel, storageCid = Rest.storageCid;
  // 模块 companion（从 engine.js 拆分）
  var Companion = LF.createCompanion({
      getState: function () { return state; },
      getCurrentModalKind: function () { return currentModalKind; },
      LF: LF,
      G: G,
      buildActions: buildActions,
      checkTriggers: function () { return checkTriggers.apply(null, arguments); },
      closeModal: closeModal,
      log: function () { return log.apply(null, arguments); },
      npcAttitude: npcAttitude,
      renderNpcList: renderNpcList,
      row: row,
      // save：首次解锁「给予」置位 onb.giveUnlocked 时落盘（v20260920g）
      save: function () { return save.apply(null, arguments); },
      talk: talk,
      toast: toast,
  });
  var DIR_ARROW = Companion.DIR_ARROW, DIR_GRID = Companion.DIR_GRID, bindGivePanel = Companion.bindGivePanel, buildNpcActions = Companion.buildNpcActions, calcGiveFavor = Companion.calcGiveFavor;
  var dismissCompanion = Companion.dismissCompanion, giveItemToNpc = Companion.giveItemToNpc, giveNpc = Companion.giveNpc, giveQty = Companion.giveQty, giveReaction = Companion.giveReaction;
  var giveSelectedIdx = Companion.giveSelectedIdx, observeNpc = Companion.observeNpc, onbGiveUnlocked = Companion.onbGiveUnlocked, openGivePanel = Companion.openGivePanel, recruitCompanion = Companion.recruitCompanion;
  var refreshGiveDetail = Companion.refreshGiveDetail, renderGivePanel = Companion.renderGivePanel, renderPartyPanel = Companion.renderPartyPanel;
  // 模块 mine（从 engine.js 拆分）
  var Mine = LF.createMine({
      getState: function () { return state; },
      LF: LF,
      RECIPES: LF.RECIPES,
      advanceMinutes: advanceMinutes,
      afterPackChange: afterPackChange,
      busyAct: function () { return busyAct.apply(null, arguments); },
      closeModal: closeModal,
      exert: exert,
      log: function () { return log.apply(null, arguments); },
      openModal: openModal,
      renderStatus: renderStatus,
      toast: toast,
      getCard: function () { return document.getElementById('modal-card'); },
  });
  var armoryEnter = Mine.armoryEnter, bindCavePanel = Mine.bindCavePanel, bindMinePanel = Mine.bindMinePanel, caveDig = Mine.caveDig, caveDown = Mine.caveDown;
  var caveFloorDesc = Mine.caveFloorDesc, caveHit = Mine.caveHit, caveState = Mine.caveState, genCaveFloor = Mine.genCaveFloor, genOpenMine = Mine.genOpenMine;
  var mineHit = Mine.mineHit, mineState = Mine.mineState, pickDef = Mine.pickDef, pickHitsNow = Mine.pickHitsNow, pickLv = Mine.pickLv;
  var rareForFloor = Mine.rareForFloor, renderCavePanel = Mine.renderCavePanel, renderMinePanel = Mine.renderMinePanel, rollCaveEvent = Mine.rollCaveEvent, steleRead = Mine.steleRead;
  var upgradePick = Mine.upgradePick;
  // 模块 jobboard（从 engine.js 拆分）
  var Jobboard = LF.createJobboard({
      getState: function () { return state; },
      LF: LF,
      JOB_BOARD: function () { return JOB_BOARD; },
      acceptQuest: function () { return acceptQuest.apply(null, arguments); },
      addReputation: function () { return addReputation.apply(null, arguments); },
      addXp: function () { return addXp.apply(null, arguments); },
      buildActions: buildActions,
      completeQuest: function () { return completeQuest.apply(null, arguments); },
      curRoom: curRoom,
      log: function () { return log.apply(null, arguments); },
      openModal: openModal,
      renderStatus: renderStatus,
      getCurrentModalKind: function () { return currentModalKind; },
      // LABOR_PER_WOOD 由 Schedule 晚定义（L432）→ 常量 getter（jobboard.js 解构处惰性取值）
      LABOR_PER_WOOD: function () { return LABOR_PER_WOOD; }
  });
  var bindJobBoard = Jobboard.bindJobBoard, jobBoard = Jobboard.jobBoard, jobFlag = Jobboard.jobFlag, jobOpen = Jobboard.jobOpen, jobPlankHTML = Jobboard.jobPlankHTML;
  var jobSeal = Jobboard.jobSeal, jobSettle = Jobboard.jobSettle, jobTake = Jobboard.jobTake, jobTick = Jobboard.jobTick, lastJobTaken = Jobboard.lastJobTaken;
  var renderJobBoard = Jobboard.renderJobBoard;
  // 模块 quest（从 engine.js 拆分）
  var Quest = LF.createQuest({
      getState: function () { return state; },
      LF: LF, G: G,
      getGuide: function () { return LF.Guide; },
      dirToRoom: dirToRoom, roomNameOf: roomNameOf, isCityGrid: isCityGrid, genCityGrid: genCityGrid,
      toast: toast, closeModal: closeModal, openModal: openModal, save: save,
      // log（L381）/ addXp（L396）/ addReputation（L395）晚于本工厂 → 惰性包装
      log: function () { return log.apply(null, arguments); },
      renderStatus: renderStatus,
      addXp: function () { return addXp.apply(null, arguments); },
      addReputation: function () { return addReputation.apply(null, arguments); }
  });
  var QORDER = Quest.QORDER, objBestEquip = Quest.objBestEquip, renderObjectives = Quest.renderObjectives, objCardHTML = Quest.objCardHTML,
      questTitle = Quest.questTitle, packCount = Quest.packCount, flagNum = Quest.flagNum, addFlagNum = Quest.addFlagNum,
      needHave = Quest.needHave, acceptQuest = Quest.acceptQuest, completeQuest = Quest.completeQuest, questCardHTML = Quest.questCardHTML,
      switchQuestTab = Quest.switchQuestTab, bindQuestPanel = Quest.bindQuestPanel, checkQuestRewards = Quest.checkQuestRewards,
      gotoBtnHTML = Quest.gotoBtnHTML, questGoto = Quest.questGoto, cityNpcCellPos = Quest.cityNpcCellPos;
  // 模块 mapking（从 engine.js 拆分）
  var MapKing = LF.createMapKing({
      getState: function () { return state; },
      LF: LF, G: G, mapData: mapData,
      resolveMapCoords: resolveMapCoords, mapKind: mapKind, curRoom: curRoom,
      closeModal: closeModal, renderRoom: renderRoom, save: save, mapNodeInfo: mapNodeInfo
  });
  var buildMapKingHTML = MapKing.buildMapKingHTML, initMapKing = MapKing.initMapKing;
  // 模块 learn（从 engine.js 拆分）
  var Learn = LF.createLearn({
      getState: function () { return state; },
      LF: LF, G: G,
      clearActions: clearActions, buildActions: buildActions, curRoom: curRoom,
      save: save, renderStatus: renderStatus, addBtn: addBtn,
      // log 由 Narr 在 L381 才解构 → 惰性包装（裸传会固化 undefined → openLearn 报「log is not a function」）
      log: function () { return log.apply(null, arguments); },
      getActions: function () { return $actions; }
  });
  var openLearn = Learn.openLearn;
  // 模块 escape（从 engine.js 拆分）
  var Escape = LF.createEscape({
      getState: function () { return state; },
      getRouteInfo: function () { return ROUTE_INFO; },
      getEscapeAvail: function () { return escapeAvail; },
      getEscapeLockHint: function () { return escapeLockHint; },
      getDoEscape: function () { return doEscape; },
      getTutAsk: function () { return tutAsk; },
      log: function () { return log.apply(null, arguments); }  });
  var openEscapeHub = Escape.openEscapeHub;
  // 模块 narr（从 engine.js 拆分）
  var Narr = LF.createNarr({
      getState: function () { return state; },
      getSettings: function () { return settings; },
      getAskPending: function () { return askPending; },
      getCombatMode: function () { return combatMode; },
      getCurfewWant: function () { return curfewWant; },
      setCurfewWant: function (v) { curfewWant = v; },
      getDlgSettle: function () { return dlgSettle; },
      getEscapeHtml: function () { return escapeHtml; },
      getRecHist: function () { return recHist; },
      getCurfewPatrol: function () { return curfewPatrol; }
  });
  var typeInto = Narr.typeInto, skipTypewriter = Narr.skipTypewriter, narrActive = Narr.narrActive, interactBusy = Narr.interactBusy,
      syncActionLock = Narr.syncActionLock, busyAct = Narr.busyAct, busyHide = Narr.busyHide, busyStopTimer = Narr.busyStopTimer,
      busyCancel = Narr.busyCancel, flushNarr = Narr.flushNarr, initLockObserver = Narr.initLockObserver,
      splitSpeech = Narr.splitSpeech, balanceSpeech = Narr.balanceSpeech, fbShow = Narr.fbShow, injectModalFb = Narr.injectModalFb,
      log = Narr.log, logRaw = Narr.logRaw, pumpLog = Narr.pumpLog, logNow = Narr.logNow, logScene = Narr.logScene, invalidateScene = Narr.invalidateScene;
  // 模块 progression（从 engine.js 拆分）
  var Progression = LF.createProgression({
      getState: function () { return state; },
      getLog: function () { return log; },
      getCombatMode: function () { return combatMode; },
      getOpenModal: function () { return openModal; },
      getClampHp: function () { return clampHp; },
      getG: function () { return G; },
      getPackAdd: function () { return packAdd; }
  });
  var moralLabel = Progression.moralLabel, moralTitle = Progression.moralTitle,
      addChivalry = Progression.addChivalry, addNotoriety = Progression.addNotoriety,
      afterMoral = Progression.afterMoral, repTitle = Progression.repTitle,
      addReputation = Progression.addReputation, enemyExp = Progression.enemyExp,
      addXp = Progression.addXp, applyEffect = Progression.applyEffect, findEvent = Progression.findEvent;
  // 模块 statusbar（从 engine.js 拆分）
  var Statusbar = LF.createStatusbar({
      getState: function () { return state; },
      getCheckQuestRewards: function () { return checkQuestRewards; },
      getDeriveCalendar: function () { return deriveCalendar; },
      getInCampNow: function () { return inCampNow; },
      getCellDisplayName: function () { return cellDisplayName; },
      getGenCityGrid: function () { return genCityGrid; },
      getIsCityGrid: function () { return isCityGrid; },
      getNeedHave: function () { return needHave; },
      SHICHEN: SHICHEN,
      WEATHERS: WEATHERS
  });
  // 展示层合并调度（v20260919e）：renderStatus 被 100+ 处调用，纯展示、可合并——
  // 同一帧内的多次调用仅触发一次真实 DOM 重建，避免动作/时间推进链里反复 innerHTML 重排。
  var _sbRenderStatus = Statusbar.renderStatus, renderLocTab = Statusbar.renderLocTab;
  var _rsScheduled = false;
  function renderStatus(){
    if (_rsScheduled) return;
    _rsScheduled = true;
    (window.requestAnimationFrame || function(f){ setTimeout(f, 16); })(function(){
      _rsScheduled = false;
      if (!state) return;                       // 离局/换局后 state 可能已清空，跳过本帧
      try { _sbRenderStatus(); } catch (e) {}
    });
  }
  // 模块 schedule（从 engine.js 拆分）
  var Schedule = LF.createSchedule({
      getState: function () { return state; },
      SHICHEN: SHICHEN
  });
  var hourNow = Schedule.hourNow, hourLabel = Schedule.hourLabel, inHours = Schedule.inHours,
      isMessHour = Schedule.isMessHour, isDeadHour = Schedule.isDeadHour, isCurfewHour = Schedule.isCurfewHour,
      isRollHour = Schedule.isRollHour, onbF = Schedule.onbF, onbBound = Schedule.onbBound,
      cellLockedHere = Schedule.cellLockedHere, wardenCell = Schedule.wardenCell, wardenHere = Schedule.wardenHere,
      LABOR_PER_WOOD = Schedule.LABOR_PER_WOOD, INN_FEE = Schedule.INN_FEE;
  // 战略层（外交/战争/朔日结算）：从 engine.js 拆分（v20260918k）
  var Strategy = LF.createStrategy({
    getState: function () { return state; },
    LF: LF,
    log: log, toast: toast, save: save, renderStatus: renderStatus, openModal: openModal,
    conquerCity: conquerCity, playerFaction: playerFaction,
    cityOwnerOf: cityOwnerOf, cityDevOf: cityDevOf, setCityDev: setCityDev, isCityGrid: isCityGrid,
    chronicle: chronicle, chronicleList: chronicleList, escapeHtml: escapeHtml,
    roleAtkMul: roleAtkMul, roleEconMul: roleEconMul, roleFavorMul: roleFavorMul, roleDef: roleDef,
    getArmyTroops: function () { return Army.armyCount(); },
    startDefendBattle: function (cid, fid) { return War.startDefendBattle(cid, fid); },
    Officers: Officers
  });
  var diploGet = Strategy.diploGet, diploStatus = Strategy.diploStatus, diploActive = Strategy.diploActive, diploTruceBetween = Strategy.diploTruceBetween,
      diploExpire = Strategy.diploExpire, diploPropose = Strategy.diploPropose, diploSue = Strategy.diploSue, renderDiplomacy = Strategy.renderDiplomacy, openDiplomacy = Strategy.openDiplomacy, fireMonthlyEvents = Strategy.fireMonthlyEvents, renderEvent = Strategy.renderEvent, chooseEvent = Strategy.chooseEvent,
      factionName = Strategy.factionName, factionColor = Strategy.factionColor, civilEdict = Strategy.civilEdict, renderEdict = Strategy.renderEdict, renderFactionMap = Strategy.renderFactionMap,
      warKm = Strategy.warKm, warCityAdjPairs = Strategy.warCityAdjPairs, warOwnerKey = Strategy.warOwnerKey, warIsLordKey = Strategy.warIsLordKey, warFactionName = Strategy.warFactionName,
      warCityPower = Strategy.warCityPower, warFactionTotal = Strategy.warFactionTotal, warFactionCityCount = Strategy.warFactionCityCount, warInRoom = Strategy.warInRoom,
      runWarlordBattle = Strategy.runWarlordBattle, warChronicleEntry = Strategy.warChronicleEntry, warlordBattle = Strategy.warlordBattle, warlordDayTick = Strategy.warlordDayTick,
      onMonthTick = Strategy.onMonthTick, monthlyYield = Strategy.monthlyYield, factionDomesticAI = Strategy.factionDomesticAI, scanFactionSurvival = Strategy.scanFactionSurvival, checkUnify = Strategy.checkUnify, factionTroops = Strategy.factionTroops;

  // 建筑内部交互状态 / 围城待结算（引擎本地可变状态，供城内营造面板与围城逻辑使用；
  // 原属「城市网格系统」区块但仅被引擎侧的营造 UI / 围城流程消费，故留于引擎）
  var buildingState = null;
  var pendingSiegeCid = null;

  // 行囊（背包）数据模型：从 inventory.js 工厂注入引擎依赖
  // afterPackChange/toast 为引擎内函数声明（提升后可用），经 ctx 回调；state 经 getState 惰性取值
  var Inventory = LF.createInventory({
    getState: function () { return state; },
    LF: LF,
    toast: toast,
    afterPackChange: afterPackChange
  });
  var packMax = Inventory.packMax, packResize = Inventory.packResize, packEnsure = Inventory.packEnsure,
      itemKey = Inventory.itemKey, packIsStackable = Inventory.packIsStackable, packFirstEmpty = Inventory.packFirstEmpty,
      packAdd = Inventory.packAdd, packConsume = Inventory.packConsume, packFind = Inventory.packFind, packList = Inventory.packList,
      packGet = Inventory.packGet, packSet = Inventory.packSet, locEq = Inventory.locEq,
      usePackItem = Inventory.usePackItem, discardPackItem = Inventory.discardPackItem, packAutoSort = Inventory.packAutoSort;

  // 地图视图子系统：从 mapview.js 工厂注入引擎依赖（城市模型别名 + 引擎本地函数/UI）
  // CELL_META/cellDisplayType/cityBurnedMap/cellDisplayName/genCityGrid 来自 City.* 别名；
  // cityCellSiteName/fieldHasWater/initStrategicMapInGame/openModal 为引擎函数声明（提升后可用）
  var MapView = LF.createMapView({
    getState: function () { return state; },
    LF: LF,
    G: G,
    CELL_META: CELL_META, cellDisplayType: cellDisplayType, cityBurnedMap: cityBurnedMap, cellDisplayName: cellDisplayName, genCityGrid: genCityGrid,
    cityCellSiteName: cityCellSiteName, fieldHasWater: fieldHasWater, initStrategicMapInGame: initStrategicMapInGame,
    openModal: openModal
  });
  var openMap = MapView.openMap, buildMapCityHTML = MapView.buildMapCityHTML,
      buildCityMapTabsHTML = MapView.buildCityMapTabsHTML, buildFieldMapHTML = MapView.buildFieldMapHTML,
      buildFieldAttrPanel = MapView.buildFieldAttrPanel, buildFieldMapTabsHTML = MapView.buildFieldMapTabsHTML,
      initMapTabs = MapView.initMapTabs, initMapCity = MapView.initMapCity;

  // 城内营造子系统：从 citybuild.js 工厂注入引擎依赖
  // state/currentModalKind/cityBuildState 为引擎中后赋值或随运行变化的绑定 → 用 getter 惰性取值；
  // City.* / Inventory.* 助手与引擎函数声明（提升后可用）经 ctx 引用
  var CityBuild = LF.createCityBuild({
    getState: function () { return state; },
    getCurrentModalKind: function () { return currentModalKind; },
    getCityBuildState: function () { return cityBuildState; },
    LF: LF,
    cellDisplayType: cellDisplayType, cellDisplayName: cellDisplayName,
    ensureCityState: ensureCityState, cityCellInst: cityCellInst, setCityCell: setCityCell,
    nextBuildOrderId: nextBuildOrderId, buildOrderById: buildOrderById, activeBuildOrder: activeBuildOrder,
    packFind: packFind, packConsume: packConsume, afterPackChange: afterPackChange,
    toast: toast, log: log, save: save, openModal: openModal, closeModal: closeModal,
    advanceTime: advanceTime, advanceMinutes: advanceMinutes, exert: exert, renderRoom: renderRoom, itemIconHTML: itemIconHTML,
    npcBuildSpeed: (typeof npcBuildSpeed !== 'undefined' ? npcBuildSpeed : null)
  });
  var cityBuildBpList = CityBuild.cityBuildBpList, cityBuildMatTotal = CityBuild.cityBuildMatTotal,
      startCityBuild = CityBuild.startCityBuild, cityBuildMat = CityBuild.cityBuildMat,
      cityBuildExert = CityBuild.cityBuildExert, finishCityBuild = CityBuild.finishCityBuild,
      heldTuzhiList = CityBuild.heldTuzhiList, renderCityBuildPanel = CityBuild.renderCityBuildPanel,
      renderCityBuildProgress = CityBuild.renderCityBuildProgress, renderCityBuildDone = CityBuild.renderCityBuildDone,
      bindCityBuildPanel = CityBuild.bindCityBuildPanel, tickBuildOrders = CityBuild.tickBuildOrders,
      commitBuildOrder = CityBuild.commitBuildOrder, collectRents = CityBuild.collectRents, goCell = CityBuild.goCell;

  // 战斗系统：从 combat.js 工厂注入引擎依赖
  var Combat = LF.createCombat({
    getState: function () { return state; },
    getCurrentModalKind: function () { return currentModalKind; },
    getCombatMode: function () { return combatMode; },
    setCombatMode: function (v) { combatMode = v; },
    getDqCardEl: function () { return dqCardEl; },
    setDqCardEl: function (v) { dqCardEl = v; },
    getPendingSiegeCid: function () { return pendingSiegeCid; },
    setPendingSiegeCid: function (v) { pendingSiegeCid = v; },
    getPendingArmyBattle: function () { return pendingArmyBattle; },
    armyRoundHook: function (orders) { return War.armyRoundHook(orders); },
    armyBattleEnd: function (result) { return War.armyBattleEnd(result); },
    getNarr: function () { return $narr; },
    G: G, SFX: SFX, LF: LF,
    effectiveStats: effectiveStats, clampHp: clampHp, decayEquipment: decayEquipment,
    save: save, log: log, toast: toast, renderStatus: renderStatus, renderRoom: renderRoom,
    clearActions: clearActions, flushNarr: flushNarr, collapseObjPanel: collapseObjPanel,
    openModal: openModal, closeModal: closeModal,
    packAdd: packAdd, packList: packList, packMax: packMax, packResize: packResize,
    itemIconHTML: itemIconHTML, usePackItem: usePackItem, equipFromPackTo: equipFromPackTo,
    onbReveal: onbReveal, highlightOnb: highlightOnb,
    maybeStarve: maybeStarve, siegeWin: siegeWin, siegeLose: siegeLose,
    addXp: addXp, addReputation: addReputation, enemyExp: enemyExp, finishEscape: finishEscape
  });
  var logHTML = Combat.logHTML, logText = Combat.logText, combatAnchor = Combat.combatAnchor,
      flashAnchor = Combat.flashAnchor, floatDamage = Combat.floatDamage, floatLabel = Combat.floatLabel,
      critBurst = Combat.critBurst, flashHit = Combat.flashHit, combatAnchorAppend = Combat.combatAnchorAppend,
      popWeapon = Combat.popWeapon, floatImpact = Combat.floatImpact, flashBlock = Combat.flashBlock,
      showDodge = Combat.showDodge, shakeScene = Combat.shakeScene, weaponSvg = Combat.weaponSvg,
      buildPortrait = Combat.buildPortrait, markAttack = Combat.markAttack, markSceneCrit = Combat.markSceneCrit,
      flashSeal = Combat.flashSeal, logCombat = Combat.logCombat, startCombat = Combat.startCombat,
      tutCombatActive = Combat.tutCombatActive, tutThrowPack = Combat.tutThrowPack, tutStep = Combat.tutStep,
      tutCombatAct = Combat.tutCombatAct, playCombatFx = Combat.playCombatFx, dqInitCombat = Combat.dqInitCombat,
      dqRenderCard = Combat.dqRenderCard, dqRenderOrderBar = Combat.dqRenderOrderBar, beatBadge = Combat.beatBadge,
      dqRenderRound = Combat.dqRenderRound, dqNextCommand = Combat.dqNextCommand, dqRenderCommands = Combat.dqRenderCommands,
      dqShowArts = Combat.dqShowArts, dqShowTargets = Combat.dqShowTargets, dqOpenItems = Combat.dqOpenItems,
      dqConsumeItem = Combat.dqConsumeItem, dqTryFlee = Combat.dqTryFlee, dqAdvance = Combat.dqAdvance,
      dqResolveRound = Combat.dqResolveRound, dqPlayLog = Combat.dqPlayLog, dqResetRage = Combat.dqResetRage,
      dqFx = Combat.dqFx, dqPush = Combat.dqPush, dqFinish = Combat.dqFinish, endCombat = Combat.endCombat,
      exitCombatToRoom = Combat.exitCombatToRoom, mountLootPanes = Combat.mountLootPanes,
      openLootWindow = Combat.openLootWindow, compareEquip = Combat.compareEquip,
      lootInfoHTML = Combat.lootInfoHTML, showCombatSettlement = Combat.showCombatSettlement;

  // ══ 军队 / 战术战斗（v20260921a）：营级单位 + 三阵位军令 + 攻城/守城/野战 ══
  // pendingArmyBattle：本场军队作战的编排上下文（分段、援军、夜袭等），由 War 读写
  var pendingArmyBattle = null;
  var Officers = LF.createOfficers({
    getState: function () { return state; }, LF: LF,
    log: log, toast: toast, save: save, escapeHtml: escapeHtml,
    cityOwnerOf: cityOwnerOf, playerFaction: playerFaction,
    openModal: openModal, getCurrentModalKind: function () { return currentModalKind; },
    armyCount: function () { return Army.armyCount(); },
    busyAct: function () { return busyAct.apply(null, arguments); }, advanceMinutes: advanceMinutes, renderStatus: renderStatus, isCityGrid: isCityGrid, armyTrainAt: function () { return Army.armyTrainAt.apply(null, arguments); }
  });
  var Army = LF.createArmy({
    getState: function () { return state; },
    getCurrentModalKind: function () { return currentModalKind; },
    LF: LF, G: G,
    log: log, toast: toast, save: save, renderStatus: renderStatus, renderRoom: renderRoom,
    openModal: openModal, closeModal: closeModal,
    itemIconHTML: itemIconHTML, escapeHtml: escapeHtml,
    packAdd: packAdd, packConsume: packConsume, packFind: packFind, packList: packList,
    afterPackChange: afterPackChange,
    cityDevOf: cityDevOf, isCityGrid: isCityGrid,
    roleAtkMul: roleAtkMul, roleDef: roleDef,
    exert: exert, advanceTime: advanceTime,
    commandBonus: function () { return Officers.commandBonus(); }
  });
  LF.Officers = Officers;
  // 角色大厅（v20260923r）：主角 / 随从 / 武将 一览切换，原神式角色页
  var CharHall = LF.createCharHall({
    getState: function () { return state; }, LF: LF, G: G,
    openModal: openModal, closeModal: closeModal,
    log: log, toast: toast, save: save, renderStatus: renderStatus,
    escapeHtml: escapeHtml, row: row,
    Officers: Officers,
    packList: packList, packAdd: packAdd, afterPackChange: afterPackChange,
    mainCharStatHTML: mainCharStatHTML, mainCharAllocHTML: mainCharAllocHTML,
    mainCharEquipHTML: mainCharEquipHTML, mainCharSkillHTML: mainCharSkillHTML,
    bindMainDetail: bindMainCharDetail
  });
  var War = LF.createWar({
    getState: function () { return state; },
    LF: LF, G: G,
    log: log, toast: toast, save: save, renderStatus: renderStatus, renderRoom: renderRoom,
    openModal: openModal, closeModal: closeModal, escapeHtml: escapeHtml,
    exert: exert, advanceTime: advanceTime,
    startCombat: startCombat, showCombatSettlement: showCombatSettlement,
    conquerCity: conquerCity, playerFaction: playerFaction, cityDevOf: cityDevOf,
    isCityGrid: isCityGrid, roleAtkMul: roleAtkMul,
    Army: Army,
    getPendingArmyBattle: function () { return pendingArmyBattle; },
    setPendingArmyBattle: function (v) { pendingArmyBattle = v; },
    Officers: Officers
  });
  var armyRecruit = Army.armyRecruit, armyTrainAt = Army.armyTrainAt, armyDisband = Army.armyDisband, armySetRank = Army.armySetRank,
      armyDeposit = Army.armyDeposit, armyWithdraw = Army.armyWithdraw, armyBuyGrain = Army.armyBuyGrain,
      armyDeploy = Army.armyDeploy, armyCamp = Army.armyCamp, armyScout = Army.armyScout, armyAmbush = Army.armyAmbush,
      tickArmyDay = Army.tickArmyDay, armyActive = Army.armyActive, armyCount = Army.armyCount,
      armyPower = Army.armyPower, armyUpkeep = Army.armyUpkeep, armyMoraleAdd = Army.armyMoraleAdd,
      buildArmyPlayerUnits = Army.buildArmyPlayerUnits, settleArmyLoss = Army.settleArmyLoss,
      renderArmyPanel = Army.renderArmyPanel, bindArmyPanel = Army.bindArmyPanel,
      openArmyDeposit = Army.openArmyDeposit, openArmyDeploy = Army.openArmyDeploy,
      startSiegeBattle = War.startSiegeBattle, openSiegePrep = War.openSiegePrep,
      startDefendBattle = War.startDefendBattle, startFieldBattle = War.startFieldBattle,
      warToggleTroop = War.warToggleTroop, warLaunch = War.warLaunch, tryAmbush = War.tryAmbush;
  var officerRecruit = Officers.recruit, officerAppoint = Officers.appoint, officerDismiss = Officers.dismiss,
      renderOfficerPanel = Officers.renderOfficerPanel, renderSearchPanel = Officers.renderSearchPanel,
      openOfficerPanel = Officers.openOfficerPanel, openSearchPanel = Officers.openSearchPanel, renderOfficerHub = Officers.renderOfficerHub,
      dispatchAssign = Officers.dispatchAssign, dispatchRemove = Officers.dispatchRemove,
      dispatchLabor = Officers.dispatchLabor, dispatchTroops = Officers.dispatchTroops, facilitiesMonthlyYield = Officers.facilitiesMonthlyYield,
      civilCommand = Officers.civilCommand, delegateCommand = Officers.delegateCommand, undelegateCommand = Officers.undelegateCommand, monthlyAffairs = Officers.monthlyAffairs, renderEdictCommands = Officers.renderEdictCommands;
  // NPC 装配器与交谈面板（v20260916c）：从 engine.js 切出，见 shared/core/npc.js。
  // 排在 Combat 之后（敌意卡「挑战」用 startCombat）、Pack 之前；city.js 经 getNPC_BUILD 延迟取装配器，
  // 故 City（更早建）不会因 NPC 后建而拿到空值。
  var NPC = LF.createNpc({
    G: G, LF: LF,
    getState: function () { return state; },
    log: log, toast: toast, save: save, renderStatus: renderStatus,
    openModal: openModal, closeModal: closeModal,
    exert: exert,
    narrActive: narrActive, getAskPending: function () { return askPending; }, removeTutChoices: removeTutChoices,
    observeNpc: observeNpc, openGivePanel: openGivePanel,
    startCombat: function (a, b) { return Combat.startCombat(a, b); },
    genCityGrid: genCityGrid, cellDisplayType: cellDisplayType, seededRand: seededRand,
    getNPC_COMBAT_MAP: function () { return NPC_COMBAT_MAP; }
  });
  var NPC_CARDS = NPC.NPC_CARDS, NPC_CARD_BY = NPC.NPC_CARD_BY, NPC_BY_KEY = NPC.NPC_BY_KEY,
      npcRegister = NPC.npcRegister, npcHour = NPC.npcHour, npcFill = NPC.npcFill, npcNameOf = NPC.npcNameOf,
      FAVOR_TIERS = NPC.FAVOR_TIERS, npcFavor = NPC.npcFavor, npcFavorTier = NPC.npcFavorTier,
      addNpcFavor = NPC.addNpcFavor, npcFavorPct = NPC.npcFavorPct, npcRotate = NPC.npcRotate, npcLine = NPC.npcLine,
      npcSmallTalk = NPC.npcSmallTalk, npcHourOK = NPC.npcHourOK, npcCellPool = NPC.npcCellPool,
      npcCountOf = NPC.npcCountOf, npcEligible = NPC.npcEligible, npcSlotsHere = NPC.npcSlotsHere, npcMake = NPC.npcMake,
      npcHostileActs = NPC.npcHostileActs, buildCityCellNpcs = NPC.buildCityCellNpcs,
      talkInline = NPC.talkInline, npcTopicOnce = NPC.npcTopicOnce, npcTalkPrefix = NPC.npcTalkPrefix,
      npcSpeak = NPC.npcSpeak, NPC_ACT_IMPL = NPC.NPC_ACT_IMPL,
      getTalkNpc = NPC.getTalkNpc;

  // 行囊装备面板/交互：从 pack.js 工厂注入引擎依赖（置于 Combat 别名块之后，以便使用 compareEquip）
  var Pack = LF.createPack({
    getState: function () { return state; },
    getPackInspect: function () { return packInspect; },
    setPackInspect: function (v) { packInspect = v; },
    LF: LF,
    toast: toast, save: save, renderStatus: renderStatus, afterPackChange: afterPackChange,
    itemIconHTML: itemIconHTML, effectiveStats: effectiveStats, compareEquip: compareEquip, positionFloat: positionFloat,
    locEq: locEq, packMax: packMax, packFirstEmpty: packFirstEmpty, packList: packList, packGet: packGet,
    usePackItem: usePackItem, discardPackItem: discardPackItem
  });
  var movePackItem = Pack.movePackItem, unequipToPack = Pack.unequipToPack,
      swapPackCells = Pack.swapPackCells, refreshPackGridLight = Pack.refreshPackGridLight,
      refreshPackEquipLight = Pack.refreshPackEquipLight, quickUseFromPack = Pack.quickUseFromPack,
      inspCls = Pack.inspCls, renderPackGrid = Pack.renderPackGrid, renderEquipFigure = Pack.renderEquipFigure,
      renderPack = Pack.renderPack, renderEquipStats = Pack.renderEquipStats,
      renderPackInspect = Pack.renderPackInspect, parseLoc = Pack.parseLoc, showPackFloat = Pack.showPackFloat,
      bindPackInteractions = Pack.bindPackInteractions, useInspect = Pack.useInspect,
      discardInspect = Pack.discardInspect, canDiscard = Pack.canDiscard,
      packHighlightReplaced = Pack.packHighlightReplaced, equipInspect = Pack.equipInspect,
      unequipInspect = Pack.unequipInspect, closeInspect = Pack.closeInspect, toggleStats = Pack.toggleStats;
  // 可进入建筑系统（屋舍面板 + 建筑数据表 + 进出楼房间逻辑）：从 building.js 工厂注入引擎依赖
  var Building = LF.createBuilding({
    getState: function () { return state; },
    getBuildingState: function () { return buildingState; },
    LF: LF, itemIconHTML: itemIconHTML, bldActsFilter: bldActsFilter,
    packFind: packFind, packAdd: packAdd, packConsume: packConsume,
    exert: exert, log: log, toast: toast, renderStatus: renderStatus,
    itemKey: itemKey, usePackItem: usePackItem, bldZihao: bldZihao,
    setCityDev: setCityDev, cityDevOf: cityDevOf, advanceTime: advanceTime, renderRoom: renderRoom,
    getCombatMode: function () { return combatMode; },
    getCard: function () { return $card; }, getCurrentModalKind: function () { return currentModalKind; },
    openModal: openModal, closeModal: closeModal,
    busyAct: busyAct,  // 耗时动作进度条（v20260914a，见引擎 busyAct）
    upgradePick: upgradePick  // 镐头升级（v20260915i，矿坑体系：锻造台锻镐经此升镐级）
  });
  var bldCurArea = Building.bldCurArea, bldDef = Building.bldDef,
      renderBuildingPanel = Building.renderBuildingPanel, bindBuildingPanel = Building.bindBuildingPanel,
      BUILDINGS = Building.BUILDINGS, isBldRoom = Building.isBldRoom, bldForRoom = Building.bldForRoom,
      bldRoom = Building.bldRoom, enterBldRoom = Building.enterBldRoom, bldMove = Building.bldMove,
      leaveBldRoom = Building.leaveBldRoom, hasCount = Building.hasCount;
  // 仓库系统：从 storage.js 工厂注入引擎依赖
  var Storage = LF.createStorage({
    getState: function () { return state; },
    getStorageCid: function () { return storageCid; },
    LF: LF, itemIconHTML: itemIconHTML, ensureCityState: ensureCityState,
    itemKey: itemKey, packIsStackable: packIsStackable, packFind: packFind,
    packConsume: packConsume, packAdd: packAdd, packFirstEmpty: packFirstEmpty,
    packMax: packMax, packList: packList, packGet: packGet,
    usePackItem: usePackItem, equipFromPackTo: equipFromPackTo,
    toast: toast, save: save, log: log, afterPackChange: afterPackChange,
    getCard: function () { return $card; }, getCurrentModalKind: function () { return currentModalKind; },
    openModal: openModal, closeModal: closeModal
  });
  var ensureStorage = Storage.ensureStorage, storageItemCount = Storage.storageItemCount,
      storageAdd = Storage.storageAdd, storagePut = Storage.storagePut, storageTake = Storage.storageTake,
      storeGet = Storage.storeGet, storePutFromPack = Storage.storePutFromPack, storeTakeToPack = Storage.storeTakeToPack,
      storeSwap = Storage.storeSwap, storeSort = Storage.storeSort, storeUseItem = Storage.storeUseItem,
      storeEquipItem = Storage.storeEquipItem, renderStoragePanel = Storage.renderStoragePanel,
      bindStoragePanel = Storage.bindStoragePanel;
  // 捏人 / 开场序章：从 charcreate.js 工厂注入引擎依赖
  var CharCreate = LF.createCharCreate({
    G: G,
    getState: function () { return state; },
    getCreateState: function () { return createState; },
    setCreateState: function (v) { createState = v; },
    getCard: function () { return $card; },
    openModal: openModal, closeModal: closeModal, enterGame: enterGame,
    clampHp: clampHp, renderStatus: renderStatus, toast: toast, save: save
  });
  var initCreateState = CharCreate.initCreateState, beginCreate = CharCreate.beginCreate,
      renderCreateHTML = CharCreate.renderCreateHTML, bindCreate = CharCreate.bindCreate,
      bindAttrAlloc = CharCreate.bindAttrAlloc, attrAllocHTML = CharCreate.attrAllocHTML;
  // 采集/制作/锻造资源加工链：从 crafting.js 工厂注入引擎依赖
  // craftState/forgeState 留在引擎（openModal 的 craft/forge 分支直写其字段），模块经 getter 共享同一引用
  var Crafting = LF.createCrafting({
    getState: function () { return state; },
    getCraftState: function () { return craftState; },
    getForgeState: function () { return forgeState; },
    getCard: function () { return $card; },
    LF: LF, G: G,
    packFind: packFind, packAdd: packAdd, packConsume: packConsume,
    packIsStackable: packIsStackable, packFirstEmpty: packFirstEmpty, itemKey: itemKey,
    itemIconHTML: itemIconHTML, placedCellTag: placedCellTag, placedInCell: placedInCell,
    advanceTime: advanceTime, afterPackChange: afterPackChange, save: save,
    log: log, toast: toast, openModal: openModal, closeModal: closeModal,
    renderRoom: renderRoom, buildActions: buildActions, exert: exert,
    busyAct: busyAct,  // 耗时动作进度条（v20260914a，见引擎 busyAct）
    upgradePick: upgradePick  // 镐头升级（v20260915i，矿坑体系：锻造台锻镐经此升镐级）
  });
  var gatherActs = Crafting.gatherActs, startGather = Crafting.startGather, doPickGather = Crafting.doPickGather,
      chopTree = Crafting.chopTree, searchBench = Crafting.searchBench, pickupAxe = Crafting.pickupAxe,
      consumeTool = Crafting.consumeTool, renderCraftPanel = Crafting.renderCraftPanel,
      bindCraftPanel = Crafting.bindCraftPanel, doCraft = Crafting.doCraft,
      mineStone = Crafting.mineStone, cutWood = Crafting.cutWood, fireBrick = Crafting.fireBrick,
      openBuildCrate = Crafting.openBuildCrate, openForgePanel = Crafting.openForgePanel,
      renderForgePanel = Crafting.renderForgePanel, bindForgePanel = Crafting.bindForgePanel,
      forgeAct = Crafting.forgeAct, tickForge = Crafting.tickForge;
  // ===== 捏人 / 开场序章 =====
  // 四维属性（直接对应战斗数值，无资质壳；每点换算见 G.ATTR_RATIO）
  var createState=null;   // 捏人状态（openModal 读取）；四维常量与 pendingSlot/pendingSave 已移入 shared/core/charcreate.js

  // ===== 历法（农历为主 · 公历为对照锚点）与天候 =====
  // [moved → shared/core/calendar.js]
  // 山河志空间坐标（网格 col,row；row 越小越北，col 越大越东）
  // 数据外置于 shared/data/map.js（LF.MAP）：coords 坐标 / regions 区域 / kinds 节点分色 / cell·li 图例
  // 自愈：凡 G.ROOMS 中存在但缺坐标的房间，依任一有坐标出口的方位就近生成，地图与 rooms 永不失配
  var MAP_COORDS=null;
  var MAP_CELL=92;     // 单格像素（缺省，覆盖自 LF.MAP.cell）
  var MAP_LI=60;       // 1 格 = 60 里（用于距离刻度，缺省，覆盖自 LF.MAP.li）
  var MAPMINC=0, MAPMINR=0;  // 地图网格最小列/行（支持负坐标：蓟城正北通道）
  // 世界坐标线性换算（grid col/row → 底图像素）；历史上由已废弃的网格世界图按 REF 仿射填充。
  // 现仅出生点地图（buildMapKingHTML）使用 resolveMapCoords 的 col/row；州域几何统一收敛到 region.geojson。
  var MAPWK=1, MAPWB=0, MAPHK=1, MAPHB=0;
  var DIR_DELTA={ '北':[0,-1],'南':[0,1],'东':[1,0],'西':[-1,0],
                  '东北':[1,-1],'西北':[-1,-1],'东南':[1,1],'西南':[-1,1] };
  // [moved → shared/core/calendar.js]
  function resolveMapCoords(){
    if(MAP_COORDS) return MAP_COORDS;
    MAP_CELL = mapData().cell || 92;
    MAP_LI = mapData().li || 60;
    var coords={};
    var base=mapData().coords||{};
    for(var k in base){ coords[k]=base[k].slice(); }
    var changed=true;
    while(changed){
      changed=false;
      for(var rid in G.ROOMS){
        if(coords[rid]) continue;
        var room=G.ROOMS[rid];
        for(var dir in (room.exits||{})){
          var tid=room.exits[dir];
          if(!coords[tid]) continue;
          var d=DIR_DELTA[dir]; if(!d) continue;
          coords[rid]=[coords[tid][0]+d[0], coords[tid][1]+d[1]];
          changed=true; break;
        }
      }
    }
    MAP_COORDS=coords;
    return coords;
  }
  function mapKind(rid){
    var k=mapData().kinds && mapData().kinds[rid];
    if(k) return k;
    if(rid==='kuyilao' || /^camp_[td]z\d$/.test(rid)) return 'tutorial';
    if(/^ji_heishan_/.test(rid)) return 'dungeon';
    if(/^ji_/.test(rid) || /^yuyang_/.test(rid)) return 'city';
    return 'wild';
  }
  // 图例文案（对应 kinds 取值）
  var MAP_KIND_LABEL={ city:'城镇', wild:'野外', dungeon:'贼巢', fort:'军屯', tutorial:'教学', town:'村镇', camp:'营地' };
  // 山河志空间地图 HTML（main 查看 / 调试选出生点 共用；数据驱动 shared/data/map.js）
  // v20260822ar：三国群英传式大地图 —— 纯方位节点，间隔拉开（KING_CELL=110px）；SVG 示意河流（黄河/长江）+ 二次贝塞尔道路；节点无图标、无图例、不显示教学关卡；支持缩放（data-bx/by 基准坐标 + .mk-bg scale）。
// [moved -> shared/core/mapking.js]
  // [moved → shared/core/calendar.js]

  // [moved -> shared/core/prologue.js]
  // [moved → shared/core/state.js]
  // 将一份存档数据载入为当前游戏状态并展卷
  function enterGame(data, slot, isNew){
    curSlot=slot||0;
    Core.state = state = normalize(data || G.defaultSave());
    G.applySect(state);
    G.recalcBase(state);                      // 依据四维 attr + 门派加成 重算派生战力
    packEnsure(state);                     // 行囊/6 装备槽兼容与初始化（v0.6）
    // v20260920e：水袋不再开局随行 —— 改由「开垦薄田」奖励，引导去农田水井打水（见 camp_farm / well*）
    state.fixtures = state.fixtures || {};
    SFX.setEnabled(state.sfxOn!==false);   // 载入存档后同步音效开关
    try{ SFX.setBgmVolume((settings.bgmVol!=null?settings.bgmVol:35)/100); SFX.setSfxVolume((settings.sfxVol!=null?settings.sfxVol:60)/100); SFX.startBgm(); }catch(e){}       // 启动古风BGM（v20260909a）
    if(!state.quest || typeof state.quest!=='object') state.quest={bandit:0,turban:0,hua_xiong:false,luoyang:false};
    $narr.innerHTML='';
    // 序幕（P0 · v20260911g）：新档 / 未看过时，入局先演「开场动画」——全屏幕布 #prologue 逐行浮现时代文案
    //   （文案见 shared/story/dialogues.js · prologue，演出见 playPrologue）。动画演毕才 renderRoom，
    //   故角色是「被推进牢房」之后才出现在牢里的；紧接着由 camp_opening 剧本接开场（铁链/尘土/周听涛开口）。
    // 记录旗标放顶层 state.flags.introShown——不可放 flags.onb.*，因教学入口 applyOnboard 会整块重置 onb。
    var _playIntro = !!isNew;   // 序章仅开新游戏播放；读档一律跳过（避免旧存档/残留幕布导致每次读档重播开场）
    if(_playIntro){ if(!state.flags) state.flags={}; state.flags.introShown=true; }
    renderStatus();
    // 开场渐进式 UI：新局落在教学入口时，先进入空白引导态（隐藏顶栏/DOCK/行动区/罗盘）
    // v20260911f：默认新档现落在牢房（camp_tz1），故把教学子牢房一并纳入，确保 flags.onb 在首帧 renderRoom 前已建，
    //   suppressNarr 才能对教学房间生效（否则牢房常规描写会插在序幕与「押入牢房」演出之间）。
    var _onbSpawn = (/^camp_[td]z\d$/.test(state.room||''));
    if(_onbSpawn && !(state.flags && state.flags.onb && state.flags.onb.done)){
      if(!state.flags) state.flags={};
      // unlocked: [] —— 页签解锁表（v20260912f）。新局显式置空，才能与「旧存档无此字段」
      //   区分开：前者按教学进度逐个点亮，后者（本机制之前开的档）一律视为全解锁。
      if(!state.flags.onb || !state.flags.onb.started) state.flags.onb={started:true, personality:null, favor:0, reveal:[], tcDone:false, talked:{}, unlocked:[]};
      applyOnboard();   // NPC 列表延后到开场剧本「点下方老乞丐」一步才 reveal，避免提前交互引发 bug
    }
    var app=document.getElementById('app');
    var tt=document.getElementById('title'); if(tt) tt.classList.add('hidden');
    // 「轻触文字快进」提示（v20260912a）：必须等叙事区真的露出来、且正在打字时再说。
    //   旧版放在 playPrologue 之前 —— 幕布随即盖住全屏、#app 被隐藏，1.4 秒后提示就没了，
    //   等玩家看完动画回到牢房，这条唯一的打字快进教学早已消失（等于从未教过）。
    var _tipSkip=function(){
      if(!(_onbSpawn && !(state.flags && state.flags.onb && state.flags.onb.done))) return;
      setTimeout(function(){ toast('轻触叙事文字，可立即显示整段', 3600); }, 1200);
    };
    if(_playIntro){
      // 序章动画期间先不露界面（幕布底下空着），演毕再显界面并渲染牢房 —— 「演完才出现在牢里」
      if(app) app.classList.add('hidden');
      playPrologue(function(){
        if(app) app.classList.remove('hidden');
        renderRoom(state.room || state.spawnRoom || 'ji_guomen');
        _tipSkip();
      });
    } else {
      var _pr=document.getElementById('prologue'); if(_pr) _pr.classList.add('hidden');   // 防御：读档时显式隐藏上一局残留的序章幕布
      if(app) app.classList.remove('hidden');
      renderRoom(state.room || state.spawnRoom || 'ji_guomen');
      _tipSkip();
    }
  }

  var $status=document.getElementById('status');
  // 点击状态栏 → 时辰钟表；唯独右侧那颗「回顾」另开门路（v20260914a）
  $status.onclick=function(e){
    var t=e && e.target;
    if(t && t.id==='st-log'){ openModal('log'); return; }
    openModal('clock');
  };
  var $narr=document.getElementById('narr');
  var busyEl=document.getElementById('busy');   // 耗时动作进度条（v20260914a，见 busyAct）
  var $actions=document.getElementById('actions');
  var $modal=document.getElementById('modal');
  var $card=document.getElementById('modal-card');
  var $toast=document.getElementById('toast');

  function curRoom(){ return G.ROOMS[state.room] || bldRoom(state.room) || G.ROOMS.kuyilao; }

  var askPending=false;  // [保留：对话悬挂态属对话子系统，由 tutAsk 与 ~15 个引擎函数共有，不随叙事模块迁出]
  // [moved -> shared/core/narr.js]

  // ===== 状态栏（两行：身份 + 数值条） =====
  // P3 善恶双轨：侠义/凶名独立双轴，互不抵消
  // [moved -> shared/core/progression.js] 善恶双轴/声望 mutator

  // [moved -> shared/core/statusbar.js] 状态栏渲染 renderStatus/renderLocTab

  // [moved -> shared/core/progression.js] 升级/效果结算

  // [moved -> shared/core/schedule.js] 作息/营规口径判定纯函数

  // 营中「一日」结算：跨子夜时清算点卯 —— 前一日没回牢销名即记一次旷役。
  // v20260916g：旷役改即时罚（跨日即扣口粮与好感），不再「次日口粮按罚例加倍」那种延迟账——
  //   玩家当场看到后果，也免得记两笔（查房一笔、跨日一笔）来回勾销。
  function onbDayTick(days){
    var o=onbF(); if(!o || !o.curfewSet || o.done) return;
    for(var i=0;i<days;i++){
      // v20260916e：查房（curfew_patrol）已当场记过旷役的（lateDone=true），跨日不重复记——
      //   否则一次晚归会记两笔旷役（查房一笔 + 跨日一笔）。
      if(!o.checkInDone && !o.lateDone){
        o.missCount=(o.missCount||0)+1;
        // v20260916g：旷役即时罚——扣一份口粮（饱食-8）+ 牢头好感-1；没粮可扣就罚好感
        var hadFood=(state.food||0)>0;
        state.food=Math.max(0,(state.food||0)-8);
        o.favor=(o.favor||0)-1;
        log('〔旷役〕'+hourLabel()+'结算：昨日未回牢销名，记旷役一次——'+(hadFood?'口粮被扣了一份（饱食-8）· ':'口粮本已见底，记你一笔「饿着也是活该」· ')+'牢头好感-1。','warn');
      }
      o.checkInDone=false;   // 新的一日重新点卯（午后销名）
      o.rollDone=false;      // 新的一日重新应卯（卯至午点名）
      o.rollMissWarned=false; // v20260916f：「未应卯」提示新的一日重新计
      o.checkWarned=false;    // v20260916g：「牢头不在」提示新的一日重新计
      o.rollWarnDay=undefined; // v20260916h：「卯时提醒」新的一日重新计
      o.lateDone=false;      // 新的一日重开晚归判定
      o.messToday=0;         // 当日换饭次数重置
    }
  }
  // 应卯点名本体（v20260916e 抽为可复用）：手动（handleAction）与自动（时辰推移）共用一套账。
  //   auto=true 时文案带「自动」标记——让玩家知道是营规替他应了名，而非凭空多事。
  function doRollCall(auto){
    var _rr = onbF();
    if(!_rr || !_rr.curfewSet || _rr.done) return false;
    if(!isRollHour()) return false;
    if(_rr.rollDone) return false;
    _rr.rollDone=true; _rr.rollDays=(_rr.rollDays||0)+1; _rr.favor=(_rr.favor||0)+1;
    var _rc=addFlagNum('flags.task.roll_cnt', 1);
    addXp(5);
    log((auto?'〔点卯·自动〕':'〔点卯〕')+hourLabel()+'，牢头展册唱名，你应了一声。册上记你一笔「勤」（修为+5 · 营中好感+1）。','good');
    if(_rc>=3 && !(state.flags.task && state.flags.task.roll_done)){
      state.flags.task=state.flags.task||{}; state.flags.task.roll_done=true;
      if((_rr.missCount||0)>0){ _rr.missCount=_rr.missCount-1; log((auto?'〔点卯·自动〕':'〔点卯〕')+'牢头翻着册子哼了一声：「连应三日，记你一功——前头那笔旷役，勾了。」','good'); }
      packAdd('fan',2); afterPackChange(); addXp(25);
      log((auto?'〔点卯·自动〕':'〔点卯〕')+'「勤」字记满三笔，大勺多匀了你两张干粮。（干粮×2 · 修为+25）','good');
      completeQuest('roll_call');
    } else {
      log((auto?'〔点卯·自动〕':'〔点卯〕')+'册上「勤」字已记 '+Math.min(_rc,3)+'/3 —— 记满三笔可销一次旷役，另得干粮两张。','sys');
    }
    save(state); renderStatus();
    return true;
  }
  // 自动营规（v20260916e→h）：保留「规定时间 + 指定区域」的玩法，省去手动按按钮——
  //   卯至午时辰踏入中军场院(1,1)且牢头在场即自动应卯；
  //   牢头未时(7)起回牢门口（7..2 在牢房格(1,0)），此刻踏入牢房格且当日已应卯（rollDone）才自动销名。
  //   v20260916f 加前置：先应卯、后销名——没应卯，牢头不给落销名的字（提示后仍可去补应卯）。
  //   v20260916g 加在场：销名须「牢头在牢门口」（他未时起才回牢守夜，卯至午在中军督工，不在就不销名，
  //     只提示一次）；应卯同理须牢头在中军场院（卯至午他本就在，加了判定更稳）。
  //   v20260916h 放宽：应卯扩到午时（过午不候）；牢头午时后回牢，销名随之提前到午后。
  //   按钮已从城格动作移除（city.js），玩家「到场即办」，无需再点。
  //   只服务「营规未脱」的玩家（脱籍后不再受约束）。
  //   触发点：① advanceTime 时辰推进后；② move/goCell 落格后（见 move 内调用）。
  function autoOnbRoutines(){
    if(!onbBound()) return;
    var o=onbF(); if(!o) return;
    var cp=state.flags.cityPos;
    if(!cp || cp.cid!=='kuyilao') return;          // 人在营中网格才谈得上应卯/销名
    if(isRollHour() && cp.x===1 && cp.y===1 && !o.rollDone && wardenHere('1,1')){
      doRollCall(true);                             // 卯至午 + 中军场院 + 牢头在场：自动应名记「勤」
    }
    if(cp.x===1 && cp.y===0 && !o.checkInDone){
      if(o.rollDone && wardenHere('1,0')){
        o.checkInDone=true; o.favor=(o.favor||0)+1; // 牢房格 + 已应卯 + 牢头在牢门口：自动销名记勤
        log('〔点卯·自动〕你回到牢房，牢头翻册点头：「'+hourLabel()+'，算你今日勤勉。」（营中好感+1）','good');
        save(state); renderStatus();
      } else if(!o.rollDone && !o.rollMissWarned){
        o.rollMissWarned=true;                       // 当日只提示一次，免得每次踏进牢房都刷
        save(state);
        log('〔点卯·未应〕你踏进牢房，牢头翻册皱眉：「今日不见你来应名，这销名的字，我不能给你落。」（先去中军场院应卯，再回来销名）','warn');
      } else if(o.rollDone && !wardenHere('1,0') && !o.checkWarned){
        o.checkWarned=true;                          // v20260916h：牢头卯至午在中军督工，销名等他午后回牢再办
        save(state);
        log('〔点卯·销名〕你回了牢房，可牢头此刻还在中军场院督工——销名的字，须等他午后回牢门口再落。','sys');
      }
    }
  }
  // 进食记账（v20260915d）：「灶上一口热饭」按「真的吃了什么」计数 —— inventory.js 使用物品时回调此钩子。
  //   为什么不记在「换饭」那一刻：换完揣着不吃等于没吃，这一条要教的正是「领了饭就吃下去」（饱食度）。
  LF.onEat = function(defId){
    var o=onbF(); if(!o || !o.started || o.done) return;
    if(defId!=='fan' && defId!=='xizhou' && defId!=='douzhou') return;
    var t=state.flags && state.flags.task; if(!t || !t.mess_started || t.mess_done) return;
    var n=addFlagNum('flags.task.meal_cnt', 1);
    if(n>=2){
      t.meal_done=true;
      packAdd('fan',1); afterPackChange(); addXp(20);
      log('〔伙房〕两顿热饭落肚，大勺又塞来一张干粮：「营里能活下来的，都是按时吃饭的。」（干粮×1 · 修为+20）','good');
      completeQuest('mess_meal');
    } else {
      log('〔灶上一口热饭〕吃下一顿，还差 '+(2-n)+' 顿。','sys');
    }
    save(state); renderStatus();
  };
  // 战斗结算钩子（v20260915e）：由 core/combat.js 的 endCombat 回调（撤/胜/败）。
  //   眼下只挂一条「犬舍试手」：韩铁教的是「打不过就撤」，故只有真撤出来（fled）才算数——
  //   把狗打死不算，那教不会「留得青山」。
  LF.onCombatResult = function(result, enemy){
    if(!enemy) return;
    // 默叔线·狄云舟拦路收尾（coup.moshu 分支）：胜或退皆算出营，统一毕业搬运；败亡交战斗系统处置。
    if (enemy.id === 'diyunzhou' && state.flags && state.flags.coup && state.flags.coup.branch === 'moshu' && !state.flags.coup.moshu_escaped) {
      if (result === 'lose') return;
      state.flags.coup.moshu_escaped = true;
      if (state.flags.onb) state.flags.onb.done = true;
      state.moveGate = null; save(state);
      graduate(true);
      moveToOutside();
      log('〔脱籍〕你已出营——点卯、晚归、口粮罚例一概不再管你；只是营中的钟点照旧，鼓声、作息、日头都不会为你停。', 'order');
      log('〔墨家支路·逃脱〕默叔在前开路，你们翻过营墙那一刻，远处火光正吞没牢区。崔九替你挡下的那一刀，换来这一条活路。', 'env');
      log('〔教学完成〕你逃出了苦役营！自此汇入北疆乱世——点下方罗盘「北」前往林径，外头自有接应。', 'sys');
      return;
    }
    // 韩铁线·北墙截杀收尾（coup.officer_letter 分支）：胜或退皆算出营，密令在手；败亡交战斗系统处置。
    if (enemy.id === 'yth_intercept' && state.flags && state.flags.coup && state.flags.coup.branch === 'officer_letter' && !state.flags.coup.officer_letter_escaped) {
      if (result === 'lose') return;
      state.flags.coup.officer_letter_escaped = true;
      if (state.flags.onb) state.flags.onb.done = true;
      state.moveGate = null; save(state);
      graduate(true);
      moveToOutside();
      log('〔脱籍〕你已出营——点卯、晚归、口粮罚例一概不再管你；只是营中的钟点照旧，鼓声、作息、日头都不会为你停。', 'order');
      log('〔送信·墨家支路〕你揣着韩铁的密令翻出营墙，身后是吞没牢区的火光。信还在，人还在——白檀屯的救兵，便有指望。', 'env');
      log('〔教学完成〕你逃出了苦役营！自此汇入北疆乱世——点下方罗盘「北」前往林径，外头自有接应。', 'sys');
      return;
    }
    // 木人试艺（v20260915f）：桩是死物，练的是「打得倒」——故只认打赢，撤了不计。
    if(result==='win' && enemy.id==='dummy'){
      var d=state.flags && state.flags.task;
      if(d && d.dummy_pending){
        d.dummy_pending=false;
        var dn=jobTick('dummy');
        log('木人桩「咚」地仰倒，绳扣绷得吱呀作响。（已戳倒 '+dn+' / 3 回）','good');
        if(dn>=3){
          log('〔差役了结·木人试艺〕韩铁终于点头：「手上有了准头。往后这桩，你自个儿练去。」（修为+35 · 韩铁好感+1）','good');
          state.npcFavor=state.npcFavor||{}; state.npcFavor['han_tie']=(state.npcFavor['han_tie']||0)+1;
          jobSettle('dummy','dummy_train',35,0);
        } else { save(state); renderStatus(); }
      }
      return;
    }
    if(result!=='fled') return;
    if(enemy.id!=='stray_dog') return;
    var t=state.flags && state.flags.task; if(!t || !t.dog_try) return;
    t.dog_try=false; t.dog_done=true;
    addFlagNum('flags.task.dog_fled', 1);
    addXp(40); addReputation(2);
    log('〔犬舍试手〕你自犬牙底下抽身而退，韩铁在场外咧嘴：「撤得利落——记住，〔撤退〕不是逃，是留得青山。」（修为+40 · 声望+2）','good');
    completeQuest('dog_spar');
    save(state); renderStatus();
  };
  // 教学期时间是否流动（v20260911i）：牢头「介绍时辰」（clockOn）之前，牢中时辰一律冻结。
  //   理由同设计：玩家可能不敲门、只在牢里反复打盹，若时间照走，日头就被睡过去了。
  function clockFlowing(){
    var o=onbF();
    if(!o || !o.started || o.done) return true;   // 非教学 / 已脱籍：照常流动
    return o.clockOn===true;                      // 教学期：须等「介绍时辰」走过，时钟才起步
  }
  // 时辰定点（教学「介绍时辰」专用，v20260911i）：把更鼓拨到指定时辰。
  //   出牢门的那一刻统一拨回清晨——于是「踏出牢门」永远是白天，不会出现「出门即深夜」的荒谬。
  function setTimeOfDay(h, clock){
    state.time=(((h==null?3:h)|0)%12+12)%12;
    if(clock!=null) state.clock=Math.max(0,Math.min(1439, clock|0));
    applyTimeRoutines(); renderStatus(); save(state);
  }
  // 强制落位（押回牢房等，v20260911i）：不走能耗/门禁，直接把人放到某格。
  function forceRoom(rid, cell){
    if(!G.ROOMS[rid] && !isCityGrid(rid)) return;
    if(cell && isCityGrid(rid)) state.flags.cityPos={cid:rid, x:cell[0], y:cell[1]};
    state.room=rid; save(state);
    closeModal();
    renderRoom(rid, true);
  }
  // ═══ 巡夜查房（v20260911i · 营规闭环）═══
  // 营规未脱者：戌时起若还在营中游荡而未回牢房，巡夜狱卒必来拿人 ——
  //   押回牢房 + 三鞭 + 记一次逾时（次日口粮按罚例加倍）。
  //   于是「不回牢点卯」再不是躲开鞭子的办法，只把这顿鞭子往后拖；想安稳，就得赶在戌时前回牢销名。
  var CAMP_SAFE_CELL={x:1, y:0};        // 牢房格（回牢销名处）＝视为已归牢
  function inCellNow(){
    if(/^camp_[td]z\d/.test(state.room||'')) return true;      // 天字/地字号子牢房
    if(state.room==='kuyilao'){
      var cp=state.flags && state.flags.cityPos;
      if(cp && cp.x===CAMP_SAFE_CELL.x && cp.y===CAMP_SAFE_CELL.y) return true;
    }
    return false;
  }
  function inCampNow(){
    if(state.room==='kuyilao') return true;
    return /^camp_/.test(state.room||'');
  }
  var curfewWant=false;   // 有一次巡夜因「正在演出」而让路，待叙事收尾后由 syncActionLock 续评
  // 叫起巡夜：先记「待评」，再延后一帧试一次；若彼时仍在叙事，curfewWant 会留着，等空闲再续。
  function requestCurfewPatrol(){ curfewWant=true; setTimeout(function(){ try{ curfewPatrol(); }catch(e){} }, 0); }
  function curfewPatrol(){
    curfewWant=false;
    if(!state || state.dead) return false;
    if(combatMode!==null) return false;
    if(interactBusy()){ curfewWant=true; return false; }   // 正在演出/答话：挂起「待评」，等这茬过去再来拿人
    if(!onbBound()) return false;                    // 已脱籍 / 营规未立：管不着
    if(!isCurfewHour()) return false;                // 未到落锁时辰（戌→寅）
    var o=onbF();
    if(inCellNow()){                                 // 已归牢：销掉今夜「拿过了」的印记，出格再犯照样拿
      if(o.forcedNight){ o.forcedNight=null; save(state); }
      return false;
    }
    if(o.forcedNight===state.day) return false;      // 今夜已拿过一次，不重复用刑
    if(!inCampNow()) return false;                   // 人不在营中（营外/郊野）：营规够不着
    var fired=checkTriggers({ hook:'onPatrol', room: state.room });
    if(fired) o.forcedNight=state.day;
    save(state);
    return !!fired;
  }
  // 劳役（时间闭环核心，v20260911h）：一次劳作 = 半个时辰（60 分钟）+ 精力，并累积工分换「劳字木片」。
  //   于是营中一日有了预算：干得越多，越须按时回牢销名、去伙房换饭、寻处歇息。
  function laborTick(label){
    // v20260917c：劳作一次＝半个时辰（60 分钟）＋4 点精力，
    //   从前点一下就「已经干完了」。守卫照旧同步先过（不足则立刻提示、立刻返回 false），
    //   只有「干完的那一刻」被推迟到进度条走满之后 —— 用动作的时长去换那一行的分量感。
    if(!exert(label)) return false;
    if(state.energy<6){ log('〔力竭〕你两臂发颤，连锹都握不稳了——先寻处歇一歇（席地打盹 / 营门歇脚）。','warn'); return false; }
    busyAct(String(label||'劳役')+'·半个时辰', 1000, function(){
      state.energy=Math.max(0,state.energy-4);
      advanceMinutes(60);
      onbWork();
      renderStatus(); save(state);
    });
    return true;
  }
  // 记 1 工分（v20260920h 自 laborTick 抽出）：满 LABOR_PER_WOOD 工发一枚「劳字木片」。
  //   供「担石卸料 / 农事操作（翻地、播种、浇水、收成）」等有实感的劳作共同调用——
  //   不再让「点一下按钮」凭空记工。
  function onbWork(){
    var o=onbF();
    if(!o || !o.started || o.done) return;
    o.workCnt=(o.workCnt||0)+1;
    if(o.workCnt % LABOR_PER_WOOD === 0){
      packAdd('lao_pai', 1);
      log('〔记工〕狱卒验过你的石方，掷来一枚「劳字木片」。','good');
      // 「头一回挣到实物」的提示（v20260911k 起；v20260912f 调整）：
      //   「行囊是什么」已在开篇牢房里教过，此处不再重复讲解，只做个「东西进了哪儿」的确认，
      //   顺手把行囊页签再亮一记（让刚学会的页签立刻派上用场），并给点小甜头。
      if(!o.bagSeen){
        o.bagSeen=true;
        onbReveal('dock');
        packAdd('fan', 1);
        log('狱卒今日心情不坏，又扔来半张干粮：「拿着，别死在头一天。」','good');
        log('〔入囊〕木片与干粮都收进了行囊——点下方「🎒 行囊」可查看、装备与使用。','sys');
        try{ if(LF.Guide && LF.Guide.ping) LF.Guide.ping({dock:'pack'}); }catch(e){}
        toast('行囊里多了东西');
      }
      afterPackChange();
    } else {
      log('〔记工〕工分 '+o.workCnt+'/'+LABOR_PER_WOOD+'——干满 '+LABOR_PER_WOOD+' 工换一枚劳字木片。','sys');
    }
    renderStatus(); save(state);
  }
  // ═══ 担石搬运闭环（v20260920h）：场院乱石堆「装担」→ 负重 → 仓库卸料台「卸料入仓」记一工 ═══
  //   从前「点一下担石劳作」凭空记工，如今一担石真要人扛过去——装担、卸料两段操作 + 跨格搬运，
  //   负重时腾不开手（stoneCarrying 判定拦在劳作入口，防连点刷工分）。
  function stoneCarrying(){ var f=state.flags||{}, t=f.task||{}; return !!t.stoneCarrying; }
  function stoneLoad(){
    if(stoneCarrying()){ toast('肩上已压着一担石料——先送去仓库「卸料台」卸下。'); return; }
    if(!exert('装起一担乱石')) return;
    if(state.energy<6){ log('〔力竭〕你两臂发颤，连扁担都扛不稳了——先寻处歇一歇。','warn'); return; }
    busyAct('装担·半个时辰', 1000, function(){
      state.energy=Math.max(0,state.energy-4);
      advanceMinutes(60);
      state.flags.task.stoneCarrying=true;
      log('你把乱石码进藤筐，扁担压上肩头——身上多了一担石。送去仓库那格「卸料台」卸下，才算记一工。','good');
      save(state); renderStatus(); buildActions(curRoom());
    });
  }
  function stoneUnload(){
    if(!stoneCarrying()){ toast('肩上没有石担——先去场院「乱石堆」装一担。'); return; }
    if(!exert('卸料入仓')) return;
    busyAct('卸料·半个时辰', 1000, function(){
      state.energy=Math.max(0,state.energy-4);
      advanceMinutes(60);
      state.flags.task.stoneCarrying=false;
      packAdd('shitiao',2);
      var o=onbF();
      if(o && o.started && !o.done && !o.labored) o.labored=true;   // 教学：卸下第一担即算「熟悉苦役」
      onbWork();   // 记 1 工分（满 3 工发木片）
      log('你把石料卸进仓角，掸掸肩头的灰——得「石料」×2 入囊。','good');
      afterPackChange(); save(state); renderStatus(); buildActions(curRoom());
    });
  }
  // 营中苦役 → 任务进度（v20260911i 立，v20260914e 撤）。
  //   原写法：点一下格上的劳作按钮就在 flags.task.<key>_cnt 上 +1，任务据此显示 N/3。
  //   撤掉的缘由：差役改成「赴实地做工 → 交货」后，计数改由「交出去多少」来记（给予面板 → onGive 累计），
  //   否则玩家在农田格点三下「下地务农」就能把「开垦薄田」交了差 —— 开垦与掐菜全被绕过去。
  //   现在这三个按钮（担石/务农/搬石）只挣工分（laborTick），与差役彻底脱钩。

  // ===== 时间与生存消耗 =====
  // v20260917b：分钟制时间推进（方案A落地）。
  //   旧版 advanceTime(n) 只吃整时辰，任何动作都是一跳 120 分钟，时钟永远整点、一天干不了几件事。
  //   新版 advanceMinutes(min) 按分钟推进：跨满 120 分钟（1 时辰）才进位 state.time，
  //   于是城内移动 10 分钟/格、劳作 30 分钟/次、郊野 30 分钟/格都能落进同一套钟里；
  //   营规（应卯/销名/查房窗口）全部按整时辰判定，完全不受影响。
  //   生存消耗按「跨辰步进」扣（每跨一辰 -1 食 -1 水 -2 精力），速率与旧版完全一致。
  function advanceTime(n){
    n=n||1;
    if(!clockFlowing()) return;
    advanceMinutes(n*120);          // 休息等整时辰动作委托分钟制（1 时辰=120 分钟）
  }
  function advanceMinutes(min){
    if(!state) return;
    min = Math.max(0, (min|0)||0);
    if(!clockFlowing()) return;     // 教学期「时辰未启」→ 时间一律冻结（同旧版）
    var before = state.clock || 0;
    var raw = before + min;
    var crossings = Math.floor(raw/1440);                       // 跨子夜次数 = 经过的天数
    // 时辰边界换算：0 点 = 子时中段（子时=23:00-01:00，横跨午夜），故时辰下标 = floor((clock+60)/120) % 12
    //   （卯时自 clock=300 起、辰时自 420 起……）。此换算非单调（子时跨午夜时从 12 跳回 0），
    //   故跨辰数 = 模后差值，为负（逆跨午夜）则 +12 归正；直接用 floor(clock/120) 或单调差值都会漏进位。
    function _hourIdx(_c){ return Math.floor((_c+60)/120) % 12; }
    var crossedHours = _hourIdx(raw) - _hourIdx(before);
    if(crossedHours < 0) crossedHours += 12;
    state.time = (state.time + crossedHours) % 12;
    state.clock = raw % 1440;                                   // 每时辰 = 120 游戏分钟
    autoOnbRoutines();                       // 卯辰自动应卯 / 戌时自动销名（简化新手流程）
    applyTimeRoutines();                     // 时辰推移 → 驱动 NPC 作息流动（全城通用）
    for(var i=0;i<crossedHours;i++){         // 生存消耗：每跨一辰扣一次（与旧版速率一致）
      state.food=Math.max(0,(state.food||0)-1);
      state.drink=Math.max(0,(state.drink||0)-1);
      state.energy=Math.max(0,(state.energy||0)-2);
    }
    maybeStarve();
    if(crossings>0){
      onbDayTick(crossings);                 // 营中「一日」结算：点卯 / 旷役（v20260911h · P3）
      state.day=(state.day||0)+crossings;
      syncCalendar();                        // 跨日 → 农历月日 / 年号年序随之推进
      if(Math.random()<0.55) state.weather=Math.floor(Math.random()*WEATHERS.length); // 新日易天候
      warlordDayTick(crossings);             // 群雄逐鹿：NPC 势力自动攻伐（v20260909o）
      tickArmyDay(crossings);                // 军务：行军推进 + 军粮消耗 + 断粮掉士气（v20260921a）
      tryAmbush();                           // 设伏：郊野候敌，敌至则先手（v20260921a）
    }
      // 朔日结算（v20260918g）：跨月 → 治下纳赋 + 群雄内政 + 势力存亡 + 统一终局（叠在耗时辰模型上）
      var _cal = deriveCalendar();
      var _mk = _cal.adYear * 12 + _cal.month;
      var _newMonth = (state.flags._monthKey != null && _mk !== state.flags._monthKey);
      state.flags._monthKey = _mk;   // 先写入新月键：朔日结算内的外交到期清算须用新值（否则盟约多生效一个月）
      if (_newMonth) onMonthTick(_cal);
    tickForge(crossedHours);   // 炉膛随时辰持续推进（未跨辰不动，避免 0.25 时辰的小数进度）
    tickBuildOrders(crossings);   // 城市营造工单：跨日推进宏观委派 + 结算每日市租（第3步）
    // 查房（v20260911i）：此刻若已过戌时又在营中游荡，巡夜狱卒便来拿人。
    //   动作自身的文案正在打字，故走 requestCurfewPatrol（记「待评」+ 叙事收尾后由 syncActionLock 续评）。
    curfewWarn();
    rollWarn();        // v20260916h：卯时应卯提醒（对称酉时预警）
    requestCurfewPatrol();
  }
  // 酉时入夜预警（v20260916a）：劳作/赶路推进时辰后若到酉时且仍在营中，先提醒一句
  //   「戌时落锁」——把「天黑会被抓」的悬念提前给玩家，而不是等巡夜灯笼怼脸。
  function curfewWarn(){
    if(!onbBound()) return;              // 已脱籍 / 营规未立：不必提醒
    if(state.time!==9) return;           // 酉时（十二时辰下标 9）才是预警窗口
    if(!inCampNow()) return;
    var o=onbF();
    if(o.curfewWarnDay===state.day) return;   // 当日只提醒一次
    o.curfewWarnDay=state.day;
    log('〔天色将晚〕酉时过半，日头西沉——戌时营门落锁，记得回牢房销名。','warn');
  }
  // 卯时应卯提醒（v20260916h，对称酉时预警）：卯时一到若还没应名，先提一句——
  //   「应卯」窗口虽是卯至午四个时辰，但多数玩家头几天根本不知道时辰这回事，先亮个路标。
  function rollWarn(){
    if(!onbBound()) return;
    if(state.time!==3) return;              // 卯时（十二时辰下标 3）是应卯窗口开头
    if(!inCampNow()) return;
    var o=onbF();
    if(o.rollWarnDay===state.day) return;   // 当日只提醒一次
    o.rollWarnDay=state.day;
    log('〔天色将明〕卯时了，牢头在中军场院点名——记得去应一声，过午不候。','warn');
  }
  // 由累计天数回写年号年序 + 年号名（年号随公元年自动切换：184→中平，杜绝 184 仍显「光和」）
  function syncCalendar(){
    var c=deriveCalendar();
    state.eraName=c.eraName; state.eraYear=c.eraYear; state.adYear=c.adYear;
  }
  // 饥饿过高：食物/饮水耗尽则持续侵蚀气血（硬性限制）；归零即殒落
  function maybeStarve(){
    var dmg=0, msgs=[];
    if(state.food<=0){ dmg+=6; msgs.push('腹中空虚'); }
    if(state.drink<=0){ dmg+=4; msgs.push('喉间干涸'); }
    if(dmg>0){
      state.hp=Math.max(0,state.hp-dmg);
      log('〔饥馁〕'+msgs.join('，')+'，气血-'+dmg+'。','combat');
      checkDeath();
    }
  }
  // 死亡：气血归零 → 回标题屏（读档/重开）
  function checkDeath(){ if(state && !state.dead && state.hp<=0){ die(); } }
  function die(){
    state.dead=true;   // 不落盘（save 对 hp<=0 跳过），回标题屏读档即回到死前存档
    busyCancel();      // 万一死在耗时动作的半途：锁与计时器一并收起（v20260914a 摘锁；v20260914b 补掐计时器，免死后回调落定）
    $modal.classList.remove('hidden');
    // v20260914a：把「死前状态已自动留存」这件事说明白，并让「读档续命」成为首选那一步。
    //   死亡本来就不落盘（save 遇 hp<=0 直接跳过），所以读档必定回到死前那一刻、分毫不损；
    //   旧版却要玩家先「回首頁」、再自己去档位里找回来，白白吓一跳。
    $card.innerHTML='<h3 style="color:#8a3b2e">⚔ 殒 落</h3>'+
      '<p class="tip">气血已枯，魂归尘土——乱世如炉，谁记你姓名？</p>'+
      (curSlot
        ? '<p class="tip" style="margin-top:-4px;">倒下前的光景已自动留在卷中，拾卷即回身死之前，分毫无损。</p>'+
          '<button class="close" id="m-load" style="background:linear-gradient(180deg,#fbf6ea,#ece0c6);color:#3a2d1a;border-color:#b8893a;font-weight:700;">读 档 续 命 · 回 到 死 前</button>'+
          '<button class="close" id="m-home" style="background:rgba(120,60,50,.12);color:#8a3b2e;margin-top:10px;">回 首 页</button>'
        : '<p class="tip" style="margin-top:-4px;">此局尚未落于卷中，只能回首页重开。</p>'+
          '<button class="close" id="m-home">回 首 页</button>');
    var hm=document.getElementById('m-home'); if(hm)hm.onclick=function(){ closeModal(); showTitle(); };
    var ld=document.getElementById('m-load'); if(ld)ld.onclick=function(){ closeModal(); enterGame(rawSlot(curSlot), curSlot); };
  }
  // ===== 标题屏与子面板 =====
  function showTitle(){
    // 离局（殒落 / 回首頁）时把「耗时动作进行中」那把锁摘掉：
    //   否则回到标题再择档进局，interactBusy() 一直为真 → 全屏按钮点不动（v20260914a）
    // v20260914b：连计时器一并掐掉 —— 只摘锁的话，走满时 done() 仍会在 state=null 上跑，
    //   读 state.flags 抛 TypeError（详见 busyCancel）。
    busyCancel();
    state=null; curSlot=0; Core.state=state; Core.curSlot=curSlot;
    var app=document.getElementById('app'); if(app) app.classList.add('hidden');
    var tt=document.getElementById('title'); if(tt){ tt.classList.remove('hidden'); tt.classList.remove('frozen'); }
    applyTitleFx();
    if(window.startTitleDrip) window.startTitleDrip();   // 回标题页（殒落/清档/启动）重启墨滴；进局后已由 drip() 可见性判断停掉
  }
  // 标题特效开关：关则隐藏水墨烟尘/墨晕层
  function applyTitleFx(){
    var tt=document.getElementById('title');
    if(tt) tt.classList.toggle('no-fx', settings.titleFx===false);
  }
  // 互动提示音（音效开时）
  var _actx=null;
  function tick(freq){
    if(!settings.sound) return;
    try{
      _actx=_actx||new (window.AudioContext||window.webkitAudioContext)();
      var o=_actx.createOscillator(), g=_actx.createGain();
      o.type='sine'; o.frequency.value=freq||540;
      o.connect(g); g.connect(_actx.destination);
      g.gain.setValueAtTime(.07,_actx.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001,_actx.currentTime+.12);
      o.start(); o.stop(_actx.currentTime+.13);
    }catch(e){}
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  // 择档面板（mode: 'new'=开新局 / 'load'=读旧档）
  function renderSlotsHTML(mode){
    var title = mode==='new' ? '仗 剑 入 世 · 择 卷' : '拾 卷 续 缘 · 择 档';
    var intro = mode==='new'
      ? '择一空卷落笔；若卷中已有旧事，将覆而新写。'
      : '择一卷展读，续那未竟之缘。空卷不可读。';
    var rows='';
    for(var i=1;i<=3;i++){
      var m=slotMeta(i);
      var confirmHTML = (mode==='new' && !m.empty)
        ? '<div class="sl-confirm">'+
            '<p>第 '+i+' 卷已有旧事，覆而新写？</p>'+
            '<div class="sl-actions">'+
              '<button class="sl-yes" data-action="overwrite" data-slot="'+i+'">覆 写</button>'+
              '<button data-action="cancel" data-slot="'+i+'">再 想 想</button>'+
            '</div>'+
          '</div>'
        : '';
      if(m.empty){
        rows+='<div class="slot" data-slot="'+i+'" data-mode="'+mode+'">'+
          '<div class="sl-body">'+
          '<div class="sl-top"><span class="sl-empty">第 '+i+' 卷 · 空</span></div>'+
          '<div class="sl-meta">尚未落墨。</div></div>'+confirmHTML+'</div>';
      } else {
        rows+='<div class="slot" data-slot="'+i+'" data-mode="'+mode+'">'+
          '<div class="sl-body">'+
          '<div class="sl-top"><span class="sl-name">第 '+i+' 卷 · '+escapeHtml(m.name)+'</span>'+
          '<span class="sl-sect">'+m.rep+' 声名</span></div>'+
          '<div class="sl-meta">'+m.sect+' · '+escapeHtml(m.room)+' · '+m.time+'</div>'+
          '<div class="sl-sect">历 '+m.day+' 日</div></div>'+confirmHTML+'</div>';
      }
    }
    return '<h3>'+title+'</h3><p class="tip">'+intro+'</p><div class="slot-row">'+rows+'</div>';
  }
  // [moved -> shared/core/panels.js]
  // [moved -> shared/core/panels.js]
  // [moved -> shared/core/panels.js]
// [moved -> shared/core/quest.js]
  function bindTitle(){
    var tv=document.getElementById('tt-ver'); if(tv) tv.textContent='v'+LF.CONSTANTS.VERSION;
    var ts=document.getElementById('t-start'); if(ts) ts.onclick=function(){ openModal('newgame'); };
    var tl=document.getElementById('t-load'); if(tl) tl.onclick=function(){ openModal('load'); };
    var tc=document.getElementById('t-codex'); if(tc) tc.onclick=function(){ openModal('codex'); };
    var tset=document.getElementById('t-set'); if(tset) tset.onclick=function(){ openModal('settings',{fromTitle:true}); };
    var tcr=document.getElementById('t-credit'); if(tcr) tcr.onclick=function(){ openModal('credit'); };
  }
  // 体力亏空：精力耗尽则无法行动（硬性限制）
  function exert(label){
    if(state.energy<=0){
      log('〔精力耗尽〕你四肢酸软，难以为继——须先「帐中休整」恢复精力，方可'+label+'。','sys');
      return false;
    }
    return true;
  }

  // ===== 动态按钮区（分组菜单：对话 / 探查 / 行动 / 移动） =====
  var lastGroup=null;
  function clearActions(){$actions.innerHTML='';lastGroup=null;collapseObjPanel();}
  function addBtn(label, fn, cls){
    var b=document.createElement('button');
    b.className='act '+(cls||''); b.textContent=label;
    b.onclick=fn; $actions.appendChild(b);
  }
  function prependActsLabel(){
    var l=document.createElement('div'); l.className='acts-label';
    l.textContent='· 可 行 之 事 ·'; $actions.appendChild(l);
  }
  // 点击弹出的操作面板：详情 + 选项 + 告辞（始终可退回菜单）
  function openSheet(o){
    if(state.dead){ die(); return; }
    o=o||{};
    var acts=o.actions||[];
    var h='<h3 style="display:flex;align-items:center;justify-content:center;gap:8px;">'+
          (o.icon?'<span style="font-size:22px;line-height:1;">'+o.icon+'</span>':'')+
          '<span>'+ (o.title||'') +'</span></h3>';
    if(o.desc) h+='<p class="tip" style="text-align:center;font-size:14px;margin:2px 0 0;">'+o.desc+'</p>';
    if(acts.length){
      h+='<div class="sheet-btns">';
      acts.forEach(function(a,i){ h+='<button class="sheet-btn'+(a.danger?' danger':'')+'" data-i="'+i+'">'+ (a.label||'') +'</button>'; });
      h+='</div>';
    }
    h+='<button class="sheet-leave" id="m-leave">告 辞</button>';
    $card.innerHTML=h;
    $modal.classList.remove('hidden');
    $card.querySelectorAll('.sheet-btn').forEach(function(btn){
      btn.onclick=function(){ closeModal(); var a=acts[+btn.getAttribute('data-i')]; if(a&&a.fn) a.fn(); };
    });
    var lv=document.getElementById('m-leave'); if(lv) lv.onclick=closeModal;
  }
  function addGrouped(group,label,fn,tip){
    if(group!==lastGroup){
      var t=document.createElement('div'); t.className='grp'; t.textContent='— '+group+' —';
      $actions.appendChild(t); lastGroup=group;
    }
    var b=document.createElement('button'); b.className='act'; b.textContent=label;
    if(tip){
      b.onclick=function(){ openSheet({title:label, desc:tip, actions:[{label:'执 行', fn:fn}]}); };
    } else {
      b.onclick=fn;
    }
    $actions.appendChild(b);
  }

  // ===== 房间渲染 =====
  var explored=false;        // 当前房间是否已探查（调查四周后解锁「去处」）
  // 场景入场描述精简：只保留首句、超过 28 字截断，完整描述留给「探查/环顾」播放
  function shortScene(t){
    t=(t||'').trim(); if(!t) return t;
    var m=t.match(/^[\s\S]{0,28}?[。！？]/);
    if(m) return m[0];
    return t.length>30 ? t.slice(0,29)+'…' : t;
  }
  function renderRoom(rid, silent){
    var room=G.ROOMS[rid]||bldRoom(rid); if(!room) return;
    invalidateScene();            // 新场景：使任何残留的旧叙事序列失效
    dlgClose();                  // 换场景即收对话窗（v20260912g）：上一位的话，说完就到此为止
    state.room=rid;
    if(isCityGrid(rid)){
      var __m=genCityGrid(rid);
      if(!state.flags.cityPos || state.flags.cityPos.cid!==rid){
        // 进城先到城门（v20260905k：按路网自适应开着的城门依次取可通行格，兜底城心）
        var __c=Math.floor(__m.size/2), __s=__m.size-1;
        var __gates=[];
        (cityGateDirs(rid)||[]).forEach(function(_d){
          var _gc=gateCellCoord(rid,_d); if(_gc) __gates.push(_gc);
        });
        if(!__gates.length) __gates=[[__c,0],[0,__c],[__s,__c],[__c,__s]];
        __gates.push([__c,__c]);
        var __g=__gates[0];
        for(var __gi=0;__gi<__gates.length;__gi++){
          if(canEnterCell(rid,__gates[__gi][0],__gates[__gi][1])){ __g=__gates[__gi]; break; }
        }
        state.flags.cityPos={cid:rid, x:__g[0], y:__g[1]};
      }
    }
    // v20260910q：囚室格 (1,0) 不再跳独立房间——牢房即城格，面板显示六间子牢房(doors)，罗盘走网格邻居
    var onboarding = !!(state.flags && state.flags.onb && !state.flags.onb.done);
    // 开场引导期间静默这些房间的常规旁白（改用剧本式叙事，避免与触发台词重复/信息过载）
    var suppressNarr = onboarding && (rid==='kuyilao' || /^camp_[td]z\d$/.test(rid));
    if(dqCardEl){ if(dqCardEl.parentNode) dqCardEl.parentNode.removeChild(dqCardEl); dqCardEl=null; }
    explored = !!(state.exploredRooms && state.exploredRooms[rid]);
    var narr=[];
    if(!silent && !suppressNarr){
      // 城市系统：进城先报城郭概况（人口/治安/商业，数据 shared/data/cities.js）
      var cityLineTxt=cityLine(rid);
      if(cityLineTxt) narr.push({t:cityLineTxt, c:'sys'});
      room.desc.forEach(function(d){ narr.push({t:shortScene(d), c:'env'}); });
      if(isCityGrid(rid) && state.flags.cityPos){
        var _cn=cellNarr(rid, state.flags.cityPos.x, state.flags.cityPos.y);
        if(_cn) _cn.forEach(function(d){ narr.push({t:shortScene(d), c:'env'}); });
      }
      if(room.items && room.items.length){
        narr.push({t:'〔地上之物〕', c:'sys'});
        room.items.forEach(function(it){ narr.push({t:'· '+it, c:'item'}); });
      }
      // v20260911f：取消「进场即罗列各出口」的旁白（〔出口〕南·... / 东·...）——过于冗长且与罗盘按钮重复。
      // 可走方向一律以底部罗盘按钮 + 山河志呈现，不再逐条播报。
      // 郊野：资源/野兽/路人。v20260914a：走 fieldNarrFresh —— 同一格反复进出时，
      //   〔途〕〔地利〕这类地貌情报不再每次重念一遍（详见 fieldNarrFresh）。
      if(room.isField) narr = narr.concat(fieldNarrFresh(room, rid));
      // 新房间自动探查：标记已探索，出口立即可用。
      // 不再于进场时自动播 find，避免开场信息过载；场景细节交由「环顾四周 / 探查」在玩家主动行动时揭示。
      if(!explored){
        explored=true;
        if(!state.exploredRooms) state.exploredRooms={};
        state.exploredRooms[rid]=true;
        save(state);
      }
    }
    renderLocTab(room);
    buildActions(room);
    syncActionLock();            // 锁定新生成的房间按钮，待本场叙事播完再解锁
    save(state); renderStatus();
    // 叙事逐行串行播放（按钮已先就绪，文字依次刷出，不再同时眼花）
    logScene(narr, 150, function(){
      // 教学链：进入房间后触发对应引导（如燕山山口逃脱）
      onbRoomEnter(room);
      onbGoal();   // 进入新房间后刷新「当前目标」高亮（NPC/动作按钮已就绪）
      renderMoveBar(G.ROOMS[state.room]||bldRoom(state.room));   // 门禁（moveGate）更新后重渲移动条；城内格子由 currentRoomExits 提供方向
      // 巡逻山道遇敌提示延后到叙事结束，先看完场景再遇敌
      if(room.patrol && !silent && !onboarding) maybeAmbush(room);
      if(room.isField && !onboarding) maybeFieldAmbush(room);   // 郊野：主动野怪拦路
    });
    // 进城过场（v20260924z8）：进入大城市瞬间全屏水墨晕开 + 城名浮现；小房间/村庄不播
    if(!silent && cityProfile(rid) && FX_PREV_ROOM!==rid){
      FX_PREV_ROOM=rid;
      var _cn=(LF.CITIES && LF.CITIES[rid] && LF.CITIES[rid].name) || rid;
      try{ playCityFX(_cn); }catch(e){}
    }
  }
  var FX_PREV_ROOM='', FX_LAST_AT=0;
  function playCityFX(name){
    var now=Date.now();
    if(now-FX_LAST_AT < 3500) return;   // 防抖：短时间内反复渲染不重复播
    FX_LAST_AT=now;
    var d=document.createElement('div');
    d.id='cityfx';
    d.innerHTML='<div class="cfx-name">'+name+'</div><div class="cfx-line"></div>';
    (document.body||document.documentElement).appendChild(d);
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 1900);
  }
  // 巡山埋伏：进入巡逻山道有概率遇敌（山贼 / 流寇）
  function maybeAmbush(room){
    if(state.defeated) return;
    var r=Math.random();
    if(r < 0.18){
      // 群战：两名同伙包抄（验证多敌/AOE 路径）
      var pair = Math.random()<0.6 ? ['bandit','bandit'] : ['yellow_turban','yellow_turban'];
      var label = pair[0]==='bandit' ? '山贼' : '流寇';
      log('〔警觉〕林间杀声四起，两名'+label+'自两侧包抄，拦住去路！','combat');
      startCombat(pair);
    } else if(r < 0.5){
      var enemy = Math.random()<0.6 ? 'bandit' : 'yellow_turban';
      log('〔警觉〕林间树影倏动，一伙'+(enemy==='bandit'?'山贼':'流寇')+'自草莽中杀出，拦住去路！','combat');
      startCombat(enemy);
    } else {
      log('这一程山道尚算平静，只闻松涛与远鸟。你按刀而行，未遇拦路之敌。','sys');
    }
  }
  // ===== 场景对象配置：每个房间的可交互元素（人物/建筑/家具/出口） =====
  var ROOM_OBJECTS = (LF.buildRoomObjects ? LF.buildRoomObjects() : {});

  // 研习武学仅限特定房间（主营/郡学宫）
  var LEARN_ROOMS={};
  function roomCanLearn(rid){ return !!LEARN_ROOMS[rid]; }

  // ===== 城市系统：数据驱动派生（数据 shared/data/cities.js） =====
  // 进入城市房间时按人口/治安/商业参数生成城郭概况、人物与可行动作，免去为每城手写房间
  // [moved -> shared/core/panels.js]
  // 城中可做之事：城况一览已归山河图（点城池即看），城市视图不再常驻该钮；仅留「兴修城垣」
  function cityActs(cid){
    var p=cityProfile(cid); if(!p) return [];
    var out=[];
    // 兴修城垣属「施工队 / 建造营房」类建筑之责，苦役营（营区中枢）不挂此钮（归城池自身营造系统）
    if(cid!=='kuyilao') out.push({id:'city_upgrade', label:'兴修城垣', icon:'🧱', tip:'拓建城池，提升城市等级（耗砖石木）'});
    return out;
  }
  function tryUpgradeCity(cid){
    ensureCityState(cid);
    var lv=state.flags.cityLevel[cid];
    if(lv>=CITY_LV_SIZE.length-1){ toast((CITY_LV_NAME[lv]||'城')+'已至极制，无可再升。'); return; }
    var RES_NM={'zhuan':'砖','shitiao':'石料','mucai':'木材'};
    var need={zhuan:Math.round(40*(lv+1)), shitiao:Math.round(25*(lv+1)), mucai:Math.round(15*(lv+1))};
    var miss=[];
    for(var k in need){ if((packFind(k)||0) < need[k]) miss.push((RES_NM[k]||k)+'×'+need[k]); }
    if(miss.length){ toast('拓建城垣所需材料不足：'+miss.join('、')+'。'); return; }
    for(var k2 in need){ packConsume(k2, need[k2]); }
    state.flags.cityLevel[cid]=lv+1;
    afterPackChange();
    log('夯土累石，城垣拓建——'+(CITY_LV_NAME[lv+1]||'城')+'初成，新坊市渐辟（建设度 '+cityDevOf(cid)+'）。','sys');
    if(state.room===cid) renderRoom(cid,true);
    openModal('citystat',{cid:cid});
  }
  // 降级（战争/政变/匪患）：城市等级 -1，触发流亡（越界建筑清理由 cityCells 覆盖层在第3步启用）
  function downgradeCity(cid){
    ensureCityState(cid);
    var lv=state.flags.cityLevel[cid];
    if(lv<=0) return;
    state.flags.cityLevel[cid]=lv-1;
    log((CITY_LV_NAME[lv]||'城')+'遭劫，城垣崩颓，降为'+(CITY_LV_NAME[lv-1]||'城')+'，民户流散。','sys');
  }
  // ══ 城市营造（第3步：微观现场建造，BuildOrder 驱动）══
  // 现场「营造」→ 择蓝图开工 → 逐阶段投料 + 营造(exert) → 落成写 cityCells 覆盖层
  var cityBuildState={cid:null,x:null,y:null};
  function cityCellSiteName(cid,x,y){
    var inst=cityCellInst(cid,x,y);
    if(inst && inst.buildOrderId){ var o=buildOrderById(inst.buildOrderId); if(o){ var bp=LF.BUILD[o.blueprintId]||{}; return bp.siteName||'工地'; } }
    return '工地';
  }
  // ══ 战略层 · 玩家职种分化（v20260918h）══
  var ROLE_DEFS = (LF.ROLE_DEFS || {
    youxia:{key:'youxia',name:'游侠',icon:'🗡',atkMul:1.0,econMul:1.0,favorMul:1.2,note:'江湖散人，进退由心'},
    jiang:{key:'jiang',name:'将才',icon:'⚔',atkMul:1.25,econMul:1.0,favorMul:1.0,note:'攻城野战如虎添翼'},
    xiang:{key:'xiang',name:'相才',icon:'📜',atkMul:1.0,econMul:1.35,favorMul:1.1,note:'府库殷实、民力倍增'}
  });
  function roleDef(){ return ROLE_DEFS[(state&&state.role)||'youxia'] || ROLE_DEFS.youxia; }
  function roleAtkMul(){ return roleDef().atkMul || 1; }
  function roleEconMul(){ return roleDef().econMul || 1; }
  function roleFavorMul(){ return roleDef().favorMul || 1; }
  // ===== 山河图 · 城内网格视图（v20260824b）=====
  // 仅作城郭总览展示（地图不再承担移动职责），移动统一走下方方向键
  function buildActions(room, popExits){
    if(!room) room=curRoom();
    clearActions();
    grpCursor=null;
    renderNpcList(room);   // 左侧 NPC 列表（配置房间与兼容房间统一渲染，避免与下方按钮重复）
    // 战败封锁：仅可「席地打盹」恢复，场景其余按钮全部隐藏
    if(state.defeated){
      log('〔力竭〕你重伤未愈，动弹不得——就地打盹歇息，方能续战。','sys');
      var b=mkAct('scene','🧱','席地打盹',function(){ openRestModal('ground'); });
      return;
    }
    // 建筑内部房间：场景物件（含子区域/返回出口）按按钮呈现，无方向罗盘
    if(isBldRoom(room.id)){
      var _bobjs=roomObjs(room.id);
      if(_bobjs && _bobjs.length) _bobjs.forEach(function(o){
        var _acts=(typeof o.actions==='function'? o.actions(): (o.actions||[]));
        var _btn=mkAct('scene', o.icon, o.name, function(e){
          // 出入口单击直达；其余物件展开浮动菜单
          if(o.direct && _acts.length){ _acts[0].fn(); return; }
          toggleObjExpand(e, _btn, o, _acts);
        }, null, o.key);
      });
      renderSelf(room);
      return;
    }
    // 郊野房间：采集 / 挑战 / 交谈（移动仍走底部罗盘）
    if(room.isField){
      fieldActions(room);
      if(room.exits && Object.keys(room.exits).length) renderMoveBar(room);
      renderSelf(room);
      return;
    }
    // 城市网格：当前格动作派生（取代旧出口/对象按钮）；移动改由底部方向键（currentRoomExits）负责
    if(isCityGrid(room.id)){
      var _cp=state.flags.cityPos;
      renderCellInteriors(room.id, (_cp?_cp.x:0), (_cp?_cp.y:0));
      cityCellActs(room.id, (_cp?_cp.x:0), (_cp?_cp.y:0)).forEach(function(a){
        var acts=[{label:'执 行', fn:function(){ handleAction(a.id,a); }}];
        var btn=mkAct('scene', a.icon||'·', a.label, function(e){
          // 进入某处（进·店铺/进·建筑）意图明确，单击直达，不再套「执 行」菜单
          if(a.id==='enter_building'){ handleAction(a.id,a); return; }
          toggleObjExpand(e, btn, {name:a.label, desc:a.tip}, acts);
        }, null, a.id);
      });
      // 城市级动作并入场景——非网格城在下方 cityActs 分支渲染，此处补回以免网格城缺漏；
      // 意图明确，单击直达，不再套「执 行」菜单
      cityActs(room.id).forEach(function(a){
        if(a.id!=='city_upgrade') return;
        mkAct('scene', a.icon||'·', a.label, function(e){ handleAction(a.id, a); }, null, a.id);
      });
      // 玩家在城内营造的建筑 / 放置的设备，作为场景物件一并展示（按房间整体存储，城内各处皆可寻得）
      var pobjs=roomObjs(room.id, {placedOnly:true});
      if(pobjs.length) renderObjs(pobjs, 'scene');
      return;
    }
    // 城市系统：派生可做之事（城况一览）——对配置城市与占位州治均生效
    cityActs(room.id).forEach(function(a){
      var acts=[{label:'执 行', fn:function(){ handleAction(a.id,a); }}];
      var btn=mkAct('scene','·',a.label,function(e){ toggleObjExpand(e, btn, {name:a.label, desc:a.tip}, acts); }, null, a.id);
    });
    var objs=roomObjs(room.id);
    if(objs && objs.length){
      renderObjs(objs.filter(function(o){return o.type==='feature' && o.key!=='env' && o.key!=='learn';}), 'scene');
      var exitsObjs=objs.filter(function(o){return o.type==='exit';});
      if(exitsObjs.length){
        // 有出口：日常移动交由 Dock 上方常驻移动条
        renderMoveBar(room);
      }
      renderSelf(room);
      return;
    }
    // fallback：旧版分组按钮（兼容无配置的房间；探查已由 dock 接管）
    (room.actions||[]).forEach(function(a){
      var acts=[{label:'执 行', fn:function(){ handleAction(a.id,a); }}];
      var btn=mkAct('scene','·',a.label,function(e){ toggleObjExpand(e, btn, {name:a.label, desc:a.tip}, acts); }, null, a.id);
    });
    if(room.exits && Object.keys(room.exits).length){
      // 有出口：日常移动交由 Dock 上方常驻移动条
      renderMoveBar(room);
    }
    renderSelf(room);
  }
  // ===== 左侧 NPC 列表（地图左侧，点击弹出菜单）=====
  // ===== NPC 时辰作息：按 LF.NPC_ROUTINES 在房间间挪动（教程 / 全城 / 任意地点通用）=====
  // 数据表：LF.NPC_ROUTINES = { 角色key: { <时辰索引 0-11>: 房间id | [房间id...], _home: 房间id } }
  //   · 时辰索引 = state.time % 12（0子 1丑 2寅 3卯 4辰 5巳 6午 7未 8申 9酉 10戌 11亥）
  //   · 目标房可为：手写锚点房（camp_* 等）、程序生成的地点房（gen/rooms.js 注入 G.ROOMS 的城/镇/关/副本）、
  //     或城市根房（registerCityRooms 注入的 G.ROOMS[cid] —— 落在城市根房上的角色在该城任一格都可见，
  //     适合更夫、货郎、巡卒这类「满城都可能撞见」的人）。
  //   · 未列出的时辰回 _home；目标房不存在则原地不动（安全退化，不会把角色塞进不存在的房）。
  // 调用点：renderNpcList（每次重绘左侧列表）+ advanceTime（每次时辰推进）→ 读档后也会立刻回到当前时辰该在的位置。
  // v20260911g 修复：旧版在内层循环里 `if(idx>=0){ if(rid===dest) break; splice }`，一旦先命中目标房就 break，
  //   导致「同一角色残留于更早遍历到的其它房」的旧副本清不掉（分身）。现改为「先扫全表撤走所有非目标房，再落位」，
  //   并支持一个时辰命中多个房间（值写成数组）。
  function applyTimeRoutines(){
    var R = (typeof LF !== 'undefined' && LF.NPC_ROUTINES) || null; if(!R || !state) return;
    var h = (state.time || 0) % 12;
    for (var id in R){
      var rule = R[id]; if(!rule) continue;
      var v = (rule[h] != null) ? rule[h] : rule._home;
      if(v == null || v === '') continue;
      var dests = (v instanceof Array) ? v : [v];
      // ① 先撤：把所有「非本次目标」的房间里的该角色清掉（避免分身）
      for (var rid in G.ROOMS){
        if(dests.indexOf(rid) >= 0) continue;
        var arr = G.ROOMS[rid].npcs; if(!arr) continue;
        var idx = arr.indexOf(id);
        if(idx >= 0) arr.splice(idx, 1);
      }
      // ② 再落：逐个目标房补位（去重）
      for (var d=0; d<dests.length; d++){
        var tgt = G.ROOMS[dests[d]];
        if(tgt && tgt.npcs && tgt.npcs.indexOf(id) < 0) tgt.npcs.push(id);
      }
    }
  }
  function renderNpcList(room){
    applyTimeRoutines();
    if(!room && state.room) room=G.ROOMS[state.room]||bldRoom(state.room);
    var box=document.getElementById('npc-list'); if(!box) return;
    box.innerHTML=''; box.classList.remove('has');
    var items=[];
    var seen={};   // 已在 ROOM_OBJECTS 中以 NPC 形式出现的 key，避免与 npcs 重复
    var rec=(state.flags && state.flags.recruited)||{};
    var objs=ROOM_OBJECTS[room.id];
    if(objs && objs.length){
      objs.filter(function(o){return o.type==='npc';}).forEach(function(o){
        if(rec[o.key]) return;         // 已入队的随从不再显示于场景
        seen[o.key]=1;
        items.push({o:o, acts:buildNpcActions(o)});
      });
    }
    // 合并房间 npcs：敌人型 → 可「挑战」；对话型 → 原交谈逻辑
    (room.npcs||[]).forEach(function(k){
      if(seen[k]) return;
      if(rec[k]) return;               // 已入队的随从不再显示
      var en = G.ENEMIES ? G.ENEMIES.get(k) : null;
      if(en){
        var o={name:en.name, icon:'⚔', key:k, desc:en.title||'来者不善'};
        items.push({o:o, acts:[{label:'挑战', icon:'⚔', danger:true, fn:function(){ startCombat(k); }}]});
      } else {
        var n=G.DIALOGUES.npcs[k]; if(!n) return;
        items.push({o:{name:n.name, icon:'👤', key:k, desc:n.name}, acts:buildNpcActions({name:n.name, key:k, desc:n.name})});
      }
    });
    // 建筑内部房间：以 interior/子区域 npcs 直接呈现（复用浮动菜单交互）
    if(isBldRoom(room.id)){
      var _bf=bldForRoom(room.id);
      if(_bf) (_bf.ar.npcs||[]).forEach(function(e,i){
        items.push({o:{name:e.name, icon:e.icon, key:'bldn_'+room.id+'_'+i, desc:e.desc}, acts:bldActsFilter(e.acts)});
      });
    }
    // 城市系统：按人口/治安/商业参数派生城中人物（数据 shared/data/cities.js）
    var cityExtras = cityCellNpcs(room.id, (state.flags.cityPos?state.flags.cityPos.x:0), (state.flags.cityPos?state.flags.cityPos.y:0));
    var enters=[];
    for(var ci=0; ci<cityExtras.length; ci++){
      var ce=cityExtras[ci];
      if(ce.enter){ enters.push(ce); continue; }   // 建筑入口单独渲染，不计入人物列表
      if(seen[ce.o.key]) continue;
      if(rec[ce.o.key]) continue;
      // 敌意角色（溃兵之流）不设「交谈」：直接用卡自带的「挑战」，免得既打又聊
      if(ce.o.hostile){ ce.acts = ce.acts || []; items.push(ce); continue; }
      // 城市NPC也走标准操作列（交谈/观察/给予/攻击），自定义动作追加在后
      var stdActs = buildNpcActions(ce.o);
      var customActs = (ce.acts||[]).filter(function(a){ return !/交谈|观察|给予|攻击/.test(a.label||''); });
      ce.acts = stdActs.concat(customActs);
      items.push(ce);
    }
    if(!items.length && !enters.length){ box.innerHTML='<div class="nl-empty">此处无人</div>'; return; }
    box.classList.add('has');
    box.classList.toggle('many', (items.length+enters.length)>=4);   // 人数多时加宽，避免太挤
    var hd=document.createElement('div'); hd.className='nl-hd'; hd.textContent='此处人物'; box.appendChild(hd);
    items.forEach(function(it){
      var chip=document.createElement('button'); chip.className='nl-item';
      // v20260924u：NPC 名称命中头像映射则显示圆形头像，否则回退图标
      var _ava = (window.UI_Icons && it.o.name) ? UI_Icons.avatar(it.o.name, it.o.role) : (it.o.icon||'👤');
      chip.innerHTML='<span class="nl-ic">'+_ava+'</span><span class="nl-nm">'+it.o.name+'</span>';
      if(it.o.key) chip.dataset.k=it.o.key;   // 供新手目标引导高亮定位
      chip.onclick=function(e){ toggleObjExpand(e, chip, it.o, it.acts); };
      box.appendChild(chip);
    });
    enters.forEach(function(it){
      var b=BUILDINGS[it.enter.building];
      var chip=document.createElement('button'); chip.className='nl-item nl-bld';
      // v20260924u：建筑入口换图（回退 emoji）
      var _ic=(b?b.icon:'🏠');
      var _pic=(window.UI_Icons)? UI_Icons.icon(_ic, b?b.name:it.enter.building) : _ic;
      chip.innerHTML='<span class="nl-ic">'+_pic+'</span><span class="nl-nm">'+(b?b.name:it.enter.building)+'</span>';
      chip.onclick=function(){ enterBldRoom(it.enter.building, {kind:'city', cid:state.room, x:(state.flags.cityPos?state.flags.cityPos.x:0), y:(state.flags.cityPos?state.flags.cityPos.y:0)}); };
      box.appendChild(chip);
    });
  }
  var grpCursor=null;
  function isSelfCare(a){
    return (a.label==='研习武学') || /休整|歇|栖|借宿|调息/.test(a.label||'');
  }
  // 通用分组按钮（带分组底色；自身加边框由 .g-self 控制）
  // actId（可选）：动作/物件的稳定语义锚点，写成 data-act 供通用指引系统（Guide.sel）定位高亮。
  //   此前只有「旧版分组按钮」这一条分支写了 data-act —— 而苦役营实际走的是城市网格分支，
  //   于是新手目标高亮的 #actions .act[data-act="labor_yard"] 永远匹配不到元素（见 §通用指引系统）。
  function mkAct(group, icon, name, fn, extraCls, actId){
    var b=document.createElement('button');
    b.className='act obj-btn g-'+group+(extraCls?(' '+extraCls):'');
    // v20260924u：场景按钮图标经 UI_Icons 换为 AI 小图（无映射回退 emoji）
    b.innerHTML='<span class="ob-ic">'+(window.UI_Icons?UI_Icons.icon(icon,name):(icon||'·'))+'</span><span class="ob-nm">'+name+'</span>';
    if(actId) b.dataset.act=actId;
    b.onclick=function(e){ fn(e); }; $actions.appendChild(b);
    return b;
  }
  function renderObjs(list, group){
    if(!list || !list.length) return;
    list.forEach(function(o){
      var acts=(typeof o.actions==='function'? o.actions(): (o.actions||[])).filter(function(a){return !isSelfCare(a);});
      var btn=mkAct(group, o.icon, o.name, function(e){ toggleObjExpand(e, btn, o, acts); }, null, o.key);
    });
  }
  // ═══ 城格内部：可进入子房间(doors) + 不可进入交互物(objects)（v20260910q 地图框架）═══
  // 通用规则：罗盘=大方位去别处；面板=当前地点内的 rooms/items；NPC 单列。
  // 放 engine.js 而非 city.js：city.js 的 helper 是 LF.createCity(ctx) 内部闭包，
  // 需 return + 别名块才能被 engine 看见；这套只 engine 用，全局最省事。
  var CELL_INTERIORS = {
    'kuyilao|1,0': {
      doors: [
        { label: '天字一号', icon: '🚪', target: 'camp_tz1', group: '天字牢房' },
        { label: '天字二号', icon: '🚪', target: 'camp_tz2', group: '天字牢房' },
        { label: '天字三号', icon: '🚪', target: 'camp_tz3', group: '天字牢房' },
        { label: '地字一号', icon: '🚪', target: 'camp_dz1', group: '地字牢房' },
        { label: '地字二号', icon: '🚪', target: 'camp_dz2', group: '地字牢房' },
        { label: '地字三号', icon: '🚪', target: 'camp_dz3', group: '地字牢房' }
      ],
      objects: [
        { icon:'🪣', label:'水槽', acts:[
          {label:'饮水', icon:'💧', fn:function(){ troughDrinkBy('kuyilao|1,0'); }},
          {label:'添水', icon:'🪣', fn:function(){ troughFillBy('kuyilao|1,0'); }},
          {label:'装水入袋', icon:'💧', fn:function(){ troughDrawToBag('kuyilao|1,0'); }}
        ]},
        { icon:'⏳', label:'铜壶漏刻', acts:[
          {label:'观漏', icon:'⏳', fn:function(){ loukeLook(); }}
        ]}
      ]
    },
    // 中军帐(1,1)：与牢房(1,0)对称，但只管「逃出去」那一摊。教学期只露记工册与刁斗两件，
    //   舆图 / 军报 / 兵器架 / 正帐一律挂在 planningEscape() 门槛后 —— 这一格要摆「担石劳作 / 环顾四周」
    //   的引导，一上来摆满按钮会把引导锚点顶掉（沿用 v20260912f 起「没介绍到的先藏着」的做法）。
    'kuyilao|1,1': {
      doors: [],
      objects: [
        // v20260920h：担石劳作改「装担→卸料」闭环 —— 乱石堆在场院装担，送到仓库卸料台才记一工
        { icon:'🪨', label:'乱石堆', actId:'labor_yard', acts:[
          {label:'装担', icon:'🪨', fn:function(){ stoneLoad(); }}
        ]},
        { icon:'📋', label:'记工木牌', acts:[
          {label:'查工分', icon:'📋', fn:function(){ ledgerLook(); }},
          {label:'看差役', icon:'📜', fn:function(){ jobBoard(); }}
        ]},
        { icon:'🥁', label:'铜刁斗', acts:[
          {label:'击鼓', icon:'🥁', fn:function(){ diaodouStrike(); }}
        ]},
        { icon:'🗺️', label:'舆图沙盘', show: planningEscape, acts:[
          {label:'细看舆图', icon:'🗺️', fn:function(){ yutuLook(); }}
        ]},
        { icon:'📜', label:'军报木牍', show: planningEscape, acts:[
          {label:'翻看军报', icon:'📜', fn:function(){ junbaoLook(); }}
        ]},
        { icon:'⚔️', label:'兵器架', show: planningEscape, acts:[
          {label:'取一件', icon:'⚔️', fn:function(){ rackTake(); }}
        ]}
      ]
    },
    // 农田（0,0）：接了「开垦薄田」才见着待垦的荒地；此后一畦一畦开出来（见 farmObjects）。
    //   未接活时一律不摆 —— 这一格本就有「下地务农」的自由劳作，再堆设施会把格上的引导顶掉。
    //   v20260915g：畦的数目随开出进度变化，故不能在定义时就写死数组（此处常量尚未声明），
    //   改由 cellInteriors 在【运行时】问 farmObjects() 要。
    'kuyilao|0,0': {
      farmObjects: true,
      // v20260924z3：柴林（伐木场）从农田格直接进 —— 薄田东出口是旧营区房间的路，玩家种地都在这一格，
      //   入口必须摆在看得见的地方。伐木与务农同为营内自由劳作，故此门常开、不设任务门槛。
      doors: [
        { label:'柴林（伐木场）', icon:'🌳', target:'camp_woodland', group:'农庄' }
      ]
    },
    // 演武场（2,2）：犬舍单独一间子房（v20260915e）——木人桩留在格上（格型动作），
    //   逗犬进屋，两者隔开：先教打（桩），再教跑（犬）。门槛 = 木人桩已练成（tcDone）。
    'kuyilao|2,2': {
      doors: [
        { label:'犬舍', icon:'🐕', target:'camp_kennel', group:'演武场',
          show: function(){ return !!(state.flags && state.flags.onb && state.flags.onb.tcDone); } }
      ]
    },
    // 伙房（0,1）：灶边水缸 —— 「担水入灶」的落点（打水在囚室水槽，倾水在此处，两头一担挑起来）
    //   v20260915g 另起一口「大灶」：田里种出的菜豆在此下锅 —— 不然种地就是「掐了菜、交了差」便完事，
    //   产出没有第二个去处，农田这块内容也就悬空了。
    'kuyilao|0,1': {
      objects: [
        { icon:'🪣', label:'灶边水缸', show: function(){ return jobOpen('water'); }, acts:[
          {label:'倾水入缸', icon:'💧', fn:function(){ kitchenPour(); }}
        ]},
        { icon:'🍲', label:'大灶', show: function(){ return farmHas('dou',1) || farmHas('yecai',3); }, acts:[
          {label:'煮豆粥（菽豆×1 · 水×2）', icon:'🥣', show: function(){ return farmHas('dou',1); }, fn:function(){ cookDouzhou(); }},
          {label:'野菜入锅（野菜×3）', icon:'🥬', show: function(){ return farmHas('yecai',3); }, fn:function(){ cookYeCai(); }}
        ]}
      ]
    },
    // 岗哨（1,2）：望楼 —— 「瞭望换岗」的落点（看的是时辰：换岗那一刻门洞最乱，正是出营的缝隙）
    'kuyilao|1,2': {
      objects: [
        { icon:'🗼', label:'望楼', show: function(){ return jobOpen('watch'); }, acts:[
          {label:'登楼瞭望', icon:'👁️', fn:function(){ watchLook(); }}
        ]}
      ]
    },
    // 仓库（2,1）：卸料台 + 三翻找点位（v20260920h）
    //   担石搬运闭环的落点：场院装担 → 此处「卸料入仓」记工；卸料台无负重时不放行。
    //   仓中翻找改三点位：麻袋堆/木箱/货架各管各的掉落池、翻空后隔天刷新；任务随机指定目标物。
    'kuyilao|2,1': {
      objects: [
        { icon:'⛏️', label:'卸料台', actId:'haul_stones', acts:[
          {label:'卸料入仓', icon:'🪨', fn:function(){ stoneUnload(); }}
        ]},
        { icon:'🧺', label:'麻袋堆', actId:'rummage_sack', acts:[
          {label:'翻找', icon:'🔍', fn:function(){ rummageFind('sack'); }}
        ]},
        { icon:'📦', label:'木箱', actId:'rummage_box', acts:[
          {label:'翻找', icon:'🔍', fn:function(){ rummageFind('box'); }}
        ]},
        { icon:'🪜', label:'货架', actId:'rummage_shelf', acts:[
          {label:'翻找', icon:'🔍', fn:function(){ rummageFind('shelf'); }}
        ]}
      ]
    }
    // 矿坑（2,0）【不摆设施】：该格是 mine 型，格上本就有「开凿矿料」出石料（city.js 格型动作）。
    //   早前在此另摆一个「岩壁矿脉·凿石」，于是同一格里出现两个都出石料的按钮 —— 纯属重复，撤掉。
  };
  function cellInteriors(cid, x, y){
    var d = CELL_INTERIORS[cid + '|' + x + ',' + y] || null;
    // v20260915g：农田的畦是「开一畦多一畦」，数目随进度变；且定义常量在文件更下方，
    //   故此处运行时再生成（比在表里写死数组干净，也不受声明顺序所累）。
    // v20260920e：农田格另起一口「水井」——打水装袋 / 掬饮 / 浇灌，与畦同格摆（合并，不互顶）。
    // v20260924z5：农田格曾把 doors（柴林入口）一并吞掉——此处只拼 objects 就 return 了。
    //   柴林门定义在 CELL_INTERIORS 里，必须原样带出，否则农庄格看不到伐木场入口。
    if(d && d.farmObjects) return { doors: d.doors || [], objects: farmObjects().concat([wellObject()]) };
    return d;
  }
  // ═══ 农田水井（v20260920e）：夜半添水 / 浇畦的水源。井水取之不竭，只费工夫，不凭空。 ═══
  function wellObject(){
    return { icon:'⛲', label:'水井', acts:[
      { label:'打水', icon:'🪣', fn:function(){ wellDrawToBag(); } },
      { label:'掬饮', icon:'💧', fn:function(){ wellDrink(); } },
      { label:'浇灌', icon:'🌱', fn:function(){ farmWater(0); } }
    ]};
  }
  function wellDrawToBag(){
    var bag=packFind('shuidai');
    if(!bag){ toast('没有水袋，捧不起这井水——开垦薄田能得一只。'); return; }
    var cap=bag.waterCap||10;
    if((bag.water||0)>=cap){ toast('水袋已是满的。'); return; }
    bag.water=cap;
    advanceMinutes(5);
    log('你摇起井绳，汲满一袋清冽井水（水袋 '+cap+' / '+cap+'）。','good');
    save(state); renderStatus();
  }
  function wellDrink(){
    state.drink=Math.min(state.maxDrink, (state.drink||0)+8);
    advanceMinutes(5);
    log('你扒着井沿掬了几口水，凉意直透喉底（饮 +8）。','good');
    save(state); renderStatus();
  }
  // ═══ 苦役营牢房设施：水槽(容量+添水) / 值更鼓(击鼓)（v20260910s）═══
  var TROUGH_CAP = 20;   // 水槽容量（饮水单位）；水不凭空生，满则溢
  function fxGet(key){
    state.fixtures = state.fixtures || {};
    if(!state.fixtures[key]){
      state.fixtures[key] = { water:0, strikes:0 };
      if(key==='kuyilao|1,0') state.fixtures[key].water = 12;  // 牢中水槽初有半槽水，教学即饮
    }
    return state.fixtures[key];
  }
  // 饮槽中水：回复 饮，扣槽水（不凭空）
  function troughDrinkBy(key){
    var f=fxGet(key);
    if(f.water<=0){ toast('水槽见了底，须先添水。'); return; }
    var sip=Math.min(8, f.water);
    f.water-=sip;
    state.drink=Math.min(state.maxDrink, (state.drink||0)+sip);
    advanceMinutes(5);   // v20260917b：饮水/取水 5 分钟
    log('你掬槽中水饮了几口，喉间干涸稍解（饮 +'+sip+'）。','good');
    save(state); renderStatus();
  }
  // 以水袋向槽添水：容器水倒入，槽满则溢
  function troughFillBy(key){
    var f=fxGet(key);
    if(f.water>=TROUGH_CAP){ toast('水槽已注满，添不下了。'); return; }
    var bag=packFind('shuidai');
    var bw=(bag && bag.water>0)? bag.water : 0;
    if(!bag){ toast('须先得一只水袋，方能向槽中倾水（开垦薄田可得，农田水井打水装袋）。'); return; }
    if(bw<=0){ toast('水袋空空——先去农田那格的水井「打水」再来添槽。'); return; }
    var add=Math.min(bw, TROUGH_CAP-f.water);
    f.water+=add; bag.water=bw-add;
    advanceMinutes(5);   // v20260917b：添水 5 分钟
    log('你将水袋中 '+add+' 份水倾入槽中（槽 '+f.water+' / '+TROUGH_CAP+'）。','good');
    // 夜半添水（v20260915f）：注满即了 —— 这一槽水，够地字号那几位润到天亮。
    if(f.water>=TROUGH_CAP && jobOpen('nightwater') && !jobFlag('nightwater','_done')){
      jobTick('nightwater');
      log('槽水终于漫到沿口。栅后有人哑着嗓子道了句谢——夜半这一槽，是替人解的渴。（修为+20 · 崔九好感+1）','good');
      state.npcFavor=state.npcFavor||{}; state.npcFavor['cui_jiu']=(state.npcFavor['cui_jiu']||0)+1;
      jobSettle('nightwater','night_water',20,0);
    }
    save(state); renderStatus();
  }
  // 铜壶漏刻（v20260916g）：牢房里那面「值更鼓」换成漏刻——营中钟点从「靠鼓敲」改为「靠漏走」，
  //   与中军帐刁斗不再撞车（一个是滴答观时、一个是槌击报更）。观漏无声无险，只答时辰与换岗。
  function loukeLook(){
    var sh=SHICHEN[state.time%12];
    log('〔滴答〕你凑近铜壶漏刻，铜壶承水，漏箭浮沉，刻度正指「'+sh+'」。营中换岗向在戌时前后，漏尽更敲。','sys');
    save(state);
  }
  // 玩家放置的水槽（PLACE_ACTIONS）：水量存于放置条目 p.water
  function shuicaoDrinkPlaced(p){
    if((p.water||0)<=0){ toast('水槽见了底，须先添水。'); return; }
    var sip=Math.min(8, p.water);
    p.water-=sip;
    state.drink=Math.min(state.maxDrink, (state.drink||0)+sip);
    log('你掬槽中水饮了几口，喉间干涸稍解（饮 +'+sip+'）。','good');
    save(state); renderStatus();
  }
  function shuicaoFillPlaced(p){
    if((p.water||0)>=TROUGH_CAP){ toast('水槽已注满，添不下了。'); return; }
    var bag=packFind('shuidai');
    var bw=(bag && bag.water>0)? bag.water : 0;
    if(!bag){ toast('须先得一只水袋，方能向槽中倾水（开垦薄田可得，农田水井打水装袋）。'); return; }
    if(bw<=0){ toast('水袋空空——先去农田那格的水井「打水」再来添槽。'); return; }
    var add=Math.min(bw, TROUGH_CAP-(p.water||0));
    p.water=(p.water||0)+add; bag.water=bw-add;
    log('你将水袋中 '+add+' 份水倾入槽中（槽 '+p.water+' / '+TROUGH_CAP+'）。','good');
    save(state); renderStatus();
  }
  // 从水槽向水袋装水：槽水倒入水袋，受水袋容量( waterCap )限制（水袋可随身盛水，去别处再添槽）
  function troughDrawToBag(key){
    var f=fxGet(key);
    if(f.water<=0){ toast('水槽空了，无水解渴。'); return; }
    var bag=packFind('shuidai');
    if(!bag){ toast('须先得一只水袋，方能从此槽中盛水（开垦薄田可得，农田水井打水装袋）。'); return; }
    var cap=bag.waterCap||10, cur=(bag.water||0);
    if(cur>=cap){ toast('水袋已满，盛不下了。'); return; }
    var take=Math.min(f.water, cap-cur);
    f.water-=take; bag.water=cur+take;
    advanceMinutes(5);   // v20260917b：取水/装水 5 分钟
    log('你以槽中水注满水袋（水袋 '+bag.water+' / '+cap+'）。','good');
    save(state); renderStatus();
  }
  function shuicaoDrawToBag(p){
    if((p.water||0)<=0){ toast('水槽空了，无水解渴。'); return; }
    var bag=packFind('shuidai');
    if(!bag){ toast('须先得一只水袋，方能从此槽中盛水（开垦薄田可得，农田水井打水装袋）。'); return; }
    var cap=bag.waterCap||10, cur=(bag.water||0);
    if(cur>=cap){ toast('水袋已满，盛不下了。'); return; }
    var take=Math.min(p.water, cap-cur);
    p.water=(p.water||0)-take; bag.water=cur+take;
    log('你以槽中水注满水袋（水袋 '+bag.water+' / '+cap+'）。','good');
    save(state); renderStatus();
  }
  // ═══ 苦役营·中军帐设施（v20260914d）═══
  // 与牢房(1,0)分工：牢房管「活下去」（水槽解渴 / 更鼓探时辰 / 草荐打盹），
  //   中军帐管「逃出去」——记工册答「还欠几分工」，舆图军报给出营要用的虚实，兵器架刁斗是拿命去换的冒险。
  // 牢头白日在场院督工、戌时起回牢门口守夜（见 data/npc_cards.js 的 routine）——器械动得动不得，就看他在不在。
  function laotouOnYard(){
    var t=state.time%12;
    return !(t===10||t===11||t===0||t===1||t===2);
  }
  // 是否已起了出营的心思：中军帐的进阶设施自此才现形（教学期这一格要摆「担石劳作/环顾四周」的引导，
  //   一上来多塞五个按钮会把引导锚点顶掉，故一律收在门槛后）
  function planningEscape(){ return !!(state.flags && state.flags.route && state.flags.route.crypt); }
  // 记工木牌：工分 / 木片 / 旷役 —— 营中规则的日常面，教学期也可点，且正答「干了半天攒了几分」
  function ledgerLook(){
    var o=onbF();
    if(!o || !o.started){ log('〔记工册〕工册上还没有你的名字——你是新押入的囚徒，待牢头录名后，才有工分可查。','sys'); return; }
    if(o.done){ log('〔记工册〕册上早没了你的名字——你已脱籍。','sys'); return; }
    var cnt=o.workCnt||0, per=LABOR_PER_WOOD||3, need=per-(cnt%per);
    var pai=packFind('lao_pai'), have=pai?(pai.count||1):0, miss=o.missCount||0;
    log('〔记工册〕名下已记 '+cnt+' 工，手上有「劳字木片」'+have+' 枚；再干 '+need+' 工，可换下一枚。','sys');
    // v20260914g：工分与木片的来路去处，此前全营没有一处写明（玩家挣到木片，却不知往哪使、该交给谁）。
    //   记工册正是管这件事的地方，故让它把这条链答全：工分 → 木片 → 伙房换饭 → 交到人手上。
    log('〔记工册〕木片是营里的钱：干活记工，满 '+per+' 工发一枚，拿它往营西伙房换饭；换来的干粮须交到人手上（点那人，选「给予」），空手说一句不算数。','sys');
    if(miss>0) log('〔记工册〕名下另有旷役 '+miss+' 次——每记一次，当日便扣一份口粮、惹牢头一顿脸色。','warn');
  }
  // 刁斗：击鼓报更。中军帐的鼓是号令鼓，比牢房那口漏刻更招人（与 loukeLook 对称）
  function diaodouStrike(){
    var f=fxGet('kuyilao|1,1|dou');
    f.strikes=(f.strikes||0)+1;
    log('〔当——〕你一槌敲在刁斗上，声震全营。此刻乃「'+SHICHEN[state.time%12]+'」。','sys');
    if(laotouOnYard()) log('牢头隔着半个场院瞪过来：「敲你娘的丧钟！再敲，今夜的口粮没了。」','warn');
    else log('夜深，刁斗声荡开去，岗上戍卒探头骂了两句，又缩回去了。','sys');
    if(f.strikes>3) toast('刁斗连响数通，营中已四下张望——再敲必惹祸上身。');
    save(state);
  }
  // 舆图沙盘：营盘九格 + 换岗时辰 + 水渠走向（水渠夜遁线的由头）
  function yutuLook(){
    log('〔舆图〕营盘方方正正九格：北列农田、囚室、矿坑；中为伙房、中军帐、仓库；南列军营、岗哨、演武场。','sys');
    log('〔舆图〕一道水渠自伙房那侧穿墙而出，通到墙外的河沟——图上只注了「排水」二字。','sys');
    log('〔舆图〕换岗在戌时前后，鼓响三通；子时最松，岗上只余两人。','sys');
    // v20260914f：看过舆图，顺手把「山河」放行 —— 顺着一张营盘图，头一回晓得外头还有州郡。
    //   解锁口径与别处一致（onbUnlockDock + Guide 高亮，见「角色」「行囊」的首次解锁）；
    //   教学期这颗页签本是藏着的（body.onb），不这么做，玩家出了营才第一次见着山河志。
    var o=onbF();
    if(o && !o.done && (!o.unlocked || o.unlocked.indexOf('map')<0)){
      onbUnlockDock('map');
      log('你把图上那几条道记熟了，目光顺着营墙往外挪——墙外是渔阳，再往外是幽州，更远处还有十来个州。','sys');
      log('〔山河〕点下方「🗺️ 山河」，可看这一带的州郡城池。眼下你还走不出去，先把路记在心里。','sys');
      try{ if(LF.Guide && LF.Guide.ping) LF.Guide.ping({dock:'map'}); }catch(e){}
    }
  }
  // 军报木牍：营中虚实（收买线的由头）
  function junbaoLook(){
    log('〔军报〕「渔阳戍卒二百，屯粮不足旬月。」「营中苦役三百余，逃者七，追回三。」','sys');
    log('〔军报〕最末一牍墨迹未干：粮官贪杯，犬卒好赌——银钱到手，睁一只眼闭一只眼。','sys');
  }
  // 兵器架：白日动手吃一鞭；趁夜取械 → 开出「劫狱强攻线」的第三条前置（原只有等级≥3 / 戳通木人桩）
  function rackTake(){
    var o=onbF();
    if(!o || !o.started || o.done){ toast('你已脱籍，营中器械与你无干。'); return; }
    if(state.flags.route && state.flags.route.rack){ toast('你已藏下一件，贪多必失。'); return; }
    if(laotouOnYard()){
      log('你手刚搭上枪杆，背后一声暴喝：「作死！」牢头的鞭梢已抽在手背上，火辣辣一条血棱。','warn');
      state.hp=Math.max(1,(state.hp==null?(state.maxHp||100):state.hp)-8);
      renderStatus(); save(state);
      return;
    }
    if(!exert('取械')) return;
    if(!state.flags.route) state.flags.route={};
    state.flags.route.rack=true;
    log('〔得械〕你抽了一杆钝头枪，塞进塌墙根的乱砖底下——真要硬闯岗哨，手里总得有件家伙。','good');
    save(state);
  }
  // ═══ 苦役营·差役牌（v20260914e 立，v20260914f 改）═══
  // 木牌就是派活的地方：营里的差事全钉在上头 —— 谁要的、去哪干、做出来交到谁手上。
  //   领活在此（摘木牍）→ 去那一格实地做工、做出实物 → 回头寻收差的那位，走给予面板把东西交出去（真扣行囊）。
  //   交差判定挂在 onGive 触发器上（triggers.js kyl_farm_give / kyl_stone_give），不靠对话复命 ——
  //   对话复命那一套是「空着手说一句就完事」，东西还躺在行囊里，算不得交差。
  // 只留两条，且刻意不重样：田里出菜（交伙房）、矿里出石（交仓库）。
  var JOB_BOARD = [
    { key:'farm', quest:'camp_farm', title:'开垦薄田',
      word:'孙老要的：薄田三垄，翻透，掐两捧菜，交伙房鲁大',
      take:'你把「开垦薄田」那片木牍摘了下来。',
      tip:'去营北农田那格：翻三垄开出第一畦 → 播菜籽 → 约三时辰后采收。地是九畦的园子，开出几畦看你肯下多少工；浇过水的早熟，该收不收会枯。菜捧去伙房，点鲁大、选「给予」交到他手上。' },
    { key:'stone', quest:'stone', title:'采石充仓',
      word:'仓吏要的：矿坑凿青石五块，交仓库',
      take:'你把「采石充仓」那片木牍摘了下来。',
      tip:'去营东北矿坑，就格上「开凿矿料」凿够五块石料；扛回仓库，点仓吏、选「给予」，把石料交到他手上。' },
    // v20260915f：第二批 —— 四桩「要跑腿、要使唤东西」的差事。
    //   与田里出菜、矿里出石的区别在：不产实物，产的是「跑这一趟」本身（水、话、时辰、拳脚）。
    { key:'water', quest:'water_cook', title:'担水入灶',
      word:'鲁大要的：囚室水槽打两袋水，倾进伙房灶边水缸',
      take:'你把「担水入灶」那片木牍摘了下来。',
      tip:'去农田那格的水井「打水」装满水袋，再往伙房那格点「灶边水缸」倾进去——两趟。' },
    { key:'dummy', quest:'dummy_train', title:'木人试艺',
      word:'韩铁要的：演武场木人桩，戳倒三回',
      take:'你把「木人试艺」那片木牍摘了下来。',
      tip:'去演武场（有木人桩那格）戳木人桩，打赢三回——跑掉不算，得把它戳倒。' },
    { key:'errand', quest:'errand_word', title:'捎句话',
      word:'孙老托的：带一句话给牢头，再回来回他个话',
      take:'你把「捎句话」那片木牍摘了下来。',
      tip:'去农田找孙老，问他要捎什么话 → 往中军场院寻牢头把话带到 → 回来与孙老回一声。' },
    { key:'watch', quest:'watch_shift', title:'瞭望换岗',
      word:'秦九霄要的：岗哨望楼看一回换岗，回来报时辰',
      take:'你把「瞭望换岗」那片木牍摘了下来。',
      tip:'去营东北岗哨那格点「登楼瞭望」记下换岗在几时，再回来与秦九霄说一声。' },
    // v20260915f：第三批 —— 地字号那三间的差事（送粥 / 添水 / 翻找）。
    //   前两桩是「给人递点东西」：一碗粥、一槽水，东西轻，落到人身上才重。
    { key:'porridge', quest:'porridge_visit', title:'送粥探监',
      word:'林娘托的：地字二号那个藏饼的少年，送一碗粥过去',
      take:'你把「送粥探监」那片木牍摘了下来。',
      tip:'先在伙房换一碗粥（过了饭点换到的正是粥），再往地字二号牢房，点那瘦少年、选「给予」，把粥递到他手上。' },
    { key:'nightwater', quest:'night_water', title:'夜半添水',
      word:'囚友求的：牢房那槽水快见底了，添满它',
      take:'你把「夜半添水」那片木牍摘了下来。',
      tip:'往囚室那格的水槽点「添水」，把槽水注满——添满即了（水不够就多打几袋）。' },
    { key:'rummage', quest:'store_rummage', title:'仓中翻找',
      word:'仓吏要的：仓库翻出一件指定的旧物，交还仓里',
      take:'你把「仓中翻找」那片木牍摘了下来。',
      tip:'去仓库那格，翻「麻袋堆 / 木箱 / 货架」三处（各管各的货，翻过即空、隔天再来）——翻到仓吏点名要的那件，点仓吏、选「给予」交到他手上。' },
    // v20260915i：矿坑改版差役——铜矿出自矿洞三层以下（青铜镐的三条来路之一：制作 / 市集 / 差役）
    { key:'copper', quest:'mine_copper', title:'淘铜铸镐',
      word:'仓吏要的：矿洞三层以下古铜脉，凿铜矿四块，交仓库',
      take:'你把「淘铜铸镐」那片木牍摘了下来。',
      tip:'入矿洞下到第三层起，寻「古铜脉」凿取铜矿（粗石镐凿不动，先换精致石镐或青铜镐）——凑足四块回仓库，点仓吏、选「给予」，把铜矿交到他手上。' }
  ];
  // 差役牌面板（v20260915b）：木牌上钉着几片木牍，摘一片领一桩活
  // v20260916h：木牍改「缩略 → 点击展开」——默认只露状态印与活名，一屏能多排几片；
  //   点活名那行展开全部（一句话、指引、操作），再点收起。摘牍后刚领的那片自动展开。
  var lastJobTaken=null;

  // 看差役牌（v20260915b）：从对话文字流改为木牍面板 —— 木牌质感 + 一片木牍一桩活

  // ═══ 差役记账（v20260915f）═══
  // 牌上摘牍只是接活；做一次记一笔（jobTick），够了翻牍发赏（jobSettle）。
  //   各处只管调这两个，不必各自拼 flags 路径 —— 也免得「记了数却忘了翻牍」这类漏账。

  // ═══ 担水入灶（v20260915f）：囚室水槽打水 → 伙房灶边水缸倾进去 ══
  //   水是营里的硬通货（解渴 / 添槽 / 和泥都靠它）。这一趟的意义在「两头跑」：
  //   打水在一处、用场在另一处，营里的日子本就是这么串起来的。
  var WATER_PER_TRIP = 5;                       // 倾一袋入缸：满五份水才算一趟
  function kitchenPour(){
    if(!jobOpen('water')){ toast('没人使唤你担水，别在灶前碍事。'); return; }
    var bag=packFind('shuidai');
    if(!bag || !(bag.water>0)){ toast('水袋空空——先去农田那格的水井「打水」装袋。'); return; }
    if(!exert('担水入灶')) return;
    busyAct('倾水入缸', 900, function(){
      var pour=Math.min(WATER_PER_TRIP, bag.water);
      bag.water-=pour;
      advanceMinutes(60);
      var n=jobTick('water');
      log('你把水袋里 '+pour+' 份水倾进灶边那口大缸，缸沿浮起一层浮沫。（已担 '+n+' / 2 趟）','good');
      if(n>=2){
        log('〔差役了结·担水入灶〕鲁大舀了半瓢稠的递来：「水担得勤，锅里的食便稠些——往后这缸，就归你管了。」（干粮×1 · 修为+20 · 鲁大好感+1）','good');
        packAdd('fan',1); afterPackChange();
        state.npcFavor=state.npcFavor||{}; state.npcFavor['lu_da']=(state.npcFavor['lu_da']||0)+1;
        jobSettle('water','water_cook',20,0);
      } else { save(state); renderStatus(); }
      buildActions(curRoom());
    });
  }
  // ═══ 瞭望换岗（v20260915f）：岗哨登楼看一回，记下换岗在几时，回来报与秦九霄 ══
  //   看的是「时辰」——换岗那一刻门洞最乱，这条缝隙正是出营的本钱。
  var WATCH_HOUR = 10;                          // 戌时前后换岗（与更鼓那套口径一致）
  function watchLook(){
    if(!jobOpen('watch')){ toast('无令不得登楼——守卒的横眼正盯着你。'); return; }
    if(!exert('登楼瞭望')) return;
    busyAct('登楼瞭望', 1000, function(){
      advanceMinutes(60);
      var h=state.time%12, sh=SHICHEN[h];
      var d=Math.abs(h-WATCH_HOUR), near=(d<=1 || d>=11);
      state.flags=state.flags||{}; state.flags.task=state.flags.task||{};
      state.flags.task.watch_seen=sh;
      log('你伏在望楼垛口看了半晌：此刻'+sh+'，'+(near?'正撞上换岗——两班守卒在门洞下交割腰牌，乱了一阵。':'岗上的兵交班还早，只听得见风穿过箭楼。'),'env');
      if(near) log('〔记下了〕换岗就在'+sh+'前后——这一刻门洞下最乱，是条缝。','good');
      else log('（换岗在戌时前后，那时候再来一趟，才看得出门道。）','sys');
      save(state); renderStatus();
    });
  }
  // ═══ 仓中翻找（v20260915f 立；v20260920h 改三点位）═══
  //   从前的「点一下随机出货」改成：仓库里三处可翻的点位（麻袋堆/木箱/货架），各管各的掉落池；
  //   翻过即翻空，当日不再出（隔天刷新）；接「仓中翻找」差事时仓吏随机指定目标物（flags.task.rummage_target），
  //   翻到目标物交回才算完 —— 翻到别的可留可交（给仓吏则按物品价值换好感，不会吞东西）。
  // v20260915g：只翻【已登记】的通用物资——凡能进背包的，必先在 items.js 登记、再引用。
  var RUMMAGE_SPOTS = {
    sack:  { label:'麻袋堆', pool:[['bumu',0.5],['rope',0.3],['mucai',0.2]] },
    box:   { label:'木箱',   pool:[['mucai',0.5],['rope',0.3],['shitiao',0.2]] },
    shelf: { label:'货架',   pool:[['mucai',0.4],['bumu',0.4],['rope',0.2]] }
  };
  function rummageTarget(){ var t=state.flags.task||{}; return t.rummage_target||null; }
  function rummageFind(spot){
    var def=RUMMAGE_SPOTS[spot]; if(!def) return;
    if(!jobOpen('rummage')){ toast('仓里的东西不是你能乱翻的。'); return; }
    var t=state.flags.task||{};
    var em=t.rummageEmptied||(t.rummageEmptied={});
    if(em[spot]===state.day){ toast(def.label+'已经翻空了——过一夜再来，或去别的堆翻翻。'); return; }
    if(!exert('翻找'+def.label)) return;
    busyAct('翻找'+def.label, 1000, function(){
      advanceMinutes(60);
      var r=Math.random(), id=null, acc=0;
      for(var i=0;i<def.pool.length;i++){ acc+=def.pool[i][1]; if(r<acc){ id=def.pool[i][0]; break; } }
      if(!id) id=def.pool[0][0];
      if(!packAdd(id,1)){ toast('行囊塞不下——腾出一格再来翻。'); return; }
      em[spot]=state.day;                 // 翻空：当日不再出，隔天刷新
      var tgt=rummageTarget();
      var its=window.LF && LF.ITEMS && LF.ITEMS.DEFS ? LF.ITEMS.DEFS : {};
      var itd=its[id]||{};
      var hit = tgt && tgt===id;
      var msg='你在'+def.label+'里摸出'+(itd.icon||'🔧')+'「'+(itd.name||id)+'」';
      if(hit) msg+='——正是仓吏要的那件！回去点仓吏、选「给予」交到他手上。';
      else if(tgt) msg+='（仓吏要的是「'+((its[tgt]||{}).name||tgt)+'」，这件的他不收；留着或另递。）';
      else msg+='。';
      log(msg,'good');
      afterPackChange(); save(state); renderStatus(); buildActions(curRoom());
    });
  }

  // ═══ 伙房大灶：把田里的产出煮成热食（v20260915g）═══
  //   农田出菜豆、伙房出热食 —— 两头接上，「种地」才不只是掐两捧菜去交差。
  //   热食也顶「灶上一口热饭」那桩例事（LF.onEat 已认豆粥），于是 田间 → 灶上 → 例事 自成一环。
  //   一律【先加产出、后扣料】：行囊塞不下时料还攥在手里，不至于白扔一把豆子。
  function cookDouzhou(){
    if(!farmHas('dou',1)){ toast('没有菽豆——去田里种一茬，或拿别的东西与人换。'); return; }
    var bag=packFind('shuidai');
    if(!bag || (bag.water||0)<2){ toast('熬粥要水：水袋里不足两份（先去农田那格的水井「打水」装袋）。'); return; }
    if(!exert('煮豆粥')) return;
    busyAct('煮豆粥', 1000, function(){
      if(!packAdd('douzhou',1)){ toast('行囊塞不下——腾出一格再煮。'); return; }
      packConsume('dou',1); bag.water=(bag.water||0)-2;
      advanceMinutes(60);
      log('你把菽豆下锅，添两瓢水，灶膛的火舌舔着锅底。不多时豆香漫开——得「豆粥」×1。（回食 22、水 6）','good');
      afterPackChange(); save(state); renderStatus(); buildActions(curRoom());
    });
  }
  // 野菜入锅：三捧野菜换一碗稀粥（菜太寡，鲁大添半勺杂粮）——复用既有的「稀粥」，不另立新物
  function cookYeCai(){
    if(!farmHas('yecai',3)){ toast('野菜不足三捧——大灶不值当为两片叶子生火。'); return; }
    if(!exert('野菜入锅')) return;
    busyAct('野菜入锅', 900, function(){
      if(!packAdd('xizhou',1)){ toast('行囊塞不下——腾出一格再煮。'); return; }
      packConsume('yecai',3);
      advanceMinutes(60);
      log('三捧野菜下了锅。鲁大舀半勺杂粮添进去：「菜太寡，得搭把米才压得住饥。」——得「稀粥」×1。','good');
      afterPackChange(); save(state); renderStatus(); buildActions(curRoom());
    });
  }
  // ═══ 农田（0,0）：九畦（v20260915g）═══
  //   旧版只有「一块薄田」：翻三垄 → 掐菜，掐完还是那块地 —— 种地的人无从长进，
  //   浇水也只是多给一捧，看不出「照料」的分量。
  //   新版把它做成九畦的园子：荒地要一垄一垄开出来（开到第几畦，看你肯下多少工）；
  //   每畦各自走 翻 → 播 → 长 → 收 —— 长出什么，取决于你播了什么、浇没浇水、收得及不及时。
  //   升级给的是【机制】不是数值：水渠（一桶浇遍）、编筐（多得一捧）、留种（收完必返籽）。
  //   状态存 fixtures['kuyilao|0,0']：plots[] 每畦 / unlocked 已开出几畦 / up{} 升级 / li 当前畦已翻垄数
  var FARM_MAX = 9;                    // 九畦到顶（再阔就是庄园，不是囚徒的园子了）
  var FARM_LI  = 3;                    // 开一畦须翻三垄
  var CROPS = {
    yecai: { name:'野菜', icon:'🥬', grow:3, out:'yecai', yield:[1,2], seed:'caizi' },
    dou:   { name:'菽豆', icon:'🥜', grow:6, out:'dou',   yield:[1,2], seed:'douzhong' }
  };

  // 一畦此刻的模样：wild 未开 / tilled 已翻 / growing 长着 / ripe 可收 / wither 枯了

  // 播种以来已过的时辰数（绝对口径：天数×12 + 时辰差，跨子夜不回绕；旧档无 sownDay 按当日 0 起）

  // 开垦：一次一垄，三垄开出一畦；头一回孙老递过锄头

  // 播种：一畦一份种子；菜籽长得快，菽豆长得慢却厚

  // 浇水：寻常一次浇一畦；修了水渠则三份水浇遍所有长着的畦

  // 锄草：不催熟，只把时辰往前推一个，顺带让人不至于干等

  // 采收：得实物；浇过水 +1 捧；有编筐再 +1 捧；留种则返一份籽

  // 铲枯苗：该收没收，苗荒死在畦里 —— 土还在，重头再来

  // 升级三件：给机制，不给数值（数值涨了只会让人更快做完，机制变了才会换一种做法）
  var FARM_UP = {
    canal:    { name:'水渠', icon:'🚰', cost:{ shitiao:3 }, need:{ shitiao:3 }, desc:'沿畦开一道小沟。此后三份水浇遍所有长着的畦，不必一畦一畦挑。' },
    basket:   { name:'编筐', icon:'🧺', cost:{ rope:1 },    need:{ rope:1 },    desc:'请席翁编一只收菜的筐。此后每畦采收都多得一捧。' },
    seedkeep: { name:'留种', icon:'🌱', cost:{ bumu:1 },    need:{ bumu:1 },    desc:'缝一只布口袋存籽。此后每收一畦，必留得一份种子。' }
  };

  // 格上的设施：每畦按当前状态只显一条（故九畦最多九条），外加三处升级

  var CELL_NARR = {
    'kuyilao|1,0': [
      '长巷两侧铁栅森然，风从栅缝钻过，带着潮气与远处草木腥。六间牢房分列东西——东侧天字一号至三号，西侧地字一号至三号。',
      '你顺着栅廊望去，牢门皆虚掩或紧锁，囚徒们或坐或卧，目光却都朝着那几扇通往子牢房的门。'
    ],
    'kuyilao|1,1': [
      '中军帐扎在场院正中，旌旗高悬。帐前立着一块记工木牌，帐侧一架兵器，帐角搁着一口铜刁斗。',
      '帐帘半卷，里头案上摊着舆图与一摞军报木牍。白日里牢头在此督工，人多眼杂——动手脚得挑时候。'
    ]
  };
  function cellNarr(cid, x, y){ return CELL_NARR[cid + '|' + x + ',' + y] || null; }

  // 城格内部：面板中渲染「可进入子房间(doors)」与「不可进入交互物(objects)」
  // 通用地图框架（v20260910q）：罗盘=大方位去别处；面板=地点内 rooms/items；NPC 单列
  function renderCellInteriors(cid, x, y){
    var data=cellInteriors(cid, x, y); if(!data) return;
    // v20260914d：doors / objects 支持 show() 门槛 —— 中军帐那些「起了出营心思后才该碰」的设施靠它收着
    var doors=(data.doors||[]).filter(function(d){ return !d.show || d.show(); });
    if(doors.length){
      var _grp={};
      doors.forEach(function(d){ (_grp[d.group]=_grp[d.group]||[]).push(d); });
      Object.keys(_grp).forEach(function(g){
        var h=document.createElement('div'); h.className='grp'; h.textContent=g; $actions.appendChild(h);
        _grp[g].forEach(function(d){
          mkAct('door', d.icon||'🚪', d.label, function(){ renderRoom(d.target); }, null, d.target);
        });
      });
    }
    var objs=(data.objects||[]).filter(function(o){ return !o.show || o.show(); });
    if(objs.length){
      var oh=document.createElement('div'); oh.className='grp'; oh.textContent='交互物品'; $actions.appendChild(oh);
      // v20260924z4：物件收纳 —— 一格物什太多（九畦+工地+井+NPC 物件）会撑高按钮区、把底下叙事窗挤没。
      //   超过 6 件先只摆前 6 件，挂一个「更多（N）」按钮，点开才把余下的铺出来；展开仍受 #actions 限高滚动约束。
      var OBJ_LIMIT=6;
      var shown=objs.slice(0, OBJ_LIMIT), hidden=objs.slice(OBJ_LIMIT);
      function mkObjBtn(o){
        var b=mkAct('obj', o.icon||'🔧', o.label, function(e){ toggleObjExpand(e, b, o, (o.acts||[])); }, null, o.actId);
      }
      shown.forEach(mkObjBtn);
      if(hidden.length){
        var more=document.createElement('button');
        more.className='act more-act'; more.textContent='更多交互（'+hidden.length+'）';
        more.onclick=function(){
          var wrap=document.createElement('div'); wrap.className='more-wrap';
          hidden.forEach(function(o){ mkObjBtn(o); });
          more.parentNode.replaceChild(wrap, more);
          // 展开后立刻滚动到可视区，别让新按钮掉到看不见的地方
          if($actions.scrollTo) $actions.scrollTo({top:$actions.scrollHeight, behavior:'smooth'});
        };
        $actions.appendChild(more);
      }
    }
  }
  // ===== NPC/物件：点击弹出右键式浮动菜单（贴合光标，无描述） =====
  var objPanelOpen=null;
  function toggleObjExpand(e, btn, o, acts){
    e.stopPropagation();
    if(objPanelOpen){ collapseObjPanel(); return; }
    openObjMenu(e, o, acts);
  }
  function openObjMenu(e, o, acts){
    var panel=document.createElement('div'); panel.className='obj-menu';
    (acts||[]).forEach(function(a){
      if(a.show && !a.show()) return;   // v20260915f：动作级门槛（如浇过的菜畦不再显「挑水浇畦」）
      if(a.sep){ var s=document.createElement('div'); s.className='op-sep'; panel.appendChild(s); return; }
      var b=document.createElement('button');
      b.className='op-btn'+(a.danger?' danger':'')+(a.icon?' has-ic':'');
      b.innerHTML=(a.icon?'<span class="op-ic">'+a.icon+'</span>':'')+'<span class="op-lb">'+a.label+'</span>';
      b.onclick=function(ev){ ev.stopPropagation(); collapseObjPanel(); if(a && typeof a.fn==='function') a.fn(); };
      panel.appendChild(b);
    });
    document.body.appendChild(panel);
    // v20260911k：浮动菜单挂在 body 上，不在 lockObserver 的观察容器内，需在创建时按当前闸门自行上锁
    if(interactBusy()){ var _pb=panel.querySelectorAll('button'); for(var _pi=0;_pi<_pb.length;_pi++) _pb[_pi].classList.add('locked'); }
    objPanelOpen={panel:panel};
    positionMenu(panel, e.clientX, e.clientY);
    setTimeout(function(){
      document.addEventListener('click', onDocCollapseObj, true);
      document.addEventListener('keydown', onKeyCollapseObj, true);
    }, 0);
    var sc=document.getElementById('scene'); if(sc) sc.addEventListener('scroll', collapseObjPanel, {once:true});
  }
  // 以光标为锚点定位，遇边界自动翻转，避免溢出屏幕
  function positionMenu(panel, x, y){
    var vw=window.innerWidth, vh=window.innerHeight;
    var mw=panel.offsetWidth, mh=panel.offsetHeight;
    var left=x, top=y;
    if(left+mw>vw-8) left=Math.max(8, vw-mw-8);
    if(top+mh>vh-8) top=Math.max(8, vh-mh-8);
    panel.style.left=left+'px'; panel.style.top=top+'px';
  }
  function onKeyCollapseObj(e){ if(e.key==='Escape') collapseObjPanel(); }
  function onDocCollapseObj(e){ if(objPanelOpen && !objPanelOpen.panel.contains(e.target)) collapseObjPanel(); }
  function collapseObjPanel(){
    if(!objPanelOpen) return;
    var p=objPanelOpen.panel; objPanelOpen=null;
    document.removeEventListener('click', onDocCollapseObj, true);
    document.removeEventListener('keydown', onKeyCollapseObj, true);
    if(p && p.parentNode) p.parentNode.removeChild(p);
  }
  // NPC → 可战敌人 映射：当 NPC 的 key 与敌人 id 不一致时，用此表指向真正的敌人
  var NPC_COMBAT_MAP = { 'heishan_zhai':['heishan_zei','heishan_zei'] };  // 小兵成组（演示敌群作战）
  // ===== 随从系统：可招募 NPC → 入队 → 共同战斗（CombatEngine 已支持 state.party） =====
  var COMPANION_DEFS = {
    liupan: {
      id:'liupan', name:'游侠·刘磐',
      hp:150, maxHp:150, mp:20, maxMp:20,
      atk:15, def:9, spd:15,
      element:'火', learnedMartial:['beng_quan'], realm:{}, equippedForce:[],
      critRate:0.04, hitRate:0.92,
      desc:'使一口环首刀，为人豪爽，愿随你闯荡江湖。'
    }
  };

  // ===== NPC 给予物品（v20260909u）：选择行囊物品给予NPC，增减好感或触发任务 =====
  var giveNpc = null;

  var giveSelectedIdx = null;
  var giveQty = 1;

  // ===== NPC 标准操作列：交谈 / 观察 / 给予 / 攻击 + 对象自带动作 =====
  // 教学期是否放行「给予」（v20260915c）：交付类差事如今只认「给予」——zt_food 的结清挂在
  //   triggers.js 的 zt_food_give（hook:'onGive'），「交谈」里已不再自动交付。若连这颗按钮一起
  //   屏蔽，玩家攥着干粮站在周听涛跟前却交不出去，教学链当场断死。故：教学期仅当
  //   「此人正是收件人 + 差事已应下 + 手里确有那份东西 + 尚未结清」时，才放出这一颗按钮。

  // ===== 常驻移动区：Dock 上方方向罗盘（位置即方位，永远可见） =====
  var DIR_ARROW={'北':'↑','南':'↓','东':'→','西':'←','东北':'↗','西北':'↖','东南':'↘','西南':'↙'};
  // 方向 → 罗盘 3×3 网格坐标 [行,列]（上北下南左西右东）
  var DIR_GRID={'北':[1,2],'东北':[1,3],'东':[2,3],'东南':[3,3],'南':[3,2],'西南':[3,1],'西':[2,1],'西北':[1,1]};
  function renderMoveBar(room){
    var bar=document.getElementById('move-bar'); if(!bar) return;
    bar.innerHTML=''; bar.classList.remove('pulse','has-exits');
    // 建筑内部房间：方向罗盘无意义，改显示「退出该房间」按钮（v20260825c）
    if(isBldRoom(state.room)){
      bar.classList.add('has-exits');
      var _ctr=document.createElement('div'); _ctr.className='mv-center'; _ctr.textContent='你在此'; bar.appendChild(_ctr);
      var _f=bldForRoom(state.room);
      var _wrap=document.createElement('div'); _wrap.className='mv-bld-exits';
      if(_f && !_f.ar.isRoot){
        var _up=document.createElement('button'); _up.className='mv-exit e-out';
        _up.innerHTML='<span class="mv-arrow">⬅</span><span class="mv-nm">返回正堂</span>';
        _up.onclick=function(){ bldMove('__bld__'+_f.key); }; _wrap.appendChild(_up);
      }
      var _go=document.createElement('button'); _go.className='mv-exit e-out';
      _go.innerHTML='<span class="mv-arrow">🚪</span><span class="mv-nm">返回街巷</span>';
      _go.onclick=function(){ leaveBldRoom(); }; _wrap.appendChild(_go);
      bar.appendChild(_wrap);
      return;
    }
    var exits=currentRoomExits();
    if(!exits.length) return;           // 无出口：隐藏移动区，不占空间
    bar.classList.add('has-exits');
    // 中心：当前所在
    var ctr=document.createElement('div'); ctr.className='mv-center'; ctr.textContent='你在此';
    bar.appendChild(ctr);
    // 移动门禁：由触发引擎经 state.moveGate 设定（任何"被追/护送"剧情可复用，如苦役营越狱逃亡）
    var gate=state.moveGate;
    var fwd=gate && gate.fwd;
    exits.forEach(function(o){
      var tid=o.tid || (room.exits && room.exits[o.dir]);
      var g=DIR_GRID[o.dir]||[2,2];
      // 门禁两种用法：fwd = 只许走这一个方向（剧情引导）；only = 方向白名单（v20260912f，
      //   教学开场「只许往南去中军场院」——别处一格都去不得）。
      var only = (gate && gate.only) || null;
      var blocked = (fwd && tid!==fwd) || (only && only.length && only.indexOf(o.dir)<0);
      var b=document.createElement('button');
      b.className='mv-exit e-'+o.dir+(o.kind?(' '+o.kind):'')+(blocked?' mv-blocked':'');
      b.dataset.dir=o.dir;   // 语义锚点：供通用指引系统高亮「该往哪走」的方位键
      b.style.gridRow=g[0]; b.style.gridColumn=g[1];
      b.innerHTML='<span class="mv-arrow">'+(DIR_ARROW[o.dir]||'➤')+'</span><span class="mv-nm">'+stripDir(o.name)+'</span>';
      if(o.place) b.title='出城前往：'+o.place;
      if(blocked){ b.onclick=function(){ toast(gate && gate.hint ? gate.hint : '此处暂不能去。'); }; }
      else { b.onclick=function(){ move(o.dir, tid); }; }
      bar.appendChild(b);
    });
  }
  // 当前房间的方位通路（兼容 ROOM_OBJECTS 与旧版 room.exits）
  function currentRoomExits(){
    var room=G.ROOMS[state.room]||bldRoom(state.room);
    if(!room) return [];
    // 建筑内部无方位罗盘：子区域与出入口以场景按钮呈现
    if(isBldRoom(state.room)) return [];
    if(isCityGrid(state.room)){
      var cp=state.flags.cityPos, m=genCityGrid(state.room);
      if(!m||!cp) return [];
      var DIRS=[['北',0,-1],['南',0,1],['东',1,0],['西',-1,0]];
      var ex=[];
      DIRS.forEach(function(d){
        var nx=cp.x+d[1], ny=cp.y+d[2];
        if(nx>=0&&nx<m.size&&ny>=0&&ny<m.size){
          if(!canEnterCell(state.room,nx,ny)) return;   // 焦土/未营建/断路不可通行
          var t=cellDisplayType(state.room,nx,ny);
          var ri=(t==='gate')?{gate:true,nm:'城门'}:null;
          ex.push({dir:d[0], name:d[0]+'·'+(ri?ri.nm:cellDisplayName(state.room,t)), icon:'🚪', tid:'__cell__', kind:'cell'});
        }
      });
      // 城门外向出口：经罗盘「出城」进入对应郊野（不同城门 → 不同郊野 → 不同邻城）
      var ct2=cellDisplayType(state.room, cp.x, cp.y);
      if(ct2==='gate'||ct2==='sentry'){
        var od=gateOutwardDir(state.room, cp.x, cp.y);
        var gt=(LF.PLACE_GATES && LF.PLACE_GATES[state.room] && LF.PLACE_GATES[state.room][od])||null;
        if(gt){
          var gp=(LF.PLACES && LF.PLACES[gt])||{};
          var gRoom=gp.entryRoom || gt;          // 指向真实房间（郊野入口格），而非郊野 id
          // v20260905i：罗盘钮名只标「出城」，去向写入 title，避免长名在 3×3 窄钮内截断
          ex.push({dir:od, name:od+'·出城', icon:'🚪', tid:gRoom, kind:'gateout', place:(gp.name||'郊野')});
        }
      }
      return ex;
    }
    var objs=roomObjs(room.id);
    var ex=objs.filter(function(o){return o.type==='exit';});
    if(ex.length) return ex;
    return Object.keys(room.exits||{}).map(function(dir){
      var tid=room.exits[dir];
      return {dir:dir, name:dir+'·'+exitDisplayName(tid), icon:'🚪', tid:tid};
    });
  }
  function renderSelf(room){
    // 研习武学：仅特定房间出现；调息已移至底部 dock
    if(roomCanLearn(room.id)){
      mkAct('self','📖','研习武学', function(){ openLearn(); }, null, 'learn_wu');
    }
  }

  function stripDir(nm){ return (nm||'').replace(/^[^·]*·/,''); }

  // —— 城门 / 郊野行军 辅助 ——
  // 取某城实际可用的城门方向（v20260905k：路网自适应，与 genCityGrid 门洞格同源）
  function availableGateDirs(pid){
    var c=(LF.CITIES||{})[pid];
    if(!c || !c.grid) return ['北','东','南','西'];
    return cityGateDirs(pid);
  }
  // 城门格 → 朝外方位
  function gateOutwardDir(cid,x,y){
    var m=genCityGrid(cid); if(!m) return null;
    var s=m.size;
    if(y===0) return '北'; if(y===s-1) return '南';
    if(x===s-1) return '东'; if(x===0) return '西';
    return null;
  }
  function gateCellCoord(pid, dir){
    var m=genCityGrid(pid); if(!m) return null;
    var s=m.size, cx=Math.floor(s/2), cy=Math.floor(s/2);
    if(dir==='北') return [cx,0];
    if(dir==='南') return [cx,s-1];
    if(dir==='东') return [s-1,cy];
    if(dir==='西') return [0,cy];
    return [cx,cy];
  }
  // 到达某城时落在指定城门（供郊野→城 哨兵出口使用）
  // 注意：目标城的该侧可能没有实际城门（单门山城只朝固定方向开门），此时落在墙/屋格会令玩家困在无路格。
  // 改为：若指定方位无「可进入的城门格」，就近落到最近的真正城门格。
  function nearestGateCell(pid, want){
    var m=genCityGrid(pid); if(!m||!m.size) return want||null;
    var s=m.size, best=null, bd=1e9;
    for(var _y=0;_y<s;_y++) for(var _x=0;_x<s;_x++){
      if(cellDisplayType(pid,_x,_y)!=='gate') continue;
      if(!canEnterCell(pid,_x,_y)) continue;
      var dd=Math.abs(_x-(want?want[0]:Math.floor(s/2)))+Math.abs(_y-(want?want[1]:Math.floor(s/2)));
      if(dd<bd){ bd=dd; best=[_x,_y]; }
    }
    return best;
  }
  // 宵禁（v20260911h · P3 · 门禁）：戌时鸣鼓落锁起，至次日寅时，城门昼夜紧闭；
  //   出不得城、也叫不开门——须待卯时启门，或于野外就地安营 / 在城中「投店打尖」。
  //   苦役营（kuyilao）不受此判：营门另有囚籍规条（见 leaveViaGate 首段），免得与教学链打架。
  function gateCurfew(cid){ return cid !== 'kuyilao' && isCurfewHour(); }
  function arriveAtGate(pid, dir){
    if(gateCurfew(pid)){
      log('〔门禁〕'+((LF.CITIES[pid]||{}).name||'城门')+'门紧闭——'+hourLabel()+'的夜鼓早已敲过。任你拍门，门内只回一句：「卯时再来。」','warn');
      toast('城门已闭，今夜不得入城。可在城外就地安营（帐篷 / 篝火 / 草席）或席地打盹，待卯时再入。');
      return;
    }
    setOnBoat(false);   // 进城即上岸
    var gc=gateCellCoord(pid, dir);
    var m=genCityGrid(pid);
    if(gc && m && m.size){
      var t=cellDisplayType(pid, gc[0], gc[1]);
      if(t!=='gate' || !canEnterCell(pid, gc[0], gc[1])){
        var fb=nearestGateCell(pid, gc);
        if(fb) gc=fb;
      }
    }
    if(!gc){ renderRoom(pid); return; }
    state.flags.cityPos={cid:pid, x:gc[0], y:gc[1]};
    advanceMinutes(10);   // v20260917b：入城门 10 分钟（门卒盘查；与出城门统一）
    renderRoom(pid);
  }
  // 从城门经郊野出城（罗盘点「出城」按钮或城门外向移动触发）
  function leaveViaGate(dir){
    var cp=state.flags.cityPos; if(!cp||cp.cid!==state.room){ toast('须先立于城门。'); return; }
    // 教学未毕业：苦役营（kuyilao）各出口被看死，须先探得门道、再赴南门决断出营
    if (state.room === 'kuyilao' && !(state.flags && state.flags.onb && state.flags.onb.done)) {
      toast('塌墙根未松动，官差看死各处出口。先回营中寻周先生问计、去囚室探默叔暗号，再赴南门决断出营。'); return;
    }
    // 宵禁（v20260911h · P3 · 门禁）：夜里城门自内落锁，出不得城
    if(gateCurfew(state.room)){
      log('〔门禁〕夜鼓已过，'+((LF.CITIES[state.room]||{}).name||'城')+'门落锁。守卒按刀一横：「卯时启门，今夜谁也不许出城。」','warn');
      toast('城门已闭（'+hourLabel()+'）——须待卯时启门。若城中无处安身，可去市集或城门内脚店「投店打尖」。');
      return;
    }
    var _fid = (LF.PLACE_GATES && LF.PLACE_GATES[state.room] && LF.PLACE_GATES[state.room][dir]) || null;
    var target = _fid ? ((LF.PLACES && LF.PLACES[_fid] && LF.PLACES[_fid].entryRoom) || _fid) : null;
    if(!target){ toast('此门暂无通途。'); return; }
    if(!exert('远行')) return;
    state.energy=Math.max(0,state.energy-2);
    state.food=Math.max(0,state.food-1); state.drink=Math.max(0,state.drink-1);
    advanceMinutes(10);
    log('你出'+((LF.CITIES[state.room]||{}).name||'城')+'的'+dir+'门，踏上城外古道……','sys');
    renderRoom(target);
  }
  // 出口显示名（处理 __gate__ 哨兵 → 入城提示）
  function exitDisplayName(tid){
    if(typeof tid==='string' && tid.indexOf('__gate__:')===0){
      var _p=tid.split(':'), pid=_p[1], dir=_p[2];
      var nm=(LF.CITIES&&LF.CITIES[pid]&&LF.CITIES[pid].name) || (LF.PLACES&&LF.PLACES[pid]&&LF.PLACES[pid].name) || pid;
      return dir+'·入城('+nm+')';
    }
    if(typeof tid==='string' && tid.indexOf('__cell__:')===0){
      var _c=tid.split(':');
      var _t=cellDisplayType(_c[1], +_c[2], +_c[3]);
      var _nm=cellDisplayName(_c[1], _t);
      // v20260913c：prison 格在子牢房罗盘上显示「牢房走廊」，避免「回牢房」歧义（回哪间？）
      if(_t==='prison') _nm='牢房走廊';
      return '往'+_nm;
    }
    var r=G.ROOMS[tid];
    if(!r) return tid;
    // 郊野行军格：罗盘出口用语义分段名（近郭/初野/深野/远野），不再显示冗长全名
    if(r.isField && r.nmBand) return r.nmBand;
    return r.name;
  }

  // ===== 行走探索 =====
  function move(dir, tid){
    if(combatMode!==null){ toast('正与敌缠斗，先应敌！'); return; }   // 战斗进行中禁止移动
    if(interactBusy()){ toast('先把话说完 / 先做决断，再动身。'); return; }   // 对话悬挂时不许挪窝（v20260911i）
    // 郊野→城 哨兵出口：落到对应城门
    if(typeof tid==='string' && tid.indexOf('__gate__:')===0){
      var _p=tid.split(':'); arriveAtGate(_p[1], _p[2]); return;
    }
    // 子房间退回城格（经面板 doors 进入的子房间，其出口指向具体城格）：直接落格，不走 move 能耗
    if(typeof tid==='string' && tid.indexOf('__cell__:')===0){
      var _c=tid.split(':');
      state.flags.cityPos={cid:_c[1], x:+_c[2], y:+_c[3]};
      advanceMinutes(5);   // v20260917b：进出子房间 5 分钟（一进一出有门槛感，但不重）
      save(state); renderRoom(_c[1], true);
      autoOnbRoutines();   // v20260916e：子房间退回城格同样触发自动应卯/销名（如从牢房内部出来即自动销名）
      return;
    }
    if(isCityGrid(state.room)){
      var _cp=state.flags.cityPos;
      if(_cp && _cp.cid===state.room){
        var _ct=cellDisplayType(state.room, _cp.x, _cp.y);
        // v20260911h：出城口与 currentRoomExits / leave_city 同口径 —— 城门格与岗哨格皆可出城
        // （苦役营南门是 sentry 格，此前只认 gate 会落到网格移动分支 → 越界报「此处无路可去」）
        if(_ct==='gate'||_ct==='sentry'){
          var _od=gateOutwardDir(state.room, _cp.x, _cp.y);
          if(_od===dir && LF.PLACE_GATES && LF.PLACE_GATES[state.room] && LF.PLACE_GATES[state.room][_od]){
            leaveViaGate(_od); return;
          }
        }
      }
      var dm={'北':[0,-1],'南':[0,1],'东':[1,0],'西':[-1,0]}[dir];
      if(dm){
        var _m=genCityGrid(state.room);
        if(!_cp||!_m){ toast('此处无路可去。'); return; }
        // v20260916f：牢房落锁——戌亥子丑寅卯（约晚8点至早6点）牢门上闩，囚室出不得。
        //   守的是「戌时前回牢」的规矩：回得早，白天照常进出；拖到锁门，就只能等卯时开锁。
        if(cellLockedHere()){
          toast('〔牢门落锁〕'+hourLabel()+'，牢门上着粗铁闩，从里头推不动——要到卯时方开。今夜你出不得这囚室。');
          return;
        }
        var nx=_cp.x+dm[0], ny=_cp.y+dm[1];
        if(nx>=0&&nx<_m.size&&ny>=0&&ny<_m.size && canEnterCell(state.room,nx,ny)){
          goCell(state.room, nx, ny);
          autoOnbRoutines();   // v20260916e：落格即触发自动应卯/销名（走进中军自动应卯、走进牢房自动销名）
          return;
        }
      }
      toast('此处无路可去。');
      return;
    }
    if(!exert('远行')) return;
    // 水路郊野：未乘船不得踏入（须先在本格「乘船渡江」）
    var _tgtRoom=G.ROOMS[tid];
    if(_tgtRoom && roomIsBoatRoute(_tgtRoom) && !isOnBoat()){
      toast('此处是水路津渡，须先点「乘船渡江」方能渡江。');
      return;
    }
    // 郊野逐格穿行：遇雨雪雾等天候额外耗费体力（WX_EFF.walk），城郭内不受影响
    var _oldR=G.ROOMS[state.room];
    var _wx=wxEff();
    var _fieldStep=(_oldR && _oldR.isField) || !!(tid && G.ROOMS[tid] && G.ROOMS[tid].isField);
    var _extra=(_fieldStep && _wx.walk) ? _wx.walk : 0;
    state.energy=Math.max(0,state.energy-4-_extra);
    state.food=Math.max(0,state.food-1);
    state.drink=Math.max(0,state.drink-1);
    advanceMinutes(30);
    // v20260916b：与城内同理——不带新信息的话就不往文本栏写。郊野每格都刷「沿途景物渐换」，
    //   走一趟能把半屏顶掉，而那句「景物渐换」玩家早从场景描述里看到了。
    //   只留真正要紧的一句：天候额外耗力（玩家据此决定要不要冒雨赶路、要不要先扎营）。
    if(_extra) log('（'+((WEATHERS[state.weather]||{}).n||'')+'中行路，分外耗费气力。）','warn');
    var _gone=state.room;
    renderRoom(tid);
    // 自动上岸：抵达陆地（城或非水路郊野）即离舟，整段水路只需乘一次船
    if(!roomIsBoatRoute(G.ROOMS[tid])) setOnBoat(false);
    var _gc=_gone && G.ROOMS[_gone];
    if(_gc && _gc.isField){
      var _left=fieldPlacedCamps(_gc);
      if(_left.length) log('你起身离营——'+_left.map(function(f){return f.name;}).join('、')+'留在原地（折返仍可寻回，亦可作来日途中歇脚）。','sys');
    }
  }
  // ===== 山河志 / RPG 地图 = 参考（点击仅显示信息，不作移动）=====
  function placeInfo(id, name, kind, st, desc, owner, isPlace){
    name = name || (LF.CITIES&&LF.CITIES[id]&&LF.CITIES[id].name) || (LF.PLACES&&LF.PLACES[id]&&LF.PLACES[id].name) || id;
    var p = (LF.PLACES&&LF.PLACES[id]) || (LF.CITIES&&LF.CITIES[id]) || {};
    var blurb = desc || p.blurb || p.desc || '';
    if(Array.isArray(blurb)) blurb = blurb[0]||'';
    toast('山河志 · '+name);
    log('〔山河志·'+name+'〕'+(blurb||'形胜之地。'),'sys');
  }
  function mapNodeInfo(rid){
    if(!rid) return;
    var r=G.ROOMS[rid]; var name=(r&&r.name)||rid;
    toast('山河志 · '+name);
    log('〔山河志·'+name+'〕此处是山河志上的一处所在，仅供参照，不可由此移动。','sys');
  }

  // 山河志地图旅行：点击房间节点直接前往（消耗与步行一致，不要求相邻出口）
  function goRoomOnMap(rid){
    var r=G.ROOMS[rid]; if(!r) return;
    if(combatMode!==null){ toast('正与敌缠斗，先应敌！'); return; }
    if(interactBusy()){ toast('先把话说完 / 先做决断，再动身。'); return; }   // 山河志跳格同样受闸（v20260911i）
    if(!exert('远行')) return;
    state.energy=Math.max(0,state.energy-4);
    state.food=Math.max(0,state.food-1);
    state.drink=Math.max(0,state.drink-1);
    advanceMinutes(30);
    log('你循山河志指引，跋涉至「'+r.name+'」。','sys');
    closeModal(); renderRoom(rid); save(state);
  }

  // ===== NPC 态度（由善恶双轴驱动，GAME_DESIGN 4.2） =====
  function npcAttitude(k){
    var n=G.DIALOGUES.npcs[k];
    var align=(n&&n.align)||'neutral';
    var c=state.chivalry, no=state.notoriety;
    if(align==='order'){
      if(no>=30) return '敌视';
      if(no>=10) return '戒备';
      if(c>=30) return '敬重';
      if(c>=10) return '友善';
      return '平常';
    }
    if(align==='shadow'){
      if(c>=30) return '戒备';
      if(no>=30) return '亲近';
      if(no>=10) return '友善';
      return '平常';
    }
    if(c>=30||no>=30) return '看重';
    return '平常';
  }

  // ===== NPC 对话 =====
  function talk(k){
    // v20260911k：对话悬挂中一律不许另开一段 —— 否则旧剧本的 next() 再也等不到回调，
    //   剧情链断在半途、锁状态也留在悬挂态（玩家看到的就是「点了 NPC 之后什么都点不动」）。
    if(askPending){ toast('先把眼前的话应了。'); return; }
    // 收掉可能残留的选项面板：必须走 removeTutChoices（它会一并解掉悬挂锁），
    //   旧版直接 tut.remove() 只摘 DOM、把 askPending 留在 true —— 正是死锁的源头之一。
    removeTutChoices();
    if(narrActive()){ toast('……且听他把话说完。'); return; }
    if(checkTriggers({hook:'onTalk', npc:k, room: state.room})) return;
  var n=G.DIALOGUES.npcs[k];
  if(!n){
    // 程序生成的城市 NPC（key 形如 'vendor@luoyang:2,3#0'）：改为开「交谈面板」，
    //   话题（问价/问农/问政/探问/查账/讨教…）都在面板里挑。
    //   旧版此处无条件 return —— 城内所有生成 NPC 的「交谈」点了都毫无反应（v20260912d 修）。
    var po=NPC_BY_KEY[k];
    if(po) talkInline(po);
    return;
  }
    var at=npcAttitude(k);
    log('〔'+n.name+'·态度：'+at+'〕','npc');
    if(at==='敌视'){
      log(n.name+'面色不豫：「久闻壮士凶名……恕不奉陪。」说罢拂袖而去。','npc');
      return;
    }
    var lines=n.lines||[];
    if(lines.length){
      state.npcSeq=state.npcSeq||{};
      var idx=(state.npcSeq[k]||0)%lines.length;
      state.npcSeq[k]=idx+1;
      log(lines[idx],'npc', n.name);
    } else {
      log('〔'+n.name+'〕他默然不语，似有心事。','npc');
    }
  }

  // ===== 行动分发 =====
  function handleAction(id, a){
    switch(id){
      case 'learn': openLearn(); break;
      case 'rest':  actRest(); break;
      case 'market': if(!exert('行走市集')) return; runEvent(findEvent('ev_merchant')); break;
      case 'city_patrol': if(!exert('巡查城防')) return; runEvent(findEvent('ev_escapees')); break;
      case 'city_stat': openModal('citystat', {cid:(a&&a.data?a.data.cid:state.room)}); break;
      case 'city_upgrade': tryUpgradeCity((a&&a.data?a.data.cid:state.room)); break;
      case 'city_build': {
        var _bda=(a&&a.data)||{};
        cityBuildState.cid=(_bda.cid!=null)?_bda.cid:state.room;
        cityBuildState.x=(_bda.x!=null)?_bda.x:(state.flags.cityPos?state.flags.cityPos.x:0);
        cityBuildState.y=(_bda.y!=null)?_bda.y:(state.flags.cityPos?state.flags.cityPos.y:0);
        openModal('citybuild',{cid:cityBuildState.cid,x:cityBuildState.x,y:cityBuildState.y});
        break;
      }
      case 'enter_building':
        if(a && a.data && a.data.building && !exert('步入店铺')) return;
        enterBldRoom((a&&a.data?a.data.building:'yaofu'), {kind:'city', cid:state.room, x:(state.flags.cityPos?state.flags.cityPos.x:0), y:(state.flags.cityPos?state.flags.cityPos.y:0)}, (a&&a.data?a.data.sign:null));
        break;
      // v20260910q：回营区按钮已取消——离开牢房走罗盘网格邻居（南·中军大帐等）
      case 'recruit':
        if(!exert('入营募兵')) return;
        openModal('army');   // 军营：面板内「募兵」区块按兵科/兵源/府库募兵（v20260922b）
        break;
      case 'army_manage':
        openModal('army');   // 治军：军队视图（募兵 / 整编 / 辎重 / 调兵）
        break;
      case 'leave_city': {
        // v20260905i：入口仅剩城内布防图「返回山河志（出城）」按钮；语义分层——
        // 立于可出城门口 → 真正出城并收起布防图露出主界面；其余位置 → 直接返回世界山河志（不再拦截）
        var _cp=state.flags.cityPos||{}, _cid2=_cp.cid||'';
        if(_cid2 && LF.CITIES[_cid2]){
          var _ct=cellDisplayType(_cid2, _cp.x, _cp.y);
          if(_ct==='gate'||_ct==='sentry'){
            var _od=gateOutwardDir(_cid2, _cp.x, _cp.y);
            if(_od && LF.PLACE_GATES && LF.PLACE_GATES[_cid2] && LF.PLACE_GATES[_cid2][_od]){
              if(currentModalKind==='map') closeModal();   // 布防图让位，露出郊野主界面
              leaveViaGate(_od);
              break;
            }
          }
        }
        openMap('world');
        break;
      }
      case 'edict': {
        if(!isCityGrid(state.room)){ toast('此处非城池中枢，无处发号。'); break; }
        openModal('edict'); break;
      }
      case 'mine_open': {
        if(!state.flags.mineIntro){
          state.flags.mineIntro=true;
          log('监工随手丢来一把粗石镐——石头绑木柄，凑合使。「这坑里的石头自己凿，凿出什么都是你的。」','npc');
          log('〔镐头〕粗石镐在手：小石堆三镐碎、大石堆碰不得；想凿更好的料，先得换把好镐。','sys');
        }
        openModal('mine');
        break;
      }
      case 'mine_cave': {
        if(!state.flags.caveIntro){
          state.flags.caveIntro=true;
          log('你推开矿道口的栅门，阴风扑面。矿道一级级向下探入黑暗——越深矿越好，也越要命。','env');
        }
        openModal('minecave');
        break;
      }
      case 'kitchen_cook': {
        if(!exert('生火造饭')) break;
        // 修正：原写作 state.energyMax（无此字段）→ 恒回退 100，会把精力上限算错；应为 state.maxEnergy
        state.energy=Math.min((state.maxEnergy||100), state.energy+8);
        advanceMinutes(10);   // v20260917b：生火造饭 10 分钟（热饭要等）
        log('伙房热气腾腾，你吃了一碗粗粮热汤，精力恢复少许。','sys');
        save(state);
        break;
      }
      case 'command_talk': {
        log('中军帐内，舆图铺展，你默记城防地势——苦役营虽小，亦可为根基。','sys');
        break;
      }
      case 'warehouse_view': {
        openModal('storage',{cid:state.room});
        break;
      }
      case 'drill_train': {
        if(!exert('操练武艺')) break;
        // v20260917c：操练吃一刻（30 分钟），让进度条走完再落结果（守卫已同步过，返回值语义不变）
        busyAct('演武场·操练一刻', 1000, function(){
          state.energy=Math.max(0,state.energy-3);
          advanceMinutes(30);   // v20260917b：操练一次 30 分钟（原 1 时辰过重）
          log('你在演武场挥汗操练了一刻，拳脚渐稳（精力-3）。','sys');
          renderStatus(); save(state);
        });
        break;
      }
      case 'sentry_look': {
        log('你登上岗哨，远眺四野——南面官道蜿蜒向渔阳，北望黑山隐约。','sys');
        break;
      }

      case 'leave_auto': {
        if(combatMode!==null){ toast('正与敌缠斗，先应敌！'); break; }
        var _cp=state.flags.cityPos; if(!_cp) break;
        var _cid=_cp.cid, _m=genCityGrid(_cid); if(!_m) break;
        var _sz=_m.size, _sx=_cp.x, _sy=_cp.y, _key=_sx+','+_sy;
        var _vis={}; _vis[_key]=1;
        var _q=[_key], _head=0, _par={}, _target=null;
        var _dirs=[[1,0],[-1,0],[0,1],[0,-1]];
        while(_head<_q.length){
          var _k=_q[_head++], _sp=_k.split(',');
          var _px=+_sp[0], _py=+_sp[1];
          // 只认「可出城」城门（该方向确有郊野通途）——部分城墙虽有门形却无路，若送玩家到死门会无路可出
          if((_m.cells[_py][_px]==='gate'||_m.cells[_py][_px]==='sentry') && canEnterCell(_cid,_px,_py)){
            var _gd=gateOutwardDir(_cid,_px,_py);
            if(_gd && LF.PLACE_GATES && LF.PLACE_GATES[_cid] && LF.PLACE_GATES[_cid][_gd]){ _target=_k; break; }
          }
          for(var _di=0;_di<4;_di++){
            var _nx=_px+_dirs[_di][0], _ny=_py+_dirs[_di][1];
            if(_nx<0||_nx>=_sz||_ny<0||_ny>=_sz) continue;
            var _nk=_nx+','+_ny;
            if(_vis[_nk]) continue;
            if(!canEnterCell(_cid,_nx,_ny)) continue;
            _vis[_nk]=1; _par[_nk]=_k; _q.push(_nk);
          }
        }
        if(!_target){ toast('无路可通城门——断路阻隔，须先填平断路再行出城。'); break; }
        var _path=[], _k2=_target;
        while(_k2){ _path.push(_k2); _k2=_par[_k2]; }
        _path.reverse();
        var _steps=_path.length-1, _eng=0;
        for(var _si=1;_si<_path.length;_si++){
          var _pp=_path[_si].split(',');
          var _ri=(_si===_path.length-1)?{eng:1}:null;
          _eng+=(_ri?_ri.eng:2);
        }
        if(!exert('前往城门')) return;
        state.energy=Math.max(0,state.energy-_eng);
        state.food=Math.max(0,state.food-_steps);
        state.drink=Math.max(0,state.drink-_steps);
        advanceMinutes(_steps*10);   // v20260917b：城内穿行 10 分钟/格（原每格 1 时辰）
        var _tp=_target.split(',');
        state.flags.cityPos={cid:_cid, x:+_tp[0], y:+_tp[1]};
        // v20260905h：只寻路抵门、不再代做出城——出城由玩家立于城门时以罗盘朝外方向完成
        log('你沿街巷穿行'+_steps+'格，抵达'+((LF.CITIES[_cid]||{}).name||'城')+'城门（精力-'+_eng+'）。城门在望——看罗盘，朝城外方向踏出即离城。','sys');
        renderRoom(_cid, true); save(state);
        if(currentModalKind==='map') openModal('map');
        break;
      }
      case 'siege':
        if(!exert('起兵略地')) return;
        if(combatMode!==null){ toast('正与敌缠斗，先应敌！'); break; }
        if(typeof armyActive==='function' && armyActive()){   // 已成军 → 战前编成 + 三段攻城（v20260921a）
          openSiegePrep(state.room);
          break;
        }
        pendingSiegeCid=state.room;
        var _bg=burnedGates(state.room);
        if(_bg>0) log('城门焚毁未修，守军凭残垣据守，士气涣散！','sys');
        startCombat('city_guard', {guardMul: siegeGuardMul(state.room)});
        break;
      case 'patrol': if(!exert('深入山林')) return;
        log('你深入山林，只闻松涛与远鸟，一路无奇遇。','sys'); break;
      // ─── 教程：劳作 / 塌墙根决断（v20260911h · P3：劳作吃时辰 —— 见 laborTick）───
      // v20260920h：担石劳作改搬运闭环 —— 按钮已由「乱石堆·装担」「卸料台·卸料入仓」承接，
      //   此处只作兜底转发；「下地务农」无脑按钮已删除（农事工分改由真实操作记取）。
      case 'labor_yard': { stoneLoad(); break; }
      case 'haul_stones': { stoneUnload(); break; }
      case 'survey_yard':
        if(!exert('环顾四周')) return;
        if(!checkTriggers({hook:'onCustom', room: state.room}))
          log('你又环顾了一圈劳役场，乱石、藤蔓、往来狱卒——一切如旧。','sys');
        break;
      case 'wall_choose':
        if(!exert('勘察墙根')) return;
        openEscapeHub(isCityGrid(state.room) ? 'kuyilao' : 'camp_wall');
        break;
      case 'gate_choose':
        if(!exert('决断出营')) return;
        openEscapeHub('camp_gate');
        break;
      case 'wood_cut':
        // v20260924z3：柴林伐木 —— cutWood 原为死代码（无任何房间挂载），木料除仓库外没有营内稳定出处。
        //   现在挂在柴林「老树」场景物上：每日限三回、耗时半个时辰、有斧得 2 材/无斧 1 材。
        cutWood(); break;
      case 'wood_cut_bare':
        cutWood(); break;   // 无斧折枝与有斧伐木共用同一逻辑（cutWood 内部按有无斧头给 1/2 材）
      case 'borrow_axe':
        if(!packFind('futou') && !packFind('tiefu')){
          packAdd('futou', 1);
          log('你从斧架上取了把豁口锈斧，掂了掂——趁手是趁手，用完了记得还回去。','good');
          save(state); afterPackChange();
        } else { toast('你手里已有斧头。'); }
        break;
      case 'train_dummy':
        if(!exert('戳木人桩')) return;
        // v20260924z2：计数不在此处 —— 胜利结算（jobTick('dummy')）才是官方口径，
        //   木人改「交手满三回合即算练成」后由战斗胜利统一计（combat.js dqResolveRound）。
        if(state.flags.route) state.flags.route.dummy_done=true; save(state);
        startCombat('camp_dummy', { tutorial: true });   // 木人桩即战斗教学场：首次为引导演练，练成后转为普通对练
        break;
      case 'survey_kitchen':
        if(!exert('打量伙房')) return;
        log('你打量伙房：灶台下几瓶药材，墙角杂粮成堆。鲁大勺掌勺，林娘的蒙汗草也在——下药业（路线3）的物资本就在此。','sys');
        break;
      case 'survey_warehouse':
        if(!exert('翻找仓库')) return;
        if(!checkTriggers({hook:'onCustom', room: state.room}))
          log('仓库里麻袋堆、木箱、货架三处堆着旧物——翻哪一处，看你要找什么；翻过即空，隔天再来。','sys');
        break;
      case 'survey_mine':
        if(!exert('勘察矿道')) return;
        log('你勘察矿道：向墙根延伸，石四说底下连着暗渠。若得吴算盘指水道走向，水渠夜遁线（路线8）便成了。','sys');
        break;

      // ═══ P3 时间闭环（v20260911h）：伙房限时换饭 / 回牢销名 / 客栈打尖 ═══
      // 这三件事把「已亮相的时辰」变成真正要照料的东西：吃、睡、点卯都得看更鼓。
      case 'mess_hall': {
        var _o = onbF();
        if(!_o || !_o.started || _o.done){ toast('此处是营中伙房，非营中之人换不得饭。'); break; }
        if(isDeadHour()){
          log('〔伙房〕'+hourLabel()+'——灶火早熄，锅里只剩刷锅水。大勺隔着案板摆手：「明日卯时开灶；戌时前领夜粥，过了点自己饿着。」','warn');
          break;
        }
        // v20260916g：旷役已改跨日即时罚（扣口粮+好感），此处不再有「按罚例加倍」的延迟账——换饭恒定一枚木片
        var _cost = 1;
        var _pai = packFind('lao_pai'), _have = _pai ? (_pai.count || 1) : 0;
        if(!_have){ log('〔伙房〕你手里没有「劳字木片」——去中军场院「担石劳作」，干满三工发一枚（农田下地、仓库搬石也记工分）。','warn'); break; }
        if(_have < _cost){ log('〔伙房〕换一份饭要 '+_cost+' 枚劳字木片（现有 '+_have+' 枚）。','warn'); break; }
        packConsume('lao_pai', _cost); afterPackChange();
        var _hot = isMessHour();
        packAdd(_hot ? 'fan' : 'xizhou', 1); afterPackChange();
        _o.messToday = (_o.messToday||0) + 1;
        if(_hot) log('〔伙房〕'+hourLabel()+'正逢饭点：你把木片交上，大勺盛了一碗热饭热汤（劳字木片-'+_cost+' · 得干粮×1）。','good');
        else log('〔伙房〕饭点已过，灶上只剩半锅冷粥——大勺还是给了你一瓢（劳字木片-'+_cost+' · 得稀粥×1）。','sys');
        // 头一回领饭 → 顺手把「灶上一口热饭」这桩例事挂上：领了不算，吃下去才算（进度记在 LF.onEat）
        if(!(state.flags.task && state.flags.task.mess_started)){
          state.flags=state.flags||{}; state.flags.task=state.flags.task||{};
          state.flags.task.mess_started=true;
          acceptQuest('mess_meal');
          log('〔伙房〕大勺敲了敲锅沿：「领了饭就趁热吃——点下方「🎒 行囊」，选那张干粮，点「使用」。别揣着，凉了噎得慌。」','order');
        }
        save(state);
        break;
      }
      // 应卯点名（v20260915d→v20260916e）：营规已自动应名（autoOnbRoutines），此处按钮保留为手动补应。
      case 'roll_call': {
        var _rr = onbF();
        if(!_rr || !_rr.curfewSet || _rr.done){ log('〔点卯〕册上没有你的名字，应不得卯。','sys'); break; }
        if(!isRollHour()){
          log('〔点卯〕'+hourLabel()+'——此刻无人唱名。应卯在卯至午（天亮开工到晌午，过午不候）。','warn');
          break;
        }
        if(_rr.rollDone){ log('〔点卯〕今日已应过卯，牢头展册摆手：「自去干活。」','sys'); break; }
        doRollCall(false);
        break;
      }
      case 'check_in': {
        var _o2 = onbF();
        if(!_o2 || !_o2.curfewSet){ log('〔点卯〕营中尚无点卯之规，无人管你几时回牢。','sys'); break; }
        if(_o2.done){ log('〔点卯〕你已脱籍出营，牢头摆手：「去罢，营规管不着你了。」','sys'); break; }
        if(_o2.checkInDone){ log('〔点卯〕今日已销过名。牢头翻册摆手：「自去。」','sys'); break; }
        if(isCurfewHour()){
          if(_o2.lateDone){ log('〔点卯〕牢头斜眼一瞥：「今日迟了，鞭子也领过了。明日赶早。」','warn'); break; }
          // 与 laotou_late 触发器同一套账（lateDone 互锁，两条路径不会重复受罚），且不至于打死人
          _o2.lateDone = true; _o2.lateCount = (_o2.lateCount||0) + 1; _o2.missCount = (_o2.missCount||0) + 1;
          var _dmg = Math.min(15, Math.max(0, state.hp - 1));
          state.hp = Math.max(1, state.hp - _dmg);
          _o2.favor = (_o2.favor||0) - 1;
          log('〔点卯〕'+hourLabel()+'——牢头阴沉着脸点你的名：「迟了。」','warn');
          log('你挨了三鞭（气血-'+_dmg+'），牢头记你一次晚归（营中好感-1）。','combat');
          renderStatus(); save(state);
        } else {
          _o2.checkInDone = true; _o2.favor = (_o2.favor||0) + 1;
          log('〔点卯〕你赶在戌时前回牢廊销了名。牢头翻册点头：「'+hourLabel()+'，算你今日勤勉。」（营中好感+1）','good');
          save(state);
        }
        break;
      }
      case 'inn_stay': {
        if(!isCityGrid(state.room)){ toast('此处无店可投。'); break; }
        if(state.gold < INN_FEE){ toast('囊中羞涩（房钱 '+INN_FEE+' 两），店家摇摇头不肯赊账。'); break; }
        state.gold -= INN_FEE;
        var _h = hourNow(), _to = (((3 - _h) % 12) + 12) % 12; if(_to === 0) _to = 12;   // 醒来即在卯时（启门 / 开牢之时）
        var _wasNight = isCurfewHour(_h);
        advanceTime(_to);
        var _es2 = effectiveStats();
        state.hp = _es2.maxHp; state.mp = _es2.maxMp; state.energy = state.maxEnergy;
        state.food = state.maxFood; state.drink = state.maxDrink;
        log('〔打尖〕你在'+((LF.CITIES[state.room]||{}).name||'城')+'的脚店要了间板房，热汤洗尘'+
            (_wasNight ? '，听更鼓数到三' : '')+'，一觉睡到天明——醒来已是'+hourLabel()+'（房钱-'+INN_FEE+'两，气血内力尽复）。','good');
        renderStatus(); renderRoom(state.room, true); save(state);
        break;
      }
      // ─── 战斗试炼 ───
      case 'spar_bandit': if(!exert('应战')) return; startCombat('bandit'); break;
      case 'spar_chief':  if(!exert('应战')) return; startCombat('bandit_chief'); break;
      case 'spar_turban': if(!exert('应战')) return; startCombat('yellow_turban'); break;
      // ─── 新战斗：木人桩 / 犬舍野犬 / 黑山寨 ───
      case 'spar_dummy':
        if(!exert('应战')) return;
        // 记一笔「这次是领了差事的」，由 LF.onCombatResult 在打赢时结清（撤了不算）
        if(state.flags && state.flags.task && state.flags.task.dummy_started && !state.flags.task.dummy_done) state.flags.task.dummy_pending=true;
        startCombat('dummy'); break;
      case 'spar_dog':
        if(!exert('逗弄野犬')) return;
        // 记一笔「这次是来练撤的」，由 LF.onCombatResult 在撤离成功时结清（打死了不算）
        if(state.flags && state.flags.task && state.flags.task.dog_started && !state.flags.task.dog_done) state.flags.task.dog_try=true;
        startCombat('stray_dog'); break;   // 犬舍练手：弱敌，专练「撤退」
      case 'spar_heishan_zei': if(!exert('应战')) return; startCombat('heishan_zei'); break;
      case 'spar_heishan_zhu': if(!exert('应战')) return; startCombat('heishan_zhu'); break;
      case 'battle_hua_xiong':
        if(!exert('应战')) return;
        if(state.reputation < 20){ log('时机未至——声望未达 20（当前 '+state.reputation+' · '+repTitle(state.reputation)+'），先扬名立万。','sys'); return; }
        startCombat('hua_xiong'); break;
      case 'visit_luoyang':
        if(!exert('远赴洛阳')) return;
        if(!state.quest.luoyang){ log('洛阳城门紧闭——需先力斩华雄扬名立万，方得入城。','sys'); return; }
        move('南','luoyang'); break;
    }
  }

  // [v20260909j] 野外采药 / 伐木 / 木工台采集制作逻辑已抽离 → shared/core/crafting.js

  // ===== 通用可放置物品（模板驱动：物品定义 place 字段 → 场景对象） =====
  // 放置物动作表：place.actions 字符串 → 动作函数（物品数据外置，动作需在此注册）
  // 旧存档兼容：早期放置数据仅存 {key:'tent'}（无 defId），用此表回填物品
  var PLACE_KEY_DEF = { tent:'zhangpeng', p_bench:'gongzuotai', campfire:'campfire', sleepmat:'sleepmat' };
  var PLACE_ACTIONS = {
    tent: function(){
      return [
        {label:'休息…', icon:'🧘', fn:function(){ closeModal(); openRestModal('tent'); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('tent'); }}
      ];
    },
    shuicao: function(p){
      return [
        {label:'饮水', icon:'💧', fn:function(){ shuicaoDrinkPlaced(p); }},
        {label:'添水', icon:'🪣', fn:function(){ shuicaoFillPlaced(p); }},
        {label:'装水入袋', icon:'💧', fn:function(){ shuicaoDrawToBag(p); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('shuicao'); }}
      ];
    },
    p_bench: function(){
      return [
        {label:'制作…', icon:'🔨', fn:function(){ openModal('craft', {bench:'bench'}); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('p_bench'); }}
      ];
    },
    campfire: function(){
      return [
        {label:'烤火取暖…', icon:'🔥', fn:function(){ closeModal(); openRestModal('campfire'); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('campfire'); }}
      ];
    },
    sleepmat: function(){
      return [
        {label:'躺下小睡…', icon:'💤', fn:function(){ closeModal(); openRestModal('sleepmat'); }},
        {label:'收起', icon:'📦', fn:function(){ packUpPlaced('sleepmat'); }}
      ];
    }
  };
  // 休息设施配置：不同设施恢复效率不同，休息时长可由玩家自选
  var REST_KINDS = {
    tent:     { name:'帐篷',   hp: 0.35, mp: 0.35, en: 0.40, fd: 0.30, dr: 0.30 }, // 帐篷：全恢复效率最高
    sleepmat: { name:'草席',   hp: 0.22, mp: 0.22, en: 0.32, fd: 0.20, dr: 0.20 }, // 草席：中等
    campfire: { name:'篝火',   hp: 0.10, mp: 0.10, en: 0.38, fd: 0.50, dr: 0.50 }, // 篝火：暖身解饥渴、精力恢复快
    wild:     { name:'野外露宿', hp: 0.12, mp: 0.12, en: 0.30, fd: 0.16, dr: 0.16 }, // 荒野扎营：以地为席，聊胜于无
    ground:   { name:'席地打盹', hp: 0.08, mp: 0.08, en: 0.22, fd: 0.12, dr: 0.12 }  // 就地：聊胜于无
  };
  // 天候对野外歇息效率的折扣（键=天候索引；无折扣项=1）。帐篷遮风挡雨不受天候影响；
  // 城市/建筑内歇息同样不受影响（outdoorRestFactor 先判 isField）。
  var WX_REST={
    3:{campfire:0.85, sleepmat:0.9, wild:0.9,  ground:0.85},  // 微雨：略打折扣
    4:{campfire:0.5,  sleepmat:0.6, wild:0.55, ground:0.5},   // 大雨：露天皆难安身
    5:{campfire:0.8,  sleepmat:0.8, wild:0.75, ground:0.7}    // 雪：天寒，无蔽风雪者折扣
  };

  // 打开自由时长休息面板（设施决定效率；战败只能就地打盹）

  // ══ 仓库系统（v20260907k）：城中仓库 30 格，可存可取；苦役营初始存有木料石料 ══
  var storageCid=null;   // 当前仓库所在城（openModal 写入）；storageSel 已随仓库簇移入 shared/core/storage.js
  // 牢中打盹场景（v20260911k）：时辰尚未启用（教学期）且人在牢里时，
  //   「歇几个时辰」这套问法本身就是个假问题 —— 更鼓还没开始走，玩家也答不上来。
  //   故改为一键「就此睡去」，睡多久由天定（见 doNap），醒来只知天光未变。

  // 执行自由时长休息：推进时间并按要求恢复（野外天候差时打折，见 outdoorRestFactor）

  // 牢中一觉（v20260911k）：老师傅口中那句「也不知道睡了多久」——
  //   时长随机 1~3 时辰，只用来自算恢复量，绝不报给玩家；时辰未启时时钟本就冻结，
  //   醒来仍是那一线昏暗天光，昼夜不分（正是文案要传达的处境）。

  // 城市格放置物定位（v20260825b）：城市网格内放置物带 {cell:{x,y}}，按格隔离，不再全城共享；
  // 旧存档无格坐标的放置物视为位于城心格，保证不"消失"。
  function placedCellTag(roomId){
    var cp=state.flags && state.flags.cityPos;
    if(!cp || !isCityGrid(roomId) || cp.cid!==roomId) return null;
    return {x:cp.x, y:cp.y};
  }
  function placedInCell(p, roomId, tag){
    if(!tag) return true;                       // 非城市房间：全部在当前房间可见
    var c=p.cell;
    if(!c){                                     // 旧存档无格数据 → 归城心格
      var m=genCityGrid(roomId); if(!m) return true;
      var s=m.size; c={x:Math.floor(s/2), y:Math.floor(s/2)};
    }
    return c.x===tag.x && c.y===tag.y;
  }

  // 玩家放置物 → 场景物件（统一映射，城市/野外/建筑内部房间共用）
  function placedFeature(p){
    if(p.bp){
      var bp = LF.BUILD[p.bp] || {};
      if(p.done){
        return {type:'feature', key:bp.key||p.key, icon:itemIconHTML({name:bp.doneName||'建筑'}, 14), name:bp.doneName||'建筑', desc:bp.desc||'', actions:buildDoneActions(bp.key||p.key, bp)};
      }
      return {type:'feature', key:bp.key||p.key, icon:itemIconHTML({name:bp.siteName||'营造中'}, 14), name:bp.siteName||'营造中', desc:bp.desc||'', actions:buildSiteActions(bp.key||p.key)};
    }
    var defId = p.defId || PLACE_KEY_DEF[p.key];
    var pl = ((LF.ITEMS[defId]||{}).place) || {};
    var acts = (PLACE_ACTIONS[pl.actions] || function(){ return []; })(p);
    return {type:'feature', key:pl.key||p.key, icon:itemIconHTML({name:pl.name||'未知物'}, 14), name:pl.name||'未知物', desc:pl.desc||'', actions:acts};
  }
  // 合并静态 ROOM_OBJECTS 与玩家动态放置物，供场景/列表/出口统一读取
  function roomObjs(roomId, opts){
    // 建筑内部房间：interior/子区域的物件 + 子区域跳转 + 玩家在房内放置物 → 场景按钮
    // （返回街道/返回正堂统一收进底部移动罗盘，见 renderMoveBar 的 isBldRoom 分支，避免重复）
    if(isBldRoom(roomId)){
      var _f=bldForRoom(roomId), _out=[];
      if(_f){
        (_f.ar.objs||[]).forEach(function(o,i){
          _out.push({type:'feature', key:'bldo_'+roomId+'_'+i, icon:o.icon, name:o.name, desc:o.desc, actions:bldActsFilter(o.acts)});
        });
        (_f.ar.areas||[]).forEach(function(a){
          _out.push({type:'feature', key:'blda_'+roomId+'_'+a.key, icon:'🚪', name:a.label||a.key, desc:'', direct:true, actions:[{label:a.label||a.key, icon:'🚪', fn:(function(tid){ return function(){ bldMove(tid); }; })('__bld__'+_f.key+'@'+a.key)}]});
        });
        if(!_f.ar.isRoot){
          _out.push({type:'feature', key:'bldup_'+roomId, icon:'⬅', name:'返回'+(_f.b.rootName||_f.b.name), desc:'', direct:true, actions:[{label:'返回'+(_f.b.rootName||_f.b.name), icon:'⬅', fn:(function(tid){ return function(){ bldMove(tid); }; })('__bld__'+_f.key)}]});
        }
        _out.push({type:'feature', key:'bldout_'+roomId, icon:'🚪', name:'返回街道', desc:'', direct:true, actions:[{label:'走出此处，回到街巷', icon:'🚪', fn:function(){ leaveBldRoom(); }}]});
      }
      // 玩家在房内放置的物件（帐篷/篝火…）：按本房间 id 隔离，进店/进房后也保留可见（v20260825c）
      var _placed=(state.placed && state.placed[roomId]) || [];
      _placed.forEach(function(p){ var _o=placedFeature(p); if(_o) _out.push(_o); });
      return _out;
    }
    var base = ROOM_OBJECTS[roomId] || [];
    var placed = (state.placed && state.placed[roomId]) || [];
    var _cellTag = placedCellTag(roomId);
    var dyn = placed.filter(function(p){ return placedInCell(p, roomId, _cellTag); }).map(placedFeature);
    // 放置物覆盖同 key 的静态 feature（如收起的工作台摆放后，静态木工台不再重复显示）
    var dynKeys={}; dyn.forEach(function(o){ dynKeys[o.key]=1; });
    // placedOnly：仅渲染玩家放置物（城市网格等由 cell 动作/左栏 NPC 承担场景内容，屏蔽旧版静态 ROOM_OBJECTS 条目）
    var filteredBase = opts && opts.placedOnly ? [] : base.filter(function(o){ return !(o.type==='feature' && dynKeys[o.key]); });
    return filteredBase.concat(dyn);
  }
  function placeInspect(){
    if(!packInspect || packInspect.kind!=='pack') return;
    var idx=packInspect.idx; var it=state.pack[idx];
    if(!it) return;
    var _tag=placedCellTag(state.room);   // 城市网格：放置物归当前格（cell），跨格隔离
    // 图纸类：依图在房中营造建筑（多阶段、需填充材料）
    var bpId = (LF.ITEMS[it.defId]||{}).blueprint;
    if(bpId){
      var bp = LF.BUILD[bpId] || {};
      state.placed = state.placed || {};
      state.placed[state.room] = state.placed[state.room] || [];
      if(state.placed[state.room].some(function(o){ return o.bp===bpId && placedInCell(o, state.room, _tag); })){ toast('此处已在营造'+(bp.siteName||'该建筑')+'。'); return; }
      if(it.count && it.count>1){ it.count--; } else { state.pack[idx]=null; }
      state.placed[state.room].push({key:bp.key, defId:it.defId, bp:bpId, stage:0, got:{}, cell:_tag});
      packInspect=null;
      afterPackChange();
      log('你展开'+it.name+'，依图在'+curRoom().name+'勘定地基，开工营造。','sys');
      if(currentModalKind==='pack'){ var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
      return;
    }
    var pl = (it && (it.place || ((LF.ITEMS[it.defId]||{}).place))) || null;
    if(!(it.placeable || pl)) return;
    state.placed = state.placed || {};
    state.placed[state.room] = state.placed[state.room] || [];
    if(state.placed[state.room].some(function(o){ return o.key===pl.key && placedInCell(o, state.room, _tag); })){ toast('此处已支有'+pl.name+'。'); return; }
    if(it.count && it.count>1){ it.count--; } else { state.pack[idx]=null; }
    state.placed[state.room].push({key:pl.key, defId:it.defId, cell:_tag});
    packInspect=null;
    afterPackChange();
    log('你支起'+pl.name+'，安置于'+curRoom().name+'。','sys');
    if(currentModalKind==='pack'){ var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
  }
  function packUpPlaced(key){
    state.placed = state.placed || {};
    var arr = state.placed[state.room];
    var _tag=placedCellTag(state.room);
    if(!arr || !arr.some(function(o){ return o.key===key && placedInCell(o, state.room, _tag); })){ toast('此处并无此物可收。'); return; }
    var p=null;
    for(var i=0;i<arr.length;i++){ if(arr[i].key===key && placedInCell(arr[i], state.room, _tag)){ p=arr[i]; arr.splice(i,1); break; } }
    var defId = p.defId || PLACE_KEY_DEF[p.key];
    var ok = packAdd(defId, 1);
    if(!ok){ if(p) arr.push(p); toast('行囊已满，无法收起。'); return; }
    packInspect=null;
    afterPackChange();
    log('你收起'+((LF.ITEMS[defId]||{}).name||'此物')+'，收进行囊。','sys');
    if(currentModalKind==='pack'){ var f=document.getElementById('pack-float'); if(f) f.style.display='none'; }
  }
  // ===== 文字图标：印章式，按分类配色 =====
  // v20260924z7：AI 生成古风物品图标（assets/icons/*.png，工笔水墨+圆形木徽章底）。
  //   有图的物品用图（行囊格子/提示浮层直接显示），没有的仍走 emoji+名字 —— 逐步把 emoji 替换成图片素材。
  var ICON_SPR = { img: 'assets/icons/items.webp',
    // v20260924z8：AI 古风物品图标统一拼成一张雪碧图（560x560，4x4 格），
    //   一个请求加载全部 15 枚，background-position 百分比定位，杜绝逐图加载卡顿。
    map: {
      fan:'0 0', xizhou:'33.333 0', mucai:'66.667 0', shitiao:'100 0',
      futou:'0 33.333', tiekuangshi:'33.333 33.333', roubao:'66.667 33.333', caoyao:'100 33.333',
      yeguo:'0 66.667', mutou:'33.333 66.667', zhuzi:'66.667 66.667', tiekuai:'100 66.667',
      rope:'0 100', bumu:'33.333 100', chutou:'66.667 100'
    } };
  var ICON_IMG = {}; // 兼容旧引用（已并入雪碧图）
  function itemIconHTML(it, px){
    var n = (it && (it.name || it.defId)) || '';
    var cat = (it && it.cat) || '';
    px = px || 16;
    if(it && ICON_SPR.map[it.defId]){
      var w = Math.max(20, px + 6);
      /* v20260924z11：独立 48px 图标优先（无拉伸、内容充满），缺文件回退雪碧图 */
      return '<img class="item-pic48" data-cat="'+cat+'" src="assets/icons/items48/'+it.defId+'.png" alt="'+(it.name||'')+'" style="width:'+w+'px;height:'+w+'px;object-fit:contain;" onerror="this.style.display=\'none\';">';
    }
    var em = (it && it.icon) ? it.icon : '';
    var fs = Math.min(px, 16);
    return '<span class="ic-txt ic-cat" data-cat="'+cat+'" style="font-size:'+fs+'px;">'+(em?em+' ':'')+'<b>'+n+'</b></span>';
  }
  // ===== 营造系统：蓝图 → 工地 → 填充材料 → 分阶搭建 → 落成 =====
  // 工地/建筑在 placed 中以 { key, defId, bp, stage, got, done } 存储（见 roomObjs 渲染）
  function findPlacedBp(siteKey){
    var arr = (state.placed && state.placed[state.room]) || [];
    var _tag=placedCellTag(state.room);
    for(var i=0;i<arr.length;i++){ if(arr[i].key===siteKey && placedInCell(arr[i], state.room, _tag)) return arr[i]; }
    return null;
  }
  function buildSiteActions(siteKey){
    return [
      {label:'查看进度', icon:'📋', fn:function(){ inspectBuildSite(siteKey); }},
      {label:'填充材料', icon:'🧺', fn:function(){ openModal('build', {site:siteKey}); }},
      {label:'搭建', icon:'🔨', fn:function(){ buildStage(siteKey); }}
    ];
  }
  function buildDoneActions(siteKey, bp){
    var acts = [];
    if(bp.done === 'forge'){
      acts.push({label:'炉膛…', icon:'🔥', fn:function(){ openForgePanel(siteKey); }});
      acts.push({label:'打造…', icon:'⚒️', fn:function(){ openModal('craft', {bench:'forge'}); }});
    }
    // 蓝图含 interior 时：建成后可步入，成为可进出的独立房间（左下 NPC + 上方交互物件）
    if(bp.interior && bp.interior.length){
      acts.push({label:'进·'+(bp.doneName||'屋内'), icon:itemIconHTML({name:bp.doneName||'屋内'},13), fn:function(){
        var _p=findPlacedBp(siteKey); if(_p) enterBldRoom('site_'+siteKey, {kind:'room', room:state.room, bp:_p.bp});
      }});
    }
    acts.push({label:'端详', icon:'👁', fn:function(){ log('〔'+bp.doneName+'〕'+(bp.desc||''), 'sys'); }});
    return acts;
  }
  function inspectBuildSite(siteKey){
    var p = findPlacedBp(siteKey); if(!p) return;
    var bp = LF.BUILD[p.bp]; if(!bp) return;
    var stages = bp.stages || [];
    if(p.done){ log('〔'+bp.doneName+'〕'+bp.desc, 'good'); return; }
    var stage = stages[p.stage];
    if(!stage){ log('〔'+bp.siteName+'〕工事已完，只待收尾落成。', 'sys'); return; }
    var parts = [];
    for(var k in stage.need){
      var it = LF.ITEMS[k] || {};
      parts.push((it.name||k)+' '+(p.got[k]||0)+'/'+stage.need[k]);
    }
    var next = stages[p.stage+1] ? '；完成后将进行「'+stages[p.stage+1].name+'」' : '；此为最后一程，搭建完毕即可落成';
    log('〔'+bp.siteName+'·第'+(p.stage+1)+'/'+stages.length+'阶·'+stage.name+'〕所需：'+parts.join('、')+next, 'sys');
  }
  function buildAddMat(siteKey, matId){
    var p = findPlacedBp(siteKey); if(!p) return;
    var bp = LF.BUILD[p.bp]; if(!bp || p.done) return;
    var stage = (bp.stages||[])[p.stage]; if(!stage) return;
    var need = stage.need[matId]; if(!need) return;
    if((p.got[matId]||0) >= need){ toast('该材料已填满此阶段所需。'); return; }
    var cur = packFind(matId);
    if(!cur || (cur.count||0) < 1){ toast('行囊中无'+(LF.ITEMS[matId]||{}).name+'。'); return; }
    if(state.energy<=0){ toast('精力已尽，先休整恢复再行填充。'); return; }
    advanceMinutes(60);
    state.energy=Math.max(0,state.energy-1);
    packConsume(matId, 1);
    p.got[matId] = (p.got[matId]||0) + 1;
    save(state); afterPackChange();
    var matName=(LF.ITEMS[matId]||{}).name || matId;
    log('你填入'+matName+'×1，'+stage.name+'更近一步。','env');
    buildState.msg = '已填入 '+matName+'×1，'+stage.name+'更近一步。';
    if(currentModalKind==='build') openModal('build', {site:siteKey});
  }
  function buildStage(siteKey){
    var p = findPlacedBp(siteKey); if(!p) return;
    var bp = LF.BUILD[p.bp]; if(!bp) return;
    var stages = bp.stages || [];
    if(p.done){ toast(bp.doneName+'已然落成。'); return; }
    var stage = stages[p.stage];
    if(!stage){ p.done = true; save(state); afterPackChange(); log('工事收尾，'+bp.doneName+'落成！','good'); buildActions(G.ROOMS[state.room]); return; }
    for(var k in stage.need){ if((p.got[k]||0) < stage.need[k]){ toast('「'+stage.name+'」材料未齐，无法搭建。'); return; } }
    if(state.energy<=0){ toast('精力已尽，先休整恢复再行搭建。'); return; }
    advanceMinutes(60);
    state.energy=Math.max(0,state.energy-2);
    p.stage++;
    save(state); afterPackChange();
    if(p.stage >= stages.length){
      p.done = true;
      log('你抟土垒石、架木为炉——'+bp.doneName+'终告落成！','good');
    } else {
      log('你完成了「'+stage.name+'」，工事推进至「'+stages[p.stage].name+'」。','env');
    }
    buildActions(G.ROOMS[state.room]);
  }
  // 休息面板（真对象在 createRest 前 L245 赋值；此处仅保留声明防 var 提升覆盖）
  var restState;
  // 营造面板
  var buildState = { site:null, msg:'' };
  function buildMatRows(siteKey){
    var p = findPlacedBp(siteKey); if(!p) return '<p class="tip">此处并无营造工地。</p>';
    var bp = LF.BUILD[p.bp]; if(!bp) return '<p class="tip">未知图纸。</p>';
    if(p.done) return '<p class="tip">'+bp.doneName+'已然落成。'+(bp.desc||'')+'</p>';
    var stages = bp.stages || [];
    var stage = stages[p.stage];
    if(!stage) return '<p class="tip">工事已完，只待收尾——去工地「搭建」即可落成。</p>';
    var html = '<p class="tip">营造进度：'+p.stage+' / '+stages.length+'　当前·<b>'+stage.name+'</b></p>';
    for(var k in stage.need){
      var it = LF.ITEMS[k] || {};
      var have = p.got[k] || 0;
      var need = stage.need[k];
      var packN = (packFind(k)||{count:0}).count;
      var done = have >= need;
      html += '<div style="display:flex;align-items:center;gap:8px;border:1px solid #6b5a3a;border-radius:8px;padding:8px;margin:6px 0;background:rgba(0,0,0,.18);">'
        + '<span>'+itemIconHTML(it, 18)+'</span>'
        + '<span style="opacity:.8;flex:1;">'+have+' / '+need+'　·　行囊'+packN+'</span>'
        + (done ? '<span style="color:#8fce8f;">已备齐</span>' : '<button class="btn-mini" data-site="'+siteKey+'" data-mat="'+k+'">填充</button>')
        + '</div>';
    }
    return html;
  }
  function renderBuildPanel(){
    var p = findPlacedBp(buildState.site);
    var bp = p ? (LF.BUILD[p.bp]||{}) : {};
    var icon = p && p.done ? itemIconHTML({name:bp.doneName||'建筑'},13) : itemIconHTML({name:bp.siteName||'营造中'},13);
    var name = p && p.done ? (bp.doneName||'建筑') : (bp.siteName||'营造中');
    var msg = buildState.msg; buildState.msg='';
    return '<h3 style="text-align:center;margin:0 0 4px;">'+itemIconHTML({name:name}, 18)+'</h3>'
      + (msg ? '<div class="build-msg">'+msg+'</div>' : '')
      + buildMatRows(buildState.site)
      + '<button class="sheet-leave" id="m-leave">收 工</button>';
  }
  function bindBuildPanel(){
    $card.querySelectorAll('[data-mat]').forEach(function(b){
      b.onclick=function(){ buildAddMat(b.getAttribute('data-site'), b.getAttribute('data-mat')); };
    });
    var lv=document.getElementById('m-leave'); if(lv) lv.onclick=closeModal;
  }
  // [v20260909j] 采石崖 / 伐木场 / 砖窑 / 残箱功能已抽离 → shared/core/crafting.js
  // ===== 制作/锻造面板状态（面板逻辑在 crafting.js；状态留引擎，openModal 的 craft/forge 分支直写字段）=====
  var craftState = { bench:'bench', cat:null };
  var forgeState = { site:null, msg:'' };
  // [v20260909j] 炉膛交互与烧制推进逻辑已抽离 → shared/core/crafting.js（advanceTime 内的 tickForge 经引擎 var 别名调用）
  // 货郎交易系统已抽离到 shared/shop.js（LF.createShop 工厂），注入 index.html 内部依赖
  var Shop = LF.createShop({
    getState: function(){ return state; },
    getCard: function(){ return document.getElementById('modal-card'); },
    packAdd: packAdd, afterPackChange: afterPackChange, save: save, toast: toast,
    itemIconHTML: itemIconHTML, packIsStackable: packIsStackable, packFind: packFind, packFirstEmpty: packFirstEmpty,
    storageGet: storeGet, storagePut: storePutFromPack, storageTake: storeTakeToPack, storageSort: storeSort, storageSwap: storeSwap,
    positionFloat: positionFloat, closeModal: closeModal
  });
// [moved -> shared/core/learn.js]
  // ===== 随机事件（含打斗氛围） =====
  function runEvent(ev){
    if(!ev) return;
    clearActions(); advanceMinutes(30);
    log('— '+ev.title+' —','title');
    log(ev.text,'env');
    if(/劫掠|剿匪|驱赶|受命|巡山|溃兵/.test(ev.title+ev.text))
      log('刀光乍起，你与对方缠斗数合，招式凌厉，各展所能。','combat');
    ev.choices.forEach(function(ch){
      var b=document.createElement('button'); b.className='act wide';
      b.innerHTML='› '+ch.text+(ch.cost?('<span class="tip">耗银'+(ch.cost.gold||0)+'</span>'):'');
      b.onclick=function(){
        if(ch.cost){
          if(state.gold<(ch.cost.gold||0)){ log('银两不足，难以行事。','sys'); return; }
          state.gold-=(ch.cost.gold||0);
        }
        if(/驱赶|剿匪|受命|巡山|挺身/.test(ch.text)) log('你提气凝神，一招逼退对手！','combat');
        applyEffect(ch.effect||{});
        log(ch.result,'env');
        // P3 善恶双轴：按 choice.moral 累积（互不抵消）
        if(ch.moral==='chivalry'){ addChivalry(1); log('〔侠义 +1〕','good'); }
        else if(ch.moral==='notoriety'){ addNotoriety(1); log('〔凶名 +1〕','sys'); }
        buildActions(curRoom()); save(state); renderStatus();
      };
      $actions.appendChild(b);
    });
    addBtn('返回营中', function(){ buildActions(curRoom()); });
  }

  // ===== 底部弹窗 =====
  function skillTags(){
    var MA=G.MARTIAL_ARTS;
    var all=state.learnedMartial.concat(state.equippedForce);
    if(!all.length) return '<span style="color:var(--ink-faint)">尚无</span>';
    return all.map(function(id){
      var a=MA.get(id);
      return '<span'+(a&&a.type==='technique'?' class="force"':'')+'>'+(a?a.name:id)+(a&&a.type==='technique'?'◆':'')+'</span>';
    }).join('');
  }
  function row(k,v){return '<div class="row"><span>'+k+'</span><span>'+v+'</span></div>';}
  // ===================== 格子制行囊核心（v0.6） =====================
  // 背包基础容量（无背包装备时）；背包装备槽（equipment.bag）可额外增加
  function afterPackChange(){ clampHp(); packResize(); if(typeof save==='function') save(state); renderStatus(); if(typeof refreshPackGridLight==='function' && currentModalKind==='pack') refreshPackGridLight(); if(typeof refreshPackEquipLight==='function' && currentModalKind==='pack') refreshPackEquipLight(); if(combatMode===null && !state.dead) buildActions(G.ROOMS[state.room]); }

  // [moved → shared/core/equipment.js] 穿卸写路径 equipFromPackTo / equipItem / unequip
  function placeFromPackTo(idx){ if(idx==null || !state.pack[idx]) return; packInspect={kind:'pack',idx:idx}; placeInspect(); }
  // 行囊内拖拽排序：仅轻量刷新网格，保留滚动条位置、避免整窗重渲染卡顿
  var packInspect=null;
  // 公共浮框定位：跟随 cell，空间不足翻到上方，避免破坏布局（货郎/行囊共用）
  function positionFloat(box, cell){
    var vw=window.innerWidth, vh=window.innerHeight, m=8;
    var bw=box.offsetWidth||150, bh=box.offsetHeight||120;
    if(!cell){ box.style.left='50%'; box.style.top=''; box.style.bottom=m+'px'; box.style.transform='translateX(-50%)'; return; }
    var r=cell.getBoundingClientRect();
    var left=r.left+r.width/2-bw/2; left=Math.max(m, Math.min(left, vw-bw-m));
    var top=r.bottom+m; if(top+bh>vh-m) top=r.top-bh-m; if(top<m) top=m;
    box.style.left=left+'px'; box.style.top=top+'px'; box.style.bottom=''; box.style.transform='';
  }
  window.LFUI = { usePackItem:usePackItem, discardPackItem:discardPackItem, packAutoSort:packAutoSort, equipFromPackTo:equipFromPackTo, placeFromPackTo:placeFromPackTo,
    useInspect:useInspect, discardInspect:discardInspect, equipInspect:equipInspect, unequipInspect:unequipInspect, closeInspect:closeInspect, toggleStats:toggleStats, placeInspect:placeInspect,
    storeTake:storeTakeToPack, storePut:storePutFromPack, storeUse:storeUseItem, storeEquip:storeEquipItem, storeSort:storeSort, renderShopPanel:Shop.renderShopPanel, bindShopPanel:Shop.bindShopPanel, addBuyPending:Shop.addBuyPending, addSellPending:Shop.addSellPending, removeBuyPending:Shop.removeBuyPending, removeSellPending:Shop.removeSellPending, confirmTrade:Shop.confirmTrade,
    dismissCompanion:dismissCompanion };
  // 滚动/缩放时收起货郎与行囊浮框，避免遮挡（与战利品栏一致；只注册一次）
  window.addEventListener('scroll', function(e){
    if(e.target && e.target.closest && e.target.closest('#pack-float,#shop-float,.loot-info')) return;  // 浮框自身滚动不收起
    var a=document.getElementById('shop-float'); if(a) a.style.display='none';
    var b=document.getElementById('pack-float'); if(b) b.style.display='none';
  }, true);
  window.addEventListener('resize', function(){ var a=document.getElementById('shop-float'); if(a) a.style.display='none'; var b=document.getElementById('pack-float'); if(b) b.style.display='none'; });

  // 行囊装备面板（P1 完整）
  function useItemOutside(defId){
    // 行囊里直接"使用"物品（非战斗，疗伤/补内/进食）
    var idx=-1;
    for(var i=0;i<state.pack.length;i++){ if(state.pack[i] && state.pack[i].defId===defId){ idx=i; break; } }
    if(idx>=0) usePackItem(idx);
  }

  // ===== 开场渐进式 UI 揭示（空白 → 文字 → 选项 → 逐一点亮功能） =====
  var ONB_LAYERS=['status','loctab','actions','lower','dock','npc'];
  function applyOnboard(){
    if(!state.flags || !state.flags.onb || state.flags.onb.done){
      document.body.classList.remove('onb');
      ONB_LAYERS.forEach(function(l){ document.body.classList.remove('reveal-'+l); });
      return;
    }
    var rv=state.flags.onb.reveal||[];
    document.body.classList.add('onb');
    ONB_LAYERS.forEach(function(l){ if(rv.indexOf(l)>=0) document.body.classList.add('reveal-'+l); else document.body.classList.remove('reveal-'+l); });
    applyDockUnlock();   // 底部页签除「整排揭示」外，还要按 flags.onb.unlocked 逐项放行
  }
  function onbReveal(layer){
    if(!state.flags) state.flags={}; if(!state.flags.onb) state.flags.onb={started:true, personality:null, favor:0, reveal:[], tcDone:false, talked:{}};
    if(!state.flags.onb.reveal) state.flags.onb.reveal=[];   // 老存档/新造存档可能缺 reveal 数组
    if(state.flags.onb.reveal.indexOf(layer)<0) state.flags.onb.reveal.push(layer);
    applyOnboard(); save(state);
  }
  // ═══ 底部页签逐项解锁（v20260912f）═══
  // 教学期 #dock 一旦揭示就是整排六个页签，玩家并不知道该点哪个；而「行囊」「任务」这两样
  //   是新手最该先认识的，其余（角色/队伍/山河/设置）更该等提到时再出现。
  // 机制：列表内页签默认不显示（CSS 见 game.css `body.onb #dock button` 一节），
  //   只有进了 flags.onb.unlocked 的才加 .onb-on 亮出来。
  // 一旦教学毕业（applyOnboard 移除 body.onb），该 CSS 失效 → 全部页签照常显示，正常游玩不受影响。
  var ONB_DOCK_ALL=['char','pack','party','quest','map','settings'];
  function applyDockUnlock(){
    var onb=(state.flags && state.flags.onb) || null;
    // 旧存档兼容（v20260912f）：本机制之前开的档没有 unlocked 字段，若按空表处理会把六个页签
    //   全藏掉、老玩家直接卡死。故「字段缺失」一律视为全部已解锁 —— 渐进揭示只对新局生效。
    var u=(onb && onb.unlocked) ? onb.unlocked : ONB_DOCK_ALL.slice();
    var btns=document.querySelectorAll('#dock button');
    for(var i=0;i<btns.length;i++){
      var k=btns[i].getAttribute('data-modal');
      if(ONB_DOCK_ALL.indexOf(k)<0){ btns[i].classList.add('onb-on'); continue; }  // 表外页签（日后新增）不参与管控，避免被静默藏掉
      btns[i].classList.toggle('onb-on', u.indexOf(k)>=0);
    }
  }
  function onbUnlockDock(key){
    if(!state.flags) state.flags={};
    var onb=state.flags.onb;
    if(!onb) onb=state.flags.onb={started:true, personality:null, favor:0, reveal:[], tcDone:false, talked:{}};
    if(!onb.unlocked) onb.unlocked=[];
    (Array.isArray(key)?key:[key]).forEach(function(k){ if(k && onb.unlocked.indexOf(k)<0) onb.unlocked.push(k); });
    onbReveal('dock');   // 首次解锁即把整排 dock 揭示出来（onbReveal 内部会调 applyOnboard → applyDockUnlock）
  }
  // ═══ 回顾：把「上过屏的每一句」留下来（v20260914a）═══
  // 叙事区只往滚、对话帘收帘即清（dlgTalk.length=0），于是「NPC 到底说了什么」
  //   一旦滚过去就再也找不回来 —— 全项目此前没有任何历史/回顾入口。
  //   这里记的是「真正落到屏上的那一句」（由 logNow / dlgLine 调用，不是入队时记），
  //   所以玩家看到什么、回顾里就有什么；条目随存档走（state.logRing），中途退出回来仍在。
  //   只留最近 HIST_MAX 条，避免存档无限膨胀。
  var HIST_MAX=120;
  function histStamp(){
    try{
      var hh=String(Math.floor(state.clock/60)).padStart(2,'0');
      var mm=String(state.clock%60).padStart(2,'0');
      return '第'+(((state.day||0)|0)+1)+'日 '+SHICHEN[state.time%12]+' '+hh+':'+mm;
    }catch(e){ return ''; }
  }
  function histLoc(){
    try{ var r=curRoom(); return (r&&r.name)||''; }catch(e){ return ''; }
  }
  // 记一条。同一句话连记两次（同一屏重复输出）不再重复入册。
  function recHist(text, cls, who){
    if(!state) return;
    var t=String(text==null?'':text).replace(/\s+$/,'');
    if(!t) return;
    if(!Array.isArray(state.logRing)) state.logRing=[];
    var r=state.logRing, last=r[r.length-1];
    if(last && last.t===t && last.r===histLoc()) return;
    r.push({t:t.slice(0,240), c:cls||'', n:who||'', s:histStamp(), r:histLoc()});
    if(r.length>HIST_MAX) r.splice(0, r.length-HIST_MAX);
  }
  // [moved -> shared/core/panels.js]
  // ═══ 任务「指路」（v20260914a）═══
  // 任务日志只说「做什么」（o.hint / q.hint 的文字），从不告诉玩家「去哪儿」——
  //   而「我该去哪」正是这类网格文字 RPG 最高频的卡点，尤其摊开 70 城 441 格郊野之后。
  // 这里把数据里【本来就有的】位置信息翻成一次指引，不新增任何内容负担：
  //   接取式任务的 q.submit = {npc, room} 已是结构化数据（QUEST_DEFS 里五条全有），
  //   志业可选用 o.at 标注（写法见下）；没有位置信息的就老实不显示按钮。
  // 锚点写法（与 LF.Guide 同一套语义锚点）：
  //   { room:'camp_tz1' }                   目标房间（隔壁 → 点亮罗盘方向键）
  //   { npc:'周听涛' } / { act:'labor_yard' } 目标人物 / 动作按钮（须在本格）
  //   { dock:'char' }                       目标底部页签
  //   字符串视作 { room: 字符串 }。
  function roomNameOf(rid){
    if(!rid) return '';
    if(G.ROOMS && G.ROOMS[rid] && G.ROOMS[rid].name) return G.ROOMS[rid].name;
    if(LF.PLACES && LF.PLACES[rid] && LF.PLACES[rid].name) return LF.PLACES[rid].name;
    if(LF.CITIES && LF.CITIES[rid] && LF.CITIES[rid].name) return LF.CITIES[rid].name;
    return rid;
  }
  // 从当前房间的出口里找出通往目标房间的方位键（罗盘上那个键就是玩家要点的）
  function dirToRoom(from, to){
    if(!from || !to || from===to) return '';
    var r=G.ROOMS && G.ROOMS[from]; if(!r || !r.exits) return '';
    for(var d in r.exits){ if(r.exits[d]===to) return d; }
    // 城门哨兵 / 城格串（__gate__:cid:dir、__cell__:cid:x:y）里包着的目标也认
    for(var d2 in r.exits){
      var t=r.exits[d2];
      if(typeof t!=='string' || t.indexOf('__')!==0) continue;
      var parts=t.split(':');
      for(var i=1;i<parts.length;i++){ if(parts[i]===to) return d2; }
    }
    return '';
  }
// [moved -> shared/core/quest.js]
  // ═══ 通用「指引」系统（v20260912a）═══
  // 把「高亮某个按钮 / NPC / 面板，并把它滚进视野」做成一套可复用的语义锚点，
  // 让任何调用方（新手目标引导、剧本 highlight 步骤、后续新内容）都不必再写死
  // `#actions .act[data-act="..."]` 这类易碎选择器 —— 换渲染分支、换房间都不会静默失效。
  //
  // 语义锚点（任选其一，可混用 / 可传数组）：
  //   { act:'labor_yard' }  → 场景动作按钮   #actions .act[data-act]
  //   { npc:'laotou' }      → 人物列表 chip  #npc-list .nl-item[data-k]
  //   { dock:'pack' }       → 底部页签       #dock button[data-modal]
  //   { dir:'北' }          → 罗盘方位键     #move-bar .mv-exit[data-dir]
  //   { layer:'status' }    → 整块面板       #status / #loc-tab / #actions / #lower / #dock / #npc-list
  //   'some-selector'       → 直接当选择器   ；DOM 元素 → 直接用
  // 对外入口：LF.Guide.focus / .goal / .ping / .clear / .exists
  var GUIDE_LAYER_ID={status:'status',loctab:'loc-tab',actions:'actions',lower:'lower',dock:'dock',npc:'npc-list',movebar:'move-bar'};
  var guideRetryTimer=null;
  var Guide={
    sel: function(t){
      if(!t) return null;
      if(typeof t==='string') return GUIDE_LAYER_ID[t] ? ('#'+GUIDE_LAYER_ID[t]) : t;
      if(t.nodeType===1) return t;
      if(t.act)  return '#actions .act[data-act="'+t.act+'"]';
      if(t.npc)  return '#npc-list .nl-item[data-k="'+t.npc+'"]';
      if(t.dock) return '#dock button[data-modal="'+t.dock+'"]';
      if(t.dir)  return '#move-bar .mv-exit[data-dir="'+t.dir+'"]';
      if(t.layer) return '#'+(GUIDE_LAYER_ID[t.layer]||t.layer);
      return null;
    },
    els: function(targets){
      if(targets==null) return [];
      // 用 Array.isArray（跨 realm 安全）：instanceof 在 iframe / 测试沙箱里会误判成「非数组」
      var list=Array.isArray(targets)?targets:[targets], out=[];
      list.forEach(function(t){
        if(!t) return;
        var s=Guide.sel(t); if(!s) return;
        if(typeof s==='string'){
          var found=document.querySelectorAll(s);
          for(var i=0;i<found.length;i++) out.push(found[i]);
        } else out.push(s);
      });
      return out;
    },
    // 元素此刻是否真的能被玩家看到：面板被「逐步揭示」藏起来时算看不到。
    //   有了这个判断，「牢里的目标指向场院按钮」这类错位就不会再表现为一次静默的高亮失败。
    visible: function(el){
      var n=el;
      while(n && n!==document.body){
        var cs=window.getComputedStyle?window.getComputedStyle(n):null;
        if(cs && (cs.display==='none' || cs.visibility==='hidden')) return false;
        n=n.parentNode;
      }
      return true;
    },
    exists: function(target){
      var e=Guide.els(target);
      for(var i=0;i<e.length;i++){ if(Guide.visible(e[i])) return true; }
      return false;
    },
    clear: function(){
      if(guideRetryTimer){ clearTimeout(guideRetryTimer); guideRetryTimer=null; }
      var n=document.querySelectorAll('.onb-goal-hl');
      for(var i=0;i<n.length;i++){ n[i].classList.remove('onb-goal-hl'); n[i].classList.remove('guide-hl'); }
    },
    // 点亮一组目标（先清旧、再亮新）。目标此刻还没渲染出来时自动重试若干轮，
    //   因为按钮常常是「本帧之后」才建好的（换房间 / 面板揭示 / 对话框收势）。
    //   opts.retry  重试轮数（默认 6，每轮 120ms）
    //   opts.scroll 是否把首个可见目标滚进视野（默认 true）
    focus: function(targets, opts){
      opts=opts||{};
      Guide.clear();
      var els=Guide.els(targets);
      if(!els.length){
        var left=(opts.retry==null?6:opts.retry);
        if(left>0){
          guideRetryTimer=setTimeout(function(){
            guideRetryTimer=null;
            Guide.focus(targets, { retry: left-1, scroll: opts.scroll });
          }, 120);
        }
        return null;
      }
      els.forEach(function(el){ el.classList.add('onb-goal-hl'); el.classList.add('guide-hl'); });
      if(opts.scroll!==false){
        for(var i=0;i<els.length;i++){
          if(Guide.visible(els[i]) && els[i].scrollIntoView){
            try{ els[i].scrollIntoView({block:'nearest', behavior:'smooth'}); }catch(e){}
            break;
          }
        }
      }
      return els;
    },
    // 一次性脉冲高亮（沿用 .onb-glow，自动消隐）——即旧 highlightOnb(layer)，现同时兼容语义锚点
    ping: function(target, ms){
      var els=Guide.els(target);
      if(!els.length && typeof target==='string'){ var e=document.getElementById(target); if(e) els=[e]; }
      els.forEach(function(el){
        el.classList.add('onb-glow');
        setTimeout(function(){ el.classList.remove('onb-glow'); }, ms||4200);
      });
    },
    // 顶部「当前目标」横幅 + 目标高亮（text 传 null 即收起）
    goal: function(text, targets, opts){
      var g=document.getElementById('onb-goal');
      if(text==null){ Guide.goalClear(); return; }
      if(g){ g.classList.remove('hidden'); g.innerHTML='<span class="og-ic">➤</span>〔当前目标〕'+text; }
      Guide.focus(targets, opts);
    },
    goalClear: function(){
      var g=document.getElementById('onb-goal'); if(g) g.classList.add('hidden');
      Guide.clear();
    }
  };
  // 旧名保留：core/triggers.js 与 combat.js 以依赖注入方式持有它，签名向后兼容
  //   （字符串 layer 名 / 语义锚点对象 / 选择器 皆可）。
  function highlightOnb(target){ Guide.ping(target); }
  // 场次体感（v20260913c）：剧本写 { t:'fx', shake:true, sfx:'close', buzz:24 } ——
  //   画面震一下（复用战斗屏震 #scene.shake）/ 一声响（SFX.play）/ 手机颤一下（vibrate）。
  //   开场那记「铁链啷当」配一记闷震，四个字才不只是四个字。
  function fxBeat(o){
    o=o||{};
    if(o.shake){ try{ shakeScene(); }catch(e){} }
    if(o.sfx){ try{ SFX.play(o.sfx); }catch(e){} }
    if(o.buzz && typeof navigator!=='undefined' && navigator.vibrate){ try{ navigator.vibrate(o.buzz); }catch(e){} }
  }
  // ===== 新手目标引导：根据当前进度显示「当前该做什么」并高亮对应按钮/NPC =====
  function onbGoalClear(){ Guide.goalClear(); }
  // 「该做什么」的唯一判定源：一律按「玩家此刻人在哪、下一步真该做什么」来给。
  //   开场剧本已把牢房四向出口锁死，故第一步永远是叩牢门 —— 此前这里直接从「担石劳作」
  //   讲起，而人在牢里根本没有那个按钮，等于首屏就给了一条点不到的指引（体验断点）。
  // 营中「该往哪走」的统一判据（v20260912e）：目标就在眼前 → 点亮它；不在眼前 → 点亮罗盘方位键。
  //   旧版把「往北」写死在文案里，而北=[0,-1]、囚室格 (1,0) 到场院 (1,1) 其实是往【南】——
  //   玩家照指引往北，撞的是营墙。方向一律按当前坐标现算，不再写死。
  function campDirTo(tx, ty){
    var cp=state.flags && state.flags.cityPos; if(!cp) return null;
    var dx=tx-(cp.x||0), dy=ty-(cp.y||0); if(!dx && !dy) return null;
    var ew=dx<0?'西':(dx>0?'东':''), ns=dy<0?'北':(dy>0?'南':'');
    return ew+ns;   // 「东南／西北」= 东西在前、南北在后，与 DIR_DELTA 的键一致
  }
  function campGoto(anchor, hereText, goText, tx, ty){
    if(anchor && Guide.exists(anchor)) return {text:hereText, targets:[anchor]};
    var d=campDirTo(tx,ty);
    return {text:goText, targets:d?[{dir:d}]:null};
  }
  function onbGoalStep(){
    var f=state.flags||{}, onb=f.onb; if(!onb||onb.done) return null;
    //    开场「醒」那几拍还没演完时【不给目标】（v20260913c）：此刻行囊页签尚未解锁（见 camp_opening
    //    第三拍才 unlockDock），若目标条此刻就指着「点行囊」，等于叫玩家去点一个还不存在的按钮 ——
    //    这正是「引导与界面不同步」的老毛病。开场这几拍由对话帘里的动作按钮牵着走，不需要第二条指引。
    if(!onb.prologueShown) return null;
    // ⓪ 先认行囊（v20260912f）：主角此刻身上只剩一身囚服、一副镣铐 —— 头一件事就是学会
    //    打开下方「行囊」看看自己有什么。系统介绍按「先行囊、后任务」的次序来，且
    //    没介绍到的页签一律还藏着（见 onbUnlockDock / game.css），免得一上来六个页签糊脸。
    if(!onb.packSeen) return {text:'点下方「🎒 行囊」，看看自己身上还剩些什么', targets:[{dock:'pack'}]};
    // ① 已接下差事却还没看过任务面板：先学会看「任务」（与上面的行囊教学对称）
    if(f.task && f.task.zt_accepted && !onb.questSeen) return {text:'点下方「📜 任务」，看看刚接下的差事记了些什么', targets:[{dock:'quest'}]};
    // ② 尚未出牢：叩牢门请牢头开锁（牢门是 camp_tz1 的场景物件，锚点 cell_door）
    if(!onb.cellOpen) return {text:'走到牢门口的「牢门」，点「叩门」与牢头说通，方能出牢', targets:[{act:'cell_door'}]};
    // ② 场院三件事：劳作（顺带点亮状态栏/位置页签）→ 照看自身 → 环顾（看清几处去路）
    // v20260920h：担石劳作改「装担→卸料」两步 —— 引导跟着分两拍：先装担，扛上肩再指去仓库卸。
    if(!onb.labored){
      if(stoneCarrying())
        return campGoto({act:'haul_stones'}, '到仓库「卸料台」把石料卸下——卸完这一担才记一工', '往仓库去，点「卸料台」把肩上的石料卸下', 2, 1);
      return campGoto({act:'labor_yard'}, '点场院「乱石堆」·装担，再送去仓库卸下（满三工换一枚劳字木片）', '往中军场院去，点「乱石堆」装一担', 1, 1);
    }
    // ②·五 刚扛完一工（v20260914c）：此刻「看自己」最有痛感 —— 精力气血是真掉了一截，
    //   不是凭空叫人多看一眼面板。放在「环顾四周」之前：先看清自己还剩几分底子，再看清几处去路。
    //   老档可能只解锁过 pack/quest、没有 char —— 先点亮再指，免得目标条指向一个被 CSS 藏着的按钮。
    if(!onb.charSeen){
      if(onb.unlocked && onb.unlocked.indexOf('char')<0) onbUnlockDock('char');
      return {text:'点下方「🧭 角色」，看看扛完这一工还剩几分底子', targets:[{dock:'char'}]};
    }
    if(!onb.surveyed) return campGoto({act:'survey_yard'}, '点「环顾四周」，看清场院几处去路', '往中军场院去，点「环顾四周」看清去路', 1, 1);
    // ③ 周听涛一脉：探问 → 寻一份吃食 → 交付。
    //    旧版从「探问」直接跳到「与默叔对暗号」，中间「这份吃食打哪来」整段没有交代：
    //    玩家接下差事回头再找周听涛，只因囊中无干粮而被普通交谈放行，于是反复听他说天象、无路可走（v20260912e 补）。
    if(!(f.route && f.route.crypt)){
      var tk=f.task||{}, goZT='往北回牢区（营北），进天字一号牢房寻周听涛';
      if(!tk.zt_accepted) return campGoto({npc:'zhoutingtao'},
        tk.zt_intro ? '再寻周听涛，把「寻一份吃食」的差事应下' : '回牢房·天字一号，寻那位相面的周听涛探问出营门道',
        tk.zt_intro ? '往北回牢区（营北），进天字一号牢房把差事应下' : goZT, 1, 0);
      // v20260914g：交付已改走「给予」（triggers.js zt_food_give）——这里也得照实说，
      //   否则指引把人领到周听涛跟前，玩家却只在「交谈」里空耗（旧版交谈即自动交付，现已不再）。
      if(packFind('fan')) return campGoto({npc:'zhoutingtao'}, '点周听涛、选「给予」，把干粮交到他手上', '往北回牢区，把干粮交予周听涛', 1, 0);
      // 手上有木片 → 去伙房换食；没有 → 回场院再挣一工（初次满三工还会顺带点亮行囊）
      if(packFind('lao_pai')) return campGoto({act:'mess_hall'}, '持「劳字木片」在伙房换一份吃食', '往伙房去，用「劳字木片」换一份吃食', 0, 1);
      return campGoto({act:'labor_yard'}, '周听涛要一份吃食——去场院「乱石堆」装担、送到仓库卸料，满三工换一枚「劳字木片」', '往中军场院去「乱石堆」装担，挣满三工换一枚「劳字木片」', 1, 1);
    }
    // ④ 默叔：天字二号牢房对暗号
    if(!(f.task && f.task.signal)) return campGoto({npc:'moshu'}, '牢房·天字二号，与默叔对上暗号', '往北回牢区（营北），进天字二号牢房与默叔对暗号', 1, 0);
    // ⑤ 已对暗号：营中九条路皆在「决断出营」里候着（能走哪条，看备下了什么）
    if(Guide.exists({act:'wall_choose'})) return {text:'点「决断出营」，择一条路走出去（也可先去别处探访更多门道）', targets:[{act:'wall_choose'}]};
    if(Guide.exists({act:'gate_choose'})) return {text:'点「决断出营」，择一条路走出去（也可先去别处探访更多门道）', targets:[{act:'gate_choose'}]};
    return campGoto(null, '', '回营南岗哨点「决断出营」，择路出营', 1, 2);
  }
  function onbGoal(){
    if(!state.flags || !state.flags.onb || state.flags.onb.done){ onbGoalClear(); return; }
    var s=onbGoalStep(); if(!s){ onbGoalClear(); return; }
    Guide.goal(s.text, s.targets);
  }
  // 「行囊」这一课的下半截（v20260913c）：开场「醒」三拍只把行囊【亮出来】并留一句
  //   「点下方「🎒 行囊」细看」；真正的收尾 —— 栅外那嗓子开口、以及「叩牢门」的下一步 ——
  //   要等玩家【真的开过行囊、又把它合上】才发生（closeModal 里回调到这里）。
  //   为什么不在剧本里一次讲完：玩家若还没亲手看过行囊，此刻旁白就先替他把话说了，
  //   又回到「被喂」而不是「在动」的老毛病；把话押到动作之后，字才落在玩家自己的操作上。
  function onbAfterPack(){
    var f=state&&state.flags, onb=f&&f.onb;
    if(!onb || onb.done || !onb.prologueShown) return;   // 开场没演完 / 教学已结束，概不插话
    if(!onb.packSeen || onb.packTold) return;            // 得是「真的开过」；且这段只讲一次
    onb.packTold = true;
    save(state);
    // 栅外那嗓子——牢里还关着个相面的（顺手给方向：营北牢区）
    log('栅外忽有一把嗓子拖长了腔，像在同谁自言自语：「某周听涛，天下数一数二的相士——观天象，断命数，从不曾走过眼……」', 'env');
    // 下一件正事：叩牢门（牢门是 camp_tz1 的场景物件，锚点 cell_door；onbGoalStep ② 与之同源）
    log('〔牢门〕铁栅在你身后合得死紧。要出去，须先与牢头说通 —— 走过去，点「叩门」。', 'order');
    onbGoal();
  }
  // （旧 showOnboardChoices / removeOnboardChoices 已废弃：开场改为与老乞丐对话驱动）
  // ═══ 对话帘（v20260912k）═══
  // 演进：v20260912g 把「他说的话」与「你怎么答」并进同一扇窗（解决「话被选项顶出视野 / 选项要
  //   单独滚」），但它是 #app 内的一段、参与布局 —— 玩家用下来的观感仍是「不像交谈」：
  //   ①开合把叙事区与罗盘一起顶来顶去；②一换人/一收窗就清屏，说过的话再也找不回来；
  //   ③选项是一排一模一样的全宽按钮，密得像在做题。
  // 这一版做成**自底部升起的对话帘**：
  //   · 浮层（position:fixed）：开合不动上面任何东西，底下的界面也不再被挤；
  //   · 头＝朱砂名章＋名姓＋状态（谁在说、在说还是在等你答，一眼分明）；
  //   · 体＝本次交谈的往来，含**你的答话**（右对齐浅金底），可上滚回看，手动上滚时不再被拽回底部；
  //   · 足＝带序号的答话选项（键盘 1-9 等价），超 4 条两列；
  //   · 收窗时整段交谈折进叙事区留痕（dlgEcho），说过的仍可回看。
  var $dlg=document.getElementById('dlg'), $dlgVeil=document.getElementById('dlg-veil'),
      $dlgName=document.getElementById('dlg-name'), $dlgSeal=document.getElementById('dlg-seal'),
      $dlgState=document.getElementById('dlg-state'),
      $dlgBody=document.getElementById('dlg-body'), $dlgFoot=document.getElementById('dlg-foot');
  var dlgCur='', dlgTimer=null, dlgOpen=false, dlgTypeTimer=null, dlgSkip=null;
  //   dlgCur = 当前帘里的说话人（判断是不是同一场对话）；dlgOpen = 帘是否开着
  //   dlgTypeTimer / dlgSkip = 「一句一句往外蹦」的落字定时器与「一次落定」的跳过钩子
  var dlgTalk=[];     // 本次交谈的往来 {who,text}：收窗时折进叙事区留痕
  var dlgStick=true;  // 是否自动滚到底（玩家手动上滚回看时置假，别把人拽回来）
  // ⚠️ v20260912j 修一处「窗永远不显形」的暗雷：开关窗必须走 classList，不能只设 $dlg.hidden 属性。
  //   #dlg 在 index.html 里出厂就带 class="hidden"，而 game.css 有大范围的 .hidden{display:none !important}
  //   —— !important 的权重大于 #dlg{display:flex}，只摘 hidden 属性、不摘 hidden 类，窗在真机上恒为
  //   display:none（jsdom 不加载外部样式表，看不出这个问题；真机一点「叩门」就是一片空白 + 全部按钮锁死）。
  //   全工程其余浮层（#modal / #prologue / #app）都是 classList 约定，这里与之对齐。
  function dlgShow(){
    if(!$dlg) return;
    $dlg.classList.remove('hidden'); $dlg.hidden=false;
    if($dlgVeil){ $dlgVeil.classList.remove('hidden'); $dlgVeil.hidden=false; }
    dlgOpen=true;
  }
  function dlgHide(){
    if(!$dlg) return;
    $dlg.classList.add('hidden'); $dlg.hidden=true;
    if($dlgVeil){ $dlgVeil.classList.add('hidden'); $dlgVeil.hidden=true; }
    dlgOpen=false;
  }
  // 名章取一个字：姓名取姓；「牢头/老乞丐/小卒」这类称呼去掉老大少小阿再取首字（牢/乞/卒）
  function dlgSealOf(who){
    var s=String(who||'').replace(/^[老少大阿]/, '').replace(/[·．.\s]/g, '');
    return s ? s.charAt(0) : '择';
  }
  function dlgState(txt, ask){
    if(!$dlgState) return;
    $dlgState.textContent=txt||'';
    $dlgState.className='dlg-state'+(ask?' ask':'');
  }
  function dlgScroll(){ if(dlgStick && $dlgBody){ try{ $dlgBody.scrollTop=$dlgBody.scrollHeight; }catch(e){} } }
  // 帘里只留最近两句（v20260912l）：像真的在听人说话，而不是看一墙字幕。
  // 超出的那条先淡出再移除 —— 直接删会「啪」地跳一下；.leave 的也算出列，免得连落两句时挤不掉。
  function dlgTrim(){
    if(!$dlgBody) return;
    var ps=$dlgBody.querySelectorAll('.dlg-say:not(.leave)');
    if(ps.length<=2) return;
    var o=ps[0];
    o.classList.add('leave');
    setTimeout(function(){ if(o.parentNode) o.parentNode.removeChild(o); }, 260);
  }
  // [已删 v20260914a] dlgPace(s) —— 早期「句间按字数估一个停顿」的定时器估值函数。
  //   v20260913a 改成「一句一出、玩家点一下才出下一句」之后它就没有任何调用方了（全仓 0 引用），
  //   留着会让人误以为帘的节奏还是自动算出来的。
  // 帘里补一句「旁白 · 动作的回声」（v20260913c）：不摆选项、不动悬挂锁 ——
  //   玩家的动作（〔睁眼看〕〔撑起身〕〔摸一摸身上〕）先落成帘里一行小字，台词与问题接着往下走。
  //   为什么落帘里而不落叙事区：此刻玩家正盯着帘，叙事区在帘后（还给帘压着），落那儿等于白落。
  //   帘没开时（旧 DOM / 已收帘）退回叙事区，免得这一句凭空消失。
  function dlgEcho(text){
    var t=String(text==null?'':text).trim(); if(!t) return;
    if($dlg && dlgOpen){
      var box=dlgNode('', 'narr');
      box.say.textContent=t;
      recHist(t, 'narr');   // 回顾也收下动作回声（v20260914a）
      dlgTrim(); dlgScroll();
      syncActionLock();   // 重新起算「静下来就收帘」的计时：末句也读得完
      return;
    }
    log(t, 'env');
  }
  // 往帘里落一条：who 非空时带「谁：」前缀；extra 传 'me' 即玩家自己的话（右对齐）
  function dlgNode(who, extra){
    var p=document.createElement('p'); p.className='dlg-say'+(extra?' '+extra:'');
    var say;
    if(extra==='me'){ say=p; }
    else {
      if(who){ var nm=document.createElement('span'); nm.className='dlg-who'; nm.textContent=who+'：'; p.appendChild(nm); }
      say=document.createElement('span'); p.appendChild(say);
    }
    $dlgBody.appendChild(p);
    return {node:p, say:say};
  }
  // 点帘 = 一次落定（同叙事区点字快进的手感）；连点两下 = 这一整段话一次讲完（v20260914a）。
  //   从前一段六句的独白要点六下才见得到选项 —— 逐句读是「想细看」的人要的，
  //   连点略过是「已经知道他要说什么」的人要的，两条路并存，节奏仍由玩家自己定。
  var DLG_COMBO_MS=450;
  var dlgTapAt=0;
  var dlgSkipAll=null;      // 逐句模式下由 tutAsk 挂上「整段落定」；瞬模式 / 已落定时为 null
  function dlgTap(){
    skipTypewriter();
    if(!dlgSkip) return;
    var now=Date.now();
    if(dlgSkipAll && (now-dlgTapAt)<=DLG_COMBO_MS){
      dlgTapAt=0;
      var all=dlgSkipAll; all();      // 连点：整段落定并放开选项
      return;
    }
    dlgTapAt=now;
    dlgSkip();                        // 单点：出下一句
  }
  if($dlgVeil) $dlgVeil.addEventListener('click', dlgTap);
  if($dlgBody) $dlgBody.addEventListener('click', dlgTap);
  // ⚠️ index.html 有一条全局「防双击缩放」守卫：两次 touchend 相隔 ≤300ms 时会对第二下
  //   preventDefault()，而 preventDefault 会把随之派生的 click 一并吞掉 —— 于是帘里的
  //   「连点两下」在真机上永远等不到第二下（桌面端没有这个问题，故只在小屏真机可见）。
  //   这里就地截住帘内的 touchend，让帘里的每一次轻触都照常产生 click。
  //   stopPropagation 只作用于帘内（#dlg-veil 是 #dlg 的兄弟节点，两处都要挂），帘外的双击缩放保护照旧。
  if($dlg)     $dlg.addEventListener('touchend', function(e){ e.stopPropagation(); }, {passive:true});
  if($dlgVeil) $dlgVeil.addEventListener('touchend', function(e){ e.stopPropagation(); }, {passive:true});
  // 手动上滚回看时别再自动追底（贴近聊天软件的「贴底才跟随」）
  if($dlgBody) $dlgBody.addEventListener('scroll', function(){
    var gap=$dlgBody.scrollHeight-$dlgBody.scrollTop-$dlgBody.clientHeight;
    dlgStick = gap<28;
  });
  // 答话快捷键：还在落字时按 1-9 / 空格 / 回车 / ↓ 都当「接着说」；落定后 1-9 直接选第几条
  document.addEventListener('keydown', function(e){
    if(!dlgOpen) return;
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    var t=e.target;
    if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA' || t.isContentEditable)) return;
    var k=e.key;
    if(dlgSkip){
      // 走 dlgTap 而非 dlgSkip：键盘也能「连按两下讲完本段」（与点帘同一套节奏）。
      // e.repeat 排除长按自动重复 —— 否则按住空格不放会被当成连点，整段话一瞬略过。
      if(k===' ' || k==='Enter' || k==='Escape' || k==='ArrowDown' || (k>='1' && k<='9')){ e.preventDefault(); if(!e.repeat) dlgTap(); }
      return;
    }
    if(k>='1' && k<='9' && $dlgFoot){
      var bs=$dlgFoot.querySelectorAll('button'), b=bs[(+k)-1];
      if(b && !b.disabled){ e.preventDefault(); b.click(); }
    }
  });
  function dlgClear(){
    if(dlgTypeTimer){ clearTimeout(dlgTypeTimer); dlgTypeTimer=null; }
    dlgSkip=null; dlgSkipAll=null; dlgTapAt=0;   // 连点状态随帘一起清（v20260914a）
    dlgStick=true;
    if($dlgBody) $dlgBody.innerHTML='';
    if($dlgFoot){ $dlgFoot.innerHTML=''; $dlgFoot.className='dlg-foot'; $dlgFoot.style.display=''; }
    dlgState('');
  }
  // 玩家点了某条答话：先把自己的话落进记录（像聊天记录里的「我」），再收选项、走后续
  function dlgPick(o, b){
    if(b && b.disabled) return;
    if(dlgSkip) dlgSkip();
    var me=document.createElement('p'); me.className='dlg-say me'; me.textContent=o.label;
    $dlgBody.appendChild(me);
    dlgTalk.push({who:'你', text:o.label});
    recHist(o.label, 'me', '你');   // 回顾里也留一句「你说了什么」（v20260914a）
    dlgStick=true; dlgScroll();
    removeTutChoices();
    if(o.fn) o.fn();
  }
  // v20260913b：对话往来不再折进叙事区 —— NPC 台词与你的答话在帘里逐句读过即可，
  //   叙事区只留对话落定的结果（如「〔寻吃食·破命数〕已替你记在册上了」），避免同一段话出现两遍。
  // v20260914a：既然不再折进叙事区，说过的话就【只】落在「回顾」里（recHist 由 dlgLine/dlgPick/dlgEcho 记），
  //   收帘时清空 dlgTalk 只影响「本场留痕」，历史已进 state.logRing，收帘后照样翻得到。
  // 注：此处原有的 dlgClose(echo) 形参没人读，而注释还写着「整段交谈折进叙事区留痕（dlgEcho），
  //   说过的仍可回看」—— 那句注释自 v20260913b 起就与实际行为相反，形参一并去掉（v20260914a）。
  function dlgClose(){
    if(!$dlg) return;
    if(dlgTimer){ clearTimeout(dlgTimer); dlgTimer=null; }
    dlgTalk.length=0;
    dlgHide(); dlgCur=''; dlgClear();
  }
  // 对话静下来（叙事打完、且没有挂起的问答）后稍候收帘 —— 给玩家读完最后一句的时间
  function dlgSettle(){
    if(!$dlg || !dlgOpen) return;
    if(dlgTimer) clearTimeout(dlgTimer);
    dlgTimer=setTimeout(function(){
      dlgTimer=null;
      if(askPending || narrActive()) return;   // 又接上了新的话 / 新问题，就继续留着
      dlgClose();
    }, 1400);
  }
  function tutAsk(prompt, options, npcName){
    removeTutChoices();
    options=options||[];
    // ① 对话窗（#dlg 就位时一律走它）
    if($dlg){
      var who=(npcName==null)?'':String(npcName);
      if(!dlgOpen || dlgCur!==who){      // 换了人（或刚开帘）→ 清屏重来；同一场对话则续着往下说
        dlgClear(); dlgShow(); dlgCur=who;
        if($dlgName) $dlgName.textContent=(who||'抉择');
        if($dlgSeal) $dlgSeal.textContent=dlgSealOf(who);
      }
      if(dlgTimer){ clearTimeout(dlgTimer); dlgTimer=null; }
      if(dlgSkip) dlgSkip();             // 上一句还没落完就接上了新话 —— 先把旧句一次落定
      var text=String(prompt==null?'':prompt);
      // ① 选项先摆好（带序号，键盘 1-9 等价），但话没说完之前一律锁住；说完自动放开。
      //    三条起就两列：四五条也就两三行。选项区还会「预留」两行的高度（.has 见 CSS），
      //    所以两条与四五条一样摆得下。CSS 里 .dlg-foot 是 flex:0 0 auto —— 早前它会被
      //    一大段台词挤扁，才出现「才两个选项也要滚、显示不全」，这里别再让它可压缩。
      $dlgFoot.className='dlg-foot'+(options.length>1?' has':'')+(options.length>2?' g2':'');
      // 九条那种极端情况（两列也放不下）把帘抬高些；用 classList 增删，别重建 className（免得把 hidden 抖掉）
      if(options.length>4) $dlg.classList.add('many'); else $dlg.classList.remove('many');
      options.forEach(function(o,i){
        var b=document.createElement('button'); b.type='button'; b.className='onb-btn dlg-btn';
        var ix=document.createElement('span'); ix.className='ix'; ix.textContent=String(i+1);
        var tx=document.createElement('span'); tx.textContent=o.label;
        b.appendChild(ix); b.appendChild(tx);
        b.onclick=function(){ dlgPick(o, b); };
        b.disabled=!!text;
        $dlgFoot.appendChild(b);
      });
      if(text) $dlgFoot.style.display='none';   // v20260913c：话没说完先收起选项，说完再弹出（避免半灰不可点造成困惑）
      var btns=$dlgFoot.querySelectorAll('button');
      var dlgRelease=function(){
        $dlgFoot.style.display='';
        for(var i=0;i<btns.length;i++) btns[i].disabled=false;
        dlgState(options.length? '请择一' : '听他说', !!options.length);
      };
      // ② 他「一句一句讲」（v20260912l）——
      //    整段话不再一次性摊开：splitSpeech(text,true) 连引号里的句子也切（他一句一句说），
      //    切出一句就落一句、**每句各自占一行**。帘里只留最近两句（dlgTrim），
      //    像真的在听人讲话，而不是看一墙字幕。听完最后一句才放开选项。
      //    快慢三条出路（v20260914a 整理，此前注释还写着「句间按字数留 0.4~2.4s 的顿」，
      //    那个 dlgPace 定时器已随 v20260913a 一起废掉）：
      //      · 单点帘 / 空格 / 回车 / ↓ / 1-9  → 出下一句（逐句细读）
      //      · 连点两下（450ms 内）            → 本段一次讲完，立刻放开选项（已知内容，不想等）
      //      · 设置「文字演出」拉到 0（瞬）    → 压根不摆架势，一段一次落完
      //    文字演出设成「瞬（无动画）」时不摆架势，一段一次落完 —— 尊重 settings.textSpeed。
      if(text || !$dlgBody.children.length){
        if(text) dlgTalk.push({who:who, text:text});   // 留痕用（整段）
        var segs=text?splitSpeech(text, true):['……'];
        var si=0, fin=false, cur=null;
        var dlgEnd=function(){
          if(fin) return; fin=true;
          if(cur && cur.parentNode) cur.parentNode.removeChild(cur);
          cur=null; dlgTypeTimer=null; dlgSkip=null;
          dlgSkipAll=null; dlgTapAt=0;      // 落定后连点不再有效（v20260914a）
          dlgScroll(); dlgRelease();
        };
        // 落一整句：单独一行、整句一起出现（不再把整段堆进同一个段落）；
        // 报名字只靠帘头那方名章 —— 每句前再缀一遍「牢头：」只是纯占地方；
        // 光标只缀在正在讲的那句后面
        var dlgLine=function(){
          var s=segs[si++];
          var box=dlgNode('', text?'':'mute');
          box.say.textContent=s;
          recHist(s, 'dlg', who||'');   // 每落一句就记进回顾（v20260914a）
          if(cur && cur.parentNode) cur.parentNode.removeChild(cur);
          cur=document.createElement('span'); cur.className='cur'; cur.textContent='▍';
          box.node.appendChild(cur);
          dlgTrim(); dlgScroll();
          return s;
        };
        if(!(settings && settings.textSpeed>0)){       // 瞬：一段一次落完
          while(si<segs.length) dlgLine();
          dlgEnd();
        } else {
          // v20260913a：一句一出、玩家点一下才出下一句（点帘/空格/回车/↓/1-9 皆可）——
          // 不再自动接下一句，阅读节奏完全由玩家自己把握。
          // v20260914a：再给一条更快的出路 —— 连点两下（450ms 内）＝ 本段一次讲完、立刻放开选项。
          //   逐句读是「想细看」的人要的，连点略过是「已经知道他要说什么」的人要的，两者并存；
          //   从前一段六句独白要点六下才见得到选项，那点手速纯属白耗。
          dlgState(segs.length>1 ? '说话中…连点略过' : '说话中…');
          var dlgStep=function(){
            if(fin) return;
            if(si>=segs.length){ dlgEnd(); return; }
            dlgLine();
            dlgSkip=function(){
              if(dlgTypeTimer){ clearTimeout(dlgTypeTimer); dlgTypeTimer=null; }
              dlgStep();                       // 再点一下 → 出下一句
            };
          };
          dlgSkipAll=function(){               // 连点两下：剩下的句子一次落完
            if(fin) return;
            if(dlgTypeTimer){ clearTimeout(dlgTypeTimer); dlgTypeTimer=null; }
            while(si<segs.length) dlgLine();
            dlgEnd();
          };
          dlgTypeTimer=setTimeout(dlgStep, 130);
        }
      } else { dlgRelease(); }
      dlgScroll();
      askPending=true;      // 悬挂：锁罗盘 / 行动 / NPC / 面板，逼玩家把话答完（v20260911i）
      syncActionLock();
      return;
    }
    // ② 兜底：无 #dlg（旧 DOM）时退回原来那块 #tut-choices
    var app=document.getElementById('app'), lower=document.getElementById('lower');
    if(!app||!lower) return;
    var box=document.createElement('div'); box.id='tut-choices'; box.className='onb-choices';
    box.innerHTML='<div class="onb-prompt">'+(prompt||'')+'</div>';
    options.forEach(function(o){
      var b=document.createElement('button'); b.className='onb-btn'; b.textContent=o.label;
      b.onclick=function(){ removeTutChoices(); o.fn(); };
      box.appendChild(b);
    });
    app.insertBefore(box, lower);
    askPending=true;        // 悬挂：锁罗盘 / 行动 / NPC / 面板，逼玩家把话答完（v20260911i）
    syncActionLock();
  }
  function removeTutChoices(){
    var b=document.getElementById('tut-choices'); if(b&&b.parentNode) b.parentNode.removeChild(b);
    // 只收选项、不收帘：玩家答完这一句，接着还有后续台词要落在同一扇帘里
    if($dlgFoot) $dlgFoot.innerHTML='';
    dlgState('');
    askPending=false; syncActionLock();   // 收起即解锁（若叙事未完，syncActionLock 会按当前状态继续锁）
  }
  // [moved → shared/core/triggers.js] 触发引擎：数据驱动的「场景首访剧本」与「事件触发」。
  //   LF.createTriggers(ctx) 暴露 checkTriggers / graduate；getPath/setPath/isDay/resolveTpl/
  //   testCond/applySet/markDone/isDone/runSteps/runStep/runTrigger 一并抽离。
  // ── 以下 bldZihao / bldActOk / bldActsFilter 为建筑/掌柜辅助（被建筑弹窗复用，非触发引擎本体）──
  // ── 招牌联动：当前店铺字号（如「福兴杂货铺」→「福兴」），供掌柜台词自称「福兴号」；无招牌时回退建筑名 ──
  function bldZihao(){
    var ent=state.flags&&state.flags.bldEnt;
    var b=ent&&BUILDINGS[ent.key];
    if(!b && ent && ent.bp) b=LF.BUILD[ent.bp]||null;
    var sign=ent&&ent.sign;
    if(!sign) return (b&&(b.doneName||b.name))||'本店';
    var zh=sign.replace(/(药铺|布庄|食肆|杂货铺|营造所|酒楼|染坊|糕点铺|钱庄|铁匠铺|武馆|镖局|茶楼|赌馆|马行|书肆|香烛店|铺|馆|坊|店|行|肆|庄|楼)$/,'');
    return zh? zh+'号' : sign;
  }
  // ── 营业时间：act.when 过滤建筑内动作——day=卯~酉(昼) / night=戌~丑(夜) / morn=卯辰(清晨) / dusk=酉戌(黄昏)；缺省恒显示 ──
  function bldActOk(a){
    var w=a&&a.when; if(!w) return true;
    var h=state.time%12;
    if(w==='day') return h>=3 && h<=9;
    if(w==='night') return h>=10 || h<=1;
    if(w==='morn') return h===3 || h===4;
    if(w==='dusk') return h===9 || h===10;
    return true;
  }
  function bldActsFilter(acts){ if(typeof acts==='function') return acts; return (acts||[]).filter(bldActOk); }

  // ===== 苦役营·越狱逃脱枢纽（v20260902a）=====
  // camp_wall「决断出营·墙根」与 camp_gate「决断出营·岗哨」共用此枢纽：
  // 仅列出当前已解锁（flag/物品前置满足）的路线，玩家择一逃脱。
  var ROUTE_INFO = {
    crypt:   { name: '密道线',       where: 'camp_wall', flavor: '你按默叔所授暗号拨开乱砖，塌墙根下一道幽深暗道赫然在目。七拐八绕，头顶人声渐远，你钻出了营墙。' },
    tunnel:  { name: '挖地道线',     where: 'camp_wall', flavor: '你抡起镐锄，在矿道那头刨了数夜，土松墙薄——哗啦一声，地道通了。你猫腰钻出，泥一身却自由了。' },
    rope:    { name: '攀绳翻墙线',   where: 'camp_wall', flavor: '你将苏娘搓的绳甩上墙头，借力一荡，翻过碎瓷密布的墙脊，落在外头草丛里。' },
    drain:   { name: '水渠夜遁线',   where: 'camp_wall', flavor: '子时换岗，你循吴算盘所指水道，顺暗渠摸黑漂出墙根，水声盖住了一切动静。' },
    drug:    { name: '内应下药业',   where: 'camp_gate', flavor: '你趁伙房不备，将林娘的迷药下进粥锅。不多时官差东倒西歪睡死，你大摇大摆混出门去。' },
    riot:    { name: '趁乱暴动线',   where: 'camp_gate', flavor: '换岗那阵你夺了赵虎腰牌，秦九霄一声断喝，囚徒们哄然而起——你趁乱杀开一条血路冲出岗哨。' },
    wooden:  { name: '伪造木牍线',   where: 'camp_gate', flavor: '你举着陈简刻的木牍路引，岗哨官差懒得细看，一挥手放你过了正门。' },
    bribe:   { name: '收买犬卒线',   where: 'camp_gate', flavor: '你塞出一把银钱，犬舍/粮囤的看守眯眼揣了，装作没瞧见——你从便门溜出了营墙。' },
    assault: { name: '劫狱强攻线',   where: 'camp_gate', flavor: '木人桩上练出的拳脚今朝见真章：你硬闯岗哨，拳脚翻飞，把拦路的官差尽数放倒，杀出了这苦役营！' }
  };
  function escapeAvail(route){
    var f=state.flags||{}, p=state.pack||[];
    switch(route){
      case 'crypt':   return !!(f.route && f.route.crypt) && !!(f.task && f.task.signal);
      case 'tunnel':  return !!(f.route && f.route.tunnel) && !!packFind('pickaxe');
      case 'rope':    return !!packFind('rope');
      case 'drain':   return !!(f.route && f.route.drain);
      case 'drug':    return !!(f.route && f.route.drug) && !!packFind('sleep_drug');
      case 'riot':    return !!(f.route && f.route.riot);
      case 'wooden':  return !!packFind('wooden_pass');
      case 'bribe':   return (state.gold||0) >= 30;
      // v20260914d：第三条前置 —— 趁夜在中军帐兵器架藏下一件家伙（flags.route.rack，见 rackTake）
      case 'assault': return (state.level||1) >= 3 || !!(f.route && (f.route.dummy_done || f.route.rack));
    }
    return false;
  }
  function escapeLockHint(route){
    var f=state.flags||{};
    switch(route){
      case 'crypt':   return '（未解锁：需周听涛授密道线索 + 囚室与默叔对暗号）';
      case 'tunnel':  return '（未解锁：需苟三授挖地道线索 + 取得镐锄）';
      case 'rope':    return '（未解锁：需苏娘搓绳）';
      case 'drain':   return '（未解锁：需吴算/石四授水渠夜遁线索）';
      case 'drug':    return '（未解锁：需鲁大/林娘配迷药 + 取得迷药）';
      case 'riot':    return '（未解锁：需秦九霄授趁乱暴动线索）';
      case 'wooden':  return '（未解锁：需陈简伪造木牍路引）';
      case 'bribe':   return '（未解锁：需银两≥30，可收买犬卒/粮官）';
      case 'assault': return '（未解锁：需战力达标——练武场练至等级≥3、戳通木人桩，或趁夜在中军帐兵器架藏下一件家伙）';
    }
    return '（未解锁）';
  }
  // v20260914a：九条路线不再一次全铺开（未解锁的那几条还要各带一句长注解，一屏十项、读半天），
  //   改为「已备妥的直接列、未备妥的折成一笔」；想知道自己还差什么，再点开「细看还差什么」。
// [moved -> shared/core/escape.js]
  function doEscape(route, room){
    if(route==='riot' || route==='assault'){
      // 战斗路线：先与官差一战（普通战斗；胜负/撤退后由 exitCombatToRoom 钩子毕业，不再依赖教学 tcDone）
      if(!state.flags.route) state.flags.route={};
      state.flags.route._pending = route; save(state);
      log('你决意走「'+ROUTE_INFO[route].name+'」——营中官差横矛拦来！','combat');
      startCombat('camp_guard');
      return;
    }
    finishEscape(route);
  }
  function finishEscape(route){
    if(state.flags.route) state.flags.route._pending=null;
    if(route==='riot' && !packFind('guard_tally')) packAdd('guard_tally',1);
    if(route==='bribe'){ state.gold=Math.max(0,(state.gold||0)-30); }   // 收买犬卒：扣 30 银（叙事闭环，银钱开道）
    if(state.flags.onb) state.flags.onb.done=true;
    state.moveGate=null;
    save(state);
    // v20260911h：出营三叙（脱籍 / 逃脱 / 教学完成）改在 moveToOutside() 之后输出。
    //   renderRoom 开头的 flushNarr() 会丢弃「上一场景排队中/打字中」的文字，
    //   旧序（先 log 再 moveToOutside）会把这三段全清掉，玩家看不到逃脱文案与出营引导。
    graduate(true);          // 只做状态交接（移除 onb 界面/解锁菜单），脱籍文案延后统一输出
    moveToOutside();
    log('〔脱籍〕你已出营——点卯、晚归、口粮罚例一概不再管你；只是营中的钟点照旧，鼓声、作息、日头都不会为你停。','order');
    log('〔'+ROUTE_INFO[route].name+'·逃脱〕'+ROUTE_INFO[route].flavor,'env');
    log('〔教学完成〕你逃出了苦役营！自此汇入北疆乱世——点下方罗盘「北」前往林径，外头自有接应。','sys');
  }
  function moveToOutside(){
    state.room='lindao'; state.moveGate=null; save(state);
    renderRoom('lindao', true);
  }
  // 进场钩子：交由触发引擎评估（首访剧本 / 锁退路 / 逃脱等）
  function onbRoomEnter(room){
    checkTriggers({hook:'onEnter', room: room.id});
    // 刚踏进一处，看看是否已过戌时（v20260911i）：营中夜游者，巡夜狱卒立时来拿。
    //   不插进本格 onEnter 剧本中间，也让刚落位的叙事先把话说完 —— 由 requestCurfewPatrol 记「待评」。
    requestCurfewPatrol();
  }
  // 脚本化引导战斗（现迁移至练武场·木人桩，由韩铁逐步教学：攻击/防御/道具/撤退）
  function renderEquipPanel(){
    var slots=['weapon','armor','trinket','mount'];
    var slotName={weapon:'兵刃',armor:'护甲',trinket:'饰品',mount:'坐骑'};
    var h='<div class="row"><span>已装备</span></div><div class="equip-slots">';
    slots.forEach(function(sl){
      var eq=state.equipment[sl];
      if(eq){
        h+='<div class="eq-slot" data-slot="'+sl+'">'+
           '<span class="eq-dot" style="background:'+eq.color+'"></span>'+
           '<span class="eq-nm" style="color:'+eq.color+'">'+eq.name+'</span>'+
           '<span class="eq-st">'+LF.ITEMS.statText(eq)+'</span>'+
           '<span class="eq-dur">'+eq.dur+'/'+eq.maxDur+'</span>'+
           '<span class="eq-x">卸下</span></div>';
      } else {
        h+='<div class="eq-slot empty">'+slotName[sl]+'：—</div>';
      }
    });
    h+='</div>';
    return h;
  }
  var currentModalKind=null;

  // [moved → shared/core/building.js] 可进入建筑：BUILDINGS 数据表与进出楼房间逻辑（isBldRoom/bldForRoom/bldRoom/enterBldRoom/bldMove/leaveBldRoom/hasCount）

  // ══════════ 矿坑体系（v20260915i）：露天矿脉 + 分层矿洞 + 镐头六级 ══════════
  // 镐头不进行囊，是玩家自身的等级（state.flags.pick，0=粗石镐 … 5=百炼钢镐）：
  //   露天矿脉与矿洞全靠它衡量能凿什么、凿几下；升级走铁匠炉（RECIPES.forge 的 pick:N 配方）、
  //   市集（青铜镐）、或差役奖励（淘铜铸镐）。

  // 按当前镐算「凿某类矿点需几镐」（-1 = 镐不够，刃会弹开）

  // ═══ 露天矿脉 ═══

  // ═══ 矿洞（分层 1-9）═══

  // 探查下路（v20260915j）：每层先凿开松动的岩壁，方有下行之路；挖开时若带着木梯，顺手架梯直下

  // 架木梯下行（v20260915j）：下路挖通后，须耗一挂木梯才能再下一层

  // ═══ 角色大厅 · 主角详情（v20260923r）═══
  // 原 openModal('char') 的内容抽成独立函数，供 CharHall 在角色大厅内渲染主角页。
  // ── 主角详情分页（v20260924x 角色大厅四页签：状态/加点/装备/技能）──
  function mainCharStatHTML(){
    var es=effectiveStats();
    var h='<h3>角 色 · '+(state.name||'无名客')+'</h3>'+
      (function(){
        var need=(state.level>=G.CONSTANTS.MAX_LEVEL)?0:G.BALANCE.expNeed(state.level);
        if(!need) return row('等级','LV.'+state.level+' · 圆满')
          + '<div class="exp-bar"><i style="width:100%"></i></div>';
        var pct=Math.max(0,Math.min(100,Math.round(state.exp/need*100)));
        return row('等级','LV.'+state.level)
          + '<div class="row exp-sub"><span>修为</span><span>'+state.exp+' / '+need+'</span></div>'
          + '<div class="exp-bar"><i style="width:'+pct+'%"></i></div>';
      })()+
      row('气血',state.hp+' / '+es.maxHp)+
      (es.maxMp>0? row('内力',state.mp+' / '+es.maxMp):'')+
      row('精力',state.energy+' / '+state.maxEnergy)+
      row('食物',state.food+' / '+state.maxFood)+
      row('饮水',state.drink+' / '+state.maxDrink)+
      row('潜能',state.pot)+
      row('侠义',state.chivalry)+
      row('凶名',state.notoriety)+
      row('风评',moralTitle())+
      row('江湖声望',state.reputation+' · '+repTitle(state.reputation))+
      row('当前所处',curRoom().name)+
      row('门派',(state.sect && G.SECTS[state.sect]) ? G.SECTS[state.sect].name : '散人（未入门派）')+
      '<button class="sect-open" id="sect-open" type="button">⚔ '+(state.sect?'查看本门':'择一门派')+'</button>'+
      '<p class="tip">气血归零将殒落（回标题页读档/重开）。行止间消耗食物饮水与精力，「休整」可尽复。</p>';
    return h;
  }
  function mainCharAllocHTML(){
    return row('自由属性点',(state.freePoints||0))+
      '<div class="row"><span>四维（点击 ＋ 加点）</span></div><div class="ap-list">'+attrAllocHTML()+'</div>'+
      '<p class="tip">每升一级获得 1 点自由属性点，在此分配；未分配的点保留，可随时再开面板加点。</p>';
  }
  function mainCharEquipHTML(){
    var eq=state.equipment||{}; var SL=LF.SLOTS||{};
    var h='<div class="row"><span>已装备</span></div><div class="meq-list">';
    Object.keys(SL).forEach(function(slot){
      if(slot==='bag') return;
      var it=eq[slot], s=SL[slot];
      h+='<div class="meq-row"><span class="meq-slot">'+escapeHtml(s.label)+'</span>';
      if(it){
        var b='';
        if(it.atk) b+=' 攻+'+it.atk;
        if(it.def) b+=' 防+'+it.def;
        if(it.spd) b+=' 身+'+it.spd;
        h+='<span class="meq-name">'+escapeHtml(it.name)+'</span><span class="meq-bonus">'+(b?b:'已装备')+'</span>';
      } else {
        h+='<span class="meq-none">未装备</span>';
      }
      h+='</div>';
    });
    h+='</div><p class="tip">穿卸装备请前往行囊（背包）面板操作。</p>';
    return h;
  }
  function mainCharSkillHTML(){
    return '<div class="row"><span>武学</span></div><div class="skills">'+skillTags()+'</div>'+
      '<p class="tip">武学随行止与机缘习得；技击之术在战斗中自动施展。</p>';
  }
  function bindMainCharDetail(){
    bindAttrAlloc();
    var _sectOpen=document.getElementById('sect-open');
    if(_sectOpen) _sectOpen.onclick=function(){ openModal('sect'); };
  }

  // dock 选中态（v20260924h）：打开对应面板时高亮底部页签（朱砂卡+指示条），关窗/开非页签窗则清除
  function setDockRest(kind){
    var _map={char:1,pack:1,army:1,quest:1,map:1,settings:1};
    document.querySelectorAll('#dock button').forEach(function(b){
      if(kind && _map[kind] && b.getAttribute('data-modal')===kind) b.classList.add('rest');
      else b.classList.remove('rest');
    });
  }
  function openModal(kind, opts){
    if(currentModalKind==='shop' && kind!=='shop') Shop.restoreTradePending();   // 离开货郎：归还寄售真物并清空购入占位
    currentModalKind=kind;
    setDockRest(kind);   // 底部页签选中态跟随（v20260924h）
    dlgClose();   // 开面板即收对话窗（v20260912g）：底部位置让给面板，别两套东西叠着
    var _tt=document.getElementById('title'); if(_tt) _tt.classList.add('frozen');   // 冻结标题重绘，避免弹窗(择档等)卡顿
    var _pf=document.getElementById('pack-float'); if(_pf) _pf.style.display='none';
    var _sf=document.getElementById('shop-float'); if(_sf) _sf.style.display='none';
    if(state && state.dead){ die(); return; }
    // 打开任何弹窗时先移除战斗红光氛围，防止满血/非战斗画面泛红
    var sceneEl=document.getElementById('scene'); if(sceneEl){ sceneEl.classList.remove('bg-danger'); }
    if(kind!=='dev'){ try{ (kind==='levelup'?SFX.levelup():SFX.open()); }catch(e){} }   // 弹窗打开音效（levelup 用升阶音）
    if(kind==='dev'){ renderDev(); return; }
   try{
    var modalOpts=opts||{};
    // 捏人时隐藏标题页，并给弹窗不透明水墨背景，避免背景停留在标题页
    var tt=document.getElementById('title');
    if(tt){ if(kind==='create') tt.classList.add('hidden'); else if(!state) tt.classList.remove('hidden'); }
    $modal.classList.toggle('modal-create-bg', kind==='create');
    $modal.classList.toggle('give-modal', kind==='give');
    var h='';
    if(kind==='char'){
      h=CharHall.renderCharHall();
    } else if(kind==='levelup'){
      h=renderLevelup();
    } else if(kind==='pack'){
      h=renderPack();
    } else if(kind==='give'){
      h=renderGivePanel(modalOpts.npc);
    } else if(kind==='army'){
      h=renderArmyPanel();
      setTimeout(function(){ bindArmyPanel(); },0);
    }
    else if(kind==='officers'){
      h=renderOfficerHub();
    }
    else if(kind==='officerSearch'){
      h=renderSearchPanel();
    } else if(kind==='party'){
      h=renderPartyPanel();
    } else if(kind==='quest'){
      h=renderObjectives();
    } else if(kind==='job'){
      h=renderJobBoard();
    } else if(kind==='mine'){
      h=renderMinePanel();
    } else if(kind==='minecave'){
      h=renderCavePanel();
    } else if(kind==='map'){
      if(isCityGrid(state.room) && state.flags.cityPos && !modalOpts.forceWorld){
        h=buildCityMapTabsHTML(modalOpts._scope==='world');   // 城内：布防图 ↔ 山河志 双页签（scope=world 默认山河志）
      } else if(G.ROOMS[state.room] && G.ROOMS[state.room].isField){
        h=buildFieldMapTabsHTML(modalOpts._scope==='world');   // 野外：郊野图 ↔ 山河志 双页签
      } else {
        h=buildStrategicMapHTML({});
      }
    } else if(kind==='clock'){
      var R=41; // 时辰标签半径（百分比）
      var clkLabels='';
      SHICHEN.forEach(function(name,i){
        var ang=(i*30-90)*Math.PI/180;     // 子时居顶，顺时针排布
        var x=50+R*Math.cos(ang), y=50+R*Math.sin(ang);
        var cur=(i===state.time%12);
        clkLabels+='<span class="clk-lab'+(cur?' cur':'')+'" style="left:'+x.toFixed(2)+'%;top:'+y.toFixed(2)+'%">'+name.replace('时','')+'</span>';
      });
      var handAng=(state.clock/1440)*360-90;   // 指针随当日分钟转动
      var isDay=((state.time%12)>=3 && (state.time%12)<=9);  // 卯~酉为昼
      var c=deriveCalendar();
      var era=(state.eraName||'光和')+(c.eraYear===1?'元年':c.eraYear+'年');
      var w=WEATHERS[state.weather]||WEATHERS[0];
      var hh=String(Math.floor(state.clock/60)).padStart(2,'0');
      var mm=String(state.clock%60).padStart(2,'0');
      h='<h3>时 辰 钟</h3>'+
        '<div class="clk-dial '+(isDay?'day':'night')+'">'+
          clkLabels+
          '<div class="clk-hand" style="transform:translate(-50%,-100%) rotate('+handAng.toFixed(1)+'deg)"></div>'+
          '<div class="clk-center">'+
            '<div class="clk-t">'+hh+':'+mm+'</div>'+
            '<div class="clk-s">'+SHICHEN[state.time%12]+'</div>'+
            '<div class="clk-e">'+(isDay?'☀':'🌙')+' '+era+'</div>'+
            '<div class="clk-e">'+c.monthName+'月'+c.dayName+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="clk-meta">'+
          '<div class="clk-row"><span>天候</span><b>'+w.ic+' '+w.n+'</b></div>'+
          '<div class="clk-row"><span>农历</span><b>'+era+c.monthName+'月'+c.dayName+'</b></div>'+
          '<div class="clk-row"><span>公历</span><b>公元'+c.adYear+'年 '+c.gregMonth+'月'+c.gregDay+'日 · 星期'+c.wk+'</b></div>'+
        '</div>'+
        '<p class="tip">子时居顶（夜半），午时居底（正午）；卯时朝阳在东、酉时落日于西。</p>';
    } else if(kind==='create'){
      if(!createState) initCreateState();
      h=renderCreateHTML();
    } else if(kind==='newgame'){
      h=renderSlotsHTML('new');
    } else if(kind==='load'){
      h=renderSlotsHTML('load');
    } else if(kind==='codex'){
      h=renderCodex();
    } else if(kind==='settings'){
      h=renderSettings(modalOpts);
    } else if(kind==='credit'){
      h=renderCredit();
    } else if(kind==='craft'){
      if(opts && opts.bench) craftState.bench = opts.bench;
      h=renderCraftPanel();
    } else if(kind==='shop'){
      h=Shop.openShop(opts && opts.shop);
    } else if(kind==='build'){
      if(opts && opts.site) buildState.site = opts.site;
      h=renderBuildPanel();
    } else if(kind==='storage'){ storageCid=(opts&&opts.cid)?opts.cid:state.room; h=Shop.openShop(storageCid,'storage');
    } else if(kind==='rest'){
      if(opts && opts.kind) restState.kind = opts.kind;
      h=renderRestPanel();
    } else if(kind==='forge'){
      if(opts && opts.site) forgeState.site = opts.site;
      h=renderForgePanel();
    } else if(kind==='citystat'){
      h=renderCityStat(opts && opts.cid ? opts.cid : state.room);
    } else if(kind==='citybuild'){
      if(opts && opts.cid!=null) cityBuildState.cid=opts.cid;
      if(opts && opts.x!=null) cityBuildState.x=opts.x;
      if(opts && opts.y!=null) cityBuildState.y=opts.y;
      h=renderCityBuildPanel();
    } else if(kind==='building'){
      // 已在建筑房间内：acts 中的 openModal('building') 用作场景刷新，不再弹窗
      if(state && state.room && isBldRoom(state.room)){
        closeModal();
        renderRoom(state.room, true);
        return;
      }
      if(opts && (opts.building || opts.bp)){
        var _bpd=(opts.bp ? (LF.BUILD[opts.bp]||null) : null);
        buildingState = { building:(opts.building || (_bpd? '__bp_'+_bpd.key : 'yaofu')), bp:(opts.bp||null), cid:opts.cid, x:opts.x, y:opts.y, area:'root', stack:[], sel:null };
      }
      if(!buildingState || !buildingState.area){ buildingState={building:'yaofu', bp:null, area:'root', stack:[], sel:null}; }
      h=renderBuildingPanel();
    } else if(kind==='edict'){
      h=renderEdict();
    } else if(kind==='factionMap'){
      h=renderFactionMap();
    } else if(kind==='sect'){
      h=renderSectPanel();
    } else if(kind==='diplomacy'){ h=renderDiplomacy(state.flags._dipFid)||''; } else if(kind==='event'){ h=renderEvent(); } else if(kind==='duel'){ h=renderDuel(); } else if(kind==='debate'){ h=renderDebate(); } else if(kind==='log'){
      h=renderLogPanel();          // 回顾（v20260914a）：顶栏「回顾」/ 状态栏右侧那颗
    }
    $card.innerHTML=h;
    injectModalFb();   // v20260915j：每扇窗都带顶部反馈条（操作结果不再被面板挡死）
    $card.classList.toggle('pack-card', kind==='pack' || kind==='shop' || kind==='storage' || kind==='give');
    $card.classList.toggle('give-card', kind==='give');
    $card.classList.toggle('levelup-card', kind==='levelup');
    // 捏人界面隐藏右上角 X 按钮（不可中途退出，v20260908j）
    var mx=document.getElementById('modal-x'); if(mx) mx.style.visibility=(kind==='create')?'hidden':'visible';
    if(kind==='create') bindCreate();
    if(kind==='char'){
      CharHall.bindCharHall();
    }
    if(kind==='pack'){ bindPackInteractions(); }
    if(kind==='give'){ bindGivePanel(); }
    if(kind==='craft'){ bindCraftPanel(); }
    if(kind==='shop'){ Shop.bindShopPanel(); }
    if(kind==='build'){ bindBuildPanel(); }
    if(kind==='storage'){ Shop.bindShopPanel(); }
    if(kind==='rest'){ bindRestPanel(); }
    if(kind==='forge'){ bindForgePanel(); }
    if(kind==='building'){ bindBuildingPanel(); }
    if(kind==='citybuild'){ bindCityBuildPanel(); }
    if(kind==='sect'){ bindSectPanel(); }
    if(kind==='quest'){ bindQuestPanel(); }
    if(kind==='job'){ bindJobBoard(); }
    // 回顾面板（v20260914a）：落位到最新一句（与叙事区同序：旧的在上、新的在下），并绑「收起」
    if(kind==='log'){
      var _lv=document.getElementById('m-leave'); if(_lv) _lv.onclick=function(){ closeModal(); };
      try{ $card.scrollTop=$card.scrollHeight; }catch(e){}
    }
    // v20260912f：教学期「打开行囊 / 打开任务」本身就是教学动作 —— 记下进度并推进目标指引，
    //   否则玩家可能把这两个页签一直晾着，目标条还停在「点开看看」上。只在教学期记账，不影响正常游玩。
    if(state && state.flags && state.flags.onb && !state.flags.onb.done){
      var _onb=state.flags.onb, _onbCh=false;
      if(kind==='pack'  && !_onb.packSeen ){ _onb.packSeen =true; _onbCh=true; }
      if(kind==='quest' && !_onb.questSeen){ _onb.questSeen=true; _onbCh=true; }
      // 「角色」这一课（v20260914c）：与行囊/任务同款 —— 真的开过才算学会，记账后目标条自动往下走
      if(kind==='char'  && !_onb.charSeen ){ _onb.charSeen =true; _onbCh=true; }
      if(_onbCh){ try{ save(state); }catch(e){} onbGoal(); }
    }
    $modal.classList.remove('hidden');
    var sv=document.getElementById('m-save'); if(sv)sv.onclick=function(){save(state);toast('已存档');};
    var dv=document.getElementById('m-dev'); if(dv)dv.onclick=function(){openModal('dev');};
    // 设置标签页切换
    $card.querySelectorAll('.set-tabs button').forEach(function(b){ b.onclick=function(){ var t=b.getAttribute('data-tab'); $card.querySelectorAll('.set-tabs button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); $card.querySelectorAll('.set-panel').forEach(function(p){ p.classList.toggle('hidden', p.getAttribute('data-panel')!==t); }); tick(); }; });
    // 择档面板交互
    $card.querySelectorAll('.slot[data-slot]').forEach(function(el){
      el.onclick=function(e){
        // 若点击的是确认层按钮，由下方独立绑定处理，不冒泡到 slot
        if(e.target.closest('.sl-confirm')) return;
        var slot=parseInt(el.getAttribute('data-slot'),10);
        var mode=el.getAttribute('data-mode');
        // 点任意档时先收回其它已展开的「是否覆盖」确认层（同一时刻只允许一个展开）
        var slots=el.parentNode ? el.parentNode.querySelectorAll('.slot.on-confirm') : [];
        for(var si=0; si<slots.length; si++){ if(slots[si]!==el) slots[si].classList.remove('on-confirm'); }
        if(mode==='new'){
          if(slotExists(slot)){
            // 显示行内确认层（替代浏览器 confirm，避免沙箱/拦截导致无反应）
            el.classList.add('on-confirm');
            return;
          }
          beginCreate(slot);
        } else {
          if(!slotExists(slot)){ toast('此卷尚空，无可续之缘'); return; }
          enterGame(rawSlot(slot), slot); closeModal();
        }
      };
    });
    // 覆写确认层按钮
    $card.querySelectorAll('.sl-confirm button[data-action]').forEach(function(btn){
      btn.onclick=function(e){
        e.stopPropagation();
        var slot=parseInt(btn.getAttribute('data-slot'),10);
        var act=btn.getAttribute('data-action');
        if(act==='overwrite'){
          // 覆写 = 在该卷重建新角色，仍须走捏人→序章→入局流程
          beginCreate(slot);
        } else {
          var slotEl=btn.closest('.slot');
          if(slotEl) slotEl.classList.remove('on-confirm');
        }
      };
    });
    // 设置面板交互（标签页内容）
    var rng=document.getElementById('rng-speed'); if(rng) rng.oninput=function(){ settings.textSpeed=parseInt(rng.value,10); saveSettings(); var _v=document.getElementById('spd-val'); if(_v) _v.textContent=lfSpeedLabel(settings.textSpeed); };
    var fx=document.getElementById('seg-fx'); if(fx) fx.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ settings.titleFx=!!parseInt(b.getAttribute('data-v'),10); saveSettings(); fx.querySelectorAll('button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); tick(520); applyTitleFx(); toast('标题特效·'+(settings.titleFx?'开':'关')); }; });
    var snd=document.getElementById('seg-snd'); if(snd) snd.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ settings.sound=!!parseInt(b.getAttribute('data-v'),10); saveSettings(); snd.querySelectorAll('button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); if(settings.sound) tick(700); try{ SFX.setEnabled(settings.sound); }catch(e){} toast('音效·'+(settings.sound?'开':'关')); }; });
    // BGM/SFX 音量滑块（v20260909a）
    var rngBgm=document.getElementById('rng-bgm'); if(rngBgm){ rngBgm.oninput=function(){ var v=parseInt(this.value,10); document.getElementById('bgm-val').textContent=v+'%'; settings.bgmVol=v; saveSettings(); try{ SFX.setBgmVolume(v/100); if(v>0 && !SFX.isBgmPlaying()) SFX.startBgm(); if(v===0) SFX.stopBgm(); }catch(e){} }; }
    var rngSfx=document.getElementById('rng-sfx'); if(rngSfx){ rngSfx.oninput=function(){ var v=parseInt(this.value,10); document.getElementById('sfx-val').textContent=v+'%'; settings.sfxVol=v; saveSettings(); try{ SFX.setSfxVolume(v/100); SFX.click(); }catch(e){} }; }
    // BGM曲目选择（v20260909i，修复v20260909q：切换时确保BGM播放）
    var bgmTrackSeg=document.getElementById('seg-bgm-track'); if(bgmTrackSeg){ bgmTrackSeg.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ var idx=parseInt(b.getAttribute('data-idx'),10); try{ SFX.setBgmTrack(idx); bgmTrackSeg.querySelectorAll('button').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); // 确保BGM在播放（如果之前中断了）
        if(!SFX.isBgmPlaying()){ SFX.startBgm(); }
        toast('曲目·'+b.textContent.trim()); }catch(e){} }; }); }
    var cl=document.getElementById('m-clear'); if(cl)cl.onclick=function(){ if(!confirm('清除全部三档存档？此去不可复返。')) return; SLOTS.forEach(function(k,i){ clearSlot(i+1); }); toast('三档已清'); closeModal(); showTitle(); };
    if(kind==='map'){
      if(isCityGrid(state.room) && state.flags.cityPos && !modalOpts.forceWorld){
        if(initMapTabs()) initMapCity({});          // 页签绑定 + 布防图默认页交互
        else initMapCity({});
      } else if(G.ROOMS[state.room] && G.ROOMS[state.room].isField){
        initMapTabs();                              // 野外：页签绑定；world 页首次切到才初始化战略图（focusYou 居中郊野）
      } else {
        initStrategicMapInGame({ focusYou:true });   // 山河志打开默认居中「此身所在」（v20260905j）
      }
    }
    if(kind==='mine'){ bindMinePanel(); }
    if(kind==='minecave'){ bindCavePanel(); }
    // 装备面板交互
    $card.querySelectorAll('.eq-slot[data-slot]').forEach(function(el){
      el.onclick=function(){ unequip(el.getAttribute('data-slot')); };
    });
    $card.querySelectorAll('.eq-item[data-id]').forEach(function(el){
      el.onclick=function(){ equipItem(el.getAttribute('data-id')); };
    });
   }catch(err){
     $card.innerHTML='<h3>界面出错</h3><p class="tip">'+String((err&&err.message)||err)+'</p>';
     $modal.classList.remove('hidden');
     var c=document.getElementById('m-close'); if(c)c.onclick=closeModal;
   }
  }

  // ===== 战略地图（D3 矢量 · 三国州郡）=====
  function buildStrategicMapHTML(opts){
    opts=opts||{};
    var title = opts.pickSpawn ? '选择出生点' : '山河志 · 战略地图';
    var tip = opts.pickSpawn
      ? '与山河志同一张地图：点圆点=城池、方点=关隘/野地/副本。点击任一点即设为出生点并立即传送（城市出生落在城门）。'
      : '拖拽平移 · 滚轮缩放 · 点击城池前往（体力-4 · 食物-1 · 饮水-1 · 时间+1刻）。当前位于「'+curRoom().name+'」；点右下 ◎ 可回到所在处。';
    return '<h3>'+title+'</h3>'+
      '<div id="strategic-map-container"></div>'+
      '<p class="tip">'+tip+'</p>';
  }
  // 解析「此身所在」的地图标记：
  //   城内/城格 → 城点；城内建筑 → 所属城；specialGeo 手写锚点房 → 该地理点
  function smYouMark(){
    if(!state || !state.room) return null;
    var rid=state.room;
    if(isBldRoom(rid)){
      var back=state.flags && state.flags.bldEnt && state.flags.bldEnt.back;
      if(back && back.kind==='city' && back.cid){
        var _bc=(LF.CITIES||{})[back.cid];
        if(_bc && _bc.pos) return {type:'you', pos:_bc.pos, cid:back.cid, label:'此身所在 · '+_bc.name};
      }
      return null;
    }
    var c=(LF.CITIES||{})[rid];
    if(c && c.pos) return {type:'you', pos:c.pos, cid:rid, label:'此身所在 · '+c.name};
    var sg=((LF.MAP&&LF.MAP.specialGeo)||{})[rid];
    if(sg && sg.pos) return {type:'you', pos:sg.pos, cid:rid, label:'此身所在 · '+sg.name};
    // 郊野行军格：按「母城 → 外邻各点均值」线性插值打点，表明正行于哪片郊野
    var _cr=G.ROOMS[rid];
    if(_cr && _cr.isField && _cr.fieldId){
      var _fp=(LF.PLACES||{})[_cr.fieldId]||{};
      var _par=_fp.parent;
      var _cpos=null;
      if((LF.CITIES||{})[_par] && LF.CITIES[_par].pos) _cpos=LF.CITIES[_par].pos;
      else if((LF.PLACES||{})[_par] && LF.PLACES[_par].pos) _cpos=LF.PLACES[_par].pos;
      var _fmeta=((LF.Travel&&LF.Travel.fields)||{})[_cr.fieldId]||{};
      // v20260907d：多段郊野链的中段 neighbors 是指向「下一程入口房」的虚拟邻点（无真实经纬）。
      // 沿链递归到末段，收集真实邻城/邻地点的坐标作为外端点；endStage 用于按「段序+段内进度」全局插值，
      // 使中段「此身所在」打点不再从战略图消失，且位置沿母城→外端点连续推进。
      var _posList=[], _endStage=_fmeta.stage||0;
      (function walk(m){
        ((m.neighbors)||[]).forEach(function(n){
          var _p=((LF.CITIES&&LF.CITIES[n.nid]&&LF.CITIES[n.nid].pos)?LF.CITIES[n.nid].pos
                :((LF.PLACES&&LF.PLACES[n.nid]&&LF.PLACES[n.nid].pos)?LF.PLACES[n.nid].pos:null));
          if(_p){ _posList.push(_p); return; }
          var _nr=G.ROOMS[n.nid], _ff=_nr&&_nr.fieldId;
          if(_ff && LF.Travel && LF.Travel.fields && LF.Travel.fields[_ff]){
            var _nx=LF.Travel.fields[_ff];
            if((_nx.stage||0)>_endStage) _endStage=_nx.stage||0;
            if(_endStage<=8) walk(_nx);
          }
        });
      })(_fmeta);
      if(_cpos && _posList.length){
        var _g=_fp.gateDir||'东';
        var _geo=LF.Travel.fieldGeometry(_fp.size||4,_g);
        var _near=(_g==='东'||_g==='西')?_geo.nearCol:_geo.nearRow;
        var _ax=(_g==='东'||_g==='西')?_cr.fc:_cr.fr;
        var _den=(_fp.size||4)-1;
        var _t=(_den<=0)?0.5:(((_g==='东'||_g==='南')?(_ax-_near):(_near-_ax))/_den);
        _t=Math.max(0,Math.min(1,_t));
        var _s=_fmeta.stage||0, _glb=(_s+_t)/(_endStage+1);
        var _ox=0,_oy=0; _posList.forEach(function(p){ _ox+=p[0]; _oy+=p[1]; });
        _ox/=_posList.length; _oy/=_posList.length;
        return {type:'you', pos:[_cpos[0]+(_ox-_cpos[0])*_glb, _cpos[1]+(_oy-_cpos[1])*_glb],
                cid:_cr.fieldId, label:'此身所在 · '+((_fp.name)||'郊野')};
      }
    }
    return null;
  }
  // 主线/任务目标打点（后续支线目标可在此追加）
  function smGoalMarks(){
    var marks=[];
    if(state && state.quest && state.quest.luoyang){
      var lc=(LF.CITIES||{}).luoyang;
      if(lc && lc.pos) marks.push({type:'goal', pos:lc.pos, cid:'luoyang', label:'目标 · 赴洛阳'});
    }
    return marks;
  }
  function strategicMapMarks(){
    var out=[];
    var y=smYouMark(); if(y) out.push(y);
    smGoalMarks().forEach(function(x){ out.push(x); });
    return out;
  }
  // 运行时归属读取器：让山河志城市点/详情随易主实时变色（v20260909o）
  function strategicOwnerOf(cid){ try{ return cityOwnerOf(cid); }catch(e){ return null; } }
  // 战略地图懒加载（v20260919f）：d3 / map_regions / strategic-map 三件套体积大（d3 ~280KB），
  // 仅在首次开图时才注入，避免首屏下载/解析这些用户可能永远用不到的资源。
  // 资源 URL 清单放在 index.html 的 window.__MAP_ASSETS（版本号随对应文件走，便于统一 bump）。
  var _mapReady=null;
  function ensureStrategicMap(){
    if(_mapReady) return _mapReady;
    _mapReady=new Promise(function(resolve, reject){
      var A=window.__MAP_ASSETS;
      if(A && window.d3 && window.LF && LF.REGIONS && LF.initStrategicMap){ resolve(); return; }
      function load(src){
        return new Promise(function(res, rej){
          var s=document.createElement('script'); s.src=src; s.async=true;
          s.onload=function(){ res(); };
          s.onerror=function(){ rej(new Error('地图资源加载失败: '+src)); };
          document.head.appendChild(s);
        });
      }
      var chain=Promise.resolve();
      if(!A || !window.d3) chain=chain.then(function(){ return load(A?A.d3:'shared/vendor/d3.min.js'); });
      if(!A || !(window.LF && LF.REGIONS)) chain=chain.then(function(){ return load(A?A.regions:'shared/data/map_regions.js'); });
      if(!A || !(window.LF && LF.initStrategicMap)) chain=chain.then(function(){ return load(A?A.sm:'shared/strategic-map.js'); });
      chain.then(resolve, reject);
    });
    return _mapReady;
  }
  function initStrategicMapInGame(opts){
    opts=opts||{};
    var container=document.getElementById('strategic-map-container');
    if(!container) return;
    function render(){
      var marks=strategicMapMarks();
      // 选出生点模式
      if(opts.pickSpawn){
        LF.initStrategicMap(container, {
          marks: marks,
          ownerOf: strategicOwnerOf,
          onCityClick: function(city){
            if(!city || !city.id) return;
            state.spawnRoom=city.id;
            log('【调试】出生点已设为：'+city.name+'。','good');
            closeModal(); renderRoom(city.id); save(state);
          }
        });
      } else {
        // 正常模式：点击城市点=显示详情（placeInfo）；点详情面板「前往此城」= goRoomOnMap 传送（v20260918a 接线）
        LF.initStrategicMap(container, {
          marks: marks,
          focusYou: !!opts.focusYou,
          ownerOf: strategicOwnerOf,
          onCityClick: function(city){
            if(!city || !city.id) return;
            placeInfo(city.id, city.name, city.kind, city.state, city.desc, city.owner, city.isPlace);
          },
          onCityGo: function(city){
            if(!city || !city.id) return;
            goRoomOnMap(city.id);
          }
        });
      }
    }
    if(window.LF && LF.initStrategicMap && window.d3 && LF.REGIONS){
      render(); return;
    }
    container.innerHTML='<div class="strategic-loading">战略地图加载中...</div>';
    ensureStrategicMap().then(function(){
      if(window.LF && LF.initStrategicMap && window.d3 && LF.REGIONS) render();
      else container.innerHTML='<div class="strategic-loading">战略地图加载失败，请刷新重试</div>';
    }).catch(function(){
      container.innerHTML='<div class="strategic-loading">战略地图加载失败，请刷新重试</div>';
    });
  }

  function closeModal(){
    var _tt=document.getElementById('title'); if(_tt){ _tt.classList.remove('frozen'); if(!_tt.classList.contains('hidden') && window.startTitleDrip) window.startTitleDrip(); }
    if(state && state.dead){ die(); return; }
    // 捏人进行中（state 尚未建立）禁止中途收起，否则会露出标题屏并丢失进度
    if(currentModalKind==='create' && !state){ return; }
    var _pf=document.getElementById('pack-float'); if(_pf) _pf.style.display='none';
    var _sf=document.getElementById('shop-float'); if(_sf) _sf.style.display='none';
    $modal.classList.add('hidden');
    try{ SFX.close(); }catch(e){}   // 弹窗关闭音效（v20260909a）
    if(currentModalKind==='shop') Shop.restoreTradePending();   // 关店归还寄售真物，避免退出后丢失
    var _closedKind=currentModalKind;   // v20260913c：收起前先记下关的是哪扇窗（行囊教学要接着往下讲）
    currentModalKind=null;   // 复位，使 afterPackChange 能区分「行囊是否仍打开」
    setDockRest(null);       // 收起面板清底部页签选中态（v20260924h）
    syncActionLock();        // 收起弹窗后重算交互锁（对话悬挂未答完则仍锁着，v20260911i）
    if(_closedKind==='pack') onbAfterPack();   // 首次合上行囊 → 栅外那嗓子该开口了（见 onbAfterPack）
  }
  $modal.addEventListener('click',function(e){if(e.target===$modal)closeModal();});
  var $modalX=document.getElementById('modal-x');
  if($modalX){ $modalX.addEventListener('click',function(e){e.stopPropagation();closeModal();}); }
  document.querySelectorAll('#dock button').forEach(function(b){
    b.onclick=function(){
      var m=b.getAttribute('data-modal');
      if(m==='rest'){ dockRest(); return; }
      if(m==='survey'){ dockSurvey(); return; }
      openModal(m);
    };
  });
  // 方向 Tab 栏：出行（罗盘）/ 探查（整合进枢纽区，dock 已移除探查）
  document.querySelectorAll('#move-tabs .mv-tab').forEach(function(t){
    t.onclick=function(){
      var tab=t.getAttribute('data-tab');
      document.querySelectorAll('#move-tabs .mv-tab').forEach(function(x){x.classList.remove('active');});
      t.classList.add('active');
      if(tab==='scout'){ dockSurvey(); }   // 探查：脉冲高亮出口 / 记录环境
    };
  });
  function dockSurvey(){
    if(state.defeated){ dockRest(); return; }
    var bar=document.getElementById('move-bar');
    if(bar && bar.classList.contains('has-exits')){
      // 有出口：脉冲高亮移动条，提示出口所在
      bar.classList.add('pulse');
      setTimeout(function(){ bar.classList.remove('pulse'); }, 2400);
      bar.scrollIntoView({behavior:'smooth', block:'center'});
    } else {
      // 无出口房间：重新记录环境描述
      var room=G.ROOMS[state.room]||bldRoom(state.room);
      var find=room&&room.find||'你凝神四望，周遭风物尽收眼底。';
      log(find,'investigate');
      toast('已探明周遭');
    }
  }
  function dockRest(){
    if(combatMode){ toast('战斗中无法歇息'); return; }
    if(state.dead){ die(); return; }
    openRestModal('ground');
  }
  // ===== 调试：大地图选出生点 =====
  // 与主地图同一套 D3 战略图（61 城 + 野外/关隘/副本全点位），点击任意点即设为出生点并传送
  function openSpawnMap(){
    if(state.dead){ die(); return; }
    var h=buildStrategicMapHTML({pickSpawn:true});
    $card.innerHTML=h+'<button class="close" id="m-close">取 消</button>';
    $modal.classList.remove('hidden');
    currentModalKind='map';   // 与山河志一致，便于关闭/刷新逻辑复用
    var c=document.getElementById('m-close'); if(c)c.onclick=closeModal;
    initStrategicMapInGame({pickSpawn:true});
  }
  // 全局小提示（v20260916d 强化，v20260916d 修正）：多行 + 时长随文本长度自适应
  //   旧版单行 1.4s 固定：长提示只看得见开头。
  //   修正说明：初版加了「队列」，但队列靠嵌套 setTimeout 驱动——一旦某个定时器被
  //   环境丢弃（后台/自动化标签页节流），队列会整体卡死、后续提示永不显示。改为
  //   「重置式」：每次调用直接显示最新一条并刷新计时，无队列、无链式定时器，永不死锁。
  var _toastTimer=null;
  function toast(msg, ms, cls){
    if(settings.sound) tick(480);
    $toast.textContent=String(msg==null?'':msg);
    $toast.className='show '+(cls||'');
    if(_toastTimer) clearTimeout(_toastTimer);
    _toastTimer=setTimeout(function(){ $toast.classList.remove('show'); _toastTimer=null; },
      ms||Math.min(4200, Math.max(1700, 900+String(msg).length*80)));
  }

  // ── 全局桥接（v20260825b）：shared/data/build.js 等数据文件中的交互回调在全局作用域
  //    解析 openModal/log/exert/packFind…，需将游戏内部函数暴露到 window，否则建筑内面板（如铁砧打造）打开报 ReferenceError
  // ── 单挑 / 舌战 / 安全募兵（v20260922f）──
  function _tpl(id) { var all = (LF.PERSONA && LF.PERSONA.listRegistered) ? LF.PERSONA.listRegistered() : []; for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function _duelSkill(id) { var t = _tpl(id); if (!t) return 0; var s = 0; (t.skills || []).forEach(function (k) { if (['骁勇', '猛者', '斗将', '悍勇'].indexOf(k) >= 0) s += 6; }); return s; }
  function _debateSkill(id) { var t = _tpl(id); if (!t) return 0; var s = 0; (t.skills || []).forEach(function (k) { if (['论客', '反计', '智将', '沉着'].indexOf(k) >= 0) s += 6; }); return s; }
  function renderDuel() {
    var d = window.__duel; if (!d) return '';
    var e = _tpl(d.enemyId) || { name: '敌将', stats: { wu: 60 } };
    var st = S(); var du = (st.flags._duel) || { phase: 'pick', pickId: null, rounds: [], momentum: 0, win: false };
    if (du.phase === 'done') {
      var h = '<div class="du-box"><div class="du-h">⚔ 单挑 · ' + escapeHtml((_tpl(du.pickId) || {}).name || '我将') + ' vs ' + escapeHtml(e.name) + '</div>';
      h += '<div class="du-res ' + (du.win ? 'win' : 'lose') + '">' + (du.win ? '单挑得胜！敌将败走，其军士气大挫。' : '单挑失利，我将受挫，然军心未乱。') + '</div>';
      h += '<div class="du-acts"><button class="btn primary" onclick="duelGo()">继续开战</button><button class="btn" onclick="duelSkip()">免战收兵</button></div></div>';
      return h;
    }
    if (du.phase === 'fight') {
      var h = '<div class="du-box"><div class="du-h">⚔ 单挑 · ' + escapeHtml((_tpl(du.pickId) || {}).name || '我将') + ' vs ' + escapeHtml(e.name) + '</div>';
      h += '<div class="du-mom">气势：' + Math.round(du.momentum) + '</div>';
      (du.rounds || []).forEach(function (r, i) { h += '<div class="du-r">第' + (i + 1) + '合·' + r.txt + '</div>'; });
      if ((du.rounds || []).length < 3) {
        h += '<div class="du-acts"><button class="btn" onclick="duelRound(\'突进\')">突进</button><button class="btn" onclick="duelRound(\'守势\')">守势</button><button class="btn" onclick="duelRound(\'奇袭\')">奇袭</button></div>';
      }
      return h;
    }
    // 选将
    var h = '<div class="du-box"><div class="du-h">⚔ 阵前单挑</div><div class="du-sub">敌将 ' + escapeHtml(e.name) + '（武 ' + (e.stats.wu || 0) + '）叫阵，可遣将出战。</div><div class="du-list">';
    (st.officers || []).forEach(function (o) {
      var t = _tpl(o.id) || {}; var on = du.pickId === o.id ? ' on' : '';
      h += '<button class="btn sm' + on + '" onclick="duelPick(\'' + o.id + '\')">' + escapeHtml(o.name) + '　武 ' + (t.stats ? t.stats.wu : 0) + '</button>';
    });
    h += '</div><div class="du-acts"><button class="btn primary" onclick="duelStart()">发起单挑</button><button class="btn" onclick="duelSkip()">免战</button></div></div>';
    return h;
  }
  function duelPick(id) { var st = S(); st.flags._duel = st.flags._duel || {}; st.flags._duel.pickId = id; openModal('duel'); }
  function duelStart() {
    var d = window.__duel; if (!d) return; var st = S();
    var pickId = (st.flags._duel && st.flags._duel.pickId);
    if (!pickId && (st.officers || []).length) { var best = null; (st.officers || []).forEach(function (o) { var t = _tpl(o.id); if (t && (!best || (t.stats.wu || 0) > (best.stats.wu || 0))) best = t; }); pickId = best ? best.id : null; }
    st.flags._duel = { phase: 'fight', pickId: pickId, rounds: [], momentum: 0, win: false };
    openModal('duel');
  }
  function duelRound(choice) {
    var d = window.__duel; if (!d) return; var st = S(); var du = st.flags._duel; if (!du || du.phase !== 'fight') return;
    var me = _tpl(du.pickId) || { stats: { wu: 50 } }, en = _tpl(d.enemyId) || { stats: { wu: 60 } };
    var map = { '突进': 'a', '守势': 'b', '奇袭': 'c' }, beats = { a: 'b', b: 'c', c: 'a' };
    var ec = ['突进', '守势', '奇袭'][Math.floor(Math.random() * 3)];
    var pc = map[choice], pe = map[ec], rw = 0;
    if (beats[pc] === pe) rw = 1; else if (beats[pe] === pc) rw = -1;
    var mm = rw * 16 + ((me.stats.wu || 0) - (en.stats.wu || 0)) / 8 + (_duelSkill(du.pickId) - _duelSkill(d.enemyId));
    du.momentum += mm;
    var txt = '我「' + choice + '」敌「' + ec + '」——' + (rw > 0 ? '占先' : rw < 0 ? '受挫' : '相持');
    du.rounds.push({ txt: txt });
    if (du.rounds.length >= 3) { du.phase = 'done'; du.win = du.momentum > 0; }
    openModal('duel');
  }
  function duelGo() { var d = window.__duel; S().flags._duel = null; window.__duel = null; if (d && d.proceed) d.proceed(true); else closeModal(); }
  function duelSkip() { var d = window.__duel; S().flags._duel = null; window.__duel = null; if (d && d.proceed) d.proceed(false); else closeModal(); }
  function renderDebate() {
    var d = window.__debate; if (!d) return '';
    var f = (LF.FACTIONS || {})[d.fid] || {}; var st = S(); var db = st.flags._debate || { phase: 'fight', rounds: [], momentum: 0, win: false };
    if (db.phase === 'done') {
      return '<div class="du-box"><div class="du-h">🗣 舌战 · 与 ' + escapeHtml(f.name) + ' 之谋士</div><div class="du-res ' + (db.win ? 'win' : 'lose') + '">' + (db.win ? '辞锋压人，敌谋士语塞，说降之机大畅。' : '舌战不利，未能折服对方。') + '</div><div class="du-acts"><button class="btn primary" onclick="debateGo()">继续</button></div></div>';
    }
    var h = '<div class="du-box"><div class="du-h">🗣 舌战 · 与 ' + escapeHtml(f.name) + ' 之谋士</div>';
    h += '<div class="du-mom">辞锋：' + Math.round(db.momentum) + '</div>';
    (db.rounds || []).forEach(function (r, i) { h += '<div class="du-r">第' + (i + 1) + '合·' + r.txt + '</div>'; });
    if ((db.rounds || []).length < 3) h += '<div class="du-acts"><button class="btn" onclick="debateRound(\'立论\')">立论</button><button class="btn" onclick="debateRound(\'驳斥\')">驳斥</button><button class="btn" onclick="debateRound(\'诡辩\')">诡辩</button></div>';
    return h;
  }
  function debateRound(choice) {
    var d = window.__debate; if (!d) return; var st = S(); var db = st.flags._debate; if (!db || db.phase !== 'fight') return;
    var me = _tpl((st.pc && st.pc.officerId) || (st.officers && st.officers[0] && st.officers[0].id)) || { stats: { zhi: 60 } };
    var en = _tpl(d.enemyId) || { stats: { zhi: 60 } };
    var map = { '立论': 'a', '驳斥': 'b', '诡辩': 'c' }, beats = { a: 'b', b: 'c', c: 'a' };
    var ec = ['立论', '驳斥', '诡辩'][Math.floor(Math.random() * 3)];
    var pc = map[choice], pe = map[ec], rw = 0;
    if (beats[pc] === pe) rw = 1; else if (beats[pe] === pc) rw = -1;
    var mm = rw * 16 + ((me.stats.zhi || 0) - (en.stats.zhi || 0)) / 8 + (_debateSkill(me.id || (st.officers && st.officers[0] && st.officers[0].id)) - _debateSkill(d.enemyId));
    db.momentum += mm;
    db.rounds.push({ txt: '我「' + choice + '」敌「' + ec + '」——' + (rw > 0 ? '占先' : rw < 0 ? '受挫' : '相持') });
    if (db.rounds.length >= 3) { db.phase = 'done'; db.win = db.momentum > 0; st.flags._debateEdge = db.win ? 0.2 : 0; }
    openModal('debate');
  }
  function debateGo() { var d = window.__debate; S().flags._debate = null; window.__debate = null; closeModal(); }
  function openDebate(fid) {
    var f = (LF.FACTIONS || {})[fid]; if (!f) return;
    var lordId = f.lord; if (!lordId) { toast('此势力主君无名，无可舌战。'); return; }
    window.__debate = { fid: fid, enemyId: lordId };
    S().flags._debate = { phase: 'fight', rounds: [], momentum: 0, win: false };
    openModal('debate');
  }
  function levyTroops(n) {
    var a = Army.ensureArmy(); if (!a) return;
    n = Math.max(1, n | 0);
    var t = null; (a.troops || []).forEach(function (x) { if (x && x.type === 'bu') t = x; });
    if (t) t.count = (t.count || 0) + n; else { a.troops = a.troops || []; a.troops.push({ type: 'bu', count: n, rank: 'front', xp: 0 }); }
    if (!a.active) { a.active = true; a.rallyPoint = (S().ruledCities || [])[0]; }
    save(S()); renderStatus();
  }
  window.openModal=openModal; window.closeModal=closeModal; window.log=log; window.toast=toast;
  window.exert=exert; window.packFind=packFind; window.packConsume=packConsume; window.packAdd=packAdd; window.packList=packList;
  // ── 全局桥接（v20260827j）：shared/story/rooms.js 等外部脚本的工厂闭包在全局作用域解析引擎函数，
  //    缺一即报 ReferenceError（真实浏览器严格词法作用域）。全部补齐：移动/交互/战斗/招募/渲染。
  window.move=move; window.renderRoom=renderRoom; window.talk=talk; window.handleAction=handleAction;
  window.getState=function(){ return state; }; window.save=save;   // 供 shared/story/rooms.js 房间物件回调读写存档（getState 惰性取当前 state）
  window.chopTree=chopTree; window.searchBench=searchBench; window.mineStone=mineStone;
  window.openBuildCrate=openBuildCrate; window.pickupAxe=pickupAxe; window.recruitCompanion=recruitCompanion;
  window.startCombat=startCombat;
  window.openRestModal=openRestModal;   // 供 shared/story/rooms.js 等外部工厂闭包调用（草荐打盹等）
  // ── 通用指引系统（v20260912a）：供剧本/外部脚本按语义锚点做高亮引导，无需写死选择器 ──
  //    用法：LF.Guide.goal('去场院担石', [{act:'labor_yard'}]) / LF.Guide.ping({dock:'pack'}) / LF.Guide.clear()
  if(window.LF) window.LF.Guide=Guide;
  // ── 全局桥接（v20260909o）：势力归属动态化接口，供剧情/事件脚本调用 ──
  window.warlordBattle=warlordBattle;   // 指定一场攻伐：warlordBattle('luoyang','caocao',{allowCapital:true,allowLast:true,allowInside:true})
  window.conquerCity=conquerCity;
  window.diploPropose=diploPropose; window.diploSue=diploSue; window.openDiplomacy=openDiplomacy;   // 外交系统入口（v20260918h）
  window.chooseEvent=chooseEvent; window.duelPick=duelPick; window.duelStart=duelStart; window.duelRound=duelRound; window.duelGo=duelGo; window.duelSkip=duelSkip; window.openDebate=openDebate; window.debateRound=debateRound; window.debateGo=debateGo; window.levyTroops=levyTroops;
  // 军队系统入口（v20260921a）：面板内联 onclick 走 window 桥接（与 talk/openModal 同款）
  window.armyRecruit=armyRecruit; window.armyDisband=armyDisband; window.armySetRank=armySetRank;
  window.armyDeposit=armyDeposit; window.armyWithdraw=armyWithdraw; window.armyBuyGrain=armyBuyGrain;
  window.armyDeploy=armyDeploy; window.armyCamp=armyCamp; window.armyScout=armyScout; window.armyAmbush=armyAmbush;
  window.openArmyDeposit=openArmyDeposit; window.openArmyDeploy=openArmyDeploy;
  window.openSiegePrep=openSiegePrep; window.warToggleTroop=warToggleTroop; window.warLaunch=warLaunch;
  window.startDefendBattle=startDefendBattle; window.startFieldBattle=startFieldBattle;
  window.openOfficerPanel=openOfficerPanel; window.openSearchPanel=openSearchPanel; window.recruitOfficer=officerRecruit; window.appointOfficer=officerAppoint; window.dismissOfficer=officerDismiss; window.openOfficerTab=Officers.openOfficerTab;
  window.dispatchAssign=dispatchAssign; window.dispatchRemove=dispatchRemove; window.dispatchLabor=dispatchLabor; window.dispatchTroops=dispatchTroops;
  window.civilCommand=civilCommand; window.delegateCommand=delegateCommand; window.undelegateCommand=undelegateCommand;
  window.advanceMinutes=advanceMinutes; window.advanceTime=advanceTime;   // 调试/自动化游玩桥接（v20260918i，供 playtest harness 推进时间）
  window.enterGame=enterGame;   // 调试/自动化游玩桥接（供 playtest harness 开局，与 advanceTime 同款）
  window.warChronicle=chronicle;        // 追加一条天下大事记（自动带『第N日』）
  // ── 全局桥接（v20260827i→state.js 全局化）：state 已由 shared/core/state.js 暴露为全局 window.state，
  //    engine.js 及其拆分文件以裸名 state 访问（=window.state），rooms.js 等外部脚本以 window.state 只读访问。
  //    注意：此处【不要】再用 getter 包装——旧版 IIFE 闭包内的 var state 已在重构时移除，
  //    遗留 getter 的 `return state` 会解析回 window.state 自身，造成无限递归（进入游戏即崩溃）。
  //    （如确需桥接只读访问，请用 Object.defineProperty(window,'state',{get:()=>G_State,set:v=>{G_State=v;},configurable:true}) 之类显式背衬变量，而非裸名递归。）
  // ── 调试桥（城市营造系统，回归脚本用）：暴露只读/推进函数，不影响正常游戏 ──
  window.DBG=window.DBG||{};
  window.DBG.city={ startCityBuild:startCityBuild, cityBuildMat:cityBuildMat, cityBuildExert:cityBuildExert,
    cityCellInst:cityCellInst, setCityCell:setCityCell, cellDisplayType:cellDisplayType, canEnterCell:canEnterCell,
    tickBuildOrders:tickBuildOrders, collectRents:collectRents, buildOrderById:buildOrderById,
    cityBuildBpList:cityBuildBpList, cityGridSize:cityGridSize, ensureCityState:ensureCityState,
    state:function(){ return state; }, save:save };

  // HTML 注入辅助（战斗卡片用）

  // ═══════════════════════════════════════════
  //  战 斗 系 统（v0.2 半手动回合制 + 节拍 + 战意）
  // ═══════════════════════════════════════════
  var combatMode=null;
  var dqCardEl=null;  // null | 'manual'（DQ 战斗进行中）

  // [moved → shared/core/equipment.js] 有效属性计算 effectiveStats（装备 + 艺线加成），clampHp 仍留引擎
  function clampHp(){ var mx=effectiveStats().maxHp; if(state.hp>mx) state.hp=mx; }
  // [moved → shared/core/equipment.js] 战后耐久衰减 decayEquipment / 穿卸 equipItem / unequip

  // ===== 存档时间戳（仅用于读档续命，不再结算任何离线/放置收益）=====

  // ===== 标题屏 =====
  // 序幕不再于此输出：此处是标题屏，叙事区被隐藏，且紧接着 enterGame 会清空它。
  // 现改由 enterGame() 在入局时播报（见该函数内「序幕」段）。
  bindTitle();
  (function(){
    var el=document.querySelector('.tt-scroll-body');
    if(el){
      var parts=el.textContent.replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
      var html='';
      for(var k=0;k<6;k++){
        for(var i=0;i<parts.length;i++){
          var rot=(Math.random()*6-3).toFixed(2);
          var dy=(Math.random()*26-13).toFixed(1);
          var maxh=(48+Math.random()*120).toFixed(0);
          html+='<span style="display:block;max-height:'+maxh+'px;transform:rotate('+rot+'deg) translateY('+dy+'px)">'+parts[i]+'</span>';
        }
      }
      el.innerHTML=html;
    }
  })();
  // 墨滴随机晕染：在经文上随机滴落、晕开挡字、缓缓淡化，过会儿另处再滴
  (function(){
    var box=document.querySelector('.tt-inkblot');
    if(box){
      function drip(){
        var _tt=document.getElementById('title');
        if(!_tt || _tt.classList.contains('frozen') || _tt.classList.contains('hidden') || _tt.style.display==='none'){
          if(_dripTimer){ clearInterval(_dripTimer); _dripTimer=null; }   // 弹窗冻结或标题不可见（进局后 display:none）时停掉永久定时器
          return;                                                         // 避免隐藏标题里持续造墨滴 DOM 节点 + WAAPI 动画
        }
        var b=document.createElement('i');
        var x=(Math.random()*84+8).toFixed(1);
        var y=(Math.random()*44+6).toFixed(1);              // 集中上半屏(6%~50%)
        var sv=(12+Math.random()*20);                       // 基础尺寸(vmax)
        b.style.left=x+'%';b.style.top=y+'%';
        b.style.width=sv+'vmax';b.style.height=sv+'vmax';
        // 每次随机选一种墨纹滤镜 + 随机模糊，墨形各不相同
        var fid='inkBleed'+((Math.random()*4)|0);
        b.style.filter='url(#'+fid+') blur('+(1+Math.random()*1.5).toFixed(1)+'px)';
        box.appendChild(b);
        // 墨晕原地晕开淡出，无任何位移
        var r0=(Math.random()*14-5).toFixed(1);
        var dur=(14000+Math.random()*6000);                 // 14~20s，更缓
        // 边生长边淡化：极淡墨色、缓慢呼吸，贴合传统墨晕
        var a=b.animate([
          {transform:'translate(-50%,-50%) scale(.6) rotate('+r0+'deg)',opacity:0},
          {transform:'translate(-50%,-50%) scale(.76) rotate('+r0+'deg)',opacity:.5,offset:.12},
          {transform:'translate(-50%,-50%) scale(.9) rotate('+r0+'deg)',opacity:.36,offset:.45},
          {transform:'translate(-50%,-50%) scale(1) rotate('+r0+'deg)',opacity:.16,offset:.78},
          {transform:'translate(-50%,-50%) scale(1.05) rotate('+r0+'deg)',opacity:0}
        ],{duration:dur,easing:'ease-in-out',fill:'forwards'});
        a.onfinish=function(){ if(b.parentNode) b.parentNode.removeChild(b); };
      }
      var _dripTimer=null;
      // 进局/隐藏标题后 drip() 内可见性判断会停掉该永久定时器；回标题页（showTitle）或关闭回到可见标题（closeModal）时再启。
      window.startTitleDrip=function(){ if(_dripTimer) return; drip(); _dripTimer=setInterval(function(){ drip(); if(Math.random()<.25) drip(); },4200); };
      window.stopTitleDrip=function(){ if(_dripTimer){ clearInterval(_dripTimer); _dripTimer=null; } };
      window.startTitleDrip();
    }
  })();
  // v20260912n：预加载序章候选底图，全部就绪（或至多等 2.5s）后再进标题页，
  // 避免序章播放时首次加载底图造成卡顿；数组须与 playPrologue 的轮换池保持一致。
  var _pbgs=['assets/title_bg_alt1.jpg','assets/title_bg_alt2.jpg','assets/title_bg_alt3.jpg','assets/title_bg_alt4.jpg','assets/title_bg_alt5.jpg','assets/title_bg_alt6.jpg'];
  var _pbgDone=0, _pbgT0=Date.now();
  _pbgs.forEach(function(_src){ var _im=new Image(); _im.onload=function(){ _pbgDone++; }; _im.onerror=function(){ _pbgDone++; }; _im.src=_src; });
  (function _waitPbg(){
    if(_pbgDone>=_pbgs.length || Date.now()-_pbgT0>2500){
      if(!state || !state.room) showTitle();   // 已进游戏则不再强回首頁（v20260918i 竞态修复）
      var _ld=document.getElementById('loader');
      if(_ld){ setTimeout(function(){ _ld.classList.add('hidden'); }, 340); }   // 标题页就绪后加载页淡出
    } else { setTimeout(_waitPbg, 60); }
  })();

  window.addEventListener('beforeunload',function(){ if(state){ state.lastSeen=Date.now(); save(state); } });
  }catch(e){
    var pre=document.createElement('pre');
    pre.style.cssText='padding:24px;color:#c00;background:#fff;white-space:pre-wrap;font-size:13px;line-height:1.6';
    pre.textContent=e.stack || e.message || String(e);
    try{ pre.textContent+=' [诊断] G='+(typeof G)+' SharedGame='+(window.LF&&typeof window.LF.SharedGame)+' LF.DIALOGUES='+(window.LF&&typeof window.LF.DIALOGUES)+' G.DIALOGUES='+(G&&typeof G.DIALOGUES)+' G.SECTS='+(G&&typeof G.SECTS)+' G.ROOMS='+(G&&typeof G.ROOMS)+' LF.CONSTANTS='+(window.LF&&typeof window.LF.CONSTANTS); }catch(_){}
    document.body.innerHTML='';
    document.body.appendChild(pre);
  }

  // ── 城市房间由 cities.js 程序合成（rooms.js 不再手写）；山河志州治节点由 cities.js+coords 自动派生 ──
  registerCityRooms();

  // ── 行军系统：按路网在相邻地点间生成「郊野」骨架，再连出入口（须先有 genCityGrid 等游戏函数）──
  if(LF.Travel){
    LF.Travel.setGateDirs(availableGateDirs);
    LF.Travel.build();
  }

  // ── 统一地点房间生成（Place 系统）：城市以外类型(fort/pass/landmark/dungeon/story/field...)由 gen/rooms.js 造房注入 G.ROOMS ──
  function registerPlaceRooms(){
    var P = LF.PLACES || {};
    for(var pid in P){
      var p = P[pid];
      if(!p || p.kind==='city') continue;          // 城市已由 registerCityRooms 处理
      if(G.ROOMS[pid]) continue;                    // 已有手写/生成则跳过
      var rooms = (LF.genPlaceRooms ? LF.genPlaceRooms(pid) : null) || {};
      for(var rid in rooms){ if(!G.ROOMS[rid]) G.ROOMS[rid] = rooms[rid]; }
      // 副本入口：在 entry 地点房挂一条北向出口，连通地表↔秘谷
      if(p.kind==='dungeon' && p.entry && G.ROOMS[p.entry]){
        var er = G.ROOMS[p.entry]; if(!er.exits) er.exits = {};
        if(!er.exits['北']) er.exits['北'] = pid + '@entrance';
      }
    }
  }
  registerPlaceRooms();
  if(LF.Travel) LF.Travel.link();   // 郊野网格造好后，连 近边入口↔母城 / 远边出口↔邻点

})();

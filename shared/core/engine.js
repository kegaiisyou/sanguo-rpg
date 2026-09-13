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
    clampHp: clampHp, log: log,
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
    addReputation: addReputation, repTitle: repTitle, log: log, addXp: addXp,
    // City(createCity 在 L82) / Inventory(createInventory 在 L116) 均晚于本工厂创建；
    // 此处仅定义包装、调用时（用户点调试按钮）再取值 → 不固化 undefined（与 Equipment.L42 getter 同范式）
    isCityGrid: function () { return isCityGrid.apply(null, arguments); },
    isCaptured: function () { return isCaptured.apply(null, arguments); },
    cityDefaultOwner: function () { return cityDefaultOwner.apply(null, arguments); },
    burnCells: function () { return burnCells.apply(null, arguments); },
    effectiveStats: effectiveStats, closeModal: closeModal,
    renderRoom: renderRoom, openSpawnMap: openSpawnMap, moralTitle: moralTitle,
    factionName: factionName, renderStatus: renderStatus, toast: toast,
    packAdd: function () { return Inventory.packAdd.apply(null, arguments); }, save: save
  });
  var handleDev = Dev.handleDev, renderDev = Dev.renderDev;

  // 触发引擎：从 triggers.js 工厂注入引擎依赖（checkTriggers/graduate 不再读 window 裸全局）
  var Triggers = LF.createTriggers({
    G: G,
    getState: function () { return state; },
    getTriggers: function () { return (window.LF && window.LF.TRIGGERS) || (G && G.TRIGGERS) || []; },
    log: log, logScene: logScene,
    onbReveal: onbReveal, highlightOnb: highlightOnb, onbGoal: onbGoal,
    tutAsk: tutAsk, findEvent: findEvent, runEvent: runEvent,
    // startCombat 来自 Combat 别名（L197 才赋值），本工厂先建 → 包装函数延迟引用（同 L75 packAdd 范式）
    startCombat: function () { return Combat.startCombat.apply(null, arguments); }, addReputation: addReputation,
    // packAdd 同上：Inventory 在 L123 才赋值，闭包延迟引用
    packAdd: function () { return Inventory.packAdd.apply(null, arguments); }, save: save, renderStatus: renderStatus,
    renderMoveBar: renderMoveBar, renderNpcList: renderNpcList,
    addXp: function () { return addXp.apply(null, arguments); },
    acceptQuest: acceptQuest, completeQuest: completeQuest,
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
    log: log
  });
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
    advanceTime: advanceTime, exert: exert, renderRoom: renderRoom, itemIconHTML: itemIconHTML,
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
    openModal: openModal, closeModal: closeModal
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
    renderRoom: renderRoom, buildActions: buildActions, exert: exert
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
    if(rid==='camp_yard' || rid==='camp_cell' || rid==='camp_wall' || rid==='kuyilao') return 'tutorial';
    if(/^ji_heishan_/.test(rid)) return 'dungeon';
    if(/^ji_/.test(rid) || /^yuyang_/.test(rid)) return 'city';
    return 'wild';
  }
  // 图例文案（对应 kinds 取值）
  var MAP_KIND_LABEL={ city:'城镇', wild:'野外', dungeon:'贼巢', fort:'军屯', tutorial:'教学', town:'村镇', camp:'营地' };
  // 山河志空间地图 HTML（main 查看 / 调试选出生点 共用；数据驱动 shared/data/map.js）
  // v20260822ar：三国群英传式大地图 —— 纯方位节点，间隔拉开（KING_CELL=110px）；SVG 示意河流（黄河/长江）+ 二次贝塞尔道路；节点无图标、无图例、不显示教学关卡；支持缩放（data-bx/by 基准坐标 + .mk-bg scale）。
  function buildMapKingHTML(opts){
    opts=opts||{};
    var coords=resolveMapCoords();
    var keys=Object.keys(G.ROOMS).filter(function(rid){return coords[rid] && !(G.ROOMS[rid].isField);});
    var KC=110, PAD=46;
    var minc=Infinity,maxc=-Infinity,minr=Infinity,maxr=-Infinity;
    keys.forEach(function(rid){var c=coords[rid];
      if(c[0]<minc)minc=c[0]; if(c[0]>maxc)maxc=c[0]; if(c[1]<minr)minr=c[1]; if(c[1]>maxr)maxr=c[1];
    });
    var W=(maxc-minc+1)*KC+PAD*2, H=(maxr-minr+1)*KC+PAD*2;
    function px(c){ return PAD+(c[0]-minc)*KC; }
    function py(c){ return PAD+(c[1]-minr)*KC; }
    // 区域淡底色（山水区块感，取自 regions 数据，随间距放大）
    var rg='';
    (mapData().regions||[]).forEach(function(r){
      var rr=Math.max(30, Math.round(r.r*KC/46));
      rg+='<div class="mk-region" style="left:'+(px(r.center)-rr)+'px;top:'+(py(r.center)-rr)+'px;width:'+(rr*2)+'px;height:'+(rr*2)+'px;background:'+(r.c||'rgba(140,160,120,.35)')+'"></div>';
    });
    // ── SVG 层：示意河流 + 道路连线（都在 .mk-bg 内，随缩放整体 scale，矢量不模糊）──
    var svg='<svg class="mk-lines" width="'+W+'" height="'+H+'" xmlns="http://www.w3.org/2000/svg">';
    var MK_RIVERS=[
      {name:'黄河',w:4,pts:[[.02,.55],[.10,.48],[.20,.52],[.30,.40],[.42,.46],[.54,.33],[.66,.38],[.78,.28],[.98,.22]]},
      {name:'长江',w:3,pts:[[.02,.92],[.14,.84],[.28,.88],[.42,.80],[.56,.86],[.70,.76],[.84,.82],[.98,.72]]}
    ];
    function smoothRiver(pts){ // 中点二次贝塞尔平滑成蜿蜒河线
      var d='M'+(pts[0][0]*W).toFixed(1)+' '+(pts[0][1]*H).toFixed(1);
      for(var i=1;i<pts.length-1;i++){
        var xc=(((pts[i][0]+pts[i+1][0])/2)*W).toFixed(1), yc=(((pts[i][1]+pts[i+1][1])/2)*H).toFixed(1);
        d+=' Q'+(pts[i][0]*W).toFixed(1)+' '+(pts[i][1]*H).toFixed(1)+' '+xc+' '+yc;
      }
      var lp=pts[pts.length-1];
      d+=' L'+(lp[0]*W).toFixed(1)+' '+(lp[1]*H).toFixed(1);
      return d;
    }
    MK_RIVERS.forEach(function(rv,idx){
      svg+='<path class="mk-river'+(idx>0?' r2':'')+'" d="'+smoothRiver(rv.pts)+'"/>';
      var mp=rv.pts[Math.floor(rv.pts.length/2)];
      svg+='<text class="mk-river-t" x="'+(mp[0]*W).toFixed(1)+'" y="'+(mp[1]*H).toFixed(1)+'">'+rv.name+'</text>';
    });
    var seen={}, lines='';
    function mkPath(c,t){ // 二次贝塞尔曲线：路自然弯曲（弯向由坐标奇偶决定，避免同向堆叠）
      var x1=px(c), y1=py(c), x2=px(t), y2=py(t), dx=x2-x1, dy=y2-y1;
      var mx=(x1+x2)/2, my=(y1+y2)/2;
      var off=Math.min(26, Math.max(14, Math.sqrt(dx*dx+dy*dy)*0.2));
      var s=((c[0]+c[1])&1)?1:-1, cx, cy;
      if(Math.abs(dx)>=Math.abs(dy)){ cx=mx; cy=my+off*s; }
      else { cx=mx+off*s; cy=my; }
      return 'M '+x1+' '+y1+' Q '+Math.round(cx)+' '+Math.round(cy)+' '+x2+' '+y2;
    }
    keys.forEach(function(rid){
      var c=coords[rid], ex=G.ROOMS[rid].exits||{};
      Object.keys(ex).forEach(function(dir){
        var tid=ex[dir]; if(!coords[tid]) return;
        var k=[rid,tid].sort().join('|'); if(seen[k]) return; seen[k]=1;
        var reach=(rid===state.room||tid===state.room);
        lines+='<path class="mk-road'+(reach?' on':'')+'" d="'+mkPath(c,coords[tid])+'"/>';
      });
    });
    svg+=lines+'</svg>';
    // 房间节点（纯文字，无 icon；data-bx/by 存基准像素坐标，缩放时按比例重排保证文字清晰）
    var pins='';
    keys.forEach(function(rid){
      var r=G.ROOMS[rid], kind=mapKind(rid);
      if(kind==='tutorial') return; // 教学关卡不在大地图显示
      var cur=(rid===state.room), spawn=(opts.pickSpawn&&rid===state.spawnRoom);
      var bx=Math.round(px(coords[rid])), by=Math.round(py(coords[rid]));
      pins+='<div class="mk-pin'+(cur?' cur':'')+'"'+(opts.pickSpawn?' data-spawn="'+rid+'"':' data-rid="'+rid+'"')+
        ' data-bx="'+bx+'" data-by="'+by+'" title="'+r.name+'" style="left:'+bx+'px;top:'+by+'px">'+
        (spawn?'<span class="mk-spawn">★</span>':'')+
        '<span class="mk-nm">'+r.name+'</span></div>';
    });
    var title=opts.pickSpawn?'🗺 设置出生点':'山 河 志';
    var tip=opts.pickSpawn
      ? '点击一处地点设为出生点，并立即传送至此（已自动存档）。当前出生点：'+(G.ROOMS[state.spawnRoom]?G.ROOMS[state.spawnRoom].name:state.spawnRoom)
      : '单指拖动查看疆域，双指缩放（按钮/Ctrl+滚轮亦可）。点击任一去处前往（体力-4 · 食物-1 · 饮水-1 · 时间+1刻）。当前位于「'+curRoom().name+'」；已去之处无需再远行。';
    return '<h3>'+title+'</h3>'+
      '<div class="map-king"><div class="map-king-canvas" style="width:'+W+'px;height:'+H+'px">'+
        '<div class="mk-bg">'+rg+svg+'</div>'+pins+'</div></div>'+
      '<div class="mk-bar"><div class="mk-zoom">'+
        '<button id="mk-zoom-out" title="缩小">−</button>'+
        '<button id="mk-zoom-in" title="放大">＋</button>'+
        '<button id="mk-zoom-1" title="恢复原始大小">1:1</button></div>'+
        '<button class="mk-recenter" id="mk-recenter">⌖ 回到当前位置</button></div>'+
      '<p class="tip">'+tip+'</p>';
  }
  function initMapKing(opts){
    opts=opts||{};
    var wrap=document.querySelector('#modal-card .map-king'); if(!wrap) return;
    var canvas=wrap.querySelector('.map-king-canvas');
    var bg=wrap.querySelector('.mk-bg');
    var W0=canvas.offsetWidth, H0=canvas.offsetHeight;
    var SC=1, MIN=0.45, MAX=2.2;
    var baseFs=(document.documentElement.clientWidth<=560)?11.5:12;
    function applyScale(){ // 背景层 scale(矢量不模糊)，节点用 left/top/fontSize 重排（文字清晰）
      canvas.style.width=Math.round(W0*SC)+'px';
      canvas.style.height=Math.round(H0*SC)+'px';
      if(bg) bg.style.transform='scale('+SC+')';
      var fs=Math.max(7, Math.min(16, baseFs*SC));
      wrap.querySelectorAll('.mk-pin').forEach(function(p){
        p.style.left=Math.round(+p.getAttribute('data-bx')*SC)+'px';
        p.style.top=Math.round(+p.getAttribute('data-by')*SC)+'px';
        var nm=p.querySelector('.mk-nm'); if(nm) nm.style.fontSize=fs+'px';
      });
    }
    function setScale(ns,avx,avy){ // 以容器内 (avx,avy) 为锚缩放，保持锚点内容不动
      if(ns<MIN) ns=MIN; if(ns>MAX) ns=MAX;
      if(ns===SC) return;
      var ax=(avx!=null)?avx:wrap.clientWidth/2;
      var ay=(avy!=null)?avy:wrap.clientHeight/2;
      var cx=(wrap.scrollLeft+ax)/SC, cy=(wrap.scrollTop+ay)/SC;
      SC=ns; applyScale();
      wrap.scrollLeft=cx*SC-ax; wrap.scrollTop=cy*SC-ay;
    }
    if(opts.pickSpawn){
      wrap.querySelectorAll('[data-spawn]').forEach(function(el){
        el.addEventListener('click', function(){
          var rid=el.getAttribute('data-spawn');
          state.spawnRoom=rid;
          log('【调试】出生点已设为：'+G.ROOMS[rid].name+'。','good');
          closeModal(); renderRoom(rid); save(state);
        });
      });
    } else {
      wrap.querySelectorAll('[data-rid]').forEach(function(el){
        el.addEventListener('click', function(){
          mapNodeInfo(el.getAttribute('data-rid'));
        });
      });
    }
    // 缩放：按钮 / Ctrl+滚轮 / 双指捏合（单指拖动交给原生滚动）
    var zin=document.getElementById('mk-zoom-in'), zout=document.getElementById('mk-zoom-out'), z1=document.getElementById('mk-zoom-1');
    if(zin) zin.addEventListener('click', function(){ setScale(SC*1.25); });
    if(zout) zout.addEventListener('click', function(){ setScale(SC*0.8); });
    if(z1) z1.addEventListener('click', function(){ setScale(1); });
    wrap.addEventListener('wheel', function(e){
      if(e.ctrlKey){
        e.preventDefault();
        var r=wrap.getBoundingClientRect();
        setScale(SC*(e.deltaY<0?1.12:0.89), e.clientX-r.left, e.clientY-r.top);
      }
    }, {passive:false});
    var ts=null;
    function tdist(t){ var dx=t[0].clientX-t[1].clientX, dy=t[0].clientY-t[1].clientY; return Math.sqrt(dx*dx+dy*dy); }
    wrap.addEventListener('touchstart', function(e){
      ts=(e.touches.length===2)?{d:tdist(e.touches), s:SC}:null;
    }, {passive:true});
    wrap.addEventListener('touchmove', function(e){
      if(ts&&e.touches.length===2){
        e.preventDefault();
        var r=wrap.getBoundingClientRect();
        var mx=(e.touches[0].clientX+e.touches[1].clientX)/2, my=(e.touches[0].clientY+e.touches[1].clientY)/2;
        setScale(ts.s*tdist(e.touches)/ts.d, mx-r.left, my-r.top);
      }
    }, {passive:false});
    wrap.addEventListener('touchend', function(){ ts=null; });
    var rb=document.getElementById('mk-recenter');
    if(rb) rb.addEventListener('click', function(){
      var cur=wrap.querySelector('.mk-pin.cur')||wrap.querySelector('.mk-pin');
      if(cur) cur.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
    });
    // 初始定位到当前房间（居中）
    var init=wrap.querySelector('.mk-pin.cur')||wrap.querySelector('.mk-pin');
    if(init){ wrap.scrollLeft=Math.max(0, init.offsetLeft-wrap.clientWidth/2); wrap.scrollTop=Math.max(0, init.offsetTop-wrap.clientHeight/2); }
  }
  // [moved → shared/core/calendar.js]



  // ===== 序章开场动画（P0 · v20260911g；动效重做 v20260911j；水墨长卷 v20260912i；卷轴书卷 v20260912j）=====
  // 独立于叙事区（#narr）的全屏幕布 #prologue（DOM 见 index.html，样式见 game.css）：
  //   行军征战水墨底图 → 长卷展开（轴杆分启 + 卷面露出）→ 标题毛笔书写 → 正文逐行浮现
  //   → 卷轴合拢 + 柔和纸光一掠 → 淡出。
  // 演出期间界面 #app 是隐藏的，故「动画演完，角色才出现在牢里」；随后的 camp_opening 剧本接着开场。
  // 文案取自 G.DIALOGUES.prologue（第一行作金色小标题，卷上毛笔书写）。轻触幕布 / 点「跳过」立即收尾。
  // ★ v20260912j「卷轴书卷」：新增 .pr-roll 卷轴结构（上下轴杆 pr-axle-top/bottom + 卷面 pr-roll-face）：
  //   开卷 pr-roll-open（杆分启、face 从中线向上下揭开）→ 标题书写 .pr-kicker.on（clip-path 水平展开 + 笔锋光带）
  //   → 正文逐行浮现 → 合卷 pr-roll-close（face 收拢、杆合回中线）→ 淡出。
  // 文字层始终「静字」：只用 opacity + clip-path + blur 浮现，绝不 translate/rotate 位移。
  // settings.textSpeed<=0（文字演出设为「瞬（无动画）」）时整段跳过，直接进牢房。
  // ===== 序章开场动画（P0 · v20260911g；动效重做 v20260911j；水墨长卷 v20260912i；墨色显影 v20260912l）=====
  // 独立于叙事区（#narr）的全屏幕布 #prologue（DOM 见 index.html，样式见 game.css）：
  //   浓墨遮罩 → 墨色自中心退去显影行军征战图 → 金色题头与正文逐行浮现 →
  //   收尾墨色回卷 → 柔和纸光一掠 → 淡出。
  // 演出期间界面 #app 是隐藏的，故「动画演完，角色才出现在牢里」；随后的 camp_opening 剧本接着开场。
  // 文案取自 G.DIALOGUES.prologue（第一行作金色小标题）。轻触幕布 / 点「跳过」立即收尾。
  // ★ v20260912l「墨色显影」：新增 .pr-wash 浓墨层（mask 径向渐变圆洞），开卷 .pr-wash-out 时
  //   mask-size 由 20% 扩至 260%，墨色如潮水退去、画面自中心显影；收尾 .pr-wash-in 时 mask-size
  //   收拢回 40% 且墨层不透明化，画面重新隐入浓墨。卷轴（pr-roll/轴杆/卷面）与毛笔书写已移除。
  // 文字层始终「静字」：只用 opacity + clip-path + blur 浮现，绝不 translate/rotate 位移。
  // settings.textSpeed<=0（文字演出设为「瞬（无动画）」）时整段跳过，直接进牢房。
  // ===== 序章开场动画（P0 · v20260911g；动效重做 v20260911j；水墨长卷 v20260912i；长镜头运镜 v20260912m）=====
  // 独立于叙事区（#narr）的全屏幕布 #prologue（DOM 见 index.html，样式见 game.css）：
  //   黑幕揭开 → 行军征战图（底图长镜头运镜）→ 题头与正文如墨迹洇开逐行浮现 →
  //   柔和纸光一掠 → 淡出。
  // 演出期间界面 #app 是隐藏的，故「动画演完，角色才出现在牢里」；随后的 camp_opening 剧本接着开场。
  // 文案取自 G.DIALOGUES.prologue（第一行作金色小标题）。轻触幕布 / 点「跳过」立即收尾。
  // ★ v20260912m「长镜头运镜」：删去卷轴（pr-roll）与墨色显影（pr-wash-out/in 圆形 clip）两类
  //   「元素动效」，改为电影摄影语言——.pr-wash 仅作开场黑幕（opacity 整体淡出揭开，非圆形）；
  //   .pr-bg 以 26s 慢速推进横移（prPan）模拟镜头在长卷上游走；文字 .pr-line 去掉 clip-path，
  //   只用 opacity+blur 墨迹洇开（模糊→清晰）；云雾/墨尘/光斑/暗角呼吸继续营造氛围。
  // 文字层始终「静字」：只用 opacity + blur 浮现，绝不 translate/rotate 位移。
  // settings.textSpeed<=0（文字演出设为「瞬（无动画）」）时整段跳过，直接进牢房。
  function playPrologue(onDone){
    var box=document.getElementById('prologue');
    var lines=((G && G.DIALOGUES && G.DIALOGUES.prologue) || []).slice();
    var speed=(settings && settings.textSpeed!=null) ? settings.textSpeed : 55;
    if(!box || !lines.length || speed<=0){ if(onDone) onDone(); return; }
    var wrap=document.getElementById('pr-lines');
    var flash=document.getElementById('pr-flash');
    // v20260912n：序章底图从 AI 同风格候选图中随机取一张（每次开局不同）
    var bgEl=box.querySelector('.pr-bg');
    if(bgEl){
      var bgs=['assets/title_bg_alt1.jpg','assets/title_bg_alt2.jpg','assets/title_bg_alt3.jpg','assets/title_bg_alt4.jpg','assets/title_bg_alt5.jpg','assets/title_bg_alt6.jpg'];
      bgEl.style.backgroundImage='url("'+bgs[Math.floor(Math.random()*bgs.length)]+'")';
    }
    var timers=[], done=false;
    function T(fn, ms){ timers.push(setTimeout(fn, ms)); }
    function clearAll(){ for(var i=0;i<timers.length;i++){ clearTimeout(timers[i]); } timers=[]; }
    function finish(){
      if(done) return; done=true; clearAll();
      box.removeEventListener('click', finish);
      box.classList.add('pr-out');            // 淡出（.9s），随后彻底隐藏并把界面交还 #app
      timers.push(setTimeout(function(){
        box.classList.add('hidden');
        if(wrap) wrap.innerHTML='';
        if(onDone) onDone();
      }, 900));
    }
    // 复位（同一会话内读档可能重播）
    box.classList.remove('hidden','pr-out','pr-wash-out');
    if(flash) flash.classList.remove('on');
    if(wrap){
      wrap.innerHTML='';
      lines.forEach(function(t, i){
        var p=document.createElement('p');
        p.className='pr-line '+(i===0?'pr-kicker':'pr-body');
        p.textContent=String(t==null?'':t);
        wrap.appendChild(p);
      });
    }
    box.addEventListener('click', finish);
    // 排期：黑幕揭开（1.8s）→ 题头浮现 → 正文逐行浮现（底图全程长镜头运镜）
    var els=(wrap && wrap.childNodes) || [];
    var t0=1600;                                           // 黑幕揭开近完成，文字才登场
    T(function(){ box.classList.add('pr-wash-out'); }, 120);   // 黑幕淡出揭开，露出行军征战图
    for(var i=0;i<els.length;i++){
      (function(el, idx){
        T(function(){ el.classList.add('on'); }, t0);
        t0 += Math.max(1400, Math.min(2600, String(lines[idx]||'').length*55)) + 560;
      })(els[i], i);
    }
    T(function(){ try{ SFX.hit(); }catch(e){} }, t0+300);   // 收尾一记更鼓（声音保留；v20260912m 起去掉纸光闪动）
    T(finish, t0+800);
  }
  // [moved → shared/core/state.js]
  // 将一份存档数据载入为当前游戏状态并展卷
  function enterGame(data, slot){
    curSlot=slot||0;
    Core.state = state = normalize(data || G.defaultSave());
    G.applySect(state);
    G.recalcBase(state);                      // 依据四维 attr + 门派加成 重算派生战力
    packEnsure(state);                     // 行囊/6 装备槽兼容与初始化（v0.6）
    if(!packFind('shuidai')){ packAdd('shuidai',1); var _sd=packFind('shuidai'); if(_sd) _sd.water=8; }  // 开局随行水袋（向水槽添水用）
    state.fixtures = state.fixtures || {};
    SFX.setEnabled(state.sfxOn!==false);   // 载入存档后同步音效开关
    try{ SFX.setBgmVolume((settings.bgmVol!=null?settings.bgmVol:35)/100); SFX.setSfxVolume((settings.sfxVol!=null?settings.sfxVol:60)/100); SFX.startBgm(); }catch(e){}       // 启动古风BGM（v20260909a）
    if(!state.quest || typeof state.quest!=='object') state.quest={bandit:0,turban:0,hua_xiong:false,luoyang:false};
    $narr.innerHTML='';
    // 序幕（P0 · v20260911g）：新档 / 未看过时，入局先演「开场动画」——全屏幕布 #prologue 逐行浮现时代文案
    //   （文案见 shared/story/dialogues.js · prologue，演出见 playPrologue）。动画演毕才 renderRoom，
    //   故角色是「被推进牢房」之后才出现在牢里的；紧接着由 camp_opening 剧本接开场（铁链/尘土/周听涛开口）。
    // 记录旗标放顶层 state.flags.introShown——不可放 flags.onb.*，因教学入口 applyOnboard 会整块重置 onb。
    var _playIntro = !(state.flags && state.flags.introShown);
    if(_playIntro){ if(!state.flags) state.flags={}; state.flags.introShown=true; }
    renderStatus();
    // 开场渐进式 UI：新局落在教学入口时，先进入空白引导态（隐藏顶栏/DOCK/行动区/罗盘）
    // v20260911f：默认新档现落在牢房（camp_tz1），故把教学子牢房一并纳入，确保 flags.onb 在首帧 renderRoom 前已建，
    //   suppressNarr 才能对教学房间生效（否则牢房常规描写会插在序幕与「押入牢房」演出之间）。
    var _onbSpawn = (state.room==='camp_yard'||state.spawnRoom==='camp_yard'||/^camp_[td]z\d$/.test(state.room||''));
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
      if(app) app.classList.remove('hidden');
      renderRoom(state.room || state.spawnRoom || 'ji_guomen');
      _tipSkip();
    }
  }

  var $status=document.getElementById('status');
  $status.onclick=function(){ openModal('clock'); };   // 点击状态栏 → 时辰钟表
  var $narr=document.getElementById('narr');
  var $actions=document.getElementById('actions');
  var $modal=document.getElementById('modal');
  var $card=document.getElementById('modal-card');
  var $toast=document.getElementById('toast');

  function curRoom(){ return G.ROOMS[state.room] || bldRoom(state.room) || G.ROOMS.camp_yard; }

  // ===== 文字叙事窗 =====
  // 轻触快进：仅立即显示「当前正在打字」的那一段；两次快进至少间隔 300ms，防误触连跳多段
  var activeTyper=null, lastSkipAt=0;
  function typeInto(node, text, delay, done, onstep){
    var i=0, finished=false, timer=null;
    function finish(){
      if(finished) return; finished=true;
      if(timer){ clearTimeout(timer); timer=null; }
      node.textContent=text;
      if(onstep) onstep();
      if(activeTyper && activeTyper.fn===finish) activeTyper=null;
      if(done) done();
    }
    activeTyper={ fn: finish };
    (function step(){
      if(finished) return;
      node.textContent=text.slice(0,i);
      if(onstep) onstep();
      if(i<text.length){ i++; timer=setTimeout(step, delay); }
      else finish();
    })();
  }
  function skipTypewriter(){
    if(!activeTyper) return;
    var now=Date.now();
    if(now-lastSkipAt<300) return;   // 防误触：两次快进至少间隔 300ms
    lastSkipAt=now;
    var fn=activeTyper.fn; activeTyper=null; fn();
  }
  // 快进：仅点击「叙事区文字」才生效；点中任何按钮/控件（移动罗盘、对话选项、行动区、NPC 列表）一律不触发，避免误触跳过剧情
  (function(){ var _sc=document.getElementById('scene'); if(_sc) _sc.addEventListener('click', function(e){
    if(e.target && e.target.closest) { var hit=e.target.closest('button, a, .onb-choices, .mv-exit, .mv-bar, .dock, .npc-list'); if(hit) return; }
    skipTypewriter();
  }); })();
  // 串行输出队列：所有叙事段落入队，一次只打字一段；前段完成(或快进)后才出下一段，
  // 从根本上杜绝「好几行一起刷出」让玩家措手不及
  var logQueue=[], logBusy=false;
  var narrOngoing=false; // 是否正处于「连续叙事」中（保证逐行间隙按钮仍锁定）
  var narrToken=0;      // 场景叙事令牌：新场景使旧序列失效，杜绝旧文字混入新场景
  var lockObserver=null;
  // 对话/抉择悬挂态（v20260911i）：tutAsk 弹出而玩家尚未选择时置真。
  //   此前只锁「叙事中」，对话选项面板一挂起（narrOngoing 已成假）玩家就能点罗盘走人——
  //   甚至趁牢头念「三鞭」时拔腿溜走躲掉鞭刑，剧本状态与场景随之错位。
  var askPending=false;
  // 是否正处于「文字输出中」（打字 / 排队 / 连续叙事）
  function narrActive(){ return logBusy || (logQueue && logQueue.length>0) || narrOngoing; }
  // 交互闸门（v20260911i）：叙事中 / 对话抉择悬挂中，一律不许走动、不许另开岔路
  function interactBusy(){ return narrActive() || askPending; }
  // 文字输出中：锁定交互按钮（变灰不可点），输出完成或快进到底后自动解锁
  // 注：战斗中（combatMode 为真）不锁 #actions —— 战斗指令菜单由战斗逻辑自行管理，不应被叙事锁挡住
  // 注：.onb-choices（对话选项）刻意不在锁范围内 —— 它是悬挂态下玩家唯一的出路，锁住即死局。
  // ⚠️ v20260911k 修一处「静默失效的选择器」：旧版写的是 `#npc button` 与 `.obj-panel button`，
  //   而实际 DOM 是 <aside id="npc-list"> 里的 <button class="nl-item">、浮动菜单 <div class="obj-menu"> 里的
  //   <button class="op-btn"> —— 两个选择器都匹配不到任何元素，等于「NPC 列表从未上过锁」。
  //   后果：对话悬挂（askPending）时点另一个 NPC，仍能展开菜单、再开一段对话；tutAsk 会顶掉旧面板，
  //   旧剧本的 next() 从此无人回调 —— 剧情链与锁状态双双悬挂（表现为选项消失、所有按钮点不动，
  //   即玩家反馈的「强制对话时点他们跳开对话，引发死循环」）。
  function syncActionLock(){
    var active=interactBusy();
    var sel='#move-bar button, #npc-list button, .obj-menu button, #dock button, #move-tabs .mv-tab';
    if(!combatMode) sel+=', #actions button:not(.cb-menu)';
    var nodes=document.querySelectorAll(sel);
    for(var i=0;i<nodes.length;i++){ if(active) nodes[i].classList.add('locked'); else nodes[i].classList.remove('locked'); }
    var narr=document.getElementById('narr');
    if(narr) narr.classList.toggle('typing', active);
    // 巡夜续评（v20260911i）：curfewPatrol 常在「劳作/进格」动作里被叫起，而此时动作自身的
    //   文案正在打字（interactBusy 为真），只延后一帧根本轮不到它 —— 于是它挂起「待评」，
    //   等这轮叙事彻底收尾（active 转假）时再评一次。见 curfewPatrol 内的 curfewWant。
    if(!active && curfewWant){ curfewWant=false; setTimeout(function(){ try{ curfewPatrol(); }catch(e){} }, 0); }
    // 对话窗收尾（v20260912g）：话说完、也没有挂起的问题了 → 稍候收窗，把底部位置让回给罗盘/功能栏
    if(!active && !combatMode) dlgSettle();
  }
  // 新场景/战斗开始时，丢弃旧场景残留的排队文字与打字定时器，避免文案串场
  function flushNarr(){
    narrToken++;                 // 使任何进行中的旧 logScene 序列失效
    logQueue.length=0;
    if(activeTyper && activeTyper.timer){ try{ clearTimeout(activeTyper.timer); }catch(e){} }
    activeTyper=null;
    logBusy=false;
    narrOngoing=false;
    syncActionLock();
  }
  function initLockObserver(){
    if(lockObserver) return;
    lockObserver=new MutationObserver(function(muts){
      if(!narrActive()) return;
      if(combatMode) return;   // 战斗中由 DQ 逻辑自行管理 #actions，不在此处上锁（syncActionLock 也不再解锁，需保持一致）
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType!==1) return;
          var bs=(n.matches && n.matches('button:not(.cb-menu)')) ? [n] : (n.querySelectorAll?n.querySelectorAll('button:not(.cb-menu)'):[]);
          for(var i=0;i<bs.length;i++) bs[i].classList.add('locked');
        });
      });
    });
    // v20260911k：容器 id 是 npc-list（旧版写 'npc' 不存在），NPC 列表按钮此前根本不在观察范围内
    ['actions','move-bar','npc-list'].forEach(function(id){ var el=document.getElementById(id); if(el) lockObserver.observe(el,{childList:true,subtree:true}); });
  }
  initLockObserver();
  // ═══ 长文案分句（v20260911k 引入；v20260912g 改「按句」而非「按字数」）═══
  // v20260911k 是按字数硬切（42 字一刀、切不动再退逗号），本意是「别一口气讲一大段」，
  //   可玩家读到的是：一句话被拦腰截断、从半句起蹦出下一句 —— 像机器人在念稿，不像人说话。
  // 现改为**只在「一句说完」处断行**：句号/问号/叹号/分号/省略号 才算收尾，逗号永不断句；
  //   引号、括号内的标点（「……。」）也不算收尾，整句一口气落完。于是每行都是一个完整的句子，
  //   人怎么说、字就怎么落。只有遇上长得离谱的单句（> SPEECH_HARD 字，多是无标点的环境描写）
  //   才退一步按软标点断一次，免得一行糊满整屏。
  var SPEECH_HARD=80;   // 单句超长兜底阈值（字）：仅防「一行占满全屏」，正常句子不受影响
  // deep=true（v20260912l 对话帘用）：连引号里的句子也断 —— 他一句一句讲，而不是把
  //   一整段引语塞成一行。default=false 保持原样（叙事区打字机要整句引语一起走）。
  function splitSpeech(text, deep){
    var s=String(text==null?'':text).trim();
    if(!s) return [];
    var SENT='。！？；…', OPEN='「『（【〔', TAIL='」』）】〕', SOFT='，、,.：:';
    var out=[], buf='', dep=0;
    for(var i=0;i<s.length;i++){
      var ch=s.charAt(i);
      if(OPEN.indexOf(ch)>=0){ dep++; buf+=ch; continue; }
      if(TAIL.indexOf(ch)>=0){
        dep = dep>0 ? dep-1 : 0;
        buf+=ch;
        // 收尾括号恰好收在一句的末标点之后（「……。」）→ 这一句到此为止
        if(dep===0 && buf.length>=2 && SENT.indexOf(buf.charAt(buf.length-2))>=0){ out.push(buf); buf=''; }
        continue;
      }
      buf+=ch;
      if((deep || dep===0) && SENT.indexOf(ch)>=0){ out.push(buf); buf=''; }   // 括号/引号内部不算句末（deep 时算）
    }
    if(buf) out.push(buf);
    if(deep) out=balanceSpeech(out, OPEN, TAIL);
    // 超长单句兜底：只在「这一行会糊满整屏」时才按软标点断一次
    var fin=[];
    out.forEach(function(seg){
      if(seg.replace(/\s/g,'').length<=SPEECH_HARD){ fin.push(seg); return; }
      var cut=-1;
      for(var j=0;j<seg.length;j++){
        if(SOFT.indexOf(seg.charAt(j))<0) continue;
        if(seg.slice(0,j+1).replace(/\s/g,'').length>=SPEECH_HARD*0.6){ cut=j+1; break; }
      }
      if(cut<=0 || cut>=seg.length){ fin.push(seg); return; }
      fin.push(seg.slice(0,cut)); fin.push(seg.slice(cut));
    });
    return fin.filter(function(x){ return String(x).replace(/\s/g,'').length>0; });
  }
  // 引号里断句的善后（v20260912l）：断在引号里，那一行就会「开着引号断掉」、闭引号孤零零落到末行。
  // 这里给断在引号里的那句补上收尾符（让它自成一段），后头多出来的收尾符就地丢掉：
  //   「甲。／乙」 → 「甲。」／乙      （而不是  「甲。／「乙」／」）
  function balanceSpeech(list, OPEN, TAIL){
    var out=[], owe=[];
    for(var i=0;i<list.length;i++){
      var seg=list[i], buf='';
      for(var j=0;j<seg.length;j++){
        var ch=seg.charAt(j);
        if(OPEN.indexOf(ch)>=0){ owe.push(ch); buf+=ch; continue; }
        if(TAIL.indexOf(ch)>=0){ if(owe.length){ owe.pop(); buf+=ch; } continue; }   // 没得配的就是前面补过的余数，丢掉
        buf+=ch;
      }
      while(owe.length){ buf+=TAIL.charAt(OPEN.indexOf(owe.pop())); }   // 补上收尾符
      if(buf) out.push(buf);
    }
    return out;
  }
  function log(text, cls, name, done){
    if(!$narr){ return; }
    var parts=splitSpeech(text);
    if(parts.length>1){
      for(var i=0;i<parts.length-1;i++) logRaw(parts[i], cls, name, null);
      logRaw(parts[parts.length-1], cls, name, done);
      return;
    }
    logRaw(parts.length?parts[0]:text, cls, name, done);
  }
  function logRaw(text, cls, name, done){
    logQueue.push({text:String(text==null?'':text), cls:cls, name:name, done:done});
    syncActionLock();           // 开始输出即锁定按钮（防「文案未完就点下一处」）
    if(!logBusy) pumpLog();
  }
  function pumpLog(){
    if(logBusy) return;
    var item=logQueue.shift();
    if(!item){ return; }
    logBusy=true;
    logNow(item.text, item.cls, item.name, function(){ logBusy=false; if(item.done) item.done(); syncActionLock(); pumpLog(); });
  }
  // 真正执行单段打字（由 log 队列驱动）
  function logNow(text, cls, name, done){
    cls=cls||'env';
    var p=document.createElement('p');
    p.className='narr '+cls;
    var sc=document.getElementById('scene');
    function scroll(){ if(sc) sc.scrollTop=sc.scrollHeight; }
    function finish(){ if(done) done(); }
    var delay = settings.textSpeed>0 ? settings.textSpeed : 0;
    if(cls==='npc' && name){
      var s=document.createElement('span'); s.className='nm'; s.textContent=name+'：'; p.appendChild(s);
      var tn=document.createTextNode(''); p.appendChild(tn); $narr.appendChild(p);
      if(delay<=0){ tn.textContent=text; scroll(); finish(); }
      else { p.classList.add('typing'); typeInto(tn, text, delay, function(){ p.classList.remove('typing'); scroll(); finish(); }, scroll); }
    } else {
      var tn2=document.createTextNode(''); p.appendChild(tn2); $narr.appendChild(p);
      if(delay<=0){ tn2.textContent=text; scroll(); finish(); }
      else { p.classList.add('typing'); typeInto(tn2, text, delay, function(){ p.classList.remove('typing'); scroll(); finish(); }, scroll); }
    }
  }
  // 串行叙事：逐行依次输出，前一行打字完成后隔 gap 再播下一行，避免多行同时刷出眼花
  // v20260911e：末行后【同步】收尾（onDone），不再挂尾随 setTimeout——该定时器在部分环境
  //   会被节流/丢弃，导致 onDone（进而 onbRoomEnter / narrate 后续步骤）永不触发（表现为
  //   序章不播、走廊点卯对话不出）。行间间隔仍用 gap。
  function logScene(lines, gap, onDone){
    gap = gap==null ? 150 : gap;
    var myToken = ++narrToken;          // 本段叙事获得令牌
    narrOngoing=true; syncActionLock(); // 连续叙事期间保持按钮锁定
    (function play(i){
      if(myToken!==narrToken){ if(narrOngoing){ narrOngoing=false; syncActionLock(); } return; } // 已被新场景取代，放弃旧叙事
      if(i>=lines.length){ narrOngoing=false; if(onDone) onDone(); syncActionLock(); return; }
      var l=lines[i];
      log(l.t, l.c, l.n, function(){
        var ni=i+1;
        if(ni>=lines.length){ play(ni); }                       // 末行：立即收尾
        else { setTimeout(function(){ play(ni); }, gap); }      // 行间：间隔 gap
      });
    })(0);
  }

  // ===== 状态栏（两行：身份 + 数值条） =====
  // P3 善恶双轨：侠义/凶名独立双轴，互不抵消
  function moralLabel(){
    var c=state.chivalry, n=state.notoriety;
    if(c>0 && n>0) return '侠'+c+'·凶'+n;
    if(c>0) return '侠'+c;
    if(n>0) return '凶'+n;
    return '中立';
  }
  // 风评称号（基于双轴阈值，见 GAME_DESIGN 4.2）
  function moralTitle(){
    var c=state.chivalry, n=state.notoriety;
    if(c>=40 && n>=40) return '亦正亦邪·枭雄';
    if(c>=30 && n>=30) return '正邪莫测';
    if(c>=30) return '清流义士';
    if(n>=30) return '绿林枭雄';
    if(c>=10 && n>=10) return '正邪交织';
    if(c>=10) return '侠义新秀';
    if(n>=10) return '初露凶名';
    return '无名之辈';
  }
  // 双轴累积 + 阈值解锁提示（P3）
  function addChivalry(v){
    var b=state.chivalry; state.chivalry=Math.max(0,state.chivalry+(v||1));
    afterMoral('chivalry', b, state.chivalry);
  }
  function addNotoriety(v){
    var b=state.notoriety; state.notoriety=Math.max(0,state.notoriety+(v||1));
    afterMoral('notoriety', b, state.notoriety);
  }
  function afterMoral(axis, before, after){
    if(axis==='chivalry'){
      if(before<30 && after>=30) log('【风评】侠义值达 30！清流名士敬重，可接「侠义委托」。','good');
      if(before<40 && after>=40) log('【风评】侠义值达 40！','good');
    } else {
      if(before<30 && after>=30) log('【风评】凶名值达 30！影门与绿林亲近，可接「高阶悬赏」。','good');
      if(before<40 && after>=40) log('【风评】凶名值达 40！','good');
    }
    if(state.chivalry>=40 && state.notoriety>=40 && !state.flags.usurper_seen){
      state.flags.usurper_seen=true;
      log('【风评】侠义凶名俱达 40——亦正亦邪·枭雄 之路为你敞开！','good');
    }
  }
  // 声望框架：0-100，称号区间见 GAME_DESIGN 4.1（P4 起由胜战真实获取；调试台内置常驻，可直赋测试）
  function repTitle(rep){
    if(rep>=95) return '一代宗师';
    if(rep>=85) return '名扬天下';
    if(rep>=70) return '威震一方';
    if(rep>=55) return '名动一方';
    if(rep>=40) return '江湖新秀';
    if(rep>=25) return '小有名气';
    if(rep>=10) return '初入江湖';
    return '无名小卒';
  }
  function addReputation(n){
    var old=state.reputation;
    state.reputation=Math.max(0,Math.min(100,state.reputation+n));
    log('【声望】'+(state.reputation-old>=0?'+':'')+(state.reputation-old)+'（当前 '+state.reputation+' · '+repTitle(state.reputation)+'）','good');
  }
  function renderStatus(){
    checkQuestRewards();
    var sh=SHICHEN[state.time%12];
    var hh=String(Math.floor(state.clock/60)).padStart(2,'0');
    var mm=String(state.clock%60).padStart(2,'0');
    var c=deriveCalendar();
    var era=(state.eraName||'光和')+(c.eraYear===1?'元年':c.eraYear+'年');
    var w=WEATHERS[state.weather]||WEATHERS[0];
    $status.innerHTML=
      '<span class="who" title="'+state.name+'">'+state.name+'</span>'+
      '<span class="dot">·</span>'+
      '<span class="st-clock" id="st-clock">'+hh+':'+mm+'</span>'+
      '<span class="st-time">'+sh+'</span>'+
      '<span class="dot">·</span>'+
      '<span class="st-wx" title="'+w.n+'">'+w.ic+w.n+'</span>';
    var qtr=document.getElementById('quest-track');
    if(qtr){
      var tq=state.trackingQuest, to=null, qd=null;
      if(tq){
        for(var _qi=0;_qi<LF.OBJECTIVES.length;_qi++){ if(LF.OBJECTIVES[_qi].id===tq){ to=LF.OBJECTIVES[_qi]; break; } }
        if(!to && state.quests){ for(var _qj=0;_qj<state.quests.length;_qj++){ if(state.quests[_qj].id===tq){ qd=state.quests[_qj]; break; } } }
      }
      if(to){
        var _qdone=to.check(state);
        qtr.style.display='';
        qtr.innerHTML='<span class="qt-ic">📜</span>追踪 · <b>'+to.title+'</b><span class="qt-prog">'+(_qdone?'已达成 ✓':to.prog(state))+'</span><button class="qt-clear" type="button">✕</button>';
        var _qb=qtr.querySelector('.qt-clear'); if(_qb){ _qb.onclick=function(){ state.trackingQuest=null; renderStatus(); }; }
      } else if(qd){
        var _pt = (qd.need && qd.need.length)
          ? qd.need.map(function(nd){ return nd.name+' '+Math.min(needHave(nd),nd.count)+'/'+nd.count; }).join('  ')
          : (qd.submit ? ('提交 · '+qd.submit.npc) : '');
        qtr.style.display='';
        qtr.innerHTML='<span class="qt-ic">📜</span>追踪 · <b>'+qd.title+'</b><span class="qt-prog">'+_pt+'</span><button class="qt-clear" type="button">✕</button>';
        var _qb2=qtr.querySelector('.qt-clear'); if(_qb2){ _qb2.onclick=function(){ state.trackingQuest=null; renderStatus(); }; }
      } else { qtr.style.display='none'; }
    }
  }
  function renderLocTab(room){
    var loc=room.name||'';
    if(isCityGrid(room.id) && state.flags.cityPos){
      var _m=genCityGrid(room.id);
      if(_m){ var _ct=_m.cells[state.flags.cityPos.y][state.flags.cityPos.x]; loc+=' · '+cellDisplayName(room.id,_ct); }
    }
    var t=document.getElementById('loc-tab'); if(t) t.textContent=loc;
  }

  // ===== 升级 / 效果结算 =====
  // 敌人修为经验：依敌方气血与攻击估算（设计 4.7：修为经验来自战斗结算）
  function enemyExp(en){
    if(!en || en.id==='dummy') return 0;
    return Math.max(1, Math.round((en.hp + en.atk*4) / 10));
  }
  // 升级：每级获得 1 点自由属性点（加点见角色面板 attrAllocHTML）
  function addXp(n){
    if(!state.attr) state.attr={hp:5,atk:5,def:5,spd:5};
    state.exp+=n;
    while(state.exp>=G.BALANCE.expNeed(state.level) && state.level<G.CONSTANTS.MAX_LEVEL){
      state.exp-=G.BALANCE.expNeed(state.level); state.level++;
      state.freePoints=(state.freePoints||0)+1;              // 每升一级获得 1 点自由属性点
      state.hp=state.maxHp;state.mp=state.maxMp;             // 破境气血内力尽复
      log('【破境】修为精进！已至 LV.'+state.level+'，获得 1 点自由属性点（余 '+(state.freePoints||0)+'）。气血尽复。','good');
    }
    if((state.freePoints||0)>0 && combatMode===null){ try{ openModal('levelup'); }catch(e){} }
  }
  function applyEffect(e){
    e=e||{}; var got=[];
    if(e.xp){addXp(e.xp);got.push('修为+'+e.xp);}
    if(e.gold){state.gold=Math.max(0,state.gold+e.gold);got.push('银两'+(e.gold>0?'+':'')+e.gold);}
    if(e.atk){ if(!state.flatBonus) state.flatBonus={hp:0,atk:0,def:0,spd:0}; state.flatBonus.atk+=e.atk; got.push('攻+'+e.atk); }
    if(e.def){ if(!state.flatBonus) state.flatBonus={hp:0,atk:0,def:0,spd:0}; state.flatBonus.def+=e.def; got.push('防+'+e.def); }
    if(e.maxMp){state.maxMp+=e.maxMp;state.mp+=e.maxMp;got.push('内力上限+'+e.maxMp);}
    if(e.mp==='full'){state.mp=state.maxMp;} else if(e.mp){state.mp=Math.min(state.maxMp,state.mp+e.mp);}
    if(e.hp==='full'){state.hp=state.maxHp;got.push('气血尽复');} else if(e.hp){state.hp=Math.min(state.maxHp,state.hp+e.hp);got.push('气血+'+e.hp);}
    if(e.flag)state.flags[e.flag]=true;
    if(e.reputation){addReputation(e.reputation);}
    else if(e.rep){addReputation(e.rep);}
    // 永久战力加成（atk/def）经 flatBonus 累加后，必须重算派生战力方能生效
    if(e.atk || e.def){ G.recalcBase(state); clampHp(); }
    if(e.give){
      var arr=Array.isArray(e.give)?e.give:[e.give];
      arr.forEach(function(g){
        var defId=g.defId||g, n=g.n||1;
        var it=LF.ITEMS.makeItem(defId, n);
        if(packAdd(it)) got.push((it.name||defId)+'×'+n);
        else got.push('（行囊已满，'+defId+'未得）');
      });
    }
    if(got.length) log('【收获】'+got.join('，')+'。','good');
  }
  function findEvent(id){ for(var i=0;i<G.EVENTS.length;i++) if(G.EVENTS[i].id===id) return G.EVENTS[i]; return null; }

  // ══ 作息口径（v20260911h · P3）══════════════════════════════════════════════
  // 「时辰 → 此时能做什么」的判定全部收敛到这一处，勿散落到各处：
  //   劳作吃时辰(laborTick) / 伙房供饭(mess_hall) / 回牢销名(check_in) / 城门宵禁 / 客栈打尖 共用同一套口径。
  //   state.time ∈ 0..11 = 子丑寅卯辰巳午未申酉戌亥；营中「一日」以卯时(3)开牢为始、寅时(2)为末。
  var MESS_HOURS  = [3,4,6,7,9,10];    // 一日三餐各两个时辰：卯辰（朝食）· 午未（晌饭）· 酉戌（夜粥）
  var DEAD_HOURS  = [11,0,1,2];        // 亥子丑寅：灶冷无食（伙房歇火）
  var NIGHT_HOURS = [10,11,0,1,2];     // 戌时鸣鼓落锁起至次日寅时：城门宵禁 / 营中点卯逾期
  var INN_FEE     = 8;                 // 客栈打尖房钱（两）
  var LABOR_PER_WOOD = 3;              // 劳役工分：每 3 工换发 1 枚「劳字木片」
  function hourNow(){ return (((state.time||0)%12)+12)%12; }
  function hourLabel(h){ return SHICHEN[(((h==null?hourNow():h)%12)+12)%12]; }
  function inHours(arr,h){ h=(((h==null?hourNow():h)%12)+12)%12; return arr.indexOf(h)>=0; }
  function isMessHour(h){ return inHours(MESS_HOURS,h); }      // 饭点：灶上有热食
  function isDeadHour(h){ return inHours(DEAD_HOURS,h); }      // 深夜：灶火已熄
  function isCurfewHour(h){ return inHours(NIGHT_HOURS,h); }   // 落锁：城门闭 · 点卯逾期
  function onbF(){ return (state.flags && state.flags.onb) || null; }
  // 营规未脱（未毕业）时才受点卯约束；毕业即脱籍，营规不再管你（但时间与作息照常流动）
  function onbBound(){ var o=onbF(); return !!(o && o.started && o.curfewSet && !o.done); }
  // 营中「一日」结算：跨子夜时清算点卯 —— 前一日没回牢销名即记一次旷役，次日口粮按罚例加倍
  function onbDayTick(days){
    var o=onbF(); if(!o || !o.curfewSet || o.done) return;
    for(var i=0;i<days;i++){
      if(!o.checkInDone) o.missCount=(o.missCount||0)+1;
      o.checkInDone=false;   // 新的一日重新点卯
      o.lateDone=false;      // 新的一日重开晚归判定
      o.messToday=0;         // 当日换饭次数重置
    }
  }
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
    if(state.room==='camp_cell') return true;
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
  // 劳役（时间闭环核心，v20260911h）：一次劳作 = 一个时辰 + 精力，并累积工分换「劳字木片」。
  //   于是营中一日有了预算：干得越多，越须按时回牢销名、去伙房换饭、寻处歇息。
  function laborTick(label){
    if(!exert(label)) return false;
    if(state.energy<6){ log('〔力竭〕你两臂发颤，连锹都握不稳了——先寻处歇一歇（席地打盹 / 营门歇脚）。','warn'); return false; }
    state.energy=Math.max(0,state.energy-4);
    advanceTime(1);
    var o=onbF();
    if(o && o.started && !o.done){
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
    }
    renderStatus(); save(state);
    return true;
  }
  // 营中苦役 → 任务进度（v20260911i）：接了哪桩活，干一次就记一次数，任务日志据此显示 N/3。
  //   三桩苦役（场院担石 / 田间务农 / 仓库搬石）各自独立计数，互不冒充。
  var LABOR_QUEST_ID={ labor_yard:'labor', farm_work:'farm', haul_stones:'haul' };
  var LABOR_QUEST_DEF={ labor:'camp_labor', farm:'camp_farm', haul:'camp_haul' };
  function laborQuestTick(kind){
    var key=LABOR_QUEST_ID[kind]; if(!key) return;
    var t=(state.flags && state.flags.task) || null;
    if(!t || !t[key+'_started'] || t[key+'_done']) return;
    addFlagNum('flags.task.'+key+'_cnt', 1);
    var q=(LF.QUEST_DEFS||{})[LABOR_QUEST_DEF[key]];
    var n=flagNum('flags.task.'+key+'_cnt');
    var goal=(q && q.need && q.need[0] && q.need[0].count) || 3;
    log('〔任务·'+((q&&q.title)||'营中苦役')+'〕'+n+' / '+goal+(n>=goal?' —— 够了，回去复命。':''), n>=goal?'good':'sys');
    save(state); renderStatus();
  }

  // ===== 时间与生存消耗 =====
  function advanceTime(n){
    n=n||1;
    // 教学期「时辰未启」（牢头尚未介绍时辰）→ 时间一律冻结（v20260911i）：
    //   免得玩家不敲门、只在牢里反复打盹，一觉一觉把日头睡过去，把「出门」睡成了深夜。
    if(!clockFlowing()) return;
    var before=state.clock;
    var total=before + n*120;
    var crossings=Math.floor(total/1440);   // 跨子夜次数 = 经过的天数
    state.time=(state.time+n)%12;
    state.clock=total%1440;                  // 每时辰 = 120 游戏分钟
    applyTimeRoutines();                     // 时辰推移 → 驱动 NPC 作息流动（全城通用）
    if(crossings>0){
      onbDayTick(crossings);                 // 营中「一日」结算：点卯 / 旷役（v20260911h · P3）
      state.day=(state.day||0)+crossings;
      syncCalendar();                        // 跨日 → 农历月日 / 年号年序随之推进
      if(Math.random()<0.55) state.weather=Math.floor(Math.random()*WEATHERS.length); // 新日易天候
      warlordDayTick(crossings);             // 群雄逐鹿：NPC 势力自动攻伐（v20260909o）
    }
    state.food=Math.max(0,state.food-n);
    state.drink=Math.max(0,state.drink-n);
    state.energy=Math.max(0,state.energy-2*n);
    maybeStarve();
    tickForge(n);   // 炉膛随时辰持续推进
    tickBuildOrders(crossings);   // 城市营造工单：跨日推进宏观委派 + 结算每日市租（第3步）
    // 查房（v20260911i）：此刻若已过戌时又在营中游荡，巡夜狱卒便来拿人。
    //   动作自身的文案正在打字，故走 requestCurfewPatrol（记「待评」+ 叙事收尾后由 syncActionLock 续评）。
    requestCurfewPatrol();
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
    $modal.classList.remove('hidden');
    $card.innerHTML='<h3 style="color:#8a3b2e">⚔ 殒 落</h3>'+
      '<p class="tip">气血已枯，魂归尘土——乱世如炉，谁记你姓名？<br>欲续前缘，且回首页拾卷重展。</p>'+
      '<button class="close" id="m-home">回 首 页</button>'+
      (curSlot? '<button class="close" id="m-load" style="background:rgba(120,60,50,.12);color:#8a3b2e;margin-top:10px;">读 档 续 命</button>':'');
    var hm=document.getElementById('m-home'); if(hm)hm.onclick=function(){ closeModal(); showTitle(); };
    var ld=document.getElementById('m-load'); if(ld)ld.onclick=function(){ closeModal(); enterGame(rawSlot(curSlot), curSlot); };
  }
  // ===== 标题屏与子面板 =====
  function showTitle(){
    state=null; curSlot=0; Core.state=state; Core.curSlot=curSlot;
    var app=document.getElementById('app'); if(app) app.classList.add('hidden');
    var tt=document.getElementById('title'); if(tt){ tt.classList.remove('hidden'); tt.classList.remove('frozen'); }
    applyTitleFx();
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
  // 图鉴：览物志
  function renderCodex(){
    var known={}; if(state&&state.learnedMartial) state.learnedMartial.forEach(function(id){known[id]=1;});
    var byLine={};
    Object.keys(G.MARTIAL_ARTS||{}).forEach(function(id){
      var m=G.MARTIAL_ARTS[id]; if(!m||!m.line) return;
      (byLine[m.line]=byLine[m.line]||[]).push({name:m.name,on:!!known[id]});
    });
    var h='<h3>览 物 志</h3><p class="tip">江湖风物，已历者标朱。</p>';
    h+='<div class="codex-sec"><h4>武 学（十三艺线）</h4><div class="codex-grid">';
    Object.keys(byLine).forEach(function(line){
      byLine[line].forEach(function(it){ h+='<span class="codex-chip'+(it.on?' on':'')+'">'+it.name+'</span>'; });
    });
    h+='</div></div>';
    h+='<div class="codex-sec"><h4>门 派</h4><div class="codex-grid">';
    Object.keys(G.SECTS||{}).forEach(function(k){ h+='<span class="codex-chip">'+G.SECTS[k].name+'</span>'; });
    h+='</div></div>';
    if(G.ENEMIES){
      h+='<div class="codex-sec"><h4>贼 寇 名 录</h4><div class="codex-grid">';
      Object.keys(G.ENEMIES).forEach(function(k){ var e=G.ENEMIES[k]; if(e&&e.name) h+='<span class="codex-chip">'+e.name+'</span>'; });
      h+='</div></div>';
    }
    return h;
  }
  // 设置：标签页（画面 / 声音 / 游戏）；fromTitle 时不含调试台
  function renderSettings(opts){
    opts=opts||{};
    var fromTitle=!!opts.fromTitle;
    var ts=settings.textSpeed;
    var gfx=
      '<div class="set-row col"><span>文字演出（越大越慢）</span>'+
        '<input type="range" class="lf-range" id="rng-speed" min="0" max="100" step="5" value="'+ts+'">'+
        '<span class="spd-val" id="spd-val">'+lfSpeedLabel(ts)+'</span></div>'+
      '<div class="set-row"><span>标题特效</span><div class="seg" id="seg-fx">'+
        '<button data-v="1" class="'+(settings.titleFx!==false?'on':'')+'">开</button>'+
        '<button data-v="0" class="'+(settings.titleFx===false?'on':'')+'">关</button></div></div>'+
      '<p class="tip">水墨烟尘与墨晕动画；喧嚣可关，长夜更静。</p>';
    var snd=
      '<div class="set-row"><span>音效</span><div class="seg" id="seg-snd">'+
        '<button data-v="1" class="'+(settings.sound?'on':'')+'">开</button>'+
        '<button data-v="0" class="'+(!settings.sound?'on':'')+'">关</button></div></div>'+
      '<div class="set-row col"><span>背景音乐</span>'+
        '<input type="range" class="lf-range" id="rng-bgm" min="0" max="100" step="5" value="'+Math.round((settings.bgmVol!=null?settings.bgmVol:35))+'">'+
        '<span class="spd-val" id="bgm-val">'+Math.round((settings.bgmVol!=null?settings.bgmVol:35))+'%</span></div>'+
      '<div class="set-row col"><span>音效音量</span>'+
        '<input type="range" class="lf-range" id="rng-sfx" min="0" max="100" step="5" value="'+Math.round((settings.sfxVol!=null?settings.sfxVol:60))+'">'+
        '<span class="spd-val" id="sfx-val">'+Math.round((settings.sfxVol!=null?settings.sfxVol:60))+'%</span></div>'+
      '<div class="set-row col"><span>曲目选择</span><div class="seg" id="seg-bgm-track" style="flex-wrap:wrap;">'+
        (function(){
          try {
            var tracks = SFX.getBgmTracks();
            var cur = SFX.getCurrentBgmIdx();
            return tracks.map(function(t){ return '<button data-idx="'+t.idx+'" class="'+(t.idx===cur?'on':'')+'" style="margin:2px;font-size:11px;padding:4px 8px;">'+t.name+'</button>'; }).join('');
          } catch(e) { return ''; }
        })()+
      '</div></div>'+
      '<p class="tip">四首古风BGM可选，箫笛古琴各有意境；曲间静默15秒。</p>';
    var game='';
    if(!fromTitle){
      game+='<button class="close" id="m-save" style="margin-top:14px;">立即存档</button>';
    }
    game+='<button class="close" id="m-clear" style="background:rgba(120,60,50,.12);color:#8a3b2e;margin-top:10px;">清除全部存档</button>';
    if(!fromTitle){
      game+='<button class="close" id="m-dev" style="background:rgba(176,131,47,.16);color:#8a6a2e;margin-top:10px;">🛠 调试台</button>';
    }
    game+='<p class="tip">设定已存，演武时遵循。</p>'+
      '<p class="tip">当前版本 v'+LF.CONSTANTS.VERSION+'</p>';
    return '<h3>设 置</h3>'+
      '<div class="set-tabs">'+
        '<button data-tab="gfx" class="on">画面</button>'+
        '<button data-tab="snd">声音</button>'+
        '<button data-tab="game">游戏</button>'+
      '</div>'+
      '<div class="set-panel" data-panel="gfx">'+gfx+'</div>'+
      '<div class="set-panel hidden" data-panel="snd">'+snd+'</div>'+
      '<div class="set-panel hidden" data-panel="game">'+game+'</div>';
  }
  // 开发人员名单：群英同撰
  function renderCredit(){
    return '<h3>群 英 同 撰</h3>'+
      '<p class="tip">此作由一人独力编撰，赖 AI 襄助而成。勒名于左，以志其事。</p>'+
      row('总 撰','一只大鸽子')+
      row('执 笔','一只大鸽子')+
      row('程 式','一只大鸽子')+
      row('绘 事','一只大鸽子')+
      row('校 勘','一只大鸽子')+
      row('音 律','一只大鸽子')+
      row('协 力','CodeBuddy（AI 协作）')+
      '<p class="tip">一人一灯，江湖路远。若遇同好，可续刻其名。</p>';
  }
  // ===== P0：志向（目标追踪）+ 门派加入 UX =====
  var QORDER={white:0,green:1,blue:2,purple:3,orange:4};
  function objBestEquip(s){ var b={q:0,name:''}; if(s.equipment){ Object.keys(s.equipment).forEach(function(k){ var it=s.equipment[k]; if(it&&it.quality!=null){ var q=QORDER[it.quality]; if(q!=null&&q>b.q){b.q=q;b.name=it.name;} } }); } return b; }
  // 任务日志：接取式任务「进行中 / 已完成」分页；初始空白，接到任务才出现
  function renderObjectives(){
    var quests = (state.quests && state.quests.length) ? state.quests : [];
    var done = (state.questsDone && state.questsDone.length) ? state.questsDone : [];
    var career = (LF.OBJECTIVES) ? LF.OBJECTIVES.map(function(o){ return {o:o,done:o.check(state)}; }) : [];
    var h='<h3>任 务 日 志</h3>'+
      '<div class="quest-tabs">'+
        '<button class="qtab active" data-t="active" onclick="switchQuestTab(\'active\')">进行中</button>'+
        '<button class="qtab" data-t="done" onclick="switchQuestTab(\'done\')">已完成'+(done.length?('（'+done.length+'）'):'')+'</button>'+
        '<button class="qtab" data-t="career" onclick="switchQuestTab(\'career\')">志业</button>'+
      '</div>'+
      '<div class="quest-pane" id="qp-active">';
    if(!quests.length){
      h+='<p class="tip q-empty">暂无进行中的任务。与营中众人攀谈，或留意高亮提示，即可接取任务。</p>';
    } else {
      quests.forEach(function(q){ h+=questCardHTML(q); });
    }
    h+='</div><div class="quest-pane" id="qp-done" style="display:none">';
    if(!done.length){
      h+='<p class="tip q-empty">尚无已完成的任务。</p>';
    } else {
      h+='<div class="obj-done">';
      done.forEach(function(q){ h+='<span class="obj-d">✓ '+q.title+'</span>'; });
      h+='</div>';
    }
    h+='</div><div class="quest-pane" id="qp-career" style="display:none">';
    if(!career.length){
      h+='<p class="tip q-empty">暂无功业可记。</p>';
    } else {
      career.forEach(function(x){ h+=objCardHTML(x); });
    }
    h+='</div>';
    return h;
  }
  function objCardHTML(x){
    var o=x.o;
    var tn={main:'主线',side:'支线',trial:'修行'}[o.type]||'任务';
    var cls=o.type==='main'?'t-main':(o.type==='trial'?'t-trial':'t-side');
    var r='<div class="obj '+cls+'">'+
      '<div class="obj-head"><span class="obj-tag '+cls+'">'+tn+'</span><span class="obj-t">'+o.title+'</span></div>'+
      '<div class="obj-h">'+o.hint+'</div>';
    if(typeof o.ratio==='function'){
      var rt=Math.max(0,Math.min(1,o.ratio(state)||0));
      r+='<div class="obj-bar"><span style="width:'+Math.round(rt*100)+'%"></span></div>'+
         '<div class="obj-p">'+o.prog(state)+'</div>';
    } else {
      r+='<div class="obj-p">进度 · '+o.prog(state)+'</div>';
    }
    if(o.reward){
      var rw=[];
      if(o.reward.xp) rw.push('修为+'+o.reward.xp);
      if(o.reward.gold) rw.push('银两+'+o.reward.gold);
      if(o.reward.rep) rw.push('声望+'+o.reward.rep);
      r+='<div class="obj-reward">奖励 · '+rw.join(' · ')+'</div>';
    }
    var tracking=state.trackingQuest===o.id;
    r+='<button class="obj-track'+(tracking?' on':'')+'" data-quest="'+o.id+'" type="button">'+(tracking?'追踪中 ✓':'追 踪')+'</button>'+
       '</div>';
    return r;
  }
  function questTitle(qid){
    if(LF.OBJECTIVES){ for(var i=0;i<LF.OBJECTIVES.length;i++){ if(LF.OBJECTIVES[i].id===qid) return LF.OBJECTIVES[i].title; } }
    if(state.quests){ for(var i=0;i<state.quests.length;i++){ if(state.quests[i].id===qid) return state.quests[i].title; } }
    return qid;
  }
  function packCount(id){
    if(!state.pack) return 0; var n=0;
    for(var i=0;i<state.pack.length;i++){ var it=state.pack[i]; if(it && (it.defId||it.id)===id) n+=(it.count||1); }
    return n;
  }
  // 旗标计数（v20260911i）：营中苦役的进度不是「物品×N」，而是「活计趟数」——落在 state.flags.task.<key>_cnt。
  //   flagNum 取值 / addFlagNum 累加；needHave 把「物品需求」与「旗标需求」统一换算成「已有多少」，
  //   供状态栏追踪条与任务卡共用（need 项无 flag 时按背包实时派生，见 story/objectives.js）。
  function flagNum(path){
    var ks=String(path).split('.'), c=state;
    for(var i=0;i<ks.length;i++){ if(c==null) return 0; c=c[ks[i]]; }
    return (typeof c==='number')?c:(parseInt(c,10)||0);
  }
  function addFlagNum(path, n){
    var ks=String(path).split('.'), c=state;
    for(var i=0;i<ks.length-1;i++){ if(c[ks[i]]==null) c[ks[i]]={}; c=c[ks[i]]; }
    var k=ks[ks.length-1];
    c[k]=(parseInt(c[k],10)||0)+(n||1);
    return c[k];
  }
  function needHave(nd){
    if(!nd) return 0;
    if(nd.flag) return flagNum(nd.flag);
    if(nd.item) return packCount(nd.item);
    return 0;
  }
  function acceptQuest(id){
    state.quests=state.quests||[]; if(state.quests.some(function(q){return q.id===id;})) return;
    var def=LF.QUEST_DEFS && LF.QUEST_DEFS[id]; if(!def) return;
    state.quests.push(JSON.parse(JSON.stringify(def)));
    save(state); renderStatus();
  }
  function completeQuest(id){
    state.quests=state.quests||[];
    var i=state.quests.findIndex(function(q){return q.id===id;}); if(i<0) return;
    var q=state.quests.splice(i,1)[0];
    state.questsDone=state.questsDone||[];
    state.questsDone.push({id:q.id,title:q.title,type:q.type,reward:q.reward});
    if(state.trackingQuest===id) state.trackingQuest=null;
    save(state); renderStatus();
  }
  function questCardHTML(q){
    var tn={main:'主线',side:'支线',trial:'修行'}[q.type]||'任务';
    var cls={main:'t-main',side:'t-side',trial:'t-trial'}[q.type]||'t-side';
    var h='<div class="obj '+cls+'">'+
      '<div class="obj-head"><span class="obj-tag '+cls+'">'+tn+'</span><span class="obj-t">'+q.title+'</span></div>'+
      '<div class="obj-h">'+q.hint+'</div>';
    if(q.need && q.need.length){
      h+='<div class="q-need">';
      q.need.forEach(function(nd){
        var have=needHave(nd), ok=have>=nd.count;
        h+='<div class="q-need-row'+(ok?' done':'')+'">'+
           '<span class="q-ic">'+(nd.icon||'')+'</span>'+
           '<span class="q-nm">'+nd.name+'</span>'+
           '<span class="q-cnt">'+Math.min(have,nd.count)+' / '+nd.count+'</span></div>';
      });
      h+='</div>';
    }
    if(q.submit){ var _rn=(G.ROOMS[q.submit.room]&&G.ROOMS[q.submit.room].name)||''; h+='<div class="q-submit">📍 提交 · '+q.submit.npc+(_rn?('（'+_rn+'）'):'')+'</div>'; }
    if(q.reward){ h+='<div class="obj-reward">奖励 · '+q.reward+'</div>'; }
    var tracking=state.trackingQuest===q.id;
    h+='<button class="obj-track'+(tracking?' on':'')+'" data-quest="'+q.id+'" type="button">'+(tracking?'追踪中 ✓':'追 踪')+'</button></div>';
    return h;
  }
  window.switchQuestTab=function(t){
    var card=document.getElementById('modal-card'); if(!card) return;
    var btns=card.querySelectorAll('.qtab'); for(var i=0;i<btns.length;i++){ btns[i].classList.toggle('active', btns[i].getAttribute('data-t')===t); }
    var pa=document.getElementById('qp-active'), pd=document.getElementById('qp-done'), pc=document.getElementById('qp-career');
    if(pa) pa.style.display = t==='active'?'':'none';
    if(pd) pd.style.display = t==='done'?'':'none';
    if(pc) pc.style.display = t==='career'?'':'none';
  };
  function bindQuestPanel(){
    document.querySelectorAll('.obj-track[data-quest]').forEach(function(b){
      b.onclick=function(){
        var qid=b.getAttribute('data-quest');
        if(state.trackingQuest===qid){ state.trackingQuest=null; toast('已取消追踪'); }
        else { state.trackingQuest=qid; toast('已追踪「'+questTitle(qid)+'」，目标显示在顶栏'); }
        renderStatus();
        openModal('quest');
      };
    });
  }
  function checkQuestRewards(){
    if(!state || !LF.OBJECTIVES) return;
    state.questRewards=state.questRewards||{};
    var got=[];
    LF.OBJECTIVES.forEach(function(o){
      if(state.questRewards[o.id]) return;
      if(o.check(state)){
        state.questRewards[o.id]=true;
        if(o.reward){
          if(o.reward.xp){ addXp(o.reward.xp); got.push('修为+'+o.reward.xp); }
          if(o.reward.gold){ state.gold=(state.gold||0)+o.reward.gold; got.push('银两+'+o.reward.gold); }
          if(o.reward.rep){ addReputation(o.reward.rep); got.push('声望+'+o.reward.rep); }
        }
        got.push('任务「'+o.title+'」');
      }
    });
    if(got.length) log('【任务达成】'+got.join('，')+'。','good');
  }

  function sectBonusText(b){
    if(!b) return '';
    var m={atk:'攻',def:'防',maxHp:'气血',maxMp:'内力',spd:'身法'};
    var p=[]; Object.keys(b).forEach(function(k){ if(b[k]) p.push('+'+b[k]+' '+m[k]); });
    return p.join(' · ');
  }
  function sectReqText(d){
    var u=d.unlock||{}, p=[];
    if(u.reputation) p.push('江湖声望≥'+u.reputation);
    if(u.level) p.push('等级≥'+u.level);
    if(u.flag) p.push('需先触发「'+(({met_zhangjiao:'张角之遇'})[u.flag]||u.flag)+'」');
    return p.length?p.join(' · '):'无门槛';
  }
  function renderSectPanel(){
    if(!G.SECTS) return '<h3>门 派</h3><p class="tip">数据未载入。</p>';
    var h='<h3>门 派</h3>'+
      '<p class="tip">门派为「中后期可选玩法」：声望初立后方可主动加入，得门风加成与传功。已入者不可更易。</p>'+
      '<div class="sect-list">';
    Object.keys(G.SECTS).forEach(function(id){
      var d=G.SECTS[id], joined=state.sect===id, can=G.canJoinSect(state,id);
      h+='<div class="sect'+(joined?' on':'')+'">'+
        '<div class="sect-name">'+d.name+'<span class="sect-fac">'+d.faction+'</span></div>'+
        '<div class="sect-desc">'+d.style+'</div>'+
        '<div class="sect-bonus">门风加成 · '+sectBonusText(d.bonus)+'</div>'+
        '<div class="sect-skill">传功 · '+((d.martials||[]).join('、'))+'</div>'+
        '<div class="sect-req">加入条件 · '+sectReqText(d)+'</div>'+
        (joined?'<div class="sect-joined">✓ 已身属此派</div>'
               :(can.ok?'<button class="sect-join" data-sect="'+id+'">加 入 此 派</button>'
                       :'<button class="sect-join" disabled title="'+can.reason+'">未达条件</button>'))+
        '</div>';
    });
    h+='</div>';
    return h;
  }
  function bindSectPanel(){
    document.querySelectorAll('.sect-join[data-sect]').forEach(function(b){
      if(b.disabled) return;
      b.onclick=function(){
        var id=b.getAttribute('data-sect');
        if(state.sect){ toast('你已身属「'+G.SECTS[state.sect].name+'」'); return; }
        var r=G.canJoinSect(state,id);
        if(!r.ok){ toast(r.reason); return; }
        G.joinSect(state,id);
        log('你拜入「'+G.SECTS[id].name+'」，得传功心法。','good');
        toast('已加入「'+G.SECTS[id].name+'」');
        openModal('sect'); renderStatus();
      };
    });
  }
  function topObjectiveText(){
    if(!LF.OBJECTIVES) return '志向';
    for(var i=0;i<LF.OBJECTIVES.length;i++){ if(!LF.OBJECTIVES[i].check(state)) return LF.OBJECTIVES[i].title; }
    return '诸事已了';
  }
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
    narrToken++;                 // 新场景：使任何残留的旧叙事序列失效
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
    var suppressNarr = onboarding && (rid==='camp_yard' || rid==='camp_cell' || rid==='kuyilao' || /^camp_[td]z\d$/.test(rid));
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
      if(room.isField) narr = narr.concat(fieldNarr(room));   // 郊野：资源/野兽/路人
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
  // 城况面板（v20260825d）：参数 + 城型 + 城门 + 市集清单
  function renderCityStat(cid){
    var p=cityProfile(cid); if(!p) return '<h3>城 况</h3><p class="empty">暂无此城数据。</p>';
    var m=genCityGrid(cid);
    var mkHtml='';
    if(m && m.markets){
      var seen={}, list=[], total=0;
      for(var k in m.markets){
        total++;
        var mk=m.markets[k];
        var _xy=k.split(',');
        // 仅统计已营建、当前可见的市集（与城内地图一致：开发度半径外/遭战火者不计入），避免面板虚报
        if(cellDisplayType(cid, +_xy[0], +_xy[1])!=='market') continue;
        if(!seen[mk.name]){ seen[mk.name]=1; list.push(mk); }
      }
      if(list.length){
        var _tip = (total>list.length) ? ('，另有 '+(total-list.length)+' 处位于未营建/焦土区，待营建或修缮后开放') : '';
        mkHtml='<div class="row"><span>市集（已营建 '+list.length+' 处'+_tip+'）</span></div><div class="city-mk">';
        list.forEach(function(mk){
          var shops=mk.shops.map(function(s){ return s.sign; }).join('、');
          mkHtml+='<div class="mk-i">🏯 <b>'+mk.name+'</b>：'+shops+'</div>';
        });
        mkHtml+='</div>';
      }
    }
    // 在建营造工单（第3步）：列出本城所有「building」状态的 BuildOrder
    var boHtml='';
    var _bo=state.flags.buildOrders;
    if(_bo){
      var boList=[];
      for(var _bid in _bo){ var _o=_bo[_bid]; if(_o && _o.cid===cid && _o.status==='building') boList.push(_o); }
      if(boList.length){
        boHtml='<div class="row"><span>营造工事（'+boList.length+' 处）</span></div><div class="city-mk">';
        boList.forEach(function(_o){
          var _bp=LF.BUILD[_o.blueprintId]||{};
          var _st=(_bp.stages||[]).length;
          boHtml+='<div class="mk-i">🚧 <b>'+(_bp.doneName||'新筑')+'</b>：阶段 '+Math.min((_o.stageIndex||0)+1,_st)+' / '+_st+'　人力 '+(_o.laborPaid||0)+'/'+(_o.laborNeeded||(_bp.labor||2))+'</div>';
        });
        boHtml+='</div>';
      }
    }
    return '<h3>城 况 · '+p.c.name+'</h3>'+
      row('行政', p.tierDesc)+
      row('城型', p.ctypeDesc)+
      row('城门', (availableGateDirs(cid)||[]).length+' 座')+
      row('城级', cityLevelName(cid)+'（'+cityGridSize(cid)+'×'+cityGridSize(cid)+' 格，建设度 '+cityDevOf(cid)+'）')+
      row('人口', p.popDesc)+
      row('治安', p.orderDesc)+
      row('商业', p.comDesc)+
      row('农业', p.agriDesc)+
      row('城防', (p.c.wall>=60?'高垒深沟': p.c.wall>=45?'城墙完固': p.c.wall>=30?'城垣可守':'防守疏懈'))+
      (mkHtml? mkHtml : '')+
      (boHtml? boHtml : '')+
      '<p class="tip">城型与城门数量已预留：山城/城寨/港口将随城防与商业改变城门布局（plain 为四门）。市集名取「方位·交易物·地理·吉语」可混可单，商铺招牌由字号生成。城内空地可点格「营造」筑新宅新市。</p>';
  }
  // ══════════════════════════════════════════════════════════════════════════
  // 城市 NPC 装配器（v20260912d）—— 数据在 shared/data/npc_cards.js
  // ══════════════════════════════════════════════════════════════════════════
  // 旧版此处是 NPC_GEN：一个格型一个生成函数，台词内联、没有姓名、一个动作占一个按钮，
  // 且 key 不带坐标（`mkt_'+cid`），由此带出三个硬伤：
  //   ① 点「交谈」毫无反应 —— 生成器自带的「交谈」被 buildNpcActions 当重复项滤掉，
  //      换上的标准项走 talk(key)，而 talk 里 `G.DIALOGUES.npcs[key]` 查不到动态 key 就 return；
  //   ② 好感度串味 —— 一城几处市集共用一个 key，赠礼全记在同一笔账上；
  //   ③ 七十城一个腔调 —— 台词写死「渔阳」「黑山」，洛阳的营门哨也在讲苦役营的事。
  // 现在改为「人设卡 + 装配器」：卡只管内容（格型/作息/台词/话题/事务），
  // 装配器只管调度（时辰、城况、格池、稳定 key、姓名），新增角色 = 加一张卡。
  var NPC_CARDS = [], NPC_CARD_BY = {};
  (function () {
    var src = (LF.NPC_CARDS || []);
    for (var i = 0; i < src.length; i++) { var cd = src[i]; if (cd && cd.id) { NPC_CARDS.push(cd); NPC_CARD_BY[cd.id] = cd; } }
  })();
  // key → 最近一次生成的对象：talk(key) / 观察 / 给予都要按 key 反查回同一个「人」
  var NPC_BY_KEY = {};
  var NPC_BY_KEY_N = 0;
  function npcRegister(o) {
    if (!o || !o.key) return o;
    if (NPC_BY_KEY_N > 1400) { NPC_BY_KEY = {}; NPC_BY_KEY_N = 0; }   // 防长局内存堆积（对象都很小，纯保险）
    NPC_BY_KEY[o.key] = o; NPC_BY_KEY_N++;
    return o;
  }
  // ── 时辰：教学期时间冻结时按「戌·入夜」评估，与具名角色作息（NPC_ROUTINES_CITY）同源 ──
  function npcHour() {
    var onb = state.flags && state.flags.onb;
    if (onb && onb.started && !onb.done && !onb.clockOn) return 10;
    return (((state.time || 0) % 12) + 12) % 12;
  }
  // ── 城况用语：台词只引用客观情形，不涉国号（GAME_DESIGN §用词规范）──
  function npcFill(line, c, cnm, mktName) {
    if (line == null) return '';
    c = c || {};
    return String(line)
      .replace(/\{city\}/g, cnm || '此城')
      .replace(/\{comm\}/g, c.comm || '本郡')
      .replace(/\{state\}/g, c.state || '本州')
      .replace(/\{mkt\}/g, mktName || '市集')
      .replace(/\{order\}/g, (c.order >= 60 ? '治安尚安' : c.order >= 45 ? '治安平平' : '治安不靖'))
      .replace(/\{wealth\}/g, (c.commerce >= 60 ? '商旅繁盛' : c.commerce >= 45 ? '市井如常' : '商旅寥落'))
      .replace(/\{agri\}/g, (c.agri >= 60 ? '农事丰稔' : c.agri >= 45 ? '收成平平' : '田畴荒疏'))
      .replace(/\{wall\}/g, (c.wall >= 60 ? '甲械精良' : c.wall >= 45 ? '器械尚可' : '器械不齐'));
  }
  // ── 姓名：由 key 派生，故同一个 NPC 走开再回来仍是同一个名字 ──
  function npcNameOf(card, key) {
    if (!card.personal) return card.role || '路人';
    var NM = LF.NPC_NAMES;
    if (!NM) return card.role || '路人';
    var surs = NM.surnames || ['王'];
    var giv = (card.gender === 'f') ? (NM.givenF || ['阿妹']) : (NM.givenM || ['二郎']);
    var rnd = seededRand('npc|name|' + key);
    return (surs[Math.floor(rnd() * surs.length)] || '王') + (giv[Math.floor(rnd() * giv.length)] || '二郎');
  }
  // ── 好感度：按 key 记账（key 稳定且唯一 → 每个 NPC 各有一本账）──
  var FAVOR_TIERS = [
    { min: 80, name: '知己', cls: 'f-best' },
    { min: 40, name: '厚交', cls: 'f-good' },
    { min: 15, name: '相识', cls: 'f-ok' },
    { min: 1, name: '面熟', cls: 'f-meh' },
    { min: -9, name: '陌生', cls: '' },
    { min: -29, name: '戒备', cls: 'f-bad' },
    { min: -9999, name: '仇视', cls: 'f-worst' }
  ];
  function npcFavor(key) { return (key && state.npcFavor && state.npcFavor[key]) || 0; }
  function npcFavorTier(v) { for (var i = 0; i < FAVOR_TIERS.length; i++) { if (v >= FAVOR_TIERS[i].min) return FAVOR_TIERS[i]; } return FAVOR_TIERS[FAVOR_TIERS.length - 1]; }
  function addNpcFavor(key, n) {
    if (!key || !n) return 0;
    if (!state.npcFavor) state.npcFavor = {};
    state.npcFavor[key] = (state.npcFavor[key] || 0) + n;
    return state.npcFavor[key];
  }
  function npcFavorPct(v) { return Math.max(3, Math.min(100, Math.round((v + 100) / 2))); }
  // ── 台词轮播：顺序推进而非随机取，同一个人不会连着说三遍同一句 ──
  function npcRotate(seqKey, arr) {
    if (!arr || !arr.length) return '';
    if (!state.npcSeq) state.npcSeq = {};
    var idx = (state.npcSeq[seqKey] || 0) % arr.length;
    state.npcSeq[seqKey] = idx + 1;
    return arr[idx];
  }
  function npcLine(o, tpl) { return npcFill(tpl, o._c, o._cnm, o._mkt); }
  // 该 NPC 此刻的一句闲谈（好感度到「相识」后换用 warm 池）
  function npcSmallTalk(o) {
    var pool = (npcFavor(o.key) >= 15 && o.card.warm && o.card.warm.length) ? o.card.warm : (o.card.says || []);
    return npcLine(o, npcRotate(o.key + '|s', pool));
  }
  // ── 装配：格型 × 时辰 × 城况 → 本格该有谁 ──
  function npcHourOK(card, hour) { return !card.hours || card.hours.indexOf(hour) >= 0; }
  // 某几个格型的格坐标池（按 y*size+x 升序，稳定）—— roam 卡按序号取模落点，故同一时刻只在一处（不分身）。
  // 用 cellDisplayType 而非 m.cells：只有「此刻真走得进」的格才收进池子，
  // 否则首都在开发半径外的 unbuilt 格会把唯一的货郎/乞儿关进去，玩家一辈子见不着。
  function npcCellPool(cid, m, types) {
    var out = [];
    for (var yy = 0; yy < m.size; yy++) for (var xx = 0; xx < m.size; xx++) {
      if (types.indexOf(cellDisplayType(cid, xx, yy)) >= 0) out.push(xx + ',' + yy);
    }
    return out;
  }
  function npcCountOf(card, c) {
    var n = card.count; if (n == null) n = 1;
    if (typeof n === 'object') {
      n = (n.base || 0) + Math.floor(((c && c.pop) || 50) * (n.perPop || 0));
      if (n.max != null && n > n.max) n = n.max;
      if (n < 0) n = 0;
    }
    return n | 0;
  }
  function npcEligible(card, cid, hour, c) {
    if (!card) return false;
    if (card.except && card.except.indexOf(cid) >= 0) return false;
    if (!npcHourOK(card, hour)) return false;
    var cd = card.cond;
    if (cd) {
      if (cd.orderBelow != null && !((c.order || 0) < cd.orderBelow)) return false;
      if (cd.orderAbove != null && !((c.order || 0) > cd.orderAbove)) return false;
      if (cd.popAbove != null && !((c.pop || 0) > cd.popAbove)) return false;
    }
    return true;
  }
  // 该卡在本格露面的实例序号；null = 不在本格
  function npcSlotsHere(card, cid, cellType, hour, c, m, here) {
    var n = npcCountOf(card, c); if (n <= 0) return null;
    var kinds = card.kinds || [];
    if (card.roam) {
      var roaming = card.roam.hours && card.roam.hours.indexOf(hour) >= 0;
      var pool = npcCellPool(cid, m, roaming ? (card.roam.to || []) : kinds);
      if (!pool.length) return null;
      // 游荡时段每过一个时辰整体前移一格 —— 街面上的人真的在走动，而不是钉死在某处
      var step = roaming ? (hour % pool.length) : 0;
      var idxs = [];
      for (var i = 0; i < n; i++) { if (pool[(i + step) % pool.length] === here) idxs.push(i); }
      return idxs.length ? idxs : null;
    }
    if (kinds.indexOf(cellType) < 0) return null;
    var all = []; for (var j = 0; j < n; j++) all.push(j);
    return all;
  }
  function npcMake(card, cid, x, y, slot, c, cnm, mktName) {
    var key = card.id + '@' + cid + ':' + x + ',' + y + '#' + slot;
    var o = {
      key: key, card: card, cardId: card.id, cid: cid, x: x, y: y, slot: slot,
      cell: x + ',' + y,
      name: npcNameOf(card, key),
      role: card.role || '', icon: card.icon || '👤', desc: card.desc || '',
      align: card.align || 'neutral', hostile: !!card.danger,
      _c: c, _cnm: cnm, _mkt: mktName
    };
    return npcRegister(o);
  }
  // 敌意卡（溃兵之流）：不给「交谈」，只给挑战
  function npcHostileActs(o) {
    var eid = ((G.ENEMIES && G.ENEMIES[o.cardId]) ? o.cardId : ((NPC_COMBAT_MAP[o.cardId] || [])[0] || null)) || 'deserter';
    return [{ label: '挑战', icon: '⚔', danger: true, fn: function () { startCombat(eid); } }];
  }
  // city.js 的 cityCellNpcs 调此函数取「本格生成的城市 NPC」（签名沿用旧的 (cid,x,y)）
  function buildCityCellNpcs(cid, x, y) {
    var m = genCityGrid(cid); if (!m) return [];
    var c = (LF.CITIES || {})[cid] || {};
    var cnm = c.name || '此城', here = x + ',' + y;
    var cellType = cellDisplayType(cid, x, y);
    var hour = npcHour();
    var mk = m.markets && m.markets[here];
    var mktName = mk ? mk.name : '市集';
    var out = [];
    for (var i = 0; i < NPC_CARDS.length; i++) {
      var card = NPC_CARDS[i];
      if (!npcEligible(card, cid, hour, c)) continue;
      var slots = npcSlotsHere(card, cid, cellType, hour, c, m, here);
      if (!slots) continue;
      for (var s = 0; s < slots.length; s++) {
        var o = npcMake(card, cid, x, y, slots[s], c, cnm, mktName);
        // 标准动作列（交谈/观察/给予/攻击）由 renderNpcList 统一补；敌意卡自带且只带「挑战」
        out.push({ o: o, acts: o.hostile ? npcHostileActs(o) : [] });
      }
    }
    return out;
  }
  // ══════════════════════════════════════════════════════════════════════════
  // 交谈面板：把「问价 / 问农 / 问政 / 探问 / 查账 / 讨教 …」这些
  //   本来各占一个按钮的内容统一收进「交谈」，作为话题呈现。
  // ══════════════════════════════════════════════════════════════════════════
  var talkNpc = null;
  function openTalkPanel(o) {
    if (!o || !o.key) return;
    if (askPending) { toast('先把眼前的话应了。'); return; }
    removeTutChoices();
    if (narrActive()) { toast('……且听他把话说完。'); return; }
    talkNpc = o;
    openModal('talk', { npc: o });
  }
  // 每天每话题首次聊起 +1 好感（闲聊不刷，防原地刷好感）
  function npcTopicOnce(o, topicId) {
    if (!state.npcTopic) state.npcTopic = {};
    var rec = state.npcTopic[o.key] || (state.npcTopic[o.key] = {});
    var day = state.day || 1;
    if (rec[topicId] === day) return false;
    rec[topicId] = day;
    return true;
  }
  function npcTalkPrefix(o) { return '〔' + o.name + (o.role ? '·' + o.role : '') + '〕'; }
  function npcSpeak(o, topic) {
    var line;
    if (topic && topic.lines && topic.lines.length) line = npcLine(o, npcRotate(o.key + '|t|' + topic.id, topic.lines));
    else line = npcSmallTalk(o);
    if (!line) line = '「……」';
    log(npcTalkPrefix(o) + line, 'npc', o.name);
    if (topic && topic.favor) { addNpcFavor(o.key, topic.favor); }
    else if (topic && npcTopicOnce(o, topic.id)) {
      addNpcFavor(o.key, 1);
      log('〔' + o.name + '·好感 +1〕', 'good');
    }
    save(state);
    return line;
  }
  // 事务（有副作用的动作）：数据侧只写 engine:'xxx'，实现集中在此表
  var NPC_ACT_IMPL = {
    farm_help: function (o) {
      if (!exert('下田助农')) return '';
      state.food = Math.min(state.maxFood, state.food + 12);
      log('〔农庄〕你下田搭了把手，庄头塞来新麦（粮草+12）。', 'good');
      return '「壮士好力气！这点新麦拿去。」';
    },
    farm_buy: function (o) {
      if (!exert('向农籴粮')) return '';
      state.food = state.maxFood;
      log('〔农庄〕你向庄头籴粮，行囊充实（粮草补满）。', 'good');
      return '「粮在囤里，壮士自己量。」';
    }
  };
  function talkTopicBtns(o) {
    var tp = o.card.topics || [], h = '';
    for (var i = 0; i < tp.length; i++) {
      h += '<button class="talk-btn" data-topic="' + tp[i].id + '">'
        + '<span class="tb-ic">' + (tp[i].icon || '💬') + '</span><span class="tb-lb">' + tp[i].label + '</span></button>';
    }
    return h;
  }
  function talkActBtns(o) {
    var ac = o.card.acts || [], h = '';
    for (var i = 0; i < ac.length; i++) {
      h += '<button class="talk-btn talk-btn-act" data-topic-act="' + ac[i].id + '" title="' + (ac[i].tip || '') + '">'
        + '<span class="tb-ic">' + (ac[i].icon || '·') + '</span><span class="tb-lb">' + ac[i].label + '</span></button>';
    }
    return h;
  }
  function talkFavorHTML(o) {
    var v = npcFavor(o.key), t = npcFavorTier(v);
    return '<div class="talk-fav ' + t.cls + '">'
      + '<div class="tf-bar"><i style="width:' + npcFavorPct(v) + '%"></i></div>'
      + '<div class="tf-lb">' + t.name + ' · ' + (v > 0 ? '+' : '') + v + '</div></div>';
  }
  function renderTalkPanel(o) {
    if (!o) return '<h3>交 谈</h3><p>未指定对象。</p>';
    var topics = talkTopicBtns(o), acts = talkActBtns(o);
    return '<div class="talk-panel">'
      + '<div class="talk-head">'
      +   '<span class="talk-av">' + (o.icon || '👤') + '</span>'
      +   '<div class="talk-id"><div class="talk-nm">' + o.name + '</div>'
      +     '<div class="talk-role">' + (o.role || '') + '</div></div>'
      +   '<div class="talk-fav-wrap">' + talkFavorHTML(o) + '</div>'
      + '</div>'
      + '<div class="talk-line" id="talk-line">' + npcSmallTalk(o) + '</div>'
      + (topics ? '<div class="talk-sec">话题</div><div class="talk-grid">' + topics + '</div>' : '')
      + (acts ? '<div class="talk-sec">事务</div><div class="talk-grid">' + acts + '</div>' : '')
      + '<div class="talk-foot">'
      +   '<button class="talk-foot-btn" id="talk-observe">👁 观察</button>'
      +   '<button class="talk-foot-btn" id="talk-give">🎁 给予</button>'
      +   '<button class="talk-foot-btn" id="talk-close">告 辞</button>'
      + '</div>'
      + '</div>';
  }
  function talkSetLine(txt) {
    var el = document.getElementById('talk-line'); if (el) el.textContent = txt || '';
    var box = document.querySelector('.talk-fav-wrap');
    if (box && talkNpc) box.innerHTML = talkFavorHTML(talkNpc);
  }
  function bindTalkPanel() {
    var o = talkNpc; if (!o) return;
    var card = document.getElementById('modal-card'); if (!card) return;
    card.querySelectorAll('[data-topic]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-topic');
        var t = (o.card.topics || []).filter(function (x) { return x.id === id; })[0];
        talkSetLine(npcSpeak(o, t));
      };
    });
    card.querySelectorAll('[data-topic-act]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-topic-act');
        var a = (o.card.acts || []).filter(function (x) { return x.id === id; })[0];
        var impl = a && a.engine && NPC_ACT_IMPL[a.engine];
        var said = impl ? impl(o) : '';
        if (said === '' && !impl) { toast('此事此刻做不得。'); return; }
        talkSetLine(said || npcSmallTalk(o));
        renderStatus();
      };
    });
    var ob = document.getElementById('talk-observe');
    if (ob) ob.onclick = function () { closeModal(); observeNpc(o); };
    var gv = document.getElementById('talk-give');
    if (gv) gv.onclick = function () { openGivePanel(o); };
    var cl = document.getElementById('talk-close');
    if (cl) cl.onclick = function () { closeModal(); log(npcTalkPrefix(o) + '你与之拱手作别。', 'sys'); };
  }
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
  // ── 身份 / 势力系统（v20260826g）：政令台 + 势力图 ──
  function factionName(id){
    if(id==='义军'||id==='player') return (LF.FACTIONS&&LF.FACTIONS.player)?LF.FACTIONS.player.name:'义军';
    if(id==='汉'||id==='han') return (LF.FACTIONS&&LF.FACTIONS.han)?LF.FACTIONS.han.name:'汉室';
    var f=(LF.FACTIONS||{})[id]; return f?f.name:id;
  }
  function factionColor(id){
    if(id==='义军'||id==='player') return (LF.FACTIONS&&LF.FACTIONS.player)?LF.FACTIONS.player.color:'#3a3a3a';
    if(id==='汉'||id==='han') return (LF.FACTIONS&&LF.FACTIONS.han)?LF.FACTIONS.han.color:'#7d6a2e';
    var f=(LF.FACTIONS||{})[id]; return f?f.color:'#888';
  }
  function civilEdict(kind){
    var cid=state.room;
    if(!isCityGrid(cid)) return;
    if(cityOwnerOf(cid)!==playerFaction()){ toast('你并非此城之主，何谈政令？'); return; }
    var c=(LF.CITIES||{})[cid]||{};
    if(kind==='tax'){
      var last=(state.flags.cityTax||{})[cid];
      if(last===state.day){ toast('今日已在此征过税赋。'); return; }
      var gain=Math.round((c.pop+c.commerce)/12)+5;
      state.gold+=gain;
      state.flags.cityTax=state.flags.cityTax||{}; state.flags.cityTax[cid]=state.day;
      state.flags.cityOrder=state.flags.cityOrder||{};
      var ord=(state.flags.cityOrder[cid]!=null?state.flags.cityOrder[cid]:c.order)-4;
      state.flags.cityOrder[cid]=Math.max(0,ord);
      log('你颁下政令，差役挨户征缴。'+c.name+'岁入 💰'+gain+' 两，然胥吏扰民，治安略降。','sys');
      toast('征得 💰'+gain+' 两');
    } else if(kind==='pacify'){
      if(state.gold<20){ toast('府库空虚，无银安民。'); return; }
      state.gold-=20;
      state.flags.cityOrder=state.flags.cityOrder||{};
      var o2=(state.flags.cityOrder[cid]!=null?state.flags.cityOrder[cid]:c.order)+6;
      state.flags.cityOrder[cid]=Math.min(100,o2);
      log('你开仓赈济、张贴安民告示，'+c.name+'百姓稍安，治安渐复。','good');
      toast('安民：治安 +6');
    }
    renderStatus(); save(state); openModal('edict');
  }
  function renderEdict(){
    var cid=state.room; if(!isCityGrid(cid)) return '';
    var c=(LF.CITIES||{})[cid]||{};
    var ord=(state.flags.cityOrder&&state.flags.cityOrder[cid]!=null)?state.flags.cityOrder[cid]:c.order;
    var taxReady=(state.flags.cityTax||{})[cid]!==state.day;
    var taxTip=taxReady?('可征 💰'+(Math.round((c.pop+c.commerce)/12)+5)+' 两'):'今日已征';
    var h='';
    h+='<div class="edict-box">';
    h+='<div class="edict-h">📜 '+c.name+' · 政令台</div>';
    h+='<div class="edict-sub">官职：'+(state.title||'游侠')+'　｜　势力：'+factionName(playerFaction())+'　｜　治安：'+ord+'</div>';
    h+='<div class="edict-acts">';
    h+='<button class="btn" onclick="civilEdict(\'tax\')">💰 征税<br><span class="sub">'+taxTip+'</span></button>';
    h+='<button class="btn" onclick="civilEdict(\'pacify\')">🤝 安民<br><span class="sub">耗💰20，治安+6</span></button>';
    h+='<button class="btn" onclick="openModal(\'factionMap\')">🏴 大势<br><span class="sub">观天下势力</span></button>';
    h+='</div>';
    h+='<div class="edict-foot">立于中枢、城归你所统，方能发号。占城即得官职，聚财养士。</div>';
    h+='</div>';
    return h;
  }
  function renderFactionMap(){
    var groups={};
    var keys=Object.keys(LF.CITIES||{});
    keys.forEach(function(cid){
      var owner=cityOwnerOf(cid);
      var fid=(owner==='义军'||owner==='player')?'player':owner;
      if(!groups[fid]) groups[fid]={fid:fid, cities:[]};
      groups[fid].cities.push((LF.CITIES[cid]||{}).name||cid);
    });
    var order=['han','dongzhuo','yuanshao','caocao','sunce','liubiao','liuzhang','gongsun','matang','player'];
    var h='';
    h+='<div class="faction-map">';
    h+='<div class="fm-h">🏴 天下大势 · 群雄割据</div>';
    order.forEach(function(fid){
      var g=groups[fid]; if(!g) return;
      var f=(LF.FACTIONS||{})[fid]||{name:fid, color:'#888', desc:''};
      h+='<div class="fm-row">';
      h+='<div class="fm-lord"><span class="fm-dot" style="background:'+f.color+'"></span><b>'+f.name+'</b>'+(f.lord?'　<small>主君 '+f.lord+'</small>':'')+'</div>';
      h+='<div class="fm-cities">'+g.cities.join('、')+'</div>';
      h+='<div class="fm-desc">'+f.desc+'</div>';
      h+='</div>';
    });
    var _cl = chronicleList().slice(0, 8);   // 群雄逐鹿 · 烽火递报（v20260909o）
    if (_cl.length) {
      h += '<div class="fm-war"><div class="fm-war-h">🗞 烽火递报 · 天下易帜</div>';
      _cl.forEach(function (e) {
        var _c = e.k === 'danger' ? '#d2694a' : (e.k === 'good' ? '#86b087' : (e.k === 'war' ? '#c9a45a' : '#b9ad92'));
        h += '<div class="fm-war-i" style="color:' + _c + '"><span style="opacity:.6;">第' + e.d + '日</span>　' + escapeHtml(e.t) + '</div>';
      });
      h += '</div>';
    }
    h += '<div class="fm-foot">你治下：' + ((state.ruledCities || []).length) + ' 城　｜　官职：' + (state.title || '游侠') + '　｜　势力：' + factionName(playerFaction()) + '　｜　(攻城略地、诸侯互伐皆令版图易色)</div>';
    h+='</div>';
    return h;
  }
  // ══ 群雄逐鹿 · NPC 势力互伐与事件攻伐（v20260909o）══
  // 归属可动态变更的发动机：
  //  · 唯一写入口 conquerCity（见 city.js）——玩家攻城(siegeWin)/NPC 互伐/事件攻伐全部汇流至此；
  //  · 自动逐鹿：每次「过天」有低概率在相邻异势力城市间爆发一役，胜者易帜，写入天下大势大事记；
  //  · 事件驱动：剧情/数据脚本可随时 window.warlordBattle(cid, attackerId, opts) 指定一场攻伐。
  // 护栏（自动模式）：不攻都城(皇宫)/不灭有主势力的孤城/玩家立身之城不惊扰；
  //                 事件层经 opts.allowCapital / allowLast / allowInside 可显式破局。
  var WAR_ADJ_KM = 420;   // 邻接判距（两城城廓互为攻伐的方圆半径，公里）
  var warAdjPairs = null;
  function warKm(lng1, lat1, lng2, lat2) {
    var R = 6371, dLng = (lng2 - lng1) * Math.PI / 180, dLat = (lat2 - lat1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  function warCityAdjPairs() {
    if (warAdjPairs) return warAdjPairs;
    warAdjPairs = [];
    var C = LF.CITIES || {}, ids = Object.keys(C);
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
      var a = C[ids[i]], b = C[ids[j]];
      if (!a.pos || !b.pos || a.pos.length < 2 || b.pos.length < 2) continue;
      if (warKm(a.pos[0], a.pos[1], b.pos[0], b.pos[1]) <= WAR_ADJ_KM) warAdjPairs.push([ids[i], ids[j]]);
    }
    return warAdjPairs;
  }
  // 归属的「势力键」：玩家义旗归一为 player；其余保留数据键（未知键 = 地方群豪/无主）
  function warOwnerKey(cid) { var o = cityOwnerOf(cid); return (o === '义军' || o === 'player') ? 'player' : o; }
  function warIsLordKey(fid) { return !!(LF.FACTIONS && LF.FACTIONS[fid]) && fid !== 'han' && fid !== 'player'; }
  function warFactionName(fid) {
    if (fid === 'player') return factionName('player');
    if (fid === 'han' || fid === '汉') return factionName('han');
    var f = (LF.FACTIONS || {})[fid];
    return f ? (f.name || fid) : (fid && fid !== 'none' ? '地方群豪' : '无主之地');
  }
  function warCityPower(cid) {
    var c = (LF.CITIES || {})[cid] || {};
    var dev = 0; try { dev = cityDevOf(cid); } catch (e) {}
    return (c.wall || 40) * 1.2 + (c.pop || 40) * 0.6 + (c.commerce || 40) * 0.3 + dev * 0.06;
  }
  function warFactionTotal(fid) {
    var sum = 0, C = LF.CITIES || {}, ids = Object.keys(C);
    for (var i = 0; i < ids.length; i++) if (warOwnerKey(ids[i]) === fid) sum += warCityPower(ids[i]);
    return sum;
  }
  function warFactionCityCount(fid) {
    var n = 0, C = LF.CITIES || {}, ids = Object.keys(C);
    for (var i = 0; i < ids.length; i++) if (warOwnerKey(ids[i]) === fid) n++;
    return n;
  }
  function warInRoom(cid) { try { return !!state && state.room === cid; } catch (e) { return false; } }
  // ── 战事执行：校验过后的单役结算；返回 {win, city, atk, def} 或 null ──
  function runWarlordBattle(targetCid, attackerFid) {
    if (!state || state.dead) return null;
    var C = LF.CITIES || {}, tc = C[targetCid];
    if (!tc) return null;
    var city = tc.name || targetCid;
    var defKey = warOwnerKey(targetCid);
    var atk = warFactionTotal(attackerFid) * (0.28 + Math.random() * 0.16);   // 举国之力的一支偏师
    var def = warCityPower(targetCid) * (1.4 + Math.random() * 0.2);          // 据城而守，一夫当关
    var defReal = !!(LF.FACTIONS && LF.FACTIONS[defKey]);
    if (defReal) def += warFactionTotal(defKey) * 0.1;                        // 邻郡/本州驰援之师
    var atkRoll = atk * (0.85 + Math.random() * 0.3);
    var win = atkRoll >= def;
    if (Math.random() < 0.13) win = !win;                                     // 乱世无常，胜败难料
    if (win) conquerCity(targetCid, attackerFid, -5);
    return { win: win, city: city, atk: attackerFid, atkName: warFactionName(attackerFid), def: defKey, defName: warFactionName(defKey), wasPlayerCity: (defKey === 'player') };
  }
  function warChronicleEntry(r) {
    if (!r || !r.win) return;
    chronicle(r.atkName + '军攻取「' + r.city + '」（旧属' + r.defName + '），易帜改换门庭。', 'war');
    if (r.wasPlayerCity) chronicle('噩耗：你治下「' + r.city + '」被' + r.atkName + '军攻陷！', 'danger');
  }
  // ── 事件/剧情接口：指定一场攻伐 ──
  // 例：warlordBattle('luoyang','caocao') / warlordBattle('xuchang','dongzhuo',{allowLast:true})
  // 返回 {ok:boolean, win?:boolean, reason?:string}；攻取成功即易帜并入大事记。
  function warlordBattle(targetCid, attackerFid, opt) {
    opt = opt || {};
    var C = LF.CITIES || {};
    var tc = C[targetCid];
    if (!state || state.dead) return { ok: false, reason: '无可攻之人' };
    if (!tc) return { ok: false, reason: '此城不在版图之内' };
    if (!warIsLordKey(attackerFid)) return { ok: false, reason: '攻方须为一镇诸侯' };
    var defKey = warOwnerKey(targetCid);
    if (defKey === attackerFid) return { ok: false, reason: '同室不操戈' };
    if (opt.allowCapital !== true && tc.tier === 'capital') return { ok: false, reason: '王都重地，非举事所能轻动' };
    var defReal = !!(LF.FACTIONS && LF.FACTIONS[defKey]);
    if (opt.allowLast !== true && defReal && defKey !== 'player' && warFactionCityCount(defKey) <= 1)
      return { ok: false, reason: (warFactionName(defKey) + '仅余孤城，守军死志犹坚') };
    if (opt.allowInside !== true && warInRoom(targetCid)) return { ok: false, reason: '你正身处此城，兵锋未至' };
    var r = runWarlordBattle(targetCid, attackerFid);
    if (!r) return { ok: false, reason: '战事未起' };
    log((r.win ? '〔攻伐〕' + r.atkName + '军攻取「' + r.city + '」，' : '〔攻伐〕' + r.atkName + '军进兵「' + r.city + '」，守军力战拒之。'), r.wasPlayerCity ? 'combat' : 'sys');
    if (r.win) {
      warChronicleEntry(r);
      if (r.wasPlayerCity) {
        toast('🏴 噩耗：' + r.city + '失守！');
        if (!state.ruledCities || !state.ruledCities.length)
          log('你名下已无统辖之城——天下虽大，暂无可发号之地。', 'sys');
      }
      save(state);
    }
    return { ok: r.win, win: r.win, city: r.city, atk: attackerFid, def: r.def };
  }
  // ── 自动逐鹿：过天轮转 ──
  // 频率约为「数日一役」，胜负均入大事记由「天下大势」公示；只惊扰玩家相关战事。
  function warlordDayTick(crossings) {
    if (!state || state.dead) return;
    state.flags = state.flags || {};
    var cool = (state.flags.warCool || 0) - (crossings || 1);
    if (cool > 0) { state.flags.warCool = cool; return; }
    state.flags.warCool = 1 + Math.floor(Math.random() * 3);   // 战后暂歇数日
    if (Math.random() >= 0.45) return;                          // 半数日辰，干戈未动
    var idsAll = Object.keys(LF.CITIES || {}), counts = {};
    for (var x = 0; x < idsAll.length; x++) {   // 全域统计城数（顺带统一种子 flags.cityOwner）
      var _k = warOwnerKey(idsAll[x]);
      counts[_k] = (counts[_k] || 0) + 1;
    }
    var pairs = warCityAdjPairs(), cands = [];
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i][0], b = pairs[i][1];
      var ka = warOwnerKey(a), kb = warOwnerKey(b);
      if (ka === kb) continue;
      var ha = warIsLordKey(ka), hb = warIsLordKey(kb);
      if (!ha && !hb) continue;                                  // 两侧皆非豪强 → 无人举兵
      if (warInRoom(a) || warInRoom(b)) continue;                // 玩家立足之处，兵锋暂缓
      var dirs = [];
      if (ha) dirs.push({ atk: ka, tid: b });                    // a 之主人攻 b
      if (hb) dirs.push({ atk: kb, tid: a });
      for (var d = 0; d < dirs.length; d++) {
        var tid = dirs[d].tid, tc = (LF.CITIES || {})[tid];
        if (tc && tc.tier === 'capital') continue;               // 不攻都城（皇宫所在）
        var tkey = warOwnerKey(tid);
        var treal = !!(LF.FACTIONS && LF.FACTIONS[tkey]);
        if (treal && tkey !== 'player' && (counts[tkey] || 0) <= 1) continue; // 不灭有主孤城
        cands.push({ target: tid, atk: dirs[d].atk });
      }
    }
    if (!cands.length) return;
    var pick = cands[Math.floor(Math.random() * cands.length)];
    var r = runWarlordBattle(pick.target, pick.atk);
    if (r && r.win) {
      warChronicleEntry(r);
      if (r.wasPlayerCity) {
        log('〔噩耗〕' + r.atkName + '军攻陷你治下「' + r.city + '」！', 'combat');
        toast('🏴 噩耗：' + r.city + '失守！');
        if (!state.ruledCities || !state.ruledCities.length)
          log('你名下已无统辖之城——天下虽大，暂无可发号之地。', 'sys');
      }
      save(state);
    } else if (r && r.wasPlayerCity) {
      log('〔狼烟〕' + r.atkName + '军来犯你治下「' + r.city + '」，守军力战，未能破城。', 'sys');
    }
  }

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
      chip.innerHTML='<span class="nl-ic">'+(it.o.icon||'👤')+'</span><span class="nl-nm">'+it.o.name+'</span>';
      if(it.o.key) chip.dataset.k=it.o.key;   // 供新手目标引导高亮定位
      chip.onclick=function(e){ toggleObjExpand(e, chip, it.o, it.acts); };
      box.appendChild(chip);
    });
    enters.forEach(function(it){
      var b=BUILDINGS[it.enter.building];
      var chip=document.createElement('button'); chip.className='nl-item nl-bld';
      chip.innerHTML='<span class="nl-ic">'+(b?b.icon:'🏠')+'</span><span class="nl-nm">'+(b?b.name:it.enter.building)+'</span>';
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
    b.innerHTML='<span class="ob-ic">'+(icon||'·')+'</span><span class="ob-nm">'+name+'</span>';
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
        { icon:'🥁', label:'值更鼓', acts:[
          {label:'击鼓', icon:'🥁', fn:function(){ drumStrikeBy('kuyilao|1,0|drum'); }}
        ]}
      ]
    }
  };
  function cellInteriors(cid, x, y){ return CELL_INTERIORS[cid + '|' + x + ',' + y] || null; }
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
    log('你掬槽中水饮了几口，喉间干涸稍解（饮 +'+sip+'）。','good');
    save(state); renderStatus();
  }
  // 以水袋向槽添水：容器水倒入，槽满则溢
  function troughFillBy(key){
    var f=fxGet(key);
    if(f.water>=TROUGH_CAP){ toast('水槽已注满，添不下了。'); return; }
    var bag=packFind('shuidai');
    var bw=(bag && bag.water>0)? bag.water : 0;
    if(!bag){ toast('须先得一只水袋，方能向槽中倾水（开局随行一只，或木工台制）。'); return; }
    if(bw<=0){ toast('水袋空空——先去溪河取水再来添槽。'); return; }
    var add=Math.min(bw, TROUGH_CAP-f.water);
    f.water+=add; bag.water=bw-add;
    log('你将水袋中 '+add+' 份水倾入槽中（槽 '+f.water+' / '+TROUGH_CAP+'）。','good');
    save(state); renderStatus();
  }
  // 值更鼓：击鼓报更 + 提示距换岗；频繁击鼓惊动牢头（轻风险，不卡死）
  function drumStrikeBy(key){
    var sh=SHICHEN[state.time%12];
    var f=fxGet(key);
    f.strikes=(f.strikes||0)+1;
    log('〔咚——〕你执槌击更鼓，声震牢廊。此刻乃「'+sh+'」。营中换岗向在戌时前后，鼓声太频，牢头必生疑。','sys');
    if(f.strikes>3){ toast('鼓声连响，牢头在廊那头喝道：「作死！再敲仔细你狗腿！」'); }
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
    if(!bag){ toast('须先得一只水袋，方能向槽中倾水（开局随行一只，或木工台制）。'); return; }
    if(bw<=0){ toast('水袋空空——先去溪河取水再来添槽。'); return; }
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
    if(!bag){ toast('须先得一只水袋，方能从此槽中盛水（开局随行一只，或木工台制）。'); return; }
    var cap=bag.waterCap||10, cur=(bag.water||0);
    if(cur>=cap){ toast('水袋已满，盛不下了。'); return; }
    var take=Math.min(f.water, cap-cur);
    f.water-=take; bag.water=cur+take;
    log('你以槽中水注满水袋（水袋 '+bag.water+' / '+cap+'）。','good');
    save(state); renderStatus();
  }
  function shuicaoDrawToBag(p){
    if((p.water||0)<=0){ toast('水槽空了，无水解渴。'); return; }
    var bag=packFind('shuidai');
    if(!bag){ toast('须先得一只水袋，方能从此槽中盛水（开局随行一只，或木工台制）。'); return; }
    var cap=bag.waterCap||10, cur=(bag.water||0);
    if(cur>=cap){ toast('水袋已满，盛不下了。'); return; }
    var take=Math.min(p.water, cap-cur);
    p.water=(p.water||0)-take; bag.water=cur+take;
    log('你以槽中水注满水袋（水袋 '+bag.water+' / '+cap+'）。','good');
    save(state); renderStatus();
  }
  var CELL_NARR = {
    'kuyilao|1,0': [
      '长巷两侧铁栅森然，风从栅缝钻过，带着潮气与远处草木腥。六间牢房分列东西——东侧天字一号至三号，西侧地字一号至三号。',
      '你顺着栅廊望去，牢门皆虚掩或紧锁，囚徒们或坐或卧，目光却都朝着那几扇通往子牢房的门。'
    ]
  };
  function cellNarr(cid, x, y){ return CELL_NARR[cid + '|' + x + ',' + y] || null; }

  // 城格内部：面板中渲染「可进入子房间(doors)」与「不可进入交互物(objects)」
  // 通用地图框架（v20260910q）：罗盘=大方位去别处；面板=地点内 rooms/items；NPC 单列
  function renderCellInteriors(cid, x, y){
    var data=cellInteriors(cid, x, y); if(!data) return;
    var doors=(data.doors||[]);
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
    var objs=(data.objects||[]);
    if(objs.length){
      var oh=document.createElement('div'); oh.className='grp'; oh.textContent='交互物品'; $actions.appendChild(oh);
      objs.forEach(function(o){
        var b=mkAct('obj', o.icon||'🔧', o.label, function(e){ toggleObjExpand(e, b, o, (o.acts||[])); });
      });
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
  function recruitCompanion(key){
    var c=COMPANION_DEFS[key]; if(!c){ toast('此人不可招入队中。'); return; }
    if(!state.party) state.party=[];
    if(state.party.some(function(m){ return m.id===c.id; })){ toast(c.name+'已在队中。'); return; }
    state.party.push(Object.assign({}, c));
    if(!state.flags) state.flags={};
    if(!state.flags.recruited) state.flags.recruited={};
    state.flags.recruited[key]=true;   // 标记已招募，NPC 从场景列表中隐去
    save(state);
    if(typeof buildActions==='function') buildActions(G.ROOMS[state.room]);
    log(c.name+'抱拳道：「承蒙看得起，愿随壮士同生共死！」','good');
    toast(c.name+' 加入队伍！');
  }
  function dismissCompanion(id){
    if(!state.party) return;
    var idx=-1;
    for(var i=0;i<state.party.length;i++){ if(state.party[i].id===id){ idx=i; break; } }
    if(idx<0) return;
    var c=state.party[idx];
    state.party.splice(idx,1);
    for(var k in COMPANION_DEFS){ if(COMPANION_DEFS[k].id===id && state.flags && state.flags.recruited){ delete state.flags.recruited[k]; } }
    save(state);
    if(currentModalKind==='party') openModal('party');
    log(c.name+'与你拱手作别，转身没入人海。','sys');
    toast(c.name+' 已离队。');
  }
  function renderPartyPanel(){
    var list=(state.party||[]);
    var html='<h3>队 伍</h3>';
    if(!list.length){
      html+='<p class="tip">你孤身一人行走江湖。江湖儿女中自有可招募之人——留意 NPC 的「邀请入队」。</p>';
    }
    list.forEach(function(c){
      var arts=(c.learnedMartial||[]).map(function(aid){ var a=G.MARTIAL_ARTS.get(aid); return '<span>'+(a?a.name:aid)+'</span>'; }).join('');
      html+='<div style="border:1px solid #6b5a3a;border-radius:10px;padding:10px;margin:8px 0;background:rgba(0,0,0,.18);">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
        +   '<span style="font-weight:700;font-size:15px;">'+(c.name||'同伴')+'</span>'
        +   '<button class="btn-mini" style="background:#7d241d;border-color:#a13a2c;" onclick="LFUI.dismissCompanion(\''+c.id+'\')">解散</button>'
        + '</div>'
        + row('气血', c.hp+' / '+c.maxHp)
        + row('内力', (c.mp||0)+' / '+(c.maxMp||0))
        + row('攻击', c.atk||0)
        + row('防御', c.def||0)
        + row('身法', c.spd||0)
        + row('五行', c.element||'无')
        + '<div class="row"><span>武学</span></div><div class="skills">'+(arts||'<span>未习武学</span>')+'</div>'
        + '<p class="tip">'+((COMPANION_DEFS[c.id]||{}).desc||'每场战斗同伴满血入场，可随你一起出手。')+'</p>'
        + '</div>';
    });
    return html;
  }
  // ===== NPC 给予物品（v20260909u）：选择行囊物品给予NPC，增减好感或触发任务 =====
  var giveNpc = null;
  function openGivePanel(o){
    giveNpc = o;
    openModal('give', {npc: o});
  }
  var giveSelectedIdx = null;
  var giveQty = 1;
  function renderGivePanel(npc){
    if(!npc) return '<h3>给 予</h3><p>未指定对象。</p>';
    var grid='';
    var hasItem=false;
    for(var i=0;i<state.pack.length;i++){
      var it=state.pack[i];
      if(!it){ grid += '<div class="packcell pcell-empty"></div>'; continue; }
      hasItem=true;
      var cnt = (it.count>1)?('<span class="pcell-cnt">'+it.count+'</span>'):'';
      var qb = (it.quality)?('<span class="pcell-qbadge" style="background:'+((LF.ITEMS.QMAP[it.quality]||{}).color||'#9a948a')+'"></span>'):'';
      var sel = (giveSelectedIdx===i)?' give-selected':'';
      grid += '<div class="packcell give-item'+sel+'" data-give-idx="'+i+'">'
            + '<div class="pcell-ic">'+(it.icon||'📦')+'</div>'
            + '<div class="give-item-name">'+it.name+'</div>'
            + cnt + qb + '</div>';
    }
    // 右侧详情
    var detailHTML = '<div class="give-empty-tip">← 点选左侧物品</div>';
    var qtyHTML = '';
    var confirmHTML = '';
    if(giveSelectedIdx!=null && state.pack[giveSelectedIdx]){
      var it = state.pack[giveSelectedIdx];
      var maxQty = it.count || 1;
      if(giveQty > maxQty) giveQty = maxQty;
      if(giveQty < 1) giveQty = 1;
      detailHTML = '<div class="give-d-name">'+(it.icon||'📦')+' '+it.name+'</div>';
      // 类型 + 槽位 + 品质 + 持有数量
      var slotLabel = (it.slot && LF.ITEMS && LF.ITEMS.SLOTS && LF.ITEMS.SLOTS[it.slot]) ? LF.ITEMS.SLOTS[it.slot].label : '';
      var catText = (it.cat||'道具') + (slotLabel?(' · '+slotLabel):'') + (it.qualityName?(' · '+it.qualityName):'') + (maxQty>1?(' · 持有'+maxQty):'');
      detailHTML += '<div class="give-d-cat">'+catText+'</div>';
      if(it.cat==='装备'){
        var fields=[['atk','攻击'],['def','防御'],['spd','身法'],['hp','气血'],['mp','内息'],['wuxing','悟性']];
        var parts=[];
        fields.forEach(function(f){ var v=it[f[0]]||0; if(v) parts.push(f[1]+' +'+v); });
        if(it.packSpace) parts.push('行囊 +'+it.packSpace);
        if(parts.length) detailHTML+='<div class="give-d-line">'+parts.join(' · ')+'</div>';
      }
      if(it.desc) detailHTML+='<div class="give-d-line give-d-desc">'+it.desc+'</div>';
      var estFavor = calcGiveFavor(it) * giveQty;
      detailHTML+='<div class="give-d-favor">预计好感 +'+estFavor+'</div>';
      // 数量选择（仅堆叠物品）
      if(maxQty > 1){
        qtyHTML = '<div class="give-qty-row">'
          + '<span>赠予数量</span>'
          + '<button class="give-qty-btn" id="give-qty-minus">−</button>'
          + '<span class="give-qty-num" id="give-qty-num">'+giveQty+'</span>'
          + '<button class="give-qty-btn" id="give-qty-plus">+</button>'
          + '<button class="give-qty-all" id="give-qty-all">全部</button>'
          + '</div>';
      }
      confirmHTML = '<button class="give-confirm-btn" id="give-confirm">确认赠予 ×'+giveQty+'</button>';
    }
    return '<div class="give-panel">'
      + '<div class="give-head"><span>赠 与</span><span class="give-head-npc">'+npc.name+'</span></div>'
      + '<div class="give-body">'
      +   '<div class="give-left">'
      +     '<div class="give-col-title">行 囊</div>'
      +     '<div class="pack-scroll give-grid-scroll"><div class="pack-grid">'+grid+'</div></div>'
      +     (hasItem?'':'<div class="give-empty">行囊空空，无物可赠。</div>')
      +   '</div>'
      +   '<div class="give-right">'
      +     '<div class="give-col-title">详 情</div>'
      +     '<div class="give-detail-box">'+detailHTML+'</div>'
      +     qtyHTML
      +   '</div>'
      + '</div>'
      + '<div class="give-foot">'
      +   confirmHTML
      +   '<button class="give-cancel-btn" id="give-cancel">取 消</button>'
      + '</div>'
      + '</div>';
  }
  function giveItemToNpc(packIdx, qty){
    if(!giveNpc || !giveNpc.key) return;
    var it = state.pack[packIdx];
    if(!it) return;
    var n = qty || 1;
    var maxQty = it.count || 1;
    if(n > maxQty) n = maxQty;
    var npcKey = giveNpc.key;
    var npcName = giveNpc.name;
    // 从行囊移除物品（批量）
    if(it.count && it.count > n){ it.count -= n; } else { state.pack[packIdx]=null; }
    // 检查 onGive 触发器（任务条件）—— 传递给予数量 qty，支持累计计数
    var triggered = checkTriggers({hook:'onGive', npc:npcKey, room:state.room, item:it, qty:n});
    if(!triggered){
      // 没有特殊触发，根据物品价值增减好感（批量）
      var favor = calcGiveFavor(it) * n;
      if(!state.npcFavor) state.npcFavor = {};
      state.npcFavor[npcKey] = (state.npcFavor[npcKey]||0) + favor;
      var react = giveReaction(npcName, it, favor);
      log(react, 'npc', npcName);
      if(favor>0) log('〔'+npcName+'·好感 +'+favor+'〕','good');
      else if(favor<0) log('〔'+npcName+'·好感 '+favor+'〕','bad');
    }
    save(state);
    renderNpcList();
    giveSelectedIdx = null;
    giveQty = 1;
    // 刷新给予面板
    if(currentModalKind==='give'){
      var card=document.getElementById('modal-card');
      if(card) card.innerHTML = renderGivePanel(giveNpc);
      bindGivePanel();
    }
  }
  function calcGiveFavor(it){
    // 根据物品类型/品质计算好感度变化
    var cat = it.cat || '道具';
    var base = 1;
    if(cat==='装备'){
      var qmult = {white:1, green:3, blue:6, purple:10, orange:15};
      base = 3 + (qmult[it.quality]||1);
    } else if(cat==='药剂'){
      base = 5;
    } else if(cat==='食饵'){
      base = 2;
    } else if(cat==='素材'){
      base = 1;
    } else if(cat==='简册'){
      base = 8;
    } else if(cat==='器具'){
      base = 4;
    }
    // 贵重物品额外加成
    if(it.price && it.price>=50) base += Math.floor(it.price/50);
    return Math.min(30, base);
  }
  function giveReaction(npcName, it, favor){
    if(favor>=15) return npcName+'双眼一亮，双手接过：「壮士厚赠，在下愧不敢当！此恩铭记于心。」';
    if(favor>=8) return npcName+'面露喜色，接过物品：「多谢壮士，此物正中下怀。」';
    if(favor>=3) return npcName+'点点头收下：「有心了。」';
    if(favor>0) return npcName+'淡淡收下，未多言语。';
    return npcName+'皱了皱眉，勉强收下：「此物……也罢。」';
  }
  function bindGivePanel(){
    document.querySelectorAll('.give-item').forEach(function(el){
      el.onclick=function(){
        var idx=parseInt(el.getAttribute('data-give-idx'),10);
        giveSelectedIdx = idx;
        giveQty = 1;
        var card=document.getElementById('modal-card');
        if(card) card.innerHTML = renderGivePanel(giveNpc);
        bindGivePanel();
      };
    });
    var minus=document.getElementById('give-qty-minus');
    if(minus) minus.onclick=function(){
      if(giveQty>1){ giveQty--; refreshGiveDetail(); }
    };
    var plus=document.getElementById('give-qty-plus');
    if(plus) plus.onclick=function(){
      var it = state.pack[giveSelectedIdx];
      var maxQty = it ? (it.count||1) : 1;
      if(giveQty<maxQty){ giveQty++; refreshGiveDetail(); }
    };
    var all=document.getElementById('give-qty-all');
    if(all) all.onclick=function(){
      var it = state.pack[giveSelectedIdx];
      giveQty = it ? (it.count||1) : 1;
      refreshGiveDetail();
    };
    var confirm=document.getElementById('give-confirm');
    if(confirm) confirm.onclick=function(){
      if(giveSelectedIdx!=null) giveItemToNpc(giveSelectedIdx, giveQty);
    };
    var cancel=document.getElementById('give-cancel');
    if(cancel) cancel.onclick=closeModal;
    // 点击遮罩层关闭
    var modal=document.getElementById('modal');
    if(modal){
      modal.onclick=function(e){
        if(e.target===modal) closeModal();
      };
    }
  }
  function refreshGiveDetail(){
    var card=document.getElementById('modal-card');
    if(card) card.innerHTML = renderGivePanel(giveNpc);
    bindGivePanel();
  }
  // ===== NPC 标准操作列：交谈 / 观察 / 给予 / 攻击 + 对象自带动作 =====
  function buildNpcActions(o){
    var acts=[];
    acts.push({label:'交谈', icon:'💬', fn:function(){ if(o.key) talk(o.key); }});
    // 开场教学链（onb 未完成）期间：仅保留「交谈」，隐藏「观察」「给予」「攻击」，避免新手误触/无意义选项
    var onboarding = !!(state.flags && state.flags.onb && !state.flags.onb.done);
    if(!onboarding){
      acts.push({label:'观察', icon:'👁', fn:function(){ observeNpc(o); }});
      acts.push({label:'给予', icon:'🎁', fn:function(){ openGivePanel(o); }});
      var dangerAct=(o.actions||[]).filter(function(a){return a.danger;})[0];
      acts.push({label:'攻击', icon:'⚔', danger:true, fn:function(){
        if(dangerAct){ dangerAct.fn(); return; }
        var eid = (G.ENEMIES && G.ENEMIES[o.key]) ? o.key : (NPC_COMBAT_MAP[o.key] || null);
        if(eid && G.ENEMIES[eid]){ startCombat(eid); return; }
        log('〔'+o.name+'〕你按捺住杀机——此人并无敌意，不便妄动刀兵。','sys');
      }});
    }
    (o.actions||[]).forEach(function(a){
      if(a.danger) return;                       // 敌意动作已并入「攻击」
      if(/交谈|观察|给予/.test(a.label||'')) return;  // 去重标准项
      acts.push(a);
    });
    return acts;
  }
  function observeNpc(o){
    var key=o.key, parts=[];
    if(o.desc) parts.push(o.desc);
    if(key && G.DIALOGUES.npcs[key]) parts.push('当前态度：'+npcAttitude(key));
    else if(key && NPC_BY_KEY[key]){
      // 程序 NPC：显示身份与「你与他」的交情（每个 NPC 一本账，见 npcFavor）
      if(o.role) parts.push('身份：'+o.role);
      var _fv=npcFavor(key);
      parts.push('与你的交情：'+npcFavorTier(_fv).name+(state.npcFavor&&state.npcFavor[key]?'（'+(_fv>0?'+':'')+_fv+'）':''));
    }
    // 掉落预览：NPC 对应敌人模板有掉落表时，展示可能掉落的物资/装备（战前情报）
    var eid = (G.ENEMIES && G.ENEMIES[key]) ? key : ((NPC_COMBAT_MAP[key]||[])[0] || null);
    if(eid && G.ENEMIES[eid] && G.ENEMIES[eid].drop){
      var d=G.ENEMIES[eid].drop, dr=[];
      if(d.gold && d.gold[1]>0) dr.push('银两'+d.gold[0]+'~'+d.gold[1]);
      if(d.pot && d.pot[1]>0) dr.push('粮草'+d.pot[0]+'~'+d.pot[1]);
      (d.table||[]).forEach(function(t){ dr.push(t.name+'（'+(t.weight||0)+'%）'); });
      if(d.equip && d.equip.chance>0){
        var QR={0:['凡品','良品'],1:['凡品','精良'],2:['良品','珍稀'],3:['精良','神兵'],4:['珍稀','神兵']};
        var rng=QR[d.equip.tier]||['',''];
        dr.push((rng[0]?rng[0]+'~'+rng[1]+'装备':'装备')+'（'+(d.equip.chance||0)+'%）');
      }
      if(dr.length) parts.push('可能掉落：'+dr.join('、'));
    }
    if(!parts.length) parts.push('你凝神打量，未见异常。');
    log('〔观察·'+o.name+'〕'+parts.join('；')+'。','sys');
  }
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
    advanceTime(1);
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
      return '回'+cellDisplayName(_c[1], cellDisplayType(_c[1], +_c[2], +_c[3]));
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
      save(state); renderRoom(_c[1], true); return;
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
        var nx=_cp.x+dm[0], ny=_cp.y+dm[1];
        if(nx>=0&&nx<_m.size&&ny>=0&&ny<_m.size && canEnterCell(state.room,nx,ny)){
          goCell(state.room, nx, ny);
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
    advanceTime(1);
    log('你朝'+dir+'方行去，沿途景物渐换……'+(_extra?('（'+((WEATHERS[state.weather]||{}).n||'')+'中行路，分外耗费气力。）'):''),'sys');
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
  // ===== 郊野内容（资源 / 野兽 / 路人）=====
  // 此格仍存的野怪：玩家战后按格+野怪id 记录清剿（flags.fieldClearedMon），防反复刷同一批
  function fieldMonstersLeft(room){
    if(!room || !room.isField || !(room.monsters && room.monsters.length)) return [];
    var cleared = state.flags && state.flags.fieldClearedMon && state.flags.fieldClearedMon[room.id];
    var fled    = state.flags && state.flags.fieldFledMon    && state.flags.fieldFledMon[room.id];
    return room.monsters.filter(function(m){
      return !(cleared && cleared[m.id]) && !(fled && fled[m.id]);
    });
  }
  function fieldNarr(room){
    var out=[];
    // 方位与去向（v20260905f）：回城方向 + 出野可通何处，行军不再「盲走」
    var _fid=room.fieldId;
    if(_fid){
      var _fp=(LF.PLACES||{})[_fid]||{};
      var _fmeta=((LF.Travel&&LF.Travel.fields)||{})[_fid]||{};
      var _par=_fp.parent||_fmeta.place;
      if(_par){
        var _pn=((LF.CITIES||{})[_par]&&LF.CITIES[_par].name)?LF.CITIES[_par].name:((LF.PLACES||{})[_par]?LF.PLACES[_par].name:_par);
        var _g=_fp.gateDir||'东';
        var _back=({'北':'南','南':'北','东':'西','西':'东','东北':'西南','西南':'东北','西北':'东南','东南':'西北'})[_g]||'';
        // v20260905o 修复：原「出野」提示用整片郊野的 gateDir+neighbors，但出野出口只存在于远野边特定格、
        // 且每格仅通一个邻城（travel.js:310 cell.exits[dir]=tgt），导致提示「向北出野可至X」与罗盘（按当前格 exits）不一致。
        // 改为：优先以「当前格实际出野出口」播报；当前格无出野出口时，引导向 gateDir 深入至远野边格再出野。
        var _here=[];
        if(room.exits){
          for(var _d in room.exits){
            var _t=room.exits[_d];
            if(typeof _t==='string' && _t.indexOf('__gate__:')===0){
              var _nid=_t.split(':')[1];
              if(_nid && _nid!==_par){   // 排除回母城哨兵，仅列真正出野至邻城的出口
                var _nn=((LF.CITIES||{})[_nid]&&LF.CITIES[_nid].name)?LF.CITIES[_nid].name:((LF.PLACES||{})[_nid]?LF.PLACES[_nid].name:_nid);
                if(_nn) _here.push(_d+'至'+_nn);
              }
            }
          }
        }
        var _outs=[], _nxt=null;
        ((_fmeta.neighbors)||[]).forEach(function(n){
          var _nm=((LF.CITIES||{})[n.nid]&&LF.CITIES[n.nid].name)?LF.CITIES[n.nid].name:((LF.PLACES||{})[n.nid]?LF.PLACES[n.nid].name:null);
          if(_nm){ _outs.push(_nm); return; }
          // 多段郊野链（v20260907d）：中段的「邻居」实为下一程入口房（fld_x@r_c），按其 fieldId 取名，
          // 避免把 fld_xxx_南_2@1_2 这类房间 id 原文打进提示文案
          var _nr=G.ROOMS[n.nid], _ff=_nr&&_nr.fieldId;
          if(_ff && LF.PLACES[_ff] && LF.PLACES[_ff].name) _nxt=LF.PLACES[_ff].name;
        });
        var _txt;
        if(_here.length){
          _txt='「'+(_fp.name||'野')+'」：来路向'+_back+'，归「'+_pn+'」；此格向'+_here.join('、')+'（出野）。';
        } else if(_outs.length){
          _txt='「'+(_fp.name||'野')+'」：来路向'+_back+'，归「'+_pn+'」；向'+_g+'深入至远野边格可出野（可至 '+_outs.join(' / ')+'）。';
        } else if(_nxt){
          _txt='「'+(_fp.name||'野')+'」：来路向'+_back+'，归「'+_pn+'」；向'+_g+'深入至远野边格即入『'+_nxt+'』，再行数程当可出野。';
        } else {
          _txt='「'+(_fp.name||'野')+'」：向'+_back+'归「'+_pn+'」；其余方向似无通途，宜折返。';
        }
        out.push({t:'〔途〕'+_txt, c:'sys'});
      }
    }
    // 顶栏天候/昼夜提示（v20260905d）：让时间与天候对郊野的影响可见可感
    var _w=(WEATHERS[state.weather]||WEATHERS[0]);
    var _t=wxEff().tip;
    out.push({t:'〔天候〕'+_w.n+'·'+(isDaytime()?'昼':'夜')+(_t?('，'+_t):'，天色和朗，正宜赶路。'), c:'sys'});
    if(room.resources && room.resources.length){ room.resources.forEach(function(r){ out.push({t:'〔地利〕此处有'+r.name+'（'+r.amt+'）可采。', c:'item'}); }); }
    var mons=fieldMonstersLeft(room);
    if(mons.length){ mons.forEach(function(m){
      var _lv=(({1:'一',2:'二',3:'三'})[m.lvl||1]||'')+'阶';
      if(m.aggr==='hostile') out.push({t:'〔戒备〕'+m.name+'（'+_lv+'）逡巡于此，见你便露凶光。', c:'combat'});
      else if(m.aggr==='neutral') out.push({t:'〔野兽〕'+m.name+'（'+_lv+'）在林间徘徊，似不主动袭人。', c:'sys'});
      else out.push({t:'〔走兽〕'+m.name+'（'+_lv+'）见人便窜入草丛。', c:'sys'});
    }); }
    if(room.fieldNpcs && room.fieldNpcs.length){ room.fieldNpcs.forEach(function(n){ out.push({t:'〔路人〕'+n.name+'在此歇脚。', c:'sys'}); }); }
    var fcamps=fieldPlacedCamps(room);
    if(fcamps.length) out.push({t:'〔营地〕此处已支有'+fcamps.map(function(f){return f.name;}).join('、')+'，可就近安歇或收起带走。', c:'good'});
    if(roomIsBoatRoute(room)) out.push(isOnBoat()
      ? {t:'〔水路〕烟波浩渺，你正乘舟渡江——沿岸码头渐近。', c:'sys'}
      : {t:'〔水路〕此处为津渡水路，须「乘船渡江」方可前行。', c:'warn'});
    return out;
  }
  // ===== 渡口坐船（v20260907c）=====
  // 水路郊野（isBoatRoute，多为 port/shuizhai 起点的多段链）须乘船方可通过：
  // 玩家进入水路郊野后须先「乘船渡江」，无舟无银则只能借无主小筏（保证不卡死）。
  // 一旦登上陆地（城或非水路郊野）即自动上岸，整段水路只需乘一次船。
  var BOAT_FEE = 12;   // 渡资（银两）；持有扁舟则免
  function fieldMetaOf(room){ var fid=room&&room.fieldId; return fid?((LF.Travel&&LF.Travel.fields)||{})[fid]||((LF.PLACES||{})[fid]||{}):{}; }
  function roomIsBoatRoute(room){ return !!(room && room.isField && fieldMetaOf(room).isBoatRoute); }
  function isOnBoat(){ return !!(state.flags && state.flags.onBoat); }
  function setOnBoat(v){ state.flags=state.flags||{}; state.flags.onBoat=!!v; }
  function boatBoardAct(){
    if(isOnBoat()){ toast('你已在舟中。'); return; }
    if(packFind('zhou')){ setOnBoat(true); log('你解缆登舟，扁舟轻荡，准备渡江。','good'); }
    else if((state.gold||0) >= BOAT_FEE){ state.gold-=BOAT_FEE; setOnBoat(true); log('你付了渡资 '+BOAT_FEE+' 银，登上渡船，船夫撑篙离岸。','good'); }
    else { setOnBoat(true); log('渡口无舟可雇，你寻得一只无主小筏，亲自撑篙渡江。','sys'); }
    buildActions(G.ROOMS[state.room]); renderStatus();
  }
  function fieldActions(room){
    // 水路郊野：须乘船方可通过（已在舟中则显示已乘，未乘则给出「乘船渡江」）
    if(roomIsBoatRoute(room)){
      if(isOnBoat()) mkAct('scene','⛵','已乘舟（渡江中）', function(){ toast('你正在舟中渡江，向岸边行去即可上岸。'); });
      else mkAct('scene','🚣','乘船渡江', boatBoardAct);
    }
    if(room.resources && room.resources.length){
      room.resources.forEach(function(res){ mkAct('scene','🌿','采'+res.name, function(){ gatherField(room, res); }); });
    }
    fieldMonstersLeft(room).forEach(function(m){
      if(m.aggr==='hostile') mkAct('scene','⚔','清剿·'+m.name, function(){ startCombat([m.id], {fieldLvl:m.lvl}); });
      else if(m.aggr==='neutral') mkAct('scene','⚔','挑战'+m.name, function(){ startCombat([m.id], {fieldLvl:m.lvl}); });
      else if(m.aggr==='flee') mkAct('scene','🏹','猎取·'+m.name, function(){ huntFieldBeast(room, m); });
    });
    if(room.fieldNpcs && room.fieldNpcs.length){
      room.fieldNpcs.forEach(function(n){ mkAct('scene','💬','与'+n.name+'交谈', function(){ talkFieldNpc(room, n); }); });
    }
    if(fieldHasWater(room)) mkAct('scene','🎣','垂钓', function(){ fishField(room); });
    addFieldCamp(room);
  }
  function gatherField(room, res){
    if(!state.flags.fieldGathered) state.flags.fieldGathered={};
    if(state.flags.fieldGathered[room.id] && state.flags.fieldGathered[room.id].indexOf(res.type)>=0){ toast(res.name+'已被采尽。'); return; }
    var did = (res.item) || null;
    if(!did || !LF.ITEMS[did]){ toast(res.name+'暂无可采（物产缺失）。'); return; }
    if(!packAdd(did, 1)) return;   // 行囊满则由 packAdd 提示，此格不标记采尽，可回头再采
    state.flags.fieldGathered[room.id]=state.flags.fieldGathered[room.id]||[];
    state.flags.fieldGathered[room.id].push(res.type);
    log('你俯身采得'+LF.ITEMS[did].name+'一份，收进行囊。','good');
    save(state); buildActions(G.ROOMS[state.room]);
  }
  // 水域垂钓（v20260907a）：郊野含水域格即可下钩，钓得鲜鱼/咸鱼入包；单格单局限 4 获，鱼惊则稍后再来
  function fieldHasWater(room){
    var fid=room && room.fieldId; if(!fid) return false;
    var fp=(LF.PLACES||{})[fid]||{}; var size=fp.size||4;
    for(var r=0;r<size;r++) for(var c=0;c<size;c++){
      var rm=G.ROOMS[LF.Travel.roomId(fid,r,c)];
      if(rm && rm.water) return true;
    }
    return false;
  }
  function fishField(room){
    if(!fieldHasWater(room)){ toast('此处无水，无从下钩。'); return; }
    state.flags.fieldFished=state.flags.fieldFished||{};
    var n=(state.flags.fieldFished[room.id]||0);
    if(n>=4){ toast('此间水域鱼已受惊，稍后再来方有所得。'); return; }
    var did=(Math.random()<0.7)?'fish':'fish_dried';
    var amt=1+Math.floor(Math.random()*3);
    if(!packAdd(did, amt)) return;
    state.flags.fieldFished[room.id]=n+1;
    log('你抛竿静候，须臾竿弯——钓得'+LF.ITEMS[did].name+'×'+amt+'，收入行囊。','good');
    save(state); buildActions(G.ROOMS[state.room]);
  }
  // 猎取惊兽（aggr==='flee'，如野彘）：屏息潜行接近；成则入战（胜者照常清剿+掉落），
  // 败则惊走——按格+野怪id 记 flags.fieldFledMon，此后本格不再现身（存档持久）。
  function huntFieldBeast(room, m){
    if(state.defeated){ toast('你重伤在身，追不动猎物。'); return; }
    var es=effectiveStats ? effectiveStats() : null;
    var spd=(es && es.spd!=null) ? es.spd : ((state.spd||10));
    // 潜行成功率 = 身手基础 − 兽阶警觉 + 天候掩行 − 夜间野兽警觉
    var _wx=wxEff();
    var p=0.60 + Math.max(0, spd-20)*0.006 - ((m.lvl||1)-1)*0.06 + (_wx.hunt||0) - (isDaytime()?0:0.05);
    p=Math.min(0.85, Math.max(0.30, p));
    log('你屏息蹑足，借草木掩身缓缓向'+m.name+'靠拢……'+(isDaytime()?'':'（夜色深沉，蹑步愈轻。）'),'sys');
    if(Math.random() < p){
      log(m.name+'惊觉回首，獠牙尽露与你搏斗起来！','combat');
      startCombat([m.id], {fieldLvl:m.lvl});
      return;
    }
    if(!state.flags.fieldFledMon) state.flags.fieldFledMon={};
    var row=state.flags.fieldFledMon[room.id]; if(!row) row=state.flags.fieldFledMon[room.id]={};
    row[m.id]=1;
    save(state);
    log(m.name+'耳聪目明，趁你尚未及身便蹬地窜入密林深处，转瞬没了踪影。','sys');
    buildActions(G.ROOMS[state.room]);
  }
  function talkFieldNpc(room, n){
    if(n.type==='trader'){
      log('行商卸下担子：「壮士远来，荒野中正少个歇脚处——干粮伤药、柴薪卧席，小老儿都备了些，价好商量。」','sys');
      openModal('shop', { shop:'field_trader' });
      return;
    }
    if(n.type==='refugee'){
      var rt = (Math.random() < 0.5)
        ? '小老儿逃难至此，腹中空空，只盼太平…' + ((room && room.monsters && room.monsters.length)? '那边林子里似有歹人出没，将军路过当心。' : '将军若往南行，听说道上有商队结伴，或能捎您一程。')
        : '前路不太平，行路切记贴身藏好干粮饮水。';
      log('流民拱手叹道：「将军行行好——'+rt+'」','sys');
      return;
    }
    log('路人朝你点了点头，继续赶路。','sys');
  }
  // ===== 郊野营地（v20260905b）：帐篷/篝火/草席在野外格可支设、可收起、可按设施安歇 =====
  // 复用既有 state.placed[房间id] 放置物机制：野外格房间独立隔离；设施 key（物品 place.key）→ REST_KINDS
  var PLACE_CAMP_KIND = { campfire:'campfire', sleepmat:'sleepmat', tent:'tent' };
  var FIELD_CAMP_REST = { tent:'安歇…', campfire:'烤火取暖…', sleepmat:'躺下小睡…' };
  // 本格已支设的营地设施（含图标/名称/对应休息档位；按 帐篷>篝火>草席 排序）
  function fieldPlacedCamps(room){
    if(!room || !room.id) return [];
    var arr=(state.placed && state.placed[room.id]) || [];
    var order={tent:0, campfire:1, sleepmat:2}, out=[];
    arr.forEach(function(p){
      var k=PLACE_CAMP_KIND[p && p.key]; if(!k) return;
      var d=LF.ITEMS[p.defId] || {}; var pl=d.place || {};
      out.push({ key:p.key, kind:k, name:pl.name || d.name || p.key, icon:pl.icon || '⛺', order:order[k] });
    });
    out.sort(function(a,b){ return a.order-b.order; });
    return out;
  }
  // 行囊中可支设且本格尚未支设的营地器具（每类一例；行商处亦贩此等物）
  function carriedCampGear(room){
    if(!state.pack) return [];
    var placed={}; fieldPlacedCamps(room).forEach(function(f){ placed[f.key]=1; });
    var seen={}, out=[];
    state.pack.forEach(function(it){
      if(!it) return;
      var d=LF.ITEMS[it.defId]; if(!d || !d.place) return;
      var k=PLACE_CAMP_KIND[d.place.key]; if(!k || seen[d.place.key]) return;
      if(placed[d.place.key]) return;
      seen[d.place.key]=1;
      out.push({ key:d.place.key, defId:it.defId, kind:k, name:d.name, icon:d.place.icon || '⛺' });
    });
    return out;
  }
  // 支设某器具入本格（行囊扣除一件；随即按该档位打开安歇面板）
  function placeFieldGear(room, g){
    if(state.defeated){ toast('你重伤动弹不得，先就地打盹吧。'); openRestModal('ground'); return; }
    var tag=placedCellTag(room.id);
    state.placed=state.placed || {}; state.placed[room.id]=state.placed[room.id] || [];
    if(state.placed[room.id].some(function(o){ return o.key===g.key && placedInCell(o, room.id, tag); })){ toast('此处已支有'+g.name+'。'); return; }
    var cur=packFind(g.defId);
    if(!cur || (cur.count||1)<1){ toast('行囊中已无'+g.name+'。'); return; }
    packConsume(g.defId, 1);
    state.placed[room.id].push({ key:g.key, defId:g.defId, cell:tag });
    log('你卸下行囊，支起'+g.name+'。','good');
    afterPackChange();          // 存档 + 刷新行囊与场景（支设后场景按钮即切换为设施）
    openRestModal(g.kind);
  }
  // 郊野格场景的营地按钮组：
  //   已有支设设施 → 设施按钮（安歇…/收起带走），不再重复「扎营休整」；
  //   行囊有器具   → 「布设·X」按钮 + 兜底「扎营休整」（露宿）；
  //   否则         → 仅「扎营休整」。
  function addFieldCamp(room){
    var facs=fieldPlacedCamps(room);
    if(facs.length){
      facs.forEach(function(f){
        var b=mkAct('scene', f.icon, f.name, function(e){
          toggleObjExpand(e, b, {name:f.name, desc:'本格营地设施'}, [
            {label: (FIELD_CAMP_REST[f.kind] || '安歇…'), icon:'💤', fn:function(){ openRestModal(f.kind); }},
            {label:'收起带走', icon:'📦', fn:function(){ packUpPlaced(f.key); }}
          ]);
        });
      });
      return;
    }
    var carry=carriedCampGear(room);
    carry.forEach(function(g){
      mkAct('scene', g.icon, '布设·'+g.name, function(){ placeFieldGear(room, g); });
    });
    mkAct('scene','⛺','扎营休整', function(){ campInField(room); });
  }
  // 野外扎营（无设施兜底）：效率低于帐/席/篝火；格内仍有凶兽时，露宿醒转可能遭夜袭（见 doRest）
  function campInField(room){
    if(state.defeated){ toast('你重伤动弹不得，只能席地打盹。'); openRestModal('ground'); return; }
    var host=fieldMonstersLeft(room).filter(function(m){ return m.aggr==='hostile'; });
    if(host.length){
      log('〔警觉〕此格仍有'+host.map(function(m){return m.name;}).join('、')+'逡巡——荒野露宿恐遭夜袭！','combat');
    }
    openRestModal('wild');
  }
  function maybeFieldAmbush(room){
    if(state.defeated || combatMode!==null) return false;
    var hostiles=fieldMonstersLeft(room).filter(function(m){ return m.aggr==='hostile'; });
    if(!hostiles.length) return false;
    // 拦路/夜袭概率 = 55% 基准 + 天候掩蔽修正 + 入夜加成（雾雨夜里更难提防），clamp 至 [0.2,0.9]
    var _ch=0.55 + (wxEff().amb||0) + (isDaytime()?0:0.12);
    _ch=Math.max(0.2, Math.min(0.9, _ch));
    if(Math.random() < _ch){
      var ids=hostiles.map(function(m){ return m.id; });
      var ml=1; hostiles.forEach(function(m){ if((m.lvl||1)>ml) ml=m.lvl||1; });
      var label=hostiles.map(function(m){ return m.name; }).join('、');
      log('〔警觉〕'+label+(isDaytime()?('趁'+((WEATHERS[state.weather]||{}).n||'')+'天色'):'趁夜色')+'扑出，拦住去路！','combat');
      startCombat(ids, {fieldLvl:ml});
      return true;
    }
    return false;
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
    advanceTime(1);
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
    if(po) openTalkPanel(po);
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
        state.flags.recruited=state.flags.recruited||{};
        var rk=state.room+'_sol';
        if(state.flags.recruited[rk]){ log('此城军营已拨卒于你，无需再募。','sys'); break; }
        state.flags.recruited[rk]=true;
        log('你于'+((LF.CITIES[state.room]||{}).name||'城中')+'军营募得兵卒一名，编入行伍。','sys');
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
      case 'mine_dig': {
        if(!laborTick('开凿矿料')) break;   // v20260911h：开凿同样吃一个时辰，并累工分换木片
        packAdd('shitiao', 1);
        log('你挥镐凿下数块青石（获得石料×1）。','sys');
        save(state); afterPackChange();
        break;
      }
      case 'kitchen_cook': {
        if(!exert('生火造饭')) break;
        // 修正：原写作 state.energyMax（无此字段）→ 恒回退 100，会把精力上限算错；应为 state.maxEnergy
        state.energy=Math.min((state.maxEnergy||100), state.energy+8);
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
        state.energy=Math.max(0,state.energy-3);
        advanceTime(1);   // v20260911h · P3：操练同样吃一个时辰
        log('你在演武场挥汗操练了一个时辰，拳脚渐稳（精力-3）。','sys');
        renderStatus(); save(state);
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
        advanceTime(_steps);
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
        pendingSiegeCid=state.room;
        var _bg=burnedGates(state.room);
        if(_bg>0) log('城门焚毁未修，守军凭残垣据守，士气涣散！','sys');
        startCombat('city_guard', {guardMul: siegeGuardMul(state.room)});
        break;
      case 'patrol': if(!exert('深入山林')) return;
        log('你深入山林，只闻松涛与远鸟，一路无奇遇。','sys'); break;
      // ─── 教程：劳作 / 塌墙根决断（v20260911h · P3：劳作吃时辰 —— 见 laborTick）───
      case 'labor_yard': case 'farm_work': case 'haul_stones': {
        var _lm = {
          labor_yard:  ['担石劳作', '你又扛起乱石，汗如雨下。苦役营的日夜，漫长得没有尽头。'],
          farm_work:   ['下地务农', '你扶犁翻垄，日头从东头挪到头顶，垄沟里尽是汗珠。'],
          haul_stones: ['搬石料',   '你扛着石料往返奔走，肩头磨得发烫，粗布上都浸了汗碱。']
        }[id];
        if(!laborTick(_lm[0])) break;
        laborQuestTick(id);                                  // 任务进度：干了哪桩活，就记哪桩数（v20260911i）
        if(!checkTriggers({hook:'onCustom', room: state.room})) log(_lm[1],'sys');
        break;
      }
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
      case 'train_dummy':
        if(!exert('戳木人桩')) return;
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
          log('你翻找仓库：墙角倚着几把闲镐锄，竹木随手可取。若能趁郑刚打盹取一柄，挖地道线（路线2）便有了家伙。','sys');
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
        var _cost = 1 + ((_o.missCount||0) > 0 ? 1 : 0);         // 旷役补役：口粮按罚例加倍
        var _pai = packFind('lao_pai'), _have = _pai ? (_pai.count || 1) : 0;
        if(!_have){ log('〔伙房〕你手里没有「劳字木片」——去农田 / 矿坑 / 劳役场挣够工分再来。','warn'); break; }
        if(_have < _cost){ log('〔伙房〕你名下有旷役未补，口粮按罚例加倍，须 '+_cost+' 枚木片（现有 '+_have+' 枚）。','warn'); break; }
        packConsume('lao_pai', _cost); afterPackChange();
        var _hot = isMessHour();
        packAdd(_hot ? 'fan' : 'xizhou', 1); afterPackChange();
        _o.messToday = (_o.messToday||0) + 1;
        if(_hot) log('〔伙房〕'+hourLabel()+'正逢饭点：你把木片交上，大勺盛了一碗热饭热汤（劳字木片-'+_cost+' · 得干粮×1）。','good');
        else log('〔伙房〕饭点已过，灶上只剩半锅冷粥——大勺还是给了你一瓢（劳字木片-'+_cost+' · 得稀粥×1）。','sys');
        save(state);
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
          log('〔点卯〕'+hourLabel()+'——鼓声早过戌时。牢头阴沉着脸点你的名：「迟了。」','warn');
          log('你挨了三鞭（气血-'+_dmg+'），牢头记你一次晚归（营中好感-1）。明日口粮按罚例加倍。','combat');
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
      case 'spar_dummy': if(!exert('应战')) return; startCombat('dummy'); break;
      case 'spar_dog': if(!exert('逗弄野犬')) return; startCombat('stray_dog'); break;   // 犬舍练手：弱敌，专练「撤退」
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
  function actRest(){
    var sceneEl=document.getElementById('scene'); if(sceneEl){ sceneEl.classList.remove('bg-danger'); }
    clearActions();
    var esR=effectiveStats();
    state.hp=esR.maxHp; state.mp=esR.maxMp; state.energy=state.maxEnergy;
    state.food=state.maxFood; state.drink=state.maxDrink;
    if(state.defeated){ state.defeated=false; log('你缓缓起身，伤势渐愈，气力渐复……','good'); }
    else { log('你就地调息，闭目养神片刻——气血、内力、精力皆复，饥渴亦消。','env'); }
    buildActions(curRoom()); save(state); renderStatus();
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
  function outdoorRestFactor(kind){
    if(kind==='tent') return 1;
    var _r=G.ROOMS[state.room]; if(!_r || !_r.isField) return 1;
    var _t=WX_REST[state.weather]; if(!_t) return 1;
    return (_t[kind]!=null) ? _t[kind] : 1;
  }
  // 打开自由时长休息面板（设施决定效率；战败只能就地打盹）
  function openRestModal(kind){
    if(combatMode!==null){ toast('正与敌缠斗，先应敌！'); return; }
    if(state.dead){ die(); return; }
    if(state.defeated && kind!=='ground'){ toast('你重伤未愈，动弹不得，只能席地打盹。'); kind='ground'; }
    openModal('rest', {kind:kind});
  }
  // ══ 仓库系统（v20260907k）：城中仓库 30 格，可存可取；苦役营初始存有木料石料 ══
  var storageCid=null;   // 当前仓库所在城（openModal 写入）；storageSel 已随仓库簇移入 shared/core/storage.js
  // 牢中打盹场景（v20260911k）：时辰尚未启用（教学期）且人在牢里时，
  //   「歇几个时辰」这套问法本身就是个假问题 —— 更鼓还没开始走，玩家也答不上来。
  //   故改为一键「就此睡去」，睡多久由天定（见 doNap），醒来只知天光未变。
  function cellNapScene(){
    if(clockFlowing()) return false;                          // 时辰已在流动：照常走「歇息」面板
    if((restState.kind||'ground')==='ground') return false;    // 席地打盹（战败/野外）不走这一套
    if(inCellNow()) return true;                              // 牢房格 / 天字地字号子牢房
    return state.room==='camp_cell';
  }
  function renderRestPanel(){
    var kind = (restState.kind||'ground');
    var cfg = REST_KINDS[kind] || REST_KINDS.ground;
    var wxFac = outdoorRestFactor(kind);
    if(cellNapScene()){
      // 不打时长牌、不报恢复量：玩家此刻只知道「睡了」，不该知道睡了几个时辰
      return '<h3 style="text-align:center;margin:0 0 6px;">草荐 · 打盹</h3>'
        + '<p class="tip">草荐又硬又潮，翻身便窸窣作响。四下里黑得沉，也听不见更鼓——只管合眼睡去。</p>'
        + '<button class="sheet-btn" style="margin:6px 0;" id="m-rest-nap">就此睡去</button>'
        + '<button class="sheet-leave" id="m-rest-leave">收 工</button>';
    }
    // 休息时长档位：1 / 3 / 6 时辰，恢复量随时长线性增长
    var opts = [ {h:1, lb:'小憩 · 1 时辰'}, {h:3, lb:'安睡 · 3 时辰'}, {h:6, lb:'酣眠 · 6 时辰'} ];
    var esR = effectiveStats();
    function est(h){
      return '精力+'+Math.round(esR.maxEnergy*cfg.en*h*wxFac)+'　气血+'+Math.round(esR.maxHp*cfg.hp*h*wxFac)
        + (esR.maxMp>0?('　内力+'+Math.round(esR.maxMp*cfg.mp*h*wxFac)):'')
        + '　饥渴+'+Math.round(100*cfg.fd*h*wxFac)+'%';
    }
    var h = '<h3 style="text-align:center;margin:0 0 6px;">'+cfg.name+' · 歇息</h3>'
      + '<p class="tip">歇息推进时辰，恢复随长短而异；饥渴食水亦会流逝。'+est(1)+'。'
      + (wxFac<1 ? '<br><span style="color:#b8893a;">〔'+((WEATHERS[state.weather]||{}).n||'')+'〕野外无遮蔽，歇息恢复打折。</span>' : '')
      + '</p>';
    opts.forEach(function(o){
      h += '<button class="sheet-btn" style="margin:6px 0;" data-rest="'+o.h+'">'+o.lb+'<br><span style="font-size:12px;opacity:.75;">'+est(o.h)+'</span></button>';
    });
    h += '<button class="sheet-leave" id="m-rest-leave">收 工</button>';
    return h;
  }
  function bindRestPanel(){
    $card.querySelectorAll('[data-rest]').forEach(function(b){
      b.onclick=function(){ doRest(parseInt(b.getAttribute('data-rest'),10)||1); };
    });
    var np=document.getElementById('m-rest-nap'); if(np) np.onclick=function(){ doNap(); };
    var lv=document.getElementById('m-rest-leave'); if(lv) lv.onclick=closeModal;
    var ck=document.getElementById('m-rest-cook'); if(ck) ck.onclick=function(){ closeModal(); openModal('craft',{bench:'kitchen'}); };
  }
  // 执行自由时长休息：推进时间并按要求恢复（野外天候差时打折，见 outdoorRestFactor）
  function doRest(hours){
    var kind = restState.kind || 'ground';
    var cfg = REST_KINDS[kind] || REST_KINDS.ground;
    var wxFac = outdoorRestFactor(kind);
    var esR = effectiveStats();
    advanceTime(hours);
    var hpGain = Math.round(esR.maxHp*cfg.hp*hours*wxFac);
    var mpGain = esR.maxMp>0 ? Math.round(esR.maxMp*cfg.mp*hours*wxFac) : 0;
    var enGain = Math.round(esR.maxEnergy*cfg.en*hours*wxFac);
    state.hp = Math.min(esR.maxHp, (state.hp||0)+hpGain);
    if(state.mp>0) state.mp = Math.min(esR.maxMp, (state.mp||0)+mpGain);
    state.energy = Math.min(state.maxEnergy, (state.energy||0)+enGain);
    state.food = Math.min(state.maxFood, (state.food||0)+Math.round(state.maxFood*cfg.fd*hours*wxFac));
    state.drink = Math.min(state.maxDrink, (state.drink||0)+Math.round(state.maxDrink*cfg.dr*hours*wxFac));
    if(state.defeated){ state.defeated=false; }
    save(state); renderStatus();
    // v20260911k：去掉括号里那串「时辰未启／恢复折扣」的机制旁白 —— 睡前要的是一句交代，不是结算说明
    log('你在'+cfg.name+'歇了'+hours+'个时辰，气血、内力与精力渐复，饥渴也解了些。'
      +(wxFac<1?('（'+((WEATHERS[state.weather]||{}).n||'')+'天，无遮蔽处歇息费力，恢复打了折扣。）'):''),'good');
    closeModal();
    var _ambush = false;
    var _rroom = G.ROOMS[state.room];
    if(_rroom && _rroom.isField && kind!=='ground'){
      _ambush = maybeFieldAmbush(_rroom);   // 凶兽未清剿的野地扎营（无论露宿或支帐围火）醒转皆可能遭袭
    }
    if(!_ambush) buildActions(G.ROOMS[state.room]);
  }
  // 牢中一觉（v20260911k）：老师傅口中那句「也不知道睡了多久」——
  //   时长随机 1~3 时辰，只用来自算恢复量，绝不报给玩家；时辰未启时时钟本就冻结，
  //   醒来仍是那一线昏暗天光，昼夜不分（正是文案要传达的处境）。
  function doNap(){
    var kind = restState.kind || 'sleepmat';
    var cfg = REST_KINDS[kind] || REST_KINDS.ground;
    var wxFac = outdoorRestFactor(kind);
    var esR = effectiveStats();
    var hours = 1 + Math.floor(Math.random()*3);
    var hpGain = Math.round(esR.maxHp*cfg.hp*hours*wxFac);
    var mpGain = esR.maxMp>0 ? Math.round(esR.maxMp*cfg.mp*hours*wxFac) : 0;
    var enGain = Math.round(esR.maxEnergy*cfg.en*hours*wxFac);
    state.hp = Math.min(esR.maxHp, (state.hp||0)+hpGain);
    if(state.mp>0) state.mp = Math.min(esR.maxMp, (state.mp||0)+mpGain);
    state.energy = Math.min(state.maxEnergy, (state.energy||0)+enGain);
    state.food = Math.min(state.maxFood, (state.food||0)+Math.round(state.maxFood*cfg.fd*hours*wxFac));
    state.drink = Math.min(state.maxDrink, (state.drink||0)+Math.round(state.maxDrink*cfg.dr*hours*wxFac));
    if(state.defeated){ state.defeated=false; }
    save(state); renderStatus();
    log('你也不知睡了多久。牢里光线昏暗，分不清是黑夜还是白昼。','good');
    closeModal();
    buildActions(G.ROOMS[state.room]);
  }
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
  function itemIconHTML(it, px){
    var n = (it && (it.name || it.defId)) || '';
    var cat = (it && it.cat) || '';
    px = px || 16;
    return '<span class="ic-txt ic-cat" data-cat="'+cat+'" style="font-size:'+px+'px;"><b>'+n+'</b></span>';
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
    advanceTime(1);
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
    advanceTime(1);
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
  // 休息面板
  var restState = { kind: 'ground' };
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
  function openLearn(){
    clearActions();
    log('【修炼】案上摊开武学谱录，你凝神参悟，耗「潜能」以窥门径：','title');
    var MA=G.MARTIAL_ARTS, LINES=MA.LINES;
    var order=Object.keys(LINES).sort(function(a,b){return LINES[a].order-LINES[b].order;});
    order.forEach(function(lid){
      var line=LINES[lid];
      var list=[];
      for(var k in MA){ var a=MA[k]; if(a&&a.id&&a.line===lid&&a.type!=='technique') list.push(a); }
      if(!list.length) return;
      var head=document.createElement('div'); head.className='learn-line';
      head.innerHTML='<span class="ll-name">'+line.name+'</span><span class="ll-lv">艺线 Lv.'+(state.lines[lid]||0)+'</span>';
      $actions.appendChild(head);
      list.forEach(function(a){
        var owned=state.learnedMartial.indexOf(a.id)>=0;
        var rlm=(state.realm[a.id]||0);
        var rname=G.MARTIAL_ARTS.REALMS[rlm];
        var potCost=a.type==='ultimate'?50 : 20 + a.learn.lineMin*8 + Math.floor(a.beat/10);
        var lockLine=(state.lines[lid]||0) < a.learn.lineMin;
        var b=document.createElement('button'); b.className='act wide';
        b.title=a.desc+'（当前境界：'+rname+'）';
        if(owned){ b.innerHTML='✓ '+a.name+'（'+rname+'）'; b.disabled=true; }
        else if(lockLine){ b.innerHTML='🔒 '+a.name+'（'+line.name+'艺线需 Lv.'+a.learn.lineMin+'）'; b.disabled=true; }
        else{
          b.innerHTML='› '+a.name+(a.type==='ultimate'?' · 绝技':'')+'（耗潜能 '+potCost+'）';
          b.onclick=function(){
            if(state.pot<potCost){ log('潜能不足，难窥'+a.name+'门径。可多去历练积攒潜能。','sys'); return; }
            state.pot-=potCost; state.learnedMartial.push(a.id);
            state.lines[lid]=Math.min(20,(state.lines[lid]||0)+1);
            log('【习得】'+a.name+'！'+a.desc,'good');
            clearActions(); buildActions(curRoom()); save(state); renderStatus();
          };
        }
        $actions.appendChild(b);
      });
    });
    // 发力技巧（可嵌任意武学，单独成组）
    var techs=MA.getTechniques();
    if(techs.length){
      var th=document.createElement('div'); th.className='learn-line';
      th.innerHTML='<span class="ll-name">发力技巧</span><span class="ll-lv">装配增威</span>';
      $actions.appendChild(th);
      techs.forEach(function(a){
        var equipped=state.equippedForce.indexOf(a.id)>=0;
        var potCost=20 + a.learn.lineMin*8;
        var lockLine=(state.lines[a.line]||0) < a.learn.lineMin;
        var b=document.createElement('button'); b.className='act wide';
        b.title=a.desc;
        if(equipped){ b.innerHTML='✓ '+a.name+'（已装配）'; b.disabled=true; }
        else if(lockLine){ b.innerHTML='🔒 '+a.name+'（'+LINES[a.line].name+'艺线需 Lv.'+a.learn.lineMin+'）'; b.disabled=true; }
        else{
          b.innerHTML='› '+a.name+'（耗潜能 '+potCost+'）';
          b.onclick=function(){
            if(state.pot<potCost){ log('潜能不足，难通'+a.name+'。','sys'); return; }
            state.pot-=potCost; state.equippedForce.push(a.id);
            log('【装配】'+a.name+'！'+a.desc,'good');
            clearActions(); buildActions(curRoom()); save(state); renderStatus();
          };
        }
        $actions.appendChild(b);
      });
    }
    addBtn('返回营中', function(){ buildActions(curRoom()); });
  }

  // ===== 随机事件（含打斗氛围） =====
  function runEvent(ev){
    if(!ev) return;
    clearActions(); advanceTime(1);
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
    // ⓪ 先认行囊（v20260912f）：主角此刻身上只剩一身囚服、一副镣铐 —— 头一件事就是学会
    //    打开下方「行囊」看看自己有什么。系统介绍按「先行囊、后任务」的次序来，且
    //    没介绍到的页签一律还藏着（见 onbUnlockDock / game.css），免得一上来六个页签糊脸。
    if(!onb.packSeen) return {text:'点下方「🎒 行囊」，看看自己身上还剩些什么', targets:[{dock:'pack'}]};
    // ① 已接下差事却还没看过任务面板：先学会看「任务」（与上面的行囊教学对称）
    if(f.task && f.task.zt_accepted && !onb.questSeen) return {text:'点下方「📜 任务」，看看刚接下的差事记了些什么', targets:[{dock:'quest'}]};
    // ② 尚未出牢：叩牢门请牢头开锁（牢门是 camp_tz1 的场景物件，锚点 cell_door）
    if(!onb.cellOpen) return {text:'走到牢门口的「牢门」，点「叩门」与牢头说通，方能出牢', targets:[{act:'cell_door'}]};
    // ② 场院两件事：劳作（顺带点亮状态栏/位置页签）→ 环顾（看清几处去路）
    if(!onb.labored)  return campGoto({act:'labor_yard'},  '点「担石劳作」，先熟悉营中苦役（满三工换一枚劳字木片）', '往中军场院去，点「担石劳作」干活', 1, 1);
    if(!onb.surveyed) return campGoto({act:'survey_yard'}, '点「环顾四周」，看清场院几处去路', '往中军场院去，点「环顾四周」看清去路', 1, 1);
    // ③ 周听涛一脉：探问 → 寻一份吃食 → 交付。
    //    旧版从「探问」直接跳到「与默叔对暗号」，中间「这份吃食打哪来」整段没有交代：
    //    玩家接下差事回头再找周听涛，只因囊中无干粮而被普通交谈放行，于是反复听他说天象、无路可走（v20260912e 补）。
    if(!(f.route && f.route.crypt)){
      var tk=f.task||{}, goZT='往南回牢区（营北），进天字一号牢房寻周听涛';
      if(!tk.zt_accepted) return campGoto({npc:'zhoutingtao'},
        tk.zt_intro ? '再寻周听涛，把「寻一份吃食」的差事应下' : '回牢房·天字一号，寻那位相面的周听涛探问出营门道',
        tk.zt_intro ? '往南回牢区（营北），进天字一号牢房把差事应下' : goZT, 1, 0);
      if(packFind('fan')) return campGoto({npc:'zhoutingtao'}, '把「吃食」交予周听涛，听他说破命数', '往南回牢区，把干粮交予周听涛', 1, 0);
      // 手上有木片 → 去伙房换食；没有 → 回场院再挣一工（初次满三工还会顺带点亮行囊）
      if(packFind('lao_pai')) return campGoto({act:'mess_hall'}, '持「劳字木片」在伙房换一份吃食', '往伙房去，用「劳字木片」换一份吃食', 0, 1);
      return campGoto({act:'labor_yard'}, '周听涛要一份吃食——再「担石劳作」满三工，换一枚「劳字木片」', '往中军场院去「担石劳作」，满三工换一枚「劳字木片」', 1, 1);
    }
    // ④ 默叔：天字二号牢房对暗号
    if(!(f.task && f.task.signal)) return campGoto({npc:'moshu'}, '牢房·天字二号，与默叔对上暗号', '往南回牢区（营北），进天字二号牢房与默叔对暗号', 1, 0);
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
  // 句与句之间留「讲完一句、喘口气」的顿：这句话若照叙事区打字机速度写出来要多久，就等多久
  //（跟着设置里的「文字演出」走：调快了这里也快，设「瞬」则压根不走这条路）
  function dlgPace(s){
    var sp=(settings && settings.textSpeed>0) ? settings.textSpeed : 55;
    return Math.max(400, Math.min(2400, String(s||'').replace(/\s/g,'').length*sp));
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
  // 点帘 / 按快捷键 = 一次落定（同叙事区点字快进的手感）
  function dlgTap(){ skipTypewriter(); if(dlgSkip) dlgSkip(); }
  if($dlgVeil) $dlgVeil.addEventListener('click', dlgTap);
  if($dlgBody) $dlgBody.addEventListener('click', dlgTap);
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
      if(k===' ' || k==='Enter' || k==='Escape' || k==='ArrowDown' || (k>='1' && k<='9')){ e.preventDefault(); dlgSkip(); }
      return;
    }
    if(k>='1' && k<='9' && $dlgFoot){
      var bs=$dlgFoot.querySelectorAll('button'), b=bs[(+k)-1];
      if(b && !b.disabled){ e.preventDefault(); b.click(); }
    }
  });
  function dlgClear(){
    if(dlgTypeTimer){ clearTimeout(dlgTypeTimer); dlgTypeTimer=null; }
    dlgSkip=null; dlgStick=true;
    if($dlgBody) $dlgBody.innerHTML='';
    if($dlgFoot){ $dlgFoot.innerHTML=''; $dlgFoot.className='dlg-foot'; }
    dlgState('');
  }
  // 玩家点了某条答话：先把自己的话落进记录（像聊天记录里的「我」），再收选项、走后续
  function dlgPick(o, b){
    if(b && b.disabled) return;
    if(dlgSkip) dlgSkip();
    var me=document.createElement('p'); me.className='dlg-say me'; me.textContent=o.label;
    $dlgBody.appendChild(me);
    dlgTalk.push({who:'你', text:o.label});
    dlgStick=true; dlgScroll();
    removeTutChoices();
    if(o.fn) o.fn();
  }
  // 把这段交谈折进叙事区留痕：玩家刚在帘里逐句读过，不必再让打字机慢慢写一遍，直接落字
  function dlgEcho(){
    if(!dlgTalk.length || !$narr) return;
    for(var i=0;i<dlgTalk.length;i++){
      var it=dlgTalk[i], p=document.createElement('p');
      p.className='narr '+(it.who==='你'?'said':'npc');
      if(it.who){ var nm=document.createElement('span'); nm.className='nm'; nm.textContent=it.who+'：'; p.appendChild(nm); }
      p.appendChild(document.createTextNode(it.text));
      $narr.appendChild(p);
    }
    var sc=document.getElementById('scene'); if(sc) sc.scrollTop=sc.scrollHeight;
  }
  // echo=true：自然收尾（话说完也答完了）→ 留痕；换场景 / 开面板时收窗则不留，
  //   免得刚换到新场景，上一处的旧话又被折进新场景的叙事里。
  function dlgClose(echo){
    if(!$dlg) return;
    if(dlgTimer){ clearTimeout(dlgTimer); dlgTimer=null; }
    if(echo) dlgEcho();
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
      dlgClose(true);
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
      var btns=$dlgFoot.querySelectorAll('button');
      var dlgRelease=function(){
        for(var i=0;i<btns.length;i++) btns[i].disabled=false;
        dlgState(options.length? '请择一' : '听他说', !!options.length);
      };
      // ② 他「一句一句讲」（v20260912l）——
      //    整段话不再一次性摊开：splitSpeech(text,true) 连引号里的句子也切（他一句一句说），
      //    切出一句就落一句、**每句各自占一行**；句与句之间留出「讲完一句、喘口气」的顿，
      //    顿的长短跟着设置里的「文字演出」走（0.4~2.4s）。帘里只留最近两句（dlgTrim），
      //    像真的在听人讲话，而不是看一墙字幕。听完最后一句才放开选项；
      //    等不及就点帘（或按 1-9）直接到这段话的末态。
      //    文字演出设成「瞬（无动画）」时不摆架势，一段一次落完 —— 尊重 settings.textSpeed。
      if(text || !$dlgBody.children.length){
        if(text) dlgTalk.push({who:who, text:text});   // 留痕用（整段）
        var segs=text?splitSpeech(text, true):['……'];
        var si=0, fin=false, cur=null;
        var dlgEnd=function(){
          if(fin) return; fin=true;
          if(cur && cur.parentNode) cur.parentNode.removeChild(cur);
          cur=null; dlgTypeTimer=null; dlgSkip=null;
          dlgScroll(); dlgRelease();
        };
        // 落一整句：单独一行、整句一起出现（不再把整段堆进同一个段落）；
        // 报名字只靠帘头那方名章 —— 每句前再缀一遍「牢头：」只是纯占地方；
        // 光标只缀在正在讲的那句后面
        var dlgLine=function(){
          var s=segs[si++];
          var box=dlgNode('', text?'':'mute');
          box.say.textContent=s;
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
          dlgState('说话中…');
          var dlgStep=function(){
            var s=dlgLine();
            if(si<segs.length) dlgTypeTimer=setTimeout(dlgStep, dlgPace(s));
            else dlgEnd();
          };
          dlgSkip=function(){
            if(dlgTypeTimer){ clearTimeout(dlgTypeTimer); dlgTypeTimer=null; }
            if(si>=segs.length) return;
            while(si<segs.length) dlgLine();           // 一次到末态（帘里仍只留最近两句）
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
      case 'assault': return (state.level||1) >= 3 || !!(f.route && f.route.dummy_done);
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
      case 'assault': return '（未解锁：需战力达标——练武场练至等级≥3，或戳通木人桩）';
    }
    return '（未解锁）';
  }
  function openEscapeHub(room){
    if(document.getElementById('tut-choices')) return;
    if(state.flags && state.flags.onb && state.flags.onb.done){ log('你已逃出苦役营，不必再决断。','sys'); return; }
    // 枢纽分流（v20260912e）：旧房间体系按「墙根 / 岗哨」各列一半；城内枢纽（kuyilao 城格）列全部九条。
    //   两半合起来才是完整的「十越狱路线」——此前城内只列到墙根四条，下药/暴动/木牍/收买/强攻那五条
    //   在游戏里【没有任何入口】：(1,2) 格只注入了 wall_choose，而 gate_choose 全项目根本不存在，等于白写。
    var WALL=['crypt','tunnel','rope','drain'], GATE=['drug','riot','wooden','bribe','assault'];
    var atWall = (room==='camp_wall'), atGate = (room==='camp_gate');
    var routes = atWall ? WALL : (atGate ? GATE : WALL.concat(GATE));
    var opts=[];
    var anyOpen=false;
    routes.forEach(function(r){
      var info=ROUTE_INFO[r];
      if(escapeAvail(r)){
        anyOpen=true;
        opts.push({ label: '〔'+info.name+'〕就此出营', fn: function(){ doEscape(r, room); } });
      } else {
        opts.push({ label: '〔'+info.name+'〕'+escapeLockHint(r), fn: function(){ log('这条路子还未备妥——'+escapeLockHint(r)+'。', 'sys'); } });
      }
    });
    opts.push({ label: '再想想，先不逃', fn: function(){ log('你压下心头去意，先回营中再探探门道。','sys'); } });
    var title = atWall ? '塌墙根下，你盘算着出营的法子——'
              : atGate ? '岗哨咽喉，你思量着强出营墙的法子——'
              : '营中处处是路，你盘算着出营的法子——';
    if(!anyOpen) title += '（眼下尚无门路，去与营中众人多攀谈，或备齐所需之物）';
    tutAsk(title, opts);
  }
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
  // 升级小弹窗：替代「直接弹出角色面板」，给玩家「去加点 / 忽略」的选择
  function renderLevelup(){
    var lvl=state.level;
    var pts=state.freePoints||0;
    var maxed=lvl>=G.CONSTANTS.MAX_LEVEL;
    var banner=maxed?'功 行 圆 满':'破 境';
    var sub=maxed? ('修为已臻圆满（LV.'+lvl+'），尚有 '+pts+' 点自由属性点待分配。')
                 : ('已破境至 LV.'+lvl+'，获得 '+pts+' 点自由属性点。');
    return '<div class="levelup-pop">'+
      '<div class="lu-banner">'+banner+'</div>'+
      '<div class="lu-lv">LV.'+lvl+'</div>'+
      '<div class="lu-sub">'+sub+'</div>'+
      '<p class="tip">自由属性点可随时在角色面板分配，不必此刻决定；选「忽略」后，点状态栏或「角色」仍可回来加点。</p>'+
      '<div class="lu-btns">'+
        '<button class="btn lu-go" onclick="openModal(\'char\')">去加点</button>'+
        '<button class="btn lu-skip" onclick="closeModal()">忽略</button>'+
      '</div>'+
    '</div>';
  }

  function openModal(kind, opts){
    if(currentModalKind==='shop' && kind!=='shop') Shop.restoreTradePending();   // 离开货郎：归还寄售真物并清空购入占位
    currentModalKind=kind;
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
      var es=effectiveStats();
      h='<h3>角 色</h3>'+
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
        row('自由属性点',(state.freePoints||0))+
        '<div class="row"><span>四维（点击 ± 加点）</span></div><div class="ap-list">'+attrAllocHTML()+'</div>'+
        row('当前所处',curRoom().name)+
        '<div class="row"><span>武学</span></div><div class="skills">'+skillTags()+'</div>'+
        '<p class="tip">气血归零将殒落（回标题页读档/重开）。行止间消耗食物饮水与精力，「休整」可尽复；每升一级获得 1 点自由属性点，可在此分配。</p>';
    } else if(kind==='levelup'){
      h=renderLevelup();
    } else if(kind==='pack'){
      h=renderPack();
    } else if(kind==='give'){
      h=renderGivePanel(modalOpts.npc);
    } else if(kind==='talk'){
      h=renderTalkPanel(modalOpts.npc);
    } else if(kind==='party'){
      h=renderPartyPanel();
    } else if(kind==='quest'){
      h=renderObjectives();
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
    }
    $card.innerHTML=h;
    $card.classList.toggle('pack-card', kind==='pack' || kind==='shop' || kind==='storage' || kind==='give');
    $card.classList.toggle('give-card', kind==='give');
    $card.classList.toggle('levelup-card', kind==='levelup');
    // 捏人界面隐藏右上角 X 按钮（不可中途退出，v20260908j）
    var mx=document.getElementById('modal-x'); if(mx) mx.style.visibility=(kind==='create')?'hidden':'visible';
    if(kind==='create') bindCreate();
    if(kind==='char') bindAttrAlloc();
    if(kind==='pack'){ bindPackInteractions(); }
    if(kind==='give'){ bindGivePanel(); }
    if(kind==='talk'){ bindTalkPanel(); }
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
    // v20260912f：教学期「打开行囊 / 打开任务」本身就是教学动作 —— 记下进度并推进目标指引，
    //   否则玩家可能把这两个页签一直晾着，目标条还停在「点开看看」上。只在教学期记账，不影响正常游玩。
    if(state && state.flags && state.flags.onb && !state.flags.onb.done){
      var _onb=state.flags.onb, _onbCh=false;
      if(kind==='pack'  && !_onb.packSeen ){ _onb.packSeen =true; _onbCh=true; }
      if(kind==='quest' && !_onb.questSeen){ _onb.questSeen=true; _onbCh=true; }
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
  function initStrategicMapInGame(opts){
    opts=opts||{};
    var container=document.getElementById('strategic-map-container');
    if(!container) return;
    if(!window.LF || !LF.initStrategicMap){
      container.innerHTML='<div class="strategic-loading">战略地图加载中...</div>';
      return;
    }
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
      // 正常模式：点击城市传送；focusYou=true 时首屏自动居中「此身所在」（v20260905j）
      LF.initStrategicMap(container, {
        marks: marks,
        focusYou: !!opts.focusYou,
        ownerOf: strategicOwnerOf,
        onCityClick: function(city){
          if(!city || !city.id) return;
          placeInfo(city.id, city.name, city.kind, city.state, city.desc, city.owner, city.isPlace);
        }
      });
    }
  }

  function closeModal(){
    var _tt=document.getElementById('title'); if(_tt) _tt.classList.remove('frozen');
    if(state && state.dead){ die(); return; }
    // 捏人进行中（state 尚未建立）禁止中途收起，否则会露出标题屏并丢失进度
    if(currentModalKind==='create' && !state){ return; }
    var _pf=document.getElementById('pack-float'); if(_pf) _pf.style.display='none';
    var _sf=document.getElementById('shop-float'); if(_sf) _sf.style.display='none';
    $modal.classList.add('hidden');
    try{ SFX.close(); }catch(e){}   // 弹窗关闭音效（v20260909a）
    if(currentModalKind==='shop') Shop.restoreTradePending();   // 关店归还寄售真物，避免退出后丢失
    currentModalKind=null;   // 复位，使 afterPackChange 能区分「行囊是否仍打开」
    syncActionLock();        // 收起弹窗后重算交互锁（对话悬挂未答完则仍锁着，v20260911i）
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
  function toast(msg, ms){ if(settings.sound) tick(480); $toast.textContent=msg;$toast.classList.add('show');setTimeout(function(){$toast.classList.remove('show');},ms||1400); }

  // ── 全局桥接（v20260825b）：shared/data/build.js 等数据文件中的交互回调在全局作用域
  //    解析 openModal/log/exert/packFind…，需将游戏内部函数暴露到 window，否则建筑内面板（如铁砧打造）打开报 ReferenceError
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
  window.conquerCity=conquerCity;       // 底层直接易帜：conquerCity('城id','势力id',devDelta)（写归属+治下账目）
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
        var _tt=document.getElementById('title'); if(_tt&&_tt.classList.contains('frozen')) return; // 弹窗冻结时不再生成墨滴节点
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
      drip();
      setInterval(function(){ drip(); if(Math.random()<.25) drip(); },4200);
    }
  })();
  // v20260912n：预加载序章候选底图，全部就绪（或至多等 2.5s）后再进标题页，
  // 避免序章播放时首次加载底图造成卡顿；数组须与 playPrologue 的轮换池保持一致。
  var _pbgs=['assets/title_bg_alt1.jpg','assets/title_bg_alt2.jpg','assets/title_bg_alt3.jpg','assets/title_bg_alt4.jpg','assets/title_bg_alt5.jpg','assets/title_bg_alt6.jpg'];
  var _pbgDone=0, _pbgT0=Date.now();
  _pbgs.forEach(function(_src){ var _im=new Image(); _im.onload=function(){ _pbgDone++; }; _im.onerror=function(){ _pbgDone++; }; _im.src=_src; });
  (function _waitPbg(){
    if(_pbgDone>=_pbgs.length || Date.now()-_pbgT0>2500){
      showTitle();
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


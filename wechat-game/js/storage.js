// ==================== 乱世烽火 - 存档系统 ====================

var SAVE_KEY = 'wuxia_rpg_save';

function hasSave() {
  try {
    return !!wx.getStorageSync(SAVE_KEY);
  } catch (e) {
    return false;
  }
}

function saveGame(player, killCounts, mapDeadStates, currentMap, quests) {
  if (mapDeadStates[currentMap]) {
    // deadEnemies already in mapDeadStates
  }
  var data = {
    player: player,
    killCounts: killCounts,
    mapDeadStates: mapDeadStates,
    currentMap: currentMap,
    quests: quests,
    hermitBuffed: player.hermitBuffed
  };
  try {
    wx.setStorageSync(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

function loadGame() {
  try {
    var raw = wx.getStorageSync(SAVE_KEY);
    if (!raw) return null;

    var data = JSON.parse(raw);
    return data;
  } catch (e) {
    return null;
  }
}

function saveSettings(sfxVol, musicVol) {
  try {
    wx.setStorageSync('wuxia_settings', JSON.stringify({ sfxVol: sfxVol, musicVol: musicVol }));
  } catch (e) {}
}

function loadSettings() {
  try {
    var raw = wx.getStorageSync('wuxia_settings');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

module.exports = {
  hasSave: hasSave,
  saveGame: saveGame,
  loadGame: loadGame,
  saveSettings: saveSettings,
  loadSettings: loadSettings
};

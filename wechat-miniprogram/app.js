App({
  globalData: {
    gameState: null,
    audioEnabled: true,
    audioVolume: 0.5,
    bgmVolume: 0.3,
    sfxVolume: 0.6
  },

  onLaunch() {
    // 加载设置
    const settings = wx.getStorageSync('luanshi_settings');
    if (settings) {
      this.globalData.audioVolume = settings.audioVolume || 0.5;
      this.globalData.bgmVolume = settings.bgmVolume || 0.3;
      this.globalData.sfxVolume = settings.sfxVolume || 0.6;
      this.globalData.audioEnabled = settings.audioEnabled !== false;
    }
  }
});

// 乱世烽火 · 存档系统（v20260908f）
// 从 engine.js 抽离：存档槽读写 / 读档元信息 / 旧档迁移 / 存档字段补全(normalize)。
// 不读任何 window 裸全局——运行时上下文通过 LF.createSave(ctx) 注入，与 engine.js 解耦。
window.LF = window.LF || {};
(function () {
  LF.Core = LF.Core || {};

  // ctx = { SLOTS, G, SHICHEN, getCurSlot() }
  //   SLOTS        : 存档键数组，如 ['lf_slot_1','lf_slot_2','lf_slot_3']
  //   G            : SharedGame（提供 defaultSave / SECTS / ROOMS）
  //   SHICHEN      : 时辰名数组
  //   getCurSlot() : 返回当前档位（闭包读取，反映 enterGame/showTitle 的实时值）
  LF.createSave = function (ctx) {
    var SLOTS = ctx.SLOTS;
    var G = ctx.G;
    var SHICHEN = ctx.SHICHEN;
    var getCurSlot = ctx.getCurSlot;

    function rawSlot(slot) {
      try { return JSON.parse(localStorage.getItem(SLOTS[slot - 1])); } catch (e) { return null; }
    }
    function saveToSlot(slot, d) {
      if (!slot || !d || d.hp <= 0 || d.dead) return;
      try { localStorage.setItem(SLOTS[slot - 1], JSON.stringify(d)); } catch (e) {}
    }
    function clearSlot(slot) { try { localStorage.removeItem(SLOTS[slot - 1]); } catch (e) {} }
    function slotExists(slot) { return !!rawSlot(slot); }

    function save(d) { saveToSlot(getCurSlot(), d); }
    function load() { return rawSlot(getCurSlot()); }
    function clearSave() { var c = getCurSlot(); if (c) clearSlot(c); }

    // 读档元信息（供标题屏展示，无需全量 normalize）
    function slotMeta(slot) {
      var d = rawSlot(slot); if (!d) return { slot: slot, empty: true };
      var s = normalize(d);
      return {
        slot: slot, empty: false,
        name: s.name || '无名客',
        sect: (G.SECTS[s.sect] && G.SECTS[s.sect].name) || '江湖散人',
        rep: s.reputation || 0,
        time: SHICHEN[(s.time || 0) % 12],
        room: (G.ROOMS[s.room] && G.ROOMS[s.room].name) || '未知之地',
        day: s.day || 0
      };
    }

    // 旧存档缺字段则补默认，保证兼容（v0.1 → v0.2 迁移）
    function normalize(s) {
      var def = G.defaultSave();
      // 顶层字段补全
      for (var k in def) {
        if (s[k] === undefined) s[k] = def[k];
        // 深拷贝嵌套对象，防止引用污染
        if (typeof def[k] === 'object' && def[k] && !Array.isArray(def[k]) && k !== 'flags') {
          if (typeof s[k] !== 'object' || !s[k] || Array.isArray(s[k])) s[k] = {};
          for (var nk in def[k]) { if (s[k][nk] === undefined) s[k][nk] = def[k][nk]; }
        }
      }
      // 数组字段补默认
      if (!Array.isArray(s.learnedMartial)) s.learnedMartial = def.learnedMartial.slice();
      if (!Array.isArray(s.equippedForce)) s.equippedForce = [];
      if (!Array.isArray(s.skills)) s.skills = def.skills.slice();
      if (!Array.isArray(s.items)) s.items = [];
      if (!Array.isArray(s.equips)) s.equips = [];
      if (!s.equipment || typeof s.equipment !== 'object') s.equipment = { weapon: null, armor: null, trinket: null, mount: null };
      ['weapon', 'armor', 'trinket', 'mount'].forEach(function (sl) { if (s.equipment[sl] === undefined) s.equipment[sl] = null; });
      // 旧存档没有 spd 则给默认
      if (!s.spd) s.spd = 20;
      // time 字段
      if (s.time == null) s.time = 0;
      // clock（当日分钟）缺失时，按时辰起点还原，保证旧档时间显示对齐
      var SH_START = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
      if (s.clock == null) s.clock = (SH_START[s.time % 12] * 60) + 22;
      if (s.day == null) s.day = 0;
      if (s.weather == null) s.weather = 0;         // 天候索引，缺省为「晴」
      // 由 day 回写年号 / 年序 / 公元年（与 calendar.js·deriveCalendar 同源：1 公元年 = 360 天）
      var d = s.day || 0;
      var adYear = 183 + Math.floor(d / 360);          // 光和六年(183)起算；满 360 天进 1 公元年
      s.adYear = adYear;
      // 年号名/年中序号随公元年自动切换（184→中平…），优先用 calendar.js 暴露的同源推导
      var _en = (LF && LF.Core && LF.Core.eraNameOf) ? LF.Core.eraNameOf(adYear) : (adYear >= 184 ? '中平' : '光和');
      var _es = (LF && LF.Core && LF.Core.eraYearOf) ? LF.Core.eraYearOf(adYear) : (adYear - (adYear >= 184 ? 184 : 178) + 1);
      s.eraName = _en;
      s.eraYear = _es;
      // 确保武器艺线所有 key 存在
      for (var l in def.lines) { if (s.lines[l] === undefined) s.lines[l] = 0; }
      // 确保艺线经验 key 存在（P2）
      if (!s.lineExp || typeof s.lineExp !== 'object') s.lineExp = {};
      for (var l in def.lines) { if (s.lineExp[l] === undefined) s.lineExp[l] = 0; }
      // 确保善恶双轴存在（P3）：旧档 karma 单值迁移为 chivalry/notoriety
      if (typeof s.chivalry !== 'number') {
        s.chivalry = (typeof s.karma === 'number' && s.karma > 0) ? s.karma : 0;
      }
      if (typeof s.notoriety !== 'number') {
        s.notoriety = (typeof s.karma === 'number' && s.karma < 0) ? (-s.karma) : 0;
      }
      delete s.karma;
      // 旧档清理：已弃用的资质壳与出身
      if (s.apt) delete s.apt;
      if (s.origin) s.origin = null;
      // 四维系统迁移：旧档无 attr/freePoints/sectBonus/flatBonus 时补默认，避免 recalcBase 崩溃
      if (!s.attr || typeof s.attr !== 'object') s.attr = { hp: 5, atk: 5, def: 5, spd: 5 };
      if (typeof s.freePoints !== 'number') s.freePoints = 0;
      if (!s.sectBonus || typeof s.sectBonus !== 'object') s.sectBonus = { hp: 0, atk: 0, def: 0, spd: 0 };
      if (!s.flatBonus || typeof s.flatBonus !== 'object') s.flatBonus = { hp: 0, atk: 0, def: 0, spd: 0 };
      return s;
    }

    // 旧档迁移：v0.2.0 单键 lf_save_v1 → 第一档
    function migrateOld() {
      try {
        var old = localStorage.getItem('lf_save_v1');
        if (old && !slotExists(1)) { localStorage.setItem(SLOTS[0], old); }
        localStorage.removeItem('lf_save_v1');
      } catch (e) {}
    }

    return {
      rawSlot: rawSlot, saveToSlot: saveToSlot, clearSlot: clearSlot, slotExists: slotExists,
      save: save, load: load, clearSave: clearSave, slotMeta: slotMeta,
      normalize: normalize, migrateOld: migrateOld
    };
  };
})();

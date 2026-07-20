// 乱世烽火 · H5 存档（localStorage + 时间戳）
(function (global) {
  var KEY = 'lf_save_v1';
  function load() {
    try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  global.LF = global.LF || {};
  global.LF.Storage = { load: load, save: save, clear: clear };
})(typeof window !== 'undefined' ? window : globalThis);

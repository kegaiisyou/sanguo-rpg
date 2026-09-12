/* 山河志·地图键归一（v20260912b）
 *
 * 背景：dissolve 产出的郡面（layer:'commandery'）此前拿**中文城市名**当 id/name，
 *   而城市显示名一旦按史料化调整（建业→秣陵、许昌→许县…），地图面就再也匹配不上
 *   LF.CITIES（表现为郡名标签丢失、势力/描述取不到）。
 *
 * 做法：把郡面的 id/name 统一改成**城市拼音 id**（稳定键，与存档/路网/geojson 同源），
 *   中文显示名一律从 LF.CITIES 实时取 —— 从此改中文名不再牵连地图数据。
 *   原中文名预留到 `origName` 字段，便于回溯与旧数据迁移（含 CITY_HIST 的后世名）。
 *
 * 用法：
 *   node tools/fix_map_keys.js            # dry-run：只打印将要发生的改动
 *   node tools/fix_map_keys.js --apply    # 写入 map_regions.geojson 并重新生成 map_regions.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GEO = path.join(ROOT, 'shared/data/map_regions.geojson');
const JS = path.join(ROOT, 'shared/data/map_regions.js');
const APPLY = process.argv.indexOf('--apply') >= 0;

const CITIES = require(path.join(ROOT, 'shared/data/cities.js'));
require(path.join(ROOT, 'shared/config/constants.js'));   // 挂 LF.CITY_HIST / LF.OWNER_ALIAS
const HIST = (global.LF && global.LF.CITY_HIST) || {};
const REGIONS = (global.LF && global.LF.REGIONS) || {};

// 中文名 → 拼音 id：现行显示名 + 沿革表里的后世名（后者用于把**旧版** geojson 迁过来）
const byName = {};
Object.keys(CITIES).forEach(function (id) {
  byName[CITIES[id].name] = id;
  if (CITIES[id].comm) byName[CITIES[id].comm] = byName[CITIES[id].comm] || id;   // 郡名也接受（旧数据可能用郡名）
});
Object.keys(HIST).forEach(function (id) {
  const later = HIST[id].later;
  if (!later) return;
  later.split('/').forEach(function (n) {
    byName[n] = byName[n] || id;
    byName[n.replace(/[郡国尹]$/, '')] = byName[n.replace(/[郡国尹]$/, '')] || id;   // 「建宁郡」→ 也接受「建宁」
  });
});

const gj = JSON.parse(fs.readFileSync(GEO, 'utf8'));
const cmds = gj.features.filter(f => f.properties.layer === 'commandery');
const tierCount = gj.features.reduce(function (a, f) { a[f.properties.layer] = (a[f.properties.layer] || 0) + 1; return a; }, {});
console.log('geojson 分层：' + JSON.stringify(tierCount) + '；郡面 ' + cmds.length + ' 个');
console.log('样本属性：' + JSON.stringify(cmds[0].properties));

let changed = 0, unmapped = [];
cmds.forEach(function (f) {
  const p = f.properties;
  const orig = p.origName || p.name;
  const cid = byName[orig] || byName[p.id];
  if (!cid) { if (unmapped.indexOf(orig) < 0) unmapped.push(orig); return; }
  if (p.id === cid && p.name === cid && p.origName === orig) return;
  changed++;
  if (changed <= 12) console.log('  ' + orig + ' → ' + cid + (p.id !== orig || p.name !== orig ? '（id/name 改写）' : ''));
  if (APPLY) { p.id = cid; p.name = cid; p.origName = orig; }
});
console.log('需改动 ' + changed + ' / ' + cmds.length + ' 个郡面' + (unmapped.length ? '；未能映射: ' + unmapped.join('、') : ''));
if (!APPLY) { console.log('\n[dry-run] 加 --apply 才会写入。'); process.exit(0); }

fs.writeFileSync(GEO, JSON.stringify(gj));
console.log('[写] ' + path.relative(ROOT, GEO));

// 重新生成 script 全局版（file:// 下 fetch 会被拦，故运行时读的是 .js）
const banner = '// 本文件由 shared/data/map_regions.geojson 生成（script 全局加载，避免 file:// 下 fetch 被浏览器拦截导致山河志空白）。\n' +
  '// 修改 geojson 后请用 Node 重新生成本文件：node tools/fix_map_keys.js --apply\n' +
  '// 注：郡面的 id/name 为**城市拼音 id**（稳定键）；中文显示名请从 LF.CITIES 取，勿依赖本文件。\n';
fs.writeFileSync(JS,
  banner +
  '(function (global) {\n' +
  '  global.LF = global.LF || {};\n' +
  '  global.LF.REGIONS = ' + JSON.stringify(gj) + ';\n' +
  '})(typeof window !== "undefined" ? window : globalThis);\n');
console.log('[写] ' + path.relative(ROOT, JS));

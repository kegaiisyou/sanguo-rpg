// test/build_system_test.js
// 营造（生存建造）系统数据层自测（不依赖浏览器）
// 用法： node test/build_system_test.js
// 退出码： 0 = 全部通过，1 = 有失败
// ===========================================================================
//  覆盖：
//   - build.js 蓝图结构合法（stages 非空、每阶 need 材料有对应物品定义）
//   - 图纸物品 blueprint 字段与 LF.BUILD 中蓝图 id 一一对应
//   - 蓝图 key 在全局放置物 key 中唯一（避免与帐篷等冲突）
//   - recipes.js 木工台新增「窑烧为砖」配方，产出/材料有物品定义
// ===========================================================================
'use strict';

let fail = 0;
function check(cond, name) {
  if (cond) console.log('  ok  ' + name);
  else { fail++; console.log('  FAIL  ' + name); }
}
function section(name) { console.log('· ' + name); }

// ---- 加载共享数据（recipes.js 使用 window，Node 下补全局别名）----
global.window = global;
global.LF = global.LF || {};
require('../shared/data/items.js');
require('../shared/data/build.js');
require('../shared/data/recipes.js');
require('../shared/data/shops.js');

const ITEMS = global.LF.ITEMS;
const BUILD = global.LF.BUILD;
const RECIPES = global.LF.RECIPES;

section('蓝图数据 LF.BUILD');
const bpIds = Object.keys(BUILD);
check(bpIds.length >= 1, '至少存在一张蓝图（当前 ' + bpIds.length + ' 张）');

// 每张蓝图结构校验
const usedKeys = {};
bpIds.forEach(function (id) {
  const bp = BUILD[id];
  check(!!bp.key, '[' + id + '] 有放置 key');
  check(!!bp.siteName && !!bp.doneName, '[' + id + '] 有营造中/建成名称');
  check(!!bp.siteIcon && !!bp.doneIcon, '[' + id + '] 有营造中/建成图标');
  check(Array.isArray(bp.stages) && bp.stages.length >= 1, '[' + id + '] stages 非空');
  // 每阶材料须有物品定义
  (bp.stages || []).forEach(function (st, si) {
    check(!!st.name, '[' + id + '] 第 ' + (si + 1) + ' 阶有阶段名');
    const need = st.need || {};
    const mats = Object.keys(need);
    check(mats.length >= 1, '[' + id + '] 第 ' + (si + 1) + ' 阶「' + st.name + '」有材料需求');
    mats.forEach(function (k) {
      check(!!ITEMS[k], '[' + id + '] 材料 ' + k + ' 有物品定义');
      check(need[k] >= 1, '[' + id + '] 材料 ' + k + ' 数量 ≥1');
    });
  });
  // key 唯一性
  if (usedKeys[bp.key]) check(false, '[' + id + '] key ' + bp.key + ' 与其它蓝图重复');
  else usedKeys[bp.key] = 1;
});

section('图纸物品 → 蓝图映射');
// 每个 blueprint 物品字段必须指向存在的蓝图
Object.keys(ITEMS.DEFS || {}).forEach(function (defId) {
  const d = ITEMS.DEFS[defId];
  if (!d.blueprint) return;
  check(!!BUILD[d.blueprint], '物品 ' + defId + ' 指向的蓝图 ' + d.blueprint + ' 存在于 LF.BUILD');
  check((d.cat === '图纸'), '物品 ' + defId + ' 品类为「图纸」');
});
// 每张蓝图应至少有一个图纸物品指向它（避免死数据）
bpIds.forEach(function (id) {
  const linked = Object.keys(ITEMS.DEFS || {}).filter(function (k) { return ITEMS.DEFS[k].blueprint === id; });
  check(linked.length >= 1, '蓝图 ' + id + ' 至少有一个图纸物品（' + linked.join(',') + '）');
});

section('木工台新增「窑烧为砖」配方');
let brickRecipe = null;
(RECIPES.bench || []).forEach(function (r) { if (r.id === 'brick_kiln') brickRecipe = r; });
check(!!brickRecipe, 'bench 中存在 brick_kiln 配方');
if (brickRecipe) {
  check(brickRecipe.out === 'zhuan', '产出为 zhuan');
  check(!!ITEMS['zhuan'], 'zhuan 有物品定义');
  (brickRecipe.in || []).forEach(function (x) {
    check(!!ITEMS[x.id], '配方材料 ' + x.id + ' 有物品定义');
  });
}

section('关键材料定义');
['shitiao', 'zhuan', 'tiekuai', 'tiekuangshi'].forEach(function (k) {
  check(!!ITEMS[k], '建材 ' + k + ' 已定义');
});

section('冶炼工坊 forge 配方');
const forgeRecipes = RECIPES.forge || [];
check(forgeRecipes.length >= 3, 'forge 存在至少 3 条配方（当前 ' + forgeRecipes.length + '）');
forgeRecipes.forEach(function (r) {
  check(!!ITEMS[r.out], 'forge 配方产出 ' + r.out + ' 有物品定义');
  (r.in || []).forEach(function (x) {
    check(!!ITEMS[x.id], 'forge 配方材料 ' + x.id + ' 有物品定义');
  });
});
['tiejian', 'tiefu', 'tiema'].forEach(function (k) {
  check(!!ITEMS[k], '铁料加工产出 ' + k + ' 已定义');
});

section('货郎可购图纸与建材');
const pedlar = global.LF.SHOPS && global.LF.SHOPS.build_pedlar;
check(!!pedlar, '货郎商店存在');
if (pedlar) {
  const ids = (pedlar.items || []).map(function (x) { return x.id; });
  check(ids.indexOf('tuzhi_yeolian') >= 0, '货郎出售冶炼工坊图');
  check(ids.indexOf('shitiao') >= 0, '货郎出售石料');
  check(ids.indexOf('zhuan') >= 0, '货郎出售砖头');
}

section('敌人建材掉落表');
require('../shared/data/enemies.js');
const EN = global.LF.ENEMIES || {};
if (EN.bandit) {
  const tbl = (EN.bandit.drop && EN.bandit.drop.table) || [];
  check(tbl.some(function (t) { return t.item === 'shitiao'; }), '山贼掉落石料');
  check(tbl.some(function (t) { return t.item === 'mutou'; }), '山贼掉落木头');
}
if (EN.bandit_chief) {
  const tbl = (EN.bandit_chief.drop && EN.bandit_chief.drop.table) || [];
  check(tbl.some(function (t) { return t.item === 'zhuan'; }), '流寇头目掉落砖头');
}

console.log(fail ? ('\n共有 ' + fail + ' 项失败') : '\n全部通过');
process.exit(fail ? 1 : 0);

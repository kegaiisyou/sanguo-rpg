#!/usr/bin/env node
/**
 * 乱世烽火 · 数据交叉引用完整性校验
 *
 * 目的：检查 shared/ 数据层与 index.html 逻辑层之间的引用是否悬空，
 *       专门针对 AI 批量生成内容最容易出错的地方——引用了不存在的
 *       物品/房间/敌人/NPC/蓝图/商店/配方/艺线 id。
 *
 * 用法：node test/cross_reference_check.js
 * 退出码：0=全部通过  1=存在 ERROR（明确悬空引用）  2=仅 WARN（疑点，需人工确认）
 *
 * 规则扩展：在下方 RULES 数组中追加 { name, run(ctx) } 即可，
 *           ctx 提供 data(已加载的 LF) / src(源码文本) / report()。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// ────────────────────────────────────────────────────────────
// 1. 加载 shared 数据层（模拟浏览器 window.LF 的脚本加载顺序）
// ────────────────────────────────────────────────────────────
const ctx = {
  window: null, globalThis: null, module: undefined,
  console, Date, Math, JSON, parseInt, parseFloat, isNaN, isFinite
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

const LOAD_FILES = [
  'shared/config/constants.js',
  'shared/config/ui-spec.js',
  'shared/config/balance.js',
  'shared/story/sects.js',
  'shared/story/skills.js',
  'shared/story/objectives.js',
  'shared/story/events.js',
  'shared/story/dialogues.js',
  'shared/story/rooms.js',
  'shared/story/triggers.js',
  'shared/data/martial.js',
  'shared/data/enemies.js',
  'shared/data/items.js',
  'shared/data/recipes.js',
  'shared/data/build.js',
  'shared/data/shops.js',
  'shared/shop.js',
  'shared/data/map.js',
  'shared/data/cities.js',
  'shared/data/markets.js',
  'shared/combat/engine.js',
  'shared/index.js'
];
for (const f of LOAD_FILES) {
  const p = path.join(ROOT, f);
  const code = fs.readFileSync(p, 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: f });
  } catch (e) {
    console.error(`[FATAL] 加载 ${f} 失败: ${e.message}`);
    process.exit(3);
  }
}
const LF = ctx.LF;

// 读取 index.html 源码用于调用点扫描（文本层引用）
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// 汇总所有 shared/*.js 源码，供正则提取跨文件引用
function readAllShared() {
  let all = '';
  for (const f of LOAD_FILES) all += '\n' + fs.readFileSync(path.join(ROOT, f), 'utf8');
  return all;
}
const sharedSrc = readAllShared();

// ────────────────────────────────────────────────────────────
// 2. 报告收集
// ────────────────────────────────────────────────────────────
const issues = [];
function report(level, rule, where, msg) {
  issues.push({ level, rule, where, msg });
}
function reportErr(rule, where, msg) { report('ERROR', rule, where, msg); }
function reportWarn(rule, where, msg) { report('WARN', rule, where, msg); }

// ────────────────────────────────────────────────────────────
// 3. 权威 ID 空间
// ────────────────────────────────────────────────────────────
const ITEM_IDS = new Set(Object.keys(LF.ITEMS || {}));            // 物品 defId
const MARTIAL_IDS = new Set(Object.keys(LF.MARTIAL_ARTS || {}));  // 武学 key
// 13 艺线的权威来源：defaultSave().lines 的键（shared/index.js 定义），
// 而非 martial.js 内部局部变量 LINES（未挂到 LF 上，运行时不可达）。
const LINE_IDS = new Set(Object.keys(
  (LF.SharedGame && LF.SharedGame.defaultSave && LF.SharedGame.defaultSave().lines) || {}
));
const ENEMY_IDS = new Set(Object.keys(LF.ENEMIES || {}));          // 敌人 key
const SECT_IDS = new Set(Object.keys(LF.SECTS || {}));             // 门派 key
const BUILD_IDS = new Set(Object.keys(LF.BUILD || {}));            // 蓝图 key
const SHOP_IDS = new Set(Object.keys(LF.SHOPS || {}));             // 商店 key
const RECIPE_BENCH_IDS = new Set(Object.keys(LF.RECIPES || {}));   // 配方台 key
const CITY_IDS = new Set(Object.keys(LF.CITIES || {}));            // 城市 id
const EVENT_IDS = new Set((LF.EVENTS || []).map(e => e.id));       // 事件 id
const TRIGGER_IDS = new Set((LF.TRIGGERS || []).map(t => t.id));   // 触发器 id
const FACTIONS = LF.FACTIONS || {};                                // 势力字典（挂 LF 顶层）
const CITY_OWNER = LF.CITY_OWNER || {};                            // 城市归属（挂 LF 顶层）

// NPC 权威集合 = 对话 NPC ∪ 敌人（敌人也是可交互 NPC）∪ 已知随从
const DIALOGUE_NPC_IDS = new Set(Object.keys((LF.DIALOGUES && LF.DIALOGUES.npcs) || {}));
const NPC_IDS = new Set([...DIALOGUE_NPC_IDS, ...ENEMY_IDS]);

// 房间静态集合 = 手写房间 ∪ 城市根房 ∪ 地图坐标节点
const ROOM_STATIC = new Set([
  ...Object.keys(LF.ROOMS || {}),
  ...CITY_IDS,
  ...Object.keys((LF.MAP && LF.MAP.coords) || {})
]);
// 动态房间模式：__bld__* 建筑内部房、{cid} 城市格子房
function isDynamicRoom(id) {
  if (typeof id !== 'string') return false;
  if (id.indexOf('__bld__') === 0) return true;
  // 城市格子房：如 "ji_guomen_3_2" 之类（城市 id 前缀 + 数字格子）
  for (const cid of CITY_IDS) {
    if (id.startsWith(cid + '_')) return true;
  }
  return false;
}
function roomExists(id) {
  return ROOM_STATIC.has(id) || isDynamicRoom(id);
}

// ────────────────────────────────────────────────────────────
// 4. 从源码提取调用引用的工具
//    src 可传 shared 汇总或 index.html；提取 startCombat/move/talk/…
//    bench:'x' 等函数调用字符串参数，返回 {fn, arg} 列表
// ────────────────────────────────────────────────────────────
function scanCalls(src) {
  const calls = [];
  const patterns = [
    // 敌人战斗
    { fn: 'startCombat', re: /startCombat\(\s*['"]([A-Za-z0-9_]+)['"]/g },
    // 房间移动 move('方向','房间id')
    { fn: 'move', re: /move\(\s*['"][^'"]*['"]\s*,\s*['"]([A-Za-z0-9_]+)['"]/g },
    // NPC 交谈 / 招募
    { fn: 'talk', re: /(?<![A-Za-z0-9_])talk\(\s*['"]([A-Za-z0-9_]+)['"]/g },
    { fn: 'recruitCompanion', re: /recruitCompanion\(\s*['"]([A-Za-z0-9_]+)['"]/g },
    // 商店 / 配方台 / 面板
    { fn: 'shop', re: /openModal\(\s*['"]shop['"]\s*,\s*\{[^}]*shop\s*:\s*['"]([A-Za-z0-9_]+)['"]/g },
    { fn: 'craft', re: /openModal\(\s*['"]craft['"]\s*,\s*\{[^}]*bench\s*:\s*['"]([A-Za-z0-9_]+)['"]/g },
    // 背包扣/加物品（数据层内联脚本常用）
    { fn: 'packConsume', re: /packConsume\(\s*['"]([A-Za-z0-9_]+)['"]/g },
    { fn: 'packAdd', re: /packAdd\(\s*['"]([A-Za-z0-9_]+)['"]/g },
    { fn: 'packFind', re: /packFind\(\s*['"]([A-Za-z0-9_]+)['"]/g },
    { fn: 'packGain', re: /packGain\(\s*['"]([A-Za-z0-9_]+)['"]/g },
    // 触发器 npcTalk
    { fn: 'npcTalk', re: /npcTalk\s*,\s*npc\s*:\s*['"]([A-Za-z0-9_]+)['"]/g }
  ];
  for (const p of patterns) {
    let m;
    p.re.lastIndex = 0;
    while ((m = p.re.exec(src)) !== null) calls.push({ fn: p.fn, arg: m[1] });
  }
  return calls;
}

// ────────────────────────────────────────────────────────────
// 5. 检查规则
// ────────────────────────────────────────────────────────────
const RULES = [];

// 5.1 房间出口 → 房间 id
RULES.push({
  name: '房间出口引用',
  run(ctx) {
    const rooms = ctx.data.ROOMS || {};
    for (const rid of Object.keys(rooms)) {
      const r = rooms[rid];
      const exits = (r && r.exits) || {};
      for (const dir of Object.keys(exits)) {
        const target = exits[dir];
        if (!roomExists(target)) {
          reportErr('房间出口引用', `房间 ${rid}.exits[${dir}]`, `目标房间 '${target}' 不存在（静态 ${ROOM_STATIC.size} 个房间 + 城市/建筑动态房均未命中）`);
        }
      }
    }
  }
});

// 5.2 房间 NPC 列表 → NPC/敌人 id
RULES.push({
  name: '房间NPC引用',
  run(ctx) {
    const rooms = ctx.data.ROOMS || {};
    for (const rid of Object.keys(rooms)) {
      const r = rooms[rid];
      const npcs = (r && r.npcs) || [];
      npcs.forEach((id, i) => {
        if (!NPC_IDS.has(id)) {
          const hint = hintFor(id, DIALOGUE_NPC_IDS) || '（DIALOGUES.npcs 与 ENEMIES 均无此 id）';
          reportErr('房间NPC引用', `房间 ${rid}.npcs[${i}]`, `'${id}' 无法解析${hint}`);
        }
      });
    }
  }
});

// 5.3 敌人掉落 → 物品 id
RULES.push({
  name: '敌人掉落物品',
  run(ctx) {
    const enemies = ctx.data.ENEMIES || {};
    for (const eid of Object.keys(enemies)) {
      const e = enemies[eid];
      const table = (e.drop && e.drop.table) || [];
      table.forEach((d, i) => {
        if (!ITEM_IDS.has(d.item)) {
          reportErr('敌人掉落物品', `敌人 ${eid}.drop.table[${i}]`,
            `掉落物品 '${d.item}' 未在 ITEMS 定义${hintFor(d.item, ITEM_IDS)}`);
        }
      });
    }
  }
});

// 5.4 配方 → 物品 id
RULES.push({
  name: '配方引用',
  run(ctx) {
    const recipes = ctx.data.RECIPES || {};
    for (const bench of Object.keys(recipes)) {
      (recipes[bench] || []).forEach((rc, i) => {
        if (!ITEM_IDS.has(rc.out)) {
          reportErr('配方引用', `配方 ${bench}[${i}] ${rc.id}`, `产出 '${rc.out}' 未在 ITEMS 定义`);
        }
        (rc.in || []).forEach((mat, j) => {
          if (!ITEM_IDS.has(mat.id)) {
            reportErr('配方引用', `配方 ${bench}[${i}] ${rc.id}`, `输入材料[${j}] '${mat.id}' 未在 ITEMS 定义`);
          }
        });
      });
    }
  }
});

// 5.5 商店 → 物品 id
RULES.push({
  name: '商店物品',
  run(ctx) {
    const shops = ctx.data.SHOPS || {};
    for (const sid of Object.keys(shops)) {
      (shops[sid].items || []).forEach((g, i) => {
        if (!ITEM_IDS.has(g.id)) {
          reportErr('商店物品', `商店 ${sid}.items[${i}]`, `货品 '${g.id}' 未在 ITEMS 定义`);
        }
      });
    }
  }
});

// 5.6 蓝图 → 建材 / 图纸 / 功能
RULES.push({
  name: '蓝图引用',
  run(ctx) {
    const build = ctx.data.BUILD || {};
    for (const bid of Object.keys(build)) {
      const bp = build[bid];
      (bp.stages || []).forEach((st, i) => {
        Object.keys(st.need || {}).forEach(mid => {
          if (!ITEM_IDS.has(mid)) {
            reportErr('蓝图引用', `蓝图 ${bid}.stages[${i}].need`, `建材 '${mid}' 未在 ITEMS 定义`);
          }
        });
      });
      // 城市蓝图引用图纸道具
      if (bp.tuzhi && !ITEM_IDS.has(bp.tuzhi)) {
        reportErr('蓝图引用', `蓝图 ${bid}`, `图纸道具 '${bp.tuzhi}' 未在 ITEMS 定义`);
      }
    }
  }
});

// 5.7 物品 → 蓝图（图纸物品引用蓝图）
RULES.push({
  name: '物品蓝图引用',
  run(ctx) {
    const items = ctx.data.ITEMS || {};
    for (const defId of Object.keys(items)) {
      const it = items[defId];
      if (it.blueprint && !BUILD_IDS.has(it.blueprint)) {
        reportErr('物品蓝图引用', `物品 ${defId}`, `blueprint '${it.blueprint}' 未在 BUILD 定义`);
      }
      // 装备槽位合法
      if (it.slot && it.cat === '装备') {
        const slots = (ctx.data.ITEMS && ctx.data._SLOTS) || {};
      }
    }
  }
});

// 5.8 事件 → 物品/武学/flag（give 物品）
RULES.push({
  name: '事件物品引用',
  run(ctx) {
    const events = ctx.data.EVENTS || [];
    events.forEach(ev => {
      (ev.choices || []).forEach((ch, i) => {
        const eff = ch.effect || {};
        (eff.give || []).forEach((g, j) => {
          if (!ITEM_IDS.has(g.defId)) {
            reportErr('事件物品引用', `事件 ${ev.id}.choices[${i}]`, `give[${j}] '${g.defId}' 未在 ITEMS 定义`);
          }
        });
      });
    });
  }
});

// 5.9 门派 → 起始武学
RULES.push({
  name: '门派起始武学',
  run(ctx) {
    const sects = ctx.data.SECTS || {};
    for (const sid of Object.keys(sects)) {
      (sects[sid].startingSkills || []).forEach(sk => {
        // 门派起始武学可能来自旧 skills 树或新 martial 树，两处都查
        if (!MARTIAL_IDS.has(sk) && !(ctx.data.SKILLS && ctx.data.SKILLS[sk])) {
          reportWarn('门派起始武学', `门派 ${sid}.startingSkills`, `'${sk}' 既不在 MARTIAL_ARTS 也不在 SKILLS 旧树（若为新武学命名则需修正）`);
        }
      });
    }
  }
});

// 5.10 武学 → 艺线
RULES.push({
  name: '武学艺线',
  run(ctx) {
    const arts = ctx.data.MARTIAL_ARTS || {};
    for (const aid of Object.keys(arts)) {
      const a = arts[aid];
      if (a.line && !LINE_IDS.has(a.line)) {
        reportErr('武学艺线', `武学 ${aid}`, `艺线 '${a.line}' 不在 13 艺线中`);
      }
      if (a.type && !['skill', 'ultimate', 'technique'].includes(a.type)) {
        reportWarn('武学艺线', `武学 ${aid}`, `type '${a.type}' 非标准（skill/ultimate/technique）`);
      }
    }
  }
});

// 5.11 触发器 → 房间/NPC/事件
RULES.push({
  name: '触发器引用',
  run(ctx) {
    const trigs = ctx.data.TRIGGERS || [];
    trigs.forEach(t => {
      if (t.room && !roomExists(t.room)) {
        reportWarn('触发器引用', `触发器 ${t.id}`, `room '${t.room}' 未在房间集合中（可能为动态/城市房，请确认）`);
      }
      if (t.npc && !NPC_IDS.has(t.npc)) {
        reportWarn('触发器引用', `触发器 ${t.id}`, `npc '${t.npc}' 未在 DIALOGUES/ENEMIES 中解析`);
      }
      (t.steps || []).forEach((st, i) => {
        if (st.event && !EVENT_IDS.has(st.event)) {
          reportErr('触发器引用', `触发器 ${t.id}.steps[${i}]`, `事件 '${st.event}' 未在 EVENTS 定义`);
        }
        if (st.npc && !NPC_IDS.has(st.npc)) {
          reportWarn('触发器引用', `触发器 ${t.id}.steps[${i}]`, `npc '${st.npc}' 未解析`);
        }
      });
    });
  }
});

// 5.12 源码调用点 → 敌人/房间/NPC/商店/配方台（覆盖 rooms.js/build.js/index.html）
RULES.push({
  name: '源码调用引用',
  run(ctx) {
    const allSrc = ctx.sharedSrc + '\n' + ctx.indexSrc;
    const calls = scanCalls(allSrc);
    const seen = {};
    for (const c of calls) {
      const key = c.fn + '|' + c.arg;
      if (seen[key]) continue;   // 去重（同一引用多处出现只报一次）
      seen[key] = 1;
      switch (c.fn) {
        case 'startCombat':
          if (!ENEMY_IDS.has(c.arg)) reportErr('源码调用引用', 'startCombat', `敌人 '${c.arg}' 未在 ENEMIES 定义`);
          break;
        case 'move':
          if (!roomExists(c.arg)) reportErr('源码调用引用', 'move', `目标房间 '${c.arg}' 不存在`);
          break;
        case 'talk':
        case 'recruitCompanion':
        case 'npcTalk':
          if (!NPC_IDS.has(c.arg)) {
            reportWarn('源码调用引用', c.fn, `NPC '${c.arg}' 未解析${hintFor(c.arg, DIALOGUE_NPC_IDS)}`);
          }
          break;
        case 'shop':
          if (!SHOP_IDS.has(c.arg)) reportErr('源码调用引用', 'openModal(shop)', `商店 '${c.arg}' 未在 SHOPS 定义`);
          break;
        case 'craft':
          if (!RECIPE_BENCH_IDS.has(c.arg)) reportErr('源码调用引用', 'openModal(craft)', `配方台 '${c.arg}' 未在 RECIPES 定义`);
          break;
        case 'packConsume':
        case 'packAdd':
        case 'packFind':
        case 'packGain':
          if (!ITEM_IDS.has(c.arg)) {
            reportErr('源码调用引用', c.fn, `物品 '${c.arg}' 未在 ITEMS 定义${hintFor(c.arg, ITEM_IDS)}`);
          }
          break;
      }
    }
  }
});

// 5.13 城市归属势力 → 势力字典（cities.owner 短名 / CITY_OWNER 值）
RULES.push({
  name: '城市势力归属',
  run(ctx) {
    // cities.owner 使用短名（yuan/lu/liu/ma/kongrong/shixie/sun），FACTIONS 用全名。
    // 常见短名 → 全名映射表：能映射的视为“有意为之”（不报），无法解析的才报。
    const SHORT_OWNER = {
      yuan: 'yuanshao', lu: 'lu', liu: 'liuzhang', ma: 'matang',
      kongrong: 'kongrong', shixie: 'shixie', sun: 'sunce', gongsun: 'gongsun',
      dongzhuo: 'dongzhuo', caocao: 'caocao', liubiao: 'liubiao', han: 'han'
    };
    const cities = ctx.data.CITIES || {};
    const unknown = [];
    for (const cid of Object.keys(cities)) {
      const own = cities[cid].owner;
      if (!own) continue;
      if (FACTIONS[own]) continue;                 // 全名直接命中
      if (SHORT_OWNER[own] && FACTIONS[SHORT_OWNER[own]]) continue; // 短名命中
      unknown.push(`${cid}→'${own}'`);
    }
    if (unknown.length) {
      reportWarn('城市势力归属', 'CITIES.owner',
        `以下城市 owner 无法映射到 FACTIONS 字典：${unknown.join('、')}`);
    }
    for (const cid of Object.keys(CITY_OWNER)) {
      const v = CITY_OWNER[cid];
      if (v !== 'han' && !FACTIONS[v]) {
        reportErr('城市势力归属', `CITY_OWNER[${cid}]`, `势力 '${v}' 不在 FACTIONS 字典`);
      }
      if (!CITY_IDS.has(cid)) {
        reportWarn('城市势力归属', `CITY_OWNER[${cid}]`, `城市 id '${cid}' 不在 CITIES（可能为旧数据残留）`);
      }
    }
  }
});

// 5.14 事件/触发器/对话 ID 唯一性
RULES.push({
  name: 'ID 唯一性',
  run(ctx) {
    const dup = (arr, label) => {
      const count = {};
      arr.forEach(id => { count[id] = (count[id] || 0) + 1; });
      Object.keys(count).forEach(id => {
        if (count[id] > 1) reportErr('ID 唯一性', label, `id '${id}' 重复出现 ${count[id]} 次`);
      });
    };
    dup((ctx.data.EVENTS || []).map(e => e.id), 'EVENTS');
    dup((ctx.data.TRIGGERS || []).map(t => t.id), 'TRIGGERS');
    dup(Object.keys(ctx.data.ITEMS || {}), 'ITEMS');
    dup(Object.keys(ctx.data.ENEMIES || {}), 'ENEMIES');
    dup(Object.keys(ctx.data.MARTIAL_ARTS || {}), 'MARTIAL_ARTS');
    dup(Object.keys(ctx.data.BUILD || {}), 'BUILD');
    dup(Object.keys(ctx.data.CITIES || {}), 'CITIES');
  }
});

// 5.15 物品装备槽位合法
RULES.push({
  name: '装备槽位',
  run(ctx) {
    const SLOTS = ctx.data._SLOTS || { hat:1, cloth:1, shoe:1, weapon:1, trinket:1, belt:1, bag:1 };
    const items = ctx.data.ITEMS || {};
    for (const defId of Object.keys(items)) {
      const it = items[defId];
      if (it.slot && !SLOTS[it.slot]) {
        reportErr('装备槽位', `物品 ${defId}`, `slot '${it.slot}' 不是合法装备槽（hat/cloth/shoe/weapon/trinket/belt/bag）`);
      }
      if (it.quality && !['white', 'green', 'blue', 'purple', 'orange'].includes(it.quality)) {
        reportWarn('装备槽位', `物品 ${defId}`, `quality '${it.quality}' 非标准品质`);
      }
    }
  }
});

// ────────────────────────────────────────────────────────────
// 6. 辅助：悬空引用的智能提示
//    优先找“子串/后缀”候选（如 kuangshi ⊂ tiekuangshi），
//    再退化到编辑距离 ≤1 的候选（如 zhou_tingtao → zhoutingtao）。
// ────────────────────────────────────────────────────────────
function hintFor(target, idSet) {
  // 1) 候选包含 target 作为子串（target 是简写/前缀缺失）——选最短包含者，最接近原词根
  let sub = null;
  for (const id of idSet) {
    if (id.includes(target) && id !== target) {
      if (!sub || id.length < sub.length) sub = id;
    }
  }
  if (sub) return `（疑为 '${sub}' 的前缀缺失/简写？）`;
  // 2) 编辑距离 ≤1
  let best = null, bestD = 1;
  for (const id of idSet) {
    const d = editDist(target, id);
    if (d <= bestD) { bestD = d; best = id; }
  }
  if (best && bestD <= 1) return `（疑为 '${best}' 的笔误？）`;
  // 3) 编辑距离 ≤2（去掉下划线后同词根的命名变体，如 zhou_tingtao vs zhoutingtao）
  best = null; bestD = 2;
  for (const id of idSet) {
    const d = editDist(target.replace(/_/g, ''), id.replace(/_/g, ''));
    if (d <= bestD) { bestD = d; best = id; }
  }
  if (best) return `（疑与 '${best}' 命名不一致？）`;
  return '';
}
function editDist(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

// ────────────────────────────────────────────────────────────
// 7. 执行
// ────────────────────────────────────────────────────────────
const ctxData = {
  data: LF,
  sharedSrc,
  indexSrc,
  reportErr, reportWarn, report
};
console.log('===== 乱世烽火 · 数据交叉引用校验 =====');
console.log(`版本 ${LF.CONSTANTS.VERSION} | 物品 ${ITEM_IDS.size} / 武学 ${MARTIAL_IDS.size} / 敌人 ${ENEMY_IDS.size} / 房间(静态) ${ROOM_STATIC.size} / 城市 ${CITY_IDS.size} / 蓝图 ${BUILD_IDS.size} / 商店 ${SHOP_IDS.size} / 配方台 ${RECIPE_BENCH_IDS.size} / 事件 ${EVENT_IDS.size} / 触发器 ${TRIGGER_IDS.size} / NPC ${NPC_IDS.size}\n`);

for (const rule of RULES) {
  try {
    rule.run(ctxData);
  } catch (e) {
    reportErr('规则执行异常', rule.name, e.message);
  }
}

// 分组输出
const errors = issues.filter(i => i.level === 'ERROR');
const warns = issues.filter(i => i.level === 'WARN');
const shown = new Set();
for (const r of RULES) {
  const hits = issues.filter(i => i.rule === r.name);
  if (!hits.length) continue;
  console.log(`\n■ ${r.name}`);
  hits.forEach(h => {
    const key = h.level + h.rule + h.where + h.msg;
    if (shown.has(key)) return;
    shown.add(key);
    console.log(`   [${h.level}] ${h.where}: ${h.msg}`);
  });
}

console.log(`\n───── 汇总 ─────`);
console.log(`  ERROR: ${errors.length} 个（明确悬空引用）`);
console.log(`  WARN : ${warns.length} 个（疑点，需人工确认）`);
console.log(`  规则 : ${RULES.length} 条`);
const code = errors.length ? 1 : (warns.length ? 2 : 0);
console.log(`  结果 : ${code === 0 ? '✅ 全部通过' : code === 1 ? '❌ 存在悬空引用' : '⚠ 存在疑点（无硬错误）'}`);
process.exit(code);

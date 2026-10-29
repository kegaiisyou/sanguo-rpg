# 药店模拟经营 · 施工蓝图（PHARMACY BLUEPRINT）

> 版本：蓝图 v1（2026-10-08）
> 上游：用户提供的「药店模拟经营」参考设计（8 款参考游戏机制提炼 + 四层玩法全景 + 七个小游戏 + 四分支科技树 + P0–P4）
> 定位：**施工蓝图**——细化到数据表字段、函数签名、真实文件落点与可脚本验收的断言
> 本轮范围：**只出文档，不改任何 `.js`**。文中所有「改动文件 / 函数签名」均为**规划引用**，确认后方可开工。
> 已确认的四项决策：① 三层全都要、分阶段、以经营为主轴 ② 本轮只出方案 ③ 药品数据先行、emoji 占位、PNG 后补 ④ 配药小游戏独立实现，不先抽通用判定组件。

---

## 0. 如何使用这份蓝图

> **v20261008b 已落地（第一批物品）**：药材 10 味 + 加工材料 1 味（药末）+ 成药 16 味，共 **27 件**入 `shared/data/items.js`；
> 药铺 `LF.SHOPS.doctor` 上架 **37 条**（含既有），全部可买可卖；`energy` 补给已接（背包 / 仓库 / 详情三处）。
> 加工材料复用既有 `fengmi` 蜂蜜（蜜丸基）、`jiu` 黍酒（酒基），未重复造物。

- **① 现状盘点**（第 1 章）给出「可复用 / 需新建 / 顺手修」三张表，所有行号均已实测核实。
- **② 数据层**（第 3 章）是开工第一步：先补表，再写逻辑。
- **③ 施工清单**（第 7 章）按 P0–P4 排列，每阶段含「改动文件 + 函数签名 + 接线点 + 验收断言」，可逐阶段提交、逐阶段推 GitHub。
- **④ 风险红线**（第 9 章）必须在动手前读一遍，其中有 3 条是会导致静默崩溃的硬坑。

---

## 1. 现状盘点与差距表

### 1.1 可直接复用（不改或只加数据）

| 能力 | 真实落点 | 现状说明 |
|---|---|---|
| 药铺店铺模板 | `shared/data/build.js:457-462` `LF.TEMPLATES.yaofu` | `{name:'药铺',icon:'⚕',kind:'shop',trade:{sells:['yaofen'],buys:[],basePrice:7},bench:'alchemy',footBase:18,unlocksAt:1,seedStock:{yaofen:8}}` |
| 药铺建筑与内部 | `shared/core/building.js:114` `BUILDINGS.yaofu`（济世药铺）+ `yaofu_hou` 后堂 | 已有学徒 NPC，台词已埋「药性有寒热温凉」伏笔 |
| 盘店 / 客流 / 月结算 | `shared/core/city.js:691-712` `buyShop`、`:676-680` `shopFootfall`、`:681-689` `shopDailySettle`、`:731-751` `cityShopMonthly` | 完整闭环：客流 → 扣库存 → 营收 → 伙计补货/支薪 → 商税入 `state.gold` |
| 工作面板 | `shared/core/crafting.js:160-161` `renderCraftPanel/bindCraftPanel`，配方源 `LF.RECIPES[bench]` | `shared/data/recipes.js:43` 已有 `alchemy`（1 条 demo）、`:82` 已有 `clinic`（2 条） |
| 耗时进度条 | `shared/core/narr.js:106` `busyAct(label, ms, done)`（engine.js:408 别名） | `.bs-nm / .bs-track / .bs-bar`，配药耗时直接复用 |
| 货架 / 陈列 | `shared/shop.js:976` `contInit` / `:1048` `contPut` / `:1049` `contTake` / `:1095` `contPickup` / `:1104` `renderContainerPanel` | ⚠️ **旧 `shelf*` API 已不存在**，货架已统一走容器体系 |
| 货架格数 | `shared/data/items.js:98-106` | `shelf_wood` 8 格 / `shelf_iron` 16 格 / `shelf_carved` 24 格，`place.key:'shop_shelf'` |
| 野外采药 | `shared/systems/travel.js:88` `RES` 表 `{type:'herb', name:'草药', item:'caoyao'}` | 郊野采集草药**已通**，无需新建 |
| 药圃资源节点 | `shared/data/buildings.js:106` `LF.RES_NODE_TYPES.herb = {name:'药圃', res:'herb', build:'bp_herb', rate:4}` | 数据已预留，但 `bp_herb` 蓝图**尚未在 build.js 实现** |
| 城内农田格 | `shared/core/city.js:490`（`roll<0.68 → t='farm'`）、`shared/data/build.js:115-118` `bp_farm`（`cellType:'farm'`） | 药圃可照抄 `bp_farm` 做姊妹蓝图 |
| 名医 NPC 免改注入 | `shared/data/custom_npcs.js:21/28` → 合并在 `shared/data/npc_cards.js:349-352` | 纯数据壳，启动自动 push 进 `LF.NPC_CARDS`，**零主程序改动** |
| 顾客/名将注入 | `shared/core/npcai.js:14` `LF.createNpcAi`，`return` 于 `:394-403` | 已暴露 `eachFamous / cardOf / famousInField / driveOf / questOf / offerQuest / deliverQuest / tickDay / estateCard` 等 |
| 日切钩子 | `shared/core/engine.js:1298-1307`（跨日块，`NpcAi.tickDay()` 在 1305） | 打烊结算挂此处，与 `tickBuildOrders`（1315）同一模式 |
| 月结钩子 | `officers.js:728` → `strategy.js:457` → `engine.js:1313 onMonthTick` | 店铺月结算已在链上 |
| 声望 | `shared/core/engine.js:60` `addReputation`、`:61` `repTitle` | 口碑 / 坐堂 / 悬壶济世称号接这里 |

### 1.2 必须新建

| 项 | 建议落点 | 说明 |
|---|---|---|
| 数据六表 | 新 `shared/data/pharma.js`：`LF.HERBS / LF.MEDICINES / LF.SYMPTOMS / LF.CONSTITUTIONS / LF.PHARM_TREE / LF.PHARM_NUM` | 纯数据，无依赖，manifest 排在 `items.js` 之后、`recipes.js` 之前 |
| 药店模块 | 新 `shared/core/pharmacy.js` → `LF.createPharmacy(ctx)` | 引擎别名块接管；**必须登记 `tools/bundle.manifest`**（见 §9.2） |
| 配药小游戏模态 | 新 modal kind `'brew'` | 登记 3 处：渲染分支 `engine.js:4942-4944`（craft 分支）后、bind 分支 `engine.js:5016` 后、`closeModal` 清理 `engine.js:5333` 后 |
| 打烊结算面板 | 新 modal kind `'shopclose'`（或 `'pharmclose'`） | 同 3 处登记 |
| 药圃作物 | 改 `shared/core/farm.js:30-33` `CROPS` | ⚠️ `ctx.CROPS` 注入通道被内部 `var CROPS` 遮蔽，**只能改内部常量** |
| 药圃蓝图 | `shared/data/build.js` 新增 `bp_herb`（`cellType:'herb'`） | 兑现 `buildings.js:106` 的 `build:'bp_herb'` 引用 |
| 名医 / 坐堂 NPC | `shared/data/custom_npcs.js` 追加卡 | 华佗 / 张仲景 / 坐堂大夫 / 药农 / 牙人 |
| 科技树面板 | 新 modal kind `'pharmtree'`（或挂到既有政令台页签） | 四分支 × 四层 |

### 1.3 顺手要修（P0 开工前一并处理）

| 问题 | 落点 | 症状 |
|---|---|---|
| `_benchMeta` 缺 `alchemy` | `shared/core/crafting.js:144-150` | 药铺工作台标题渲染成裸字符串 `alchemy`，intro 为空 |
| `doCraft` 日志写死「木工台」 | `shared/core/crafting.js:209` | 配药台复用会串味 → 应取 `bm.name` |
| `mk_yaofen` 材料不合理 | `shared/data/recipes.js:44` | 草药粉用「细树枝 ×2」，应为 `caoyao` |
| `yaozhong` 不可种 | `shared/core/farm.js:30-33` | 药种物品存在（`items.js:338`）但 `CROPS` 无条目 |
| `bp_herb` 未实现 | `shared/data/build.js` | `buildings.js:106` 引用了不存在的蓝图 |
| `cityShopMonthly` 一月只跑一次 `shopDailySettle` | `shared/core/city.js:737` | `revenueDay` 实为「月营业额」；日结算需另挂日切钩子 |

---

## 2. 三层定位与阶段主线

### 2.1 三层（用户已确认「全都要，以经营为主轴」）

```
主轴  经营层：盘下济世药铺 → 药圃/采集/进货 → 配药（小游戏）→ 上架定价 → 客流 → 打烊结算
分支一 就医层：玩家作为顾客进 NPC 药铺 → 问诊（症状→选药）→ 抓药 → 疗伤
分支二 药庐层：可营造建筑（bp_herb 药圃起步）→ 自有制药据点 → 后堂/分号
```

依赖顺序：**经营层是骨，就医层是肉，药庐层是延伸**。就医层复用经营层的症状表与成药表；药庐层复用经营层的配药与科技树。

### 2.2 阶段矩阵

| 阶段 | 内容 | 产出体感 | 依赖 |
|---|---|---|---|
| **P0** | 数据六表 + 配药小游戏 + 品质三档 + 药铺模板转正 | 「药店有魂」：同样的方子，手艺人出珍品 | 无 |
| **P1** | 顾客个体 + 问诊对症 + 口碑 + 打烊结算面板 | 「一天有起伏」：早午夜三时段，打烊看账 | P0 |
| **P2** | 议价卡牌 + 抓药委托（义军急送） | 「卖药要动脑」 | P1 |
| **P3** | 药圃种植 + 鉴药 + 夜防 + 科技树四分支 | 「长线有奔头」 | P0（药圃可并行） |
| **P4** | 名医联动（华佗 / 张仲景）+ 瘟疫事件 + 《伤寒论》遗篇 | 三国红利 | P1+P3 |

**建议开工顺序**：P0 → P3-药圃（成本低、独立）→ P1 → P2 → P3-其余 → P4。

---

## 3. 数据层详细设计

> 全部新建于 `shared/data/pharma.js`，`manifest` 排在 `shared/data/items.js` 之后、`shared/data/recipes.js` 之前。
> 图标一律 emoji 占位（`icon` 字段），PNG 批次见 §9.5。

### 3.0 药品效果六轴（设计总纲）★先读

> 本节回答一个前置问题：**为什么「补血 / 回蓝」撑不起药品系统**，以及本项目里已经存在哪些无人服务的需求。
> 结论先行：方向不是「多做几种回血药」，而是让药品在**多个不可替代的轴**上生效。

#### 3.0.1 诊断：单轴必然坍缩

同一效果轴（如「回血数值」）上的商品互为**完全替代品**：玩家只会留下性价比最优的那一档，其余全部沦为废物——品类必然坍缩成 2~3 个梯度（金疮药 → 汤药），配方做得再多也只是「换皮加数值」。
要撑起丰富配方，必须让药品在**多个不可替代的轴**上生效。

#### 3.0.2 项目里已存在、但药品完全没接上的 4 个痛点

| 痛点 | 现状（已核实） | 缺口 |
|---|---|---|
| **负面状态** | `shared/data/enemies.js:229-230` 的 `eff` 已实现 `poisonChance/poisonDmg/poisonTurns`、`burnChance`、`stunChance`、`slowChance/slowTurns`；战斗 UI 已有 `u.dots[]` 与 `.dq-debuff`（`shared/core/combat.js:464`） | 敌人会下毒 / 灼烧 / 眩晕 / 减速，**但没有任何药能解**，只能硬扛 |
| **精力** | 五维 `hp / mp / energy / food / drink`；`energy` 被 farm / citybuild / 战斗 / 行军反复消耗（`farm.js:84`、`citybuild.js:90`、`combat.js:325`） | 精力是五维里**唯一没有补给**的，只能靠睡觉 |
| **天气 / 环境** | `shared/core/calendar.js:13` `WEATHERS`（含风雪雨）；`shared/core/rest.js:99` `WX_REST` 野外无遮蔽恢复打折 | 没有应对天时的药 |
| **军队** | `shared/core/army.js` 有 `morale` 0-100、`moraleMul()` 影响战力、断粮掉士气（`:339`） | 战后只有 `dead` 无伤兵；无军药 |

另有两条现成的「需求发生器」：NPC 好感系统（`shared/core/npc.js:96-120`，`state.npcFavor` + 给予面板）、战斗内可用道具入口（`combat.js:628`，当前只认 `effect.hp / mp / dmg`）。

#### 3.0.3 两条设计铁律

1. **效果越窄，价值越高。** 「回血 50」会被「回血 130」完全取代；「解蛇毒」永远不会。
2. **药品要解决「睡一觉解决不了的问题」。** hp 不足可以睡觉回满 → 回血药天然可选。一旦引入**持久负面状态**（中毒每回合掉血、眩晕跳过行动、风寒降命中），且**睡觉无法清除、只能靠药**，药品就从「可省的消耗品」变成「必需品」。

#### 3.0.4 六轴总表

| 轴 | 需求来源 | 药品 | 效果设计 | 为何不可替代 |
|---|---|---|---|---|
| **A 解状态** | 敌人下毒 / 灼烧 / 眩晕 / 减速 | 解毒丸 / 清凉散 / 醒神汤 / 活血酒 | `cure:['poison']` 等，清除指定状态或减 N 回合 | 一一对应，无替代 |
| **B 补精力** | 熬夜劳作 / 行军 / 连战 | 提神散 / 参汤 | `+energy`；参汤附带短时 `+atk` | 睡觉要花时辰，药是「用银两换时间」 |
| **C 时令防护** | 天气 / 瘴气 / 雪原 | 姜汤 / 避暑丹 / 避瘴丸 | 免疫本次环境状态（**事前服用**，持续 N 时辰） | 预防 ≠ 治疗，场景专属 |
| **D 战前增益** | 玩家主动准备 | 壮气酒 / 护心丸 / 金创膏 | 战前 `+atk` / `+def` N 回合；护心丸致命伤保 1 血 | 回血药只在残血有用，增益药**每次出门都想嗑** |
| **E 治疗**（既有轴） | 受伤 / 虚弱 | 金疮药 / 汤药 / 草药粉 | `+hp`（本轴保留，**不再新增**） | 基础保障 |
| **F 军用 / 社交** | 军团士气、名将负伤 | 军中金疮药 / 败毒散 / 上等伤药 | 战后减员 -X%；行军免疫疫病掉士气；赠药换 `addNpcFavor` | 药品成为**军需品与社交货币** |

> **经营视角的关键**：D（战前增益）是客流命根子。回血药只在「快死了」才有需求——低频、被动、可省；增益药是**每次出门前的常规采购**——高频、主动、可囤。顾客才会「点名买药」，货架与议价才有意义。

#### 3.0.5 轴与场景的分工

- **A / B / C / D 轴** → 玩家**自用**，需求由战斗、天气、时间压力产生（不进问诊）
- **E / C 轴**（民间病症）→ 顾客**问诊**小游戏（见 §3.3 症状表）
- **F 轴** → 委托 / 军团 / NPC 赠礼（见 §4.4 抓药、§5.4 名望）

### 3.1 药材表 `LF.HERBS`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 与 `LF.ITEMS` 的 `defId` 同名（药材也是物品） |
| `name` / `icon` | string | 显示名 / emoji 占位 |
| `nature` | `'寒'｜'热'｜'温'｜'凉'｜'平'` | 四性 + 平 |
| `flavor` | `'辛'｜'甘'｜'酸'｜'苦'｜'咸'` | 五味 |
| `tier` | 1-3 | 决定鉴药难度与商贩价 |
| `price` | number | 基准价（商贩收/售基准） |
| `src` | `['采集','药圃','商贩']` | 三种材料来源（对应玩法全景①） |
| `toxic` | bool（可选） | 有毒，配伍失误会出事故 |
| `desc` | string | 图鉴文本 |

示例行（含新增，emoji 占位）：

```js
LF.HERBS = {
  caoyao:  { id:'caoyao',  name:'草药',  icon:'🌿', nature:'凉', flavor:'苦',  tier:1, price:6,  src:['采集','药圃'], desc:'山野常见茎叶，性凉味苦，清热解毒。' },
  renshen: { id:'renshen', name:'人参',  icon:'🌿', nature:'温', flavor:'甘',  tier:3, price:80, src:['商贩','采集'], desc:'百草之王，大补元气，吊气续命。' },
  lingzhi: { id:'lingzhi', name:'灵芝',  icon:'🍄', nature:'平', flavor:'甘',  tier:3, price:70, src:['商贩','采集'], desc:'菌盖如云，久服延年。' },
  // —— 新增 9 味（emoji 占位，PNG 后补）——
  mahuang: { id:'mahuang', name:'麻黄',  icon:'🌾', nature:'温', flavor:'辛',  tier:1, price:7,  src:['药圃','商贩'], desc:'发汗解表，宣肺平喘。' },
  guizhi:  { id:'guizhi',  name:'桂枝',  icon:'🌿', nature:'温', flavor:'辛甘',tier:1, price:8,  src:['药圃','商贩'], desc:'温通经脉，助阳化气。' },
  shigao:  { id:'shigao',  name:'石膏',  icon:'🪨', nature:'寒', flavor:'辛甘',tier:1, price:9,  src:['商贩'],       desc:'清热泻火，除烦止渴。' },
  huanglian:{ id:'huanglian', name:'黄连', icon:'🌿', nature:'寒', flavor:'苦',  tier:2, price:18, src:['药圃','商贩'], desc:'清热燥湿，泻火解毒。' },
  fuling:  { id:'fuling',  name:'茯苓',  icon:'🍄', nature:'平', flavor:'甘淡',tier:1, price:9,  src:['药圃','商贩'], desc:'利水渗湿，健脾宁心。' },
  danggui: { id:'danggui', name:'当归',  icon:'🌿', nature:'温', flavor:'辛甘',tier:2, price:22, src:['药圃','商贩'], desc:'补血活血，调经止痛。' },
  banxia:  { id:'banxia',  name:'半夏',  icon:'🥔', nature:'温', flavor:'辛',  tier:2, price:16, src:['药圃'],       desc:'燥湿化痰，降逆止呕；生者有毒。', toxic:true },
  fuzi:    { id:'fuzi',    name:'附子',  icon:'🌶️', nature:'热', flavor:'辛甘',tier:3, price:45, src:['商贩'],       desc:'回阳救逆，补火助阳；大毒，须久煎。', toxic:true },
  gancao:  { id:'gancao',  name:'甘草',  icon:'🌿', nature:'平', flavor:'甘',  tier:1, price:5,  src:['药圃','商贩'], desc:'调和诸药，解百毒——使药之首。' },
  chaye:   { id:'chaye',   name:'茶叶',  icon:'🍃', nature:'凉', flavor:'苦甘',tier:1, price:12, src:['商贩'],       desc:'提神醒脑，解腻消滞；军中行旅赖以熬夜（提神散之君药）。' }
};
```

### 3.2 成药表 `LF.MEDICINES`（六轴版）

| 字段 | 说明 |
|---|---|
| `id` / `name` / `icon` | 同 items |
| `axis` | `'A'｜'B'｜'C'｜'D'｜'E'｜'F'` 效果轴（见 §3.0.4） |
| `batch` | `1` = P0 落地；`2` = P1 及以后（分两批，避免一次性铺 18 味） |
| `nature` | 四性（体质对症用，见 §3.4） |
| `potency` | E 轴疗效（hp） |
| `effect` | 扩展效果 `{ hp, mp, energy, cure:[], buff:{}, immune:[] }`，规格见 §3.9 |
| `cures` | 可治症状 id（问诊判定用，见 §3.3） |
| `qMul` | 品质倍率 `{1:凡品, 2:良品, 3:珍品}` |
| `formula` | `{ jun, chen:[], zuo:[], shi:[], heat, time, diff }` |
| `price` | 凡品基准售价（良品 / 珍品按 `qMul` 乘） |
| `maxStack` | 叠加上限 |

```js
LF.MEDICINES = {
  // ══ E 轴 · 治疗（既有，仅补字段，不新增）══
  jinchuang: { id:'jinchuang', name:'金疮药', icon:'🧪', axis:'E', batch:1, nature:'凉', potency:50, maxStack:30,
    qMul:{1:1.0,2:1.6,3:3.0}, price:12, cures:['daoshang'],
    effect:{ hp:50 },
    formula:{ jun:'caoyao', chen:[], zuo:[], shi:['gancao'], heat:2, time:1, diff:1 } },
  yaofen:    { id:'yaofen', name:'草药粉', icon:'🌿', axis:'E', batch:1, nature:'凉', potency:25, maxStack:40,
    qMul:{1:1,2:1.5,3:2.5}, price:6, cures:['daoshang'],
    effect:{ hp:25 },
    formula:{ jun:'caoyao', chen:[], zuo:[], shi:[], heat:1, time:1, diff:1 } },
  tangyao:   { id:'tangyao', name:'汤药', icon:'🍵', axis:'E', batch:1, nature:'温', potency:130, maxStack:12,
    qMul:{1:1,2:1.6,3:3.0}, price:38, cures:['qixu'],
    effect:{ hp:130 },
    formula:{ jun:'renshen', chen:['fuling'], zuo:['danggui'], shi:['gancao'], heat:3, time:2, diff:2 } },

  anshui:    { id:'anshui', name:'安神汤', icon:'🫖', axis:'E', batch:2, nature:'平', maxStack:12,
    qMul:{1:1,2:1.3,3:1.8}, price:24, cures:['bumei'],
    effect:{ hp:20, restBonus:0.3 },                   // 歇息恢复 +30%
    formula:{ jun:'fuling', chen:[], zuo:['lingzhi'], shi:['gancao'], heat:1, time:2, diff:2 } },

  // ══ A 轴 · 解状态（P0 首选：机制已实现、缺口最大）══
  jiedu:     { id:'jiedu', name:'解毒丸', icon:'🧫', axis:'A', batch:1, nature:'寒', maxStack:20,
    qMul:{1:1,2:1.4,3:2.0}, price:26,
    effect:{ cure:['poison'] },                       // 珍品额外清 1 层
    formula:{ jun:'huanglian', chen:[], zuo:['fuling'], shi:['gancao'], heat:1, time:1, diff:2 } },
  qingliang: { id:'qingliang', name:'清凉散', icon:'❄️', axis:'A', batch:1, nature:'寒', maxStack:20,
    qMul:{1:1,2:1.4,3:2.0}, price:24,
    effect:{ cure:['burn'] },
    formula:{ jun:'shigao', chen:['huanglian'], zuo:[], shi:['gancao'], heat:1, time:1, diff:1 } },
  xingshen:  { id:'xingshen', name:'醒神汤', icon:'🌀', axis:'A', batch:1, nature:'温', maxStack:20,
    qMul:{1:1,2:1.4,3:2.0}, price:22,
    effect:{ cure:['stun'] },
    formula:{ jun:'mahuang', chen:['guizhi'], zuo:[], shi:['gancao'], heat:2, time:1, diff:2 } },
  huoxuejiu: { id:'huoxuejiu', name:'活血酒', icon:'🍶', axis:'A', batch:1, nature:'温', maxStack:15,
    qMul:{1:1,2:1.4,3:2.0}, price:30, cures:['dieda'],
    effect:{ cure:['slow'] },
    formula:{ jun:'danggui', chen:['guizhi'], zuo:[], shi:[], heat:2, time:2, diff:2 } },

  // ══ B 轴 · 补精力（零成本新增，体感强）══
  tishen:    { id:'tishen', name:'提神散', icon:'🍃', axis:'B', batch:1, nature:'平', maxStack:30,
    qMul:{1:1,2:1.3,3:1.8}, price:20,
    effect:{ energy:35 },
    formula:{ jun:'chaye', chen:['fuling'], zuo:[], shi:[], heat:1, time:1, diff:1 } },
  shentang:  { id:'shentang', name:'参汤', icon:'🥣', axis:'B', batch:1, nature:'温', maxStack:12,
    qMul:{1:1,2:1.4,3:2.0}, price:45,
    effect:{ energy:50, hp:30, buff:{ atk:3, turns:2 } },
    formula:{ jun:'renshen', chen:['danggui'], zuo:[], shi:['gancao'], heat:3, time:2, diff:2 } },

  // ══ D 轴 · 战前增益（经营客流命根子）══
  zhuangqi:  { id:'zhuangqi', name:'壮气酒', icon:'🔥', axis:'D', batch:1, nature:'热', maxStack:12,
    qMul:{1:1,2:1.4,3:2.0}, price:35,
    effect:{ buff:{ atk:5, turns:3 } },
    formula:{ jun:'fuzi', chen:[], zuo:[], shi:['gancao'], heat:3, time:2, diff:3 } },  // 附子有毒，甘草为使解其毒
  huxin:     { id:'huxin', name:'护心丸', icon:'🔴', axis:'D', batch:1, nature:'平', maxStack:8,
    qMul:{1:1,2:1.2,3:1.5}, price:60,
    effect:{ buff:{ guard:true, turns:1 } },           // 致命伤保 1 血
    formula:{ jun:'renshen', chen:['fuling'], zuo:['lingzhi'], shi:['gancao'], heat:3, time:3, diff:3 } },
  jinchuangao:{ id:'jinchuangao', name:'金创膏', icon:'🩹', axis:'D', batch:1, nature:'凉', maxStack:20,
    qMul:{1:1,2:1.5,3:2.5}, price:34, cures:['daoshang'],
    effect:{ hp:40, buff:{ dmgCut:0.2, turns:3 } },
    formula:{ jun:'danggui', chen:['caoyao'], zuo:['lingzhi'], shi:[], heat:2, time:2, diff:2 } },

  // ══ C 轴 · 时令防护（batch 2）══
  fenghan: { id:'fenghan', name:'风寒汤', icon:'🫚', axis:'C', batch:2, nature:'热', maxStack:20,
    qMul:{1:1,2:1.2,3:1.5}, price:15,
    effect:{ immune:['chill'] }, cures:['toure'],      // 12 时辰免疫风寒 + 主「头热身痛」
    formula:{ jun:'guizhi', chen:['mahuang'], zuo:[], shi:['gancao'], heat:2, time:1, diff:1 } },
  bishu:     { id:'bishu', name:'避暑丹', icon:'🧊', axis:'C', batch:2, nature:'寒', maxStack:20,
    qMul:{1:1,2:1.2,3:1.5}, price:18,
    effect:{ immune:['heatstroke'] },
    formula:{ jun:'shigao', chen:[], zuo:['fuling'], shi:['gancao'], heat:1, time:1, diff:1 } },
  bizhang:   { id:'bizhang', name:'避瘴丸', icon:'🌫️', axis:'C', batch:2, nature:'温', maxStack:15,
    qMul:{1:1,2:1.3,3:1.8}, price:28,
    effect:{ immune:['miasma'] },
    formula:{ jun:'huanglian', chen:['banxia'], zuo:['fuling'], shi:['gancao'], heat:1, time:2, diff:3 } }, // 半夏有毒

  // ══ F 轴 · 军用 / 社交（batch 2）══
  junyao:    { id:'junyao', name:'军中金疮药', icon:'⚔️', axis:'F', batch:2, nature:'凉', maxStack:60,
    qMul:{1:1,2:1.3,3:1.8}, price:20,
    effect:{ hp:40, armyCut:0.15 },                    // 战后减员 -15%
    formula:{ jun:'caoyao', chen:[], zuo:[], shi:[], heat:2, time:1, diff:1 } },  // outN:3 批量
  baidu:     { id:'baidu', name:'败毒散', icon:'💊', axis:'F', batch:2, nature:'寒', maxStack:12,
    qMul:{1:1,2:1.5,3:2.5}, price:60, cures:['wenyi'],
    effect:{ immune:['plague'] },
    formula:{ jun:'huanglian', chen:['banxia'], zuo:['fuling'], shi:['gancao'], heat:2, time:3, diff:3 } },
  shangdeng: { id:'shangdeng', name:'上等伤药', icon:'🎁', axis:'F', batch:2, nature:'温', maxStack:10,
    qMul:{1:1,2:1.5,3:2.5}, price:80,
    effect:{ hp:80, giftFavor:15 },                    // 赠名将 → addNpcFavor +15
    formula:{ jun:'renshen', chen:['danggui'], zuo:['lingzhi'], shi:['gancao'], heat:3, time:3, diff:3 } }
};
```

> **落地批次建议**：P0 只铺 `batch:1`（A/B/D/E 共 12 味，其中 E 轴 3 味为既有改造），已足以让药品从「2 种回血梯度」变成「六轴分工」；`batch:2` 随 P1/P3 补齐。
> **配方多样性的来源**：同一味君药换个臣/使药就是另一件商品（如 `huanglian` 作君 → 解毒丸 / 避瘴丸 / 败毒散三味），**组合爆炸是结构性的，不是硬凑的**——这正是君臣佐使第一次真正有用的地方。

### 3.3 症状表 `LF.SYMPTOMS`

> 本表服务**顾客问诊**（§4.2），只覆盖「民间病症」——对应 §3.0 的 **E 治疗轴**与 **C 时令轴**。
> 玩家**自用**侧（A 解状态 / B 精力 / D 增益）不走本表，直接读 `LF.MEDICINES[].effect.cure / buff / immune`（§3.9）。

| 字段 | 说明 |
|---|---|
| `id` / `name` / `icon` | 题干（顾客气泡） |
| `cure` | 对症药 id 数组（选对 → 溢价 + 口碑） |
| `wrong` | 典型错药（用于生成干扰项 + 错选文案） |
| `cons` | 易感体质（用于生成顾客体质） |
| `weight` | 出现权重 |
| `line` | 顾客自述台词 |

```js
LF.SYMPTOMS = {
  toure:    { id:'toure',    name:'头热身痛', icon:'🤒', cure:['fenghan'],              wrong:['jinchuang','tangyao'],  cons:'虚寒', weight:20, line:'昨夜受了风，头痛得紧，浑身发烫……' },
  daoshang: { id:'daoshang', name:'刀伤渗血', icon:'🩸', cure:['jinchuangao','jinchuang'], wrong:['tangyao'],           cons:'平和', weight:18, line:'方才与人争执，臂上挨了一刀，血流不止。' },
  dieda:    { id:'dieda',    name:'跌打瘀青', icon:'💢', cure:['huoxuejiu'],            wrong:['anshui'],           cons:'平和', weight:14, line:'从车上摔下来，浑身青紫，动弹不得。' },
  zaore:    { id:'zaore',    name:'燥热烦渴', icon:'🔥', cure:['bishu'],                wrong:['tangyao','huoxuejiu'],    cons:'燥热', weight:14, line:'心里像有火在烧，喝多少水都不解渴。' },
  qixu:     { id:'qixu',     name:'气虚乏力', icon:'😮‍💨', cure:['tangyao','shentang'],   wrong:['bishu'],          cons:'虚寒', weight:12, line:'走两步就喘，说话都没力气……' },
  bumei:    { id:'bumei',    name:'夜不能寐', icon:'🌙', cure:['anshui'],               wrong:['huoxuejiu'],           cons:'燥热', weight:10, line:'整夜睁着眼，一闭眼就是刀光剑影。' },
  shechong: { id:'shechong', name:'蛇虫咬伤', icon:'🐍', cure:['jiedu'],                wrong:['fenghan'],          cons:'平和', weight:8,  line:'山里被咬了一口，伤口发黑，麻到心口。' },
  wenyi:    { id:'wenyi',    name:'时疫寒热', icon:'☠️', cure:['baidu'],                wrong:['jinchuang'],        cons:'燥热', weight:4,  line:'村里倒了一片，我怕是也染上了……' }
};
```

> `wenyi` 权重最低，P4 瘟疫事件期间由事件临时拉高到 30（`LF.PHARM_NUM.plagueBoost`）。

### 3.4 体质与药性配伍 `LF.CONSTITUTIONS`

```js
LF.CONSTITUTIONS = {
  xuhan: { id:'xuhan', name:'虚寒', icon:'🥶', like:['温','热'], hate:['寒','凉'], desc:'手足冰凉，畏寒喜暖。' },
  zaore: { id:'zaore', name:'燥热', icon:'🥵', like:['寒','凉'], hate:['温','热'], desc:'面赤口干，易生疮疖。' },
  pinghe:{ id:'pinghe',name:'平和', icon:'😌', like:[],          hate:[],          desc:'不寒不热，随症而治。' }
};

// 对症加成（初稿，待配平）
LF.PHARM_NUM.consBonus = { match: 1.15, mismatch: 0.9 };   // 售价倍率
LF.PHARM_NUM.consCure  = { match: 1.2,  mismatch: 1.0  };  // 疗效倍率
```

**君臣佐使判定**：

| 情况 | 处理 |
|---|---|
| 君药齐备 | 可开方（否则不可配） |
| 缺臣药 | 品质上限降 1 档（珍品 → 良品） |
| 缺佐药 | 品质上限降 1 档 |
| 缺使药 | 无降档，但「药性醇和」隐藏特性不生效 |
| 有毒药材（`toxic`）且火候未达要求档 | 出「劣药」（疗效 ×0.4，售价 ×0.5，口碑 -3） |

### 3.5 配方表扩展

在 `shared/data/recipes.js` 新增工作台 **`pharma`**（配药台，走小游戏），同时把 `alchemy` 转正为「药铺炼炉」（粗加工，不走小游戏，如草药→草药粉）。

扩展字段（向后兼容，仅 `pharma` 台使用）：

```js
LF.RECIPES.pharma = [
  { id:'ph_jinchuang', cat:'药剂类', name:'金疮药', icon:'🧪', out:'jinchuang', outN:1,
    in:[{id:'caoyao',n:2,role:'君'},{id:'baishao',n:1,role:'臣'},{id:'gancao',n:1,role:'使'}],
    heat:2, time:1, diff:1, note:'两味草药捣敷，止血生肌——可疗外伤五十。' }
];
```

`role` 缺省按数组顺序推断：第 1 味 = 君，第 2 味 = 臣，第 3 味 = 佐，第 4 味 = 使。

### 3.6 品质三档规则 ★核心

```js
LF.PHARM_NUM.quality = {
  tiers: [ { q:1, name:'凡品', mul:1.0, color:'--ink-3' },
           { q:2, name:'良品', mul:1.6, color:'--gold' },
           { q:3, name:'珍品', mul:3.0, color:'--cinnabar' } ],
  scoreToTier: [ [0,2,1], [3,4,2], [5,5,3] ]   // [min,max,q]
};
```

**三段判定合成（`pharmacy.judge(weighScore, orderScore, heatScore)`）**

| 段 | 满分 | 判定 |
|---|---|---|
| 称量 | 2 | 游标落在刻度区中心 ±4% → 2；±12% → 1；超出 → 0 |
| 投放 | 1 | 严格按 `in[]` 顺序点完 → 1；错序 → 0 且**品质锁死凡品** |
| 火候 | 2 | 停在正中档 → 2；±1 档 → 1；超时/超档 → 0 |
| 合计 | 5 | ≤2 凡品 / 3-4 良品 / 5 珍品 |

**珍品附加**：隐藏特性「药性醇和」→ 售价再 ×1.1，成交后口碑 +2，概率记入图鉴。

**防疲劳（用户硬性要求）**：药方卡底部常驻「自动抓药」按钮 → 跳过三段判定，直接出**凡品**，仍消耗材料与时间。与赌坊 `skip()`（`gamble.js:485`）同理念。

### 3.7 ⚠️ 品质如何落到物品实例（关键设计决策）

`shared/core/inventory.js:65` `itemKey(it) = it.defId || it.id`，`packAdd`（:88-94）按此键合并堆叠 → **若只往实例上加 `q` 字段，不同品质的药会被静默合并**。

三个候选方案：

| 方案 | 做法 | 评价 |
|---|---|---|
| **A（推荐）** | 改 `itemKey` 为 `(it.defId||it.id) + (MED_Q[id] ? '#'+(it.q||1) : '')`，同步改 `packConsume`（:108）匹配条件为 `_qKey(c) === _qKey({defId})` | 白名单生效，仅影响 `LF.MEDICINES` 内 id；玩家自用珍品疗效 ×3 生效；改动 3 处 |
| B | 派生独立 defId（`jinchuang_l` / `jinchuang_z`） | 零引擎改动，但物品表膨胀 ×3，图鉴/商店要维护三套 |
| C | 品质只存在店内库存，背包统一无品质 | 最简，但玩家自用体验不到珍品 |

**选定 A**，并在 P0 验收中断言「同 defId 不同 q 不合并」。

---

### 3.8 需求产生机制（让系统制造需求，而非等玩家自觉）

药店要活，需求必须由玩法节奏产生，而不是靠玩家自觉囤货。六条发生器：

| # | 发生器 | 触发条件 | 产生的需求 | 落点 |
|---|---|---|---|---|
| 1 | **战斗状态** | 敌人 `eff` 施加 poison / burn / stun / slow（`enemies.js:229`） | A 轴解药（刚需：睡觉不解，只能嗑药） | `combat.js` dot 结算 |
| 2 | **环境** | 雪天 / 暑天 / 瘴气郊野（`calendar.js:13 WEATHERS`、`field.js`） | C 轴预防药 | `advanceMinutes` 跨辰判定 |
| 3 | **时间压力** | 夜战 / 赶路 / 连轴劳作，`energy` 见底 | B 轴提神药（用银两换时辰） | 力竭判定（`engine.js:1189`）前可嗑药 |
| 4 | **战前准备** | 玩家主动（出城 / 攻城 / 下矿前） | D 轴增益药 | 出城动作前置提示 |
| 5 | **委托与事件** | 义军急送、名将负伤、瘟疫 | F 轴 + 限时需求 | `jobboard` / 事件钩子 |
| 6 | **顾客上门** | NPC 带症状进店 | E / C 轴 + 问诊小游戏 | §4.2 |

**两套判定的分工**（互不干扰，可分别扩展）：

```
玩家自用（1-4）  → 读 LF.MEDICINES[].effect.cure / buff / immune / energy
顾客问诊（6）    → 读 LF.SYMPTOMS[].cure （§3.3）
```

### 3.9 `effect` 字段扩展规格（落地最小改动）

**现状**：`effect` 仅支持 `hp / mp / food / drink / dmg`（`shared/core/storage.js:214-219`、`shared/core/pack.js:185-188`）；战斗内可用道具只认 `hp / mp / dmg`（`shared/core/combat.js:628`）。
**扩展 4 个键即可支撑 §3.0 全部六轴**：

```js
effect: {
  hp: 50,                      // 既有：疗伤
  mp: 20,                      // 既有：复内
  energy: 35,                  // 【新增】B 轴：补精力（当前五维中唯一无补给）
  cure: ['poison'],            // 【新增】A 轴：清除指定状态（poison/burn/stun/slow）
  buff: { atk: 5, turns: 3 },  // 【新增】D 轴：限时增益（atk/def/dmgCut/guard）
  immune: ['chill']            // 【新增】C/F 轴：N 时辰内免疫（chill/heatstroke/miasma/plague）
}
```

> **v20261008b 进度**：`energy` 已落地（背包 / 仓库 / 详情三处）；`cure / buff / immune` 待战斗侧接入。
> ⚠️ **主使用点更正**：背包「使用」走 `shared/core/inventory.js:131` `usePackItem`，**不是** `storage.js`（后者仅仓库内使用）。

| 文件 | 行 | 改动 |
|---|---|---|
| `shared/core/inventory.js` | 131-141 | **主使用点**（背包直接使用）：`usePackItem` 内补 `e.energy` 分支 ✅已完成 |
| `shared/core/combat.js` | 628 | `usables` 过滤由 `effect.hp \|\| effect.mp \|\| effect.dmg` 扩为再加 `effect.cure \|\| effect.buff`；点击后按 `cure` 清 `unit.dots`、按 `buff` 写 `unit.buffs`（**待接入**） |
| `shared/core/storage.js` | 214-219 | **仓库内使用**（次要）：补 `energy / cure / immune` ✅energy 已完成 |
| `shared/core/pack.js` | 185-188 | 行囊详情行补 `energy / cure / buff / immune` 呈现 ✅energy 已完成 |

**战斗侧 dot 数据结构**：沿用现有 `u.dots[]`（`combat.js:464` 渲染 `.dq-debuff`），元素形如 `{name:'中毒', stacks:n}`；建议补 `key` 字段（`'poison' / 'burn' / 'stun' / 'slow'`），以便 `cure` 精确匹配。

**安全约束**：

- `cure` 只做**清除**，`immune` 才做**免疫**；`immune` 存 `state.flags.pharma.immune = { chill: 到期时辰 }`，由 `advanceMinutes` 跨辰时递减清理。
- `buff` 仅战斗内生效，退出战斗即清，**不得**污染 `effectiveStats`（`shared/core/equipment.js:20`）。
- 新增键**全部可选**，缺省即旧行为——既有 6 种药零改动兼容。

## 4. 七个分支小游戏（细化规则）

### 4.1 🎲 配药（P0 · 最核心 · 全文规格）

| 项 | 规格 |
|---|---|
| 入口 | 药铺内「配药台」物件 → `openModal('brew', { bench:'pharma', rid:<recipeId> })`；或 `city.js:726 shopWorkbench` 扩展分支 |
| 前置 | 材料齐（`packFind(x.id).count >= x.n`），否则禁用并提示缺哪味 |
| UI 结构 | 药方卡（君臣佐使 + 火候档位 + 材料行）→ 三段判定区 → 结果卡 |
| **第 1 段 称量** | 横向游标条（0-100），目标刻度区由 `diff` 决定宽度（diff1: ±12% / diff2: ±8% / diff3: ±5%）。拖动或点按 → 松手锁定。偏差 ≤4% 得 2 分，≤12% 得 1 分，否则 0 分。音效：拨动声 |
| **第 2 段 投放** | 材料按钮按乱序排列，须按 `in[]` 的 `role` 顺序（君→臣→佐→使）点完。错一次 → 该段 0 分且**品质锁凡品**，但不消耗额外材料。音效：入锅滋滋 |
| **第 3 段 火候** | 时间条自左向右跑（`formula.heat` 决定目标档位高亮），玩家点停在目标档：正中 2 分、±1 档 1 分、未点/超时 0 分。有毒药材要求必须命中目标档否则出劣药。音效：开盖蒸汽 |
| 耗时 | 三段结束后 `busyAct('配药·'+r.name, 950, done)` + `advanceMinutes(60 * r.time)` |
| 产出 | `packAdd(out, outN)` 并写 `q`；`log()` 一行带品质前缀（「〔珍品〕你配出一料金疮药，药性醇和。」） |
| 奖惩 | 珍品 → 解锁隐藏配方钩子（`flags.pharma.perfect[r.id]=1`）；失败不扣材料但浪费时段 |
| 跳过 | 「自动抓药」→ `q=1`，同样扣材料与时间 |
| 落点 | `shared/core/pharmacy.js`：`renderBrew() / bindBrew() / brewWeigh() / brewOrder() / brewHeat() / brewSettle(q) / brewSkip()` |

### 4.2 💬 问诊对症（P1）

| 项 | 规格 |
|---|---|
| 触发 | 顾客气泡含 `LF.SYMPTOMS[..].line`，玩家点顾客 |
| 操作 | 症状卡 + 3 个候选药（1 对症 + 2 取自 `wrong`），限时 10 秒（自带倒计时条） |
| 判定 | 对症 → 售价 ×1.2、口碑 +2、顾客满意度满；错选 → 顾客拂袖、口碑 -5、当日该客流失；超时 → 视为错选但口碑只 -2 |
| 进阶 | 习得「望闻问切」（科技树药理分支）后出「多问一句」按钮，消耗一次问诊 → 剔除 1 个错误候选 |
| 落点 | `pharmacy.renderConsult(custId) / consultPick(custId, medId)` |

### 4.3 🃏 议价卡牌（P2）

| 项 | 规格 |
|---|---|
| 触发 | 售出珍品药，或顾客带「精明客」标记（铜镜图标） |
| 规则 | 顾客 `耐心 = 6`（每回合 -1）、`兴趣 = 0~100`（决定成交价上浮 %），兴趣初始 = `20 + 体质匹配加成` |
| 牌组 | 「夸药效」+15 兴趣 / 耗 1 耐心；「引古方」+25 / 耗 2；「激将法」+40 但 30% 翻脸；「见好就收」立即成交 |
| 判定 | 耐心归零前点成交 → 实收 = 基础价 × (1 + 兴趣/100)；翻脸 → 原价 ×0.8 强卖且口碑 -3；耐心归零 → 顾客走人 |
| 卡组成长 | 与牙人/行商交好（`npcai` 好感）解锁新话术牌 |
| 落点 | `pharmacy.renderHaggle() / hagglePlay(cardId) / haggleDeal()` |

### 4.4 ⏱ 抓药计时（P2）

| 项 | 规格 |
|---|---|
| 触发 | 委托订单「急送 N 份金疮药」（义军/官府/行商） |
| 操作 | 限时 60 秒，按订单提示连点对应药斗格；抓对 +1、抓错 -2 秒 |
| 判定 | 按时完成 → 委托全额 + 时效奖励（剩余秒数 × 2 两）；超时 → 扣 30% 酬金 |
| 复用 | `busyAct` 做总时长条；药斗格用 `.pack-grid` + `.packcell` |
| 落点 | `pharmacy.renderPickOrder() / pickHit(idx)` |

### 4.5 🔍 鉴药（P3）

| 项 | 规格 |
|---|---|
| 触发 | 野外采到「疑似药材」或商贩兜售来路不明药材 |
| 操作 | 看三项特征（色 / 形 / 香）选真伪，每项一次机会 |
| 奖励 | 鉴出珍品 → 低价收、高价卖；鉴错 → 买假药，进店卖出触发口碑暴跌连锁事件 |
| 落点 | `pharmacy.renderAppraise(itemId) / appraisePick(feat, val)` |

### 4.6 🏮 夜防（P3）

| 项 | 规格 |
|---|---|
| 触发 | 夜间时段随机事件（概率 `LF.PHARM_NUM.raidP`，名望越高越低） |
| 操作 | 限时点破（点中贼 3 次）或选「放狗 / 喊街坊」（需已解锁） |
| 判定 | 成功 → 保药 + 治安声望（`addReputation`）；失败 → 丢 3 成库存 |
| 落点 | `pharmacy.renderNightWatch() / watchHit(i)` |

### 4.7 🌿 药性配伍（贯穿系统，非独立小游戏）

见 §3.4。顾客带体质，成药带四性，匹配 → 售价 ×1.15、疗效 ×1.2；相冲 → ×0.9。

---

## 5. 四分支科技树 `LF.PHARM_TREE`

> 消耗用 `rep`（声望）+ `gold`（银两）。前置满足才可点亮下一级。
> 面板：新 modal `'pharmtree'`，消费 `docs/DESIGN_SYSTEM.md`：分支用 `.tab`，节点卡用 `.surface`，按钮用 `.btn`。

### 5.1 🌿 药理

| 层 | id | 前置 | 消耗 | 效果 | 代码落点 |
|---|---|---|---|---|---|
| 1 | 识药 | — | rep 20 | 药性（寒热温凉）在物品详情可见；鉴药小游戏开放 | `pharmacy.showNature()` |
| 2 | 成方 | 识药 | rep 45 / gold 150 | 配方图鉴 Ⅱ（解锁 `diff:2` 配方）；称量刻度区放宽 2% | `pharmacy.unlockRecipes(2)` |
| 3 | 望闻问切 | 成方 | rep 80 / gold 300 | 问诊可「多问一句」 | `pharmacy.consultHint` |
| 4 | 秘方 | 望闻问切 | rep 140 / gold 800 | 解锁隐藏配方；珍品可触发「药性醇和」 | `flags.pharma.secret=1` |
| 5 | 《伤寒论》遗篇 | 秘方 + P4 名医事件 | rep 220 / 事件道具 | 全配方火候容错 +1 档；瘟疫期疗效 ×1.5 | `pharmacy.treatiseBonus` |

### 5.2 ⚒️ 器具

| 层 | id | 前置 | 消耗 | 效果 | 代码落点 |
|---|---|---|---|---|---|
| 1 | 药臼 | — | gold 120 | 批量 +1（一次配 2 份，品质取最低段） | `pharmacy.batch = 2` |
| 2 | 药炉 | 药臼 | gold 320 | 品质上限 +1（凡品可冲良品） | `pharmacy.qCap = 2` |
| 3 | 丹炉 | 药炉 | gold 900 / rep 60 | 珍品率 +15%（判定 4 分即算珍品） | `pharmacy.qBonus = 1` |
| 4 | 自动药碾 | 丹炉 | gold 1800 / rep 120 | 「自动抓药」也出良品 | `pharmacy.autoQ = 2` |

### 5.3 🏪 铺面

| 层 | id | 前置 | 消耗 | 效果 | 代码落点 |
|---|---|---|---|---|---|
| 1 | 药柜 | — | gold 100 | 货架位 +3（容器内可上架品类 +3） | 扩展 `contCount` 判定 |
| 2 | 后堂 | 药柜 | gold 260 | 客流 +2（三时段各自 +2） | `pharmacyFootfall` 加常数 |
| 3 | 雇伙计 | 后堂 | gold 600 / 日薪 20 | 自动补货 + 自动招揽（夜防有人） | 复用 `sh.staff` |
| 4 | 他城分号 | 雇伙计 | gold 1500 / rep 100 | 可在第二座城开药铺（复用 `buyShop`） | `flags.pharma.branches[]` |

### 5.4 ⭐ 名望

| 层 | id | 前置 | 消耗 | 效果 | 代码落点 |
|---|---|---|---|---|---|
| 1 | 口碑 | — | rep 30 | 客单价 +10%；口碑条可见 | `pharmacy.priceMul = 1.1` |
| 2 | 坐堂 | 口碑 | rep 70 | 名医来访（问诊顾客品质需求提高，溢价 +30%） | `custom_npcs` 名医卡生效 |
| 3 | 义军军医 | 坐堂 | rep 130 / gold 500 | 大委托开放（抓药计时订单） | `pharmacy.bigOrders = 1` |
| 4 | 悬壶济世 | 义军军医 | rep 200 | 声望称号（`repTitle` 接入）；夜防概率减半 | `pharmacy.title='悬壶济世'` |

---

## 6. 经营层设计（挂现有骨架）

### 6.1 三时段客流

`shared/core/city.js:676-680` `shopFootfall(sh, cid)` 现按 `t.footBase * (1+lv*0.12) * cityTier系数 * rand(0.8~1.2)`。

药铺扩展为 `pharmacyFootfall(sh, cid, phase)`（放在 `pharmacy.js`，由日切钩子与 `cityShopMonthly` 调用）：

| 时段 | 时辰 | 客群 | 需求倾向 | 系数 |
|---|---|---|---|---|
| 早市 | 卯—辰 | 药农 / 采药人 | 卖原料、买便宜伤药 | ×0.8，药材收购价 ×1.1 |
| 午市 | 巳—申 | 市井百姓 | 常规成药 | ×1.0 |
| 夜市 | 酉—亥 | 伤兵 / 游侠 | 伤药（金疮/金创膏/活血酒） | ×0.9，伤药售价 ×1.25 |

### 6.2 打烊结算

- **日切钩子**：`engine.js:1298-1307` 跨日块内，仿 `tickBuildOrders(crossings)`（1315）加 `Pharmacy.tickDay()`（须排在 `NpcAi.tickDay()` 1305 之后）。
- **月结**：`city.js:731-751 cityShopMonthly` 内对 `sh.shopId==='yaofu'` 分支走 `pharmacyMonthlySettle(sh, cid)`（含科技树增益、伙计、税）。
- **面板**：`openModal('shopclose')` —— 营收明细（按药品分行的售价/数量/小计）、口碑变化、当日事件回放（珍品/翻脸/夜防/名医）。

### 6.3 定价与需求

每个上架药品独立标价倍率 `sh.price[defId] ∈ [0.6, 1.6]`（默认 1.0）：

```
sellRate  = clamp(1.25 - 0.6 * priceMul, 0.15, 1.0)     // 越贵卖越少
unitPrice = MEDICINES[id].price * qMul[q] * priceMul * consBonus * repMul
soldQty   = round(footfall * demandWeight[symptom] * sellRate)   // 且不超过库存
```

### 6.4 货架 / 容器

**不要新建 `shelf*` API**——直接复用 `shared/shop.js` 容器族：`contInit(p)` / `contCount(p)` / `contPut(p, defId, n)` / `contTake(p, idx, n)` / `contPickup(p)` / `renderContainerPanel(opts)` / `bindContainerPanel(p)`。
上架窗口即容器面板（`opts.placed`），格数由 `shelf_wood/iron/carved` 的 `contSlots`（8/16/24）决定。

---

## 7. 分阶段施工清单

> 每阶段独立版本号 + 推 GitHub。构建流程见 §9.2。

### P0 · 配药小游戏 + 品质（本阶段即可玩）

| 改动文件 | 内容 |
|---|---|
| `shared/data/pharma.js` **[新]** | `LF.HERBS / LF.MEDICINES / LF.SYMPTOMS / LF.CONSTITUTIONS / LF.PHARM_TREE / LF.PHARM_NUM` |
| `shared/data/items.js` | 补 8 味成药 + 9 味药材 def（`cat:'药剂' / '素材'`，emoji 图标，`maxStack` 见 §3） |
| `shared/data/recipes.js` | 新增 `pharma` 台配方；修正 `alchemy.mk_yaofen` 材料为 `caoyao` |
| `shared/data/build.js:457-462` | `TEMPLATES.yaofu` 加 `benches:['alchemy','pharma']`、`trade.sells` 扩药品 |
| `shared/core/crafting.js:144-150` | 补 `_benchMeta.alchemy` / `_benchMeta.pharma`；`:209` 日志改取 `bm.name` |
| `shared/core/pharmacy.js` **[新]** | `LF.createPharmacy(ctx)`：`renderBrew / bindBrew / brewWeigh / brewOrder / brewHeat / brewSettle / brewSkip / judge / qMulOf / showNature` |
| `shared/core/inventory.js:65,108` | `itemKey` 白名单带 `q`；`packConsume` 匹配同步（§3.7 方案 A） |
| `shared/core/inventory.js:131-141` | **`usePackItem` 补 `e.energy` 分支**（背包主使用点，§3.9）✅已完成 |
| `shared/core/combat.js:628` | `usables` 过滤扩 `cure / buff`；点击后清 `unit.dots`、写 `unit.buffs`（§3.9） |
| `shared/core/storage.js:214-219` | 仓库内使用补 `energy / cure / immune`（§3.9）✅energy 已完成 |
| `shared/core/pack.js:185-188` | 详情行呈现 `energy / cure / buff / immune`（§3.9）✅energy 已完成 |
| `shared/core/engine.js` | ① `openModal` 渲染分支（4944 后）加 `else if(kind==='brew')`；② bind 分支（5016 后，即 `if(kind==='craft'){ bindCraftPanel(); }` 之后）加 `bindBrew`；③ `closeModal`（5333 后）加 `if(_closedKind==='brew') Pharmacy.closeBrew()`；④ 顶部别名块接管 |
| `tools/bundle.manifest` | 在 `shared/core/engine.js`（当前第 78 行）**之前**插入 `shared/core/pharmacy.js`；`shared/data/pharma.js` 插在 `items.js` 之后 |

**接线点**：`city.js:726 shopWorkbench` 扩展 → 药铺调 `openModal('brew',{bench:'pharma'})`。

**验收断言**（可写成 `_verify_pharma_p0.js`，node 跑）：
1. `LF.HERBS` 项数 ≥ 11、`LF.MEDICINES` ≥ 9、`LF.SYMPTOMS` = 8
2. `node --check` 全部改动文件通过
3. 三段判定穷举：称量 × 投放 × 火候 全组合 → `judge()` 输出落在 {1,2,3} 且分布符合 §3.6
4. 同 `defId` 不同 `q` 的两份药 `packAdd` 后 `pack` 中**占两格**（验证 §3.7 方案 A）
5. jsdom 冒烟：`openModal('brew')` 后 `#modal-card` 含 `.brew-*` 节点，点「自动抓药」产出 `q===1` 的物品，0 控制台错误
6. `effect` 新键向后兼容：既有 6 种药（无新键）的使用路径零回归（storage / pack / 战斗内）
7. A 轴解药生效：构造 `unit.dots=[{key:'poison',name:'中毒',stacks:1}]` → 战斗内使用解毒丸 → `dots` 清空

### P1 · 顾客个体 + 问诊 + 口碑 + 打烊结算

| 改动文件 | 内容 |
|---|---|
| `shared/data/pharma.js` | 加 `LF.PHARM_NUM.customerGen`（体质/症状权重/精明客概率） |
| `shared/core/pharmacy.js` | `spawnCustomers(sh,cid,phase) / renderConsult / consultPick / consultHint / tickDay / renderClosePanel / bindClosePanel` |
| `shared/core/engine.js` | 新 modal `'shopclose'`（3 处登记）；跨日块（1307 后）加 `Pharmacy.tickDay()` |
| `shared/core/city.js:681-689` | `shopDailySettle` 对 `yaofu` 分支调 `pharmacyDailySettle(sh, cid, phase)` |

**验收**：连跑 30 天模拟，日营收标准差 > 0（有起伏）、口碑曲线单调可解释、无 NaN；`closeModal` 后顾客队列正确清空。

### P2 · 议价卡牌 + 抓药委托

| 改动文件 | 内容 |
|---|---|
| `shared/core/pharmacy.js` | `renderHaggle / hagglePlay / haggleDeal / renderPickOrder / pickHit / genOrder` |
| `shared/core/jobboard.js` | 接「义军急送」委托入口（挂靠既有委托体系） |

**验收**：议价 1000 次蒙特卡洛 → 期望收益高于直接成交但不超 1.6 倍（防刷）；订单超时扣酬生效。

### P3 · 药圃 + 鉴药 + 夜防 + 科技树

| 改动文件 | 内容 |
|---|---|
| `shared/core/farm.js:30-33` | `CROPS` 加 `yaocai:{name:'药材',grow:4,out:'caoyao',yield:[1,2],seed:'yaozhong'}`（⚠️ 只能改内部常量） |
| `shared/data/build.js` | 新增 `bp_herb`（`cellType:'herb'`）兑现 `buildings.js:106` |
| `shared/core/pharmacy.js` | `renderAppraise / appraisePick / renderNightWatch / watchHit / renderPharmTree / bindPharmTree / unlockNode / nodeActive` |
| `shared/core/engine.js` | 新 modal `'pharmtree'`（3 处登记） |

**验收**：药种可播种 → 成熟 → 采收入包；科技树 16 节点前置校验（不满足不可点亮）；夜防事件触发率符合 `raidP`。

### P4 · 名医联动

| 改动文件 | 内容 |
|---|---|
| `shared/data/custom_npcs.js` | 加 `huatuo`（华佗，kinds:['market','clinic']）、`zhangzhongjing`（张仲景）、`zuotang`（坐堂大夫）、`yaonong`（药农）、`yaren`（牙人）卡，含 `acts[]` |
| `shared/core/pharmacy.js` | 瘟疫事件钩子（拉高 `wenyi` 权重）、《伤寒论》遗篇授予 |

**验收**：`LF.NPC_CARDS` 含 5 张新卡（验证 `npc_cards.js:349-352` 合并生效）；名医卡在洛阳/许昌/南阳可遇。

---

## 8. 数值初稿（待实测配平）

| 项 | 初稿值 | 备注 |
|---|---|---|
| 药铺 `footBase` | 18（现）；科技树后堂 +2/时段 | 沿用 `TEMPLATES.yaofu` |
| 客单价 | `MEDICINES[id].price × qMul × priceMul × consBonus × repMul` | 凡品金疮药 12 两 → 珍品 36 两 |
| 品质倍率 | 1.0 / 1.6 / 3.0 | 疗效与售价同乘 |
| 珍品附加 | ×1.1 售价、口碑 +2 | 「药性醇和」 |
| 日营收（洛阳 lv1 无科技） | 目标 80~140 两/日 | 盘店成本 200 两 → 约 2 日回本，偏快，需下调或提成本 |
| 盘店成本 | `200 × level`（`city.js:696`）；药铺建议 `×1.5` | 药铺毛利高，成本应更高 |
| 议价期望增益 | 1.15~1.35 倍 | 蒙特卡洛配平 |
| 问诊对错 | +20% 售价 / 口碑 +2；错选 -5 口碑 | 初稿 |
| 科技树总消耗 | rep 约 1300、gold 约 6000 | 约 12~18 个月游戏内时间 |
| 夜防触发率 | 0.12/夜，名望每级 -0.02 | 悬壶济世后 -50% |

**配平方法**：写 `_sim_pharma.js`，模拟 30 天 × 3 时段，统计日营收均值/方差、品质分布（目标 凡 45% / 良 40% / 珍 15%）、口碑曲线、库存周转，按结果回填 `LF.PHARM_NUM`。

---

## 9. 风险与红线

### 9.1 三条会导致静默崩溃的硬坑

1. **新模块必须登记 `tools/bundle.manifest`**。`bundle.py` 按显式清单拼接（非 glob），漏登 → `LF.createPharmacy` undefined → 引擎启动直接崩。插入位置：数据文件在 `shared/data/items.js` 之后；核心模块在 `shared/core/engine.js`（当前第 78 行）**之前**（`npcai.js` 同理必须在 engine 前）。`bundle.py:80-83` 有文件存在性校验，写错路径会直接 `sys.exit(1)`。
2. **工厂三步齐**：`LF.createPharmacy` 内的函数 → 加进 `return {...}` → 引擎顶部别名块 `var brewSettle = Pharmacy.brewSettle;`。漏任一步 = 静默 `ReferenceError`，最早运行时才暴露。
3. **`ctx` 注入必须用 getter**：`currentModalKind`（`engine.js:4711`，primitive）会被反复赋值，跨模块一律 `getCurrentModalKind: function(){ return currentModalKind; }`；`state` 用 `ctx.getState` 惰性取值，绝不在模块顶层 `var state = getState()`（读档/新游戏会重赋值）。

### 9.2 构建与版本流程（每阶段必做）

1. 改完 `shared/*.js` → `python tools/bundle.py` **连跑两次**
   - 原因：`VERSION` 硬编码在 `tools/bundle.py:23`，bump 发生在**拼接之后**（`bundle.py:143-150`），而 `constants.js` 是 manifest 第 1 行 → 第一次产出 bundle 内嵌旧版本号，第二次才对齐。
2. 手动 bump `index.html` 的 `game.css?v=`（`bundle.py` 只动 `<script>`，不动 `<link>`）。
3. `node --check` 逐文件校验（Node：`C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe`，系统无 `node` 命令）。
4. 本环境 `replace_in_file` 会「假成功」——一律用 Python 原生 IO 写回并 grep 核验。

### 9.3 UI 红线（`docs/DESIGN_SYSTEM.md`）

- 颜色 / 圆角一律消费 `:root` 令牌，禁止写死 `#xxx` / `rgba()` / `border-radius:Npx`
- 按钮用 `.btn` / `.btn-ghost` / `.btn-danger` / `.btn-sm`，**禁止新造 `.xxx-btn`**
- 面板切换用 `.tab`，子区块用 `.surface`
- 药品格子统一 `.pack-grid` + `.packcell`（正方形 `aspect-ratio:1/1`），禁止另写 `grid-template-columns`
- 详情浮层用 `.loot-info`，`.li-name` 不显示图标
- 破坏性操作（丢弃假药等）必须二次确认

### 9.4 设计红线

- **与主线解耦**：经营崩了不卡主线；所有结算走 `if (sh && sh.owner==='player')` 守卫
- **不膨胀 engine.js**：新逻辑一律进 `pharmacy.js`，engine 只留 `openModal/bind/closeModal` 三处分派各 1 行
- **防疲劳**：每个小游戏都要有跳过/加速，默认保底凡品（与赌坊 `skip()` 同理念）
- **数值先粗后细**：全部集中放 `LF.PHARM_NUM`，跑通再配平

### 9.5 图标 emoji 占位与 PNG 批次

emoji 占位清单（后续可整批把 `icon` 字段替换为 `shared/img/pm_*.png`）：

| 类别 | 条目 |
|---|---|
| 成药 8 | 风寒药 🍵 / 解毒散 🧫 / 补气丸 🔴 / 金创膏 🩹 / 安神汤 🫖 / 清热饮 🥤 / 活血酒 🍶 / 败毒散 💊 |
| 药材 9 | 麻黄 🌾 / 桂枝 🌿 / 石膏 🪨 / 黄连 🌿 / 茯苓 🍄 / 当归 🌿 / 半夏 🥔 / 附子 🌶️ / 甘草 🌿 |
| 症状 8 | 🤒 / 🩸 / 💢 / 🔥 / 😮‍💨 / 🌙 / 🐍 / ☠️ |
| 体质 3 | 虚寒 🥶 / 燥热 🥵 / 平和 😌 |

**PNG 批次规划**（P0 验收通过后统一出图，一条提示词批次）：
- 命名：`shared/img/pm_yao_<id>.png`（成药）、`pm_herb_<id>.png`（药材），96×96 PNG，透明底，水墨/工笔风（与现有 `sm_shop-*.png` 店铺招牌统一）
- 出图后只改 `items.js` / `pharma.js` 的 `icon` 字段为图片路径，UI 与逻辑零改动
- 图鉴（P1）复用同一批图，不另出

### 9.6 待确认 / 开放问题

1. **品质是否影响玩家自用疗效**：方案 A 下珍品金疮药 `hp = 50 × 3 = 150`，可能破坏战斗平衡 → 建议自用时按 `1 + (q-1) × 0.4` 而非 `qMul`（珍品 ×1.8），需 P0 实测后定。
2. **药铺是否只在特定城出现**：`city.js:5680-5681` 的 `subGen==='shops'` 已把 `yaofu` 列为 5 选 5 常驻，是否要按城市禀赋（如南阳/洛阳优先）差异化，待定。
3. **就医层入口**：玩家作为顾客进 NPC 药铺，是复用 `BUILDINGS.yaofu.interior` 还是新开「挂号」物件 → 建议复用 interior，加一个「求医」动作。
4. **科技树消耗是否用声望**：`addReputation` 当前是单向累加（`engine.js:60`），若科技树要「扣声望」需确认是否存在扣减接口，否则改为「声望门槛 + 银两消耗」。
5. **状态药的品质如何体现**：`cure` / `immune` 类药品不能简单套用「数值 ×3」（清一次毒就是清一次）。建议珍品 =「额外清除 1 层同类状态」或「免疫时长 +50%」，具体映射待 P0 实测后定（另见 §3.9）。

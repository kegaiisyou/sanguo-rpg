# 乱世烽火 · 经济系统设计文档（草案 v0.1）

> 状态：设计阶段，未实现。本文件用于对齐"货币 / 材料 / 容器 / 配方 / 存档"的共识，
> 是后续「挖矿系统」「修筑城墙」「装备制造」三个功能的**共同地基**。
> 当前不建议一次性做完整经济树，先定骨架（第 8 节数据模型），随第一个吃资源的功能落地。

---

## 0. 背景与定位

本作是武侠 RPG（文字 UI）。当前已有雏形种子，可扩展、不要从零造：

- `shared/data/items.js` —— 物品定义（装备/消耗）
- `handleAction` 中 `market` 动作 + `ev_merchant` —— 商人/交易雏形
- `state.reputation` —— 声望（已存在的"社交货币"）

参考对象（详见第 7 节接口说明）：

- **魔塔冒险者**：基地生存 + 制造，多级转化链（水+小麦→面包→换铁矿→升级/装备）、科技树控节奏、元进度（五石转生）。
- **A Dark Room**：全文字资源经济范式（木→炭→铁→钢，建建筑扩地图），手机友好。
- **侠客行 / 文字 MUD**：武侠经济正统（挖矿→打铁→造兵器、摆摊、钱庄），气质最贴。

设计目标：把"魔塔式生存制造"换成"江湖式 **采集 → 锻造 → 打造 → 营建**"，全文字面板呈现。

---

## 1. 设计原则

1. **先地基后树**：资源 + 容器模型是所有经济功能的地基；先建地基，再做挖矿/城墙/制造各自的分支。
2. **多级转化**：原料 → 半成品 → 成品，资源层层提纯（借鉴魔塔），强化"经营感"。
3. **产/消双向**：没有消耗口（sink）的经济是摆设。每个产出口都要有对应 sink。
4. **货币分层**：不只用一种钱；区分"交易货币 / 社交货币 / 材料 / 功勋"。
5. **节奏靠技艺/科技门控**：配方解锁由"技艺等级"或"科技"控制，避免早期一口气全开。
6. **存档可迁移**：新增字段走 `defaultSave.version` 存档版本迁移，**切勿动** `LF.CONSTANTS.VERSION`（那是显示版本）。

---

## 2. 货币体系（分层）

| 货币 | 字段建议 | 用途 | 来源 |
|---|---|---|---|
| 碎银 / 铜钱 | `state.coin` | 通用交易（商人、店铺、贿赂） | 任务奖励、战斗掉落、卖材料 |
| 声望 | `state.reputation`（已有） | 解锁势力 / 高阶任务 / 打造许可 | 扬名、完成任务 |
| 材料 | `state.inventory` / `state.cart` / `state.stocks` | 专供锻造/营建，不通用交易 | 采集、掉落 |
| 功勋 | `state.merit`（待定） | 军事建造（修城墙、募兵） | 守城、出征 |

> 设计要点：材料**不**直接当钱花，必须经工作台转化为成品/构件才有"价值"，制造稀缺与经营深度。

---

## 3. 材料 / 资源模型（`MATERIALS`）

所有资源走统一字典，支持堆叠、分级、单位。建议定义：

```js
// shared/data/materials.js
LF.MATERIALS = {
  // ── T0 原料 ──
  ore:      { name:'矿石',   tier:0, stack:99, unit:'块', desc:'未炼的粗矿，可入炉。' },
  log:      { name:'木材',   tier:0, stack:99, unit:'根', desc:'砍斫所得的粗木。' },
  herb:     { name:'草药',   tier:0, stack:99, unit:'株', desc:'山野本草，可炼丹。' },
  hide:     { name:'兽皮',   tier:0, stack:99, unit:'张', desc:'猎获生皮，需硝制。' },
  stone:    { name:'石料',   tier:0, stack:99, unit:'块', desc:'夯土营墙之资。' },
  // ── T1 半成品 ──
  iron:     { name:'铁锭',   tier:1, stack:99, unit:'锭', desc:'矿石熔炼所得。' },
  plank:    { name:'木板',   tier:1, stack:99, unit:'块', desc:'木材解出的板材。' },
  medmat:   { name:'药材',   tier:1, stack:99, unit:'份', desc:'草药炮制的药料。' },
  leather:  { name:'革',     tier:1, stack:99, unit:'张', desc:'硝制过的熟皮。' },
  // ── T2 成品（多数为配方产出，不在此直接"采集"）──
  weapon:   { name:'兵刃',   tier:2, stack:9,  unit:'柄', desc:'锻造台所出。' },
  armor:    { name:'甲胄',   tier:2, stack:9,  unit:'领', desc:'锻造台所出。' },
  pill:     { name:'丹药',   tier:2, stack:9,  unit:'粒', desc:'药炉所出，疗伤续力。' },
  wall_seg: { name:'墙段',   tier:2, stack:99, unit:'段', desc:'营建所砌就的城墙段。' }
};
```

> 原则：T0 可"采集"得到；T1/T2 必须经工作台由配方转化（见第 5 节）。

---

## 4. 容器模型（多容器，`Containers`）

回答"矿车还是背包"：用**统一容器 + 多实例**，每个容器是一张 `{materialId: count}` 表。

| 容器 | 字段 | 说明 |
|---|---|---|
| 背包（随身） | `state.inventory` | 角色携带，随行可用、战斗可耗 |
| 矿车（坑口暂存） | `state.cart` | 矿坑工作点暂存，需"推车"运回库存 |
| 库存堆（营地/据点） | `state.stocks[campId]` | 建筑/据点共享库存，供营建消耗 |
| 建筑仓（特定建筑） | `state.stocks[buildingId]` | 如锻造台专属料仓（可选） |

统一操作函数（实现时提供）：

```js
function addRes(container, matId, n)   // 入栈，超 stack 截断/提示
function takeRes(container, matId, n)  // 出栈，不足返回 false
function moveRes(from, to, matId, n)  // 容器间转移（背包↔矿车↔库存）
function countRes(matId)              // 跨容器合计（查询用）
```

> 挖矿流程天然形成"采集(矿坑)→矿车→推车回库存→锻造台取料"的小物流环。

---

## 5. 工作台与配方引擎（`Stations` + `RECIPES`）

### 5.1 工作台（`Stations`）

| 工作台 | 字段/地点 | 产出类别 | 门控 |
|---|---|---|---|
| 锻造台 | `smith` | 铁锭、兵器、甲胄 | 技艺 `smithing` |
| 药炉 | `alchemy` | 药材、丹药 | 技艺 `alchemy` |
| 木工台 | `carpentry` | 木板、器械 | 技艺 `carpentry` |
| 营建所 | `build` | 墙段、营寨构件 | 功勋 `merit` |

工作台本身是"地点/建筑"，进入后开放对应配方列表 UI。

### 5.2 配方（`RECIPES`）

```js
// shared/data/recipes.js
LF.RECIPES = [
  // 熔炼：T0 → T1
  { id:'smelt_iron', station:'smith', skill:'smithing', skillMin:1,
    inputs:{ ore:2 }, outputs:{ iron:1 }, time:1,
    desc:'矿石入炉，炼作铁锭。' },
  // 打造兵器：T1 → T2
  { id:'forge_weapon', station:'smith', skill:'smithing', skillMin:3,
    inputs:{ iron:3, leather:1 }, outputs:{ weapon:1 }, time:2,
    desc:'铁锭合革，锻一柄兵刃。' },
  // 炼丹：T0/T1 → T2
  { id:'make_pill', station:'alchemy', skill:'alchemy', skillMin:2,
    inputs:{ herb:2, medmat:1 }, outputs:{ pill:1 }, time:1,
    desc:'草药炮制成丹，疗伤续力。' },
  // 营建城墙：T0 → T2（消耗口）
  { id:'build_wall', station:'build', merit:5,
    inputs:{ stone:10, log:5 }, outputs:{ wall_seg:1 }, time:3,
    desc:'石料木材砌作一段城墙。' }
];
```

### 5.3 技艺（`skills`）

技艺等级由"反复打造"提升（做中学），控解锁节奏（借鉴魔塔科技树）：

```js
state.skills = { smithing:0, alchemy:0, carpentry:0 }; // 做配方 +exp
```

> 早期只开放 T0→T1；T2 成品需技艺达标，避免开局全开。

---

## 6. 产出口（Sources）与 消耗口（Sinks）

**产出口**
- 采集：挖矿（矿石）、伐木（木材）、采药（草药）、狩猎（兽皮）、采石（石料）
- 战斗掉落：怪物掉材料
- 任务奖励：声望 / 碎银 / 稀有材料
- 交易：商人买入

**消耗口（必须有，否则经济无意义）**
- 装备打造 / 强化（吃铁锭 + 碎银）
- 修筑城墙 / 营寨（吃石料 + 木材 + 功勋）—— 用户明确想要
- 炼丹（吃草药）
- 战斗补给（丹药 / 干粮在战中消耗）
- 贿赂 NPC（碎银 / 材料）
- 突破 / 转生（稀有材料，长线 meta sink）

---

## 7. 与现有 / 规划系统的接口

### 7.1 挖矿系统（规划中）
- 工作点 `workSite: 'mine'`：进入后真实产出 `ore` 进 `state.cart`。
- 轻量小游戏（节拍/卡点点击，手机友好）决定暴击/稀有产出。
- 矿脉 `state.veins[mineId]` 记录富集度/耐久，挖竭需另寻矿脉（持久化）。
- 产出经"推车"入 `state.inventory` 或 `state.stocks[camp]`。

### 7.2 修筑城墙（规划中）
- 走 `build_wall` 配方，消耗 `stone/log`，需 `merit`。
- 城墙段累计到阈值 → 解锁守城/出征玩法（新 sink）。

### 7.3 商人 / 交易（已有雏形）
- `ev_merchant` 扩为买/卖面板：卖多余材料换 `coin`；买稀缺材料/装备。
- 软通货：材料 ↔ 碎银 的兑换比，借鉴魔塔"面包换铁矿"。

### 7.4 声望（已有）
- `state.reputation` 作为社交货币：解锁高阶打造许可、势力任务。

---

## 8. 存档 Schema 与迁移

在 `shared/index.js` 的 `defaultSave` 增加（**同时 bump `defaultSave.version`**）：

```js
defaultSave = {
  version: '0.2.0',            // 存档 schema 版本（改了下面结构就 +1）
  coin: 0,
  reputation: 0,
  merit: 0,
  inventory: {},               // 背包：{ ore:5, iron:0 }
  cart: {},                    // 矿车
  stocks: {},                  // 据点库存：{ camp:{ stone:0 } }
  skills: { smithing:0, alchemy:0, carpentry:0 },
  veins: {},                   // 矿脉状态：{ mine_a:{ rich:80, left:120 } }
  // …既有字段不变
};
```

迁移示例（新增字段时）：

```js
function migrate(save){
  if(!save.version || save.version < '0.3.0'){
    save.coin = save.coin || 0;
    save.inventory = save.inventory || {};
    save.cart = save.cart || {};
    save.stocks = save.stocks || {};
    save.skills = save.skills || { smithing:0, alchemy:0, carpentry:0 };
    save.veins = save.veins || {};
    save.version = '0.3.0';
  }
  return save;
}
```

> ⚠ 切记：`defaultSave.version` 是存档版本，与 `LF.CONSTANTS.VERSION`（屏上显示版本号）无关，二者不要混淆，也**不要**为实现经济去改显示版本。

---

## 9. 分阶段落地路线（建议）

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **P0 地基** | 材料字典 + 容器模型 + 储物 UI + 存档迁移（第 3/4/8 节） | 无 |
| **P1 采集** | 挖矿工作点：进矿坑→真实产出 `ore` 入矿车/背包（先不做小游戏） | P0 |
| **P2 物流** | 背包↔矿车↔库存 转移 UI（"推车"） | P0 |
| **P3 转化** | 工作台 + 配方引擎 + 技艺（熔炼/打造先开放） | P0 |
| **P4 小游戏** | 挖矿节拍/卡点小游戏（暴击/稀有） | P1 |
| **P5 消耗** | 修筑城墙配方 + 商人买卖 + 丹药 | P3 |
| **P6 教程接驳** | 序章牢头命令改为"挖矿配额"，让教程 = 真系统 | P1+P3 |

> 当前只需做 **P0 地基**；P1–P6 按需取用，每个都建在 P0 之上。

---

## 10. 风险与待定项

- **UI 密度**：全文字 + 多容器易信息过载，复用现有"渐进揭示"思路，分面板折叠。
- **手机交互**：小游戏用点击/卡点，避免重拖拽；容器切换要顺手。
- **平衡**：转化比、技艺经验曲线、矿脉耐久需实测调参（留 `balance.js` 配置位）。
- **待定**：功勋 `merit` 是否独立货币；建筑仓是否必要；转生/meta 是否纳入本作。

---

## 附录：一次完整经济循环示例（叙事视角）

> 你下矿坑（P1）挖得矿石入矿车，推车回营（P2）转入背包；到锻造台（P3）以 2 矿石炼 1 铁锭，
> 再耗 3 铁锭 + 1 革锻出一柄兵刃（消耗 `smithing` 技艺）；富余矿石卖给商人（P5）换碎银，
> 碎银用于贿赂守卒或买稀缺药材；另一路采石伐木，于营建所（P5）砌作墙段，凑足守城之资。
> —— 一条采集链，多个消费者，经济自洽。

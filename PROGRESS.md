# 乱世烽火 · 进度 / 设计对照文档

> 本文档跟踪「设计基线 `GAME_DESIGN.md`」与「实际落地代码」的对照关系，用于收尾盘点与后续开发接棒。
> 当前版本：`v0.2.0`（见 `shared/config/constants.js` 与 `shared/index.js` 的 `defaultSave().version`）。
> 主端：网页 H5 `index.html`，唯一数据源：`shared/`。

---

## 〇、一句话结论

**游戏框架已搭建完成，且已形成自洽可玩闭环**：研习真招式 → 剿匪/巡山攒声望 → 声望≥20 斩华雄 → 解锁洛阳凯旋；途中三资源（食/水/精力）有硬性限制。剩余项均为「丰富度扩展」，非框架必需。

---

## 一、P 路线图对照表

| 设计项 | 状态 | 实际落地 | 代码落点 |
|--------|------|----------|----------|
| **P0 战斗系统** | ✅ 完成 | 半手动 + 伤害公式 `攻×100/(100+防)` + Buff/Debuff + 华雄 Boss；13 招 + 5 敌 + 4 AI；自动战斗开关 | `shared/combat/engine.js`、`shared/data/martial.js`、`shared/data/enemies.js`、`index.html` 战斗 UI |
| **P1 背包（子集）** | ✅ 完成 | `items` 字段 + 掉落堆叠入库 + 行囊展示（`skillTags` 同屏展示武学） | `shared/index.js` `defaultSave().items`、`index.html` 行囊弹窗 |
| **P2 武学合一（最小版）** | ✅ 完成 | 研习界面接 `learnedMartial`，按 13 艺线分组 + 门槛锁 + 学招涨艺线；行囊/任务显示真招式；发力技巧可装配 | `index.html` `openLearn()`、`skillTags()`、`shared/data/martial.js`（MARTIAL_ARTS） |
| **P3 声望框架** | ✅ 完成 | 8 档称号、状态栏、华雄门控（声望≥20）、任务弹窗展示 | `index.html` `repTitle()`、`renderStatus()`、任务弹窗 |
| **P4 主线门控** | ✅ 完成 | 胜战真实 `addReputation`（山贼+2/流寇+4/黄巾+5/华雄+20）；`state.quest` 计数；华雄→洛阳解锁链（新增洛阳城房间） | `index.html` `endCombat()` 胜利分支、`shared/story/rooms.js`（luoyang 房间） |
| **资源硬性限制** | ✅ 完成 | 饥饿（食/水耗尽）持续扣血；精力耗尽封锁行动；战斗耗精力；状态栏红字警告；三处补「休整」防卡死 | `index.html` `maybeStarve()`、`exert()`、`move()`、`startCombat()`、`renderStatus()` |
| **清理** | ✅ 完成 | 移除木人桩入口；调试台改为 `?dev=1` 才显示 | `shared/story/rooms.js`、`index.html` 更多弹窗 |
| **UI 交互重构** | ✅ 完成 | 场景对象卡片式交互：人物/建筑/家具/出口以卡片呈现，点击展开具体动作（交谈/攻击/休整/移动）；手风琴收起；告别平铺长按钮列表 | `index.html` `ROOM_OBJECTS` 配置 + 重写 `buildActions()` + `.obj-card` CSS |
| **战败封锁** | ✅ 完成 | 战败设 `state.defeated` 封锁一切行动（仅留「休整」）；`endCombat` 清按钮并标记引擎 `result='ended'`，彻底阻断残留 `playTurn`（崩拳等不再可点） | `index.html` `endCombat()`、`buildActions()`、`actRest()` |
| **P2 完整版** | ✅ 完成 | ① 艺线经验由战斗出手累积（`engine.getLineGains`→`endCombat` 胜利结算，`(lv+1)*40` 升级，学招仍 +1）；② 艺线等级→攻/命中/暴击/内力/身法（`effectiveStats` 注入，`atk +0.6/级`、`hitRate 0.92+0.002/级`、`critRate 0.003/级`，内功→内力、轻功→身法）；③ 境界突破效果接入（`engine._buildArt`/`_parseBonus` 解析 `breakthrough` 文本→伤害%/暴击%/破甲/破防/眩晕/连击/必暴击，攻防暴击随境界提升）；④ 命中判定系统（玩家 `hitRate`、敌人 0.9，未命中不造成伤害）；⑤ 研习界面显示每式当前境界 | `shared/combat/engine.js`（`init`+`_buildArt`+`_parseBonus`+`calcDamage`+`_resolveAction`+`getLineGains`）、`index.html`（`effectiveStats`/`startCombat`/`endCombat`/`renderStatus`/研习界面） |
| **P1 装备系统** | ✅ 完成 | 武器/防具/饰品/坐骑四槽 + 5 档品质（凡品→神兵）+ 耐久衰减损毁；战斗掉落生成、行囊装备/卸下、有效属性并入战斗（攻/防/血/内/速） | `shared/data/items.js`、`shared/data/enemies.js`（drop.equip 配置）、`shared/combat/engine.js`（getDrop 生成）、`index.html`（`effectiveStats`+行囊装备面板+耐久衰减） |
| **P3 善恶双轨** | ✅ 完成 | ① `karma` 单值拆为 `chivalry`/`notoriety` 独立双轴（互不抵消，旧档自动迁移）；② 事件抉择按 `choice.moral` 累积侠义/凶名（含「趁火打劫」「强夺」等凶名选项）；③ 阈值解锁（侠义≥30→侠义委托、凶名≥30→影门悬赏、双≥40→枭雄隐藏事件）；④ NPC 态度系统（`npcAttitude` 依 `align` 阵营+双轴出 敬重/友善/平常/戒备/敌视/亲近/看重，敌视拒谈）；⑤ 风评称号 `moralTitle`（清流义士/绿林枭雄/亦正亦邪·枭雄…）；⑥ 状态栏与行囊展示双轴+风评；⑦ 调试台双轴±10/清零 | `shared/index.js`（`defaultSave`）、`shared/story/events.js`、`shared/story/dialogues.js`、`shared/story/rooms.js`、`index.html`（`normalize`/`moralLabel`/`moralTitle`/`addChivalry`/`addNotoriety`/`afterMoral`/`npcAttitude`/`talk`/`runEvent`/`renderStatus`/行囊/调试台） |
| **P5 影门** | ⬜ 仅骨架 | 设计文档仅占位，代码未实现 | — |
| **P6 家族兴衰** | ⬜ 仅骨架 | 设计文档仅占位，代码未实现 | — |

---

## 二、已落地系统详解

### 2.1 战斗系统（P0）
- **伤害公式**：`伤害 = 攻 × 100 / (100 + 防)`（防御递减，防堆死）。
- **节拍（beat）**：每招式带 `beat` 出招耗时，速度/轻功降低节拍、触发额外行动；重招节拍长、轻招可连击。
- **战意槽**：普攻/受击攒战意，满槽放绝技（`type==='ultimate'`）。
- **4 种 AI**：`aggressive`（猛攻）/ `defensive`（守势）/ `balancer`（均衡）/ `boss`（`hua_xiong` 专用，带阶段文本）。
- **自动战斗**：开关在战斗界面，AI 按策略自动出招并加速演出。
- **修复记录**：自动战斗 bug（行动者判定）+ 4 处代码层隐患（lint 全程 0 错误）。

### 2.2 武学合一（P2 最小版）
- **真招式 = 真出招**：`MARTIAL_ARTS` 既用于研习也用于战斗，消除旧 `G.SKILLS`（纯数值加成）与战斗脱节的「假武学」。
- **13 艺线分组**：`fist/sword/blade/spear/staff/halberd/hammer/whip/bow/hidden/ride/light/internal`，研习界面按线分区展示。
- **门槛锁**：`learn.lineMin` 要求对应艺线等级；学一招该线 +1 级，玩家自然爬树解锁高阶招。
- **发力技巧层**：`type==='technique'`（如寸劲），可脱离本武学装配任意招式，行囊带 `◆` 金标。

### 2.3 资源硬性限制
- **食/水**：随行走、时辰流失；耗尽则 `maybeStarve()` 在每次行动/战斗结算侵蚀气血（食尽 -6、水尽 -4，双尽 -10，下限保 1）。
- **精力**：移动 -4、应战 -5；`exert()` 守卫在移动/市集/巡山/赴洛阳/应战前检查，≤0 则封锁并提示「须先休整」。
- **防卡死**：城/林/溪三处均补「休整」入口，力竭后任何房间都能恢复。
- **状态栏警告**：精力耗尽显示红色「⚠ 精力耗尽·无法行动」；食/水为 0 数值标红并提示「饥馁缠身」。

### 2.4 主线门控（P4）
- 斩华雄后 `state.quest.luoyang=true`，营中「赴洛阳」入口解锁，新增洛阳城房间（朱雀大街凯旋剧情 + 休整）。
- 任务弹窗展示：剿匪计数、斩华雄状态、洛阳解锁状态、真实声望称号。

---

## 三、代码落点索引（维护用）

| 文件 | 职责 |
|------|------|
| `index.html` | H5 主端：UI 渲染、状态栏、研习/行囊/任务/更多弹窗、`handleAction` 调度、战斗界面、资源逻辑（`advanceTime`/`maybeStarve`/`exert`） |
| `shared/index.js` | `defaultSave()`（存档结构）、`normalize()`（旧档兼容）、`applySect()`（门派加成） |
| `shared/combat/engine.js` | 战斗引擎：初始化、回合、出手、Buff、AI、结算 |
| `shared/data/martial.js` | `MARTIAL_ARTS`：招式/绝技/发力技巧 + 13 艺线定义 |
| `shared/data/enemies.js` | 敌人模板（含声望奖励隐含映射见 `index.html` `RREP`） |
| `shared/data/rooms.js` → 实为 `shared/story/rooms.js` | 房间/出口/NPC/actions（营/城/林/溪/洛阳） |
| `shared/config/constants.js` | `GAME_NAME`、`VERSION`、`OFFLINE_CAP_HOURS`（离线收益上限，当前预留未启用） |
| `GAME_DESIGN.md` | 设计基线 v2.2 |
| `PROJECT_GUIDE.md` | 三端统一规范（主端 H5） |

> ⚠ 注意：设计文档 §3.1 计划的结构为 `shared/story/*`、`shared/config/*`，实际落点为 `shared/data/*`、`shared/story/rooms.js` 混用，与计划略有出入但功能自洽，可后续规范化。

---

## 四、存档兼容

- `defaultSave()` 含完整字段；旧档经 `normalize()` 自动补 `quest`、三资源、艺线键等，升级无痛。
- 调试台仅在 URL 带 `?dev=1` 时出现（如 `http://localhost:8123/index.html?dev=1`），常规玩家不可见。

---

## 五、下一步建议（按优先级）

| 优先级 | 项 | 说明 | 依赖 |
|--------|----|------|------|
| ✅ 已完成 | 装备系统（P1 完整） | 四槽+品质+耐久，掉落生成并接入战斗属性（详见路线图表） | — |
| ✅ 已完成 | P2 完整版 | 艺线经验由战斗累积+学招、艺线等级→攻/命/暴/内/速、境界突破效果接入、命中判定系统（详见路线图表） | — |
| ✅ 已完成 | P3 善恶双轨 | 侠义/凶名独立双轴 + 阈值解锁（侠义委托/影门悬赏/枭雄隐藏线）+ NPC 态度系统（详见路线图表） | — |
| 🟢 | P5 影门 / P6 家族 | 仅骨架，规则待细化 | 阵营/声望系统 |
| 🟢 | 离线收益 | `OFFLINE_CAP_HOURS`/`TICK_MS` 已预留，可启用「操演部众」放置内核 | 主循环 |

---

## 六、当前可玩内容速览（玩点 + 流程）

### 6.1 游戏状态（v0.2.0）
- 框架闭环自洽，5 个场景房间（营 / 城 / 林 / 溪 / 洛阳）
- 战斗：13 招 + 5 敌 + 4 AI + 华雄 Boss；半手动 + 自动战斗
- 武学：13 艺线真招式研习 + 发力技巧装配，研习界面带门槛锁
- 声望：8 档称号，华雄门控声望≥20
- 主线：剿匪 → 斩华雄 → 解锁洛阳凯旋
- 三资源硬性限制（食 / 水 / 精力），力竭封锁、休整恢复
- 背包：掉落堆叠入库、行囊展示（装备用途待接 P1 完整）
- UI：场景对象卡片式交互（点击对象才展开动作）
- 战败封锁：仅留「休整」，战斗按钮彻底清掉、引擎阻断

### 6.2 核心玩点
- 研习武学爬 13 艺线树，门槛锁引导解锁高阶招
- 剿匪 / 巡山 / 治安攒声望，冲击华雄 Boss
- 三资源生存管理，合理「休整」防卡死
- 收集掉落物（入背包，装备系统上线后真正用武之地）
- 自动战斗速通日常

### 6.3 主线流程
颍川主营（出生·研习武学） → 操练场实战攒声望 → 声望≥20 → 挑战台·温酒斩华雄 → 解锁洛阳 → 赴洛阳凯旋

### 6.4 探索 / 副线
- 颍川城：逛市集交易、维持治安、与华老交谈
- 北邙山林：巡山剿匪、林间栖身
- 溪畔草庐：访水镜先生与左慈、草庐借宿

---

*最后更新：2026-07-22（资源硬性限制 + 清理 + UI 交互重构 + 战败封锁 + 装备系统 + P2 完整版 + P3 善恶双轨 完成；武学成长闭环 + 善恶双轨闭环达成：侠义/凶名独立累积、阈值解锁侠义委托/影门悬赏/枭雄隐藏线、NPC 态度随双轴起伏）*

## §9.91 v20261008n（objects.js 抽离 + 修「加载即桥接失效 / 大厅房间误判 / terser 未压缩」三处硬伤）

**① 拆分：房间互动物件 + 差役牌 → `shared/core/objects.js`**
- 从 `engine.js` 抽出约 490 行：`CELL_INTERIORS`（牢房格六门/水槽/铜壶漏刻等）、`JOB_BOARD`（差役牌）、`cellInteriors()`、`wellObject()` 及全部互动物件处理器（`wellDrink/wellDrawToBag/troughDrinkBy/troughFillBy/troughDrawToBag/loukeLook/ledgerLook/diaodouStrike/yutuLook/junbaoLook/rackTake/kitchenPour/watchLook/rummageFind/rummageTarget/cookDouzhou/cookYeCai/shuicao*`）与常量 `TROUGH_CAP/WATER_PER_TRIP/WATCH_HOUR/RUMMAGE_SPOTS`。
- 沿用既有工厂范式 `LF.createObjects(ctx)`，登记 `tools/bundle.manifest` #84；`busyAct`/`LABOR_PER_WOOD`/`jobOpen`/`farmHas` 均经 ctx 注入。
- 至此 `shared/core/` 已拆出 construction / strategicMap / icons / time / ui / objects 等模块。

**② 修复：`window.enterGame` 变 undefined（加载即失效，页面却 0 报错）**
- 真凶不是 terser——`engine.js` L4427 的 `try{...}catch(e){}` 把整段初始化（含 L4317 桥接块）包住，捕获后只往 `document.body` 写 `<pre>`，不抛错也不进 console，故冒烟「0 错误」但桥接从未执行。
- 捕获该 `<pre>` 后拿到实际异常：`ReferenceError: fxGet is not defined`——`fxGet` 在抽取中进了 `objects.js` 闭包却未在 `return` 暴露，而 `engine.js` L224 的 `Farm` 注入仍引用它（`Farm` 创建早于 `OBJ`，用不了 `OBJ.fxGet`）。
- 修法：`fxGet` 保留为 engine 作用域的 fixtures 原语，经 `ctx.fxGet` 注入 `objects.js`，Farm 注入不变。

**③ 修复：`construction.js` / `strategicMap.js` 的 getter 系统性误用（进局必崩）**
- 两模块把 `ctx.getIsBldRoom` 等「**返回函数的 getter**」当成函数本身直接调用：`isBldRoom(roomId)` 实为调用 getter 并忽略参数、恒返回真函数 → **任何房间都被误判为楼房间**，随后 `bldForRoom(roomId)` 返回的是函数、`_f.ar` 为 undefined，崩在 `_f.ar.objs`。
- 连带 `toast() / log() / save() / packFind() / buildActions()` 等**全部静默空转**（只取回函数、从不执行）——不崩但功能无声失效。
- 修法：两模块统一加 `_wf` 包装（运行时先取真身再转发参数），与项目既有约定 `getLog()('…')` 一致；另修 `engine.js` 传给 construction 的 `itemIconHTML` 因赋值时点靠后而为 `undefined`（改惰性 getter）。

**④ 修复 terser 回归：bundle 一直未压缩发布**
- `tools/bundle.py` 用了非法选项 `functions:false` → terser 直接失败并静默回退**未压缩 1.6MB**。改为 `inline:false`（同时避免历史踩坑：内联掉单次调用函数的声明会打断 `window.X` 桥接），现 **1,618,958 → 918,952 字节（-43.2%）**，压缩后复测全绿。

**⑤ 验证（真实 Chromium：playwright-core + chrome-headless-shell）**
- 加载：`enterGame/advanceMinutes/advanceTime` 均为 function，`pageerror` 0、`console.error` 0。
- 进局：`room = camp_tz1`，场景 2 按钮 + 叙事 + 罗盘正常；`advanceMinutes` 多次推进 ok；6 个 dock 面板（角色/行囊/军队/任务/山河/设置）全开无错。
- **抽出的 objects.js 真实生效**：进苦役营囚室格(1,0) 渲染六间牢房门 + 🪣水槽 + ⏳铜壶漏刻；饮水后 `drink 60→68`、`fixtures['kuyilao|1,0'].water = 4`（`fxGet` 播种 12 − 8），处理器与 fixtures 原语链路正确。
- 山河志：SVG 渲染，14 州名 + 武将标记齐全，无「地图加载失败」。
- 版本 `20261008n` 三处对齐（constants.js / bundle.py / index.html 的 bundle+css `?v`）；临时校验脚本已清理。

> 备注：`shared/core/` 下 construction / icons / objects / strategicMap / time / ui 六个模块此前一直未纳入 git，本次随提交入库，后续可用 `git diff` 定位回归。

## §9.90 v20260930l（开发规范固化 + 商街店铺进店交互对齐 NPC 式清单）
- 开发规范写入 `README.md`「开发规范」：每次修改必 bump 版本号（日期+字母制）、改 `shared/*.js` 连跑两次 `bundle.py` 重建、同步 `index.html ?v=`、提交并 `git push origin main`；明确 `PROJECT_GUIDE.md` §6.2 语义版本规则已作废，消除文档矛盾。
- 同步修正文档中过时的 `20260918e` 版本号（`README`/`GAME_DESIGN`）与对 `PROGRESS.md`「权威落地状态」的误标（实为变更日志）；删除冗余的 `docs/dev_log.md`（已并入 PROGRESS）。
- 商街店铺交互从「两按钮（进店+盘下）」改回单一店招按钮，点击弹出 **NPC 式浮动动作清单**：进入 / 观察 / 盘下（仅可盘下且未盘下时出现；已盘下则显示「经营」），与城内 NPC（交谈/观察/给予/攻击）交互一致，不再堆多个按钮。

## §9.89 v20260924z12（美术批·截图实测校准：装备架背景/图标比例/槽位占满/dock风按钮）
- 截图实测（560×1000 手机视口 2x）逐项校准：
- ①装备栏：弃武将立绘（用户嫌大且不好看）→ AI 生成「兵器架」装饰背景（webp 5KB），半透明 opacity .42 + 底部米黄渐变，槽位文字加浅色描边保证清晰；装备槽占满适配——min-height 22→28、槽宽 56→60/62、行距拉开（hat/trinket/cloth/weapon/belt/shoe/bagflow 重新排布）、字号 11.5→12.5。
- ②物品图标比例统一（圆形徽章 vs 方形格子冲突）：行囊格子 54px 配图标 42px（78% 居中不碰边）；仓库格子 58px 配图标 44px；战斗战利品列表图标 22→36px；货郎行囊侧 36px。
- ③交互按钮 dock 融入风：.act 去边框（border:none）、图标 34px+阴影、名字小字在下方、hover 浅金圆角、按压缩放——不再是"按钮套框"感，与 dock 视觉统一。
- 实测截图确认：装备架背景半透明可见、7 槽位文字清晰、物品格图标居中无溢出、场景按钮无边框框感、仓库格子 58px 行囊侧图标 44px 正常。
- 改动：pack.js/storage.js/combat.js/game.css/index.html/constants.js，新增 assets/equip/equip_bg_a.webp（兵器架）/equip_bg_b.webp（甲胄架备用），版本 20260924z12。

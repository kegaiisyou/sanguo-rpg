# 05 · 恶性 Bug 与陷阱清单

> **本文是本项目最重要的一份文档。** 下面每一条都曾真实付出调试代价。
> 动工前请至少通读一遍；改动后若现象诡异，先回来对照。

---

## 第 0 部分：工具层陷阱（会让你以为"改了"其实没改）

### ★ P0-a `replace_in_file` 在本机普遍"假成功"

**症状**：工具返回 `success`，但读真实字节 / `git diff` 显示文件毫无变化。
**影响面**：不止大段插入，连 `constants.js`、`index.html` 的单行版本号替换都中过招。

**对策（硬性规定）**：任何对仓库文件的修改，一律用 **Python 原生 IO** 写回：

```python
import io
p = r'...'
s = io.open(p, 'r', encoding='utf-8').read()
assert s.count(anchor) == 1, 'anchor count=%d' % s.count(anchor)   # 先断言锚点唯一
s = s.replace(anchor, new_text, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
```

写完后**必须读回来核验**：

```python
import io
s2 = io.open(p, encoding='utf-8').read()
print('patched:', '特征串' in s2)
```

### ★ P0-b terser 的 DCE 会删掉"只修改入参对象"的函数

**症状**：`shared/city.js` 的 `seedWards(...)` 在源码里被调用好好的，打进 bundle 后**整个函数定义和所有调用都消失** —— 所有城市的 ward 单元（官署坊/军坊/里坊…）都不生成。开发环境看不出，只在 production bundle 暴雷。

**根因**：terser 跨过程 DCE 判定「只改入参、且读取点跨函数」的函数无外部可见副作用。

**对策**：把这类函数暴露到 window，迫使 terser 视为副作用而保留：

```js
if (typeof window !== 'undefined') window.seedWards = seedWards;
```

（或干脆把逻辑内联到读取它的那个函数里。）

### ★ P0-c terser 会内联"只调用一次的小函数" —— 验证不能靠 `typeof`

**症状**：`ensureStrategicMap` / `prefetchStrategicMap` 压缩后在 window 上 `typeof` 为 `undefined`，误判"改动没进 bundle"。

**根因**：函数体被展开到调用点，声明消失，但**功能是正常的**。

**对策**：验证 bundle 内容一律用**静态 grep 特征串**（如 `Promise.all`、`requestIdleCallback`），不要运行时 `typeof`。

### ★ P0-d PowerShell 的几个固定坑

| 坑 | 表现 | 对策 |
|---|---|---|
| `@{u}` / 花括号 | `MissingEqualsInHashLiteral` | git 上行引用写成 `-u` 或省略 |
| 嵌套引号 | `node -e "<含引号 JS>"` 被解析破坏 | 一律写成 `.js` / `.py` 文件再执行 |
| 中文输出 | `'gbk' codec can't encode` | `python x.py > out.txt` 再读文件；或脚本内 `io.open(..., encoding='utf-8').write()` |
| `Split('?v=')` | 被当 char[] 分隔符拆错 | 用 `Substring(0, IndexOf('?v='))` |
| 批量删目录 | `Remove-Item` 递归被守卫拦截超时 | 用 Python `shutil.move` 搬走 |

---

## 第 1 部分：代码层恶性 Bug（勿重犯）

### #1 `bundle.js` 长期没跟着源码重建（结构性风险，最该警惕）

**现象（本轮实测）**：仓库 HEAD 版本的 `bundle.js` 里 `fillStyle` 出现 **0 次**，即它**不含 `gamble.js` 等较新模块**。也就是说提交的 bundle 是陈旧构建。

**危害**：浏览器加载的是 bundle。谁改了源码却忘了跑 `bundle.py`，线上代码就和源码差一大截 —— 而且**页面不报错、版本号还对**，极难察觉。

**规则**：
- 改任意 `shared/*.js` → 必跑 `python tools/bundle.py`（**连跑两次**，原因见 02 文档）。
- 提交前自查：`git diff --quiet shared/bundle.js` 应非空（说明确实重建过）。

### #2 工厂三步骤缺一步 → 静默 ReferenceError

模块是 `LF.createX(ctx)` 工厂模式。任何跨模块 helper 必须**三步齐活**：
1. 加进工厂内部；
2. 加进末尾 `return {...}`；
3. 加进 `engine.js` 顶部别名块 `var X = City.X`。

**漏任一步 = 运行时 ReferenceError，且只在最早运行时才暴露。**
实例：曾把 `cellNarr/cellInteriors` 塞进工厂却没挂 return + 别名，导致 `renderRoom` 首帧崩、卡死 `enterGame`。

**避险**：如果某个 helper **只有 `engine.js` 用**，直接放 engine 全局，别绕工厂闭包。

### #3 `state` 会被重新赋值 —— 必须用 getter 注入

引擎 `Core.state = state = normalize(...)` 在**读档/新游戏时会重赋值**。

**规则**：抽出的模块里绝不能顶层 `var state = getState()`，必须惰性取值：

```js
var getState = ctx.getState;
function foo() { var st = getState(); /* 用 st */ }
```

同理，`settings`、`currentModalKind`、`cityBuildState` 这类**primitive 或后赋值**的绑定都必须 getter 注入，否则捕获的是快照或 `undefined`。

### #4 向早期工厂注入"后赋值的函数" → 必须包装

**症状**：线上崩溃 `TypeError: k is not a function (In 'k(t.ROOMS[E.room])')`，栈里含 `checkTriggers`。

**根因**：`renderMoveBar` 由 `movement.js` 别名注入、赋值在 engine L2180，但 `LF.createTriggers` 在 L147 就执行了，传进去的是当时的 `undefined`；工厂闭包存下该 undefined，后来才用就炸。

**对策**：传包装函数，延迟取值：

```js
renderMoveBar: function(){ return renderMoveBar.apply(null, arguments); },
```

（与 `packAdd` / `startCombat` 同款范式。）

### #5 `shared/gen/rooms.js` 的 `room()` 把 `kind` 存成了 `_kind`

第 35 行 `if (o.kind) r._kind = o.kind;`

**规则**：判断房间类型必须写 `(room._kind || room.kind)`。
写 `room.kind === 'dungeon'` **永远为 false**，分支静默不生效（排查时非常隐蔽，`spawns/loot/floor` 等字段倒是正常保留）。

### #6 `__cell__:` 协议串必须用**冒号**分隔坐标

正确：`__cell__:kuyilao:1:0`
错误：`__cell__:kuyilao:1,0` ← 逗号会被 `split(':')` 切成 `'1,0'`，`+'1,0'` = `NaN`，进而 `TypeError: Cannot read properties of undefined`。

两处解析端（`exitDisplayName` 与 `move`）都按 `:` 拆，务必统一。

### #7 浮窗关闭按钮引用了外层函数（作用域越界）

**症状（用户报告）**：点货郎/商店物品详情浮窗的关闭按钮 → `ReferenceError: clearSel is not defined`。

**根因**：`clearSel` 定义在 `bindShopPanel` 内部，而引用它的 `shopFloatShow` 是**工厂级函数**，作用域不包含前者。

**对策**：把共用的小函数提升到**工厂级**，供二者调用。这类"UI 共用 helper"最容易放错层级，写完自查调用链。

### #8 CSS 层叠遮挡：战斗时 `#dlg` 压住战斗指令（**导致战斗完全卡死**）

**症状**：进战斗后，普攻/招式/防御/道具/撤退**全部点不动**，战斗永远停在"待下令"。点 60 次毫无反应，且无 JS 报错。

**定位**：用 `elementsFromPoint(按钮中心)` 查看**最顶层元素** —— 结果显示是 `DIV.dlg-foot`，而不是按钮本身。

**根因**：CSS 已规定战斗时隐藏 `#lower/#dock/#npc-list`，**唯独漏了 `#dlg`**。而 `#dlg` 是 `position:fixed; bottom:0; z-index:67`，远高于静态布局的战斗菜单 `#actions`。凡是"对话选项答毕立刻开战"的路径都会中招。

**修复**：

```css
#app.in-combat #dlg,
#app.in-combat #dlg-veil{ display:none; }
```

**教训**：这类 bug **没有任何报错**，只能靠 `elementsFromPoint` 或视觉检查发现。见下文"排查方法论"。

### #9 无 canvas 环境下顶层 `getContext` 崩溃 → 引擎整个起不来

**症状**：`TypeError: Cannot set properties of null (setting 'fillStyle')`，连带 `window.openModal` 未暴露、`LF.createPanels` 缺失。

**根因**：`gamble.js` 的 `PAPER` 是顶层 IIFE，加载即 `getContext('2d')`；jsdom 等无 canvas 环境返回 `null`。

**对策**：

```js
var g = c.getContext && c.getContext('2d'); if (!g) return c;
```

真实浏览器恒有 2d 上下文，行为不变。

### #10 JS 单引号字符串不能跨**真实换行**

用 here-string / 多行文本去拼 `'...'` 字符串链 → `SyntaxError: Invalid or unexpected token`。
对策：HTML 片段写**单行**，或用 `\n` 转义。

### #11 `index.html` 曾重复引入同一 script

后果是函数被定义两遍、状态混乱。教训：新增 `<script>` 前先 grep 文件名，确认不重复。现在已统一成单个 bundle，风险基本消除。

---

## 第 2 部分：排查方法论（卡住时按这个顺序查）

### 症状 → 首选排查手段

| 症状 | 第一步就做这个 |
|---|---|
| **按钮点不动/点了没反应、无报错** | `document.elementsFromPoint(cx,cy)` 看顶层是谁 → 是不是被别（`dlg-foot`、父容器）遮挡 |
| 按钮灰着/看似可点但没触发 | 查 `classList.contains('locked')` 与 `getComputedStyle(btn).pointerEvents`（`none` 就是被锁） |
| UI 看似卡死 | 先看是不是**叙事队列还没播完**（`interactBusy()` 为真时会全局上锁，需继续点/等待） |
| bundle 里有没有这次改动 | 静态 grep 特征串（绝不用 `typeof`） |
| 某功能在开发环境好、线上没有 | 高度怀疑 bundle 没重建 / terser DCE 删了函数 |
| 面板打不开 | 检查 modal 是否 hidden、有没有并行弹窗被上层盖住 |

### 通用口诀

- **"点不动先查层叠"**：`elementsFromPoint` 是本项目最常用的定位武器，比看代码快得多。
- **"改了没生效先怀疑工具"**：本机 `replace_in_file` 不可靠 —— 先读回真实字节确认改动落地。
- **"线上没有必查 bundle"**：跑了 bundle 吗？跑够两次了吗？版本号三处对齐了吗？

---

## 第 3 部分：交付前的强制自查

- [ ] `python tools/bundle.py` 跑了**两次**
- [ ] `shared/config/constants.js` 的 `VERSION` == `tools/bundle.py` 的 `VERSION` == `index.html` 所有 `?v=`
- [ ] 若改了 css：`index.html` 的 `game.css?v` **手动** bump
- [ ] 若新增模块：`tools/bundle.manifest` 已登记（顺序要在依赖它的模块之前）
- [ ] `node --check shared/bundle.js` 通过
- [ ] `node test/syntax_check_all.js` 与 `node test/cross_reference_check.js` 通过
- [ ] 浏览器实测过主流程（无 pageerror）

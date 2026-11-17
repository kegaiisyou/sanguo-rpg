# iPhone 16 Pro 完整体玩走查报告 · v20261116c

> 日期：2026-11-17 · 版本：`v20261116c` · 结论：**统一天下链路 PASS**，发现并修复 3 个 bug

## 一、测试环境

| 项 | 值 |
| --- | --- |
| 设备 | iPhone 16 Pro（Playwright 模拟，非物理真机） |
| 逻辑视口 | 393 × 852 px |
| 设备像素比 | 3（物理 1179 × 2556） |
| 触摸 | `hasTouch:true` / `isMobile:true` |
| UA | iPhone OS 18_0 / Safari 604.1 |
| 服务 | 本地 `serve_nocache.py` @127.0.0.1:8124 |
| 浏览器 | chrome-headless-shell 152.0.7977.30 |

**限制说明**：这是 Chromium 内核按 iPhone 16 Pro 规格的模拟，非 iOS Safari（WebKit）。可覆盖布局溢出、触控热区、交互链路、JS 报错；无法覆盖 WebKit 渲染差异、真实多点触控手感、Safari 私有 API 行为。

## 二、走查流程与结果

| 步骤 | 结果 |
| --- | --- |
| 冷启动加载 | OK，0 pageerror / 0 consoleError |
| 视口与缩放 | `innerWidth=393, dpr=3, docW=393`，**无横向溢出** |
| 进游戏 + 教学毕业 | OK，落 `camp_tz1`（开局 1 兵 / 200 两 / 0 粮） |
| 任务日志 / 背包 / 角色 / 军令台 | 全部可开、无溢出 |
| 天下大势 / 朝堂 / 山河志 / 调试台 | 全部可开、无溢出 |
| 底部 dock | 6 项均 66×63px，热区达标 |
| 调试台「一键城主开局」 | OK，落 `hulaoguan`，500 兵 / 3550 两 / 州牧 |
| 全图归我 → checkUnify | **72 / 72**，`flags.unified=true`，胜利面板显示 |
| 胜利面板文案 | 「海内一统 / 天下一统 / 72/72 / 削平 8 镇诸侯 / 历时 0 日」 |
| 胜利面板后继续游玩 | 按钮可达 |
| 终局全局溢出复查 | `docW=393 = innerW`，无溢出 |

**总结论：ALL PASS**，0 pageerror、0 consoleError、0 布局阻断。

## 三、发现并修复的 bug

### Bug 1 · 升级「破境」弹窗顶替当前面板（阻断统一流程）

- **现象**：调试台点「一键城主开局」后，破境弹窗弹出并盖掉调试台，导致「查看统一进度 / 全图归我」按钮找不到，统一流程走不下去。此前记录中「朝堂被破境顶替」是同类问题，一直未做产品侧修复。
- **根因**：`shared/core/progression.js` 的 `addXp()` 升级时无条件 `openModal('levelup')`；且触发时机常在 `forceRoom()/closeModal()` 之后，同步「面板忙」判定也不准。
- **修复**：
  1. 升级不再自动弹破境面板，改为日志 + toast 提示（角色面板本就有「加点」页签，自由点随时可分配）；
  2. `engine.js` 给 `createProgression` 注入 `getModalBusy` / `getToast` / `getLog`。
- **验证**：修复后 `lordStart` 不再弹破境，调试台按钮保持可达，统一链路走通。

### Bug 2 · 调试台按钮触控热区不足 44px

- **现象**：iPhone 16 Pro 规格下 `.dev` 按钮实测 35px 高（最低触控建议 44px），`grantAll` 等按钮点击精度差。
- **修复**：`shared/css/game.css` 给 `.dev` / `.dev-sel` / `.dev-input` 加 `min-height:44px`，padding 8→10px。
- **验证**：修复后实测 42–44px，满足触控下限。

## 三·补 · 逐城真实攻城批次（用户「需要」后的追加走查）

用玩家真实入口 `window.commandCampaign(cid)`（命将：`campaignCheck` 准入 → 兵力/城防胜算 → `conquerCity` 易帜 → 驻军前移 → 折兵/声望）从城主开局逐城推进，而非调试台 `grantAll` 一键给城。

**实测事实**：
- 城主开局（虎牢关 + 500 兵 + 1200 军粮）后，真实命将连下 2 城（邺城、巨鹿），有真实胜负/折兵/易帜；
- 之后停摆——再次征伐被 `campaignCheck` 的军令额度 / 邻接距离 / 军粮三重真实约束拦下，**这是设计，不是断链**；
- 全图统一最终仍由调试台 `grantAll` 完成（72/72、胜利面板正常），但**未宣称「逐城真实打完 72 城」**——纯逐城征服需要按月度经营（恢复军令、籴粮、募兵、沿邻接推进），是长周期玩法，非一次走查可穷尽。

**本批次新发现的 bug（已修）**：

### Bug 3 · 「一键城主开局」送的 1200 军粮被传送重置为 0（阻断真实攻城）
- **现象**：`lordStart` 日志写「得军粮 1200」，但实测 `st.army.logistics.grain = 0`，真实命将打 2 城后即因「军中无粮」全部被拒。
- **根因**：`dev.js` 在 `forceRoom()` **之前**写 `grain=1200`，而 `forceRoom` 内部军务就食（`army.js` 的 `tickArmyDay` 补给分支）把军粮重算覆盖。
- **修复**：把 1200 的赋值移到 `forceRoom()` **之后**（补回 `_a2.logistics.grain = 1200`）。
- **验证**：修复后实测 `grain=1200`、`armyBuyGrain(200)` 花 17 两补到 1400，真实攻城可继续。常驻回归加 A3-1/A3-2 两条断言（战略层 34→36 PASS）。

### 触控密度修复（观察项已转已修）
- 页签类 `.qtab / .pack-tab / .ch-tab / .am-tab`、`.sect-join / .sect-open / .sc-handle` 统一 `min-height:44px`；computed 实测 44.1px（此前 21–28px）。
- 紧凑数据行（`.fac-assign / .fm-lord / .fm-mr-nav` 的 `.btn.sm`）刻意保持原尺寸，未强行抬升以免破坏布局。

## 四、仍存在的观察项（非阻断，未修）

主操作/页签类已在补批次修复（见三·补）。**以下仍低于 44px**，属紧凑数据行与全站视觉密度，非阻断：

- 任务日志页签（进行中/已完成/志业）81×28px
- 背包分类页签（全部/素材/药剂…）47×21px
- 角色页签（状态/加点/装备/技能）56×27px
- 军令台页签 56×27px，部分动作 42px
- 天下大势「外交」按钮 43×23px
- 胜利面板「观志业 / 继续游玩」126×35px

这些按钮在真机上仍可点中（宽度够），但不符合 44px 触控最佳实践，建议后续全站统一处理，不要零散改。

## 五、回归与门禁

- `npm test` 全绿（6 脚本串联）
- `verify_versions.py` PASS，四源一致 `v20261116c`
- 改动 JS 文件 `node --check` 全过
- Playwright iPhone 16 Pro 全流程：ALL PASS

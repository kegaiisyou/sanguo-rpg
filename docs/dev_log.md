# 开发进度日志

> 记录每次迭代的开发进度、版本号与已知问题。版本号规则：`YYYYMMDD` + 字母序号（如 `20260820be`），唯一来源 `shared/config/constants.js` 的 `LF.CONSTANTS.VERSION`，修改 shared/*.js 后需同步 `index.html` 中对应 `<script src="...?v=...">` 缓存参数。

---

## 2026-08-20 · 山河志空间地图大迭代（v20260820av → be）

本轮聚焦地图的可用性与表现力，共修复 4 类问题并完成多轮视觉优化。

### 已落地

1. **字体模糊根因修复（av）**
   - 根因：`.map-viewport` 的 `translate+scale` 叠加标签内 `transform:scale(1/scale)` 反补偿，双层 transform 破坏 WebKit/Chromium 子像素抗锯齿，HTML 文字全糊。
   - 方案：HTML 标签（城池/区域/房间）整体从 `.map-grid` 抽出到兄弟层 `.map-overlay`，overlay 仅跟随平移；SVG 州名保持矢量 + 字号反补偿。
   - 关键样式：`.map-overlay{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;}` + `.map-overlay .map-zone,.map-overlay .map-pin{pointer-events:auto;}`。

2. **放大看不到房间修复（aw / 二次修正）**
   - 首次修复（aw）：降 `LV1` 至 1.25、去掉强制 `maxScale=1.5`（1.5×2760=4140px 超 GPU 4096 纹理上限）。
   - 二次根因（ax）：`.map-overlay` 是 `.map-viewport` 子元素，`apply()` 把 scale 加在 viewport 上导致 overlay 被二次缩放，房间节点被放大成 `wx*scale²` 推出视口。
   - 最终方案：`vp` 仅 `translate(tx,ty)`，`scale(scale)` 移交给 `.map-grid`（加 `transform-origin:0 0`），overlay 只继承平移。

3. **地图旅行与定位（ay）**
   - 新增 `goRoomOnMap(rid)`：点击房间节点直接前往（体力-4/食物-1/饮水-1/时间+1），与步行同消耗。
   - 修复 `centerWorld` 坐标错位：之前用「网格格子数学」(c-MIN)*cell，节点实际用 REF 仿射 `px(c)`，两套坐标系不一致导致点击州/城后节点在屏幕外。改用仿射系数 `MAPWK/MAPWB/MAPHK/MAPHB` 精确对齐。

4. **北上路线打通（az）**
   - 根因：白檀军屯 6 房间坐标全部叠在渔阳城内（营门 `[14,-5]` 与渔阳通衢同点），剧情"北出即燕山"但坐标上白檀在渔阳北门南边，北上断档。
   - 修复：白檀整体北移 → `渔阳北门[14,-7] → 白檀营门[14,-8] → 白檀屯寨[14,-9] → 燕山山口[14,-10]` 一条直线。同步移动 zone 与区域底色。

5. **地图范围与观感（ba / bb / bd / be）**
   - 仿射范围从 `COL -12..18 / ROW -7..20` 扩展到 `COL -13..19 / ROW -15..21`：燕山（row -10/-11）此前映射为负像素、在地图外，现全部纳入。
   - 画布高度 54vh/460px → 64vh/560px。
   - 去除十三州填充色块 → 再去州界线（polygon `fill/stroke` 全透明，保留点击热区）。
   - 图例去掉「教学」，移入 canvas 内（原相对弹窗右上角会挡住「山河志」标题）；比例尺/操作提示半透明宣纸底。
   - 州名防遮挡：豫州 `[6,7]→[6,8]`、青州 `[15,5]→[15,4]`（校验后所有州名间距 ≥170px）；州名字号 22→25px、描边 5→6.5px。
   - 初始缩放：不再整图自适应，打开以当前房间为中心落在「区域」档（滚轮缩小可退回州域全图）。
   - 表现力：宣纸质感底纹（纯 CSS radial/repeating gradients）、区域题字改印章朱红 + 疏朗字距、古朴北针装饰。

### 待办 / 已知问题
- [ ] AI 水墨底图生成：任务曾提交成功且 DONE，但未取到下载地址（`assets/map_ai.png` 仍是早期错误图）；底图暂用纯 CSS 宣纸底兜底，出图后改 `.map-bg` 的 `background-image` 即可。
- [ ] 可选优化：回到当前位置按钮、当前房间高亮飘字、塞外地形文字样式、道路动效。

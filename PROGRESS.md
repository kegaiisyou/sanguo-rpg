## §9.87 v20260924z10（美术体验批收尾：布巾矿工/图标48/人形重画/罗盘防压/横滑/进城提示）
- ①矿工头像重画：否决现代安全帽版 → 青灰布巾包头、古铜面庞、粗麻短褐（nWpbfjKDHU 压 240 覆盖 npc-miner/sm_npc-miner）。
- ②物品图标加大且统一：行囊/仓库格子 px 30/18 → 42（雪碧图 w=px+6 → 48px），大小不一的根因是不同面板 px 不同（行囊30/仓库18/战斗15）——大格子统一 48，战斗小格子保持小尺寸。
- ③装备栏人形重画：弃矩形+斜臂方块感 → 流畅人体剪影（圆头/发髻/宽肩收腰躯干 path/交领/腰带/斜垂双臂/双腿 path），viewBox 124×130 不变，装备槽位定位不受影响。
- ④罗盘防压缩：.move-bar min-width:212px + margin:0 auto，不再被左侧 NPC 栏挤窄；#actions 改 flex 横向滚动（场景物件一格高度、多了横拖），不再 grid 撑高页面顶出下部区域。
- ⑤进城动画 → RPG 式地区名淡化：去掉全屏 ink 遮罩，仅中上部朱红大字城名 + 金线淡入淡出 1.9s，pointer-events:none 不挡操作。
- 实测：进城动画 ink 已去除、actions flex nowrap 横滚、move-bar min-width 212px 生效、无 JS 报错。
- 改动：engine.js/pack.js/citybuild.js/game.css/index.html/constants.js/shared/img 矿工头像，版本 20260924z10。

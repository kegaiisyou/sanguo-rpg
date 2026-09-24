## §9.89 v20260924z12（美术批·截图实测校准：装备架背景/图标比例/槽位占满/dock风按钮）
- 截图实测（560×1000 手机视口 2x）逐项校准：
- ①装备栏：弃武将立绘（用户嫌大且不好看）→ AI 生成「兵器架」装饰背景（webp 5KB），半透明 opacity .42 + 底部米黄渐变，槽位文字加浅色描边保证清晰；装备槽占满适配——min-height 22→28、槽宽 56→60/62、行距拉开（hat/trinket/cloth/weapon/belt/shoe/bagflow 重新排布）、字号 11.5→12.5。
- ②物品图标比例统一（圆形徽章 vs 方形格子冲突）：行囊格子 54px 配图标 42px（78% 居中不碰边）；仓库格子 58px 配图标 44px；战斗战利品列表图标 22→36px；货郎行囊侧 36px。
- ③交互按钮 dock 融入风：.act 去边框（border:none）、图标 34px+阴影、名字小字在下方、hover 浅金圆角、按压缩放——不再是"按钮套框"感，与 dock 视觉统一。
- 实测截图确认：装备架背景半透明可见、7 槽位文字清晰、物品格图标居中无溢出、场景按钮无边框框感、仓库格子 58px 行囊侧图标 44px 正常。
- 改动：pack.js/storage.js/combat.js/game.css/index.html/constants.js，新增 assets/equip/equip_bg_a.webp（兵器架）/equip_bg_b.webp（甲胄架备用），版本 20260924z12。

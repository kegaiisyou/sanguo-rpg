## §9.88 v20260924z11（美术批：立绘底图/图标48无拉伸/仓库显眼/场景按钮紧凑）
- ①装备栏立绘：弃 SVG 线条人形 → AI 生成武将全身立绘（水墨工笔、米黄宣纸底，A 握拳站姿主用/B 叉腰站姿备用）压 webp 16KB，装备栏左侧以画像底图呈现（object-fit:cover 顶部对齐，头在头槽位置），装备槽叠在上层。
- ②物品图标解决拉伸与过小：根因是雪碧图格内留白 + 缩小显示。改法：从 items.webp 按内容边界裁出 15 张 → assets/icons/items48/（48px 内容充满、无拉伸），itemIconHTML 优先 <img item-pic48>，缺文件回退雪碧图。
- ③仓库显眼：storage.js 仓库格子 46→58px、物品图标 12→36（渲染 42px），行囊侧按钮图标 12→30（36px）。
- ④场景交互按钮紧凑：.act padding 9→7、字号 13.5→12.5、min-width 96→74，图标 30px、名字单行省略——留白收窄不占满。
- 实测：行囊立绘 equip_art.webp、item-pic48 两张 48px、无 JS 报错。
- 改动：pack.js/engine.js/storage.js/game.css/index.html/constants.js，新增 assets/equip/*.webp、assets/icons/items48/*.png（15），版本 20260924z11。

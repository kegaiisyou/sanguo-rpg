## §9.84 v20260924z7（AI 古风物品图标首批发车：emoji → 图片素材）
- 用户诉求"更多 emoji 替换成图片素材、整体别太敷衍"。方案：AI 生成统一风格的物品图标（工笔水墨+圆形实木徽章+羊皮纸底），
  程序按 defId 映射，有图用图、无图回退 emoji+名字，逐类推进。
- 首批 6 个高频物品：fan 干粮 / xizhou 稀粥 / mucai 木材 / shitiao 石料 / futou 锈斧 / tiekuangshi 铁矿石
  （image_gen 生成 2048 → 压缩 256px ~90KB/张 → 入库 assets/icons/*.png → git 随仓库走 GitHub Pages 同源加载）。
- 接入：engine.js 加 ICON_IMG 映射 + itemIconHTML 改（有图出 <img class="item-pic"> 圆形徽章样式，
  无图出 emoji+名字）；game.css 加 .item-pic/.ic-pic（圆形描边+暖底+微阴影）。
- 实测：行囊格子 fan/mucai 显示图片、无映射物品回退 emoji+名字、无报错。
- 改动：assets/icons/（6 图）、shared/core/engine.js、shared/css/game.css、版本号 20260924z7。

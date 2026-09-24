## §9.85 v20260924z8（美术批量升级+性能根治：雪碧图/压缩/人形/进城动画）
- 性能根因定位：shared/img/ 43MB（AI 原图未压缩，单张 0.5-1.5MB，88 张逐个请求）→ 手机端必卡、部分加载失败（"dock 图标只有一部分"）。
- ①压缩：87 张全部压至 240px PNG optimize（43MB→3.8MB），文件名不变、代码引用零改动；补 npc-chushi（鲁大，复制 npc-yuzu）。
- ②物品图标雪碧图：AI 生成第二批 9 张（roubao/caoyao/yeguo/mutou/zhuzi/tiekuai/rope/bumu/chutou）+ 首批 6 张 = 15 枚拼入
  assets/icons/items.webp（560x560 4x4，26KB，一个请求加载全部）；engine.js ICON_IMG→ICON_SPR（background-position 百分比），
  删 15 张单图（-1.4MB）。
- ③场景物雪碧图：AI 生成 8 张（老树/斧架/水井/乱石堆/兵器架/记工木牌/铜刁斗/舆图沙盘）拼 scenes.webp（14KB）——本轮仅入库，
  接入待下轮（uiicons 已有 icn-* 压缩版兜底）。
- ④装备栏人形精修：pack.js renderEquipFigure SVG 从紫色几何剪影改古风武将写意（发髻/交领衣袍/腰带/斜臂，赭石棕）。
- ⑤进城过场：engine.js playCityFX + renderRoom 城市检测（FX_PREV_ROOM 去重+3.5s 防抖）——全屏水墨晕开+城名浮现
  （LF.CITIES 取中文名）；小房间不播。
- 实测：行囊 3 格雪碧图正常、人形 SVG 2 path、进长安 #cityfx 显示"长安"、无报错。
- 改动：assets/icons/items.webp+scenes.webp（删 15 单图）、shared/img/*（压缩+补 npc-chushi）、engine.js、pack.js、game.css、版本号 20260924z8。

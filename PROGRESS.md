## §9.86 v20260924z9（体验优化五连：进城动画换新/人形放大/NPC模板头像/布局固定/图标加大）
- ①进城动画去压抑：全屏墨色晕开 → 亮宣纸底 + 朱红城名 + 上下金线展开（0.7s 淡入 + 1.9s 城名浮现，总 2s）。
- ②装备栏人形：equip-figure 124→150px、剪影 opacity .35→.6（更明显，古风武将剪影可见）。
- ③布局修复：status/dock 改 position:sticky（top0/bottom0 + z60）——苦役营牢房/中军物件多把页面撑高时，顶栏/底栏不再被顶出视口。
- ④泛用 NPC 模板头像：AI 生成 5 张（矿工/文士/哨兵/商贩/乞儿，240px ~90KB）+ sm_ 副本；
  uiicons.js 加 NPC_BY_ROLE（24 种 npc_cards role → 模板头像），engine NPC 渲染 avatar 传 role——
  程序生成 NPC（门吏/货郎/庄头/矿工/火头军…）全部有头像，不再 👤。
- ⑤物品图标加大：行囊格子 itemIconHTML 13→30（图 36px），fallback 字号上限 16 防挤爆格子。
- 实测：进城动画 2 金线+亮底、avatar 哨兵/矿工命中模板、sticky 生效、figW150/opacity.6、无报错。
- 改动：engine.js、pack.js、uiicons.js、game.css、index.html、constants.js、shared/img/ 新增 10 文件，版本 20260924z9。

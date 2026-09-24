## §9.82 v20260924z5（农田升级物件暂收 + 柴林门渲染修复）
- 农田三处升级物件（水渠工地/藤条堆/针线笸箩）按用户要求全部暂时移除——农庄格太密太乱。
  升级逻辑（farmUpgrade/up.canal/up.basket/up.seedkeep）原样保留，将来做进 NPC 或别处再挂回。
- 顺带修一个真 bug：cellInteriors 对农田格只拼 objects 就 return，把 CELL_INTERIORS 里定义的柴林门（doors）吞掉了，
  导致农庄格看不到伐木场入口。现改为 `{ doors: d.doors||[], objects: ... }` 原样带出。
- 实测：农庄格 = 农庄组（柴林门）+ 交互物品组（畦+水井，无升级物件）；无报错。
- 改动：shared/core/farm.js（移除升级物件）、shared/core/engine.js（cellInteriors 带出 doors）、版本号 20260924z5。

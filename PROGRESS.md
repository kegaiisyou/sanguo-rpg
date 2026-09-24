## §9.79 v20260924z2（周听涛恢复接取条件+木人三回合判定）
- 周听涛 zt_food_give/zt_food_deliver：恢复「需已接取」（flags.task.zt_accepted）条件——用户要求差事须应下才认账，不放宽。
  notFlag 由 route.crypt 改为 task.zt_food_done：若老档/异常态已置过密道线索旗标（crypt）但任务未结清，crypt 会永久拦死交付——改用完成标记判定，已应下+干粮在手即认，实测异常态（crypt=true）提交成功结清。
- 木人试艺真 bug：木人桩 hp 9999 打不倒，dummy 任务只在战斗胜利（result==='win'）时 jobTick('dummy') 计数——胜利永不可能 → 任务卡死。
  修复：dqResolveRound 敌人阶段后，dummy 敌人且 round>=3（交手满三回合）即强制按胜利结算（不要求击杀，本就不是用来杀的）；
  train_dummy 动作移除上轮误加的 addFlagNum（双计），计数仍走胜利结算 jobTick 官方口径。
- 木料获取确认：不止仓库——伐木场（需斧头 futou/tiefu，锈斧1/铁斧2，60分钟）+ 战斗掉落（mutou weight 30）+ 制作（wood_timber mutou→mucai）+ 仓库（初始 200 mucai + 150 mutou）。
  无斧头只能折枝得小树枝（非木料）——若嫌初期木料紧，可选：新手引导提伐木处/仓库斧头显眼化。
- 改动：shared/story/triggers.js、shared/core/combat.js、shared/core/engine.js、index.html（combat 缓存号 20260924z2）。

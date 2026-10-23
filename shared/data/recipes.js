// 配方数据（外置于引擎，便于横向扩展）
// 结构：LF.RECIPES[工作台标识] = [ 配方... ]
//   配方字段：
//     id    唯一标识
//     cat   品类（用于制作面板标签页分组，如 木材类 / 器具类 / 建筑类）
//     name  产出显示名
//     icon  产出图标
//     out   产出 defId
//     outN  产出数量
//     in:[{id, n}]  输入材料
//     note  配方说明
window.LF = window.LF || {};
LF.RECIPES = {
  // 木工台：T0 素材 → T1 木材
  bench: [
    { id:'twig_timber', cat:'木材类', name:'木材', icon:'🟫', out:'mucai', outN:1, toolKey:'sawLv', in:[{id:'xiaoshuzhi', n:2}], note:'细枝捆扎刨削成材（耗料较多；有好锯可多出材）' },
    { id:'wood_timber', cat:'木材类', name:'木材', icon:'🟫', out:'mucai', outN:1, toolKey:'sawLv', in:[{id:'mutou', n:1}], note:'粗木解板成材（斧伐料更划算；锯越好，一块料解得越多）' },
    { id:'fold_bench', cat:'器具类', name:'便携工作台', icon:'🔨', out:'gongzuotai', outN:1, in:[{id:'mucai', n:3}], note:'以规整木材攒成可折叠的工作台，随行随用' },
    { id:'campfire_kit', cat:'器具类', name:'篝火', icon:'🔥', out:'campfire', outN:1, in:[{id:'mutou', n:2},{id:'xiaoshuzhi', n:1}], note:'干柴捆扎成束，引火即燃，可取暖烘食' },
    { id:'sleep_mat', cat:'器具类', name:'草席', icon:'🛏️', out:'sleepmat', outN:1, in:[{id:'mucai', n:2}], note:'削竹为骨、编草为席，铺地可眠' },
    { id:'make_trough', cat:'器具类', name:'水槽', icon:'🪣', out:'shuicao', outN:1, in:[{id:'mucai', n:2},{id:'shitiao', n:1}], note:'以木材为骨、石料为槽，凿石箍木成槽，可蓄水' },
    { id:'make_waterbag', cat:'器具类', name:'水袋', icon:'💧', out:'shuidai', outN:1, in:[{id:'mucai', n:2}], note:'削竹为圈、缝皮为囊，制成可盛水随行的水袋' },
    { id:'mk_shelf_wood', cat:'器具类', name:'木货架', icon:'🪟', out:'shelf_wood', outN:1, in:[{id:'mucai', n:3}], note:'以规整木材钉就简易货架，可于铺面放置后陈列货物' },
    { id:'mk_shelf_iron', cat:'器具类', name:'铁货架', icon:'🗄', out:'shelf_iron', outN:1, in:[{id:'mucai', n:4},{id:'tiekuai', n:2}], note:'铁骨木板，钉成结实货架，容量更大' },
    { id:'mk_shelf_carved', cat:'器具类', name:'雕花货架', icon:'🗄', out:'shelf_carved', outN:1, in:[{id:'mucai', n:6},{id:'tiekuai', n:3}], note:'精料雕花，体面大货架' },
    { id:'brick_kiln', cat:'建筑类', name:'砖头', icon:'🧱', out:'zhuan', outN:1, in:[{id:'shitiao', n:2}], note:'石料入窑烧制成砖，规整耐用，垒砌炉体围墙' },
    { id:'make_ink', cat:'素材类', name:'墨', icon:'🖤', out:'mo', outN:1, in:[{id:'mutou',n:2}], note:'松木烧烟、和胶成墨，研磨后可书于简册（松烟墨）' },
    // —— 简册类（v20260908 建筑营造简册制作，东汉以竹简为主）——
    { id:'tuzhi_blacksmith', cat:'简册类', name:'铁匠铺简', icon:'📜', out:'tuzhi_blacksmith', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可起炉设砧' },
    { id:'tuzhi_tavern', cat:'简册类', name:'酒楼简', icon:'📜', out:'tuzhi_tavern', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可起楼造灶' },
    { id:'tuzhi_inn', cat:'简册类', name:'客栈简', icon:'📜', out:'tuzhi_inn', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可起房设柜' },
    { id:'tuzhi_martialhall', cat:'简册类', name:'武馆简', icon:'📜', out:'tuzhi_martialhall', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可立桩设架' },
    { id:'tuzhi_granary', cat:'简册类', name:'粮仓简', icon:'📜', out:'tuzhi_granary', outN:1, in:[{id:'zhuzi',n:2},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可夯基筑囤（大型建筑）' },
    { id:'tuzhi_watchtower', cat:'简册类', name:'瞭望塔简', icon:'📜', out:'tuzhi_watchtower', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可立柱搭台' },
    { id:'tuzhi_arrowtower', cat:'简册类', name:'箭塔简', icon:'📜', out:'tuzhi_arrowtower', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可装弩设箭' },
    { id:'tuzhi_farmland', cat:'简册类', name:'农田简', icon:'📜', out:'tuzhi_farmland', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可整地修渠' },
    { id:'tuzhi_well', cat:'简册类', name:'水井简', icon:'📜', out:'tuzhi_well', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可挖井砌壁' },
    { id:'tuzhi_pigpen', cat:'简册类', name:'猪圈简', icon:'📜', out:'tuzhi_pigpen', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可围栅置槽' },
    { id:'tuzhi_gate', cat:'简册类', name:'寨门简', icon:'📜', out:'tuzhi_gate', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可立门置闸' },
    { id:'tuzhi_training', cat:'简册类', name:'训练场简', icon:'📜', out:'tuzhi_training', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可整地设器' },
    // —— 田里种出来的归处（v20261021b）：麻桑入织（织机未立，暂借木工台并作） ——
    { id:'weave_bu',   cat:'织作类', name:'布',  icon:'🧶', out:'bumu', outN:2, in:[{id:'ma', n:3}],      note:'麻缕绩线、上机织之——三束麻得两匹粗布' },
    { id:'weave_juan', cat:'织作类', name:'绢',  icon:'🧵', out:'juan', outN:1, in:[{id:'sangye', n:4}], note:'桑叶饲蚕得丝，丝织为绢——轻薄生光，价抵数石粮' }
  ],
  // 城镇经营切片（P0+P1）：药铺炼炉（alchemy 台）
  alchemy: [
    { id:'mk_yaofen', cat:'药剂类', name:'草药粉', icon:'🌿', out:'yaofen', outN:1, in:[{id:'xiaoshuzhi', n:2}], note:'捣碎草药为粉，充作敷料（demo 配方）' }
  ],
  // 冶炼工坊：铁料 → 武器 / 工具
  forge: [
    { id:'forg_sword', cat:'兵刃类', name:'铁剑', icon:'⚔️', out:'tiejian', outN:1, in:[{id:'tiekuai', n:3},{id:'mutou', n:1}], note:'铁料入炉锻打，配上木柄，成一柄冷冽铁剑' },
    { id:'forg_axe', cat:'工具类', name:'铁斧', icon:'🪓', out:'tiefu', outN:1, in:[{id:'tiekuai', n:2},{id:'mucai', n:1}], note:'铁料锻斧，刃利耐磨损，伐木采石更趁手' },
    { id:'forg_horse', cat:'杂类', name:'铁马掌', icon:'🧲', out:'tiema', outN:1, in:[{id:'tiekuai', n:1}], note:'余料锻成马蹄铁，可售与马市换银两' },
    // —— 矿洞下行（v20260915j）：木梯每下一层一挂（削木为柱、绑石为阶，锻台顺手做得）——
    { id:'forg_ladder', cat:'工具类', name:'木梯', icon:'🪜', out:'muti', outN:1,
      in:[{id:'mucai', n:3},{id:'shitiao', n:2}], note:'削木为柱、绑石为阶——矿道下行，一挂一挂地备着' },
    // —— 镐头六级（v20260915i）：粗石镐不锻（监工发）；精致石镐起皆在此锻。out:'pick:N' 表示镐升到 N 级 ——
    { id:'forg_pick1', cat:'镐头类', name:'精致石镐', icon:'🪨', out:'pick:1', outN:1,
      in:[{id:'shitiao', n:5},{id:'mucai', n:3}], note:'选石开棱、柄切手——石镐里头的头一份' },
    { id:'forg_pick2', cat:'镐头类', name:'青铜镐', icon:'🥉', out:'pick:2', outN:1,
      in:[{id:'tongkuang', n:4},{id:'mucai', n:3}], note:'铜砂熔铸成头，能凿大石堆。营里也可寻市集或差役得之' },
    { id:'forg_pick3', cat:'镐头类', name:'粗铁镐', icon:'⛏️', out:'pick:3', outN:1,
      in:[{id:'tiekuangshi', n:4},{id:'mucai', n:4}], note:'铁料锻头，开铁砂堆的入门家什' },
    { id:'forg_pick4', cat:'镐头类', name:'精致铁镐', icon:'⚒️', out:'pick:4', outN:1,
      in:[{id:'tiekuangshi', n:8},{id:'mucai', n:6}], note:'细锻铁镐，尖而有弹——青玉脉也能开' },
    { id:'forg_pick5', cat:'镐头类', name:'百炼钢镐', icon:'⚔️', out:'pick:5', outN:1,
      in:[{id:'bailian_jian', n:1},{id:'tiekuangshi', n:12},{id:'jade', n:2},{id:'mutan', n:5}],
      note:'依百炼钢简锻之：炒铁为料、千锤折叠——寻常镐比不得' },
    // —— 精铁（v20260928g）：铁锭+木炭 → 精铁，更高级器物的胚料 ——
    { id:'forg_steel', cat:'精铁类', name:'精铁', icon:'⚙️', out:'jingtie', outN:1,
      in:[{id:'tieding', n:1},{id:'mutan', n:2}], note:'铁锭入炉，木炭猛火鼓风，去渣存精——炼出一枚精铁' }
  ],
  // 炊事灶（篝火 / 客栈 / 草庐 皆可调取）：素材 → 疗伤与干粮，打通生存闭环
  kitchen: [
    { id:'brew_jinchuang', cat:'疗伤类', name:'金疮药', icon:'🧪', out:'jinchuang', outN:1, in:[{id:'caoyao', n:2}], note:'两味草药捣敷，止血生肌——可疗外伤五十' },
    { id:'cook_roubao', cat:'干粮类', name:'肉包子', icon:'🥟', out:'roubao', outN:1, in:[{id:'shengrou', n:1}], note:'生肉裹面炊熟成包——食+20 饮+5，解一时饥渴' },
    // —— 烧炭（v20260915i）：木材入闷窑熏成木炭，无烟耐烧，铁匠炉最认 ——
    { id:'make_mutan', cat:'燃料类', name:'木炭', icon:'⚫', out:'mutan', outN:1, in:[{id:'mucai', n:2}], note:'木材闷窑熏炭，去烟留热——锻钢的火候全在它' },
    // —— 肉类入馔（v20260928g）：酒楼/食肆/篝火皆可烹 ——
    { id:'cook_hongshao', cat:'菜肴类', name:'红烧肉', icon:'🍖', out:'hongshao', outN:1, in:[{id:'zhurou', n:1}], note:'猪肉切块，糖色酱油慢炖——食+18 饮+4' },
    { id:'cook_kaoji', cat:'菜肴类', name:'烤鸡', icon:'🍗', out:'kaoji', outN:1, in:[{id:'jirou', n:1}], note:'整鸡架火慢烤，皮脆肉嫩——食+15 饮+3' },
    { id:'cook_kaoyang', cat:'菜肴类', name:'烤羊肉', icon:'🍢', out:'kaoyang', outN:1, in:[{id:'yangrou', n:1}], note:'带骨羊肉翻烤，膻香扑鼻——食+17 饮+5' },
    // —— 田里种出来的归处（v20261021b）：五谷菜果入厨，加工之后价翻数倍 ——
    { id:'mill_mianfen', cat:'粮作类', name:'面粉', icon:'🥣', out:'mianfen', outN:2, in:[{id:'mai', n:2}], note:'麦子入磨，细粉如霜——两斗麦出一斗粉' },
    { id:'husk_mi_sumi', cat:'粮作类', name:'米', icon:'🍚', out:'mi', outN:1, in:[{id:'sumi', n:2}], note:'粟入臼舂去壳，得白米（食+20）' },
    { id:'husk_mi_dao',  cat:'粮作类', name:'米', icon:'🍚', out:'mi', outN:3, in:[{id:'dao', n:2}], note:'稻谷舂米，出米比粟厚——两捆稻得三升米' },
    { id:'make_doufu',   cat:'粮作类', name:'豆腐', icon:'🥣', out:'doufu', outN:2, in:[{id:'dou', n:2}], note:'菽豆磨浆点卤，凝作一方白嫩——贫家小宰羊（食+22）' },
    { id:'make_doujiang',cat:'粮作类', name:'豆酱', icon:'🫙', out:'doujiang', outN:2, in:[{id:'dou', n:3}], note:'菽豆发酵入瓮，咸香久存不坏（食+15）' },
    { id:'bake_bing',    cat:'干粮类', name:'胡饼', icon:'🫓', out:'bing', outN:2, in:[{id:'mianfen', n:1}], note:'揉面撒胡麻，入炉烤得焦香——行路干粮（食+28）' },
    { id:'brew_mijiu',   cat:'酿作类', name:'米酒', icon:'🍶', out:'mijiu', outN:2, in:[{id:'mi', n:3}], note:'米饭拌曲封瓮，数日成酒——暖身壮行，市上甚俏' },
    { id:'make_guofu',   cat:'果作类', name:'果脯', icon:'🍯', out:'guofu', outN:2, in:[{id:'guo', n:3}], note:'鲜果蜜渍晒干，甜韧耐存（食+16 饮+5）' },
    { id:'brew_chayin',  cat:'果作类', name:'茶饮', icon:'🍵', out:'chayin', outN:2, in:[{id:'chaye', n:1}], note:'茶叶烹就一盏，解渴醒神（饮+16）' }
  ],
  // 药庐（药铺配药台，v20260928g）：名贵药材入药，制上等伤药
  clinic: [
    { id:'brew_renshen', cat:'滋补类', name:'人参金疮药', icon:'🧪', out:'jinchuang', outN:2, in:[{id:'renshen', n:1}], note:'人参研末入药，吊气止血——名贵药材制两瓶上等金疮药' },
    { id:'brew_lingzhi', cat:'滋补类', name:'灵芝金疮药', icon:'🧪', out:'jinchuang', outN:2, in:[{id:'lingzhi', n:1}], note:'灵芝磨粉调和，生肌尤速——名贵药材制两瓶上等金疮药' }
  ]
  // 后续工作台（矿炉 / 铁砧 / 织机 …）仅需在此追加对应 key 即可
};

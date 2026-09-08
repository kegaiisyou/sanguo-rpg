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
    { id:'twig_timber', cat:'木材类', name:'木材', icon:'🟫', out:'mucai', outN:1, in:[{id:'xiaoshuzhi', n:2}], note:'细枝捆扎刨削成材（耗料较多）' },
    { id:'wood_timber', cat:'木材类', name:'木材', icon:'🟫', out:'mucai', outN:1, in:[{id:'mutou', n:1}], note:'粗木直接解板成材（斧伐料更划算）' },
    { id:'fold_bench', cat:'器具类', name:'便携工作台', icon:'🔨', out:'gongzuotai', outN:1, in:[{id:'mucai', n:3}], note:'以规整木材攒成可折叠的工作台，随行随用' },
    { id:'campfire_kit', cat:'器具类', name:'篝火', icon:'🔥', out:'campfire', outN:1, in:[{id:'mutou', n:2},{id:'xiaoshuzhi', n:1}], note:'干柴捆扎成束，引火即燃，可取暖烘食' },
    { id:'sleep_mat', cat:'器具类', name:'草席', icon:'🛏️', out:'sleepmat', outN:1, in:[{id:'mucai', n:2}], note:'削竹为骨、编草为席，铺地可眠' },
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
    { id:'tuzhi_training', cat:'简册类', name:'训练场简', icon:'📜', out:'tuzhi_training', outN:1, in:[{id:'zhuzi',n:1},{id:'mo',n:1}], note:'削竹为简、墨书营造之法，依简可整地设器' }
  ],
  // 冶炼工坊：铁料 → 武器 / 工具
  forge: [
    { id:'forg_sword', cat:'兵刃类', name:'铁剑', icon:'⚔️', out:'tiejian', outN:1, in:[{id:'tiekuai', n:3},{id:'mutou', n:1}], note:'铁料入炉锻打，配上木柄，成一柄冷冽铁剑' },
    { id:'forg_axe', cat:'工具类', name:'铁斧', icon:'🪓', out:'tiefu', outN:1, in:[{id:'tiekuai', n:2},{id:'mucai', n:1}], note:'铁料锻斧，刃利耐磨损，伐木采石更趁手' },
    { id:'forg_horse', cat:'杂类', name:'铁马掌', icon:'🧲', out:'tiema', outN:1, in:[{id:'tiekuai', n:1}], note:'余料锻成马蹄铁，可售与马市换银两' }
  ],
  // 炊事灶（篝火 / 客栈 / 草庐 皆可调取）：素材 → 疗伤与干粮，打通生存闭环
  kitchen: [
    { id:'brew_jinchuang', cat:'疗伤类', name:'金疮药', icon:'🧪', out:'jinchuang', outN:1, in:[{id:'caoyao', n:2}], note:'两味草药捣敷，止血生肌——可疗外伤五十' },
    { id:'cook_roubao', cat:'干粮类', name:'肉包子', icon:'🥟', out:'roubao', outN:1, in:[{id:'shengrou', n:1}], note:'生肉裹面炊熟成包——食+20 饮+5，解一时饥渴' }
  ]
  // 后续工作台（矿炉 / 铁砧 / 织机 …）仅需在此追加对应 key 即可
};

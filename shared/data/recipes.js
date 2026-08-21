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
    { id:'brick_kiln', cat:'建筑类', name:'砖头', icon:'🧱', out:'zhuan', outN:1, in:[{id:'shitiao', n:2}], note:'石料入窑烧制成砖，规整耐用，垒砌炉体围墙' }
    // 后续接入：{ id:'plank', cat:'木材类', name:'木板', out:'muban', outN:1, in:[{id:'mucai', n:2}] ... }
    //          { id:'hammer', cat:'器具类', name:'木槌', out:'muchui', outN:1, in:[{id:'mucai', n:2},{id:'xiaoshuzhi', n:1}] ... }
  ]
  // 后续工作台（矿炉 / 铁砧 / 织机 …）仅需在此追加对应 key 即可
};

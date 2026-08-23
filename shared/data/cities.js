// 城市系统数据（外置，便于随时增改城市参数，无需改动引擎代码）
// 每个城市一条属性：进入该城市房间时，引擎按参数动态派生城郭概况 / 百姓 NPC / 敌人 / 可行动作
// 参数均为 0-100 相对值：
//   pop      人口（决定百姓 NPC 数量、城市规模等级）
//   order    治安（越低越容易出现溃兵/流民敌人）
//   commerce 商业（越高越可能遇到行商、出现「逛市集」行动）
//   wall     城防（预留：后续可用于守城/攻城系统）
// 派生规则见 index.html 的 cityProfile() / cityNpcs() / cityActs()
(function(global){
  global.LF = global.LF || {};
  global.LF.CITIES = {
    // ── 已有城市（多房间城市挂在城门/入口房间上）──
    luoyang:   { name:'洛阳',   state:'司隶', pop:95, order:60, commerce:92, wall:90, desc:'汉室京师，宫阙巍峨' },
    ji_guomen: { name:'蓟城',   state:'幽州', pop:72, order:58, commerce:62, wall:82, desc:'幽州州治，北疆雄城' },
    yuyang_guomen:{ name:'渔阳', state:'幽州', pop:55, order:50, commerce:55, wall:66, desc:'渔阳郡治，边塞重镇' },
    city:      { name:'颍川',   state:'豫州', pop:45, order:40, commerce:55, wall:40, desc:'中原腹地，乱世初起之地' },
    // ── 十三州州治所（v20260823a 新增城市参数）──
    ye:        { name:'邺城',   state:'冀州', pop:85, order:55, commerce:70, wall:85, desc:'冀州州治，铜雀台起' },
    changyi:   { name:'昌邑',   state:'兖州', pop:60, order:50, commerce:55, wall:60, desc:'兖州州治，控扼中原' },
    xiapi:     { name:'下邳',   state:'徐州', pop:65, order:48, commerce:62, wall:70, desc:'徐州州治，古邳名邑' },
    linzi:     { name:'临淄',   state:'青州', pop:68, order:55, commerce:75, wall:62, desc:'青州州治，齐都故地' },
    xiangyang: { name:'襄阳',   state:'荆州', pop:70, order:58, commerce:68, wall:80, desc:'荆州北门锁钥' },
    shouchun:  { name:'寿春',   state:'扬州', pop:66, order:48, commerce:60, wall:75, desc:'淮南重镇，锁钥江淮' },
    chengdu:   { name:'成都',   state:'益州', pop:75, order:60, commerce:78, wall:68, desc:'益州州治，天府之国' },
    wuwei:     { name:'武威',   state:'凉州', pop:55, order:38, commerce:50, wall:72, desc:'河西咽喉，凉州重镇' },
    jinyang:   { name:'晋阳',   state:'并州', pop:58, order:55, commerce:48, wall:85, desc:'并州州治，表里山河' },
    fanyu:     { name:'番禺',   state:'交州', pop:60, order:45, commerce:72, wall:50, desc:'交州州治，岭南都会' }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.CITIES;
})(typeof window !== 'undefined' ? window : globalThis);

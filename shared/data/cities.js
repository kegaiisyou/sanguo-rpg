// 城市系统数据（外置，便于随时增改城市参数，无需改动引擎代码）
// 每个城市一条属性：进入该城市房间时，引擎按参数动态派生城郭概况 / 百姓 NPC / 敌人 / 可行动作
// 参数均为 0-100 相对值：
//   pop      人口（决定百姓 NPC 数量、城市规模等级、城内网格密度）
//   order    治安（越低越容易出现溃兵/流民敌人）
//   commerce 商业（越高越可能遇到行商、网格内市集更多）
//   wall     城防（预留：后续可用于守城/攻城系统；越高网格内军营越多）
//   agri     农业（0-100；越高网格内农田越多、城况面板显示“沃野千里”等）
//   ctype    城型（plain 平原城 / mountain 山城 / port 港口城 / fort 城寨；影响城门数量，见 index.html cityGates）
//   grid     城内房间网格边长（9=都城、7=州城、5=县城）；可随 pop/wall 扩建，战火降级（见 genCityGrid）
//   tier     行政等级（capital=都城 / zhou=州城(州治) / xian=县城）；决定城内中央建筑与名称：
//            都城中央=皇宫(🏯)；州城中央=州衙(🏛)；县城中央=城主府(🏛)
// 派生规则见 index.html 的 cityProfile() / cityNpcs() / cityActs()；网格见 cityGrid 系列函数
(function(global){
  global.LF = global.LF || {};
  global.LF.CITIES = {
    // ── 启用城内网格的城市（grid 字段触发 9×9/7×7/5×5 程序生成房间）──
    ji_guomen: { name:'蓟城',   state:'幽州', tier:'zhou', pop:72, order:58, commerce:62, wall:82, agri:50, grid:7, desc:'幽州州治，北疆雄城' },
    yuyang_guomen:{ name:'渔阳', state:'幽州', tier:'zhou', pop:55, order:50, commerce:55, wall:66, agri:40, grid:7, desc:'渔阳郡治，边塞重镇' },
    luoyang:   { name:'洛阳',   state:'司隶', tier:'capital', pop:95, order:60, commerce:92, wall:90, agri:70, grid:9, desc:'汉室京师，宫阙巍峨' },
    city:      { name:'颍川',   state:'豫州', tier:'xian',    pop:45, order:40, commerce:55, wall:40, agri:60, grid:5, desc:'中原腹地，乱世初起之地' },
    // ── 十三州州治所（v20260824 启用城内网格；tier=zhou → 中央为州衙）──
    ye:        { name:'邺城',   state:'冀州', tier:'zhou', pop:85, order:55, commerce:70, wall:85, agri:65, grid:7, desc:'冀州州治，铜雀台起' },
    changyi:   { name:'昌邑',   state:'兖州', tier:'zhou', pop:60, order:50, commerce:55, wall:60, agri:55, grid:7, desc:'兖州州治，控扼中原' },
    xiapi:     { name:'下邳',   state:'徐州', tier:'zhou', pop:65, order:48, commerce:62, wall:70, agri:60, grid:7, desc:'徐州州治，古邳名邑' },
    linzi:     { name:'临淄',   state:'青州', tier:'zhou', pop:68, order:55, commerce:75, wall:62, agri:58, grid:7, desc:'青州州治，齐都故地' },
    xiangyang: { name:'襄阳',   state:'荆州', tier:'zhou', pop:70, order:58, commerce:68, wall:80, agri:62, grid:7, desc:'荆州北门锁钥' },
    shouchun:  { name:'寿春',   state:'扬州', tier:'zhou', pop:66, order:48, commerce:60, wall:75, agri:60, grid:7, desc:'淮南重镇，锁钥江淮' },
    chengdu:   { name:'成都',   state:'益州', tier:'zhou', pop:75, order:60, commerce:78, wall:68, agri:80, grid:7, desc:'益州州治，天府之国' },
    wuwei:     { name:'武威',   state:'凉州', tier:'zhou', pop:55, order:38, commerce:50, wall:72, agri:35, ctype:'fort',   grid:5, desc:'河西咽喉，凉州重镇（城寨）' },
    jinyang:   { name:'晋阳',   state:'并州', tier:'zhou', pop:58, order:55, commerce:48, wall:85, agri:45, ctype:'mountain', grid:5, desc:'并州州治，表里山河（山城）' },
    fanyu:     { name:'番禺',   state:'交州', tier:'zhou', pop:60, order:45, commerce:72, wall:50, agri:50, ctype:'port',     grid:5, desc:'交州州治，岭南都会（港口城）' }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.CITIES;
})(typeof window !== 'undefined' ? window : globalThis);

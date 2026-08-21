// 营造（生存建造）蓝图数据（外置，便于横向扩展更多图纸）
// 结构：LF.BUILD[蓝图ID] = {
//   key       放置于房间后的唯一对象 key
//   siteIcon  营造中图标
//   siteName  营造中名称
//   doneIcon  建成后图标
//   doneName  建成后名称
//   desc      说明
//   stages    [ { name:'阶段名', need:{ 材料defId:数量, ... } }, ... ]
//   done      'forge' | ...  （建成后的功能动作标识，对应 LFUI/buildDoneActions 的处理）
// }
(function (global) {
  global.LF = global.LF || {};
  LF.BUILD = {
    bp_yeolian: {
      key: 'site_yeolian',
      siteIcon: '🏗️',
      siteName: '冶炼工坊（营造中）',
      doneIcon: '🏭',
      doneName: '冶炼工坊',
      desc: '依《冶炼工坊图》备料营造：先夯石砌基，再立木架炉，炉成可熔石取铁。',
      stages: [
        { name: '夯筑石基', need: { shitiao: 3, zhuan: 2 } },
        { name: '立木架炉', need: { mucai: 4 } }
      ],
      done: 'forge'
    }
    // 后续可在此追加：窑炉(bp_yaolu)、药炉(bp_yaolu2)、营地支线(bp_camp)……
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.BUILD;
})(typeof window !== 'undefined' ? window : globalThis);

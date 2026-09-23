// 设施类型与派生（v20260924j）：派驻武将依才具与民夫/士卒按月批量产出
// 纯数据层，随 shared/data/officers.js 之后、shared/core/officers.js 之前加载即可。
(function (global) {
  global.LF = global.LF || {};
  // 设施类型：res = 产出资源键；stat = 增益主属性；skill = 增益特技键；laborCap = 可调民夫上限
  global.LF.FACILITY_TYPES = {
    nongzhuang: { id: 'nongzhuang', name: '农庄', icon: '🌾', res: 'grain', resName: '粮', base: 20, stat: 'zheng', skill: 'farmMul', laborCap: 80, desc: '开垦荒田，岁纳军粮。政务愈高、有「屯田」者，垦殖愈广。' },
    shanghao:   { id: 'shanghao',   name: '商号', icon: '🏪', res: 'gold',  resName: '银', base: 16, stat: 'mei',   skill: 'tradeMul', laborCap: 60, desc: '通贾贩易，充盈府库。魅力愈高、有「商才」者，利市三倍。' },
    kuangchang: { id: 'kuangchang', name: '矿场', icon: '⛏️', res: 'iron',  resName: '铁', base: 12, stat: 'zheng', skill: 'devMul',  laborCap: 50, desc: '开山取铁，以供锻造。政务愈高、有「工神」者，矿脉愈旺。' },
    gongfang:   { id: 'gongfang',   name: '工坊', icon: '🔨', res: 'kit',   resName: '械', base: 9,  stat: 'zhi',   skill: 'devMul',  laborCap: 40, desc: '打造甲械，武备乃修。智略愈高、有「工神」者，器械愈精。' }
  };
  // 每城依禀赋确定性派生设施槽位（随城市属性变化，无需手连数据）
  global.LF.facilitySlotsOf = function (cid) {
    var c = (global.LF.CITIES || {})[cid]; if (!c) return [];
    var out = [], i, n;
    n = Math.min(3, 1 + Math.floor((c.agri || 40) / 45));
    for (i = 0; i < n; i++) out.push({ cid: cid, ftype: 'nongzhuang', slot: i });
    n = Math.min(2, 1 + Math.floor((c.commerce || 40) / 55));
    for (i = 0; i < n; i++) out.push({ cid: cid, ftype: 'shanghao', slot: i });
    if (c.ctype === 'mountain' || c.ctype === 'fort' || c.ctype === 'shuizhai') out.push({ cid: cid, ftype: 'kuangchang', slot: 0 });
    if ((c.wall || 0) >= 50) out.push({ cid: cid, ftype: 'gongfang', slot: 0 });
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);

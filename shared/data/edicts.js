// 内政命令表（命令式委任内政，v20260924m）
// 玩家可于政令台「亲行」(即时耗时辰) 或「委任」麾下武将按月督办。
// 字段：name 名 / icon 图标 / cat 类 / stat 主属性 / skill 增益特技键 / res 产出资源键|null /
//       base 基础产出 / statKey 写入 cityStats 字段|null / statGain 增量 / order 治安增量 /
//       kind 结算类型(res=资源/stat/治安; train=练兵; recruit=登庸; explore=探索) / trainType 兵科 / desc 说明
(function (global) {
  global.LF = global.LF || {};
  global.LF.EDICT_COMMANDS = {
    kaiken:   { key:'kaiken', name:'开垦', icon:'🌾', cat:'政', stat:'zheng', skill:'farmMul', res:'grain', base:14, statKey:'agri', statGain:2, kind:'res', desc:'督民垦荒，岁增军粮，久则地力渐肥。' },
    shangye:  { key:'shangye', name:'商业', icon:'🏪', cat:'魅', stat:'mei', skill:'tradeMul', res:'gold', base:11, statKey:'com', statGain:2, kind:'res', desc:'通贾贩易，府库充盈，市声渐盛。' },
    kaikuang: { key:'kaikuang', name:'开矿', icon:'⛏️', cat:'政', stat:'zheng', skill:'devMul', res:'iron', base:10, statKey:null, kind:'res', desc:'开山取铁，以供锻造武备。' },
    zaohuo:   { key:'zaohuo', name:'造械', icon:'🔨', cat:'智', stat:'zhi', skill:'devMul', res:'kit', base:8, statKey:null, kind:'res', desc:'打造甲械，武备乃修。' },
    zhishui:  { key:'zhishui', name:'治水', icon:'🌊', cat:'政', stat:'zheng', skill:'farmMul', res:null, base:0, statKey:'defense', statGain:3, kind:'res', desc:'修堤疏导，减水患之灾，城防渐固。' },
    zhian:    { key:'zhian', name:'治安', icon:'🛡', cat:'魅', stat:'mei', skill:'loyalty', res:null, base:0, statKey:null, order:8, kind:'res', desc:'巡街弭盗，百姓安居，治安渐复。' },
    lianbing: { key:'lianbing', name:'练兵', icon:'⚔', cat:'统', stat:'tong', skill:null, res:null, base:24, trainType:'步兵', kind:'train', desc:'于城中募训士卒，充实行伍。' },
    dengyong: { key:'dengyong', name:'登庸', icon:'🎖', cat:'魅', stat:'mei', skill:'recruit', res:null, base:0, kind:'recruit', desc:'延揽在野贤才，纳于麾下。' },
    tansuo:   { key:'tansuo', name:'探索', icon:'🔍', cat:'智', stat:'zhi', skill:null, res:null, base:0, kind:'explore', desc:'派人搜奇探幽，或有奇遇、宝物、异士。' }
  };
})(typeof window !== 'undefined' ? window : globalThis);

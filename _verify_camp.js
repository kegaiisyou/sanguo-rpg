// 临时校验：加载数据层，检查苦役营全量实现的完整性
require('./shared/story/rooms.js');
require('./shared/story/dialogues.js');
require('./shared/data/enemies.js');
require('./shared/data/items.js');
require('./shared/story/triggers.js');
const LF = globalThis.LF;

let errs = [];
const CAMP_ROOMS = ['camp_yard','camp_cell','camp_wall','camp_kitchen','camp_farm','camp_kennel','camp_warehouse','camp_mine','camp_store','camp_training','camp_gate'];
const CAMP_NPCS = ['zhoutingtao','moshu','mu_changfeng','su_niang','fu_sheng','gou_san','shi_si','qin_jiuxiao','lu_da','li_wang','chen_jian','sun_lao','qian_sh','niu_tie','lin_niang','wu_suan','liu_shi','wang_xi','zheng_gui','zhao_hu','qian_biao','sun_meng','li_heng','zhou_ba','wu_yong','zheng_gang','feng_er','ma_biao','huang_er','han_tie'];
const TUT_ITEMS = ['pickaxe','sleep_drug','wooden_pass','rope','guard_tally'];

// 1) 房间
CAMP_ROOMS.forEach(r=>{ if(!LF.ROOMS[r]) errs.push('缺失房间: '+r); });
// 出口合法性 + 连通性（每房至少一个出口指向存在的房间）
CAMP_ROOMS.forEach(r=>{
  const rm = LF.ROOMS[r]; if(!rm) return;
  const ex = rm.exits||{}; const dirs = Object.keys(ex);
  if(r!=='camp_yard' && dirs.length===0) errs.push('房间无出口: '+r);
  dirs.forEach(d=>{ if(!LF.ROOMS[ex[d]]) errs.push('房间 '+r+' 出口['+d+']指向不存在的 '+ex[d]); });
  (rm.npcs||[]).forEach(n=>{ if(CAMP_NPCS.indexOf(n)<0 && !LF.DIALOGUES.npcs[n]) errs.push('房间 '+r+' 引用未定义NPC: '+n); });
});

// 2) NPC
CAMP_NPCS.forEach(n=>{ if(!LF.DIALOGUES.npcs[n]) errs.push('缺失NPC: '+n); });
// 房间 npcs 覆盖（每个 NPC 至少被一个 camp 房引用）
const placed = {};
CAMP_ROOMS.forEach(r=>{ (LF.ROOMS[r].npcs||[]).forEach(n=>placed[n]=true); });
CAMP_NPCS.forEach(n=>{ if(!placed[n]) errs.push('NPC 未被任何房间放置: '+n); });

// 3) 敌人与物品
['camp_guard','camp_dummy'].forEach(e=>{ if(!LF.ENEMIES[e]) errs.push('缺失敌人: '+e); });
if(LF.ENEMIES.wuhuan_scout) errs.push('wuhuan_scout 应已退役但仍存在');
TUT_ITEMS.forEach(i=>{ if(!LF.ITEMS.DEFS[i]) errs.push('缺失教程物品: '+i); });

// 4) 触发器关键 id
const need = ['camp_opening','labor_first','survey_yard','zt_crypt','wall_gate','yard_clear_gate','moshu_signal','tut_combat_lindao','wz_fusheng',
  'gou_tunnel','wu_drain','shi_drain','lin_drug','qin_riot','chen_wooden','su_rope','han_assault','wh_pickaxe','sun_routes','mt_contact','camp_tour'];
const have = LF.TRIGGERS.map(t=>t.id);
need.forEach(id=>{ if(have.indexOf(id)<0) errs.push('缺失触发: '+id); });
// 引用 NPC 的触发需 NPC 存在
LF.TRIGGERS.forEach(t=>{ if(t.npc && !LF.DIALOGUES.npcs[t.npc]) errs.push('触发 '+t.id+' 引用未定义NPC: '+t.npc); });

console.log('房间数:', CAMP_ROOMS.filter(r=>LF.ROOMS[r]).length, '/ 11');
console.log('NPC数:', CAMP_NPCS.filter(n=>LF.DIALOGUES.npcs[n]).length, '/ 30');
console.log('教程物品:', TUT_ITEMS.filter(i=>LF.ITEMS.DEFS[i]).length, '/ 5');
console.log('触发器数:', LF.TRIGGERS.length);
if(errs.length){ console.log('\n❌ 问题:'); errs.forEach(e=>console.log(' -', e)); process.exit(1); }
else console.log('\n✅ 数据层完整性校验通过');

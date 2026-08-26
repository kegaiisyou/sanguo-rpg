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

      siteName: '冶炼工坊（营造中）',

      doneName: '冶炼工坊',
      desc: '依《冶炼工坊图》备料营造：先夯石砌基，再立木架炉，炉成可熔石取铁。',
      stages: [
        { name: '夯筑石基', need: { shitiao: 3, zhuan: 2 } },
        { name: '立木架炉', need: { mucai: 4 } }
      ],
      done: 'forge',
      // 建成后内部：可进入的独立房间（左下 NPC + 上方交互物件），与店铺屋舍体验一致
      interior: [
        { kind:'npc', name:'铁匠师傅', icon:'匠', desc:'围着皮围裙、抡锤如风的老师傅，通晓冶铁锻造。', acts:[
          { label:'请教冶炼', icon:'话', fn:function(){ log('铁匠师傅瓮声道：「好铁要经千锤百炼——石中炼出铁锭，铁锭再锻成器物，不可急躁。」','sys'); openModal('building'); } },
          { label:'请他熔石', icon:'火', fn:function(){
              if(!packFind('kuangshi')){ toast('需有铁矿石，方能请师傅开炉熔炼。'); return; }
              if(!exert('请师熔炼')) return;
              packConsume('kuangshi',1); packAdd('tieding',1);
              log('铁匠师傅投石入炉，风箱鼓动，火星四溅——取出一枚铁锭交予你。','sys'); openModal('building'); } }
        ]},
        { kind:'obj', name:'冶炼炉膛', icon:'火', desc:'炉火正旺的冶炼炉，风箱呼呼作响。', acts:[
          { label:'熔石取铁', icon:'炼', fn:function(){
              if(!exert('生火熔炼')) return;
              if(packFind('kuangshi')){ packConsume('kuangshi',1); packAdd('tieding',1); log('你将铁矿石投入炉膛，熔得铁锭一枚。','sys'); }
              else log('炉膛空空，投石入炉方能出铁。','sys');
              openModal('building'); } }
        ]},
        { kind:'obj', name:'铁砧', icon:'砧', desc:'沉重的铁砧，锤痕斑斑。', acts:[
          { label:'打造器具', icon:'打', fn:function(){ openModal('craft', {bench:'forge'}); } }
        ]}
      ]
    }
    // 后续可在此追加：窑炉(bp_yaolu)、药炉(bp_yaolu2)、营地支线(bp_camp)……
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LF.BUILD;
})(typeof window !== 'undefined' ? window : globalThis);

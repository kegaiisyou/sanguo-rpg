// 装备数据层（v20260909i）
// 从 engine.js「装备/卸下」「战后耐久」「有效属性」拆出：effectiveStats（装备+艺线综合属性）、
// decayEquipment（战后装具耐久衰减）、equipFromPackTo/equipItem/unequip（穿卸写路径）。
// 依赖经 ctx 注入：getState（惰性，兼容读档/新游戏时 state 被重赋值 → 函数内一律 S()）；
// LF（LF.ITEMS 装备槽键）；引擎结算/UI 回调（clampHp/log）。
// Pack 工厂在引擎中较晚创建（createPack 之后才注入 movePackItem/unequipToPack），故此处两者经
// packMovePackItem/packUnequipToPack 惰性 getter 注入——工厂建立时不取值，运行时才解析。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createEquipment = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var clampHp = ctx.clampHp, log = ctx.log;
    function packMovePackItem() { return ctx.packMovePackItem(); }
    function packUnequipToPack() { return ctx.packUnequipToPack(); }

    /** 计算含装备+艺线加成的有效属性（P1 装备 / P2 艺线：攻/命中/暴击/内力/身法） */
    function effectiveStats(){
      var st=S();
      var atk=st.atk, def=st.def, maxHp=st.maxHp, maxMp=st.maxMp, maxEnergy=st.maxEnergy, maxFood=st.maxFood, maxDrink=st.maxDrink, spd=st.spd;
      LF.ITEMS.SLOT_KEYS.forEach(function(sl){
        var eq=st.equipment[sl]; if(!eq) return;
        atk+=(eq.atk||0); def+=(eq.def||0); maxHp+=(eq.hp||0); maxMp+=(eq.mp||0); spd+=(eq.spd||0);
      });
      // ── P2：艺线等级加成 ──
      var lineAtk=0, lineCrit=0, lineHit=0, lineMp=0, lineSpd=0;
      for(var l in st.lines){
        var lv=st.lines[l]||0;
        lineAtk += lv*0.6;
        lineCrit += lv*0.003;
        lineHit += lv*0.002;
        if(l==='internal') lineMp += lv*1;   // 内功线 → 内力上限
        if(l==='light')    lineSpd += lv*0.3; // 轻功线 → 身法
      }
      atk += lineAtk;
      maxMp += lineMp;
      spd += lineSpd;
      var hitRate = Math.min(0.99, 0.92 + lineHit);
      var critRate = Math.min(0.35, lineCrit);
      return {atk:atk,def:def,maxHp:maxHp,maxMp:maxMp,maxEnergy:maxEnergy,maxFood:maxFood,maxDrink:maxDrink,spd:spd,hitRate:hitRate,critRate:critRate};
    }
    // 每场战斗结束（胜/败/逃）已装备耐久 -1，耗尽则损毁
    function decayEquipment(){
      var st=S();
      var broken=[];
      LF.ITEMS.SLOT_KEYS.forEach(function(sl){
        var eq=st.equipment[sl]; if(!eq) return;
        if(typeof eq.dur!=='number') return;   // 期初装具无耐久，不损耗
        eq.dur-=1;
        if(eq.dur<=0){ st.equipment[sl]=null; broken.push(eq.name); }
      });
      if(broken.length) log('【装备】'+broken.join('、')+' 耐久已尽，损毁弃之。','sys');
      clampHp();
    }
    // 从行囊格装备到指定部位（旧装回包由 movePackItem 内部完成）
    function equipFromPackTo(idx,slot){ packMovePackItem()({kind:'pack',idx:idx},{kind:'equip',slot:slot}); }
    // 装备/卸下（按物品 id 穿上 / 按部位卸下）
    function equipItem(id){
      var st=S();
      var idx=-1;
      for(var i=0;i<st.pack.length;i++){ var c=st.pack[i]; if(c && c.cat==='装备' && c.defId===id){ idx=i; break; } }
      if(idx<0) return;
      var eq=st.pack[idx]; equipFromPackTo(idx, eq.slot);
    }
    function unequip(slot){ packUnequipToPack()(slot); }

    return {
      effectiveStats: effectiveStats, decayEquipment: decayEquipment,
      equipFromPackTo: equipFromPackTo, equipItem: equipItem, unequip: unequip
    };
  };
})(typeof window !== 'undefined' ? window : global);

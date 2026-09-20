// 作息/营规口径判定（从 engine.js 拆分）
// 时辰→此时能做什么 的统一判定：饭点/灶歇/落锁/点卯/牢锁/牢头落脚格。
// 纯判定层，仅依赖 state（走 S()）与全局 SHICHEN / LF.NPC_ROUTINES_CITY；营规行为（点卯/销名/查房/劳役）仍留引擎。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createSchedule = function (ctx) {
    var getState = ctx.getState, S = getState;
  var SHICHEN = ctx.SHICHEN;
  // ══ 作息口径（v20260911h · P3）══════════════════════════════════════════════
  // 「时辰 → 此时能做什么」的判定全部收敛到这一处，勿散落到各处：
  //   劳作吃时辰(laborTick) / 伙房供饭(mess_hall) / 回牢销名(check_in) / 城门宵禁 / 客栈打尖 共用同一套口径。
  //   S().time ∈ 0..11 = 子丑寅卯辰巳午未申酉戌亥；营中「一日」以卯时(3)开牢为始、寅时(2)为末。
  var MESS_HOURS  = [3,4,6,7,9,10];    // 一日三餐各两个时辰：卯辰（朝食）· 午未（晌饭）· 酉戌（夜粥）
  var DEAD_HOURS  = [11,0,1,2];        // 亥子丑寅：灶冷无食（伙房歇火）
  var NIGHT_HOURS = [10,11,0,1,2];     // 戌时鸣鼓落锁起至次日寅时：城门宵禁 / 营中点卯逾期
  var ROLL_HOURS  = [3,4,5,6];          // 卯辰巳午：点卯应名（天亮开工到晌午，过午不候——v20260916h 放宽）
  var INN_FEE     = 8;                 // 客栈打尖房钱（两）
  var LABOR_PER_WOOD = 3;              // 劳役工分：每 3 工换发 1 枚「劳字木片」
  function hourNow(){ return (((S().time||0)%12)+12)%12; }
  function hourLabel(h){ return SHICHEN[(((h==null?hourNow():h)%12)+12)%12]; }
  function inHours(arr,h){ h=(((h==null?hourNow():h)%12)+12)%12; return arr.indexOf(h)>=0; }
  function isMessHour(h){ return inHours(MESS_HOURS,h); }      // 饭点：灶上有热食
  function isDeadHour(h){ return inHours(DEAD_HOURS,h); }      // 深夜：灶火已熄
  function isCurfewHour(h){ return inHours(NIGHT_HOURS,h); }   // 落锁：城门闭 · 点卯逾期
  function isRollHour(h){ return inHours(ROLL_HOURS,h); }       // 点卯：卯至午应名（与「午后销名」一开一收）
  function onbF(){ return (S() && S().flags && S().flags.onb) || null; }
  // 营规未脱（未毕业）时才受点卯约束；毕业即脱籍，营规不再管你（但时间与作息照常流动）
  function onbBound(){ var o=onbF(); return !!(o && o.started && o.curfewSet && !o.done); }
  // 牢房落锁（v20260917a）：戌亥子丑寅（约晚8点至次日早5点）牢门上闩，卯时开锁放风——
  //   牢头卯时出门去中军点卯，牢门也同时敞开（与营规「卯时开牢放风」一致），
  //   否则会出现「牢头已在中军、牢门还锁着」的矛盾；人在囚室格(1,0)在锁门时段出不得门。
  var CELL_LOCK_HOURS=[10,11,0,1,2];
  function cellLockedHere(){
    var cp=S().flags && S().flags.cityPos;
    if(!cp || cp.cid!=='kuyilao' || cp.x!==1 || cp.y!==0) return false;
    return CELL_LOCK_HOURS.indexOf(hourNow())>=0;
  }
  // 牢头此刻落脚格（v20260916g）：作息表在 data/npc_cards.js 的 routine（10,11,0,1,2 守牢门口，余时中军场院）。
  //   应卯/销名都要「牢头在场」才办——营规是他掌着的，他不在，谁给你落销名的字？
  function wardenCell(){
    var rr=(LF.NPC_ROUTINES_CITY||{}).kuyilao||{};
    var r=rr.laotou||{};
    var h=hourNow();
    return (r[h]!=null)? r[h] : r._home;
  }
  function wardenHere(xy){ return wardenCell()===xy; }
    return {
      hourNow: hourNow, hourLabel: hourLabel, inHours: inHours,
      isMessHour: isMessHour, isDeadHour: isDeadHour, isCurfewHour: isCurfewHour, isRollHour: isRollHour,
      onbF: onbF, onbBound: onbBound, cellLockedHere: cellLockedHere, wardenCell: wardenCell, wardenHere: wardenHere,
      LABOR_PER_WOOD: LABOR_PER_WOOD, INN_FEE: INN_FEE
    };
  };
})(typeof window !== 'undefined' ? window : global);

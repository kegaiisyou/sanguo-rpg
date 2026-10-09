window.LF = window.LF || {};
(function(){
  // 时间引擎（v20261008k 从 engine.js 抽出）
  // 职责：游戏时钟核心 advanceTime/advanceMinutes + 时辰/日界/月界结算钩子。
  // 跨子系统日/月结算一律经 getter 惰性注入，本模块只编排。
  LF.createTime = function(ctx){
    var getState = ctx.getState;
    var getClockFlowing = ctx.getClockFlowing, getAutoOnbRoutines = ctx.getAutoOnbRoutines,
        getApplyTimeRoutines = ctx.getApplyTimeRoutines, getOnbDayTick = ctx.getOnbDayTick,
        getWarlordDayTick = ctx.getWarlordDayTick, getTickArmyDay = ctx.getTickArmyDay,
        getNpcAi = ctx.getNpcAi, getTryAmbush = ctx.getTryAmbush, getDeriveCalendar = ctx.getDeriveCalendar,
        getOnMonthTick = ctx.getOnMonthTick, getTickForge = ctx.getTickForge, getTickBuildOrders = ctx.getTickBuildOrders,
        getRequestCurfewPatrol = ctx.getRequestCurfewPatrol, getWeathers = ctx.getWeathers,
        getOnbF = ctx.getOnbF, getOnbBound = ctx.getOnbBound, getInCampNow = ctx.getInCampNow,
        getLog = ctx.getLog, getCheckDeath = ctx.getCheckDeath;
  function advanceTime(n){
    n=n||1;
    if(!getClockFlowing()()) return;
    advanceMinutes(n*120);          // 休息等整时辰动作委托分钟制（1 时辰=120 分钟）
  }
  function advanceMinutes(min){
    if(!getState()) return;
    min = Math.max(0, (min|0)||0);
    if(!getClockFlowing()()) return;     // 教学期「时辰未启」→ 时间一律冻结（同旧版）
    var before = getState().clock || 0;
    var raw = before + min;
    var crossings = Math.floor(raw/1440);                       // 跨子夜次数 = 经过的天数
    // 时辰边界换算：0 点 = 子时中段（子时=23:00-01:00，横跨午夜），故时辰下标 = floor((clock+60)/120) % 12
    //   （卯时自 clock=300 起、辰时自 420 起……）。此换算非单调（子时跨午夜时从 12 跳回 0），
    //   故跨辰数 = 模后差值，为负（逆跨午夜）则 +12 归正；直接用 floor(clock/120) 或单调差值都会漏进位。
    function _hourIdx(_c){ return Math.floor((_c+60)/120) % 12; }
    var crossedHours = _hourIdx(raw) - _hourIdx(before);
    if(crossedHours < 0) crossedHours += 12;
    getState().time = (getState().time + crossedHours) % 12;
    getState().clock = raw % 1440;                                   // 每时辰 = 120 游戏分钟
    getAutoOnbRoutines()();                       // 卯辰自动应卯 / 戌时自动销名（简化新手流程）
    getApplyTimeRoutines()();                     // 时辰推移 → 驱动 NPC 作息流动（全城通用）
    for(var i=0;i<crossedHours;i++){         // 生存消耗：每跨一辰扣一次（与旧版速率一致）
      getState().food=Math.max(0,(getState().food||0)-1);
      getState().drink=Math.max(0,(getState().drink||0)-1);
      getState().energy=Math.max(0,(getState().energy||0)-2);
    }
    maybeStarve();
    if(crossings>0){
      getOnbDayTick()(crossings);                 // 营中「一日」结算：点卯 / 旷役（v20260911h · P3）
      getState().day=(getState().day||0)+crossings;
      syncCalendar();                        // 跨日 → 农历月日 / 年号年序随之推进
      if(Math.random()<0.55) getState().weather=Math.floor(Math.random()*getWeathers().length); // 新日易天候
      getWarlordDayTick()(crossings);             // 群雄逐鹿：NPC 势力自动攻伐（v20260909o）
      getTickArmyDay()(crossings);                // 军务：行军推进 + 军粮消耗 + 断粮掉士气（v20260921a）
      if (getNpcAi() && getNpcAi().tickDay) getNpcAi().tickDay();   // 名将流动：按内驱力改易驻城（野心趋大城，好武趋边地）（v20260927j）
      getTryAmbush()();                           // 设伏：郊野候敌，敌至则先手（v20260921a）
    }
      // 朔日结算（v20260918g）：跨月 → 治下纳赋 + 群雄内政 + 势力存亡 + 统一终局（叠在耗时辰模型上）
      var _cal = getDeriveCalendar()();
      var _mk = _cal.adYear * 12 + _cal.month;
      var _newMonth = (getState().flags._monthKey != null && _mk !== getState().flags._monthKey);
      getState().flags._monthKey = _mk;   // 先写入新月键：朔日结算内的外交到期清算须用新值（否则盟约多生效一个月）
      if (_newMonth) getOnMonthTick()(_cal);
    getTickForge()(crossedHours);   // 炉膛随时辰持续推进（未跨辰不动，避免 0.25 时辰的小数进度）
    getTickBuildOrders()(crossings);   // 城市营造工单：跨日推进宏观委派 + 结算每日市租（第3步）
    // 查房（v20260911i）：此刻若已过戌时又在营中游荡，巡夜狱卒便来拿人。
    //   动作自身的文案正在打字，故走 getRequestCurfewPatrol()（记「待评」+ 叙事收尾后由 syncActionLock 续评）。
    curfewWarn();
    rollWarn();        // v20260916h：卯时应卯提醒（对称酉时预警）
    getRequestCurfewPatrol()();
  }
  // 酉时入夜预警（v20260916a）：劳作/赶路推进时辰后若到酉时且仍在营中，先提醒一句
  //   「戌时落锁」——把「天黑会被抓」的悬念提前给玩家，而不是等巡夜灯笼怼脸。
  function curfewWarn(){
    if(!getOnbBound()()) return;              // 已脱籍 / 营规未立：不必提醒
    if(getState().time!==9) return;           // 酉时（十二时辰下标 9）才是预警窗口
    if(!getInCampNow()()) return;
    var o=getOnbF()();
    if(o.curfewWarnDay===getState().day) return;   // 当日只提醒一次
    o.curfewWarnDay=getState().day;
    getLog()('〔天色将晚〕酉时过半，日头西沉——戌时营门落锁，记得回牢房销名。','warn');
  }
  // 卯时应卯提醒（v20260916h，对称酉时预警）：卯时一到若还没应名，先提一句——
  //   「应卯」窗口虽是卯至午四个时辰，但多数玩家头几天根本不知道时辰这回事，先亮个路标。
  function rollWarn(){
    if(!getOnbBound()()) return;
    if(getState().time!==3) return;              // 卯时（十二时辰下标 3）是应卯窗口开头
    if(!getInCampNow()()) return;
    var o=getOnbF()();
    if(o.rollWarnDay===getState().day) return;   // 当日只提醒一次
    o.rollWarnDay=getState().day;
    getLog()('〔天色将明〕卯时了，牢头在中军场院点名——记得去应一声，过午不候。','warn');
  }
  // 由累计天数回写年号年序 + 年号名（年号随公元年自动切换：184→中平，杜绝 184 仍显「光和」）
  function syncCalendar(){
    var c=getDeriveCalendar()();
    getState().eraName=c.eraName; getState().eraYear=c.eraYear; getState().adYear=c.adYear;
  }
  // 饥饿过高：食物/饮水耗尽则持续侵蚀气血（硬性限制）；归零即殒落
  function maybeStarve(){
    var dmg=0, msgs=[];
    if(getState().food<=0){ dmg+=6; msgs.push('腹中空虚'); }
    if(getState().drink<=0){ dmg+=4; msgs.push('喉间干涸'); }
    if(dmg>0){
      getState().hp=Math.max(0,getState().hp-dmg);
      getLog()('〔饥馁〕'+msgs.join('，')+'，气血-'+dmg+'。','combat');
      getCheckDeath()();
    }
  }
    return { advanceTime: advanceTime, advanceMinutes: advanceMinutes, curfewWarn: curfewWarn,
             rollWarn: rollWarn, syncCalendar: syncCalendar, maybeStarve: maybeStarve };
  };
})();

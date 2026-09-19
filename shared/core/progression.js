// 进阶数值子系统（从 engine.js 拆分）
// 善恶双轴（侠义/凶名）、声望、修为经验与效果结算：角色成长相关的纯数值 mutator 集中到此处，
// 与状态栏 UI 渲染（renderStatus/renderLocTab，仍留引擎）解耦；其它模块经引擎别名直接调用。
// 引擎可变状态（state/combatMode/packAdd）与函数（log/openModal/clampHp）通过 getter 注入；G 为全局游戏数据对象。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createProgression = function (ctx) {
    var getState = ctx.getState, S = getState;
    var getLog = ctx.getLog;
    var getCombatMode = ctx.getCombatMode;
    var getOpenModal = ctx.getOpenModal;
    var getClampHp = ctx.getClampHp;
    var getG = ctx.getG;
    var getPackAdd = ctx.getPackAdd;
  function moralLabel(){
    var c=S().chivalry, n=S().notoriety;
    if(c>0 && n>0) return '侠'+c+'·凶'+n;
    if(c>0) return '侠'+c;
    if(n>0) return '凶'+n;
    return '中立';
  }
  // 风评称号（基于双轴阈值，见 GAME_DESIGN 4.2）
  function moralTitle(){
    var c=S().chivalry, n=S().notoriety;
    if(c>=40 && n>=40) return '亦正亦邪·枭雄';
    if(c>=30 && n>=30) return '正邪莫测';
    if(c>=30) return '清流义士';
    if(n>=30) return '绿林枭雄';
    if(c>=10 && n>=10) return '正邪交织';
    if(c>=10) return '侠义新秀';
    if(n>=10) return '初露凶名';
    return '无名之辈';
  }
  // 双轴累积 + 阈值解锁提示（P3）
  function addChivalry(v){
    var b=S().chivalry; S().chivalry=Math.max(0,S().chivalry+(v||1));
    afterMoral('chivalry', b, S().chivalry);
  }
  function addNotoriety(v){
    var b=S().notoriety; S().notoriety=Math.max(0,S().notoriety+(v||1));
    afterMoral('notoriety', b, S().notoriety);
  }
  function afterMoral(axis, before, after){
    if(axis==='chivalry'){
      if(before<30 && after>=30) getLog()('【风评】侠义值达 30！清流名士敬重，可接「侠义委托」。','good');
      if(before<40 && after>=40) getLog()('【风评】侠义值达 40！','good');
    } else {
      if(before<30 && after>=30) getLog()('【风评】凶名值达 30！影门与绿林亲近，可接「高阶悬赏」。','good');
      if(before<40 && after>=40) getLog()('【风评】凶名值达 40！','good');
    }
    if(S().chivalry>=40 && S().notoriety>=40 && !S().flags.usurper_seen){
      S().flags.usurper_seen=true;
      getLog()('【风评】侠义凶名俱达 40——亦正亦邪·枭雄 之路为你敞开！','good');
    }
  }
  // 声望框架：0-100，称号区间见 GAME_DESIGN 4.1（P4 起由胜战真实获取；调试台内置常驻，可直赋测试）
  function repTitle(rep){
    if(rep>=95) return '一代宗师';
    if(rep>=85) return '名扬天下';
    if(rep>=70) return '威震一方';
    if(rep>=55) return '名动一方';
    if(rep>=40) return '江湖新秀';
    if(rep>=25) return '小有名气';
    if(rep>=10) return '初入江湖';
    return '无名小卒';
  }
  function addReputation(n){
    var old=S().reputation;
    S().reputation=Math.max(0,Math.min(100,S().reputation+n));
    getLog()('【声望】'+(S().reputation-old>=0?'+':'')+(S().reputation-old)+'（当前 '+S().reputation+' · '+repTitle(S().reputation)+'）','good');
  }

  // ===== 升级 / 效果结算 =====
  // 敌人修为经验：依敌方气血与攻击估算（设计 4.7：修为经验来自战斗结算）
  function enemyExp(en){
    if(!en || en.id==='dummy') return 0;
    return Math.max(1, Math.round((en.hp + en.atk*4) / 10));
  }
  // 升级：每级获得 1 点自由属性点（加点见角色面板 attrAllocHTML）
  // v20260916c：弹窗只在「本轮真的破境」时开 —— 旧版只要 freePoints>0 就弹（应卯+5 修为不升级也弹），
  //   且弹窗文案把「已有自由点」说成「获得」，玩家以为白捡属性点。levelupGained 记本轮新增点供文案使用。
  function addXp(n){
    if(!S().attr) S().attr={hp:5,atk:5,def:5,spd:5};
    S().exp+=n;
    var _lv0=S().level, _gained=0;
    while(S().exp>=getG().BALANCE.expNeed(S().level) && S().level<getG().CONSTANTS.MAX_LEVEL){
      S().exp-=getG().BALANCE.expNeed(S().level); S().level++; _gained++;
      S().freePoints=(S().freePoints||0)+1;              // 每升一级获得 1 点自由属性点
      S().hp=S().maxHp;S().mp=S().maxMp;             // 破境气血内力尽复
      getLog()('【破境】修为精进！已至 LV.'+S().level+'，获得 1 点自由属性点（余 '+(S().freePoints||0)+'）。气血尽复。','good');
    }
    if(_gained>0 && getCombatMode()===null){ S().levelupGained=_gained; try{ getOpenModal()('levelup'); }catch(e){} }
  }
  function applyEffect(e){
    e=e||{}; var got=[];
    if(e.xp){addXp(e.xp);got.push('修为+'+e.xp);}
    if(e.gold){S().gold=Math.max(0,S().gold+e.gold);got.push('银两'+(e.gold>0?'+':'')+e.gold);}
    if(e.atk){ if(!S().flatBonus) S().flatBonus={hp:0,atk:0,def:0,spd:0}; S().flatBonus.atk+=e.atk; got.push('攻+'+e.atk); }
    if(e.def){ if(!S().flatBonus) S().flatBonus={hp:0,atk:0,def:0,spd:0}; S().flatBonus.def+=e.def; got.push('防+'+e.def); }
    if(e.maxMp){S().maxMp+=e.maxMp;S().mp+=e.maxMp;got.push('内力上限+'+e.maxMp);}
    if(e.mp==='full'){S().mp=S().maxMp;} else if(e.mp){S().mp=Math.min(S().maxMp,S().mp+e.mp);}
    if(e.hp==='full'){S().hp=S().maxHp;got.push('气血尽复');} else if(e.hp){S().hp=Math.min(S().maxHp,S().hp+e.hp);got.push('气血+'+e.hp);}
    if(e.flag)S().flags[e.flag]=true;
    if(e.reputation){addReputation(e.reputation);}
    else if(e.rep){addReputation(e.rep);}
    // 永久战力加成（atk/def）经 flatBonus 累加后，必须重算派生战力方能生效
    if(e.atk || e.def){ getG().recalcBase(S()); getClampHp()(); }
    if(e.give){
      var arr=Array.isArray(e.give)?e.give:[e.give];
      arr.forEach(function(g){
        var defId=g.defId||g, n=g.n||1;
        var it=LF.ITEMS.makeItem(defId, n);
        if(getPackAdd()(it)) got.push((it.name||defId)+'×'+n);
        else got.push('（行囊已满，'+defId+'未得）');
      });
    }
    if(got.length) getLog()('【收获】'+got.join('，')+'。','good');
  }
  function findEvent(id){ for(var i=0;i<getG().EVENTS.length;i++) if(getG().EVENTS[i].id===id) return getG().EVENTS[i]; return null; }
    return {
      moralLabel, moralTitle, addChivalry, addNotoriety, afterMoral, repTitle, addReputation, enemyExp, addXp, applyEffect, findEvent
    };
  };
})(typeof window !== 'undefined' ? window : global);

// 模块 farm（从 engine.js 拆分）
(function (global) {
  global.LF = global.LF || {};
  global.LF.createFarm = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
    var CROPS = ctx.CROPS;
    var advanceMinutes = ctx.advanceMinutes;
    var afterPackChange = ctx.afterPackChange;
    var buildActions = ctx.buildActions;
    var busyAct = ctx.busyAct;
    var curRoom = ctx.curRoom;
    var exert = ctx.exert;
    var fxGet = ctx.fxGet;
    var log = ctx.log;
    var onbWork = ctx.onbWork;      // v20260920h：真实农事操作（翻/播/浇/收）各记 1 工分
    var renderStatus = ctx.renderStatus;
    var toast = ctx.toast;
    var jobOpen = ctx.jobOpen;

  // ═══ 农田（0,0）：九畦（v20260915g）═══
  //   旧版只有「一块薄田」：翻三垄 → 掐菜，掐完还是那块地 —— 种地的人无从长进，
  //   浇水也只是多给一捧，看不出「照料」的分量。
  //   新版把它做成九畦的园子：荒地要一垄一垄开出来（开到第几畦，看你肯下多少工）；
  //   每畦各自走 翻 → 播 → 长 → 收 —— 长出什么，取决于你播了什么、浇没浇水、收得及不及时。
  //   升级给的是【机制】不是数值：水渠（一桶浇遍）、编筐（多得一捧）、留种（收完必返籽）。
  //   状态存 fixtures['kuyilao|0,0']：plots[] 每畦 / unlocked 已开出几畦 / up{} 升级 / li 当前畦已翻垄数
  var FARM_MAX = 9;                    // 九畦到顶（再阔就是庄园，不是囚徒的园子了）
  var FARM_LI  = 3;                    // 开一畦须翻三垄
  var CROPS = {
    yecai: { name:'野菜', icon:'🥬', grow:3, out:'yecai', yield:[1,2], seed:'caizi' },
    dou:   { name:'菽豆', icon:'🥜', grow:6, out:'dou',   yield:[1,2], seed:'douzhong' }
  };
  function farmFx(){
    var f=fxGet('kuyilao|0,0');
    if(!f.plots){
      f.plots=[]; for(var i=0;i<FARM_MAX;i++) f.plots.push({st:'wild'});
      f.unlocked=0; f.up={}; f.li=0;
      // 旧存档迁移：老版本只记「翻了几垄」，翻透的即算第一畦已开出来
      if((f.tilled||0)>=FARM_LI){ f.plots[0].st='tilled'; f.unlocked=1; }
    }
    if(!f.up) f.up={};
    return f;
  }
  function farmTilled(){ var f=farmFx(); return (f.unlocked||0)>0 || (f.tilled||0)>=FARM_LI; }
  function farmHas(id,n){ var it=packFind(id); return !!(it && (it.count||0)>=n); }
  // 一畦此刻的模样：wild 未开 / tilled 已翻 / growing 长着 / ripe 可收 / wither 枯了
  function plotStage(p){
    if(!p || p.st!=='sown') return p ? p.st : 'wild';
    var c=CROPS[p.crop]||CROPS.yecai;
    var need=Math.max(1, c.grow - (p.wet?1:0));        // 浇过水的早一个时辰熟
    var past=plantPast(p);
    if(past>=c.grow*3) return 'wither';                // 该收不收，苗就荒死在畦里（须在 ripe 之前判：熟过头=荒死）
    if(past>=need) return 'ripe';
    return 'growing';
  }
  function plotLeft(p){
    var c=CROPS[p.crop]||CROPS.yecai;
    return Math.max(0, Math.max(1,c.grow-(p.wet?1:0)) - plantPast(p));
  }
  // 播种以来已过的时辰数（绝对口径：天数×12 + 时辰差，跨子夜不回绕；旧档无 sownDay 按当日 0 起）
  function plantPast(p){
    var sd = (p && p.sownDay!=null) ? p.sownDay : S().day;
    var st = p && (p.sownT||0);
    return (S().day - sd) * 12 + (S().time - st);
  }
  // 开垦：一次一垄，三垄开出一畦；头一回孙老递过锄头
  function farmTill(){
    if(!jobOpen('farm')){ toast('孙老没托你翻这块地，贸然动土反招人疑。'); return; }
    var f=farmFx();
    if((f.unlocked||0)>=FARM_MAX){ toast('九畦都开出来了——再开就该惊动牢头了。'); return; }
    // v20260928f：工具已物品化——认「工具」槽或行囊中的锄（旧 packFind 只看行囊，装到槽上就找不着了）
    if(!(LF.heldTool && LF.heldTool(S(), 'hoeLv'))){
      packAdd('chutu',1);
      packAdd('caizi',2);   // 头一回下地，孙老连家伙带籽一并给——不然开了地也无从下手
      log('孙老从田埂边摸出一把锄头递过来：「家伙给你。土要翻透，别糊弄老骨头。」（得「锄头」×1）','good');
      log('他又从怀里摸出个小布袋塞给你：「菜籽。撒下去，别贪多——头一茬能活一半，就算老天赏脸。」（得「菜籽」×2）','good');
    }
    if(!exert('开垦')) return;
    busyAct('开垦·半个时辰', 1000, function(){
      var held = (LF.heldTool && LF.heldTool(S(), 'hoeLv')) || null;
      var lv = held ? (held.lv || 0) : -1;
      var li = 1 + (lv >= 0 ? Math.floor(lv/2) : 0);        // 好锄一抡翻数垄；徒手只一垄
      S().energy=Math.max(0, S().energy-(4 + (lv<0?2:0)));  // 徒手刨土额外费力
      advanceMinutes(60);
      if(held){ var _wn=LF.wearSitNote(S(),held); if(_wn) log(_wn,'warn'); LF.wearTool(S(), held); }
      f.li=(f.li||0)+li; f.tilled=(f.tilled||0)+li;         // tilled 仅为旧存档/旧判定留的兼容计数
      log('你抡'+(held?held.def.name:'手')+'翻过'+li+'垄，湿土翻开，草腥气扑了满脸。（第 '+((f.unlocked||0)+1)+' 畦：'+Math.min(f.li,FARM_LI)+' / '+FARM_LI+' 垄）','env');
      if(f.li>=FARM_LI){
        var carry = f.li - FARM_LI;                          // 好锄多翻的垄结转下一畦，不白费
        f.plots[f.unlocked||0]={ st:'tilled' };
        f.unlocked=(f.unlocked||0)+1; f.li=carry;
        log('三垄翻透，土细如筛——第 '+f.unlocked+' 畦开出来了。撒菜籽还是菽种，在你。'+(carry?('（余势未歇，顺手翻了下畦 '+carry+' 垄。）'):''),'good');
        if(onbWork) onbWork();        // v20260920h：开出一畦记 1 工分
      }
      save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 播种：一畦一份种子；菜籽长得快，菽豆长得慢却厚
  function farmSow(i, key){
    var f=farmFx(), p=f.plots[i]; if(!p) return;
    var c=CROPS[key]; if(!c) return;
    if(!farmHas(c.seed,1)){ toast('没有'+c.name+'的种子——向孙老讨，或拿收成自己留种。'); return; }
    if(!exert('播种')) return;
    busyAct('播种·'+c.name, 800, function(){
      packConsume(c.seed,1);
      advanceMinutes(60);
      p.st='sown'; p.crop=key; p.sownT=S().time; p.sownDay=S().day; p.wet=false;
      log('你把'+c.name+'籽撒进第 '+(i+1)+' 畦，覆土踩实。约 '+c.grow+' 个时辰可收——浇过水则早一个时辰。','good');
      if(onbWork) onbWork();        // v20260920h：播完一畦记 1 工分
      afterPackChange(); save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 浇水：寻常一次浇一畦；修了水渠则三份水浇遍所有长着的畦
  function farmWater(i){
    var f=farmFx();
    var bag=packFind('shuidai');
    if(!bag || (bag.water||0) < 3){ toast('水袋里不足三份水——先去农田那格的水井「打水」装袋。'); return; }
    var all=!!f.up.canal, targets=[];
    for(var k=0;k<(f.unlocked||0);k++){ if(plotStage(f.plots[k])==='growing') targets.push(k); }
    if(!all){ if(plotStage(f.plots[i])!=='growing'){ toast('这一畦此刻不缺水。'); return; } targets=[i]; }
    if(!targets.length){ toast('眼下没有正长着的畦。'); return; }
    if(!exert('挑水浇畦')) return;
    busyAct('挑水浇畦', 900, function(){
      bag.water=(bag.water||0)-3;
      advanceMinutes(60);
      for(var k=0;k<targets.length;k++) f.plots[targets[k]].wet=true;
      log(all?('水渠一开，三份水顺着沟渗进 '+targets.length+' 畦——这就是修渠的好处。')
             :('你把水浇进第 '+(i+1)+' 畦，湿泥颜色转深——这一茬能早熟一个时辰。'),'good');
      if(onbWork) onbWork();        // v20260920h：浇完记 1 工分
      afterPackChange(); save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 锄草：不催熟，只把时辰往前推一个，顺带让人不至于干等
    // 锄草：不催熟，只把时辰往前推一个，顺带让人不至于干等
  // v20260928i：工具已物品化——认锄（hoeLv）；有锄则除草更利落、不费劲，并磨损锄
  function farmWeed(i){
    var f=farmFx();
    if(!exert('锄草')) return;
    var held0=(LF.heldTool && LF.heldTool(S(),'hoeLv'))||null;
    if(!held0 && !S().flags.hintedNoHoe){
      S().flags.hintedNoHoe=true;
      toast('徒手除草费劲——备一把锄头（货郎有售）除草更利落。');
    }
    busyAct('锄草', 800, function(){
      var held=(LF.heldTool && LF.heldTool(S(),'hoeLv'))||null;
      advanceMinutes(60);
      S().energy=Math.max(0, S().energy-(held?0:1));
      log('你'+(held?('持'+held.def.name+'三两下刨去草根'):('蹲在第 '+(i+1)+' 畦边手拔'))+'，土腥气扑了满脸。（距可收约 '+plotLeft(f.plots[i])+' 个时辰）','env');
      if(held){ var _wn=LF.wearSitNote(S(),held); if(_wn) log(_wn,'warn'); LF.wearTool(S(), held); }
      save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 采收：得实物；浇过水 +1 捧；有编筐再 +1 捧；留种则返一份籽
    // 采收：得实物；浇过水 +1 捧；有编筐再 +1 捧；留种则返一份籽
  // v20260928h：工具已物品化——认「工具」槽或行囊中的镰（sickleLv）；有镰则脱粒更净、收得更多，并磨损镰
  function farmHarvest(i){
    var f=farmFx(), p=f.plots[i]; if(!p) return;
    var c=CROPS[p.crop]||CROPS.yecai;
    if(!exert('采收')) return;
    var held0=(LF.heldTool && LF.heldTool(S(),'sickleLv'))||null;
    if(!held0 && !S().flags.hintedNoSickle){
      S().flags.hintedNoSickle=true;
      toast('徒手采收费力且脱粒不净——备一把镰刀（货郎有售，或行囊里装上）收得更多。');
    }
    busyAct('采收·'+c.name, 900, function(){
      var held=(LF.heldTool && LF.heldTool(S(),'sickleLv'))||null;
      if(held && held.item.dur!=null && held.item.dur<=0) toast('镰已卷刃，先去修再割更利落——此刻仍能凑合。');
      advanceMinutes(60);
      S().energy=Math.max(0, S().energy-2);
      var n=c.yield[0]+Math.floor(Math.random()*(c.yield[1]-c.yield[0]+1));
      if(p.wet) n+=1;
      if(f.up.basket) n+=1;
      if(held) n+=1+Math.floor((held.lv||0)/2);
      if(!packAdd(c.out, n)) return;
      f.picked=(f.picked||0)+n;
      var back=false;
      var keepP=held?0.55:0.4;
      if(f.up.seedkeep || Math.random()<keepP){ if(packAdd(c.seed,1)) back=true; }
      p.st='tilled'; p.crop=null; p.wet=false;
      log('第 '+(i+1)+' 畦'+(held?('你持'+held.def.name+'贴垄刈过，谷穗应声而落'):'你蹲地手掰，费劲掐下')+'，收得'+c.name+'×'+n+'。'+(back?'（留下一份籽，下一茬有着落。）':'')+(f.up.basket?'（筐编得好，多兜了一捧。）':''),'good');
      if(held){ var _wn=LF.wearSitNote(S(),held); if(_wn) log(_wn,'warn'); LF.wearTool(S(), held); }
      if(onbWork) onbWork();
      afterPackChange(); save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 铲枯苗：该收没收，苗荒死在畦里 —— 土还在，重头再来
  function farmClear(i){
    var f=farmFx(), p=f.plots[i]; if(!p) return;
    if(!exert('铲除枯苗')) return;
    busyAct('铲除枯苗', 700, function(){
      advanceMinutes(60);
      p.st='tilled'; p.crop=null; p.wet=false;
      log('你把枯苗连根铲起，扔在田埂上晾着——土还在，重头再来。','env');
      save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 升级三件：给机制，不给数值（数值涨了只会让人更快做完，机制变了才会换一种做法）
  var FARM_UP = {
    canal:    { name:'水渠', icon:'🚰', cost:{ shitiao:3 }, need:{ shitiao:3 }, desc:'沿畦开一道小沟。此后三份水浇遍所有长着的畦，不必一畦一畦挑。' },
    basket:   { name:'编筐', icon:'🧺', cost:{ rope:1 },    need:{ rope:1 },    desc:'请席翁编一只收菜的筐。此后每畦采收都多得一捧。' },
    seedkeep: { name:'留种', icon:'🌱', cost:{ bumu:1 },    need:{ bumu:1 },    desc:'缝一只布口袋存籽。此后每收一畦，必留得一份种子。' }
  };
  function farmUpgrade(key){
    var f=farmFx(), u=FARM_UP[key]; if(!u) return;
    if(f.up[key]){ toast(u.name+'已经有了。'); return; }
    for(var id in u.need){ if(!farmHas(id, u.need[id])){
      var dn=(window.LF&&LF.ITEMS&&LF.ITEMS.DEFS&&LF.ITEMS.DEFS[id])?LF.ITEMS.DEFS[id].name:id;
      toast('料不够：修'+u.name+'需「'+dn+'」×'+u.need[id]+'。'); return;
    } }
    if(!exert('修'+u.name)) return;
    busyAct('修'+u.name, 1200, function(){
      for(var id in u.need) packConsume(id, u.need[id]);
      advanceMinutes(60);
      f.up[key]=true;
      log('〔农田·'+u.name+'〕'+u.desc,'good');
      afterPackChange(); save(S()); renderStatus(); buildActions(curRoom());
    });
  }
  // 格上的设施：每畦按当前状态只显一条（故九畦最多九条），外加三处升级
  function farmObjects(){
    var arr=[], f=farmFx(), un=f.unlocked||0;
    for(var _i=0;_i<FARM_MAX;_i++){
      (function(i){
        var nm='第 '+(i+1)+' 畦';
        // v20260928f：标签按手中锄的阶位显示「一锄几垄」，让玩家看见工具差异
        var _hoe=(LF.heldTool && LF.heldTool(S(),'hoeLv'))||null;
        var _li=1+(_hoe?Math.floor((_hoe.lv||0)/2):0);
        arr.push({ icon:'🌾', label:nm+'·荒地',
          show:function(){ return jobOpen('farm') && i===farmFx().unlocked && farmFx().unlocked<FARM_MAX; },
          acts:[{label:'开垦（一锄'+_li+'垄）', icon:'⛏️', fn:function(){ farmTill(); }}] });
        arr.push({ icon:'🟫', label:nm+'·已翻',
          show:function(){ return jobOpen('farm') && i<farmFx().unlocked && plotStage(farmFx().plots[i])==='tilled'; },
          acts:[{label:'播·野菜（菜籽×1）', icon:'🥬', fn:function(){ farmSow(i,'yecai'); }},
                {label:'播·菽豆（菽种×1）', icon:'🥜', fn:function(){ farmSow(i,'dou'); }}] });
        arr.push({ icon:'🌱', label:nm+'·长着',
          show:function(){ return jobOpen('farm') && i<farmFx().unlocked && plotStage(farmFx().plots[i])==='growing'; },
          acts:[{label:'浇水（三份）', icon:'💧', show:function(){ return !farmFx().plots[i].wet; }, fn:function(){ farmWater(i); }},
                {label:'锄草', icon:'🧹', fn:function(){ farmWeed(i); }}] });
        arr.push({ icon:'🥬', label:nm+'·可收',
          show:function(){ return jobOpen('farm') && i<farmFx().unlocked && plotStage(farmFx().plots[i])==='ripe'; },
          acts:[{label:'采收', icon:'🧺', fn:function(){ farmHarvest(i); }}] });
        arr.push({ icon:'🥀', label:nm+'·枯了',
          show:function(){ return jobOpen('farm') && i<farmFx().unlocked && plotStage(farmFx().plots[i])==='wither'; },
          acts:[{label:'铲除枯苗', icon:'🧹', fn:function(){ farmClear(i); }}] });
      })(_i);
    }
    // v20260924z5：农田三处升级（水渠工地/藤条堆/针线笸箩）暂全部收掉 —— 物件太密、农庄格太乱。
    //   升级逻辑（farmUpgrade / up.canal / up.basket / up.seedkeep）原样保留，将来做进 NPC 或别处再挂回。
    return arr;
  }
    return {
      CROPS, FARM_LI, FARM_MAX, FARM_UP,
      farmClear, farmFx, farmHarvest, farmHas,
      farmObjects, farmSow, farmTill, farmTilled,
      farmUpgrade, farmWater, farmWeed, plantPast,
      plotLeft, plotStage,
    };
  };
})(typeof window !== 'undefined' ? window : global);

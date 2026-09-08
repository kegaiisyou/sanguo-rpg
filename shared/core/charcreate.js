// 捏人 / 开场序章：角色创建流程（v20260909g）
// 从 engine.js 拆出：四维常量（ATTR_DEFS/CREATE_FREE/ATTR_MIN/ATTR_MAX，依赖 G.ATTR_RATIO）、古风随机姓名表（CR_*）、
// initCreateState/beginCreate/randName/renderCreateHTML/updateCreateUI/bindCreate/attrAllocHTML/confirmAttr/updateAttrAllocUI/bindAttrAlloc/confirmCreate。
// 依赖经 ctx 注入：G（取 G.ATTR_RATIO / G.defaultSave）；getCreateState/setCreateState（引擎侧可变对象，openModal 会读取并调用 initCreateState，故须 getter+setter）；
// openModal / closeModal / enterGame。pendingSlot、pendingSave 仅本流程使用，已随簇移入模块作为私有状态。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createCharCreate = function (ctx) {
    var G = ctx.G;
    var getState = ctx.getState, S = getState;
    var getCreateState = ctx.getCreateState, setCreateState = ctx.setCreateState;
    var openModal = ctx.openModal, closeModal = ctx.closeModal, enterGame = ctx.enterGame;
    var getCard = ctx.getCard;
    var clampHp = ctx.clampHp, renderStatus = ctx.renderStatus, toast = ctx.toast, save = ctx.save;
    var pendingSlot = 0, pendingSave = null;

  var ATTR_DEFS=[
    {k:'hp',  n:'气血', t:'每点 +'+G.ATTR_RATIO.hp+' 气血上限'},
    {k:'atk', n:'攻击', t:'每点 +'+G.ATTR_RATIO.atk+' 攻击'},
    {k:'def', n:'防御', t:'每点 +'+G.ATTR_RATIO.def+' 防御'},
    {k:'spd', n:'身法', t:'每点 +'+G.ATTR_RATIO.spd+' 身法'}
  ];
  var CREATE_FREE=5;   // 开局可自由分配点数
  var ATTR_MIN=1;      // 单属性下限（初始 5，可降至 1 以便重新分配）
  var ATTR_MAX=20;     // 单属性上限

  // ===== 捏人 / 开场序章 =====
  function initCreateState(){
    var attr={}; ATTR_DEFS.forEach(function(a){ attr[a.k]=5; }); // 四维初始皆 5
    setCreateState({ name:'', attr:attr, pool:CREATE_FREE, skip:false });
  }
  // 资质壳已移除，加点直接作用于四维 attr
  function beginCreate(slot){
    pendingSlot=slot||0;
    initCreateState();
    openModal('create');
  }
  // ===== 古风随机名（v20260908k）=====
  var CR_SURNAMES=['赵','钱','孙','李','周','吴','郑','王','冯','陈','卫','蒋','沈','韩','杨','朱','秦','许','何','吕','张','孔','曹','严','华','金','魏','陶','姜','谢','苏','潘','葛','范','彭','鲁','马','方','俞','袁','柳','鲍','史','唐','薛','贺','倪','汤','罗','毕','郝','安','常','于','傅','齐','康','伍','余','顾','孟','黄','穆','萧','尹','姚','邵','湛','汪','祁','毛','禹','狄','米','贝','明','臧','计','伏','成','戴','谈','宋','茅','庞','熊','纪','舒','屈','项','祝','董','梁','杜','阮','蓝','闵','席','季','麻','强','贾','路','娄','危','江','童','颜','郭','梅','盛','林','刁','钟','徐','邱','骆','高','夏','蔡','田','樊','胡','凌','霍','虞','万','支','柯','昝','管','卢','莫','经','房','裘','缪','干','解','应','宗','丁','宣','贲','邓','郁','单','杭','洪','包','诸','左','石','崔','吉','钮','龚','程','嵇','邢','滑','裴','陆','荣','翁','荀','羊','於','惠','甄','曲','家','封','芮','羿','储','靳','汲','邴','糜','松','井','段','富','巫','乌','焦','巴','弓','牧','隗','山','谷','车','侯','宓','蓬','全','郗','班','仰','秋','仲','伊','宫','宁','仇','栾','暴','甘','钭','厉','戎','祖','武','符','刘','景','詹','束','龙','叶','幸','司','韶','郜','黎','蓟','薄','印','宿','白','怀','蒲','邰','从','鄂','索','咸','籍','赖','卓','蔺','屠','蒙','池','乔','阴','鬱','胥','能','苍','双','闻','莘','党','翟','谭','贡','劳','逄','姬','申','扶','堵','冉','宰','郦','雍','却','璩','桑','桂','濮','牛','寿','通','边','扈','燕','冀','郏','浦','尚','农','温','别','庄','晏','柴','瞿','阎','充','慕','连','茹','习','宦','艾','鱼','容','向','古','易','慎','戈','廖','庾','终','暨','居','衡','步','都','耿','满','弘','匡','国','文','寇','广','禄','阙','东','欧','殳','沃','利','蔚','越','夔','隆','师','巩','厍','聂','晁','勾','敖','融','冷','訾','辛','阚','那','简','饶','空','曾','毋','沙','乜','养','鞠','须','丰','巢','关','蒯','相','查','后','荆','红','游','竺','权','逯','盖','益','桓','公','万俟','司马','上官','欧阳','夏侯','诸葛','闻人','东方','赫连','皇甫','尉迟','公羊','澹台','公冶','宗政','濮阳','淳于','单于','太叔','申屠','公孙','仲孙','轩辕','令狐','钟离','宇文','长孙','慕容','鲜于','闾丘','司徒','司空','亓官','司寇','仉','督','子车','颛孙','端木','巫马','公西','漆雕','乐正','壤驷','公良','拓跋','夹谷','宰父','谷梁','晋','楚','闫','法','汝','鄢','涂','钦','段干','百里','东郭','南门','呼延','归','海','羊舌','微生','岳','帅','缑','亢','况','后','有','琴','梁丘','左丘','东门','西门','商','牟','佘','佴','伯','赏','南宫','墨','哈','谯','笪','年','爱','阳','佟'];
  var CR_GIVEN1=['云','飞','羽','备','操','权','亮','懿','统','瑜','肃','蒙','逊','维','艾','会','延','岱','晃','辽','郃','褚','惇','渊','仁','禁','洪','基','丕','植','彰','霸','平','兴','苞','化','慈','钦','据','壹','奂','芳','策','静','绍','术','表','琦','琮','虔','竺','铄','载','肇','堪','勰','邕','乂','夔','亶','劭','谌','谔','谞','谧','骞','寔','寯','寮','寰','才','捷','敏','敬','文','武','烈','昭','穆','襄','桓','灵','献','明','章','和','安','顺','冲','质','元','成','康','孝','惠','怀','愍','初','建','兴','中','太','永','光','风','云','龙','虎','豹','麟','凤','鹏','鸿','鹄','鸢','鹰','骥','骏','骐','骢','骓','骊','骅','骝','骠','骢','魏','蜀','吴','汉','晋','隋','唐','宋','元','明','清','民','国','家','邦','城','郊','野','林','森','松','柏','桐','梧','柳','杨','桂','兰','芷','蕙','荃','蘅','芜','菁','茂','荣','华','英','秀','俊','杰','豪','贤','圣','哲','智','慧','聪','明','睿','思','念','怀','忆','悟','觉','知','识','学','文','章','诗','书','礼','乐','射','御','数','经','史','子','集','儒','道','法','名','墨','纵横','农','杂','小说','兵','医','卜','算','巧','冶','匠','陶','渔','樵','耕','织','缝','绣','绘','塑','雕','刻','铸','锻','研','磨','钻','凿','掘','探','寻','觅','求','追','逐','奔','驰','驱','策','鞭','鞍','蹄','辙','迹','痕','印','章','符','节','绶','玺','冕','冠','簪','缨','佩','环','玦','珠','宝','玉','金','银','铜','铁','锡','铅','丹','砂','石','玉','珠','贝','齿','革','丝','麻','棉','毛','皮','羽','角','爪','牙','骨','肉','血','筋','脉','髓','脑','心','肝','脾','肺','肾','胆','胃','肠','腹','胸','背','腰','肩','臂','腕','掌','指','拳','爪','足','膝','胫','股','腿','脚','头','面','眼','耳','鼻','口','舌','齿','唇','眉','发','须','髯','鬓','颜','容','貌','相','态','姿','韵','味','声','音','响','影','光','辉','耀','芒','彩','霞','虹','霓','雾','露','霜','雪','冰','雹','雷','电','风','雨','云','天','地','山','水','江','河','湖','海','洋','泉','潭','溪','涧','滩','洲','岛','峰','岭','崖','谷','壑','岩','石','林','森','木','花','草','鸟','兽','虫','鱼','龙','凤','麟','龟','鹤','鸾','莺','燕','雁','鹰','隼','鹏','鲲','鲸','鲨','鲤','鲈','鲑','鳜','鳢','鲂','鲔','鲟','鳇','鳣','鲡','鳗','鲠','鲡','鳏','鳐','鳎','鳒','鳓','鳔','鳕','鳖','鳗','鼋','鼍','蛤','蚌','蛎','螺','蜗','蟹','虾','蚕','蜂','蝶','蛾','蚊','蝇','萤','蝉','螳','螂','蜘','蛛','蜈','蚣','蝎','蛇','蜥','蜴','蛙','蟾','蜍','蚓','蚯','蜗','蛾','蝠','鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪','猫','驴','骡','骆','驼','鹿','麋','獐','狐','狸','狼','豺','豹','熊','罴','象','犀','狮','麒','麟','麈','麋','麝','貂','鼠','鼬','鼯','鼹','狨','猿','猴','猱','獾','貉','狸','狐','猫','犬','狗','獒','狼','豺','狈','熊','罴','猪','豚','彘','豕','牛','羊','马','驴','骡','骆','驼','鹿','麋','獐','兔','鼠','虎','豹','狮','象','犀','麒','麟'];
  var CR_GIVEN2=['子龙','云长','翼德','孟德','玄德','仲谋','孔明','伯约','公瑾','子敬','子明','伯言','士元','奉孝','文若','仲达','元直','公明','文远','令明','妙才','元让','子廉','孟起','汉升','颜良','文丑','奉先','公台','伯珪','景升','季玉','公路','本初','正礼','恭祖','孟卓','寿成','彦才','伟台','公奕','仲理','伯安','仲业','季珪','子鱼','幼平','公覆','德谋','义公','大虎','小虎','承渊','元逊','伯苗','文伟','休昭','公弘','奉宗','永南','国山','伟度','文师','君矫','仲和','孝直','休穆','承嗣','元叹','孝起','子初','幼宰','文进','仲远','公衡','伯恭','显思','显奕','显甫','元图','公则','仲治','伯珪','文则','仲简','孟高','元才','公纪','仲翔','季明','子纲','子布','仲父','子房','文和','文优','仲颖','伯求','孟珪','元伟','公达','仲豫','伯宁','文若','仲达','子元','子上','仲将','伯仁','长文','仲达','季常','伯常','仲权','伯舆','季弼','子文','子建','子桓','苍舒','彭祖','元逊','伯言','幼节','承渊','德谋','公覆','义公','大虎','小虎','永年','孔休','孝裕','南和','子远','仲儁','公纪','仲翔','弘嗣','承明','伟章','永思','孔休','孝裕','南和','子远','仲儁','公纪','仲翔','弘嗣','承明','伟章','永思'];
  function randName(){
    var s=CR_SURNAMES[(Math.random()*CR_SURNAMES.length)|0];
    if(Math.random()<0.35 && CR_GIVEN2.length){
      return s+CR_GIVEN2[(Math.random()*CR_GIVEN2.length)|0];
    }
    var g=CR_GIVEN1[(Math.random()*CR_GIVEN1.length)|0];
    if(Math.random()<0.3) g+=CR_GIVEN1[(Math.random()*CR_GIVEN1.length)|0];
    return s+g;
  }
  function renderCreateHTML(){
    if(!getCreateState()) initCreateState();
    var R=G.ATTR_RATIO;
    var attrRows=ATTR_DEFS.map(function(a){
      var v=getCreateState().attr[a.k];
      var disMin=(v<=ATTR_MIN), disMax=(v>=ATTR_MAX || getCreateState().pool<=0);
      return '<div class="ap-row">'+
        '<div class="ap-name">'+a.n+'<i>'+a.t+'</i></div>'+
        '<div class="ap-ctrl">'+
          '<button class="ap-btn" data-act="dec" data-k="'+a.k+'"'+(disMin?' disabled':'')+'>−</button>'+
          '<b class="ap-val">'+v+'</b>'+
          '<button class="ap-btn" data-act="inc" data-k="'+a.k+'"'+(disMax?' disabled':'')+'>＋</button>'+
        '</div></div>';
    }).join('');
    return '<div class="cr-head">'+
        '<span class="cr-head-line"></span>'+
        '<h3 class="cr-title">新 建 人 物</h3>'+
        '<span class="cr-head-line"></span>'+
      '</div>'+
      '<div class="cr-field"><label>姓 名</label><input id="cr-name" class="cr-input" maxlength="8" placeholder="无名客"><button class="cr-rand" id="cr-rand" title="随机取名">🎲</button></div>'+
      '<div class="cr-sec">'+
        '<div class="cr-sec-t">四 维 赋 点<span class="cr-pool">余 <b id="cr-pool">'+getCreateState().pool+'</b> 点</span></div>'+
        '<div class="ap-list">'+attrRows+'</div>'+
      '</div>'+
      '<label class="cr-skip"><input type="checkbox" id="cr-skip"> 跳过新手教程（测试用）</label>'+
      '<div class="cr-actions"><button class="cr-go" id="cr-go">踏 入 江 湖</button></div>';
  }
  // 仅更新加点数值/按钮/战力，避免每次点击整体重建弹窗（手机卡顿根因）
  // 四维定义映射（避免每次 updateCreateUI 都 filter 遍历）
  var ATTR_DEF_MAP={}; ATTR_DEFS.forEach(function(a){ ATTR_DEF_MAP[a.k]=a; });
  function updateCreateUI(){
    var poolEl=document.getElementById('cr-pool'); if(poolEl) poolEl.textContent=getCreateState().pool;
    getCard().querySelectorAll('.ap-row').forEach(function(row){
      var incBtn=row.querySelector('[data-act="inc"]');
      var k=incBtn? incBtn.getAttribute('data-k'):null; if(!k) return;
      var v=getCreateState().attr[k];
      var valEl=row.querySelector('.ap-val'); if(valEl) valEl.textContent=v;
      var def=ATTR_DEF_MAP[k];
      var iEl=row.querySelector('.ap-name i'); if(iEl && def) iEl.textContent=def.t;
      if(incBtn) incBtn.disabled=(v>=ATTR_MAX || getCreateState().pool<=0);
      var decBtn=row.querySelector('[data-act="dec"]'); if(decBtn) decBtn.disabled=(v<=ATTR_MIN);
    });
  }
  function bindCreate(){
    var nameEl=document.getElementById('cr-name');
    if(nameEl){ nameEl.value=getCreateState().name||''; nameEl.oninput=function(){ getCreateState().name=nameEl.value; }; }
    // 随机取名按钮（v20260908k）
    var randBtn=document.getElementById('cr-rand');
    if(randBtn){ randBtn.onclick=function(){ var n=randName(); getCreateState().name=n; if(nameEl) nameEl.value=n; }; }
    var createTimer=null;
    getCard().querySelectorAll('.ap-btn').forEach(function(b){
      b.onclick=function(){
        var k=b.getAttribute('data-k'), act=b.getAttribute('data-act');
        if(act==='inc'){ if(getCreateState().pool>0 && getCreateState().attr[k]<ATTR_MAX){ getCreateState().attr[k]++; getCreateState().pool--; } }
        else { if(getCreateState().attr[k]>ATTR_MIN){ getCreateState().attr[k]--; getCreateState().pool++; } }
        // 加点动画反馈：给当前行数值加 pop 动画（v20260908k）
        var row=b.closest('.ap-row');
        if(row){ var valEl=row.querySelector('.ap-val'); if(valEl){ valEl.classList.remove('ap-val-pop'); void valEl.offsetWidth; valEl.classList.add('ap-val-pop'); } }
        // setTimeout 合并：连点时只重绘一次（setTimeout 后台也能执行，比 rAF 可靠；v20260908g）
        if(createTimer) clearTimeout(createTimer);
        createTimer=setTimeout(function(){ updateCreateUI(); createTimer=null; }, 0);
      };
    });
    var skipEl=document.getElementById('cr-skip');
    if(skipEl){ skipEl.checked=!!getCreateState().skip; skipEl.onchange=function(){ getCreateState().skip=!!skipEl.checked; }; }
    var go=document.getElementById('cr-go'); if(go) go.onclick=confirmCreate;
  }
  function attrAllocHTML(){
    if(!getState().attr) getState().attr={hp:5,atk:5,def:5,spd:5};
    var R=G.ATTR_RATIO, fp=(getState().freePoints||0);
    return ATTR_DEFS.map(function(a){
      var v=getState().attr[a.k];
      var disMax=(fp<=0);   // 游戏内加点无上限（v20260907f），仅受自由点约束；捏人面板仍限 1–20
      return '<div class="ap-row">'+
        '<span class="ap-name">'+a.n+'<i>'+a.t+'</i></span>'+
        '<div class="ap-ctrl">'+
          '<b class="ap-val">'+v+'</b>'+
          '<button class="ap-btn" data-act="attr-inc" data-k="'+a.k+'"'+(disMax?' disabled':'')+'>＋</button>'+
        '</div></div>';
    }).join('')+
    '<div class="ap-foot">可分配自由点：<b>'+(getState().freePoints||0)+'</b>（未分配的点保留，可随时再开面板加点）</div>'+
    '<button class="ap-confirm" data-act="attr-confirm">确认</button>';
  }
  function confirmAttr(){
    G.recalcBase(getState()); clampHp();
    if(typeof save==='function') save(getState());
    getState().pendingLevel=false;
    closeModal(); renderStatus();
    if((getState().freePoints||0)>0) toast('加点已保存，尚有 '+(getState().freePoints||0)+' 点未分配，可再开面板加点');
    else toast('加点已保存');
  }
  /** 游戏内属性分配：仅刷新数值/自由点/禁用态，不重建弹窗（手机连点不卡） */
  function updateAttrAllocUI(){
    if(!getCard()) return;
    var R=G.ATTR_RATIO, fp=(getState().freePoints||0);
    getCard().querySelectorAll('.ap-row').forEach(function(row){
      var incBtn=row.querySelector('[data-act="attr-inc"]');
      var k=incBtn?incBtn.getAttribute('data-k'):null; if(!k) return;
      var v=getState().attr[k];
      var valEl=row.querySelector('.ap-val'); if(valEl) valEl.textContent=v;
      if(incBtn) incBtn.disabled=(fp<=0);
    });
    var fpEl=getCard().querySelector('.ap-foot b'); if(fpEl) fpEl.textContent=fp;
  }
  function bindAttrAlloc(){
    if(!getCard()) return;
    var statusTimer=null;
    getCard().querySelectorAll('[data-act="attr-inc"]').forEach(function(b){
      b.onclick=function(){
        var k=b.getAttribute('data-k');
        if((getState().freePoints||0)>0){
          getState().attr[k]++; getState().freePoints=(getState().freePoints||0)-1;
          G.recalcBase(getState()); clampHp();
          updateAttrAllocUI();
          // 状态栏用 setTimeout 合并，连点时只重绘一次（setTimeout 后台也能执行；v20260908g）
          if(statusTimer) clearTimeout(statusTimer);
          statusTimer=setTimeout(function(){ renderStatus(); statusTimer=null; }, 0);
        }
      };
    });
    var cf=getCard().querySelector('[data-act="attr-confirm"]');
    if(cf) cf.onclick=confirmAttr;
  }
  function confirmCreate(){
    var name=(getCreateState().name||'').trim()||'无名客';
    var attr={}; ATTR_DEFS.forEach(function(a){ attr[a.k]=getCreateState().attr[a.k]; });
    var save=G.defaultSave();
    save.name=name;
    save.attr=attr;          // 四维（含分配后的数值）
    save.freePoints=getCreateState().pool;   // 捏人未分配完的点转为入局后自由属性点，避免白丢
    save.origin=null;
    // 跳过新手教程（测试用）：直接抵达洛阳（朱雀大街），并标记教学已完成、补发一包金疮药；
    // 同时打通主线门控（力斩华雄 + 洛阳凯旋）以避免被卡门。
    if(getCreateState().skip){
      save.room='luoyang';
      save.spawnRoom='luoyang';
      save.quest=save.quest||{};
      save.quest.hua_xiong=true;
      save.quest.luoyang=true;
      save.flags=save.flags||{};
      // 注意：tcTutorial 必须为 false（且 tcDone 为 true），否则 tutCombatActive() 会走旧的半手动战斗分支（已废弃），绕开 DQ 团体战斗
      save.flags.onb={ started:true, done:true, named:true, tcDone:true, tcTutorial:false, packGiven:true,
        personality:null, favor:0, reveal:['status','loctab','actions','npc','lower','dock'], talked:{},
        tcTried:{atk:true,def:true}, tcUsedItem:true, tcMsgs:{attack:true,defend:true,pack:true,use:true,finish:true} };
      save.items=save.items||[];
      if(!save.items.some(function(it){ return it.id==='jinchuang'; })) save.items.push({id:'jinchuang',name:'金疮药',count:2,cat:'药剂',effect:{hp:120}});
    }
    // 初始同伴：随行的「周仓」（演示队伍作战；每场战斗满血入场，见 startCombat）
    save.party=[{
      id:'zhoucang', name:'周仓',
      hp:170, maxHp:170, mp:24, maxMp:24,
      atk:17, def:10, spd:16,
      element:'金',
      learnedMartial:['beng_quan'],
      realm:{}, equippedForce:[],
      critRate:0.04, hitRate:0.92
    }];
    pendingSave=save;
    // 落笔入世 → 直接踏入江湖，进入第一段开场引导剧情（不再弹序幕框）
    var tt=document.getElementById('title'); if(tt) tt.classList.add('hidden');
    enterGame(pendingSave, pendingSlot); closeModal();
    pendingSave=null;
  }

    return {
      initCreateState: initCreateState, beginCreate: beginCreate, randName: randName, renderCreateHTML: renderCreateHTML, updateCreateUI: updateCreateUI, bindCreate: bindCreate, attrAllocHTML: attrAllocHTML, confirmAttr: confirmAttr, updateAttrAllocUI: updateAttrAllocUI, bindAttrAlloc: bindAttrAlloc, confirmCreate: confirmCreate
    };
  };
})(typeof window !== 'undefined' ? window : global);

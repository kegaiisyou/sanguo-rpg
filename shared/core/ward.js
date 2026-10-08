// 坊制 / 房产 / 牙行系统（v20261008d 从 engine.js 拆出）
//  - 原块位于 engine.js 末尾（坊制 ward 子房间 / 官署 / 摆渡 / 民居家具 / 牙行 / 店铺装修），
//    约 567 行、35 个函数，与战斗、叙事、时间推进等中枢无耦合，故整体外移。
//  - 范式同既有模块：LF.createWard(ctx) 工厂 + 引擎顶部别名块接管。
//  - ⚠️ 关键：engine.js 内 state 是 IIFE 闭包变量（engine.js:8 `var state = Core.state`），
//    且 window.state 并不存在 —— 故本模块【必须】经 ctx.getState 惰性取值（写作 S()），
//    读档/新局会重赋值 state，直接捕获引用会拿到旧存档对象。
window.LF = window.LF || {};
(function () {
  LF.createWard = function (ctx) {
    var getState = ctx.getState;
    function S() { return getState(); }
    var getCurrentModalOpts = ctx.getCurrentModalOpts;
    function CMO() { return getCurrentModalOpts(); }
    var G = ctx.G || (window.LF && window.LF.Core && window.LF.Core.G) || window.LF;
    var LF = ctx.LF || window.LF;
    var Officers = ctx.Officers, NPC = ctx.NPC, CELL_INTERIORS = ctx.CELL_INTERIORS;
    var toast = ctx.toast, save = ctx.save, log = ctx.log;
    var openModal = ctx.openModal, closeModal = ctx.closeModal, renderRoom = ctx.renderRoom;
    var handleAction = ctx.handleAction, exert = ctx.exert, advanceMinutes = ctx.advanceMinutes;
    var afterPackChange = ctx.afterPackChange, packAdd = ctx.packAdd, packFind = ctx.packFind;
    var itemIconHTML = ctx.itemIconHTML, row = ctx.row;
    var genCityGrid = ctx.genCityGrid, availableGateDirs = ctx.availableGateDirs;
    // 跨模块裸名调用（city.js / field.js），非 window 全局，必须注入
    var registerCityRooms = ctx.registerCityRooms, isOnBoat = ctx.isOnBoat, setOnBoat = ctx.setOnBoat;
  // ── 坊制系统（v20260927）：每个 ward 城格展开多间子房间，点门牌入内、子房间南向出口回城格 ──
  function officersInCity(cid) {
    var list = [];
    if (typeof Officers !== 'undefined' && Officers.garrisonOf) list = Officers.garrisonOf(cid) || [];
    if ((!list || !list.length) && typeof S() !== 'undefined' && S().officers) list = S().officers.filter(function (o) { return o && (o.home === cid || o.city === cid || (o.garrison && o.garrison === cid)); });
    return list || [];
  }
  function wardSubId(cid, x, y, k) { return 'ward_' + cid + '_' + x + '_' + y + '_' + k; }
  function buildWardCell(cid, x, y, t) {
    var WARD = LF.WARD_DEFS || {}, OFF = LF.OFFICE_SUBROOMS || [];
    var kind = ('' + t).slice('ward_'.length);
    var def = WARD[kind]; if (!def) return;
    var subs = [];
    if (def.subGen === 'offices') {
      OFF.forEach(function (o) { subs.push({ k: o.key, gid: o.key, name: o.name, desc: [o.name + (o.note ? ('：' + o.note) : '')], icon: o.icon || '🏛', group: '官署' }); });
      var _dyn = (S().flags.cityWards && S().flags.cityWards[cid]) || [];   // 已拜官而动态生成的府衙（如都督府）
      _dyn.forEach(function (key) {
        var o = (LF.OFFICE_DYN && LF.OFFICE_DYN[key]) || null;
        if (o) subs.push({ k: 'off_' + key, gid: key, name: o.name, desc: [o.name + (o.note ? ('：' + o.note) : '')], icon: o.icon || '🏛', group: '官署', officeKey: key });
      });
    } else if (def.subGen === 'mansions') {
      var gens = officersInCity(cid).slice(0, def.capacity || 6);
      if (!gens.length) subs.push({ k: 'empty', name: '空置宅邸', desc: ['此坊尚无人居，院落寂然。'], icon: '🏠', group: '宅邸' });
      gens.forEach(function (g) {
        var honor = (g.gender === 'f') ? '宅' : '府';
        subs.push({ k: g.id, gid: g.id, name: (g.name || '某人') + honor, desc: [(g.name || '某') + '之' + honor + '。' + (g.title ? ('现任' + g.title + '。') : '')], icon: '🏠', group: '宅邸' });
      });
    } else if (def.subGen === 'generals') {
      var amap = (typeof S() !== 'undefined' && S().armies) || {};
      officersInCity(cid).forEach(function (g) {
        var has = amap[g.id] && amap[g.id].active;
        subs.push({ k: 'a_' + g.id, gid: g.id, name: (g.name || '某') + '府(军)', desc: [(g.name || '某') + '的军府，本队驻此。' + (has ? '旗下将士听调。' : '尚无常备部曲。')], icon: '⚔', group: '军府' });
      });
      if (!subs.length) subs.push({ k: 'empty', name: '空置军府', desc: ['军坊暂驻，将旗未立。'], icon: '⚔', group: '军府' });
    } else if (def.subGen === 'shops') {
      [['qianzhuang', '钱庄'], ['buzhuang', '布庄'], ['jiulou', '酒楼'], ['tiejiang', '铁匠铺'], ['yaofu', '药铺']].slice(0, def.capacity || 5).forEach(function (s) { subs.push({ k: s[0], name: s[1], desc: ['市坊之内，' + s[1] + '生意兴隆。'], icon: '🛒', group: '商铺' }); });
    } else if (def.subGen === 'schools') {
      subs.push({ k: 'xuegong', name: '学宫', desc: ['弦歌之声不绝，士子诵经。'], icon: '📚', group: '文教' });
      subs.push({ k: 'siguan', name: '寺观', desc: ['香火缭绕，道徒诵经。'], icon: '⛩', group: '文教' });
    } else if (def.subGen === 'docks') {
      subs.push({ k: 'matou', name: '码头', desc: ['舟楫往来，商货云集。'], icon: '⚓', group: '水运' });
      subs.push({ k: 'chuanwu', name: '船坞', desc: ['匠人修造楼船。'], icon: '🛠', group: '水运' });
    }
    subs.forEach(function (s) {
      var id = wardSubId(cid, x, y, s.k);
      var act = { id: 'ward_view', label: wardViewLabel(def.subGen, s), tip: '于' + s.name + '处置事', kind: def.subGen, nm: s.name, gid: (s.gid || null), cid: cid, x: x, y: y, officeKey: (s.officeKey || null) };
      G.ROOMS[id] = { id: id, name: s.name, desc: (s.desc && s.desc.length ? s.desc : ['']), find: '', exits: { '南': '__cell__:' + cid + ':' + x + ':' + y }, npcs: [], items: [], actions: [act], _ward: true };
    });
    var doors = subs.map(function (s) { return { label: s.name, icon: s.icon, target: wardSubId(cid, x, y, s.k), group: s.group }; });
    CELL_INTERIORS[cid + '|' + x + ',' + y] = { doors: doors };
  }
  function wardViewLabel(subGen, s) {
    if (subGen === 'mansions' || subGen === 'generals') return '拜会';
    if (subGen === 'offices') return '问政';
    if (subGen === 'shops') return '交易';
    if (subGen === 'schools') return '求学';
    if (subGen === 'docks') return '问渡';
    return '查看';
  }
  var WARD_OFFICE_DESC = { shangshu:'总揽政务、章奏出纳', yushitai:'监察百官、弹劾不法', tingwei:'刑狱讼狱、典掌律令', dahonglu:'掌诸侯宾客、郊庙礼仪', guangluxun:'守卫宫禁、宿卫侍从', dachang:'宗庙礼仪、掌管祭祀', dasinong:'田租赋税、国库钱谷', shaofu:'皇室私奉、工巧造作', weiwei:'宫门屯卫、徼巡京师', taipu:'舆马牲畜、厩苑牧养', zongzheng:'宗室亲疏、皇族属籍', dajiangjun:'总领戎政、节制诸军' };
  function findOfficer(id) {
    if (typeof Officers !== 'undefined') {
      if (Officers.get) { var g = Officers.get(id); if (g) return g; }
      if (Officers.find) { var g2 = Officers.find(id); if (g2) return g2; }
    }
    var R = (typeof S() !== 'undefined' && S().officers) || [];
    for (var i = 0; i < R.length; i++) if (R[i] && R[i].id === id) return R[i];
    return null;
  }
  function wardViewInfo(a) {
    if (!a) return null;
    var k = a.kind, nm = a.nm, gid = a.gid;
    if (k === 'offices') {
      var _info = ((LF.OFFICE_DESC && LF.OFFICE_DESC[gid]) || WARD_OFFICE_DESC[gid] || '此处处理相关政务。');
      var _holder = (S().flags.centralOffice && S().flags.centralOffice[gid]);
      var _line = nm + '：' + _info;
      if (_holder) { var _h = findOfficer(_holder); _line += '（现任：' + (_h ? (_h.name || _holder) : _holder) + '）'; }
      var _eff = (LF.OFFICE_EFFECT && LF.OFFICE_EFFECT[gid]);
      if (_eff && _eff.desc) _line += ' ' + _eff.desc;
      return _line;
    }
    if (k === 'mansions' || k === 'generals') {
      var g = gid ? findOfficer(gid) : null;
      if (!g) return nm + '：门庭寂然，主人不在。';
      var line = nm + '：' + (g.title ? (g.title + '，') : '') + (g.name || '?');
      if (g.gender === 'f') line += '，女中英杰';
      line += '。威望' + (g.lead != null ? g.lead : '—') + '，武艺' + (g.war != null ? g.war : '—') + '，智略' + (g.int != null ? g.int : '—') + '。';
      if (k === 'generals') { var am = (typeof S() !== 'undefined' && S().armies) ? S().armies[gid] : null; line += (am && am.active) ? ' 本队驻此，将士听调。' : ' 尚无常备部曲。'; }
      return line;
    }
    if (k === 'shops') return nm + '：商贾云集，百货辐辏，可入内交易。';
    if (k === 'schools') return nm + '：弦歌不绝，可求学问道、积攒修为。';
    if (k === 'docks') return nm + '：舟楫往来，可问渡水运、修造扁舟。';
    return nm + '。';
  }

  // ── 坊内三用（v20260927e）：市坊交易 / 文教求学 / 码头问渡 ──
  //  gid 即 buildWardCell 里 subs[].k（qianzhuang/buzhuang/jiulou/tiejiang/yaofu、
  //  xuegong/siguan、matou/chuanwu），据此分派到具体行为。
  var WARD_SHOP_IDS = { qianzhuang:'bank', buzhuang:'cloth', jiulou:'tavern', tiejiang:'blacksmith', yaofu:'doctor' };
  var wardPanel = null;      // 当前坊面板上下文（求学/问渡共用，仅会话内）
  var BOAT_FARE = 12;        // 渡资（与 field.js 的 BOAT_FEE 同价）
  var ZHOU_COST = 80;        // 船坞打造扁舟耗银

  function wardStudyOpts(a){
    if (a && a.gid === 'xuegong') return [
      { m:'read',     label:'研读典籍', min:120, note:'修为 +4'  },
      { m:'debate',   label:'辩经问难', min:90,  note:'声望 +2'  }
    ];
    return [
      { m:'meditate', label:'静修问对', min:90, note:'修为 +3'  },
      { m:'pray',     label:'焚香祈福', min:60, note:'精力 +12' }
    ];
  }
  function wardStudyFind(a, m){
    var r = null; wardStudyOpts(a).forEach(function(o){ if (o.m === m) r = o; }); return r;
  }

  function renderWardStudy(opts){
    var a = opts || wardPanel || {};
    wardPanel = a;
    var isX = a.gid === 'xuegong';
    var pot = (S() && S().pot) || 0;
    var rep = (S() && S().reputation) || 0;
    var ops = wardStudyOpts(a);
    var h = '<div class="ward-panel">'+
      '<h3 class="ward-h">' + (isX ? '📚 学宫 · 求学' : '⛩ 寺观 · 求学') + '</h3>'+
      '<p class="tip">' + (isX ? '竹简罗列，经义在前，可披卷穷究，亦可与同窗辩难。' : '香烟缭绕，钟磬清心，可静修问对，亦可焚香默祷。') + '</p>'+
      '<div class="ward-row"><span>当前修为</span><b>' + pot + '</b></div>'+
      '<div class="ward-row"><span>当前声望</span><b>' + rep + '</b></div>'+
      '<div class="ward-routes">'+
      ops.map(function(o){
        return '<div class="ward-route"><span>' + o.label + '</span><span class="wr-li">' + (o.min / 60).toFixed(1) + ' 时辰 · ' + o.note + '</span></div>';
      }).join('')+
      '</div>'+
      '<div class="ward-acts">'+
      ops.map(function(o){
        return '<button class="btn ward-btn" id="ward-study-' + o.m + '" data-mode="' + o.m + '">' + o.label + '</button>';
      }).join('')+
      '</div>'+
      '<p class="tip">修为日积月累，可在门派处换取传功与进境。</p>'+
    '</div>';
    return h;
  }
  function bindWardStudy(){
    var card = document.getElementById('modal-card'); if (!card) return;
    var bs = card.querySelectorAll('[id^="ward-study-"]');
    for (var i = 0; i < bs.length; i++) {
      (function(el){ el.onclick = function(){ wardStudyDo(el.getAttribute('data-mode')); }; })(bs[i]);
    }
  }
  function wardStudyDo(mode){
    var a = wardPanel || {};
    var op = wardStudyFind(a, mode);
    if (!op) return;
    if (mode === 'pray') {
      advanceMinutes(op.min);
      var mx = (S().maxEnergy || 100), b0 = (S().energy || 0);
      var add = Math.min(12, Math.max(0, mx - b0));
      S().energy = Math.min(mx, b0 + 12);
      log('你于寺观焚香默祷，神气稍复，精力 +' + add + '。', 'good');
      toast('精力 +' + add);
    } else {
      if (!exert(op.label)) return;
      S().energy = Math.max(0, (S().energy || 0) - 2);
      advanceMinutes(op.min);
      if (mode === 'debate') {
        S().reputation = (S().reputation || 0) + 2;
        log('你与同窗辩经问难，语惊四座，声望 +2。', 'good');
        toast('声望 +2');
      } else {
        var g = (mode === 'read') ? 4 : 3;
        S().pot = (S().pot || 0) + g;
        log((mode === 'read' ? '你于学宫披卷苦读，经义渐明' : '你于寺观静修问对，心神澄澈') + '，修为 +' + g + '。', 'good');
        toast('修为 +' + g);
      }
    }
    try { save(S()); } catch(e){}
    closeModal();
  }

  // 问渡：码头可登舟/上岸，船坞可督造扁舟（此后渡水免渡资）
  function wardHasZhou(){ return !!packFind('zhou'); }
  // 通达水路：LF.ROADS 邻接中 type==='water'，或邻地本身是港城/水寨
  function wardWaterRoutes(cid){
    var out = [];
    var adjT = (LF.ROADS && LF.ROADS.adj) || {};
    var nb = adjT[cid] || [];
    for (var i = 0; i < nb.length; i++) {
      var e = nb[i]; if (!e) continue;
      var tgt = e.to, ed = e.edge || {};
      var city = (LF.CITIES && LF.CITIES[tgt]) || null;
      var pl = (LF.PLACES && LF.PLACES[tgt]) || null;
      var isW = (ed.type === 'water') || (city && (city.ctype === 'port' || city.ctype === 'shuizhai'));
      if (!isW) continue;
      var nm = (city && city.name) || (pl && pl.name) || tgt;
      out.push({ id: tgt, name: nm, li: e.li || 0 });
    }
    out.sort(function(x, y){ return x.li - y.li; });
    return out;
  }
  function renderWardFerry(opts){
    var a = opts || wardPanel || {};
    wardPanel = a;
    var isDock = a.gid === 'matou';
    var onBoat = !!(S() && S().flags && S().flags.onBoat);
    var h = '<div class="ward-panel">'+
      '<h3 class="ward-h">' + (isDock ? '⚓ 码头 · 问渡' : '🛠 船坞 · 问渡') + '</h3>';
    if (isDock) {
      h += '<p class="tip">' + (onBoat ? '你已在舟中，向岸边行去即可上岸。' : '舟楫往来，商货云集——乘船须先登舟。') + '</p>'+
        '<div class="ward-row"><span>渡资</span><b>' + BOAT_FARE + ' 两' + (wardHasZhou() ? '（持扁舟免渡资）' : '') + '</b></div>'+
        '<div class="ward-row"><span>行囊扁舟</span><b>' + (wardHasZhou() ? '有' : '无') + '</b></div>'+
        '<div class="ward-acts">'+
          (onBoat ? '<button class="btn ward-btn" id="ward-ferry-ashore">上岸</button>'
                  : '<button class="btn ward-btn" id="ward-ferry-board">登舟渡江</button>')+
        '</div>';
      var rt = wardWaterRoutes(a.cid || (S() && S().room));
      if (rt.length) {
        h += '<div class="ward-row"><span>通达水路</span><b>' + rt.length + ' 处</b></div>'+
          '<div class="ward-routes">' +
          rt.map(function(r){
            return '<div class="ward-route"><span>🚢 ' + r.name + '</span><span class="wr-li">' + r.li + ' 里</span></div>';
          }).join('') +
          '</div>';
      } else {
        h += '<div class="ward-empty">此处暂无通达水路，须循陆路而行。</div>';
      }
    } else {
      h += '<p class="tip">匠人修造楼船。可就地督造一只扁舟，渡水之便从此随身。</p>'+
        '<div class="ward-row"><span>打造耗银</span><b>' + ZHOU_COST + ' 两</b></div>'+
        '<div class="ward-row"><span>行囊扁舟</span><b>' + (wardHasZhou() ? '已有' : '无') + '</b></div>'+
        '<div class="ward-acts">'+
          '<button class="btn ward-btn" id="ward-ferry-build"' + (wardHasZhou() ? ' disabled' : '') + '>' + (wardHasZhou() ? '扁舟尚在' : '打造扁舟') + '</button>'+
        '</div>';
    }
    h += '<p class="tip">水路须乘舟方可通行；抵达陆地会自动上岸。</p>'+
      '</div>';
    return h;
  }
  function bindWardFerry(){
    var bb = document.getElementById('ward-ferry-board');
    if (bb) bb.onclick = function(){ wardFerryBoard(); };
    var ba = document.getElementById('ward-ferry-ashore');
    if (ba) ba.onclick = function(){ setOnBoat(false); log('你拢舟靠岸，踏回实地。', 'sys'); closeModal(); };
    var bz = document.getElementById('ward-ferry-build');
    if (bz) bz.onclick = function(){ wardFerryBuild(); };
  }
  function wardFerryBoard(){
    if (typeof isOnBoat === 'function' && isOnBoat()) { toast('你已在舟中。'); closeModal(); return; }
    if (wardHasZhou()) { setOnBoat(true); log('你解缆登舟，扁舟轻荡，准备渡江。', 'good'); closeModal(); return; }
    if (((S() && S().gold) || 0) >= BOAT_FARE) {
      S().gold -= BOAT_FARE; setOnBoat(true);
      log('你付了渡资 ' + BOAT_FARE + ' 银，登上渡船，船夫撑篙离岸。', 'good');
      closeModal(); return;
    }
    setOnBoat(true);
    log('渡口无舟可雇，你寻得一只无主小筏，亲自撑篙渡江。', 'sys');
    closeModal();
  }
  function wardFerryBuild(){
    if (wardHasZhou()) { toast('行囊中已有扁舟。'); closeModal(); return; }
    if (((S() && S().gold) || 0) < ZHOU_COST) { toast('打造扁舟需 ' + ZHOU_COST + ' 两，你银两不足。'); return; }
    if (!exert('督造扁舟')) return;
    S().gold -= ZHOU_COST;
    S().energy = Math.max(0, (S().energy || 0) - 2);
    packAdd('zhou', 1); afterPackChange();
    log('你付银督造，匠人钉合木料，一只扁舟下水——此后渡水可免渡资。', 'good');
    toast('得扁舟 ×1');
    try { save(S()); } catch(e){}
    closeModal();
  }

  window.buildWardCell = buildWardCell;   // 跨工厂闭包桥接：city.js(genCityGrid) 在生成网格后调用，那时 S() 已就绪

  // ── 城市房间由 cities.js 程序合成（rooms.js 不再手写）；山河志州治节点由 cities.js+coords 自动派生 ──
  registerCityRooms();


  // ── 统一按压反馈（P1）：手机端点击震动 + 全局按压态。
  //  按钮类（button/.btn/.act/.op-btn）按下时轻震 8ms；滑块/输入框不触发。
  //  已有零散 :active 缩放保留，这里只补「无感→有感」的触觉层。
  document.addEventListener('pointerdown', function(e){
    try {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      var t = e.target;
      if (!t || !t.closest) return;
      var hit = t.closest('button, .btn, .act, .op-btn, .mv-tab, .mv-exit, .sheet-btn, .obj-goto, .sect-open, .mart-chip');
      if (!hit) return;
      if (hit.disabled || hit.classList.contains('disabled')) return;
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
    } catch (err) {}
  }, true);

  // ── 行军系统：按路网在相邻地点间生成「郊野」骨架，再连出入口（须先有 genCityGrid 等游戏函数）──
  if(LF.Travel){
    LF.Travel.setGateDirs(availableGateDirs);
    LF.Travel.build();
  }

  // ── 统一地点房间生成（Place 系统）：城市以外类型(fort/pass/landmark/dungeon/story/field...)由 gen/rooms.js 造房注入 G.ROOMS ──
  function registerPlaceRooms(){
    var P = LF.PLACES || {};
    for(var pid in P){
      var p = P[pid];
      if(!p || p.kind==='city') continue;          // 城市已由 registerCityRooms 处理
      if(G.ROOMS[pid]) continue;                    // 已有手写/生成则跳过
      var rooms = (LF.genPlaceRooms ? LF.genPlaceRooms(pid) : null) || {};
      for(var rid in rooms){ if(!G.ROOMS[rid]) G.ROOMS[rid] = rooms[rid]; }
      // 副本入口：在 entry 地点房挂一条北向出口，连通地表↔秘谷
      if(p.kind==='dungeon' && p.entry && G.ROOMS[p.entry]){
        var er = G.ROOMS[p.entry]; if(!er.exits) er.exits = {};
        if(!er.exits['北']) er.exits['北'] = pid + '@entrance';
      }
    }
  }
  registerPlaceRooms();
  if(LF.Travel) LF.Travel.link();   // 郊野网格造好后，连 近边入口↔母城 / 远边出口↔邻点

  // ══ 房产/家园系统（v20260928h）：牙行购契 → 对应城民居落「宅院」→ 进宅布置家具 ══
  var HOUSE_CITY_NAMES = {
    luoyang:'洛阳', changan:'长安', yecheng:'邺城', chengdu:'成都', jianye:'建业',
    xiangyang:'襄阳', wuchang:'武昌', puyang:'濮阳', changsha:'长沙', linzi:'临淄'
  };
  var HOUSE_GRID_W = 4, HOUSE_GRID_H = 3;   // 摆件 4×3 格
  function houseFurnState(cid){
    var F=S().flags; if(!F.houses) F.houses={};
    if(!F.houses[cid]) F.houses[cid]={furn:{}};
    if(!F.houses[cid].furn) F.houses[cid].furn={};
    return F.houses[cid].furn;
  }
  // 房契 defId → 城市 id；非房契返回 null
  function houseCidOf(fangqiId){
    var m=(fangqiId||'').match(/^fangqi_(.+)$/); if(!m) return null;
    return HOUSE_CITY_NAMES[m[1]] ? m[1] : null;
  }
  // 购买/持有房契时登记（shop.js 结算钩子调用）
  function registerHouse(fangqiId){
    var cid=houseCidOf(fangqiId); if(!cid) return false;
    var F=S().flags; if(!F.houses) F.houses={};
    if(F.houses[cid]){ toast('「'+HOUSE_CITY_NAMES[cid]+'」宅邸你已持有。'); return false; }
    F.houses[cid]={furn:{}};
    if(typeof save==='function') save(S());
    toast('凭契立户——你在'+HOUSE_CITY_NAMES[cid]+'安了家，往该城民居可入宅院。','good');
    return true;
  }
  // 进宅：动态生成宅院房间并切入
  function enterHouse(cid){
    if(!(S().flags.houses||{})[cid]){ toast('此处并无你的宅邸。'); return; }
    var rid='__house_'+cid;
    ensureHouseRoom(cid, rid);
    renderRoom(rid);
  }
  function houseFurnListHTML(cid){
    var furn=houseFurnState(cid), keys=Object.keys(furn), L=LF.ITEMS||LF.SharedGame;
    var out=[];
    keys.forEach(function(k){ var d=L.DEFS[furn[k]]; if(d) out.push(d.name); });
    return out.length?('堂中摆着：'+out.join('、')+'。'):'堂屋空落落，尚待布置。';
  }
  function ensureHouseRoom(cid, rid){
    if(G.ROOMS[rid]) return;
    var nm=HOUSE_CITY_NAMES[cid]||cid;
    G.ROOMS[rid]={
      id: rid, name: nm+'宅院',
      desc: ['檐下匾额新挂「'+nm+'×宅」，院中青砖墁地。', houseFurnListHTML(cid)],
      find:'自家宅邸，进出自如。',
      exits: { '南': cid },      // 南位出宅回城（保留进城时的原格）
      npcs: [], items: [],
      objs: (function(){ var furn=houseFurnState(cid), objs=[]; for(var k in furn){ var d=(LF.ITEMS||{}).DEFS[furn[k]]; if(d) objs.push({name:d.name, icon:d.icon||'🪑', desc:'你布置的'+d.name+',摆放齐整。'}); } return objs; })(),
      actions: [
        { id:'house_furn', label:'布置家具', icon:'🪑', tip:'取出行囊中的家具，摆进堂屋卧房（4×3 格位）', data:{cid:cid} },
        { id:'house_rest', label:'宅中安歇', icon:'🛌', tip:'回自家卧房歇息，气血精神尽复', data:{cid:cid} }
      ],
      isHouse: true
    };
  }
  // 布置家具面板：左=4×3 格位（已摆显示图），右=背包可摆家具，点选放置/取下
  function bindHouseFurnPanel(){
    var box=$card, sel=null;
    box.querySelectorAll('.hf-bag').forEach(function(el){
      el.onclick=function(){
        var d=el.getAttribute('data-def'); if(!d) return;
        sel=d;
        box.querySelectorAll('.hf-bag').forEach(function(x){ x.classList.remove('sel'); });
        el.classList.add('sel');
        toast('已选「'+(((LF.ITEMS||{}).DEFS[d]||{}).name||d)+'」——点右侧格位摆放。','sys');
      };
    });
    box.querySelectorAll('.hf-cell').forEach(function(el){
      el.onclick=function(){
        var target=el.getAttribute('data-target');
        var cid=el.getAttribute('data-cid'), k=el.getAttribute('data-k');
        var def=el.getAttribute('data-def')||sel;
        if(target==='shop'){ housePlaceShop(def, cid, parseInt(el.getAttribute('data-x'),10), parseInt(el.getAttribute('data-y'),10), el.getAttribute('data-key'), k); }
        else housePlace(def, cid, k);
      };
    });
  }
  function renderHouseFurnPanel(){
    var opts=modalOptsFor('housefurn')||{};
    if(opts.target==='shop') return renderShopFurnPanel(opts);
    var cid=opts.cid||S().room; if(!HOUSE_CITY_NAMES[cid]) cid=null;
    if(!cid) return '<h3>布置家具</h3><p class="tip">此处并非你的宅院。</p>';
    var furn=houseFurnState(cid);
    var DEFS=(LF.ITEMS||{}).DEFS||{};
    // 左：格位
    var cells='';
    for(var y=0;y<HOUSE_GRID_H;y++){ for(var x=0;x<HOUSE_GRID_W;x++){
      var k=x+','+y, d=furn[k]?DEFS[furn[k]]:null;
      cells+='<div class="hf-cell'+(d?' filled':'')+'" data-cid="'+cid+'" data-k="'+k+'" data-def="'+(d?furn[k]:'')+'">'+
        (d?itemIconHTML(d,18):'<span class="hf-empty">空</span>')+'</div>';
    }}
    // 右：背包家具（点选进入待摆状态）
    var bag='';
    (S().pack||[]).forEach(function(it,i){
      if(!it) return; var d=DEFS[it.defId]; if(!d || d.cat!=='家具') return;
      bag+='<div class="hf-bag" data-pack="'+i+'" data-def="'+it.defId+'">'+itemIconHTML(d,16)+'<b>'+d.name+'</b><i>×'+(it.count||1)+'</i></div>';
    });
    if(!bag) bag='<p class="tip">行囊中暂无家具——可往市集杂货铺采买床、桌、椅、柜等。</p>';
    return '<h3>布置家具 · '+HOUSE_CITY_NAMES[cid]+'宅院</h3>'+
      '<div class="hf-wrap"><div class="hf-grid">'+cells+'</div><div class="hf-bagbox"><div class="hf-bag-t">背包家具（点选后点格位放置）</div>'+bag+'</div></div>'+
      '<p class="tip">点已摆格位可取下回囊；摆放齐整，宅院才像个家。</p>';
  }
  // ── 市集店铺：类 NPC 的交互列表（进入 / 盘下 / 自营管理）──

  function shopCellActs(d){
    d=d||{}; var cid=d.cid, x=d.x, y=d.y, key=d.key, sign=d.sign, bld=d.building;
    var acts=[
      {label:'进入', icon:'🚪', fn:function(){ handleAction('enter_building',{id:'enter_building',data:{building:bld, cid:cid, x:x, y:y, sign:sign}}); }},
      {label:'观察', icon:'👁', fn:function(){ observeShop(cid, x, y, key, sign); }}
    ];
    var sh=window.shopInst?window.shopInst(cid, x, y, key):null;
    if(sh && sh.owner==='player'){
      acts.push({label:'经营', icon:'📊', fn:function(){ openModal('shopinteract',{cid:cid, x:x, y:y, key:key, sign:sign, building:bld}); }});
    } else {
      acts.push({label:'盘下', icon:'🔖', fn:function(){ openModal('broker',{kind:'shop', cid:cid, x:x, y:y, key:key, sign:sign}); }});
    }
    return acts;
  }
  function observeShop(cid, x, y, key, sign){
    var t=window.shopTpl?window.shopTpl(key):null;
    var sh=window.shopInst?window.shopInst(cid, x, y, key):null;
    var nm=sign||(window.getBUILDINGS&&window.getBUILDINGS()[key]?getBUILDINGS()[key].name:key)||key;
    var parts=['〔'+nm+'〕'];
    if(t && t.trade && t.trade.sells){
      var ns=t.trade.sells.map(function(id){ var d=LF.ITEMS&&LF.ITEMS[id]; return (d&&d.name)||id; });
      parts.push('经营：'+ns.join('、'));
    }
    parts.push(sh && sh.owner==='player' ? '（已是你的铺子，点「经营」查账 / 上架 / 扩店 / 布置）' : '（可经牙行盘下此店，自营买卖、按月纳商税）');
    log(parts.join('；'), 'npc');
  }
  // ── 牙行 / 盘下：带标价·格局·陈设·周边配套的经纪面板 ──
  var SHOP_ROOMS = { yaofu:'前店后柜·两进', buzhuang:'前铺后坊·两进', shishi:'前堂后厨·两进', zahuo:'前店后库·一进', gongzao:'前铺后场·两进' };
  function renderBrokerPanel(opts){
    opts=opts||{};
    if(opts.kind==='house') return renderHouseBrokerPanel(opts);
    var cid=opts.cid, x=opts.x, y=opts.y, key=opts.key;
    var bd=(window.getBUILDINGS&&window.getBUILDINGS()[key])||{};
    var sign=opts.sign||bd.name||key;
    var sh=window.shopInst?window.shopInst(cid,x,y,key):null;
    if(sh&&sh.owner==='player'){ return '<h3>「'+sign+'」已是你的铺子</h3><p class="tip">回到市集点这间铺子的「交互」，可查账 / 作坊 / 上架 / 扩店 / 布置。</p>'; }
    var lvl=(sh&&sh.level)||1, base=200*lvl, withStaff=Math.round(base*1.75);
    var rooms=SHOP_ROOMS[key]||'前店后库·一进';
    var fit=(sh&&sh.fitment)?sh.fitment:['木床（歇脚）','货架（陈列）','作台（营生）'];
    var fitTxt=fit.map(function(f){return (typeof f==='string')?f:(f.item||f.name||'器物');}).join('、');
    var nb=[], size=((LF.CITIES||{})[cid]||{}).grid||9;
    for(var ny=0;ny<size;ny++){ for(var nx=0;nx<size;nx++){
      if(nx===x&&ny===y) continue;
      var inst=window.cityCellInst?window.cityCellInst(cid,nx,ny):null;
      if(inst&&inst.type){ var b=(window.getBUILDINGS&&window.getBUILDINGS()[inst.type]); if(b&&b.name&&nb.indexOf(b.name)<0) nb.push(b.name); }
    }}
    var nbTxt=nb.length?nb.slice(0,6).join('、'):'（街口寥寥）';
    return '<h3>盘下「'+sign+'」</h3>'
      + '<div class="bk-info">'
      + '<div><b>铺面</b>：'+bd.name+'（'+(bd.sub||'')+'）</div>'
      + '<div><b>格局</b>：'+rooms+'</div>'
      + '<div><b>现陈设</b>：'+fitTxt+'</div>'
      + '<div><b>周边配套</b>：'+nbTxt+'</div>'
      + '<div><b>等级</b>：'+lvl+'（扩店可升客流与货位）</div>'
      + '</div>'
      + '<p class="tip">盘下即自营：过客自来买货，月度结算纳商税；连人盘下留用原店主为伙计，他自会照看生意、按月支薪。</p>'
      + '<div class="sf-acts">'
      + '<button class="btn" data-broker="buy" data-cid="'+cid+'" data-x="'+x+'" data-y="'+y+'" data-key="'+key+'">盘下（不带人） '+base+' 两</button>'
      + '<button class="btn btn-ok" data-broker="staff" data-cid="'+cid+'" data-x="'+x+'" data-y="'+y+'" data-key="'+key+'">连人盘下 '+withStaff+' 两</button>'
      + '</div>';
  }
  function renderHouseBrokerPanel(opts){
    var rows='';
    for(var cid in HOUSE_CITY_NAMES){
      var nm=HOUSE_CITY_NAMES[cid];
      var rec=(LF.SHOPS.yahang.items.filter(function(it){return it.id==='fangqi_'+cid;})[0]||{});
      var price=rec.buy||90;
      var owned=(S().flags.houses||{})[cid];
      var tier=((LF.CITIES||{})[cid]||{}).tier; var tn=tier==='capital'?'都城·繁华':'州城·殷实';
      rows+='<div class="bk-house"><div><b>'+nm+'宅院</b>'+(owned?'（已置业）':'')+'</div>'
        + '<div class="bk-sub">格局：正房厢房·三进院落 ｜ 陈设：空（可布置床/桌/柜/字画）｜ 周边：'+tn+'</div>'
        + (owned?'<div class="tip">你已在此安家。</div>':'<button class="btn btn-ok" data-house-buy="'+cid+'">购契 '+price+' 两</button>')
        + '</div>';
    }
    return '<h3>置业顾问 · 各城宅院</h3><p class="tip">凭契可入对应城民居置业、布置家具、宅中安歇。先看格局与周边，再出手。</p>'+rows;
  }
  function bindBrokerPanel(){
    var box=$card;
    box.querySelectorAll('button[data-broker]').forEach(function(b){
      b.onclick=function(){
        var mode=b.getAttribute('data-broker');
        var d={cid:b.getAttribute('data-cid'),x:parseInt(b.getAttribute('data-x'),10),y:parseInt(b.getAttribute('data-y'),10),key:b.getAttribute('data-key')};
        closeModal();
        if(window.handleAction) window.handleAction(mode==='staff'?'buy_shop_staff':'buy_shop',{id:(mode==='staff'?'buy_shop_staff':'buy_shop'),data:d});
      };
    });
    box.querySelectorAll('button[data-house-buy]').forEach(function(b){
      b.onclick=function(){
        var cid=b.getAttribute('data-house-buy'); closeModal();
        packAdd('fangqi_'+cid,1);
        toast('已购入「'+HOUSE_CITY_NAMES[cid]+'」宅契，往该城民居可置业安居。','good');
        if(typeof save==='function') save(S());
      };
    });
  }
  // ── 店铺布置：复用宅院 4×3 格位，家具存于 sh.furniture ──
  function renderShopFurnPanel(opts){
    var cid=opts.cid,x=opts.x,y=opts.y,key=opts.key;
    var sh=window.shopInst?window.shopInst(cid,x,y,key):null; if(!sh) return '<h3>布置</h3><p class="tip">你尚未盘下此店。</p>';
    if(!sh.furniture||Array.isArray(sh.furniture)) sh.furniture={};
    var DEFS=(LF.ITEMS||{}).DEFS||{};
    var nm=(window.getBUILDINGS&&window.getBUILDINGS()[key])?window.getBUILDINGS()[key].name:key;
    var cells='';
    for(var gy=0;gy<HOUSE_GRID_H;gy++){ for(var gx=0;gx<HOUSE_GRID_W;gx++){
      var k=gx+','+gy, d=sh.furniture[k]?DEFS[sh.furniture[k]]:null;
      cells+='<div class="hf-cell'+(d?' filled':'')+'" data-target="shop" data-cid="'+cid+'" data-x="'+x+'" data-y="'+y+'" data-key="'+key+'" data-k="'+k+'" data-def="'+(d?sh.furniture[k]:'')+'">'+(d?itemIconHTML(d,18):'<span class="hf-empty">空</span>')+'</div>';
    }}
    var bag='';
    (S().pack||[]).forEach(function(it,i){ if(!it) return; var d=DEFS[it.defId]; if(!d||d.cat!=='家具') return; bag+='<div class="hf-bag" data-pack="'+i+'" data-def="'+it.defId+'">'+itemIconHTML(d,16)+'<b>'+d.name+'</b><i>×'+(it.count||1)+'</i></div>'; });
    if(!bag) bag='<p class="tip">行囊中暂无家具——可往市集杂货铺采买床、桌、椅、柜等。</p>';
    return '<h3>布置家具 · '+nm+'</h3>'+'<div class="hf-wrap"><div class="hf-grid">'+cells+'</div><div class="hf-bagbox"><div class="hf-bag-t">背包家具（点选后点格位放置）</div>'+bag+'</div></div>'+'<p class="tip">点已摆格位可取下回囊；摆齐了铺面才像个营生。</p>';
  }
  function housePlaceShop(defId,cid,x,y,key,k){
    var sh=window.shopInst?window.shopInst(cid,x,y,key):null; if(!sh) return;
    if(!sh.furniture||Array.isArray(sh.furniture)) sh.furniture={};
    if(sh.furniture[k]){ var d=(LF.ITEMS||{}).DEFS[sh.furniture[k]]; packAdd(sh.furniture[k],1); delete sh.furniture[k]; if(typeof save==='function') save(S()); toast((d?d.name:'家具')+'已取下收进行囊。','sys'); }
    else if(defId){ var pk=S().pack,found=-1; for(var i=0;i<pk.length;i++){ if(pk[i]&&pk[i].defId===defId){ found=i; break; } } if(found<0){ toast('行囊里没有这件家具。'); return; } pk[found].count=(pk[found].count||1)-1; if(pk[found].count<=0) pk[found]=null; sh.furniture[k]=defId; if(typeof save==='function') save(S()); toast('已摆好「'+(((LF.ITEMS||{}).DEFS[defId]||{}).name||defId)+'」。','sys'); }
    closeModal(); openModal('housefurn',{target:'shop',cid:cid,x:x,y:y,key:key});
  }
  window.openBrokerHouse=function(){ openModal('broker',{kind:'house'}); };
  function modalOptsFor(){ return CMO()||{}; }
  // 放置/取下家具（面板点击回调，engine 全局 onHouseCellTap）
  function housePlace(defId, cid, k){
    var furn=houseFurnState(cid);
    if(furn[k]){ // 取下回背包
      var d=(LF.ITEMS||{}).DEFS[furn[k]];
      packAdd(furn[k],1); delete furn[k];
      if(typeof save==='function') save(S());
      toast((d?d.name:'家具')+'已取下收进行囊。','sys');
    } else if(defId){ // 放置（消耗背包 1 件）
      var pk=S().pack, found=-1;
      for(var i=0;i<pk.length;i++){ var it=pk[i]; if(it && it.defId===defId){ found=i; break; } }
      if(found<0){ toast('行囊中没有该家具。'); return; }
      var it=pk[found]; it.count=(it.count||1)-1; if(it.count<=0) pk[found]=null;
      furn[k]=defId;
      if(typeof save==='function') save(S());
      toast('「'+(((LF.ITEMS||{}).DEFS[defId]||{}).name||defId)+'」已摆入宅院。','good');
    }
    openModal('housefurn',{cid:cid});
    var rr=G.ROOMS['__house_'+cid]; if(rr) rr.desc=['檐下匾额新挂。', houseFurnListHTML(cid)];
  }
  // 暴露给引擎/面板
  LF.House={ registerHouse:registerHouse, enterHouse:enterHouse, ensureHouseRoom:ensureHouseRoom,
    houseCidOf:houseCidOf, houseFurnState:houseFurnState, housePlace:housePlace, HOUSE_GRID_W:HOUSE_GRID_W, HOUSE_GRID_H:HOUSE_GRID_H };
    return {
      bindBrokerPanel: bindBrokerPanel,
      bindHouseFurnPanel: bindHouseFurnPanel,
      bindWardFerry: bindWardFerry,
      bindWardStudy: bindWardStudy,
      buildWardCell: buildWardCell,
      ensureHouseRoom: ensureHouseRoom,
      enterHouse: enterHouse,
      findOfficer: findOfficer,
      houseCidOf: houseCidOf,
      houseFurnListHTML: houseFurnListHTML,
      houseFurnState: houseFurnState,
      housePlace: housePlace,
      housePlaceShop: housePlaceShop,
      modalOptsFor: modalOptsFor,
      observeShop: observeShop,
      officersInCity: officersInCity,
      registerHouse: registerHouse,
      registerPlaceRooms: registerPlaceRooms,
      renderBrokerPanel: renderBrokerPanel,
      renderHouseBrokerPanel: renderHouseBrokerPanel,
      renderHouseFurnPanel: renderHouseFurnPanel,
      renderShopFurnPanel: renderShopFurnPanel,
      renderWardFerry: renderWardFerry,
      renderWardStudy: renderWardStudy,
      shopCellActs: shopCellActs,
      wardFerryBoard: wardFerryBoard,
      wardFerryBuild: wardFerryBuild,
      wardHasZhou: wardHasZhou,
      wardStudyDo: wardStudyDo,
      wardStudyFind: wardStudyFind,
      wardStudyOpts: wardStudyOpts,
      wardSubId: wardSubId,
      wardViewInfo: wardViewInfo,
      wardViewLabel: wardViewLabel,
      wardWaterRoutes: wardWaterRoutes,
      HOUSE_GRID_W: HOUSE_GRID_W
    };
  };
})();

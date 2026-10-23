// 模块 farm（从 engine.js 拆分）
// v20261021b：农田不再只属于苦役营——
//   ① 地块泛化：任意 key 一块田（苦役营 'kuyilao|0,0'，城内农庄 'F|cid|x,y'），规模随城市地力；
//   ② 作物扩为十种，各有时令，错季则长势迟（冬更深）；
//   ③ 新增九宫格农田面板（看得见的田），点畦即干首要的活。
(function (global) {
  global.LF = global.LF || {};
  global.LF.createFarm = function (ctx) {
    var getState = ctx.getState, S = getState;
    var LF = ctx.LF;
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
    var openModal = ctx.openModal || function () {};
    var escapeHtml = ctx.escapeHtml || function (s) { return String(s == null ? '' : s); };
    var deriveCalendar = ctx.deriveCalendar || null;

  // ═══ 地块：一畦一畦开出来的园子 ═══
  //   旧版只有苦役营「一块薄田」：翻三垄 → 掐菜，掐完还是那块地 —— 种地的人无从长进。
  //   现版把它做成可泛化的田：荒地要一垄一垄开出来；每畦各自走 翻 → 播 → 长 → 收。
  //   升级给的是【机制】不是数值：水渠（一桶浇遍）、编筐（多得一捧）、留种（收完必返籽）。
  //   状态存 fixtures[key]：plots[] 每畦 / unlocked 已开出几畦 / up{} 升级 / li 当前畦已翻垄数
  var KUYI_KEY = 'kuyilao|0,0';
  var FARM_LI = 3;                     // 开一畦须翻三垄
  function isCityFarm(key) { return !!key && key.indexOf('F|') === 0; }
  function farmKeyOfCity(cid, x, y) { return 'F|' + cid + '|' + x + ',' + y; }
  // 城内农庄的畦数随地力（agri）涨：薄地四畦，上田十二畦
  function farmMaxOf(key) {
    if (!isCityFarm(key)) return 9;    // 苦役营：九畦到顶（再阔就该惊动牢头了）
    var cid = (key || '').split('|')[1];
    var c = (LF.CITIES || {})[cid] || {};
    var agri = c.agri || 40;
    return Math.max(6, Math.min(12, 5 + Math.floor(agri / 12)));
  }
  function farmPlaceName(key) {
    if (isCityFarm(key)) {
      var cid = (key || '').split('|')[1];
      return (((LF.CITIES || {})[cid] || {}).name || cid) + '·农庄';
    }
    return '薄田';
  }
  // 十种作物：各有生长时辰、产量、种子、宜种时令
  var CROPS = {
    yecai:  { key:'yecai',  name:'野菜', icon:'🥬', grow:3,  out:'yecai',  yield:[1,2], seed:'caizi',     seasons:['春','夏','秋'] },
    dou:    { key:'dou',    name:'菽豆', icon:'🥜', grow:6,  out:'dou',    yield:[1,2], seed:'douzhong',  seasons:['夏','秋'] },
    sumi:   { key:'sumi',   name:'粟米', icon:'🌾', grow:5,  out:'sumi',   yield:[2,3], seed:'sumizhong', seasons:['春','夏','秋'] },
    mai:    { key:'mai',    name:'麦',   icon:'🌾', grow:8,  out:'mai',    yield:[2,4], seed:'maizhong',  seasons:['秋','冬','春'] },
    dao:    { key:'dao',    name:'稻',   icon:'🌾', grow:7,  out:'dao',    yield:[3,5], seed:'daozhong',  seasons:['夏','秋'] },
    ma:     { key:'ma',     name:'麻',   icon:'🪢', grow:6,  out:'ma',     yield:[1,2], seed:'mazhong',   seasons:['春','夏'] },
    sang:   { key:'sang',   name:'桑',   icon:'🍃', grow:9,  out:'sangye', yield:[1,2], seed:'sangzhong', seasons:['春','夏'] },
    cha:    { key:'cha',    name:'茶',   icon:'🍵', grow:10, out:'chaye',  yield:[1,2], seed:'chazhong',  seasons:['春'] },
    guo:    { key:'guo',    name:'果',   icon:'🍎', grow:12, out:'guo',    yield:[2,3], seed:'guozhong',  seasons:['夏','秋'] },
    yaocao: { key:'yaocao', name:'药草', icon:'🌿', grow:5,  out:'caoyao', yield:[1,2], seed:'yaocaozi',  seasons:['春','夏','秋'] }
  };
  var CROP_KEYS = ['yecai', 'dou', 'sumi', 'mai', 'dao', 'ma', 'sang', 'cha', 'guo', 'yaocao'];
  // ── 时令（农历月 → 季）：正月~三月春，四~六夏，七~九秋，十~腊冬 ──
  var SEASON_CN = ['?', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬', '冬', '冬'];
  function seasonNow() {
    try {
      var c = (typeof deriveCalendar === 'function') ? deriveCalendar() : null;
      var m = c ? (c.month || 1) : 1;
      return SEASON_CN[m] || '春';
    } catch (e) { return '春'; }
  }
  // 合时令则旺，错季则迟，冬季更甚（不是不能种，是要多熬些时辰）
  function growScale(p) {
    var c = CROPS[p && p.crop] || CROPS.yecai;
    var s = seasonNow();
    if ((c.seasons || []).indexOf(s) >= 0) return 1;
    return s === '冬' ? 0.34 : 0.5;
  }
  function farmFx(key) {
    key = key || KUYI_KEY;
    var f = fxGet(key), mx = farmMaxOf(key);
    if (!f.plots) {
      f.plots = []; for (var i = 0; i < mx; i++) f.plots.push({ st: 'wild' });
      f.unlocked = 0; f.up = {}; f.li = 0;
      // 旧存档迁移：老版本只记「翻了几垄」，翻透的即算第一畦已开出来
      if ((f.tilled || 0) >= FARM_LI) { f.plots[0].st = 'tilled'; f.unlocked = 1; }
    }
    if (!f.up) f.up = {};
    // 地力涨了则补畦，缩了也不硬删（已开出的地不会凭空没）
    while (f.plots.length < mx) f.plots.push({ st: 'wild' });
    return f;
  }
  function farmTilled(key) { var f = farmFx(key); return (f.unlocked || 0) > 0 || (f.tilled || 0) >= FARM_LI; }
  function farmHas(id, n) { var it = packFind(id); return !!(it && (it.count || 0) >= n); }
  function itemName(id) {
    try { var d = LF.ITEMS && LF.ITEMS.DEFS && LF.ITEMS.DEFS[id]; return (d && d.name) || id; } catch (e) { return id; }
  }
  // 一畦此刻的模样：wild 未开 / tilled 已翻 / growing 长着 / ripe 可收 / wither 枯了
  function plotStage(p) {
    if (!p || p.st !== 'sown') return p ? p.st : 'wild';
    var c = CROPS[p.crop] || CROPS.yecai;
    var need = Math.max(1, Math.round(c.grow / growScale(p)) - (p.wet ? 1 : 0));   // 浇过水的早一个时辰熟
    var past = plantPast(p);
    if (past >= c.grow * 3) return 'wither';            // 该收不收，苗就荒死在畦里
    if (past >= need) return 'ripe';
    return 'growing';
  }
  function plotLeft(p) {
    var c = CROPS[p.crop] || CROPS.yecai;
    var need = Math.max(1, Math.round(c.grow / growScale(p)) - (p.wet ? 1 : 0));
    return Math.max(0, need - plantPast(p));
  }
  // 播种以来已过的时辰数（绝对口径：天数×12 + 时辰差，跨子夜不回绕）
  function plantPast(p) {
    var sd = (p && p.sownDay != null) ? p.sownDay : S().day;
    var st = p && (p.sownT || 0);
    return (S().day - sd) * 12 + (S().time - st);
  }
  // 开垦：一次一垄，三垄开出一畦；头一回孙老递过锄头
  function farmTill(key) {
    key = key || KUYI_KEY;
    var f = farmFx(key), mx = farmMaxOf(key);
    if (!isCityFarm(key) && !jobOpen('farm')) { toast('孙老没托你翻这块地，贸然动土反招人疑。'); return; }
    if ((f.unlocked || 0) >= mx) { toast(isCityFarm(key) ? '能开的畦都开尽了——再阔就得并邻家地了。' : '九畦都开出来了——再开就该惊动牢头了。'); return; }
    if (!(LF.heldTool && LF.heldTool(S(), 'hoeLv'))) {
      packAdd('chutu', 1);
      packAdd('caizi', 2);
      log('孙老从田埂边摸出一把锄头递过来：「家伙给你。土要翻透，别糊弄老骨头。」（得「锄头」×1）', 'good');
      log('他又从怀里摸出个小布袋塞给你：「菜籽。撒下去，别贪多——头一茬能活一半，就算老天赏脸。」（得「菜籽」×2）', 'good');
    }
    if (!exert('开垦')) return;
    busyAct('开垦·半个时辰', 1000, function () {
      var held = (LF.heldTool && LF.heldTool(S(), 'hoeLv')) || null;
      var lv = held ? (held.lv || 0) : -1;
      var li = 1 + (lv >= 0 ? Math.floor(lv / 2) : 0);
      S().energy = Math.max(0, S().energy - (4 + (lv < 0 ? 2 : 0)));
      advanceMinutes(60);
      if (held) { var _wn = LF.wearSitNote(S(), held); if (_wn) log(_wn, 'warn'); LF.wearTool(S(), held); }
      f.li = (f.li || 0) + li; f.tilled = (f.tilled || 0) + li;
      log('你抡' + (held ? held.def.name : '手') + '翻过' + li + '垄，湿土翻开，草腥气扑了满脸。（第 ' + ((f.unlocked || 0) + 1) + ' 畦：' + Math.min(f.li, FARM_LI) + ' / ' + FARM_LI + ' 垄）', 'env');
      if (f.li >= FARM_LI) {
        var carry = f.li - FARM_LI;
        f.plots[f.unlocked || 0] = { st: 'tilled' };
        f.unlocked = (f.unlocked || 0) + 1; f.li = carry;
        log('三垄翻透，土细如筛——第 ' + f.unlocked + ' 畦开出来了。' + (carry ? '（余势未歇，顺手翻了下畦 ' + carry + ' 垄。）' : ''), 'good');
        if (onbWork) onbWork();
      }
      save(S()); renderStatus(); farmRefresh(key);
    });
  }
  // 播种：一畦一份种子
  function farmSow(i, ckey, key) {
    key = key || KUYI_KEY;
    var f = farmFx(key), p = f.plots[i]; if (!p) return;
    var c = CROPS[ckey]; if (!c) return;
    if (!farmHas(c.seed, 1)) { toast('没有' + c.name + '的种子——市上杂货可买，或拿收成自己留种。'); return; }
    if (!exert('播种')) return;
    busyAct('播种·' + c.name, 800, function () {
      packConsume(c.seed, 1);
      advanceMinutes(60);
      p.st = 'sown'; p.crop = ckey; p.sownT = S().time; p.sownDay = S().day; p.wet = false;
      var sc = growScale(p);
      var tipTxt = sc >= 1 ? '正合时令' : (seasonNow() === '冬' ? '冬季长了，熬得慢' : '不合时令，长势迟');
      log('你把' + c.name + '籽撒进第 ' + (i + 1) + ' 畦，覆土踩实。' + tipTxt + '，约 ' + Math.max(1, Math.round(c.grow / sc)) + ' 个时辰可收——浇过水则早一个时辰。', 'good');
      if (onbWork) onbWork();
      afterPackChange(); save(S()); renderStatus(); farmRefresh(key);
    });
  }
  // 浇水：寻常一次浇一畦；修了水渠则三份水浇遍所有长着的畦
  function farmWater(i, key) {
    key = key || KUYI_KEY;
    var f = farmFx(key);
    var bag = packFind('shuidai');
    if (!bag || (bag.water || 0) < 3) { toast('水袋里不足三份水——先在田头「汲水」装满。'); return; }
    var all = !!f.up.canal, targets = [];
    for (var k = 0; k < (f.unlocked || 0); k++) { if (plotStage(f.plots[k]) === 'growing') targets.push(k); }
    if (!all) { if (plotStage(f.plots[i]) !== 'growing') { toast('这一畦此刻不缺水。'); return; } targets = [i]; }
    if (!targets.length) { toast('眼下没有正长着的畦。'); return; }
    if (!exert('挑水浇畦')) return;
    busyAct('挑水浇畦', 900, function () {
      bag.water = (bag.water || 0) - 3;
      advanceMinutes(60);
      for (var k = 0; k < targets.length; k++) f.plots[targets[k]].wet = true;
      log(all ? ('水渠一开，三份水顺着沟渗进 ' + targets.length + ' 畦——这就是修渠的好处。')
              : ('你把水浇进第 ' + (i + 1) + ' 畦，湿泥颜色转深——这一茬能早熟一个时辰。'), 'good');
      if (onbWork) onbWork();
      afterPackChange(); save(S()); renderStatus(); farmRefresh(key);
    });
  }
  // 田头汲水：城内农庄没有囚营那口井，就地打水装袋
  function farmDraw(key) {
    key = key || KUYI_KEY;
    var bag = packFind('shuidai');
    if (!bag) { toast('没有水袋，捧不起水——杂货有售，或以木材自制一只。'); return; }
    var cap = bag.waterCap || 10;
    if ((bag.water || 0) >= cap) { toast('水袋已满。'); return; }
    if (!exert('汲水')) return;
    busyAct('汲水', 800, function () {
      bag.water = Math.min(cap, (bag.water || 0) + cap);
      advanceMinutes(30);
      log('你在田头汲了半晌，水袋沉甸甸的。（水 ' + bag.water + '/' + cap + '）', 'env');
      afterPackChange(); save(S()); renderStatus(); farmRefresh(key);
    });
  }
  function farmWeed(i, key) {
    key = key || KUYI_KEY;
    var f = farmFx(key);
    if (!exert('锄草')) return;
    var held0 = (LF.heldTool && LF.heldTool(S(), 'hoeLv')) || null;
    if (!held0 && !S().flags.hintedNoHoe) {
      S().flags.hintedNoHoe = true;
      toast('徒手除草费劲——备一把锄头（货郎有售）除草更利落。');
    }
    busyAct('锄草', 800, function () {
      var held = (LF.heldTool && LF.heldTool(S(), 'hoeLv')) || null;
      advanceMinutes(60);
      S().energy = Math.max(0, S().energy - (held ? 0 : 1));
      log('你' + (held ? ('持' + held.def.name + '三两下刨去草根') : ('蹲在第 ' + (i + 1) + ' 畦边手拔')) + '，土腥气扑了满脸。（距可收约 ' + plotLeft(f.plots[i]) + ' 个时辰）', 'env');
      if (held) { var _wn = LF.wearSitNote(S(), held); if (_wn) log(_wn, 'warn'); LF.wearTool(S(), held); }
      save(S()); renderStatus(); farmRefresh(key);
    });
  }
  function farmHarvest(i, key) {
    key = key || KUYI_KEY;
    var f = farmFx(key), p = f.plots[i]; if (!p) return;
    var c = CROPS[p.crop] || CROPS.yecai;
    if (!exert('采收')) return;
    var held0 = (LF.heldTool && LF.heldTool(S(), 'sickleLv')) || null;
    if (!held0 && !S().flags.hintedNoSickle) {
      S().flags.hintedNoSickle = true;
      toast('徒手采收费力且脱粒不净——备一把镰刀（货郎有售，或行囊里装上）收得更多。');
    }
    busyAct('采收·' + c.name, 900, function () {
      var held = (LF.heldTool && LF.heldTool(S(), 'sickleLv')) || null;
      if (held && held.item.dur != null && held.item.dur <= 0) toast('镰已卷刃，先去修再割更利落——此刻仍能凑合。');
      advanceMinutes(60);
      S().energy = Math.max(0, S().energy - 2);
      var n = c.yield[0] + Math.floor(Math.random() * (c.yield[1] - c.yield[0] + 1));
      if (p.wet) n += 1;
      if (f.up.basket) n += 1;
      if (held) n += 1 + Math.floor((held.lv || 0) / 2);
      if (!packAdd(c.out, n)) return;
      f.picked = (f.picked || 0) + n;
      var back = false;
      var keepP = held ? 0.55 : 0.4;
      if (f.up.seedkeep || Math.random() < keepP) { if (packAdd(c.seed, 1)) back = true; }
      p.st = 'tilled'; p.crop = null; p.wet = false;
      log('第 ' + (i + 1) + ' 畦' + (held ? ('你持' + held.def.name + '贴垄刈过，谷穗应声而落') : '你蹲地手掰，费劲掐下') + '，收得' + c.name + '×' + n + '。' + (back ? '（留下一份籽，下一茬有着落。）' : '') + (f.up.basket ? '（筐编得好，多兜了一捧。）' : ''), 'good');
      if (held) { var _wn = LF.wearSitNote(S(), held); if (_wn) log(_wn, 'warn'); LF.wearTool(S(), held); }
      if (onbWork) onbWork();
      afterPackChange(); save(S()); renderStatus(); farmRefresh(key);
    });
  }
  function farmClear(i, key) {
    key = key || KUYI_KEY;
    var f = farmFx(key), p = f.plots[i]; if (!p) return;
    if (!exert('铲除枯苗')) return;
    busyAct('铲除枯苗', 700, function () {
      advanceMinutes(60);
      p.st = 'tilled'; p.crop = null; p.wet = false;
      log('你把枯苗连根铲起，扔在田埂上晾着——土还在，重头再来。', 'env');
      save(S()); renderStatus(); farmRefresh(key);
    });
  }
  // 升级三件：给机制，不给数值
  var FARM_UP = {
    canal:    { name:'水渠', icon:'🚰', cost:{ shitiao:3 }, need:{ shitiao:3 }, desc:'沿畦开一道小沟。此后三份水浇遍所有长着的畦，不必一畦一畦挑。' },
    basket:   { name:'编筐', icon:'🧺', cost:{ rope:1 },    need:{ rope:1 },    desc:'请席翁编一只收菜的筐。此后每畦采收都多得一捧。' },
    seedkeep: { name:'留种', icon:'🌱', cost:{ bumu:1 },    need:{ bumu:1 },    desc:'缝一只布口袋存籽。此后每收一畦，必留得一份种子。' }
  };
  function farmUpgrade(key2, upKey) {
    var f = farmFx(key2), u = FARM_UP[upKey]; if (!u) return;
    if (f.up[upKey]) { toast(u.name + '已经有了。'); return; }
    for (var id in u.need) { if (!farmHas(id, u.need[id])) { toast('料不够：修' + u.name + '需「' + itemName(id) + '」×' + u.need[id] + '。'); return; } }
    if (!exert('修' + u.name)) return;
    busyAct('修' + u.name, 1200, function () {
      for (var id in u.need) packConsume(id, u.need[id]);
      advanceMinutes(60);
      f.up[upKey] = true;
      log('〔农田·' + u.name + '〕' + u.desc, 'good');
      afterPackChange(); save(S()); renderStatus(); farmRefresh(key2);
    });
  }
  // 干完活刷新：面板开着就重绘，在房间里就重排动作
  function farmRefresh(key) {
    key = key || KUYI_KEY;
    try {
      if (farmPanelKey === key && typeof openModal === 'function') { openModal('farm'); return; }
    } catch (e) { }
    try { buildActions(curRoom()); } catch (e) { }
  }

  // ══ 九宫格农田面板（v20261021b）：看得见的田 ══
  var farmPanelKey = null, farmSel = -1;
  function openFarmPanel(opts) {
    farmPanelKey = (opts && opts.key) || KUYI_KEY;
    farmSel = -1;
    openModal('farm');
  }
  // 点畦即干「首要的那件事」：荒地→开垦，可收→采收，枯了→铲除；已翻/长着则选中细看
  function farmTap(i) {
    var key = farmPanelKey || KUYI_KEY, f = farmFx(key);
    var st = plotStage(f.plots[i]);
    if (st === 'wild') { farmTill(key); return; }
    if (st === 'ripe') { farmHarvest(i, key); return; }
    if (st === 'wither') { farmClear(i, key); return; }
    farmSel = (farmSel === i) ? -1 : i;
    try { openModal('farm'); } catch (e) { }
  }
  function farmPlotIcon(p) {
    var st = plotStage(p);
    if (st === 'wild') return '🟫';
    if (st === 'tilled') return '🟫';
    if (st === 'wither') return '🥀';
    if (st === 'ripe') return (CROPS[p.crop] || CROPS.yecai).icon;
    if (st === 'growing') return '🌱';
    return '🟫';
  }
  function renderFarmPanel() {
    var key = farmPanelKey || KUYI_KEY, f = farmFx(key), mx = farmMaxOf(key);
    var sn = seasonNow();
    var h = '<div class="farm-panel">';
    h += '<div class="farm-h">' + escapeHtml(farmPlaceName(key)) + ' <span class="farm-season">' + sn + '</span> <span class="farm-cnt">已开 ' + (f.unlocked || 0) + '/' + mx + ' 畦</span></div>';
    h += '<div class="farm-grid">';
    for (var i = 0; i < mx; i++) {
      var p = f.plots[i], st = plotStage(p), cls = 'fp st-' + st, sub = '';
      if (st === 'growing') sub = '还差' + plotLeft(p) + '辰';
      else if (st === 'ripe') sub = '可收';
      else if (st === 'tilled') sub = '待播';
      else if (st === 'wither') sub = '枯了';
      else if (st === 'wild') sub = (i === (f.unlocked || 0)) ? '可开' : '荒地';
      if (st === 'growing' && growScale(p) < 1) cls += ' slow';
      if (farmSel === i) cls += ' sel';
      h += '<div class="' + cls + '" onclick="window.farmTap(' + i + ')"><span class="fp-ic">' + farmPlotIcon(p) + '</span><span class="fp-sub">' + sub + '</span></div>';
    }
    h += '</div>';
    // 选中畦的动作
    if (farmSel >= 0 && farmSel < (f.unlocked || 0)) {
      var q = f.plots[farmSel], qs = plotStage(q);
      h += '<div class="farm-sel">第 ' + (farmSel + 1) + ' 畦 · ' + ({ wild: '荒地', tilled: '已翻待播', growing: '长着', ripe: '可收', wither: '枯了' })[qs] + '</div>';
      h += '<div class="farm-acts">';
      if (qs === 'tilled') {
        for (var ci = 0; ci < CROP_KEYS.length; ci++) {
          var c = CROPS[CROP_KEYS[ci]], has = farmHas(c.seed, 1);
          var ok2 = (c.seasons || []).indexOf(sn) >= 0;
          h += '<button class="btn xs' + (has ? '' : ' dis') + '"' + (has ? '' : ' disabled') + ' onclick="window.farmSowAt(' + farmSel + ',\'' + c.key + '\')">' + c.icon + '播' + c.name + '<span class="fs-season' + (ok2 ? ' ok' : ' no') + '">' + (ok2 ? '宜' : '忌') + (c.seasons || []).join('') + '</span></button>';
        }
      } else if (qs === 'growing') {
        h += '<button class="btn xs' + (q.wet ? ' dis' : '') + '"' + (q.wet ? ' disabled' : '') + ' onclick="window.farmWaterAt(' + farmSel + ')">💧浇水（三份）</button>';
        h += '<button class="btn xs" onclick="window.farmWeedAt(' + farmSel + ')">🧹锄草</button>';
        if (growScale(q) < 1) h += '<span class="farm-warn">非时令，长势迟（约 ' + Math.max(1, Math.round((CROPS[q.crop] || CROPS.yecai).grow / growScale(q))) + ' 时辰）</span>';
      } else if (qs === 'ripe') {
        h += '<button class="btn xs" onclick="window.farmHarvestAt(' + farmSel + ')">🧺采收</button>';
      } else if (qs === 'wither') {
        h += '<button class="btn xs" onclick="window.farmClearAt(' + farmSel + ')">🧹铲除枯苗</button>';
      }
      h += '</div>';
    } else {
      h += '<div class="farm-tip">点一畦干活：荒地开垦、可收即收、枯了铲除；已翻或长着的畦点开可播种、浇水。</div>';
    }
    h += '<div class="farm-tools"><button class="btn xs" onclick="window.farmDrawWater()">🪣 田头汲水</button><span class="farm-legend">🟫荒/待播 · 🌱长 · 🥀枯</span></div>';
    h += '</div>';
    return h;
  }
  // 面板按钮桥接（挂在 window 上，供 onclick 调用）
  global.farmTap = function (i) { farmTap(i); };
  global.farmSowAt = function (i, ckey) { farmSow(i, ckey, farmPanelKey || KUYI_KEY); };
  global.farmWaterAt = function (i) { farmWater(i, farmPanelKey || KUYI_KEY); };
  global.farmWeedAt = function (i) { farmWeed(i, farmPanelKey || KUYI_KEY); };
  global.farmHarvestAt = function (i) { farmHarvest(i, farmPanelKey || KUYI_KEY); };
  global.farmClearAt = function (i) { farmClear(i, farmPanelKey || KUYI_KEY); };
  global.farmDrawWater = function () { farmDraw(farmPanelKey || KUYI_KEY); };

  // 格上的设施（苦役营薄田沿用）：每畦按当前状态只显一条
  function farmObjects(key) {
    key = key || KUYI_KEY;
    var arr = [], f = farmFx(key), mx = farmMaxOf(key);
    for (var _i = 0; _i < mx; _i++) {
      (function (i) {
        var nm = '第 ' + (i + 1) + ' 畦';
        var _hoe = (LF.heldTool && LF.heldTool(S(), 'hoeLv')) || null;
        var _li = 1 + (_hoe ? Math.floor((_hoe.lv || 0) / 2) : 0);
        var _open = isCityFarm(key) ? (function () { return true; }) : (function () { return jobOpen('farm'); });
        arr.push({ icon:'🌾', label:nm + '·荒地',
          show:function () { return _open() && i === farmFx(key).unlocked && farmFx(key).unlocked < mx; },
          acts:[{ label:'开垦（一锄' + _li + '垄）', icon:'⛏️', fn:function () { farmTill(key); } }] });
        arr.push({ icon:'🟫', label:nm + '·已翻',
          show:function () { return _open() && i < farmFx(key).unlocked && plotStage(farmFx(key).plots[i]) === 'tilled'; },
          acts:[{ label:'播·野菜（菜籽×1）', icon:'🥬', fn:function () { farmSow(i, 'yecai', key); } },
                { label:'播·菽豆（菽种×1）', icon:'🥜', fn:function () { farmSow(i, 'dou', key); } }] });
        arr.push({ icon:'🌱', label:nm + '·长着',
          show:function () { return _open() && i < farmFx(key).unlocked && plotStage(farmFx(key).plots[i]) === 'growing'; },
          acts:[{ label:'浇水（三份）', icon:'💧', show:function () { return !farmFx(key).plots[i].wet; }, fn:function () { farmWater(i, key); } },
                { label:'锄草', icon:'🧹', fn:function () { farmWeed(i, key); } }] });
        arr.push({ icon:'🥬', label:nm + '·可收',
          show:function () { return _open() && i < farmFx(key).unlocked && plotStage(farmFx(key).plots[i]) === 'ripe'; },
          acts:[{ label:'采收', icon:'🧺', fn:function () { farmHarvest(i, key); } }] });
        arr.push({ icon:'🥀', label:nm + '·枯了',
          show:function () { return _open() && i < farmFx(key).unlocked && plotStage(farmFx(key).plots[i]) === 'wither'; },
          acts:[{ label:'铲除枯苗', icon:'🧹', fn:function () { farmClear(i, key); } }] });
      })(_i);
    }
    return arr;
  }

    return {
      CROPS, CROP_KEYS, FARM_LI, FARM_MAX: 9, FARM_UP, KUYI_KEY,
      farmClear, farmDraw, farmFx, farmHarvest, farmHas,
      farmKeyOfCity, farmMaxOf, farmObjects, farmPlaceName,
      farmSow, farmTill, farmTilled, farmUpgrade, farmWater, farmWeed,
      openFarmPanel, renderFarmPanel, plantPast, plotLeft, plotStage,
      growScale, seasonNow
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

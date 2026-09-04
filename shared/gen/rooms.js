// 地点房间生成器（Place 系统第 2 层）：把地点档案按 kind 造出房间图，注入 G.ROOMS。
// 关键约束（来自引擎移动罗盘）：出口键只能用 8 方位
//   北/南/东/西/东北/西北/东南/西南（index.html DIR_GRID），
//   不可用 内/出/上/下（罗盘无对应格）。多层副本用 东/南/西 平面串联表示楼层。
// 城市(kind:'city')内部走 isCityGrid 坐标格，不在此生成（由 registerCityRooms 处理）。
(function(global){
  global.LF = global.LF || {};
  var KINDS = global.LF.PLACE_KINDS || {};
  var DEFAULTS = global.LF.PLACE_DEFAULTS || {};

  // 郊野生成辅助：确定性随机 / 中文数 / 地形文案
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function hashStr(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function zh(n){ return ['零','一','二','三','四','五','六','七','八','九'][n] || (''+n); }
  function fieldDesc(p, r, c, geo, isEntry){
    var lines = [ (p.name||'郊野') + '，古道两旁草木葳蕤，远处隐约可见城郭村落的轮廓。' ];
    if(isEntry) lines.push('你立于郊野入口，身后是来时的城门，前方路径四通八达。');
    return lines;
  }

  function pack(id, r){ var o = {}; o[id] = r; return o; }

  // 统一房间工厂：补齐引擎需要的字段（desc 数组 / find / exits / npcs / items / actions）
  function room(id, name, o){
    o = o || {};
    var r = {
      id: id, name: name,
      desc: (o.desc && o.desc.length ? o.desc : [name]),
      find: (o.find || ''),
      exits: (o.exits || {}),
      npcs: (o.npcs || []),
      items: (o.items || []),
      actions: (o.actions || [])
    };
    if (o.kind) r._kind = o.kind;
    if (o.plot) r.plot = o.plot;
    if (o.battle) r.battle = o.battle;
    if (o.isBattlefield) r.isBattlefield = true;
    if (o.garrison != null) r.garrison = o.garrison;
    if (o.wall != null) r.wall = o.wall;
    if (o.defenseBonus != null) r.defenseBonus = o.defenseBonus;
    if (o.owner) r.owner = o.owner;
    if (o.isPass) r.isPass = true;
    if (o.spawns) r.spawns = o.spawns;
    if (o.loot) r.loot = o.loot;
    if (o.isBossRoom) r.isBossRoom = true;
    if (o.floor) r.floor = o.floor;
    return r;
  }

  // 读字段：地点优先，缺省取 DEFAULTS[kind]，再取兜底
  function field(p, kind){
    var d = DEFAULTS[kind] || {};
    return function(k, fb){ return (p[k] !== undefined ? p[k] : (d[k] !== undefined ? d[k] : fb)); };
  }

  var GEN = {
    // 城市：与 registerCityRooms 完全兼容（内部走 isCityGrid，不依赖 exits）
    city: function(p){
      var r = room(p.id, p.name, {
        kind: 'city',
        desc: (p.blurb || [p.desc || p.name]),
        find: (p.blurbFind || ''),
        actions: (p.rootActs || [{ id:'rest', label:'城中休整', group:'行动', tip:'寻一处馆驿安歇，气血内力尽复' }])
      });
      r.isCity = true;
      return pack(p.id, r);
    },

    // 镇/营：单根房（非坐标格城市），可后续扩展内部房间
    town: function(p){
      var r = room(p.id, p.name, { kind:'town', desc:[p.desc || p.name], find:(p.desc || ''),
        actions:[{ id:'rest', label:'镇中歇脚', group:'行动', tip:'气血内力尽复' }] });
      return pack(p.id, r);
    },
    camp: function(p){
      var r = room(p.id, p.name, { kind:'camp', desc:[p.desc || p.name], find:(p.desc || ''),
        actions:[{ id:'rest', label:'营中休整', group:'行动', tip:'气血内力尽复' }] });
      return pack(p.id, r);
    },

    // 关卡/要塞（城市派生）：关门(入口) + 瓮城(北) + 守营(东)，回程用南/西
    fort: function(p){
      var v = field(p, 'fort'); var id = p.id, o = {};
      var ent = room(id, p.name + (p.isPass ? '·关门' : ''), {
        kind: 'fort', isPass: !!p.isPass,
        garrison: v('garrison'), wall: v('wall'), defenseBonus: v('defenseBonus'), owner: p.owner,
        desc: [ (p.desc || p.name) + '。', (p.isPass ? '此关扼守要道，过者必经。' : '守军盘查往来。') ],
        find: (p.isPass ? '关门两侧戍卒林立，此关扼守要道。' : '守营辕门，兵甲鲜明。'),
        actions: [{ id:'rest', label:(p.isPass ? '关驿歇脚' : '营中歇脚'), group:'行动', tip:'气血内力尽复' }]
      });
      o[id] = ent;
      var weng = room(id + '_weng', p.name + '·瓮城', { kind:'fort_inner',
        desc:['瓮城狭长，两翼伏兵可夹击来敌。'], find:'',
        actions:[{ id:'back', label:'返回关门', group:'行动', tip:'' }] });
      o[id + '_weng'] = weng; ent.exits['北'] = id + '_weng'; weng.exits['南'] = id;
      var ying = room(id + '_ying', p.name + '·守营', { kind:'fort_inner',
        desc:['营中刁斗声声，士卒操练。'], find:'',
        actions:[{ id:'back', label:'返回关门', group:'行动', tip:'' }] });
      o[id + '_ying'] = ying; ent.exits['东'] = id + '_ying'; ying.exits['西'] = id;
      return o;
    },
    pass: function(p){ return GEN.fort(p); },

    // 名胜/野地：单房 + 剧情/战役钩子（plot/battle/isBattlefield 供触发与行军系统读取）
    landmark: function(p){
      var r = room(p.id, p.name, {
        kind: 'landmark', plot: p.plot, battle: p.battle, isBattlefield: !!p.isBattlefield,
        desc: [ (p.desc || p.name) + '。', (p.isBattlefield ? '此地曾兵戈相见，杀气未消。' : '风物依旧，引人凭吊。') ],
        find: (p.desc || p.name),
        actions: [{ id:'rest', label:'驻足凭吊', group:'行动', tip:'' }]
      });
      return pack(p.id, r);
    },
    wild: function(p){ return GEN.landmark(p); },

    // 郊野（行军层）：N×N 可步行网格，八向出口接罗盘；内容由 systems/travel.js 散布。
    // 入口格在「近边」中央，远边各格经 travel.link() 分支到邻地点。
    field: function(p){
      var T = global.LF.Travel; if(!T) return {};
      var size = p.size || 4;
      var gd = p.gateDir || '东';
      var geo = T.fieldGeometry(size, gd);
      var o = {};
      var DIR8 = { '北':[0,-1],'南':[0,1],'东':[1,0],'西':[-1,0],
                   '东北':[1,-1],'西北':[-1,-1],'东南':[1,1],'西南':[-1,1] };
      for(var r=0;r<size;r++) for(var c=0;c<size;c++){
        var rid = T.roomId(p.id, r, c);
        var isEntry = (r===geo.entryR && c===geo.entryC);
        var rm = room(rid, (p.name || p.id) + '·' + zh(r) + zh(c) + '格', {
          kind:'field', isField:true,
          desc: fieldDesc(p, r, c, geo, isEntry),
          find:'', actions:[]
        });
        rm.isField = true; rm.fieldId = p.id; rm.fr = r; rm.fc = c; rm._entry = isEntry;
        rm.exits = {};
        for(var d in DIR8){
          var nr = r + DIR8[d][1], nc = c + DIR8[d][0];
          if(nr>=0 && nr<size && nc>=0 && nc<size) rm.exits[d] = T.roomId(p.id, nr, nc);
        }
        var rng = mulberry32(hashStr(p.id + '@' + r + '_' + c));
        var sc = T.scatterContent(rng, p, r, c, isEntry);
        if(sc.resources.length) rm.resources = sc.resources;
        if(sc.monsters.length) rm.monsters = sc.monsters;
        if(sc.npcs.length) rm.fieldNpcs = sc.npcs;
        o[rid] = rm;
      }
      return o;
    },

    // 副本：入口房(@entrance) + floors×roomsPerFloor 平面串联；首房东进、行末南接下层、西出回入口；西出洞口回地表(entry)
    dungeon: function(p){
      var v = field(p, 'dungeon'); var id = p.id, o = {};
      var floors = v('floors'), per = v('roomsPerFloor');
      var spawns = v('spawns') || [], boss = v('boss'), loot = v('loot') || [];
      var prev = null, first = null;
      for (var f = 1; f <= floors; f++){
        for (var r = 0; r < per; r++){
          var rid = id + '@f' + f + 'r' + r;
          var isBoss = (f === floors && r === per - 1);
          var rm = room(rid, p.name + '·第' + f + '层' + (isBoss ? '·首领' : ''), {
            kind: 'dungeon', floor: f, isBossRoom: isBoss,
            desc: [ isBoss ? '密室深处，首领环视。' : '幽径漆黑，怪影幢幢。' ], find:'',
            spawns: isBoss ? (boss ? [boss] : []) : spawns,
            loot: isBoss ? loot : []
          });
          o[rid] = rm;
          if (!first) first = rid;
          if (prev){
            if (r === 0){ o[prev].exits['南'] = rid; rm.exits['北'] = prev; }   // 换行：上层末房 ↓ 下层首房
            else { o[prev].exits['东'] = rid; rm.exits['西'] = prev; }          // 同层：向右串联
          }
          prev = rid;
        }
      }
      var ent = room(id + '@entrance', p.name + '·入口', { kind:'dungeon_entrance',
        desc:['洞口幽深，寒气逼人。'], find:'',
        actions:[{ id:'leave', label:'退出秘谷', group:'行动', tip:'' }] });
      o[id + '@entrance'] = ent;
      ent.exits['东'] = first;                              // 进洞
      if (first) o[first].exits['西'] = id + '@entrance';   // 出洞回入口
      ent.exits['西'] = p.entry;                            // 出洞口回地表(entry 地点)
      return o;
    },

    // 剧情图：作者手写房间(rooms.js)优先；此处仅生成入口占位
    story: function(p){
      var r = room(p.id, p.name, { kind:'story', desc:[p.desc || p.name], find:'',
        actions:[{ id:'rest', label:'稍作停留', group:'行动', tip:'' }] });
      return pack(p.id, r);
    }
  };

  // 对外：给定 placeId，返回 { roomId: roomObj }
  function genPlaceRooms(placeId){
    var P = global.LF.PLACES || {}; var p = P[placeId]; if (!p) return {};
    var g = GEN[p.kind] || GEN.city;
    return g(p);
  }

  global.LF.genPlaceRooms = genPlaceRooms;
  global.LF.PLACE_GEN = GEN;
})(typeof window !== 'undefined' ? window : globalThis);

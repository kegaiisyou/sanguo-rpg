// 大地图数据（外置，便于随时增改房间坐标 / 州域 / 区域 / 图例，无需改动引擎代码）
// 三级缩放体系：
//   lv0 州域层  → states（东汉十三州轮廓多边形 + 州名）
//   lv1 区域层  → zones（州内城池/要地节点）+ regions（区域底色）
//   lv2 房间层  → coords（房间节点）+ exits 连线
// 结构：
//   LF.MAP.cell     单格像素
//   LF.MAP.li       1 格 = 多少里（图例刻度）
//   LF.MAP.coords   { roomId: [列col, 行row] }  列东正西负、行北负南正（负坐标=北上方向）
//   LF.MAP.regions  [ { t:标签, c:底色, center:[col,row], r:半径px } ]
//   LF.MAP.kinds    { roomId: 'city|wild|dungeon|fort|tutorial|town|camp' }  节点分色覆盖
//   LF.MAP.states   [ { id, name, c:填充色, b:描边色, label:[col,row], poly:[ [c,r]... ] } ]  州域轮廓
//   LF.MAP.zones    [ { id, name, icon, pos:[col,row], st:所属州, open:是否已开放, kind, desc } ]  区域节点
// 自愈约定：不在 coords 中的房间，引擎会自动依据其任一有坐标出口的方位就近生成坐标，
//           因此新增房间时若懒得给坐标，地图也不会失配。
(function(global){
  global.LF = global.LF || {};
  global.LF.MAP = {
    cell: 46,   // 单格像素（容纳十三州后压缩格距，房间层缩放范围更大）
    li: 60,     // 1 格 = 60 里

    coords: {
      // ── 中原 · 颍川（初开之地）──
      camp:[6,7], city:[6,6], stream:[5,7], forest:[7,7], build_test:[7,8],
      forest_patrol_a:[8,7], forest_patrol_b:[8,6], forest_patrol_c:[8,5],
      luoyang:[6,3],
      // ── 幽州 · 渔阳 ──
      yuyang_guomen:[14,-1], yuyang_nanmen:[14,-2], yuyang_tongqu:[14,-3], yuyang_beimen:[14,-4],
      yuyang_xishijie:[13,-3], yuyang_junya:[13,-4], yuyang_junying:[12,-3], yuyang_yiguan:[12,-4],
      yuyang_dongshijie:[15,-3], yuyang_dashi:[16,-3], yuyang_jiulou:[15,-4], yuyang_chasi:[15,-2],
      // ── 幽州 · 白檀军屯 ──
      baitan_yingmen:[14,-5], baitan_tun:[14,-6], baitan_tian:[13,-6], baitan_ma:[15,-6],
      baitan_cang:[13,-7], baitan_liao:[15,-7],
      // ── 幽州 · 燕山 ──
      yanshan_shankou:[14,-8], yanshan_feng:[15,-8], yanshan_jian:[13,-8],
      yanshan_lindao:[14,-9], yanshan_xueling:[15,-9], yanshan_zhandao:[13,-9],
      // ── 幽州 · 燕山小村落（教学圈）──
      ys_entrance:[14,-11], ys_north:[14,-12], ys_ne:[15,-12], ys_east:[15,-11],
      ys_se:[15,-10], ys_south:[14,-10], ys_sw:[13,-10], ys_west:[13,-11], ys_nw:[13,-12],
      // ── 苦役营教学切片 ──
      camp_wall:[14,-7], camp_yard:[15,-7], camp_cell:[16,-7],
      // ── 蓟城（幽州州治）──
      ji_guomen:[9,3], ji_liumin:[8,3], ji_mashi:[13,3], ji_nanmen:[9,2],
      ji_tongqu:[9,1], ji_beimen:[9,0],
      ji_xishijie:[8,1], ji_dongshijie:[10,1],
      ji_zhoumu:[8,0], ji_lianwu:[7,0],
      ji_junying:[7,1], ji_yiguan:[7,2], ji_junya:[8,2],
      ji_dashi:[11,1], ji_xuegong:[11,0],
      ji_jiulou:[10,0], ji_chasi:[10,2],
      ji_minli:[12,1], ji_minju:[12,0], ji_minju2:[12,2],
      // ── 蓟城正北 · 渐进通道（黑山余脉）──
      ji_tian:[9,-1], ji_xiaoshulin:[10,-1],
      ji_huangdi:[9,-2], ji_senlin:[10,-2],
      ji_xiaoqiu:[9,-3],
      ji_huangshan:[9,-4],
      ji_heishan_zhai:[9,-5], ji_heishan_juyi:[9,-6], ji_heishan_houzhai:[9,-7]
    },

    // 区域底色（叠加在节点连线之下；r 为像素半径，随 cell 缩放）
    regions: [
      { t:'中 原',  c:'rgba(120,160,96,.18)',  center:[6,7],   r:82 },
      { t:'洛 阳',  c:'rgba(196,160,70,.18)',  center:[6,3],   r:65 },
      { t:'渔 阳',  c:'rgba(120,150,200,.13)', center:[14,-3], r:82 },
      { t:'白 檀',  c:'rgba(150,128,88,.13)',  center:[14,-6], r:67 },
      { t:'燕 山',  c:'rgba(110,140,110,.14)', center:[14,-9], r:77 },
      { t:'幽 州',  c:'rgba(96,140,190,.16)',  center:[10,-0.5], r:235 },
      { t:'黑 山',  c:'rgba(90,86,80,.14)',    center:[9,-5],  r:85 }
    ],

    // 东汉十三州 · 示意轮廓（多边形顶点为网格坐标；label 为州名位置）
    states: [
      { id:'you',   name:'幽 州', c:'rgba(96,140,190,.22)',  b:'rgba(76,110,160,.60)', label:[11,-6],
        poly:[[6,-13],[13,-13],[17,-10],[17,-1],[14,3],[9,3],[6,1]] },
      { id:'ji',    name:'冀 州', c:'rgba(176,140,74,.20)',  b:'rgba(136,106,56,.60)', label:[9,0],
        poly:[[5,-3],[11,-3],[12,2],[9,4],[5,3]] },
      { id:'bing',  name:'并 州', c:'rgba(122,150,92,.20)',  b:'rgba(94,118,70,.60)', label:[2,-1],
        poly:[[2,-5],[6,-5],[7,-1],[5,2],[1,1],[-2,-2]] },
      { id:'sili',  name:'司 隶', c:'rgba(196,158,70,.20)',  b:'rgba(150,120,50,.60)', label:[4,2],
        poly:[[1,-2],[1,2],[2,5],[6,6],[9,4],[8,1],[5,-2]] },
      { id:'liang', name:'凉 州', c:'rgba(196,128,74,.18)',  b:'rgba(150,96,52,.60)', label:[-4,5],
        poly:[[-5,1],[-7,3],[-6,8],[-2,8],[1,6],[-1,1]] },
      { id:'yu',    name:'豫 州', c:'rgba(196,110,110,.20)', b:'rgba(150,82,82,.60)', label:[7,7],
        poly:[[4,4],[10,4],[11,8],[9,10],[5,9],[3,6]] },
      { id:'yan',   name:'兖 州', c:'rgba(176,132,100,.20)', b:'rgba(136,100,74,.60)', label:[10,5],
        poly:[[8,3],[12,3],[13,7],[10,8],[7,7]] },
      { id:'qing',  name:'青 州', c:'rgba(130,190,150,.20)', b:'rgba(96,146,112,.60)', label:[14,4],
        poly:[[11,2],[15,2],[16,6],[15,8],[11,6]] },
      { id:'xu',    name:'徐 州', c:'rgba(196,140,74,.20)',  b:'rgba(150,104,52,.60)', label:[16,8],
        poly:[[13,5],[17,5],[18,9],[16,11],[12,9]] },
      { id:'yang',  name:'扬 州', c:'rgba(106,132,196,.20)', b:'rgba(78,98,150,.60)', label:[13,12],
        poly:[[10,9],[14,8],[17,9],[18,13],[15,15],[11,14]] },
      { id:'jing',  name:'荆 州', c:'rgba(104,176,148,.20)', b:'rgba(76,136,112,.60)', label:[6,12],
        poly:[[3,8],[7,8],[9,11],[8,16],[4,15],[2,11]] },
      { id:'yi',    name:'益 州', c:'rgba(110,154,110,.20)', b:'rgba(82,118,82,.60)', label:[1,11],
        poly:[[-3,8],[-1,12],[1,15],[5,13],[6,10],[3,8]] },
      { id:'jiao',  name:'交 州', c:'rgba(108,160,108,.18)', b:'rgba(80,122,80,.60)', label:[4,17],
        poly:[[2,13],[7,13],[9,16],[7,20],[2,19],[-1,17]] }
    ],

    // 区域层节点：州内城池 / 要地（open=true 表示该地已有实际内容，未开放的名城以暗色占位）
    zones: [
      { id:'yingchuan', name:'颍川',     icon:'🏙️', pos:[6,6],   st:'豫州', open:true,  kind:'city',    desc:'中原腹地，乱世初起之地' },
      { id:'luoyang',   name:'洛阳',     icon:'🏯', pos:[6,3],   st:'司隶', open:true,  kind:'city',    desc:'汉室京师，宫阙巍峨' },
      { id:'jicheng',   name:'蓟城',     icon:'🏯', pos:[9,2],   st:'幽州', open:true,  kind:'city',    desc:'幽州州治，北疆雄城' },
      { id:'yuyang',    name:'渔阳',     icon:'🏰', pos:[14,-2], st:'幽州', open:true,  kind:'fort',    desc:'渔阳郡治，边塞重镇' },
      { id:'baitan',    name:'白檀军屯', icon:'⚔️', pos:[14,-6], st:'幽州', open:true,  kind:'fort',    desc:'滦水屯田戍堡' },
      { id:'yanshan',   name:'燕山',     icon:'⛰️', pos:[14,-10],st:'幽州', open:true,  kind:'wild',    desc:'燕山余脉，峰峦叠嶂' },
      { id:'heishan',   name:'黑山寨',   icon:'🦹', pos:[9,-5],  st:'幽州', open:true,  kind:'dungeon', desc:'黑山军据守的险寨' },
      { id:'build_test',name:'建造场',   icon:'🔨', pos:[7,8],   st:'豫州', open:true,  kind:'camp',    desc:'木工台与测试营地' },
      { id:'chang_an',  name:'长安',     icon:'🏯', pos:[2,2],   st:'司隶', open:false, kind:'city',    desc:'西京长安，龙脉所在' },
      { id:'ye',        name:'邺城',     icon:'🏯', pos:[9,1],   st:'冀州', open:false, kind:'city',    desc:'冀州州治，铜雀台起' },
      { id:'jinyang',   name:'晋阳',     icon:'🏯', pos:[3,0],   st:'并州', open:false, kind:'city',    desc:'并州州治，表里山河' },
      { id:'chengdu',   name:'成都',     icon:'🏯', pos:[1,11],  st:'益州', open:false, kind:'city',    desc:'益州州治，天府之国' },
      { id:'xiangyang', name:'襄阳',     icon:'🏯', pos:[6,10],  st:'荆州', open:false, kind:'city',    desc:'荆州北门锁钥' },
      { id:'shouchun',  name:'寿春',     icon:'🏯', pos:[12,11], st:'扬州', open:false, kind:'city',    desc:'淮南重镇，锁钥江淮' },
      { id:'linzi',     name:'临淄',     icon:'🏯', pos:[14,4],  st:'青州', open:false, kind:'city',    desc:'青州州治，齐都故地' },
      { id:'xiapi',     name:'下邳',     icon:'🏯', pos:[16,8],  st:'徐州', open:false, kind:'city',    desc:'徐州州治，古邳名邑' },
      { id:'fanyu',     name:'番禺',     icon:'🏯', pos:[4,17],  st:'交州', open:false, kind:'city',    desc:'交州州治，岭南都会' },
      { id:'wuwei',     name:'武威',     icon:'🏯', pos:[-4,4],  st:'凉州', open:false, kind:'city',    desc:'河西咽喉，凉州重镇' }
    ],

    // 节点分色覆盖（未列出者按房间 id 前缀自动推断：ys_→教学、ji_heishan_→贼巢、
    //                 baitan_/渔阳四门→军屯、ji_/yuyang_→城镇、其余→野外）
    kinds: {
      forest:'wild', build_test:'wild', stream:'town', camp:'camp',
      forest_patrol_a:'wild', forest_patrol_b:'wild', forest_patrol_c:'wild',
      yanshan_shankou:'wild', yanshan_feng:'wild', yanshan_jian:'wild',
      yanshan_lindao:'wild', yanshan_xueling:'wild', yanshan_zhandao:'wild',
      ji_liumin:'wild', ji_mashi:'wild',
      ji_tian:'wild', ji_xiaoshulin:'wild', ji_huangdi:'wild', ji_senlin:'wild',
      ji_xiaoqiu:'wild', ji_huangshan:'wild',
      luoyang:'city'
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.MAP;
})(typeof window !== 'undefined' ? window : globalThis);

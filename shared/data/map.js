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
//   （states 州域轮廓已废弃：州域几何统一由 shared/data/region.geojson 提供，避免与战略图双份维护）
//   LF.MAP.zones    [ { id, name, icon, pos:[col,row], st:所属州, open:是否已开放, kind, desc } ]  区域节点
// 自愈约定：不在 coords 中的房间，引擎会自动依据其任一有坐标出口的方位就近生成坐标，
//           因此新增房间时若懒得给坐标，地图也不会失配。
// 州名 label：均为相对多边形质心的小偏移（|dx|,|dy| ≤ 1 格），确保州名落在州内，
//             不再被推飞到邻州区域（避免 v20260821k 之前"label 偏移过大压邻州"的问题）。
// 参考：东汉十三州示意图（用户提供的 ScreenShot_2026-08-21_230620_978.png）
(function(global){
  global.LF = global.LF || {};
  global.LF.MAP = {
    cell: 46,   // 单格像素（容纳十三州后压缩格距，房间层缩放范围更大）
    li: 60,     // 1 格 = 60 里

    coords: {
      // ── 中原 · 颍川（初开之地；颍川城为网格城根）──
      city:[6,6.5], build_test:[7,8], combat_test:[8,8],
      luoyang:[5,4],   // 洛阳（司隶州治，网格城根）
      // ── 幽州 · 渔阳（网格城根，仅留城门根房）──
      yuyang_guomen:[14,-1],
      // ── 苦役营教学切片（锚点·保留手写）──
      camp_wall:[16,-9], camp_yard:[17,-9], camp_cell:[17,-10],
      // ── 林径（手写连接：苦役营 ↔ 黑山寨）──
      lindao:[13,-7],
      // ── 黑山寨（锚点·保留手写）──
      ji_heishan_zhai:[9,-5], ji_heishan_juyi:[9,-6], ji_heishan_houzhai:[9,-7],
      // ── 蓟城（网格城根，仅留城门根房）──
      ji_guomen:[9,3],
      // ── 十三州州治所（网格城根；房间见 rooms.js）──
      ye:[10,5],        // 冀州 · 邺城
      changyi:[11,7],   // 兖州 · 昌邑
      xiapi:[16,8],     // 徐州 · 下邳
      linzi:[14,4],     // 青州 · 临淄
      xiangyang:[6,10], // 荆州 · 襄阳
      shouchun:[12,11], // 扬州 · 寿春
      chengdu:[1,11],   // 益州 · 成都
      wuwei:[-10,8],    // 凉州 · 武威
      jinyang:[3,-5],   // 并州 · 晋阳
      fanyu:[4,17],     // 交州 · 番禺
      chang_an:[2,5],    // 司隶 · 长安（西京）
      jianye:[14,12],    // 扬州 · 建业（孙吴都）
      hanzhong:[3,7],    // 益州 · 汉中
      jiangling:[6,13],  // 荆州 · 江陵（南郡）
      xiangping:[16,-3], // 幽州 · 襄平（辽东）
      xuchang:[8,6]      // 豫州 · 许都（帝都）
    },

    // 特殊地点·地理坐标真相源（与上方 coords 网格坐标一一对应，单文件维护；战略图用 geo[pos:lng,lat]，势力图用 coords[col,row]，两坐标系不同但指向同一房间）
    specialGeo: {
      camp_yard:       { name:'苦役营', pos:[114.5, 36.6], color:'#9b59b6', desc:'新手教程·苦役营' },
      ji_heishan_zhai: { name:'黑山寨', pos:[114.2, 35.7], color:'#e67e22', desc:'剿匪支线·黑山寨' },
    },

    // 外围地貌（光荣《三国志》风：十三州之外有海/草原/沙漠环绕，不留空）
    // kind: sea(海) / grass(草原塞外) / desert(西域沙漠)；cx,cy 为中心（世界坐标），rx,ry 为半径
    terrains: [
      { t:'东 海', kind:'sea',   cx:21,  cy:3,   rx:6,   ry:10 },
      { t:'南 海', kind:'sea',   cx:6,   cy:22,  rx:16,  ry:5  },
      { t:'渤 海', kind:'sea',   cx:18,  cy:6.5, rx:3.2, ry:3  },
      { t:'塞 外', kind:'grass', cx:3,   cy:-13, rx:16,  ry:6  },
      { t:'西 域', kind:'desert',cx:-11, cy:2,   rx:6,   ry:10 }
    ],

    // 区域底色（叠加在节点连线之下；r 为像素半径，随 cell 缩放）
    regions: [
      { t:'中 原',  c:'rgba(120,160,96,.18)',  center:[6,7],   r:82 },
      { t:'洛 阳',  c:'rgba(196,160,70,.18)',  center:[5,4],   r:62 },
      { t:'渔 阳',  c:'rgba(120,150,200,.13)', center:[14,-4], r:105 },

      { t:'幽 州',  c:'rgba(96,140,190,.16)',  center:[11,-5], r:245 },
      { t:'黑 山',  c:'rgba(90,86,80,.14)',    center:[9,-5],  r:85 }
    ],


    // 区域层节点：州内城池 / 要地（open=true 表示该地已有实际内容，未开放的名城以暗色占位）
    zones: [
      // 区域节点（黑山寨/建造场/演武场等手写要地）；城市州治不再在此维护，
      // 由 cities.js + coords 作唯一真相源（见 shared/data/cities.js 与 map.js 的 coords）。
      { id:'heishan',   name:'黑山寨',   icon:'🦹', pos:[9,-5],  st:'幽州', open:true,  kind:'dungeon', desc:'黑山军据守的险寨' },
      { id:'build_test',name:'建造场',   icon:'🔨', pos:[7,8],   st:'豫州', open:true,  kind:'camp',    desc:'木工台与测试营地' },
      { id:'combat_test',name:'演武场',   icon:'⚔️', pos:[8,8],   st:'豫州', open:true,  kind:'camp',    desc:'试炼坪·可试诸般敌手' }
    ],

    // 山脉/海岸美术现由 assets/map_inkwash.jpg 水墨山水底图承担（见 index.html .map-canvas 背景）

    // 节点分色覆盖（未列出者按房间 id 前缀自动推断：ji_heishan_→贼巢、ji_/yuyang_→城镇、其余→野外）
    kinds: {
      build_test:'wild', combat_test:'wild', luoyang:'city',
      lindao:'wild'
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LF.MAP;
})(typeof window !== 'undefined' ? window : globalThis);
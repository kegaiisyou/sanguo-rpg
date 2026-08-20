// 大地图数据（外置，便于随时增改房间坐标 / 区域 / 图例，无需改动引擎代码）
// 结构：
//   LF.MAP.cell     单格像素
//   LF.MAP.li       1 格 = 多少里（图例刻度）
//   LF.MAP.coords   { roomId: [列col, 行row] }  列东正西负、行北负南正（负坐标=北上方向）
//   LF.MAP.regions  [ { t:标签, c:底色, center:[col,row], r:半径px } ]
//   LF.MAP.kinds    { roomId: 'city|wild|dungeon|fort|tutorial|town|camp' }  节点分色覆盖
// 自愈约定：不在 coords 中的房间，引擎会自动依据其任一有坐标出口的方位就近生成坐标，
//           因此新增房间时若懒得给坐标，地图也不会失配。
(function(global){
  global.LF = global.LF || {};
  global.LF.MAP = {
    cell: 92,   // 单格像素
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

    // 区域底色（叠加在节点连线之下）
    regions: [
      { t:'中 原',  c:'rgba(120,160,96,.18)',  center:[6,7],   r:165 },
      { t:'洛 阳',  c:'rgba(196,160,70,.18)',  center:[6,3],   r:130 },
      { t:'渔 阳',  c:'rgba(120,150,200,.13)', center:[14,-3], r:165 },
      { t:'白 檀',  c:'rgba(150,128,88,.13)',  center:[14,-6], r:135 },
      { t:'燕 山',  c:'rgba(110,140,110,.14)', center:[14,-9], r:155 },
      { t:'幽 州',  c:'rgba(96,140,190,.16)',  center:[10,-0.5], r:470 },
      { t:'黑 山',  c:'rgba(90,86,80,.14)',    center:[9,-5],  r:170 }
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

# -*- coding: utf-8 -*-
# 校验 map.js 的十三州多边形是否完全贴合（无缝隙、无重叠）以及房间归属
STATES = {
 'liang': [[-8,-5],[-2,-5],[-2,-3],[-1,3],[-5,3],[-8,1]],          # 凉州
 'bing':  [[-2,-8],[6,-8],[6,-2],[-2,-3]],                          # 并州
 'sili':  [[-2,-3],[6,-2],[6,6],[3,6],[0,5],[-1,3]],                # 司隶
 'you':   [[6,-14],[18,-14],[18,3],[17,3],[13,4],[9,4],[6,1]],      # 幽州(南界含蓟城)
 'ji':    [[6,1],[9,4],[13,4],[13,6],[6,6]],                        # 冀州
 'qing':  [[13,4],[17,3],[17,7],[13,6]],                            # 青州
 'yan':   [[9,6],[13,6],[13,9],[9,9]],                              # 兖州
 'yu':    [[3,6],[9,6],[9,9],[5,9],[3,7]],                          # 豫州
 'xu':    [[13,6],[17,7],[18,10],[13,10],[13,9]],                   # 徐州(西界贴兖州)
 'yang':  [[9,9],[13,10],[18,10],[18,14],[9,14]],                   # 扬州
 'jing':  [[3,7],[5,9],[9,9],[9,14],[3,14]],                        # 荆州
 'yi':    [[-8,1],[-5,3],[-1,3],[0,5],[3,6],[3,14],[-5,14],[-5,9]], # 益州
 'jiao':  [[-5,14],[18,14],[18,20],[-5,20]],                        # 交州
}

def edges(poly):
    out=[]; n=len(poly)
    for i in range(n):
        a,b=poly[i],poly[(i+1)%n]
        out.append((tuple(sorted([tuple(a),tuple(b)]))))
    return out

all_edges={}
for sid,pol in STATES.items():
    for e in edges(pol):
        all_edges.setdefault(e,[]).append(sid)
bad=[e for e,s in all_edges.items() if len(s)>2]
print("=== 边配对 ===")
print("总边数:", len(all_edges), "| 出现3次+ (异常):", len(bad), bad[:5])
outer=[e for e,s in all_edges.items() if len(s)==1]
print("外轮廓边:", len(outer), "| 共享州界边:", len(all_edges)-len(outer)-len(bad))
# 外轮廓边(内部不可见)应位于疆域矩形边界或塞外一侧
def is_boundary(e):
    for p in e:
        c,r=p
        if c in (-8,18) or r in (-14,20): return True
    return False
notb=[e for e in outer if not is_boundary(e)]
print("不在疆域矩形上的外轮廓边(属塞外留白，可接受):", len(notb))

def pip(p, poly):
    x,y=p; n=len(poly); inside=False; j=n-1
    for i in range(n):
        xi,yi=poly[i]; xj,yj=poly[j]
        if ((yi>y)!=(yj>y)) and (x < (xj-xi)*(y-yi)/(yj-yi)+xi):
            inside=not inside
        j=i
    return inside

print("\n=== 网格采样(步长1) 州间缝隙/重叠 ===")
gap=[]; ov=[]
for c in range(-8,19):
    for r in range(-14,21):
        hit=[s for s,pol in STATES.items() if pip((c+0.5,r+0.5),pol)]
        if not hit: gap.append((c,r))
        elif len(hit)>1: ov.append((c,r,hit))
print("缝隙点:", len(gap), "示例:", gap[:10])
print("重叠点:", len(ov), "示例:", ov[:10])

ZONE_NAMES={'liang':'凉州','bing':'并州','sili':'司隶','you':'幽州','ji':'冀州','qing':'青州',
            'yan':'兖州','yu':'豫州','xu':'徐州','yang':'扬州','jing':'荆州','yi':'益州','jiao':'交州'}

ROOMS = {
  # 中原·颍川
  'camp':[6,7], 'city':[6,6], 'stream':[5,7], 'forest':[7,7], 'build_test':[7,8],
  'luoyang':[5,4],
  'forest_patrol_a':[8,7], 'forest_patrol_b':[8,6], 'forest_patrol_c':[8,8],
  # 渔阳（拉距后）
  'yuyang_guomen':[14,-1], 'yuyang_nanmen':[14,-3], 'yuyang_tongqu':[14,-5], 'yuyang_beimen':[14,-7],
  'yuyang_xishijie':[12,-5], 'yuyang_junya':[12,-7], 'yuyang_junying':[11,-5], 'yuyang_yiguan':[11,-7],
  'yuyang_dongshijie':[16,-5], 'yuyang_dashi':[17,-5], 'yuyang_jiulou':[16,-7], 'yuyang_chasi':[16,-3],
  # 白檀
  'baitan_yingmen':[14,-5], 'baitan_tun':[14,-6], 'baitan_tian':[13,-6], 'baitan_ma':[15,-6],
  'baitan_cang':[13,-7], 'baitan_liao':[15,-7],
  # 燕山
  'yanshan_shankou':[14,-8], 'yanshan_feng':[15,-8], 'yanshan_jian':[13,-8],
  'yanshan_lindao':[14,-9], 'yanshan_xueling':[15,-9], 'yanshan_zhandao':[13,-9],
  # 教学村
  'ys_entrance':[14,-11], 'ys_north':[14,-12], 'ys_ne':[15,-12], 'ys_east':[15,-11],
  'ys_se':[15,-10], 'ys_south':[14,-10], 'ys_sw':[13,-10], 'ys_west':[13,-11], 'ys_nw':[13,-12],
  # 苦役营（移东）
  'camp_wall':[16,-8], 'camp_yard':[17,-8], 'camp_cell':[18,-8],
  # 渔阳大市保持东界

  # 蓟城
  'ji_guomen':[9,3], 'ji_liumin':[8,3], 'ji_mashi':[13,3], 'ji_nanmen':[9,2],
  'ji_tongqu':[9,1], 'ji_beimen':[9,0], 'ji_xishijie':[8,1], 'ji_dongshijie':[10,1],
  'ji_zhoumu':[8,0], 'ji_lianwu':[7,0], 'ji_junying':[7,1], 'ji_yiguan':[7,2], 'ji_junya':[8,2],
  'ji_dashi':[11,1], 'ji_xuegong':[11,0], 'ji_jiulou':[10,0], 'ji_chasi':[10,2],
  'ji_minli':[12,1], 'ji_minju':[12,0], 'ji_minju2':[12,2],
  # 蓟城北通道 / 黑山
  'ji_tian':[9,-1], 'ji_xiaoshulin':[10,-1], 'ji_huangdi':[9,-2], 'ji_senlin':[10,-2],
  'ji_xiaoqiu':[9,-3], 'ji_huangshan':[9,-4],
  'ji_heishan_zhai':[9,-5], 'ji_heishan_juyi':[9,-6], 'ji_heishan_houzhai':[9,-7],
}
EXPECT = {
  '豫州':['camp','city','stream','forest','build_test','forest_patrol_a','forest_patrol_b','forest_patrol_c'],
  '司隶':['luoyang'],
  '幽州':['yuyang_guomen','yuyang_nanmen','yuyang_tongqu','yuyang_beimen','yuyang_xishijie','yuyang_junya',
          'yuyang_junying','yuyang_yiguan','yuyang_dongshijie','yuyang_dashi','yuyang_jiulou','yuyang_chasi',
          'baitan_yingmen','baitan_tun','baitan_tian','baitan_ma','baitan_cang','baitan_liao',
          'yanshan_shankou','yanshan_feng','yanshan_jian','yanshan_lindao','yanshan_xueling','yanshan_zhandao',
          'ys_entrance','ys_north','ys_ne','ys_east','ys_se','ys_south','ys_sw','ys_west','ys_nw',
          'camp_wall','camp_yard','camp_cell','ji_guomen','ji_liumin','ji_mashi','ji_nanmen','ji_tongqu',
          'ji_beimen','ji_xishijie','ji_dongshijie','ji_zhoumu','ji_lianwu','ji_junying','ji_yiguan','ji_junya',
          'ji_dashi','ji_xuegong','ji_jiulou','ji_chasi','ji_minli','ji_minju','ji_minju2',
          'ji_tian','ji_xiaoshulin','ji_huangdi','ji_senlin','ji_xiaoqiu','ji_huangshan',
          'ji_heishan_zhai','ji_heishan_juyi','ji_heishan_houzhai'],
}
print("\n=== 房间归属 ===")
bad=[]
for rid,pos in ROOMS.items():
    hits=[s for s,pol in STATES.items() if pip(pos,pol)]
    name=ZONE_NAMES.get(hits[0],'?') if hits else '无州域'
    for exp,rs in EXPECT.items():
        if rid in rs and exp!=name:
            bad.append((rid,pos,name,exp))
    if not hits:
        bad.append((rid,pos,'无州域',''))
print("归属错误:", len(bad))
for b in bad: print("  ", b)

ZONES={'yingchuan':[6,7],'luoyang':[5,4],'jicheng':[9,2],'yuyang':[14,-3],'baitan':[14,-6],
 'yanshan':[14,-9],'heishan':[9,-5],'build_test':[7,8],
 'chang_an':[2,2],'ye':[10,5],'jinyang':[3,-5],'chengdu':[1,11],'xiangyang':[6,10],
 'shouchun':[12,11],'linzi':[14,4],'xiapi':[16,8],'fanyu':[4,17],'wuwei':[-4,1]}
print("\n=== zones 归属 ===")
for zid,pos in ZONES.items():
    hits=[s for s,pol in STATES.items() if pip(pos,pol)]
    print(" ", zid, pos, "->", ZONE_NAMES.get(hits[0],'无州域') if hits else '无州域')

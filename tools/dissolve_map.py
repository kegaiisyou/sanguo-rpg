#!/usr/bin/env python3
# 构建期：把 region.geojson 的郡多边形按 州/势力/郡 分别 dissolve 合并，
# 并用 difference 做分区，消除郡之间互相重叠导致的双线/色块，生成干净的 map_regions.geojson。
import json, re
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

SRC = 'shared/data/region.geojson'
CITIES = 'shared/data/cities.js'
OUT = 'shared/data/map_regions.geojson'
TOL = 0.025  # 抽稀容差(度)

g = json.load(open(SRC, encoding='utf-8'))
feats = g['features']

# 从 cities.js 解析 name -> (state, owner)
txt = open(CITIES, encoding='utf-8').read()
name_pos = [m.start() for m in re.finditer(r"name\s*:\s*'([^']+)'", txt)]
info = {}
for i, pos in enumerate(name_pos):
    end = name_pos[i+1] if i+1 < len(name_pos) else len(txt)
    seg = txt[pos:end]
    nm = re.search(r"name\s*:\s*'([^']+)'", seg).group(1)
    st = re.search(r"state\s*:\s*'([^']+)'", seg)
    ow = re.search(r"owner\s*:\s*'([^']+)'", seg)
    info[nm] = (st.group(1) if st else '未知', ow.group(1) if ow else 'none')

polys, meta = {}, {}
for f in feats:
    nm = f['properties']['city']
    st, ow = info.get(nm, ('未知', 'none'))
    p = shape(f['geometry']).buffer(0)
    polys[nm] = p
    meta[nm] = (st, ow)

all_polys = list(polys.values())
all_union = unary_union(all_polys)

def partition(groups):
    """每个分组减去其余所有区域，得到互不重叠的分区。"""
    out = {}
    for k, g in groups.items():
        out[k] = g.difference(all_union.difference(g))
    return out

# 州（province）
state_groups = {}
for nm, (st, ow) in meta.items():
    state_groups.setdefault(st, []).append(polys[nm])
prov_union = {st: unary_union(pl) for st, pl in state_groups.items()}
prov_terr = partition(prov_union)

# 势力（faction）
order = ['wei', 'shu', 'wu', 'contested', 'none']
fac_groups = {}
for nm, (st, ow) in meta.items():
    fac_groups.setdefault(ow, []).append(polys[nm])
fac_union = {ow: unary_union(pl) for ow, pl in fac_groups.items()}
fac_terr = partition({ow: fac_union[ow] for ow in order if ow in fac_union})

# 郡（commandery）：小郡优先保留，大郡减去已被小郡占用的部分，得到干净非重叠郡面
sorted_ids = sorted(polys.keys(), key=lambda nm: polys[nm].area)
covered = None
cmd_terr = {}
for nm in sorted_ids:
    p = polys[nm]
    if covered is not None:
        p = p.difference(covered)
    if not p.is_empty:
        cmd_terr[nm] = p
    covered = p if covered is None else covered.union(p)

def simp(geom):
    return geom.simplify(TOL, preserve_topology=True)

fc = {'type': 'FeatureCollection', 'features': []}
for st, geom in prov_terr.items():
    if not geom.is_empty:
        fc['features'].append({'type': 'Feature', 'properties': {'layer': 'province', 'state': st},
                               'geometry': mapping(simp(geom))})
for ow, geom in fac_terr.items():
    if not geom.is_empty:
        fc['features'].append({'type': 'Feature', 'properties': {'layer': 'faction', 'faction': ow},
                               'geometry': mapping(simp(geom))})
for nm, geom in cmd_terr.items():
    if not geom.is_empty:
        st, ow = meta[nm]
        fc['features'].append({'type': 'Feature',
                               'properties': {'layer': 'commandery', 'id': nm, 'name': nm, 'state': st, 'faction': ow},
                               'geometry': mapping(simp(geom))})

json.dump(fc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('provinces:', len(prov_terr), '| factions:', len(fac_terr), '| commanderies:', len(cmd_terr),
      '| total features:', len(fc['features']))
print('states:', sorted(prov_terr.keys()))
print('factions:', sorted(fac_terr.keys()))

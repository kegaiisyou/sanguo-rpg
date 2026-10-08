// ===== 战略地图 · 几何基础算法（v20261008g 从 strategic-map.js 拆出）=====
//  原 strategic-map.js 66-160 行：convexHull / segIntersect / pointSegDist /
//  concaveHull / smoothClosedRing / rdpSimplify / simplifyRing。
//  纯几何算法（只依赖 Math，不碰 DOM、不依赖 d3 与投影实例、零外部依赖），
//  拆出后 strategic-map.js 只留地图渲染与交互，职责更清晰、便于单独调试。
//
//  ⚠️ 加载：本文件【不在 bundle】，与 d3 / map_regions / strategic-map 同属山河志懒加载套件
//     （现为四件套），见 index.html 的 window.__MAP_ASSETS 与 engine.js 的 ensureStrategicMap()。
//     必须**先于** strategic-map.js 加载（sm 顶层即取本文件别名）。
(function (global) {
  if (!global.LF) global.LF = {};

  function convexHull(pts) {
    if (pts.length < 3) return pts;
    const p = pts.slice().sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const pt of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop(); lower.push(pt); }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) { const pt = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop(); upper.push(pt); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }
  function segIntersect(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return o1 !== o2 && o3 !== o4;
  }
  function pointSegDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }
  // 凹包：从凸包出发，反复把过长的边用最近的外部点内凹替换，得到贴合郡分布的自然轮廓
  function concaveHull(pts, maxLen) {
    if (pts.length < 3) return pts.slice();
    let hull = convexHull(pts);
    let guard = 0, changed = true;
    while (changed && guard++ < 4000) {
      changed = false;
      for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= maxLen) continue;
        let best = null, bestD = Infinity;
        for (const p of pts) {
          if (hull.indexOf(p) !== -1) continue;
          const dd = pointSegDist(p, a, b);
          if (dd < bestD) { bestD = dd; best = p; }
        }
        if (!best) break;
        let ok = true;
        for (let j = 0; j < hull.length; j++) {
          if (j === i || (j + 1) % hull.length === i || j === (i + 1) % hull.length) continue;
          if (segIntersect(a, best, hull[j], hull[(j + 1) % hull.length]) ||
              segIntersect(best, b, hull[j], hull[(j + 1) % hull.length])) { ok = false; break; }
        }
        if (ok) { hull.splice(i + 1, 0, best); changed = true; break; }
      }
    }
    return hull;
  }
  // 闭合环 + Catmull-Rom 平滑，让州界呈自然手绘曲线
  function smoothClosedRing(ring, subdiv) {
    const n = ring.length;
    if (n < 3) return ring.slice();
    subdiv = subdiv || 6;
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = ring[(i - 1 + n) % n], p1 = ring[i], p2 = ring[(i + 1) % n], p3 = ring[(i + 2) % n];
      for (let j = 0; j < subdiv; j++) {
        const t = j / subdiv, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([x, y]);
      }
    }
    out.push(out[0].slice());
    return out;
  }
  // 道格拉斯-普克抽稀：去掉郡多边形上过密的锯齿顶点
  function rdpSimplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [s, e] = stack.pop();
      let maxD = 0, idx = -1;
      for (let i = s + 1; i < e; i++) {
        const d = pointSegDist(pts[i], pts[s], pts[e]);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps && idx !== -1) { keep[idx] = true; stack.push([s, idx]); stack.push([idx, e]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function simplifyRing(ring, tol) {
    if (!ring || ring.length < 4) return ring ? ring.slice() : ring;
    const open = (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
      ? ring.slice(0, -1) : ring.slice();
    const simp = rdpSimplify(open, tol);
    if (simp.length < 3) return ring.slice();
    return simp.concat([simp[0]]);
  }
  global.LF.StratGeom = {
    convexHull: convexHull, segIntersect: segIntersect, pointSegDist: pointSegDist,
    concaveHull: concaveHull, smoothClosedRing: smoothClosedRing,
    rdpSimplify: rdpSimplify, simplifyRing: simplifyRing
  };
})(typeof window !== 'undefined' ? window : globalThis);

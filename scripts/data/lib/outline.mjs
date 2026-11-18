// Outlines traced around a field of values: marching squares, then the loops simplified and softened. The dungeon and
// raid floor plans (scripts/data/maps.mjs) and the zone maps (scripts/data/zone-maps.mjs) are both drawn with it.

/** Marching squares over a grid of values, at threshold t: closed loops of [x, y] in grid units. */
export function contours(g, nx, ny, t) {
  const segs = [];
  const v = (i, j) => g[j * nx + i];
  const lerp = (a, b) => (t - a) / (b - a);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      const idx = (a >= t ? 8 : 0) | (b >= t ? 4 : 0) | (c >= t ? 2 : 0) | (d >= t ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const top = [i + lerp(a, b), j];
      const right = [i + 1, j + lerp(b, c)];
      const bottom = [i + lerp(d, c), j + 1];
      const left = [i, j + lerp(a, d)];
      const add = (p, q) => segs.push([p, q]);
      switch (idx) {
        case 1: add(left, bottom); break;
        case 2: add(bottom, right); break;
        case 3: add(left, right); break;
        case 4: add(top, right); break;
        case 5: add(left, top); add(bottom, right); break;
        case 6: add(top, bottom); break;
        case 7: add(left, top); break;
        case 8: add(top, left); break;
        case 9: add(top, bottom); break;
        case 10: add(top, right); add(bottom, left); break;
        case 11: add(top, right); break;
        case 12: add(right, left); break;
        case 13: add(right, bottom); break;
        case 14: add(bottom, left); break;
      }
    }
  }
  // link segments into loops: each end point is shared by exactly two segments, whichever way they point
  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const ends = new Map();
  segs.forEach((sg, n) => {
    for (const e of sg) {
      const k = key(e);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(n);
    }
  });
  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const loop = [segs[n][0], segs[n][1]];
    const start = key(loop[0]);
    let end = segs[n][1];
    for (let guard = 0; guard < 200000; guard++) {
      const k = key(end);
      const next = (ends.get(k) ?? []).find((m) => !used[m]);
      if (next === undefined) break;
      used[next] = 1;
      const sg = segs[next];
      end = key(sg[0]) === k ? sg[1] : sg[0];
      if (key(end) === start) break;
      loop.push(end);
    }
    if (loop.length >= 6) loops.push(loop);
  }
  return loops;
}

/** Ramer–Douglas–Peucker on a closed loop. */
export function simplify(loop, eps) {
  const rdp = (pts) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let dmax = 0, idx = 0;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
      if (d > dmax) (dmax = d), (idx = i);
    }
    if (dmax <= eps) return [a, b];
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))];
  };
  const half = Math.floor(loop.length / 2);
  return [...rdp(loop.slice(0, half + 1)).slice(0, -1), ...rdp([...loop.slice(half), loop[0]]).slice(0, -1)];
}

/** Two rounds of Chaikin's corner cutting: soft, cave-like edges. */
export function smooth(loop, rounds = 2) {
  let p = loop;
  for (let r = 0; r < rounds; r++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

export const area = (loop) => {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};

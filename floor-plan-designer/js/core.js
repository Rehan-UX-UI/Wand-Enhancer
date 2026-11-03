/*
 * Core geometry & computed model.
 *
 * Coordinate system (model space, FEET):
 *   origin (0,0) = rear-left corner of the plot
 *   +x  -> across the plot frontage (0 .. 32 ft)
 *   +y  -> toward the road / front of the plot (0 .. 50 ft)
 *
 * Drawing space: SCALE = 12 SVG units per foot (1 SVG unit = 1 inch), so the
 * plot is exactly 384 x 600 units. Every wall, door, furniture item and
 * dimension is derived from the same model coordinates, so zoom and export
 * never distort proportions.
 *
 * Rooms are rectangles placed on a shared structural grid (their edges are wall
 * centre-lines). Walls are generated from room adjacency:
 *   - edge on the plot boundary          -> 9" external wall, laid fully INSIDE the plot
 *   - edge between two enclosed rooms    -> 4.5" partition, centred on the line
 *   - edge between a room and open space -> 9" external wall, centred on the line
 *   - edge next to a ventilation shaft   -> 4.5" wall
 *   - open space on plot boundary        -> 4.5" boundary wall (GF) / parapet (FF)
 */
(function (FP) {
  'use strict';

  const PLOT = Object.freeze({ w: 32, d: 50 });
  const SCALE = 12;
  const WALL = Object.freeze({ ext: 0.75, int: 0.375, boundary: 0.375, parapet: 0.375, shaft: 0.375 });
  const OPEN_TYPES = new Set(['porch', 'lawn', 'court', 'shaft', 'terrace', 'balcony']);
  const VOID_TYPES = new Set(['court', 'shaft']);
  const HABITABLE = new Set(['bed', 'living', 'drawing', 'kitchen', 'study']);
  const WET = new Set(['bath', 'kitchen', 'laundry']);
  const PASSABLE = new Set(['door', 'door2', 'open', 'slide', 'gate']);
  const SWINGING = new Set(['door', 'door2']);
  const SIDES = ['n', 's', 'w', 'e'];
  const EPS = 1e-6;

  const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const uniq = (arr) => [...new Set(arr.map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
  const u = (ft) => +(ft * SCALE).toFixed(2); // feet -> SVG units

  /** Format feet as architectural feet-inches, half-inch precision: 12'-4½" */
  function fmt(ft) {
    const sign = ft < 0 ? '-' : '';
    const halfInches = Math.round(Math.abs(ft) * 24);
    const feet = Math.floor(halfInches / 24);
    const rem = (halfInches - feet * 24) / 2;
    const whole = Math.floor(rem);
    const inch = rem % 1 ? (whole ? whole : '') + '½' : String(whole);
    return `${sign}${feet}'-${inch}"`;
  }
  const fmtArea = (sqft) => `${Math.round(sqft).toLocaleString('en-US')} sq ft`;

  const isOpen = (r) => OPEN_TYPES.has(r.type);
  const isVoid = (r) => VOID_TYPES.has(r.type);
  const rw = (r) => r.r[2] - r.r[0];
  const rh = (r) => r.r[3] - r.r[1];

  function rectIntersect(a, b) {
    const x0 = Math.max(a.x0, b.x0), y0 = Math.max(a.y0, b.y0);
    const x1 = Math.min(a.x1, b.x1), y1 = Math.min(a.y1, b.y1);
    return x1 > x0 + EPS && y1 > y0 + EPS ? { x0, y0, x1, y1, area: (x1 - x0) * (y1 - y0) } : null;
  }
  const toRect = (r) => ({ x0: r.r[0], y0: r.r[1], x1: r.r[2], y1: r.r[3] });
  const rectInside = (inner, outer, tol = 0.02) =>
    inner.x0 >= outer.x0 - tol && inner.y0 >= outer.y0 - tol && inner.x1 <= outer.x1 + tol && inner.y1 <= outer.y1 + tol;

  /** Edge of a room on a given side. `out` is the sign of the outward normal. */
  function edgeOf(r, side) {
    const [x0, y0, x1, y1] = r.r;
    switch (side) {
      case 'n': return { axis: 'h', c: y0, a: x0, b: x1, out: -1 };
      case 's': return { axis: 'h', c: y1, a: x0, b: x1, out: 1 };
      case 'w': return { axis: 'v', c: x0, a: y0, b: y1, out: -1 };
      case 'e': return { axis: 'v', c: x1, a: y0, b: y1, out: 1 };
      default: throw new Error('bad side ' + side);
    }
  }
  const onPlotBoundary = (axis, c) =>
    axis === 'h' ? near(c, 0) || near(c, PLOT.d) : near(c, 0) || near(c, PLOT.w);
  const isSideBoundary = (axis, c) => axis === 'v' && (near(c, 0) || near(c, PLOT.w));
  const pointOnLine = (axis, c, t, off) => (axis === 'h' ? [t, c + off] : [c + off, t]);

  function roomAt(rooms, x, y) {
    return rooms.find((r) => x > r.r[0] + EPS && x < r.r[2] - EPS && y > r.r[1] + EPS && y < r.r[3] - EPS) || null;
  }

  /* ---------------------------------------------------------------- walls */

  function buildWallSegments(rooms, level) {
    const xs = uniq(rooms.flatMap((r) => [r.r[0], r.r[2]]));
    const ys = uniq(rooms.flatMap((r) => [r.r[1], r.r[3]]));
    const segs = [];
    const seen = new Set();
    for (const r of rooms) {
      for (const side of SIDES) {
        const e = edgeOf(r, side);
        const inner = (e.axis === 'h' ? xs : ys).filter((v) => v > e.a + EPS && v < e.b - EPS);
        const bps = [e.a, ...inner, e.b];
        for (let i = 0; i < bps.length - 1; i++) {
          const p = bps[i], q = bps[i + 1];
          const boundary = onPlotBoundary(e.axis, e.c);
          const [px, py] = pointOnLine(e.axis, e.c, (p + q) / 2, e.out * 0.05);
          const nb = boundary ? null : roomAt(rooms, px, py);
          let kind = null, t = 0, center = e.c;
          if (!isOpen(r)) {
            if (boundary) { kind = 'ext'; t = WALL.ext; center = e.c - e.out * t / 2; }
            else if (nb && !isOpen(nb)) { kind = 'int'; t = WALL.int; }
            else if (nb && nb.type === 'shaft') { kind = 'ext'; t = WALL.shaft; }
            else { kind = 'ext'; t = WALL.ext; }
          } else if (boundary) {
            kind = level === 0 ? 'boundary' : 'parapet';
            t = WALL.boundary;
            center = e.c - e.out * t / 2;
          } else if (!nb) {
            if (level > 0) { kind = 'parapet'; t = WALL.parapet; center = e.c - e.out * t / 2; }
          } else if (isOpen(nb) && level > 0 && !isVoid(r) && isVoid(nb)) {
            kind = 'parapet'; t = WALL.parapet; center = e.c - e.out * t / 2;
          }
          if (!kind) continue;
          const key = `${e.axis}|${e.c.toFixed(3)}|${p.toFixed(3)}|${q.toFixed(3)}|${center.toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          segs.push({ axis: e.axis, c: e.c, a: p, b: q, t, center, kind });
        }
      }
    }
    return segs;
  }

  function segAt(segs, axis, c, t) {
    return segs.find((s) => s.axis === axis && near(s.c, c) && t >= s.a - EPS && t <= s.b + EPS) || null;
  }

  function subtractIntervals(lo, hi, cuts) {
    const out = [];
    let cur = lo;
    cuts.sort((m, n) => m[0] - n[0]).forEach(([a, b]) => {
      if (b <= cur || a >= hi) return;
      if (a > cur) out.push([cur, Math.min(a, hi)]);
      cur = Math.max(cur, b);
    });
    if (cur < hi) out.push([cur, hi]);
    return out;
  }

  /** Wall rectangles after cutting door/window openings. Ends are extended by t/2 to close corners. */
  function wallPieces(segs, openings) {
    const pieces = [];
    for (const s of segs) {
      const max = s.axis === 'h' ? PLOT.w : PLOT.d;
      const lo = clamp(s.a - s.t / 2, 0, max), hi = clamp(s.b + s.t / 2, 0, max);
      const cuts = openings.filter((o) => o.axis === s.axis && near(o.c, s.c)).map((o) => [o.a, o.b]);
      for (const [p, q] of subtractIntervals(lo, hi, cuts)) {
        if (q - p < 0.02) continue;
        pieces.push(Object.assign({}, s, { a: p, b: q }));
      }
    }
    return pieces;
  }

  /** Distance from a room edge line to the inner face of the wall on that edge. */
  function insetFor(segs, r, side) {
    const e = edgeOf(r, side);
    let ins = 0;
    for (const s of segs) {
      if (s.axis !== e.axis || !near(s.c, e.c) || s.b <= e.a + EPS || s.a >= e.b - EPS) continue;
      const lo = s.center - s.t / 2, hi = s.center + s.t / 2;
      ins = Math.max(ins, e.out < 0 ? hi - e.c : e.c - lo);
    }
    return Math.max(0, ins);
  }

  function clearRect(segs, r) {
    return {
      x0: r.r[0] + insetFor(segs, r, 'w'),
      y0: r.r[1] + insetFor(segs, r, 'n'),
      x1: r.r[2] - insetFor(segs, r, 'e'),
      y1: r.r[3] - insetFor(segs, r, 's'),
    };
  }

  /* ------------------------------------------------------------- openings */

  function resolveOpenings(rooms, segs) {
    const list = [];
    rooms.forEach((r) => {
      (r.open || []).forEach((o, i) => {
        const e = edgeOf(r, o.side);
        const len = e.b - e.a;
        let start;
        if (o.at === 'c') start = e.a + (len - o.w) / 2;
        else if (Array.isArray(o.at)) start = e.b - o.at[1] - o.w;
        else start = e.a + o.at;
        const mid = start + o.w / 2;
        const seg = segAt(segs, e.axis, e.c, mid);
        const t = seg ? seg.t : WALL.int;
        const center = seg ? seg.center : e.c;
        const swing = o.swing || 'in';
        list.push({
          id: `${r.id}:o${i}`, room: r, kind: o.kind, side: o.side, axis: e.axis, c: e.c,
          a: start, b: start + o.w, w: o.w, hinge: o.hinge || 'start', swing,
          normal: swing === 'out' ? e.out : -e.out, out: e.out, t, center, seg,
          sideBoundary: isSideBoundary(e.axis, e.c), plotBoundary: onPlotBoundary(e.axis, e.c),
        });
      });
    });
    return list;
  }

  /** Area swept by a swinging door leaf (rectangle, model feet). */
  function swingZone(o) {
    if (!SWINGING.has(o.kind)) return null;
    const depth = o.kind === 'door2' ? o.w / 2 : o.w;
    const face = o.normal > 0 ? o.center + o.t / 2 : o.center - o.t / 2;
    const n0 = face, n1 = face + o.normal * depth;
    const lo = Math.min(n0, n1), hi = Math.max(n0, n1);
    return o.axis === 'h' ? { x0: o.a, x1: o.b, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: o.a, y1: o.b };
  }

  /* ------------------------------------------------------------ furniture */

  /**
   * Furniture is authored relative to the room's clear rectangle:
   *   side: wall the item's back is against (n/s/e/w) or 'c' (free, centre fractions)
   *   at:   offset along that wall from its start, 'c' for centred, ['end', n] from the far end
   *   w:    length along the wall ('full' = whole wall), d: depth away from the wall
   */
  function placeFurniture(f, cl) {
    const cw = cl.x1 - cl.x0, ch = cl.y1 - cl.y0;
    const inset = f.inset || 0;
    if (f.side === 'c') {
      const rot = f.rot || 0;
      const swap = rot === 90 || rot === 270;
      const bw = swap ? f.d : f.w, bh = swap ? f.w : f.d;
      const cx = cl.x0 + f.at[0] * cw, cy = cl.y0 + f.at[1] * ch;
      return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, lw: f.w, ld: f.d, rot };
    }
    const L = f.side === 'n' || f.side === 's' ? cw : ch;
    const W = f.w === 'full' ? L : f.w;
    const off = f.at === 'c' ? (L - W) / 2 : Array.isArray(f.at) ? L - f.at[1] - W : f.at;
    switch (f.side) {
      case 'n': return { x: cl.x0 + off, y: cl.y0 + inset, w: W, h: f.d, lw: W, ld: f.d, rot: 0 };
      case 's': return { x: cl.x0 + off, y: cl.y1 - inset - f.d, w: W, h: f.d, lw: W, ld: f.d, rot: 180 };
      case 'w': return { x: cl.x0 + inset, y: cl.y0 + off, w: f.d, h: W, lw: W, ld: f.d, rot: 270 };
      case 'e': return { x: cl.x1 - inset - f.d, y: cl.y0 + off, w: f.d, h: W, lw: W, ld: f.d, rot: 90 };
      default: throw new Error('bad furniture side');
    }
  }

  /* --------------------------------------------------------------- stairs */

  /**
   * U-shaped dog-leg stair inside the stair room's clear rectangle.
   * Local frame: u = across the stair (0..W), v = along travel from the start edge (0..L).
   * Flight 1 rises along u in [0, fw]; the half landing spans the far end;
   * flight 2 returns along u in [W-fw, W] and arrives back at v = v0 on the upper floor.
   */
  function stairGeometry(spec, cl) {
    const map = {
      n: (uu, vv) => [cl.x0 + uu, cl.y0 + vv],
      s: (uu, vv) => [cl.x1 - uu, cl.y1 - vv],
      w: (uu, vv) => [cl.x0 + vv, cl.y1 - uu],
      e: (uu, vv) => [cl.x1 - vv, cl.y0 + uu],
    }[spec.start];
    const across = spec.start === 'n' || spec.start === 's';
    const W = across ? cl.x1 - cl.x0 : cl.y1 - cl.y0;
    const L = across ? cl.y1 - cl.y0 : cl.x1 - cl.x0;
    const perFlight = spec.risers / 2;
    const treads = perFlight - 1;
    const fw = (W - spec.gap) / 2;
    const fl = (treads * spec.tread) / 12;
    const land = Math.max(fw, 3);
    const vLand = L - land;
    const v0 = vLand - fl;
    return { map, W, L, fw, fl, land, vLand, v0, perFlight, treads, fits: v0 >= -0.01, spec };
  }

  /* -------------------------------------------------------------- columns */

  /** Conceptual RCC column placeholders derived from the ground-floor structural grid. */
  function computeColumns(layout) {
    const gf = layout.floors[0].rooms;
    const structural = gf.filter((r) => !isOpen(r) || r.type === 'porch');
    const pts = [];
    structural.forEach((r) => {
      const [x0, y0, x1, y1] = r.r;
      [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y]) => {
        if (!pts.some((p) => near(p[0], x) && near(p[1], y))) pts.push([x, y]);
      });
    });
    const score = ([x, y]) => {
      const bx = near(x, 0) || near(x, PLOT.w), by = near(y, 0) || near(y, PLOT.d);
      const touching = structural.filter((r) => x >= r.r[0] - EPS && x <= r.r[2] + EPS && y >= r.r[1] - EPS && y <= r.r[3] + EPS).length;
      return (bx && by ? 10 : 0) + (bx || by ? 4 : 0) + touching;
    };
    pts.sort((a, b) => score(b) - score(a) || a[1] - b[1] || a[0] - b[0]);
    const spacing = layout.columnSpacing || 7;
    const chosen = [];
    pts.forEach((p) => {
      if (chosen.every((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) >= spacing)) chosen.push(p);
    });
    const half = 0.375;
    return chosen.map(([x, y], i) => ({
      id: 'C' + (i + 1), gx: x, gy: y,
      x: clamp(x, half, PLOT.w - half), y: clamp(y, half, PLOT.d - half), size: 0.75,
    }));
  }

  /* -------------------------------------------------------- compute floor */

  function compute(layout, level) {
    const floor = layout.floors[level];
    const rooms = floor.rooms;
    const segs = buildWallSegments(rooms, level);
    const openings = resolveOpenings(rooms, segs);
    const pieces = wallPieces(segs, openings);
    const clear = {};
    rooms.forEach((r) => { clear[r.id] = clearRect(segs, r); });
    const furniture = [];
    rooms.forEach((r) => (r.furn || []).forEach((f, i) => {
      furniture.push(Object.assign(placeFurniture(f, clear[r.id]), { kind: f.k, opts: f, room: r, id: `${r.id}:f${i}` }));
    }));
    const stairRoom = rooms.find((r) => r.type === 'stair') || null;
    const stair = stairRoom ? stairGeometry(layout.stair, clear[stairRoom.id]) : null;
    return { layout, level, floor, rooms, segs, openings, pieces, clear, furniture, stair, stairRoom };
  }

  /* ----------------------------------------------------------- editing */

  /** Move every room edge sitting on grid line `v` (axis 'x' or 'y') to `nv`, on all floors. */
  function moveGridLine(layout, axis, v, nv) {
    const i0 = axis === 'x' ? 0 : 1, i1 = axis === 'x' ? 2 : 3;
    const max = axis === 'x' ? PLOT.w : PLOT.d;
    if (near(v, 0) || near(v, max)) return { ok: false, msg: 'Plot boundary lines are fixed at 32\'-0" × 50\'-0".' };
    if (nv <= 0.5 || nv >= max - 0.5) return { ok: false, msg: 'That would push a wall outside the plot.' };
    const touched = [];
    const backup = layout.floors.map((f) => f.rooms.map((r) => r.r.slice()));
    layout.floors.forEach((f) => f.rooms.forEach((r) => {
      let hit = false;
      if (near(r.r[i0], v)) { r.r[i0] = nv; hit = true; }
      if (near(r.r[i1], v)) { r.r[i1] = nv; hit = true; }
      if (hit) touched.push(r);
    }));
    const bad = touched.find((r) => r.r[i1] - r.r[i0] < 2);
    if (bad) {
      layout.floors.forEach((f, fi) => f.rooms.forEach((r, ri) => { r.r = backup[fi][ri]; }));
      return { ok: false, msg: `${bad.name} would become narrower than 2'-0".` };
    }
    return { ok: true, touched };
  }

  /** Neighbouring rooms (same floor) that share an edge segment with `room` on `side`. */
  function neighbours(rooms, room, side) {
    const e = edgeOf(room, side);
    return rooms.filter((r) => {
      if (r === room) return false;
      const opp = { n: 's', s: 'n', w: 'e', e: 'w' }[side];
      const f = edgeOf(r, opp);
      return near(f.c, e.c) && Math.min(f.b, e.b) - Math.max(f.a, e.a) > 0.1;
    });
  }

  FP.core = {
    PLOT, SCALE, WALL, OPEN_TYPES, VOID_TYPES, HABITABLE, WET, PASSABLE, SWINGING, SIDES, EPS,
    near, clamp, uniq, u, fmt, fmtArea, isOpen, isVoid, rw, rh, rectIntersect, toRect, rectInside,
    edgeOf, onPlotBoundary, isSideBoundary, pointOnLine, roomAt, segAt, swingZone, placeFurniture,
    stairGeometry, computeColumns, compute, moveGridLine, neighbours, clearRect,
  };
})(globalThis.FP = globalThis.FP || {});

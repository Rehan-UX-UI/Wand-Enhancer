/*
 * Lightweight 3D massing view (Canvas 2D, orthographic projection, painter's algorithm).
 * Built from the same computed wall pieces/openings as the 2D plans, so it is always in sync.
 * No external libraries: the app keeps working offline from file://.
 */
(function (FP) {
  'use strict';
  const C = FP.core;
  const { PLOT } = C;

  const COLORS = {
    ext: [236, 233, 226], int: [244, 242, 237], boundary: [214, 210, 201], parapet: [226, 222, 214],
    lintel: [236, 233, 226], slab: [206, 210, 215], glass: [178, 205, 226],
    floor: [250, 249, 246], porch: [222, 222, 218], lawn: [196, 219, 180], court: [232, 229, 220],
    terrace: [240, 236, 226], stair: [210, 205, 196], ground: [233, 235, 230],
  };

  /** Split long boxes so the painter's sort stays stable. */
  function pushBox(list, b, maxLen = 3) {
    const lx = b.x1 - b.x0, ly = b.y1 - b.y0;
    if (lx > maxLen && lx >= ly) {
      const k = Math.ceil(lx / maxLen);
      for (let i = 0; i < k; i++) pushBox(list, Object.assign({}, b, { x0: b.x0 + (lx * i) / k, x1: b.x0 + (lx * (i + 1)) / k }), maxLen);
    } else if (ly > maxLen) {
      const k = Math.ceil(ly / maxLen);
      for (let i = 0; i < k; i++) pushBox(list, Object.assign({}, b, { y0: b.y0 + (ly * i) / k, y1: b.y0 + (ly * (i + 1)) / k }), maxLen);
    } else list.push(b);
  }

  function buildScene(layout, opts) {
    const sp = layout.stair;
    const FH = sp.floorH / 12, slab = sp.slab / 12;
    const boxes = [];
    const flats = [];
    const levels = opts.levels;
    for (let lvl = 0; lvl < levels; lvl++) {
      const m = C.compute(layout, lvl);
      const z0 = lvl * FH;
      const wallH = FH - slab;
      // floors / ground finishes
      m.rooms.forEach((r) => {
        if (lvl > 0 && C.isVoid(r)) return;
        const col = lvl === 0 ? (COLORS[r.type] || COLORS.floor) : C.isOpen(r) ? COLORS.terrace : COLORS.floor;
        flats.push({ x0: r.r[0], y0: r.r[1], x1: r.r[2], y1: r.r[3], z: z0 + 0.02, col });
      });
      // first-floor slab (edge band only, the floor surfaces above sit on it)
      if (lvl > 0) {
        m.rooms.forEach((r) => {
          if (C.isVoid(r) || r.type === 'stair') return;
          pushBox(boxes, { x0: r.r[0], y0: r.r[1], x1: r.r[2], y1: r.r[3], z0: z0 - slab, z1: z0, col: COLORS.slab }, 6);
        });
      }
      m.pieces.forEach((p) => {
        const lo = p.center - p.t / 2, hi = p.center + p.t / 2;
        const [x0, y0, x1, y1] = p.axis === 'h' ? [p.a, lo, p.b, hi] : [lo, p.a, hi, p.b];
        const h = p.kind === 'boundary' ? 6.5 : p.kind === 'parapet' ? 3.5 : wallH;
        pushBox(boxes, { x0, y0, x1, y1, z0, z1: z0 + h, col: COLORS[p.kind] || COLORS.ext });
      });
      m.openings.forEach((o) => {
        if (!o.seg || o.seg.kind === 'boundary' || o.seg.kind === 'parapet' || o.kind === 'gate') return;
        const lo = o.center - o.t / 2, hi = o.center + o.t / 2;
        const [x0, y0, x1, y1] = o.axis === 'h' ? [o.a, lo, o.b, hi] : [lo, o.a, hi, o.b];
        const head = 7;
        pushBox(boxes, { x0, y0, x1, y1, z0: z0 + head, z1: z0 + wallH, col: COLORS.lintel });
        if (o.kind === 'win' || o.kind === 'vent') {
          const sill = o.kind === 'vent' ? 5.5 : 3;
          pushBox(boxes, { x0, y0, x1, y1, z0, z1: z0 + sill, col: COLORS.lintel });
          const m2 = o.axis === 'h' ? { y0: o.center - 0.04, y1: o.center + 0.04 } : { x0: o.center - 0.04, x1: o.center + 0.04 };
          pushBox(boxes, Object.assign({ x0, y0, x1, y1, z0: z0 + sill, z1: z0 + head, col: COLORS.glass, alpha: 0.55 }, m2));
        }
      });
      // stair flights as stepped blocks
      if (m.stair) {
        const s = m.stair, tr = sp.tread / 12, rz = sp.riser / 12;
        const step = (u0, u1, v0, v1, top) => {
          const [ax, ay] = s.map(u0, v0), [bx, by] = s.map(u1, v1);
          pushBox(boxes, { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by), z0: z0 + top - rz, z1: z0 + top, col: COLORS.stair }, 10);
        };
        for (let k = 0; k < s.treads; k++) step(0, s.fw, s.v0 + k * tr, s.v0 + (k + 1) * tr, (k + 1) * rz);
        step(0, s.W, s.vLand, s.L, s.perFlight * rz);
        for (let k = 0; k < s.treads; k++) step(s.W - s.fw, s.W, s.vLand - (k + 1) * tr, s.vLand - k * tr, (s.perFlight + k + 1) * rz);
      }
    }
    if (opts.roof) {
      const m = C.compute(layout, levels - 1);
      const z = levels * FH;
      m.rooms.forEach((r) => {
        if (C.isOpen(r)) return;
        pushBox(boxes, { x0: r.r[0], y0: r.r[1], x1: r.r[2], y1: r.r[3], z0: z - slab, z1: z, col: COLORS.slab }, 6);
      });
    }
    return { boxes, flats, height: levels * FH };
  }

  function create(canvas) {
    const st = { yaw: -0.62, pitch: 0.72, zoom: 1, layout: null, opts: { levels: 2, roof: false }, scene: null };
    const ctx = canvas.getContext('2d');
    let drag = null;

    function project(x, y, z, k, ox, oy) {
      const cx = x - PLOT.w / 2, cy = y - PLOT.d / 2;
      const cs = Math.cos(st.yaw), sn = Math.sin(st.yaw);
      const xr = cx * cs - cy * sn, yr = cx * sn + cy * cs;
      const sp = Math.sin(st.pitch), cp = Math.cos(st.pitch);
      return [ox + xr * k, oy + (yr * sp - z * cp) * k, yr * cp + z * sp];
    }

    function draw() {
      if (!st.scene) return;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#f4f5f7';
      ctx.fillRect(0, 0, W, H);
      const k = (Math.min(W, H) / 62) * st.zoom;
      const ox = W / 2, oy = H / 2 + (st.scene.height * Math.cos(st.pitch) * k) / 2;
      const P = (x, y, z) => project(x, y, z, k, ox, oy);
      const light = [-0.45, -0.55, 0.7];
      const cs = Math.cos(st.yaw), sn = Math.sin(st.yaw), sp = Math.sin(st.pitch), cp = Math.cos(st.pitch);
      const faces = [];
      // ground plane
      const g = [P(-2, -2, 0), P(PLOT.w + 2, -2, 0), P(PLOT.w + 2, PLOT.d + 6, 0), P(-2, PLOT.d + 6, 0)];
      faces.push({ pts: g, depth: -1e9, col: [226, 229, 224], shade: 1, stroke: false });
      st.scene.flats.forEach((f) => {
        const pts = [P(f.x0, f.y0, f.z), P(f.x1, f.y0, f.z), P(f.x1, f.y1, f.z), P(f.x0, f.y1, f.z)];
        faces.push({ pts, depth: -1e8 + f.z * 1e6 + pts.reduce((s, p) => s + p[2], 0) / 4, col: f.col, shade: 1 });
      });
      st.scene.boxes.forEach((b) => {
        const v = (x, y, z) => P(x, y, z);
        const sides = [
          { n: [0, 0, 1], q: [[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]] },
          { n: [0, -1, 0], q: [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [b.x0, b.y0, b.z1]] },
          { n: [0, 1, 0], q: [[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]] },
          { n: [-1, 0, 0], q: [[b.x0, b.y0, b.z0], [b.x0, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x0, b.y0, b.z1]] },
          { n: [1, 0, 0], q: [[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1]] },
        ];
        sides.forEach((s) => {
          const nyr = s.n[0] * sn + s.n[1] * cs;
          if (nyr * cp + s.n[2] * sp <= 0) return;
          const pts = s.q.map((p) => v(...p));
          const lum = 0.72 + 0.28 * Math.max(0, s.n[0] * light[0] + s.n[1] * light[1] + s.n[2] * light[2]);
          const cxp = (b.x0 + b.x1) / 2, cyp = (b.y0 + b.y1) / 2, czp = (b.z0 + b.z1) / 2;
          const depth = P(cxp + s.n[0] * 0.01, cyp + s.n[1] * 0.01, czp)[2] + (s.n[2] ? (b.z1 - czp) * sp : 0);
          faces.push({ pts, depth, col: b.col, shade: lum, alpha: b.alpha });
        });
      });
      faces.sort((a, b) => a.depth - b.depth);
      faces.forEach((f) => {
        ctx.beginPath();
        f.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        const [r, g2, b2] = f.col.map((c) => Math.round(c * f.shade));
        ctx.fillStyle = `rgba(${r},${g2},${b2},${f.alpha || 1})`;
        ctx.fill();
        if (f.stroke !== false) { ctx.strokeStyle = 'rgba(40,44,52,.22)'; ctx.lineWidth = 0.6; ctx.stroke(); }
      });
      // road edge label
      const [rx, ry] = P(PLOT.w / 2, PLOT.d + 3, 0);
      ctx.fillStyle = '#4b5058';
      ctx.font = '600 11px Inter, Segoe UI, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROAD / FRONT', rx, ry);
    }

    function set(layout, opts) {
      st.layout = layout;
      Object.assign(st.opts, opts || {});
      st.scene = buildScene(layout, st.opts);
      draw();
    }

    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      st.yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
      st.pitch = C.clamp(drag.pitch + (e.clientY - drag.y) * 0.006, 0.2, 1.45);
      draw();
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.zoom = C.clamp(st.zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.4, 4); draw(); }, { passive: false });

    return { set, draw, reset() { st.yaw = -0.62; st.pitch = 0.72; st.zoom = 1; draw(); }, state: st };
  }

  FP.view3d = { create, buildScene };
})(globalThis.FP = globalThis.FP || {});

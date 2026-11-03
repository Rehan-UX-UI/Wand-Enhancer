/*
 * SVG plan renderer. Produces self-contained SVG markup (styles + patterns embedded) so the
 * same string is used on screen, for SVG export, PNG rasterisation, PDF pages and print.
 */
(function (FP) {
  'use strict';
  const C = FP.core;
  const { PLOT, SCALE } = C;
  const u = C.u;
  const PW = PLOT.w * SCALE, PD = PLOT.d * SCALE; // 384 x 600

  const MARGIN = { l: 112, t: 112, r: 84, b: 206 };
  const VIEW = { x: -MARGIN.l, y: -MARGIN.t, w: PW + MARGIN.l + MARGIN.r, h: PD + MARGIN.t + MARGIN.b };

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const STYLE = `
  .sheet{fill:#ffffff}
  .prop{fill:none;stroke:#1f2328;stroke-width:1.1;stroke-dasharray:14 4 2 4}
  .room{fill:#ffffff;stroke:none}
  .room.hit{cursor:pointer}
  .room.hit:hover{fill:#f3f6fb}
  .room.wet{fill:url(#P-tile)}
  .room.kitchen{fill:url(#P-tile2)}
  .room.porch{fill:url(#P-porch)}
  .room.lawn{fill:url(#P-grass)}
  .room.court,.room.shaft{fill:url(#P-void)}
  .room.terrace,.room.balcony{fill:url(#P-deck)}
  .room.stair{fill:#ffffff}
  .outline{fill:none;stroke:#9aa1aa;stroke-width:.6}
  .sel{fill:rgba(37,99,235,.09);stroke:#2563eb;stroke-width:2.4;pointer-events:none}
  .wall{fill:#25282d}
  .wall.boundary,.wall.parapet{fill:url(#P-hatch);stroke:#4b5058;stroke-width:.5}
  .col{fill:#25282d;stroke:#ffffff;stroke-width:.6}
  .colx{stroke:#ffffff;stroke-width:.5}
  .coltag{font:500 5px Inter,'Segoe UI',Arial,sans-serif;fill:#6b7280}
  .furn .f{fill:#ffffff;stroke:#646a73;stroke-width:.7}
  .furn .f2{fill:#f1f2f4;stroke:#646a73;stroke-width:.6}
  .furn .fl{fill:none;stroke:#8b9098;stroke-width:.5}
  .furn .fd{fill:none;stroke:#8b9098;stroke-width:.5;stroke-dasharray:2 1.5}
  .furn .fdk{fill:#4b5058;stroke:none}
  .furn .rug{fill:none;stroke:#b4b9c0;stroke-width:.5;stroke-dasharray:3 2}
  .furn .ft{font:600 1px Inter,'Segoe UI',Arial,sans-serif;fill:#7b8088;text-anchor:middle}
  .leaf{stroke:#25282d;stroke-width:1.3;fill:none;stroke-linecap:square}
  .arc{stroke:#7b8088;stroke-width:.55;fill:none}
  .jamb{stroke:#25282d;stroke-width:.8}
  .win{fill:#ffffff;stroke:#25282d;stroke-width:.65}
  .glass{stroke:#25282d;stroke-width:.5}
  .hdr{stroke:#7b8088;stroke-width:.6;stroke-dasharray:3 2}
  .slide{fill:#ffffff;stroke:#25282d;stroke-width:.6}
  .gate{stroke:#25282d;stroke-width:1.6;stroke-dasharray:6 2;fill:none}
  .st-f{fill:#ffffff;stroke:#25282d;stroke-width:.8}
  .st-t{stroke:#4b5058;stroke-width:.55}
  .st-td{stroke:#9aa1aa;stroke-width:.5;stroke-dasharray:3 2}
  .st-dash{stroke:#9aa1aa;stroke-dasharray:3 2}
  .st-mid{fill:#25282d}
  .st-cut{fill:none;stroke:#25282d;stroke-width:.8}
  .st-arrow{fill:none;stroke:#1f4fb8;stroke-width:1.05}
  .st-head{fill:#1f4fb8}
  .st-lbl{font:700 7px Inter,'Segoe UI',Arial,sans-serif;fill:#1f4fb8;letter-spacing:.6px}
  .st-num{font:500 4.2px Inter,'Segoe UI',Arial,sans-serif;fill:#6b7280;text-anchor:middle}
  .lbl{font-family:Inter,'Segoe UI',Arial,sans-serif;text-anchor:middle;paint-order:stroke;stroke:#ffffff;stroke-width:2.6px;stroke-linejoin:round;pointer-events:none}
  .lbl .nm{font-weight:700;fill:#1f2328;letter-spacing:.5px}
  .lbl .dm{font-weight:500;fill:#3b4048}
  .lbl .ar{font-weight:500;fill:#7b8088}
  .dim line{stroke:#3b4048;stroke-width:.55}
  .dim .ext{stroke:#9aa1aa;stroke-width:.45}
  .dim .tick{stroke:#1f2328;stroke-width:1}
  .dim text{font:500 7.4px Inter,'Segoe UI',Arial,sans-serif;fill:#1f2328;text-anchor:middle}
  .dim .big{font-weight:700;font-size:9px}
  .road{fill:#eceef1}
  .roadc{stroke:#ffffff;stroke-width:1.6;stroke-dasharray:16 10}
  .roadt{font:700 9px Inter,'Segoe UI',Arial,sans-serif;fill:#4b5058;letter-spacing:3px;text-anchor:middle}
  .tb{fill:#ffffff;stroke:#1f2328;stroke-width:.9}
  .tbl{stroke:#1f2328;stroke-width:.5}
  .tbt{font:800 13px Inter,'Segoe UI',Arial,sans-serif;fill:#1f2328;letter-spacing:1px}
  .tbs{font:500 7px Inter,'Segoe UI',Arial,sans-serif;fill:#3b4048}
  .tbk{font:700 5.6px Inter,'Segoe UI',Arial,sans-serif;fill:#7b8088;letter-spacing:1px}
  .tbn{font:italic 500 6px Inter,'Segoe UI',Arial,sans-serif;fill:#b42318}
  .na{fill:#1f2328}
  .na2{fill:#ffffff;stroke:#1f2328;stroke-width:.8}
  .nat{font:800 10px Inter,'Segoe UI',Arial,sans-serif;fill:#1f2328;text-anchor:middle}
  .sb{stroke:#1f2328;stroke-width:.6}
  .sbt{font:500 5.5px Inter,'Segoe UI',Arial,sans-serif;fill:#3b4048;text-anchor:middle}
  .void{stroke:#b4b9c0;stroke-width:.5}
  .lg{font:500 6px Inter,'Segoe UI',Arial,sans-serif;fill:#3b4048}
  `;

  function defs(pre) {
    return `<defs><style>${STYLE.replace(/P-/g, pre + '-')}</style>
    <pattern id="${pre}-tile" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f6f8fa"/><path d="M12 0V12H0" fill="none" stroke="#dde2e8" stroke-width=".5"/></pattern>
    <pattern id="${pre}-tile2" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#fbfaf7"/><path d="M24 0V24H0" fill="none" stroke="#e7e3da" stroke-width=".5"/></pattern>
    <pattern id="${pre}-porch" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f4f4f2"/><circle cx="2" cy="2" r=".45" fill="#c3c6c9"/><circle cx="6" cy="6" r=".35" fill="#cfd2d5"/></pattern>
    <pattern id="${pre}-grass" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#f1f6ee"/><path d="M2 7l1-3 1 3M7 3l1-2.5 1 2.5" fill="none" stroke="#a7c39a" stroke-width=".5"/></pattern>
    <pattern id="${pre}-void" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#fafbfc"/></pattern>
    <pattern id="${pre}-deck" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#faf9f6"/><path d="M0 0H12" stroke="#e4e0d6" stroke-width=".5"/></pattern>
    <pattern id="${pre}-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#d9dce0"/><line x1="0" y1="0" x2="0" y2="4" stroke="#6b7078" stroke-width="1"/></pattern>
    </defs>`;
  }

  /* --------------------------------------------------------- pieces */

  function roomClass(r) {
    if (C.WET.has(r.type) && r.type !== 'kitchen') return 'wet';
    return r.type;
  }

  function drawRooms(m, interactive) {
    return m.rooms.map((r) => {
      const [x0, y0, x1, y1] = r.r;
      const cls = `room ${roomClass(r)}${interactive ? ' hit' : ''}`;
      return `<rect class="${cls}" data-room="${r.id}" x="${u(x0)}" y="${u(y0)}" width="${u(x1 - x0)}" height="${u(y1 - y0)}"/>`;
    }).join('');
  }

  function drawVoids(m) {
    return m.rooms.filter((r) => C.isVoid(r)).map((r) => {
      const c = m.clear[r.id];
      return `<g class="void"><line x1="${u(c.x0)}" y1="${u(c.y0)}" x2="${u(c.x1)}" y2="${u(c.y1)}"/><line x1="${u(c.x1)}" y1="${u(c.y0)}" x2="${u(c.x0)}" y2="${u(c.y1)}"/></g>`;
    }).join('');
  }

  function drawOutlines(m) {
    return m.rooms.map((r) => `<rect class="outline" x="${u(r.r[0])}" y="${u(r.r[1])}" width="${u(C.rw(r))}" height="${u(C.rh(r))}"/>`).join('');
  }

  function drawWalls(m) {
    return m.pieces.map((p) => {
      const lo = p.center - p.t / 2;
      const [x, y, w, h] = p.axis === 'h' ? [p.a, lo, p.b - p.a, p.t] : [lo, p.a, p.t, p.b - p.a];
      return `<rect class="wall ${p.kind}" x="${u(x)}" y="${u(y)}" width="${u(w)}" height="${u(h)}"/>`;
    }).join('');
  }

  function drawColumns(cols) {
    return cols.map((c) => {
      const h = c.size / 2;
      const x0 = u(c.x - h), y0 = u(c.y - h), s = u(c.size);
      return `<rect class="col" x="${x0}" y="${y0}" width="${s}" height="${s}"/><path class="colx" d="M${x0} ${y0}l${s} ${s}M${x0 + s} ${y0}l${-s} ${s}"/>`;
    }).join('');
  }

  /** Point in model feet from (along, across) coordinates of an opening line. */
  const P = (o, along, across) => (o.axis === 'h' ? [u(along), u(across)] : [u(across), u(along)]);

  function drawOpening(o) {
    const t = o.t, lo = o.center - t / 2, hi = o.center + t / 2;
    const face = o.normal > 0 ? hi : lo;
    const jamb = (at) => { const [x1, y1] = P(o, at, lo), [x2, y2] = P(o, at, hi); return `<line class="jamb" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; };
    const leaf = (hinge, other, len) => {
      const [hx, hy] = P(o, hinge, face);
      const [lx, ly] = P(o, hinge, face + o.normal * len);
      const [jx, jy] = P(o, other, face);
      const cross = (lx - hx) * (jy - hy) - (ly - hy) * (jx - hx);
      const r = u(len);
      return `<line class="leaf" x1="${hx}" y1="${hy}" x2="${lx}" y2="${ly}"/><path class="arc" d="M${lx} ${ly}A${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${jx} ${jy}"/>`;
    };
    switch (o.kind) {
      case 'door': {
        const [h, other] = o.hinge === 'end' ? [o.b, o.a] : [o.a, o.b];
        return jamb(o.a) + jamb(o.b) + leaf(h, other, o.w);
      }
      case 'door2': {
        const mid = (o.a + o.b) / 2;
        return jamb(o.a) + jamb(o.b) + leaf(o.a, mid, o.w / 2) + leaf(o.b, mid, o.w / 2);
      }
      case 'win':
      case 'vent': {
        const [x0, y0] = P(o, o.a, lo), [x1, y1] = P(o, o.b, hi);
        const r = `<rect class="win" x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}"/>`;
        const gl = (off) => { const [a, b] = P(o, o.a, o.center + off), [c, d] = P(o, o.b, o.center + off); return `<line class="glass" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; };
        return r + (o.kind === 'win' ? gl(-0.05) + gl(0.05) : gl(0));
      }
      case 'slide': {
        const half = o.w * 0.55, th = Math.min(0.12, t / 4);
        const panel = (a, off) => { const [x0, y0] = P(o, a, o.center + off - th / 2), [x1, y1] = P(o, a + half, o.center + off + th / 2); return `<rect class="slide" x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}"/>`; };
        return jamb(o.a) + jamb(o.b) + panel(o.a, -th * 0.7) + panel(o.b - half, th * 0.7);
      }
      case 'open': {
        const ln = (off) => { const [a, b] = P(o, o.a, off), [c, d] = P(o, o.b, off); return `<line class="hdr" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; };
        return ln(lo) + ln(hi);
      }
      case 'gate': {
        const off = o.center - o.out * 0.55;
        const [a, b] = P(o, o.a, off), [c, d] = P(o, o.b, off);
        return jamb(o.a) + jamb(o.b) + `<line class="gate" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`;
      }
      default: return '';
    }
  }

  function drawStair(m) {
    const s = m.stair;
    if (!s) return '';
    const sp = s.spec, tr = sp.tread / 12;
    const pt = (uu, vv) => s.map(uu, vv).map(u).join(' ');
    const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map(([a, b]) => pt(a, b)).join(' ')}"/>`;
    const ln = (u1, v1, u2, v2, cls) => { const [a, b] = s.map(u1, v1).map(u), [c, d] = s.map(u2, v2).map(u); return `<line class="${cls}" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`; };
    const gf = m.level === 0;
    const vCut = s.v0 + s.fl * 0.62;
    let g = '';
    g += poly([[0, s.v0], [s.fw, s.v0], [s.fw, s.vLand], [0, s.vLand]], 'st-f');
    g += poly([[s.W - s.fw, s.v0], [s.W, s.v0], [s.W, s.vLand], [s.W - s.fw, s.vLand]], gf ? 'st-f st-dash' : 'st-f');
    g += poly([[0, s.vLand], [s.W, s.vLand], [s.W, s.L], [0, s.L]], gf ? 'st-f st-dash' : 'st-f');
    g += poly([[s.fw, s.v0], [s.W - s.fw, s.v0], [s.W - s.fw, s.vLand], [s.fw, s.vLand]], 'st-mid');
    for (let k = 0; k <= s.treads; k++) {
      const v1 = s.v0 + k * tr;
      g += ln(0, v1, s.fw, v1, gf && v1 > vCut ? 'st-td' : 'st-t');
      const v2 = s.vLand - k * tr;
      g += ln(s.W - s.fw, v2, s.W, v2, gf ? 'st-td' : 'st-t');
    }
    if (gf) {
      const z = 0.35;
      const pts = [[0, vCut + 0.5], [s.fw * 0.4, vCut + 0.5], [s.fw * 0.48, vCut + 0.5 - z], [s.fw * 0.55, vCut + 0.5 + z], [s.fw * 0.62, vCut - 0.5], [s.fw, vCut - 0.5]];
      g += `<polyline class="st-cut" points="${pts.map(([a, b]) => pt(a, b)).join(' ')}"/>`;
      for (let k = 0; k < s.perFlight; k++) {
        const vv = s.v0 + (k + 0.5) * tr;
        if (vv > vCut - 0.3 || vv > s.vLand) break;
        const [x, y] = s.map(s.fw - 0.35, vv).map(u);
        g += `<text class="st-num" x="${x}" y="${y + 1.5}">${k + 1}</text>`;
      }
    }
    // travel arrow
    const c1 = s.fw / 2, c2 = s.W - s.fw / 2, vl = s.vLand + s.land / 2;
    const route = gf
      ? [[c1, s.v0 + 0.25], [c1, vCut - 0.8]]
      : [[c2, s.v0 + 0.25], [c2, vl], [c1, vl], [c1, s.v0 + 0.25]];
    g += `<polyline class="st-arrow" points="${route.map(([a, b]) => pt(a, b)).join(' ')}"/>`;
    const [ex, ey] = s.map(...route[route.length - 1]).map(u);
    const [px, py] = s.map(...route[route.length - 2]).map(u);
    const ang = Math.atan2(ey - py, ex - px);
    const hd = 6;
    const head = [[ex, ey], [ex - hd * Math.cos(ang - 0.4), ey - hd * Math.sin(ang - 0.4)], [ex - hd * Math.cos(ang + 0.4), ey - hd * Math.sin(ang + 0.4)]];
    g += `<polygon class="st-head" points="${head.map((p) => p.join(' ')).join(' ')}"/>`;
    const [sx, sy] = s.map(...route[0]).map(u);
    g += `<circle class="st-head" cx="${sx}" cy="${sy}" r="1.8"/>`;
    const [lx, ly] = s.map(gf ? c1 : c2, s.v0 - 0.45).map(u);
    g += `<text class="st-lbl" x="${lx}" y="${ly}" text-anchor="middle">${gf ? 'UP' : 'DN'}</text>`;
    if (!gf) {
      const [rx, ry] = s.map(c1, s.v0 + 0.9).map(u);
      g += `<text class="st-num" x="${rx}" y="${ry}">to GF</text>`;
    }
    return `<g class="stair">${g}</g>`;
  }

  function drawLabels(m, layers) {
    return m.rooms.map((r) => {
      const c = m.clear[r.id];
      const cw = c.x1 - c.x0, ch = c.y1 - c.y0;
      const pos = r.lbl || [0.5, 0.5];
      let cx = c.x0 + cw * pos[0], cy = c.y0 + ch * pos[1];
      if (r.type === 'stair' && m.stair) [cx, cy] = m.stair.map(m.stair.W / 2, Math.max(0.6, m.stair.v0 / 2));
      const name = r.name.toUpperCase();
      const lines = [];
      if (r.type === 'stair') {
        lines.push(['nm', name]);
        lines.push(['ar', `${layoutStairNote(m)}`]);
      } else if (C.isVoid(r)) {
        lines.push(['nm', name]);
        lines.push(['ar', r.type === 'shaft' ? 'OPEN TO SKY' : `${C.fmt(cw)} × ${C.fmt(ch)} · OPEN TO SKY`]);
      } else {
        lines.push(['nm', name]);
        lines.push(['dm', `${C.fmt(cw)} × ${C.fmt(ch)}`]);
        if (layers.areas !== false) lines.push(['ar', C.fmtArea(cw * ch)]);
      }
      const base = { nm: 7.6, dm: 6.6, ar: 5.6 };
      const widest = Math.max(...lines.map(([k, s]) => s.length * base[k] * 0.6));
      const avail = u(cw) - 6;
      const k = Math.max(0.55, Math.min(1, avail / widest, (u(ch) - 4) / (lines.length * 9.5)));
      const lh = 9 * k;
      if (!r.lbl && r.type !== 'stair' && layers.furniture) {
        // pick the label spot inside the room that overlaps furniture the least
        const bw = (widest * k) / SCALE, bh = (lines.length * lh) / SCALE;
        const boxes = m.furniture.filter((f) => f.room === r && f.kind !== 'rug' && f.kind !== 'mat');
        let best = null;
        for (let fx = 0.2; fx <= 0.801; fx += 0.05) {
          for (let fy = 0.2; fy <= 0.801; fy += 0.05) {
            const px = c.x0 + cw * fx, py = c.y0 + ch * fy;
            const box = { x0: px - bw / 2, x1: px + bw / 2, y0: py - bh / 2, y1: py + bh / 2 };
            const hit = boxes.reduce((s, f) => s + ((C.rectIntersect(box, { x0: f.x, y0: f.y, x1: f.x + f.w, y1: f.y + f.h }) || { area: 0 }).area), 0);
            const spill = Math.max(0, c.x0 + 0.2 - box.x0) + Math.max(0, box.x1 - c.x1 + 0.2) + Math.max(0, c.y0 + 0.1 - box.y0) + Math.max(0, box.y1 - c.y1 + 0.1);
            const score = hit * 10 + spill * 40 + Math.hypot(fx - 0.5, fy - 0.5);
            if (!best || score < best.score) best = { score, px, py };
          }
        }
        cx = best.px; cy = best.py;
      }
      let y = u(cy) - ((lines.length - 1) * lh) / 2 + 2.6 * k;
      return `<text class="lbl" x="${u(cx)}" y="${y}">${lines.map(([cls, s], i) => `<tspan class="${cls}" x="${u(cx)}" y="${(y + i * lh).toFixed(2)}" font-size="${(base[cls] * k).toFixed(2)}">${esc(s)}</tspan>`).join('')}</text>`;
    }).join('');
  }
  function layoutStairNote(m) {
    const sp = m.layout.stair;
    return `${sp.risers}R @ ${sp.riser}" · T ${sp.tread}"`;
  }

  /* ----------------------------------------------------- dimensions */

  function dimH(x1, x2, y, label, cls = '', extFrom = null) {
    const a = u(x1), b = u(x2), yy = y;
    let s = '';
    if (extFrom != null) s += `<line class="ext" x1="${a}" y1="${extFrom}" x2="${a}" y2="${yy - 3}"/><line class="ext" x1="${b}" y1="${extFrom}" x2="${b}" y2="${yy - 3}"/>`;
    s += `<line x1="${a - 3}" y1="${yy}" x2="${b + 3}" y2="${yy}"/>`;
    s += `<line class="tick" x1="${a - 2.5}" y1="${yy + 2.5}" x2="${a + 2.5}" y2="${yy - 2.5}"/><line class="tick" x1="${b - 2.5}" y1="${yy + 2.5}" x2="${b + 2.5}" y2="${yy - 2.5}"/>`;
    const small = b - a < 30;
    s += `<text class="${cls}" x="${(a + b) / 2}" y="${yy - (small ? 3 : 3)}" ${small ? 'font-size="5.6"' : ''}>${esc(label)}</text>`;
    return s;
  }
  function dimV(y1, y2, x, label, cls = '', extFrom = null) {
    const a = u(y1), b = u(y2);
    let s = '';
    if (extFrom != null) s += `<line class="ext" x1="${extFrom}" y1="${a}" x2="${x - 3}" y2="${a}"/><line class="ext" x1="${extFrom}" y1="${b}" x2="${x - 3}" y2="${b}"/>`;
    s += `<line x1="${x}" y1="${a - 3}" x2="${x}" y2="${b + 3}"/>`;
    s += `<line class="tick" x1="${x - 2.5}" y1="${a + 2.5}" x2="${x + 2.5}" y2="${a - 2.5}"/><line class="tick" x1="${x - 2.5}" y1="${b + 2.5}" x2="${x + 2.5}" y2="${b - 2.5}"/>`;
    const small = b - a < 30;
    s += `<text class="${cls}" x="${x - 3}" y="${(a + b) / 2}" transform="rotate(-90 ${x - 3} ${(a + b) / 2})" ${small ? 'font-size="5.6"' : ''}>${esc(label)}</text>`;
    return s;
  }

  function drawDims(m) {
    const xs = C.uniq(m.rooms.flatMap((r) => [r.r[0], r.r[2]]));
    const ys = C.uniq(m.rooms.flatMap((r) => [r.r[1], r.r[3]]));
    let s = '';
    s += dimH(0, PLOT.w, -74, `${C.fmt(PLOT.w)}  PLOT WIDTH (FRONTAGE)`, 'big', -4);
    s += dimV(0, PLOT.d, -74, `${C.fmt(PLOT.d)}  PLOT DEPTH`, 'big', -4);
    for (let i = 0; i < xs.length - 1; i++) s += dimH(xs[i], xs[i + 1], -34, C.fmt(xs[i + 1] - xs[i]), '', null);
    for (let i = 0; i < ys.length - 1; i++) s += dimV(ys[i], ys[i + 1], -34, C.fmt(ys[i + 1] - ys[i]), '', null);
    // right-hand chain: grid lines touching the right boundary
    const rys = C.uniq(m.rooms.filter((r) => C.near(r.r[2], PLOT.w)).flatMap((r) => [r.r[1], r.r[3]]));
    const xr = PW + 28;
    for (let i = 0; i < rys.length - 1; i++) {
      const a = u(rys[i]), b = u(rys[i + 1]);
      s += `<line x1="${xr}" y1="${a - 3}" x2="${xr}" y2="${b + 3}"/><line class="tick" x1="${xr - 2.5}" y1="${a + 2.5}" x2="${xr + 2.5}" y2="${a - 2.5}"/><line class="tick" x1="${xr - 2.5}" y1="${b + 2.5}" x2="${xr + 2.5}" y2="${b - 2.5}"/>`;
      s += `<text x="${xr + 8}" y="${(a + b) / 2}" transform="rotate(-90 ${xr + 8} ${(a + b) / 2})" ${b - a < 30 ? 'font-size="5.6"' : ''}>${C.fmt(rys[i + 1] - rys[i])}</text>`;
    }
    // grid extension ticks along the plot edges
    xs.forEach((x) => { s += `<line class="ext" x1="${u(x)}" y1="-40" x2="${u(x)}" y2="-4"/>`; });
    ys.forEach((y) => { s += `<line class="ext" x1="-40" y1="${u(y)}" x2="-4" y2="${u(y)}"/>`; });
    // wall-thickness callout on the left boundary wall
    const yy = u(PLOT.d * 0.08);
    s += `<g><line x1="0" y1="${yy}" x2="${u(C.WALL.ext)}" y2="${yy}" class="tick"/><text x="${u(C.WALL.ext) + 2}" y="${yy - 3}" style="text-anchor:start;font-size:5.4px">9" ext.</text></g>`;
    return `<g class="dim">${s}</g>`;
  }

  /* ------------------------------------------------- sheet furniture */

  function northArrow(facing) {
    const rot = { S: 0, N: 180, E: 90, W: -90 }[facing] || 0;
    const cx = PW + 44, cy = -66;
    return `<g transform="translate(${cx},${cy}) rotate(${rot})">
      <circle r="17" class="na2"/>
      <path d="M0 -15 L6 6 L0 2 Z" class="na"/><path d="M0 -15 L-6 6 L0 2 Z" class="na2"/>
      <text class="nat" y="-20" transform="rotate(${-rot} 0 -24)">N</text></g>`;
  }

  function roadBand(facing) {
    const y = PD + 14;
    const dir = { S: 'SOUTH', N: 'NORTH', E: 'EAST', W: 'WEST' }[facing];
    return `<g><rect class="road" x="-24" y="${y}" width="${PW + 48}" height="40"/>
      <line class="roadc" x1="-24" y1="${y + 20}" x2="${PW + 24}" y2="${y + 20}"/>
      <text class="roadt" x="${PW / 2}" y="${y + 14}">▲  ROAD · FRONT ACCESS  ▲</text>
      <text class="roadt" x="${PW / 2}" y="${y + 33}" style="font-size:6.5px;letter-spacing:2px">${dir}-FACING FRONTAGE ${C.fmt(PLOT.w)}</text></g>`;
  }

  function scaleBar(x, y) {
    let s = '';
    const marks = [0, 2.5, 5, 10, 20];
    for (let i = 0; i < marks.length - 1; i++) {
      s += `<rect x="${x + u(marks[i])}" y="${y}" width="${u(marks[i + 1] - marks[i])}" height="4" fill="${i % 2 ? '#ffffff' : '#1f2328'}" class="sb"/>`;
    }
    marks.forEach((v) => { s += `<text class="sbt" x="${x + u(v)}" y="${y + 11}">${v}'</text>`; });
    return s;
  }

  function titleBlock(m, opts) {
    const y = PD + 64, x = -MARGIN.l + 14, w = VIEW.w - 28, h = 128;
    const covered = m.rooms.filter((r) => !C.isOpen(r)).reduce((s, r) => s + C.rw(r) * C.rh(r), 0);
    const L = m.layout;
    const sp = L.stair;
    let s = `<rect class="tb" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    s += `<line class="tbl" x1="${x + w * 0.58}" y1="${y}" x2="${x + w * 0.58}" y2="${y + h}"/>`;
    s += `<text class="tbk" x="${x + 10}" y="${y + 14}">DRAWING</text>`;
    s += `<text class="tbt" x="${x + 10}" y="${y + 32}">${esc(m.floor.name.toUpperCase())} PLAN</text>`;
    s += `<text class="tbs" x="${x + 10}" y="${y + 46}">${esc(L.name)}</text>`;
    s += `<text class="tbs" x="${x + 10}" y="${y + 58}">Double-storey residence · Faisalabad, Punjab · Modern Pakistani</text>`;
    s += `<text class="tbk" x="${x + 10}" y="${y + 76}">SCALE</text>`;
    s += `<text class="tbs" x="${x + 10}" y="${y + 87}">12 units = 1'-0" (1 unit = 1") · 1:100 on A3</text>`;
    s += scaleBar(x + 10, y + 95);
    const cx = x + w * 0.58 + 10;
    const rows = [
      ['PLOT', `${C.fmt(PLOT.w)} × ${C.fmt(PLOT.d)} = 1,600 sq ft`],
      ['COVERED AREA', `${C.fmtArea(covered)} (${Math.round((covered / 1600) * 100)}% of plot)`],
      ['WALLS', `External 9" · Internal 4½" · Boundary 4½"`],
      ['FLOOR HEIGHT', `${C.fmt(sp.floorH / 12)} · ${sp.risers} risers @ ${sp.riser}"`],
    ];
    rows.forEach(([k, v], i) => {
      s += `<text class="tbk" x="${cx}" y="${y + 14 + i * 21}">${k}</text><text class="tbs" x="${cx}" y="${y + 24 + i * 21}">${esc(v)}</text>`;
    });
    s += `<text class="tbn" x="${cx}" y="${y + h - 10}">Conceptual layout only — not for construction. Verify with a</text>`;
    s += `<text class="tbn" x="${cx}" y="${y + h - 3}">licensed architect, structural engineer and FDA/LDA by-laws.</text>`;
    if (opts.legend !== false) {
      const lx = PW - 112, ly = y - 10;
      s += `<g transform="translate(${lx},${ly})"><rect width="9" height="4" class="wall"/><text class="lg" x="12" y="4">Wall</text>
        <rect x="38" width="9" height="4" fill="url(#${opts.pre}-hatch)"/><text class="lg" x="50" y="4">Boundary / parapet</text>
        <rect x="108" y="-1" width="6" height="6" class="col"/><text class="lg" x="117" y="4">Column</text></g>`;
    }
    return s;
  }

  /* ---------------------------------------------------------- public */

  function floorSVG(layout, level, opts = {}) {
    const m = opts.model || C.compute(layout, level);
    const layers = Object.assign({ furniture: true, dims: true, walls: true, columns: true, labels: true }, opts.layers || {});
    const pre = opts.idPrefix || `fp${level}`;
    const interactive = !!opts.interactive;
    const cols = C.computeColumns(layout);
    let g = '';
    g += `<rect class="prop" x="0" y="0" width="${PW}" height="${PD}"/>`;
    g += `<g class="rooms">${drawRooms(m, interactive)}</g>`;
    g += drawVoids(m);
    if (!layers.walls) g += drawOutlines(m);
    if (layers.furniture) g += `<g class="furniture" pointer-events="none">${m.furniture.map(FP.furniture.draw).join('')}</g>`;
    g += `<g pointer-events="none">${drawStair(m)}</g>`;
    if (layers.walls) g += `<g class="walls" pointer-events="none">${drawWalls(m)}</g>`;
    if (layers.walls) g += `<g class="openings" pointer-events="none">${m.openings.map(drawOpening).join('')}</g>`;
    if (layers.columns) g += `<g class="columns" pointer-events="none">${drawColumns(cols)}</g>`;
    if (opts.selected) {
      const r = m.rooms.find((x) => x.id === opts.selected);
      if (r) g += `<rect class="sel" x="${u(r.r[0])}" y="${u(r.r[1])}" width="${u(C.rw(r))}" height="${u(C.rh(r))}"/>`;
    }
    if (layers.labels) g += `<g class="labels">${drawLabels(m, layers)}</g>`;
    if (layers.dims) g += drawDims(m);
    const sheet = `<rect class="sheet" x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}"/>`;
    const extras = northArrow(opts.facing || 'S') + roadBand(opts.facing || 'S') + titleBlock(m, Object.assign({ pre }, opts));
    const size = opts.size ? ` width="${opts.size.w}" height="${opts.size.h}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}"${size} class="plan-svg" data-level="${level}" role="img" aria-label="${esc(m.floor.name)} plan">` +
      `<title>${esc(layout.name)} — ${esc(m.floor.name)}</title>${defs(pre)}${sheet}<g class="plan">${g}</g>${extras}</svg>`;
  }

  /** Both floors side by side on one sheet (PNG export / overview). */
  function sheetSVG(layout, opts = {}) {
    const gap = 24;
    const W = VIEW.w * 2 + gap, H = VIEW.h + 40;
    const parts = [0, 1].map((lvl) => floorSVG(layout, lvl, Object.assign({}, opts, { idPrefix: `sh${lvl}`, size: null }))
      .replace('<svg ', `<svg x="${lvl * (VIEW.w + gap)}" y="40" width="${VIEW.w}" height="${VIEW.h}" `));
    const head = `<text x="18" y="27" style="font:800 16px Inter,'Segoe UI',Arial,sans-serif;fill:#1f2328;letter-spacing:1px">${esc(layout.name.toUpperCase())}</text>` +
      `<text x="${W - 18}" y="27" style="font:500 9px Inter,'Segoe UI',Arial,sans-serif;fill:#3b4048;text-anchor:end">32'-0" × 50'-0" plot · Faisalabad · Ground + First floor</text>`;
    const size = opts.size ? ` width="${opts.size.w}" height="${opts.size.h}"` : ` width="${W}" height="${H}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${size}><rect width="${W}" height="${H}" fill="#ffffff"/>${head}${parts.join('')}</svg>`;
  }

  FP.render = { floorSVG, sheetSVG, VIEW, MARGIN };
})(globalThis.FP = globalThis.FP || {});

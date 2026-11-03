/*
 * Furniture & fixture symbols. Each symbol draws in a LOCAL frame measured in feet:
 *   x: 0..W along the wall the item backs onto, y: 0..D away from that wall.
 * The renderer rotates/translates the symbol into place; output units are SVG units (inches).
 */
(function (FP) {
  'use strict';
  const S = FP.core.SCALE;
  const n = (v) => +(v * S).toFixed(2);

  const rect = (x, y, w, h, cls = 'f', rx = 0) =>
    `<rect class="${cls}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}"` : ''}/>`;
  const line = (x1, y1, x2, y2, cls = 'fl') => `<line class="${cls}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`;
  const circ = (cx, cy, r, cls = 'f') => `<circle class="${cls}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/>`;
  const ell = (cx, cy, rx, ry, cls = 'f') => `<ellipse class="${cls}" cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"/>`;
  const path = (d, cls = 'f') => `<path class="${cls}" d="${d.replace(/-?\d+(\.\d+)?/g, (m) => n(+m))}"/>`;
  const text = (x, y, s, size = 0.5, rot = 0) =>
    `<text class="ft" x="${n(x)}" y="${n(y)}" font-size="${n(size)}"${rot ? ` transform="rotate(${rot} ${n(x)} ${n(y)})"` : ''}>${s}</text>`;

  function bed(W, D) {
    let s = rect(0, 0, W, D, 'f', 0.15);
    if (W >= 4.2) {
      const pw = (W - 0.9) / 2;
      s += rect(0.3, 0.3, pw, 1.05, 'f2', 0.25) + rect(0.6 + pw, 0.3, pw, 1.05, 'f2', 0.25);
    } else s += rect(0.3, 0.3, W - 0.6, 1.05, 'f2', 0.25);
    s += line(0, D * 0.36, W, D * 0.36) + line(W * 0.58, D * 0.36, W, D * 0.6);
    return s;
  }

  const SYMBOLS = {
    bedSet(W, D, o) {
      const bw = o.bedW || 5;
      const st = (W - bw) / 2;
      const ts = Math.max(0.8, Math.min(st - 0.12, 1.6));
      let s = `<g transform="translate(${n(st)},0)">${bed(bw, D)}</g>`;
      [st - ts - 0.06, st + bw + 0.06].forEach((x) => {
        s += rect(x, 0.06, ts, ts * 0.9, 'f') + circ(x + ts / 2, 0.06 + ts * 0.45, ts * 0.22, 'fl');
      });
      return s;
    },
    wardrobe(W, D) {
      let s = rect(0, 0, W, D, 'f') + line(0, D - 0.12, W, D - 0.12) + line(0.1, D / 2, W - 0.1, D / 2, 'fd');
      for (let x = 0.4; x < W - 0.2; x += 0.55) s += line(x - 0.12, D / 2 - 0.45, x + 0.12, D / 2 + 0.45);
      return s;
    },
    dresser(W, D) {
      return rect(0, 0, W, D, 'f') + rect(0.25, 0.08, W - 0.5, 0.18, 'f2') + line(W / 2, 0.3, W / 2, D);
    },
    sofa(W, D) {
      let s = rect(0, 0, W, D, 'f', 0.25) + rect(0, 0, W, 0.75, 'f2', 0.2) + rect(0, 0, 0.6, D, 'f2', 0.2) + rect(W - 0.6, 0, 0.6, D, 'f2', 0.2);
      const seats = Math.max(1, Math.round((W - 1.2) / 2.1));
      const sw = (W - 1.2) / seats;
      for (let i = 1; i < seats; i++) s += line(0.6 + i * sw, 0.75, 0.6 + i * sw, D - 0.1);
      return s;
    },
    armchair(W, D) {
      return rect(0, 0, W, D, 'f', 0.25) + rect(0, 0, W, 0.7, 'f2', 0.2) + rect(0, 0, 0.5, D, 'f2', 0.2) + rect(W - 0.5, 0, 0.5, D, 'f2', 0.2);
    },
    coffee(W, D) { return rect(0, 0, W, D, 'f', 0.25) + rect(0.2, 0.2, W - 0.4, D - 0.4, 'fl', 0.15); },
    side(W, D) { return rect(0, 0, W, D, 'f') + circ(W / 2, D / 2, Math.min(W, D) * 0.25, 'fl'); },
    tv(W, D) { return rect(0, 0, W, D, 'f2') + rect(W * 0.12, 0.18, W * 0.76, 0.22, 'fdk') + text(W / 2, D * 0.82, 'TV', 0.45); },
    dining(W, D) {
      const tx = 1.0, ty = 1.0, tw = W - 2, td = D - 2;
      let s = '';
      const count = Math.max(2, Math.floor(tw / 1.5));
      for (let i = 0; i < count; i++) {
        const cx = tx + (tw / count) * (i + 0.5);
        s += rect(cx - 0.6, 0.12, 1.2, 1.0, 'f', 0.12) + line(cx - 0.6, 0.3, cx + 0.6, 0.3);
        s += rect(cx - 0.6, D - 1.12, 1.2, 1.0, 'f', 0.12) + line(cx - 0.6, D - 0.3, cx + 0.6, D - 0.3);
      }
      s += rect(0.12, D / 2 - 0.6, 1.0, 1.2, 'f', 0.12) + rect(W - 1.12, D / 2 - 0.6, 1.0, 1.2, 'f', 0.12);
      return s + rect(tx, ty, tw, td, 'f', 0.1) + rect(tx + 0.25, ty + 0.25, tw - 0.5, td - 0.5, 'fl', 0.05);
    },
    counter(W, D, o) {
      let s = rect(0, 0, W, D, 'f2') + line(0, D - 0.12, W, D - 0.12);
      if (o.sink != null) {
        const cx = o.sink * W;
        s += rect(cx - 1.25, 0.35, 1.15, 1.3, 'f', 0.15) + rect(cx + 0.1, 0.35, 1.15, 1.3, 'f', 0.15) + circ(cx, 0.22, 0.09, 'fl');
      }
      if (o.hob != null) {
        const cx = o.hob * W;
        s += rect(cx - 1.05, 0.2, 2.1, 1.6, 'fl', 0.1);
        [[-0.48, 0.62], [0.48, 0.62], [-0.48, 1.38], [0.48, 1.38]].forEach(([dx, dy], i) => { s += circ(cx + dx, dy, i % 3 ? 0.24 : 0.3, 'fl'); });
      }
      return s;
    },
    fridge(W, D) { return rect(0, 0, W, D, 'f') + line(0, D - 0.15, W, D - 0.15) + text(W / 2, D / 2 + 0.2, 'REF', 0.5); },
    wc(W, D) { return rect(0.15, 0, W - 0.3, 0.55, 'f', 0.08) + ell(W / 2, 0.55 + (D - 0.55) / 2, W * 0.38, (D - 0.55) / 2 - 0.03); },
    basin(W, D) { return rect(0, 0, W, D, 'f2', 0.12) + ell(W / 2, D * 0.56, W * 0.33, D * 0.3) + circ(W / 2, 0.18, 0.08, 'fl'); },
    shower(W, D) { return rect(0, 0, W, D, 'f2') + line(0, 0, W, D) + line(W, 0, 0, D) + circ(W / 2, D / 2, 0.14, 'f') + circ(W / 2, 0.25, 0.15, 'fl'); },
    wm(W, D) { return rect(0, 0, W, D, 'f', 0.15) + circ(W / 2, D / 2 + 0.08, Math.min(W, D) * 0.32) + circ(W / 2, D / 2 + 0.08, Math.min(W, D) * 0.18, 'fl') + text(W / 2, 0.42, 'WM', 0.32); },
    utilsink(W, D) { return rect(0, 0, W, D, 'f2', 0.1) + rect(0.2, 0.25, W - 0.4, D - 0.45, 'f', 0.12); },
    car(W, D) {
      let s = '';
      [[0.05, 2.0], [W - 0.4, 2.0], [0.05, D - 4.0], [W - 0.4, D - 4.0]].forEach(([x, y]) => { s += rect(x, y, 0.35, 1.9, 'fdk', 0.08); });
      s += rect(0.25, 0, W - 0.5, D, 'f', 1.1);
      s += path(`M 0.75 3.6 L ${W - 0.75} 3.6 L ${W - 1.05} 5.4 L 1.05 5.4 Z`, 'f2');
      s += rect(1.05, 5.4, W - 2.1, 5.6, 'fl', 0.35);
      s += path(`M 1.05 11.0 L ${W - 1.05} 11.0 L ${W - 0.8} 12.4 L 0.8 12.4 Z`, 'f2');
      s += line(0.6, 1.2, W - 0.6, 1.2) + line(0.25, 5.0, -0.05, 4.8) + line(W - 0.25, 5.0, W + 0.05, 4.8);
      return s;
    },
    plant(W, D) {
      const r = Math.min(W, D) / 2;
      let s = circ(W / 2, D / 2, r * 0.95, 'f');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        s += circ(W / 2 + Math.cos(a) * r * 0.45, D / 2 + Math.sin(a) * r * 0.45, r * 0.32, 'fl');
      }
      return s;
    },
    planter(W, D) {
      let s = rect(0, 0, W, D, 'f2', 0.1);
      for (let x = 0.7; x < W - 0.3; x += 1.25) s += circ(x, D / 2, D * 0.32, 'fl');
      return s;
    },
    desk(W, D) { return rect(0, 0, W, D * 0.6, 'f') + rect(W / 2 - 0.7, D * 0.66, 1.4, D * 0.32, 'f', 0.15) + line(W / 2 - 0.7, D * 0.7, W / 2 + 0.7, D * 0.7); },
    shelf(W, D) {
      let s = rect(0, 0, W, D, 'f');
      for (let x = 1; x < W - 0.2; x += 1) s += line(x, 0, x, D);
      return s;
    },
    mat(W, D) { return rect(0, 0, W, D, 'fd') + path(`M ${W * 0.2} 0.9 Q ${W / 2} 0.1 ${W * 0.8} 0.9`, 'fl'); },
    outdoor(W, D) {
      const cx = W / 2, cy = D / 2, m = Math.min(W, D);
      let s = '';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        s += circ(cx + Math.cos(a) * m * 0.36, cy + Math.sin(a) * m * 0.36, m * 0.13, 'f');
      }
      return s + circ(cx, cy, m * 0.22, 'f') + circ(cx, cy, m * 0.06, 'fl');
    },
    rug(W, D) { return rect(0, 0, W, D, 'rug') + rect(0.35, 0.35, W - 0.7, D - 0.7, 'rug'); },
  };

  /** SVG transform that maps the local (along, depth) frame onto the placed item box. */
  function transformFor(it) {
    switch (it.rot) {
      case 0: return `translate(${n(it.x)},${n(it.y)})`;
      case 180: return `translate(${n(it.x + it.lw)},${n(it.y + it.ld)}) rotate(180)`;
      case 270: return `translate(${n(it.x)},${n(it.y + it.lw)}) rotate(-90)`;
      case 90: return `translate(${n(it.x + it.ld)},${n(it.y)}) rotate(90)`;
      default: throw new Error('rotation must be 0/90/180/270');
    }
  }

  function draw(it) {
    const fn = SYMBOLS[it.kind];
    if (!fn) return '';
    return `<g class="furn" transform="${transformFor(it)}">${fn(it.lw, it.ld, it.opts || {})}</g>`;
  }

  FP.furniture = { draw, SYMBOLS };
})(globalThis.FP = globalThis.FP || {});

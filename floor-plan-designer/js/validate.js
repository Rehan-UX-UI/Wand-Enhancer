/*
 * Basic architectural layout validation. Produces a list of findings:
 *   level: 'error' | 'warn' | 'info' | 'ok'
 * These are planning sanity checks only — not a structural or by-law certification.
 */
(function (FP) {
  'use strict';
  const C = FP.core;
  const { PLOT, EPS } = C;

  const MIN_CLEAR = {
    bed: [9, 9], bath: [3.5, 4], kitchen: [7, 7], living: [10, 10], drawing: [9, 9],
    dining: [6.5, 6.5], study: [7, 7], laundry: [3.5, 2.5], lobby: [3, 3], stair: [7, 10],
  };
  const NO_COLLIDE = new Set(['rug', 'mat']);
  const ftin = C.fmt;

  function validate(layout) {
    const issues = [];
    const add = (level, cat, msg, ref) => issues.push(Object.assign({ level, cat, msg }, ref || {}));
    const models = layout.floors.map((_, i) => C.compute(layout, i));

    /* ---------------------------------------------------------- plot */
    if (PLOT.w === 32 && PLOT.d === 50) add('ok', 'Plot', `Plot boundary is exactly ${ftin(PLOT.w)} × ${ftin(PLOT.d)} (1,600 sq ft).`);
    else add('error', 'Plot', `Plot is ${ftin(PLOT.w)} × ${ftin(PLOT.d)}, expected 32'-0" × 50'-0".`);

    models.forEach((m) => {
      const fl = m.floor.name;
      const ref = (r) => ({ floor: m.level, room: r && r.id });
      let floorErrors = 0;

      /* --------------------------------------------- bounds & sizes */
      m.rooms.forEach((r) => {
        const [x0, y0, x1, y1] = r.r;
        if (x0 < -EPS || y0 < -EPS || x1 > PLOT.w + EPS || y1 > PLOT.d + EPS) {
          add('error', 'Plot boundary', `${fl}: ${r.name} extends beyond the 32' × 50' plot.`, ref(r)); floorErrors++;
        }
        if (x1 - x0 <= 0 || y1 - y0 <= 0) { add('error', 'Dimensions', `${fl}: ${r.name} has an invalid size.`, ref(r)); floorErrors++; return; }
        const cl = m.clear[r.id];
        const cw = cl.x1 - cl.x0, ch = cl.y1 - cl.y0;
        const min = MIN_CLEAR[r.type];
        if (min) {
          const small = Math.min(cw, ch), big = Math.max(cw, ch);
          if (small < Math.min(...min) - 0.01 || big < Math.max(...min) - 0.01) {
            add('warn', 'Dimensions', `${fl}: ${r.name} is ${ftin(cw)} × ${ftin(ch)} clear — below the practical minimum of ${ftin(min[0])} × ${ftin(min[1])}.`, ref(r));
          }
        }
      });
      const walledOut = m.pieces.filter((p) => {
        const lo = p.center - p.t / 2, hi = p.center + p.t / 2;
        const max = p.axis === 'h' ? PLOT.d : PLOT.w;
        return lo < -EPS || hi > max + EPS || p.a < -EPS || p.b > (p.axis === 'h' ? PLOT.w : PLOT.d) + EPS;
      });
      if (walledOut.length) { add('error', 'Plot boundary', `${fl}: ${walledOut.length} wall segment(s) cross the plot line.`, { floor: m.level }); floorErrors++; }

      /* ------------------------------------------------- overlaps */
      for (let i = 0; i < m.rooms.length; i++) {
        for (let j = i + 1; j < m.rooms.length; j++) {
          const hit = C.rectIntersect(C.toRect(m.rooms[i]), C.toRect(m.rooms[j]));
          if (hit && hit.area > 0.01) {
            add('error', 'Overlap', `${fl}: ${m.rooms[i].name} overlaps ${m.rooms[j].name} by ${hit.area.toFixed(1)} sq ft.`, ref(m.rooms[i])); floorErrors++;
          }
        }
      }
      if (m.level === 0) {
        const total = m.rooms.reduce((s, r) => s + C.rw(r) * C.rh(r), 0);
        const gap = PLOT.w * PLOT.d - total;
        if (gap > 0.5) add('warn', 'Coverage', `${fl}: ${gap.toFixed(1)} sq ft of the plot is not assigned to any space.`, { floor: 0 });
      }
      if (!floorErrors) add('ok', 'Plot boundary', `${fl}: all rooms and walls stay inside the plot, no overlapping rooms.`, { floor: m.level });

      /* ------------------------------------------------- openings */
      let openingIssues = 0;
      m.openings.forEach((o) => {
        const cl = m.clear[o.room.id];
        const lo = o.axis === 'h' ? cl.x0 : cl.y0, hi = o.axis === 'h' ? cl.x1 : cl.y1;
        const label = `${o.room.name} ${kindName(o.kind)}`;
        if (o.a < lo - 0.02 || o.b > hi + 0.02) {
          add('error', 'Doors & windows', `${fl}: ${label} runs into the corner wall (needs ${ftin(o.w)} within ${ftin(hi - lo)} clear).`, ref(o.room)); openingIssues++;
        }
        if ((o.kind === 'win' || o.kind === 'vent') && o.sideBoundary) {
          add('warn', 'Doors & windows', `${fl}: ${label} is on a party wall (side boundary) — not permitted next to a neighbour.`, ref(o.room)); openingIssues++;
        }
        if ((o.kind === 'win' || o.kind === 'vent') && o.seg && o.seg.kind === 'int') {
          add('warn', 'Doors & windows', `${fl}: ${label} opens into another room, not to outside air.`, ref(o.room)); openingIssues++;
        }
        if (o.kind === 'door' && o.room.type === 'bed' && o.w < 2.75 - EPS) add('info', 'Doors & windows', `${fl}: ${label} is ${ftin(o.w)} wide; 2'-9"–3'-0" is preferred for bedrooms.`, ref(o.room));
      });
      for (let i = 0; i < m.openings.length; i++) {
        for (let j = i + 1; j < m.openings.length; j++) {
          const p = m.openings[i], q = m.openings[j];
          if (p.axis === q.axis && C.near(p.c, q.c) && Math.min(p.b, q.b) - Math.max(p.a, q.a) > 0.05) {
            add('error', 'Doors & windows', `${fl}: ${p.room.name} ${kindName(p.kind)} overlaps ${q.room.name} ${kindName(q.kind)} on the same wall.`, ref(p.room)); openingIssues++;
          }
        }
      }
      const zones = m.openings.map((o) => ({ o, z: C.swingZone(o) })).filter((x) => x.z);
      for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
          const hit = C.rectIntersect(zones[i].z, zones[j].z);
          if (hit && hit.area > 0.05) {
            add('warn', 'Doors & windows', `${fl}: door swings of ${zones[i].o.room.name} and ${zones[j].o.room.name} collide.`, ref(zones[i].o.room)); openingIssues++;
          }
        }
      }
      if (!openingIssues) add('ok', 'Doors & windows', `${fl}: ${m.openings.length} doors/windows placed with no wall-corner, party-wall or swing conflicts.`, { floor: m.level });

      /* ------------------------------------------------ furniture */
      let furnIssues = 0;
      m.furniture.forEach((f) => {
        const box = { x0: f.x, y0: f.y, x1: f.x + f.w, y1: f.y + f.h };
        if (!C.rectInside(box, m.clear[f.room.id])) {
          add('warn', 'Furniture', `${fl}: ${furnName(f.kind)} in ${f.room.name} overlaps a wall.`, ref(f.room)); furnIssues++;
        }
        zones.forEach(({ o, z }) => {
          if (NO_COLLIDE.has(f.kind)) return;
          const hit = C.rectIntersect(box, z);
          if (hit && hit.area > 0.05) {
            add('warn', 'Furniture', `${fl}: ${furnName(f.kind)} in ${f.room.name} blocks the ${o.room.name} door swing.`, ref(f.room)); furnIssues++;
          }
        });
        if (f.room.type === 'stair') { add('warn', 'Staircase', `${fl}: furniture placed inside the stair hall.`, ref(f.room)); furnIssues++; }
      });
      for (let i = 0; i < m.furniture.length; i++) {
        for (let j = i + 1; j < m.furniture.length; j++) {
          const p = m.furniture[i], q = m.furniture[j];
          if (p.room !== q.room || NO_COLLIDE.has(p.kind) || NO_COLLIDE.has(q.kind)) continue;
          const hit = C.rectIntersect({ x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h }, { x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h });
          if (hit && hit.area > 0.05) { add('warn', 'Furniture', `${fl}: ${furnName(p.kind)} and ${furnName(q.kind)} overlap in ${p.room.name}.`, ref(p.room)); furnIssues++; }
        }
      }
      if (!furnIssues) add('ok', 'Furniture', `${fl}: ${m.furniture.length} furniture/fixture items sit inside room walls and clear of door swings.`, { floor: m.level });

      /* ------------------------------------- daylight & ventilation */
      m.rooms.filter((r) => C.HABITABLE.has(r.type)).forEach((r) => {
        const lit = m.openings.some((o) => o.room === r && ['win', 'slide', 'door2'].includes(o.kind) && !o.sideBoundary && (!o.seg || o.seg.kind !== 'int'));
        if (!lit) add('warn', 'Ventilation', `${fl}: ${r.name} has no window to outside air or a court.`, ref(r));
      });
      m.rooms.filter((r) => r.type === 'bath').forEach((r) => {
        const vent = m.openings.some((o) => o.room === r && (o.kind === 'vent' || o.kind === 'win') && (!o.seg || o.seg.kind !== 'int'));
        if (!vent) add('info', 'Ventilation', `${fl}: ${r.name} is internal — provide a mechanical exhaust fan / duct.`, ref(r));
      });

      /* ------------------------------------------------ circulation */
      const graph = connectivity(m);
      const start = m.level === 0 ? 'outside' : m.stairRoom && m.stairRoom.id;
      const seen = bfs(graph, start);
      const unreachable = m.rooms.filter((r) => !C.isVoid(r) && !seen.has(r.id));
      unreachable.forEach((r) => add('error', 'Circulation', `${fl}: ${r.name} cannot be reached through any door or opening.`, ref(r)));
      if (!unreachable.length) add('ok', 'Circulation', `${fl}: every room is reachable from the ${m.level === 0 ? 'road gate' : 'staircase'}.`, { floor: m.level });

      m.rooms.forEach((r) => {
        if (C.isOpen(r) || r.type === 'stair' || r.type === 'lobby') return;
        const cl = m.clear[r.id];
        const area = (cl.x1 - cl.x0) * (cl.y1 - cl.y0);
        const used = m.furniture.filter((f) => f.room === r && !NO_COLLIDE.has(f.kind)).reduce((s, f) => s + f.w * f.h, 0);
        const free = 1 - used / area;
        if (free < 0.3) add('warn', 'Circulation', `${fl}: ${r.name} is tight — only ${Math.round(free * 100)}% free floor after furniture.`, ref(r));
      });
      m.rooms.filter((r) => r.type === 'lobby').forEach((r) => {
        const cl = m.clear[r.id];
        if (Math.min(cl.x1 - cl.x0, cl.y1 - cl.y0) < 3) add('warn', 'Circulation', `${fl}: ${r.name} is narrower than 3'-0" clear.`, ref(r));
      });

      if (m.level === 0 && m.stairRoom) {
        const byId = new Map(m.rooms.map((r) => [r.id, r]));
        const allow = (id) => id === 'outside' || id === m.stairRoom.id || (byId.has(id) && C.isOpen(byId.get(id)));
        const openOnly = bfs(graph, 'outside', allow);
        if (openOnly.has(m.stairRoom.id)) add('ok', 'Staircase', 'Stair hall is entered straight from the porch/road — the first floor can be used as an independent unit.', { floor: 0, room: m.stairRoom.id });
        else add('warn', 'Staircase', 'Stair hall can only be reached through ground-floor rooms — first floor cannot function independently.', { floor: 0 });
      }
    });

    /* ---------------------------------------------------- staircase */
    stairChecks(layout, models, add);

    /* ------------------------------------------ floor coordination */
    const [gf, ff] = models;
    if (gf && ff) {
      ff.rooms.forEach((r) => {
        if (C.isVoid(r)) return;
        const below = gf.rooms.map((g) => ({ g, hit: C.rectIntersect(C.toRect(r), C.toRect(g)) })).filter((x) => x.hit && x.hit.area > 0.05);
        below.forEach(({ g }) => {
          if (C.isVoid(g) && !C.isOpen(r)) add('error', 'Floor coordination', `First Floor: ${r.name} is built over the ${g.name}, blocking its light and air.`, { floor: 1, room: r.id });
          if (C.WET.has(r.type) && r.type !== 'kitchen' && ['bed', 'drawing'].includes(g.type)) add('warn', 'Floor coordination', `First Floor: ${r.name} sits above ${g.name} — waterproof the slab and re-route drainage.`, { floor: 1, room: r.id });
          if (!C.isOpen(r) && g.type === 'porch') add('info', 'Floor coordination', `First Floor: ${r.name} projects over the car porch — needs beams on the porch columns.`, { floor: 1, room: r.id });
        });
      });
      const wetStack = ff.rooms.filter((r) => r.type === 'bath').filter((r) => gf.rooms.some((g) => C.WET.has(g.type) && (C.rectIntersect(C.toRect(r), C.toRect(g)) || { area: 0 }).area > 4));
      add('info', 'Floor coordination', `${wetStack.length} of ${ff.rooms.filter((r) => r.type === 'bath').length} first-floor bathrooms stack over ground-floor wet areas (shared plumbing shafts).`, { floor: 1 });
      const cols = C.computeColumns(layout);
      add('ok', 'Structure', `${cols.length} conceptual column positions shared by both floors (9" × 9" placeholders, to be sized by a structural engineer).`);
    }

    const counts = { error: 0, warn: 0, info: 0, ok: 0 };
    issues.forEach((i) => { counts[i.level]++; });
    return { issues, counts, models };
  }

  function stairChecks(layout, models, add) {
    const sp = layout.stair;
    const stairs = models.map((m) => m.stairRoom);
    if (stairs.some((s) => !s)) { add('error', 'Staircase', 'A floor has no staircase.'); return; }
    const same = stairs.every((s) => s.r.every((v, i) => C.near(v, stairs[0].r[i])));
    if (same) add('ok', 'Staircase', `Stair well is identical on both floors (${C.fmt(C.rw(stairs[0]))} × ${C.fmt(C.rh(stairs[0]))}).`, { floor: 0, room: stairs[0].id });
    else add('error', 'Staircase', 'Stair well position differs between floors — flights will not connect.', { floor: 1, room: stairs[1].id });

    const g = models[0].stair;
    const twoRT = 2 * sp.riser + sp.tread;
    if (Math.abs(sp.risers * sp.riser - sp.floorH) > 0.5) add('error', 'Staircase', `${sp.risers} risers × ${sp.riser}" = ${sp.risers * sp.riser}" does not match the ${sp.floorH}" floor-to-floor height.`);
    else add('ok', 'Staircase', `${sp.risers} risers × ${sp.riser}" = ${C.fmt(sp.floorH / 12)} floor-to-floor; ${g.perFlight} risers per flight.`);
    if (sp.riser > 7.5 || sp.riser < 5.5) add('warn', 'Staircase', `Riser ${sp.riser}" is outside the comfortable 6"–7½" range.`);
    if (sp.tread < 9) add('warn', 'Staircase', `Tread ${sp.tread}" is shallower than 9".`);
    if (twoRT < 23.5 || twoRT > 25.5) add('warn', 'Staircase', `2R + T = ${twoRT}" (comfortable range 24"–25").`);
    else add('ok', 'Staircase', `Riser ${sp.riser}" / tread ${sp.tread}" — 2R + T = ${twoRT}" (comfortable).`);
    if (g.fw < 3 - 0.01) add(g.fw < 2.75 ? 'error' : 'warn', 'Staircase', `Flight width ${C.fmt(g.fw)} is below 3'-0".`);
    else add('ok', 'Staircase', `Flight width ${C.fmt(g.fw)}, half landing ${C.fmt(g.land)} deep.`);
    if (!g.fits) add('error', 'Staircase', `Flights (${C.fmt(g.fl)}) + landing (${C.fmt(g.land)}) do not fit the ${C.fmt(g.L)} stair well.`, { floor: 0, room: stairs[0].id });
    else add('ok', 'Staircase', `Flights ${C.fmt(g.fl)} + landing ${C.fmt(g.land)} fit the ${C.fmt(g.L)} well with a ${C.fmt(g.v0)} arrival lobby.`);
    const headroom = sp.floorH - sp.slab;
    if (headroom < 84) add('error', 'Staircase', `Headroom ${C.fmt(headroom / 12)} is under 7'-0".`);
    else add('ok', 'Staircase', `Headroom under the slab ${C.fmt(headroom / 12)} (min 7'-0").`);

    models.forEach((m) => {
      const s = m.stair, room = m.stairRoom;
      const [ax, ay] = s.map(0, 0), [bx, by] = s.map(s.W, Math.max(s.v0, 0.5));
      const lobby = { x0: Math.min(ax, bx) - 0.8, x1: Math.max(ax, bx) + 0.8, y0: Math.min(ay, by) - 0.8, y1: Math.max(ay, by) + 0.8 };
      const doors = m.openings.filter((o) => C.PASSABLE.has(o.kind) && touchesRoom(o, room) && inRect(midpoint(o), lobby));
      if (!doors.length) add('error', 'Staircase', `${m.floor.name}: no door reaches the stair at its ${m.level === 0 ? 'starting' : 'arrival'} landing.`, { floor: m.level, room: room.id });
      else add('ok', 'Staircase', `${m.floor.name}: stair ${m.level === 0 ? 'starts' : 'arrives'} at a lobby served by ${doors.length} door(s).`, { floor: m.level, room: room.id });
      const blocking = m.openings.filter((o) => C.PASSABLE.has(o.kind) && touchesRoom(o, room) && !inRect(midpoint(o), lobby));
      blocking.forEach((o) => add('warn', 'Staircase', `${m.floor.name}: ${o.room.name} ${kindName(o.kind)} opens onto the flights, not the stair lobby.`, { floor: m.level, room: room.id }));
    });
  }

  const midpoint = (o) => (o.axis === 'h' ? [(o.a + o.b) / 2, o.c] : [o.c, (o.a + o.b) / 2]);
  const inRect = ([x, y], r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  function touchesRoom(o, room) {
    if (o.room === room) return true;
    const [x0, y0, x1, y1] = room.r;
    const [mx, my] = midpoint(o);
    return o.axis === 'h' ? (C.near(o.c, y0) || C.near(o.c, y1)) && mx > x0 && mx < x1 : (C.near(o.c, x0) || C.near(o.c, x1)) && my > y0 && my < y1;
  }

  /** Room adjacency graph through passable openings and open-to-open edges. */
  function connectivity(m) {
    const g = new Map();
    const link = (p, q) => {
      if (!p || !q || p === q) return;
      if (!g.has(p)) g.set(p, new Set());
      if (!g.has(q)) g.set(q, new Set());
      g.get(p).add(q); g.get(q).add(p);
    };
    m.openings.forEach((o) => {
      if (!C.PASSABLE.has(o.kind)) return;
      const t = (o.a + o.b) / 2;
      const [px, py] = C.pointOnLine(o.axis, o.c, t, o.out * 0.05);
      const outside = px < 0 || py < 0 || px > PLOT.w || py > PLOT.d;
      const nb = outside ? null : C.roomAt(m.rooms, px, py);
      link(o.room.id, outside ? 'outside' : nb && nb.id);
    });
    m.rooms.forEach((r) => {
      if (!C.isOpen(r)) return;
      m.rooms.forEach((q) => {
        if (q === r || !C.isOpen(q)) return;
        if (m.level > 0 && C.isVoid(r) !== C.isVoid(q)) return;
        if (C.isVoid(r) || C.isVoid(q)) return;
        const shared = sharedEdge(r, q);
        if (shared >= 2) link(r.id, q.id);
      });
    });
    return g;
  }
  function sharedEdge(p, q) {
    const [a0, b0, a1, b1] = p.r, [c0, d0, c1, d1] = q.r;
    if (C.near(a1, c0) || C.near(c1, a0)) return Math.min(b1, d1) - Math.max(b0, d0);
    if (C.near(b1, d0) || C.near(d1, b0)) return Math.min(a1, c1) - Math.max(a0, c0);
    return 0;
  }
  function bfs(g, start, allow) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      (g.get(n) || []).forEach((q) => {
        if (seen.has(q) || (allow && !allow(q))) return;
        seen.add(q); queue.push(q);
      });
    }
    return seen;
  }

  function kindName(k) {
    return { door: 'door', door2: 'double door', win: 'window', vent: 'ventilator', open: 'opening', slide: 'sliding door', gate: 'gate' }[k] || k;
  }
  function furnName(k) {
    return {
      bedSet: 'bed', wardrobe: 'wardrobe', dresser: 'dresser', sofa: 'sofa', armchair: 'armchair', coffee: 'coffee table', tv: 'TV unit',
      dining: 'dining set', counter: 'counter', fridge: 'fridge', wc: 'WC', basin: 'basin', shower: 'shower', wm: 'washing machine',
      utilsink: 'utility sink', car: 'car', plant: 'plant', planter: 'planter', desk: 'desk', shelf: 'shelf', mat: 'prayer mat',
      outdoor: 'outdoor table', rug: 'rug', side: 'side table',
    }[k] || k;
  }

  FP.validate = validate;
  FP.validateHelpers = { connectivity, bfs, kindName, furnName };
})(globalThis.FP = globalThis.FP || {});

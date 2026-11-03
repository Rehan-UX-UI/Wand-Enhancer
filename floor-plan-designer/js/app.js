/*
 * Application controller: state, UI panels, zoom/pan, room selection & resizing,
 * validation list, exports and the 3D view toggle.
 */
(function (FP) {
  'use strict';
  const C = FP.core;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const fresh = () => JSON.parse(JSON.stringify(FP.LAYOUTS));
  const state = {
    layouts: fresh(),
    layoutId: 'A',
    view: 'gf',
    layers: { furniture: true, dims: true, walls: true, columns: true, labels: true },
    facing: 'S',
    sel: null, // { level, id }
    vb: null,
    valFilter: 'issues',
    lv3d: '2',
    result: null,
    editMsg: null,
  };
  const layout = () => state.layouts[state.layoutId];
  const levelOfView = () => (state.view === 'ff' ? 1 : 0);
  const VIEW = FP.render.VIEW;
  const fitVB = () => ({ x: VIEW.x, y: VIEW.y, w: VIEW.w, h: VIEW.h });
  state.vb = fitVB();

  let view3d = null;

  /* ------------------------------------------------------------ render */

  function renderAll() {
    state.result = FP.validate(layout());
    renderStage();
    renderSummary();
    renderSchedule();
    renderRoom();
    renderStair();
    renderValidation();
  }

  function renderStage() {
    const L = layout();
    const canvas = $('#canvas'), c3 = $('#canvas3d');
    const is3d = state.view === '3d';
    canvas.hidden = is3d;
    c3.hidden = !is3d;
    $('.zoom').style.visibility = is3d ? 'hidden' : 'visible';
    $('.hint').textContent = is3d ? 'Conceptual massing model — walls, openings, slabs and stair flights from the plan geometry'
      : 'Click a room to inspect and resize it · scroll to zoom · drag to pan';
    const titles = { gf: 'Ground Floor Plan', ff: 'First Floor Plan', both: 'Ground + First Floor', '3d': '3D Massing' };
    $('#stageTitle').textContent = `${titles[state.view]} · ${L.name.replace(/^Option (\w) — /, 'Option $1 · ')}`;
    if (is3d) {
      if (!view3d) view3d = FP.view3d.create($('#c3d'));
      view3d.set(L, { levels: state.lv3d === '1' ? 1 : 2, roof: state.lv3d === 'roof' });
      return;
    }
    const levels = state.view === 'both' ? [0, 1] : [levelOfView()];
    canvas.innerHTML = levels.map((lvl) => FP.render.floorSVG(L, lvl, {
      model: state.result.models[lvl], layers: state.layers, facing: state.facing, interactive: true,
      idPrefix: `v${lvl}`, selected: state.sel && state.sel.level === lvl ? state.sel.id : null,
    })).join('');
    applyVB();
  }

  function applyVB() {
    const v = state.vb;
    $$('#canvas svg').forEach((svg) => svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`));
    $('#zoomLabel').textContent = `${Math.round((VIEW.w / v.w) * 100)}%`;
  }

  function renderSummary() {
    const L = layout();
    $('#layoutSummary').textContent = L.summary;
    const notes = {
      S: 'South-facing front: road side gets sun most of the day, the rear court stays shaded and cool in summer.',
      N: 'North-facing front: front rooms stay cool; the rear court receives low winter sun.',
      E: 'East-facing front: pleasant morning sun on the drawing room and porch; rear rooms take afternoon heat.',
      W: 'West-facing front: harsh afternoon sun on the front façade — add deep chhajja / jaali screening.',
    };
    $('#sunNote').textContent = notes[state.facing];
  }

  function renderSchedule() {
    const models = state.result.models;
    let html = '';
    models.forEach((m) => {
      const rows = m.rooms.filter((r) => !C.isVoid(r)).map((r) => {
        const c = m.clear[r.id];
        const sel = state.sel && state.sel.level === m.level && state.sel.id === r.id ? ' sel' : '';
        return `<tr class="r${sel}" data-level="${m.level}" data-room="${r.id}"><td>${esc(r.name)}</td><td>${C.fmt(c.x1 - c.x0)} × ${C.fmt(c.y1 - c.y0)}</td><td>${Math.round((c.x1 - c.x0) * (c.y1 - c.y0))}</td></tr>`;
      }).join('');
      const covered = m.rooms.filter((r) => !C.isOpen(r)).reduce((s, r) => s + C.rw(r) * C.rh(r), 0);
      html += `<div class="sched-floor">${esc(m.floor.name)}</div><table class="sched"><thead><tr><th>Space</th><th>Clear size</th><th>sq ft</th></tr></thead><tbody>${rows}<tr class="tot"><td colspan="2">Covered area (gross)</td><td>${Math.round(covered)}</td></tr></tbody></table>`;
    });
    const total = models.reduce((s, m) => s + m.rooms.filter((r) => !C.isOpen(r)).reduce((a, r) => a + C.rw(r) * C.rh(r), 0), 0);
    html += `<p class="muted small" style="margin-top:8px">Total covered area ≈ <b>${C.fmtArea(total)}</b> on a 1,600 sq ft plot.</p>`;
    $('#schedule').innerHTML = html;
  }

  function bathInfo(m, r) {
    if (r.type === 'bath') return null;
    if (r.attached) {
      const b = m.rooms.find((x) => x.id === r.attached);
      if (b) { const c = m.clear[b.id]; return `Attached: ${b.name} (${C.fmt(c.x1 - c.x0)} × ${C.fmt(c.y1 - c.y0)})`; }
    }
    const g = FP.validateHelpers.connectivity(m);
    const direct = [...(g.get(r.id) || [])].map((id) => m.rooms.find((x) => x.id === id)).filter((x) => x && x.type === 'bath');
    if (direct.length) return `Attached: ${direct.map((b) => b.name).join(', ')}`;
    for (const nb of g.get(r.id) || []) {
      const via = m.rooms.find((x) => x.id === nb);
      const b = [...(g.get(nb) || [])].map((id) => m.rooms.find((x) => x.id === id)).find((x) => x && x.type === 'bath');
      if (b && via) return `None — shared ${b.name} via ${via.name}`;
    }
    return r.type === 'bed' ? 'None' : null;
  }

  function editableEdge(r, axis) {
    const [i0, i1, max] = axis === 'x' ? [0, 2, C.PLOT.w] : [1, 3, C.PLOT.d];
    if (r.r[i1] < max - C.EPS) return { v: r.r[i1], sign: 1, side: axis === 'x' ? 'right (east)' : 'front' };
    if (r.r[i0] > C.EPS) return { v: r.r[i0], sign: -1, side: axis === 'x' ? 'left (west)' : 'rear' };
    return null;
  }

  function renderRoom() {
    const el = $('#roomInfo');
    if (!state.sel) { el.className = 'muted'; el.innerHTML = 'Select a room on the plan or in the area schedule.'; return; }
    const m = state.result.models[state.sel.level];
    const r = m.rooms.find((x) => x.id === state.sel.id);
    if (!r) { state.sel = null; renderRoom(); return; }
    el.className = '';
    const c = m.clear[r.id];
    const cw = c.x1 - c.x0, ch = c.y1 - c.y0;
    const doors = m.openings.filter((o) => o.room === r && C.PASSABLE.has(o.kind)).length;
    const wins = m.openings.filter((o) => o.room === r && (o.kind === 'win' || o.kind === 'vent')).length;
    const bath = bathInfo(m, r);
    const typeName = { bed: 'Bedroom', bath: 'Bathroom', kitchen: 'Kitchen', living: 'Living', dining: 'Dining', drawing: 'Guest', stair: 'Circulation', laundry: 'Service', lobby: 'Circulation', study: 'Study', porch: 'Open', lawn: 'Open', court: 'Open to sky', shaft: 'Open to sky', terrace: 'Open', balcony: 'Open' }[r.type] || r.type;
    const issues = state.result.issues.filter((i) => i.room === r.id && i.floor === m.level && i.level !== 'ok');
    const ex = editableEdge(r, 'x'), ey = editableEdge(r, 'y');
    const ftIn = (v) => { const tot = Math.round(v * 12); return [Math.floor(tot / 12), tot % 12]; };
    const [wf, wi] = ftIn(cw), [lf, li] = ftIn(ch);
    el.innerHTML = `
      <div class="room-head"><strong>${esc(r.name)}</strong><span class="chip">${esc(m.floor.name)} · ${typeName}</span></div>
      <dl class="kv">
        <dt>Width (across plot)</dt><dd>${C.fmt(cw)}</dd>
        <dt>Length (front–back)</dt><dd>${C.fmt(ch)}</dd>
        <dt>Clear floor area</dt><dd>${C.fmtArea(cw * ch)}</dd>
        <dt>Centre-line size</dt><dd>${C.fmt(C.rw(r))} × ${C.fmt(C.rh(r))}</dd>
        <dt>Doors / windows</dt><dd>${doors} / ${wins}</dd>
        ${bath ? `<dt>Bathroom</dt><dd>${esc(bath)}</dd>` : ''}
      </dl>
      ${issues.length ? `<ul class="val">${issues.map((i) => `<li class="${i.level}">${esc(i.msg)}</li>`).join('')}</ul>` : ''}
      ${(ex || ey) && r.type !== 'stair' ? `
      <form class="edit" id="editForm">
        <h3>Adjust clear dimensions</h3>
        ${ex ? `<div class="ftin"><label>Width</label><div class="unit" data-u="ft"><input type="number" id="wf" min="2" max="31" value="${wf}"></div><div class="unit" data-u="in"><input type="number" id="wi" min="0" max="11" value="${wi}"></div></div>` : ''}
        ${ey ? `<div class="ftin"><label>Length</label><div class="unit" data-u="ft"><input type="number" id="lf" min="2" max="49" value="${lf}"></div><div class="unit" data-u="in"><input type="number" id="li" min="0" max="11" value="${li}"></div></div>` : ''}
        <p class="note">Moves the ${[ex && ex.side, ey && ey.side].filter(Boolean).join(' and ')} wall on <b>both floors</b>, so neighbouring rooms, walls and the stair stay coordinated. The plot stays 32′ × 50′.</p>
        <div class="row"><button class="btn primary" type="submit">Apply</button><button class="btn" type="button" id="resetDims">Reset layout</button></div>
        ${state.editMsg ? `<p class="msg ${state.editMsg.ok ? 'ok' : 'err'}">${esc(state.editMsg.text)}</p>` : ''}
      </form>` : `<p class="note">${r.type === 'stair' ? 'The stair well is sized by the stair calculation — resize neighbouring rooms instead.' : 'This space spans the full plot in both directions.'}</p>`}`;
    const form = $('#editForm');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); applyEdit(r, m, ex, ey); });
      $('#resetDims').addEventListener('click', () => {
        state.layouts[state.layoutId] = fresh()[state.layoutId];
        state.editMsg = { ok: true, text: 'Original dimensions restored.' };
        renderAll();
      });
    }
    state.editMsg = null;
  }

  function applyEdit(r, m, ex, ey) {
    const c = m.clear[r.id];
    const read = (f, i) => { const a = parseFloat($(f).value) || 0, b = parseFloat($(i).value) || 0; return a + b / 12; };
    const msgs = [];
    let ok = true;
    if (ex) {
      const target = read('#wf', '#wi');
      const delta = target - (c.x1 - c.x0);
      if (Math.abs(delta) > 0.01) {
        const res = C.moveGridLine(layout(), 'x', ex.v, ex.v + ex.sign * delta);
        if (!res.ok) { ok = false; msgs.push(res.msg); } else msgs.push(`Width set to ${C.fmt(target)} (${res.touched.length} spaces adjusted).`);
      }
    }
    if (ey) {
      const room = layout().floors[m.level].rooms.find((x) => x.id === r.id);
      const ey2 = editableEdge(room, 'y');
      const target = read('#lf', '#li');
      const m2 = C.compute(layout(), m.level);
      const c2 = m2.clear[r.id];
      const delta = target - (c2.y1 - c2.y0);
      if (Math.abs(delta) > 0.01) {
        const res = C.moveGridLine(layout(), 'y', ey2.v, ey2.v + ey2.sign * delta);
        if (!res.ok) { ok = false; msgs.push(res.msg); } else msgs.push(`Length set to ${C.fmt(target)} (${res.touched.length} spaces adjusted).`);
      }
    }
    state.editMsg = { ok, text: msgs.join(' ') || 'No change.' };
    renderAll();
  }

  function renderStair() {
    const L = layout();
    const sp = L.stair;
    const s = state.result.models[0].stair;
    const stats = [
      [`${sp.risers}`, 'Risers (2 flights)'], [`${sp.riser}"`, 'Riser height'], [`${sp.tread}"`, 'Tread (going)'],
      [`${2 * sp.riser + sp.tread}"`, '2R + T'], [C.fmt(s.fw), 'Flight width'], [C.fmt(s.land), 'Half landing'],
      [C.fmt(sp.floorH / 12), 'Floor to floor'], [C.fmt((sp.floorH - sp.slab) / 12), 'Headroom'],
    ];
    $('#stairInfo').innerHTML = `<p class="muted small" style="margin-bottom:8px">U-shaped dog-leg stair in the front stair hall, entered directly from the porch so the first floor can be let independently. Same well on both floors.</p>
      <div class="stair-grid">${stats.map(([v, k]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('')}</div>`;
  }

  function renderValidation() {
    const { issues, counts } = state.result;
    $('#valCounts').innerHTML = ['error', 'warn', 'info', 'ok'].map((k) => `<i class="c-${k}" title="${k}">${counts[k]}</i>`).join('');
    const order = { error: 0, warn: 1, info: 2, ok: 3 };
    const list = issues.filter((i) => state.valFilter === 'all' || i.level !== 'ok').sort((a, b) => order[a.level] - order[b.level]);
    const empty = state.valFilter === 'issues' && !list.length ? '<li class="ok">No conflicts detected for this option.</li>' : '';
    $('#valList').innerHTML = empty + list.map((i) => {
      const attrs = i.room != null && i.floor != null ? ` data-room="${i.room}" data-level="${i.floor}"` : '';
      return `<li class="${i.level}"${attrs}><small>${esc(i.cat)}</small>${esc(i.msg)}</li>`;
    }).join('');
  }

  /* ---------------------------------------------------------- selection */

  function select(level, id) {
    state.sel = id ? { level, id } : null;
    if (id && state.view !== 'both' && state.view !== '3d' && levelOfView() !== level) state.view = level ? 'ff' : 'gf';
    if (state.view === '3d' && id) state.view = level ? 'ff' : 'gf';
    syncSegs();
    renderAll();
  }

  function syncSegs() {
    $$('#layoutSeg button').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layoutId));
    $$('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
  }

  /* ----------------------------------------------------------- zoom/pan */

  function zoomAt(factor, cx, cy) {
    const v = state.vb;
    const nw = C.clamp(v.w / factor, VIEW.w / 8, VIEW.w * 1.5);
    const k = nw / v.w;
    const px = cx == null ? v.x + v.w / 2 : cx, py = cy == null ? v.y + v.h / 2 : cy;
    state.vb = { x: px - (px - v.x) * k, y: py - (py - v.y) * k, w: nw, h: v.h * k };
    applyVB();
  }

  function svgPoint(svg, x, y) {
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function bindCanvas() {
    const canvas = $('#canvas');
    let pan = null;
    canvas.addEventListener('wheel', (e) => {
      const svg = e.target.closest('svg');
      if (!svg) return;
      e.preventDefault();
      const p = svgPoint(svg, e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => {
      const svg = e.target.closest('svg');
      if (!svg) return;
      const scale = Math.max(state.vb.w / svg.clientWidth, state.vb.h / svg.clientHeight);
      pan = { x: e.clientX, y: e.clientY, vb: Object.assign({}, state.vb), scale, moved: false, target: e.target, id: e.pointerId };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) > 4) { pan.moved = true; canvas.classList.add('panning'); canvas.setPointerCapture(pan.id); }
      if (pan.moved) { state.vb = Object.assign({}, pan.vb, { x: pan.vb.x - dx * pan.scale, y: pan.vb.y - dy * pan.scale }); applyVB(); }
    });
    const end = () => {
      if (!pan) return;
      if (!pan.moved) {
        const roomEl = pan.target.closest && pan.target.closest('[data-room]');
        const svg = pan.target.closest && pan.target.closest('svg');
        if (roomEl && svg) select(+svg.dataset.level, roomEl.dataset.room);
        else if (svg) select(null, null);
      }
      canvas.classList.remove('panning');
      pan = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { pan = null; canvas.classList.remove('panning'); });
    $('#zoomIn').addEventListener('click', () => zoomAt(1.25));
    $('#zoomOut').addEventListener('click', () => zoomAt(1 / 1.25));
    $('#zoomFit').addEventListener('click', () => { state.vb = fitVB(); applyVB(); });
  }

  /* -------------------------------------------------------------- print */

  function fillPrintSheet() {
    const L = layout();
    $('#printSheet').innerHTML = [0, 1].map((lvl) => FP.render.floorSVG(L, lvl, { layers: state.layers, facing: state.facing, idPrefix: `pr${lvl}` })).join('');
  }

  /* ---------------------------------------------------------------- init */

  function bind() {
    $('#layoutSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.layoutId = b.dataset.layout;
      state.sel = null;
      syncSegs();
      renderAll();
    });
    $('#viewSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.view = b.dataset.view;
      state.vb = fitVB();
      syncSegs();
      renderStage();
    });
    $$('[data-layer]').forEach((cb) => cb.addEventListener('change', () => { state.layers[cb.dataset.layer] = cb.checked; renderStage(); }));
    $('#facing').addEventListener('change', (e) => { state.facing = e.target.value; renderStage(); renderSummary(); });
    $('#schedule').addEventListener('click', (e) => {
      const tr = e.target.closest('tr.r');
      if (tr) select(+tr.dataset.level, tr.dataset.room);
    });
    $('#valList').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-room]');
      if (li && li.dataset.room !== 'undefined') select(+li.dataset.level, li.dataset.room);
    });
    $('#valFilter').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.valFilter = b.dataset.f;
      $$('#valFilter button').forEach((x) => x.classList.toggle('on', x === b));
      renderValidation();
    });
    $('#c3dSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state.lv3d = b.dataset.lv;
      $$('#c3dSeg button').forEach((x) => x.classList.toggle('on', x === b));
      renderStage();
    });
    $$('[data-export]').forEach((b) => b.addEventListener('click', async () => {
      const kind = b.dataset.export;
      const ctx = { layers: state.layers, facing: state.facing };
      const status = $('#exportStatus');
      try {
        b.disabled = true;
        if (kind === 'svg0') FP.exporter.exportSVG(layout(), 0, ctx);
        else if (kind === 'svg1') FP.exporter.exportSVG(layout(), 1, ctx);
        else if (kind === 'png') { status.textContent = 'Rendering PNG…'; await FP.exporter.exportPNG(layout(), ctx); }
        else if (kind === 'pdf') { status.textContent = 'Building PDF…'; await FP.exporter.exportPDF(layout(), ctx); }
        else if (kind === 'print') { fillPrintSheet(); window.print(); }
        status.textContent = kind === 'print' ? '' : 'Download started.';
      } catch (err) {
        status.textContent = `Export failed: ${err.message}`;
      } finally {
        b.disabled = false;
      }
    }));
    window.addEventListener('beforeprint', fillPrintSheet);
    window.addEventListener('resize', () => { if (state.view === '3d' && view3d) view3d.draw(); });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select')) return;
      if (e.key === 'Escape') select(null, null);
      const map = { 1: 'gf', 2: 'ff', 3: 'both', 4: '3d' };
      if (map[e.key]) { state.view = map[e.key]; state.vb = fitVB(); syncSegs(); renderStage(); }
    });
    bindCanvas();
  }

  bind();
  renderAll();
  FP.app = { state, renderAll, select };
})(globalThis.FP = globalThis.FP || {});

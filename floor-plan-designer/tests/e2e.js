#!/usr/bin/env node
/*
 * Browser smoke test (Playwright + Chromium). Opens index.html from file://, exercises
 * floor switching, room selection, resizing, layer toggles, 3D and every export.
 * Usage: node tests/e2e.js [screenshotDir]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const outDir = process.argv[2] || path.join(root, 'tests', 'out');
fs.mkdirSync(outDir, { recursive: true });

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.waitForSelector('#canvas svg');

  // Plot geometry in drawing units: 32 ft x 50 ft at 12 units/ft
  const plot = await page.$eval('#canvas svg .prop', (r) => [r.getAttribute('width'), r.getAttribute('height')].map(Number));
  check(plot[0] === 384 && plot[1] === 600, `plot rectangle is 384 x 600 units (32' x 50') — got ${plot}`);

  const bounds = await page.evaluate(() => {
    const out = [];
    for (const id of ['A', 'B']) for (const lvl of [0, 1]) {
      const m = FP.core.compute(FP.LAYOUTS[id], lvl);
      m.rooms.forEach((r) => { if (r.r[0] < 0 || r.r[1] < 0 || r.r[2] > 32 || r.r[3] > 50) out.push(`${id}${lvl}:${r.id}`); });
      m.pieces.forEach((p) => { if (p.center - p.t / 2 < -1e-6 || p.a < -1e-6) out.push(`${id}${lvl}:wall`); });
      m.furniture.forEach((f) => { if (f.x < 0 || f.y < 0 || f.x + f.w > 32 || f.y + f.h > 50) out.push(`${id}${lvl}:${f.id}`); });
    }
    return out;
  });
  check(bounds.length === 0, `all rooms, walls and furniture inside the plot ${bounds.join(',')}`);

  const val = await page.evaluate(() => ['A', 'B'].map((id) => FP.validate(FP.LAYOUTS[id]).counts));
  check(val.every((c) => c.error === 0), `validation has no errors for both options ${JSON.stringify(val)}`);

  await page.screenshot({ path: path.join(outDir, 'app-gf.png') });

  // room selection
  await page.click('#canvas svg rect[data-room="lounge"]', { position: { x: 30, y: 30 } });
  const info = await page.textContent('#roomInfo');
  check(/TV Lounge/.test(info) && /Clear floor area/.test(info), 'clicking a room shows its details');

  // resize lounge width by +6"
  const before = await page.evaluate(() => FP.core.compute(FP.app.state.layouts.A, 0).clear.lounge);
  const w0 = before.x1 - before.x0;
  const ft = Math.floor(Math.round((w0 + 0.5) * 12) / 12), inch = Math.round((w0 + 0.5) * 12) % 12;
  await page.fill('#wf', String(ft));
  await page.fill('#wi', String(inch));
  await page.click('#editForm button[type=submit]');
  const after = await page.evaluate(() => {
    const L = FP.app.state.layouts.A;
    const g = FP.core.compute(L, 0), f = FP.core.compute(L, 1);
    return { w: g.clear.lounge.x1 - g.clear.lounge.x0, ffw: f.clear.lounge.x1 - f.clear.lounge.x0 };
  });
  check(Math.abs(after.w - (w0 + 0.5)) < 0.05, `lounge width updated ${w0.toFixed(2)} -> ${after.w.toFixed(2)} ft`);
  check(Math.abs(after.ffw - after.w) < 0.01, 'resize propagated to the first floor (floors stay coordinated)');
  check(/Width set to/.test(await page.textContent('#roomInfo')), 'resize confirmation shown');
  await page.screenshot({ path: path.join(outDir, 'app-resized.png') });
  await page.click('#resetDims');

  // floor + option switching
  await page.click('#viewSeg button[data-view="ff"]');
  check((await page.textContent('#stageTitle')).includes('First Floor'), 'switch to first floor');
  await page.screenshot({ path: path.join(outDir, 'app-ff.png') });
  await page.click('#layoutSeg button[data-layout="B"]');
  await page.click('#viewSeg button[data-view="both"]');
  check((await page.$$('#canvas svg')).length === 2, 'both floors side by side');
  await page.screenshot({ path: path.join(outDir, 'app-both-B.png') });

  // layers
  const furnBefore = await page.$$eval('#canvas .furn', (n) => n.length);
  await page.click('input[data-layer="furniture"]');
  const furnAfter = await page.$$eval('#canvas .furn', (n) => n.length);
  check(furnBefore > 0 && furnAfter === 0, `furniture toggle (${furnBefore} -> ${furnAfter})`);
  await page.click('input[data-layer="furniture"]');
  await page.click('input[data-layer="dims"]');
  check((await page.$$('#canvas .dim')).length === 0, 'dimension toggle');
  await page.click('input[data-layer="dims"]');
  await page.click('input[data-layer="walls"]');
  check((await page.$$('#canvas .walls')).length === 0, 'wall toggle');
  await page.click('input[data-layer="walls"]');

  // 3D
  await page.click('#viewSeg button[data-view="3d"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, 'app-3d.png') });
  check(await page.isVisible('#c3d'), '3D view visible');

  // exports
  await page.click('#viewSeg button[data-view="gf"]');
  for (const [kind, ext] of [['svg0', '.svg'], ['svg1', '.svg'], ['png', '.png'], ['pdf', '.pdf']]) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click(`[data-export="${kind}"]`)]);
    const file = path.join(outDir, dl.suggestedFilename());
    await dl.saveAs(file);
    const size = fs.statSync(file).size;
    const head = fs.readFileSync(file).subarray(0, 8).toString('latin1');
    const okHead = ext === '.pdf' ? head.startsWith('%PDF') : ext === '.png' ? head.includes('PNG') : head.startsWith('<?xml');
    check(file.endsWith(ext) && size > 2000 && okHead, `export ${kind}: ${path.basename(file)} (${size} bytes)`);
  }
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  check((await page.$$('#printSheet svg')).length === 2, 'print sheet contains both floors');
  await page.pdf({ path: path.join(outDir, 'print.pdf'), format: 'A3', landscape: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });

  // mobile layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `no horizontal scroll at phone width (overflow ${overflow}px)`);
  await page.screenshot({ path: path.join(outDir, 'app-mobile.png') });

  check(errors.length === 0, `no console errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nAll checks passed');
  process.exit(fails.length ? 1 : 0);
})();

/*
 * Export: SVG per floor, PNG sheet (both floors), 2-page PDF (A3 portrait per floor), print.
 * The PDF writer is a minimal hand-rolled PDF 1.4 generator embedding JPEG page images,
 * so no third-party library is needed and everything works offline.
 */
(function (FP) {
  'use strict';

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function svgFor(layout, level, ctx) {
    return FP.render.floorSVG(layout, level, { layers: ctx.layers, facing: ctx.facing, idPrefix: `ex${level}` });
  }

  function exportSVG(layout, level, ctx) {
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgFor(layout, level, ctx);
    download(new Blob([svg], { type: 'image/svg+xml' }), `floor-plan-option-${layout.id}-${slug(layout.floors[level].name)}.svg`);
  }

  /** Rasterise an SVG string at a given pixel size onto a white canvas. */
  function rasterize(svg, w, h) {
    return new Promise((resolve, reject) => {
      // callers pass an SVG without width/height on the root element
      const sized = svg.replace(/^<svg /, `<svg width="${w}" height="${h}" `);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0, w, h);
        resolve(c);
      };
      img.onerror = () => reject(new Error('Could not rasterise SVG'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
    });
  }

  function viewSize(svg) {
    const m = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
    return { w: +m[3], h: +m[4] };
  }

  async function exportPNG(layout, ctx) {
    const svg = FP.render.sheetSVG(layout, { layers: ctx.layers, facing: ctx.facing });
    const v = viewSize(svg);
    const k = 3.2;
    const canvas = await rasterize(svg.replace(/ width="[^"]*" height="[^"]*"/, ''), Math.round(v.w * k), Math.round(v.h * k));
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    download(blob, `floor-plan-option-${layout.id}-complete.png`);
  }

  function dataUrlBytes(url) {
    const bin = atob(url.split(',')[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Minimal PDF writer: one JPEG image per page, centred on an A3 portrait page. */
  function buildPdf(images, title) {
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    const obj = (num, body) => { offsets[num] = len; push(`${num} 0 obj\n`); body(); push('\nendobj\n'); };
    const PW = 841.89, PH = 1190.55, M = 28;
    const n = images.length;
    push('%PDF-1.4\n%âãÏÓ\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Kids [${images.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`));
    images.forEach((im, i) => {
      const s = Math.min((PW - 2 * M) / im.w, (PH - 2 * M) / im.h);
      const dw = +(im.w * s).toFixed(2), dh = +(im.h * s).toFixed(2);
      const x = +((PW - dw) / 2).toFixed(2), y = +((PH - dh) / 2).toFixed(2);
      obj(3 + 3 * i, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${5 + 3 * i} 0 R >> >> /Contents ${4 + 3 * i} 0 R >>`));
      const content = `q ${dw} 0 0 ${dh} ${x} ${y} cm /Im${i} Do Q`;
      obj(4 + 3 * i, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
      obj(5 + 3 * i, () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`);
        push(im.data);
        push('\nendstream');
      });
    });
    const infoNum = 3 + 3 * n;
    obj(infoNum, () => push(`<< /Title (${title.replace(/\u2014/g, '-').replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '')}) /Producer (Floor Plan Designer) >>`));
    const xref = len;
    const total = infoNum + 1;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let k = 1; k < total; k++) push(`${String(offsets[k]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size ${total} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function exportPDF(layout, ctx) {
    const images = [];
    for (let lvl = 0; lvl < layout.floors.length; lvl++) {
      const svg = svgFor(layout, lvl, ctx);
      const v = viewSize(svg);
      const k = 4;
      const canvas = await rasterize(svg, Math.round(v.w * k), Math.round(v.h * k));
      images.push({ w: canvas.width, h: canvas.height, data: dataUrlBytes(canvas.toDataURL('image/jpeg', 0.92)) });
    }
    download(buildPdf(images, layout.name), `floor-plan-option-${layout.id}.pdf`);
  }

  FP.exporter = { exportSVG, exportPNG, exportPDF, buildPdf, rasterize };
})(globalThis.FP = globalThis.FP || {});

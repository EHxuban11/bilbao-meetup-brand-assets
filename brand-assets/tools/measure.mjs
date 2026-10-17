// Measure text lines in a reference image: bbox, colour, baseline and cap top.
// usage: node tools/measure.mjs <image.png> [x0 x1 y0 y1]
import sharp from 'sharp';

const [,, file, xa = '0', xb = '1e9', ya = '0', yb = '1e9'] = process.argv;
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const x0 = +xa, x1 = Math.min(+xb, W), y0 = +ya, y1 = Math.min(+yb, H);
const at = (x, y) => (y * W + x) * 4;
const ink = (x, y) => { const i = at(x, y); return data[i + 3] > 128 && Math.max(data[i], data[i + 1], data[i + 2]) > 60; };

const rowHas = [];
for (let y = y0; y < y1; y++) { let n = 0; for (let x = x0; x < x1; x++) if (ink(x, y)) n++; rowHas[y] = n; }
const runs = []; let s = -1;
for (let y = y0; y <= y1; y++) {
  const on = y < y1 && rowHas[y] > 0;
  if (on && s < 0) s = y;
  if (!on && s >= 0) { if (!(rowHas[y + 1] > 0 || rowHas[y + 2] > 0) || y >= y1) { runs.push([s, y - 1]); s = -1; } }
}
const mode = a => { const m = new Map(); a.forEach(v => m.set(v, (m.get(v) || 0) + 1)); return [...m].sort((p, q) => q[1] - p[1])[0]?.[0]; };
for (const [a, b] of runs) {
  let mnx = 1e9, mxx = 0, bottoms = [], tops = [], best = [0, 0, 0, 0];
  for (let x = x0; x < x1; x++) {
    let t = -1, bo = -1;
    for (let y = a; y <= b; y++) if (ink(x, y)) { if (t < 0) t = y; bo = y; const i = at(x, y); const v = data[i] + data[i + 1] + data[i + 2]; if (v > best[3]) best = [data[i], data[i + 1], data[i + 2], v]; }
    if (t >= 0) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); bottoms.push(bo); tops.push(t); }
  }
  if (bottoms.length < 3) continue;
  const hex = '#' + best.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
  console.log(`y ${a}-${b} h ${b - a + 1} | x ${mnx}-${mxx} w ${mxx - mnx + 1} | baseline ${mode(bottoms) + 1} | top-mode ${mode(tops)} | ${hex}`);
}

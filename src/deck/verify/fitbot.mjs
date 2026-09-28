// Fit a bot shape (assets/bots/<shape>.json) onto a transparent overlay PNG (1920x1080).
// usage: node fitbot.mjs <overlay.png> <shape>
import sharp from 'sharp'; import { readFileSync } from 'node:fs';
const [,, file, shape] = process.argv;
const bot = JSON.parse(readFileSync(`assets/bots/${shape}.json`, 'utf8'));
const S = 2000, C = 1000;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><path transform="translate(${C} ${C})" d="${bot.path}" fill="#fff"/></svg>`;
const can = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
const STEP = 2; const rel = [];
for (let y = 0; y < S; y += STEP) for (let x = 0; x < S; x += STEP) if (can[y * S + x] > 127) rel.push(x + 0.5 - C, y + 0.5 - C);
const P = Float32Array.from(rel);
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const sil = new Uint8Array(W * H), eye = new Uint8Array(W * H); let tc = 0, sx = 0, sy = 0;
for (let k = 0; k < W * H; k++) { const a = data[k * 4 + 3]; if (a > 127) { sil[k] = 1; if (k % W % STEP === 0 && ((k / W) | 0) % STEP === 0) { tc++; } sx += k % W; sy += (k / W) | 0; const l = data[k * 4] + data[k * 4 + 1] + data[k * 4 + 2]; if (l < 150) eye[k] = 1; } }
let n = 0; for (let k = 0; k < W * H; k++) n += sil[k]; const cx = sx / n, cy = sy / n;
function iou([tx, ty, r, s], flip) {
  const t = r * Math.PI / 180, c = Math.cos(t) * s, sn = Math.sin(t) * s, f = flip ? -1 : 1; let inter = 0, vis = 0;
  for (let i = 0; i < P.length; i += 2) { const px = P[i] * f, py = P[i + 1]; const x = Math.floor(tx + c * px - sn * py), y = Math.floor(ty + sn * px + c * py);
    if (x < 0 || y < 0 || x >= W || y >= H) continue; vis++; if (sil[y * W + x]) inter++; }
  const s2 = s * s; return (inter * s2) / (vis * s2 + tc - inter * s2);
}
function nm(f, x0, st, it = 250) { const d = x0.length; let p = [x0.slice()]; for (let i = 0; i < d; i++) { const q = x0.slice(); q[i] += st[i]; p.push(q); } let v = p.map(f);
  for (let k = 0; k < it; k++) { const o = v.map((_, i) => i).sort((a, b) => v[a] - v[b]); p = o.map(i => p[i]); v = o.map(i => v[i]);
    const c = Array(d).fill(0); for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) c[j] += p[i][j] / d;
    const r = c.map((cc, j) => cc + (cc - p[d][j])), fr = f(r);
    if (fr < v[0]) { const e = c.map((cc, j) => cc + 2 * (cc - p[d][j])), fe = f(e); if (fe < fr) { p[d] = e; v[d] = fe; } else { p[d] = r; v[d] = fr; } }
    else if (fr < v[d - 1]) { p[d] = r; v[d] = fr; }
    else { const cc2 = c.map((cc, j) => cc + 0.5 * (p[d][j] - cc)), fc = f(cc2); if (fc < v[d]) { p[d] = cc2; v[d] = fc; } else for (let i = 1; i <= d; i++) { p[i] = p[i].map((q, j) => p[0][j] + 0.5 * (q - p[0][j])); v[i] = f(p[i]); } } }
  const b = v.indexOf(Math.min(...v)); return { x: p[b], v: -v[b] }; }
let best = null;
for (const flip of [false, true]) for (const s0 of [0.3, 0.45, 0.6, 0.8, 1.0]) for (const r0 of [-150, -90, -30, 0, 30, 90, 150, 180]) {
  const f = x => -iou(x, flip); let r = nm(f, [cx, cy, r0, s0], [40, 40, 15, 0.08], 120);
  if (!best || r.v > best.v) best = { ...r, flip };
}
{ const f = x => -iou(x, best.flip); for (let i = 0; i < 3; i++) best = { ...nm(f, best.x, [3, 3, 1, 0.01], 250), flip: best.flip }; }
const [tx, ty, rot, s] = best.x;
// eyes in body-local coordinates
const lab = new Int32Array(W * H).fill(-1); const eyes = [];
for (let k = 0; k < W * H; k++) if (eye[k] && lab[k] < 0) { const st = [k]; lab[k] = eyes.length; const pix = [];
  while (st.length) { const q = st.pop(); pix.push(q); const x = q % W; for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && eye[r] && lab[r] < 0 && Math.abs(r % W - x) <= 1) { lab[r] = eyes.length; st.push(r); } }
  let ex = 0, ey = 0; for (const q of pix) { ex += q % W + 0.5; ey += ((q / W) | 0) + 0.5; } ex /= pix.length; ey /= pix.length;
  let xx = 0, yy = 0, xy = 0; for (const q of pix) { const dx = q % W + 0.5 - ex, dy = ((q / W) | 0) + 0.5 - ey; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * xy, xx - yy); const ux = Math.cos(th), uy = Math.sin(th); let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
  for (const q of pix) { const dx = q % W + 0.5 - ex, dy = ((q / W) | 0) + 0.5 - ey; const u = dx * ux + dy * uy, v = -dx * uy + dy * ux; umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
  // to body-local
  const t = -rot * Math.PI / 180, dx = ex - tx, dy = ey - ty; let lx = (Math.cos(t) * dx - Math.sin(t) * dy) / s, ly = (Math.sin(t) * dx + Math.cos(t) * dy) / s; if (best.flip) lx = -lx;
  eyes.push({ n: pix.length, screen: [+ex.toFixed(1), +ey.toFixed(1)], x: +lx.toFixed(2), y: +ly.toFixed(2), len: +((umax - umin + 1) / s).toFixed(1), wid: +((vmax - vmin + 1) / s).toFixed(1), axisDeg: +(th * 180 / Math.PI).toFixed(2), clippedEdge: pix.some(q => q % W === 0 || q % W === W - 1 || q < W || q >= W * (H - 1)) });
}
console.log(JSON.stringify({ file, shape, flip: best.flip, iou: +best.v.toFixed(4), x: +tx.toFixed(2), y: +ty.toFixed(2), rot: +rot.toFixed(2), scale: +s.toFixed(4), eyes: eyes.filter(e => e.n > 50) }, null, 1));

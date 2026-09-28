// Analyse the bot in a reference image: body mask, eye holes, geometry.
// usage: node tools/bots.mjs <image.png> <hex colour> [x0 y0 x1 y1] [--trace out.svg]
import sharp from 'sharp';
import potrace from 'potrace';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const traceOut = args.includes('--trace') ? args[args.indexOf('--trace') + 1] : null;
const maskOut = args.includes('--mask') ? args[args.indexOf('--mask') + 1] : null;
const [file, hex, ...box] = args.filter((a, i) => !a.startsWith('--') && !['--trace', '--mask'].includes(args[i - 1]));
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const [bx0, by0, bx1, by1] = box.length === 4 ? box.map(Number) : [0, 0, W, H];
const C = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const CC = C[0] ** 2 + C[1] ** 2 + C[2] ** 2;

// coverage of the bot colour at each pixel (0..1), assuming black or transparent behind
const cov = new Float32Array(W * H);
for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
  const i = (y * W + x) * 4, a = data[i + 3] / 255;
  const p = [data[i] * a, data[i + 1] * a, data[i + 2] * a];
  const al = (p[0] * C[0] + p[1] * C[1] + p[2] * C[2]) / CC;
  const res = Math.hypot(p[0] - al * C[0], p[1] - al * C[1], p[2] - al * C[2]);
  cov[y * W + x] = res < 40 ? Math.min(1, al) : 0;
}
const body = new Uint8Array(W * H);
for (let k = 0; k < W * H; k++) body[k] = cov[k] >= 0.5 ? 1 : 0;

// keep the largest connected component
const lab = new Int32Array(W * H).fill(-1);
const comp = [];
for (let k = 0; k < W * H; k++) if (body[k] && lab[k] < 0) {
  const st = [k]; lab[k] = comp.length; let n = 0;
  while (st.length) { const q = st.pop(); n++; const x = q % W, y = (q / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const r = ny * W + nx; if (body[r] && lab[r] < 0) { lab[r] = comp.length; st.push(r); } } }
  comp.push(n);
}
const big = comp.indexOf(Math.max(...comp));
for (let k = 0; k < W * H; k++) body[k] = lab[k] === big ? 1 : 0;

// holes = not body and not reachable from the image border
const out = new Uint8Array(W * H); const st = [];
for (let x = 0; x < W; x++) { st.push(x, (H - 1) * W + x); }
for (let y = 0; y < H; y++) { st.push(y * W, y * W + W - 1); }
while (st.length) { const q = st.pop(); if (out[q] || body[q]) continue; out[q] = 1; const x = q % W, y = (q / W) | 0;
  if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (y > 0) st.push(q - W); if (y < H - 1) st.push(q + W); }
const filled = new Uint8Array(W * H), hole = new Uint8Array(W * H);
for (let k = 0; k < W * H; k++) { filled[k] = out[k] ? 0 : 1; hole[k] = filled[k] && !body[k] ? 1 : 0; }

const moments = (mask, pred = () => true) => {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (!mask[k] || !pred(k)) continue;
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = sx / n, cy = sy / n, mxx = sxx / n - cx * cx, myy = syy / n - cy * cy, mxy = sxy / n - cx * cy;
  const th = 0.5 * Math.atan2(2 * mxy, mxx - myy), d = Math.sqrt(((mxx - myy) / 2) ** 2 + mxy ** 2);
  const l1 = (mxx + myy) / 2 + d, l2 = (mxx + myy) / 2 - d;
  return { n, cx: +(cx + 0.5).toFixed(2), cy: +(cy + 0.5).toFixed(2), bbox: [x0, y0, x1 + 1, y1 + 1], angleDeg: +(th * 180 / Math.PI).toFixed(2), major: +(4 * Math.sqrt(l1)).toFixed(1), minor: +(4 * Math.sqrt(l2)).toFixed(1) };
};

const f = moments(filled);
const touches = f.bbox[0] <= 0 || f.bbox[1] <= 0 || f.bbox[2] >= W || f.bbox[3] >= H;
console.log(JSON.stringify({ file, colour: hex, body: f, clipped: touches }));
// eye components
const hl = new Int32Array(W * H).fill(-1); let ne = 0;
for (let k = 0; k < W * H; k++) if (hole[k] && hl[k] < 0) {
  const s2 = [k]; hl[k] = ne;
  while (s2.length) { const q = s2.pop(); const x = q % W, y = (q / W) | 0;
    for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && hole[r] && hl[r] < 0 && Math.abs((r % W) - x) <= 1) { hl[r] = ne; s2.push(r); } }
  ne++;
}
for (let e = 0; e < ne; e++) {
  const m = moments(hole, k => hl[k] === e);
  if (m.n > 50) console.log('  eye', JSON.stringify(m));
}

if (maskOut) await sharp(Buffer.from(filled.map(v => v ? 255 : 0)), { raw: { width: W, height: H, channels: 1 } }).png().toFile(maskOut);

if (traceOut) {
  // potrace the filled silhouette (eyes are drawn separately)
  const png = await sharp(Buffer.from(filled.map(v => v ? 0 : 255)), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const svg = await new Promise((res, rej) => potrace.trace(png, { turdSize: 50, optTolerance: 0.4, alphaMax: 1.0, threshold: 128 }, (e, s) => e ? rej(e) : res(s)));
  writeFileSync(traceOut, svg);
  console.log('  traced ->', traceOut);
}

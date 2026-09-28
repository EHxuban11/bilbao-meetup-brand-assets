// Fit a canonical bot shape (assets/bots/<shape>.json) onto a bot in a reference image.
// Registers the silhouette (body + eye holes filled) by maximising IoU over
// x, y (body centroid on screen), rot (deg, clockwise), scale, and tries a horizontal flip.
// Also measures the eyes (pills) in screen space and in the body's local frame.
//
// usage: node tools/fit-bot.mjs <image> <shape> <hex colour> [x0 y0 x1 y1] [--noflip] [--json]
// Transform convention (same as SVG):  screen = T(x,y) · R(rot) · S(scale · (flip ? -1 : 1), scale) · p
// where p are the canonical path coordinates (centred on the canonical body centroid).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const pos = argv.filter(a => !a.startsWith('--'));
const [file, shapeName, hex, ...box] = pos;
const shape = JSON.parse(readFileSync(`assets/bots/${shapeName}.json`, 'utf8'));

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const [bx0, by0, bx1, by1] = box.length === 4 ? box.map(Number) : [0, 0, W, H];
const C = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); const CC = C[0] ** 2 + C[1] ** 2 + C[2] ** 2;

// --- reference silhouette -----------------------------------------------------
const cov = new Float32Array(W * H);
for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
  const i = (y * W + x) * 4, a = data[i + 3] / 255; const p = [data[i] * a, data[i + 1] * a, data[i + 2] * a];
  const al = (p[0] * C[0] + p[1] * C[1] + p[2] * C[2]) / CC;
  if (Math.hypot(p[0] - al * C[0], p[1] - al * C[1], p[2] - al * C[2]) < 45) cov[y * W + x] = Math.max(0, Math.min(1, al));
}
const body = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) body[k] = cov[k] >= 0.5 ? 1 : 0;
{ // largest component
  const lab = new Int32Array(W * H).fill(-1); let best = -1, bn = 0, id = 0;
  for (let k = 0; k < W * H; k++) if (body[k] && lab[k] < 0) { const st = [k]; lab[k] = id; let n = 0;
    while (st.length) { const q = st.pop(); n++; const x = q % W; for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && body[r] && lab[r] < 0 && Math.abs((r % W) - x) <= 1) { lab[r] = id; st.push(r); } }
    if (n > bn) { bn = n; best = id; } id++; }
  if (best < 0) { console.error('no pixels of that colour'); process.exit(1); }
  for (let k = 0; k < W * H; k++) body[k] = lab[k] === best ? 1 : 0;
}
const outside = new Uint8Array(W * H); { const st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const q = st.pop(); if (outside[q] || body[q]) continue; outside[q] = 1; const x = q % W;
    if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (q >= W) st.push(q - W); if (q < W * (H - 1)) st.push(q + W); } }
const sil = new Uint8Array(W * H); let refN = 0, rsx = 0, rsy = 0, clipped = false;
for (let k = 0; k < W * H; k++) if (!outside[k]) { sil[k] = 1; refN++; rsx += k % W + 0.5; rsy += ((k / W) | 0) + 0.5;
  const x = k % W, y = (k / W) | 0; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) clipped = true; }
const STEP = Math.max(1, Math.round(Math.sqrt(refN) / 250));
let refSamples = 0; for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) if (sil[y * W + x]) refSamples++;

// --- canonical silhouette points --------------------------------------------------
const [cx0, cy0, cx1, cy1] = shape.bbox; const pad = 4;
const cw = Math.ceil(cx1 - cx0 + 2 * pad), ch = Math.ceil(cy1 - cy0 + 2 * pad);
const csvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}"><path fill="#fff" transform="translate(${pad - cx0} ${pad - cy0})" d="${shape.path}"/></svg>`;
const { data: cd } = await sharp(Buffer.from(csvg)).greyscale().raw().toBuffer({ resolveWithObject: true });
const rel = []; let canonN = 0;
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (cd[y * cw + x] >= 128) canonN++;
const CSTEP = 2;
for (let y = 0; y < ch; y += CSTEP) for (let x = 0; x < cw; x += CSTEP) if (cd[y * cw + x] >= 128) rel.push(x + 0.5 + cx0 - pad, y + 0.5 + cy0 - pad);
const relA = Float32Array.from(rel);

function iou([tx, ty, rot, s], flip) {
  const r = rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), fx = flip ? -1 : 1;
  let inter = 0, vis = 0;
  for (let i = 0; i < relA.length; i += 2) {
    const px = relA[i] * s * fx, py = relA[i + 1] * s;
    const x = Math.floor(tx + c * px - sn * py), y = Math.floor(ty + sn * px + c * py);
    if (x < 0 || y < 0 || x >= W || y >= H) continue; vis++; if (sil[y * W + x]) inter++;
  }
  const a = CSTEP * CSTEP * s * s; // screen area per canonical sample
  const union = vis * a + refN - inter * a; return union > 0 ? inter * a / union : 0;
}
function nm(f, x0, st, it) {
  const n = x0.length; let P = [x0.slice()]; for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += st[i]; P.push(p); }
  let V = P.map(f);
  for (let k = 0; k < it; k++) {
    const o = V.map((v, i) => i).sort((a, b) => V[a] - V[b]); P = o.map(i => P[i]); V = o.map(i => V[i]);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += P[i][j] / n;
    const rp = c.map((v, j) => v + (v - P[n][j])); const fr = f(rp);
    if (fr < V[0]) { const e = c.map((v, j) => v + 2 * (v - P[n][j])); const fe = f(e); if (fe < fr) { P[n] = e; V[n] = fe; } else { P[n] = rp; V[n] = fr; } }
    else if (fr < V[n - 1]) { P[n] = rp; V[n] = fr; }
    else { const cc = c.map((v, j) => v + 0.5 * (P[n][j] - v)); const fc = f(cc); if (fc < V[n]) { P[n] = cc; V[n] = fc; } else for (let i = 1; i <= n; i++) { P[i] = P[i].map((v, j) => P[0][j] + 0.5 * (v - P[0][j])); V[i] = f(P[i]); } }
  }
  return { p: P[0], v: V[0] };
}
const rcx = rsx / refN, rcy = rsy / refN; const s0 = Math.sqrt(refN / canonN);
const cands = [];
for (const flip of flags.has('--noflip') ? [false] : [false, true]) {
  // coarse rotation scan
  let cand = [];
  for (let rot = -180; rot < 180; rot += 6) cand.push([iou([rcx, rcy, rot, s0], flip), rot]);
  cand.sort((a, b) => b[0] - a[0]);
  for (const [, rot] of cand.slice(0, 3)) {
    const f = p => -iou(p, flip);
    let r = nm(f, [rcx, rcy, rot, s0], [10, 10, 4, 0.03], 150); r = nm(f, r.p, [1, 1, 0.5, 0.004], 200);
    cands.push({ ...r, flip });
  }
}
cands.sort((a, b) => a.v - b.v);
// --- eyes ---------------------------------------------------------------------------
const eyesOut = [];
{ const lab = new Int32Array(W * H).fill(-1); let id = 0;
  for (let k = 0; k < W * H; k++) {
    if (!sil[k] || body[k] || lab[k] >= 0) continue;
    const st = [k]; lab[k] = id; const pix = [];
    while (st.length) { const q = st.pop(); pix.push(q); const x = q % W; for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && sil[r] && !body[r] && lab[r] < 0 && Math.abs((r % W) - x) <= 1) { lab[r] = id; st.push(r); } }
    id++;
    if (pix.length < 30) continue;
    // weighted by darkness (1 - coverage), include 1px antialias ring
    let n = 0, sx = 0, sy = 0; const wts = pix.map(q => 1 - cov[q]);
    pix.forEach((q, i) => { n += wts[i]; sx += wts[i] * (q % W + 0.5); sy += wts[i] * (((q / W) | 0) + 0.5); });
    const ex = sx / n, ey = sy / n; let xx = 0, yy = 0, xy = 0;
    pix.forEach((q, i) => { const dx = q % W + 0.5 - ex, dy = ((q / W) | 0) + 0.5 - ey; xx += wts[i] * dx * dx; yy += wts[i] * dy * dy; xy += wts[i] * dx * dy; });
    const th = 0.5 * Math.atan2(2 * xy, xx - yy); const ux = Math.cos(th), uy = Math.sin(th);
    const bins = new Map(); pix.forEach((q, i) => { const u = Math.round((q % W + 0.5 - ex) * ux + (((q / W) | 0) + 0.5 - ey) * uy); bins.set(u, (bins.get(u) || 0) + wts[i]); });
    const ks = [...bins.keys()].sort((a, b) => a - b).filter(k => bins.get(k) > 0.5);
    const along = ks.length ? ks.at(-1) - ks[0] + 1 : 0; const ws = ks.map(k => bins.get(k)).sort((a, b) => b - a); const across = ws[Math.floor(ws.length * 0.15)] || 0;
    let deg = th * 180 / Math.PI, e;
    if (Math.abs(Math.abs(deg) - 90) < 45) { let a = deg - 90; if (a < -90) a += 180; if (a > 90) a -= 180; e = { x: ex, y: ey, w: across, h: along, a }; }
    else e = { x: ex, y: ey, w: along, h: across, a: deg };
    eyesOut.push(e);
  }
}
eyesOut.sort((a, b) => a.x - b.x);
// Eyes rotate with the body: also try the rotation given by the eye axis.
if (eyesOut.length) {
  const ea = eyesOut.reduce((a, e) => a + e.a, 0) / eyesOut.length;
  for (const flip of flags.has('--noflip') ? [false] : [false, true]) for (const r0 of [ea, ea + 180]) {
    const f = p => -iou(p, flip);
    let r = nm(f, [rcx, rcy, r0, s0], [6, 6, 1, 0.02], 120); r = nm(f, r.p, [1, 1, 0.3, 0.004], 160);
    cands.push({ ...r, flip });
  }
  cands.sort((a, b) => a.v - b.v);
}
// Symmetric bodies fit equally well at several rotations: among near-best fits, pick the one
// whose eyes land closest to the canonical face.
const toLocal = (c, e) => { const [x, y, r, sc] = c.p; const t = -r * Math.PI / 180, dx = e.x - x, dy = e.y - y;
  return [(Math.cos(t) * dx - Math.sin(t) * dy) / sc * (c.flip ? -1 : 1), (Math.sin(t) * dx + Math.cos(t) * dy) / sc]; };
const faceErr = c => { if (!eyesOut.length || !shape.face?.length) return 0; const fm = [0, 1].map(j => shape.face.reduce((a, f) => a + [f.x, f.y][j], 0) / shape.face.length);
  const L = eyesOut.map(e => toLocal(c, e)); const lm = [0, 1].map(j => L.reduce((a, v) => a + v[j], 0) / L.length); return Math.hypot(lm[0] - fm[0], lm[1] - fm[1]); };
if (process.env.DEBUG) for (const c of cands) console.error(c.flip, c.p.map(v => v.toFixed(2)).join(" "), (-c.v).toFixed(4), faceErr(c).toFixed(1));
let best = cands.filter(c => c.v <= cands[0].v + 0.01).sort((a, b) => (faceErr(a) + (a.flip ? 3 : 0)) - (faceErr(b) + (b.flip ? 3 : 0)))[0]; // prefer no flip when equivalent
// Rotation-invariant silhouettes (e.g. round): every rotation fits equally, so take the
// rotation from the eye axis (eyes rotate with the body; canonical eyes are vertical).
let rotFrom = 'silhouette';
const spread = -cands[0].v - Math.min(...cands.map(c => -c.v));
if ((eyesOut.length && spread < 0.003) || shapeName === 'round') {
  const ea = eyesOut.length ? eyesOut.reduce((a, e) => a + e.a, 0) / eyesOut.length : 0;
  const f = p => -iou([p[0], p[1], ea, p[2]], false);
  let r = nm(f, [cands[0].p[0], cands[0].p[1], cands[0].p[3]], [2, 2, 0.01], 120); r = nm(f, r.p, [0.5, 0.5, 0.002], 120);
  best = { p: [r.p[0], r.p[1], ea, r.p[2]], v: r.v, flip: false }; rotFrom = eyesOut.length ? 'eyes' : 'none (round, no eyes)';
}
let [tx, ty, rot, s] = best.p; rot = ((rot + 540) % 360) - 180;


const r2 = v => Math.round(v * 100) / 100;
const tr = -rot * Math.PI / 180, fx = best.flip ? -1 : 1;
const local = eyesOut.map(e => { const dx = e.x - tx, dy = e.y - ty; const lx = (Math.cos(tr) * dx - Math.sin(tr) * dy) / s * fx, ly = (Math.sin(tr) * dx + Math.cos(tr) * dy) / s;
  return { x: r2(lx), y: r2(ly), w: r2(e.w / s), h: r2(e.h / s), a: r2((e.a - rot) * fx) }; });
const res = { file, shape: shapeName, colour: hex, x: r2(tx), y: r2(ty), rot: r2(rot), scale: +s.toFixed(4), flip: best.flip, rotFrom, iou: +(-best.v).toFixed(4), clipped,
  eyes: eyesOut.map(e => ({ x: r2(e.x), y: r2(e.y), w: r2(e.w), h: r2(e.h), a: r2(e.a) })), eyesLocal: local };
console.log(JSON.stringify(res));

// Motion capture of a bot from a reference video.
// Registers the bot's silhouette (from an anchor frame or still) onto every frame to get
// position / rotation / scale, even when the bot is partly off-screen, and measures the eyes.
//
// usage: node tools/mocap.mjs <video> <hex> <anchor.png> <out.json> [--x0 900] [--x1 1920]
//        [--y0 0] [--y1 1080] [--ss sec] [--to sec] [--register-all]
// Videos that are not 1920x1080 (the 720p preview reel) are upscaled to 1920x1080 on decode.
// --ss/--to select a time range (seconds) of the source. --register-all registers every frame
// (needed when other bots can occlude this one, e.g. the networking cluster).
// --shape assets/bots/<name>.json [--shape-scale 1]: use the canonical shape instead of an anchor
//   image (pass '-' as anchor.png). Positions are then true body centroids and s is the scale
//   relative to the canonical shape, even when the bot is always partly off-screen.
// --fit-scale: also optimise scale when registering clipped frames.
// Output values are absolute pixels in the reference video; see tools/normalise-track.mjs.
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const [video, hex, anchorFile, outFile] = argv;
const X0 = +opt('--x0', 0), X1 = +opt('--x1', 1920), Y0 = +opt('--y0', 0), Y1 = +opt('--y1', 1080);
const SS = opt('--ss', null), TO = opt('--to', null), REG_ALL = argv.includes('--register-all');
const SHAPE = opt('--shape', null), SHAPE_SCALE = +opt('--shape-scale', 1), FIT_SCALE = argv.includes('--fit-scale');
const W = 1920, H = 1080;
const C = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const CC = C[0] ** 2 + C[1] ** 2 + C[2] ** 2;

// ---- masks ---------------------------------------------------------------
function coverage(rgb, ch) {
  const cov = new Float32Array(W * H);
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const i = (y * W + x) * ch; const a = ch === 4 ? rgb[i + 3] / 255 : 1;
    const p = [rgb[i] * a, rgb[i + 1] * a, rgb[i + 2] * a];
    const al = (p[0] * C[0] + p[1] * C[1] + p[2] * C[2]) / CC;
    if (Math.hypot(p[0] - al * C[0], p[1] - al * C[1], p[2] - al * C[2]) < 45) cov[y * W + x] = Math.max(0, Math.min(1, al));
  }
  return cov;
}
function silhouette(cov) { // body + enclosed holes; largest component only
  const body = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) body[k] = cov[k] >= 0.5 ? 1 : 0;
  const lab = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0, id = 0;
  for (let k = 0; k < W * H; k++) if (body[k] && lab[k] < 0) {
    const st = [k]; lab[k] = id; let n = 0;
    while (st.length) { const q = st.pop(); n++; const x = q % W;
      for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && body[r] && lab[r] < 0 && Math.abs((r % W) - x) <= 1) { lab[r] = id; st.push(r); } }
    if (n > bestN) { bestN = n; best = id; } id++;
  }
  for (let k = 0; k < W * H; k++) body[k] = lab[k] === best ? 1 : 0;
  const out = new Uint8Array(W * H); const st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const q = st.pop(); if (out[q] || body[q]) continue; out[q] = 1; const x = q % W;
    if (x > 0) st.push(q - 1); if (x < W - 1) st.push(q + 1); if (q >= W) st.push(q - W); if (q < W * (H - 1)) st.push(q + W); }
  const sil = new Uint8Array(W * H); let n = 0;
  for (let k = 0; k < W * H; k++) if (!out[k]) { sil[k] = 1; n++; }
  return { sil, n, bestN };
}

// ---- registration ----------------------------------------------------------
const STEP = 3; // sample grid for registration
function pointsOf(sil) { const p = []; for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) if (sil[y * W + x]) p.push(x + 0.5, y + 0.5); return Float32Array.from(p); }
function centroid(pts) { let sx = 0, sy = 0; const n = pts.length / 2; for (let i = 0; i < pts.length; i += 2) { sx += pts[i]; sy += pts[i + 1]; } return [sx / n, sy / n]; }

let A = null; // anchor: {pts (relative to centroid), cx, cy}
function score(params, sil, targetCount) {
  const [tx, ty, rotDeg, s] = params; const r = rotDeg * Math.PI / 180, c = Math.cos(r) * s, sn = Math.sin(r) * s;
  let inter = 0, vis = 0; const p = A.rel;
  for (let i = 0; i < p.length; i += 2) {
    const x = Math.round(tx + c * p[i] - sn * p[i + 1] - 0.5), y = Math.round(ty + sn * p[i] + c * p[i + 1] - 0.5);
    if (x < 0 || y < 0 || x >= W || y >= H || x < X0 || x >= X1) continue; vis++;
    if (sil[y * W + x]) inter++;
  }
  const s2 = s * s; // each anchor sample covers STEP^2 * s^2 of screen area
  const union = vis * s2 + targetCount - inter * s2;
  return union ? (inter * s2) / union : 0;
}
function nelderMead(f, x0, steps, iters = 160) {
  const n = x0.length; let pts = [x0.slice()]; for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += steps[i]; pts.push(p); }
  let vals = pts.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]); pts = idx.map(i => pts[i]); vals = idx.map(i => vals[i]);
    const cen = Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += pts[i][j] / n;
    const refl = cen.map((c, j) => c + (c - pts[n][j])); const fr = f(refl);
    if (fr < vals[0]) { const exp = cen.map((c, j) => c + 2 * (c - pts[n][j])); const fe = f(exp); if (fe < fr) { pts[n] = exp; vals[n] = fe; } else { pts[n] = refl; vals[n] = fr; } }
    else if (fr < vals[n - 1]) { pts[n] = refl; vals[n] = fr; }
    else { const con = cen.map((c, j) => c + 0.5 * (pts[n][j] - c)); const fc = f(con);
      if (fc < vals[n]) { pts[n] = con; vals[n] = fc; } else { for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j])); vals[i] = f(pts[i]); } } }
  }
  const b = vals.indexOf(Math.min(...vals)); return { x: pts[b], v: vals[b] };
}

// ---- eyes --------------------------------------------------------------------
function eyes(cov, sil) {
  // eye ink = inside silhouette and not body colour; weight = 1 - coverage
  const w = new Float32Array(W * H); const m = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) if (sil[k]) { const v = 1 - cov[k]; if (v > 0.03) { w[k] = v; m[k] = 1; } }
  // also include antialiased eye edges just outside silhouette? eyes are interior, fine.
  const lab = new Int32Array(W * H).fill(-1); const res = [];
  for (let k = 0; k < W * H; k++) if (m[k] && lab[k] < 0) {
    const st = [k]; lab[k] = res.length; const pix = [];
    while (st.length) { const q = st.pop(); pix.push(q); const x = q % W;
      for (const r of [q - 1, q + 1, q - W, q + W]) if (r >= 0 && r < W * H && m[r] && lab[r] < 0 && Math.abs((r % W) - x) <= 1) { lab[r] = res.length; st.push(r); } }
    let n = 0, sx = 0, sy = 0; for (const q of pix) { n += w[q]; sx += w[q] * (q % W + 0.5); sy += w[q] * (((q / W) | 0) + 0.5); }
    if (n < 40) { res.push(null); continue; }
    const cx = sx / n, cy = sy / n; let xx = 0, yy = 0, xy = 0;
    for (const q of pix) { const dx = q % W + 0.5 - cx, dy = ((q / W) | 0) + 0.5 - cy; xx += w[q] * dx * dx; yy += w[q] * dy * dy; xy += w[q] * dx * dy; }
    const th = 0.5 * Math.atan2(2 * xy, xx - yy); // major axis angle (rad), image coords
    const ux = Math.cos(th), uy = Math.sin(th);
    let umin = 1e9, umax = -1e9; const bins = new Map();
    for (const q of pix) { const dx = q % W + 0.5 - cx, dy = ((q / W) | 0) + 0.5 - cy; const u = dx * ux + dy * uy;
      const b = Math.round(u); bins.set(b, (bins.get(b) || 0) + w[q]); }
    const ks = [...bins.keys()].sort((a, b) => a - b).filter(k => bins.get(k) > 0.5); umin = ks[0]; umax = ks.at(-1);
    const widths = ks.map(k => bins.get(k)).sort((a, b) => b - a); const across = widths.length ? widths[Math.floor(widths.length * 0.15)] : 0;
    const along = umax - umin + 1;
    let deg = th * 180 / Math.PI; // major axis angle
    // express as rect {w (horizontal-ish), h (vertical-ish), a = rotation deg (CSS, clockwise)}
    let e;
    if (Math.abs(Math.abs(deg) - 90) < 45) { let a = deg - 90; if (a < -90) a += 180; if (a > 90) a -= 180; e = { x: cx, y: cy, w: across, h: along, a }; }
    else { e = { x: cx, y: cy, w: along, h: across, a: deg }; }
    res.push({ n, ...e });
  }
  return res.filter(e => e && e.n > 40).sort((a, b) => a.x - b.x).map(e => ({ x: +e.x.toFixed(2), y: +e.y.toFixed(2), w: +e.w.toFixed(1), h: +e.h.toFixed(1), a: +e.a.toFixed(2) }));
}

// ---- main ------------------------------------------------------------------
async function anchorMask() {
  if (!SHAPE) { const { data, info } = await sharp(anchorFile).raw().toBuffer({ resolveWithObject: true }); return silhouette(coverage(data, info.channels)); }
  // rasterise the canonical path, centred in the 1920x1080 frame (only relative points matter)
  const shp = JSON.parse(readFileSync(SHAPE, 'utf8'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="translate(${W / 2} ${H / 2}) scale(${SHAPE_SCALE})"><path d="${shp.path}" fill="#fff"/></g></svg>`;
  const g = await sharp(Buffer.from(svg)).flatten({ background: '#000' }).greyscale().raw().toBuffer();
  const sil = new Uint8Array(W * H); let n = 0; for (let k = 0; k < W * H; k++) if (g[k] >= 128) { sil[k] = 1; n++; }
  return { sil, n, bestN: n };
}
const AM = await anchorMask();
{
  const { sil, n } = AM;
  const pts = pointsOf(sil);
  let sx = 0, sy = 0; for (let k = 0; k < W * H; k++) if (sil[k]) { sx += k % W + 0.5; sy += ((k / W) | 0) + 0.5; }
  const cx = sx / n, cy = sy / n;
  const rel = new Float32Array(pts.length); for (let i = 0; i < pts.length; i += 2) { rel[i] = pts[i] - cx; rel[i + 1] = pts[i + 1] - cy; }
  A = { rel, cx, cy };
}

// radial signature (max radius per 0.25 deg) for rotation of unclipped frames
const NB = 1440;
function signature(sil, cx, cy) {
  const sig = new Float32Array(NB);
  for (let k = 0; k < W * H; k++) if (sil[k]) { const x = k % W + 0.5 - cx, y = ((k / W) | 0) + 0.5 - cy;
    const b = ((Math.round(Math.atan2(y, x) * NB / (2 * Math.PI)) % NB) + NB) % NB; const r = Math.hypot(x, y); if (r > sig[b]) sig[b] = r; }
  return sig;
}
function rotBetween(a, b) { // degrees (clockwise) that rotate a onto b
  const E = sh => { let e = 0; for (let i = 0; i < NB; i++) { const d = a[i] - b[(((i + sh) % NB) + NB) % NB]; e += d * d; } return e; };
  let best = 0, be = Infinity; for (let sh = -360; sh <= 360; sh += 2) { const e = E(sh); if (e < be) { be = e; best = sh; } }
  for (let sh = best - 2; sh <= best + 2; sh++) { const e = E(sh); if (e < be) { be = e; best = sh; } }
  const e0 = E(best - 1), e1 = E(best), e2 = E(best + 1), den = e0 - 2 * e1 + e2;
  return (best + (den > 0 ? 0.5 * (e0 - e2) / den : 0)) * 360 / NB;
}
let anchorSig, anchorArea;
{ const { sil, n } = AM; anchorSig = signature(sil, A.cx, A.cy); anchorArea = n; }
function touchesEdge(sil) { for (let x = 0; x < W; x++) if (sil[x] || sil[(H - 1) * W + x]) return true; for (let y = 0; y < H; y++) if (sil[y * W] || sil[y * W + W - 1]) return true; return false; }

const decoderArgs = video.endsWith('.webm') ? ['-c:v', 'libvpx-vp9'] : [];
const rangeArgs = [...(SS !== null ? ['-ss', SS] : []), ...(TO !== null ? ['-to', TO] : [])];
const ff = spawn(ffmpegPath, ['-v', 'error', ...decoderArgs, ...rangeArgs, '-i', video, '-vf', 'scale=1920:1080:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
let buf = Buffer.alloc(0), f = 0; const FR = W * H * 4; const frames = []; const pending = [];
for await (const chunk of ff.stdout) {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= FR) {
    const frame = buf.subarray(0, FR); buf = buf.subarray(FR);
    const cov = coverage(frame, 4); const { sil, n, bestN } = silhouette(cov);
    if (bestN < 200) frames.push(null);
    else if (!REG_ALL && !touchesEdge(sil)) {
      let sx = 0, sy = 0; for (let k = 0; k < W * H; k++) if (sil[k]) { sx += k % W + 0.5; sy += ((k / W) | 0) + 0.5; }
      const cx = sx / n, cy = sy / n; const rot = rotBetween(anchorSig, signature(sil, cx, cy));
      frames.push({ x: +cx.toFixed(2), y: +cy.toFixed(2), rot: +rot.toFixed(3), s: +Math.sqrt(n / anchorArea).toFixed(4), vis: 1, eyes: eyes(cov, sil) });
    } else { frames.push({ clipped: true, n, eyes: eyes(cov, sil) }); pending.push([f, pointsOf(sil)]); }
    process.stderr.write(`\r${f}`); f++;
  }
}
// registration for clipped frames, seeded from the nearest solved neighbour (walk outward)
const solved = i => frames[i] && !frames[i].clipped;
const byIdx = new Map(pending);
const order = [...byIdx.keys()].sort((a, b) => {
  const dist = i => { for (let d = 1; d < frames.length; d++) { if (solved(i - d) || solved(i + d)) return d; } return 1e9; };
  return dist(a) - dist(b);
});
for (const i of order) {
  const pts = byIdx.get(i); const tc = pts.length / 2;
  const seedIdx = [i - 1, i + 1, i - 2, i + 2].find(j => solved(j) || (frames[j] && frames[j].x !== undefined));
  const sd = seedIdx !== undefined ? frames[seedIdx] : null;
  const sil = new Uint8Array(W * H); for (let k = 0; k < pts.length; k += 2) sil[Math.floor(pts[k + 1]) * W + Math.floor(pts[k])] = 1;
  // sil above is sparse (STEP grid); score() samples exact pixels, so dilate to STEP cells
  for (let k = 0; k < pts.length; k += 2) { const x0 = Math.floor(pts[k]), y0 = Math.floor(pts[k + 1]); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < W && y < H) sil[y * W + x] = 1; } }
  const s0 = sd ? sd.s : 1;
  const fn = FIT_SCALE ? p => -score(p, sil, tc) : p => -score([p[0], p[1], p[2], s0], sil, tc);
  const seed0 = sd ? [sd.x, sd.y, sd.rot] : (() => { const [cx, cy] = centroid(pts); return [cx, cy + 150, 0]; })();
  const seed = FIT_SCALE ? [...seed0, s0] : seed0;
  const st1 = FIT_SCALE ? [20, 20, 3, 0.05] : [20, 20, 3], st2 = FIT_SCALE ? [3, 3, 0.5, 0.01] : [3, 3, 0.5];
  let best = nelderMead(fn, seed, st1, 160); best = nelderMead(fn, best.x, st2, 160);
  const sFit = FIT_SCALE ? best.x[3] : s0;
  const vis = Math.min(1, frames[i].n / (anchorArea * sFit * sFit)); // visible share of the body
  frames[i] = { x: +best.x[0].toFixed(2), y: +best.x[1].toFixed(2), rot: +best.x[2].toFixed(3), s: +sFit.toFixed(4), clipped: true, vis: +vis.toFixed(3), iou: +(-best.v).toFixed(4), eyes: frames[i].eyes };
}
// scales are relative to the anchor raster; with a canonical shape, report them vs the canonical
if (SHAPE) for (const fr of frames) if (fr && fr.s !== undefined) fr.s = +(fr.s * SHAPE_SCALE).toFixed(4);
writeFileSync(outFile, JSON.stringify({ video, colour: hex, anchor: SHAPE ? { shape: SHAPE, scale: SHAPE_SCALE } : { file: anchorFile, cx: A.cx, cy: A.cy, area: anchorArea }, fps: 30, frames }, null, 0));
console.error(`\nwrote ${frames.length} frames -> ${outFile}`);
